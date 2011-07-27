#!/usr/bin/env python

'''
Simple script to create imposm_coords.cache from $filename.
Requires (unmodified) imposm and imposm.parser
'''

from multiprocessing import JoinableQueue
from imposm.parser import OSMParser
from imposm.reader import CacheWriterProcess
from imposm.cache import OSMCache

filename = 'planet-latest.osm.pbf'

cache = OSMCache('.')
coords_queue = JoinableQueue(512)
coords_writer = CacheWriterProcess(coords_queue, cache.coords_cache, None, marshaled_data=True)
coords_writer.start()

parser = OSMParser(coords_callback=coords_queue.put)

parser.parse(filename)

coords_queue.put(None)
coords_writer.join()
