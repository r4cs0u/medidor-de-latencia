(function () {
  const ML = window.MedLat;

  function init() {
    ['ml-panel', 'ml-chart-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // ── Painel ─────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;left:8px;z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#ccc',
      'user-select:none;width:280px',
    ].join(';');

    // ── Header arrastável ──────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;justify-content:space-between;align-items:center',
      'padding:5px 10px 4px;cursor:move',
      'border-bottom:1px solid #1e1e3a',
      'background:#1a1a2e;border-radius:6px 6px 0 0',
    ].join(';');
    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MEDIDOR DE LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.08em';
    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px';
    btnX.onclick = () => {
      ML.recorder.stop();
      document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove());
    };
    hdr.append(ttl, btnX);
    panel.appendChild(hdr);

    // drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      pdrag = true; pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop;
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // ── Helpers ────────────────────────────────────────────────────────────
    function section(label) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:6px 10px;border-bottom:1px solid #1a1a30';
      if (label) {
        const lbl = document.createElement('div');
        lbl.textContent = label;
        lbl.style.cssText = 'font-size:7px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #1a1a30;padding-bottom:3px;margin-bottom:5px';
        wrap.appendChild(lbl);
      }
      return wrap;
    }
    function row(gap) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;align-items:center;gap:${gap||4}px`;
      return d;
    }
    function lbl(txt, extra) {
      const s = document.createElement('span');
      s.textContent = txt;
      s.style.cssText = 'font-size:9px;color:#667;white-space:nowrap;' + (extra||'');
      return s;
    }
    function mkBtn(txt, bg, extra) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}66;color:#fff;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;${extra||''}`;
      return b;
    }
    function mkSel(opts, selected, extra) {
      const s = document.createElement('select');
      s.style.cssText = `background:#1a1a2e;border:1px solid #2a2a4a;color:#aaa;font-size:9px;border-radius:3px;padding:1px 3px;${extra||''}`;
      opts.forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        if (v === selected) o.selected = true;
        s.appendChild(o);
      });
      return s;
    }
    function mkNumInp(val, min, max, step, w) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      inp.style.cssText = `background:#111827;border:1px solid #2a3a50;color:#00d4ff;font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
      inp.addEventListener('focus', () => inp.style.borderColor = '#00d4ff88');
      inp.addEventListener('blur',  () => inp.style.borderColor = '#2a3a50');
      return inp;
    }

    // ── SEÇÃO 1: Controles globais ─────────────────────────────────────────
    const secCtrl = section(null);
    secCtrl.style.padding = '5px 10px';

    // linha: Probe W [−] [inp] [+]  |  Buf [sel]
    const ctrlRow = row(6);

    const pxInp = mkNumInp(ML.state.probeW, 16, 500, 2, 42);
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c; pxInp.value = c;
      ML.CHANNELS.forEach(ch => {
        if (ch.probeW == null) {
          if (ch._szInp)  ch._szInp.value = c;
          if (ch._szHLbl) ch._szHLbl.textContent = '(' + Math.round(c * 9/16) + 'h)';
          if (ch.active && ch.resize) ch.resize();
        }
      });
    }
    const btnPxM = mkBtn('\u2212', '#1e2a3a');
    const btnPxP = mkBtn('+', '#1e2a3a');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); }
    });

    const durSel = mkSel([5,15,30,45].map(v => [v, v+'s']), ML.BUFFER_SECONDS, 'flex:1');
    durSel.onchange = () => { ML.BUFFER_SECONDS = parseInt(durSel.value); };

    const sep = document.createElement('span');
    sep.textContent = '|';
    sep.style.cssText = 'color:#2a2a4a;font-size:12px;padding:0 1px';

    ctrlRow.append(lbl('Probe W'), btnPxM, pxInp, btnPxP, sep, lbl('Buf'), durSel);
    secCtrl.appendChild(ctrlRow);
    panel.appendChild(secCtrl);

    // ── SEÇÃO 2: Grid / Snap ───────────────────────────────────────────────
    const secGrid = section('Grid');

    const snapColRow = row(4);
    const btnSnap = mkBtn('', '#0d4f3c', 'flex:1');
    function updateSnapBtn() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e';
      btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#556';
    }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); };
    updateSnapBtn();

    const btnCol = mkBtn('', '#3a1a0d', 'flex:1');
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e';
      btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#556';
    }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    const gridInp = mkNumInp(ML.state.snapSize, 2, 100, 2, 36);
    gridInp.addEventListener('change', () => {
      ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gridInp.value) || 20));
      gridInp.value = ML.state.snapSize;
    });
    const gridPx = lbl('px');

    snapColRow.append(btnSnap, btnCol, lbl('Grid'), gridInp, gridPx);
    secGrid.appendChild(snapColRow);
    panel.appendChild(secGrid);

    // ── SEÇÃO 3: Canais ────────────────────────────────────────────────────
    const secCh = section('Canais');

    ML.CHANNELS.forEach((ch, i) => {
      const chRow = document.createElement('div');
      chRow.style.cssText = [
        'display:flex;flex-direction:column;gap:2px;padding:3px 4px;border-radius:4px;margin-bottom:3px',
        `border:1px solid ${ch.color}44`,
        `background:${ch.color}0d`,
        `border-left:3px solid ${ch.color}`,
        `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
      ].join(';');
      ch._panelRow = chRow;

      // linha 1: toggle + label + lum
      const top = row(4);
      const tog = document.createElement('button');
      tog.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.onclick = () => {
        ch.active = !ch.active;
        tog.style.background = ch.active ? ch.color : 'transparent';
        chRow.style.opacity = ch.active ? 1 : .4;
        ch.probe.style.display = ch.active ? 'block' : 'none';
        if (!ch.active) ch.prevLum = null;
      };

      const lblInp = document.createElement('input');
      lblInp.value = i === 0 ? '\u2605 ' + ch.label : ch.label;
      lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 10px monospace;flex:1;outline:none;cursor:text;min-width:0`;
      lblInp.addEventListener('change', () => {
        ch.label = lblInp.value.replace(/^\u2605\s*/, '');
        if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
      });

      const lumEl = document.createElement('span');
      lumEl.style.cssText = `color:${ch.color};font-size:12px;font-weight:bold;min-width:24px;text-align:right;flex-shrink:0`;
      lumEl.textContent = '--';
      ch.lumEl = lumEl;

      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'color:#3a3a5a;font-size:8px;min-width:26px;text-align:right;flex-shrink:0';
      ptsEl.textContent = '0pt';
      ch.ptsEl = ptsEl;

      top.append(tog, lblInp, lumEl, ptsEl);

      // linha 2: PX [−][inp][+](h)  |  offset  conf
      const bot = row(3);

      const szInp = mkNumInp(ch.probeW != null ? ch.probeW : ML.state.probeW, 16, 500, 2, 34);
      ch._szInp = szInp;
      const curW = ch.probeW != null ? ch.probeW : ML.state.probeW;
      const szHLbl = document.createElement('span');
      szHLbl.textContent = '(' + Math.round(curW * 9/16) + 'h)';
      szHLbl.style.cssText = 'font-size:7px;color:#445;white-space:nowrap';
      ch._szHLbl = szHLbl;

      function applyChanPx(v) {
        const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
        ch.probeW = c; szInp.value = c;
        szHLbl.textContent = '(' + Math.round(c * 9/16) + 'h)';
        if (ch.active && ch.resize) ch.resize();
      }
      const szM = mkBtn('\u2212', '#1e2a3a');
      const szP = mkBtn('+', '#1e2a3a');
      szM.style.padding = '0 4px'; szP.style.padding = '0 4px';
      szM.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) - 2);
      szP.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) + 2);
      szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
      szInp.addEventListener('keydown', e => {
        if (e.key === 'Enter')      { e.preventDefault(); applyChanPx(parseInt(szInp.value) || ML.state.probeW); szInp.blur(); }
        if (e.key === 'ArrowUp')   { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16) + 2); }
        if (e.key === 'ArrowDown') { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16) - 2); }
      });

      const offEl = document.createElement('span');
      offEl.style.cssText = 'color:#778;font-size:9px;font-weight:bold;flex:1;text-align:right;white-space:nowrap';
      offEl.textContent = i === 0 ? '0.000s' : '--';
      ch.offsetEl = offEl;

      const confEl = document.createElement('span');
      confEl.style.cssText = 'color:#778;font-size:9px;min-width:32px;text-align:right;white-space:nowrap';
      confEl.textContent = i === 0 ? '100%' : '--';
      ch.confEl = confEl;

      bot.append(lbl('px', 'font-size:8px'), szM, szInp, szP, szHLbl, offEl, confEl);
      chRow.append(top, bot);
      secCh.appendChild(chRow);
    });

    panel.appendChild(secCh);

    // ── SEÇÃO 4: Análise ───────────────────────────────────────────────────
    const secAn = section('Analise');

    const btnRec = document.createElement('button');
    btnRec.style.cssText = 'width:100%;background:#1b5e20;border:1px solid #2e7d3288;color:#fff;border-radius:4px;padding:5px 0;cursor:pointer;font-size:11px;font-family:monospace;font-weight:bold;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066;margin-bottom:4px';
    btnRec.textContent = '\u25cf GRAVAR';
    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#7f0000';
        btnRec.style.borderColor = '#c6282888';
        btnRec.style.boxShadow = '0 0 8px #c6282855';
        statusEl.textContent = 'Gravando...';
        statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach(ch => {
          if (ch.offsetEl && ML.CHANNELS.indexOf(ch) !== 0) ch.offsetEl.textContent = '--';
          if (ch.confEl   && ML.CHANNELS.indexOf(ch) !== 0) ch.confEl.textContent = '--';
        });
      } else {
        ML.recorder.stop();
        btnRec.textContent = '\u25cf GRAVAR';
        btnRec.style.background = '#1b5e20';
        btnRec.style.borderColor = '#2e7d3288';
        btnRec.style.boxShadow = '0 0 8px #1b5e2066';
        statusEl.textContent = 'Pronto (' + ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ') + ')';
        statusEl.style.color = '#ffd700';
        btnAnalyze.disabled = false;
      }
    };

    const lagRow = row(4);
    lagRow.style.marginBottom = '4px';
    const lagSel = mkSel([5000,15000,30000,45000].map(v => [v, (v/1000)+'s']), 30000, 'flex:1');
    lagRow.append(lbl('Max lag'), lagSel);

    const btnAnalyze = document.createElement('button');
    btnAnalyze.textContent = '\u26a1 ANALISAR';
    btnAnalyze.style.cssText = 'width:100%;background:#4a148c;border:1px solid #7b1fa288;color:#ce93d8;border-radius:4px;padding:5px 0;cursor:pointer;font-size:11px;font-family:monospace;font-weight:bold;letter-spacing:.04em;opacity:.45';
    btnAnalyze.onclick = async () => {
      statusEl.textContent = 'Calculando...';
      statusEl.style.color = '#778';
      const maxLagMs = parseInt(lagSel.value);
      const results = ML.correlator.analyzeAll(maxLagMs);
      results.forEach(r => {
        const ch = r.channel;
        if (!ch || r.isReference) return;
        if (ch.offsetEl) {
          if (r.skipped || r.error) {
            ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
            ch.offsetEl.style.color = r.error ? '#ff4444' : '#3a3a5a';
          } else {
            const s = r.offsetMs / 1000;
            ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
            ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
          }
        }
        if (ch.confEl) {
          if (r.confidence != null && !r.error && !r.skipped) {
            ch.confEl.textContent = Math.round(r.confidence * 100) + '%';
            ch.confEl.style.color = r.confidence > 0.6 ? '#44ff88' : r.confidence > 0.3 ? '#ffd700' : '#ff4444';
          } else { ch.confEl.textContent = '--'; }
        }
      });
      const first = results.find(r => !r.isReference && !r.error && !r.skipped);
      if (first) {
        const r = ML.correlator.analyze(ML.CHANNELS[0], first.channel, maxLagMs);
        if (!r.error) ML.chart.show(r);
      }
      const errs = results.filter(r => r.error);
      statusEl.textContent = errs.length ? errs.map(r => r.label + ': ' + r.error).join(' | ') : 'An\u00e1lise conclu\u00edda';
      statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
    };
    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .45 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    secAn.append(btnRec, lagRow, btnAnalyze);
    panel.appendChild(secAn);

    // ── Status bar ─────────────────────────────────────────────────────────
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:9px;color:#667;padding:4px 10px 5px',
      'border-top:1px solid #1a1a30;text-align:center;font-style:italic',
      'background:#0e0e1a;border-radius:0 0 6px 6px',
    ].join(';');
    statusEl.textContent = 'Posicione os probes nos v\u00eddeos e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl };

    setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (ch.ptsEl) ch.ptsEl.textContent = ch.buffer.length + 'pt';
      });
    }, 1000);

    console.log('[MedLat] 50-panel carregado (layout vertical).');
  }

  ML.panel = { init };
})();
