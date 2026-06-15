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
      const s = ML.getSample(ch);
      // s === null  → sem elemento sob a probe
      // s === -1    → bloqueio CORS
      const valid = s !== null && s !== -1;
      const v = valid ? Math.round(s.lum) : null;

      if (ch.lumEl) ch.lumEl.textContent = v !== null ? v : (s === -1 ? '\uD83D\uDD12' : '--');

      if (valid) {
        ch.buffer.push({
          ts,
          lum: Math.round(s.lum),
          r:   Math.round(s.r),
          g:   Math.round(s.g),
          b:   Math.round(s.b),
          cb:  Math.round(s.cb),
          cr:  Math.round(s.cr),
        });
        if (ch.buffer.length > maxLen) ch.buffer.shift();
        ch.prevLum = v;
      }
    });
  }

  // ── Alvo de pontos por preset ───────────────────────────────────────────────────────
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

  // ── Modo Rolling (Tempo Real) ──────────────────────────────────────────────────────
  // Buffer separado por canal: ch.rollingBuffer
  // Janela deslizante de ML.config.rtWindowMs ms.
  // RAF independente do modo gravação.

  let rollingRafId  = null;
  let rollingLastTs = 0;

  function rollingTick() {
    if (!ML.state.rollingActive) return;
    rollingRafId = requestAnimationFrame(rollingTick);

    const now = performance.now();
    if (now - rollingLastTs < ML.INTERVAL_MS) return;
    rollingLastTs = now;

    const ts       = Date.now();
    const windowMs = (ML.config && ML.config.rtWindowMs) || 5000;
    const cutoff   = ts - windowMs;

    ML.CHANNELS.filter(ch => ch.active).forEach(ch => {
      if (!ch.rollingBuffer) ch.rollingBuffer = [];

      const s     = ML.getSample(ch);
      const valid = s !== null && s !== -1;

      if (valid) {
        ch.rollingBuffer.push({
          ts,
          lum: Math.round(s.lum),
          r:   Math.round(s.r),
          g:   Math.round(s.g),
          b:   Math.round(s.b),
          cb:  Math.round(s.cb),
          cr:  Math.round(s.cr),
        });
      }

      // descarta amostras fora da janela
      while (ch.rollingBuffer.length && ch.rollingBuffer[0].ts < cutoff) {
        ch.rollingBuffer.shift();
      }
    });
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
    // Retorna série completa (lum + canais de cor) de um canal gravado
    getSeries(ch) {
      return {
        label: ch.label,
        color: ch.color,
        ts:  ch.buffer.map(p => p.ts),
        lum: ch.buffer.map(p => p.lum),
        r:   ch.buffer.map(p => p.r),
        g:   ch.buffer.map(p => p.g),
        b:   ch.buffer.map(p => p.b),
        cb:  ch.buffer.map(p => p.cb),
        cr:  ch.buffer.map(p => p.cr),
      };
    },
    getTargetPts,
    getGlobalTarget,

    // ── Rolling ──────────────────────────────────────────────────────────────────
    startRolling() {
      ML.CHANNELS.forEach(ch => { ch.rollingBuffer = []; });
      ML.state.rollingActive = true;
      rollingLastTs = 0;
      if (rollingRafId) cancelAnimationFrame(rollingRafId);
      rollingRafId = requestAnimationFrame(rollingTick);
      console.log('[MedLat] Rolling iniciado. Janela:', (ML.config && ML.config.rtWindowMs) || 5000, 'ms');
    },
    stopRolling() {
      ML.state.rollingActive = false;
      if (rollingRafId) cancelAnimationFrame(rollingRafId);
      rollingRafId = null;
      console.log('[MedLat] Rolling parado.');
    },
    // Retorna série da janela atual (mesmo formato de getSeries)
    getRollingSeries(ch) {
      const buf = ch.rollingBuffer || [];
      return {
        label: ch.label,
        color: ch.color,
        ts:  buf.map(p => p.ts),
        lum: buf.map(p => p.lum),
        r:   buf.map(p => p.r),
        g:   buf.map(p => p.g),
        b:   buf.map(p => p.b),
        cb:  buf.map(p => p.cb),
        cr:  buf.map(p => p.cr),
      };
    },
  };

  console.log('[MedLat] 20-recorder carregado. Buffer agora inclui r,g,b,cb,cr por amostra. globalTarget = max das telas ativas (ref excluída). Rolling disponível via startRolling/stopRolling/getRollingSeries.');
})();
