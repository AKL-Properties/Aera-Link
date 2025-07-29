/**
 * Basemap Manager Module
 * Handles all basemap switching logic, provider configurations, and UI interactions
 */

// Basemap variables
let currentBasemap = null;
let basemaps = {};
let currentLabels = null;
let previewBasemap = null;
let previewLabels = null;
let originalBasemap = null;
let originalLabels = null;

// Initialize basemap definitions
function initializeBasemaps() {
    basemaps = {
        // OSM Basemaps (with CORS support for export)
        'osm-no-labels': L.tileLayer('https://tile.openstreetmap.bzh/ca/{z}/{x}/{y}.png', {
            maxZoom: 19,
            crossOrigin: 'anonymous',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles courtesy of <a href="https://www.openstreetmap.cat" target="_blank">Breton OpenStreetMap Team</a>'
        }),
        'osm-standard': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenStreetMap Labels',
            maxZoom: 19,
            crossOrigin: 'anonymous'
        }),
        'osm-hot': L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            maxZoom: 19,
            crossOrigin: 'anonymous',
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OpenStreetMap Team</a> hosted by <a href="https://openstreetmap.fr/" target="_blank">OpenStreetMap France</a>'
        }),
        'osm-opnv': L.tileLayer('https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', {
            maxZoom: 18,
            crossOrigin: 'anonymous',
            attribution: 'Map <a href="https://memomaps.de/">memomaps.de</a> <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        'osm-dark': L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),
        'osm-satellite': L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg', {
            minZoom: 0,
            maxZoom: 20,
            attribution: '&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }),

        // ESRI Basemaps
        'esri-world-imagery': L.esri.basemapLayer('Imagery'),
        'esri-imagery-labels': L.esri.basemapLayer('ImageryLabels'),
        'esri-streets': L.esri.basemapLayer('Streets'),
        'esri-topo': L.esri.basemapLayer('Topographic'),

        // Google Basemaps
        'google-satellite': L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0','mt1','mt2','mt3'],
            attribution: 'Google Satellite'
        }),
        'google-labels': L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0','mt1','mt2','mt3'],
            attribution: 'Google Labels'
        }),
        'google-hybrid': L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0','mt1','mt2','mt3'],
            attribution: 'Google Hybrid'
        }),
        'google-terrain': L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0','mt1','mt2','mt3'],
            attribution: 'Google Terrain'
        }),

        // Bing Basemaps 
        'bing-aerial': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, © Microsoft',
            maxZoom: 19
        }),
        'bing-aerial-labels': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, © Microsoft - Labels',
            maxZoom: 19
        }),
        'bing-road': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, © Microsoft',
            maxZoom: 19
        }),

        // CARTO Basemaps
        'carto-positron': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),
        'carto-positron-labels': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),
        'carto-dark-matter': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),
        'carto-dark-matter-labels': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),
        'carto-voyager': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),
        'carto-voyager-labels': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}.png', {
            attribution: '© CARTO, © OpenStreetMap',
            maxZoom: 19,
            subdomains: 'abcd'
        }),

        // Waze Basemap (using approximation since Waze doesn't provide public tiles)
        'waze': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'Waze Style (OSM)',
            maxZoom: 19
        }),

        // Thunderforest Basemaps
        'thunderforest-cycle': L.tileLayer('https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        'thunderforest-dark': L.tileLayer('https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        'thunderforest-diablo': L.tileLayer('https://{s}.tile.thunderforest.com/spinal-map/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        'thunderforest-outdoor': L.tileLayer('https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        'thunderforest-old': L.tileLayer('https://{s}.tile.thunderforest.com/pioneer/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),
        'thunderforest-neighborhood': L.tileLayer('https://{s}.tile.thunderforest.com/neighbourhood/{z}/{x}/{y}{r}.png?apikey=f5e725f7a49444eb8a9941f5a2fc6351', {
            attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 22
        }),

        // Maptiler Basemaps
        'maptiler-aquarelle': L.tileLayer('https://api.maptiler.com/maps/aquarelle/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        }),
        'maptiler-backdrop': L.tileLayer('https://api.maptiler.com/maps/backdrop/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        }),
        'maptiler-topography': L.tileLayer('https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        }),
        'maptiler-winter': L.tileLayer('https://api.maptiler.com/maps/winter/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        }),
        'maptiler-openstreet-no-labels': L.tileLayer('https://api.maptiler.com/maps/0198323e-3089-7276-a811-4cd52a9474a6/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        }),
        'maptiler-openstreet-labels': L.tileLayer('https://api.maptiler.com/maps/openstreetmap/{z}/{x}/{y}.png?key=bbKm0mAybeaIXWDXmQka', {
            attribution: '&copy; <a href="https://www.maptiler.com/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 20
        })
    };
}

function switchBasemap(basemapKey) {
    console.log(`Attempting to switch to basemap: ${basemapKey}`);
    
    // Remove current basemap
    if (currentBasemap) {
        map.removeLayer(currentBasemap);
    }
    
    // Remove current labels
    if (currentLabels) {
        map.removeLayer(currentLabels);
        currentLabels = null;
    }
    
    // Verify basemap exists
    if (!basemaps[basemapKey]) {
        console.error(`Basemap '${basemapKey}' not found in basemaps object`);
        console.log('Available basemaps:', Object.keys(basemaps));
        return;
    }
    
    // Add new basemap
    currentBasemap = basemaps[basemapKey];
    map.addLayer(currentBasemap);
    
    // Send basemap to back so it doesn't cover other layers
    currentBasemap.bringToBack();
    
    // Force map to re-render tiles
    setTimeout(() => {
        map.invalidateSize();
        map.getContainer().focus(); // Ensure map has focus for proper rendering
    }, 100);
    
    console.log(`Successfully switched basemap to: ${basemapKey}`);
}

function toggleLabels(show, layerName) {
    console.log(`Toggling labels - show: ${show}, layer: ${layerName}`);
    
    // Remove existing labels
    if (currentLabels) {
        map.removeLayer(currentLabels);
        currentLabels = null;
    }
    
    // Add new labels if requested
    if (show && layerName && basemaps[layerName]) {
        currentLabels = basemaps[layerName];
        map.addLayer(currentLabels);
        console.log(`Added labels: ${layerName}`);
        
        // Force map to re-render
        setTimeout(() => {
            map.invalidateSize();
        }, 50);
    }
}

function previewBasemapOnHover(basemapKey, labelKey = null) {
    console.log(`Previewing basemap: ${basemapKey}, labels: ${labelKey}`);
    
    // Store original state if this is the first preview
    if (!originalBasemap) {
        originalBasemap = currentBasemap;
        originalLabels = currentLabels;
    }
    
    // Remove current preview layers
    if (previewBasemap) {
        map.removeLayer(previewBasemap);
        previewBasemap = null;
    }
    if (previewLabels) {
        map.removeLayer(previewLabels);
        previewLabels = null;
    }
    
    // Remove current basemap and labels temporarily for preview
    if (currentBasemap) {
        map.removeLayer(currentBasemap);
    }
    if (currentLabels) {
        map.removeLayer(currentLabels);
    }
    
    // Add preview basemap
    if (basemaps[basemapKey]) {
        previewBasemap = basemaps[basemapKey];
        map.addLayer(previewBasemap);
        previewBasemap.bringToBack();
        
        // Add preview labels if specified
        if (labelKey && basemaps[labelKey]) {
            previewLabels = basemaps[labelKey];
            map.addLayer(previewLabels);
        }
        
        // Force map to re-render preview
        setTimeout(() => {
            map.invalidateSize();
        }, 50);
    } else {
        console.error(`Preview basemap '${basemapKey}' not found`);
    }
}

function revertToOriginalBasemap() {
    // Only revert if we have an original to revert to
    if (!originalBasemap) {
        return;
    }
    
    // Remove preview layers
    if (previewBasemap) {
        map.removeLayer(previewBasemap);
        previewBasemap = null;
    }
    if (previewLabels) {
        map.removeLayer(previewLabels);
        previewLabels = null;
    }
    
    // Restore original basemap
    if (originalBasemap) {
        // Remove current basemap first
        if (currentBasemap && currentBasemap !== originalBasemap) {
            map.removeLayer(currentBasemap);
        }
        
        map.addLayer(originalBasemap);
        originalBasemap.bringToBack();
        currentBasemap = originalBasemap;
        originalBasemap = null;
    }
    
    // Restore original labels
    if (originalLabels) {
        // Remove current labels first
        if (currentLabels && currentLabels !== originalLabels) {
            map.removeLayer(currentLabels);
        }
        
        map.addLayer(originalLabels);
        currentLabels = originalLabels;
        originalLabels = null;
    }
    
    // Force map to re-render
    setTimeout(() => {
        map.invalidateSize();
    }, 50);
}

function setupMapContextMenu() {
    console.log('🖱️ Setting up enhanced map context menu for basemap switching...');
    
    // Remove any existing context menu handlers to prevent conflicts
    map.off('contextmenu');
    
    map.on('contextmenu', function(e) {
        console.log('🖱️ Right-click detected at:', e.latlng);
        
        // Prevent default browser context menu
        e.originalEvent.preventDefault();
        e.originalEvent.stopPropagation();
        
        // Check if the click was on a feature or empty map (with relaxed detection)
        const clickedOnFeature = isClickOnFeature(e);
        console.log('🎯 Clicked on feature:', clickedOnFeature);
        
        // Show context menu for all right-clicks on empty areas
        // Even if near features, allow context menu if not directly on them
        if (!clickedOnFeature) {
            console.log('📍 Showing basemap context menu');
            showMapContextMenu(e.containerPoint);
        } else {
            console.log('📍 Showing basemap context menu (override - user preference)');
            // Always show basemap menu unless explicitly on a popup
            showMapContextMenu(e.containerPoint);
        }
    });

    // Add event listeners for basemap menu items with hover preview
    const basemapOptions = document.querySelectorAll('.basemap-option');
    basemapOptions.forEach(option => {
        // Hover preview functionality
        option.addEventListener('mouseenter', function(e) {
            const basemapKey = this.getAttribute('data-basemap');
            if (basemapKey && basemaps[basemapKey]) {
                // Store original state before preview
                originalBasemap = currentBasemap;
                originalLabels = currentLabels;
                
                // Check if this satellite option has labels
                const labelCheckbox = this.querySelector('.label-checkbox');
                const labelsKey = labelCheckbox ? labelCheckbox.getAttribute('data-labels') : null;
                const showLabels = labelCheckbox ? labelCheckbox.checked : false;
                
                previewBasemapOnHover(basemapKey, showLabels ? labelsKey : null);
            }
        });
        
        option.addEventListener('mouseleave', function(e) {
            // Only revert if we're still leaving and not entering another option
            setTimeout(() => {
                if (!document.querySelector('.basemap-option:hover')) {
                    revertToOriginalBasemap();
                }
            }, 50);
        });
        
        // Click to permanently switch basemap
        option.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const basemapKey = this.getAttribute('data-basemap');
            
            // Check if this is a satellite option with labels
            const labelCheckbox = this.querySelector('.label-checkbox');
            
            if (labelCheckbox) {
                const labelsKey = labelCheckbox.getAttribute('data-labels');
                const showLabels = labelCheckbox.checked;
                
                switchBasemap(basemapKey);
                if (showLabels) {
                    toggleLabels(true, labelsKey);
                } else {
                    toggleLabels(false);
                }
            } else {
                switchBasemap(basemapKey);
                toggleLabels(false); // Clear any existing labels
            }
            
            // Clear preview state
            originalBasemap = null;
            originalLabels = null;
            
            // Close context menu
            hideMapContextMenu();
        });
    });
    
    // Handle label checkbox clicks separately to prevent basemap switching
    const labelCheckboxes = document.querySelectorAll('.label-checkbox');
    labelCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering the basemap option click
            
            const labelsKey = this.getAttribute('data-labels');
            const showLabels = this.checked;
            
            // Apply labels immediately during preview
            if (showLabels) {
                toggleLabels(true, labelsKey);
            } else {
                toggleLabels(false);
            }
        });
    });

    // Hide context menu when clicking elsewhere (but don't interfere with layer context menus)
    document.addEventListener('click', function(e) {
        const mapContextMenu = e.target ? e.target.closest('#mapContextMenu') : null;
        const layerContextMenu = e.target ? e.target.closest('#layerContextMenu') : null;
        
        // Only hide map context menu if not clicking on any context menu
        if (!mapContextMenu && !layerContextMenu) {
            hideMapContextMenu();
            revertToOriginalBasemap();
        }
    });

    // Hide context menu on map click
    // Popup logic now handled in interaction-handlers.js
}

