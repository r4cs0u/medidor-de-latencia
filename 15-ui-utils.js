(function () {
  const ML = window.MedLat;

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

  // ── Janela arrastável genérica ─────────────────────────────────────────

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

  // Aceita: "3", "-3", "+3", "3.5", "3,5", "-1.2s", "+0.5s", etc.
  // Sem sinal explícito → negativo por padrão
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
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = '#00d4ff'; }, 1500);
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
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = 'transparent'; btn.style.color = '#00d4ff'; }, 1500);
      }).catch(() => fallbackCopy(text, btn, orig));
    } catch(e) { fallbackCopy(text, btn, orig); }
  }

  // ── Widget minimizado ──────────────────────────────────────────────────

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
    let wdrag = false, wx = 0, wy = 0;
    function onWMove(e) {
      if (!wdrag) return;
      widget.style.right = 'auto';
      const pos = clampPos(e.clientX - wx, e.clientY - wy, widget.offsetWidth, widget.offsetHeight);
      widget.style.left = pos.left + 'px';
      widget.style.top  = pos.top  + 'px';
    }
    function onWUp() {
      if (!wdrag) {
        clearInterval(pulseTimer);
        window.removeEventListener('mousemove', onWMove);
        window.removeEventListener('mouseup', onWUp);
        widget.remove();
        panel.style.display = 'block';
      }
      wdrag = false;
    }
    widget.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault();
      wdrag = false;
      wx = e.clientX - widget.offsetLeft;
      wy = e.clientY - widget.offsetTop;
      function onMoveOnce(ev) {
        if (Math.hypot(ev.clientX - (wx + widget.offsetLeft), ev.clientY - (wy + widget.offsetTop)) > 4) wdrag = true;
      }
      window.addEventListener('mousemove', onMoveOnce, { once: false });
      widget._onMoveOnce = onMoveOnce;
      window.addEventListener('mousemove', onWMove);
      window.addEventListener('mouseup', onWUp, { once: true });
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
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
    inp.style.cssText = `background:#111827;border:1px solid #2a3a50;color:#00d4ff;font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
    inp.addEventListener('focus', () => inp.style.borderColor = '#00d4ff88');
    inp.addEventListener('blur',  () => inp.style.borderColor = '#2a3a50');
    return inp;
  }

  function sec(label, extraContent) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:4px 8px;border-bottom:1px solid #1a1a30;flex-shrink:0';
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
    d.style.cssText = `display:flex;align-items:center;gap:${gap || 4}px;overflow:hidden`;
    return d;
  }

  function sp(txt, extra) {
    const s = document.createElement('span');
    s.textContent = txt;
    s.style.cssText = 'font-size:9px;color:#fff;white-space:nowrap;' + (extra || '');
    return s;
  }

  // ── Expose ─────────────────────────────────────────────────────────────

  ML.ui = {
    clampPos, positionNearPanel,
    makeDraggableWindow,
    injectSliderCSS, realIvMs,
    playDone,
    parseDeductionS, formatDeduction, colorByOffset,
    fallbackCopy, copyResults,
    minimizePanel,
    mkIconBtn, mkBtn, mkNum, sec, row, sp,
  };

  console.log('[MedLat] 15-ui-utils carregado.');
})();
