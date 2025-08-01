/**
 * Labels.js - Advanced Label Management System for Aéra Link WebGIS
 * 
 * This module provides comprehensive labeling functionality for geospatial features
 * with support for dynamic styling, smart positioning, and geometry-aware rendering.
 * 
 * Key Features:
 * - Free (Angled) Placement Mode for polygons that mirrors QGIS behavior
 * - Automatic font sizing to prevent labels from overflowing polygon boundaries
 * - Polygon orientation detection using minimum bounding rectangle analysis
 * - Optimal interior point calculation using pole of inaccessibility algorithm
 * - Dynamic label updates on zoom and geometry changes
 * - Consistent dark-themed styling with subtle neon accent borders
 * 
 * Free Angled Placement:
 * - Labels are rotated to align with polygon's main orientation (±30° max for readability)
 * - Positioned at optimal interior point (furthest from polygon edges)
 * - Font size automatically scales down for small polygons (minimum 4px)
 * - Default font size is 8px, can be reduced but never increased for polygon overflow prevention
 * - Labels maintain horizontal legibility with subtle rotation angles
 */

// Global variables for label management
window.labelLayerGroups = new Map(); // Stores label layer groups by layer ID
window.activeLabels = new Map(); // Tracks active label configurations
window.labelStyles = {
    fontFamily: 'Inter',
    fontSize: 8, // Changed default to 8px as specified
    fontColor: '#ffffff',
    placement: 'straight'
};

/**
 * Initialize the label system
 */
function initializeLabelSystem() {
    console.log('Initializing Label System...');
    
    // Setup event listeners for label controls
    setupLabelControlListeners();
    
    // Initialize layer dropdown with current layers
    populateLayerDropdown();
    
    // Setup map event listeners for dynamic label updates
    setupMapEventListeners();
    
    console.log('Label System initialized successfully');
}

/**
 * Setup map event listeners for dynamic label updates
 */
function setupMapEventListeners() {
    if (!window.map) return;
    
    // Update labels on zoom change for responsive font sizing
    window.map.on('zoomend', function() {
        if (window.activeLabels.size > 0) {
            updateActiveLabelsOnZoom();
        }
    });
    
    // Update labels when map view changes significantly
    window.map.on('moveend', function() {
        // Only update if we have free-angled labels that might need repositioning
        if (hasFreePlacementLabels()) {
            updateActiveLabels();
        }
    });
    
    console.log('Map event listeners setup for dynamic label updates');
}

/**
 * Check if any active labels use free placement mode
 */
function hasFreePlacementLabels() {
    for (const [layerId, config] of window.activeLabels) {
        if (config.styles.placement === 'free') {
            return true;
        }
    }
    return false;
}

/**
 * Update active labels specifically for zoom changes
 */
function updateActiveLabelsOnZoom() {
    window.activeLabels.forEach((config, layerId) => {
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.layer) {
            // Only update if the zoom change significantly affects label sizing
            const currentZoom = window.map.getZoom();
            const lastZoom = config.lastZoom || currentZoom;
            
            if (Math.abs(currentZoom - lastZoom) >= 1) {
                clearLayerLabels(layerId);
                
                const labelGroup = createLabelsForLayer(layerInfo.layer, config.fieldName, layerId);
                if (labelGroup) {
                    window.map.addLayer(labelGroup);
                    window.labelLayerGroups.set(layerId, labelGroup);
                }
                
                // Update last zoom level
                config.lastZoom = currentZoom;
            }
        }
    });
}

/**
 * Setup event listeners for label control panel
 */
