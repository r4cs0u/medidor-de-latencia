(function () {
  const ML = window.MedLat;

  function fmt(ts) {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2,'0') + ':' +
           d.getMinutes().toString().padStart(2,'0') + ':' +
           d.getSeconds().toString().padStart(2,'0') + '.' +
           d.getMilliseconds().toString().padStart(3,'0');
  }

  function init() {
    ['ml-panel', 'ml-chart-overlay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    const panel = document.createElement('div');
    panel.id = 'ml-panel';
    panel.style.cssText = [
      'position:fixed;top:10px;right:10px;z-index:99999',
      'background:#0e0e1aee;border:1px solid #2a2a3a',
      'border-radius:8px;padding:8px 12px',
      'box-shadow:0 4px 16px #000c',
      'font-family:monospace;font-size:11px;color:#ccc',
      'width:340px;user-select:none',
    ].join(';');

    // Header arrastável
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:move';
    const ttl = document.createElement('span');
    ttl.textContent = '\uD83D\uDCE1 MEDIDOR DE LAT\u00CANCIA';
    ttl.style.cssText = 'color:#00d4ff;font-weight:bold;font-size:10px';
    const btnX = document.createElement('button');
    btnX.textContent = '\u2715';
    btnX.style.cssText = 'background:#e94560;border:none;color:#fff;border-radius:4px;padding:0 6px;cursor:pointer;font-size:11px';
    btnX.onclick = () => {
      ML.recorder.stop();
      document.querySelectorAll('[id^="ml-"]').forEach(e => e.remove());
    };
    hdr.append(ttl, btnX);
    panel.appendChild(hdr);

    let pdrag=false, pox=0, poy=0;
    hdr.addEventListener('mousedown', e => { pdrag=true; pox=e.clientX-panel.offsetLeft; poy=e.clientY-panel.offsetTop; });
    window.addEventListener('mousemove', e => { if(!pdrag) return; panel.style.right='auto'; panel.style.left=Math.max(0,e.clientX-pox)+'px'; panel.style.top=Math.max(0,e.clientY-poy)+'px'; });
    window.addEventListener('mouseup', () => pdrag=false);

    // Linha 1: Global W + Buffer + Gravar
    const ctrlRow = document.createElement('div');
    ctrlRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid #1e1e30';

    function mkBtn(txt, bg, cb) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.style.cssText = `background:${bg};border:none;color:#fff;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:12px;font-family:monospace`;
      b.onclick = cb;
      return b;
    }

    const szLabel = document.createElement('span');
    szLabel.textContent = 'Global W:';
    szLabel.style.cssText = 'font-size:9px;color:#888;white-space:nowrap';

    const szVal = document.createElement('span');
    szVal.style.cssText = 'font-size:11px;color:#fff;min-width:32px;text-align:center;font-weight:bold';
    szVal.textContent = ML.state.probeW + 'px';

    const btnMinus = mkBtn('\u2212', '#1e3a5f', () => {
      ML.state.probeW = Math.max(16, ML.state.probeW - 2);
      szVal.textContent = ML.state.probeW + 'px';
      ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); });
    });
    const btnPlus = mkBtn('+', '#1e3a5f', () => {
      ML.state.probeW = Math.min(500, ML.state.probeW + 2);
      szVal.textContent = ML.state.probeW + 'px';
      ML.CHANNELS.forEach(ch => { if (ch.active && ch.resize && ch.probeW == null) ch.resize(); });
    });

    const durLabel = document.createElement('span');
    durLabel.textContent = 'Buf:';
    durLabel.style.cssText = 'font-size:9px;color:#888;white-space:nowrap;margin-left:4px';
    const durSel = document.createElement('select');
    durSel.style.cssText = 'background:#1e1e30;border:1px solid #333;color:#ccc;font-size:9px;border-radius:3px;padding:1px 2px';
    // Opções: 5, 15, 30s (45s removido — instabilidade na correlação)
    [5, 15, 30].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v + 's';
      if (v === 30) o.selected = true;
      durSel.appendChild(o);
    });
    durSel.onchange = () => { ML.BUFFER_SECONDS = parseInt(durSel.value); };

    const btnRec = document.createElement('button');
    btnRec.style.cssText = 'margin-left:auto;background:#1a7a1a;border:none;color:#fff;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;box-shadow:0 0 6px #1a7a1a88';
    btnRec.textContent = '\u25CF GRAVAR';
    btnRec.onclick = () => {
      if (!ML.state.recording) {
        ML.recorder.start();
        btnRec.textContent = '\u25A0 PARAR';
        btnRec.style.background = '#7a1a1a';
        btnRec.style.boxShadow = '0 0 6px #7a1a1a88';
        statusEl.textContent = 'Gravando...';
        statusEl.style.color = '#44ff88';
        btnAnalyze.disabled = true;
        clearResultsTable();
      } else {
        ML.recorder.stop();
        btnRec.textContent = '\u25CF GRAVAR';
        btnRec.style.background = '#1a7a1a';
        btnRec.style.boxShadow = '0 0 6px #1a7a1a88';
        statusEl.textContent = 'Pronto para analisar (' + ML.CHANNELS.filter(c=>c.active).map(c=>c.buffer.length+' pts').join(', ') + ')';
        statusEl.style.color = '#ffd700';
        btnAnalyze.disabled = false;
      }
    };

    ctrlRow.append(szLabel, btnMinus, szVal, btnPlus, durLabel, durSel, btnRec);
    panel.appendChild(ctrlRow);

    // Linha 2: Snap
    const snapRow = document.createElement('div');
    snapRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;padding-bottom:7px;border-bottom:1px solid #1e1e30';

    const btnSnap = document.createElement('button');
    function updateSnapBtn() {
      btnSnap.textContent = ML.state.snapGrid ? '\u229E SNAP ON' : '\u229F SNAP OFF';
      btnSnap.style.background = ML.state.snapGrid ? '#0d4f3c' : '#2a2a3a';
      btnSnap.style.color = ML.state.snapGrid ? '#44ff88' : '#888';
      btnSnap.style.boxShadow = ML.state.snapGrid ? '0 0 5px #44ff8855' : 'none';
    }
    btnSnap.style.cssText = 'border:1px solid #333;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap';
    btnSnap.onclick = () => { ML.state.snapGrid = !ML.state.snapGrid; updateSnapBtn(); };
    updateSnapBtn();

    const gridLabel = document.createElement('span');
    gridLabel.textContent = 'Grid:';
    gridLabel.style.cssText = 'font-size:9px;color:#888;white-space:nowrap';

    const gridInput = document.createElement('input');
    gridInput.type = 'number';
    gridInput.min = 2; gridInput.max = 100; gridInput.step = 2;
    gridInput.value = ML.state.snapSize;
    gridInput.style.cssText = 'background:#111827;border:1px solid #2a3a50;color:#aed6f1;font:bold 10px monospace;width:36px;border-radius:3px;padding:1px 3px;text-align:center;outline:none';
    gridInput.addEventListener('change', () => {
      ML.state.snapSize = Math.max(2, Math.min(100, parseInt(gridInput.value) || 20));
      gridInput.value = ML.state.snapSize;
    });
    gridInput.addEventListener('focus', () => gridInput.style.borderColor = '#00d4ff88');
    gridInput.addEventListener('blur',  () => gridInput.style.borderColor = '#2a3a50');
    const gridPx = document.createElement('span');
    gridPx.textContent = 'px';
    gridPx.style.cssText = 'font-size:9px;color:#556';

    const btnCol = document.createElement('button');
    function updateColBtn() {
      btnCol.textContent = ML.state.noOverlap ? '\u26D4 COL ON' : '\u26AA COL OFF';
      btnCol.style.background = ML.state.noOverlap ? '#3a1a0d' : '#2a2a3a';
      btnCol.style.color = ML.state.noOverlap ? '#ff8844' : '#888';
      btnCol.style.boxShadow = ML.state.noOverlap ? '0 0 5px #ff884455' : 'none';
    }
    btnCol.style.cssText = 'border:1px solid #333;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:9px;font-family:monospace;font-weight:bold;white-space:nowrap;margin-left:auto';
    btnCol.onclick = () => { ML.state.noOverlap = !ML.state.noOverlap; updateColBtn(); };
    updateColBtn();

    snapRow.append(btnSnap, gridLabel, gridInput, gridPx, btnCol);
    panel.appendChild(snapRow);

    // Grid de canais
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px';

    ML.CHANNELS.forEach(ch => {
      const row = document.createElement('div');
      row.style.cssText = [
        'display:flex;align-items:center;gap:5px;padding:3px 4px;border-radius:5px',
        `border:1px solid ${ch.active ? ch.color+'55' : '#1e1e30'}`,
        `background:${ch.active ? ch.color+'0a' : 'transparent'}`,
        `transition:all .2s;opacity:${ch.active ? 1 : .45}`,
      ].join(';');

      const tog = document.createElement('button');
      tog.style.cssText = `width:14px;height:14px;border-radius:50%;border:2px solid ${ch.color};background:${ch.active?ch.color:'transparent'};cursor:pointer;flex-shrink:0;padding:0`;
      tog.title = 'Ativar/desativar';
      tog.onclick = () => {
        ch.active = !ch.active;
        tog.style.background = ch.active ? ch.color : 'transparent';
        row.style.border     = `1px solid ${ch.active ? ch.color+'55' : '#1e1e30'}`;
        row.style.background = ch.active ? ch.color+'0a' : 'transparent';
        row.style.opacity    = ch.active ? 1 : .45;
        ch.probe.style.display = ch.active ? 'block' : 'none';
        if (!ch.active) ch.prevLum = null;
      };

      const lbl = document.createElement('input');
      lbl.value = ch.label;
      lbl.style.cssText = `background:transparent;border:none;color:${ch.color};font:bold 10px monospace;width:78px;outline:none;cursor:text;flex-shrink:0`;
      lbl.addEventListener('change', () => {
        ch.label = lbl.value;
        if (ch.probeLabel) ch.probeLabel.textContent = lbl.value;
      });

      const szWrap = document.createElement('div');
      szWrap.style.cssText = 'display:flex;align-items:center;gap:1px;flex-shrink:0';

      const szInput = document.createElement('input');
      szInput.type = 'number'; szInput.min = 16; szInput.max = 500; szInput.step = 2;
      szInput.value = ch.probeW != null ? ch.probeW : ML.state.probeW;
      szInput.title = 'Largura do probe (16\u2013500px). Altura calculada em 16:9.';
      szInput.style.cssText = 'background:#111827;border:1px solid #2a3a50;color:#aed6f1;font:bold 10px monospace;width:40px;border-radius:3px;padding:1px 3px;text-align:center;outline:none;-moz-appearance:textfield';
      szInput.addEventListener('focus', () => szInput.style.borderColor = '#00d4ff88');
      szInput.addEventListener('blur',  () => szInput.style.borderColor = '#2a3a50');

      const szPxLbl = document.createElement('span');
      const initH = Math.round((ch.probeW != null ? ch.probeW : ML.state.probeW) * (9/16));
      szPxLbl.textContent = 'px (' + initH + 'h)';
      szPxLbl.style.cssText = 'font-size:8px;color:#556;white-space:nowrap;margin-left:2px';

      function applySize(v) {
        const clamped = Math.max(16, Math.min(500, Math.round(v / 2) * 2));
        szInput.value = clamped;
        ch.probeW = clamped;
        if (ch.active && ch.resize) ch.resize();
        szPxLbl.textContent = 'px (' + Math.round(clamped * (9/16)) + 'h)';
      }
      szInput.addEventListener('change', () => applySize(parseInt(szInput.value) || ML.state.probeW));
      szInput.addEventListener('keydown', e => {
        if (e.key === 'ArrowUp')   { e.preventDefault(); applySize((parseInt(szInput.value)||16) + 2); }
        if (e.key === 'ArrowDown') { e.preventDefault(); applySize((parseInt(szInput.value)||16) - 2); }
      });

      szWrap.append(szInput, szPxLbl);

      const lumEl = document.createElement('span');
      lumEl.style.cssText = `color:${ch.color};font-size:13px;font-weight:bold;min-width:28px;text-align:right;margin-left:auto`;
      lumEl.textContent = '--';
      ch.lumEl = lumEl;

      const ptsEl = document.createElement('span');
      ptsEl.style.cssText = 'color:#555;font-size:8px;margin-left:2px;white-space:nowrap';
      ptsEl.textContent = '0pt';
      ch.ptsEl = ptsEl;

      row.append(tog, lbl, szWrap, lumEl, ptsEl);
      grid.appendChild(row);
    });
    panel.appendChild(grid);

    // Separador
    const sep = document.createElement('div');
    sep.style.cssText = 'border-top:1px solid #2a2a3a;margin:4px 0 6px';
    panel.appendChild(sep);

    // Linha de controles de análise
    const analyzeRow = document.createElement('div');
    analyzeRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';

    const lagLabel = document.createElement('span');
    lagLabel.textContent = 'Max lag:';
    lagLabel.style.cssText = 'font-size:9px;color:#888;white-space:nowrap';

    const lagSel = document.createElement('select');
    lagSel.style.cssText = 'background:#1e1e30;border:1px solid #333;color:#ccc;font-size:9px;border-radius:3px;padding:1px 2px';
    // Opções: 5, 15, 30s (45s removido)
    [5000, 15000, 30000].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = (v/1000)+'s';
      if (v === 30000) o.selected = true;
      lagSel.appendChild(o);
    });

    const btnAnalyze = document.createElement('button');
    btnAnalyze.textContent = '\u26A1 ANALISAR TUDO';
    btnAnalyze.style.cssText = 'flex:1;background:#1a3a7a;border:none;color:#fff;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:10px;font-family:monospace;font-weight:bold;opacity:.5';
    btnAnalyze.onclick = async () => {
      statusEl.textContent = 'Calculando correla\u00E7\u00F5es...';
      statusEl.style.color = '#aaa';
      const maxLagMs = parseInt(lagSel.value);
      const results = ML.correlator.analyzeAll(maxLagMs);
      renderResultsTable(results);
      const first = results.find(r => !r.isReference && !r.error && !r.skipped);
      if (first) {
        const r = ML.correlator.analyze(ML.CHANNELS[0], first.channel, maxLagMs);
        if (!r.error) ML.chart.show(r);
      }
      const errs = results.filter(r => r.error);
      statusEl.textContent = errs.length
        ? errs.map(r => r.label + ': ' + r.error).join(' | ')
        : 'An\u00E1lise conclu\u00EDda';
      statusEl.style.color = errs.length ? '#ff8844' : '#44ff88';
    };
    Object.defineProperty(btnAnalyze, 'disabled', {
      set(v) { this._disabled = v; this.style.opacity = v ? .5 : 1; this.style.cursor = v ? 'not-allowed' : 'pointer'; },
      get() { return this._disabled; },
    });
    btnAnalyze.disabled = true;

    analyzeRow.append(lagLabel, lagSel, btnAnalyze);
    panel.appendChild(analyzeRow);

    // Tabela de resultados
    const tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'margin-bottom:6px';

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;font-size:9px';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th style="text-align:left;color:#555;padding:2px 3px;border-bottom:1px solid #2a2a3a">CANAL</th>
      <th style="text-align:right;color:#555;padding:2px 3px;border-bottom:1px solid #2a2a3a">OFFSET</th>
      <th style="text-align:right;color:#555;padding:2px 3px;border-bottom:1px solid #2a2a3a">CONF.</th>
    </tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    panel.appendChild(tableWrap);

    function clearResultsTable() {
      tbody.innerHTML = '';
    }

    function renderResultsTable(results) {
      tbody.innerHTML = '';
      results.forEach(r => {
        const tr = document.createElement('tr');
        const color = r.channel ? r.channel.color : '#aaa';

        const tdLabel = document.createElement('td');
        tdLabel.style.cssText = `padding:3px 3px;color:${color};font-weight:bold`;
        tdLabel.textContent = (r.isReference ? '\u2605 ' : '') + r.label;

        const tdOffset = document.createElement('td');
        tdOffset.style.cssText = 'padding:3px 3px;text-align:right;font-weight:bold';
        if (r.isReference) {
          tdOffset.textContent = '0.000s';
          tdOffset.style.color = '#44ff88';
        } else if (r.skipped) {
          tdOffset.textContent = '--';
          tdOffset.style.color = '#555';
        } else if (r.error) {
          tdOffset.textContent = 'ERRO';
          tdOffset.style.color = '#ff4444';
        } else {
          const s = r.offsetMs / 1000;
          const sign = s > 0 ? '+' : '';
          tdOffset.textContent = sign + s.toFixed(3) + 's';
          tdOffset.style.color = Math.abs(s) < 0.1 ? '#44ff88' : Math.abs(s) < 1 ? '#ffd700' : '#ff8844';
        }

        const tdConf = document.createElement('td');
        tdConf.style.cssText = 'padding:3px 3px;text-align:right;color:#888';
        if (r.isReference) {
          tdConf.textContent = '100%';
          tdConf.style.color = '#44ff88';
        } else if (r.confidence != null) {
          tdConf.textContent = Math.round(r.confidence * 100) + '%';
          tdConf.style.color = r.confidence > 0.6 ? '#44ff88' : r.confidence > 0.3 ? '#ffd700' : '#ff4444';
        } else {
          tdConf.textContent = '--';
        }

        tr.append(tdLabel, tdOffset, tdConf);
        tbody.appendChild(tr);
      });
    }

    // Status
    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:9px;color:#888;margin-top:2px;text-align:center;font-style:italic';
    statusEl.textContent = 'Posicione os probes nos v\u00EDdeos e clique \u25CF GRAVAR';
    panel.appendChild(statusEl);

    document.body.appendChild(panel);
    ML._ui = { btnRec, btnAnalyze, statusEl };

    setInterval(() => {
      ML.CHANNELS.forEach(ch => { if (ch.ptsEl) ch.ptsEl.textContent = ch.buffer.length + 'pt'; });
    }, 1000);

    console.log('[MedLat] 50-panel carregado.');
  }

  ML.panel = { init };
})();
