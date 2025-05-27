const SPY_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1d1d1d' }]
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8bc34a' }]
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#000000' }]
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#3a3a3a' }]
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#2c2c2c' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#000000' }]
  }
];

export default SPY_MAP_STYLE;
