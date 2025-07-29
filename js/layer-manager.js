/**
 * Layer Manager Module for Aéra Link WebGIS - Refactored for Supabase Storage
 * Handles all layer management functionality using Supabase Storage for permanent layers
 * and Supabase Database for dynamic layer tracking and symbology
 */

console.log('🔄 Loading Layer Manager Module...');

// === SUPABASE STORAGE CONFIGURATION ===
const STORAGE_BUCKET = 'aeralink'; // Private storage bucket for permanent layers

// === GLOBAL LAYER VARIABLES ===
// Ensure core layer variables are available
if (typeof window.layers === 'undefined') {
    window.layers = new Map();
    console.log('🗺️ Initialized window.layers Map');
}
if (typeof window.layerOrder === 'undefined') {
    window.layerOrder = [];
    console.log('📋 Initialized window.layerOrder array');
}
if (typeof window.layerCounter === 'undefined') {
    window.layerCounter = 0;
    console.log('🔢 Initialized window.layerCounter');
}

// Use global variables directly (no local redeclaration to avoid conflicts)

// === LAYER MANAGEMENT CORE FUNCTIONS ===

// Add data to map with preloaded style (prevents symbology flash for permanent layers)
function addDataToMapWithPreloadedStyle(geoData, fileName, preloadedStyle, isPermanent = false) {
    const layerId = 'layer_' + (++window.layerCounter);
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

    // Check if any layer with this name already exists in map view (both permanent and dynamic)
    const existingLayer = Array.from(window.layers.values()).find(l => l.name === layerName);
    if (existingLayer) {
        console.log(`Layer "${layerName}" already exists in map view, skipping duplicate (preloaded style)`);
        console.log(`Existing layer details:`, {
            layerId: existingLayer.layerId,
            name: existingLayer.name,
            isPermanent: existingLayer.isPermanent,
            fromDatabase: existingLayer.fromDatabase,
            visible: existingLayer.visible
        });
        return null;
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
    window.layers.set(layerId, {
        layer: layer,
        name: layerName,
        data: geoData,
        visible: true,
        style: finalStyle, // Store the complete preloaded style object
        originalData: JSON.parse(JSON.stringify(geoData)),
        opacity: preloadedStyle.fillOpacity || 1.0,
        isPermanent: isPermanent,
        fromDatabase: false,
        layerId: layerId,
        createdAt: new Date().toISOString()
    });

    // Add to layer order for consistent display
    window.layerOrder.unshift(layerId);

    console.log(`✅ Layer "${layerName}" created with preloaded symbology - no flash occurred`);

    // Update UI elements
    updateLayersList();
    enhancedUpdateLegend();

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

// Add data to map (for dynamic layers created via Add Data button)
function addDataToMap(geoData, fileName, fromDatabase = false, databaseId = null, isPermanent = false) {
    const layerId = 'layer_' + (++window.layerCounter);
    const layerName = fileName.replace(/\.(geojson|json|kml)$/i, '');

    console.log(`Adding layer to map:`, {
        layerId: layerId,
        layerName: layerName,
        fileName: fileName,
        fromDatabase: fromDatabase,
        databaseId: databaseId,
        isPermanent: isPermanent
    });

    // Validate required parameters
    if (!geoData || !fileName || !layerId) {
        console.error('Cannot add layer: missing required parameters');
        return null;
    }

    // Check if any layer with this name already exists in map view (both permanent and dynamic)
    const existingLayer = Array.from(window.layers.values()).find(l => l.name === layerName);
    if (existingLayer) {
        console.log(`Layer "${layerName}" already exists in map view, skipping duplicate`);
        console.log(`Existing layer details:`, {
            layerId: existingLayer.layerId,
            name: existingLayer.name,
            isPermanent: existingLayer.isPermanent,
            fromDatabase: existingLayer.fromDatabase,
            visible: existingLayer.visible
        });
        return null;
    }

    const style = {
        color: '#000000',
        weight: 0.5,
        opacity: 1.0,
        fillColor: '#888888',
        fillOpacity: 0.7
    };

    const layer = L.geoJSON(geoData, {
        renderer: L.canvas(),
        style: style,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                
                layer.on('contextmenu', function(e) {
                    // Popup logic handled in interaction-handlers.js
                });
            }
        }
    }).addTo(map);

    // Store layer information
    window.layers.set(layerId, {
        layer: layer,
        name: layerName,
        data: geoData,
        visible: true,
        style: style,
        originalData: JSON.parse(JSON.stringify(geoData)),
        opacity: 1.0,
        isPermanent: isPermanent,
        fromDatabase: fromDatabase,
        databaseId: databaseId, // Track database record ID
        layerId: layerId,
        createdAt: new Date().toISOString()
    });

    // Add to layer order
    layerOrder.unshift(layerId);

    // Zoom to layer
    map.fitBounds(layer.getBounds());

    // Update UI
    updateLayersList();
    if (!fromDatabase) {
        enhancedUpdateLegend();
    }
    updateSelectionLayerDropdown(); // Update selection dropdown

    // Save dynamic layers to database (not permanent layers)
    if (!fromDatabase && supabase && !isPermanent && currentUser) {
        console.log(`Starting async save for dynamic layer "${layerName}" to database...`);
        saveDynamicLayerToDatabase(layerId, layerName, geoData).then(() => {
            updateLayersList();
            console.log(`Dynamic layer "${layerName}" save completed and UI updated`);
        }).catch(error => {
            console.error('Failed to save layer to database:', error);
            showNotification(`Failed to save layer "${layerName}" to database. Layer will only be available locally.`, 'error');
        });
    } else if (isPermanent) {
        console.log(`Permanent layer "${layerName}" loaded successfully (not saved to database)`);
    }

    // Update filter system with new layer
    setTimeout(() => {
        console.log(`Layer ${layerId} added, updating filter system...`);
        populateFilterLayers();
    }, 50);

    return layerId;
}

// === SUPABASE STORAGE FUNCTIONS FOR PERMANENT LAYERS ===

// Load permanent layer from Supabase Storage
async function loadPermanentLayerFromStorage(fileName) {
    try {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log(`🗂️ Loading permanent layer from Supabase Storage: ${fileName}`);

        // Get signed URL for the file in the aeralink bucket
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .createSignedUrl(fileName, 3600); // 1 hour expiry

        if (signedUrlError) {
            throw new Error(`Failed to get signed URL: ${signedUrlError.message}`);
        }

        if (!signedUrlData?.signedUrl) {
            throw new Error('No signed URL returned from Supabase');
        }

        console.log(`✅ Got signed URL for ${fileName}`);

        // Fetch the GeoJSON data using the signed URL
        const response = await fetch(signedUrlData.signedUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const geoData = await response.json();
        console.log(`✅ Successfully loaded ${fileName} from Supabase Storage`);

        return geoData;
    } catch (error) {
        console.error(`❌ Error loading ${fileName} from Supabase Storage:`, error);
        throw error;
    }
}

// List all permanent layers available in Supabase Storage
async function listPermanentLayers() {
    try {
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }

        console.log('🗂️ Listing permanent layers from Supabase Storage...');

        const { data, error } = await supabase.storage
            .from(STORAGE_BUCKET)
            .list('', {
                limit: 100,
                offset: 0
            });

        if (error) {
            throw new Error(`Failed to list files: ${error.message}`);
        }

        // Filter for GeoJSON files
        const geoJsonFiles = data.filter(file => 
            file.name.toLowerCase().endsWith('.geojson') ||
            file.name.toLowerCase().endsWith('.json')
        );

        console.log(`✅ Found ${geoJsonFiles.length} permanent layers in storage:`, geoJsonFiles.map(f => f.name));

        return geoJsonFiles;
    } catch (error) {
        console.error('❌ Error listing permanent layers:', error);
        throw error;
    }
}

// === DYNAMIC LAYER DATABASE FUNCTIONS ===

