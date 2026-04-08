/**
 * @file Main Application Module
 * @description Coordinates all modules and manages application state
 */

/// <reference path="./types.js" />

import ConfigManager from './modules/config.js';
import dataManager from './modules/data-manager.js';
import FilterManager from './modules/@filter/index.js';
import VideoGridManager from './modules/video-grid.js';
import SelectionPanelManager from './modules/selection-panel.js';
import UIUtils from './modules/ui-utils.js';
import EventHandlers from './modules/event-handlers.js';
import RobotAliasManager from './modules/robot-aliases.js';
import ErrorNotifier from './modules/error-notifier.js';
import DownloadManager from './modules/download-manager.js';

/**
 * Main Application Class
 */
class Application {
    constructor() {
        /** @type {Set<string>} */
        this.selectedDatasets = new Set();
        
        /** @type {Set<string>} */
        this.listDatasets = new Set();
        
        /** @type {Object|null} */
        this.config = null;
        
        /** @type {FilterManager|null} */
        this.filterManager = null;
        
        /** @type {VideoGridManager|null} */
        this.videoGridManager = null;
        
        /** @type {SelectionPanelManager|null} */
        this.selectionPanelManager = null;
        
        /** @type {UIUtils|null} */
        this.uiUtils = null;
        
        /** @type {EventHandlers|null} */
        this.eventHandlers = null;
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.classList.remove('hidden');
            
            // Load JSON configuration first (if available)
            await ConfigManager.loadJsonConfig();
            
            // Initialize configuration
            this.config = ConfigManager.getConfig();
            
            // Load robot alias map (non-blocking for core data, but awaited before UI init)
            await RobotAliasManager.load(this.config);
            
            // Load datasets
            const loadingProgress = document.getElementById('loadingProgress');
            const loadingBar = document.getElementById('loadingBar');
            await dataManager.loadDatasets(loadingProgress, loadingBar);
            
            // Build dataset index
            dataManager.buildDatasetIndex();
            
            // Initialize managers
            this.initializeManagers();
            
            // Build filter UI
            this.filterManager.buildFilterGroups();
            
            // Bind all events
            this.eventHandlers.bindEvents();
            
            // Setup filter change listener
            document.addEventListener('filtersChanged', () => {
                this.handleFiltersChanged();
            });
            
            // Initial render
            this.handleFiltersChanged();
            
            // Hide loading overlay
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 300);
            
            console.log('OK: Application initialized successfully');
            
        } catch (err) {
            const userFriendlyMsg = 'Since the web resources are hosted on Hugging Face, your network connection may affect the loading of these resources. Please ensure you have a stable connection and refresh the page to try again.\n\n' +
                                  'Application initialization failed: ' + err.message;
            ErrorNotifier.error(userFriendlyMsg, err);
            
            setTimeout(() => {
                document.getElementById('loadingOverlay').classList.add('hidden');
            }, 300);
        }
    }
    
    /**
     * Initialize all manager instances
     */
    initializeManagers() {
        // Filter Manager
        this.filterManager = new FilterManager(
            dataManager.getAllDatasets(),
            RobotAliasManager
        );
        
        // Video Grid Manager
        this.videoGridManager = new VideoGridManager(
            this.selectedDatasets,
            this.listDatasets
        );
        
        // Selection Panel Manager
        this.selectionPanelManager = new SelectionPanelManager(
            this.selectedDatasets,
            this.listDatasets,
            dataManager.datasetMap
        );

        // Set initial hub for download manager
        DownloadManager.setCurrentHub(this.selectionPanelManager.currentHub);
        
        // UI Utilities
        this.uiUtils = new UIUtils();
        
        // Event Handlers
        this.eventHandlers = new EventHandlers(
            {
                filter: this.filterManager,
                videoGrid: this.videoGridManager,
                selectionPanel: this.selectionPanelManager,
                ui: this.uiUtils
            },
            this.selectedDatasets,
            dataManager.datasetMap
        );
    }
    
    /**
     * Handle filters changed event
     */
    handleFiltersChanged() {
        const searchQuery = document.getElementById('searchBox')?.value || '';
        const filteredDatasets = this.filterManager.applyFilters(searchQuery);
        
        // Get selected datasets array from selectedDatasets Set
        const selectedDatasetsArray = Array.from(this.selectedDatasets)
            .map(path => dataManager.datasetMap.get(path))
            .filter(ds => ds !== undefined);
        
        // Update counts
        this.uiUtils.updateCounts(
            filteredDatasets.length, 
            this.selectedDatasets.size, 
            filteredDatasets,
            selectedDatasetsArray
        );
        
        // Update filter counts in UI
        this.updateFilterCounts(filteredDatasets);
        
        // Render video grid
        this.videoGridManager.renderVideoGrid(filteredDatasets);
        
        // Update selection panel
        this.selectionPanelManager.updateSelectionPanel();
    }
    
    /**
     * Update filter counts in UI (now uses static counts)
     * @param {Dataset[]} filteredDatasets - Filtered datasets
     */
    updateFilterCounts(filteredDatasets) {
        const counts = {};

        // Get static counts for all filter options
        document.querySelectorAll('[data-count]').forEach(el => {
            const countKey = el.dataset.count;
            if (!countKey) return;

            // Get the filter option element that contains this count element
            const optionElement = el.closest('.filter-option');
            if (!optionElement) return;

            // Get filter key and value from the option element
            const filterKey = optionElement.dataset.filter;
            const filterValue = optionElement.dataset.value;

            // Only process if this is a selectable filter option (has both filter and value)
            if (filterKey && filterValue) {
                counts[countKey] = this.filterManager.getStaticCount(filterKey, filterValue);
            }
        });

        // Set counts for "All" options (these remain dynamic)
        ['scene', 'robot', 'end', 'action', 'object'].forEach(filterType => {
            counts[`${filterType}-__ALL__`] = filteredDatasets.length;
        });

        // Update DOM
        document.querySelectorAll('[data-count]').forEach(el => {
            const key = el.dataset.count;
            el.textContent = counts[key] || 0;
        });
    }
}

// Create and export singleton instance
const APP = new Application();
export default APP;

