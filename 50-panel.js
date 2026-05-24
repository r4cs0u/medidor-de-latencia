(function () {
  const ML = window.MedLat;

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

  /* ── Injetar keyframes pulse ── */
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
    `;
    document.head.appendChild(s);
  })();

  /* ── helper: janela arrastável genérica ── */
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
    hdr.addEventListener('mousedown', e => { drag = true; ox = e.clientX - win.offsetLeft; oy = e.clientY - win.offsetTop; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!drag) return; win.style.left = Math.max(0, e.clientX - ox) + 'px'; win.style.top = Math.max(0, e.clientY - oy) + 'px'; });
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

  /* ── Boas Práticas ── */
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

  /* ── Instruções de Uso ── */
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
        '5. Selecione o lag estimado: "At\u00e9 5s" ou "Maior que 5s"',
      ]},
      { section: '\u23fa  GRAVA\u00c7\u00c3O', color: '#44ff88', items: [
        '6. Clique em \u25cf GRAVAR \u2014 a an\u00e1lise inicia sozinha ao terminar (~2 min)',
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

  /* ── Parser de dedução ── */
  function parseDeductionS(str) {
    if (!str) return null;
    const norm = str.trim()
      .replace(/\u2212/g, '-')
      .replace(/,/g, '.')
      .replace(/\s/g, '');
    const m = norm.match(/^([+-]?\d+(?:\.\d+)?)s$/i);
    if (!m) return null;
    return parseFloat(m[1]);
  }

  function formatDeduction(s) {
    if (s === 0) return '0.000s';
    return (s > 0 ? '+' : '') + s.toFixed(3) + 's';
  }

  /* ── Overlay de visualização da área de busca (restrito à probe) ── */
  function showSearchOverlay(ch) {
    document.querySelectorAll('.ml-search-overlay').forEach(e => e.remove());
    const d = ch.probe;
    if (!d) return;

    const rect   = d.getBoundingClientRect();
    const probeL = rect.left;
    const probeW = rect.width;
    const cy     = rect.top + rect.height / 2;
    const vh     = window.innerHeight;
    const halfVh = Math.round(vh / 2);

    // Faixa ACIMA: do topo da probe até vh/2 acima do centro
    const topAbove = Math.max(0, cy - halfVh);
    const htAbove  = rect.top - topAbove;

    // Faixa ABAIXO: do fundo da probe até vh/2 abaixo do centro
    const topBelow = rect.bottom;
    const htBelow  = Math.min(vh, cy + halfVh) - topBelow;

    [
      { top: topAbove, height: htAbove,  label: '▲ pesquisa' },
      { top: topBelow, height: htBelow,  label: '▼ pesquisa' },
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

  /* ── Auto-detect de dedução ── */
  function autoDetectDeduction(ch) {
    if (!ch.probe) return null;
    const d = ch.probe;
    const cy = d.offsetTop  + d.offsetHeight / 2;

    // Busca apenas vertical: metade da viewport acima e abaixo
    const RADIUS_Y = Math.round(window.innerHeight / 2);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || p.closest('[id^="ml-"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    // Sinal obrigatório no início, "s" obrigatório no final
    const RE = /([+\-\u2212]\d+[.,]\d+s|[+\-\u2212]\d+s)/g;
    let best = null, bestDist = Infinity;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent;
      let m;
      RE.lastIndex = 0;
      while ((m = RE.exec(text)) !== null) {
        try {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rect = range.getBoundingClientRect();
          if (!rect.width) continue;
          const ry = rect.top + rect.height / 2;
          const dy = Math.abs(ry - cy);
          // Apenas restrição vertical — sem restrição horizontal
          if (dy > RADIUS_Y) continue;
          if (dy < bestDist) { bestDist = dy; best = m[0]; }
        } catch(e) {}
      }
    }
    return best;
  }

  /* ── Copiar tabela de resultados ── */
  function copyResults(btn) {
    const lines = ML.CHANNELS
      .filter(ch => ch.active)
      .map((ch, i) => {
        const name   = (i === 0 ? '\u2605 REF' : ch.label).padEnd(12);
        const offset = ch.offsetEl ? ch.offsetEl.textContent : '--';
        const real   = ch.realEl   ? ch.realEl.textContent   : '--';
        return name + '\t' + offset + '\t' + real;
      });
    const text = 'Tela\t\tResultado\tReal\n' + lines.join('\n');
    const orig = btn.innerHTML;
    try {
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '\u2714';
        btn.style.background = '#0d4f3c';
        btn.style.color = '#44ff88';
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = '#00d4ff'; }, 1500);
      }).catch(() => fallbackCopy(text, btn, orig));
    } catch(e) {
      fallbackCopy(text, btn, orig);
    }
  }

  function fallbackCopy(text, btn, orig) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
    btn.innerHTML = '\u2714';
    btn.style.background = '#0d4f3c';
    btn.style.color = '#44ff88';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = '#00d4ff'; }, 1500);
  }

  /* ── Recalcula coluna Real ── */
  function refreshRealColumn() {
    const refDed = ML.CHANNELS[0].deduction || 0;
    ML.CHANNELS.forEach((ch, i) => {
      if (!ch.realEl) return;
      if (i === 0) {
        ch.realEl.textContent = '0.000s';
        ch.realEl.style.color = '#44ff88';
        return;
      }
      if (!ch.offsetEl || ch.offsetEl.textContent === '--' || ch.offsetEl.textContent === 'ERRO') {
        ch.realEl.textContent = '--';
        ch.realEl.style.color = '#fff';
        return;
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

  /* ── Minimizar / Restaurar ── */
  function minimizePanel(panel) {
    panel.style.display = 'none';

    const widget = document.createElement('div');
    widget.id = 'ml-widget';
    widget.title = 'Restaurar Analisador de Lat\u00eancia';
    widget.innerHTML = '\ud83d\udd50';
    widget.style.cssText = [
      'position:fixed;top:8px;right:8px;z-index:999999',
      'width:32px;height:32px;border-radius:8px',
      'background:#12121fee;border:2px solid #00d4ff',
      'display:flex;align-items:center;justify-content:center',
      'font-size:16px;cursor:pointer;user-select:none',
      'box-shadow:0 2px 12px #000a',
    ].join(';');

    /* pulso vermelho se gravando */
    function syncPulse() {
      if (ML.state && ML.state.recording) {
        widget.style.animation = 'mlPulse 1s ease-in-out infinite';
        widget.style.borderColor = '#c62828';
      } else {
        widget.style.animation = '';
        widget.style.borderColor = '#00d4ff';
      }
    }
    syncPulse();
    const pulseTimer = setInterval(syncPulse, 500);

    /* arrastar widget — listeners nomeados para remoção correta */
    let wdrag = false, wx = 0, wy = 0;

    function onWMove(e) {
      if (!wdrag) return;
      widget.style.right = 'auto';
      widget.style.left = Math.max(0, e.clientX - wx) + 'px';
      widget.style.top  = Math.max(0, e.clientY - wy) + 'px';
    }

    function onWUp() {
      if (!wdrag) {
        /* foi um clique: restaurar painel */
        clearInterval(pulseTimer);
        window.removeEventListener('mousemove', onWMove);
        window.removeEventListener('mouseup', onWUp);
        widget.remove();
        panel.style.display = 'block';
      }
      wdrag = false;
    }

    widget.addEventListener('mousedown', e => {
      e.stopPropagation();   /* impede que pdrag do painel capture o evento */
      e.preventDefault();
      wdrag = false;
      wx = e.clientX - widget.offsetLeft;
      wy = e.clientY - widget.offsetTop;

      function onMoveOnce(ev) {
        if (Math.hypot(ev.clientX - (wx + widget.offsetLeft), ev.clientY - (wy + widget.offsetTop)) > 4) {
          wdrag = true;
        }
      }
      window.addEventListener('mousemove', onMoveOnce, { once: false });
      /* guarda ref para remover junto */
      widget._onMoveOnce = onMoveOnce;
      window.addEventListener('mousemove', onWMove);
      window.addEventListener('mouseup', onWUp, { once: true });
    });

    document.body.appendChild(widget);
  }

  function init() {
    ['ml-panel', 'ml-chart-overlay', 'ml-tips', 'ml-guide', 'ml-widget'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const vw = window.innerWidth;
    const panelW = Math.round(Math.max(286, Math.min(390, vw * 0.18)));

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;right:8px;z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#fff',
      `user-select:none;width:${panelW}px;overflow:hidden`,
    ].join(';');

    /* ── Header ── */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:4px;overflow:hidden',
      'padding:4px 8px;cursor:move',
      'border-bottom:1px solid #1e1e3a',
      'background:#1a1a2e;border-radius:6px 6px 0 0',
    ].join(';');

    const ttl = document.createElement('span');
    ttl.textContent = '\u{1F550} ANALISADOR DE LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';

    function mkIconBtn(icon, title, color) {
      const b = document.createElement('button');
      b.innerHTML = icon;
      b.title = title;
      b.style.cssText = `background:transparent;border:1px solid ${color}44;color:${color};border-radius:3px;padding:0 5px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0;font-weight:bold`;
      b.addEventListener('mouseenter', () => b.style.background = color + '22');
      b.addEventListener('mouseleave', () => b.style.background = 'transparent');
      return b;
    }

    const btnTips  = mkIconBtn('\ud83d\udca1', 'Dicas para uma medi\u00e7\u00e3o precisa', '#ffd700');
    const btnGuide = mkIconBtn('\ud83d\udccb', 'Passo a passo de uso do medidor', '#00d4ff');
    const btnMin   = mkIconBtn('\u2212', 'Minimizar para widget', '#aaaaaa');
    const btnX     = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.title = 'Fechar o medidor';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnX.onclick = () => { ML.recorder.stop(); document.querySelectorAll('[id^="ml-"], .ml-search-overlay').forEach(e => e.remove()); };

    btnTips.onclick  = () => toggleTips(panel);
    btnGuide.onclick = () => toggleGuide(panel);
    btnMin.onclick   = () => minimizePanel(panel);

    hdr.append(ttl, btnTips, btnGuide, btnMin, btnX);
    panel.appendChild(hdr);

    /* Drag do painel — só ativa se o alvo for o header ou o título */
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== ttl) return;
      pdrag = true;
      panel.style.right = 'auto';
      pox = e.clientX - panel.offsetLeft;
      poy = e.clientY - panel.offsetTop;
    });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    /* ── Helpers ── */
    function sec(label, extraContent) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:4px 8px;border-bottom:1px solid #1a1a30';
      const lh = document.createElement('div');
      lh.style.cssText = 'display:flex;align-items:center;justify-content:space-between;font-size:7px;color:#fff;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #1a1a30;padding-bottom:2px;margin-bottom:4px';
      const lhText = document.createElement('span');
      lhText.textContent = label;
      lh.appendChild(lhText);
      if (extraContent) lh.appendChild(extraContent);
      wrap.appendChild(lh);
      return wrap;
    }
    function row(gap) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;align-items:center;gap:${gap||4}px;overflow:hidden`;
      return d;
    }
    function sp(txt, extra) {
      const s = document.createElement('span');
      s.textContent = txt;
      s.style.cssText = 'font-size:9px;color:#fff;white-space:nowrap;' + (extra || '');
      return s;
    }
    function mkBtn(txt, bg, extra) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}55;color:#fff;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;${extra||''}`;
      return b;
    }
    function mkNum(val, min, max, step, w) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      inp.style.cssText = `background:#111827;border:1px solid #2a3a50;color:#00d4ff;font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
      inp.addEventListener('focus', () => inp.style.borderColor = '#00d4ff88');
      inp.addEventListener('blur',  () => inp.style.borderColor = '#2a3a50');
      return inp;
    }

    function mkLagSelect(ch) {
      const sel = document.createElement('select');
      sel.title = 'Faixa de atraso esperada em rela\u00e7\u00e3o \u00e0 refer\u00eancia';
      sel.style.cssText = [
        'background:#111827;border:1px solid #2a3a50;color:#fff',
        'font:bold 8px monospace;border-radius:3px;padding:1px 2px',
        'cursor:pointer;outline:none;width:100%',
      ].join(';');
      const opts = [
        { value: 'auto',     label: 'Auto' },
        { value: 'rapido',   label: 'At\u00e9 5s' },
        { value: 'internet', label: '> 5s' },
      ];
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if ((ch.lagPreset || 'auto') === o.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        ch.lagPreset = sel.value;
        sel.style.borderColor = sel.value === 'auto' ? '#2a3a50' : '#ffd70088';
        sel.style.color       = sel.value === 'auto' ? '#fff'    : '#ffd700';
      });
      if ((ch.lagPreset || 'auto') !== 'auto') {
        sel.style.borderColor = '#ffd70088';
        sel.style.color       = '#ffd700';
      }
      return sel;
    }

    function mkDeductionInput(ch) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = '0.000s';
      inp.value = ch.deduction ? formatDeduction(ch.deduction) : '';
      inp.title = 'Offset fixo exibido pelo multiviewer neste canal';
      inp.style.cssText = [
        'background:#111827;border:1px solid #2a3a5088;color:#ff9d00',
        'font:bold 8px monospace;width:100%;box-sizing:border-box;border-radius:3px',
        'padding:1px 3px;text-align:center;outline:none',
      ].join(';');
      inp.addEventListener('focus', () => inp.style.borderColor = '#ff9d0088');
      inp.addEventListener('blur',  () => {
        inp.style.borderColor = '#2a3a5088';
        const v = parseDeductionS(inp.value);
        if (v !== null) {
          ch.deduction = v;
          inp.value = formatDeduction(v);
          inp.style.color = v !== 0 ? '#ff9d00' : '#fff';
        } else if (inp.value.trim() === '' || inp.value === '0' || inp.value === '0.000s') {
          ch.deduction = 0;
          inp.value = '';
          inp.style.color = '#fff';
        }
        refreshRealColumn();
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      ch._dedInp = inp;
      return inp;
    }

    /* ── Seção: Posicionamento ── */
    const secTG = sec('Posicionamento');

    const pxInp = mkNum(ML.state.probeW, 16, 500, 2, 44);
    pxInp.title = 'Tamanho das probes em pixels';
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c;
      pxInp.value = c;
      ML.CHANNELS.forEach(ch => {
        ch.probeW = c;
        if (ch._szInp) ch._szInp.value = c;
        if (ch.active && ch.resize) ch.resize();
      });
    }
    const btnPxM = mkBtn('\u2212', '#1e2a3a', 'padding:2px 5px');
    const btnPxP = mkBtn('+', '#1e2a3a', 'padding:2px 5px');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); } });

    const btnSnap = mkBtn('', '#0d4f3c', 'flex:1;min-width:0');
    btnSnap.title = 'Ativa grade magn\u00e9tica para alinhar probes';
    function updateSnapBtn() { btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF'; btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e'; btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#fff'; }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); }; updateSnapBtn();

    const btnCol = mkBtn('', '#2a1a0d', 'flex:1;min-width:0');
    btnCol.title = 'Evita sobreposi\u00e7\u00e3o entre probes';
    function updateColBtn() { btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF'; btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e'; btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#fff'; }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); }; updateColBtn();

    const rowPos = row(4);
    rowPos.append(sp('PX', 'flex-shrink:0;font-size:8px'), btnPxM, pxInp, btnPxP, btnSnap, btnCol);
    secTG.appendChild(rowPos);
    panel.appendChild(secTG);

    /* ── Seção: Telas (grid 3×N) ── */
    const secDet = sec('Telas');
    const probeGrid = document.createElement('div');
    probeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';

    ML.CHANNELS.forEach((ch, i) => {
      ch.deduction = ch.deduction || 0;

      const card = document.createElement('div');
      /* box-sizing:border-box garante que padding/border não estourem a coluna do grid */
      card.style.cssText = [
        'display:flex;flex-direction:column;gap:2px',
        'padding:3px 4px;border-radius:4px',
        `border:1px solid ${ch.color}55`,
        `background:${ch.color}0d`,
        `border-top:2px solid ${ch.color}99`,
        `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
        'box-sizing:border-box;min-width:0;overflow:hidden;width:100%',
      ].join(';');
      ch._panelRow = card;

      /* linha 1: toggle + label + lum */
      const r1 = row(3);
      r1.style.cssText += ';overflow:hidden;min-width:0';
      const tog = document.createElement('button');
      tog.title = 'Ativar ou desativar esta tela';
      tog.style.cssText = `width:8px;height:8px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.onclick = () => {
        ch.active = !ch.active;
        tog.style.background = ch.active ? ch.color : 'transparent';
        card.style.opacity = ch.active ? 1 : .4;
        ch.probe.style.display = ch.active ? 'block' : 'none';
        if (!ch.active) ch.prevLum = null;
      };

      const lblInp = document.createElement('input');
      lblInp.value = i === 0 ? 'Ref.' : ch.label;
      lblInp.title = 'Clique para renomear a tela';
      lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 8px monospace;flex:1;outline:none;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis;width:0`;
      lblInp.addEventListener('change', () => {
        ch.label = lblInp.value.replace(/^\u2605\s*/, '');
        if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
        if (ch._tdName) ch._tdName.textContent = (i === 0 ? '\u2605 ' : '') + ch.label;
      });

      const lumEl = document.createElement('span');
      lumEl.title = 'Lumin\u00e2ncia atual da probe (0\u2013255)';
      lumEl.style.cssText = `color:${ch.color};font-size:11px;font-weight:bold;flex-shrink:0`;
      lumEl.textContent = '--'; ch.lumEl = lumEl;

      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'display:none';
      ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;

      r1.append(tog, lblInp, lumEl, ptsEl);

      /* linha 2: px — input com width fixo, sem flex:1 para não estourar card */
      const r2 = row(2);
      r2.style.cssText += ';overflow:hidden;min-width:0';
      const szInp = mkNum(ML.state.probeW, 16, 500, 2, 34);
      szInp.title = 'Tamanho desta probe em pixels';
      /* NÃO usar flex:1 — mantém width:34px definido em mkNum */
      ch._szInp = szInp;
      function applyChanPx(v) { const c = Math.max(16, Math.min(500, Math.round(v/2)*2)); ch.probeW = c; szInp.value = c; if (ch.active && ch.resize) ch.resize(); }
      const szM = mkBtn('\u2212', '#1e2a3a', 'padding:1px 3px;font-size:8px;flex-shrink:0');
      const szP = mkBtn('+',    '#1e2a3a', 'padding:1px 3px;font-size:8px;flex-shrink:0');
      szM.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) - 2);
      szP.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) + 2);
      szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
      szInp.addEventListener('keydown', e => {
        if (e.key==='Enter')     { e.preventDefault(); applyChanPx(parseInt(szInp.value)||ML.state.probeW); szInp.blur(); }
        if (e.key==='ArrowUp')   { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)+2); }
        if (e.key==='ArrowDown') { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)-2); }
      });
      r2.append(sp('px','font-size:7px;color:#aaa;flex-shrink:0'), szM, szInp, szP);

      /* linha 3: dedução */
      const r3ded = row(2);
      r3ded.style.cssText += ';overflow:hidden;min-width:0';
      const dedInp = mkDeductionInput(ch);
      const btnAuto = document.createElement('button');
      btnAuto.innerHTML = '\ud83d\udd0d';
      btnAuto.title = 'Detectar dedu\u00e7\u00e3o automaticamente';
      btnAuto.style.cssText = 'background:#1e2a3a;border:1px solid #ff9d0044;color:#ff9d00;border-radius:3px;padding:0 3px;cursor:pointer;font-size:9px;line-height:15px;flex-shrink:0';
      btnAuto.onclick = () => {
        showSearchOverlay(ch);
        const found = autoDetectDeduction(ch);
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
      };
      r3ded.append(sp('ded','font-size:7px;color:#ff9d00;flex-shrink:0'), dedInp, btnAuto);

      /* linha 4: lag (só canais não-ref) */
      const rows = [r1, r2, r3ded];
      if (i !== 0) {
        const r4lag = row(2);
        r4lag.style.cssText += ';overflow:hidden;min-width:0';
        const lagSel = mkLagSelect(ch);
        r4lag.append(sp('lag','font-size:7px;color:#aaa;flex-shrink:0'), lagSel);
        rows.push(r4lag);
      }

      rows.forEach(r => card.appendChild(r));
      probeGrid.appendChild(card);
    });

    secDet.appendChild(probeGrid);

    /* auto-detect dedução ao soltar mouse após arrastar */
    window.addEventListener('mouseup', () => {
      ML.CHANNELS.forEach(ch => {
        if (!ch.active || !ch._dedInp) return;
        if (ch._dedInp.value.trim() !== '') return;
        const found = autoDetectDeduction(ch);
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
    const btnRec     = mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:3px 0;font-size:10px;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:3px 0;font-size:10px;letter-spacing:.04em;color:#ce93d8;opacity:.45');
    btnRec.title     = 'Inicia a captura de lumin\u00e2ncia (~2 min)';
    btnAnalyze.title = 'Calcula a lat\u00eancia com base nos dados gravados';

    function doStop() {
      ML.recorder.stop();
      playDone();
      btnRec.textContent = '\u25cf GRAVAR';
      btnRec.style.background = '#1b5e20'; btnRec.style.borderColor = '#2e7d3288'; btnRec.style.boxShadow = '0 0 8px #1b5e2066';
      const pts = ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ');
      statusEl.textContent = 'Pronto (' + pts + ')';
      statusEl.style.color = '#ffd700';
      btnAnalyze.disabled = false;
      setTimeout(() => btnAnalyze.onclick(), 300);
    }

    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#7f0000'; btnRec.style.borderColor = '#c6282888'; btnRec.style.boxShadow = '0 0 8px #c6282855';
        statusEl.textContent = 'Gravando...'; statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach((ch, i) => {
          ch._prevPts   = 0;
          ch._stableCnt = 0;
          if (ch.ptsEl) { ch.ptsEl.textContent = '0pt'; ch.ptsEl.style.color = '#fff'; }
          if (i !== 0) {
            if (ch.offsetEl) { ch.offsetEl.textContent = '--'; ch.offsetEl.style.color = '#fff'; }
            if (ch.realEl)   { ch.realEl.textContent   = '--'; ch.realEl.style.color   = '#fff'; }
          }
        });
      } else {
        doStop();
      }
    };

    btnAnalyze.onclick = () => {
      statusEl.textContent = 'Calculando...'; statusEl.style.color = '#fff';
      setTimeout(() => {
        const results = ML.correlator.analyzeBestAll();
        results.forEach(r => {
          const ch = r.channel;
          if (!ch || r.isReference) return;
          if (ch.offsetEl) {
            if (r.skipped || r.error) {
              ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
              ch.offsetEl.style.color = r.error ? '#ff4444' : '#fff';
            } else {
              const s = r.offsetMs / 1000;
              ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
              ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
            }
          }
        });
        refreshRealColumn();
        if (ML.chart && ML.chart.show) ML.chart.show(results);
        const errs = results.filter(r => r.error);
        statusEl.textContent = errs.length
          ? errs.map(r => r.label + ': ' + r.error).join(' | ')
          : 'An\u00e1lise conclu\u00edda';
        statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
      }, 30);
    };

    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .45 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    const rowBtns = row(6); rowBtns.style.marginBottom = '4px';
    rowBtns.append(btnRec, btnAnalyze);
    secAn.appendChild(rowBtns);
    panel.appendChild(secAn);

    /* ── Seção: Resultados ── */
    const btnCopyInline = document.createElement('button');
    btnCopyInline.innerHTML = '\ud83d\udccb';
    btnCopyInline.title = 'Copiar tabela de resultados para a \u00e1rea de transfer\u00eancia';
    btnCopyInline.style.cssText = 'background:transparent;border:1px solid #00d4ff44;color:#00d4ff;border-radius:3px;padding:0 4px;cursor:pointer;font-size:10px;line-height:14px';
    btnCopyInline.addEventListener('mouseenter', () => btnCopyInline.style.background = '#00d4ff18');
    btnCopyInline.addEventListener('mouseleave', () => btnCopyInline.style.background = 'transparent');
    btnCopyInline.onclick = () => copyResults(btnCopyInline);

    const secRes = sec('Resultados', btnCopyInline);

    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:9px';
    const thead = document.createElement('thead');
    const trH = document.createElement('tr');
    ['Tela','Resultado','Real'].forEach((h, hi) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = `color:#aaa;font-weight:bold;padding:1px ${hi===0?'2px':'4px'};text-align:${hi===0?'left':'center'};border-bottom:1px solid #2a2a4a`;
      trH.appendChild(th);
    });
    thead.appendChild(trH);
    tbl.appendChild(thead);

    const tbody = document.createElement('tbody');
    ML.CHANNELS.forEach((ch, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid #1a1a2a;opacity:${ch.active?1:.4};transition:opacity .2s`;
      ch._panelTr = tr;

      const tdName = document.createElement('td');
      tdName.textContent = (i === 0 ? '\u2605 ' : '') + ch.label;
      tdName.style.cssText = `color:${ch.color};padding:2px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px`;
      ch._tdName = tdName;

      const tdOff = document.createElement('td');
      tdOff.textContent = i === 0 ? '0.000s' : '--';
      tdOff.style.cssText = `color:${i===0?'#44ff88':'#fff'};padding:2px 4px;text-align:center;font-weight:bold`;
      ch.offsetEl = tdOff;

      const tdReal = document.createElement('td');
      tdReal.textContent = i === 0 ? '0.000s' : '--';
      tdReal.style.cssText = `color:${i===0?'#44ff88':'#fff'};padding:2px 4px;text-align:center;font-weight:bold`;
      ch.realEl = tdReal;

      tr.append(tdName, tdOff, tdReal);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    secRes.appendChild(tbl);
    panel.appendChild(secRes);

    /* ── Seção: Status ── */
    const secSt = document.createElement('div');
    secSt.style.cssText = 'padding:3px 8px';
    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:8px;color:#aaa;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    statusEl.textContent = 'Pronto';
    secSt.appendChild(statusEl);
    panel.appendChild(secSt);

    /* ── Posicionar painel ── */
    document.body.appendChild(panel);
    panel.style.right = '8px';
    panel.style.top   = '8px';

    /* ── Atualizar lum no painel ── */
    setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (!ch.active || !ch.lumEl) return;
        const y = ML.getLum ? ML.getLum(ch) : null;
        if (y === null)      { ch.lumEl.textContent = '--';  ch.lumEl.style.color = ch.color; }
        else if (y === -1)   { ch.lumEl.textContent = '\ud83d\udd12'; ch.lumEl.style.color = '#ff4444'; }
        else                 { ch.lumEl.textContent = Math.round(y); ch.lumEl.style.color = ch.color; }
      });
    }, 200);

    /* ── Timer de gravação ── */
    const MAX_REC_MS = ML.state.maxRecMs || 120000;
    setInterval(() => {
      if (!ML.state.recording) return;
      ML.CHANNELS.forEach((ch, i) => {
        if (!ch.active || !ch.ptsEl) return;
        const pts = ch.buffer ? ch.buffer.length : 0;
        ch.ptsEl.textContent = pts + 'pt';
        const stable = pts === (ch._prevPts || 0);
        ch._stableCnt = stable ? (ch._stableCnt || 0) + 1 : 0;
        ch._prevPts = pts;
        ch.ptsEl.style.color = ch._stableCnt > 3 ? '#ff8844' : '#44ff88';
      });
      const elapsed = Date.now() - (ML.state.recStartTime || Date.now());
      if (elapsed >= MAX_REC_MS) doStop();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[MedLat] 50-panel carregado.');
})();
