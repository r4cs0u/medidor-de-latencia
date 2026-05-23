(function () {
  const ML = window.MedLat;

  // Threshold adaptativo: usa desvio padrão da série * fator
  const ADAPT_FACTOR = 0.15;
  const DIFF_THRESHOLD_MIN = 1;
  const LANDMARK_TOP_N = 20;
  const LANDMARK_REFINE_RATIO = 0.20; // janela de refinamento: ±20% do lagMs estimado

  // Fase 1: resampling temporal
  // Limiar de drift: se o desvio padrão dos intervalos entre amostras
  // for maior que DRIFT_THRESHOLD_RATIO * média, a série é considerada
  // instável e será reamostrada para um grid uniforme antes da correlação.
  const DRIFT_THRESHOLD_RATIO = 0.20;
  const RESAMPLE_INTERVAL_MS  = 33; // ~30fps, grid alvo fixo

  /**
   * resampleToGrid: interpola linearmente uma série irregular {ts[], lum[]}
   * para um grid uniforme de targetIntervalMs.
   * Retorna { lum: number[], ts: number[], intervalMs: number }.
   */
  function resampleToGrid(lum, timestamps, targetIntervalMs) {
    const n = lum.length;
    if (n < 2) return { lum, ts: timestamps, intervalMs: targetIntervalMs };

    const t0   = timestamps[0];
    const tEnd = timestamps[n - 1];
    const out  = [];
    const outTs = [];

    for (let t = t0; t <= tEnd; t += targetIntervalMs) {
      // encontra o par de amostras vizinhas
      let lo = 0;
      for (let i = 1; i < n; i++) {
        if (timestamps[i] <= t) lo = i;
        else break;
      }
      const hi = Math.min(lo + 1, n - 1);
      if (lo === hi) {
        out.push(lum[lo]);
      } else {
        const span = timestamps[hi] - timestamps[lo];
        const frac = span > 0 ? (t - timestamps[lo]) / span : 0;
        out.push(lum[lo] + frac * (lum[hi] - lum[lo]));
      }
      outTs.push(t);
    }
    return { lum: out, ts: outTs, intervalMs: targetIntervalMs };
  }

  /**
   * hasDrift: retorna true se o desvio padrão dos intervalos entre amostras
   * for > DRIFT_THRESHOLD_RATIO * média dos intervalos.
   */
  function hasDrift(timestamps) {
    const n = timestamps.length;
    if (n < 3) return false;
    const diffs = [];
    for (let i = 1; i < n; i++) diffs.push(timestamps[i] - timestamps[i - 1]);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std  = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length);
    return std > mean * DRIFT_THRESHOLD_RATIO;
  }

  /**
   * prepareSeries: aplica resampling se drift detectado.
   * Retorna { lum, ts, intervalMs, resampled }.
   */
  function prepareSeries(seriesLum, seriesTs) {
    if (hasDrift(seriesTs)) {
      const r = resampleToGrid(seriesLum, seriesTs, RESAMPLE_INTERVAL_MS);
      return { lum: r.lum, ts: r.ts, intervalMs: r.intervalMs, resampled: true };
    }
    const n    = seriesTs.length;
    const ivMs = n > 1 ? (seriesTs[n - 1] - seriesTs[0]) / (n - 1) : ML.INTERVAL_MS;
    return { lum: seriesLum, ts: seriesTs, intervalMs: ivMs, resampled: false };
  }

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
   */
  function parabolicPeak(corr, peakIdx) {
    if (peakIdx <= 0 || peakIdx >= corr.length - 1) return 0;
    const y0 = corr[peakIdx - 1].r;
    const y1 = corr[peakIdx    ].r;
    const y2 = corr[peakIdx + 1].r;
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) < 1e-10) return 0;
    return (y0 - y2) / denom;
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

  function effectiveLag(serA, serB) {
    const minSamples = Math.min(serA.lum.length, serB.lum.length);
    const durationMs = minSamples * ML.INTERVAL_MS;
    const lagMs      = Math.floor(durationMs * 0.8);
    const minLag     = ML.MIN_LAG_MS || 20000;
    const maxLag     = (ML.BUFFER_SECONDS || 120) * 1000;
    return Math.max(minLag, Math.min(lagMs, maxLag));
  }

  /**
   * landmarkOffset: estima o offset dominante comparando timestamps dos top-N picos.
   */
  function landmarkOffset(lumA, lumB, maxLagSamples) {
    const diffA = diffSeries(lumA);
    const diffB = diffSeries(lumB);

    function topPeakIndices(diff, n) {
      const candidates = [];
      diff.forEach((d, i) => { if (d > 0) candidates.push({ i, d }); });
      candidates.sort((a, b) => b.d - a.d);
      return candidates.slice(0, n).map(c => c.i);
    }

    const peaksA = topPeakIndices(diffA, LANDMARK_TOP_N);
    const peaksB = topPeakIndices(diffB, LANDMARK_TOP_N);
    if (peaksA.length < 3 || peaksB.length < 3) return null;

    const votes = {};
    peaksA.forEach(ia => {
      peaksB.forEach(ib => {
        const delta = ib - ia;
        if (Math.abs(delta) > maxLagSamples) return;
        votes[delta] = (votes[delta] || 0) + 1;
      });
    });

    const best = Object.entries(votes).reduce((top, [k, v]) => {
      if (v > top.votes || (v === top.votes && Math.abs(+k) < Math.abs(top.delta))) {
        return { delta: +k, votes: v };
      }
      return top;
    }, { delta: 0, votes: 0 });

    return best.votes >= 2 ? best.delta : null;
  }

  /**
   * analyze: prepara séries (com resampling se drift detectado),
   * usa landmark para estimar centro, depois refina com cross-correlação
   * numa janela estreita ao redor desse centro.
   */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    // Fase 1: resampling temporal se drift detectado
    const prepA = prepareSeries(serA.lum, serA.ts);
    const prepB = prepareSeries(serB.lum, serB.ts);
    const ivMs  = (prepA.intervalMs + prepB.intervalMs) / 2;

    const lagMs         = maxLagMs || effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ivMs);

    // 1. Estimativa rápida pelos picos (landmark)
    const landmarkSamples = landmarkOffset(prepA.lum, prepB.lum, maxLagSamples);

    // 2. Janela de refinamento ao redor do landmark (ou varredura completa se falhou)
    let refineSamples;
    if (landmarkSamples !== null) {
      const refineWindow = Math.max(30, Math.ceil(maxLagSamples * LANDMARK_REFINE_RATIO));
      refineSamples = refineWindow;
    } else {
      refineSamples = maxLagSamples;
    }

    // 3. Cross-correlação na janela de refinamento
    function shiftArr(arr, shift) {
      if (!shift) return arr;
      const n = arr.length, out = new Array(n).fill(0);
      if (shift > 0) { for (let i = 0; i < n - shift; i++) out[i] = arr[i + shift]; }
      else           { const s = -shift; for (let i = s; i < n; i++) out[i] = arr[i - s]; }
      return out;
    }

    const lumBshifted = landmarkSamples !== null ? shiftArr(prepB.lum, landmarkSamples) : prepB.lum;
    const corr     = crossCorrelation(prepA.lum, lumBshifted, refineSamples);
    const peak     = selectRobustPeak(corr);
    const peakIdx  = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);

    const refineLag = peak.lag + subFrame;
    const totalLag  = (landmarkSamples !== null ? landmarkSamples : 0) + refineLag;
    const offsetMs  = totalLag * ivMs;

    return {
      offsetMs,
      confidence:       peak.r,
      lagUsedMs:        lagMs,
      intervalMs:       ivMs,
      subFrame,
      landmarkSamples,
      resampledA:       prepA.resampled,
      resampledB:       prepB.resampled,
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
        channel:          ch,
        label:            ch.label,
        offsetMs:         r.error ? null : r.offsetMs,
        confidence:       r.error ? null : r.confidence,
        lagUsedMs:        r.error ? null : r.lagUsedMs,
        intervalMs:       r.error ? null : r.intervalMs,
        subFrame:         r.error ? null : r.subFrame,
        landmarkSamples:  r.error ? null : r.landmarkSamples,
        resampledA:       r.error ? null : r.resampledA,
        resampledB:       r.error ? null : r.resampledB,
        error:            r.error || null,
        corr:             r.corr  || null,
        serA:             r.serA  || null,
        serB:             r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: híbrido landmark+correlação, resampling temporal (fase 1), refinamento ±20% ao redor do pico dominante.');
})();
