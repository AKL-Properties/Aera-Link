/**
 * Print Layout Module - Redesigned to match Leaflet-easyPrint demo workflow
 * 
 * This module provides a clean modal-based print interface that mirrors
 * the official Leaflet-easyPrint demo implementation.
 * 
 * @version 3.0.0
 * @author Aera WebGIS Team
 */

// Print layout variables
let printMap = null;
let mainMap = null;
let easyPrintPlugin = null;

/**
 * Initialize print layout system
 * @param {L.Map} map - Main Leaflet map instance
 */
function initPrintLayout(map) {
    console.log('🖨️ Initializing print layout system (demo-style)...');
    
    // Store reference to main map
    mainMap = map;
    
    // Check if leaflet-easyPrint is available
    if (typeof L.easyPrint === 'undefined') {
        console.error('❌ leaflet-easyPrint plugin not loaded. Please include the plugin.');
        showError('Print functionality requires leaflet-easyPrint plugin.', 'Plugin Missing');
        return false;
    }
    
    // Setup event listeners
    setupPrintEventListeners();
    
    console.log('✅ Print layout system initialized successfully');
    return true;
}



/**
 * Open the print modal and initialize the mini-map
 */
function openPrintModal() {
    console.log('🖨️ Opening print modal...');
    
    if (!mainMap) {
        console.error('❌ Main map not available');
        showError('Main map not available for printing.', 'Print Error');
        return;
    }
    
    // Show the modal
    const modal = document.getElementById('printModal');
    if (!modal) {
        console.error('❌ Print modal not found');
        return;
    }
    
    // Apply all necessary styling immediately
    modal.classList.remove('hidden');
    
    // Force proper display and layout classes immediately
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    
    // Ensure modal content has proper layout
    const modalContent = modal.querySelector('.w-full.h-full');
    if (modalContent) {
        modalContent.style.display = 'flex';
        modalContent.style.flexDirection = 'column';
        modalContent.style.height = '100%';
        modalContent.style.width = '100%';
    }
    
    // Ensure print map container is properly sized immediately
    const printMapContainer = document.getElementById('printMapContainer');
    if (printMapContainer) {
        printMapContainer.style.height = '400px';
        printMapContainer.style.width = '100%';
        printMapContainer.style.background = '#f0f0f0';
        printMapContainer.style.position = 'relative';
        printMapContainer.style.borderRadius = '8px';
        printMapContainer.style.overflow = 'hidden';
        printMapContainer.style.zIndex = '50004';
    }
    
    // Ensure all glass panels are properly styled
    const glassPanels = modal.querySelectorAll('.glass-panel');
    glassPanels.forEach(panel => {
        panel.style.position = 'relative';
        panel.style.zIndex = '50001';
    });
    
    // Ensure all form controls are properly styled and visible
    const formElements = modal.querySelectorAll('button, select, input');
    formElements.forEach(element => {
        element.style.position = 'relative';
        element.style.zIndex = '50007';
        element.style.visibility = 'visible';
        element.style.display = element.style.display || '';
    });
    
    // Ensure the modal's backdrop has proper styling
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.backdropFilter = 'blur(4px)';
    
    console.log('✅ Modal styling applied immediately');
    
    // Initialize the mini-map after a short delay to ensure DOM is ready
    setTimeout(() => {
        initializePrintMiniMap();
    }, 100);
}

/**
 * Close the print modal and cleanup
 */