// Save dynamic layer to database (layers table)
async function saveDynamicLayerToDatabase(layerId, layerName, geoData) {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot save layer');
            showNotification('Please log in to save layers to database', 'error');
            return false;
        }

        // Critical safeguard: Never save permanent layers to database
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.isPermanent) {
            console.log(`🚫 Skipping database save for permanent layer "${layerName}" - permanent layers must not be saved to layers table`);
            return false;
        }

        // Additional safeguard: Check if layer is from Supabase Storage bucket
        if (layerName === 'Aera' || layerName === 'Proximity Roads' || layerName.endsWith('_permanent')) {
            console.log(`🚫 Skipping database save for storage-based layer "${layerName}" - detected as permanent by naming pattern`);
            return false;
        }

        // Only save layers that are explicitly user-generated (Add Data tool) or filtered selections
        if (layerInfo && !layerInfo.isUserGenerated && !layerInfo.isFilteredSelection) {
            console.log(`🚫 Skipping database save for layer "${layerName}" - not user-generated or filtered layer`);
            return false;
        }

        console.log(`✅ All safeguards passed. Proceeding to save dynamic layer "${layerName}" to database...`);
        console.log(`📊 Layer details:`, {
            layerId,
            layerName,
            isPermanent: layerInfo?.isPermanent || false,
            isUserGenerated: layerInfo?.isUserGenerated || false,
            isFilteredSelection: layerInfo?.isFilteredSelection || false,
            fromDatabase: layerInfo?.fromDatabase || false,
            sourceType: layerInfo?.sourceType || 'unknown'
        });

        // Check if layer already exists for this user
        const { data: existingLayers, error: checkError } = await supabase
            .from('layers')
            .select('id, name')
            .eq('name', layerName)
            .eq('user_id', currentUser.id);
        
        if (checkError) {
            console.error('Error checking for existing layers:', checkError);
            showNotification(`Error checking database: ${checkError.message}`, 'error');
            return false;
        }

        const layerStyle = layerInfo ? layerInfo.style : null;

        if (existingLayers && existingLayers.length > 0) {
            // Update existing layer
            console.log(`Updating existing dynamic layer "${layerName}" in database...`);
            
            const { data, error } = await supabase
                .from('layers')
                .update({
                    geojson_data: geoData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existingLayers[0].id)
                .eq('user_id', currentUser.id)
                .select();

            if (error) {
                console.error('Error updating layer in database:', error);
                showNotification(`Failed to update layer "${layerName}" in database: ${error.message}`, 'error');
                return false;
            } else if (data && data.length > 0) {
                if (layerInfo) {
                    layerInfo.databaseId = data[0].id;
                    layerInfo.fromDatabase = true;
                    console.log(`Dynamic layer "${layerName}" updated with database ID: ${data[0].id}`);
                }
                console.log('Dynamic layer updated in database successfully:', layerName);
                showNotification(`Layer "${layerName}" updated in database`, 'success');
                return true;
            }
        } else {
            // Create new layer record
            console.log(`Creating new dynamic layer "${layerName}" in database...`);
            
            const { data, error } = await supabase
                .from('layers')
                .insert([
                    {
                        layer_id: layerId,
                        name: layerName,
                        geojson_data: geoData,
                        created_at: new Date().toISOString(),
                        user_id: currentUser.id
                    }
                ])
                .select();

            if (error) {
                console.error('Error saving layer to database:', error);
                showNotification(`Failed to save layer "${layerName}" to database: ${error.message}`, 'error');
                return false;
            } else if (data && data.length > 0) {
                if (layerInfo) {
                    layerInfo.databaseId = data[0].id;
                    layerInfo.fromDatabase = true;
                    console.log(`Dynamic layer "${layerName}" saved with database ID: ${data[0].id}`);
                }
                console.log('Dynamic layer saved to database successfully:', layerName);
                showNotification(`Layer "${layerName}" saved to database`, 'success');
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Network error saving to database:', error);
        showNotification(`Network error saving layer "${layerName}" to database: ${error.message}`, 'error');
        return false;
    }
}

// Check database health and connection
async function checkDatabaseHealth() {
    try {
        const { data, error } = await supabase
            .from('layers')
            .select('count', { count: 'exact' })
            .eq('user_id', currentUser?.id || 'test')
            .limit(1);
        
        if (error && error.code === '57014') {
            console.warn('Database timeout detected during health check');
            return { healthy: false, reason: 'timeout' };
        } else if (error) {
            console.warn('Database error during health check:', error);
            return { healthy: false, reason: 'error', error };
        }
        
        return { healthy: true };
    } catch (error) {
        console.warn('Network error during database health check:', error);
        return { healthy: false, reason: 'network', error };
    }
}

// Load dynamic layers from database
async function loadDynamicLayersFromDatabase(retryCount = 0) {
    const maxRetries = 2;
    
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot load layers');
            return;
        }

        console.log('Loading dynamic layers from database for user:', currentUser.email);

        // Check database health before attempting large operations
        if (retryCount === 0) {
            const healthCheck = await checkDatabaseHealth();
            if (!healthCheck.healthy) {
                if (healthCheck.reason === 'timeout') {
                    showNotification('Database is currently overloaded. Please try again in a few minutes.', 'warning');
                    return;
                } else if (healthCheck.reason === 'network') {
                    showNotification('Network connection issue. Please check your internet connection.', 'warning');
                    return;
                }
            }
        }

        // First, get layer info without the potentially large geojson_data
        const { data: layerList, error: listError } = await supabase
            .from('layers')
            .select('id, name, layer_id, style, created_at, updated_at')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(50); // Limit to prevent overwhelming queries

        if (listError) {
            console.error('Error loading layer list from database:', listError);
            
            // Handle timeout errors with retry mechanism
            if (listError.code === '57014' && retryCount < maxRetries) {
                console.log(`Database timeout, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
                return loadDynamicLayersFromDatabase(retryCount + 1);
            } else if (listError.code === '57014') {
                showNotification('Database query timeout - the database may be overloaded. Please try again later.', 'error');
            } else {
                showNotification(`Error loading dynamic layers: ${listError.message}`, 'error');
            }
            return;
        }

        if (!layerList || layerList.length === 0) {
            console.log('No dynamic layers found in database for current user');
            return;
        }

        console.log(`Found ${layerList.length} dynamic layers in database, loading data...`);
        const savedLayers = [];

        // Clean up any permanent layers that shouldn't be in database
        const invalidLayers = layerList.filter(layer => 
            layer.name === 'Aera' || 
            layer.name === 'Proximity Roads' || 
            layer.name.endsWith('_permanent')
        );

        if (invalidLayers.length > 0) {
            console.warn(`🧹 Found ${invalidLayers.length} permanent layers in database that will be cleaned up`);
            for (const invalidLayer of invalidLayers) {
                try {
                    await supabase
                        .from('layers')
                        .delete()
                        .eq('id', invalidLayer.id)
                        .eq('user_id', currentUser.id);
                    console.log(`🗑️ Cleaned up permanent layer "${invalidLayer.name}" from database`);
                } catch (cleanupError) {
                    console.error(`Failed to cleanup layer ${invalidLayer.name}:`, cleanupError);
                }
            }
        }

        // Filter out invalid layers and load remaining ones
        const validLayers = layerList.filter(layer => 
            layer.name !== 'Aera' && 
            layer.name !== 'Proximity Roads' && 
            !layer.name.endsWith('_permanent')
        );

        // Load geojson_data for valid layers in smaller batches to avoid timeout
        const batchSize = 5;
        for (let i = 0; i < validLayers.length; i += batchSize) {
            const batch = validLayers.slice(i, i + batchSize);
            
            // Load batch data concurrently but limit concurrent requests
            const batchPromises = batch.map(async (layerInfo) => {
                try {
                    const { data: layerData, error: dataError } = await supabase
                        .from('layers')
                        .select('geojson_data')
                        .eq('id', layerInfo.id)
                        .eq('user_id', currentUser.id)
                        .single();

                    if (dataError) {
                        console.error(`Error loading data for layer ${layerInfo.name}:`, dataError);
                        return null;
                    }

                    return {
                        ...layerInfo,
                        geojson_data: layerData.geojson_data
                    };
                } catch (individualError) {
                    console.error(`Failed to load layer ${layerInfo.name}:`, individualError);
                    return null;
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            // Add successful results to savedLayers
            batchResults.forEach(result => {
                if (result) {
                    savedLayers.push(result);
                }
            });

            // Add small delay between batches to prevent overwhelming the database
            if (i + batchSize < validLayers.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // At this point we have loaded the layers data successfully

        if (savedLayers && savedLayers.length > 0) {
            console.log(`Found ${savedLayers.length} dynamic layers in database`);
            
            let loadedCount = 0;
            for (const savedLayer of savedLayers) {
                // Skip if layer already exists locally
                const existingLayer = Array.from(window.layers.entries()).find(([layerId, layerInfo]) => 
                    layerInfo.databaseId === savedLayer.id
                );
                if (existingLayer) {
                    console.log(`Skipping duplicate layer from database: ${savedLayer.name}`);
                    continue;
                }

                // Additional safeguard: Skip any permanent layer names that shouldn't be in database
                if (savedLayer.name === 'Aera' || savedLayer.name === 'Proximity Roads' || savedLayer.name.endsWith('_permanent')) {
                    console.warn(`🚫 Found permanent layer "${savedLayer.name}" in database - this should not happen. Skipping load.`);
                    continue;
                }

                try {
                    // Add the saved layer to map (fromDatabase=true, isPermanent=false)
                    const newLayerId = addDataToMap(savedLayer.geojson_data, savedLayer.name, true, savedLayer.id, false);
                    loadedCount++;
                    console.log(`✅ Loaded dynamic layer from database: ${savedLayer.name}`);
                } catch (layerError) {
                    console.error(`Error loading layer "${savedLayer.name}":`, layerError);
                }
            }
            
            if (loadedCount > 0) {
                showNotification(`Loaded ${loadedCount} dynamic layers from database`, 'success');
            } else {
                console.log('No new dynamic layers to load from database');
            }
        } else {
            console.log('No dynamic layers found in database for current user');
        }
    } catch (error) {
        console.error('Network error loading from database:', error);
        
        // Retry on network errors
        if (retryCount < maxRetries && (error.message.includes('timeout') || error.message.includes('network'))) {
            console.log(`Network error, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
            return loadDynamicLayersFromDatabase(retryCount + 1);
        } else {
            showNotification(`Network error loading dynamic layers: ${error.message}`, 'error');
        }
    }
}

// Delete dynamic layer from database
async function deleteDynamicLayerFromDatabase(layerId, layerName = 'Unknown') {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot delete layer');
            return { success: false, error: 'User not authenticated' };
        }

        const layerInfo = window.layers.get(layerId);
        if (!layerInfo) {
            console.error(`Layer info not found for layerId: ${layerId}`);
            return { success: false, error: 'Layer not found in local storage' };
        }

        // Don't delete permanent layers from database
        if (layerInfo.isPermanent) {
            console.log(`Skipping database deletion for permanent layer: ${layerName}`);
            return { success: true };
        }

        console.log(`Attempting to delete dynamic layer from database:`, {
            localLayerId: layerId,
            databaseId: layerInfo.databaseId,
            layerName: layerName,
            userId: currentUser.id,
            fromDatabase: layerInfo.fromDatabase,
            isPermanent: layerInfo.isPermanent
        });

        // If the layer doesn't have a database ID and wasn't loaded from database, skip
        if (!layerInfo.databaseId && !layerInfo.fromDatabase) {
            console.log(`Layer "${layerName}" is local-only, skipping database deletion`);
            return { success: true };
        }

        let query = supabase.from('layers').delete().eq('user_id', currentUser.id);
        let queryDescription = '';
        
        if (layerInfo.databaseId) {
            query = query.eq('id', layerInfo.databaseId);
            queryDescription = `Database ID: ${layerInfo.databaseId}, User ID: ${currentUser.id}`;
        } else {
            query = query.eq('layer_id', layerId);
            queryDescription = `Layer ID: ${layerId}, User ID: ${currentUser.id}`;
        }

        console.log(`Executing delete query with ${queryDescription}`);
        const { data, error } = await query;

        if (error) {
            console.error(`Error deleting layer "${layerName}" from database:`, error);
            return { success: false, error: `Database error: ${error.message}` };
        } else {
            console.log(`Layer "${layerName}" deleted from database successfully`);
            return { success: true };
        }
    } catch (error) {
        console.error(`Network error deleting layer "${layerName}" from database:`, error);
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

        if (typeof window.cachedLayerStyles !== 'undefined') {
            delete window.cachedLayerStyles;
            console.log('🗑️ Cleared global cachedLayerStyles');
        }

        console.log('✅ Old layer cache cleanup completed');
    } catch (error) {
        console.warn('Warning: Could not fully clear old layer caches:', error);
    }
}

// Load initial data - permanent layers from Supabase Storage
function loadInitialData() {
    // Clear any cached references to old layers
    clearOldLayerCaches();
    localStorage.removeItem('layer_1_symbology');
    sessionStorage.removeItem('layer_1_symbology');
    
    // Load permanent layers from Supabase Storage
    if (supabase && currentUser) {
        console.log('🗂️ Loading permanent layers from Supabase Storage...');
        loadPermanentLayersWithSymbology();
    } else {
        console.warn('⚠️ Supabase not available or user not authenticated - permanent layers will not load');
    }
    
    // Load dynamic layers from database
    if (supabase && currentUser) {
        setTimeout(() => {
            loadDynamicLayersFromDatabase();
            
            // Populate filter layers after database layers load
            setTimeout(() => {
                console.log('Database layers loaded, refreshing filter layers');
                populateFilterLayers();
            }, 500);
        }, 700);
    }
}

// Load all permanent layers from Supabase Storage with their correct symbology
async function loadPermanentLayersWithSymbology() {
    try {
        console.log('🔍 Loading permanent layers from Supabase Storage...');
        
        // List all permanent layers in storage
        const permanentFiles = await listPermanentLayers();
        
        if (permanentFiles.length === 0) {
            console.log('ℹ️ No permanent layers found in Supabase Storage');
            return;
        }

        // Load each permanent layer
        for (const file of permanentFiles) {
            try {
                await loadSinglePermanentLayer(file.name);
            } catch (error) {
                console.error(`Failed to load permanent layer ${file.name}:`, error);
            }
        }

        // Populate filter layers after permanent layers are loaded
        setTimeout(() => {
            console.log('Permanent layers loaded, populating filter layers');
            populateFilterLayers();
        }, 100);

    } catch (error) {
        console.error('Error in loadPermanentLayersWithSymbology:', error);
    }
}

