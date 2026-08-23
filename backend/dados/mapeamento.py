from flask import session, request, jsonify
from backend.db import usuario
from bson import ObjectId
import pandas as pd

# ─────────────────────────────────────────────────────────────
# MAPEAMENTO BÁSICO (colunas genéricas → categorias padrão)
# ─────────────────────────────────────────────────────────────

def _get_user_filter(user_id):
    return {"_id": ObjectId(user_id)} if (user_id and ObjectId.is_valid(str(user_id))) else {"_id": user_id}


def obter_mapeamento():
    """Recupera o mapeamento de colunas do usuário"""
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401
    
    user = usuario.find_one(_get_user_filter(user_id))
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
        _get_user_filter(user_id),
        {"$set": {"mapeamento": dados}}
    )
    
    return jsonify({"mensagem": "Mapeamento salvo com sucesso"}), 200


# ─────────────────────────────────────────────────────────────
# MAPEAMENTO FINANCEIRO EXPANDIDO
# ─────────────────────────────────────────────────────────────

def obter_mapeamento_financeiro():
    """
    Recupera o mapeamento financeiro completo do usuário.
    Inclui: mapeamento salvo + análise de completude por ferramenta + recomendações.
    """
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    user = usuario.find_one(_get_user_filter(user_id))
    if not user:
        return jsonify({"mensagem": "Usuário não encontrado"}), 404

    mapeamento = user.get("mapeamento_financeiro", {})
    if not mapeamento:
        base = user.get("mapeamento", {})
        if base:
            mapeamento = {}
            if base.get("data"): mapeamento["periodo"] = base["data"]
            if base.get("faturamento"): mapeamento["receita_total"] = base["faturamento"]
            if base.get("despesa"): mapeamento["despesas"] = base["despesa"]
            if base.get("lucro"): mapeamento["resultado"] = base["lucro"]

    # ── DEBUG: Imprimir mapeamento financeiro salvo no banco ──────────
    print("\n" + "="*60, flush=True)
    print("[DEBUG] MAPEAMENTO FINANCEIRO CARREGADO DO BANCO (usuario_id:", user_id, ")", flush=True)
    print("="*60, flush=True)
    import json
    if mapeamento:
        for chave, valor in mapeamento.items():
            print(f"  {chave}: {valor!r}", flush=True)
    else:
        print("  (mapeamento vazio — nenhuma categoria configurada)", flush=True)
    print("="*60 + "\n", flush=True)

    # Agora, buscar os dados reais do banco e imprimir os valores de cada coluna mapeada
    try:
        from backend.db import dados_colecao
        doc_ativo = dados_colecao.find_one(
            {"usuario_id": user_id},
            sort=[("atualizado_em", -1), ("criado_em", -1)]
        )
        if doc_ativo and doc_ativo.get("dados") and mapeamento:
            linhas = doc_ativo.get("dados", [])
            colunas_bd = doc_ativo.get("colunas", [])
            print("[DEBUG] VALORES DAS COLUNAS FINANCEIRAS NO BANCO:", flush=True)
            print("-"*60, flush=True)
            for cat_id, col_nome in mapeamento.items():
                if cat_id.endswith("_manual"):
                    print(f"  {cat_id} (valor fixo manual): {col_nome!r}", flush=True)
                    continue
                if col_nome and col_nome in colunas_bd:
                    valores = [linha.get(col_nome) for linha in linhas]
                    print(f"  {cat_id} → coluna '{col_nome}': {valores}", flush=True)
                else:
                    print(f"  {cat_id} → coluna '{col_nome}': (coluna não encontrada na tabela)", flush=True)
            print("-"*60 + "\n", flush=True)
        elif not doc_ativo:
            print("[DEBUG] Nenhuma tabela de dados encontrada no banco para este usuário.\n", flush=True)
    except Exception as e:
        print(f"[DEBUG] Erro ao buscar dados para debug: {e}\n", flush=True)
    # ─────────────────────────────────────────────────────────────────

    # Análise de completude por ferramenta
    from backend.dados.classificacao_financeira import analisar_completude_financeira, gerar_recomendacoes
    completude = analisar_completude_financeira(mapeamento)
    recomendacoes = gerar_recomendacoes(mapeamento)

    return jsonify({
        "mapeamento": mapeamento,
        "completude": completude,
        "recomendacoes": recomendacoes,
    }), 200


