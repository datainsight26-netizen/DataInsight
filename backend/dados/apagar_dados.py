
from flask import session, jsonify
from bson.objectid import ObjectId
from backend.db import (
    dados_colecao,
    chat_historico,
    relatorios_colecao,
    galeria,
    produtos_historico,
    analises_salvas_colecao
)


def expurgar_dados_usuario(usuario_id):
    """
    Executa o expurgo completo dos dados transacionais e analíticos vinculados ao usuário
    em todas as coleções correspondentes, garantindo a integridade da exclusão de dados.
    
    ATENÇÃO: Esta rotina é estritamente de 'apagar dados' (datasets, relatórios, chats, etc.),
    e NÃO remove a conta/cadastro nem altera a assinatura do usuário.
    """
    if not usuario_id:
        return {"sucesso": False, "mensagem": "usuario_id não fornecido"}

    usuario_id_str = str(usuario_id)
    u_ids = [usuario_id_str]

    # Validação com ObjectId.is_valid() antes de converter
    if ObjectId.is_valid(usuario_id_str):
        u_ids.append(ObjectId(usuario_id_str))

    filtro_usuario = {"usuario_id": {"$in": u_ids}}

    try:
        res_dados = dados_colecao.delete_many(filtro_usuario)
        res_chat = chat_historico.delete_many(filtro_usuario)
        res_rel = relatorios_colecao.delete_many(filtro_usuario)
        res_gal = galeria.delete_many(filtro_usuario)
        res_prod = produtos_historico.delete_many(filtro_usuario)
        res_analises = analises_salvas_colecao.delete_many(filtro_usuario)

        total_removidos = (
            res_dados.deleted_count +
            res_chat.deleted_count +
            res_rel.deleted_count +
            res_gal.deleted_count +
            res_prod.deleted_count +
            res_analises.deleted_count
        )

        return {
            "sucesso": True,
            "detalhes": {
                "dados": res_dados.deleted_count,
                "chat_historico": res_chat.deleted_count,
                "relatorios": res_rel.deleted_count,
                "galeria": res_gal.deleted_count,
                "produtos_historico": res_prod.deleted_count,
                "analises_salvas": res_analises.deleted_count
            },
            "total_removidos": total_removidos
        }
    except Exception as e:
        print(f"[ERRO] Erro no expurgo de dados do usuario {usuario_id_str}: {e}")
        return {"sucesso": False, "erro": str(e)}


def apagar_dados_usuario():
    """Deleta todos os dados analíticos e transacionais salvos do usuário autenticado"""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    try:
        resultado = expurgar_dados_usuario(usuario_id)
        if resultado.get("sucesso"):
            return jsonify({
                "mensagem": "Dados deletados com sucesso!",
                "documentos_deletados": resultado.get("total_removidos", 0),
                "detalhes": resultado.get("detalhes", {})
            }), 200
        else:
            return jsonify({"mensagem": "Erro ao apagar dados", "detalhes": resultado.get("erro")}), 500
    except Exception as e:
        print(f"[ERRO] Erro ao apagar dados: {e}")
        return jsonify({"mensagem": "Erro ao apagar dados"}), 500