function closePrintModal() {
    console.log('🔒 Closing print modal...');
    
    const modal = document.getElementById('printModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // Cleanup mini-map and easyPrint plugin
    if (printMap) {
        try {
            // Clear all layers first to prevent memory leaks
            clearExistingPrintMapLayers();
            
            if (easyPrintPlugin) {
                printMap.removeControl(easyPrintPlugin);
                easyPrintPlugin = null;
            }
            printMap.remove();
            printMap = null;
            
            console.log('✅ Print map cleaned up successfully');
        } catch (error) {
            console.warn('⚠️ Error cleaning up print map:', error);
        }
    }
}

/**
 * Initialize the mini-map inside the modal
 */
function initializePrintMiniMap() {
    console.log('🗺️ Initializing mini-map...');
    
    const container = document.getElementById('printMapContainer');
    if (!container) {
        console.error('❌ Print map container not found');
        showError('Print map container not found in modal.', 'Print Error');
        return;
    }
    
    // Clear any existing content
    container.innerHTML = '';
    
    // Ensure container has immediate proper styling
    container.style.height = '400px';
    container.style.width = '100%';
    container.style.background = '#f0f0f0';
    container.style.position = 'relative';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';
    container.style.zIndex = '50004';
    container.style.display = 'block';
    container.style.visibility = 'visible';
    
    try {
        // Ensure main map exists
        if (!mainMap) {
            console.error('❌ Main map not available for mini-map initialization');
            showError('Main map not available. Please ensure the map is loaded.', 'Print Error');
            return;
        }
        
        // Create mini-map with same view as main map
        printMap = L.map(container, {
            center: mainMap.getCenter(),
            zoom: mainMap.getZoom(),
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: true,
            dragging: true,
            doubleClickZoom: true
        });
        
        // Apply immediate styling to Leaflet container
        const leafletContainer = container.querySelector('.leaflet-container');
        if (leafletContainer) {
            leafletContainer.style.height = '100%';
            leafletContainer.style.width = '100%';
            leafletContainer.style.position = 'absolute';
            leafletContainer.style.top = '0';
            leafletContainer.style.left = '0';
            leafletContainer.style.zIndex = '50004';
        }
        
        // Add the same base layer as main map (inherit actual basemap)
        const activeBasemap = getCurrentActiveBasemap();
        let tileLayer = null;
        
        if (activeBasemap) {
            // Clone the basemap layer for the print map
            if (activeBasemap._url) {
                // Handle regular tile layers
                tileLayer = L.tileLayer(activeBasemap._url, {
                    attribution: activeBasemap.options.attribution || 'Map data © contributors',
                    maxZoom: activeBasemap.options.maxZoom || 18,
                    tileSize: activeBasemap.options.tileSize || 256,
                    subdomains: activeBasemap.options.subdomains
                });
            } else if (activeBasemap.options && activeBasemap.options.id) {
                // Handle ESRI basemap layers
                tileLayer = L.esri.basemapLayer(activeBasemap.options.id);
            } else {
                // Try to clone the layer directly
                try {
                    tileLayer = activeBasemap;
                } catch (error) {
                    console.warn('⚠️ Could not clone basemap, creating new instance');
                    tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                        attribution: 'Map data © Google',
                        maxZoom: 18
                    });
                }
            }
        } else {
            // Fallback basemap
            tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: 'Map data © Google',
                maxZoom: 18
            });
        }
        
        // Add basemap to print map
        if (tileLayer) {
            tileLayer.addTo(printMap);
            console.log('✅ Added basemap to mini-map');
        }
        
        // Add labels layer if it exists
        if (window.currentLabels) {
            try {
                let labelsLayer = null;
                if (window.currentLabels._url) {
                    labelsLayer = L.tileLayer(window.currentLabels._url, window.currentLabels.options);
                } else if (window.currentLabels.options && window.currentLabels.options.id) {
                    labelsLayer = L.esri.basemapLayer(window.currentLabels.options.id);
                } else {
                    labelsLayer = window.currentLabels;
                }
                
                if (labelsLayer) {
                    labelsLayer.addTo(printMap);
                    console.log('✅ Added labels layer to mini-map');
                }
            } catch (error) {
                console.warn('⚠️ Failed to add labels layer:', error);
            }
        }
        
        // Add all visible layers from main map (both from layer manager and direct map layers)
        // Clear any existing layers first to prevent duplication
        clearExistingPrintMapLayers();
        addLayersToMiniMap();
        addDirectMapLayersToMiniMap();
        
        // Initialize easyPrint plugin on mini-map (following demo pattern)
        setupEasyPrintPlugin(tileLayer);
        
        // Force immediate map resize and styling
        printMap.invalidateSize(true);
        
        // Apply final styling fixes after brief delay for Leaflet initialization
        setTimeout(() => {
            if (printMap) {
                // Ensure map container has proper dimensions
                const mapContainer = container.querySelector('.leaflet-container');
                if (mapContainer) {
                    mapContainer.style.height = '400px';
                    mapContainer.style.width = '100%';
                }
                
                // Final resize call
                printMap.invalidateSize(true);
                console.log('✅ Mini-map initialized and styled successfully');
            }
        }, 50);
        
    } catch (error) {
        console.error('❌ Failed to initialize mini-map:', error);
        showError('Failed to initialize map preview.', 'Print Error');
    }
}

