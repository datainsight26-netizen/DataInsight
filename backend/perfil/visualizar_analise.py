# ==============================================================================
# visualizar_analise.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import session, redirect, url_for


# ==============================================================================
# 2. VISUALIZAÇÃO DE ANÁLISES
# ==============================================================================

def visualizar_analise(index):
    """
    Seleciona uma análise do histórico da sessão pelo índice e redireciona
    o usuário para a página de análise. Se o índice estiver fora dos limites,
    redireciona de volta para a página de perfil.
    """
    # --------------------------------------------------------------------------
    # 2.1. Recupera o histórico de análises da sessão
    # --------------------------------------------------------------------------
    historico = session.get('analises_realizadas', [])

    # --------------------------------------------------------------------------
    # 2.2. Valida o índice (fora dos limites → volta para o perfil)
    # --------------------------------------------------------------------------
    if index < 0 or index >= len(historico):
        return redirect(url_for('pagina_perfil'))

    # --------------------------------------------------------------------------
    # 2.3. Guarda a análise selecionada e redireciona para a página de análise
    # --------------------------------------------------------------------------
    session['analise_selecionada'] = historico[index]
    return redirect(url_for('pagina_analise'))