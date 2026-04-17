/**
 * @file YAML Dropdown Class
 * @description Extended dropdown class for Issue/News menus with YAML loading and i18n support
 * @scenario: User clicks ISSUES/NEWS button to toggle dropdown with YAML content
 */

import BaseDropdown from './base-dropdown.js';

/**
 * Dropdown class for YAML-based content with language toggle.
 * Extends BaseDropdown with YAML fetching, parsing, and i18n support.
 */
class YamlDropdown extends BaseDropdown {
    /**
     * @param {Object} config - Dropdown configuration
     * @param {string} config.overlayId - ID of the overlay element
     * @param {string} config.closeBtnId - ID of the close button element
     * @param {string} config.contentId - ID of the content container element
     * @param {string} config.triggerBtnId - ID of the trigger button element
     * @param {string} config.langToggleBtnId - ID of the language toggle button
     * @param {string} config.dataPath - Path to the YAML file (may be a getter for lazy resolve)
     * @param {string} [config.emptyMessage='No data available.'] - Message when no items
     */
    constructor(config) {
        super(config);
        this.contentId = config.contentId;
        this.triggerBtnId = config.triggerBtnId;
        this.langToggleBtnId = config.langToggleBtnId;
        // Keep config reference; do not read config.dataPath here. Module imports run
        // before ConfigManager.loadJsonConfig(), so eager read would freeze remote URL
        // and ignore useLocalAssets in config.json.
        this._pathConfig = config;
        this.emptyMessage = config.emptyMessage || 'No data available.';
        this.content = null;
        this.triggerBtn = null;
        this.langToggleBtn = null;
        this.currentLang = 'en';
        this.dataCache = null;
    }

    /**
     * Initialize the dropdown with all bindings.
     */
    init() {
        super.init();
        this.content = document.getElementById(this.contentId);
        this.triggerBtn = document.getElementById(this.triggerBtnId);
        this.langToggleBtn = document.getElementById(this.langToggleBtnId);
        this.currentLang = this.resolveInitialLanguage();
        this.updateLangToggleButtonLabel();

        if (this.triggerBtn) {
            this.triggerBtn.addEventListener('click', () => this.toggle());
        }
        if (this.langToggleBtn) {
            this.langToggleBtn.addEventListener('click', () => this.toggleLanguage());
        }

        // Load content if already open on init (e.g., Hint menu)
        if (this.isOpen) {
            this.loadContent();
        }
    }

    /**
     * Open dropdown and load content.
     */
    async open() {
        super.open();
        if (this.content) {
            this.content.textContent = 'Loading...';
        }
        await this.loadContent();
    }

    /**
     * Resolve YAML URL after config.json is loaded (see constructor note).
     * @returns {string}
     */
    resolveDataPath() {
        return this._pathConfig.dataPath;
    }

    /**
     * Load YAML content from server.
     */
    async loadContent() {
        try {
            const dataPath = this.resolveDataPath();
            const response = await fetch(dataPath);
            if (!response.ok) {
                throw new Error(`YAML not found: ${dataPath}`);
            }
            const text = await response.text();
            this.dataCache = await this.parseYaml(text);
            this.renderItems(this.dataCache?.items || []);
        } catch (error) {
            if (this.content) {
                this.content.textContent = `YAML load failed: ${error?.message || 'unknown error'}`;
            }
        }
    }

    /**
     * Resolve initial language from URL params.
     * @returns {string} 'en' or 'zh'
     */
    resolveInitialLanguage() {
        const params = new URLSearchParams(window.location.search || '');
        const lang = (params.get('lang') || '').toLowerCase();
        return lang === 'zh' ? 'zh' : 'en';
    }

    /**
     * Toggle between English and Chinese.
     */
    toggleLanguage() {
        this.currentLang = this.currentLang === 'en' ? 'zh' : 'en';
        this.updateLangToggleButtonLabel();
        if (this.isOpen && this.dataCache) {
            try {
                this.renderItems(this.dataCache?.items || []);
            } catch (error) {
                if (this.content) {
                    this.content.textContent = `YAML load failed: ${error?.message || 'unknown error'}`;
                }
            }
        }
    }

    /**
     * Update language toggle button label.
     */
    updateLangToggleButtonLabel() {
        if (!this.langToggleBtn) return;
        this.langToggleBtn.textContent = this.currentLang === 'zh' ? 'ZH' : 'EN';
    }

    /**
     * Get localized field value from item.
     * @param {Object} item - Data item
     * @param {string} fieldName - Field name (title, content, etc.)
     * @returns {string} Localized value
     */
    getLocalizedField(item, fieldName) {
        const value = item?.[fieldName];
        if (!value || typeof value !== 'object') {
            const itemId = item?.id || 'unknown';
            throw new Error(`Missing i18n object: ${fieldName}, item=${itemId}`);
        }
        const localized = value[this.currentLang];
        if (!localized || typeof localized !== 'string') {
            const itemId = item?.id || 'unknown';
            throw new Error(`Missing ${this.currentLang} translation: ${fieldName}, item=${itemId}`);
        }
        return localized;
    }

    /**
     * Parse YAML text using js-yaml library.
     * @param {string} text - YAML content
     * @returns {Promise<Object>} Parsed YAML object
     */
    async parseYaml(text) {
        if (typeof jsyaml === 'undefined') {
            await this.loadJsYamlLibrary();
        }
        return jsyaml.load(text);
    }

    /**
     * Load js-yaml library dynamically.
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
     * Escape HTML special characters.
     * @param {string} raw - Raw string
     * @returns {string} Escaped string
     */
    escapeHtml(raw) {
        return String(raw ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Render items to content container.
     * Content field is rendered as HTML (trusted source).
     * @param {Array} items - Array of data items
     */
    renderItems(items) {
        if (!this.content) return;
        if (!Array.isArray(items) || items.length === 0) {
            this.content.textContent = this.emptyMessage;
            return;
        }

        const html = items.map((item) => {
            const title = this.escapeHtml(this.getLocalizedField(item, 'title'));
            const date = this.escapeHtml(item?.date || '');
            const status = this.escapeHtml(item?.status || '');
            const committedBy = this.escapeHtml(item?.committed_by || '');
            // Content is HTML from trusted YAML source, render directly
            const content = this.getLocalizedField(item, 'content');
            return [
                '<article style="padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.08);">',
                `<h4 style="margin: 0 0 4px 0; font-size: 14px;">${title}</h4>`,
                `<div style="opacity: 0.75; font-size: 12px; margin-bottom: 4px;">${date}${status ? ` | ${status}` : ''}${committedBy ? ` | ${committedBy}` : ''}</div>`,
                `<div style="line-height: 1.5; font-size: 13px;">${content}</div>`,
                '</article>'
            ].join('');
        }).join('');

        this.content.innerHTML = html;
    }
}

export default YamlDropdown;
