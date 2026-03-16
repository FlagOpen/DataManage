/**
 * @file Type Definitions
 * @description Centralized JSDoc type definitions for the RoboCOIN application
 */

/**
 * @typedef {Object} DatasetObject
 * @property {string} name - Object name (page field: object_name)
 * @property {string[]} hierarchy - Object hierarchy levels (level1..level5)
 */

/**
 * @typedef {Object} Dataset
 * @property {string} path - Dataset path identifier
 * @property {string} name - Dataset original name (hub identifier)
 * @property {string} displayName - Dataset display name (mapped)
 * @property {string} video_url - URL to video file
 * @property {string} thumbnail_url - URL to thumbnail image
 * @property {string} description - Task description
 * @property {string[]} scenes - Scene types
 * @property {string[]} actions - Atomic actions
 * @property {DatasetObject[]} objects - Operation objects
 * @property {string|string[]} robot - Robot model(s)
 * @property {string[]} endEffectors - End effector types (flat list)
 * @property {string} [endEffector] - Primary end effector (legacy single value)
 * @property {number} platformHeight - Operation platform height
 * @property {function(): string[]} getAllScenes - Get all scenes
 * @property {function(string): boolean} hasScene - Check if has scene
 * @property {function(number, string): DatasetObject[]} getObjectsByLevel - Get objects by level
 * @property {function(): string[]} getTopLevelCategories - Get top level categories
 */

/**
 * @typedef {Object} FilterOption
 * @property {string} key - Filter key
 * @property {string} value - Filter value
 * @property {string} label - Display label
 */

/**
 * @typedef {Object} FilterGroup
 * @property {string} title - Group title
 * @property {Set|Map} values - Filter values
 * @property {string} type - Filter type ('flat' or 'hierarchical')
 */

/**
 * @typedef {Object} AppState
 * @property {Dataset[]} datasets - All datasets
 * @property {Dataset[]} filteredDatasets - Filtered datasets
 * @property {Set<string>} selectedDatasets - Selected dataset paths
 * @property {Set<string>} listDatasets - Cart/list dataset paths
 * @property {Object<string, string[]>} filters - Active filters
 * @property {Set<string>} selectedFilters - Selected filter options
 * @property {string} currentFormat - Current code format
 * @property {string} currentHub - Current hub selection
 * @property {Map<string, Dataset>} datasetMap - Path to dataset map
 */

/**
 * @typedef {Object} VirtualScrollState
 * @property {number} scrollTop - Current scroll position
 * @property {number} containerHeight - Container height
 * @property {number} itemHeight - Item height
 * @property {number} startIndex - Start index of visible items
 * @property {number} endIndex - End index of visible items
 * @property {number} totalItems - Total number of items
 */

/**
 * @typedef {Object} GridLayoutParams
 * @property {number} gridWidth - Grid container width
 * @property {number} cardWidth - Card width
 * @property {number} cardHeight - Card height
 * @property {number} gap - Gap between cards
 * @property {number} itemsPerRow - Items per row
 * @property {number} itemHeight - Total item height (card + gap)
 */

// Export empty object to make this a module
export {};
