(function () {
  const ML = window.MedLat;

  function loadChartJs() {
    return new Promise((resolve) => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
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
        peakAnnotations.forEach(({ xIndex, color }) => {
          const xPx = xAxis.getPixelForValue(xIndex);
          if (xPx < xAxis.left || xPx > xAxis.right) return;
          ctx.beginPath();
          ctx.moveTo(xPx, yAxis.top);
          ctx.lineTo(xPx, yAxis.bottom);
          ctx.strokeStyle = color + '40';
          ctx.lineWidth   = 1;
          ctx.stroke();
        });
        ctx.restore();
      },
    };
  }

  async function showChart(results) {
    if (!Array.isArray(results)) results = [results];
    await loadChartJs();
    const old = document.getElementById('ml-chart-panel');
    if (old) old.remove();

    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel
      ? mainPanel.getBoundingClientRect()
      : { left: window.innerWidth - 248, top: 8, width: 228, height: 0 };

    const INIT_W = mpRect.width || 228;
    const INIT_H = Math.min(window.innerHeight - 16, 560);
    const initLeft = Math.max(4, mpRect.left - INIT_W - 8);
    const initTop  = Math.max(8, mpRect.top);

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

    /* ── header ── */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:5px;padding:5px 8px 4px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:8px 8px 0 0;cursor:move;flex-shrink:0',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '\uD83D\uDCCA Luminância';
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
      btnManual.style.borderColor = manualMode ? '#44ff88' : '#44ff8855';
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

    /* ── drag do painel ── */
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== htitle) return;
      pdrag = true; panel.style.right = 'auto';
      pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    /* ── resize handles ── */
    [['nw','nw-resize','top:0;left:0'],['ne','ne-resize','top:0;right:0'],
     ['sw','sw-resize','bottom:0;left:0'],['se','se-resize','bottom:0;right:0']]
    .forEach(([cls, cur, pos]) => {
      const h = document.createElement('div');
      h.style.cssText = `position:absolute;width:14px;height:14px;cursor:${cur};z-index:10;${pos}`;
      const dot = document.createElement('div');
      const isN = cls[0]==='n', isW = cls[1]==='w';
      dot.style.cssText = `position:absolute;width:5px;height:5px;border-radius:50%;background:#2a3a6a;${isN?'top:3px':'bottom:3px'};${isW?'left:3px':'right:3px'}`;
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

    /* ── body ── */
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:6px 8px 6px;display:flex;flex-direction:column;gap:5px;min-height:0';
    panel.appendChild(body);

    /* ── estado do ajuste manual por canal ── */
    // manualOffsets[chId] = delta em samples (inteiro)
    const manualOffsets = {};
    ML.CHANNELS.forEach(ch => { manualOffsets[ch.id] = 0; });

    /* ── cards 2 colunas ── */
    let cardGrid = null;
    const cardRefs = {}; // chId → { offEl, confEl }

    function buildCards() {
      const hasResults = results.some(r => !r.isReference && !r.error && !r.skipped);
      if (!hasResults) return;
      cardGrid = document.createElement('div');
      cardGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:3px;flex-shrink:0';
      const ref = ML.CHANNELS[0];
      cardGrid.appendChild(mkCard(ref.label, '\u2605', ref.color, '0.000s', '100%', null, null));
      results.forEach(r => {
        if (r.isReference || !r.channel) return;
        const ch = r.channel;
        let offTxt='--', offColor='#445', confTxt='--', confColor='#445';
        if (!r.error && !r.skipped) {
          const s = r.offsetMs / 1000;
          offTxt  = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
          offColor = Math.abs(s)<0.1?'#44ff88':Math.abs(s)<1?'#ffd700':'#ff8844';
          const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
          if (pct != null) { confTxt = pct + '%'; confColor = pct>60?'#44ff88':pct>30?'#ffd700':'#ff4444'; }
        } else { offTxt = r.error ? 'ERR' : '--'; offColor = r.error ? '#ff4444' : '#445'; }
        const card = mkCard(ch.label, '', ch.color, offTxt, confTxt, offColor, confColor);
        cardRefs[ch.id] = card.querySelector ? {
          offEl:  card.children[1],
          confEl: card.children[2],
          baseMs: r.offsetMs || 0,
          ch,
        } : null;
        cardGrid.appendChild(card);
      });
      body.appendChild(cardGrid);
    }
    buildCards();

    function updateCardOffset(chId, totalMs) {
      const ref = cardRefs[chId];
      if (!ref) return;
      const s = totalMs / 1000;
      ref.offEl.textContent  = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
      ref.offEl.style.color  = Math.abs(s)<0.1?'#44ff88':Math.abs(s)<1?'#ffd700':'#ff8844';
    }

    /* ── canais ativos ── */
    const activeChannels = [];
    let maxLen = 0;
    ML.CHANNELS.forEach(ch => {
      if (!ch.active || !ch.buffer || ch.buffer.length < 2) return;
      activeChannels.push(ch);
      if (ch.buffer.length > maxLen) maxLen = ch.buffer.length;
    });

    if (!activeChannels.length) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:16px;text-align:center;flex:1';
      msg.textContent = 'Nenhum canal com dados gravados.';
      body.appendChild(msg); document.body.appendChild(panel); return;
    }

    /* ── toggles de canal ── */
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
      btn.onclick = () => { const on = btn.dataset.active==='1'; btn.dataset.active=on?'0':'1'; btn.style.opacity=on?'0.35':'1'; rebuildCharts(); };
      toggleBar.appendChild(btn);
    });
    body.appendChild(toggleBar);

    /* ── barra de ajuste manual ── */
    const manualBar = document.createElement('div');
    manualBar.style.cssText = 'display:none;flex-direction:column;gap:4px;padding:4px 0;flex-shrink:0';

    // Linha de instrução
    const manualHint = document.createElement('div');
    manualHint.style.cssText = 'color:#ffd700;font-size:8px;text-align:center;opacity:.8';
    manualHint.textContent = 'Arraste ← → para ajustar offset de cada canal';
    manualBar.appendChild(manualHint);

    // Sliders por canal (exceto referência)
    const sliderRefs = {};
    activeChannels.forEach((ch, idx) => {
      if (idx === 0) return; // referência não tem slider
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:5px';

      const lbl = document.createElement('span');
      lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:40px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
      lbl.textContent = ch.label;

      const slider = document.createElement('input');
      slider.type  = 'range';
      slider.min   = -200;
      slider.max   = 200;
      slider.step  = 1;
      slider.value = manualOffsets[ch.id] || 0;
      slider.style.cssText = `flex:1;accent-color:${ch.color};cursor:pointer;height:14px`;

      const valLbl = document.createElement('span');
      valLbl.style.cssText = 'color:#aaa;font-size:8px;width:38px;flex-shrink:0;text-align:right;white-space:nowrap';

      function updateSliderLabel() {
        const ivMs = (ch.buffer && ch.buffer.length > 1)
          ? (ch.buffer[ch.buffer.length-1].ts - ch.buffer[0].ts) / (ch.buffer.length - 1)
          : ML.INTERVAL_MS;
        const deltaMs = parseInt(slider.value) * ivMs;
        valLbl.textContent = (deltaMs >= 0 ? '+' : '') + (deltaMs / 1000).toFixed(3) + 's';
        return deltaMs;
      }
      updateSliderLabel();

      slider.addEventListener('input', () => {
        const deltaMs = updateSliderLabel();
        manualOffsets[ch.id] = parseInt(slider.value);
        // Atualiza o card com auto + manual
        const base = (cardRefs[ch.id] && cardRefs[ch.id].baseMs) || 0;
        updateCardOffset(ch.id, base + deltaMs);
        rebuildCharts();
      });

      sliderRefs[ch.id] = { slider, valLbl };
      row.append(lbl, slider, valLbl);
      manualBar.appendChild(row);
    });

    // Botão confirmar: propaga offsets manuais para ML.manualOffsets
    const btnConfirm = document.createElement('button');
    btnConfirm.textContent = '✔ Confirmar ajuste';
    btnConfirm.style.cssText = [
      'background:#44ff8833;border:1px solid #44ff88;color:#44ff88',
      'border-radius:3px;padding:3px 8px;cursor:pointer;font:bold 8px monospace',
      'width:100%;margin-top:2px',
    ].join(';');
    btnConfirm.onclick = () => {
      ML.manualOffsets = {};
      activeChannels.forEach((ch, idx) => {
        if (idx === 0) return;
        const ivMs = (ch.buffer && ch.buffer.length > 1)
          ? (ch.buffer[ch.buffer.length-1].ts - ch.buffer[0].ts) / (ch.buffer.length - 1)
          : ML.INTERVAL_MS;
        const base     = (cardRefs[ch.id] && cardRefs[ch.id].baseMs) || 0;
        const deltaMs  = (manualOffsets[ch.id] || 0) * ivMs;
        ML.manualOffsets[ch.id] = base + deltaMs;
        updateCardOffset(ch.id, base + deltaMs);
      });
      // Atualiza tabela do painel se exposta
      if (ML.panel && ML.panel.refreshOffsets) ML.panel.refreshOffsets(ML.manualOffsets);
      btnConfirm.textContent = '✔ Salvo!';
      setTimeout(() => { btnConfirm.textContent = '✔ Confirmar ajuste'; }, 1500);
    };
    manualBar.appendChild(btnConfirm);
    body.appendChild(manualBar);

    /* ── modo botão manual + paralelo ── */
    btnManual.onclick = () => {
      manualMode = !manualMode;
      updateManualBtn();
      manualBar.style.display = manualMode ? 'flex' : 'none';
      // Ajuste manual faz mais sentido em overlay
      if (manualMode && chartMode !== 'overlay') {
        chartMode = 'overlay';
        updateModeBtn();
      }
      rebuildCharts();
    };
    btnMode.onclick = () => { chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel'; updateModeBtn(); rebuildCharts(); };

    /* ── área dos gráficos ── */
    const chartsArea = document.createElement('div');
    chartsArea.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;gap:2px;overflow:hidden';
    body.appendChild(chartsArea);

    const refCh = activeChannels[0];
    const sharedLabels = refCh.buffer.slice(0, maxLen).map((p, i) => {
      const s = ((p.ts - refCh.buffer[0].ts) / 1000).toFixed(1);
      return i % Math.max(1, Math.floor(maxLen / 10)) === 0 ? s + 's' : '';
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

    /**
     * Aplica o offset manual a uma série: shift circular (ou com padding).
     * shift > 0 → série atrasada (desloca para direita)
     * shift < 0 → série adiantada (desloca para esquerda)
     */
    function shiftSeries(data, shift) {
      if (!shift) return data;
      const n = data.length;
      const out = new Array(n).fill(null);
      if (shift > 0) {
        // dados começam em [shift]; os primeiros `shift` ficam null
        for (let i = shift; i < n; i++) out[i] = data[i - shift];
      } else {
        // dados avançam: [0..n+shift] recebe data[-shift..n]
        const s = -shift;
        for (let i = 0; i < n - s; i++) out[i] = data[i + s];
      }
      return out;
    }

    function buildParallel(channels) {
      const totalGap = (channels.length - 1) * 2;
      const rowH = Math.max(48, Math.floor((chartsArea.offsetHeight - totalGap) / channels.length));
      channels.forEach((ch, idx) => {
        const rawLums = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const shift   = manualMode ? (manualOffsets[ch.id] || 0) : 0;
        const lums    = idx === 0 ? rawLums : shiftSeries(rawLums, shift);
        const validLums = lums.filter(v => v !== null);
        const lMin = validLums.length ? Math.min(...validLums) : 0;
        const lMax = validLums.length ? Math.max(...validLums) : 255;
        const rng  = Math.max(1, lMax - lMin);

        const peaks = showPeaks && ML.correlator
          ? ML.correlator.diffSeries(rawLums).reduce((acc, d, i) => { if (d > 0) acc.push({ xIndex: i, color: ch.color }); return acc; }, [])
          : [];

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
              x: { display: idx === channels.length - 1, ticks: { color: '#444', font: { size: 7 }, maxRotation: 0 }, grid: { color: '#16162a' } },
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
      const allPeaks = showPeaks && ML.correlator
        ? channels.flatMap(ch => {
            const lums = ch.buffer.map(p => p.lum).slice(0, maxLen);
            return ML.correlator.diffSeries(lums).reduce((acc, d, i) => { if (d > 0) acc.push({ xIndex: i, color: ch.color }); return acc; }, []);
          })
        : [];

      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-height:0;overflow:hidden;border-radius:4px;background:#0a0a16;border:1px solid #1a1a30;position:relative';

      // hint de drag visível apenas em modo manual
      if (manualMode) {
        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;top:2px;left:50%;transform:translateX(-50%);color:#ffd70099;font-size:7px;pointer-events:none;z-index:2;white-space:nowrap';
        hint.textContent = 'Use os sliders abaixo para alinhar os canais';
        wrap.appendChild(hint);
      }

      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs); chartsArea.appendChild(wrap);

      const datasets = channels.map((ch, idx) => {
        const rawLums = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const shift   = (manualMode && idx !== 0) ? (manualOffsets[ch.id] || 0) : 0;
        const lums    = idx === 0 ? rawLums : shiftSeries(rawLums, shift);
        return {
          label: ch.label, data: lums,
          borderColor: ch.color, backgroundColor: 'transparent',
          borderWidth: 1.6, pointRadius: 0, tension: 0.2, fill: false, spanGaps: false,
        };
      });

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
            x: { ticks: { color: '#444', font: { size: 7 }, maxRotation: 0 }, grid: { color: '#16162a' } },
            y: { min: 0, max: 255, ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 5 }, grid: { color: '#16162a' } },
          },
        },
        plugins: allPeaks.length ? [makePeakPlugin(allPeaks)] : [],
      });
      chartInstances.push(ci);
    }

    document.body.appendChild(panel);
    requestAnimationFrame(() => rebuildCharts());
  }

  function mkCard(label, prefix, color, offTxt, confTxt, offColor, confColor) {
    const card = document.createElement('div');
    card.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;gap:1px',
      `border:1px solid ${color}44;border-top:2px solid ${color}`,
      `background:${color}0d;border-radius:4px;padding:3px 4px`,
    ].join(';');
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `color:${color};font-weight:bold;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%`;
    nameEl.textContent = (prefix ? prefix + ' ' : '') + label;
    const offEl = document.createElement('div');
    offEl.style.cssText = `color:${offColor||'#44ff88'};font-weight:bold;font-size:10px;line-height:1.1;white-space:nowrap`;
    offEl.textContent = offTxt;
    const confEl = document.createElement('div');
    confEl.style.cssText = `color:${confColor||'#44ff88'};font-size:7px;white-space:nowrap`;
    confEl.textContent = confTxt;
    card.append(nameEl, offEl, confEl);
    return card;
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart: ajuste manual com sliders + shift visual de séries.');
})();
