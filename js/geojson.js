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
