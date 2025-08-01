/**
 * Symbology Editor Module for Aéra Link WebGIS - Refactored for user_styles and shared_styles tables
 * Handles all symbology and styling controls with user-specific and collaborative styling support
 */

// === SYMBOLOGY EDITOR CORE FUNCTIONS ===

// Global symbology variable (if needed for compatibility)
let currentSymbologyLayer = null;

// Hex color validation function
function isValidHexColor(hex) {
    if (!hex) return false;
    // Must start with # for our purposes
    if (!hex.startsWith('#')) return false;
    // Remove leading # to check format
    const hexValue = hex.slice(1);
    // Check if it's a valid 3 or 6 character hex color
    const hexRegex = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(hexValue);
}

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

    // Check if this is a WMS layer or other layer type that doesn't support symbology editing
    if (layerInfo.sourceType === 'wms' || !layerInfo.data || !layerInfo.data.features) {
        showNotification(`Symbology editing is not available for ${layerInfo.sourceType === 'wms' ? 'WMS' : 'this'} layer type.`, 'info');
        return;
    }

    console.log('Layer info:', layerInfo);

    // Create symbology editor panel
    const editorPanel = document.createElement('div');
    editorPanel.id = 'symbologyEditor';
    editorPanel.className = 'symbology-editor-draggable';
    editorPanel.style.top = '100px';
    editorPanel.style.right = '20px';
    
    // Get collaborative mode status
    const collaborativeMode = window.collaborativeMode || false;
    const modeText = collaborativeMode ? '🤝 Collaborative Mode' : '👤 Personal Mode';
    
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
            <div class="text-xs text-amber-300 mt-1">${modeText}</div>
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
                    <input type="text" id="singleFillColorHex" value="#888888" 
                           class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono uppercase" 
                           placeholder="#888888" maxlength="7">
                    <span class="text-sm text-gray-400">Choose color for all features</span>
                </div>
                
                <label class="block text-sm font-medium text-gray-300 mb-2">Stroke Color</label>
                <div class="flex items-center space-x-3 mb-4">
                    <input type="color" id="singleStrokeColor" value="#ffffff" 
                           class="w-16 h-10 bg-transparent border border-gray-600 rounded cursor-pointer">
                    <input type="text" id="singleStrokeColorHex" value="#ffffff" 
                           class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono uppercase" 
                           placeholder="#ffffff" maxlength="7">
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
                    <input type="text" id="categoricalStrokeColorHex" value="#ffffff" 
                           class="w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono uppercase" 
                           placeholder="#ffffff" maxlength="7">
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
                    Apply & Save
                </button>
                <button id="resetSymbology" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                    Reset
                </button>
            </div>
            
            ${collaborativeMode ? `
            <div class="flex space-x-2 mt-4">
                <button id="saveStyleAsShared" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                    <i class="fas fa-save mr-2"></i>Save Style
                </button>
                <button id="loadSharedStyles" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                    <i class="fas fa-download mr-2"></i>Load Styles
                </button>
            </div>` : `
            <div class="flex space-x-2 mt-4">
                <button id="savePersonalStyle" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                    <i class="fas fa-save mr-2"></i>Save Style
                </button>
                <button id="loadPersonalStyles" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                    <i class="fas fa-download mr-2"></i>Load Styles
                </button>
            </div>`}
            
            <div class="text-xs text-gray-400 mt-2 text-center">
                Styles ${collaborativeMode ? 'shared with all users' : 'saved to your account'}
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
    
    // Check if this is a WMS layer or has no feature data
    if (!layerInfo.data || !layerInfo.data.features || layerInfo.sourceType === 'wms') {
        // Disable classification options for WMS layers or layers without feature data
        const classificationContainer = editorPanel.querySelector('.classification-container');
        if (classificationContainer) {
            classificationContainer.style.display = 'none';
        }
        const symbologyNote = document.createElement('div');
        symbologyNote.className = 'text-yellow-400 text-sm p-3 bg-yellow-400/10 border border-yellow-400/30 rounded mb-4';
        symbologyNote.innerHTML = '<i class="fas fa-info-circle mr-2"></i>This layer type does not support advanced symbology options.';
        editorPanel.querySelector('.space-y-6').prepend(symbologyNote);
    } else {
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
    }
    
    // Set initial single symbol color from current layer style
    const singleFillColorInput = editorPanel.querySelector('#singleFillColor');
    const singleFillColorHexInput = editorPanel.querySelector('#singleFillColorHex');
    if (singleFillColorInput && layerInfo.style && layerInfo.style.fillColor) {
        singleFillColorInput.value = layerInfo.style.fillColor;
        if (singleFillColorHexInput) {
            singleFillColorHexInput.value = layerInfo.style.fillColor.toUpperCase();
        }
    }
    
    // Set initial stroke color from current layer style
    const singleStrokeColorInput = editorPanel.querySelector('#singleStrokeColor');
    const singleStrokeColorHexInput = editorPanel.querySelector('#singleStrokeColorHex');
    if (singleStrokeColorInput && layerInfo.style && layerInfo.style.color) {
        singleStrokeColorInput.value = layerInfo.style.color;
        if (singleStrokeColorHexInput) {
            singleStrokeColorHexInput.value = layerInfo.style.color.toUpperCase();
        }
    }
    
    // Set initial stroke width from current layer style
    const singleStrokeWidthInput = editorPanel.querySelector('#singleStrokeWidth');
    if (singleStrokeWidthInput && layerInfo.style && layerInfo.style.weight) {
        singleStrokeWidthInput.value = layerInfo.style.weight;
    }
    
    // Set initial categorical stroke values
    const categoricalStrokeColorInput = editorPanel.querySelector('#categoricalStrokeColor');
    const categoricalStrokeColorHexInput = editorPanel.querySelector('#categoricalStrokeColorHex');
    if (categoricalStrokeColorInput && layerInfo.style && layerInfo.style.color) {
        categoricalStrokeColorInput.value = layerInfo.style.color;
        if (categoricalStrokeColorHexInput) {
            categoricalStrokeColorHexInput.value = layerInfo.style.color.toUpperCase();
        }
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
        
        // Update corresponding hex input
        const hexInput = editorPanel.querySelector('#singleFillColorHex');
        if (hexInput) {
            hexInput.value = selectedColor.toUpperCase();
        }
        
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
        
        // Update corresponding hex input
        const hexInput = editorPanel.querySelector('#singleStrokeColorHex');
        if (hexInput) {
            hexInput.value = strokeColor.toUpperCase();
        }
        
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
            
            // Update corresponding hex input
            const hexInput = editorPanel.querySelector('#categoricalStrokeColorHex');
            if (hexInput) {
                hexInput.value = this.value.toUpperCase();
            }
            
            // Preserve existing custom colors if available
            const layerInfo = layers.get(layerId);
            let customColorMap = null;
            
            // Try to get colors from the legend preview color pickers first
            const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
            if (colorPickers.length > 0) {
                customColorMap = {};
                colorPickers.forEach(picker => {
                    const value = picker.dataset.value;
                    const color = picker.value;
                    customColorMap[value] = color;
                });
                console.log('Using colors from legend preview color pickers:', customColorMap);
                applyCategoricalSymbologyWithCustomColors(layerId, field, customColorMap);
            } else if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
                // Use existing colors from layer info
                console.log('Using existing custom colors from layer classification');
                applyCategoricalSymbologyWithCustomColors(layerId, field, layerInfo.classification.colorMap);
            } else {
                // Fall back to auto-generated colors
                console.log('Using auto-generated colors for stroke change');
                applyCategoricalSymbologyWithStroke(layerId, field);
            }
        }
    });
    
    // Categorical stroke width change handler
    const categoricalStrokeWidth = editorPanel.querySelector('#categoricalStrokeWidth');
    categoricalStrokeWidth.addEventListener('input', function() {
        const field = classificationField.value;
        if (field) {
            console.log(`Categorical stroke width changed to: ${this.value}px`);
            
            // Preserve existing custom colors if available
            const layerInfo = layers.get(layerId);
            let customColorMap = null;
            
            // Try to get colors from the legend preview color pickers first
            const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
            if (colorPickers.length > 0) {
                customColorMap = {};
                colorPickers.forEach(picker => {
                    const value = picker.dataset.value;
                    const color = picker.value;
                    customColorMap[value] = color;
                });
                console.log('Using colors from legend preview color pickers for stroke width change:', customColorMap);
                applyCategoricalSymbologyWithCustomColors(layerId, field, customColorMap);
            } else if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
                // Use existing colors from layer info
                console.log('Using existing custom colors from layer classification for stroke width change');
                applyCategoricalSymbologyWithCustomColors(layerId, field, layerInfo.classification.colorMap);
            } else {
                // Fall back to auto-generated colors
                console.log('Using auto-generated colors for stroke width change');
                applyCategoricalSymbologyWithStroke(layerId, field);
            }
        }
    });
    
    // === HEX INPUT EVENT HANDLERS ===
    
    // Single fill color hex input handler
    const singleFillColorHex = editorPanel.querySelector('#singleFillColorHex');
    if (singleFillColorHex) {
        singleFillColorHex.addEventListener('input', function() {
            const hexValue = this.value.trim();
            if (isValidHexColor(hexValue)) {
                // Update color picker
                const colorPicker = editorPanel.querySelector('#singleFillColor');
                if (colorPicker) {
                    colorPicker.value = hexValue;
                }
                
                // Apply styling
                const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
                const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
                applySingleSymbolWithStroke(layerId, hexValue, strokeColor, strokeWidth);
            }
        });
        
        singleFillColorHex.addEventListener('blur', function() {
            const hexValue = this.value.trim();
            if (!isValidHexColor(hexValue)) {
                // Revert to color picker value if invalid
                const colorPicker = editorPanel.querySelector('#singleFillColor');
                if (colorPicker) {
                    this.value = colorPicker.value.toUpperCase();
                }
            } else {
                // Ensure proper formatting
                this.value = hexValue.toUpperCase();
            }
        });
    }
    
    // Single stroke color hex input handler
    const singleStrokeColorHex = editorPanel.querySelector('#singleStrokeColorHex');
    if (singleStrokeColorHex) {
        singleStrokeColorHex.addEventListener('input', function() {
            const hexValue = this.value.trim();
            if (isValidHexColor(hexValue)) {
                // Update color picker
                const colorPicker = editorPanel.querySelector('#singleStrokeColor');
                if (colorPicker) {
                    colorPicker.value = hexValue;
                }
                
                // Apply styling
                const fillColor = editorPanel.querySelector('#singleFillColor').value;
                const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
                applySingleSymbolWithStroke(layerId, fillColor, hexValue, strokeWidth);
            }
        });
        
        singleStrokeColorHex.addEventListener('blur', function() {
            const hexValue = this.value.trim();
            if (!isValidHexColor(hexValue)) {
                // Revert to color picker value if invalid
                const colorPicker = editorPanel.querySelector('#singleStrokeColor');
                if (colorPicker) {
                    this.value = colorPicker.value.toUpperCase();
                }
            } else {
                // Ensure proper formatting
                this.value = hexValue.toUpperCase();
            }
        });
    }
    
    // Categorical stroke color hex input handler
    const categoricalStrokeColorHex = editorPanel.querySelector('#categoricalStrokeColorHex');
    if (categoricalStrokeColorHex) {
        categoricalStrokeColorHex.addEventListener('input', function() {
            const hexValue = this.value.trim();
            if (isValidHexColor(hexValue)) {
                // Update color picker
                const colorPicker = editorPanel.querySelector('#categoricalStrokeColor');
                if (colorPicker) {
                    colorPicker.value = hexValue;
                }
                
                // Apply styling (same logic as categorical stroke color handler)
                const field = classificationField.value;
                if (field) {
                    const layerInfo = layers.get(layerId);
                    let customColorMap = null;
                    
                    // Try to get colors from the legend preview color pickers first
                    const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
                    if (colorPickers.length > 0) {
                        customColorMap = {};
                        colorPickers.forEach(picker => {
                            const value = picker.dataset.value;
                            const color = picker.value;
                            customColorMap[value] = color;
                        });
                        applyCategoricalSymbologyWithCustomColors(layerId, field, customColorMap);
                    } else if (layerInfo.classification && layerInfo.classification.field === field && layerInfo.classification.colorMap) {
                        applyCategoricalSymbologyWithCustomColors(layerId, field, layerInfo.classification.colorMap);
                    } else {
                        applyCategoricalSymbologyWithStroke(layerId, field);
                    }
                }
            }
        });
        
        categoricalStrokeColorHex.addEventListener('blur', function() {
            const hexValue = this.value.trim();
            if (!isValidHexColor(hexValue)) {
                // Revert to color picker value if invalid
                const colorPicker = editorPanel.querySelector('#categoricalStrokeColor');
                if (colorPicker) {
                    this.value = colorPicker.value.toUpperCase();
                }
            } else {
                // Ensure proper formatting
                this.value = hexValue.toUpperCase();
            }
        });
    }
    
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
    
    // Apply button - Now includes saving to database
    applyBtn.addEventListener('click', async function() {
        const symbologyType = symbologyTypeSelect.value;
        
        console.log(`💾 Applying and saving symbology for layer ${layerId}`);
        
        let symbologyData = null;
        
        if (symbologyType === 'single') {
            const fillColor = singleFillColor.value;
            const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
            const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
            
            // Apply the symbology to the map
            applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth);
            
            // Prepare data for database
            symbologyData = {
                symbology_type: 'single',
                fill_color: fillColor,
                stroke_color: strokeColor,
                stroke_weight: parseFloat(strokeWidth),
                fill_opacity: 1.0,
                stroke_opacity: 1.0
            };
            
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
                    customColorMap = layerInfo.classification.colorMap;
                } else {
                    // Fall back to auto-generated colors
                    console.log('Using auto-generated colors');
                    applyCategoricalSymbologyWithStroke(layerId, field);
                    // Get the generated color map from layer info
                    const updatedLayerInfo = layers.get(layerId);
                    customColorMap = updatedLayerInfo.classification?.colorMap;
                }
                
                // Get stroke settings
                const strokeColor = editorPanel.querySelector('#categoricalStrokeColor').value;
                const strokeWidth = editorPanel.querySelector('#categoricalStrokeWidth').value;
                
                // Prepare categorical data for database
                if (customColorMap) {
                    const categories = Object.keys(customColorMap).map(value => ({
                        value: value,
                        color: customColorMap[value]
                    }));
                    
                    symbologyData = {
                        symbology_type: 'categorical',
                        stroke_color: strokeColor,
                        stroke_weight: parseFloat(strokeWidth),
                        fill_opacity: 1.0,
                        stroke_opacity: 1.0,
                        classification_field: field,
                        categories: categories,
                        colorMap: customColorMap, // Include for local use
                        categoricalField: field    // Include for compatibility
                    };
                }
            }
        }
        
        // Save symbology to the appropriate table
        if (symbologyData) {
            const layerName = layerInfo.name;
            const success = await saveSymbologyToDatabase(layerName, symbologyData);
            
            if (success) {
                // Symbology saved
            } else {
                showNotification(`Symbology applied but failed to save to database`, 'warning');
            }
        }
        
        // Close the editor after applying
        editorPanel.remove();
    });
    
    // Reset button
    editorPanel.querySelector('#resetSymbology').addEventListener('click', async function() {
        const layerName = layerInfo.name;
        
        // Reset layer symbology to default
        resetLayerSymbology(layerId);
        
        // Delete saved symbology from database
        await deleteSymbologyFromDatabase(layerName);
        
        // Layer symbology reset
        
        editorPanel.remove();
    });
    
    // Save Style button (collaborative mode only)
    const saveStyleBtn = editorPanel.querySelector('#saveStyleAsShared');
    if (saveStyleBtn) {
        saveStyleBtn.addEventListener('click', async function() {
            // Prompt user for style name
            const styleName = await showPrompt('Save Style', 'Enter a name for this style:', layerInfo.name + '_style');
            
            if (styleName && styleName.trim()) {
                // Get current symbology data
                const symbologyType = symbologyTypeSelect.value;
                let symbologyData = null;
                
                if (symbologyType === 'single') {
                    const fillColor = singleFillColor.value;
                    const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
                    const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
                    
                    symbologyData = {
                        symbology_type: 'single',
                        fill_color: fillColor,
                        stroke_color: strokeColor,
                        stroke_weight: parseFloat(strokeWidth),
                        fill_opacity: 1.0,
                        stroke_opacity: 1.0
                    };
                    
                } else if (symbologyType === 'categorical') {
                    const field = classificationField.value;
                    if (field) {
                        // Get custom colors from color pickers or existing data
                        let customColorMap = null;
                        const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
                        if (colorPickers.length > 0) {
                            customColorMap = {};
                            colorPickers.forEach(picker => {
                                const value = picker.dataset.value;
                                const color = picker.value;
                                customColorMap[value] = color;
                            });
                        } else if (layerInfo.classification && layerInfo.classification.colorMap) {
                            customColorMap = layerInfo.classification.colorMap;
                        }
                        
                        if (customColorMap) {
                            const strokeColor = editorPanel.querySelector('#categoricalStrokeColor').value;
                            const strokeWidth = editorPanel.querySelector('#categoricalStrokeWidth').value;
                            
                            const categories = Object.keys(customColorMap).map(value => ({
                                value: value,
                                color: customColorMap[value]
                            }));
                            
                            symbologyData = {
                                symbology_type: 'categorical',
                                stroke_color: strokeColor,
                                stroke_weight: parseFloat(strokeWidth),
                                fill_opacity: 1.0,
                                stroke_opacity: 1.0,
                                classification_field: field,
                                categories: categories,
                                colorMap: customColorMap,
                                categoricalField: field
                            };
                        }
                    }
                }
                
                if (symbologyData) {
                    // Save to shared_styles table with style_name
                    const success = await saveNamedSharedStyle(styleName.trim(), symbologyData);
                    
                    if (success) {
                        // Style saved
                    } else {
                        showNotification(`Failed to save style "${styleName.trim()}"`, 'error');
                    }
                }
            }
        });
    }
    
    // Load Styles button (collaborative mode only)
    const loadStylesBtn = editorPanel.querySelector('#loadSharedStyles');
    if (loadStylesBtn) {
        loadStylesBtn.addEventListener('click', async function() {
            await showLoadStylesDropdown(layerId, editorPanel);
        });
    }
    
    // Save Personal Style button (personal mode only)
    const savePersonalStyleBtn = editorPanel.querySelector('#savePersonalStyle');
    if (savePersonalStyleBtn) {
        savePersonalStyleBtn.addEventListener('click', async function() {
            // Prompt user for style name
            const styleName = await showPrompt('Save Personal Style', 'Enter a name for this style:', layerInfo.name + '_style');
            
            if (styleName && styleName.trim()) {
                // Get current symbology data
                const symbologyType = symbologyTypeSelect.value;
                let symbologyData = null;
                
                if (symbologyType === 'single') {
                    const fillColor = singleFillColor.value;
                    const strokeColor = editorPanel.querySelector('#singleStrokeColor').value;
                    const strokeWidth = editorPanel.querySelector('#singleStrokeWidth').value;
                    
                    symbologyData = {
                        symbology_type: 'single',
                        fill_color: fillColor,
                        stroke_color: strokeColor,
                        stroke_weight: parseFloat(strokeWidth),
                        fill_opacity: 1.0,
                        stroke_opacity: 1.0
                    };
                    
                } else if (symbologyType === 'categorical') {
                    const field = classificationField.value;
                    if (field) {
                        // Get custom colors from color pickers or existing data
                        let customColorMap = null;
                        const colorPickers = editorPanel.querySelectorAll('#legendItems .color-picker');
                        if (colorPickers.length > 0) {
                            customColorMap = {};
                            colorPickers.forEach(picker => {
                                const value = picker.dataset.value;
                                const color = picker.value;
                                customColorMap[value] = color;
                            });
                        } else if (layerInfo.classification && layerInfo.classification.colorMap) {
                            customColorMap = layerInfo.classification.colorMap;
                        }
                        
                        if (customColorMap) {
                            const strokeColor = editorPanel.querySelector('#categoricalStrokeColor').value;
                            const strokeWidth = editorPanel.querySelector('#categoricalStrokeWidth').value;
                            
                            const categories = Object.keys(customColorMap).map(value => ({
                                value: value,
                                color: customColorMap[value]
                            }));
                            
                            symbologyData = {
                                symbology_type: 'categorical',
                                stroke_color: strokeColor,
                                stroke_weight: parseFloat(strokeWidth),
                                fill_opacity: 1.0,
                                stroke_opacity: 1.0,
                                classification_field: field,
                                categories: categories,
                                colorMap: customColorMap,
                                categoricalField: field
                            };
                        }
                    }
                }
                
                if (symbologyData) {
                    // Save to user_styles table with style_name
                    const success = await saveNamedPersonalStyle(styleName.trim(), symbologyData);
                    
                    if (success) {
                        // Personal style saved
                    } else {
                        showNotification(`Failed to save personal style "${styleName.trim()}"`, 'error');
                    }
                }
            }
        });
    }
    
    // Load Personal Styles button (personal mode only)
    const loadPersonalStylesBtn = editorPanel.querySelector('#loadPersonalStyles');
    if (loadPersonalStylesBtn) {
        loadPersonalStylesBtn.addEventListener('click', async function() {
            await showLoadPersonalStylesDropdown(layerId, editorPanel);
        });
    }
    
    // Initialize legend preview if there's existing categorical classification
    if (layerInfo.classification && layerInfo.classification.field) {
        const field = layerInfo.classification.field;
        console.log('Initializing legend preview for existing classification field:', field);
        const legendPreview = editorPanel.querySelector('#legendPreview');
        generateLegendPreview(layerId, field, editorPanel);
        legendPreview.classList.remove('hidden');
    }
}

