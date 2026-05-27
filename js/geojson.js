function buildLayerList() {
  layersListEl.innerHTML = '';
  Object.values(layerRegistry).forEach(layerInfo => {
    const block = document.createElement('div'); block.className = 'layer-block';
    block.innerHTML = `<div class="layer-row"><div class="layer-title">${escapeHtml(layerInfo.label)} (${layerInfo.items.length})</div><div class="layer-tools"><button data-action="toggle-layer">${map.hasLayer(layerInfo.layer) ? 'הסתר' : 'הצג'}</button><button data-action="toggle-items">יעלים</button></div></div><div class="layer-items"></div>`;
    const itemsDiv = block.querySelector('.layer-items');
    layerInfo.items.forEach(item => {
      const row = document.createElement('div'); row.className = 'layer-item'; row.textContent = item.name || 'ללא שם';
      row.addEventListener('click', () => { ensureLayerVisible(layerInfo.label); map.setView([item.lat, item.lon], DEFAULT_ZOOM_ON_SEARCH); item.marker.openPopup(); });
      itemsDiv.appendChild(row);
    });
    block.querySelector('[data-action="toggle-layer"]').addEventListener('click', (e) => {
      if (map.hasLayer(layerInfo.layer)) { map.removeLayer(layerInfo.layer); e.target.textContent = 'הצג'; }
      else { map.addLayer(layerInfo.layer); e.target.textContent = 'הסתר'; }
    });
    block.querySelector('[data-action="toggle-items"]').addEventListener('click', () => itemsDiv.classList.toggle('open'));
    layersListEl.appendChild(block);
  });
}

