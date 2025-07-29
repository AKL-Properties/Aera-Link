/**
 * Global Functions for A�ra Link WebGIS
 * Contains shared functions used across multiple modules
 */

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

// Load initial data from Supabase
async function loadInitialData() {
    console.log('Loading initial data...');
    
    try {
        if (!window.supabase || !window.currentUser) {
            console.warn('Supabase or currentUser not available - skipping initial data load');
            return;
        }

        // Load permanent layers from Supabase Storage first
        if (typeof window.loadPermanentLayersWithSymbology === 'function') {
            console.log('🗂️ Loading permanent layers from Supabase Storage...');
            await window.loadPermanentLayersWithSymbology();
        }

        // Then load user layers from database
        const { data: layers, error } = await window.supabase
            .from('layers')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading layers from database:', error);
            return;
        }

        if (layers && layers.length > 0) {
            console.log(`Loading ${layers.length} layers from database...`);
            
            for (const layerRecord of layers) {
                try {
                    await addDataToMap(
                        layerRecord.geojson_data, 
                        layerRecord.name,
                        {
                            source: 'database',
                            layerId: layerRecord.layer_id,
                            style: layerRecord.style
                        }
                    );
                } catch (error) {
                    console.error(`Error loading layer ${layerRecord.name}:`, error);
                }
            }
        } else {
            console.log('No layers found in database');
        }

    } catch (error) {
        console.error('Error in loadInitialData:', error);
    }
}

// Layer management functions
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    const noLayersMessage = document.getElementById('noLayersMessage');
    
    if (!layersList || !noLayersMessage) {
        console.warn('Layer UI elements not found');
        return;
    }

    if (window.layers.size === 0) {
        layersList.style.display = 'none';
        noLayersMessage.style.display = 'block';
        return;
    }

    layersList.style.display = 'block';
    noLayersMessage.style.display = 'none';
    layersList.innerHTML = '';

    // Sort layers by order
    const sortedLayers = window.layerOrder
        .filter(id => window.layers.has(id))
        .map(id => ({ id, ...window.layers.get(id) }));

    sortedLayers.forEach(layerInfo => {
        const layerItem = createLayerItem(layerInfo.id, layerInfo);
        layersList.appendChild(layerItem);
    });
}

function createLayerItem(layerId, layerInfo) {
    const item = document.createElement('div');
    item.className = 'glass-section p-3 layer-item';
    item.setAttribute('data-layer-id', layerId);

    item.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <input type="checkbox" ${layerInfo.visible ? 'checked' : ''} 
                       class="layer-visibility-toggle" data-layer-id="${layerId}">
                <span class="layer-name text-white text-sm font-medium">${layerInfo.name}</span>
            </div>
            <div class="flex items-center space-x-2">
                <button class="text-light-gray hover:text-white transition-colors bg-transparent border-0 p-1" 
                        onclick="zoomToLayer('${layerId}')" title="Zoom to layer">
                    <i class="fas fa-search-plus text-xs"></i>
                </button>
                <button class="text-light-gray hover:text-white transition-colors bg-transparent border-0 p-1" 
                        onclick="removeLayer('${layerId}')" title="Remove layer">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>
        </div>
    `;

    // Add visibility toggle listener
    const checkbox = item.querySelector('.layer-visibility-toggle');
    checkbox.addEventListener('change', (e) => {
        toggleLayerVisibility(layerId, e.target.checked);
    });

    return item;
}

function toggleLayerVisibility(layerId, visible) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) return;

    if (visible) {
        layerInfo.layer.addTo(window.map);
    } else {
        window.map.removeLayer(layerInfo.layer);
    }

    layerInfo.visible = visible;
}

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
window.loadInitialData = loadInitialData;
window.updateLayersList = updateLayersList;
window.createLayerItem = createLayerItem;
window.toggleLayerVisibility = toggleLayerVisibility;
window.zoomToLayer = zoomToLayer;
window.removeLayer = removeLayer;
window.updateLegend = updateLegend;
window.setupModalListeners = setupModalListeners;
window.setupFileUploadListeners = setupFileUploadListeners;
window.setupGlobalEscapeHandler = setupGlobalEscapeHandler;