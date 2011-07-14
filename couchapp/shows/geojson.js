/**
 * Create GeoJSON response from document.
 *
 * Gets geometry type from doc.geom array depth.
 */
function(doc, req) {
    if (doc && doc.geom && doc.geom.constructor.name === 'Array') {
        var feature = {
            type:'Feature',
            id: doc._id,
            properties:{}
        };
        if (doc.tags)
            feature.properties = doc.tags;
        if (doc.geom[0].constructor.name === 'Array') { // LineString or Polygon or MultiPolygon
            if (doc.geom[0][0].constructor.name === 'Array') { // Polygon or MultiPolygon
                if (doc.geom[0][0][0].constructor.name === 'Array') { // MultiPolygon
                    feature['geometry'] = {type:'MultiPolygon', coordinates:doc.geom};
                }
                else {
                    feature['geometry'] = {type:'Polygon', coordinates:doc.geom};
                }
            }
            else {
                feature['geometry'] = {type:'LineString', coordinates:doc.geom};
            }
        }
        else {
            feature['geometry'] = {type:'Point', coordinates:doc.geom};
        }
        var out = {};
        if (req.headers.Accept.indexOf('application/json') != -1) {
            out['headers'] = {'Content-Type':'application/json'};
        }
        else {
            out['headers'] =  {'Content-Type':'text/plain; charset=utf-8'};
        }
        if (req.query.callback) {
            out['body'] = req.query.callback+'('+JSON.stringify(feature)+');';
        }
        else {
            out['body'] = JSON.stringify(feature);
        }
        return out;
    }
}
