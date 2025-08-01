// Enhanced dynamic field population for all layer types
function populateFilterFields(layerId) {
    console.log(`🔄 Populating fields for layer: ${layerId}`);
    const fieldSelect = document.getElementById('filterFieldSelect');
    
    if (!fieldSelect) {
        console.error('❌ filterFieldSelect element not found');
        return;
    }
    
    fieldSelect.innerHTML = '<option value="">Loading fields...</option>';
    
    if (!layerId || !layers.has(layerId)) {
        console.error(`❌ Layer ${layerId} not found in layers map`);
        fieldSelect.innerHTML = '<option value="">Layer not found</option>';
        return;
    }
    
    const layerInfo = layers.get(layerId);
    console.log(`📊 Layer info for ${layerId}:`, {
        name: layerInfo.name,
        isPermanent: layerInfo.isPermanent,
        isUserGenerated: layerInfo.isUserGenerated,
        isFilteredSelection: layerInfo.isFilteredSelection,
        hasData: !!(layerInfo.data),
        hasOriginalData: !!(layerInfo.originalData)
    });
    
    // Get the appropriate data source
    let geoData = layerInfo.originalData || layerInfo.data;
    
    if (!geoData || !geoData.features || geoData.features.length === 0) {
        console.error(`❌ No valid GeoJSON data found for layer ${layerId}`);
        fieldSelect.innerHTML = '<option value="">No data available</option>';
        return;
    }
    
    try {
        // Extract field names from the first feature's properties
        const firstFeature = geoData.features[0];
        if (!firstFeature.properties) {
            console.error(`❌ First feature has no properties for layer ${layerId}`);
            fieldSelect.innerHTML = '<option value="">No attributes found</option>';
            return;
        }
        
        const fieldNames = Object.keys(firstFeature.properties);
        console.log(`📋 Fields found for ${layerInfo.name}:`, fieldNames);
        
        if (fieldNames.length === 0) {
            fieldSelect.innerHTML = '<option value="">No attributes found</option>';
            return;
        }
        
        // Clear dropdown and add default option
        fieldSelect.innerHTML = '<option value="">Choose a field to filter by</option>';
        
        // Sort field names alphabetically for better UX
        fieldNames.sort().forEach(fieldName => {
            const option = document.createElement('option');
            option.value = fieldName;
            option.textContent = fieldName;
            fieldSelect.appendChild(option);
        });
        
        console.log(`✅ SUCCESS: ${fieldNames.length} fields added to dropdown for layer ${layerInfo.name}`);
        
        // Show the field section
        document.getElementById('filterFieldSection').style.display = 'block';
        
    } catch (error) {
        console.error(`❌ Error populating fields for layer ${layerId}:`, error);
        fieldSelect.innerHTML = '<option value="">Error loading fields</option>';
    }
}
/**
 * Filter System Module for Aéra Link WebGIS
 * Handles all filtering functionality including UI binding, filter logic, and selected features processing
 */

// Filter state management
let currentFilterState = {
    selectedLayer: null,
    selectedField: null,
    selectedOperator: null,
    filterValue: null,
    activeFilter: null
};

// Helper function to preserve and reconstruct styling functions
function preserveLayerStyling(layerInfo) {
    console.log('🔄 Preserving layer styling for filter operations...');
    
    // If we already have the original styling function preserved, use it
    if (layerInfo.originalStyleFunction) {
        console.log('✅ Original styling function already preserved');
        return layerInfo.originalStyleFunction;
    }
    
    // Check if the current layer has a styling function (for categorical symbology)
    if (layerInfo.layer && layerInfo.layer.options && typeof layerInfo.layer.options.style === 'function') {
        console.log('✅ Preserving active categorical styling function');
        layerInfo.originalStyleFunction = layerInfo.layer.options.style;
        return layerInfo.originalStyleFunction;
    }
    
    // Check if we can reconstruct from stored style data
    if (layerInfo.style && (layerInfo.style.categoricalField || layerInfo.style.classification_field)) {
        console.log('🔄 Reconstructing categorical styling function from style data');
        const fieldName = layerInfo.style.categoricalField || layerInfo.style.classification_field;
        const colorMap = layerInfo.style.colorMap;
        
        if (fieldName && colorMap) {
            const styleFunction = function(feature) {
                const fieldValue = feature.properties[fieldName];
                const color = colorMap[fieldValue] || layerInfo.style.fillColor || layerInfo.style.fill_color || '#14b8a6';
                return {
                    color: layerInfo.style.strokeColor || layerInfo.style.stroke_color || layerInfo.style.color || '#ffffff',
                    weight: layerInfo.style.strokeWidth || layerInfo.style.stroke_weight || layerInfo.style.weight || 2,
                    opacity: layerInfo.style.strokeOpacity || layerInfo.style.stroke_opacity || layerInfo.style.opacity || 1.0,
                    fillColor: color,
                    fillOpacity: layerInfo.style.fillOpacity || layerInfo.style.fill_opacity || 1.0
                };
            };
            layerInfo.originalStyleFunction = styleFunction;
            return styleFunction;
        }
    }
    
    // Return single symbol style object as fallback
    console.log('📝 Using single symbol style object as fallback');
    return {
        color: layerInfo.style?.strokeColor || layerInfo.style?.stroke_color || layerInfo.style?.color || '#ffffff',
        weight: layerInfo.style?.strokeWidth || layerInfo.style?.stroke_weight || layerInfo.style?.weight || 2,
        opacity: layerInfo.style?.strokeOpacity || layerInfo.style?.stroke_opacity || layerInfo.style?.opacity || 1.0,
        fillColor: layerInfo.style?.fillColor || layerInfo.style?.fill_color || '#14b8a6',
        fillOpacity: layerInfo.style?.fillOpacity || layerInfo.style?.fill_opacity || 1.0
    };
}

