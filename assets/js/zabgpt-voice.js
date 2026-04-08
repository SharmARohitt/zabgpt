(function() {
    'use strict';

    const STORAGE_KEY = 'zabgpt_voice_enabled';
    const LANGUAGE_KEY = 'zabgpt_voice_language';
    const MAX_VOICE_CHARS = 1100;
    const MAX_CHUNK_CHARS = 260;
    const TRANSLATE_ENDPOINT = 'zabbix.php?action=voiceai.translate';

    let currentUtterance = null;
    let currentCard = null;
    let currentAnswerId = null;
    let answerIdCounter = 0;

    const playTokens = new Map();
    const lastPlayAt = new Map();
    const voiceSafeCache = new Map();
    const translatedCache = new Map();

    function isVoiceEnabled() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function setVoiceEnabled(enabled) {
        localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    }

    function getVoiceLanguage() {
        const value = localStorage.getItem(LANGUAGE_KEY);
        return value === 'hi' ? 'hi' : 'en';
    }

    function setVoiceLanguage(language) {
        localStorage.setItem(LANGUAGE_KEY, language === 'hi' ? 'hi' : 'en');
    }

    function createAnswerId() {
        answerIdCounter += 1;
        return 'zabgpt-answer-' + Date.now() + '-' + answerIdCounter;
    }

    function decodeRawAnswer(card) {
        if (card && typeof card.__zabgptRawAnswer === 'string' && card.__zabgptRawAnswer.trim()) {
            return card.__zabgptRawAnswer;
        }

        if (!card) {
            return '';
        }

        const rawAttr = card.getAttribute('data-answer-raw');
        if (rawAttr) {
            return rawAttr;
        }

        const body = card.querySelector('.zabgpt-message-body');
        return body ? (body.innerText || body.textContent || '') : '';
    }

    function splitIntoChunks(text, maxChars) {
        const normalized = String(text || '').trim();
        if (!normalized) {
            return [];
        }

        const sentences = normalized.split(/(?<=[.!?])\s+/);
        const chunks = [];
        let current = '';

        function pushCurrent() {
            const value = current.trim();
            if (value) {
                chunks.push(value);
            }
            current = '';
        }

        sentences.forEach(function(sentence) {
            if (!sentence) {
                return;
            }

            if (sentence.length > maxChars) {
                pushCurrent();
                for (let i = 0; i < sentence.length; i += maxChars) {
                    const piece = sentence.slice(i, i + maxChars).trim();
                    if (piece) {
                        chunks.push(piece);
                    }
                }
                return;
            }

            const candidate = (current ? current + ' ' : '') + sentence;
            if (candidate.length > maxChars) {
                pushCurrent();
                current = sentence;
            }
            else {
                current = candidate;
            }
        });

        pushCurrent();
        return chunks;
    }

    function summarizeForVoice(text, maxChars) {
        const input = String(text || '').trim();
        if (!input) {
            return '';
        }

        if (input.length <= maxChars) {
            return input;
        }

        const sentences = input.split(/(?<=[.!?])\s+/).filter(Boolean);
        const chosen = [];
        let total = 0;

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const nextSize = total + sentence.length + (chosen.length ? 1 : 0);
            if (nextSize > maxChars) {
                break;
            }
            chosen.push(sentence);
            total = nextSize;
        }

        if (chosen.length === 0) {
            return input.slice(0, maxChars).trim();
        }

        return chosen.join(' ').trim();
    }

    function cleanRepeatedWords(text) {
        return text.replace(/\b(\w+)(\s+\1\b)+/gi, '$1');
    }

    function getVoiceSafeText(rawText) {
        const source = String(rawText || '');
        if (!source.trim()) {
            return '';
        }

        if (voiceSafeCache.has(source)) {
            return voiceSafeCache.get(source);
        }

        let clean = source;

        // Remove fenced code and inline commands/code first.
        clean = clean.replace(/```[\s\S]*?```/g, ' ');
        clean = clean.replace(/`[^`]*`/g, ' ');

        // Remove markdown headings/bullets/emphasis markers.
        clean = clean.replace(/^\s{0,3}#{1,6}\s*/gm, '');
        clean = clean.replace(/^\s*[*+-]\s+/gm, '• ');
        clean = clean.replace(/[*_~>#]/g, ' ');

        // Replace bullet glyph with a natural pause marker.
        clean = clean.replace(/\s*•\s*/g, '. ');

        // Remove path-like and command-like lines.
        clean = clean.replace(/(^|\n)\s*(?:top|ps|iostat|vmstat|htop|netstat|kubectl|docker|systemctl|journalctl|cat|tail|grep|awk|sed)\b[^\n]*/gim, ' ');
        clean = clean.replace(/\b(?:top|ps|iostat|vmstat|htop|netstat|kubectl|docker|systemctl|journalctl|cat|tail|grep|awk|sed)\b(?:\s+[-\w\/.=:]+){0,12}/gim, ' ');
        clean = clean.replace(/[A-Za-z]:\\[^\s]+|(?:\/[^\s]+){2,}/g, ' ');

        // Make colon headings natural for speech.
        clean = clean.replace(/\s*:\s*/g, '. ');
        clean = clean.replace(/[|{}\[\]<>$]+/g, ' ');

        clean = clean.replace(/\s+/g, ' ').trim();
        clean = cleanRepeatedWords(clean);
        clean = summarizeForVoice(clean, MAX_VOICE_CHARS);

        voiceSafeCache.set(source, clean);
        if (voiceSafeCache.size > 5) {
            const oldest = voiceSafeCache.keys().next().value;
            voiceSafeCache.delete(oldest);
        }

        return clean;
    }

    function findFemaleVoice(voices, language) {
        const list = Array.isArray(voices) ? voices : [];
        if (!list.length) {
            return null;
        }

        const langPrefix = language === 'hi' ? 'hi' : 'en';
        const langFiltered = list.filter(function(v) {
            const voiceLang = String(v.lang || '').toLowerCase();
            return voiceLang.indexOf(langPrefix) === 0;
        });
        const searchList = langFiltered.length ? langFiltered : list;

        const exactMatches = [
            /google uk english female/i,
            /microsoft zira/i,
            /google hindi/i,
            /swara/i,
            /heera/i
        ];

        for (let i = 0; i < exactMatches.length; i++) {
            const hit = searchList.find(function(v) {
                return exactMatches[i].test(v.name || '');
            });
            if (hit) {
                return hit;
            }
        }

        const femaleHint = searchList.find(function(v) {
            const name = (v.name || '').toLowerCase();
            return name.includes('female') || name.includes('zira') || name.includes('susan') || name.includes('sara') || name.includes('aria') || name.includes('jenny');
        });

        if (femaleHint) {
            return femaleHint;
        }

        return searchList[0] || list[0] || null;
    }

    function setState(card, state, label) {
        card.setAttribute('data-voice-state', state);

        const status = card.querySelector('.zabgpt-voice-status');
        const play = card.querySelector('.zabgpt-voice-play-btn');

        if (status) {
            status.textContent = label || state;
        }

        if (play) {
            play.disabled = state === 'loading';
        }
    }

    function stopPlayback(markIdle) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        if (currentAnswerId) {
            playTokens.delete(currentAnswerId);
        }

        if (markIdle && currentCard) {
            setState(currentCard, 'idle', 'Ready');
        }

        currentUtterance = null;
        currentCard = null;
        currentAnswerId = null;
    }

    function debouncePlay(answerId) {
        const now = Date.now();
        const previous = lastPlayAt.get(answerId) || 0;
        if (now - previous < 220) {
            return false;
        }

        lastPlayAt.set(answerId, now);
        return true;
    }

    function speakChunk(chunk, speed, language) {
        return new Promise(function(resolve, reject) {
            if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
                reject(new Error('Speech not supported'));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(chunk);
            const selected = findFemaleVoice(window.speechSynthesis.getVoices(), language);

            if (selected) {
                utterance.voice = selected;
                utterance.lang = selected.lang || (language === 'hi' ? 'hi-IN' : 'en-US');
            }
            else {
                utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
            }

            utterance.rate = Math.max(0.7, Math.min(1.4, Number(speed) || 1.0));
            utterance.pitch = 1;
            utterance.volume = 1;

            utterance.onend = function() {
                resolve();
            };

            utterance.onerror = function() {
                reject(new Error('Speech failed'));
            };

            currentUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        });
    }

    function toCacheKey(text, language) {
        return language + '::' + text;
    }

    async function translateForSpeech(text, language) {
        if (language !== 'hi') {
            return text;
        }

        const sourceText = String(text || '').trim();
        if (!sourceText) {
            return '';
        }

        const cacheKey = toCacheKey(sourceText, language);
        if (translatedCache.has(cacheKey)) {
            return translatedCache.get(cacheKey);
        }

        const response = await fetch(TRANSLATE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                text: sourceText,
                target_lang: 'hi',
                source_lang: 'en'
            })
        });

        if (!response.ok) {
            throw new Error('Translation request failed');
        }

        const payload = await response.json();
        if (!payload || !payload.success || !payload.translated_text) {
            throw new Error((payload && payload.error) ? payload.error : 'Translation failed');
        }

        const translated = String(payload.translated_text).trim();
        translatedCache.set(cacheKey, translated);
        if (translatedCache.size > 5) {
            const oldest = translatedCache.keys().next().value;
            translatedCache.delete(oldest);
        }

        return translated;
    }

    async function playAnswer(card, answerId, rawText, autoPlay) {
        if (!debouncePlay(answerId) && !autoPlay) {
            return;
        }

        let token = null;

        try {
            const language = getVoiceLanguage();
            const speakText = getVoiceSafeText(rawText);
            if (!speakText) {
                setState(card, 'error', 'No speech content');
                return;
            }

            let preparedText = speakText;
            if (language === 'hi') {
                setState(card, 'loading', 'Translating to Hindi');
                preparedText = await translateForSpeech(speakText, language);
            }

            const chunks = splitIntoChunks(preparedText, MAX_CHUNK_CHARS);
            if (!chunks.length) {
                setState(card, 'error', 'No speech content');
                return;
            }

            stopPlayback(false);
            currentCard = card;
            currentAnswerId = answerId;

            token = Date.now() + '-' + Math.random();
            playTokens.set(answerId, token);

            setState(card, 'loading', 'Preparing');

            for (let i = 0; i < chunks.length; i++) {
                if (playTokens.get(answerId) !== token) {
                    return;
                }

                setState(card, 'playing', 'Playing ' + (i + 1) + '/' + chunks.length);
                await speakChunk(chunks[i], 1.0, language);
            }

            setState(card, 'idle', 'Done');
        }
        catch (error) {
            setState(card, 'error', (error && error.message) ? error.message : 'Voice error');
        }
        finally {
            if (token !== null && playTokens.get(answerId) === token) {
                playTokens.delete(answerId);
            }
            if (currentAnswerId === answerId) {
                currentUtterance = null;
                currentCard = null;
                currentAnswerId = null;
            }
        }
    }

    async function speakText(rawText, options) {
        const config = options || {};
        const language = config.language === 'hi' ? 'hi' : getVoiceLanguage();
        const speed = Number(config.rate);
        const speakRate = Number.isFinite(speed) ? speed : 0.97;
        const safeText = getVoiceSafeText(rawText);

        if (!safeText) {
            throw new Error('No speech content');
        }

        let preparedText = safeText;
        if (language === 'hi') {
            preparedText = await translateForSpeech(safeText, language);
        }

        const chunks = splitIntoChunks(preparedText, MAX_CHUNK_CHARS);
        if (!chunks.length) {
            throw new Error('No speech content');
        }

        stopPlayback(false);

        for (let i = 0; i < chunks.length; i++) {
            await speakChunk(chunks[i], speakRate, language);
        }
    }

    function isSpeakingNow() {
        return !!(window.speechSynthesis && window.speechSynthesis.speaking);
    }

    function injectControls(card, answerText, answerId, autoPlay) {
        if (!card || card.getAttribute('data-voice-ui') === '1') {
            return;
        }

        const body = card.querySelector('.zabgpt-message-body');
        if (!body) {
            return;
        }

        card.setAttribute('data-voice-ui', '1');
        card.setAttribute('data-voice-state', 'idle');

        const controls = document.createElement('div');
        controls.className = 'zabgpt-voice-controls';

        const toggleWrap = document.createElement('label');
        toggleWrap.className = 'zabgpt-voice-toggle';

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = isVoiceEnabled();

        const toggleText = document.createElement('span');
        toggleText.textContent = '🔊 Speak';

        toggleWrap.appendChild(toggle);
        toggleWrap.appendChild(toggleText);

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'zabgpt-voice-play-btn';
        playBtn.textContent = '▶ Play';

        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'zabgpt-voice-stop-btn';
        stopBtn.textContent = '⏹ Stop';

        const languageWrap = document.createElement('label');
        languageWrap.className = 'zabgpt-voice-language';

        const languageLabel = document.createElement('span');
        languageLabel.className = 'zabgpt-voice-language-label';
        languageLabel.textContent = 'Translation';

        const languageSelect = document.createElement('select');
        languageSelect.className = 'zabgpt-voice-language-select';

        const englishOption = document.createElement('option');
        englishOption.value = 'en';
        englishOption.textContent = 'English';

        const hindiOption = document.createElement('option');
        hindiOption.value = 'hi';
        hindiOption.textContent = 'Hindi';

        languageSelect.appendChild(englishOption);
        languageSelect.appendChild(hindiOption);
        languageSelect.value = getVoiceLanguage();

        languageWrap.appendChild(languageLabel);
        languageWrap.appendChild(languageSelect);

        const status = document.createElement('span');
        status.className = 'zabgpt-voice-status';
        status.textContent = 'Ready';

        controls.appendChild(toggleWrap);
        controls.appendChild(playBtn);
        controls.appendChild(stopBtn);
        controls.appendChild(languageWrap);
        controls.appendChild(status);

        body.appendChild(controls);

        toggle.addEventListener('change', function() {
            setVoiceEnabled(toggle.checked);
            const all = document.querySelectorAll('.zabgpt-voice-toggle input[type="checkbox"]');
            all.forEach(function(input) {
                if (input !== toggle) {
                    input.checked = toggle.checked;
                }
            });
        });

        languageSelect.addEventListener('change', function() {
            const selectedLanguage = languageSelect.value === 'hi' ? 'hi' : 'en';
            setVoiceLanguage(selectedLanguage);
            const all = document.querySelectorAll('.zabgpt-voice-language-select');
            all.forEach(function(selectEl) {
                if (selectEl !== languageSelect) {
                    selectEl.value = selectedLanguage;
                }
            });
            if (currentAnswerId === answerId) {
                stopPlayback(true);
                setState(card, 'idle', selectedLanguage === 'hi' ? 'Hindi ready' : 'English ready');
            }
        });

        playBtn.addEventListener('click', function() {
            playAnswer(card, answerId, answerText, false);
        });

        stopBtn.addEventListener('click', function() {
            stopPlayback(true);
            setState(card, 'idle', 'Stopped');
        });

        if (autoPlay && toggle.checked) {
            setTimeout(function() {
                playAnswer(card, answerId, answerText, true);
            }, 30);
        }
    }

    function scanAndInject(autoPlay) {
        const cards = document.querySelectorAll('.zabgpt-message.is-ai');
        cards.forEach(function(card) {
            if (card.getAttribute('data-voice-ui') === '1') {
                return;
            }

            let answerId = card.getAttribute('data-answer-id');
            if (!answerId) {
                answerId = createAnswerId();
                card.setAttribute('data-answer-id', answerId);
            }

            const answerText = decodeRawAnswer(card);
            injectControls(card, answerText, answerId, !!autoPlay);
        });
    }

    function listenAnswerEvents() {
        document.addEventListener('zabgpt:answer-rendered', function(event) {
            const detail = event && event.detail ? event.detail : {};
            const card = detail.card || null;

            if (!card) {
                scanAndInject(true);
                return;
            }

            const answerId = detail.answer_id || card.getAttribute('data-answer-id') || createAnswerId();
            card.setAttribute('data-answer-id', answerId);

            if (typeof detail.text === 'string' && detail.text.trim()) {
                card.__zabgptRawAnswer = detail.text;
                card.setAttribute('data-answer-raw', detail.text);
            }

            injectControls(card, decodeRawAnswer(card), answerId, true);
        });
    }

    function setupMutationFallback() {
        const observer = new MutationObserver(function(mutations) {
            let changed = false;
            mutations.forEach(function(m) {
                if (m.addedNodes && m.addedNodes.length) {
                    changed = true;
                }
            });

            if (changed) {
                scanAndInject(true);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        if ('speechSynthesis' in window) {
            // Ensure voice list is populated in browsers that require lazy loading.
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = function() {
                window.speechSynthesis.getVoices();
            };
        }

        listenAnswerEvents();
        setupMutationFallback();
        scanAndInject(false);

        window.ZabGPTVoice = {
            speakText: speakText,
            stop: function() {
                stopPlayback(true);
            },
            getVoiceSafeText: getVoiceSafeText,
            isSpeaking: isSpeakingNow
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    }
    else {
        init();
    }
})();
