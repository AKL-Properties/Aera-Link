// Map Print Module - Responsible for Map Composer and Export functionality
// Handles Tauri desktop printing capabilities and browser fallback

let mapComposerWindow = null;
let composerMap = null;
let composerDragging = false;
let composerStartPoint = null;
let composerPreviewCanvas = null;
let composerCurrentExtent = null;

// Environment Detection - Robust Tauri Detection
function isTauriEnvironment() {
    // Check for multiple Tauri indicators to ensure reliable detection
    
    // Primary check: Global Tauri object with core API
    if (typeof window.__TAURI__ !== 'undefined' && 
        window.__TAURI__ && 
        typeof window.__TAURI__.core === 'object' &&
        typeof window.__TAURI__.core.invoke === 'function') {
        return true;
    }
    
    // Secondary check: User Agent string (Tauri adds 'Tauri' to User Agent)
    if (navigator.userAgent && navigator.userAgent.includes('Tauri')) {
        return true;
    }
    
    // Tertiary check: Window object has Tauri-specific properties
    if (window.__TAURI_INTERNALS__ || window.__TAURI_METADATA__) {
        return true;
    }
    
    // Quaternary check: Check for Tauri-specific global functions
    if (typeof window.__TAURI_INVOKE__ === 'function') {
        return true;
    }
    
    // Final check: Look for file:// protocol (common in desktop apps) combined with other indicators
    if (window.location.protocol === 'file:' && 
        (document.querySelector('meta[name="tauri"]') || 
         window.navigator.userAgent.includes('Chrome') && 
         !window.navigator.userAgent.includes('Edge'))) {
        // This is a heuristic check - file:// + Chrome without Edge could indicate Tauri
        // We add the __TAURI__ check above to be more certain
        return window.__TAURI__ !== undefined;
    }
    
    return false;
}

// Initialize print functionality
function initializePrintSystem() {
    // Debug information for troubleshooting
    const isTauri = isTauriEnvironment();
    console.log('=== Print System Initialization ===');
    console.log('Environment detected:', isTauri ? 'Tauri Desktop' : 'Browser');
    console.log('window.__TAURI__:', typeof window.__TAURI__, window.__TAURI__ ? 'available' : 'not available');
    console.log('window.__TAURI__.core:', window.__TAURI__ && typeof window.__TAURI__.core);
    console.log('User Agent:', navigator.userAgent);
    console.log('Protocol:', window.location.protocol);
    console.log('===================================');
    
    // Add print button to floating toolbox if it doesn't exist
    addPrintButtonToToolbox();
    
    // Set up print button event listener
    setupPrintButtonListener();
    
    console.log(`Print system initialized for ${isTauri ? 'Tauri' : 'browser'} environment`);
}

// Add print button to the floating toolbox
function addPrintButtonToToolbox() {
    const toolboxButtons = document.querySelector('.toolbox-buttons');
    if (!toolboxButtons) return;
    
    // Check if print button already exists
    if (document.querySelector('[data-tool="print"]')) return;
    
    // Create print button
    const printButton = document.createElement('button');
    printButton.className = 'tool-btn';
    printButton.setAttribute('data-tool', 'print');
    printButton.setAttribute('title', 'Print Layout');
    printButton.innerHTML = '<i class="fas fa-print"></i>';
    
    // Add to toolbox
    toolboxButtons.appendChild(printButton);
}

// Setup print button event listener
function setupPrintButtonListener() {
    const printButton = document.querySelector('[data-tool="print"]');
    if (!printButton) return;
    
    printButton.addEventListener('click', handlePrintButtonClick);
}

// Handle print button click based on environment
async function handlePrintButtonClick() {
    // Perform a fresh check for Tauri environment in case it loaded after initialization
    let isTauri = isTauriEnvironment();
    
    // If not detected initially, wait a moment and try again (for timing issues)
    if (!isTauri) {
        console.log('Tauri not initially detected, waiting 500ms and rechecking...');
        await new Promise(resolve => setTimeout(resolve, 500));
        isTauri = isTauriEnvironment();
        console.log('Recheck result:', isTauri ? 'Tauri detected' : 'Still not detected');
    }
    
    if (!isTauri) {
        // Browser environment - show restriction message
        await showAlert(
            'This print tool is only available in the desktop version of this app. Please install and use the desktop version to export high-resolution maps.',
            'Desktop Feature Only'
        );
        return;
    }
    
    // Tauri environment - open Map Composer
    console.log('Opening Map Composer in Tauri environment');
    openMapComposer();
}

