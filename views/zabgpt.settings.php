<?php

$config_path = __DIR__ . '/../config/zabgpt_config.json';
$config = file_exists($config_path) ? json_decode((string) file_get_contents($config_path), true) : [];

$providers = $config['providers'] ?? [];
$default_provider = $config['default_provider'] ?? 'gemini';
$ui = array_merge([
    'enable_floating_button' => true,
    'enable_memory_mode' => true,
    'auto_context' => true
], $config['ui'] ?? []);

$openai = $providers['openai'] ?? [];
$gemini = $providers['gemini'] ?? [];
$custom = $providers['custom'] ?? [];

$openai_enabled = !empty($openai['enabled']);
$gemini_enabled = !empty($gemini['enabled']);
$custom_enabled = !empty($custom['enabled']);
$openai_api_key = !empty($openai['api_key']) ? '********' : '';
$gemini_api_key = !empty($gemini['api_key']) ? '********' : '';
$custom_api_key = !empty($custom['api_key']) ? '********' : '';
$width_standard = '520px';
$width_small = '120px';

$page = (new CHtmlPage())
    ->setTitle(_("ZabGPT"))
    ->addItem((new CTag('link', false))
        ->setAttribute('rel', 'stylesheet')
        ->setAttribute('href', 'modules/zabgpt/assets/css/zabgpt.css')
    )
    ->addItem((new CTag('script', false))
        ->setAttribute('type', 'text/javascript')
        ->setAttribute('src', 'modules/zabgpt/assets/js/zabgpt-context.js')
    )
    ->addItem((new CTag('script', false))
        ->setAttribute('type', 'text/javascript')
        ->setAttribute('src', 'modules/zabgpt/assets/js/zabgpt-core.js')
    )
    ->addItem((new CTag('script', false))
        ->setAttribute('type', 'text/javascript')
        ->setAttribute('src', 'modules/zabgpt/assets/js/zabgpt-ui.js')
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
            (new CTextBox('openai_temperature', (string) ($openai['temperature'] ?? 0.2)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'openai_max_tokens'),
        new CFormField(
            (new CTextBox('openai_max_tokens', (string) ($openai['max_tokens'] ?? 1400)))
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
            (new CTextBox('gemini_temperature', (string) ($gemini['temperature'] ?? 0.2)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'gemini_max_tokens'),
        new CFormField(
            (new CTextBox('gemini_max_tokens', (string) ($gemini['max_tokens'] ?? 1400)))
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
            (new CTextBox('custom_temperature', (string) ($custom['temperature'] ?? 0.2)))
                ->setWidth($width_small)
        )
    ])
    ->addItem([
        new CLabel(_('Max tokens'), 'custom_max_tokens'),
        new CFormField(
            (new CTextBox('custom_max_tokens', (string) ($custom['max_tokens'] ?? 1400)))
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

$guidelines = new CDiv([
    new CTag('h4', true, _('ZabGPT response contract')),
    new CSpan(_('1) Summary  2) Root Cause  3) Evidence  4) Impact  5) Recommended Fix  6) Prevention Tip')
]);
$guidelines->addClass('zabgpt-settings-note');

$tabs = (new CTabView())
    ->addTab('general', _('General'), [$general_grid, $guidelines])
    ->addTab('openai', _('OpenAI'), $openai_grid)
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
