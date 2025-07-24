/**
 * Layer Manager Module for Aéra Link WebGIS
 * Handles all layer management functionality including loading, saving, visibility, ordering, and UI interactions
 */

// === LAYER MANAGEMENT CORE FUNCTIONS ===

// Add data to map with preloaded style (prevents symbology flash for Aera layer)
function addDataToMapWithPreloadedStyle(geoData, fileName, preloadedStyle, isPermanent = false) {
    const layerId = 'layer_' + (++layerCounter);
    const layerName = fileName.replace(/\.(geojson|json|kml)$/i, '');

    console.log(`🎨 Adding layer with preloaded style (no flash):`, {
        layerId: layerId,
        layerName: layerName,
        fileName: fileName,
        isPermanent: isPermanent,
        hasPreloadedStyle: !!preloadedStyle
    });

    // Validate required parameters
    if (!geoData || !fileName || !layerId) {
        console.error('Cannot add layer: missing required parameters');
        return null;
    }

    // Check if this permanent layer already exists
    if (isPermanent) {
        const existingPermanentLayer = Array.from(layers.values()).find(l => 
            l.isPermanent && l.name === layerName
        );
        if (existingPermanentLayer) {
            console.log(`Permanent layer "${layerName}" already exists, skipping duplicate`);
            return null;
        }
    }

    // Use preloaded style directly - this prevents the flash of default symbology
    let finalStyle = preloadedStyle;
    
    // Apply style based on symbology type
    let layerStyleFunction;
    
    if (preloadedStyle.categoricalField && preloadedStyle.colorMap) {
        // Categorical symbology - apply color mapping per feature
        console.log('📊 Applying categorical symbology with preloaded colors');
        layerStyleFunction = function(feature) {
            const fieldValue = feature.properties[preloadedStyle.categoricalField];
            const color = preloadedStyle.colorMap[fieldValue] || '#14b8a6'; // fallback color
            return {
                color: preloadedStyle.strokeColor || '#000000',
                weight: preloadedStyle.strokeWidth || 0.5,
                opacity: preloadedStyle.strokeOpacity || 1.0,
                fillColor: color,
                fillOpacity: preloadedStyle.fillOpacity || 1.0
            };
        };
    } else {
        // Single symbol symbology - use consistent style
        console.log('🎯 Applying single symbol symbology with preloaded colors');
        layerStyleFunction = {
            color: preloadedStyle.strokeColor || preloadedStyle.color || '#000000',
            weight: preloadedStyle.strokeWidth || preloadedStyle.weight || 0.5,
            opacity: preloadedStyle.strokeOpacity || preloadedStyle.opacity || 0.0,
            fillColor: preloadedStyle.fillColor || '#888888',
            fillOpacity: preloadedStyle.fillOpacity || 0.0
        };
    }

    // Create layer with the correct style applied immediately
    const layer = L.geoJSON(geoData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: layerStyleFunction,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                
                // Bind popup only on right-click (contextmenu)
                layer.on('contextmenu', function(e) {
                    // Popup logic now handled in interaction-handlers.js
                });
            }
        }
    }).addTo(map);

    // Store layer information with preloaded style
    layers.set(layerId, {
        layer: layer,
        name: layerName,
        data: geoData,
        visible: true,
        style: finalStyle, // Store the complete preloaded style object
        originalData: JSON.parse(JSON.stringify(geoData)),
        opacity: preloadedStyle.fillOpacity || 1.0,
        supabaseLayerId: null,
        isPermanent: isPermanent,
        fromDatabase: false,
        layerId: layerId,
        createdAt: new Date().toISOString()
    });

    // Add to layer order for consistent display
    layerOrder.unshift(layerId);

    console.log(`✅ Layer "${layerName}" created with preloaded symbology - no flash occurred`);

    // Update UI elements
    updateLayersList();
    updateLegend();

    // Fit map bounds for permanent layers like Aera
    if (isPermanent) {
        setTimeout(() => {
            try {
                map.fitBounds(layer.getBounds(), { padding: [20, 20] });
                console.log(`Map bounds fitted to ${layerName} layer`);
            } catch (error) {
                console.warn(`Could not fit bounds for ${layerName}:`, error);
            }
        }, 200);
    }

    return layerId;
}

// Add data to map
function addDataToMap(geoData, fileName, fromDatabase = false, supabaseLayerId = null, isPermanent = false) {
    const layerId = 'layer_' + (++layerCounter);
    const layerName = fileName.replace(/\.(geojson|json|kml)$/i, '');

    console.log(`Adding layer to map:`, {
        layerId: layerId,
        layerName: layerName,
        fileName: fileName,
        fromDatabase: fromDatabase,
        supabaseLayerId: supabaseLayerId,
        isPermanent: isPermanent
    });

    // Validate required parameters
    if (!geoData) {
        console.error('Cannot add layer: geoData is missing');
        return null;
    }
    if (!fileName) {
        console.error('Cannot add layer: fileName is missing');
        return null;
    }
    if (!layerId) {
        console.error('Cannot add layer: layerId generation failed');
        return null;
    }

    // Check if this is a permanent layer (like Aera.geojson) that already exists
    if (isPermanent) {
        const existingPermanentLayer = Array.from(layers.values()).find(l => 
            l.isPermanent && l.name === layerName
        );
        if (existingPermanentLayer) {
            console.log(`Permanent layer "${layerName}" already exists, skipping duplicate`);
            return null;
        }
    }

    const style = {
        color: '#000000',
        weight: 0.5,
        opacity: 1.0,
        fillColor: '#888888',
        fillOpacity: 0.7
    };

    const layer = L.geoJSON(geoData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: style,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                
                // Use right-click popup binding (respects selection mode)
                // Popup logic now handled in interaction-handlers.js
            }
        }
    }).addTo(map);

    // Store layer information with Supabase reference if applicable
    layers.set(layerId, {
        layer: layer,
        name: layerName,
        data: geoData, // Store original GeoJSON data
        visible: true,
        style: style,
        originalData: JSON.parse(JSON.stringify(geoData)), // Deep copy for filters
        opacity: 1.0, // Default opacity (100%)
        supabaseLayerId: supabaseLayerId, // Track the Supabase layer ID for database layers
        isPermanent: isPermanent, // Mark permanent layers (like Aera.geojson)
        fromDatabase: fromDatabase, // Track if this came from database
        layerId: layerId, // Store the local layer ID for reference
        createdAt: new Date().toISOString() // Track when layer was created locally
    });

    console.log(`Layer stored in layers map:`, {
        layerId: layerId,
        layerName: layerName,
        mapSize: layers.size,
        stored: layers.has(layerId)
    });

    // Add to layer order (new layers go to the beginning for top display)
    layerOrder.unshift(layerId);

    // Zoom to layer
    map.fitBounds(layer.getBounds());

    // Update UI (but skip legend update during loading from database)
    updateLayersList();
    if (!fromDatabase) {
        // Only update legend immediately for user-uploaded layers
        updateLegend();
    }
    // Note: Legend will be updated after symbology is applied for database layers

    // Save to Supabase ONLY if:
    // 1. Not already from database
    // 2. Supabase is connected
    // 3. Not a permanent/built-in layer
    // 4. Not the Aera layer specifically
    if (!fromDatabase && supabase && !isPermanent && 
        layerName !== 'Aera' && layerName !== 'Aera.geojson') {
        // Add async handling to show user feedback
        console.log(`Starting async save for layer "${layerName}" to Supabase...`);
        saveLayerToSupabase(layerId, layerName, geoData).then(() => {
            // Update UI after successful save to show cloud icon
            updateLayersList();
            console.log(`Layer "${layerName}" save completed and UI updated`);
        }).catch(error => {
            console.error('Failed to save layer to cloud:', error);
            showNotification(`Failed to save layer "${layerName}" to cloud. Layer will only be available locally.`, 'error');
        });
    } else if (isPermanent) {
        console.log(`Permanent layer "${layerName}" loaded successfully (not saved to cloud)`);
    }

    // Update filter system with new layer
    setTimeout(() => {
        console.log(`Layer ${layerId} added, updating filter system...`);
        populateFilterLayers();
    }, 50);

    // Return the layer ID for reference
    return layerId;
}

