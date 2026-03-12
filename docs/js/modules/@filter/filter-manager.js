/**
 * @file Filter Manager Module
 * @description Manages dataset filtering, filter UI, and filter state
 */

/// <reference path="../../types.js" />

import FilterState from './filter-state.js';
import { qs, qsa, addClass, removeClass, toggleClass, setHTML, setText } from '../dom-utils.js';
import {
    selectAllInHierarchy,
    selectAllChildrenInHierarchy,
    clearAllChildrenInHierarchy
} from './filter-hierarchy.js';
import FilterSearchHelper from './filter-search.js';
import FilterRenderer from './filter-renderer.js';
import {
    buildFilterGroups,
    calculateStaticFilterCounts,
    getCategoryItemCount,
    calculateAffectedCount,
    calculateStaticHierarchyCounts
} from './data.js';

function getDatasetEndEffectors(ds) {
    if (Array.isArray(ds.endEffectors)) {
        return ds.endEffectors;
    }
    if (ds.endEffector) {
        return [ds.endEffector];
    }
    const rawValue = ds.raw?.end_effector_type;
    if (Array.isArray(rawValue)) {
        return rawValue;
    }
    return rawValue ? [rawValue] : [];
}

/**
 * Filter Manager Class
 * Manages all filtering operations and UI
 */
export class FilterManager {
    /**
     * @param {Dataset[]} datasets - All datasets
     * @param {Object} robotAliasManager - Robot alias manager instance
     */
    constructor(datasets, robotAliasManager) {
        this.datasets = datasets;

        /** @type {Object<string, FilterGroup>} */
        this.filterGroups = {};

        /** @type {Set<string>} */
        this.selectedFilters = new Set();

        /**
         * Encapsulated filter selection state helper.
         * wraps the same backing Set so existing logic keeps working.
         * @type {FilterState}
         */
        this.filterState = new FilterState(this.selectedFilters);

        /** @type {Map<string, HTMLElement>} */
        this.filterOptionCache = new Map();

        /** @type {number|null} */
        this.pendingFilterUpdate = null;

        // Static count cache for UI display (only calculated once at initialization)
        this.staticFilterCounts = new Map();

        /**
         * Robot alias manager (optional)
         * Provides common_name and aliases for robot IDs.
         */
        this.robotAliasManager = robotAliasManager || null;

        /**
         * UI renderer for filter sidebar and options.
         * @type {FilterRenderer}
         */
        this.renderer = new FilterRenderer(this);

        /**
         * Filter Finder helper (search / navigate / UI).
         * @type {FilterSearchHelper}
         */
        this.filterSearch = new FilterSearchHelper(this, this.robotAliasManager);
    }

    /**
     * Build filter groups from datasets
     */
    buildFilterGroups() {
        this.filterGroups = buildFilterGroups(this.datasets);
        // Render UI
        this.renderFilterGroups();
    }

    /**
     * Render filter groups to UI (delegated to renderer).
     */
    renderFilterGroups() {
        this.renderer.renderFilterGroups();
    }

    /**
     * Select a category and show its options in the right panel
     * @param {string} categoryKey - The category key to select
     */
    selectCategory(categoryKey) {
        // Update sidebar selection
        const sidebar = qs('#filterCategoriesSidebar');
        if (sidebar) {
            qsa('.filter-category-btn', sidebar).forEach(btn => {
                removeClass(btn, 'selected');
            });
            const selectedBtn = sidebar.querySelector(`[data-category="${categoryKey}"]`);
            addClass(selectedBtn, 'selected');
        }

        // Clear any active search when switching categories
        this.clearFilterSearch();

        // Render category options in right panel
        this.renderCategoryOptions(categoryKey);

        // Update filter counts when category is selected/opened
        this.updateStaticCountsForCategory(categoryKey);

        // Re-apply current search query if any
        const searchInput = qs('#filterFinderInput');
        if (searchInput && searchInput.value.trim()) {
            this.searchFilterOptions(searchInput.value.trim());
        }
    }

    /**
     * Render category options in the right panel
     * @param {string} categoryKey - The category key
     */
    renderCategoryOptions(categoryKey) {
        this.renderer.renderCategoryOptions(categoryKey);
    }

    /**
     * Get the count of items in a category
     * @param {string} categoryKey - The category key
     * @returns {number} Count of items
     */
    getCategoryItemCount(categoryKey) {
        return getCategoryItemCount(this.filterGroups, categoryKey);
    }

