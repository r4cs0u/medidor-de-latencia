(function () {
  const ML = window.MedLat;
  const ui = ML.ui;

  function toggleTips(anchorPanel) {
    const existing = document.getElementById('ml-tips');
    if (existing) { existing.remove(); return; }
    const TIPS = [
      ['\ud83c\udfaf', 'Centralize as probes sobre a imagem'],
      ['\ud83d\udcfa', 'Grave durante o programa, nunca no intervalo'],
      ['\u23f1\ufe0f', 'N\u00e3o interrompa \u2014 aguarde o sinal sonoro (~2 min)'],
      ['\ud83d\udda5\ufe0f', 'Evite processos pesados durante a grava\u00e7\u00e3o'],
    ];
    const auxW = Math.round(Math.max(190, Math.min(260, window.innerWidth * 0.12)));
    const { win } = ui.makeDraggableWindow('ml-tips', '\ud83d\udca1 Boas Pr\u00e1ticas', '#ffd700', auxW);
    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:5px';
    TIPS.forEach(([icon, text]) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex;align-items:flex-start;gap:5px;line-height:1.35';
      const ic = document.createElement('span');
      ic.textContent = icon;
      ic.style.cssText = 'font-size:11px;flex-shrink:0;margin-top:1px';
      const tx = document.createElement('span');
      tx.textContent = text;
      function applyTxStyle() {
        tx.style.cssText = `font-size:9px;color:${ui.T.textPrimary};font-weight:500`;
      }
      applyTxStyle();
      ui.onThemeChange(() => { if (tx.isConnected) applyTxStyle(); });
      r.append(ic, tx);
      body.appendChild(r);
    });
    win.appendChild(body);
    ui.positionNearPanel(win, anchorPanel);
  }

  function toggleGuide(anchorPanel) {
    const existing = document.getElementById('ml-guide');
    if (existing) { existing.remove(); return; }
    const auxW = Math.round(Math.max(200, Math.min(270, window.innerWidth * 0.13)));
    const { win } = ui.makeDraggableWindow('ml-guide', '\ud83d\udccb Como Usar', '#00d4ff', auxW);
    const STEPS = [
      { section: '\u2699\ufe0f  PREPARA\u00c7\u00c3O', color: '#ffd700', items: [
        '1. Ative as telas desejadas (\u25cf)',
        '2. Ajuste o tamanho via PX Global ou por tela',
        '3. Posicione cada probe sobre a imagem do v\u00eddeo (arrastar ou setas)',
        '4. Dedu\u00e7\u00e3o offset j\u00e1 exibido no multiviewer (em vermelho), adicione o valor em segundos',
        '5. Lag estimado: Range da diferen\u00e7a entre os sinais',
      ]},
      { section: '\u23fa  GRAVA\u00c7\u00c3O', color: '#44ff88', items: [
        '6. Clique em \u25cf GRAVAR \u2014 a an\u00e1lise inicia sozinha ao terminar',
      ]},
      { section: '\ud83d\udcca  AN\u00c1LISE', color: '#ce93d8', items: [
        '7. Resultado = A lat\u00eancia estimada aparece por tela automaticamente',
        '8. Real = Resultado + Dedu\u00e7\u00e3o canal \u2212 Dedu\u00e7\u00e3o ref. (desconta o atraso j\u00e1 conhecido do multiviewer)',
        '9. Para ajuste fino: clique em Manual e mova as r\u00e9guas',
        '10. Clique em \u2714 Confirmar para exportar e copiar os resultados',
      ]},
    ];
    const body = document.createElement('div');
    body.style.cssText = 'padding:6px 8px;display:flex;flex-direction:column;gap:6px';
    STEPS.forEach(({ section, color, items }) => {
      const secLabel = document.createElement('div');
      secLabel.textContent = section;
      function applySecStyle() {
        secLabel.style.cssText = `color:${color};font-size:8px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px;padding-bottom:2px;border-bottom:1px solid ${color}33`;
      }
      applySecStyle();
      body.appendChild(secLabel);
      items.forEach(text => {
        const item = document.createElement('div');
        item.textContent = text;
        function applyItemStyle() {
          item.style.cssText = `font-size:9px;color:${ui.T.textPrimary};line-height:1.5;padding-left:4px;font-weight:500`;
        }
        applyItemStyle();
        ui.onThemeChange(() => { if (item.isConnected) applyItemStyle(); });
        body.appendChild(item);
      });
    });
    win.appendChild(body);
    ui.positionNearPanel(win, anchorPanel);
  }

  ML.help = { toggleTips, toggleGuide };

  console.log('[MedLat] 55-help carregado.');
})();