// === SUPABASE LAYER PERSISTENCE FUNCTIONS ===

// Save layer to Supabase
async function saveLayerToSupabase(layerId, layerName, geoData) {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot save layer');
            showNotification('Please log in to save layers to cloud', 'error');
            return false;
        }

        console.log(`Attempting to save layer "${layerName}" to Supabase...`);

        // First check if a layer with the same name already exists for this user
        // Note: Temporarily skip user_id check if column doesn't exist
        let existingLayers = [];
        let checkError = null;
        
        try {
            const result = await supabase
                .from('layers')
                .select('id, name')
                .eq('name', layerName)
                .eq('user_id', currentUser.id); // Only check current user's layers
            
            existingLayers = result.data || [];
            checkError = result.error;
        } catch (error) {
            console.warn('Could not check for existing layers:', error);
            existingLayers = [];
            checkError = null;
        }

        if (checkError) {
            console.error('Error checking for existing layers:', checkError);
            showNotification(`Error checking cloud storage: ${checkError.message}`, 'error');
            return false;
        }

        // If layer exists, update it instead of creating a new one
        if (existingLayers && existingLayers.length > 0) {
            console.log(`Updating existing layer "${layerName}" in Supabase...`);
            
            // Get layer style safely
            const layerInfo = layers.get(layerId);
            const layerStyle = layerInfo ? layerInfo.style : null;
            
            const { data, error } = await supabase
                .from('layers')
                .update({
                    geojson_data: geoData,
                    style: layerStyle,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingLayers[0].id)
                .eq('user_id', currentUser.id) // Ensure user can only update own layers
                .select();

            if (error) {
                console.error('Error updating layer in Supabase:', error);
                showNotification(`Failed to update layer "${layerName}" in cloud: ${error.message}`, 'error');
                return false;
            } else if (data && data.length > 0) {
                // Store the Supabase ID in the layer info
                if (layerInfo) {
                    layerInfo.supabaseLayerId = data[0].id;
                    layerInfo.fromDatabase = true; // Mark as database layer
                    console.log(`Layer "${layerName}" updated with Supabase ID: ${data[0].id}. LayerInfo updated:`, {
                        layerId: layerId,
                        supabaseLayerId: layerInfo.supabaseLayerId,
                        fromDatabase: layerInfo.fromDatabase,
                        updatedData: data[0]
                    });
                }
                console.log('Layer updated in Supabase successfully:', layerName, 'with ID:', data[0].id);
                showNotification(`Layer "${layerName}" updated in AKL cloud`, 'success');
                return true;
            }
        } else {
            // Create new layer
            console.log(`Creating new layer "${layerName}" in Supabase...`);
            
            // Get layer style safely
            const layerInfo = layers.get(layerId);
            const layerStyle = layerInfo ? layerInfo.style : null;
            
            const { data, error } = await supabase
                .from('layers')
                .insert([
                    {
                        layer_id: layerId,
                        name: layerName,
                        geojson_data: geoData,
                        created_at: new Date().toISOString(),
                        style: layerStyle,
                        user_id: currentUser.id // Associate with current user
                    }
                ])
                .select();

            if (error) {
                console.error('Error saving layer to Supabase:', error);
                showNotification(`Failed to save layer "${layerName}" to cloud: ${error.message}`, 'error');
                return false;
            } else if (data && data.length > 0) {
                // Store the Supabase ID in the layer info for future reference
                if (layerInfo) {
                    layerInfo.supabaseLayerId = data[0].id;
                    layerInfo.fromDatabase = true; // Mark as database layer
                    console.log(`Layer "${layerName}" saved with Supabase ID: ${data[0].id}. LayerInfo updated:`, {
                        layerId: layerId,
                        supabaseLayerId: layerInfo.supabaseLayerId,
                        fromDatabase: layerInfo.fromDatabase,
                        savedData: data[0]
                    });
                }
                console.log('Layer saved to Supabase successfully:', layerName, 'with ID:', data[0].id);
                showNotification(`Layer "${layerName}" saved to AKL cloud`, 'success');
                return true;
            }
        }
        
        return false; // If we reach here, something went wrong
    } catch (error) {
        console.error('Network error saving to Supabase:', error);
        showNotification(`Network error saving layer "${layerName}" to cloud: ${error.message}`, 'error');
        return false;
    }
}

// Load layers from Supabase
async function loadLayersFromSupabase() {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot load layers');
            return;
        }

        console.log('Loading saved layers from Supabase for user:', currentUser.email);

        const { data: savedLayers, error } = await supabase
            .from('layers')
            .select('*')
            .eq('user_id', currentUser.id) // Only load current user's layers
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading layers from Supabase:', error);
            showNotification(`Error loading cloud layers: ${error.message}`, 'error');
            return;
        }

        if (savedLayers && savedLayers.length > 0) {
            console.log(`Found ${savedLayers.length} saved layers in Supabase`);
            
            let loadedCount = 0;
            for (const savedLayer of savedLayers) {
                // Handle Aera layer symbology specially
                if (savedLayer.name === 'Aera' || savedLayer.name === 'Aera.geojson') {
                    console.log(`Found Aera layer symbology in database, applying to existing layer`);
                    
                    // Find the existing Aera layer and apply stored symbology
                    const aeraLayerEntry = Array.from(layers.entries()).find(([layerId, layerInfo]) => 
                        layerInfo.name === 'Aera'
                    );
                    
                    if (aeraLayerEntry && savedLayer.style) {
                        const [aeraLayerId] = aeraLayerEntry;
                        applyStoredSymbology(aeraLayerId, savedLayer.style);
                        console.log('Applied stored symbology to Aera layer');
                    }
                    continue;
                }

                // Skip if layer with the same Supabase ID already exists (exact duplicate from database)
                const existingLayerBySuperbaseId = Array.from(layers.entries()).find(([layerId, layerInfo]) => 
                    layerInfo.supabaseLayerId && layerInfo.supabaseLayerId === savedLayer.id
                );
                if (existingLayerBySuperbaseId) {
                    console.log(`Skipping duplicate layer from database (by Supabase ID): ${savedLayer.name}`);
                    // But still apply symbology if it exists
                    if (savedLayer.style) {
                        const [existingLayerId] = existingLayerBySuperbaseId;
                        applyStoredSymbology(existingLayerId, savedLayer.style);
                    }
                    continue;
                }

                // Skip if layer with the same name already exists and is from database
                const existingLayerByName = Array.from(layers.entries()).find(([layerId, layerInfo]) => 
                    layerInfo.name === savedLayer.name && layerInfo.fromDatabase
                );
                if (existingLayerByName) {
                    console.log(`Skipping duplicate layer from database (by name): ${savedLayer.name}`);
                    // But still apply symbology if it exists
                    if (savedLayer.style) {
                        const [existingLayerId] = existingLayerByName;
                        applyStoredSymbology(existingLayerId, savedLayer.style);
                    }
                    continue;
                }

                try {
                    // Add the saved layer to map with proper metadata
                    const newLayerId = addDataToMap(savedLayer.geojson_data, savedLayer.name, true, savedLayer.id, false);
                    
                    // Apply stored symbology if it exists
                    if (savedLayer.style && newLayerId) {
                        // Wait a bit for the layer to be fully added
                        setTimeout(() => {
                            applyStoredSymbology(newLayerId, savedLayer.style);
                        }, 100);
                    }
                    
                    loadedCount++;
                } catch (layerError) {
                    console.error(`Error loading layer "${savedLayer.name}":`, layerError);
                }
            }
            
            if (loadedCount > 0) {
                showNotification(`Loaded ${loadedCount} layers from AKL cloud`, 'success');
            } else {
                console.log('No new layers to load from Supabase (all already present)');
            }
            
            // Update legend after all symbology has been applied (with a small delay)
            setTimeout(() => {
                updateLegend();
            }, 200);
        } else {
            console.log('No saved layers found in Supabase for current user');
        }
    } catch (error) {
        console.error('Network error loading from Supabase:', error);
        showNotification(`Network error loading cloud layers: ${error.message}`, 'error');
    }
}

