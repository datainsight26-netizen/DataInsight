// ==============================================================================
// sessoes.js
// ==============================================================================
// Este código pertence à plataforma @EnterSight.
// Todos os códigos da plataforma devem seguir a mesma estrutura de organização
// em seções numeradas, conforme este arquivo.
//
// Consome os endpoints /api/sessoes e mantém a seção "Dispositivos conectados"
// da página de perfil sincronizada com o backend.
// ==============================================================================

(function () {
  'use strict';

  // ============================================================================
  // 1. ELEMENTOS E ESTADO
  // ============================================================================

  const listaEl = document.getElementById('sessoes-lista');
  if (!listaEl) return;

  const contadorEl = document.getElementById('sessoes-contador');
  const limiteEl = document.getElementById('sessoes-limite');
  const feedbackEl = document.getElementById('sessoes-feedback');
  const btnOutras = document.getElementById('btnEncerrarOutrasSessoes');

  const estado = {
    limite: 3,
    total: 0,
    sessoes: [],
    carregando: false,
  };

  // ============================================================================
  // 2. UTILITÁRIOS
  // ============================================================================

  function formatarData(iso) {
    if (!iso) return 'Não registrado';
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return 'Não registrado';
    return data.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function definirFeedback(mensagem, tipo) {
    if (!feedbackEl) return;
    feedbackEl.textContent = mensagem || '';
    if (tipo) {
      feedbackEl.setAttribute('data-tipo', tipo);
    } else {
      feedbackEl.removeAttribute('data-tipo');
    }
  }

  function classeIcone(tipoDispositivo) {
    const tipo = String(tipoDispositivo || '').toLowerCase();
    if (tipo.includes('celular') || tipo.includes('phone')) return 'fa-mobile-screen-button';
    if (tipo.includes('tablet')) return 'fa-tablet-screen-button';
    return 'fa-desktop';
  }

  function redirecionarParaLogin() {
    window.location.href = '/login?motivo=sessao_encerrada';
  }

  function criarElemento(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function criarMeta(icone, texto) {
    const span = document.createElement('span');
    const i = document.createElement('i');
    i.className = `fa-solid ${icone}`;
    i.setAttribute('aria-hidden', 'true');
    span.appendChild(i);
    span.appendChild(document.createTextNode(texto));
    return span;
  }

  // ============================================================================
  // 3. RENDERIZAÇÃO
  // ============================================================================

  function criarItemSessao(sessao) {
    const item = criarElemento(
      'div',
      `pf-sessao-item${sessao.atual ? ' is-atual' : ''}`
    );

    const info = criarElemento('div', 'pf-sessao-info');

    const icone = criarElemento('div', 'pf-sessao-icon');
    icone.setAttribute('aria-hidden', 'true');
    const iconeInterno = document.createElement('i');
    iconeInterno.className = `fa-solid ${classeIcone(sessao.tipo_dispositivo)}`;
    icone.appendChild(iconeInterno);

    const textos = document.createElement('div');

    const titulo = criarElemento('p', 'pf-sessao-titulo');
    titulo.appendChild(
      criarElemento('span', null, sessao.dispositivo || 'Dispositivo desconhecido')
    );
    if (sessao.atual) {
      const badge = criarElemento('span', 'pf-sessao-badge');
      const check = document.createElement('i');
      check.className = 'fa-solid fa-circle-check';
      check.setAttribute('aria-hidden', 'true');
      badge.appendChild(check);
      badge.appendChild(document.createTextNode('Esta sessão'));
      titulo.appendChild(badge);
    }

    const meta = criarElemento('p', 'pf-sessao-meta');
    meta.appendChild(
      criarMeta('fa-clock', `Último acesso: ${formatarData(sessao.ultimo_acesso_em)}`)
    );
    if (sessao.ip) {
      meta.appendChild(criarMeta('fa-location-dot', `IP: ${sessao.ip}`));
    }
    if (sessao.criado_em) {
      meta.appendChild(criarMeta('fa-calendar-plus', `Início: ${formatarData(sessao.criado_em)}`));
    }

    textos.appendChild(titulo);
    textos.appendChild(meta);
    info.appendChild(icone);
    info.appendChild(textos);

    const acoes = criarElemento('div', 'pf-sessao-acoes');
    const btn = criarElemento('button', 'pf-sessao-btn');
    btn.type = 'button';
    btn.setAttribute(
      'aria-label',
      sessao.atual
        ? 'Encerrar esta sessão e sair deste dispositivo'
        : `Encerrar a sessão de ${sessao.dispositivo || 'dispositivo'}`
    );

    const btnIcone = document.createElement('i');
    btnIcone.className = `fa-solid ${sessao.atual ? 'fa-right-from-bracket' : 'fa-xmark'}`;
    btnIcone.setAttribute('aria-hidden', 'true');
    btn.appendChild(btnIcone);
    btn.appendChild(
      document.createTextNode(sessao.atual ? 'Sair deste dispositivo' : 'Encerrar sessão')
    );

    btn.addEventListener('click', () => encerrarSessao(sessao, btn));
    acoes.appendChild(btn);

    item.appendChild(info);
    item.appendChild(acoes);
    return item;
  }

  function renderizar(dados) {
    estado.limite = Number(dados.limite) || 3;
    estado.total = Number(dados.total) || 0;
    estado.sessoes = Array.isArray(dados.sessoes) ? dados.sessoes : [];

    if (limiteEl) limiteEl.textContent = String(estado.limite);

    if (contadorEl) {
      contadorEl.textContent = `${estado.total} de ${estado.limite} sessões ativas`;
      contadorEl.classList.toggle('is-limitado', estado.total >= estado.limite);
    }

    if (btnOutras) {
      btnOutras.disabled = estado.carregando || estado.total <= 1;
    }

    listaEl.replaceChildren();

    if (estado.sessoes.length === 0) {
      listaEl.appendChild(
        criarElemento(
          'p',
          'pf-sessoes-vazio',
          'Nenhuma sessão ativa encontrada. Faça login novamente se precisar.'
        )
      );
      return;
    }

    estado.sessoes.forEach((sessao) => {
      listaEl.appendChild(criarItemSessao(sessao));
    });
  }

  // ============================================================================
  // 4. CARREGAMENTO
  // ============================================================================

  async function carregarSessoes() {
    if (estado.carregando) return;
    estado.carregando = true;
    if (btnOutras) btnOutras.disabled = true;

    try {
      const resposta = await fetch('/api/sessoes', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });

      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }

      let dados = {};
      try {
        dados = await resposta.json();
      } catch (erroJson) {
        throw new Error('Resposta inválida do servidor.');
      }

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.mensagem || 'Não foi possível carregar as sessões.');
      }

      renderizar(dados);
    } catch (erro) {
      listaEl.replaceChildren();
      listaEl.appendChild(
        criarElemento(
          'p',
          'pf-sessoes-vazio',
          'Não foi possível carregar os dispositivos conectados.'
        )
      );
      definirFeedback(erro.message || 'Falha ao carregar sessões.', 'erro');
    } finally {
      estado.carregando = false;
      if (btnOutras) btnOutras.disabled = estado.total <= 1;
    }
  }

  // ============================================================================
  // 5. AÇÕES DO USUÁRIO
  // ============================================================================

  async function encerrarSessao(sessao, botao) {
    const confirmacao = sessao.atual
      ? 'Encerrar esta sessão e sair deste dispositivo agora?'
      : `Encerrar a sessão de ${sessao.dispositivo || 'dispositivo desconhecido'}?`;

    if (!window.confirm(confirmacao)) return;

    botao.disabled = true;
    definirFeedback('Encerrando sessão...', null);

    try {
      const resposta = await fetch(`/api/sessoes/${encodeURIComponent(sessao.id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.mensagem || 'Não foi possível encerrar a sessão.');
      }

      if (dados.era_sessao_atual) {
        redirecionarParaLogin();
        return;
      }

      definirFeedback(dados.mensagem || 'Sessão encerrada com sucesso.', 'sucesso');
      await carregarSessoes();
    } catch (erro) {
      botao.disabled = false;
      definirFeedback(erro.message || 'Falha ao encerrar a sessão.', 'erro');
    }
  }

  async function encerrarOutrasSessoes() {
    if (!window.confirm('Encerrar todas as outras sessões ativas, mantendo esta?')) return;

    if (btnOutras) {
      btnOutras.disabled = true;
      btnOutras.dataset.textoOriginal = btnOutras.textContent;
      btnOutras.textContent = 'Encerrando...';
    }
    definirFeedback('Encerrando outras sessões...', null);

    try {
      const resposta = await fetch('/api/sessoes/encerrar-outras', {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });

      if (resposta.status === 401) {
        redirecionarParaLogin();
        return;
      }

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.mensagem || 'Não foi possível encerrar as outras sessões.');
      }

      definirFeedback(dados.mensagem || 'Outras sessões encerradas.', 'sucesso');
      await carregarSessoes();
    } catch (erro) {
      definirFeedback(erro.message || 'Falha ao encerrar as outras sessões.', 'erro');
    } finally {
      if (btnOutras) {
        if (btnOutras.dataset.textoOriginal) {
          btnOutras.textContent = btnOutras.dataset.textoOriginal;
          delete btnOutras.dataset.textoOriginal;
        }
        btnOutras.disabled = estado.total <= 1;
      }
    }
  }

  // ============================================================================
  // 6. INICIALIZAÇÃO
  // ============================================================================

  if (btnOutras) {
    btnOutras.addEventListener('click', encerrarOutrasSessoes);
  }

  document.addEventListener('DOMContentLoaded', carregarSessoes);
})();
