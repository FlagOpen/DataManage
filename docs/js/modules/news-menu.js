/**
 * @file News Menu Module
 * @description Fetch and display News.md content in dropdown
 * @scenario: User clicks NEWS button to toggle news dropdown menu
 */

import ConfigManager from './config.js';

const NewsMenu = {
    overlay: null,
    dropdown: null,
    content: null,
    isOpen: false,

    get filePath() {
        const config = ConfigManager.getConfig();
        if (config.assets.useLocalAssets) {
            return config.assets.localAssetsPath + '/News.md';
        }
        return config.assets.defaultRemoteAssetsRoot + '/News.md';
    },

    init() {
        this.overlay = document.getElementById('newsDropdownOverlay');
        this.dropdown = document.getElementById('newsDropdown');
        this.content = document.getElementById('newsContent');
        
        document.getElementById('newsBtn').addEventListener('click', () => this.toggle());
        document.getElementById('newsDropdownClose').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
    },

    async toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            await this.open();
        }
    },

    async open() {
        this.content.textContent = 'Loading...';
        this.overlay.classList.add('active');
        this.isOpen = true;
        await this.loadContent();
    },

    close() {
        this.overlay.classList.remove('active');
        this.isOpen = false;
    },

    async loadContent() {
        try {
            const response = await fetch(this.filePath);
            if (!response.ok) {
                throw new Error('File not found');
            }
            const text = await response.text();
            this.content.textContent = text || 'No content available.';
        } catch (error) {
            this.content.textContent = 'Missing assets, not able to display.';
        }
    }
};

export default NewsMenu;