// Update layer in Supabase (for style changes, etc.)
async function updateLayerInSupabase(layerId) {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot update layer');
            return;
        }

        const layerInfo = layers.get(layerId);
        if (!layerInfo) return;

        let query = supabase.from('layers').update({
            style: layerInfo.style,
            geojson_data: layerInfo.data,
            updated_at: new Date().toISOString()
        }).eq('user_id', currentUser.id); // Ensure user owns the layer

        // Use Supabase layer ID if available, otherwise fall back to local layer ID
        if (layerInfo.supabaseLayerId) {
            query = query.eq('id', layerInfo.supabaseLayerId);
        } else {
            query = query.eq('layer_id', layerId);
        }

        const { error } = await query;

        if (error) {
            console.error('Error updating layer in Supabase:', error);
        } else {
            console.log('Layer updated in Supabase successfully');
        }
    } catch (error) {
        console.error('Network error updating Supabase:', error);
    }
}

// Delete layer from Supabase
async function deleteLayerFromSupabase(layerId, layerName = 'Unknown') {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot delete layer');
            return { success: false, error: 'User not authenticated' };
        }

        const layerInfo = layers.get(layerId);
        if (!layerInfo) {
            console.error(`Layer info not found for layerId: ${layerId}`);
            return { success: false, error: 'Layer not found in local storage' };
        }

        // Don't delete permanent layers from database
        if (layerInfo.isPermanent) {
            console.log(`Skipping database deletion for permanent layer: ${layerName}`);
            return { success: true }; // Return success since permanent layers shouldn't be in DB anyway
        }

        console.log(`Attempting to delete layer from Supabase:`, {
            localLayerId: layerId,
            supabaseLayerId: layerInfo.supabaseLayerId,
            layerName: layerName,
            userId: currentUser.id,
            fromDatabase: layerInfo.fromDatabase,
            isPermanent: layerInfo.isPermanent,
            hasSupabaseId: !!(layerInfo.supabaseLayerId && layerInfo.supabaseLayerId !== null && layerInfo.supabaseLayerId !== 'null')
        });

        // If the layer doesn't have a supabaseLayerId and wasn't loaded from database, 
        // it's likely a local-only layer that was never saved
        if (!layerInfo.supabaseLayerId && !layerInfo.fromDatabase) {
            console.log(`Layer "${layerName}" is local-only (no Supabase ID), skipping database deletion`);
            return { success: true };
        }

        let query = supabase.from('layers').delete().eq('user_id', currentUser.id); // Ensure user can only delete own layers
        let queryDescription = '';
        
        // Use Supabase layer ID if available (more reliable), otherwise try layer name
        if (layerInfo.supabaseLayerId && layerInfo.supabaseLayerId !== null && layerInfo.supabaseLayerId !== 'null') {
            query = query.eq('id', layerInfo.supabaseLayerId);
            queryDescription = `Supabase ID: ${layerInfo.supabaseLayerId}, User ID: ${currentUser.id}`;
        } else if (layerInfo.fromDatabase) {
            // If it came from database but no supabaseLayerId, try to find by name and layer_id
            query = query.eq('name', layerName).eq('layer_id', layerId);
            queryDescription = `Name: ${layerName}, Layer ID: ${layerId}, User ID: ${currentUser.id}`;
        } else {
            // Last resort: try deleting by layer_id only (for newly uploaded layers)
            query = query.eq('layer_id', layerId);
            queryDescription = `Layer ID: ${layerId}, User ID: ${currentUser.id}`;
        }

        console.log(`Executing delete query with ${queryDescription}`);
        const { data, error } = await query;

        console.log(`Delete query result:`, {
            queryDescription: queryDescription,
            resultData: data,
            error: error,
            hasData: !!data,
            dataLength: data ? data.length : 0
        });

        if (error) {
            console.error(`Error deleting layer "${layerName}" from Supabase:`, error);
            return { success: false, error: `Database error: ${error.message}` };
        } else {
            console.log(`Layer "${layerName}" deleted from Supabase successfully using ${queryDescription}`);
            return { success: true };
        }
    } catch (error) {
        console.error(`Network error deleting layer "${layerName}" from Supabase:`, error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// === LAYER INITIALIZATION FUNCTIONS ===

// Clear cached data from old/deprecated layers to prevent symbology conflicts
function clearOldLayerCaches() {
    console.log('🧹 Clearing old layer caches to prevent symbology conflicts...');
    
    try {
        // Clear localStorage entries that might contain old layer references
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('layer_') || key.includes('symbology') || key.includes('style'))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed cached item: ${key}`);
        });

        // Clear sessionStorage entries that might contain old layer references  
        const sessionKeysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && (key.startsWith('layer_') || key.includes('symbology') || key.includes('style'))) {
                sessionKeysToRemove.push(key);
            }
        }
        sessionKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
            console.log(`🗑️ Removed cached session item: ${key}`);
        });

        // Clear any global variables that might hold old layer references
        if (typeof window.cachedLayerStyles !== 'undefined') {
            delete window.cachedLayerStyles;
            console.log('🗑️ Cleared global cachedLayerStyles');
        }

        console.log('✅ Old layer cache cleanup completed');
    } catch (error) {
        console.warn('Warning: Could not fully clear old layer caches:', error);
    }
}

// Load initial Aera.geojson data
function loadInitialData() {
    // Clear any cached references to old layers (specifically layer_1)
    // This prevents loading of stale symbology from memory
    clearOldLayerCaches();
    localStorage.removeItem('layer_1_symbology');
    sessionStorage.removeItem('layer_1_symbology');
    
    // For Aera layer specifically: Load symbology FIRST, then apply it during layer creation
    // This eliminates the brief flash of default teal symbology
    if (supabase && currentUser) {
        console.log('🎨 Preloading Aera symbology to prevent flash...');
        loadAeraWithCorrectSymbology();
    } else {
        // Fallback: Load without symbology preloading
        loadAeraWithDefaultSymbology();
    }
    
    // Load saved layers from Supabase after Aera is properly loaded
    if (supabase) {
        setTimeout(() => {
            loadLayersFromSupabase();
            
            // Populate filter layers after Supabase layers load
            setTimeout(() => {
                console.log('Supabase layers loaded, refreshing filter layers');
                populateFilterLayers();
            }, 500);
        }, 700); // Increased delay to ensure Aera loads with correct symbology first
    }
}

// Load Aera.geojson with preloaded correct symbology (prevents flash)
async function loadAeraWithCorrectSymbology() {
    try {
        console.log('🔍 Checking for stored Aera symbology before layer creation...');
        
        // First, get the stored symbology for Aera layer
        const { data: aeraSymbology, error: symbologyError } = await supabase
            .from('layers')
            .select('style')
            .eq('user_id', currentUser.id)
            .eq('name', 'Aera')
            .single();

        if (symbologyError && symbologyError.code !== 'PGRST116') {
            console.error('Error fetching Aera symbology:', symbologyError);
            loadAeraWithDefaultSymbology();
            return;
        }

        // Now load the GeoJSON file
        const response = await fetch('Aera.geojson');
        const geoData = await response.json();

        if (aeraSymbology && aeraSymbology.style) {
            console.log('✅ Found stored Aera symbology, applying directly during layer creation');
            // Create layer with stored symbology immediately - NO FLASH
            addDataToMapWithPreloadedStyle(geoData, 'Aera.geojson', aeraSymbology.style, true);
        } else {
            console.log('ℹ️ No stored Aera symbology found, using default');
            // Use default symbology
            addDataToMap(geoData, 'Aera.geojson', false, null, true);
        }

        // Populate filter layers after initial data is loaded
        setTimeout(() => {
            console.log('Initial Aera data loaded, populating filter layers');
            populateFilterLayers();
        }, 100);

    } catch (error) {
        console.error('Error in loadAeraWithCorrectSymbology:', error);
        // Fallback to default loading
        loadAeraWithDefaultSymbology();
    }
}

// Fallback method for loading Aera with default symbology
function loadAeraWithDefaultSymbology() {
    console.log('📥 Loading Aera.geojson with default symbology...');
    
    fetch('Aera.geojson')
        .then(response => response.json())
        .then(data => {
            // Mark as permanent layer and from local source
            addDataToMap(data, 'Aera.geojson', false, null, true);
            
            // Populate filter layers after initial data is loaded
            setTimeout(() => {
                console.log('Initial data loaded, populating filter layers');
                populateFilterLayers();
            }, 100);
        })
        .catch(error => {
            console.error('Error loading Aera.geojson:', error);
            // Continue without the initial data
        });
}

// === LAYER UI MANAGEMENT FUNCTIONS ===

// Update layers list in sidebar
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';

    // Use layerOrder to maintain consistent ordering
    layerOrder.forEach(layerId => {
        if (!layers.has(layerId)) return; // Skip deleted layers

        const layerInfo = layers.get(layerId);
        const layerDiv = document.createElement('div');
        layerDiv.className = 'layer-item rounded-lg p-3 glass-panel';
        layerDiv.draggable = true;
        layerDiv.setAttribute('data-layer-id', layerId);
        layerDiv.setAttribute('data-layer-name', layerInfo.name);
        
        layerDiv.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center space-x-2">
                    <i class="fas fa-grip-vertical layer-drag-handle text-sm"></i>
                    <span class="font-medium ${layerInfo.isPermanent ? 'text-amber-300' : 'text-white'} truncate">
                        ${layerInfo.name}
                        ${layerInfo.isPermanent ? '<i class="fas fa-lock text-xs ml-1" title="Permanent layer - cannot be deleted"></i>' : ''}
                        ${layerInfo.fromDatabase ? '<i class="fas fa-cloud text-xs ml-1 text-blue-400" title="Saved to cloud"></i>' : ''}
                    </span>
                </div>
                <div class="flex items-center space-x-3">
                    <button class="symbology-btn text-teal-400 hover:text-teal-300 text-lg transition-colors" data-layer="${layerId}" title="Edit Symbology">
                        <i class="fas fa-palette"></i>
                    </button>
                    <button class="visibility-btn text-lg transition-colors cursor-pointer" data-layer="${layerId}" title="Toggle Visibility">
                        <i class="fas ${layerInfo.visible ? 'fa-eye text-teal-400 hover:text-teal-300' : 'fa-eye-slash text-gray-500 hover:text-gray-400'}"></i>
                    </button>
                </div>
            </div>
            <div class="text-xs text-gray-400 italic">
                ${Object.keys(layerInfo.data.features || {}).length || layerInfo.data.features?.length || 0} features
                ${layerInfo.isPermanent ? ' • Built-in layer' : ''}
                ${layerInfo.fromDatabase && !layerInfo.isPermanent ? ' • Cloud synced' : ''}
            </div>
        `;

        layersList.appendChild(layerDiv);

        // Setup drag and drop for this layer
        setupLayerDragDrop(layerDiv, layerId);

        // Add existing event listeners
        const visibilityBtn = layerDiv.querySelector('.visibility-btn');
        visibilityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentVisibility = layers.get(layerId).visible;
            toggleLayerVisibility(layerId, !currentVisibility);
        });

        const symbologyBtn = layerDiv.querySelector('.symbology-btn');
        symbologyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Symbology button clicked for layer:', layerId);
            try {
                openSymbologyEditor(layerId);
            } catch (error) {
                console.error('Error opening symbology editor:', error);
                showError('Error opening symbology editor. Check console for details.', 'Symbology Error');
            }
        });

        // Add right-click context menu listener to the layer item
        layerDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showLayerContextMenu(e, layerId, layerInfo.name);
        });
    });
    
    // Update map layer order after UI update
    updateMapLayerOrder();
    // Update selection layer dropdown
    updateSelectionLayerDropdown();
}

