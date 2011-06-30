Osmium.Callbacks.init = function() {
    jsonfile = Osmium.Output.CSV.open('bulk.json');
    jsonfile.print('{"docs":[');
    
    timestamp = new Date();
}

Osmium.Callbacks.end = function() {
    var output = { _id: 'meta', timestamp: timestamp.toString() }
    jsonfile.print(JSON.stringify(output)); // make sure there is a document without comma at the end
    jsonfile.print(']}');
    jsonfile.close();
}
Osmium.Callbacks.node = function() {
    var output = {
        _id: 'node'+this.id,
        geom: this.geom.as_array,
        version: this.version,
        timestamp: this.timestamp,
        uid: this.uid,
        user: this.user,
        changeset: this.changeset,
        tags: this.tags
    };
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.way = function() {
    if (is_area(this.tags)) return; // do not output polygons as LineString ways
    var output = {
        _id: 'way'+this.id,
        geom: this.geom.as_array,
        version: this.version,
        timestamp: this.timestamp,
        uid: this.uid,
        user: this.user,
        changeset: this.changeset,
        tags: this.tags,
        nodes: this.nodes
    };
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.relation = function() {
    if (is_multipolygon(this.tags)) return; // do not output MultiPolygons as relations
    var output = {
        _id: 'relation'+this.id,
        members: this.members,
        version: this.version,
        timestamp: this.timestamp,
        uid: this.uid,
        user: this.user,
        changeset: this.changeset,
        tags: this.tags
    };
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.multipolygon = function() {
    if (this.from === 'way' && !is_area(this.tags)) return; // do not output non-area ways as Polygon
    var geom = this.geom.as_array;
    if (geom != undefined) {
        var output = {
            _id: this.from+this.id,
            geom: geom,
            timestamp: this.timestamp,
            tags: this.tags
        };
        jsonfile.print(JSON.stringify(output) + ',');
    }
}
