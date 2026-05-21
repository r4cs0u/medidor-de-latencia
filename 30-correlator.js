(function () {
  const ML = window.MedLat;

  // Buffer e maxLag padrão fixados em 30s
  const DEFAULT_LAG_MS = 30000;

  /**
   * Normaliza array para média 0 e desvio padrão 1 (z-score).
   */
  function normalize(arr) {
    const n    = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std  = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1;
    return arr.map(v => (v - mean) / std);
  }

  /**
   * Recorta as séries para uma janela relevante:
   * usa no máximo (2 × maxLagSamples + buffer de segurança) amostras finais.
   * Isso evita que variações locais sejam diluídas por um buffer muito longo.
   */
  function windowedSlice(arr, maxLagSamples) {
    const windowSize = Math.min(arr.length, maxLagSamples * 3);
    return arr.slice(arr.length - windowSize);
  }

  /**
   * Cross-correlation por força bruta sobre janelas recortadas.
   * Retorna array de { lag, r } para lags de -maxLag a +maxLag amostras.
   */
  function crossCorrelation(a, b, maxLagSamples) {
    // Recorta para janela relevante antes de normalizar
    const wa = windowedSlice(a, maxLagSamples);
    const wb = windowedSlice(b, maxLagSamples);
    const na = normalize(wa);
    const nb = normalize(wb);
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
   * Seleciona o pico mais confiável da correlação.
   *
   * Estratégia (guard band):
   * 1. Encontra o pico global (maior r).
   * 2. Define threshold = 80% do pico global.
   * 3. Entre todos os picos acima do threshold, escolhe o de menor |lag| absoluto.
   *    Isso evita picos espúrios distantes causados por periodicidade do conteúdo.
   */
  function selectRobustPeak(corr) {
    const globalPeak = corr.reduce((best, cur) => cur.r > best.r ? cur : best, corr[0]);
    const threshold  = globalPeak.r * 0.80;

    // Candidatos acima de 80% do pico global
    const candidates = corr.filter(c => c.r >= threshold);

    // Prefere o candidato com menor lag absoluto (mais próximo de 0)
    const robust = candidates.reduce((best, cur) =>
      Math.abs(cur.lag) < Math.abs(best.lag) ? cur : best,
      candidates[0]
    );

    return robust;
  }

  /**
   * Analisa dois canais e retorna o offset em ms.
   * chRef vs chB — se offsetMs > 0, chB está atrasado em relação à referência.
   */
  function analyze(chA, chB, maxLagMs) {
    const serA = ML.recorder.getSeries(chA);
    const serB = ML.recorder.getSeries(chB);

    if (serA.lum.length < 30 || serB.lum.length < 30) {
      return { error: 'Dados insuficientes (mínimo 30 amostras por canal).' };
    }

    const effectiveLagMs  = Math.min(maxLagMs || DEFAULT_LAG_MS, DEFAULT_LAG_MS);
    const maxLagSamples   = Math.ceil(effectiveLagMs / ML.INTERVAL_MS);
    const corr            = crossCorrelation(serA.lum, serB.lum, maxLagSamples);
    const peak            = selectRobustPeak(corr);
    const offsetMs        = peak.lag * ML.INTERVAL_MS;
    const confidence      = peak.r;

    return {
      offsetMs,
      confidence,
      corr,
      labelA: serA.label,
      labelB: serB.label,
      serA,
      serB,
      description: offsetMs > 0
        ? `${serB.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serA.label}`
        : offsetMs < 0
          ? `${serA.label} está ${Math.abs(offsetMs)}ms atrasado em relação a ${serB.label}`
          : 'Canais sincronizados',
    };
  }

  /**
   * Analisa todos os canais ativos contra o canal de referência (índice 0).
   * Retorna array de resultados ordenados por índice de canal.
   */
  function analyzeAll(maxLagMs) {
    const chRef = ML.CHANNELS[0];
    const results = [];

    results.push({
      channel: chRef,
      label: chRef.label,
      offsetMs: 0,
      confidence: 1,
      isReference: true,
    });

    ML.CHANNELS.slice(1).forEach(ch => {
      if (!ch.active) {
        results.push({ channel: ch, label: ch.label, skipped: true });
        return;
      }
      const r = analyze(chRef, ch, maxLagMs);
      results.push({
        channel: ch,
        label: ch.label,
        offsetMs: r.error ? null : r.offsetMs,
        confidence: r.error ? null : r.confidence,
        error: r.error || null,
        corr: r.corr || null,
        serA: r.serA || null,
        serB: r.serB || null,
      });
    });

    return results;
  }

  ML.correlator = { analyze, analyzeAll, crossCorrelation, normalize };

  console.log('[MedLat] 30-correlator carregado.');
})();
