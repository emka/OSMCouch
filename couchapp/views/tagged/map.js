/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as anything, OSM tag key should be filtered with startkey and endkey
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties) {
    for (tag in doc.properties) {
        emit([tag, doc.properties[tag]], doc);
    }
  }
}
