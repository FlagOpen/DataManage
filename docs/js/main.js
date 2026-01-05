/**
 * @file Main Entry Point
 * @description Application entry point with error handling
 */

import APP from './app.js';
import ErrorNotifier from './modules/error-notifier.js';

/**
 * Initialize application when DOM is ready
 */
function initApp() {
    try {
        APP.init();
    } catch (error) {
        const userFriendlyMsg = 'Since the web resources are hosted on Hugging Face, your network connection may affect the loading of these resources. Please ensure you have a stable connection and refresh the page to try again.\n\n' +
                              'Application initialization failed. Please refresh the page.';
        ErrorNotifier.error(userFriendlyMsg, error);
    }
}

// Ensure DOM is fully loaded before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for debugging
if (typeof window !== 'undefined') {
    window.APP = APP;
}

