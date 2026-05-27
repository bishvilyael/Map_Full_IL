async function loadMapTitle() {
  try {
    const response = await fetch('map-title.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    document.getElementById('mapTitleText').textContent = data.title || DEFAULT_MAP_TITLE;
  } catch (err) {
    document.getElementById('mapTitleText').textContent = DEFAULT_MAP_TITLE;
    console.warn('Failed to load map-title.json', err);
  }
}
