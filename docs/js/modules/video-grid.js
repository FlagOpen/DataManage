/**
 * @file Video Grid Module
 * @description Manages video grid rendering with virtual scrolling
 */

/// <reference path="../types.js" />

import ConfigManager from './config.js';
import Templates from '../templates.js';
import { calculateVisibleRange, ElementCache } from './virtual-scroll.js';
import RobotAliasManager from './robot-aliases.js';
import DownloadManager from './download-manager.js';

/**
 * Video Grid Manager Class
 */
export class VideoGridManager {
    /**
     * @param {Set<string>} selectedDatasets - Selected dataset paths
     * @param {Set<string>} listDatasets - Cart dataset paths
     */
    constructor(selectedDatasets, listDatasets) {
        this.selectedDatasets = selectedDatasets;
        this.listDatasets = listDatasets;
        
        /** @type {Dataset[]} */
        this.filteredDatasets = [];
        
        /** @type {Object} */
        this.config = ConfigManager.getConfig();
        
        /** @type {ElementCache} */
        this._videoCardIndex = new ElementCache();
        
        /** @type {IntersectionObserver|null} */
        this.videoAutoPlayObserver = null;
        
        /** @type {HTMLElement|null} */
        this._tempMeasureDiv = null;
        
        /** @type {boolean} */
        this.updateStylesScheduled = false;
    }
    
    /**
     * Update dynamic grid CSS variables
     * @param {number} cardWidth - Card width
     * @param {number} columns - Number of columns
     */
    updateDynamicGridVariables(cardWidth, columns) {
        document.documentElement.style.setProperty('--grid-card-width', `${cardWidth}px`);
        document.documentElement.style.setProperty('--grid-columns', columns);
        document.documentElement.style.setProperty('--grid-padding', 
            getComputedStyle(document.documentElement).getPropertyValue('--content-padding'));
    }
    
    /**
     * Render video grid with virtual scrolling
     * @param {Dataset[]} datasets - Filtered datasets to render
     */
    renderVideoGrid(datasets) {
        this.filteredDatasets = datasets;
        
        const grid = document.getElementById('videoGrid');
        if (!grid) return;
        
        const container = grid.parentElement;
        if (!container) return;
        
        // 直接使用 grid 的实际宽度，因为卡片是相对于 grid 定位的
        // 这样可以确保计算的宽度与实际的 grid 宽度一致
        const gridWidth = grid.clientWidth;
        
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
        tempDiv.style.width = 'var(--grid-min-card-width)';
        tempDiv.style.height = 'var(--grid-card-height)';
        tempDiv.style.margin = 'var(--grid-gap)';
        
        const computedTemp = getComputedStyle(tempDiv);
        const minCardWidthPx = parseFloat(computedTemp.width) || 250;
        const cardHeightPx = parseFloat(computedTemp.height) || 300;
        const gapPx = parseFloat(computedTemp.marginTop) || 16;
        
        // Calculate layout
        const itemsPerRow = Math.max(1, Math.floor((gridWidth + gapPx) / (minCardWidthPx + gapPx)));
        const cardWidth = Math.floor((gridWidth - gapPx * (itemsPerRow - 1)) / itemsPerRow);
        
        // Update dynamic CSS variables
        this.updateDynamicGridVariables(cardWidth, itemsPerRow);
        
        const itemHeight = cardHeightPx + gapPx;
        
        // Calculate visible range (with buffer)
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        const startRow = Math.max(0, Math.floor(scrollTop / itemHeight) - this.config.grid.bufferRows);
        const endRow = Math.ceil((scrollTop + containerHeight) / itemHeight) + this.config.grid.bufferRows;
        const startIndex = startRow * itemsPerRow;
        const endIndex = Math.min(this.filteredDatasets.length, endRow * itemsPerRow);
        
        // Set grid total height (maintain scrollbar)
        const totalRows = Math.ceil(this.filteredDatasets.length / itemsPerRow);
        grid.style.height = `${totalRows * itemHeight}px`;
        
        // Get visible datasets
        const visibleDatasets = this.filteredDatasets.slice(startIndex, endIndex);
        const visiblePaths = new Set(visibleDatasets.map(ds => ds.path));
        
        // Remove invisible cards
        const existingCards = grid.querySelectorAll('.video-card');
        existingCards.forEach(card => {
            const path = card.dataset.path;
            if (!visiblePaths.has(path)) {
                // 取消观察（观察的是 card，不是 video）
                if (this.videoAutoPlayObserver && card.dataset.videoObserved) {
                    this.videoAutoPlayObserver.unobserve(card);
                }
                // 停止视频播放并清理资源
                const video = card.querySelector('video');
                if (video) {
                    // 标记该视频已被主动清理，后续触发的 error 视为软错误
                    video.dataset.ignoreError = 'true';
                    video.pause();
                    video.src = '';
                    video.srcObject = null;
                }
                card.remove();
                this._videoCardIndex.delete(path);
            } else {
                this._videoCardIndex.set(path, card);
            }
        });
        
        // Add/update visible cards
        const fragment = document.createDocumentFragment();
        visibleDatasets.forEach((ds, i) => {
            const globalIndex = startIndex + i;
            const row = Math.floor(globalIndex / itemsPerRow);
            const col = globalIndex % itemsPerRow;
            
            let card = this._videoCardIndex.get(ds.path);
            const isNewCard = !card;
            
            if (isNewCard) {
                card = this.createVideoCard(ds);
            }
            
            // Set absolute positioning and size
            card.style.position = 'absolute';
            // 确保最后一列的位置计算正确
            const leftPosition = col * (cardWidth + gapPx);
            card.style.left = `${leftPosition}px`;
            card.style.top = `${row * itemHeight}px`;
            card.style.width = 'var(--grid-card-width)';
            card.style.height = 'var(--grid-card-height)';
            
            // Update card state
            this.updateCardState(card, ds);
            
            if (isNewCard) {
                this._videoCardIndex.set(ds.path, card);
                fragment.appendChild(card);
            }
        });
        
        // Batch add new cards
        if (fragment.hasChildNodes()) {
            grid.appendChild(fragment);
        }
        
        // Observe videos for auto-play
        this.observeVideos();

        // Bind download button events
        DownloadManager.bindDownloadButtons();
    }
    