/**
 * Get current active basemap from main map
 */
function getCurrentActiveBasemap() {
    // First try to get the basemap from the basemap manager
    if (window.currentBasemap) {
        console.log('📡 Using current basemap from basemap manager');
        return window.currentBasemap;
    }
    
    // Fallback: try to find basemap layer in main map layers
    if (mainMap && mainMap.eachLayer) {
        let foundBasemap = null;
        mainMap.eachLayer((layer) => {
            // Look for tile layers that are likely basemaps
            if (layer._url && (layer._url.includes('tile') || layer._url.includes('mapserver'))) {
                foundBasemap = layer;
            }
            // Also check for ESRI basemap layers
            if (layer.options && layer.options.id && layer.options.id.includes('esri')) {
                foundBasemap = layer;
            }
        });
        
        if (foundBasemap) {
            console.log('📡 Found basemap layer in main map:', foundBasemap._url || foundBasemap.options);
            return foundBasemap;
        }
    }
    
    // Final fallback: create default basemap
    console.warn('⚠️ No basemap found, using default Google Satellite');
    return window.basemaps ? window.basemaps['google-satellite'] : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Map data © contributors',
        maxZoom: 18
    });
}

/**
 * Clear existing layers from print map to prevent duplication
 */
function clearExistingPrintMapLayers() {
    if (!printMap) {
        console.log('ℹ️ No print map available for layer clearing');
        return;
    }
    
    console.log('🧹 Clearing existing layers from print map...');
    
    let removedCount = 0;
    const layersToRemove = [];
    
    // Collect layers to remove (avoid modifying collection while iterating)
    printMap.eachLayer((layer) => {
        // Skip basemap layers (tile layers and ESRI basemaps)
        if (layer._url || (layer.options && layer.options.id)) {
            return;
        }
        
        // Remove GeoJSON layers
        if (layer instanceof L.GeoJSON) {
            layersToRemove.push(layer);
        }
        
        // Remove vector layers (markers, polygons, etc.)
        else if (layer instanceof L.Marker || layer instanceof L.Circle || 
                 layer instanceof L.Polygon || layer instanceof L.Polyline) {
            layersToRemove.push(layer);
        }
    });
    
    // Remove collected layers
    layersToRemove.forEach(layer => {
        try {
            printMap.removeLayer(layer);
            removedCount++;
        } catch (error) {
            console.warn('⚠️ Error removing layer from print map:', error);
        }
    });
    
    console.log(`🧹 Removed ${removedCount} existing layers from print map`);
}

/**
 * Add all visible layers from main map to mini-map (from layer manager)
 */
function addLayersToMiniMap() {
    if (!window.layers || !window.layerOrder) {
        console.log('ℹ️ No custom layers to add to mini-map');
        return;
    }
    
    console.log('📍 Adding layers from layer manager to mini-map...');
    
    window.layerOrder.forEach((layerId) => {
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.data) {
            try {
                // Create layer style function
                let styleFunction = createLayerStyle(layerInfo);
                
                // Create the layer for mini-map
                const miniLayer = L.geoJSON(layerInfo.data, {
                    style: styleFunction,
                    onEachFeature: function(feature, layer) {
                        // No popups in mini-map to avoid interference
                    }
                }).addTo(printMap);
                
                // Ensure layer is on top
                miniLayer.bringToFront();
                
                console.log(`✅ Added layer "${layerInfo.name}" to mini-map`);
                
            } catch (error) {
                console.warn(`⚠️ Failed to add layer "${layerInfo.name}" to mini-map:`, error);
            }
        }
    });
}

