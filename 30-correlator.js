(function () {
  const ML = window.MedLat;

  const DEFAULT_LAG_MS = 30000;
  const LAG_CANDIDATES = [5000, 15000, 30000, 45000, 60000];
  const DIFF_THRESHOLD = 2; // ignora variações menores que 2 (ruído de compressão/sensor)

  // ─── Derivada: |lum[t] - lum[t-1]|, zera ruído abaixo do threshold ──────────
  function diffSeries(arr) {
    const out = [0];
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(arr[i] - arr[i - 1]);
      out.push(d > DIFF_THRESHOLD ? d : 0);
    }
    return out;
  }

  // ─── Normalização clássica (mean/std) ───────────────────────────────
  // A derivada já elimina o problema de sinais flat, então mean/std funciona bem aqui
  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
  }

  // ─── Janela proporcional ao lag (fator 2) ─────────────────────────────
  function windowedSlice(arr, maxLagSamples) {
    const windowSize = Math.min(arr.length, maxLagSamples * 2);
    return arr.slice(arr.length - windowSize);
  }

  // ─── Cross-correlation sobre a derivada ──────────────────────────────
  function crossCorrelation(a, b, maxLagSamples) {
    const da = diffSeries(a);
    const db = diffSeries(b);
    const wa = windowedSlice(da, maxLagSamples);
    const wb = windowedSlice(db, maxLagSamples);
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

  // ─── Pico robusto: preserva sinal, sem viés para zero ────────────────────
  function selectRobustPeak(corr) {
    const globalPeak = corr.reduce((best, cur) => cur.r > best.r ? cur : best, corr[0]);
    const threshold  = globalPeak.r * 0.99;
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
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };
    const effectiveLagMs = maxLagMs || DEFAULT_LAG_MS;
    const maxLagSamples  = Math.ceil(effectiveLagMs / ML.INTERVAL_MS);
    const corr           = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak           = selectRobustPeak(corr);
    return {
      offsetMs:   peak.lag * ML.INTERVAL_MS,
      confidence: peak.r,
      lagUsedMs:  effectiveLagMs,
      corr, serA, serB,
      labelA: serA.label, labelB: serB.label,
    };
  }

  /**
   * Testa todos os LAG_CANDIDATES e devolve o de maior confidence (r direto).
   * A derivada já equaliza o sinal entre lags, então comparar r direto é correto.
   */
  function analyzeBest(chA, chB) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    let best = null;

    for (const lagMs of LAG_CANDIDATES) {
      const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
      if (Math.min(serA.lum.length, serB.lum.length) < maxLagSamples) continue;

      const corr     = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
      const peak     = selectRobustPeak(corr);
      const offsetMs = peak.lag * ML.INTERVAL_MS;

      if (!best || peak.r > best.confidence) {
        best = {
          offsetMs,
          confidence: peak.r,
          lagUsedMs:  lagMs,
          corr, serA, serB,
          labelA: serA.label, labelB: serB.label,
        };
      }
    }

    // Fallback: buffer pequeno, usa menor lag
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
        labelA: serA.label, labelB: serB.label,
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

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: correlação por derivada |diff|, threshold=' + DIFF_THRESHOLD);
})();
