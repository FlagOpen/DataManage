/**
 * @file Issue Menu Module
 * @description Fetch and display Issue.md content in dropdown
 * @scenario: User clicks ISSUES button to toggle issue dropdown menu
 */

import ConfigManager from './config.js';

const IssueMenu = {
    overlay: null,
    dropdown: null,
    content: null,
    isOpen: false,

    get filePath() {
        const config = ConfigManager.getConfig();
        if (config.assets.useLocalAssets) {
            return config.assets.localAssetsPath + '/Issue.md';
        }
        return config.assets.defaultRemoteAssetsRoot + '/Issue.md';
    },

    init() {
        this.overlay = document.getElementById('issueDropdownOverlay');
        this.dropdown = document.getElementById('issueDropdown');
        this.content = document.getElementById('issueContent');
        
        document.getElementById('issuesBtn').addEventListener('click', () => this.toggle());
        document.getElementById('issueDropdownClose').addEventListener('click', () => this.close());
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

export default IssueMenu;
