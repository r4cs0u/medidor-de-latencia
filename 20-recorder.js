(function () {
  const ML = window.MedLat;

  let rollingRafId  = null;
  let rollingLastTs = 0;

  // ── Ring buffer circular ─────────────────────────────────────────────────
  // Evita o custo O(n) do Array.shift() que reindexava todo o array a cada tick.
  // O tamanho é calculado uma vez ao iniciar com base na janela configurada.

  function RingBuffer(capacity) {
    this.buf  = new Array(capacity);
    this.head = 0;   // próximo slot de escrita
    this.size = 0;
    this.cap  = capacity;
  }

  RingBuffer.prototype.push = function (item) {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.cap;
    if (this.size < this.cap) this.size++;
  };

  // Retorna array ordenado do mais antigo ao mais recente.
  RingBuffer.prototype.toArray = function () {
    if (this.size < this.cap) return this.buf.slice(0, this.size);
    const tail = (this.head) % this.cap;   // slot mais antigo
    return this.buf.slice(tail).concat(this.buf.slice(0, tail));
  };

  RingBuffer.prototype.clear = function () {
    this.head = 0;
    this.size = 0;
  };

  // Capacidade: janela em ms / intervalo de amostragem, com folga de 20%.
  // O ring buffer descarta automaticamente amostras antigas quando cheio,
  // por isso não é necessário truncar manualmente por timestamp.
  function makeRingForWindow() {
    const windowMs   = (ML.config && ML.config.rtWindowMs) || 30000;
    const intervalMs = ML.INTERVAL_MS || 33;
    return new RingBuffer(Math.ceil(windowMs / intervalMs * 1.2));
  }

  // ── Loop de captura ──────────────────────────────────────────────────────

  function rollingTick() {
    if (!ML.state.rollingActive) return;
    rollingRafId = requestAnimationFrame(rollingTick);

    const now = performance.now();
    if (now - rollingLastTs < ML.INTERVAL_MS) return;
    rollingLastTs = now;

    const ts = Date.now();

    ML.CHANNELS.filter(ch => ch.active).forEach(ch => {
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
    });
  }

  ML.recorder = {
    startRolling() {
      ML.CHANNELS.forEach(ch => {
        ch.rollingBuffer = makeRingForWindow();
        ch._rtHistory    = [];
        ch.prevLum       = null;
      });
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
      ML.CHANNELS.forEach(ch => {
        ch.rollingBuffer = makeRingForWindow();
        ch._rtHistory    = [];
        ch.prevLum       = null;
      });
      console.log('[MedLat] Rolling parado e buffers limpos.');
    },

    getRollingSeries(ch) {
      const buf = ch.rollingBuffer ? ch.rollingBuffer.toArray() : [];
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

  console.log('[MedLat] 20-recorder v1.3 carregado. Ring buffer circular sem truncagem manual. Janela: ' + ((ML.config && ML.config.rtWindowMs) || 30000) + 'ms.');
})();
