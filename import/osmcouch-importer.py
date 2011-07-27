#!/usr/bin/env python

# OpenStreetMap .osm/.pbf/.osc to GeoCouch importer/updater


from imposm.parser import OSMParser
import imposm.geom
from imposm.multipolygon import ContainsRelationBuilder
import couchdb.client
import geojson
from datetime import datetime

try: 
    import shapely.speedups 
    if shapely.speedups.available: 
        shapely.speedups.enable() 
except ImportError: 
    try: 
        import shapely_speedups 
        shapely_speedups.patch_shapely() 
    except ImportError: 
        pass 


BULK_SIZE = 10000


# override imposm.base OSMElem
class OSMElem(object):
    def __init__(self, osm_id, coords=[], tags=[], refs=[], members=[]):
        self.osm_id = osm_id
        self.coords = coords
        self.tags = tags
        self.refs = refs
        self.partial_refs = None
        self.members = members
        self.inserted = False

class CoordsCacheView(object):
    '''Get way node coordinates with a single HTTP request.'''
    def __init__(self, db):
        self.db = db
    def get_coords(self, coord_ids):
        rows = self.db.view('_all_docs', None, include_docs=True, keys=map('node{0}'.format, coord_ids)).rows
        coords = []
        for row in rows:
            if not row['doc'] or 'error' in row:
                return None
            else:
                coords.append(row['doc']['geom'])
        return coords

class CoordsCacheSingle(object):
    '''Get way node coordinates with multiple single node HTTP requests.
    This method is faster if nodes are probably missing.'''
    def __init__(self, db):
        self.db = db
    def get_coords(self, coord_ids):
        coords = []
        for coord_id in coord_ids:
            doc = self.db.get('node{0}'.format(coord_id))
            if doc:
                coords.append(tuple(doc['geom']))
            else:
                return None # one or more coords not found
        return coords

# override imposm.base CoordsCache
class CoordsCache(CoordsCacheView):
    pass

# override imposm.base WaysCache
class WaysCache(object):
    def __init__(self, db):
        self.db = db
    def get(self, way_id):
        doc = self.db.get('way{0}'.format(way_id))
        if doc:
            return OSMElem(way_id, refs=doc['nodes'])
        else:
            return None # way not found


class DependenciesCache(object):
    '''Get dependecies and reverse dependencies from CouchDB'''
    def __init__(self, db):
        self.db = db
        self.revdeps = self.db.view('_design/maintenance/_view/revdeps', lambda row: row['value'])
    def get_reverse_dependencies(self, docid):
        if 'stale' not in self.revdeps.options: # first view has no stale option
            # all views after the first view should have the stale option
            self.revdeps = self.db.view('_design/maintenance/_view/revdeps', lambda row: row['value'], stale='ok')
        return set(self.revdeps[docid])
    def get_dependencies(self, docid):
        doc = self.db.get(docid)
        if not doc:
            return None
        if docid[0:3] == 'way':
            return map('node{0}'.format, doc['nodes'])
        elif docid[0:8] == 'relation':
            deps = []
            members = doc['members']
            for member in members:
                if member['type'] == 'w':
                    deps.append('way{0}'.format(member['ref']))
                elif member['type'] == 'n':
                    deps.append('node{0}'.format(member['ref']))
                elif member['type'] == 'r':
                    deps.append('relation{0}'.format(member['ref']))
            return deps