// Setup drag and drop for layer items
function setupLayerDragDrop(layerDiv, layerId) {
    console.log(`Setting up drag-and-drop for layer: ${layerId}`);

    // Drag start
    layerDiv.addEventListener('dragstart', (e) => {
        console.log(`Drag started for layer: ${layerId}`);
        layerDiv.classList.add('dragging');
        layerDiv.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', layerId);
        
        // Store reference for other event listeners
        layerDiv.setAttribute('data-dragging', 'true');
    });

    // Drag end
    layerDiv.addEventListener('dragend', (e) => {
        console.log(`Drag ended for layer: ${layerId}`);
        layerDiv.classList.remove('dragging');
        layerDiv.style.opacity = '1';
        layerDiv.removeAttribute('data-dragging');
        
        // Remove drag-over class from all layer items
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('drag-over');
        });
    });

    // Drag over - CRITICAL: Must prevent default to allow drop
    layerDiv.addEventListener('dragover', (e) => {
        e.preventDefault(); // This is essential!
        e.stopPropagation();
        
        const draggingElement = document.querySelector('[data-dragging="true"]');
        if (draggingElement && draggingElement !== layerDiv) {
            e.dataTransfer.dropEffect = 'move';
            layerDiv.classList.add('drag-over');
        }
    });

    // Drag enter
    layerDiv.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const draggingElement = document.querySelector('[data-dragging="true"]');
        if (draggingElement && draggingElement !== layerDiv) {
            layerDiv.classList.add('drag-over');
        }
    });

    // Drag leave
    layerDiv.addEventListener('dragleave', (e) => {
        // Only remove drag-over if we're actually leaving this element
        if (!layerDiv.contains(e.relatedTarget)) {
            layerDiv.classList.remove('drag-over');
        }
    });

    // Drop
    layerDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`Drop event on layer: ${layerId}`);
        layerDiv.classList.remove('drag-over');
        
        const draggedLayerId = e.dataTransfer.getData('text/plain');
        const targetLayerId = layerId;
        
        console.log(`Attempting to reorder: ${draggedLayerId} -> ${targetLayerId}`);
        
        if (draggedLayerId && draggedLayerId !== targetLayerId) {
            reorderLayer(draggedLayerId, targetLayerId);
        }
    });
}