    /**
     * Toggle filter selection
     * @param {string} filterKey - Filter key
     * @param {string} filterValue - Filter value
     * @param {string} filterLabel - Filter label
     * @param {HTMLElement} optionElement - Option element
     */
    toggleFilterSelection(filterKey, filterValue, filterLabel, optionElement) {
        const filterId = `${filterKey}:${filterValue}`;

        if (this.selectedFilters.has(filterId)) {
            this.selectedFilters.delete(filterId);
            if (optionElement) {
                removeClass(optionElement, 'selected');
            }
        } else {
            this.selectedFilters.add(filterId);
            if (optionElement) {
                addClass(optionElement, 'selected');
            }
        }

        this.updateTriggerCount();
        this.scheduleFilterUpdate();
    }


    /**
     * Update trigger count badge
     */
    updateTriggerCount() {
        const countEl = qs('#filterTriggerCount');
        if (!countEl) return;

        if (this.selectedFilters.size > 0) {
            countEl.textContent = this.selectedFilters.size;
        } else {
            countEl.textContent = '';
        }
    }

    /**
     * Update filter option styles
     */
    updateFilterOptionStyles() {
        this.filterOptionCache.forEach((element, filterId) => {
            if (this.selectedFilters.has(filterId)) {
                addClass(element, 'selected');
            } else {
                removeClass(element, 'selected');
            }
        });
    }

    /**
     * Apply selected styles to all options in a specific category
     * @param {string} categoryKey - The category key
     */
    applySelectedStylesToCategory(categoryKey) {
        this.selectedFilters.forEach(filterId => {
            if (filterId.startsWith(`${categoryKey}:`)) {
                const option = this.filterOptionCache.get(filterId);
                if (option) {
                    addClass(option, 'selected');
                }
            }
        });
    }

    /**
     * Apply selected styles to all options within a container (including nested)
     * @param {HTMLElement} container - The container element
     */
    applySelectedStylesToContainer(container) {
        if (!container) return;
        
        const options = container.querySelectorAll('.filter-option[data-filter][data-value]');
        options.forEach(option => {
            const filterKey = option.dataset.filter;
            const filterValue = option.dataset.value;
            if (filterKey && filterValue) {
                const filterId = `${filterKey}:${filterValue}`;
                if (this.selectedFilters.has(filterId)) {
                    addClass(option, 'selected');
                }
            }
        });
    }

    /**
     * Get human-readable filter label
     * @param {string} filterKey - Filter key
     * @param {string} filterValue - Filter value
     * @returns {string} Filter label
     */

    /**
     * Schedule filter update (debounced)
     */
    scheduleFilterUpdate() {
        if (this.pendingFilterUpdate) {
            clearTimeout(this.pendingFilterUpdate);
        }

        this.pendingFilterUpdate = setTimeout(() => {
            // Trigger filter update event
            document.dispatchEvent(new CustomEvent('filtersChanged'));
            this.pendingFilterUpdate = null;
        }, 150);
    }

    /**
     * Build searchable text collection for a dataset.
     * Includes dataset identifiers and robot aliases (if available).
     * @param {Dataset} ds - Dataset object
     * @returns {string[]} Searchable text tokens
     */
    getSearchableTextsForDataset(ds) {
        const texts = new Set();

        if (ds.name) {
            texts.add(String(ds.name));
        }

        if (ds.displayName && ds.displayName !== ds.name) {
            texts.add(String(ds.displayName));
        }
        if (ds.path) {
            texts.add(String(ds.path));
        }

        // Frame range
        if (ds.frameRange) {
            texts.add(String(ds.frameRange));
        }

        // Robot IDs + aliases
        if (ds.robot) {
            const robots = Array.isArray(ds.robot) ? ds.robot : [ds.robot];
            robots.forEach(robotId => {
                if (!robotId) return;

                if (this.robotAliasManager && typeof this.robotAliasManager.getSearchTokensForRobot === 'function') {
                    const tokens = this.robotAliasManager.getSearchTokensForRobot(robotId);
                    tokens.forEach(token => {
                        if (token) {
                            texts.add(String(token));
                        }
                    });
                } else {
                    texts.add(String(robotId));
                }
            });
        }

        return Array.from(texts);
    }

