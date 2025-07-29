// Print Layout Module

// Initialize print layout functionality
document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    const printBtn = document.getElementById('printLayoutBtn');
    if (printBtn) {
        printBtn.addEventListener('click', enterPrintMode);
    }
    
    // Handle ESC key to exit print mode
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('print-mode')) {
            exitPrintMode();
        }
    });
});

// Enter print mode
function enterPrintMode() {
    try {
        console.log('Entering print mode...');
        
        // Verify required elements exist
        const printControls = document.querySelector('.print-controls');
        if (!printControls) {
            throw new Error('Print controls not found in DOM');
        }
        
        if (!window.map) {
            throw new Error('Map instance not found');
        }
        
        // Store current map state
        window.prePrintState = {
            zoom: window.map.getZoom(),
            center: window.map.getCenter(),
            bounds: window.map.getBounds()
        };
        
        // Add print mode class to body
        document.body.classList.add('print-mode');
        
        // Show print controls
        printControls.style.display = 'flex';
        
        // Force map to update its size
        window.map.invalidateSize({ animate: false });
        
        // Restore exact view
        window.map.setView(window.prePrintState.center, window.prePrintState.zoom, { animate: false });
        window.map.fitBounds(window.prePrintState.bounds, { animate: false });
        
        console.log('Entered print mode successfully');
        
    } catch (error) {
        console.error('Failed to enter print mode:', error);
        showError('Failed to enter print mode. Please try again.');
        exitPrintMode();
    }
}

// Exit print mode
function exitPrintMode() {
    try {
        console.log('Exiting print mode...');
        
        // Remove print mode class
        document.body.classList.remove('print-mode');
        
        // Hide print controls if they exist
        const printControls = document.querySelector('.print-controls');
        if (printControls) {
            printControls.style.display = 'none';
        }
        
        // Update map if it exists
        if (window.map) {
            // Force map to update its size
            window.map.invalidateSize({ animate: false });
            
            // Restore pre-print state if available
            if (window.prePrintState) {
                window.map.setView(window.prePrintState.center, window.prePrintState.zoom, { animate: false });
                window.map.fitBounds(window.prePrintState.bounds, { animate: false });
                delete window.prePrintState;
            }
        }
        
        console.log('Exited print mode successfully');
        
    } catch (error) {
        console.error('Error exiting print mode:', error);
    }
}

