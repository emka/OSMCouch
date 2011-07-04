/**
 * Only documents with geometry, tagged as amenity=restaurant
 *
 * Gets geometry type from doc.geom array depth.
 */
function(doc) {
    if (doc.tags && doc.tags.amenity && doc.tags.amenity === 'restaurant' && doc.geom && doc.geom.constructor.name === 'Array') {
        if (doc.geom[0].constructor.name === 'Array') { // LineString or Polygon or MultiPolygon
            if (doc.geom[0][0].constructor.name === 'Array') { // Polygon or MultiPolygon
                if (doc.geom[0][0][0].constructor.name === 'Array') { // MultiPolygon
                    emit({type:'MultiPolygon', coordinates:doc.geom}, doc.tags);
                }
                else {
                    emit({type:'Polygon', coordinates:doc.geom}, doc.tags);
                }
            }
            else {
                emit({type:'LineString', coordinates:doc.geom}, doc.tags);
            }
        }
        else { //if (doc.geom.length === 2 && doc.geom[0].constructor.name === 'Number' && doc.geom[1].constructor.name === 'Number') {
            emit({type:'Point', coordinates:doc.geom}, doc.tags);
        }
    }
}
