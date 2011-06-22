/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as shop=*
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.shop) {
    emit(doc.geometry, doc.properties);
  }
}
