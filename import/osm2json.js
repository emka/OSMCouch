/* Please note that this version of osm2json creates a multipolygon AND a way or relation if the way/relation is a multipolygon. */


var jsonfile;
var first_object = true;

Osmium.Callbacks.init = function() {
    jsonfile = Osmium.Output.CSV.open('bulk.json'); // normal file handler, "CSV" contains no separator if print() gets only one argument
    jsonfile.print('{"docs":[');
}

Osmium.Callbacks.end = function() {
    jsonfile.print(']}');
    jsonfile.close();
}

Osmium.Callbacks.node = function() {
    var output = {
        _id: 'node'+this.id,
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: this.geom.toArray()
        },
        properties: {
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
    var output = {
        _id: 'way'+this.id,
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: this.geom.toArray()
        },
        properties: {
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            tags: this.tags,
            nodes: this.nodes
        }
    };
    jsonfile.print(',');
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.relation = function() {
    var output = {
        _id: 'relation'+this.id,
        members: this.members,
        properties: {
            version: this.version,
            timestamp: this.timestamp,
            uid: this.uid,
            user: this.user,
            changeset: this.changeset,
            tags: this.tags
        }
    };
    jsonfile.print(',');
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.multipolygon = function() {
    var geom = this.geom.toArray();
    if (geom != undefined) {
        if (this.from === "way") {
            type = "Polygon";
        }
        else {
            type = "MultiPolygon";
        }
        var output = {
            _id: 'mp_'+this.from+this.id,
            type: "Feature",
            geometry: {
                type: type,
                coordinates: geom
            },
            properties: {
                timestamp: this.timestamp,
                tags: this.tags,
            }
        };
        jsonfile.print(',');
        jsonfile.print(JSON.stringify(output));
    }
}
