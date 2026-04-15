/**
 * @file Event Handlers Module
 * @description Centralizes all event binding and handling logic
 */

/// <reference path="../types.js" />

import ConfigManager from './config.js';
import { debounce } from './virtual-scroll.js';
import { selectAllChildrenInHierarchy, clearAllChildrenInHierarchy } from './@filter/filter-hierarchy.js';
import DownloadManager from './download-manager.js';
import { bindCloseButton } from './dropdown-close.js';

/**
 * Event Handlers Manager Class
 */
export class EventHandlers {
    /**
     * @param {Object} managers - Object containing all manager instances
     * @param {Object} managers.filter - Filter manager
     * @param {Object} managers.videoGrid - Video grid manager
     * @param {Object} managers.selectionPanel - Selection panel manager
     * @param {Object} managers.ui - UI utilities
     * @param {Set<string>} selectedDatasets - Selected dataset paths
     * @param {Map<string, Dataset>} datasetMap - Dataset map
     */
    constructor(managers, selectedDatasets, datasetMap) {
        this.managers = managers;
        this.selectedDatasets = selectedDatasets;
        this.datasetMap = datasetMap;
        this.config = ConfigManager.getConfig();
    }

    /**
     * Normalize an event target to an Element so we can safely call `.closest`.
     * @param {EventTarget|null} target
     * @returns {Element|null}
     */
    _resolveEventTargetElement(target) {
        if (!target) return null;
        if (target instanceof Element) {
            return target;
        }
        if (typeof target === 'object' && target !== null && 'nodeType' in target && target.nodeType === Node.TEXT_NODE) {
            return target.parentElement;
        }
        return null;
    }

    /**
     * Bind all events
     */
    bindEvents() {
        this.bindFilterEvents();
        this.bindVideoGridEvents();
        this.bindSelectionListEvents();
        this.bindToolbarEvents();
        this.bindResizeEvents();
        this.bindScrollEvents();
    }

