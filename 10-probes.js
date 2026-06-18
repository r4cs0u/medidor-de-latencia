(function () {
  const ML = window.MedLat;

  let focusedProbe = null;

  function probeW(ch) { return (ch.probeW != null) ? ch.probeW : ML.state.probeW; }
  function probeH(ch) { return Math.round(probeW(ch) * ML.ASPECT); }

  function makeOff(ch) {
    const pw = probeW(ch), ph = probeH(ch);
    if (ch.off && ch.off.width === pw && ch.off.height === ph) return;
    ch.off = document.createElement('canvas');
    ch.off.width  = pw;
    ch.off.height = ph;
    ch.ctx = ch.off.getContext('2d', { willReadFrequently: true });
  }

  // Captura pixels da probe e retorna { lum, r, g, b, cb, cr }
  // lum  = luminância BT.709 (0-255)
  // r/g/b = médias dos canais RGB (0-255)
  // cb   = diferença de cor azul  B - lum  (proxy de Cb, -255..255)
  // cr   = diferença de cor vermelha R - lum (proxy de Cr, -255..255)
  // Retorna null se sem elemento, -1 se bloqueio CORS.
  //
  // Cache: ch._cachedMediaEl guarda o último elemento de mídia encontrado.
  // É invalidado ao final de cada drag (mouseup) e ao redimensionar.
  // Elimina ~99% das buscas DOM em cenas estáticas (probe parada sobre o vídeo).
  function getSample(ch) {
    const pw = probeW(ch), ph = probeH(ch);
    const d = ch.probe;
    if (!d) return null;

    // Tenta usar o cache antes de fazer a busca DOM
    let m = ch._cachedMediaEl || null;

    if (!m) {
      const cx = d.offsetLeft + pw / 2;
      const cy = d.offsetTop  + ph / 2;
      d.style.pointerEvents = 'none';
      const el = document.elementFromPoint(cx, cy);
      d.style.pointerEvents = 'auto';
      if (!el) return null;
      let node = el;
      for (let i = 0; i < 6; i++) {
        if (!node) break;
        if (['VIDEO','CANVAS','IMG'].includes(node.tagName)) { m = node; break; }
        const c = node.querySelector('video,canvas,img');
        if (c) { m = c; break; }
        node = node.parentElement;
      }
      if (!m) return null;
      ch._cachedMediaEl = m; // armazena para próximos ticks
    }

    const r = m.getBoundingClientRect();
    if (!r.width || !r.height) { ch._cachedMediaEl = null; return null; }
    const nw = m.videoWidth  || m.naturalWidth  || r.width;
    const nh = m.videoHeight || m.naturalHeight || r.height;
    const cx = d.offsetLeft + pw / 2;
    const cy = d.offsetTop  + ph / 2;
    const sx = Math.max(0, Math.min(nw - pw, Math.floor((cx - r.left) * (nw / r.width)  - pw / 2)));
    const sy = Math.max(0, Math.min(nh - ph, Math.floor((cy - r.top)  * (nh / r.height) - ph / 2)));
    ch.ctx.clearRect(0, 0, pw, ph);
    try { ch.ctx.drawImage(m, sx, sy, pw, ph, 0, 0, pw, ph); } catch (e) { ch._cachedMediaEl = null; return -1; }
    let px;
    try { px = ch.ctx.getImageData(0, 0, pw, ph).data; } catch (e) { ch._cachedMediaEl = null; return -1; }
    const xMin = Math.floor(pw * 0.10), xMax = Math.floor(pw * 0.90);
    const yMin = Math.floor(ph * 0.10), yMax = Math.floor(ph * 0.90);
    let Y = 0, R = 0, G = 0, B = 0, n = 0;
    for (let row = yMin; row < yMax; row++) {
      for (let col = xMin; col < xMax; col++) {
        const idx = (row * pw + col) * 4;
        const ri = px[idx], gi = px[idx+1], bi = px[idx+2];
        Y += 0.2126 * ri + 0.7152 * gi + 0.0722 * bi;
        R += ri;
        G += gi;
        B += bi;
        n++;
      }
    }
    if (!n) return null;
    const lum = Y / n;
    const rM  = R / n;
    const gM  = G / n;
    const bM  = B / n;
    return {
      lum,
      r: rM,
      g: gM,
      b: bM,
      cb: bM - lum,   // proxy Cb: positivo = cena azulada
      cr: rM - lum,   // proxy Cr: positivo = cena avermelhada
    };
  }

  // Mantém compatibilidade retroativa: retorna apenas a luminância (ou null/-1)
  function getLum(ch) {
    const s = getSample(ch);
    if (s === null || s === -1) return s;
    return s.lum;
  }

  function snapGrid(v) {
    if (!ML.state.snapGrid) return v;
    const s = ML.state.snapSize || 2;
    return Math.round(v / s) * s;
  }

  const EDGE_THRESH = 8;

  function edgeSnap(ch, x, y) {
    const pw = probeW(ch), ph = probeH(ch);
    const bL = x, bR = x + pw, bT = y, bB = y + ph;
    const cX = x + pw / 2, cY = y + ph / 2;
    let snapX = null, snapY = null;
    ML.CHANNELS.forEach(other => {
      if (other === ch || !other.active || !other.probe) return;
      const od = other.probe;
      const ow = probeW(other), oh = probeH(other);
      const oL = parseInt(od.style.left) || 0;
      const oT = parseInt(od.style.top)  || 0;
      const oR = oL + ow, oB = oT + oh;
      const oCX = oL + ow / 2, oCY = oT + oh / 2;
      if (snapX === null && Math.abs(bL - oR) <= EDGE_THRESH) snapX = oR;
      if (snapX === null && Math.abs(bR - oL) <= EDGE_THRESH) snapX = oL - pw;
      if (snapX === null && Math.abs(bL - oL) <= EDGE_THRESH) snapX = oL;
      if (snapX === null && Math.abs(cX - oCX) <= EDGE_THRESH) snapX = oCX - pw / 2;
      if (snapY === null && Math.abs(bT - oB) <= EDGE_THRESH) snapY = oB;
      if (snapY === null && Math.abs(bB - oT) <= EDGE_THRESH) snapY = oT - ph;
      if (snapY === null && Math.abs(bT - oT) <= EDGE_THRESH) snapY = oT;
      if (snapY === null && Math.abs(cY - oCY) <= EDGE_THRESH) snapY = oCY - ph / 2;
    });
    return { x: snapX !== null ? snapX : x, y: snapY !== null ? snapY : y };
  }

  function resolveCollision(ch, x, y) {
    if (!ML.state.noOverlap) return { x: Math.max(0, x), y: Math.max(0, y) };
    const pw = probeW(ch), ph = probeH(ch);
    ML.CHANNELS.forEach(other => {
      if (other === ch || !other.active || !other.probe) return;
      const od = other.probe;
      const ow = probeW(other), oh = probeH(other);
      const oL = parseInt(od.style.left) || 0;
      const oT = parseInt(od.style.top)  || 0;
      const oR = oL + ow, oB = oT + oh;
      const bL = x, bR = x + pw, bT = y, bB = y + ph;
      if (bR <= oL || bL >= oR || bB <= oT || bT >= oB) return;
      const overlapL = bR - oL, overlapR = oR - bL;
      const overlapT = bB - oT, overlapB = oB - bT;
      const minH = Math.min(overlapL, overlapR);
      const minV = Math.min(overlapT, overlapB);
      if (minH <= minV) { x = overlapL <= overlapR ? oL - pw : oR; }
      else              { y = overlapT <= overlapB ? oT - ph : oB; }
    });
    return { x: Math.max(0, x), y: Math.max(0, y) };
  }

  function dashedBorderSVG(w, h, color) {
    const c = encodeURIComponent(color);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>`
      + `<rect x='0.5' y='0.5' width='${w-1}' height='${h-1}' fill='none'`
      + ` stroke='${c}' stroke-width='1' stroke-dasharray='4 8'/>`
      + `</svg>`;
    return `url("data:image/svg+xml,${svg.replace(/#/g,'%23')}")`;
  }

  function applyDefaultStyle(ch) {
    if (!ch.probe) return;
    const d = ch.probe;
    d.style.border          = `1px solid ${ch.color}99`;
    d.style.backgroundImage = 'none';
    d.style.backgroundSize  = '';
    d.style.outline         = 'none';
    d.style.opacity         = '1';
  }

  function applyFocusStyle(ch) {
    if (!ch.probe) return;
    const d = ch.probe;
    const pw = probeW(ch), ph = probeH(ch);
    d.style.border          = '1px solid transparent';
    d.style.backgroundImage = dashedBorderSVG(pw, ph, ch.color);
    d.style.backgroundSize  = '100% 100%';
    d.style.outline         = 'none';
    d.style.opacity         = '0.95';
  }

  function refreshFocusBorder(ch) {
    if (focusedProbe === ch) applyFocusStyle(ch);
  }

  function setFocus(ch) {
    if (focusedProbe && focusedProbe !== ch) applyDefaultStyle(focusedProbe);
    focusedProbe = ch;
    if (ch) applyFocusStyle(ch);
  }

  function mkProbe(ch, x, y) {
    const pw = probeW(ch), ph = probeH(ch);
    const d = document.createElement('div');
    d.id = 'ml-probe-' + ch.id;
    d.style.cssText = [
      `position:fixed;left:${x}px;top:${y}px`,
      `width:${pw}px;height:${ph}px`,
      `border:1px solid ${ch.color}99`,
      `background-color:${ch.color}10`,
      `box-shadow:0 0 6px ${ch.color}88`,
      'cursor:move',
      'z-index:99997',
      'box-sizing:border-box',
      'pointer-events:auto',
      'transition:opacity .2s,box-shadow .15s',
    ].join(';');

    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute;top:50%;left:0;right:0;height:1px;background:${ch.color};opacity:.5;pointer-events:none`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute;left:50%;top:0;bottom:0;width:1px;background:${ch.color};opacity:.5;pointer-events:none`;

    const mask = document.createElement('div');
    mask.style.cssText = [
      'position:absolute',
      'left:10%;top:10%;width:80%;height:80%',
      `border:1px dashed ${ch.color}60`,
      'pointer-events:none',
      'box-sizing:border-box',
    ].join(';');

    const lbl = document.createElement('span');
    lbl.style.cssText = `position:absolute;top:-16px;left:0;font:bold 9px monospace;color:${ch.color};text-shadow:0 0 3px #000;white-space:nowrap;pointer-events:none`;
    lbl.textContent = ch.label;
    d.append(hLine, vLine, mask, lbl);
    document.body.appendChild(d);

    ch.probe      = d;
    ch.probeLabel = lbl;
    ch.resize = () => {
      const npw = probeW(ch), nph = probeH(ch);
      d.style.width  = npw + 'px';
      d.style.height = nph + 'px';
      mask.style.left = '10%'; mask.style.top = '10%';
      mask.style.width = '80%'; mask.style.height = '80%';
      makeOff(ch);
      ch._cachedMediaEl = null; // invalida cache ao redimensionar
      refreshFocusBorder(ch);
    };
    d.style.display = ch.active ? 'block' : 'none';

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
      let rx = Math.max(0, e.clientX - ox);
      let ry = Math.max(0, e.clientY - oy);
      rx = snapGrid(rx); ry = snapGrid(ry);
      if (ML.state.snapGrid) {
        const snapped = edgeSnap(ch, rx, ry);
        rx = snapped.x; ry = snapped.y;
      }
      const final = resolveCollision(ch, rx, ry);
      d.style.left = final.x + 'px';
      d.style.top  = final.y + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (drag) ch._cachedMediaEl = null; // invalida cache ao soltar o drag
      drag = false;
    });
  }

  window.addEventListener('keydown', e => {
    if (!focusedProbe || !focusedProbe.probe) return;
    const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
    if (!arrows.includes(e.key) && e.key !== 'Tab') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const active = ML.CHANNELS.filter(c => c.active && c.probe);
      if (!active.length) return;
      const idx = active.indexOf(focusedProbe);
      setFocus(active[(idx + 1) % active.length]);
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const d = focusedProbe.probe;
    let left = parseInt(d.style.left) || 0;
    let top  = parseInt(d.style.top)  || 0;
    if (e.key === 'ArrowLeft')  left = Math.max(0, left - step);
    if (e.key === 'ArrowRight') left += step;
    if (e.key === 'ArrowUp')    top  = Math.max(0, top - step);
    if (e.key === 'ArrowDown')  top  += step;
    // Invalida cache ao mover por teclado (probe pode ter saido do video)
    focusedProbe._cachedMediaEl = null;
    const final = resolveCollision(focusedProbe, left, top);
    d.style.left = final.x + 'px';
    d.style.top  = final.y + 'px';
  });

  window.addEventListener('mousedown', e => {
    const clickedProbe = ML.CHANNELS.some(ch => ch.probe && ch.probe.contains(e.target));
    if (!clickedProbe && focusedProbe) {
      applyDefaultStyle(focusedProbe);
      focusedProbe = null;
    }
  }, true);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const responsiveW = Math.round(Math.max(120, Math.min(300, Math.min(vw, vh) * 0.22)) / 2) * 2;
  ML.state.probeW = responsiveW;

  // Linha 1: ch0–ch5 em y~32%, linha 2: ch6–ch9 em y~58%, linha 3: ch10–ch11 em y~78%
  const INIT_CENTER = [
    [0.555, 0.322],
    [0.308, 0.322],
    [0.432, 0.322],
    [0.681, 0.322],
    [0.804, 0.322],
    [0.927, 0.322],
    [0.308, 0.580],
    [0.432, 0.580],
    [0.555, 0.580],
    [0.681, 0.580],
    [0.308, 0.780],  // ch10
    [0.432, 0.780],  // ch11
  ];
  const INIT_FINE = [
    [  0, -5],
    [  0, -5],
    [  0, -5],
    [ -2, -5],
    [ -2, -5],
    [ -2, -5],
    [  0, -5],
    [  0, -5],
    [  0, -5],
    [ -2, -5],
    [  0, -5],  // ch10
    [  0, -5],  // ch11
  ];

  // Cria probes apenas para os canais ativos no seletor (numChannels)
  const numCh = ML.state.numChannels || ML.CHANNELS.length;
  ML.CHANNELS.slice(0, numCh).forEach((ch, i) => {
    makeOff(ch);
    const pw = probeW(ch);
    const ph = probeH(ch);
    const x = Math.round(vw * INIT_CENTER[i][0] - pw / 2) + INIT_FINE[i][0];
    const y = Math.round(vh * INIT_CENTER[i][1] - ph / 2) + INIT_FINE[i][1];
    mkProbe(ch, Math.max(0, x), Math.max(0, y));
  });

  ML.getLum    = getLum;
  ML.getSample = getSample;
  ML.setFocus  = setFocus;

  console.log(`[MedLat] 10-probes v1.3 carregado. getSample() com cache de elemento. px responsivo=${responsiveW} (viewport ${vw}×${vh}). ${numCh} canais posicionados.`);
})();
