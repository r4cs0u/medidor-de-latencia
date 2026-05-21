(function () {
  const ML = window.MedLat;

  // ── Paleta Globo ────────────────────────────────────────────────────────────
  const G = {
    bg:       '#0f0f0fee',
    surface:  '#161616',
    hdr:      '#1a1a1a',
    border:   '#2a2a2a',
    accent:   '#f57c00',
    accentDim:'#f57c0055',
    text:     '#d0d0d0',
    muted:    '#666',
    faint:    '#3a3a3a',
    green:    '#1d6f3a',
    red:      '#c0392b',
    blue:     '#1a3a7a',
  };

  function init() {
    ['ml-panel', 'ml-chart-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    // ── Painel principal ──────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:99999',
      `background:${G.bg};border:1px solid ${G.border}`,
      'border-radius:4px',
      'box-shadow:0 2px 16px #0009',
      `font-family:monospace;font-size:11px;color:${G.text}`,
      'user-select:none;min-width:840px;max-width:98vw',
    ].join(';');

    // ── Header arrastável ─────────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;justify-content:space-between;align-items:center',
      'padding:4px 10px 3px;cursor:move',
      `border-bottom:1px solid ${G.border}`,
      `background:${G.hdr};border-radius:4px 4px 0 0`,
    ].join(';');

    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MEDIDOR DE LAT\u00CANCIA';
    ttl.style.cssText = `color:${G.accent};font-weight:bold;font-size:10px;letter-spacing:.1em`;

    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.style.cssText = `background:${G.red};border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px`;
    btnX.onclick = () => {
      ML.recorder.stop();
      document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove());
    };
    hdr.append(ttl, btnX);
    panel.appendChild(hdr);

    // drag
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

    // ── Corpo: 5 colunas ──────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;align-items:stretch;gap:0';
    panel.appendChild(body);

    function colDiv(minW) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;flex-direction:column;gap:3px;padding:5px 8px;min-width:${minW}px;border-right:1px solid ${G.border}`;
      return d;
    }
    function colHdr(txt) {
      const s = document.createElement('div');
      s.textContent = txt;
      s.style.cssText = `font-size:7px;color:${G.muted};letter-spacing:.12em;font-weight:bold;margin-bottom:2px;text-transform:uppercase;border-bottom:1px solid ${G.faint};padding-bottom:2px`;
      return s;
    }
    function mkBtn(txt, bg, extra) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}66;color:#fff;border-radius:3px;padding:2px 7px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;${extra||''}`;
      return b;
    }

    // ── COLUNA 1: Telas ───────────────────────────────────────────────────────
    const colTelas = colDiv(96);
    colTelas.appendChild(colHdr('Telas'));

    const qtLabel = document.createElement('span');
    qtLabel.style.cssText = `font-size:9px;color:${G.muted}`;
    qtLabel.textContent = 'Qt. Telas: ' + ML.CHANNELS.filter(c => c.active).length;
    setInterval(() => { qtLabel.textContent = 'Qt. Telas: ' + ML.CHANNELS.filter(c => c.active).length; }, 1000);

    const pxRow = document.createElement('div');
    pxRow.style.cssText = 'display:flex;align-items:center;gap:3px';
    const pxLbl = document.createElement('span');
    pxLbl.textContent = 'PX Global';
    pxLbl.style.cssText = `font-size:9px;color:${G.muted};white-space:nowrap`;
    const pxVal = document.createElement('span');
    pxVal.style.cssText = 'font-size:10px;color:#fff;font-weight:bold;min-width:26px;text-align:center';
    pxVal.textContent = ML.state.probeW;
    const btnPxM = mkBtn('\u2212', '#333');
    const btnPxP = mkBtn('+', '#333');
    btnPxM.onclick = () => {
      ML.state.probeW = Math.max(16, ML.state.probeW - 2);
      pxVal.textContent = ML.state.probeW;
      ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); });
    };
    btnPxP.onclick = () => {
      ML.state.probeW = Math.min(500, ML.state.probeW + 2);
      pxVal.textContent = ML.state.probeW;
      ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); });
    };
    pxRow.append(pxLbl, btnPxM, pxVal, btnPxP);

    const bufRow = document.createElement('div');
    bufRow.style.cssText = 'display:flex;align-items:center;gap:4px;margin-top:1px';
    const bufLbl = document.createElement('span');
    bufLbl.textContent = 'Buffer';
    bufLbl.style.cssText = `font-size:9px;color:${G.muted}`;
    const durSel = document.createElement('select');
    durSel.style.cssText = `background:${G.surface};border:1px solid ${G.border};color:${G.text};font-size:9px;border-radius:3px;padding:1px 3px;flex:1`;
    [5, 15, 30, 45].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v + 's';
      if (v === ML.BUFFER_SECONDS) o.selected = true;
      durSel.appendChild(o);
    });
    durSel.onchange = () => { ML.BUFFER_SECONDS = parseInt(durSel.value); };
    bufRow.append(bufLbl, durSel);

    colTelas.append(qtLabel, pxRow, bufRow);
    body.appendChild(colTelas);

    // ── COLUNA 2: Grid ────────────────────────────────────────────────────────
    const colGrid = colDiv(90);
    colGrid.appendChild(colHdr('Grid'));

    const btnSnap = mkBtn('', '#1e3a2a');
    function updateSnapBtn() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#1d6f3a' : '#2a2a2a';
      btnSnap.style.color = ML.state.snapGrid ? '#5ddc8a' : G.muted;
      btnSnap.style.borderColor = ML.state.snapGrid ? '#1d6f3a99' : G.border;
    }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); };
    updateSnapBtn();

    const btnCol = mkBtn('', '#3a2a1a');
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#7a3a00' : '#2a2a2a';
      btnCol.style.color = ML.state.noOverlap ? G.accent : G.muted;
      btnCol.style.borderColor = ML.state.noOverlap ? G.accentDim : G.border;
    }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    const gridRow = document.createElement('div');
    gridRow.style.cssText = 'display:flex;align-items:center;gap:3px;margin-top:1px';
    const gridLbl = document.createElement('span');
    gridLbl.textContent = 'GRID';
    gridLbl.style.cssText = `font-size:9px;color:${G.muted}`;
    const gridInput = document.createElement('input');
    gridInput.type = 'number'; gridInput.min = 2; gridInput.max = 100; gridInput.step = 2;
    gridInput.value = ML.state.snapSize;
    gridInput.style.cssText = `background:${G.surface};border:1px solid ${G.border};color:${G.accent};font:bold 10px monospace;width:38px;border-radius:3px;padding:1px 3px;text-align:center;outline:none`;
    gridInput.addEventListener('change', () => {
      ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gridInput.value) || 20));
      gridInput.value = ML.state.snapSize;
    });
    gridInput.addEventListener('focus', () => gridInput.style.borderColor = G.accentDim);
    gridInput.addEventListener('blur',  () => gridInput.style.borderColor = G.border);
    const gridPxLbl = document.createElement('span');
    gridPxLbl.textContent = 'px';
    gridPxLbl.style.cssText = `font-size:9px;color:${G.faint}`;
    gridRow.append(gridLbl, gridInput, gridPxLbl);

    colGrid.append(btnSnap, btnCol, gridRow);
    body.appendChild(colGrid);

    // ── COLUNAS 3+4: Detalhamento ─────────────────────────────────────────────
    const colDet = document.createElement('div');
    colDet.style.cssText = `display:flex;flex-direction:column;padding:5px 8px;border-right:1px solid ${G.border};flex:1;min-width:420px`;
    colDet.appendChild(colHdr('Detalhamento'));

    const chanGrid = document.createElement('div');
    chanGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:2px 8px';
    colDet.appendChild(chanGrid);

    function miniHdrRow() {
      const r = document.createElement('div');
      r.style.cssText = `display:flex;align-items:center;gap:0;font-size:8px;color:${G.faint};margin-bottom:1px`;
      ['', 'Lum', 'pt', 'offset', 'confian\u00e7a'].forEach((t, i) => {
        const s = document.createElement('span');
        s.textContent = t;
        const widths = ['flex:1', 'width:32px;text-align:right', 'width:28px;text-align:right', 'width:52px;text-align:right', 'width:52px;text-align:right'];
        s.style.cssText = widths[i] + ';text-decoration:' + (t ? 'underline' : 'none');
        r.appendChild(s);
      });
      return r;
    }

    const leftIdxs  = [0, 1, 3];
    const rightIdxs = [2, 4, 5];

    function buildSubCol(idxs) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:2px';
      wrap.appendChild(miniHdrRow());
      idxs.forEach(i => {
        const ch = ML.CHANNELS[i];
        if (!ch) return;
        const row = document.createElement('div');
        row.style.cssText = [
          'display:flex;align-items:center;gap:0;padding:1px 3px;border-radius:3px',
          `border:1px solid ${ch.color}28`,
          `background:${ch.color}06`,
          `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
        ].join(';');
        ch._panelRow = row;

        const tog = document.createElement('button');
        tog.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0;margin-right:3px`;
        tog.onclick = () => {
          ch.active = !ch.active;
          tog.style.background = ch.active ? ch.color : 'transparent';
          row.style.opacity = ch.active ? 1 : .4;
          ch.probe.style.display = ch.active ? 'block' : 'none';
          if (!ch.active) ch.prevLum = null;
        };

        const lbl = document.createElement('input');
        lbl.value = ch.label;
        const isRef = (i === 0);
        lbl.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 9px monospace;width:60px;outline:none;cursor:text;flex:1`;
        if (isRef) lbl.value = '\u2605 ' + ch.label;
        lbl.addEventListener('change', () => {
          ch.label = lbl.value.replace(/^\u2605\s*/, '');
          if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
        });

        const lumEl = document.createElement('span');
        lumEl.style.cssText = `color:${ch.color};font-size:11px;font-weight:bold;width:32px;text-align:right`;
        lumEl.textContent = '--';
        ch.lumEl = lumEl;

        const ptsEl = document.createElement('span');
        ptsEl.style.cssText = `color:${G.faint};font-size:8px;width:28px;text-align:right`;
        ptsEl.textContent = '0';
        ch.ptsEl = ptsEl;

        const offEl = document.createElement('span');
        offEl.style.cssText = `color:${G.muted};font-size:9px;width:52px;text-align:right;font-weight:bold`;
        offEl.textContent = isRef ? '0.000s' : '--';
        ch.offsetEl = offEl;

        const confEl = document.createElement('span');
        confEl.style.cssText = `color:${G.muted};font-size:9px;width:52px;text-align:right`;
        confEl.textContent = isRef ? '100%' : '--';
        ch.confEl = confEl;

        row.append(tog, lbl, lumEl, ptsEl, offEl, confEl);
        wrap.appendChild(row);
      });
      return wrap;
    }

    chanGrid.append(buildSubCol(leftIdxs), buildSubCol(rightIdxs));
    body.appendChild(colDet);

    // ── COLUNA 5: Análise ─────────────────────────────────────────────────────
    const colAn = document.createElement('div');
    colAn.style.cssText = 'display:flex;flex-direction:column;gap:4px;padding:5px 8px;min-width:100px;border-right:none';
    colAn.appendChild(colHdr('Analise'));

    const btnRec = document.createElement('button');
    btnRec.style.cssText = `background:${G.green};border:1px solid ${G.green}88;color:#fff;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;letter-spacing:.05em;white-space:nowrap`;
    btnRec.textContent = '\u25cf GRAVAR';
    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = G.red;
        btnRec.style.borderColor = G.red + '88';
        statusEl.textContent = 'Gravando...';
        statusEl.style.color = '#5ddc8a';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach(ch => {
          if (ch.offsetEl && ML.CHANNELS.indexOf(ch) !== 0) ch.offsetEl.textContent = '--';
          if (ch.confEl   && ML.CHANNELS.indexOf(ch) !== 0) ch.confEl.textContent = '--';
        });
      } else {
        ML.recorder.stop();
        btnRec.textContent = '\u25cf GRAVAR';
        btnRec.style.background = G.green;
        btnRec.style.borderColor = G.green + '88';
        statusEl.textContent = 'Pronto (' + ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ') + ')';
        statusEl.style.color = G.accent;
        btnAnalyze.disabled = false;
      }
    };

    const btnAnalyze = document.createElement('button');
    btnAnalyze.textContent = '\u26a1 ANALISAR';
    btnAnalyze.style.cssText = `background:${G.red};border:1px solid ${G.red}88;color:#fff;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;letter-spacing:.05em;opacity:.4;white-space:nowrap`;
    btnAnalyze.onclick = async () => {
      statusEl.textContent = 'Calculando...';
      statusEl.style.color = G.muted;
      const maxLagMs = parseInt(lagSel.value);
      const results = ML.correlator.analyzeAll(maxLagMs);

      results.forEach(r => {
        const ch = r.channel;
        if (!ch || r.isReference) return;
        if (ch.offsetEl) {
          if (r.skipped || r.error) {
            ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
            ch.offsetEl.style.color = r.error ? '#ff4444' : G.faint;
          } else {
            const s = r.offsetMs / 1000;
            const sign = s > 0 ? '+' : '';
            ch.offsetEl.textContent = sign + s.toFixed(3) + 's';
            ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#5ddc8a' : Math.abs(s) < 1 ? G.accent : '#ff6633';
          }
        }
        if (ch.confEl) {
          if (r.confidence != null && !r.error && !r.skipped) {
            ch.confEl.textContent = Math.round(r.confidence * 100) + '%';
            ch.confEl.style.color = r.confidence > 0.6 ? '#5ddc8a' : r.confidence > 0.3 ? G.accent : '#ff4444';
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
      statusEl.style.color = errs.length ? '#ff6633' : '#5ddc8a';
    };
    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .4 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    const lagRow = document.createElement('div');
    lagRow.style.cssText = 'display:flex;align-items:center;gap:4px';
    const lagLbl = document.createElement('span');
    lagLbl.textContent = 'Max lag';
    lagLbl.style.cssText = `font-size:9px;color:${G.muted};white-space:nowrap`;
    const lagSel = document.createElement('select');
    lagSel.style.cssText = `background:${G.surface};border:1px solid ${G.border};color:${G.text};font-size:9px;border-radius:3px;padding:1px 3px;flex:1`;
    [5000, 15000, 30000, 45000].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = (v / 1000) + 's';
      if (v === 30000) o.selected = true;
      lagSel.appendChild(o);
    });
    lagRow.append(lagLbl, lagSel);

    colAn.append(btnRec, btnAnalyze, lagRow);
    body.appendChild(colAn);

    // ── Status bar ────────────────────────────────────────────────────────────
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      `font-size:9px;color:${G.muted};padding:3px 12px 4px`,
      `border-top:1px solid ${G.border};text-align:center;font-style:italic`,
      `background:${G.hdr};border-radius:0 0 4px 4px`,
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

    console.log('[MedLat] 50-panel carregado (Globo style).');
  }

  ML.panel = { init };
})();