function setupLabelControlListeners() {
    // Layer selection dropdown
    const layerSelect = document.getElementById('labelLayerSelect');
    if (layerSelect) {
        layerSelect.addEventListener('change', handleLayerSelection);
    }
    
    // Field selection dropdown
    const fieldSelect = document.getElementById('labelFieldSelect');
    if (fieldSelect) {
        fieldSelect.addEventListener('change', handleFieldSelection);
    }
    
    // Font styling controls
    const fontFamily = document.getElementById('labelFontFamily');
    if (fontFamily) {
        fontFamily.addEventListener('change', handleFontFamilyChange);
    }
    
    const fontSize = document.getElementById('labelFontSize');
    if (fontSize) {
        fontSize.addEventListener('input', handleFontSizeChange);
    }
    
    const fontColor = document.getElementById('labelFontColor');
    const fontColorText = document.getElementById('labelFontColorText');
    if (fontColor && fontColorText) {
        fontColor.addEventListener('change', handleFontColorChange);
        fontColorText.addEventListener('change', handleFontColorTextChange);
    }
    
    // Placement controls
    const placementRadios = document.querySelectorAll('input[name="labelPlacement"]');
    placementRadios.forEach(radio => {
        radio.addEventListener('change', handlePlacementChange);
    });
    
    // Action buttons
    const applyBtn = document.getElementById('applyLabelsBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applyLabels);
    }
    
    const clearBtn = document.getElementById('clearLabelsBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearLabels);
    }
    
    console.log('Label control listeners setup complete');
}

/**
 * Populate the layer dropdown with available layers
 */
function populateLayerDropdown() {
    const layerSelect = document.getElementById('labelLayerSelect');
    if (!layerSelect || !window.layers) return;
    
    // Clear existing options except the first one
    while (layerSelect.children.length > 1) {
        layerSelect.removeChild(layerSelect.lastChild);
    }
    
    // Add layers to dropdown
    window.layers.forEach((layer, layerId) => {
        if (layer && layer.layer && layer.layer._layers) {
            const option = document.createElement('option');
            option.value = layerId;
            option.textContent = layer.name || `Layer ${layerId}`;
            layerSelect.appendChild(option);
        }
    });
    
    console.log(`Populated layer dropdown with ${layerSelect.children.length - 1} layers`);
}

/**
 * Handle layer selection change
 */
function handleLayerSelection(event) {
    const layerId = event.target.value;
    const fieldSection = document.getElementById('labelFieldSection');
    const fieldSelect = document.getElementById('labelFieldSelect');
    
    if (!layerId) {
        fieldSection.style.display = 'none';
        hideAdvancedSections();
        return;
    }
    
    // Get the selected layer
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        console.error('Selected layer not found:', layerId);
        return;
    }
    
    // Extract field names from layer features
    const fields = extractFieldNames(layerInfo.layer);
    
    // Populate field dropdown
    populateFieldDropdown(fieldSelect, fields);
    
    // Show field selection section
    fieldSection.style.display = 'block';
    
    console.log(`Layer selected: ${layerId}, found ${fields.length} fields`);
}

/**
 * Extract field names from a layer's features
 */
function extractFieldNames(layer) {
    const fields = new Set();
    
    if (layer._layers) {
        // GeoJSON layer
        Object.values(layer._layers).forEach(feature => {
            if (feature.feature && feature.feature.properties) {
                Object.keys(feature.feature.properties).forEach(key => {
                    if (key && typeof key === 'string') {
                        fields.add(key);
                    }
                });
            }
        });
    } else if (layer.feature && layer.feature.properties) {
        // Single feature
        Object.keys(layer.feature.properties).forEach(key => {
            if (key && typeof key === 'string') {
                fields.add(key);
            }
        });
    }
    
    return Array.from(fields).sort();
}

/**
 * Populate field dropdown with available fields
 */
function populateFieldDropdown(select, fields) {
    if (!select) return;
    
    // Clear existing options except the first one
    while (select.children.length > 1) {
        select.removeChild(select.lastChild);
    }
    
    // Add fields to dropdown
    fields.forEach(field => {
        const option = document.createElement('option');
        option.value = field;
        option.textContent = field;
        select.appendChild(option);
    });
}

/**
 * Handle field selection change
 */
function handleFieldSelection(event) {
    const fieldName = event.target.value;
    
    if (fieldName) {
        showAdvancedSections();
        
        // Check geometry type to show appropriate placement options
        const layerId = document.getElementById('labelLayerSelect').value;
        const layerInfo = window.layers.get(layerId);
        
        if (layerInfo && layerInfo.layer) {
            const geometryType = detectGeometryType(layerInfo.layer);
            configurePlacementOptions(geometryType);
        }
    } else {
        hideAdvancedSections();
    }
}

