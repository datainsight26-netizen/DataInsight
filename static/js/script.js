/**
 * ==============================================================================
 * script.js — DataInsight
 * ==============================================================================
 * Script principal global da plataforma @DataInsight.
 * Gerencia tema visual (Claro / Escuro), sincronização de interface,
 * helpers de acessibilidade, menu responsivo e eventos globais.
 *
 * PROPRIEDADE INTELECTUAL
 * Este código pertence à plataforma @DataInsight. Todos os arquivos da plataforma
 * seguem a mesma estrutura padronizada em seções numeradas sequencialmente.
 * ==============================================================================
 */

'use strict';

// ==============================================================================
// 1. GERENCIAMENTO DE TEMA (MODO CLARO / MODO ESCURO)
// ==============================================================================

const CHAVE_TEMA_STORAGE = 'tema';

/**
 * Retorna o tema atualmente salvo no localStorage ou a preferência do sistema.
 * @returns {'claro' | 'escuro'}
 */
function getTemaSalvo() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA_STORAGE);
    if (salvo === 'escuro' || salvo === 'dark') return 'escuro';
    if (salvo === 'claro' || salvo === 'light') return 'claro';
    
    // Fallback: preferência do sistema operacional
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'escuro';
    }
  } catch (e) {
    console.warn('[DataInsight] Não foi possível ler o tema do localStorage:', e);
  }
  return 'claro';
}

/**
 * Aplica o tema visual no documento (classes CSS, atributos e ícones).
 * @param {'claro' | 'escuro' | string} [temaDesejado]
 */
function setTema(temaDesejado) {
  let tema = temaDesejado;
  if (!tema) {
    tema = getTemaSalvo();
  }

  // Normaliza string
  const isDark = (tema === 'escuro' || tema === 'dark');
  const valorFinal = isDark ? 'escuro' : 'claro';

  const docEl = document.documentElement;
  const bodyEl = document.body;

  // 1.1 Aplica classes CSS nos elementos raiz
  if (docEl) {
    docEl.classList.toggle('dark', isDark);
    docEl.classList.toggle('tema-escuro', isDark);
    docEl.setAttribute('data-tema', valorFinal);
    docEl.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  if (bodyEl) {
    bodyEl.classList.toggle('tema-escuro', isDark);
    bodyEl.classList.toggle('dark', isDark);
  }

  // 1.2 Atualiza o armazenamento local
  try {
    localStorage.setItem(CHAVE_TEMA_STORAGE, valorFinal);
  } catch (e) {
    // Ignora se cookies/storage desabilitados
  }

  // 1.3 Atualiza botões e ícones de tema na interface
  atualizarIconesTema(isDark);

  // 1.4 Se existir sincronizarTema específico da página, dispara
  if (typeof window.sincronizarTema === 'function') {
    try {
      window.sincronizarTema();
    } catch (e) {
      // Ignora erros locais
    }
  }

  // 1.5 Notifica componentes dinâmicos (ApexCharts, Chart.js, etc.)
  try {
    window.dispatchEvent(new CustomEvent('temaAlterado', {
      detail: { tema: valorFinal, isDark: isDark }
    }));
  } catch (e) {
    // Ignora
  }

  return valorFinal;
}

/**
 * Alterna entre modo claro e escuro.
 */
function alternarTema() {
  const isDarkAtual = document.body
    ? document.body.classList.contains('tema-escuro')
    : (getTemaSalvo() === 'escuro');

  const novoTema = isDarkAtual ? 'claro' : 'escuro';
  setTema(novoTema);
  return novoTema;
}

/**
 * Atualiza os botões e ícones que representam a alternância de tema.
 * @param {boolean} isDark
 */
function atualizarIconesTema(isDark) {
  // Botão padrão de cabeçalho / barra de topo
  const btnTema = document.getElementById('btnTema');
  if (btnTema) {
    const icone = btnTema.querySelector('i');
    if (icone) {
      icone.className = isDark ? 'fa-solid fa-sun text-amber-400' : 'fa-solid fa-moon text-blue-500';
    } else {
      btnTema.innerHTML = isDark
        ? '<i class="fa-solid fa-sun text-amber-400"></i>'
        : '<i class="fa-solid fa-moon text-blue-500"></i>';
    }
    btnTema.setAttribute('title', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
    btnTema.setAttribute('aria-label', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
  }

  // Ícones e textos específicos em páginas como perfil e configurações
  const iconeTema = document.getElementById('iconeTema');
  if (iconeTema) {
    iconeTema.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  const textoTema = document.getElementById('textoTema');
  if (textoTema) {
    textoTema.textContent = isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro';
  }

  // Atualiza quaisquer botões com atributo ou classe indicativa
  document.querySelectorAll('[data-tema-toggle]').forEach(el => {
    const icon = el.querySelector('i');
    if (icon) {
      icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
  });
}

// Expõe globalmente no objeto window para chamadas inline (ex: onclick="alternarTema()")
window.setTema = setTema;
window.alternarTema = alternarTema;
window.getTemaSalvo = getTemaSalvo;


// ==============================================================================
// 2. CONTROLE DE MENU MOBILE E NAVEGAÇÃO
// ==============================================================================

function inicializarMenuMobile() {
  const btnMenu = document.getElementById('btnMenuMobile') || document.querySelector('.btn-menu-mobile');
  const menuMobile = document.getElementById('menuMobile') || document.querySelector('.menu-mobile');

  if (btnMenu && menuMobile) {
    btnMenu.addEventListener('click', () => {
      const visivel = !menuMobile.classList.contains('hidden');
      menuMobile.classList.toggle('hidden', visivel);
      btnMenu.setAttribute('aria-expanded', String(!visivel));
    });
  }
}


// ==============================================================================
// 3. INICIALIZAÇÃO IMEDIATA E NO DOMCONTENTLOADED
// ==============================================================================

// Execução imediata (head ou body) para prevenir o flash branco indesejado
(function inicializarTemaImediato() {
  try {
    const tema = getTemaSalvo();
    if (tema === 'escuro') {
      if (document.documentElement) {
        document.documentElement.classList.add('dark', 'tema-escuro');
        document.documentElement.setAttribute('data-tema', 'escuro');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      if (document.body) {
        document.body.classList.add('tema-escuro', 'dark');
      }
    }
  } catch (e) {
    // Ignora
  }
})();

// Execução no ciclo de vida do DOM completo
document.addEventListener('DOMContentLoaded', function () {
  setTema();
  inicializarMenuMobile();
});
