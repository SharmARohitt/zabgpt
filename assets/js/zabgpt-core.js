window.ZabGPTCore = (function() {
    'use strict';

    const CONFIG = {
        queryEndpoint: 'zabbix.php?action=zabgpt.query',
        providersEndpoint: 'zabbix.php?action=zabgpt.providers'
    };

    let settingsCache = null;
    let settingsPromise = null;

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value == null ? '' : String(value);
        return div.innerHTML;
    }

    function readTheme() {
        const body = document.body;
        if (body && body.classList.contains('theme-dark')) {
            return 'dark';
        }
        const html = document.documentElement;
        if (html && (html.getAttribute('data-theme') === 'dark-theme' || html.getAttribute('theme') === 'dark-theme')) {
            return 'dark';
        }
        return 'light';
    }

    function loadSettings(force) {
        if (settingsCache && !force) {
            return Promise.resolve(settingsCache);
        }

        if (settingsPromise) {
            return settingsPromise;
        }

        settingsPromise = fetch(CONFIG.providersEndpoint, { credentials: 'same-origin' })
            .then((response) => response.json())
            .then((data) => {
                if (!data || !data.success) {
                    throw new Error(data && data.error ? data.error : 'Failed to load providers');
                }

                settingsCache = {
                    providers: Array.isArray(data.providers) ? data.providers : [],
                    default_provider: data.default_provider || 'gemini',
                    ui: data.ui || {
                        enable_floating_button: true,
                        enable_memory_mode: true,
                        auto_context: true
                    }
                };

                return settingsCache;
            })
            .catch(() => {
                settingsCache = {
                    providers: [],
                    default_provider: 'gemini',
                    ui: {
                        enable_floating_button: true,
                        enable_memory_mode: true,
                        auto_context: true
                    }
                };

                return settingsCache;
            })
            .finally(() => {
                settingsPromise = null;
            });

        return settingsPromise;
    }

    function buildProviderSelect(providers, defaultProvider) {
        const select = document.createElement('select');
        select.className = 'zabgpt-provider-select';

        if (!providers || providers.length === 0) {
            const option = document.createElement('option');
            option.value = defaultProvider || 'gemini';
            option.textContent = defaultProvider || 'gemini';
            select.appendChild(option);
            return select;
        }

        providers.forEach((provider) => {
            const option = document.createElement('option');
            option.value = provider.name;
            option.textContent = provider.model
                ? provider.name + ' - ' + provider.model
                : provider.name;

            if (provider.name === defaultProvider) {
                option.selected = true;
            }

            select.appendChild(option);
        });

        return select;
    }

    function callAI(payload) {
        return fetch(CONFIG.queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            credentials: 'same-origin'
        })
            .then((response) => response.json())
            .then((data) => {
                if (data && data.success) {
                    return data;
                }

                throw new Error((data && data.error) || 'ZabGPT request failed');
            });
    }

    function normalizeForDisplay(text) {
        const lines = String(text || '').split(/\r?\n/);
        const filtered = lines.filter((line) => line.trim() !== '');
        return filtered.join('\n');
    }

    function detectSections(text) {
        const content = normalizeForDisplay(text);
        const labels = [
            'What\'s happening',
            'Why it matters',
            'How to fix it',
            'How to prevent it',
            'Related Zabbix info',
            '🧠 Summary',
            '🔍 Root Cause',
            '📊 Evidence',
            '⚡ Impact',
            '🛠️ Recommended Fix',
            '🚀 Prevention Tip',
            '**What\'s happening:**',
            '**Why it matters:**',
            '**How to fix it:**',
            '**How to prevent it:**',
            '**Related Zabbix info:**'
        ];

        const sections = [];
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            let start = content.indexOf(label + ':');
            if (start === -1) {
                start = content.indexOf(label);
            }

            if (start === -1) {
                continue;
            }

            let end = content.length;
            for (let j = i + 1; j < labels.length; j++) {
                const nextLabel = labels[j];
                let nextIndex = content.indexOf(nextLabel + ':');
                if (nextIndex === -1) {
                    nextIndex = content.indexOf(nextLabel);
                }
                if (nextIndex !== -1 && nextIndex > start) {
                    end = Math.min(end, nextIndex);
                }
            }

            const block = content.slice(start, end).trim();
            if (block) {
                sections.push(block);
            }
        }

        return sections.length > 0 ? sections : [content];
    }

    function addCommandCopyButtons(container) {
        const codeBlocks = container.querySelectorAll('pre code');
        codeBlocks.forEach((codeBlock) => {
            const pre = codeBlock.parentElement;
            const wrapper = document.createElement('div');
            wrapper.className = 'zabgpt-code-wrap';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'zabgpt-copy-btn';
            btn.textContent = 'Copy Command';
            btn.addEventListener('click', () => {
                const text = codeBlock.textContent || '';
                navigator.clipboard.writeText(text).then(() => {
                    const old = btn.textContent;
                    btn.textContent = 'Copied';
                    setTimeout(() => {
                        btn.textContent = old;
                    }, 1200);
                });
            });

            pre.parentNode.insertBefore(wrapper, pre);
            wrapper.appendChild(btn);
            wrapper.appendChild(pre);
        });
    }

    function renderAnswer(htmlContainer, text) {
        const normalized = normalizeForDisplay(text);
        const sections = detectSections(normalized);

        if (sections.length === 0) {
            const fallback = document.createElement('div');
            fallback.className = 'zabgpt-raw-answer';
            fallback.textContent = normalized;
            htmlContainer.appendChild(fallback);
            return;
        }

        sections.forEach((block) => {
            const card = document.createElement('article');
            card.className = 'zabgpt-section-card';

            const lines = block.split(/\r?\n/);
            const titleLine = lines.shift() || '';
            const bodyText = lines.join('\n').trim();

            const title = document.createElement('h4');
            title.className = 'zabgpt-section-title';
            let cleanTitle = titleLine
                .replace(/\*\*/g, '')
                .replace(/^#+/, '')
                .replace(/:\s*$/, '')
                .trim();
            if (!cleanTitle) {
                cleanTitle = titleLine.trim();
            }
            title.textContent = cleanTitle;

            const body = document.createElement('div');
            body.className = 'zabgpt-section-body';
            
            // Parse markdown-like formatting
            let htmlBody = escapeHtml(bodyText);
            // Convert `code` to <code> tags
            htmlBody = htmlBody.replace(/`([^`]+)`/g, '<code>$1</code>');
            // Convert **bold** to <strong> tags
            htmlBody = htmlBody.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            // Preserve line breaks
            htmlBody = htmlBody.replace(/\n/g, '<br>');
            
            body.innerHTML = htmlBody;

            card.appendChild(title);
            card.appendChild(body);
            htmlContainer.appendChild(card);
        });

        const cmdPatterns = [
            /`((?:sudo\s+)?(?:zabbix|mysql|postgresql|systemctl|journalctl|curl|wget|apt|yum|docker|kubectl)[\s\S]*?)`/gi,
            /(^|\n|\s)(\$\s+(?:sudo\s+)?[\w\-\.\/]+.*?)(\n|$)/gmi,
            /(^|\n)(\s*(?:sudo\s+)?(?:kubectl|docker|systemctl|journalctl|top|htop|cat|tail|grep|awk|sed|ip|ss|netstat|free|df|zabbix_get|zabbix_sender)\b[^\n]*)/gim
        ];

        const foundCommands = [];
        cmdPatterns.forEach(pattern => {
            const matches = normalized.match(pattern);
            if (matches) {
                foundCommands.push(...matches);
            }
        });

        if (foundCommands.length > 0) {
            const cmdWrap = document.createElement('div');
            cmdWrap.className = 'zabgpt-command-list';

            const seen = new Set();
            foundCommands.slice(0, 8).forEach((raw) => {
                let command = raw.replace(/^\n|\n$/, '').replace(/^`/, '').replace(/`$/, '').trim();
                if (!command || seen.has(command)) {
                    return;
                }
                seen.add(command);

                const row = document.createElement('div');
                row.className = 'zabgpt-command-row';

                const code = document.createElement('code');
                code.textContent = command;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'zabgpt-copy-btn';
                btn.textContent = 'Copy';
                btn.addEventListener('click', () => {
                    navigator.clipboard.writeText(command).then(() => {
                        const old = btn.textContent;
                        btn.textContent = 'Copied!';
                        setTimeout(() => {
                            btn.textContent = old;
                        }, 1200);
                    });
                });

                row.appendChild(code);
                row.appendChild(btn);
                cmdWrap.appendChild(row);
            });

            if (cmdWrap.children.length > 0) {
                htmlContainer.appendChild(cmdWrap);
            }
        }

        addCommandCopyButtons(htmlContainer);
    }

    return {
        CONFIG,
        escapeHtml,
        readTheme,
        loadSettings,
        buildProviderSelect,
        callAI,
        renderAnswer
    };
})();
