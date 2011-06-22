/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as amenity=restaurant
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.amenity) {
    if (doc.properties.amenity === 'restaurant') {
        emit(doc.geometry, doc.properties);
    }
  }
}
