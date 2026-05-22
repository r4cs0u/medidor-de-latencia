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

    const old = document.getElementById('ml-chart-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ml-chart-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0',
      'background:#0009',
      'z-index:999998',
      'display:flex;align-items:center;justify-content:center',
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'background:#0e0e1a',
      'border:1px solid #2a2a4a',
      'border-radius:10px',
      'padding:12px 14px 10px',
      'width:min(88vw, 760px)',
      'max-height:80vh',
      'overflow-y:auto',
      'position:relative',
      'color:#ccc',
      'font-family:monospace',
      'font-size:10px',
    ].join(';');

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.style.cssText = 'position:absolute;top:8px;right:8px;background:#c62828;border:none;color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px';
    btnClose.onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:11px;font-weight:bold;color:#00d4ff;margin-bottom:8px;padding-right:40px';
    titleEl.textContent = '📡 Luminância por Frame';

    box.append(btnClose, titleEl);

    const datasets = [];
    let globalMin = Infinity, globalMax = -Infinity;
    let maxLen = 0;

    ML.CHANNELS.forEach(ch => {
      if (!ch.active || !ch.buffer || ch.buffer.length < 2) return;
      const lums = ch.buffer.map(p => p.lum);
      lums.forEach(v => {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      });
      if (lums.length > maxLen) maxLen = lums.length;
      datasets.push({ ch, lums, hidden: false });
    });

    if (datasets.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:#ff4444;padding:20px;text-align:center';
      msg.textContent = 'Nenhum canal com dados gravados.';
      box.appendChild(msg);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      return;
    }

    const range = Math.max(1, globalMax - globalMin);
    const yMin = Math.max(0, Math.floor(globalMin - range * 0.10));
    const yMax = Math.min(255, Math.ceil(globalMax + range * 0.10));

    const refCh = datasets[0].ch;
    const labels = refCh.buffer.slice(0, maxLen).map((p, i) => {
      const sec = ((p.ts - refCh.buffer[0].ts) / 1000).toFixed(1);
      return i % Math.max(1, Math.floor(maxLen / 16)) === 0 ? sec + 's' : '';
    });

    const toggleBar = document.createElement('div');
    toggleBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px';

    const hasResults = results.some(r => !r.isReference && !r.error && !r.skipped);
    if (hasResults) {
      const secLabel = document.createElement('div');
      secLabel.style.cssText = 'font-size:8px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;margin-bottom:5px';
      secLabel.textContent = 'Comparativo de Offset';
      box.appendChild(secLabel);

      const table = document.createElement('div');
      table.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:2px 10px;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #1a1a30';

      ['Canal', 'Offset', 'Confiança'].forEach(h => {
        const c = document.createElement('span');
        c.textContent = h;
        c.style.cssText = 'font-size:8px;color:#445;font-weight:bold;border-bottom:1px solid #1a1a30;padding-bottom:2px';
        table.appendChild(c);
      });

      const ref = ML.CHANNELS[0];
      const refName = document.createElement('span');
      refName.style.cssText = `font-size:9px;color:${ref.color};font-weight:bold`;
      refName.textContent = '★ ' + ref.label;
      const refOff = document.createElement('span'); refOff.textContent = '0.000s'; refOff.style.cssText = 'font-size:9px;color:#44ff88;text-align:right';
      const refConf = document.createElement('span'); refConf.textContent = '100%'; refConf.style.cssText = 'font-size:9px;color:#44ff88;text-align:right';
      table.append(refName, refOff, refConf);

      results.forEach(r => {
        if (r.isReference || !r.channel) return;
        const ch = r.channel;

        const nameEl = document.createElement('span');
        nameEl.style.cssText = `font-size:9px;color:${ch.color};font-weight:bold`;
        nameEl.textContent = ch.label;

        const offEl = document.createElement('span');
        offEl.style.cssText = 'font-size:9px;font-weight:bold;text-align:right';
        const confEl = document.createElement('span');
        confEl.style.cssText = 'font-size:9px;text-align:right';

        if (r.error || r.skipped) {
          offEl.textContent = r.error ? 'ERRO' : '--';
          confEl.textContent = '--';
          offEl.style.color = r.error ? '#ff4444' : '#445';
          confEl.style.color = '#445';
        } else {
          const s = r.offsetMs / 1000;
          offEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
          offEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
          const pct = r.confidence != null ? Math.round(r.confidence * 100) : null;
          confEl.textContent = pct != null ? pct + '%' : '--';
          confEl.style.color = pct == null ? '#445' : pct > 60 ? '#44ff88' : pct > 30 ? '#ffd700' : '#ff4444';
        }

        table.append(nameEl, offEl, confEl);
      });

      box.appendChild(table);
    }

    const chartLabel = document.createElement('div');
    chartLabel.style.cssText = 'font-size:8px;color:#3a3a5a;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;margin-bottom:5px';
    chartLabel.textContent = 'Curvas visíveis';
    box.appendChild(chartLabel);

    const lumWrap = document.createElement('div');
    lumWrap.style.cssText = 'height:160px;margin-bottom:4px';
    const lumCanvas = document.createElement('canvas');
    lumCanvas.style.cssText = 'width:100%;height:100%;display:block';
    lumCanvas.height = 160;

    let chartInstance = null;

    function buildChart() {
      if (chartInstance) chartInstance.destroy();
      chartInstance = new Chart(lumCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: datasets.map(d => ({
            label: d.ch.label,
            data: d.lums.slice(0, maxLen),
            borderColor: d.ch.color,
            backgroundColor: d.ch.color + '14',
            borderWidth: 1.4,
            pointRadius: 0,
            tension: 0.2,
            hidden: d.hidden,
          })),
        },
        options: {
          animation: false,
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          layout: { padding: { top: 2, right: 4, bottom: 0, left: 0 } },
          scales: {
            x: { ticks: { color: '#555', font: { size: 8 } }, grid: { color: '#16162a' } },
            y: { ticks: { color: '#555', font: { size: 8 } }, grid: { color: '#16162a' }, min: yMin, max: yMax },
          },
        },
      });
    }

    datasets.forEach((d, idx) => {
      const btn = document.createElement('button');
      btn.style.cssText = [
        `background:${d.ch.color}22`,
        `border:1px solid ${d.ch.color}88`,
        `color:${d.ch.color}`,
        'border-radius:3px;padding:2px 7px;cursor:pointer;font:bold 9px monospace',
        'transition:opacity .15s',
      ].join(';');
      btn.textContent = (idx === 0 ? '★ ' : '') + d.ch.label;
      btn.title = 'Clique para mostrar/ocultar';
      btn.onclick = () => {
        d.hidden = !d.hidden;
        btn.style.opacity = d.hidden ? '0.35' : '1';
        if (chartInstance) {
          chartInstance.data.datasets[idx].hidden = d.hidden;
          chartInstance.update();
        }
      };
      toggleBar.appendChild(btn);
    });

    box.append(toggleBar, lumWrap);
    lumWrap.appendChild(lumCanvas);
    buildChart();

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  ML.chart = { show: showChart };
  console.log('[MedLat] 40-chart carregado — layout compacto + offsets acima.');
})();
