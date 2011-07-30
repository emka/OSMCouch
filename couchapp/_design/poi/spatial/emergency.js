function(doc) {
    // !code vendor/osmcouch/spatialtag.js
    var geometry = geometry_tagged(doc, 'highway', 'emergency_access_point');
    if (geometry)
        emit(geometry, doc.tags);
}
