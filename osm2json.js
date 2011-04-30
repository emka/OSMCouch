var jsonfile;
var first_object = true;

Osmium.Callbacks.init = function() {
    print('Start!');
    jsonfile = Osmium.Output.CSV.open('bulk.json'); // normal file handler, "CSV" contains no separator if print() gets only one argument
    jsonfile.print('{"docs":[');
}

Osmium.Callbacks.end = function() {
    jsonfile.print(']}');
    jsonfile.close();
    print('End!');
}

Osmium.Callbacks.node = function() {
    output = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [this.lon, this.lat]
        },
        properties: {
            osm_type: 'node',
            osm_id: this.id,
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            lon: this.lon,
            lat: this.lat,
            tags: this.tags
        }
    };
    if (first_object) {
        first_object = false;
    }
    else {
        jsonfile.print(',');
    }
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.way = function() {
    geom = this.geom.linestring_wkt;
    // linestring_wkt is "LINESTRING(lon1 lat1,lon2 lat2,lonN latN)"
    coords = JSON.parse(geom.replace(/,/g,'],[').replace(/ /g,',').replace('LINESTRING(','[[').replace(')',']]'));
    output = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: coords
        },
        properties: {
            osm_type: 'way',
            osm_id: this.id,
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            tags: this.tags,
            nodes: this.nodes
        }
    };
    if (first_object) {
        first_object = false;
    }
    else {
        jsonfile.print(',');
    }
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.relation = function() {
    output = {
        members: this.members,
        properties: {
            osm_type: 'relation',
            osm_id: this.id,
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            tags: this.tags
        }
    };
    if (first_object) {
        first_object = false;
    }
    else {
        jsonfile.print(',');
    }
    jsonfile.print(JSON.stringify(output));
}

//Osmium.Callbacks.multipolygon = function() {
//    print('multipolygon from ' + this.from + ' ' + this.id + ' ' + this.version + ' ' + this.timestamp + ' ' + this.uid + ' ' + this.changeset);
//    for (key in this.tags) {
//        print(' ' + key + '=' + this.tags[key]);
//    }
//}
