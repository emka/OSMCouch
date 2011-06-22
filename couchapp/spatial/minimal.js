/**
 * A simple spatial view that emits only the geometry without further values.   
 */
function(doc){
	if(doc.geometry){
		emit(doc.geometry, null);
	}
}
