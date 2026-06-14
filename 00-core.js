(function () {
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  ['ml-panel', 'ml-chart-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  const LAG_PRESETS = {
    auto:   null,
    lento:  { min: 15000, max: 35000 },   // cobre até 35s
    normal: { min: 5000,  max: 15000 },
    rapido: { min: 0,     max: 5000  },
  };

  window.MedLat = {
    CHANNELS: [
      { id:'ch0', label:'Referência', color:'#00d4ff', active:false, lagPreset:'auto' },
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
      // ── Modo RT ──────────────────────────────────────────────────────
      rtMode:          false,   // alterna entre modo LOG e RT
      rtConfThreshold: 0.50,    // confiança mínima para exibir valor em cor viva (0–1)
      rtIntervalMs:    500,     // intervalo de atualização do modo RT em ms

      // Janela do rollingBuffer — 35s cobre o preset "lento" (até 35s)
      // Aumentar aqui se precisar detectar delays maiores no modo RT puro
      rtWindowMs:      35000,

      // Quando true, correlateRolling usa ch.buffer (acumulado) para as
      // âncoras de cena em vez do rollingBuffer — muito mais preciso para
      // delays grandes (5–35s). Só cai no rolling quando buffer < 60 amostras.
      rtUseLongBuffer: true,

      // Suavização exponencial do valor RT quando confiança < threshold.
      // 0 = congela no último valor válido  |  1 = sem suavização
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

  console.log('[MedLat] 00-core carregado. rtConfThreshold=0.50, rtWindowMs=35000, rtUseLongBuffer=true, lagPreset lento cobre até 35s.');
})();
