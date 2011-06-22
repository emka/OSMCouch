$.urlParam = function(name){
    /* read value of URL parameter with given name */
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results) {
      return results[1];
    } else return null;
}

var translations = {};
_ = function(text) {
    /* translate text */
    if (translations[text])
        return translations[text];
    else
        return text;
}

var prefixes = {};
prefix_string = function(tags, key) {
    /* return prefix for given key and its value in tags */
    if (tags[key]) {
        if ((prefixes[key]) && (prefixes[key][tags[key]])) {
            return prefixes[key][tags[key]] + ' ';
        }
    }
    return '';
}


function get_available_tags() {
    /* Return a list of tags that have both icon and prefix. Index is the prefix (makes sure it appears only once). */
    available_tags={};
    for (key in icons.tag) {
        if (key in prefixes) {
            for (value in icons.tag[key]) {
                if (value in prefixes[key]) {
                    available_tags[prefixes[key][value]] = [key,value];
                }
            }
        }
    }
    return available_tags;
}

function add_presets() {
    /* add presets options to select box in the interface div */
    available_tags = get_available_tags();
    for (preset in available_tags) {
        $("#presets").append('<option>'+preset+'</option>');
    }
    $("#presets").change(function() {
            preset = $("#presets").val();
            if (preset != '') {
                kvarr = get_available_tags()[preset]; // [key,value]
                $("#query").val(kvarr.join('='));
            }
        });
}

var lang = 'en'; // user language, default is 'en'


format_times = function(tags) {
    // parse opening_hours and collection_times, html output
    html = '';
    if (tags['opening_hours']) {
        html += '<p>'+_('opening hours')+': '+tags['opening_hours'];
    }
    if (tags['collection_times']) {
        html += '<p>'+_('collection times')+': '+tags['collection_times'];
    }
    return html;
}

format_isil = function(tags) {
            if ((tags['amenity']) && (tags['amenity']=='library') && (tags['ref:isil'])) {
                return '<p>ISIL <a href="http://dispatch.opac.d-nb.de/DB=1.2/SET=3/TTL=1/CMD?ACT=SRCHA&IKT=8529&SRT=LST_os&TRM='+tags['ref:isil']+'">'+tags['ref:isil']+'</a></p>';
            }
            return '';
}

convert_wikipedia_tags = function(tags) {
    if (!tags['wikipedia']) {
        for (tag in tags) {
            if (tag.substring(0,10) == 'wikipedia:') {
                tags['wikipedia'] = tag.substring(10,12) + ':' + tags[tag];
                if (tag.substring(10,12) == lang) break; // prefer Wikipedia article in current language
            }
        }
    }
}

localize_wikipedia = function(tags, type, osm_id, lang) {
    if (tags['wikipedia']) {
        wikipedia = tags['wikipedia'].split(/^(http:\/\/)?([a-z]{2}\.)?(wikipedia.org\/wiki\/)?(.+)/);
        wp_article = wikipedia[4];
        if (wikipedia[2] && wikipedia[2] != '') {
            wp_lang = wikipedia[2].substring(0,2); // language code without point
        }
        else if (wikipedia[4].match(/^[a-z]{2}:.+$/)) {
            wp_lang = wikipedia[4].substring(0,2);
            wp_article = wikipedia[4].substring(3);
        }
        else wp_lang = 'en'; // default to 'en'
        $.getJSON('http://'+wp_lang+'.wikipedia.org/w/api.php?action=query&titles='+escape(wp_article)+'&prop=langlinks&lllimit=max&format=json&redirects&callback=?', (function(type,osm_id,wp_lang,wp_article) { return function(json) {
            article = wp_article;

            // try to find article in language defined by lang variable, otherwise keep original language
            for (pageid in json.query.pages) {
                if (json.query.pages[pageid].langlinks) {
                    for (llid in json.query.pages[pageid].langlinks) {
                        if (json.query.pages[pageid].langlinks[llid].lang == lang)
                        {
                            wp_lang = lang;
                            article = json.query.pages[pageid].langlinks[llid]['*'];
                        }
                    }
                }
            }
            $('#'+type+osm_id+' .wikipedia').append('Wikipedia: <a href="http://'+wp_lang+'.wikipedia.org/wiki/'+article+'">'+article.replace("_"," ")+'</a>');
            if (typeof(map) == "object" && map.CLASS_NAME == "OpenLayers.Map" && typeof(popup) == "object" && popup.CLASS_NAME == "OpenLayers.Popup.FramedCloud") {
                popup.contentHTML = $('#'+type+osm_id+' .wikipedia').parent().html();
                map.removePopup(popup);
                map.addPopup(popup);
            }
            }})(type,osm_id,wp_lang,wp_article)
                );
    }
}


