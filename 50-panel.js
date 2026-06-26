(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  (function injectStyles() { ui.injectStyles(); })();

  // calcRTReal removida daqui — centralizada em ML.calcRTReal (00-core.js)

  // ── Painel principal ──────────────────────────────────────────────────────
  function buildPanel() {
    const t = ui.T;

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;right:20px;width:228px',
      'z-index:99999;min-width:160px',
      `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
      'border-radius:6px;box-shadow:0 4px 20px #000c',
      `font-family:monospace;font-size:10px;color:${t.textPrimary}`,
      'user-select:none;display:flex;flex-direction:column',
    ].join(';');

    // ── Header ───────────────────────────────────────────────────────────
    const hdr = document.createElement('div');

    let minimized = false;
    let bodyEl    = null;   // referência preenchida depois

    hdr.style.cssText = [
      'display:flex;align-items:center;gap:4px;padding:5px 7px 4px;cursor:move',
      `border-bottom:1px solid ${t.headerBorder}`,
      `background:${t.headerBg};border-radius:6px 6px 0 0;flex-shrink:0`,
    ].join(';');

    const ttl = document.createElement('span');
    ttl.textContent = '📡 MedLat';
    ttl.style.cssText = `color:${t.accent};font-weight:bold;font-size:10px;letter-spacing:.06em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;

    const btnTips = document.createElement('button');
    btnTips.textContent = '?';
    btnTips.title = 'Dicas';
    btnTips.style.cssText = `background:${t.btnBg};border:1px solid ${t.btnBorder};color:${t.textMuted};border-radius:3px;padding:0 5px;cursor:pointer;font:bold 9px monospace;line-height:16px;flex-shrink:0`;

    const btnGuide = document.createElement('button');
    btnGuide.textContent = '📖';
    btnGuide.title = 'Guia rápido';
    btnGuide.style.cssText = `background:${t.btnBg};border:1px solid ${t.btnBorder};color:${t.textMuted};border-radius:3px;padding:0 4px;cursor:pointer;font:9px monospace;line-height:16px;flex-shrink:0`;

    const btnChart = document.createElement('button');
    btnChart.textContent = '📊';
    btnChart.title = 'Gráficos ao vivo';
    btnChart.style.cssText = `background:${t.btnBg};border:1px solid ${t.btnBorder};color:#00d4ff;border-radius:3px;padding:0 4px;cursor:pointer;font:9px monospace;line-height:16px;flex-shrink:0`;
    btnChart.onclick = () => ML.chart && ML.chart.toggle();

    const btnMin = document.createElement('button');
    btnMin.textContent = '−';
    btnMin.title = 'Minimizar';
    btnMin.style.cssText = `background:${t.btnBg};border:1px solid ${t.btnBorder};color:${t.textMuted};border-radius:3px;padding:0 5px;cursor:pointer;font:bold 10px monospace;line-height:16px;flex-shrink:0`;

    const btnX = document.createElement('button');
    btnX.textContent = '✕';
    btnX.title = 'Fechar';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';
    btnX.onclick = () => {
      ML.stop();
      if (ML.chart) ML.chart.close();
      panel.remove();
    };

    hdr.append(ttl, btnTips, btnGuide, btnChart, btnMin, btnX);
    panel.appendChild(hdr);

    // drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== ttl) return;
      pdrag = true;
      const r = panel.getBoundingClientRect();
      panel.style.right = 'auto';
      panel.style.left  = r.left + 'px';
      pox = e.clientX - r.left;
      poy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // ── Body ─────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    bodyEl = body;
    body.style.cssText = `flex:1;overflow-y:auto;padding:5px 7px 7px;display:flex;flex-direction:column;gap:4px;color:${t.textPrimary}`;
    panel.appendChild(body);

    btnMin.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? 'none' : 'flex';
      btnMin.textContent = minimized ? '+' : '−';
    };

    // ── Seção: canais ─────────────────────────────────────────────────────
    const secCh = mkSection(t, '📺 Canais');
    body.appendChild(secCh.wrap);

    const numRow = document.createElement('div');
    numRow.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap';
    const numLbl = document.createElement('span');
    numLbl.style.cssText = `color:${t.textMuted};font-size:9px`;
    numLbl.textContent = 'Canais:';
    const numSel = document.createElement('select');
    numSel.style.cssText = `background:${t.inputBg};border:1px solid ${t.btnBorder};color:${t.textPrimary};border-radius:3px;font:9px monospace;padding:1px 3px;cursor:pointer`;
    [2,3,4,5,6,7,8,9,10,11,12].forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n + ' canais';
      if (n === ML.state.numChannels) o.selected = true;
      numSel.appendChild(o);
    });
    numSel.onchange = () => {
      ML.state.numChannels = parseInt(numSel.value);
      refreshChannelRows();
    };
    numRow.append(numLbl, numSel);
    secCh.content.appendChild(numRow);

    const chRows = document.createElement('div');
    chRows.style.cssText = 'display:flex;flex-direction:column;gap:3px;margin-top:2px';
    secCh.content.appendChild(chRows);

    function refreshChannelRows() {
      chRows.innerHTML = '';
      const n = ML.state.numChannels || 4;
      ML.CHANNELS.slice(0, n).forEach((ch, idx) => {
        const row = buildChannelRow(ch, idx, t);
        chRows.appendChild(row);
      });
    }
    refreshChannelRows();

    // ── Seção: configuração ───────────────────────────────────────────────
    const secCfg = mkSection(t, '⚙️ Config');
    body.appendChild(secCfg.wrap);
    buildConfigSection(secCfg.content, t);

    // ── Seção: resultados RT ──────────────────────────────────────────────
    const secRT = mkSection(t, '📏 Latência RT');
    body.appendChild(secRT.wrap);
    const rtList = document.createElement('div');
    rtList.style.cssText = 'display:flex;flex-direction:column;gap:2px';
    secRT.content.appendChild(rtList);

    // ── Botões de ação ────────────────────────────────────────────────────
    const actRow = document.createElement('div');
    actRow.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:2px';

    const btnStart = mkBtn(t, '▶ Iniciar', '#44ff88', '#44ff8844', '#44ff8866');
    const btnStop  = mkBtn(t, '■ Parar',  '#ff4444', '#ff444422', '#ff444455');
    btnStop.disabled = true;
    btnStop.style.opacity = '0.4';

    btnStart.onclick = () => {
      if (!ML.recorder) return;
      ML.state.running = true;
      ML.recorder.startRolling();
      btnStart.disabled = true; btnStart.style.opacity = '0.4';
      btnStop.disabled  = false; btnStop.style.opacity  = '1';
      startRT(rtList);
    };

    btnStop.onclick = () => {
      ML.stop();
      ML.recorder.stopRolling();
      btnStart.disabled = false; btnStart.style.opacity = '1';
      btnStop.disabled  = true;  btnStop.style.opacity  = '0.4';
      stopRT();
    };

    actRow.append(btnStart, btnStop);
    body.appendChild(actRow);

    // ── Tips modal ────────────────────────────────────────────────────────
    btnTips.onclick = () => showTips(t);

    // ── Guide modal ───────────────────────────────────────────────────────
    btnGuide.onclick = () => showGuide(t);

    document.body.appendChild(panel);

    ML.panel = {
      refreshOffsets(offsets) {
        Object.entries(offsets).forEach(([id, ms]) => {
          const ch = ML.CHANNELS.find(c => c.id === id);
          if (ch) ch.offsetMs = ms;
        });
      },
    };
  }

  // ── Channel row ───────────────────────────────────────────────────────────
  function buildChannelRow(ch, idx, t) {
    const row = document.createElement('div');
    row.style.cssText = [
      'display:flex;align-items:center;gap:3px',
      `border-radius:4px;padding:2px 4px`,
      `background:${ch.color}0d;box-shadow:inset 0 0 0 1px ${ch.color}22`,
    ].join(';');

    // indicador de cor
    const dot = document.createElement('div');
    dot.style.cssText = `width:7px;height:7px;border-radius:50%;background:${ch.color};flex-shrink:0`;

    // label editável
    const lbl = document.createElement('input');
    lbl.type  = 'text';
    lbl.value = ch.label;
    lbl.style.cssText = [
      `background:transparent;border:none;color:${ch.color}`,
      'font:bold 8px monospace;width:52px;flex-shrink:0;outline:none',
      'cursor:text;padding:0',
    ].join(';');
    lbl.onchange = () => { ch.label = lbl.value.trim() || ch.label; };

    // ativo toggle
    const chk = document.createElement('input');
    chk.type    = 'checkbox';
    chk.checked = ch.active;
    chk.title   = 'Ativar canal';
    chk.style.cssText = 'cursor:pointer;flex-shrink:0;accent-color:' + ch.color;
    chk.onchange = () => {
      ch.active = chk.checked;
      lumEl.style.display = chk.checked ? 'inline' : 'none';
    };

    // lum display
    const lumEl = document.createElement('span');
    lumEl.style.cssText = `color:${t.textMuted};font-size:8px;flex:1;text-align:right;white-space:nowrap;display:${ch.active ? 'inline' : 'none'}`;
    lumEl.textContent = '--';
    ch.lumEl = lumEl;

    // deduction input
    const dedRow = document.createElement('div');
    dedRow.style.cssText = 'display:flex;align-items:center;gap:2px;flex-shrink:0';
    const dedLbl = document.createElement('span');
    dedLbl.textContent = idx === 0 ? 'ref:' : 'ded:';
    dedLbl.style.cssText = `color:${t.textFaint};font-size:7px`;
    const dedIn = document.createElement('input');
    dedIn.type  = 'number';
    dedIn.value = ch.deduction != null ? ch.deduction : 0;
    dedIn.step  = '0.001';
    dedIn.style.cssText = [
      `background:${t.inputBg};border:1px solid ${t.btnBorder};color:${t.textMuted}`,
      'font:7px monospace;width:38px;border-radius:2px;padding:1px 2px;text-align:right',
    ].join(';');
    dedIn.title = idx === 0 ? 'Dedução do canal de referência (s)' : 'Dedução deste canal (s)';
    dedIn.onchange = () => { ch.deduction = parseFloat(dedIn.value) || 0; };
    dedRow.append(dedLbl, dedIn);

    row.append(dot, lbl, chk, lumEl, dedRow);
    return row;
  }

  // ── Config section ────────────────────────────────────────────────────────
  function buildConfigSection(cont, t) {
    function cfgRow(label, inputEl) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:space-between';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.cssText = `color:${t.textMuted};font-size:8px;white-space:nowrap`;
      row.append(lbl, inputEl);
      return row;
    }

    function numInput(val, min, max, step, onChange) {
      const el = document.createElement('input');
      el.type  = 'number';
      el.value = val;
      el.min   = min; el.max = max; el.step = step;
      el.style.cssText = [
        `background:${t.inputBg};border:1px solid ${t.btnBorder};color:${t.textPrimary}`,
        'font:8px monospace;width:60px;border-radius:3px;padding:1px 4px;text-align:right',
      ].join(';');
      el.onchange = () => onChange(parseFloat(el.value));
      return el;
    }

    // Janela RT
    cont.appendChild(cfgRow('Janela RT (ms)',
      numInput(ML.config.rtWindowMs, 5000, 120000, 1000, v => { ML.config.rtWindowMs = v; })));

    // Threshold conf
    cont.appendChild(cfgRow('Limiar confiança',
      numInput(ML.config.rtConfThreshold, 0.1, 1.0, 0.05, v => { ML.config.rtConfThreshold = v; })));

    // Intervalo RT
    cont.appendChild(cfgRow('Intervalo RT (ms)',
      numInput(ML.config.rtIntervalMs, 200, 5000, 100, v => { ML.config.rtIntervalMs = v; })));

    // Smooth alpha
    cont.appendChild(cfgRow('Smooth α',
      numInput(ML.config.rtSmoothAlpha, 0.0, 1.0, 0.05, v => { ML.config.rtSmoothAlpha = v; })));
  }

  // ── RT loop ───────────────────────────────────────────────────────────────
  let rtTimerId = null;

  function startRT(rtList) {
    stopRT();
    buildRTRows(rtList);
    function tick() {
      if (!ML.state.rollingActive) return;
      runRT(rtList);
      rtTimerId = setTimeout(tick, ML.config.rtIntervalMs || 500);
    }
    rtTimerId = setTimeout(tick, ML.config.rtIntervalMs || 500);
  }

  function stopRT() {
    if (rtTimerId) { clearTimeout(rtTimerId); rtTimerId = null; }
  }

  function buildRTRows(rtList) {
    rtList.innerHTML = '';
    const n = ML.state.numChannels || 4;
    ML.CHANNELS.slice(1, n).forEach(ch => {
      if (!ch.active) return;
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex;align-items:center;gap:3px;flex-wrap:wrap',
        `border-radius:4px;padding:2px 5px`,
        `background:${ch.color}0d;box-shadow:inset 0 0 0 1px ${ch.color}22`,
      ].join(';');

      const lbl = document.createElement('span');
      lbl.textContent = ch.label;
      lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;width:48px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0`;

      const val = document.createElement('span');
      val.textContent = 'AGUARD.';
      val.style.cssText = 'color:#555566;font-weight:bold;font-size:9px;flex:1;text-align:right;white-space:nowrap';
      ch._rtVal = val;

      const valReal = document.createElement('span');
      valReal.textContent = '';
      valReal.style.cssText = 'color:#445566;font-size:8px;width:56px;text-align:right;white-space:nowrap;flex-shrink:0';
      ch._rtValReal = valReal;

      // barra de confiança
      const confWrap = document.createElement('div');
      confWrap.style.cssText = 'width:100%;height:2px;background:#1a1a2a;border-radius:1px;overflow:hidden';
      const confBar = document.createElement('div');
      confBar.style.cssText = 'height:100%;width:0%;background:#44ff88;border-radius:1px;transition:width .3s,background .3s';
      ch._rtConfBar = confBar;
      confWrap.appendChild(confBar);

      const histBadge = document.createElement('span');
      histBadge.style.cssText = 'color:#44ff88;font-size:7px;flex-shrink:0';
      ch._rtHistBadge = histBadge;

      const alphaBadge = document.createElement('span');
      alphaBadge.style.cssText = 'color:#aaaacc;font-size:7px;flex-shrink:0';
      ch._rtAlphaBadge = alphaBadge;

      row.append(lbl, val, valReal, histBadge, alphaBadge, confWrap);
      rtList.appendChild(row);
    });
  }

  const DASH = '—';

  function runRT(rtList) {
    if (!ML.correlator) return;
    const n = ML.state.numChannels || 4;
    ML.CHANNELS.slice(1, n).forEach(ch => {
      if (!ch.active) {
        if (ch._rtVal)     { ch._rtVal.textContent = DASH;     ch._rtVal.style.color = '#555566'; }
        if (ch._rtValReal) { ch._rtValReal.textContent = DASH; ch._rtValReal.style.color = '#555566'; }
        if (ch._rtConfBar)    ch._rtConfBar.style.width = '0%';
        if (ch._rtHistBadge)  ch._rtHistBadge.textContent = '';
        if (ch._rtAlphaBadge) ch._rtAlphaBadge.textContent = '';
        return;
      }
      const r = ML.correlator.correlateRolling(ML.CHANNELS[0], ch);
      if (!r) return;

      const conf        = r.confidence !== null ? r.confidence : 0;
      const aboveThresh = conf >= ML.config.rtConfThreshold;
      const offsetMs    = r.offsetMs;
      // propaga offset para ch.offsetMs (lido pelo 40-chart)
      if (offsetMs !== null) ch.offsetMs = offsetMs;
      const histLen     = r.historyLen || 0;

      function fmtMs(ms, uncertain) {
        if (ms === null) return { text: 'AGUARD.', color: '#555566' };
        const s      = ms / 1000;
        const prefix = uncertain ? (s >= 0 ? '~+' : '~') : (s > 0 ? '+' : '');
        return { text: prefix + s.toFixed(3) + 's', color: uncertain ? '#667788' : ui.colorByOffset(Math.abs(s)) };
      }

      if (r.error && !histLen) {
        const txt = r.error.includes('Aguardando') ? 'AGUARD.' : 'ERR';
        if (ch._rtVal)     { ch._rtVal.textContent = txt;  ch._rtVal.style.color = '#555566'; }
        if (ch._rtValReal) { ch._rtValReal.textContent = txt; ch._rtValReal.style.color = '#555566'; }
        if (ch._rtHistBadge) ch._rtHistBadge.textContent = '';
      } else {
        const med = fmtMs(offsetMs, !aboveThresh);
        if (ch._rtVal) {
          ch._rtVal.textContent = med.text;
          ch._rtVal.style.color = med.color;
          ch._rtVal.style.opacity = aboveThresh ? '1' : '0.75';
        }
        // usa ML.calcRTReal centralizado em 00-core
        const realMs = offsetMs !== null ? ML.calcRTReal(ch, offsetMs) : null;
        const real   = fmtMs(realMs, !aboveThresh);
        if (ch._rtValReal) {
          ch._rtValReal.textContent = real.text;
          ch._rtValReal.style.color = real.color;
          ch._rtValReal.style.opacity = aboveThresh ? '1' : '0.75';
        }
      }
      if (ch._rtHistBadge) {
        ch._rtHistBadge.textContent = histLen ? histLen + 'pt' : '';
        ch._rtHistBadge.style.color = histLen >= 10 ? '#44ff88' : '#ffd700';
      }
      if (ch._rtConfBar) {
        const pct = Math.round(conf * 100);
        ch._rtConfBar.style.width      = pct + '%';
        ch._rtConfBar.style.background = conf >= ML.config.rtConfThreshold ? '#44ff88' : conf > 0.4 ? '#ffd700' : '#ff4444';
      }
      if (ch._rtAlphaBadge) {
        const alpha = r.alpha !== null && r.alpha !== undefined ? r.alpha : null;
        ch._rtAlphaBadge.textContent = alpha !== null ? 'α=' + alpha.toFixed(2) : '';
        ch._rtAlphaBadge.style.color = alpha !== null && alpha < 0.7 ? '#ffd700' : '#aaaacc';
      }
    });
  }

  // ── Helpers UI ────────────────────────────────────────────────────────────
  function mkSection(t, title) {
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      `border:1px solid ${t.panelBorder};border-radius:4px`,
      'overflow:hidden',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      `background:${t.headerBg};padding:3px 6px`,
      `color:${t.textMuted};font-size:8px;font-weight:bold;letter-spacing:.05em`,
      'cursor:pointer;user-select:none;display:flex;align-items:center;justify-content:space-between',
    ].join(';');
    hdr.textContent = title;

    const toggle = document.createElement('span');
    toggle.textContent = '▾';
    toggle.style.cssText = `color:${t.textFaint};font-size:9px`;
    hdr.appendChild(toggle);

    const content = document.createElement('div');
    content.style.cssText = `padding:4px 6px 5px;display:flex;flex-direction:column;gap:3px`;

    let open = true;
    hdr.onclick = () => {
      open = !open;
      content.style.display = open ? 'flex' : 'none';
      toggle.textContent = open ? '▾' : '▸';
    };

    wrap.append(hdr, content);
    return { wrap, content };
  }

  function mkBtn(t, label, color, bg, border) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
      `background:${bg};border:1px solid ${border};color:${color}`,
      'border-radius:3px;padding:3px 8px;cursor:pointer;font:bold 8px monospace',
      'flex:1;white-space:nowrap',
    ].join(';');
    return btn;
  }

  // ── Tips ──────────────────────────────────────────────────────────────────
  function showTips(t) {
    const old = document.getElementById('ml-tips-modal');
    if (old) { old.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'ml-tips-modal';
    modal.style.cssText = [
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)',
      'z-index:999999;width:300px;max-height:80vh;overflow-y:auto',
      `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
      'border-radius:8px;box-shadow:0 8px 32px #000e;padding:12px 14px',
      `font-family:monospace;font-size:9px;color:${t.textPrimary}`,
    ].join(';');

    const tips = [
      ['Probes', 'Arraste as sondas para cima das telas. Use a grade (snap) para alinhar.'],
      ['Referência', 'O canal 0 (★) é sempre a referência. Os demais são medidos em relação a ele.'],
      ['Dedução', 'Entre o atraso fixo do seu equipamento (em segundos) para compensar.'],
      ['Confiança', 'Barra verde = alta confiança. Amarela = incerta. Aguarde mais amostras.'],
      ['Histórico (pt)', 'Quantas medições estáveis já acumulou. Mais = mais preciso.'],
      ['α (alpha)', 'Estabilidade: 1.0 = valor convergiu; abaixo de 0.7 = ainda variando.'],
      ['Janela RT', 'Quanto de histórico usar para correlacionar. Aumente para latências longas.'],
      ['📊 Gráficos', 'Clique no botão 📊 do header para ver luminância ao vivo de cada canal.'],
    ];
    tips.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:6px';
      row.innerHTML = `<span style="color:${t.accent};font-weight:bold">${k}:</span> <span style="color:${t.textMuted}">${v}</span>`;
      modal.appendChild(row);
    });

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fechar';
    btnClose.style.cssText = [
      'width:100%;margin-top:8px;background:#c62828;border:none;color:#fff',
      'border-radius:3px;padding:4px;cursor:pointer;font:bold 9px monospace',
    ].join(';');
    btnClose.onclick = () => modal.remove();
    modal.appendChild(btnClose);
    document.body.appendChild(modal);
  }

  // ── Guide ─────────────────────────────────────────────────────────────────
  function showGuide(t) {
    const old = document.getElementById('ml-guide-modal');
    if (old) { old.remove(); return; }
    const modal = document.createElement('div');
    modal.id = 'ml-guide-modal';
    modal.style.cssText = [
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%)',
      'z-index:999999;width:340px;max-height:80vh;overflow-y:auto',
      `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
      'border-radius:8px;box-shadow:0 8px 32px #000e;padding:12px 14px',
      `font-family:monospace;font-size:9px;color:${t.textPrimary}`,
    ].join(';');

    const steps = [
      '1. Abra a página do Actus com os canais desejados.',
      '2. Ative os canais (checkbox) e arraste as sondas para cima de cada tela.',
      '3. Confirme que a sonda do canal 0 (★) está sobre a referência.',
      '4. Ajuste a dedução de cada canal se souber o atraso fixo do equipamento.',
      '5. Clique em ▶ Iniciar para começar a gravar.',
      '6. Aguarde pelo menos 10–20pt de histórico para resultados estáveis.',
      '7. O valor exibido é o offset bruto; o valor real desconta as deduções.',
      '8. Use 📊 para ver os gráficos de luminância ao vivo.',
    ];

    const title = document.createElement('div');
    title.textContent = '📖 Guia rápido';
    title.style.cssText = `color:${t.accent};font-weight:bold;font-size:10px;margin-bottom:8px`;
    modal.appendChild(title);

    steps.forEach(s => {
      const p = document.createElement('p');
      p.textContent = s;
      p.style.cssText = `color:${t.textMuted};margin-bottom:5px;line-height:1.5`;
      modal.appendChild(p);
    });

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fechar';
    btnClose.style.cssText = [
      'width:100%;margin-top:8px;background:#c62828;border:none;color:#fff',
      'border-radius:3px;padding:4px;cursor:pointer;font:bold 9px monospace',
    ].join(';');
    btnClose.onclick = () => modal.remove();
    modal.appendChild(btnClose);
    document.body.appendChild(modal);
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  buildPanel();

  console.log('[MedLat] 50-panel carregado v1.4. Botão 📊 charts adicionado ao header.');
})();
