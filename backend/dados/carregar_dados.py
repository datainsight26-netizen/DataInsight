from flask import session, jsonify, request
from backend.dados.agregador import obter_contexto_dados


def carregar_dados():
    """Carrega os dados do usuário (individual ou consolidado multi-planilhas)"""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"colunas": [], "dados": []}), 200

    tabela_id = request.args.get('tabela_id', 'todas')

    try:
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id)
        return jsonify({
            "colunas": contexto.get("colunas", []),
            "dados": contexto.get("dados", []),
            "nome_contexto": contexto.get("nome_contexto", "Consolidado"),
            "planilhas_envolvidas": contexto.get("planilhas_envolvidas", []),
            "escopo": contexto.get("escopo", "todas")
        }), 200
    except Exception as e:
        print(f"Erro ao carregar dados: {e}")
        return jsonify({
            "colunas": [],
            "dados": []
        }), 200

