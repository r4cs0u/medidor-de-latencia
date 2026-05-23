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

  /* ── Boas Práticas ─────────────────────────────── */
  function showTips(anchorPanel) {
    if (ML._tipsShown) return;
    ML._tipsShown = true;

    const TIPS = [
      ['🎯', 'Centralize as probes — evite bordas, legendas e barras'],
      ['📺', 'Grave durante o programa, nunca no intervalo'],
      ['⏱️', 'Não interrompa — aguarde o sinal sonoro (~2 min)'],
      ['🌐', 'Feeds via internet têm dilatação temporal variável'],
      ['🖥️', 'Evite processos pesados durante a gravação'],
    ];

    const tip = document.createElement('div');
    tip.id = 'ml-tips';
    tip.style.cssText = [
      'position:fixed;z-index:99998',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:10px;color:#ccc',
      'width:230px;overflow:hidden',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:4px 8px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:6px 6px 0 0',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '💡 Boas Práticas';
    htitle.style.cssText = 'color:#ffd700;font-weight:bold;font-size:9px;letter-spacing:.06em;flex:1';
    hdr.appendChild(htitle);
    tip.appendChild(hdr);

    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:5px';
    TIPS.forEach(([icon, text]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:5px;line-height:1.35';
      const ic = document.createElement('span');
      ic.textContent = icon;
      ic.style.cssText = 'font-size:11px;flex-shrink:0;margin-top:1px';
      const tx = document.createElement('span');
      tx.textContent = text;
      tx.style.cssText = 'font-size:9px;color:#aaa';
      row.append(ic, tx);
      body.appendChild(row);
    });
    tip.appendChild(body);

    const foot = document.createElement('div');
    foot.style.cssText = 'padding:5px 8px;border-top:1px solid #1a1a30';
    const btnOk = document.createElement('button');
    btnOk.textContent = '✔ Entendido';
    btnOk.style.cssText = [
      'width:100%;background:#1a2a1a;border:1px solid #44ff8855',
      'color:#44ff88;border-radius:3px;padding:3px 0',
      'cursor:pointer;font:bold 9px monospace',
    ].join(';');
    btnOk.onclick = () => tip.remove();
    foot.appendChild(btnOk);
    tip.appendChild(foot);

    document.body.appendChild(tip);

    function reposition() {
      const pr      = anchorPanel.getBoundingClientRect();
      const tipH    = tip.offsetHeight;
      const tipW    = tip.offsetWidth;
      const vw      = window.innerWidth;
      const vh      = window.innerHeight;
      const margin  = 6;
      let top  = pr.bottom + margin;
      if (top + tipH > vh - margin) top = Math.max(margin, pr.top - tipH - margin);
      let left = pr.left;
      if (left + tipW > vw - margin) left = vw - tipW - margin;
      if (left < margin) left = margin;
      tip.style.top  = top  + 'px';
      tip.style.left = left + 'px';
    }

    requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
  }

  function init() {
    ['ml-panel', 'ml-chart-overlay', 'ml-tips'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    ML._tipsShown = false;

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;right:8px;z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#ccc',
      'user-select:none;width:230px;overflow:hidden',
    ].join(';');

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:6px;overflow:hidden',
      'padding:4px 8px;cursor:move',
      'border-bottom:1px solid #1e1e3a',
      'background:#1a1a2e;border-radius:6px 6px 0 0',
    ].join(';');
    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MED. LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';
    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnX.onclick = () => { ML.recorder.stop(); document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove()); };
    hdr.append(ttl, btnX);
    panel.appendChild(hdr);

    // Drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => { pdrag = true; panel.style.right = 'auto'; pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop; });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    // Helpers
    function sec(label) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:4px 8px;border-bottom:1px solid #1a1a30';
      const lh = document.createElement('div');
      lh.textContent = label;
      lh.style.cssText = 'font-size:7px;color:#666;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #1a1a30;padding-bottom:2px;margin-bottom:4px';
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
      s.style.cssText = 'font-size:9px;color:#aaa;white-space:nowrap;' + (extra || '');
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

    // — seletor de preset de lag
    // labels atualizados: 'Até 5s' e 'Maior que 5s'
    function mkLagSelect(ch) {
      const sel = document.createElement('select');
      sel.style.cssText = [
        'background:#111827;border:1px solid #2a3a50;color:#aaa',
        'font:bold 8px monospace;border-radius:3px;padding:1px 2px',
        'cursor:pointer;outline:none;flex-shrink:0',
      ].join(';');
      const opts = [
        { value: 'auto',     label: 'Auto' },
        { value: 'rapido',   label: 'Até 5s' },
        { value: 'internet', label: 'Maior que 5s' },
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
        sel.style.color       = sel.value === 'auto' ? '#aaa'    : '#ffd700';
      });
      if ((ch.lagPreset || 'auto') !== 'auto') {
        sel.style.borderColor = '#ffd70088';
        sel.style.color       = '#ffd700';
      }
      return sel;
    }

    /* ── Seção: Telas & Grid ── */
    const secTG = sec('Telas & Grid');

    const pxInp = mkNum(ML.state.probeW, 16, 500, 2, 48);
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c; pxInp.value = c;
      ML.CHANNELS.forEach(ch => { if (ch.probeW == null) { if (ch._szInp) ch._szInp.value = c; if (ch.active && ch.resize) ch.resize(); } });
    }
    const btnPxM = mkBtn('\u2212', '#1e2a3a', 'padding:2px 5px');
    const btnPxP = mkBtn('+', '#1e2a3a', 'padding:2px 5px');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); } });
    const rowPx = row(4);
    rowPx.append(sp('PX Global', 'flex-shrink:0'), btnPxM, pxInp, btnPxP);
    secTG.appendChild(rowPx);

    const btnSnap = mkBtn('', '#0d4f3c', 'flex:1;min-width:0;margin-top:4px');
    function updateSnapBtn() { btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF'; btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e'; btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#888'; }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); }; updateSnapBtn();

    const btnCol = mkBtn('', '#2a1a0d', 'flex:1;min-width:0;margin-top:4px');
    function updateColBtn() { btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF'; btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e'; btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#888'; }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); }; updateColBtn();

    const rowToggle = row(4);
    rowToggle.append(btnSnap, btnCol);
    secTG.appendChild(rowToggle);
    panel.appendChild(secTG);

    /* ── Seção: Probes ── */
    const secDet = sec('Probes');
    ML.CHANNELS.forEach((ch, i) => {
      const chWrap = document.createElement('div');
      // borda tracejada no card de probe (espelha estilo da probe na tela)
      chWrap.style.cssText = [
        'display:flex;flex-direction:column;gap:2px',
        'padding:3px 4px;border-radius:4px;margin-bottom:3px;overflow:hidden',
        `border:1px dashed ${ch.color}55`,
        `background:${ch.color}0d`,
        `border-left:2px dashed ${ch.color}99`,
        `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
      ].join(';');
      ch._panelRow = chWrap;

      // Linha 1: ● label | px − [n] +
      const r1 = row(4);
      const tog = document.createElement('button');
      tog.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.onclick = () => {
        ch.active = !ch.active;
        tog.style.background = ch.active ? ch.color : 'transparent';
        chWrap.style.opacity = ch.active ? 1 : .4;
        ch.probe.style.display = ch.active ? 'block' : 'none';
        if (!ch.active) ch.prevLum = null;
      };

      const lblInp = document.createElement('input');
      lblInp.value = i === 0 ? '\u2605 ' + ch.label : ch.label;
      lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 10px monospace;flex:1;outline:none;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis`;
      lblInp.addEventListener('change', () => { ch.label = lblInp.value.replace(/^\u2605\s*/, ''); if (ch.probeLabel) ch.probeLabel.textContent = ch.label; });

      const szInp = mkNum(ch.probeW != null ? ch.probeW : ML.state.probeW, 16, 500, 2, 38);
      ch._szInp = szInp;
      function applyChanPx(v) { const c = Math.max(16, Math.min(500, Math.round(v/2)*2)); ch.probeW = c; szInp.value = c; if (ch.active && ch.resize) ch.resize(); }
      const szM = mkBtn('\u2212', '#1e2a3a', 'padding:1px 3px;font-size:8px');
      const szP = mkBtn('+',    '#1e2a3a', 'padding:1px 3px;font-size:8px');
      szM.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) - 2);
      szP.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) + 2);
      szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
      szInp.addEventListener('keydown', e => {
        if (e.key==='Enter')     { e.preventDefault(); applyChanPx(parseInt(szInp.value)||ML.state.probeW); szInp.blur(); }
        if (e.key==='ArrowUp')   { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)+2); }
        if (e.key==='ArrowDown') { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)-2); }
      });

      r1.append(tog, lblInp, sp('px','font-size:8px;color:#555;flex-shrink:0'), szM, szInp, szP);

      // Linha 2: lag [select] | spacer | lum | pts
      const r2 = row(4);

      const lumEl = document.createElement('span');
      lumEl.style.cssText = `color:${ch.color};font-size:12px;font-weight:bold;width:22px;text-align:right;flex-shrink:0`;
      lumEl.textContent = '--'; ch.lumEl = lumEl;

      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'color:#888;font-size:8px;width:26px;text-align:right;flex-shrink:0;white-space:nowrap';
      ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;

      const spacer = document.createElement('span');
      spacer.style.cssText = 'flex:1';

      if (i !== 0) {
        const lagSel = mkLagSelect(ch);
        r2.append(sp('lag','font-size:8px;color:#aaa;flex-shrink:0'), lagSel, spacer, lumEl, ptsEl);
      } else {
        r2.append(spacer, lumEl, ptsEl);
      }

      chWrap.append(r1, r2);
      secDet.appendChild(chWrap);
    });
    panel.appendChild(secDet);

    /* ── Seção: Resultados ── */
    const secRes = sec('Resultados vs Refer\u00eancia');
    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:9px';
    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    ['Tela','Offset','Confian\u00e7a'].forEach((h, hi) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = 'color:#555;font-weight:bold;font-size:7px;letter-spacing:.08em;text-transform:uppercase;padding:1px 3px;text-align:' + (hi===0?'left':'right') + ';border-bottom:1px solid #1a1a30';
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    ML.CHANNELS.forEach((ch, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid ${ch.color}22`;
      const tdName = document.createElement('td');
      tdName.style.cssText = `color:${ch.color};font-weight:bold;padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px`;
      tdName.textContent = (i===0?'\u2605 ':'') + ch.label;
      ch._tdName = tdName;
      const tdOff = document.createElement('td');
      tdOff.style.cssText = 'text-align:right;padding:2px 3px;font-weight:bold;font-size:10px;white-space:nowrap';
      tdOff.textContent  = i===0 ? '0.000s' : '--';
      tdOff.style.color  = i===0 ? '#44ff88' : '#444';
      ch.offsetEl = tdOff;
      const tdConf = document.createElement('td');
      tdConf.style.cssText = 'text-align:right;padding:2px 3px;font-size:8px;white-space:nowrap';
      tdConf.textContent = i===0 ? 'REF' : '--';
      tdConf.style.color = i===0 ? '#44ff88aa' : '#444';
      ch.confEl = tdConf;
      tr.append(tdName, tdOff, tdConf);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    secRes.appendChild(tbl);
    panel.appendChild(secRes);

    /* ── Seção: Analise ── */
    const secAn = sec('Analise');
    const btnRec     = mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;color:#ce93d8;opacity:.45');

    function doStop() {
      ML.recorder.stop();
      playDone();
      btnRec.textContent = '\u25cf GRAVAR';
      btnRec.style.background = '#1b5e20'; btnRec.style.borderColor = '#2e7d3288'; btnRec.style.boxShadow = '0 0 8px #1b5e2066';
      const pts = ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ');
      statusEl.textContent = 'Pronto (' + pts + ')';
      statusEl.style.color = '#ffd700';
      btnAnalyze.disabled = false;
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
          if (ch.ptsEl) { ch.ptsEl.textContent = '0pt'; ch.ptsEl.style.color = '#888'; }
          if (i !== 0) {
            if (ch.offsetEl) { ch.offsetEl.textContent = '--'; ch.offsetEl.style.color = '#444'; }
            if (ch.confEl)   { ch.confEl.textContent   = '--'; ch.confEl.style.color = '#444'; }
          }
        });
      } else {
        doStop();
      }
    };

    btnAnalyze.onclick = () => {
      statusEl.textContent = 'Calculando...'; statusEl.style.color = '#aaa';
      setTimeout(() => {
        const results = ML.correlator.analyzeBestAll();
        results.forEach(r => {
          const ch = r.channel;
          if (!ch || r.isReference) return;
          if (ch.offsetEl) {
            if (r.skipped || r.error) {
              ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
              ch.offsetEl.style.color = r.error ? '#ff4444' : '#555';
            } else {
              const s = r.offsetMs / 1000;
              ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
              ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
            }
          }
          if (ch.confEl) {
            if (r.confidence != null && !r.error && !r.skipped) {
              const pct = Math.round(r.confidence * 100);
              ch.confEl.textContent = pct + '%';
              ch.confEl.style.color = r.confidence > 0.6 ? '#44ff88' : r.confidence > 0.3 ? '#ffd700' : '#ff4444';
            } else {
              ch.confEl.textContent = '--';
              ch.confEl.style.color = '#555';
            }
          }
        });
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

    const rowBtns = row(6); rowBtns.style.marginBottom = '5px';
    rowBtns.append(btnRec, btnAnalyze);
    secAn.appendChild(rowBtns);
    panel.appendChild(secAn);

    /* Status */
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:9px;color:#888;padding:3px 8px 4px',
      'border-top:1px solid #1a1a30;text-align:center;font-style:italic',
      'background:#0e0e1a;border-radius:0 0 6px 6px',
      'overflow:hidden;white-space:nowrap;text-overflow:ellipsis',
    ].join(';');
    statusEl.textContent = 'Posicione os probes e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl, doStop };

    requestAnimationFrame(() => showTips(panel));

    ML.panel.refreshOffsets = function(offsets) {
      ML.CHANNELS.forEach((ch, i) => {
        if (i === 0 || !offsets[ch.id]) return;
        if (!ch.offsetEl) return;
        const s = offsets[ch.id] / 1000;
        ch.offsetEl.textContent = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
        ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
      });
    };

    const STABLE_TICKS = 3;
    setInterval(() => {
      const activeChannels = ML.CHANNELS.filter(c => c.active);
      let allOk = activeChannels.length > 0;
      activeChannels.forEach(ch => {
        const pts = ch.buffer.length;
        if (ch.ptsEl) {
          if (ch._stableCnt >= STABLE_TICKS) {
            ch.ptsEl.textContent = '\u2713OK';
            ch.ptsEl.style.color = '#44ff88';
          } else {
            ch.ptsEl.textContent = pts + 'pt';
            ch.ptsEl.style.color = '#888';
          }
        }
        if (!ML.state.recording) { ch._prevPts = pts; ch._stableCnt = 0; return; }
        if (pts === 0) { allOk = false; return; }
        if (pts === ch._prevPts) {
          ch._stableCnt = (ch._stableCnt || 0) + 1;
        } else {
          ch._stableCnt = 0;
          ch._prevPts   = pts;
        }
        if (ch._stableCnt < STABLE_TICKS) allOk = false;
      });
      if (ML.state.recording && allOk && activeChannels.length > 0) {
        console.log('[MedLat] Buffer estabilizado. Auto-stop.');
        doStop();
      }
    }, 1000);

    console.log('[MedLat] 50-panel carregado.');
  }

  ML.panel = { init };
})();
