/**
 * @file News Menu Module
 * @description Fetch and display news YAML content in dropdown
 * @scenario: User clicks NEWS button to toggle news dropdown menu
 */

import ConfigManager from './config.js';

const NewsMenu = {
    overlay: null,
    dropdown: null,
    content: null,
    langToggleBtn: null,
    isOpen: false,
    currentLang: 'zh',
    dataCache: null,

    get filePath() {
        const config = ConfigManager.getConfig();
        return `${config.paths.assetsRoot}/news/news.yaml`;
    },

    init() {
        this.overlay = document.getElementById('newsDropdownOverlay');
        this.dropdown = document.getElementById('newsDropdown');
        this.content = document.getElementById('newsContent');
        this.langToggleBtn = document.getElementById('newsLangToggleBtn');
        this.currentLang = this.resolveInitialLanguage();
        this.updateLangToggleButtonLabel();
        
        document.getElementById('newsBtn').addEventListener('click', () => this.toggle());
        document.getElementById('newsDropdownClose').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        if (this.langToggleBtn) {
            this.langToggleBtn.addEventListener('click', () => this.toggleLanguage());
        }
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
            this.dataCache = await this.parseYaml(text);
            this.renderItems(this.dataCache?.items || []);
        } catch (error) {
            this.content.textContent = `YAML load failed: ${error?.message || 'unknown error'}`;
        }
    },

    resolveInitialLanguage() {
        const params = new URLSearchParams(window.location.search || '');
        const lang = (params.get('lang') || '').toLowerCase();
        return lang === 'en' ? 'en' : 'zh';
    },

    toggleLanguage() {
        this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
        this.updateLangToggleButtonLabel();
        if (this.isOpen && this.dataCache) {
            try {
                this.renderItems(this.dataCache?.items || []);
            } catch (error) {
                this.content.textContent = `YAML load failed: ${error?.message || 'unknown error'}`;
            }
        }
    },

    updateLangToggleButtonLabel() {
        if (!this.langToggleBtn) return;
        this.langToggleBtn.textContent = this.currentLang === 'zh' ? 'ZH' : 'EN';
    },

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
            this.content.textContent = 'No news available.';
            return;
        }

        const html = items.map((item) => {
            const title = this.escapeHtml(this.getLocalizedField(item, 'title'));
            const date = this.escapeHtml(item?.date || '');
            const status = this.escapeHtml(item?.status || '');
            const committedBy = this.escapeHtml(item?.committed_by || '');
            const content = this.escapeHtml(this.getLocalizedField(item, 'content'));
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

export default NewsMenu;