// === DATABASE SYMBOLOGY FUNCTIONS ===

// Save symbology to database (user_styles or shared_styles based on collaborative mode)
async function saveSymbologyToDatabase(layerName, symbologyData) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping symbology save');
            return false;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        console.log(`💾 Saving symbology to database for layer: ${layerName}`, {
            collaborativeMode: collaborativeMode,
            symbologyData: symbologyData
        });
        
        if (collaborativeMode) {
            // Save to shared_styles table
            console.log(`🤝 Saving shared symbology for layer: ${layerName}`);
            
            const { data, error } = await supabase
                .from('shared_styles')
                .upsert({
                    layer_id: layerName,
                    style: symbologyData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'layer_id'
                });

            if (error) {
                console.error('Error saving shared symbology:', error);
                return false;
            }
            
            console.log('✅ Shared symbology saved successfully');
        } else {
            // Save to user_styles table
            console.log(`👤 Saving user-specific symbology for layer: ${layerName}`);
            
            const { data, error } = await supabase
                .from('user_styles')
                .upsert({
                    user_id: currentUser.id,
                    layer_id: layerName,
                    style: symbologyData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,layer_id'
                });

            if (error) {
                console.error('Error saving user symbology:', error);
                return false;
            }
            
            console.log('✅ User symbology saved successfully');
        }
        
        return true;
    } catch (error) {
        console.error('Network error saving symbology to database:', error);
        return false;
    }
}

