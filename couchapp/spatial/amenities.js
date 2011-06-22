/**
 * OSM tag filtering example:
 * Only documents with geometry tagged as amenity
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.amenity) {
    emit(doc.geometry, doc.properties);
  }
}
