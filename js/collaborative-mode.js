/**
 * Collaborative Mode Manager Module
 * Handles the toggle between personal and collaborative styling modes
 */

// Global collaborative mode state
window.collaborativeMode = false;

// Initialize collaborative mode functionality
function initializeCollaborativeMode() {
    const toggle = document.getElementById('collaborativeModeToggle');
    const personalLabel = document.getElementById('personalModeLabel');
    const collaborativeLabel = document.getElementById('collaborativeModeLabel');
    
    if (!toggle || !personalLabel || !collaborativeLabel) {
        console.error('Collaborative mode toggle elements not found');
        return;
    }
    
    // Load saved mode from localStorage
    const savedMode = localStorage.getItem('collaborativeMode');
    if (savedMode === 'true') {
        window.collaborativeMode = true;
        toggle.checked = true;
        updateModeLabels(true);
    } else {
        window.collaborativeMode = false;
        toggle.checked = false;
        updateModeLabels(false);
    }
    
    // Setup event listener for toggle
    toggle.addEventListener('change', function() {
        const isCollaborative = this.checked;
        toggleCollaborativeMode(isCollaborative);
    });
    
    console.log('✅ Collaborative mode initialized:', window.collaborativeMode ? 'Collaborative' : 'Personal');
}

// Toggle collaborative mode
function toggleCollaborativeMode(isCollaborative) {
    const previousMode = window.collaborativeMode;
    window.collaborativeMode = isCollaborative;
    
    // Save to localStorage
    localStorage.setItem('collaborativeMode', isCollaborative.toString());
    
    // Update UI labels
    updateModeLabels(isCollaborative);
    
    // If mode actually changed, reload symbology for all layers
    if (previousMode !== isCollaborative) {
        reloadAllLayerSymbology();
    }
    
    console.log(`🔄 Mode switched to: ${isCollaborative ? 'Collaborative' : 'Personal'} Mode`);
}

// Update mode labels styling
function updateModeLabels(isCollaborative) {
    const personalLabel = document.getElementById('personalModeLabel');
    const collaborativeLabel = document.getElementById('collaborativeModeLabel');
    
    if (isCollaborative) {
        personalLabel.classList.remove('text-green-400', 'font-semibold');
        personalLabel.classList.add('text-gray-400');
        collaborativeLabel.classList.remove('text-gray-400');
        collaborativeLabel.classList.add('text-green-400', 'font-semibold');
    } else {
        collaborativeLabel.classList.remove('text-green-400', 'font-semibold');
        collaborativeLabel.classList.add('text-gray-400');
        personalLabel.classList.remove('text-gray-400');
        personalLabel.classList.add('text-green-400', 'font-semibold');
    }
}

// Reload symbology for all layers when mode changes
async function reloadAllLayerSymbology() {
    if (!window.layers || window.layers.size === 0) {
        console.log('No layers to reload symbology for');
        return;
    }
    
    console.log('🔄 Reloading symbology for all layers due to mode change...');
    let reloadedCount = 0;
    
    for (const [layerId, layerInfo] of window.layers) {
        if (layerInfo.isPermanent) {
            try {
                // Only reload permanent layers as they have saved symbology
                const newStyle = await getUserStyleForLayer(layerInfo.name);
                
                if (newStyle) {
                    // Apply the new style
                    applyLoadedStyleToLayer(layerId, newStyle);
                    reloadedCount++;
                    console.log(`✅ Reloaded symbology for layer: ${layerInfo.name}`);
                }
            } catch (error) {
                console.error(`Failed to reload symbology for layer ${layerInfo.name}:`, error);
            }
        }
    }
    
    // Update UI
    if (typeof updateLegend === 'function') {
        updateLegend();
    }
    
    console.log(`✅ Symbology reload complete: ${reloadedCount} layers updated`);
}

// Apply loaded style to a layer
function applyLoadedStyleToLayer(layerId, styleData) {
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        console.error(`Layer ${layerId} not found or has no layer object`);
        return;
    }
    
    try {
        if (styleData.symbology_type === 'categorical' && styleData.colorMap) {
            // Apply categorical symbology
            const layerStyleFunction = function(feature) {
                const fieldValue = feature.properties[styleData.categoricalField];
                const color = styleData.colorMap[fieldValue] || '#14b8a6';
                return {
                    color: styleData.stroke_color || '#000000',
                    weight: styleData.stroke_weight || 0.5,
                    opacity: styleData.stroke_opacity || 1.0,
                    fillColor: color,
                    fillOpacity: styleData.fill_opacity || 1.0
                };
            };
            
            layerInfo.layer.setStyle(layerStyleFunction);
            
            // Update layer info with new classification
            layerInfo.classification = {
                field: styleData.categoricalField,
                colorMap: styleData.colorMap,
                strokeColor: styleData.stroke_color,
                strokeWidth: styleData.stroke_weight
            };
            
        } else {
            // Apply single symbol symbology
            const singleStyle = {
                color: styleData.stroke_color || styleData.color || '#000000',
                weight: styleData.stroke_weight || styleData.weight || 0.5,
                opacity: styleData.stroke_opacity || styleData.opacity || 1.0,
                fillColor: styleData.fill_color || styleData.fillColor || '#888888',
                fillOpacity: styleData.fill_opacity || styleData.fillOpacity || 1.0
            };
            
            layerInfo.layer.setStyle(singleStyle);
            
            // Clear any existing classification
            if (layerInfo.classification) {
                delete layerInfo.classification;
            }
        }
        
        // Update the layer's stored style
        layerInfo.style = styleData;
        
    } catch (error) {
        console.error(`Error applying style to layer ${layerId}:`, error);
    }
}

// Get current collaborative mode status
function isCollaborativeMode() {
    return window.collaborativeMode === true;
}

// Get mode description for UI
function getCurrentModeDescription() {
    return window.collaborativeMode 
        ? '🤝 Collaborative Mode - Styles shared with all users'
        : '👤 Personal Mode - Styles saved to your account';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other modules to load
    setTimeout(() => {
        initializeCollaborativeMode();
    }, 100);
});

// Export functions to global scope
window.initializeCollaborativeMode = initializeCollaborativeMode;
window.toggleCollaborativeMode = toggleCollaborativeMode;
window.updateModeLabels = updateModeLabels;
window.reloadAllLayerSymbology = reloadAllLayerSymbology;
window.applyLoadedStyleToLayer = applyLoadedStyleToLayer;
window.isCollaborativeMode = isCollaborativeMode;
window.getCurrentModeDescription = getCurrentModeDescription;

console.log('✅ Collaborative Mode Manager module loaded');