
from flask import session, jsonify
def apagar_dados_usuario():
    """Deleta os últimos dados salvos do usuário"""
    from backend.db import dados_colecao
    
    usuario_id = session.get('usuario_id')
    
    try:
        # Deletar o documento mais recente do usuário
        resultado = dados_colecao.delete_many({"usuario_id": usuario_id})
        
        return jsonify({
            "mensagem": "Dados deletados com sucesso!",
            "documentos_deletados": resultado.deleted_count
        }), 200
    except Exception as e:
        print(f"Erro ao apagar dados: {e}")
        return jsonify({"mensagem": "Erro ao apagar dados"}), 500