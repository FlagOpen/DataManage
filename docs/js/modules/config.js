/**
 * @file Configuration Manager Module
 * @description Centralized configuration management for the RoboCOIN application
 */

/**
 * @typedef {Object} GridConfig
 * @property {number} minCardWidth - Minimum card width in pixels
 * @property {number} cardHeight - Card height in pixels
 * @property {number} gap - Gap between grid items
 * @property {number} columns - Number of columns
 * @property {number} bufferRows - Buffer rows for virtual scrolling
 * @property {number} padding - Grid padding
 */

/**
 * @typedef {Object} SelectionConfig
 * @property {number} itemHeight - Selection item height
 * @property {number} padding - Selection item padding
 * @property {number} bufferItems - Buffer items for virtual scrolling
 */

/**
 * @typedef {Object} ObserverConfig
 * @property {number} margin - Observer margin
 * @property {number} threshold - Observer threshold
 */

/**
 * @typedef {Object} TimingConfig
 * @property {number} hoverDelay - Hover delay in ms
 * @property {number} resizeDebounce - Resize debounce in ms
 * @property {number} scrollThrottle - Scroll throttle in ms
 * @property {number} transitionDuration - Transition duration in ms
 * @property {number} fadeDuration - Fade duration in ms
 */


/**
 * @typedef {Object} PathsConfig
 * @property {string} assetsRoot - Root path for assets
 * @property {string} info - Path for info JSON files
 * @property {string} datasetInfo - Path for dataset info files
 * @property {string} videos - Path for video files
 */

/**
 * @typedef {Object} DownloadCommandConfig
 * @property {string} command - Download command name (e.g., 'robocoin-download')
 * @property {string} hubParam - Hub parameter name (e.g., '--hub')
 * @property {string} datasetsParam - Datasets list parameter name (e.g., '--ds_lists')
 * @property {string} targetDirParam - Target directory parameter name (e.g., '--target-dir')
 * @property {string} lineContinuation - Line continuation character (e.g., ' \\')
 * @property {string} lineBreak - Line break character (e.g., '\n')
 * @property {string} datasetSeparator - Separator between datasets in the list
 */

/**
 * @typedef {Object} AppConfig
 * @property {Object} layout - Layout configuration
 * @property {GridConfig} grid - Grid configuration
 * @property {SelectionConfig} selection - Selection panel configuration
 * @property {ObserverConfig} observer - Intersection observer configuration
 * @property {Object} badge - Badge configuration
 * @property {TimingConfig} timing - Timing configuration
 * @property {Object} preview - Preview card configuration
 * @property {Object} ui - UI element configuration
 * @property {Object} loading - Loading configuration
 * @property {PathsConfig} paths - Path configuration
 * @property {DownloadCommandConfig} downloadCommand - Download command configuration
 */

/**
 * Configuration Manager
 * Reads configuration values from CSS variables and provides type-safe access
 * Loads base configuration from config.json for easy editing
 */
class ConfigManager {
    /**
     * Cached JSON configuration
     * @type {Object|null}
     */
    static _jsonConfig = null;

    /**
     * Promise for loading JSON config (prevents multiple loads)
     * @type {Promise<Object>|null}
     */
    static _configLoadPromise = null;

    /**
     * Load configuration from config.json
     * @returns {Promise<Object>} Loaded configuration object
     */
    static async loadJsonConfig() {
        if (this._jsonConfig !== null) {
            return this._jsonConfig;
        }

        if (this._configLoadPromise) {
            return this._configLoadPromise;
        }

        this._configLoadPromise = (async () => {
            try {
                const response = await fetch('./js/config/config.json');
                if (!response.ok) {
                    console.warn('[ConfigManager] Failed to load js/config/config.json, using hardcoded defaults');
                    this._jsonConfig = {};
                    return this._jsonConfig;
                }
                this._jsonConfig = await response.json();
                return this._jsonConfig;
            } catch (error) {
                console.warn('[ConfigManager] Error loading js/config/config.json:', error);
                this._jsonConfig = {};
                return this._jsonConfig;
            }
        })();

        return this._configLoadPromise;
    }