def salvar_mapeamento_financeiro():
    """
    Salva o mapeamento financeiro completo do usuário e sincroniza com o mapeamento básico e a tabela ativa.
    """
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    dados_raw = request.get_json()
    if dados_raw is None:
        return jsonify({"mensagem": "Dados inválidos"}), 400

    # Limpar chaves vazias do payload (evita persistir valores removidos)
    dados = {
        k: v for k, v in dados_raw.items()
        if v not in ("", None, "null", "undefined")
    }

    # ── DEBUG: Imprimir o mapeamento que está sendo salvo ─────────────
    import json
    print("\n" + "="*60, flush=True)
    print("[DEBUG] SALVANDO MAPEAMENTO FINANCEIRO (usuario_id:", user_id, ")", flush=True)
    print("="*60, flush=True)
    if dados:
        for chave, valor in dados.items():
            print(f"  {chave}: {valor!r}", flush=True)
    else:
        print("  (payload vazio)", flush=True)
    print("="*60 + "\n", flush=True)
    # ─────────────────────────────────────────────────────────────────

    mapeamento_basico = {
        "data": dados.get("periodo") or dados.get("data") or "",
        "faturamento": dados.get("receita_total") or dados.get("receita_produtos") or dados.get("faturamento") or "",
        "despesa": dados.get("despesas") or dados.get("custo_variavel") or dados.get("fornecedores") or dados.get("despesa") or "",
        "lucro": dados.get("resultado") or dados.get("lucro") or ""
    }

    # Capturar mapeamento financeiro anterior para detectar remoções de valores manuais
    user_before = usuario.find_one(_get_user_filter(user_id))
    prev_map_fin = user_before.get("mapeamento_financeiro", {}) if user_before else {}

    usuario.update_one(
        _get_user_filter(user_id),
        {"$set": {
            "mapeamento_financeiro": dados,
            "mapeamento": mapeamento_basico
        }}
    )

    # Sincronizar valores fixos manuais com a tabela ativa no MongoDB
    try:
        from backend.db import dados_colecao
        from datetime import datetime
        doc_ativo = dados_colecao.find_one(
            {"usuario_id": user_id},
            sort=[("atualizado_em", -1), ("criado_em", -1)]
        )
        if doc_ativo and doc_ativo.get("dados"):
            linhas = doc_ativo.get("dados", [])
            colunas = doc_ativo.get("colunas", [])
            modificado = False

            def _val_vazio(v):
                """Retorna True se o valor é considerado vazio/zero para preenchimento automático."""
                if v in ("", None, "0", "0.0"):
                    return True
                try:
                    return float(v) == 0.0
                except (TypeError, ValueError):
                    return False

            def _valores_iguais(a, b):
                """Compara dois valores ignorando diferenças de tipo (float vs str vs int)."""
                if a is None and b is None:
                    return True
                if a is None or b is None:
                    return False
                try:
                    return abs(float(a) - float(b)) < 1e-9
                except (TypeError, ValueError):
                    return str(a).strip() == str(b).strip()

            # 1) Aplicar novos valores manuais presentes no payload
            for chave, val in dados.items():
                if not chave.endswith("_manual"):
                    continue

                cat_id = chave[:-7]
                col_nome = dados.get(cat_id)

                # Se novo valor manual está presente, aplicar onde campo vazio
                if val not in ("", None):
                    if col_nome and col_nome in colunas:
                        for linha in linhas:
                            if _val_vazio(linha.get(col_nome)):
                                linha[col_nome] = val
                                modificado = True

            # 2) Detectar chaves manuais que existiam antes e agora foram removidas
            #    (chave não presente no payload OU payload enviou string vazia)
            removed_manual_keys = [
                k for k in prev_map_fin.keys()
                if k.endswith('_manual') and (k not in dados or dados.get(k) in ("", None))
            ]
            for chave in removed_manual_keys:
                prev_val = prev_map_fin.get(chave)
                if prev_val in (None, ""):
                    continue
                cat_id = chave[:-7]
                col_nome = dados.get(cat_id) or prev_map_fin.get(cat_id)
                if not col_nome or col_nome not in colunas:
                    continue
                # Limpar células que contenham exatamente o valor previamente propagado
                # Usa comparação de tipo-agnóstica para pegar float, int e string
                for linha in linhas:
                    if _valores_iguais(linha.get(col_nome), prev_val):
                        linha[col_nome] = ""
                        modificado = True

            if modificado:
                dados_colecao.update_one(
                    {"_id": doc_ativo["_id"]},
                    {"$set": {"dados": linhas, "atualizado_em": datetime.now()}}
                )
    except Exception as e:
        print(f"Aviso ao sincronizar valores manuais com tabela ativa: {e}", flush=True)

    # Retornar completude atualizada
    from backend.dados.classificacao_financeira import analisar_completude_financeira, gerar_recomendacoes
    completude = analisar_completude_financeira(dados)
    recomendacoes = gerar_recomendacoes(dados)

    return jsonify({
        "mensagem": "Mapeamento financeiro salvo com sucesso",
        "mapeamento": dados,
        "completude": completude,
        "recomendacoes": recomendacoes,
    }), 200


