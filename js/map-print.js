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

// Export map as PNG
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
        
        // Get selected quality
        const scale = parseInt(qualitySelect.value) || 2;
        
        // Hide controls for capture
        exportBtn.style.visibility = 'hidden';
        qualitySelect.style.visibility = 'hidden';
        
        // Force final map update
        window.map.invalidateSize({ animate: false });
        
        // Wait for any tile loading to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate timestamp for filename
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `Map_Export_${timestamp}.png`;
        
        // Capture the map
        const canvas = await html2canvas(document.getElementById('map'), {
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            scale: scale,
            logging: false,
            width: window.map.getContainer().offsetWidth,
            height: window.map.getContainer().offsetHeight,
            onclone: (clonedDoc) => {
                // Remove any controls from cloned document
                const controls = clonedDoc.querySelectorAll('.leaflet-control-container, .print-controls, .print-tip');
                controls.forEach(el => el.remove());
            }
        });
        
        // Convert to blob and save
        canvas.toBlob(blob => {
            if (!blob) {
                throw new Error('Failed to create image blob');
            }
            saveAs(blob, filename);
            showSuccess('Map exported successfully!');
        }, 'image/png');
        
    } catch (error) {
        console.error('Export error:', error);
        await showError('Failed to export map. Please try again.');
    } finally {
        // Reset button state
        exportBtn.disabled = false;
        exportBtn.style.visibility = 'visible';
        qualitySelect.style.visibility = 'visible';
        exportBtn.querySelector('.button-text').textContent = 'Export as PNG';
    }
}

// Export functions
window.enterPrintMode = enterPrintMode;
window.exitPrintMode = exitPrintMode;
window.triggerExport = triggerExport; 