// Load symbology from database (user_styles or shared_styles based on collaborative mode)
async function loadSymbologyFromDatabase(layerName) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping symbology load');
            return null;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        console.log(`🔍 Loading symbology from database for layer: ${layerName}`, {
            collaborativeMode: collaborativeMode
        });
        
        let styleData = null;
        
        if (collaborativeMode) {
            // Load from shared_styles table
            console.log(`🤝 Loading shared symbology for layer: ${layerName}`);
            const { data, error } = await supabase
                .from('shared_styles')
                .select('style')
                .eq('layer_id', layerName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading shared symbology:', error);
                return null;
            }
            styleData = data;
        } else {
            // Load from user_styles table
            console.log(`👤 Loading user-specific symbology for layer: ${layerName}`);
            const { data, error } = await supabase
                .from('user_styles')
                .select('style')
                .eq('user_id', currentUser.id)
                .eq('layer_id', layerName)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error loading user symbology:', error);
                return null;
            }
            styleData = data;
        }

        if (styleData && styleData.style) {
            console.log(`✅ Retrieved ${collaborativeMode ? 'shared' : 'user'} symbology for ${layerName}`);
            return styleData.style;
        }

        return null;
    } catch (error) {
        console.error('Network error loading symbology from database:', error);
        return null;
    }
}

