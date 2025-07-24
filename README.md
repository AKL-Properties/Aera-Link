# Aéra Link - WebGIS Portal

A modular Leaflet-based WebGIS application with Supabase backend integration for geospatial data management and visualization.

## Project Structure

```
📁 Aera Web/
├── 📄 index.html                    # Main application entry point (clean & modular)
├── 📄 index-original.html           # Original monolithic version (backup)
├── 📄 Aera.geojson                  # Main area boundary data
│
├── 📁 css/
│   └── 📄 style.css                 # Complete application styling
│
├── 📁 js/
│   ├── 📄 globals.js                # Global state management & configuration
│   ├── 📄 utils.js                  # Utility functions & modal system
│   ├── 📄 map-init.js               # Map initialization & basemap providers
│   ├── 📄 layers.js                 # Layer management & Supabase integration
│   ├── 📄 auth.js                   # Authentication system
│   └── 📄 events.js                 # Event handlers & user interactions
│
├── 📁 assets/
│   ├── 🖼️ AERA LOGO.png             # Application logo
│   └── 🖼️ Home.jpg                  # Home background image
│
└── 📁 data/
    ├── 📄 Developable Area.geojson   # Development areas
    ├── 📄 Development Pads.geojson   # Development pads
    ├── 📄 Proximity Roads.geojson    # Road proximity data
    ├── 📄 Roads.geojson              # Road network
    └── 📄 Slope.geojson              # Slope analysis data
```

## Module Overview

### 🔧 Core Modules

1. **globals.js** - Central state management
   - MapGlobals object with map/sidebar references
   - Layer collections and filter state
   - Supabase client configuration

2. **utils.js** - Utility functions
   - Custom modal system (showCustomModal)
   - Notification system
   - File validation helpers
   - Popup utilities

3. **map-init.js** - Map foundation
   - Leaflet map initialization
   - 20+ basemap providers (Google, ESRI, OSM, etc.)
   - Middle-mouse panning & zoom box
   - Core map interactions

4. **layers.js** - Layer management
   - Complete layer CRUD operations
   - Supabase cloud synchronization
   - Drag & drop layer reordering
   - Symbology & styling management
   - Legend generation

5. **auth.js** - Authentication system
   - Supabase authentication integration
   - User session management
   - Login/logout workflows
   - Auth state listeners

6. **events.js** - User interactions
   - File upload handling
   - Context menu system
   - Modal interactions
   - UI event management
   - Drag & drop functionality

### 🎨 Styling

- **style.css** - Complete UI styling
  - Glass morphism effects
  - Responsive design
  - Dark theme with modern aesthetics
  - Print layout styles
  - Modal and sidebar styling

## Technology Stack

- **Frontend**: Leaflet.js 1.9.4, Tailwind CSS, Font Awesome 6.4.0
- **Backend**: Supabase (Authentication, Database, Storage)
- **GIS Libraries**: ESRI Leaflet, Turf.js, toGeoJSON, leaflet-image
- **Additional**: JSZip, Inter font family

## Features

✅ **Authentication System**
- Secure login with Supabase
- Session management
- User-specific data access

✅ **Layer Management**
- Upload GeoJSON, KML, KMZ files
- Cloud storage with Supabase
- Drag & drop layer reordering
- Dynamic symbology

✅ **Advanced Filtering**
- Multi-criteria filtering
- Field-based operations
- Selected feature filtering

✅ **Selection Tools**
- Polygon selection
- Feature statistics
- Attribute analysis

✅ **Print & Export**
- High-quality map export
- Custom layout editor
- Multiple format support

✅ **Basemap Gallery**
- 20+ basemap providers
- Preview modal
- Dynamic switching

## Getting Started

1. **Open the application**
   ```
   Open index.html in a web browser
   ```

2. **Login**
   - Use your Supabase credentials
   - System will authenticate and load user data

3. **Add Data**
   - Right-click map → "Add data"
   - Upload GeoJSON/KML/KMZ files
   - Data is automatically saved to cloud

4. **Explore Features**
   - Use sidebar panels for filtering, layers, legend
   - Right-click for context menu
   - Select features with polygon tool

## Development Notes

- **Module Loading**: Uses ES6 modules with proper import/export
- **State Management**: Centralized in globals.js for consistency
- **Error Handling**: Comprehensive error handling throughout
- **Performance**: Optimized for large datasets with efficient rendering
- **Mobile Responsive**: Full responsive design for all devices

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Responsive design

---

*Refactored from monolithic structure to modular architecture while preserving 100% functionality.*
