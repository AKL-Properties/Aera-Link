/**
 * Lot Search Module for Aéra Link WebGIS
 * Provides EXCLUSIVE search functionality for the Aera.geojson layer ONLY
 * 
 * IMPORTANT: This search is strictly restricted to Aera.geojson data.
 * No other layers (permanent, dynamic, or user-uploaded) are included in search results.
 * 
 * Features:
 * - Global search across all fields in Aera.geojson (when no fields selected)
 * - Strictly scoped field-specific search using inline modifiers (type '/' to select field)
 * - Visual field tags with easy removal
 * - No fallback when fields are selected - search is strictly scoped to selected fields only
 * - Keyboard navigation for both field selection and results
 * - Responsive design matching the black-and-teal UI theme
 * - Exclusive targeting of Aera.geojson data with no cross-layer contamination
 */

let searchTimeout = null;
let searchResults = [];
let currentHighlightedFeature = null;
let isSearchInitialized = false;
let availableFields = [];
let selectedFields = [];
let fieldDropdownVisible = false;
let searchOverlayMask = null; // Black overlay mask for search emphasis

// Initialize the lot search functionality
export function initializeLotSearch() {
    if (isSearchInitialized) {
        console.log('Lot search already initialized');
        return;
    }

    const searchInput = document.getElementById('headerSearchInput');
    if (!searchInput) {
        console.error('Search input element not found');
        return;
    }

    // Update placeholder to reflect lot search functionality
    searchInput.placeholder = 'Search lots...';

    // Create search results dropdown
    createSearchDropdown();

    // Add event listeners
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', handleSearchFocus);
    searchInput.addEventListener('blur', handleSearchBlur);
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', handleKeyDown);
    
    // Initialize field dropdown system
    initializeFieldDropdown();
    extractAvailableFields();

    // Click outside to close dropdown
    document.addEventListener('click', handleOutsideClick);

    isSearchInitialized = true;
    console.log('✅ Lot search initialized');
}

