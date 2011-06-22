/**
 * A simple spatial view that emits the geometry and document id.
 */
function(doc){
	if(doc.geometry){
		emit(doc.geometry, doc._id);
	}
}
