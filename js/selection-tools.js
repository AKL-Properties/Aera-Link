// Stub for missing function
function safeBindPopup(layer, content) {
  console.warn("safeBindPopup: not implemented yet", layer, content);
}
// Selection Tools Module
// Handles all feature selection and drawing functionality

// Selection tool variables - using global scope for compatibility
let drawControl;
let drawnItems;
let isSelectionActive = false;
let selectedFeatures = [];
let highlightedLayers = [];
let popupsDisabled = false; // Flag to track if popups are disabled during selection
let selectionOverlayMask = null; // Black overlay mask for selection emphasis
let maskUpdateHandlers = null; // Map event handlers for mask updates
let selectionVisualLayers = { mask: null, overlay: null }; // Store visual layers for cleanup

// Global memory structure for selected features
window.selectedFeaturesMemory = {
    features: [], // Array to store selected feature GeoJSON
    metadata: {
        lastUpdated: null,
        sourceLayer: null,
        totalFeatures: 0
    },
    // Add feature to memory
    addFeature: function(feature) {
        // Generate a unique ID if not present
        if (!feature.id) {
            feature.id = `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        // Check if feature already exists
        const exists = this.features.some(f => f.id === feature.id);
        if (!exists) {
            this.features.push(feature);
            this.metadata.lastUpdated = new Date();
            this.metadata.totalFeatures = this.features.length;
            // Update button states
            if (typeof window.updateFilterSelectedButton === 'function') {
                window.updateFilterSelectedButton();
            }
        }
    },
    // Remove feature from memory
    removeFeature: function(featureId) {
        const index = this.features.findIndex(f => f.id === featureId);
        if (index > -1) {
            this.features.splice(index, 1);
            this.metadata.lastUpdated = new Date();
            this.metadata.totalFeatures = this.features.length;
            // Update button states
            if (typeof window.updateFilterSelectedButton === 'function') {
                window.updateFilterSelectedButton();
            }
        }
    },
    // Clear all features from memory
    clear: function() {
        this.features = [];
        this.metadata.lastUpdated = new Date();
        this.metadata.totalFeatures = 0;
        this.metadata.sourceLayer = null;
        // Update button states
        if (typeof window.updateFilterSelectedButton === 'function') {
            window.updateFilterSelectedButton();
        }
    },
    // Get all features as GeoJSON FeatureCollection
    getAsGeoJSON: function() {
        return {
            type: 'FeatureCollection',
            features: this.features
        };
    }
};

// Drawing state variables
let isDrawing = false;
let drawingPath = [];
let currentDrawingLayer = null;
let currentFillLayer = null;
let activeSelectionLayerId = null;
let hasStartedDrawing = false;

// Initialize selection tools
function initializeSelectionTools(map) {
    // Create a layer group for drawn items
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    // Remove the old draw control - we'll implement custom freehand drawing
    drawControl = null;

    // Two-click freehand drawing event handlers
    function handleMouseDown(e) {
        if (!isSelectionActive || window.isMiddleMouseDown) return;
        
        // Only handle left mouse button for selection
        if (e.originalEvent.button !== 0) return;
        
        // ALWAYS prevent default and popup behavior during selection
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
        
        if (!hasStartedDrawing) {
            // First click - start drawing
            hasStartedDrawing = true;
            isDrawing = true;
            drawingPath = [e.latlng];
            
            // Clear any existing drawing layers
            if (currentDrawingLayer) {
                map.removeLayer(currentDrawingLayer);
            }
            if (currentFillLayer) {
                map.removeLayer(currentFillLayer);
            }
            
            // Create initial drawing layer (line only)
            currentDrawingLayer = L.polyline([e.latlng], {
                color: '#ff7800',
                weight: 3,
                opacity: 0.8,
                smoothFactor: 1
            }).addTo(map);
            
            // Create initial fill layer (semi-transparent orange fill)
            currentFillLayer = L.polygon([e.latlng, e.latlng], {
                color: '#ff7800',
                weight: 1,
                opacity: 0.3,
                fillColor: '#ff7800',
                fillOpacity: 0.15,
                smoothFactor: 1
            }).addTo(map);
        } else {
            // Second click - end drawing and perform selection
            hasStartedDrawing = false;
            isDrawing = false;
            
            // Add final point to the path
            drawingPath.push(e.latlng);
            
            // Close the shape and perform selection
            if (drawingPath.length > 1) {
                // Close the polygon - use the exact drawn path without buffering
                const closedPath = [...drawingPath, drawingPath[0]];
                
                // Capture modifier key state at the time of selection
                const modifierKeys = {
                    shiftKey: e.originalEvent.shiftKey || false,
                    ctrlKey: e.originalEvent.ctrlKey || e.originalEvent.metaKey || false
                };
                
                findIntersectingFeaturesWithPolygon(closedPath, modifierKeys);
            }
            
            // Remove the drawing layers after a brief delay to show completion
            setTimeout(() => {
                if (currentDrawingLayer) {
                    map.removeLayer(currentDrawingLayer);
                    currentDrawingLayer = null;
                }
                if (currentFillLayer) {
                    map.removeLayer(currentFillLayer);
                    currentFillLayer = null;
                }
            }, 200);
            
            // Clear the drawing path
            drawingPath = [];
        }
    }

    // Debounce mousemove updates for better performance
    let mouseMoveDebounce = null;
    
    function handleMouseMove(e) {
        if (!isSelectionActive || !isDrawing || window.isMiddleMouseDown) return;
        
        // Continuously add points to the drawing path for true freehand drawing
        if (hasStartedDrawing) {
            // Add current mouse position to the path for smooth freehand drawing
            drawingPath.push(e.latlng);
            
            // Debounce drawing updates to improve performance during rapid movement
            if (mouseMoveDebounce) {
                clearTimeout(mouseMoveDebounce);
            }
            
            mouseMoveDebounce = setTimeout(() => {
                // Update the drawing layer with the full freehand path
                if (currentDrawingLayer) {
                    currentDrawingLayer.setLatLngs(drawingPath);
                }
                
                // Update fill layer - create closed shape from the complete drawn path
                if (currentFillLayer && drawingPath.length > 2) {
                    const fillPath = [...drawingPath, drawingPath[0]]; // Close the shape
                    currentFillLayer.setLatLngs([fillPath]);
                }
            }, 16); // ~60fps update rate
        }
    }

    // Mouse up handler - not used in two-click mode
    function handleMouseUp(e) {
        return;
    }

    // Store event handlers for later removal
    map._freehandHandlers = {
        mousedown: handleMouseDown,
        mousemove: handleMouseMove,
        mouseup: handleMouseUp
    };
}

// Initialize layer dropdown with current layers
function initializeLayerDropdown() {
    // Try to use the official update function from layer-manager.js first
    if (typeof window.updateSelectionLayerDropdown === 'function') {
        try {
            window.updateSelectionLayerDropdown();
            return;
        } catch (error) {
            console.warn('Error calling updateSelectionLayerDropdown, using fallback:', error);
        }
    }
    
    // Fallback: manually populate the dropdown if the function isn't available
    const activeLayerSelect = document.getElementById('activeLayerSelect');
    if (!activeLayerSelect) {
        console.error('activeLayerSelect element not found');
        return;
    }
    
    // Clear existing options
    activeLayerSelect.innerHTML = '<option value="">Select a layer first</option>';
    
    // Check if window.layers exists and has visible layers
    if (window.layers && window.layers.size > 0) {
        let visibleLayerCount = 0;
        
        // Add visible layers to dropdown
        window.layers.forEach((layerInfo, layerId) => {
            if (layerInfo && layerInfo.visible) {
                visibleLayerCount++;
                const option = document.createElement('option');
                option.value = layerId;
                option.textContent = layerInfo.name || `Layer ${layerId}`;
                activeLayerSelect.appendChild(option);
            }
        });
        
        // Update button states based on available layers
        const activateBtn = document.getElementById('activateSelectTool');
        if (activateBtn) {
            if (visibleLayerCount > 0) {
                // Keep disabled until user selects a layer, but remove visual disabled state
                activateBtn.disabled = true;
            } else {
                // No layers available
                activateBtn.disabled = true;
                activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
            }
        }
    }
}

// Setup selection tool event listeners
function setupSelectionListeners() {
    document.getElementById('activateSelectTool').addEventListener('click', activateSelectionTool);
    document.getElementById('clearSelection').addEventListener('click', clearSelection);
    document.getElementById('showStatistics').addEventListener('click', toggleStatisticsPanel);

    // Real-time statistics field selection handler
    document.getElementById('statisticsFieldSelect').addEventListener('change', function(e) {
        calculateAndUpdateStatistics();
    });

    // Real-time statistics operations checkboxes handlers
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('statistics-operation-checkbox')) {
            calculateAndUpdateStatistics();
        }
    });

    // Layer selection dropdown handler
    document.getElementById('activeLayerSelect').addEventListener('change', function(e) {
        activeSelectionLayerId = e.target.value;
        const activateBtn = document.getElementById('activateSelectTool');
        const statisticsBtn = document.getElementById('showStatistics');
        
        if (activeSelectionLayerId) {
            activateBtn.disabled = false;
            activateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            
            // Enable Statistics button when layer is selected
            statisticsBtn.disabled = false;
        } else {
            activateBtn.disabled = true;
            activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
            
            // Disable Statistics button when no layer is selected
            statisticsBtn.disabled = true;
            
            // Hide statistics panel when no layer is selected
            document.getElementById('statisticsPanel').style.display = 'none';
            
            // If selection is active and no layer is selected, deactivate
            if (isSelectionActive) {
                deactivateSelectionTool();
            }
        }
    });
    
    // Initial population of the layer dropdown with existing layers
    // Use setTimeout to ensure window.layers is initialized and layer-manager.js is loaded
    setTimeout(() => {
        initializeLayerDropdown();
    }, 100);
}

// Activate selection tool
function activateSelectionTool() {
    // Check if an active layer is selected
    if (!activeSelectionLayerId) {
        window.showWarning('Please select a layer from the dropdown before activating the selection tool.', 'Layer Required');
        return;
    }
    
    if (!isSelectionActive) {
        isSelectionActive = true;
        
        // Clear previous selection
        clearSelection();
        
        // Reset drawing state
        hasStartedDrawing = false;
        isDrawing = false;
        
        // DISABLE popups on all layers during selection mode
        disablePopupsOnAllLayers();
        
        // DISABLE map dragging completely when selection tool is active
        window.map.dragging.disable();
        
        // Add freehand drawing event listeners
        window.map.on('mousedown', window.map._freehandHandlers.mousedown);
        window.map.on('mousemove', window.map._freehandHandlers.mousemove);
        window.map.on('mouseup', window.map._freehandHandlers.mouseup);
        
        // Update button states 
        document.getElementById('activateSelectTool').innerHTML = '<i class="fas fa-draw-polygon mr-2"></i>Selection Active (Shift: Add | Ctrl: Remove)';
        document.getElementById('activateSelectTool').classList.add('glass-button-active');
        
        // Change cursor to crosshair
        window.map.getContainer().style.cursor = 'crosshair';
        
        // Add a click handler to deactivate (optional - for user control)
        document.getElementById('activateSelectTool').removeEventListener('click', activateSelectionTool);
        document.getElementById('activateSelectTool').addEventListener('click', deactivateSelectionTool);
    }
}

// Deactivate selection tool
function deactivateSelectionTool() {
    if (isSelectionActive) {
        isSelectionActive = false;
        isDrawing = false;
        hasStartedDrawing = false;
        
        // Remove freehand drawing event listeners
        window.map.off('mousedown', window.map._freehandHandlers.mousedown);
        window.map.off('mousemove', window.map._freehandHandlers.mousemove);
        window.map.off('mouseup', window.map._freehandHandlers.mouseup);
        
        // Clean up any current drawing
        if (currentDrawingLayer) {
            window.map.removeLayer(currentDrawingLayer);
            currentDrawingLayer = null;
        }
        if (currentFillLayer) {
            window.map.removeLayer(currentFillLayer);
            currentFillLayer = null;
        }
        drawingPath = [];
        
        // RE-ENABLE popups on all layers after selection mode
        enablePopupsOnAllLayers();
        
        // RE-ENABLE map dragging when selection tool is deactivated
        window.map.dragging.enable();
        
        // Reset cursor
        window.map.getContainer().style.cursor = '';
        
        // Clear selection visuals when deactivating tool
        clearSelectionVisuals();
        
        // Update button states
        document.getElementById('activateSelectTool').innerHTML = '<i class="fas fa-draw-polygon mr-2"></i>Activate Selection Tool';
        document.getElementById('activateSelectTool').classList.remove('glass-button-active');
        
        // Restore original click handler
        document.getElementById('activateSelectTool').removeEventListener('click', deactivateSelectionTool);
        document.getElementById('activateSelectTool').addEventListener('click', activateSelectionTool);
    }
}

// Disable popups on all layers during selection mode
function disablePopupsOnAllLayers() {
    if (popupsDisabled) return; // Already disabled
    
    popupsDisabled = true;
    let disabledCount = 0;
    
    // Method 1: Disable popups on layers managed by the layer manager
    if (window.layers && typeof window.layers.forEach === 'function') {
        window.layers.forEach((layerInfo, layerId) => {
            if (layerInfo.layer) {
                disablePopupOnLayer(layerInfo.layer);
                disabledCount++;
            }
        });
    }
    
    // Method 2: Disable popups on ALL layers directly added to the map
    // This catches any layers not tracked by the layer manager
    if (window.map) {
        window.map.eachLayer((layer) => {
            // Skip base map tiles and other non-interactive layers
            if (layer._url || layer.options?.attribution) return;
            
            // Handle GeoJSON layers and other vector layers
            if (layer instanceof L.GeoJSON || layer instanceof L.Marker || 
                layer instanceof L.Circle || layer instanceof L.Polygon || 
                layer instanceof L.Polyline || layer.getPopup) {
                disablePopupOnLayer(layer);
                disabledCount++;
            }
            
            // Handle layer groups and feature groups
            if (layer.eachLayer && typeof layer.eachLayer === 'function') {
                layer.eachLayer((subLayer) => {
                    disablePopupOnLayer(subLayer);
                    disabledCount++;
                });
            }
        });
    }
    
}

// Helper function to disable popup on a single layer
function disablePopupOnLayer(layer) {
    if (layer && typeof layer.getPopup === 'function') {
        // Store the original popup content for restoration later
        const existingPopup = layer.getPopup();
        if (existingPopup) {
            layer._originalPopup = existingPopup;
            // Unbind the popup to prevent it from appearing
            layer.unbindPopup();
        }
    }
}

// Re-enable popups on all layers after selection mode
function enablePopupsOnAllLayers() {
    if (!popupsDisabled) return; // Already enabled
    
    popupsDisabled = false;
    let enabledCount = 0;
    
    // Method 1: Re-enable popups on layers managed by the layer manager
    if (window.layers && typeof window.layers.forEach === 'function') {
        window.layers.forEach((layerInfo, layerId) => {
            if (layerInfo.layer) {
                enablePopupOnLayer(layerInfo.layer);
                enabledCount++;
            }
        });
    }
    
    // Method 2: Re-enable popups on ALL layers directly added to the map
    if (window.map) {
        window.map.eachLayer((layer) => {
            // Skip base map tiles and other non-interactive layers
            if (layer._url || layer.options?.attribution) return;
            
            // Handle GeoJSON layers and other vector layers
            if (layer instanceof L.GeoJSON || layer instanceof L.Marker || 
                layer instanceof L.Circle || layer instanceof L.Polygon || 
                layer instanceof L.Polyline || layer._originalPopup) {
                enablePopupOnLayer(layer);
                enabledCount++;
            }
            
            // Handle layer groups and feature groups
            if (layer.eachLayer && typeof layer.eachLayer === 'function') {
                layer.eachLayer((subLayer) => {
                    enablePopupOnLayer(subLayer);
                    enabledCount++;
                });
            }
        });
    }
    
}

// Helper function to enable popup on a single layer
function enablePopupOnLayer(layer) {
    if (layer && layer._originalPopup && typeof layer.bindPopup === 'function') {
        // Restore the original popup
        layer.bindPopup(layer._originalPopup);
        // Clear the stored reference
        delete layer._originalPopup;
    }
    
    // Also handle any layers that might have pending popups from safeBindPopup
    if (layer && layer._pendingPopup && typeof layer.bindPopup === 'function') {
        layer.bindPopup(layer._pendingPopup.content, layer._pendingPopup.options);
        delete layer._pendingPopup;
    }
    
    // Handle sub-layers if this is a layer group
    if (layer && layer.eachLayer && typeof layer.eachLayer === 'function') {
        layer.eachLayer((subLayer) => {
            enablePopupOnLayer(subLayer);
        });
    }
}

// Find intersecting features with polygon selection (optimized for performance)
function findIntersectingFeaturesWithPolygon(polygonPath, modifierKeys = {}) {
    if (!activeSelectionLayerId || !window.layers || !window.layers.has(activeSelectionLayerId)) {
        console.warn('No active layer selected for feature selection or layers not available');
        return;
    }

    const targetLayer = window.layers.get(activeSelectionLayerId);
    if (!targetLayer || !targetLayer.layer) {
        console.warn('Target layer not found or invalid');
        return;
    }

    // Convert polygon path to turf.js polygon once
    const turfPolygon = turf.polygon([polygonPath.map(latlng => [latlng.lng, latlng.lat])]);
    
    // Get polygon bounds for spatial pre-filtering
    const polygonBounds = turf.bbox(turfPolygon);
    const [minLng, minLat, maxLng, maxLat] = polygonBounds;

    let intersectingFeatures = [];
    let processedCount = 0;
    let skippedCount = 0;

    // Optimized intersection helper with caching and early exits
    function optimizedIntersects(featureGeoJSON, selPolygon, geometryType) {
        try {
            // Early spatial bounds check for performance
            if (featureGeoJSON.geometry.coordinates) {
                const coords = featureGeoJSON.geometry.coordinates;
                let featureBounds;
                
                // Quick bounds check based on geometry type
                if (geometryType === 'Point') {
                    const [lng, lat] = coords;
                    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
                        return false; // Outside selection bounds
                    }
                } else {
                    // For complex geometries, use turf.bbox but cache if possible
                    try {
                        featureBounds = turf.bbox(featureGeoJSON);
                        const [fMinLng, fMinLat, fMaxLng, fMaxLat] = featureBounds;
                        
                        // Quick bounds overlap check
                        if (fMaxLng < minLng || fMinLng > maxLng || fMaxLat < minLat || fMinLat > maxLat) {
                            return false; // No bounds overlap
                        }
                    } catch (bboxError) {
                        // Continue with full intersection test if bbox fails
                    }
                }
            }

            // Perform actual intersection test
            switch (geometryType) {
                case 'Point':
                    return turf.booleanPointInPolygon(featureGeoJSON, selPolygon);
                case 'LineString':
                case 'MultiLineString':
                    return turf.booleanIntersects(featureGeoJSON, selPolygon);
                case 'Polygon':
                case 'MultiPolygon':
                    return turf.booleanIntersects(featureGeoJSON, selPolygon) ||
                           turf.booleanWithin(featureGeoJSON, selPolygon) ||
                           turf.booleanWithin(selPolygon, featureGeoJSON);
                default:
                    return turf.booleanIntersects(featureGeoJSON, selPolygon);
            }
        } catch (e) {
            console.warn('Intersection test failed for feature:', e);
            return false;
        }
    }

    // Batch process features for better performance
    const featuresToProcess = [];
    
    // Collect all features first
    if (targetLayer.layer.eachLayer) {
        // FeatureGroup or LayerGroup
        targetLayer.layer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.geometry) {
                featuresToProcess.push(layer.feature);
            }
        });
    } else if (targetLayer.layer.feature) {
        // Single feature layer
        featuresToProcess.push(targetLayer.layer.feature);
    }

    // Process features in batches to prevent UI blocking
    function processBatch(startIndex, batchSize = 100) {
        const endIndex = Math.min(startIndex + batchSize, featuresToProcess.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const layerGeoJSON = featuresToProcess[i];
            const geometryType = layerGeoJSON.geometry.type;
            
            try {
                const intersects = optimizedIntersects(layerGeoJSON, turfPolygon, geometryType);
                if (intersects) {
                    intersectingFeatures.push(layerGeoJSON);
                    processedCount++;
                } else {
                    skippedCount++;
                }
            } catch (error) {
                console.warn('Error checking intersection for feature:', error);
                skippedCount++;
            }
        }
        
        // If more features to process, schedule next batch
        if (endIndex < featuresToProcess.length) {
            // Use requestAnimationFrame for non-blocking processing
            requestAnimationFrame(() => processBatch(endIndex, batchSize));
            return;
        }
        
        // All features processed, continue with selection logic
        finishSelection();
    }

    function finishSelection() {

        // Apply selection based on modifier keys
        if (modifierKeys.ctrlKey || modifierKeys.metaKey) {
            // Ctrl/Cmd key: Remove from selection
            intersectingFeatures.forEach(feature => {
                // More efficient duplicate finding using feature ID or properties hash
                const featureHash = feature.id || JSON.stringify(feature.properties);
                const index = selectedFeatures.findIndex(f => {
                    const selectedHash = f.id || JSON.stringify(f.properties);
                    return selectedHash === featureHash;
                });
                if (index > -1) {
                    selectedFeatures.splice(index, 1);
                }
                // Remove from global memory if it exists
                if (feature.id) {
                    window.selectedFeaturesMemory.removeFeature(feature.id);
                }
            });
        } else if (modifierKeys.shiftKey) {
            // Shift key: Add to selection (avoid duplicates)
            intersectingFeatures.forEach(feature => {
                const featureHash = feature.id || JSON.stringify(feature.properties);
                const exists = selectedFeatures.some(f => {
                    const selectedHash = f.id || JSON.stringify(f.properties);
                    return selectedHash === featureHash;
                });
                if (!exists) {
                    selectedFeatures.push(feature);
                    // Add to global memory
                    window.selectedFeaturesMemory.addFeature(feature);
                }
            });
        } else {
            // No modifier: Replace selection
            selectedFeatures = [...intersectingFeatures];
            // Clear and repopulate global memory
            window.selectedFeaturesMemory.clear();
            intersectingFeatures.forEach(feature => {
                window.selectedFeaturesMemory.addFeature(feature);
            });
            // Update source layer in metadata
            window.selectedFeaturesMemory.metadata.sourceLayer = activeSelectionLayerId;
        }

        // Batch update visual highlights and UI
        requestAnimationFrame(() => {
            updateHighlights();
            updateSelectionInfo();
        });
    }

    // Start batch processing
    if (featuresToProcess.length > 0) {
        processBatch(0);
    } else {
        finishSelection();
    }
}

// Update visual highlights for selected features using clean, non-animated approach
function updateHighlights() {
    // Clear existing visual layers
    clearSelectionVisuals();

    // Early exit if no features to highlight
    if (selectedFeatures.length === 0) {
        return;
    }

    // Apply clean selection visuals without animation
    applySelectionVisuals(selectedFeatures);
}

// Apply clean selection visuals mimicking Search Tool approach without animation
function applySelectionVisuals(features) {
    if (!features || features.length === 0 || !window.map) {
        return;
    }

    try {
        // 1. Create selected features overlay with L.geoJSON() and L.svg() renderer
        const selectedFeatureCollection = {
            type: 'FeatureCollection',
            features: features
        };

        const selectionOverlay = L.geoJSON(selectedFeatureCollection, {
            renderer: L.svg(),
            style: {
                color: '#00ffe7',
                weight: 3,
                opacity: 0,
                fill: false
            }
        }).addTo(window.map);

        // 2. Create reverse black mask with holes for selected features
        const maskLayer = createReverseMask(features);
        if (maskLayer) {
            maskLayer.addTo(window.map);
            // Ensure mask is below the selection overlay
            maskLayer.bringToBack();
        }

        // Store references for cleanup
        selectionVisualLayers.overlay = selectionOverlay;
        selectionVisualLayers.mask = maskLayer;

        console.log(`✅ Applied clean selection visuals for ${features.length} features`);

    } catch (error) {
        console.error('❌ Error applying selection visuals:', error);
    }
}

// Create reverse black mask with holes for selected features
function createReverseMask(features) {
    if (!features || features.length === 0) {
        return null;
    }

    try {
        // Use large static bounding box to cover Metro Manila and Cavite area
        // This prevents mask edge visibility when zooming/panning
        const outerRing = [
            [119.5, 13.5],
            [122.5, 13.5],
            [122.5, 15.2],
            [119.5, 15.2],
            [119.5, 13.5]
        ];

        // Collect all holes from selected features
        const holes = [];
        features.forEach(feature => {
            if (feature.geometry) {
                if (feature.geometry.type === 'Polygon') {
                    // Use outer ring of polygon as hole
                    holes.push(feature.geometry.coordinates[0]);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    // Add each polygon's outer ring as separate holes
                    feature.geometry.coordinates.forEach(polygon => {
                        holes.push(polygon[0]);
                    });
                }
                // Skip Point and LineString geometries for mask holes
            }
        });

        if (holes.length === 0) {
            return null;
        }

        // Create mask polygon with outer ring and holes
        const maskGeometry = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [outerRing, ...holes]
            }
        };

        // Create mask layer
        const maskLayer = L.geoJSON(maskGeometry, {
            style: {
                fillColor: 'black',
                fillOpacity: 0.6,
                color: 'transparent',
                weight: 0
            }
        });

        return maskLayer;

    } catch (error) {
        console.error('❌ Error creating reverse mask:', error);
        return null;
    }
}

// Clear selection visual layers
function clearSelectionVisuals() {
    // Remove overlay layer
    if (selectionVisualLayers.overlay && window.map.hasLayer(selectionVisualLayers.overlay)) {
        window.map.removeLayer(selectionVisualLayers.overlay);
        selectionVisualLayers.overlay = null;
    }

    // Remove mask layer
    if (selectionVisualLayers.mask && window.map.hasLayer(selectionVisualLayers.mask)) {
        window.map.removeLayer(selectionVisualLayers.mask);
        selectionVisualLayers.mask = null;
    }

    // Clear legacy highlighted layers for compatibility
    if (highlightedLayers.length > 0) {
        highlightedLayers.forEach(layer => {
            if (window.map.hasLayer(layer)) {
                window.map.removeLayer(layer);
            }
        });
        highlightedLayers = [];
    }

    // Remove legacy overlay mask
    removeSelectionOverlayMask();
}


// Clear all selections
function clearSelection() {
    selectedFeatures = [];
    
    // Clear new visual layers
    clearSelectionVisuals();
    
    // Clear global memory
    window.selectedFeaturesMemory.clear();
    
    // Update UI
    updateSelectionInfo();
    
    // Clear floating statistics
    clearFloatingStatisticsCards();
    
    // Update button states
    document.getElementById('clearSelection').disabled = true;
    document.getElementById('showStatistics').disabled = !activeSelectionLayerId;
}

// Update selection info panel
function updateSelectionInfo() {
    const countNumberElement = document.getElementById('selectedCountNumber');
    const listElement = document.getElementById('selectedFeaturesList');
    const clearButton = document.getElementById('clearSelection');
    const statisticsButton = document.getElementById('showStatistics');
    
    // Use global memory for count
    const targetCount = window.selectedFeaturesMemory.features.length;
    const currentCount = parseInt(countNumberElement.textContent) || 0;
    
    // Update button states
    clearButton.disabled = targetCount === 0;
    // Statistics button is enabled when a layer is selected, not just when features are selected
    statisticsButton.disabled = !activeSelectionLayerId;
    
    // Only hide statistics panel if no layer is selected
    if (!activeSelectionLayerId) {
        document.getElementById('statisticsPanel').style.display = 'none';
        document.getElementById('statisticsResults').style.display = 'none';
        document.getElementById('statisticsResults').innerHTML = '';
    }
    
    // Animate the count change
    if (targetCount !== currentCount) {
        animateCounter(countNumberElement, currentCount, targetCount);
        
        // Trigger real-time statistics update when selection changes
        calculateAndUpdateStatistics();
    }
    
    // Update Filter Selected button state when selection changes
    if (typeof window.updateFilterSelectedButton === 'function') {
        window.updateFilterSelectedButton();
    }
    
    // Hide feature list - we only show the count now
    listElement.style.display = 'none';
    listElement.innerHTML = '';
}

// Animate counter from current value to target value
function animateCounter(element, startValue, endValue) {
    const duration = Math.min(800, Math.abs(endValue - startValue) * 40); // Max 800ms, min based on difference
    const startTime = performance.now();
    
    // Add counting animation class
    element.classList.add('counting');
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeOutCubic for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (endValue - startValue) * easeProgress);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            // Animation complete
            element.textContent = endValue;
            element.classList.remove('counting');
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Statistics Panel Functions
function toggleStatisticsPanel() {
    const panel = document.getElementById('statisticsPanel');
    const isVisible = panel.style.display !== 'none';
    
    if (isVisible) {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'block';
        populateFieldDropdown();
    }
}

function populateFieldDropdown() {
    const fieldSelect = document.getElementById('statisticsFieldSelect');
    const results = document.getElementById('statisticsResults');
    
    // Clear previous options and results
    fieldSelect.innerHTML = '<option value="">Select a field</option>';
    results.style.display = 'none';
    results.innerHTML = '';
    
    // Check if we have an active layer selected (not just selected features)
    if (!activeSelectionLayerId || !window.layers || !window.layers.has(activeSelectionLayerId)) {
        return;
    }

    const targetLayer = window.layers.get(activeSelectionLayerId);
    if (!targetLayer || !targetLayer.layer) {
        return;
    }

    // Extract all unique field names from the layer
    const allFields = new Set();
    
    if (targetLayer.layer.eachLayer) {
        // FeatureGroup or LayerGroup
        targetLayer.layer.eachLayer(function(layer) {
            if (layer.feature && layer.feature.properties) {
                Object.keys(layer.feature.properties).forEach(field => allFields.add(field));
            }
        });
    } else if (targetLayer.layer.feature && targetLayer.layer.feature.properties) {
        // Single feature layer
        Object.keys(targetLayer.layer.feature.properties).forEach(field => allFields.add(field));
    }

    // Add options for each field
    Array.from(allFields).sort().forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        
        // Check if the field contains non-numeric values
        let hasNonNumeric = false;
        if (targetLayer.layer.eachLayer) {
            targetLayer.layer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties && layer.feature.properties[field] != null) {
                    const value = layer.feature.properties[field];
                    if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(parseFloat(value)))) {
                        hasNonNumeric = true;
                    }
                }
            });
        } else if (targetLayer.layer.feature && targetLayer.layer.feature.properties && targetLayer.layer.feature.properties[field] != null) {
            const value = targetLayer.layer.feature.properties[field];
            if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(parseFloat(value)))) {
                hasNonNumeric = true;
            }
        }
        
        // Mark text fields
        option.dataset.isText = 'true';
        fieldSelect.appendChild(option);
    });
}

// Real-time statistics calculation and display as floating cards
function calculateAndUpdateStatistics() {
    const fieldSelect = document.getElementById('statisticsFieldSelect');
    const selectedField = fieldSelect.value;
    const floatingContainer = document.getElementById('floatingStatisticsContainer');
    
    // Get selected operations from checkboxes
    const selectedOperations = Array.from(document.querySelectorAll('.statistics-operation-checkbox:checked'))
        .map(checkbox => checkbox.value);
    
    // Hide container if no field or operations selected
    if (!selectedField || selectedOperations.length === 0) {
        floatingContainer.style.display = 'none';
        clearFloatingStatisticsCards();
        return;
    }
    
    // Show container
    floatingContainer.style.display = 'block';
    
    const isTextField = fieldSelect.options[fieldSelect.selectedIndex].dataset.isText === 'true';
    const hasSelectedFeatures = selectedFeatures.length > 0;
    
    // Get currently displayed operations to compare
    const existingCards = Array.from(floatingContainer.querySelectorAll('.floating-statistics-card'));
    const existingOperations = existingCards.map(card => card.dataset.operation);
    
    // Remove cards for unchecked operations
    existingCards.forEach(card => {
        const operation = card.dataset.operation;
        if (!selectedOperations.includes(operation)) {
            card.style.animation = 'fadeOutAtPosition 0.3s ease-in forwards';
            setTimeout(() => {
                if (card.parentNode) {
                    card.remove();
                }
            }, 300);
        }
    });
    
    // Process each selected operation and create floating cards
    selectedOperations.forEach((operation) => {
        // Always update existing cards to ensure real-time responsiveness
        if (existingOperations.includes(operation)) {
            // Force update existing card content for every selection change
            updateExistingCard(operation, selectedField, isTextField, hasSelectedFeatures);
            return; // Only return from this iteration, continue with next operation
        }
        
        let resultValue = null;
        let isValidOperation = true;
        
        if (!hasSelectedFeatures) {
            resultValue = "No features selected";
        } else {
            // Extract values from selected features
            const values = selectedFeatures.map(feature => {
                const value = feature.properties[selectedField];
                if (isTextField) return value;
                return typeof value === 'number' ? value : parseFloat(value);
            }).filter(val => val !== null && val !== undefined && (!isTextField ? !isNaN(val) : true));
            
            // Calculate based on operation
            switch (operation) {
                case 'sum':
                    if (isTextField) isValidOperation = false;
                    else resultValue = values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'average':
                    if (isTextField) isValidOperation = false;
                    else resultValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
                    break;
                case 'mode':
                    if (values.length > 0) {
                        const frequency = {};
                        values.forEach(val => frequency[val] = (frequency[val] || 0) + 1);
                        const maxFreq = Math.max(...Object.values(frequency));
                        const modes = Object.keys(frequency).filter(val => frequency[val] === maxFreq);
                        resultValue = modes.length === 1 ? (isTextField ? modes[0] : parseFloat(modes[0])) : modes.join(', ');
                    } else resultValue = isTextField ? 'N/A' : 0;
                    break;
                case 'min':
                    if (isTextField) isValidOperation = false;
                    else resultValue = values.length > 0 ? Math.min(...values) : 0;
                    break;
                case 'max':
                    if (isTextField) isValidOperation = false;
                    else resultValue = values.length > 0 ? Math.max(...values) : 0;
                    break;
            }
        }
        
        // Only display if it's a valid operation - create new card
        if (isValidOperation) {
            createFloatingStatisticsCard(selectedField, operation, resultValue, hasSelectedFeatures ? selectedFeatures.length : 0, hasSelectedFeatures);
        }
    });
}

// Update content of existing card without recreating it
function updateExistingCard(operation, field, isTextField, hasSelectedFeatures) {
    const floatingContainer = document.getElementById('floatingStatisticsContainer');
    const existingCard = floatingContainer.querySelector(`[data-operation="${operation}"]`);
    
    if (!existingCard) return;
    
    let resultValue = null;
    let isValidOperation = true;
    
    if (!hasSelectedFeatures) {
        resultValue = "No features selected";
    } else {
        // Extract values from selected features
        const values = selectedFeatures.map(feature => {
            const value = feature.properties[field];
            if (isTextField) return value;
            return typeof value === 'number' ? value : parseFloat(value);
        }).filter(val => val !== null && val !== undefined && (!isTextField ? !isNaN(val) : true));
        
        // Calculate based on operation
        switch (operation) {
            case 'sum':
                if (isTextField) isValidOperation = false;
                else resultValue = values.reduce((sum, val) => sum + val, 0);
                break;
            case 'average':
                if (isTextField) isValidOperation = false;
                else resultValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
                break;
            case 'mode':
                if (values.length > 0) {
                    const frequency = {};
                    values.forEach(val => frequency[val] = (frequency[val] || 0) + 1);
                    const maxFreq = Math.max(...Object.values(frequency));
                    const modes = Object.keys(frequency).filter(val => frequency[val] === maxFreq);
                    resultValue = modes.length === 1 ? (isTextField ? modes[0] : parseFloat(modes[0])) : modes.join(', ');
                } else resultValue = isTextField ? 'N/A' : 0;
                break;
            case 'min':
                if (isTextField) isValidOperation = false;
                else resultValue = values.length > 0 ? Math.min(...values) : 0;
                break;
            case 'max':
                if (isTextField) isValidOperation = false;
                else resultValue = values.length > 0 ? Math.max(...values) : 0;
                break;
        }
    }
    
    // Update the card content
    if (isValidOperation) {
        const headerElement = existingCard.querySelector('.floating-statistics-field');
        const numberElement = existingCard.querySelector('.floating-statistics-number');
        const helpTextElement = existingCard.querySelector('.floating-statistics-help-text');
        
        if (headerElement) {
            headerElement.textContent = hasSelectedFeatures ? 
                `of "${field}" (${selectedFeatures.length} features)` : 
                `of "${field}"`;
        }
        
        if (!hasSelectedFeatures) {
            // Show "No features selected" message
            if (numberElement) {
                numberElement.textContent = resultValue;
                numberElement.className = 'floating-statistics-no-features';
            }
            if (helpTextElement) {
                helpTextElement.textContent = "Select features on the map to calculate statistics";
            }
        } else {
            // Show result with animation for numeric values
            if (numberElement) {
                numberElement.className = 'floating-statistics-number';
                if (typeof resultValue === 'number') {
                    const currentValue = parseFloat(numberElement.textContent.replace(/,/g, '')) || 0;
                    animateFloatingCounter(numberElement, currentValue, resultValue, operation);
                } else {
                    numberElement.textContent = resultValue;
                }
            }
            if (helpTextElement) {
                helpTextElement.textContent = '';
            }
        }
    }
}

// Clear all floating statistics cards
function clearFloatingStatisticsCards() {
    const floatingContainer = document.getElementById('floatingStatisticsContainer');
    if (floatingContainer) {
        // Animate out all cards before removing
        const cards = floatingContainer.querySelectorAll('.floating-statistics-card');
        cards.forEach(card => {
            card.style.animation = 'fadeOutAtPosition 0.3s ease-in forwards';
        });
        
        // Remove all cards after animation
        setTimeout(() => {
            floatingContainer.innerHTML = '';
        }, 300);
    }
}

// Create a floating statistics card
function createFloatingStatisticsCard(field, operation, value, count, hasFeatures) {
    const floatingContainer = document.getElementById('floatingStatisticsContainer');
    
    // Format the value for display
    let formattedValue;
    const isNoFeaturesMessage = !hasFeatures;
    
    if (isNoFeaturesMessage) {
        formattedValue = value; // "No features selected"
    } else if (typeof value === 'number') {
        formattedValue = Number(value.toFixed(4)).toLocaleString();
    } else {
        formattedValue = value;
    }
    
    // Create the floating card
    const card = document.createElement('div');
    card.className = 'floating-statistics-card';
    card.dataset.operation = operation;
    
    if (isNoFeaturesMessage) {
        // Special styling for "No features selected" message
        card.innerHTML = `
            <div class="floating-statistics-header">
                <div class="floating-statistics-operation">${operation}</div>
                <div class="floating-statistics-field">of "${field}"</div>
            </div>
            <div class="floating-statistics-no-features">${formattedValue}</div>
            <div class="floating-statistics-help-text">Select features on the map to calculate statistics</div>
        `;
    } else {
        // Normal result display with animated counter
        card.innerHTML = `
            <div class="floating-statistics-header">
                <div class="floating-statistics-operation">${operation}</div>
                <div class="floating-statistics-field">of "${field}" (${count} features)</div>
            </div>
            <div class="floating-statistics-number" data-target-value="${typeof value === 'number' ? value : 0}">0</div>
            <div class="floating-statistics-label">${operation}</div>
        `;
    }
    
    floatingContainer.appendChild(card);
    
    // Animate the counter if it's a numeric value and we have features
    if (typeof value === 'number' && hasFeatures) {
        const numberElement = card.querySelector('.floating-statistics-number');
        if (numberElement) {
            setTimeout(() => {
                animateFloatingCounter(numberElement, 0, value, operation);
            }, 50); // Reduced delay for smoother appearance
        }
    } else if (hasFeatures && typeof value !== 'number') {
        // For non-numeric values, just show the value directly
        const numberElement = card.querySelector('.floating-statistics-number');
        if (numberElement) {
            numberElement.textContent = formattedValue;
        }
    }
}

// Animate floating statistics counter
function animateFloatingCounter(element, startValue, endValue, operation) {
    // Remove any existing counting class to prevent conflicts
    element.classList.remove('counting');
    
    // If values are the same or very close, update immediately without animation
    if (Math.abs(endValue - startValue) < 0.0001) {
        const finalValue = Number(endValue.toFixed(4)).toLocaleString();
        element.textContent = finalValue;
        return;
    }
    
    const duration = Math.min(800, Math.abs(endValue - startValue) * 40);
    const startTime = performance.now();
    
    // Add counting animation class
    element.classList.add('counting');
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easeOutCubic for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easeProgress;
        
        // Format the value based on operation type
        let displayValue;
        displayValue = Number(currentValue.toFixed(4)).toLocaleString();
        
        element.textContent = displayValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            // Animation complete
            const finalValue = Number(endValue.toFixed(4)).toLocaleString();
            element.textContent = finalValue;
            element.classList.remove('counting');
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Export getters for accessing selection state from other modules
function getSelectedFeatures() {
    return selectedFeatures;
}

function getActiveSelectionLayerId() {
    return activeSelectionLayerId;
}

function setActiveSelectionLayerId(layerId) {
    activeSelectionLayerId = layerId;
}

function getIsSelectionActive() {
    return isSelectionActive;
}

// Make all functions globally available
window.initializeSelectionTools = initializeSelectionTools;
window.setupSelectionListeners = setupSelectionListeners;
window.initializeLayerDropdown = initializeLayerDropdown;
window.activateSelectionTool = activateSelectionTool;
window.deactivateSelectionTool = deactivateSelectionTool;
window.clearSelection = clearSelection;
window.toggleStatisticsPanel = toggleStatisticsPanel;
window.getSelectedFeatures = getSelectedFeatures;
window.getActiveSelectionLayerId = getActiveSelectionLayerId;
window.setActiveSelectionLayerId = setActiveSelectionLayerId;
window.getIsSelectionActive = getIsSelectionActive;

// Helper function to determine if a feature is from Aera layer
function isFeatureFromAeraLayer(feature) {
    if (!feature || !window.layers) {
        return false;
    }
    
    // Check if the active selection layer is an Aera layer
    if (activeSelectionLayerId && window.layers.has(activeSelectionLayerId)) {
        const layerInfo = window.layers.get(activeSelectionLayerId);
        if (layerInfo && (layerInfo.name === 'Aera' || layerInfo.name === 'Aera.geojson')) {
            return true;
        }
    }
    
    // Alternative check: look for Aera-specific properties in the feature
    if (feature.properties) {
        // Common Aera.geojson property indicators
        const aeraProperties = ['REGISTERED OWNER', 'TCT NO.', 'LOT NO.', 'AREA (SQM)'];
        const hasAeraProps = aeraProperties.some(prop => 
            Object.hasOwnProperty.call(feature.properties, prop)
        );
        if (hasAeraProps) {
            return true;
        }
    }
    
    return false;
}



// Update mask cutouts to match current map view and selected polygons
function updateMaskCutouts() {
    if (!selectionOverlayMask || !selectionOverlayMask._mask || selectedFeatures.length === 0) {
        return;
    }

    const svgNS = 'http://www.w3.org/2000/svg';
    const mask = selectionOverlayMask._mask;

    // Remove existing polygon cutout paths (preserve white background)
    const existingPaths = mask.querySelectorAll('path');
    existingPaths.forEach(path => path.remove());

    // Create black polygon cutouts for each selected feature
    // Black areas in the mask = transparent (no dimming)
    selectedFeatures.forEach((feature, index) => {
        try {
            if (feature.geometry && feature.geometry.coordinates) {
                const coords = feature.geometry.coordinates;
                let pathData = '';

                if (feature.geometry.type === 'Polygon') {
                    // Single polygon - use outer ring only
                    const ring = coords[0];
                    pathData = createPathFromCoordinates(ring);
                } else if (feature.geometry.type === 'MultiPolygon') {
                    // Multiple polygons - process each one
                    coords.forEach(polygon => {
                        const ring = polygon[0]; // Outer ring of each polygon
                        const polygonPath = createPathFromCoordinates(ring);
                        if (polygonPath) {
                            pathData += polygonPath + ' ';
                        }
                    });
                } else if (feature.geometry.type === 'Point') {
                    // Create circular cutout for point features
                    const point = window.map.latLngToContainerPoint([coords[1], coords[0]]);
                    const radius = 15; // 15px radius for points
                    pathData = `M ${point.x - radius} ${point.y} 
                               A ${radius} ${radius} 0 1 1 ${point.x + radius} ${point.y} 
                               A ${radius} ${radius} 0 1 1 ${point.x - radius} ${point.y} Z`;
                } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                    // Skip line features - no visual buffer needed
                    return;
                }

                if (pathData.trim()) {
                    const cutoutPath = document.createElementNS(svgNS, 'path');
                    cutoutPath.setAttribute('d', pathData.trim());
                    cutoutPath.setAttribute('fill', 'black'); // Black = no mask = visible
                    cutoutPath.setAttribute('fill-rule', 'evenodd');
                    cutoutPath.setAttribute('class', 'selection-mask-cutout');
                    mask.appendChild(cutoutPath);
                }
            }
        } catch (error) {
            console.warn(`Error updating mask cutout for feature ${index}:`, error);
        }
    });
}

// Set up map event handlers for dynamic mask updates
function setupMaskUpdateHandlers() {
    if (!window.map || maskUpdateHandlers) {
        return; // Handlers already set up
    }

    // Create optimized update function with debouncing
    let updateTimeout = null;
    const debouncedUpdate = () => {
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        updateTimeout = setTimeout(() => {
            if (selectionOverlayMask && selectedFeatures.length > 0) {
                updateMaskCutouts();
            }
        }, 16); // ~60fps update rate
    };

    // Store handlers for cleanup
    maskUpdateHandlers = {
        moveend: debouncedUpdate,
        zoomend: debouncedUpdate,
        viewreset: debouncedUpdate
    };

    // Add event listeners
    window.map.on('moveend', maskUpdateHandlers.moveend);
    window.map.on('zoomend', maskUpdateHandlers.zoomend);
    window.map.on('viewreset', maskUpdateHandlers.viewreset);

}

// Remove map event handlers for mask updates
function removeMaskUpdateHandlers() {
    if (!window.map || !maskUpdateHandlers) {
        return;
    }

    // Remove event listeners
    window.map.off('moveend', maskUpdateHandlers.moveend);
    window.map.off('zoomend', maskUpdateHandlers.zoomend);
    window.map.off('viewreset', maskUpdateHandlers.viewreset);

    maskUpdateHandlers = null;
}

// Remove the selection overlay mask
function removeSelectionOverlayMask() {
    if (selectionOverlayMask && selectionOverlayMask.parentNode) {
        selectionOverlayMask.parentNode.removeChild(selectionOverlayMask);
        selectionOverlayMask = null;
    }
    
    // Clean up mask update handlers
    removeMaskUpdateHandlers();
}

// Convert geographic coordinates to SVG path data in screen space
function createPathFromCoordinates(coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return '';
    }

    let pathData = '';
    coordinates.forEach((coord, index) => {
        // Convert lat/lng to current screen coordinates
        const point = window.map.latLngToContainerPoint([coord[1], coord[0]]);
        
        // Ensure coordinates are finite and within reasonable bounds
        if (!isFinite(point.x) || !isFinite(point.y)) {
            return; // Skip invalid coordinates
        }
        
        if (index === 0) {
            pathData += `M ${point.x} ${point.y}`;
        } else {
            pathData += ` L ${point.x} ${point.y}`;
        }
    });
    
    if (pathData) {
        pathData += ' Z'; // Close the path
    }
    
    return pathData;
}


// Make activeSelectionLayerId globally accessible for layer-manager.js
Object.defineProperty(window, 'activeSelectionLayerId', {
    get: function() { return activeSelectionLayerId; },
    set: function(value) { activeSelectionLayerId = value; }
});
window.safeBindPopup = safeBindPopup;
window.disablePopupsOnAllLayers = disablePopupsOnAllLayers;
window.enablePopupsOnAllLayers = enablePopupsOnAllLayers;
window.isFeatureFromAeraLayer = isFeatureFromAeraLayer;
window.createSelectionOverlayMask = createSelectionOverlayMask;
window.removeSelectionOverlayMask = removeSelectionOverlayMask;
window.updateMaskCutouts = updateMaskCutouts;
window.setupMaskUpdateHandlers = setupMaskUpdateHandlers;
window.removeMaskUpdateHandlers = removeMaskUpdateHandlers;
window.applySelectionVisuals = applySelectionVisuals;
window.clearSelectionVisuals = clearSelectionVisuals;
window.createReverseMask = createReverseMask;