    /**
     * Apply filters to datasets
     * @param {string} searchQuery - Search query
     * @returns {Dataset[]} Filtered datasets
     */
    applyFilters(searchQuery = '') {
        const filters = {};

        const trimmedQuery = searchQuery ? searchQuery.trim() : '';
        const normalizedQuery = trimmedQuery.toLowerCase();

        // Collect selected filters
        this.filterState.forEach(filterId => {
            const [key, value] = filterId.split(':');
            if (!filters[key]) filters[key] = [];
            filters[key].push(value);
        });

        const filtered = this.datasets.filter(ds => {
            // Keyword search: match against dataset id/name and robot aliases / friendly names
            if (normalizedQuery) {
                const texts = this.getSearchableTextsForDataset(ds);
                let matchesSearch = texts.some(text =>
                    typeof text === 'string' && text.toLowerCase().includes(normalizedQuery)
                );
                // Fallback: match by alias reverse lookup (e.g. "宇树" -> robot keys that have this alias)
                if (!matchesSearch && this.robotAliasManager && typeof this.robotAliasManager.getRobotIdsByAlias === 'function') {
                    const robotIdsByAlias = this.robotAliasManager.getRobotIdsByAlias(normalizedQuery);
                    if (robotIdsByAlias.length > 0) {
                        const dsRobots = Array.isArray(ds.robot) ? ds.robot : (ds.robot != null ? [ds.robot] : []);
                        const aliasKeysLower = new Set(robotIdsByAlias.map(id => String(id).toLowerCase()));
                        const getCanonical = typeof this.robotAliasManager.getCanonicalRobotKey === 'function'
                            ? (r) => this.robotAliasManager.getCanonicalRobotKey(r)
                            : (r) => (r != null ? String(r) : null);
                        matchesSearch = dsRobots.some(r => {
                            const canonical = getCanonical(r);
                            return canonical != null && aliasKeysLower.has(canonical.toLowerCase());
                        });
                    }
                }
                if (!matchesSearch) {
                    return false;
                }
            }

            for (const [key, values] of Object.entries(filters)) {
                let match = false;

                if (key === 'frame range') {
                    match = values.includes(ds.frameRange);
                } else if (key === 'scene') {
                    match = ds.scenes && ds.scenes.some(v => values.includes(v));
                } else if (key === 'robot') {
                    const robots = Array.isArray(ds.robot) ? ds.robot : [ds.robot];
                    match = robots.some(r => values.includes(r));
                } else if (key === 'end') {
                    const endEffectors = getDatasetEndEffectors(ds);
                    match = endEffectors.some(value => values.includes(value));
                } else if (key === 'action') {
                    match = ds.actions && ds.actions.some(a => values.includes(a));
                } else if (key === 'object') {
                    match = ds.objects && ds.objects.some(obj =>
                        obj.hierarchy.some(h => values.includes(h))
                    );
                }

                if (!match) return false;
            }

            return true;
        });

        return filtered;
    }

    /**
     * Reset all filters
     */
    resetFilters() {
        if (this.pendingFilterUpdate) {
            clearTimeout(this.pendingFilterUpdate);
            this.pendingFilterUpdate = null;
        }

        this.filterState.clear();
        this.updateFilterOptionStyles();

        const container = qs('#filterTagsContainer');
        setHTML(container, '');

        this.updateTriggerCount();
        this.scheduleFilterUpdate();
        // Reset should also trigger re-render because it changed the video-grid height

    }

    /**
     * Search filter options (Filter Finder)
     * @param {string} query - Search query
     */
    searchFilterOptions(query) {
        this.filterSearch.search(query);
    }

    /**
     * Navigate to next/previous match
     * @param {string} direction - 'next' or 'prev'
     */
    navigateFilterMatch(direction) {
        this.filterSearch.navigate(direction === 'prev' ? 'prev' : 'next');
    }

    /**
     * Highlight current match
     */
    highlightCurrentMatch() {
        this.filterSearch.highlightCurrent();
    }

    /**
     * Clear filter search
     */
    clearFilterSearch() {
        this.filterSearch.clear(true);
    }

    /**
     * Update Filter Finder UI
     */
    updateFilterFinderUI() {
        this.filterSearch.updateUI();
    }

    /**
     * Select all filters in a group
     * @param {string} groupKey - Filter group key
     */
    selectAllInGroup(groupKey) {
        const group = this.filterGroups[groupKey];
        if (!group) return;

        if (group.type === 'flat') {
            group.values.forEach(value => {
                const filterId = `${groupKey}:${value}`;
                if (!this.selectedFilters.has(filterId)) {
                    this.selectedFilters.add(filterId);
                }
            });
        } else if (group.type === 'hierarchical') {
            // Select all leaf nodes in hierarchy (delegated helper)
            selectAllInHierarchy(this, groupKey, group.values);
        }

        // Apply styles to currently visible (cached and rendered) options
        this.applySelectedStylesToCategory(groupKey);

        this.updateTriggerCount();
        this.scheduleFilterUpdate();
    }

    /**
     * Clear all filters in a group
     * @param {string} groupKey - Filter group key
     */
    clearGroup(groupKey) {
        const filtersToRemove = [];

        this.selectedFilters.forEach(filterId => {
            const [key] = filterId.split(':');
            if (key === groupKey) {
                filtersToRemove.push(filterId);
            }
        });

        filtersToRemove.forEach(filterId => {
            this.selectedFilters.delete(filterId);
            const option = this.filterOptionCache.get(filterId);
            if (option) {
                removeClass(option, 'selected');
            }
        });

        this.updateTriggerCount();
        this.scheduleFilterUpdate();
    }

