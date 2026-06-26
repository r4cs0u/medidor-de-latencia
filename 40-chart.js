(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  // ── Constantes ───────────────────────────────────────────────────────────
  const CHART_INTERVAL_MS = 500;   // atualiza a cada 500ms
  const MAX_DISPLAY_PTS   = 300;   // pontos visíveis na janela deslizante
  const ANCHOR_TOP_N      = 8;     // número máximo de âncoras por canal

  // ── Carrega Chart.js via CDN ──────────────────────────────────────────────
  function loadChartJs() {
    return new Promise(resolve => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  // ── Calcula âncoras (picos de |diff| da série de lum) ────────────────────
  function computeAnchors(lumArr, n) {
    const anchors = [];
    for (let i = 1; i < lumArr.length; i++) {
      const d = Math.abs(lumArr[i] - lumArr[i - 1]);
      if (d > 0) anchors.push({ idx: i, mag: d });
    }
    anchors.sort((a, b) => b.mag - a.mag);
    return anchors.slice(0, n).map(a => a.idx);
  }

  // ── Plugin legado (não usado nos builds atuais, mantido por compat) ───────
  function makeAnchorPlugin(getAnchors, getOffset) {
    return {
      id: 'anchorLines',
      afterDraw(chart) {
        const anchors = getAnchors();
        if (!anchors.length) return;
        const offset = getOffset();
        const ctx    = chart.ctx;
        const xScale = chart.scales.x;
        const yScale = chart.scales.y;
        if (!xScale || !yScale) return;
        ctx.save();
        anchors.forEach(idx => {
          const visual = idx - offset;
          if (visual < 0 || visual >= MAX_DISPLAY_PTS) return;
          const xPx = xScale.getPixelForValue(visual);
          if (xPx < xScale.left || xPx > xScale.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yScale.top);
          ctx.lineTo(xPx, yScale.bottom);
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.lineWidth   = 1;
          ctx.stroke();
        });
        ctx.restore();
      },
    };
  }

  // ── Estado do painel ──────────────────────────────────────────────────────
  let panel       = null;
  let intervalId  = null;
  let chartMode   = 'parallel'; // 'parallel' | 'overlay'
  let showAnchors = true;
  let chartInstances = [];

  function isOpen() { return !!document.getElementById('ml-chart-panel'); }

  function closePanel() {
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    chartInstances.forEach(c => { try { c.destroy(); } catch(e) {} });
    chartInstances = [];
    const el = document.getElementById('ml-chart-panel');
    if (el) el.remove();
    panel = null;
  }

  // ── Abre (ou fecha) o painel ──────────────────────────────────────────────
  async function openPanel() {
    if (isOpen()) { closePanel(); return; }

    await loadChartJs();

    const mainPanel = document.getElementById('ml-panel');
    const mpRect    = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { right: window.innerWidth - 20 };

    const GAP    = 6;
    const initL  = mpRect.right + GAP;
    const initT  = GAP;
    const initW  = Math.max(360, window.innerWidth  - initL - GAP);
    const initH  = Math.max(280, window.innerHeight - initT - GAP);

    panel = document.createElement('div');
    panel.id = 'ml-chart-panel';

    function applyPanelStyle() {
      panel.style.cssText = [
        `position:fixed;left:${initL}px;top:${initT}px`,
        `width:${initW}px;height:${initH}px`,
        'z-index:99998;min-width:200px;min-height:220px',
        `background:${ui.T.panelBg};border:1px solid ${ui.T.panelBorder}`,
        'border-radius:8px;box-shadow:0 4px 24px #000d',
        `font-family:monospace;font-size:10px;color:${ui.T.textPrimary}`,
        'user-select:none;overflow:hidden;display:flex;flex-direction:column',
      ].join(';');
    }
    applyPanelStyle();

    // ── Header ──────────────────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:5px;padding:5px 8px 4px;flex-shrink:0',
      `background:${ui.T.headerBg};border-bottom:1px solid ${ui.T.panelBorder}`,
      'border-radius:8px 8px 0 0;cursor:move',
    ].join(';');

    const htitle = document.createElement('span');
    htitle.textContent = '📊 Gráficos ao vivo';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.05em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    // botão modo paralelo/sobreposto
    const btnMode = document.createElement('button');
    btnMode.style.cssText = `background:${ui.T.btnBg};border:1px solid ${ui.T.btnBorder};color:#00d4ff;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0`;
    function updateModeBtn() { btnMode.textContent = chartMode === 'parallel' ? '⫴ Paralelo' : '⧉ Sobreposto'; }
    updateModeBtn();
    btnMode.onclick = () => { chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel'; updateModeBtn(); rebuildCharts(); };

    // botão âncoras
    const btnAnc = document.createElement('button');
    function updateAncBtn() {
      btnAnc.textContent = showAnchors ? '◼ Âncoras' : '◻ Âncoras';
      btnAnc.style.opacity = showAnchors ? '1' : '0.45';
    }
    btnAnc.style.cssText = `background:${ui.T.btnBg};border:1px solid #44ff8855;color:#44ff88;border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace;flex-shrink:0`;
    updateAncBtn();
    btnAnc.onclick = () => { showAnchors = !showAnchors; updateAncBtn(); rebuildCharts(); };

    // fechar
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = closePanel;

    hdr.append(htitle, btnMode, btnAnc, btnClose);
    panel.appendChild(hdr);

    // drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== htitle) return;
      pdrag = true;
      const r = panel.getBoundingClientRect();
      panel.style.left  = r.left + 'px';
      panel.style.right = 'auto';
      pox = e.clientX - r.left;
      poy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // resize corners
    [['nw','nw-resize','top:0;left:0'],['ne','ne-resize','top:0;right:0'],
     ['sw','sw-resize','bottom:0;left:0'],['se','se-resize','bottom:0;right:0']]
    .forEach(([cls, cur, pos]) => {
      const h = document.createElement('div');
      h.style.cssText = `position:absolute;width:14px;height:14px;cursor:${cur};z-index:10;${pos}`;
      panel.appendChild(h);
      let rsx=0,rsy=0,rsw=0,rsh=0,rsl=0,rst=0;
      const isN = cls[0]==='n', isW = cls[1]==='w';
      h.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        rsx=e.clientX;rsy=e.clientY;rsw=panel.offsetWidth;rsh=panel.offsetHeight;rsl=panel.offsetLeft;rst=panel.offsetTop;
        function onMove(ev) {
          const dx=ev.clientX-rsx,dy=ev.clientY-rsy;
          let nw=rsw,nh=rsh,nl=rsl,nt=rst;
          if (isW){nw=Math.max(200,rsw-dx);nl=rsl+rsw-nw;}else{nw=Math.max(200,rsw+dx);}
          if (isN){nh=Math.max(220,rsh-dy);nt=rst+rsh-nh;}else{nh=Math.max(220,rsh+dy);}
          panel.style.width=nw+'px';panel.style.height=nh+'px';panel.style.left=nl+'px';panel.style.top=nt+'px';
          rebuildCharts();
        }
        function onUp(){window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);}
        window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
      });
    });

    // ── Toggle de canais ────────────────────────────────────────────────────
    const toggleBar = document.createElement('div');
    toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;padding:4px 8px 2px;flex-shrink:0';

    const activeChannels = ML.CHANNELS.filter(ch => ch.active);
    activeChannels.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.dataset.on = '1';
      btn.style.cssText = [
        `background:${ch.color}22;border:1px solid ${ch.color}88;color:${ch.color}`,
        'border-radius:3px;padding:2px 6px;cursor:pointer;font:bold 8px monospace',
      ].join(';');
      btn.textContent = (idx === 0 ? '★ ' : '') + ch.label;
      btn.onclick = () => { const on=btn.dataset.on==='1'; btn.dataset.on=on?'0':'1'; btn.style.opacity=on?'0.35':'1'; rebuildCharts(); };
      toggleBar.appendChild(btn);
    });
    panel.appendChild(toggleBar);

    // ── Área de gráficos ────────────────────────────────────────────────────
    const chartsArea = document.createElement('div');
    chartsArea.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:2px;overflow:hidden;padding:2px 6px 4px';
    panel.appendChild(chartsArea);

    document.body.appendChild(panel);

    // ── Rebuild ──────────────────────────────────────────────────────────────
    function getVisible() {
      return activeChannels.filter((_, i) => {
        const b = toggleBar.children[i];
        return b && b.dataset.on === '1';
      });
    }

    function destroyCharts() {
      chartInstances.forEach(c => { try { c.destroy(); } catch(e) {} });
      chartInstances = [];
      chartsArea.innerHTML = '';
    }

    function xMaxTicks() {
      return Math.max(4, Math.floor((chartsArea.offsetWidth || 400) / 65));
    }

    // Pega os últimos MAX_DISPLAY_PTS pontos do rollingBuffer do canal.
    // Retorna { lums, cbs, crs, tsSec, offset }
    // tsSec: tempo relativo em segundos desde o primeiro ponto da janela
    function getWindowedData(ch) {
      const buf  = ch.rollingBuffer ? ch.rollingBuffer.toArray() : [];
      const len  = buf.length;
      const from = Math.max(0, len - MAX_DISPLAY_PTS);
      const slice = buf.slice(from);
      const t0   = slice.length ? slice[0].ts : 0;
      return {
        lums:   slice.map(p => p.lum),
        cbs:    slice.map(p => p.cb),
        crs:    slice.map(p => p.cr),
        tsSec:  slice.map(p => (p.ts - t0) / 1000),
        offset: from,
        bufLen: len,
      };
    }

    // Xaxis labels ajustados por latência: x = s - m  (m pode ser negativo)
    // Se m>=0 → desloca curva para a esquerda; se m<0 → desloca para a direita.
    function makeAdjustedLabels(tsSec, mMs) {
      const mSec = (mMs !== null && mMs !== undefined) ? mMs / 1000 : 0;
      return tsSec.map(s => parseFloat((s - mSec).toFixed(3)));
    }
    // Compat: makeLabels mantido para fallback sem ts
    function makeLabels(n) {
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(i);
      return arr;
    }

    // ── Chart options base ────────────────────────────────────────────────
    function baseOptions(showXAxis, yMin, yMax, ticks) {
      return {
        animation:    false,
        responsive:   true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        layout: { padding: { top: 1, right: 2, bottom: 0, left: 0 } },
        scales: {
          x: {
            display:    showXAxis,
            type:       'linear',
            ticks: { color: '#556688', font: { size: 7 }, maxRotation: 0, autoSkip: true, maxTicksLimit: ticks, callback: v => Number.isInteger(v) ? v.toFixed(0) : parseFloat(v).toFixed(1) },
            title: { display: showXAxis, text: 's', color: '#556688', font: { size: 7 } },
            grid: { color: 'transparent' },
          },
          y: {
            min:  yMin,
            max:  yMax,
            ticks: { color: '#445566', font: { size: 7 }, maxTicksLimit: 3 },
            grid:  { color: 'transparent' },
          },
        },
      };
    }

    // ── Update incremental dos dados (sem rebuild do DOM) ─────────────────
    // Mapeia chId → { ci, anchorXSecs }
    const liveRefs = {};

    function updateLiveData() {
      const visible = getVisible();
      if (!visible.length) return;
      if (chartMode === 'overlay') {
        updateOverlay(visible);
      } else {
        updateParallel(visible);
      }
    }

    function updateParallel(channels) {
      channels.forEach(ch => {
        const ref = liveRefs[ch.id];
        if (!ref) return;
        const { lums, cbs, crs, tsSec, offset } = getWindowedData(ch);
        const mMs   = (ch._measuredOffsetMs !== undefined) ? ch._measuredOffsetMs : null;
        const xlbls = makeAdjustedLabels(tsSec, mMs);

        ref.ci.data.labels = xlbls;
        ref.ci.data.datasets[0].data = lums.map((y, i) => ({ x: xlbls[i], y }));
        ref.ci.data.datasets[1].data = cbs.map((y, i) => ({ x: xlbls[i], y }));
        ref.ci.data.datasets[2].data = crs.map((y, i) => ({ x: xlbls[i], y }));

        // atualiza âncoras
        ref.anchors     = showAnchors ? computeAnchors(lums, ANCHOR_TOP_N) : [];
        ref.anchorXSecs = ref.anchors.map(i => xlbls[i]);
        ref.offset      = offset;

        ref.ci.update('none');
      });
    }

    function updateOverlay(channels) {
      const ref = liveRefs['__overlay__'];
      if (!ref) return;
      channels.forEach((ch, idx) => {
        const { lums, tsSec, offset } = getWindowedData(ch);
        const mMs   = (ch._measuredOffsetMs !== undefined) ? ch._measuredOffsetMs : null;
        const xlbls = makeAdjustedLabels(tsSec, mMs);
        if (ref.ci.data.labels.length !== xlbls.length) ref.ci.data.labels = xlbls;
        ref.ci.data.datasets[idx].data = lums.map((y, i) => ({ x: xlbls[i], y }));
        ref.anchorsMap[ch.id] = {
          anchors:     showAnchors ? computeAnchors(lums, ANCHOR_TOP_N) : [],
          anchorXSecs: showAnchors ? computeAnchors(lums, ANCHOR_TOP_N).map(i => xlbls[i]) : [],
          offset,
          color: ch.color,
        };
      });
      ref.ci.update('none');
    }

    // ── Build parallel ────────────────────────────────────────────────────
    function buildParallel(channels) {
      const gap     = (channels.length - 1) * 2;
      const rowH    = Math.max(52, Math.floor((chartsArea.offsetHeight - gap) / channels.length));
      const ticks   = xMaxTicks();

      channels.forEach((ch, idx) => {
        const { lums, cbs, crs, tsSec, offset } = getWindowedData(ch);
        const mMs   = (ch._measuredOffsetMs !== undefined) ? ch._measuredOffsetMs : null;
        const xlbls = makeAdjustedLabels(tsSec, mMs);

        const row = document.createElement('div');
        row.style.cssText = [
          `display:flex;align-items:stretch;gap:4px;height:${rowH}px;flex-shrink:0`,
          `padding:2px 3px;border-radius:4px`,
          `background:${ch.color}0d;box-shadow:inset 0 0 0 1px ${ch.color}22;overflow:hidden`,
        ].join(';');

        const lbl = document.createElement('div');
        lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
        lbl.textContent = (idx === 0 ? '★ ' : '') + ch.label;

        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex:1;min-width:0;overflow:hidden';
        const cvs = document.createElement('canvas');
        wrap.appendChild(cvs);
        row.append(lbl, wrap);
        chartsArea.appendChild(row);

        const ancXSecsRef = { list: showAnchors ? computeAnchors(lums, ANCHOR_TOP_N).map(i => xlbls[i]) : [] };
        const ancPlugin = {
          id: 'anchorLines',
          afterDraw(chart) {
            if (!ancXSecsRef.list.length) return;
            const ctx = chart.ctx, xScale = chart.scales.x, yScale = chart.scales.y;
            if (!xScale || !yScale) return;
            ctx.save();
            ancXSecsRef.list.forEach(xVal => {
              const xPx = xScale.getPixelForValue(xVal);
              if (xPx < xScale.left || xPx > xScale.right) return;
              ctx.beginPath();
              ctx.moveTo(xPx, yScale.top);
              ctx.lineTo(xPx, yScale.bottom);
              ctx.strokeStyle = 'rgba(255,255,255,0.35)';
              ctx.lineWidth   = 1;
              ctx.stroke();
            });
            ctx.restore();
          },
        };

        const ci = new Chart(cvs, {
          type: 'line',
          data: {
            labels:   xlbls,
            datasets: [
              { data: lums.map((y,i) => ({ x: xlbls[i], y })), borderColor: ch.color,  backgroundColor: ch.color + '18', borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: true,  spanGaps: false },
              { data: cbs.map((y,i)  => ({ x: xlbls[i], y })), borderColor: '#00d4ff', backgroundColor: 'transparent',   borderWidth: 1,   pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
              { data: crs.map((y,i)  => ({ x: xlbls[i], y })), borderColor: '#ff6680', backgroundColor: 'transparent',   borderWidth: 1,   pointRadius: 0, tension: 0.2, fill: false, spanGaps: false },
            ],
          },
          options: baseOptions(idx === channels.length - 1, 0, 255, ticks),
          plugins: [ancPlugin],
        });

        chartInstances.push(ci);
        liveRefs[ch.id] = {
          ci,
          get anchors()     { return []; },
          set anchors(_v)   {},
          get anchorXSecs() { return ancXSecsRef.list; },
          set anchorXSecs(v){ ancXSecsRef.list = v; },
          get offset()      { return 0; },
          set offset(_v)    {},
        };
      });
    }

    // ── Build overlay ─────────────────────────────────────────────────────
    function buildOverlay(channels) {
      const ticks = xMaxTicks();

      const wrap = document.createElement('div');
      wrap.style.cssText = `flex:1;min-height:0;overflow:hidden;border-radius:4px;background:#0a0a16;border:1px solid ${ui.T.panelBorder}`;
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs);
      chartsArea.appendChild(wrap);

      const anchorsMap = {};
      const datasets   = channels.map(ch => {
        const { lums, tsSec, offset } = getWindowedData(ch);
        const mMs   = (ch._measuredOffsetMs !== undefined) ? ch._measuredOffsetMs : null;
        const xlbls = makeAdjustedLabels(tsSec, mMs);
        const ancs  = showAnchors ? computeAnchors(lums, ANCHOR_TOP_N) : [];
        anchorsMap[ch.id] = {
          anchors:     ancs,
          anchorXSecs: ancs.map(i => xlbls[i]),
          offset,
          color: ch.color,
        };
        return {
          label:           ch.label,
          data:            lums.map((y, i) => ({ x: xlbls[i], y })),
          borderColor:     ch.color,
          backgroundColor: ch.color + '18',
          borderWidth:     1.6,
          pointRadius:     0,
          tension:         0.2,
          fill:            false,
          spanGaps:        false,
        };
      });

      const overlayAncPlugin = {
        id: 'anchorLinesOverlay',
        afterDraw(chart) {
          if (!showAnchors) return;
          const ctx = chart.ctx, xScale = chart.scales.x, yScale = chart.scales.y;
          if (!xScale || !yScale) return;
          ctx.save();
          Object.values(anchorsMap).forEach(({ anchorXSecs, color }) => {
            (anchorXSecs || []).forEach(xVal => {
              const xPx = xScale.getPixelForValue(xVal);
              if (xPx < xScale.left || xPx > xScale.right) return;
              ctx.beginPath();
              ctx.moveTo(xPx, yScale.top);
              ctx.lineTo(xPx, yScale.bottom);
              ctx.strokeStyle = color + '77';
              ctx.lineWidth   = 1;
              ctx.stroke();
            });
          });
          ctx.restore();
        },
      };

      const opts = baseOptions(true, 0, 255, ticks);
      opts.plugins.legend = {
        display: true, position: 'bottom',
        labels: { color: '#778899', font: { size: 8, family: 'monospace' }, boxWidth: 10, padding: 8 },
      };
      opts.interaction = { mode: 'index', intersect: false };

      const firstLabels = datasets.length ? datasets[0].data.map(p => p.x) : [];
      const ci = new Chart(cvs, {
        type: 'line',
        data: { labels: firstLabels, datasets },
        options: opts,
        plugins: [overlayAncPlugin],
      });

      chartInstances.push(ci);
      liveRefs['__overlay__'] = { ci, anchorsMap };
    }

    // ── Rebuild completo ──────────────────────────────────────────────────
    function rebuildCharts() {
      destroyCharts();
      Object.keys(liveRefs).forEach(k => delete liveRefs[k]);
      const visible = getVisible();
      if (!visible.length) return;
      if (chartMode === 'overlay') buildOverlay(visible);
      else                         buildParallel(visible);
    }

    // ── Loop de atualização ───────────────────────────────────────────────
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(updateLiveData, CHART_INTERVAL_MS);

    requestAnimationFrame(() => rebuildCharts());
  }

  // ── API pública ───────────────────────────────────────────────────────────
  ML.chart = {
    toggle: openPanel,
    open:   openPanel,
    close:  closePanel,
    // compatibilidade com código legado que chamar show(results)
    show:   () => openPanel(),
  };

  console.log('[MedLat] 40-chart v2.1 carregado (eixo X em segundos ajustado por latência).');
})();
