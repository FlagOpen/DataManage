/**
 * @file Issue Menu Module
 * @description Fetch and display issue YAML content in dropdown
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
        return `${config.paths.assetsRoot}/issue/issues.yaml`;
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
                throw new Error(`YAML not found: ${this.filePath}`);
            }
            const text = await response.text();
            const data = await this.parseYaml(text);
            this.renderItems(data?.items || []);
        } catch (error) {
            this.content.textContent = `YAML load failed: ${error?.message || 'unknown error'}`;
        }
    },

    async parseYaml(text) {
        if (typeof jsyaml === 'undefined') {
            await this.loadJsYamlLibrary();
        }
        return jsyaml.load(text);
    },

    async loadJsYamlLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    escapeHtml(raw) {
        return String(raw ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    renderItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            this.content.textContent = 'No issues available.';
            return;
        }

        const html = items.map((item) => {
            const title = this.escapeHtml(item?.title || 'Untitled');
            const date = this.escapeHtml(item?.date || '');
            const status = this.escapeHtml(item?.status || '');
            const committedBy = this.escapeHtml(item?.committed_by || '');
            const content = this.escapeHtml(item?.content || '');
            return [
                '<article style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">',
                `<h4 style="margin: 0 0 6px 0; font-size: 14px;">${title}</h4>`,
                `<div style="opacity: 0.75; font-size: 12px; margin-bottom: 6px;">${date}${status ? ` | ${status}` : ''}${committedBy ? ` | ${committedBy}` : ''}</div>`,
                `<div style="white-space: pre-wrap; line-height: 1.5; font-size: 13px;">${content}</div>`,
                '</article>'
            ].join('');
        }).join('');

        this.content.innerHTML = html;
    }
};

export default IssueMenu;
