<?php declare(strict_types = 1);

namespace Modules\ZabGPT\Actions;

use CController;
use Exception;

class ZabGPTQuery extends CController {
    private array $proxy_config = [];

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
            $raw = file_get_contents('php://input');
            $payload = json_decode((string) $raw, true) ?: [];

            $question = trim((string) ($payload['question'] ?? ''));
            $provider = trim((string) ($payload['provider'] ?? ''));
            $zabbix_context = $payload['zabbix_context'] ?? [];
            $history = $payload['history'] ?? [];

            if ($question === '') {
                throw new Exception('Question is required.');
            }

            if (!is_array($zabbix_context)) {
                $zabbix_context = [];
            }

            if (!is_array($history)) {
                $history = [];
            }

            $config = $this->loadConfig();
            if (empty($config['providers'])) {
                throw new Exception('No providers configured. Configure at least one provider in ZabGPT settings.');
            }
            $this->proxy_config = is_array($config['proxy'] ?? null) ? $config['proxy'] : [];

            if ($provider === '') {
                $provider = $config['default_provider'] ?? 'gemini';
            }

            if (!isset($config['providers'][$provider])) {
                throw new Exception("Provider '{$provider}' is not configured.");
            }

            $provider_config = $config['providers'][$provider];
            if (empty($provider_config['enabled'])) {
                throw new Exception("Provider '{$provider}' is disabled.");
            }

            $provider_config['api_key'] = $this->resolveApiKey($provider, $provider_config);
            if ($provider !== 'custom' && empty($provider_config['api_key'])) {
                throw new Exception("API key is missing for provider '{$provider}'.");
            }

            $system_prompt = $this->buildSystemPrompt();
            $user_prompt = $this->buildUserPrompt($question, $zabbix_context);

            $response = $this->callProvider($provider, $provider_config, $system_prompt, $user_prompt, $history);