// Load a single permanent layer from Supabase Storage with its symbology
async function loadSinglePermanentLayer(fileName) {
    try {
        const layerName = fileName.replace(/\.(geojson|json)$/i, '');
        
        console.log(`🔍 Loading permanent layer: ${fileName}`);

        // Check for stored symbology first
        const storedSymbology = await getUserStyleForLayer(layerName);
        
        // Load the GeoJSON data from Supabase Storage
        const geoData = await loadPermanentLayerFromStorage(fileName);

        if (storedSymbology) {
            console.log(`✅ Found stored symbology for ${layerName}, applying directly during layer creation`);
            addDataToMapWithPreloadedStyle(geoData, fileName, storedSymbology, true);
        } else {
            console.log(`ℹ️ No stored symbology found for ${layerName}, using default`);
            addDataToMap(geoData, fileName, false, null, true);
        }

    } catch (error) {
        console.error(`Error loading permanent layer ${fileName}:`, error);
        throw error;
    }
}

// === SYMBOLOGY MANAGEMENT FUNCTIONS ===

// Get user-specific or shared style for a layer
async function getUserStyleForLayer(layerName) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping style fetch');
            return null;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        let styleData = null;
        
        if (collaborativeMode) {
            // Load from shared_styles table
            console.log(`🤝 Loading shared style for layer: ${layerName}`);
            const { data, error } = await supabase
                .from('shared_styles')
                .select('style')
                .eq('layer_id', layerName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching shared style:', error);
                return null;
            }
            styleData = data;
        } else {
            // Load from user_styles table
            console.log(`👤 Loading user-specific style for layer: ${layerName}`);
            const { data, error } = await supabase
                .from('user_styles')
                .select('style')
                .eq('user_id', currentUser.id)
                .eq('layer_id', layerName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching user style:', error);
                return null;
            }
            styleData = data;
        }

        if (styleData && styleData.style) {
            console.log(`✅ Retrieved ${collaborativeMode ? 'shared' : 'user'} style for ${layerName}`);
            return styleData.style;
        }

        return null;
    } catch (error) {
        console.error('Network error fetching style:', error);
        return null;
    }
}

// Save user-specific or shared style for a layer
async function saveUserStyleForLayer(layerName, styleData) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping style save');
            return false;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        if (collaborativeMode) {
            // Save to shared_styles table
            console.log(`🤝 Saving shared style for layer: ${layerName}`);
            
            const { data, error } = await supabase
                .from('shared_styles')
                .upsert({
                    layer_id: layerName,
                    style: styleData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'layer_id'
                });

            if (error) {
                console.error('Error saving shared style:', error);
                return false;
            }
            
            console.log('✅ Shared style saved successfully');
        } else {
            // Save to user_styles table
            console.log(`👤 Saving user-specific style for layer: ${layerName}`);
            
            const { data, error } = await supabase
                .from('user_styles')
                .upsert({
                    user_id: currentUser.id,
                    layer_id: layerName,
                    style: styleData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,layer_id'
                });

            if (error) {
                console.error('Error saving user style:', error);
                return false;
            }
            
            console.log('✅ User style saved successfully');
        }
        
        return true;
    } catch (error) {
        console.error('Network error saving style:', error);
        return false;
    }
}

// === LAYER UI MANAGEMENT FUNCTIONS ===

