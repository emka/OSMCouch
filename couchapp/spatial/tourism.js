/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as tourism=*
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.tourism) {
    emit(doc.geometry, doc.properties);
  }
}
