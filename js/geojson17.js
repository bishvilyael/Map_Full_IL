function buildLayerList() {
  layersListEl.innerHTML = '';

  Object.values(layerRegistry).forEach(layerInfo => {
    const block = document.createElement('div');
    block.className = 'layer-block';

    block.innerHTML = `
      <div class="layer-row">
        <div class="layer-title">${escapeHtml(layerInfo.label)} (${layerInfo.items.length})</div>
        <div class="layer-tools">
          <button data-action="toggle-layer">${map.hasLayer(layerInfo.layer) ? 'הסתר' : 'הצג'}</button>
          <button data-action="toggle-items">יעלים</button>
        </div>
      </div>
      <div class="layer-items" data-built="0"></div>`;

    const itemsDiv = block.querySelector('.layer-items');

    function buildLayerItemsOnDemand() {
      if (itemsDiv.dataset.built === '1') return;

      const fragment = document.createDocumentFragment();

      if (typeof buildLayerItemsStickyHeader === 'function') {
        fragment.appendChild(buildLayerItemsStickyHeader());
      }

      const openItem = (item) => {
        ensureLayerVisible(layerInfo.label);
        map.setView([item.lat, item.lon], DEFAULT_ZOOM_ON_SEARCH);
        item.marker.openPopup();
      };

      const createItemRow = (item, options) => {
        let row;
        if (typeof buildLayerItemRowElement === 'function') {
          row = buildLayerItemRowElement(item, options || {});
        } else {
          row = document.createElement('div');
          row.className = 'layer-item';
          row.textContent = item.name || '';
        }

        row.addEventListener('click', () => openItem(item));
        return row;
      };

      if (typeof getLayerItemFields === 'function' && typeof buildLayerGroupSummaryRowElement === 'function') {
        const groups = new Map();

        layerInfo.items.forEach(item => {
          const fields = getLayerItemFields(item);
          const number = String(fields.number || item.name || '').replace(/^#\s*/, '').trim();
          const key = number || `__empty_${groups.size}`;

          if (!groups.has(key)) {
            groups.set(key, {
              number,
              displayName: fields.displayName || '',
              items: []
            });
          }

          const group = groups.get(key);
          if (!group.displayName && fields.displayName) group.displayName = fields.displayName;
          group.items.push(item);
        });

        groups.forEach(group => {
          if (group.items.length === 1) {
            fragment.appendChild(createItemRow(group.items[0]));
            return;
          }

          const detailsDiv = document.createElement('div');
          detailsDiv.className = 'layer-group-details';

          group.items.forEach(item => {
            detailsDiv.appendChild(createItemRow(item, { detail: true }));
          });

          const summaryRow = buildLayerGroupSummaryRowElement(group, () => {
            detailsDiv.classList.toggle('open');
            return detailsDiv.classList.contains('open');
          });

          fragment.appendChild(summaryRow);
          fragment.appendChild(detailsDiv);
        });
      } else {
        layerInfo.items.forEach(item => {
          fragment.appendChild(createItemRow(item));
        });
      }

      itemsDiv.appendChild(fragment);
      itemsDiv.dataset.built = '1';
    }

    block.querySelector('[data-action="toggle-layer"]').addEventListener('click', (e) => {
      if (map.hasLayer(layerInfo.layer)) {
        map.removeLayer(layerInfo.layer);
        e.target.textContent = 'הצג';
      } else {
        map.addLayer(layerInfo.layer);
        e.target.textContent = 'הסתר';
      }
    });

    const layerItemsToggleBtn = block.querySelector('[data-action="toggle-items"]');

    layerItemsToggleBtn.addEventListener('click', () => {
      buildLayerItemsOnDemand();
      itemsDiv.classList.toggle('open');
    });

    if (typeof initLayerItemsTriangleButton === 'function') {
      initLayerItemsTriangleButton(layerItemsToggleBtn, itemsDiv);
    }

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

  // פופאפ עצל: ה-HTML הכבד נבנה רק בפעם הראשונה שהפופאפ באמת נפתח.
  marker.bindPopup(function () {
    if (!marker._cachedPopupHtml) {
      const descriptionHtml = normalizeDescriptionHtml(rawDescriptionHtml);
      marker._cachedPopupHtml = buildStandardPopupHtml(name, descriptionHtml);
    }
    return marker._cachedPopupHtml;
  }, {
    maxWidth: 340,
    minWidth: 220
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
    props,
    rawDescriptionHtml,
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

function markLayerListDirty() {
  isLayerListDirty = true;
}

function buildLayerListIfNeeded(force = false) {
  if (!force && isLayerListBuilt && !isLayerListDirty) return;
  buildLayerList();
  isLayerListBuilt = true;
  isLayerListDirty = false;
}

function updateLayerListCountsOnly() {
  markLayerListDirty();

  // לא בונים את רשימת היעלים בזמן טעינת המפה.
  // אם החלונית כבר פתוחה, מעדכנים רק את מבנה השכבות; שורות היעלים עצמן ייבנו בעת פתיחת השכבה.
  if (layersPanel.classList.contains('open')) {
    buildLayerListIfNeeded(true);
  }
}

function buildStatusText(isBackgroundDone, statusLines) {
  const title = isBackgroundDone
    ? 'טעינת כל הנקודות הושלמה'
    : 'הנקודות נטענות ברקע...';

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
      statusLines.push(`${item.label}: ${layerInfo.count} נקודות`);
    } else {
      statusLines.push(`${item.label}: שגיאה בטעינה`);
      console.error(`Israel layer load failed: ${item.israelFile}`, result.reason);
    }
  });

  markLayerListDirty();
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
      const newLine = `${item.label}: ${layerInfo.count} נקודות`;
      if (lineIndex >= 0) statusLines[lineIndex] = newLine;
      else statusLines.push(newLine);

      updateLayerListCountsOnly();
      setStatus(buildStatusText(false, statusLines));
    } catch (err) {
      statusLines.push(`${item.label}: שגיאה בטעינה ברקע`);
      console.error(`Rest layer load failed: ${item.restFile}`, err);
      setStatus(buildStatusText(false, statusLines));
    }

    await waitForBrowser(BACKGROUND_REST_LOAD_DELAY_MS);
  }

  isRestLoadingComplete = true;

  if (typeof setWorldZoomBounds === 'function') {
    setWorldZoomBounds(allBounds);
  }

  if (typeof setWorldZoomButtonEnabled === 'function') {
    setWorldZoomButtonEnabled(true);
  }

  updateLayerListCountsOnly();
  setStatus(buildStatusText(true, statusLines));
}

async function initMap() {
  try {
    if (typeof initLayersPanelGlobalToggle === 'function') {
      initLayersPanelGlobalToggle();
    }

    if (typeof initHeaderWorldZoomButton === 'function') {
      initHeaderWorldZoomButton(map, 'worldZoomBtn');
      setWorldZoomButtonEnabled(false);
    }

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
function createExpandToggle(isOpen = false) {
  const btn = document.createElement('button');
  btn.className = 'tree-toggle-btn';
  btn.textContent = isOpen ? '▼' : '▶';

  btn.addEventListener('click', () => {
    const open = btn.textContent === '▼';
    btn.textContent = open ? '▶' : '▼';
  });

  return btn;
}
