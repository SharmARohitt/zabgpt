<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;
use CControllerResponseRedirect;
use CUrl;

class ZabGPTSettingsSave extends CController {
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
        $existing = $this->loadConfig();

        $providers = [
            'openai' => $this->buildProviderConfig('openai', [
                'enabled' => !empty($_POST['openai_enabled']),
                'endpoint' => trim((string) ($_POST['openai_endpoint'] ?? 'https://api.openai.com/v1/chat/completions')),
                'model' => trim((string) ($_POST['openai_model'] ?? 'gpt-4o-mini')),
                'temperature' => $this->toFloat($_POST['openai_temperature'] ?? 0.7, 0.7),
                'max_tokens' => $this->toInt($_POST['openai_max_tokens'] ?? 2048, 2048)
            ], $existing),
            'anthropic' => $this->buildProviderConfig('anthropic', [
                'enabled' => !empty($_POST['anthropic_enabled']),
                'endpoint' => trim((string) ($_POST['anthropic_endpoint'] ?? 'https://api.anthropic.com/v1/messages')),
                'model' => trim((string) ($_POST['anthropic_model'] ?? 'claude-3-haiku-20240307')),
                'temperature' => $this->toFloat($_POST['anthropic_temperature'] ?? 0.7, 0.7),
                'max_tokens' => $this->toInt($_POST['anthropic_max_tokens'] ?? 2048, 2048)
            ], $existing),
            'gemini' => $this->buildProviderConfig('gemini', [
                'enabled' => !empty($_POST['gemini_enabled']),
                'endpoint' => trim((string) ($_POST['gemini_endpoint'] ?? 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent')),
                'model' => trim((string) ($_POST['gemini_model'] ?? 'gemini-flash-latest')),
                'temperature' => $this->toFloat($_POST['gemini_temperature'] ?? 0.7, 0.7),
                'max_tokens' => $this->toInt($_POST['gemini_max_tokens'] ?? 2048, 2048)
            ], $existing),
            'custom' => $this->buildProviderConfig('custom', [
                'enabled' => !empty($_POST['custom_enabled']),
                'endpoint' => trim((string) ($_POST['custom_endpoint'] ?? '')),
                'model' => trim((string) ($_POST['custom_model'] ?? '')),
                'temperature' => $this->toFloat($_POST['custom_temperature'] ?? 0.7, 0.7),
                'max_tokens' => $this->toInt($_POST['custom_max_tokens'] ?? 2048, 2048),
                'headers' => trim((string) ($_POST['custom_headers'] ?? '{}'))
            ], $existing)
        ];

        $config = [
            'proxy' => $this->buildProxyConfig($existing),
            'providers' => $providers,
            'default_provider' => trim((string) ($_POST['default_provider'] ?? 'gemini')),
            'ui' => [
                'enable_floating_button' => !empty($_POST['ui_enable_floating_button']),
                'enable_memory_mode' => !empty($_POST['ui_enable_memory_mode']),
                'auto_context' => !empty($_POST['ui_auto_context'])
            ],
            'updated_at' => date('Y-m-d H:i:s')
        ];

        $ok = $this->saveConfig($config);

        if ($ok) {
            info(_('ZabGPT settings saved successfully.'));
        }
        else {
            error(_('Failed to save ZabGPT settings. Check write permissions.'));
        }

        $this->setResponse(new CControllerResponseRedirect(
            (new CUrl('zabbix.php'))->setArgument('action', 'zabgpt.settings')
        ));
    }

    private function buildProxyConfig(array $existing): array {
        $proxy_password = trim((string) ($_POST['proxy_password'] ?? ''));

        if ($proxy_password === '' || $proxy_password === '********') {
            $proxy_password = (string) ($existing['proxy']['password'] ?? '');
        }

        return [
            'enabled' => !empty($_POST['proxy_enabled']),
            'host' => trim((string) ($_POST['proxy_host'] ?? '')),
            'port' => $this->toInt($_POST['proxy_port'] ?? 3128, 3128),
            'username' => trim((string) ($_POST['proxy_username'] ?? '')),
            'password' => $proxy_password,
            'type' => strtolower(trim((string) ($_POST['proxy_type'] ?? 'http'))),
            'verify_ssl' => !empty($_POST['proxy_verify_ssl'])
        ];
    }

    private function buildProviderConfig(string $provider, array $input, array $existing): array {
        $api_key = trim((string) ($_POST[$provider . '_api_key'] ?? ''));

        if ($api_key === '' || $api_key === '********') {
            $api_key = $existing['providers'][$provider]['api_key'] ?? '';
        }

        $input['api_key'] = $api_key;
        return $input;
    }

    private function loadConfig(): array {
        $config_path = $this->resolveConfigPath();

        if (!file_exists($config_path)) {
            return ['providers' => []];
        }

        $content = file_get_contents($config_path);
        $config = json_decode((string) $content, true);

        return is_array($config) ? $config : ['providers' => []];
    }

    private function saveConfig(array $config): bool {
        $config_path = $this->resolveConfigPath();
        $dir = dirname($config_path);

        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }

        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return @file_put_contents($config_path, $json) !== false;
    }

    private function resolveConfigPath(): string {
        return __DIR__ . '/../config/zabgpt_config.json';
    }

    private function toFloat($value, float $default = 0.0): float {
        if ($value === null || $value === '') {
            return $default;
        }
        return (float) $value;
    }

    private function toInt($value, int $default = 0): int {
        if ($value === null || $value === '') {
            return $default;
        }
        return (int) $value;
    }
}