class OSMCInterpreter(object):
    def __init__(self, server_url, dbname):
        server = couchdb.client.Server(server_url)
        if dbname in server:
            self.db = server[dbname]
            self.initial_import = False
        else:
            self.db = server.create(dbname)
            print('Do not forget to create maintenance views before they are queried!')
            self.initial_import = True

        self.linestring_builder = imposm.geom.LineStringBuilder()
        self.polygon_builder = imposm.geom.PolygonBuilder()
        if self.initial_import:
            # FIXME requires existing imposm_coords.cache
            from imposm.cache import OSMCache
            self.imposm_cache = OSMCache('.')
            self.coords_cache = self.imposm_cache.coords_cache(mode='r')
        else:
            self.coords_cache = CoordsCache(self.db)
        self.ways_cache = WaysCache(self.db)
        self.dependencies_cache = DependenciesCache(self.db)
        self.rebuild_objects_cache = set([])
        self.write_cache = []
        self.delete_callbacks_cache = []
        self.nodes_callback_cache = []
        self.ways_callback_cache = []
        self.relations_callback_cache = []

    def is_multipolygon(self,tags):
        return 'type' in tags and (tags['type'] == 'multipolygon' or tags['type'] == 'border')

    def is_area(self,tags):
        if 'area' in tags and tags['area'] == 'yes': return True
        if 'building' in tags: return True
        if 'shop' in tags: return True
        if 'boundary' in tags: return True
        if 'landuse'  in tags: return True
        if 'place' in tags: return True
        if 'waterway' in tags and tags['waterway'] == 'riverbank': return True
        if 'sport' in tags and not (tags['sport'] == 'free_flying' or tags['sport'] == 'toboggan' or tags['sport'] == 'water_ski'): return True
        if 'craft' in tags: return True
        if 'emergency' in tags: return True
        if 'historic' in tags: return True
        if 'military' in tags: return True
        if 'natural' in tags and not (tags['natural'] == 'coastline' or tags['natural'] == 'cliff'): return True
        if 'tourism' in tags and not tags['tourism'] == 'artwork': return True
        if 'ele' in tags: return True
        if 'geological' in tags: return True
        return False

    def handle_nodes(self):
        if self.nodes_callback_cache:
            if not self.initial_import:
                docs = dict(self.db.view('_all_docs', lambda row: (None,None) if 'doc' not in row or 'error' in row else (row['id'],row['doc']), include_docs=True, keys=map('node{0}'.format, zip(*self.nodes_callback_cache)[0])).rows)
            for osm_id, tags, lonlat, version in self.nodes_callback_cache:
                cid = 'node{0}'.format(osm_id)
                doc = docs.get(cid) if not self.initial_import else None
                if not doc or version > doc['version']:
                    if tags:
                        if doc:
                            self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':lonlat,'version':version,'tags':tags})
                            self.rebuild_objects_cache.update(self.dependencies_cache.get_reverse_dependencies(cid))
                        else:
                            self.write_document({'_id':cid,'geom':lonlat,'version':version,'tags':tags})
                    else:
                        if doc:
                            self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':lonlat,'version':version})
                            self.rebuild_objects_cache.update(self.dependencies_cache.get_reverse_dependencies(cid))
                        else:
                            self.write_document({'_id':cid,'geom':lonlat,'version':version})
            self.nodes_callback_cache = []

    def ways_callback(self, ways):
        if ways and not self.initial_import:
            #docs = dict(self.db.view('_all_docs', lambda row: (None,None) if 'doc' not in row or 'error' in row else (row['id'],row['doc']), include_docs=True, keys=map('way{0}'.format, zip(*ways)[0])).rows)
            # docs dict from nodes view contains all way nodes already
            docs = dict(self.db.view('_design/maintenance/_view/nodes', lambda row: (row['value']['_id'],row['doc']) if row['value'] else (row['id'],row['doc']), include_docs=True, keys=map('way{0}'.format, zip(*ways)[0])).rows, stale='ok')
        else:
            docs = {}
        for osm_id, tags, coord_ids, version in ways:
            cid = 'way{0}'.format(osm_id)
            doc = docs.get(cid) if not self.initial_import else None
            if not doc or version > doc['version']:
                if doc and cid not in self.rebuild_objects_cache and doc['nodes'] == coord_ids: # no need to rebuild way geometry
                    doc['version'] = version
                    doc['tags'] = tags
                    self.write_document(doc)
                else:
                    if self.initial_import:
                        coords = self.coords_cache.get_coords(coord_ids)
                    else:
                        # get coordinates from node documents in docs
                        coords = []
                        for osm_id in coord_ids:
                            if docs:
                                coord_doc = docs.get('node{0}'.format(osm_id)) or self.db.get('node{0}'.format(osm_id))
                            if coord_doc:
                                coords.append(coord_doc['geom'])
                            else:
                                coords = None
                                break

                    if coords:
                        osm_elem = OSMElem(osm_id, coords=coords)
                        try:
                            if self.is_area(tags):
                                geom = self.polygon_builder.build_checked_geom(osm_elem)
                            else:
                                geom = self.linestring_builder.build_checked_geom(osm_elem)
                        except imposm.geom.InvalidGeometryError:
                            continue # do not change object

                        geometry = geojson.loads(geojson.dumps(geom))
                        if doc:
                            self.write_document({'_id':cid, '_rev':doc['_rev'], 'geom':geometry['coordinates'],'version':version, 'tags':tags, 'nodes':coord_ids})
                            self.rebuild_objects_cache.update(self.dependencies_cache.get_reverse_dependencies(cid))
                        else:
                            self.write_document({'_id':cid,'geom':geometry['coordinates'],'version':version, 'tags':tags, 'nodes':coord_ids})
                        self.rebuild_objects_cache.discard(cid)

    def relations_callback(self, relations):
        if relations and not self.initial_import:
            docs = dict(self.db.view('_all_docs', lambda row: (None,None) if 'error' in row else (row['id'],row['doc']), include_docs=True, keys=map('relation{0}'.format, zip(*relations)[0])).rows)
        for osm_id, tags, members, version in relations:
            cid = 'relation{0}'.format(osm_id)
            relation = OSMElem(osm_id, tags=tags, members=members)
            doc = docs.get(cid) if not self.initial_import else None
            if not doc or version > doc['version']:
                # re-format members
                memberdicts = []
                for member_ref, member_type, member_role in members:
                    memberdicts.append({'ref':member_ref,'type':member_type[0],'role':member_role})

                if self.is_multipolygon(tags):
                    if doc and cid not in self.rebuild_objects_cache and doc['members'] == memberdicts: # no need to rebuild geom
                        doc['version'] = version
                        doc['tags'] = tags
                        self.write_document(doc)
                    else:
                        builder = ContainsRelationBuilder(relation, self.ways_cache, self.coords_cache)
                        try:
                            builder.build()
                        except imposm.geom.IncompletePolygonError:
                            if self.initial_import:
                                # write without geometry
                                self.write_document({'_id':cid, 'version':version, 'tags':tags, 'members':memberdicts})
                            continue # next relation
                        geom = builder.relation.geom
    
                        try:
                            geometry = geojson.loads(geojson.dumps(geom))
                        except ValueError: # if geom is Polygon (not MultiPolygon), it has no '__geo_interface__'
                            if self.initial_import:
                                # write without geometry
                                self.write_document({'_id':cid, 'version':version, 'tags':tags, 'members':memberdicts})
                            continue
                        if doc:
                            self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':geometry['coordinates'], 'version':version, 'tags':tags, 'members':memberdicts})
                        else:
                            self.write_document({'_id':cid, 'geom':geometry['coordinates'], 'version':version, 'tags':tags, 'members':memberdicts})
                        self.rebuild_objects_cache.discard(cid)
                        # TODO when relations containing relations are supported, rebuild reverse dependencies
                else:
                    if doc:
                        self.write_document({'_id':cid, '_rev':doc['_rev'], 'version':version, 'tags':tags, 'members':memberdicts})
                    else:
                        self.write_document({'_id':cid, 'version':version, 'tags':tags, 'members':memberdicts})

    def nodes_callback(self, nodes):
        if nodes:
            self.nodes_callback_cache.extend(nodes)
            if len(self.nodes_callback_cache) >= BULK_SIZE:
                self.handle_nodes()

    def delete_objects_callback(self, objects, objtype):
        if not self.initial_import and objects:
            osm_ids, versions = zip(*objects)
            cid_template = '{0}{{0}}'.format(objtype)
            cids = map(cid_template.format, osm_ids)
            self.delete_callbacks_cache.extend(zip(cids, versions))
            if len(self.delete_callbacks_cache) >= BULK_SIZE:
                self.handle_delete_objects()

    def handle_delete_objects(self):
        if self.delete_callbacks_cache:
            docs = dict(self.db.view('_all_docs', lambda row: (None,None) if 'error' in row else (row['id'],row['doc']), include_docs=True, keys=zip(*self.delete_callbacks_cache)[0]).rows)
            for cid, version in self.delete_callbacks_cache:
                doc = docs.get(cid)
                if doc and version > doc['version']:
                    self.delete_document(doc)
            self.delete_callbacks_cache = []

    def delete_nodes_callback(self, objects):
        self.delete_objects_callback(objects,'node')

    def delete_ways_callback(self, objects):
        self.delete_objects_callback(objects,'way')

    def delete_relations_callback(self, objects):
        self.delete_objects_callback(objects,'relation')

    def delete_document(self, doc):
        self.write_cache.append({'_id':doc['_id'], '_rev':doc['_rev'], '_deleted':True})
        if len(self.write_cache) >= BULK_SIZE:
            self.write_bulk()

    def write_document(self, doc):
        self.write_cache.append(doc)
        if len(self.write_cache) >= BULK_SIZE:
            self.write_bulk()

    def write_bulk(self, retry=0):
        if self.write_cache:
            try:
                self.db.update(self.write_cache)
            except AttributeError: # workaround python-couchdb error
                if retry == 10:
                    raise Exception('write retries failed')
                self.write_bulk(retry+1)
            else:
                #print '+%d'%len(self.write_cache)
		self.write_cache = []

    def rebuild_objects(self):
        # write cached documents before rebuilding objects
        self.write_bulk()
        while self.rebuild_objects_cache:
            cid = self.rebuild_objects_cache.pop()
            doc = self.db.get(cid)
            if cid[0:3] == 'way' and doc:
                coords = self.coords_cache.get_coords(doc['nodes'])
                if coords:
                    osm_elem = OSMElem(int(cid[3:]), coords=coords)
                    try:
                        if self.is_area(doc['tags']):
                            geom = self.polygon_builder.build_checked_geom(osm_elem)
                        else:
                            geom = self.linestring_builder.build_checked_geom(osm_elem)
                    except imposm.geom.InvalidGeometryError:
                        continue # do not change object
                    geometry = geojson.loads(geojson.dumps(geom))
                    doc['geom'] = geometry['coordinates']
                    self.write_document(doc) # cached write is fine as dependencies did not change
                    self.rebuild_objects_cache.update(self.dependencies_cache.get_reverse_dependencies(cid)) 
            elif cid[0:8] == 'relation' and doc:
                if self.is_multipolygon(doc['tags']):
                    # create relation member tuples for imposm
                    membertuples = []
                    for member in doc['members']:
                        if member['type'] == 'n':
                            member_type = 'node'
                        elif member['type'] == 'w':
                            member_type = 'way'
                        else:
                            member_type = 'relation'
                        membertuples.append((member['ref'],member_type,member['role']))
                    relation = OSMElem(int(cid[8:]), tags=doc['tags'], members=membertuples)
                    builder = ContainsRelationBuilder(relation, self.ways_cache, self.coords_cache)
                    try:
                        builder.build()
                    except imposm.geom.IncompletePolygonError:
                        continue # do not change object
                    geom = builder.relation.geom
    
                    geometry = geojson.loads(geojson.dumps(geom))
                    doc['geom'] = geometry['coordinates']
                    self.write_document(doc)
                    # TODO when relations containing relations are supported, rebuild reverse dependencies
        self.write_bulk()

    def __del__(self):
        self.rebuild_objects()


