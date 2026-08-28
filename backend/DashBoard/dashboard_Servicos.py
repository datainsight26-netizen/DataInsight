import pandas as pd
from datetime import datetime, timedelta
import numpy as np

# ======================
# DETECÇÃO INTELIGENTE DE COLUNAS
# ======================

def detectar_colunas(colunas: list, dados: list, mapeamento: dict = None) -> dict:

    if mapeamento is None:
        mapeamento = {}

    colunas_lower = {c.lower(): c for c in colunas}

    ALIAS_DATA      = ["data", "date", "período", "periodo", "mes", "mês", "month", "ano"]
    ALIAS_RECEITA   = ["receita", "revenue", "faturamento", "vendas", "entrada", "entradas", "income", "total"]
    ALIAS_DESPESA   = ["despesa", "despesas", "expense", "expenses", "custo", "custos", "saída", "saidas", "cost", "gastos"]
    ALIAS_LUCRO     = ["lucro", "profit", "resultado", "ganho", "ganhos", "net"]
    ALIAS_CATEGORIA = ["categoria", "category", "tipo", "type", "grupo", "group", "setor", "produto", "product"]

    def achar(aliases):
        for alias in aliases:
            if alias in colunas_lower:
                return colunas_lower[alias]
        for alias in aliases:
            for col_l, col_o in colunas_lower.items():
                if alias in col_l:
                    return col_o
        return None

    def obter_mapeado(chaves, aliases):
        for k in chaves:
            col = mapeamento.get(k)
            if col and col in colunas:
                return col
        return achar(aliases)

    return {
        "data": obter_mapeado(["data", "periodo"], ALIAS_DATA),
        "receita": obter_mapeado(["faturamento", "receita_total", "receita_produtos"], ALIAS_RECEITA),
        "despesa": obter_mapeado(["despesa", "despesas", "custo_variavel"], ALIAS_DESPESA),
        "lucro": obter_mapeado(["lucro", "resultado"], ALIAS_LUCRO),
        "categoria": obter_mapeado(["categoria", "produto"], ALIAS_CATEGORIA),
    }


# ======================
# CONVERSÃO SEGURA
# ======================

def _to_float(v):
    try:
        if isinstance(v, str):
            v = v.replace("R$", "").replace(".", "").replace(",", ".").strip()
        return float(v)
    except:
        return 0.0


def _to_date(v):
    try:
        return pd.to_datetime(v, errors="coerce")
    except:
        return None


# ======================
# FILTRO DE PERÍODO (PRINCIPAL)
# ======================

def filtrar_periodo(df, col_data, periodo):
    """
    Filtra dados baseado no período (período é relativo à data máxima dos dados, não à data atual)
    """
    if not col_data or col_data not in df.columns:
        print(f" Coluna de data não encontrada: {col_data}")
        return df

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])

    if df.empty:
        print(" Nenhuma data válida após conversão")
        return df

    fim = df[col_data].max()
    inicio = fim - timedelta(days=periodo)

    df_filtrado = df[df[col_data] >= inicio]
    return df_filtrado


# ======================
# KPIs
# ======================

def calcular_kpis(df, mapa):

    r, d, l = mapa["receita"], mapa["despesa"], mapa["lucro"]

    receita = df[r].apply(_to_float).sum() if r else 0
    despesa = df[d].apply(_to_float).sum() if d else 0

    if l:
        lucro = df[l].apply(_to_float).sum()
    else:
        lucro = receita - despesa

    margem = round((lucro / receita * 100), 1) if receita else 0

    return {
        "receita_total": round(receita, 2),
        "lucro_liquido": round(lucro, 2),
        "despesa_total": round(despesa, 2),
        "margem_lucro": margem
    }


# ======================
# EVOLUÇÃO
# ======================

def evolucao_financeira(df, mapa):

    cdata = mapa["data"]
    r, d, l = mapa["receita"], mapa["despesa"], mapa["lucro"]

    if not cdata:
        df["_periodo"] = range(len(df))
        cdata = "_periodo"

    df = df.copy()

    df["_r"] = df[r].apply(_to_float) if r else 0
    df["_d"] = df[d].apply(_to_float) if d else 0
    df["_l"] = df[l].apply(_to_float) if l else df["_r"] - df["_d"]

    g = df.groupby(cdata).agg(
        receita=("_r", "sum"),
        despesa=("_d", "sum"),
        lucro=("_l", "sum"),
    ).reset_index()

    labels = []
    for val in g[cdata]:
        if isinstance(val, (pd.Timestamp, datetime)):
            labels.append(val.strftime("%Y-%m-%d"))
        else:
            labels.append(str(val))

    return {
        "labels": labels,
        "series": [
            {"name": "Receita", "data": g["receita"].round(2).tolist()},
            {"name": "Despesa", "data": g["despesa"].round(2).tolist()},
            {"name": "Lucro", "data": g["lucro"].round(2).tolist()},
        ],
        "lucro": g["lucro"].round(2).tolist()
    }


