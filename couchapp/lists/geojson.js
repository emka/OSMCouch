/**
 * Spatial list function, expects GeoJSON geometry as key and properties as value.
 * Outputs a GeoJSON FeatureCollection (compatible with OpenLayers).
 * 
 * @author Volker Mische
 * @author Mitja Kleider
 */
function(head, req) {
    var row, out, sep = '\n';

    // if client does not accept json, send plaintext header
    if (req.headers.Accept.indexOf('application/json') != -1)
      start({"headers":{"Content-Type" : "application/json"}});
    else
      start({"headers":{"Content-Type" : "text/plain; charset=utf-8"}});

    send('{"type": "FeatureCollection", "features":[');
    while (row = getRow()) {
        var omit = false;

        // query parameters (if any) must be present as tags
        for (var key in req.query) {
            if (key === 'bbox')
                continue; // skip bbox parameter
            else if (!row.value[key] || ((req.query[key].indexOf('|') === -1) && !(row.value[key] === req.query[key] || req.query[key] === '' || req.query[key] === '*'))) { // tag is not present
                    omit = true;
                    break; // do not check further filter tags
            }
            else if(row.value[key] && (req.query[key].indexOf('|') != -1)) { // multiple value options
                omit = true;
                var values = req.query[key].split('|');
                for (var i=0; i<values.length; i++) { // values in OR mode
                    if (row.value[key] === values[i])
                        omit = false;
                }
                if (omit) // no possible value matched
                    break; // do not check further filter tags
            }
        }
        if (!omit) {
            out = JSON.stringify({id: row.id, geometry:row.geometry, properties:row.value});
    
            send(sep + out);
            sep = ',\n';
        }
    }
    send("\n]}");
};