def main(server_url, dbname, filename):
    interpreter = OSMCInterpreter(server_url, dbname)
    parser = OSMParser(nodes_callback=interpreter.nodes_callback, delete_nodes_callback=interpreter.delete_nodes_callback, delete_ways_callback=interpreter.delete_ways_callback, delete_relations_callback=interpreter.delete_relations_callback)
    parser.parse(filename)
    interpreter.handle_delete_objects()
    interpreter.write_bulk()
    interpreter.handle_nodes()
    interpreter.write_bulk()
    
    if not interpreter.initial_import:
        # query way nodes view once without stale to update it
        interpreter.db.view('_design/maintenance/_view/nodes', None, key='banana').rows

    parser = OSMParser(ways_callback=interpreter.ways_callback)
    parser.parse(filename)
    interpreter.write_bulk()
    parser = OSMParser(relations_callback=interpreter.relations_callback)
    parser.parse(filename)
    

def usage():
    print('Usage: '+sys.argv[0]+' http://user:password@host:5984/ dbname filename.ext\n\nwhere ext can be .osm, .osm.pbf, .osc')

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 4:
        usage()
    else:
        import logging
        logging.basicConfig(filename='osmcouch-importer.log', level=logging.DEBUG)
        main(sys.argv[1], sys.argv[2], sys.argv[3])
