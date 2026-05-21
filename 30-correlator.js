(function () {
  const ML = window.MedLat;

  /**
   * Normaliza array para média 0 e desvio padrão 1.
   */
  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
  }

  /**
   * Cross-correlation por força bruta.
   * Retorna array de coeficientes para lags de -maxLag a +maxLag amostras.
   * Positivo = chA está adiantado em relação a chB.
   */
  function crossCorrelation(a, b, maxLagSamples) {
    const na = normalize(a);
    const nb = normalize(b);
    const n  = Math.min(na.length, nb.length);
    maxLagSamples = Math.min(maxLagSamples, n - 1);
    const result = [];
    for (let lag = -maxLagSamples; lag <= maxLagSamples; lag++) {
      let sum = 0, count = 0;
      for (let i = 0; i < n; i++) {
        const j = i + lag;
        if (j >= 0 && j < n) { sum += na[i] * nb[j]; count++; }
      }
      result.push({ lag, r: count ? sum / count : 0 });
    }
    return result;
  }

  /**
   * Analisa dois canais e retorna o offset em ms.
   * chA vs chB — se offset > 0, chA está atrasado em relação a chB.
   */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30) {
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };
    }

    const maxLagSamples = Math.ceil((maxLagMs || 60000) / ML.INTERVAL_MS);
    const corr          = crossCorrelation(serA.lum, serB.lum, maxLagSamples);

    // Pico de correlação
    const peak    = corr.reduce((best, cur) => cur.r > best.r ? cur : best, corr[0]);
    const offsetMs = peak.lag * ML.INTERVAL_MS;
    const confidence = peak.r; // -1 a 1

    return {
      offsetMs,
      confidence,
      corr,
      labelA: serA.label,
      labelB: serB.label,
      serA,
      serB,
      // Texto descritivo
      description: offsetMs > 0
        ? `${serA.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serB.label}`
        : offsetMs < 0
          ? `${serB.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serA.label}`
          : 'Canais sincronizados',
    };
  }

  ML.correlator = { analyze, crossCorrelation, normalize };

  console.log('[MedLat] 30-correlator carregado.');
})();
