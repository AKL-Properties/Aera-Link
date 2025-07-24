/**
 * Symbology Editor Module for Aéra Link WebGIS
 * Handles all symbology and styling controls including single symbol, categorical styling, color management, and style persistence
 */

// === SYMBOLOGY EDITOR CORE FUNCTIONS ===

// Global symbology variable (if needed for compatibility)
let currentSymbologyLayer = null;

// Setup symbology listeners (kept for compatibility but not used)
function setupSymbologyListeners() {
    // Old modal listeners - kept for backward compatibility but not used
    // The new symbology editor handles its own listeners
    return;
}

// Open symbology editor panel
function openSymbologyEditor(layerId) {
    console.log('Opening symbology editor for layer:', layerId);
    const layerInfo = layers.get(layerId);
    if (!layerInfo) {
        console.error('Layer not found:', layerId);
        return;
    }

    console.log('Layer info:', layerInfo);

    // Create symbology editor panel
    const editorPanel = document.createElement('div');
    editorPanel.id = 'symbologyEditor';
    editorPanel.className = 'symbology-editor-draggable';
    editorPanel.style.top = '100px';
    editorPanel.style.right = '20px';
    
    // Get current layer opacity (stored as a value between 0 and 1)
    const currentOpacity = layerInfo.opacity || 1.0;
    const opacityPercent = Math.round(currentOpacity * 100);
    
    editorPanel.innerHTML = `
        <div class="symbology-editor-header" id="symbologyEditorHeader">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-white flex items-center">
                    <i class="fas fa-palette mr-2 text-teal-400"></i>
                    Symbology Editor
                </h3>
                <button id="closeSymbologyEditor" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times text-lg"></i>
                </button>
            </div>
            <div class="text-sm text-gray-300 mt-1">Layer: ${layerInfo.name}</div>
        </div>
        
        <div class="symbology-editor-content">
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-2">Symbology Type</label>
                <select id="symbologyType" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent">
                    <option value="single">Single Symbol</option>
                    <option value="categorical">Categorical</option>
                </select>
            </div>
            
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-2">Layer Opacity</label>
                <input type="range" id="opacitySlider" class="opacity-slider" 
                       min="0" max="100" value="${opacityPercent}" step="1">
                <div class="opacity-value" id="opacityValue">${opacityPercent}%</div>
            </div>
            
            <div id="singleSymbolOptions" class="border-t border-gray-600 pt-4 mb-4">
                <label class="block text-sm font-medium text-gray-300 mb-2">Fill Color</label>
                <div class="flex items-center space-x-3 mb-4">
                    <input type="color" id="singleFillColor" value="#888888" 
                           class="w-16 h-10 bg-transparent border border-gray-600 rounded cursor-pointer">
                    <span class="text-sm text-gray-400">Choose color for all features</span>
                </div>
                
                <label class="block text-sm font-medium text-gray-300 mb-2">Stroke Color</label>
                <div class="flex items-center space-x-3 mb-4">
                    <input type="color" id="singleStrokeColor" value="#ffffff" 
                           class="w-16 h-10 bg-transparent border border-gray-600 rounded cursor-pointer">
                    <span class="text-sm text-gray-400">Choose stroke color for all features</span>
                </div>
                
                <label class="block text-sm font-medium text-gray-300 mb-2">Stroke Width (px)</label>
                <div class="flex items-center space-x-3">
                    <input type="number" id="singleStrokeWidth" value="2" min="0" max="100" step="0.5" 
                           class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                    <span class="text-sm text-gray-400">Stroke width in pixels</span>
                </div>
            </div>
            
            <div id="categoricalOptions" class="border-t border-gray-600 pt-4 mb-4 hidden">
                <label class="block text-sm font-medium text-gray-300 mb-2">Classification Field</label>
                <select id="classificationField" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent mb-4">
                    <option value="">Select a field...</option>
                </select>
                
                <label class="block text-sm font-medium text-gray-300 mb-2">Stroke Color</label>
                <div class="flex items-center space-x-3 mb-4">
                    <input type="color" id="categoricalStrokeColor" value="#ffffff" 
                           class="w-16 h-10 bg-transparent border border-gray-600 rounded cursor-pointer">
                    <span class="text-sm text-gray-400">Stroke color for all categories</span>
                </div>
                
                <label class="block text-sm font-medium text-gray-300 mb-2">Stroke Width (px)</label>
                <div class="flex items-center space-x-3">
                    <input type="number" id="categoricalStrokeWidth" value="2" min="0" max="100" step="0.5" 
                           class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm">
                    <span class="text-sm text-gray-400">Stroke width in pixels</span>
                </div>
            </div>
            
            <div id="legendPreview" class="mb-4 hidden">
                <h4 class="text-sm font-medium text-gray-300 mb-2">Live Legend</h4>
                <div id="legendItems" class="space-y-2 max-h-48 overflow-y-auto"></div>
            </div>
            
            <div class="flex space-x-2 mt-4">
                <button id="applySymbology" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors">
                    Apply
                </button>
                <button id="resetSymbology" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                    Reset
                </button>
            </div>
        </div>
    `;

    // Remove any existing symbology editor
    const existingEditor = document.getElementById('symbologyEditor');
    if (existingEditor) {
        console.log('Removing existing editor');
        existingEditor.remove();
    }

    console.log('Appending new editor panel to body');
    document.body.appendChild(editorPanel);
    
    // Make the panel draggable
    makeDraggable(editorPanel);
    
    // Close panel when clicking outside
    setupOutsideClickClose(editorPanel);

    // Populate field dropdown
    const fieldSelect = editorPanel.querySelector('#classificationField');
    const features = layerInfo.data.features;
    if (features && features.length > 0) {
        const properties = features[0].properties || {};
        Object.keys(properties).forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            fieldSelect.appendChild(option);
        });
    }
    
    // Set initial single symbol color from current layer style
    const singleFillColorInput = editorPanel.querySelector('#singleFillColor');
    if (singleFillColorInput && layerInfo.style && layerInfo.style.fillColor) {
        singleFillColorInput.value = layerInfo.style.fillColor;
    }
    
    // Set initial stroke color from current layer style
    const singleStrokeColorInput = editorPanel.querySelector('#singleStrokeColor');
    if (singleStrokeColorInput && layerInfo.style && layerInfo.style.color) {
        singleStrokeColorInput.value = layerInfo.style.color;
    }
    
    // Set initial stroke width from current layer style
    const singleStrokeWidthInput = editorPanel.querySelector('#singleStrokeWidth');
    if (singleStrokeWidthInput && layerInfo.style && layerInfo.style.weight) {
        singleStrokeWidthInput.value = layerInfo.style.weight;
    }
    
    // Set initial categorical stroke values
    const categoricalStrokeColorInput = editorPanel.querySelector('#categoricalStrokeColor');
    if (categoricalStrokeColorInput && layerInfo.style && layerInfo.style.color) {
        categoricalStrokeColorInput.value = layerInfo.style.color;
    }
    
    const categoricalStrokeWidthInput = editorPanel.querySelector('#categoricalStrokeWidth');
    if (categoricalStrokeWidthInput && layerInfo.style && layerInfo.style.weight) {
        categoricalStrokeWidthInput.value = layerInfo.style.weight;
    }
    
    // Set initial categorical field selection if there's existing classification
    if (layerInfo.classification && layerInfo.classification.field) {
        const fieldSelect = editorPanel.querySelector('#classificationField');
        if (fieldSelect) {
            fieldSelect.value = layerInfo.classification.field;
            console.log('Restored categorical field selection:', layerInfo.classification.field);
        }
        
        // Set symbology type to categorical if we have classification
        const symbologyTypeSelect = editorPanel.querySelector('#symbologyType');
        if (symbologyTypeSelect) {
            symbologyTypeSelect.value = 'categorical';
            
            // Show categorical options and hide single symbol options
            const singleSymbolOptions = editorPanel.querySelector('#singleSymbolOptions');
            const categoricalOptions = editorPanel.querySelector('#categoricalOptions');
            if (singleSymbolOptions && categoricalOptions) {
                singleSymbolOptions.classList.add('hidden');
                categoricalOptions.classList.remove('hidden');
            }
        }
    }

    // Store current layer for the editor
    editorPanel.dataset.layerId = layerId;

    // Setup event listeners
    setupSymbologyEditorListeners(editorPanel);
}

