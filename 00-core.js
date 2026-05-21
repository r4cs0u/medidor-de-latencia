(function () {
  // Limpa instância anterior se existir
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove());

  window.MedLat = {
    // ── Configuração dos canais ─────────────────────────────
    CHANNELS: [
      { id:'ch0', label:'CLARO CABO',    color:'#00d4ff', active:true  },
      { id:'ch1', label:'SKY',           color:'#ff4444', active:true  },
      { id:'ch2', label:'GLOBO RJ AR',   color:'#44ff88', active:false },
      { id:'ch3', label:'GLOBO GPLAY',   color:'#ffd700', active:false },
      { id:'ch4', label:'SPORTV GPLAY',  color:'#ff88ff', active:false },
      { id:'ch5', label:'GLOBO PGM',     color:'#ff9944', active:false },
      { id:'ch6', label:'SPORTV PGM',    color:'#aaffff', active:false },
      { id:'ch7', label:'GETV PGM',      color:'#cc88ff', active:false },
    ],

    // ── Constantes ─────────────────────────────────────────
    INTERVAL_MS:    33,     // ~30fps (1 frame)
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,    // máximo de segundos gravados por canal

    // ── Estado global ───────────────────────────────────────
    state: {
      running:   false,
      recording: false,
      probeW:    64,
    },

    stop() {
      this.state.running = false;
    },
  };

  // Inicializa buffers e canvas por canal
  window.MedLat.CHANNELS.forEach(ch => {
    ch.buffer  = [];   // [{ts, lum}]
    ch.prevLum = null;
    ch.off     = null;
    ch.ctx     = null;
    ch.probe   = null;
  });

  console.log('[MedLat] 00-core carregado.');
})();
