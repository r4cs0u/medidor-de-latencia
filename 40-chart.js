(function () {
  const ML = window.MedLat;
  const ui = ML.ui;
  const MAX_PEAKS = 15;
  const SNAP_RADIUS = 15;

  function loadChartJs() {
    return new Promise((resolve) => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  function topPeaks(diffArr, color, n) {
    const candidates = [];
    diffArr.forEach((d, i) => { if (d > 0) candidates.push({ xIndex: i, color, mag: d }); });
    candidates.sort((a, b) => b.mag - a.mag);
    return candidates.slice(0, n).map(({ xIndex, color }) => ({ xIndex, color }));
  }

  function makePeakPlugin(peakAnnotations) {
    return {
      id: 'peakLines',
      afterDraw(chart) {
        if (!peakAnnotations.length) return;
        const ctx   = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        if (!xAxis || !yAxis) return;
        ctx.save();
        peakAnnotations.forEach(({ xIndex, color, snapDist }) => {
          const xPx = xAxis.getPixelForValue(xIndex);
          if (xPx < xAxis.left || xPx > xAxis.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yAxis.top);
          ctx.lineTo(xPx, yAxis.bottom);
          if (snapDist === 0) {
            ctx.strokeStyle = '#ffffffcc';
            ctx.lineWidth   = 3;
            ctx.setLineDash([5, 3]);
          } else if (Math.abs(snapDist) === 1) {
            ctx.strokeStyle = '#88888888';
            ctx.lineWidth   = 1.5;
            ctx.setLineDash([]);
          } else if (snapDist != null && Math.abs(snapDist) <= SNAP_RADIUS) {
            ctx.strokeStyle = '#55555544';
            ctx.lineWidth   = 1;
            ctx.setLineDash([]);
          } else {
            ctx.strokeStyle = color + '40';
            ctx.lineWidth   = 1;
            ctx.setLineDash([]);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        });
        ctx.restore();
      },
    };
  }

  async function showChart(results) {
    if (!Array.isArray(results)) results = [results];
    await loadChartJs();
    ui.injectSliderCSS();
    const old = document.getElementById('ml-chart-panel');
    if (old) old.remove();

    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { left: window.innerWidth - 248, top: 8, width: 228, height: 0 };

    const GAP = 6;
    const initLeft = GAP;
    const initTop  = GAP;
    const INIT_W = Math.max(320, mpRect.left - initLeft - GAP);
    const INIT_H = Math.max(260, window.innerHeight - initTop - GAP);

    const panel = document.createElement('div');
    panel.id = 'ml-chart-panel';
    panel.style.cssText = [
      `position:fixed;left:${initLeft}px;top:${initTop}px`,
      `width:${INIT_W}px;height:${INIT_H}px`,
      'z-index:99998;min-width:180px;min-height:200px',
      'background:#0e0e1aee;border:1px solid #2a2a4a',
      'border-radius:8px;box-shadow:0 4px 24px #000d',
      'font-family:monospace;font-size:10px;color:#ccc',
      'user-select:none;overflow:hidden;display:flex;flex-direction:column',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:5px;padding:5px 8px 4px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:8px 8px 0 0;cursor:move;flex-shrink:0',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '\uD83D\uDCCA Lumin\u00e2ncia';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    let chartMode = 'parallel';
    const btnMode = document.createElement('button');
    btnMode.style.cssText = 'background:#1e2a3a;border:1px solid #2a3a50;color:#00d4ff;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap';
    function updateModeBtn() { btnMode.textContent = chartMode === 'parallel' ? '\u2af4 Paralelo' : '\u29c9 Sobreposto'; }
    updateModeBtn();

    let manualMode = false;
    const btnManual = document.createElement('button');
    btnManual.style.cssText = 'background:#1a2a1a;border:1px solid #44ff8855;color:#44ff88;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap';
    function updateManualBtn() {
      btnManual.textContent = manualMode ? '\u270e Ajustando' : '\u270e Manual';
      btnManual.style.background  = manualMode ? '#44ff8833' : '#1a2a1a';
      btnManual.style.borderColor = manualMode ? '#44ff88'   : '#44ff8855';
    }
    updateManualBtn();

    let showPeaks = true;
    const btnPeaks = document.createElement('button');
    btnPeaks.style.cssText = 'background:#1e2a1a;border:1px solid #44ff8855;color:#44ff88;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap';
    function updatePeaksBtn() { btnPeaks.textContent = showPeaks ? '\u25fc Picos' : '\u25fb Picos'; btnPeaks.style.opacity = showPeaks ? '1' : '0.45'; }
    updatePeaksBtn();
    btnPeaks.onclick = () => { showPeaks = !showPeaks; updatePeaksBtn(); rebuildCharts(); };

    const btnClose = document.createElement('button');
    btnClose.textContent = '\u2715';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => panel.remove();

    hdr.append(htitle, btnManual, btnPeaks, btnMode, btnClose);
    panel.appendChild(hdr);

    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== htitle) return;
      pdrag = true; panel.style.right = 'auto';
      pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    [['nw','nw-resize','top:0;left:0'],['ne','ne-resize','top:0;right:0'],
     ['sw','sw-resize','bottom:0;left:0'],['se','se-resize','bottom:0;right:0']]
    .forEach(([cls, cur, pos]) => {
      const h = document.createElement('div');
      h.style.cssText = `position:absolute;width:14px;height:14px;cursor:${cur};z-index:10;${pos}`;
      const dot = document.createElement('div');
      const isN = cls[0]==='n', isW = cls[1]==='w';
      dot.style.cssText = `position:absolute;width:5px;height:5px;border-radius:2px;background:#2a3a6a;${isN?'top:3px':'bottom:3px'};${isW?'left:3px':'right:3px'}`;
      h.appendChild(dot); panel.appendChild(h);
      let rsx=0,rsy=0,rsw=0,rsh=0,rsl=0,rst=0;
      h.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        rsx=e.clientX; rsy=e.clientY; rsw=panel.offsetWidth; rsh=panel.offsetHeight; rsl=panel.offsetLeft; rst=panel.offsetTop;
        function onMove(ev) {
          const dx=ev.clientX-rsx, dy=ev.clientY-rsy;
          let nw=rsw,nh=rsh,nl=rsl,nt=rst;
          if (isW){nw=Math.max(180,rsw-dx);nl=rsl+rsw-nw;}else{nw=Math.max(180,rsw+dx);}
          if (isN){nh=Math.max(200,rsh-dy);nt=rst+rsh-nh;}else{nh=Math.max(200,rsh+dy);}
          panel.style.width=nw+'px';panel.style.height=nh+'px';panel.style.left=nl+'px';panel.style.top=nt+'px';
          rebuildCharts();
        }
        function onUp(){window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);}
        window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
      });
    });

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:4px 8px 6px;display:flex;flex-direction:column;gap:4px;min-height:0';
    panel.appendChild(body);

    const activeChannels = [];
    let maxLen = 0;
    ML.CHANNELS.forEach(ch => {
      if (!ch.active || !ch.buffer || ch.buffer.length < 2) return;
      activeChannels.push(ch);
      if (ch.buffer.length > maxLen) maxLen = ch.buffer.length;
    });

    // ── Três camadas de offset ────────────────────────────────────────────────
    //
    // originalAutoMs[id]  → resultado do cálculo automático. IMUTÁVEL.
    //                        Usado apenas pelo Reset (volta tudo ao auto).
    //
    // confirmedMs[id]     → último valor confirmado pelo usuário.
    //                        Inicia = originalAutoMs.
    //                        Atualizado a cada “Confirmar ajuste”.
    //                        É o que o gráfico exibe fora do modo Manual.
    //
    // fineShiftSamples[id]→ ajuste fino da régua RELATIVO ao confirmedMs.
    //                        0 = centro da régua = posição confirmada.
    //                        Reset de linha volta fine=0 (gráfico fica em confirmedMs).
    //                        Dentro do Manual: total = confirmedMs + fine*iv
    //
    // Fluxo confirmar:
    //   confirmedMs[id] = confirmedMs[id] + fineShiftSamples[id] * iv
    //   fineShiftSamples[id] = 0  (slider volta ao centro)
    //   → gráfico dentro E fora do manual mostra a mesma posição

    const originalAutoMs = {};
    const confirmedMs    = {};
    ML.CHANNELS.forEach(ch => { originalAutoMs[ch.id] = 0; confirmedMs[ch.id] = 0; });
    results.forEach(r => {
      if (r.isReference || !r.channel || r.error || r.skipped || r.offsetMs == null) return;
      originalAutoMs[r.channel.id] = r.offsetMs;
      confirmedMs[r.channel.id]    = r.offsetMs;
    });

    // fineShift em amostras (slider.value = fineShiftSamples)
    const fineShiftSamples = {};
    ML.CHANNELS.forEach(ch => { fineShiftSamples[ch.id] = 0; });

    // ── Escala Y fixa: calculada dos dados BRUTOS uma única vez ─────────
    const fixedYScale = {};
    ML.CHANNELS.forEach(ch => {
      if (!ch.buffer || !ch.buffer.length) { fixedYScale[ch.id] = { min: 0, max: 255 }; return; }
      const lums = ch.buffer.map(p => p.lum).filter(v => v != null);
      if (!lums.length) { fixedYScale[ch.id] = { min: 0, max: 255 }; return; }
      const lMin = Math.min(...lums);
      const lMax = Math.max(...lums);
      const rng  = Math.max(1, lMax - lMin);
      fixedYScale[ch.id] = {
        min: Math.max(0,   Math.floor(lMin - rng * 0.10)),
        max: Math.min(255, Math.ceil(lMax  + rng * 0.10)),
      };
    });
    let fixedGlobalYMin = Infinity, fixedGlobalYMax = -Infinity;
    activeChannels.forEach(ch => {
      fixedGlobalYMin = Math.min(fixedGlobalYMin, fixedYScale[ch.id].min);
      fixedGlobalYMax = Math.max(fixedGlobalYMax, fixedYScale[ch.id].max);
    });
    if (!isFinite(fixedGlobalYMin)) { fixedGlobalYMin = 0; fixedGlobalYMax = 255; }

    const cardRefs = {};

    function buildCards() {
      const hasResults = results.some(r => !r.isReference && !r.error && !r.skipped);
      if (!hasResults) return;
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;flex-wrap:nowrap;gap:4px;flex-shrink:0;overflow-x:auto;padding-bottom:2px';
      const ref = ML.CHANNELS[0];
      bar.appendChild(mkCardCompact(ref.label, '\u2605', ref.color, '0.000s', ref.color));
      results.forEach(r => {
        if (r.isReference || !r.channel) return;
        const ch = r.channel;
        let autoTxt = '--', autoColor = '#445';
        if (!r.error && !r.skipped) {
          const s = originalAutoMs[ch.id] / 1000;
          autoTxt   = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
          autoColor = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
        } else {
          autoTxt   = r.error ? 'ERR' : '--';
          autoColor = r.error ? '#ff4444' : '#445';
        }
        const card = mkCardCompact(ch.label, '', ch.color, autoTxt, autoColor);
        cardRefs[ch.id] = { ch, manualEl: card._manualEl, valEl: card._valEl };
        bar.appendChild(card);
      });
      body.appendChild(bar);
    }
    buildCards();

    function updateCardResult(chId, totalMs) {
      const ref = cardRefs[chId];
      if (!ref || !ref.valEl) return;
      const s = totalMs / 1000;
      ref.valEl.textContent = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
      ref.valEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
    }
    function updateCardManual(chId, totalMs) {
      const ref = cardRefs[chId];
      if (!ref || !ref.manualEl) return;
      const el  = ref.manualEl;
      const s   = totalMs / 1000;
      el.style.display = 'inline';
      el.textContent   = ' \u2192 ' + (s>=0?'+':'') + s.toFixed(3) + 's';
      el.style.color   = Math.abs(s)<0.1?'#44ff88':Math.abs(s)<1?'#ffd700':'#00d4ff';
    }
    function hideCardManual(chId) {
      const ref = cardRefs[chId];
      if (ref && ref.manualEl) { ref.manualEl.style.display = 'none'; ref.manualEl.textContent = ''; }
    }

    if (!activeChannels.length) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:16px;text-align:center;flex:1';
      msg.textContent = 'Nenhum canal com dados gravados.';
      body.appendChild(msg); document.body.appendChild(panel); return;
    }

    const toggleBar = document.createElement('div');
    toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;flex-shrink:0';
    activeChannels.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.dataset.active = '1';
      btn.style.cssText = [
        `background:${ch.color}22;border:1px solid ${ch.color}88;color:${ch.color}`,
        'border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;transition:opacity .15s',
      ].join(';');
      btn.textContent = (idx === 0 ? '\u2605 ' : '') + ch.label;
      btn.onclick = () => { const on=btn.dataset.active==='1'; btn.dataset.active=on?'0':'1'; btn.style.opacity=on?'0.35':'1'; rebuildCharts(); };
      toggleBar.appendChild(btn);
    });
    body.appendChild(toggleBar);

    const manualBar = document.createElement('div');
    manualBar.style.cssText = 'display:none;flex-direction:column;gap:4px;padding:4px 0;flex-shrink:0';

    const manualHint = document.createElement('div');
    manualHint.style.cssText = 'color:#ffd700;font-size:8px;text-align:center;opacity:.8';
    manualHint.textContent = '\u25c4 dir = mais atraso / offset maior | esq = menos atraso / offset menor \u25ba';
    manualBar.appendChild(manualHint);

    const btnResetAll = document.createElement('button');
    btnResetAll.textContent = '\u21ba Reset tudo';
    btnResetAll.title = 'Reseta todas as r\u00e9guas ao valor autom\u00e1tico original';
    btnResetAll.style.cssText = [
      'background:#2a1a1a;border:1px solid #ff884455;color:#ff8844',
      'border-radius:3px;padding:2px 8px;cursor:pointer;font:bold 8px monospace;width:100%',
    ].join(';');

    const sliderRefs = {};
    const peaksByChannel = {};
    let snapEnabled = true;

    function getRefPeakIndices() {
      if (peaksByChannel['__ref__']) return peaksByChannel['__ref__'];
      const refCh = activeChannels[0];
      if (!ML.correlator) return [];
      const lums = refCh.buffer.map(p => p.lum);
      const diff = ML.correlator.diffSeries(lums);
      peaksByChannel['__ref__'] = topPeaks(diff, refCh.color, MAX_PEAKS).map(p => p.xIndex);
      return peaksByChannel['__ref__'];
    }
    function getPeakIndices(ch) {
      if (peaksByChannel[ch.id]) return peaksByChannel[ch.id];
      if (!ML.correlator) return [];
      const lums = ch.buffer.map(p => p.lum);
      const diff = ML.correlator.diffSeries(lums);
      peaksByChannel[ch.id] = topPeaks(diff, ch.color, MAX_PEAKS).map(p => p.xIndex);
      return peaksByChannel[ch.id];
    }

    activeChannels.forEach((ch, idx) => {
      if (idx === 0) return;

      const iv    = ui.realIvMs(ch);
      const range = Math.max(50, Math.round(ch.buffer.length * 1.0));

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px';

      const lbl = document.createElement('span');
      lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:38px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
      lbl.textContent = ch.label;

      const slider = document.createElement('input');
      slider.type  = 'range';
      slider.min   = -range;
      slider.max   =  range;
      slider.step  = 1;
      // value=0 → centro da régua = posição confirmada (confirmedMs)
      slider.value = 0;
      slider.className = 'ml-slider';
      slider.style.cssText = `flex:1;accent-color:${ch.color}`;

      const btnReset = document.createElement('button');
      btnReset.textContent = '\u21ba';
      btnReset.title = 'Reset ' + ch.label + ' — volta para valor calculado automaticamente';
      btnReset.style.cssText = 'background:#2a1a1a;border:1px solid #ff884444;color:#ff8844;border-radius:3px;padding:0 4px;cursor:pointer;font:bold 9px monospace;flex-shrink:0;line-height:14px;width:18px;text-align:center';

      const btnSnap = document.createElement('button');
      btnSnap.title = 'Snap magn\u00e9tico aos picos da refer\u00eancia';
      btnSnap.style.cssText = 'background:#1a1a2e;border:1px solid #ffd70066;color:#ffd700;border-radius:3px;padding:0;cursor:pointer;font:bold 10px monospace;flex-shrink:0;line-height:14px;width:20px;height:16px;text-align:center;overflow:hidden';
      function updateSnapBtn() {
        btnSnap.textContent   = snapEnabled ? '\uD83E\uDDF2' : '\u2014';
        btnSnap.style.opacity     = snapEnabled ? '1'        : '0.5';
        btnSnap.style.borderColor = snapEnabled ? '#ffd700aa' : '#ffd70033';
        btnSnap.style.color       = snapEnabled ? '#ffd700'   : '#666';
      }
      updateSnapBtn();
      btnSnap.onclick = () => { snapEnabled = !snapEnabled; updateSnapBtn(); };

      const valLbl = document.createElement('span');
      valLbl.style.cssText = 'color:#aaa;font-size:8px;width:52px;flex-shrink:0;text-align:right;white-space:nowrap';

      // Valor da régua = confirmedMs + fine*iv
      // slider=0 exibe confirmedMs (posição atual confirmada)
      function refreshLabel(fineVal) {
        const totalMs = (confirmedMs[ch.id] || 0) + fineVal * iv;
        const s       = totalMs / 1000;
        valLbl.textContent = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
        valLbl.style.color = fineVal === 0 ? '#44ff88' : (totalMs >= 0 ? '#ffd700' : '#00d4ff');
        return { totalMs };
      }
      refreshLabel(0);

      // Reset linha: volta fine=0 e confirmedMs ao valor automático original.
      // O gráfico volta à posição do cálculo automático.
      function doReset() {
        confirmedMs[ch.id]    = originalAutoMs[ch.id];
        fineShiftSamples[ch.id] = 0;
        slider.value = 0;
        refreshLabel(0);
        hideCardManual(ch.id);
        rebuildCharts();
      }
      btnReset.onclick = doReset;

      slider.addEventListener('input', () => {
        let sliderVal = parseInt(slider.value);

        if (snapEnabled && ML.correlator) {
          const refPeaks = getRefPeakIndices();
          const chPeaks  = getPeakIndices(ch);
          const confSamp = Math.round((confirmedMs[ch.id] || 0) / iv);
          let bestSnap = null, bestDist = Infinity;
          chPeaks.forEach(cp => {
            const shiftedPos = cp - confSamp - sliderVal;
            refPeaks.forEach(rp => {
              const dist = rp - shiftedPos;
              if (Math.abs(dist) < Math.abs(bestDist) && Math.abs(dist) <= SNAP_RADIUS) {
                bestDist = dist;
                bestSnap = sliderVal + dist;
              }
            });
          });
          if (bestSnap !== null) {
            sliderVal = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), bestSnap));
            slider.value = sliderVal;
          }
        }

        fineShiftSamples[ch.id] = sliderVal;
        const { totalMs } = refreshLabel(sliderVal);
        if (manualMode) updateCardManual(ch.id, totalMs);
        rebuildCharts();
      });

      sliderRefs[ch.id] = { slider, valLbl, range, doReset, refreshLabel };
      row.append(lbl, slider, btnReset, btnSnap, valLbl);
      manualBar.appendChild(row);
    });

    // Reset tudo: volta confirmedMs ao auto e fine=0 em todos os canais
    btnResetAll.onclick = () => { Object.values(sliderRefs).forEach(r => r.doReset()); };
    manualBar.appendChild(btnResetAll);

    const btnConfirm = document.createElement('button');
    btnConfirm.textContent = '\u2714 Confirmar ajuste';
    btnConfirm.style.cssText = [
      'background:#44ff8833;border:1px solid #44ff88;color:#44ff88',
      'border-radius:3px;padding:3px 8px;cursor:pointer;font:bold 8px monospace',
      'width:100%;margin-top:1px',
    ].join(';');
    btnConfirm.onclick = () => {
      ML.manualOffsets = ML.manualOffsets || {};
      activeChannels.forEach((ch, idx) => {
        if (idx === 0) return;
        const iv   = ui.realIvMs(ch);
        const fine = fineShiftSamples[ch.id] || 0;
        // Absorve o fine no confirmedMs e zera a régua
        const totalMs = (confirmedMs[ch.id] || 0) + fine * iv;
        confirmedMs[ch.id]      = totalMs;   // gráfico fora do manual agora usa este
        fineShiftSamples[ch.id] = 0;         // régua volta ao centro
        if (sliderRefs[ch.id]) sliderRefs[ch.id].slider.value = 0;
        if (sliderRefs[ch.id]) sliderRefs[ch.id].refreshLabel(0);
        ML.manualOffsets[ch.id] = totalMs;
        updateCardResult(ch.id, totalMs);
        hideCardManual(ch.id);
      });
      // Propaga para tabela do painel principal
      if (ML.panel && ML.panel.refreshOffsets) ML.panel.refreshOffsets(ML.manualOffsets);
      rebuildCharts();
      btnConfirm.textContent = '\u2714 Salvo!';
      setTimeout(() => { btnConfirm.textContent = '\u2714 Confirmar ajuste'; }, 1500);
    };
    manualBar.appendChild(btnConfirm);
    body.appendChild(manualBar);

    btnManual.onclick = () => {
      manualMode = !manualMode;
      updateManualBtn();
      manualBar.style.display = manualMode ? 'flex' : 'none';
      if (!manualMode) activeChannels.forEach(ch => hideCardManual(ch.id));
      rebuildCharts();
    };
    btnMode.onclick = () => { chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel'; updateModeBtn(); rebuildCharts(); };

    const chartsArea = document.createElement('div');
    chartsArea.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:2px;overflow:hidden';
    body.appendChild(chartsArea);

    const refCh = activeChannels[0];
    const sharedLabels = refCh.buffer.slice(0, maxLen).map((p, i) => {
      const s = ((p.ts - refCh.buffer[0].ts) / 1000).toFixed(2);
      return `f${i} (${s}s)`;
    });

    let chartInstances = [];

    function getVisibleChannels() {
      return activeChannels.filter((_, i) => { const b = toggleBar.children[i]; return b && b.dataset.active === '1'; });
    }
    function destroyCharts() {
      chartInstances.forEach(c => { try { c.destroy(); } catch(e) {} });
      chartInstances = []; chartsArea.innerHTML = '';
    }
    function rebuildCharts() {
      destroyCharts();
      const visible = getVisibleChannels();
      if (!visible.length) return;
      chartMode === 'overlay' ? buildOverlay(visible) : buildParallel(visible);
    }

    function xMaxTicks() {
      return Math.max(5, Math.floor((chartsArea.offsetWidth || 400) / 60));
    }

    function shiftSeries(data, shift) {
      if (!shift) return data;
      const n   = data.length;
      const out = new Array(n).fill(null);
      if (shift > 0) {
        for (let i = 0; i < n - shift; i++) out[i] = data[i + shift];
      } else {
        const s = -shift;
        for (let i = s; i < n; i++) out[i] = data[i - s];
      }
      return out;
    }

    // Fora do manual: usa confirmedMs (posição confirmada)
    // Dentro do manual: usa confirmedMs + fine (ajuste em tempo real)
    // Assim o gráfico é idêntico dentro e fora do modo manual quando fine=0
    function getTotalShift(ch, idx) {
      if (idx === 0) return 0;
      const iv           = ui.realIvMs(ch);
      const confSamples  = Math.round((confirmedMs[ch.id] || 0) / iv);
      if (!manualMode) return confSamples;
      return confSamples + (fineShiftSamples[ch.id] || 0);
    }

    function getPeakAnnotations(ch, lums) {
      if (!showPeaks || !ML.correlator) return [];
      const diff = ML.correlator.diffSeries(lums.map(v => v ?? 0));
      return topPeaks(diff, ch.color, MAX_PEAKS);
    }

    function markSnapPeaks(annotations, refAnnotations) {
      annotations.forEach(a => {
        let bestDist = null;
        refAnnotations.forEach(r => {
          const dist = a.xIndex - r.xIndex;
          if (Math.abs(dist) <= SNAP_RADIUS && (bestDist == null || Math.abs(dist) < Math.abs(bestDist))) bestDist = dist;
        });
        if (bestDist != null) a.snapDist = bestDist;
      });
    }

    function buildParallel(channels) {
      const totalGap = (channels.length - 1) * 2;
      const rowH = Math.max(48, Math.floor((chartsArea.offsetHeight - totalGap) / channels.length));
      const ticks = xMaxTicks();
      let refAnnotations = [];
      channels.forEach((ch, idx) => {
        const rawLums = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const shift   = getTotalShift(ch, idx);
        const lums    = shiftSeries(rawLums, shift);
        const { min: yMin, max: yMax } = fixedYScale[ch.id] || { min: 0, max: 255 };
        const peaks = getPeakAnnotations(ch, lums);
        if (idx === 0) refAnnotations = peaks; else markSnapPeaks(peaks, refAnnotations);

        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:stretch;gap:4px;height:${rowH}px;flex-shrink:0;padding:2px 3px;border-radius:4px;background:${ch.color}0d;box-shadow:inset 0 0 0 1px ${ch.color}22;overflow:hidden`;
        const lbl = document.createElement('div');
        lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:36px;flex-shrink:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
        lbl.textContent = (idx === 0 ? '\u2605 ' : '') + ch.label;
        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex:1;min-width:0;overflow:hidden';
        const cvs = document.createElement('canvas');
        wrap.appendChild(cvs); row.append(lbl, wrap); chartsArea.appendChild(row);
        const ci = new Chart(cvs, {
          type: 'line',
          data: { labels: sharedLabels, datasets: [{ data: lums, borderColor: ch.color, backgroundColor: ch.color + '18', borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: true, spanGaps: false }] },
          options: {
            animation: false, responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            layout: { padding: { top: 1, right: 2, bottom: 0, left: 0 } },
            scales: {
              x: {
                display: idx === channels.length - 1,
                ticks: { color: '#556', font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: ticks },
                grid: { color: '#16162a' },
              },
              y: {
                min: yMin, max: yMax,
                ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 3 },
                grid: { color: '#16162a' },
              },
            },
          },
          plugins: peaks.length ? [makePeakPlugin(peaks)] : [],
        });
        chartInstances.push(ci);
      });
    }

    function buildOverlay(channels) {
      const ticks = xMaxTicks();
      let refAnnotations = [];
      const allLumsShifted = channels.map((ch, idx) => {
        const raw   = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const shift = getTotalShift(ch, idx);
        const lums  = shiftSeries(raw, shift);
        return { ch, lums, idx };
      });
      const allPeaks = showPeaks && ML.correlator
        ? allLumsShifted.flatMap(({ ch, lums, idx }) => {
            const peaks = getPeakAnnotations(ch, lums);
            if (idx === 0) { refAnnotations = peaks; return peaks; }
            markSnapPeaks(peaks, refAnnotations);
            return peaks;
          })
        : [];
      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-height:0;overflow:hidden;border-radius:4px;background:#0a0a16;border:1px solid #1a1a30;position:relative';
      if (manualMode) {
        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;top:2px;left:50%;transform:translateX(-50%);color:#ffd70088;font-size:7px;pointer-events:none;z-index:2;white-space:nowrap';
        hint.textContent = '\u25b6 Ajuste fino pelas r\u00e9guas abaixo';
        wrap.appendChild(hint);
      }
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs); chartsArea.appendChild(wrap);
      const datasets = allLumsShifted.map(({ ch, lums }) => ({
        label: ch.label, data: lums,
        borderColor: ch.color, backgroundColor: ch.color + '18',
        borderWidth: 1.6, pointRadius: 0, tension: 0.2, fill: true, spanGaps: false,
      }));
      const ci = new Chart(cvs, {
        type: 'line', data: { labels: sharedLabels, datasets },
        options: {
          animation: false, responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: true, position: 'bottom', labels: { color: '#778', font: { size: 8, family: 'monospace' }, boxWidth: 10, padding: 8 } },
            tooltip: {
              enabled: true, backgroundColor: '#12121fee', titleColor: '#00d4ff',
              bodyColor: '#aaa', borderColor: '#2a2a4a', borderWidth: 1,
              titleFont: { size: 8, family: 'monospace' }, bodyFont: { size: 8, family: 'monospace' },
              callbacks: {
                title: items => items[0].label || '',
                label: item => ` ${item.dataset.label}: ${item.parsed.y != null ? item.parsed.y.toFixed(1) : '--'}`,
              },
            },
          },
          layout: { padding: { top: 2, right: 4, bottom: 0, left: 0 } },
          scales: {
            x: { ticks: { color: '#556', font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: ticks }, grid: { color: '#16162a' } },
            y: { min: fixedGlobalYMin, max: fixedGlobalYMax, ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 5 }, grid: { color: '#16162a' } },
          },
        },
        plugins: allPeaks.length ? [makePeakPlugin(allPeaks)] : [],
      });
      chartInstances.push(ci);
    }

    document.body.appendChild(panel);
    requestAnimationFrame(() => rebuildCharts());
  }

  function mkCardCompact(label, prefix, color, autoTxt, autoColor) {
    const card = document.createElement('div');
    card.style.cssText = [
      'display:inline-flex;align-items:center;gap:5px;flex-shrink:0',
      `border:1px solid ${color}55;border-top:2px solid ${color}99`,
      `background:${color}0d;border-radius:4px;padding:3px 6px`,
    ].join(';');
    if (prefix) {
      const sp = document.createElement('span');
      sp.textContent = prefix; sp.style.cssText = `color:${color};font-size:9px;flex-shrink:0`;
      card.appendChild(sp);
    }
    const nm = document.createElement('span');
    nm.textContent = label;
    nm.style.cssText = `color:${color};font-weight:bold;font-size:8px;white-space:nowrap;max-width:56px;overflow:hidden;text-overflow:ellipsis`;
    const vl = document.createElement('span');
    vl.textContent = autoTxt; vl.style.cssText = `color:${autoColor};font-weight:bold;font-size:9px;white-space:nowrap`;
    card._valEl = vl;
    const manualEl = document.createElement('span');
    manualEl.style.display = 'none';
    card._manualEl = manualEl;
    card.append(nm, vl, manualEl);
    return card;
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart carregado.');
})();
