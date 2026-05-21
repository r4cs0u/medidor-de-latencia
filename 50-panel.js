(function () {
  const ML = window.MedLat;

  function init() {
    ['ml-panel', 'ml-chart-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99999',
      'background:#0e0e1af2;border:1px solid #252535',
      'border-radius:6px',
      'box-shadow:0 3px 14px #000d',
      'font-family:monospace;font-size:10px;color:#bbb',
      'user-select:none;min-width:820px;max-width:98vw',
    ].join(';');

    // ── Header ───────────────────────────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.style.cssText = [
      'display:flex;justify-content:space-between;align-items:center',
      'padding:3px 8px 3px;cursor:move',
      'border-bottom:1px solid #1a1a2a',
      'background:#09091499;border-radius:6px 6px 0 0',
    ].join(';');

    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MEDIDOR DE LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:9px;letter-spacing:.08em';

    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.style.cssText = 'background:#c0334d;border:none;color:#fff;border-radius:3px;padding:0 5px;cursor:pointer;font-size:10px;line-height:15px';
    btnX.onclick = () => {
      ML.recorder.stop();
      document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove());
    };
    hdr.append(ttl, btnX);
    panel.appendChild(hdr);

    // drag
    let pdrag = false, pox = 0, poy = 0;
    hdr.addEventListener('mousedown', e => {
      pdrag = true;
      panel.style.transform = 'none';
      pox = e.clientX - panel.offsetLeft;
      poy = e.clientY - panel.offsetTop;
    });
    window.addEventListener('mousemove', e => {
      if (!pdrag) return;
      panel.style.left = Math.max(0, e.clientX - pox) + 'px';
      panel.style.top  = Math.max(0, e.clientY - poy) + 'px';
    });
    window.addEventListener('mouseup', () => pdrag = false);

    // ── Corpo ─────────────────────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;align-items:stretch';
    panel.appendChild(body);

    // helpers
    function col(minW) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;flex-direction:column;justify-content:center;gap:3px;padding:4px 8px;min-width:${minW}px;border-right:1px solid #1a1a2a`;
      return d;
    }
    function colHdr(txt) {
      const s = document.createElement('div');
      s.textContent = txt;
      s.style.cssText = 'font-size:7px;color:#444;letter-spacing:.1em;font-weight:bold;text-transform:uppercase;margin-bottom:1px';
      return s;
    }
    function mkBtn(txt, bg) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:1px solid ${bg}66;color:#ddd;border-radius:3px;padding:1px 6px;cursor:pointer;font-size:8px;font-family:monospace;font-weight:bold;white-space:nowrap`;
      return b;
    }
    function lbl(txt) {
      const s = document.createElement('span');
      s.textContent = txt;
      s.style.cssText = 'font-size:8px;color:#666;white-space:nowrap';
      return s;
    }
    function row(gap) {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;align-items:center;gap:${gap||3}px`;
      return d;
    }

    // ── Col 1: Telas ─────────────────────────────────────────────────────────────────
    const c1 = col(88);
    c1.appendChild(colHdr('Telas'));

    const qtLbl = lbl('Qt. Telas: --');
    setInterval(() => { qtLbl.textContent = 'Qt. Telas: ' + ML.CHANNELS.filter(c => c.active).length; }, 1000);
    qtLbl.textContent = 'Qt. Telas: ' + ML.CHANNELS.filter(c => c.active).length;

    const pxRow = row(2);
    pxRow.appendChild(lbl('PX'));
    const pxVal = document.createElement('span');
    pxVal.style.cssText = 'font-size:9px;color:#ddd;font-weight:bold;min-width:22px;text-align:center';
    pxVal.textContent = ML.state.probeW;
    const bM = mkBtn('\u2212', '#1a2f4a'), bP = mkBtn('+', '#1a2f4a');
    bM.onclick = () => { ML.state.probeW = Math.max(16, ML.state.probeW - 2); pxVal.textContent = ML.state.probeW; ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); }); };
    bP.onclick = () => { ML.state.probeW = Math.min(500, ML.state.probeW + 2); pxVal.textContent = ML.state.probeW; ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); }); };
    pxRow.append(bM, pxVal, bP);

    const bufRow = row(3);
    bufRow.appendChild(lbl('Buf'));
    const durSel = document.createElement('select');
    durSel.style.cssText = 'background:#15152a;border:1px solid #2a2a3a;color:#aaa;font-size:8px;border-radius:3px;padding:0 2px;flex:1';
    // 45s removido — instabilidade na correlação
    [5, 15, 30].forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=v+'s'; if(v===30) o.selected=true; durSel.appendChild(o); });
    durSel.onchange = () => { ML.BUFFER_SECONDS = parseInt(durSel.value); };
    bufRow.append(durSel);

    c1.append(qtLbl, pxRow, bufRow);
    body.appendChild(c1);

    // ── Col 2: Grid ─────────────────────────────────────────────────────────────────
    const c2 = col(82);
    c2.appendChild(colHdr('Grid'));

    const btnSnap = mkBtn('', '#0d4f3c');
    function updSnap() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229e SNAP ON' : '\u229f SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#222233';
      btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#555';
    }
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updSnap(); };
    updSnap();

    const btnCol2 = mkBtn('', '#3a1a0d');
    function updCol() {
      btnCol2.textContent = ML.state.noOverlap ? '\u26d4 COL ON' : '\u26aa COL OFF';
      btnCol2.style.background = ML.state.noOverlap ? '#3a1a0d' : '#222233';
      btnCol2.style.color = ML.state.noOverlap ? '#ff8844' : '#555';
    }
    btnCol2.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updCol(); };
    updCol();

    const gRow = row(3);
    gRow.appendChild(lbl('GRID'));
    const gInp = document.createElement('input');
    gInp.type='number'; gInp.min=2; gInp.max=100; gInp.step=2; gInp.value=ML.state.snapSize;
    gInp.style.cssText = 'background:#0f1520;border:1px solid #222f40;color:#8cc;font:bold 9px monospace;width:32px;border-radius:3px;padding:0 2px;text-align:center;outline:none';
    gInp.addEventListener('change', () => { ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gInp.value)||20)); gInp.value=ML.state.snapSize; });
    gInp.addEventListener('focus', () => gInp.style.borderColor='#00d4ff66');
    gInp.addEventListener('blur',  () => gInp.style.borderColor='#222f40');
    gRow.append(gInp, lbl('px'));

    c2.append(btnSnap, btnCol2, gRow);
    body.appendChild(c2);

    // ── Col 3+4: Detalhamento ─────────────────────────────────────────────────────────────
    const cDet = document.createElement('div');
    cDet.style.cssText = 'display:flex;flex-direction:column;padding:4px 8px;border-right:1px solid #1a1a2a;flex:1;min-width:380px';
    cDet.appendChild(colHdr('Detalhamento'));

    const chanGrid = document.createElement('div');
    chanGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:1px 6px';
    cDet.appendChild(chanGrid);

    function miniHdr() {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:center;font-size:7px;color:#3a3a50;margin-bottom:1px';
      [['flex:1',''], ['28px','Lum'], ['24px','pt'], ['46px','offset'], ['42px','conf']].forEach(([w, t]) => {
        const s = document.createElement('span');
        s.textContent = t;
        s.style.cssText = `${w.includes(':') ? w : 'width:'+w};text-align:right;${t?'text-decoration:underline':'flex:1'}`;
        r.appendChild(s);
      });
      return r;
    }

    function buildSubCol(idxs) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:1px';
      wrap.appendChild(miniHdr());
      idxs.forEach(i => {
        const ch = ML.CHANNELS[i];
        if (!ch) return;
        const isRef = (i === 0);

        const r = document.createElement('div');
        r.style.cssText = [
          'display:flex;align-items:center;padding:1px 2px;border-radius:3px',
          `border:1px solid ${ch.color}28`,
          `background:${ch.color}06`,
          `transition:opacity .2s;opacity:${ch.active ? 1 : .35}`,
        ].join(';');
        ch._panelRow = r;

        const tog = document.createElement('button');
        tog.style.cssText = `width:8px;height:8px;border-radius:50%;border:1.5px solid ${ch.color};background:${ch.active?ch.color:'transparent'};cursor:pointer;flex-shrink:0;padding:0;margin-right:3px`;
        tog.onclick = () => {
          ch.active = !ch.active;
          tog.style.background = ch.active ? ch.color : 'transparent';
          r.style.opacity = ch.active ? 1 : .35;
          ch.probe.style.display = ch.active ? 'block' : 'none';
          if (!ch.active) ch.prevLum = null;
        };

        const li = document.createElement('input');
        li.value = isRef ? '\u2605 ' + ch.label : ch.label;
        li.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 8px monospace;width:56px;outline:none;cursor:text;flex:1`;
        li.addEventListener('change', () => { ch.label = li.value.replace(/^\u2605\s*/,''); if(ch.probeLabel) ch.probeLabel.textContent=ch.label; });

        const lumEl = document.createElement('span');
        lumEl.style.cssText = `color:${ch.color};font-size:10px;font-weight:bold;width:28px;text-align:right`;
        lumEl.textContent = '--';
        ch.lumEl = lumEl;

        const ptsEl = document.createElement('span');
        ptsEl.style.cssText = 'color:#444;font-size:7px;width:24px;text-align:right';
        ptsEl.textContent = '0';
        ch.ptsEl = ptsEl;

        const offEl = document.createElement('span');
        offEl.style.cssText = 'color:#666;font-size:8px;width:46px;text-align:right;font-weight:bold';
        offEl.textContent = isRef ? '0.000s' : '--';
        ch.offsetEl = offEl;

        const confEl = document.createElement('span');
        confEl.style.cssText = 'color:#666;font-size:8px;width:42px;text-align:right';
        confEl.textContent = isRef ? '100%' : '--';
        ch.confEl = confEl;

        r.append(tog, li, lumEl, ptsEl, offEl, confEl);
        wrap.appendChild(r);
      });
      return wrap;
    }

    chanGrid.append(buildSubCol([0,1,3]), buildSubCol([2,4,5]));
    body.appendChild(cDet);

    // ── Col 5: Análise ─────────────────────────────────────────────────────────────────
    const cAn = document.createElement('div');
    cAn.style.cssText = 'display:flex;flex-direction:column;justify-content:center;gap:4px;padding:4px 8px;min-width:92px';
    cAn.appendChild(colHdr('Analise'));

    const btnRec = document.createElement('button');
    btnRec.style.cssText = 'background:#155215;border:1px solid #1a7a1a66;color:#9fef9f;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap';
    btnRec.textContent = '\u25cf GRAVAR';
    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25a0 PARAR';
        btnRec.style.background = '#521212';
        btnRec.style.borderColor = '#7a1a1a66';
        btnRec.style.color = '#ffaaaa';
        statusEl.textContent = 'Gravando...';
        statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        ML.CHANNELS.forEach(ch => {
          if (ch.offsetEl && ML.CHANNELS.indexOf(ch) !== 0) ch.offsetEl.textContent = '--';
          if (ch.confEl   && ML.CHANNELS.indexOf(ch) !== 0) ch.confEl.textContent = '--';
        });
      } else {
        ML.recorder.stop();
        btnRec.textContent = '\u25cf GRAVAR';
        btnRec.style.background = '#155215';
        btnRec.style.borderColor = '#1a7a1a66';
        btnRec.style.color = '#9fef9f';
        statusEl.textContent = 'Pronto (' + ML.CHANNELS.filter(c => c.active).map(c => c.buffer.length + 'pt').join(', ') + ')';
        statusEl.style.color = '#ffd700';
        btnAnalyze.disabled = false;
      }
    };

    const btnAnalyze = document.createElement('button');
    btnAnalyze.textContent = '\u26a1 ANALISAR';
    btnAnalyze.style.cssText = 'background:#112050;border:1px solid #1a3a7a66;color:#8ab4f8;border-radius:4px;padding:3px 8px;cursor:not-allowed;font-size:9px;font-family:monospace;font-weight:bold;opacity:.4;white-space:nowrap';
    btnAnalyze.onclick = async () => {
      statusEl.textContent = 'Calculando...';
      statusEl.style.color = '#aaa';
      const maxLagMs = parseInt(lagSel.value);
      const results = ML.correlator.analyzeAll(maxLagMs);
      results.forEach(r => {
        const ch = r.channel;
        if (!ch || r.isReference) return;
        if (ch.offsetEl) {
          if (r.skipped || r.error) { ch.offsetEl.textContent = r.error ? 'ERR' : '--'; ch.offsetEl.style.color = r.error ? '#ff4444' : '#444'; }
          else { const s = r.offsetMs/1000; const sg = s>0?'+':''; ch.offsetEl.textContent = sg+s.toFixed(3)+'s'; ch.offsetEl.style.color = Math.abs(s)<.1?'#44ff88':Math.abs(s)<1?'#ffd700':'#ff8844'; }
        }
        if (ch.confEl) {
          if (r.confidence != null && !r.error && !r.skipped) { ch.confEl.textContent = Math.round(r.confidence*100)+'%'; ch.confEl.style.color = r.confidence>.6?'#44ff88':r.confidence>.3?'#ffd700':'#ff4444'; }
          else ch.confEl.textContent = '--';
        }
      });
      const first = results.find(r => !r.isReference && !r.error && !r.skipped);
      if (first) { const r = ML.correlator.analyze(ML.CHANNELS[0], first.channel, maxLagMs); if (!r.error) ML.chart.show(r); }
      const errs = results.filter(r => r.error);
      statusEl.textContent = errs.length ? errs.map(r => r.label+': '+r.error).join(' | ') : 'An\u00e1lise conclu\u00edda';
      statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
    };
    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled=v; this.style.opacity=v?.4:1; this.style.cursor=v?'not-allowed':'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    const lagRow2 = row(3);
    lagRow2.appendChild(lbl('Max lag'));
    const lagSel = document.createElement('select');
    lagSel.style.cssText = 'background:#15152a;border:1px solid #2a2a3a;color:#aaa;font-size:8px;border-radius:3px;padding:0 2px;flex:1';
    // 45s removido — instabilidade na correlação
    [5000, 15000, 30000].forEach(v => { const o=document.createElement('option'); o.value=v; o.textContent=(v/1000)+'s'; if(v===30000) o.selected=true; lagSel.appendChild(o); });
    lagRow2.append(lagSel);

    cAn.append(btnRec, btnAnalyze, lagRow2);
    body.appendChild(cAn);

    // ── Status bar ───────────────────────────────────────────────────────────────────
    const statusEl = document.createElement('div');
    statusEl.style.cssText = [
      'font-size:8px;color:#555;padding:2px 10px 3px',
      'border-top:1px solid #1a1a2a;text-align:center;font-style:italic',
      'background:#07070f99;border-radius:0 0 6px 6px',
    ].join(';');
    statusEl.textContent = 'Posicione os probes nos v\u00eddeos e clique \u25cf GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl };

    setInterval(() => { ML.CHANNELS.forEach(ch => { if (ch.ptsEl) ch.ptsEl.textContent = ch.buffer.length; }); }, 1000);
    console.log('[MedLat] 50-panel carregado (slim).');
  }

  ML.panel = { init };
})();
