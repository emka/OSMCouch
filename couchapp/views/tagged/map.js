/**
 * OSM tag filtering example:
 * Only documents with geometry, tagged as anything, OSM tag key should be filtered with startkey and endkey
 * 
 */
function(doc) {
  if (doc.geometry && doc.properties) {
    if (doc.properties.tags) {
        for (tag in doc.properties.tags) {
            emit([tag, doc.properties.tags[tag]], doc);
        }
    }
  }
}
