(function () {
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  ['ml-panel', 'ml-chart-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  const LAG_PRESETS = {
    auto:   null,
    lento:  { min: 15000, max: 35000 },
    normal: { min: 5000,  max: 15000 },
    rapido: { min: 0,     max: 5000  },
  };

  window.MedLat = {
    CHANNELS: [
      { id:'ch0', label:'Refer\u00eancia', color:'#00d4ff', active:false, lagPreset:'auto' },
      { id:'ch1', label:'Tela 2',      color:'#ff4444',  active:false, lagPreset:'auto' },
      { id:'ch2', label:'Tela 3',      color:'#44ff88',  active:false, lagPreset:'auto' },
      { id:'ch3', label:'Tela 4',      color:'#ffd700',  active:false, lagPreset:'auto' },
      { id:'ch4', label:'Tela 5',      color:'#ff66ff',  active:false, lagPreset:'auto' },
      { id:'ch5', label:'Tela 6',      color:'#ff9933',  active:false, lagPreset:'auto' },
    ],

    LAG_PRESETS,

    INTERVAL_MS:    33,
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,
    MIN_LAG_MS:     20000,

    state: {
      running:   false,
      recording: false,
      probeW:    232,
      snapGrid:  true,
      snapSize:  2,
      noOverlap: true,
    },

    config: {
      rtMode:          false,
      rtConfThreshold: 0.60,    // confia\u00e7a m\u00ednima para exibir valor em cor viva (0\u20131)
      rtIntervalMs:    500,
      rtWindowMs:      35000,
      rtUseLongBuffer: true,
      rtSmoothAlpha:   0.3,
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

  console.log('[MedLat] 00-core carregado. rtConfThreshold=0.60, rtWindowMs=35000, rtUseLongBuffer=true.');
})();
