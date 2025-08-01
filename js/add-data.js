// Add Data Module - Handles file uploads and web URL data loading

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_EXTENSIONS = ['.geojson', '.json', '.kml', '.kmz', '.gpx', '.csv'];
const SUPPORTED_MIME_TYPES = [
    'application/json',
    'application/geo+json',
    'application/vnd.google-earth.kml+xml',
    'application/vnd.google-earth.kmz',
    'application/gpx+xml',
    'text/csv'
];

// ArcGIS REST Service patterns
const ARCGIS_PATTERNS = {
    domain: /(arcgis\.com|arcgisonline\.com)/i,
    service: /(FeatureServer|MapServer)\/\d+$/i,
    query: /\/query\?/i
};

// WMS Configuration
const WMS_CONFIG = {
    philippineGeoportalUrl: 'https://geoserver.geoportal.gov.ph/geoserver/ows?service=WMS&version=1.1.1&request=GetCapabilities',
    defaultParams: {
        format: 'image/png',
        transparent: true,
        version: '1.1.1'
    }
};

// WMS Capabilities Cache
let wmsCapabilitiesCache = {
    data: null,
    timestamp: null,
    isLoading: false,
    // Cache for 1 hour
    maxAge: 60 * 60 * 1000
};

// Check if cached data is still valid
function isWMSCacheValid() {
    return wmsCapabilitiesCache.data && 
           wmsCapabilitiesCache.timestamp && 
           (Date.now() - wmsCapabilitiesCache.timestamp) < wmsCapabilitiesCache.maxAge;
}

// Clear WMS cache manually
function clearWMSCache() {
    wmsCapabilitiesCache.data = null;
    wmsCapabilitiesCache.timestamp = null;
    wmsCapabilitiesCache.isLoading = false;
    console.log('WMS capabilities cache cleared');
}

// Get cache info for debugging
function getWMSCacheInfo() {
    return {
        hasData: !!wmsCapabilitiesCache.data,
        layerCount: wmsCapabilitiesCache.data ? wmsCapabilitiesCache.data.length : 0,
        timestamp: wmsCapabilitiesCache.timestamp,
        isValid: isWMSCacheValid(),
        isLoading: wmsCapabilitiesCache.isLoading,
        ageMinutes: wmsCapabilitiesCache.timestamp ? 
            Math.round((Date.now() - wmsCapabilitiesCache.timestamp) / 60000) : null
    };
}

// Enhanced ArcGIS REST Pagination Configuration
const ARCGIS_PAGINATION_CONFIG = {
    defaultBatchSize: 2000,        // Default records per request
    maxBatchSize: 2000,            // Maximum records per request
    maxRequests: 200,              // Safety limit for total requests
    delayBetweenBatches: 100,      // Delay (ms) between requests after every 10 batches
    retryAttempts: 3               // Number of retry attempts for failed requests
};

// Initialize module
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupWebUrlLoad();
    setupWMSCapabilities();
    setupDragAndDrop();
});

// File Upload Setup
function setupFileUpload() {
    const uploadBtn = document.getElementById('uploadFileBtn');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('uploadFileList');
    const listContainer = fileList.querySelector('ul');
    
    // Handle button click
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files);
        
        // Clear previous list
        listContainer.innerHTML = '';
        
        // Validate files
        const validFiles = files.filter(file => {
            const isValidSize = file.size <= MAX_FILE_SIZE;
            const isValidType = SUPPORTED_EXTENSIONS.some(ext => 
                file.name.toLowerCase().endsWith(ext)
            ) || SUPPORTED_MIME_TYPES.includes(file.type);
            
            // Add to list with appropriate icon
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2 text-xs';
            
            if (!isValidSize) {
                li.innerHTML = `<i class="fas fa-times-circle text-red-500"></i>${file.name} (Too large)`;
            } else if (!isValidType) {
                li.innerHTML = `<i class="fas fa-times-circle text-red-500"></i>${file.name} (Unsupported type)`;
            } else {
                li.innerHTML = `<i class="fas fa-check-circle text-green-500"></i>${file.name}`;
            }
            
            listContainer.appendChild(li);
            
            return isValidSize && isValidType;
        });
        
        // Show file list
        fileList.style.display = validFiles.length > 0 ? 'block' : 'none';
        
        // Process valid files
        if (validFiles.length > 0) {
            try {
                await processFiles(validFiles);
                fileInput.value = ''; // Reset input
                fileList.style.display = 'none'; // Hide list
                // Files processed successfully
            } catch (error) {
                console.error('Error processing files:', error);
                await showError('Failed to process files. Please try again.', 'Error');
            }
        } else {
            await showWarning('No valid files selected.', 'Invalid Files');
        }
    });
}

// Web URL Load Setup
function setupWebUrlLoad() {
    const loadBtn = document.getElementById('loadUrlBtn');
    const urlInput = document.getElementById('webUrlInput');
    const progress = document.getElementById('urlLoadProgress');
    const progressBar = document.getElementById('urlLoadProgressBar');
    const progressText = document.getElementById('urlLoadPercentage');
    const statusText = document.getElementById('urlLoadStatus');
    const detailsDiv = document.getElementById('urlLoadDetails');
    const paginationStatus = document.getElementById('paginationStatus');
    
    loadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        
        if (!url) {
            await showWarning('Please enter a URL.', 'URL Required');
            return;
        }
        
        // Disable button while processing
        loadBtn.disabled = true;
        loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        
        try {
            // Check if this is an ArcGIS REST service URL
            if (isArcGISRestUrl(url)) {
                await handleArcGISRestUrl(url, progress, progressBar, progressText, statusText, detailsDiv, paginationStatus);
            } else {
                // Try to load as standard URL (removed extension validation)
                await handleStandardUrl(url, progress, progressBar, progressText, statusText);
            }
            
            // Clear input on success
            urlInput.value = '';
            // Data loaded successfully
            
        } catch (error) {
            console.error('Error loading URL:', error);
            await showError(error.message || 'Failed to load data from URL. Please try again.', 'Error');
        } finally {
            // Reset button state
            loadBtn.disabled = false;
            loadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>Load from URL';
            progress.style.display = 'none';
        }
    });
}

// Check if URL is an ArcGIS REST service
function isArcGISRestUrl(url) {
    // Accept any URL that looks like an ArcGIS REST service
    const hasService = url.includes('FeatureServer') || url.includes('MapServer');
    const hasRestServices = url.includes('/rest/services/');
    const hasArcGISDomain = ARCGIS_PATTERNS.domain.test(url);
    
    // Must have either service type OR rest/services path OR be from known ArcGIS domain
    return hasService || hasRestServices || hasArcGISDomain;
}

