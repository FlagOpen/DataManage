/**
 * @file Selection Panel Module
 * @description Manages selection panel (cart) with virtual scrolling
 */

/// <reference path="../types.js" />

import ConfigManager from './config.js';
import Templates from '../templates.js';
import { calculateVisibleRange, ElementCache } from './virtual-scroll.js';
import ErrorNotifier from './error-notifier.js';

/**
 * Selection Panel Manager Class
 */
export class SelectionPanelManager {
    /**
     * @param {Set<string>} selectedDatasets - Selected dataset paths
     * @param {Set<string>} listDatasets - Cart dataset paths
     * @param {Map<string, Dataset>} datasetMap - Path to dataset map
     */
    constructor(selectedDatasets, listDatasets, datasetMap) {
        this.selectedDatasets = selectedDatasets;
        this.listDatasets = listDatasets;
        this.datasetMap = datasetMap;
        
        /** @type {string} */
        this.currentHub = 'huggingface';
        
        /** @type {Object} */
        this.config = ConfigManager.getConfig();
        
        /** @type {ElementCache} */
        this._selectionItemCache = new ElementCache();
        
        /** @type {HTMLElement|null} */
        this._virtualContainer = null;
        
        /** @type {string[]|null} */
        this._sortedPathsCache = null;
        
        /** @type {boolean} */
        this._listDatasetsChanged = false;
        
        /** @type {HTMLElement|null} */
        this._tempMeasureDiv = null;
        
        /** @type {number|null} */
        this._codeUpdateTimer = null;
    }
    
    /**
     * Mark list datasets as changed
     */
    markListChanged() {
        this._listDatasetsChanged = true;
        this._sortedPathsCache = null;
    }
    
    /**
     * Calculate and format total file size for selected datasets
     * @returns {string} Formatted size string (e.g., " repos, 1.5GB")
     */
    _calculateSelectedTotalSize() {
        if (this.selectedDatasets.size === 0) {
            return ' repos';
        }
        
        // Build datasets array from selected paths
        const datasets = Array.from(this.selectedDatasets)
            .map(path => this.datasetMap.get(path))
            .filter(ds => ds !== undefined);
        
        const totalBytes = ConfigManager.calculateTotalSizeFromDatasets(datasets);
        
        if (totalBytes === null) {
            return ' repos';
        }
        
        const formattedSize = ConfigManager.formatFileSize(totalBytes);
        return ` repos, ${formattedSize}`;
    }

    /**
     * Update selection panel with virtual scrolling
     */
    updateSelectionPanel() {
        const selectedCountEl = document.getElementById('selectedCount');
        const selectedInfoEl = document.getElementById('selectedInfo');
        
        if (selectedCountEl) {
            selectedCountEl.textContent = this.selectedDatasets.size;
        }
        
        if (selectedInfoEl) {
            selectedInfoEl.textContent = this._calculateSelectedTotalSize();
        }
        
        const list = document.getElementById('selectionList');
        if (!list) return;
        
        // Update sorted paths cache
        if (!this._sortedPathsCache || this._listDatasetsChanged) {
            this._sortedPathsCache = Array.from(this.listDatasets).sort();
            this._listDatasetsChanged = false;
        }
        const sortedPaths = this._sortedPathsCache;
        
        if (sortedPaths.length === 0) {
            list.innerHTML = Templates.buildEmptyCartHint();
            this._virtualContainer = null;
            this._selectionItemCache.clear();
            this.updateCodeOutput();
            return;
        }
        
        // Get actual pixel values from computed styles
        if (!this._tempMeasureDiv) {
            this._tempMeasureDiv = document.createElement('div');
            this._tempMeasureDiv.style.cssText = `
                position: absolute;
                visibility: hidden;
                top: -9999px;
                left: -9999px;
            `;
            document.body.appendChild(this._tempMeasureDiv);
        }
        
        const tempDiv = this._tempMeasureDiv;
        tempDiv.style.height = 'var(--selection-item-height)';
        const computedTemp = getComputedStyle(tempDiv);
        const itemHeightPx = parseFloat(computedTemp.height) || 45;
        
        const itemHeight = itemHeightPx;
        const scrollTop = list.scrollTop;
        const containerHeight = list.clientHeight;
        const bufferItems = this.config.selection.bufferItems;
        const totalItems = sortedPaths.length;
        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferItems);
        const visibleCount = Math.ceil(containerHeight / itemHeight);
        const endIndex = Math.min(totalItems, startIndex + visibleCount + bufferItems * 2);
        
        // Get or create virtual container
        let container = this._virtualContainer;
        
        if (!container || !document.contains(container)) {
            container = list.querySelector('.selection-virtual-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'selection-virtual-container';
                list.innerHTML = '';
                list.appendChild(container);
            }
            this._virtualContainer = container;
        }
        
        const totalHeight = totalItems * itemHeight;
        container.style.height = `${totalHeight}px`;
        
        const visiblePaths = sortedPaths.slice(startIndex, endIndex);
        const visiblePathsSet = new Set(visiblePaths);
        
