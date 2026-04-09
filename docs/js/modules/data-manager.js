/**
 * @file Data Manager Module
 * @description Handles dataset loading, caching, and indexing
 */

/// <reference path="../types.js" />

import ConfigManager from './config.js';
import RobotAliasManager from './robot-aliases.js';

/**
 * Data Manager Class
 * Manages dataset loading, caching, and indexing
 */
export class DataManager {
    constructor() {
        /** @type {Dataset[]} */
        this.datasets = [];
        
        /** @type {Map<string, Dataset>} */
        this.datasetMap = new Map();
        
        /** @type {Object} */
        this.config = ConfigManager.getConfig();

        /** @type {string[]|null} */
        this._datasetAliasKeys = null;

        /** @type {Set<string>} */
        this.excludedDatasets = new Set();
    }
    
    /**
     * Load dataset exclusion list from exclude.json if available
     * @returns {Promise<void>}
     */
    async loadExcludedDatasets() {
        // Check if exclusions are enabled
        if (this.config.enableExclude === false) {
            console.log('INFO: Dataset exclusions are disabled (enableExclude: false). Skipping exclude.json.');
            return;
        }

        try {
            const response = await fetch(`${this.config.paths.info}/exclude.json`);
            if (!response.ok) {
                console.warn(`WARN: Failed to load assets/info/exclude.json (${response.status}). Continuing without exclusions.`);
                return;
            }

            const exclusions = await response.json();
            if (Array.isArray(exclusions)) {
                exclusions
                    .map(name => typeof name === 'string' ? name.trim() : '')
                    .filter(Boolean)
                    .forEach(name => this.excludedDatasets.add(name));
                console.log(`INFO: Loaded ${this.excludedDatasets.size} excluded datasets.`);
            }
        } catch (error) {
            console.warn('WARN: Could not load assets/info/exclude.json. Continuing without exclusions.', error);
        }
    }
    
    /**
     * Load all datasets
     * @param {HTMLElement} loadingProgress - Loading progress element
     * @param {HTMLElement} loadingBar - Loading bar element
     * @returns {Promise<Dataset[]>} Loaded datasets
     */
    async loadDatasets(loadingProgress, loadingBar) {
        try {
            // Refresh config to ensure we have the latest values after JSON is loaded
            this.config = ConfigManager.getConfig();
            await this.loadExcludedDatasets();

            console.log('INFO: Attempting to load consolidated JSON (preferred)...');
            const startTime = performance.now();

            loadingProgress.textContent = 'Loading consolidated data...';
            loadingBar.style.width = '10%';

            try {
                console.log('INFO: Fetching consolidated_datasets.json...');
                const res = await fetch(`${this.config.paths.info}/consolidated_datasets.json`);

                if (res.ok) {
                    console.log('INFO: Consolidated JSON found! Processing...');
                    loadingBar.style.width = '50%';

                    const allData = await res.json();
                    loadingBar.style.width = '75%';

                    const datasetCount = Object.keys(allData).length;
                    console.log(`OK: Loaded ${datasetCount} datasets from consolidated JSON`);

                    this.datasets = Object.entries(allData).map(([path, raw]) => this.createDatasetObject(path, raw));
                    this.applyExclusions();

                    loadingProgress.textContent = `${this.datasets.length} datasets loaded`;
                    loadingBar.style.width = '100%';

                    const endTime = performance.now();
                    const loadTime = (endTime - startTime).toFixed(2);

                    console.log(`OK: Loaded ${this.datasets.length} datasets in ${loadTime}ms (${(loadTime / this.datasets.length).toFixed(2)}ms per dataset)`);
                    console.log('OK: Using optimized consolidated JSON!');

                    return this.datasets;
                } else if (res.status === 404) {
                    console.warn('WARN: Consolidated JSON not found (404). This is expected in development.');
                } else {
                    console.warn(`WARN: Consolidated JSON request failed (${res.status}). Will try YAML fallback.`);
                }
            } catch (jsonError) {
                console.warn('WARN: Failed to fetch consolidated JSON:', jsonError.message);
            }

            console.log('INFO: Falling back to YAML mode...');
            await this.loadDatasetsFromYAML(loadingProgress, loadingBar);
            this.applyExclusions();
            return this.datasets;

        } catch (err) {
            console.error('Failed to load datasets:', err);
            throw err;
        }
    }

