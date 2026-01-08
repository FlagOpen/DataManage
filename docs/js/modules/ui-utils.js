/**
 * @file UI Utilities Module
 * @description Utilities for UI operations like modals, dropdowns, and previews
 */

/// <reference path="../types.js" />

import ConfigManager from './config.js';
import Templates from '../templates.js';
import dataManager from './data-manager.js';

/**
 * UI Utilities Class
 */
export class UIUtils {
    constructor() {
        this.config = ConfigManager.getConfig();
        this._detailModalEscHandler = null;
        this._dropdownScrollHandler = null;
    }
    
    /**
     * Open filter dropdown
     */
    openFilterDropdown() {
        const overlay = document.getElementById('filterDropdownOverlay');
        overlay.classList.add('active');
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        this.setupDropdownScrollOptimization();
    }
    
    /**
     * Close filter dropdown
     */
    closeFilterDropdown() {
        const overlay = document.getElementById('filterDropdownOverlay');
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 300);
    }
    
    /**
     * Setup dropdown scroll optimization
     */
    setupDropdownScrollOptimization() {
        const content = document.querySelector('.filter-dropdown-content');
        if (!content) return;
        
        let scrollTimeout;
        const scrollHandler = () => {
            content.classList.add('scrolling');
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                content.classList.remove('scrolling');
            }, 150);
        };
        
        if (this._dropdownScrollHandler) {
            content.removeEventListener('scroll', this._dropdownScrollHandler);
        }
        
        this._dropdownScrollHandler = scrollHandler;
        content.addEventListener('scroll', scrollHandler, { passive: true });
    }
    
    /**
     * Show detail modal for dataset
     * @param {string} datasetPath - Dataset path
     * @param {Map<string, Dataset>} datasetMap - Dataset map
     */
    showDetailModal(datasetPath, datasetMap) {
        // Prefer the provided datasetMap, but fall back to the global dataManager
        let dataset = null;
        if (datasetMap && typeof datasetMap.get === 'function') {
            dataset = datasetMap.get(datasetPath) || null;
        }
        if (!dataset) {
            dataset = dataManager.getDataset(datasetPath) || null;
        }
        if (!dataset) return;
        
        let overlay = document.getElementById('detailModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'detailModalOverlay';
            overlay.className = 'detail-modal-overlay';
            document.body.appendChild(overlay);
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.hideDetailModal();
                }
            });
        }
        
        overlay.innerHTML = Templates.buildDetailModal(dataset);

        overlay.querySelector('.detail-modal-close').addEventListener('click', () => {
            this.hideDetailModal();
        });

        requestAnimationFrame(() => {
            overlay.classList.add('visible');
        });
        
        this._detailModalEscHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideDetailModal();
            }
        };
        document.addEventListener('keydown', this._detailModalEscHandler);
    }
    
    /**
     * Hide detail modal
     */
    hideDetailModal() {
        const overlay = document.getElementById('detailModalOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
        
        if (this._detailModalEscHandler) {
            document.removeEventListener('keydown', this._detailModalEscHandler);
            this._detailModalEscHandler = null;
        }
    }
    
    /**
     * Show hover preview card
     * @param {string} datasetPath - Dataset path
     * @param {HTMLElement} itemElement - Item element to position relative to
     * @param {Map<string, Dataset>} datasetMap - Dataset map
     */
    showHoverPreview(datasetPath, itemElement, datasetMap) {
        const dataset = datasetMap.get(datasetPath);
        if (!dataset) return;
        
        this.hideHoverPreview();

        const itemRect = itemElement.getBoundingClientRect();
        
        const card = document.createElement('div');
        card.id = 'hoverPreviewCard';
        card.className = 'hover-preview-card';
        
        card.innerHTML = Templates.buildHoverPreview(dataset);

        document.body.appendChild(card);
        
        const cardRect = card.getBoundingClientRect();
        const cardWidth = cardRect.width || 320;
        const cardHeight = cardRect.height || 240;
        
        const buttonAreaWidth = 60;
        
        let x, y;
        
        // Strategy 1: Show on left side (best, doesn't block content)
        const leftX = itemRect.left - cardWidth - 15;
        
        if (leftX >= 10) {
            x = leftX;
            y = itemRect.top;
        } else {
            // Strategy 2: Show inside left but not blocking buttons
            const maxSafeX = itemRect.right - buttonAreaWidth - cardWidth - 10;
            
            if (maxSafeX >= itemRect.left + 10) {
                x = maxSafeX;
                y = itemRect.top;
            } else {
                // Strategy 3: Show above
                x = itemRect.left;
                y = itemRect.top - cardHeight - 10;
                
                // Strategy 4: Show below if no space above
                if (y < 10) {
                    y = itemRect.bottom + 10;
                }
            }
        }
        
        // Final boundary check
        x = Math.max(10, Math.min(x, window.innerWidth - cardWidth - 10));
        y = Math.max(10, Math.min(y, window.innerHeight - cardHeight - 10));
        
        card.style.left = x + 'px';
        card.style.top = y + 'px';

        // Wire up explicit "View details" action inside hover preview
        const detailBtn = card.querySelector('.hover-preview-detail-btn');
        if (detailBtn) {
            detailBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showDetailModal(datasetPath, datasetMap);
            });
        }

        card.addEventListener('mouseenter', () => {
            // Keep showing when hovering preview
        });
        
        card.addEventListener('mouseleave', () => {
            this.hideHoverPreview();
        });
        
        requestAnimationFrame(() => {
            card.classList.add('visible');
        });
    }
    
    /**
     * Hide hover preview card
     */
    hideHoverPreview() {
        const card = document.getElementById('hoverPreviewCard');
        if (card) {
            card.remove();
        }
    }
    
    /**
     * Show/hide loading overlay
     * @param {boolean} show - Whether to show or hide
     */
    toggleLoadingOverlay(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (!loadingOverlay) return;
        
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
            }, 300);
        }
    }
    
    /**
     * Calculate and format total file size for datasets
     * @param {Dataset[]} datasets - Array of datasets
     * @returns {string} Formatted size string (e.g., " repos, 1.5GB")
     */
    calculateTotalSize(datasets) {
        if (!datasets || datasets.length === 0) {
            return ' repos';
        }
        
        const totalBytes = ConfigManager.calculateTotalSizeFromDatasets(datasets);
        
        if (totalBytes === null) {
            return ' repos';
        }
        
        const formattedSize = ConfigManager.formatFileSize(totalBytes);
        return ` repos, ${formattedSize}`;
    }

    /**
     * Update counts display
     * @param {number} filteredCount - Filtered datasets count
     * @param {number} selectedCount - Selected datasets count
     * @param {Dataset[]} [filteredDatasets] - Optional filtered datasets array for size calculation
     * @param {Dataset[]} [selectedDatasets] - Optional selected datasets array for size calculation
     */
    updateCounts(filteredCount, selectedCount, filteredDatasets = null, selectedDatasets = null) {
        const filteredEl = document.getElementById('filteredCount');
        const selectedEl = document.getElementById('selectedCount');
        const filteredInfoEl = document.getElementById('filteredInfo');
        const selectedInfoEl = document.getElementById('selectedInfo');

        if (filteredEl) filteredEl.textContent = filteredCount;
        if (selectedEl) selectedEl.textContent = selectedCount;
        
        // Calculate and display total file size for filtered datasets
        if (filteredInfoEl) {
            filteredInfoEl.textContent = this.calculateTotalSize(filteredDatasets);
        }
        
        // Calculate and display total file size for selected datasets
        if (selectedInfoEl) {
            selectedInfoEl.textContent = this.calculateTotalSize(selectedDatasets);
        }
    }

    /**
     * Open Hugging Face page for a dataset
     * @param {string} datasetName - Dataset name in hub
     */
    openHuggingFacePage(datasetName) {
        if (!datasetName) return;
        const encodedName = encodeURIComponent(datasetName);
        const url = `https://huggingface.co/datasets/RoboCOIN/${encodedName}`;
        window.open(url, '_blank');
    }
}

export default UIUtils;
