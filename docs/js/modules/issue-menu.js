/**
 * @file Issue Menu Module
 * @description Fetch and display issue YAML content in dropdown
 * @scenario: User clicks ISSUES button to toggle issue dropdown menu
 */

import ConfigManager from './config.js';
import YamlDropdown from './yaml-dropdown.js';

const IssueMenu = new YamlDropdown({
    overlayId: 'issueDropdownOverlay',
    closeBtnId: 'issueDropdownClose',
    contentId: 'issueContent',
    triggerBtnId: 'issuesBtn',
    langToggleBtnId: 'issueLangToggleBtn',
    get dataPath() {
        const config = ConfigManager.getConfig();
        return `${config.paths.assetsRoot}/doc_assets/issue/issues.yaml`;
    },
    emptyMessage: 'No issues available.'
});

export default IssueMenu;
