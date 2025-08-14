/*
  ULTIMATE ChatGPT-Style Image Generation Script
  Verwendet das gleiche 2-Stufen-System wie ChatGPT:
  1. GPT-4 optimiert den Prompt (wie ChatGPT intern)
  2. Optimierter Prompt wird an DALL-E 3 gesendet
  
  NEUE FEATURES:
  - Automatischer Download der generierten Bilder
  - Verbesserte Gesichtsdarstellung durch optimierte Prompts
  - Bessere Fehlerbehandlung
*/

document.addEventListener('DOMContentLoaded', () => {
  // Referenzen auf Modal und dessen Eingabefelder für den API‑Schlüssel
  const modal = document.getElementById('apiKeyModal');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKey');

  // Lade einen eventuell zuvor gespeicherten API‑Schlüssel aus dem lokalen Speicher.
  let apiKey = localStorage.getItem('openai_api_key');

  // Zeige bzw. verberge den API‑Key‑Dialog
  function showApiKeyModal() {
    if (modal) modal.style.display = 'block';
  }
  function hideApiKeyModal() {
    if (modal) modal.style.display = 'none';
  }

  // Speichere den API‑Key aus dem Modalfenster im lokalen Speicher
  if (saveApiKeyBtn) {
    saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        localStorage.setItem('openai_api_key', key);
        apiKey = key;
        hideApiKeyModal();
        // Synchronisiere auch das Passwortfeld im unteren Eingabebereich
        const barInput = document.getElementById('apiKeyBarInput');
        if (barInput) barInput.value = key;
      }
    });
  }

  // Elemente für das Prompt‑Eingabefeld, das Ergebnis‑Overlay und die Nachrichtenliste
  const promptInput = document.getElementById('prompt');
  const resultModal = document.getElementById('resultModal');
  const resultContent = document.getElementById('resultContent');
  const messagesContainer = document.getElementById('messages');

  // Ladebalken: Elementreferenz und Hilfsfunktionen
  const loadingBarElem = document.getElementById('loadingBar');
  function showLoadingBar() {
    if (loadingBarElem) loadingBarElem.style.display = 'block';
  }
  function hideLoadingBar() {
    if (loadingBarElem) loadingBarElem.style.display = 'none';
  }

  // Warnung, wenn die Seite über file:// geladen wurde
  function warnIfFileProtocol() {
    if (window.location.protocol === 'file:') {
      showResult(
        'Diese Anwendung funktioniert nicht, wenn sie direkt über eine lokale Datei (file://) geöffnet wird. Bitte starte einen lokalen Webserver (z. B. mit "python -m http.server" im Projektordner) und öffne die Seite über http://localhost:PORT.'
      );
      return true;
    }
    return false;
  }

  // Anzeige eines Ergebnisses im Overlay (Bild oder Fehlermeldung)
  function showResult(content) {
    resultContent.innerHTML = '';
    if (typeof content === 'string') {
      const p = document.createElement('p');
      p.textContent = content;
      resultContent.appendChild(p);
    } else if (content instanceof HTMLElement) {
      resultContent.appendChild(content);
    }
    resultModal.style.display = 'flex';
  }
  function hideResult() {
    resultModal.style.display = 'none';
  }

  // NEUE FUNKTION: Automatischer Download von Bildern (Edge-optimiert)
  async function downloadImage(imageUrl, filename) {
    try {
      console.log('🔄 Starte Download...', filename);
      
      // Edge-spezifische Behandlung
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        // Für ältere Edge-Versionen (Legacy Edge)
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        window.navigator.msSaveOrOpenBlob(blob, filename);
        console.log(`✅ Bild automatisch heruntergeladen (Legacy Edge): ${filename}`);
        return;
      }
      
      // Standard-Download für moderne Browser (Chromium Edge)
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Erstelle einen temporären Download-Link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // Edge-spezifische Eigenschaften
      link.href = downloadUrl;
      link.download = filename;
      link.style.display = 'none';
      link.target = '_blank';
      
      // Trigger Download mit zusätzlichen Edge-Workarounds
      document.body.appendChild(link);
      
      // Verschiedene Trigger-Methoden für Edge
      try {
        link.click();
      } catch (e) {
        // Fallback für Edge: simuliere Mouse-Event
        const event = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        link.dispatchEvent(event);
      }
      
      // Cleanup mit Verzögerung für Edge
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      console.log(`✅ Bild automatisch heruntergeladen: ${filename}`);
      
      // Zusätzliche Bestätigung für den Benutzer
      showDownloadConfirmation(filename);
      
    } catch (error) {
      console.error('❌ Download-Fehler:', error);
      
      // Fallback: Öffne Bild in neuem Tab wenn Download fehlschlägt
      try {
        window.open(imageUrl, '_blank');
        console.log('💡 Download fehlgeschlagen - Bild in neuem Tab geöffnet');
      } catch (openError) {
        console.error('❌ Auch das Öffnen in neuem Tab fehlgeschlagen:', openError);
      }
    }
  }

  // Neue Hilfsfunktion: Zeige Download-Bestätigung
  function showDownloadConfirmation(filename) {
    // Erstelle eine temporäre Benachrichtigung
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: opacity 0.3s ease;
    `;
    notification.textContent = `✅ Download: ${filename}`;
    
    document.body.appendChild(notification);
    
    // Entferne die Benachrichtigung nach 3 Sekunden
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // VERBESSERTE FUNKTION: GPT-4 optimiert den Prompt mit besserem Fokus auf Gesichter
  async function optimizePromptWithGPT4(userPrompt) {
    const systemPrompt = `You are ChatGPT's internal DALL-E 3 prompt optimizer. Your job is to transform user prompts into detailed, high-quality DALL-E 3 prompts exactly like ChatGPT does.

IMPORTANT RULES FOR BETTER RESULTS:
1. Add professional photography details: lighting, composition, camera settings, style
2. Include specific visual details: textures, colors, atmosphere, mood
3. Specify image quality: "photorealistic", "high resolution", "professional quality"  
4. Add artistic style if not specified: "cinematic", "award-winning photography", etc.
5. Keep the user's core intent but enhance dramatically
6. Use 50-150 words for optimal results
7. Write in English even if user writes in German
8. DO NOT use quotation marks in your response
9. Focus on visual elements that DALL-E 3 understands well

SPECIAL RULES FOR HUMAN FACES AND PORTRAITS:
- If the prompt involves people or faces, add: "beautiful detailed facial features, expressive eyes, natural skin texture, professional portrait lighting, sharp focus on face"
- For portraits: "studio lighting, soft shadows, detailed facial structure, natural expressions, high-resolution portrait photography"
- Avoid generic terms like "person" - use more specific descriptors
- Add lighting that flatters human features: "soft diffused lighting, golden hour light, or professional studio setup"

Transform this user prompt into an optimized DALL-E 3 prompt:`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 200,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`GPT-4 optimization failed: ${response.status}`);
      }

      const data = await response.json();
      const optimizedPrompt = data.choices[0].message.content.trim();
      
      console.log('🔄 GPT-4 Optimization:');
      console.log('Original:', userPrompt);
      console.log('Optimized:', optimizedPrompt);
      
      return optimizedPrompt;
    } catch (error) {
      console.error('GPT-4 optimization error:', error);
      // Fallback mit verbesserter Gesichtsdarstellung
      const hasHumanReference = /person|mensch|gesicht|portrait|face|people|woman|man|frau|mann|kind|child/i.test(userPrompt);
      const faceEnhancement = hasHumanReference ? 
        ", beautiful detailed facial features, expressive eyes, natural skin texture, professional portrait lighting, soft diffused lighting" : "";
      
      return `Create a stunning, highly detailed, photorealistic image with professional lighting, sharp focus, vibrant colors, cinematic composition, award-winning photography quality${faceEnhancement}. Subject: ${userPrompt}`;
    }
  }

  // STUFE 2: Optimierten Prompt an DALL-E 3 senden
  async function generateImageWithOptimizedPrompt(optimizedPrompt, originalPrompt) {
    const payload = {
      model: 'dall-e-3',
      prompt: optimizedPrompt,
      n: 1,
      size: '1792x1024', // Querformat (Landscape) - 16:9 Verhältnis
      quality: 'hd',
      style: 'vivid',
      response_format: 'url'
    };

    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMsg = `HTTP error ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.error && errorData.error.message) {
            errorMsg = `${errorMsg}: ${errorData.error.message}`;
          }
        } catch (e) {
          /* ignore JSON parse errors */
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log('✅ DALL-E 3 Response:', data);
      
      // Zeige auch den von DALL-E verwendeten Prompt (revised_prompt)
      if (data.data[0].revised_prompt) {
        console.log('🎨 DALL-E Final Prompt:', data.data[0].revised_prompt);
      }
      
      return data;
    } catch (error) {
      console.error('DALL-E 3 generation error:', error);
      throw error;
    }
  }

  // HAUPTFUNKTION: Kombiniert beide Stufen wie ChatGPT + Auto-Download
  async function sendPrompt() {
    const originalPrompt = promptInput.value.trim();
    if (!originalPrompt) return;
    if (!apiKey) {
      showResult('Kein API‑Schlüssel gefunden. Bitte gib deinen Schlüssel unten ein.');
      return;
    }

    // Erstelle eine neue Nachricht im Chatverlauf
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    const promptPara = document.createElement('p');
    promptPara.className = 'prompt-text';
    promptPara.textContent = originalPrompt;
    messageDiv.appendChild(promptPara);
    
    // Füge die Nachricht in die Liste ein (ohne Statusanzeige)
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    promptInput.value = '';

    // Bei direktem file:// Zugriff abbrechen
    if (warnIfFileProtocol()) return;

    // Ladebalken einblenden
    showLoadingBar();
    try {
      // STUFE 1: GPT-4 optimiert den Prompt (wie ChatGPT)
      const optimizedPrompt = await optimizePromptWithGPT4(originalPrompt);

      // STUFE 2: DALL-E 3 generiert das Bild
      const imageData = await generateImageWithOptimizedPrompt(optimizedPrompt, originalPrompt);

      const imageUrl = imageData.data && imageData.data[0] && imageData.data[0].url;

      if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = originalPrompt;
        img.classList.add('generated-image');
        img.addEventListener('click', () => {
          showResult(img.cloneNode(true));
        });
        messageDiv.appendChild(img);

        // Zeige das generierte Bild sofort groß
        showResult(img.cloneNode(true));

        // NEUE FUNKTION: Automatischer Download
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `prompt-battle-${timestamp}.png`;
        downloadImage(imageUrl, filename);

      } else {
        const errorP = document.createElement('p');
        errorP.textContent = 'Es wurde kein Bild zurückgegeben.';
        messageDiv.appendChild(errorP);
      }
    } catch (error) {
      console.error('Generation error:', error);

      const errorP = document.createElement('p');
      if (error.message && error.message.toLowerCase().includes('failed to fetch')) {
        errorP.textContent = 'Fehler: Die Anfrage konnte nicht gesendet werden. Überprüfe deine Internetverbindung oder starte einen lokalen Webserver.';
      } else {
        errorP.textContent = `Fehler: ${error.message}`;
      }
      errorP.style.color = 'red';
      messageDiv.appendChild(errorP);
    } finally {
      // Ladebalken ausblenden
      hideLoadingBar();
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Enter ohne Shift sendet den Prompt
  function autoGrow(){
    promptInput.style.height='auto';
    const max = Math.floor(window.innerHeight*0.6);
    const h = Math.min(promptInput.scrollHeight, max);
    promptInput.style.height = h + 'px';
  }
  promptInput.addEventListener('input', autoGrow);
  setTimeout(autoGrow, 0);

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  });

  // Klick auf das Overlay schließt es wieder (wenn außerhalb des Bildes)
  resultModal.addEventListener('click', (event) => {
    if (event.target === resultModal) {
      hideResult();
    }
  });

  // Escape schließt Modal und gegebenenfalls das API‑Key‑Modal
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideResult();
      hideApiKeyModal();
    }
    // Öffne den API‑Key‑Dialog mit Ctrl+K / Cmd+K
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      showApiKeyModal();
    }
  });

  // Direkt nach Laden: Fokus auf das Promptfeld
  promptInput.focus();

});