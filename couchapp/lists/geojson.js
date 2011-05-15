/**
 * This function outputs a GeoJSON FeatureCollection (compatible with
 * OpenLayers).
 * 
 * @author Volker Mische
 * @author Mitja Kleider
 */
function(head, req) {
    var row, out, sep = '\n';

    // Send the same Content-Type as CouchDB would send
    if (req.headers.Accept.indexOf('application/json') != -1)
      start({"headers":{"Content-Type" : "application/json"}});
    else
      start({"headers":{"Content-Type" : "text/plain"}});

    send('{"type": "FeatureCollection", "features":[');
    while (row = getRow()) {
        out = JSON.stringify(row.value);

        send(sep + out);
        sep = ',\n';
    }
    send("\n]}");
};
