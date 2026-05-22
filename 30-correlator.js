(function () {
  const ML = window.MedLat;

  const DIFF_THRESHOLD = 2;

  function diffSeries(arr) {
    const out = [0];
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(arr[i] - arr[i - 1]);
      out.push(d > DIFF_THRESHOLD ? d : 0);
    }
    return out;
  }

  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
  }

  function windowedSlice(arr, maxLagSamples) {
    const windowSize = Math.min(arr.length, maxLagSamples * 2);
    return arr.slice(arr.length - windowSize);
  }

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

  function selectRobustPeak(corr) {
    const globalPeak = corr.reduce((best, cur) => cur.r > best.r ? cur : best, corr[0]);
    const threshold  = globalPeak.r * 0.99;
    const candidates = corr.filter(c => c.r >= threshold);
    return candidates.reduce((best, cur) =>
      Math.abs(cur.lag) < Math.abs(best.lag) ? cur : best,
      candidates[0]
    );
  }

  /**
   * Calcula lag efetivo baseado no buffer real gravado.
   * Usa 80% da dura\u00e7\u00e3o do menor buffer, com floor de MIN_LAG_MS (20s).
   * Cap m\u00e1ximo em BUFFER_SECONDS (120s).
   */
  function effectiveLag(serA, serB) {
    const minSamples    = Math.min(serA.lum.length, serB.lum.length);
    const durationMs    = minSamples * ML.INTERVAL_MS;
    const lagMs         = Math.floor(durationMs * 0.8);
    const minLag        = ML.MIN_LAG_MS || 20000;
    const maxLag        = (ML.BUFFER_SECONDS || 120) * 1000;
    return Math.max(minLag, Math.min(lagMs, maxLag));
  }

  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (m\u00ednimo 30 amostras por canal).' };
    const lagMs         = maxLagMs || effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
    const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak          = selectRobustPeak(corr);
    return {
      offsetMs:   peak.lag * ML.INTERVAL_MS,
      confidence: peak.r,
      lagUsedMs:  lagMs,
      corr, serA, serB,
      labelA: serA.label, labelB: serB.label,
    };
  }

  function analyzeBest(chA, chB) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (m\u00ednimo 30 amostras por canal).' };
    const lagMs         = effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ML.INTERVAL_MS);
    const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak          = selectRobustPeak(corr);
    return {
      offsetMs:   peak.lag * ML.INTERVAL_MS,
      confidence: peak.r,
      lagUsedMs:  lagMs,
      corr, serA, serB,
      labelA: serA.label, labelB: serB.label,
    };
  }

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
        channel:    ch,
        label:      ch.label,
        offsetMs:   r.error ? null : r.offsetMs,
        confidence: r.error ? null : r.confidence,
        lagUsedMs:  r.error ? null : r.lagUsedMs,
        error:      r.error || null,
        corr:       r.corr  || null,
        serA:       r.serA  || null,
        serB:       r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: lag din\u00e2mico (max buffer * 0.8, floor 20s), threshold=' + DIFF_THRESHOLD);
})();