/**
 * Detect the primary geometry type of a layer
 */
function detectGeometryType(layer) {
    let pointCount = 0;
    let lineCount = 0;
    let polygonCount = 0;
    
    if (layer._layers) {
        Object.values(layer._layers).forEach(feature => {
            if (feature.feature && feature.feature.geometry) {
                const type = feature.feature.geometry.type.toLowerCase();
                if (type.includes('point')) pointCount++;
                else if (type.includes('line') || type.includes('string')) lineCount++;
                else if (type.includes('polygon')) polygonCount++;
            }
        });
    }
    
    // Return the most common geometry type
    if (polygonCount > pointCount && polygonCount > lineCount) return 'polygon';
    if (lineCount > pointCount) return 'line';
    return 'point';
}

/**
 * Configure placement options based on geometry type
 */
function configurePlacementOptions(geometryType) {
    const placementSection = document.getElementById('labelPlacementSection');
    
    // Show placement options for all geometry types now including polygons
    placementSection.style.display = 'block';
    
    // Configure specific options based on geometry type
    const placementRadios = document.querySelectorAll('input[name="labelPlacement"]');
    placementRadios.forEach(radio => {
        const parentLabel = radio.closest('label');
        if (geometryType === 'polygon') {
            // For polygons, enable straight and add new "free" option
            if (radio.value === 'curved') {
                // Hide curved option for polygons
                parentLabel.style.display = 'none';
            } else {
                parentLabel.style.display = 'flex';
            }
        } else {
            // For points and lines, show all options
            parentLabel.style.display = 'flex';
        }
    });
}

/**
 * Show advanced configuration sections
 */
function showAdvancedSections() {
    const stylingSection = document.getElementById('labelStylingSection');
    const actionsSection = document.getElementById('labelActionsSection');
    
    if (stylingSection) stylingSection.style.display = 'block';
    if (actionsSection) actionsSection.style.display = 'block';
}

/**
 * Hide advanced configuration sections
 */
function hideAdvancedSections() {
    const stylingSection = document.getElementById('labelStylingSection');
    const placementSection = document.getElementById('labelPlacementSection');
    const actionsSection = document.getElementById('labelActionsSection');
    
    if (stylingSection) stylingSection.style.display = 'none';
    if (placementSection) placementSection.style.display = 'none';
    if (actionsSection) actionsSection.style.display = 'none';
}

/**
 * Handle font family change
 */
function handleFontFamilyChange(event) {
    window.labelStyles.fontFamily = event.target.value;
    updateActiveLabels();
}

/**
 * Handle font size change
 */
function handleFontSizeChange(event) {
    const fontSize = parseInt(event.target.value);
    window.labelStyles.fontSize = fontSize;
    
    // Update the display value
    const sizeDisplay = document.getElementById('labelFontSizeValue');
    if (sizeDisplay) {
        sizeDisplay.textContent = `${fontSize}px`;
    }
    
    updateActiveLabels();
}

/**
 * Handle font color change from color picker
 */
function handleFontColorChange(event) {
    const color = event.target.value;
    window.labelStyles.fontColor = color;
    
    // Update text input
    const colorText = document.getElementById('labelFontColorText');
    if (colorText) {
        colorText.value = color;
    }
    
    updateActiveLabels();
}

/**
 * Handle font color change from text input
 */
function handleFontColorTextChange(event) {
    const color = event.target.value;
    
    // Validate hex color
    if (/^#[0-9A-F]{6}$/i.test(color)) {
        window.labelStyles.fontColor = color;
        
        // Update color picker
        const colorPicker = document.getElementById('labelFontColor');
        if (colorPicker) {
            colorPicker.value = color;
        }
        
        updateActiveLabels();
    }
}

/**
 * Handle placement change
 */
function handlePlacementChange(event) {
    window.labelStyles.placement = event.target.value;
    updateActiveLabels();
}

/**
 * Apply labels to the selected layer
 */
