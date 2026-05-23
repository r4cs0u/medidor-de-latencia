
(function () {
  const ML = window.MedLat;

  function playDone() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[660, 0], [880, 0.15], [1100, 0.30]].forEach(([freq, t]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.2);
      });
    } catch(e) {}
  }

  /* ── Boas Práticas (toggle, arrastável) ──────────── */
  function showTips(anchorPanel) {
    const existing = document.getElementById('ml-tips');
    if (existing) { existing.remove(); return; }

    const TIPS = [
      ['🎯', 'Centralize as probes sobre a imagem'],
      ['📺', 'Grave durante o programa, nunca no intervalo'],
      ['⏱️', 'Não interrompa — aguarde o sinal sonoro (~2 min)'],
      ['🖥️', 'Evite processos pesados durante a gravação'],
    ];

    const tip = document.createElement('div');
    tip.id = 'ml-tips';
    tip.style.cssText = [
      'position:fixed;z-index:99998',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:10px;color:#ccc',
      'width:230px;overflow:hidden',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:4px 8px;gap:4px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:6px 6px 0 0;cursor:move',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '💡 Boas Práticas';
    htitle.style.cssText = 'color:#ffd700;font-weight:bold;font-size:9px;letter-spacing:.06em;flex:1;pointer-events:none';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.title = 'Fechar';
    btnClose.style.cssText = 'background:#c6282833;border:none;color:#ff8888;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';
    btnClose.onclick = () => tip.remove();
    hdr.append(htitle, btnClose);
    tip.appendChild(hdr);

    // drag
    let td=false,tx2=0,ty2=0;
    hdr.addEventListener('mousedown',e=>{if(e.target===btnClose)return;td=true;tx2=e.clientX-tip.offsetLeft;ty2=e.clientY-tip.offsetTop;});
    window.addEventListener('mousemove',e=>{if(!td)return;tip.style.left=Math.max(0,e.clientX-tx2)+'px';tip.style.top=Math.max(0,e.clientY-ty2)+'px';});
    window.addEventListener('mouseup',()=>td=false);

    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:5px';
    TIPS.forEach(([icon, text]) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:5px;line-height:1.35';
      const ic = document.createElement('span');
      ic.textContent = icon;
      ic.style.cssText = 'font-size:11px;flex-shrink:0;margin-top:1px';
      const tx = document.createElement('span');
      tx.textContent = text;
      tx.style.cssText = 'font-size:9px;color:#fff';
      row.append(ic, tx);
      body.appendChild(row);
    });
    tip.appendChild(body);
    document.body.appendChild(tip);

    function reposition() {
      const pr      = anchorPanel.getBoundingClientRect();
      const tipH    = tip.offsetHeight;
      const tipW    = tip.offsetWidth;
      const vw      = window.innerWidth;
      const vh      = window.innerHeight;
      const margin  = 6;
      let top  = pr.bottom + margin;
      if (top + tipH > vh - margin) top = Math.max(margin, pr.top - tipH - margin);
      let left = pr.left;
      if (left + tipW > vw - margin) left = vw - tipW - margin;
      if (left < margin) left = margin;
      tip.style.top  = top  + 'px';
      tip.style.left = left + 'px';
    }

    requestAnimationFrame(reposition);
  }

  /* ── Instruções de Uso (toggle, arrastável) ──────── */
  function showInstructions(anchorPanel) {
    const existing = document.getElementById('ml-instructions');
    if (existing) { existing.remove(); return; }

    const STEPS = [
      { section: '⚙️ PREPARAÇÃO', items: [
        '① Defina a quantidade de telas (probes)',
        '② Ajuste o tamanho global ou por tela (px)',
        '③ Posicione cada probe sobre o vídeo — mouse ou setas',
        '④ Selecione o lag estimado por tela: Até 5s ou Maior que 5s',
      ]},
      { section: '⏺ GRAVAÇÃO', items: [
        '⑤ Clique em ● GRAVAR — aguarde o sinal sonoro (~2 min)',
      ]},
      { section: '📊 ANÁLISE', items: [
        '⑥ A latência estimada é exibida por tela automaticamente',
        '⑦ Ajuste fino: clique em Manual e mova as réguas',
        '⑧ Alinhe os picos tracejados (linhas grossas) entre os sinais',
        '⑨ Ajuste a quantidade de picos visíveis em Picos',
        '⑩ Clique em ✔ Confirmar para exportar e copiar os resultados',
      ]},
    ];

    const win = document.createElement('div');
    win.id = 'ml-instructions';
    win.style.cssText = [
      'position:fixed;z-index:99998',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;color:#ccc',
      'width:250px;overflow:hidden',
    ].join(';');

    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;padding:4px 8px;gap:4px',
      'background:#1a1a2e;border-bottom:1px solid #1e1e3a',
      'border-radius:6px 6px 0 0;cursor:move',
    ].join(';');
    const htitle = document.createElement('span');
    htitle.textContent = '📋 Como usar';
    htitle.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:9px;letter-spacing:.06em;flex:1;pointer-events:none';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕';
    btnClose.title = 'Fechar';
    btnClose.style.cssText = 'background:#c6282833;border:none;color:#ff8888;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:16px;flex-shrink:0';
    btnClose.onclick = () => win.remove();
    hdr.append(htitle, btnClose);
    win.appendChild(hdr);

    // drag
    let id2=false,ix=0,iy=0;
    hdr.addEventListener('mousedown',e=>{if(e.target===btnClose)return;id2=true;ix=e.clientX-win.offsetLeft;iy=e.clientY-win.offsetTop;});
    window.addEventListener('mousemove',e=>{if(!id2)return;win.style.left=Math.max(0,e.clientX-ix)+'px';win.style.top=Math.max(0,e.clientY-iy)+'px';});
    window.addEventListener('mouseup',()=>id2=false);

    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:6px';

    STEPS.forEach(({ section, items }) => {
      const secDiv = document.createElement('div');
      const secLbl = document.createElement('div');
      secLbl.textContent = section;
      secLbl.style.cssText = 'font-size:8px;font-weight:bold;color:#ffd700;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #2a2a4a;padding-bottom:3px;margin-bottom:4px';
      secDiv.appendChild(secLbl);
      items.forEach(txt => {
        const item = document.createElement('div');
        item.textContent = txt;
        item.style.cssText = 'font-size:9px;color:#ddd;line-height:1.5;padding-left:2px';
        secDiv.appendChild(item);
      });
      body.appendChild(secDiv);
    });

    win.appendChild(body);
    document.body.appendChild(win);

    function reposition() {
      const pr  = anchorPanel.getBoundingClientRect();
      const wH  = win.offsetHeight;
      const wW  = win.offsetWidth;
      const vw  = window.innerWidth;
      const vh  = window.innerHeight;
      const mg  = 6;
      let top  = pr.bottom + mg;
      if (top + wH > vh - mg) top = Math.max(mg, pr.top - wH - mg);
      let left = pr.left;
      if (left + wW > vw - mg) left = vw - wW - mg;
      if (left < mg) left = mg;
      win.style.top  = top  + 'px';
      win.style.left = left + 'px';
    }

    requestAnimationFrame(reposition);
  }

  function init() {
    ['ml-panel', 'ml-chart-overlay', 'ml-tips', 'ml-instructions'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:8px;right:8px;z-index:99999',
      'background:#12121fee;border:1px solid #2a2a4a',
      'border-radius:6px;box-shadow:0 4px 24px #000c',
      'font-family:monospace;font-size:11px;color:#fff',
      'user-select:none;width:230px;overflow:hidden',
    ].join(';');

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;align-items:center;gap:4px;overflow:hidden',
      'padding:4px 8px;cursor:move',
      'border-bottom:1px solid #1e1e3a',
      'background:#1a1a2e;border-radius:6px 6px 0 0',
    ].join(';');
    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MED. LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0';

    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.title = 'Fechar tudo';
    btnX.style.cssText = 'background:#c62828;border:none;color:#fff;border-radius:3px;padding:0 6px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnX.onclick = () => { ML.recorder.stop(); document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove()); };

    const btnTips = document.createElement('button');
    btnTips.textContent = '💡';
    btnTips.title = 'Boas Práticas';
    btnTips.style.cssText = 'background:#2a2a1a;border:1px solid #ffd70044;color:#ffd700;border-radius:3px;padding:0 5px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnTips.onclick = (e) => { e.stopPropagation(); showTips(panel); };

    const btnInstr = document.createElement('button');
    btnInstr.textContent = '📋';
    btnInstr.title = 'Como usar';
    btnInstr.style.cssText = 'background:#1a2a2a;border:1px solid #00d4ff44;color:#00d4ff;border-radius:3px;padding:0 5px;cursor:pointer;font-size:11px;line-height:17px;flex-shrink:0';
    btnInstr.onclick = (e) => { e.stopPropagation(); showInstructions(panel); };

    hdr.append(ttl, btnTips, btnInstr, btnX);
    panel.appendChild(hdr);

    // Drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => { pdrag = true; panel.style.right = 'auto'; pox = e.clientX - panel.offsetLeft; poy = e.clientY - panel.offsetTop; });
    window.addEventListener('mousemove', e => { if (!pdrag) return; panel.style.left = Math.max(0, e.clientX - pox) + 'px'; panel.style.top = Math.max(0, e.clientY - poy) + 'px'; });
    window.addEventListener('mouseup', () => pdrag = false);

    // Helpers
    function sec(label) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:4px 8px;border-bottom:1px solid #1a1a30';
      const lh = document.createElement('div');
      lh.textContent = label;
      lh.style.cssText = 'font-size:7px;color:#fff;letter-spacing:.12em;font-weight:bold;text-transform:uppercase;border-bottom:1px solid #1a1a30;padding-bottom:2px;margin-bottom:4px';
      wrap.appendChild(lh);
      return wrap;
    }
    function row(gap) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;align-items:center;gap:${gap||4}px;overflow:hidden`;
      return d;
    }
    function sp(txt, extra) {
      const s = document.createElement('span');
      s.textContent = txt;
      s.style.cssText = 'font-size:9px;color:#fff;white-space:nowrap;' + (extra || '');
      return s;
    }
    function mkBtn(txt, bg, extra) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}55;color:#fff;border-radius:3px;padding:2px 6px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;${extra||''}`;
      return b;
    }
    function mkNum(val, min, max, step, w) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      inp.style.cssText = `background:#111827;border:1px solid #2a3a50;color:#00d4ff;font:bold 10px monospace;width:${w}px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield`;
      inp.addEventListener('focus', () => inp.style.borderColor = '#00d4ff88');
      inp.addEventListener('blur',  () => inp.style.borderColor = '#2a3a50');
      return inp;
    }

    function mkLagSelect(ch) {
      const sel = document.createElement('select');
      sel.style.cssText = [
        'background:#111827;border:1px solid #2a3a50;color:#fff',
        'font:bold 8px monospace;border-radius:3px;padding:1px 2px',
        'cursor:pointer;outline:none;flex-shrink:0',
      ].join(';');
      const opts = [
        { value: 'auto',     label: 'Auto' },
        { value: 'rapido',   label: 'Até 5s' },
        { value: 'internet', label: 'Maior que 5s' },
      ];
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        if ((ch.lagPreset || 'auto') === o.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        ch.lagPreset = sel.value;
        sel.style.borderColor = sel.value === 'auto' ? '#2a3a50' : '#ffd70088';
        sel.style.color       = sel.value === 'auto' ? '#fff'    : '#ffd700';
      });
      if ((ch.lagPreset || 'auto') !== 'auto') {
        sel.style.borderColor = '#ffd70088';
        sel.style.color       = '#ffd700';
      }
      return sel;
    }

    /* ── Seção: Telas & Grid ── */
    const secTG = sec('Telas & Grid');

    const pxInp = mkNum(ML.state.probeW, 16, 500, 2, 48);
    function applyGlobalPx(v) {
      const c = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
      ML.state.probeW = c; pxInp.value = c;
      ML.CHANNELS.forEach(ch => { if (ch.probeW == null) { if (ch._szInp) ch._szInp.value = c; if (ch.active && ch.resize) ch.resize(); } });
    }
    const btnPxM = mkBtn('\u2212', '#1e2a3a', 'padding:2px 5px');
    const btnPxP = mkBtn('+', '#1e2a3a', 'padding:2px 5px');
    btnPxM.onclick = () => applyGlobalPx(ML.state.probeW - 2);
    btnPxP.onclick = () => applyGlobalPx(ML.state.probeW + 2);
    pxInp.addEventListener('change', () => applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW));
    pxInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyGlobalPx(parseInt(pxInp.value) || ML.state.probeW); pxInp.blur(); } });
    const rowPx = row(4);
    rowPx.append(sp('PX Global', 'flex-shrink:0'), btnPxM, pxInp, btnPxP);
    secTG.appendChild(rowPx);

    const cntInp = mkNum(ML.CHANNELS.filter(c => c.active).length, 1, ML.CHANNELS.length, 1, 38);
    function applyCount(n) {
      const c = Math.max(1, Math.min(ML.CHANNELS.length, n));
      cntInp.value = c;
      ML.CHANNELS.forEach((ch, i) => {
        const want = i < c;
        if (want && !ch.active) { ch.active = true; ch.show(); }
        else if (!want && ch.active) { ch.active = false; ch.hide(); }
      });
      renderChannelRows();
    }
    const btnCntM = mkBtn('\u2212', '#1e2a3a', 'padding:2px 5px');
    const btnCntP = mkBtn('+', '#1e2a3a', 'padding:2px 5px');
    btnCntM.onclick = () => applyCount((parseInt(cntInp.value) || 1) - 1);
    btnCntP.onclick = () => applyCount((parseInt(cntInp.value) || 1) + 1);
    cntInp.addEventListener('change', () => applyCount(parseInt(cntInp.value) || 1));
    cntInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyCount(parseInt(cntInp.value) || 1); cntInp.blur(); } });
    const rowCnt = row(4);
    rowCnt.append(sp('Telas', 'flex-shrink:0'), btnCntM, cntInp, btnCntP);
    secTG.appendChild(rowCnt);

    panel.appendChild(secTG);

    /* ── Seção: Detalhes por canal ── */
    const secDet = sec('Detalhes');
    function renderChannelRows() {
      while (secDet.children.length > 1) secDet.removeChild(secDet.lastChild);
      ML.CHANNELS.forEach((ch, i) => {
        if (!ch.active) return;
        const chWrap = document.createElement('div');
        chWrap.style.cssText = `border-bottom:1px solid ${ch.color}22;padding:3px 0 3px 0`;

        // Linha 1: toggle | label | px [−] [inp] [+]
        const r1 = row(3);
        r1.style.overflow = 'hidden';

        const tog = document.createElement('div');
        tog.style.cssText = `width:8px;height:8px;border-radius:50%;background:${ch.color};flex-shrink:0;cursor:pointer`;
        tog.title = `${ch.label} – clique para mostrar/ocultar probe`;
        tog.onclick = () => {
          ch._probeVisible = !ch._probeVisible;
          if (ch._probeEl) ch._probeEl.style.display = ch._probeVisible === false ? 'none' : '';
          tog.style.opacity = ch._probeVisible === false ? '0.35' : '1';
        };

        const lblInp = document.createElement('input');
        lblInp.type = 'text';
        lblInp.value = ch.label;
        lblInp.title = 'Nome do canal (clique para editar)';
        lblInp.style.cssText = `background:transparent;border:none;border-bottom:1px solid ${ch.color}55;color:${ch.color};font:bold 9px monospace;width:0;flex:1;min-width:0;outline:none;padding:0 2px`;
        lblInp.addEventListener('change', () => { ch.label = lblInp.value.trim() || ch.label; if (ch._tdName) ch._tdName.textContent = (i===0?'\u2605 ':'') + ch.label; });

        const szInp = mkNum(ch.probeW != null ? ch.probeW : ML.state.probeW, 16, 500, 2, 42);
        ch._szInp = szInp;
        function applySz(v) {
          const c2 = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
          ch.probeW = c2; szInp.value = c2;
          if (ch.active && ch.resize) ch.resize();
        }
        const szM = mkBtn('\u2212', '#1e2a3a', 'padding:1px 4px;font-size:9px');
        const szP = mkBtn('+', '#1e2a3a', 'padding:1px 4px;font-size:9px');
        szM.onclick = () => applySz((parseInt(szInp.value) || ML.state.probeW) - 2);
        szP.onclick = () => applySz((parseInt(szInp.value) || ML.state.probeW) + 2);
        szInp.addEventListener('change', () => applySz(parseInt(szInp.value) || ML.state.probeW));
        szInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applySz(parseInt(szInp.value) || ML.state.probeW); szInp.blur(); } });

        r1.append(tog, lblInp, sp('px','font-size:8px;color:#fff;flex-shrink:0'), szM, szInp, szP);

        // Linha 2: lag [select] | spacer | lum | pts
        const r2 = row(4);

        const lumEl = document.createElement('span');
        lumEl.style.cssText = `color:${ch.color};font-size:12px;font-weight:bold;width:22px;text-align:right;flex-shrink:0`;
        lumEl.textContent = '--'; ch.lumEl = lumEl;

        const ptsEl = document.createElement('span');
        ptsEl.style.cssText = 'color:#fff;font-size:8px;width:26px;text-align:right;flex-shrink:0;white-space:nowrap';
        ptsEl.textContent = '0pt'; ch.ptsEl = ptsEl;

        const spacer = document.createElement('span');
        spacer.style.cssText = 'flex:1';

        if (i !== 0) {
          const lagSel = mkLagSelect(ch);
          r2.append(sp('lag','font-size:8px;color:#fff;flex-shrink:0'), lagSel, spacer, lumEl, ptsEl);
        } else {
          r2.append(spacer, lumEl, ptsEl);
        }

        chWrap.append(r1, r2);
        secDet.appendChild(chWrap);
      });
    }
    renderChannelRows();
    panel.appendChild(secDet);

    /* ── Seção: Resultados ── */
    const secRes = sec('Resultados vs Refer\u00eancia');
    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:9px';
    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    ['Tela','Offset'].forEach((h, hi) => {
      const th = document.createElement('th');
      th.textContent = h;
      th.style.cssText = 'color:#fff;font-weight:bold;font-size:7px;letter-spacing:.08em;text-transform:uppercase;padding:1px 3px;text-align:' + (hi===0?'left':'right') + ';border-bottom:1px solid #1a1a30';
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    tbl.appendChild(thead);
    const tbody = document.createElement('tbody');
    ML.CHANNELS.forEach((ch, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid ${ch.color}22`;
      const tdName = document.createElement('td');
      tdName.style.cssText = `color:${ch.color};font-weight:bold;padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70px`;
      tdName.textContent = (i===0?'\u2605 ':'') + ch.label;
      ch._tdName = tdName;
      const tdOff = document.createElement('td');
      tdOff.style.cssText = 'text-align:right;padding:2px 3px;font-weight:bold;font-size:10px;white-space:nowrap';
      tdOff.textContent  = i===0 ? '0.000s' : '--';
      tdOff.style.color  = i===0 ? '#44ff88' : '#fff';
      ch.offsetEl = tdOff;
      tr.append(tdName, tdOff);
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    secRes.appendChild(tbl);
    panel.appendChild(secRes);

    /* ── Seção: Analise ── */
    const secAn = sec('Analise');
    const btnRec     = mkBtn('\u25cf GRAVAR',   '#1b5e20', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;box-shadow:0 0 8px #1b5e2066');
    const btnAnalyze = mkBtn('\u26a1 ANALISAR', '#4a148c', 'flex:1;padding:5px 0;font-size:11px;letter-spacing:.04em;color:#ce93d8;opacity:.45');

    function doStop() {
      ML.recorder.stop();
      playDone();
      btnRec.textContent = '\u25cf GRAVAR';
      btnRec.style.background = '#1b5e20'; btnRec.style.borderColor = '#2e7d3288'; btnRec.style.boxShadow = '0 0 8px #1b5e2066';
      const pts = ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ');
      statusEl.textContent = 'Pronto (' + pts + ')';
      statusEl.style.color = '#ffd700';
      btnAnalyze.disabled = false;
      // Abre análise automaticamente após parar gravação
      setTimeout(() => btnAnalyze.onclick(), 300);
    }

    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#7f0000'; btnRec.style.borderColor = '#c6282888'; btnRec.style.boxShadow = '0 0 8px #c6282855';
        statusEl.textContent = 'Gravando...'; statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach((ch, i) => {
          ch._prevPts   = 0;
          ch._stableCnt = 0;
          if (ch.ptsEl) { ch.ptsEl.textContent = '0pt'; ch.ptsEl.style.color = '#fff'; }
          if (i !== 0) {
            if (ch.offsetEl) { ch.offsetEl.textContent = '--'; ch.offsetEl.style.color = '#fff'; }
          }
        });
      } else {
        doStop();
      }
    };

    btnAnalyze.onclick = () => {
      statusEl.textContent = 'Calculando...'; statusEl.style.color = '#fff';
      setTimeout(() => {
        const results = ML.correlator.analyzeBestAll();
        results.forEach(r => {
          const ch = r.channel;
          if (!ch || r.isReference) return;
          if (ch.offsetEl) {
            if (r.skipped || r.error) {
              ch.offsetEl.textContent = r.error ? 'ERRO' : '--';
              ch.offsetEl.style.color = r.error ? '#ff4444' : '#fff';
            } else {
              const s = r.offsetMs / 1000;
              ch.offsetEl.textContent = (s > 0 ? '+' : '') + s.toFixed(3) + 's';
              ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
            }
          }
        });
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

    const rowBtns = row(6); rowBtns.style.marginBottom = '5px';
    rowBtns.append(btnRec, btnAnalyze);
    secAn.appendChild(rowBtns);
    panel.appendChild(secAn);

    /* Status */
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:9px;color:#fff;padding:3px 8px 4px',
      'border-top:1px solid #1a1a30;text-align:center;font-style:italic',
      'background:#0e0e1a;border-radius:0 0 6px 6px',
      'overflow:hidden;white-space:nowrap;text-overflow:ellipsis',
    ].join(';');
    statusEl.textContent = 'Posicione os probes e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl, doStop };

    ML.panel.refreshOffsets = function(offsets) {
      ML.CHANNELS.forEach((ch, i) => {
        if (i === 0 || !offsets[ch.id]) return;
        if (!ch.offsetEl) return;
        const s = offsets[ch.id] / 1000;
        ch.offsetEl.textContent = (s >= 0 ? '+' : '') + s.toFixed(3) + 's';
        ch.offsetEl.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
      });
    };

    const STABLE_TICKS = 3;
    setInterval(() => {
      const activeChannels = ML.CHANNELS.filter(c => c.active);
      let allOk = activeChannels.length > 0;
      activeChannels.forEach(ch => {
        const pts = ch.buffer.length;
        if (ch.ptsEl) {
          if (ch._stableCnt >= STABLE_TICKS) {
            ch.ptsEl.textContent = '\u2713OK';
            ch.ptsEl.style.color = '#44ff88';
          } else {
            ch.ptsEl.textContent = pts + 'pt';
            ch.ptsEl.style.color = '#fff';
          }
        }
        if (!ML.state.recording) { ch._prevPts = pts; ch._stableCnt = 0; return; }
        if (pts === 0) { allOk = false; return; }
        if (pts === ch._prevPts) {
          ch._stableCnt = (ch._stableCnt || 0) + 1;
        } else {
          ch._stableCnt = 0;
          ch._prevPts   = pts;
        }
        if (ch._stableCnt < STABLE_TICKS) allOk = false;
      });
      if (ML.state.recording && allOk && activeChannels.length > 0) {
        console.log('[MedLat] Buffer estabilizado. Auto-stop.');
        doStop();
      }
    }, 1000);

    console.log('[MedLat] 50-panel carregado.');
  }

  ML.panel = { init };
})();
