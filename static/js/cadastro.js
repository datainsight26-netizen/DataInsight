/**
 * cadastro.js
 * Formulário de Cadastro — DataInsight
 *
 * Responsável por:
 *   - Alternar visibilidade de senhas (toggle)
 *   - Seleção manual/sugerida de perfil (MEI / ME)
 *   - Máscara e consulta de CNPJ à BrasilAPI
 *   - Máscara de telefone (BR)
 *   - Validação de senhas e envio do formulário
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
// 1. TOGGLE DE VISIBILIDADE DE SENHA
// ==============================================================================
function togglePass(id, btn) {
    const input = document.getElementById(id);
    const icon  = btn.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ==============================================================================
// 2. REFERÊNCIAS DE ELEMENTOS DO FORMULÁRIO
// ==============================================================================
const telInput      = document.getElementById('telefone');
const cnpjInput     = document.getElementById('cnpj');
const cnpjFeedback  = document.getElementById('cnpjFeedback');
const senhaInput    = document.getElementById('senha');
const confirmaInput = document.getElementById('confirmar');
const msgEl         = document.getElementById('mensagem');
const form          = document.getElementById('formularioCadastro');

// ==============================================================================
// 3. SELEÇÃO DE PERFIL (MEI / ME)
// ==============================================================================
/**
 * Seleciona o perfil tributário manualmente, marcando o radio e destacando o card.
 * @param {'MEI'|'ME'} tipo
 */
function selecionarPerfilManual(tipo) {
    const radioMEI = document.getElementById('radioMEI');
    const radioME  = document.getElementById('radioME');
    const cardMEI  = document.getElementById('cardPerfilMEI');
    const cardME   = document.getElementById('cardPerfilME');

    if (tipo === 'MEI') {
        if (radioMEI) radioMEI.checked = true;
        if (cardMEI)  cardMEI.classList.add('selected');
        if (cardME)   cardME.classList.remove('selected');
    } else {
        if (radioME)  radioME.checked = true;
        if (cardME)   cardME.classList.add('selected');
        if (cardMEI)  cardMEI.classList.remove('selected');
    }
}

// ==============================================================================
// 4. MÁSCARA E CONSULTA DE CNPJ (BrasilAPI)
// ==============================================================================
let timerConsultaCnpj = null;

/**
 * Formata o valor digitado aplicando a máscara 00.000.000/0000-00
 * @param {string} v dígitos puros (até 14)
 * @returns {string}
 */
