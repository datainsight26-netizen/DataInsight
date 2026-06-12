from flask import session, request, jsonify
from backend.db import usuario
from bson import ObjectId

def obter_mapeamento():
    """Recupera o mapeamento de colunas do usuário"""
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401
    
    user = usuario.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"mensagem": "Usuário não encontrado"}), 404
    
    return jsonify(user.get("mapeamento", {})), 200

def salvar_mapeamento():
    """Salva o mapeamento de colunas do usuário"""
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401
    
    dados = request.get_json()
    # Permitir dicionário vazio, mas não None
    if dados is None:
        return jsonify({"mensagem": "Dados inválidos"}), 400
    
    # Mapeamento esperado: { "faturamento": "NomeColuna", "despesa": "NomeColuna", ... }
    usuario.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"mapeamento": dados}}
    )
    
    return jsonify({"mensagem": "Mapeamento salvo com sucesso"}), 200