// Create the search results dropdown element
function createSearchDropdown() {
    // Remove existing dropdown if present
    const existingDropdown = document.getElementById('lotSearchDropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    const searchContainer = document.querySelector('#headerSearchInput').parentElement;
    const dropdown = document.createElement('div');
    dropdown.id = 'lotSearchDropdown';
    dropdown.className = `
        absolute top-full left-0 right-0 mt-1 bg-pure-black/95 backdrop-blur-sm 
        border border-neon-teal/30 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto
        hidden transition-all duration-200 ease-in-out
    `;
    
    searchContainer.style.position = 'relative';
    searchContainer.appendChild(dropdown);
}

// Initialize field dropdown system
function initializeFieldDropdown() {
    const searchContainer = document.querySelector('#headerSearchInput').parentElement;
    
    // Create field dropdown
    const fieldDropdown = document.createElement('div');
    fieldDropdown.id = 'fieldSearchDropdown';
    fieldDropdown.className = `
        absolute top-full left-0 right-0 mt-1 bg-pure-black/95 backdrop-blur-sm 
        border border-neon-teal/30 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto
        hidden transition-all duration-200 ease-in-out
    `;
    
    searchContainer.appendChild(fieldDropdown);
    
    // Create detached field indicator
    createFieldIndicator();
}

// Create field indicator inside search bar
function createFieldIndicator() {
    const searchContainer = document.querySelector('#headerSearchInput').parentElement;
    
    // Create field indicator positioned inside search bar on the right
    const fieldIndicator = document.createElement('div');
    fieldIndicator.id = 'fieldIndicator';
    fieldIndicator.className = `
        absolute top-1/2 -translate-y-1/2 right-2 hidden
        w-6 h-6 bg-neon-teal/20 border border-neon-teal rounded-full
        flex items-center justify-center cursor-pointer
        text-neon-teal text-xs font-bold
        hover:bg-neon-teal/30 transition-all duration-200
        z-10
    `;
    
    const fieldCount = document.createElement('span');
    fieldCount.id = 'fieldCount';
    fieldCount.textContent = '0';
    fieldIndicator.appendChild(fieldCount);
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.id = 'fieldTooltip';
    tooltip.className = `
        absolute top-full right-0 mt-2 px-3 py-2 bg-pure-black/95 backdrop-blur-sm
        border border-neon-teal/30 rounded-lg shadow-lg text-xs text-light-gray
        whitespace-nowrap z-20 hidden min-w-max
    `;
    fieldIndicator.appendChild(tooltip);
    
    // Add event listeners
    fieldIndicator.addEventListener('mouseenter', showFieldTooltip);
    fieldIndicator.addEventListener('mouseleave', hideFieldTooltip);
    fieldIndicator.addEventListener('click', clearAllSelectedFields);
    
    searchContainer.appendChild(fieldIndicator);
}

// Extract available fields from Aera.geojson data EXCLUSIVELY
function extractAvailableFields() {
    const aeraData = getAeraData();
    if (!aeraData || !aeraData.features || aeraData.features.length === 0) {
        console.log('📋 No Aera.geojson data available for field extraction');
        return;
    }
    
    const fieldSet = new Set();
    
    // Extract fields from first few features to get comprehensive list
    const samplesToCheck = Math.min(10, aeraData.features.length);
    for (let i = 0; i < samplesToCheck; i++) {
        const feature = aeraData.features[i];
        if (feature.properties) {
            Object.keys(feature.properties).forEach(key => {
                if (feature.properties[key] !== null && feature.properties[key] !== undefined) {
                    fieldSet.add(key);
                }
            });
        }
    }
    
    availableFields = Array.from(fieldSet).sort((a, b) => {
        // Prioritize common fields
        const priorityFields = [
            'REGISTERED OWNER', 'REGISTERED_OWNER', 'OWNER', 'OWNER_NAME',
            'TCT NO.', 'TCT_NO', 'TCT', 'TITLE',
            'LOT NO.', 'LOT_NO', 'LOT', 'LOT_NUMBER',
            'AREA (SQM)', 'AREA_SQM', 'AREA', 'SQM',
            'BLOCK', 'BLOCK_NO', 'SURVEY', 'SURVEY_NO'
        ];
        
        const aIndex = priorityFields.findIndex(pf => a.toUpperCase().includes(pf));
        const bIndex = priorityFields.findIndex(pf => b.toUpperCase().includes(pf));
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        return a.localeCompare(b);
    });
    
    console.log(`📋 Extracted ${availableFields.length} fields from Aera.geojson exclusively:`, availableFields);
}

// Handle search input with debouncing
function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    // Check if user typed forward slash to trigger field selection
    // Allow '/' at the beginning or after any content to add more fields
    if (query === '/' || query.endsWith('/')) {
        showFieldDropdown();
        return;
    }
    
    // Hide field dropdown if visible
    if (fieldDropdownVisible) {
        hideFieldDropdown();
    }
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Hide dropdown if query is empty
    if (!query) {
        hideSearchDropdown();
        return;
    }

    // Debounce search with 150ms delay
    searchTimeout = setTimeout(() => {
        performLotSearch(query);
    }, 150);
}

