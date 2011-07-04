numdict2array = function(dict) {
    var a = [];
    for (i in dict) {
       a.push(dict[i]);
    }
    return a;
}

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
        geom: this.geom.toArray(),
        version: this.version
        //timestamp: this.timestamp,
        //uid: this.uid,
        //user: this.user,
        //changeset: this.changeset,
    };
    if (JSON.stringify(this.tags) != '{}') // found no other way to check for empty tags with osmjs
        output['tags'] = this.tags;
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.way = function() {
    var geom = this.geom.toArray();
    if (is_closed(geom) && is_area(this.tags)) return; // do not output polygons as LineString ways
    var numbered_members = this.nodes;
    delete numbered_members['length'];
    var output = {
        _id: 'way'+this.id,
        geom: geom,
        version: this.version,
        //timestamp: this.timestamp,
        //uid: this.uid,
        //user: this.user,
        //changeset: this.changeset,
        tags: this.tags,
        nodes: numdict2array(numbered_members)
    };
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.relation = function() {
    if (is_multipolygon(this.tags)) return; // do not output MultiPolygons as relations
    var numbered_members = this.members;
    delete numbered_members['length'];
    var output = {
        _id: 'relation'+this.id,
        version: this.version,
        //timestamp: this.timestamp,
        //uid: this.uid,
        //user: this.user,
        //changeset: this.changeset,
        tags: this.tags,
        members: numdict2array(numbered_members)
    };
    jsonfile.print(JSON.stringify(output) + ',');
}

Osmium.Callbacks.area = function() {
    if (this.from === 'way' && !(is_area(this.tags))) return; // do not output non-area ways as Polygon
    var geom = this.geom.toArray();
    if (geom != undefined) {
        var numbered_members = this.members;
        delete numbered_members['length'];
        var output = {
            _id: this.from+this.id,
            geom: geom,
            version: this.version,
            //timestamp: this.timestamp,
            //uid: this.uid,
            //user: this.user,
            //changeset: this.changeset,
            tags: this.tags
        };
        if (this.from === 'way')
            output['nodes'] = numdict2array(numbered_members);
        else
            output['members'] = numdict2array(numbered_members);
        jsonfile.print(JSON.stringify(output) + ',');
    }
}