// Export map as PNG using improved canvas rendering
async function triggerExport() {
    const exportBtn = document.querySelector('.print-now');
    const qualitySelect = document.getElementById('exportQuality');
    
    if (!exportBtn || !qualitySelect) {
        showError('Export controls not found');
        return;
    }
    
    try {
        // Disable button and show loading state  
        exportBtn.disabled = true;
        const buttonText = exportBtn.querySelector('.button-text');
        buttonText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        
        console.log('🖨️ Starting map export process...');
        
        // Pre-check for potential CORS issues
        const corsWarning = await checkForCorsIssues();
        if (corsWarning) {
            const proceed = await showConfirm(
                `${corsWarning}\n\nDo you want to continue with export? (Some tiles may not appear in the exported image)`,
                'Export Warning'
            );
            if (!proceed) {
                return;
            }
        }
        
        // Get selected quality
        const scale = parseInt(qualitySelect.value) || 2;
        console.log(`📐 Export scale: ${scale}x`);
        
        // Hide controls for capture
        exportBtn.style.visibility = 'hidden';
        qualitySelect.style.visibility = 'hidden';
        
        // Force final map update and wait for tiles to load
        window.map.invalidateSize({ animate: false });
        console.log('🗺️ Updated map size for export');
        
        // Wait longer for all tiles and layers to fully load
        await waitForMapToLoad();
        
        // Generate timestamp for filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `AeraLink_Map_Export_${timestamp}.png`;
        
        // Try multiple export methods with CORS handling
        let canvas;
        try {
            console.log('🎯 Attempting canvas composition method...');
            canvas = await exportMapWithCanvasComposition(scale);
            console.log('✅ Canvas composition method successful');
        } catch (canvasError) {
            console.warn('⚠️ Canvas composition failed (likely CORS), trying html2canvas:', canvasError);
            try {
                canvas = await exportMapWithHtml2Canvas(scale);
                console.log('✅ html2canvas method successful');
            } catch (html2canvasError) {
                console.warn('⚠️ html2canvas failed, trying screenshot-based method:', html2canvasError);
                canvas = await exportMapWithScreenshotMethod(scale);
                console.log('✅ Screenshot method successful');
            }
        }
        
        if (!canvas) {
            throw new Error('Failed to generate map canvas');
        }
        
        // Convert to blob and save with CORS handling
        try {
            canvas.toBlob(blob => {
                if (!blob) {
                    throw new Error('Failed to create image blob');
                }
                
                // Use FileSaver.js if available, otherwise fallback to manual download
                if (typeof saveAs === 'function') {
                    saveAs(blob, filename);
                } else {
                    // Manual download fallback
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }
                
                showSuccess(`Map exported successfully as ${filename}!`);
                console.log(`🎉 Export completed: ${filename}`);
            }, 'image/png', 0.95);
        } catch (corsError) {
            console.warn('⚠️ Canvas is tainted due to CORS, trying alternative export method...');
            // Fallback to data URL method
            try {
                const dataURL = canvas.toDataURL('image/png', 0.95);
                const link = document.createElement('a');
                link.href = dataURL;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                showSuccess(`Map exported successfully as ${filename} (CORS fallback)!`);
                console.log(`🎉 Export completed with CORS fallback: ${filename}`);
            } catch (dataUrlError) {
                console.error('❌ Both blob and data URL export failed:', dataUrlError);
                throw new Error('Cannot export map due to CORS restrictions. This can happen with certain basemap providers. Try switching to OpenStreetMap basemaps or contact support for alternative export options.');
            }
        }
        
    } catch (error) {
        console.error('❌ Export error:', error);
        await showError(`Failed to export map: ${error.message}`);
    } finally {
        // Reset button state
        exportBtn.disabled = false;
        exportBtn.style.visibility = 'visible';
        qualitySelect.style.visibility = 'visible';
        exportBtn.querySelector('.button-text').textContent = 'Export as PNG';
        console.log('🔄 Export UI reset to normal state');
    }
}

// Wait for map tiles and layers to finish loading
async function waitForMapToLoad() {
    console.log('⏳ Waiting for map layers to load...');
    
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 20;
        const checkInterval = 200;
        
        const checkIfLoaded = () => {
            attempts++;
            
            // Check if all tiles are loaded
            const tileContainers = document.querySelectorAll('.leaflet-tile-container');
            let tilesLoading = 0;
            
            tileContainers.forEach(container => {
                const tiles = container.querySelectorAll('img');
                tiles.forEach(tile => {
                    if (!tile.complete || tile.naturalWidth === 0) {
                        tilesLoading++;
                    }
                });
            });
            
            console.log(`🔄 Attempt ${attempts}: ${tilesLoading} tiles still loading`);
            
            if (tilesLoading === 0 || attempts >= maxAttempts) {
                console.log('✅ Map loading complete (or timeout reached)');
                resolve();
            } else {
                setTimeout(checkIfLoaded, checkInterval);
            }
        };
        
        // Start checking after initial delay
        setTimeout(checkIfLoaded, 500);
    });
}

// Enhanced canvas composition method for better layer capture
async function exportMapWithCanvasComposition(scale) {
    console.log('🎨 Using enhanced canvas composition method...');
    
    const mapContainer = document.getElementById('map');
    const width = mapContainer.offsetWidth;
    const height = mapContainer.offsetHeight;
    
    // Create main canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    
    // Scale context for high DPI
    ctx.scale(scale, scale);
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    console.log('📐 Canvas prepared:', { width: canvas.width, height: canvas.height, scale });
    
    // Step 1: Capture basemap tiles
    await captureBasemapTiles(ctx, width, height);
    
    // Step 2: Capture all vector layers (including Supabase storage layers, Add Data layers, and filtered layers)
    await captureAllVectorLayers(ctx, width, height, scale);
    
    // Step 3: Apply any necessary post-processing
    await finalizeCanvasRendering(ctx, width, height);
    
    console.log('✅ Canvas composition completed successfully');
    return canvas;
}