// Setup symbology editor event listeners
function setupSymbologyEditorListeners(editorPanel) {
    const layerId = editorPanel.dataset.layerId;
    const layerInfo = layers.get(layerId);
    
    // Get UI elements
    const symbologyTypeSelect = editorPanel.querySelector('#symbologyType');
    const singleSymbolOptions = editorPanel.querySelector('#singleSymbolOptions');
    const categoricalOptions = editorPanel.querySelector('#categoricalOptions');
    const singleFillColor = editorPanel.querySelector('#singleFillColor');
    const classificationField = editorPanel.querySelector('#classificationField');
    const legendPreview = editorPanel.querySelector('#legendPreview');
    const applyBtn = editorPanel.querySelector('#applySymbology');
    
    // Opacity slider handling
    const opacitySlider = editorPanel.querySelector('#opacitySlider');
    const opacityValue = editorPanel.querySelector('#opacityValue');
    
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', function() {
            const opacityPercent = parseInt(this.value);
            const opacityDecimal = opacityPercent / 100;
            
            // Update display
            opacityValue.textContent = opacityPercent + '%';
            
            // Update layer opacity immediately
            updateLayerOpacity(layerId, opacityDecimal);
        });
    }
    
    // Symbology type change handler
    symbologyTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        
        if (selectedType === 'single') {
            // Show single symbol options, hide categorical options
            singleSymbolOptions.classList.remove('hidden');
            categoricalOptions.classList.add('hidden');
            legendPreview.classList.add('hidden');
        } else if (selectedType === 'categorical') {
            // Show categorical options, hide single symbol options
            singleSymbolOptions.classList.add('hidden');
            categoricalOptions.classList.remove('hidden');
            
            // Enable Apply button for categorical (field selection will handle further logic)
            applyBtn.disabled = false;
        }
    });
    
    // Single fill color change handler
    singleFillColor.addEventListener('input', function() {
        const selectedColor = this.value;
        console.log(`Single symbol color changed to: ${selectedColor}`);
        
        // Apply single symbol with current stroke settings
        const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
        const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
        applySingleSymbolWithStroke(layerId, selectedColor, strokeColor, strokeWidth);
    });
    
    // Single stroke color change handler
    const singleStrokeColor = editorPanel.querySelector('#singleStrokeColor');
    singleStrokeColor.addEventListener('input', function() {
        const strokeColor = this.value;
        console.log(`Single symbol stroke color changed to: ${strokeColor}`);
        
        // Apply single symbol with current fill and stroke settings
        const fillColor = singleFillColor.value;
        const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
        applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth);
    });
    
    // Single stroke width change handler
    const singleStrokeWidth = editorPanel.querySelector('#singleStrokeWidth');
    singleStrokeWidth.addEventListener('input', function() {
        const strokeWidth = this.value;
        console.log(`Single symbol stroke width changed to: ${strokeWidth}px`);
        
        // Apply single symbol with current fill and stroke settings
        const fillColor = singleFillColor.value;
        const strokeColor = singleStrokeColor.value;
        applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth);
    });
    
    // Categorical stroke color change handler
    const categoricalStrokeColor = editorPanel.querySelector('#categoricalStrokeColor');
    categoricalStrokeColor.addEventListener('input', function() {
        const field = classificationField.value;
        if (field) {
            console.log(`Categorical stroke color changed to: ${this.value}`);
            applyCategoricalSymbologyWithStroke(layerId, field);
        }
    });
    
    // Categorical stroke width change handler
    const categoricalStrokeWidth = editorPanel.querySelector('#categoricalStrokeWidth');
    categoricalStrokeWidth.addEventListener('input', function() {
        const field = classificationField.value;
        if (field) {
            console.log(`Categorical stroke width changed to: ${this.value}px`);
            applyCategoricalSymbologyWithStroke(layerId, field);
        }
    });
    
    // Close button
    editorPanel.querySelector('#closeSymbologyEditor').addEventListener('click', () => {
        editorPanel.remove();
    });

    // Field selection change for categorical symbology
    classificationField.addEventListener('change', function() {
        const field = this.value;
        
        if (field) {
            console.log(`Classification field selected: ${field}`);
            generateLegendPreview(layerId, field, editorPanel);
            legendPreview.classList.remove('hidden');
            
            // Apply categorical symbology - check if we have existing colors
            const layerInfo = layers.get(layerId);
            if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
                // Use existing custom colors
                console.log('Using existing custom colors for field:', field);
                applyCategoricalSymbologyWithCustomColors(layerId, field, layerInfo.classification.colorMap);
            } else {
                // Apply with auto-generated colors
                console.log('Applying with auto-generated colors for field:', field);
                applyCategoricalSymbologyWithStroke(layerId, field);
            }
        } else {
            legendPreview.classList.add('hidden');
        }
    });
    
    // Apply button
    applyBtn.addEventListener('click', function() {
        const symbologyType = symbologyTypeSelect.value;
        
        if (symbologyType === 'single') {
            const fillColor = singleFillColor.value;
            const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
            const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
            applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth);
        } else if (symbologyType === 'categorical') {
            const field = classificationField.value;
            if (field) {
                // Check if we have existing custom colors or need to collect from color pickers
                const layerInfo = layers.get(layerId);
                let customColorMap = null;
                
                // Try to get colors from the legend preview color pickers
                const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
                if (colorPickers.length > 0) {
                    customColorMap = {};
                    colorPickers.forEach(picker => {
                        const value = picker.dataset.value;
                        const color = picker.value;
                        customColorMap[value] = color;
                    });
                    console.log('Collected custom colors from color pickers:', customColorMap);
                    applyCategoricalSymbologyWithCustomColors(layerId, field, customColorMap);
                } else if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
                    // Use existing colors
                    console.log('Using existing custom colors from layer info');
                    applyCategoricalSymbologyWithCustomColors(layerId, field, layerInfo.classification.colorMap);
                } else {
                    // Fall back to auto-generated colors
                    console.log('Using auto-generated colors');
                    applyCategoricalSymbologyWithStroke(layerId, field);
                }
            }
        }
        
        // Close the editor after applying
        editorPanel.remove();
    });
    
    // Reset button
    editorPanel.querySelector('#resetSymbology').addEventListener('click', function() {
        resetLayerSymbology(layerId);
        editorPanel.remove();
    });
    
    // Initialize legend preview if there's existing categorical classification
    if (layerInfo.classification && layerInfo.classification.field) {
        const field = layerInfo.classification.field;
        console.log('Initializing legend preview for existing classification field:', field);
        const legendPreview = editorPanel.querySelector('#legendPreview');
        generateLegendPreview(layerId, field, editorPanel);
        legendPreview.classList.remove('hidden');
    }
}

