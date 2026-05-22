(function () {
  const ML = window.MedLat;

  const DEFAULT_LAG_MS  = 30000;
  const LAG_CANDIDATES  = [5000, 15000, 30000, 45000, 60000];

  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
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

  /** Análise simples com um único lagMs. */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (m\u00ednimo 30 amostras por canal).' };

    const effectiveLagMs = maxLagMs || DEFAULT_LAG_MS;
    const maxLagSamples  = Math.ceil(effectiveLagMs / ML.INTERVAL_MS);
    const corr           = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak           = selectRobustPeak(corr);
    const offsetMs       = peak.lag * ML.INTERVAL_MS;

    return {
      offsetMs,
      confidence: peak.r,
      lagUsedMs: effectiveLagMs,
      corr, serA, serB,
      labelA: serA.label,
      labelB: serB.label,
    };
  }

  /**
   * Testa todos os LAG_CANDIDATES e devolve o resultado
   * com maior confidence para o par chA → chB.
   */
  function analyzeBest(chA, chB) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (m\u00ednimo 30 amostras por canal).' };

    let best = null;

    for (const lagMs of LAG_CANDIDATES) {
      const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
      // Só vale testar se o buffer tem amostras suficientes para essa janela
      if (Math.min(serA.lum.length, serB.lum.length) < maxLagSamples * 2) continue;

      const corr     = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
      const peak     = selectRobustPeak(corr);
      const offsetMs = peak.lag * ML.INTERVAL_MS;

      if (!best || peak.r > best.confidence) {
        best = {
          offsetMs,
          confidence: peak.r,
          lagUsedMs: lagMs,
          corr, serA, serB,
          labelA: serA.label,
          labelB: serB.label,
        };
      }
    }

    // Fallback: se nenhum lag passou o filtro de amostras, usa o menor
    if (!best) {
      const lagMs        = LAG_CANDIDATES[0];
      const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
      const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
      const peak          = selectRobustPeak(corr);
      best = {
        offsetMs: peak.lag * ML.INTERVAL_MS,
        confidence: peak.r,
        lagUsedMs: lagMs,
        corr, serA, serB,
        labelA: serA.label,
        labelB: serB.label,
      };
    }

    return best;
  }

  /** Roda analyzeBest para todos os canais ativos vs referência. */
  function analyzeBestAll() {
    const chRef  = ML.CHANNELS[0];
    const results = [];
    results.push({
      channel: chRef, label: chRef.label,
      offsetMs: 0, confidence: 1, lagUsedMs: 0, isReference: true,
    });
    ML.CHANNELS.slice(1).forEach(ch => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true });
        return;
      }
      const r = analyzeBest(chRef, ch);
      results.push({
        channel: ch, label: ch.label,
        offsetMs:   r.error ? null : r.offsetMs,
        confidence: r.error ? null : r.confidence,
        lagUsedMs:  r.error ? null : r.lagUsedMs,
        error: r.error || null,
        corr:  r.corr  || null,
        serA:  r.serA  || null,
        serB:  r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, normalize };
  console.log('[MedLat] 30-correlator carregado (analyzeBest: testa 5 lags, retorna maior confian\u00e7a).');
})();
