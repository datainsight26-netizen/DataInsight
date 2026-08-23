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

    print(f" Filtrando período:")
    print(f"   - Data máxima dos dados: {fim}")
    print(f"   - Data mínima do filtro: {inicio}")
    print(f"   - Período: {periodo} dias")

    df_filtrado = df[df[col_data] >= inicio]
    
    print(f" Registros após filtro: {len(df_filtrado)} de {len(df)}")
    
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

    # 🔥 FORMATAR LABELS COM ISO
    labels = []
    for val in g[cdata]:
        if isinstance(val, (pd.Timestamp, datetime)):
            # Formato ISO (YYYY-MM-DD)
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
# PRINCIPAL ( COM PERÍODO)
# ======================

def processar_dados_dashboard(colunas, dados, periodo=30, mapeamento=None):

    if not dados:
        print(" Nenhum dado fornecido")
        return {"erro": "Sem dados"}

    print(f" Processando dashboard - {len(dados)} registros, período {periodo} dias")
    print(f" Colunas: {colunas}")

    df = pd.DataFrame(dados, columns=colunas)

    mapa = detectar_colunas(colunas, dados, mapeamento)
    
    print(f" Mapa de colunas detectadas:")
    print(f"   - Data: {mapa['data']}")
    print(f"   - Receita: {mapa['receita']}")
    print(f"   - Despesa: {mapa['despesa']}")
    print(f"   - Lucro: {mapa['lucro']}")
    print(f"   - Categoria: {mapa['categoria']}")

    df = filtrar_periodo(df, mapa["data"], periodo)


    kpis = calcular_kpis(df, mapa)

    evolucao = evolucao_financeira(df, mapa)

    categorias = despesas_por_categoria(df, mapa)

    return {
        "kpis": kpis,
        "evolucao": evolucao,
        "categorias": categorias,
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