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

    /* ── posiciona à esquerda do painel principal ── */
    const mainPanel = document.getElementById('ml-panel');
    const mpRect = mainPanel ? mainPanel.getBoundingClientRect() : { left: window.innerWidth - 248, top: 8, width: 228 };
    const initLeft = Math.max(4, mpRect.left - 420 - 8);
    const initTop  = mpRect.top;

    const panel = document.createElement('div');
    panel.id = 'ml-chart-panel';
    panel.style.cssText = [
      `position:fixed;left:${initLeft}px;top:${initTop}px`,
      'z-index:99998',
      'background:#0e0e1aee;border:1px solid #2a2a4a',
      'border-radius:8px;box-shadow:0 4px 24px #000d',
      'font-family:monospace;font-size:10px;color:#ccc',
      'user-select:none;width:420px;overflow:hidden',
    ].join(';');

    /* ── header arrastável ── */
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:6px;padding:6px 10px 5px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:8px 8px 0 0;cursor:move',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '📊 Luminância por Frame';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;flex:1';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 7px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnClose.onclick = () => panel.remove();
    hdr.append(htitle, btnClose);
    panel.appendChild(hdr);

    let drag = false, ox = 0, oy = 0;
    hdr.addEventListener('mousedown', e => { drag = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop; });
    window.addEventListener('mousemove', e => { if (!drag) return; panel.style.left = Math.max(0, e.clientX - ox) + 'px'; panel.style.top = Math.max(0, e.clientY - oy) + 'px'; });
    window.addEventListener('mouseup', () => drag = false);

    const body = document.createElement('div');
    body.style.cssText = 'padding:10px 12px 10px;max-height:calc(100vh - 80px);overflow-y:auto';
    panel.appendChild(body);

    /* ── resultados em cards lado a lado ── */
    const hasResults = results.some(r => !r.isReference && !r.error && !r.skipped);
    if (hasResults) {
      const rLabel = document.createElement('div');
      rLabel.style.cssText = 'font-size:7px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;margin-bottom:5px';
      rLabel.textContent = 'Comparativo de Offset';
      body.appendChild(rLabel);

      const cards = document.createElement('div');
      cards.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #1a1a30';

      /* card referência */
      const ref = ML.CHANNELS[0];
      const refCard = mkCard(ref.label, '★', ref.color, '0.000s', '100%', null);
      cards.appendChild(refCard);

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
            confTxt = pct + '%' + (r.lagUsedMs ? '@' + (r.lagUsedMs/1000) + 's' : '');
            confColor = pct > 60 ? '#44ff88' : pct > 30 ? '#ffd700' : '#ff4444';
          }
        } else {
          offTxt = r.error ? 'ERRO' : '--';
          offColor = r.error ? '#ff4444' : '#445';
        }
        cards.appendChild(mkCard(ch.label, '', ch.color, offTxt, confTxt, offColor, confColor));
      });

      body.appendChild(cards);
    }

    /* ── datasets ── */
    const activeChannels = [];
    let maxLen = 0;
    ML.CHANNELS.forEach(ch => {
      if (!ch.active || !ch.buffer || ch.buffer.length < 2) return;
      activeChannels.push(ch);
      if (ch.buffer.length > maxLen) maxLen = ch.buffer.length;
    });

    if (activeChannels.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:16px;text-align:center';
      msg.textContent = 'Nenhum canal com dados gravados.';
      body.appendChild(msg);
      document.body.appendChild(panel);
      return;
    }

    /* toggle bar */
    const cLabel = document.createElement('div');
    cLabel.style.cssText = 'font-size:7px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;margin-bottom:5px';
    cLabel.textContent = 'Canais visíveis';
    body.appendChild(cLabel);

    const toggleBar = document.createElement('div');
    toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px';
    body.appendChild(toggleBar);

    /* ── small multiples: um mini-chart por canal ── */
    const chartsWrap = document.createElement('div');
    chartsWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px';
    body.appendChild(chartsWrap);

    const refCh = activeChannels[0];
    const sharedLabels = refCh.buffer.slice(0, maxLen).map((p, i) => {
      const sec = ((p.ts - refCh.buffer[0].ts) / 1000).toFixed(1);
      return i % Math.max(1, Math.floor(maxLen / 14)) === 0 ? sec + 's' : '';
    });

    const instances = [];

    activeChannels.forEach((ch, idx) => {
      const lums = ch.buffer.map(p => p.lum);
      const localMin = Math.min(...lums);
      const localMax = Math.max(...lums);
      const rng  = Math.max(1, localMax - localMin);
      const yMin = Math.max(0,   Math.floor(localMin - rng * 0.10));
      const yMax = Math.min(255, Math.ceil (localMax + rng * 0.10));

      /* row por canal */
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:6px;padding:3px 4px;border-radius:4px;background:${ch.color}0d;border-left:2px solid ${ch.color};overflow:hidden`;

      /* label lateral */
      const lbl = document.createElement('div');
      lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:44px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
      lbl.textContent = (idx === 0 ? '★ ' : '') + ch.label;

      /* canvas */
      const wrap = document.createElement('div');
      wrap.style.cssText = 'flex:1;height:44px;overflow:hidden';
      const cvs = document.createElement('canvas');
      cvs.height = 44;
      wrap.appendChild(cvs);

      row.append(lbl, wrap);
      chartsWrap.appendChild(row);

      const ci = new Chart(cvs, {
        type: 'line',
        data: {
          labels: sharedLabels,
          datasets: [{
            data: lums.slice(0, maxLen),
            borderColor: ch.color,
            backgroundColor: ch.color + '18',
            borderWidth: 1.3,
            pointRadius: 0,
            tension: 0.2,
            fill: true,
          }],
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          layout: { padding: { top: 1, right: 2, bottom: 0, left: 0 } },
          scales: {
            x: { display: idx === activeChannels.length - 1, ticks: { color: '#444', font: { size: 7 }, maxRotation: 0 }, grid: { color: '#16162a' } },
            y: { ticks: { color: '#444', font: { size: 7 }, maxTicksLimit: 3 }, grid: { color: '#16162a' }, min: yMin, max: yMax },
          },
        },
      });
      instances.push({ ch, row, ci });

      /* toggle btn */
      const btn = document.createElement('button');
      btn.style.cssText = [
        `background:${ch.color}22`,
        `border:1px solid ${ch.color}88`,
        `color:${ch.color}`,
        'border-radius:3px;padding:2px 7px;cursor:pointer;font:bold 8px monospace;transition:opacity .15s',
      ].join(';');
      btn.textContent = (idx === 0 ? '★ ' : '') + ch.label;
      btn.onclick = () => {
        const hidden = row.style.display !== 'none';
        row.style.display = hidden ? 'none' : 'flex';
        btn.style.opacity = hidden ? '0.35' : '1';
      };
      toggleBar.appendChild(btn);
    });

    document.body.appendChild(panel);
  }

  function mkCard(label, prefix, color, offTxt, confTxt, offColor, confColor) {
    const card = document.createElement('div');
    card.style.cssText = [
      'display:flex;flex-direction:column;align-items:center;gap:2px',
      `border:1px solid ${color}44;border-top:2px solid ${color}`,
      `background:${color}0d;border-radius:4px;padding:4px 8px;min-width:64px`,
    ].join(';');
    const nameEl = document.createElement('div');
    nameEl.style.cssText = `color:${color};font-weight:bold;font-size:9px;white-space:nowrap`;
    nameEl.textContent = prefix + (prefix ? ' ' : '') + label;
    const offEl = document.createElement('div');
    offEl.style.cssText = `color:${offColor || '#44ff88'};font-weight:bold;font-size:11px;line-height:1.1`;
    offEl.textContent = offTxt;
    const confEl = document.createElement('div');
    confEl.style.cssText = `color:${confColor || '#44ff88'};font-size:8px`;
    confEl.textContent = confTxt;
    card.append(nameEl, offEl, confEl);
    return card;
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart carregado — painel flutuante + small multiples.');
})();