// Handle root FeatureServer/MapServer - discover and load all sublayers
async function handleRootFeatureServer(baseUrl, progress, progressBar, progressText, statusText, detailsDiv, paginationStatus) {
    try {
        // Step 1: Get service metadata to discover all layers
        statusText.textContent = 'Discovering layers...';
        if (paginationStatus) paginationStatus.textContent = 'Fetching service metadata...';
        
        const serviceMetadataUrl = `${baseUrl}?f=json`;
        console.log('Fetching service metadata from:', serviceMetadataUrl);
        
        const metadataResponse = await fetch(serviceMetadataUrl);
        if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch service metadata: HTTP ${metadataResponse.status}`);
        }
        
        const serviceMetadata = await metadataResponse.json();
        console.log('Service metadata:', serviceMetadata);
        
        // Extract layers from service metadata
        const layers = serviceMetadata.layers || [];
        if (layers.length === 0) {
            throw new Error('No layers found in the service');
        }
        
        console.log(`Found ${layers.length} layers in service:`, layers.map(l => `${l.id}: ${l.name}`));
        
        // Update progress
        progressBar.style.width = '10%';
        progressText.textContent = '10%';
        statusText.textContent = `Found ${layers.length} layers`;
        if (paginationStatus) paginationStatus.textContent = `Discovered ${layers.length} sublayers - starting data loading...`;
        
        // Step 2: Load each layer individually
        const totalLayers = layers.length;
        let processedLayers = 0;
        
        for (const layerInfo of layers) {
            try {
                console.log(`Loading layer ${layerInfo.id}: ${layerInfo.name}`);
                
                // Update progress for current layer
                const layerProgress = 10 + ((processedLayers / totalLayers) * 80);
                progressBar.style.width = `${layerProgress}%`;
                progressText.textContent = `${Math.round(layerProgress)}%`;
                statusText.textContent = `Loading ${layerInfo.name}...`;
                if (paginationStatus) {
                    paginationStatus.textContent = `Loading layer ${processedLayers + 1}/${totalLayers}: ${layerInfo.name}`;
                }
                
                // Load this specific layer with full pagination
                await loadSingleFeatureServerLayer(baseUrl, layerInfo.id, layerInfo.name, serviceMetadata.name || 'ArcGIS Service');
                
                processedLayers++;
                console.log(`✅ Successfully loaded layer ${layerInfo.id}: ${layerInfo.name}`);
                
            } catch (layerError) {
                console.error(`❌ Failed to load layer ${layerInfo.id}: ${layerInfo.name}`, layerError);
                // Continue with other layers even if one fails
            }
        }
        
        // Complete progress
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        statusText.textContent = 'Complete!';
        if (paginationStatus) {
            paginationStatus.textContent = `Successfully loaded ${processedLayers}/${totalLayers} layers from service`;
        }
        
        console.log(`🎉 Completed loading ${processedLayers}/${totalLayers} layers from ${baseUrl}`);
        
    } catch (error) {
        console.error('Error loading root FeatureServer:', error);
        throw new Error(`Failed to load FeatureServer: ${error.message}`);
    }
}

// Load a single layer from a FeatureServer with full pagination support
async function loadSingleFeatureServerLayer(baseUrl, layerId, layerName, serviceName) {
    const layerUrl = `${baseUrl}/${layerId}`;
    
    try {
        // Get layer metadata
        const layerMetadataUrl = `${layerUrl}?f=json`;
        const metadataResponse = await fetch(layerMetadataUrl);
        let layerMetadata = { name: layerName };
        
        if (metadataResponse.ok) {
            try {
                layerMetadata = await metadataResponse.json();
            } catch (e) {
                console.warn(`Could not parse metadata for layer ${layerId}, using default`);
            }
        }
        
        // Build query URL for this layer
        const queryUrl = `${layerUrl}/query?where=1=1&outFields=*&f=geojson&resultRecordCount=2000`;
        
        // Fetch all features with pagination
        let allFeatures = [];
        let resultOffset = 0;
        let hasMoreFeatures = true;
        let requestCount = 0;
        let recordCount = ARCGIS_PAGINATION_CONFIG.defaultBatchSize;
        let supportsPagination = true;
        
        // Check if layer supports pagination
        if (layerMetadata.advancedQueryCapabilities && layerMetadata.advancedQueryCapabilities.supportsPagination !== undefined) {
            supportsPagination = layerMetadata.advancedQueryCapabilities.supportsPagination;
        }
        
        // Use service max record count if available
        if (layerMetadata.maxRecordCount) {
            recordCount = Math.min(recordCount, layerMetadata.maxRecordCount, ARCGIS_PAGINATION_CONFIG.maxBatchSize);
        }
        
        console.log(`Loading layer ${layerId} (${layerName}) - Pagination support: ${supportsPagination}, Batch size: ${recordCount}`);
        
        while (hasMoreFeatures) {
            requestCount++;
            
            // Build paginated URL
            let paginatedUrl = queryUrl;
            
            if (resultOffset > 0) {
                paginatedUrl = paginatedUrl.includes('resultOffset=') 
                    ? paginatedUrl.replace(/resultOffset=\d+/, `resultOffset=${resultOffset}`)
                    : `${paginatedUrl}&resultOffset=${resultOffset}`;
            }
            
            paginatedUrl = paginatedUrl.includes('resultRecordCount=') 
                ? paginatedUrl.replace(/resultRecordCount=\d+/, `resultRecordCount=${recordCount}`)
                : `${paginatedUrl}&resultRecordCount=${recordCount}`;
            
            if (!supportsPagination && requestCount === 1) {
                paginatedUrl = `${paginatedUrl}&returnExceededLimitFeatures=true`;
            }
            
            console.log(`  Fetching batch ${requestCount} from offset ${resultOffset} for layer ${layerId}`);
            
            const response = await fetch(paginatedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data for layer ${layerId}: HTTP ${response.status}`);
            }
            
            const batchData = await response.json();
            
            // Handle different response formats
            let features = [];
            if (batchData.type === 'FeatureCollection' && Array.isArray(batchData.features)) {
                features = batchData.features;
            } else if (Array.isArray(batchData.features)) {
                features = batchData.features;
            } else if (batchData.error) {
                throw new Error(`Layer ${layerId} returned error: ${batchData.error.message}`);
            }
            
            allFeatures = allFeatures.concat(features);
            console.log(`  Layer ${layerId} batch ${requestCount}: Retrieved ${features.length} features (Total: ${allFeatures.length})`);
            
            // Check for more features
            if (supportsPagination) {
                hasMoreFeatures = batchData.exceededTransferLimit === true && features.length > 0;
                if (hasMoreFeatures) {
                    resultOffset += features.length;
                }
            } else {
                hasMoreFeatures = false;
                if (batchData.exceededTransferLimit === true) {
                    console.warn(`Layer ${layerId} exceeded transfer limit but does not support pagination. Some features may be missing.`);
                }
            }
            
            // Safety check
            if (requestCount > ARCGIS_PAGINATION_CONFIG.maxRequests) {
                console.warn(`Layer ${layerId}: Reached maximum number of requests (${ARCGIS_PAGINATION_CONFIG.maxRequests}). Stopping pagination.`);
                break;
            }
            
            // Small delay between requests
            if (hasMoreFeatures && requestCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, ARCGIS_PAGINATION_CONFIG.delayBetweenBatches));
            }
        }
        
        // Only create layer if we have features
        if (allFeatures.length > 0) {
            // Create GeoJSON
            const geoJson = {
                type: 'FeatureCollection',
                features: allFeatures
            };
            
            // Generate display name
            const displayName = `AGOL - ${serviceName} - ${layerName}`;
            const timestamp = new Date().toISOString().split('T')[0];
            const finalDisplayName = `${displayName} (${timestamp})`;
            
            console.log(`✅ Layer ${layerId} (${layerName}): Fetched ${allFeatures.length} features in ${requestCount} batch(es)`);
            
            // Add to map
            await addDataToMap(geoJson, finalDisplayName, false, null, false, {
                source: 'arcgis',
                serviceUrl: `${baseUrl}/${layerId}`,
                metadata: layerMetadata,
                isUrlBased: true,
                layerId: layerId,
                serviceName: serviceName
            });
        } else {
            console.warn(`⚠️ Layer ${layerId} (${layerName}): No features found`);
        }
        
    } catch (error) {
        console.error(`Error loading layer ${layerId}:`, error);
        throw error;
    }
}

