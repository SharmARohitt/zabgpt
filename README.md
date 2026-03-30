# ZabGPT for Zabbix

ZabGPT is a DevOps copilot module for Zabbix focused on incident diagnosis, root-cause analysis, and actionable remediation guidance.

## What this module does

- Adds a floating ZabGPT button in the Zabbix frontend.
- Opens a slide-in Copilot-like chat panel.
- Injects contextual Zabbix data into every analysis request:
  - Host
  - Trigger
  - Severity
  - Last metrics
  - Logs (when available)
- Forces AI responses into a structured incident-response format:
  1. Summary
  2. Root Cause
  3. Evidence
  4. Impact
  5. Recommended Fix
  6. Prevention Tip
- Provides smart suggestion buttons and command copy actions.
- Supports memory mode (browser-side conversation memory).

## Configuration

Open Administration -> ZabGPT settings:

- Choose default provider.
- Configure OpenAI or Custom API endpoint.
- Set model, temperature, and max tokens.
- Toggle UI options:
  - Floating button
  - Memory mode
  - Auto context capture

Configuration is persisted in:

- modules/ZabGPT/config/zabgpt_config.json

## Environment variables (optional)

If API key fields are empty in settings, backend will use:

- ZABGPT_OPENAI_API_KEY
- ZABGPT_GEMINI_API_KEY
- ZABGPT_CUSTOM_API_KEY

## Folder layout

- manifest.json
- Module.php
- actions/
  - ZabGPTSettings.php
  - ZabGPTSettingsSave.php
  - ZabGPTProviders.php
  - ZabGPTQuery.php
- views/
  - zabgpt.settings.php
- assets/css/
  - zabgpt.css
- assets/js/
  - zabgpt-core.js
  - zabgpt-context.js
  - zabgpt-ui.js
- config/
  - zabgpt_config.json

## Notes

- This implementation is standalone inside the zabgpt folder.
- No files outside zabgpt are required for its internal logic.
