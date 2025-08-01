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
    
    // Check for categorical symbology - handle both old and new database formats
    const isCategorical = preloadedStyle.symbology_type === 'categorical' || 
                         (preloadedStyle.categoricalField && preloadedStyle.colorMap) ||
                         (preloadedStyle.classification_field && preloadedStyle.categories);
    
    if (isCategorical) {
        // Categorical symbology - apply color mapping per feature
        console.log('📊 Applying categorical symbology with preloaded colors');
        
        // Handle different database formats for categorical data
        let fieldName, colorMap;
        
        if (preloadedStyle.categoricalField && preloadedStyle.colorMap) {
            // Legacy format
            fieldName = preloadedStyle.categoricalField;
            colorMap = preloadedStyle.colorMap;
        } else if (preloadedStyle.classification_field && preloadedStyle.categories) {
            // New database format with categories array
            fieldName = preloadedStyle.classification_field;
            colorMap = {};
            preloadedStyle.categories.forEach(cat => {
                colorMap[cat.value] = cat.color;
            });
        } else if (preloadedStyle.classification_field && preloadedStyle.colorMap) {
            // Mixed format
            fieldName = preloadedStyle.classification_field;
            colorMap = preloadedStyle.colorMap;
        }
        
        console.log(`Using categorical field: ${fieldName}`, colorMap);
        
        layerStyleFunction = function(feature) {
            const fieldValue = feature.properties[fieldName];
            const color = colorMap[fieldValue] || '#14b8a6'; // fallback color
            return {
                color: preloadedStyle.stroke_color || preloadedStyle.strokeColor || '#ffffff',
                weight: preloadedStyle.stroke_weight || preloadedStyle.strokeWidth || 2,
                opacity: preloadedStyle.stroke_opacity || preloadedStyle.strokeOpacity || 1.0,
                fillColor: color,
                fillOpacity: preloadedStyle.fill_opacity || preloadedStyle.fillOpacity || 1.0
            };
        };
        
        // Store classification info for the symbology editor
        finalStyle.categoricalField = fieldName;
        finalStyle.colorMap = colorMap;
        
    } else {
        // Single symbol symbology - use consistent style
        console.log('🎯 Applying single symbol symbology with preloaded colors');
        layerStyleFunction = {
            color: preloadedStyle.stroke_color || preloadedStyle.strokeColor || preloadedStyle.color || '#ffffff',
            weight: preloadedStyle.stroke_weight || preloadedStyle.strokeWidth || preloadedStyle.weight || 2,
            opacity: preloadedStyle.stroke_opacity || preloadedStyle.strokeOpacity || preloadedStyle.opacity || 1.0,
            fillColor: preloadedStyle.fill_color || preloadedStyle.fillColor || '#888888',
            fillOpacity: preloadedStyle.fill_opacity || preloadedStyle.fillOpacity || 1.0
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
                
                // Right-click popup is handled by interaction-handlers.js
                // The context menu binding is automatically applied via bindContextMenuToLayers()
            }
        }
    }).addTo(map);

    // Removed old loading state tracking

    // Store layer information with preloaded style
    const layerInfo = {
        layer: layer,
        name: layerName,
        data: geoData,
        visible: true,
        style: finalStyle, // Store the complete preloaded style object
        originalData: JSON.parse(JSON.stringify(geoData)),
        opacity: preloadedStyle.fill_opacity || preloadedStyle.fillOpacity || 1.0,
        isPermanent: isPermanent,
        fromDatabase: false,
        layerId: layerId,
        createdAt: new Date().toISOString()
    };
    
    // Store classification info if this is categorical symbology
    if (isCategorical && finalStyle.categoricalField && finalStyle.colorMap) {
        layerInfo.classification = {
            field: finalStyle.categoricalField,
            colorMap: finalStyle.colorMap,
            strokeColor: preloadedStyle.stroke_color || preloadedStyle.strokeColor || '#ffffff',
            strokeWidth: preloadedStyle.stroke_weight || preloadedStyle.strokeWidth || 2
        };
    }
    
    window.layers.set(layerId, layerInfo);

    // Add to layer order for consistent display
    // For permanent layers, add to back to maintain loading order. For dynamic layers, add to front for visibility
    if (isPermanent) {
        window.layerOrder.push(layerId);
        console.log(`🗺️ Permanent layer "${layerName}" added to back of layer order (preserves user order preferences)`);
    } else {
        window.layerOrder.unshift(layerId);
        console.log(`🗺️ Dynamic layer "${layerName}" added to front of layer order (highest z-index, reorderable)`);
    }

    console.log(`✅ Layer "${layerName}" created with preloaded symbology - no flash occurred`);

    // Update UI elements
    updateLayersList();
    enhancedUpdateLegend();

    // Bind context menu handlers for the new layer
    if (typeof window.bindContextMenuToLayers === 'function') {
        setTimeout(() => window.bindContextMenuToLayers(), 100);
    }

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
        fillOpacity: 1.0
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
                
                // Right-click popup is handled by interaction-handlers.js
                // The context menu binding is automatically applied via bindContextMenuToLayers()
            }
        }
    }).addTo(map);

    // Removed old loading state tracking

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

    // Add to layer order for consistent display
    // For permanent layers, add to back to maintain loading order. For dynamic layers, add to front for visibility
    if (isPermanent) {
        layerOrder.push(layerId);
        console.log(`🗺️ Permanent layer "${layerName}" added to back of layer order (preserves user order preferences)`);
    } else {
        layerOrder.unshift(layerId);
        console.log(`🗺️ Dynamic layer "${layerName}" added to front of layer order (highest z-index, reorderable)`);
    }

    // Zoom to layer
    map.fitBounds(layer.getBounds());

    // Update UI
    updateLayersList();
    if (!fromDatabase) {
        enhancedUpdateLegend();
    }
    updateSelectionLayerDropdown(); // Update selection dropdown

    // Bind context menu handlers for the new layer
    if (typeof window.bindContextMenuToLayers === 'function') {
        setTimeout(() => window.bindContextMenuToLayers(), 100);
    }

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
            // Update loading state - no dynamic layers to load
            if (window.loadingState) {
                window.loadingState.totalDynamicLayers = 0;
                window.loadingState.dynamicLayersLoaded = 0;
            }
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
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
            
            // Set total dynamic layers count
            if (window.loadingState) {
                window.loadingState.totalDynamicLayers = savedLayers.length;
                window.loadingState.dynamicLayersLoaded = 0;
            }
            
            let loadedCount = 0;
            for (const savedLayer of savedLayers) {
                // Skip if layer already exists locally (check by database ID and by name)
                const existingLayer = Array.from(window.layers.entries()).find(([layerId, layerInfo]) => 
                    layerInfo.databaseId === savedLayer.id || layerInfo.name === savedLayer.name
                );
                if (existingLayer) {
                    console.log(`Skipping duplicate layer from database: ${savedLayer.name} (already exists on map)`);
                    continue;
                }

                // Additional safeguard: Skip any permanent layer names that shouldn't be in database
                if (savedLayer.name === 'Aera' || savedLayer.name === 'Proximity Roads' || savedLayer.name.endsWith('_permanent')) {
                    console.warn(`🚫 Found permanent layer "${savedLayer.name}" in database - this should not happen. Skipping load.`);
                    continue;
                }

                try {
                    if (typeof window.updateLoadingProgress === 'function') {
                        window.updateLoadingProgress('Loading dynamic layers', loadedCount + 1, savedLayers.length);
                    }
                    
                    // Add the saved layer to map (fromDatabase=true, isPermanent=false)
                    const newLayerId = addDataToMap(savedLayer.geojson_data, savedLayer.name, true, savedLayer.id, false);
                    loadedCount++;
                    
                    // Update loading state
                    if (window.loadingState) {
                        window.loadingState.dynamicLayersLoaded = loadedCount;
                    }
                    
                    console.log(`✅ Loaded dynamic layer from database: ${savedLayer.name}`);
                } catch (layerError) {
                    console.error(`Error loading layer "${savedLayer.name}":`, layerError);
                    loadedCount++;
                    if (window.loadingState) {
                        window.loadingState.dynamicLayersLoaded = loadedCount;
                    }
                }
            }
            
            if (loadedCount > 0) {
                // Loaded dynamic layers from database
            } else {
                console.log('No new dynamic layers to load from database');
            }
            
            // Check if loading is complete
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
        } else {
            console.log('No dynamic layers found in database for current user');
            // Update loading state - no dynamic layers to load
            if (window.loadingState) {
                window.loadingState.totalDynamicLayers = 0;
                window.loadingState.dynamicLayersLoaded = 0;
            }
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
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
            // Even on error, mark as complete to avoid infinite loading
            if (window.loadingState) {
                window.loadingState.totalDynamicLayers = 0;
                window.loadingState.dynamicLayersLoaded = 0;
            }
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
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
    // Show initialization loading screen (only once per session, auto-hides after 1 second)
    if (typeof window.showInitializationLoading === 'function') {
        window.showInitializationLoading();
    }
    
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
    } else {
        console.warn('⚠️ Supabase not available or user not authenticated - dynamic layers will not load');
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
            // Update loading state - no permanent layers to load
            if (window.loadingState) {
                window.loadingState.totalPermanentLayers = 0;
                window.loadingState.permanentLayersLoaded = 0;
            }
            if (typeof window.checkLoadingComplete === 'function') {
                window.checkLoadingComplete();
            }
            return;
        }

        // Set total permanent layers count
        if (window.loadingState) {
            window.loadingState.totalPermanentLayers = permanentFiles.length;
            window.loadingState.permanentLayersLoaded = 0;
        }

        // Load each permanent layer in reverse order to avoid predictable stacking
        // This reduces the hardcoded feel of layer ordering on refresh
        const reversedFiles = [...permanentFiles].reverse();
        let loadedCount = 0;
        
        for (const file of reversedFiles) {
            try {
                if (typeof window.updateLoadingProgress === 'function') {
                    window.updateLoadingProgress('Loading permanent layers', loadedCount + 1, permanentFiles.length);
                }
                
                await loadSinglePermanentLayer(file.name);
                loadedCount++;
                
                // Update loading state
                if (window.loadingState) {
                    window.loadingState.permanentLayersLoaded = loadedCount;
                }
                
                if (typeof window.checkLoadingComplete === 'function') {
                    window.checkLoadingComplete();
                }
                
            } catch (error) {
                console.error(`Failed to load permanent layer ${file.name}:`, error);
                loadedCount++;
                if (window.loadingState) {
                    window.loadingState.permanentLayersLoaded = loadedCount;
                }
            }
        }

        // Populate filter layers after permanent layers are loaded
        setTimeout(() => {
            console.log('Permanent layers loaded, populating filter layers');
            populateFilterLayers();
        }, 100);

    } catch (error) {
        console.error('Error in loadPermanentLayersWithSymbology:', error);
        // Even on error, mark as complete to avoid infinite loading
        if (window.loadingState) {
            window.loadingState.totalPermanentLayers = 0;
            window.loadingState.permanentLayersLoaded = 0;
        }
        if (typeof window.checkLoadingComplete === 'function') {
            window.checkLoadingComplete();
        }
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

// Refresh symbology for all permanent layers after authentication
async function refreshPermanentLayerSymbology() {
    console.log('🔄 Refreshing symbology for permanent layers after authentication...');
    
    // Find all permanent layers that might need style updates
    const permanentLayers = Array.from(window.layers.entries()).filter(([layerId, layerInfo]) => 
        layerInfo.isPermanent
    );
    
    if (permanentLayers.length === 0) {
        console.log('ℹ️ No permanent layers found to refresh');
        return;
    }
    
    for (const [layerId, layerInfo] of permanentLayers) {
        try {
            console.log(`🔄 Checking for updated symbology for permanent layer: ${layerInfo.name}`);
            
            // Check for stored symbology
            const storedSymbology = await getUserStyleForLayer(layerInfo.name);
            
            if (storedSymbology) {
                console.log(`✅ Found stored symbology for ${layerInfo.name}, applying update`);
                
                // Apply the stored symbology to the existing layer
                await applyStoredSymbologyToLayer(layerId, storedSymbology);
                
                // Update layer info with the new style
                layerInfo.style = storedSymbology;
                
                // Update classification info if categorical
                const isCategorical = storedSymbology.symbology_type === 'categorical' || 
                                     (storedSymbology.categoricalField && storedSymbology.colorMap) ||
                                     (storedSymbology.classification_field && storedSymbology.categories);
                
                if (isCategorical) {
                    // Handle different database formats for categorical data
                    let fieldName, colorMap;
                    
                    if (storedSymbology.categoricalField && storedSymbology.colorMap) {
                        fieldName = storedSymbology.categoricalField;
                        colorMap = storedSymbology.colorMap;
                    } else if (storedSymbology.classification_field && storedSymbology.categories) {
                        fieldName = storedSymbology.classification_field;
                        colorMap = {};
                        storedSymbology.categories.forEach(cat => {
                            colorMap[cat.value] = cat.color;
                        });
                    } else if (storedSymbology.classification_field && storedSymbology.colorMap) {
                        fieldName = storedSymbology.classification_field;
                        colorMap = storedSymbology.colorMap;
                    }
                    
                    if (fieldName && colorMap) {
                        layerInfo.classification = {
                            field: fieldName,
                            colorMap: colorMap,
                            strokeColor: storedSymbology.stroke_color || storedSymbology.strokeColor || '#ffffff',
                            strokeWidth: storedSymbology.stroke_weight || storedSymbology.strokeWidth || 2
                        };
                    }
                }
            } else {
                console.log(`ℹ️ No stored symbology found for ${layerInfo.name}`);
            }
        } catch (error) {
            console.error(`Error refreshing symbology for layer ${layerInfo.name}:`, error);
        }
    }
    
    // Update UI elements
    updateLayersList();
    enhancedUpdateLegend();
    
    console.log('✅ Permanent layer symbology refresh completed');
}

// Apply stored symbology to an existing layer
async function applyStoredSymbologyToLayer(layerId, storedSymbology) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        console.error('Layer not found for symbology application:', layerId);
        return;
    }
    
    // Check for categorical symbology
    const isCategorical = storedSymbology.symbology_type === 'categorical' || 
                         (storedSymbology.categoricalField && storedSymbology.colorMap) ||
                         (storedSymbology.classification_field && storedSymbology.categories);
    
    if (isCategorical) {
        // Handle categorical symbology
        let fieldName, colorMap;
        
        if (storedSymbology.categoricalField && storedSymbology.colorMap) {
            fieldName = storedSymbology.categoricalField;
            colorMap = storedSymbology.colorMap;
        } else if (storedSymbology.classification_field && storedSymbology.categories) {
            fieldName = storedSymbology.classification_field;
            colorMap = {};
            storedSymbology.categories.forEach(cat => {
                colorMap[cat.value] = cat.color;
            });
        } else if (storedSymbology.classification_field && storedSymbology.colorMap) {
            fieldName = storedSymbology.classification_field;
            colorMap = storedSymbology.colorMap;
        }
        
        if (fieldName && colorMap) {
            console.log(`Applying categorical symbology to layer ${layerId}:`, { fieldName, colorMap });
            layerInfo.layer.setStyle(function(feature) {
                const fieldValue = feature.properties[fieldName];
                const color = colorMap[fieldValue] || '#14b8a6';
                return {
                    color: storedSymbology.stroke_color || storedSymbology.strokeColor || '#ffffff',
                    weight: storedSymbology.stroke_weight || storedSymbology.strokeWidth || 2,
                    opacity: storedSymbology.stroke_opacity || storedSymbology.strokeOpacity || 1.0,
                    fillColor: color,
                    fillOpacity: storedSymbology.fill_opacity || storedSymbology.fillOpacity || 1.0
                };
            });
        }
    } else {
        // Apply single symbol symbology
        console.log(`Applying single symbol symbology to layer ${layerId}:`, storedSymbology);
        const style = {
            color: storedSymbology.stroke_color || storedSymbology.strokeColor || storedSymbology.color || '#ffffff',
            weight: storedSymbology.stroke_weight || storedSymbology.strokeWidth || storedSymbology.weight || 2,
            opacity: storedSymbology.stroke_opacity || storedSymbology.strokeOpacity || storedSymbology.opacity || 1.0,
            fillColor: storedSymbology.fill_color || storedSymbology.fillColor || '#888888',
            fillOpacity: storedSymbology.fill_opacity || storedSymbology.fillOpacity || 1.0
        };
        
        layerInfo.layer.setStyle(style);
    }
}

