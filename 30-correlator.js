(function () {
  const ML = window.MedLat;

  const DEFAULT_LAG_MS = 30000;
  const LAG_CANDIDATES = [5000, 15000, 30000, 45000, 60000];

  // ─── Normalização robusta (median + MAD) ───────────────────────────────────
  // Resiste a períodos flat longos onde std ≈ 0 enganava a normalização clássica
  function robustNormalize(arr) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const n      = sorted.length;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const mad = sorted.reduce((s, v) => s + Math.abs(v - median), 0) / n || 1;
    return arr.map(v => (v - median) / mad);
  }

  // ─── Janela proporcional: fator 2 (antes era 3) ───────────────────────────
  // Foca mais no sinal relevante e reduz ruído em séries longas
  function windowedSlice(arr, maxLagSamples) {
    const windowSize = Math.min(arr.length, maxLagSamples * 2);
    return arr.slice(arr.length - windowSize);
  }

  // ─── Cross-correlation retorna também o n efetivo ─────────────────────────
  function crossCorrelation(a, b, maxLagSamples) {
    const wa = windowedSlice(a, maxLagSamples);
    const wb = windowedSlice(b, maxLagSamples);
    const na = robustNormalize(wa);
    const nb = robustNormalize(wb);
    const n  = Math.min(na.length, nb.length);
    maxLagSamples = Math.min(maxLagSamples, n - 1);
    const result = [];
    for (let lag = -maxLagSamples; lag <= maxLagSamples; lag++) {
      let sum = 0, count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) { sum += na[i] * nb[j]; count++; }
      }
      result.push({ lag, r: count ? sum / count : 0, count });
    }
    return result;
  }

  // ─── Pico robusto: preserva sinal, sem viés para zero ─────────────────────
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
   * Testa todos os LAG_CANDIDATES e devolve o resultado com maior confidence.
   *
   * Score normalizado: divide pelo nEfetivo para evitar que lags curtos
   * (mais amostras sobrepostas) ganhem injustamente sobre lags longos.
   */
  function analyzeBest(chA, chB) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    let best = null;

    for (const lagMs of LAG_CANDIDATES) {
      const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
      const minSamples    = maxLagSamples; // janela = lag*2, precisa de pelo menos lag samples
      if (Math.min(serA.lum.length, serB.lum.length) < minSamples) continue;

      const corr     = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
      const peak     = selectRobustPeak(corr);
      const offsetMs = peak.lag * ML.INTERVAL_MS;

      // Score normalizado: r / sqrt(nEfetivo) — penaliza lags curtos com muitas amostras
      const nEff          = peak.count || 1;
      const normalizedScore = peak.r / Math.sqrt(nEff);

      if (!best || normalizedScore > best._score) {
        best = {
          offsetMs,
          confidence: peak.r,
          lagUsedMs: lagMs,
          _score: normalizedScore,
          corr, serA, serB,
          labelA: serA.label,
          labelB: serB.label,
        };
      }
    }

    // Fallback: buffer pequeno demais, usa o menor lag disponível
    if (!best) {
      const lagMs         = LAG_CANDIDATES[0];
      const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
      const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
      const peak          = selectRobustPeak(corr);
      best = {
        offsetMs: peak.lag * ML.INTERVAL_MS,
        confidence: peak.r,
        lagUsedMs: lagMs,
        _score: 0,
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

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, robustNormalize };
  console.log('[MedLat] 30-correlator: normalização robusta (median+MAD) + score normalizado por n.');
})();
