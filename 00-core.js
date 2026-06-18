(function () {
  if (window.MedLat && window.MedLat.stop) window.MedLat.stop();
  ['ml-panel', 'ml-chart-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
  document.querySelectorAll('[id^="ml-probe-"]').forEach(e => e.remove());

  // ── Presets de janela de lag ───────────────────────────────────────────────
  // min/max em ms. onlyPositive=true → correlator não testa lags negativos.
  // Estes presets funcionam como FILTRO do histórico RT: ao trocar o preset,
  // amostras fora do range são ignoradas na mediana sem apagar o histórico.
  //
  //  auto  : -5s … +30s  — fallback geral
  //  neg5  : ◀ 5s  — sinal chegando ANTES da referência (até -5s)
  //  pos5  : ▶ 5s  — atraso pequeno (0 a +5s)
  //  pos10 : ▶ 10s — atraso médio  (+5s a +10s)
  //  pos30 : ▶ 30s — atraso grande (+10s a +30s)
  //
  const LAG_PRESETS = {
    auto:  { min:  -5000, max:  30000, onlyPositive: false },
    neg5:  { min:  -5000, max:      0, onlyPositive: false },
    pos5:  { min:      0, max:   5000, onlyPositive: true  },
    pos10: { min:   5000, max:  10000, onlyPositive: true  },
    pos30: { min:  10000, max:  30000, onlyPositive: true  },
  };

  window.MedLat = {
    CHANNELS: [
      { id:'ch0',  label:'Referência', color:'#00d4ff', active:false, lagPreset:'auto' },
      { id:'ch1',  label:'Tela 2',     color:'#ff4444', active:false, lagPreset:'auto' },
      { id:'ch2',  label:'Tela 3',     color:'#44ff88', active:false, lagPreset:'auto' },
      { id:'ch3',  label:'Tela 4',     color:'#ffd700', active:false, lagPreset:'auto' },
      { id:'ch4',  label:'Tela 5',     color:'#ff66ff', active:false, lagPreset:'auto' },
      { id:'ch5',  label:'Tela 6',     color:'#ff9933', active:false, lagPreset:'auto' },
      { id:'ch6',  label:'Tela 7',     color:'#aa88ff', active:false, lagPreset:'auto' },
      { id:'ch7',  label:'Tela 8',     color:'#ff44aa', active:false, lagPreset:'auto' },
      { id:'ch8',  label:'Tela 9',     color:'#44dddd', active:false, lagPreset:'auto' },
      { id:'ch9',  label:'Tela 10',    color:'#bbff44', active:false, lagPreset:'auto' },
      { id:'ch10', label:'Tela 11',    color:'#ff8800', active:false, lagPreset:'auto' },
      { id:'ch11', label:'Tela 12',    color:'#cc44ff', active:false, lagPreset:'auto' },
    ],

    LAG_PRESETS,

    INTERVAL_MS:    33,
    ASPECT:         9/16,
    BUFFER_SECONDS: 120,
    MIN_LAG_MS:     20000,

    state: {
      running:     false,
      recording:   false,
      probeW:      232,
      snapGrid:    true,
      snapSize:    2,
      noOverlap:   true,
      numChannels: 4,   // 2–12
    },

    config: {
      rtMode:          true,
      rtConfThreshold: 0.60,
      rtIntervalMs:    500,
      rtWindowMs:      30000,
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

  console.log('[MedLat] 00-core carregado. 12 canais (ch0–ch11), presets: auto/◀5s/▶5s/▶10s/▶30s, rtMode=true, numChannels default=4.');
})();
