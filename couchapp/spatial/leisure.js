function(doc) {
    // !code vendor/osmcouch/spatialtag.js
    var geometry = geometry_tagged(doc, 'leisure');
    if (geometry)
        emit(geometry, doc.tags);
}