def analisar_colunas_financeiras():
    """
    Recebe as colunas disponíveis e analisa automaticamente quais
    correspondem a cada categoria financeira.
    Body JSON esperado: { "colunas": ["Col A", "Col B", ...], "dados_amostra": [[...], ...] }
    """
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    colunas = payload.get("colunas", [])
    dados_amostra = payload.get("dados_amostra", [])

    if not colunas:
        return jsonify({"mensagem": "Nenhuma coluna fornecida"}), 400

    # Montar DataFrame de amostra para análise comportamental
    try:
        df = pd.DataFrame(dados_amostra, columns=colunas) if dados_amostra else pd.DataFrame(columns=colunas)
    except ValueError:
        df = pd.DataFrame(columns=colunas)
    except Exception:
        df = pd.DataFrame(columns=colunas)

    from backend.dados.classificacao_financeira import classificar_colunas_financeiras, LABELS_CATEGORIAS
    analise = classificar_colunas_financeiras(df)

    return jsonify({
        "analise": analise["colunas"],
        "mapeamento_sugerido": analise["mapeamento_sugerido"],
        "categorias_disponiveis": {
            k: v for k, v in LABELS_CATEGORIAS.items()
        },
    }), 200


def preview_financeiro():
    """
    Calcula um preview dos indicadores financeiros com base no mapeamento atual.
    Body JSON esperado: { "mapeamento": {...}, "dados_amostra": [[...]], "colunas": [...] }
    """
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    mapeamento = payload.get("mapeamento", {})
    colunas = payload.get("colunas", [])
    dados_amostra = payload.get("dados_amostra", [])

    try:
        df = pd.DataFrame(dados_amostra, columns=colunas) if dados_amostra else pd.DataFrame(columns=colunas)
    except ValueError:
        df = pd.DataFrame(columns=colunas)
    except Exception:
        df = pd.DataFrame()

    # ── DEBUG: Imprimir cada atributo financeiro com todos os seus valores ──
    if mapeamento and not df.empty:
        print("\n" + "="*60, flush=True)
        print("[DEBUG] PREVIEW FINANCEIRO — DADOS POR CATEGORIA:", flush=True)
        print("="*60, flush=True)
        for cat_id, col_nome in mapeamento.items():
            if cat_id.endswith("_manual"):
                print(f"  {cat_id} (valor fixo manual): {col_nome!r}", flush=True)
                continue
            if col_nome and col_nome in df.columns:
                valores = df[col_nome].tolist()
                print(f"  {cat_id} → '{col_nome}': {valores}", flush=True)
            else:
                print(f"  {cat_id} → '{col_nome}': (coluna não encontrada nos dados)", flush=True)
        print("="*60 + "\n", flush=True)
    # ───────────────────────────────────────────────────────────────────────

    try:
        from backend.dados.classificacao_financeira import calcular_preview_financeiro
        preview = calcular_preview_financeiro(mapeamento, df)
        # ── DEBUG: Imprimir os indicadores calculados ──────────────────────
        print("[DEBUG] INDICADORES FINANCEIROS CALCULADOS:", flush=True)
        print("-"*60, flush=True)
        import json
        print(json.dumps(preview, ensure_ascii=False, indent=2), flush=True)
        print("-"*60 + "\n", flush=True)
        # ───────────────────────────────────────────────────────────────────
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"mensagem": "Erro interno no cálculo do preview", "erro": str(e)}), 500

    return jsonify({"preview": preview}), 200


