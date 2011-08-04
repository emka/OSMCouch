/* Checks if all query_params exist as tags. Empty value or * is wildcard for any value. */
function(doc, req) {
    if (doc.tags) {
        var allow = true;
        for (var key in req.query) { // check all "key":"value"
            if (key === 'filter' || key === 'bbox')
                continue; // skip parameter
            if (doc.tags[key]) {
                var value = req.query[key];
                if (value !== '' && value !== '*') { // no wildcard, check for correct value
                    if (doc.tags[key] !== value)
                    {
                        allow = false;
                        break;
                    }
                }
            }
            else { // tag missing
                allow = false;
                break;
            }
        }
        return allow;
    }
    return false;
}