// Show load styles dropdown
async function showLoadStylesDropdown(layerId, editorPanel) {
    try {
        if (!supabase || !currentUser) {
            showNotification('Supabase not available or user not logged in', 'error');
            return;
        }

        console.log('🔍 Loading shared styles from database...');
        
        // Fetch all named shared styles from shared_styles table
        let data, error;
        try {
            const result = await supabase
                .from('shared_styles')
                .select('*')
                .not('style_name', 'is', null)
                .order('style_name', { ascending: true });
            
            data = result.data;
            error = result.error;
        } catch (networkError) {
            console.error('Network error loading shared styles:', networkError);
            showNotification('Network error: Unable to connect to database', 'error');
            return;
        }

        if (error) {
            console.error('Error loading shared styles:', error);
            let errorMessage = 'Failed to load shared styles';
            
            // Provide more specific error messages
            if (error.code === 'PGRST301') {
                errorMessage = 'Database connection error. Please try again.';
            } else if (error.code === '42P01') {
                errorMessage = 'Shared styles table not found. Please contact administrator.';
            } else if (error.message) {
                errorMessage = `Database error: ${error.message}`;
            }
            
            showNotification(errorMessage, 'error');
            return;
        }

        if (!data || data.length === 0) {
            showNotification('No shared styles found', 'info');
            return;
        }

        console.log(`✅ Found ${data.length} shared styles`);

        // Create dropdown modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white">
                        <i class="fas fa-download mr-2 text-purple-400"></i>
                        Load Shared Style
                    </h3>
                    <button id="closeLoadStylesModal" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Available Styles</label>
                    <select id="sharedStyleSelect" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option value="">Select a style...</option>
                        ${data.map(style => {
                            try {
                                // Validate style data before adding to dropdown
                                if (!style.style || typeof style.style !== 'object') {
                                    console.warn(`Skipping style "${style.style_name}" - invalid style data`);
                                    return '';
                                }
                                
                                // Ensure JSON can be stringified and parsed
                                const styleJson = JSON.stringify(style.style);
                                JSON.parse(styleJson); // Test if it's valid JSON
                                
                                return `
                                    <option value="${style.id}" data-style='${styleJson}'>
                                        ${style.style_name || 'Unnamed Style'}
                                    </option>
                                `;
                            } catch (error) {
                                console.warn(`Skipping style "${style.style_name}" - JSON error:`, error);
                                return '';
                            }
                        }).join('')}
                    </select>
                </div>
                
                <div id="stylePreview" class="mb-4 p-3 bg-gray-700 rounded border border-gray-600 hidden">
                    <h4 class="text-sm font-medium text-gray-300 mb-2">Style Preview</h4>
                    <div id="stylePreviewContent" class="text-xs text-gray-400"></div>
                </div>
                
                <div class="flex space-x-3">
                    <button id="applySharedStyle" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Apply Style
                    </button>
                    <button id="cancelLoadStyles" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        const styleSelect = modal.querySelector('#sharedStyleSelect');
        const stylePreview = modal.querySelector('#stylePreview');
        const stylePreviewContent = modal.querySelector('#stylePreviewContent');
        const applyBtn = modal.querySelector('#applySharedStyle');
        
        // Style selection handler
        styleSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                try {
                    const styleData = JSON.parse(selectedOption.dataset.style);
                    
                    // Validate basic structure
                    if (!styleData || typeof styleData !== 'object') {
                        throw new Error('Invalid style data');
                    }
                    
                    // Show preview
                    let previewHTML = `<strong>Type:</strong> ${styleData.symbology_type || 'Unknown'}<br>`;
                    if (styleData.symbology_type === 'single') {
                        previewHTML += `<strong>Fill Color:</strong> <span style="color: ${styleData.fill_color || '#000000'}">${styleData.fill_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Color:</strong> <span style="color: ${styleData.stroke_color || '#000000'}">${styleData.stroke_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Width:</strong> ${styleData.stroke_weight !== undefined ? styleData.stroke_weight + 'px' : 'N/A'}`;
                    } else if (styleData.symbology_type === 'categorical') {
                        previewHTML += `<strong>Field:</strong> ${styleData.classification_field || 'N/A'}<br>`;
                        const categoryCount = styleData.categories ? styleData.categories.length : (styleData.colorMap ? Object.keys(styleData.colorMap).length : 0);
                        previewHTML += `<strong>Categories:</strong> ${categoryCount}<br>`;
                        previewHTML += `<strong>Stroke Color:</strong> <span style="color: ${styleData.stroke_color || '#000000'}">${styleData.stroke_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Width:</strong> ${styleData.stroke_weight !== undefined ? styleData.stroke_weight + 'px' : 'N/A'}`;
                    } else {
                        previewHTML += '<span class="text-yellow-400">Unsupported style type</span>';
                    }
                    
                    stylePreviewContent.innerHTML = previewHTML;
                    stylePreview.classList.remove('hidden');
                    applyBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error parsing style data:', error);
                    stylePreviewContent.innerHTML = '<span class="text-red-400">Error: Invalid style data</span>';
                    stylePreview.classList.remove('hidden');
                    applyBtn.disabled = true;
                }
            } else {
                stylePreview.classList.add('hidden');
                applyBtn.disabled = true;
            }
        });

        // Apply button handler
        applyBtn.addEventListener('click', function() {
            const selectedOption = styleSelect.options[styleSelect.selectedIndex];
            if (selectedOption.value) {
                try {
                    const styleData = JSON.parse(selectedOption.dataset.style);
                    const styleName = selectedOption.textContent.trim();
                    
                    // Validate style data structure
                    if (!styleData || typeof styleData !== 'object') {
                        throw new Error('Invalid style data format');
                    }
                    
                    if (!styleData.symbology_type) {
                        throw new Error('Missing symbology_type in style data');
                    }
                    
                    // Apply the selected style to the current symbology editor session
                    applySharedStyleToEditor(layerId, styleData, editorPanel);
                    
                    // Style applied
                    modal.remove();
                    
                } catch (error) {
                    console.error('Error applying style:', error);
                    showNotification(`Failed to apply style: ${error.message}`, 'error');
                }
            }
        });

        // Close button handler
        modal.querySelector('#closeLoadStylesModal').addEventListener('click', function() {
            modal.remove();
        });

        // Cancel button handler
        modal.querySelector('#cancelLoadStyles').addEventListener('click', function() {
            modal.remove();
        });

        // Close on outside click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error('Network error loading shared styles:', error);
        showNotification('Network error loading shared styles', 'error');
    }
}