    /**
     * Get a value from JSON config with fallback
     * @param {string} path - Dot-separated path (e.g., 'assets.defaultRemoteAssetsRoot')
     * @param {*} fallback - Fallback value if not found
     * @returns {*} Config value or fallback
     */
    static getJsonValue(path, fallback = null) {
        if (!this._jsonConfig) {
            return fallback;
        }

        const keys = path.split('.');
        let value = this._jsonConfig;
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return fallback;
            }
        }
        return value !== undefined ? value : fallback;
    }

    /**
     * Get a CSS variable value with fallback
     * @param {string} propertyName - CSS variable name (with or without --)
     * @param {*} defaultValue - Default value if CSS variable not found
     * @returns {string|number} - Parsed value
     */
    static getCSSValue(propertyName, defaultValue = null) {
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(propertyName)
            .trim();
        
        if (!value && defaultValue !== null) {
            return defaultValue;
        }
        
        // Handle values with units (px, ms, s)
        if (value.endsWith('px') || value.endsWith('ms') || value.endsWith('s')) {
            return parseFloat(value);
        }
        // Handle decimal values
        if (value.includes('.')) {
            return parseFloat(value);
        }
        // Handle integer values
        if (!isNaN(value)) {
            return parseInt(value, 10);
        }
        return value || defaultValue;
    }

    /**
     * Normalize asset root paths by stripping trailing slashes.
     * @param {string} path
     * @returns {string}
     */
    static normalizeAssetsRoot(path) {
        const fallback = this.getDefaultRemoteAssetsRoot();
        if (!path || typeof path !== 'string') {
            return fallback;
        }

        const normalized = path.trim().replace(/\/+$/, '');
        if (!normalized || normalized === '.') {
            return fallback;
        }

        return normalized;
    }

    /**
     * Default Hugging Face dataset location for assets.
     * Loads from config.json if available, otherwise uses hardcoded default.
     * @returns {string}
     */
    static getDefaultRemoteAssetsRoot() {
        const jsonValue = this.getJsonValue('assets.defaultRemoteAssetsRoot');
        if (jsonValue) {
            return jsonValue;
        }
        // Fallback to hardcoded value if JSON not loaded or value missing
        return 'https://huggingface.co/datasets/RogersPyke/RoboCOIN_DataManager_assets/resolve/main';
    }

    /**
     * Determine the active assets root.
     * - Query string ?assets=... or ?assetsRoot=... overrides everything (仅接受 https?://)
     * - window.ROBOCOIN_ASSETS_ROOT / window.__ASSETS_ROOT__ works for manual overrides
     * - 默认指向托管在 Hugging Face 的远程数据集，确保所有环境都一致
     * @returns {string}
     */
    static getAssetsRoot() {
        const defaultRemote = this.getDefaultRemoteAssetsRoot();

        if (typeof window === 'undefined') {
            return defaultRemote;
        }

        const search = window.location?.search || '';
        const params = new URLSearchParams(search);
        const override =
            window.ROBOCOIN_ASSETS_ROOT ||
            window.__ASSETS_ROOT__ ||
            params.get('assetsRoot') ||
            params.get('assets');

        if (override) {
            const trimmed = override.trim();
            const isRemote = /^https?:\/\//i.test(trimmed);

            if (isRemote) {
                return this.normalizeAssetsRoot(trimmed);
            }

            console.warn('[ConfigManager] Ignoring assets override because it is not an absolute http(s) URL.');
        }

        return this.normalizeAssetsRoot(defaultRemote);
    }

    /**
     * Get complete application configuration
     * Loads defaults from config.json, then applies CSS variable overrides
     * @returns {AppConfig} Complete configuration object
     */
    static getConfig() {
        const assetsRoot = this.normalizeAssetsRoot(this.getAssetsRoot());
        const infoPath = `${assetsRoot}/info`;
        const datasetInfoPath = `${assetsRoot}/dataset_info`;
        const videosPath = `${assetsRoot}/videos`;

        // Helper to get value: CSS variable > JSON config > hardcoded fallback
        const getValue = (cssVar, jsonPath, fallback) => {
            const cssValue = this.getCSSValue(cssVar, null);
            if (cssValue !== null) return cssValue;
            const jsonValue = this.getJsonValue(jsonPath);
            return jsonValue !== null ? jsonValue : fallback;
        };

        // Get download command config from JSON with fallbacks
        const downloadCmdJson = this._jsonConfig?.downloadCommand || {};
        const downloadCommand = {
            command: downloadCmdJson.command || 'robocoin-download',
            hubParam: downloadCmdJson.hubParam || '--hub',
            datasetsParam: downloadCmdJson.datasetsParam || '--ds_lists',
            targetDirParam: downloadCmdJson.targetDirParam || '--target-dir',
            lineContinuation: downloadCmdJson.lineContinuation || ' \\',
            lineBreak: downloadCmdJson.lineBreak || '\n',
            datasetSeparator: downloadCmdJson.datasetSeparator || ' \\\n',
            defaultPathComment: downloadCmdJson.defaultPathComment || '# the default download path is ~/.cache/huggingface/lerobot/, if you want to speicifiy download dir, please add',
            targetDirComment: downloadCmdJson.targetDirComment || '# --target-dir YOUR_DOWNLOAD_DIR'
        };

        return {
            enableExclude: this.getJsonValue('defaults.enableExclude', true),
            layout: {
                contentPadding: getValue('--content-padding', 'defaults.layout.contentPadding', 12)
            },
            grid: {
                minCardWidth: getValue('--grid-min-card-width', 'defaults.grid.minCardWidth', 180),
                cardHeight: getValue('--grid-card-height', 'defaults.grid.cardHeight', 300),
                gap: getValue('--grid-gap', 'defaults.grid.gap', 16),
                columns: getValue('--grid-columns', 'defaults.grid.columns', 4),
                bufferRows: getValue('--grid-buffer-rows', 'defaults.grid.bufferRows', 2),
                padding: getValue('--grid-padding', 'defaults.grid.padding', 12)
            },
            selection: {
                itemHeight: getValue('--selection-item-height', 'defaults.selection.itemHeight', 45),
                padding: getValue('--selection-item-padding', 'defaults.selection.padding', 16),
                bufferItems: getValue('--selection-buffer-items', 'defaults.selection.bufferItems', 20)
            },
            observer: {
                margin: getValue('--video-observer-margin', 'defaults.observer.margin', 200),
                threshold: getValue('--video-observer-threshold', 'defaults.observer.threshold', 0.1)
            },
            badge: {
                size: getValue('--badge-size', 'defaults.badge.size', 24),
                margin: getValue('--badge-margin', 'defaults.badge.margin', 8)
            },
            timing: {
                hoverDelay: getValue('--hover-delay', 'defaults.timing.hoverDelay', 800),
                resizeDebounce: getValue('--resize-debounce', 'defaults.timing.resizeDebounce', 200),
                scrollThrottle: getValue('--scroll-throttle', 'defaults.timing.scrollThrottle', 16),
                transitionDuration: getValue('--transition-duration', 'defaults.timing.transitionDuration', 200),
                fadeDuration: getValue('--fade-duration', 'defaults.timing.fadeDuration', 300)
            },
            preview: {
                maxWidth: getValue('--preview-card-max-width', 'defaults.preview.maxWidth', 320),
                minWidth: getValue('--preview-card-min-width', 'defaults.preview.minWidth', 240),
                padding: getValue('--preview-card-padding', 'defaults.preview.padding', 16),
                offset: getValue('--preview-card-offset', 'defaults.preview.offset', 8)
            },
            ui: {
                buttonSize: getValue('--button-size', 'defaults.ui.buttonSize', 32),
                iconSize: getValue('--icon-size', 'defaults.ui.iconSize', 16),
                borderRadius: getValue('--border-radius', 'defaults.ui.borderRadius', 4)
            },
            loading: {
                batchSize: getValue('--loading-batch-size', 'defaults.loading.batchSize', 150)
            },
            // Standard directory structure:
            // ./assets/
            //   ├── info/               - JSON index files (data_index.json, consolidated_datasets.json)
            //   ├── dataset_info/       - YAML metadata files (one per dataset)
            //   ├── thumbnails/         - Thumbnail images (*.jpg, provided by assets/thumbnails)
            //   └── videos/             - MP4 video files (named by dataset path)
            paths: {
                assetsRoot,
                info: infoPath,  // JSON index files following standard structure
                datasetInfo: datasetInfoPath,
                videos: videosPath
            },
            // Download command format configuration
            // Loaded from config.json for easy editing
            downloadCommand
        };
    }

    /**
     * Parse dataset size string to bytes.
     * Supports common units: B, KB/MB/GB/TB, KiB/MiB/GiB/TiB (case-insensitive).
     * @param {unknown} size
     * @returns {number|null} Size in bytes, or null if unparseable
     */
    static parseDatasetSizeToBytes(size) {
        if (size === undefined || size === null) return null;

        // Allow passing a numeric value that represents bytes
        if (typeof size === 'number' && isFinite(size)) {
            return size >= 0 ? size : null;
        }

        if (typeof size !== 'string') return null;

        const raw = size.trim();
        if (!raw) return null;

        // Match patterns like: "12GB", "12.3 GB", "1.2TiB", "800 MB", "1024B"
        const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?$/);
        if (!match) return null;

        const value = parseFloat(match[1]);
        if (!isFinite(value)) return null;

        const unitRaw = (match[2] || 'B').trim().toUpperCase();

        // Normalize some common variants
        const unit = unitRaw
            .replace(/^BYTES?$/, 'B')
            .replace(/^KIB$/, 'KIB')
            .replace(/^MIB$/, 'MIB')
            .replace(/^GIB$/, 'GIB')
            .replace(/^TIB$/, 'TIB');

        const SI = {
            B: 1,
            KB: 1e3,
            MB: 1e6,
            GB: 1e9,
            TB: 1e12
        };

        const IEC = {
            KIB: 1024,
            MIB: 1024 ** 2,
            GIB: 1024 ** 3,
            TIB: 1024 ** 4
        };

        if (SI[unit] !== undefined) return value * SI[unit];
        if (IEC[unit] !== undefined) return value * IEC[unit];

        // Extra tolerance: allow shorthand like "G", "T"
        if (unit === 'K') return value * SI.KB;
        if (unit === 'M') return value * SI.MB;
        if (unit === 'G') return value * SI.GB;
        if (unit === 'T') return value * SI.TB;

        return null;
    }

    /**
     * Format file size from bytes to human-readable string (GB or TB)
     * @param {number} totalBytes - Total size in bytes
     * @returns {string} Formatted size string (e.g., "1.5GB" or "0.3TB")
     */
    static formatFileSize(totalBytes) {
        const TB = 1e12;
        const GB = 1e9;
        const useTB = totalBytes >= TB;
        const value = useTB ? (totalBytes / TB) : (totalBytes / GB);
        const formatted = (Math.round(value * 10) / 10).toFixed(1);
        const unit = useTB ? 'TB' : 'GB';
        return `${formatted}${unit}`;
    }

    /**
     * Calculate total size in bytes from an array of datasets
     * @param {Dataset[]} datasets - Array of datasets
     * @returns {number|null} Total size in bytes, or null if no valid sizes found
     */
    static calculateTotalSizeFromDatasets(datasets) {
        if (!datasets || datasets.length === 0) {
            return null;
        }
        
        let totalBytes = 0;
        let hasValidSize = false;
        
        for (const ds of datasets) {
            const size = ds?.datasetSize;
            const bytes = this.parseDatasetSizeToBytes(size);
            if (bytes !== null) {
                totalBytes += bytes;
                hasValidSize = true;
            }
        }
        
        return hasValidSize ? totalBytes : null;
    }

    /**
     * Build the required storage comment for a list of datasets.
     * Rules:
     * - Use TB if total >= 1TB, otherwise GB
     * - Keep 1 decimal place
     * - If any dataset size is missing/unparseable, return placeholder ---GB/TB
     * @param {string[]} datasetPaths
     * @param {Map<string, Dataset>|null|undefined} datasetMap
     * @returns {string}
     */
    static buildRequiredStorageComment(datasetPaths, datasetMap) {
        if (!Array.isArray(datasetPaths) || datasetPaths.length === 0) {
            return '# Required storage:  0.0GB.\n# Disk usage may be larger.';
        }

        if (!datasetMap || typeof datasetMap.get !== 'function') {
            return '# Required storage:  ---GB/TB.\n# Disk usage may be larger.';
        }

        // Build datasets array from paths
        const datasets = datasetPaths.map(path => datasetMap.get(path)).filter(ds => ds !== undefined);
        const totalBytes = this.calculateTotalSizeFromDatasets(datasets);
        
        if (totalBytes === null) {
            return '# Required storage:  ---GB/TB.\n# Disk usage may be larger.';
        }
        
        const formattedSize = this.formatFileSize(totalBytes);
        return `# Required storage:  ${formattedSize}.\n# Disk usage may be larger.`;
    }

    /**
     * Get app metadata (version, title, etc.) from config.json
     * @returns {Object} App metadata
     */
    static getAppMetadata() {
        return {
            version: this.getJsonValue('app.version', 'v1.1'),
            title: this.getJsonValue('app.title', 'RoboCOIN-DataManager')
        };
    }

    /**
     * Generate download command string
     * @param {string} hub - Hub name (e.g., 'modelscope', 'huggingface')
     * @param {string[]} datasets - Array of dataset paths
     * @param {Map<string, Dataset>} [datasetMap] - Optional dataset map for size calculation
     * @returns {string} Generated download command
     */
    static generateDownloadCommand(hub, datasets, datasetMap = undefined) {
        const config = this.getConfig().downloadCommand;
        
        // First line: storage estimate comment (no blank line)
        const storageComment = this.buildRequiredStorageComment(datasets, datasetMap);

        // Format: robocoin-download \
        let command = `${storageComment}${config.lineBreak}${config.command}${config.lineContinuation}${config.lineBreak}`;
        
        // Format: --hub modelscope \
        command += `${config.hubParam} ${hub}${config.lineContinuation}${config.lineBreak}`;
        
        // Format: --ds_lists + each dataset on new line with continuation
        command += `${config.datasetsParam} `;
        if (datasets.length > 0) {
            const dsListContent = datasets.join(config.datasetSeparator);
            command += `${dsListContent}${config.lineBreak}`;
        } else {
            command += `${config.lineBreak}`;
        }
        
        // Add comments about download path (directly after command, no blank line)
        command += `${config.defaultPathComment}${config.lineBreak}`;
        command += `${config.targetDirComment}`;
        
        return command;
    }
}

// Export the ConfigManager
export default ConfigManager;
export { ConfigManager };

