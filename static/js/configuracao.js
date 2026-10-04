/**
 * configuracao.js
 * Configuração — DataInsight
 *
 * Responsável por:
 *   - Sincronizar o ícone/rótulo do tema claro/escuro
 *   - Gerenciar o estado do controle mestre de acessibilidade
 *   - Sincronizar os checkboxes e seletores com as preferências salvas
 *   - Vincular alterações de UI às preferências via window.Acessibilidade
 *   - Controle de abertura da sidebar
 *
 * ------------------------------------------------------------------------------
 * PROPRIEDADE INTELECTUAL
 * ------------------------------------------------------------------------------
 * Este código pertence à plataforma @DataInsight. Todos os arquivos da plataforma
 * devem seguir esta mesma estrutura de organização: seções numeradas
 * sequencialmente com cabeçalhos padronizados, separação clara de
 * responsabilidades e agrupamento lógico de funções afins.
 * ------------------------------------------------------------------------------
 */

'use strict';

// ==============================================================================
// 1. SINCRONIZAÇÃO DE TEMA (CLARO / ESCURO)
// ==============================================================================
function sincronizarTema() {
    const icone  = document.getElementById('iconeTema');
    const texto  = document.getElementById('textoTema');
    const isDark = document.body.classList.contains('tema-escuro');

    if (icone) icone.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    if (texto) texto.textContent = isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro';

    const btnTema = document.getElementById('btnTema');
    if (btnTema) {
        btnTema.innerHTML = isDark
            ? '<i class="fa-solid fa-sun"></i>'
            : '<i class="fa-solid fa-moon"></i>';
    }
}

// ==============================================================================
// 2. UI DO CONTROLE MESTRE DE ACESSIBILIDADE
// ==============================================================================
/**
 * Atualiza o rótulo e a visibilidade do bloco de opções conforme o master switch.
 * @param {boolean} ativo
 */
function atualizarMasterUI(ativo) {
    const label     = document.getElementById('cfgAccLabel');
    const optsBlock = document.getElementById('cfgAccOpts');

    if (label) {
        label.textContent = ativo ? 'ATIVADO' : 'Desativado';
        label.className   = 'cfg-switch-label ' + (ativo ? 'on' : 'off');
    }
    if (optsBlock) {
        optsBlock.style.display = ativo ? 'block' : 'none';
    }
}

// ==============================================================================
// 3. SINCRONIZAÇÃO DO FORMULÁRIO DE ACESSIBILIDADE
// ==============================================================================
/**
 * Lê as preferências armazenadas em window.Acessibilidade e reflete no formulário.
 */
function sincronizarFormulario() {
    const acc = window.Acessibilidade;
    if (!acc) return;

    const chaves = [
        ['cfgAltoContraste', 'altoContraste'],
        ['cfgDyslexia',      'dyslexia'],
        ['cfgCursorGrande',  'cursorGrande'],
        ['cfgFocoAlto',      'focoAlto'],
        ['cfgSemAnimacoes',  'semAnimacoes'],
        ['cfgVlibras',       'vlibras'],
    ];

    chaves.forEach(([id, pref]) => {
        const el = document.getElementById(id);
        if (el) el.checked = Boolean(acc.getPref(pref));
    });

    const selDal = document.getElementById('cfgDaltonismo');
    if (selDal) selDal.value = acc.getPref('daltonismo') || 'nenhum';

    const selVel = document.getElementById('cfgVelocidadeVoz');
    if (selVel) selVel.value = String(acc.getPref('velocidadeVoz') || 1.0);
}

// ==============================================================================
// 4. VÍNCULO DE CHECKBOXES COM PREFERÊNCIAS
// ==============================================================================
/**
 * Vincula um checkbox de configuração à preferência correspondente e
 * espelha o estado para o toggle do painel principal.
 * @param {string} id   ID do elemento checkbox
 * @param {string} pref Chave da preferência em window.Acessibilidade
 */