def criar_coluna_financeira_api():
    """
    Cria uma nova coluna na planilha ativa do banco de dados (se houver)
    e vincula automaticamente a categoria financeira ao usuário.
    Body JSON: { "nome_coluna": "Faturamento", "categoria_id": "receita_total", "valor_padrao": 0.0 }
    """
    from backend.db import dados_colecao
    from datetime import datetime

    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    nome_coluna = str(payload.get("nome_coluna", "")).strip()
    categoria_id = str(payload.get("categoria_id", "")).strip()
    valor_padrao = payload.get("valor_padrao", "")
    tipo = payload.get("tipo", "moeda")

    if not nome_coluna or not categoria_id:
        return jsonify({"mensagem": "Nome da coluna e categoria são obrigatórios"}), 400

    # Converter valor_padrao se numérico
    val_limpo = valor_padrao
    if tipo in ("moeda", "numero", "percentual") and valor_padrao not in ("", None):
        try:
            val_limpo = float(str(valor_padrao).replace(",", ".").strip())
        except Exception:
            val_limpo = valor_padrao

    # 1. Atualizar documento de dados mais recente/ativo do usuário se existir
    doc_recente = dados_colecao.find_one(
        {"usuario_id": user_id},
        sort=[("atualizado_em", -1), ("criado_em", -1)]
    )

    colunas_atualizadas = []
    if doc_recente:
        colunas = doc_recente.get("colunas", [])
        if nome_coluna not in colunas:
            colunas.append(nome_coluna)

        dados = doc_recente.get("dados", [])
        if not dados:
            dados = [{c: (val_limpo if c == nome_coluna else "") for c in colunas}]
        else:
            for linha in dados:
                if nome_coluna not in linha or linha[nome_coluna] in ("", None):
                    linha[nome_coluna] = val_limpo

        dados_colecao.update_one(
            {"_id": doc_recente["_id"]},
            {
                "$set": {
                    "colunas": colunas,
                    "dados": dados,
                    "atualizado_em": datetime.now()
                }
            }
        )
        colunas_atualizadas = colunas

    # 2. Atualizar mapeamento_financeiro do usuário no MongoDB
    user = usuario.find_one({"_id": ObjectId(user_id)})
    mapeamento_fin = user.get("mapeamento_financeiro", {}) if user else {}
    mapeamento_fin[categoria_id] = nome_coluna
    if val_limpo not in ("", None):
        mapeamento_fin[f"{categoria_id}_manual"] = val_limpo

    # Sincronizar mapeamento básico
    mapeamento_basico = {
        "data": mapeamento_fin.get("periodo") or mapeamento_fin.get("data") or "",
        "faturamento": mapeamento_fin.get("receita_total") or mapeamento_fin.get("receita_produtos") or mapeamento_fin.get("faturamento") or "",
        "despesa": mapeamento_fin.get("despesas") or mapeamento_fin.get("custo_variavel") or mapeamento_fin.get("fornecedores") or mapeamento_fin.get("despesa") or "",
        "lucro": mapeamento_fin.get("resultado") or mapeamento_fin.get("lucro") or ""
    }

    usuario.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "mapeamento_financeiro": mapeamento_fin,
            "mapeamento": mapeamento_basico
        }}
    )

    from backend.dados.classificacao_financeira import analisar_completude_financeira, gerar_recomendacoes
    completude = analisar_completude_financeira(mapeamento_fin)
    recomendacoes = gerar_recomendacoes(mapeamento_fin)

    return jsonify({
        "mensagem": f"Coluna '{nome_coluna}' criada e vinculada com sucesso à categoria '{categoria_id}'!",
        "colunas": colunas_atualizadas,
        "mapeamento": mapeamento_fin,
        "completude": completude,
        "recomendacoes": recomendacoes
    }), 200

