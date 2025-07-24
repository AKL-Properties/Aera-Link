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

// Initialize module
document.addEventListener('DOMContentLoaded', () => {
    setupFileUpload();
    setupWebUrlLoad();
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
                await showSuccess('Files processed successfully!', 'Success');
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
                await handleArcGISRestUrl(url, progress, progressBar, progressText);
            } else {
                // Validate standard URL extension
                const isValidUrl = SUPPORTED_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext));
                if (!isValidUrl) {
                    throw new Error('URL must point to a supported file type or be an ArcGIS REST service URL.');
                }
                
                await handleStandardUrl(url, progress, progressBar, progressText);
            }
            
            // Clear input on success
            urlInput.value = '';
            await showSuccess('Data loaded successfully!', 'Success');
            
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
    return ARCGIS_PATTERNS.domain.test(url) && ARCGIS_PATTERNS.service.test(url);
}

// Handle ArcGIS REST service URL
async function handleArcGISRestUrl(url, progress, progressBar, progressText) {
    // Show progress
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    // Build query URL if needed
    let queryUrl = url;
    if (!ARCGIS_PATTERNS.query.test(url)) {
        queryUrl = `${url}/query?where=1=1&outFields=*&f=geojson`;
    }
    
    try {
        // Fetch metadata first to get layer name
        const metadataUrl = url.replace(/\/(?:FeatureServer|MapServer)\/\d+$/, '?f=json');
        const metadataResponse = await fetch(metadataUrl);
        const metadata = await metadataResponse.json();
        
        // Update progress
        progressBar.style.width = '20%';
        progressText.textContent = '20%';
        
        // Fetch features
        const response = await fetch(queryUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch data from ArcGIS REST service');
        }
        
        // Update progress
        progressBar.style.width = '60%';
        progressText.textContent = '60%';
        
        const geoJson = await response.json();
        
        // Validate GeoJSON
        if (!geoJson || geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
            throw new Error('Invalid GeoJSON response from ArcGIS REST service');
        }
        
        // Update progress
        progressBar.style.width = '80%';
        progressText.textContent = '80%';
        
        // Generate layer name
        const layerName = metadata.name || 'ArcGIS Layer';
        const timestamp = new Date().toISOString().split('T')[0];
        const displayName = `AGOL - ${layerName} (${timestamp})`;
        
        // Add to map
        await addDataToMap(geoJson, displayName, {
            source: 'arcgis',
            serviceUrl: url,
            metadata: metadata
        });
        
        // Complete progress
        progressBar.style.width = '100%';
        progressText.textContent = '100%';
        
    } catch (error) {
        throw new Error(`ArcGIS REST service error: ${error.message}`);
    }
}

// Handle standard URL (GeoJSON, KML, etc.)
async function handleStandardUrl(url, progress, progressBar, progressText) {
    // Show progress
    progress.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    try {
        const response = await fetch(url);
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
        
        // Process based on file type
        const fileExtension = url.split('.').pop().toLowerCase();
        const geoData = await parseDataByType(content, fileExtension);
        
        // Add to map
        await addDataToMap(geoData, url.split('/').pop());
        
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
async function addDataToMap(geoData, fileName, options = {}) {
    if (!geoData || !geoData.features || geoData.features.length === 0) {
        throw new Error('Invalid or empty GeoJSON data');
    }
    
    // Generate unique layer ID
    const layerId = options.source === 'arcgis' 
        ? `agol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const layerName = fileName.split('.')[0];
    
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
        fillOpacity: 0.7
    };
    
    // Create Leaflet layer
    const newLayer = L.geoJSON(geoData, {
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
                    popupContent += `<div class="property-row">`;
                    popupContent += `<div class="property-key">${key}</div>`;
                    popupContent += `<div class="property-value">${feature.properties[key] || 'N/A'}</div>`;
                    popupContent += `</div>`;
                }
                
                popupContent += '</div></div>';
                
                layer.bindPopup(popupContent);
            }
        }
    }).addTo(map);
    
    // Add to layers registry
    window.layers.set(layerId, {
        layer: newLayer,
        name: layerName,
        visible: true,
        data: geoData,
        originalData: geoData,
        style: defaultStyle,
        isPermanent: false,
        isUserGenerated: true,
        sourceType: options.source || 'upload',
        metadata: options.metadata || null,
        serviceUrl: options.serviceUrl || null,
        createdAt: new Date().toISOString()
    });
    
    // Add to layer order (at the top)
    window.layerOrder.unshift(layerId);
    
    // Update UI
    updateLayersList();
    updateLegend();
    
    // Zoom to layer
    map.fitBounds(newLayer.getBounds(), {
        padding: [50, 50]
    });
    
    // Save to Supabase if available
    if (typeof saveLayerToSupabase === 'function') {
        try {
            await saveLayerToSupabase(layerId, layerName, geoData, {
                source: options.source,
                serviceUrl: options.serviceUrl,
                metadata: options.metadata
            });
        } catch (error) {
            console.warn('Failed to save layer to Supabase:', error);
            // Continue anyway since the layer is added locally
        }
    }
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
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                // Add popup with properties
                const props = feature.properties;
                if (props) {
                    const content = Object.entries(props)
                        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
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
        
        // Add to layer order
        window.layerOrder.push(layerId);
        
        // Add to map
        newLayer.addTo(window.map);
        
        // Update layer panel
        updateLayerPanel();
        
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

// Export functions for use in other modules
window.addDataToMap = addDataToMap;
window.processFiles = processFiles;