(function () {
  const ML = window.MedLat;

  // Threshold adaptativo: usa desvio padrão da série * fator
  const ADAPT_FACTOR = 0.15;
  const DIFF_THRESHOLD_MIN = 1;

  function adaptiveThreshold(arr) {
    const n = arr.length;
    if (!n) return DIFF_THRESHOLD_MIN;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    return Math.max(DIFF_THRESHOLD_MIN, std * ADAPT_FACTOR);
  }

  function diffSeries(arr) {
    const thr = adaptiveThreshold(arr);
    const out = [0];
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(arr[i] - arr[i - 1]);
      out.push(d > thr ? d : 0);
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

  /**
   * Interpolação parabólica sub-frame.
   * Dados 3 pontos ao redor do pico (y0, y1, y2), estima o máximo contínuo.
   * Retorna ajuste fracionário em samples (-0.5 .. +0.5).
   */
  function parabolicPeak(corr, peakIdx) {
    if (peakIdx <= 0 || peakIdx >= corr.length - 1) return 0;
    const y0 = corr[peakIdx - 1].r;
    const y1 = corr[peakIdx    ].r;
    const y2 = corr[peakIdx + 1].r;
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) < 1e-10) return 0;
    return (y0 - y2) / denom; // ajuste em frações de sample
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
   * Intervalo real (ms/sample) calculado direto dos timestamps do buffer gravado.
   * Evita deriva de framerate em relação ao INTERVAL_MS nominal.
   */
  function realIntervalMs(ser) {
    const buf = ser.timestamps || ser.lum; // timestamps é array paralelo se existir
    // Tenta acessar o buffer com timestamps via ML.recorder
    const ch = ML.CHANNELS.find(c => c.label === ser.label);
    if (ch && ch.buffer && ch.buffer.length > 1) {
      const first = ch.buffer[0].ts;
      const last  = ch.buffer[ch.buffer.length - 1].ts;
      const n     = ch.buffer.length - 1;
      const iv    = (last - first) / n;
      // Sanity check: entre 10ms e 200ms por sample
      if (iv >= 10 && iv <= 200) return iv;
    }
    return ML.INTERVAL_MS;
  }

  function effectiveLag(serA, serB) {
    const minSamples = Math.min(serA.lum.length, serB.lum.length);
    const durationMs = minSamples * ML.INTERVAL_MS;
    const lagMs      = Math.floor(durationMs * 0.8);
    const minLag     = ML.MIN_LAG_MS || 20000;
    const maxLag     = (ML.BUFFER_SECONDS || 120) * 1000;
    return Math.max(minLag, Math.min(lagMs, maxLag));
  }

  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    const ivA  = realIntervalMs(serA);
    const ivB  = realIntervalMs(serB);
    const ivMs = (ivA + ivB) / 2;

    const lagMs        = maxLagMs || effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ivMs);
    const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak          = selectRobustPeak(corr);
    const peakIdx       = corr.findIndex(c => c.lag === peak.lag);
    const subFrame      = parabolicPeak(corr, peakIdx);
    const offsetMs      = (peak.lag + subFrame) * ivMs;

    return {
      offsetMs,
      confidence: peak.r,
      lagUsedMs:  lagMs,
      intervalMs: ivMs,
      subFrame,
      corr, serA, serB,
      labelA: serA.label, labelB: serB.label,
    };
  }

  function analyzeBest(chA, chB) {
    return analyze(chA, chB, null);
  }

  function analyzeBestAll() {
    const chRef   = ML.CHANNELS[0];
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
        intervalMs: r.error ? null : r.intervalMs,
        subFrame:   r.error ? null : r.subFrame,
        error:      r.error || null,
        corr:       r.corr  || null,
        serA:       r.serA  || null,
        serB:       r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: sub-frame parabólico + threshold adaptativo + interval real do buffer.');
})();