function formatarCnpj(v) {
    if (v.length > 12) {
        return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})$/, '$1.$2.$3/$4-$5');
    } else if (v.length > 8) {
        return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (v.length > 5) {
        return v.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (v.length > 2) {
        return v.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }
    return v;
}

/**
 * Exibe o feedback do CNPJ (resetando display inline que possa ter sido setado por
 * uma chamada anterior a ocultarFeedbackCnpj).
 */
function exibirFeedbackCnpj(classe, html) {
    if (!cnpjFeedback) return;
    cnpjFeedback.className    = classe;
    cnpjFeedback.innerHTML    = html;
    cnpjFeedback.style.display = 'block';
}

/**
 * Oculta o feedback do CNPJ.
 */
function ocultarFeedbackCnpj() {
    if (!cnpjFeedback) return;
    cnpjFeedback.className     = 'cnpj-status-box';
    cnpjFeedback.style.display = 'none';
}

if (cnpjInput) {
    cnpjInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);

        // Aplica máscara
        e.target.value = formatarCnpj(v);

        clearTimeout(timerConsultaCnpj);

        if (v.length === 14) {
            exibirFeedbackCnpj(
                'cnpj-status-box carregando',
                '<i class="fa-solid fa-circle-notch fa-spin"></i> Consultando CNPJ na Receita Federal...'
            );

            timerConsultaCnpj = setTimeout(() => {
                fetch(`/api/consultar-cnpj/${v}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.sucesso) {
                            const badgeTexto = data.is_mei ? '✨ MEI Identificado' : '🏢 Microempresa (ME)';
                            exibirFeedbackCnpj(
                                'cnpj-status-box sucesso',
                                `<i class="fa-solid fa-circle-check"></i> <strong>${data.razao_social}</strong> (${badgeTexto})`
                            );

                            // Preencher campos ocultos
                            const rsEl = document.getElementById('razao_social');
                            const daEl = document.getElementById('data_abertura');
                            if (rsEl) rsEl.value = data.razao_social   || '';
                            if (daEl) daEl.value = data.data_abertura  || '';

                            // Selecionar perfil sugerido automaticamente
                            if (data.tipo_perfil) {
                                selecionarPerfilManual(data.tipo_perfil);
                            }
                        } else {
                            exibirFeedbackCnpj(
                                'cnpj-status-box erro',
                                `<i class="fa-solid fa-circle-exclamation"></i> ${data.mensagem || 'CNPJ não localizado na Receita.'}`
                            );
                        }
                    })
                    .catch(err => {
                        console.error(err);
                        ocultarFeedbackCnpj();
                    });
            }, 400);
        } else if (v.length === 0) {
            ocultarFeedbackCnpj();
        } else {
            exibirFeedbackCnpj(
                'cnpj-status-box carregando',
                `<i class="fa-solid fa-pen"></i> Digite os 14 dígitos do CNPJ... (${v.length}/14)`
            );
        }
    });
}

// ==============================================================================
// 5. MÁSCARA DE TELEFONE (BR)
// ==============================================================================
if (telInput) {
    telInput.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);

        if (v.length > 10) {
            e.target.value = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        } else if (v.length > 6) {
            e.target.value = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
        } else if (v.length > 2) {
            e.target.value = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
        } else if (v.length > 0) {
            e.target.value = '(' + v;
        } else {
            e.target.value = '';
        }
    });
}

// ==============================================================================
// 6. VALIDAÇÃO DE SENHAS E TELEFONE
// ==============================================================================
function validar() {
    const s           = senhaInput.value;
    const c           = confirmaInput.value;
    const telDigitos  = telInput ? telInput.value.replace(/\D/g, '') : '';

    // Validação de telefone (se preenchido)
    if (telInput && telDigitos.length > 0 && (telDigitos.length < 10 || telDigitos.length > 11)) {
        msgEl.textContent = '✕ Informe um número de celular válido com DDD';
        msgEl.className   = 'auth-field-msg auth-field-msg--error';
        telInput.classList.add('auth-input--error');
        telInput.focus();
        return false;
    }
    if (telInput) telInput.classList.remove('auth-input--error');

    // Validação de tamanho mínimo da senha
    if (s.length > 0 && s.length < 8) {
        msgEl.textContent = '✕ Senha deve ter no mínimo 8 caracteres';
        msgEl.className   = 'auth-field-msg auth-field-msg--error';
        senhaInput.classList.add('auth-input--error');
        return false;
    }

    // Confirmação de senha
    if (c.length > 0 && s !== c) {
        msgEl.textContent = '✕ As senhas não coincidem';
        msgEl.className   = 'auth-field-msg auth-field-msg--error';
        confirmaInput.classList.add('auth-input--error');
        return false;
    }

    // Sucesso
    if (s.length >= 8 && s === c) {
        msgEl.textContent = '✓ Dados válidos';
        msgEl.className   = 'auth-field-msg auth-field-msg--success';
        senhaInput.classList.remove('auth-input--error');
        senhaInput.classList.add('auth-input--success');
        confirmaInput.classList.remove('auth-input--error');
        confirmaInput.classList.add('auth-input--success');
        return true;
    }

    // Estado neutro (ex.: campos ainda vazios)
    msgEl.textContent = '';
    msgEl.className   = 'auth-field-msg';
    return true;
}

// ==============================================================================
// 7. EVENTOS DE VALIDAÇÃO E SUBMISSÃO
// ==============================================================================
senhaInput.addEventListener('input', validar);
confirmaInput.addEventListener('input', validar);

form.addEventListener('submit', (e) => {
    if (!validar()) {
        e.preventDefault();
        return;
    }
    const btn = document.getElementById('btnCadastrar');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando conta...';
    btn.disabled  = true;
});