<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;
use CControllerResponseData;

class ZabGPTSettings extends CController {
    public function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        return true;
    }

    public function checkPermissions(): bool {
        return $this->getUserType() >= USER_TYPE_SUPER_ADMIN;
    }

    protected function doAction(): void {
        $this->setResponse(new CControllerResponseData([]));
    }
}
