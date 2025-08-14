/*
  Pink-Version mit Ladebalken (schwarz/weiß) und ohne Download-Button.
  Steuerung des API-Keys per Ctrl+K (Modal).
*/
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('apiKeyModal');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');

  let apiKey = localStorage.getItem('openai_api_key');
  function showApiKeyModal(){ if (modal) modal.style.display = 'block'; }
  function hideApiKeyModal(){ if (modal) modal.style.display = 'none'; }

  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        localStorage.setItem('openai_api_key', key);
        apiKey = key;
        hideApiKeyModal();
      }
    });
  }

  const promptInput = document.getElementById('prompt');
  const resultModal = document.getElementById('resultModal');
  const resultContent = document.getElementById('resultContent');
  const messagesContainer = document.getElementById('messages');

  // Ladebalken
  const loadingBarElem = document.getElementById('loadingBar');
  function showLoadingBar(){ if (loadingBarElem) loadingBarElem.style.display = 'block'; }
  function hideLoadingBar(){ if (loadingBarElem) loadingBarElem.style.display = 'none'; }

  function warnIfFileProtocol(){
    if (location.protocol === 'file:') {
      showResult('Bitte über http://localhost:PORT starten (z. B. python -m http.server).');
      return true;
    }
    return false;
  }

  function showResult(content){
    resultContent.innerHTML = '';
    if (typeof content === 'string') {
      const p = document.createElement('p'); p.textContent = content; resultContent.appendChild(p);
    } else if (content instanceof HTMLElement) {
      resultContent.appendChild(content);
    }
    resultModal.style.display = 'flex';
  }
  function hideResult(){ resultModal.style.display = 'none'; }

  async function optimizePromptWithGPT4(userPrompt){
    const systemPrompt = `You are ChatGPT's internal DALL-E 3 prompt optimizer. 
Return an enhanced prompt (no quotes).`;
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          max_tokens: 200,
          temperature: 0.7
        })
      });
      if (!r.ok) throw new Error('GPT-4 optimization failed: ' + r.status);
      const d = await r.json();
      return d.choices[0].message.content.trim();
    } catch(e){
      console.warn('Optimizer fallback:', e.message);
      return 'High quality, photorealistic, detailed, natural colors. Subject: ' + userPrompt;
    }
  }

  async function generateImageWithOptimizedPrompt(optPrompt, originalPrompt){
    const payload = {
      model: 'dall-e-3',
      prompt: optPrompt,
      n: 1,
      size: '1792x1024',
      quality: 'hd',
      style: 'vivid',
      response_format: 'url'
    };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const e = await r.json(); if (e?.error?.message) msg += ': ' + e.error.message; } catch(_){}
      throw new Error(msg);
    }
    return await r.json();
  }

  async function sendPrompt(){
    const originalPrompt = promptInput.value.trim();
    if (!originalPrompt) return;
    if (!apiKey) { showResult('Kein API‑Schlüssel gefunden. Drücke Ctrl+K.'); return; }
    if (warnIfFileProtocol()) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    const promptPara = document.createElement('p');
    promptPara.className = 'prompt-text';
    promptPara.textContent = originalPrompt;
    messageDiv.appendChild(promptPara);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    promptInput.value = '';

    try {
      showLoadingBar();
      const optimized = await optimizePromptWithGPT4(originalPrompt);
      const imageData = await generateImageWithOptimizedPrompt(optimized, originalPrompt);
      const imageUrl = imageData?.data?.[0]?.url;
      if (imageUrl){
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = originalPrompt;
        img.classList.add('generated-image');
        img.addEventListener('click', () => showResult(img.cloneNode(true)));
        messageDiv.appendChild(img);
        showResult(img.cloneNode(true));
      } else {
        const p = document.createElement('p');
        p.textContent = 'Es wurde kein Bild zurückgegeben.';
        messageDiv.appendChild(p);
      }
    } catch(e){
      const p = document.createElement('p');
      p.style.color = 'red';
      p.textContent = 'Fehler: ' + e.message;
      messageDiv.appendChild(p);
    } finally {
      hideLoadingBar();
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  function autoGrow(){
    promptInput.style.height='auto';
    const max = Math.floor(window.innerHeight*0.6);
    promptInput.style.height = Math.min(promptInput.scrollHeight, max) + 'px';
  }
  promptInput.addEventListener('input', autoGrow);
  setTimeout(autoGrow, 0);
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendPrompt(); }
  });

  resultModal.addEventListener('click', (ev) => { if (ev.target === resultModal) hideResult(); });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') hideResult();
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k'){ ev.preventDefault(); showApiKeyModal(); }
  });

  promptInput.focus();
});