// Apply single symbol styling with stroke controls
function applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth) {
    console.log(`Applying single symbol with fill ${fillColor}, stroke ${strokeColor}, width ${strokeWidth} to layer ${layerId}`);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    // Update the layer style with stroke controls
    const newStyle = {
        color: strokeColor,
        fillColor: fillColor,
        weight: parseFloat(strokeWidth),
        opacity: 1.0,
        fillOpacity: 0.7
    };
    
    // Apply style to the layer
    layerInfo.layer.setStyle(newStyle);
    layerInfo.style = newStyle;
    
    // Save symbology settings to Supabase
    const symbologyData = {
        symbology_type: 'single',
        fill_color: fillColor,
        stroke_color: strokeColor,
        stroke_weight: parseFloat(strokeWidth),
        fill_opacity: 0.7,
        stroke_opacity: 1.0
    };
    
    saveSymbologyToSupabase(layerId, symbologyData);
    
    // Update legend
    updateLegend();
    
    console.log(`Single symbol with stroke applied successfully`);
}

// Apply categorical symbology to layer
function applyCategoricalSymbology(layerId, field) {
    console.log(`Applying categorical symbology for field ${field} to layer ${layerId}`);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    const features = layerInfo.data.features;
    if (!features || features.length === 0) return;
    
    // Get unique values and generate colors
    const uniqueValues = [...new Set(features.map(f => f.properties[field]).filter(v => v !== null && v !== undefined))];
    const colorMap = generateColorMap(uniqueValues);
    
    // Apply the styling
    layerInfo.layer.setStyle(function(feature) {
        const value = feature.properties[field];
        const color = colorMap[value] || '#999999';
        return {
            color: color,
            fillColor: color,
            weight: 2,
            opacity: 1.0,
            fillOpacity: 0.7
        };
    });
    
    // Store the classification info
    layerInfo.classification = {
        field: field,
        colorMap: colorMap
    };
    
    // Update legend
    updateLegend();
    
    console.log(`Categorical symbology applied successfully`);
}

