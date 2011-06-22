/**
 * Spatial list function, expects GeoJSON geometry as key and properties as value.
 * Outputs HTML.
 * 
 * @author Mitja Kleider
 */
function(head, req) {
    var i, j, row, rows=[], html, nameA, nameB, tags, geometry, id, type, osm_id, omit;

    start({"headers":{"Content-Type" : "text/html; charset=utf-8"}});

    send('<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>POI list</title>\n  <!--[if IE]>\n    <script src="http://html5shiv.googlecode.com/svn/trunk/html5.js"></script>\n  <![endif]-->\n  <script src="http://code.jquery.com/jquery-1.6.1.min.js" type="text/javascript"></script>\n  <script src="../style/common.js" type="text/javascript"></script>\n  <link rel="stylesheet" href="../style/list.css" type="text/css" />\n</head>\n<body id="index">\n  <div id="interface"></div>\n  <div id="objects" class="result">');
    while (row = getRow()) {
        omit = false;

        // query parameters (if any) must be present as tags
        for (var key in req.query) {
            if (key === 'bbox')
                continue; // skip bbox parameter
            else if (!(row.value[key] && (row.value[key] === req.query[key] || req.query[key] === '' || req.query[key] === '*'))) { // tag is not present
                    omit = true;
                    break; // do not check further filter tags
            }
        }
        if (!omit) {
            rows.push(row);
        }
    }
    rows.sort(function(a,b) {
        if (!a.value.name) {
            if (a.value.operator) nameA = a.value.operator.toLowerCase();
            else nameA = '';
        }
        else nameA = a.value.name.toLowerCase();
        if (!b.value.name) {
            if (b.value.operator) nameB = b.value.operator.toLowerCase();
            else nameB = '';
        }
        else nameB = b.value.name.toLowerCase();
        if (nameA < nameB) return -1;
        else if (nameA > nameB) return 1;
        else return 0;
    });
    for (i in rows) {
        row = rows[i];
        html = [];
        id = row.id;
        type = id.replace(/\d+/,'');
        osm_id = id.replace(/[a-z]+/,'');
        geometry = row.geometry;
        tags = row.value;

        html.push('<li id="'+type+osm_id+'"><div class="head">');
        //for (prefix in prefixes) {
        //    html.push(prefix_string(tags,prefix));
        //}
        if (tags['name']) {
          html.push('<strong>'+tags['name']+'</strong>');
        }
        else if (tags['operator']) {
          html.push('<strong>'+tags['operator']+'</strong>');
        }
        html.push('</div>');
        //html.push(format_address(tags));
        //html.push(format_contact(tags));
        //html.push(format_isil(tags));

        //convert_wikipedia_tags(tags);
        if (tags['wikipedia']) {
            html.push('<p class="wikipedia"></p>');
        }

        html.push('<div class="osm"><a href="http://www.openstreetmap.org/browse/'+type+'/'+osm_id+'">'+type+' '+osm_id+'</a><ul class="tags">');
        for ( j in tags ) {
            html.push('<li><a href="http://wiki.openstreetmap.org/wiki/Key:'+j+'">'+j+'</a>='+tags[j]+'</li>');
        }
        html.push('</ul></div>');
        html.push('<div class="maplink"><a href="../map.html?'+type+'='+osm_id+'">Map</a></div>');
        html.push('</li>');
        send(html.join(''));

        //localize_wikipedia(tags, type, osm_id, lang);

    }
    send('  </div>\n</body>\n</html>');
};
