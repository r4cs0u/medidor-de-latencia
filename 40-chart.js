(function () {
  const ML = window.MedLat;
  let MAX_PEAKS = 15;
  const SNAP_RADIUS = 3;

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
            ctx.strokeStyle = '#ffffff88';
            ctx.lineWidth   = 2;
            ctx.setLineDash([3, 3]);
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

  function injectSliderCSS() {
    if (document.getElementById('ml-slider-css')) return;
    const st = document.createElement('style');
    st.id = 'ml-slider-css';
    st.textContent = `
      .ml-slider {
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 0;
        outline: none;
        cursor: pointer;
      }
      .ml-slider::-webkit-slider-runnable-track {
        height: 6px;
        border-radius: 0;
        background: repeating-linear-gradient(
          90deg,
          #2a3a50 0px, #2a3a50 1px,
          transparent 1px, transparent 10%
        ), #1a2a3a;
      }
      .ml-slider::-moz-range-track {
        height: 6px;
        border-radius: 0;
        background: repeating-linear-gradient(
          90deg,
          #2a3a50 0px, #2a3a50 1px,
          transparent 1px, transparent 10%
        ), #1a2a3a;
      }
      .ml-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 10px;
        height: 18px;
        border-radius: 2px;
        background: #00d4ff;
        border: 1px solid #007a99;
        cursor: grab;
        margin-top: -6px;
      }
      .ml-slider::-moz-range-thumb {
        width: 10px;
        height: 18px;
        border-radius: 2px;
        background: #00d4ff;
        border: 1px solid #007a99;
        cursor: grab;
      }
      .ml-slider:active::-webkit-slider-thumb { cursor: grabbing; background: #44eeff; }
      .ml-slider:active::-moz-range-thumb     { cursor: grabbing; background: #44eeff; }
    `;
    document.head.appendChild(st);
  }

  async function showChart(results) {
    if (!Array.isArray(results)) results = [results];
    await loadChartJs();
    injectSliderCSS();
    const old = document.getElementById('ml-chart-panel');
    if (old) old.remove();

    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { left: window.innerWidth - 248, top: 8, width: 228, height: 0 };

    const sidePanelW = (mpRect.width || 228) + 16;
    const INIT_W = Math.max(400, window.innerWidth - sidePanelW - 8);
    const INIT_H = Math.max(300, window.innerHeight - 16);
    const initLeft = 4;
    const initTop  = 8;

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

    const selPeaks = document.createElement('select');
    selPeaks.style.cssText = [
      'background:#1e2a3a;border:1px solid #2a3a50;color:#ffd700',
      'border-radius:3px;padding:1px 4px;cursor:pointer;font:bold 8px monospace',
      'flex-shrink:0;outline:none;height:18px',
    ].join(';');
    [15, 20, 25, 30].forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n + ' picos';
      if (n === MAX_PEAKS) opt.selected = true;
      selPeaks.appendChild(opt);
    });
    selPeaks.addEventListener('change', () => {
      MAX_PEAKS = parseInt(selPeaks.value);
      Object.keys(peaksByChannel).forEach(k => delete peaksByChannel[k]);
      rebuildCharts();
    });

    const btnClose = document.createElement('button');
    btnClose.textContent = '\u2715';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => panel.remove();

    hdr.append(htitle, btnManual, btnPeaks, selPeaks, btnMode, btnClose);
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

    function realIvMs(ch) {
      if (ch.buffer && ch.buffer.length > 1) {
        const iv = (ch.buffer[ch.buffer.length-1].ts - ch.buffer[0].ts) / (ch.buffer.length - 1);
        if (iv >= 10 && iv <= 200) return iv;
      }
      return ML.INTERVAL_MS;
    }

    const autoOffsetMs = {};
    ML.CHANNELS.forEach(ch => {
      autoOffsetMs[ch.id] = (ML.manualOffsets && typeof ML.manualOffsets[ch.id] === 'number')
        ? ML.manualOffsets[ch.id]
        : 0;
    });
    results.forEach(r => {
      if (r.isReference || !r.channel || r.error || r.skipped || r.offsetMs == null) return;
      if (!(ML.manualOffsets && typeof ML.manualOffsets[r.channel.id] === 'number')) {
        autoOffsetMs[r.channel.id] = r.offsetMs;
      }
    });

    const fineShiftSamples = {};
    ML.CHANNELS.forEach(ch => { fineShiftSamples[ch.id] = 0; });

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
          const baseMs = autoOffsetMs[ch.id] || 0;
          const s      = baseMs / 1000;
          autoTxt      = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
          autoColor    = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
        } else {
          autoTxt   = r.error ? 'ERR' : '--';
          autoColor = r.error ? '#ff4444' : '#445';
        }

        const card = mkCardCompact(ch.label, '', ch.color, autoTxt, autoColor);
        cardRefs[ch.id] = { autoMs: autoOffsetMs[ch.id] || 0, ch, manualEl: card._manualEl };
        bar.appendChild(card);
      });
      body.appendChild(bar);
    }
    buildCards();

    function updateCardManual(chId, totalMs) {
      const ref = cardRefs[chId];
      if (!ref || !ref.manualEl) return;
      const el = ref.manualEl;
      const s  = totalMs / 1000;
      const manColor = Math.abs(s)<0.1?'#44ff88':Math.abs(s)<1?'#ffd700':'#00d4ff';
      el.style.display = 'inline';
      el.textContent = ' \u2192 ' + (s>=0?'+':'') + s.toFixed(3) + 's';
      el.style.color = manColor;
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
    manualHint.textContent = 'Gr\u00e1ficos j\u00e1 alinhados pelo Auto  |  arraste para ajuste fino';
    manualBar.appendChild(manualHint);

    const btnResetAll = document.createElement('button');
    btnResetAll.textContent = '\u21ba Reset tudo';
    btnResetAll.style.cssText = [
      'background:#2a1a1a;border:1px solid #ff884455;color:#ff8844',
      'border-radius:3px;padding:2px 8px;cursor:pointer;font:bold 8px monospace;width:100%',
    ].join(';');

    const sliderRefs = {};
    const peaksByChannel = {};

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

      const iv    = realIvMs(ch);
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
      slider.value = 0;
      slider.className = 'ml-slider';
      slider.style.cssText = `flex:1;accent-color:${ch.color}`;

      const btnReset = document.createElement('button');
      btnReset.textContent = '\u21ba';
      btnReset.title = 'Reset ' + ch.label;
      btnReset.style.cssText = `background:#2a1a1a;border:1px solid #ff884444;color:#ff8844;border-radius:3px;padding:0 4px;cursor:pointer;font:bold 9px monospace;flex-shrink:0;line-height:14px`;

      const valLbl = document.createElement('span');
      valLbl.style.cssText = 'color:#aaa;font-size:8px;width:52px;flex-shrink:0;text-align:right;white-space:nowrap';

      function refreshLabel(sliderVal) {
        const totalMs = (autoOffsetMs[ch.id] || 0) + sliderVal * iv;
        const s       = totalMs / 1000;
        valLbl.textContent = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
        valLbl.style.color = sliderVal === 0 ? '#aaa' : (totalMs >= 0 ? '#ffd700' : '#00d4ff');
        return { totalMs };
      }
      refreshLabel(0);

      function doReset() {
        slider.value = 0;
        fineShiftSamples[ch.id] = 0;
        refreshLabel(0);
        hideCardManual(ch.id);
        rebuildCharts();
      }
      btnReset.onclick = doReset;

      slider.addEventListener('input', () => {
        const sliderVal = parseInt(slider.value);
        fineShiftSamples[ch.id] = sliderVal;
        const { totalMs } = refreshLabel(sliderVal);
        if (manualMode) updateCardManual(ch.id, totalMs);
        rebuildCharts();
      });

      sliderRefs[ch.id] = { slider, valLbl, range, doReset };
      row.append(lbl, slider, btnReset, valLbl);
      manualBar.appendChild(row);
    });

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
        const iv   = realIvMs(ch);
        const fine = fineShiftSamples[ch.id] || 0;
        const totalMs = (autoOffsetMs[ch.id] || 0) + fine * iv;
        ML.manualOffsets[ch.id] = totalMs;
        autoOffsetMs[ch.id] = totalMs;
        fineShiftSamples[ch.id] = 0;
        if (sliderRefs[ch.id]) {
          sliderRefs[ch.id].slider.value = 0;
          sliderRefs[ch.id].valLbl.textContent = (totalMs >= 0 ? '+' : '') + (totalMs / 1000).toFixed(3) + 's';
          sliderRefs[ch.id].valLbl.style.color = '#aaa';
        }
        hideCardManual(ch.id);
      });
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
      if (!manualMode) {
        activeChannels.forEach(ch => hideCardManual(ch.id));
      }
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

    function getTotalShift(ch, idx) {
      if (idx === 0) return 0;
      const iv          = realIvMs(ch);
      const autoSamples = Math.round((autoOffsetMs[ch.id] || 0) / iv);
      if (!manualMode) return autoSamples;
      return autoSamples + (fineShiftSamples[ch.id] || 0);
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
          if (Math.abs(dist) <= SNAP_RADIUS && (bestDist == null || Math.abs(dist) < Math.abs(bestDist))) {
            bestDist = dist;
          }
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
        const validLums = lums.filter(v => v !== null);
        const lMin = validLums.length ? Math.min(...validLums) : 0;
        const lMax = validLums.length ? Math.max(...validLums) : 255;
        const rng  = Math.max(1, lMax - lMin);
        const peaks = getPeakAnnotations(ch, lums);
        if (idx === 0) refAnnotations = peaks; else markSnapPeaks(peaks, refAnnotations);

        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:stretch;gap:4px;height:${rowH}px;flex-shrink:0;padding:2px 3px;border-radius:4px;background:${ch.color}0d;border-left:2px solid ${ch.color};overflow:hidden`;
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
              y: { ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 3 }, grid: { color: '#16162a' },
                   min: Math.max(0, Math.floor(lMin - rng * .10)), max: Math.min(255, Math.ceil(lMax + rng * .10)) },
            },
          },
          plugins: peaks.length ? [makePeakPlugin(peaks)] : [],
        });
        chartInstances.push(ci);
      });
    }

    function buildOverlay(channels) {
      let globalMin = Infinity, globalMax = -Infinity;
      const allLumsShifted = channels.map((ch, idx) => {
        const raw   = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const shift = getTotalShift(ch, idx);
        const lums  = shiftSeries(raw, shift);
        lums.forEach(v => { if (v !== null) { if (v < globalMin) globalMin = v; if (v > globalMax) globalMax = v; } });
        return { ch, lums, idx };
      });
      if (!isFinite(globalMin)) { globalMin = 0; globalMax = 255; }
      const rng  = Math.max(1, globalMax - globalMin);
      const yMin = Math.max(0,   Math.floor(globalMin - rng * 0.10));
      const yMax = Math.min(255, Math.ceil(globalMax  + rng * 0.10));
      const ticks = xMaxTicks();

      let refAnnotations = [];
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
        hint.textContent = 'Auto alinhado \u2014 arraste para ajuste fino';
        wrap.appendChild(hint);
      }
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs); chartsArea.appendChild(wrap);

      const datasets = allLumsShifted.map(({ ch, lums }) => ({
        label:           ch.label,
        data:            lums,
        borderColor:     ch.color,
        backgroundColor: ch.color + '18',
        borderWidth:     1.6,
        pointRadius:     0,
        tension:         0.2,
        fill:            true,
        spanGaps:        false,
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
            x: {
              ticks: { color: '#556', font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: ticks },
              grid: { color: '#16162a' },
            },
            y: { min: yMin, max: yMax, ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 5 }, grid: { color: '#16162a' } },
          },
        },
        plugins: allPeaks.length ? [makePeakPlugin(allPeaks)] : [],
      });
      chartInstances.push(ci);
    }

    document.body.appendChild(panel);
    requestAnimationFrame(() => rebuildCharts());
  }

  // Cards sem indicador de confiança — exibe apenas label + latência calculada
  function mkCardCompact(label, prefix, color, autoTxt, autoColor) {
    const card = document.createElement('div');
    card.style.cssText = [
      'display:inline-flex;align-items:center;gap:5px;flex-shrink:0',
      `border:1px solid ${color}44;border-left:3px solid ${color}`,
      `background:${color}0d;border-radius:4px;padding:3px 7px 3px 5px`,
      'white-space:nowrap;overflow:hidden',
    ].join(';');
    const nameEl = document.createElement('span');
    nameEl.style.cssText = `color:${color};font-weight:bold;font-size:9px`;
    nameEl.textContent = (prefix ? prefix + ' ' : '') + label;
    const valEl = document.createElement('span');
    valEl.style.cssText = `color:${autoColor||'#44ff88'};font-weight:bold;font-size:11px`;
    valEl.textContent = autoTxt;
    const manualEl = document.createElement('span');
    manualEl.style.cssText = 'font-size:9px;display:none';
    manualEl.textContent = '';
    card.append(nameEl, valEl, manualEl);
    card._manualEl = manualEl;
    return card;
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart: confiança removida dos cards; snap com centro branco e ±1 cinza.');
})();
