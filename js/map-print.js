// Print Layout Module

// Initialize print layout functionality
document.addEventListener('DOMContentLoaded', () => {
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

// Export map as PNG - preserves current basemap and all visible layers
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
        if (buttonText) {
            buttonText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exporting...';
        }
        
        console.log('🖨️ Starting map export process...');
        
        // Get selected quality (scale factor)
        const scale = parseInt(qualitySelect.value) || 2;
        console.log(`📐 Export scale: ${scale}x`);
        
        // Hide controls for capture
        exportBtn.style.visibility = 'hidden';
        qualitySelect.style.visibility = 'hidden';
        
        // Wait for any pending tiles to load
        await waitForMapToLoad();
        
        // Generate timestamp for filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `AeraLink_Map_Export_${timestamp}.png`;
        
        console.log('🎯 Capturing map with html2canvas (preserving current view)...');
        
        // Capture the map container exactly as displayed using html2canvas
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Map container not found');
        }
        
        // Add ignore attributes to potentially problematic elements before capture
        const elementsToIgnore = [
            ...document.querySelectorAll('script, style, link[rel="stylesheet"], iframe, embed, object, video, audio'),
            ...document.querySelectorAll('[class*="leaflet-control"], [class*="attribution"]'),
            ...document.querySelectorAll('.print-controls, .floating-toolbox, .toolbar-panels-container')
        ];
        
        elementsToIgnore.forEach(el => {
            if (el) el.setAttribute('data-html2canvas-ignore', 'true');
        });
        
        let canvas;
        try {
            canvas = await html2canvas(mapContainer, {
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                scale: scale,
                logging: false,
                width: mapContainer.offsetWidth,
                height: mapContainer.offsetHeight,
                ignoreElements: (element) => {
                    // Simple ignore logic - just check for the ignore attribute
                    return element && element.hasAttribute && element.hasAttribute('data-html2canvas-ignore');
                }
            });
        } finally {
            // Clean up ignore attributes
            elementsToIgnore.forEach(el => {
                if (el && el.removeAttribute) {
                    el.removeAttribute('data-html2canvas-ignore');
                }
            });
        }
        
        console.log('✅ Map capture successful - all layers preserved');
        
        // Convert to blob and save
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
        
    } catch (error) {
        console.error('❌ Export error:', error);
        showError(`Failed to export map: ${error.message || 'Unknown error occurred'}`);
    } finally {
        // Reset button state
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.style.visibility = 'visible';
            const buttonText = exportBtn.querySelector('.button-text');
            if (buttonText) {
                buttonText.textContent = 'Export as PNG';
            }
        }
        if (qualitySelect) {
            qualitySelect.style.visibility = 'visible';
        }
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
            
            try {
                // Check if all tiles are loaded
                const tileContainers = document.querySelectorAll('.leaflet-tile-container');
                let tilesLoading = 0;
                
                tileContainers.forEach(container => {
                    if (container) {
                        const tiles = container.querySelectorAll('img');
                        tiles.forEach(tile => {
                            if (tile && (!tile.complete || tile.naturalWidth === 0)) {
                                tilesLoading++;
                            }
                        });
                    }
                });
                
                console.log(`🔄 Attempt ${attempts}: ${tilesLoading} tiles still loading`);
                
                if (tilesLoading === 0 || attempts >= maxAttempts) {
                    console.log('✅ Map loading complete (or timeout reached)');
                    resolve();
                } else {
                    setTimeout(checkIfLoaded, checkInterval);
                }
            } catch (error) {
                console.warn('Error checking tile loading status:', error);
                // If there's an error checking tiles, just proceed
                resolve();
            }
        };
        
        // Start checking after initial delay
        setTimeout(checkIfLoaded, 500);
    });
}

// Removed functions that were switching basemaps and causing layer capture issues:
// - getCurrentBasemapKey() 
// - getCurrentLabelsKey()
// - switchToExportCompatibleBasemap()
// - restoreBasemap()
// - captureMapLayers()
// 
// These functions have been replaced with a single html2canvas approach that
// preserves the current basemap and captures ALL visible layers including
// vector overlays, paths, and feature layers.











// Export functions
window.enterPrintMode = enterPrintMode;
window.exitPrintMode = exitPrintMode;
window.triggerExport = triggerExport; 