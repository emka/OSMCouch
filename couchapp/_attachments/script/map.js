var map;
var selectCtrl = null;
var permalinkCtrl = null;
var loading = '<div class="center"><img src="../images/throbber.gif" alt="loading..."></div>';
var popup = null;
var parser = null;

function initializeMap() {
    smerc = new OpenLayers.Projection("EPSG:900913");
    wgs84 = new OpenLayers.Projection("EPSG:4326");
    OpenLayers.ImgPath = "http://mitja.kleider.name/osm/openlayers/img/";
    permalinkCtrl = new OpenLayers.Control.Permalink();
    map = new OpenLayers.Map("map",{
        allOverlays: false,
        controls: [
            new OpenLayers.Control.LayerSwitcher(),
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.PanZoom(),
            permalinkCtrl
        ],
        projection: smerc,
        displayProjection: wgs84,
        maxExtent: new OpenLayers.Bounds(-180, -90, 180, 90).transform(wgs84,smerc),
        numZoomLevels: 19,
    });
    map.addLayers([
        new OpenLayers.Layer.OSM("Mapnik",abczxy("tile.openstreetmap.org")),
        new OpenLayers.Layer.OSM("CycleMap",abczxy("tile.opencyclemap.org/cycle")),
        new OpenLayers.Layer.OSM("Osmarender",abczxy("tah.openstreetmap.org/Tiles/tile"))/*,
        new OpenLayers.Layer.OSM("MapQuest",[
                "http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.png",
                "http://otile2.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.png",
                "http://otile3.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.png",
                "http://otile4.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.png"
            ])*/
    ]);

    if (!map.getCenter()) map.setCenter(new OpenLayers.LonLat(9.93361629, 51.53558391).transform(map.displayProjection, map.projection), 14);

    map.events.register("zoomend", map, function() { if (popup) {map.removePopup(popup); popup.destroy(); popup=null;} });
}

function abczxy(urlpart) {
    return ['http://a.' + urlpart + '/${z}/${x}/${y}.png',
                    'http://b.' + urlpart + '/${z}/${x}/${y}.png',
                    'http://c.' + urlpart + '/${z}/${x}/${y}.png'];
}

function addIconToFeature(feature) {
    var icon = getIconByTags(feature.attributes);

    if (feature.geometry.CLASS_NAME === "OpenLayers.Geometry.Polygon") {
        feature.geometry = feature.geometry.getCentroid(); // Replace geometry by Centroid.
        // PointOnSurface would be nice, but Centroid is probably good enough for POIs.
    }

    if (icon && feature.geometry.CLASS_NAME === "OpenLayers.Geometry.Point") {
         feature.style = { externalGraphic: 'http://poitools.openstreetmap.de/map/2011/images/icons/'+icon,
                           graphicWidth: 20,
                           graphicHeight: 20,
                           graphicYOffset: -10,
                           graphicXOffset: -10,
                           opacity: 0.6
                         };
    }
}

function createPOILayer(name, query) {
    var index = null; // spatial index
    var filter = ''; // tag filter

    var params = query.split('&');
    var key = params[0].split('=')[0];
    var value = params[0].split('=')[1];

    if (key === 'amenity') {
        if (value === 'restaurant') {
            index = 'restaurants';
        }
        else if (value === 'pub') {
            index = 'pubs';
        }
        else {
            index = 'amenities';
            filter = '?amenity='+value;
        }
    }
    else if (key === 'tourism') {
        index = 'tourism';
        filter = '?tourism='+value;
    }
    else if (key === 'shop') {
        index = 'shops';
        filter = '?shop='+value;
    }
    else {
        alert("Sorry, this key is not supported.");
        return null;
    }

    if (params.length > 1) {
        params.splice(0,1);
        if (filter === '') {
            filter = '?' + params.join('&');
        }
        else {
            filter = filter + '&' + params.join('&');
        }
    }

    layer = new OpenLayers.Layer.Vector(name, {
        projection: new OpenLayers.Projection("EPSG:4326"),
//      maxResolution: 10.0,
        visibility: true,
        strategies: [new OpenLayers.Strategy.BBOX({ratio: 2.5})],
        protocol: new OpenLayers.Protocol.HTTP({
            url: 'geojson/'+index+filter,
            format: new OpenLayers.Format.GeoJSON()
        }),
        preFeatureInsert: addIconToFeature
    });
    addSelectEvents(layer);
    return layer;
}

function addSelectEvents(layer) {
    layer.events.on({
        featureselected: function(e) {
            selectCtrl.unselectAll({except: e.feature});
            if (!e.feature.contentHTML) {
                e.feature.contentHTML = loading;
            }
            if (!popup) {
                if (!e.feature.size) {
                        e.feature.size = new OpenLayers.Size(14,14);
                        e.feature.offset = new OpenLayers.Pixel(-7,-7);
                }
                centroid = e.feature.geometry.getCentroid();
                popup = new OpenLayers.Popup.FramedCloud("popup", new OpenLayers.LonLat(centroid.x,centroid.y), null, e.feature.contentHTML, e.feature, true, function(){selectCtrl.unselect(e.feature)});
            }
            map.addPopup(popup);
            if (popup.contentHTML == loading) {
                e.feature.contentHTML = getPopupContent(e.feature);
                popup.setContentHTML(e.feature.contentHTML);
                map.removePopup(popup);
                map.addPopup(popup);
            }
        },
        featureunselected: function(e) {
            if (popup) {
                e.feature.contentHTML = popup.contentHTML;
                map.removePopup(popup);
                popup.destroy();
                popup = null;
            }
        }
    });
}