// CORS-safe basemap tile capture with proxy and fallback methods
async function captureBasemapTiles(ctx, width, height) {
    console.log('🗺️ Capturing basemap tiles with CORS safety...');
    
    return new Promise(async (resolve) => {
        const tileContainers = document.querySelectorAll('.leaflet-tile-container');
        let processedTiles = 0;
        let totalTiles = 0;
        let corsFailures = 0;
        
        // Count total tiles
        tileContainers.forEach(container => {
            totalTiles += container.querySelectorAll('img').length;
        });
        
        if (totalTiles === 0) {
            console.log('📝 No basemap tiles found');
            resolve();
            return;
        }
        
        console.log(`🔍 Processing ${totalTiles} basemap tiles...`);
        
        for (const container of tileContainers) {
            const tiles = container.querySelectorAll('img');
            
            for (const tile of tiles) {
                if (tile.complete && tile.naturalWidth > 0) {
                    try {
                        // Test if tile can be drawn to canvas (CORS check)
                        const testCanvas = document.createElement('canvas');
                        testCanvas.width = 1;
                        testCanvas.height = 1;
                        const testCtx = testCanvas.getContext('2d');
                        
                        // Try to draw a 1x1 pixel to test CORS
                        testCtx.drawImage(tile, 0, 0, 1, 1);
                        testCtx.getImageData(0, 0, 1, 1); // This will throw if CORS blocked
                        
                        // If we get here, tile is CORS-safe
                        const rect = tile.getBoundingClientRect();
                        const mapRect = document.getElementById('map').getBoundingClientRect();
                        
                        const x = rect.left - mapRect.left;
                        const y = rect.top - mapRect.top;
                        
                        // Draw tile to main canvas
                        ctx.drawImage(tile, x, y, rect.width, rect.height);
                        console.log(`✅ Successfully drew CORS-safe tile`);
                        
                    } catch (corsError) {
                        corsFailures++;
                        console.warn(`🚫 CORS blocked tile, trying proxy method...`);
                        
                        try {
                            // Try alternative capture method
                            await captureViaProxy(ctx, tile);
                        } catch (proxyError) {
                            console.warn(`⚠️ Proxy method failed, skipping tile:`, proxyError.message);
                            // Fill with transparent or placeholder
                            const rect = tile.getBoundingClientRect();
                            const mapRect = document.getElementById('map').getBoundingClientRect();
                            
                            const x = rect.left - mapRect.left;
                            const y = rect.top - mapRect.top;
                            
                            // Draw a subtle placeholder
                            ctx.save();
                            ctx.fillStyle = 'rgba(240, 240, 240, 0.1)';
                            ctx.fillRect(x, y, rect.width, rect.height);
                            ctx.restore();
                        }
                    }
                }
                
                processedTiles++;
            }
        }
        
        if (corsFailures > 0) {
            console.warn(`⚠️ ${corsFailures} tiles failed CORS check and were handled with fallbacks`);
        }
        
        console.log(`✅ Processed ${processedTiles} basemap tiles (${corsFailures} CORS failures handled)`);
        resolve();
    });
}