    /**
     * Create single video card
     * @param {Dataset} ds - Dataset object
     * @returns {HTMLElement} Video card element
     */
    createVideoCard(ds) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.path = ds.path;
        if (this.selectedDatasets.has(ds.path)) card.classList.add('selected');
        
        card.innerHTML = Templates.buildVideoCard(
            ds,
            this.formatMetaTags.bind(this),
            this.listDatasets
        );
        
        return card;
    }
    
    /**
     * Update single card state
     * @param {HTMLElement} card - Card element
     * @param {Dataset} ds - Dataset object
     */
    updateCardState(card, ds) {
        const shouldBeSelected = this.selectedDatasets.has(ds.path);
        const isSelected = card.classList.contains('selected');
        
        if (shouldBeSelected !== isSelected) {
            card.classList.toggle('selected', shouldBeSelected);
        }
        
        const shouldBeInCart = this.listDatasets.has(ds.path);
        card.classList.toggle('in-cart', shouldBeInCart);
    }
    
    /**
     * Update all card styles (batched)
     */
    updateCardStyles() {
        if (this.updateStylesScheduled) return;
        
        this.updateStylesScheduled = true;
        requestAnimationFrame(() => {
            const cards = document.querySelectorAll('.video-card');
            
            const updates = [];
            cards.forEach(card => {
                const path = card.dataset.path;
                if (!path) return;
                
                const shouldBeSelected = this.selectedDatasets.has(path);
                const shouldHaveBadge = this.listDatasets.has(path);
                
                updates.push({ card, path, shouldBeSelected, shouldHaveBadge });
            });
            
            updates.forEach(({ card, path, shouldBeSelected, shouldHaveBadge }) => {
                card.classList.toggle('selected', shouldBeSelected);
                card.classList.toggle('in-cart', shouldHaveBadge);
            });
            
            this.updateStylesScheduled = false;
        });
    }
    
    /**
     * Observe videos for auto-play
     */
    observeVideos() {
        if (!this.videoAutoPlayObserver) {
            this.videoAutoPlayObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const card = entry.target;
                    const thumbnail = card.querySelector('.video-thumbnail');
                    
                    if (!thumbnail) return;
                    
                    if (entry.isIntersecting) {
                        if (!thumbnail.dataset.videoLoading && !thumbnail.dataset.videoLoaded) {
                            thumbnail.dataset.videoLoading = 'true';
                            this.loadAndPlayVideo(thumbnail);
                        }
                    } else {
                        const video = thumbnail.querySelector('video');
                        if (video) {
                            video.pause();
                        }
                    }
                });
            }, { 
                rootMargin: '200px',
                threshold: 0.01
            });
        }
        
        document.querySelectorAll('.video-card').forEach(card => {
            if (!card.dataset.videoObserved) {
                this.videoAutoPlayObserver.observe(card);
                card.dataset.videoObserved = 'true';
            }
        });
    }
    
    /**
     * Load and play video
     * @param {HTMLElement} thumbnail - Thumbnail element
     */
    loadAndPlayVideo(thumbnail) {
        const videoUrl = thumbnail.dataset.videoUrl;
        if (!videoUrl) return;
        
        // 检查元素是否还在 DOM 中
        if (!thumbnail.isConnected) {
            delete thumbnail.dataset.videoLoading;
            return;
        }
        
        let video = thumbnail.querySelector('video');
        
        if (!video) {
            video = document.createElement('video');
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.className = 'lazy-video';
            video.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; z-index: 2; transition: opacity 0.3s ease;';
            
            const source = document.createElement('source');
            source.src = videoUrl;
            source.type = 'video/mp4';
            
            video.appendChild(source);
            thumbnail.insertBefore(video, thumbnail.firstChild);
            
            video.addEventListener('loadeddata', () => {
                // 检查元素是否还在 DOM 中
                if (!thumbnail.isConnected || !video.isConnected) {
                    delete thumbnail.dataset.videoLoading;
                    return;
                }
                
                const img = thumbnail.querySelector('.thumbnail-image');
                video.style.opacity = '1';
                if (img) img.style.opacity = '0';
                
                video.play().catch(() => {});
                
                thumbnail.dataset.videoLoaded = 'true';
                delete thumbnail.dataset.videoLoading;
            }, { once: true });
            
            video.addEventListener('error', (e) => {
                // 如果是我们在虚拟滚动中主动清理过的视频，视为正常资源回收，不打硬错误
                if (video.dataset.ignoreError === 'true') {
                    console.debug('Soft video error after cleanup, ignoring', {
                        url: videoUrl,
                        readyState: video.readyState,
                        networkState: video.networkState,
                        event: e
                    });
                    delete thumbnail.dataset.videoLoading;
                    return;
                }

                const mediaError = video.error;

                // 某些情况下浏览器会触发 error 事件但并没有 MediaError
                // 例如请求被中止、元素被移除，这类“软错误”不需要打红色错误日志
                if (!mediaError) {
                    console.debug('Soft video error (no MediaError), ignoring', {
                        url: videoUrl,
                        readyState: video.readyState,
                        networkState: video.networkState,
                        event: e
                    });
                    delete thumbnail.dataset.videoLoading;
                    return;
                }

                console.error('Video load error (hard failure)', {
                    url: videoUrl,
                    code: mediaError.code,       // 1: aborted, 2: network, 3: decode, 4: unsupported src
                    message: mediaError.message,
                    readyState: video.readyState,
                    networkState: video.networkState
                });
                delete thumbnail.dataset.videoLoading;
            }, { once: true });
            
            video.load();
        } else {
            // 检查元素是否还在 DOM 中
            if (!thumbnail.isConnected || !video.isConnected) {
                return;
            }
            
            if (video.paused) {
                video.style.opacity = '1';
                const img = thumbnail.querySelector('.thumbnail-image');
                if (img) img.style.opacity = '0';
                
                video.play().catch(() => {});
            }
        }
    }
    
    /**
     * Format meta tags for video card
     * @param {Dataset} ds - Dataset
     * @returns {string} HTML string
     */
    formatMetaTags(ds) {
        const tags = [];

        // Size information - show dataset size and key statistics
        if (ds.datasetSize) {
            tags.push(Templates.buildVideoTag(ds.datasetSize));
        }

        // Show key statistics if available
        if (ds.statistics) {
            const stats = ds.statistics;
            if (stats.total_episodes && stats.total_frames) {
                // Format episode count and total frames
                const episodes = stats.total_episodes;
                const frames = stats.total_frames;
                const formattedFrames = frames >= 1000000 ? `${(frames / 1000000).toFixed(1)}M` : frames >= 1000 ? `${Math.floor(frames / 1000)}K` : frames.toString();
                tags.push(Templates.buildVideoTag(`${episodes} ep, ${formattedFrames} fr`));
            }
        }

        const sceneHierarchy = ds.scenes?.hierarchy || [];
        if (sceneHierarchy.length > 0) {
            const more = sceneHierarchy.length > 1 ? `+${sceneHierarchy.length - 1}` : '';
            tags.push(Templates.buildVideoTag(sceneHierarchy[0], more));
        }

        // Robot information moved to hover overlay since it's already shown in title

        const endEffectors = Array.isArray(ds.endEffectors)
            ? ds.endEffectors
            : ds.endEffector
                ? [ds.endEffector]
                : [];
        if (endEffectors.length > 0) {
            const more = endEffectors.length > 1 ? `+${endEffectors.length - 1}` : '';
            tags.push(Templates.buildVideoTag(endEffectors[0], more));
        }

        return tags.join('');
    }
    
}

export default VideoGridManager;