// Open Map Composer Window
function openMapComposer() {
    // Create composer modal/window
    createMapComposerUI();
    
    // Initialize composer map with proper timing
    // Use requestAnimationFrame for better timing than setTimeout
    requestAnimationFrame(() => {
        // Additional small delay to ensure DOM is fully rendered
        setTimeout(() => {
            initializeComposerMap();
        }, 50);
    });
}

// Create Map Composer UI
function createMapComposerUI() {
    // Remove existing composer if present
    if (mapComposerWindow) {
        mapComposerWindow.remove();
    }
    
    // Create composer container
    mapComposerWindow = document.createElement('div');
    mapComposerWindow.id = 'mapComposerWindow';
    mapComposerWindow.className = 'map-composer-overlay';
    
    mapComposerWindow.innerHTML = `
        <div class="map-composer-container">
            <div class="composer-header">
                <h2 class="composer-title">
                    <i class="fas fa-print text-neon-teal mr-2"></i>
                    Map Composer
                </h2>
                <button class="composer-close-btn" onclick="closeMapComposer()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="composer-content">
                <div class="composer-canvas-container">
                    <div class="composer-canvas-wrapper" style="width: 960px; height: 540px;">
                        <div id="composerMap" class="composer-map"></div>
                        <div class="composer-frame-overlay">
                            <div class="composer-frame-border"></div>
                            <div class="composer-drag-instructions">
                                Click and drag to adjust map extent
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="composer-controls">
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-expand-arrows-alt mr-2"></i>
                            Canvas Size
                        </label>
                        <div class="control-row">
                            <input type="number" id="canvasWidth" value="1920" min="100" max="8000" class="control-input">
                            <span class="control-separator">×</span>
                            <input type="number" id="canvasHeight" value="1080" min="100" max="8000" class="control-input">
                            <span class="control-unit">pixels</span>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-search-plus mr-2"></i>
                            Export DPI
                        </label>
                        <div class="control-row">
                            <input type="number" id="exportDPI" value="300" min="72" max="600" class="control-input">
                            <span class="control-unit">DPI</span>
                        </div>
                        <div class="control-info">
                            Output: <span id="outputDimensions">6000 × 3375 px</span>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-file-export mr-2"></i>
                            Export Format
                        </label>
                        <div class="control-row">
                            <select id="exportFormat" class="control-input">
                                <option value="png">PNG</option>
                                <option value="jpeg">JPEG</option>
                                <option value="tiff">TIFF</option>
                                <option value="pdf">PDF</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-layer-group mr-2"></i>
                            Layout Elements
                        </label>
                        <div class="layout-options">
                            <div class="checkbox-row">
                                <input type="checkbox" id="includeNorthArrow" class="control-checkbox">
                                <label for="includeNorthArrow" class="checkbox-label">North Arrow</label>
                            </div>
                            <div class="checkbox-row">
                                <input type="checkbox" id="includeScaleBar" class="control-checkbox">
                                <label for="includeScaleBar" class="checkbox-label">Scale Bar</label>
                            </div>
                            <div class="checkbox-row">
                                <input type="checkbox" id="includeLegend" class="control-checkbox">
                                <label for="includeLegend" class="checkbox-label">Legend</label>
                            </div>
                            <div class="checkbox-row">
                                <input type="checkbox" id="includeWorldFile" class="control-checkbox">
                                <label for="includeWorldFile" class="checkbox-label">World File</label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-heading mr-2"></i>
                            Map Title
                        </label>
                        <div class="control-row">
                            <input type="text" id="layoutTitle" placeholder="Enter map title (optional)" class="control-input">
                        </div>
                    </div>
                    
                    <div class="control-group">
                        <label class="control-label">
                            <i class="fas fa-eye mr-2"></i>
                            Live Preview
                        </label>
                        <div class="preview-container">
                            <canvas id="composerPreview" width="300" height="169"></canvas>
                        </div>
                    </div>
                    
                    <div class="composer-actions">
                        <button id="exportMapBtn" class="composer-btn composer-btn-primary">
                            <i class="fas fa-download mr-2"></i>
                            Export Map
                        </button>
                        <button id="resetExtentBtn" class="composer-btn composer-btn-secondary">
                            <i class="fas fa-undo mr-2"></i>
                            Reset Extent
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(mapComposerWindow);
    
    // Setup event listeners
    setupComposerEventListeners();
    
    // Show composer with animation
    setTimeout(() => {
        mapComposerWindow.classList.add('show');
    }, 10);
}

// Initialize composer map with proper DOM readiness check
function initializeComposerMap() {
    const composerMapDiv = document.getElementById('composerMap');
    if (!composerMapDiv) {
        console.error('Composer map div not found');
        return;
    }
    
    // Wait for proper DOM rendering with a more robust check
    const initializeWhenReady = () => {
        // Check if the div has proper dimensions
        const rect = composerMapDiv.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.log('Composer map div not yet properly sized, retrying...');
            setTimeout(initializeWhenReady, 50);
            return;
        }
        
        console.log('Initializing composer map with dimensions:', rect.width, 'x', rect.height);
        
        try {
            // Get current map state
            const currentCenter = window.map.getCenter();
            const currentZoom = window.map.getZoom();
            
            // Create composer map
            composerMap = L.map(composerMapDiv, {
                center: currentCenter,
                zoom: currentZoom,
                zoomControl: false,
                dragging: false, // Disable default dragging - we'll handle custom panning
                scrollWheelZoom: false,
                doubleClickZoom: false,
                boxZoom: false,
                touchZoom: false,
                keyboard: false,
                attributionControl: false,
                preferCanvas: true // Prefer canvas for better export compatibility
            });
            
            // Copy current basemap
            copyCurrentBasemapToComposer();
            
            // Copy visible layers from main map
            copyVisibleLayersToComposer();
            
            // Setup custom panning
            setupComposerPanning();
            
            // Initial preview update
            updatePreview();
            
            // Store initial extent
            composerCurrentExtent = composerMap.getBounds();
            
            // Setup layer synchronization
            setupLayerSynchronization();
            
            console.log('Composer map initialized successfully');
            
        } catch (error) {
            console.error('Error initializing composer map:', error);
        }
    };
    
    // Start the initialization process
    initializeWhenReady();
}

// Copy current basemap to composer with proper configuration
function copyCurrentBasemapToComposer() {
    if (!composerMap) return;
    
    // Use the basemaps object from basemap-manager.js
    if (window.currentBasemap && window.basemaps) {
        const currentBasemapKey = Object.keys(window.basemaps).find(key => 
            window.basemaps[key] === window.currentBasemap
        );
        
        if (currentBasemapKey && window.basemaps[currentBasemapKey]) {
            console.log('Copying basemap to composer:', currentBasemapKey);
            
            // Clone the basemap layer
            const basemapLayer = window.basemaps[currentBasemapKey];
            
            // Create a new instance of the same basemap
            if (basemapLayer._url) {
                // It's a tile layer
                const clonedBasemap = L.tileLayer(basemapLayer._url, {
                    ...basemapLayer.options,
                    attribution: basemapLayer.options.attribution || ''
                });
                clonedBasemap.addTo(composerMap);
            }
        }
    }
    
    // Also copy current labels if they exist
    if (window.currentLabels && window.basemaps) {
        const currentLabelsKey = Object.keys(window.basemaps).find(key => 
            window.basemaps[key] === window.currentLabels
        );
        
        if (currentLabelsKey && window.basemaps[currentLabelsKey]) {
            console.log('Copying labels to composer:', currentLabelsKey);
            
            const labelsLayer = window.basemaps[currentLabelsKey];
            if (labelsLayer._url) {
                const clonedLabels = L.tileLayer(labelsLayer._url, {
                    ...labelsLayer.options,
                    attribution: labelsLayer.options.attribution || ''
                });
                clonedLabels.addTo(composerMap);
            }
        }
    }
}

// Copy visible layers to composer map with complete styling preservation
function copyVisibleLayersToComposer() {
    if (!window.layers || !composerMap) {
        console.warn('Cannot copy layers: missing layers or composer map');
        return;
    }
    
    console.log('Copying', window.layers.size, 'layers to composer map');
    
    window.layers.forEach((layerInfo, layerId) => {
        if (layerInfo.layer && window.map.hasLayer(layerInfo.layer) && layerInfo.visible !== false) {
            console.log('Copying layer to composer:', layerInfo.name, 'Type:', layerInfo.type || 'geojson');
            
            try {
                // Handle different layer types
                if ((layerInfo.type === 'geojson' || !layerInfo.type) && layerInfo.data) {
                    // Clone GeoJSON layer with complete styling
                    const clonedLayer = createStyledGeoJSONClone(layerInfo);
                    if (clonedLayer) {
                        clonedLayer.addTo(composerMap);
                    }
                } else if (layerInfo.type === 'tile' && layerInfo.layer._url) {
                    // Clone tile layer
                    const clonedTileLayer = L.tileLayer(layerInfo.layer._url, {
                        ...layerInfo.layer.options,
                        opacity: layerInfo.opacity || 1.0
                    });
                    clonedTileLayer.addTo(composerMap);
                } else if (layerInfo.layer instanceof L.LayerGroup) {
                    // Handle layer groups (like marker clusters)
                    const clonedGroup = L.layerGroup();
                    layerInfo.layer.eachLayer(subLayer => {
                        if (subLayer.toGeoJSON) {
                            const geoJsonClone = L.geoJSON(subLayer.toGeoJSON(), {
                                style: getLayerStyle(layerInfo),
                                renderer: L.canvas()
                            });
                            clonedGroup.addLayer(geoJsonClone);
                        }
                    });
                    clonedGroup.addTo(composerMap);
                }
            } catch (error) {
                console.error('Error copying layer', layerInfo.name, 'to composer:', error);
            }
        }
    });
    
    console.log('Finished copying layers to composer map');
}

// Create a styled GeoJSON clone with proper symbology
function createStyledGeoJSONClone(layerInfo) {
    if (!layerInfo.data) return null;
    
    const style = layerInfo.style || {};
    
    // Check if this is categorical symbology
    const isCategorical = style.symbology_type === 'categorical' || 
                         (style.categoricalField && style.colorMap) ||
                         (style.classification_field && style.categories) ||
                         layerInfo.classification;
    
    let styleFunction;
    
    if (isCategorical) {
        // Handle categorical symbology
        let fieldName, colorMap;
        
        if (layerInfo.classification) {
            fieldName = layerInfo.classification.field;
            colorMap = layerInfo.classification.colorMap;
        } else if (style.categoricalField && style.colorMap) {
            fieldName = style.categoricalField;
            colorMap = style.colorMap;
        } else if (style.classification_field) {
            fieldName = style.classification_field;
            if (style.categories) {
                colorMap = {};
                style.categories.forEach(cat => {
                    colorMap[cat.value] = cat.color;
                });
            } else {
                colorMap = style.colorMap || {};
            }
        }
        
        console.log('Applying categorical styling for field:', fieldName, 'with', Object.keys(colorMap || {}).length, 'categories');
        
        styleFunction = function(feature) {
            const fieldValue = feature.properties[fieldName];
            const color = colorMap[fieldValue] || style.fill_color || style.fillColor || '#14b8a6';
            return {
                color: style.stroke_color || style.strokeColor || style.color || '#ffffff',
                weight: style.stroke_weight || style.strokeWidth || style.weight || 2,
                opacity: style.stroke_opacity || style.strokeOpacity || style.opacity || 1.0,
                fillColor: color,
                fillOpacity: style.fill_opacity || style.fillOpacity || layerInfo.opacity || 1.0
            };
        };
    } else {
        // Single symbol styling
        styleFunction = {
            color: style.stroke_color || style.strokeColor || style.color || '#ffffff',
            weight: style.stroke_weight || style.strokeWidth || style.weight || 2,
            opacity: style.stroke_opacity || style.strokeOpacity || style.opacity || 1.0,
            fillColor: style.fill_color || style.fillColor || '#888888',
            fillOpacity: style.fill_opacity || style.fillOpacity || layerInfo.opacity || 1.0
        };
    }
    
    // Create the cloned layer with proper styling
    return L.geoJSON(layerInfo.data, {
        style: styleFunction,
        renderer: L.canvas(), // Use canvas renderer for export compatibility
        onEachFeature: (feature, layer) => {
            // Preserve any custom styling or popups if needed
            if (feature.properties) {
                // Add popup content if desired (can be disabled for performance)
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                layer.bindPopup(popupContent);
            }
        }
    });
}

// Helper function to get layer style
function getLayerStyle(layerInfo) {
    const style = layerInfo.style || {};
    return {
        color: style.stroke_color || style.strokeColor || style.color || '#ffffff',
        weight: style.stroke_weight || style.strokeWidth || style.weight || 2,
        opacity: style.stroke_opacity || style.strokeOpacity || style.opacity || 1.0,
        fillColor: style.fill_color || style.fillColor || '#888888',
        fillOpacity: style.fill_opacity || style.fillOpacity || layerInfo.opacity || 1.0
    };
}

// Setup composer panning functionality
function setupComposerPanning() {
    const composerMapDiv = document.getElementById('composerMap');
    if (!composerMapDiv) return;
    
    composerMapDiv.addEventListener('mousedown', handleComposerMouseDown);
    composerMapDiv.addEventListener('mousemove', handleComposerMouseMove);
    composerMapDiv.addEventListener('mouseup', handleComposerMouseUp);
    composerMapDiv.addEventListener('mouseleave', handleComposerMouseLeave);
    
    // Change cursor to indicate draggable
    composerMapDiv.style.cursor = 'grab';
}

// Composer mouse event handlers
function handleComposerMouseDown(e) {
    e.preventDefault();
    composerDragging = true;
    composerStartPoint = { x: e.clientX, y: e.clientY };
    e.target.style.cursor = 'grabbing';
}

function handleComposerMouseMove(e) {
    if (!composerDragging || !composerStartPoint) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - composerStartPoint.x;
    const deltaY = e.clientY - composerStartPoint.y;
    
    // Convert pixel movement to map movement
    const currentCenter = composerMap.getCenter();
    const currentPixel = composerMap.latLngToContainerPoint(currentCenter);
    const newPixel = L.point(currentPixel.x - deltaX, currentPixel.y - deltaY);
    const newCenter = composerMap.containerPointToLatLng(newPixel);
    
    // Pan map
    composerMap.panTo(newCenter, { animate: false });
    
    // Update start point
    composerStartPoint = { x: e.clientX, y: e.clientY };
    
    // Update preview
    updatePreview();
    
    // Update current extent
    composerCurrentExtent = composerMap.getBounds();
}

function handleComposerMouseUp(e) {
    composerDragging = false;
    composerStartPoint = null;
    e.target.style.cursor = 'grab';
}

function handleComposerMouseLeave(e) {
    if (composerDragging) {
        composerDragging = false;
        composerStartPoint = null;
        e.target.style.cursor = 'grab';
    }
}

// Setup composer event listeners
function setupComposerEventListeners() {
    // Canvas size inputs
    const canvasWidth = document.getElementById('canvasWidth');
    const canvasHeight = document.getElementById('canvasHeight');
    const exportDPI = document.getElementById('exportDPI');
    
    if (canvasWidth) canvasWidth.addEventListener('input', updateOutputDimensions);
    if (canvasHeight) canvasHeight.addEventListener('input', updateOutputDimensions);
    if (exportDPI) exportDPI.addEventListener('input', updateOutputDimensions);
    
    // Action buttons
    const exportBtn = document.getElementById('exportMapBtn');
    const resetBtn = document.getElementById('resetExtentBtn');
    
    if (exportBtn) exportBtn.addEventListener('click', exportHighResolutionMap);
    if (resetBtn) resetBtn.addEventListener('click', resetComposerExtent);
    
    // Initial calculation
    updateOutputDimensions();
}

// Update output dimensions display
function updateOutputDimensions() {
    const canvasWidth = parseInt(document.getElementById('canvasWidth')?.value || 1920);
    const canvasHeight = parseInt(document.getElementById('canvasHeight')?.value || 1080);
    const dpi = parseInt(document.getElementById('exportDPI')?.value || 300);
    
    const outputWidth = Math.round(canvasWidth * dpi / 72);
    const outputHeight = Math.round(canvasHeight * dpi / 72);
    
    const outputDisplay = document.getElementById('outputDimensions');
    if (outputDisplay) {
        outputDisplay.textContent = `${outputWidth} × ${outputHeight} px`;
    }
    
    updatePreview();
}

// Update live preview with actual map rendering
function updatePreview() {
    const canvas = document.getElementById('composerPreview');
    if (!canvas || !composerMap) return;
    
    const ctx = canvas.getContext('2d');
    
    try {
        // Clear canvas with dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Attempt to create a scaled-down snapshot of the composer map
        // Since we can't easily render Leaflet to canvas in real-time,
        // we'll create a simplified representation
        
        // Draw basemap representation
        if (window.currentBasemap) {
            // Draw a subtle grid pattern to represent the basemap
            ctx.strokeStyle = '#404040';
            ctx.lineWidth = 0.5;
            const gridSize = 20;
            
            for (let x = 0; x <= canvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            
            for (let y = 0; y <= canvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
        }
        
        // Draw layer representations
        if (window.layers && window.layers.size > 0) {
            const bounds = composerMap.getBounds();
            const mapSize = composerMap.getSize();
            
            window.layers.forEach((layerInfo, layerId) => {
                if (layerInfo.layer && window.map.hasLayer(layerInfo.layer) && layerInfo.visible !== false) {
                    drawLayerPreview(ctx, layerInfo, bounds, mapSize, canvas);
                }
            });
        }
        
        // Draw extent info
        const bounds = composerMap.getBounds();
        const center = composerMap.getCenter();
        const zoom = composerMap.getZoom();
        
        // Draw border
        ctx.strokeStyle = '#00ffe7';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // Draw info text
        ctx.fillStyle = '#00ffe7';
        ctx.font = '10px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Zoom: ${zoom.toFixed(1)}`, 5, 15);
        ctx.fillText(`Center: ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`, 5, 30);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e0e0e0';
        ctx.fillText(`${window.layers ? window.layers.size : 0} layers`, canvas.width - 5, canvas.height - 5);
        
    } catch (error) {
        console.error('Error updating preview:', error);
        
        // Fallback to simple text display
        ctx.fillStyle = '#00ffe7';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Map Preview', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '9px Inter';
        ctx.fillText('Live updating...', canvas.width / 2, canvas.height / 2 + 10);
    }
}