    /**
     * Initialize filter system
     */
    initializeFilters() {
        // Calculate initial counts
        this.updateFilterCounts();

        // Calculate static counts for UI display (only once at initialization)
        this.calculateStaticFilterCounts();
    }

    /**
     * Calculate static filter counts for UI display (only called once at initialization)
     */
    calculateStaticFilterCounts() {
        this.staticFilterCounts = calculateStaticFilterCounts(this.datasets, this.filterGroups);
    }

    /**
     * Calculate static hierarchy counts recursively
     * @param {string} key - Filter key
     * @param {Map} hierarchyMap - Hierarchy map
     */
    calculateStaticHierarchyCounts(key, hierarchyMap) {
        calculateStaticHierarchyCounts(this.datasets, key, hierarchyMap, this.staticFilterCounts);
    }

    /**
     * Update static counts for a specific category and refresh UI
     * @param {string} categoryKey - The category key to update
     */
    updateStaticCountsForCategory(categoryKey) {
        const group = this.filterGroups[categoryKey];
        if (!group) return;

        // Recalculate counts for this category
        if (group.type === 'flat') {
            group.values.forEach(value => {
                const count = calculateAffectedCount(this.datasets, categoryKey, value);
                this.staticFilterCounts.set(`${categoryKey}:${value}`, count);
            });
        } else if (group.type === 'hierarchical') {
            this.calculateStaticHierarchyCounts(categoryKey, group.values);
        }

        // Update the UI counts for this category
        this.updateUICountsForCategory(categoryKey);
    }

    /**
     * Update UI counts for a specific category
     * @param {string} categoryKey - The category key to update
     */
    updateUICountsForCategory(categoryKey) {
        const container = qs('#filterGroups');
        if (!container) return;

        // Find all count elements in the current category
        container.querySelectorAll('[data-count]').forEach(el => {
            // Get the filter option element that contains this count element
            const optionElement = el.closest('.filter-option');
            if (!optionElement) return;

            // Get filter key and value from the option element
            const filterKey = optionElement.dataset.filter;
            const filterValue = optionElement.dataset.value;

            // Only update counts for the current category
            if (filterKey === categoryKey && filterKey && filterValue) {
                const count = this.getStaticCount(filterKey, filterValue);
                el.textContent = count;
            }
        });
    }

    /**
     * Update filter counts for all options
     */
    updateFilterCounts() {
        this.filterCounts.clear();

        // Count for each filter option
        for (const [key, group] of Object.entries(this.filterGroups)) {
            if (group.type === 'flat') {
                group.values.forEach(value => {
                    const count = calculateAffectedCount(this.datasets, key, value);
                    this.filterCounts.set(`${key}:${value}`, count);
                });
            } else if (group.type === 'hierarchical') {
                this.updateHierarchyCounts(key, group.values);
            }
        }
    }

    /**
     * Update hierarchy counts recursively
     * @param {string} key - Filter key
     * @param {Map} hierarchyMap - Hierarchy map
     */
    updateHierarchyCounts(key, hierarchyMap) {
        hierarchyMap.forEach((node, value) => {
            const count = this.calculateAffectedCount(key, value);
            this.filterCounts.set(`${key}:${value}`, count);

            if (node.children.size > 0) {
                this.updateHierarchyCounts(key, node.children);
            }
        });
    }

    /**
     * Calculate affected count for a filter
     * @param {string} filterKey - Filter key
     * @param {string} filterValue - Filter value
     * @returns {number} Count of matching datasets
     */
    calculateAffectedCount(filterKey, filterValue) {
        let count = 0;

        this.datasets.forEach(ds => {
            let match = false;

            if (filterKey === 'frame range') {
                match = ds.frameRange === filterValue;
            } else if (filterKey === 'scene') {
                match = ds.scenes && ds.scenes.includes(filterValue);
            } else if (filterKey === 'robot') {
                const robots = Array.isArray(ds.robot) ? ds.robot : [ds.robot];
                match = robots.includes(filterValue);
            } else if (filterKey === 'end') {
                const endEffectors = getDatasetEndEffectors(ds);
                match = endEffectors.includes(filterValue);
            } else if (filterKey === 'action') {
                match = ds.actions && ds.actions.includes(filterValue);
            } else if (filterKey === 'object') {
                match = ds.objects && ds.objects.some(obj =>
                    obj.hierarchy.includes(filterValue)
                );
            }

            if (match) count++;
        });

        return count;
    }

    /**
     * Get static count for a filter option
     * @param {string} filterKey - Filter key
     * @param {string} filterValue - Filter value
     * @returns {number} Static count
     */
    getStaticCount(filterKey, filterValue) {
        return this.staticFilterCounts.get(`${filterKey}:${filterValue}`) || 0;
    }
}

export default FilterManager;
