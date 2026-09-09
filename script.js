const DEFAULT_API = 'https://pokedexchat.onrender.com/chat';
  const appState = {
    apiUrl: localStorage.getItem('pokedex_api_url') || DEFAULT_API,
  };

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

  function resetSprite() {
    spriteFrame.innerHTML = pokeballSVG;
    spriteLabel.textContent = 'NO DATA';
    spriteSub.textContent = 'Ask about a Pokémon to scan it';
  }

  function updateSprite(imageUrl, name) {
    if (!imageUrl) {
      resetSprite();
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
    bubble.appendChild(document.createTextNode(text));
    row.appendChild(bubble);

    chatLog.appendChild(row);
    chatLog.scrollTop = chatLog.scrollHeight;

    return row;
  }

  function addBotMessage(text, isError) { return addRow(text, 'bot', isError); }
  function addUserMessage(text) { return addRow(text, 'user'); }

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
        setStatus('error');
        return;
      }

      addBotMessage(data.reply || '(no reply)');
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
      input.focus();
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

    sendMessage(text);
  });

  appState.apiUrl = normalizeApiUrl(appState.apiUrl);
  localStorage.setItem('pokedex_api_url', appState.apiUrl);

  addBotMessage('Pokédex online. Ask me about any Pokémon — types, abilities, evolutions, or trivia.');
  input.focus();
