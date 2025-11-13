// DiscoMapStyle.js
// Dark, moody, slightly sickly teal/orange vibe – Disco-adjacent.
const DISCO_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [
      { color: '#151821' } // base land
    ]
  },
  {
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#f1e9dc' } // off-white labels
    ]
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#0a0c12' } // dark stroke for contrast
    ]
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [
      { color: '#363d4d' }
    ]
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#ffb15e' } // city names in warm amber
    ]
  },
  {
    featureType: 'poi',
    stylers: [
      { visibility: 'off' } // keep clutter low
    ]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [
      { visibility: 'on' },
      { color: '#1f3326' } // dark green parks if they show
    ]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [
      { color: '#252833' }, // muted roads
      { lightness: -10 }
    ]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [
      { color: '#403433' }, // slightly warmer highways
      { lightness: -20 }
    ]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#9da6b8' }
    ]
  },
  {
    featureType: 'transit',
    stylers: [
      { visibility: 'off' }
    ]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [
      { color: '#062326' } // deep teal water
    ]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#66f0c6' } // teal-ish water labels
    ]
  }
];

export default DISCO_MAP_STYLE;