// Show load personal styles dropdown
async function showLoadPersonalStylesDropdown(layerId, editorPanel) {
    try {
        if (!supabase || !currentUser) {
            showNotification('Supabase not available or user not logged in', 'error');
            return;
        }

        console.log('🔍 Loading personal styles from database...');
        
        // Fetch all named personal styles from user_styles table for the current user
        let data, error;
        try {
            const result = await supabase
                .from('user_styles')
                .select('*')
                .eq('user_id', currentUser.id)
                .not('style_name', 'is', null)
                .order('style_name', { ascending: true });
            
            data = result.data;
            error = result.error;
        } catch (networkError) {
            console.error('Network error loading personal styles:', networkError);
            showNotification('Network error: Unable to connect to database', 'error');
            return;
        }

        if (error) {
            console.error('Error loading personal styles:', error);
            let errorMessage = 'Failed to load personal styles';
            
            // Provide more specific error messages
            if (error.code === 'PGRST301') {
                errorMessage = 'Database connection error. Please try again.';
            } else if (error.code === '42P01') {
                errorMessage = 'User styles table not found. Please contact administrator.';
            } else if (error.message) {
                errorMessage = `Database error: ${error.message}`;
            }
            
            showNotification(errorMessage, 'error');
            return;
        }

        if (!data || data.length === 0) {
            showNotification('No saved personal styles found', 'info');
            return;
        }

        console.log(`✅ Found ${data.length} personal styles`);

        // Create dropdown modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-white">
                        <i class="fas fa-download mr-2 text-purple-400"></i>
                        Load Personal Style
                    </h3>
                    <button id="closeLoadPersonalStylesModal" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>
                
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Your Saved Styles</label>
                    <select id="personalStyleSelect" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                        <option value="">Select a style...</option>
                        ${data.map(style => {
                            try {
                                // Validate style data before adding to dropdown
                                if (!style.style || typeof style.style !== 'object') {
                                    console.warn(`Skipping style "${style.style_name}" - invalid style data`);
                                    return '';
                                }
                                
                                // Ensure JSON can be stringified and parsed
                                const styleJson = JSON.stringify(style.style);
                                JSON.parse(styleJson); // Test if it's valid JSON
                                
                                return `
                                    <option value="${style.id}" data-style='${styleJson}' data-style-name="${style.style_name || 'Unnamed Style'}">
                                        ${style.style_name || 'Unnamed Style'}
                                    </option>
                                `;
                            } catch (error) {
                                console.warn(`Skipping style "${style.style_name}" - JSON error:`, error);
                                return '';
                            }
                        }).join('')}
                    </select>
                </div>
                
                <div id="personalStylePreview" class="mb-4 p-3 bg-gray-700 rounded border border-gray-600 hidden">
                    <h4 class="text-sm font-medium text-gray-300 mb-2">Style Preview</h4>
                    <div id="personalStylePreviewContent" class="text-xs text-gray-400"></div>
                </div>
                
                <div id="styleNameEditSection" class="mb-4 hidden">
                    <label class="block text-sm font-medium text-gray-300 mb-2">Style Name</label>
                    <div class="flex space-x-2">
                        <input type="text" id="editStyleName" class="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent" placeholder="Enter style name">
                        <button id="saveStyleName" class="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg transition-colors">
                            <i class="fas fa-save"></i>
                        </button>
                    </div>
                </div>
                
                <div class="flex space-x-3">
                    <button id="applyPersonalStyle" class="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        Apply Style
                    </button>
                    <button id="editPersonalStyleName" class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                        <i class="fas fa-edit"></i>
                    </button>
                    <button id="cancelLoadPersonalStyles" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup event listeners
        const styleSelect = modal.querySelector('#personalStyleSelect');
        const stylePreview = modal.querySelector('#personalStylePreview');
        const stylePreviewContent = modal.querySelector('#personalStylePreviewContent');
        const applyBtn = modal.querySelector('#applyPersonalStyle');
        const editNameBtn = modal.querySelector('#editPersonalStyleName');
        const styleNameEditSection = modal.querySelector('#styleNameEditSection');
        const editStyleNameInput = modal.querySelector('#editStyleName');
        const saveStyleNameBtn = modal.querySelector('#saveStyleName');
        
        let selectedStyleId = null;
        let selectedStyleName = null;
        
        // Style selection handler
        styleSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                selectedStyleId = selectedOption.value;
                selectedStyleName = selectedOption.dataset.styleName;
                
                try {
                    const styleData = JSON.parse(selectedOption.dataset.style);
                    
                    // Validate basic structure
                    if (!styleData || typeof styleData !== 'object') {
                        throw new Error('Invalid style data');
                    }
                    
                    // Show preview
                    let previewHTML = `<strong>Type:</strong> ${styleData.symbology_type || 'Unknown'}<br>`;
                    if (styleData.symbology_type === 'single') {
                        previewHTML += `<strong>Fill Color:</strong> <span style="color: ${styleData.fill_color || '#000000'}">${styleData.fill_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Color:</strong> <span style="color: ${styleData.stroke_color || '#000000'}">${styleData.stroke_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Width:</strong> ${styleData.stroke_weight !== undefined ? styleData.stroke_weight + 'px' : 'N/A'}`;
                    } else if (styleData.symbology_type === 'categorical') {
                        previewHTML += `<strong>Field:</strong> ${styleData.classification_field || 'N/A'}<br>`;
                        const categoryCount = styleData.categories ? styleData.categories.length : (styleData.colorMap ? Object.keys(styleData.colorMap).length : 0);
                        previewHTML += `<strong>Categories:</strong> ${categoryCount}<br>`;
                        previewHTML += `<strong>Stroke Color:</strong> <span style="color: ${styleData.stroke_color || '#000000'}">${styleData.stroke_color || 'N/A'}</span><br>`;
                        previewHTML += `<strong>Stroke Width:</strong> ${styleData.stroke_weight !== undefined ? styleData.stroke_weight + 'px' : 'N/A'}`;
                    } else {
                        previewHTML += '<span class="text-yellow-400">Unsupported style type</span>';
                    }
                    
                    stylePreviewContent.innerHTML = previewHTML;
                    stylePreview.classList.remove('hidden');
                    applyBtn.disabled = false;
                    editNameBtn.disabled = false;
                    
                } catch (error) {
                    console.error('Error parsing style data:', error);
                    stylePreviewContent.innerHTML = '<span class="text-red-400">Error: Invalid style data</span>';
                    stylePreview.classList.remove('hidden');
                    applyBtn.disabled = true;
                    editNameBtn.disabled = true;
                }
            } else {
                stylePreview.classList.add('hidden');
                styleNameEditSection.classList.add('hidden');
                applyBtn.disabled = true;
                editNameBtn.disabled = true;
                selectedStyleId = null;
                selectedStyleName = null;
            }
        });

        // Apply button handler
        applyBtn.addEventListener('click', function() {
            const selectedOption = styleSelect.options[styleSelect.selectedIndex];
            if (selectedOption.value) {
                try {
                    const styleData = JSON.parse(selectedOption.dataset.style);
                    const styleName = selectedOption.textContent.trim();
                    
                    // Validate style data structure
                    if (!styleData || typeof styleData !== 'object') {
                        throw new Error('Invalid style data format');
                    }
                    
                    if (!styleData.symbology_type) {
                        throw new Error('Missing symbology_type in style data');
                    }
                    
                    // Apply the selected style to the current symbology editor session
                    applySharedStyleToEditor(layerId, styleData, editorPanel);
                    
                    // Personal style applied
                    modal.remove();
                    
                } catch (error) {
                    console.error('Error applying personal style:', error);
                    showNotification(`Failed to apply style: ${error.message}`, 'error');
                }
            }
        });

        // Edit name button handler
        editNameBtn.addEventListener('click', function() {
            if (selectedStyleName) {
                editStyleNameInput.value = selectedStyleName;
                styleNameEditSection.classList.remove('hidden');
                editStyleNameInput.focus();
            }
        });

        // Save style name button handler
        saveStyleNameBtn.addEventListener('click', async function() {
            const newStyleName = editStyleNameInput.value.trim();
            if (newStyleName && selectedStyleId) {
                try {
                    const { error } = await supabase
                        .from('user_styles')
                        .update({ 
                            style_name: newStyleName,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', selectedStyleId);

                    if (error) {
                        console.error('Error updating style name:', error);
                        showNotification('Failed to update style name', 'error');
                    } else {
                        // Update the dropdown option text
                        const selectedOption = styleSelect.options[styleSelect.selectedIndex];
                        selectedOption.textContent = newStyleName;
                        selectedOption.dataset.styleName = newStyleName;
                        selectedStyleName = newStyleName;
                        
                        styleNameEditSection.classList.add('hidden');
                        // Style renamed
                    }
                } catch (error) {
                    console.error('Network error updating style name:', error);
                    showNotification('Network error updating style name', 'error');
                }
            }
        });

        // Close button handler
        modal.querySelector('#closeLoadPersonalStylesModal').addEventListener('click', function() {
            modal.remove();
        });

        // Cancel button handler
        modal.querySelector('#cancelLoadPersonalStyles').addEventListener('click', function() {
            modal.remove();
        });

        // Close on outside click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error('Network error loading personal styles:', error);
        showNotification('Network error loading personal styles', 'error');
    }
}