// Setup filter panel listeners
function setupNewFilterListeners() {
    console.log('Setting up filter listeners...');
    
    // Check if DOM elements exist
    const filterLayerSelect = document.getElementById('filterLayerSelect');
    const filterFieldSelect = document.getElementById('filterFieldSelect');
    
    if (!filterLayerSelect) {
        console.error('filterLayerSelect element not found!');
        return;
    }
    if (!filterFieldSelect) {
        console.error('filterFieldSelect element not found!');
        return;
    }
    
    console.log('Filter DOM elements found, adding listeners...');
    
    // Layer selection
    filterLayerSelect.addEventListener('change', handleFilterLayerChange);
    
    // Field selection
    filterFieldSelect.addEventListener('change', handleFilterFieldChange);
    
    // Operator selection
    document.getElementById('filterOperatorSelect').addEventListener('change', handleFilterOperatorChange);
    
    // Value controls
    document.getElementById('filterSingleValueSelect').addEventListener('change', handleFilterValueChange);
    document.getElementById('filterTextInput').addEventListener('input', handleFilterValueChange);
    
    // Action buttons
    document.getElementById('applyFilterBtn').addEventListener('click', applyNewFilter);
    document.getElementById('clearFilterBtn').addEventListener('click', clearNewFilter);
    
    // Filter Selected button
    document.getElementById('filterSelectedBtn').addEventListener('click', createLayerFromSelection);
    
    console.log('Filter listeners added successfully');
    
    // Initial population of filter layers (in case layers are already loaded)
    setTimeout(() => {
        console.log('Attempting initial population of filter layers...');
        populateFilterLayers();
        // Ensure Aera specifically gets added
        ensureAeraInFilterDropdown();
    }, 500);
}

// Enhanced function to ensure Aera layer appears in filter
function ensureAeraInFilterDropdown() {
    const layerSelect = document.getElementById('filterLayerSelect');
    if (!layerSelect) return;

    console.log('🎯 Ensuring Aera layer appears in filter dropdown...');
    
    // Check if Aera option already exists
    const existingAeraOption = Array.from(layerSelect.options).find(option => 
        option.textContent.toLowerCase().includes('aera') || option.value.includes('aera')
    );
    
    if (existingAeraOption) {
        console.log('✅ Aera layer already in dropdown');
        return;
    }

    // Look for Aera layer in layers Map
    let aeraLayerId = null;
    let aeraLayerInfo = null;
    
    layers.forEach((layerInfo, layerId) => {
        if (layerInfo.name && (layerInfo.name.toLowerCase().includes('aera') || layerInfo.name === 'Aera')) {
            aeraLayerId = layerId;
            aeraLayerInfo = layerInfo;
            console.log(`✅ Found Aera layer in layers map: ${layerId} - ${layerInfo.name}`);
        }
    });

    // If found, add it to the dropdown
    if (aeraLayerId && aeraLayerInfo) {
        // Check if it has data and features
        let hasValidData = false;
        if (aeraLayerInfo.data && aeraLayerInfo.data.features && aeraLayerInfo.data.features.length > 0) {
            const firstFeature = aeraLayerInfo.data.features[0];
            if (firstFeature.properties && Object.keys(firstFeature.properties).length > 0) {
                hasValidData = true;
            }
        }

        if (hasValidData) {
            const option = document.createElement('option');
            option.value = aeraLayerId;
            option.textContent = aeraLayerInfo.name;
            layerSelect.appendChild(option);
            console.log(`✅ Added Aera layer to filter dropdown: ${aeraLayerInfo.name}`);
        } else {
            console.log('⚠️ Aera layer found but has no valid feature data');
        }
    } else {
        console.log('⚠️ Aera layer not found in layers Map');
        // Try to load it directly from file as fallback
        tryLoadAeraDirectly();
    }
}

// Fallback function to load Aera data from Supabase Storage for filtering
async function tryLoadAeraDirectly() {
    console.log('🔄 Trying to load Aera layer from Supabase Storage for filter...');
    
    if (!supabase || !currentUser) {
        console.error('❌ Supabase or user not available for Aera layer loading');
        return;
    }
    
    try {
        // Try common Aera filenames in Supabase Storage
        const possibleFilenames = ['Aera.geojson', 'aera.geojson', 'AERA.geojson'];
        let data = null;
        
        for (const filename of possibleFilenames) {
            try {
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                    .from('aeralink')
                    .createSignedUrl(filename, 3600);

                if (signedUrlError) {
                    console.log(`⚠️ ${filename} not found in Supabase Storage`);
                    continue;
                }

                const response = await fetch(signedUrlData.signedUrl);
                if (response.ok) {
                    data = await response.json();
                    console.log(`✅ Loaded ${filename} from Supabase Storage for filtering`);
                    break;
                }
            } catch (error) {
                console.log(`⚠️ Failed to load ${filename}:`, error.message);
                continue;
            }
        }
        
        if (data && data.features && data.features.length > 0) {
            const layerSelect = document.getElementById('filterLayerSelect');
            if (layerSelect) {
                const option = document.createElement('option');
                option.value = 'aera-direct';
                option.textContent = 'Aera (Direct Load)';
                layerSelect.appendChild(option);
                
                // Store this data temporarily for filter use
                window.aeraDirectData = data;
                console.log('✅ Aera data stored for direct filter access');
            }
        } else {
            console.log('⚠️ No Aera layer found in Supabase Storage');
        }
    } catch (error) {
        console.error('❌ Failed to load Aera layer from Supabase Storage:', error);
    }
}