    /**
     * Remove excluded datasets from the in-memory list
     */
    applyExclusions() {
        if (this.excludedDatasets.size === 0) {
            return;
        }

        const beforeCount = this.datasets.length;
        this.datasets = this.datasets.filter(dataset => {
            const name = dataset?.name || '';
            const path = dataset?.path || '';
            return !this.excludedDatasets.has(name) && !this.excludedDatasets.has(path);
        });

        const removed = beforeCount - this.datasets.length;
        if (removed > 0) {
            console.log(`INFO: Excluded ${removed} datasets defined in assets/info/exclude.json.`);
        }
    }
    
    /**
     * Map robot_type from robot_name only.
     * @param {Object} raw - Top-level raw object
     * @returns {string}
     */
    _mapRobotType(raw) {
        const robotName = raw?.robot_name;
        if (Array.isArray(robotName)) {
            const first = robotName.find(v => typeof v === 'string' && v.trim() !== '');
            return first ? first.trim() : '';
        }
        if (typeof robotName === 'string') {
            return robotName.trim();
        }
        return '';
    }

    /**
     * Map scene_type to page field with hierarchy structure.
     * If scene_type is object {level1..level5}, preserve hierarchy for UI filter.
     * @param {Object} raw - Top-level raw object
     * @returns {Object} { hierarchy: string[] }
     */
    _mapSceneType(raw) {
        const src = raw?.scene_type;
        if (src == null) return { hierarchy: [] };
        if (Array.isArray(src)) {
            return { hierarchy: src.filter(v => v != null && String(v).trim() !== '').map(v => String(v).trim()) };
        }
        if (typeof src === 'object' && !Array.isArray(src)) {
            const hierarchy = [src.level1, src.level2, src.level3, src.level4, src.level5]
                .filter(v => v != null && String(v).trim() !== '')
                .map(v => String(v).trim());
            return { hierarchy };
        }
        if (typeof src === 'string' && src.trim() !== '') return { hierarchy: [src.trim()] };
        return { hierarchy: [] };
    }

    /**
     * Map tasks from task_instruction only.
     * @param {Object} raw - Top-level raw object
     * @returns {string}
     */
    _mapTasks(raw) {
        const taskInstruction = raw?.task_instruction;
        if (taskInstruction != null) {
            if (typeof taskInstruction === 'string' && taskInstruction.trim() !== '') return taskInstruction.trim();
            if (Array.isArray(taskInstruction) && taskInstruction.length > 0) {
                const first = taskInstruction.find(v => v != null && String(v).trim() !== '');
                return first != null ? String(first).trim() : '';
            }
        }
        return '';
    }

    /**
     * Map frame_range directly from frame_range field.
     * @param {Object} raw - Top-level raw object
     * @returns {string}
     */
    _mapFrameRange(raw) {
        const explicit = raw?.frame_range;
        if (explicit != null && String(explicit).trim() !== '') return String(explicit).trim();
        return '';
    }

    /**
     * Map dataset_size directly from dataset_size field.
     * @param {Object} raw - Top-level raw object
     * @returns {string|number}
     */
    _mapDatasetSize(raw) {
        const top = raw?.dataset_size;
        if (top != null && (typeof top === 'string' ? top.trim() !== '' : true)) return top;
        return '';
    }