function waitForBrowser(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getOrCreateLayerInfo(layerLabel, visible) {
  if (layerRegistry[layerLabel]) {
    return layerRegistry[layerLabel];
  }

  const layerInfo = {
    layer: L.layerGroup(),
    count: 0,
    label: layerLabel,
    items: [],
    israelCount: 0,
    restCount: 0,
    israelLoaded: false,
    restLoaded: false
  };

  overlays[layerLabel] = layerInfo.layer;
  layerRegistry[layerLabel] = layerInfo;

  if (visible) {
    layerInfo.layer.addTo(map);
  }

  return layerInfo;
}

async function fetchGeoJson(filePath) {
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Failed to load ${filePath} (HTTP ${response.status})`);

  const data = await response.json();
  if (!data || !Array.isArray(data.features)) throw new Error(`Invalid GeoJSON in ${filePath}`);

  return data;
}

function addFeatureToLayer(feature, layerInfo) {
  const latlng = getFeatureLatLng(feature);
  if (!latlng) return false;

  const props = feature.properties || {};
  const name = getFeatureName(props);
  const rawDescriptionHtml = getFeatureDescription(props);

  const marker = L.marker(latlng, { icon: createMarkerIcon(name) });

  // הפופאפ נבנה רק בזמן פתיחה ראשונה.
  // כך לא מייצרים מראש אלפי HTML של פופאפים ותמונות.
  marker.on('click', function () {
    if (!marker._popupWasBuilt) {
      const descriptionHtml = normalizeDescriptionHtml(rawDescriptionHtml);
      const popupHtml = buildStandardPopupHtml(name, descriptionHtml);
      marker.bindPopup(popupHtml, {
        maxWidth: 340,
        minWidth: 220
      });
      marker._popupWasBuilt = true;
    }
    marker.openPopup();
  });

  layerInfo.layer.addLayer(marker);
  allBounds.push([latlng.lat, latlng.lng]);

  const descriptionText = stripHtml(rawDescriptionHtml);
  const searchText = `${name} ${descriptionText} ${layerInfo.label}`;
  const itemObj = {
    name,
    layerLabel: layerInfo.label,
    lat: latlng.lat,
    lon: latlng.lng,
    marker,
    descriptionText,
    searchText,
    searchTextLower: searchText.toLowerCase()
  };

  searchableItems.push(itemObj);
  layerInfo.items.push(itemObj);

  layerInfo.count++;
  totalMarkers++;

  return true;
}

async function loadGeoJsonPart(filePath, layerLabel, visible, partName) {
  const layerInfo = getOrCreateLayerInfo(layerLabel, visible);
  const data = await fetchGeoJson(filePath);

  let addedCount = 0;
  data.features.forEach((feature) => {
    if (addFeatureToLayer(feature, layerInfo)) {
      addedCount++;
    }
  });

  if (partName === 'israel') {
    layerInfo.israelCount += addedCount;
    layerInfo.israelLoaded = true;
  } else if (partName === 'rest') {
    layerInfo.restCount += addedCount;
    layerInfo.restLoaded = true;
  }

  return { layerInfo, addedCount };
}

function updateLayerListCountsOnly() {
  // כרגע פשוט בונים מחדש.
  // זה שומר על פשטות ומבטיח שהמספרים ברשימת היעלים משקפים גם את rest.
  buildLayerList();
}

function buildStatusText(isBackgroundDone, statusLines) {
  const title = isBackgroundDone
    ? 'טעינת כל הנקודות הושלמה'
    : 'ישראל נטענה. שאר הנקודות נטענות ברקע...';

  return `${title}
נטענו ${loadedLayers} שכבות
סה"כ ${totalMarkers} נקודות

${statusLines.join('\n')}`;
}

async function loadIsraelFirst() {
  const results = await Promise.allSettled(
    GEOJSON_FILES.map(item => loadGeoJsonPart(item.israelFile, item.label, item.visible, 'israel'))
  );

  loadedLayers = 0;
  const statusLines = [];

  results.forEach((result, index) => {
    const item = GEOJSON_FILES[index];

    if (result.status === 'fulfilled') {
      const layerInfo = result.value.layerInfo;
      loadedLayers++;
      statusLines.push(`${item.label}: ישראל ${layerInfo.israelCount} נקודות`);
    } else {
      statusLines.push(`${item.label}: שגיאה בטעינת ישראל`);
      console.error(`Israel layer load failed: ${item.israelFile}`, result.reason);
    }
  });

  buildLayerList();
  fitIsraelView();
  setStatus(buildStatusText(false, statusLines));

  return statusLines;
}

async function loadRestInBackground(statusLines) {
  for (const item of GEOJSON_FILES) {
    try {
      const result = await loadGeoJsonPart(item.restFile, item.label, item.visible, 'rest');
      const layerInfo = result.layerInfo;

      const lineIndex = statusLines.findIndex(line => line.startsWith(`${item.label}:`));
      const newLine = `${item.label}: ישראל ${layerInfo.israelCount}, שאר העולם ${layerInfo.restCount}, סה"כ ${layerInfo.count}`;
      if (lineIndex >= 0) statusLines[lineIndex] = newLine;
      else statusLines.push(newLine);

      updateLayerListCountsOnly();
      setStatus(buildStatusText(false, statusLines));
    } catch (err) {
      statusLines.push(`${item.label}: שגיאה בטעינת שאר העולם`);
      console.error(`Rest layer load failed: ${item.restFile}`, err);
      setStatus(buildStatusText(false, statusLines));
    }

    await waitForBrowser(BACKGROUND_REST_LOAD_DELAY_MS);
  }

  setStatus(buildStatusText(true, statusLines));
}

async function initMap() {
  try {
    const statusLines = await loadIsraelFirst();

    // לא מחכים ל-rest. המפה כבר מוצגת עם נקודות ישראל.
    setTimeout(() => {
      loadRestInBackground(statusLines).catch(err => {
        console.error(err);
        setStatus('שגיאה בטעינת הנקודות ברקע: ' + err.message);
      });
    }, 0);
  } catch (err) {
    console.error(err);
    setStatus('שגיאה כללית בטעינת השכבות');
    alert('שגיאה בטעינת השכבות: ' + err.message);
  }
}
