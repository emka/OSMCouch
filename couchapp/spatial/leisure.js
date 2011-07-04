/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as leisure=*
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.leisure) {
    emit(doc.geometry, doc.properties);
  }
}
