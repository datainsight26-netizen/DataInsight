# ==============================================================================
# carregar_dados.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import jsonify, request, session

from backend.dados.agregador import obter_contexto_dados


# ==============================================================================
# 2. ENDPOINT: CARREGAMENTO DE DADOS DO USUÁRIO
# ==============================================================================

def carregar_dados():
    """Carrega os dados do usuário (individual ou consolidado multi-planilhas)"""

    # --------------------------------------------------------------------------
    # 2.1 Autenticação
    # --------------------------------------------------------------------------
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"colunas": [], "dados": []}), 200

    # --------------------------------------------------------------------------
    # 2.2 Escopo solicitado (tabela específica ou "todas")
    # --------------------------------------------------------------------------
    tabela_id = request.args.get("tabela_id", "todas")

    # --------------------------------------------------------------------------
    # 2.3 Consulta ao agregador federado e resposta
    # --------------------------------------------------------------------------
    try:
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id)
        return jsonify({
            "colunas": contexto.get("colunas", []),
            "dados": contexto.get("dados", []),
            "nome_contexto": contexto.get("nome_contexto", "Consolidado"),
            "planilhas_envolvidas": contexto.get("planilhas_envolvidas", []),
            "escopo": contexto.get("escopo", "todas"),
        }), 200
    except Exception as e:
        print(f"Erro ao carregar dados: {e}")
        return jsonify({
            "colunas": [],
            "dados": [],
        }), 200