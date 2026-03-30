<?php declare(strict_types = 1);

namespace Modules\ZabGPT;

use Zabbix\Core\CModule,
    APP,
    CMenuItem,
    CWebUser;

class Module extends CModule {
    public function init(): void {
        // Add ZabGPT menu item for admin users
        if (CWebUser::getType() >= USER_TYPE_SUPER_ADMIN) {
            $menu_item = (new CMenuItem(_('ZabGPT')))
                ->setAction('zabgpt.settings');

            if (defined('ZBX_ICON_COG_FILLED')) {
                $menu_item->setIcon(constant('ZBX_ICON_COG_FILLED'));
            }

            APP::Component()->get('menu.main')
                ->findOrAdd(_('Administration'))
                ->getSubmenu()
                ->insertAfter(_('Scripts'), $menu_item);
        }
    }
}
