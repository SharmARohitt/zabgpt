<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;

class ZabGPTProviders extends CController {
    public function init(): void {
        $this->disableCsrfValidation();
    }

    protected function checkInput(): bool {
        return true;
    }

    public function checkPermissions(): bool {
        return $this->getUserType() >= USER_TYPE_ZABBIX_USER;
    }

    protected function doAction(): void {
        header('Content-Type: application/json; charset=utf-8');

        try {
            $config = $this->loadConfig();

            $providers = [];
            foreach ($config['providers'] ?? [] as $name => $provider) {
                if (!empty($provider['enabled'])) {
                    $providers[] = [
                        'name' => $name,
                        'model' => $provider['model'] ?? '',
                        'endpoint' => $provider['endpoint'] ?? '',
                        'has_api_key' => !empty($provider['api_key'])
                    ];
                }
            }

            echo json_encode([
                'success' => true,
                'providers' => $providers,
                'default_provider' => $config['default_provider'] ?? 'gemini',
                'proxy' => $config['proxy'] ?? [],
                'ui' => $this->resolveUIConfig($config['ui'] ?? []),
                'is_super_admin' => $this->getUserType() == USER_TYPE_SUPER_ADMIN
            ], JSON_UNESCAPED_UNICODE);
        }
        catch (\Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ]);
        }

        exit;
    }

    private function loadConfig(): array {
        $config_path = __DIR__ . '/../config/zabgpt_config.json';

        if (!file_exists($config_path)) {
            return ['providers' => []];
        }

        $content = file_get_contents($config_path);
        $config = json_decode((string) $content, true);

        return is_array($config) ? $config : ['providers' => []];
    }

    private function resolveUIConfig(array $ui): array {
        $defaults = [
            'enable_floating_button' => true,
            'enable_memory_mode' => true,
            'auto_context' => true
        ];

        return array_merge($defaults, $ui);
    }
}