// Handle ArcGIS REST service URL
async function handleArcGISRestUrl(url, progress, progressBar, progressText, statusText, detailsDiv, paginationStatus) {
    // Show progress
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    statusText.textContent = 'Initializing...';
    if (detailsDiv) detailsDiv.style.display = 'block';
    if (paginationStatus) paginationStatus.textContent = 'Connecting to ArcGIS service...';
    
    // Check if this is a root FeatureServer/MapServer URL (no layer index)
    const baseUrl = url.split('?')[0];
    const isRootService = (baseUrl.endsWith('/FeatureServer') || baseUrl.endsWith('/MapServer')) && !/\/\d+$/.test(baseUrl);
    
    if (isRootService) {
        // Handle root service - discover and load all sublayers
        await handleRootFeatureServer(baseUrl, progress, progressBar, progressText, statusText, detailsDiv, paginationStatus);
        return;
    }
    
    // Build query URL if needed for single layer
    let queryUrl = url;
    if (!ARCGIS_PATTERNS.query.test(url)) {
        // Remove any existing parameters and add our query parameters
        // Ensure the URL ends with a layer number (e.g., /0, /1, etc.)
        if (!/\/\d+$/.test(baseUrl)) {
            // If no layer number specified, default to /0
            queryUrl = `${baseUrl}/0/query?where=1=1&outFields=*&f=geojson&resultRecordCount=2000`;
        } else {
            queryUrl = `${baseUrl}/query?where=1=1&outFields=*&f=geojson&resultRecordCount=2000`;
        }
    }
    
    try {
        // Fetch metadata first to get layer name
        let metadataUrl;
        if (url.includes('?')) {
            // URL already has parameters, add f=json
            metadataUrl = url + '&f=json';
        } else {
            // No parameters, add f=json
            metadataUrl = url + '?f=json';
        }
        
        console.log('Fetching metadata from:', metadataUrl);
        const metadataResponse = await fetch(metadataUrl);
        
        if (!metadataResponse.ok) {
            console.warn('Failed to fetch metadata, will use generic name');
            // Continue without metadata
            var metadata = { name: 'ArcGIS Layer' };
        } else {
            const responseText = await metadataResponse.text();
            try {
                metadata = JSON.parse(responseText);
            } catch (parseError) {
                console.warn('Failed to parse metadata JSON, using generic name');
                metadata = { name: 'ArcGIS Layer' };
            }
        }
        
        // Update progress
        progressBar.style.width = '20%';
        progressText.textContent = '20%';
        statusText.textContent = 'Analyzing service...';
        if (paginationStatus) paginationStatus.textContent = 'Service metadata retrieved';
        
        // Fetch all features with enhanced pagination support
        console.log('Fetching features from:', queryUrl);
        let allFeatures = [];
        let resultOffset = 0;
        let hasMoreFeatures = true;
        let requestCount = 0;
        let recordCount = ARCGIS_PAGINATION_CONFIG.defaultBatchSize;
        let supportsPagination = true;
        let totalFeaturesEstimate = null;
        
        // First, try to get service metadata to check pagination support
        try {
            const serviceMetadataUrl = url.split('?')[0].replace(/\/\d+$/, '') + '?f=json';
            const serviceResponse = await fetch(serviceMetadataUrl);
            if (serviceResponse.ok) {
                const serviceInfo = await serviceResponse.json();
                if (serviceInfo.hasOwnProperty('supportsPagination')) {
                    supportsPagination = serviceInfo.supportsPagination;
                    console.log('Service supports pagination:', supportsPagination);
                }
                if (serviceInfo.maxRecordCount) {
                    recordCount = Math.min(recordCount, serviceInfo.maxRecordCount, ARCGIS_PAGINATION_CONFIG.maxBatchSize);
                    console.log('Using service maxRecordCount:', recordCount);
                }
            }
        } catch (error) {
            console.warn('Could not fetch service metadata, proceeding with default pagination');
        }
        
        while (hasMoreFeatures) {
            requestCount++;
            
            // Build URL with offset and record count for pagination
            let paginatedUrl = queryUrl;
            
            // Update or add pagination parameters
            if (resultOffset > 0) {
                paginatedUrl = paginatedUrl.includes('resultOffset=') 
                    ? paginatedUrl.replace(/resultOffset=\d+/, `resultOffset=${resultOffset}`)
                    : `${paginatedUrl}&resultOffset=${resultOffset}`;
            }
            
            // Ensure we have the right record count
            paginatedUrl = paginatedUrl.includes('resultRecordCount=') 
                ? paginatedUrl.replace(/resultRecordCount=\d+/, `resultRecordCount=${recordCount}`)
                : `${paginatedUrl}&resultRecordCount=${recordCount}`;
            
            // For services that don't support pagination, try returnExceededLimitFeatures
            if (!supportsPagination && requestCount === 1) {
                paginatedUrl = `${paginatedUrl}&returnExceededLimitFeatures=true`;
                console.log('Service does not support pagination, trying returnExceededLimitFeatures=true');
            }
            
            console.log(`Fetching batch ${requestCount} from offset ${resultOffset} (batch size: ${recordCount}):`, paginatedUrl);
            
            // Update progress with more detailed information
            const progressPercent = Math.min(20 + (requestCount * 10), 75);
            progressBar.style.width = `${progressPercent}%`;
            progressText.textContent = `${progressPercent}%`;
            statusText.textContent = `Fetching batch ${requestCount}...`;
            if (paginationStatus) {
                paginationStatus.textContent = `Loading features (offset: ${resultOffset}, batch: ${recordCount}, total: ${allFeatures.length})`;
            }
            
            const response = await fetch(paginatedUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch data from ArcGIS REST service (HTTP ${response.status})`);
            }
            
            const responseText = await response.text();
            let batchData;
            try {
                batchData = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error('Service returned invalid JSON. This may not be a valid ArcGIS REST service endpoint.');
            }
            
            // Handle different response formats (GeoJSON vs ESRI JSON)
            let features = [];
            if (batchData.type === 'FeatureCollection' && Array.isArray(batchData.features)) {
                // GeoJSON format
                features = batchData.features;
            } else if (Array.isArray(batchData.features)) {
                // ESRI JSON format - convert to GeoJSON if needed
                features = batchData.features;
            } else {
                throw new Error('Invalid response format from ArcGIS REST service');
            }
            
            // Add features to collection
            allFeatures = allFeatures.concat(features);
            console.log(`Batch ${requestCount}: Retrieved ${features.length} features (Total: ${allFeatures.length})`);
            
            // Check if there are more features to fetch
            if (supportsPagination) {
                // For paginated services, check exceededTransferLimit
                hasMoreFeatures = batchData.exceededTransferLimit === true && features.length > 0;
                
                if (hasMoreFeatures) {
                    resultOffset += features.length;
                }
            } else {
                // For non-paginated services, we should have all features in the first request
                hasMoreFeatures = false;
                if (batchData.exceededTransferLimit === true) {
                    console.warn('Service exceeded transfer limit but does not support pagination. Some features may be missing.');
                }
            }
            
            // Update progress with better estimation
            if (!hasMoreFeatures) {
                progressBar.style.width = '80%';
                progressText.textContent = '80%';
                statusText.textContent = 'Processing features...';
                if (paginationStatus) {
                    paginationStatus.textContent = `Retrieved ${allFeatures.length} features in ${requestCount} batches - Processing...`;
                }
            }
            
            // Safety check to prevent infinite loops
            if (requestCount > ARCGIS_PAGINATION_CONFIG.maxRequests) {
                console.warn(`Reached maximum number of requests (${ARCGIS_PAGINATION_CONFIG.maxRequests}). Stopping pagination.`);
                break;
            }
            
            // Small delay between requests to be respectful to the server
            if (hasMoreFeatures && requestCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, ARCGIS_PAGINATION_CONFIG.delayBetweenBatches));
            }
        }
        
        // Create final GeoJSON with all features
        const geoJson = {
            type: 'FeatureCollection',
            features: allFeatures
        };
        
        console.log(`✅ Successfully fetched all ${allFeatures.length} features in ${requestCount} batch(es)`);
        
        // Update progress
        progressBar.style.width = '85%';
        progressText.textContent = '85%';
        statusText.textContent = 'Creating layer...';
        if (paginationStatus) {
            paginationStatus.textContent = `Processing ${allFeatures.length} features into map layer...`;
        }
        
        // Generate layer name
        const layerName = metadata.name || 'ArcGIS Layer';
        const timestamp = new Date().toISOString().split('T')[0];
        const displayName = `AGOL - ${layerName} (${timestamp})`;
        
        // Add to map (mark as URL-based to prevent database saving)
        await addDataToMap(geoJson, displayName, false, null, false, {
            source: 'arcgis',
            serviceUrl: url,
            metadata: metadata,
            isUrlBased: true
        });
        
        // Complete progress
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        statusText.textContent = 'Complete!';
        if (paginationStatus) {
            paginationStatus.textContent = `Successfully loaded ${allFeatures.length} features from ${requestCount} batch${requestCount > 1 ? 'es' : ''}`;
        }
        
    } catch (error) {
        throw new Error(`ArcGIS REST service error: ${error.message}`);
    }
}

// Handle standard URL (GeoJSON, KML, etc.)
async function handleStandardUrl(url, progress, progressBar, progressText, statusText) {
    // Show progress
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    if (statusText) statusText.textContent = 'Downloading...';
    
    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: HTTP ${response.status} ${response.statusText}`);
        }
        
        // Check content type
        const contentType = response.headers.get('content-type') || '';
        console.log('Content-Type:', contentType);
        
        const reader = response.body.getReader();
        const contentLength = +response.headers.get('Content-Length');
        
        let receivedLength = 0;
        let chunks = [];
        
        while(true) {
            const {done, value} = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            receivedLength += value.length;
            
            // Update progress
            const progress = (receivedLength / contentLength) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
        }
        
        // Combine chunks
        let data = new Uint8Array(receivedLength);
        let position = 0;
        for(let chunk of chunks) {
            data.set(chunk, position);
            position += chunk.length;
        }
        
        // Convert to text
        const content = new TextDecoder('utf-8').decode(data);
        
        // Check if content looks like HTML (common error response)
        if (content.trim().toLowerCase().startsWith('<html') || content.trim().toLowerCase().startsWith('<!doctype html')) {
            throw new Error('URL returned HTML instead of data. Please check if the URL is correct and points to a data endpoint.');
        }
        
        // Process based on file type or content type
        let fileExtension = url.split('.').pop().toLowerCase();
        
        // If no extension, try to guess from content type
        if (!fileExtension || fileExtension === url) {
            if (contentType.includes('json')) {
                fileExtension = 'geojson';
            } else if (contentType.includes('xml')) {
                fileExtension = 'kml';
            } else {
                // Default to geojson for unknown types
                fileExtension = 'geojson';
            }
        }
        
        // Update status for processing
        if (statusText) statusText.textContent = 'Processing data...';
        progressBar.style.width = '90%';
        progressText.textContent = '90%';
        
        const geoData = await parseDataByType(content, fileExtension);
        
        // Final update
        if (statusText) statusText.textContent = 'Complete!';
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
        // Add to map (mark as URL-based to prevent database saving)
        await addDataToMap(geoData, url.split('/').pop(), false, null, false, {
            source: 'url',
            sourceUrl: url,
            isUrlBased: true
        });
        
    } catch (error) {
        throw new Error(`Failed to load URL: ${error.message}`);
    }
}