// Draw a simplified representation of a layer in the preview
function drawLayerPreview(ctx, layerInfo, bounds, mapSize, canvas) {
    if (!layerInfo.data || !layerInfo.data.features) return;
    
    const style = layerInfo.style || {};
    const scaleX = canvas.width / mapSize.x;
    const scaleY = canvas.height / mapSize.y;
    
    // Set layer style
    ctx.strokeStyle = style.stroke_color || style.strokeColor || style.color || '#ffffff';
    ctx.fillStyle = style.fill_color || style.fillColor || '#888888';
    ctx.lineWidth = Math.max(0.5, (style.stroke_weight || style.strokeWidth || style.weight || 2) * scaleX);
    ctx.globalAlpha = style.fill_opacity || style.fillOpacity || layerInfo.opacity || 0.7;
    
    // Draw simplified geometry representations
    layerInfo.data.features.forEach(feature => {
        if (feature.geometry) {
            try {
                drawGeometryPreview(ctx, feature.geometry, bounds, scaleX, scaleY, canvas);
            } catch (error) {
                // Skip invalid geometries
            }
        }
    });
    
    ctx.globalAlpha = 1.0; // Reset alpha
}

// Draw simplified geometry in preview
function drawGeometryPreview(ctx, geometry, bounds, scaleX, scaleY, canvas) {
    const latRange = bounds.getNorth() - bounds.getSouth();
    const lngRange = bounds.getEast() - bounds.getWest();
    
    const coordToPixel = (coord) => {
        const x = ((coord[0] - bounds.getWest()) / lngRange) * canvas.width;
        const y = canvas.height - ((coord[1] - bounds.getSouth()) / latRange) * canvas.height;
        return [x, y];
    };
    
    if (geometry.type === 'Point') {
        const [x, y] = coordToPixel(geometry.coordinates);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    } else if (geometry.type === 'LineString') {
        ctx.beginPath();
        geometry.coordinates.forEach((coord, i) => {
            const [x, y] = coordToPixel(coord);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    } else if (geometry.type === 'Polygon') {
        geometry.coordinates.forEach(ring => {
            ctx.beginPath();
            ring.forEach((coord, i) => {
                const [x, y] = coordToPixel(coord);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
    } else if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ctx.beginPath();
                ring.forEach((coord, i) => {
                    const [x, y] = coordToPixel(coord);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });
        });
    }
}

// Reset composer extent to match main map
function resetComposerExtent() {
    if (!composerMap || !window.map) return;
    
    const currentCenter = window.map.getCenter();
    const currentZoom = window.map.getZoom();
    
    composerMap.setView(currentCenter, currentZoom, { animate: true });
    composerCurrentExtent = composerMap.getBounds();
    updatePreview();
}

// Synchronize composer map with main map layers (call when layers change)
function synchronizeComposerLayers() {
    if (!composerMap) return;
    
    console.log('Synchronizing composer layers with main map');
    
    // Clear existing layers (except basemap)
    composerMap.eachLayer(layer => {
        // Keep basemap layers, remove others
        if (layer._url) {
            // This is likely a basemap tile layer, keep it
            return;
        }
        composerMap.removeLayer(layer);
    });
    
    // Re-copy all visible layers
    copyVisibleLayersToComposer();
    
    // Update preview
    updatePreview();
}

// Add layer change listener to keep composer in sync
function setupLayerSynchronization() {
    // Listen for layer changes on the main map
    if (window.map && typeof window.map.on === 'function') {
        window.map.on('layeradd layerremove', () => {
            if (composerMap) {
                // Debounce the synchronization to avoid excessive updates
                clearTimeout(window.composerSyncTimeout);
                window.composerSyncTimeout = setTimeout(synchronizeComposerLayers, 200);
            }
        });
    }
    
    // Also listen for layer visibility changes via window.layers
    const originalUpdateLayersList = window.updateLayersList;
    if (originalUpdateLayersList) {
        window.updateLayersList = function() {
            originalUpdateLayersList.apply(this, arguments);
            if (composerMap) {
                clearTimeout(window.composerSyncTimeout);
                window.composerSyncTimeout = setTimeout(synchronizeComposerLayers, 200);
            }
        };
    }
}

// Export high-resolution map using native Tauri renderer
async function exportHighResolutionMap() {
    if (!isTauriEnvironment()) {
        await showError('Export functionality requires the desktop version of this app.');
        return;
    }
    
    try {
        const canvasWidth = parseInt(document.getElementById('canvasWidth')?.value || 1920);
        const canvasHeight = parseInt(document.getElementById('canvasHeight')?.value || 1080);
        const dpi = parseInt(document.getElementById('exportDPI')?.value || 300);
        const format = document.getElementById('exportFormat')?.value || 'png';
        
        // Get layout options
        const title = document.getElementById('layoutTitle')?.value || '';
        const includeNorthArrow = document.getElementById('includeNorthArrow')?.checked || false;
        const includeScaleBar = document.getElementById('includeScaleBar')?.checked || false;
        const includeLegend = document.getElementById('includeLegend')?.checked || false;
        const includeWorldFile = document.getElementById('includeWorldFile')?.checked || false;
        
        // Show loading state
        const exportBtn = document.getElementById('exportMapBtn');
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Exporting...';
        exportBtn.disabled = true;
        
        // Prepare basemap configuration
        const basemapConfig = getBasemapConfig();
        
        // Prepare layer data with proper styling
        const layerData = getFormattedLayerData();
        
        // Convert canvas dimensions from pixels to millimeters
        const widthMm = (canvasWidth * 25.4) / 96; // Assuming 96 DPI for pixel to mm conversion
        const heightMm = (canvasHeight * 25.4) / 96;
        
        console.log('Calling native renderer with parameters:', {
            bounds: {
                north: composerCurrentExtent.getNorth(),
                south: composerCurrentExtent.getSouth(),
                east: composerCurrentExtent.getEast(),
                west: composerCurrentExtent.getWest()
            },
            width_mm: widthMm,
            height_mm: heightMm,
            dpi: dpi,
            basemap: basemapConfig,
            layers: layerData,
            format: format,
            include_world_file: includeWorldFile,
            title: title || null,
            north_arrow: includeNorthArrow,
            scale_bar: includeScaleBar,
            legend: includeLegend
        });
        
        // Call new native rendering system
        const result = await window.__TAURI__.core.invoke('render_print_layout', {
            bounds: {
                north: composerCurrentExtent.getNorth(),
                south: composerCurrentExtent.getSouth(),
                east: composerCurrentExtent.getEast(),
                west: composerCurrentExtent.getWest()
            },
            width_mm: widthMm,
            height_mm: heightMm,
            dpi: dpi,
            basemap: basemapConfig,
            layers: layerData,
            format: format,
            include_world_file: includeWorldFile,
            title: title || null,
            north_arrow: includeNorthArrow,
            scale_bar: includeScaleBar,
            legend: includeLegend
        });
        
        if (result.success) {
            let message = `Map exported successfully!\n\nFile: ${result.filepath}`;
            if (result.world_file_path) {
                message += `\nWorld file: ${result.world_file_path}`;
            }
            if (result.render_time_ms) {
                message += `\nRender time: ${result.render_time_ms}ms`;
            }
            if (result.output_dimensions) {
                message += `\nOutput size: ${result.output_dimensions[0]} × ${result.output_dimensions[1]} pixels`;
            }
            
            await showSuccess(message);
        } else {
            await showError(`Export failed: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Export error:', error);
        await showError(`Export failed: ${error.message}`);
    } finally {
        // Restore button state
        const exportBtn = document.getElementById('exportMapBtn');
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
    }
}

// Get basemap configuration for native renderer
function getBasemapConfig() {
    // Get current basemap from basemap manager
    let provider = 'google-satellite';
    let urlTemplate = 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
    let attribution = '© Google';
    let maxZoom = 20;
    
    // Try to determine current basemap
    if (window.currentBasemap && window.basemaps) {
        const currentBasemapKey = Object.keys(window.basemaps).find(key => 
            window.basemaps[key] === window.currentBasemap
        );
        
        if (currentBasemapKey) {
            provider = currentBasemapKey;
            const basemapLayer = window.basemaps[currentBasemapKey];
            if (basemapLayer && basemapLayer._url) {
                urlTemplate = basemapLayer._url;
                attribution = basemapLayer.options?.attribution || attribution;
                maxZoom = basemapLayer.options?.maxZoom || maxZoom;
            }
        }
    }
    
    return {
        provider: provider,
        url_template: urlTemplate,
        attribution: attribution,
        max_zoom: maxZoom,
        api_key: null, // Add API key support if needed
        subdomains: getSubdomainsForProvider(provider)
    };
}

function getSubdomainsForProvider(provider) {
    switch (provider) {
        case 'osm-standard':
            return ['a', 'b', 'c'];
        case 'mapbox':
            return ['a', 'b', 'c', 'd'];
        default:
            return null;
    }
}

// Get properly formatted layer data for native renderer
function getFormattedLayerData() {
    const formattedLayers = [];
    
    if (window.layers) {
        window.layers.forEach((layerInfo, layerId) => {
            if (layerInfo.layer && window.map.hasLayer(layerInfo.layer) && layerInfo.visible !== false) {
                const layerData = {
                    id: layerId,
                    name: layerInfo.name,
                    type: layerInfo.type || 'geojson',
                    data: layerInfo.data,
                    visible: true,
                    opacity: layerInfo.opacity || 1.0,
                    style: formatLayerStyle(layerInfo)
                };
                
                formattedLayers.push(layerData);
            }
        });
    }
    
    return formattedLayers;
}

// Format layer style for native renderer
function formatLayerStyle(layerInfo) {
    const style = layerInfo.style || {};
    
    // Handle categorical symbology
    let colorMap = null;
    let categoricalField = null;
    let symbologyType = null;
    
    if (layerInfo.classification) {
        symbologyType = 'categorical';
        categoricalField = layerInfo.classification.field;
        colorMap = layerInfo.classification.colorMap;
    } else if (style.categoricalField && style.colorMap) {
        symbologyType = 'categorical';
        categoricalField = style.categoricalField;
        colorMap = style.colorMap;
    } else if (style.classification_field) {
        symbologyType = 'categorical';
        categoricalField = style.classification_field;
        if (style.categories) {
            colorMap = {};
            style.categories.forEach(cat => {
                colorMap[cat.value] = cat.color;
            });
        } else {
            colorMap = style.colorMap || {};
        }
    }
    
    return {
        fill_color: style.fill_color || style.fillColor || '#14b8a6',
        stroke_color: style.stroke_color || style.strokeColor || style.color || '#ffffff',
        stroke_width: style.stroke_weight || style.strokeWidth || style.weight || 2.0,
        fill_opacity: style.fill_opacity || style.fillOpacity || layerInfo.opacity || 0.7,
        stroke_opacity: style.stroke_opacity || style.strokeOpacity || 1.0,
        symbology_type: symbologyType,
        categorical_field: categoricalField,
        color_map: colorMap,
        point_size: style.point_size || 8.0,
        line_width: style.line_width || style.stroke_width || 2.0
    };
}

// Get visible layer data for legacy export (backward compatibility)
function getVisibleLayerData() {
    const visibleLayers = [];
    
    if (window.layers) {
        window.layers.forEach((layerInfo, layerId) => {
            if (layerInfo.layer && window.map.hasLayer(layerInfo.layer)) {
                visibleLayers.push({
                    id: layerId,
                    name: layerInfo.name,
                    type: layerInfo.type,
                    data: layerInfo.data,
                    style: layerInfo.style
                });
            }
        });
    }
    
    return visibleLayers;
}

// Close Map Composer
function closeMapComposer() {
    if (mapComposerWindow) {
        mapComposerWindow.classList.remove('show');
        
        setTimeout(() => {
            if (composerMap) {
                // Clean up event listeners
                composerMap.off();
                composerMap.remove();
                composerMap = null;
            }
            
            // Clear any pending sync timeouts
            if (window.composerSyncTimeout) {
                clearTimeout(window.composerSyncTimeout);
                window.composerSyncTimeout = null;
            }
            
            mapComposerWindow.remove();
            mapComposerWindow = null;
            composerCurrentExtent = null;
        }, 300);
    }
}

// Make functions globally available
window.initializePrintSystem = initializePrintSystem;
window.openMapComposer = openMapComposer;
window.closeMapComposer = closeMapComposer;
window.isTauriEnvironment = isTauriEnvironment;
window.synchronizeComposerLayers = synchronizeComposerLayers;

// Export functions for other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializePrintSystem,
        isTauriEnvironment,
        openMapComposer,
        closeMapComposer
    };
}