// Alternative tile capture using fetch proxy (for CORS-blocked tiles)
async function captureViaProxy(ctx, tile) {
    // For CORS-blocked tiles, we'll create a placeholder or use a different approach
    // This is a simplified approach - in production you might want a proper CORS proxy
    
    const rect = tile.getBoundingClientRect();
    const mapRect = document.getElementById('map').getBoundingClientRect();
    
    const x = rect.left - mapRect.left;
    const y = rect.top - mapRect.top;
    
    // Create a canvas element to convert the image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = rect.width;
    tempCanvas.height = rect.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Try to fetch the image with no-cors mode (limited but might work)
    try {
        const response = await fetch(tile.src, { mode: 'no-cors' });
        if (response.ok) {
            const blob = await response.blob();
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    try {
                        tempCtx.drawImage(img, 0, 0);
                        ctx.drawImage(tempCanvas, x, y);
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });
        } else {
            throw new Error('Fetch failed');
        }
    } catch (fetchError) {
        // Final fallback - just skip the tile
        throw new Error('All proxy methods failed');
    }
}

// Enhanced vector layer capture that handles all layer types
async function captureAllVectorLayers(ctx, width, height, scale) {
    console.log('📐 Capturing all vector layers (Supabase Storage, Add Data, Filtered)...');
    
    if (!window.layers || window.layers.size === 0) {
        console.log('📝 No vector layers to capture');
        return;
    }
    
    let capturedCount = 0;
    let failedCount = 0;
    
    // Process each visible layer in the correct order (use layerOrder for z-index consistency)
    const layersToProcess = window.layerOrder ? 
        window.layerOrder.map(layerId => [layerId, window.layers.get(layerId)]).filter(([id, info]) => info) :
        Array.from(window.layers.entries());
    
    console.log(`🎯 Processing ${layersToProcess.length} layers for export...`);
    
    for (const [layerId, layerInfo] of layersToProcess) {
        if (layerInfo.visible && layerInfo.layer && layerInfo.data) {
            try {
                console.log(`🎨 Capturing layer: ${layerInfo.name} (${layerInfo.isPermanent ? 'Permanent' : 'Dynamic'})`);
                
                // Enhanced layer capture with better error handling
                await captureEnhancedGeoJSONLayer(ctx, layerInfo, width, height);
                capturedCount++;
                console.log(`✅ Successfully captured layer: ${layerInfo.name}`);
            } catch (error) {
                failedCount++;
                console.warn(`⚠️ Failed to capture layer ${layerInfo.name}:`, error);
                
                // Try fallback capture method
                try {
                    await captureLayerFallback(ctx, layerInfo, width, height);
                    capturedCount++;
                    console.log(`🔄 Fallback capture succeeded for: ${layerInfo.name}`);
                } catch (fallbackError) {
                    console.error(`❌ Both primary and fallback capture failed for ${layerInfo.name}:`, fallbackError);
                }
            }
        } else {
            console.log(`⏭️ Skipping layer ${layerInfo?.name || 'Unknown'}: visible=${layerInfo?.visible}, hasLayer=${!!layerInfo?.layer}, hasData=${!!layerInfo?.data}`);
        }
    }
    
    console.log(`📊 Layer capture summary: ${capturedCount} successful, ${failedCount} failed`);
}

// Enhanced GeoJSON layer capture with better geometry support
async function captureEnhancedGeoJSONLayer(ctx, layerInfo, width, height) {
    const features = layerInfo.data.features;
    if (!features || features.length === 0) {
        console.log(`📝 No features found in layer: ${layerInfo.name}`);
        return;
    }
    
    console.log(`🔍 Processing ${features.length} features in layer: ${layerInfo.name}`);
    
    // Check for hidden categories in categorical layers
    const hiddenCategories = layerInfo.hiddenCategories || new Set();
    let renderedFeatures = 0;
    let skippedFeatures = 0;
    
    features.forEach(feature => {
        const geometry = feature.geometry;
        if (!geometry) {
            skippedFeatures++;
            return;
        }
        
        // Check if this feature should be hidden (categorical styling)
        if (layerInfo.classification && layerInfo.classification.field && hiddenCategories.size > 0) {
            const fieldValue = feature.properties[layerInfo.classification.field];
            if (hiddenCategories.has(fieldValue)) {
                skippedFeatures++;
                return; // Skip hidden category
            }
        }
        
        const style = getEnhancedFeatureStyle(feature, layerInfo);
        
        try {
            switch (geometry.type) {
                case 'Point':
                    drawPoint(ctx, geometry.coordinates, style);
                    break;
                case 'MultiPoint':
                    geometry.coordinates.forEach(coords => drawPoint(ctx, coords, style));
                    break;
                case 'LineString':
                    drawLineString(ctx, geometry.coordinates, style);
                    break;
                case 'MultiLineString':
                    geometry.coordinates.forEach(coords => drawLineString(ctx, coords, style));
                    break;
                case 'Polygon':
                    drawPolygon(ctx, geometry.coordinates, style);
                    break;
                case 'MultiPolygon':
                    geometry.coordinates.forEach(polygon => drawPolygon(ctx, polygon, style));
                    break;
                default:
                    console.warn(`🚫 Unsupported geometry type: ${geometry.type}`);
                    skippedFeatures++;
                    return;
            }
            renderedFeatures++;
        } catch (error) {
            console.warn(`⚠️ Error rendering feature in ${layerInfo.name}:`, error);
            skippedFeatures++;
        }
    });
    
    console.log(`📊 Layer ${layerInfo.name}: ${renderedFeatures} rendered, ${skippedFeatures} skipped`);
}