// Drag and Drop Setup
function setupDragAndDrop() {
    const dropZone = document.getElementById('add-data-panel');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop zone
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        dropZone.classList.add('bg-blue-500', 'bg-opacity-10');
    }
    
    function unhighlight(e) {
        dropZone.classList.remove('bg-blue-500', 'bg-opacity-10');
    }
    
    // Handle drop
    dropZone.addEventListener('drop', handleDrop, false);
    
    async function handleDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    }
}

// Process Files
async function processFiles(files) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressText = document.getElementById('uploadPercentage');
    
    uploadProgress.style.display = 'block';
    let processedCount = 0;
    
    for (const file of files) {
        try {
            // Update progress
            const progress = (processedCount / files.length) * 100;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${Math.round(progress)}%`;
            
            // Read and parse file
            const content = await readFile(file);
            const fileExtension = file.name.split('.').pop().toLowerCase();
            const geoData = await parseDataByType(content, fileExtension);
            
            // Add to map
            await addDataToMap(geoData, file.name);
            
            processedCount++;
            
        } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            await showError(`Failed to process ${file.name}`, 'File Error');
        }
    }
    
    // Hide progress
    uploadProgress.style.display = 'none';
}

// Read File
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        
        if (file.name.toLowerCase().endsWith('.kmz')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
}

// Parse Data by Type
async function parseDataByType(content, fileType) {
    switch (fileType.toLowerCase()) {
        case 'geojson':
        case 'json':
            return JSON.parse(content);
            
        case 'kml':
            const parser = new DOMParser();
            const kmlDoc = parser.parseFromString(content, 'text/xml');
            return toGeoJSON.kml(kmlDoc);
            
        case 'kmz':
            // Load JSZip if needed
            if (typeof JSZip === 'undefined') {
                await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
            }
            
            const zip = await JSZip.loadAsync(content);
            let kmlFile = null;
            
            // Find first KML file
            zip.forEach((path, entry) => {
                if (path.toLowerCase().endsWith('.kml')) {
                    kmlFile = entry;
                }
            });
            
            if (!kmlFile) {
                throw new Error('No KML file found in KMZ archive');
            }
            
            const kmlText = await kmlFile.async('string');
            const kmlParser = new DOMParser();
            const kmzDoc = kmlParser.parseFromString(kmlText, 'text/xml');
            return toGeoJSON.kml(kmzDoc);
            
        case 'gpx':
            const gpxParser = new DOMParser();
            const gpxDoc = gpxParser.parseFromString(content, 'text/xml');
            return toGeoJSON.gpx(gpxDoc);
            
        case 'csv':
            return convertCSVtoGeoJSON(content);
            
        default:
            throw new Error(`Unsupported file type: ${fileType}`);
    }
}

// Convert CSV to GeoJSON
function convertCSVtoGeoJSON(csvContent) {
    // Load Papa Parse if needed
    if (typeof Papa === 'undefined') {
        throw new Error('Papa Parse is required for CSV conversion');
    }
    
    const result = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
    });
    
    // Try to find lat/lon columns
    const headers = Object.keys(result.data[0]);
    const latColumn = headers.find(h => /^(lat|latitude)$/i.test(h));
    const lonColumn = headers.find(h => /^(lon|lng|longitude)$/i.test(h));
    
    if (!latColumn || !lonColumn) {
        throw new Error('CSV must contain latitude and longitude columns');
    }
    
    // Convert to GeoJSON
    const features = result.data.map(row => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [parseFloat(row[lonColumn]), parseFloat(row[latColumn])]
        },
        properties: row
    }));
    
    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Add Data to Map
async function addDataToMap(geoData, fileName, fromDatabase = false, databaseId = null, isPermanent = false, options = {}) {
    if (!geoData || !geoData.features || geoData.features.length === 0) {
        throw new Error('Invalid or empty GeoJSON data');
    }
    
    // Generate unique layer ID
    const layerId = options.source === 'arcgis' 
        ? `agol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const layerName = fileName.split('.')[0];
    
    // Check if any layer with this name already exists in map view (prevents duplicates on refresh)
    const existingLayer = Array.from(window.layers.values()).find(l => l.name === layerName);
    if (existingLayer) {
        console.log(`Layer "${layerName}" already exists in map view, skipping duplicate`);
        return existingLayer.layerId;
    }
    
    // Generate style (use blue for ArcGIS layers)
    const defaultStyle = options.source === 'arcgis' ? {
        fillColor: '#3388ff',
        color: '#3388ff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.2
    } : {
        fillColor: `hsl(${Math.random() * 360}, 70%, 70%)`,
        color: `hsl(${Math.random() * 360}, 70%, 40%)`,
        weight: 2,
        opacity: 1,
        fillOpacity: 1.0
    };
    
    // Create Leaflet layer
    const newLayer = L.geoJSON(geoData, {
        renderer: L.canvas(), // Force canvas rendering for export compatibility
        style: defaultStyle,
        pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
                radius: 8,
                ...defaultStyle
            });
        },
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                let popupContent = '<div class="modern-popup-container">';
                popupContent += '<div class="modern-popup-header">';
                popupContent += `<i class="fas fa-${options.source === 'arcgis' ? 'globe' : 'info-circle'} mr-2"></i>${layerName}</div>`;
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
                
                layer.bindPopup(popupContent);
            }
        }
    }).addTo(map);
    
    // Track layer loading for loading overlay
    if (typeof window.trackLayerLoading === 'function') {
        window.trackLayerLoading(layer, layerId);
    }
    
    // Critical safeguard: Never save permanent layers to database
    if (isPermanent || layerName === 'Aera' || layerName === 'Proximity Roads' || layerName.endsWith('_permanent')) {
        console.log(`🚫 Detected permanent layer "${layerName}" - will not be saved to database`);
        isPermanent = true;
    }
    
    // URL-based layers should not be saved to database but can be deleted/renamed
    if (options.isUrlBased) {
        console.log(`🌐 URL-based layer "${layerName}" - will not be saved to database but supports full interactions`);
    }

    // Add to layers registry
    window.layers.set(layerId, {
        layer: newLayer,
        name: layerName,
        visible: true,
        data: geoData,
        originalData: geoData,
        style: defaultStyle,
        isPermanent: isPermanent,
        isUserGenerated: !isPermanent, // Only permanent layers are not user-generated
        isUrlBased: options.isUrlBased || false,
        fromDatabase: fromDatabase,
        databaseId: databaseId,
        layerId: layerId,
        sourceType: options.source || 'upload',
        metadata: options.metadata || null,
        serviceUrl: options.serviceUrl || options.sourceUrl || null,
        createdAt: new Date().toISOString()
    });
    
    // Add to layer order (at the top)
    window.layerOrder.unshift(layerId);
    
    // Update UI
    updateLayersList();
    updateLegend();
    
    // Update map layer order for proper z-index stacking
    if (window.updateMapLayerOrder) {
        window.updateMapLayerOrder();
    }
    
    // Zoom to layer
    map.fitBounds(newLayer.getBounds(), {
        padding: [50, 50]
    });
    
    // Save to Supabase layers table (only for non-permanent, non-URL-based layers)
    if (!fromDatabase && !isPermanent && !options.isUrlBased && window.supabase && window.currentUser) {
        try {
            console.log(`💾 Saving dynamic layer "${layerName}" to Supabase layers table...`);
            const success = await saveDynamicLayerToDatabase(layerId, layerName, geoData);
            if (success) {
                console.log(`✅ Dynamic layer "${layerName}" saved to database successfully`);
                // Update UI to reflect database status
                updateLayersList();
            } else {
                console.warn(`⚠️ Failed to save dynamic layer "${layerName}" to database`);
                showNotification(`Layer "${layerName}" created locally but could not be saved to database`, 'warning');
            }
        } catch (error) {
            console.error('Error saving dynamic layer to database:', error);
            showNotification(`Layer "${layerName}" created but failed to save to database: ${error.message}`, 'warning');
        }
    } else if (options.isUrlBased) {
        console.log(`✅ URL-based layer "${layerName}" loaded successfully (not saved to database)`);
    } else if (isPermanent) {
        console.log(`✅ Permanent layer "${layerName}" loaded successfully (not saved to database)`);
    } else if (fromDatabase) {
        console.log(`✅ Database layer "${layerName}" loaded successfully`);
    } else {
        console.warn('⚠️ Supabase or user not available - layer not saved to database');
        showNotification(`Layer "${layerName}" created locally only`, 'info');
    }
    
    // Update filter system with new layer
    setTimeout(() => {
        if (typeof populateFilterLayers === 'function') {
            populateFilterLayers();
        }
    }, 100);
}

