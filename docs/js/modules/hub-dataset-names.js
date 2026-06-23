import ConfigManager from './config.js';

/**
 * @file Hub Dataset Names Module
 * @description Maps local dataset names to hub-specific remote repository names
 *              for robocoin-download --ds_lists (HF / ModelScope naming differs from UI).
 */

class HubDatasetNamesManager {
    constructor() {
        /** @type {{ huggingface?: Record<string, string>, modelscope?: Record<string, string> }} */
        this.hubMaps = { huggingface: {}, modelscope: {} };

        /** @type {boolean} */
        this.loaded = false;

        /** @type {Promise<Object>|null} */
        this.loadingPromise = null;
    }

    /**
     * @param {import('./config.js').ConfigManager['getConfig'] extends () => infer C ? C : any} config
     * @returns {Promise<Object>}
     */
    async load(config) {
        if (this.loaded) {
            return this.hubMaps;
        }
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        const infoPath =
            config?.paths?.info ||
            `${ConfigManager.getDefaultRemoteAssetsRoot()}/info`;
        const url = `${infoPath}/hub_dataset_names.json`;

        this.loadingPromise = (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`[HubDatasetNames] Mapping file not found at ${url}. Status: ${res.status}`);
                    this.hubMaps = { huggingface: {}, modelscope: {} };
                } else {
                    const data = await res.json();
                    this.hubMaps = {
                        huggingface: data?.huggingface && typeof data.huggingface === 'object' ? data.huggingface : {},
                        modelscope: data?.modelscope && typeof data.modelscope === 'object' ? data.modelscope : {},
                    };
                }
            } catch (err) {
                console.warn('[HubDatasetNames] Failed to load hub_dataset_names.json:', err);
                this.hubMaps = { huggingface: {}, modelscope: {} };
            } finally {
                this.loaded = true;
            }
            return this.hubMaps;
        })();

        return this.loadingPromise;
    }

    /**
     * Resolve local UI name to the name expected by robocoin-download on the given hub.
     * @param {string} localName
     * @param {string} hub - 'huggingface' or 'modelscope'
     * @returns {string}
     */
    resolveHubName(localName, hub) {
        if (!localName) return localName;
        const map = this.hubMaps[hub];
        if (map && map[localName]) {
            return map[localName];
        }
        return localName;
    }

    /**
     * @param {string[]} localNames
     * @param {string} hub
     * @returns {string[]}
     */
    resolveHubNames(localNames, hub) {
        return localNames.map(name => this.resolveHubName(name, hub));
    }
}

const instance = new HubDatasetNamesManager();
export default instance;
