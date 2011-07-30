/* emit way and relation dependencies as key, document id as value */
function(doc) {
  if (doc.nodes) {
    for (var i in doc.nodes) {
      emit('node'+doc.nodes[i],doc._id);
    }
  }
  else if (doc.members) {
    var type='';
    for (var i in doc.members) {
      if (doc.members[i].type === 'w')
        type = 'way';
      else if (doc.members[i].type === 'n')
        type = 'node';
      else if (doc.members[i].type === 'r')
        type = 'relation';
      emit(type+doc.members[i].ref,doc._id);
    }
  }
}