// Apply categorical symbology with stroke controls
function applyCategoricalSymbologyWithStroke(layerId, field) {
    console.log(`Applying categorical symbology with stroke controls for field ${field} to layer ${layerId}`);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    const features = layerInfo.data.features;
    if (!features || features.length === 0) return;
    
    // Get stroke settings from the editor panel
    const editorPanel = document.getElementById('symbologyEditor');
    const strokeColor = editorPanel ? editorPanel.querySelector('#categoricalStrokeColor').value : '#ffffff';
    const strokeWidth = editorPanel ? parseFloat(editorPanel.querySelector('#categoricalStrokeWidth').value) : 2;
    
    // Get unique values and generate colors
    const uniqueValues = [...new Set(features.map(f => f.properties[field]).filter(v => v !== null && v !== undefined))];
    const colorMap = generateColorMap(uniqueValues);
    
    // Apply the styling with stroke controls
    layerInfo.layer.setStyle(function(feature) {
        const value = feature.properties[field];
        const fillColor = colorMap[value] || '#999999';
        return {
            color: strokeColor,
            fillColor: fillColor,
            weight: strokeWidth,
            opacity: 1.0,
            fillOpacity: 0.7
        };
    });
    
    // Store the classification info with stroke settings
    layerInfo.classification = {
        field: field,
        colorMap: colorMap,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
    };
    
    // Save symbology settings to Supabase
    const categories = uniqueValues.map(value => ({
        value: value,
        color: colorMap[value]
    }));
    
    const symbologyData = {
        symbology_type: 'categorical',
        stroke_color: strokeColor,
        stroke_weight: strokeWidth,
        fill_opacity: 0.7,
        stroke_opacity: 1.0,
        classification_field: field,
        categories: categories
    };
    
    saveSymbologyToSupabase(layerId, symbologyData);
    
    // Update legend
    updateLegend();
    
    console.log(`Categorical symbology with stroke applied successfully`);
}