// Reorder layers in the layerOrder array
function reorderLayer(draggedLayerId, targetLayerId) {
    console.log(`Reordering layers:`, {
        draggedLayerId: draggedLayerId,
        targetLayerId: targetLayerId,
        currentOrder: [...layerOrder]
    });

    const draggedIndex = layerOrder.indexOf(draggedLayerId);
    const targetIndex = layerOrder.indexOf(targetLayerId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
        // Remove the dragged layer from its current position
        layerOrder.splice(draggedIndex, 1);
        
        // Insert it at the target position
        const newTargetIndex = layerOrder.indexOf(targetLayerId);
        layerOrder.splice(newTargetIndex, 0, draggedLayerId);
        
        console.log(`Layer order updated:`, {
            oldIndex: draggedIndex,
            newIndex: layerOrder.indexOf(draggedLayerId),
            newOrder: [...layerOrder]
        });
        
        // Update the UI and map rendering order
        updateLayersList();
        updateMapLayerOrder();
        
        // Show feedback to user
        const draggedLayerInfo = layers.get(draggedLayerId);
        const draggedLayerName = draggedLayerInfo ? draggedLayerInfo.name : 'Unknown';
        showNotification(`Layer "${draggedLayerName}" reordered successfully`, 'success', 2000);
    }
}

// Update map layer rendering order
function updateMapLayerOrder() {
    console.log('Updating map layer rendering order:', layerOrder);
    
    // CORRECTED LOGIC:
    // - Top layer in panel = highest z-index (rendered on top) 
    // - Bottom layer in panel = lowest z-index (rendered at back)
    // - Process layerOrder directly: first item = top of panel = should be on top of map
    
    // First, bring all layers to back to reset their z-index order
    layerOrder.forEach((layerId) => {
        const layerInfo = layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.layer) {
            try {
                layerInfo.layer.bringToBack();
            } catch (error) {
                console.warn(`Could not bring layer ${layerId} to back:`, error);
            }
        }
    });
    
    // Then, bring layers to front in REVERSE order
    // This ensures the FIRST layer in layerOrder (top of panel) ends up on top of map
    const reversedOrder = [...layerOrder].reverse();
    reversedOrder.forEach((layerId) => {
        const layerInfo = layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.layer) {
            try {
                layerInfo.layer.bringToFront();
                console.log(`Brought layer "${layerInfo.name}" (${layerId}) to front - Panel position: ${layerOrder.indexOf(layerId) + 1}`);
            } catch (error) {
                console.warn(`Could not bring layer ${layerId} to front:`, error);
            }
        }
    });
    
    console.log('Map layer rendering order updated successfully');
    console.log('Final z-index order (bottom to top):', reversedOrder.map(id => {
        const info = layers.get(id);
        return info ? info.name : id;
    }));
}

// Update selection layer dropdown with visible layers
function updateSelectionLayerDropdown() {
    const activeLayerSelect = document.getElementById('activeLayerSelect');
    const currentValue = activeLayerSelect.value;
    
    // Clear existing options
    activeLayerSelect.innerHTML = '<option value="">Select a layer first</option>';
    
    // Add visible layers to dropdown
    layers.forEach((layerInfo, layerId) => {
        if (layerInfo.visible) {
            const option = document.createElement('option');
            option.value = layerId;
            option.textContent = layerInfo.name;
            
            // Keep current selection if still valid
            if (layerId === currentValue) {
                option.selected = true;
            }
            
            activeLayerSelect.appendChild(option);
        }
    });
    
    // If current selection is no longer valid, reset
    if (currentValue && !layers.has(currentValue) || (currentValue && !layers.get(currentValue).visible)) {
        activeSelectionLayerId = null;
        activeLayerSelect.value = '';
        
        // Disable activate button
        const activateBtn = document.getElementById('activateSelectTool');
        activateBtn.disabled = true;
        activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // If selection is active, deactivate it
        if (isSelectionActive) {
            deactivateSelectionTool();
        }
    }
}

// Toggle layer visibility
function toggleLayerVisibility(layerId, visible) {
    const layerInfo = layers.get(layerId);
    if (layerInfo) {
        if (visible) {
            map.addLayer(layerInfo.layer);
        } else {
            map.removeLayer(layerInfo.layer);
        }
        layerInfo.visible = visible;
        
        // Update map layer order after visibility change
        updateMapLayerOrder();
        
        updateLegend();
        updateSelectionLayerDropdown(); // Update selection dropdown when layer visibility changes
        populateFilterLayers(); // Update filter dropdown when layer visibility changes
        updateLayersList(); // Update layer list to refresh icons
    }
}

// === LAYER CONTEXT MENU FUNCTIONS ===

// Layer Context Menu Functions
let currentContextLayerId = null;
let currentContextLayerName = null;

// Show layer context menu
function showLayerContextMenu(event, layerId, layerName) {
    console.log(`Showing context menu for layer:`, {
        layerId: layerId,
        layerName: layerName,
        layerExists: layers.has(layerId)
    });

    // Validate parameters
    if (!layerId) {
        console.error('Cannot show context menu: layerId is null or undefined');
        return;
    }
    if (!layerName) {
        console.error('Cannot show context menu: layerName is null or undefined');
        return;
    }

    // Verify layer exists in the layers map
    if (!layers.has(layerId)) {
        console.error(`Cannot show context menu: Layer ${layerId} not found in layers map`);
        console.log('Available layers:', Array.from(layers.keys()));
        return;
    }

    const contextMenu = document.getElementById('layerContextMenu');
    const deleteItem = document.getElementById('contextDelete');
    const renameItem = document.getElementById('contextRename');
    
    // Reset and set the context variables for the new layer
    currentContextLayerId = layerId;
    currentContextLayerName = layerName;
    
    console.log(`Context menu variables set:`, {
        currentContextLayerId: currentContextLayerId,
        currentContextLayerName: currentContextLayerName
    });
    
    const layerInfo = layers.get(layerId);
    // Check if this is a permanent layer and disable delete/rename if so
    const isPermanentLayer = layerInfo && layerInfo.isPermanent;
    if (isPermanentLayer) {
        deleteItem.classList.add('disabled');
        renameItem.classList.add('disabled');
    } else {
        deleteItem.classList.remove('disabled');
        renameItem.classList.remove('disabled');
    }
    
    // Position the context menu at cursor location
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    
    // Ensure menu stays within viewport
    const rect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (rect.right > viewportWidth) {
        contextMenu.style.left = (event.clientX - rect.width) + 'px';
    }
    if (rect.bottom > viewportHeight) {
        contextMenu.style.top = (event.clientY - rect.height) + 'px';
    }
    
    // Prevent event propagation
    event.stopPropagation();
}

// Hide layer context menu
function hideLayerContextMenu() {
    const contextMenu = document.getElementById('layerContextMenu');
    contextMenu.style.display = 'none';
    
    // Don't reset the context variables immediately - they might be needed for menu actions
    // They will be reset when a new context menu is shown
}

// Reset context menu variables (called after actions are completed)
function resetContextMenuVariables() {
    currentContextLayerId = null;
    currentContextLayerName = null;
}

