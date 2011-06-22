/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as amenity=pub
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.amenity) {
    if (doc.properties.amenity === 'pub') {
        emit(doc.geometry, doc.properties);
    }
  }
}