// Fallback capture method for problematic layers
async function captureLayerFallback(ctx, layerInfo, width, height) {
    console.log(`🔄 Attempting fallback capture for layer: ${layerInfo.name}`);
    
    try {
        // Try to extract features directly from the Leaflet layer
        if (layerInfo.layer && layerInfo.layer.eachLayer) {
            layerInfo.layer.eachLayer(function(featureLayer) {
                try {
                    const bounds = featureLayer.getBounds ? featureLayer.getBounds() : null;
                    if (bounds && bounds.isValid()) {
                        // Draw a simple representation
                        const style = layerInfo.style || { fillColor: '#888888', color: '#ffffff', weight: 2 };
                        
                        if (featureLayer.getLatLng) {
                            // Point feature
                            const latlng = featureLayer.getLatLng();
                            const point = window.map.latLngToContainerPoint(latlng);
                            drawPoint(ctx, [latlng.lng, latlng.lat], style);
                        } else if (bounds) {
                            // Polygon approximation from bounds
                            const sw = bounds.getSouthWest();
                            const ne = bounds.getNorthEast();
                            const coords = [
                                [[sw.lng, sw.lat], [ne.lng, sw.lat], [ne.lng, ne.lat], [sw.lng, ne.lat], [sw.lng, sw.lat]]
                            ];
                            drawPolygon(ctx, coords, style);
                        }
                    }
                } catch (featureError) {
                    console.warn('🚫 Error in fallback feature capture:', featureError);
                }
            });
            
            console.log(`✅ Fallback capture completed for: ${layerInfo.name}`);
        } else {
            throw new Error('Layer does not support eachLayer method');
        }
    } catch (error) {
        console.error(`❌ Fallback capture failed for ${layerInfo.name}:`, error);
        throw error;
    }
}

// Enhanced feature style calculation with better fallbacks
function getEnhancedFeatureStyle(feature, layerInfo) {
    let style = layerInfo.style || {
        fillColor: '#888888',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.7
    };
    
    // Apply categorical styling if available
    if (layerInfo.classification && layerInfo.classification.field && layerInfo.classification.colorMap) {
        const fieldValue = feature.properties[layerInfo.classification.field];
        const fillColor = layerInfo.classification.colorMap[fieldValue];
        
        if (fillColor) {
            style = {
                ...style,
                fillColor: fillColor,
                color: layerInfo.classification.strokeColor || style.color || '#ffffff',
                weight: layerInfo.classification.strokeWidth || style.weight || 2,
                opacity: style.opacity || 1,
                fillOpacity: style.fillOpacity || 0.7
            };
        }
    }
    
    // Ensure all required style properties exist with sensible defaults
    return {
        fillColor: style.fillColor || '#888888',
        color: style.color || '#ffffff',
        weight: style.weight || 2,
        opacity: style.opacity !== undefined ? style.opacity : 1,
        fillOpacity: style.fillOpacity !== undefined ? style.fillOpacity : 0.7
    };
}

