/**
 * Documents with invalid Polygon geometry
 * 
 */
function(doc) {
  if (doc.geometry && doc.geometry.type) {
    if (doc.geometry.type === 'Polygon') {
      if (doc.geometry.coordinates) {
        /* Check for valid MultiPolygon */
        /* not checking:
         * - Are inner rings inside outer ring?
         * - Are points of LinearRing different points?
         * - Is the Polygon self-intersecting?
         */
        var polygon = doc.geometry.coordinates;
        var valid_polygon = false;
        if (polygon.constructor.name === "Array") {
            valid_polygon = true;
            for (var j=0, num_rings=polygon.length; j<num_rings; ++j) {
                var ring = polygon[j];
                var valid_ring = false;
                if (ring.constructor.name === "Array") {
                    var num_points=ring.length;
                    // ring must have at least 3 different points
                    if (num_points > 3) { 
                        valid_ring = true;
                        for (var k=0; k<num_points; ++k) {
                            var point = ring[k];
                            var valid_point = false;
                            var num_coords = point.length;
                            if (point.constructor.name === "Array" && num_coords === 2) {
                                valid_point = true;
                                for (var l=0; l<num_coords; ++l) {
                                    valid_point = valid_point && (typeof point[l] === "number");
                                }
                            }
                            valid_ring = valid_ring && valid_point;
                        }
                        // last point must equal first point
                        valid_ring = valid_ring && (ring[0][0] === ring[num_points-1][0] && ring[0][1] === ring[num_points-1][1]);
                    }
                }
                valid_polygon = valid_polygon && valid_ring;
            }
        }
        if (!valid_polygon)
            emit('rev', doc._rev);
      }
    }
  }
}
