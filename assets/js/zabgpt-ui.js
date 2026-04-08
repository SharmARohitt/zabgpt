(function() {
    'use strict';

    const STORAGE_KEY = 'zabgpt-chat-memory-v1';
    const VOICE_ENABLED_KEY = 'zabgpt_voice_enabled';
    const MAX_MEMORY_ITEMS = 12;

    function isVoiceEnabled() {
        return localStorage.getItem(VOICE_ENABLED_KEY) === 'true';
    }

    function setVoiceEnabled(enabled) {
        localStorage.setItem(VOICE_ENABLED_KEY, enabled ? 'true' : 'false');
    }

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
            logs: context.logs || '',
            alert_group_summary: context.alert_group_summary || '',
            focus_trigger_group: context.focus_trigger_group || null,
            top_alert_groups: context.top_alert_groups || [],
            repeated_alert_groups: context.repeated_alert_groups || [],
            grouped_alert_count: context.grouped_alert_count || 0,
            total_open_alert_rows: context.total_open_alert_rows || 0
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
            if (context.grouped_alert_count && context.grouped_alert_count > 1) {
                const grouped = createElement('span', 'zabgpt-context-grouped', 'Grouped: ' + context.grouped_alert_count);
                contextBar.appendChild(grouped);
            }

            const voiceDock = createElement('div', 'zabgpt-ops-voice-dock');
            const voiceToggleBtn = createElement('button', 'zabgpt-ops-voice-btn is-toggle', '🔊 Voice On');
            voiceToggleBtn.type = 'button';
            const talkBtn = createElement('button', 'zabgpt-ops-voice-btn is-talk', '🎤 Talk to ZabGPT');
            talkBtn.type = 'button';
            const statusSpeakBtn = createElement('button', 'zabgpt-ops-voice-btn is-status', '🔊 Speak Status');
            statusSpeakBtn.type = 'button';
            const voiceHint = createElement('span', 'zabgpt-ops-voice-hint', 'Voice ready');

            voiceDock.appendChild(voiceToggleBtn);
            voiceDock.appendChild(talkBtn);
            voiceDock.appendChild(statusSpeakBtn);
            voiceDock.appendChild(voiceHint);
            contextBar.appendChild(voiceDock);

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
            let answerCounter = 0;
            const proactiveEngine = {
                idleThresholdMs: 60000,
                cooldownMs: 90000,
                pollMs: 15000,
                lastActivityTime: Date.now(),
                lastSpokenAt: 0,
                lastSummaryHash: '',
                timer: null,
                repeatedAnomalyCount: 0,
                isRunning: false
            };

            const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition || null;
            let recognition = null;
            let recognitionBusy = false;
            let restartingRecognition = false;
            let micPermissionChecked = false;

            function explainSpeechError(errorCode) {
                switch (String(errorCode || '')) {
                    case 'not-allowed':
                    case 'service-not-allowed':
                        return 'Microphone permission denied. Allow mic access in browser settings.';
                    case 'audio-capture':
                        return 'No microphone detected. Check your input device.';
                    case 'network':
                        return 'Speech service network error. Try again.';
                    case 'no-speech':
                        return 'No speech detected. Try speaking closer to the mic.';
                    case 'aborted':
                        return 'Listening stopped.';
                    default:
                        return 'Speech recognition failed.';
                }
            }

            async function ensureMicrophonePermission() {
                if (micPermissionChecked) {
                    return true;
                }

                if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                    return true;
                }

                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach((track) => track.stop());
                    micPermissionChecked = true;
                    return true;
                }
                catch (error) {
                    voiceHint.textContent = 'Microphone access blocked. Please allow microphone permission.';
                    return false;
                }
            }

            function updateVoiceToggleUi() {
                const enabled = isVoiceEnabled();
                voiceToggleBtn.textContent = enabled ? '🔊 Voice On' : '🔇 Voice Off';
                voiceToggleBtn.classList.toggle('is-muted', !enabled);
            }

            function syncCardVoiceToggles(enabled) {
                const toggles = document.querySelectorAll('.zabgpt-voice-toggle input[type="checkbox"]');
                toggles.forEach((inputEl) => {
                    inputEl.checked = !!enabled;
                });
            }

            function setVoiceMode(enabled) {
                setVoiceEnabled(enabled);
                updateVoiceToggleUi();
                syncCardVoiceToggles(enabled);

                if (!enabled) {
                    if (window.ZabGPTVoice && typeof window.ZabGPTVoice.stop === 'function') {
                        window.ZabGPTVoice.stop();
                    }

                    voiceHint.textContent = 'Voice output is off';
                    return;
                }

                voiceHint.textContent = 'Voice ready';
            }

            function hasVoiceApi() {
                return !!(window.ZabGPTVoice && typeof window.ZabGPTVoice.speakText === 'function');
            }

            async function speakViaVoiceApi(text, options) {
                if (!isVoiceEnabled()) {
                    voiceHint.textContent = 'Voice is off';
                    return false;
                }

                if (!hasVoiceApi()) {
                    voiceHint.textContent = 'Speech not supported in this browser';
                    return false;
                }

                try {
                    await window.ZabGPTVoice.speakText(text, options || { rate: 0.97 });
                    return true;
                }
                catch (error) {
                    voiceHint.textContent = (error && error.message) ? error.message : 'Voice playback failed';
                    return false;
                }
            }

            function normalizeMetricValue(value) {
                const text = String(value || '').trim();
                const match = text.match(/(\d+(?:\.\d+)?)/);
                return match ? Number(match[1]) : null;
            }

            function generateSystemSummary(sourceContext) {
                const ctx = sourceContext || {};
                const metrics = ctx.last_metrics || {};
                const cpuVal = normalizeMetricValue(metrics.cpu);
                const memoryVal = normalizeMetricValue(metrics.memory);
                const diskVal = normalizeMetricValue(metrics.disk);
                const severityRaw = String(ctx.severity || 'N/A');
                const severity = severityRaw.toLowerCase();
                const repeated = Array.isArray(ctx.repeated_alert_groups) ? ctx.repeated_alert_groups.length : 0;

                const parts = [];

                if (severity.indexOf('critical') !== -1 || severity.indexOf('disaster') !== -1 || severity.indexOf('high') !== -1) {
                    parts.push('Current system health needs attention. Severity is ' + severityRaw + '.');
                }
                else {
                    parts.push('System is mostly stable right now.');
                }

                if (Number.isFinite(cpuVal)) {
                    parts.push('CPU is at ' + cpuVal + ' percent.');
                }
                else {
                    parts.push('CPU data is not available.');
                }

                if (Number.isFinite(memoryVal)) {
                    parts.push('Memory is at ' + memoryVal + ' percent.');
                }

                if (Number.isFinite(diskVal)) {
                    if (diskVal >= 85) {
                        parts.push('Disk usage is rising at ' + diskVal + ' percent and should be reviewed.');
                    }
                    else {
                        parts.push('Disk usage is at ' + diskVal + ' percent.');
                    }
                }

                if (repeated > 0) {
                    parts.push('There are repeated anomaly patterns across ' + repeated + ' alert groups.');
                }
                else {
                    parts.push('No repeated anomaly pattern is currently detected.');
                }

                if ((ctx.host || 'N/A') === 'N/A' || (ctx.trigger || 'N/A') === 'N/A') {
                    parts.push('Host or trigger context is not set, but monitoring remains active.');
                }

                return parts.join(' ');
            }

            function shouldSpeakProactive(ctx) {
                if (!isVoiceEnabled()) {
                    return false;
                }

                const now = Date.now();
                if (proactiveEngine.isRunning) {
                    return false;
                }
                if (now - proactiveEngine.lastSpokenAt < proactiveEngine.cooldownMs) {
                    return false;
                }

                const severityRaw = String((ctx && ctx.severity) || '').toLowerCase();
                const isHighSeverity = severityRaw.indexOf('high') !== -1
                    || severityRaw.indexOf('critical') !== -1
                    || severityRaw.indexOf('disaster') !== -1;

                const repeated = Array.isArray(ctx && ctx.repeated_alert_groups) ? ctx.repeated_alert_groups.length : 0;
                const hasPattern = repeated > 0 || proactiveEngine.repeatedAnomalyCount >= 2;
                const userIdle = now - proactiveEngine.lastActivityTime > proactiveEngine.idleThresholdMs;

                return isHighSeverity || hasPattern || userIdle;
            }

            async function runProactiveTick() {
                const latestContext = settings.ui.auto_context ? contextUtil.collectContext() : context;

                if (!shouldSpeakProactive(latestContext)) {
                    return;
                }

                const userIdle = Date.now() - proactiveEngine.lastActivityTime > proactiveEngine.idleThresholdMs;
                const intro = userIdle
                    ? 'No active user detected. '
                    : 'Proactive system insight. ';
                const summary = intro + generateSystemSummary(latestContext);
                const summaryHash = String(summary).toLowerCase().replace(/\s+/g, ' ').trim();

                if (summaryHash === proactiveEngine.lastSummaryHash && (Date.now() - proactiveEngine.lastSpokenAt) < proactiveEngine.cooldownMs * 2) {
                    return;
                }

                proactiveEngine.isRunning = true;
                voiceHint.textContent = 'Proactive voice update';
                const ok = await speakViaVoiceApi(summary, { rate: 0.96 });
                proactiveEngine.isRunning = false;

                if (ok) {
                    proactiveEngine.lastSpokenAt = Date.now();
                    proactiveEngine.lastSummaryHash = summaryHash;
                    voiceHint.textContent = 'Voice update delivered';
                }
            }

            function touchActivity() {
                proactiveEngine.lastActivityTime = Date.now();
            }

            function initActivityTracking() {
                ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
                    document.addEventListener(eventName, touchActivity, { passive: true });
                });
            }

            function startProactiveEngine() {
                if (proactiveEngine.timer) {
                    clearInterval(proactiveEngine.timer);
                }
                proactiveEngine.timer = setInterval(() => {
                    runProactiveTick();
                }, proactiveEngine.pollMs);
            }

            function initRecognition() {
                if (!SpeechRecognitionCtor) {
                    return null;
                }

                const sr = new SpeechRecognitionCtor();
                sr.lang = 'en-US';
                sr.interimResults = false;
                sr.maxAlternatives = 1;

                sr.onstart = () => {
                    recognitionBusy = true;
                    talkBtn.textContent = '⏹ Stop Listening';
                    voiceHint.textContent = isVoiceEnabled() ? 'Listening...' : 'Listening... (voice output muted)';
                };

                sr.onresult = (event) => {
                    const transcript = event && event.results && event.results[0] && event.results[0][0]
                        ? String(event.results[0][0].transcript || '').trim()
                        : '';

                    if (!transcript) {
                        voiceHint.textContent = 'No speech captured';
                        return;
                    }

                    voiceHint.textContent = 'You said: ' + transcript;
                    submitQuery(transcript, { speakResponse: true });
                };

                sr.onerror = (event) => {
                    const code = event && event.error ? event.error : '';
                    voiceHint.textContent = explainSpeechError(code);

                    if (code === 'no-speech' && recognitionBusy && !restartingRecognition) {
                        restartingRecognition = true;
                        setTimeout(() => {
                            restartingRecognition = false;
                            try {
                                sr.start();
                            }
                            catch (error) {
                                recognitionBusy = false;
                                talkBtn.textContent = '🎤 Talk to ZabGPT';
                            }
                        }, 250);
                    }
                };

                sr.onend = () => {
                    if (!restartingRecognition) {
                        recognitionBusy = false;
                        talkBtn.textContent = '🎤 Talk to ZabGPT';
                    }
                };

                return sr;
            }

            function nextAnswerId() {
                answerCounter += 1;
                return 'zabgpt-answer-' + Date.now() + '-' + answerCounter;
            }

            function appendMessage(role, text, renderStructured, emitAnswerEvent) {
                const card = createElement('article', 'zabgpt-message ' + (role === 'user' ? 'is-user' : 'is-ai'));
                const badge = createElement('div', 'zabgpt-message-role', role === 'user' ? 'You' : 'ZabGPT');
                const body = createElement('div', 'zabgpt-message-body');
                const shouldEmit = emitAnswerEvent !== false;
                let answerId = '';

                if (role === 'assistant') {
                    answerId = nextAnswerId();
                    card.setAttribute('data-answer-id', answerId);
                    card.__zabgptRawAnswer = text;
                    card.setAttribute('data-answer-raw', text);
                }

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

                if (role === 'assistant' && shouldEmit) {
                    document.dispatchEvent(new CustomEvent('zabgpt:answer-rendered', {
                        detail: {
                            answer_id: answerId,
                            text: text,
                            card: card,
                            body: body
                        }
                    }));
                }
            }

            function restoreMemory() {
                if (!memoryEnabled || chatMemory.length === 0) {
                    return;
                }

                chatMemory.forEach((entry) => {
                    appendMessage(entry.role, entry.content, entry.role === 'assistant', false);
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

            function submitQuery(overrideQuestion, options) {
                const settingsArg = options || {};
                const question = String(overrideQuestion || input.value || '').trim();
                if (!question) {
                    return;
                }

                appendMessage('user', question, false, false);
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
                        appendMessage('assistant', answer, true, true);
                        pushMemory('assistant', answer);
                        if (settingsArg.speakResponse) {
                            voiceHint.textContent = 'Speaking response';
                            speakViaVoiceApi(answer, { rate: 0.97 }).then((ok) => {
                                if (ok) {
                                    voiceHint.textContent = 'Response spoken';
                                }
                            });
                        }

                        const answerLower = String(answer || '').toLowerCase();
                        if (answerLower.indexOf('repeated') !== -1 || answerLower.indexOf('anomaly') !== -1) {
                            proactiveEngine.repeatedAnomalyCount += 1;
                        }
                    })
                    .catch((error) => {
                        appendMessage('assistant', 'Error: ' + (error.message || 'Request failed'), false, false);
                    })
                    .finally(() => {
                        typing.style.display = 'none';
                    });
            }

            floatingButton.addEventListener('click', () => {
                togglePanel(!panel.classList.contains('is-open'));
            });

            talkBtn.addEventListener('click', async () => {
                if (recognitionBusy) {
                    if (recognition) {
                        recognition.stop();
                    }
                    recognitionBusy = false;
                    talkBtn.textContent = '🎤 Talk to ZabGPT';
                    voiceHint.textContent = 'Listening stopped';
                    return;
                }

                if (!SpeechRecognitionCtor) {
                    voiceHint.textContent = 'Speech recognition not supported in this browser';
                    return;
                }

                if (window.isSecureContext === false) {
                    voiceHint.textContent = 'Speech recognition needs HTTPS or localhost.';
                    return;
                }

                const hasMicAccess = await ensureMicrophonePermission();
                if (!hasMicAccess) {
                    return;
                }

                recognition = recognition || initRecognition();
                if (!recognition) {
                    voiceHint.textContent = 'Speech recognition not supported';
                    return;
                }

                try {
                    recognition.start();
                }
                catch (error) {
                    voiceHint.textContent = 'Unable to start listening. Try again.';
                }
            });

            statusSpeakBtn.addEventListener('click', () => {
                if (!isVoiceEnabled()) {
                    voiceHint.textContent = 'Voice is off. Turn it on first';
                    return;
                }

                const latestContext = settings.ui.auto_context ? contextUtil.collectContext() : context;
                const summary = generateSystemSummary(latestContext);
                voiceHint.textContent = 'Speaking system status';
                speakViaVoiceApi(summary, { rate: 0.96 }).then((ok) => {
                    if (ok) {
                        proactiveEngine.lastSpokenAt = Date.now();
                        proactiveEngine.lastSummaryHash = summary.toLowerCase().replace(/\s+/g, ' ').trim();
                        voiceHint.textContent = 'Status delivered';
                    }
                });
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

            voiceToggleBtn.addEventListener('click', () => {
                setVoiceMode(!isVoiceEnabled());
            });

            resizeInput();
            updateVoiceToggleUi();
            syncCardVoiceToggles(isVoiceEnabled());
            if (!isVoiceEnabled()) {
                voiceHint.textContent = 'Voice is off';
            }

            restoreMemory();
            initActivityTracking();
            startProactiveEngine();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => waitForDeps(mount));
    }
    else {
        waitForDeps(mount);
    }
})();