// Create new layer from GeoJSON data
function createNewLayer(geoData, layerName) {
    try {
        // Generate unique layer ID
        const layerId = `layer_${Date.now()}`;
        
        // Create layer with canvas renderer
        const newLayer = createCanvasLayer(geoData, {
            style: feature => ({
                color: '#3388ff',
                weight: 2,
                opacity: 1,
                fillColor: '#3388ff',
                fillOpacity: 0.2
            }),
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: '#3388ff',
                    color: '#fff',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 1.0
                });
            },
            onEachFeature: (feature, layer) => {
                // Add popup with properties
                const props = feature.properties;
                if (props) {
                    const content = Object.entries(props)
                        .map(([key, value]) => {
                            const val = value || 'N/A';
                            
                            // Check if the field name suggests a link or if the value looks like a URL
                            const isLinkField = key.toLowerCase().includes('link') || 
                                               key.toLowerCase().includes('url') || 
                                               key.toLowerCase().includes('document');
                            const isUrlValue = typeof val === 'string' && 
                                              (val.startsWith('http://') || val.startsWith('https://') || val.startsWith('www.'));
                            
                            let displayValue = val;
                            if ((isLinkField || isUrlValue) && val !== 'N/A') {
                                // Make the value clickable
                                const href = val.startsWith('www.') ? `https://${val}` : val;
                                displayValue = `<a href="${href}" target="_blank" rel="noopener noreferrer" class="popup-link">${val}</a>`;
                            }
                            
                            return `<strong>${key}:</strong> ${displayValue}`;
                        })
                        .join('<br>');
                    layer.bindPopup(content);
                }
            }
        });
        
        // Add layer info to registry
        window.layers.set(layerId, {
            id: layerId,
            name: layerName,
            layer: newLayer,
            visible: true,
            data: geoData,
            style: newLayer.options.style
        });
        
        // Add to layer order (at the top for consistency with other layers)
        window.layerOrder.unshift(layerId);
        
        // Add to map
        newLayer.addTo(window.map);
        
        // Track layer loading for loading overlay
        if (typeof window.trackLayerLoading === 'function') {
            window.trackLayerLoading(newLayer, layerId);
        }
        
        // Update layer panel and map layer order
        updateLayersList();
        if (window.updateMapLayerOrder) {
            window.updateMapLayerOrder();
        }
        
        // Bind context menu handlers for the new layer
        if (typeof window.bindContextMenuToLayers === 'function') {
            window.bindContextMenuToLayers();
        }
        
        return layerId;
        
    } catch (error) {
        console.error('Error creating layer:', error);
        throw error;
    }
}