function vincularChkCfg(id, pref) {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', () => {
        if (window.Acessibilidade) {
            window.Acessibilidade.setPref(pref, el.checked);
        }

        const idMapa = {
            altoContraste: 'toggleAltoContraste',
            dyslexia:      'toggleDyslexia',
            cursorGrande:  'toggleCursorGrande',
            focoAlto:      'toggleFocoAlto',
            semAnimacoes:  'toggleMovimento',
            vlibras:       'toggleVlibras',
        };

        const painelToggle = document.getElementById(idMapa[pref]);
        if (painelToggle) painelToggle.checked = el.checked;
    });
}

// ==============================================================================
// 5. INICIALIZAÇÃO DAS CONFIGURAÇÕES DE ACESSIBILIDADE
// ==============================================================================
function iniciarConfiguracoes() {
    const acc = window.Acessibilidade;
    if (!acc) return;

    // ---- Master switch --------------------------------------------------------
    const toggle      = document.getElementById('cfgToggleAcc');
    const estaAtivado = acc.isAtivado();

    if (toggle) {
        toggle.checked = estaAtivado;
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                acc.ativar();
            } else {
                acc.desativar();
            }
            atualizarMasterUI(toggle.checked);
            sincronizarFormulario();
        });
    }

    atualizarMasterUI(estaAtivado);
    sincronizarFormulario();

    // ---- Botões de Voz --------------------------------------------------------
    const btnLer   = document.getElementById('cfgBtnLer');
    const btnParar = document.getElementById('cfgBtnParar');
    if (btnLer)   btnLer.addEventListener('click',   () => acc.iniciarLeitura());
    if (btnParar) btnParar.addEventListener('click', () => acc.pararLeitura());

    // ---- Seletor de velocidade de voz ----------------------------------------
    const selVel = document.getElementById('cfgVelocidadeVoz');
    if (selVel) {
        selVel.addEventListener('change', () => {
            acc.setPref('velocidadeVoz', parseFloat(selVel.value));
            const sp = document.getElementById('selectorVelocidade');
            if (sp) sp.value = selVel.value;
        });
    }

    // ---- Botões de Fonte ------------------------------------------------------
    const btnAumentar = document.getElementById('cfgBtnAumentar');
    const btnDiminuir = document.getElementById('cfgBtnDiminuir');
    const btnResetar  = document.getElementById('cfgBtnResetar');
    if (btnAumentar) btnAumentar.addEventListener('click', () => acc.aumentarFonte());
    if (btnDiminuir) btnDiminuir.addEventListener('click', () => acc.diminuirFonte());
    if (btnResetar)  btnResetar.addEventListener('click',  () => acc.resetarFonte());

    // ---- Checkboxes -----------------------------------------------------------
    vincularChkCfg('cfgAltoContraste', 'altoContraste');
    vincularChkCfg('cfgDyslexia',      'dyslexia');
    vincularChkCfg('cfgCursorGrande',  'cursorGrande');
    vincularChkCfg('cfgFocoAlto',      'focoAlto');
    vincularChkCfg('cfgSemAnimacoes',  'semAnimacoes');
    vincularChkCfg('cfgVlibras',       'vlibras');

    // ---- Seletor de daltonismo -----------------------------------------------
    const selDal = document.getElementById('cfgDaltonismo');
    if (selDal) {
        selDal.addEventListener('change', () => {
            acc.setPref('daltonismo', selDal.value);
            const sp = document.getElementById('selectorDaltonismo');
            if (sp) sp.value = selDal.value;
        });
    }
}

// ==============================================================================
// 6. CONTROLE DA SIDEBAR
// ==============================================================================
function abrirSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
}

// ==============================================================================
// 7. INICIALIZAÇÃO NO CARREGAMENTO DO DOM
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    sincronizarTema();
    iniciarConfiguracoes();
});