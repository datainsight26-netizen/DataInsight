from datetime import datetime
from flask import request, jsonify, session
from bson import ObjectId
from backend.db import dados_colecao, usuario as usuarios_colecao
from backend.dados.dados import limpar_dados_conservador, converter_para_tipos_nativos


from backend.dados.agregador import detectar_dominio_tabela, DOMINIOS_CONFIG


def listar_todas_tabelas():
    """
    Retorna todas as tabelas (planilhas) salvas do usuário no MongoDB com metadados de domínio.
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        docs = list(dados_colecao.find(
            {"usuario_id": usuario_id},
            sort=[("atualizado_em", -1), ("criado_em", -1)]
        ))

        tabelas = []
        for doc in docs:
            dados = doc.get("dados", [])
            colunas = doc.get("colunas", [])
            criado_em = doc.get("criado_em")
            atualizado_em = doc.get("atualizado_em")
            nome = doc.get("nome_planilha", "Planilha")
            
            dominio = doc.get("tipo_dominio")
            if not dominio or dominio not in DOMINIOS_CONFIG:
                dominio = detectar_dominio_tabela(nome, colunas, dados)

            cfg_dom = DOMINIOS_CONFIG.get(dominio, DOMINIOS_CONFIG["MISTA_GERAL"])

            tabelas.append({
                "id": str(doc["_id"]),
                "nome": nome,
                "colunas": colunas,
                "dados": dados,
                "total_linhas": len(dados),
                "tipo_dominio": dominio,
                "dominio_label": cfg_dom["label"],
                "dominio_icone": cfg_dom["icone"],
                "dominio_cor": cfg_dom["cor"],
                "tipo_fluxo": cfg_dom["tipo_fluxo"],
                "criado_em": criado_em.isoformat() if isinstance(criado_em, datetime) else str(criado_em or ""),
                "atualizado_em": atualizado_em.isoformat() if isinstance(atualizado_em, datetime) else str(atualizado_em or "")
            })

        # Verificar preferência persistida do usuário
        tabela_ativa_id = None
        usuario_doc = usuarios_colecao.find_one({"_id": ObjectId(usuario_id)}, {"tabela_ativa_id": 1}) if ObjectId.is_valid(str(usuario_id)) else None
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
            "total": len(tabelas)
        }), 200
    except Exception as e:
        print(f"Erro ao listar tabelas: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao listar tabelas", "erro": str(e)}), 500


def obter_tabela(tabela_id):
    """
    Obtém uma tabela específica do usuário pelo ID.
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        doc = None
        if ObjectId.is_valid(tabela_id):
            doc = dados_colecao.find_one({"_id": ObjectId(tabela_id), "usuario_id": usuario_id})

        if not doc:
            # Fallback por nome ou string id
            doc = dados_colecao.find_one({"usuario_id": usuario_id, "$or": [{"nome_planilha": tabela_id}, {"tabela_id": tabela_id}]})

        if not doc:
            # Fallback para a tabela mais recente do usuário se o ID for antigo
            doc = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])

        if not doc:
            return jsonify({"mensagem": "Tabela não encontrada", "dados": [], "colunas": []}), 200

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
            "criado_em": criado_em.isoformat() if isinstance(criado_em, datetime) else str(criado_em or ""),
            "atualizado_em": atualizado_em.isoformat() if isinstance(atualizado_em, datetime) else str(atualizado_em or "")
        }), 200
    except Exception as e:
        print(f"Erro ao obter tabela {tabela_id}: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao carregar tabela", "erro": str(e)}), 500


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
    import pandas as pd
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    tabela_id = payload.get("id") or payload.get("tabela_id")
    nome = str(payload.get("nome") or payload.get("nome_planilha") or "Planilha").strip()
    colunas = payload.get("colunas", [])
    dados = payload.get("dados", [])
    tipo_dominio = payload.get("tipo_dominio")

    if not colunas and not dados:
        return jsonify({"mensagem": "Colunas e dados inválidos"}), 400

    try:
        # Limpar dados conservadoramente sem alterar nomes de colunas
        df = pd.DataFrame(dados, columns=colunas)
        df = limpar_dados_conservador(df)
        colunas_limpas = [str(c) for c in df.columns.tolist()]
        dados_limpos = converter_para_tipos_nativos(df.to_dict('records'))

        if not tipo_dominio or tipo_dominio not in DOMINIOS_CONFIG:
            tipo_dominio = detectar_dominio_tabela(nome, colunas_limpas, dados_limpos)

        cfg_dom = DOMINIOS_CONFIG.get(tipo_dominio, DOMINIOS_CONFIG["MISTA_GERAL"])
        doc_id = None

        if tabela_id and ObjectId.is_valid(tabela_id):
            # Atualiza documento existente
            resultado = dados_colecao.update_one(
                {"_id": ObjectId(tabela_id), "usuario_id": usuario_id},
                {
                    "$set": {
                        "nome_planilha": nome,
                        "colunas": colunas_limpas,
                        "dados": dados_limpos,
                        "tipo_dominio": tipo_dominio,
                        "atualizado_em": datetime.now()
                    }
                }
            )
            if resultado.matched_count > 0:
                doc_id = tabela_id

        if not doc_id:
            # Insere novo documento de tabela
            novo_doc = {
                "usuario_id": usuario_id,
                "nome_planilha": nome,
                "colunas": colunas_limpas,
                "dados": dados_limpos,
                "tipo_dominio": tipo_dominio,
                "criado_em": datetime.now(),
                "atualizado_em": datetime.now()
            }
            res = dados_colecao.insert_one(novo_doc)
            doc_id = str(res.inserted_id)

        # Salvar produtos no histórico de autocomplete
        try:
            from backend.dados.salvar_dados import extrair_e_salvar_produtos
            extrair_e_salvar_produtos(usuario_id, colunas_limpas, dados_limpos)
        except Exception as err:
            print(f"Aviso produtos autocomplete: {err}", flush=True)

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
            "tipo_fluxo": cfg_dom["tipo_fluxo"]
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"mensagem": "Erro ao salvar tabela", "erro": str(e)}), 500