// === SYMBOLOGY MANAGEMENT FUNCTIONS ===

// Get user-specific or shared style for a layer
async function getUserStyleForLayer(layerName, retryCount = 0) {
    try {
        // Get current user state from global or authentication module
        const currentUserState = window.currentUser || window.getCurrentUser?.();
        
        if (!supabase) {
            console.log('Supabase not available, skipping style fetch');
            return null;
        }
        
        if (!currentUserState) {
            console.log(`User not authenticated for style fetch (attempt ${retryCount + 1})`);
            
            // If this is during initial load, try to wait a bit for authentication
            if (retryCount < 2) {
                console.log('Retrying style fetch after authentication delay...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return getUserStyleForLayer(layerName, retryCount + 1);
            }
            
            console.log('No authenticated user found after retries, skipping user-specific style fetch');
            return null;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        let styleData = null;
        
        console.log(`🔍 Fetching ${collaborativeMode ? 'shared' : 'user'} style for layer: ${layerName}`);
        
        if (collaborativeMode) {
            // Load from shared_styles table
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
            const { data, error } = await supabase
                .from('user_styles')
                .select('style')
                .eq('user_id', currentUserState.id)
                .eq('layer_id', layerName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching user style:', error);
                return null;
            }
            styleData = data;
        }

        if (styleData && styleData.style) {
            console.log(`✅ Retrieved ${collaborativeMode ? 'shared' : 'user'} style for ${layerName}:`, styleData.style);
            return styleData.style;
        }

        console.log(`ℹ️ No saved style found for layer: ${layerName}`);
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
        layerDiv.className = 'layer-item rounded-lg p-3 mb-2 transition-all duration-200 cursor-pointer' + 
            ' bg-black bg-opacity-40 backdrop-blur-sm border border-gray-600 border-opacity-30' + 
            ' hover:bg-opacity-60 hover:border-neon-teal hover:border-opacity-50';
        layerDiv.draggable = true;
        layerDiv.setAttribute('data-layer-id', layerId);
        layerDiv.setAttribute('data-layer-name', layerInfo.name);
        
        layerDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2 flex-1 min-w-0">
                    <i class="fas fa-grip-vertical layer-drag-handle text-sm text-gray-400 hover:text-neon-teal transition-colors cursor-move flex-shrink-0"></i>
                    <button class="visibility-btn text-sm transition-all duration-200 cursor-pointer bg-transparent border-0 p-1 rounded hover:bg-white hover:bg-opacity-10 flex-shrink-0" data-layer="${layerId}" title="Toggle Visibility">
                        <i class="fas ${layerInfo.visible ? 'fa-eye text-neon-teal hover:text-teal-300' : 'fa-eye-slash text-gray-500 hover:text-gray-400'}"></i>
                    </button>
                    <span class="font-medium ${layerInfo.isPermanent ? 'text-amber-300' : 'text-white'} truncate text-sm flex-1 min-w-0">
                        ${layerInfo.name}
                        ${layerInfo.isPermanent ? '<i class="fas fa-server text-xs ml-2 text-amber-400" title="Permanent layer from Supabase Storage"></i>' : ''}
                        ${layerInfo.fromDatabase && !layerInfo.isPermanent ? '<i class="fas fa-database text-xs ml-2 text-blue-400" title="Dynamic layer from database"></i>' : ''}
                    </span>
                </div>
                <div class="flex items-center space-x-1 flex-shrink-0 ml-2">
                    <button class="rename-btn text-gray-400 hover:text-white text-sm transition-all duration-200 bg-transparent border-0 p-1.5 rounded hover:bg-white hover:bg-opacity-10 ${layerInfo.isPermanent ? 'opacity-50 cursor-not-allowed' : ''}" data-layer="${layerId}" title="${layerInfo.isPermanent ? 'Cannot rename permanent layers' : 'Rename layer'}" ${layerInfo.isPermanent ? 'disabled' : ''}>
                        <i class="fas fa-font"></i>
                    </button>
                    <button class="delete-btn text-gray-400 hover:text-red-400 text-sm transition-all duration-200 bg-transparent border-0 p-1.5 rounded hover:bg-red-500 hover:bg-opacity-20 ${layerInfo.isPermanent ? 'opacity-50 cursor-not-allowed' : ''}" data-layer="${layerId}" title="${layerInfo.isPermanent ? 'Cannot delete permanent layers' : 'Delete layer'}" ${layerInfo.isPermanent ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="zoom-btn text-gray-400 hover:text-blue-400 text-sm transition-all duration-200 bg-transparent border-0 p-1.5 rounded hover:bg-blue-500 hover:bg-opacity-20" data-layer="${layerId}" title="Zoom to layer">
                        <i class="fas fa-search-plus"></i>
                    </button>
                    ${layerInfo.sourceType !== 'wms' ? `<button class="symbology-btn text-neon-teal hover:text-teal-300 text-sm transition-all duration-200 bg-transparent border-0 p-1.5 rounded hover:bg-neon-teal hover:bg-opacity-20" data-layer="${layerId}" title="Edit Symbology">
                        <i class="fas fa-palette"></i>
                    </button>` : ''}
                </div>
            </div>
            <div class="text-xs text-gray-400 mt-1 pl-8">
                <span class="inline-flex items-center">
                    <i class="fas fa-layer-group text-xs mr-1 text-gray-500"></i>
                    ${layerInfo.sourceType === 'wms' ? 'WMS Layer' : (Object.keys(layerInfo.data?.features || {}).length || layerInfo.data?.features?.length || 0) + ' features'}
                </span>
                ${layerInfo.isPermanent ? '<span class="ml-3 text-amber-400">• Storage</span>' : ''}
                ${layerInfo.fromDatabase && !layerInfo.isPermanent ? '<span class="ml-3 text-blue-400">• Database</span>' : ''}
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
            const currentVisibility = window.layers.get(layerId).visible;
            toggleLayerVisibility(layerId, !currentVisibility);
        });

        const symbologyBtn = layerDiv.querySelector('.symbology-btn');
        if (symbologyBtn) {
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
        }

        // Add rename button event listener
        const renameBtn = layerDiv.querySelector('.rename-btn');
        renameBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Don't proceed if it's a permanent layer
            if (layerInfo.isPermanent) {
                return;
            }
            
            console.log('Rename button clicked for layer:', layerId);
            try {
                await renameLayer(layerId, layerInfo.name);
            } catch (error) {
                console.error('Error renaming layer:', error);
                showError('Error renaming layer. Check console for details.', 'Rename Error');
            }
        });

        // Add delete button event listener
        const deleteBtn = layerDiv.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Don't proceed if it's a permanent layer
            if (layerInfo.isPermanent) {
                return;
            }
            
            console.log('Delete button clicked for layer:', layerId);
            try {
                await deleteLayer(layerId, layerInfo.name);
            } catch (error) {
                console.error('Error deleting layer:', error);
                showError('Error deleting layer. Check console for details.', 'Delete Error');
            }
        });

        // Add zoom button event listener
        const zoomBtn = layerDiv.querySelector('.zoom-btn');
        zoomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Zoom button clicked for layer:', layerId);
            try {
                window.zoomToLayer(layerId);
            } catch (error) {
                console.error('Error zooming to layer:', error);
                showError('Error zooming to layer. Check console for details.', 'Zoom Error');
            }
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
    
    // Update the UI and map rendering order immediately for drag-and-drop
    updateLayersList();
    updateMapLayerOrder(true); // Pass true for immediate update
    
    // Show feedback to user
    const draggedLayerInfo = layers.get(draggedLayerId);
    const targetLayerInfo = layers.get(targetLayerId);
    const draggedLayerName = draggedLayerInfo ? draggedLayerInfo.name : 'Unknown';
    const targetLayerName = targetLayerInfo ? targetLayerInfo.name : 'Unknown';
    
    // Visual feedback is already provided by the panel reordering and map layer changes
    // No notification needed as the user can see the result directly
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
        
        // Update the UI and map rendering order immediately for drag-and-drop
        updateLayersList();
        updateMapLayerOrder(true); // Pass true for immediate update
        
        // Show feedback to user
        const draggedLayerInfo = layers.get(draggedLayerId);
        const targetLayerInfo = layers.get(targetLayerId);
        const draggedLayerName = draggedLayerInfo ? draggedLayerInfo.name : 'Unknown';
        const targetLayerName = targetLayerInfo ? targetLayerInfo.name : 'Unknown';
        
        // Visual feedback is already provided by the panel reordering and map layer changes
        // No notification needed as the user can see the result directly
        
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