function applyLabels() {
    const layerId = document.getElementById('labelLayerSelect').value;
    const fieldName = document.getElementById('labelFieldSelect').value;
    
    if (!layerId || !fieldName) {
        window.showWarning('Please select both a layer and a field for labeling.', 'Incomplete Selection');
        return;
    }
    
    const layerInfo = window.layers.get(layerId);
    if (!layerInfo || !layerInfo.layer) {
        window.showError('Selected layer is not available.', 'Layer Error');
        return;
    }
    
    try {
        // Clear existing labels for this layer
        clearLayerLabels(layerId);
        
        // Create new labels
        const labelGroup = createLabelsForLayer(layerInfo.layer, fieldName, layerId);
        
        if (labelGroup) {
            // Add to map
            window.map.addLayer(labelGroup);
            
            // Store label group
            window.labelLayerGroups.set(layerId, labelGroup);
            
            // Store active label configuration
            window.activeLabels.set(layerId, {
                fieldName: fieldName,
                styles: { ...window.labelStyles }
            });
            
            window.showSuccess(`Labels applied successfully to layer using field "${fieldName}".`, 'Labels Applied');
        }
    } catch (error) {
        console.error('Error applying labels:', error);
        window.showError('Failed to apply labels. Please try again.', 'Label Error');
    }
}

/**
 * Create labels for a layer
 */
function createLabelsForLayer(layer, fieldName, layerId) {
    const labelGroup = L.layerGroup();
    const geometryType = detectGeometryType(layer);
    
    if (layer._layers) {
        Object.values(layer._layers).forEach(feature => {
            const label = createLabelForFeature(feature, fieldName, geometryType);
            if (label) {
                labelGroup.addLayer(label);
            }
        });
    }
    
    return labelGroup;
}

/**
 * Create a label for a single feature
 */
