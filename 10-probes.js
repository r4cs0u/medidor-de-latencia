(function () {
  const ML = window.MedLat;

  function makeOff(ch) {
    const pw = ML.state.probeW;
    ch.off = document.createElement('canvas');
    ch.off.width  = pw;
    ch.off.height = Math.round(pw * ML.ASPECT);
    ch.ctx = ch.off.getContext('2d', { willReadFrequently: true });
  }

  function getLum(ch) {
    const pw = ML.state.probeW;
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
    const sx = Math.floor((cx - r.left) * (nw / r.width)  - pw / 2);
    const sy = Math.floor((cy - r.top)  * (nh / r.height) - ph / 2);
    ch.ctx.clearRect(0, 0, pw, ph);
    try { ch.ctx.drawImage(m, sx, sy, pw, ph, 0, 0, pw, ph); } catch (e) { return -1; }
    let px;
    try { px = ch.ctx.getImageData(0, 0, pw, ph).data; } catch (e) { return -1; }
    let Y = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      Y += 0.2126 * px[i] + 0.7152 * px[i+1] + 0.0722 * px[i+2];
      n++;
    }
    return n ? Y / n : null;
  }

  function mkProbe(ch, x, y) {
    const pw = ML.state.probeW;
    const ph = Math.round(pw * ML.ASPECT);
    const d  = document.createElement('div');
    d.id = 'ml-probe-' + ch.id;
    d.style.cssText = [
      `position:fixed;left:${x}px;top:${y}px`,
      `width:${pw}px;height:${ph}px`,
      `border:3px solid ${ch.color}`,
      `background:${ch.color}15`,
      `box-shadow:0 0 8px ${ch.color}`,
      'cursor:move',
      'z-index:99997',
      'box-sizing:border-box',
      'pointer-events:auto',
      'transition:opacity .2s',
    ].join(';');

    const hLine = document.createElement('div');
    hLine.style.cssText = `position:absolute;top:50%;left:0;right:0;height:1px;background:${ch.color};opacity:.7;pointer-events:none`;
    const vLine = document.createElement('div');
    vLine.style.cssText = `position:absolute;left:50%;top:0;bottom:0;width:1px;background:${ch.color};opacity:.7;pointer-events:none`;
    const lbl = document.createElement('span');
    lbl.style.cssText = `position:absolute;top:-16px;left:0;font:bold 9px monospace;color:${ch.color};text-shadow:0 0 3px #000;white-space:nowrap;pointer-events:none`;
    lbl.textContent = ch.label;
    d.append(hLine, vLine, lbl);
    document.body.appendChild(d);

    ch.probe      = d;
    ch.probeLabel = lbl;
    ch.resize = () => {
      const npw = ML.state.probeW;
      const nph = Math.round(npw * ML.ASPECT);
      d.style.width  = npw + 'px';
      d.style.height = nph + 'px';
      makeOff(ch);
    };
    d.style.display = ch.active ? 'block' : 'none';

    // Drag
    let drag = false, ox = 0, oy = 0;
    d.addEventListener('mousedown', e => { drag=true; ox=e.clientX-d.offsetLeft; oy=e.clientY-d.offsetTop; e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('mousemove', e => { if (!drag) return; d.style.left = Math.max(0, e.clientX-ox)+'px'; d.style.top = Math.max(0, e.clientY-oy)+'px'; });
    window.addEventListener('mouseup', () => drag = false);
  }

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

  // Expõe getLum globalmente
  ML.getLum = getLum;

  console.log('[MedLat] 10-probes carregado.');
})();
