const PAGE_KEY = 'index_geojson';
const DEFAULT_MAP_TITLE = 'מפת יעלים מצטברת - GeoJSON';
const DEFAULT_ZOOM_ON_SEARCH = 15;
const MAX_SEARCH_RESULTS = 50;
const MARKER_ICON_URL = 'icons/marker.png';

const GEOJSON_FILES = [
  { label: '0', file: 'json/0.geojson', visible: true },
  { label: '1-1499', file: 'json/1-1499.geojson', visible: true },
  { label: '1500-2999', file: 'json/1500-2999.geojson', visible: true },
  { label: '3000-4499', file: 'json/3000-4499.geojson', visible: true },
  { label: '4500-5999', file: 'json/4500-5999.geojson', visible: true },
  { label: '6000-7499', file: 'json/6000-7499.geojson', visible: true },
  { label: '7500-8999', file: 'json/7500-8999.geojson', visible: true },
  { label: '9000-10499', file: 'json/9000-10499.geojson', visible: true }
];
