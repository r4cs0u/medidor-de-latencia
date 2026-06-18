(function () {
  const ML = window.MedLat;

  const ADAPT_FACTOR          = 0.15;
  const DIFF_THRESHOLD_MIN    = 1;
  const ANCHOR_TOP_N          = 30;
  const ANCHOR_MIN_ISOLATION  = 60;
  const ANCHOR_STRENGTH_RATIO = 2.5;
  const ANCHOR_CONSENSUS_TOL  = 2;
  const REFINE_WINDOW         = 15;

  // ── buildHybridSeries ──────────────────────────────────────────────────────
  // Retorna luma puro como série base.
  // O chroma NÃO entra aqui — ele atua como validador de âncoras em anchorOffset,
  // via extractAnchors separado (luma) + mergeEvents (31-hybrid-analyzer).
  // Manter chroma fora evita contaminação por ruído de compressão H.264/H.265.

  function buildHybridSeries(buf) {
    if (!buf || !buf.length) return [];
    return buf.map(p => p.lum);
  }

  // ── Primitivas ───────────────────────────────────────────────────────────────

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

  function crossCorrelation(a, b, maxLagSamples, onlyPositive, minLagSamples) {
    const da = diffSeries(a);
    const db = diffSeries(b);
    const wa = windowedSlice(da, maxLagSamples);
    const wb = windowedSlice(db, maxLagSamples);
    const na = normalize(wa);
    const nb = normalize(wb);
    const n  = Math.min(na.length, nb.length);
    maxLagSamples = Math.min(maxLagSamples, n - 1);
    const lagMin = onlyPositive ? Math.ceil(minLagSamples || 0) : -maxLagSamples;
    const result = [];
    for (let lag = lagMin; lag <= maxLagSamples; lag++) {
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

  function realIntervalMsFromBuf(buf) {
    if (!buf || buf.length < 2) return ML.INTERVAL_MS;
    const first = buf[0].ts;
    const last  = buf[buf.length - 1].ts;
    const iv    = (last - first) / (buf.length - 1);
    return (iv >= 10 && iv <= 200) ? iv : ML.INTERVAL_MS;
  }

  // effectiveLag — aceita objeto ch completo ou { label } (retrocompatível)
  // Retorna { minLagMs, maxLagMs, onlyPositive }
  function effectiveLag(chAobj, chBobj) {
    const chB = (chBobj && chBobj.lagPreset !== undefined)
      ? chBobj
      : ML.CHANNELS.find(c => c.label === (chBobj && chBobj.label));
    const key    = (chB && chB.lagPreset) || 'auto';
    const preset = ML.LAG_PRESETS ? ML.LAG_PRESETS[key] : null;
    if (preset) return {
      minLagMs:     preset.min,
      maxLagMs:     preset.max,
      onlyPositive: !!preset.onlyPositive,
    };
    // fallback: auto (-5s…+30s)
    return { minLagMs: -5000, maxLagMs: 30000, onlyPositive: false };
  }

  // ── Âncoras de cena ───────────────────────────────────────────────────────

  function extractAnchors(lum) {
    const diff = diffSeries(lum);
    const peaks = [];
    diff.forEach((d, i) => { if (d > 0) peaks.push({ i, d }); });
    if (peaks.length < 2) return [];
    const sorted = [...peaks].sort((a, b) => a.d - b.d);
    const med = sorted[Math.floor(sorted.length / 2)].d;
    const minAmp = med * ANCHOR_STRENGTH_RATIO;
    const strong = peaks
      .filter(p => p.d >= minAmp)
      .sort((a, b) => b.d - a.d)
      .slice(0, ANCHOR_TOP_N);
    strong.sort((a, b) => a.i - b.i);
    const anchors = [];
    let lastIdx = -Infinity;
    strong.forEach(p => {
      if (p.i - lastIdx >= ANCHOR_MIN_ISOLATION) {
        anchors.push(p);
        lastIdx = p.i;
      }
    });
    return anchors;
  }

  function anchorOffset(lumA, lumB, maxLagSamples, minLagSamples, onlyPositive) {
    const anchorsA = extractAnchors(lumA);
    const anchorsB = extractAnchors(lumB);
    if (anchorsA.length < 2 || anchorsB.length < 2) return null;
    const deltas = [];
    anchorsA.forEach(a => {
      let best = null, bestDist = Infinity;
      anchorsB.forEach(b => {
        const delta = b.i - a.i;
        if (Math.abs(delta) > maxLagSamples) return;
        if (onlyPositive && delta < minLagSamples) return;
        if (!onlyPositive && minLagSamples && Math.abs(delta) < minLagSamples) return;
        const dist = Math.abs(delta);
        if (dist < bestDist) { bestDist = dist; best = { delta, scoreA: a.d, scoreB: b.d }; }
      });
      if (best) deltas.push(best);
    });
    if (deltas.length < 2) return null;
    const groups = [];
    deltas.forEach(entry => {
      const g = groups.find(g => Math.abs(g.delta - entry.delta) <= ANCHOR_CONSENSUS_TOL);
      if (g) {
        g.count++;
        g.totalScore += entry.scoreA + entry.scoreB;
        g.delta = Math.round((g.delta * (g.count - 1) + entry.delta) / g.count);
      } else {
        groups.push({ delta: entry.delta, count: 1, totalScore: entry.scoreA + entry.scoreB });
      }
    });
    const best = groups
      .filter(g => g.count >= 3)
      .sort((a, b) => b.count - a.count || b.totalScore - a.totalScore)[0];
    if (!best) return null;
    return { delta: best.delta, confidence: best.count / deltas.length };
  }

  // ── shiftArr ──────────────────────────────────────────────────────────────

  function shiftArr(arr, shift) {
    if (!shift) return arr;
    const n = arr.length, out = new Array(n).fill(0);
    if (shift > 0) { for (let i = 0; i < n - shift; i++) out[i] = arr[i + shift]; }
    else           { const s = -shift; for (let i = s; i < n; i++) out[i] = arr[i - s]; }
    return out;
  }

  // ── analyze (modo LOG) ────────────────────────────────────────────────────

  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30)
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };

    const ivA  = realIntervalMs(serA);
    const ivB  = realIntervalMs(serB);
    const ivMs = (ivA + ivB) / 2;

    const lagRange      = effectiveLag(chA, chB);
    const usedMaxLagMs  = maxLagMs || lagRange.maxLagMs;
    const usedMinLagMs  = lagRange.minLagMs;
    const onlyPositive  = lagRange.onlyPositive;
    const maxLagSamples = Math.ceil(Math.abs(usedMaxLagMs) / ivMs);
    const minLagSamples = Math.ceil(Math.abs(usedMinLagMs) / ivMs);

    const hybA = buildHybridSeries(chA.buffer);
    const hybB = buildHybridSeries(chB.buffer);

    const anchor        = anchorOffset(hybA, hybB, maxLagSamples, minLagSamples, onlyPositive);
    const anchorSamples = anchor ? anchor.delta : null;

    const hybBshifted  = anchorSamples !== null ? shiftArr(hybB, anchorSamples) : hybB;
    const refineWindow = anchorSamples !== null ? REFINE_WINDOW : maxLagSamples;

    const corr     = crossCorrelation(hybA, hybBshifted, refineWindow, onlyPositive, minLagSamples);
    const peak     = selectRobustPeak(corr);
    const peakIdx  = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);

    const refineLag = peak.lag + subFrame;
    const totalLag  = (anchorSamples !== null ? anchorSamples : 0) + refineLag;
    const offsetMs  = totalLag * ivMs;

    const chBobj = ML.CHANNELS.find(c => c.label === serB.label);

    return {
      offsetMs,
      confidence:       peak.r,
      anchorConfidence: anchor ? anchor.confidence : null,
      lagUsedMs:        usedMaxLagMs,
      lagMinMs:         usedMinLagMs,
      onlyPositive,
      intervalMs:       ivMs,
      subFrame,
      landmarkSamples:  anchorSamples,
      lagPreset:        chBobj ? (chBobj.lagPreset || 'auto') : 'auto',
      corr, serA, serB,
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
        channel:          ch,
        label:            ch.label,
        offsetMs:         r.error ? null : r.offsetMs,
        confidence:       r.error ? null : r.confidence,
        lagUsedMs:        r.error ? null : r.lagUsedMs,
        lagMinMs:         r.error ? null : r.lagMinMs,
        onlyPositive:     r.error ? null : r.onlyPositive,
        intervalMs:       r.error ? null : r.intervalMs,
        subFrame:         r.error ? null : r.subFrame,
        landmarkSamples:  r.error ? null : r.landmarkSamples,
        lagPreset:        r.error ? null : r.lagPreset,
        error:            r.error || null,
        corr:             r.corr  || null,
        serA:             r.serA  || null,
        serB:             r.serB  || null,
      });
    });
    return results;
  }

  // ── Mediana aparada (trimmed median) ─────────────────────────────────────

  function median(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function trimmedMedian(arr) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    if (s.length < 10) return median(s);
    const cut = Math.max(1, Math.floor(s.length * 0.10));
    const trimmed = s.slice(cut, s.length - cut);
    return median(trimmed);
  }

  // ── correlateRolling (modo RT) ────────────────────────────────────────────
  // Histórico RT com:
  //   1. MIN_SAMPLES proporcional ao lag do preset: max(60, ceil(maxLagSamples * 1.5))
  //      → garante buffer suficiente antes de iniciar correlação
  //   2. Filtro de range: rawOffsetMs só entra se estiver dentro de [minLagMs, maxLagMs]
  //   3. Janela deslizante proporcional: max(20, ceil(|maxLag|/rtIntervalMs)*2) amostras
  //      → valores absurdos antigos caem naturalmente, velocidade proporcional ao preset
  //   4. trimmedMedian calculada sobre histórico filtrado pelo range atual
  //      → trocar preset converge imediatamente sem apagar o array

  function correlateRolling(chA, chB) {
    const confThresh   = (ML.config && ML.config.rtConfThreshold !== undefined)
      ? ML.config.rtConfThreshold : 0.50;
    const rtIntervalMs = (ML.config && ML.config.rtIntervalMs) || 500;

    const bufA = chA.buffer || [];
    const bufB = chB.buffer || [];

    // MIN_SAMPLES proporcional ao lag esperado pelo preset
    const ivMsEarly     = (realIntervalMsFromBuf(bufA) + realIntervalMsFromBuf(bufB)) / 2;
    const lagRangeEarly = effectiveLag(chA, chB);
    const lagSamples    = Math.ceil(Math.abs(lagRangeEarly.maxLagMs) / ivMsEarly);
    const MIN_SAMPLES   = Math.max(60, Math.ceil(lagSamples * 1.5));

    if (bufA.length < MIN_SAMPLES || bufB.length < MIN_SAMPLES) {
      return { error: 'Aguardando amostras (' + Math.min(bufA.length, bufB.length) + '/' + MIN_SAMPLES + ')' };
    }

    const hybA = buildHybridSeries(bufA);
    const hybB = buildHybridSeries(bufB);
    const ivMs = ivMsEarly;

    const lagRange      = lagRangeEarly;
    const onlyPositive  = lagRange.onlyPositive;
    const minLagSamples = Math.ceil(Math.abs(lagRange.minLagMs) / ivMs);
    let   maxLagSamples = Math.ceil(Math.abs(lagRange.maxLagMs) / ivMs);
    maxLagSamples = Math.min(maxLagSamples, Math.floor(Math.min(hybA.length, hybB.length) * 0.8));

    const anchor        = anchorOffset(hybA, hybB, maxLagSamples, minLagSamples, onlyPositive);
    const anchorSamples = anchor ? anchor.delta : null;

    const hybBshifted  = anchorSamples !== null ? shiftArr(hybB, anchorSamples) : hybB;
    const refineWindow = anchorSamples !== null ? REFINE_WINDOW : maxLagSamples;

    const corr     = crossCorrelation(hybA, hybBshifted, refineWindow, onlyPositive, minLagSamples);
    const peak     = selectRobustPeak(corr);
    const peakIdx  = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);

    const refineLag   = peak.lag + subFrame;
    const totalLag    = (anchorSamples !== null ? anchorSamples : 0) + refineLag;
    const rawOffsetMs = totalLag * ivMs;
    const confidence  = peak.r;

    // Tamanho máximo do histórico proporcional ao preset
    const historyMax = Math.max(20, Math.ceil(Math.abs(lagRange.maxLagMs) / rtIntervalMs) * 2);

    if (confidence >= confThresh) {
      // Só acumula se estiver dentro do range do preset
      if (rawOffsetMs >= lagRange.minLagMs && rawOffsetMs <= lagRange.maxLagMs) {
        if (!chB._rtHistory) chB._rtHistory = [];
        chB._rtHistory.push(rawOffsetMs);
        // Janela deslizante: remove amostra mais antiga se ultrapassar o máximo
        if (chB._rtHistory.length > historyMax) chB._rtHistory.shift();
      }
    }

    // trimmedMedian sobre valores do histórico que ainda estão no range atual
    // (garante convergência imediata ao trocar preset sem apagar o array)
    const filtered = (chB._rtHistory || []).filter(
      v => v >= lagRange.minLagMs && v <= lagRange.maxLagMs
    );
    const stableOffsetMs = trimmedMedian(filtered.length ? filtered : (chB._rtHistory || []));

    return {
      offsetMs:         stableOffsetMs,
      rawOffsetMs,
      confidence,
      anchorConfidence: anchor ? anchor.confidence : null,
      intervalMs:       ivMs,
      samples:          Math.min(hybA.length, hybB.length),
      historyLen:       (chB._rtHistory || []).length,
      historyFiltered:  filtered.length,
      labelA:           chA.label,
      labelB:           chB.label,
    };
  }

  function correlateRollingAll() {
    const chRef = ML.CHANNELS[0];
    const results = [{ channel: chRef, label: chRef.label, offsetMs: 0, confidence: 1, isReference: true }];
    ML.CHANNELS.slice(1).forEach(ch => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true });
        return;
      }
      const r = correlateRolling(chRef, ch);
      results.push({
        channel:          ch,
        label:            ch.label,
        offsetMs:         r.error ? null : r.offsetMs,
        rawOffsetMs:      r.error ? null : r.rawOffsetMs,
        confidence:       r.error ? null : r.confidence,
        intervalMs:       r.error ? null : r.intervalMs,
        samples:          r.error ? null : r.samples,
        historyLen:       r.error ? null : r.historyLen,
        historyFiltered:  r.error ? null : r.historyFiltered,
        error:            r.error || null,
      });
    });
    return results;
  }

  ML.correlator = {
    analyze, analyzeBest, analyzeBestAll,
    correlateRolling, correlateRollingAll,
    crossCorrelation, diffSeries, normalize,
    realIntervalMsFromBuf,
    median, trimmedMedian,
    buildHybridSeries,
  };

  console.log('[MedLat] 30-correlator carregado. MIN_SAMPLES proporcional ao preset. RT: filtro de range + janela deslizante proporcional + trimmedMedian filtrada.');
})();
