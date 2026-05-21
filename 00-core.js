(function () {
  // Para loop anterior se existir
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  // Remove apenas painel e overlay — probes serão recriados pelo 10-probes.js
  ['ml-panel', 'ml-chart-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  // Remove probes antigos especificamente
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  window.MedLat = {
    CHANNELS: [
      { id:'ch0', label:'Tela 1', color:'#00d4ff', active:false },
      { id:'ch1', label:'Tela 2', color:'#ff4444', active:false },
      { id:'ch2', label:'Tela 3', color:'#44ff88', active:false },
      { id:'ch3', label:'Tela 4', color:'#ffd700', active:false },
    ],

    INTERVAL_MS:    33,
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,

    state: {
      running:   false,
      recording: false,
      probeW:    64,
    },

    stop() { this.state.running = false; },
  };

  window.MedLat.CHANNELS.forEach(ch => {
    ch.buffer  = [];
    ch.prevLum = null;
    ch.off     = null;
    ch.ctx     = null;
    ch.probe   = null;
  });

  console.log('[MedLat] 00-core carregado.');
})();