// Perform the actual search through Aera.geojson data EXCLUSIVELY
function performLotSearch(query) {
    const fieldsText = selectedFields.length > 0 ? 
        ` (strictly scoped to field${selectedFields.length > 1 ? 's' : ''}: ${selectedFields.join(', ')})` : 
        ' (global search across all fields)';
    console.log(`🔍 Searching EXCLUSIVELY in Aera.geojson for: "${query}"${fieldsText}`);
    
    const aeraData = getAeraData();
    if (!aeraData) {
        console.error('❌ Aera.geojson data not found - search is restricted to Aera.geojson only');
        showNoResultsMessage('Aera.geojson data not loaded');
        return;
    }

    if (!aeraData.features || aeraData.features.length === 0) {
        console.error('❌ No features found in Aera.geojson data');
        showNoResultsMessage('No features in Aera.geojson');
        return;
    }

    // Additional validation to ensure we have the correct Aera.geojson data
    console.log(`📊 Searching through ${aeraData.features.length} features in Aera.geojson exclusively`);

    // Search through all features and their properties
    searchResults = [];
    const queryLower = query.toLowerCase();

    aeraData.features.forEach((feature, index) => {
        if (!feature.properties) return;

        const matches = [];
        
        if (selectedFields.length > 0) {
            // Strictly scoped search - ONLY search within selected fields
            selectedFields.forEach(selectedField => {
                const fieldValue = feature.properties[selectedField];
                if (fieldValue && fieldValue.toString().toLowerCase().includes(queryLower)) {
                    matches.push({
                        field: selectedField,
                        value: fieldValue,
                        matchType: fieldValue.toString().toLowerCase() === queryLower ? 'exact' : 'partial',
                        isPriorityField: true // Mark as priority field match
                    });
                }
            });
            // No fallback to other fields when specific fields are selected
        } else {
            // Global search through all property values
            Object.entries(feature.properties).forEach(([key, value]) => {
                if (value && value.toString().toLowerCase().includes(queryLower)) {
                    matches.push({
                        field: key,
                        value: value,
                        matchType: value.toString().toLowerCase() === queryLower ? 'exact' : 'partial',
                        isPriorityField: false
                    });
                }
            });
        }

        if (matches.length > 0) {
            searchResults.push({
                feature: feature,
                featureIndex: index,
                matches: matches,
                // Priority scoring: priority field matches first, then exact matches, then partial matches
                score: matches.reduce((score, match) => {
                    let matchScore = 0;
                    if (match.isPriorityField) {
                        matchScore += 20; // High bonus for priority field matches
                    }
                    if (match.matchType === 'exact') {
                        matchScore += 10; // Bonus for exact matches
                    } else {
                        matchScore += 1; // Base score for partial matches
                    }
                    return score + matchScore;
                }, 0)
            });
        }
    });

    // Sort results by relevance score (highest first)
    searchResults.sort((a, b) => b.score - a.score);

    // Limit to 50 results
    searchResults = searchResults.slice(0, 50);

    console.log(`📊 Found ${searchResults.length} matching lots`);
    displaySearchResults();
}


// Get Aera.geojson data from various possible sources
function getAeraData() {
    // First try to get from window.aeraDirectData (direct loaded data)
    if (window.aeraDirectData) {
        console.log('Using aeraDirectData for search');
        return window.aeraDirectData;
    }

    // Then try to find it in the layers registry - STRICTLY target Aera.geojson only
    if (window.layers) {
        for (const [layerId, layerInfo] of window.layers) {
            // Only match layers specifically named 'Aera' or 'Aera.geojson'
            // Remove the generic isPermanent check to prevent matching other permanent layers
            if (layerInfo.name === 'Aera' || layerInfo.name === 'Aera.geojson') {
                console.log(`Using layer data from ${layerId} (${layerInfo.name}) for search`);
                return layerInfo.originalData || layerInfo.data;
            }
        }
    }

    console.error('❌ Could not find Aera.geojson data - only Aera/Aera.geojson layers are supported for search');
    return null;
}

// Display search results in the dropdown
function displaySearchResults() {
    const dropdown = document.getElementById('lotSearchDropdown');
    if (!dropdown) return;

    if (searchResults.length === 0) {
        const message = selectedFields.length > 0 ? 
            `No matches found in selected field${selectedFields.length !== 1 ? 's' : ''}: ${selectedFields.join(', ')}` : 
            'No matching lots found';
        showNoResultsMessage(message);
        return;
    }

    const resultItems = searchResults.map((result, index) => {
        const feature = result.feature;
        const properties = feature.properties;
        
        // Determine the best fields to display
        const displayFields = getDisplayFields(properties, result.matches);
        
        return `
            <div class="search-result-item p-3 hover:bg-neon-teal/10 cursor-pointer border-b border-gray-700/30 last:border-b-0 transition-colors duration-150" 
                 data-result-index="${index}">
                <div class="flex flex-col space-y-1">
                    ${displayFields.map(field => `
                        <div class="flex justify-between items-center">
                            <span class="text-xs text-gray-400 uppercase tracking-wide">${field.label}:</span>
                            <span class="text-sm text-light-gray font-medium">${field.value}</span>
                        </div>
                    `).join('')}
                </div>
                ${result.matches.length > displayFields.length ? `
                    <div class="text-xs text-gray-500 mt-1">
                        +${result.matches.length - displayFields.length} more matches
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    const headerText = selectedFields.length > 0 ? 
        `${searchResults.length} lot${searchResults.length !== 1 ? 's' : ''} found in selected field${selectedFields.length !== 1 ? 's' : ''}: ${selectedFields.join(', ')}` :
        `${searchResults.length} lot${searchResults.length !== 1 ? 's' : ''} found (global search)`;

    dropdown.innerHTML = `
        <div class="p-2 border-b border-gray-700/30">
            <div class="text-xs text-gray-400 uppercase tracking-wide">
                ${headerText}
            </div>
        </div>
        ${resultItems}
    `;

    // Add click event listeners to result items
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', handleResultClick);
        item.addEventListener('mouseenter', handleResultHover);
    });

    showSearchDropdown();
}