    /**
     * Create dataset object from raw data.
     * Applies page-field mapping per DATA-REQUIREMENTS (info.yaml -> page fields).
     * @param {string} path - Dataset path (from consolidated key or YAML filename stem)
     * @param {Object} raw - Raw dataset data (info.yaml shape)
     * @returns {Dataset} Dataset object with page field names
     */
    createDatasetObject(path, raw) {
        const rawData = raw.raw || {};

        const originalName = raw.dataset_name || path || '';
        const displayName = this.mapDatasetDisplayName(originalName);

        const robotType = this._mapRobotType(raw);
        const sceneTypeArr = this._mapSceneType(raw);
        const tasksStr = this._mapTasks(raw);
        const frameRangeStr = this._mapFrameRange(raw);
        const datasetSizeVal = this._mapDatasetSize(raw);

        const endEffectors = (() => {
            const source = raw.end_effector_type;
            if (source === undefined || source === null) return [];
            const values = Array.isArray(source) ? source : [source];
            return values
                .map(value => typeof value === 'string' ? value.trim() : value)
                .filter(value => value);
        })();

        const statistics = raw.statistics || {};
        const atomicActions = Array.isArray(raw.atomic_actions) ? raw.atomic_actions : [];
        const rawObjects = Array.isArray(raw.objects) ? raw.objects : [];

        return {
            path: path,
            name: originalName,
            displayName,
            video_url: `${this.config.paths.videos}/${path}.mp4`,
            thumbnail_url: `${this.config.paths.assetsRoot}/thumbnails/${path}.jpg`,
            description: tasksStr,
            scenes: sceneTypeArr,
            actions: atomicActions,
            atomic_actions: atomicActions,
            objects: (function() {
                return rawObjects.map(obj => ({
                    name: obj.object_name,
                    hierarchy: [
                        obj.level1,
                        obj.level2,
                        obj.level3,
                        obj.level4,
                        obj.level5
                    ].filter(level => level !== null && level !== undefined)
                }));
            })(),
            robot: robotType || undefined,
            endEffector: endEffectors[0] || undefined,
            endEffectors,
            platformHeight: raw.operation_platform_height,

            frameRange: frameRangeStr || undefined,
            datasetSize: datasetSizeVal || undefined,
            statistics,

            cameras: raw.cameras || rawData.cameras || [],
            license: raw.license || rawData.license,
            tags: raw.tags || rawData.tags || [],
            robot_type: robotType,

            dataset_uuid: raw.dataset_uuid || rawData.dataset_uuid,
            language: raw.language || rawData.language || [],
            task_categories: raw.task_categories || rawData.task_categories || [],
            sub_tasks: raw.sub_tasks || rawData.sub_tasks || [],
            annotations: raw.annotations || rawData.annotations || {},
            authors: raw.authors || rawData.authors || {},
            homepage: raw.homepage || rawData.homepage,
            paper: raw.paper || rawData.paper,
            repository: raw.repository || rawData.repository,
            issues_url: raw.issues_url || rawData.issues_url,
            project_page: raw.project_page || rawData.project_page,
            contact_email: raw.contact_email || rawData.contact_email,
            contact_info: raw.contact_info || rawData.contact_info,
            support_info: raw.support_info || rawData.support_info,
            citation_bibtex: raw.citation_bibtex || rawData.citation_bibtex,
            additional_citations: raw.additional_citations || rawData.additional_citations,
            version_info: raw.version_info || rawData.version_info,
            codebase_version: raw.codebase_version || rawData.codebase_version,
            depth_enabled: raw.depth_enabled || rawData.depth_enabled,
            data_schema: raw.data_schema || rawData.data_schema,
            structure: raw.structure || rawData.structure,
            tasks: tasksStr,

            getAllScenes: function() { return this.scenes?.hierarchy || []; },
            hasScene: function(sceneType) { return (this.scenes?.hierarchy || []).includes(sceneType); },
            getObjectsByLevel: function(level, value) {
                return this.objects.filter(obj => obj.hierarchy[level - 1] === value);
            },
            getTopLevelCategories: function() {
                return [...new Set(this.objects.map(obj => obj.hierarchy[0]))];
            }
        };
    }

    /**
     * Get alias keys sorted by length (longest first) for dataset name matching.
     * @returns {string[]}
     */
    getSortedAliasKeys() {
        if (this._datasetAliasKeys) return this._datasetAliasKeys;
        const keys = RobotAliasManager.getAliasKeys() || [];
        const filteredKeys = keys.filter(key => typeof key === 'string' && key.length > 0);
        filteredKeys.sort((a, b) => b.length - a.length);
        this._datasetAliasKeys = filteredKeys;
        return this._datasetAliasKeys;
    }

    /**
     * Map dataset name to its display name based on robot alias prefixes.
     * @param {string} datasetName
     * @returns {string}
     */
    mapDatasetDisplayName(datasetName) {
        if (!datasetName) return '';
        const aliasKeys = this.getSortedAliasKeys();
        for (const key of aliasKeys) {
            if (!key) continue;
            if (datasetName === key) {
                return RobotAliasManager.getDisplayName(key);
            }
            if (datasetName.startsWith(`${key}_`)) {
                const suffix = datasetName.slice(key.length);
                return `${RobotAliasManager.getDisplayName(key)}${suffix}`;
            }
        }
        return datasetName;
    }
    