    /**
     * Bind filter-related events
     */
    bindFilterEvents() {
        // Search box (debounced)
        const searchBox = document.getElementById('searchBox');
        if (searchBox) {
            searchBox.addEventListener('input', debounce(() => {
                document.dispatchEvent(new CustomEvent('filtersChanged'));
            }, 150));

            // ESC key to clear search
            searchBox.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchBox.value = '';
                    document.dispatchEvent(new CustomEvent('filtersChanged'));
                    searchBox.blur();
                }
            });
        }

        // Clear search button
        const searchClearBtn = document.getElementById('searchClearBtn');
        if (searchClearBtn) {
            searchClearBtn.addEventListener('click', () => {
                const searchBox = document.getElementById('searchBox');
                if (searchBox) {
                    searchBox.value = '';
                    // Trigger filters changed event to refresh results
                    document.dispatchEvent(new CustomEvent('filtersChanged'));
                    // Focus back to search input
                    searchBox.focus();
                }
            });
        }

        // Filter dropdown events
        const filterTriggerBtn = document.getElementById('filterTriggerBtn');
        const filterDropdownClose = document.getElementById('filterDropdownClose');

        if (filterTriggerBtn) {
            filterTriggerBtn.addEventListener('click', () => {
                this.managers.ui.openFilterDropdown();
                // Initialize tooltips when dropdown opens
                this.managers.filter.initializeFilters();
                // Focus search input when dropdown opens
                setTimeout(() => {
                    const searchInput = document.getElementById('filterFinderInput');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }, 100);
            });
        }

        if (filterDropdownClose) {
            bindCloseButton(filterDropdownClose, () => {
                this.managers.ui.closeFilterDropdown();
                // Clear search when closing
                const searchInput = document.getElementById('filterFinderInput');
                if (searchInput) {
                    searchInput.value = '';
                    this.managers.filter.clearFilterSearch();
                }
            });
        }

        // Filter finder (search) events
        this.bindFilterFinderEvents();

        // Reset filters button
        const resetFiltersBtn = document.getElementById('filterResetBtn');
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => {
                this.addClickAnimation(resetFiltersBtn);
                document.getElementById('searchBox').value = '';
                this.managers.filter.resetFilters();
            });
        }

        // Hub switch button
        const hubSwitchBtn = document.getElementById('hubSwitchBtn');

        if (hubSwitchBtn) {
            hubSwitchBtn.addEventListener('click', () => {
                const currentHub = this.managers.selectionPanel.currentHub;
                const newHub = currentHub === 'huggingface' ? 'modelscope' : 'huggingface';

                // Add transition class for animation
                hubSwitchBtn.classList.add('transitioning');

                // Update hub after a short delay to allow transition to start
                setTimeout(() => {
                    this.managers.selectionPanel.setHub(newHub);
                    DownloadManager.setCurrentHub(newHub);
                    this.updateHubSwitchButton(newHub);

                    // Remove transition class after animation completes
                    setTimeout(() => {
                        hubSwitchBtn.classList.remove('transitioning');
                    }, 300);
                }, 50);
            });
        }

        // Initialize hub button state
        this.updateHubSwitchButton(this.managers.selectionPanel.currentHub);

        // Quick-action buttons and tooltips (event delegation)
        this.bindFilterDropdownEvents();
    }

    /**
     * Update hub switch button state
     * @param {string} activeHub - Active hub name ('huggingface' or 'modelscope')
     */
    updateHubSwitchButton(activeHub) {
        const hubSwitchBtn = document.getElementById('hubSwitchBtn');

        if (hubSwitchBtn) {
            // Update data attribute for CSS positioning
            hubSwitchBtn.setAttribute('data-hub', activeHub);

            // Update indicator position
            const indicator = hubSwitchBtn.querySelector('.hub-indicator');
            if (indicator) {
                indicator.setAttribute('data-hub', activeHub);
            }
        }
    }

    /**
     * Bind filter finder (search) events
     */
    bindFilterFinderEvents() {
        const filterFinderInput = document.getElementById('filterFinderInput');
        const filterFinderClearBtn = document.getElementById('filterFinderClearBtn');
        const filterFinderPrev = document.getElementById('filterFinderPrev');
        const filterFinderNext = document.getElementById('filterFinderNext');

        if (!filterFinderInput) return;

        // Search input event
        filterFinderInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            this.managers.filter.searchFilterOptions(query);
        });

        // Clear button event
        if (filterFinderClearBtn) {
            filterFinderClearBtn.addEventListener('click', () => {
                filterFinderInput.value = '';
                this.managers.filter.clearFilterSearch();
                filterFinderInput.focus();
            });
        }

        // Previous/Next button events
        if (filterFinderPrev) {
            filterFinderPrev.addEventListener('click', () => {
                this.managers.filter.navigateFilterMatch('prev');
            });
        }

        if (filterFinderNext) {
            filterFinderNext.addEventListener('click', () => {
                this.managers.filter.navigateFilterMatch('next');
            });
        }

        // Keyboard shortcuts
        filterFinderInput.addEventListener('keydown', (e) => {
            // Escape: clear search
            if (e.key === 'Escape') {
                filterFinderInput.value = '';
                this.managers.filter.clearFilterSearch();
                filterFinderInput.blur();
                e.stopPropagation(); // Prevent closing the dropdown
                return;
            }

            // Arrow keys: navigate matches
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (filterFinderInput.value.trim()) {
                    this.managers.filter.navigateFilterMatch('prev');
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (filterFinderInput.value.trim()) {
                    this.managers.filter.navigateFilterMatch('next');
                }
                return;
            }

            // Enter: select current match or navigate to next
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = filterFinderInput.value.trim();
                if (!query) return;

                const currentMatch = this.managers.filter.filterFinderMatches[this.managers.filter.filterFinderCurrentIndex];
                if (currentMatch && currentMatch.element) {
                    const option = currentMatch.element;
                    const filterKey = option.dataset.filter;
                    const filterValue = option.dataset.value;
                    if (filterKey && filterValue) {
                        const label = option.querySelector('.filter-option-label')?.textContent?.trim() || filterValue;
                        this.managers.filter.toggleFilterSelection(filterKey, filterValue, label, option);
                    }
                }
                return;
            }
        });

        // Global Ctrl+F / Cmd+F shortcut to focus search
        document.addEventListener('keydown', (e) => {
            // Check if filter dropdown is open
            const overlay = document.getElementById('filterDropdownOverlay');
            if (!overlay || !overlay.classList.contains('active')) return;

            // Ctrl+F or Cmd+F
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                filterFinderInput.focus();
                filterFinderInput.select();
            }
        });
    }

    /**
     * Bind filter dropdown events (quick-actions and tooltips)
     */
    bindFilterDropdownEvents() {
        const filterGroups = document.getElementById('filterGroups');
        if (!filterGroups) return;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Hierarchy action buttons (All/Clear buttons for all levels)
        filterGroups.addEventListener('click', (e) => {
            const clickedElement = this._resolveEventTargetElement(e.target);
            const hierarchyActionBtn = clickedElement?.closest('.hierarchy-action-btn');
            if (hierarchyActionBtn) {
                e.stopPropagation(); // Prevent menu collapse

                const action = hierarchyActionBtn.dataset.action;

                // Top-level group buttons (have data-group)
                const groupKey = hierarchyActionBtn.dataset.group;
                if (groupKey) {
                    if (action === 'select-all') {
                        this.managers.filter.selectAllInGroup(groupKey);
                    } else if (action === 'clear-group') {
                        this.managers.filter.clearGroup(groupKey);
                    }
                    return;
                }

                // Hierarchy item buttons (have data-key and data-path)
                const key = hierarchyActionBtn.dataset.key;
                const path = hierarchyActionBtn.dataset.path;
                if (key && path) {
                    if (action === 'select-all-children') {
                        selectAllChildrenInHierarchy(this.managers.filter, key, path);
                    } else if (action === 'clear-all-children') {
                        clearAllChildrenInHierarchy(this.managers.filter, key, path);
                    }
                    return;
                }
            }
        });

    }

    /**
     * Bind video grid events (event delegation)
     */
    bindVideoGridEvents() {
        const grid = document.getElementById('videoGrid');
        if (!grid) return;

        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        // Hover overlay timers (desktop / non-touch only)
        this._hoverOverlayShowTimeout = null;
        this._hoverOverlayHideTimeout = null;
        this._hoverOverlayActiveCard = null;

        // Event delegation: click on video-card
        grid.addEventListener('click', (e) => {
            try {
                const clickTarget = this._resolveEventTargetElement(e.target);

                // Dataset title click -> show detail modal
                const datasetTitle = clickTarget?.closest('.video-title, .video-hover-title');
                if (datasetTitle && this.managers && this.managers.ui) {
                    e.stopPropagation();
                    const cardPath = datasetTitle.dataset.path || datasetTitle.closest('.video-card')?.dataset?.path;
                    if (cardPath) {
                        this.managers.ui.showDetailModal(cardPath, this.datasetMap);
                    }
                    return;
                }

                // Allow clicks on the autoplay preview video to also toggle selection
                // so users can click anywhere on the video pane (thumbnail or video)
                const card = clickTarget?.closest('.video-card');
                if (!card) return;

                const path = card.dataset.path;
                if (!path) return;

                if (this.managers && this.managers.selectionPanel) {
                    this.toggleSelection(path);
                }
            } catch (error) {
                console.error('Error in video grid click handler:', error);
            }
        });

        // Desktop hover: show in-card hover overlay with detailed info
        if (!isTouchDevice) {
            grid.addEventListener('mouseover', (e) => {
                const hoverTarget = this._resolveEventTargetElement(e.target);
                const card = hoverTarget?.closest('.video-card');
                if (!card || !grid.contains(card)) return;

                const path = card.dataset.path;
                if (!path) return;

                // 如果悬停在下载按钮上，清空进入悬浮展示层的计时
                const downloadButton = hoverTarget?.closest('.download-button');
                if (downloadButton) {
                    if (this._hoverOverlayShowTimeout) {
                        clearTimeout(this._hoverOverlayShowTimeout);
                        this._hoverOverlayShowTimeout = null;
                    }
                    return;
                }

                // Cancel any pending hide while moving between cards
                if (this._hoverOverlayHideTimeout) {
                    clearTimeout(this._hoverOverlayHideTimeout);
                    this._hoverOverlayHideTimeout = null;
                }

                // Debounce show to avoid flicker when quickly moving across cards
                if (this._hoverOverlayShowTimeout) {
                    clearTimeout(this._hoverOverlayShowTimeout);
                }

                const hoverDelay = this.config?.timing?.hoverDelay || 800;

                this._hoverOverlayShowTimeout = setTimeout(() => {
                    // Hide any previously active overlay
                    if (this._hoverOverlayActiveCard && this._hoverOverlayActiveCard !== card) {
                        this._hoverOverlayActiveCard.classList.remove('hover-overlay-visible');
                    }

                    card.classList.add('hover-overlay-visible');
                    this._hoverOverlayActiveCard = card;
                    // 冻结当前卡片的视频为静态缩略图，减少悬停时的解码/绘制开销
                    this.freezeCardThumbnail(card);
                    this._hoverOverlayShowTimeout = null;
                }, hoverDelay);
            });

            grid.addEventListener('mouseout', (e) => {
                const hoverTarget = this._resolveEventTargetElement(e.target);
                const card = hoverTarget?.closest('.video-card');
                if (!card || !grid.contains(card)) return;

                const related = /** @type {HTMLElement|null} */ (e.relatedTarget);
                const stayingInSameCard = !!(related && card.contains(related));

                // If still inside the same card (including overlay), don't hide
                if (stayingInSameCard) {
                    return;
                }

                // Cancel pending show
                if (this._hoverOverlayShowTimeout) {
                    clearTimeout(this._hoverOverlayShowTimeout);
                    this._hoverOverlayShowTimeout = null;
                }

                // Immediately remove hover overlay
                card.classList.remove('hover-overlay-visible');
                if (this._hoverOverlayActiveCard === card) {
                    this._hoverOverlayActiveCard = null;
                }
                // 悬停结束后恢复原本的动态行为（在可视区域时继续自动播放）
                this.unfreezeCardThumbnail(card);
            });
        }

        // Video load error handling
        grid.addEventListener('error', (e) => {
            if (e.target.tagName === 'VIDEO') {
                const card = e.target.closest('.video-card');
                if (card) {
                    const errorDiv = card.querySelector('.video-error');
                    if (errorDiv) errorDiv.style.display = 'block';
                }
            }
        }, true);
    }

    /**
     * Bind selection list events (event delegation)
     */
    bindSelectionListEvents() {
        const list = document.getElementById('selectionList');
        if (!list) return;

        // Click events
        list.addEventListener('click', (e) => {
            const clickTarget = this._resolveEventTargetElement(e.target);
            const item = clickTarget?.closest('.selection-item');
            if (!item) return;

            const path = item.dataset.path;
            if (!path) return;

            // Dataset name click -> show detail modal
            if (clickTarget?.closest('.selection-item-name')) {
                e.stopPropagation();
                if (this.managers && this.managers.ui) {
                    this.managers.ui.showDetailModal(path, this.datasetMap);
                }
                return;
            }

            // Remove button
            if (clickTarget?.closest('.btn-remove')) {
                e.stopPropagation();
                this.managers.selectionPanel.listDatasets.delete(path);
                this.managers.selectionPanel.markListChanged();
                this.managers.videoGrid.updateCardStyles();
                this.managers.selectionPanel.updateSelectionPanel();
                return;
            }

            // Detail button
            if (clickTarget?.closest('.btn-detail')) {
                e.stopPropagation();
                this.managers.ui.showDetailModal(path, this.datasetMap);
                return;
            }

            // Toggle selection
            if (this.selectedDatasets.has(path)) {
                this.selectedDatasets.delete(path);
            } else {
                this.selectedDatasets.add(path);
            }
            this.managers.videoGrid.updateCardStyles();
            this.managers.selectionPanel.updateSelectionPanel();
        });
    }

    /**
     * Freeze card thumbnail video to a static image while hover overlay is shown.
     * This keeps the UI responsive by avoiding extra video decoding/rendering.
     * @param {HTMLElement} card - Video card element
     */
    freezeCardThumbnail(card) {
        if (!card || card.dataset.hoverFrozen === 'true') return;

        const thumbnail = card.querySelector('.video-thumbnail');
        if (!thumbnail) return;

        const video = thumbnail.querySelector('video');
        const img = thumbnail.querySelector('.thumbnail-image');

        if (video) {
            try {
                video.pause();
            } catch (e) {
                // Ignore pause errors
            }
            video.style.opacity = '0';
        }

        if (img) {
            img.style.opacity = '1';
        }

        card.dataset.hoverFrozen = 'true';
    }

    /**
     * Clear hover freeze flag after overlay is hidden.
     * @param {HTMLElement} card - Video card element
     */
    unfreezeCardThumbnail(card) {
        if (!card || card.dataset.hoverFrozen !== 'true') return;

        const thumbnail = card.querySelector('.video-thumbnail');
        if (!thumbnail) {
            delete card.dataset.hoverFrozen;
            return;
        }

        const video = thumbnail.querySelector('video');
        const img = thumbnail.querySelector('.thumbnail-image');

        // 如果视频已经加载过（data-video-loaded 标记为 true），直接恢复播放与显示
        if (thumbnail.dataset.videoLoaded === 'true' && video) {
            video.style.opacity = '1';
            if (img) {
                img.style.opacity = '0';
            }
            try {
                video.play();
            } catch (e) {
                // 忽略播放错误，保持静态缩略图也可以接受
            }
        } else {
            // 尚未加载过视频：通过重新 observe 触发 IntersectionObserver 的首次回调，
            // 让现有的自动播放逻辑在卡片可见时自行加载/播放
            const videoGridManager = this.managers && this.managers.videoGrid;
            if (videoGridManager && videoGridManager.videoAutoPlayObserver) {
                try {
                    if (card.dataset.videoObserved) {
                        videoGridManager.videoAutoPlayObserver.unobserve(card);
                    }
                    videoGridManager.videoAutoPlayObserver.observe(card);
                    card.dataset.videoObserved = 'true';
                } catch (e) {
                    // 如果观察失败则静默退化为仅显示缩略图
                }
            }
        }

        delete card.dataset.hoverFrozen;
    }

    /**
     * Add click animation to button
     * @param {HTMLElement} button - Button element
     */
    addClickAnimation(button) {
        if (!button) return;

        // Remove existing animation class if present
        button.classList.remove('click-animate');

        // Force reflow to ensure class removal is processed
        void button.offsetWidth;

        // Add animation class
        button.classList.add('click-animate');

        // Remove class after animation completes (300ms)
        setTimeout(() => {
            button.classList.remove('click-animate');
        }, 300);
    }

    /**
     * Bind toolbar button events
     */
    bindToolbarEvents() {
        const toggleSelectionBtn = document.getElementById('toggleSelectionBtn');
        if (toggleSelectionBtn) {
            toggleSelectionBtn.addEventListener('click', () => {
                this.addClickAnimation(toggleSelectionBtn);
                this.toggleFilteredSelection();
            });
        }

        // Clear Selection Button (Trash icon in panel header)
        const clearSelectionBtn = document.getElementById('clearSelectionBtn');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                this.addClickAnimation(clearSelectionBtn);
                
                // Clear all selections
                this.selectedDatasets.clear();
                this.managers.selectionPanel.listDatasets.clear();
                this.managers.selectionPanel.markListChanged();
                
                // Update UI
                this.managers.videoGrid.updateCardStyles();
                this.managers.selectionPanel.updateSelectionPanel();
            });
        }


        // Import/Export
        const importBtn = document.getElementById('importBtn');
        const importFile = document.getElementById('importFile');
        const exportBtn = document.getElementById('exportBtn');
        const copyCodeBtn = document.getElementById('copyCodeBtn');

        if (importBtn) {
            importBtn.addEventListener('click', () => {
                importFile.click();
            });
        }

        if (importFile) {
            importFile.addEventListener('change', (e) => {
                // 传入回调函数，在导入完成后更新视频网格样式
                this.managers.selectionPanel.handleImportFile(
                    e,
                    this.managers.filter.datasets,
                    () => {
                        // 导入完成后更新视频网格样式
                        this.managers.videoGrid.updateCardStyles();
                    }
                );
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.managers.selectionPanel.exportSelection();
            });
        }

        if (copyCodeBtn) {
            copyCodeBtn.addEventListener('click', () => {
                this.managers.selectionPanel.copyCode();
            });
        }

    }

    /**
     * Bind window resize events
     */
    bindResizeEvents() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const filteredDatasets = this.managers.filter.applyFilters(
                    document.getElementById('searchBox')?.value || ''
                );
                this.managers.videoGrid.renderVideoGrid(filteredDatasets);
            }, 200);
        });
    }

    /**
     * Bind scroll events for virtual scrolling
     */
    bindScrollEvents() {
        // Video grid scroll
        const gridContainer = document.querySelector('.video-grid-container');
        if (gridContainer) {
            let videoScrollTicking = false;

            // Use passive listener for better scroll performance
            gridContainer.addEventListener('scroll', () => {
                if (!videoScrollTicking) {
                    window.requestAnimationFrame(() => {
                        const filteredDatasets = this.managers.filter.applyFilters(
                            document.getElementById('searchBox')?.value || ''
                        );
                        this.managers.videoGrid.renderVideoGrid(filteredDatasets);
                        videoScrollTicking = false;
                    });
                    videoScrollTicking = true;
                }
            }, { passive: true });
        }

        // Selection list scroll
        const selectionList = document.getElementById('selectionList');
        if (selectionList) {
            let selectionScrollTicking = false;

            // Use passive listener for better scroll performance
            selectionList.addEventListener('scroll', () => {
                if (!selectionScrollTicking) {
                    window.requestAnimationFrame(() => {
                        this.managers.selectionPanel.updateSelectionPanel();
                        selectionScrollTicking = false;
                    });
                    selectionScrollTicking = true;
                }
            }, { passive: true });
        }
    }

    /**
     * Toggle dataset selection
     * @param {string} path - Dataset path
     */
    toggleSelection(path) {
        if (this.selectedDatasets.has(path)) {
            this.selectedDatasets.delete(path);
            this.managers.selectionPanel.listDatasets.delete(path);
            this.managers.selectionPanel.markListChanged();
        } else {
            this.selectedDatasets.add(path);
            this.managers.selectionPanel.listDatasets.add(path);
            this.managers.selectionPanel.markListChanged();
        }
        this.managers.videoGrid.updateCardStyles();
        this.managers.selectionPanel.updateSelectionPanel();
    }

    /**
     * Toggle selection for all filtered datasets (select if any unselected, deselect if all selected)
     */
    toggleFilteredSelection() {
        const filteredDatasets = this.managers.filter.applyFilters(
            document.getElementById('searchBox')?.value || ''
        );
        if (filteredDatasets.length === 0) return;

        const areAllSelected = filteredDatasets.every(ds => this.selectedDatasets.has(ds.path));

        filteredDatasets.forEach(ds => {
            if (areAllSelected) {
                this.selectedDatasets.delete(ds.path);
                this.managers.selectionPanel.listDatasets.delete(ds.path);
            } else {
                this.selectedDatasets.add(ds.path);
                this.managers.selectionPanel.listDatasets.add(ds.path);
            }
        });

        this.managers.selectionPanel.markListChanged();
        this.managers.videoGrid.updateCardStyles();
        this.managers.selectionPanel.updateSelectionPanel();
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

export default EventHandlers;
