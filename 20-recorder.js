(function () {
  const ML = window.MedLat;

  let rollingRafId  = null;
  let rollingLastTs = 0;

  function rollingTick() {
    if (!ML.state.rollingActive) return;
    rollingRafId = requestAnimationFrame(rollingTick);

    const now = performance.now();
    if (now - rollingLastTs < ML.INTERVAL_MS) return;
    rollingLastTs = now;

    const ts       = Date.now();
    const windowMs = (ML.config && ML.config.rtWindowMs) || 30000;
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

        if (ch.lumEl) ch.lumEl.textContent = Math.round(s.lum);
      } else {
        if (ch.lumEl) ch.lumEl.textContent = s === -1 ? '\uD83D\uDD12' : '--';
      }

      while (ch.rollingBuffer.length && ch.rollingBuffer[0].ts < cutoff) {
        ch.rollingBuffer.shift();
      }
    });
  }

  ML.recorder = {
    startRolling() {
      ML.CHANNELS.forEach(ch => { ch.rollingBuffer = []; ch.prevLum = null; });
      ML.state.rollingActive = true;
      rollingLastTs = 0;
      if (rollingRafId) cancelAnimationFrame(rollingRafId);
      rollingRafId = requestAnimationFrame(rollingTick);
      console.log('[MedLat] Rolling iniciado. Janela:', (ML.config && ML.config.rtWindowMs) || 30000, 'ms');
    },
    stopRolling() {
      ML.state.rollingActive = false;
      if (rollingRafId) cancelAnimationFrame(rollingRafId);
      rollingRafId = null;
      ML.CHANNELS.forEach(ch => { ch.rollingBuffer = []; ch.prevLum = null; });
      console.log('[MedLat] Rolling parado e buffers limpos.');
    },
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

  console.log('[MedLat] 20-recorder carregado. Modo rolling apenas. Janela: ' + ((ML.config && ML.config.rtWindowMs) || 30000) + 'ms.');
})();