// Populate filter layer dropdown (Step 1) - Enhanced to include all layer types
function populateFilterLayers() {
    console.log('🔄 Populating filter layers (including all layer types)...');
    const layerSelect = document.getElementById('filterLayerSelect');
    
    if (!layerSelect) {
        console.error('Filter layer select element not found');
        return;
    }
    
    layerSelect.innerHTML = '<option value="">Choose a layer to filter</option>';

    let layerCount = 0;
    console.log(`Total layers available: ${layers.size}`);
    
    // Sort layers by type and name for better organization
    const layerArray = Array.from(layers.entries()).sort(([aId, aInfo], [bId, bInfo]) => {
        // First sort by type (permanent first, then user-generated, then filtered)
        const aType = aInfo.isPermanent ? 0 : (aInfo.isUserGenerated ? 1 : 2);
        const bType = bInfo.isPermanent ? 0 : (bInfo.isUserGenerated ? 1 : 2);
        
        if (aType !== bType) return aType - bType;
        
        // Then sort alphabetically by name
        return aInfo.name.localeCompare(bInfo.name);
    });
    
    layerArray.forEach(([layerId, layerInfo]) => {
        console.log(`Checking layer ${layerId} (${layerInfo.name}):`, {
            name: layerInfo.name,
            visible: layerInfo.visible,
            isPermanent: layerInfo.isPermanent,
            isUserGenerated: layerInfo.isUserGenerated,
            isFilteredSelection: layerInfo.isFilteredSelection,
            sourceType: layerInfo.sourceType,
            hasData: !!(layerInfo.data),
            hasOriginalData: !!(layerInfo.originalData),
            hasFeatures: !!(layerInfo.data && layerInfo.data.features && layerInfo.sourceType !== 'wms'),
            featureCount: (layerInfo.data && layerInfo.data.features && layerInfo.sourceType !== 'wms') ? layerInfo.data.features.length : 0
        });
        
        // Include all visible layers with valid feature data (exclude WMS and other tile-based layers)
        if (layerInfo.visible && layerInfo.data && layerInfo.sourceType !== 'wms') {
            // Enhanced feature detection for all layer types
            let features = [];
            
            if (layerInfo.data.type === 'FeatureCollection') {
                features = layerInfo.data.features || [];
            } else if (layerInfo.data.type === 'Feature') {
                features = [layerInfo.data];
            } else if (Array.isArray(layerInfo.data)) {
                features = layerInfo.data;
            }
            
            console.log(`Layer ${layerId} has ${features.length} features`);
            
            if (features.length > 0) {
                // Check if layer has attribute data
                const firstFeature = features[0];
                if (firstFeature && firstFeature.properties && Object.keys(firstFeature.properties).length > 0) {
                    const option = document.createElement('option');
                    option.value = layerId;
                    
                    // Add layer type indicator to name
                    let displayName = layerInfo.name;
    
                    
                    option.textContent = displayName;
                    option.dataset.layerType = layerInfo.isPermanent ? 'permanent' : 
                                               (layerInfo.isFilteredSelection ? 'filtered' : 'uploaded');
                    
                    layerSelect.appendChild(option);
                    layerCount++;
                    
                    console.log(`✅ Added ${layerInfo.isPermanent ? 'permanent' : 
                                            (layerInfo.isFilteredSelection ? 'filtered' : 'uploaded')} layer to filter dropdown: ${layerInfo.name} (${Object.keys(firstFeature.properties).length} fields)`);
                } else {
                    console.log(`⚠️ Layer ${layerId} has no properties, skipping`);
                }
            } else {
                console.log(`⚠️ Layer ${layerId} has no features, skipping`);
            }
        } else {
            console.log(`❌ Layer ${layerId} failed checks:`, {
                visible: layerInfo.visible,
                hasData: !!(layerInfo.data)
            });
        }
    });
    
    console.log(`✅ Populated ${layerCount} layers in filter dropdown (all types included)`);
    
    if (layerCount === 0) {
        const noLayersOption = document.createElement('option');
        noLayersOption.value = "";
        noLayersOption.textContent = "No filterable layers available";
        layerSelect.appendChild(noLayersOption);
    }
}

// Handle layer selection change (Step 1 → Step 2)
function handleFilterLayerChange() {
    const layerId = document.getElementById('filterLayerSelect').value;
    console.log(`Filter layer changed to: ${layerId}`);
    
    currentFilterState.selectedLayer = layerId;
    
    // Reset subsequent steps
    resetFilterSteps(['field', 'operator', 'value', 'actions']);
    
    if (layerId && layers.has(layerId)) {
        console.log(`✅ Layer ${layerId} exists in layers map, populating fields...`);
        const layerInfo = layers.get(layerId);
        console.log('📊 Layer info for field population:', {
            name: layerInfo.name,
            isPermanent: layerInfo.isPermanent,
            isUserGenerated: layerInfo.isUserGenerated,
            isFilteredSelection: layerInfo.isFilteredSelection,
            hasData: !!(layerInfo.data),
            hasOriginalData: !!(layerInfo.originalData),
            visible: layerInfo.visible
        });
        
        // Show field section first
        document.getElementById('filterFieldSection').style.display = 'block';
        
        // Use the enhanced dynamic field population for ALL layer types
        populateFilterFields(layerId);
        
    } else {
        console.log(`❌ Layer ${layerId} does not exist or is invalid`);
        console.log('Available layers:', Array.from(layers.keys()));
        document.getElementById('filterFieldSection').style.display = 'none';
    }
}


// Handle field selection change (Step 2 → Step 3)
function handleFilterFieldChange() {
    const fieldName = document.getElementById('filterFieldSelect').value;
    currentFilterState.selectedField = fieldName;
    
    // Reset subsequent steps
    resetFilterSteps(['operator', 'value', 'actions']);
    
    if (fieldName) {
        document.getElementById('filterOperatorSection').style.display = 'block';
    } else {
        document.getElementById('filterOperatorSection').style.display = 'none';
    }
}

// Handle operator selection change (Step 3 → Step 4)
function handleFilterOperatorChange() {
    const operator = document.getElementById('filterOperatorSelect').value;
    currentFilterState.selectedOperator = operator;
    
    // Reset value step
    resetFilterSteps(['value', 'actions']);
    
    if (operator) {
        setupFilterValueInput(operator);
        document.getElementById('filterActionsSection').style.display = 'block';
    } else {
        document.getElementById('filterValueSection').style.display = 'none';
        document.getElementById('filterActionsSection').style.display = 'none';
    }
}

