function getActiveSearchMode() {
  return modeArea.checked ? 'area' : 'points';
}

function clearSearchUi() {
  searchInput.value = '';
  searchResultsEl.innerHTML = '';
}

function updateSearchModeUi() {
  const isArea = getActiveSearchMode() === 'area';
  clearSearchUi();
  exactSearchLabel.style.display = isArea ? 'none' : 'block';
  searchInput.placeholder = isArea ? 'הקלד אזור, מדינה, מחוז או עיר...' : 'חיפוש לפי שם, Badge, מזהה, תאריך...';
}

function zoomToBounds(bounds) {
  if (!bounds || bounds.length !== 2) return false;
  map.fitBounds(bounds, { padding: [20, 20] });
  return true;
}

function getPredefinedAreaBounds(query) {
  const key = String(query || '').trim().toLowerCase();
  return PREDEFINED_AREA_BOUNDS[key] || null;
}

function normalizeAreaName(item) {
  const parts = [item.display_name, item.name].filter(Boolean);
  return parts[0] || 'ללא שם';
}

function parseBoundingBox(item) {
  if (!item || !item.boundingbox || item.boundingbox.length < 4) return null;
  const south = parseFloat(item.boundingbox[0]);
  const north = parseFloat(item.boundingbox[1]);
  const west = parseFloat(item.boundingbox[2]);
  const east = parseFloat(item.boundingbox[3]);
  if ([south, north, west, east].some(v => Number.isNaN(v))) return null;
  return [[south, west], [north, east]];
}

function renderAreaResults(items) {
  if (!items.length) {
    searchResultsEl.innerHTML = '<div class="search-result-line">האזור לא נמצא</div>';
    return;
  }

  if (items.length === 1) {
    const item = items[0];
    const bbox = item._bounds || parseBoundingBox(item);

    if (zoomToBounds(bbox)) {
      searchResultsEl.innerHTML = `<div class="search-result-line">${escapeHtml(normalizeAreaName(item))}</div>`;
    } else {
      searchResultsEl.innerHTML = '<div class="search-result-line">לא ניתן לבצע זום לאזור זה</div>';
    }
    return;
  }

  searchResultsEl.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'search-result-item';
    const bbox = item._bounds || parseBoundingBox(item);
    row.innerHTML = `<div class="search-result-line">${escapeHtml(normalizeAreaName(item))}</div>`;
    row.addEventListener('click', () => {
      if (zoomToBounds(bbox)) {
        searchPanel.classList.remove('open');
      } else {
        searchResultsEl.innerHTML = '<div class="search-result-line">לא ניתן לבצע זום לאזור זה</div>';
      }
    });
    searchResultsEl.appendChild(row);
  });
}

async function searchExternalArea(query) {
  const predefined = getPredefinedAreaBounds(query);
  if (predefined) {
    return [{ display_name: query.trim(), _bounds: predefined }];
  }
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'he,en');
  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error(`Area search failed: HTTP ${response.status}`);
  const items = await response.json();
  return Array.isArray(items) ? items : [];
}

async function doAreaSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResultsEl.innerHTML = '';
    return;
  }
  searchResultsEl.innerHTML = '<div class="search-result-line">מחפש אזור...</div>';
  try {
    const items = await searchExternalArea(query);
    renderAreaResults(items);
  } catch (err) {
    console.error(err);
    searchResultsEl.innerHTML = '<div class="search-result-line">שגיאה בחיפוש אזור</div>';
  }
}

function renderSearchResults(items) {
  if (!items.length) { searchResultsEl.innerHTML = '<div class="search-result-line">לא נמצאו תוצאות</div>'; return; }
  searchResultsEl.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div'); row.className = 'search-result-item';
    row.innerHTML = extractSearchLines(item.name, item.descriptionText).map(line => `<div class="search-result-line">${escapeHtml(line)}</div>`).join('');
    row.addEventListener('click', () => { ensureLayerVisible(item.layerLabel); map.setView([item.lat, item.lon], DEFAULT_ZOOM_ON_SEARCH); item.marker.openPopup(); });
    searchResultsEl.appendChild(row);
  });
}

function zoomToSearchResults(items) {
  if (!items || !items.length) return;

  if (items.length === 1) {
    const item = items[0];
    ensureLayerVisible(item.layerLabel);
    map.setView([item.lat, item.lon], 11);
    item.marker.openPopup();
    return;
  }

  const bounds = L.latLngBounds(items.map(item => [item.lat, item.lon]));
  const isMobile = window.innerWidth <= 768;
  const isPortrait = window.innerHeight > window.innerWidth;

  let padding;
  if (!isMobile) padding = [10, 10];
  else if (isPortrait) padding = [10, 20];
  else padding = [20, 50];

  map.fitBounds(bounds, {
    paddingTopLeft: padding,
    paddingBottomRight: padding,
    maxZoom: 6
  });

  if (map.getZoom() < 3) {
    map.setZoom(3);
  }
}

function escapeRegExp(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function doSearch() {
  if (getActiveSearchMode() === 'area') {
    await doAreaSearch();
    return;
  }

  const qLower = searchInput.value.trim().toLowerCase();
  if (!qLower) {
    searchResultsEl.innerHTML = '';
    return;
  }

  let results;
  if (exactSearch.checked) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(qLower)}([^A-Za-z0-9_]|$)`, 'i');
    results = searchableItems.filter(item => pattern.test(item.searchTextLower));
  } else {
    results = searchableItems.filter(item => item.searchTextLower.includes(qLower));
  }

  const limited = results.slice(0, MAX_SEARCH_RESULTS);
  renderSearchResults(limited);
}