// Finalize canvas rendering with any post-processing
async function finalizeCanvasRendering(ctx, width, height) {
    console.log('🎨 Finalizing canvas rendering...');
    
    // Apply any global adjustments or corrections
    // This could include color corrections, sharpening, etc.
    
    // For now, just ensure proper alpha handling
    ctx.globalCompositeOperation = 'source-over';
    
    console.log('✅ Canvas rendering finalized');
}

// Convert all map layers to canvas rendering (called after layer load/refresh)
function convertAllMapLayersToCanvas() {
    console.log('🔄 Converting all map layers to canvas rendering...');
    
    if (!window.layers || window.layers.size === 0) {
        console.log('📝 No layers to convert');
        return;
    }
    
    let convertedCount = 0;
    
    window.layers.forEach((layerInfo, layerId) => {
        if (layerInfo.layer && layerInfo.data) {
            try {
                // Check if layer is already using canvas renderer
                const currentRenderer = layerInfo.layer.options.renderer;
                
                if (!currentRenderer || !currentRenderer._container || currentRenderer._container.tagName !== 'CANVAS') {
                    console.log(`🔧 Converting layer "${layerInfo.name}" to canvas rendering...`);
                    
                    // Remove current layer
                    if (layerInfo.visible) {
                        window.map.removeLayer(layerInfo.layer);
                    }
                    
                    // Recreate layer with canvas renderer
                    const newLayer = L.geoJSON(layerInfo.data, {
                        renderer: L.canvas(), // Force canvas rendering
                        style: layerInfo.style,
                        onEachFeature: (feature, layer) => {
                            if (feature.properties) {
                                let popupContent = '<div class="text-sm">';
                                for (let key in feature.properties) {
                                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                                }
                                popupContent += '</div>';
                                layer.bindPopup(popupContent);
                            }
                        }
                    });
                    
                    // Update layer reference
                    layerInfo.layer = newLayer;
                    
                    // Re-add to map if it was visible
                    if (layerInfo.visible) {
                        newLayer.addTo(window.map);
                    }
                    
                    convertedCount++;
                    console.log(`✅ Converted layer "${layerInfo.name}" to canvas`);
                } else {
                    console.log(`✓ Layer "${layerInfo.name}" already using canvas renderer`);
                }
            } catch (error) {
                console.error(`❌ Error converting layer "${layerInfo.name}" to canvas:`, error);
            }
        }
    });
    
    if (convertedCount > 0) {
        console.log(`🎉 Converted ${convertedCount} layers to canvas rendering`);
        
        // Update map layer order after conversion
        if (typeof updateMapLayerOrder === 'function') {
            updateMapLayerOrder();
        }
    } else {
        console.log('ℹ️ All layers already using canvas rendering');
    }
}

// Auto-convert layers to canvas on page load/refresh
function ensureCanvasRenderingOnRefresh() {
    console.log('🔄 Ensuring canvas rendering persists after page refresh...');
    
    // Convert existing layers
    convertAllMapLayersToCanvas();
    
    // Set up observers for new layers
    if (window.layers) {
        // Monitor for new layers being added
        const originalSet = window.layers.set;
        window.layers.set = function(key, value) {
            // Call original set method
            const result = originalSet.call(this, key, value);
            
            // Ensure new layer uses canvas rendering
            setTimeout(() => {
                if (value && value.layer && value.data) {
                    const renderer = value.layer.options.renderer;
                    if (renderer && renderer._container && renderer._container.tagName !== 'CANVAS') {
                        console.log(`🔧 Auto-converting new layer "${value.name}" to canvas...`);
                        convertAllMapLayersToCanvas();
                    } else if (!renderer) {
                        console.log(`🔧 Layer "${value.name}" has no renderer - converting to canvas...`);
                        convertAllMapLayersToCanvas();
                    }
                }
            }, 100);
            
            return result;
        };
    }
    
    console.log('✅ Canvas rendering persistence configured');
}