// Helper: Load external script
function loadScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// WMS Capabilities Setup
function setupWMSCapabilities() {
    const wmsBtn = document.getElementById('loadWMSCapabilitiesBtn');
    const refreshBtn = document.getElementById('refreshWMSCapabilitiesBtn');
    
    if (wmsBtn) {
        wmsBtn.addEventListener('click', async () => {
            await loadWMSCapabilities();
            // Show refresh button after first load
            if (refreshBtn && wmsCapabilitiesCache.data) {
                refreshBtn.classList.remove('hidden');
            }
        });
    }
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            // Clear cache and reload
            wmsCapabilitiesCache.data = null;
            wmsCapabilitiesCache.timestamp = null;
            await loadWMSCapabilities();
        });
    }
}

// Load and parse WMS GetCapabilities (with caching)
async function loadWMSCapabilities() {
    const progressBar = document.getElementById('wmsLoadProgressBar');
    const progressText = document.getElementById('wmsLoadPercentage');
    const statusText = document.getElementById('wmsLoadStatus');
    const progress = document.getElementById('wmsLoadProgress');
    const layersList = document.getElementById('wmsLayersList');
    const layersContainer = document.getElementById('wmsLayersContainer');
    
    try {
        // Check if we have valid cached data
        if (isWMSCacheValid()) {
            // Use cached data - show UI immediately
            if (statusText) statusText.textContent = 'Loading from cache...';
            buildWMSLayersUI(wmsCapabilitiesCache.data, layersList, layersContainer);
            if (layersContainer) layersContainer.style.display = 'block';
            return;
        }
        
        // Prevent multiple simultaneous requests
        if (wmsCapabilitiesCache.isLoading) {
            if (statusText) statusText.textContent = 'Loading in progress...';
            return;
        }
        
        wmsCapabilitiesCache.isLoading = true;
        
        // Show progress
        if (progress) progress.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (statusText) statusText.textContent = 'Fetching WMS capabilities...';
        
        // Fetch capabilities with CORS handling
        const response = await fetch(WMS_CONFIG.philippineGeoportalUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/xml, text/xml'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch WMS capabilities: HTTP ${response.status} - ${response.statusText}`);
        }
        
        // Update progress
        if (progressBar) progressBar.style.width = '30%';
        if (progressText) progressText.textContent = '30%';
        if (statusText) statusText.textContent = 'Parsing capabilities...';
        
        const capabilitiesXML = await response.text();
        
        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(capabilitiesXML, 'text/xml');
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Failed to parse WMS capabilities XML');
        }
        
        // Update progress
        if (progressBar) progressBar.style.width = '60%';
        if (progressText) progressText.textContent = '60%';
        if (statusText) statusText.textContent = 'Extracting layers...';
        
        // Extract layers
        const layers = parseWMSLayers(xmlDoc);
        
        // Cache the data
        wmsCapabilitiesCache.data = layers;
        wmsCapabilitiesCache.timestamp = Date.now();
        
        // Update progress
        if (progressBar) progressBar.style.width = '90%';
        if (progressText) progressText.textContent = '90%';
        if (statusText) statusText.textContent = 'Building interface...';
        
        // Build and show UI
        buildWMSLayersUI(layers, layersList, layersContainer);
        
        // Complete progress
        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '100%';
        if (statusText) statusText.textContent = 'Complete!';
        if (layersContainer) layersContainer.style.display = 'block';
        
        // Hide progress after a delay
        setTimeout(() => {
            if (progress) progress.style.display = 'none';
        }, 1500);
        
    } catch (error) {
        console.error('Error loading WMS capabilities:', error);
        if (statusText) statusText.textContent = 'Error loading capabilities';
        
        let errorMessage = error.message;
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            errorMessage = 'Unable to connect to Philippine Geoportal WMS service. This may be due to CORS restrictions or network issues.';
        }
        
        await showError(`Failed to load WMS capabilities: ${errorMessage}`, 'WMS Error');
        
        // Hide progress on error
        setTimeout(() => {
            if (progress) progress.style.display = 'none';
        }, 2000);
    } finally {
        wmsCapabilitiesCache.isLoading = false;
    }
}

// Parse WMS layers from capabilities XML
function parseWMSLayers(xmlDoc) {
    const layers = [];
    
    // Get all Layer elements (skip the root layer which is typically a container)
    const layerElements = xmlDoc.querySelectorAll('Layer');
    
    layerElements.forEach(layerEl => {
        const name = layerEl.querySelector('Name');
        const title = layerEl.querySelector('Title');
        const abstract = layerEl.querySelector('Abstract');
        
        // Only include layers that have a Name (queryable layers)
        if (name && name.textContent.trim()) {
            // Get bounding box information
            let bbox = null;
            const bboxEl = layerEl.querySelector('BoundingBox[CRS="EPSG:4326"], BoundingBox[SRS="EPSG:4326"]');
            if (bboxEl) {
                bbox = {
                    minx: parseFloat(bboxEl.getAttribute('minx')),
                    miny: parseFloat(bboxEl.getAttribute('miny')),
                    maxx: parseFloat(bboxEl.getAttribute('maxx')),
                    maxy: parseFloat(bboxEl.getAttribute('maxy'))
                };
            }
            
            // Get CRS/SRS information
            const crsElements = layerEl.querySelectorAll('CRS, SRS');
            const supportedCRS = Array.from(crsElements).map(el => el.textContent.trim());
            
            layers.push({
                name: name.textContent.trim(),
                title: title ? title.textContent.trim() : name.textContent.trim(),
                abstract: abstract ? abstract.textContent.trim() : '',
                bbox: bbox,
                supportedCRS: supportedCRS,
                queryable: layerEl.getAttribute('queryable') === '1'
            });
        }
    });
    
    return layers;
}

