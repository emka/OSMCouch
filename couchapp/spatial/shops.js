function(doc) {
    // !code vendor/osmcouch/spatialtag.js
    var geometry = geometry_tagged(doc, 'shop');
    if (geometry)
        emit(geometry, doc.tags);
}
