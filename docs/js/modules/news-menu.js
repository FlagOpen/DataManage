/**
 * @file News Menu Module
 * @description Fetch and display news YAML content in dropdown
 * @scenario: User clicks NEWS button to toggle news dropdown menu
 */

import ConfigManager from './config.js';
import YamlDropdown from './yaml-dropdown.js';

const NewsMenu = new YamlDropdown({
    overlayId: 'newsDropdownOverlay',
    closeBtnId: 'newsDropdownClose',
    contentId: 'newsContent',
    triggerBtnId: 'newsBtn',
    langToggleBtnId: 'newsLangToggleBtn',
    get dataPath() {
        const config = ConfigManager.getConfig();
        return `${config.paths.assetsRoot}/doc_assets/news/news.yaml`;
    },
    emptyMessage: 'No news available.'
});

export default NewsMenu;