// Draw functions for different geometry types
function drawPoint(ctx, coordinates, style) {
    const point = window.map.latLngToContainerPoint([coordinates[1], coordinates[0]]);
    
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
    ctx.fillStyle = style.fillColor || '#3388ff';
    ctx.fill();
    ctx.strokeStyle = style.color || '#ffffff';
    ctx.lineWidth = style.weight || 2;
    ctx.stroke();
}

function drawLineString(ctx, coordinates, style) {
    if (coordinates.length < 2) return;
    
    const points = coordinates.map(coord => 
        window.map.latLngToContainerPoint([coord[1], coord[0]])
    );
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.strokeStyle = style.color || '#3388ff';
    ctx.lineWidth = style.weight || 2;
    ctx.stroke();
}

function drawPolygon(ctx, coordinates, style) {
    if (coordinates.length === 0) return;
    
    // Draw exterior ring
    const exteriorRing = coordinates[0];
    const points = exteriorRing.map(coord => 
        window.map.latLngToContainerPoint([coord[1], coord[0]])
    );
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.closePath();
    
    // Fill
    if (style.fillColor && style.fillOpacity !== 0) {
        ctx.fillStyle = style.fillColor || '#3388ff';
        ctx.globalAlpha = style.fillOpacity || 0.7;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    // Stroke
    if (style.color && style.opacity !== 0) {
        ctx.strokeStyle = style.color || '#3388ff';
        ctx.lineWidth = style.weight || 2;
        ctx.stroke();
    }
}

// Enhanced html2canvas method with better CORS handling
async function exportMapWithHtml2Canvas(scale) {
    console.log('🌐 Using enhanced html2canvas method with CORS handling...');
    
    return await html2canvas(document.getElementById('map'), {
        useCORS: true,
        allowTaint: true, // Allow tainted canvas for export
        backgroundColor: '#ffffff',
        scale: scale,
        logging: false,
        width: window.map.getContainer().offsetWidth,
        height: window.map.getContainer().offsetHeight,
        foreignObjectRendering: false, // Disable for better compatibility
        imageTimeout: 15000, // Longer timeout for slow tiles
        ignoreElements: (element) => {
            // Ignore controls and UI elements
            return element.classList.contains('leaflet-control-container') ||
                   element.classList.contains('print-controls') ||
                   element.classList.contains('print-tip') ||
                   element.classList.contains('context-menu') ||
                   element.id === 'layerContextMenu' ||
                   element.id === 'mapContextMenu';
        },
        onclone: (clonedDoc) => {
            // Remove any remaining controls from cloned document
            const controls = clonedDoc.querySelectorAll('.leaflet-control-container, .print-controls, .print-tip, .context-menu, #layerContextMenu, #mapContextMenu');
            controls.forEach(el => el.remove());
            
            // Set all images to use crossorigin
            const images = clonedDoc.querySelectorAll('img');
            images.forEach(img => {
                if (img.src && !img.crossOrigin) {
                    img.crossOrigin = 'anonymous';
                }
            });
        }
    });
}

// Screenshot-based export method (final fallback)
async function exportMapWithScreenshotMethod(scale) {
    console.log('📸 Using screenshot-based export method (final fallback)...');
    
    const mapContainer = document.getElementById('map');
    const width = mapContainer.offsetWidth;
    const height = mapContainer.offsetHeight;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    
    // Scale context
    ctx.scale(scale, scale);
    
    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    try {
        // Use domtoimage library if available, otherwise basic approach
        if (typeof domtoimage !== 'undefined') {
            console.log('📸 Using domtoimage library...');
            const dataUrl = await domtoimage.toPng(mapContainer, {
                width: width * scale,
                height: height * scale,
                style: {
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left'
                },
                filter: (node) => {
                    // Filter out controls and unwanted elements
                    if (node.classList) {
                        return !node.classList.contains('leaflet-control-container') &&
                               !node.classList.contains('print-controls') &&
                               !node.classList.contains('print-tip') &&
                               !node.classList.contains('context-menu');
                    }
                    return true;
                }
            });
            
            // Convert data URL to canvas
            const img = new Image();
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas);
                };
                img.onerror = reject;
                img.src = dataUrl;
            });
        } else {
            // Basic manual approach - draw visible layers only
            console.log('📸 Using basic screenshot approach...');
            
            // Draw a simple background
            ctx.fillStyle = '#f0f8ff';
            ctx.fillRect(0, 0, width, height);
            
            // Add text indication
            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Map Export', width / 2, height / 2);
            ctx.fillText('(CORS-limited view)', width / 2, height / 2 + 25);
            
            // Try to capture vector layers only
            if (window.layers && window.layers.size > 0) {
                await captureAllVectorLayers(ctx, width, height, 1);
            }
            
            return canvas;
        }
    } catch (error) {
        console.error('Screenshot method failed:', error);
        
        // Ultra-basic fallback
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#333333';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Map Export', width / 2, height / 2 - 20);
        ctx.fillText('(Vector layers only)', width / 2, height / 2 + 10);
        
        // Draw vector layers if available
        if (window.layers && window.layers.size > 0) {
            await captureAllVectorLayers(ctx, width, height, 1);
        }
        
        return canvas;
    }
}

