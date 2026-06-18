(function () {
  const ML = window.MedLat;

  const ADAPT_FACTOR          = 0.15;
  const DIFF_THRESHOLD_MIN    = 1;
  const ANCHOR_TOP_N          = 30;
  const ANCHOR_MIN_ISOLATION  = 60;
  const ANCHOR_STRENGTH_RATIO = 2.5;
  const ANCHOR_CONSENSUS_TOL  = 2;
  const REFINE_WINDOW         = 15;

  const RT_MIN_LAG_MS = -5000;
  const RT_MAX_LAG_MS = 30000;
  const MIN_SAMPLES   = 60;

  // ── buildHybridSeries ────────────────────────────────────────────

  function buildHybridSeries(buf) {
    if (!buf || !buf.length) return [];
    return buf.map(p => p.lum);
  }

  // ── Primitivas ────────────────────────────────────────────────────────

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
    const cap = Math.min(maxLagSamples, n - 1);
    const result = [];
    for (let lag = -cap; lag <= cap; lag++) {
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

  function realIntervalMsFromBuf(buf) {
    if (!buf || buf.length < 2) return ML.INTERVAL_MS;
    const first = buf[0].ts;
    const last  = buf[buf.length - 1].ts;
    const iv    = (last - first) / (buf.length - 1);
    return (iv >= 10 && iv <= 200) ? iv : ML.INTERVAL_MS;
  }

  // ── Âncoras de cena ───────────────────────────────────────────────

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

  function anchorOffset(lumA, lumB, maxLagSamples) {
    const anchorsA = extractAnchors(lumA);
    const anchorsB = extractAnchors(lumB);
    if (anchorsA.length < 2 || anchorsB.length < 2) return null;
    const deltas = [];
    anchorsA.forEach(a => {
      let best = null, bestDist = Infinity;
      anchorsB.forEach(b => {
        const delta = b.i - a.i;
        if (Math.abs(delta) > maxLagSamples) return;
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
      .filter(g => g.count >= 2)
      .sort((a, b) => b.count - a.count || b.totalScore - a.totalScore)[0];
    if (!best) return null;
    return { delta: best.delta, confidence: best.count / deltas.length };
  }

  // ── shiftArr ──────────────────────────────────────────────────────────

  function shiftArr(arr, shift) {
    if (!shift) return arr;
    const n = arr.length, out = new Array(n).fill(0);
    if (shift > 0) { for (let i = 0; i < n - shift; i++) out[i] = arr[i + shift]; }
    else           { const s = -shift; for (let i = s; i < n; i++) out[i] = arr[i - s]; }
    return out;
  }

  // ── Mediana aparada ──────────────────────────────────────────────────

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
    return median(s.slice(cut, s.length - cut));
  }

  // ── correlateRolling (modo RT) ──────────────────────────────────────
  // Lê ch.rollingBuffer (janela deslizante mantida pelo recorder).

  function correlateRolling(chA, chB) {
    const confThresh   = (ML.config && ML.config.rtConfThreshold !== undefined)
      ? ML.config.rtConfThreshold : 0.50;
    const rtIntervalMs = (ML.config && ML.config.rtIntervalMs) || 500;

    const bufA = chA.rollingBuffer || [];
    const bufB = chB.rollingBuffer || [];

    if (bufA.length < MIN_SAMPLES || bufB.length < MIN_SAMPLES) {
      return { error: 'Aguardando amostras (' + Math.min(bufA.length, bufB.length) + '/' + MIN_SAMPLES + ')' };
    }

    const hybA = buildHybridSeries(bufA);
    const hybB = buildHybridSeries(bufB);
    const ivMs = (realIntervalMsFromBuf(bufA) + realIntervalMsFromBuf(bufB)) / 2;

    const maxLagByRange = Math.ceil(Math.abs(RT_MAX_LAG_MS) / ivMs);
    const maxLagByCap   = Math.floor(Math.min(hybA.length, hybB.length) * 0.8);
    const maxLagSamples = Math.min(maxLagByRange, maxLagByCap);

    const anchor        = anchorOffset(hybA, hybB, maxLagSamples);
    const anchorSamples = anchor ? anchor.delta : null;

    const hybBshifted  = anchorSamples !== null ? shiftArr(hybB, anchorSamples) : hybB;
    const refineWindow = anchorSamples !== null
      ? REFINE_WINDOW
      : Math.min(REFINE_WINDOW * 4, maxLagByCap);

    const corr     = crossCorrelation(hybA, hybBshifted, refineWindow);
    const peak     = selectRobustPeak(corr);
    const peakIdx  = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);

    const refineLag   = peak.lag + subFrame;
    const totalLag    = (anchorSamples !== null ? anchorSamples : 0) + refineLag;
    const rawOffsetMs = totalLag * ivMs;
    const confidence  = peak.r;

    const historyMax = Math.max(20, Math.ceil(Math.abs(RT_MAX_LAG_MS) / rtIntervalMs) * 2);

    if (confidence >= confThresh) {
      if (rawOffsetMs >= RT_MIN_LAG_MS && rawOffsetMs <= RT_MAX_LAG_MS) {
        if (!chB._rtHistory) chB._rtHistory = [];
        chB._rtHistory.push(rawOffsetMs);
        if (chB._rtHistory.length > historyMax) chB._rtHistory.shift();
      }
    }

    const stableOffsetMs = trimmedMedian(
      chB._rtHistory && chB._rtHistory.length ? chB._rtHistory : [rawOffsetMs]
    );

    return {
      offsetMs:         stableOffsetMs,
      rawOffsetMs,
      confidence,
      anchorConfidence: anchor ? anchor.confidence : null,
      intervalMs:       ivMs,
      samples:          Math.min(hybA.length, hybB.length),
      historyLen:       (chB._rtHistory || []).length,
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
        channel:     ch,
        label:       ch.label,
        offsetMs:    r.error ? null : r.offsetMs,
        rawOffsetMs: r.error ? null : r.rawOffsetMs,
        confidence:  r.error ? null : r.confidence,
        intervalMs:  r.error ? null : r.intervalMs,
        samples:     r.error ? null : r.samples,
        historyLen:  r.error ? null : r.historyLen,
        error:       r.error || null,
      });
    });
    return results;
  }

  ML.correlator = {
    correlateRolling,
    correlateRollingAll,
    crossCorrelation,
    diffSeries,
    normalize,
    realIntervalMsFromBuf,
    median,
    trimmedMedian,
    buildHybridSeries,
  };

  console.log('[MedLat] 30-correlator v1.1. RT only. rollingBuffer. MIN_SAMPLES=' + MIN_SAMPLES + '. Range: ' + RT_MIN_LAG_MS + 'ms…' + RT_MAX_LAG_MS + 'ms.');
})();