/**
 * Add GeoJSON layers directly from main map to mini-map
 */
function addDirectMapLayersToMiniMap() {
    if (!mainMap) {
        console.log('ℹ️ No main map available for direct layer copying');
        return;
    }
    
    console.log('📍 Adding direct GeoJSON layers from main map to mini-map...');
    
    let layerCount = 0;
    mainMap.eachLayer((layer) => {
        try {
            // Skip basemap layers
            if (layer._url || (layer.options && layer.options.id)) {
                return;
            }
            
            // Copy GeoJSON layers
            if (layer instanceof L.GeoJSON && layer.toGeoJSON) {
                const geoJsonData = layer.toGeoJSON();
                const clonedLayer = L.geoJSON(geoJsonData, {
                    style: layer.options.style || function(feature) {
                        return layer.options || {
                            color: '#3388ff',
                            weight: 2,
                            opacity: 0.8,
                            fillColor: '#3388ff',
                            fillOpacity: 0.4
                        };
                    },
                    onEachFeature: function(feature, clonedFeature) {
                        // Copy styling but no popups in mini-map
                        if (layer.getStyle) {
                            try {
                                const originalStyle = layer.getStyle();
                                clonedFeature.setStyle(originalStyle);
                            } catch (e) {
                                // Ignore styling errors
                            }
                        }
                    }
                }).addTo(printMap);
                
                // Ensure layer is on top
                clonedLayer.bringToFront();
                layerCount++;
                
                console.log(`✅ Added direct GeoJSON layer to mini-map`);
            }
            
            // Copy other vector layers (markers, polygons, etc.)
            else if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polygon || layer instanceof L.Polyline) {
                try {
                    // Clone the layer
                    let clonedLayer = null;
                    
                    if (layer instanceof L.Marker) {
                        clonedLayer = L.marker(layer.getLatLng(), {
                            icon: layer.options.icon || L.divIcon()
                        });
                    } else if (layer instanceof L.Circle) {
                        clonedLayer = L.circle(layer.getLatLng(), {
                            radius: layer.getRadius(),
                            ...layer.options
                        });
                    } else if (layer instanceof L.Polygon) {
                        clonedLayer = L.polygon(layer.getLatLngs(), layer.options);
                    } else if (layer instanceof L.Polyline) {
                        clonedLayer = L.polyline(layer.getLatLngs(), layer.options);
                    }
                    
                    if (clonedLayer) {
                        clonedLayer.addTo(printMap);
                        clonedLayer.bringToFront();
                        layerCount++;
                        console.log(`✅ Added direct vector layer to mini-map`);
                    }
                } catch (error) {
                    console.warn('⚠️ Failed to clone vector layer:', error);
                }
            }
        } catch (error) {
            console.warn('⚠️ Error processing layer for mini-map:', error);
        }
    });
    
    console.log(`📍 Added ${layerCount} direct layers from main map to mini-map`);
}

/**
 * Create style function for a layer
 */
function createLayerStyle(layerInfo) {
    // Handle categorical symbology
    if (layerInfo.classification && layerInfo.classification.field) {
        const { field, colorMap, strokeColor, strokeWidth } = layerInfo.classification;
        
        return function(feature) {
            const value = feature.properties[field];
            const fillColor = colorMap[value] || '#999999';
            return {
                color: strokeColor || '#ffffff',
                fillColor: fillColor,
                weight: strokeWidth || 2,
                opacity: 1.0,
                fillOpacity: 0.7
            };
        };
    } 
    // Handle single symbol style
    else if (layerInfo.style && typeof layerInfo.style === 'object') {
        return function(feature) {
            return layerInfo.style;
        };
    } 
    // Default style
    else {
        return function(feature) {
            return {
                color: '#3388ff',
                weight: 2,
                opacity: 0.8,
                fillColor: '#3388ff',
                fillOpacity: 0.4
            };
        };
    }
}

