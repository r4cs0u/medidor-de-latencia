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

  async function showChart(results) {
    if (!Array.isArray(results)) results = [results];
    await loadChartJs();
    const old = document.getElementById('ml-chart-panel');
    if (old) old.remove();

    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel ? mainPanel.getBoundingClientRect() : { left: window.innerWidth - 248, top: 8, width: 228 };
    const INIT_W = 228;
    const INIT_H = Math.min(window.innerHeight - 20, 520);
    const initLeft = Math.max(4, mpRect.left - INIT_W - 8);
    const initTop  = mpRect.top;

    const panel = document.createElement('div');
    panel.id = 'ml-chart-panel';
    panel.style.cssText = [
      `position:fixed;left:${initLeft}px;top:${initTop}px`,
      `width:${INIT_W}px;height:${INIT_H}px`,
      'z-index:99998;min-width:200px;min-height:200px',
      'background:#0e0e1aee;border:1px solid #2a2a4a',
      'border-radius:8px;box-shadow:0 4px 24px #000d',
      'font-family:monospace;font-size:10px;color:#ccc',
      'user-select:none;overflow:hidden;display:flex;flex-direction:column',
    ].join(';');

    /* ── header arrastável ── */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:6px;padding:6px 10px 5px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:8px 8px 0 0;cursor:move;flex-shrink:0',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '📊 Luminância';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';

    /* toggle paralelo / sobreposto */
    let chartMode = 'parallel'; // 'parallel' | 'overlay'
    const btnMode = document.createElement('button');
    btnMode.style.cssText = 'background:#1e2a3a;border:1px solid #2a3a50;color:#00d4ff;border-radius:3px;padding:2px 7px;cursor:pointer;font:bold 8px monospace;flex-shrink:0;white-space:nowrap';
    function updateModeBtn() { btnMode.textContent = chartMode === 'parallel' ? '⫴ Paralelo' : '⧉ Sobreposto'; }
    updateModeBtn();
    btnMode.onclick = () => {
      chartMode = chartMode === 'parallel' ? 'overlay' : 'parallel';
      updateModeBtn();
      rebuildCharts();
    };

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 7px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => panel.remove();
    hdr.append(htitle, btnMode, btnClose);
    panel.appendChild(hdr);

    /* ── drag do painel ── */
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => { pdrag = true; pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    /* ── resize handles nos 4 cantos ── */
    const corners = [
      { cls:'nw', cur:'nw-resize', dx:-1, dy:-1, dw:1,  dh:1  },
      { cls:'ne', cur:'ne-resize', dx:0,  dy:-1, dw:1,  dh:1  },
      { cls:'sw', cur:'sw-resize', dx:-1, dy:0,  dw:1,  dh:1  },
      { cls:'se', cur:'se-resize', dx:0,  dy:0,  dw:1,  dh:1  },
    ];
    corners.forEach(c => {
      const h = document.createElement('div');
      const SZ = 14;
      h.style.cssText = [
        `position:absolute;width:${SZ}px;height:${SZ}px;cursor:${c.cur};z-index:10`,
        c.cls.includes('n') ? 'top:0' : 'bottom:0',
        c.cls.includes('w') ? 'left:0' : 'right:0',
      ].join(';');
      /* dot visual */
      const dot = document.createElement('div');
      dot.style.cssText = [
        'position:absolute;width:5px;height:5px;border-radius:50%;background:#2a3a6a',
        c.cls.includes('n') ? 'top:3px' : 'bottom:3px',
        c.cls.includes('w') ? 'left:3px' : 'right:3px',
      ].join(';');
      h.appendChild(dot);
      panel.appendChild(h);

      let rsx = 0, rsy = 0, rsw = 0, rsh = 0, rsl = 0, rst = 0;
      h.addEventListener('mousedown', e => {
        e.stopPropagation(); e.preventDefault();
        rsx = e.clientX; rsy = e.clientY;
        rsw = panel.offsetWidth; rsh = panel.offsetHeight;
        rsl = panel.offsetLeft; rst = panel.offsetTop;
        function onMove(ev) {
          const dx = ev.clientX - rsx;
          const dy = ev.clientY - rsy;
          let nw = rsw, nh = rsh, nl = rsl, nt = rst;
          if (c.dw) {
            if (c.cls.includes('w')) { nw = Math.max(200, rsw - dx); nl = rsl + rsw - nw; }
            else                     { nw = Math.max(200, rsw + dx); }
          }
          if (c.dh) {
            if (c.cls.includes('n')) { nh = Math.max(200, rsh - dy); nt = rst + rsh - nh; }
            else                     { nh = Math.max(200, rsh + dy); }
          }
          panel.style.width  = nw + 'px';
          panel.style.height = nh + 'px';
          panel.style.left   = nl + 'px';
          panel.style.top    = nt + 'px';
          rebuildCharts();
        }
        function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });

    /* ── body scrollável ── */
    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:8px 10px 8px;display:flex;flex-direction:column;gap:6px;min-height:0';
    panel.appendChild(body);

    /* ── cards compactos (linha única) ── */
    const hasResults = results.some(r => !r.isReference && !r.error && !r.skipped);
    let cardsWrap = null;
    if (hasResults) {
      cardsWrap = document.createElement('div');
      cardsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;flex-shrink:0';

      const ref = ML.CHANNELS[0];
      cardsWrap.appendChild(mkCard(ref.label, '★', ref.color, '0.000s', '100%', null, null));

      results.forEach(r => {
        if (r.isReference || !r.channel) return;
        const ch = r.channel;
        let offTxt = '--', offColor = '#445', confTxt = '--', confColor = '#445';
        if (!r.error && !r.skipped) {
          const s = r.offsetMs / 1000;
          offTxt = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
          offColor = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
          const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
          if (pct != null) {
            confTxt = pct + '%';
            confColor = pct > 60 ? '#44ff88' : pct > 30 ? '#ffd700' : '#ff4444';
          }
        } else {
          offTxt = r.error ? 'ERR' : '--';
          offColor = r.error ? '#ff4444' : '#445';
        }
        cardsWrap.appendChild(mkCard(ch.label, '', ch.color, offTxt, confTxt, offColor, confColor));
      });
      body.appendChild(cardsWrap);
    }

    /* ── toggles de canal ── */
    const activeChannels = [];
    let maxLen = 0;
    ML.CHANNELS.forEach(ch => {
      if (!ch.active || !ch.buffer || ch.buffer.length < 2) return;
      activeChannels.push(ch);
      if (ch.buffer.length > maxLen) maxLen = ch.buffer.length;
    });

    if (activeChannels.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:16px;text-align:center;flex:1';
      msg.textContent = 'Nenhum canal com dados gravados.';
      body.appendChild(msg);
      document.body.appendChild(panel);
      return;
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
      btn.textContent = (idx === 0 ? '★ ' : '') + ch.label;
      btn.onclick = () => {
        const on = btn.dataset.active === '1';
        btn.dataset.active = on ? '0' : '1';
        btn.style.opacity = on ? '0.35' : '1';
        rebuildCharts();
      };
      toggleBar.appendChild(btn);
    });
    body.appendChild(toggleBar);

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
      return activeChannels.filter((_, i) => {
        const btn = toggleBar.children[i];
        return btn && btn.dataset.active === '1';
      });
    }

    function destroyCharts() {
      chartInstances.forEach(c => { try { c.destroy(); } catch(e){} });
      chartInstances = [];
      chartsArea.innerHTML = '';
    }

    function rebuildCharts() {
      destroyCharts();
      const visible = getVisibleChannels();
      if (!visible.length) return;

      if (chartMode === 'overlay') {
        buildOverlay(visible);
      } else {
        buildParallel(visible);
      }
    }

    /* PARALELO: um canvas por canal empilhados */
    function buildParallel(channels) {
      const rowH = Math.max(44, Math.floor((chartsArea.offsetHeight - channels.length * 4) / channels.length));
      channels.forEach((ch, idx) => {
        const lums = ch.buffer.map(p => p.lum).slice(0, maxLen);
        const lMin = Math.min(...lums), lMax = Math.max(...lums);
        const rng  = Math.max(1, lMax - lMin);

        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:stretch;gap:4px;height:${rowH}px;flex-shrink:0;padding:2px 3px;border-radius:4px;background:${ch.color}0d;border-left:2px solid ${ch.color};overflow:hidden`;

        const lbl = document.createElement('div');
        lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:38px;flex-shrink:0;writing-mode:horizontal-tb;display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
        lbl.textContent = (idx === 0 ? '★ ' : '') + ch.label;

        const wrap = document.createElement('div');
        wrap.style.cssText = 'flex:1;min-width:0;overflow:hidden';
        const cvs = document.createElement('canvas');
        wrap.appendChild(cvs);
        row.append(lbl, wrap);
        chartsArea.appendChild(row);

        const ci = new Chart(cvs, {
          type: 'line',
          data: {
            labels: sharedLabels,
            datasets: [{ data: lums, borderColor: ch.color, backgroundColor: ch.color + '18', borderWidth: 1.4, pointRadius: 0, tension: 0.2, fill: true }],
          },
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
        });
        chartInstances.push(ci);
      });
    }

    /* SOBREPOSTO: todos os canais num único canvas */
    function buildOverlay(channels) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;min-height:0;overflow:hidden;border-radius:4px;background:#0a0a16;border:1px solid #1a1a30';
      const cvs = document.createElement('canvas');
      wrap.appendChild(cvs);
      chartsArea.appendChild(wrap);

      const datasets = channels.map(ch => ({
        label: ch.label,
        data: ch.buffer.map(p => p.lum).slice(0, maxLen),
        borderColor: ch.color,
        backgroundColor: 'transparent',
        borderWidth: 1.6,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      }));

      const ci = new Chart(cvs, {
        type: 'line',
        data: { labels: sharedLabels, datasets },
        options: {
          animation: false, responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { color: '#778', font: { size: 8, family: 'monospace' }, boxWidth: 10, padding: 8 },
            },
            tooltip: {
              enabled: true,
              backgroundColor: '#12121fee',
              titleColor: '#00d4ff',
              bodyColor: '#aaa',
              borderColor: '#2a2a4a',
              borderWidth: 1,
              titleFont: { size: 8, family: 'monospace' },
              bodyFont: { size: 8, family: 'monospace' },
              callbacks: {
                title: items => items[0].label || '',
                label: item => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}`,
              },
            },
          },
          layout: { padding: { top: 2, right: 4, bottom: 0, left: 0 } },
          scales: {
            x: { ticks: { color: '#444', font: { size: 7 }, maxRotation: 0 }, grid: { color: '#16162a' } },
            y: { min: 0, max: 255, ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 5 }, grid: { color: '#16162a' } },
          },
        },
      });
      chartInstances.push(ci);
    }

    document.body.appendChild(panel);
    // aguarda render para ter offsetHeight correto
    requestAnimationFrame(() => rebuildCharts());
  }

  /* card compacto: nome + offset em linha única, confiança menor */
  function mkCard(label, prefix, color, offTxt, confTxt, offColor, confColor) {
    const card = document.createElement('div');
    card.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;gap:1px',
      `border:1px solid ${color}44;border-top:2px solid ${color}`,
      `background:${color}0d;border-radius:4px;padding:3px 6px`,
    ].join(';');
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `color:${color};font-weight:bold;font-size:8px;white-space:nowrap`;
    nameEl.textContent = (prefix ? prefix + ' ' : '') + label;
    const offEl = document.createElement('div');
    offEl.style.cssText = `color:${offColor || '#44ff88'};font-weight:bold;font-size:10px;line-height:1.1;white-space:nowrap`;
    offEl.textContent = offTxt;
    const confEl = document.createElement('div');
    confEl.style.cssText = `color:${confColor || '#44ff88'};font-size:7px;white-space:nowrap`;
    confEl.textContent = confTxt;
    card.append(nameEl, offEl, confEl);
    return card;
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart carregado — paralelo/sobreposto + resize por cantos.');
})();
