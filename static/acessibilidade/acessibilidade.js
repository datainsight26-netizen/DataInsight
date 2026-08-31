/**
 * =============================================================
 * SISTEMA DE ACESSIBILIDADE E INCLUSÃO DIGITAL — DataInsight
 * =============================================================
 * Gerencia preferências de acessibilidade globalmente via localStorage.
 * Por padrão: DESATIVADO.
 * Ativação: Através da página /configuracoes ou chamada programática.
 * =============================================================
 */

(function () {
  'use strict';

  var CHAVE_ATIVADO = 'acc_ativado';
  var CHAVE_PREFS   = 'acc_preferencias';

  var DEFAULTS = {
    escalaFonte:   1.0,
    altoContraste: false,
    dyslexia:      false,
    cursorGrande:  false,
    focoAlto:      false,
    semAnimacoes:  false,
    daltonismo:    'nenhum',
    velocidadeVoz: 1.0,
    vlibras:       false,
  };

  // ── ESTADO INICIAL ──
  var ativado = localStorage.getItem(CHAVE_ATIVADO) === 'true';
  var prefs = Object.assign({}, DEFAULTS);
  try {
    var _salvo = JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}');
    prefs = Object.assign({}, DEFAULTS, _salvo);
  } catch (e) {
    prefs = Object.assign({}, DEFAULTS);
  }

  var synth = window.speechSynthesis || null;
  var lendoAtualmente   = false;
  var elementoDestacado = null;
  var indiceAtual       = 0;
  var elementosParaLer  = [];
  var vlibrasIniciado   = false;

  // ── SALVAR PREFERÊNCIAS ──
  function salvarEstado() {
    localStorage.setItem(CHAVE_ATIVADO, ativado ? 'true' : 'false');
    localStorage.setItem('acessibilidadeAtiva', ativado ? 'true' : 'false');
    localStorage.setItem(CHAVE_PREFS, JSON.stringify(prefs));
  }

  // ── GERENCIAMENTO DO VLIBRAS (100% DINÂMICO SOB DEMANDA) ──
  function aplicarVlibras() {
    var deveExibir = ativado && Boolean(prefs.vlibras);
    var raiz = document.documentElement;

    raiz.classList.toggle('acc-vlibras-ativo', deveExibir);

    if (deveExibir) {
      // 1. Criar container do VLibras se não existir
      var container = document.getElementById('Vlibras');
      if (!container) {
        container = document.createElement('div');
        container.id = 'Vlibras';
        container.setAttribute('vw', '');
        container.className = 'enabled';
        container.innerHTML = '<div vw-access-button class="active"></div><div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
        document.body.appendChild(container);
      } else {
        container.style.removeProperty('display');
        container.classList.add('enabled');
      }

      // 2. Carregar script do plugin se ainda não carregado
      if (!window.VLibras) {
        if (!document.getElementById('vlibras-script-tag')) {
          var script = document.createElement('script');
          script.id = 'vlibras-script-tag';
          script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
          script.onload = function () {
            try {
              if (window.VLibras && window.VLibras.Widget) {
                new window.VLibras.Widget('https://vlibras.gov.br/app');
                vlibrasIniciado = true;
              }
            } catch (e) {}
          };
          document.body.appendChild(script);
        }
      } else if (window.VLibras && window.VLibras.Widget && !vlibrasIniciado) {
        try {
          new window.VLibras.Widget('https://vlibras.gov.br/app');
          vlibrasIniciado = true;
        } catch (e) {}
      }
    } else {
      // REMOVER completamente todos os elementos do VLibras do DOM se desativado
      document.querySelectorAll('#Vlibras, [vw], [vw-access-button], .vw-plugin-wrapper, .vw-plugin-top-wrapper').forEach(function (el) {
        el.remove();
      });
    }
  }

  // ── APLICAR TODAS AS PREFERÊNCIAS AO DOM ──
  function aplicarTudo() {
    var raiz = document.documentElement;
    var flutuante = document.getElementById('accFlutuante');

    // 1. Botão Flutuante
    if (flutuante) {
      if (ativado) {
        flutuante.style.setProperty('display', 'flex', 'important');
        flutuante.classList.add('acc-visivel');
      } else {
        flutuante.style.setProperty('display', 'none', 'important');
        flutuante.classList.remove('acc-visivel');
        fecharPainel();
        pararLeitura();
      }
    }

    // 2. VLibras
    aplicarVlibras();

    // 3. Se desativado, limpar classes visuais
    if (!ativado) {
      raiz.classList.remove(
        'acc-alto-contraste',
        'acc-dyslexia',
        'acc-sem-animacoes',
        'acc-foco-alto',
        'acc-cursor-grande'
      );
      raiz.style.filter = '';
      raiz.style.setProperty('--acc-escala', '1');
      atualizarUiControles();
      return;
    }

    // 4. Se ativado, aplicar classes visuais selecionadas
    raiz.style.setProperty('--acc-escala', prefs.escalaFonte || 1.0);
    atualizarDisplayEscala();

    raiz.classList.toggle('acc-alto-contraste', Boolean(prefs.altoContraste));
    raiz.classList.toggle('acc-dyslexia',      Boolean(prefs.dyslexia));
    raiz.classList.toggle('acc-sem-animacoes', Boolean(prefs.semAnimacoes));
    raiz.classList.toggle('acc-foco-alto',     Boolean(prefs.focoAlto));
    raiz.classList.toggle('acc-cursor-grande', Boolean(prefs.cursorGrande));

    aplicarFiltroDaltonismo(prefs.daltonismo);
    atualizarUiControles();
  }

  function aplicarFiltroDaltonismo(tipo) {
    var mapa = {
      deuteranopia: 'url(#filtro-deuteranopia)',
      protanopia:   'url(#filtro-protanopia)',
      tritanopia:   'url(#filtro-tritanopia)',
      acromatopsia: 'url(#filtro-acromatopsia)',
    };
    document.documentElement.style.filter = mapa[tipo] || '';
  }

  // ── CONTROLE DO PAINEL SLIDE-OVER (MODAL) ──
  function abrirFecharPainel() {
    var painel = document.getElementById('painelAcessibilidade');
    if (!painel) return;

    var estaAberto = painel.classList.contains('acc-aberto');
    if (estaAberto) {
      fecharPainel();
    } else {
      abrirPainel();
    }
  }

  function abrirPainel() {
    var painel = document.getElementById('painelAcessibilidade');
    var overlay = document.getElementById('accOverlay');
    var btn = document.getElementById('alternarAcessibilidade');
    if (painel) {
      painel.classList.add('acc-aberto');
      painel.style.setProperty('left', '0px', 'important');
    }
    if (overlay) {
      overlay.classList.add('acc-aberto');
      overlay.style.setProperty('opacity', '1', 'important');
      overlay.style.setProperty('pointer-events', 'auto', 'important');
    }
    if (btn) btn.setAttribute('aria-expanded', 'true');
    atualizarUiControles();
  }

  function fecharPainel() {
    var painel = document.getElementById('painelAcessibilidade');
    var overlay = document.getElementById('accOverlay');
    var btn = document.getElementById('alternarAcessibilidade');
    if (painel) {
      painel.classList.remove('acc-aberto');
      painel.style.removeProperty('left');
    }
    if (overlay) {
      overlay.classList.remove('acc-aberto');
      overlay.style.removeProperty('opacity');
      overlay.style.removeProperty('pointer-events');
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  // ── SINCRONIZAR UI DOS CONTROLES DO PAINEL ──
  function atualizarUiControles() {
    setChk('toggleAltoContraste', prefs.altoContraste);
    setChk('toggleDyslexia',      prefs.dyslexia);
    setChk('toggleCursorGrande',  prefs.cursorGrande);
    setChk('toggleFocoAlto',      prefs.focoAlto);
    setChk('toggleMovimento',     prefs.semAnimacoes);
    setChk('toggleVlibras',       prefs.vlibras);
    setSel('selectorDaltonismo',  prefs.daltonismo);
    setSel('selectorVelocidade',  String(prefs.velocidadeVoz || 1.0));
    atualizarDisplayEscala();
  }

  function atualizarDisplayEscala() {
    var el = document.getElementById('displayEscalaFonte');
    if (el) el.textContent = Math.round((prefs.escalaFonte || 1.0) * 100) + '%';
  }

  function setChk(id, val) {
    var el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  }

  function setSel(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = String(val);
  }

  // ── FONTE ──
  function aumentarFonte() {
    prefs.escalaFonte = Math.min(1.8, parseFloat(((prefs.escalaFonte || 1.0) + 0.1).toFixed(2)));
    document.documentElement.style.setProperty('--acc-escala', prefs.escalaFonte);
    atualizarDisplayEscala();
    salvarEstado();
  }

  function diminuirFonte() {
    prefs.escalaFonte = Math.max(0.7, parseFloat(((prefs.escalaFonte || 1.0) - 0.1).toFixed(2)));
    document.documentElement.style.setProperty('--acc-escala', prefs.escalaFonte);
    atualizarDisplayEscala();
    salvarEstado();
  }

  function resetarFonte() {
    prefs.escalaFonte = 1.0;
    document.documentElement.style.setProperty('--acc-escala', '1');
    atualizarDisplayEscala();
    salvarEstado();
  }

  // ── LEITURA POR VOZ ──
  function iniciarLeitura() {
    if (!synth) {
      alert('Seu navegador não suporta síntese de voz.');
      return;
    }
    if (lendoAtualmente) {
      pararLeitura();
      return;
    }

    var raiz = document.getElementById('conteudo') || document.querySelector('main') || document.body;
    elementosParaLer = [];
    raiz.querySelectorAll('h1,h2,h3,h4,p,li,td,th,button').forEach(function (el) {
      var txt = el.innerText ? el.innerText.trim() : '';
      if (txt.length > 2 && el.offsetHeight > 0) {
        elementosParaLer.push({ el: el, txt: txt });
      }
    });

    if (!elementosParaLer.length) return;
    lendoAtualmente = true;
    indiceAtual = 0;
    synth.cancel();
    lerProximo();
  }

  function lerProximo() {
    if (!lendoAtualmente || indiceAtual >= elementosParaLer.length) {
      pararLeitura();
      return;
    }
    if (elementoDestacado) elementoDestacado.classList.remove('acc-lendo-ativo');
    var item = elementosParaLer[indiceAtual];
    item.el.classList.add('acc-lendo-ativo');
    try {
      item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}
    elementoDestacado = item.el;

    var utter = new SpeechSynthesisUtterance(item.txt);
    utter.lang = 'pt-BR';
    utter.rate = Number(prefs.velocidadeVoz) || 1.0;
    utter.onend = function () {
      indiceAtual++;
      lerProximo();
    };
    utter.onerror = function () {
      pararLeitura();
    };
    synth.speak(utter);
  }

  function pararLeitura() {
    if (synth) synth.cancel();
    lendoAtualmente = false;
    if (elementoDestacado) {
      elementoDestacado.classList.remove('acc-lendo-ativo');
      elementoDestacado = null;
    }
    elementosParaLer = [];
  }

  // ── RESETAR TUDO ──
  function resetarTudo() {
    if (!confirm('Deseja desativar a acessibilidade e resetar todas as preferências?')) return;
    ativado = false;
    prefs = Object.assign({}, DEFAULTS);
    salvarEstado();
    pararLeitura();
    aplicarTudo();
    fecharPainel();
  }

  // ── VINCULAR EVENTOS DO PAINEL ──
  function vincularControles() {
    var btnAlternar = document.getElementById('alternarAcessibilidade');
    if (btnAlternar) {
      btnAlternar.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        abrirFecharPainel();
      };
    }

    var btnFechar = document.getElementById('fecharPainelAcessibilidade');
    if (btnFechar) {
      btnFechar.onclick = function (e) {
        e.preventDefault();
        fecharPainel();
      };
    }

    var overlay = document.getElementById('accOverlay');
    if (overlay) {
      overlay.onclick = function () {
        fecharPainel();
      };
    }

    // Leitor de voz
    on('botaoLer', 'click', iniciarLeitura);
    on('botaoParar', 'click', pararLeitura);
    onChg('selectorVelocidade', function (v) {
      prefs.velocidadeVoz = parseFloat(v);
      salvarEstado();
    });

    // Fonte
    on('botaoAumentar', 'click', aumentarFonte);
    on('botaoDiminuir', 'click', diminuirFonte);
    on('botaoResetarFonte', 'click', resetarFonte);

    // Toggles do painel
    onTgl('toggleAltoContraste', function (v) {
      prefs.altoContraste = v;
      aplicarTudo();
      salvarEstado();
    });
    onTgl('toggleDyslexia', function (v) {
      prefs.dyslexia = v;
      aplicarTudo();
      salvarEstado();
    });
    onTgl('toggleCursorGrande', function (v) {
      prefs.cursorGrande = v;
      aplicarTudo();
      salvarEstado();
    });
    onTgl('toggleFocoAlto', function (v) {
      prefs.focoAlto = v;
      aplicarTudo();
      salvarEstado();
    });
    onTgl('toggleMovimento', function (v) {
      prefs.semAnimacoes = v;
      aplicarTudo();
      salvarEstado();
    });
    onTgl('toggleVlibras', function (v) {
      prefs.vlibras = v;
      aplicarVlibras();
      salvarEstado();
    });

    onChg('selectorDaltonismo', function (v) {
      prefs.daltonismo = v;
      aplicarFiltroDaltonismo(v);
      salvarEstado();
    });

    on('botaoResetarAcessibilidade', 'click', resetarTudo);
  }

  function on(id, evt, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }
  function onTgl(id, fn) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function (e) {
        fn(e.target.checked);
      });
    }
  }
  function onChg(id, fn) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', function (e) {
        fn(e.target.value);
      });
    }
  }

  // ── ATALHOS DE TECLADO ──
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var p = document.getElementById('painelAcessibilidade');
      if (p && p.classList.contains('acc-aberto')) {
        fecharPainel();
        return;
      }
    }
    if (!ativado || !e.altKey) return;
    switch (e.key.toLowerCase()) {
      case 'a':
        e.preventDefault();
        abrirFecharPainel();
        break;
      case 'l':
        e.preventDefault();
        iniciarLeitura();
        break;
      case 's':
        e.preventDefault();
        pararLeitura();
        break;
      case 'c':
        e.preventDefault();
        prefs.altoContraste = !prefs.altoContraste;
        aplicarTudo();
        salvarEstado();
        break;
    }
  });

  // ── API PÚBLICA GLOBAL (window.Acessibilidade) ──
  window.Acessibilidade = {
    ativar: function () {
      ativado = true;
      salvarEstado();
      aplicarTudo();
    },
    desativar: function () {
      ativado = false;
      salvarEstado();
      aplicarTudo();
    },
    isAtivado: function () {
      return Boolean(ativado);
    },
    setPref: function (chave, valor) {
      if (chave in prefs) {
        prefs[chave] = valor;
        salvarEstado();
        if (chave === 'vlibras') {
          aplicarVlibras();
        } else {
          aplicarTudo();
        }
      }
    },
    getPref: function (chave) {
      return prefs[chave];
    },
    abrirPainel:    abrirPainel,
    fecharPainel:   fecharPainel,
    togglePainel:   abrirFecharPainel,
    resetar:        resetarTudo,
    iniciarLeitura: iniciarLeitura,
    pararLeitura:   pararLeitura,
    aumentarFonte:  aumentarFonte,
    diminuirFonte:  diminuirFonte,
    resetarFonte:   resetarFonte,
  };

  // ── INICIALIZAÇÃO NO CARREGAMENTO DO DOM ──
  function initDom() {
    aplicarTudo();
    vincularControles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDom);
  } else {
    initDom();
  }
})();
