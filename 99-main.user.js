// ==UserScript==
// @name         Medidor de Latência
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Mede latência entre múltiplos sinais de vídeo por análise de luminância
// @match        https://mediamonitor.rj.g.globo/actus5/channels*
// @match        http://10.3.89.100/gridvision/mosaico*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  var BASE = 'https://raw.githubusercontent.com/r4cs0u/medidor-de-latencia/main/';
  var MODULOS = [
    '00-core.js',
    '10-probes.js',
    '15-ui-utils.js',
    '20-recorder.js',
    '30-correlator.js',
    '55-help.js',
    '50-panel.js',
  ];

  function carregarModulo(arquivo) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: BASE + arquivo + '?_=' + Date.now(),
        nocache: true,
        onload: function (r) {
          if (r.status === 200) {
            try { eval(r.responseText); resolve(); }
            catch (e) { reject('Erro ao executar ' + arquivo + ': ' + e); }
          } else {
            reject('Falha HTTP ' + r.status + ' em ' + arquivo);
          }
        },
        onerror: function (e) { reject('Erro de rede em ' + arquivo + ': ' + JSON.stringify(e)); }
      });
    });
  }

  async function carregarTodos() {
    for (var i = 0; i < MODULOS.length; i++) {
      await carregarModulo(MODULOS[i]);
    }
  }

  carregarTodos().then(function () {
    console.log('[MedLat] Todos os módulos carregados. v1.2');
  }).catch(function (erro) {
    console.error('[MedLat] Falha ao carregar módulos:', erro);
  });

})();
