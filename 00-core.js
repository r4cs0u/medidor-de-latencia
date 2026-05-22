(function () {
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  ['ml-panel', 'ml-chart-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  window.MedLat = {
    CHANNELS: [
      { id:'ch0', label:'Refer\u00eancia', color:'#00d4ff', active:false },
      { id:'ch1', label:'Tela 2',      color:'#ff4444',  active:false },
      { id:'ch2', label:'Tela 3',      color:'#44ff88',  active:false },
      { id:'ch3', label:'Tela 4',      color:'#ffd700',  active:false },
    ],

    INTERVAL_MS:    33,
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,
    MIN_LAG_MS:     20000,   // lag nunca abaixo de 20s

    state: {
      running:   false,
      recording: false,
      probeW:    232,
      snapGrid:  true,
      snapSize:  2,
      noOverlap: true,       // colis\u00e3o ativa por padr\u00e3o
    },

    stop() { this.state.running = false; },
  };

  window.MedLat.CHANNELS.forEach(ch => {
    ch.buffer  = [];
    ch.prevLum = null;
    ch.off     = null;
    ch.ctx     = null;
    ch.probe   = null;
    ch.probeW  = null;
  });

  console.log('[MedLat] 00-core carregado. noOverlap=true, MIN_LAG_MS=20000');
})();
