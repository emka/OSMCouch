geometry_tagged = function(doc, key, value) {
    /**
     * Returns geometry, if document is tagged as key=value or key=*
     *
     * Gets geometry type from doc.geom array depth.
     */
    if (doc.tags && doc.tags[key] && (!value || doc.tags[key] === value) && doc.geom && doc.geom.constructor.name === 'Array') {
        if (doc.geom[0].constructor.name === 'Array') { // LineString or Polygon or MultiPolygon
            if (doc.geom[0][0].constructor.name === 'Array') { // Polygon or MultiPolygon
                if (doc.geom[0][0][0].constructor.name === 'Array') { // MultiPolygon
                    return {type:'MultiPolygon', coordinates:doc.geom};
                }
                else {
                    return {type:'Polygon', coordinates:doc.geom};
                }
            }
            else {
                return {type:'LineString', coordinates:doc.geom};
            }
        }
        else { //if (doc.geom.length === 2 && doc.geom[0].constructor.name === 'Number' && doc.geom[1].constructor.name === 'Number') {
            return {type:'Point', coordinates:doc.geom};
        }
    }
}
