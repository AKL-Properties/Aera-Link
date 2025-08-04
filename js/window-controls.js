/**
 * Window Controls Module
 * Handles custom title bar functionality for Tauri desktop application
 */

// Check if we're running in Tauri environment
function isTauri() {
    return typeof window.__TAURI__ !== 'undefined';
}

// Initialize window controls
export function initializeWindowControls() {
    console.log('Initializing window controls');
    
    // Always show window controls (styled for both environments)
    const windowControls = document.getElementById('window-controls');
    if (windowControls) {
        windowControls.style.display = 'flex';
    }

    // Get button elements
    const closeBtn = document.getElementById('close-btn');
    const minimizeBtn = document.getElementById('minimize-btn');
    const maximizeBtn = document.getElementById('maximize-btn');
    const titlebar = document.getElementById('titlebar');

    // Close button functionality
    if (closeBtn) {
        closeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isTauri()) {
                try {
                    await window.__TAURI__.invoke('close_window');
                } catch (error) {
                    console.error('Error closing window:', error);
                }
            } else {
                // Fallback for browser: close current tab/window
                window.close();
            }
        });
    }

    // Minimize button functionality
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isTauri()) {
                try {
                    await window.__TAURI__.invoke('minimize_window');
                } catch (error) {
                    console.error('Error minimizing window:', error);
                }
            } else {
                // Fallback for browser: minimize is not available, so blur the window
                window.blur();
            }
        });
    }

    // Maximize button functionality
    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isTauri()) {
                try {
                    await window.__TAURI__.invoke('toggle_maximize_window');
                } catch (error) {
                    console.error('Error toggling maximize window:', error);
                }
            } else {
                // Fallback for browser: request fullscreen toggle
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    document.documentElement.requestFullscreen();
                }
            }
        });
    }

    // Header dragging functionality
    if (titlebar) {
        titlebar.addEventListener('mousedown', async (e) => {
            // Only start dragging if clicked on non-interactive elements
            const target = e.target;
            const isInteractive = target.tagName === 'BUTTON' || 
                                 target.tagName === 'INPUT' || 
                                 target.closest('button') || 
                                 target.closest('input') ||
                                 target.closest('#window-controls') ||
                                 target.closest('#logoutButton') ||
                                 target.closest('#headerSearchInput') ||
                                 target.closest('.bg-pure-black\\/80'); // Mode toggle container

            if (!isInteractive && isTauri()) {
                try {
                    await window.__TAURI__.invoke('start_drag');
                } catch (error) {
                    console.error('Error starting window drag:', error);
                }
            }
        });

        // Prevent double-click on header from maximizing (we handle it with button)
        titlebar.addEventListener('dblclick', async (e) => {
            const target = e.target;
            const isInteractive = target.tagName === 'BUTTON' || 
                                 target.tagName === 'INPUT' || 
                                 target.closest('button') || 
                                 target.closest('input') ||
                                 target.closest('#window-controls') ||
                                 target.closest('#logoutButton') ||
                                 target.closest('#headerSearchInput') ||
                                 target.closest('.bg-pure-black\\/80'); // Mode toggle container

            if (!isInteractive && isTauri()) {
                e.preventDefault();
                try {
                    await window.__TAURI__.invoke('toggle_maximize_window');
                } catch (error) {
                    console.error('Error toggling maximize window:', error);
                }
            }
        });
    }

    console.log('Window controls initialized successfully');
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure Tauri is fully loaded
    setTimeout(initializeWindowControls, 100);
});

// Also initialize immediately if DOM is already loaded
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
} else {
    // DOM is already loaded
    setTimeout(initializeWindowControls, 100);
}