// Debounce timer for updateMapLayerOrder to prevent rapid successive calls
let updateMapLayerOrderTimeout = null;

// Core function to update map layer z-index without debouncing (for immediate updates)
function updateMapLayerOrderImmediate() {
    console.log('🔄 Immediately updating map layer rendering order:', {
        layerOrder: layerOrder,
        layerDetails: layerOrder.map(id => {
            const info = window.layers.get(id);
            return info ? { id, name: info.name, isPermanent: info.isPermanent, visible: info.visible } : { id, status: 'missing' };
        })
    });
    
    // Apply z-index order in single pass to avoid interference from basemap operations
    layerOrder.forEach((layerId, index) => {
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.layer) {
            try {
                // Calculate z-index: topmost layer in panel (index 0) gets highest z-index
                const zIndex = layerOrder.length - index;
                
                // Use setZIndexOffset for more reliable z-index control
                if (typeof layerInfo.layer.setZIndexOffset === 'function') {
                    layerInfo.layer.setZIndexOffset(zIndex * 100); // Multiply by 100 to avoid conflicts
                } else {
                    // Fallback to bringToFront/bringToBack for layers that don't support setZIndexOffset
                    layerInfo.layer.bringToBack();
                }
                
                const layerType = layerInfo.isPermanent ? 'Permanent' : 'User';
                console.log(`🔺 Set ${layerType} layer "${layerInfo.name}" (${layerId}) z-index: ${zIndex} - Panel position: ${index + 1}/${layerOrder.length}`);
            } catch (error) {
                console.warn(`Could not set z-index for layer ${layerId}:`, error);
            }
        }
    });
    
    // Second pass: bring layers to front in REVERSE order for layers without setZIndexOffset support
    [...layerOrder].reverse().forEach((layerId, reverseIndex) => {
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.visible && layerInfo.layer) {
            try {
                // Only use bringToFront for layers that don't support setZIndexOffset
                if (typeof layerInfo.layer.setZIndexOffset !== 'function') {
                    layerInfo.layer.bringToFront();
                    const layerType = layerInfo.isPermanent ? 'Permanent' : 'User';
                    const originalIndex = layerOrder.length - 1 - reverseIndex;
                    console.log(`🔺 Brought ${layerType} layer "${layerInfo.name}" (${layerId}) to front - Panel position: ${originalIndex + 1}/${layerOrder.length}, z-index: ${reverseIndex + 1}`);
                }
            } catch (error) {
                console.warn(`Could not bring layer ${layerId} to front:`, error);
            }
        }
    });
    
    // Ensure basemap stays at the bottom after layer reordering
    if (window.currentBasemap && typeof window.currentBasemap.bringToBack === 'function') {
        try {
            window.currentBasemap.bringToBack();
            console.log('🗺️ Ensured basemap stays at bottom after layer reordering');
        } catch (error) {
            console.warn('Could not ensure basemap position:', error);
        }
    }
    
    console.log('✅ Map layer rendering order updated immediately');
}

