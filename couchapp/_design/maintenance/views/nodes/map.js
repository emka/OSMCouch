/* emit way id as key, way id and way node ids as value for ?keys=[]&include_docs=true */
function(doc) {
  if (doc.nodes) {
    emit(doc._id, null);
    for (var i in doc.nodes) {
      emit(doc._id, {_id:'node'+doc.nodes[i]});
    }
  }
}
