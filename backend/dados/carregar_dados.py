from flask import session, jsonify
def carregar_dados():
    """Carrega os últimos dados salvos do usuário"""
    from backend.db import dados_colecao
    
    usuario_id = session.get('usuario_id')
    
    try:
        # Buscar o documento mais recente do usuário
        documento = dados_colecao.find_one(
            {"usuario_id": usuario_id},
            sort=[("criado_em", -1)]
        )
        
        if documento:
            return jsonify({
                "colunas": documento.get("colunas", []),
                "dados": documento.get("dados", [])
            }), 200
        else:
            return jsonify({
                "colunas": [],
                "dados": []
            }), 200
    except Exception as e:
        print(f"Erro ao carregar dados: {e}")
        return jsonify({
            "colunas": [],
            "dados": []
        }), 200
