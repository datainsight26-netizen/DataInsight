import unicodedata
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

def _normalizar_str(v):
    if not v:
        return ""
    s = unicodedata.normalize('NFKD', str(v)).encode('ASCII', 'ignore').decode('utf-8')
    return s.lower().replace("_", " ").replace("-", " ").strip()

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
            "dashboard_graficos": {
                "recebimentos": {
                    "total_mes": 0.0,
                    "fatias_mes": [],
                    "total_ano": 0.0,
                    "fatias_ano": []
                },
                "composicao_custos": {
                    "custo_fixo_total": 0.0,
                    "custo_variavel_total": 0.0,
                    "custo_total": 0.0,
                    "pct_fixo": 0.0,
                    "pct_variavel": 0.0,
                    "detalhes_fixo": [],
                    "detalhes_variavel": [],
                    "ano_custo_fixo": 0.0,
                    "ano_custo_variavel": 0.0,
                    "ano_custo_total": 0.0,
                    "ano_pct_fixo": 0.0,
                    "ano_pct_variavel": 0.0,
                    "ano_detalhes_fixo": [],
                    "ano_detalhes_variavel": []
                }
            },
            "lancamentos_recentes": [],
            "novas_despesas": [],
            "sem_dados": True
        })

    # Normalizar transações em DataFrame
    df = pd.DataFrame(dados_raw)

    def achar_col(padroes):
        for p in padroes:
            p_norm = _normalizar_str(p)
            for c in df.columns:
                c_norm = _normalizar_str(c)
                if p_norm in c_norm or c_norm == p_norm:
                    return c
        return None

    # 1. Colunas mapeadas diretamente pelo usuário
    col_rec_total = mapeamento_fin.get("receita_total") or mapeamento_geral.get("receita")
    col_rec_prod = mapeamento_fin.get("receita_produtos")
    col_rec_serv = mapeamento_fin.get("receita_servicos")
    col_desp_total = mapeamento_fin.get("despesas") or mapeamento_geral.get("despesa")

    col_custo_var = mapeamento_fin.get("custo_variavel") or mapeamento_geral.get("custo_variavel")
    col_fornec = mapeamento_fin.get("fornecedores") or mapeamento_geral.get("fornecedores")
    col_publicidade = mapeamento_fin.get("publicidade") or mapeamento_geral.get("publicidade")
    col_custo_var_outros = mapeamento_fin.get("custo_variavel_outros") or mapeamento_geral.get("custo_variavel_outros")
    col_impostos = mapeamento_fin.get("impostos") or mapeamento_geral.get("impostos")

    col_das_mei = mapeamento_fin.get("das_mei") or mapeamento_geral.get("das_mei")
    col_pro_labore = mapeamento_fin.get("pro_labore") or mapeamento_geral.get("pro_labore")
    col_aluguel = mapeamento_fin.get("aluguel") or mapeamento_geral.get("aluguel")
    col_folha = mapeamento_fin.get("folha_pagamento") or mapeamento_geral.get("folha_pagamento")
    das_mei_manual = _converter_numero(mapeamento_fin.get("das_mei_manual", 0))
    cats_custom_lista = mapeamento_fin.get("categorias_custom") or mapeamento_fin.get("_categorias_custom") or []
    if not isinstance(cats_custom_lista, list):
        cats_custom_lista = []

    # 2. Heurísticas para colunas padrão da tabela do usuário
    col_data = mapeamento_geral.get("data") or mapeamento_fin.get("data") or achar_col(["data", "date", "periodo", "vencimento", "dia"])
    col_entrada = achar_col(["valor entrada", "entrada", "receita", "faturamento", "venda", "preco"])
    col_saida = achar_col(["valor saida", "saida", "despesa", "custo", "gasto"])
    col_valor_geral = achar_col(["valor", "total", "montante"])
    col_tipo = achar_col(["tipo", "fluxo", "natureza", "operacao"])
    col_categoria = mapeamento_geral.get("categoria") or achar_col(["categoria", "cat", "rubrica", "grupo", "classificacao"])
    col_descricao = mapeamento_geral.get("descricao") or achar_col(["descricao", "historico", "item", "produto", "servico"])

    # Heurísticas adicionais para custos específicos com normalização
    if not col_custo_var:
        col_custo_var = achar_col([
            "custo variavel", "custos variaveis", "gasto variavel", "gastos variaveis",
            "despesa variavel", "despesas variaveis", "cmv", "cpv", "cme",
            "custo mercadoria", "custo produto", "variavel"
        ])
    if not col_fornec:
        col_fornec = achar_col([
            "fornecedor", "fornecedores", "compra", "compras", "materia prima",
            "insumo", "insumos", "estoque", "suprimento"
        ])
    if not col_publicidade:
        col_publicidade = achar_col([
            "publicidade", "marketing", "propaganda", "anuncio", "anuncios", "trafego", "ads"
        ])
    if not col_custo_var_outros:
        col_custo_var_outros = achar_col([
            "comissao", "comissoes", "frete", "fretes", "embalagem", "embalagens", "entrega", "logistica"
        ])
    if not col_das_mei:
        col_das_mei = achar_col(["das mei", "das", "boleto das", "tributo das", "simei"])
    if not col_pro_labore:
        col_pro_labore = achar_col(["pro labore", "retirada"])
    if not col_aluguel:
        col_aluguel = achar_col(["aluguel", "locacao", "condominio"])
    if not col_folha:
        col_folha = achar_col(["folha", "salario", "salarios", "funcionario", "funcionarios"])

    col_serv_ident = achar_col(["servico", "serviço", "servicos", "receita_servicos", "venda servico"])

    # Identificar se a tabela possui colunas dedicadas de custos
    cols_dedicadas_var = [c for c in [col_custo_var, col_fornec, col_publicidade, col_custo_var_outros] if c and c in df.columns]
    cols_dedicadas_fix = [c for c in [col_das_mei, col_pro_labore, col_aluguel, col_folha] if c and c in df.columns]
    cols_dedicadas_custom = [mapeamento_fin.get(c.get("id")) for c in cats_custom_lista if isinstance(c, dict) and mapeamento_fin.get(c.get("id")) in df.columns]
    tem_cols_dedicadas = bool(cols_dedicadas_var or cols_dedicadas_fix or cols_dedicadas_custom)

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

        # 1. Coleta e Registro de Receita/Entrada
        val_ent = 0.0
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

        if val_ent == 0.0 and col_valor_geral and col_valor_geral in row:
            v_gen = _converter_numero(row.get(col_valor_geral))
            if any(k in tipo_str for k in ["entrada", "receita", "venda", "credito", "crédito"]) or any(k in cat_str for k in ["receita", "venda", "servico", "serviço"]):
                val_ent = abs(v_gen)
            elif not col_saida and not tem_cols_dedicadas and v_gen > 0 and not any(k in tipo_str for k in ["saida", "saída", "despesa", "custo", "debito"]):
                val_ent = v_gen

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

        # 2. Coleta e Registro de Custos e Despesas (Saídas)
        # Abordagem A: Linha com colunas de custos específicas
        custos_especificos_linha = []

        if col_custo_var and col_custo_var in row and col_custo_var != col_desp_total:
            v = _converter_numero(row.get(col_custo_var))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "compras_mercadorias",
                    "natureza": "variavel",
                    "categoria": "Custos Variáveis",
                    "descricao": str(col_custo_var)
                })

        if col_fornec and col_fornec in row and col_fornec != col_desp_total and col_fornec != col_custo_var:
            v = _converter_numero(row.get(col_fornec))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "compras_mercadorias",
                    "natureza": "variavel",
                    "categoria": "Fornecedores e Estoque",
                    "descricao": "Fornecedores / Mercadorias"
                })

        if col_publicidade and col_publicidade in row and col_publicidade != col_desp_total and col_publicidade != col_custo_var:
            v = _converter_numero(row.get(col_publicidade))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "custos_operacionais",
                    "natureza": "variavel",
                    "categoria": "Marketing e Anúncios",
                    "descricao": "Publicidade / Anúncios"
                })

        if col_custo_var_outros and col_custo_var_outros in row and col_custo_var_outros != col_desp_total and col_custo_var_outros != col_custo_var:
            v = _converter_numero(row.get(col_custo_var_outros))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "custos_operacionais",
                    "natureza": "variavel",
                    "categoria": "Custos Variáveis Diversos",
                    "descricao": "Fretes / Comissões / Outros"
                })

        if col_das_mei and col_das_mei in row and col_das_mei != col_desp_total:
            v = _converter_numero(row.get(col_das_mei))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "das_mei",
                    "natureza": "fixo",
                    "categoria": "Boleto DAS-MEI",
                    "descricao": "Boleto DAS-MEI"
                })

        if col_pro_labore and col_pro_labore in row and col_pro_labore != col_desp_total:
            v = _converter_numero(row.get(col_pro_labore))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "pro_labore",
                    "natureza": "fixo",
                    "categoria": "Pró-labore / Retirada",
                    "descricao": "Pró-labore"
                })

        if col_aluguel and col_aluguel in row and col_aluguel != col_desp_total:
            v = _converter_numero(row.get(col_aluguel))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "custos_operacionais",
                    "natureza": "fixo",
                    "categoria": "Aluguel",
                    "descricao": "Aluguel"
                })

        if col_folha and col_folha in row and col_folha != col_desp_total:
            v = _converter_numero(row.get(col_folha))
            if v > 0:
                custos_especificos_linha.append({
                    "valor": v,
                    "sub_tipo": "custos_operacionais",
                    "natureza": "fixo",
                    "categoria": "Folha de Pagamento",
                    "descricao": "Salários / Folha"
                })

        for c_item in cats_custom_lista:
            cid = c_item.get("id")
            if not cid:
                continue
            clabel = c_item.get("label") or cid
            cgrupo = c_item.get("grupo") or "Gastos Fixos"
            ccol = mapeamento_fin.get(cid)
            cnatureza = "variavel" if cgrupo == "Custos Variáveis" else "fixo"
            if ccol and ccol in row and ccol != col_desp_total:
                v = _converter_numero(row.get(ccol))
                if v > 0:
                    custos_especificos_linha.append({
                        "valor": v,
                        "sub_tipo": f"custom_{cid}",
                        "natureza": cnatureza,
                        "categoria": clabel,
                        "descricao": clabel,
                        "custom_id": cid,
                        "custom_label": clabel,
                        "custom_grupo": cgrupo,
                        "is_custom": True
                    })

        if custos_especificos_linha:
            for item in custos_especificos_linha:
                transacoes.append({
                    "data": dt if dt and pd.notna(dt) else datetime.now(),
                    "ano": dt.year if dt and pd.notna(dt) else ano_atual,
                    "mes": dt.month if dt and pd.notna(dt) else mes_atual,
                    "is_entrada": False,
                    "is_saida": True,
                    "sub_tipo": item["sub_tipo"],
                    "natureza_custo": item["natureza"],
                    "descricao": item["descricao"],
                    "categoria": item["categoria"],
                    "valor_entrada": 0.0,
                    "valor_saida": float(item["valor"])
                })

            # Se houver coluna de despesa total e o valor for maior que a soma das específicas, registra a diferença
            if col_desp_total and col_desp_total in row:
                tot_linha = _converter_numero(row.get(col_desp_total))
                soma_esp = sum(i["valor"] for i in custos_especificos_linha)
                sobra = tot_linha - soma_esp
                if sobra > 0.01:
                    transacoes.append({
                        "data": dt if dt and pd.notna(dt) else datetime.now(),
                        "ano": dt.year if dt and pd.notna(dt) else ano_atual,
                        "mes": dt.month if dt and pd.notna(dt) else mes_atual,
                        "is_entrada": False,
                        "is_saida": True,
                        "sub_tipo": "custos_operacionais",
                        "natureza_custo": "fixo",
                        "descricao": "Outros Custos Operacionais",
                        "categoria": "Outros Custos Operacionais",
                        "valor_entrada": 0.0,
                        "valor_saida": float(sobra)
                    })
        else:
            # Abordagem B: Linha de tabela transacional ou coluna de saída única
            val_sai = 0.0
            if col_desp_total and col_desp_total in row:
                val_sai += _converter_numero(row.get(col_desp_total))
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

            if val_sai == 0.0 and col_valor_geral and col_valor_geral in row:
                v_gen = _converter_numero(row.get(col_valor_geral))
                if any(k in tipo_str for k in ["saida", "saída", "despesa", "custo", "debito", "débito"]) or any(k in cat_str for k in ["despesa", "custo", "das", "aluguel", "fornecedor", "retirada", "variavel", "variável"]):
                    val_sai = abs(v_gen)
                elif not col_entrada and v_gen < 0:
                    val_sai = abs(v_gen)

            if val_sai > 0:
                texto_completo = _normalizar_str(f"{desc_str} {cat_str} {tipo_str}")

                palavras_var = [
                    "variavel", "custo variavel", "custos variaveis",
                    "despesa variavel", "despesas variaveis", "gasto variavel", "gastos variaveis",
                    "fornecedor", "fornecedores", "mercadoria", "mercadorias", "compra", "compras",
                    "insumo", "insumos", "materia prima", "estoque", "cmv", "cpv", "cme",
                    "frete", "fretes", "comissao", "comissoes", "embalagem", "embalagens",
                    "marketing", "publicidade", "propaganda", "anuncio", "anuncios", "trafego",
                    "ads", "combustivel", "entrega", "entregas", "logistica", "suprimento",
                    "revenda", "produto", "produtos", "terceirizado"
                ]
                palavras_fixo = [
                    "aluguel", "locacao", "condominio", "iptu",
                    "folha", "salario", "salarios", "funcionario", "funcionarios",
                    "energia", "luz", "agua", "internet", "telefone", "telefonia", "celular",
                    "contabilidade", "contador", "software", "sistema", "assinatura", "licenca",
                    "mensalidade", "tarifa bancaria", "taxa bancaria", "das", "das mei",
                    "simei", "retirada", "pro labore", "socio", "fixo", "fixos",
                    "custo fixo", "custos fixos", "despesa fixa", "despesas fixas"
                ]

                is_das = any(w in texto_completo for w in ["das", "das mei", "simei", "guia", "tributo", "imposto fixo"])
                is_prolab = any(w in texto_completo for w in ["retirada", "pro labore", "socio", "pessoal"])
                is_var = any(w in texto_completo for w in palavras_var)

                if is_das:
                    sub_sai = "das_mei"
                    cat_label = "Boleto DAS-MEI"
                    natureza_custo = "fixo"
                elif is_prolab:
                    sub_sai = "pro_labore"
                    cat_label = "Pró-labore / Retirada"
                    natureza_custo = "fixo"
                elif is_var:
                    sub_sai = "compras_mercadorias"
                    cat_label = cat_str.title() if cat_str else ("Custos Variáveis" if "variavel" in texto_completo else "Compras e Mercadorias")
                    natureza_custo = "variavel"
                elif any(w in texto_completo for w in palavras_fixo):
                    sub_sai = "custos_operacionais"
                    cat_label = cat_str.title() if cat_str else "Custos Fixos Operacionais"
                    natureza_custo = "fixo"
                else:
                    sub_sai = "custos_operacionais"
                    cat_label = cat_str.title() if cat_str else "Custos Operacionais"
                    natureza_custo = "fixo"

                transacoes.append({
                    "data": dt if dt and pd.notna(dt) else datetime.now(),
                    "ano": dt.year if dt and pd.notna(dt) else ano_atual,
                    "mes": dt.month if dt and pd.notna(dt) else mes_atual,
                    "is_entrada": False,
                    "is_saida": True,
                    "sub_tipo": sub_sai,
                    "natureza_custo": natureza_custo,
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
                "natureza_custo": "fixo",
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

    # Categorias de Saída do Mês (Hardcoded + Novas Despesas Customizadas)
    cats_custom_lista = mapeamento_fin.get("categorias_custom") or mapeamento_fin.get("_categorias_custom") or []
    novas_despesas_dict = {}
    for c_item in cats_custom_lista:
        cid = c_item.get("id")
        if not cid:
            continue
        cgrupo = c_item.get("grupo") or "Gastos Fixos"
        if cgrupo in ["Gastos Fixos", "Custos Variáveis"]:
            clabel = c_item.get("label") or cid
            cor = c_item.get("cor") or "#6366f1"
            icone = c_item.get("icone") or "fa-tag"
            cnatureza = "variavel" if cgrupo == "Custos Variáveis" else "fixo"
            v_manual = _converter_numero(mapeamento_fin.get(f"{cid}_manual", 0))

            novas_despesas_dict[cid] = {
                "id": cid,
                "nome": clabel,
                "valor": float(v_manual),
                "natureza": cnatureza,
                "grupo": cgrupo,
                "cor": cor,
                "icone": icone
            }

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
            if st.startswith("custom_") or t.get("is_custom"):
                cid = t.get("custom_id") or st.replace("custom_", "")
                if cid in novas_despesas_dict:
                    novas_despesas_dict[cid]["valor"] += t["valor_saida"]
                else:
                    novas_despesas_dict[cid] = {
                        "id": cid,
                        "nome": t.get("custom_label") or t.get("categoria") or t.get("descricao") or cid,
                        "valor": float(t["valor_saida"]),
                        "natureza": t.get("natureza_custo", "fixo"),
                        "grupo": t.get("custom_grupo", "Gastos Fixos"),
                        "cor": "#6366f1",
                        "icone": "fa-tag"
                    }
            elif st in cats_saida:
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

    # 4. Dados para Dashboard de Gráficos (Detalhamento de Recebimentos & Composição de Custos)
    # A) Recebimentos do Mês
    fatias_rec_mes_dict = {}
    for t in transacoes:
        if t["is_entrada"] and t["ano"] == ano_filtro and t["mes"] == mes_filtro:
            c_label = t.get("categoria") or ("Prestação de Serviços" if t.get("sub_tipo") == "servico" else "Venda de Mercadorias")
            fatias_rec_mes_dict[c_label] = fatias_rec_mes_dict.get(c_label, 0.0) + t["valor_entrada"]

    fatias_rec_mes = [
        {
            "nome": k,
            "valor": round(v, 2),
            "percentual": round((v / entradas_mes) * 100, 1) if entradas_mes > 0 else 0.0
        }
        for k, v in sorted(fatias_rec_mes_dict.items(), key=lambda x: x[1], reverse=True)
    ]

    # B) Recebimentos do Ano
    fatias_rec_ano_dict = {}
    for t in transacoes:
        if t["is_entrada"] and t["ano"] == ano_filtro:
            c_label = t.get("categoria") or ("Prestação de Serviços" if t.get("sub_tipo") == "servico" else "Venda de Mercadorias")
            fatias_rec_ano_dict[c_label] = fatias_rec_ano_dict.get(c_label, 0.0) + t["valor_entrada"]

    fatias_rec_ano = [
        {
            "nome": k,
            "valor": round(v, 2),
            "percentual": round((v / faturado_ano) * 100, 1) if faturado_ano > 0 else 0.0
        }
        for k, v in sorted(fatias_rec_ano_dict.items(), key=lambda x: x[1], reverse=True)
    ]

    # C) Composição de Custos do Mês (Fixo vs Variável)
    fixo_dict_mes = {}
    var_dict_mes = {}
    total_fixo_mes = 0.0
    total_var_mes = 0.0

    for t in transacoes:
        if t["is_saida"] and t["ano"] == ano_filtro and t["mes"] == mes_filtro:
            nat = t.get("natureza_custo", "fixo")
            cat = t.get("categoria") or "Outros Custos"
            val = t["valor_saida"]
            if nat == "fixo":
                total_fixo_mes += val
                fixo_dict_mes[cat] = fixo_dict_mes.get(cat, 0.0) + val
            else:
                total_var_mes += val
                var_dict_mes[cat] = var_dict_mes.get(cat, 0.0) + val

    total_custos_mes = total_fixo_mes + total_var_mes
    pct_fixo_mes = round((total_fixo_mes / total_custos_mes) * 100, 1) if total_custos_mes > 0 else 0.0
    pct_var_mes = round((total_var_mes / total_custos_mes) * 100, 1) if total_custos_mes > 0 else 0.0

    detalhes_fixo_mes = [
        {"nome": k, "valor": round(v, 2), "percentual": round((v / total_fixo_mes) * 100, 1) if total_fixo_mes > 0 else 0.0}
        for k, v in sorted(fixo_dict_mes.items(), key=lambda x: x[1], reverse=True)
    ]
    detalhes_var_mes = [
        {"nome": k, "valor": round(v, 2), "percentual": round((v / total_var_mes) * 100, 1) if total_var_mes > 0 else 0.0}
        for k, v in sorted(var_dict_mes.items(), key=lambda x: x[1], reverse=True)
    ]

    # D) Composição de Custos do Ano (Fixo vs Variável)
    fixo_dict_ano = {}
    var_dict_ano = {}
    total_fixo_ano = 0.0
    total_var_ano = 0.0

    for t in transacoes:
        if t["is_saida"] and t["ano"] == ano_filtro:
            nat = t.get("natureza_custo", "fixo")
            cat = t.get("categoria") or "Outros Custos"
            val = t["valor_saida"]
            if nat == "fixo":
                total_fixo_ano += val
                fixo_dict_ano[cat] = fixo_dict_ano.get(cat, 0.0) + val
            else:
                total_var_ano += val
                var_dict_ano[cat] = var_dict_ano.get(cat, 0.0) + val

    total_custos_ano = total_fixo_ano + total_var_ano
    pct_fixo_ano = round((total_fixo_ano / total_custos_ano) * 100, 1) if total_custos_ano > 0 else 0.0
    pct_var_ano = round((total_var_ano / total_custos_ano) * 100, 1) if total_custos_ano > 0 else 0.0

    detalhes_fixo_ano = [
        {"nome": k, "valor": round(v, 2), "percentual": round((v / total_fixo_ano) * 100, 1) if total_fixo_ano > 0 else 0.0}
        for k, v in sorted(fixo_dict_ano.items(), key=lambda x: x[1], reverse=True)
    ]
    detalhes_var_ano = [
        {"nome": k, "valor": round(v, 2), "percentual": round((v / total_var_ano) * 100, 1) if total_var_ano > 0 else 0.0}
        for k, v in sorted(var_dict_ano.items(), key=lambda x: x[1], reverse=True)
    ]

    dashboard_graficos = {
        "recebimentos": {
            "total_mes": round(entradas_mes, 2),
            "fatias_mes": fatias_rec_mes,
            "total_ano": round(faturado_ano, 2),
            "fatias_ano": fatias_rec_ano
        },
        "composicao_custos": {
            "custo_fixo_total": round(total_fixo_mes, 2),
            "custo_variavel_total": round(total_var_mes, 2),
            "custo_total": round(total_custos_mes, 2),
            "pct_fixo": pct_fixo_mes,
            "pct_variavel": pct_var_mes,
            "detalhes_fixo": detalhes_fixo_mes,
            "detalhes_variavel": detalhes_var_mes,
            "ano_custo_fixo": round(total_fixo_ano, 2),
            "ano_custo_variavel": round(total_var_ano, 2),
            "ano_custo_total": round(total_custos_ano, 2),
            "ano_pct_fixo": pct_fixo_ano,
            "ano_pct_variavel": pct_var_ano,
            "ano_detalhes_fixo": detalhes_fixo_ano,
            "ano_detalhes_variavel": detalhes_var_ano
        }
    }

    # 5. Últimos lançamentos (ordenados por data descendente)
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
        "novas_despesas": [
            {
                "id": d["id"],
                "nome": d["nome"],
                "valor": round(d["valor"], 2),
                "natureza": d["natureza"],
                "grupo": d["grupo"],
                "cor": d["cor"],
                "icone": d["icone"]
            }
            for d in novas_despesas_dict.values()
        ],
        "meses_resumo": meses_resumo,
        "dashboard_graficos": dashboard_graficos,
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