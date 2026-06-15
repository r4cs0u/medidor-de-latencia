(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  (function injectStyles() { ui.injectStyles(); })();

  // ── Resultados (modo LOG) ──────────────────────────────────

  function refreshRealColumn() {
    const refDed = ML.CHANNELS[0].deduction || 0;
    ML.CHANNELS.forEach((ch, i) => {
      if (!ch.realEl) return;
      if (i === 0) { ch.realEl.textContent = '0.000s'; ch.realEl.style.color = '#44ff88'; return; }
      if (!ch.offsetEl || ch.offsetEl.textContent === '--' || ch.offsetEl.textContent === 'ERRO') {
        ch.realEl.textContent = '--'; ch.realEl.style.color = '#aaaacc'; return;
      }
      const offsetS = parseFloat(ch.offsetEl.textContent.replace('s', '').replace(',', '.'));
      if (isNaN(offsetS)) { ch.realEl.textContent = '--'; ch.realEl.style.color = '#aaaacc'; return; }
      const realS = offsetS + (ch.deduction || 0) - refDed;
      const prefix = realS > 0 ? '\u2009+' : realS < 0 ? '\u2009' : '\u2009';
      ch.realEl.textContent = prefix + realS.toFixed(3) + 's';
      ch.realEl.style.color = ui.colorByOffset(Math.abs(realS));
    });
  }

  function calcRTReal(ch, offsetMs) {
    const refDed = (ML.CHANNELS[0].deduction || 0) * 1000;
    const chDed  = (ch.deduction || 0) * 1000;
    return offsetMs + chDed - refDed;
  }

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
      { value: 'auto',   label: 'Auto'        },
      { value: 'rapido', label: 'Rápido ≤5s'   },
      { value: 'normal', label: 'Normal ≤15s'  },
      { value: 'lento',  label: 'Lento ≤35s'   },
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
    inp.title = 'Offset fixo do multiviewer. Ex: 3 → -3.000s  +1.5 → +1.500s';
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
      refreshRealColumn();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    ch._dedInp = inp;
    return inp;
  }

  // ── init ────────────────────────────────────────────────────

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

    const btnTips  = ui.mkIconBtn('\ud83d\udca1', 'Dicas para uma medição precisa', '#ffd700');
    const btnGuide = ui.mkIconBtn('\ud83d\udccb', 'Passo a passo de uso do medidor', '#00d4ff');
    btnTips.onclick  = () => ML.help && ML.help.toggleTips(panel);
    btnGuide.onclick = () => ML.help && ML.help.toggleGuide(panel);

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
      if (rtIntervalId) clearInterval(rtIntervalId);
      document.querySelectorAll('[id^="ml-"], .ml-search-overlay').forEach(e => e.remove());
    };
    btnMin.onclick = () => ui.minimizePanel(panel);

    hdr.append(ttl, btnMin, btnX);
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

    const selNumCh = document.createElement('select');
    selNumCh.title = 'Número total de telas ativas (inclui referência)';
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

    // ── Cards unificados (probe + RT numa peça só) ─────────────
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

        // ── linha 1: toggle · label · lum ──
        const r1 = ui.row(3);
        r1.style.cssText += ';overflow:hidden;min-width:0';
        const tog = document.createElement('button');
        tog.title = 'Ativar ou desativar esta tela';
        tog.style.cssText = `width:8px;height:8px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active ? ch.color : 'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
        tog.onclick = () => {
          ch.active = !ch.active;
          tog.style.background = ch.active ? ch.color : 'transparent';
          card.style.opacity = ch.active ? 1 : .4;
          if (ch.probe) ch.probe.style.display = ch.active ? 'block' : 'none';
          if (!ch.active) { ch.prevLum = null; } else { if (ch.resize) ch.resize(); }
        };

        const lblInp = document.createElement('input');
        lblInp.value = isRef ? 'Referência' : ch.label;
        lblInp.title = 'Clique para renomear a tela';
        lblInp.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 8px monospace;flex:1;outline:none;cursor:text;min-width:0;overflow:hidden;text-overflow:ellipsis;width:0`;
        lblInp.addEventListener('change', () => {
          ch.label = lblInp.value.replace(/^\u2605\s*/, '');
          if (ch.probeLabel) ch.probeLabel.textContent = ch.label;
          if (ch._tdName) ch._tdName.textContent = (isRef ? '\u2605 ' : '') + ch.label;
        });

        const lumEl = document.createElement('span');
        lumEl.title = 'Luminância atual da probe (0–255)';
        lumEl.style.cssText = `color:${ch.color};font-size:11px;font-weight:bold;flex-shrink:0`;
        lumEl.textContent = '--'; ch.lumEl = lumEl;

        const ptsEl = document.createElement('span');
        ptsEl.style.cssText = 'display:none';
        ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;

        r1.append(tog, lblInp, lumEl, ptsEl);

        // ── linha 2: px ──
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

        // ── linha 3: lag (não-ref) ──
        const r3lag = ui.row(2);
        r3lag.style.cssText += ';overflow:hidden;min-width:0';
        if (!isRef) {
          r3lag.append(ui.sp('lag', 'font-size:9px;flex-shrink:0'), mkLagSelect(ch));
        }

        // ── linha 4: ded ──
        const r4ded = ui.row(2);
        r4ded.style.cssText += ';overflow:hidden;min-width:0';
        r4ded.append(ui.sp('ded', 'font-size:9px;flex-shrink:0'), mkDeductionInput(ch));

        // ── divisor RT ──
        const rtDivider = document.createElement('div');
        rtDivider.style.cssText = `height:1px;background:${ch.color}22;margin:2px 0;display:none`;
        ch._rtDivider = rtDivider;

        // ── linha RT: MEDIDO · REAL ──
        const rtRow = document.createElement('div');
        rtRow.style.cssText = 'display:none;flex-direction:row;justify-content:space-around;align-items:flex-end;width:100%;gap:2px';
        ch._rtRow = rtRow;

        if (!isRef) {
          const mkValCol = (labelTxt) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;flex:1;min-width:0';
            const lbl = document.createElement('div');
            lbl.textContent = labelTxt;
            lbl.style.cssText = 'font:bold 6px monospace;color:#aaaacc;letter-spacing:.08em;opacity:.7;line-height:1.4';
            const val = document.createElement('div');
            val.textContent = '--';
            val.style.cssText = 'font:bold 12px monospace;letter-spacing:-.02em;text-align:center;line-height:1;transition:color .3s;color:#aaaacc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%';
            wrap.append(lbl, val);
            return { wrap, val };
          };
          const colMed  = mkValCol('MEDIDO');
          const colReal = mkValCol('REAL');
          ch._rtVal     = colMed.val;
          ch._rtValReal = colReal.val;
          rtRow.append(colMed.wrap, colReal.wrap);

          // ── barra conf + alpha ──
          const rtFooter = document.createElement('div');
          rtFooter.style.cssText = 'display:none;flex-direction:column;gap:1px;width:100%';
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
          histBadge.textContent = '';
          ch._rtHistBadge = histBadge;

          const alphaBadge = document.createElement('div');
          alphaBadge.style.cssText = 'font:bold 6px monospace;opacity:.6;letter-spacing:.06em;line-height:1.4;color:#aaaacc;text-align:right';
          alphaBadge.textContent = '';
          ch._rtAlphaBadge = alphaBadge;

          rtMeta.append(histBadge, alphaBadge);
          rtFooter.append(confWrap, rtMeta);
          card.append(r1, r2, r3lag, r4ded, rtDivider, rtRow, rtFooter);
        } else {
          // REF: sem RT rows
          ch._rtVal = null; ch._rtValReal = null; ch._rtConfBar = null;
          ch._rtHistBadge = null; ch._rtAlphaBadge = null; ch._rtFooter = null;
          card.append(r1, r2, r4ded);
        }

        ch._rtHistory = [];
        probeGrid.appendChild(card);
      });

      applyRTVisibility();
    }

    function applyRTVisibility() {
      const on = ML.config.rtMode;
      ML.CHANNELS.forEach(ch => {
        if (ch._rtDivider) ch._rtDivider.style.display = on ? 'block' : 'none';
        if (ch._rtRow)     ch._rtRow.style.display     = on ? 'flex'  : 'none';
        if (ch._rtFooter)  ch._rtFooter.style.display  = on ? 'flex'  : 'none';
      });
    }

    selNumCh.addEventListener('change', () => { buildChannelCards(); });
    buildChannelCards();
    secDet.appendChild(probeGrid);
    scrollBody.appendChild(secDet);

    // ── Análise (modo LOG) ─────────────────────────────────────
    const secAn = ui.sec('Análise');
    secAn.style.display = 'none';
    const btnRec     = ui.mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = ui.mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:1px 3px;font-size:8px;line-height:1;height:18px;box-sizing:border-box;letter-spacing:.04em;color:#ce93d8;opacity:.45');
    btnRec.title     = 'Inicia a captura de luminância';
    btnAnalyze.title = 'Calcula a latência com base nos dados gravados';

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

    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size:9px;color:${ui.T.statusColor};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    statusEl.textContent = 'Pronto';

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
              const prefix = s > 0 ? '+' : '';
              ch.offsetEl.textContent = prefix + s.toFixed(3) + 's';
              ch.offsetEl.style.color = ui.colorByOffset(Math.abs(s));
            }
          }
        });
        refreshRealColumn();
        if (ML.chart && ML.chart.show) ML.chart.show(results);
        const errs = results.filter(r => r.error);
        statusEl.textContent = errs.length
          ? errs.map(r => r.label + ': ' + r.error).join(' | ')
          : 'Análise concluída';
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

    // ── Seção Tempo Real (botões + status) ─────────────────────
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

    // ── Resultados (tabela LOG) ────────────────────────────────
    const btnCopyInline = document.createElement('button');
    btnCopyInline.innerHTML = '\ud83d\udccb';
    btnCopyInline.title = 'Copiar tabela de resultados para a área de transferência';
    btnCopyInline.style.cssText = `background:transparent;border:1px solid ${ui.T.accentColor}44;color:${ui.T.accentColor};border-radius:3px;padding:0 4px;cursor:pointer;font-size:10px;line-height:14px`;
    btnCopyInline.addEventListener('mouseenter', () => btnCopyInline.style.background = ui.T.accentColor + '18');
    btnCopyInline.addEventListener('mouseleave', () => btnCopyInline.style.background = 'transparent');
    btnCopyInline.onclick = () => ui.copyResults(btnCopyInline);

    const secRes = ui.sec('Resultados', btnCopyInline);
    secRes.style.display = 'none';
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
      if (i === 0) return;
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid ${ui.T.rowBorder}`;
      ch._panelTr = tr;
      const tdName = document.createElement('td');
      tdName.textContent = ch.label;
      tdName.style.cssText = `color:${ch.color};padding:1px 2px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px`;
      ch._tdName = tdName;
      const tdOff = document.createElement('td');
      tdOff.textContent = '--';
      tdOff.style.cssText = `color:#aaaacc;padding:1px 4px;text-align:center;font-weight:bold`;
      ch.offsetEl = tdOff;
      const tdReal = document.createElement('td');
      tdReal.textContent = '--';
      tdReal.style.cssText = `color:#aaaacc;padding:1px 4px;text-align:center;font-weight:bold`;
      ch.realEl = tdReal;
      tr.append(tdName, tdOff, tdReal);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    secRes.appendChild(tbl);
    scrollBody.appendChild(secRes);

    const secSt = document.createElement('div');
    secSt.style.cssText = 'padding:3px 8px;flex-shrink:0;display:none';
    const statusElDisp = document.createElement('div');
    statusElDisp.style.cssText = `font-size:9px;color:${ui.T.statusColor};text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
    statusElDisp.textContent = 'Pronto';
    secSt.appendChild(statusElDisp);
    scrollBody.appendChild(secSt);
    panel.appendChild(scrollBody);

    const BASE_W = 340, BASE_H = 640;
    function applyScale(w, h) {
      const scale = Math.min(Math.max(0.7, Math.min(2.5, w / BASE_W)), h != null ? Math.max(1.0, Math.min(2.5, h / BASE_H)) : 2.5);
      panel.style.fontSize = Math.max(8, Math.round(11 * scale)) + 'px';
      const cols = w >= 320 ? 3 : w >= 220 ? 2 : 1;
      probeGrid.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      if (h != null) {
        secTG.style.display = h < 260 ? 'none' : '';
      }
    }
    ui.makeResizable(panel, { minW: 220, minH: 180, onResize: (w, h) => applyScale(w, h) });
    if (window.ResizeObserver) {
      new ResizeObserver(entries => {
        const { width: w, height: h } = entries[0].contentRect;
        applyScale(w, h);
      }).observe(panel);
    }

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
        if (ms === null) return { text: 'AGUARD.', color: '#555566', small: true };
        const s      = ms / 1000;
        const prefix = uncertain ? (s >= 0 ? '~+' : '~') : (s > 0 ? '+' : '');
        return { text: prefix + s.toFixed(3) + 's', color: uncertain ? '#667788' : ui.colorByOffset(Math.abs(s)), small: false };
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
        const realMs = offsetMs !== null ? calcRTReal(ch, offsetMs) : null;
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
        const alpha = r.alpha !== undefined ? r.alpha : null;
        ch._rtAlphaBadge.textContent = alpha !== null ? 'α=' + alpha.toFixed(2) : '';
        ch._rtAlphaBadge.style.color = alpha !== null && alpha < 0.7 ? '#ffd700' : '#aaaacc';
      }
    }

    function rtTick() {
      if (!ML.config.rtMode || !rtRunning) return;
      const results = ML.correlator.correlateRollingAll();
      results.forEach(r => {
        const ch = r.channel;
        if (!ch) return;
        updateRTCard(ch, r);
      });
      rtStatusEl.textContent = '\u25cf AO VIVO  \u2014  ' + new Date().toLocaleTimeString('pt-BR');
      rtStatusEl.style.color = '#00d4ff';
    }

    function resetRTState() {
      ML.CHANNELS.forEach(ch => {
        ch.buffer        = [];
        ch.rollingBuffer = [];
        ch._rtHistory    = [];
        ch._rtLastVal    = undefined;
        ch._rtLastConf   = undefined;
        ch.prevLum       = null;
        if (ch._rtVal)       { ch._rtVal.textContent = '--';     ch._rtVal.style.color = '#aaaacc'; ch._rtVal.style.opacity = '1'; }
        if (ch._rtValReal)   { ch._rtValReal.textContent = '--'; ch._rtValReal.style.color = '#aaaacc'; ch._rtValReal.style.opacity = '1'; }
        if (ch._rtConfBar)   { ch._rtConfBar.style.width = '0%'; }
        if (ch._rtHistBadge)  ch._rtHistBadge.textContent = '';
        if (ch._rtAlphaBadge) ch._rtAlphaBadge.textContent = '';
      });
    }

    btnRTStart.onclick = () => {
      if (rtRunning) return;
      resetRTState();
      ML.recorder.start();
      setRTRunning(true);
      if (rtIntervalId) clearInterval(rtIntervalId);
      rtIntervalId = setInterval(rtTick, ML.config.rtIntervalMs);
      rtStatusEl.textContent = 'Acumulando amostras...';
      rtStatusEl.style.color = '#aaaacc';
    };

    btnRTStop.onclick = () => {
      if (!rtRunning) return;
      clearInterval(rtIntervalId); rtIntervalId = null;
      ML.recorder.stop();
      setRTRunning(false);
      resetRTState();
      rtStatusEl.textContent = 'Parado';
      rtStatusEl.style.color = '#aaaacc';
    };

    btnRT.onclick = () => {
      ML.config.rtMode = !ML.config.rtMode;
      applyBtnRTStyle();
      applyRTVisibility();
      if (!ML.config.rtMode && rtRunning) {
        clearInterval(rtIntervalId); rtIntervalId = null;
        ML.recorder.stop();
        setRTRunning(false);
        resetRTState();
      }
    };

    ML.panel = {
      refreshOffsets(offsets) {
        ML.CHANNELS.forEach((ch, i) => {
          if (i === 0 || !ch.offsetEl) return;
          const totalMs = offsets[ch.id];
          if (totalMs == null) return;
          const s = totalMs / 1000;
          const prefix = s > 0 ? '+' : '';
          ch.offsetEl.textContent = prefix + s.toFixed(3) + 's';
          ch.offsetEl.style.color = ui.colorByOffset(Math.abs(s));
        });
        refreshRealColumn();
      },
    };

    document.body.appendChild(panel);
    panel.style.left = '4px';
    panel.style.top  = '4px';
    ui.minimizePanel(panel);

    ML.config.rtMode = true;
    applyBtnRTStyle();
    applyRTVisibility();

    // ── Atualização contínua de luminância nos cards ───────────
    setInterval(() => {
      ML.CHANNELS.forEach(ch => {
        if (!ch.active || !ch.lumEl) return;
        const s = ML.getSample ? ML.getSample(ch) : null;
        const y = s ? s.lum : (ML.getLum ? ML.getLum(ch) : null);
        if (y === null) {
          ch.lumEl.textContent = '--';
          ch.lumEl.style.color = ch.color;
          ch.lumEl.title = '';
        } else if (y === -1) {
          ch.lumEl.textContent = '\ud83d\udd12';
          ch.lumEl.style.color = '#ff4444';
          ch.lumEl.title = 'CORS bloqueado';
        } else {
          ch.lumEl.textContent = Math.round(y);
          ch.lumEl.style.color = ch.color;
          ch.lumEl.title = s ? `Y:${Math.round(s.lum)}  R:${Math.round(s.r)}  G:${Math.round(s.g)}  B:${Math.round(s.b)}` : 'Luminância atual da probe (0–255)';
        }
      });
    }, 200);

    // ── Progresso da gravação (modo LOG) ───────────────────────
    setInterval(() => {
      if (!ML.state.recording) return;
      if (ML.config.rtMode) return;
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

  console.log('[MedLat] 50-panel carregado. Cards unificados probe+RT. Seletor de telas: 2–12.');
})();
