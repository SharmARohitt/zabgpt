<?php

$config_path = __DIR__ . '/../config/zabgpt_config.json';
$config = file_exists($config_path) ? json_decode((string) file_get_contents($config_path), true) : [];

$providers = $config['providers'] ?? [];
$default_provider = $config['default_provider'] ?? 'gemini';
$proxy = $config['proxy'] ?? [];
$ui = array_merge([
    'enable_floating_button' => true,
    'enable_memory_mode' => true,
    'auto_context' => true
], $config['ui'] ?? []);

$openai = $providers['openai'] ?? [];
$anthropic = $providers['anthropic'] ?? [];
$gemini = $providers['gemini'] ?? [];
$custom = $providers['custom'] ?? [];

$openai_enabled = !empty($openai['enabled']);
$anthropic_enabled = !empty($anthropic['enabled']);
$gemini_enabled = !empty($gemini['enabled']);
$custom_enabled = !empty($custom['enabled']);

$openai_api_key = !empty($openai['api_key']) ? '********' : '';
$anthropic_api_key = !empty($anthropic['api_key']) ? '********' : '';
$gemini_api_key = !empty($gemini['api_key']) ? '********' : '';
$custom_api_key = !empty($custom['api_key']) ? '********' : '';

$proxy_enabled = !empty($proxy['enabled']);
$proxy_host = (string) ($proxy['host'] ?? '');
$proxy_port = (int) ($proxy['port'] ?? 3128);
$proxy_username = (string) ($proxy['username'] ?? '');
$proxy_password = !empty($proxy['password']) ? '********' : '';
$proxy_type = (string) ($proxy['type'] ?? 'http');
$proxy_verify_ssl = !empty($proxy['verify_ssl']);

$width_standard = defined('ZBX_TEXTAREA_STANDARD_WIDTH') ? ZBX_TEXTAREA_STANDARD_WIDTH : '520px';
$width_small = defined('ZBX_TEXTAREA_SMALL_WIDTH') ? ZBX_TEXTAREA_SMALL_WIDTH : '120px';

$page = (new CHtmlPage())
    ->setTitle(_('ZabGPT'))
    ->addItem((new CTag('link', false))
        ->setAttribute('rel', 'stylesheet')
        ->setAttribute('href', 'modules/zabgpt/assets/css/zabgpt.css')
    );

$form = (new CForm('post', '?action=zabgpt.settings.save'))
    ->setId('zabgpt-settings-form');

$general_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Default provider'), 'default_provider'),
        new CFormField(
            (new CSelect('default_provider'))
                ->setValue($default_provider)
                ->addOptions([
                    new CSelectOption('openai', 'OpenAI'),
                    new CSelectOption('anthropic', 'Anthropic'),
                    new CSelectOption('gemini', 'Gemini'),
                    new CSelectOption('custom', 'Custom')
                ])
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Floating button'), 'ui_enable_floating_button'),
        new CFormField((new CCheckBox('ui_enable_floating_button'))->setLabel(_('Enabled'))->setChecked(!empty($ui['enable_floating_button'])))
    ])
    ->addItem([
        new CLabel(_('Memory mode'), 'ui_enable_memory_mode'),
        new CFormField((new CCheckBox('ui_enable_memory_mode'))->setLabel(_('Enabled'))->setChecked(!empty($ui['enable_memory_mode'])))
    ])
    ->addItem([
        new CLabel(_('Auto context from pages'), 'ui_auto_context'),
        new CFormField((new CCheckBox('ui_auto_context'))->setLabel(_('Enabled'))->setChecked(!empty($ui['auto_context'])))
    ])
    ->addItem([
        new CLabel(_('Config file'), 'zabgpt-config-path'),
        new CFormField((new CSpan($config_path))->addClass('zabgpt-note')->setAttribute('id', 'zabgpt-config-path'))
    ]);

