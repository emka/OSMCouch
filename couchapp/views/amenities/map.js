/**
 * OSM tag filtering example:
 * Only documents with geometry and amenity tag.
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties) {
    if (doc.properties.tags && doc.properties.tags.amenity) {
        emit(doc.properties.tags.amenity, doc);
    }
  }
}
