(function () {
  const ML = window.MedLat;

  // Probe atualmente focado (recebe eventos de teclado)
  let focusedProbe = null;

  function probeW(ch) {
    return (ch.probeW != null) ? ch.probeW : ML.state.probeW;
  }

  function makeOff(ch) {
    const pw = probeW(ch);
    const ph = Math.round(pw * ML.ASPECT);
    if (ch.off && ch.off.width === pw && ch.off.height === ph) return; // já correto
    ch.off = document.createElement('canvas');
    ch.off.width  = pw;
    ch.off.height = ph;
    ch.ctx = ch.off.getContext('2d', { willReadFrequently: true });
  }

  function getLum(ch) {
    const pw = probeW(ch);
    const ph = Math.round(pw * ML.ASPECT);
    const d  = ch.probe;
    if (!d) return null;
    const cx = d.offsetLeft + pw / 2;
    const cy = d.offsetTop  + ph / 2;
    d.style.pointerEvents = 'none';
    const el = document.elementFromPoint(cx, cy);
    d.style.pointerEvents = 'auto';
    if (!el) return null;
    let m = null, node = el;
    for (let i = 0; i < 6; i++) {
      if (!node) break;
      if (['VIDEO','CANVAS','IMG'].includes(node.tagName)) { m = node; break; }
      const c = node.querySelector('video,canvas,img');
      if (c) { m = c; break; }
      node = node.parentElement;
    }
    if (!m) return null;
    const r = m.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const nw = m.videoWidth  || m.naturalWidth  || r.width;
    const nh = m.videoHeight || m.naturalHeight || r.height;
    // Item 3: clamp para não sair dos limites do elemento
    const sx = Math.max(0, Math.min(nw - pw, Math.floor((cx - r.left) * (nw / r.width)  - pw / 2)));
    const sy = Math.max(0, Math.min(nh - ph, Math.floor((cy - r.top)  * (nh / r.height) - ph / 2)));
    ch.ctx.clearRect(0, 0, pw, ph);
    try { ch.ctx.drawImage(m, sx, sy, pw, ph, 0, 0, pw, ph); } catch (e) { return -1; }
    let px;
    try { px = ch.ctx.getImageData(0, 0, pw, ph).data; } catch (e) { return -1; }
    // Item 1: subsampling 4x (i+=16) — reduz 75% do trabalho sem perder precisão da média
    let Y = 0, n = 0;
    for (let i = 0; i < px.length; i += 16) {
      Y += 0.2126 * px[i] + 0.7152 * px[i+1] + 0.0722 * px[i+2];
      n++;
    }
    return n ? Y / n : null;
  }

  function snapPos(v) {
    if (!ML.state.snapGrid) return v;
    const s = ML.state.snapSize || 20;
    return Math.round(v / s) * s;
  }

  function setFocus(ch) {
    // Remove foco anterior
    if (focusedProbe && focusedProbe !== ch) {
      const prev = focusedProbe;
      if (prev.probe) {
        prev.probe.style.outline = 'none';
        prev.probe.style.opacity = '1';
      }
    }
    focusedProbe = ch;
    if (ch && ch.probe) {
      ch.probe.style.outline = `2px solid ${ch.color}`;
      ch.probe.style.outlineOffset = '2px';
      ch.probe.style.opacity = '0.95';
    }
  }

  function mkProbe(ch, x, y) {
    const pw = probeW(ch);
    const ph = Math.round(pw * ML.ASPECT);
    const d  = document.createElement('div');
    d.id = 'ml-probe-' + ch.id;
    d.style.cssText = [
      `position:fixed;left:${x}px;top:${y}px`,
      `width:${pw}px;height:${ph}px`,
      `border:1px solid ${ch.color}`,             // borda fina
      `outline:1px solid ${ch.color}40`,           // segunda linha interna sutil
      `background:${ch.color}10`,
      `box-shadow:0 0 6px ${ch.color}88`,
      'cursor:move',
      'z-index:99997',
      'box-sizing:border-box',
      'pointer-events:auto',
      'transition:opacity .2s,outline .15s',
    ].join(';');

    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute;top:50%;left:0;right:0;height:1px;background:${ch.color};opacity:.5;pointer-events:none`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute;left:50%;top:0;bottom:0;width:1px;background:${ch.color};opacity:.5;pointer-events:none`;
    const lbl = document.createElement('span');
    lbl.style.cssText = `position:absolute;top:-16px;left:0;font:bold 9px monospace;color:${ch.color};text-shadow:0 0 3px #000;white-space:nowrap;pointer-events:none`;
    lbl.textContent = ch.label;
    d.append(hLine, vLine, lbl);
    document.body.appendChild(d);

    ch.probe      = d;
    ch.probeLabel = lbl;
    ch.resize = () => {
      const npw = probeW(ch);
      const nph = Math.round(npw * ML.ASPECT);
      d.style.width  = npw + 'px';
      d.style.height = nph + 'px';
      makeOff(ch);
    };
    d.style.display = ch.active ? 'block' : 'none';

    // Drag com snap magnético
    let drag = false, ox = 0, oy = 0;
    d.addEventListener('mousedown', e => {
      drag = true;
      ox = e.clientX - d.offsetLeft;
      oy = e.clientY - d.offsetTop;
      setFocus(ch);
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener('mousemove', e => {
      if (!drag) return;
      const rx = Math.max(0, e.clientX - ox);
      const ry = Math.max(0, e.clientY - oy);
      d.style.left = snapPos(rx) + 'px';
      d.style.top  = snapPos(ry) + 'px';
    });
    window.addEventListener('mouseup', () => { drag = false; });
  }

  // Navegação por teclado: setas movem 1px (ou 10px com Shift); Tab cicla entre probes ativos
  window.addEventListener('keydown', e => {
    if (!focusedProbe || !focusedProbe.probe) return;
    const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    if (!arrows.includes(e.key) && e.key !== 'Tab') return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const active = ML.CHANNELS.filter(c => c.active && c.probe);
      if (!active.length) return;
      const idx = active.indexOf(focusedProbe);
      const next = active[(idx + 1) % active.length];
      setFocus(next);
      return;
    }

    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const d = focusedProbe.probe;
    let left = parseInt(d.style.left) || 0;
    let top  = parseInt(d.style.top)  || 0;
    if (e.key === 'ArrowLeft')  left = Math.max(0, left - step);
    if (e.key === 'ArrowRight') left = left + step;
    if (e.key === 'ArrowUp')    top  = Math.max(0, top  - step);
    if (e.key === 'ArrowDown')  top  = top  + step;
    d.style.left = left + 'px';
    d.style.top  = top  + 'px';
  });

  // Clicar fora de qualquer probe remove o foco
  window.addEventListener('mousedown', e => {
    const clickedProbe = ML.CHANNELS.some(ch => ch.probe && ch.probe.contains(e.target));
    if (!clickedProbe && focusedProbe) {
      if (focusedProbe.probe) {
        focusedProbe.probe.style.outline = `1px solid ${focusedProbe.color}40`;
        focusedProbe.probe.style.outlineOffset = '0px';
        focusedProbe.probe.style.opacity = '1';
      }
      focusedProbe = null;
    }
  }, true);

  // Posições iniciais distribuídas na tela
  const vw = window.innerWidth, vh = window.innerHeight;
  const startPos = [
    [Math.round(vw*.10), Math.round(vh*.15)],
    [Math.round(vw*.28), Math.round(vh*.15)],
    [Math.round(vw*.46), Math.round(vh*.15)],
    [Math.round(vw*.64), Math.round(vh*.15)],
    [Math.round(vw*.10), Math.round(vh*.55)],
    [Math.round(vw*.28), Math.round(vh*.55)],
    [Math.round(vw*.46), Math.round(vh*.55)],
    [Math.round(vw*.64), Math.round(vh*.55)],
  ];

  ML.CHANNELS.forEach((ch, i) => {
    makeOff(ch);
    mkProbe(ch, startPos[i][0], startPos[i][1]);
  });

  // Expõe getLum e setFocus globalmente
  ML.getLum    = getLum;
  ML.setFocus  = setFocus;  // permite focar probe via console: MedLat.setFocus(MedLat.CHANNELS[1])

  console.log('[MedLat] 10-probes carregado. Snap:', ML.state.snapGrid, '| Grid:', ML.state.snapSize + 'px');
})();
