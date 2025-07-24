/**
 * Map Export Module using Leaflet-easyPrint Plugin
 * 
 * This module handles map export functionality using only the Leaflet-easyPrint plugin.
 * All fallback methods (leaflet-image, html2canvas) have been removed.
 * 
 * @version 2.0.0
 * @author Aera WebGIS Team
 */

class MapExporter {
    constructor() {
        this.easyPrintControl = null;
        this.mapInstance = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the EasyPrint control with the map instance
     * @param {L.Map} map - Leaflet map instance
     */
    initialize(map) {
        if (!map) {
            console.error('❌ Map instance required for MapExporter initialization');
            return false;
        }

        this.mapInstance = map;

        try {
            // Configure EasyPrint with comprehensive options
            this.easyPrintControl = L.easyPrint({
                // Export title and filename
                title: 'Export Map',
                filename: 'AeraMap_{YYYY}-{MM}-{DD}_{HH}-{mm}',
                
                // Export formats and sizes
                exportOnly: true, // Don't add to map controls
                hideControlContainer: true,
                
                // Paper sizes for printing
                sizeModes: [
                    'A4Portrait', 'A4Landscape',
                    'A3Portrait', 'A3Landscape', 
                    'LetterPortrait', 'LetterLandscape',
                    'Current' // Current map view size
                ],
                
                // Default export options
                defaultSizeTitles: {
                    Current: 'Current View',
                    A4Portrait: 'A4 Portrait',
                    A4Landscape: 'A4 Landscape', 
                    A3Portrait: 'A3 Portrait',
                    A3Landscape: 'A3 Landscape',
                    LetterPortrait: 'Letter Portrait',
                    LetterLandscape: 'Letter Landscape'
                },

                // Hide UI elements during export
                hideClasses: [
                    'leaflet-control-container',
                    'leaflet-control-zoom',
                    'leaflet-control-attribution',
                    'custom-context-menu',
                    'floating-statistics-container',
                    'selection-highlight',
                    'leaflet-popup',
                    'leaflet-tooltip'
                ],

                // Custom CSS for print
                customWindowTitle: 'Aera WebGIS Map Export',
                
                // Hooks for before and after print
                beforePrint: (event) => {
                    console.log('🖨️ Preparing map for export...');
                    this.beforePrintHandler(event);
                },
                
                afterPrint: (event) => {
                    console.log('✅ Map export completed');
                    this.afterPrintHandler(event);
                }
            });

            // DO NOT add control to map - we'll use it programmatically only
            // this.easyPrintControl.addTo(map); // REMOVED - no map controls
            this.isInitialized = true;
            
            console.log('✅ MapExporter initialized with EasyPrint (no map controls)');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize MapExporter:', error);
            return false;
        }
    }

    /**
     * Export map as PNG download
     * @param {string} size - Paper size (default: 'Current')
     * @param {string} orientation - 'Portrait' or 'Landscape'
     */
    exportAsDownload(size = 'Current', orientation = 'Portrait') {
        if (!this.isInitialized) {
            console.error('❌ MapExporter not initialized');
            return false;
        }

        try {
            const sizeMode = size === 'Current' ? 'Current' : `${size}${orientation}`;
            
            console.log(`🖨️ Exporting map as ${sizeMode} download...`);
            
            // Show loading state
            this.showExportProgress('Preparing download...');
            
            // Use easyPrint to export
            this.easyPrintControl.printMap(sizeMode, 'MyMap');
            
            return true;
        } catch (error) {
            console.error('❌ Export download failed:', error);
            this.hideExportProgress();
            this.showExportError('Failed to export map. Please try again.');
            return false;
        }
    }

    /**
     * Open print dialog
     * @param {string} size - Paper size (default: 'A4')
     * @param {string} orientation - 'Portrait' or 'Landscape'
     */
    openPrintDialog(size = 'A4', orientation = 'Portrait') {
        if (!this.isInitialized) {
            console.error('❌ MapExporter not initialized');
            return false;
        }

        try {
            const sizeMode = `${size}${orientation}`;
            
            console.log(`🖨️ Opening print dialog for ${sizeMode}...`);
            
            // Show loading state
            this.showExportProgress('Preparing print dialog...');
            
            // Use easyPrint to open print dialog
            this.easyPrintControl.printMap(sizeMode);
            
            return true;
        } catch (error) {
            console.error('❌ Print dialog failed:', error);
            this.hideExportProgress();
            this.showExportError('Failed to open print dialog. Please try again.');
            return false;
        }
    }

    /**
     * Before print handler - prepare map for export
     */
    beforePrintHandler(event) {
        // Hide floating elements
        const elementsToHide = [
            '#floatingStatisticsContainer',
            '.leaflet-popup',
            '.leaflet-tooltip',
            '.custom-context-menu',
            '.confirm-modal-overlay'
        ];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.display = 'none';
                el.setAttribute('data-hidden-for-export', 'true');
            });
        });

        // Ensure all layers are properly rendered
        if (this.mapInstance) {
            this.mapInstance.invalidateSize();
        }

        // Store current map state
        this.preExportState = {
            center: this.mapInstance.getCenter(),
            zoom: this.mapInstance.getZoom()
        };
    }

    /**
     * After print handler - restore map state
     */
    afterPrintHandler(event) {
        // Restore hidden elements
        const hiddenElements = document.querySelectorAll('[data-hidden-for-export="true"]');
        hiddenElements.forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-hidden-for-export');
        });

        // Hide progress indicator
        this.hideExportProgress();

        // Show success message
        this.showExportSuccess('Map exported successfully!');

        // Restore map state if needed
        if (this.preExportState && this.mapInstance) {
            this.mapInstance.setView(this.preExportState.center, this.preExportState.zoom);
        }
    }

    /**
     * Show export progress indicator
     */
    showExportProgress(message = 'Exporting map...') {
        // Remove existing progress if any
        this.hideExportProgress();

        const progressEl = document.createElement('div');
        progressEl.id = 'mapExportProgress';
        progressEl.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60000]';
        progressEl.innerHTML = `
            <div class="bg-gray-800 text-white p-6 rounded-lg shadow-lg flex items-center space-x-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span class="text-lg">${message}</span>
            </div>
        `;
        
        document.body.appendChild(progressEl);
    }

    /**
     * Hide export progress indicator
     */
    hideExportProgress() {
        const progressEl = document.getElementById('mapExportProgress');
        if (progressEl) {
            progressEl.remove();
        }
    }

    /**
     * Show export success message
     */
    showExportSuccess(message) {
        if (typeof showSuccess === 'function') {
            showSuccess(message, 'Export Complete');
        } else {
            console.log('✅', message);
        }
    }

    /**
     * Show export error message
     */
    showExportError(message) {
        if (typeof showError === 'function') {
            showError(message, 'Export Failed');
        } else {
            console.error('❌', message);
        }
    }

    /**
     * Get available export sizes
     */
    getAvailableSizes() {
        return [
            { value: 'Current', label: 'Current View' },
            { value: 'A4', label: 'A4' },
            { value: 'A3', label: 'A3' },
            { value: 'Letter', label: 'Letter' }
        ];
    }

    /**
     * Get available orientations
     */
    getAvailableOrientations() {
        return [
            { value: 'Portrait', label: 'Portrait' },
            { value: 'Landscape', label: 'Landscape' }
        ];
    }

    /**
     * Cleanup - remove control from map
     */
    destroy() {
        if (this.easyPrintControl && this.mapInstance) {
            this.mapInstance.removeControl(this.easyPrintControl);
            this.easyPrintControl = null;
        }
        this.mapInstance = null;
        this.isInitialized = false;
        this.hideExportProgress();
    }
}

// Create global instance
const mapExporter = new MapExporter();



console.log('📤 Map Export module loaded successfully');
