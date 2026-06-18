(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  (function injectStyles() { ui.injectStyles(); })();

  // calcRTReal removida daqui — centralizada em ML.calcRTReal (00-core.js)

  function mkDeductionInput(ch) {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = '0.000s';
    inp.value = ch.deduction ? ui.formatDeduction(ch.deduction) : '';
    inp.title = 'Offset fixo do multiviewer. Ex: 3 \u2192 -3.000s  +1.5 \u2192 +1.500s';
    function applyDedStyle() {
      const t = ui.T;
      const hasVal = inp.value && inp.value !== '' && inp.value !== '0.000s';
      inp.style.cssText = [
        `background:${t.inputBg};border:1px solid ${t.inputBorder}88;color:${hasVal ? '#ff9d00' : t.textPrimary}`,
        'font:bold 8px monospace;width:100%;box-sizing:border-box;border-radius:3px',
        'padding:1px 3px;text-align:center;outline:none;height:18px',
      ].join(';');
    }
    applyDedStyle();
    inp.addEventListener('focus', () => inp.style.borderColor = ui.T.inputBorder + 'cc');
    inp.addEventListener('blur', () => {
      inp.style.borderColor = ui.T.inputBorder + '88';
      const raw = inp.value.trim();
      if (raw === '' || raw === '0' || raw === '0.000s') {
        ch.deduction = 0; inp.value = ''; inp.style.color = ui.T.textPrimary;
      } else {
        const v = ui.parseDeductionS(raw);
        if (v !== null) {
          ch.deduction = v;
          inp.value = ui.formatDeduction(v);
          inp.style.color = v !== 0 ? '#ff9d00' : ui.T.textPrimary;
        }
      }
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    ch._dedInp = inp;
    return inp;
  }

  // ── init ────────────────────────────────────────────────────────

  function init() {
    ['ml-panel', 'ml-tips', 'ml-guide', 'ml-widget'].forEach(id => {
      const el = document.getElementById(id); if (el) el.remove();
    });

    // lumIntervalId é guardado aqui e cancelado no btnX.onclick.
    // Sem isso, cada F5 acumula uma nova instância do setInterval rodando
    // em paralelo e gravando no DOM mesmo depois do painel ser fechado.
    let lumIntervalId = null;

    const panel = document.createElement('div');
    panel.id = 'ml-panel';

    function applyPanelStyle() {
      const t = ui.T;
      const hasW = panel.style.width  && panel.style.width  !== '340px';
      const hasH = panel.style.height && panel.style.height !== '';
      panel.style.cssText = [
        'position:fixed;top:4px;left:4px;z-index:99999',
        `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
        'border-radius:6px;box-shadow:0 4px 24px #000c',
        `font-family:monospace;font-size:11px;color:${t.textPrimary}`,
        `user-select:none;width:${hasW ? panel.style.width : '340px'}`,
        `max-height:${hasH ? panel.style.height : 'calc(100vh - 8px)'}`,
        ...(hasH ? [`height:${panel.style.height}`] : []),
        'display:flex;flex-direction:column;overflow:hidden',
      ].join(';');
    }
    applyPanelStyle();

    const hdr = document.createElement('div');
    function applyHdrStyle() {
      const t = ui.T;
      hdr.style.cssText = [
        'display:flex;align-items:center;gap:4px;overflow:hidden',
        'padding:4px 8px;cursor:move',
        `border-bottom:1px solid ${t.headerBorder}`,
        `background:${t.headerBg};border-radius:6px 6px 0 0;flex-shrink:0`,
      ].join(';');
    }
    applyHdrStyle();

    const ttl = document.createElement('span');
    ttl.textContent = '\u26a1 MEDIDOR DE LAT\u00CANCIA';
    ttl.style.cssText = `color:${ui.T.textPrimary};font-weight:bold;font-size:10px;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0`;

    const btnTips  = ui.mkIconBtn('\ud83d\udca1', 'Dicas para uma medi\u00e7\u00e3o precisa', '#ffd700');
    const btnGuide = ui.mkIconBtn('\ud83d\udccb', 'Passo a passo de uso do medidor', '#00d4ff');
    btnTips.onclick  = () => ML.help && ML.help.toggleTips(panel);
    btnGuide.onclick = () => ML.help && ML.help.toggleGuide(panel);

    const btnMin = ui.mkIconBtn('\u2212', 'Minimizar para widget', '#aaaaaa');
    const btnX   = document.createElement('button');
    btnX.textContent = '\u2715'; btnX.title = 'Fechar o medidor';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnX.onclick = () => {
      ML.recorder.stopRolling();
      if (rtIntervalId)  clearInterval(rtIntervalId);
      if (lumIntervalId) clearInterval(lumIntervalId); // cancela o loop de lum
      document.querySelectorAll('[id^="ml-"], .ml-search-overlay').forEach(e => e.remove());
    };
    btnMin.onclick = () => ui.minimizePanel(panel);

    hdr.append(ttl, btnTips, btnGuide, btnMin, btnX);
    panel.appendChild(hdr);

    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target !== hdr && e.target !== ttl) return;
      pdrag = true;
      const rect = panel.getBoundingClientRect();
      panel.style.left   = rect.left + 'px';
      panel.style.top    = rect.top  + 'px';
      panel.style.right  = 'auto';
      panel.style.bottom = 'auto';
      pox = e.clientX - rect.left;
      poy = e.clientY - rect.top;
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      const pos = ui.clampPos(e.clientX - pox, e.clientY - poy, panel.offsetWidth, panel.offsetHeight);
      panel.style.left = pos.left + 'px';
      panel.style.top  = pos.top  + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    const scrollBody = document.createElement('div');
    scrollBody.style.cssText = 'flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column';

    // ── Posicionamento ──
    const secTG = ui.sec('Posicionamento');
    const pxInp = ui.mkNum(ML.state.probeW, 16, 500, 2, 44);
    pxInp.title = 'Tamanho das probes em pixels';
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c; pxInp.value = c;
      ML.CHANNELS.forEach(ch => {
        ch.probeW = c;
        if (ch._szInp) ch._szInp.value = c;
        if (ch.active && ch.resize) ch.resize();
      });
    }
    const btnPxM = ui.mkBtn('\u2212', '#1e2a3a', 'padding:1px 4px;font-size:8px;line-height:1.2');
    const btnPxP = ui.mkBtn('+',     '#1e2a3a', 'padding:1px 4px;font-size:8px;line-height:1.2');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); } });

    const btnSnap = ui.mkBtn('', '#0d4f3c', 'flex:1;min-width:0;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box');
    btnSnap.title = 'Ativa grade magnética para alinhar probes';
    function updateSnapBtn() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : ui.T.btnBg;
      btnSnap.style.color      = ML.state.snapGrid ? '#44ff88' : ui.T.btnColor;
    }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); };
    updateSnapBtn();

    const btnCol = ui.mkBtn('', '#2a1a0d', 'flex:1;min-width:0;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box');
    btnCol.title = 'Evita sobreposi\u00e7\u00e3o entre probes';
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : ui.T.btnBg;
      btnCol.style.color      = ML.state.noOverlap ? '#ff8844' : ui.T.btnColor;
    }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    const selNumCh = document.createElement('select');
    selNumCh.title = 'N\u00famero total de telas ativas (inclui refer\u00eancia)';
    for (let n = 2; n <= 12; n++) {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n + ' telas';
      if (ML.state.numChannels === n) opt.selected = true;
      selNumCh.appendChild(opt);
    }
    selNumCh.style.cssText = [
      `background:${ui.T.selectBg};border:1px solid ${ui.T.selectBorder};color:${ui.T.selectColor}`,
      'font:bold 8px monospace;border-radius:3px;padding:1px 2px',
      'cursor:pointer;outline:none;height:18px;box-sizing:border-box;flex-shrink:0',
    ].join(';');

    const rowPos = ui.row(4);
    rowPos.append(ui.sp('PX', 'flex-shrink:0;font-size:9px'), btnPxM, pxInp, btnPxP, btnSnap, btnCol, selNumCh);
    secTG.appendChild(rowPos);
    scrollBody.appendChild(secTG);

    // ── Cards de canal ──
    const secDet = ui.sec('Telas');
    const probeGrid = document.createElement('div');
    probeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';

    function buildChannelCards() {
      probeGrid.innerHTML = '';
      const n = parseInt(selNumCh.value) || ML.state.numChannels;
      ML.state.numChannels = n;
      ML.CHANNELS.slice(0, n).forEach((ch, i) => {
        ch.deduction = ch.deduction || 0;
        const isRef = i === 0;

        const card = document.createElement('div');
        card.style.cssText = [
          'display:flex;flex-direction:column;gap:2px',
          'padding:3px 4px;border-radius:4px',
          `border:1px solid ${ch.color}55`,
          `background:${ch.color}0d`,
          `border-top:2px solid ${ch.color}99`,
          `transition:opacity .2s;opacity:${ch.active ? 1 : .4}`,
          'box-sizing:border-box;min-width:0;overflow:hidden;width:100%',
        ].join(';');
        ch._panelRow = card;

        // linha 1: toggle · label · lum
        const r1 = ui.row(3);
        r1.style.cssText += ';overflow:hidden;min-width:0';
        const tog = ui.mkToggle(ch.active, v => {
          ch.active = v;
          if (ch.probe) { ch.probe.style.display = v ? 'block' : 'none'; }
          card.style.opacity = v ? '1' : '.4';
        });
        const lbl = document.createElement('div');
        lbl.textContent = ch.label;
        lbl.style.cssText = `color:${ch.color};font-weight:bold;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0`;
        const lumDisp = document.createElement('div');
        lumDisp.style.cssText = `font:bold 8px monospace;color:${ch.color};opacity:.8;white-space:nowrap;flex-shrink:0`;
        lumDisp.textContent = '--';
        ch.lumEl = lumDisp;
        r1.append(tog, lbl, lumDisp);

        // linha 2: posição XY + tamanho individual
        const r2 = ui.row(3);
        const posDisp = document.createElement('div');
        posDisp.style.cssText = 'font:7px monospace;color:#667788;white-space:nowrap;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis';
        posDisp.textContent = '---';
        ch._posDisp = posDisp;
        const szInp = ui.mkNum(ch.probeW || ML.state.probeW, 16, 500, 2, 38);
        szInp.title = 'Tamanho desta probe individualmente';
        szInp.addEventListener('change', () => {
          ch.probeW = Math.max(16, Math.min(500, Math.round((parseInt(szInp.value) || ML.state.probeW) / 2) * 2));
          szInp.value = ch.probeW;
          if (ch.active && ch.resize) ch.resize();
        });
        ch._szInp = szInp;
        r2.append(posDisp, szInp);

        // linha 3: dedução
        const r3ded = ui.row(2);
        r3ded.append(ui.sp('DED', 'flex-shrink:0;font-size:7px;opacity:.7'), mkDeductionInput(ch));

        if (!isRef) {
          // divisor + bloco RT
          const rtDivider = document.createElement('div');
          rtDivider.style.cssText = `height:1px;background:${ch.color}22;margin:2px 0`;

          const rtRow = document.createElement('div');
          rtRow.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;width:100%;gap:3px';
          ch._rtRow = rtRow;

          const mkValLine = (labelTxt) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:stretch;width:100%;min-width:0';
            const lbl = document.createElement('div');
            lbl.textContent = labelTxt;
            lbl.style.cssText = 'font:bold 6px monospace;color:#aaaacc;letter-spacing:.10em;opacity:.75;line-height:1.2;text-align:left';
            const val = document.createElement('div');
            val.textContent = '--';
            val.style.cssText = [
              'font:bold 14px monospace;letter-spacing:-.03em;text-align:left',
              'line-height:1.05;transition:color .3s,opacity .3s',
              'color:#aaaacc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%',
            ].join(';');
            wrap.append(lbl, val);
            return { wrap, val };
          };

          const lineMed  = mkValLine('MEDIDO');
          const lineSep  = document.createElement('div');
          lineSep.style.cssText = `height:1px;background:${ch.color}18;width:100%;margin:1px 0`;
          const lineReal = mkValLine('REAL');
          ch._rtVal     = lineMed.val;
          ch._rtValReal = lineReal.val;
          rtRow.append(lineMed.wrap, lineSep, lineReal.wrap);

          const rtFooter = document.createElement('div');
          rtFooter.style.cssText = 'display:flex;flex-direction:column;gap:1px;width:100%';
          ch._rtFooter = rtFooter;

          const confWrap = document.createElement('div');
          confWrap.style.cssText = 'width:100%;height:3px;background:#ffffff18;border-radius:2px;overflow:hidden';
          const confBar = document.createElement('div');
          confBar.style.cssText = 'height:100%;width:0%;border-radius:2px;transition:width .4s,background .4s';
          confWrap.appendChild(confBar);
          ch._rtConfBar = confBar;

          const rtMeta = document.createElement('div');
          rtMeta.style.cssText = 'display:flex;justify-content:space-between;width:100%';
          const histBadge = document.createElement('div');
          histBadge.style.cssText = 'font:bold 6px monospace;opacity:.5;letter-spacing:.04em;line-height:1.4';
          histBadge.textContent = ''; ch._rtHistBadge = histBadge;
          const alphaBadge = document.createElement('div');
          alphaBadge.style.cssText = 'font:bold 6px monospace;opacity:.6;letter-spacing:.06em;line-height:1.4;color:#aaaacc;text-align:right';
          alphaBadge.textContent = ''; ch._rtAlphaBadge = alphaBadge;
          rtMeta.append(histBadge, alphaBadge);
          rtFooter.append(confWrap, rtMeta);

          card.append(r1, r2, r3ded, rtDivider, rtRow, rtFooter);
        } else {
          ch._rtVal = null; ch._rtValReal = null; ch._rtConfBar = null;
          ch._rtHistBadge = null; ch._rtAlphaBadge = null; ch._rtFooter = null;
          card.append(r1, r2, r3ded);
        }

        // _rtHistory é inicializado em 00-core e resetado pelo recorder — não tocar aqui
        probeGrid.appendChild(card);
      });
    }

    selNumCh.addEventListener('change', buildChannelCards);
    buildChannelCards();
    secDet.appendChild(probeGrid);
    scrollBody.appendChild(secDet);

    // ── Controles RT ──
    const secRT = ui.sec('\u26a1 Tempo Real');
    const btnRTStart = ui.mkBtn('\u25b6 INICIAR',  '#0d3a1a', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:20px;box-sizing:border-box;letter-spacing:.04em;font-weight:bold');
    const btnRTStop  = ui.mkBtn('\u25a0 DESLIGAR', '#3a0d0d', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:20px;box-sizing:border-box;letter-spacing:.04em;font-weight:bold;opacity:.45');
    btnRTStart.style.color = '#44ff88';
    btnRTStop.style.color  = '#ff4444';
    btnRTStart.title = 'Inicia a coleta de amostras em tempo real';
    btnRTStop.title  = 'Para a coleta e limpa os dados';

    let rtRunning = false;

    function setRTRunning(on) {
      rtRunning = on;
      btnRTStart.style.opacity = on ? '.45' : '1';
      btnRTStart.style.cursor  = on ? 'not-allowed' : 'pointer';
      btnRTStop.style.opacity  = on ? '1' : '.45';
      btnRTStop.style.cursor   = on ? 'pointer' : 'not-allowed';
    }
    setRTRunning(false);

    const rowRTBtns = ui.row(4);
    rowRTBtns.style.cssText += ';margin-bottom:4px';
    rowRTBtns.append(btnRTStart, btnRTStop);

    const rtStatusEl = document.createElement('div');
    rtStatusEl.style.cssText = 'font-size:8px;color:#aaaacc;text-align:center;margin-top:2px;letter-spacing:.04em';
    rtStatusEl.textContent = 'Parado';

    secRT.append(rowRTBtns, rtStatusEl);
    scrollBody.appendChild(secRT);
    panel.appendChild(scrollBody);

    // ── Resize / scale ──
    const BASE_W = 340, BASE_H = 520;
    function applyScale(w, h) {
      const scale = Math.min(Math.max(0.7, Math.min(2.5, w / BASE_W)), h != null ? Math.max(1.0, Math.min(2.5, h / BASE_H)) : 2.5);
      panel.style.fontSize = Math.max(8, Math.round(11 * scale)) + 'px';
      const cols = w >= 320 ? 3 : w >= 220 ? 2 : 1;
      probeGrid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      if (h != null) secTG.style.display = h < 260 ? 'none' : '';
    }
    ui.makeResizable(panel, { minW: 220, minH: 180, onResize: (w, h) => applyScale(w, h) });
    if (window.ResizeObserver) {
      new ResizeObserver(entries => {
        const { width: w, height: h } = entries[0].contentRect;
        applyScale(w, h);
      }).observe(panel);
    }

    // ── RT tick ──
    let rtIntervalId = null;

    function updateRTCard(ch, r) {
      if (r.isReference) return;
      const inactive = !ch.active || r.skipped;
      const DASH = '\u2014';
      if (inactive) {
        if (ch._rtVal)     { ch._rtVal.textContent = DASH;     ch._rtVal.style.color = '#555566'; }
        if (ch._rtValReal) { ch._rtValReal.textContent = DASH; ch._rtValReal.style.color = '#555566'; }
        if (ch._rtConfBar)    ch._rtConfBar.style.width = '0%';
        if (ch._rtHistBadge)  ch._rtHistBadge.textContent = '';
        if (ch._rtAlphaBadge) ch._rtAlphaBadge.textContent = '';
        return;
      }
      const conf        = r.confidence !== null ? r.confidence : 0;
      const aboveThresh = conf >= ML.config.rtConfThreshold;
      const offsetMs    = r.offsetMs;
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
        ch._rtAlphaBadge.textContent = alpha !== null ? '\u03b1=' + alpha.toFixed(2) : '';
        ch._rtAlphaBadge.style.color = alpha !== null && alpha < 0.7 ? '#ffd700' : '#aaaacc';
      }
    }

    function rtTick() {
      if (!rtRunning) return;
      const results = ML.correlator.correlateRollingAll();
      results.forEach(r => { const ch = r.channel; if (!ch) return; updateRTCard(ch, r); });
      rtStatusEl.textContent = '\u25cf AO VIVO  \u2014  ' + new Date().toLocaleTimeString('pt-BR');
      rtStatusEl.style.color = '#00d4ff';
    }

    function resetRTState() {
      // Reseta apenas os elementos de UI — os buffers são responsabilidade do recorder
      ML.CHANNELS.forEach(ch => {
        ch._rtLastVal     = undefined;
        ch._rtLastConf    = undefined;
        if (ch._rtVal)       { ch._rtVal.textContent = '--';     ch._rtVal.style.color = '#aaaacc'; ch._rtVal.style.opacity = '1'; }
        if (ch._rtValReal)   { ch._rtValReal.textContent = '--'; ch._rtValReal.style.color = '#aaaacc'; ch._rtValReal.style.opacity = '1'; }
        if (ch._rtConfBar)   ch._rtConfBar.style.width = '0%';
        if (ch._rtHistBadge)  ch._rtHistBadge.textContent = '';
        if (ch._rtAlphaBadge) ch._rtAlphaBadge.textContent = '';
      });
    }

    btnRTStart.onclick = () => {
      if (rtRunning) return;
      resetRTState();
      ML.recorder.startRolling();
      setRTRunning(true);
      if (rtIntervalId) clearInterval(rtIntervalId);
      rtIntervalId = setInterval(rtTick, ML.config.rtIntervalMs);
      rtStatusEl.textContent = 'Acumulando amostras...';
      rtStatusEl.style.color = '#aaaacc';
    };

    btnRTStop.onclick = () => {
      if (!rtRunning) return;
      clearInterval(rtIntervalId); rtIntervalId = null;
      ML.recorder.stopRolling();
      setRTRunning(false);
      resetRTState();
      rtStatusEl.textContent = 'Parado';
      rtStatusEl.style.color = '#aaaacc';
    };

    document.body.appendChild(panel);
    panel.style.left = '4px';
    panel.style.top  = '4px';
    requestAnimationFrame(() => applyScale(panel.offsetWidth, panel.offsetHeight));
    ui.minimizePanel(panel);

    // ── Lum display loop ──
    // lumIntervalId é guardado para ser cancelado no btnX.onclick.
    lumIntervalId = setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (!ch.active || !ch.lumEl) return;
        const s = ML.getSample ? ML.getSample(ch) : null;
        const y = s ? s.lum : (ML.getLum ? ML.getLum(ch) : null);
        if (y === null) {
          ch.lumEl.textContent = '--'; ch.lumEl.style.color = ch.color; ch.lumEl.title = '';
        } else if (y === -1) {
          ch.lumEl.textContent = '\ud83d\udd12'; ch.lumEl.style.color = '#ff4444'; ch.lumEl.title = 'CORS bloqueado';
        } else {
          ch.lumEl.textContent = Math.round(y);
          ch.lumEl.style.color = ch.color;
          ch.lumEl.title = s ? `Y:${Math.round(s.lum)}  R:${Math.round(s.r)}  G:${Math.round(s.g)}  B:${Math.round(s.b)}` : '';
        }
      });
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[MedLat] 50-panel carregado v1.3. lumIntervalId gerenciado. alpha badge funcional.');
})();
