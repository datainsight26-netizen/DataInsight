/**
 * contato.js
 * Formulário de Contato — DataInsight
 *
 * Responsável por:
 *   - Interceptar o submit do formulário de contato
 *   - Validar campos obrigatórios e formato de e-mail
 *   - Enviar a mensagem via POST /enviar-contato
 *   - Exibir/ocultar feedback visual de sucesso ou erro
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
// 1. INICIALIZAÇÃO — LISTENER DE SUBMIT
// ==============================================================================
document.addEventListener('DOMContentLoaded', function () {
    const formulario = document.getElementById('formulario-contato');
    if (formulario) {
        formulario.addEventListener('submit', async function (e) {
            e.preventDefault();
            await enviarMensagemContato();
        });
    }
});

// ==============================================================================
// 2. ENVIO DA MENSAGEM DE CONTATO
// ==============================================================================
async function enviarMensagemContato() {
    const nome       = document.getElementById('nome').value.trim();
    const email      = document.getElementById('email').value.trim();
    const assuntoEl  = document.getElementById('assunto');
    const assunto    = assuntoEl ? assuntoEl.value : '';
    const mensagem   = document.getElementById('mensagem').value.trim();
    const botao      = document.getElementById('botao-enviar-contato');
    const iconeBotao = document.getElementById('icone-botao');
    const textoBotao = document.getElementById('texto-botao-contato');
    const spinner    = document.getElementById('spinner-botao-contato');

    // ---- Validação de campos obrigatórios ------------------------------------
    if (!nome || !email || !mensagem) {
        mostrarFeedback('erro', 'Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // ---- Validação de formato de e-mail --------------------------------------
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        mostrarFeedback('erro', 'Por favor, insira um endereço de e-mail válido.');
        return;
    }

    try {
        // Estado "enviando" no botão
        botao.disabled = true;
        iconeBotao.style.display = 'none';
        textoBotao.textContent   = 'Enviando...';
        spinner.style.display    = 'inline';

        const response = await fetch('/enviar-contato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, assunto, mensagem })
        });

        const data = await response.json();

        if (response.ok && data.sucesso) {
            mostrarFeedback(
                'sucesso',
                data.mensagem || 'Mensagem enviada com sucesso! Retornaremos em breve.'
            );
            document.getElementById('formulario-contato').reset();
            setTimeout(() => ocultarFeedback(), 6000);
        } else {
            mostrarFeedback(
                'erro',
                data.mensagem || 'Erro ao enviar a mensagem. Tente novamente.'
            );
        }
    } catch (error) {
        mostrarFeedback(
            'erro',
            'Erro de conexão. Verifique sua internet e tente novamente.'
        );
    } finally {
        // Restaura estado do botão
        botao.disabled = false;
        iconeBotao.style.display = '';
        textoBotao.textContent   = 'Enviar Mensagem';
        spinner.style.display    = 'none';
    }
}

// ==============================================================================
// 3. FEEDBACK VISUAL (MOSTRAR / OCULTAR)
// ==============================================================================
/**
 * Exibe a caixa de feedback com ícone e mensagem adequados ao tipo.
 * @param {'erro'|'sucesso'} tipo
 * @param {string} mensagem
 */
function mostrarFeedback(tipo, mensagem) {
    const el     = document.getElementById('mensagem-feedback-contato');
    const icone  = document.getElementById('feedback-icon');
    const texto  = document.getElementById('feedback-texto');
    const isErro = tipo === 'erro';

    el.className      = `contato-feedback contato-feedback--${isErro ? 'erro' : 'sucesso'}`;
    icone.className   = `fa-solid ${isErro ? 'fa-circle-xmark' : 'fa-circle-check'}`;
    texto.textContent = mensagem;
}

/**
 * Oculta a caixa de feedback adicionando a classe utilitária.
 */
function ocultarFeedback() {
    const el = document.getElementById('mensagem-feedback-contato');
    if (el) el.classList.add('contato-feedback--hidden');
}