// Determine the best fields to display for a search result
function getDisplayFields(properties, matches) {
    // Priority order for common lot identification fields
    const priorityFields = [
        'lot_no', 'lotno', 'lot_number', 'lot',
        'tct', 'tct_no', 'title',
        'owner', 'owner_name', 'landowner',
        'block', 'block_no',
        'survey', 'survey_no'
    ];

    const displayFields = [];
    const usedFields = new Set();

    // First, add high-priority matched fields
    matches.forEach(match => {
        const fieldLower = match.field.toLowerCase();
        if (priorityFields.some(pf => fieldLower.includes(pf)) && !usedFields.has(match.field)) {
            displayFields.push({
                label: formatFieldLabel(match.field),
                value: match.value
            });
            usedFields.add(match.field);
        }
    });

    // Then add other matched fields up to a limit of 3
    matches.forEach(match => {
        if (displayFields.length >= 3) return;
        if (!usedFields.has(match.field)) {
            displayFields.push({
                label: formatFieldLabel(match.field),
                value: match.value
            });
            usedFields.add(match.field);
        }
    });

    // If we still don't have enough, add priority fields that exist but didn't match
    if (displayFields.length < 2) {
        priorityFields.forEach(priorityField => {
            if (displayFields.length >= 3) return;
            
            const matchingKey = Object.keys(properties).find(key => 
                key.toLowerCase().includes(priorityField)
            );
            
            if (matchingKey && !usedFields.has(matchingKey) && properties[matchingKey]) {
                displayFields.push({
                    label: formatFieldLabel(matchingKey),
                    value: properties[matchingKey]
                });
                usedFields.add(matchingKey);
            }
        });
    }

    return displayFields;
}

// Format field labels for display
function formatFieldLabel(fieldName) {
    return fieldName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
}

// Show "no results" message
function showNoResultsMessage(message) {
    const dropdown = document.getElementById('lotSearchDropdown');
    if (!dropdown) return;

    dropdown.innerHTML = `
        <div class="p-4 text-center text-gray-400">
            <i class="fas fa-search mb-2 text-lg"></i>
            <div class="text-sm">${message}</div>
        </div>
    `;

    showSearchDropdown();
}

// Handle result item click
function handleResultClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const resultIndex = parseInt(event.currentTarget.dataset.resultIndex);
    const result = searchResults[resultIndex];
    
    if (result && result.feature) {
        // Clear any existing search highlights first
        clearSearchHighlight();
        
        zoomToLot(result.feature);
        hideSearchDropdown();
        
        // Clear search input
        const searchInput = document.getElementById('headerSearchInput');
        if (searchInput) {
            searchInput.blur();
        }
    }
}

// Handle result item hover
function handleResultHover(event) {
    // Remove highlight from other items
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Highlight current item with custom class
    event.currentTarget.classList.add('selected');
}

// Zoom to and highlight a specific lot
function zoomToLot(feature) {
    if (!window.map || !feature.geometry) {
        console.error('❌ Map or feature geometry not available');
        return;
    }

    try {
        // Create a Leaflet layer from the feature to get bounds
        const tempLayer = L.geoJSON(feature);
        const bounds = tempLayer.getBounds();
        
        if (bounds.isValid()) {
            // Zoom to the feature with padding
            window.map.fitBounds(bounds, { 
                padding: [20, 20],
                maxZoom: 18 
            });
            
            // Highlight the feature temporarily
            highlightLotFeature(feature);
            
            console.log(`✅ Zoomed to lot feature`);
        } else {
            console.error('❌ Invalid bounds for feature');
        }
    } catch (error) {
        console.error('❌ Error zooming to lot:', error);
    }
}
 
