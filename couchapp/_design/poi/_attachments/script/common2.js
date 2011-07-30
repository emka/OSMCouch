$.urlParam = function(name){
    /* read value of URL parameter with given name */
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results) {
      return results[1];
    } else return null;
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

