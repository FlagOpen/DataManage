/**
 * @file Download Stats Module
 * @description Fetches and displays download statistics from local assets
 * 
 * @input: JSON file path from ConfigManager.paths.info
 * @output: { hfDownloads: number, msDownloads: number } or null on failure
 * @scenario: Display download counts for RoboCOIN on Huggingface and Modelscope
 */

import ConfigManager from './config.js';

/**
 * Download Stats Manager
 * Handles fetching and formatting of download statistics
 */
class DownloadStatsManager {
    /**
     * Cached stats data
     * @type {Object|null}
     */
    static _stats = null;

    /**
     * Load download statistics from local assets
     * @returns {Promise<Object|null>} Stats object or null on failure
     */
    static async loadStats() {
        if (this._stats !== null) {
            return this._stats;
        }

        try {
            const config = ConfigManager.getConfig();
            const statsUrl = `${config.paths.info}/download_stats.json`;

            const response = await fetch(statsUrl);
            if (!response.ok) {
                console.warn(`[DownloadStats] Failed to load download_stats.json: ${response.status}`);
                this._stats = null;
                return null;
            }

            const data = await response.json();
            
            const hfDownloads = data?.huggingface?.total_downloads ?? 0;
            const msDownloads = data?.modelscope?.total_downloads ?? 0;

            this._stats = {
                hfDownloads: Number(hfDownloads),
                msDownloads: Number(msDownloads),
                lastUpdated: data?.last_updated || null
            };

            console.log(`[DownloadStats] Loaded: HF=${this._stats.hfDownloads}, MS=${this._stats.msDownloads}`);
            return this._stats;

        } catch (error) {
            console.warn('[DownloadStats] Error loading stats:', error);
            this._stats = null;
            return null;
        }
    }

    /**
     * Format number with locale separators (no K/M suffix)
     * @param {number} num - Number to format
     * @returns {string} Formatted string (e.g., "2,972,291")
     */
    static formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) {
            return '0';
        }
        return num.toLocaleString();
    }

    /**
     * Initialize download stats display
     * Updates existing DOM elements with loaded stats
     * @returns {Promise<void>}
     */
    static async init() {
        const container = document.getElementById('headerDownloads');
        const hfCountEl = document.getElementById('hfDownloadsCount');
        const msCountEl = document.getElementById('msDownloadsCount');

        if (!container || !hfCountEl || !msCountEl) {
            console.warn('[DownloadStats] Required DOM elements not found');
            return;
        }

        const stats = await this.loadStats();

        if (!stats) {
            container.style.display = 'none';
            return;
        }

        hfCountEl.textContent = this.formatNumber(stats.hfDownloads);
        msCountEl.textContent = this.formatNumber(stats.msDownloads);
        container.style.display = 'flex';
    }
}

export default DownloadStatsManager;
export { DownloadStatsManager };
