// Shared canvas renderer instance
const sharedCanvasRenderer = L.canvas({
    padding: 0.5,
    tolerance: 0
});

// Function to create GeoJSON layer with canvas renderer
function createCanvasLayer(data, options = {}) {
    return L.geoJSON(data, {
        ...options,
        renderer: sharedCanvasRenderer,
        // Ensure proper pane assignment
        pane: options.pane || 'overlayPane'
    });
}

// Export functions and objects
window.sharedCanvasRenderer = sharedCanvasRenderer;
window.createCanvasLayer = createCanvasLayer; 