// Setup context menu event listeners
function setupLayerContextMenuListeners() {
    const contextMenu = document.getElementById('layerContextMenu');
    
    // Prevent menu from closing when clicking inside it
    contextMenu.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Zoom to Layer
    document.getElementById('contextZoomToLayer').addEventListener('click', function() {
        if (currentContextLayerId) {
            zoomToLayer(currentContextLayerId);
            hideLayerContextMenu();
        }
    });
    
    // Rename Layer
    document.getElementById('contextRename').addEventListener('click', function() {
        if (currentContextLayerId && currentContextLayerName) {
            hideLayerContextMenu();
            renameLayer(currentContextLayerId, currentContextLayerName);
        }
    });
    
    // Properties (open symbology editor)
    document.getElementById('contextProperties').addEventListener('click', function() {
        if (currentContextLayerId) {
            try {
                openSymbologyEditor(currentContextLayerId);
                hideLayerContextMenu();
            } catch (error) {
                console.error('Error opening symbology editor:', error);
                showError('Error opening symbology editor. Check console for details.', 'Symbology Error');
            }
        }
    });
    
    // Delete Layer
    document.getElementById('contextDelete').addEventListener('click', async function() {
        console.log(`Delete layer clicked:`, {
            currentContextLayerId: currentContextLayerId,
            currentContextLayerName: currentContextLayerName,
            disabled: this.classList.contains('disabled')
        });

        // Get layer information from the stored context variables
        const layerIdToDelete = currentContextLayerId;
        const layerNameToDelete = currentContextLayerName;

        // Validate we have the required information
        if (!layerIdToDelete) {
            console.error('Cannot delete layer: No layer ID available from context menu');
            showNotification('Cannot delete layer: No layer selected.', 'error');
            hideLayerContextMenu();
            return;
        }

        if (!layerNameToDelete) {
            console.error('Cannot delete layer: No layer name available from context menu');
            showNotification('Cannot delete layer: No layer name available.', 'error');
            hideLayerContextMenu();
            return;
        }

        if (!this.classList.contains('disabled')) {
            // Validate layer exists before attempting deletion
            if (!layers.has(layerIdToDelete)) {
                console.error(`Cannot delete layer: Layer ${layerIdToDelete} not found in layers map`);
                showNotification(`Layer not found in system. Cannot delete.`, 'error');
                resetContextMenuVariables();
                return;
            }

            // Hide menu first, then delete
            hideLayerContextMenu();
            
            try {
                await deleteLayer(layerIdToDelete, layerNameToDelete);
            } finally {
                // Always reset variables after deletion attempt
                resetContextMenuVariables();
            }
        } else if (this.classList.contains('disabled')) {
            const layerInfo = layers.get(layerIdToDelete);
            if (layerInfo && layerInfo.isPermanent) {
                showNotification(`"${layerNameToDelete}" is a permanent layer and cannot be deleted.`, 'info');
            } else {
                showNotification('This layer cannot be deleted.', 'info');
            }
            resetContextMenuVariables();
        } else {
            console.error('Delete layer failed: No valid layer ID or name available');
            showNotification('Cannot delete layer: Invalid layer reference.', 'error');
            resetContextMenuVariables();
        }
    });
}

// Zoom to layer function
function zoomToLayer(layerId) {
    const layerInfo = layers.get(layerId);
    if (layerInfo && layerInfo.visible && layerInfo.layer) {
        try {
            const bounds = layerInfo.layer.getBounds();
            if (bounds && bounds.isValid()) {
                map.fitBounds(bounds);
            } else {
                showWarning('Unable to determine layer extent.', 'Zoom Error');
            }
        } catch (error) {
            console.error('Error zooming to layer:', error);
            showError('Error zooming to layer.', 'Zoom Error');
        }
    } else {
        showError('Layer is not visible or not found.', 'Selection Error');
    }
}