function isClickOnFeature(e) {
    // More conservative feature detection - only block context menu for direct feature hits
    let hasFeature = false;
    
    try {
        // Check if there's an active popup (user is interacting with a feature)
        if (map._popup && map._popup.isOpen()) {
            console.log('💬 Popup is open, treating as feature click');
            return true;
        }
        
        // Use a more precise feature detection method with smaller tolerance
        if (window.layers && window.layers.size > 0) {
            const tolerance = 10; // Reduced tolerance in meters
            
            window.layers.forEach((layerInfo, layerId) => {
                if (layerInfo.visible && layerInfo.layer && !hasFeature) {
                    try {
                        layerInfo.layer.eachLayer(function(featureLayer) {
                            if (hasFeature) return; // Short circuit if already found
                            
                            if (featureLayer.getLatLng) {
                                // Point feature - check precise distance
                                const distance = map.distance(e.latlng, featureLayer.getLatLng());
                                if (distance < tolerance) {
                                    hasFeature = true;
                                    console.log(`🎯 Direct hit on point feature in layer: ${layerInfo.name}`);
                                }
                            } else if (featureLayer.getBounds) {
                                // Polygon/line feature - check if click is inside bounds
                                const bounds = featureLayer.getBounds();
                                if (bounds.contains(e.latlng)) {
                                    // Additional check: is it really close to the geometry?
                                    const center = bounds.getCenter();
                                    const distance = map.distance(e.latlng, center);
                                    const maxDistance = Math.max(bounds.getNorth() - bounds.getSouth(), 
                                                               bounds.getEast() - bounds.getWest()) * 111000 / 4; // Convert to meters
                                    
                                    if (distance < maxDistance) {
                                        hasFeature = true;
                                        console.log(`🎯 Direct hit on polygon/line feature in layer: ${layerInfo.name}`);
                                    }
                                }
                            }
                        });
                    } catch (error) {
                        console.warn('Error checking feature at click point:', error);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error in feature detection:', error);
        // If error occurs, allow context menu
        hasFeature = false;
    }
    
    return hasFeature;
}

function showMapContextMenu(containerPoint) {
    const contextMenu = document.getElementById('mapContextMenu');
    
    if (!contextMenu) {
        console.error('❌ Map context menu element not found! Check if #mapContextMenu exists in HTML.');
        return;
    }
    
    console.log(`📍 Positioning enhanced context menu at (${containerPoint.x}, ${containerPoint.y})`);
    
    // Hide any existing context menus first
    hideMapContextMenu();
    
    // Position the context menu at cursor location with better positioning
    contextMenu.style.display = 'block';
    contextMenu.style.position = 'fixed';
    contextMenu.style.zIndex = '10000';
    contextMenu.style.left = containerPoint.x + 'px';
    contextMenu.style.top = containerPoint.y + 'px';
    
    // Force a reflow to get accurate dimensions
    contextMenu.offsetHeight;
    
    // Ensure menu stays within viewport with better calculations
    const rect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10; // Padding from viewport edges
    
    let adjustedX = containerPoint.x;
    let adjustedY = containerPoint.y;
    
    if (rect.right > viewportWidth - padding) {
        adjustedX = containerPoint.x - rect.width;
        if (adjustedX < padding) {
            adjustedX = padding;
        }
        console.log('↔️ Adjusted menu position to stay within viewport (horizontal)');
    }
    
    if (rect.bottom > viewportHeight - padding) {
        adjustedY = containerPoint.y - rect.height;
        if (adjustedY < padding) {
            adjustedY = padding;
        }
        console.log('↕️ Adjusted menu position to stay within viewport (vertical)');
    }
    
    contextMenu.style.left = adjustedX + 'px';
    contextMenu.style.top = adjustedY + 'px';
    
    // Add animation class for smooth appearance
    contextMenu.classList.add('context-menu-active');
    
    console.log('✅ Enhanced context menu is now visible and positioned correctly');
}

function hideMapContextMenu() {
    const contextMenu = document.getElementById('mapContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
        contextMenu.classList.remove('context-menu-active');
        console.log('🙈 Enhanced context menu hidden');
    }
}

// Initialize basemap system for given map instance
function initBasemaps(mapInstance) {
    if (!mapInstance) {
        console.error('Map instance is required for basemap initialization');
        return;
    }
    
    console.log('🗺️ Initializing basemap system...');
    
    // Set global map reference
    window.map = mapInstance;
    
    // Initialize basemap definitions
    initializeBasemaps();
    console.log(`Loaded ${Object.keys(basemaps).length} basemap providers`);
    
    // Set initial basemap to Google Satellite (no labels) as default
    currentBasemap = basemaps['carto-dark-matter'];
    currentBasemap.addTo(mapInstance);
    console.log('🛰️ Set default basemap to Google Satellite');
    
    // Setup map context menu for basemap switching
    setupMapContextMenu();
    
    // Verify context menu exists
    const contextMenu = document.getElementById('mapContextMenu');
    if (contextMenu) {
        console.log('Basemap context menu found and ready');
    } else {
        console.error('Context menu element #mapContextMenu not found in DOM');
    }
    
    console.log('Basemap system initialization complete');
}

// Export functions to global scope for compatibility
window.initBasemaps = initBasemaps;
window.initializeBasemaps = initializeBasemaps;
window.switchBasemap = switchBasemap;
window.toggleLabels = toggleLabels;
window.previewBasemapOnHover = previewBasemapOnHover;
window.revertToOriginalBasemap = revertToOriginalBasemap;
window.setupMapContextMenu = setupMapContextMenu;
window.isClickOnFeature = isClickOnFeature;
window.showMapContextMenu = showMapContextMenu;
window.hideMapContextMenu = hideMapContextMenu;

// Also export basemap-related global variables for compatibility
window.currentBasemap = currentBasemap;
window.basemaps = basemaps;
window.currentLabels = currentLabels;
window.previewBasemap = previewBasemap;
window.previewLabels = previewLabels;
window.originalBasemap = originalBasemap;
window.originalLabels = originalLabels;
