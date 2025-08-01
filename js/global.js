/**
 * Global Functions for A�ra Link WebGIS
 * Contains shared functions used across multiple modules
 */

// === INITIALIZATION LOADING SCREEN MANAGEMENT ===
let initializationLoadingState = {
    hasShown: false,
    timerId: null
};

// Show the initialization loading animation (only once per session)
function showInitializationLoading() {
    // Only show once per browser session
    if (initializationLoadingState.hasShown) {
        return;
    }
    
    const overlay = document.getElementById('layersLoadingOverlay');
    const progress = document.getElementById('loadingProgress');
    
    if (overlay) {
        initializationLoadingState.hasShown = true;
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
        
        if (progress) {
            progress.textContent = 'Fetching Layers';
        }
        
        // Auto-hide after exactly 1 second
        initializationLoadingState.timerId = setTimeout(() => {
            hideInitializationLoading();
        }, 3500);
        
        console.log('🔄 Showing initialization loading screen (1 second)');
    }
}

// Hide the initialization loading animation
function hideInitializationLoading() {
    const overlay = document.getElementById('layersLoadingOverlay');
    
    if (overlay) {
        // Clear timer if it exists
        if (initializationLoadingState.timerId) {
            clearTimeout(initializationLoadingState.timerId);
            initializationLoadingState.timerId = null;
        }
        
        // Smooth fade out with animation
        overlay.classList.add('hidden');
        
        // Completely hide after animation
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
        
        console.log('✅ Initialization loading screen hidden');
    }
}

// Export initialization loading functions to window
window.showInitializationLoading = showInitializationLoading;
window.hideInitializationLoading = hideInitializationLoading;

// Backward compatibility stub functions (now no-ops since we use simple 1-second timer)
window.showLayersLoading = showInitializationLoading; // Maps to new function
window.hideLayersLoading = function() { /* no-op - auto-hides after 1 second */ };
window.updateLoadingProgress = function() { /* no-op - not needed for simple timer */ };
window.checkLoadingComplete = function() { /* no-op - auto-hides after 1 second */ };
window.trackLayerLoading = function() { /* no-op - not needed for simple timer */ };
window.markLayerLoaded = function() { /* no-op - not needed for simple timer */ };
window.resetLoadingState = function() { /* no-op - not needed for simple timer */ };
window.loadingState = { /* stub object for backward compatibility */ };

// Supabase layer database functions
async function saveDynamicLayerToDatabase(layerId, layerName, geoJsonData) {
    try {
        if (!window.supabase || !window.currentUser) {
            console.warn('Supabase or currentUser not available');
            return false;
        }

        const layerRecord = {
            layer_id: layerId,
            name: layerName,
            geojson_data: geoJsonData,
            style: {
                fillColor: '#3388ff',
                color: '#3388ff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.2
            },
            user_id: window.currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await window.supabase
            .from('layers')
            .insert(layerRecord)
            .select();

        if (error) {
            console.error('Error saving layer to database:', error);
            return false;
        }

        console.log('Layer saved to database successfully:', data);
        return true;

    } catch (error) {
        console.error('Error in saveDynamicLayerToDatabase:', error);
        return false;
    }
}

// Layer loading logic moved to layer-manager.js to prevent duplicates

// Layer management functions moved to layer-manager.js

function zoomToLayer(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) return;

    try {
        const bounds = layerInfo.layer.getBounds();
        if (bounds.isValid()) {
            window.map.fitBounds(bounds, { padding: [50, 50] });
        }
    } catch (error) {
        console.error('Error zooming to layer:', error);
    }
}

function removeLayer(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) return;

    // Remove from map
    window.map.removeLayer(layerInfo.layer);
    
    // Remove from layers registry
    window.layers.delete(layerId);
    
    // Remove from layer order
    const index = window.layerOrder.indexOf(layerId);
    if (index > -1) {
        window.layerOrder.splice(index, 1);
    }

    // Update UI
    updateLayersList();
    updateLegend();
    
    // Refresh label system if available
    if (typeof window.refreshLabelsOnLayerChange === 'function') {
        window.refreshLabelsOnLayerChange();
    }
}

function updateLegend() {
    // Placeholder for legend update functionality
    console.log('Updating legend...');
}

// Setup modal listeners for close functionality
function setupModalListeners() {
    console.log('Setting up modal listeners...');
    
    // Setup custom modal listeners
    const customModal = document.getElementById('customModal');
    
    if (customModal) {
        // Close modal when clicking outside
        customModal.addEventListener('click', (e) => {
            if (e.target === customModal) {
                customModal.style.display = 'none';
            }
        });
    }
    
    console.log('Modal listeners setup complete');
}

// Global escape key handler that only works when WebGIS is loaded
function setupGlobalEscapeHandler() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Only handle escape if we're in the main application (not on login page)
            const webgisContainer = document.getElementById('webgisContainer');
            const loginContainer = document.getElementById('loginContainer');
            
            if (webgisContainer && webgisContainer.style.display !== 'none' && 
                loginContainer && loginContainer.style.display === 'none') {
                
                const customModal = document.getElementById('customModal');
                if (customModal && customModal.style.display !== 'none' && customModal.style.visibility !== 'hidden') {
                    e.preventDefault();
                    e.stopPropagation();
                    customModal.style.display = 'none';
                }
            }
        }
    });
}

// Setup file upload listeners (placeholder)
function setupFileUploadListeners() {
    console.log('File upload listeners already handled by add-data.js');
    // File upload functionality is already handled in add-data.js
    // This function exists to prevent the error
}

// Export functions globally
window.saveDynamicLayerToDatabase = saveDynamicLayerToDatabase;
// loadInitialData exported from layer-manager.js to prevent duplicates
// updateLayersList, createLayerItem, toggleLayerVisibility exported from layer-manager.js
window.zoomToLayer = zoomToLayer;
window.removeLayer = removeLayer;
window.updateLegend = updateLegend;
window.setupModalListeners = setupModalListeners;
window.setupFileUploadListeners = setupFileUploadListeners;
window.setupGlobalEscapeHandler = setupGlobalEscapeHandler;