is_area = function(tags) {
    /* 
     * Checks if way tags define way as area.
     * Do not apply on nodes!
     *
     * Ordered by number of occurrences for speed.
     */

    if (tags['area'] && tags['area'] === "yes") return true;
    if (tags['building']) return true;
    if (tags['shop']) return true;
    if (tags['boundary']) return true;
    if (tags['landuse']) return true;
    if (tags['place']) return true;
    if (tags['waterway'] && tags['waterway'] === "riverbank") return true;
    if (tags['sport'] && !(tags['sport'] === "free_flying" || tags['sport'] === "toboggan" || tags['sport'] === "water_ski")) return true;
    if (tags['craft']) return true;
    if (tags['emergency']) return true;
    if (tags['historic']) return true;
    if (tags['military']) return true;
    if (tags['natural'] && !(tags['natural'] === "coastline" || tags['natural'] === "cliff")) return true;
    if (tags['tourism'] && !tags['tourism'] === "artwork") return true;
    if (tags['ele']) return true;
    if (tags['geological']) return true;

    return false;
}

is_poi = function(tags) {
    /*
     * Checks if node, way or relation is a Point Of Interest.
     */

    if (tags['amenity']) return true;
    if (tags['shop']) return true;
    if (tags['tourism']) return true;

    return false;
}

Osmium.Callbacks.init = function() {
    jsonfile = Osmium.Output.CSV.open('pois.json');
    jsonfile.print('{"docs":[');
    
    var timestamp = new Date();
    var output = { _id: 'meta', timestamp: timestamp.toString() }
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.end = function() {
    jsonfile.print(']}');
    jsonfile.close();
}

Osmium.Callbacks.node = function() {
    if (!is_poi(this.tags)) return;
    var output = {
        _id: 'node'+this.id,
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: this.geom.as_array
        },
        version: this.version,
        properties: this.tags
    };
    jsonfile.print(',');
    jsonfile.print(JSON.stringify(output));
}

Osmium.Callbacks.way = function() {
    if (!is_poi(this.tags)) return;
    if (!is_area(this.tags)) { // do not output areas as LineString
        var output = {
            _id: 'way'+this.id,
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: this.geom.as_array
            },
            version: this.version,
            properties: this.tags
        };
        jsonfile.print(',');
        jsonfile.print(JSON.stringify(output));
    }
}

Osmium.Callbacks.multipolygon = function() {
    if (!is_poi(this.tags)) return;
    var type = "MultiPolygon";
    if (this.from === "way") {
        if (!is_area(this.tags)) return; // do not store non-area closed ways
        type = "Polygon";
    }
    var geom = this.geom.as_array;
    if (geom != undefined) {
        var output = {
            _id: this.from+this.id,
            type: "Feature",
            geometry: {
                type: type,
                coordinates: geom
            },
            properties: this.tags
        };
        jsonfile.print(',');
        jsonfile.print(JSON.stringify(output));
    }
}
