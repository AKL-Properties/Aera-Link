# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aéra Link is a modular Leaflet-based WebGIS application with Supabase backend integration for geospatial data management and visualization. This is a client-side application built with vanilla JavaScript and ES6 modules.

## Development Commands

Since this is a client-side application, no build system is required:

```bash
# Serve the application locally (use any local server)
python -m http.server 8000
# or
npx serve .
# or
live-server

# Open index.html in browser after serving
```

## Architecture Overview

### Core Structure
- **Entry Point**: `index.html` - Single page application with authentication and main interface
- **Modular Design**: JavaScript functionality split into focused modules in `/js/` directory
- **State Management**: Global state managed via `window` object in `global.js`
- **Authentication**: Supabase-based authentication with session management
- **Data Storage**: Supabase for user data, Storage for permanent layers

### Module Architecture

#### Core Modules (Required for Basic Functionality)
1. **authentication.js** - Supabase authentication, login/logout, session management
2. **global.js** - Global functions, layer database operations, UI management
3. **basemap-manager.js** - Basemap providers (Google, ESRI, OSM, etc.), context menu switching
4. **layer-manager.js** - Layer CRUD operations, Supabase Storage integration, symbology management

#### Feature Modules
5. **add-data.js** - File upload handling (GeoJSON, KML, KMZ, GPX, CSV)
6. **filter-system.js** - Multi-criteria feature filtering, attribute-based operations
7. **selection-tools.js** - Polygon selection, feature statistics, spatial analysis
8. **symbology-editor.js** - Layer styling, categorical/single symbol symbology
9. **collaborative-mode.js** - Real-time collaboration features
10. **map-print.js** - Map export, print layout functionality
11. **interaction-handlers.js** - Mouse interactions, popup management
12. **renderer-config.js** - Canvas renderer configuration for export compatibility

### Key Global Variables
```javascript
window.layers = new Map();        // Layer registry
window.layerOrder = [];          // Layer display order
window.layerCounter = 0;         // Layer ID counter
window.supabase                  // Supabase client instance
window.currentUser               // Current authenticated user
window.map                       // Leaflet map instance
```

### Supabase Configuration
- **URL**: Configured in `authentication.js`
- **Database Table**: `layers` table for user layer storage
- **Storage Bucket**: `aeralink` for permanent layer files
- **Authentication**: Row Level Security (RLS) policies for user data isolation

### Layer Management System
- **Permanent Layers**: Stored in Supabase Storage, loaded with preloaded symbology
- **User Layers**: Stored in Supabase database, associated with authenticated users
- **Symbology**: JSON-based styling with categorical and single symbol support
- **File Support**: GeoJSON, KML, KMZ, GPX, CSV with coordinate columns

### UI Architecture
- **Floating Toolbox**: Right-side tool panel system
- **Toolbar Panels**: Slide-out panels for Add Data, Filter, Layers, Legend, Select, Print
- **Context Menus**: Layer context menu, basemap selection context menu
- **Modal System**: Custom modal system for alerts, confirmations, prompts
- **Navigation**: Left sidebar with Dashboard, Map, Database sections

### Key Features
- **Authentication**: Secure login with Supabase
- **Layer Management**: Upload, style, reorder, toggle visibility
- **Advanced Filtering**: Multi-criteria filtering, selected feature filtering
- **Selection Tools**: Polygon selection with statistics
- **Print & Export**: High-quality map export with layout editor
- **Basemap Gallery**: 20+ basemap providers with preview
- **Collaborative Mode**: Real-time data sharing (toggle-based)

### Development Notes
- Uses ES6 modules with global window object for cross-module communication
- Canvas renderer enforced for export compatibility
- Middle-mouse panning and Ctrl+right-click zoom box implemented
- Comprehensive error handling throughout modules
- Mobile-responsive design with Tailwind CSS classes
- Print mode with special CSS handling for full-screen export

### Browser Support
- Modern browsers with ES6 support required
- Leaflet 1.9.4 compatibility
- Canvas API support for map export functionality

### External Dependencies
- **Leaflet 1.9.4**: Core mapping library
- **Supabase JS**: Backend integration
- **Tailwind CSS**: Styling framework (CDN)
- **Turf.js**: Spatial analysis operations
- **PapaParse**: CSV file parsing
- **html2canvas**: Map export functionality
- **Font Awesome 6.4.0**: Icons