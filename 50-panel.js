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
      'position:fixed;top:8px;right:8px;z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#ccc',
      'user-select:none;width:200px;overflow:hidden',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:6px;overflow:hidden',
      'padding:5px 8px 4px;cursor:move',
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

    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => { pdrag = true; panel.style.right = 'auto'; pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop; });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    function sec(label) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:6px 10px;border-bottom:1px solid #1a1a30';
      const lh = document.createElement('div');
      lh.textContent = label;
      lh.style.cssText = 'font-size:7px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #1a1a30;padding-bottom:3px;margin-bottom:6px';
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
      s.style.cssText = 'font-size:9px;color:#667;white-space:nowrap;' + (extra || '');
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

    /* ═══ TELAS ═══ */
    const secTelas = sec('Telas');
    const pxInp = mkNum(ML.state.probeW, 16, 500, 2, 44);
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c; pxInp.value = c;
      ML.CHANNELS.forEach(ch => { if (ch.probeW == null) { if (ch._szInp) ch._szInp.value = c; if (ch.active && ch.resize) ch.resize(); } });
    }
    const btnPxM = mkBtn('\u2212', '#1e2a3a', 'padding:2px 5px');
    const btnPxP = mkBtn('+',    '#1e2a3a', 'padding:2px 5px');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); } });
    const rowPx = row(4); rowPx.style.marginBottom = '5px';
    rowPx.append(sp('PX Global', 'flex-shrink:0'), btnPxM, pxInp, btnPxP);
    secTelas.appendChild(rowPx);
    ML.BUFFER_SECONDS = 120;
    const rowBuf = row(4);
    rowBuf.append(sp('Buffer', 'flex-shrink:0'), sp('120s (fixo)', 'color:#334;font-size:8px'));
    secTelas.appendChild(rowBuf);
    panel.appendChild(secTelas);

    /* ═══ GRID ═══ */
    const secGrid = sec('Grid');
    const btnSnap = mkBtn('', '#0d4f3c', 'flex:1;min-width:0');
    function updateSnapBtn() { btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF'; btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#1e1e2e'; btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#556'; }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); }; updateSnapBtn();
    const btnCol = mkBtn('', '#3a1a0d', 'flex:1;min-width:0');
    function updateColBtn() { btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF'; btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#1e1e2e'; btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#556'; }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); }; updateColBtn();
    const rowToggle = row(4); rowToggle.style.marginBottom = '5px';
    rowToggle.append(btnSnap, btnCol);
    secGrid.appendChild(rowToggle);
    const gridInp = mkNum(ML.state.snapSize, 2, 100, 2, 44);
    gridInp.addEventListener('change', () => { ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gridInp.value) || 20)); gridInp.value = ML.state.snapSize; });
    const rowGridPx = row(4);
    rowGridPx.append(sp('Grid px', 'flex-shrink:0'), gridInp);
    secGrid.appendChild(rowGridPx);
    panel.appendChild(secGrid);

    /* ═══ DETALHAMENTO ═══ */
    const secDet = sec('Detalhamento');
    ML.CHANNELS.forEach((ch, i) => {
      const chWrap = document.createElement('div');
      chWrap.style.cssText = [
        'display:flex;flex-direction:column;gap:2px',
        'padding:3px 4px;border-radius:4px;margin-bottom:4px;overflow:hidden',
        `border:1px solid ${ch.color}44`,
        `background:${ch.color}0d`,
        `border-left:3px solid ${ch.color}`,
        `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
      ].join(';');
      ch._panelRow = chWrap;

      const r1 = row(4);
      const tog = document.createElement('button');
      tog.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.onclick = () => { ch.active = !ch.active; tog.style.background = ch.active ? ch.color : 'transparent'; chWrap.style.opacity = ch.active ? 1 : .4; ch.probe.style.display = ch.active ? 'block' : 'none'; if (!ch.active) ch.prevLum = null; };
      const lblInp = document.createElement('input');
      lblInp.value = i === 0 ? '\u2605 ' + ch.label : ch.label;
      lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 10px monospace;flex:1;outline:none;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis`;
      lblInp.addEventListener('change', () => { ch.label = lblInp.value.replace(/^\u2605\s*/, ''); if (ch.probeLabel) ch.probeLabel.textContent = ch.label; });
      const lumEl = document.createElement('span');
      lumEl.style.cssText = `color:${ch.color};font-size:12px;font-weight:bold;width:22px;text-align:right;flex-shrink:0`;
      lumEl.textContent = '--'; ch.lumEl = lumEl;
      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'color:#445;font-size:8px;width:26px;text-align:right;flex-shrink:0;white-space:nowrap';
      ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;
      r1.append(tog, lblInp, lumEl, ptsEl);

      const r2 = row(3);
      const szInp = mkNum(ch.probeW != null ? ch.probeW : ML.state.probeW, 16, 500, 2, 34);
      ch._szInp = szInp;
      function applyChanPx(v) { const c = Math.max(16, Math.min(500, Math.round(v/2)*2)); ch.probeW = c; szInp.value = c; if (ch.active && ch.resize) ch.resize(); }
      const szM = mkBtn('\u2212', '#1e2a3a', 'padding:1px 4px');
      const szP = mkBtn('+',    '#1e2a3a', 'padding:1px 4px');
      szM.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) - 2);
      szP.onclick = () => applyChanPx((ch.probeW != null ? ch.probeW : ML.state.probeW) + 2);
      szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
      szInp.addEventListener('keydown', e => {
        if (e.key==='Enter')     { e.preventDefault(); applyChanPx(parseInt(szInp.value)||ML.state.probeW); szInp.blur(); }
        if (e.key==='ArrowUp')   { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)+2); }
        if (e.key==='ArrowDown') { e.preventDefault(); applyChanPx((parseInt(szInp.value)||16)-2); }
      });
      const offEl = document.createElement('span');
      offEl.style.cssText = 'color:#778;font-size:9px;font-weight:bold;flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0';
      offEl.textContent = i === 0 ? '0.000s' : '--'; ch.offsetEl = offEl;
      // confEl agora mostra "XX%@Ys"
      const confEl = document.createElement('span');
      confEl.style.cssText = 'color:#778;font-size:8px;width:36px;text-align:right;flex-shrink:0;white-space:nowrap';
      confEl.textContent = i === 0 ? '100%' : '--'; ch.confEl = confEl;
      r2.append(sp('px','font-size:8px;flex-shrink:0'), szM, szInp, szP, offEl, confEl);
      chWrap.append(r1, r2);
      secDet.appendChild(chWrap);
    });
    panel.appendChild(secDet);

    /* ═══ ANALISE ═══ */
    const secAn = sec('Analise');
    const btnRec     = mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;color:#ce93d8;opacity:.45');

    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#7f0000'; btnRec.style.borderColor = '#c6282888'; btnRec.style.boxShadow = '0 0 8px #c6282855';
        statusEl.textContent = 'Gravando...'; statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach(ch => {
          if (ML.CHANNELS.indexOf(ch) !== 0) {
            if (ch.offsetEl) ch.offsetEl.textContent = '--';
            if (ch.confEl)   ch.confEl.textContent   = '--';
          }
        });
      } else {
        ML.recorder.stop();
        btnRec.textContent = '\u25cf GRAVAR';
        btnRec.style.background = '#1b5e20'; btnRec.style.borderColor = '#2e7d3288'; btnRec.style.boxShadow = '0 0 8px #1b5e2066';
        statusEl.textContent = 'Pronto (' + ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ') + ')';
        statusEl.style.color = '#ffd700';
        btnAnalyze.disabled = false;
      }
    };

    btnAnalyze.onclick = () => {
      statusEl.textContent = 'Calculando (testando 5s→60s)...'; statusEl.style.color = '#778';
      // setTimeout para liberar o render antes do cálculo pesado
      setTimeout(() => {
        const results = ML.correlator.analyzeBestAll();
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
              const pct  = Math.round(r.confidence * 100);
              const lagS = r.lagUsedMs ? (r.lagUsedMs / 1000) + 's' : '';
              ch.confEl.textContent = pct + '%' + (lagS ? '@' + lagS : '');
              ch.confEl.style.color = r.confidence > 0.6 ? '#44ff88' : r.confidence > 0.3 ? '#ffd700' : '#ff4444';
            } else {
              ch.confEl.textContent = '--';
              ch.confEl.style.color = '#3a3a5a';
            }
          }
        });
        ML.chart.show(results);
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

    const rowBtns = row(6); rowBtns.style.marginBottom = '6px';
    rowBtns.append(btnRec, btnAnalyze);
    secAn.appendChild(rowBtns);
    panel.appendChild(secAn);

    /* ═══ STATUS ═══ */
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:9px;color:#667;padding:4px 10px 5px',
      'border-top:1px solid #1a1a30;text-align:center;font-style:italic',
      'background:#0e0e1a;border-radius:0 0 6px 6px',
      'overflow:hidden;white-space:nowrap;text-overflow:ellipsis',
    ].join(';');
    statusEl.textContent = 'Posicione os probes e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl };
    setInterval(() => { ML.CHANNELS.forEach(ch => { if (ch.ptsEl) ch.ptsEl.textContent = ch.buffer.length + 'pt'; }); }, 1000);
    console.log('[MedLat] 50-panel carregado (analyzeBest autom\u00e1tico).');
  }

  ML.panel = { init };
})();
