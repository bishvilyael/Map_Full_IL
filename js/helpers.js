function setStatus(text) { statusBodyEl.textContent = text; }
function closeAllPanels() { searchPanel.classList.remove('open'); layersPanel.classList.remove('open'); statusPanel.classList.remove('open'); }



function normalizeDescriptionHtml(html) {
  const temp = document.createElement('div'); temp.innerHTML = html || '';
  temp.querySelectorAll('img').forEach((img) => {
    img.setAttribute('src', convertDriveUrl(img.getAttribute('src') || ''));
    img.removeAttribute('loading');
    img.onerror = function () {
      const err = document.createElement('div'); err.className = 'popup-image-error'; err.textContent = 'התמונה לא נטענה';
      this.insertAdjacentElement('afterend', err); this.style.display = 'none';
    };
  });
  temp.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer');
    if (/facebook\.com/i.test(href)) {
      a.textContent = 'פייסבוק';
      const parentText = (a.parentNode?.textContent || '').trim();
      if (/^fb\s*:?\s*$/i.test(parentText.replace('פייסבוק', '').trim())) {
        a.parentNode.innerHTML = ''; a.parentNode.appendChild(a);
      }
    }
  });
  temp.querySelectorAll('*').forEach((el) => {
    const text = (el.textContent || '').trim(); if (/^FB\s*:?\s*$/i.test(text) && el.children.length === 0) el.remove();
  });
  return temp.innerHTML;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';

  // חשוב: textContent רגיל מוחק את ההפרדה של <br>/<div>/<p>,
  // ואז קשה לחלץ שם/אתר/תאריך לרשימת השכבה.
  div.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  div.querySelectorAll('p, div, li, tr').forEach(el => {
    el.insertAdjacentText('beforebegin', '\n');
    el.insertAdjacentText('afterend', '\n');
  });

  return (div.textContent || div.innerText || '')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean)
    .join('\n');
}

function createMarkerIcon(labelText) {
  return L.divIcon({
     className: '', 
     html: `
      <div class="custom-marker"><img src="${MARKER_ICON_URL}" alt="">
      <div class="custom-marker-label">${escapeHtml(labelText || '')}</div>
      </div>`, iconSize: [70, 21], iconAnchor: [11, 11], popupAnchor: [0, -11] });
}

function ensureLayerVisible(layerName) { const layer = overlays[layerName]; if (layer && !map.hasLayer(layer)) layer.addTo(map); }

function extractSearchLines(name, descriptionText) {
  const lines = []; if (name) lines.push(name);
  const parts = descriptionText.split(/\n+/).map(x => x.trim()).filter(Boolean);
  for (const p of parts) {
    if (/^https?:\/\//i.test(p) || /facebook\.com/i.test(p) || /^fb\s*:?\s*$/i.test(p) || /^פייסבוק$/i.test(p)) continue;
    lines.push(p); if (lines.length >= 5) break;
  }
  return lines;
}

