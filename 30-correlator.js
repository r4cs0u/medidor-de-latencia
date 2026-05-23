(function () {
  const ML = window.MedLat;

  // Threshold adaptativo: usa desvio padrão da série * fator
  const ADAPT_FACTOR = 0.15;
  const DIFF_THRESHOLD_MIN = 1;
  const LANDMARK_TOP_N = 20;
  const LANDMARK_REFINE_RATIO = 0.20; // janela de refinamento: ±20% do lagMs estimado

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

  function realIntervalMs(ser) {
    const ch = ML.CHANNELS.find(c => c.label === ser.label);
    if (ch && ch.buffer && ch.buffer.length > 1) {
      const first = ch.buffer[0].ts;
      const last  = ch.buffer[ch.buffer.length - 1].ts;
      const n     = ch.buffer.length - 1;
      const iv    = (last - first) / n;
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

  /**
   * landmarkOffset: estima o offset dominante comparando timestamps dos top-N picos.
   * Monta um histograma de votos de (peakB[j] - peakA[i]) em samples.
   * Retorna o offset em samples com mais votos, ou null se não houver picos suficientes.
   */
  function landmarkOffset(lumA, lumB, maxLagSamples) {
    const diffA = diffSeries(lumA);
    const diffB = diffSeries(lumB);

    // extrai top-N picos como índices
    function topPeakIndices(diff, n) {
      const candidates = [];
      diff.forEach((d, i) => { if (d > 0) candidates.push({ i, d }); });
      candidates.sort((a, b) => b.d - a.d);
      return candidates.slice(0, n).map(c => c.i);
    }

    const peaksA = topPeakIndices(diffA, LANDMARK_TOP_N);
    const peaksB = topPeakIndices(diffB, LANDMARK_TOP_N);
    if (peaksA.length < 3 || peaksB.length < 3) return null;

    // histograma de offsets (quantizado em samples)
    const votes = {};
    peaksA.forEach(ia => {
      peaksB.forEach(ib => {
        const delta = ib - ia; // offset em samples: B está atrasado se delta > 0
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
   * analyze: usa landmark para estimar centro, depois refina com cross-correlação
   * numa janela estreita ao redor desse centro.
   */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    const ivA  = realIntervalMs(serA);
    const ivB  = realIntervalMs(serB);
    const ivMs = (ivA + ivB) / 2;

    const lagMs         = maxLagMs || effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ivMs);

    // 1. Estimativa rápida pelos picos (landmark)
    const landmarkSamples = landmarkOffset(serA.lum, serB.lum, maxLagSamples);

    // 2. Janela de refinamento ao redor do landmark (ou varredura completa se falhou)
    let refineSamples;
    if (landmarkSamples !== null) {
      const refineWindow = Math.max(30, Math.ceil(maxLagSamples * LANDMARK_REFINE_RATIO));
      refineSamples = refineWindow;
    } else {
      refineSamples = maxLagSamples;
    }

    // 3. Cross-correlação na janela de refinamento
    const lumAu = landmarkSamples !== null ? serA.lum : serA.lum;
    const lumBu = serB.lum;

    // Aplica deslocamento do landmark antes de correlacionar (janela estreita)
    function shiftArr(arr, shift) {
      if (!shift) return arr;
      const n = arr.length, out = new Array(n).fill(0);
      if (shift > 0) { for (let i = 0; i < n - shift; i++) out[i] = arr[i + shift]; }
      else           { const s = -shift; for (let i = s; i < n; i++) out[i] = arr[i - s]; }
      return out;
    }

    const lumBshifted = landmarkSamples !== null ? shiftArr(lumBu, landmarkSamples) : lumBu;
    const corr = crossCorrelation(lumAu, lumBshifted, refineSamples);
    const peak     = selectRobustPeak(corr);
    const peakIdx  = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);

    // offset total = landmark + refinamento fino
    const refineLag = peak.lag + subFrame;
    const totalLag  = (landmarkSamples !== null ? landmarkSamples : 0) + refineLag;
    const offsetMs  = totalLag * ivMs;

    return {
      offsetMs,
      confidence:      peak.r,
      lagUsedMs:       lagMs,
      intervalMs:      ivMs,
      subFrame,
      landmarkSamples,
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
        channel:         ch,
        label:           ch.label,
        offsetMs:        r.error ? null : r.offsetMs,
        confidence:      r.error ? null : r.confidence,
        lagUsedMs:       r.error ? null : r.lagUsedMs,
        intervalMs:      r.error ? null : r.intervalMs,
        subFrame:        r.error ? null : r.subFrame,
        landmarkSamples: r.error ? null : r.landmarkSamples,
        error:           r.error || null,
        corr:            r.corr  || null,
        serA:            r.serA  || null,
        serB:            r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: híbrido landmark+correlação, refinamento ±20% ao redor do pico dominante.');
})();
