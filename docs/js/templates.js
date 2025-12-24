/**
 * @file HTML Templates Module
 * @description Contains all HTML template generation functions for the RoboCOIN application
 */

/// <reference path="./types.js" />

import RobotAliasManager from './modules/robot-aliases.js';

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char] || char);
}
const Templates = {
    /**
     * Filter Group Templates
     */

    /**
     * Get display label for a robot value using alias map.
     * @param {string} robotId
     * @returns {string}
     */
    getRobotDisplayLabel(robotId) {
        if (RobotAliasManager && typeof RobotAliasManager.getDisplayName === 'function') {
            return RobotAliasManager.getDisplayName(robotId);
        }
        return robotId;
    },

    /**
     * Get display-friendly dataset name (mapped) with HTML escaping.
     * @param {Dataset} ds
     * @returns {string}
     */
    getDatasetDisplayName(ds) {
        const nameValue = (ds && (ds.displayName || ds.name)) || '';
        return escapeHtml(nameValue);
    },

    /**
     * Build flat filter group HTML
     * @param {string} key - Filter key
     * @param {FilterGroup} group - Filter group
     * @param {number} baseIndent - Base indentation
     * @returns {string} HTML string
     */
    buildFlatFilterGroup(key, group, baseIndent) {
        return `
            <div class="filter-option-wrapper" data-level="0">
                <div class="filter-option hierarchy-name-only" data-group-key="${key}">
                    <div class="filter-option-label">
                        <span class="hierarchy-label">${group.title}</span>
                    </div>
                    <div class="hierarchy-actions">
                        <button class="hierarchy-action-btn select-all" data-group="${key}" data-action="select-all" title="Select all in ${group.title}">All</button>
                        <button class="hierarchy-action-btn clear-all" data-group="${key}" data-action="clear-group" title="Clear ${group.title}">✕ Clear</button>
                    </div>
                </div>
                <div class="filter-children collapsed" data-group="${key}">
                    ${Array.from(group.values).sort().map(val => this.buildFlatFilterOption(key, val, baseIndent)).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Build flat filter option HTML
     * @param {string} key - Filter key
     * @param {string} val - Filter value
     * @param {number} baseIndent - Base indentation
     * @returns {string} HTML string
     */
    buildFlatFilterOption(key, val, baseIndent) {
        const displayValue = key === 'robot'
            ? this.getRobotDisplayLabel(val)
            : val;
        return `
            <div class="filter-option-wrapper" style="margin-left: ${baseIndent}px;" data-level="1">
                <div class="filter-option" data-filter="${key}" data-value="${val}">
                    <div class="filter-option-label">
                        <span>${displayValue}</span>
                    </div>
                    <div class="filter-option-count" data-count="${key}-${val}">0</div>
                </div>
            </div>
        `;
    },

    /**
     * Build hierarchical filter group HTML
     * @param {string} key - Filter key
     * @param {FilterGroup} group - Filter group
     * @param {Function} buildHierarchyHTML - Function to build hierarchy HTML
     * @returns {string} HTML string
     */
    buildHierarchicalFilterGroup(key, group, buildHierarchyHTML) {
        return `
            <div class="filter-option-wrapper" data-level="0">
                <div class="filter-option hierarchy-name-only" data-group-key="${key}">
                    <div class="filter-option-label">
                        <span class="hierarchy-label">${group.title}</span>
                    </div>
                    <div class="hierarchy-actions">
                        <button class="hierarchy-action-btn select-all" data-group="${key}" data-action="select-all" title="Select all in ${group.title}">All</button>
                        <button class="hierarchy-action-btn clear-all" data-group="${key}" data-action="clear-group" title="Clear ${group.title}">✕ Clear</button>
                    </div>
                </div>
                <div class="filter-children collapsed" data-group="${key}">
                    ${buildHierarchyHTML(group.values)}
                </div>
            </div>
        `;
    },

    buildHierarchyOption(key, value, fullPath, hasChildren, level, baseIndent, childrenHTML = '') {
        const indent = baseIndent;

        if (hasChildren) {
            return `
                <div class="filter-option-wrapper" style="margin-left: ${indent}px;" data-level="${level}">
                    <div class="filter-option hierarchy-name-only" data-path="${fullPath}">
                        <div class="filter-option-label">
                            <span class="hierarchy-label">${value}</span>
                        </div>
                        <div class="hierarchy-actions">
                            <button class="hierarchy-action-btn select-all" data-key="${key}" data-path="${fullPath}" data-action="select-all-children" title="Select all children">All</button>
                            <button class="hierarchy-action-btn clear-all" data-key="${key}" data-path="${fullPath}" data-action="clear-all-children" title="Clear all children">✕ Clear</button>
                        </div>
                    </div>
                    <div class="filter-children collapsed">
                        ${childrenHTML}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="filter-option-wrapper" style="margin-left: ${indent}px;" data-level="${level}">
                    <div class="filter-option" data-filter="${key}" data-value="${value}">
                        <div class="filter-option-label">
                            <span>${value}</span>
                        </div>
                        <div class="filter-option-count" data-count="${key}-${fullPath}">0</div>
                    </div>
                </div>
            `;
        }
    },

    /**
     * Video Card Templates
     */

    /**
     * Build video card HTML
     * @param {Dataset} ds - Dataset object
     * @param {Function} formatMetaTags - Function to format meta tags
     * @param {Set<string>} listDatasets - Set of dataset paths in cart
     * @returns {string} HTML string
     */
    buildVideoCard(ds, formatMetaTags, listDatasets) {
        const displayName = this.getDatasetDisplayName(ds);
        const hoverOriginalLabel = this.buildDatasetOriginalLabel(ds.name);
        return `
            <div class="video-thumbnail" data-video-url="${ds.video_url}">
                <img src="${ds.thumbnail_url}"
                     alt="${displayName}"
                     class="thumbnail-image"
                     loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <div class="video-error" style="display:none;">No Thumbnail</div>
                <div class="play-indicator" style="display:none;">▶</div>
                <button class="download-button" data-dataset-path="${ds.path}" title="Copy download command">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M19,14 L19,19 L5,19 L5,14 L3,14 L3,19 C3,20.1 3.9,21 5,21 L19,21 C20.1,21 21,20.1 21,19 L21,14 L19,14 Z M12.5,2 L12.5,15 L8.5,11 L7,12.5 L12,17.5 L17,12.5 L15.5,11 L11.5,15 L11.5,2 L12.5,2 Z"/>
                    </svg>
                </button>
            </div>
            <div class="video-info">
                <div class="video-title" data-path="${ds.path}" style="cursor: pointer;">${displayName}</div>
                <div class="video-tags">${formatMetaTags(ds)}</div>
            </div>
            <div class="video-hover-overlay">
                <div class="video-hover-content">
                    <div class="hover-click-hint">(Click title to see more)</div>
                    <div class="video-hover-title" data-path="${ds.path}" style="cursor: pointer;">${displayName}</div>
                    ${hoverOriginalLabel}
                    <div class="video-hover-details">${this.buildHoverDetailsHTML(ds)}</div>
                </div>
            </div>
        `;
    },

    buildVideoTag(text, more = '') {
        const moreHtml = more ? `<sup class="tag-count">${more}</sup>` : '';
        return `<span class="video-tag"><span class="tag-text">${text}</span>${moreHtml}</span>`;
    },

    buildVideoErrorBadge() {
        return '<div class="video-error" style="display:none;">No Video</div>';
    },

    /**
     * Hover Overlay Templates
     */
    buildHoverDetailsHTML(ds) {
        let html = '';

        // Basic info - simple format
        if (ds.robot) {
            const robots = Array.isArray(ds.robot) ? ds.robot : [ds.robot];
            const displayRobots = robots.map(r => this.getRobotDisplayLabel(r));
            html += `<strong>Robot:</strong> ${displayRobots.join(', ')}<br>`;
        }

        // if (ds.robot_type) {
        //     html += `<strong>Robot Type:</strong> ${ds.robot_type}<br>`;
        // NOTE: This is the ORIGINAL name in the hub, not mapped name. So we
        // no longer show it anymore, thus annotated.
        // }

        const endEffectors = Array.isArray(ds.endEffectors)
            ? ds.endEffectors
            : ds.endEffector
                ? [ds.endEffector]
                : Array.isArray(ds.raw?.end_effector_type)
                    ? ds.raw.end_effector_type
                    : ds.raw?.end_effector_type
                        ? [ds.raw.end_effector_type]
                        : [];
        if (endEffectors.length > 0) {
            html += `<strong>End Effector:</strong> ${endEffectors.join(', ')}<br>`;
        }

        if (ds.scenes && ds.scenes.length > 0) {
            html += `<strong>Scene:</strong> ${ds.scenes.join(', ')}<br>`;
        }

        // if (ds.platformHeight !== undefined) {
        //     html += `<strong>Platform Height:</strong> ${ds.platformHeight} cm<br>`;
        // }

        if (ds.datasetSize) {
            html += `<strong>Dataset Size:</strong> ${ds.datasetSize}<br>`;
        }

        // Statistics - show all available stats with specific numbers
        if (ds.statistics) {
            const stats = ds.statistics;
            html += `<strong>Statistics:</strong><br>`;
            if (stats.total_episodes) html += `• Episodes: ${stats.total_episodes.toLocaleString()}<br>`;
            if (stats.total_frames) html += `• Frames: ${stats.total_frames.toLocaleString()}<br>`;
            if (stats.total_videos) html += `• Videos: ${stats.total_videos}<br>`;
            if (stats.total_tasks) html += `• Tasks: ${stats.total_tasks}<br>`;
            if (stats.total_chunks) html += `• Chunks: ${stats.total_chunks}<br>`;
            if (stats.chunks_size) html += `• Chunk Size: ${stats.chunks_size}<br>`;
            if (stats.fps) html += `• FPS: ${stats.fps}<br>`;
        }

        // Atomic actions
        if (ds.atomic_actions && ds.atomic_actions.length > 0) {
            html += `<strong>Atomic Actions:</strong> ${ds.atomic_actions.join(', ')}<br>`;
        }

        // Objects
        if (ds.objects && ds.objects.length > 0) {
            const objectNames = ds.objects.map(obj => obj.object_name || obj.name).filter(name => name);
            if (objectNames.length > 0) {
                html += `<strong>Objects:</strong> ${objectNames.join(', ')}<br>`;
            }
        }

        // Camera information
        if (ds.cameras && ds.cameras.length > 0) {
            html += `<strong>Cameras:</strong> ${ds.cameras.length}<br>`;
            // Show camera details if space allows
            const cameraNames = ds.cameras.map(cam => cam.name || cam.key.split('.').pop()).slice(0, 3);
            if (cameraNames.length > 0) {
                html += `• ${cameraNames.join(', ')}${ds.cameras.length > 3 ? '...' : ''}<br>`;
            }
        }

        // License and tags
        if (ds.license) {
            html += `<strong>License:</strong> ${ds.license}<br>`;
        }

        if (ds.tags && ds.tags.length > 0) {
            html += `<strong>Tags:</strong> ${ds.tags.join(', ')}<br>`;
        }

        // Description (if available and not too long)
        if (ds.description && ds.description.length < 150) {
            html += `<strong>Description:</strong> ${ds.description.replace(/\n/g, '<br>')}`;
        }

        return html;
    },

    /**
     * Create the small original-name label used in modals and overlays.
     * @param {string} originalName
     * @returns {string}
     */
    buildDatasetOriginalLabel(originalName) {
        if (!originalName) return '';
        const encodedName = encodeURIComponent(originalName);
        const url = `https://huggingface.co/datasets/RoboCOIN/${encodedName}`;
        return `<div class="dataset-original-name">Dataset Name In Hub: <a class="dataset-original-link" href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(originalName)}</a></div>`;
    },

    buildHoverInfoGroup(label, content, useTags = true) {
        return `
            <div class="hover-info-group">
                <div class="hover-info-label">${label}</div>
                <div class="hover-info-content${useTags ? ' tags' : ''}">${content}</div>
            </div>
        `;
    },

    buildHoverTag(text) {
        return `<span class="hover-tag">${text}</span>`;
    },

    /**
     * Selection Panel Templates
     */
    buildEmptyCartHint() {
        return `
            <div class="empty-cart-hint">
                Click the download icon on the right side of the video card for individual downloads.<br>
                Use Filter to select datasets, then click on selected datasets and use Batch Downloader here for bulk downloads.
            </div>
        `;
    },



    buildSelectionItem(ds) {
        const displayName = this.getDatasetDisplayName(ds);
        return `
            <div class="selection-item-name" style="cursor: pointer;">${displayName}</div>
            <button class="btn-detail" data-path="${ds.path}" title="View details">...</button>
            <button class="btn-remove" data-path="${ds.path}">×</button>
        `;
    },

    /**
     * Detail Modal Templates
     */
    buildDetailModal(dataset) {

        const datasetDisplayName = this.getDatasetDisplayName(dataset);
        const originalNameLabel = this.buildDatasetOriginalLabel(dataset.name);
        const sceneTypeSource = Array.isArray(dataset.scenes) && dataset.scenes.length > 0
            ? dataset.scenes
            : (Array.isArray(dataset.raw?.scene_type) ? dataset.raw.scene_type : []);
        const sceneTypeText = sceneTypeSource.length > 0 ? sceneTypeSource.join(', ') : 'N/A';

        const atomicActionsSource = Array.isArray(dataset.actions) && dataset.actions.length > 0
            ? dataset.actions
            : (Array.isArray(dataset.raw?.atomic_actions) ? dataset.raw.atomic_actions : []);
        const atomicActionsText = atomicActionsSource.length > 0 ? atomicActionsSource.join(', ') : 'N/A';

        const totalFramesValue = dataset.statistics?.total_frames ?? dataset.raw?.statistics?.total_frames;
        const totalFramesNumber = typeof totalFramesValue === 'number' ? totalFramesValue : Number(totalFramesValue);
        const hasFrameCount = totalFramesValue !== undefined && totalFramesValue !== null && !Number.isNaN(totalFramesNumber);
        const totalFramesText = hasFrameCount ? `${totalFramesNumber.toLocaleString()} frames` : 'N/A';

        let objectsHTML = 'N/A';
        if (Array.isArray(dataset.objects) && dataset.objects.length > 0) {
            objectsHTML = dataset.objects.map(obj => {
                const level1 = obj.level1 || obj.hierarchy?.[0] || '';
                const level2 = obj.level2 || obj.hierarchy?.[1] || '';
                const level3 = obj.level3 || obj.hierarchy?.[2] || '';
                const hierarchyText = [level1, level2, level3].filter(l => l).join(' > ');
                return `<div style="margin-bottom: 4px;">• ${obj.object_name || obj.name} (${hierarchyText})</div>`;
            }).join('');
        }

        return `
            <div class="detail-modal">
                <div class="detail-modal-header">
                    <div class="detail-modal-title-group">
                        <h3 class="detail-modal-title" style="cursor: pointer;">${datasetDisplayName}</h3>
                        ${originalNameLabel}
                    </div>
                    <button class="detail-modal-close">×</button>
                </div>
                <div class="detail-modal-body">
                    ${this.buildDetailVideo(dataset.video_url)}
                    ${this.buildDetailInfoGrid(dataset, sceneTypeText, atomicActionsText, objectsHTML, totalFramesText)}
                </div>
            </div>
        `;
    },

    buildDetailVideo(videoUrl) {
        return `
            <div class="detail-video-container">
                <video autoplay loop muted playsinline preload="auto">
                    <source src="${videoUrl}" type="video/mp4">
                    <div class="video-error">Video not found</div>
                </video>
            </div>
        `;
    },

    buildDetailInfoGrid(dataset, sceneTypeText, atomicActionsText, objectsHTML, totalFramesText) {
        const datasetDisplayName = this.getDatasetDisplayName(dataset);
        let robotDisplay = 'N/A';
        if (dataset.robot || dataset.robot_type || dataset.device_model) {
            const robots = [];
            if (dataset.robot) {
                const robotList = Array.isArray(dataset.robot) ? dataset.robot : [dataset.robot];
                robots.push(...robotList);
            }
            if (dataset.robot_type && !robots.includes(dataset.robot_type)) {
                robots.push(dataset.robot_type);
            }
            if (dataset.device_model && Array.isArray(dataset.device_model)) {
                robots.push(...dataset.device_model);
            }
            const displayRobots = robots.map(r => this.getRobotDisplayLabel(r));
            robotDisplay = displayRobots.join(', ');
        }

        // Build camera information
        let camerasHTML = 'N/A';
        if (Array.isArray(dataset.cameras) && dataset.cameras.length > 0) {
            camerasHTML = dataset.cameras.map(cam => {
                const name = cam.name || cam.key.split('.').pop();
                const resolution = cam.resolution ? `${cam.resolution[0]}×${cam.resolution[1]}` : 'N/A';
                const fps = cam.fps || 'N/A';
                const isDepth = cam.is_depth ? ' (Depth)' : '';
                return `<div style="margin-bottom: 4px;">• ${name}: ${resolution} @ ${fps}fps${isDepth}</div>`;
            }).join('');
        }

        // Build statistics information
        let statisticsHTML = 'N/A';
        if (dataset.statistics) {
            const stats = dataset.statistics;
            const statsList = [];
            if (stats.total_episodes) statsList.push(`Episodes: ${stats.total_episodes.toLocaleString()}`);
            if (stats.total_frames) statsList.push(`Frames: ${stats.total_frames.toLocaleString()}`);
            if (stats.total_videos) statsList.push(`Videos: ${stats.total_videos}`);
            if (stats.total_tasks) statsList.push(`Tasks: ${stats.total_tasks}`);
            if (stats.total_chunks) statsList.push(`Chunks: ${stats.total_chunks}`);
            if (stats.chunks_size) statsList.push(`Chunk Size: ${stats.chunks_size}`);
            if (stats.fps) statsList.push(`FPS: ${stats.fps}`);
            if (statsList.length > 0) {
                statisticsHTML = statsList.join('<br>');
            }
        }

        // Build sub-tasks information
        let subTasksHTML = 'N/A';
        if (Array.isArray(dataset.sub_tasks) && dataset.sub_tasks.length > 0) {
            subTasksHTML = dataset.sub_tasks.map(task => `<div style="margin-bottom: 2px;">• ${task}</div>`).join('');
        } else if (Array.isArray(dataset.raw?.sub_tasks) && dataset.raw.sub_tasks.length > 0) {
            subTasksHTML = dataset.raw.sub_tasks.map(task => `<div style="margin-bottom: 2px;">• ${task}</div>`).join('');
        }

        // Build authors information
        let authorsHTML = 'N/A';
        const authorsData = dataset.authors || dataset.raw?.authors;
        if (authorsData) {
            const contributedBy = authorsData.contributed_by;
            const annotatedBy = authorsData.annotated_by;
            const authorsList = [];
            if (Array.isArray(contributedBy)) {
                contributedBy.forEach(author => {
                    authorsList.push(`Contributed by: ${author.name} (${author.affiliation})`);
                });
            }
            if (Array.isArray(annotatedBy)) {
                annotatedBy.forEach(author => {
                    authorsList.push(`Annotated by: ${author.name} (${author.affiliation})`);
                });
            }
            if (authorsList.length > 0) {
                authorsHTML = authorsList.join('<br>');
            }
        }

        const endEffectorValues = Array.isArray(dataset.endEffectors)
            ? dataset.endEffectors
            : dataset.endEffector
                ? [dataset.endEffector]
                : Array.isArray(dataset.raw?.end_effector_type)
                    ? dataset.raw.end_effector_type
                    : dataset.raw?.end_effector_type
                        ? [dataset.raw.end_effector_type]
                        : [];
        const endEffectorText = endEffectorValues.length > 0 ? endEffectorValues.join(', ') : 'N/A';

        return `
            <div class="detail-info-grid">
                <!-- Basic Information Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Basic Information</h4>
                    ${this.buildDetailInfoItem('Dataset Name', datasetDisplayName)}
                    ${this.buildDetailInfoItem('Dataset UUID', dataset.dataset_uuid || dataset.raw?.dataset_uuid || 'N/A')}
                    ${this.buildDetailInfoItem('Task Description', dataset.tasks || dataset.raw?.tasks || dataset.description || 'N/A')}
                ${this.buildDetailInfoItem('Device Model (Robot)', robotDisplay)}
                    ${this.buildDetailInfoItem('Dataset Size', dataset.datasetSize || dataset.raw?.dataset_size || 'N/A')}
                    ${this.buildDetailInfoItem('Total Frames', totalFramesText)}
                    ${this.buildDetailInfoItem('License', dataset.license || dataset.raw?.license || 'N/A')}
                    ${this.buildDetailInfoItem('Language', Array.isArray(dataset.language) ? dataset.language.join(', ') : (Array.isArray(dataset.raw?.language) ? dataset.raw.language.join(', ') : 'N/A'))}
                    ${this.buildDetailInfoItem('Task Categories', Array.isArray(dataset.task_categories) ? dataset.task_categories.join(', ') : (Array.isArray(dataset.raw?.task_categories) ? dataset.raw.task_categories.join(', ') : 'N/A'))}
                    ${this.buildDetailInfoItem('Tags', Array.isArray(dataset.tags) ? dataset.tags.join(', ') : (Array.isArray(dataset.raw?.tags) ? dataset.raw.tags.join(', ') : 'N/A'))}
                </div>

                <!-- Technical Details Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Technical Details</h4>
                    ${this.buildDetailInfoItem('End Effector Type', endEffectorText)}
                    ${/* ${this.buildDetailInfoItem('Operation Platform Height', dataset.platformHeight !== undefined ? `${dataset.platformHeight} cm` : (dataset.raw?.operation_platform_height !== undefined ? `${dataset.raw.operation_platform_height} cm` : 'N/A'))} */ ''}
                    ${this.buildDetailInfoItem('Scene Type', sceneTypeText)}
                    ${this.buildDetailInfoItem('Atomic Actions', atomicActionsText)}
                    ${this.buildDetailInfoItem('Codebase Version', dataset.codebase_version || dataset.raw?.codebase_version || 'N/A')}
                </div>

                <!-- Statistics Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Statistics</h4>
                    ${this.buildDetailInfoItem('Dataset Statistics', statisticsHTML)}
                </div>

                <!-- Cameras Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Cameras</h4>
                    ${this.buildDetailInfoItem('Camera Configuration', camerasHTML)}
                </div>

                <!-- Objects Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Operation Objects</h4>
                    ${this.buildDetailInfoItem('Objects', objectsHTML)}
                </div>

                <!-- Sub-tasks Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Sub-tasks</h4>
                    ${this.buildDetailInfoItem('Sub-task List', subTasksHTML)}
                </div>

                <!-- Annotations Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Annotations</h4>
                    ${(() => {
                        const annotations = dataset.annotations || dataset.raw?.annotations || {};
                        const availableAnnotations = [];
                        if (annotations.subtask_annotation) availableAnnotations.push('Subtask');
                        if (annotations.scene_annotation) availableAnnotations.push('Scene');
                        if (annotations.eef_direction) availableAnnotations.push('EEF Direction');
                        if (annotations.eef_velocity) availableAnnotations.push('EEF Velocity');
                        if (annotations.eef_acc_mag) availableAnnotations.push('EEF Acceleration Magnitude');
                        if (annotations.gripper_mode) availableAnnotations.push('Gripper Mode');
                        if (annotations.gripper_activity) availableAnnotations.push('Gripper Activity');
                        return this.buildDetailInfoItem('Available Annotations', availableAnnotations.length > 0 ? availableAnnotations.join(', ') : 'N/A');
                    })()}
                </div>

                <!-- Authors & Links Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Authors & Links</h4>
                    ${this.buildDetailInfoItem('Authors', authorsHTML)}
                    ${this.buildDetailInfoItem('Homepage', dataset.homepage || dataset.raw?.homepage ? `<a href="${dataset.homepage || dataset.raw?.homepage}" target="_blank">${dataset.homepage || dataset.raw?.homepage}</a>` : 'N/A')}
                    ${this.buildDetailInfoItem('Paper', dataset.paper || dataset.raw?.paper ? `<a href="${dataset.paper || dataset.raw?.paper}" target="_blank">${dataset.paper || dataset.raw?.paper}</a>` : 'N/A')}
                    ${this.buildDetailInfoItem('Repository', dataset.repository || dataset.raw?.repository ? `<a href="${dataset.repository || dataset.raw?.repository}" target="_blank">${dataset.repository || dataset.raw?.repository}</a>` : 'N/A')}
                    ${this.buildDetailInfoItem('Issues URL', dataset.issues_url || dataset.raw?.issues_url ? `<a href="${dataset.issues_url || dataset.raw?.issues_url}" target="_blank">${dataset.issues_url || dataset.raw?.issues_url}</a>` : 'N/A')}
                    ${this.buildDetailInfoItem('Project Page', dataset.project_page || dataset.raw?.project_page ? `<a href="${dataset.project_page || dataset.raw?.project_page}" target="_blank">${dataset.project_page || dataset.raw?.project_page}</a>` : 'N/A')}
                </div>

                <!-- Contact & Support Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Contact & Support</h4>
                    ${this.buildDetailInfoItem('Contact Info', dataset.contact_info || dataset.raw?.contact_info || 'N/A')}
                    ${this.buildDetailInfoItem('Support Info', dataset.support_info || dataset.raw?.support_info || 'N/A')}
                </div>

                <!-- Citations Section -->
                <div class="detail-info-section">
                    <h4 class="detail-section-title">Citations</h4>
                    ${this.buildDetailInfoItem('Citation BibTeX', dataset.citation_bibtex || dataset.raw?.citation_bibtex ? `<pre style="font-size: 0.75rem; white-space: pre-wrap;">${dataset.citation_bibtex || dataset.raw?.citation_bibtex}</pre>` : 'N/A')}
                    ${this.buildDetailInfoItem('Additional Citations', dataset.additional_citations || dataset.raw?.additional_citations || 'N/A')}
                    ${this.buildDetailInfoItem('Version Info', dataset.version_info || dataset.raw?.version_info || 'N/A')}
                </div>
            </div>
        `;
    },

    buildDetailInfoItem(label, value) {
        return `
            <div class="detail-info-item">
                <div class="detail-info-label">${label}</div>
                <div class="detail-info-value">${value}</div>
            </div>
        `;
    },

    /**
     * Hover Preview Templates
     */
    buildHoverPreview(dataset) {
        const sceneText = Array.isArray(dataset.scenes) && dataset.scenes.length > 0
            ? dataset.scenes.slice(0, 2).join(', ') + (dataset.scenes.length > 2 ? '...' : '')
            : 'N/A';

        const actionText = Array.isArray(dataset.actions) && dataset.actions.length > 0
            ? dataset.actions.slice(0, 2).join(', ') + (dataset.actions.length > 2 ? '...' : '')
            : 'N/A';

        const previewDisplayName = this.getDatasetDisplayName(dataset);
        let robotText = 'N/A';
        if (dataset.robot) {
            const robots = Array.isArray(dataset.robot) ? dataset.robot : [dataset.robot];
            const displayRobots = robots.map(r => this.getRobotDisplayLabel(r));
            robotText = displayRobots.join(', ');
        }

        return `
            <div class="hover-preview-video">
                <video src="${dataset.video_url}" autoplay loop muted preload="auto"></video>
            </div>
            <div class="hover-preview-info">
                <div class="hover-preview-title">${previewDisplayName}</div>
                <div class="hover-preview-meta">
                    ${this.buildHoverPreviewMetaItem('Robot', robotText)}
                    ${this.buildHoverPreviewMetaItem('Scene', sceneText)}
                    ${this.buildHoverPreviewMetaItem('Action', actionText)}
                </div>
                <div class="hover-preview-actions">
                    <button class="hover-preview-detail-btn" type="button">
                        View full details
                    </button>
                </div>
            </div>
        `;
    },

    buildHoverPreviewMetaItem(label, value) {
        return `<div class="hover-preview-meta-item"><strong>${label}:</strong> ${value}</div>`;
    }
};

export default Templates;
