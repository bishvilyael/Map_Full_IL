const map = L.map('map', {
  preferCanvas: true,
  maxZoom: 22
}).setView([31.5, 34.8], 7);

L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
    maxNativeZoom: 19
  }
).addTo(map);

const overlays = {};
const layerRegistry = {};
const allBounds = [];
const searchableItems = [];

let totalMarkers = 0;
let loadedLayers = 0;