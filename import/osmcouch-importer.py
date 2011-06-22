#!/usr/bin/env python

# OpenStreetMap .osm/.pbf/.osc to GeoCouch importer/updater

'''
known issues:
    * multiple versions in one file will lead to multiple documents sharing the same old rev
'''

from imposm.parser import OSMParser
import imposm.geom
from imposm.multipolygon import ContainsRelationBuilder
from redish import proxy # store cache in Redis
#import couchdb
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

class CoordsCache(object):
    def __init__(self, cache):
        self.cache = cache
    def get_coords(self, coord_ids):
        coords = []
        for coord_id in coord_ids:
            coord_cid = 'coord{}'.format(coord_id)
            coords.append((float(self.cache[coord_cid]['lon']),float(self.cache[coord_cid]['lat'])))
        return coords

class WaysCache(object):
    def __init__(self, cache):
        self.cache = cache
    def get(self, way_id):
        refs=map(int,self.cache[way_id])
        return OSMElem(way_id, refs=refs)

class OSMCInterpreter(object):
    rebuild_objects = set([])
    check_if_node = set([])
    def __init__(self, cache={}, dependencies_cache={}, reverse_dependencies_cache={}, ways_cache={}):
        self.cache = cache
        self.coords_cache = CoordsCache(cache)
        self.ways_cache = WaysCache(ways_cache)
        self.dependencies = dependencies_cache
        self.reverse_dependencies = reverse_dependencies_cache
        self.linestring_builder = imposm.geom.LineStringBuilder()
        self.polygon_builder = imposm.geom.PolygonBuilder()
    def coords_callback(self, coords):
        for osm_id, lon, lat, version in coords:
            cid = 'coord{}'.format(osm_id)
            if cid not in self.cache:
                # add coord to cache
                self.cache[cid] = {'version':version, 'lon':lon, 'lat':lat}
                #self.reverse_dependencies[cid] = set([]) # redis does not support creation of empty sets
            elif int(version) > int(self.cache[cid]['version']):
                # add coord to cache
                self.cache[cid] = {'version':version, 'lon':lon, 'lat':lat}
                # add reverse dependencies to rebuild list
                if cid in self.reverse_dependencies:
                    for revdep_id in self.reverse_dependencies[cid]:
                        rebuild_objects.add(revdep_id)
                # might have had tags in previous and now just be a coord
                self.check_if_node.add(osm_id)

    def nodes_callback(self, nodes):
        for osm_id, tags, lonlat, version in nodes:
            self.check_if_node.discard(osm_id) # yes, it is a node
            lon, lat = lonlat
            cid = 'node{}'.format(osm_id)
            if cid not in self.cache:
                self.cache[cid] = {'version':version, 'rev':''}
                # write document without rev
                self.write_document(anyjson.serialize({'_id':cid,'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':tags}))
            elif int(version) > int(self.cache[cid]['version']):
                self.cache[cid]['version'] = version
                self.write_document(anyjson.serialize({'_id':cid,'_rev':self.cache[cid]['rev'],'type':'Feature','geometry':{'type':'Point','coordinates':[lon,lat]},'properties':tags}))
                # do not add reverse dependencies to rebuild list, dependencies are on coords

    def ways_callback(self, ways):
        for osm_id, tags, coord_ids, version in ways:
            cid = 'way{}'.format(osm_id)
            if cid not in self.cache:
                osm_elem = OSMElem(osm_id, coords=self.coords_cache.get_coords(coord_ids))
                try:
                    # FIXME depending on tags, use polygon builder instead
                    geom = self.linestring_builder.build_checked_geom(osm_elem)
                except imposm.geom.InvalidGeometryError:
                    return # do not change object
                self.cache[cid] = {'version':version,'rev':''}
                self.ways_cache.cache[osm_id] = coord_ids
                #self.reverse_dependencies[cid] = set([]) # Redis does not support empty sets
                self.write_document(anyjson.serialize({'_id':cid,'type':'Feature','geometry':geojson.loads(geojson.dumps(geom)),'properties':tags}))
                # store dependencies
                coord_cids = map(lambda x: 'coord{}'.format(x), coord_ids)
                self.dependencies[cid] = set(coord_cids)
                # store reverse dependencies
                for coord_id in coord_ids:
                    coord_cid = 'coord{}'.format(coord_id)
                    if coord_cid in self.reverse_dependencies:
                        self.reverse_dependencies[coord_cid].add(cid)
                    else:
                        self.reverse_dependencies[coord_cid] = {cid,}

            elif int(version) > int(self.cache[cid]['version']):
                osm_elem = OSMElem(osm_id, coords=self.coords_cache.get_coords(coord_ids))
                try:
                    # FIXME depending on tags, use polygon builder instead
                    geom = self.linestring_builder.build_checked_geom(osm_elem)
                except imposm.geom.InvalidGeometryError:
                    return # do not change object
                self.cache[cid]['version'] = version
                self.ways_cache.cache[osm_id] = coord_ids
                # write document with rev
                self.write_document(anyjson.serialize({'_id':cid,'_rev':self.cache[cid]['rev'],'type':'Feature','geometry':{'type':geomtype,'coordinates':geom},'properties':tags}))
                # delete old reverse dependencies
                for coord_cid in self.dependencies[cid]:
                    self.reverse_dependencies[coord_cid].remove(cid)
                # update dependencies
                coord_cids = map(lambda x: 'coord{}'.format(x), coord_ids)
                self.dependencies[cid] = set(coord_cids)
                # store reverse dependencies
                for coord_id in coord_ids:
                    coord_cid = 'coord{}'.format(coord_id)
                    if coord_cid in self.reverse_dependencies:
                        self.reverse_dependencies[coord_cid].add(cid)
                    else:
                        self.reverse_dependencies[coord_cid] = {cid,}

    def relations_callback(self, relations):
        for osm_id, tags, members, version in relations:
            cid = 'relation{}'.format(osm_id)
            relation = OSMElem(osm_id, tags=tags, members=members)
            if cid not in self.cache or int(version) > int(self.cache[cid]['version']):
                builder = ContainsRelationBuilder(relation, self.ways_cache, self.coords_cache)
                try:
                    builder.build()
                except imposm.geom.IncompletePolygonError:
                    return # do not change object
                geom = builder.relation.geom
                if cid not in self.cache:
                    self.cache[cid] = {'version':version,'rev':''}
                    self.write_document(anyjson.serialize({'_id':cid,'type':'Feature','geometry':geojson.loads(geojson.dumps(geom)),'properties':tags}))
                else:
                    self.cache[cid]['version'] = version
                    self.write_document(anyjson.serialize({'_id':cid,'_rev':self.cache[cid]['rev'],'type':'Feature','geometry':geojson.loads(geojson.dumps(geom)),'properties':tags}))
                    # delete reverse dependencies
                    for member_cid in self.dependencies[cid]:
                        self.reverse_dependencies[member_cid].remove(cid)

                deps = [] # dependencies
                for member_osm_id, member_type, member_role in members:
                    member_cid = '{}{}'.format(member_type, member_osm_id)
                    deps.append(member_cid)
                    # store reverse dependencies
                    if member_cid in self.reverse_dependencies:
                        self.reverse_dependencies[member_cid].add(cid)
                    else:
                        self.reverse_dependencies[member_cid] = {cid,}
                # store dependencies
                self.dependencies[cid] = set(deps)


    def write_document(self, docstring):
        print(docstring)
        # TODO: write to CouchDB, store returned _rev in cache


