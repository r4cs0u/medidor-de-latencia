(function () {
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  ['ml-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  window.MedLat = {
    CHANNELS: [
      { id:'ch0',  label:'Referência', color:'#00d4ff', active:false },
      { id:'ch1',  label:'Tela 2',     color:'#ff4444', active:false },
      { id:'ch2',  label:'Tela 3',     color:'#44ff88', active:false },
      { id:'ch3',  label:'Tela 4',     color:'#ffd700', active:false },
      { id:'ch4',  label:'Tela 5',     color:'#ff66ff', active:false },
      { id:'ch5',  label:'Tela 6',     color:'#ff9933', active:false },
      { id:'ch6',  label:'Tela 7',     color:'#aa88ff', active:false },
      { id:'ch7',  label:'Tela 8',     color:'#ff44aa', active:false },
      { id:'ch8',  label:'Tela 9',     color:'#44dddd', active:false },
      { id:'ch9',  label:'Tela 10',    color:'#bbff44', active:false },
      { id:'ch10', label:'Tela 11',    color:'#ff8800', active:false },
      { id:'ch11', label:'Tela 12',    color:'#cc44ff', active:false },
    ],

    INTERVAL_MS:    33,
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,
    MIN_LAG_MS:     20000,

    state: {
      running:       false,
      rollingActive: false,
      probeW:        232,
      snapGrid:      true,
      snapSize:      2,
      noOverlap:     true,
      numChannels:   4,
    },

    config: {
      rtConfThreshold: 0.60,
      rtIntervalMs:    500,
      rtWindowMs:      30000,
      rtUseLongBuffer: true,
      rtSmoothAlpha:   0.3,
    },

    // Retorna o offset real em ms, descontando a dedução fixa do multiviewer.
    // Centralizado aqui para evitar duplicação entre 40-chart.js e 50-panel.js.
    calcRTReal(ch, offsetMs) {
      const refDed = (this.CHANNELS[0].deduction || 0) * 1000;
      const chDed  = (ch.deduction || 0) * 1000;
      return offsetMs + chDed - refDed;
    },

    stop() { this.state.running = false; },
  };

  window.MedLat.CHANNELS.forEach(ch => {
    ch.rollingBuffer = [];
    ch._rtHistory    = [];   // histórico de offsets para trimmedMedian (30-correlator)
    ch.prevLum       = null;
    ch.off           = null;
    ch.ctx           = null;
    ch.probe         = null;
    ch.probeW        = null;
  });

  console.log('[MedLat] 00-core carregado v1.2. 12 canais (ch0–ch11). Modo RT único.');
})();