# ======================
# CATEGORIAS
# ======================

def despesas_por_categoria(df, mapa):

    cat, d = mapa["categoria"], mapa["despesa"]

    if not d:
        return {"labels": [], "valores": []}

    df = df.copy()
    df["_d"] = df[d].apply(_to_float)

    if cat:
        g = df.groupby(cat)["_d"].sum().sort_values(ascending=False)
        return {
            "labels": g.index.tolist(),
            "valores": g.values.round(2).tolist()
        }

    return {"labels": [], "valores": []}


# ======================
# DRE COMPLETO E ESTRUTURADO (7 LINHAS REAIS)
# ======================

def _obter_valor_financeiro(df, mapeamento_financeiro, cat_key, colunas_fallback=None, periodo=30):
    """
    Busca o valor financeiro correspondente de uma categoria:
    1. Verifica se a coluna está mapeada em mapeamento_financeiro e existe no DataFrame.
    2. Se não estiver na tabela, verifica se há valor manual fixo (e ajusta para o período).
    3. Fallback: procura por colunas no DataFrame com nomes aproximados.
    """
    if mapeamento_financeiro:
        col = mapeamento_financeiro.get(cat_key)
        if col and col in df.columns:
            return float(df[col].apply(_to_float).sum())

        val_man = mapeamento_financeiro.get(f"{cat_key}_manual")
        if val_man is not None and str(val_man).strip() != "":
            try:
                # Proporção em relação a 30 dias (mensal)
                return float(val_man) * (float(periodo) / 30.0)
            except Exception:
                pass

    if colunas_fallback:
        for c in colunas_fallback:
            if c in df.columns:
                return float(df[c].apply(_to_float).sum())
            for col_df in df.columns:
                if c.lower() == str(col_df).lower() or c.lower() in str(col_df).lower():
                    return float(df[col_df].apply(_to_float).sum())

    return 0.0


