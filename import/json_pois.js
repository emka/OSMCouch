is_area = function(tags) {
    /* 
     * Checks if way tags define way as area.
     * Definitions are at http://wiki.openstreetmap.org/wiki/Map_Features
     * Do not apply on nodes!
     *
     * Ordered by number of occurrences for speed.
     */

    if (tags['area'] && tags['area'] === "yes") return true;
    if (tags['building']) return true;
    if (tags['amenity']) return true;
    if (tags['shop']) return true;
    if (tags['office']) return true;
    if (tags['boundary']) return true;
    if (tags['landuse']) return true;
    if (tags['leisure'] && !(tags['leisure'] === "track")) return true;
    if (tags['place']) return true;
    if (tags['waterway'] && tags['waterway'] === "riverbank") return true;
    if (tags['highway'] && tags['highway'] === "services") return true;
    if (tags['railway'] && (tags['railway'] === "station" || tags['railway'] === "turntable")) return true;
    if (tags['power'] && (tags['power'] === "station" || tags['power'] === "sub_station" || tags['power'] === "generator")) return true;
    if (tags['aeroway'] && (tags['aeroway'] === "aerodrome" || tags['aeroway'] === "terminal" || tags['aeroway'] === "helipad" || tags['aeroway'] === "apron")) return true;
    if (tags['aerialway'] && tags['aerialway'] === "station") return true;
    //if (tags['public_transport'] && tags['public_transport'] === "station") return true;
    if (tags['sport'] && !(tags['sport'] === "free_flying" || tags['sport'] === "toboggan" || tags['sport'] === "water_ski")) return true;
    if (tags['craft']) return true;
    if (tags['emergency']) return true;
    if (tags['historic']) return true;
    if (tags['military']) return true;
    if (tags['natural'] && !(tags['natural'] === "coastline" || tags['natural'] === "cliff")) return true;
    if (tags['tourism'] && !(tags['tourism'] === "artwork")) return true;
    if (tags['ele']) return true;
    if (tags['geological']) return true;
    // FIXME man_made

    return false;
}

is_poi = function(tags) {
    /*
     * Checks if node, way or relation is a Point Of Interest.
     */

    if (tags['amenity']) return true;
    if (tags['shop']) return true;
    if (tags['tourism']) return true;
    if (tags['leisure']) return true;
    if (tags['highway'] && (tags['highway'] === 'emergency_access_point')) return true;

    return false;
}

Osmium.Callbacks.init = function() {
    jsonfile = Osmium.Output.CSV.open('pois.json');
    timestamp = new Date();
    jsonfile.print('{"docs":[');
}

Osmium.Callbacks.end = function() {
    var output = { _id: 'meta', timestamp: timestamp.toString() }
    jsonfile.print(JSON.stringify(output));
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
    jsonfile.print(JSON.stringify(output)+',');
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
        jsonfile.print(JSON.stringify(output)+',');
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
        jsonfile.print(JSON.stringify(output)+',');
    }
}