/**
 * Setup easyPrint plugin on mini-map (following demo pattern exactly)
 */
function setupEasyPrintPlugin(tileLayer) {
    console.log('🖨️ Setting up easyPrint plugin...');
    
    try {
        // Ensure print map container has proper dimensions before setup
        const printMapContainer = document.getElementById('printMapContainer');
        if (!printMapContainer) {
            console.error('❌ Print map container not found for easyPrint setup');
            return;
        }
        
        // Get actual rendered dimensions using getBoundingClientRect with enhanced validation
        const containerRect = printMapContainer.getBoundingClientRect();
        let containerWidth = containerRect.width || 0;
        let containerHeight = containerRect.height || 0;
        
        // Fallback to computed styles if getBoundingClientRect fails
        if (!containerWidth || !containerHeight) {
            const computedStyle = window.getComputedStyle(printMapContainer);
            containerWidth = parseInt(computedStyle.width) || 600;
            containerHeight = parseInt(computedStyle.height) || 400;
        }
        
        // Ensure minimum dimensions to prevent undefined width/height errors
        containerWidth = Math.max(containerWidth, 300);
        containerHeight = Math.max(containerHeight, 200);
        
        console.log(`📐 Print container dimensions (validated): ${containerWidth}x${containerHeight}`);
        
        // Force container to have explicit dimensions
        printMapContainer.style.width = `${containerWidth}px`;
        printMapContainer.style.height = `${containerHeight}px`;
        
        // Configure easyPrint with high-resolution defaults - A4 Landscape @ 300 DPI
        easyPrintPlugin = L.easyPrint({
            tileLayer: tileLayer,
            sizeModes: ['A4Landscape', 'A4Portrait', 'A3Landscape', 'A3Portrait', 'Current'],
            defaultSizeTitles: {
                'A4Landscape': 'A4 Landscape (300 DPI)',
                'A4Portrait': 'A4 Portrait (300 DPI)', 
                'A3Landscape': 'A3 Landscape (300 DPI)',
                'A3Portrait': 'A3 Portrait (300 DPI)',
                'Current': 'Current View'
            },
            filename: 'AeraMap',
            exportOnly: true,
            hideControlContainer: true,
            // Clear hideClasses to prevent DOM access errors in modal context
            hideClasses: [],
            customWindowTitle: 'Aera Map Print',
            spinnerBgColor: '#0F172A',
            customSpinnerClass: 'epLoader',
            defaultExportFunction: 'download', // Default to download instead of popup
            // High resolution settings - CRITICAL for PNG export
            dpi: 300,
            tileWait: 1000, // Increased wait time for tile loading
            // A4 Landscape default with proper dimensions
            position: 'topleft',
            // Add dimension constraints to prevent undefined width/height errors
            mapWidth: containerWidth,
            mapHeight: containerHeight,
            // Event handlers with proper error handling - simplified for print only
            beforePrint: function(event) {
                console.log('🖨️ Before print event triggered');
                try {
                    // Only hide UI elements that would interfere with print output
                    hideModalUIForPrint();
                    
                    // Hide Leaflet controls in the print map container
                    const printMapContainer = document.getElementById('printMapContainer');
                    if (printMapContainer) {
                        // Hide zoom controls if they exist
                        const zoomControls = printMapContainer.querySelectorAll('.leaflet-control-zoom');
                        zoomControls.forEach(control => {
                            if (control && control.style) {
                                control.style.display = 'none';
                            }
                        });
                        
                        // Hide attribution if it exists
                        const attributions = printMapContainer.querySelectorAll('.leaflet-control-attribution');
                        attributions.forEach(attr => {
                            if (attr && attr.style) {
                                attr.style.display = 'none';
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Error in beforePrint handler:', error);
                }
            },
            afterPrint: function(event) {
                console.log('✅ After print event triggered');
                try {
                    // Restore UI elements after print
                    restoreModalUIAfterPrint();
                    
                    // Restore Leaflet controls in the print map container
                    const printMapContainer = document.getElementById('printMapContainer');
                    if (printMapContainer) {
                        // Restore zoom controls
                        const zoomControls = printMapContainer.querySelectorAll('.leaflet-control-zoom');
                        zoomControls.forEach(control => {
                            if (control && control.style) {
                                control.style.display = '';
                            }
                        });
                        
                        // Restore attribution
                        const attributions = printMapContainer.querySelectorAll('.leaflet-control-attribution');
                        attributions.forEach(attr => {
                            if (attr && attr.style) {
                                attr.style.display = '';
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Error in afterPrint handler:', error);
                }
            }
        });
        
        // Add to mini-map but keep hidden (no visible controls)
        easyPrintPlugin.addTo(printMap);
        
        console.log('✅ EasyPrint plugin configured with A4 Landscape @ 300 DPI default');
        
    } catch (error) {
        console.error('❌ Failed to setup easyPrint plugin:', error);
        if (typeof showError === 'function') {
            showError('Failed to setup print functionality.', 'Print Error');
        }
    }
}

/**
 * Execute manual print - the main action (following demo pattern exactly)
 */
async function executeManualPrint() {
    console.log('🖨️ Executing manual print...');
    
    // Verify print system is initialized
    if (!printMap) {
        console.error('❌ Print map not available');
        if (typeof showError === 'function') {
            showError('Print map not initialized. Please close and reopen the print modal.', 'Print Error');
        }
        return;
    }
    
    if (!easyPrintPlugin) {
        console.error('❌ EasyPrint plugin not available');
        if (typeof showError === 'function') {
            showError('Print plugin not loaded. Please close and reopen the print modal.', 'Print Error');
        }
        return;
    }
    
    try {
        // Get DOM elements with proper null checks
        const paperSizeElement = document.getElementById('printPaperSize');
        const formatElement = document.getElementById('printFormat');
        const filenameElement = document.getElementById('printFilename');
        const printBtn = document.getElementById('manualPrintBtn');
        
        // Get selected options with fallbacks
        const paperSize = paperSizeElement?.value || 'A4Landscape';
        const format = formatElement?.value || 'download';
        const filename = filenameElement?.value || 'AeraMap';
        
        console.log(`🖨️ Print settings: ${paperSize}, ${format}, filename: ${filename}`);
        
        // Ensure print map has proper dimensions before printing
        const printMapContainer = document.getElementById('printMapContainer');
        if (!printMapContainer) {
            console.error('❌ Print map container not found');
            if (typeof showError === 'function') {
                showError('Print map container not found.', 'Print Error');
            }
            return;
        }
        
        // Get actual rendered dimensions to prevent undefined width/height errors
        const containerRect = printMapContainer.getBoundingClientRect();
        let containerWidth = containerRect.width || 0;
        let containerHeight = containerRect.height || 0;
        
        // Enhanced validation with fallbacks
        if (!containerWidth || !containerHeight || containerWidth < 100 || containerHeight < 100) {
            console.warn('⚠️ Invalid container dimensions detected, applying fixes...');
            
            // Force explicit dimensions
            printMapContainer.style.width = '600px';
            printMapContainer.style.height = '400px';
            printMapContainer.style.display = 'block';
            printMapContainer.style.position = 'relative';
            
            // Wait for DOM update and remeasure
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const newRect = printMapContainer.getBoundingClientRect();
            containerWidth = newRect.width || 600;
            containerHeight = newRect.height || 400;
        }
        
        // Ensure minimum valid dimensions
        containerWidth = Math.max(containerWidth, 300);
        containerHeight = Math.max(containerHeight, 200);
        
        console.log(`📐 Container dimensions for print (validated): ${containerWidth}x${containerHeight}`);
        
        // Validate that the print map exists and has proper size
        if (!printMap || !printMap.getContainer()) {
            console.error('❌ Print map or container is invalid');
            if (typeof showError === 'function') {
                showError('Print map is not properly initialized.', 'Print Error');
            }
            return;
        }
        
        // Force map container to match print container dimensions
        const leafletContainer = printMap.getContainer();
        if (leafletContainer) {
            leafletContainer.style.width = `${containerWidth}px`;
            leafletContainer.style.height = `${containerHeight}px`;
        }
        
        // Force map resize to ensure proper dimensions
        if (printMap) {
            printMap.invalidateSize(true);
            // Wait a moment for resize to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Final validation: ensure map size is properly set
            const mapSize = printMap.getSize();
            if (!mapSize || mapSize.x <= 0 || mapSize.y <= 0) {
                console.warn('⚠️ Invalid map size detected, forcing resize...');
                // Force resize with explicit dimensions
                printMap.getContainer().style.width = `${containerWidth}px`;
                printMap.getContainer().style.height = `${containerHeight}px`;
                printMap.invalidateSize(true);
                // Additional wait for resize
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            console.log(`📐 Final map size validation: ${printMap.getSize().x}x${printMap.getSize().y}`);
        }
        
        // Update plugin options with validated dimensions
        if (easyPrintPlugin && easyPrintPlugin.options) {
            easyPrintPlugin.options.filename = filename;
            // Ensure plugin has proper dimension references
            easyPrintPlugin.options.mapWidth = containerWidth;
            easyPrintPlugin.options.mapHeight = containerHeight;
        }
        
        // Show loading state with proper null check
        if (printBtn) {
            printBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Printing...</span>';
            printBtn.disabled = true;
        } else {
            console.warn('⚠️ Print button not found - cannot show loading state');
        }
        
        // Execute print using the exact demo method with enhanced error handling
        try {
            // Pre-flight check: ensure all necessary objects exist
            if (!easyPrintPlugin._map || !easyPrintPlugin._map.getContainer()) {
                throw new Error('Print map container is not properly initialized');
            }
            
            const mapContainer = easyPrintPlugin._map.getContainer();
            const containerRect = mapContainer.getBoundingClientRect();
            
            if (!containerRect.width || !containerRect.height) {
                throw new Error('Map container has invalid dimensions (width or height is 0)');
            }
            
            console.log(`📋 Pre-flight check passed: container ${containerRect.width}x${containerRect.height}`);
            
            if (format === 'download') {
                // For PNG download - matches demo exactly with enhanced logging
                console.log('📥 Starting high-resolution PNG download export...');
                console.log(`📝 Print parameters: size=${paperSize}, filename=${filename}, dpi=300`);
                
                // Call printMap with proper parameters
                const result = easyPrintPlugin.printMap(paperSize, filename);
                console.log('🔄 Print command executed, result:', result);
                
            } else {
                // For print dialog - matches demo exactly  
                console.log('🖨️ Opening print dialog...');
                const result = easyPrintPlugin.printMap(paperSize);
                console.log('🔄 Print dialog command executed, result:', result);
            }
        } catch (printError) {
            console.error('❌ Error during print execution:', printError);
            
            // Handle specific width/height errors
            if (printError.message && printError.message.includes('width')) {
                throw new Error(`Print failed due to invalid dimensions. Please close and reopen the print modal. Details: ${printError.message}`);
            } else {
                throw new Error(`Print execution failed: ${printError.message}`);
            }
        }
        
        // Reset button and restore UI after delay
        setTimeout(() => {
            // Reset button state
            if (printBtn) {
                printBtn.innerHTML = '<i class="fas fa-print"></i> <span>Manual Print</span>';
                printBtn.disabled = false;
            }
            
            // Show success and close modal
            if (typeof showSuccess === 'function') {
                showSuccess('Map export completed successfully!', 'Print Complete');
            } else {
                console.log('✅ Map export completed successfully!');
            }
            closePrintModal();
            
        }, 2000);
        
    } catch (error) {
        console.error('❌ Print execution failed:', error);
        
        // Show error message
        if (typeof showError === 'function') {
            showError('Print execution failed. Please try again.', 'Print Error');
        } else {
            console.error('Print execution failed:', error.message);
        }
        
        // Reset button state
        const printBtn = document.getElementById('manualPrintBtn');
        if (printBtn) {
            printBtn.innerHTML = '<i class="fas fa-print"></i> <span>Manual Print</span>';
            printBtn.disabled = false;
        }
    }
}

/**
 * Hide modal UI elements during print to avoid interference
 */
function hideModalUIForPrint() {
    console.log('🙈 Hiding UI elements for print...');
    
    // List of UI elements to hide during print - updated with proper null checks
    const elementsToHide = [
        // Print modal header and controls (but not the map container)
        '#printModal .glass-panel:not(#printMapContainer *)',
        // Main map controls
        '.leaflet-control-container',
        '.leaflet-control-zoom', 
        '.leaflet-control-attribution',
        // Floating elements
        '#floatingStatisticsContainer',
        '.custom-context-menu',
        '.confirm-modal-overlay',
        // Sidebar and other UI elements
        '#sidebar',
        '.header-container'
    ];
    
    elementsToHide.forEach(selector => {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
                elements.forEach(el => {
                    if (el && el.style) {
                        // Store original display value
                        const originalDisplay = el.style.display || getComputedStyle(el).display;
                        el.setAttribute('data-original-display', originalDisplay);
                        el.style.display = 'none';
                        el.setAttribute('data-hidden-for-print', 'true');
                    }
                });
                console.log(`Hidden ${elements.length} elements matching "${selector}"`);
            } else {
                console.warn(`No elements found for selector: "${selector}"`);
            }
        } catch (error) {
            console.warn(`Error hiding elements with selector "${selector}":`, error);
        }
    });
}

/**
 * Restore modal UI elements after print
 */
function restoreModalUIAfterPrint() {
    console.log('👁️ Restoring UI elements after print...');
    
    try {
        // Restore all elements that were hidden for print
        const hiddenElements = document.querySelectorAll('[data-hidden-for-print="true"]');
        if (hiddenElements && hiddenElements.length > 0) {
            hiddenElements.forEach(el => {
                if (el && el.style) {
                    // Restore original display value
                    const originalDisplay = el.getAttribute('data-original-display');
                    if (originalDisplay && originalDisplay !== 'none') {
                        el.style.display = originalDisplay;
                    } else {
                        el.style.display = '';
                    }
                    el.removeAttribute('data-hidden-for-print');
                    el.removeAttribute('data-original-display');
                }
            });
            console.log(`Restored ${hiddenElements.length} UI elements after print`);
        } else {
            console.log('No hidden elements found to restore');
        }
    } catch (error) {
        console.error('Error restoring UI elements after print:', error);
    }
}

/**
 * Setup print event listeners
 */
function setupPrintEventListeners() {
    console.log('🔗 Setting up print event listeners...');
    
    // Print button in sidebar - correct selector
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', openPrintModal);
        console.log('✅ Print button listener added');
    } else {
        console.warn('⚠️ Print button not found - looking for #printBtn');
    }
    
    // Close modal button
    const closeBtn = document.getElementById('closePrintModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closePrintModal);
    }
    
    // Cancel button 
    const cancelBtn = document.getElementById('cancelPrint');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePrintModal);
    }
    
    // Manual print button in modal
    const manualPrintBtn = document.getElementById('manualPrintBtn');
    if (manualPrintBtn) {
        manualPrintBtn.addEventListener('click', executeManualPrint);
        console.log('✅ Manual print button listener added');
    } else {
        console.warn('⚠️ Manual print button not found - looking for #manualPrintBtn');
    }
    
    // Paper size change
    const paperSizeSelect = document.getElementById('printPaperSize');
    if (paperSizeSelect) {
        paperSizeSelect.addEventListener('change', () => {
            console.log('📄 Paper size changed to:', paperSizeSelect.value);
        });
    }
}

// Export functions globally
window.initPrintLayout = initPrintLayout;
window.openPrintModal = openPrintModal;
window.closePrintModal = closePrintModal;
window.executeManualPrint = executeManualPrint;
window.setupPrintEventListeners = setupPrintEventListeners;

console.log('✅ Print Layout Module - Demo-style implementation loaded');
