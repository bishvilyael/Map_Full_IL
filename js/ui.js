searchToggle.addEventListener('click', () => { const willOpen = !searchPanel.classList.contains('open'); closeAllPanels(); if (willOpen) { searchPanel.classList.add('open'); searchInput.focus(); } });
layersToggle.addEventListener('click', () => { const willOpen = !layersPanel.classList.contains('open'); closeAllPanels(); if (willOpen) layersPanel.classList.add('open'); });
statusToggle.addEventListener('click', () => { const willOpen = !statusPanel.classList.contains('open'); closeAllPanels(); if (willOpen) statusPanel.classList.add('open'); });
searchClose.addEventListener('click', () => searchPanel.classList.remove('open'));
searchMinimize.addEventListener('click', () => searchPanel.classList.remove('open'));
layersClose.addEventListener('click', () => layersPanel.classList.remove('open'));
statusClose.addEventListener('click', () => statusPanel.classList.remove('open'));

searchInput.addEventListener('input', () => {
  if (getActiveSearchMode() === 'points') doSearch();
});
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    doSearch();
  }
});
searchActionBtn.addEventListener('click', doSearch);
modePoints.addEventListener('change', updateSearchModeUi);
modeArea.addEventListener('change', updateSearchModeUi);
exactSearch.addEventListener('change', doSearch);
updateSearchModeUi();

(function makeSearchPanelDraggable() {
  let isDragging = false, startX = 0, startY = 0, startRight = 0, startTop = 0;
  function getRightPx(el) { return parseFloat(window.getComputedStyle(el).right) || 0; }
  function getTopPx(el) { return parseFloat(window.getComputedStyle(el).top) || 0; }
  function onPointerMove(e) {
    if (!isDragging || window.innerWidth <= 768) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    searchPanel.style.right = `${Math.max(0, startRight - dx)}px`; searchPanel.style.top = `${Math.max(0, startTop + dy)}px`;
  }
  function onPointerUp() { isDragging = false; document.removeEventListener('pointermove', onPointerMove); document.removeEventListener('pointerup', onPointerUp); }
  searchHeader.addEventListener('pointerdown', (event) => {
    if (window.innerWidth <= 768) return;
    isDragging = true; startX = event.clientX; startY = event.clientY; startRight = getRightPx(searchPanel); startTop = getTopPx(searchPanel);
    document.addEventListener('pointermove', onPointerMove); document.addEventListener('pointerup', onPointerUp);
  });
})();

map.on('click', () => { if (window.innerWidth <= 768) closeAllPanels(); });