function createLabelForFeature(feature, fieldName, geometryType) {
    if (!feature.feature || !feature.feature.properties) return null;
    
    const value = feature.feature.properties[fieldName];
    if (value === null || value === undefined || value === '') return null;
    
    const labelText = String(value);
    const bounds = feature.getBounds ? feature.getBounds() : null;
    
    let labelPosition;
    let labelOptions = {
        permanent: true,
        direction: 'center',
        className: 'aera-label',
        offset: [0, 0],
        rotation: 0
    };
    
    // Calculate position and styling based on geometry type and placement mode
    if (geometryType === 'polygon' && bounds) {
        const placement = window.labelStyles.placement;
        
        if (placement === 'free') {
            // Use advanced QGIS-style angled placement
            labelPosition = calculateOptimalInteriorPoint(feature);
            const orientation = calculatePolygonOrientation(feature);
            labelOptions.rotation = orientation;
            labelOptions.className += ' polygon-label free-angled';
        } else {
            // Standard centered placement
            labelPosition = bounds.getCenter();
            labelOptions.className += ' polygon-label';
        }
        
        // Calculate dynamic font size to prevent overflow
        const dynamicSize = calculatePolygonLabelSize(bounds, labelText, feature);
        labelOptions.style = createLabelStyle(dynamicSize, labelOptions.rotation);
        
    } else {
        // Point or line labeling
        labelPosition = feature.getLatLng ? feature.getLatLng() : bounds?.getCenter();
        
        if (geometryType === 'line') {
            configureLabelPlacementForLine(feature, labelOptions);
        }
        
        labelOptions.style = createLabelStyle(window.labelStyles.fontSize, labelOptions.rotation);
    }
    
    if (!labelPosition) return null;
    
    // Create the label marker with rotation support
    const labelMarker = L.marker(labelPosition, {
        icon: L.divIcon({
            className: 'leaflet-div-icon-label',
            html: `<span class="label-text" data-rotation="${labelOptions.rotation}">${labelText}</span>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        })
    });
    
    // Apply custom styling including rotation
    labelMarker.on('add', function() {
        const element = this.getElement();
        if (element) {
            const span = element.querySelector('.label-text');
            if (span) {
                Object.assign(span.style, labelOptions.style);
                
                // Apply rotation if specified
                if (labelOptions.rotation !== 0) {
                    span.style.transform = `rotate(${labelOptions.rotation}deg)`;
                    span.style.transformOrigin = 'center center';
                }
            }
        }
    });
    
    return labelMarker;
}

/**
 * Calculate polygon orientation angle based on minimum bounding rectangle
 */
function calculatePolygonOrientation(feature) {
    try {
        if (!feature.feature || !feature.feature.geometry) return 0;
        
        const coords = feature.feature.geometry.coordinates;
        if (!coords || coords.length === 0) return 0;
        
        // Get the exterior ring coordinates
        let ring = coords[0];
        if (feature.feature.geometry.type === 'MultiPolygon') {
            ring = coords[0][0]; // First polygon, exterior ring
        }
        
        if (!ring || ring.length < 4) return 0;
        
        // Calculate the minimum bounding rectangle
        const mbr = calculateMinimumBoundingRectangle(ring);
        
        // Return the angle of the longer side of the MBR (in degrees)
        return mbr.angle;
    } catch (error) {
        console.warn('Error calculating polygon orientation:', error);
        return 0;
    }
}

/**
 * Calculate minimum bounding rectangle for polygon coordinates
 */
function calculateMinimumBoundingRectangle(coordinates) {
    if (!coordinates || coordinates.length < 3) return { angle: 0, width: 0, height: 0 };
    
    let minArea = Infinity;
    let bestAngle = 0;
    let bestWidth = 0;
    let bestHeight = 0;
    
    // Try different angles to find minimum area bounding rectangle
    for (let angle = 0; angle < 90; angle += 5) {
        const radians = (angle * Math.PI) / 180;
        const cosAngle = Math.cos(radians);
        const sinAngle = Math.sin(radians);
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        // Rotate all points and find bounding box
        for (let i = 0; i < coordinates.length - 1; i++) {
            const x = coordinates[i][0];
            const y = coordinates[i][1];
            
            const rotatedX = x * cosAngle + y * sinAngle;
            const rotatedY = -x * sinAngle + y * cosAngle;
            
            minX = Math.min(minX, rotatedX);
            maxX = Math.max(maxX, rotatedX);
            minY = Math.min(minY, rotatedY);
            maxY = Math.max(maxY, rotatedY);
        }
        
        const width = maxX - minX;
        const height = maxY - minY;
        const area = width * height;
        
        if (area < minArea) {
            minArea = area;
            bestAngle = angle;
            bestWidth = width;
            bestHeight = height;
        }
    }
    
    // Prefer the longer axis but limit rotation to maintain readability
    let finalAngle = bestAngle;
    if (bestHeight > bestWidth) {
        finalAngle = (bestAngle + 90) % 180;
    }
    
    // Limit rotation to ±45 degrees for readability
    if (finalAngle > 45 && finalAngle < 135) {
        finalAngle = finalAngle > 90 ? finalAngle - 90 : finalAngle;
    } else if (finalAngle >= 135) {
        finalAngle = finalAngle - 180;
    }
    
    // Further limit to ±30 degrees for better readability
    finalAngle = Math.max(-30, Math.min(30, finalAngle));
    
    return {
        angle: finalAngle,
        width: bestWidth,
        height: bestHeight
    };
}

/**
 * Calculate optimal interior point for label placement using pole of inaccessibility
 */
function calculateOptimalInteriorPoint(feature) {
    try {
        if (!feature.feature || !feature.feature.geometry) {
            return feature.getBounds ? feature.getBounds().getCenter() : null;
        }
        
        const coords = feature.feature.geometry.coordinates;
        if (!coords || coords.length === 0) {
            return feature.getBounds ? feature.getBounds().getCenter() : null;
        }
        
        // Get the exterior ring
        let ring = coords[0];
        if (feature.feature.geometry.type === 'MultiPolygon') {
            ring = coords[0][0];
        }
        
        if (!ring || ring.length < 4) {
            return feature.getBounds ? feature.getBounds().getCenter() : null;
        }
        
        // Use pole of inaccessibility algorithm (simplified version)
        const pole = findPoleOfInaccessibility(ring);
        
        if (pole && pole.x !== undefined && pole.y !== undefined) {
            return L.latLng(pole.y, pole.x);
        }
        
        // Fallback to centroid
        return feature.getBounds ? feature.getBounds().getCenter() : null;
    } catch (error) {
        console.warn('Error calculating optimal interior point:', error);
        return feature.getBounds ? feature.getBounds().getCenter() : null;
    }
}

/**
 * Simplified pole of inaccessibility calculation
 */
function findPoleOfInaccessibility(ring) {
    // Convert to simple coordinate array
    const polygon = ring.map(coord => ({ x: coord[0], y: coord[1] }));
    
    // Find bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
        minX = Math.min(p.x, minX);
        minY = Math.min(p.y, minY);
        maxX = Math.max(p.x, maxX);
        maxY = Math.max(p.y, maxY);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const cellSize = Math.min(width, height) / 20; // Grid resolution
    
    let bestCell = { x: minX + width / 2, y: minY + height / 2, distance: 0 };
    
    // Try grid points
    for (let x = minX; x < maxX; x += cellSize) {
        for (let y = minY; y < maxY; y += cellSize) {
            const cell = { x, y };
            cell.distance = pointToPolygonDistance(cell, polygon);
            
            if (cell.distance > bestCell.distance && pointInPolygon(cell, polygon)) {
                bestCell = cell;
            }
        }
    }
    
    return bestCell.distance > 0 ? bestCell : { x: minX + width / 2, y: minY + height / 2 };
}

/**
 * Check if point is inside polygon
 */
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
            (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Calculate distance from point to polygon boundary
 */
function pointToPolygonDistance(point, polygon) {
    let minDistance = Infinity;
    
    for (let i = 0; i < polygon.length - 1; i++) {
        const distance = pointToLineDistance(point, polygon[i], polygon[i + 1]);
        minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
}

/**
 * Calculate distance from point to line segment
 */
function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) return Math.sqrt(A * A + B * B);
    
    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));
    
    const xx = lineStart.x + param * C;
    const yy = lineStart.y + param * D;
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate optimal font size for polygon labels to prevent overflow
 */
function calculatePolygonLabelSize(bounds, text, feature) {
    const boundsWidth = Math.abs(bounds.getEast() - bounds.getWest());
    const boundsHeight = Math.abs(bounds.getNorth() - bounds.getSouth());
    
    // Convert lat/lng bounds to approximate pixel dimensions
    const zoom = window.map.getZoom();
    const pixelWidth = boundsWidth * Math.pow(2, zoom) * 256 / 360;
    const pixelHeight = boundsHeight * Math.pow(2, zoom) * 256 / 180;
    
    // More accurate text width calculation
    const avgCharWidth = 0.6; // Ratio of character width to font size
    const baseFontSize = window.labelStyles.fontSize || 8;
    
    // Calculate text dimensions at base font size
    const textWidth = text.length * avgCharWidth * baseFontSize;
    const textHeight = baseFontSize * 1.2; // Include line height
    
    // Calculate maximum font size that fits within polygon bounds
    const maxSizeByWidth = (pixelWidth * 0.7) / (text.length * avgCharWidth);
    const maxSizeByHeight = (pixelHeight * 0.7) / 1.2;
    
    // Determine optimal size but never exceed default or go below minimum
    const optimalSize = Math.min(maxSizeByWidth, maxSizeByHeight);
    const finalSize = Math.max(4, Math.min(optimalSize, baseFontSize));
    
    // Additional check for very small polygons
    if (pixelWidth < 30 || pixelHeight < 20) {
        return Math.max(4, Math.min(6, finalSize));
    }
    
    return Math.round(finalSize);
}

/**
 * Configure label placement for line features
 */
function configureLabelPlacementForLine(feature, labelOptions) {
    const placement = window.labelStyles.placement;
    
    switch (placement) {
        case 'parallel':
            // TODO: Implement parallel to line placement
            labelOptions.className += ' parallel-label';
            break;
        case 'curved':
            // TODO: Implement curved along path placement
            labelOptions.className += ' curved-label';
            break;
        default:
            // Straight horizontal placement
            labelOptions.className += ' straight-label';
            break;
    }
}

/**
 * Create CSS style object for labels
 */
function createLabelStyle(fontSize, rotation = 0) {
    const style = {
        fontFamily: window.labelStyles.fontFamily,
        fontSize: `${fontSize}px`,
        color: window.labelStyles.fontColor,
        fontWeight: '500',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: '1000',
        textAlign: 'center',
        display: 'inline-block'
    };
    
    // Add rotation transform if specified
    if (rotation !== 0) {
        style.transform = `rotate(${rotation}deg)`;
        style.transformOrigin = 'center center';
    }
    
    return style;
}

/**
 * Update active labels with new styling
 */
function updateActiveLabels() {
    window.activeLabels.forEach((config, layerId) => {
        // Re-apply labels with updated styles
        const layerInfo = window.layers.get(layerId);
        if (layerInfo && layerInfo.layer) {
            clearLayerLabels(layerId);
            
            const labelGroup = createLabelsForLayer(layerInfo.layer, config.fieldName, layerId);
            if (labelGroup) {
                window.map.addLayer(labelGroup);
                window.labelLayerGroups.set(layerId, labelGroup);
            }
        }
    });
}

/**
 * Clear labels for a specific layer
 */
function clearLayerLabels(layerId) {
    const labelGroup = window.labelLayerGroups.get(layerId);
    if (labelGroup) {
        window.map.removeLayer(labelGroup);
        window.labelLayerGroups.delete(layerId);
    }
}

/**
 * Clear all labels
 */
function clearLabels() {
    window.labelLayerGroups.forEach((labelGroup, layerId) => {
        window.map.removeLayer(labelGroup);
    });
    
    window.labelLayerGroups.clear();
    window.activeLabels.clear();
    
    // Reset UI
    const layerSelect = document.getElementById('labelLayerSelect');
    const fieldSelect = document.getElementById('labelFieldSelect');
    
    if (layerSelect) layerSelect.value = '';
    if (fieldSelect) fieldSelect.value = '';
    
    hideAdvancedSections();
    
    window.showSuccess('All labels cleared successfully.', 'Labels Cleared');
}

/**
 * Refresh labels when layers change
 */
function refreshLabelsOnLayerChange() {
    // Re-populate layer dropdown
    populateLayerDropdown();
    
    // Check if any active labels reference removed layers
    const activeLayerIds = Array.from(window.layers.keys());
    
    window.activeLabels.forEach((config, layerId) => {
        if (!activeLayerIds.includes(layerId)) {
            clearLayerLabels(layerId);
            window.activeLabels.delete(layerId);
        }
    });
}

// CSS Styles for labels (injected into document)
const labelStyles = `
<style>
.aera-label {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

.leaflet-div-icon-label {
    background: transparent !important;
    border: none !important;
}

.label-text {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    font-weight: 500;
    text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    text-align: center;
    line-height: 1.2;
    transition: all 0.2s ease;
}

.polygon-label .label-text {
    text-align: center;
    backdrop-filter: blur(4px);
    background: rgba(0, 0, 0, 0.75);
}

.free-angled .label-text {
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(64, 224, 208, 0.3);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    transform-origin: center center;
}

.straight-label .label-text {
    transform: rotate(0deg);
}

.parallel-label .label-text {
    /* TODO: Calculate rotation based on line angle */
}

.curved-label .label-text {
    /* TODO: Implement curved text along path */
}

/* Zoom-responsive label adjustments */
@media (max-resolution: 150dpi) {
    .label-text {
        font-size: inherit;
    }
}

/* High DPI display adjustments */
@media (min-resolution: 150dpi) {
    .label-text {
        text-shadow: 0.5px 0.5px 2px rgba(0,0,0,0.9);
    }
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', labelStyles);

// Initialize the system when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLabelSystem);
} else {
    initializeLabelSystem();
}

// Export functions for global use
window.initializeLabelSystem = initializeLabelSystem;
window.refreshLabelsOnLayerChange = refreshLabelsOnLayerChange;
window.clearAllLabels = clearLabels;

console.log('Labels.js module loaded successfully');