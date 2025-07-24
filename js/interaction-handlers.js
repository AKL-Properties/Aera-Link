/**
 * Enables panning with the middle mouse button.
 * @param {L.Map} map - Leaflet map instance
 */
function initializeMiddleMousePanning(map) {
  // Minimal stub: logs usage, does not implement actual panning
  console.warn('initializeMiddleMousePanning: not implemented yet', map);
}
window.initializeMiddleMousePanning = initializeMiddleMousePanning;
// js/interaction-handlers.js
function bindPopupHandlers(map) {
  // --- Extracted popup logic from all modules ---

  // From selection-tools.js
  function safeBindPopup(layer, popupContent, options) {
    if (!window.popupsDisabled) {
      layer.bindPopup(popupContent, options);
    } else {
      if (!layer._pendingPopup) {
        layer._pendingPopup = { content: popupContent, options: options };
      }
    }
  }

  function disablePopupOnLayer(layer) {
    if (layer && typeof layer.getPopup === 'function') {
      const existingPopup = layer.getPopup();
      if (existingPopup) {
        layer._originalPopup = existingPopup;
        layer.unbindPopup();
      }
    }
  }

  function enablePopupOnLayer(layer) {
    if (layer && layer._originalPopup && typeof layer.bindPopup === 'function') {
      layer.bindPopup(layer._originalPopup);
      delete layer._originalPopup;
    }
    if (layer && layer._pendingPopup && typeof layer.bindPopup === 'function') {
      layer.bindPopup(layer._pendingPopup.content, layer._pendingPopup.options);
      delete layer._pendingPopup;
    }
    if (layer && layer.eachLayer && typeof layer.eachLayer === 'function') {
      layer.eachLayer((subLayer) => {
        enablePopupOnLayer(subLayer);
      });
    }
  }

  window.safeBindPopup = safeBindPopup;

  // From layer-manager.js
  // Example usage:
  // safeBindPopup(layer, popupContent);
  // layer.openPopup(e.latlng);

  // From filter-system.js
  // layer.bindPopup(popupContent, { ... });
  // layer.openPopup(e.latlng);
  // safeBindPopup(layer, popupContent);

  // From symbology-editor.js
  // safeBindPopup(layer, popupContent, { ... });
  // layer.openPopup(e.latlng);

  // From basemap-manager.js
  // map.on('click', function() { ... });

  // Centralize all popup event bindings here as needed
}