// Setup appropriate input control based on operator (Step 4)
function setupFilterValueInput(operator) {
    const valueSection = document.getElementById('filterValueSection');
    const singleSelect = document.getElementById('filterSingleValueSelect');
    const multiContainer = document.getElementById('filterMultiValueContainer');
    const textInput = document.getElementById('filterTextInput');
    
    // Hide all inputs first
    singleSelect.style.display = 'none';
    multiContainer.style.display = 'none';
    textInput.style.display = 'none';
    
    // Logic-only operators don't need value input
    if (['is_empty', 'is_not_empty', 'is_null', 'is_not_null'].includes(operator)) {
        valueSection.style.display = 'none';
        return;
    }
    
    valueSection.style.display = 'block';
    
    // Determine input type based on operator
    if (['equal', 'not_equal'].includes(operator)) {
        // Single value dropdown
        singleSelect.style.display = 'block';
        populateFilterValues('single');
    } else if (['include', 'does_not_include'].includes(operator)) {
        // Multi-value checkboxes
        multiContainer.style.display = 'block';
        populateFilterValues('multi');
    } else {
        // Text input for contains, starts_with, etc.
        textInput.style.display = 'block';
        textInput.value = '';
    }
}

// Populate filter values from field data
function populateFilterValues(type) {
    const layerId = currentFilterState.selectedLayer;
    const fieldName = currentFilterState.selectedField;
    
    if (!layerId || !fieldName) return;
    
    let geoJsonData;
    
    // Handle direct Aera loading
    if (layerId === 'aera-direct' && window.aeraDirectData) {
        geoJsonData = window.aeraDirectData;
    } else {
        const layerInfo = layers.get(layerId);
        if (!layerInfo) return;
        geoJsonData = layerInfo.data;
    }
    
    if (!geoJsonData || !geoJsonData.features) return;
    
    // Get unique values from the field
    const uniqueValues = new Set();
    geoJsonData.features.forEach(feature => {
        const value = feature.properties[fieldName];
        if (value !== null && value !== undefined && value !== '') {
            uniqueValues.add(value.toString());
        }
    });
    
    const sortedValues = Array.from(uniqueValues).sort();
    
    if (type === 'single') {
        // Populate single select dropdown
        const singleSelect = document.getElementById('filterSingleValueSelect');
        singleSelect.innerHTML = '<option value="">Choose a value</option>';
        
        sortedValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            singleSelect.appendChild(option);
        });
    } else if (type === 'multi') {
        // Populate multi-select checkboxes
        const multiList = document.getElementById('filterMultiValueList');
        multiList.innerHTML = '';
        
        sortedValues.forEach(value => {
            const label = document.createElement('label');
            label.className = 'flex items-center space-x-2 text-sm text-gray-300 cursor-pointer mb-2';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = value;
            checkbox.className = 'rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500';
            checkbox.addEventListener('change', handleFilterValueChange);
            
            const span = document.createElement('span');
            span.textContent = value;
            
            label.appendChild(checkbox);
            label.appendChild(span);
            multiList.appendChild(label);
        });
    }
}

// Handle filter value change
function handleFilterValueChange() {
    const operator = currentFilterState.selectedOperator;
    let value = null;
    
    if (['equal', 'not_equal'].includes(operator)) {
        value = document.getElementById('filterSingleValueSelect').value;
    } else if (['include', 'does_not_include'].includes(operator)) {
        const checkboxes = document.querySelectorAll('#filterMultiValueList input[type="checkbox"]:checked');
        value = Array.from(checkboxes).map(cb => cb.value);
    } else if (['contains', 'does_not_contain', 'starts_with', 'does_not_start_with'].includes(operator)) {
        value = document.getElementById('filterTextInput').value.trim();
    }
    
    currentFilterState.filterValue = value;
}