// Save named shared style to shared_styles table with style_name
async function saveNamedSharedStyle(styleName, symbologyData) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping named style save');
            return false;
        }

        console.log(`💾 Saving named shared style: ${styleName}`, symbologyData);
        
        const { data, error } = await supabase
            .from('shared_styles')
            .insert({
                layer_id: `named_style_${Date.now()}`, // Unique ID for named styles
                style_name: styleName,
                style: symbologyData,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving named shared style:', error);
            return false;
        }
        
        console.log('✅ Named shared style saved successfully');
        return true;
    } catch (error) {
        console.error('Network error saving named shared style:', error);
        return false;
    }
}

// Save named personal style to user_styles table with style_name
async function saveNamedPersonalStyle(styleName, symbologyData) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping named personal style save');
            return false;
        }

        console.log(`💾 Saving named personal style: ${styleName}`, symbologyData);
        
        const { data, error } = await supabase
            .from('user_styles')
            .insert({
                user_id: currentUser.id,
                layer_id: `personal_style_${Date.now()}`, // Unique ID for named personal styles
                style_name: styleName,
                style: symbologyData,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving named personal style:', error);
            return false;
        }
        
        console.log('✅ Named personal style saved successfully');
        return true;
    } catch (error) {
        console.error('Network error saving named personal style:', error);
        return false;
    }
}

