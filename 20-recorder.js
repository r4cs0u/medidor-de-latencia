(function () {
  const ML = window.MedLat;

  let rafId    = null;
  let lastTick = 0;

  function tick() {
    if (!ML.state.running) return;
    rafId = requestAnimationFrame(tick);
    const now = performance.now();
    if (now - lastTick < ML.INTERVAL_MS) return;
    lastTick = now;

    if (!ML.state.recording) return;

    const ts     = Date.now();
    const maxLen = Math.ceil(ML.BUFFER_SECONDS * 1000 / ML.INTERVAL_MS);

    ML.CHANNELS.filter(ch => ch.active).forEach(ch => {
      const y = ML.getLum(ch);
      const v = (y !== null && y !== -1) ? Math.round(y) : null;

      if (ch.lumEl) ch.lumEl.textContent = v !== null ? v : (y === -1 ? '\uD83D\uDD12' : '--');

      if (v !== null) {
        ch.buffer.push({ ts, lum: v });
        if (ch.buffer.length > maxLen) ch.buffer.shift();
        ch.prevLum = v;
      }
    });
  }

  // ── Alvo de pontos por preset ──────────────────────────────────────────
  // auto  ou lento  (≤30s) → 120s
  // normal          (≤15s) →  60s
  // rapido          (≤5s)  →  20s

  function getTargetPts(ch) {
    const preset = ch.lagPreset || 'auto';
    if (preset === 'auto' || preset === 'lento')  return Math.ceil(120000 / ML.INTERVAL_MS);
    if (preset === 'normal')                       return Math.ceil(60000  / ML.INTERVAL_MS);
    /* rapido */                                   return Math.ceil(20000  / ML.INTERVAL_MS);
  }

  // Referência (ch[0]) NÃO entra no cálculo — o alvo é o max das telas
  // ativas ch[1..4]. A referência grava esse mesmo valor (globalTarget).
  function getGlobalTarget() {
    const active = ML.CHANNELS.slice(1).filter(ch => ch.active);
    if (!active.length) return Math.ceil(120000 / ML.INTERVAL_MS);
    return Math.max(...active.map(ch => getTargetPts(ch)));
  }

  ML.recorder = {
    start() {
      ML.CHANNELS.forEach(ch => { ch.buffer = []; ch.prevLum = null; });
      ML.state.recording    = true;
      ML.state.running      = true;
      ML.state.recStartTime = Date.now();
      lastTick = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
      console.log('[MedLat] Gravação iniciada.');
    },
    pause() {
      ML.state.recording = false;
      console.log('[MedLat] Gravação pausada.');
    },
    stop() {
      ML.state.recording = false;
      ML.state.running   = false;
      if (rafId) cancelAnimationFrame(rafId);
      console.log('[MedLat] Gravação parada.');
    },
    clear() {
      ML.CHANNELS.forEach(ch => { ch.buffer = []; ch.prevLum = null; });
    },
    getSeries(ch) {
      return {
        label: ch.label,
        color: ch.color,
        ts:    ch.buffer.map(p => p.ts),
        lum:   ch.buffer.map(p => p.lum),
      };
    },
    getTargetPts,
    getGlobalTarget,
  };

  console.log('[MedLat] 20-recorder carregado. globalTarget = max das telas ativas (ref excluída).');
})();