def renomear_tabela_api(tabela_id):
    """
    Renomeia uma tabela existente do usuário.
    Body JSON: { "nome": "Novo Nome" }
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    novo_nome = str(payload.get("nome", "")).strip()

    if not novo_nome:
        return jsonify({"mensagem": "Nome não pode ser vazio"}), 400

    try:
        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        resultado = dados_colecao.update_one(
            filtro,
            {"$set": {"nome_planilha": novo_nome, "atualizado_em": datetime.now()}}
        )

        if resultado.matched_count == 0:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        return jsonify({"mensagem": f"Tabela renomeada para '{novo_nome}' com sucesso!", "nome": novo_nome}), 200

    except Exception as e:
        return jsonify({"mensagem": "Erro ao renomear tabela", "erro": str(e)}), 500


def duplicar_tabela_api(tabela_id):
    """
    Duplica uma tabela existente criando uma cópia com todas as linhas e colunas.
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            return jsonify({"mensagem": "Tabela original não encontrada"}), 404

        novo_nome = f"{doc.get('nome_planilha', 'Planilha')} (Cópia)"
        novo_doc = {
            "usuario_id": usuario_id,
            "nome_planilha": novo_nome,
            "colunas": list(doc.get("colunas", [])),
            "dados": [dict(linha) for linha in doc.get("dados", [])],
            "criado_em": datetime.now(),
            "atualizado_em": datetime.now()
        }

        res = dados_colecao.insert_one(novo_doc)
        novo_id = str(res.inserted_id)

        return jsonify({
            "mensagem": f"Tabela duplicada como '{novo_nome}'!",
            "id": novo_id,
            "nome": novo_nome,
            "colunas": novo_doc["colunas"],
            "dados": novo_doc["dados"],
            "total_linhas": len(novo_doc["dados"])
        }), 201

    except Exception as e:
        return jsonify({"mensagem": "Erro ao duplicar tabela", "erro": str(e)}), 500