// Delete symbology from database
async function deleteSymbologyFromDatabase(layerName) {
    try {
        if (!supabase || !currentUser) {
            console.log('Supabase not available or user not logged in, skipping symbology delete');
            return false;
        }

        // Check collaborative mode flag
        const collaborativeMode = window.collaborativeMode || false;
        
        console.log(`🗑️ Deleting symbology from database for layer: ${layerName}`, {
            collaborativeMode: collaborativeMode
        });
        
        if (collaborativeMode) {
            // Delete from shared_styles table
            console.log(`🤝 Deleting shared symbology for layer: ${layerName}`);
            
            const { error } = await supabase
                .from('shared_styles')
                .delete()
                .eq('layer_id', layerName);

            if (error) {
                console.error('Error deleting shared symbology:', error);
                return false;
            }
            
            console.log('✅ Shared symbology deleted successfully');
        } else {
            // Delete from user_styles table
            console.log(`👤 Deleting user-specific symbology for layer: ${layerName}`);
            
            const { error } = await supabase
                .from('user_styles')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('layer_id', layerName);

            if (error) {
                console.error('Error deleting user symbology:', error);
                return false;
            }
            
            console.log('✅ User symbology deleted successfully');
        }
        
        return true;
    } catch (error) {
        console.error('Network error deleting symbology from database:', error);
        return false;
    }
}