def calcular_dre_completo(df, mapa, mapeamento_financeiro=None, periodo=30, kpis=None):
    """
    Calcula as 7 linhas completas da Demonstração do Resultado do Exercício (DRE):
    1. Faturamento Bruto (Receita)
    2. Impostos e Taxas
    3. Receita Líquida
    4. Custo Variável
    5. Margem Contribuição / Lucro Bruto
    6. Despesa Fixa
    7. Resultado / Lucro Final
    """
    if mapeamento_financeiro is None:
        mapeamento_financeiro = {}

    # 1. FATURAMENTO BRUTO
    rec_prod = _obter_valor_financeiro(df, mapeamento_financeiro, "receita_produtos", ["venda produto", "produtos", "venda_produtos"])
    rec_serv = _obter_valor_financeiro(df, mapeamento_financeiro, "receita_servicos", ["venda servico", "servicos", "honorarios", "venda_servicos"])
    rec_outr = _obter_valor_financeiro(df, mapeamento_financeiro, "receita_outros", ["outras receitas", "rendimentos", "receita_outros"])

    col_rec_total = mapeamento_financeiro.get("receita_total") or mapa.get("receita")
    if col_rec_total and col_rec_total in df.columns:
        fat_bruto = float(df[col_rec_total].apply(_to_float).sum())
    elif (rec_prod + rec_serv + rec_outr) > 0:
        fat_bruto = rec_prod + rec_serv + rec_outr
    elif kpis and kpis.get("receita_total"):
        fat_bruto = float(kpis["receita_total"])
    else:
        fat_bruto = 0.0

    # 2. IMPOSTOS E TAXAS
    col_imp = mapeamento_financeiro.get("impostos")
    if col_imp and col_imp in df.columns:
        impostos_val = float(df[col_imp].apply(_to_float).sum())
        taxa_usada = (impostos_val / fat_bruto * 100) if fat_bruto > 0 else 0.0
    else:
        taxa_raw = mapeamento_financeiro.get("taxa_imposto_manual") or mapeamento_financeiro.get("taxa_imposto")
        if taxa_raw is not None and str(taxa_raw).strip() != "":
            try:
                taxa_usada = float(taxa_raw)
            except Exception:
                taxa_usada = 8.0
        else:
            col_tax = next((c for c in df.columns if any(k in str(c).lower() for k in ["imposto", "tributo", "simples", "iss", "icms", "pis", "cofins"])), None)
            if col_tax:
                impostos_val = float(df[col_tax].apply(_to_float).sum())
                taxa_usada = (impostos_val / fat_bruto * 100) if fat_bruto > 0 else 0.0
            else:
                taxa_usada = 8.0 if fat_bruto > 0 else 0.0
        impostos_val = fat_bruto * (taxa_usada / 100.0)

    # 3. RECEITA LÍQUIDA
    rec_liquida = max(0.0, fat_bruto - impostos_val)

    # 4. CUSTOS VARIÁVEIS
    fornec = _obter_valor_financeiro(df, mapeamento_financeiro, "fornecedores", ["fornecedor", "cmv", "cpv", "materia prima", "insumo", "compra"])
    mkt = _obter_valor_financeiro(df, mapeamento_financeiro, "publicidade", ["marketing", "publicidade", "ads", "anuncio", "trafego"])
    custo_var_outros = _obter_valor_financeiro(df, mapeamento_financeiro, "custo_variavel_outros", ["comissao", "frete", "embalagem", "custo variavel"])

    col_custo_var = mapeamento_financeiro.get("custo_variavel")
    if col_custo_var and col_custo_var in df.columns:
        custo_var_total = float(df[col_custo_var].apply(_to_float).sum())
    elif (fornec + mkt + custo_var_outros) > 0:
        custo_var_total = fornec + mkt + custo_var_outros
    else:
        custo_var_total = 0.0
        if mapa.get("categoria") and mapa.get("despesa") and mapa["categoria"] in df.columns and mapa["despesa"] in df.columns:
            kw_var = ["fornecedor", "cmv", "cpv", "mercadoria", "materia", "insumo", "publicidade", "marketing", "ads", "frete", "comissao", "variavel"]
            for _, row in df.iterrows():
                cat_str = str(row.get(mapa["categoria"], "")).lower()
                if any(kw in cat_str for kw in kw_var):
                    custo_var_total += _to_float(row.get(mapa["despesa"], 0))

    # 5. MARGEM DE CONTRIBUIÇÃO / LUCRO BRUTO
    margem_contrib = rec_liquida - custo_var_total

    # 6. DESPESAS FIXAS
    aluguel = _obter_valor_financeiro(df, mapeamento_financeiro, "aluguel", ["aluguel", "locacao", "condominio", "iptu"], periodo)
    folha = _obter_valor_financeiro(df, mapeamento_financeiro, "folha_pagamento", ["folha", "salario", "funcionario", "colaborador", "rh"], periodo)
    pro_labore = _obter_valor_financeiro(df, mapeamento_financeiro, "pro_labore", ["pro-labore", "pro labore", "retirada socio"], periodo)
    gastos_fix_outros = _obter_valor_financeiro(df, mapeamento_financeiro, "gasto_fixo_outros", ["energia", "luz", "agua", "internet", "telefone", "contabilidade", "fixo", "overhead"], periodo)

    despesas_fixas_soma = aluguel + folha + pro_labore + gastos_fix_outros

    if despesas_fixas_soma > 0:
        despesa_fixa_total = despesas_fixas_soma
    else:
        despesa_total_kpi = float(kpis.get("despesa_total", 0)) if kpis else 0.0
        if despesa_total_kpi > custo_var_total:
            despesa_fixa_total = despesa_total_kpi - custo_var_total
        else:
            despesa_fixa_total = despesa_total_kpi

    # 7. RESULTADO / LUCRO FINAL
    col_res = mapeamento_financeiro.get("resultado") or mapa.get("lucro")
    if col_res and col_res in df.columns:
        resultado_final = float(df[col_res].apply(_to_float).sum())
    else:
        resultado_final = margem_contrib - despesa_fixa_total

    def calc_pct(v):
        return round((v / fat_bruto * 100), 1) if fat_bruto > 0 else 0.0

    dre_linhas = [
        {
            "id": "faturamento_bruto",
            "label": "Faturamento Bruto (Receita)",
            "valor": round(fat_bruto, 2),
            "percentual": 100.0 if fat_bruto > 0 else 0.0,
            "tipo": "positivo",
            "detalhes": {
                "Venda de Produtos": round(rec_prod, 2),
                "Venda de Serviços": round(rec_serv, 2),
                "Outras Receitas": round(rec_outr, 2),
                "Faturamento Total": round(fat_bruto, 2)
            }
        },
        {
            "id": "impostos_taxas",
            "label": "Impostos e Taxas",
            "valor": round(-abs(impostos_val), 2),
            "percentual": calc_pct(impostos_val),
            "tipo": "deducao",
            "detalhes": {
                "Base de Cálculo (Receita)": round(fat_bruto, 2),
                f"Alíquota Aplicada ({round(taxa_usada, 1)}%)": round(impostos_val, 2),
                "(-) Total de Impostos": round(-abs(impostos_val), 2)
            }
        },
        {
            "id": "receita_liquida",
            "label": "Receita Líquida",
            "valor": round(rec_liquida, 2),
            "percentual": calc_pct(rec_liquida),
            "tipo": "subtotal",
            "detalhes": {
                "Faturamento Bruto": round(fat_bruto, 2),
                "(-) Impostos e Deduções": round(-abs(impostos_val), 2),
                "(=) Receita Líquida": round(rec_liquida, 2)
            }
        },
        {
            "id": "custo_variavel",
            "label": "Custos Variáveis",
            "valor": round(-abs(custo_var_total), 2),
            "percentual": calc_pct(custo_var_total),
            "tipo": "deducao",
            "detalhes": {
                "Fornecedores / CMV": round(fornec, 2),
                "Marketing / Publicidade": round(mkt, 2),
                "Outros Custos Variáveis": round(custo_var_outros, 2),
                "(-) Total Custos Variáveis": round(-abs(custo_var_total), 2)
            }
        },
        {
            "id": "margem_contribuicao",
            "label": "Margem Contribuição / Lucro Bruto",
            "valor": round(margem_contrib, 2),
            "percentual": calc_pct(margem_contrib),
            "tipo": "subtotal",
            "detalhes": {
                "Receita Líquida": round(rec_liquida, 2),
                "(-) Custos Variáveis": round(-abs(custo_var_total), 2),
                "(=) Margem de Contribuição": round(margem_contrib, 2),
                "Margem de Contribuição (%)": f"{calc_pct(margem_contrib)}%"
            }
        },
        {
            "id": "despesa_fixa",
            "label": "Despesas Fixas",
            "valor": round(-abs(despesa_fixa_total), 2),
            "percentual": calc_pct(despesa_fixa_total),
            "tipo": "deducao",
            "detalhes": {
                "Aluguel / Locação": round(aluguel, 2),
                "Folha de Pagamento": round(folha, 2),
                "Pró-labore dos Sócios": round(pro_labore, 2),
                "Outros Gastos Fixos / Overhead": round(gastos_fix_outros, 2),
                "(-) Total Despesas Fixas": round(-abs(despesa_fixa_total), 2)
            }
        },
        {
            "id": "resultado_lucro",
            "label": "Resultado / Lucro Final",
            "valor": round(resultado_final, 2),
            "percentual": calc_pct(resultado_final),
            "tipo": "liquido" if resultado_final >= 0 else "negativo",
            "detalhes": {
                "Margem de Contribuição": round(margem_contrib, 2),
                "(-) Despesas Fixas": round(-abs(despesa_fixa_total), 2),
                "(=) Resultado / Lucro Final": round(resultado_final, 2),
                "Margem Líquida (%)": f"{calc_pct(resultado_final)}%"
            }
        }
    ]

    return dre_linhas


