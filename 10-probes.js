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

  function getLum(ch) {
    const pw = probeW(ch), ph = probeH(ch);
    const d = ch.probe;
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
    const sx = Math.max(0, Math.min(nw - pw, Math.floor((cx - r.left) * (nw / r.width)  - pw / 2)));
    const sy = Math.max(0, Math.min(nh - ph, Math.floor((cy - r.top)  * (nh / r.height) - ph / 2)));
    ch.ctx.clearRect(0, 0, pw, ph);
    try { ch.ctx.drawImage(m, sx, sy, pw, ph, 0, 0, pw, ph); } catch (e) { return -1; }
    let px;
    try { px = ch.ctx.getImageData(0, 0, pw, ph).data; } catch (e) { return -1; }

    const xMin = Math.floor(pw * 0.10);
    const xMax = Math.floor(pw * 0.90);
    const yMin = Math.floor(ph * 0.10);
    const yMax = Math.floor(ph * 0.90);

    let Y = 0, n = 0;
    for (let row = yMin; row < yMax; row++) {
      for (let col = xMin; col < xMax; col++) {
        const i = (row * pw + col) * 4;
        Y += 0.2126 * px[i] + 0.7152 * px[i+1] + 0.0722 * px[i+2];
        n++;
      }
    }
    return n ? Y / n : null;
  }

  function snapGrid(v) {
    if (!ML.state.snapGrid) return v;
    const s = ML.state.snapSize || 2;
    return Math.round(v / s) * s;
  }

  const EDGE_THRESH = 8;
  const PROBE_GAP   = 0;

  function edgeSnap(ch, x, y) {
    const pw = probeW(ch), ph = probeH(ch);
    let bL = x, bR = x + pw, bT = y, bB = y + ph;
    let cX = x + pw / 2, cY = y + ph / 2;
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
    if (!ML.state.noOverlap) return { x, y };
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

  let flashTimers = {};
  function flashProbe(other) {
    if (flashTimers[other.id]) return;
    const d = other.probe;
    const orig = d.style.boxShadow;
    d.style.boxShadow = `0 0 12px 3px ${other.color}`;
    flashTimers[other.id] = setTimeout(() => {
      if (d) d.style.boxShadow = orig;
      delete flashTimers[other.id];
    }, 180);
  }

  // Padrão: borda sólida (sem foco)
  function applyDefaultStyle(ch) {
    if (!ch.probe) return;
    ch.probe.style.outline       = 'none';
    ch.probe.style.outlineOffset = '0px';
    ch.probe.style.border        = `1px solid ${ch.color}99`;
    ch.probe.style.opacity       = '1';
  }

  // Foco/drag: borda tracejada (sem outline duplo)
  function applyFocusStyle(ch) {
    if (!ch.probe) return;
    ch.probe.style.outline       = 'none';
    ch.probe.style.outlineOffset = '0px';
    ch.probe.style.border        = `2px dashed ${ch.color}`;
    ch.probe.style.opacity       = '0.95';
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
      `background:${ch.color}10`,
      `box-shadow:0 0 6px ${ch.color}88`,
      'cursor:move',
      'z-index:99997',
      'box-sizing:border-box',
      'pointer-events:auto',
      'transition:opacity .2s,border .15s,box-shadow .15s',
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
      const prevX = rx, prevY = ry;
      const snapped = edgeSnap(ch, rx, ry);
      rx = snapped.x; ry = snapped.y;
      if (rx !== prevX || ry !== prevY) {
        ML.CHANNELS.forEach(other => {
          if (other === ch || !other.active || !other.probe) return;
          const ow = probeW(other), oh = probeH(other);
          const oL = parseInt(other.probe.style.left)||0, oT = parseInt(other.probe.style.top)||0;
          const touched = (
            Math.abs(rx - (oL + ow)) <= EDGE_THRESH ||
            Math.abs(rx + probeW(ch) - oL) <= EDGE_THRESH ||
            Math.abs(ry - (oT + oh)) <= EDGE_THRESH ||
            Math.abs(ry + probeH(ch) - oT) <= EDGE_THRESH
          );
          if (touched) flashProbe(other);
        });
      }
      const final = resolveCollision(ch, rx, ry);
      d.style.left = final.x + 'px';
      d.style.top  = final.y + 'px';
    });
    window.addEventListener('mouseup', () => { drag = false; });
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
    d.style.left = left + 'px';
    d.style.top  = top  + 'px';
  });

  window.addEventListener('mousedown', e => {
    const clickedProbe = ML.CHANNELS.some(ch => ch.probe && ch.probe.contains(e.target));
    if (!clickedProbe && focusedProbe) {
      applyDefaultStyle(focusedProbe);
      focusedProbe = null;
    }
  }, true);

  const vw = window.innerWidth, vh = window.innerHeight;
  const startPos = [
    [Math.round(vw*.10), Math.round(vh*.15)],
    [Math.round(vw*.28), Math.round(vh*.15)],
    [Math.round(vw*.46), Math.round(vh*.15)],
    [Math.round(vw*.64), Math.round(vh*.15)],
  ];

  ML.CHANNELS.forEach((ch, i) => {
    makeOff(ch);
    mkProbe(ch, startPos[i][0], startPos[i][1]);
  });

  ML.getLum   = getLum;
  ML.setFocus = setFocus;

  console.log('[MedLat] 10-probes: borda sólida padrão → tracejada no foco, colisão bordas sobrepostas.');
})();
