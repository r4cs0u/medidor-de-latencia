(function () {
  const ML = window.MedLat;
  const ui  = ML.ui;

  // ── Constantes ──────────────────────────────────────────────────────────
  const CHART_JS_URL  = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
  const PANEL_ID      = 'ml-chart-panel';
  const UPDATE_MS     = 500;    // intervalo de refresh ao vivo
  const MAX_POINTS    = 600;    // janela deslizante (~20s a 30fps)
  const MAX_ANCHORS   = 30;     // máx de âncoras por canal

  // ── Estado interno ───────────────────────────────────────────────────────
  let chartPanel     = null;
  let liveTimer      = null;
  let chartInstances = [];
  let chartMode      = 'parallel'; // 'parallel' | 'overlay'
  let showAnchors    = true;
  let showChroma     = true;

  // ── Helpers ───────────────────────────────────────────────────────────
  function hex(color, alpha) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }

  // Magnitude de crominância: √(cb²+cr²), sempre positivo, 0–360 aprox.
  // Mesma lógica do buildHybridSeries do correlator.
  function chromaMag(p) {
    if (p.cb == null || p.cr == null) return null;
    return Math.sqrt(p.cb * p.cb + p.cr * p.cr);
  }

  // ── Carrega Chart.js sob demanda ──────────────────────────────────────────
  function loadChartJs() {
    return new Promise(resolve => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = CHART_JS_URL;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // ── Âncoras via buildHybridSeries (mesma série do correlator) ─────────────
  // Retorna índices absolutos no buf completo.
  function computeAnchors(buf) {
    if (!buf || buf.length < 2 || !ML.correlator) return [];
    const hybrid = ML.correlator.buildHybridSeries(buf);
    const diff   = ML.correlator.diffSeries(hybrid);
    const peaks  = [];
    diff.forEach((d, i) => { if (d > 0) peaks.push({ i, d }); });
    peaks.sort((a, b) => b.d - a.d);
    return peaks.slice(0, MAX_ANCHORS).map(p => p.i);
  }

  // ── Plugin de linhas verticais (âncoras) ─────────────────────────────────
  // anchorsAbs: índices absolutos no buf completo
  // windowStart: primeiro índice do slice exibido
  function makeAnchorPlugin(getAnchorsAbs, getWindowStart, color) {
    return {
      id: 'anchorLines_' + Math.random().toString(36).slice(2),
      afterDraw(chart) {
        if (!showAnchors) return;
        const abs   = getAnchorsAbs();
        const start = getWindowStart();
        if (!abs.length) return;
        const ctx   = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        if (!xAxis || !yAxis) return;
        ctx.save();
        abs.forEach(absIdx => {
          const relIdx = absIdx - start;
          if (relIdx < 0 || relIdx > xAxis.max) return;
          const xPx = xAxis.getPixelForValue(relIdx);
          if (xPx < xAxis.left || xPx > xAxis.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yAxis.top);
          ctx.lineTo(xPx, yAxis.bottom);
          ctx.strokeStyle = color + 'aa';
          ctx.lineWidth   = 1.5;
          ctx.stroke();
        });
        ctx.restore();
      },
    };
  }

  // ── Janela deslizante de dados ──────────────────────────────────────────
  function getWindowData(ch) {
    const buf   = ch.rollingBuffer ? ch.rollingBuffer.toArray() : [];
    if (!buf.length) return { lums: [], chromas: [], anchors: [], windowStart: 0, len: 0 };
    const total       = buf.length;
    const start       = Math.max(0, total - MAX_POINTS);
    const slice       = buf.slice(start, total);
    const anchorsAbs  = computeAnchors(buf); // sobre o buf completo
    return {
      lums:        slice.map(p => p.lum != null ? p.lum : null),
      chromas:     slice.map(p => chromaMag(p)),
      anchors:     anchorsAbs,
      windowStart: start,
      len:         slice.length,
    };
  }

  // ── Destrói charts ───────────────────────────────────────────────────────────
  function destroyCharts(area) {
    chartInstances.forEach(c => { try { c.destroy(); } catch (e) {} });
    chartInstances = [];
    if (area) area.innerHTML = '';
  }

  // ── Opções base Chart.js ────────────────────────────────────────────────
  function baseOptions(showXLabels) {
    return {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      layout: { padding: { top: 1, right: 2, bottom: 0, left: 0 } },
      scales: {
        x: {
          display: showXLabels,
          ticks: { color: '#556688', font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { color: 'transparent' },
        },
        y: {
          ticks: { color: '#445566', font: { size: 7 }, maxTicksLimit: 3 },
          grid: { color: 'transparent' },
        },
      },
    };
  }

  // ── Build: modo paralelo ───────────────────────────────────────────────
  function buildParallel(area, channels) {
    const totalGap = (channels.length - 1) * 2;
    const rowH     = Math.max(44, Math.floor((area.offsetHeight - totalGap) / channels.length));

    channels.forEach((ch, idx) => {
      const { lums, chromas, anchors, windowStart, len } = getWindowData(ch);
      const isLast = idx === channels.length - 1;

      const row = document.createElement('div');
      row.style.cssText = [
        `display:flex;align-items:stretch;gap:4px;height:${rowH}px;flex-shrink:0`,
        `padding:2px 3px;border-radius:4px;overflow:hidden`,
        `background:${hex(ch.color, 0.05)};box-shadow:inset 0 0 0 1px ${hex(ch.color, 0.13)}`,
      ].join(';');

      const lbl = document.createElement('div');
      lbl.style.cssText = [
        `color:${ch.color};font-weight:bold;font-size:8px;width:34px;flex-shrink:0`,
        'display:flex;align-items:center;justify-content:center;white-space:nowrap',
        'overflow:hidden;text-overflow:ellipsis',
      ].join(';');
      lbl.textContent = (idx === 0 ? '★ ' : '') + ch.label;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-width:0;overflow:hidden';
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs);
      row.append(lbl, wrap);
      area.appendChild(row);

      const labels  = Array.from({ length: len }, (_, i) => i);
      const datasets = [
        {
          label: 'Lum',
          data: lums,
          borderColor: ch.color,
          backgroundColor: hex(ch.color, 0.08),
          borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: true, spanGaps: false,
        },
      ];
      if (showChroma) {
        datasets.push({
          label: 'Chroma',
          data: chromas,
          borderColor: hex(ch.color, 0.45),
          backgroundColor: 'transparent',
          borderWidth: 1, borderDash: [3, 3],
          pointRadius: 0, tension: 0.2, fill: false, spanGaps: false,
        });
      }

      // Captura referências mutáveis para o plugin de âncoras
      const state = { anchors: anchors.slice(), windowStart };
      const plug  = makeAnchorPlugin(() => state.anchors, () => state.windowStart, ch.color);
      ch._chartState = state; // armazena para atualização live

      const ci = new Chart(cvs, {
        type: 'line',
        data: { labels, datasets },
        options: baseOptions(isLast),
        plugins: [plug],
      });
      ch._liveChart = ci;
      chartInstances.push(ci);
    });
  }

  // ── Build: modo sobreposto ───────────────────────────────────────────────
  function buildOverlay(area, channels) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'flex:1;min-height:0;overflow:hidden;border-radius:4px',
      'background:#0a0a16;border:1px solid #2a2a4a',
    ].join(';');
    const cvs = document.createElement('canvas');
    wrap.appendChild(cvs);
    area.appendChild(wrap);

    const datasets    = [];
    const anchorPlugs = [];

    channels.forEach((ch, idx) => {
      const { lums, chromas, anchors, windowStart, len } = getWindowData(ch);

      datasets.push({
        label: (idx === 0 ? '★ ' : '') + ch.label + ' Lum',
        data: lums,
        borderColor: ch.color,
        backgroundColor: hex(ch.color, 0.07),
        borderWidth: 1.5, pointRadius: 0, tension: 0.2, fill: true, spanGaps: false,
      });
      if (showChroma) {
        datasets.push({
          label: ch.label + ' Chr',
          data: chromas,
          borderColor: hex(ch.color, 0.4),
          backgroundColor: 'transparent',
          borderWidth: 1, borderDash: [3, 3],
          pointRadius: 0, tension: 0.2, fill: false, spanGaps: false,
        });
      }

      const state = { anchors: anchors.slice(), windowStart };
      ch._chartState = state;
      anchorPlugs.push(makeAnchorPlugin(() => state.anchors, () => state.windowStart, ch.color));
    });

    const opts       = baseOptions(true);
    opts.plugins.legend = {
      display: true, position: 'bottom',
      labels: { color: '#778899', font: { size: 8, family: 'monospace' }, boxWidth: 10, padding: 6 },
    };
    opts.interaction = { mode: 'index', intersect: false };

    const ci = new Chart(cvs, {
      type: 'line',
      data: { labels: Array.from({ length: MAX_POINTS }, (_, i) => i), datasets },
      options: opts,
      plugins: anchorPlugs,
    });
    chartInstances.push(ci);
  }

  // ── Rebuild completo ──────────────────────────────────────────────────────
  function rebuildCharts(area, channels) {
    destroyCharts(area);
    if (!channels || !channels.length) return;
    chartMode === 'overlay'
      ? buildOverlay(area, channels)
      : buildParallel(area, channels);
  }

  // ── Update live (só modo paralelo, sem recriar) ────────────────────────
  function updateLive(area, channels) {
    if (!chartInstances.length) { rebuildCharts(area, channels); return; }
    channels.forEach(ch => {
      const ci = ch._liveChart;
      if (!ci) return;
      const { lums, chromas, anchors, windowStart, len } = getWindowData(ch);
      ci.data.labels             = Array.from({ length: len }, (_, i) => i);
      ci.data.datasets[0].data   = lums;
      if (showChroma && ci.data.datasets[1]) ci.data.datasets[1].data = chromas;
      if (ch._chartState) { ch._chartState.anchors = anchors.slice(); ch._chartState.windowStart = windowStart; }
      ci.update('none');
    });
  }

  // ── Loop de atualização ao vivo ────────────────────────────────────────
  function startLiveLoop(area, getChannels) {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    liveTimer = setInterval(() => {
      if (!document.getElementById(PANEL_ID)) { clearInterval(liveTimer); liveTimer = null; return; }
      const chs = getChannels();
      chartMode === 'overlay'
        ? rebuildCharts(area, chs)
        : updateLive(area, chs);
    }, UPDATE_MS);
  }

  // ── Abre o painel ─────────────────────────────────────────────────────
  async function openPanel() {
    await loadChartJs();

    const old = document.getElementById(PANEL_ID);
    if (old) { old.remove(); }

    const mainPanel = document.getElementById('ml-panel');
    const mpRect    = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { right: 4 + 340, top: 4 };
    const GAP   = 6;
    const initL = mpRect.right + GAP;
    const initT = mpRect.top;
    const initW = Math.max(320, window.innerWidth  - initL - GAP);
    const initH = Math.max(260, window.innerHeight - initT - GAP);

    const panel = document.createElement('div');
    panel.id    = PANEL_ID;
    panel.style.cssText = [
      `position:fixed;left:${initL}px;top:${initT}px`,
      `width:${initW}px;height:${initH}px`,
      'z-index:99998;min-width:200px;min-height:200px',
      `background:${ui.T.panelBg};border:1px solid ${ui.T.panelBorder}`,
      'border-radius:8px;box-shadow:0 4px 24px #000d',
      `font-family:monospace;font-size:10px;color:${ui.T.textPrimary}`,
      'user-select:none;overflow:hidden;display:flex;flex-direction:column',
    ].join(';');

    // ─ Header ─
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:5px;padding:5px 8px 4px',
      `background:${ui.T.headerBg};border-bottom:1px solid ${ui.T.panelBorder}`,
      'border-radius:8px 8px 0 0;cursor:move;flex-shrink:0',
    ].join(';');

    const htitle = document.createElement('span');
    htitle.textContent = '📊 Gráficos ao vivo';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    const btnMode = document.createElement('button');
    btnMode.style.cssText = `background:${ui.T.btnBg};border:1px solid ${ui.T.btnBorder};color:#00d4ff;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap`;
    function updateModeBtn() { btnMode.textContent = chartMode === 'parallel' ? '⫴ Paralelo' : '⧉ Sobreposto'; }
    updateModeBtn();

    const btnAnchors = document.createElement('button');
    function updateAnchorsBtn() {
      btnAnchors.textContent = showAnchors ? '◼ Âncoras' : '◻ Âncoras';
      btnAnchors.style.cssText = `background:${ui.T.btnBg};border:1px solid #44ff8855;color:#44ff88;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap;opacity:${showAnchors ? '1' : '0.45'}`;
    }
    updateAnchorsBtn();

    const btnChroma = document.createElement('button');
    function updateChromaBtn() {
      btnChroma.textContent = showChroma ? '◼ Chroma' : '◻ Chroma';
      btnChroma.style.cssText = `background:${ui.T.btnBg};border:1px solid #ffd70055;color:#ffd700;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap;opacity:${showChroma ? '1' : '0.45'}`;
    }
    updateChromaBtn();

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => closePanel();

    hdr.append(htitle, btnAnchors, btnChroma, btnMode, btnClose);
    panel.appendChild(hdr);

    // ─ Drag ─
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== htitle) return;
      pdrag = true;
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + 'px'; panel.style.right = 'auto';
      pox = e.clientX - r.left; poy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // ─ Resize handles (4 cantos) ─
    [['nw','top:0;left:0'],['ne','top:0;right:0'],['sw','bottom:0;left:0'],['se','bottom:0;right:0']].forEach(([cls, pos]) => {
      const isN = cls[0] === 'n', isW = cls[1] === 'w';
      const h   = document.createElement('div');
      h.style.cssText = `position:absolute;width:14px;height:14px;cursor:${cls}-resize;z-index:10;${pos}`;
      const dot = document.createElement('div');
      dot.style.cssText = `position:absolute;width:5px;height:5px;border-radius:2px;background:#2a3a6a;${isN?'top:3px':'bottom:3px'};${isW?'left:3px':'right:3px'}`;
      h.appendChild(dot); panel.appendChild(h);
      let rsx=0,rsy=0,rsw=0,rsh=0,rsl=0,rst=0;
      h.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        rsx=e.clientX; rsy=e.clientY; rsw=panel.offsetWidth; rsh=panel.offsetHeight; rsl=panel.offsetLeft; rst=panel.offsetTop;
        const onMove = ev => {
          const dx=ev.clientX-rsx, dy=ev.clientY-rsy;
          let nw=rsw,nh=rsh,nl=rsl,nt=rst;
          if (isW){nw=Math.max(200,rsw-dx);nl=rsl+rsw-nw;}else{nw=Math.max(200,rsw+dx);}
          if (isN){nh=Math.max(200,rsh-dy);nt=rst+rsh-nh;}else{nh=Math.max(200,rsh+dy);}
          panel.style.width=nw+'px'; panel.style.height=nh+'px'; panel.style.left=nl+'px'; panel.style.top=nt+'px';
          rebuildCharts(chartsArea, getVisibleChannels());
        };
        const onUp = () => { window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });

    // ─ Body ─
    const body = document.createElement('div');
    body.style.cssText = `flex:1;overflow-y:auto;padding:4px 8px 6px;display:flex;flex-direction:column;gap:4px;min-height:0;color:${ui.T.textPrimary}`;
    panel.appendChild(body);

    // Toggle de canais
    const toggleBar = document.createElement('div');
    toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;flex-shrink:0';
    const activeChannels = ML.CHANNELS.filter(ch => ch.active);
    activeChannels.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.dataset.active = '1';
      btn.style.cssText = [
        `background:${hex(ch.color, 0.13)};border:1px solid ${hex(ch.color, 0.53)};color:${ch.color}`,
        'border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;transition:opacity .15s',
      ].join(';');
      btn.textContent = (idx === 0 ? '★ ' : '') + ch.label;
      btn.onclick = () => {
        const on = btn.dataset.active === '1';
        btn.dataset.active = on ? '0' : '1';
        btn.style.opacity  = on ? '0.35' : '1';
        rebuildCharts(chartsArea, getVisibleChannels());
      };
      toggleBar.appendChild(btn);
    });
    body.appendChild(toggleBar);

    function getVisibleChannels() {
      return activeChannels.filter((_, i) => {
        const b = toggleBar.children[i];
        return b && b.dataset.active === '1';
      });
    }

    if (!activeChannels.length) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:16px;text-align:center;flex:1';
      msg.textContent   = 'Nenhum canal ativo. Ative canais no painel principal.';
      body.appendChild(msg);
      document.body.appendChild(panel);
      chartPanel = panel;
      return;
    }

    // Legenda Lum / Chroma
    const legBar = document.createElement('div');
    legBar.style.cssText = 'display:flex;gap:10px;flex-shrink:0;align-items:center;padding:1px 0';
    [['Lum', '#ffffff', ''], ['Chroma (√cb²+cr²)', '#ffd700', '3,3']].forEach(([name, color, dash]) => {
      const line = document.createElement('span');
      line.style.cssText = `display:inline-block;width:14px;height:2px;background:${dash ? 'none' : color};border-top:${dash ? '1px dashed ' + color : 'none'};margin-right:3px;vertical-align:middle`;
      const lbl = document.createElement('span');
      lbl.textContent = name;
      lbl.style.cssText = `color:${color};font-size:8px`;
      const w = document.createElement('span');
      w.append(line, lbl); legBar.appendChild(w);
    });
    body.appendChild(legBar);

    // Área dos gráficos
    const chartsArea = document.createElement('div');
    chartsArea.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:2px;overflow:hidden';
    body.appendChild(chartsArea);

    document.body.appendChild(panel);
    chartPanel = panel;

    // Conecta botões (chartsArea e getVisibleChannels precisam existir)
    btnMode.onclick = () => {
      chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel';
      updateModeBtn();
      rebuildCharts(chartsArea, getVisibleChannels());
    };
    btnAnchors.onclick = () => {
      showAnchors = !showAnchors; updateAnchorsBtn();
      rebuildCharts(chartsArea, getVisibleChannels());
    };
    btnChroma.onclick = () => {
      showChroma = !showChroma; updateChromaBtn();
      rebuildCharts(chartsArea, getVisibleChannels());
    };

    requestAnimationFrame(() => {
      rebuildCharts(chartsArea, getVisibleChannels());
      startLiveLoop(chartsArea, getVisibleChannels);
    });
  }

  // ── Fecha o painel ────────────────────────────────────────────────────
  function closePanel() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    destroyCharts(null);
    ML.CHANNELS.forEach(ch => { ch._liveChart = null; ch._chartState = null; });
    const el = document.getElementById(PANEL_ID);
    if (el) el.remove();
    chartPanel = null;
  }

  // ── API pública ───────────────────────────────────────────────────────────
  ML.chart = {
    open:   openPanel,
    close:  closePanel,
    toggle: () => document.getElementById(PANEL_ID) ? closePanel() : openPanel(),
  };

  console.log('[MedLat] 40-chart v2.0. Live sliding chart: Lum + Chroma (√cb²+cr²) + âncoras via buildHybridSeries. Botão 📊 no painel abre/fecha.');
})();
