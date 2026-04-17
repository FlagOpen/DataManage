/**
 * @file Hint Menu Module
 * @description Fetch and display hint YAML content in dropdown
 * @scenario: User sees hint popup on page load
 */

import ConfigManager from './config.js';
import YamlDropdown from './yaml-dropdown.js';

const HintMenu = new YamlDropdown({
    overlayId: 'globalBannerOverlay',
    closeBtnId: 'hintDropdownClose',
    contentId: 'hintContent',
    get dataPath() {
        const config = ConfigManager.getConfig();
        return `${config.paths.assetsRoot}/hint/hint.yaml`;
    },
    emptyMessage: 'No hints available.'
});

export default HintMenu;