// Update map layer rendering order (debounced version for bulk operations)
function updateMapLayerOrder(immediate = false) {
    // If immediate update is requested (e.g., from drag-and-drop), bypass debouncing
    if (immediate) {
        updateMapLayerOrderImmediate();
        return;
    }
    
    // Clear any pending updates to prevent race conditions
    if (updateMapLayerOrderTimeout) {
        clearTimeout(updateMapLayerOrderTimeout);
    }
    
    // Debounce updates to prevent rapid successive calls for bulk operations
    updateMapLayerOrderTimeout = setTimeout(() => {
        // Use requestAnimationFrame to prevent race conditions and basemap interference
        requestAnimationFrame(() => {
            updateMapLayerOrderImmediate();
        });
    }, 50); // 50ms debounce delay for bulk operations
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


// Show layer context menu
// DUPLICATE FUNCTION REMOVED - orphaned code statements have been cleaned up



// Setup context menu event listeners

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
            
            // Refresh label system if available
            if (typeof window.refreshLabelsOnLayerChange === 'function') {
                window.refreshLabelsOnLayerChange();
            }
            
            return result;
        };
        
        // Override the delete method to trigger legend updates
        const originalDelete = window.layers.delete;
        window.layers.delete = function(key) {
            const result = originalDelete.call(this, key);
            scheduleRealTimeLegendUpdate();
            
            // Refresh label system if available
            if (typeof window.refreshLabelsOnLayerChange === 'function') {
                window.refreshLabelsOnLayerChange();
            }
            
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
    
    // Get classification data from multiple sources
    const classificationData = extractClassificationData(layerInfo);
    if (!layerInfo || !classificationData) {
        console.warn(`Layer ${layerId} does not have categorical classification data`);
        return;
    }
    
    // Initialize hidden categories if not exists
    if (!layerInfo.hiddenCategories) {
        layerInfo.hiddenCategories = new Set();
    }
    
    const isCurrentlyHidden = layerInfo.hiddenCategories.has(categoryValue);
    const eyeIndicator = categoryElement.querySelector('.toggle-eye');
    const colorSwatch = categoryElement.querySelector('.legend-color-toggle');
    const categoryLabel = categoryElement.querySelector('span');
    
    if (isCurrentlyHidden) {
        // Show this category
        layerInfo.hiddenCategories.delete(categoryValue);
        
        // Update UI with smooth transitions
        if (eyeIndicator) {
            eyeIndicator.className = 'toggle-eye fas fa-eye text-green-400 text-sm cursor-pointer hover:scale-110 transition-all';
            eyeIndicator.title = 'Click to hide category';
        }
        if (colorSwatch) {
            colorSwatch.style.opacity = '1';
            colorSwatch.style.transform = 'scale(1)';
            colorSwatch.style.filter = 'none';
        }
        if (categoryLabel) {
            categoryLabel.className = 'text-xs flex-1 transition-colors text-gray-300';
        }
        
        // Update container styling
        categoryElement.style.opacity = '1';
        categoryElement.style.backgroundColor = 'transparent';
        categoryElement.classList.remove('legend-item-hidden');
        
    } else {
        // Hide this category
        layerInfo.hiddenCategories.add(categoryValue);
        
        // Update UI with smooth transitions
        if (eyeIndicator) {
            eyeIndicator.className = 'toggle-eye fas fa-eye-slash text-red-400 text-sm cursor-pointer hover:scale-110 transition-all';
            eyeIndicator.title = 'Click to show category';
        }
        if (colorSwatch) {
            colorSwatch.style.opacity = '0.3';
            colorSwatch.style.transform = 'scale(0.9)';
            colorSwatch.style.filter = 'grayscale(1)';
        }
        if (categoryLabel) {
            categoryLabel.className = 'text-xs flex-1 transition-colors text-gray-500 line-through';
        }
        
        // Update container styling
        categoryElement.style.opacity = '0.6';
        categoryElement.style.backgroundColor = 'rgba(107, 114, 128, 0.1)';
        categoryElement.classList.add('legend-item-hidden');
    }
    
    // Re-apply layer styling to map with updated visibility
    try {
        const updateResult = updateLayerCategoryVisibility(layerId);
        
        // Only show error if there was an actual failure, not just a warning
        if (updateResult === false) {
            console.warn(`Warning: Could not update category visibility for layer ${layerId}, but UI changes applied`);
        }
        
        // Force a map refresh to ensure changes are visible immediately
        if (layerInfo.layer && map.hasLayer(layerInfo.layer)) {
            layerInfo.layer.redraw();
        }
        
        // Trigger real-time legend update
        scheduleRealTimeLegendUpdate();
        
        console.log(`✅ Successfully toggled category "${categoryValue}" for layer "${layerInfo.name}"`);
    } catch (error) {
        console.error('Error updating layer category visibility:', error);
        // Don't prevent the UI updates from happening even if there's an error
    }
    
    // Visual feedback is provided through the eye icon and styling changes
    // No notification popup needed as the change is immediately visible
    const action = isCurrentlyHidden ? 'shown' : 'hidden';
    console.log(`🎨 Toggled category "${categoryValue}" visibility for layer "${layerInfo.name}": ${action}`);
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
            const eyeIndicator = item.querySelector('.toggle-eye');
            const colorSwatch = item.querySelector('.legend-color-toggle');
            eyeIndicator.className = 'toggle-eye fas fa-eye text-green-400 text-sm cursor-pointer hover:scale-110 transition-all';
            eyeIndicator.title = 'Click to hide category';
            colorSwatch.style.opacity = '1';
            colorSwatch.style.filter = 'none';
        });
        console.log(`👁️ Showed all categories for layer "${layerInfo.name}"`);
    } else {
        // Hide all categories
        colorMapKeys.forEach(key => layerInfo.hiddenCategories.add(key));
        categoryItems.forEach(item => {
            const eyeIndicator = item.querySelector('.toggle-eye');
            const colorSwatch = item.querySelector('.legend-color-toggle');
            eyeIndicator.className = 'toggle-eye fas fa-eye-slash text-red-400 text-sm cursor-pointer hover:scale-110 transition-all';
            eyeIndicator.title = 'Click to show category';
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
        renderer: L.canvas(), // Force canvas rendering for export compatibility
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
                    fillOpacity: baseStyle.fillOpacity || 1.0
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
                    fillOpacity: style.fillOpacity || 1.0
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
        
        // Track layer loading for loading overlay
        if (typeof window.trackLayerLoading === 'function') {
            window.trackLayerLoading(newLayer, layerId);
        }
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
window.refreshPermanentLayerSymbology = refreshPermanentLayerSymbology;
window.applyStoredSymbologyToLayer = applyStoredSymbologyToLayer;
window.getUserStyleForLayer = getUserStyleForLayer;
window.saveUserStyleForLayer = saveUserStyleForLayer;
window.updateLayersList = updateLayersList;
window.setupLayerDragDrop = setupLayerDragDrop;
window.reorderLayer = reorderLayer;
window.updateMapLayerOrder = updateMapLayerOrder;
window.updateMapLayerOrderImmediate = updateMapLayerOrderImmediate;
window.updateSelectionLayerDropdown = updateSelectionLayerDropdown;
window.toggleLayerVisibility = toggleLayerVisibility;
window.zoomToLayer = zoomToLayer;
window.deleteLayer = deleteLayer;
window.renameLayer = renameLayer;
// Update layer name in database
async function updateLayerNameInDatabase(layerId, newName) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo) {
        return false;
    }

    // Check if this is a dynamic layer that should be saved to database
    const shouldUpdateDatabase = layerInfo.isUserGenerated || layerInfo.isFilteredSelection;
    if (!shouldUpdateDatabase || !window.supabase || !window.currentUser) {
        return false;
    }

    try {
        // First, try to update by database ID if available
        if (layerInfo.databaseId) {
            const { error } = await supabase
                .from('layers')
                .update({ name: newName })
                .eq('id', layerInfo.databaseId)
                .eq('user_id', currentUser.id);
            
            if (error) {
                console.error('Error updating layer name in database by ID:', error);
                return false;
            }
            
            console.log('Layer name updated in database by ID');
            return true;
        } else {
            // If no database ID, try to find and update by current name
            const { error } = await supabase
                .from('layers')
                .update({ name: newName })
                .eq('name', layerInfo.name)
                .eq('user_id', currentUser.id);
            
            if (error) {
                console.error('Error updating layer name in database by name:', error);
                return false;
            }
            
            console.log('Layer name updated in database by name');
            return true;
        }
    } catch (error) {
        console.error('Database error during layer name update:', error);
        return false;
    }
}

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
            // Zoomed to layer
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
            
            // Update database if it's a dynamic layer that should be saved
            const shouldUpdateDatabase = layerInfo.isUserGenerated || layerInfo.isFilteredSelection;
            if (shouldUpdateDatabase && window.supabase && window.currentUser) {
                try {
                    // First, try to update by database ID if available
                    if (layerInfo.databaseId) {
                        const { error } = await supabase
                            .from('layers')
                            .update({ name: trimmedName })
                            .eq('id', layerInfo.databaseId)
                            .eq('user_id', currentUser.id);
                        
                        if (error) {
                            console.error('Error updating layer name in database by ID:', error);
                            showNotification('Layer renamed locally but failed to update database', 'warning');
                        } else {
                            console.log('Layer name updated in database by ID');
                        }
                    } else {
                        // If no database ID, try to find and update by current name
                        const { error } = await supabase
                            .from('layers')
                            .update({ name: trimmedName })
                            .eq('name', currentName)
                            .eq('user_id', currentUser.id);
                        
                        if (error) {
                            console.error('Error updating layer name in database by name:', error);
                            showNotification('Layer renamed locally but failed to update database', 'warning');
                        } else {
                            console.log('Layer name updated in database by name');
                        }
                    }
                } catch (dbError) {
                    console.error('Database error during layer rename:', dbError);
                    showNotification('Layer renamed locally but database update failed', 'warning');
                }
            }

            // Update UI
            updateLayersList();
            enhancedUpdateLegend();
            updateSelectionLayerDropdown();
            populateFilterLayers();
            
            console.log(`Layer renamed from "${currentName}" to "${trimmedName}"`);
            // Layer renamed
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
            // Layer deleted
        }
    } catch (error) {
        console.error('Error deleting layer:', error);
        showNotification('Error deleting layer', 'error');
    }
}

