# ==============================================================================
# apagar_dados.py
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

import os
import shutil

from bson.objectid import ObjectId
from flask import current_app, jsonify, session


# ==============================================================================
# 2. ENDPOINT: EXCLUSÃO TOTAL DOS DADOS DO USUÁRIO
# ==============================================================================

def apagar_dados_usuario():
    """
    Exclui todos os dados e tabelas do usuário autenticado garantindo a integridade
    referencial e evitando registros órfãos ou exclusão não autorizada (DEL-07).
    """
    # --------------------------------------------------------------------------
    # 2.1 Autenticação
    # --------------------------------------------------------------------------
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({
            "sucesso": False,
            "mensagem": "Usuário não autenticado",
        }), 401

    try:
        # ----------------------------------------------------------------------
        # 2.2 Import tardio das coleções (evita dependência circular)
        # ----------------------------------------------------------------------
        from backend.db import (
            analises_salvas_colecao,
            dados_colecao,
            galeria,
            produtos_historico,
            relatorios_colecao,
        )

        # ----------------------------------------------------------------------
        # 2.3 Montagem do filtro (suporte a ObjectId e String)
        # ----------------------------------------------------------------------
        ids_busca = [usuario_id, str(usuario_id)]
        if ObjectId.is_valid(usuario_id):
            ids_busca.append(ObjectId(usuario_id))

        filtro = {"usuario_id": {"$in": ids_busca}}

        # ----------------------------------------------------------------------
        # 2.4 Exclusão dos documentos principais (tabelas importadas)
        # ----------------------------------------------------------------------
        resultado_dados = dados_colecao.delete_many(filtro)

        # ----------------------------------------------------------------------
        # 2.5 Exclusão em cascata dos dados derivados (integridade DEL-07)
        # ----------------------------------------------------------------------
        produtos_historico.delete_many(filtro)
        galeria.delete_many(filtro)
        analises_salvas_colecao.delete_many(filtro)
        relatorios_colecao.delete_many(filtro)

        # ----------------------------------------------------------------------
        # 2.6 Limpeza de arquivos residuais em disco
        # ----------------------------------------------------------------------
        try:
            upload_base = current_app.config.get("UPLOAD_FOLDER", "uploads")
            user_folder = os.path.join(upload_base, str(usuario_id))
            if os.path.exists(user_folder):
                shutil.rmtree(user_folder, ignore_errors=True)
        except Exception as ex_disk:
            print(f"⚠ Aviso ao remover arquivos temporários do usuário: {ex_disk}")

        # ----------------------------------------------------------------------
        # 2.7 Resposta de sucesso
        # ----------------------------------------------------------------------
        return jsonify({
            "sucesso": True,
            "mensagem": "Todos os dados foram excluídos com sucesso!",
            "documentos_deletados": resultado_dados.deleted_count,
        }), 200

    except Exception as e:
        print(f"✗ Erro ao apagar dados com integridade: {e}")
        return jsonify({
            "sucesso": False,
            "mensagem": f"Erro ao apagar dados: {str(e)}",
        }), 500