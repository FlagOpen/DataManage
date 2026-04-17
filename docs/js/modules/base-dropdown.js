/**
 * @file Base Dropdown Class
 * @description Base class for all dropdown menus with common open/close/toggle behavior
 * @scenario: Shared foundation for Hint, Issue, News, and other dropdown menus
 */

/**
 * Base class for dropdown menus.
 * Provides common open/close/toggle functionality.
 * Subclasses should override init() to bind specific elements and events.
 */
class BaseDropdown {
    /**
     * @param {Object} config - Dropdown configuration
     * @param {string} config.overlayId - ID of the overlay element
     * @param {string} config.closeBtnId - ID of the close button element
     * @param {string} [config.activeClass='active'] - CSS class for active state
     * @param {string} [config.hiddenClass] - CSS class for hidden state (alternative to activeClass)
     */
    constructor(config) {
        this.overlayId = config.overlayId;
        this.closeBtnId = config.closeBtnId;
        this.activeClass = config.activeClass || 'active';
        this.hiddenClass = config.hiddenClass || null;
        this.overlay = null;
        this.closeBtn = null;
        this.isOpen = false;
    }

    /**
     * Initialize the dropdown by binding DOM elements and event listeners.
     * Subclasses should call super.init() and add their own bindings.
     */
    init() {
        this.overlay = document.getElementById(this.overlayId);
        this.closeBtn = document.getElementById(this.closeBtnId);
        if (!this.overlay) return;

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }

        // Check initial state based on activeClass or hiddenClass
        if (this.hiddenClass) {
            this.isOpen = !this.overlay.classList.contains(this.hiddenClass);
        } else if (this.activeClass) {
            this.isOpen = this.overlay.classList.contains(this.activeClass);
        }
    }

    /**
     * Toggle dropdown visibility.
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open the dropdown.
     */
    open() {
        if (!this.overlay) return;
        if (this.hiddenClass) {
            this.overlay.classList.remove(this.hiddenClass);
        } else {
            this.overlay.classList.add(this.activeClass);
        }
        this.isOpen = true;
    }

    /**
     * Close the dropdown.
     */
    close() {
        if (!this.overlay) return;
        if (this.hiddenClass) {
            this.overlay.classList.add(this.hiddenClass);
        } else {
            this.overlay.classList.remove(this.activeClass);
        }
        this.isOpen = false;
    }
}

export default BaseDropdown;