// Note: Selection dropdown functionality handled by updateSelectionLayerDropdown function

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
        // All categories shown
    } else {
        // Hide all categories
        allCategories.forEach(category => {
            layerInfo.hiddenCategories.add(category);
        });
        console.log('Hiding all categories');
        // All categories hidden
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
        console.warn(`Cannot update category visibility for layer ${layerId}: missing layer data or classification`);
        return false;
    }

    const hiddenCategories = layerInfo.hiddenCategories || new Set();
    
    // Update the layer style function to hide/show categories
    layerInfo.layer.setStyle(function(feature) {
        const value = feature.properties[layerInfo.classification.field];
        const isHidden = hiddenCategories.has(value);
        
        // Get the proper styling for this category
        const baseStyle = {
            color: layerInfo.classification.strokeColor || '#ffffff',
            fillColor: layerInfo.classification.colorMap[value] || '#999999',
            weight: layerInfo.classification.strokeWidth || 2,
            opacity: layerInfo.classification.strokeOpacity || 1.0,
            fillOpacity: layerInfo.classification.fillOpacity || 0.7
        };
        
        if (isHidden) {
            // Make hidden categories completely invisible
            return {
                ...baseStyle,
                opacity: 0,
                fillOpacity: 0
            };
        } else {
            // Show visible categories with proper styling
            return baseStyle;
        }
    });
    
    console.log(`Updated category visibility for layer ${layerInfo.name}, hidden: ${hiddenCategories.size} categories`);
    return true;
}