$proxy_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Enable proxy'), 'proxy_enabled'),
        new CFormField((new CCheckBox('proxy_enabled'))->setLabel(_('Enabled'))->setChecked($proxy_enabled))
    ])
    ->addItem([
        new CLabel(_('Proxy host'), 'proxy_host'),
        new CFormField(
            (new CTextBox('proxy_host', $proxy_host))
                ->setWidth($width_standard)
                ->setAttribute('placeholder', 'proxy.example.com or 192.168.1.1')
        )
    ])
    ->addItem([
        new CLabel(_('Proxy port'), 'proxy_port'),
        new CFormField(
            (new CTextBox('proxy_port', (string) $proxy_port))
                ->setWidth($width_small)
                ->setAttribute('placeholder', '3128')
                ->setAttribute('type', 'number')
                ->setAttribute('min', '1')
                ->setAttribute('max', '65535')
        )
    ])
    ->addItem([
        new CLabel(_('Proxy type'), 'proxy_type'),
        new CFormField(
            (new CSelect('proxy_type'))
                ->setValue($proxy_type)
                ->addOptions([
                    new CSelectOption('http', 'HTTP/HTTPS'),
                    new CSelectOption('socks4', 'SOCKS4'),
                    new CSelectOption('socks5', 'SOCKS5')
                ])
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Username (Optional)'), 'proxy_username'),
        new CFormField(
            (new CTextBox('proxy_username', $proxy_username))
                ->setWidth($width_standard)
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Password (Optional)'), 'proxy_password'),
        new CFormField(
            (new CTextBox('proxy_password', $proxy_password))
                ->setWidth($width_standard)
                ->setAttribute('type', 'password')
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Verify SSL certificate'), 'proxy_verify_ssl'),
        new CFormField((new CCheckBox('proxy_verify_ssl'))->setLabel(_('Verify SSL'))->setChecked($proxy_verify_ssl))
    ]);

$openai_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Enable provider'), 'openai_enabled'),
        new CFormField((new CCheckBox('openai_enabled'))->setLabel(_('Enabled'))->setChecked($openai_enabled))
    ])
    ->addItem([
        new CLabel(_('API endpoint'), 'openai_endpoint'),
        new CFormField(
            (new CTextBox('openai_endpoint', $openai['endpoint'] ?? 'https://api.openai.com/v1/chat/completions'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('API key'), 'openai_api_key'),
        new CFormField(
            (new CTextBox('openai_api_key', $openai_api_key))
                ->setWidth($width_standard)
                ->setAttribute('type', 'password')
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Model'), 'openai_model'),
        new CFormField(
            (new CTextBox('openai_model', $openai['model'] ?? 'gpt-4o-mini'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Temperature'), 'openai_temperature'),
        new CFormField(
            (new CTextBox('openai_temperature', (string) ($openai['temperature'] ?? 0.7)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'openai_max_tokens'),
        new CFormField(
            (new CTextBox('openai_max_tokens', (string) ($openai['max_tokens'] ?? 2048)))
                ->setWidth($width_small)
        )
    ]);

$anthropic_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Enable provider'), 'anthropic_enabled'),
        new CFormField((new CCheckBox('anthropic_enabled'))->setLabel(_('Enabled'))->setChecked($anthropic_enabled))
    ])
    ->addItem([
        new CLabel(_('API endpoint'), 'anthropic_endpoint'),
        new CFormField(
            (new CTextBox('anthropic_endpoint', $anthropic['endpoint'] ?? 'https://api.anthropic.com/v1/messages'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('API key'), 'anthropic_api_key'),
        new CFormField(
            (new CTextBox('anthropic_api_key', $anthropic_api_key))
                ->setWidth($width_standard)
                ->setAttribute('type', 'password')
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Model'), 'anthropic_model'),
        new CFormField(
            (new CTextBox('anthropic_model', $anthropic['model'] ?? 'claude-3-haiku-20240307'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Temperature'), 'anthropic_temperature'),
        new CFormField(
            (new CTextBox('anthropic_temperature', (string) ($anthropic['temperature'] ?? 0.7)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'anthropic_max_tokens'),
        new CFormField(
            (new CTextBox('anthropic_max_tokens', (string) ($anthropic['max_tokens'] ?? 2048)))
                ->setWidth($width_small)
        )
    ]);

$gemini_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Enable provider'), 'gemini_enabled'),
        new CFormField((new CCheckBox('gemini_enabled'))->setLabel(_('Enabled'))->setChecked($gemini_enabled))
    ])
    ->addItem([
        new CLabel(_('API endpoint'), 'gemini_endpoint'),
        new CFormField(
            (new CTextBox('gemini_endpoint', $gemini['endpoint'] ?? 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('API key'), 'gemini_api_key'),
        new CFormField(
            (new CTextBox('gemini_api_key', $gemini_api_key))
                ->setWidth($width_standard)
                ->setAttribute('type', 'password')
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Model'), 'gemini_model'),
        new CFormField(
            (new CTextBox('gemini_model', $gemini['model'] ?? 'gemini-flash-latest'))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Temperature'), 'gemini_temperature'),
        new CFormField(
            (new CTextBox('gemini_temperature', (string) ($gemini['temperature'] ?? 0.7)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'gemini_max_tokens'),
        new CFormField(
            (new CTextBox('gemini_max_tokens', (string) ($gemini['max_tokens'] ?? 2048)))
                ->setWidth($width_small)
        )
    ]);

$custom_grid = (new CFormGrid())
    ->addItem([
        new CLabel(_('Enable provider'), 'custom_enabled'),
        new CFormField((new CCheckBox('custom_enabled'))->setLabel(_('Enabled'))->setChecked($custom_enabled))
    ])
    ->addItem([
        new CLabel(_('API endpoint'), 'custom_endpoint'),
        new CFormField(
            (new CTextBox('custom_endpoint', $custom['endpoint'] ?? ''))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('API key'), 'custom_api_key'),
        new CFormField(
            (new CTextBox('custom_api_key', $custom_api_key))
                ->setWidth($width_standard)
                ->setAttribute('type', 'password')
                ->setAttribute('autocomplete', 'off')
        )
    ])
    ->addItem([
        new CLabel(_('Model'), 'custom_model'),
        new CFormField(
            (new CTextBox('custom_model', $custom['model'] ?? ''))
                ->setWidth($width_standard)
        )
    ])
    ->addItem([
        new CLabel(_('Temperature'), 'custom_temperature'),
        new CFormField(
            (new CTextBox('custom_temperature', (string) ($custom['temperature'] ?? 0.7)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'custom_max_tokens'),
        new CFormField(
            (new CTextBox('custom_max_tokens', (string) ($custom['max_tokens'] ?? 2048)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Custom headers (JSON)'), 'custom_headers'),
        new CFormField(
            (new CTextArea('custom_headers', $custom['headers'] ?? '{}'))
                ->setWidth($width_standard)
                ->setRows(4)
        )
    ]);

$tabs = (new CTabView())
    ->addTab('general', _('General'), $general_grid)
    ->addTab('proxy', _('Proxy'), $proxy_grid)
    ->addTab('openai', _('OpenAI'), $openai_grid)
    ->addTab('anthropic', _('Anthropic'), $anthropic_grid)
    ->addTab('gemini', _('Gemini'), $gemini_grid)
    ->addTab('custom', _('Custom'), $custom_grid)
    ->setSelected(0);

$form->addItem($tabs);
$form->addItem(
    (new CFormActions())
        ->addItem((new CSubmit('save', _('Save')))->addClass('btn-primary'))
);

$page->addItem($form);
$page->show();
