is_closed = function(geom) {
    var l = geom.length;
    if (l>2 && (geom[0][0] === geom[l-1][0]) && (geom[0][1] === geom[l-1][1]))
        return true;
    return false;
}


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

is_multipolygon = function(tags) {
    if (tags['type']) {
        if (tags['type'] === 'multipolygon') return true;
        if (tags['type'] === 'border') return true;
    }

    return false;
}
