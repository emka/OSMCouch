function(doc) {
    // !code vendor/osmcouch/spatialtag.js
    var geometry = geometry_tagged(doc, 'amenity', 'pub');
    if (geometry)
        emit(geometry, doc.tags);
}
