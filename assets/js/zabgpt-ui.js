(function() {
    'use strict';

    const STORAGE_KEY = 'zabgpt-chat-memory-v1';
    const MAX_MEMORY_ITEMS = 12;

    function waitForDeps(callback) {
        if (window.ZabGPTCore && window.ZabGPTContext) {
            callback();
            return;
        }

        setTimeout(() => waitForDeps(callback), 100);
    }

    function createElement(tag, className, text) {
        const el = document.createElement(tag);
        if (className) {
            el.className = className;
        }
        if (text !== undefined) {
            el.textContent = text;
        }
        return el;
    }

    function formatContextForPrompt(context) {
        return {
            host: context.host || 'N/A',
            trigger: context.trigger || 'N/A',
            severity: context.severity || 'N/A',
            last_metrics: context.last_metrics || {},
            logs: context.logs || ''
        };
    }

    function getSuggestionPrompts(context) {
        return [
            {
                label: 'Analyze Current Problem',
                prompt: 'Analyze the current issue from Zabbix context and provide immediate remediation steps.'
            },
            {
                label: 'Check High CPU',
                prompt: 'Investigate whether high CPU is causing instability and provide command-level diagnostics.'
            },
            {
                label: 'Explain Latest Alert',
                prompt: 'Explain the latest alert in operational terms and propose a prioritized fix plan.'
            },
            {
                label: 'Analyze this problem',
                prompt: 'Run full incident analysis using host, trigger, severity, metrics, and logs from current page context.'
            }
        ].map((item) => {
            if (context && context.host && context.host !== 'N/A') {
                item.prompt += ' Focus on host ' + context.host + '.';
            }
            return item;
        });
    }

    function loadMemory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        }
        catch (e) {
            return [];
        }
    }

    function saveMemory(items) {
        const trimmed = items.slice(-MAX_MEMORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }

    function mount() {
        const core = window.ZabGPTCore;
        const contextUtil = window.ZabGPTContext;

        core.loadSettings().then((settings) => {
            if (!settings.ui || !settings.ui.enable_floating_button) {
                return;
            }

            const root = createElement('div', 'zabgpt-root');
            if (core.readTheme() === 'dark') {
                root.setAttribute('theme', 'dark-theme');
            }

            const floatingButton = createElement('button', 'zabgpt-fab');
            floatingButton.type = 'button';
            floatingButton.innerHTML = '<span class="zabgpt-fab-icon">🤖</span><span class="zabgpt-fab-text">ZabGPT</span>';

            const panel = createElement('section', 'zabgpt-panel');
            panel.setAttribute('aria-hidden', 'true');

            const header = createElement('header', 'zabgpt-panel-header');
            const titleWrap = createElement('div', 'zabgpt-title-wrap');
            const title = createElement('h3', 'zabgpt-panel-title', 'ZabGPT 🤖');
            const providerWrap = createElement('div', 'zabgpt-provider-wrap');
            const providerSelect = core.buildProviderSelect(settings.providers, settings.default_provider);
            providerWrap.appendChild(providerSelect);
            titleWrap.appendChild(title);

            const actionsBar = createElement('div', 'zabgpt-actions-bar');
            const carouselLeft = createElement('button', 'zabgpt-carousel-btn', '‹');
            carouselLeft.type = 'button';
            carouselLeft.title = 'Scroll actions left';
            const actionsTrack = createElement('div', 'zabgpt-actions-track');
            const carouselRight = createElement('button', 'zabgpt-carousel-btn', '›');
            carouselRight.type = 'button';
            carouselRight.title = 'Scroll actions right';

            const newChatBtn = createElement('button', 'zabgpt-action-btn-full', '💬 New Chat');
            newChatBtn.type = 'button';
            newChatBtn.title = 'Start a new conversation';
            const refreshBtn = createElement('button', 'zabgpt-action-btn-full', '🔄 Refresh');
            refreshBtn.type = 'button';
            refreshBtn.title = 'Reload ZabGPT';
            const maximizeBtn = createElement('button', 'zabgpt-action-btn-full', '⬜ Maximize');
            maximizeBtn.type = 'button';
            maximizeBtn.title = 'Expand to full screen';
            const minimizeBtn = createElement('button', 'zabgpt-action-btn-full', '✕ Minimize');
            minimizeBtn.type = 'button';
            minimizeBtn.title = 'Close ZabGPT';

            actionsTrack.appendChild(newChatBtn);
            actionsTrack.appendChild(refreshBtn);
            actionsTrack.appendChild(maximizeBtn);
            actionsTrack.appendChild(minimizeBtn);
            actionsBar.appendChild(carouselLeft);
            actionsBar.appendChild(actionsTrack);
            actionsBar.appendChild(carouselRight);

            header.appendChild(titleWrap);
            header.appendChild(providerWrap);

            const context = settings.ui.auto_context ? contextUtil.collectContext() : {};

            const contextBar = createElement('div', 'zabgpt-context-bar');
            const severity = createElement('span', 'zabgpt-severity ' + contextUtil.severityClass(context.severity || ''), context.severity || 'N/A');
            const host = createElement('span', 'zabgpt-context-host', 'Host: ' + (context.host || 'N/A'));
            const trigger = createElement('span', 'zabgpt-context-trigger', 'Trigger: ' + (context.trigger || 'N/A'));
            contextBar.appendChild(severity);
            contextBar.appendChild(host);
            contextBar.appendChild(trigger);

            const suggestions = createElement('div', 'zabgpt-suggestions');
            getSuggestionPrompts(context).forEach((item) => {
                const btn = createElement('button', 'zabgpt-suggestion-btn', item.label);
                btn.type = 'button';
                btn.addEventListener('click', () => {
                    input.value = item.prompt;
                    input.focus();
                });
                suggestions.appendChild(btn);
            });

            const messages = createElement('div', 'zabgpt-messages');

            const typing = createElement('div', 'zabgpt-typing', 'ZabGPT is thinking...');
            typing.style.display = 'none';

            const composer = createElement('div', 'zabgpt-composer');
            const input = createElement('textarea', 'zabgpt-input');
            input.rows = 3;
            input.placeholder = 'Type your DevOps question...';

            function resizeInput() {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 180) + 'px';
            }

            const actions = createElement('div', 'zabgpt-composer-actions');
            const analyzeBtn = createElement('button', 'zabgpt-send-btn', 'Analyze');
            analyzeBtn.type = 'button';
            const clearBtn = createElement('button', 'zabgpt-clear-btn', 'Clear');
            clearBtn.type = 'button';

            actions.appendChild(clearBtn);
            actions.appendChild(analyzeBtn);

            composer.appendChild(input);
            composer.appendChild(actions);

            panel.appendChild(header);
            panel.appendChild(actionsBar);
            panel.appendChild(contextBar);
            panel.appendChild(suggestions);
            panel.appendChild(messages);
            panel.appendChild(typing);
            panel.appendChild(composer);

            root.appendChild(floatingButton);
            root.appendChild(panel);
            document.body.appendChild(root);

            const memoryEnabled = !!(settings.ui && settings.ui.enable_memory_mode);
            let chatMemory = memoryEnabled ? loadMemory() : [];

            function appendMessage(role, text, renderStructured) {
                const card = createElement('article', 'zabgpt-message ' + (role === 'user' ? 'is-user' : 'is-ai'));
                const badge = createElement('div', 'zabgpt-message-role', role === 'user' ? 'You' : 'ZabGPT');
                const body = createElement('div', 'zabgpt-message-body');

                if (renderStructured) {
                    core.renderAnswer(body, text);
                }
                else {
                    body.textContent = text;
                }

                card.appendChild(badge);
                card.appendChild(body);
                messages.appendChild(card);
                messages.scrollTop = messages.scrollHeight;
            }

            function restoreMemory() {
                if (!memoryEnabled || chatMemory.length === 0) {
                    return;
                }

                chatMemory.forEach((entry) => {
                    appendMessage(entry.role, entry.content, entry.role === 'assistant');
                });
            }

            function pushMemory(role, content) {
                if (!memoryEnabled) {
                    return;
                }

                chatMemory.push({ role: role, content: content });
                saveMemory(chatMemory);
            }

            function resetMemory() {
                chatMemory = [];
                localStorage.removeItem(STORAGE_KEY);
            }

            function togglePanel(show) {
                panel.classList.toggle('is-open', !!show);
                panel.setAttribute('aria-hidden', show ? 'false' : 'true');

                if (!show) {
                    panel.classList.remove('is-expanded');
                    maximizeBtn.textContent = '⬜';
                }
            }

            function toggleExpanded() {
                const expanded = panel.classList.toggle('is-expanded');
                maximizeBtn.textContent = expanded ? '🔽' : '⬜';
            }

            function submitQuery() {
                const question = input.value.trim();
                if (!question) {
                    return;
                }

                appendMessage('user', question, false);
                pushMemory('user', question);

                input.value = '';
                resizeInput();
                typing.style.display = 'block';

                const payload = {
                    provider: providerSelect.value,
                    question: question,
                    zabbix_context: formatContextForPrompt(context),
                    history: chatMemory.slice(-8)
                };

                core.callAI(payload)
                    .then((result) => {
                        const answer = result.response || '';
                        appendMessage('assistant', answer, true);
                        pushMemory('assistant', answer);
                    })
                    .catch((error) => {
                        appendMessage('assistant', 'Error: ' + (error.message || 'Request failed'), false);
                    })
                    .finally(() => {
                        typing.style.display = 'none';
                    });
            }

            floatingButton.addEventListener('click', () => {
                togglePanel(!panel.classList.contains('is-open'));
            });

            minimizeBtn.addEventListener('click', () => {
                togglePanel(false);
            });

            carouselLeft.addEventListener('click', () => {
                actionsTrack.scrollBy({ left: -180, behavior: 'smooth' });
            });

            carouselRight.addEventListener('click', () => {
                actionsTrack.scrollBy({ left: 180, behavior: 'smooth' });
            });

            maximizeBtn.addEventListener('click', () => {
                toggleExpanded();
            });

            newChatBtn.addEventListener('click', () => {
                if (confirm('Start a new chat? Your current chat history will be cleared.')) {
                    messages.innerHTML = '';
                    resetMemory();
                    input.value = '';
                    resizeInput();
                }
            });

            refreshBtn.addEventListener('click', () => {
                if (confirm('Refresh ZabGPT? The panel will reload.')) {
                    location.reload();
                }
            });

            analyzeBtn.addEventListener('click', submitQuery);

            clearBtn.addEventListener('click', () => {
                messages.innerHTML = '';
                resetMemory();
            });

            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submitQuery();
                }
            });

            input.addEventListener('input', resizeInput);

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && panel.classList.contains('is-open')) {
                    togglePanel(false);
                }
            });

            resizeInput();

            restoreMemory();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDeps(mount));
    }
    else {
        waitForDeps(mount);
    }
})();
