(function () {
  const ML = window.MedLat;

  // ── Chart.js loader ──────────────────────────────────────────────────────
  function loadChartJs() {
    return new Promise((resolve) => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // ── Estado do painel ─────────────────────────────────────────────────────
  let panel        = null;
  let liveTimer    = null;
  let chartMode    = 'parallel'; // 'parallel' | 'overlay'
  let showAnchors  = true;
  let chartInstances = [];

  const LIVE_INTERVAL_MS = 500;
  // Quantos frames exibir na janela deslizante
  const WINDOW_FRAMES = 300;

  // ── Helpers de cor ───────────────────────────────────────────────────────
  function tickColor()      { return '#556688'; }
  function tickColorFaint() { return '#445566'; }

  // ── Anchor lines plugin ──────────────────────────────────────────────────
  // Âncoras = transições bruscas de lum (diff positivo alto)
  const MAX_ANCHORS = 10;

  function computeAnchors(lumArr) {
    if (!lumArr || lumArr.length < 2) return [];
    const diff = [];
    for (let i = 1; i < lumArr.length; i++) {
      diff.push(Math.max(0, lumArr[i] - lumArr[i - 1]));
    }
    const sorted = diff.slice().sort((a, b) => b - a);
    const threshold = sorted[Math.min(MAX_ANCHORS, sorted.length - 1)] || 0;
    const anchors = [];
    diff.forEach((d, i) => {
      if (d >= threshold && d > 0 && anchors.length < MAX_ANCHORS) {
        anchors.push(i + 1); // índice no lumArr
      }
    });
    return anchors;
  }

  function makeAnchorPlugin(getAnchors) {
    return {
      id: 'anchorLines',
      afterDraw(chart) {
        if (!showAnchors) return;
        const anchors = getAnchors();
        if (!anchors.length) return;
        const ctx   = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        if (!xAxis || !yAxis) return;
        ctx.save();
        anchors.forEach(idx => {
          const xPx = xAxis.getPixelForValue(idx);
          if (xPx < xAxis.left || xPx > xAxis.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yAxis.top);
          ctx.lineTo(xPx, yAxis.bottom);
          ctx.strokeStyle = '#ffffff55';
          ctx.lineWidth   = 1;
          ctx.stroke();
        });
        ctx.restore();
      },
    };
  }

  // ── Dados live ───────────────────────────────────────────────────────────
  function getActiveChannels() {
    return ML.CHANNELS.filter(ch => ch.active && ch.rollingBuffer && ch.rollingBuffer.size > 1);
  }

  function getWindowedSeries(ch) {
    const arr = ch.rollingBuffer.toArray();
    const slice = arr.length > WINDOW_FRAMES ? arr.slice(arr.length - WINDOW_FRAMES) : arr;
    return {
      lum: slice.map(p => p.lum),
      cb:  slice.map(p => p.cb),
      cr:  slice.map(p => p.cr),
      len: slice.length,
    };
  }

  function makeLabels(len) {
    const out = [];
    for (let i = 0; i < len; i++) out.push(i);
    return out;
  }

  // ── Destroy helpers ──────────────────────────────────────────────────────
  function destroyCharts() {
    chartInstances.forEach(c => { try { c.destroy(); } catch (e) {} });
    chartInstances = [];
  }

  // ── Build: paralelo ──────────────────────────────────────────────────────
  function buildParallel(chartsArea, channels) {
    chartsArea.innerHTML = '';
    const rowH = Math.max(56, Math.floor((chartsArea.offsetHeight - (channels.length - 1) * 2) / channels.length));

    channels.forEach(ch => {
      const series = getWindowedSeries(ch);
      const anchors = computeAnchors(series.lum);
      const labels  = makeLabels(series.len);

      const row = document.createElement('div');
      row.style.cssText = [
        `height:${rowH}px;flex-shrink:0;display:flex;align-items:stretch;gap:4px`,
        `padding:2px 3px;border-radius:4px`,
        `background:${ch.color}0d;box-shadow:inset 0 0 0 1px ${ch.color}22;overflow:hidden`,
      ].join(';');

      const lblEl = document.createElement('div');
      lblEl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:30px;flex-shrink:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
      lblEl.textContent = ch.label;

      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-width:0;overflow:hidden';
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs);
      row.append(lblEl, wrap);
      chartsArea.appendChild(row);

      const anchorsRef = [anchors];
      const ci = new Chart(cvs, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Lum', data: series.lum, borderColor: ch.color,        backgroundColor: ch.color + '18',   borderWidth: 1.2, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
            { label: 'Cb',  data: series.cb,  borderColor: '#00aaff',        backgroundColor: '#00aaff18',        borderWidth: 0.8, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
            { label: 'Cr',  data: series.cr,  borderColor: '#ff5588',        backgroundColor: '#ff558818',        borderWidth: 0.8, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
          ],
        },
        options: {
          animation: false, responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          layout: { padding: { top: 1, right: 2, bottom: 0, left: 0 } },
          scales: {
            x: { display: false, ticks: { color: tickColor(), font: { size: 7 } }, grid: { color: 'transparent' } },
            y: { min: 0, max: 255, ticks: { color: tickColorFaint(), font: { size: 7 }, maxTicksLimit: 3 }, grid: { color: 'transparent' } },
          },
        },
        plugins: [makeAnchorPlugin(() => anchorsRef[0])],
      });
      chartInstances.push(ci);
      ch._liveChart     = ci;
      ch._liveAnchorsRef = anchorsRef;
    });
  }

  // ── Build: overlay ───────────────────────────────────────────────────────
  function buildOverlay(chartsArea, channels) {
    chartsArea.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'flex:1;min-height:0;overflow:hidden;border-radius:4px;background:#0a0a16;border:1px solid #1a1a3a;position:relative';
    const cvs = document.createElement('canvas');
    wrap.appendChild(cvs);
    chartsArea.appendChild(wrap);

    const allAnchors  = [];
    const datasets    = [];

    channels.forEach(ch => {
      const series  = getWindowedSeries(ch);
      const anchors = computeAnchors(series.lum);
      anchors.forEach(a => allAnchors.push({ idx: a, color: ch.color }));
      const labels  = makeLabels(series.len);

      datasets.push(
        { label: ch.label + ' Lum', data: series.lum, borderColor: ch.color,   backgroundColor: ch.color + '18',   borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
        { label: ch.label + ' Cb',  data: series.cb,  borderColor: '#00aaff66', backgroundColor: 'transparent',     borderWidth: 0.8, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
        { label: ch.label + ' Cr',  data: series.cr,  borderColor: '#ff558866', backgroundColor: 'transparent',     borderWidth: 0.8, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
      );
    });

    const maxLen = Math.max(...channels.map(ch => getWindowedSeries(ch).len));
    const labels = makeLabels(maxLen);

    const allAnchorsRef = [allAnchors];
    const overlayAnchorPlugin = {
      id: 'anchorLinesOverlay',
      afterDraw(chart) {
        if (!showAnchors) return;
        const list = allAnchorsRef[0];
        if (!list.length) return;
        const ctx = chart.ctx, xAxis = chart.scales.x, yAxis = chart.scales.y;
        if (!xAxis || !yAxis) return;
        ctx.save();
        list.forEach(({ idx, color }) => {
          const xPx = xAxis.getPixelForValue(idx);
          if (xPx < xAxis.left || xPx > xAxis.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yAxis.top);
          ctx.lineTo(xPx, yAxis.bottom);
          ctx.strokeStyle = color + '88';
          ctx.lineWidth   = 1;
          ctx.stroke();
        });
        ctx.restore();
      },
    };

    const ci = new Chart(cvs, {
      type: 'line',
      data: { labels, datasets },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true, position: 'bottom',
            labels: { color: '#778899', font: { size: 8, family: 'monospace' }, boxWidth: 10, padding: 6 },
          },
          tooltip: { enabled: false },
        },
        layout: { padding: { top: 2, right: 4, bottom: 0, left: 0 } },
        scales: {
          x: { display: false, grid: { color: 'transparent' } },
          y: { min: 0, max: 255, ticks: { color: tickColorFaint(), font: { size: 7 }, maxTicksLimit: 5 }, grid: { color: 'transparent' } },
        },
      },
      plugins: [overlayAnchorPlugin],
    });
    chartInstances.push(ci);
  }

  // ── Rebuild completo ─────────────────────────────────────────────────────
  function rebuildCharts(chartsArea) {
    destroyCharts();
    const channels = getActiveChannels();
    if (!channels.length) return;
    if (chartMode === 'overlay') buildOverlay(chartsArea, channels);
    else                         buildParallel(chartsArea, channels);
  }

  // ── Update live (sem destruir os charts) ─────────────────────────────────
  function updateLive() {
    if (!panel || !document.body.contains(panel)) {
      stopLive(); return;
    }
    const channels = getActiveChannels();
    channels.forEach(ch => {
      if (!ch._liveChart || !ch._liveAnchorsRef) return;
      const series  = getWindowedSeries(ch);
      const anchors = computeAnchors(series.lum);
      const labels  = makeLabels(series.len);
      const ci      = ch._liveChart;
      ci.data.labels           = labels;
      ci.data.datasets[0].data = series.lum;
      ci.data.datasets[1].data = series.cb;
      ci.data.datasets[2].data = series.cr;
      ch._liveAnchorsRef[0]    = anchors;
      ci.update('none');
    });
  }

  function startLive(chartsArea) {
    stopLive();
    liveTimer = setInterval(() => {
      if (chartMode === 'parallel') {
        updateLive();
      } else {
        // overlay: reconstrói para simplificar (múltiplos datasets)
        rebuildCharts(chartsArea);
      }
    }, LIVE_INTERVAL_MS);
  }

  function stopLive() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  }

  // ── Abre o painel ─────────────────────────────────────────────────────────
  async function open() {
    if (panel && document.body.contains(panel)) { close(); return; }
    await loadChartJs();

    const ui = ML.ui;
    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { right: window.innerWidth - 250, top: 8 };

    const GAP    = 6;
    const initL  = Math.round(mpRect.right + GAP);
    const initT  = GAP;
    const initW  = Math.max(320, window.innerWidth  - initL - GAP);
    const initH  = Math.max(240, window.innerHeight - initT - GAP);

    panel = document.createElement('div');
    panel.id = 'ml-chart-panel';
    panel.style.cssText = [
      `position:fixed;left:${initL}px;top:${initT}px`,
      `width:${initW}px;height:${initH}px`,
      'z-index:99998;min-width:200px;min-height:180px',
      `background:${ui.T.panelBg};border:1px solid ${ui.T.panelBorder}`,
      'border-radius:8px;box-shadow:0 4px 24px #000d',
      `font-family:monospace;font-size:10px;color:${ui.T.textPrimary}`,
      'user-select:none;overflow:hidden;display:flex;flex-direction:column',
    ].join(';');

    // ── Header ──
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:5px;padding:5px 8px 4px',
      `background:${ui.T.headerBg};border-bottom:1px solid ${ui.T.panelBorder}`,
      'border-radius:8px 8px 0 0;cursor:move;flex-shrink:0',
    ].join(';');

    const htitle = document.createElement('span');
    htitle.textContent = '📊 Gráficos ao vivo';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

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
    btnAnchors.onclick = () => { showAnchors = !showAnchors; updateAnchorsBtn(); rebuildCharts(chartsArea); startLive(chartsArea); };

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => close();

    hdr.append(htitle, btnAnchors, btnMode, btnClose);
    panel.appendChild(hdr);

    // ── Drag ──
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== htitle) return;
      pdrag = true;
      const r = panel.getBoundingClientRect();
      panel.style.left = r.left + 'px'; panel.style.right = 'auto';
      pox = e.clientX - r.left; poy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup',   () => pdrag = false);

    // ── Resize handles ──
    const chartsArea = document.createElement('div');
    [['nw','top:0;left:0'],['ne','top:0;right:0'],['sw','bottom:0;left:0'],['se','bottom:0;right:0']].forEach(([cls, pos]) => {
      const isN = cls[0]==='n', isW = cls[1]==='w';
      const h = document.createElement('div');
      h.style.cssText = `position:absolute;width:14px;height:14px;cursor:${cls}-resize;z-index:10;${pos}`;
      let rsx=0,rsy=0,rsw=0,rsh=0,rsl=0,rst=0;
      h.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        rsx=e.clientX; rsy=e.clientY; rsw=panel.offsetWidth; rsh=panel.offsetHeight; rsl=panel.offsetLeft; rst=panel.offsetTop;
        function onMove(ev) {
          const dx=ev.clientX-rsx, dy=ev.clientY-rsy;
          let nw=rsw,nh=rsh,nl=rsl,nt=rst;
          if (isW){nw=Math.max(200,rsw-dx);nl=rsl+rsw-nw;}else{nw=Math.max(200,rsw+dx);}
          if (isN){nh=Math.max(180,rsh-dy);nt=rst+rsh-nh;}else{nh=Math.max(180,rsh+dy);}
          panel.style.width=nw+'px';panel.style.height=nh+'px';panel.style.left=nl+'px';panel.style.top=nt+'px';
          rebuildCharts(chartsArea); startLive(chartsArea);
        }
        function onUp(){window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);}
        window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
      });
      panel.appendChild(h);
    });

    // ── Body ──
    const body = document.createElement('div');
    body.style.cssText = `flex:1;overflow:hidden;padding:4px 8px 6px;display:flex;flex-direction:column;gap:4px;min-height:0;color:${ui.T.textPrimary}`;

    // Legenda fixa Lum / Cb / Cr
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:8px;flex-shrink:0;align-items:center;padding:1px 0';
    [['Lum','#ffffff'],['Cb','#00aaff'],['Cr','#ff5588']].forEach(([name, color]) => {
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:8px;height:2px;background:${color};border-radius:1px;margin-right:2px;vertical-align:middle`;
      const lbl = document.createElement('span');
      lbl.textContent = name;
      lbl.style.cssText = `color:${color};font-size:8px`;
      const wrap = document.createElement('span');
      wrap.append(dot, lbl);
      legend.appendChild(wrap);
    });
    body.appendChild(legend);

    chartsArea.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:2px;overflow:hidden';
    body.appendChild(chartsArea);
    panel.appendChild(body);

    btnMode.onclick = () => {
      chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel';
      updateModeBtn();
      rebuildCharts(chartsArea);
      startLive(chartsArea);
    };

    document.body.appendChild(panel);
    requestAnimationFrame(() => {
      rebuildCharts(chartsArea);
      startLive(chartsArea);
    });
  }

  function close() {
    stopLive();
    destroyCharts();
    ML.CHANNELS.forEach(ch => { ch._liveChart = null; ch._liveAnchorsRef = null; });
    if (panel) { panel.remove(); panel = null; }
  }

  ML.chart = { open, close, toggle: open };
  console.log('[MedLat] 40-chart.js carregado. Live sliding chart com Lum, Cb, Cr e âncoras.');
})();