function highlightLotFeature(feature) {
    // Clear previous highlight
    if (currentHighlightedFeature) {
        clearSearchHighlight();
    }

    // If unified selection visuals are available, use them
    if (typeof window.applyUnifiedSelectionVisuals === 'function') {
        window.applyUnifiedSelectionVisuals([feature], {
            borderColor: '#00ffe7',
            borderWidth: 5,
            borderOpacity: 1,
            maskOpacity: 0.6,
            glowIntensity: 9,
            animationDuration: '2s',
            autoCleanup: true,
            cleanupDelay: 4000
        });

        currentHighlightedFeature = { searchToolExclusive: true, feature: feature };
        console.log('✅ Applied unified selection visuals for search highlight');
        return;
    }

    // === Fallback: Manual reverse mask + SVG overlay ===
    if (typeof window.createSelectionOverlayMask === 'function') {
        // World-sized outer ring (GeoJSON uses [lng, lat])
        const outerRing = [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90]
        ];

        let holeCoords;

        if (feature.geometry.type === 'Polygon') {
            holeCoords = feature.geometry.coordinates[0];
        } else if (feature.geometry.type === 'MultiPolygon') {
            holeCoords = feature.geometry.coordinates[0][0];
        } else {
            console.error('❌ Unsupported geometry type for mask:', feature.geometry.type);
            return;
        }

        // Construct reversed mask (outer polygon with inner hole)
        const maskGeoJSON = {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [outerRing, holeCoords]
            }
        };

        // Add black translucent mask
        const maskLayer = L.geoJSON(maskGeoJSON, {
            style: {
                fillColor: 'black',
                fillOpacity: 0.6,
                color: 'black',
                weight: 0
            }
        }).addTo(window.map);

        // Add animated glowing outline of the selected polygon above the mask
        const highlightLayer = L.geoJSON(feature, {
            renderer: L.svg(),
            style: {
                color: '#00ffe7',
                weight: 5,
                opacity: 1,
                fill: false,
                dashArray: '10 15',
                className: 'chase-glow'
            }
        }).addTo(window.map);

        // Store reference
        currentHighlightedFeature = {
            feature,
            layers: [maskLayer, highlightLayer]
        };

        console.log('✅ Applied fallback mask + animated outline');

        // Auto cleanup
        setTimeout(() => {
            clearSearchHighlight();
        }, 4000);
    } else {
        console.error('❌ No visual system available for search highlighting');
    }
}

// Clean up search highlight and overlay mask
function clearSearchHighlight() {
    if (currentHighlightedFeature) {
        // Check if using unified visuals system
        if (currentHighlightedFeature.searchToolExclusive && typeof window.clearUnifiedSelectionVisuals === 'function') {
            // Clear unified selection visuals
            window.clearUnifiedSelectionVisuals();
            console.log('✅ Cleared unified selection visuals for search');
        } else {
            // Fallback: Remove custom highlight and mask layers
            if (window.map && currentHighlightedFeature.layers) {
                currentHighlightedFeature.layers.forEach(layer => {
                    if (window.map.hasLayer(layer)) {
                        window.map.removeLayer(layer);
                    }
                });
            } else if (window.map && currentHighlightedFeature.removeFrom) {
                currentHighlightedFeature.removeFrom(window.map);
            } else if (window.map && window.map.removeLayer) {
                window.map.removeLayer(currentHighlightedFeature);
            }

            // Remove any Selection Tool overlay mask
            if (typeof window.removeSelectionOverlayMask === 'function') {
                window.removeSelectionOverlayMask();
            }

            console.log('✅ Cleared fallback search highlight and overlay mask');
        }

        currentHighlightedFeature = null;
    }

    // Ensure any legacy overlay mask is removed
    removeSearchOverlayMask();

    console.log('✅ Search highlight cleanup completed');
}


