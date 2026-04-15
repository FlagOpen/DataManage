/**
 * @file Hint Menu Module
 * @description Manage startup hint menu open/close behavior
 */

import { bindCloseButton } from './dropdown-close.js';

const HintMenu = {
    overlay: null,
    closeBtn: null,
    isOpen: false,

    init() {
        this.overlay = document.getElementById('globalBannerOverlay');
        this.closeBtn = document.getElementById('hintDropdownClose');
        if (!this.overlay || !this.closeBtn) return;

        this.isOpen = !this.overlay.classList.contains('global-banner-overlay-hidden');
        bindCloseButton(this.closeBtn, () => this.close());
    },

    close() {
        if (!this.overlay || !this.isOpen) return;
        this.overlay.classList.add('global-banner-overlay-hidden');
        this.isOpen = false;
    }
};

export default HintMenu;

