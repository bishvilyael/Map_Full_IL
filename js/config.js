const PAGE_KEY = 'index_geojson';
const DEFAULT_MAP_TITLE = 'מפת יעלים מצטברת - GeoJSON';
const DEFAULT_ZOOM_ON_SEARCH = 15;
const MAX_SEARCH_RESULTS = 50;
const MARKER_ICON_URL = 'icons/marker.png';

// מצב טעינה חדש:
// קודם נטענים קבצי ישראל מכל השכבות.
// לאחר מכן נטענים קבצי rest ברקע לאותן שכבות בדיוק.
// אין כאן טעינה של json/<label>.geojson כדי למנוע כפילות נקודות.
const GEOJSON_FILES = [
  { label: '0', israelFile: 'json/0_israel.geojson', restFile: 'json/0_rest.geojson', visible: true },
  { label: '1-1499', israelFile: 'json/1-1499_israel.geojson', restFile: 'json/1-1499_rest.geojson', visible: true },
  { label: '1500-2999', israelFile: 'json/1500-2999_israel.geojson', restFile: 'json/1500-2999_rest.geojson', visible: true },
  { label: '3000-4499', israelFile: 'json/3000-4499_israel.geojson', restFile: 'json/3000-4499_rest.geojson', visible: true },
  { label: '4500-5999', israelFile: 'json/4500-5999_israel.geojson', restFile: 'json/4500-5999_rest.geojson', visible: true },
  { label: '6000-7499', israelFile: 'json/6000-7499_israel.geojson', restFile: 'json/6000-7499_rest.geojson', visible: true },
  { label: '7500-8999', israelFile: 'json/7500-8999_israel.geojson', restFile: 'json/7500-8999_rest.geojson', visible: true },
  { label: '9000-10499', israelFile: 'json/9000-10499_israel.geojson', restFile: 'json/9000-10499_rest.geojson', visible: true }
];

// השהיה קצרה בין טעינות rest כדי לאפשר לדפדפן לצייר ולהגיב.
const BACKGROUND_REST_LOAD_DELAY_MS = 50;
