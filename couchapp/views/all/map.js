/**
 * Simple map function mocking _all, including _id as key. Allows usage with lists, etc.
 * 
 */
function(doc) {
  emit(doc._id, doc);
}