        // Remove invisible items
        const existingItems = container.querySelectorAll('.selection-item');
        existingItems.forEach(item => {
            const path = item.dataset.path;
            if (!visiblePathsSet.has(path)) {
                item.remove();
                this._selectionItemCache.delete(path);
            } else {
                this._selectionItemCache.set(path, item);
            }
        });
        
        const fragment = document.createDocumentFragment();
        visiblePaths.forEach((path, i) => {
            const globalIndex = startIndex + i;
            const ds = this.datasetMap.get(path);
            if (!ds) return;
            
            let item = this._selectionItemCache.get(path);
            const isNewItem = !item;
            
            if (isNewItem) {
                item = document.createElement('div');
                item.className = 'selection-item';
                item.dataset.path = path;
                
                item.innerHTML = Templates.buildSelectionItem(ds);
                
                this._selectionItemCache.set(path, item);
            }
            
            item.style.top = `${globalIndex * itemHeight}px`;
            item.classList.toggle('selected', this.selectedDatasets.has(path));
            
            if (isNewItem) {
                fragment.appendChild(item);
            }
        });
        
        if (fragment.hasChildNodes()) {
            container.appendChild(fragment);
        }
        
        this.updateCodeOutput();
    }
    
    /**
     * Update code output (debounced)
     */
    updateCodeOutput() {
        if (this._codeUpdateTimer) {
            clearTimeout(this._codeUpdateTimer);
        }
        
        this._codeUpdateTimer = setTimeout(() => {
            const output = document.getElementById('codeOutput');
            
            if (!this._sortedPathsCache || this._listDatasetsChanged) {
                this._sortedPathsCache = Array.from(this.listDatasets).sort();
                this._listDatasetsChanged = false;
            }
            
            requestAnimationFrame(() => {
                output.textContent = ConfigManager.generateDownloadCommand(
                    this.currentHub,
                    this._sortedPathsCache,
                    this.datasetMap
                );
            });
        }, 100);
    }
    
    
    /**
     * Export selection as JSON file
     */
    exportSelection() {
        const pathsWithPrefix = Array.from(this.listDatasets).map(path => {
            // 如果路径已经以 RoboCOIN/ 开头，则不重复添加
            return path.startsWith('RoboCOIN/') ? path : `RoboCOIN/${path}`;
        });
        const blob = new Blob([JSON.stringify(pathsWithPrefix, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().slice(0,10);
        const count = this.listDatasets.size;
        a.download = `robocoin_${count}ds_${timestamp}.json`;
        a.click();
    }
    
    /**
     * Import selection from JSON file
     * @param {Event} event - File input change event
     * @param {Dataset[]} allDatasets - All available datasets
     * @param {Function} onComplete - Callback function called after import completes
     */
    handleImportFile(event, allDatasets, onComplete) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                
                if (!Array.isArray(imported)) {
                    ErrorNotifier.error('Invalid JSON format. Expected an array of dataset IDs.');
                    event.target.value = '';
                    return;
                }
                
                this.listDatasets.clear();
                
                let validCount = 0;
                let invalidCount = 0;
                
                imported.forEach(path => {
                    // 去掉 RoboCOIN/ 前缀（如果存在）以兼容导入的文件
                    let normalizedPath = path;
                    if (typeof path === 'string' && path.startsWith('RoboCOIN/')) {
                        normalizedPath = path.substring('RoboCOIN/'.length);
                    }
                    
                    const exists = allDatasets.some(ds => ds.path === normalizedPath);
                    if (exists) {
                        this.listDatasets.add(normalizedPath);
                        validCount++;
                    } else {
                        invalidCount++;
                    }
                });
                
                this.markListChanged();
                
                // 刷新购物车显示
                this.updateSelectionPanel();
                
                // 调用回调函数（用于更新视频网格样式等）
                if (onComplete && typeof onComplete === 'function') {
                    onComplete();
                }
                
                ErrorNotifier.info(`Import completed!\nValid: ${validCount}\nInvalid/Not found: ${invalidCount}`);
                
            } catch (err) {
                ErrorNotifier.error('Failed to parse JSON file: ' + err.message, err);
            }
            
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }
    
    /**
     * Copy code to clipboard
     */
    copyCode() {
        const output = document.getElementById('codeOutput');
        const btn = document.getElementById('copyCodeBtn');
        
        if (btn.classList.contains('success')) {
            return;
        }
        
        const originalText = btn.textContent;
        
        navigator.clipboard.writeText(output.textContent).then(() => {
            btn.classList.add('success');
            btn.textContent = '👍 Copied!';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('success');
            }, 1500);
        }).catch(err => {
            ErrorNotifier.error('Copy failed: ' + err.message, err);
        });
    }
    
    /**
     * Set current hub
     * @param {string} hub - Hub name ('modelscope' or 'huggingface')
     */
    setHub(hub) {
        this.currentHub = hub;
        this.updateCodeOutput();
    }
}

export default SelectionPanelManager;

