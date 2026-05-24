(function () {
  const ML = window.MedLat;

  // TARGET_PTS global: usa o maior target entre todos os canais ativos
  function getTargetPts(ch) {
    return (ch.lagPreset === 'rapido')
      ? Math.ceil(20000 / ML.INTERVAL_MS)
      : Math.ceil(120000 / ML.INTERVAL_MS);
  }

  // Retorna o maior target entre os canais ativos (conclusão única)
  function getGlobalTarget() {
    const active = ML.CHANNELS.filter(ch => ch.active);
    if (!active.length) return Math.ceil(120000 / ML.INTERVAL_MS);
    return Math.max(...active.map(ch => getTargetPts(ch)));
  }

  function playDone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[660, 0], [880, 0.15], [1100, 0.30]].forEach(([freq, t]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.2);
      });
    } catch(e) {}
  }

  (function injectStyles() {
    if (document.getElementById('ml-styles')) return;
    const s = document.createElement('style');
    s.id = 'ml-styles';
    s.textContent = `
      @keyframes mlPulse {
        0%,100% { box-shadow: 0 0 6px #c62828aa; border-color: #c62828; }
        50%      { box-shadow: 0 0 14px #ff0000cc; border-color: #ff4444; }
      }
      #ml-widget { transition: transform .1s; }
      #ml-widget:hover { transform: scale(1.1); }
      input[type=number].ml-sz-inp::-webkit-inner-spin-button,
      input[type=number].ml-sz-inp::-webkit-outer-spin-button { opacity:1; cursor:pointer; }
    `;
    document.head.appendChild(s);
  })();

  /* ── Utilitário: mantém elemento dentro da viewport ── */
  function clampPos(left, top, elW, elH) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      left: Math.max(0, Math.min(left, vw - elW)),
      top:  Math.max(0, Math.min(top,  vh - elH)),
    };
  }

  function makeDraggableWindow(id, titleText, titleColor, width) {
    const win = document.createElement('div');
    win.id = id;
    win.style.cssText = [
      'position:fixed;z-index:99998',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:10px;color:#ccc',
      `width:${width}px;overflow:hidden`,
    ].join(';');
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:4px 8px;cursor:move',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:6px 6px 0 0;user-select:none',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = titleText;
    htitle.style.cssText = `color:${titleColor};font-weight:bold;font-size:9px;letter-spacing:.06em;flex:1`;
    const btnClose = document.createElement('button');
    btnClose.textContent = '\u2715';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';
    btnClose.onclick = () => win.remove();
    hdr.append(htitle, btnClose);
    win.appendChild(hdr);
    let drag = false, ox = 0, oy = 0;
    hdr.addEventListener('mousedown', e => {
      drag = true;
      ox = e.clientX - win.offsetLeft;
      oy = e.clientY - win.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const pos = clampPos(e.clientX - ox, e.clientY - oy, win.offsetWidth, win.offsetHeight);
      win.style.left = pos.left + 'px';
      win.style.top  = pos.top  + 'px';
    });
    window.addEventListener('mouseup', () => drag = false);
    return { win, hdr };
  }

  function positionNearPanel(el, anchorPanel) {
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      const pr  = anchorPanel.getBoundingClientRect();
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;
      const vw  = window.innerWidth;
      const vh  = window.innerHeight;
      const mg  = 6;
      let top  = pr.top;
      let left = pr.left - elW - mg;
      if (left < mg) left = pr.right + mg;
      if (left + elW > vw - mg) left = mg;
      if (top + elH > vh - mg) top = Math.max(mg, vh - elH - mg);
      el.style.top  = top  + 'px';
      el.style.left = left + 'px';
    });
  }

  function toggleTips(anchorPanel) {
    const existing = document.getElementById('ml-tips');
    if (existing) { existing.remove(); return; }
    const TIPS = [
      ['\ud83c\udfaf', 'Centralize as probes sobre a imagem'],
      ['\ud83d\udcfa', 'Grave durante o programa, nunca no intervalo'],
      ['\u23f1\ufe0f', 'N\u00e3o interrompa \u2014 aguarde o sinal sonoro (~2 min)'],
      ['\ud83d\udda5\ufe0f', 'Evite processos pesados durante a grava\u00e7\u00e3o'],
    ];
    const vw = window.innerWidth;
    const auxW = Math.round(Math.max(190, Math.min(260, vw * 0.12)));
    const { win } = makeDraggableWindow('ml-tips', '\ud83d\udca1 Boas Pr\u00e1ticas', '#ffd700', auxW);
    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:5px';
    TIPS.forEach(([icon, text]) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:flex-start;gap:5px;line-height:1.35';
      const ic = document.createElement('span');
      ic.textContent = icon;
      ic.style.cssText = 'font-size:11px;flex-shrink:0;margin-top:1px';
      const tx = document.createElement('span');
      tx.textContent = text;
      tx.style.cssText = 'font-size:9px;color:#fff';
      r.append(ic, tx);
      body.appendChild(r);
    });
    win.appendChild(body);
    positionNearPanel(win, anchorPanel);
  }

  function toggleGuide(anchorPanel) {
    const existing = document.getElementById('ml-guide');
    if (existing) { existing.remove(); return; }
    const vw = window.innerWidth;
    const auxW = Math.round(Math.max(200, Math.min(270, vw * 0.13)));
    const { win } = makeDraggableWindow('ml-guide', '\ud83d\udccb Como Usar', '#00d4ff', auxW);
    const STEPS = [
      { section: '\u2699\ufe0f  PREPARA\u00c7\u00c3O', color: '#ffd700', items: [
        '1. Ative as telas desejadas (\u25cf)',
        '2. Ajuste o tamanho via PX Global ou por tela',
        '3. Posicione cada tela sobre o v\u00eddeo (arrastar ou setas)',
        '4. Preencha a Dedu\u00e7\u00e3o caso o multiviewer exiba offset',
        '5. Selecione o lag estimado: "\u22645s" ou "\u226430s"',
      ]},
      { section: '\u23fa  GRAVA\u00c7\u00c3O', color: '#44ff88', items: [
        '6. Clique em \u25cf GRAVAR \u2014 a an\u00e1lise inicia sozinha ao terminar',
      ]},
      { section: '\ud83d\udcca  AN\u00c1LISE', color: '#ce93d8', items: [
        '7. A lat\u00eancia estimada aparece por tela automaticamente',
        '8. Coluna Real = Resultado + Dedu\u00e7\u00e3o canal \u2212 Dedu\u00e7\u00e3o ref.',
        '9. Para ajuste fino: clique em Manual e mova as r\u00e9guas',
        '10. Clique em \u2714 Confirmar para exportar e copiar os resultados',
      ]},
    ];
    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:6px';
    STEPS.forEach(({ section, color, items }) => {
      const secLabel = document.createElement('div');
      secLabel.textContent = section;
      secLabel.style.cssText = `color:${color};font-size:8px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px;padding-bottom:2px;border-bottom:1px solid ${color}33`;
      body.appendChild(secLabel);
      items.forEach(text => {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.cssText = 'font-size:9px;color:#ddd;line-height:1.5;padding-left:4px';
        body.appendChild(item);
      });
    });
    win.appendChild(body);
    positionNearPanel(win, anchorPanel);
  }

  // Aceita: "3", "-3", "+3", "3.5", "3,5", "-1.2s", "+0.5s", etc.
  // Sem sinal explícito → negativo por padrão
  // Sem ponto/vírgula → inteiro (sem casas decimais implícitas)
  function parseDeductionS(str) {
    if (!str) return null;
    const norm = str.trim()
      .replace(/\u2212/g, '-')
      .replace(/,/g, '.')
      .replace(/s$/i, '')
      .replace(/\s/g, '');
    if (norm === '' || norm === '0') return 0;
    const m = norm.match(/^([+-])?(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const sign = m[1];
    const abs  = parseFloat(m[2]);
    if (isNaN(abs)) return null;
    if (!sign) return -abs;
    return sign === '+' ? abs : -abs;
  }

  function formatDeduction(s) {
    if (s === 0) return '0.000s';
    return (s > 0 ? '+' : '') + s.toFixed(3) + 's';
  }

  /* ── Detecta se um elemento tem cor vermelha dominante ── */
  function isRedText(el) {
    if (!el) return false;
    try {
      const color = window.getComputedStyle(el).color;
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return false;
      const r = parseInt(m[1]);
      const g = parseInt(m[2]);
      const b = parseInt(m[3]);
      return r >= 180 && g < 100 && b < 100;
    } catch(e) { return false; }
  }

  /* ── Overlay de pesquisa restrito ao tamanho da probe ── */
  function showSearchOverlay(ch) {
    document.querySelectorAll('.ml-search-overlay').forEach(e => e.remove());
    const d = ch.probe;
    if (!d) return;
    const rect      = d.getBoundingClientRect();
    const probeL    = rect.left;
    const probeW    = rect.width;
    const cy        = rect.top + rect.height / 2;
    const vh        = window.innerHeight;
    const halfSearch = Math.round((ch.probeW != null ? ch.probeW : ML.state.probeW) / 2);

    const topAbove = Math.max(0, cy - halfSearch);
    const htAbove  = rect.top - topAbove;
    const topBelow = rect.bottom;
    const htBelow  = Math.min(vh, cy + halfSearch) - topBelow;

    [
      { top: topAbove, height: htAbove, label: '\u25b2 pesquisa' },
      { top: topBelow, height: htBelow, label: '\u25bc pesquisa' },
    ].forEach(({ top, height, label }) => {
      if (height <= 0) return;
      const ov = document.createElement('div');
      ov.className = 'ml-search-overlay';
      ov.style.cssText = [
        'position:fixed',
        `left:${probeL}px`,
        `width:${probeW}px`,
        `top:${top}px`,
        `height:${height}px`,
        'background:rgba(255,215,0,0.10)',
        'border-left:1px dashed #ffd70077',
        'border-right:1px dashed #ffd70077',
        'border-top:1px dashed #ffd70077',
        'border-bottom:1px dashed #ffd70077',
        'pointer-events:none;z-index:99996',
        'display:flex;align-items:center;justify-content:center',
        'transition:opacity .5s',
      ].join(';');
      const tag = document.createElement('span');
      tag.textContent = label;
      tag.style.cssText = 'font:bold 9px monospace;color:#ffd700aa;letter-spacing:.1em;pointer-events:none';
      ov.appendChild(tag);
      document.body.appendChild(ov);
      setTimeout(() => {
        ov.style.opacity = '0';
        setTimeout(() => ov.remove(), 500);
      }, 1500);
    });
  }

  /* ── autoDetectDeduction: OCR por pixels – lê texto vermelho renderizado no vídeo ──
     Pipeline:
       1. Localiza o elemento de mídia (video/canvas/img) sob a probe
       2. Captura a área: metade da probe acima + metade abaixo do centro
       3. Dilatação morfológica + threshold permissivo para vermelho degradado por codec
       4. Upscale 5× nearest-neighbor (bordas duras → melhor OCR)
       5. Tesseract.js PSM7 (linha única) extrai o valor
  */
  async function autoDetectDeduction(ch) {
    if (!ch.probe) return null;
    const d = ch.probe;
    const rect = d.getBoundingClientRect();
    const pw   = rect.width;
    const halfH = Math.round((ch.probeW != null ? ch.probeW : ML.state.probeW) / 2);

    // Localiza o elemento de mídia sob a probe
    const cx = rect.left + pw / 2;
    const cy = rect.top  + rect.height / 2;
    d.style.pointerEvents = 'none';
    const el = document.elementFromPoint(cx, cy);
    d.style.pointerEvents = 'auto';
    if (!el) return null;
    let media = null, node = el;
    for (let i = 0; i < 6; i++) {
      if (!node) break;
      if (['VIDEO','CANVAS','IMG'].includes(node.tagName)) { media = node; break; }
      const c = node.querySelector('video,canvas,img');
      if (c) { media = c; break; }
      node = node.parentElement;
    }
    if (!media) return null;

    const mr    = media.getBoundingClientRect();
    if (!mr.width || !mr.height) return null;
    const nw    = media.videoWidth  || media.naturalWidth  || mr.width;
    const nh    = media.videoHeight || media.naturalHeight || mr.height;
    const scaleX = nw / mr.width;
    const scaleY = nh / mr.height;

    // Área de busca: metade da probe acima + metade abaixo do centro
    const searchTop = cy - halfH;
    const searchH   = halfH * 2;
    const sx = Math.max(0, Math.floor((rect.left  - mr.left) * scaleX));
    const sy = Math.max(0, Math.floor((searchTop  - mr.top ) * scaleY));
    const sw = Math.max(1, Math.ceil(pw      * scaleX));
    const sh = Math.max(1, Math.ceil(searchH * scaleY));

    // Captura os pixels da área de busca
    const cap = document.createElement('canvas');
    cap.width = sw; cap.height = sh;
    const ctx = cap.getContext('2d', { willReadFrequently: true });
    try { ctx.drawImage(media, sx, sy, sw, sh, 0, 0, sw, sh); }
    catch(e) { return null; }

    // --- Passo 1: marca pixels vermelhos (threshold permissivo para vídeo comprimido) ---
    const imgData = ctx.getImageData(0, 0, sw, sh);
    const pix = imgData.data;
    const redMask = new Uint8Array(sw * sh); // 1 = pixel vermelho
    for (let i = 0; i < pix.length; i += 4) {
      const r = pix[i], g = pix[i+1], b = pix[i+2];
      // Permissivo: cobre vermelho degradado por codec H.264 (artefatos de chroma)
      if (r >= 140 && r > g * 1.4 && r > b * 1.4 && g < 130 && b < 130) {
        redMask[i >> 2] = 1;
      }
    }

    // --- Passo 2: dilatação morfológica 1px (recupera pixels isolados apagados por compressão) ---
    const dilated = new Uint8Array(sw * sh);
    for (let row = 0; row < sh; row++) {
      for (let col = 0; col < sw; col++) {
        if (redMask[row * sw + col]) { dilated[row * sw + col] = 1; continue; }
        let found = false;
        for (let dr = -1; dr <= 1 && !found; dr++) {
          for (let dc = -1; dc <= 1 && !found; dc++) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < sh && nc >= 0 && nc < sw && redMask[nr * sw + nc]) found = true;
          }
        }
        dilated[row * sw + col] = found ? 1 : 0;
      }
    }

    // --- Passo 3: binariza → texto preto sobre fundo branco ---
    for (let i = 0; i < pix.length; i += 4) {
      const v = dilated[i >> 2] ? 0 : 255;
      pix[i] = pix[i+1] = pix[i+2] = v;
      pix[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // --- Passo 4: upscale 5× nearest-neighbor (bordas duras = melhor OCR) ---
    const SCALE = 5;
    const big = document.createElement('canvas');
    big.width  = sw * SCALE;
    big.height = sh * SCALE;
    const bigCtx = big.getContext('2d');
    bigCtx.imageSmoothingEnabled = false;
    bigCtx.drawImage(cap, 0, 0, big.width, big.height);

    // --- Passo 5: Tesseract PSM7 (linha única) + OEM1 (LSTM) ---
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      }).catch(() => null);
      if (!window.Tesseract) return null;
    }

    try {
      const result = await Tesseract.recognize(big, 'eng', {
        tessedit_char_whitelist: '0123456789.,+-s',
        tessedit_pageseg_mode:   '7',
        tessedit_ocr_engine_mode: '1',
      });
      const text = result.data.text.replace(/\s+/g, ' ').trim();
      console.log('[MedLat] OCR raw:', JSON.stringify(text));
      const RE = /([+\-]?\d*[.,]\d+s?|[+\-]\d+s?)/g;
      let m;
      while ((m = RE.exec(text)) !== null) {
        const v = parseDeductionS(m[0]);
        if (v !== null && Math.abs(v) <= 60) return m[0];
      }
      return null;
    } catch(e) { console.warn('[MedLat] OCR erro:', e); return null; }
  }

  function copyResults(btn) {
    const lines = ML.CHANNELS
      .filter(ch => ch.active)
      .map((ch, i) => {
        const name   = (i === 0 ? '\u2605 REF' : ch.label).padEnd(12);
        const offset = ch.offsetEl ? ch.offsetEl.textContent : '--';
        const real   = ch.realEl  ? ch.realEl.textContent  : '--';
        return name + '\t' + offset + '\t' + real;
      });
    const header = '\u2605 REF'.padEnd(12) + '\tOffset\tReal';
    const text = [header, ...lines].join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '\u2714 Copiado!';
        btn.style.background = '#1b5e20';
        setTimeout(() => { btn.textContent = orig; btn.style.background = '#0d47a1'; }, 1500);
      }).catch(() => fallbackCopy(text, btn, btn.textContent));
    } else {
      fallbackCopy(text, btn, btn.textContent);
    }
  }

  function fallbackCopy(text, btn, orig) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
    btn.textContent = '\u2714 Copiado!';
    btn.style.background = '#1b5e20';
    setTimeout(() => { btn.textContent = orig; btn.style.background = '#0d47a1'; }, 1500);
  }

  function refreshRealColumn() {
    const refDed = ML.CHANNELS[0].deduction || 0;
    ML.CHANNELS.forEach((ch, i) => {
      if (!ch.active || !ch.realEl) return;
      if (i === 0) { ch.realEl.textContent = '\u2014'; ch.realEl.style.color = '#aaa'; return; }
      if (!ch.offsetEl || ch.offsetEl.textContent === '--' || ch.offsetEl.textContent === 'ERRO') {
        ch.realEl.textContent = '--'; ch.realEl.style.color = '#fff'; return;
      }
      const raw = ch.offsetEl.textContent.replace('s', '').replace(',', '.');
      const offsetS = parseFloat(raw);
      if (isNaN(offsetS)) { ch.realEl.textContent = '--'; ch.realEl.style.color = '#fff'; return; }
      const ded = ch.deduction || 0;
      const realS = offsetS + ded - refDed;
      ch.realEl.textContent = (realS > 0 ? '+' : '') + realS.toFixed(3) + 's';
      ch.realEl.style.color = Math.abs(realS) < 0.1 ? '#44ff88' : Math.abs(realS) < 1 ? '#ffd700' : '#ff8844';
    });
  }

  /* ─────────────────────────────────────────────────────────
     minimizePanel: colapsa/expande o painel
  ───────────────────────────────────────────────────────── */
  function minimizePanel(panel) {
    const body = panel.querySelector('#ml-panel-body');
    const btn  = panel.querySelector('#ml-min-btn');
    if (!body || !btn) return;
    const isMin = body.style.display === 'none';
    body.style.display = isMin ? '' : 'none';
    btn.textContent    = isMin ? '\u2212' : '+';
    btn.title          = isMin ? 'Minimizar painel' : 'Expandir painel';
  }

  /* ─────────────────────────────────────────────────────────
     Widget flutuante (botão circular)
  ───────────────────────────────────────────────────────── */
  function spawnWidget(panel) {
    if (document.getElementById('ml-widget')) return;
    const widget = document.createElement('div');
    widget.id = 'ml-widget';
    widget.textContent = '\u23f1';
    widget.title = 'MedLat \u2014 clique para reabrir painel';
    widget.style.cssText = [
      'position:fixed;bottom:20px;right:20px',
      'width:36px;height:36px;border-radius:50%',
      'background:#1a1a2e;border:1px solid #00d4ff66',
      'color:#00d4ff;font-size:18px',
      'display:flex;align-items:center;justify-content:center',
      'cursor:pointer;z-index:99999',
      'box-shadow:0 2px 12px #0008',
      'user-select:none',
    ].join(';');

    let wx = 0, wy = 0, wDrag = false, wMoved = false;

    function syncPulse() {
      if (ML.state.recording) {
        widget.style.animation = 'mlPulse 1s ease-in-out infinite';
        widget.style.borderColor = '#c62828';
      } else {
        widget.style.animation = '';
        widget.style.borderColor = '#00d4ff66';
      }
    }

    function onWMove(e) {
      if (!wDrag) return;
      wMoved = true;
      const pos = clampPos(e.clientX - wx, e.clientY - wy, widget.offsetWidth, widget.offsetHeight);
      widget.style.left   = pos.left + 'px';
      widget.style.top    = pos.top  + 'px';
      widget.style.bottom = 'auto';
      widget.style.right  = 'auto';
    }

    function onWUp() {
      if (!wDrag) return;
      wDrag = false;
      if (!wMoved) {
        widget.remove();
        panel.style.display = '';
        function onMoveOnce(ev) {
          const pos = clampPos(
            ev.clientX - panel.offsetWidth  / 2,
            ev.clientY - panel.offsetHeight / 2,
            panel.offsetWidth, panel.offsetHeight
          );
          panel.style.left = pos.left + 'px';
          panel.style.top  = pos.top  + 'px';
          window.removeEventListener('mousemove', onMoveOnce);
        }
        window.addEventListener('mousemove', onMoveOnce);
      }
    }

    widget.addEventListener('mousedown', e => {
      wDrag = true; wMoved = false;
      wx = e.clientX - widget.offsetLeft;
      wy = e.clientY - widget.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', onWMove);
    window.addEventListener('mouseup',   onWUp);
    syncPulse();
    setInterval(syncPulse, 500);
    document.body.appendChild(widget);
  }

  /* ─────────────────────────────────────────────────────────
     init: monta o painel principal
  ───────────────────────────────────────────────────────── */
  function init() {
    const vw  = window.innerWidth;
    const panW = Math.round(Math.max(200, Math.min(310, vw * 0.155)));

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:40px;right:16px;z-index:99998',
      'background:#0e0e1aee;border:1px solid #1e1e3a',
      'border-radius:8px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:10px;color:#ccc',
      `width:${panW}px`,
      'overflow:hidden',
    ].join(';');

    /* ── Cabeçalho ── */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:5px 8px;cursor:move',
      'background:#12122a;border-bottom:1px solid #1e1e3a',
      'border-radius:8px 8px 0 0;user-select:none;gap:4px',
    ].join(';');

    const htitle = document.createElement('span');
    htitle.textContent = '\u23f1 MedLat';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.08em;flex:1';

    function mkIconBtn(icon, title, color) {
      const b = document.createElement('button');
      b.textContent = icon;
      b.title = title;
      b.style.cssText = [
        `background:none;border:none;color:${color}`,
        'cursor:pointer;font-size:12px;padding:0 2px;line-height:1',
        'flex-shrink:0;opacity:.7',
      ].join(';');
      b.addEventListener('mouseenter', () => b.style.opacity = '1');
      b.addEventListener('mouseleave', () => b.style.opacity = '.7');
      return b;
    }

    const btnTips  = mkIconBtn('\ud83d\udca1', 'Boas pr\u00e1ticas', '#ffd700');
    const btnGuide = mkIconBtn('\ud83d\udccb', 'Como usar',    '#00d4ff');
    const btnMin   = document.createElement('button');
    btnMin.id = 'ml-min-btn';
    btnMin.textContent = '\u2212';
    btnMin.title = 'Minimizar painel';
    btnMin.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a4a;color:#aaa;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';
    const btnClose = document.createElement('button');
    btnClose.textContent = '\u2715';
    btnClose.title = 'Fechar painel';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';

    btnTips.onclick  = () => toggleTips(panel);
    btnGuide.onclick = () => toggleGuide(panel);
    btnMin.onclick   = () => minimizePanel(panel);
    btnClose.onclick = () => { panel.style.display = 'none'; spawnWidget(panel); };

    hdr.append(htitle, btnTips, btnGuide, btnMin, btnClose);
    panel.appendChild(hdr);

    /* ── Corpo ── */
    const body = document.createElement('div');
    body.id = 'ml-panel-body';
    body.style.cssText = 'display:flex;flex-direction:column;gap:0';

    /* ── drag do painel ── */
    let pDrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      pDrag = true;
      pox = e.clientX - panel.offsetLeft;
      poy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!pDrag) return;
      const pos = clampPos(e.clientX - pox, e.clientY - poy, panel.offsetWidth, panel.offsetHeight);
      panel.style.left = pos.left + 'px';
      panel.style.top  = pos.top  + 'px';
      panel.style.right = 'auto';
    });
    window.addEventListener('mouseup', () => pDrag = false);

    /* ── helpers de UI ── */
    function sec(label, extraContent) {
      const s = document.createElement('div');
      s.style.cssText = 'border-top:1px solid #1e1e3a;padding:4px 6px 3px';
      const lhText = document.createElement('div');
      lhText.style.cssText = 'color:#888;font-size:7px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px';
      lhText.textContent = label;
      s.appendChild(lhText);
      if (extraContent) s.appendChild(extraContent);
      return s;
    }

    function row(gap) {
      const r = document.createElement('div');
      r.style.cssText = `display:flex;align-items:center;gap:${gap}px;flex-wrap:nowrap;min-width:0`;
      return r;
    }

    function sp(txt, extra) {
      const s = document.createElement('span');
      s.style.cssText = (extra || '') + ';white-space:nowrap;flex-shrink:0';
      s.textContent = txt;
      return s;
    }

    function mkBtn(txt, bg, extra) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}88;color:#fff;border-radius:3px;cursor:pointer;${extra || ''}`;
      return b;
    }

    function mkNum(val, min, max, step, w) {
      const inp = document.createElement('input');
      inp.type  = 'number';
      inp.value = val; inp.min = min; inp.max = max; inp.step = step;
      inp.className = 'ml-sz-inp';
      inp.style.cssText = [
        `width:${w}px`,
        'background:#1e1e2e;border:1px solid #2a2a4a',
        'color:#fff;border-radius:3px;padding:1px 2px',
        'font-family:monospace;font-size:9px;text-align:center',
      ].join(';');
      return inp;
    }

    function mkLagSelect(ch) {
      const sel = document.createElement('select');
      sel.style.cssText = [
        'flex:1;min-width:0;background:#1e1e2e;border:1px solid #2a2a4a',
        'color:#fff;border-radius:3px;padding:1px 2px',
        'font-family:monospace;font-size:9px;cursor:pointer',
      ].join(';');
      const opts = [
        { value: 'auto',     label: 'Auto' },
        { value: 'rapido',   label: '\u22645s' },
        { value: 'internet', label: '\u226430s' },
      ];
      function updateSelStyle() {
        const p = ML.LAG_PRESETS[ch.lagPreset];
        sel.style.color = p ? '#ffd700' : '#fff';
        sel.style.borderColor = p ? '#ffd70066' : '#2a2a4a';
      }
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if (ch.lagPreset === o.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        ch.lagPreset = sel.value;
        updateSelStyle();
      });
      updateSelStyle();
      return sel;
    }

    function mkDeductionInput(ch) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = '0.000s';
      inp.style.cssText = [
        'flex:1;min-width:0;background:#1e1e2e;border:1px solid #ff9d0044',
        'color:#ff9d00;border-radius:3px;padding:1px 3px',
        'font-family:monospace;font-size:9px',
      ].join(';');
      inp.value = ch.deduction ? formatDeduction(ch.deduction) : '';
      inp.addEventListener('change', () => {
        const raw = inp.value.trim();
        if (!raw) {
          ch.deduction = 0;
          inp.value = '';
          inp.style.color = '#ff9d00';
          refreshRealColumn();
          return;
        }
        const v = parseDeductionS(raw);
        if (v !== null) {
          ch.deduction = v;
          inp.value = formatDeduction(v);
          inp.style.color = '#ff9d00';
        } else {
          inp.style.color = '#ff4444';
        }
        refreshRealColumn();
      });
      ch._dedInp = inp;
      return inp;
    }

    function applyGlobalPx(v) {
      ML.state.probeW = v;
      ML.CHANNELS.forEach(ch => {
        if (ch.probeW !== null) return;
        if (ch.resize) ch.resize();
      });
    }

    /* ── Seção: Config Global ── */
    const secCfg = sec('Config');

    const rPx = row(4);
    const pxInp = mkNum(ML.state.probeW, 60, 600, 4, 44);
    pxInp.title = 'Tamanho das probes em pixels';
    pxInp.addEventListener('change', () => {
      const v = Math.max(60, Math.min(600, parseInt(pxInp.value) || ML.state.probeW));
      pxInp.value = v;
      applyGlobalPx(v);
    });
    pxInp.addEventListener('keydown', e => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const step = e.shiftKey ? 20 : 4;
      const v = Math.max(60, Math.min(600, ML.state.probeW + (e.key === 'ArrowUp' ? step : -step)));
      ML.state.probeW = v;
      pxInp.value = v;
      applyGlobalPx(v);
    });

    const btnSnap = mkBtn('', '#0d4f3c', 'flex:1;padding:2px 0;font-size:8px;letter-spacing:.03em');
    function updateSnapBtn() { btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF'; btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e'; btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#fff'; }
    btnSnap.addEventListener('click', () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); });
    updateSnapBtn();

    const btnCol = mkBtn('', '#3a1a0d', 'flex:1;padding:2px 0;font-size:8px;letter-spacing:.03em');
    function updateColBtn() { btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF'; btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e'; btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#fff'; }
    btnCol.addEventListener('click', () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); });
    updateColBtn();

    rPx.append(sp('px', 'font-size:7px;color:#aaa'), pxInp, btnSnap, btnCol);
    secCfg.appendChild(rPx);
    body.appendChild(secCfg);

    /* ── Seção: Probes (canais) ── */
    const secDet = sec('Probes');
    const probeGrid = document.createElement('div');
    probeGrid.style.cssText = 'display:flex;flex-direction:column;gap:3px';

    ML.CHANNELS.forEach((ch, i) => {
      ch.deduction = ch.deduction || 0;
      const card = document.createElement('div');
      card.style.cssText = [
        'display:flex;flex-direction:column;gap:2px',
        `border-left:2px solid ${ch.color}88`,
        'padding-left:4px',
      ].join(';');

      /* linha 1: toggle + label + lum */
      const r1 = row(4);

      const tog = document.createElement('input');
      tog.type = 'checkbox';
      tog.checked = ch.active;
      tog.title = 'Ativar canal';
      tog.style.cssText = `accent-color:${ch.color};cursor:pointer;flex-shrink:0`;
      tog.addEventListener('change', () => {
        ch.active = tog.checked;
        if (ch.probe) ch.probe.style.display = ch.active ? 'block' : 'none';
      });

      const lblInp = document.createElement('input');
      lblInp.type = 'text';
      lblInp.value = i === 0 ? 'Ref.' : ch.label;
      lblInp.style.cssText = [
        'flex:1;min-width:0;background:transparent;border:none;border-bottom:1px solid #2a2a4a',
        `color:${ch.color};font-family:monospace;font-size:9px;padding:0 2px`,
      ].join(';');
      lblInp.addEventListener('change', () => {
        ch.label = lblInp.value.replace(/^\u2605\s*/, '');
        if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
        if (ch._tdName) ch._tdName.textContent = (i === 0 ? '\u2605 ' : '') + ch.label;
      });

      const lumSp = document.createElement('span');
      lumSp.style.cssText = 'font-size:8px;color:#555;flex-shrink:0;min-width:24px;text-align:right';
      ch.lumEl = lumSp;

      r1.append(tog, lblInp, lumSp);

      /* linha 2: tamanho individual */
      const r2 = row(4);
      r2.style.cssText += ';overflow:hidden;min-width:0';
      const szInp = mkNum(ch.probeW !== null ? ch.probeW : ML.state.probeW, 60, 600, 4, 40);
      szInp.title = 'Tamanho desta probe em pixels (use as setas \u2191\u2193)';

      function applyChanPx(v) {
        ch.probeW = v;
        if (ch.resize) ch.resize();
      }

      szInp.addEventListener('change', () => {
        const v = Math.max(60, Math.min(600, parseInt(szInp.value) || ML.state.probeW));
        szInp.value = v;
        applyChanPx(v);
      });
      szInp.addEventListener('keydown', e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const cur = ch.probeW !== null ? ch.probeW : ML.state.probeW;
        const v = Math.max(60, Math.min(600, cur + (e.key === 'ArrowUp' ? step : -step)));
        ch.probeW = v;
        szInp.value = v;
        applyChanPx(v);
      });

      const btnReset = mkBtn('\u21ba', '#1a1a2e', 'padding:1px 4px;font-size:9px;border-color:#2a2a4a;color:#aaa');
      btnReset.title = 'Resetar para tamanho global';
      btnReset.addEventListener('click', () => {
        ch.probeW = null;
        szInp.value = ML.state.probeW;
        applyChanPx(null);
      });

      r2.append(sp('px', 'font-size:7px;color:#aaa'), szInp, btnReset);

      /* linha 3: dedução */
      const r3ded = row(4);
      r3ded.style.cssText += ';overflow:hidden;min-width:0';
      const dedInp = mkDeductionInput(ch);
      const btnAuto = mkBtn('\ud83d\udd0d', '#2a1a00', 'padding:1px 5px;font-size:10px;border-color:#ff9d0044;flex-shrink:0');
      btnAuto.title = 'Detectar dedução automaticamente';
      btnAuto.addEventListener('click', async () => {
        btnAuto.style.color = '#ffd700';
        showSearchOverlay(ch);
        const found = await autoDetectDeduction(ch);
        if (found) {
          const v = parseDeductionS(found);
          if (v !== null) {
            ch.deduction = v;
            dedInp.value = formatDeduction(v);
            dedInp.style.color = '#ff9d00';
            refreshRealColumn();
          }
        } else {
          btnAuto.style.color = '#ff4444';
          setTimeout(() => btnAuto.style.color = '#ff9d00', 800);
        }
        btnAuto.style.color = '#ff9d00';
      });
      r3ded.append(sp('ded', 'font-size:7px;color:#ff9d00;flex-shrink:0'), dedInp, btnAuto);

      /* linha 4: lag (só canais não-ref) */
      const rows = [r1, r2, r3ded];
      if (i !== 0) {
        const r4lag = row(2);
        r4lag.style.cssText += ';overflow:hidden;min-width:0';
        const lagSel = mkLagSelect(ch);
        r4lag.append(sp('lag', 'font-size:7px;color:#aaa;flex-shrink:0'), lagSel);
        rows.push(r4lag);
      }

      rows.forEach(r => card.appendChild(r));
      probeGrid.appendChild(card);
    });

    secDet.appendChild(probeGrid);

    // autoDetect ao soltar o mouse após arrastar uma probe (com feedback visual)
    window.addEventListener('mouseup', () => {
      ML.CHANNELS.forEach(async ch => {
        if (!ch.active || !ch._dedInp) return;
        if (!ch._wasDragged) return;
        ch._wasDragged = false;
        if (ch._dedInp.value.trim() !== '') return;
        showSearchOverlay(ch);
        const found = await autoDetectDeduction(ch);
        if (!found) return;
        const v = parseDeductionS(found);
        if (v !== null) {
          ch.deduction = v;
          ch._dedInp.value = formatDeduction(v);
          ch._dedInp.style.color = '#ff9d00';
          refreshRealColumn();
        }
      });
    });

    panel.appendChild(secDet);

    /* ── Seção: Análise ── */
    const secAn = sec('An\u00e1lise');

    const btnRec     = mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:2px 0;font-size:9px;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:2px 0;font-size:9px;letter-spacing:.04em;color:#ce93d8;opacity:.45');
    btnRec.title     = 'Inicia a captura de lumin\u00e2ncia';
    btnAnalyze.title = 'Calcula a lat\u00eancia com base nos dados gravados';

    /* Barra de progresso */
    const progWrap = document.createElement('div');
    progWrap.style.cssText = [
      'display:none;flex-direction:column;gap:1px',
      'padding:2px 0',
    ].join(';');
    const progBarOuter = document.createElement('div');
    progBarOuter.style.cssText = [
      'width:100%;height:5px;background:#1e2a3a',
      'border-radius:3px;overflow:hidden',
    ].join(';');
    const progBarInner = document.createElement('div');
    progBarInner.style.cssText = [
      'height:100%;width:0%;background:#44ff88',
      'border-radius:3px;transition:width .4s',
    ].join(';');
    const progLabel = document.createElement('div');
    progLabel.style.cssText = 'font-size:8px;color:#aaa;text-align:center';
    progBarOuter.appendChild(progBarInner);
    progWrap.append(progBarOuter, progLabel);

    function doStop() {
      ML.recorder && ML.recorder.stop && ML.recorder.stop();
      ML.state.recording = false;
      btnRec.textContent    = '\u25cf GRAVAR';
      btnRec.style.background = '#1b5e20';
      btnRec.style.boxShadow  = '0 0 8px #1b5e2066';
      btnRec.style.animation  = '';
      progWrap.style.display  = 'none';
      progBarInner.style.width = '0%';
      progLabel.textContent    = '';
    }

    btnRec.addEventListener('click', () => {
      if (ML.state.recording) { doStop(); return; }
      const active = ML.CHANNELS.filter(c => c.active);
      if (!active.length) { btnRec.style.background = '#7f0000'; setTimeout(() => btnRec.style.background = '#1b5e20', 600); return; }
      ML.state.recording = true;
      btnRec.textContent     = '\u25a0 PARAR';
      btnRec.style.background = '#c62828';
      btnRec.style.animation  = 'mlPulse 1s ease-in-out infinite';
      btnRec.style.boxShadow  = 'none';
      btnAnalyze.style.opacity = '.45';
      btnAnalyze.disabled      = true;
      progWrap.style.display   = 'flex';
      progBarInner.style.background = '#44ff88';

      /* limpa buffers */
      ML.CHANNELS.forEach(ch => {
        ch.buffer  = [];
        ch.prevLum = null;
        if (ch.offsetEl) { ch.offsetEl.textContent = '--'; ch.offsetEl.style.color = '#fff'; }
        if (ch.realEl)   { ch.realEl.textContent   = '--'; ch.realEl.style.color   = '#fff'; }
      });

      ML.recorder && ML.recorder.start && ML.recorder.start();

      const target = getGlobalTarget();
      const tickMs = ML.INTERVAL_MS;
      let elapsed  = 0;

      const tid = setInterval(() => {
        if (!ML.state.recording) { clearInterval(tid); return; }

        /* atualiza luminâncias */
        ML.CHANNELS.forEach(ch => {
          if (!ch.active) return;
          const lum = ML.getLum ? ML.getLum(ch) : null;
          if (ch.lumEl) ch.lumEl.textContent = lum != null && lum >= 0 ? Math.round(lum) : (lum === -1 ? 'X' : '-');
        });

        elapsed++;
        const pct = Math.min(100, Math.round((elapsed / target) * 100));
        progBarInner.style.width = pct + '%';
        const secsLeft = Math.max(0, Math.round(((target - elapsed) * tickMs) / 1000));
        progLabel.textContent = pct < 100
          ? `${pct}% \u2014 ~${secsLeft}s restantes`
          : 'Finalizando\u2026';

        if (elapsed >= target) {
          clearInterval(tid);
          progBarInner.style.background = '#ffd700';

          /* dispara análise */
          if (ML.correlator && ML.correlator.analyze) {
            const results = ML.correlator.analyze();
            results.forEach(r => {
              const ch = ML.CHANNELS.find(c => c.id === r.id);
              if (!ch) return;
              if (ch.offsetEl) {
                ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
                ch.offsetEl.style.color = r.error ? '#ff4444' : '#fff';
                if (!r.error) {
                  const s = r.offsetMs / 1000;
                  ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
                  ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
                }
              }
            });
            refreshRealColumn();
            const errs = results.filter(r => r.error);
            progLabel.textContent = errs.length
              ? errs.map(r => r.label + ': ' + r.error).join(' | ')
              : '\u2714 Conclu\u00eddo';
            progLabel.style.color = errs.length ? '#ff4444' : '#44ff88';
          }

          doStop();
          playDone();
          btnAnalyze.style.opacity = '1';
          btnAnalyze.disabled      = false;
        }
      }, tickMs);
    });

    btnAnalyze.addEventListener('click', () => {
      if (!ML.correlator || !ML.correlator.analyze) return;
      const results = ML.correlator.analyze();
      results.forEach(r => {
        const ch = ML.CHANNELS.find(c => c.id === r.id);
        if (!ch) return;
        if (ch.offsetEl) {
          ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
          ch.offsetEl.style.color = r.error ? '#ff4444' : '#fff';
          if (!r.error) {
            const s = r.offsetMs / 1000;
            ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
            ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
          }
        }
      });
      refreshRealColumn();
    });

    const rBtns = row(4);
    rBtns.append(btnRec, btnAnalyze);
    secAn.append(rBtns, progWrap);
    body.appendChild(secAn);

    /* ── Seção: Resultados ── */
    const secRes = sec('Resultados');
    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:8px';
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Canal','Offset','Real'].forEach((h, hi) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = `color:#666;font-weight:normal;padding:1px 2px;text-align:${hi === 0 ? 'left' : 'right'}`;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');

    ML.CHANNELS.forEach((ch, i) => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = (i === 0 ? '\u2605 ' : '') + ch.label;
      tdName.style.cssText = `color:${ch.color};padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px`;
      ch._tdName = tdName;

      const tdOff = document.createElement('td');
      tdOff.textContent = '--';
      tdOff.style.cssText = 'color:#fff;padding:1px 2px;text-align:right;white-space:nowrap';

      const tdReal = document.createElement('td');
      tdReal.textContent = '--';
      tdReal.style.cssText = 'color:#fff;padding:1px 2px;text-align:right;white-space:nowrap';

      ch.offsetEl = tdOff;
      ch.realEl   = tdReal;
      tr.append(tdName, tdOff, tdReal);
      tbody.appendChild(tr);
    });

    tbl.appendChild(tbody);
    secRes.appendChild(tbl);

    const btnCopy = mkBtn('\ud83d\udccb Copiar Resultados', '#0d47a1', 'width:100%;margin-top:3px;padding:2px 0;font-size:9px');
    btnCopy.addEventListener('click', () => copyResults(btnCopy));
    secRes.appendChild(btnCopy);

    body.appendChild(secRes);
    panel.appendChild(body);
    document.body.appendChild(panel);

    /* posição inicial */
    requestAnimationFrame(() => {
      const pos = clampPos(
        window.innerWidth - panel.offsetWidth - 16,
        40,
        panel.offsetWidth,
        panel.offsetHeight
      );
      panel.style.left = pos.left + 'px';
      panel.style.top  = pos.top  + 'px';
      panel.style.right = 'auto';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