function getPopupContent(feature) {
    var type = feature.fid.replace(/\d+/,'');
    var osm_id = feature.fid.replace(/[a-z]+/,'');
    var tags = feature.attributes;
    var html = '<div id="'+type+osm_id+'"><div class="head">';
    for (prefix in prefixes) {
            html += prefix_string(tags,prefix);
    }
    if (tags['name']) {
        html += '<strong>'+tags['name']+'</strong>';
    }
    else if (tags['operator']) {
        html += '<strong>'+tags['operator']+'</strong>';
    }
    html += '</div>';
    html += format_address(tags);
    html += format_contact(tags);
    html += format_isil(tags);
    html += format_times(tags);

    convert_wikipedia_tags(tags);
    if (tags['wikipedia']) {
            html += '<p class="wikipedia"></p>';
    }

    html +='<div class="osm"><a href="http://www.openstreetmap.org/browse/'+type+'/'+osm_id+'">Browse on OSM</a> <a href="?'+type+'='+osm_id+'">Permalink</a></div></div>';
    $("#objects").append(html);

    localize_wikipedia(tags, type, osm_id, lang);
    return html;
}


$.urlParam = function(name){
    var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results) {
            return results[1];
    } else return null;
}

$(document).ready(function(){
    if ($.urlParam("query")) $("#query").attr("value",decodeURIComponent($.urlParam("query")));
    if ($.urlParam("lang") && $.urlParam("lang").match(/^[a-z]{2}$/)) lang = $.urlParam("lang");
    else if (navigator.language.match(/^[a-z]{2}$/)) lang = navigator.language;
    else lang = "en";
    $("#presets").append('<option></option>');
    $.getJSON('locales/'+lang+'.json', function(data) {
        if (data.translations) {
            translations = data.translations;
        }
        if (data.prefixes) {
            prefixes = data.prefixes;
        }
        if ($("#presets").children().length == 1) {
            add_presets();
        }
    });
    initializeMap();
    $('#listlink').hide()
    parser = new OpenLayers.Format.JSON();


    $("#submit").click(function(e){
        e.preventDefault();
        query = $("#query").val();

        layers = map.getLayersByName("custom query");
        if (layers.length > 0) map.removeLayer(map.getLayersByName("custom query")[0]);
        overlay = createPOILayer("custom query", query);
        if (overlay) {
            overlay.events.register("loadstart", overlay, function() { $("#loading").show(); });
            overlay.events.register("loadend", overlay, function() { $("#loading").hide(); });
            overlay.events.register("move", overlay, function() { var sep='&';if(this.protocol.url.indexOf('?')==-1) sep='?';$('#listlink').attr('href',this.protocol.url.replace('geojson','list')+sep+'bbox='+this.getExtent().transform(smerc,wgs84).toBBOX()); $('#listlink').show()});
            map.addLayer(overlay);
            selectCtrl = new OpenLayers.Control.SelectFeature(overlay,{toggle: true});
            var highlightCtrl = new OpenLayers.Control.SelectFeature(overlay, {
                                    hover: true,
                                    highlightOnly: true,
                                    renderIntent: "temporary",
                                    eventListeners: {
                                            featurehighlighted: overlay.events.listeners['featureselected'][0].func,
                                            featureunhighlighted: overlay.events.listeners['featureunselected'][0].func
                                    }
                            });
            map.addControl(highlightCtrl);
            map.addControl(selectCtrl);
            highlightCtrl.activate();
            selectCtrl.activate();
            map.setCenter(map.getCenter()); // load overlay without moving the map
            overlay.events.triggerEvent("move"); // for listlink
            if (permalinkCtrl.base.contains('?')) permalinkCtrl.base = permalinkCtrl.base + '&query='+encodeURIComponent(query);
            else permalinkCtrl.base = permalinkCtrl.base + '?query='+encodeURIComponent(query);
            permalinkCtrl.updateLink();
        }
    });
    if ($.urlParam("query")) $("#submit").click();
    else if ($.urlParam("node") || $.urlParam("way") || $.urlParam("relation")) {
        $("#loading").show(); 

        if ($.urlParam("node")) type = "node";
        else if ($.urlParam("way")) type = "way";
        else type = "relation";

        osm_id = $.urlParam(type);

        request = OpenLayers.Request.GET({ url: "object/"+type+osm_id, callback: function(request) {
                overlay = new OpenLayers.Layer.Vector(type+' '+osm_id, {});
                addSelectEvents(overlay);
                map.addLayer(overlay);
                selectCtrl = new OpenLayers.Control.SelectFeature(overlay,{toggle: true});
                map.addControl(selectCtrl);
                selectCtrl.activate();

                parser_geojson = new OpenLayers.Format.GeoJSON();
                feature = parser_geojson.read(request.responseText)[0];
                feature.geometry = feature.geometry.transform(wgs84,smerc);
                feature.fid = type+osm_id;
                data = parser.read(request.responseText);
                feature.attributes = data.properties;
                overlay.addFeatures([feature]);
                map.zoomToExtent(overlay.getDataExtent());
                selectCtrl.select(feature);
                $("#loading").hide(); 
            }
        });
    }
});
