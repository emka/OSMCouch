/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as amenity=restaurant
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties) {
    if (doc.properties.tags && doc.properties.tags.amenity) {
        if (doc.properties.tags.amenity === 'restaurant') {
            emit(doc.geometry, doc);
        }
    }
  }
}
