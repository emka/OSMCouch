/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as highway=emergency_access_point
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties && doc.properties.highway) {
    if (doc.properties.highway === 'emergency_access_point') {
        emit(doc.geometry, doc.properties);
    }
  }
}
