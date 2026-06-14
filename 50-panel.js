(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  // ── CSS específico do painel ────────────────────────────────────────────

  (function injectStyles() {
    ui.injectStyles();
  })();

  // ── Resultados ──────────────────────────────────────────────────

  function refreshRealColumn() {
    const refDed = ML.CHANNELS[0].deduction || 0;
    ML.CHANNELS.forEach((ch, i) => {
      if (!ch.realEl) return;
      const t = ui.T;
      if (i === 0) { ch.realEl.textContent = '0.000s'; ch.realEl.style.color = '#44ff88'; return; }
      if (!ch.offsetEl || ch.offsetEl.textContent === '--' || ch.offsetEl.textContent === 'ERRO') {
        ch.realEl.textContent = '--'; ch.realEl.style.color = '#aaaacc'; return;
      }
      const offsetS = parseFloat(ch.offsetEl.textContent.replace('s', '').replace(',', '.'));
      if (isNaN(offsetS)) { ch.realEl.textContent = '--'; ch.realEl.style.color = '#aaaacc'; return; }
      const realS = offsetS + (ch.deduction || 0) - refDed;
      ch.realEl.textContent = (realS > 0 ? '\u2009+' : '') + realS.toFixed(3) + 's';
      ch.realEl.style.color = ui.colorByOffset(Math.abs(realS));
    });
  }

  // ── Inputs de canal ───────────────────────────────────────────────

  function mkLagSelect(ch) {
    const sel = document.createElement('select');
    sel.title = 'Faixa de atraso esperada em relação à referência';
    function applySelStyle() {
      const tt = ui.T;
      sel.style.cssText = [
        `background:${tt.selectBg};border:1px solid ${tt.selectBorder};color:${tt.selectColor}`,
        'font:bold 8px monospace;border-radius:3px;padding:1px 2px',
        'cursor:pointer;outline:none;width:100%;height:18px;box-sizing:border-box',
      ].join(';');
      updateSelColor();
    }
    [
      { value: 'auto',   label: 'Auto'       },
      { value: 'rapido', label: 'R\u00e1pido \u22645s'  },
      { value: 'normal', label: 'Normal \u226415s' },
      { value: 'lento',  label: 'Lento \u226430s'  },
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.value; opt.textContent = o.label;
      if ((ch.lagPreset || 'auto') === o.value) opt.selected = true;
      sel.appendChild(opt);
    });
    function updateSelColor() {
      const colors  = { auto: ui.T.selectColor, rapido: '#44ff88', normal: '#ffd700', lento: '#ff8844' };
      const borders = { auto: ui.T.selectBorder, rapido: '#44ff8888', normal: '#ffd70088', lento: '#ff884488' };
      sel.style.color       = colors[sel.value]  || ui.T.selectColor;
      sel.style.borderColor = borders[sel.value] || ui.T.selectBorder;
    }
    sel.addEventListener('change', () => { ch.lagPreset = sel.value; updateSelColor(); });
    applySelStyle();
    return sel;
  }

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
    inp.addEventListener('blur',  () => {
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
      refreshRealColumn();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    ch._dedInp = inp;
    return inp;
  }

  // ── init ──────────────────────────────────────────────────────────

  function init() {
    ['ml-panel', 'ml-chart-overlay', 'ml-tips', 'ml-guide', 'ml-widget'].forEach(id => {
      const el = document.getElementById(id); if (el) el.remove();
    });

    const panel = document.createElement('div');
    panel.id = 'ml-panel';

    function applyPanelStyle() {
      const t = ui.T;
      const hasW = panel.style.width  && panel.style.width  !== '340px';
      const hasH = panel.style.height && panel.style.height !== '';
      panel.style.cssText = [
        `position:fixed;top:4px;left:4px;z-index:99999`,
        `background:${t.panelBg};border:1px solid ${t.panelBorder}`,
        'border-radius:6px;box-shadow:0 4px 24px #000c',
        `font-family:monospace;font-size:11px;color:${t.textPrimary}`,
        `user-select:none;width:${hasW ? panel.style.width : '340px'}`,
        ...(hasH ? [`height:${panel.style.height}`] : []),
        'display:flex;flex-direction:column;overflow:hidden',
      ].join(';');
    }
    applyPanelStyle();

    // ── Header ──
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
    ttl.textContent = '\u{1F550} ANALISADOR DE LAT\u00CANCIA';
    ttl.style.cssText = `color:${ui.T.textPrimary};font-weight:bold;font-size:10px;letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0`;

    const btnTips  = ui.mkIconBtn('\ud83d\udca1', 'Dicas para uma medi\u00e7\u00e3o precisa', '#ffd700');
    const btnGuide = ui.mkIconBtn('\ud83d\udccb', 'Passo a passo de uso do medidor', '#00d4ff');

    // ── Botão RT ──
    const btnRT = document.createElement('button');
    btnRT.title = 'Alternar entre modo Tempo Real e modo Gravar/Analisar';
    btnRT.textContent = '\u26a1RT';
    function applyBtnRTStyle() {
      const on = ML.config.rtMode;
      btnRT.style.cssText = [
        `background:${on ? '#003a4a' : ui.T.btnBg}`,
        `border:1px solid ${on ? '#00d4ff88' : ui.T.btnBorder}`,
        `color:${on ? '#00d4ff' : ui.T.textPrimary}`,
        'font:bold 9px monospace;border-radius:3px;padding:0 5px',
        'cursor:pointer;height:17px;flex-shrink:0;line-height:1',
        on ? 'box-shadow:0 0 6px #00d4ff44' : '',
      ].join(';');
    }
    applyBtnRTStyle();

    const btnMin = ui.mkIconBtn('\u2212', 'Minimizar para widget', '#aaaaaa');
    const btnX   = document.createElement('button');
    btnX.textContent = '\u2715'; btnX.title = 'Fechar o medidor';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnX.onclick = () => {
      ML.recorder.stop();
      ML.recorder.stopRolling();
      if (rtIntervalId) clearInterval(rtIntervalId);
      document.querySelectorAll('[id^="ml-"], .ml-search-overlay').forEach(e => e.remove());
    };
    btnTips.onclick  = () => ML.help.toggleTips(panel);
    btnGuide.onclick = () => ML.help.toggleGuide(panel);
    btnMin.onclick   = () => ui.minimizePanel(panel);
    hdr.append(ttl, btnTips, btnGuide, btnRT, btnMin, btnX);
    panel.appendChild(hdr);

    // ── Drag ──
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

    // ── Scroll body ──
    const scrollBody = document.createElement('div');
    scrollBody.style.cssText = 'flex:1;overflow-y:auto;min-height:0;display:flex;flex-direction:column';

    /* ── Seção: Posicionamento ── */
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
    btnCol.title = 'Evita sobreposição entre probes';
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : ui.T.btnBg;
      btnCol.style.color      = ML.state.noOverlap ? '#ff8844' : ui.T.btnColor;
    }
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    const rowPos = ui.row(4);
    rowPos.append(ui.sp('PX', 'flex-shrink:0;font-size:9px'), btnPxM, pxInp, btnPxP, btnSnap, btnCol);
    secTG.appendChild(rowPos);
    scrollBody.appendChild(secTG);

    /* ── Seção: Telas ── */
    const secDet = ui.sec('Telas');
    const probeGrid = document.createElement('div');
    probeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';

    ML.CHANNELS.forEach((ch, i) => {
      ch.deduction = ch.deduction || 0;
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

      const r1 = ui.row(3);
      r1.style.cssText += ';overflow:hidden;min-width:0';
      const tog = document.createElement('button');
      tog.title = 'Ativar ou desativar esta tela';
      tog.style.cssText = `width:8px;height:8px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.onclick = () => {
        ch.active = !ch.active;
        tog.style.background = ch.active ? ch.color : 'transparent';
        card.style.opacity = ch.active ? 1 : .4;
        ch.probe.style.display = ch.active ? 'block' : 'none';
        if (!ch.active) { ch.prevLum = null; } else { if (ch.resize) ch.resize(); }
      };

      const lblInp = document.createElement('input');
      lblInp.value = i === 0 ? 'Refer\u00eancia' : ch.label;
      lblInp.title = 'Clique para renomear a tela';
      lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 8px monospace;flex:1;outline:none;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis;width:0`;
      lblInp.addEventListener('change', () => {
        ch.label = lblInp.value.replace(/^\u2605\s*/, '');
        if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
        if (ch._tdName) ch._tdName.textContent = (i === 0 ? '\u2605 ' : '') + ch.label;
      });

      const lumEl = document.createElement('span');
      lumEl.title = 'Lumin\u00e2ncia atual da probe (0\u2013255)';
      lumEl.style.cssText = `color:${ch.color};font-size:11px;font-weight:bold;flex-shrink:0`;
      lumEl.textContent = '--'; ch.lumEl = lumEl;

      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'display:none';
      ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;

      r1.append(tog, lblInp, lumEl, ptsEl);

      const r2 = ui.row(2);
      r2.style.cssText += ';overflow:hidden;min-width:0;align-items:center';

      const szInp = document.createElement('input');
      szInp.type = 'text';
      szInp.value = ch.probeW != null ? ch.probeW : ML.state.probeW;
      szInp.className = 'ml-sz-inp';
      szInp.title = 'Tamanho desta probe em pixels';
      function applySzStyle() {
        const t = ui.T;
        szInp.style.cssText = [
          `background:${t.inputBg};border:1px solid ${t.inputBorder};color:${t.textPrimary}`,
          'font:bold 9px monospace;border-radius:3px;padding:1px 2px',
          'text-align:center;outline:none;box-sizing:border-box',
          'height:18px;width:28px;flex-shrink:0;min-width:0',
        ].join(';');
      }
      applySzStyle();
      szInp.addEventListener('focus', () => szInp.style.borderColor = ui.T.inputBorder + 'cc');
      szInp.addEventListener('blur',  () => szInp.style.borderColor = ui.T.inputBorder);
      ch._szInp = szInp;

      function applyChanPx(v) {
        const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
        ch.probeW = c; szInp.value = c;
        if (ch.active && ch.resize) ch.resize();
      }
      szInp.addEventListener('change', () => applyChanPx(parseInt(szInp.value) || ML.state.probeW));
      szInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); applyChanPx(parseInt(szInp.value) || ML.state.probeW); szInp.blur(); }
      });

      function mkSzBtn(symbol, title2) {
        const b = document.createElement('button');
        b.textContent = symbol; b.title = title2;
        const t = ui.T;
        b.style.cssText = [
          `background:${t.btnBg};border:1px solid ${t.btnBorder};color:${t.textPrimary}`,
          'font:bold 9px monospace;border-radius:3px;padding:0 3px',
          'cursor:pointer;height:18px;flex-shrink:0;line-height:1',
        ].join(';');
        return b;
      }
      const btnSzM = mkSzBtn('\u2212', 'Diminuir probe');
      const btnSzP = mkSzBtn('+', 'Aumentar probe');
      btnSzM.onclick = () => applyChanPx((parseInt(szInp.value) || ML.state.probeW) - 2);
      btnSzP.onclick = () => applyChanPx((parseInt(szInp.value) || ML.state.probeW) + 2);

      r2.append(ui.sp('px', 'font-size:9px;flex-shrink:0'), btnSzM, szInp, btnSzP);

      const r3ded = ui.row(2);
      r3ded.style.cssText += ';overflow:hidden;min-width:0';
      r3ded.append(ui.sp('ded', 'font-size:9px;flex-shrink:0'), mkDeductionInput(ch));

      const rows = [r1, r2, r3ded];
      if (i !== 0) {
        const r4lag = ui.row(2);
        r4lag.style.cssText += ';overflow:hidden;min-width:0';
        r4lag.append(ui.sp('lag', 'font-size:9px;flex-shrink:0'), mkLagSelect(ch));
        rows.push(r4lag);
      }
      rows.forEach(r => card.appendChild(r));
      probeGrid.appendChild(card);
    });

    secDet.appendChild(probeGrid);
    scrollBody.appendChild(secDet);

    /* ── Seção: Análise (modo LOG) ── */
    const secAn = ui.sec('An\u00e1lise');
    const btnRec     = ui.mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = ui.mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box;letter-spacing:.04em;color:#ce93d8;opacity:.45');
    btnRec.title     = 'Inicia a captura de lumin\u00e2ncia';
    btnAnalyze.title = 'Calcula a lat\u00eancia com base nos dados gravados';

    const progWrap = document.createElement('div');
    progWrap.style.cssText = 'display:none;flex-direction:column;gap:1px;padding:2px 0';
    const progBarOuter = document.createElement('div');
    progBarOuter.style.cssText = `width:100%;height:5px;background:${ui.T.inputBg};border-radius:3px;overflow:hidden`;
    const progBarInner = document.createElement('div');
    progBarInner.style.cssText = 'height:100%;width:0%;background:#44ff88;border-radius:3px;transition:width .5s linear';
    progBarOuter.appendChild(progBarInner);
    const progLabel = document.createElement('div');
    progLabel.style.cssText = 'font-size:8px;color:#44ff88;text-align:center;letter-spacing:.05em';
    progLabel.textContent = '0%';
    progWrap.append(progBarOuter, progLabel);

    function doStop() {
      ML.recorder.stop();
      ui.playDone();
      progWrap.style.display = 'none';
      progBarInner.style.width = '0%';
      btnRec.textContent = '\u25cf GRAVAR';
      btnRec.style.background = '#1b5e20'; btnRec.style.borderColor = '#2e7d3288'; btnRec.style.boxShadow = '0 0 8px #1b5e2066';
      const pts = ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ');
      statusEl.textContent = 'Pronto (' + pts + ')';
      statusEl.style.color = '#ffd700';
      btnAnalyze.disabled = false;
      setTimeout(() => btnAnalyze.onclick(), 300);
    }

    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#7f0000'; btnRec.style.borderColor = '#c6282888'; btnRec.style.boxShadow = '0 0 8px #c6282855';
        statusEl.textContent = 'Gravando...'; statusEl.style.color = '#44ff88';
        progWrap.style.display = 'flex';
        progBarInner.style.width = '0%'; progLabel.textContent = '0%'; progLabel.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach((ch, i) => {
          ch._prevPts = 0; ch._stableCnt = 0;
          if (ch.ptsEl) { ch.ptsEl.textContent = '0pt'; ch.ptsEl.style.color = '#fff'; }
          if (i !== 0) {
            if (ch.offsetEl) { ch.offsetEl.textContent = '--'; ch.offsetEl.style.color = '#aaaacc'; }
            if (ch.realEl)   { ch.realEl.textContent   = '--'; ch.realEl.style.color   = '#aaaacc'; }
          }
        });
      } else { doStop(); }
    };

    btnAnalyze.onclick = () => {
      statusEl.textContent = 'Calculando...'; statusEl.style.color = '#aaaacc';
      setTimeout(() => {
        const results = ML.correlator.analyzeBestAll();
        results.forEach(r => {
          const ch = r.channel;
          if (!ch || r.isReference) return;
          if (ch.offsetEl) {
            if (r.skipped || r.error) {
              ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
              ch.offsetEl.style.color = r.error ? '#ff4444' : '#aaaacc';
            } else {
              const s = r.offsetMs / 1000;
              ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
              ch.offsetEl.style.color = ui.colorByOffset(Math.abs(s));
            }
          }
        });
        refreshRealColumn();
        if (ML.chart && ML.chart.show) ML.chart.show(results);
        const errs = results.filter(r => r.error);
        statusEl.textContent = errs.length
          ? errs.map(r => r.label + ': ' + r.error).join(' | ')
          : 'An\u00e1lise conclu\u00edda';
        statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
      }, 30);
    };

    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .45 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    const rowBtns = ui.row(4); rowBtns.style.marginBottom = '2px';
    rowBtns.append(btnRec, btnAnalyze);
    secAn.appendChild(rowBtns);
    secAn.appendChild(progWrap);
    scrollBody.appendChild(secAn);

    /* ── Seção: Tempo Real (modo RT) ── */
    const secRT = ui.sec('\u26a1 Tempo Real');
    secRT.style.display = 'none';

    // Grid de cards RT (1 por canal ativo)
    const rtGrid = document.createElement('div');
    rtGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:4px';

    // Cria card RT para cada canal (ch[0] = Refer\u00eancia, mostra "REF")
    ML.CHANNELS.forEach((ch, i) => {
      const card = document.createElement('div');
      card.style.cssText = [
        'display:flex;flex-direction:column;align-items:center;gap:2px',
        'padding:4px 3px;border-radius:4px;box-sizing:border-box',
        `border:1px solid ${ch.color}44`,
        `background:${ch.color}0d`,
        `border-top:2px solid ${ch.color}99`,
        'min-width:0;overflow:hidden',
      ].join(';');
      ch._rtCard = card;

      // Label
      const lbl = document.createElement('div');
      lbl.textContent = i === 0 ? 'REF' : ch.label;
      lbl.style.cssText = `color:${ch.color};font:bold 8px monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;text-align:center`;
      ch._rtLbl = lbl;

      // Valor principal (offset)
      const val = document.createElement('div');
      val.textContent = i === 0 ? '\u2605' : '--';
      val.style.cssText = 'font:bold 14px monospace;letter-spacing:-.02em;text-align:center;line-height:1';
      val.style.color = i === 0 ? '#44ff88' : '#aaaacc';
      ch._rtVal = val;

      // Barra de confian\u00e7a
      const confWrap = document.createElement('div');
      confWrap.style.cssText = 'width:100%;height:3px;background:#ffffff18;border-radius:2px;overflow:hidden';
      const confBar = document.createElement('div');
      confBar.style.cssText = 'height:100%;width:0%;border-radius:2px;transition:width .4s,background .4s';
      confWrap.appendChild(confBar);
      ch._rtConfBar = confBar;

      // Mini sparkline (8 barras)
      const sparkWrap = document.createElement('div');
      sparkWrap.style.cssText = 'display:flex;align-items:flex-end;gap:1px;height:16px;width:100%;margin-top:1px';
      ch._rtSpark     = sparkWrap;
      ch._rtHistory   = [];  // últimos 8 offsets em ms

      if (i === 0) {
        card.append(lbl, val);
      } else {
        card.append(lbl, val, confWrap, sparkWrap);
      }
      rtGrid.appendChild(card);
    });

    // Strip de resumo global
    const rtSummary = document.createElement('div');
    rtSummary.style.cssText = [
      'display:flex;justify-content:space-between;align-items:center',
      `background:#ffffff08;border:1px solid #ffffff14`,
      'border-radius:3px;padding:3px 6px;font-size:8px;color:#aaaacc',
    ].join(';');
    rtSummary.innerHTML = '<span>ATIVOS: <b id="ml-rt-active">--</b></span>' +
      '<span>M\u00c1X: <b id="ml-rt-max">--</b></span>' +
      '<span>M\u00c9D: <b id="ml-rt-avg">--</b></span>' +
      '<span>CONF: <b id="ml-rt-conf">--</b></span>';

    // Status RT
    const rtStatusEl = document.createElement('div');
    rtStatusEl.style.cssText = 'font-size:8px;color:#aaaacc;text-align:center;margin-top:2px;letter-spacing:.04em';
    rtStatusEl.textContent = 'Aguardando...';

    secRT.append(rtGrid, rtSummary, rtStatusEl);
    scrollBody.appendChild(secRT);

    /* ── Seção: Resultados ── */
    const btnCopyInline = document.createElement('button');
    btnCopyInline.innerHTML = '\ud83d\udccb';
    btnCopyInline.title = 'Copiar tabela de resultados para a \u00e1rea de transfer\u00eancia';
    btnCopyInline.style.cssText = `background:transparent;border:1px solid ${ui.T.accentColor}44;color:${ui.T.accentColor};border-radius:3px;padding:0 4px;cursor:pointer;font-size:10px;line-height:14px`;
    btnCopyInline.addEventListener('mouseenter', () => btnCopyInline.style.background = ui.T.accentColor + '18');
    btnCopyInline.addEventListener('mouseleave', () => btnCopyInline.style.background = 'transparent');
    btnCopyInline.onclick = () => ui.copyResults(btnCopyInline);

    const secRes = ui.sec('Resultados', btnCopyInline);
    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:9px';
    const thead = document.createElement('thead');
    const trH = document.createElement('tr');
    ['Tela', 'Resultado', 'Real'].forEach((h, hi) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = `color:${ui.T.textSection};font-weight:bold;padding:1px ${hi === 0 ? '2px' : '4px'};text-align:${hi === 0 ? 'left' : 'center'};border-bottom:1px solid ${ui.T.sectionBorder}`;
      trH.appendChild(th);
    });
    thead.appendChild(trH); tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    ML.CHANNELS.forEach((ch, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid ${ui.T.rowBorder}`;
      ch._panelTr = tr;
      const tdName = document.createElement('td');
      tdName.textContent = (i === 0 ? '\u2605 ' : '') + (i === 0 ? 'Refer\u00eancia' : ch.label);
      tdName.style.cssText = `color:${ch.color};padding:1px 2px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px`;
      ch._tdName = tdName;
      const tdOff = document.createElement('td');
      tdOff.textContent = i === 0 ? '0.000s' : '--';
      tdOff.style.cssText = `color:${i === 0 ? '#44ff88' : '#aaaacc'};padding:1px 4px;text-align:center;font-weight:bold`;
      ch.offsetEl = tdOff;
      const tdReal = document.createElement('td');
      tdReal.textContent = i === 0 ? '0.000s' : '--';
      tdReal.style.cssText = `color:${i === 0 ? '#44ff88' : '#aaaacc'};padding:1px 4px;text-align:center;font-weight:bold`;
      ch.realEl = tdReal;
      tr.append(tdName, tdOff, tdReal);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    secRes.appendChild(tbl);
    scrollBody.appendChild(secRes);

    /* ── Seção: Status ── */
    const secSt = document.createElement('div');
    secSt.style.cssText = 'padding:3px 8px;flex-shrink:0';
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size:9px;color:${ui.T.statusColor};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    statusEl.textContent = 'Pronto';
    secSt.appendChild(statusEl);
    scrollBody.appendChild(secSt);

    panel.appendChild(scrollBody);

    // ── Escala responsiva ──────────────────────────────────────────────
    const BASE_W = 340;
    const BASE_H = 640;

    function applyScale(w, h) {
      const scaleW = Math.max(0.7, Math.min(2.5, w / BASE_W));
      const scaleH = h != null ? Math.max(1.0, Math.min(2.5, h / BASE_H)) : 1;
      const scale  = Math.min(scaleW, scaleH);
      const fs     = Math.max(8, Math.round(11 * scale));
      panel.style.fontSize = fs + 'px';

      const cols = w >= 320 ? 3 : w >= 220 ? 2 : 1;
      probeGrid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      rtGrid.style.gridTemplateColumns    = `repeat(${cols},1fr)`;

      if (h != null) {
        secTG.style.display = h < 260 ? 'none' : '';
        secAn.style.display = h < 200 ? 'none' : '';
      }
    }

    ui.makeResizable(panel, {
      minW: 220,
      minH: 180,
      onResize: (w, h) => applyScale(w, h),
    });

    if (window.ResizeObserver) {
      new ResizeObserver(entries => {
        const { width: w, height: h } = entries[0].contentRect;
        applyScale(w, h);
      }).observe(panel);
    }

    // ── Lógica do toggle RT ───────────────────────────────────────────
    let rtIntervalId = null;

    function updateRTCard(ch, r) {
      if (!ch._rtVal) return;
      if (r.isReference) return;
      if (!ch.active || r.skipped) {
        ch._rtVal.textContent = '\u2014';
        ch._rtVal.style.color = '#555566';
        if (ch._rtConfBar) { ch._rtConfBar.style.width = '0%'; }
        return;
      }
      const conf = r.confidence !== null ? r.confidence : 0;
      const aboveThreshold = conf >= ML.config.rtConfThreshold;

      if (r.error || !aboveThreshold) {
        ch._rtVal.textContent = r.error ? 'ERR' : 'AGUARD.';
        ch._rtVal.style.color = '#666688';
        ch._rtVal.style.fontSize = r.error ? '10px' : '8px';
      } else {
        const s = r.offsetMs / 1000;
        ch._rtVal.textContent = (s >= 0 ? '+' : '') + s.toFixed(2) + 's';
        ch._rtVal.style.color = ui.colorByOffset(Math.abs(s));
        ch._rtVal.style.fontSize = '14px';
        // sparkline
        ch._rtHistory.push(r.offsetMs);
        if (ch._rtHistory.length > 8) ch._rtHistory.shift();
        if (ch._rtSpark) {
          ch._rtSpark.innerHTML = '';
          const maxAbs = Math.max(1, ...ch._rtHistory.map(v => Math.abs(v)));
          ch._rtHistory.forEach(v => {
            const bar = document.createElement('div');
            const h = Math.max(2, Math.round(14 * Math.abs(v) / maxAbs));
            bar.style.cssText = [
              `height:${h}px;flex:1;border-radius:1px`,
              `background:${ui.colorByOffset(Math.abs(v) / 1000)}`,
              'min-width:0',
            ].join(';');
            ch._rtSpark.appendChild(bar);
          });
        }
      }

      // barra de confian\u00e7a
      if (ch._rtConfBar) {
        const pct = Math.round(conf * 100);
        ch._rtConfBar.style.width  = pct + '%';
        ch._rtConfBar.style.background = conf >= ML.config.rtConfThreshold
          ? '#44ff88' : conf > 0.4 ? '#ffd700' : '#ff4444';
      }
    }

    function rtTick() {
      if (!ML.config.rtMode) return;
      const results = ML.correlator.correlateRollingAll();

      let activeCount = 0, offsets = [], confs = [];
      results.forEach(r => {
        const ch = r.channel;
        if (!ch) return;
        updateRTCard(ch, r);
        if (!r.isReference && !r.skipped && r.offsetMs !== null) {
          activeCount++;
          offsets.push(Math.abs(r.offsetMs));
          if (r.confidence !== null) confs.push(r.confidence);
        }
      });

      // Atualiza summary strip
      const elActive = document.getElementById('ml-rt-active');
      const elMax    = document.getElementById('ml-rt-max');
      const elAvg    = document.getElementById('ml-rt-avg');
      const elConf   = document.getElementById('ml-rt-conf');
      if (elActive) elActive.textContent = activeCount;
      if (elMax && offsets.length) {
        const maxS = Math.max(...offsets) / 1000;
        elMax.textContent = maxS.toFixed(2) + 's';
        elMax.style.color = ui.colorByOffset(maxS);
      } else if (elMax) elMax.textContent = '--';
      if (elAvg && offsets.length) {
        const avgS = offsets.reduce((a, b) => a + b, 0) / offsets.length / 1000;
        elAvg.textContent = avgS.toFixed(2) + 's';
        elAvg.style.color = ui.colorByOffset(avgS);
      } else if (elAvg) elAvg.textContent = '--';
      if (elConf && confs.length) {
        const avgConf = Math.round(confs.reduce((a, b) => a + b, 0) / confs.length * 100);
        elConf.textContent = avgConf + '%';
        elConf.style.color = avgConf >= 70 ? '#44ff88' : avgConf >= 40 ? '#ffd700' : '#ff4444';
      } else if (elConf) elConf.textContent = '--';

      rtStatusEl.textContent = '\u25cf AO VIVO  \u2014  ' + new Date().toLocaleTimeString('pt-BR');
      rtStatusEl.style.color = '#00d4ff';
    }

    btnRT.onclick = () => {
      ML.config.rtMode = !ML.config.rtMode;
      applyBtnRTStyle();

      if (ML.config.rtMode) {
        // Entra no modo RT
        secAn.style.display  = 'none';
        secRT.style.display  = '';
        ML.recorder.stopRolling();
        ML.recorder.startRolling();
        if (rtIntervalId) clearInterval(rtIntervalId);
        rtIntervalId = setInterval(rtTick, ML.config.rtIntervalMs);
        rtStatusEl.textContent = 'Iniciando...'; rtStatusEl.style.color = '#aaaacc';
        statusEl.textContent   = '\u26a1 Modo RT ativo'; statusEl.style.color = '#00d4ff';
      } else {
        // Volta ao modo LOG
        clearInterval(rtIntervalId); rtIntervalId = null;
        ML.recorder.stopRolling();
        secRT.style.display  = 'none';
        secAn.style.display  = '';
        rtStatusEl.textContent = 'Pausado';
        statusEl.textContent   = 'Pronto'; statusEl.style.color = ui.T.statusColor;
      }
    };

    // ── Exp\u00f5e ML.panel ─────────────────────────────────────────────
    ML.panel = {
      refreshOffsets(offsets) {
        ML.CHANNELS.forEach((ch, i) => {
          if (i === 0 || !ch.offsetEl) return;
          const totalMs = offsets[ch.id];
          if (totalMs == null) return;
          const s = totalMs / 1000;
          ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
          ch.offsetEl.style.color = ui.colorByOffset(Math.abs(s));
        });
        refreshRealColumn();
      },
    };

    document.body.appendChild(panel);
    panel.style.left = '4px';
    panel.style.top  = '4px';

    ui.minimizePanel(panel);

    /* ── Timers ── */
    setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (!ch.active || !ch.lumEl) return;
        const y = ML.getLum ? ML.getLum(ch) : null;
        if (y === null)    { ch.lumEl.textContent = '--';  ch.lumEl.style.color = ch.color; }
        else if (y === -1) { ch.lumEl.textContent = '\ud83d\udd12'; ch.lumEl.style.color = '#ff4444'; }
        else               { ch.lumEl.textContent = Math.round(y); ch.lumEl.style.color = ch.color; }
      });
    }, 200);

    setInterval(() => {
      if (!ML.state.recording) return;
      const activeChs = ML.CHANNELS.filter(ch => ch.active);
      if (!activeChs.length) return;
      const globalTarget = ML.recorder.getGlobalTarget();
      if (activeChs.every(ch => (ch.buffer ? ch.buffer.length : 0) >= globalTarget)) { doStop(); return; }
      let minPts = Infinity;
      activeChs.forEach(ch => { const pts = ch.buffer ? ch.buffer.length : 0; if (pts < minPts) minPts = pts; });
      const pct = Math.min(100, Math.round((minPts / globalTarget) * 100));
      progBarInner.style.width = pct + '%';
      progLabel.textContent    = pct + '%';
      if (pct >= 80) {
        progBarInner.style.background = pct >= 95 ? '#ffd700' : '#44ff88';
        progLabel.style.color         = pct >= 95 ? '#ffd700' : '#44ff88';
      }
      activeChs.forEach(ch => {
        if (!ch.ptsEl) return;
        const pts = ch.buffer ? ch.buffer.length : 0;
        ch.ptsEl.textContent = pts + 'pt';
        const stable = pts === (ch._prevPts || 0);
        ch._stableCnt = stable ? (ch._stableCnt || 0) + 1 : 0;
        ch._prevPts = pts;
        ch.ptsEl.style.color = ch._stableCnt > 3 ? '#ff8844' : '#44ff88';
      });
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[MedLat] 50-panel carregado. Modo RT dispon\u00edvel via bot\u00e3o \u26a1RT no header.');
})();
