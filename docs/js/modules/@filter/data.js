/**
 * @file Filter Data Helpers
 * @description Pure data helpers for building filter groups and computing counts.
 */

/// <reference path="../../types.js" />

import { addToHierarchy, countHierarchyItems } from './filter-hierarchy.js';

function getDatasetEndEffectors(ds) {
    if (Array.isArray(ds.endEffectors)) return ds.endEffectors;
    if (ds.endEffector) return [ds.endEffector];
    return [];
}

/**
 * Build filter groups from datasets.
 * @param {Dataset[]} datasets
 * @returns {Object<string, FilterGroup>}
 */
export function buildFilterGroups(datasets) {
    const groups = {
        'frame range': {
            title: 'frame range',
            values: new Set(),
            type: 'flat'
        },
        'scene': {
            title: 'scene',
            values: new Set(),
            type: 'flat'
        },
        'robot': {
            title: 'robot',
            values: new Set(),
            type: 'flat'
        },
        'end': {
            title: 'end effector',
            values: new Set(),
            type: 'flat'
        },
        'action': {
            title: 'action',
            values: new Set(),
            type: 'flat'
        },
        'object': {
            title: 'operation object',
            values: new Map(),
            type: 'hierarchical'
        }
    };

    datasets.forEach(ds => {
        if (ds.frameRange) {
            groups['frame range'].values.add(ds.frameRange);
        }

        if (ds.scenes) {
            ds.scenes.forEach(scene => groups.scene.values.add(scene));
        }
        if (ds.robot) {
            const robots = Array.isArray(ds.robot) ? ds.robot : [ds.robot];
            robots.forEach(r => groups.robot.values.add(r));
        }
        const endEffectors = getDatasetEndEffectors(ds);
        endEffectors.forEach(value => groups.end.values.add(value));
        if (ds.actions) {
            ds.actions.forEach(action => groups.action.values.add(action));
        }

        if (ds.objects) {
            ds.objects.forEach(obj => {
                addToHierarchy(groups.object.values, obj.hierarchy);
            });
        }
    });

    return groups;
}

/**
 * Calculate affected dataset count for a specific filter option.
 * @param {Dataset[]} datasets
 * @param {string} filterKey
 * @param {string} filterValue
 * @returns {number}
 */
export function calculateAffectedCount(datasets, filterKey, filterValue) {
    let count = 0;

    datasets.forEach(ds => {
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
 * Calculate static counts for all filter options.
 * @param {Dataset[]} datasets
 * @param {Object<string, FilterGroup>} filterGroups
 * @returns {Map<string, number>}
 */
export function calculateStaticFilterCounts(datasets, filterGroups) {
    const staticCounts = new Map();

    for (const [key, group] of Object.entries(filterGroups)) {
        if (group.type === 'flat') {
            group.values.forEach(value => {
                const count = calculateAffectedCount(datasets, key, value);
                staticCounts.set(`${key}:${value}`, count);
            });
        } else if (group.type === 'hierarchical') {
            calculateStaticHierarchyCounts(datasets, key, group.values, staticCounts);
        }
    }

    return staticCounts;
}

/**
 * Calculate static hierarchy counts recursively and fill into map.
 * @param {Dataset[]} datasets
 * @param {string} key
 * @param {Map} hierarchyMap
 * @param {Map<string, number>} staticCounts
 */
export function calculateStaticHierarchyCounts(datasets, key, hierarchyMap, staticCounts) {
    hierarchyMap.forEach((node, value) => {
        const count = calculateAffectedCount(datasets, key, value);
        staticCounts.set(`${key}:${value}`, count);

        if (node.children.size > 0) {
            calculateStaticHierarchyCounts(datasets, key, node.children, staticCounts);
        }
    });
}

/**
 * Calculate total item count for a category (flat or hierarchical).
 * @param {Object<string, FilterGroup>} filterGroups
 * @param {string} categoryKey
 * @returns {number}
 */
export function getCategoryItemCount(filterGroups, categoryKey) {
    const group = filterGroups[categoryKey];
    if (!group) return 0;

    if (group.type === 'flat') {
        return group.values.size;
    } else if (group.type === 'hierarchical') {
        return countHierarchyItems(group.values);
    }
    return 0;
}

export default {
    buildFilterGroups,
    calculateAffectedCount,
    calculateStaticFilterCounts,
    calculateStaticHierarchyCounts,
    getCategoryItemCount
};