# ======================
# INSIGHTS
# ======================

def gerar_insights(kpis, evolucao, categorias):

    insights = []

    lucros = evolucao["lucro"]

    if len(lucros) > 1:
        if lucros[-1] > lucros[0]:
            insights.append({
                "tipo": "positivo",
                "texto": "Lucro em crescimento no período analisado."
            })
        else:
            insights.append({
                "tipo": "atencao",
                "texto": "Queda no lucro detectada."
            })

    if categorias["labels"]:
        insights.append({
            "tipo": "atencao",
            "texto": f"Maior despesa: {categorias['labels'][0]}"
        })

    return insights


# ======================
# PRINCIPAL (COM PERÍODO E DRE)
# ======================

def processar_dados_dashboard(colunas, dados, periodo=30, mapeamento=None, mapeamento_financeiro=None):

    if not dados:
        print(" Nenhum dado fornecido")
        return {"erro": "Sem dados"}

    if mapeamento is None:
        mapeamento = {}
    if mapeamento_financeiro is None:
        mapeamento_financeiro = {}

    df = pd.DataFrame(dados, columns=colunas)

    mapa = detectar_colunas(colunas, dados, mapeamento)

    df = filtrar_periodo(df, mapa["data"], periodo)

    kpis = calcular_kpis(df, mapa)
    evolucao = evolucao_financeira(df, mapa)
    categorias = despesas_por_categoria(df, mapa)
    dre = calcular_dre_completo(df, mapa, mapeamento_financeiro, periodo, kpis)

    return {
        "kpis": kpis,
        "evolucao": evolucao,
        "categorias": categorias,
        "dre": dre,
        "insights": gerar_insights(kpis, evolucao, categorias)
    }


def converter_json_safe(obj):
    import numpy as np
    import pandas as pd

    if isinstance(obj, dict):
        return {k: converter_json_safe(v) for k, v in obj.items()}

    elif isinstance(obj, list):
        return [converter_json_safe(v) for v in obj]

    elif isinstance(obj, (np.integer, np.int64)):
        return int(obj)

    elif isinstance(obj, (np.floating, np.float64)):
        return float(obj)

    elif isinstance(obj, np.ndarray):
        return obj.tolist()

    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()

    return obj