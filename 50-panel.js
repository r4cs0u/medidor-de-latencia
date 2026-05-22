(function () {
  const ML = window.MedLat;

  function init() {
    ['ml-panel', 'ml-chart-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:4px',
      'box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#ccc',
      'user-select:none;min-width:720px;max-width:98vw',
    ].join(';');

    // ── Header arrastável ──────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;justify-content:space-between;align-items:center',
      'padding:4px 10px 3px;cursor:move',
      'border-bottom:1px solid #1e1e3a',
      'background:#1a1a2e;border-radius:4px 4px 0 0',
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

    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      pdrag = true;
      panel.style.transform = 'none';
      pox = e.clientX - panel.offsetLeft;
      poy = e.clientY - panel.offsetTop;
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // ── Corpo ──────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;align-items:stretch;gap:0';
    panel.appendChild(body);

    function colDiv(minW) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;flex-direction:column;gap:4px;padding:5px 8px;min-width:${minW}px;border-right:1px solid #1e1e3a`;
      return d;
    }
    function colHdr(txt) {
      const s = document.createElement('div');
      s.textContent = txt;
      s.style.cssText = 'font-size:7px;color:#4a4a6a;letter-spacing:.12em;font-weight:bold;margin-bottom:2px;text-transform:uppercase;border-bottom:1px solid #1e1e3a;padding-bottom:2px';
      return s;
    }
    function mkBtn(txt, bg) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}66;color:#fff;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;white-space:nowrap`;
      return b;
    }
    function mkNumInput(val, min, max, step, w) {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = min; inp.max = max; inp.step = step;
      inp.value = val;
      inp.style.cssText = `background:#111827;border:1px solid #2a3a50;color:#00d4ff;font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
      inp.addEventListener('focus', () => inp.style.borderColor = '#00d4ff88');
      inp.addEventListener('blur',  () => inp.style.borderColor = '#2a3a50');
      return inp;
    }

    // ── COLUNA 1: Telas ────────────────────────────────────────────────────
    const colTelas = colDiv(120);
    colTelas.appendChild(colHdr('Telas'));

    // PX Global: [−] [input] [+]
    const pxRow = document.createElement('div');
    pxRow.style.cssText = 'display:flex;align-items:center;gap:3px';
    const pxLbl = document.createElement('span');
    pxLbl.textContent = 'PX Global';
    pxLbl.style.cssText = 'font-size:9px;color:#667;white-space:nowrap';

    const pxInp = mkNumInput(ML.state.probeW, 16, 500, 2, 42);

    // aplica novo valor global e sincroniza inputs individuais
    function applyGlobalPx(v) {
      const clamped = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = clamped;
      pxInp.value = clamped;
      ML.CHANNELS.forEach(ch => {
        if (ch.probeW == null) {
          // canal ainda em modo "global": atualiza input individual
          if (ch._szInp) ch._szInp.value = clamped;
          if (ch._szHLbl) ch._szHLbl.textContent = '(' + Math.round(clamped * 9/16) + 'h)';
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

    pxRow.append(pxLbl, btnPxM, pxInp, btnPxP);

    // Buffer
    const bufRow = document.createElement('div');
    bufRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:1px';
    const bufLbl = document.createElement('span');
    bufLbl.textContent = 'Buffer';
    bufLbl.style.cssText = 'font-size:9px;color:#667';
    const durSel = document.createElement('select');
    durSel.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a4a;color:#aaa;font-size:9px;border-radius:3px;padding:1px 3px;flex:1';
    [5, 15, 30, 45].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v + 's';
      if (v === ML.BUFFER_SECONDS) o.selected = true;
      durSel.appendChild(o);
    });
    durSel.onchange = () => { ML.BUFFER_SECONDS = parseInt(durSel.value); };
    bufRow.append(bufLbl, durSel);

    colTelas.append(pxRow, bufRow);
    body.appendChild(colTelas);

    // ── COLUNA 2: Grid ─────────────────────────────────────────────────────
    const colGrid = colDiv(90);
    colGrid.appendChild(colHdr('Grid'));

    const btnSnap = mkBtn('', '#0d4f3c');
    function updateSnapBtn() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e';
      btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#556';
    }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); };
    updateSnapBtn();

    const btnCol = mkBtn('', '#3a1a0d');
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e';
      btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#556';
    }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    const gridRow = document.createElement('div');
    gridRow.style.cssText = 'display:flex;align-items:center;gap:3px;margin-top:1px';
    const gridLbl = document.createElement('span');
    gridLbl.textContent = 'GRID';
    gridLbl.style.cssText = 'font-size:9px;color:#667';
    const gridInput = mkNumInput(ML.state.snapSize, 2, 100, 2, 38);
    gridInput.style.color = '#00d4ff';
    gridInput.addEventListener('change', () => {
      ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gridInput.value) || 20));
      gridInput.value = ML.state.snapSize;
    });
    const gridPxLbl = document.createElement('span');
    gridPxLbl.textContent = 'px';
    gridPxLbl.style.cssText = 'font-size:9px;color:#3a3a5a';
    gridRow.append(gridLbl, gridInput, gridPxLbl);

    colGrid.append(btnSnap, btnCol, gridRow);
    body.appendChild(colGrid);

    // ── COLUNAS 3+4: Detalhamento (4 canais, 2×2) ─────────────────────────
    const colDet = document.createElement('div');
    colDet.style.cssText = 'display:flex;flex-direction:column;padding:5px 8px;border-right:1px solid #1e1e3a;flex:1;min-width:380px';
    colDet.appendChild(colHdr('Detalhamento'));

    const chanGrid = document.createElement('div');
    chanGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px 8px';
    colDet.appendChild(chanGrid);

    function miniHdrRow() {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:center;gap:0;font-size:8px;color:#3a3a5a;margin-bottom:1px';
      // colunas: toggle+label | px controls | lum | pt | offset | conf
      [['flex:1',''], ['width:88px;text-align:center','PX'], ['width:28px;text-align:right','Lum'],
       ['width:22px;text-align:right','pt'], ['width:48px;text-align:right','offset'],
       ['width:44px;text-align:right','conf']].forEach(([st, t]) => {
        const s = document.createElement('span');
        s.textContent = t;
        s.style.cssText = st + (t ? ';text-decoration:underline' : '');
        r.appendChild(s);
      });
      return r;
    }

    // 4 canais divididos em 2 sub-colunas: [0,1] e [2,3]
    [[0, 1], [2, 3]].forEach(idxs => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';
      wrap.appendChild(miniHdrRow());

      idxs.forEach(i => {
        const ch = ML.CHANNELS[i];
        if (!ch) return;

        const row = document.createElement('div');
        row.style.cssText = [
          'display:flex;align-items:center;gap:0;padding:2px 3px;border-radius:4px',
          `border:1px solid ${ch.color}44`,
          `background:${ch.color}0d`,
          `border-left:3px solid ${ch.color}`,
          `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
        ].join(';');
        ch._panelRow = row;

        // toggle
        const tog = document.createElement('button');
        tog.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0;margin-right:3px`;
        tog.onclick = () => {
          ch.active = !ch.active;
          tog.style.background = ch.active ? ch.color : 'transparent';
          row.style.opacity = ch.active ? 1 : .4;
          ch.probe.style.display = ch.active ? 'block' : 'none';
          if (!ch.active) ch.prevLum = null;
        };

        // label
        const lbl = document.createElement('input');
        lbl.value = i === 0 ? '\u2605 ' + ch.label : ch.label;
        lbl.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 9px monospace;width:52px;outline:none;cursor:text;flex:1`;
        lbl.addEventListener('change', () => {
          ch.label = lbl.value.replace(/^\u2605\s*/, '');
          if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
        });

        // PX individual: [−] [input] [+] (h)
        const szWrap = document.createElement('div');
        szWrap.style.cssText = 'display:flex;align-items:center;gap:1px;width:88px;flex-shrink:0';

        const szInp = mkNumInput(ch.probeW != null ? ch.probeW : ML.state.probeW, 16, 500, 2, 34);
        ch._szInp = szInp;

        const szHLbl = document.createElement('span');
        const curW = ch.probeW != null ? ch.probeW : ML.state.probeW;
        szHLbl.textContent = '(' + Math.round(curW * 9/16) + 'h)';
        szHLbl.style.cssText = 'font-size:7px;color:#445;white-space:nowrap;margin-left:1px';
        ch._szHLbl = szHLbl;

        function applyChanPx(v) {
          const clamped = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
          ch.probeW = clamped;
          szInp.value = clamped;
          szHLbl.textContent = '(' + Math.round(clamped * 9/16) + 'h)';
          if (ch.active && ch.resize) ch.resize();
        }

        const szM = mkBtn('\u2212', '#1e2a3a');
        const szP = mkBtn('+', '#1e2a3a');
        szM.style.padding = '0 4px'; szP.style.padding = '0 4px';
        szM.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) - 2);
        szP.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) + 2);
        szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
        szInp.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); applyChanPx(parseInt(szInp.value) || ML.state.probeW); szInp.blur(); }
          if (e.key === 'ArrowUp')   { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16) + 2); }
          if (e.key === 'ArrowDown') { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16) - 2); }
        });

        szWrap.append(szM, szInp, szP, szHLbl);

        // lum
        const lumEl = document.createElement('span');
        lumEl.style.cssText = `color:${ch.color};font-size:11px;font-weight:bold;width:28px;text-align:right`;
        lumEl.textContent = '--';
        ch.lumEl = lumEl;

        // pts
        const ptsEl = document.createElement('span');
        ptsEl.style.cssText = 'color:#3a3a5a;font-size:8px;width:22px;text-align:right';
        ptsEl.textContent = '0';
        ch.ptsEl = ptsEl;

        // offset
        const offEl = document.createElement('span');
        offEl.style.cssText = 'color:#778;font-size:9px;width:48px;text-align:right;font-weight:bold';
        offEl.textContent = i === 0 ? '0.000s' : '--';
        ch.offsetEl = offEl;

        // conf
        const confEl = document.createElement('span');
        confEl.style.cssText = 'color:#778;font-size:9px;width:44px;text-align:right';
        confEl.textContent = i === 0 ? '100%' : '--';
        ch.confEl = confEl;

        row.append(tog, lbl, szWrap, lumEl, ptsEl, offEl, confEl);
        wrap.appendChild(row);
      });

      chanGrid.appendChild(wrap);
    });

    body.appendChild(colDet);

    // ── COLUNA 5: Análise ──────────────────────────────────────────────────
    const colAn = document.createElement('div');
    colAn.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:5px 8px;min-width:100px';
    colAn.appendChild(colHdr('Analise'));

    const btnRec = document.createElement('button');
    btnRec.style.cssText = 'background:#1b5e20;border:1px solid #2e7d3288;color:#fff;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066;white-space:nowrap';
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

    const btnAnalyze = document.createElement('button');
    btnAnalyze.textContent = '\u26a1 ANALISAR';
    btnAnalyze.style.cssText = 'background:#4a148c;border:1px solid #7b1fa288;color:#ce93d8;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;letter-spacing:.04em;opacity:.45;white-space:nowrap';
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
            const sign = s > 0 ? '+' : '';
            ch.offsetEl.textContent = sign + s.toFixed(3) + 's';
            ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
          }
        }
        if (ch.confEl) {
          if (r.confidence != null && !r.error && !r.skipped) {
            ch.confEl.textContent = Math.round(r.confidence * 100) + '%';
            ch.confEl.style.color = r.confidence > 0.6 ? '#44ff88' : r.confidence > 0.3 ? '#ffd700' : '#ff4444';
          } else {
            ch.confEl.textContent = '--';
          }
        }
      });

      const first = results.find(r => !r.isReference && !r.error && !r.skipped);
      if (first) {
        const r = ML.correlator.analyze(ML.CHANNELS[0], first.channel, maxLagMs);
        if (!r.error) ML.chart.show(r);
      }

      const errs = results.filter(r => r.error);
      statusEl.textContent = errs.length
        ? errs.map(r => r.label + ': ' + r.error).join(' | ')
        : 'An\u00e1lise conclu\u00edda';
      statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
    };
    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .45 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    const lagRow = document.createElement('div');
    lagRow.style.cssText = 'display:flex;align-items:center;gap:4px';
    const lagLbl = document.createElement('span');
    lagLbl.textContent = 'Max lag';
    lagLbl.style.cssText = 'font-size:9px;color:#667;white-space:nowrap';
    const lagSel = document.createElement('select');
    lagSel.style.cssText = 'background:#1a1a2e;border:1px solid #2a2a4a;color:#aaa;font-size:9px;border-radius:3px;padding:1px 3px;flex:1';
    [5000, 15000, 30000, 45000].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = (v / 1000) + 's';
      if (v === 30000) o.selected = true;
      lagSel.appendChild(o);
    });
    lagRow.append(lagLbl, lagSel);

    colAn.append(btnRec, btnAnalyze, lagRow);
    body.appendChild(colAn);

    // ── Status bar ─────────────────────────────────────────────────────────
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:9px;color:#667;padding:3px 12px 4px',
      'border-top:1px solid #1e1e3a;text-align:center;font-style:italic',
      'background:#0e0e1a;border-radius:0 0 4px 4px',
    ].join(';');
    statusEl.textContent = 'Posicione os probes nos v\u00eddeos e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl };

    setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (ch.ptsEl) ch.ptsEl.textContent = ch.buffer.length;
      });
    }, 1000);

    console.log('[MedLat] 50-panel carregado.');
  }

  ML.panel = { init };
})();