    /**
     * Load datasets from YAML files (fallback)
     * @param {HTMLElement} loadingProgress - Loading progress element
     * @param {HTMLElement} loadingBar - Loading bar element
     * @returns {Promise<void>}
     */
    async loadDatasetsFromYAML(loadingProgress, loadingBar) {
        try {
            loadingProgress.innerHTML = `
                <div style="color: #ff9800;">Loading data index...</div>
                <div style="font-size: 11px; margin-top: 4px; color: #666;">YAML mode active (slower than JSON mode)</div>
            `;
            loadingBar.style.width = '5%';
            
            const indexRes = await fetch(`${this.config.paths.info}/data_index.json`);
            if (!indexRes.ok) {
                throw new Error('data_index.json not found');
            }
            
            const indexData = await indexRes.json();
            // data_index.json: prefer { "datasets": ["path/without/ext", ...], "count": N }; else array or object keys
            let fileList = indexData?.datasets;
            if (!Array.isArray(fileList)) fileList = Array.isArray(indexData) ? indexData : Object.keys(indexData || {});
            
            loadingProgress.innerHTML = `
                <div style="color: #ff9800;">Loading ${fileList.length} YAML files...</div>
                <div style="font-size: 11px; margin-top: 4px; color: #666;">This may take a minute. Consider adding consolidated JSON for faster loading.</div>
            `;
            loadingBar.style.width = '10%';
            
            // Import js-yaml dynamically if needed
            if (typeof jsyaml === 'undefined') {
                loadingProgress.innerHTML = `
                    <div>Loading YAML parser...</div>
                    <div style="font-size: 11px; margin-top: 4px; color: #666;">One-time download from CDN</div>
                `;
                await this.loadJsYamlLibrary();
            }
            
            // Load YAML files one by one. Entry is path (with or without .yml/.yaml); path stem used as key.
            const allData = {};
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const path = typeof file === 'string' ? file.replace(/\.ya?ml$/i, '') : '';
                const requestPath = path && !/\.ya?ml$/i.test(String(file)) ? `${path}.yaml` : file;
                try {
                    let yamlRes = await fetch(`${this.config.paths.datasetInfo}/${requestPath}`);
                    if (!yamlRes.ok && requestPath.endsWith('.yaml')) {
                        yamlRes = await fetch(`${this.config.paths.datasetInfo}/${path}.yml`);
                    }
                    const yamlText = await yamlRes.text();
                    const parsed = jsyaml.load(yamlText);
                    allData[path] = parsed;
                    
                    // Update progress
                    const progress = 10 + (i / fileList.length) * 80;
                    loadingBar.style.width = `${progress}%`;
                    
                    if (i % 50 === 0 || i === fileList.length - 1) {
                        loadingProgress.innerHTML = `
                            <div style="color: #ff9800;">Loading YAML files: ${i + 1}/${fileList.length}</div>
                            <div style="font-size: 20px; font-weight: 700; margin-top: 8px; color: #ff9800; text-align: center;">${Math.round((i / fileList.length) * 100)}% complete</div>
                        `;
                    }
                } catch (err) {
                    console.warn(`Failed to load ${file}:`, err);
                }
            }
            
            loadingProgress.innerHTML = `
                <div style="color: #4caf50;">Processing datasets...</div>
                <div style="font-size: 11px; margin-top: 4px; color: #666;">Almost done!</div>
            `;
            loadingBar.style.width = '95%';
            
            // Convert to dataset objects (same as consolidated JSON flow)
            this.datasets = Object.entries(allData).map(([path, raw]) => this.createDatasetObject(path, raw));
            
            loadingProgress.innerHTML = `
                <div style="color: #4caf50; font-weight: 600;">OK: ${this.datasets.length} datasets loaded (YAML mode)</div>
                <div style="font-size: 11px; margin-top: 4px; color: #666;">Tip: Add consolidated JSON for faster loading next time</div>
            `;
            loadingBar.style.width = '100%';
            
            console.log(`OK: Loaded ${this.datasets.length} datasets from YAML files`);
            console.info('TIP: Run scripts/opti_init.py to generate optimized files for faster loading');
            
        } catch (err) {
            console.error('Failed to load datasets from YAML:', err);
            throw err;
        }
    }
    
    /**
     * Load js-yaml library dynamically
     * @returns {Promise<void>}
     */
    async loadJsYamlLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Build dataset index for fast lookups
     */
    buildDatasetIndex() {
        this.datasetMap.clear();
        this.datasets.forEach(ds => {
            this.datasetMap.set(ds.path, ds);
        });
        console.log('OK: Dataset index built:', this.datasetMap.size, 'items');
    }
    
    /**
     * Get dataset by path
     * @param {string} path - Dataset path
     * @returns {Dataset|undefined} Dataset object
     */
    getDataset(path) {
        return this.datasetMap.get(path);
    }
    
    /**
     * Get all datasets
     * @returns {Dataset[]} All datasets
     */
    getAllDatasets() {
        return this.datasets;
    }
    
    /**
     * Get datasets count
     * @returns {number} Number of datasets
     */
    getCount() {
        return this.datasets.length;
    }
}

// Export singleton instance
export default new DataManager();