def main(filename):
    # initialize Redis cache
    cache = proxy.Proxy()
    cache.flushdb() # delete cache, TODO remove
    
    interpreter = OSMCInterpreter(cache=cache, dependencies_cache=cache.keyspace('%s:deps'), reverse_dependencies_cache=cache.keyspace('%s:revdeps'), ways_cache=cache.keyspace('way%d:coords'))

    parser = OSMParser(coords_callback=interpreter.coords_callback,nodes_callback=interpreter.nodes_callback)
    parser.parse(filename)
    parser = OSMParser(ways_callback=interpreter.ways_callback)
    parser.parse(filename)
    parser = OSMParser(relations_callback=interpreter.relations_callback)
    parser.parse(filename)
    
    # delete nodes that became coords only
    for osm_id in interpreter.check_if_node:
        nodeid = 'node{}'.format(osm_id)
        coordid = 'coord{}'.format(osm_id)
        if nodeid in cache: # node exists
            if int(cache[nodeid]['version']) < int(cache[coordid]['version']): # updated OSM node has no tags
                pass
                # delete old node
                interpreter.write_document('''{{'_id':'{id}','_rev':'{rev}','_deleted':true}}'''.format(id=nodeid,rev=cache[nodeid]['rev']))

def usage():
    print('Usage: '+sys.argv[0]+' filename.ext\n\nwhere ext can be .osm, .osm.pbf, .osc')

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2:
        usage()
    else:
        import logging
        logging.basicConfig(filename='osmcouch-importer.log', level=logging.DEBUG)
        main(sys.argv[1])