// Extract comprehensive classification data from various sources
function extractClassificationData(layerInfo) {
    // Check multiple possible sources for classification data
    let classificationData = null;
    
    // Priority 1: Direct classification object (from symbology editor)
    if (layerInfo.classification && layerInfo.classification.colorMap) {
        console.log('✅ Found classification in layerInfo.classification');
        classificationData = {
            colorMap: layerInfo.classification.colorMap,
            field: layerInfo.classification.field,
            strokeColor: layerInfo.classification.strokeColor || '#ffffff',
            strokeWidth: layerInfo.classification.strokeWidth || 2
        };
    }
    // Priority 2: Check style object for embedded classification
    else if (layerInfo.style) {
        // Check if style contains classification data
        if (layerInfo.style.categoricalField && layerInfo.style.colorMap) {
            console.log('✅ Found classification in style object');
            classificationData = {
                field: layerInfo.style.categoricalField,
                colorMap: layerInfo.style.colorMap,
                strokeColor: layerInfo.style.strokeColor || layerInfo.style.color || '#ffffff',
                strokeWidth: layerInfo.style.strokeWidth || layerInfo.style.weight || 2
            };
        }
        // Check if style is actually a function that contains classification logic
        else if (typeof layerInfo.style === 'object' && layerInfo.style.classification) {
            console.log('✅ Found nested classification in style');
            classificationData = layerInfo.style.classification;
        }
    }
    
    // Priority 3: Extract from actual layer styling if it exists
    if (!classificationData && layerInfo.layer && layerInfo.layer.options && layerInfo.layer.options.style) {
        const styleFunc = layerInfo.layer.options.style;
        if (typeof styleFunc === 'function' && layerInfo.data && layerInfo.data.features) {
            console.log('✅ Attempting to extract from layer style function');
            // Try to extract color mapping by testing the style function
            const testFeatures = layerInfo.data.features.slice(0, 10); // Sample first 10 features
            const colorMap = {};
            let field = null;
            
            for (const feature of testFeatures) {
                const style = styleFunc(feature);
                if (style && style.fillColor) {
                    // Try to find the field by checking all properties
                    for (const [key, value] of Object.entries(feature.properties || {})) {
                        if (value !== null && value !== undefined) {
                            if (!field) field = key;
                            if (key === field) {
                                colorMap[value] = style.fillColor;
                            }
                        }
                    }
                }
            }
            
            if (Object.keys(colorMap).length > 1) {
                classificationData = {
                    field: field,
                    colorMap: colorMap,
                    strokeColor: '#ffffff',
                    strokeWidth: 2
                };
            }
        }
    }
    
    if (classificationData) {
        console.log(`✅ Extracted classification data for field: ${classificationData.field}, categories: ${Object.keys(classificationData.colorMap).length}`);
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
            
            // No global toggle button - individual eye icons only
            
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
                
                // Eye icon indicator
                const eyeIndicator = document.createElement('i');
                eyeIndicator.className = `toggle-eye fas ${isHidden ? 'fa-eye-slash text-red-400' : 'fa-eye text-green-400'} text-sm cursor-pointer hover:scale-110 transition-all`;
                eyeIndicator.title = isHidden ? 'Click to show category' : 'Click to hide category';
                
                // Add click handler specifically to the eye icon for better UX
                eyeIndicator.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCategoryVisibility(layerInfo.layerId, value, categoryItem);
                });
                
                // Also allow clicking the color swatch for convenience
                colorSwatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCategoryVisibility(layerInfo.layerId, value, categoryItem);
                });
                
                categoryItem.appendChild(colorSwatch);
                categoryItem.appendChild(categoryLabel);
                categoryItem.appendChild(eyeIndicator);
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
            
            // Extract actual colors from layer styling
            let fillColor = '#888888';
            let strokeColor = '#ffffff';
            
            // Try multiple sources for style information
            if (layerInfo.style) {
                fillColor = layerInfo.style.fillColor || fillColor;
                strokeColor = layerInfo.style.color || strokeColor;
            }
            
            // Check if it's a permanent layer with special styling
            if (layerInfo.layer && layerInfo.layer.options && layerInfo.layer.options.style) {
                const styleFunc = layerInfo.layer.options.style;
                if (typeof styleFunc === 'function' && layerInfo.data && layerInfo.data.features && layerInfo.data.features.length > 0) {
                    // Extract style from the first feature
                    const sampleStyle = styleFunc(layerInfo.data.features[0]);
                    if (sampleStyle) {
                        fillColor = sampleStyle.fillColor || fillColor;
                        strokeColor = sampleStyle.color || strokeColor;
                    }
                }
            }
            
            colorSwatch.style.backgroundColor = fillColor;
            colorSwatch.style.borderColor = strokeColor;
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
    
    // Event listeners are now attached directly to individual elements during creation
    // This ensures better performance and more intuitive user interaction
}

// Make functions globally available
window.zoomToLayer = zoomToLayer;
window.renameLayer = renameLayer;
window.deleteLayer = deleteLayer;
window.updateSelectionDropdown = updateSelectionLayerDropdown;
window.toggleCategoryVisibility = toggleCategoryVisibility;
window.toggleAllCategories = toggleAllCategories;
window.updateLayerCategoryVisibility = updateLayerCategoryVisibility;
window.extractClassificationData = extractClassificationData;
window.enhancedUpdateLegend = enhancedUpdateLegend;