// Delete layer function
async function deleteLayer(layerId, layerName) {
    console.log(`Starting deleteLayer function:`, {
        layerId: layerId,
        layerName: layerName,
        layersMapSize: layers.size,
        layerExists: layers.has(layerId)
    });

    // Comprehensive validation
    if (!layerId) {
        const errorMsg = `Cannot delete layer: layerId is null or undefined`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    if (!layerName) {
        const errorMsg = `Cannot delete layer: layerName is null or undefined for layer ID ${layerId}`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    // Verify layer exists in layers map
    if (!layers.has(layerId)) {
        const errorMsg = `Layer "${layerName}" (ID: ${layerId}) not found in layers collection`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    // Get layer info and validate it exists
    const layerInfo = layers.get(layerId);
    if (!layerInfo) {
        const errorMsg = `Layer info for "${layerName}" (ID: ${layerId}) is null or undefined`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    // Prevent deletion of permanent layers
    if (layerInfo.isPermanent) {
        const msg = `"${layerName}" is a permanent layer and cannot be deleted.`;
        console.log(msg);
        showNotification(msg, 'info');
        return;
    }

    // Confirm deletion
    const confirmed = await showConfirm(`Are you sure you want to delete the layer "${layerName}"?`, 'Delete Layer');
    if (confirmed) {
        console.log(`Starting deletion process for layer:`, {
            layerId: layerId,
            layerName: layerName,
            supabaseLayerId: layerInfo.supabaseLayerId,
            isPermanent: layerInfo.isPermanent,
            fromDatabase: layerInfo.fromDatabase
        });
        
        try {
            // Delete from Supabase first (if it's a database layer or has been saved)
            if (supabase && !layerInfo.isPermanent) {
                // Check if this layer should be deleted from database
                const shouldDeleteFromDB = layerInfo.fromDatabase || 
                                           (layerInfo.supabaseLayerId && 
                                            layerInfo.supabaseLayerId !== null && 
                                            layerInfo.supabaseLayerId !== 'null');
                
                if (shouldDeleteFromDB) {
                    console.log(`Deleting layer "${layerName}" from Supabase...`);
                    const deleteResult = await deleteLayerFromSupabase(layerId, layerName);
                    
                    if (!deleteResult.success) {
                        console.error(`Database deletion failed:`, deleteResult.error);
                        const fallbackConfirmed = await showConfirm(`Failed to delete layer from database: ${deleteResult.error}\n\nDo you want to delete it locally anyway?`, 'Database Deletion Failed');
                        if (fallbackConfirmed) {
                            console.log('User chose to delete locally despite database error');
                        } else {
                            return; // User cancelled, don't delete locally
                        }
                    } else {
                        console.log(`Layer "${layerName}" successfully deleted from Supabase`);
                    }
                } else {
                    console.log(`Layer "${layerName}" is local-only, no database deletion needed`);
                }
            } else if (layerInfo.isPermanent) {
                console.log(`Layer "${layerName}" is permanent, skipping database deletion`);
            }

            // Remove layer from map
            if (layerInfo.layer) {
                map.removeLayer(layerInfo.layer);
                console.log(`Layer "${layerName}" removed from map`);
            } else {
                console.warn(`Layer "${layerName}" has no map layer to remove`);
            }
            
            // Remove from layers collection
            layers.delete(layerId);
            console.log(`Layer "${layerName}" removed from layers collection`);
            
            // Remove from layer order
            const orderIndex = layerOrder.indexOf(layerId);
            if (orderIndex !== -1) {
                layerOrder.splice(orderIndex, 1);
                console.log(`Layer "${layerName}" removed from layer order at index ${orderIndex}`);
            } else {
                console.warn(`Layer "${layerName}" not found in layer order array`);
            }
            
            // Remove any active filters for this layer
            if (activeFilters.has(layerId)) {
                activeFilters.delete(layerId);
                console.log(`Filters removed for layer "${layerName}"`);
            }
            
            // If this layer was selected for selection tool, deactivate it
            if (activeSelectionLayerId === layerId) {
                activeSelectionLayerId = null;
                if (isSelectionActive) {
                    deactivateSelectionTool();
                }
                console.log(`Selection tool deactivated for deleted layer "${layerName}"`);
            }
            
            // Update UI
            updateLayersList();
            updateLegend();
            updateSelectionLayerDropdown();
            populateFilterLayers();
            
            console.log(`Layer "${layerName}" (${layerId}) deleted successfully`);
            
            // Show success notification
            showNotification(`Layer "${layerName}" deleted successfully`, 'success');
            
        } catch (error) {
            console.error('Error during layer deletion:', error);
            showNotification(`Error deleting layer "${layerName}": ${error.message}`, 'error');
        }
    }
}

// Rename layer function
async function renameLayer(layerId, currentName) {
    console.log(`Starting renameLayer function:`, {
        layerId: layerId,
        currentName: currentName,
        layerExists: layers.has(layerId)
    });

    // Validate parameters
    if (!layerId) {
        console.error('Cannot rename layer: layerId is null or undefined');
        showNotification('Cannot rename layer: No layer ID provided.', 'error');
        return;
    }

    if (!currentName) {
        console.error('Cannot rename layer: currentName is null or undefined');
        showNotification('Cannot rename layer: No current name provided.', 'error');
        return;
    }

    // Verify layer exists in layers map
    if (!layers.has(layerId)) {
        const errorMsg = `Layer "${currentName}" (ID: ${layerId}) not found in layers collection`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    // Get layer info and validate it exists
    const layerInfo = layers.get(layerId);
    if (!layerInfo) {
        const errorMsg = `Layer info for "${currentName}" (ID: ${layerId}) is null or undefined`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    // Prevent renaming of permanent layers
    if (layerInfo.isPermanent) {
        const msg = `"${currentName}" is a permanent layer and cannot be renamed.`;
        console.log(msg);
        showNotification(msg, 'info');
        return;
    }

    // Prompt user for new name
    const newName = await showPrompt(`Enter new name for layer "${currentName}":`, currentName, 'Rename Layer');
    
    if (newName === null) {
        // User cancelled
        return;
    }
    
    if (newName.trim() === '') {
        showNotification('Layer name cannot be empty.', 'error');
        return;
    }
    
    if (newName.trim() === currentName) {
        // No change needed
        return;
    }

    const trimmedNewName = newName.trim();

    // Check if another layer already has this name
    const existingLayerWithName = Array.from(layers.values()).find(layer => 
        layer.name === trimmedNewName && layer !== layerInfo
    );
    
    if (existingLayerWithName) {
        showNotification(`A layer named "${trimmedNewName}" already exists.`, 'error');
        return;
    }

    try {
        console.log(`Renaming layer from "${currentName}" to "${trimmedNewName}"`);

        // Update the layer name locally
        layerInfo.name = trimmedNewName;
        
        // Update Supabase if layer is from database or has been saved
        if (supabase && (layerInfo.fromDatabase || layerInfo.supabaseLayerId)) {
            console.log(`Updating layer name in Supabase...`);
            const updateResult = await updateLayerNameInSupabase(layerId, trimmedNewName);
            if (!updateResult.success) {
                console.error('Failed to update layer name in Supabase:', updateResult.error);
                showNotification(`Layer renamed locally, but failed to update in cloud: ${updateResult.error}`, 'error');
            }
        }

        // Update the UI
        updateLayersList();
        updateSelectionLayerDropdown();
        updateLegend();

        // Show success notification
        showNotification(`Layer renamed to "${trimmedNewName}" successfully`, 'success', 2000);
        
        console.log(`Layer renamed successfully:`, {
            layerId: layerId,
            oldName: currentName,
            newName: trimmedNewName
        });

    } catch (error) {
        console.error('Error renaming layer:', error);
        showNotification(`Error renaming layer: ${error.message}`, 'error');
        
        // Revert local name change if error occurred
        layerInfo.name = currentName;
    }
}

// Update layer name in Supabase
async function updateLayerNameInSupabase(layerId, newName) {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot update layer name');
            return { success: false, error: 'User not authenticated' };
        }

        const layerInfo = layers.get(layerId);
        if (!layerInfo) {
            return { success: false, error: 'Layer not found in local storage' };
        }

        console.log(`Attempting to update layer name in Supabase:`, {
            localLayerId: layerId,
            supabaseLayerId: layerInfo.supabaseLayerId,
            newName: newName,
            userId: currentUser.id
        });

        let query = supabase.from('layers').update({
            name: newName,
            updated_at: new Date().toISOString()
        }).eq('user_id', currentUser.id); // Ensure user owns the layer

        // Use Supabase layer ID if available, otherwise fall back to local layer ID
        if (layerInfo.supabaseLayerId && layerInfo.supabaseLayerId !== null && layerInfo.supabaseLayerId !== 'null') {
            query = query.eq('id', layerInfo.supabaseLayerId);
        } else {
            query = query.eq('layer_id', layerId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error updating layer name in Supabase:', error);
            return { success: false, error: `Database error: ${error.message}` };
        } else {
            console.log('Layer name updated in Supabase successfully');
            return { success: true };
        }
    } catch (error) {
        console.error('Network error updating layer name in Supabase:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// === LAYER SYMBOLOGY FUNCTIONS ===

// Save symbology settings to Supabase
async function saveSymbologyToSupabase(layerId, symbologyData) {
    if (!supabase || !currentUser) {
        console.log('Supabase not available or user not logged in, skipping symbology save');
        return;
    }

    try {
        const layerInfo = layers.get(layerId);
        if (!layerInfo) {
            console.warn('Layer info not found for symbology save:', layerId);
            return;
        }

        console.log(`Saving symbology to Supabase for layer: ${layerId}`, symbologyData);

        // For Aera.geojson, we need to handle it specially since it's a built-in layer
        if (layerId === 'aera-layer' || layerInfo.name === 'Aera') {
            // Check if user already has an Aera layer record
            const { data: existingAera, error: checkError } = await supabase
                .from('layers')
                .select('id, style')
                .eq('user_id', currentUser.id)
                .eq('name', 'Aera')
                .single();

            if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error('Error checking for existing Aera layer:', checkError);
                return;
            }

            if (existingAera) {
                // Update existing Aera layer style
                const { error: updateError } = await supabase
                    .from('layers')
                    .update({
                        style: symbologyData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingAera.id);

                if (updateError) {
                    console.error('Error updating Aera layer symbology:', updateError);
                } else {
                    console.log('Aera layer symbology updated successfully');
                }
            } else {
                // Create new Aera layer record for this user
                const { error: insertError } = await supabase
                    .from('layers')
                    .insert({
                        layer_id: 'aera-' + currentUser.id,
                        name: 'Aera',
                        geojson_data: layerInfo.data,
                        style: symbologyData,
                        user_id: currentUser.id,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (insertError) {
                    console.error('Error creating Aera layer record:', insertError);
                } else {
                    console.log('Aera layer record created with symbology');
                    layerInfo.fromDatabase = true;
                    layerInfo.supabaseLayerId = 'aera-' + currentUser.id;
                }
            }
        } else {
            // Handle regular user-uploaded layers
            let query = supabase.from('layers').update({
                style: symbologyData,
                updated_at: new Date().toISOString()
            }).eq('user_id', currentUser.id);

            // Use Supabase layer ID if available, otherwise fall back to local layer ID
            if (layerInfo.supabaseLayerId && layerInfo.supabaseLayerId !== null && layerInfo.supabaseLayerId !== 'null') {
                query = query.eq('id', layerInfo.supabaseLayerId);
            } else {
                query = query.eq('layer_id', layerId);
            }

            const { error } = await query;

            if (error) {
                console.error('Error saving symbology to Supabase:', error);
            } else {
                console.log('Symbology saved to Supabase successfully');
            }
        }
    } catch (error) {
        console.error('Network error saving symbology to Supabase:', error);
    }
}

// Apply stored symbology from Supabase data
function applyStoredSymbology(layerId, symbologyData) {
    console.log('Applying stored symbology for layer:', layerId, symbologyData);
    
    if (!symbologyData) {
        console.log('No symbology data to apply');
        return;
    }

    const layerInfo = layers.get(layerId);
    if (!layerInfo) {
        console.warn('Layer info not found for symbology application:', layerId);
        return;
    }

    try {
        if (symbologyData.symbology_type === 'single') {
            // Apply single symbol symbology
            const style = {
                color: symbologyData.stroke_color || '#ffffff',
                fillColor: symbologyData.fill_color || '#888888',
                weight: symbologyData.stroke_weight || 2,
                opacity: symbologyData.stroke_opacity || 1.0,
                fillOpacity: symbologyData.fill_opacity || 0.7
            };

            layerInfo.layer.setStyle(style);
            layerInfo.style = style;
            
            console.log('Single symbol symbology applied from stored data');
        } else if (symbologyData.symbology_type === 'categorical' && symbologyData.classification_field && symbologyData.categories) {
            // Apply categorical symbology
            const field = symbologyData.classification_field;
            const strokeColor = symbologyData.stroke_color || '#ffffff';
            const strokeWeight = symbologyData.stroke_weight || 2;
            
            // Create color map from stored categories
            const colorMap = {};
            symbologyData.categories.forEach(category => {
                colorMap[category.value] = category.color;
            });

            layerInfo.layer.setStyle(function(feature) {
                const value = feature.properties[field];
                const fillColor = colorMap[value] || '#999999';
                return {
                    color: strokeColor,
                    fillColor: fillColor,
                    weight: strokeWeight,
                    opacity: symbologyData.stroke_opacity || 1.0,
                    fillOpacity: symbologyData.fill_opacity || 0.7
                };
            });

            // Store the classification info
            layerInfo.classification = {
                field: field,
                colorMap: colorMap,
                strokeColor: strokeColor,
                strokeWidth: strokeWeight
            };
            
            console.log('Categorical symbology applied from stored data');
        } else {
            console.log('Unknown or incomplete symbology data, applying default style');
            applyDefaultSymbology(layerId);
        }
        
        // Update legend after symbology has been applied
        updateLegend();
        
    } catch (error) {
        console.error('Error applying stored symbology:', error);
        applyDefaultSymbology(layerId);
    }
}

// Apply default symbology to a layer
function applyDefaultSymbology(layerId) {
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;

    const defaultStyle = {
        color: '#ffffff',
        weight: 2,
        opacity: 1.0,
        fillColor: '#888888',
        fillOpacity: 0.0
    };

    // No special defaults - use neutral styling for all layers

    layerInfo.layer.setStyle(defaultStyle);
    layerInfo.style = defaultStyle;
    
    // Update legend after applying default symbology
    updateLegend();
}

// Update legend
function updateLegend() {
    const legendContent = document.getElementById('legendContent');
    legendContent.innerHTML = '';

    // Use layerOrder to display legend items in the same order as the Layer Panel and map rendering
    layerOrder.forEach(layerId => {
        const layerInfo = layers.get(layerId);
        if (layerInfo && layerInfo.visible) {
            const legendContainer = document.createElement('div');
            legendContainer.className = 'legend-layer-container mb-3';
            
            // Layer name header
            const layerHeader = document.createElement('div');
            layerHeader.className = 'text-sm font-medium text-white mb-1';
            layerHeader.textContent = layerInfo.name;
            legendContainer.appendChild(layerHeader);
            
            // Check if layer has categorical classification
            if (layerInfo.classification && layerInfo.classification.field && layerInfo.classification.colorMap) {
                // Categorical symbology - show multiple color swatches with categories
                const categoriesContainer = document.createElement('div');
                categoriesContainer.className = 'legend-categories space-y-1';
                
                Object.entries(layerInfo.classification.colorMap).forEach(([value, fillColor]) => {
                    const categoryItem = document.createElement('div');
                    categoryItem.className = 'legend-item flex items-center space-x-2';
                    
                    // Get stroke color and width from classification or default
                    const strokeColor = layerInfo.classification.strokeColor || layerInfo.style?.color || '#ffffff';
                    const strokeWidth = layerInfo.classification.strokeWidth || layerInfo.style?.weight || 2;
                    
                    categoryItem.innerHTML = `
                        <div class="legend-color w-4 h-4 rounded border-2" 
                             style="background-color: ${fillColor}; border-color: ${strokeColor}; border-width: ${Math.min(strokeWidth, 2)}px;"></div>
                        <span class="text-xs text-gray-300">${value}</span>
                    `;
                    
                    categoriesContainer.appendChild(categoryItem);
                });
                
                legendContainer.appendChild(categoriesContainer);
            } else {
                // Single symbol - show one color swatch
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item flex items-center space-x-2';
                
                // Get fill and stroke colors from current layer style
                const fillColor = layerInfo.style?.fillColor || '#888888';
                const strokeColor = layerInfo.style?.color || '#ffffff';
                const strokeWidth = layerInfo.style?.weight || 2;
                
                // Use style as-is without special handling
                let displayFillColor = fillColor;
                let displayStrokeColor = strokeColor;
                
                legendItem.innerHTML = `
                    <div class="legend-color w-4 h-4 rounded border-2" 
                         style="background-color: ${displayFillColor}; border-color: ${displayStrokeColor}; border-width: ${Math.min(strokeWidth, 2)}px;"></div>
                    <span class="text-xs text-gray-300">Single Symbol</span>
                `;
                
                legendContainer.appendChild(legendItem);
            }
            
            legendContent.appendChild(legendContainer);
        }
    });
}

// Export all functions to global scope for compatibility
window.addDataToMapWithPreloadedStyle = addDataToMapWithPreloadedStyle;
window.addDataToMap = addDataToMap;
window.saveLayerToSupabase = saveLayerToSupabase;
window.loadLayersFromSupabase = loadLayersFromSupabase;
window.updateLayerInSupabase = updateLayerInSupabase;
window.deleteLayerFromSupabase = deleteLayerFromSupabase;
window.clearOldLayerCaches = clearOldLayerCaches;
window.loadInitialData = loadInitialData;
window.loadAeraWithCorrectSymbology = loadAeraWithCorrectSymbology;
window.loadAeraWithDefaultSymbology = loadAeraWithDefaultSymbology;
window.updateLayersList = updateLayersList;
window.setupLayerDragDrop = setupLayerDragDrop;
window.reorderLayer = reorderLayer;
window.updateMapLayerOrder = updateMapLayerOrder;
window.updateSelectionLayerDropdown = updateSelectionLayerDropdown;
window.toggleLayerVisibility = toggleLayerVisibility;
window.showLayerContextMenu = showLayerContextMenu;
window.hideLayerContextMenu = hideLayerContextMenu;
window.resetContextMenuVariables = resetContextMenuVariables;
window.setupLayerContextMenuListeners = setupLayerContextMenuListeners;
window.zoomToLayer = zoomToLayer;
window.deleteLayer = deleteLayer;
window.renameLayer = renameLayer;
window.updateLayerNameInSupabase = updateLayerNameInSupabase;
window.saveSymbologyToSupabase = saveSymbologyToSupabase;
window.applyStoredSymbology = applyStoredSymbology;
window.applyDefaultSymbology = applyDefaultSymbology;
window.updateLegend = updateLegend;
