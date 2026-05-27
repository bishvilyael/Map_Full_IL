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

async function loadGeoJsonLayer(filePath, layerLabel) {
  const response = await fetch(filePath);
  if (!response.ok) throw new Error(`Failed to load ${filePath} (HTTP ${response.status})`);
  const data = await response.json();
  if (!data || !Array.isArray(data.features)) throw new Error(`Invalid GeoJSON in ${filePath}`);

  const layerGroup = L.layerGroup();
  const layerItems = [];
  let markerCount = 0;

  data.features.forEach((feature) => {
    const latlng = getFeatureLatLng(feature);
    if (!latlng) return;

    const props = feature.properties || {};
    const name = getFeatureName(props);
    const descriptionHtml = normalizeDescriptionHtml(getFeatureDescription(props));
    const descriptionText = stripHtml(descriptionHtml);

    const marker = L.marker(latlng, { icon: createMarkerIcon(name) });
	const popupHtml =
		  buildStandardPopupHtml(name, descriptionHtml);

		marker.bindPopup(popupHtml, {
		  maxWidth: 340,
		  minWidth: 220
	});
	
    layerGroup.addLayer(marker);
    allBounds.push([latlng.lat, latlng.lng]);
    markerCount++;

    const searchText = `${name} ${descriptionText} ${layerLabel}`;
    const itemObj = { name, layerLabel, lat: latlng.lat, lon: latlng.lng, marker, descriptionText, searchText, searchTextLower: searchText.toLowerCase() };
    searchableItems.push(itemObj); layerItems.push(itemObj);
  });

  return { layer: layerGroup, count: markerCount, label: layerLabel, items: layerItems };
}

async function initMap() {
  try {
    const results = await Promise.allSettled(GEOJSON_FILES.map(item => loadGeoJsonLayer(item.file, item.label)));
    let statusLines = [];
    results.forEach((result, index) => {
      const item = GEOJSON_FILES[index];
      if (result.status === 'fulfilled') {
        const layerInfo = result.value; overlays[item.label] = layerInfo.layer; layerRegistry[item.label] = layerInfo;
        if (item.visible) layerInfo.layer.addTo(map); totalMarkers += layerInfo.count; loadedLayers++; statusLines.push(`${item.label}: ${layerInfo.count} נקודות`);
      } else { statusLines.push(`${item.label}: שגיאה`); console.error(`Layer load failed: ${item.file}`, result.reason); }
    });
    buildLayerList(); 
	fitIsraelView();
    setStatus(`נטענו ${loadedLayers} שכבות\nסה"כ ${totalMarkers} נקודות\n\n${statusLines.join('\n')}`);
  } catch (err) {
    console.error(err); setStatus('שגיאה כללית בטעינת השכבות'); alert('שגיאה בטעינת השכבות: ' + err.message);
  }
}

/*
  Local layer-list rendering helpers.
  These functions intentionally override same-name helpers from Map_Shared,
  so this map can use the compact tree-style list without changing existing shared files.
*/

function layerListPlainTextFromHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr|td|span)>/gi, '\n');
  return (temp.textContent || temp.innerText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
}

function normalizeLayerListValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[,:;\-\s]+/, '')
    .replace(/[,:;\-\s]+$/, '')
    .trim();
}

function getPropByNames(props, names) {
  if (!props) return '';
  const keys = Object.keys(props);
  for (const wanted of names) {
    const exact = keys.find(k => k.toLowerCase() === String(wanted).toLowerCase());
    if (exact && props[exact] != null && String(props[exact]).trim() !== '') return props[exact];
  }
  return '';
}

