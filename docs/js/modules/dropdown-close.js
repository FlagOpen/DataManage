/**
 * @file Dropdown Close Helper
 * @description Provide a minimal close-button binding utility for dropdowns
 */

/**
 * Bind a close button to a close callback.
 * @param {HTMLElement|null} closeButton - Close button element
 * @param {Function} onClose - Close callback
 */
export function bindCloseButton(closeButton, onClose) {
    if (!closeButton || typeof onClose !== 'function') return;
    closeButton.addEventListener('click', onClose);
}

