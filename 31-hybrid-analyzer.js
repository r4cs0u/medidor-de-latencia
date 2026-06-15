(function () {
  const ML = window.MedLat;
  if (!ML) return;

  const EVENT_THRESHOLD_FACTOR = 1.25;
  const EVENT_THRESHOLD_MIN = 4;
  const EVENT_MIN_DISTANCE = 6;
  const EVENT_MAX_COUNT = 120;
  const CANDIDATE_TOLERANCE = 2;
  const REFINE_RADIUS = 12;
  const DEFAULT_MIN_SAMPLES = 3;

  // Peso mínimo da luma quando chroma está ativa (mesmo valor do 30-correlator)
  const CHROMA_ALPHA_MIN = 0.30;
  const CHROMA_ALPHA_MAX = 0.95;
  const CHROMA_VAR_FLOOR = 4;
  const CHROMA_VAR_SCALE = 200;

  function mean(arr) {
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  function stddev(arr, mu) {
    if (!arr.length) return 0;
    return Math.sqrt(arr.reduce((a, b) => a + (b - mu) * (b - mu), 0) / arr.length);
  }

  function diffSeries(arr) {
    const out = [0];
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i];
      const b = arr[i - 1];
      out.push((a == null || b == null) ? 0 : Math.abs(a - b));
    }
    return out;
  }

  function normalize(arr) {
    const mu = mean(arr);
    const sd = stddev(arr, mu) || 1;
    return arr.map(v => (v - mu) / sd);
  }

  function correlationAtLag(a, b, lag) {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < a.length; i++) {
      const j = i + lag;
      if (j < 0 || j >= b.length) continue;
      sum += a[i] * b[j];
      count++;
    }
    return count ? sum / count : 0;
  }

  function buildLocalCorrelation(a, b, centerLag, radius) {
    const na = normalize(a);
    const nb = normalize(b);
    const corr = [];
    for (let lag = centerLag - radius; lag <= centerLag + radius; lag++) {
      corr.push({ lag, r: correlationAtLag(na, nb, lag) });
    }
    return corr;
  }

  function parabolicPeak(corr, peakIdx) {
    if (peakIdx <= 0 || peakIdx >= corr.length - 1) return 0;
    const y0 = corr[peakIdx - 1].r;
    const y1 = corr[peakIdx].r;
    const y2 = corr[peakIdx + 1].r;
    const denom = 2 * (2 * y1 - y0 - y2);
    if (Math.abs(denom) < 1e-10) return 0;
    return (y0 - y2) / denom;
  }

  // ── buildHybridSeries (local, mesmo algoritmo do 30-correlator) ───────────────
  // Usada para obter a série combinada luma+chroma que alimenta detectEvents.

  function buildHybridSeries(buf) {
    if (!buf || !buf.length) return [];
    if (buf[0].cb === undefined) return buf.map(p => p.lum);
    const lums = buf.map(p => p.lum);
    const cbs  = buf.map(p => p.cb);
    const crs  = buf.map(p => p.cr);
    const n    = lums.length;
    const deltas = [];
    for (let i = 1; i < n; i++) deltas.push(Math.abs(lums[i] - lums[i - 1]));
    const mu = deltas.reduce((a, b) => a + b, 0) / (deltas.length || 1);
    const vr = deltas.reduce((a, b) => a + (b - mu) ** 2, 0) / (deltas.length || 1);
    const t  = Math.min(1, Math.max(0, (vr - CHROMA_VAR_FLOOR) / CHROMA_VAR_SCALE));
    const alpha = CHROMA_ALPHA_MAX - t * (CHROMA_ALPHA_MAX - CHROMA_ALPHA_MIN);
    return lums.map((lum, i) => {
      const chroma = (Math.abs(cbs[i]) + Math.abs(crs[i])) / 2;
      return alpha * lum + (1 - alpha) * chroma;
    });
  }

  // ── detectEvents ────────────────────────────────────────────────────────────────
  // Aceita qualquer array numérico (luma, chroma ou híbrido).

  function detectEvents(series) {
    const diff = diffSeries(series);
    const nonZero = diff.filter(v => v > 0);
    if (!nonZero.length) return { diff, events: [], threshold: EVENT_THRESHOLD_MIN };

    const mu = mean(nonZero);
    const sd = stddev(nonZero, mu);
    const threshold = Math.max(EVENT_THRESHOLD_MIN, mu + sd * EVENT_THRESHOLD_FACTOR);

    const candidates = [];
    for (let i = 1; i < diff.length - 1; i++) {
      const v = diff[i];
      if (v < threshold) continue;
      if (v >= diff[i - 1] && v >= diff[i + 1]) candidates.push({ index: i, mag: v });
    }

    candidates.sort((a, b) => b.mag - a.mag);
    const picked = [];
    candidates.forEach(ev => {
      if (picked.length >= EVENT_MAX_COUNT) return;
      const tooClose = picked.some(p => Math.abs(p.index - ev.index) < EVENT_MIN_DISTANCE);
      if (!tooClose) picked.push(ev);
    });
    picked.sort((a, b) => a.index - b.index);

    return { diff, events: picked, threshold };
  }

  // ── mergeEvents ─────────────────────────────────────────────────────────────────
  // Combina eventos de luma e chroma. Se um evento de chroma cair perto de um
  // evento de luma (dentro de EVENT_MIN_DISTANCE), reforça o peso desse evento.
  // Eventos de chroma sem correspondência em luma são adicionados com peso reduzido
  // (50%) — atuam como reforço em momentos de luma instável, mas não dominam.

  const CHROMA_REINFORCEMENT = 0.5;

  function mergeEvents(lumaEvents, chromaEvents) {
    const merged = lumaEvents.map(e => ({ index: e.index, mag: e.mag, source: 'luma' }));
    chromaEvents.forEach(ce => {
      const near = merged.find(e => Math.abs(e.index - ce.index) < EVENT_MIN_DISTANCE);
      if (near) {
        // Reforça evento de luma existente com a magnitude de chroma
        near.mag += ce.mag * CHROMA_REINFORCEMENT;
      } else {
        // Evento exclusivo de chroma (luma estava estável nesse ponto)
        merged.push({ index: ce.index, mag: ce.mag * CHROMA_REINFORCEMENT, source: 'chroma' });
      }
    });
    merged.sort((a, b) => a.index - b.index);
    return merged;
  }

  function intervalMsFromChannels(chA, chB) {
    function channelIv(ch) {
      if (!ch || !ch.buffer || ch.buffer.length < 2) return null;
      const first = ch.buffer[0].ts;
      const last = ch.buffer[ch.buffer.length - 1].ts;
      const n = ch.buffer.length - 1;
      const iv = (last - first) / n;
      return (iv >= 10 && iv <= 200) ? iv : null;
    }
    return channelIv(chA) || channelIv(chB) || ML.INTERVAL_MS || 33;
  }

  function effectiveLagFor(chB) {
    const key = (chB && chB.lagPreset) || 'auto';
    const presetKey = key === 'auto' ? 'lento' : key;
    const preset = ML.LAG_PRESETS ? ML.LAG_PRESETS[presetKey] : null;
    if (preset) return { minLagMs: preset.min, maxLagMs: preset.max };
    return { minLagMs: 15000, maxLagMs: 30000 };
  }

  function buildCandidates(eventsA, eventsB, minLagSamples, maxLagSamples) {
    const raw = [];
    eventsA.forEach(a => {
      eventsB.forEach(b => {
        const lag = b.index - a.index;
        const absLag = Math.abs(lag);
        if (absLag > maxLagSamples) return;
        if (absLag < minLagSamples) return;
        raw.push({ lag, weight: a.mag + b.mag, aIndex: a.index, bIndex: b.index });
      });
    });
    return raw;
  }

  function groupCandidates(candidates) {
    const groups = [];
    candidates.forEach(c => {
      const g = groups.find(g => Math.abs(g.lag - c.lag) <= CANDIDATE_TOLERANCE);
      if (g) {
        g.items.push(c);
        g.weight += c.weight;
        g.lag = Math.round(g.items.reduce((s, item) => s + item.lag, 0) / g.items.length);
      } else {
        groups.push({ lag: c.lag, weight: c.weight, items: [c] });
      }
    });
    groups.sort((a, b) => b.items.length - a.items.length || b.weight - a.weight || Math.abs(a.lag) - Math.abs(b.lag));
    return groups;
  }

  // ── analyze ─────────────────────────────────────────────────────────────────────────────
  // Detecta eventos tanto na série híbrida (principal) quanto em chroma puro,
  // faz merge dos dois conjuntos antes de construir candidatos de lag.
  // A correlação local de refine usa a série híbrida.

  function analyze(chA, chB) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);
    if (serA.lum.length < 30 || serB.lum.length < 30) {
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };
    }

    const ivMs = intervalMsFromChannels(chA, chB);
    const lagRange = effectiveLagFor(chB);
    const minLagSamples = Math.max(DEFAULT_MIN_SAMPLES, Math.ceil(lagRange.minLagMs / ivMs));
    const maxLagSamples = Math.max(minLagSamples + 1, Math.ceil(lagRange.maxLagMs / ivMs));

    // Série híbrida (luma+chroma adaptativo)
    const hybA = buildHybridSeries(chA.buffer);
    const hybB = buildHybridSeries(chB.buffer);

    // Detecção de eventos na série híbrida
    const detA = detectEvents(hybA);
    const detB = detectEvents(hybB);

    // Detecção adicional de eventos em chroma puro (|cb|+|cr|)/2
    const hasCb = chA.buffer.length && chA.buffer[0].cb !== undefined;
    let mergedA = detA.events;
    let mergedB = detB.events;
    if (hasCb) {
      const chromaA = chA.buffer.map(p => (Math.abs(p.cb) + Math.abs(p.cr)) / 2);
      const chromaB = chB.buffer.map(p => (Math.abs(p.cb) + Math.abs(p.cr)) / 2);
      const detChromaA = detectEvents(chromaA);
      const detChromaB = detectEvents(chromaB);
      mergedA = mergeEvents(detA.events, detChromaA.events);
      mergedB = mergeEvents(detB.events, detChromaB.events);
    }

    const candidates = buildCandidates(mergedA, mergedB, minLagSamples, maxLagSamples);
    const groups = groupCandidates(candidates);
    const bestGroup = groups[0] || null;

    if (!bestGroup) {
      return {
        error: 'Sem eventos fortes suficientes para análise híbrida.',
        serA, serB,
        diffA: detA.diff,
        diffB: detB.diff,
        eventsA: mergedA,
        eventsB: mergedB,
        thresholdA: detA.threshold,
        thresholdB: detB.threshold,
      };
    }

    const coarseLag = bestGroup.lag;
    const corr = buildLocalCorrelation(hybA, hybB, coarseLag, REFINE_RADIUS);
    const peak = corr.reduce((best, cur) => (cur.r > best.r ? cur : best), corr[0]);
    const peakIdx = corr.findIndex(c => c.lag === peak.lag);
    const subFrame = parabolicPeak(corr, peakIdx);
    const totalLag = peak.lag + subFrame;
    const offsetMs = totalLag * ivMs;

    return {
      offsetMs,
      confidence: peak.r,
      coarseLagSamples: coarseLag,
      coarseConfidence: bestGroup.items.length / Math.max(1, candidates.length),
      lagUsedMs: lagRange.maxLagMs,
      lagMinMs: lagRange.minLagMs,
      intervalMs: ivMs,
      subFrame,
      corr,
      serA,
      serB,
      diffA: detA.diff,
      diffB: detB.diff,
      eventsA: mergedA,
      eventsB: mergedB,
      candidateGroups: groups.slice(0, 8).map(g => ({ lag: g.lag, count: g.items.length, weight: g.weight })),
      thresholdA: detA.threshold,
      thresholdB: detB.threshold,
      method: 'hybrid',
      labelA: serA.label,
      labelB: serB.label,
    };
  }

  function analyzeBest(chA, chB) {
    return analyze(chA, chB);
  }

  function analyzeBestAll() {
    const chRef = ML.CHANNELS[0];
    const results = [{
      channel: chRef,
      label: chRef.label,
      offsetMs: 0,
      confidence: 1,
      lagUsedMs: 0,
      isReference: true,
      method: 'hybrid',
    }];

    ML.CHANNELS.slice(1).forEach(ch => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true, method: 'hybrid' });
        return;
      }
      const r = analyzeBest(chRef, ch);
      results.push({
        channel: ch,
        label: ch.label,
        offsetMs: r.error ? null : r.offsetMs,
        confidence: r.error ? null : r.confidence,
        lagUsedMs: r.error ? null : r.lagUsedMs,
        lagMinMs: r.error ? null : r.lagMinMs,
        intervalMs: r.error ? null : r.intervalMs,
        subFrame: r.error ? null : r.subFrame,
        coarseLagSamples: r.error ? null : r.coarseLagSamples,
        coarseConfidence: r.error ? null : r.coarseConfidence,
        error: r.error || null,
        corr: r.corr || null,
        serA: r.serA || null,
        serB: r.serB || null,
        diffA: r.diffA || null,
        diffB: r.diffB || null,
        eventsA: r.eventsA || null,
        eventsB: r.eventsB || null,
        candidateGroups: r.candidateGroups || null,
        method: 'hybrid',
      });
    });

    return results;
  }

  ML.hybridAnalyzer = {
    analyze,
    analyzeBest,
    analyzeBestAll,
    detectEvents,
    diffSeries,
    normalize,
    buildHybridSeries,
    mergeEvents,
  };

  console.log('[MedLat] 31-hybrid-analyzer carregado. detectEvents genérico + mergeEvents luma/chroma ativo.');
})();