function extractLayerListLabeledValue(text, labels) {
  const source = String(text || '');
  const stopLabels = [
    'שם', 'name',
    'אתר', 'מקום', 'נקודה', 'site', 'place', 'point',
    'תאריך', 'date', 'thedate',
    'id', 'מזהה', 'badge'
  ];

  for (const label of labels) {
    const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const lineRegex = new RegExp(`(^|\\n)\\s*${escaped}\\s*:?\\s*([^\\n|]+)`, 'i');
    const lineMatch = source.match(lineRegex);
    if (lineMatch) {
      let value = lineMatch[2] || '';
      for (const stop of stopLabels) {
        if (stop.toLowerCase() === String(label).toLowerCase()) continue;
        const stopEscaped = String(stop).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        value = value.replace(new RegExp(`\\s+${stopEscaped}\\s*:?[\\s\\S]*$`, 'i'), '');
      }
      return normalizeLayerListValue(value);
    }

    const inlineRegex = new RegExp(`${escaped}\\s*:?\\s*([^|\\n]+)`, 'i');
    const inlineMatch = source.match(inlineRegex);
    if (inlineMatch) {
      let value = inlineMatch[1] || '';
      for (const stop of stopLabels) {
        if (stop.toLowerCase() === String(label).toLowerCase()) continue;
        const stopEscaped = String(stop).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        value = value.replace(new RegExp(`\\s+${stopEscaped}\\s*:?[\\s\\S]*$`, 'i'), '');
      }
      return normalizeLayerListValue(value);
    }
  }

  return '';
}

function formatLayerListDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (!match) return '';

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);

  if (!day || !month || !year) return '';
  if (year >= 2000) year = year % 100;
  if (year >= 1900) year = year % 100;

  return `${day}.${month}.${year}`;
}

function getLayerItemFields(item) {
  const props = item.props || {};
  const text = layerListPlainTextFromHtml(item.rawDescriptionHtml || item.descriptionText || '');

  const rawNumber =
    getPropByNames(props, ['Badge', 'badge', 'Number', 'number', 'מספר', 'יעל']) ||
    item.name ||
    '';

  const number = normalizeLayerListValue(rawNumber).replace(/^#\s*/, '');

  let displayName =
    getPropByNames(props, ['Name', 'name_he', 'שם']) ||
    extractLayerListLabeledValue(text, ['שם', 'Name']);

  let site =
    getPropByNames(props, ['Site', 'site', 'Place', 'place', 'Point', 'point', 'אתר', 'מקום', 'נקודה']) ||
    extractLayerListLabeledValue(text, ['אתר', 'מקום', 'נקודה', 'Point', 'Place', 'Site']);

  let dateValue =
    getPropByNames(props, ['Date', 'date', 'TheDate', 'thedate', 'תאריך']) ||
    extractLayerListLabeledValue(text, ['תאריך', 'Date', 'TheDate']) ||
    text;

  displayName = normalizeLayerListValue(displayName);
  site = normalizeLayerListValue(site);
  const date = formatLayerListDate(dateValue);

  return { number, displayName, site, date };
}

function buildLayerItemsStickyHeader() {
  const header = document.createElement('div');
  header.className = 'layer-items-sticky-header layer-item-grid';
  header.innerHTML = `
    <div>יעל</div>
    <div>שם</div>
    <div>אתר</div>
    <div>תאריך</div>`;
  return header;
}

function buildLayerItemRowElement(item, options = {}) {
  const fields = getLayerItemFields(item);
  const row = document.createElement('div');
  row.className = options.detail ? 'layer-item layer-item-detail layer-item-grid' : 'layer-item layer-item-grid';

  row.innerHTML = `
    <div class="layer-item-number">${escapeHtml(fields.number || '')}</div>
    <div class="layer-item-name">${escapeHtml(fields.displayName || '')}</div>
    <div class="layer-item-site">${escapeHtml(fields.site || '')}</div>
    <div class="layer-item-date">${escapeHtml(fields.date || '')}</div>`;

  return row;
}

function buildLayerGroupSummaryRowElement(group, onToggle) {
  const row = document.createElement('div');
  row.className = 'layer-group-summary-row';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tree-toggle-btn';
  button.textContent = '▶';
  button.title = 'פתח / סגור';

  const number = document.createElement('span');
  number.className = 'layer-group-number';
  number.textContent = group.number || '';

  const name = document.createElement('span');
  name.className = 'layer-group-name';
  name.textContent = group.displayName || '';

  const count = document.createElement('span');
  count.className = 'layer-group-count';
  count.textContent = `(${group.items.length})`;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = onToggle();
    button.textContent = isOpen ? '▼' : '▶';
  });

  row.appendChild(button);
  row.appendChild(number);
  row.appendChild(name);
  row.appendChild(count);

  return row;
}