            echo json_encode([
                'success' => true,
                'provider' => $provider,
                'response' => $response,
                'timestamp' => time()
            ], JSON_UNESCAPED_UNICODE);
        }
        catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => $e->getMessage()
            ], JSON_UNESCAPED_UNICODE);
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

    private function resolveApiKey(string $provider, array $provider_config): string {
        $config_key = trim((string) ($provider_config['api_key'] ?? ''));
        if ($config_key !== '') {
            return $config_key;
        }

        $env_map = [
            'openai' => 'ZABGPT_OPENAI_API_KEY',
            'anthropic' => 'ZABGPT_ANTHROPIC_API_KEY',
            'gemini' => 'ZABGPT_GEMINI_API_KEY',
            'custom' => 'ZABGPT_CUSTOM_API_KEY'
        ];

        $env_name = $env_map[$provider] ?? '';
        if ($env_name === '') {
            return '';
        }

        $env_key = getenv($env_name);
        if ($env_key === false) {
            $env_key = $_ENV[$env_name] ?? ($_SERVER[$env_name] ?? '');
        }

        if ((string) $env_key === '') {
            $dotenv = $this->loadDotEnv();
            $env_key = $dotenv[$env_name] ?? '';
        }

        return trim((string) $env_key);
    }

    private function loadDotEnv(): array {
        $env_path = __DIR__ . '/../.env';
        if (!file_exists($env_path) || !is_readable($env_path)) {
            return [];
        }

        $lines = file($env_path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            return [];
        }

        $values = [];
        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || strpos($line, '#') === 0) {
                continue;
            }

            $pos = strpos($line, '=');
            if ($pos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $pos));
            $val = trim(substr($line, $pos + 1));
            $val = trim($val, "\"'");
            if ($key !== '') {
                $values[$key] = $val;
            }
        }

        return $values;
    }

    private function buildSystemPrompt(): string {
        return <<<PROMPT
You are ZabGPT, an expert Zabbix & DevOps AI Copilot integrated inside Zabbix.

## 🎯 **ZABBIX MASTER - Complete Knowledge Base**

You possess deep mastery of:

**Core Zabbix Architecture:**
- Server, Proxy, Agent, Agentless monitoring architecture
- Zabbix database (PostgreSQL, MySQL, Oracle) optimization
- Frontend UI and API concepts
- Distributed monitoring and high-availability setups

**Zabbix 5.0, 6.0, 7.0+ Features:**
- Item types: Zabbix agent, SNMP, JMX, HTTP, database, SSH, external scripts
- Preprocessing: Data transformation, dependent items, and calculated items
- Triggers: Expression language, time functions, forecast functions
- Discoveries: Network discovery, SNMP discovery, dependent discoveries
- Actions: Notification routing, webhook execution, service management
- Service trees and SLA monitoring
- Web scenarios and synthetic monitoring
- Event correlation and event suppression

**Advanced Features:**
- Zabbix API: Authentication, CRUD operations, custom integrations
- Low-Level Discoveries (LLD): Custom prototypes, macro usage
- Custom item preprocessing and transformation
- User macros, global macros, host macros
- Template management and inheritance
- Maintenance windows and host groups
- Custom graphs and dashboards
- Problem lifecycle management

**Troubleshooting & Optimization:**
- Common Zabbix issues: agent connectivity, SNMP walk failures, API auth
- Performance tuning: Database indexes, history cleanup, polling optimization
- Log analysis: Zabbix server, agent, frontend logs
- Nodata detection and item status troubleshooting
- Template migration and bulk operations
- Monitoring plan design and best practices

**Infrastructure Monitoring:**
- Linux/Windows system monitoring (CPU, memory, disk, network)
- Application monitoring: Databases, web servers, middleware
- Container monitoring (Docker, Kubernetes using Zabbix + Prometheus)
- Cloud infrastructure (AWS, Azure, GCP monitoring)
- Active/passive checks and agent auto-registration

**DevOps & Automation:**
- Webhook integration (Slack, PagerDuty, custom APIs)
- Scripted monitoring (Python, Bash, PowerShell item types)
- Terraform/Ansible for Zabbix provisioning
- Git-based template management
- Zabbix native alerting vs. external integration

**Best Practices:**
- Naming conventions for hosts, items, triggers
- Severity level strategy (Not classified through Emergency)
- Alert fatigue reduction and trigger tuning
- Backup and disaster recovery strategies
- Security: RBAC, encryption, API token management
- SLA definition and reporting

**Your Mission:**
1. Answer ANY Zabbix question: installation → configuration → troubleshooting
2. Provide step-by-step guidance with copy-paste-ready commands
3. Relate all answers to Zabbix operational context
4. Explain what metrics mean, why alerts fire, how to fix them
5. Guide users to Zabbix best practices

**Response Format (Detailed Incident Report):**

**Incident summary:**
Plain-English summary of what is wrong right now.

**Alert grouping analysis:**
Group same alerts together. Mention repeated trigger count, affected hosts, and pattern.

**Impact and risk:**
Operational impact, business risk, and urgency.

**Root cause hypotheses:**
Top likely causes in priority order, with reason.

**Action plan (step-by-step):**
Clear numbered steps with commands and Zabbix UI path when needed.

**Verification checklist:**
How to confirm fix worked in Zabbix (items, graphs, trigger state, latest data).

**Prevention and tuning:**
How to avoid repeat incidents (trigger tuning, dependencies, suppression, templates).

**Critical Guidelines:**
- ALWAYS be simple and direct. Avoid over-explaining.
- Use short paragraphs. One idea per line when possible.
- Make ALL answers actionable – include commands or exact steps.
- If user shares Zabbix context (host, trigger, metrics), analyze it deeply.
- If grouped/repeated alerts are provided, explicitly summarize the group and avoid repeating the same advice per host.
- For any Zabbix feature: explain WHAT it is, WHY to use it, HOW to configure it.
- Prioritize operational outcomes over theory.
- Think like a senior administrator with 5+ years Zabbix experience.

**TONE:**
Friendly, confident, helpful. Like a trusted colleague who just knows Zabbix inside-out.

**IMPORTANT:**
You can answer EVERY question related to Zabbix. Installation, setup, configuration, templates, items, triggers, discovery, API, webhooks, performance, troubleshooting, upgrades, backups – you have all the answers. Be thorough and clear every time.
PROMPT;
    }

    private function buildUserPrompt(string $question, array $context): string {
        $host = (string) ($context['host'] ?? 'N/A');
        $trigger = (string) ($context['trigger'] ?? 'N/A');
        $severity = (string) ($context['severity'] ?? 'N/A');

        $last_metrics = $context['last_metrics'] ?? [];
        if (!is_array($last_metrics)) {
            $last_metrics = [];
        }

        $logs = $context['logs'] ?? '';
        if (is_array($logs)) {
            $logs = implode("\n", $logs);
        }
        $logs = trim((string) $logs);

        $metrics_text = $last_metrics ? json_encode($last_metrics, JSON_UNESCAPED_UNICODE) : 'N/A';
        $alert_group_summary = trim((string) ($context['alert_group_summary'] ?? 'N/A'));
        $focus_trigger_group = $context['focus_trigger_group'] ?? null;
        $top_alert_groups = $context['top_alert_groups'] ?? [];

        if (!is_array($focus_trigger_group)) {
            $focus_trigger_group = [];
        }
        if (!is_array($top_alert_groups)) {
            $top_alert_groups = [];
        }

        $focus_group_text = !empty($focus_trigger_group)
            ? json_encode($focus_trigger_group, JSON_UNESCAPED_UNICODE)
            : 'N/A';
        $top_groups_text = !empty($top_alert_groups)
            ? json_encode($top_alert_groups, JSON_UNESCAPED_UNICODE)
            : 'N/A';
        $extra = $context;
        unset($extra['host'], $extra['trigger'], $extra['severity'], $extra['last_metrics'], $extra['logs']);
        $extra_context = !empty($extra)
            ? json_encode($extra, JSON_UNESCAPED_UNICODE)
            : 'N/A';

        return "User Query: {$question}\n\n"
            . "Zabbix Context:\n"
            . "- Host: {$host}\n"
            . "- Trigger: {$trigger}\n"
            . "- Severity: {$severity}\n"
            . "- Last Metrics: {$metrics_text}\n"
            . "- Logs: " . ($logs !== '' ? $logs : 'N/A') . "\n"
                . "- Alert Group Summary: {$alert_group_summary}\n"
                . "- Focus Trigger Group: {$focus_group_text}\n"
                . "- Top Alert Groups: {$top_groups_text}\n"
            . "- Extra Context: {$extra_context}\n\n"
                . "Analyze the issue and respond in the detailed incident report format with grouping analysis.";
    }

    private function callProvider(string $provider, array $config, string $system_prompt, string $user_prompt, array $history): string {
        switch ($provider) {
            case 'openai':
                return $this->callOpenAI($config, $system_prompt, $user_prompt, $history);
            case 'anthropic':
                return $this->callAnthropic($config, $system_prompt, $user_prompt, $history);
            case 'gemini':
                return $this->callGemini($config, $system_prompt, $user_prompt, $history);
            case 'custom':
                return $this->callCustom($config, $system_prompt, $user_prompt, $history);
            default:
                throw new Exception("Unknown provider: {$provider}");
        }
    }

    private function callAnthropic(array $config, string $system_prompt, string $user_prompt, array $history): string {
        $api_key = (string) ($config['api_key'] ?? '');
        $model = trim((string) ($config['model'] ?? 'claude-3-haiku-20240307'));
        $endpoint = trim((string) ($config['endpoint'] ?? 'https://api.anthropic.com/v1/messages'));
        $temperature = (float) ($config['temperature'] ?? 0.7);
        $max_tokens = (int) ($config['max_tokens'] ?? 2048);

        $messages = [];
        foreach (array_slice($history, -8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = (string) ($entry['role'] ?? '');
            $content = trim((string) ($entry['content'] ?? ''));
            if (($role === 'user' || $role === 'assistant') && $content !== '') {
                $messages[] = [
                    'role' => $role,
                    'content' => $content
                ];
            }
        }

        $messages[] = [
            'role' => 'user',
            'content' => $user_prompt
        ];

        $payload = [
            'model' => $model,
            'max_tokens' => $max_tokens,
            'temperature' => $temperature,
            'system' => $system_prompt,
            'messages' => $messages
        ];

        $response = $this->postJson($endpoint, $payload, [
            'Content-Type: application/json',
            'x-api-key: ' . $api_key,
            'anthropic-version: 2023-06-01'
        ]);

        if (isset($response['data']['content'][0]['text'])) {
            return (string) $response['data']['content'][0]['text'];
        }

        throw new Exception('Invalid response from Anthropic API.');
    }

    private function callGemini(array $config, string $system_prompt, string $user_prompt, array $history): string {
        $api_key = (string) ($config['api_key'] ?? '');
        $model = trim((string) ($config['model'] ?? 'gemini-flash-latest'));
        $endpoint_template = trim((string) ($config['endpoint'] ?? 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'));
        $temperature = (float) ($config['temperature'] ?? 0.2);
        $max_tokens = (int) ($config['max_tokens'] ?? 1400);

        if ($endpoint_template === '') {
            throw new Exception('Gemini endpoint is not configured.');
        }

        $endpoint = str_replace('{model}', rawurlencode($model), $endpoint_template);
        if (strpos($endpoint, '{model}') !== false) {
            throw new Exception('Gemini endpoint contains unresolved model placeholder.');
        }

        $context_lines = [
            'System instructions:',
            $system_prompt,
            '',
            'Conversation history (latest first):'
        ];

        foreach (array_slice(array_reverse($history), 0, 8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = (string) ($entry['role'] ?? 'user');
            $content = trim((string) ($entry['content'] ?? ''));
            if ($content !== '') {
                $context_lines[] = strtoupper($role) . ': ' . $content;
            }
        }

        $context_lines[] = '';
        $context_lines[] = 'Current request:';
        $context_lines[] = $user_prompt;

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        [
                            'text' => implode("\n", $context_lines)
                        ]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => $temperature,
                'maxOutputTokens' => $max_tokens
            ]
        ];

        $response = $this->postJson($endpoint, $payload, [
            'Content-Type: application/json',
            'X-goog-api-key: ' . $api_key
        ]);

        if (isset($response['data']['candidates'][0]['content']['parts'])
            && is_array($response['data']['candidates'][0]['content']['parts'])) {
            $parts = $response['data']['candidates'][0]['content']['parts'];
            $text_parts = [];

            foreach ($parts as $part) {
                if (is_array($part) && isset($part['text'])) {
                    $text_parts[] = (string) $part['text'];
                }
            }

            $result_text = trim(implode("\n", $text_parts));
            if ($result_text !== '') {
                return $result_text;
            }
        }

        throw new Exception('Invalid response from Gemini API.');
    }

    private function callOpenAI(array $config, string $system_prompt, string $user_prompt, array $history): string {
        $api_key = $config['api_key'] ?? '';
        $model = $config['model'] ?? 'gpt-4o-mini';
        $endpoint = $config['endpoint'] ?? 'https://api.openai.com/v1/chat/completions';
        $temperature = (float) ($config['temperature'] ?? 0.2);
        $max_tokens = (int) ($config['max_tokens'] ?? 1400);

        $messages = [
            [
                'role' => 'system',
                'content' => $system_prompt
            ]
        ];

        foreach (array_slice($history, -8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = (string) ($entry['role'] ?? '');
            $content = trim((string) ($entry['content'] ?? ''));
            if (($role === 'user' || $role === 'assistant') && $content !== '') {
                $messages[] = [
                    'role' => $role,
                    'content' => $content
                ];
            }
        }

        $messages[] = [
            'role' => 'user',
            'content' => $user_prompt
        ];

        $payload = [
            'model' => $model,
            'max_tokens' => $max_tokens,
            'temperature' => $temperature,
            'messages' => $messages
        ];

        $response = $this->postJson($endpoint, $payload, [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $api_key
        ]);

        if (isset($response['data']['choices'][0]['message']['content'])) {
            return (string) $response['data']['choices'][0]['message']['content'];
        }

        throw new Exception('Invalid response from OpenAI API.');
    }

    private function callCustom(array $config, string $system_prompt, string $user_prompt, array $history): string {
        $endpoint = trim((string) ($config['endpoint'] ?? ''));
        $model = (string) ($config['model'] ?? '');
        $api_key = (string) ($config['api_key'] ?? '');
        $temperature = (float) ($config['temperature'] ?? 0.2);
        $max_tokens = (int) ($config['max_tokens'] ?? 1400);

        if ($endpoint === '') {
            throw new Exception('Custom provider endpoint is not configured.');
        }

        $messages = [
            [
                'role' => 'system',
                'content' => $system_prompt
            ]
        ];

        foreach (array_slice($history, -8) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $role = (string) ($entry['role'] ?? '');
            $content = trim((string) ($entry['content'] ?? ''));
            if (($role === 'user' || $role === 'assistant') && $content !== '') {
                $messages[] = [
                    'role' => $role,
                    'content' => $content
                ];
            }
        }

        $messages[] = [
            'role' => 'user',
            'content' => $user_prompt
        ];

        $headers = ['Content-Type: application/json'];
        if ($api_key !== '') {
            $headers[] = 'Authorization: Bearer ' . $api_key;
        }

        if (!empty($config['headers'])) {
            $custom_headers = json_decode((string) $config['headers'], true);
            if (is_array($custom_headers)) {
                foreach ($custom_headers as $key => $value) {
                    $headers[] = (string) $key . ': ' . (string) $value;
                }
            }
        }

        $payload = [
            'model' => $model,
            'max_tokens' => $max_tokens,
            'temperature' => $temperature,
            'messages' => $messages
        ];

        $response = $this->postJson($endpoint, $payload, $headers);

        if (isset($response['data']['choices'][0]['message']['content'])) {
            return (string) $response['data']['choices'][0]['message']['content'];
        }

        if (isset($response['data']['response'])) {
            return (string) $response['data']['response'];
        }

        if (isset($response['data']['text'])) {
            return (string) $response['data']['text'];
        }

        throw new Exception('Could not parse response from custom provider.');
    }

    private function postJson(string $url, array $payload, array $headers): array {
        $ch = curl_init($url);

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT => 60,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2
        ]);

        $this->applyProxyOptions($ch);

        $resp = curl_exec($ch);
        $http_code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            throw new Exception('HTTP request error: ' . $err);
        }

        if ($http_code >= 400) {
            throw new Exception('HTTP error ' . $http_code . ': ' . (string) $resp);
        }

        return [
            'http_code' => $http_code,
            'data' => json_decode((string) $resp, true)
        ];
    }

    private function applyProxyOptions($ch): void {
        if (empty($this->proxy_config['enabled'])) {
            return;
        }

        $host = trim((string) ($this->proxy_config['host'] ?? ''));
        if ($host === '') {
            return;
        }

        $port = (int) ($this->proxy_config['port'] ?? 3128);
        $type = strtolower(trim((string) ($this->proxy_config['type'] ?? 'http')));
        $username = trim((string) ($this->proxy_config['username'] ?? ''));
        $password = (string) ($this->proxy_config['password'] ?? '');
        $verify_ssl = !empty($this->proxy_config['verify_ssl']);

        curl_setopt($ch, CURLOPT_PROXY, $host . ':' . $port);

        if ($type === 'socks4') {
            curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS4);
        }
        elseif ($type === 'socks5') {
            curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5);
        }
        else {
            curl_setopt($ch, CURLOPT_PROXYTYPE, CURLPROXY_HTTP);
        }

        if ($username !== '') {
            curl_setopt($ch, CURLOPT_PROXYUSERPWD, $username . ':' . $password);
        }

        if ($verify_ssl) {
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        }
    }
}