// Keyboard navigation handlers
function handleKeyDown(event) {
    // Handle field dropdown navigation
    const fieldDropdown = document.getElementById('fieldSearchDropdown');
    if (fieldDropdown && !fieldDropdown.classList.contains('hidden')) {
        handleFieldDropdownKeyNav(event, fieldDropdown);
        return;
    }
    
    // Handle search results navigation
    const dropdown = document.getElementById('lotSearchDropdown');
    if (!dropdown || dropdown.classList.contains('hidden')) {
        // Handle slash key for field selection when not in any dropdown
        if (event.key === '/') {
            event.preventDefault();
            const searchInput = document.getElementById('headerSearchInput');
            if (searchInput) {
                // Append '/' to current value to allow adding more fields
                if (!searchInput.value.endsWith('/')) {
                    searchInput.value += '/';
                }
                showFieldDropdown();
            }
        }
        return;
    }

    const items = dropdown.querySelectorAll('.search-result-item');
    if (items.length === 0) return;

    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('selected')) {
            currentIndex = index;
        }
    });

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            const nextIndex = Math.min(currentIndex + 1, items.length - 1);
            selectResultItem(items, nextIndex);
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            const prevIndex = Math.max(currentIndex - 1, 0);
            selectResultItem(items, prevIndex);
            break;
            
        case 'Enter':
            event.preventDefault();
            if (currentIndex >= 0 && items[currentIndex]) {
                items[currentIndex].click();
            }
            break;
            
        case 'Escape':
            event.preventDefault();
            hideSearchDropdown();
            event.target.blur();
            break;
    }
}

