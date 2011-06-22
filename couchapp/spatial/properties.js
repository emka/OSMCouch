/**
 * A simple spatial view that emits GeoJSON.   
 */
function(doc){
	if(doc.geometry){
		emit(doc.geometry, doc.properties);
	}
}
