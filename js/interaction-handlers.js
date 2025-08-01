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

// Global popup state management
let customPopupContainer = null;

function bindPopupHandlers(map) {
  // --- Centralized popup system for feature layers ---

  // Make an element draggable
  function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    element.addEventListener('mousedown', function(e) {
      // Only drag if clicking on the element itself, not on buttons or other interactive elements
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'I' || e.target.closest('button')) {
        return;
      }
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      element.style.cursor = 'grabbing';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;
      
      // Keep within viewport bounds
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      newLeft = Math.max(0, Math.min(newLeft, viewportWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, viewportHeight - rect.height));
      
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      element.style.right = 'auto'; // Remove right positioning when dragging
    });
    
    document.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
      }
    });
  }

  // Create custom popup container positioned below toolbox
  function createCustomPopupContainer() {
    if (customPopupContainer) return customPopupContainer;
    
    customPopupContainer = document.createElement('div');
    customPopupContainer.id = 'custom-feature-popup';
    customPopupContainer.className = 'custom-feature-popup';
    customPopupContainer.style.cssText = `
      position: fixed;
      top: 300px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      min-width: 200px;
      min-height: 100px;
      background: rgba(18, 18, 18, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      z-index: 1300;
      display: none;
      overflow: auto;
      resize: both;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      cursor: move;
    `;
    
    document.body.appendChild(customPopupContainer);
    
    // Make popup draggable
    makeDraggable(customPopupContainer);
    
    return customPopupContainer;
  }

  // Show custom popup with feature properties
  function showCustomPopup(feature, layerName = 'Feature') {
    const popup = createCustomPopupContainer();
    
    // Prevent browser context menu
    document.addEventListener('contextmenu', preventDefaultContextMenu, { once: true });
    
    // Build popup content
    let popupContent = `
      <div style="padding: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="display: flex; align-items: center;">
            <i class="fas fa-info-circle" style="color: #00ffe7; margin-right: 4px; font-size: 10px;"></i>
            <h3 style="color: #ffffff; font-size: 10px; font-weight: 600; margin: 0;">${layerName}</h3>
          </div>
          <button id="close-popup-btn" style="background: none; border: none; color: rgba(255, 255, 255, 0.6); cursor: pointer; padding: 2px; border-radius: 4px; transition: all 0.2s ease;">
            <i class="fas fa-times" style="font-size: 8px;"></i>
          </button>
        </div>
        <div style="max-height: 320px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(0, 255, 231, 0.3) rgba(255, 255, 255, 0.1);">
    `;
    
    // Add feature properties
    if (feature.properties && Object.keys(feature.properties).length > 0) {
      for (const [key, value] of Object.entries(feature.properties)) {
        const displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
        popupContent += `
          <div style="display: flex; margin-bottom: 4px; padding: 4px; background: rgba(255, 255, 255, 0.03); border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="font-weight: 500; color: #00ffe7; font-size: 9px; min-width: 60px; margin-right: 6px; text-transform: uppercase; letter-spacing: 0.3px;">${key}</div>
            <div style="color: rgba(255, 255, 255, 0.9); font-size: 9px; word-break: break-word; flex: 1;">${displayValue}</div>
          </div>
        `;
      }
    } else {
      popupContent += '<div style="color: rgba(255, 255, 255, 0.6); font-size: 9px; text-align: center; padding: 8px;">No properties available</div>';
    }
    
    popupContent += `
        </div>
      </div>
    `;
    
    popup.innerHTML = popupContent;
    popup.style.display = 'block';
    
    // Add close button handler
    const closeBtn = popup.querySelector('#close-popup-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', hideCustomPopup);
      closeBtn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
        this.style.color = '#ffffff';
      });
      closeBtn.addEventListener('mouseleave', function() {
        this.style.background = 'none';
        this.style.color = 'rgba(255, 255, 255, 0.6)';
      });
    }
    
    // Auto-close on map click
    const mapClickHandler = () => {
      hideCustomPopup();
      map.off('click', mapClickHandler);
    };
    map.on('click', mapClickHandler);
    
    // Auto-close on escape key
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        hideCustomPopup();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  // Hide custom popup
  function hideCustomPopup() {
    if (customPopupContainer) {
      customPopupContainer.style.display = 'none';
    }
  }

  // Prevent default browser context menu
  function preventDefaultContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Bind context menu handlers to all existing layers
  function bindContextMenuToLayers() {
    if (!window.layers) return;
    
    window.layers.forEach((layerInfo, layerId) => {
      if (layerInfo.layer && layerInfo.layer.eachLayer) {
        layerInfo.layer.eachLayer((subLayer) => {
          bindContextMenuToLayer(subLayer, layerInfo.name);
        });
      }
    });
  }

  // Bind context menu to a specific layer
  function bindContextMenuToLayer(layer, layerName) {
    if (!layer || typeof layer.on !== 'function') return;
    
    // Remove existing contextmenu listeners to prevent duplicates
    layer.off('contextmenu');
    
    // Add contextmenu handler
    layer.on('contextmenu', function(e) {
      e.originalEvent.preventDefault();
      e.originalEvent.stopPropagation();
      
      // Get feature data
      const feature = layer.feature;
      if (feature) {
        showCustomPopup(feature, layerName);
      }
    });
  }

  // Legacy popup management functions
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

  // Global exports for backward compatibility
  window.safeBindPopup = safeBindPopup;
  window.bindContextMenuToLayer = bindContextMenuToLayer;
  window.bindContextMenuToLayers = bindContextMenuToLayers;
  window.showCustomPopup = showCustomPopup;
  window.hideCustomPopup = hideCustomPopup;
  
  // Initialize context menu handlers for existing layers
  bindContextMenuToLayers();
  
  // Set up periodic re-binding for dynamically added layers
  setInterval(bindContextMenuToLayers, 2000);
}
