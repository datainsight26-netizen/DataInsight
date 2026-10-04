// ==============================================================================
// login.js
// ==============================================================================
// Este código pertence à plataforma @DataInsight.
// Todos os códigos da plataforma devem seguir a mesma estrutura de organização
// em seções numeradas, conforme este arquivo.
// ==============================================================================

// ==============================================================================
// 1. ALTERNÂNCIA DE VISIBILIDADE DA SENHA
// ==============================================================================

/**
 * Alterna o tipo do input de senha entre 'password' e 'text'
 * e atualiza o ícone do botão correspondente (fa-eye / fa-eye-slash).
 *
 * @param {string} id  — id do input de senha
 * @param {HTMLElement} btn — botão que contém o ícone a ser alternado
 */
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

// ==============================================================================
// 2. ESTADO DE LOADING NO SUBMIT DO FORMULÁRIO DE LOGIN
// ==============================================================================

document.getElementById('formLogin').addEventListener('submit', () => {
  const btn = document.getElementById('btnEntrar');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
  btn.disabled = true;
});