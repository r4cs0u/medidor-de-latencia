(function () {
  const ML = window.MedLat;

  // ── Paleta dark (única, fixa) ──────────────────────────────────────────

  const DARK = {
    panelBg:      '#0a0a0a',
    panelBorder:  '#2a2a2a',
    headerBg:     '#111111',
    headerBorder: '#1e1e1e',
    sectionBorder:'#222222',
    rowBorder:    '#1e1e1e',
    inputBg:      '#141414',
    inputBorder:  '#333333',
    inputColor:   '#f0f0f0',
    accentColor:  '#00d4ff',
    textPrimary:  '#f0f0f0',
    textMuted:    '#b0b0b0',
    textLabel:    '#d0d0d0',
    textSection:  '#ffffff',
    selectBg:     '#141414',
    selectBorder: '#333333',
    selectColor:  '#f0f0f0',
    btnBg:        '#1e1e1e',
    btnBorder:    '#333333',
    btnColor:     '#00d4ff',
    widgetBg:     '#0a0a0a',
    widgetBorder: '#00d4ff',
    statusColor:  '#f0f0f0',
  };

  ML.ui = ML.ui || {};
  ML.ui.T = Object.assign({}, DARK);

  // ── CSS global injetado ────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('ml-styles')) return;
    const s = document.createElement('style');
    s.id = 'ml-styles';
    const t = ML.ui.T;
    s.textContent = `
      @keyframes mlPulse {
        0%,100% { box-shadow: 0 0 6px #c62828aa; border-color: #c62828; }
        50%      { box-shadow: 0 0 14px #ff0000cc; border-color: #ff4444; }
      }
      #ml-widget { transition: transform .1s; }
      #ml-widget:hover { transform: scale(1.1); }
      .ml-sz-inp { -moz-appearance: textfield; }
      .ml-sz-inp::-webkit-inner-spin-button,
      .ml-sz-inp::-webkit-outer-spin-button { display:none; }

      #ml-panel ::-webkit-scrollbar,
      #ml-tips ::-webkit-scrollbar,
      #ml-guide ::-webkit-scrollbar,
      #ml-chart-overlay ::-webkit-scrollbar { width:4px; }
      #ml-panel ::-webkit-scrollbar-track,
      #ml-tips ::-webkit-scrollbar-track,
      #ml-guide ::-webkit-scrollbar-track,
      #ml-chart-overlay ::-webkit-scrollbar-track { background:${t.panelBg}; }
      #ml-panel ::-webkit-scrollbar-thumb,
      #ml-tips ::-webkit-scrollbar-thumb,
      #ml-guide ::-webkit-scrollbar-thumb,
      #ml-chart-overlay ::-webkit-scrollbar-thumb { background:${t.inputBorder};border-radius:2px; }

      .ml-resize-handle {
        position:absolute;z-index:10;
      }
      .ml-resize-n  { top:-4px;left:4px;right:4px;height:8px;cursor:n-resize; }
      .ml-resize-s  { bottom:-4px;left:4px;right:4px;height:8px;cursor:s-resize; }
      .ml-resize-e  { right:-4px;top:4px;bottom:4px;width:8px;cursor:e-resize; }
      .ml-resize-w  { left:-4px;top:4px;bottom:4px;width:8px;cursor:w-resize; }
      .ml-resize-ne { top:-4px;right:-4px;width:12px;height:12px;cursor:ne-resize; }
      .ml-resize-nw { top:-4px;left:-4px;width:12px;height:12px;cursor:nw-resize; }
      .ml-resize-se { bottom:-4px;right:-4px;width:12px;height:12px;cursor:se-resize; }
      .ml-resize-sw { bottom:-4px;left:-4px;width:12px;height:12px;cursor:sw-resize; }
    `;
    document.head.appendChild(s);
  }

  // ── CSS do slider ──────────────────────────────────────────────────────

  function injectSliderCSS() {
    if (document.getElementById('ml-slider-css')) return;
    const st = document.createElement('style');
    st.id = 'ml-slider-css';
    st.textContent = `
      .ml-slider { -webkit-appearance:none;appearance:none;height:6px;border-radius:0;outline:none;cursor:pointer; }
      .ml-slider::-webkit-slider-runnable-track {
        height:6px;border-radius:0;
        background:repeating-linear-gradient(90deg,#2a3a50 0px,#2a3a50 1px,transparent 1px,transparent 10%),#1a2a3a;
      }
      .ml-slider::-moz-range-track {
        height:6px;border-radius:0;
        background:repeating-linear-gradient(90deg,#2a3a50 0px,#2a3a50 1px,transparent 1px,transparent 10%),#1a2a3a;
      }
      .ml-slider::-webkit-slider-thumb {
        -webkit-appearance:none;appearance:none;width:10px;height:18px;
        border-radius:2px;background:#00d4ff;border:1px solid #007a99;cursor:grab;margin-top:-6px;
      }
      .ml-slider::-moz-range-thumb {
        width:10px;height:18px;border-radius:2px;background:#00d4ff;border:1px solid #007a99;cursor:grab;
      }
      .ml-slider:active::-webkit-slider-thumb { cursor:grabbing;background:#44eeff; }
      .ml-slider:active::-moz-range-thumb     { cursor:grabbing;background:#44eeff; }
    `;
    document.head.appendChild(st);
  }

  // ── Geometria ──────────────────────────────────────────────────────────

  function clampPos(left, top, elW, elH) {
    return {
      left: Math.max(0, Math.min(left, window.innerWidth  - elW)),
      top:  Math.max(0, Math.min(top,  window.innerHeight - elH)),
    };
  }

  function positionNearPanel(el, anchorPanel) {
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      const pr  = anchorPanel.getBoundingClientRect();
      const elW = el.offsetWidth, elH = el.offsetHeight;
      const vw  = window.innerWidth, vh = window.innerHeight, mg = 6;
      let left = pr.left - elW - mg;
      let top  = pr.top;
      if (left < mg)            left = pr.right + mg;
      if (left + elW > vw - mg) left = mg;
      if (top  + elH > vh - mg) top  = Math.max(mg, vh - elH - mg);
      el.style.left = left + 'px';
      el.style.top  = top  + 'px';
    });
  }

  // ── Redimensionamento por handles ──────────────────────────────────────

  function makeResizable(el, { minW = 200, minH = 100, onResize } = {}) {
    el.style.position = 'fixed';

    const dirs = ['n','s','e','w','ne','nw','se','sw'];
    dirs.forEach(dir => {
      const h = document.createElement('div');
      h.className = `ml-resize-handle ml-resize-${dir}`;
      el.appendChild(h);

      let startX, startY, startW, startH, startLeft, startTop;

      h.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        const rect = el.getBoundingClientRect();
        startX    = e.clientX;
        startY    = e.clientY;
        startW    = rect.width;
        startH    = rect.height;
        startLeft = rect.left;
        startTop  = rect.top;

        function onMove(ev) {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let newW = startW, newH = startH, newL = startLeft, newT = startTop;

          if (dir.includes('e')) newW = Math.max(minW, startW + dx);
          if (dir.includes('s')) newH = Math.max(minH, startH + dy);
          if (dir.includes('w')) { newW = Math.max(minW, startW - dx); newL = startLeft + (startW - newW); }
          if (dir.includes('n')) { newH = Math.max(minH, startH - dy); newT = startTop  + (startH - newH); }

          el.style.width  = newW + 'px';
          el.style.height = newH + 'px';
          el.style.left   = newL + 'px';
          el.style.top    = newT + 'px';
          el.style.right  = 'auto';
          el.style.bottom = 'auto';

          if (onResize) onResize(newW, newH);
        }

        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  }

  // ── Janela arrastável genérica ─────────────────────────────────────────

  function makeDraggableWindow(id, titleText, titleColor, width) {
    const t = ML.ui.T;
    const win = document.createElement('div');
    win.id = id;
    win.style.cssText = [
      'position:fixed;z-index:99998',
      `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      `font-family:monospace;font-size:10px;color:${t.textPrimary}`,
      `width:${width}px;overflow:hidden`,
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:4px 8px;cursor:move',
      `background:${t.headerBg};border-bottom:1px solid ${t.headerBorder}`,
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
      if (e.target === btnClose) return;
      drag = true;
      const rect = win.getBoundingClientRect();
      win.style.left   = rect.left + 'px';
      win.style.top    = rect.top  + 'px';
      win.style.right  = 'auto';
      win.style.bottom = 'auto';
      ox = e.clientX - rect.left;
      oy = e.clientY - rect.top;
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

  // ── Intervalo real do buffer ───────────────────────────────────────────

  function realIvMs(ch) {
    if (ch.buffer && ch.buffer.length > 1) {
      const iv = (ch.buffer[ch.buffer.length - 1].ts - ch.buffer[0].ts) / (ch.buffer.length - 1);
      if (iv >= 10 && iv <= 200) return iv;
    }
    return ML.INTERVAL_MS;
  }

  // ── Som de conclusão ───────────────────────────────────────────────────

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

  // ── Dedução ────────────────────────────────────────────────────────────

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

  // ── Cor por valor de offset ────────────────────────────────────────────

  function colorByOffset(absS) {
    if (absS < 0.1) return '#44ff88';
    if (absS < 1)   return '#ffd700';
    return '#ff8844';
  }

  // ── Cópia de resultados ────────────────────────────────────────────────

  function fallbackCopy(text, btn, orig) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
    btn.innerHTML = '\u2714';
    btn.style.background = '#0d4f3c'; btn.style.color = '#44ff88';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = ML.ui.T.accentColor; }, 1500);
  }

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
        btn.style.background = '#0d4f3c'; btn.style.color = '#44ff88';
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = ML.ui.T.accentColor; }, 1500);
      }).catch(() => fallbackCopy(text, btn, orig));
    } catch(e) { fallbackCopy(text, btn, orig); }
  }

  // ── Widget minimizado ──────────────────────────────────────────────────

  function minimizePanel(panel) {
    const secondaryIds = ['ml-tips', 'ml-guide', 'ml-chart-overlay', 'ml-chart-panel'];
    const savedWindows = [];
    secondaryIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        const rect = el.getBoundingClientRect();
        savedWindows.push({
          id,
          left:    rect.left + 'px',
          top:     rect.top  + 'px',
          width:   el.style.width  || '',
          height:  el.style.height || '',
          display: el.style.display || 'block',
        });
        el.style.display = 'none';
      }
    });

    panel.style.display = 'none';

    const t = ML.ui.T;
    const widget = document.createElement('div');
    widget.id = 'ml-widget';
    widget.title = 'Restaurar Analisador de Lat\u00eancia';
    widget.innerHTML = '\ud83d\udd50';

    const panelRect = panel.getBoundingClientRect();
    widget.style.cssText = [
      `position:fixed;left:${Math.max(4, panelRect.left)}px;top:${Math.max(4, panelRect.top)}px;z-index:999999`,
      'width:32px;height:32px;border-radius:8px',
      `background:${t.widgetBg};border:2px solid ${t.widgetBorder}`,
      'display:flex;align-items:center;justify-content:center',
      'font-size:16px;cursor:pointer;user-select:none',
      'box-shadow:0 2px 12px #000a',
    ].join(';');

    function syncPulse() {
      if (ML.state && ML.state.recording) {
        widget.style.animation = 'mlPulse 1s ease-in-out infinite';
        widget.style.borderColor = '#c62828';
      } else {
        widget.style.animation = '';
        widget.style.borderColor = t.widgetBorder;
      }
    }
    syncPulse();
    const pulseTimer = setInterval(syncPulse, 500);

    let wdrag = false, wx = 0, wy = 0;

    function onWMove(e) {
      if (!wdrag) return;
      widget.style.right = 'auto';
      const pos = clampPos(e.clientX - wx, e.clientY - wy, widget.offsetWidth, widget.offsetHeight);
      widget.style.left = pos.left + 'px';
      widget.style.top  = pos.top  + 'px';
    }

    function onWUp(e) {
      window.removeEventListener('mousemove', onWMove);
      window.removeEventListener('mouseup', onWUp);
      if (!wdrag) {
        clearInterval(pulseTimer);
        widget.remove();
        panel.style.display = 'flex';
        savedWindows.forEach(s => {
          const el = document.getElementById(s.id);
          if (!el) return;
          el.style.left    = s.left;
          el.style.top     = s.top;
          el.style.right   = 'auto';
          el.style.bottom  = 'auto';
          if (s.width)  el.style.width  = s.width;
          if (s.height) el.style.height = s.height;
          el.style.display = s.display;
        });
      }
      wdrag = false;
    }

    widget.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      wdrag = false;
      const wrect = widget.getBoundingClientRect();
      wx = e.clientX - wrect.left;
      wy = e.clientY - wrect.top;
      const startX = e.clientX, startY = e.clientY;

      function onMoveDrag(ev) {
        if (!wdrag && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) {
          wdrag = true;
        }
        onWMove(ev);
      }

      window.addEventListener('mousemove', onMoveDrag);
      window.addEventListener('mouseup', function onUp(ev) {
        window.removeEventListener('mousemove', onMoveDrag);
        window.removeEventListener('mouseup', onUp);
        onWUp(ev);
      });
    });

    document.body.appendChild(widget);
  }

  // ── Helpers DOM ────────────────────────────────────────────────────────

  function mkIconBtn(icon, title, color) {
    const b = document.createElement('button');
    b.innerHTML = icon;
    b.title = title;
    b.style.cssText = `background:transparent;border:1px solid ${color}44;color:${color};border-radius:3px;padding:0 5px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0;font-weight:bold`;
    b.addEventListener('mouseenter', () => b.style.background = color + '22');
    b.addEventListener('mouseleave', () => b.style.background = 'transparent');
    return b;
  }

  function mkBtn(txt, bg, extra) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = `background:${bg};border:1px solid ${bg}55;color:#fff;border-radius:3px;padding:2px 4px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;${extra || ''}`;
    return b;
  }

  function mkNum(val, min, max, step, w) {
    const t = ML.ui.T;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    inp.className = 'ml-sz-inp'; // suprime setas nativas (webkit + moz)
    inp.style.cssText = `background:${t.inputBg};border:1px solid ${t.inputBorder};color:${t.textPrimary};font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
    inp.addEventListener('focus', () => inp.style.borderColor = t.inputBorder + 'cc');
    inp.addEventListener('blur',  () => inp.style.borderColor = t.inputBorder);
    return inp;
  }

  // ── Toggle (botão liga/desliga) ────────────────────────────────────────
  // Aceita duas assinaturas:
  //   mkToggle(initialState, onChange)              ← usada pelo 50-panel
  //   mkToggle(labelOn, labelOff, initialState, onChange)  ← forma extendida

  function mkToggle(a, b, c, d) {
    const t = ML.ui.T;
    let labelOn, labelOff, initialState, onChange;

    if (typeof a === 'boolean' || (typeof a !== 'string' && typeof a !== 'undefined' && typeof b === 'function')) {
      // assinatura curta: mkToggle(initialState, onChange)
      initialState = !!a;
      onChange     = typeof b === 'function' ? b : null;
      labelOn  = '\u25cf ON';
      labelOff = '\u25cb OFF';
    } else {
      // assinatura longa: mkToggle(labelOn, labelOff, initialState, onChange)
      labelOn      = a || '\u25cf ON';
      labelOff     = b || '\u25cb OFF';
      initialState = !!c;
      onChange     = typeof d === 'function' ? d : null;
    }

    let state = initialState;
    const btn = document.createElement('button');

    function render() {
      btn.textContent = state ? labelOn : labelOff;
      btn.style.cssText = [
        `background:${state ? t.accentColor + '22' : t.btnBg}`,
        `border:1px solid ${state ? t.accentColor : t.btnBorder}`,
        `color:${state ? t.accentColor : t.btnColor}`,
        'border-radius:3px;padding:1px 5px;cursor:pointer',
        'font-size:8px;font-family:monospace;font-weight:bold;white-space:nowrap;flex-shrink:0',
      ].join(';');
    }

    render();
    btn.addEventListener('click', () => {
      state = !state;
      render();
      if (onChange) onChange(state);
    });
    btn.getValue = () => state;
    btn.setValue = (v) => { state = !!v; render(); };
    return btn;
  }

  function sec(label, extraContent) {
    const t = ML.ui.T;
    const wrap = document.createElement('div');
    wrap.style.cssText = `padding:4px 8px;border-bottom:1px solid ${t.sectionBorder};flex-shrink:0`;
    const lh = document.createElement('div');
    lh.style.cssText = `display:flex;align-items:center;justify-content:space-between;font-size:7px;color:${t.textSection};letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid ${t.sectionBorder};padding-bottom:2px;margin-bottom:4px`;
    const lhText = document.createElement('span');
    lhText.textContent = label;
    lh.appendChild(lhText);
    if (extraContent) lh.appendChild(extraContent);
    wrap.appendChild(lh);
    return wrap;
  }

  function row(gap) {
    const d = document.createElement('div');
    d.style.cssText = `display:flex;align-items:center;gap:${gap || 4}px;overflow:hidden`;
    return d;
  }

  function sp(txt, extra) {
    const t = ML.ui.T;
    const s = document.createElement('span');
    s.textContent = txt;
    s.style.cssText = `font-size:9px;color:${t.textLabel};white-space:nowrap;` + (extra || '');
    return s;
  }

  // ── Init ─────────────────────────────────────────────────────────────

  injectStyles();

  // ── Expose ─────────────────────────────────────────────────────────────

  Object.assign(ML.ui, {
    DARK,
    injectStyles,
    clampPos, positionNearPanel,
    makeDraggableWindow,
    makeResizable,
    injectSliderCSS, realIvMs,
    playDone,
    parseDeductionS, formatDeduction, colorByOffset,
    fallbackCopy, copyResults,
    minimizePanel,
    mkIconBtn, mkBtn, mkNum, mkToggle, sec, row, sp,
  });

  console.log('[MedLat] 15-ui-utils carregado (dark fixo). mkNum com ml-sz-inp: setas nativas ocultas.');
})();
