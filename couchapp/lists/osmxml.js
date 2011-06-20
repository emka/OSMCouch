/**
 * This function outputs OSM XML.
 * http://wiki.openstreetmap.org/wiki/XML#OSM_XML_file_format
 * http://wiki.openstreetmap.org/wiki/Data_Primitives
 * 
 * @author Mitja Kleider
 */
function(head, req) {
    var row, id, lat, lon, changeset, user, uid, timestamp, version, tags, nodes;

    function isEmpty(obj) {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop))
                return false;
        }
        return true;
    }

    start({"headers":{"Content-Type" : "text/xml; charset=utf-8"}});

    send('<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6" generator="OSMCouch 0.0.1">\n');
    while (row = getRow()) {
        if (row.id) {
            if (row.id.substring(0,4) === 'node') {
                id = row.id.substring(4);
                lat = row.value.geometry.coordinates[1];
                lon = row.value.geometry.coordinates[0];
                changeset = row.value.properties.changeset;
                user = row.value.properties.user;
                uid = row.value.properties.uid;
                timestamp = row.value.properties.timestamp;
                version = row.value.properties.version;
                send('  <node id="'+id+'" lat="'+lat+'" lon="'+lon+'" changeset="'+changeset+'" user="'+user+'" uid="'+uid+'" visible="true" timestamp="'+timestamp+'" version="'+version+'"');
                tags = row.value.properties.tags;
                if (isEmpty(tags)) {
                    send('/>\n');
                }
                else {
                    send('>\n');
                    for (tag in tags) {
                        send('    <tag k="'+tag+'" v="'+tags[tag]+'"/>\n');
                    }
                    send('  </node>\n');
                }
            }
            else if (row.id.substring(0,3) === 'way') {
                id = row.id.substring(3);
                lat = row.value.geometry.coordinates[1];
                lon = row.value.geometry.coordinates[0];
                changeset = row.value.properties.changeset;
                user = row.value.properties.user;
                uid = row.value.properties.uid;
                timestamp = row.value.properties.timestamp;
                version = row.value.properties.version;
                send('  <way id="'+id+'" visible="true" timestamp="'+timestamp+'" version="'+version+'" changeset="'+changeset+'" user="'+user+'" uid="'+uid+'">\n');
                nodes = row.value.properties.nodes;
                for (var i=0; i<nodes.length; i++) {
                    send('    <nd ref="'+nodes[i]+'"/>\n');
                }
                tags = row.value.properties.tags;
                for (tag in tags) {
                    send('    <tag k="'+tag+'" v="'+tags[tag]+'"/>\n');
                }
                send('  </way>\n');
            }
        }
    }
    send('</osm>');
};
