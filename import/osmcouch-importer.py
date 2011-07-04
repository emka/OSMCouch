#!/usr/bin/env python

# OpenStreetMap .osm/.pbf/.osc to GeoCouch importer/updater


from imposm.parser import OSMParser
import imposm.geom
from imposm.multipolygon import ContainsRelationBuilder
import couchdb.client
import anyjson
import geojson

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

# override imposm.base CoordsCache
class CoordsCache(object):
    def __init__(self, db):
        self.db = db
    def get_coords(self, coord_ids):
        coords = []
        for coord_id in coord_ids:
            print 'coord', coord_id
            doc = self.db.get('node{}'.format(coord_id))
            print doc
            if doc:
                coords.append(tuple(doc['geom']))
            else:
                return None # one or more coords not found
        return coords

# override imposm.base WaysCache
class WaysCache(object):
    def __init__(self, db):
        self.db = db
    def get(self, way_id):
        print 'way', way_id
        doc = self.db.get('way{}'.format(way_id))
        print doc
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
        print 'revdep', docid
        return set(self.revdeps[docid])
    def get_dependencies(self, docid):
        print 'dep', docid
        # TODO how to handle missing documents
        if docid[0:3] == 'way':
            return map('node{}'.format, self.db[docid]['nodes'])
        elif docid[0:8] == 'relation':
            deps = []
            members =self.db[docid]['members']
            for member in members:
                if member['type'] == 'w':
                    deps.append('way{}'.format(member['ref']))
                elif member['type'] == 'n':
                    deps.append('node{}'.format(member['ref']))
                elif member['type'] == 'r':
                    deps.append('relation{}'.format(member['ref']))
            return deps

class OSMCInterpreter(object):
    def __init__(self, db):
        self.db = db
        self.linestring_builder = imposm.geom.LineStringBuilder()
        self.polygon_builder = imposm.geom.PolygonBuilder()
        self.coords_cache = CoordsCache(self.db)
        self.ways_cache = WaysCache(self.db)
        self.dependencies_cache = DependenciesCache(self.db)
        self.rebuild_objects = set([])

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

    def nodes_callback(self, nodes):
        for osm_id, tags, lonlat, version in nodes:
            cid = 'node{}'.format(osm_id)
            doc = self.db.get(cid)
            if not doc or version > doc['version']:
                if tags:
                    if doc:
                        self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':lonlat,'version':version,'tags':tags})
                        self.rebuild_objects.update(self.dependencies_cache.get_reverse_dependencies(cid))
                    else:
                        self.write_document({'_id':cid,'geom':lonlat,'version':version,'tags':tags})
                else:
                    if doc:
                        self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':lonlat,'version':version})
                        self.rebuild_objects.update(self.dependencies_cache.get_reverse_dependencies(cid))
                    else:
                        self.write_document({'_id':cid,'geom':lonlat,'version':version})

    def ways_callback(self, ways):
        for osm_id, tags, coord_ids, version in ways:
            cid = 'way{}'.format(osm_id)
            doc = self.db.get(cid)
            if not doc or version > doc['version']:
                coords = self.coords_cache.get_coords(coord_ids)
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
                        self.rebuild_objects.update(self.dependencies_cache.get_reverse_dependencies(cid))
                    else:
                        self.write_document({'_id':cid,'geom':geometry['coordinates'],'version':version, 'tags':tags, 'nodes':coord_ids})

    def relations_callback(self, relations):
        for osm_id, tags, members, version in relations:
            cid = 'relation{}'.format(osm_id)
            relation = OSMElem(osm_id, tags=tags, members=members)
            doc = self.db.get(cid)
            if not doc or version > doc['version']:
                # re-format members
                memberdicts = []
                for member_ref, member_type, member_role in members:
                    memberdicts.append({'ref':member_ref,'type':member_type[0],'role':member_role})

                if self.is_multipolygon(tags):
                    builder = ContainsRelationBuilder(relation, self.ways_cache, self.coords_cache)
                    try:
                        builder.build()
                    except imposm.geom.IncompletePolygonError:
                        continue # do not change object
                    geom = builder.relation.geom
    
                    geometry = geojson.loads(geojson.dumps(geom))
                    if doc:
                        self.write_document({'_id':cid, '_rev':doc['_rev'],'geom':geometry['coordinates'], 'version':version, 'tags':tags, 'members':memberdicts})
                    else:
                        self.write_document({'_id':cid, 'geom':geometry['coordinates'], 'version':version, 'tags':tags, 'members':memberdicts})
                else:
                    if doc:
                        self.write_document({'_id':cid, '_rev':doc['_rev'], 'version':version, 'tags':tags, 'members':memberdicts})
                    else:
                        self.write_document({'_id':cid, 'version':version, 'tags':tags, 'members':memberdicts})
                # TODO when relations containing relations are supported, rebuild reverse dependencies



    def write_document(self, doc):
        print(anyjson.serialize(doc))
        self.db.save(doc)
        # TODO: write to CouchDB


def main(filename, server_url, dbname):
    server = couchdb.client.Server(server_url)
    if dbname in server:
        db = server[dbname]
    else:
        db = server.create(dbname)

    interpreter = OSMCInterpreter(db)

    parser = OSMParser(nodes_callback=interpreter.nodes_callback)
    parser.parse(filename)
    parser = OSMParser(ways_callback=interpreter.ways_callback)
    parser.parse(filename)
    parser = OSMParser(relations_callback=interpreter.relations_callback)
    parser.parse(filename)
    

def usage():
    print('Usage: '+sys.argv[0]+' filename.ext http://user:password@host:5984/ dbname\n\nwhere ext can be .osm, .osm.pbf, .osc')

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 4:
        usage()
    else:
        import logging
        logging.basicConfig(filename='osmcouch-importer.log', level=logging.DEBUG)
        main(sys.argv[1], sys.argv[2], sys.argv[3])