def excluir_tabela_api(tabela_id):
    """
    Exclui uma tabela específica do usuário.
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        # Verificar quantas tabelas o usuário possui
        total = dados_colecao.count_documents({"usuario_id": usuario_id})
        if total <= 1:
            return jsonify({"mensagem": "Não é possível excluir a única tabela existente."}), 400

        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        res = dados_colecao.delete_one(filtro)
        if res.deleted_count == 0:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        return jsonify({"mensagem": "Tabela excluída com sucesso!"}), 200

    except Exception as e:
        return jsonify({"mensagem": "Erro ao excluir tabela", "erro": str(e)}), 500


def ativar_tabela_api(tabela_id):
    """
    Marca uma tabela específica como ativa e atualiza seu timestamp no MongoDB,
    garantindo que todas as páginas do sistema utilizem seus dados.
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    try:
        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            # Fallback para a tabela mais recente do usuário se o ID for obsoleto
            doc = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])
            
        if not doc:
            return jsonify({"mensagem": "Nenhuma tabela para ativar", "id": None}), 200

        tabela_obj_id = doc["_id"]

        # Atualizar timestamp da tabela ativada
        dados_colecao.update_one(
            {"_id": tabela_obj_id},
            {"$set": {"atualizado_em": datetime.now()}}
        )

        # Persistir a preferência de tabela ativa no perfil do usuário
        if ObjectId.is_valid(str(usuario_id)):
            usuarios_colecao.update_one(
                {"_id": ObjectId(usuario_id)},
                {"$set": {"tabela_ativa_id": str(tabela_obj_id)}}
            )

        return jsonify({
            "mensagem": f"Tabela '{doc.get('nome_planilha', 'Planilha')}' ativada com sucesso!",
            "id": str(tabela_obj_id),
            "nome": doc.get("nome_planilha", "Planilha")
        }), 200

    except Exception as e:
        print(f"Erro ao ativar tabela {tabela_id}: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao ativar tabela", "erro": str(e)}), 500


def definir_dominio_tabela(tabela_id):
    """
    Atualiza a categoria de domínio de uma planilha salva (ex: RECEITAS_VENDAS, DESPESAS_ALUGUEL, etc.)
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    dados = request.get_json() or {}
    novo_dominio = dados.get("tipo_dominio")
    nome_planilha = dados.get("nome")

    if not novo_dominio or novo_dominio not in DOMINIOS_CONFIG:
        return jsonify({"mensagem": "Domínio inválido", "dominios_validos": list(DOMINIOS_CONFIG.keys())}), 400

    try:
        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(tabela_id):
            filtro["_id"] = ObjectId(tabela_id)
        elif nome_planilha:
            filtro["nome_planilha"] = nome_planilha
        else:
            filtro["nome_planilha"] = tabela_id

        doc = dados_colecao.find_one(filtro)
        if not doc:
            # Fallback para a tabela mais recente do usuário
            doc = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])

        if not doc:
            return jsonify({"mensagem": "Tabela não encontrada"}), 404

        dados_colecao.update_one(
            {"_id": doc["_id"]},
            {"$set": {"tipo_dominio": novo_dominio, "atualizado_em": datetime.now()}}
        )

        cfg = DOMINIOS_CONFIG[novo_dominio]
        return jsonify({
            "mensagem": f"Domínio da planilha atualizado para '{cfg['label']}'",
            "id": str(doc["_id"]),
            "tipo_dominio": novo_dominio,
            "dominio_label": cfg["label"],
            "dominio_cor": cfg["cor"],
            "dominio_icone": cfg["icone"],
            "tipo_fluxo": cfg["tipo_fluxo"]
        }), 200

    except Exception as e:
        print(f"Erro ao definir domínio da tabela {tabela_id}: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao salvar domínio", "erro": str(e)}), 500


def obter_sumario_planilhas():
    """
    Endpoint para retornar o resumo leve de todas as planilhas do usuário (para alimentar seletores de contexto em todas as telas).
    """
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado", "planilhas": [], "total": 0}), 401

    try:
        from backend.dados.agregador import listar_planilhas_usuario
        planilhas = listar_planilhas_usuario(usuario_id)
        return jsonify({
            "planilhas": planilhas,
            "total": len(planilhas),
            "dominios_disponiveis": DOMINIOS_CONFIG
        }), 200
    except Exception as e:
        print(f"Erro ao obter sumário de planilhas: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao carregar sumário", "erro": str(e), "planilhas": [], "total": 0}), 500


