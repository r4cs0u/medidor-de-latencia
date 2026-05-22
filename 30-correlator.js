(function () {
  const ML = window.MedLat;

  const DEFAULT_LAG_MS = 30000;

  // Histórico de resultados para média móvel do modo AUTO
  const _autoHistory = {}; // chIndex -> [offsetMs, ...]
  const AUTO_HISTORY_SIZE = 4;
  const AUTO_DOWNSAMPLE   = 5;  // usa 1 a cada N amostras (~6fps de 30fps)
  const AUTO_LAG_MS       = 5000; // lag máximo no modo AUTO

  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
  }

  /**
   * Downsample: pega 1 a cada `factor` amostras.
   * Reduz custo da correlação proporcionalmente a factor².
   */
  function downsample(arr, factor) {
    if (factor <= 1) return arr;
    const out = [];
    for (let i = 0; i < arr.length; i += factor) out.push(arr[i]);
    return out;
  }

  function windowedSlice(arr, maxLagSamples) {
    const windowSize = Math.min(arr.length, maxLagSamples * 3);
    return arr.slice(arr.length - windowSize);
  }

  function crossCorrelation(a, b, maxLagSamples) {
    const wa = windowedSlice(a, maxLagSamples);
    const wb = windowedSlice(b, maxLagSamples);
    const na = normalize(wa);
    const nb = normalize(wb);
    const n  = Math.min(na.length, nb.length);
    maxLagSamples = Math.min(maxLagSamples, n - 1);
    const result = [];
    for (let lag = -maxLagSamples; lag <= maxLagSamples; lag++) {
      let sum = 0, count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) { sum += na[i] * nb[j]; count++; }
      }
      result.push({ lag, r: count ? sum / count : 0 });
    }
    return result;
  }

  function selectRobustPeak(corr) {
    const globalPeak = corr.reduce((best, cur) => cur.r > best.r ? cur : best, corr[0]);
    const threshold  = globalPeak.r * 0.80;
    const candidates = corr.filter(c => c.r >= threshold);
    return candidates.reduce((best, cur) =>
      Math.abs(cur.lag) < Math.abs(best.lag) ? cur : best,
      candidates[0]
    );
  }

  /**
   * Análise manual completa — sem teto de lag.
   * maxLagMs pode ir até o que o painel configurar (60s ou mais).
   */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30) {
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };
    }

    const effectiveLagMs = maxLagMs || DEFAULT_LAG_MS; // sem teto artificial
    const maxLagSamples  = Math.ceil(effectiveLagMs / ML.INTERVAL_MS);
    const corr           = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak           = selectRobustPeak(corr);
    const offsetMs       = peak.lag * ML.INTERVAL_MS;
    const confidence     = peak.r;

    return {
      offsetMs, confidence, corr,
      labelA: serA.label, labelB: serB.label,
      serA, serB,
      description: offsetMs > 0
        ? `${serB.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serA.label}`
        : offsetMs < 0
          ? `${serA.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serB.label}`
          : 'Canais sincronizados',
    };
  }

  /**
   * Análise AUTO — usa downsample + janela curta + média móvel.
   * Muito mais leve que a análise manual completa.
   * Retorna mesma estrutura de analyzeAll para compatibilidade.
   */
  function analyzeAuto() {
    const chRef    = ML.CHANNELS[0];
    const results  = [];
    const factor   = AUTO_DOWNSAMPLE;
    const lagMs    = AUTO_LAG_MS;

    results.push({
      channel: chRef, label: chRef.label,
      offsetMs: 0, confidence: 1, isReference: true,
    });

    ML.CHANNELS.slice(1).forEach((ch, idx) => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true });
        return;
      }

      const serA = ML.recorder.getSeries(chRef);
      const serB = ML.recorder.getSeries(ch);

      if (serA.lum.length < 30 || serB.lum.length < 30) {
        results.push({ channel: ch, label: ch.label, error: 'Dados insuficientes.' });
        return;
      }

      // Downsample antes de correlacionar
      const dsA = downsample(serA.lum, factor);
      const dsB = downsample(serB.lum, factor);
      const intervalDs = ML.INTERVAL_MS * factor;
      const maxLagSamples = Math.ceil(lagMs / intervalDs);

      const corr   = crossCorrelation(dsA, dsB, maxLagSamples);
      const peak   = selectRobustPeak(corr);
      const rawMs  = peak.lag * intervalDs;

      // Média móvel ponderada (mais recente = peso 2, anteriores = peso 1)
      const key = idx;
      if (!_autoHistory[key]) _autoHistory[key] = [];
      const hist = _autoHistory[key];

      // Spike filter: se desvio > 3× desvio médio histórico, descarta
      let offsetMs = rawMs;
      if (hist.length >= 2) {
        const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
        const dev = Math.sqrt(hist.reduce((a, b) => a + (b - avg) ** 2, 0) / hist.length);
        if (dev > 0 && Math.abs(rawMs - avg) > Math.max(dev * 3, 500)) {
          // spike: mantém média anterior, não atualiza histórico
          offsetMs = avg;
        } else {
          hist.push(rawMs);
          if (hist.length > AUTO_HISTORY_SIZE) hist.shift();
        }
      } else {
        hist.push(rawMs);
        if (hist.length > AUTO_HISTORY_SIZE) hist.shift();
      }

      // Média ponderada: último tem peso 2
      if (hist.length > 1) {
        let wSum = 0, wTotal = 0;
        hist.forEach((v, i) => { const w = i + 1; wSum += v * w; wTotal += w; });
        offsetMs = wSum / wTotal;
      }

      results.push({
        channel: ch, label: ch.label,
        offsetMs, confidence: peak.r,
        corr, isAuto: true,
      });
    });

    return results;
  }

  /** Limpa histórico AUTO (chamar ao iniciar nova gravação) */
  function clearAutoHistory() {
    Object.keys(_autoHistory).forEach(k => delete _autoHistory[k]);
  }

  function analyzeAll(maxLagMs) {
    const chRef  = ML.CHANNELS[0];
    const results = [];
    results.push({
      channel: chRef, label: chRef.label,
      offsetMs: 0, confidence: 1, isReference: true,
    });
    ML.CHANNELS.slice(1).forEach(ch => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true });
        return;
      }
      const r = analyze(chRef, ch, maxLagMs);
      results.push({
        channel: ch, label: ch.label,
        offsetMs: r.error ? null : r.offsetMs,
        confidence: r.error ? null : r.confidence,
        error: r.error || null,
        corr: r.corr || null,
        serA: r.serA || null,
        serB: r.serB || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeAll, analyzeAuto, clearAutoHistory, crossCorrelation, normalize };
  console.log('[MedLat] 30-correlator carregado (sem teto de lag, AUTO com downsample+média móvel).');
})();