// Apply categorical symbology with custom user-selected colors
function applyCategoricalSymbologyWithCustomColors(layerId, field, customColorMap) {
    console.log(`Applying categorical symbology with custom colors for field ${field} to layer ${layerId}`, customColorMap);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    const features = layerInfo.data.features;
    if (!features || features.length === 0) return;
    
    // Get stroke settings from the editor panel
    const editorPanel = document.getElementById('symbologyEditor');
    const strokeColor = editorPanel ? editorPanel.querySelector('#categoricalStrokeColor').value : '#ffffff';
    const strokeWidth = editorPanel ? parseFloat(editorPanel.querySelector('#categoricalStrokeWidth').value) : 2;
    
    // Apply the styling with custom colors
    layerInfo.layer.setStyle(function(feature) {
        const value = feature.properties[field];
        const fillColor = customColorMap[value] || '#999999';
        return {
            color: strokeColor,
            fillColor: fillColor,
            weight: strokeWidth,
            opacity: 1.0,
            fillOpacity: 0.7
        };
    });
    
    // Store the classification info with custom colors
    layerInfo.classification = {
        field: field,
        colorMap: customColorMap,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
    };
    
    // Save symbology settings to Supabase with custom colors
    const categories = Object.keys(customColorMap).map(value => ({
        value: value,
        color: customColorMap[value]
    }));
    
    const symbologyData = {
        symbology_type: 'categorical',
        stroke_color: strokeColor,
        stroke_weight: strokeWidth,
        fill_opacity: 0.7,
        stroke_opacity: 1.0,
        classification_field: field,
        categories: categories
    };
    
    saveSymbologyToSupabase(layerId, symbologyData);
    
    // Update legend
    updateLegend();
    
    console.log(`Categorical symbology with custom colors applied and saved successfully`);
}

