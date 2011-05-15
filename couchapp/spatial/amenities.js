/**
 * OSM tag filtering example:
 * Only documents with geometry tagged as amenity, amenity type can be filtered with startkey and endkey
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties) {
    if (doc.properties.tags && doc.properties.tags.amenity) {
      emit(doc.geometry, {
           type: doc.properties.tags.amenity,
           full: doc
           });
    }
  }
}