// Check for potential CORS issues before export
async function checkForCorsIssues() {
    console.log('🔍 Checking for potential CORS issues...');
    
    const tiles = document.querySelectorAll('.leaflet-tile-container img');
    if (tiles.length === 0) {
        return null; // No tiles to check
    }
    
    // List of known CORS-problematic domains
    const problematicDomains = [
        'google.com',
        'googleapis.com',
        'maps.google.com',
        'maps.googleapis.com'
    ];
    
    // Check current basemap for CORS issues
    let hasCorsIssues = false;
    let problematicSources = new Set();
    
    tiles.forEach(tile => {
        if (tile.src) {
            const domain = new URL(tile.src).hostname;
            
            // Check if it's a known problematic domain
            if (problematicDomains.some(probDomain => domain.includes(probDomain))) {
                hasCorsIssues = true;
                problematicSources.add(domain);
            }
            
            // Check if crossOrigin is not set
            if (!tile.crossOrigin) {
                // Quick test for CORS support
                try {
                    const testCanvas = document.createElement('canvas');
                    testCanvas.width = 1;
                    testCanvas.height = 1;
                    const testCtx = testCanvas.getContext('2d');
                    testCtx.drawImage(tile, 0, 0, 1, 1);
                    testCtx.getImageData(0, 0, 1, 1);
                } catch (corsError) {
                    hasCorsIssues = true;
                    problematicSources.add(domain);
                }
            }
        }
    });
    
    if (hasCorsIssues) {
        const sources = Array.from(problematicSources).join(', ');
        return `⚠️ CORS Export Warning: Some map tiles from (${sources}) may not appear in the exported image due to cross-origin restrictions.\n\n` +
               `💡 Suggestion: Switch to OpenStreetMap basemaps for better export compatibility.`;
    }
    
    return null;
}

// Get CORS-friendly basemap suggestions
function getCorsFreindlyBasemaps() {
    return [
        'osm-standard',
        'osm-no-labels', 
        'osm-hot',
        'osm-opnv',
        'carto-positron',
        'carto-dark-matter',
        'carto-voyager'
    ];
}

// Export functions
window.enterPrintMode = enterPrintMode;
window.exitPrintMode = exitPrintMode;
window.triggerExport = triggerExport;
window.convertAllMapLayersToCanvas = convertAllMapLayersToCanvas;
window.ensureCanvasRenderingOnRefresh = ensureCanvasRenderingOnRefresh;

// Initialize canvas rendering persistence when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(ensureCanvasRenderingOnRefresh, 1000);
    });
} else {
    setTimeout(ensureCanvasRenderingOnRefresh, 1000);
} 