// Generate legend preview for categorical symbology
function generateLegendPreview(layerId, field, editorPanel) {
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    const features = layerInfo.data.features;
    if (!features || features.length === 0) return;
    
    // Get unique values
    const uniqueValues = [...new Set(features.map(f => f.properties[field]).filter(v => v !== null && v !== undefined))];
    
    if (uniqueValues.length === 0) return;
    
    // Check if we have existing colors from previous classification or use generated colors
    let colorMap;
    if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
        // Use existing color map if available
        colorMap = layerInfo.classification.colorMap;
    } else {
        // Generate new colors
        colorMap = generateColorMap(uniqueValues);
    }
    
    // Update legend preview
    const legendItems = editorPanel.querySelector('#legendItems');
    legendItems.innerHTML = '';
    
    uniqueValues.forEach(value => {
        const color = colorMap[value] || '#999999';
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center space-x-3 text-sm';
        legendItem.innerHTML = `
            <div class="w-4 h-4 rounded border border-gray-500" style="background-color: ${color}"></div>
            <span class="text-gray-300 flex-1">${value}</span>
            <input type="color" value="${color}" class="w-6 h-6 rounded border-0 cursor-pointer color-picker" data-value="${value}">
        `;
        legendItems.appendChild(legendItem);
    });
    
    // Add color picker listeners that update both map and save to database
    legendItems.querySelectorAll('.color-picker').forEach(picker => {
        picker.addEventListener('change', function() {
            const value = this.dataset.value;
            const newColor = this.value;
            
            console.log(`Manual color change for category "${value}": ${newColor}`);
            
            // Update the color map
            colorMap[value] = newColor;
            
            // Update the visual preview
            const colorDiv = this.parentElement.querySelector('div');
            colorDiv.style.backgroundColor = newColor;
            
            // Apply the updated categorical symbology to the map immediately
            applyCategoricalSymbologyWithCustomColors(layerId, field, colorMap);
        });
    });
}

// Generate color map for unique values
function generateColorMap(uniqueValues) {
    const colors = [
        '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795', 
        '#3182ce', '#553c9a', '#b83280', '#805ad5', '#ed8936'
    ];
    
    const colorMap = {};
    uniqueValues.forEach((value, index) => {
        colorMap[value] = colors[index % colors.length];
    });
    
    return colorMap;
}

// Reset layer symbology to default
function resetLayerSymbology(layerId) {
    console.log(`Resetting symbology for layer ${layerId}`);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    // Reset to default style
    let defaultStyle = {
        color: '#ffffff',
        weight: 2,
        opacity: 1.0,
        fillColor: '#888888',
        fillOpacity: 0.7
    };

    // No special defaults - use neutral styling for all layers
    
    layerInfo.layer.setStyle(defaultStyle);
    layerInfo.style = defaultStyle;
    
    // Clear classification info
    if (layerInfo.classification) {
        delete layerInfo.classification;
    }
    
    // Save default symbology to Supabase
    const symbologyData = {
        symbology_type: 'single',
        fill_color: defaultStyle.fillColor,
        stroke_color: defaultStyle.color,
        stroke_weight: defaultStyle.weight,
        fill_opacity: defaultStyle.fillOpacity,
        stroke_opacity: defaultStyle.opacity
    };
    
    saveSymbologyToSupabase(layerId, symbologyData);
    
    // Update legend
    updateLegend();
    
    console.log(`Layer symbology reset to default`);
}