// Update layers list in toolbox panel
function updateLayersList() {
    const layersList = document.getElementById('layersList');
    layersList.innerHTML = '';

    // Use layerOrder to maintain consistent ordering
    layerOrder.forEach(layerId => {
        if (!window.layers.has(layerId)) return; // Skip deleted layers

        const layerInfo = window.layers.get(layerId);
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
                        ${layerInfo.isPermanent ? '<i class="fas fa-server text-xs ml-1" title="Permanent layer from Supabase Storage"></i>' : ''}
                        ${layerInfo.fromDatabase && !layerInfo.isPermanent ? '<i class="fas fa-database text-xs ml-1 text-blue-400" title="Dynamic layer from database"></i>' : ''}
                    </span>
                </div>
                <div class="flex items-center space-x-3">
                    <button class="symbology-btn text-teal-400 hover:text-teal-300 text-lg transition-colors bg-transparent border-0 p-1" data-layer="${layerId}" title="Edit Symbology">
                        <i class="fas fa-palette"></i>
                    </button>
                    <button class="visibility-btn text-lg transition-all duration-200 cursor-pointer bg-transparent border-0 p-1 hover:bg-opacity-20 hover:bg-white rounded" data-layer="${layerId}" title="Toggle Visibility">
                        <i class="fas ${layerInfo.visible ? 'fa-eye text-teal-400 hover:text-teal-300' : 'fa-eye-slash text-gray-500 hover:text-gray-400'}"></i>
                    </button>
                </div>
            </div>
            <div class="text-xs text-gray-400 italic">
                ${Object.keys(layerInfo.data.features || {}).length || layerInfo.data.features?.length || 0} features
                ${layerInfo.isPermanent ? ' • From Supabase Storage' : ''}
                ${layerInfo.fromDatabase && !layerInfo.isPermanent ? ' • From database' : ''}
            </div>
        `;

        layersList.appendChild(layerDiv);

        // Setup drag and drop for this layer
        setupLayerDragDrop(layerDiv, layerId);

        // Add right-click context menu event listener
        layerDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showLayerContextMenu(e, layerId, layerInfo.name);
        });

        // Add existing event listeners
        const visibilityBtn = layerDiv.querySelector('.visibility-btn');
        visibilityBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentVisibility = window.layers.get(layerId).visible;
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
            console.log('🖱️ Layer context menu triggered for:', layerInfo.name);
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // Ensure we hide any existing context menus first
            hideLayerContextMenu();
            
            // Show the layer context menu
            showLayerContextMenu(e, layerId, layerInfo.name);
            
            return false;
        });
    });
    
    // Update map layer order after UI update
    updateMapLayerOrder();
    // Update selection layer dropdown
    updateSelectionLayerDropdown();
}

// Enhanced drag and drop for full vertical reordering
function setupLayerDragDrop(layerDiv, layerId) {
    console.log(`🎯 Setting up enhanced drag-and-drop for layer: ${layerId}`);

    // Make layer draggable
    layerDiv.draggable = true;

    // Drag start
    layerDiv.addEventListener('dragstart', (e) => {
        console.log(`🚀 Drag started for layer: ${layerId}`);
        layerDiv.classList.add('dragging');
        layerDiv.style.opacity = '0.5';
        layerDiv.style.transform = 'rotate(2deg)';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', layerId);
        
        layerDiv.setAttribute('data-dragging', 'true');
        
        // Add visual feedback to other layers
        document.querySelectorAll('.layer-item').forEach(item => {
            if (item !== layerDiv) {
                item.classList.add('drag-target-available');
            }
        });
    });

    // Drag end
    layerDiv.addEventListener('dragend', (e) => {
        console.log(`🏁 Drag ended for layer: ${layerId}`);
        layerDiv.classList.remove('dragging');
        layerDiv.style.opacity = '1';
        layerDiv.style.transform = '';
        layerDiv.removeAttribute('data-dragging');
        
        // Clean up all visual indicators
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom', 'drag-target-available');
        });
    });

    // Drag over - Enhanced with position detection
    layerDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const draggingElement = document.querySelector('[data-dragging="true"]');
        if (draggingElement && draggingElement !== layerDiv) {
            e.dataTransfer.dropEffect = 'move';
            
            // Calculate drop zone (top half vs bottom half)
            const rect = layerDiv.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const mouseY = e.clientY;
            
            // Clear previous indicators
            layerDiv.classList.remove('drag-over-top', 'drag-over-bottom');
            
            if (mouseY < midpoint) {
                // Dropping in top half - insert above
                layerDiv.classList.add('drag-over-top');
                layerDiv.dataset.dropZone = 'top';
            } else {
                // Dropping in bottom half - insert below
                layerDiv.classList.add('drag-over-bottom');
                layerDiv.dataset.dropZone = 'bottom';
            }
            
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
        // Only remove highlight if we're truly leaving the element
        if (!layerDiv.contains(e.relatedTarget)) {
            layerDiv.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
            delete layerDiv.dataset.dropZone;
        }
    });

    // Drop - Enhanced with position-aware insertion
    layerDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        console.log(`📍 Drop event on layer: ${layerId}`);
        
        const draggedLayerId = e.dataTransfer.getData('text/plain');
        const targetLayerId = layerId;
        const dropZone = layerDiv.dataset.dropZone || 'bottom';
        
        // Clean up visual indicators
        layerDiv.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        delete layerDiv.dataset.dropZone;
        
        console.log(`🎯 Attempting to reorder: ${draggedLayerId} -> ${targetLayerId} (${dropZone})`);
        
        if (draggedLayerId && draggedLayerId !== targetLayerId) {
            reorderLayerWithPosition(draggedLayerId, targetLayerId, dropZone);
        }
    });
}

// Position-aware layer reordering
function reorderLayerWithPosition(draggedLayerId, targetLayerId, dropZone) {
    console.log(`🎯 Position-aware reordering:`, {
        draggedLayerId,
        targetLayerId,
        dropZone,
        currentOrder: [...layerOrder]
    });

    const draggedIndex = layerOrder.indexOf(draggedLayerId);
    const targetIndex = layerOrder.indexOf(targetLayerId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
        console.error('Invalid layer IDs for reordering');
        return;
    }
    
    if (draggedIndex === targetIndex) {
        console.log('No reordering needed - same position');
        return;
    }
    
    // Remove the dragged layer from its current position
    const draggedLayer = layerOrder.splice(draggedIndex, 1)[0];
    
    // Calculate new insertion index based on drop zone
    let newIndex;
    if (dropZone === 'top') {
        // Insert above the target layer
        newIndex = targetIndex > draggedIndex ? targetIndex - 1 : targetIndex;
    } else {
        // Insert below the target layer
        newIndex = targetIndex >= draggedIndex ? targetIndex : targetIndex + 1;
    }
    
    // Ensure index is within bounds
    newIndex = Math.max(0, Math.min(newIndex, layerOrder.length));
    
    // Insert the dragged layer at the new position
    layerOrder.splice(newIndex, 0, draggedLayer);
    
    console.log(`✅ Layer reordered:`, {
        draggedLayer,
        oldIndex: draggedIndex,
        newIndex: layerOrder.indexOf(draggedLayer),
        targetIndex,
        dropZone,
        newOrder: [...layerOrder]
    });
    
    // Update the UI and map rendering order
    updateLayersList();
    updateMapLayerOrder();
    
    // Show feedback to user
    const draggedLayerInfo = layers.get(draggedLayerId);
    const targetLayerInfo = layers.get(targetLayerId);
    const draggedLayerName = draggedLayerInfo ? draggedLayerInfo.name : 'Unknown';
    const targetLayerName = targetLayerInfo ? targetLayerInfo.name : 'Unknown';
    
    const positionText = dropZone === 'top' ? 'above' : 'below';
    showNotification(`Moved "${draggedLayerName}" ${positionText} "${targetLayerName}"`, 'success', 3000);
}

// Enhanced reorder layers with full vertical reordering capability
function reorderLayer(draggedLayerId, targetLayerId) {
    console.log(`🔄 Reordering layers with full vertical support:`, {
        draggedLayerId: draggedLayerId,
        targetLayerId: targetLayerId,
        currentOrder: [...layerOrder]
    });

    const draggedIndex = layerOrder.indexOf(draggedLayerId);
    const targetIndex = layerOrder.indexOf(targetLayerId);
    
    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        // Remove the dragged layer from its current position
        const draggedLayer = layerOrder.splice(draggedIndex, 1)[0];
        
        // Calculate the new insertion index
        // If dragging from above to below, target index decreases by 1
        // If dragging from below to above, target index stays the same
        let newTargetIndex = targetIndex;
        if (draggedIndex < targetIndex) {
            newTargetIndex = targetIndex;
        }
        
        // Insert the dragged layer at the new position
        layerOrder.splice(newTargetIndex, 0, draggedLayer);
        
        console.log(`✅ Layer order updated:`, {
            draggedLayer: draggedLayer,
            oldIndex: draggedIndex,
            newIndex: layerOrder.indexOf(draggedLayer),
            targetIndex: targetIndex,
            newTargetIndex: newTargetIndex,
            newOrder: [...layerOrder]
        });
        
        // Update the UI and map rendering order
        updateLayersList();
        updateMapLayerOrder();
        
        // Show feedback to user
        const draggedLayerInfo = layers.get(draggedLayerId);
        const targetLayerInfo = layers.get(targetLayerId);
        const draggedLayerName = draggedLayerInfo ? draggedLayerInfo.name : 'Unknown';
        const targetLayerName = targetLayerInfo ? targetLayerInfo.name : 'Unknown';
        
        const moveDirection = draggedIndex < newTargetIndex ? 'down' : 'up';
        showNotification(`Moved "${draggedLayerName}" ${moveDirection} relative to "${targetLayerName}"`, 'success', 3000);
        
    } else if (draggedIndex === targetIndex) {
        console.log('No reordering needed - same position');
    } else {
        console.error('Failed to reorder layers - invalid indices', {
            draggedIndex,
            targetIndex,
            layerOrderLength: layerOrder.length
        });
    }
}

// Update map layer rendering order
function updateMapLayerOrder() {
    console.log('Updating map layer rendering order:', layerOrder);
    
    // First, bring all layers to back to reset their z-index order
    layerOrder.forEach((layerId) => {
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.layer) {
            try {
                layerInfo.layer.bringToBack();
            } catch (error) {
                console.warn(`Could not bring layer ${layerId} to back:`, error);
            }
        }
    });
    
    // Then, bring layers to front in REVERSE order
    const reversedOrder = [...layerOrder].reverse();
    reversedOrder.forEach((layerId) => {
        const layerInfo = window.layers.get(layerId);
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
}

// Update selection layer dropdown with visible layers
function updateSelectionLayerDropdown() {
    const activeLayerSelect = document.getElementById('activeLayerSelect');
    if (!activeLayerSelect) {
        console.error('activeLayerSelect element not found');
        return;
    }
    
    const currentValue = activeLayerSelect.value;
    
    // Clear existing options
    activeLayerSelect.innerHTML = '<option value="">Select a layer first</option>';
    
    // Add visible layers to dropdown
    window.layers.forEach((layerInfo, layerId) => {
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
    if (currentValue && !window.layers.has(currentValue) || (currentValue && !window.layers.get(currentValue).visible)) {
        activeSelectionLayerId = null;
        activeLayerSelect.value = '';
        
        // Disable activate button
        const activateBtn = document.getElementById('activateSelectTool');
        activateBtn.disabled = true;
        activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
        
        // If selection is active, deactivate it
        if (typeof isSelectionActive !== 'undefined' && isSelectionActive) {
            if (typeof deactivateSelectionTool === 'function') {
                deactivateSelectionTool();
            }
        }
    }
    
    // Enable/disable buttons based on whether there are any visible layers
    const hasVisibleLayers = Array.from(window.layers.values()).some(layer => layer.visible);
    const activateBtn = document.getElementById('activateSelectTool');
    const clearBtn = document.getElementById('clearSelection');
    const statsBtn = document.getElementById('showStatistics');
    
    if (activateBtn) {
        if (hasVisibleLayers && !currentValue) {
            // Has layers but none selected - keep button disabled but remove visual disabled state
            activateBtn.disabled = true;
            activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else if (!hasVisibleLayers) {
            // No layers available - disable button
            activateBtn.disabled = true;
            activateBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        // Note: Button will be enabled by the change event listener when user selects a layer
    }
    
    // Trigger change event to ensure proper button states
    if (hasVisibleLayers && currentValue && window.layers.has(currentValue)) {
        // If we have a valid current selection, trigger the change event to enable buttons
        const changeEvent = new Event('change', { bubbles: true });
        activeLayerSelect.dispatchEvent(changeEvent);
    }
}

// Toggle layer visibility
function toggleLayerVisibility(layerId, visible) {
    const layerInfo = window.layers.get(layerId);
    if (layerInfo) {
        if (visible) {
            map.addLayer(layerInfo.layer);
        } else {
            map.removeLayer(layerInfo.layer);
        }
        layerInfo.visible = visible;
        
        // Update map layer order after visibility change
        updateMapLayerOrder();
        
        enhancedUpdateLegend();
        updateSelectionLayerDropdown(); // Update selection dropdown
        populateFilterLayers();
        updateLayersList();
    }
}

// === LAYER CONTEXT MENU FUNCTIONS ===

// Show layer context menu
function showLayerContextMenu(event, layerId, layerName) {
    console.log(`🎯 Showing context menu for layer:`, {
        layerId: layerId,
        layerName: layerName,
        layerExists: layers.has(layerId),
        eventType: event.type,
        clientX: event.clientX,
        clientY: event.clientY
    });

    if (!layerId || !layerName || !layers.has(layerId)) {
        console.error('❌ Cannot show context menu: Invalid layer parameters');
        return;
    }

    const contextMenu = document.getElementById('layerContextMenu');
    if (!contextMenu) {
        console.error('❌ Layer context menu element not found in DOM!');
        return;
    }

    const deleteItem = document.getElementById('contextDelete');
    const renameItem = document.getElementById('contextRename');
    
    if (!deleteItem || !renameItem) {
        console.error('❌ Context menu items not found in DOM!');
        return;
    }
    
    // Set context variables
    currentContextLayerId = layerId;
    currentContextLayerName = layerName;
    
    console.log(`📝 Set context variables:`, {
        currentContextLayerId,
        currentContextLayerName
    });
    
    const layerInfo = window.layers.get(layerId);
    const isPermanentLayer = layerInfo && layerInfo.isPermanent;
    
    // Update menu item states
    if (isPermanentLayer) {
        deleteItem.classList.add('disabled');
        renameItem.classList.add('disabled');
        console.log('🔒 Disabled delete/rename for permanent layer');
    } else {
        deleteItem.classList.remove('disabled');
        renameItem.classList.remove('disabled');
        console.log('✅ Enabled delete/rename for dynamic layer');
    }
    
    // Hide any existing menus first
    hideLayerContextMenu();
    const mapContextMenu = document.getElementById('mapContextMenu');
    if (mapContextMenu) {
        mapContextMenu.style.display = 'none';
    }
    
    // Position the context menu at cursor location
    contextMenu.style.position = 'fixed';
    contextMenu.style.zIndex = '10001';
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
    
    console.log(`📍 Initial menu position: ${event.clientX}, ${event.clientY}`);
    
    // Force reflow to get accurate dimensions
    contextMenu.offsetHeight;
    
    // Ensure menu stays within viewport
    const rect = contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;
    
    let adjustedX = event.clientX;
    let adjustedY = event.clientY;
    
    if (rect.right > viewportWidth - padding) {
        adjustedX = event.clientX - rect.width;
        if (adjustedX < padding) {
            adjustedX = padding;
        }
        console.log('↔️ Adjusted menu position horizontally');
    }
    
    if (rect.bottom > viewportHeight - padding) {
        adjustedY = event.clientY - rect.height;
        if (adjustedY < padding) {
            adjustedY = padding;
        }
        console.log('↕️ Adjusted menu position vertically');
    }
    
    contextMenu.style.left = adjustedX + 'px';
    contextMenu.style.top = adjustedY + 'px';
    
    // Add active class for animations
    contextMenu.classList.add('context-menu-active');
    
    console.log(`✅ Layer context menu displayed at: ${adjustedX}, ${adjustedY}`);
    
    // Stop event propagation
    event.stopPropagation();
    event.stopImmediatePropagation();
}

// Hide layer context menu
function hideLayerContextMenu() {
    const contextMenu = document.getElementById('layerContextMenu');
    if (contextMenu) {
        contextMenu.style.display = 'none';
        contextMenu.classList.remove('context-menu-active');
        console.log('🙈 Layer context menu hidden');
    }
}

// Reset context menu variables
function resetContextMenuVariables() {
    currentContextLayerId = null;
    currentContextLayerName = null;
}

// Setup context menu event listeners
function setupLayerContextMenuListeners() {
    console.log('⚙️ Setting up layer context menu listeners...');
    
    const contextMenu = document.getElementById('layerContextMenu');
    if (!contextMenu) {
        console.error('❌ Layer context menu element not found during setup!');
        return;
    }
    
    console.log('✅ Found layer context menu element');
    
    contextMenu.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('🖱️ Click inside layer context menu - preventing propagation');
    });
    
    // Zoom to Layer
    const zoomToLayerBtn = document.getElementById('contextZoomToLayer');
    if (zoomToLayerBtn) {
        zoomToLayerBtn.addEventListener('click', function() {
            console.log('🔍 Zoom to Layer clicked for:', currentContextLayerName);
            if (currentContextLayerId) {
                zoomToLayer(currentContextLayerId);
                hideLayerContextMenu();
            }
        });
        console.log('✅ Zoom to Layer listener attached');
    } else {
        console.error('❌ Zoom to Layer button not found!');
    }
    
    // Rename Layer
    const renameBtn = document.getElementById('contextRename');
    if (renameBtn) {
        renameBtn.addEventListener('click', function() {
            console.log('✏️ Rename Layer clicked for:', currentContextLayerName);
            if (currentContextLayerId && currentContextLayerName) {
                hideLayerContextMenu();
                renameLayer(currentContextLayerId, currentContextLayerName);
            }
        });
        console.log('✅ Rename Layer listener attached');
    } else {
        console.error('❌ Rename Layer button not found!');
    }
    
    // Properties (open symbology editor)
    const propertiesBtn = document.getElementById('contextProperties');
    if (propertiesBtn) {
        propertiesBtn.addEventListener('click', function() {
            console.log('🎨 Properties clicked for:', currentContextLayerName);
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
        console.log('✅ Properties listener attached');
    } else {
        console.error('❌ Properties button not found!');
    }
    
    // Delete Layer
    const deleteBtn = document.getElementById('contextDelete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            console.log('🗑️ Delete Layer clicked for:', currentContextLayerName);
            const layerIdToDelete = currentContextLayerId;
            const layerNameToDelete = currentContextLayerName;

        if (!layerIdToDelete || !layerNameToDelete) {
            console.error('Cannot delete layer: No layer selected');
            showNotification('Cannot delete layer: No layer selected.', 'error');
            hideLayerContextMenu();
            return;
        }

        if (!layers.has(layerIdToDelete)) {
            console.error(`Cannot delete layer: Layer ${layerIdToDelete} not found`);
            showNotification(`Layer not found in system. Cannot delete.`, 'error');
            resetContextMenuVariables();
            return;
        }

        if (!this.classList.contains('disabled')) {
            hideLayerContextMenu();
            
            try {
                console.log(`🗑️ Deleting layer: ${layerNameToDelete}`);
                await deleteLayer(layerIdToDelete, layerNameToDelete);
            } finally {
                resetContextMenuVariables();
            }
        } else {
            const layerInfo = layers.get(layerIdToDelete);
            if (layerInfo && layerInfo.isPermanent) {
                console.log(`ℹ️ Cannot delete permanent layer: ${layerNameToDelete}`);
                showNotification(`"${layerNameToDelete}" is a permanent layer and cannot be deleted.`, 'info');
            } else {
                showNotification('This layer cannot be deleted.', 'info');
            }
            hideLayerContextMenu();
            resetContextMenuVariables();
        }
        });
        console.log('✅ Delete Layer listener attached');
    } else {
        console.error('❌ Delete Layer button not found!');
    }
    
    console.log('✅ All layer context menu listeners set up successfully');
}

// Zoom to layer function
function zoomToLayer(layerId) {
    const layerInfo = window.layers.get(layerId);
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

    if (!layerId || !layerName || !layers.has(layerId)) {
        const errorMsg = `Cannot delete layer: Invalid parameters`;
        console.error(errorMsg);
        showNotification(errorMsg, 'error');
        return;
    }

    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        const errorMsg = `Layer info for "${layerName}" is null or undefined`;
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
            databaseId: layerInfo.databaseId,
            isPermanent: layerInfo.isPermanent,
            fromDatabase: layerInfo.fromDatabase
        });
        
        try {
            // Delete from database first (if it's a dynamic layer)
            if (supabase && !layerInfo.isPermanent) {
                const shouldDeleteFromDB = layerInfo.fromDatabase || layerInfo.databaseId;
                
                if (shouldDeleteFromDB) {
                    console.log(`Deleting layer "${layerName}" from database...`);
                    const deleteResult = await deleteDynamicLayerFromDatabase(layerId, layerName);
                    
                    if (!deleteResult.success) {
                        console.error(`Database deletion failed:`, deleteResult.error);
                        const fallbackConfirmed = await showConfirm(`Failed to delete layer from database: ${deleteResult.error}\n\nDo you want to delete it locally anyway?`, 'Database Deletion Failed');
                        if (fallbackConfirmed) {
                            console.log('User chose to delete locally despite database error');
                        } else {
                            return;
                        }
                    } else {
                        console.log(`Layer "${layerName}" successfully deleted from database`);
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
            }
            
            // Remove from layers collection
            layers.delete(layerId);
            console.log(`Layer "${layerName}" removed from layers collection`);
            
            // Remove from layer order
            const orderIndex = layerOrder.indexOf(layerId);
            if (orderIndex !== -1) {
                layerOrder.splice(orderIndex, 1);
                console.log(`Layer "${layerName}" removed from layer order at index ${orderIndex}`);
            }
            
            // Remove any active filters for this layer
            if (activeFilters && activeFilters.has(layerId)) {
                activeFilters.delete(layerId);
                console.log(`Filters removed for layer "${layerName}"`);
            }
            
            // If this layer was selected for selection tool, deactivate it
            if (typeof activeSelectionLayerId !== 'undefined' && activeSelectionLayerId === layerId) {
                activeSelectionLayerId = null;
                if (typeof isSelectionActive !== 'undefined' && isSelectionActive) {
                    deactivateSelectionTool();
                }
                console.log(`Selection tool deactivated for deleted layer "${layerName}"`);
            }
            
            // Update UI
            updateLayersList();
            enhancedUpdateLegend();
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

    if (!layerId || !currentName || !layers.has(layerId)) {
        console.error('Cannot rename layer: Invalid parameters');
        showNotification('Cannot rename layer: Invalid parameters.', 'error');
        return;
    }

    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        const errorMsg = `Layer info for "${currentName}" is null or undefined`;
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
        return;
    }
    
    if (newName.trim() === '') {
        showNotification('Layer name cannot be empty.', 'error');
        return;
    }
    
    if (newName.trim() === currentName) {
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
        
        // Update database if layer is from database or has been saved
        if (supabase && (layerInfo.fromDatabase || layerInfo.databaseId)) {
            console.log(`Updating layer name in database...`);
            const updateResult = await updateLayerNameInDatabase(layerId, trimmedNewName);
            if (!updateResult.success) {
                console.error('Failed to update layer name in database:', updateResult.error);
                showNotification(`Layer renamed locally, but failed to update in database: ${updateResult.error}`, 'error');
            }
        }

        // Update the UI
        updateLayersList();
        updateSelectionLayerDropdown();
        enhancedUpdateLegend();

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

// Update layer name in database
async function updateLayerNameInDatabase(layerId, newName) {
    try {
        if (!currentUser) {
            console.error('User not authenticated, cannot update layer name');
            return { success: false, error: 'User not authenticated' };
        }

        const layerInfo = window.layers.get(layerId);
        if (!layerInfo) {
            return { success: false, error: 'Layer not found in local storage' };
        }

        console.log(`Attempting to update layer name in database:`, {
            localLayerId: layerId,
            databaseId: layerInfo.databaseId,
            newName: newName,
            userId: currentUser.id
        });

        let query = supabase.from('layers').update({
            name: newName,
            updated_at: new Date().toISOString()
        }).eq('user_id', currentUser.id);

        if (layerInfo.databaseId) {
            query = query.eq('id', layerInfo.databaseId);
        } else {
            query = query.eq('layer_id', layerId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error updating layer name in database:', error);
            return { success: false, error: `Database error: ${error.message}` };
        } else {
            console.log('Layer name updated in database successfully');
            return { success: true };
        }
    } catch (error) {
        console.error('Network error updating layer name in database:', error);
        return { success: false, error: `Network error: ${error.message}` };
    }
}

// Note: updateLegend functionality moved to enhancedUpdateLegend function

// Enhanced classification data extraction from multiple sources
function extractClassificationData(layerInfo) {
    console.log(`🔍 Extracting classification data for layer: ${layerInfo.name}`);
    
    // Priority 1: Direct classification property
    if (layerInfo.classification && layerInfo.classification.colorMap) {
        console.log('✅ Found direct classification data');
        return layerInfo.classification;
    }
    
    // Priority 2: Check style object for embedded classification
    if (layerInfo.style) {
        // Check if style contains classification data
        if (layerInfo.style.categoricalField && layerInfo.style.colorMap) {
            console.log('✅ Found classification in style object');
            return {
                field: layerInfo.style.categoricalField,
                colorMap: layerInfo.style.colorMap,
                strokeColor: layerInfo.style.strokeColor,
                strokeWidth: layerInfo.style.strokeWidth
            };
        }
        
        // Check if style is actually a function that contains classification logic
        if (typeof layerInfo.style === 'object' && layerInfo.style.classification) {
            console.log('✅ Found nested classification in style');
            return layerInfo.style.classification;
        }
    }
    
    // Priority 3: Try to extract from stored user/shared styles
    if (layerInfo.name) {
        const storedStyle = tryGetStoredStyleForLayer(layerInfo.name, layerInfo);
        if (storedStyle && storedStyle.categoricalField && storedStyle.colorMap) {
            console.log('✅ Found classification in stored style');
            return {
                field: storedStyle.categoricalField,
                colorMap: storedStyle.colorMap,
                strokeColor: storedStyle.strokeColor,
                strokeWidth: storedStyle.strokeWidth
            };
        }
    }
    
    // Priority 4: Try to analyze actual layer data for implicit categories
    const implicitClassification = analyzeLayerForImplicitCategories(layerInfo);
    if (implicitClassification) {
        console.log('✅ Detected implicit classification from layer analysis');
        return implicitClassification;
    }
    
    console.log('❌ No classification data found');
    return null;
}

// Try to get stored style for a layer (synchronous attempt)
function tryGetStoredStyleForLayer(layerName, layerInfo) {
    try {
        // This would normally be async, but we'll try to get it from cache
        // if available or from already loaded style data
        if (layerInfo.loadedStyle) {
            return layerInfo.loadedStyle;
        }
        return null;
    } catch (error) {
        console.warn('Error getting stored style:', error);
        return null;
    }
}

// Analyze layer data to detect implicit categories
function analyzeLayerForImplicitCategories(layerInfo) {
    try {
        if (!layerInfo.data || !layerInfo.data.features) {
            return null;
        }
        
        const features = layerInfo.data.features;
        if (features.length === 0) {
            return null;
        }
        
        // Look for commonly used categorical fields
        const categoricalFields = ['type', 'category', 'class', 'status', 'name', 'zone'];
        
        for (const field of categoricalFields) {
            const uniqueValues = new Set();
            let hasField = false;
            
            features.forEach(feature => {
                if (feature.properties && feature.properties[field] !== undefined) {
                    hasField = true;
                    uniqueValues.add(feature.properties[field]);
                }
            });
            
            // If we found a categorical field with reasonable number of unique values
            if (hasField && uniqueValues.size > 1 && uniqueValues.size <= 20) {
                console.log(`🔍 Detected implicit categorical field: ${field} with ${uniqueValues.size} categories`);
                
                // Generate a simple color map
                const colorMap = {};
                const colors = generateColorPalette(uniqueValues.size);
                let colorIndex = 0;
                
                uniqueValues.forEach(value => {
                    colorMap[value] = colors[colorIndex % colors.length];
                    colorIndex++;
                });
                
                return {
                    field: field,
                    colorMap: colorMap,
                    strokeColor: '#ffffff',
                    strokeWidth: 1,
                    isImplicit: true
                };
            }
        }
        
        return null;
    } catch (error) {
        console.warn('Error analyzing layer for implicit categories:', error);
        return null;
    }
}

// Generate a color palette for implicit categories
function generateColorPalette(count) {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#F4D03F'
    ];
    
    // If we need more colors than available, generate additional ones
    while (colors.length < count) {
        const hue = (colors.length * 137.508) % 360; // Golden angle
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    
    return colors.slice(0, count);
}

// Detect multiple styles in a layer (for layers that should be categorical but aren't)
function detectMultipleStyles(layerInfo) {
    try {
        if (!layerInfo.layer || !layerInfo.layer.eachLayer) {
            return null;
        }
        
        const styles = new Map();
        let featureCount = 0;
        
        layerInfo.layer.eachLayer(function(featureLayer) {
            featureCount++;
            if (featureLayer.options) {
                const styleKey = JSON.stringify({
                    fillColor: featureLayer.options.fillColor,
                    color: featureLayer.options.color,
                    weight: featureLayer.options.weight
                });
                
                if (!styles.has(styleKey)) {
                    styles.set(styleKey, {
                        fillColor: featureLayer.options.fillColor || '#888888',
                        strokeColor: featureLayer.options.color || '#ffffff',
                        strokeWidth: featureLayer.options.weight || 2,
                        count: 0
                    });
                }
                styles.get(styleKey).count++;
            }
        });
        
        // Only return if we have multiple styles and reasonable feature count
        if (styles.size > 1 && featureCount > 0) {
            return Array.from(styles.values());
        }
        
        return null;
    } catch (error) {
        console.warn('Error detecting multiple styles:', error);
        return null;
    }
}

// Get comprehensive style information for a layer
function getLayerStyleInfo(layerInfo) {
    let fillColor = '#888888';
    let strokeColor = '#ffffff';
    let strokeWidth = 2;
    let label = 'Single Symbol';
    
    // Try multiple sources for style information
    if (layerInfo.style) {
        fillColor = layerInfo.style.fillColor || fillColor;
        strokeColor = layerInfo.style.color || strokeColor;
        strokeWidth = layerInfo.style.weight || strokeWidth;
    }
    
    // Check if it's a permanent layer with special styling
    if (layerInfo.isPermanent) {
        label = 'Permanent Layer';
    } else if (layerInfo.fromDatabase) {
        label = 'Database Layer';
    }
    
    return { fillColor, strokeColor, strokeWidth, label };
}

// Create a legend style item
function createLegendStyleItem(styleInfo, label, isToggleable = false) {
    const styleItem = document.createElement('div');
    styleItem.className = 'legend-item flex items-center space-x-3 p-2 rounded hover:bg-gray-700/30';
    
    if (isToggleable) {
        styleItem.classList.add('cursor-pointer');
    }
    
    // Create color swatch
    const colorSwatch = document.createElement('div');
    colorSwatch.className = 'legend-color w-5 h-5 rounded border-2';
    colorSwatch.style.backgroundColor = styleInfo.fillColor || '#888888';
    colorSwatch.style.borderColor = styleInfo.strokeColor || '#ffffff';
    colorSwatch.style.borderWidth = `${Math.min(styleInfo.strokeWidth || 2, 2)}px`;
    
    const styleLabel = document.createElement('span');
    styleLabel.className = 'text-xs text-gray-300 flex-1';
    styleLabel.textContent = label;
    
    styleItem.appendChild(colorSwatch);
    styleItem.appendChild(styleLabel);
    
    if (styleInfo.count) {
        const countLabel = document.createElement('span');
        countLabel.className = 'text-xs text-gray-500';
        countLabel.textContent = `(${styleInfo.count})`;
        styleItem.appendChild(countLabel);
    }
    
    return styleItem;
}

// Enhanced real-time legend update system
function scheduleRealTimeLegendUpdate() {
    // Debounce legend updates to avoid excessive DOM manipulation
    if (window.legendUpdateTimeout) {
        clearTimeout(window.legendUpdateTimeout);
    }
    
    window.legendUpdateTimeout = setTimeout(() => {
        console.log('🔄 Performing real-time legend update...');
        enhancedUpdateLegend();
    }, 100); // 100ms debounce
}

// Auto-update legend when layer properties change
function watchLayerChanges() {
    console.log('👁️ Setting up layer change monitoring for real-time legend updates...');
    
    // Monitor the layers Map for changes
    if (window.layers) {
        // Override the set method to trigger legend updates
        const originalSet = window.layers.set;
        window.layers.set = function(key, value) {
            const result = originalSet.call(this, key, value);
            scheduleRealTimeLegendUpdate();
            return result;
        };
        
        // Override the delete method to trigger legend updates
        const originalDelete = window.layers.delete;
        window.layers.delete = function(key) {
            const result = originalDelete.call(this, key);
            scheduleRealTimeLegendUpdate();
            return result;
        };
    }
    
    // Set up periodic check for layer changes that might not trigger the above hooks
    setInterval(() => {
        if (window.layers && window.layers.size > 0) {
            let needsUpdate = false;
            
            window.layers.forEach((layerInfo, layerId) => {
                // Check if layer style or classification has changed
                if (layerInfo.lastLegendUpdate !== layerInfo.lastModified) {
                    needsUpdate = true;
                    layerInfo.lastLegendUpdate = layerInfo.lastModified;
                }
            });
            
            if (needsUpdate) {
                console.log('🔄 Detected layer changes, updating legend...');
                scheduleRealTimeLegendUpdate();
            }
        }
    }, 2000); // Check every 2 seconds
}

// Initialize the real-time legend update system
function initializeRealTimeLegendUpdates() {
    console.log('⚙️ Initializing real-time legend update system...');
    
    // Set up layer change monitoring
    watchLayerChanges();
    
    // Set up mutation observer for DOM changes that might affect legends
    if (typeof MutationObserver !== 'undefined') {
        const legendContent = document.getElementById('legendContent');
        if (legendContent) {
            const observer = new MutationObserver((mutations) => {
                let shouldUpdate = false;
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Only update if the change wasn't from our own legend update
                        const isLegendUpdate = Array.from(mutation.addedNodes).some(node => 
                            node.classList && node.classList.contains('legend-layer-container')
                        );
                        if (!isLegendUpdate) {
                            shouldUpdate = true;
                        }
                    }
                });
                
                if (shouldUpdate) {
                    scheduleRealTimeLegendUpdate();
                }
            });
            
            observer.observe(legendContent.parentElement, {
                childList: true,
                subtree: true
            });
            
            console.log('✅ DOM mutation observer set up for legend updates');
        }
    }
    
    console.log('✅ Real-time legend update system initialized');
}

// Toggle visibility of a specific category in a categorical layer
function toggleCategoryVisibility(layerId, categoryValue, categoryElement) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.classification || !layerInfo.classification.colorMap) {
        console.warn(`Layer ${layerId} does not have categorical classification`);
        return;
    }
    
    // Initialize hidden categories if not exists
    if (!layerInfo.hiddenCategories) {
        layerInfo.hiddenCategories = new Set();
    }
    
    const isCurrentlyHidden = layerInfo.hiddenCategories.has(categoryValue);
    const statusIndicator = categoryElement.querySelector('.toggle-status');
    const colorSwatch = categoryElement.querySelector('.legend-color-toggle');
    
    if (isCurrentlyHidden) {
        // Show this category
        layerInfo.hiddenCategories.delete(categoryValue);
        statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-green-500';
        statusIndicator.title = 'Category is visible';
        colorSwatch.style.opacity = '1';
        colorSwatch.style.filter = 'none';
    } else {
        // Hide this category
        layerInfo.hiddenCategories.add(categoryValue);
        statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-gray-500';
        statusIndicator.title = 'Category is hidden';
        colorSwatch.style.opacity = '0.3';
        colorSwatch.style.filter = 'grayscale(1)';
    }
    
    // Re-apply layer styling to map with updated visibility
    reapplyLayerStyling(layerId);
    
    // Trigger real-time legend update
    scheduleRealTimeLegendUpdate();
    
    console.log(`🎨 Toggled category "${categoryValue}" visibility for layer "${layerInfo.name}": ${isCurrentlyHidden ? 'shown' : 'hidden'}`);
}

// Toggle visibility of all categories in a categorical layer
function toggleAllCategories(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.classification || !layerInfo.classification.colorMap) {
        console.warn(`Layer ${layerId} does not have categorical classification`);
        return;
    }
    
    // Initialize hidden categories if not exists
    if (!layerInfo.hiddenCategories) {
        layerInfo.hiddenCategories = new Set();
    }
    
    const colorMapKeys = Object.keys(layerInfo.classification.colorMap);
    const allHidden = colorMapKeys.every(key => layerInfo.hiddenCategories.has(key));
    
    // Find all category elements for this layer
    const legendContainer = document.querySelector(`[data-layer-id="${layerId}"]`);
    if (!legendContainer) return;
    
    const categoryItems = legendContainer.querySelectorAll('.legend-item[data-category-value]');
    
    if (allHidden) {
        // Show all categories
        layerInfo.hiddenCategories.clear();
        categoryItems.forEach(item => {
            const statusIndicator = item.querySelector('.toggle-status');
            const colorSwatch = item.querySelector('.legend-color-toggle');
            statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-green-500';
            statusIndicator.title = 'Category is visible';
            colorSwatch.style.opacity = '1';
            colorSwatch.style.filter = 'none';
        });
        console.log(`👁️ Showed all categories for layer "${layerInfo.name}"`);
    } else {
        // Hide all categories
        colorMapKeys.forEach(key => layerInfo.hiddenCategories.add(key));
        categoryItems.forEach(item => {
            const statusIndicator = item.querySelector('.toggle-status');
            const colorSwatch = item.querySelector('.legend-color-toggle');
            statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-gray-500';
            statusIndicator.title = 'Category is hidden';
            colorSwatch.style.opacity = '0.3';
            colorSwatch.style.filter = 'grayscale(1)';
        });
        console.log(`🙈 Hid all categories for layer "${layerInfo.name}"`);
    }
    
    // Re-apply layer styling to map with updated visibility
    reapplyLayerStyling(layerId);
    
    // Trigger real-time legend update
    scheduleRealTimeLegendUpdate();
}

// Re-apply layer styling with category visibility filters
function reapplyLayerStyling(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) return;
    
    // Remove existing layer from map
    layerInfo.layer.remove();
    
    // Create new layer with updated styling
    const newLayer = L.geoJSON(layerInfo.data, {
        style: (feature) => {
            // Get the original style function
            const baseStyle = layerInfo.style || {};
            
            // Apply categorical styling if available
            if (layerInfo.classification && layerInfo.classification.field && layerInfo.classification.colorMap) {
                const fieldValue = feature.properties[layerInfo.classification.field];
                const fillColor = layerInfo.classification.colorMap[fieldValue];
                
                // Check if this category should be hidden
                if (layerInfo.hiddenCategories && layerInfo.hiddenCategories.has(fieldValue)) {
                    return {
                        ...baseStyle,
                        fillColor: fillColor,
                        color: layerInfo.classification.strokeColor || baseStyle.color || '#ffffff',
                        weight: layerInfo.classification.strokeWidth || baseStyle.weight || 2,
                        opacity: 0,
                        fillOpacity: 0
                    };
                }
                
                return {
                    ...baseStyle,
                    fillColor: fillColor,
                    color: layerInfo.classification.strokeColor || baseStyle.color || '#ffffff',
                    weight: layerInfo.classification.strokeWidth || baseStyle.weight || 2,
                    opacity: baseStyle.opacity || 1,
                    fillOpacity: baseStyle.fillOpacity || 0.7
                };
            }
            
            return baseStyle;
        },
        pointToLayer: (feature, latlng) => {
            const style = layerInfo.style || {};
            
            // Apply categorical styling if available
            if (layerInfo.classification && layerInfo.classification.field && layerInfo.classification.colorMap) {
                const fieldValue = feature.properties[layerInfo.classification.field];
                const fillColor = layerInfo.classification.colorMap[fieldValue];
                
                // Check if this category should be hidden
                if (layerInfo.hiddenCategories && layerInfo.hiddenCategories.has(fieldValue)) {
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: fillColor,
                        color: layerInfo.classification.strokeColor || '#ffffff',
                        weight: layerInfo.classification.strokeWidth || 2,
                        opacity: 0,
                        fillOpacity: 0
                    });
                }
                
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: fillColor,
                    color: layerInfo.classification.strokeColor || style.color || '#ffffff',
                    weight: layerInfo.classification.strokeWidth || style.weight || 2,
                    opacity: style.opacity || 1,
                    fillOpacity: style.fillOpacity || 0.7
                });
            }
            
            return L.circleMarker(latlng, {
                radius: 8,
                ...style
            });
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="modern-popup-container">';
                popupContent += '<div class="modern-popup-header">';
                popupContent += `<i class="fas fa-info-circle mr-2"></i>${layerInfo.name}</div>`;
                popupContent += '<div class="modern-popup-body">';
                
                for (let key in feature.properties) {
                    popupContent += `<div class="property-row">`;
                    popupContent += `<div class="property-key">${key}</div>`;
                    popupContent += `<div class="property-value">${feature.properties[key] || 'N/A'}</div>`;
                    popupContent += `</div>`;
                }
                
                popupContent += '</div></div>';
                layer.bindPopup(popupContent);
            }
        }
    });
    
    // Update layer reference and add to map
    layerInfo.layer = newLayer;
    if (layerInfo.visible) {
        newLayer.addTo(map);
    }
    
    // Update map layer order to maintain correct z-index
    updateMapLayerOrder();
}

// === EXPORT MODULE FUNCTIONS ===

// Export all functions to global scope for compatibility
window.addDataToMapWithPreloadedStyle = addDataToMapWithPreloadedStyle;
window.addDataToMap = addDataToMap;
window.loadPermanentLayerFromStorage = loadPermanentLayerFromStorage;
window.listPermanentLayers = listPermanentLayers;
window.saveDynamicLayerToDatabase = saveDynamicLayerToDatabase;
window.loadDynamicLayersFromDatabase = loadDynamicLayersFromDatabase;
window.deleteDynamicLayerFromDatabase = deleteDynamicLayerFromDatabase;
window.checkDatabaseHealth = checkDatabaseHealth;
window.clearOldLayerCaches = clearOldLayerCaches;
window.loadInitialData = loadInitialData;
window.loadPermanentLayersWithSymbology = loadPermanentLayersWithSymbology;
window.loadSinglePermanentLayer = loadSinglePermanentLayer;
window.getUserStyleForLayer = getUserStyleForLayer;
window.saveUserStyleForLayer = saveUserStyleForLayer;
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
window.updateLayerNameInDatabase = updateLayerNameInDatabase;
window.updateLegend = enhancedUpdateLegend;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.toggleAllCategories = toggleAllCategories;
window.reapplyLayerStyling = reapplyLayerStyling;
window.scheduleRealTimeLegendUpdate = scheduleRealTimeLegendUpdate;
window.initializeRealTimeLegendUpdates = initializeRealTimeLegendUpdates;

// Initialize real-time legend updates when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializeRealTimeLegendUpdates, 500);
    });
} else {
    setTimeout(initializeRealTimeLegendUpdates, 500);
}

console.log('✅ Enhanced Layer Manager module loaded - now with real-time legend updates and comprehensive symbology support');
console.log('📋 Database Performance Tips:');
console.log('   For optimal performance, ensure your Supabase layers table has these indexes:');
console.log('   CREATE INDEX IF NOT EXISTS idx_layers_user_id ON layers(user_id);');
console.log('   CREATE INDEX IF NOT EXISTS idx_layers_created_at ON layers(created_at DESC);');
console.log('   CREATE INDEX IF NOT EXISTS idx_layers_user_created ON layers(user_id, created_at DESC);');

// Validate critical functions are available
const criticalFunctions = [
    'setupLayerContextMenuListeners',
    'hideLayerContextMenu', 
    'showLayerContextMenu',
    'updateLayersList',
    'addDataToMap',
    'loadInitialData'
];

criticalFunctions.forEach(funcName => {
    if (typeof window[funcName] !== 'function') {
        console.error(`❌ Critical function ${funcName} not available on window object`);
    } else {
        console.log(`✅ Function ${funcName} available`);
    }
});

// === LAYER CONTEXT MENU FUNCTIONS ===

// Global variables for context menu
let currentContextLayerId = null;
let currentContextLayerName = null;

// Show layer context menu
function showLayerContextMenu(event, layerId, layerName) {
    const contextMenu = document.getElementById('layerContextMenu');
    if (!contextMenu) {
        console.error('Context menu element not found');
        return;
    }

    // Store current context layer info
    currentContextLayerId = layerId;
    currentContextLayerName = layerName;
    
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        console.error('Layer info not found for context menu');
        return;
    }

    // Update menu items based on layer type
    const renameItem = document.getElementById('contextRename');
    const deleteItem = document.getElementById('contextDelete');
    
    if (layerInfo.isPermanent) {
        // Disable rename and delete for permanent layers
        renameItem.classList.add('disabled');
        deleteItem.classList.add('disabled');
        renameItem.title = 'Cannot rename permanent layers';
        deleteItem.title = 'Cannot delete permanent layers';
    } else {
        // Enable rename and delete for dynamic layers
        renameItem.classList.remove('disabled');
        deleteItem.classList.remove('disabled');
        renameItem.title = 'Rename this layer';
        deleteItem.title = 'Delete this layer';
    }

    // Position the context menu
    const x = event.clientX;
    const y = event.clientY;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 160; // Approximate width of context menu
    const menuHeight = 150; // Approximate height of context menu
    
    // Adjust position to keep menu within viewport
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + menuWidth > viewportWidth) {
        adjustedX = x - menuWidth;
    }
    
    if (y + menuHeight > viewportHeight) {
        adjustedY = y - menuHeight;
    }
    
    // Ensure menu doesn't go off-screen
    adjustedX = Math.max(0, adjustedX);
    adjustedY = Math.max(0, adjustedY);

    contextMenu.style.left = adjustedX + 'px';
    contextMenu.style.top = adjustedY + 'px';
    contextMenu.style.display = 'block';
    
    // Add active class for animation
    setTimeout(() => {
        contextMenu.classList.add('context-menu-active');
    }, 10);
    
    console.log(`Context menu shown for layer: ${layerName} (${layerId})`);
}

// Hide layer context menu
function hideLayerContextMenu() {
    const contextMenu = document.getElementById('layerContextMenu');
    if (contextMenu) {
        contextMenu.classList.remove('context-menu-active');
        setTimeout(() => {
            contextMenu.style.display = 'none';
        }, 150); // Match animation duration
    }
    
    // Clear context variables
    currentContextLayerId = null;
    currentContextLayerName = null;
}

// Setup context menu event listeners
function setupLayerContextMenuListeners() {
    const contextMenu = document.getElementById('layerContextMenu');
    if (!contextMenu) {
        console.error('Context menu element not found during setup');
        return;
    }

    // Zoom to Layer
    const zoomToLayerItem = document.getElementById('contextZoomToLayer');
    if (zoomToLayerItem) {
        zoomToLayerItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentContextLayerId) {
                zoomToLayer(currentContextLayerId);
                hideLayerContextMenu();
            }
        });
    }

    // Rename Layer
    const renameItem = document.getElementById('contextRename');
    if (renameItem) {
        renameItem.addEventListener('click', async (e) => {
            e.preventDefault();
            if (currentContextLayerId && !renameItem.classList.contains('disabled')) {
                await renameLayer(currentContextLayerId, currentContextLayerName);
                hideLayerContextMenu();
            }
        });
    }

    // Properties (Open Symbology Editor)
    const propertiesItem = document.getElementById('contextProperties');
    if (propertiesItem) {
        propertiesItem.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentContextLayerId) {
                openSymbologyEditor(currentContextLayerId);
                hideLayerContextMenu();
            }
        });
    }

    // Delete Layer
    const deleteItem = document.getElementById('contextDelete');
    if (deleteItem) {
        deleteItem.addEventListener('click', async (e) => {
            e.preventDefault();
            if (currentContextLayerId && !deleteItem.classList.contains('disabled')) {
                await deleteLayer(currentContextLayerId, currentContextLayerName);
                hideLayerContextMenu();
            }
        });
    }

    console.log('✅ Layer context menu listeners setup complete');
}

// Zoom to layer function
function zoomToLayer(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        console.error('Layer not found for zoom operation:', layerId);
        showNotification('Cannot zoom to layer - layer not found', 'error');
        return;
    }

    try {
        // Get layer bounds and zoom to it
        const bounds = layerInfo.layer.getBounds();
        if (bounds.isValid()) {
            window.map.fitBounds(bounds, {
                padding: [20, 20],
                animate: true,
                duration: 0.5
            });
            console.log(`Zoomed to layer: ${layerInfo.name}`);
            showNotification(`Zoomed to layer: ${layerInfo.name}`, 'success');
        } else {
            console.warn('Layer bounds are not valid:', layerId);
            showNotification('Cannot zoom to layer - invalid bounds', 'warning');
        }
    } catch (error) {
        console.error('Error zooming to layer:', error);
        showNotification('Error zooming to layer', 'error');
    }
}

// Rename layer function
async function renameLayer(layerId, currentName) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        console.error('Layer not found for rename operation:', layerId);
        return;
    }

    // Check if it's a permanent layer
    if (layerInfo.isPermanent) {
        showNotification('Cannot rename permanent layers', 'warning');
        return;
    }

    try {
        // Use the global showPrompt function to get new name
        const newName = await showPrompt('Rename Layer', 'Enter new layer name:', currentName);
        
        if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
            const trimmedName = newName.trim();
            
            // Check if name already exists
            const existingLayer = Array.from(window.layers.values()).find(l => 
                l.name === trimmedName && l.layerId !== layerId
            );
            
            if (existingLayer) {
                showNotification('A layer with this name already exists', 'error');
                return;
            }

            // Update layer name in memory
            layerInfo.name = trimmedName;
            
            // Update database if it's a dynamic layer
            if (layerInfo.fromDatabase && layerInfo.databaseId) {
                const { error } = await supabase
                    .from('layers')
                    .update({ name: trimmedName })
                    .eq('id', layerInfo.databaseId)
                    .eq('user_id', currentUser.id);
                
                if (error) {
                    console.error('Error updating layer name in database:', error);
                    showNotification('Layer renamed locally but failed to update database', 'warning');
                } else {
                    console.log('Layer name updated in database');
                }
            }

            // Update UI
            updateLayersList();
            enhancedUpdateLegend();
            updateSelectionLayerDropdown();
            populateFilterLayers();
            
            console.log(`Layer renamed from "${currentName}" to "${trimmedName}"`);
            showNotification(`Layer renamed to "${trimmedName}"`, 'success');
        }
    } catch (error) {
        console.error('Error renaming layer:', error);
        showNotification('Error renaming layer', 'error');
    }
}

// Delete layer function
async function deleteLayer(layerId, layerName) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        console.error('Layer not found for delete operation:', layerId);
        return;
    }

    // Check if it's a permanent layer
    if (layerInfo.isPermanent) {
        showNotification('Cannot delete permanent layers', 'warning');
        return;
    }

    try {
        // Confirm deletion
        const confirmed = await showConfirm(
            'Delete Layer', 
            `Are you sure you want to delete the layer "${layerName}"?\n\nThis action cannot be undone.`
        );
        
        if (confirmed) {
            // Remove from map
            if (layerInfo.layer && window.map.hasLayer(layerInfo.layer)) {
                window.map.removeLayer(layerInfo.layer);
            }

            // Remove from database if it's a dynamic layer
            if (layerInfo.fromDatabase && layerInfo.databaseId) {
                const { error } = await supabase
                    .from('layers')
                    .delete()
                    .eq('id', layerInfo.databaseId)
                    .eq('user_id', currentUser.id);
                
                if (error) {
                    console.error('Error deleting layer from database:', error);
                    showNotification('Layer removed from map but failed to delete from database', 'warning');
                } else {
                    console.log('Layer deleted from database');
                }
            }

            // Remove from memory
            window.layers.delete(layerId);
            
            // Remove from layer order
            const orderIndex = window.layerOrder.indexOf(layerId);
            if (orderIndex > -1) {
                window.layerOrder.splice(orderIndex, 1);
            }

            // Update UI
            updateLayersList();
            enhancedUpdateLegend();
            updateSelectionLayerDropdown();
            populateFilterLayers();
            
            console.log(`Layer deleted: ${layerName} (${layerId})`);
            showNotification(`Layer "${layerName}" deleted successfully`, 'success');
        }
    } catch (error) {
        console.error('Error deleting layer:', error);
        showNotification('Error deleting layer', 'error');
    }
}

// Note: Selection dropdown functionality handled by updateSelectionLayerDropdown function

// === LEGEND TOGGLE FUNCTIONS ===

// Toggle visibility of a specific category in a categorical layer
function toggleCategoryVisibility(layerId, categoryValue, categoryItem) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        console.error('Layer not found for category toggle:', layerId);
        return;
    }

    console.log(`Toggling category visibility: ${categoryValue} in layer ${layerInfo.name}`);

    // Initialize hidden categories set if it doesn't exist
    if (!layerInfo.hiddenCategories) {
        layerInfo.hiddenCategories = new Set();
    }

    const isCurrentlyHidden = layerInfo.hiddenCategories.has(categoryValue);
    
    if (isCurrentlyHidden) {
        // Show the category
        layerInfo.hiddenCategories.delete(categoryValue);
        categoryItem.classList.remove('legend-item-hidden');
        
        // Update visual indicators
        const statusIndicator = categoryItem.querySelector('.toggle-status');
        const colorSwatch = categoryItem.querySelector('.legend-color-toggle');
        if (statusIndicator) {
            statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-green-500';
            statusIndicator.title = 'Category is visible';
        }
        if (colorSwatch) {
            colorSwatch.style.opacity = '1';
        }
        
        console.log(`Showing category: ${categoryValue}`);
    } else {
        // Hide the category
        layerInfo.hiddenCategories.add(categoryValue);
        categoryItem.classList.add('legend-item-hidden');
        
        // Update visual indicators
        const statusIndicator = categoryItem.querySelector('.toggle-status');
        const colorSwatch = categoryItem.querySelector('.legend-color-toggle');
        if (statusIndicator) {
            statusIndicator.className = 'toggle-status w-3 h-3 rounded-full bg-red-500';
            statusIndicator.title = 'Category is hidden';
        }
        if (colorSwatch) {
            colorSwatch.style.opacity = '0.3';
        }
        
        console.log(`Hiding category: ${categoryValue}`);
    }

    // Apply the visibility changes to the layer
    updateLayerCategoryVisibility(layerId);
    
    // Show notification
    const action = isCurrentlyHidden ? 'shown' : 'hidden';
    showNotification(`Category "${categoryValue}" ${action}`, 'info');
}

// Toggle all categories in a layer
function toggleAllCategories(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.classification || !layerInfo.classification.colorMap) {
        console.error('Layer not found or has no categorical classification:', layerId);
        return;
    }

    console.log(`Toggling all categories for layer: ${layerInfo.name}`);

    // Initialize hidden categories set if it doesn't exist
    if (!layerInfo.hiddenCategories) {
        layerInfo.hiddenCategories = new Set();
    }

    const allCategories = Object.keys(layerInfo.classification.colorMap);
    const hiddenCount = layerInfo.hiddenCategories.size;
    const shouldShowAll = hiddenCount > 0;

    if (shouldShowAll) {
        // Show all categories
        layerInfo.hiddenCategories.clear();
        console.log('Showing all categories');
        showNotification(`All categories shown for ${layerInfo.name}`, 'success');
    } else {
        // Hide all categories
        allCategories.forEach(category => {
            layerInfo.hiddenCategories.add(category);
        });
        console.log('Hiding all categories');
        showNotification(`All categories hidden for ${layerInfo.name}`, 'warning');
    }

    // Update the layer visibility
    updateLayerCategoryVisibility(layerId);
    
    // Update the legend UI
    enhancedUpdateLegend();
}

// Update layer style to reflect category visibility changes
function updateLayerCategoryVisibility(layerId) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer || !layerInfo.classification) {
        return;
    }

    const hiddenCategories = layerInfo.hiddenCategories || new Set();
    
    // Update the layer style function to hide/show categories
    layerInfo.layer.setStyle(function(feature) {
        const value = feature.properties[layerInfo.classification.field];
        const isHidden = hiddenCategories.has(value);
        
        if (isHidden) {
            // Make hidden categories transparent
            return {
                color: layerInfo.classification.strokeColor || '#ffffff',
                fillColor: layerInfo.classification.colorMap[value] || '#999999',
                weight: layerInfo.classification.strokeWidth || 2,
                opacity: 0,
                fillOpacity: 0
            };
        } else {
            // Show visible categories normally
            return {
                color: layerInfo.classification.strokeColor || '#ffffff',
                fillColor: layerInfo.classification.colorMap[value] || '#999999',
                weight: layerInfo.classification.strokeWidth || 2,
                opacity: 1.0,
                fillOpacity: 0.7
            };
        }
    });
    
    console.log(`Updated category visibility for layer ${layerInfo.name}, hidden: ${hiddenCategories.size} categories`);
}

// Extract comprehensive classification data from various sources
function extractClassificationData(layerInfo) {
    // Check multiple possible sources for classification data
    let classificationData = null;
    
    if (layerInfo.classification && layerInfo.classification.colorMap) {
        // Primary source: layerInfo.classification
        classificationData = {
            colorMap: layerInfo.classification.colorMap,
            field: layerInfo.classification.field,
            strokeColor: layerInfo.classification.strokeColor,
            strokeWidth: layerInfo.classification.strokeWidth
        };
    } else if (layerInfo.style && layerInfo.style.colorMap) {
        // Secondary source: layerInfo.style
        classificationData = {
            colorMap: layerInfo.style.colorMap,
            field: layerInfo.style.categoricalField,
            strokeColor: layerInfo.style.color,
            strokeWidth: layerInfo.style.weight
        };
    }
    
    return classificationData;
}

// Ensure legend updates when layers change
function enhancedUpdateLegend() {
    console.log('🎨 Enhanced legend update with toggle functionality');
    
    const legendContent = document.getElementById('legendContent');
    const noLegendMessage = document.getElementById('noLegendMessage');
    
    if (!legendContent) {
        console.error('Legend content element not found');
        return;
    }

    legendContent.innerHTML = '';
    
    // Get all visible layers
    const visibleLayers = Array.from(window.layers.values()).filter(layer => layer.visible);
    
    if (visibleLayers.length === 0) {
        // Show no legend message
        if (noLegendMessage) {
            noLegendMessage.style.display = 'block';
        }
        legendContent.style.display = 'none';
        return;
    }

    // Hide no legend message
    if (noLegendMessage) {
        noLegendMessage.style.display = 'none';
    }
    legendContent.style.display = 'block';

    // Process each visible layer
    visibleLayers.forEach(layerInfo => {
        const legendContainer = document.createElement('div');
        legendContainer.className = 'legend-layer-container mb-4 p-3 glass-section rounded-lg';
        legendContainer.dataset.layerId = layerInfo.layerId;
        
        // Layer name header
        const layerHeader = document.createElement('div');
        layerHeader.className = 'flex items-center justify-between mb-2';
        
        const layerNameDiv = document.createElement('div');
        layerNameDiv.className = 'text-sm font-medium text-white';
        layerNameDiv.textContent = layerInfo.name;
        layerHeader.appendChild(layerNameDiv);
        
        // Check for categorical classification
        const classificationData = extractClassificationData(layerInfo);
        
        if (classificationData && classificationData.colorMap && Object.keys(classificationData.colorMap).length > 1) {
            // Categorical layer - show categories with toggles
            console.log(`Creating categorical legend for: ${layerInfo.name}`);
            
            // Add "Toggle All" button
            const toggleAllBtn = document.createElement('button');
            toggleAllBtn.className = 'text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded transition-colors';
            toggleAllBtn.textContent = 'Toggle All';
            toggleAllBtn.title = 'Show/hide all categories';
            toggleAllBtn.addEventListener('click', () => toggleAllCategories(layerInfo.layerId));
            layerHeader.appendChild(toggleAllBtn);
            
            legendContainer.appendChild(layerHeader);
            
            // Create categories
            const categoriesContainer = document.createElement('div');
            categoriesContainer.className = 'legend-categories space-y-2';
            
            Object.entries(classificationData.colorMap).forEach(([value, fillColor]) => {
                const categoryItem = document.createElement('div');
                categoryItem.className = 'legend-item flex items-center space-x-3 p-2 rounded hover:bg-gray-700/30 cursor-pointer transition-colors';
                categoryItem.dataset.categoryValue = value;
                categoryItem.dataset.layerId = layerInfo.layerId;
                
                // Check if category is hidden
                const isHidden = layerInfo.hiddenCategories && layerInfo.hiddenCategories.has(value);
                if (isHidden) {
                    categoryItem.classList.add('legend-item-hidden');
                }
                
                // Color swatch
                const colorSwatch = document.createElement('div');
                colorSwatch.className = 'legend-color-toggle w-5 h-5 rounded border-2 cursor-pointer transition-all duration-200 hover:scale-110';
                colorSwatch.style.backgroundColor = fillColor;
                colorSwatch.style.borderColor = classificationData.strokeColor || '#ffffff';
                colorSwatch.style.borderWidth = '2px';
                colorSwatch.style.opacity = isHidden ? '0.3' : '1';
                colorSwatch.title = `Click to toggle visibility of "${value}"`;
                
                // Category label
                const categoryLabel = document.createElement('span');
                categoryLabel.className = 'text-xs text-gray-300 flex-1';
                categoryLabel.textContent = value;
                
                // Status indicator
                const statusIndicator = document.createElement('div');
                statusIndicator.className = `toggle-status w-3 h-3 rounded-full ${isHidden ? 'bg-red-500' : 'bg-green-500'}`;
                statusIndicator.title = isHidden ? 'Category is hidden' : 'Category is visible';
                
                // Add click handler for toggle
                categoryItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleCategoryVisibility(layerInfo.layerId, value, categoryItem);
                });
                
                categoryItem.appendChild(colorSwatch);
                categoryItem.appendChild(categoryLabel);
                categoryItem.appendChild(statusIndicator);
                categoriesContainer.appendChild(categoryItem);
            });
            
            legendContainer.appendChild(categoriesContainer);
            
        } else {
            // Single symbol layer - show single color swatch
            console.log(`Creating single symbol legend for: ${layerInfo.name}`);
            
            legendContainer.appendChild(layerHeader);
            
            const singleItem = document.createElement('div');
            singleItem.className = 'legend-item flex items-center space-x-3 p-2';
            
            const colorSwatch = document.createElement('div');
            colorSwatch.className = 'legend-color w-5 h-5 rounded border-2';
            colorSwatch.style.backgroundColor = layerInfo.style?.fillColor || '#888888';
            colorSwatch.style.borderColor = layerInfo.style?.color || '#ffffff';
            colorSwatch.style.borderWidth = '2px';
            
            const label = document.createElement('span');
            label.className = 'text-xs text-gray-300 flex-1';
            label.textContent = 'All features';
            
            singleItem.appendChild(colorSwatch);
            singleItem.appendChild(label);
            legendContainer.appendChild(singleItem);
        }
        
        legendContent.appendChild(legendContainer);
    });
    
    console.log(`✅ Enhanced legend updated with ${visibleLayers.length} layers`);
}

// Make functions globally available
window.showLayerContextMenu = showLayerContextMenu;
window.hideLayerContextMenu = hideLayerContextMenu;
window.setupLayerContextMenuListeners = setupLayerContextMenuListeners;
window.zoomToLayer = zoomToLayer;
window.renameLayer = renameLayer;
window.deleteLayer = deleteLayer;
window.updateSelectionDropdown = updateSelectionLayerDropdown;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.toggleAllCategories = toggleAllCategories;
window.updateLayerCategoryVisibility = updateLayerCategoryVisibility;
window.extractClassificationData = extractClassificationData;
window.enhancedUpdateLegend = enhancedUpdateLegend;