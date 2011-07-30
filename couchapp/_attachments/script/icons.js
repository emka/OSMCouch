var icons = {
    "tag": {
        "amenity": {
            "restaurant": "restaurant.png",
            "fast_food": "fastfood.png",
            "cafe": "cafe.png",
            "pub": "pub.png",
            "bar": "bar.png",
            "fuel": "fuel_station.png",
            "bank": "bank.png",
            "atm": "money_atm2.png",
            "post_office": "post_office.png",
            "post_box": "post_box.png",
            "telephone": "telephone.png",
            "museum": "museum.png",
            "library": "library.png",
            "fire_station": "firebrigade.png",
            "police": "police.png",
            "ambulance": "default.png",
            "doctor": "doctor.png",
            "hospital": "hospital.png",
            "pharmacy": "pharmacy.png",
            "emergency_access_point": "default.png",
            "emergency_phone": "default.png"
        }, "shop": {
            "bakery": "bakery.png",
            "butcher": "butcher_color.png"
        }, "tourism": {
            "hotel": "hotel2.png"
        }, "vending": {
            "excrement_bags": "Amenity_vending_machine_excrement.png"
        }
    }, "key": {
        "wikipedia": "wikipedia.png",
        "website": "website.png"
    }
};

getIconByTags = function(tags) {
  for (var key in icons.tag) {
    for (var val in icons.tag[key]) {
      if (tags[key] && tags[key] === val) {
        return icons.tag[key][val];
      }
    }
  }
  for (var key in icons.key) {
    if (tags[key]) {
      return icons.key[key];
    }
  }
  return null;
};
