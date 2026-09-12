const DEFAULT_API = 'https://pokedexchat.onrender.com/chat';

  const appState = {
    apiUrl: localStorage.getItem('pokedex_api_url') || DEFAULT_API,
  };

  const CHAT_HISTORY_KEY = 'pokedex_chat_history';
  const SPRITE_STATE_KEY = 'pokedex_sprite_state';
  const chatHistory = [];

  const chatLog = document.getElementById('chatLog');
  const form = document.getElementById('composerForm');
  const input = document.getElementById('msgInput');
  const sendBtn = document.getElementById('sendBtn');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const spriteFrame = document.getElementById('spriteFrame');
  const spriteLabel = document.getElementById('spriteLabel');
  const spriteSub = document.getElementById('spriteSub');
  const configBtn = document.getElementById('configBtn');

  const pokeballSVG = spriteFrame.innerHTML;

  function normalizeApiUrl(value) {
    const trimmed = (value || '').trim();
    return trimmed || DEFAULT_API;
  }

  function persistSpriteState() {
    const img = spriteFrame.querySelector('img');
    const snapshot = {
      imageUrl: img ? img.src : null,
      name: spriteLabel.textContent || '',
      subtitle: spriteSub.textContent || '',
    };

    sessionStorage.setItem(SPRITE_STATE_KEY, JSON.stringify(snapshot));
  }

  function resetSprite(name = '') {
    if (name) {
      spriteFrame.innerHTML = '';
      spriteLabel.textContent = name.toUpperCase();
      spriteSub.textContent = 'No sprite available';
      persistSpriteState();
      return;
    }

    spriteFrame.innerHTML = pokeballSVG;
    spriteLabel.textContent = '';
    spriteSub.textContent = '';
    persistSpriteState();
  }

  function updateSprite(imageUrl, name) {
    if (!imageUrl) {
      resetSprite(name);
      return;
    }

    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = name || 'Pokémon';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      resetSprite();
    });

    spriteFrame.innerHTML = '';
    spriteFrame.appendChild(img);
    spriteLabel.textContent = (name || 'UNKNOWN').toUpperCase();
    spriteSub.textContent = 'Scan complete';
    persistSpriteState();
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatInlineText(text) {
    let html = escapeHtml(text);

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

    return html;
  }

  function formatBotMessage(text) {
    const lines = (text || '').replace(/\r/g, '').split('\n');
    const formatted = [];
    let tableLines = [];

    function flushTable() {
      if (tableLines.length < 2) {
        formatted.push(...tableLines.map(line => formatInlineText(line)));
        tableLines = [];
        return;
      }

      const rows = tableLines
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(part => part.trim()));

      if (rows.length >= 2) {
        const header = rows[0];
        const body = rows.slice(2);

        const thead = `<thead><tr>${header.map(cell => `<th>${formatInlineText(cell)}</th>`).join('')}</tr></thead>`;
        const tbody = body.length
          ? `<tbody>${body.map(row => `<tr>${row.map(cell => `<td>${formatInlineText(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`
          : '';

        formatted.push(`<table><thead><tr>${header.map(cell => `<th>${formatInlineText(cell)}</th>`).join('')}</tr></thead>${tbody}</table>`);
      } else {
        formatted.push(...tableLines.map(line => formatInlineText(line)));
      }

      tableLines = [];
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].trim();

      if (line.includes('|')) {
        tableLines.push(line);
        continue;
      }

      if (tableLines.length) {
        flushTable();
      }

      if (!line) {
        formatted.push('<br>');
        continue;
      }

      formatted.push(formatInlineText(line));
    }

    if (tableLines.length) {
      flushTable();
    }

    return formatted.join('<br>');
  }

  function addRow(text, who, isError) {
    const row = document.createElement('div');
    row.className = 'row ' + who;

    const bubble = document.createElement('div');
    bubble.className = 'bubble' + (isError ? ' error' : '');

    const prefix = document.createElement('span');
    prefix.className = 'prefix';
    prefix.textContent = who === 'user' ? 'YOU' : 'DEX';

    bubble.appendChild(prefix);

    if (who === 'bot') {
      bubble.insertAdjacentHTML('beforeend', formatBotMessage(text));
    } else {
      bubble.appendChild(document.createTextNode(text));
    }

    row.appendChild(bubble);

    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;

    return row;
  }

  function addBotMessage(text, isError) { return addRow(text, 'bot', isError); }
  function addUserMessage(text) { return addRow(text, 'user'); }

  function persistChatHistory() {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory));
  }

  function loadChatHistory() {
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }

      chatHistory.length = 0;

      parsed.forEach((entry) => {
        if (entry?.who === 'user') {
          chatHistory.push({ who: 'user', text: entry.text || '' });
          addUserMessage(entry.text || '');
        } else if (entry?.who === 'bot') {
          chatHistory.push({ who: 'bot', text: entry.text || '' });
          addBotMessage(entry.text || '');
        }
      });
    } catch (error) {
      sessionStorage.removeItem(CHAT_HISTORY_KEY);
    }
  }

  function restoreSpriteState() {
    const raw = sessionStorage.getItem(SPRITE_STATE_KEY);
    if (!raw) {
      resetSprite();
      return;
    }

    try {
      const snapshot = JSON.parse(raw);
      if (snapshot?.imageUrl) {
        updateSprite(snapshot.imageUrl, snapshot.name || '');
      } else if (snapshot?.name) {
        resetSprite(snapshot.name);
      } else {
        resetSprite();
      }
    } catch (error) {
      sessionStorage.removeItem(SPRITE_STATE_KEY);
      resetSprite();
    }
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'row bot';
    row.id = 'typingRow';
    row.innerHTML = '<div class="bubble typing"><span class="prefix">DEX</span>Scanning<span class="dots"></span></div>';
    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function hideTyping() {
    const row = document.getElementById('typingRow');
    if (row) row.remove();
  }

  function setStatus(state) {
    if (state === 'busy') {
      statusDot.style.background = '#e0b200';
      statusDot.style.boxShadow = '0 0 6px #e0b200';
      statusText.textContent = 'SCANNING';
      return;
    }

    if (state === 'error') {
      statusDot.style.background = '#d63a3a';
      statusDot.style.boxShadow = '0 0 6px #d63a3a';
      statusText.textContent = 'ERROR';
      return;
    }

    statusDot.style.background = '#3fae4a';
    statusDot.style.boxShadow = '0 0 6px #3fae4a';
    statusText.textContent = 'READY';
  }

  function guessName(userText) {
    const cleaned = userText.toLowerCase().trim().replace(/[?.!]+$/, '');
    const prefixes = ['tell me about ', 'what do you know about ', 'information about ', 'what is ', 'who is ', 'pokemon '];

    for (const prefix of prefixes) {
      if (cleaned.startsWith(prefix)) {
        return cleaned.slice(prefix.length).trim();
      }
    }

    return null;
  }

  function setBusyState(isBusy) {
    sendBtn.disabled = isBusy;
    input.disabled = isBusy;
    sendBtn.setAttribute('aria-busy', String(isBusy));
  }

  async function sendMessage(text) {
    addUserMessage(text);
    chatHistory.push({ who: 'user', text });
    persistChatHistory();

    input.value = '';
    setBusyState(true);
    setStatus('busy');
    showTyping();

    let controller;
    let timeoutId;

    try {
      controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 15000);

      const res = await fetch(appState.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      window.clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`);
      }

      const data = await res.json();
      hideTyping();

      if (data.error) {
        addBotMessage(`Error: ${data.error}`, true);
        chatHistory.push({ who: 'bot', text: `Error: ${data.error}` });
        persistChatHistory();
        setStatus('error');
        return;
      }

      addBotMessage(data.reply || '(no reply)');
      chatHistory.push({ who: 'bot', text: data.reply || '(no reply)' });
      persistChatHistory();
      setStatus('ready');

      const pokemonName = data.pokemon?.name || guessName(text);
      updateSprite(data.image_url || null, pokemonName);
    } catch (err) {
      hideTyping();

      const message = err?.name === 'AbortError'
        ? `Request timed out while contacting the backend at ${appState.apiUrl}.`
        : `Couldn't reach the backend at ${appState.apiUrl}. Is the FastAPI server running? (${err.message})`;

      addBotMessage(message, true);
      setStatus('error');
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      setBusyState(false);

      const isMobile = window.matchMedia('(max-width: 760px)').matches;
      if (!isMobile) {
        input.focus();
      }
    }
  }

  configBtn.addEventListener('click', () => {
    const next = prompt('Backend /chat URL:', appState.apiUrl);
    if (next === null) {
      return;
    }

    appState.apiUrl = normalizeApiUrl(next);
    localStorage.setItem('pokedex_api_url', appState.apiUrl);
    addBotMessage(`Backend set to ${appState.apiUrl}`);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const text = input.value.trim();
    if (!text) {
      return;
    }

    input.blur();
    sendMessage(text);
  });

  function updateViewportHeight() {
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${viewportHeight}px`);
  }

  function updateKeyboardState() {
    updateViewportHeight();

    const isMobile = window.matchMedia('(max-width: 760px)').matches;

    if (!isMobile) {
      document.body.classList.remove('mobile-keyboard-open');
      return;
    }

    const viewport = window.visualViewport;
    const keyboardOpen = !!viewport && (window.innerHeight - viewport.height) > 120;

    document.body.classList.toggle('mobile-keyboard-open', keyboardOpen);
  }

  input.addEventListener('focus', updateKeyboardState);
  input.addEventListener('blur', () => document.body.classList.remove('mobile-keyboard-open'));
  window.addEventListener('resize', updateKeyboardState);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateKeyboardState);
  }

  appState.apiUrl = normalizeApiUrl(appState.apiUrl);
  localStorage.setItem('pokedex_api_url', appState.apiUrl);

  const existingHistory = sessionStorage.getItem(CHAT_HISTORY_KEY);
  if (existingHistory) {
    loadChatHistory();
    restoreSpriteState();
  } else {
    resetSprite();
    addBotMessage('Pokédex online. Ask me about any Pokémon — types, abilities, evolutions, or trivia.');
    persistChatHistory();
  }

  input.focus();
