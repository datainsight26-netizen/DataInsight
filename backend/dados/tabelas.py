# ==============================================================================
# tabelas.py
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

import time
import traceback
from datetime import datetime

import pandas as pd
from bson import ObjectId
from flask import jsonify, request, session

from backend.dados.agregador import DOMINIOS_CONFIG, detectar_dominio_tabela
from backend.dados.dados import converter_para_tipos_nativos, limpar_dados_conservador
from backend.db import dados_colecao
from backend.db import usuario as usuarios_colecao


# ==============================================================================
# 2. AUXILIARES
# ==============================================================================

def _filtro_usuario(usuario_id):
    """Retorna busca unificada por usuario_id suportando string e ObjectId"""
    ids_user = [str(usuario_id)]
    if ObjectId.is_valid(str(usuario_id)):
        ids_user.append(ObjectId(str(usuario_id)))
    return {"usuario_id": {"$in": ids_user}}


def _iso_ou_str(valor):
    """Serializa um datetime como ISO 8601; qualquer outro valor é convertido para str."""
    return valor.isoformat() if isinstance(valor, datetime) else str(valor or "")


# ==============================================================================
# 3. ENDPOINT: LISTAGEM DE TABELAS
# ==============================================================================

def listar_todas_tabelas():
    """
    Retorna todas as tabelas (planilhas) salvas do usuário no MongoDB com metadados de domínio.
    Usa projeção sem 'dados' para evitar transferência desnecessária de dados via SSL.
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 3.1 Consulta com retry (mitiga falhas transitórias SSL/Mongo)
        # ----------------------------------------------------------------------
        docs = []
        for tentativa in range(3):
            try:
                docs = list(
                    dados_colecao.find(
                        _filtro_usuario(usuario_id),
                        {"dados": 0},  # exclui array pesado — não precisamos dos registros para o sumário
                        sort=[("atualizado_em", -1), ("criado_em", -1)],
                    )
                )
                break
            except Exception as e_ssl:
                if tentativa < 2:
                    time.sleep(0.4)
                else:
                    raise e_ssl

        # ----------------------------------------------------------------------
        # 3.2 Montagem do sumário
        # ----------------------------------------------------------------------
        tabelas = []
        for doc in docs:
            colunas = doc.get("colunas", [])
            criado_em = doc.get("criado_em")
            atualizado_em = doc.get("atualizado_em")
            nome = doc.get("nome_planilha", "Planilha")
            # Usa total_linhas salvo no documento, ou 0 (sem carregar o array 'dados')
            total_linhas = doc.get("total_linhas", 0)

            dominio = doc.get("tipo_dominio")
            if not dominio or dominio not in DOMINIOS_CONFIG:
                dominio = detectar_dominio_tabela(nome, colunas, [])

            cfg_dom = DOMINIOS_CONFIG.get(dominio, DOMINIOS_CONFIG["MISTA_GERAL"])

            tabelas.append({
                "id": str(doc["_id"]),
                "nome": nome,
                "colunas": colunas,
                "dados": [],  # vazio aqui — carregado só quando necessário (obter_tabela)
                "total_linhas": total_linhas,
                "tipo_dominio": dominio,
                "dominio_label": cfg_dom["label"],
                "dominio_icone": cfg_dom["icone"],
                "dominio_cor": cfg_dom["cor"],
                "tipo_fluxo": cfg_dom["tipo_fluxo"],
                "criado_em": _iso_ou_str(criado_em),
                "atualizado_em": _iso_ou_str(atualizado_em),
            })

        # ----------------------------------------------------------------------
        # 3.3 Resolução da tabela ativa (preferência persistida → fallback)
        # ----------------------------------------------------------------------
        tabela_ativa_id = None
        usuario_doc = (
            usuarios_colecao.find_one(
                {"_id": ObjectId(usuario_id)}, {"tabela_ativa_id": 1}
            )
            if ObjectId.is_valid(str(usuario_id))
            else None
        )
        if usuario_doc and usuario_doc.get("tabela_ativa_id"):
            tabela_ativa_id_salvo = str(usuario_doc["tabela_ativa_id"])
            # Confirmar que a tabela ainda existe
            if any(t["id"] == tabela_ativa_id_salvo for t in tabelas):
                tabela_ativa_id = tabela_ativa_id_salvo

        # Fallback: primeira tabela (mais recente)
        if not tabela_ativa_id and tabelas:
            tabela_ativa_id = tabelas[0]["id"]

        return jsonify({
            "tabelas": tabelas,
            "tabela_ativa_id": tabela_ativa_id,
            "total": len(tabelas),
        }), 200
    except Exception as e:
        print(f"Erro ao listar tabelas: {e}", flush=True)
        return jsonify({
            "mensagem": "Erro ao listar tabelas",
            "erro": str(e),
        }), 500


# ==============================================================================
# 4. ENDPOINT: OBTER TABELA ESPECÍFICA
# ==============================================================================

def obter_tabela(tabela_id):
    """
    Obtém uma tabela específica do usuário pelo ID.
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 4.1 Consulta com fallbacks progressivos
        # ----------------------------------------------------------------------
        filtro_base = _filtro_usuario(usuario_id)
        doc = None
        if ObjectId.is_valid(tabela_id):
            doc = dados_colecao.find_one({"_id": ObjectId(tabela_id), **filtro_base})

        if not doc:
            # Fallback por nome ou string id
            doc = dados_colecao.find_one({
                **filtro_base,
                "$or": [{"nome_planilha": tabela_id}, {"tabela_id": tabela_id}],
            })

        if not doc:
            # Fallback para a tabela mais recente do usuário se o ID for antigo
            doc = dados_colecao.find_one(
                filtro_base,
                sort=[("atualizado_em", -1), ("criado_em", -1)],
            )

        if not doc:
            return jsonify({
                "mensagem": "Tabela não encontrada",
                "dados": [],
                "colunas": [],
            }), 200

        # ----------------------------------------------------------------------
        # 4.2 Resposta
        # ----------------------------------------------------------------------
        dados = doc.get("dados", [])
        colunas = doc.get("colunas", [])
        criado_em = doc.get("criado_em")
        atualizado_em = doc.get("atualizado_em")

        return jsonify({
            "id": str(doc["_id"]),
            "nome": doc.get("nome_planilha", "Planilha"),
            "colunas": colunas,
            "dados": dados,
            "total_linhas": len(dados),
            "criado_em": _iso_ou_str(criado_em),
            "atualizado_em": _iso_ou_str(atualizado_em),
        }), 200
    except Exception as e:
        print(f"Erro ao obter tabela {tabela_id}: {e}", flush=True)
        return jsonify({
            "mensagem": "Erro ao carregar tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 5. ENDPOINT: CRIAR OU ATUALIZAR TABELA
# ==============================================================================

def salvar_tabela_especifica():
    """
    Cria ou atualiza uma tabela específica do usuário.
    Body JSON: {
        "id": "...", // opcional (se existir, atualiza; senão cria)
        "nome": "Vendas 2024",
        "colunas": ["Faturamento", "Despesas", ...],
        "dados": [...]
    }
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    # --------------------------------------------------------------------------
    # 5.1 Leitura do payload
    # --------------------------------------------------------------------------
    payload = request.get_json() or {}
    tabela_id = payload.get("id") or payload.get("tabela_id")
    nome = str(
        payload.get("nome") or payload.get("nome_planilha") or "Planilha"
    ).strip()
    colunas = payload.get("colunas", [])
    dados = payload.get("dados", [])
    tipo_dominio = payload.get("tipo_dominio")

    if not colunas and not dados:
        return jsonify({"mensagem": "Colunas e dados inválidos"}), 400

    try:
        # ----------------------------------------------------------------------
        # 5.2 Limpeza conservadora
        # ----------------------------------------------------------------------
        df = pd.DataFrame(dados, columns=colunas)
        df = limpar_dados_conservador(df)
        colunas_limpas = [str(c) for c in df.columns.tolist()]
        dados_limpos = converter_para_tipos_nativos(df.to_dict("records"))

        # ----------------------------------------------------------------------
        # 5.3 Detecção de domínio (se não informado)
        # ----------------------------------------------------------------------
        if not tipo_dominio or tipo_dominio not in DOMINIOS_CONFIG:
            tipo_dominio = detectar_dominio_tabela(
                nome, colunas_limpas, dados_limpos
            )

        cfg_dom = DOMINIOS_CONFIG.get(tipo_dominio, DOMINIOS_CONFIG["MISTA_GERAL"])
        doc_id = None

        # ----------------------------------------------------------------------
        # 5.4 Atualização de documento existente
        # ----------------------------------------------------------------------
        if tabela_id and ObjectId.is_valid(tabela_id):
            resultado = dados_colecao.update_one(
                {"_id": ObjectId(tabela_id), **_filtro_usuario(usuario_id)},
                {
                    "$set": {
                        "nome_planilha": nome,
                        "colunas": colunas_limpas,
                        "dados": dados_limpos,
                        "tipo_dominio": tipo_dominio,
                        "total_linhas": len(dados_limpos),
                        "atualizado_em": datetime.now(),
                    }
                },
            )
            if resultado.matched_count > 0:
                doc_id = tabela_id

        # ----------------------------------------------------------------------
        # 5.5 Inserção de novo documento
        # ----------------------------------------------------------------------
        if not doc_id:
            novo_doc = {
                "usuario_id": usuario_id,
                "nome_planilha": nome,
                "colunas": colunas_limpas,
                "dados": dados_limpos,
                "tipo_dominio": tipo_dominio,
                "total_linhas": len(dados_limpos),
                "criado_em": datetime.now(),
                "atualizado_em": datetime.now(),
            }
            res = dados_colecao.insert_one(novo_doc)
            doc_id = str(res.inserted_id)

        # ----------------------------------------------------------------------
        # 5.6 Salvar produtos no histórico de autocomplete
        # ----------------------------------------------------------------------
        try:
            from backend.dados.salvar_dados import extrair_e_salvar_produtos

            extrair_e_salvar_produtos(usuario_id, colunas_limpas, dados_limpos)
        except Exception as err:
            print(f"Aviso produtos autocomplete: {err}", flush=True)

        # ----------------------------------------------------------------------
        # 5.7 Resposta
        # ----------------------------------------------------------------------
        return jsonify({
            "mensagem": f"Tabela '{nome}' salva com sucesso!",
            "id": doc_id,
            "nome": nome,
            "colunas": colunas_limpas,
            "total_linhas": len(dados_limpos),
            "tipo_dominio": tipo_dominio,
            "dominio_label": cfg_dom["label"],
            "dominio_cor": cfg_dom["cor"],
            "dominio_icone": cfg_dom["icone"],
            "tipo_fluxo": cfg_dom["tipo_fluxo"],
        }), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "mensagem": "Erro ao salvar tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 6. ENDPOINT: RENOMEAR TABELA
# ==============================================================================

def renomear_tabela_api(tabela_id):
    """
    Renomeia uma tabela existente do usuário.
    Body JSON: { "nome": "Novo Nome" }
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    novo_nome = str(payload.get("nome", "")).strip()

    if not novo_nome:
        return jsonify({"mensagem": "Nome não pode ser vazio"}), 400

    try:
        # ----------------------------------------------------------------------
        # 6.1 Montagem do filtro
        # ----------------------------------------------------------------------
        filtro = _filtro_usuario(usuario_id)
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        # ----------------------------------------------------------------------
        # 6.2 Renomeação
        # ----------------------------------------------------------------------
        resultado = dados_colecao.update_one(
            filtro,
            {
                "$set": {
                    "nome_planilha": novo_nome,
                    "atualizado_em": datetime.now(),
                }
            },
        )

        if resultado.matched_count == 0:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        return jsonify({
            "mensagem": f"Tabela renomeada para '{novo_nome}' com sucesso!",
            "nome": novo_nome,
        }), 200

    except Exception as e:
        return jsonify({
            "mensagem": "Erro ao renomear tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 7. ENDPOINT: DUPLICAR TABELA
# ==============================================================================

def duplicar_tabela_api(tabela_id):
    """
    Duplica uma tabela existente criando uma cópia com todas as linhas e colunas.
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 7.1 Localizar tabela original
        # ----------------------------------------------------------------------
        filtro = _filtro_usuario(usuario_id)
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            return jsonify({"mensagem": "Tabela original não encontrada"}), 404

        # ----------------------------------------------------------------------
        # 7.2 Criar cópia (deep copy defensivo)
        # ----------------------------------------------------------------------
        novo_nome = f"{doc.get('nome_planilha', 'Planilha')} (Cópia)"
        novo_doc = {
            "usuario_id": usuario_id,
            "nome_planilha": novo_nome,
            "colunas": list(doc.get("colunas", [])),
            "dados": [dict(linha) for linha in doc.get("dados", [])],
            "criado_em": datetime.now(),
            "atualizado_em": datetime.now(),
        }

        res = dados_colecao.insert_one(novo_doc)
        novo_id = str(res.inserted_id)

        return jsonify({
            "mensagem": f"Tabela duplicada como '{novo_nome}'!",
            "id": novo_id,
            "nome": novo_nome,
            "colunas": novo_doc["colunas"],
            "dados": novo_doc["dados"],
            "total_linhas": len(novo_doc["dados"]),
        }), 201

    except Exception as e:
        return jsonify({
            "mensagem": "Erro ao duplicar tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 8. ENDPOINT: EXCLUIR TABELA
# ==============================================================================

def excluir_tabela_api(tabela_id):
    """
    Exclui uma tabela específica do usuário.
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 8.1 Proteção contra exclusão da última tabela
        # ----------------------------------------------------------------------
        filtro_user = _filtro_usuario(usuario_id)
        total = dados_colecao.count_documents(filtro_user)
        if total <= 1:
            return jsonify({
                "mensagem": "Não é possível excluir a única tabela existente."
            }), 400

        # ----------------------------------------------------------------------
        # 8.2 Exclusão
        # ----------------------------------------------------------------------
        filtro = dict(filtro_user)
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        res = dados_colecao.delete_one(filtro)
        if res.deleted_count == 0:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        return jsonify({"mensagem": "Tabela excluída com sucesso!"}), 200

    except Exception as e:
        return jsonify({
            "mensagem": "Erro ao excluir tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 9. ENDPOINT: ATIVAR TABELA
# ==============================================================================

def ativar_tabela_api(tabela_id):
    """
    Marca uma tabela específica como ativa e atualiza seu timestamp no MongoDB,
    garantindo que todas as páginas do sistema utilizem seus dados.
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 9.1 Localizar tabela (com fallback para a mais recente)
        # ----------------------------------------------------------------------
        filtro = _filtro_usuario(usuario_id)
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            # Fallback para a tabela mais recente do usuário se o ID for obsoleto
            doc = dados_colecao.find_one(
                _filtro_usuario(usuario_id),
                sort=[("atualizado_em", -1), ("criado_em", -1)],
            )

        if not doc:
            return jsonify({"mensagem": "Nenhuma tabela para ativar", "id": None}), 200

        tabela_obj_id = doc["_id"]

        # ----------------------------------------------------------------------
        # 9.2 Atualizar timestamp da tabela ativada
        # ----------------------------------------------------------------------
        dados_colecao.update_one(
            {"_id": tabela_obj_id},
            {"$set": {"atualizado_em": datetime.now()}},
        )

        # ----------------------------------------------------------------------
        # 9.3 Persistir a preferência de tabela ativa no perfil do usuário
        # ----------------------------------------------------------------------
        if ObjectId.is_valid(str(usuario_id)):
            usuarios_colecao.update_one(
                {"_id": ObjectId(usuario_id)},
                {"$set": {"tabela_ativa_id": str(tabela_obj_id)}},
            )

        return jsonify({
            "mensagem": (
                f"Tabela '{doc.get('nome_planilha', 'Planilha')}' ativada com sucesso!"
            ),
            "id": str(tabela_obj_id),
            "nome": doc.get("nome_planilha", "Planilha"),
        }), 200

    except Exception as e:
        print(f"Erro ao ativar tabela {tabela_id}: {e}", flush=True)
        return jsonify({
            "mensagem": "Erro ao ativar tabela",
            "erro": str(e),
        }), 500


# ==============================================================================
# 10. ENDPOINT: DEFINIR DOMÍNIO DA TABELA
# ==============================================================================

def definir_dominio_tabela(tabela_id):
    """
    Atualiza a categoria de domínio de uma planilha salva (ex: RECEITAS_VENDAS, DESPESAS_ALUGUEL, etc.)
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    dados = request.get_json() or {}
    novo_dominio = dados.get("tipo_dominio")
    nome_planilha = dados.get("nome")

    if not novo_dominio or novo_dominio not in DOMINIOS_CONFIG:
        return jsonify({
            "mensagem": "Domínio inválido",
            "dominios_validos": list(DOMINIOS_CONFIG.keys()),
        }), 400

    try:
        # ----------------------------------------------------------------------
        # 10.1 Localizar tabela (com fallback para a mais recente)
        # ----------------------------------------------------------------------
        filtro = _filtro_usuario(usuario_id)
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        elif nome_planilha:
            filtro["nome_planilha"] = nome_planilha
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            # Fallback para a tabela mais recente do usuário
            doc = dados_colecao.find_one(
                _filtro_usuario(usuario_id),
                sort=[("atualizado_em", -1), ("criado_em", -1)],
            )

        if not doc:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        # ----------------------------------------------------------------------
        # 10.2 Atualização do domínio
        # ----------------------------------------------------------------------
        dados_colecao.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "tipo_dominio": novo_dominio,
                    "atualizado_em": datetime.now(),
                }
            },
        )

        cfg = DOMINIOS_CONFIG[novo_dominio]
        return jsonify({
            "mensagem": f"Domínio da planilha atualizado para '{cfg['label']}'",
            "id": str(doc["_id"]),
            "tipo_dominio": novo_dominio,
            "dominio_label": cfg["label"],
            "dominio_cor": cfg["cor"],
            "dominio_icone": cfg["icone"],
            "tipo_fluxo": cfg["tipo_fluxo"],
        }), 200

    except Exception as e:
        print(f"Erro ao definir domínio da tabela {tabela_id}: {e}", flush=True)
        return jsonify({
            "mensagem": "Erro ao salvar domínio",
            "erro": str(e),
        }), 500


# ==============================================================================
# 11. ENDPOINT: SUMÁRIO DE PLANILHAS (para seletores de contexto)
# ==============================================================================

def obter_sumario_planilhas():
    """
    Endpoint para retornar o resumo leve de todas as planilhas do usuário
    (para alimentar seletores de contexto em todas as telas).
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({
            "mensagem": "Não autorizado",
            "planilhas": [],
            "total": 0,
        }), 401

    try:
        from backend.dados.agregador import listar_planilhas_usuario

        planilhas = listar_planilhas_usuario(usuario_id)
        return jsonify({
            "planilhas": planilhas,
            "total": len(planilhas),
            "dominios_disponiveis": DOMINIOS_CONFIG,
        }), 200
    except Exception as e:
        print(f"Erro ao obter sumário de planilhas: {e}", flush=True)
        return jsonify({
            "mensagem": "Erro ao carregar sumário",
            "erro": str(e),
            "planilhas": [],
            "total": 0,
        }), 500