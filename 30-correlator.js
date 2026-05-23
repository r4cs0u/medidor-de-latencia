(function () {
  const ML = window.MedLat;

  const ADAPT_FACTOR          = 0.15;
  const DIFF_THRESHOLD_MIN    = 1;
  const LANDMARK_TOP_N        = 20;
  const LANDMARK_REFINE_RATIO = 0.20;
  const DRIFT_THRESHOLD_RATIO = 0.20;
  const RESAMPLE_INTERVAL_MS  = 33; // ~30fps

  // ─── Fase 1: resampling temporal ────────────────────────────────────────────

  function resampleToGrid(lum, timestamps, targetIntervalMs) {
    const n = lum.length;
    if (n < 2) return { lum, ts: timestamps, intervalMs: targetIntervalMs };
    const t0 = timestamps[0], tEnd = timestamps[n - 1];
    const out = [], outTs = [];
    for (let t = t0; t <= tEnd; t += targetIntervalMs) {
      let lo = 0;
      for (let i = 1; i < n; i++) { if (timestamps[i] <= t) lo = i; else break; }
      const hi   = Math.min(lo + 1, n - 1);
      const span = timestamps[hi] - timestamps[lo];
      const frac = (lo === hi || span <= 0) ? 0 : (t - timestamps[lo]) / span;
      out.push(lum[lo] + frac * (lum[hi] - lum[lo]));
      outTs.push(t);
    }
    return { lum: out, ts: outTs, intervalMs: targetIntervalMs };
  }

  function hasDrift(timestamps) {
    const n = timestamps.length;
    if (n < 3) return false;
    const diffs = [];
    for (let i = 1; i < n; i++) diffs.push(timestamps[i] - timestamps[i - 1]);
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const std  = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length);
    return std > mean * DRIFT_THRESHOLD_RATIO;
  }

  function prepareSeries(seriesLum, seriesTs) {
    if (hasDrift(seriesTs)) {
      const r = resampleToGrid(seriesLum, seriesTs, RESAMPLE_INTERVAL_MS);
      return { lum: r.lum, ts: r.ts, intervalMs: r.intervalMs, resampled: true };
    }
    const n    = seriesTs.length;
    const ivMs = n > 1 ? (seriesTs[n - 1] - seriesTs[0]) / (n - 1) : ML.INTERVAL_MS;
    return { lum: seriesLum, ts: seriesTs, intervalMs: ivMs, resampled: false };
  }

  // ─── Utilitários de série ────────────────────────────────────────────────────

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

  // ─── Fase 2: DTW com banda Sakoe-Chiba ──────────────────────────────────────

  /**
   * dtw(a, b, bandCenter, bandWidth)
   *
   * Implementa Dynamic Time Warping com banda de Sakoe-Chiba.
   * - bandCenter: offset em samples ao redor do qual a banda é centrada
   *   (vem do landmarkOffset; 0 se landmark falhou).
   * - bandWidth:  metade da largura da banda em samples.
   *
   * Retorna { offsetSamples, normalizedCost, path }
   * onde offsetSamples é a mediana do caminho ótimo (j - i),
   * que representa o deslocamento dominante entre as duas séries.
   */
  function dtw(a, b, bandCenter, bandWidth) {
    const na = a.length, nb = b.length;
    const INF = Infinity;

    // Matriz de custo acumulado — só mantemos duas linhas para economizar memória
    const prev = new Float64Array(nb).fill(INF);
    const curr = new Float64Array(nb).fill(INF);

    // Matriz para reconstrução do caminho (armazena direção: 0=diag, 1=cima, 2=esq)
    // Usamos Int8Array flat para economizar memória
    const dir = new Int8Array(na * nb).fill(-1);

    for (let i = 0; i < na; i++) {
      curr.fill(INF);
      for (let j = 0; j < nb; j++) {
        // Banda de Sakoe-Chiba centrada no landmark
        if (Math.abs((j - i) - bandCenter) > bandWidth) continue;

        const cost = Math.abs(a[i] - b[j]);
        const diag = i > 0 && j > 0 ? prev[j - 1] : INF;
        const up   = i > 0           ? prev[j]     : INF;
        const left = j > 0           ? curr[j - 1] : INF;

        let best, bestDir;
        if (i === 0 && j === 0) { best = 0; bestDir = 0; }
        else if (diag <= up && diag <= left) { best = diag; bestDir = 0; }
        else if (up <= left)                 { best = up;   bestDir = 1; }
        else                                 { best = left; bestDir = 2; }

        curr[j]          = cost + best;
        dir[i * nb + j]  = bestDir;
      }
      prev.set(curr);
    }

    // Reconstrói o caminho ótimo a partir de (na-1, nb-1)
    const path = [];
    let i = na - 1, j = nb - 1;
    // Se o canto final ficou fora da banda, busca a célula de menor custo na última linha
    if (curr[nb - 1] === INF) {
      let minCost = INF, minJ = nb - 1;
      for (let jj = 0; jj < nb; jj++) {
        if (curr[jj] < minCost) { minCost = curr[jj]; minJ = jj; }
      }
      j = minJ;
    }

    while (i > 0 || j > 0) {
      path.push(j - i);
      const d = dir[i * nb + j];
      if      (d === 0 && i > 0 && j > 0) { i--; j--; }
      else if (d === 1 && i > 0)           { i--; }
      else if (j > 0)                      { j--; }
      else break;
    }
    path.push(j - i);

    // Offset dominante = mediana dos (j-i) ao longo do caminho
    path.sort((a, b) => a - b);
    const mid          = Math.floor(path.length / 2);
    const offsetSamples = path.length % 2 ? path[mid] : (path[mid - 1] + path[mid]) / 2;

    // Custo normalizado pelo comprimento do caminho (proxy de confiança inverso)
    const totalCost     = curr[j] === INF ? curr.reduce((mn, v) => Math.min(mn, v), INF) : curr[j];
    const normalizedCost = totalCost / path.length;

    return { offsetSamples, normalizedCost, pathLength: path.length };
  }

  /**
   * dtwConfidence: converte normalizedCost em score 0–1.
   * Usa função sigmóide invertida calibrada para valores típicos de luminância (0–255).
   */
  function dtwConfidence(normalizedCost) {
    return 1 / (1 + normalizedCost / 8);
  }

  // ─── Cross-correlação (mantida para exportação / compatibilidade) ────────────

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

  // ─── Landmark ────────────────────────────────────────────────────────────────

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
      if (v > top.votes || (v === top.votes && Math.abs(+k) < Math.abs(top.delta)))
        return { delta: +k, votes: v };
      return top;
    }, { delta: 0, votes: 0 });

    return best.votes >= 2 ? best.delta : null;
  }

  // ─── effectiveLag ────────────────────────────────────────────────────────────

  function effectiveLag(serA, serB) {
    const minSamples = Math.min(serA.lum.length, serB.lum.length);
    const durationMs = minSamples * ML.INTERVAL_MS;
    const lagMs      = Math.floor(durationMs * 0.8);
    const minLag     = ML.MIN_LAG_MS  || 20000;
    const maxLag     = (ML.BUFFER_SECONDS || 120) * 1000;
    return Math.max(minLag, Math.min(lagMs, maxLag));
  }

  // ─── analyze ─────────────────────────────────────────────────────────────────

  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    // Fase 1: resampling se drift detectado
    const prepA = prepareSeries(serA.lum, serA.ts);
    const prepB = prepareSeries(serB.lum, serB.ts);
    const ivMs  = (prepA.intervalMs + prepB.intervalMs) / 2;

    const lagMs         = maxLagMs || effectiveLag(serA, serB);
    const maxLagSamples = Math.ceil(lagMs / ivMs);

    // 1. Estimativa rápida pelo landmark → centro da banda Sakoe-Chiba
    const landmarkSamples = landmarkOffset(prepA.lum, prepB.lum, maxLagSamples);
    const bandCenter      = landmarkSamples !== null ? landmarkSamples : 0;
    const bandWidth       = Math.max(30, Math.ceil(maxLagSamples * LANDMARK_REFINE_RATIO));

    // 2. Normaliza antes do DTW (melhora sensibilidade em trechos de baixo contraste)
    const normA = normalize(prepA.lum);
    const normB = normalize(prepB.lum);

    // 3. DTW com banda centrada no landmark
    const dtwResult     = dtw(normA, normB, bandCenter, bandWidth);
    const offsetSamples = dtwResult.offsetSamples;
    const confidence    = dtwConfidence(dtwResult.normalizedCost);

    // 4. Refinamento sub-frame via interpolação parabólica numa mini cross-correlação
    //    ao redor do offset DTW (janela de ±3 samples)
    const microWindow = 3;
    const microCorr   = crossCorrelation(normA, normB, microWindow);
    // desloca o lag do microCorr pelo offsetSamples para obter coordenada absoluta
    const shiftedCorr = microCorr.map(c => ({ lag: c.lag + offsetSamples, r: c.r }));
    const peakIdx     = microCorr.reduce((bi, c, i) => c.r > microCorr[bi].r ? i : bi, 0);
    const subFrame    = parabolicPeak(microCorr, peakIdx);

    const totalLag = offsetSamples + subFrame;
    const offsetMs = totalLag * ivMs;

    return {
      offsetMs,
      confidence,
      lagUsedMs:       lagMs,
      intervalMs:      ivMs,
      subFrame,
      landmarkSamples,
      bandCenter,
      bandWidth,
      resampledA:      prepA.resampled,
      resampledB:      prepB.resampled,
      dtwCost:         dtwResult.normalizedCost,
      corr:            shiftedCorr,
      serA, serB,
      labelA: serA.label, labelB: serB.label,
    };
  }

  function analyzeBest(chA, chB) { return analyze(chA, chB, null); }

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
        bandCenter:      r.error ? null : r.bandCenter,
        bandWidth:       r.error ? null : r.bandWidth,
        resampledA:      r.error ? null : r.resampledA,
        resampledB:      r.error ? null : r.resampledB,
        dtwCost:         r.error ? null : r.dtwCost,
        error:           r.error || null,
        corr:            r.corr  || null,
        serA:            r.serA  || null,
        serB:            r.serB  || null,
      });
    });
    return results;
  }

  ML.correlator = { analyze, analyzeBest, analyzeBestAll, crossCorrelation, diffSeries, normalize };
  console.log('[MedLat] 30-correlator: landmark → DTW Sakoe-Chiba → sub-frame parabólico | resampling temporal (fase 1+2).');
})();
