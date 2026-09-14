from datetime import datetime
from bson import ObjectId
import pandas as pd
import numpy as np
from flask import session, jsonify, request
from backend.db import dados_colecao, usuario as usuarios_colecao, salvar_dados
from backend.dados.agregador import obter_contexto_dados
from backend.cnpj.cnpj_service import calcular_teto_anual_mei

MESES_NOMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

def _converter_numero(v):
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v) if not np.isnan(v) else 0.0
    try:
        s = str(v).replace("R$", "").replace("r$", "").replace(" ", "").strip()
        if "," in s and "." in s:
            s = s.replace(".", "").replace(",", ".")
        elif "," in s:
            s = s.replace(",", ".")
        return float(s)
    except Exception:
        return 0.0

def _converter_data(v):
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v
    try:
        s = str(v).strip()
        if "/" in s:
            return datetime.strptime(s[:10], "%d/%m/%Y")
        elif "-" in s:
            return datetime.strptime(s[:10], "%Y-%m-%d")
    except Exception:
        pass
    try:
        return pd.to_datetime(v, errors="coerce", dayfirst=True)
    except Exception:
        return None

def obter_dados_controles_essenciais():
    """Calcula e retorna os dados dos Controles Essenciais para o MEI a partir da tabela selecionada."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autenticado"}), 401

    ano_atual = datetime.now().year
    mes_atual = datetime.now().month

    # Obter parâmetros de filtro
    ano_filtro = int(request.args.get("ano", ano_atual))
    mes_filtro = int(request.args.get("mes", mes_atual))
    tabela_id = request.args.get("tabela_id", "todas")

    # Obter informações do usuário (data de abertura do MEI, teto configurado e mapeamentos)
    user_filter = {"_id": ObjectId(usuario_id)} if (usuario_id and ObjectId.is_valid(str(usuario_id))) else {"_id": usuario_id}
    user_doc = None
    try:
        user_doc = usuarios_colecao.find_one(user_filter)
    except Exception:
        user_doc = None

    data_abertura = ""
    teto_anual = 81000.0
    is_proporcional = False
    meses_ativos = 12

    mapeamento_fin = {}
    mapeamento_geral = {}
    if user_doc:
        data_abertura = user_doc.get("data_abertura") or ""
        info_teto = calcular_teto_anual_mei(data_abertura)
        teto_anual = float(user_doc.get("limite_anual_mei") or info_teto.get("teto_anual", 81000.0))
        is_proporcional = info_teto.get("proporcional", False)
        meses_ativos = info_teto.get("meses_ativos", 12)
        mapeamento_fin = user_doc.get("mapeamento_financeiro") or {}
        mapeamento_geral = user_doc.get("mapeamento") or {}

    mapeamento_unificado = {**mapeamento_geral, **mapeamento_fin}

    # Carregar dados via agregador federado inteligente para o escopo escolhido
    try:
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id, mapeamento=mapeamento_unificado)
        dados_raw = contexto.get("dados", [])
    except Exception as e:
        print(f"[Aviso] Erro ao carregar dados para controles essenciais: {e}")
        dados_raw = []
        contexto = {
            "escopo": tabela_id,
            "tabela_id": tabela_id,
            "nome_contexto": "Nenhuma planilha",
            "planilhas_envolvidas": []
        }

    info_contexto = {
        "escopo": contexto.get("escopo", "todas"),
        "tabela_id": contexto.get("tabela_id", tabela_id),
        "nome_contexto": contexto.get("nome_contexto", "Visão Consolidada"),
        "planilhas_envolvidas": contexto.get("planilhas_envolvidas", []),
        "total_planilhas": len(contexto.get("planilhas_envolvidas", []))
    }

    # Se não houver dados, retorna estrutura zerada mantendo contexto
    if not dados_raw:
        return jsonify({
            "sucesso": True,
            "ano": ano_filtro,
            "mes": mes_filtro,
            "mes_nome": MESES_NOMES[mes_filtro - 1],
            "contexto": info_contexto,
            "teto_mei": {
                "limite_anual": teto_anual,
                "proporcional": is_proporcional,
                "meses_ativos": meses_ativos,
                "faturado_ano": 0.0,
                "saldo_restante": teto_anual,
                "percentual_usado": 0.0,
                "status": "seguro",
                "badge": "Faixa Segura",
                "cor": "#10b981",
                "mensagem": "Nenhuma receita registrada nesta tabela. Faturamento sob controle."
            },
            "caixa": {
                "saldo_anterior": 0.0,
                "entradas": 0.0,
                "saidas": 0.0,
                "lucro_periodo": 0.0,
                "saldo_atual": 0.0
            },
            "categorias_saida": {
                "das_mei": 0.0,
                "compras_mercadorias": 0.0,
                "custos_operacionais": 0.0,
                "pro_labore": 0.0,
                "outros": 0.0
            },
            "meses_resumo": [
                {
                    "mes_num": i + 1,
                    "mes_nome": MESES_NOMES[i],
                    "servicos": 0.0,
                    "comercio": 0.0,
                    "entradas": 0.0,
                    "saidas": 0.0,
                    "lucro": 0.0,
                    "acumulado_ano": 0.0
                }
                for i in range(12)
            ],
            "lancamentos_recentes": [],
            "sem_dados": True
        })

    # Normalizar transações em DataFrame
    df = pd.DataFrame(dados_raw)

    def achar_col(padroes):
        for p in padroes:
            for c in df.columns:
                if p in str(c).lower():
                    return c
        return None

    # 1. Colunas mapeadas diretamente pelo usuário
    col_rec_total = mapeamento_fin.get("receita_total") or mapeamento_geral.get("receita")
    col_rec_prod = mapeamento_fin.get("receita_produtos")
    col_rec_serv = mapeamento_fin.get("receita_servicos")
    col_desp_total = mapeamento_fin.get("despesas") or mapeamento_geral.get("despesa")
    col_das_mei = mapeamento_fin.get("das_mei")
    col_fornec = mapeamento_fin.get("fornecedores")
    col_pro_labore = mapeamento_fin.get("pro_labore")
    col_aluguel = mapeamento_fin.get("aluguel")
    col_folha = mapeamento_fin.get("folha_pagamento")
    das_mei_manual = _converter_numero(mapeamento_fin.get("das_mei_manual", 0))

    # 2. Heurísticas para colunas padrão da tabela do usuário
    col_data = mapeamento_geral.get("data") or mapeamento_fin.get("data") or achar_col(["data", "date", "periodo", "período", "vencimento", "dia"])
    col_entrada = achar_col(["valor_entrada", "entrada", "receita", "faturamento", "venda", "preco", "preço"])
    col_saida = achar_col(["valor_saida", "valor_saída", "saida", "saída", "despesa", "custo", "gasto"])
    col_valor_geral = achar_col(["valor", "total", "montante"])
    col_tipo = achar_col(["tipo", "fluxo", "natureza", "operacao", "operação"])
    col_categoria = mapeamento_geral.get("categoria") or achar_col(["categoria", "cat", "rubrica", "grupo", "classificacao", "classificação"])
    col_descricao = mapeamento_geral.get("descricao") or achar_col(["descricao", "descrição", "historico", "histórico", "item", "produto", "servico", "serviço"])

    col_das_ident = achar_col(["das_mei", "das-mei", "das mei", "boleto das", "tributo das", "simei"])
    col_serv_ident = achar_col(["servico", "serviço", "servicos", "receita_servicos", "venda servico"])
    col_fornec_ident = achar_col(["fornecedor", "fornecedores", "cmv", "cpv", "compra", "estoque", "materia"])
    col_prolab_ident = achar_col(["pro_labore", "pro-labore", "pro labore", "pró-labore", "retirada"])

    transacoes = []

    for idx, row in df.iterrows():
        # Data da movimentação
        dt = None
        if col_data and col_data in row:
            dt = _converter_data(row.get(col_data))
        if not dt:
            dt = datetime.now()

        tipo_str = str(row.get(col_tipo, "")).lower() if col_tipo and col_tipo in row else ""
        cat_str = str(row.get(col_categoria, "")).lower() if col_categoria and col_categoria in row else ""
        desc_str = str(row.get(col_descricao, "Lançamento")).strip() if col_descricao and col_descricao in row else "Lançamento"

        val_ent = 0.0
        val_sai = 0.0

        # Coleta de Receita/Entrada
        if col_rec_total and col_rec_total in row:
            val_ent += _converter_numero(row.get(col_rec_total))
        if col_rec_prod and col_rec_prod in row and col_rec_prod != col_rec_total:
            val_ent += _converter_numero(row.get(col_rec_prod))
        if col_rec_serv and col_rec_serv in row and col_rec_serv != col_rec_total:
            val_ent += _converter_numero(row.get(col_rec_serv))

        if val_ent == 0.0 and col_entrada and col_entrada in row:
            val_ent = _converter_numero(row.get(col_entrada))

        if val_ent == 0.0:
            if "Receita" in row:
                val_ent = _converter_numero(row.get("Receita"))
            elif "Faturamento" in row:
                val_ent = _converter_numero(row.get("Faturamento"))
            elif "Valor_Entrada" in row:
                val_ent = _converter_numero(row.get("Valor_Entrada"))

        # Coleta de Despesa/Saída
        if col_desp_total and col_desp_total in row:
            val_sai += _converter_numero(row.get(col_desp_total))
        if col_das_mei and col_das_mei in row and col_das_mei != col_desp_total:
            val_sai += _converter_numero(row.get(col_das_mei))
        if col_fornec and col_fornec in row and col_fornec != col_desp_total:
            val_sai += _converter_numero(row.get(col_fornec))
        if col_pro_labore and col_pro_labore in row and col_pro_labore != col_desp_total:
            val_sai += _converter_numero(row.get(col_pro_labore))
        if col_aluguel and col_aluguel in row and col_aluguel != col_desp_total:
            val_sai += _converter_numero(row.get(col_aluguel))
        if col_folha and col_folha in row and col_folha != col_desp_total:
            val_sai += _converter_numero(row.get(col_folha))

        if val_sai == 0.0 and col_saida and col_saida in row:
            val_sai = _converter_numero(row.get(col_saida))

        if val_sai == 0.0:
            if "Despesa" in row:
                val_sai = _converter_numero(row.get("Despesa"))
            elif "Despesas" in row:
                val_sai = _converter_numero(row.get("Despesas"))
            elif "Valor_Saída" in row:
                val_sai = _converter_numero(row.get("Valor_Saída"))
            elif "Valor_Saida" in row:
                val_sai = _converter_numero(row.get("Valor_Saida"))

        # Caso a tabela possua apenas uma coluna genérica de "Valor"
        if val_ent == 0.0 and val_sai == 0.0 and col_valor_geral and col_valor_geral in row:
            v_gen = _converter_numero(row.get(col_valor_geral))
            if any(k in tipo_str for k in ["entrada", "receita", "venda", "credito", "crédito"]) or any(k in cat_str for k in ["receita", "venda", "servico", "serviço"]):
                val_ent = abs(v_gen)
            elif any(k in tipo_str for k in ["saida", "saída", "despesa", "custo", "debito", "débito"]) or any(k in cat_str for k in ["despesa", "custo", "das", "aluguel", "fornecedor", "retirada"]):
                val_sai = abs(v_gen)
            else:
                if v_gen >= 0:
                    val_ent = v_gen
                else:
                    val_sai = abs(v_gen)

        # 1. Registrar Entrada se houver
        if val_ent > 0:
            is_serv = (
                (col_rec_serv and col_rec_serv in row and _converter_numero(row.get(col_rec_serv)) > 0) or
                (col_serv_ident and col_serv_ident in row and _converter_numero(row.get(col_serv_ident)) > 0) or
                any(w in desc_str.lower() or w in cat_str for w in ["servico", "serviço", "consultoria", "mao de obra", "mão de obra", "reparo", "manutencao", "manutenção", "honorario"])
            )
            sub_ent = "servico" if is_serv else "comercio"
            cat_label = cat_str.title() if cat_str else ("Prestação de Serviços" if is_serv else "Venda de Mercadorias")

            transacoes.append({
                "data": dt if dt and pd.notna(dt) else datetime.now(),
                "ano": dt.year if dt and pd.notna(dt) else ano_atual,
                "mes": dt.month if dt and pd.notna(dt) else mes_atual,
                "is_entrada": True,
                "is_saida": False,
                "sub_tipo": sub_ent,
                "descricao": desc_str if desc_str != "Lançamento" else ("Serviço Prestado" if is_serv else "Venda Realizada"),
                "categoria": cat_label,
                "valor_entrada": float(val_ent),
                "valor_saida": 0.0
            })

        # 2. Registrar Saída se houver
        if val_sai > 0:
            is_das = (
                (col_das_mei and col_das_mei in row and _converter_numero(row.get(col_das_mei)) > 0) or
                (col_das_ident and col_das_ident in row and _converter_numero(row.get(col_das_ident)) > 0) or
                any(w in desc_str.lower() or w in cat_str for w in ["das", "das-mei", "das_mei", "simei", "guia", "tributo", "imposto fixo"])
            )
            is_fornec = (
                (col_fornec and col_fornec in row and _converter_numero(row.get(col_fornec)) > 0) or
                (col_fornec_ident and col_fornec_ident in row and _converter_numero(row.get(col_fornec_ident)) > 0) or
                any(w in desc_str.lower() or w in cat_str for w in ["fornecedor", "mercadoria", "estoque", "compra", "materia", "insumo", "cmv", "cpv"])
            )
            is_prolab = (
                (col_pro_labore and col_pro_labore in row and _converter_numero(row.get(col_pro_labore)) > 0) or
                (col_prolab_ident and col_prolab_ident in row and _converter_numero(row.get(col_prolab_ident)) > 0) or
                any(w in desc_str.lower() or w in cat_str for w in ["retirada", "pro labore", "pró-labore", "pessoal", "socio", "sócio"])
            )

            if is_das:
                sub_sai = "das_mei"
                cat_label = "Boleto DAS-MEI"
            elif is_fornec:
                sub_sai = "compras_mercadorias"
                cat_label = "Compras e Mercadorias"
            elif is_prolab:
                sub_sai = "pro_labore"
                cat_label = "Pró-labore / Retirada"
            else:
                sub_sai = "custos_operacionais"
                cat_label = cat_str.title() if cat_str else "Custos Operacionais"

            transacoes.append({
                "data": dt if dt and pd.notna(dt) else datetime.now(),
                "ano": dt.year if dt and pd.notna(dt) else ano_atual,
                "mes": dt.month if dt and pd.notna(dt) else mes_atual,
                "is_entrada": False,
                "is_saida": True,
                "sub_tipo": sub_sai,
                "descricao": desc_str if desc_str != "Lançamento" else cat_label,
                "categoria": cat_label,
                "valor_entrada": 0.0,
                "valor_saida": float(val_sai)
            })

    # Adicionar DAS-MEI fixo configurado manualmente caso não exista lançamento explícito no mês
    if das_mei_manual > 0:
        tem_das_no_mes = any(
            t["is_saida"] and t["sub_tipo"] == "das_mei" and t["ano"] == ano_filtro and t["mes"] == mes_filtro
            for t in transacoes
        )
        if not tem_das_no_mes:
            transacoes.append({
                "data": datetime(ano_filtro, mes_filtro, 20),
                "ano": ano_filtro,
                "mes": mes_filtro,
                "is_entrada": False,
                "is_saida": True,
                "sub_tipo": "das_mei",
                "descricao": "Boleto DAS-MEI (Configurado)",
                "categoria": "Boleto DAS-MEI",
                "valor_entrada": 0.0,
                "valor_saida": float(das_mei_manual)
            })

    # 1. Cálculo do Termômetro MEI (Acumulado de Entradas no ano_filtro)
    faturado_ano = sum(t["valor_entrada"] for t in transacoes if t["ano"] == ano_filtro and t["is_entrada"])
    pct_usado = round((faturado_ano / teto_anual) * 100, 1) if teto_anual > 0 else 0.0
    saldo_restante = max(0.0, teto_anual - faturado_ano)

    if pct_usado >= 100.0:
        status_teto = "excedido"
        badge_teto = "Teto Ultrapassado"
        cor_teto = "#ef4444"
        msg_teto = "Atenção: O limite anual do MEI foi ultrapassado! Procure um contador para formalizar o desenquadramento para Microempresa (ME)."
    elif pct_usado >= 85.0:
        status_teto = "risco"
        badge_teto = "Risco Iminente"
        cor_teto = "#f97316"
        msg_teto = f"Alerta Crítico: Você já atingiu {pct_usado}% do teto anual do MEI! Restam R$ {saldo_restante:,.2f}."
    elif pct_usado >= 70.0:
        status_teto = "atencao"
        badge_teto = "Faixa de Atenção"
        cor_teto = "#eab308"
        msg_teto = f"Aviso: Você já utilizou {pct_usado}% do limite anual permitido para o MEI."
    else:
        status_teto = "seguro"
        badge_teto = "Faixa Segura"
        cor_teto = "#10b981"
        msg_teto = f"Faturamento dentro do limite legal do MEI ({pct_usado}% utilizado)."

    # 2. Equação de Caixa do Mês Selecionado:
    saldo_anterior = 0.0
    for t in transacoes:
        if (t["ano"] < ano_filtro) or (t["ano"] == ano_filtro and t["mes"] < mes_filtro):
            if t["is_entrada"]:
                saldo_anterior += t["valor_entrada"]
            if t["is_saida"]:
                saldo_anterior -= t["valor_saida"]

    # Movimentações do mês selecionado
    entradas_mes = sum(t["valor_entrada"] for t in transacoes if t["ano"] == ano_filtro and t["mes"] == mes_filtro and t["is_entrada"])
    saidas_mes = sum(t["valor_saida"] for t in transacoes if t["ano"] == ano_filtro and t["mes"] == mes_filtro and t["is_saida"])
    lucro_mes = entradas_mes - saidas_mes
    saldo_atual = saldo_anterior + entradas_mes - saidas_mes

    # Categorias de Saída do Mês
    cats_saida = {
        "das_mei": 0.0,
        "compras_mercadorias": 0.0,
        "custos_operacionais": 0.0,
        "pro_labore": 0.0,
        "outros": 0.0
    }
    for t in transacoes:
        if t["ano"] == ano_filtro and t["mes"] == mes_filtro and t["is_saida"]:
            st = t["sub_tipo"]
            if st in cats_saida:
                cats_saida[st] += t["valor_saida"]
            else:
                cats_saida["outros"] += t["valor_saida"]

    # 3. Resumo Mensal dos 12 Meses do Ano
    meses_resumo = []
    acumulado_acum = 0.0
    for m in range(1, 13):
        rec_serv = sum(t["valor_entrada"] for t in transacoes if t["ano"] == ano_filtro and t["mes"] == m and t["is_entrada"] and t["sub_tipo"] == "servico")
        rec_com = sum(t["valor_entrada"] for t in transacoes if t["ano"] == ano_filtro and t["mes"] == m and t["is_entrada"] and t["sub_tipo"] != "servico")
        rec_tot = rec_serv + rec_com
        sai_tot = sum(t["valor_saida"] for t in transacoes if t["ano"] == ano_filtro and t["mes"] == m and t["is_saida"])
        lucro_m = rec_tot - sai_tot
        acumulado_acum += rec_tot

        meses_resumo.append({
            "mes_num": m,
            "mes_nome": MESES_NOMES[m - 1],
            "servicos": round(rec_serv, 2),
            "comercio": round(rec_com, 2),
            "entradas": round(rec_tot, 2),
            "saidas": round(sai_tot, 2),
            "lucro": round(lucro_m, 2),
            "acumulado_ano": round(acumulado_acum, 2)
        })

    # 4. Últimos lançamentos (ordenados por data descendente)
    transacoes_ordenadas = sorted(transacoes, key=lambda x: x["data"], reverse=True)
    lancamentos_recentes = []
    for t in transacoes_ordenadas[:25]:
        dt_str = t["data"].strftime("%d/%m/%Y") if hasattr(t["data"], "strftime") else str(t["data"])[:10]
        lancamentos_recentes.append({
            "data": dt_str,
            "tipo": "entrada" if t["is_entrada"] else "saida",
            "categoria": t["categoria"],
            "descricao": t["descricao"],
            "valor": round(t["valor_entrada"] if t["is_entrada"] else t["valor_saida"], 2)
        })

    return jsonify({
        "sucesso": True,
        "ano": ano_filtro,
        "mes": mes_filtro,
        "mes_nome": MESES_NOMES[mes_filtro - 1],
        "contexto": info_contexto,
        "teto_mei": {
            "limite_anual": round(teto_anual, 2),
            "proporcional": is_proporcional,
            "meses_ativos": meses_ativos,
            "faturado_ano": round(faturado_ano, 2),
            "saldo_restante": round(saldo_restante, 2),
            "percentual_usado": pct_usado,
            "status": status_teto,
            "badge": badge_teto,
            "cor": cor_teto,
            "mensagem": msg_teto
        },
        "caixa": {
            "saldo_anterior": round(saldo_anterior, 2),
            "entradas": round(entradas_mes, 2),
            "saidas": round(saidas_mes, 2),
            "lucro_periodo": round(lucro_mes, 2),
            "saldo_atual": round(saldo_atual, 2)
        },
        "categorias_saida": {k: round(v, 2) for k, v in cats_saida.items()},
        "meses_resumo": meses_resumo,
        "lancamentos_recentes": lancamentos_recentes,
        "sem_dados": len(transacoes) == 0
    })

def registrar_lancamento_rapido():
    """Registra uma movimentação rápida (Entrada ou Saída) na planilha selecionada ou dedicada."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"}), 401

    payload = request.get_json() or {}
    tipo = str(payload.get("tipo", "entrada")).strip().lower()
    sub_tipo = str(payload.get("sub_tipo", "comercio")).strip().lower()
    descricao = str(payload.get("descricao", "")).strip()
    data_str = str(payload.get("data", "")).strip() or datetime.now().strftime("%Y-%m-%d")
    valor = _converter_numero(payload.get("valor", 0))
    tabela_id = payload.get("tabela_id")

    if valor <= 0:
        return jsonify({"sucesso": False, "mensagem": "Informe um valor numérico válido maior que zero."}), 400

    if not descricao:
        descricao = "Venda/Serviço MEI" if tipo == "entrada" else "Despesa MEI"

    # Mapeamento amigável de categorias
    cat_map = {
        "servico": "Prestação de Serviços",
        "comercio": "Venda de Mercadorias",
        "das_mei": "Boleto DAS-MEI",
        "compras_mercadorias": "Compras e Fornecedores",
        "custos_operacionais": "Custos Operacionais",
        "pro_labore": "Pró-labore / Retirada Pessoal",
        "outro": "Outras Movimentações"
    }
    categoria_label = cat_map.get(sub_tipo, sub_tipo.title())

    novo_registro = {
        "Data": data_str,
        "Tipo": "Entrada" if tipo == "entrada" else "Saída",
        "Categoria": categoria_label,
        "Descrição": descricao,
        "Valor": valor,
        "Valor_Entrada": valor if tipo == "entrada" else 0.0,
        "Valor_Saída": valor if tipo == "saida" else 0.0,
        "Receita": valor if tipo == "entrada" else 0.0,
        "Despesa": valor if tipo == "saida" else 0.0,
        "criado_em": datetime.now()
    }

    try:
        tabela_destino = None

        # 1. Se foi especificada uma tabela individual existente
        if tabela_id and tabela_id != "todas" and ObjectId.is_valid(tabela_id):
            tabela_destino = dados_colecao.find_one({"_id": ObjectId(tabela_id), "usuario_id": usuario_id})

        if tabela_destino:
            dados_colecao.update_one(
                {"_id": tabela_destino["_id"]},
                {
                    "$push": {"dados": novo_registro},
                    "$set": {"atualizado_em": datetime.now()}
                }
            )
            nome_tab = tabela_destino.get("nome_planilha", "Tabela Selecionada")
        else:
            # 2. Procurar ou criar planilha padrão dedicada de Controles MEI
            planilha_mei = dados_colecao.find_one({
                "usuario_id": usuario_id,
                "nome_planilha": "Controles_Essenciais_MEI"
            })

            if planilha_mei:
                dados_colecao.update_one(
                    {"_id": planilha_mei["_id"]},
                    {
                        "$push": {"dados": novo_registro},
                        "$set": {"atualizado_em": datetime.now()}
                    }
                )
                nome_tab = "Controles_Essenciais_MEI"
            else:
                colunas = ["Data", "Tipo", "Categoria", "Descrição", "Valor", "Valor_Entrada", "Valor_Saída", "Receita", "Despesa"]
                salvar_dados(
                    usuario_id=usuario_id,
                    nome_planilha="Controles_Essenciais_MEI",
                    colunas=colunas,
                    dados=[novo_registro],
                    tipo_dominio="MISTA_GERAL"
                )
                nome_tab = "Controles_Essenciais_MEI"

        return jsonify({
            "sucesso": True,
            "mensagem": f"Lançamento salvo com sucesso na tabela '{nome_tab}'!",
            "registro": {
                "data": data_str,
                "tipo": tipo,
                "categoria": categoria_label,
                "descricao": descricao,
                "valor": valor
            }
        }), 200

    except Exception as e:
        print(f"[Erro] Falha ao salvar lançamento rápido do MEI: {e}")
        return jsonify({"sucesso": False, "mensagem": f"Erro interno ao salvar movimentação: {str(e)}"}), 500
