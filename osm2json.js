/* Please note that this version of osm2json creates a multipolygon AND a way or relation if the way/relation is a multipolygon. */


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
            coordinates: this.geom.as_array
        },
        properties: {
            osm_type: 'node',
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

Osmium.Callbacks.way = function() {
    output = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: this.geom.as_array
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

Osmium.Callbacks.multipolygon = function() {
    output = {
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: this.geom.as_array
        },
        properties: {
            osm_type: this.from,
            osm_id: this.id,
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            tags: this.tags,
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