// Select a result item for keyboard navigation
function selectResultItem(items, index) {
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
        items[index].classList.add('selected');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// Handle search input focus
function handleSearchFocus(event) {
    const query = event.target.value.trim();
    if (query === '/' || query.endsWith('/')) {
        showFieldDropdown();
    } else if (query && searchResults.length > 0) {
        showSearchDropdown();
    }
}

// Handle search input blur with delay to allow clicks
function handleSearchBlur(event) {
    // Use a longer delay to ensure dropdown clicks can complete
    setTimeout(() => {
        // Only hide dropdowns if we're not clicking on them
        const activeElement = document.activeElement;
        const searchContainer = document.querySelector('#headerSearchInput').parentElement;
        
        if (!searchContainer.contains(activeElement)) {
            hideSearchDropdown();
            hideFieldDropdown();
        }
    }, 200);
}

// Handle clicks outside the search area
function handleOutsideClick(event) {
    const searchContainer = document.querySelector('#headerSearchInput').parentElement;
    if (!searchContainer.contains(event.target)) {
        hideSearchDropdown();
        hideFieldDropdown();
    }
}

// Show the search dropdown
function showSearchDropdown() {
    const dropdown = document.getElementById('lotSearchDropdown');
    if (dropdown) {
        dropdown.classList.remove('hidden');
        dropdown.style.display = 'block';
    }
    
    // Hide field dropdown if visible
    hideFieldDropdown();
}

// Hide the search dropdown
function hideSearchDropdown() {
    const dropdown = document.getElementById('lotSearchDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200);
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other modules to load
    setTimeout(initializeLotSearch, 500);
});

// Show field selection dropdown
function showFieldDropdown() {
    const dropdown = document.getElementById('fieldSearchDropdown');
    if (!dropdown) return;
    
    if (availableFields.length === 0) {
        extractAvailableFields();
    }
    
    if (availableFields.length === 0) {
        console.log('🚨 No fields available for selection');
        return;
    }
    
    // Filter out already selected fields and build field options
    const unselectedFields = availableFields.filter(field => !selectedFields.includes(field));
    
    if (unselectedFields.length === 0) {
        // Show message if all fields are selected
        dropdown.innerHTML = `
            <div class="p-4 text-center text-gray-400">
                <i class="fas fa-check-circle mb-2 text-lg"></i>
                <div class="text-sm">All available fields are already selected</div>
            </div>
        `;
        dropdown.classList.remove('hidden');
        dropdown.style.display = 'block';
        fieldDropdownVisible = true;
        return;
    }
    
    const fieldItems = unselectedFields.map(field => {
        const displayName = formatFieldLabel(field);
        return `
            <div class="field-option p-3 hover:bg-neon-teal/10 cursor-pointer border-b border-gray-700/30 last:border-b-0 transition-colors duration-150" 
                 data-field="${field}">
                <div class="flex flex-col">
                    <span class="text-sm text-light-gray font-medium">${displayName}</span>
                    <span class="text-xs text-gray-400">${field}</span>
                </div>
            </div>
        `;
    }).join('');
    
    dropdown.innerHTML = `
        <div class="p-2 border-b border-gray-700/30">
            <div class="text-xs text-gray-400 uppercase tracking-wide">
                ${selectedFields.length > 0 ? 
                    `Add Field to Search (${selectedFields.length} selected)` : 
                    'Select Field to Search'
                }
            </div>
        </div>
        ${fieldItems}
    `;
    
    // Add click event listeners to field options
    dropdown.querySelectorAll('.field-option').forEach(option => {
        option.addEventListener('click', handleFieldSelection);
    });
    
    dropdown.classList.remove('hidden');
    dropdown.style.display = 'block';
    fieldDropdownVisible = true;
    
    // Hide results dropdown
    hideSearchDropdown();
    
    console.log('📋 Field dropdown shown with', availableFields.length, 'fields');
}

// Hide field selection dropdown
function hideFieldDropdown() {
    const dropdown = document.getElementById('fieldSearchDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 200);
        fieldDropdownVisible = false;
    }
}

// Handle field selection
function handleFieldSelection(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const field = event.currentTarget.dataset.field;
    if (!field) return;
    
    // Add field to selected fields if not already present
    if (!selectedFields.includes(field)) {
        selectedFields.push(field);
        updateFieldIndicator();
    }
    
    // Clear and focus search input, ensure it's responsive
    const searchInput = document.getElementById('headerSearchInput');
    if (searchInput) {
        // Hide field dropdown immediately
        hideFieldDropdown();
        
        // Clear the slash and any existing content
        searchInput.value = '';
        
        // Restore input functionality
        searchInput.disabled = false;
        searchInput.readOnly = false;
        searchInput.style.pointerEvents = 'auto';
        
        // Focus the input immediately and then again after a small delay
        searchInput.focus();
        setTimeout(() => {
            searchInput.focus();
        }, 50);
    }
    
    console.log(`🎯 Added field: ${field}. Total selected: ${selectedFields.length}`);
}

// Clear all selected fields
function clearAllSelectedFields() {
    selectedFields = [];
    updateFieldIndicator();
    
    // Reset search input and ensure it's functional
    const searchInput = document.getElementById('headerSearchInput');
    if (searchInput) {
        // Restore input functionality
        searchInput.disabled = false;
        searchInput.readOnly = false;
        searchInput.style.pointerEvents = 'auto';
        
        // Focus the input
        searchInput.focus();
    }
    
    console.log('🧹 Cleared all selected fields, returned to global search');
}

// Update field indicator display
function updateFieldIndicator() {
    const fieldIndicator = document.getElementById('fieldIndicator');
    const fieldCount = document.getElementById('fieldCount');
    const searchInput = document.getElementById('headerSearchInput');
    
    if (!fieldIndicator || !fieldCount) return;
    
    if (selectedFields.length > 0) {
        fieldIndicator.classList.remove('hidden');
        fieldCount.textContent = selectedFields.length.toString();
        
        // Adjust input padding to accommodate the field indicator
        if (searchInput) {
            searchInput.style.paddingRight = '2.5rem';
        }
    } else {
        fieldIndicator.classList.add('hidden');
        fieldCount.textContent = '0';
        
        // Reset input padding when no fields are selected
        if (searchInput) {
            searchInput.style.paddingRight = '1rem';
        }
    }
}

// Show field tooltip
function showFieldTooltip() {
    const tooltip = document.getElementById('fieldTooltip');
    if (!tooltip || selectedFields.length === 0) return;
    
    const fieldNames = selectedFields.map(field => formatFieldLabel(field));
    let tooltipText;
    
    // Show all field names as comma-separated list as requested
    tooltipText = fieldNames.join(', ');
    
    tooltip.textContent = tooltipText;
    tooltip.classList.remove('hidden');
}

// Hide field tooltip
function hideFieldTooltip() {
    const tooltip = document.getElementById('fieldTooltip');
    if (tooltip) {
        tooltip.classList.add('hidden');
    }
}

// Select a field item for keyboard navigation
function selectFieldItem(items, index) {
    items.forEach(item => item.classList.remove('selected'));
    if (items[index]) {
        items[index].classList.add('selected');
        items[index].scrollIntoView({ block: 'nearest' });
    }
}

// Handle keyboard navigation in field dropdown
function handleFieldDropdownKeyNav(event, dropdown) {
    const items = dropdown.querySelectorAll('.field-option');
    if (items.length === 0) return;

    let currentIndex = -1;
    items.forEach((item, index) => {
        if (item.classList.contains('selected')) {
            currentIndex = index;
        }
    });

    switch (event.key) {
        case 'ArrowDown':
            event.preventDefault();
            const nextIndex = Math.min(currentIndex + 1, items.length - 1);
            selectFieldItem(items, nextIndex);
            break;
            
        case 'ArrowUp':
            event.preventDefault();
            const prevIndex = Math.max(currentIndex - 1, 0);
            selectFieldItem(items, prevIndex);
            break;
            
        case 'Enter':
            event.preventDefault();
            if (currentIndex >= 0 && items[currentIndex]) {
                items[currentIndex].click();
            } else if (items.length > 0) {
                items[0].click();
            }
            break;
            
        case 'Escape':
            event.preventDefault();
            hideFieldDropdown();
            // Clear the slash if it was just typed
            const searchInput = document.getElementById('headerSearchInput');
            if (searchInput && searchInput.value === '/') {
                searchInput.value = '';
            }
            break;
    }
}

// Legacy search overlay mask function - kept for compatibility but deprecated
// Now using unified selection visuals system instead
function createSearchOverlayMask(feature) {
    console.warn('⚠️ createSearchOverlayMask is deprecated. Using unified selection visuals instead.');
    
    // This function is now handled by the unified selection visuals system
    // If unified visuals are not available, this provides minimal fallback
    if (!window.map || !feature) {
        return;
    }

    // Remove existing mask first
    removeSearchOverlayMask();

    // Try to use the unified system if available
    if (typeof window.applyUnifiedSelectionVisuals === 'function') {
        window.applyUnifiedSelectionVisuals([feature], {
            maskOpacity: 0.6,
            autoCleanup: false
        });
        return;
    }

    // Minimal fallback implementation
    console.log('✅ Applied minimal search overlay mask fallback');
}

// Remove the search overlay mask
function removeSearchOverlayMask() {
    if (searchOverlayMask && searchOverlayMask.parentNode) {
        searchOverlayMask.parentNode.removeChild(searchOverlayMask);
        searchOverlayMask = null;
        console.log('✅ Removed search overlay mask');
    }
}

// Convert coordinates to SVG path data for search - legacy function
// Note: This is now handled by the unified selection visuals system
function createSearchPathFromCoordinates(coordinates) {
    console.warn('⚠️ createSearchPathFromCoordinates is deprecated. Using unified path creation instead.');
    
    if (!coordinates || coordinates.length === 0) {
        return '';
    }

    let pathData = '';
    coordinates.forEach((coord, index) => {
        // Convert lat/lng to screen coordinates
        const point = window.map.latLngToContainerPoint([coord[1], coord[0]]);
        
        // Ensure coordinates are finite and within reasonable bounds
        if (!isFinite(point.x) || !isFinite(point.y)) {
            return; // Skip invalid coordinates
        }
        
        if (index === 0) {
            pathData += `M ${point.x} ${point.y}`;
        } else {
            pathData += ` L ${point.x} ${point.y}`;
        }
    });
    
    if (pathData) {
        pathData += ' Z'; // Close the path
    }
    
    return pathData;
}

// Export functions for external use
window.initializeLotSearch = initializeLotSearch;
window.clearAllSelectedFields = clearAllSelectedFields;
window.clearSearchHighlight = clearSearchHighlight; // Export search highlight clearing function
window.createSearchOverlayMask = createSearchOverlayMask;
window.removeSearchOverlayMask = removeSearchOverlayMask;