// Build WMS layers UI
function buildWMSLayersUI(layers, layersList, layersContainer) {
    if (!layersList || !layersContainer) return;
    
    // Clear existing content
    layersList.innerHTML = '';
    
    // Create search input with status
    const searchContainer = document.createElement('div');
    searchContainer.className = 'mb-4';
    searchContainer.innerHTML = `
        <div class="relative">
            <input type="text" id="wmsLayerSearch" 
                   class="w-full px-3 py-2 pr-20 bg-pure-black border border-neon-teal/30 rounded text-light-gray text-sm focus:outline-none focus:ring-1 focus:ring-neon-teal focus:border-neon-teal placeholder:text-gray-500"
                   placeholder="Search ${layers.length} layers..." />
            <div class="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                <span id="wmsLayerCount">${layers.length}</span>
            </div>
        </div>
        <div id="wmsSearchStatus" class="text-xs text-gray-400 mt-1 hidden">
            <i class="fas fa-search mr-1"></i>
            <span id="wmsSearchResults"></span>
        </div>
    `;
    layersList.appendChild(searchContainer);
    
    // Create layers list container
    const listContainer = document.createElement('div');
    listContainer.id = 'wmsLayersListContainer';
    listContainer.className = 'space-y-2 max-h-64 overflow-y-auto';
    layersList.appendChild(listContainer);
    
    // Create action buttons container
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'mt-4 flex gap-2';
    actionsContainer.innerHTML = `
        <button id="addSelectedWMSLayers" 
                class="flex-1 px-4 py-2 bg-neon-teal/20 hover:bg-neon-teal/30 border border-neon-teal/40 hover:border-neon-teal text-white rounded transition-all text-sm font-medium flex items-center justify-center hover:shadow-neon-glow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled>
            <i class="fas fa-plus mr-2"></i>Add Selected (<span id="selectedWMSCount">0</span>)
        </button>
        <button id="selectAllWMSLayers" 
                class="px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 text-white rounded transition-all text-sm font-medium">
            <i class="fas fa-check-double mr-2"></i>All
        </button>
    `;
    layersList.appendChild(actionsContainer);
    
    // Render layers
    renderWMSLayers(layers, listContainer);
    
    // Setup search functionality
    setupWMSSearch(layers, listContainer);
    
    // Setup action buttons
    setupWMSActions(layers);
}

// Global search state
let wmsSearchState = {
    allLayers: [],
    filteredLayers: [],
    renderedLayers: [],
    currentSearchTerm: '',
    renderBatchSize: 50,
    renderIndex: 0
};

// Fast layer filtering with cached search index
function filterWMSLayers(layers, searchTerm) {
    if (!searchTerm) return layers;
    
    const term = searchTerm.toLowerCase();
    return layers.filter(layer => {
        // Create searchable text once per layer
        if (!layer._searchText) {
            layer._searchText = `${layer.name} ${layer.title} ${layer.abstract}`.toLowerCase();
        }
        return layer._searchText.includes(term);
    });
}