// === SYMBOLOGY APPLICATION FUNCTIONS ===

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
        fillOpacity: 1.0
    };
    
    // Apply style to the layer
    layerInfo.layer.setStyle(newStyle);
    layerInfo.style = newStyle;
    
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
            fillOpacity: 1.0
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
            fillOpacity: 1.0
        };
    });
    
    // Store the classification info with stroke settings
    layerInfo.classification = {
        field: field,
        colorMap: colorMap,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
    };
    
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
            fillOpacity: 1.0
        };
    });
    
    // Store the classification info with custom colors
    layerInfo.classification = {
        field: field,
        colorMap: customColorMap,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth
    };
    
    // Update legend
    updateLegend();
    
    console.log(`Categorical symbology with custom colors applied successfully`);
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
        
        // Create elements to match main legend styling
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'w-5 h-5 rounded border-2';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.style.borderColor = '#ffffff';
        colorSwatch.style.borderWidth = '2px';
        
        const categoryLabel = document.createElement('span');
        categoryLabel.className = 'text-xs text-gray-300 flex-1';
        categoryLabel.textContent = value;
        
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = color;
        colorPicker.className = 'w-6 h-6 rounded border-0 cursor-pointer color-picker';
        colorPicker.setAttribute('data-value', value);
        
        const hexInput = document.createElement('input');
        hexInput.type = 'text';
        hexInput.value = color;
        hexInput.className = 'w-16 px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono uppercase color-hex-input';
        hexInput.setAttribute('data-value', value);
        hexInput.placeholder = color;
        hexInput.maxLength = 7;
        
        // Append elements in proper order
        legendItem.appendChild(colorSwatch);
        legendItem.appendChild(categoryLabel);
        legendItem.appendChild(colorPicker);
        legendItem.appendChild(hexInput);
        
        legendItems.appendChild(legendItem);
    });
    
    // Add color picker listeners that update both map and save to database
    legendItems.querySelectorAll('.color-picker').forEach(picker => {
        picker.addEventListener('change', function() {
            const value = this.dataset.value;
            const newColor = this.value;
            
            console.log(`Manual color change for category "${value}": ${newColor}`);
            
            // Update corresponding hex input
            const hexInput = this.parentElement.querySelector('.color-hex-input[data-value="' + value + '"]');
            if (hexInput) {
                hexInput.value = newColor.toUpperCase();
            }
            
            // Update the color map
            colorMap[value] = newColor;
            
            // Update the visual preview
            const colorDiv = this.parentElement.querySelector('div');
            colorDiv.style.backgroundColor = newColor;
            
            // Apply the updated categorical symbology to the map immediately
            applyCategoricalSymbologyWithCustomColors(layerId, field, colorMap);
        });
    });
    
    // Add hex input listeners for legend color inputs
    legendItems.querySelectorAll('.color-hex-input').forEach(hexInput => {
        hexInput.addEventListener('input', function() {
            const value = this.dataset.value;
            const hexValue = this.value.trim();
            
            if (isValidHexColor(hexValue)) {
                console.log(`Manual hex color change for category "${value}": ${hexValue}`);
                
                // Update corresponding color picker
                const colorPicker = this.parentElement.querySelector('.color-picker[data-value="' + value + '"]');
                if (colorPicker) {
                    colorPicker.value = hexValue;
                }
                
                // Update the color map
                colorMap[value] = hexValue;
                
                // Update the visual preview
                const colorDiv = this.parentElement.querySelector('div');
                colorDiv.style.backgroundColor = hexValue;
                
                // Apply the updated categorical symbology to the map immediately
                applyCategoricalSymbologyWithCustomColors(layerId, field, colorMap);
            }
        });
        
        hexInput.addEventListener('blur', function() {
            const value = this.dataset.value;
            const hexValue = this.value.trim();
            
            if (!isValidHexColor(hexValue)) {
                // Revert to color picker value if invalid
                const colorPicker = this.parentElement.querySelector('.color-picker[data-value="' + value + '"]');
                if (colorPicker) {
                    this.value = colorPicker.value.toUpperCase();
                }
            } else {
                // Ensure proper formatting
                this.value = hexValue.toUpperCase();
            }
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
        fillOpacity: 1.0
    };
    
    layerInfo.layer.setStyle(defaultStyle);
    layerInfo.style = defaultStyle;
    
    // Clear classification info
    if (layerInfo.classification) {
        delete layerInfo.classification;
    }
    
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

// Apply shared style to editor - populate fields and render preview
function applySharedStyleToEditor(layerId, styleData, editorPanel) {
    try {
        console.log('Applying shared style to editor:', styleData);
        
        if (!styleData || !editorPanel) {
            console.error('Missing style data or editor panel');
            return;
        }

        // Get UI elements
        const symbologyTypeSelect = editorPanel.querySelector('#symbologyType');
        const singleFillColor = editorPanel.querySelector('#singleFillColor');
        const singleStrokeColor = editorPanel.querySelector('#singleStrokeColor');
        const singleStrokeWidth = editorPanel.querySelector('#singleStrokeWidth');
        const categoricalStrokeColor = editorPanel.querySelector('#categoricalStrokeColor');
        const categoricalStrokeWidth = editorPanel.querySelector('#categoricalStrokeWidth');
        const classificationField = editorPanel.querySelector('#classificationField');
        const singleSymbolOptions = editorPanel.querySelector('#singleSymbolOptions');
        const categoricalOptions = editorPanel.querySelector('#categoricalOptions');
        const legendPreview = editorPanel.querySelector('#legendPreview');

        // Apply style based on type
        if (styleData.symbology_type === 'single') {
            console.log('Applying single symbol style');
            
            // Set symbology type dropdown
            if (symbologyTypeSelect) {
                symbologyTypeSelect.value = 'single';
            }
            
            // Show single symbol options, hide categorical
            if (singleSymbolOptions && categoricalOptions) {
                singleSymbolOptions.classList.remove('hidden');
                categoricalOptions.classList.add('hidden');
                legendPreview.classList.add('hidden');
            }
            
            // Populate single symbol fields
            if (singleFillColor && styleData.fill_color) {
                singleFillColor.value = styleData.fill_color;
            }
            if (singleStrokeColor && styleData.stroke_color) {
                singleStrokeColor.value = styleData.stroke_color;
            }
            if (singleStrokeWidth && styleData.stroke_weight !== undefined) {
                singleStrokeWidth.value = styleData.stroke_weight;
            }
            
            // Apply style to map immediately for live preview
            const fillColor = styleData.fill_color || '#888888';
            const strokeColor = styleData.stroke_color || '#ffffff';
            const strokeWidth = styleData.stroke_weight || 2;
            applySingleSymbolWithStroke(layerId, fillColor, strokeColor, strokeWidth);
            
        } else if (styleData.symbology_type === 'categorical') {
            console.log('Applying categorical style');
            
            // Set symbology type dropdown
            if (symbologyTypeSelect) {
                symbologyTypeSelect.value = 'categorical';
            }
            
            // Show categorical options, hide single symbol
            if (singleSymbolOptions && categoricalOptions) {
                singleSymbolOptions.classList.add('hidden');
                categoricalOptions.classList.remove('hidden');
            }
            
            // Populate categorical fields
            if (categoricalStrokeColor && styleData.stroke_color) {
                categoricalStrokeColor.value = styleData.stroke_color;
            }
            if (categoricalStrokeWidth && styleData.stroke_weight !== undefined) {
                categoricalStrokeWidth.value = styleData.stroke_weight;
            }
            
            // Set classification field if available
            const field = styleData.classification_field;
            if (field && classificationField) {
                // Check if this field exists in the dropdown
                const fieldOption = Array.from(classificationField.options).find(opt => opt.value === field);
                if (fieldOption) {
                    classificationField.value = field;
                    
                    // Build color map from categories or colorMap
                    let colorMap = {};
                    if (styleData.colorMap) {
                        colorMap = styleData.colorMap;
                    } else if (styleData.categories && Array.isArray(styleData.categories)) {
                        styleData.categories.forEach(cat => {
                            if (cat.value !== undefined && cat.color) {
                                colorMap[cat.value] = cat.color;
                            }
                        });
                    }
                    
                    if (Object.keys(colorMap).length > 0) {
                        // Apply categorical style with custom colors for live preview
                        applyCategoricalSymbologyWithCustomColors(layerId, field, colorMap);
                        
                        // Generate legend preview with the applied colors
                        generateLegendPreview(layerId, field, editorPanel);
                        if (legendPreview) {
                            legendPreview.classList.remove('hidden');
                        }
                        
                        console.log('Applied categorical style with color map:', colorMap);
                    } else {
                        console.warn('No color map found in categorical style data');
                        // Fallback to auto-generated colors
                        applyCategoricalSymbologyWithStroke(layerId, field);
                        generateLegendPreview(layerId, field, editorPanel);
                        if (legendPreview) {
                            legendPreview.classList.remove('hidden');
                        }
                    }
                } else {
                    console.warn(`Classification field "${field}" not found in layer properties`);
                    showNotification(`Field "${field}" not available in this layer`, 'warning');
                }
            }
        }
        
        console.log('✅ Shared style applied to editor successfully');
        
    } catch (error) {
        console.error('Error applying shared style to editor:', error);
        showNotification('Error applying selected style', 'error');
    }
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
                    
                    popupContent += `<strong>${key}:</strong> ${displayValue}<br>`;
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
        fillOpacity: 1.0
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

// === COLLABORATIVE MODE TOGGLE FUNCTION ===

// Toggle collaborative mode (add this to your global scripts or UI)
function toggleCollaborativeMode() {
    const currentMode = window.collaborativeMode || false;
    window.collaborativeMode = !currentMode;
    
    
    console.log(`Collaborative mode toggled: ${window.collaborativeMode}`);
}

// === EXPORT MODULE FUNCTIONS ===

// Make functions globally available
window.setupSymbologyListeners = setupSymbologyListeners;
window.openSymbologyEditor = openSymbologyEditor;
window.setupSymbologyEditorListeners = setupSymbologyEditorListeners;
window.saveSymbologyToDatabase = saveSymbologyToDatabase;
window.loadSymbologyFromDatabase = loadSymbologyFromDatabase;
window.deleteSymbologyFromDatabase = deleteSymbologyFromDatabase;
window.saveNamedSharedStyle = saveNamedSharedStyle;
window.saveNamedPersonalStyle = saveNamedPersonalStyle;
window.showLoadPersonalStylesDropdown = showLoadPersonalStylesDropdown;
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
window.toggleCollaborativeMode = toggleCollaborativeMode;
window.applySharedStyleToEditor = applySharedStyleToEditor;
window.isValidHexColor = isValidHexColor;

console.log('✅ Refactored Symbology Editor module loaded - now using user_styles and shared_styles tables');