// Update layer opacity
function updateLayerOpacity(layerId, opacityValue) {
    const layerInfo = layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) return;
    
    // Store opacity in layer info
    layerInfo.opacity = opacityValue;
    
    // Update layer style with new opacity
    layerInfo.layer.eachLayer(function(layer) {
        if (layer.setStyle) {
            const currentStyle = layer.options;
            
            // Store original style values if not already stored
            if (!layer._originalOpacity) {
                layer._originalOpacity = {
                    fillOpacity: currentStyle.fillOpacity || 1.0,
                    opacity: currentStyle.opacity || 1.0
                };
            }
            
            // Calculate new opacity values
            // At 100% (1.0), use full opacity values; at 0% (0.0), use 0 opacity
            const newFillOpacity = layer._originalOpacity.fillOpacity * opacityValue;
            const newStrokeOpacity = layer._originalOpacity.opacity * opacityValue;
            
            layer.setStyle({
                ...currentStyle,
                fillOpacity: newFillOpacity,
                opacity: newStrokeOpacity
            });
        }
    });
}

// Apply categorical symbology from editor
function applyCategoricalSymbologyFromEditor(layerId, field, colorMap) {
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;

    // Remove existing layer
    map.removeLayer(layerInfo.layer);

    // Create new styled layer
    const newLayer = L.geoJSON(layerInfo.data, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: (feature) => {
            const value = feature.properties[field];
            const color = colorMap[value] || '#14b8a6';
            return {
                color: '#ffffff',
                weight: 2,
                opacity: 1.0,
                fillColor: color,
                fillOpacity: 1.0
            };
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="text-sm">';
                for (let key in feature.properties) {
                    popupContent += `<strong>${key}:</strong> ${feature.properties[key]}<br>`;
                }
                popupContent += '</div>';
                
                safeBindPopup(layer, popupContent, {
                    maxWidth: 400,
                    maxHeight: 300,
                    autoPan: false,
                    closePopupOnClick: true,
                    autoClose: true,
                    className: 'custom-popup',
                    offset: [0, -10]
                });
            }
        }
    }).addTo(map);

    // Update layer info
    layerInfo.layer = newLayer;
    layerInfo.style = { categoricalField: field, colorMap: colorMap };

    // Reapply opacity if it's not default
    if (layerInfo.opacity !== undefined && layerInfo.opacity !== 1.0) {
        updateLayerOpacity(layerId, layerInfo.opacity);
    }

    updateLegend();
}

// Apply single symbol
function applySingleSymbol(layerId, color) {
    console.log(`Applying single symbol with color ${color} to layer ${layerId}`);
    
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;
    
    // Update the layer style
    const newStyle = {
        color: color,
        fillColor: color,
        weight: 2,
        opacity: 1.0,
        fillOpacity: 0.7
    };
    
    // Apply style to the layer
    layerInfo.layer.setStyle(newStyle);
    layerInfo.style = newStyle;
    
    // Update legend
    updateLegend();
    
    console.log(`Single symbol applied successfully`);
}

// Apply categorical symbol
function applyCategoricalSymbol(layerId, field) {
    const layerInfo = layers.get(layerId);
    if (!layerInfo) return;

    // Get unique values
    const features = layerInfo.data.features;
    const uniqueValues = [...new Set(features.map(f => f.properties[field]))];
    
    // Generate colors
    const colors = generateColors(uniqueValues.length);
    const colorMap = {};
    uniqueValues.forEach((value, index) => {
        colorMap[value] = colors[index];
    });

    // Remove existing layer
    map.removeLayer(layerInfo.layer);

    // Create new styled layer
    const newLayer = L.geoJSON(layerInfo.data, {
        renderer: L.canvas(), // Force canvas rendering for leaflet-image export compatibility
        style: (feature) => {
            const value = feature.properties[field];
            const color = colorMap[value] || '#14b8a6';
            return {
                color: '#ffffff',
                weight: 2,
                opacity: 1.0,
                fillColor: color,
                fillOpacity: 1.0
            };
        },
        onEachFeature: (feature, layer) => {
            // Popup logic now handled in interaction-handlers.js
        }
    }).addTo(map);

    // Update layer info
    layerInfo.layer = newLayer;
    layerInfo.style = { categoricalField: field, colorMap: colorMap };

    updateLegend();
}

