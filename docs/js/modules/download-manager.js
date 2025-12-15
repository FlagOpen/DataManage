/**
 * @file Download Manager Module
 * @description Manages download functionality for individual datasets
 */

import ConfigManager from './config.js';
import dataManager from './data-manager.js';
import toastManager from './toast-manager.js';

/**
 * Download Manager Class
 */
class DownloadManager {
    constructor() {
        this.currentHub = 'modelscope'; // Default hub
    }

    /**
     * Set current hub
     * @param {string} hub - The hub to use ('modelscope' or 'huggingface')
     */
    setCurrentHub(hub) {
        this.currentHub = hub;
    }

    /**
     * Copy download command for a single dataset to clipboard
     * @param {string} datasetPath - The path of the dataset
     * @returns {Promise<boolean>} - Success status
     */
    async copyDownloadCommand(datasetPath) {
        try {
            const command = ConfigManager.generateDownloadCommand(
                this.currentHub,
                [datasetPath],
                dataManager?.datasetMap
            );

            await this.copyToClipboard(command);
            toastManager.success('Download Command Copied!');
            return true;
        } catch (error) {
            console.error('Failed to copy download command:', error);
            toastManager.error('Failed to copy download command');
            return false;
        }
    }

    /**
     * Copy text to clipboard using modern API with fallback
     * @param {string} text - Text to copy
     * @returns {Promise<void>}
     */
    async copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            // Use modern clipboard API
            await navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers or non-HTTPS
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            textArea.style.top = '-9999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }

    /**
     * Handle download button click
     * @param {Event} event - Click event
     */
    handleDownloadClick(event) {
        event.preventDefault();
        event.stopPropagation(); // Prevent card selection

        const button = event.currentTarget;
        const datasetPath = button.dataset.datasetPath;

        if (datasetPath) {
            this.copyDownloadCommand(datasetPath);
        }
    }

    /**
     * Bind download button events to all download buttons
     */
    bindDownloadButtons() {
        document.querySelectorAll('.download-button').forEach(button => {
            // Remove existing listeners to avoid duplicates
            button.removeEventListener('click', this.handleDownloadClick);
            button.addEventListener('click', this.handleDownloadClick.bind(this));
        });
    }
}

// Export singleton instance
const downloadManager = new DownloadManager();
export default downloadManager;
