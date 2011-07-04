/* Documents with geometry, tagged as amenity. */
function(doc) {
    if (doc.geometry && doc.tags && doc.tags.amenity) {
        emit(doc.geometry, doc.tags);
    }
}