// Generate distinct colors
function generateColors(count) {
    const colors = [
        '#14b8a6', '#06b6d4', '#8b5cf6', '#f59e0b',
        '#ef4444', '#10b981', '#3b82f6', '#f97316',
        '#ec4899', '#84cc16', '#6366f1', '#eab308'
    ];

    if (count <= colors.length) {
        return colors.slice(0, count);
    }

    // Generate additional colors if needed
    const additionalColors = [];
    for (let i = colors.length; i < count; i++) {
        const hue = (i * 137.508) % 360; // Golden angle approximation
        additionalColors.push(`hsl(${hue}, 70%, 50%)`);
    }

    return [...colors, ...additionalColors];
}

// Make panel draggable
function makeDraggable(element) {
    const header = element.querySelector('#symbologyEditorHeader');
    if (!header) return;
    
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', function(e) {
        // Don't drag if clicking on close button
        if (e.target.closest('#closeSymbologyEditor')) {
            return;
        }
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = element.offsetLeft;
        startTop = element.offsetTop;
        
        // Add dragging class for visual feedback
        header.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
        
        e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;
        
        // Keep panel within viewport bounds
        const rect = element.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width;
        const maxTop = window.innerHeight - rect.height;
        
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));
        
        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
        element.style.right = 'auto';
    });

    document.addEventListener('mouseup', function() {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'move';
            element.style.userSelect = '';
        }
    });
}

// Setup outside click to close panel
function setupOutsideClickClose(element) {
    // Add a small delay to prevent immediate closing
    setTimeout(() => {
        document.addEventListener('click', function closeOnOutsideClick(e) {
            if (!element.contains(e.target)) {
                element.remove();
                document.removeEventListener('click', closeOnOutsideClick);
            }
        });
    }, 100);
}

// Toggle symbology options (legacy - kept for compatibility)
function toggleSymbologyOptions() {
    // Legacy function - not used with new symbology editor
    return;
}

// Apply symbology (legacy - kept for compatibility)
function applySymbology() {
    // Legacy function - not used with new symbology editor
    return;
}

// === EXPORT MODULE FUNCTIONS ===

// Make functions globally available
window.setupSymbologyListeners = setupSymbologyListeners;
window.openSymbologyEditor = openSymbologyEditor;
window.setupSymbologyEditorListeners = setupSymbologyEditorListeners;
window.applySingleSymbolWithStroke = applySingleSymbolWithStroke;
window.applyCategoricalSymbology = applyCategoricalSymbology;
window.applyCategoricalSymbologyWithStroke = applyCategoricalSymbologyWithStroke;
window.applyCategoricalSymbologyWithCustomColors = applyCategoricalSymbologyWithCustomColors;
window.generateLegendPreview = generateLegendPreview;
window.generateColorMap = generateColorMap;
window.resetLayerSymbology = resetLayerSymbology;
window.updateLayerOpacity = updateLayerOpacity;
window.applyCategoricalSymbologyFromEditor = applyCategoricalSymbologyFromEditor;
window.applySingleSymbol = applySingleSymbol;
window.applyCategoricalSymbol = applyCategoricalSymbol;
window.generateColors = generateColors;
window.makeDraggable = makeDraggable;
window.setupOutsideClickClose = setupOutsideClickClose;
window.toggleSymbologyOptions = toggleSymbologyOptions;
window.applySymbology = applySymbology;

console.log('✅ Symbology Editor module loaded successfully');
