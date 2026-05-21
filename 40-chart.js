(function () {
  const ML = window.MedLat;

  /**
   * Carrega Chart.js via script tag (CDN) se ainda não estiver disponível.
   * Retorna Promise que resolve quando Chart.js estiver pronto.
   */
  function loadChartJs() {
    return new Promise((resolve) => {
      if (window.Chart) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  /**
   * Abre um overlay com os gráficos de luminância + correlação.
   * result = retorno de ML.correlator.analyze()
   */
  async function showChart(result) {
    if (result.error) { alert('[MedLat] ' + result.error); return; }

    await loadChartJs();

    // Remove overlay anterior
    const old = document.getElementById('ml-chart-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ml-chart-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0',
      'background:#0008',
      'z-index:999998',
      'display:flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    const box = document.createElement('div');
    box.style.cssText = [
      'background:#0e0e1a',
      'border:1px solid #333',
      'border-radius:10px',
      'padding:16px',
      'width:min(90vw, 900px)',
      'max-height:88vh',
      'overflow-y:auto',
      'position:relative',
      'color:#ccc',
      'font-family:monospace',
      'font-size:12px',
    ].join(';');

    // Botão fechar
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fechar';
    btnClose.style.cssText = 'position:absolute;top:10px;right:10px;background:#e94560;border:none;color:#fff;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:11px';
    btnClose.onclick = () => overlay.remove();

    const title = document.createElement('div');
    title.style.cssText = 'font-size:13px;font-weight:bold;color:#ffd700;margin-bottom:12px';
    title.textContent = `⚡ ${result.description}`;

    const confDiv = document.createElement('div');
    confDiv.style.cssText = 'font-size:11px;color:#888;margin-bottom:14px';
    confDiv.textContent = `Confiança da correlação: ${(result.confidence * 100).toFixed(1)}%  |  Offset: ${result.offsetMs > 0 ? '+' : ''}${result.offsetMs}ms`;

    // Canvas luminância
    const lumTitle = document.createElement('div');
    lumTitle.style.cssText = 'color:#aaa;font-size:10px;margin-bottom:4px';
    lumTitle.textContent = 'LUMINÂNCIA POR FRAME';
    const lumCanvas = document.createElement('canvas');
    lumCanvas.style.cssText = 'width:100%;height:220px;display:block;margin-bottom:16px';

    // Canvas correlação
    const corrTitle = document.createElement('div');
    corrTitle.style.cssText = 'color:#aaa;font-size:10px;margin-bottom:4px';
    corrTitle.textContent = 'CROSS-CORRELATION (pico = offset)';
    const corrCanvas = document.createElement('canvas');
    corrCanvas.style.cssText = 'width:100%;height:160px;display:block';

    box.append(btnClose, title, confDiv, lumTitle, lumCanvas, corrTitle, corrCanvas);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // ── Gráfico de luminância ────────────────────────────
    const nPoints = Math.min(result.serA.lum.length, result.serB.lum.length);
    const labels  = result.serA.ts.slice(0, nPoints).map((t, i) => {
      const sec = ((t - result.serA.ts[0]) / 1000).toFixed(1);
      return i % Math.max(1, Math.floor(nPoints / 20)) === 0 ? sec + 's' : '';
    });

    new Chart(lumCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: result.labelA,
            data:  result.serA.lum.slice(0, nPoints),
            borderColor: result.serA.color,
            backgroundColor: result.serA.color + '18',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          },
          {
            label: result.labelB,
            data:  result.serB.lum.slice(0, nPoints),
            borderColor: result.serB.color,
            backgroundColor: result.serB.color + '18',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.2,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#aaa', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: '#1a1a2e' } },
          y: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: '#1a1a2e' }, min: 0, max: 255 },
        },
      },
    });

    // ── Gráfico de correlação ────────────────────────────
    const corrLabels = result.corr.map(c =>
      c.lag % Math.max(1, Math.floor(result.corr.length / 20)) === 0
        ? (c.lag * ML.INTERVAL_MS / 1000).toFixed(1) + 's'
        : ''
    );

    new Chart(corrCanvas, {
      type: 'bar',
      data: {
        labels: corrLabels,
        datasets: [{
          label: 'Correlação',
          data:  result.corr.map(c => c.r),
          backgroundColor: result.corr.map(c =>
            c.lag === result.corr.find(x => x.r === result.confidence)?.lag
              ? '#ffd700'
              : '#4444ff55'
          ),
          borderWidth: 0,
        }],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: '#1a1a2e' } },
          y: { ticks: { color: '#666', font: { size: 9 } }, grid: { color: '#1a1a2e' }, min: -1, max: 1 },
        },
      },
    });
  }

  ML.chart = { show: showChart };

  console.log('[MedLat] 40-chart carregado.');
})();