// Render WMS layers list with virtual scrolling optimization
function renderWMSLayers(layers, container, searchTerm = '') {
    // Update search state
    wmsSearchState.allLayers = layers;
    wmsSearchState.currentSearchTerm = searchTerm;
    wmsSearchState.filteredLayers = filterWMSLayers(layers, searchTerm);
    wmsSearchState.renderIndex = 0;
    
    // Update search status
    updateWMSSearchStatus(searchTerm, wmsSearchState.filteredLayers.length);
    
    // Clear container
    container.innerHTML = '';
    
    if (wmsSearchState.filteredLayers.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-search mb-2"></i>
                <div class="text-sm">No layers found${searchTerm ? ` for "${searchTerm}"` : ''}</div>
            </div>
        `;
        return;
    }
    
    // Create a wrapper for virtualized content
    const wrapper = document.createElement('div');
    wrapper.className = 'wms-layers-wrapper';
    container.appendChild(wrapper);
    
    // Initial render of first batch
    renderWMSLayersBatch(wrapper);
    
    // Add "Load More" button if needed
    if (wmsSearchState.filteredLayers.length > wmsSearchState.renderBatchSize) {
        addLoadMoreButton(container, wrapper);
    }
    
    // Update selected count
    updateWMSSelectedCount();
}

// Update search status display
function updateWMSSearchStatus(searchTerm, resultCount) {
    const searchStatus = document.getElementById('wmsSearchStatus');
    const searchResults = document.getElementById('wmsSearchResults');
    
    if (searchTerm && searchStatus && searchResults) {
        searchResults.textContent = `${resultCount} layers found`;
        searchStatus.classList.remove('hidden');
    } else if (searchStatus) {
        searchStatus.classList.add('hidden');
    }
}

// Render a batch of layers
function renderWMSLayersBatch(wrapper) {
    const startIndex = wmsSearchState.renderIndex;
    const endIndex = Math.min(startIndex + wmsSearchState.renderBatchSize, wmsSearchState.filteredLayers.length);
    const batch = wmsSearchState.filteredLayers.slice(startIndex, endIndex);
    
    const fragment = document.createDocumentFragment();
    
    batch.forEach(layer => {
        const layerItem = document.createElement('div');
        layerItem.className = 'wms-layer-item p-3 bg-gray-800 rounded border border-gray-600 hover:border-neon-teal/50 transition-all mb-2';
        layerItem.innerHTML = `
            <div class="flex items-start gap-3">
                <input type="checkbox" class="wms-layer-checkbox mt-1" data-layer-name="${layer.name}" />
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-white text-sm truncate" title="${layer.title}">
                        ${layer.title}
                    </div>
                    <div class="text-xs text-neon-teal font-mono truncate" title="${layer.name}">
                        ${layer.name}
                    </div>
                    ${layer.abstract ? `
                        <div class="text-xs text-gray-400 mt-1 line-clamp-2" title="${layer.abstract}">
                            ${layer.abstract}
                        </div>
                    ` : ''}
                    <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        ${layer.queryable ? '<i class="fas fa-search text-green-400" title="Queryable"></i>' : ''}
                        ${layer.bbox ? '<i class="fas fa-map text-blue-400" title="Has spatial bounds"></i>' : ''}
                        <span>${layer.supportedCRS.length} CRS</span>
                    </div>
                </div>
            </div>
        `;
        fragment.appendChild(layerItem);
    });
    
    wrapper.appendChild(fragment);
    wmsSearchState.renderIndex = endIndex;
}

// Add "Load More" button
function addLoadMoreButton(container, wrapper) {
    const existingButton = container.querySelector('.wms-load-more');
    if (existingButton) existingButton.remove();
    
    if (wmsSearchState.renderIndex >= wmsSearchState.filteredLayers.length) return;
    
    const loadMoreButton = document.createElement('button');
    loadMoreButton.className = 'wms-load-more w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 text-white rounded transition-all text-sm font-medium mt-2';
    loadMoreButton.innerHTML = `
        <i class="fas fa-chevron-down mr-2"></i>
        Load More (${wmsSearchState.filteredLayers.length - wmsSearchState.renderIndex} remaining)
    `;
    
    loadMoreButton.addEventListener('click', () => {
        renderWMSLayersBatch(wrapper);
        if (wmsSearchState.renderIndex >= wmsSearchState.filteredLayers.length) {
            loadMoreButton.remove();
        } else {
            loadMoreButton.innerHTML = `
                <i class="fas fa-chevron-down mr-2"></i>
                Load More (${wmsSearchState.filteredLayers.length - wmsSearchState.renderIndex} remaining)
            `;
        }
    });
    
    container.appendChild(loadMoreButton);
}

// Setup WMS search functionality with debouncing
function setupWMSSearch(layers, container) {
    const searchInput = document.getElementById('wmsLayerSearch');
    if (!searchInput) return;
    
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim();
        
        // Clear previous timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Debounce search for performance (100ms delay)
        searchTimeout = setTimeout(() => {
            renderWMSLayers(layers, container, searchTerm);
        }, 100);
    });
    
    // Immediate search on Enter key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (searchTimeout) clearTimeout(searchTimeout);
            const searchTerm = e.target.value.trim();
            renderWMSLayers(layers, container, searchTerm);
        }
    });
}

// Setup WMS action buttons
function setupWMSActions(layers) {
    const addButton = document.getElementById('addSelectedWMSLayers');
    const selectAllButton = document.getElementById('selectAllWMSLayers');
    
    if (addButton) {
        addButton.addEventListener('click', async () => {
            await addSelectedWMSLayers(layers);
        });
    }
    
    if (selectAllButton) {
        selectAllButton.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.wms-layer-checkbox');
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(cb => {
                cb.checked = !allChecked;
                updateWMSLayerSelection(cb);
            });
            
            updateWMSSelectedCount();
            selectAllButton.innerHTML = allChecked ? 
                '<i class="fas fa-check-double mr-2"></i>All' : 
                '<i class="fas fa-square mr-2"></i>None';
        });
    }
    
    // Setup checkbox change listeners
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('wms-layer-checkbox')) {
            updateWMSSelectedCount();
            updateWMSLayerSelection(e.target);
        }
    });
}

// Update WMS layer visual selection state
function updateWMSLayerSelection(checkbox) {
    const layerItem = checkbox.closest('.wms-layer-item');
    if (!layerItem) return;
    
    if (checkbox.checked) {
        layerItem.classList.add('selected');
    } else {
        layerItem.classList.remove('selected');
    }
}

// Update selected WMS layers count
function updateWMSSelectedCount() {
    const checkboxes = document.querySelectorAll('.wms-layer-checkbox:checked');
    const count = checkboxes.length;
    const countElement = document.getElementById('selectedWMSCount');
    const addButton = document.getElementById('addSelectedWMSLayers');
    
    if (countElement) countElement.textContent = count;
    if (addButton) addButton.disabled = count === 0;
}

// Add selected WMS layers to map
async function addSelectedWMSLayers(layers) {
    const checkboxes = document.querySelectorAll('.wms-layer-checkbox:checked');
    const selectedLayerNames = Array.from(checkboxes).map(cb => cb.dataset.layerName);
    
    if (selectedLayerNames.length === 0) {
        await showWarning('No layers selected.', 'Selection Required');
        return;
    }
    
    const addButton = document.getElementById('addSelectedWMSLayers');
    if (addButton) {
        addButton.disabled = true;
        addButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Adding layers...';
    }
    
    try {
        let addedCount = 0;
        
        for (const layerName of selectedLayerNames) {
            const layer = layers.find(l => l.name === layerName);
            if (layer) {
                await addWMSLayerToMap(layer);
                addedCount++;
            }
        }
        
        if (addedCount > 0) {
            await showSuccess(`Successfully added ${addedCount} WMS layer${addedCount > 1 ? 's' : ''} to the map.`, 'Layers Added');
            
            // Clear selections
            checkboxes.forEach(cb => cb.checked = false);
            updateWMSSelectedCount();
        }
        
    } catch (error) {
        console.error('Error adding WMS layers:', error);
        await showError(`Failed to add WMS layers: ${error.message}`, 'Error');
    } finally {
        if (addButton) {
            addButton.disabled = false;
            addButton.innerHTML = '<i class="fas fa-plus mr-2"></i>Add Selected (<span id="selectedWMSCount">0</span>)';
            updateWMSSelectedCount();
        }
    }
}

// Add individual WMS layer to map
async function addWMSLayerToMap(layerInfo) {
    // Generate unique layer ID
    const layerId = `wms-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const displayName = `WMS - ${layerInfo.title}`;
    
    // Check if layer already exists
    const existingLayer = Array.from(window.layers.values()).find(l => l.name === displayName);
    if (existingLayer) {
        console.log(`WMS Layer "${displayName}" already exists in map view, skipping duplicate`);
        return existingLayer.layerId;
    }
    
    // Create WMS layer using Leaflet
    const baseUrl = WMS_CONFIG.philippineGeoportalUrl.split('?')[0];
    const wmsLayer = L.tileLayer.wms(baseUrl, {
        layers: layerInfo.name,
        format: WMS_CONFIG.defaultParams.format,
        transparent: WMS_CONFIG.defaultParams.transparent,
        version: WMS_CONFIG.defaultParams.version,
        attribution: 'Philippine Geoportal'
    });
    
    // Add to map
    wmsLayer.addTo(window.map);
    
    // Track layer loading for loading overlay
    if (typeof window.trackLayerLoading === 'function') {
        window.trackLayerLoading(wmsLayer, layerId);
    }
    
    // Add to layers registry
    window.layers.set(layerId, {
        layer: wmsLayer,
        name: displayName,
        visible: true,
        data: null, // WMS layers don't have feature data
        originalData: null,
        style: null,
        isPermanent: false,
        isUserGenerated: true,
        isUrlBased: true, // WMS layers are URL-based
        fromDatabase: false,
        databaseId: null,
        layerId: layerId,
        sourceType: 'wms',
        metadata: layerInfo,
        serviceUrl: baseUrl,
        wmsLayerName: layerInfo.name,
        createdAt: new Date().toISOString()
    });
    
    // Add to layer order (at the top)
    window.layerOrder.unshift(layerId);
    
    // Update UI
    updateLayersList();
    updateLegend();
    
    // Update map layer order
    if (window.updateMapLayerOrder) {
        window.updateMapLayerOrder();
    }
    
    // Zoom to layer bounds if available
    if (layerInfo.bbox) {
        const bounds = L.latLngBounds(
            [layerInfo.bbox.miny, layerInfo.bbox.minx],
            [layerInfo.bbox.maxy, layerInfo.bbox.maxx]
        );
        window.map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    console.log(`✅ WMS layer "${displayName}" added successfully`);
    return layerId;
}

// Export functions for use in other modules
window.addDataToMap = addDataToMap;
window.processFiles = processFiles;
window.loadWMSCapabilities = loadWMSCapabilities;
window.clearWMSCache = clearWMSCache;
window.getWMSCacheInfo = getWMSCacheInfo;