// Apply the new filter
function applyNewFilter() {
    const { selectedLayer, selectedField, selectedOperator, filterValue } = currentFilterState;
    
    if (!selectedLayer || !selectedField || !selectedOperator) {
        showWarning('Please complete all filter steps before applying.', 'Filter Incomplete');
        return;
    }
    
    // Validate value for operators that require it
    const operatorsNeedingValue = ['equal', 'not_equal', 'include', 'does_not_include', 'contains', 'does_not_contain', 'starts_with', 'does_not_start_with'];
    if (operatorsNeedingValue.includes(selectedOperator)) {
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) {
            showWarning('Please select or enter a filter value.', 'Filter Value Required');
            return;
        }
    }

    let originalData;
    let layerInfo;
    let layerStyle = null;
    
    // Handle direct Aera loading
    if (selectedLayer === 'aera-direct' && window.aeraDirectData) {
        originalData = window.aeraDirectData;
        console.log('Using directly loaded Aera data for filtering');
        
        // Find the actual Aera layer in the layers map to get its style
        layers.forEach((info, layerId) => {
            if (info.name === 'Aera' || info.name === 'Aera.geojson') {
                layerInfo = info;  // Use this for layer updates
                layerStyle = info.style;  // Get the original Aera style
                console.log('Found Aera layer style:', layerStyle);
            }
        });
        
        if (!layerInfo) {
            showError('Original Aera layer not found. Cannot apply filter.', 'Filter Error');
            return;
        }
    } else {
        layerInfo = layers.get(selectedLayer);
        if (!layerInfo) {
            showError('Selected layer not found. Please refresh and try again.', 'Filter Error');
            return;
        }
        originalData = layerInfo.originalData || layerInfo.data;
        layerStyle = layerInfo.style;  // Use the layer's own style
    }
    
    if (!originalData || !originalData.features) {
        showError('Layer data not available for filtering.', 'Filter Error');
        return;
    }
    
    // Apply filter logic
    const filteredFeatures = originalData.features.filter(feature => {
        return evaluateFilterCondition(feature, selectedField, selectedOperator, filterValue);
    });
    
    console.log(`🔍 Filtered ${originalData.features.length} features down to ${filteredFeatures.length}`);
    
    if (filteredFeatures.length === 0) {
        showAlert('No features match the filter criteria.', 'Filter Results');
        return;
    }
    
    // Create filtered GeoJSON
    const filteredData = {
        type: 'FeatureCollection',
        features: filteredFeatures
    };
    
    // Remove existing layer and add filtered layer
    map.removeLayer(layerInfo.layer);
    
    // CRITICAL FIX: Use helper function to preserve styling
    const styleToUse = preserveLayerStyling(layerInfo);
    
    const filteredLayer = L.geoJSON(filteredData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: styleToUse, // Use the preserved original styling function or style object
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="modern-popup-container">';
                popupContent += '<div class="modern-popup-header"><i class="fas fa-info-circle mr-2"></i>Feature Properties</div>';
                popupContent += '<div class="modern-popup-body">';
                
                for (let key in feature.properties) {
                    const value = feature.properties[key] || 'N/A';
                    
                    // Check if the field name suggests a link or if the value looks like a URL
                    const isLinkField = key.toLowerCase().includes('link') || 
                                       key.toLowerCase().includes('url') || 
                                       key.toLowerCase().includes('document');
                    const isUrlValue = typeof value === 'string' && 
                                      (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.'));
                    
                    let displayValue = value;
                    if ((isLinkField || isUrlValue) && value !== 'N/A') {
                        // Make the value clickable
                        const href = value.startsWith('www.') ? `https://${value}` : value;
                        displayValue = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="popup-link">${value}</a>`;
                    }
                    
                    popupContent += `<div class="property-row">`;
                    popupContent += `<div class="property-key">${key}</div>`;
                    popupContent += `<div class="property-value">${displayValue}</div>`;
                    popupContent += `</div>`;
                }
                
                popupContent += '</div></div>';
                
                // Bind popup only on right-click (contextmenu)
                layer.on('contextmenu', function(e) {
                    // Popup logic now handled in interaction-handlers.js
                });
            }
        }
    }).addTo(map);
    
    // Styling function is already preserved by preserveLayerStyling helper
    
    layerInfo.layer = filteredLayer;
    layerInfo.data = filteredData;
    
    // Store active filter
    currentFilterState.activeFilter = {
        layerId: selectedLayer,
        layerName: layerInfo.name,
        field: selectedField,
        operator: selectedOperator,
        value: filterValue
    };
    
    // Show filter status
    showFilterStatus();
    
    // Zoom to filtered features
    if (filteredLayer.getBounds().isValid()) {
        map.fitBounds(filteredLayer.getBounds());
    }
    
    console.log(`Filter applied: ${filteredFeatures.length} features match criteria`);
}

// Evaluate filter condition for a feature
function evaluateFilterCondition(feature, field, operator, value) {
    const fieldValue = feature.properties[field];
    const fieldStr = fieldValue ? fieldValue.toString().toLowerCase() : '';
    
    switch (operator) {
        case 'equal':
            return fieldValue?.toString() === value;
        case 'not_equal':
            return fieldValue?.toString() !== value;
        case 'include':
            return Array.isArray(value) && value.some(v => fieldValue?.toString() === v);
        case 'does_not_include':
            return Array.isArray(value) && !value.some(v => fieldValue?.toString() === v);
        case 'contains':
            return fieldStr.includes(value.toLowerCase());
        case 'does_not_contain':
            return !fieldStr.includes(value.toLowerCase());
        case 'starts_with':
            return fieldStr.startsWith(value.toLowerCase());
        case 'does_not_start_with':
            return !fieldStr.startsWith(value.toLowerCase());
        case 'is_empty':
            return !fieldValue || fieldValue.toString().trim() === '';
        case 'is_not_empty':
            return fieldValue && fieldValue.toString().trim() !== '';
        case 'is_null':
            return fieldValue === null || fieldValue === undefined;
        case 'is_not_null':
            return fieldValue !== null && fieldValue !== undefined;
        default:
            return true;
    }
}

// Show filter status
function showFilterStatus() {
    const statusSection = document.getElementById('filterStatusSection');
    const statusText = document.getElementById('filterStatusText');
    
    if (currentFilterState.activeFilter) {
        const { layerName, field, operator, value } = currentFilterState.activeFilter;
        let description = `Layer: ${layerName} | Field: ${field} | ${getOperatorText(operator)}`;
        
        if (Array.isArray(value)) {
            description += ` | Values: ${value.join(', ')}`;
        } else if (value) {
            description += ` | Value: ${value}`;
        }
        
        statusText.textContent = description;
        statusSection.style.display = 'block';
    } else {
        statusSection.style.display = 'none';
    }
}

// Get human-readable operator text
function getOperatorText(operator) {
    const operatorMap = {
        'equal': 'Equal to',
        'not_equal': 'Not equal to',
        'include': 'Include any of',
        'does_not_include': 'Does not include any of',
        'contains': 'Contains',
        'does_not_contain': 'Does not contain',
        'starts_with': 'Starts with',
        'does_not_start_with': 'Does not start with',
        'is_empty': 'Is empty',
        'is_not_empty': 'Is not empty',
        'is_null': 'Is null',
        'is_not_null': 'Is not null'
    };
    return operatorMap[operator] || operator;
}

// Clear the current filter
function clearNewFilter() {
    if (!currentFilterState.activeFilter) {
        showAlert('No active filter to clear.', 'Filter Status');
        return;
    }
    
    const layerId = currentFilterState.activeFilter.layerId;
    let layerInfo;
    
    // Handle aera-direct case
    if (layerId === 'aera-direct') {
        // Find the actual Aera layer in the layers map
        layers.forEach((info, id) => {
            if (info.name === 'Aera' || info.name === 'Aera.geojson') {
                layerInfo = info;
            }
        });
    } else {
        layerInfo = layers.get(layerId);
    }
    
    if (!layerInfo) return;
    
    // Remove current layer
    map.removeLayer(layerInfo.layer);
    
    // Restore original data with preserved styling
    // CRITICAL FIX: Use helper function to restore styling
    const styleToUse = preserveLayerStyling(layerInfo);
    console.log('✅ Using preserved styling for filter restoration');
    
    const originalLayer = L.geoJSON(layerInfo.originalData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: styleToUse,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="modern-popup-container">';
                popupContent += '<div class="modern-popup-header"><i class="fas fa-info-circle mr-2"></i>Feature Properties</div>';
                popupContent += '<div class="modern-popup-body">';
                
                for (let key in feature.properties) {
                    const value = feature.properties[key] || 'N/A';
                    
                    // Check if the field name suggests a link or if the value looks like a URL
                    const isLinkField = key.toLowerCase().includes('link') || 
                                       key.toLowerCase().includes('url') || 
                                       key.toLowerCase().includes('document');
                    const isUrlValue = typeof value === 'string' && 
                                      (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.'));
                    
                    let displayValue = value;
                    if ((isLinkField || isUrlValue) && value !== 'N/A') {
                        // Make the value clickable
                        const href = value.startsWith('www.') ? `https://${value}` : value;
                        displayValue = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="popup-link">${value}</a>`;
                    }
                    
                    popupContent += `<div class="property-row">`;
                    popupContent += `<div class="property-key">${key}</div>`;
                    popupContent += `<div class="property-value">${displayValue}</div>`;
                    popupContent += `</div>`;
                }
                
                popupContent += '</div></div>';
                
                // Bind popup only on right-click (contextmenu)
                layer.on('contextmenu', function(e) {
                    // Popup logic now handled in interaction-handlers.js
                });
            }
        }
    }).addTo(map);
    
    // Update layer info
    layerInfo.layer = originalLayer;
    layerInfo.data = layerInfo.originalData;
    
    // Clear filter state
    currentFilterState.activeFilter = null;
    
    // Reset UI
    resetFilterSteps(['layer', 'field', 'operator', 'value', 'actions', 'status']);
    
    // Zoom to full layer
    if (originalLayer.getBounds().isValid()) {
        map.fitBounds(originalLayer.getBounds());
    }
    
    console.log('Filter cleared, original layer restored');
}

// Reset filter steps UI
function resetFilterSteps(steps) {
    if (steps.includes('layer')) {
        document.getElementById('filterLayerSelect').selectedIndex = 0;
        currentFilterState.selectedLayer = null;
    }
    if (steps.includes('field')) {
        document.getElementById('filterFieldSelect').innerHTML = '<option value="">Choose a field to filter by</option>';
        document.getElementById('filterFieldSection').style.display = 'none';
        currentFilterState.selectedField = null;
    }
    if (steps.includes('operator')) {
        document.getElementById('filterOperatorSelect').selectedIndex = 0;
        document.getElementById('filterOperatorSection').style.display = 'none';
        currentFilterState.selectedOperator = null;
    }
    if (steps.includes('value')) {
        document.getElementById('filterValueSection').style.display = 'none';
        document.getElementById('filterSingleValueSelect').innerHTML = '<option value="">Loading values...</option>';
        document.getElementById('filterMultiValueList').innerHTML = '';
        document.getElementById('filterTextInput').value = '';
        currentFilterState.filterValue = null;
    }
    if (steps.includes('actions')) {
        document.getElementById('filterActionsSection').style.display = 'none';
    }
    if (steps.includes('status')) {
        document.getElementById('filterStatusSection').style.display = 'none';
    }
}

// === FILTER SELECTED FEATURES FUNCTIONALITY ===

// Create a new persistent layer from selected features
async function createLayerFromSelection() {
    console.log('🎯 Creating layer from selected features...');
    
    // Use global memory structure
    if (!window.selectedFeaturesMemory || window.selectedFeaturesMemory.features.length === 0) {
        await showWarning('No features selected. Please use the Selection Tool to select features first.', 'Selection Required');
        return;
    }
    
    const selectedGeoJSON = window.selectedFeaturesMemory.getAsGeoJSON();
    console.log(`📊 Creating layer from ${selectedGeoJSON.features.length} selected features`);
    
    // Generate unique layer ID and name
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const layerId = `filtered-selection-${Date.now()}`;
    const layerName = `Filtered Selection ${timestamp}`;
    
    // Create default style for the new layer with a distinct visual appearance
    const defaultStyle = {
        fillColor: '#14b8a6', // Teal color
        weight: 2,
        opacity: 1,
        color: '#ffffff', // White outline
        fillOpacity: 1.0,
        dashArray: null // Solid line
    };
    
    try {
        // Create the layer on the map first
        const newLayer = L.geoJSON(selectedGeoJSON, {
            renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
            style: defaultStyle,
            onEachFeature: (feature, layer) => {
                // Add popup with feature properties
                if (feature.properties) {
                    let popupContent = '<div class="modern-popup-container">';
                    popupContent += '<div class="modern-popup-header">';
                    popupContent += `<i class="fas fa-filter mr-2"></i>${layerName}</div>`;
                    popupContent += '<div class="modern-popup-body">';
                    
                    for (let key in feature.properties) {
                        if (feature.properties.hasOwnProperty(key)) {
                            const value = feature.properties[key] || 'N/A';
                            
                            // Check if the field name suggests a link or if the value looks like a URL
                            const isLinkField = key.toLowerCase().includes('link') || 
                                               key.toLowerCase().includes('url') || 
                                               key.toLowerCase().includes('document');
                            const isUrlValue = typeof value === 'string' && 
                                              (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('www.'));
                            
                            let displayValue = value;
                            if ((isLinkField || isUrlValue) && value !== 'N/A') {
                                // Make the value clickable
                                const href = value.startsWith('www.') ? `https://${value}` : value;
                                displayValue = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="popup-link">${value}</a>`;
                            }
                            
                            popupContent += `<div class="property-row">`;
                            popupContent += `<div class="property-key">${key}</div>`;
                            popupContent += `<div class="property-value">${displayValue}</div>`;
                            popupContent += `</div>`;
                        }
                    }
                    
                    popupContent += '</div></div>';
                    
                    // Bind popup only on right-click (contextmenu)
                    layer.on('contextmenu', function(e) {
                        L.popup()
                            .setLatLng(e.latlng)
                            .setContent(popupContent)
                            .openOn(map);
                    });
                }
            }
        }).addTo(map);
        
        // Add to layers map
        layers.set(layerId, {
            layer: newLayer,
            name: layerName,
            visible: true,
            data: selectedGeoJSON,
            originalData: selectedGeoJSON, // Keep original data for filter resets
            style: defaultStyle,
            isPermanent: false,
            isUserGenerated: true,
            isFilteredSelection: true, // Mark as filtered selection layer
            sourceLayerId: window.selectedFeaturesMemory.metadata.sourceLayer,
            createdAt: new Date().toISOString()
        });
        
        // Add to layer order (at the top for visibility)
        layerOrder.unshift(layerId);
        
        // Update UI components
        updateLayersList();
        updateLegend();
        
        // Zoom to new layer
        if (newLayer.getBounds().isValid()) {
            map.fitBounds(newLayer.getBounds(), {
                padding: [50, 50] // Add padding for better visibility
            });
        }
        
        // Save to Supabase layers table
        try {
            if (window.supabase && window.currentUser) {
                console.log(`💾 Saving filtered layer "${layerName}" to Supabase layers table...`);
                const success = await saveDynamicLayerToDatabase(layerId, layerName, selectedGeoJSON);
                if (success) {
                    console.log(`✅ Filtered layer "${layerName}" saved to database successfully`);
                    // Update the layer info to reflect database status
                    const layerInfo = window.layers.get(layerId);
                    if (layerInfo) {
                        layerInfo.fromDatabase = true;
                    }
                    // Update UI to reflect database status
                    updateLayersList();
                } else {
                    console.warn(`⚠️ Failed to save filtered layer "${layerName}" to database`);
                    showNotification(`Filtered layer "${layerName}" created locally but could not be saved to database`, 'warning');
                }
            } else {
                console.warn('⚠️ Supabase or user not available - filtered layer not saved to database');
                showNotification(`Filtered layer "${layerName}" created locally only`, 'info');
            }
        } catch (error) {
            console.error('Error saving filtered layer to database:', error);
            showNotification(`Filtered layer "${layerName}" created but failed to save to database: ${error.message}`, 'warning');
        }
        
        // Show success message
        // Created new layer with filtered features
        
        // Clear the selection after successful layer creation
        if (typeof window.clearSelection === 'function') {
            window.clearSelection();
        } else {
            // Fallback clear if global function not available
            window.selectedFeaturesMemory.clear();
        }
        
        // Prompt for rename
        setTimeout(async () => {
            const shouldRename = await showConfirm('Would you like to rename this layer?', 'Rename Layer');
            if (shouldRename) {
                const newName = await showPrompt('Enter a new name for the layer:', layerName);
                if (newName && newName.trim() !== '') {
                    // Update layer name
                    const layerInfo = layers.get(layerId);
                    if (layerInfo) {
                        const oldName = layerInfo.name;
                        const trimmedName = newName.trim();
                        
                        // Update layer name in memory
                        layerInfo.name = trimmedName;
                        
                        // Update database if it's a dynamic layer that should be saved
                        const shouldUpdateDatabase = layerInfo.isUserGenerated || layerInfo.isFilteredSelection;
                        if (shouldUpdateDatabase && window.supabase && window.currentUser) {
                            (async () => {
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
                                        // If no database ID, try to find and update by old name
                                        const { error } = await supabase
                                            .from('layers')
                                            .update({ name: trimmedName })
                                            .eq('name', oldName)
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
                            })();
                        }
                        
                        // Update UI
                        updateLayersList();
                        updateLegend();
                    }
                }
            }
        }, 500);
        
    } catch (error) {
        console.error('❌ Failed to create filtered layer:', error);
        
        // Clean up if layer was partially created
        if (layers.has(layerId)) {
            const layerInfo = layers.get(layerId);
            if (layerInfo && layerInfo.layer) {
                map.removeLayer(layerInfo.layer);
            }
            layers.delete(layerId);
            
            // Remove from layer order
            const orderIndex = layerOrder.indexOf(layerId);
            if (orderIndex > -1) {
                layerOrder.splice(orderIndex, 1);
            }
            
            // Update UI
            updateLayersList();
            updateLegend();
        }
        
        // Show error to user
        await showError(`Failed to create filtered layer: ${error.message}`, 'Layer Creation Failed');
    }
}

// Update Filter Selected button state based on global memory
function updateFilterSelectedButton() {
    const button = document.getElementById('filterSelectedBtn');
    const countSpan = document.getElementById('selectedFeaturesCount');
    
    if (!button || !countSpan) {
        console.error("❌ Missing required elements for Filter Selected button");
        return;
    }
    
    const selectedCount = window.selectedFeaturesMemory ? window.selectedFeaturesMemory.features.length : 0;
    
    if (selectedCount > 0) {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        button.title = `Create layer from ${selectedCount} selected feature${selectedCount > 1 ? 's' : ''}`;
        countSpan.textContent = `${selectedCount} feature${selectedCount > 1 ? 's' : ''} selected`;
        countSpan.className = 'text-xs text-green-400 mt-1 text-center';
    } else {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
        button.title = 'No features selected. Use the Selection Tool first.';
        countSpan.textContent = 'No features selected';
        countSpan.className = 'text-xs text-gray-400 mt-1 text-center';
    }
}

// Get count of currently selected features from global memory
function getSelectedFeaturesCount() {
    return window.selectedFeaturesMemory ? window.selectedFeaturesMemory.features.length : 0;
}

// Get currently selected features as GeoJSON from global memory
function getSelectedFeaturesAsGeoJSON() {
    return window.selectedFeaturesMemory ? window.selectedFeaturesMemory.getAsGeoJSON() : null;
}

// Auto-update Filter Selected button when selection changes
// This should be called whenever selection state changes
function onSelectionChanged() {
    updateFilterSelectedButton();
}

// Initialize Filter Selected button state
function initializeFilterSelectedButton() {
    updateFilterSelectedButton();
    
    // Set up periodic check for selection changes (fallback)
    setInterval(updateFilterSelectedButton, 2000);
}

// Legacy filter functions (keeping for compatibility but they won't be used)
function setupFilterListeners() {
    document.getElementById('filterLayer').addEventListener('change', populateFilterFields);
    document.getElementById('applyFilter').addEventListener('click', applyFilter);
    document.getElementById('clearFilter').addEventListener('click', clearFilter);
}

// Populate filter modal
function populateFilterModal() {
    const layerSelect = document.getElementById('filterLayer');
    layerSelect.innerHTML = '<option value="">Select a layer</option>';

    layers.forEach((layerInfo, layerId) => {
        if (layerInfo.visible) {
            const option = document.createElement('option');
            option.value = layerId;
            option.textContent = layerInfo.name;
            layerSelect.appendChild(option);
        }
    });
}

// Apply filter (legacy)
function applyFilter() {
    const layerId = document.getElementById('filterLayer').value;
    const field = document.getElementById('filterField').value;
    const value = document.getElementById('filterValue').value.trim();

    if (!layerId || !field || !value) {
        showWarning('Please fill in all filter criteria.', 'Filter Incomplete');
        return;
    }

    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;

    // Filter features
    const filteredFeatures = layerInfo.originalData.features.filter(feature => {
        const propValue = feature.properties[field];
        return propValue && propValue.toString().toLowerCase().includes(value.toLowerCase());
    });

    if (filteredFeatures.length === 0) {
        showAlert('No features match the filter criteria.', 'Filter Results');
        return;
    }

    // Create filtered GeoJSON
    const filteredData = {
        type: 'FeatureCollection',
        features: filteredFeatures
    };

    // Remove existing layer and add filtered layer
    map.removeLayer(layerInfo.layer);
    
    // CRITICAL FIX: Use helper function to preserve styling (legacy)
    const styleToUse = preserveLayerStyling(layerInfo);
    
    const filteredLayer = L.geoJSON(filteredData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: styleToUse,
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

    // Styling function is already preserved by preserveLayerStyling helper (legacy)
    
    layerInfo.layer = filteredLayer;
    layerInfo.data = filteredData;

    // Store filter info
    activeFilters.set(layerId, { field, value });

    // Zoom to filtered features
    map.fitBounds(filteredLayer.getBounds());

    // Close modal
    document.getElementById('filterModal').classList.add('hidden');
}

// Clear filter (legacy)
function clearFilter() {
    const layerId = document.getElementById('filterLayer').value;
    
    if (!layerId || !layers.has(layerId)) return;

    const layerInfo = layers.get(layerId);
    
    // Remove current layer
    map.removeLayer(layerInfo.layer);
    
    // Restore original data with preserved styling (legacy)
    // CRITICAL FIX: Use helper function to restore styling
    const styleToUse = preserveLayerStyling(layerInfo);
    console.log('✅ Using preserved styling for filter restoration (legacy)');
    
    const originalLayer = L.geoJSON(layerInfo.originalData, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: styleToUse,
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                
                // Use right-click popup binding (respects selection mode)
                    // Bind popup only on right-click (contextmenu)
                    layer.on('contextmenu', function(e) {
                        // Popup logic now handled in interaction-handlers.js
                    });
            }
        }
    }).addTo(map);

    // Update layer info
    layerInfo.layer = originalLayer;
    layerInfo.data = layerInfo.originalData;

    // Remove filter info
    activeFilters.delete(layerId);

    // Zoom to full layer
    map.fitBounds(originalLayer.getBounds());

    // Close modal
    document.getElementById('filterModal').classList.add('hidden');
}

// Export the helper function for debugging and other modules
window.preserveLayerStyling = preserveLayerStyling;

// Export functions to global scope for compatibility
window.setupNewFilterListeners = setupNewFilterListeners;
window.ensureAeraInFilterDropdown = ensureAeraInFilterDropdown;
window.tryLoadAeraDirectly = tryLoadAeraDirectly;
window.populateFilterLayers = populateFilterLayers;
window.handleFilterLayerChange = handleFilterLayerChange;
window.populateFilterFields = populateFilterFields;
window.handleFilterFieldChange = handleFilterFieldChange;
window.handleFilterOperatorChange = handleFilterOperatorChange;
window.setupFilterValueInput = setupFilterValueInput;
window.populateFilterValues = populateFilterValues;
window.handleFilterValueChange = handleFilterValueChange;
window.applyNewFilter = applyNewFilter;
window.evaluateFilterCondition = evaluateFilterCondition;
window.showFilterStatus = showFilterStatus;
window.getOperatorText = getOperatorText;
window.clearNewFilter = clearNewFilter;
window.resetFilterSteps = resetFilterSteps;
window.updateFilterSelectedButton = updateFilterSelectedButton;
window.getSelectedFeaturesCount = getSelectedFeaturesCount;
window.getSelectedFeaturesAsGeoJSON = getSelectedFeaturesAsGeoJSON;
window.createLayerFromSelection = createLayerFromSelection;
window.onSelectionChanged = onSelectionChanged;
window.initializeFilterSelectedButton = initializeFilterSelectedButton;

// Legacy functions for compatibility
window.setupFilterListeners = setupFilterListeners;
window.populateFilterModal = populateFilterModal;
window.applyFilter = applyFilter;
window.clearFilter = clearFilter;

// Also export filter state for compatibility
window.currentFilterState = currentFilterState;

