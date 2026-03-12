import ConfigManager from './config.js';

/**
 * @file Robot Aliases Module
 * @description Lightweight manager for robot display names and search aliases.
 *              Loads a JSON dictionary of robot IDs -> { common_name, aliases[] }.
 */

class RobotAliasManager {
    constructor() {
        /**
         * @type {Object.<string, { common_name?: string, aliases?: string[] }>}
         */
        this.aliasMap = {};

        /** @type {boolean} */
        this.loaded = false;

        /** @type {Promise<Object>|null} */
        this.loadingPromise = null;
    }

    /**
     * Load alias map from JSON file.
     * @param {import('./config.js').ConfigManager['getConfig'] extends () => infer C ? C : any} config
     *        Application config with paths.info.
     * @returns {Promise<Object>} Loaded alias map object
     */
    async load(config) {
        if (this.loaded) {
            return this.aliasMap;
        }
        if (this.loadingPromise) {
            return this.loadingPromise;
        }

        const infoPath =
            config?.paths?.info ||
            `${ConfigManager.getDefaultRemoteAssetsRoot()}/info`;
        const url = `${infoPath}/robot_aliases.json`;

        this.loadingPromise = (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) {
                    console.warn(`[RobotAliasManager] Alias file not found at ${url}. Status: ${res.status}`);
                    this.aliasMap = {};
                } else {
                    const data = await res.json();
                    if (data && typeof data === 'object') {
                        this.aliasMap = data;
                    } else {
                        this.aliasMap = {};
                    }
                }
            } catch (err) {
                console.warn('[RobotAliasManager] Failed to load robot_aliases.json:', err);
                this.aliasMap = {};
            } finally {
                this.loaded = true;
            }

            return this.aliasMap;
        })();

        return this.loadingPromise;
    }

    /**
     * Get raw alias entry for a robot ID.
     * Tries exact key first, then case-insensitive match so that dataset robot_type
     * (e.g. "G1EDU-U3") still resolves to the same entry as alias key "G1edu-u3".
     * @param {string} robotId
     * @returns {{ common_name?: string, aliases?: string[] } | null}
     */
    getAliasEntry(robotId) {
        if (!robotId) return null;
        const idStr = String(robotId);
        if (this.aliasMap[idStr]) return this.aliasMap[idStr];
        const idLower = idStr.toLowerCase();
        const key = Object.keys(this.aliasMap).find(k => k.toLowerCase() === idLower);
        return key ? this.aliasMap[key] : null;
    }

    /**
     * Get preferred display name for a robot.
     * Falls back to the original ID when no alias is configured.
     * @param {string} robotId
     * @returns {string}
     */
    getDisplayName(robotId) {
        if (!robotId) return '';
        const entry = this.getAliasEntry(robotId);
        return (entry && entry.common_name) || robotId;
    }

    /**
     * Build a list of search tokens for a robot entry:
     * - Original ID
     * - common_name (if present)
     * - All aliases (if present)
     * @param {string} robotId
     * @returns {string[]} Tokens for search
     */
    getSearchTokensForRobot(robotId) {
        const tokens = [];
        if (!robotId) return tokens;

        const idStr = String(robotId);
        tokens.push(idStr);

        const entry = this.getAliasEntry(idStr);
        if (entry) {
            if (entry.common_name) {
                tokens.push(String(entry.common_name));
            }
            if (Array.isArray(entry.aliases)) {
                entry.aliases.forEach(alias => {
                    if (alias) {
                        tokens.push(String(alias));
                    }
                });
            }
        }

        return tokens;
    }

    /**
     * Get all configured robot IDs from the alias map.
     * @returns {string[]}
     */
    getAliasKeys() {
        return Object.keys(this.aliasMap);
    }

    /**
     * Resolve a robot id (may be alias or key) to the canonical key in alias map.
     * Tries exact key, case-insensitive key, then any key whose common_name or aliases contain this id.
     * @param {string} robotId
     * @returns {string|null} Canonical key or null
     */
    getCanonicalRobotKey(robotId) {
        if (!robotId) return null;
        const idStr = String(robotId).trim();
        if (this.aliasMap[idStr]) return idStr;
        const idLower = idStr.toLowerCase();
        const byKey = Object.keys(this.aliasMap).find(k => k.toLowerCase() === idLower);
        if (byKey) return byKey;
        for (const [key, entry] of Object.entries(this.aliasMap)) {
            if (entry.common_name && String(entry.common_name).toLowerCase() === idLower) return key;
            if (Array.isArray(entry.aliases) && entry.aliases.some(a => a && String(a).toLowerCase() === idLower)) return key;
        }
        return null;
    }

    /**
     * Find robot map keys whose tokens (id, common_name, aliases) contain the query.
     * Used for search: when user types e.g. "宇树", returns ["G1edu-u3"] so that
     * datasets with robot "G1edu-u3" (or case variant) match even if getSearchTokensForRobot
     * was not used (e.g. robot_type key mismatch or missing in data).
     * @param {string} query - Search substring (will be compared case-insensitively for ASCII)
     * @returns {string[]} Canonical robot keys from alias map that have query in their tokens
     */
    getRobotIdsByAlias(query) {
        if (!query || typeof query !== 'string') return [];
        const q = query.trim();
        if (!q) return [];
        const qLower = q.toLowerCase();
        const result = [];
        Object.keys(this.aliasMap).forEach(robotKey => {
            const tokens = this.getSearchTokensForRobot(robotKey);
            const hasMatch = tokens.some(t =>
                typeof t === 'string' && t.toLowerCase().includes(qLower)
            );
            if (hasMatch) result.push(robotKey);
        });
        return result;
    }
}

// Export singleton instance
const instance = new RobotAliasManager();
export default instance;