format_contact = function(tags) {
    // using this microformat: http://microformats.org/wiki/hcard
    html = '<table class="contact">';

    // extract contact information from tags
    if (tags['phone']) { // primary tag, other tags might be dropped in future
        phone = tags['phone'];
    } else if (tags['contact:phone']) {
        phone = tags['contact:phone'];
    } else if (tags['addr:phone']) {
        phone = tags['addr:phone'];
    } else {
        phone = '';
    }

    if (tags['fax']) { // primary tag, other tags might be dropped in future
        fax = tags['fax'];
    } else if (tags['contact:fax']) {
        fax = tags['contact:fax'];
    } else if (tags['addr:fax']) {
        fax = tags['addr:fax'];
    } else {
        fax = '';
    }

    if (tags['email']) { // primary tag, other tags might be dropped in future
        email = tags['email'];
    } else if (tags['contact:email']) {
        email = tags['contact:email'];
    } else if (tags['addr:email']) {
        email = tags['addr:email'];
    } else {
        email = '';
    }

    if (tags['website']) { // primary tag, other tags might be dropped in future
        website = tags['website'];
    } else if (tags['url']) {
        website = tags['url'];
    } else if (tags['contact:website']) {
        website = tags['contact:website'];
    } else if (tags['url:official']) {
        website = tags['url:official'];
    } else {
        website = '';
    }

    // add existing tags to table
    if (phone != '') {
        if (phone.replace(/[ -]/g,'').match(/^\+[0-9]+$/)) { // phone is in the format "+123456789" with additional whitespace or dashes
            phone = '<a href="callto:'+phone.replace(/[ -]/g,'')+'">'+phone.replace(/[ ]/g,'-')+'</a>'; // add callto link, replace whitespace by dashes in visible number
        }
        html += '<tr><td>'+_('phone')+'</td><td class="tel">'+phone+'</td></tr>';
    }
    if (fax != '') {
        html += '<tr><td><span class="type">'+_('fax')+'</span></td><td class="tel">'+fax+'</td></tr>';
    }
    if (email != '') {
        html += '<tr><td>'+_('email')+'</td><td class="email"><a href="mailto:'+email+'">'+email+'</a></td></tr>';
    }
    if (website != '') {
        if (!website.match(/^http(s)?:\/\/.+/)) {
            website = 'http://'+website;
        }
        html += '<tr><td>'+_('website')+'</td><td class="url"><a href="'+website+'">'+website+'</a></td></tr>';
    }


    html += '</table>';

    return html;
}

format_address = function(tags) {
    // supporting http://microformats.org/wiki/adr
    html = '<div class="adr">';
    if (tags['addr:street']) {
        html += '<div class="street-address">'+tags['addr:street'];
        if (tags['addr:housenumber']) html += ' ' + tags['addr:housenumber'];
        html += '</div>';
    }
    else if (tags['addr:housenumber']) html += '<div class="street-address">' + tags['addr:housenumber'] + '</div>';

    if (tags['addr:city']) {
        html += '<span class="locality">'+tags['addr:city']+'</span>';
        if (tags['addr:postcode']) html += ', ';
    }
    if (tags['addr:postcode']) {
        html += '<span class="postal-code">'+tags['addr:postcode']+'</span>';
    }
    if (tags['addr:country']) {
        html += '<div class="country-name">'+tags['addr:country']+'</div>';
    }
    html += '</div>';
    return html;
}
