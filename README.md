[Documentation](https://wiki.openstreetmap.org/wiki/OSMCouch)


# Bulk import

Convert OSM data to JSON with [Osmium](https://wiki.openstreetmap.org/wiki/Osmium):
    osmjs -2 -l disk -j osm2json.js planet.osm.pbf


Upload to CouchDB:
    curl -X POST -H "Content-Type: application/json" -d @bulk.json http://127.0.0.1:5984/$DB/_bulk_docs
