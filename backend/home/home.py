from flask import session, jsonify
from backend.db import dados_colecao
from datetime import datetime, timedelta
import pandas as pd

# ======================
# CONFIG
# ======================
COL_FATURAMENTO = ["Total", "Faturamento", "faturamento", "Vendas", "vendas", "Receita", "receita"]
COL_DESPESA = ["Custo", "Despesa", "despesa", "Despesas", "despesas", "Gastos", "gastos"]
COL_LUCRO = ["Lucro", "lucro", "Profit", "profit"]


# ======================
# UTIL
# ======================
def encontrar_coluna_data(df):
    return next((c for c in df.columns if c.lower() == "data"), None)


def converter_datas(df, col):
    if col not in df.columns:
        return df

    df = df.copy()
    df[col] = pd.to_datetime(df[col], errors='coerce', dayfirst=True)
    return df


def calcular_total(df, colunas):
    if df.empty:
        return 0
    for col in colunas:
        if col in df.columns:
            return float(pd.to_numeric(df[col], errors='coerce').sum())
    return 0


def percentual(anterior, atual):
    if anterior == 0:
        return 0 if atual == 0 else 100
    return ((atual - anterior) / anterior) * 100


def filtrar_periodo(df, col, periodo):
    if df.empty or not col:
        return df, df

    df = df.dropna(subset=[col])
    fim = df[col].max()

    dias = {
        "7_dias": 7,
        "30_dias": 30,
        "90_dias": 90
    }

    if periodo in dias:
        inicio = fim - timedelta(days=dias[periodo])
        inicio_ant = inicio - timedelta(days=dias[periodo])
        fim_ant = inicio
    elif periodo == "ano_atual":
        inicio = datetime(fim.year, 1, 1)
        inicio_ant = datetime(fim.year - 1, 1, 1)
        fim_ant = inicio
    else:
        return filtrar_periodo(df, col, "30_dias")

    atual = df[(df[col] >= inicio) & (df[col] <= fim)]
    anterior = df[(df[col] >= inicio_ant) & (df[col] < fim_ant)]

    return atual, anterior


def empty():
    return {
        "faturamento": {"valor": 0, "percentual": 0, "valor_anterior": 0},
        "lucro": {"valor": 0, "percentual": 0, "valor_anterior": 0},
        "despesa": {"valor": 0, "percentual": 0, "valor_anterior": 0},
        "crescimento": {"valor": 0}
    }


def empty_graph():
    return {"labels": [], "series": []}


# ======================
# MAPEAMENTO DINÂMICO
# ======================
def obter_colunas_mapeadas(usuario_id):
    from backend.db import usuario
    from bson import ObjectId
    user = usuario.find_one({"_id": ObjectId(usuario_id)})
    return user.get("mapeamento", {}) if user else {}

def calcular_total_dinamico(df, indicador, mapeamento, colunas_fallback):
    coluna = mapeamento.get(indicador)
    if coluna and coluna in df.columns:
        return float(pd.to_numeric(df[coluna], errors='coerce').sum())
    
    # Fallback para as listas fixas se não houver mapeamento
    for col in colunas_fallback:
        if col in df.columns:
            return float(pd.to_numeric(df[col], errors='coerce').sum())
    return 0


# ======================
# DESempenho
# ======================
def calcular_desempenho(periodo="30_dias"):
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    try:
        doc = dados_colecao.find_one({"usuario_id": user_id}, sort=[("criado_em", -1)])
        if not doc:
            return jsonify(empty()), 200

        df = pd.DataFrame(doc.get("dados", []))
        if df.empty:
            return jsonify(empty()), 200

        # Mapeamento do usuário
        mapeamento = obter_colunas_mapeadas(user_id)
        
        # Encontrar coluna de data (mapeada ou fallback)
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)
            
        df = converter_datas(df, col_data)

        atual, anterior = filtrar_periodo(df, col_data, periodo)

        # Cálculos Dinâmicos
        fat = calcular_total_dinamico(atual, "faturamento", mapeamento, COL_FATURAMENTO)
        desp = calcular_total_dinamico(atual, "despesa", mapeamento, COL_DESPESA)
        
        # Lucro pode ser coluna direta ou calculada
        luc = calcular_total_dinamico(atual, "lucro", mapeamento, COL_LUCRO) or (fat - desp)

        fat_ant = calcular_total_dinamico(anterior, "faturamento", mapeamento, COL_FATURAMENTO)
        desp_ant = calcular_total_dinamico(anterior, "despesa", mapeamento, COL_DESPESA)
        luc_ant = calcular_total_dinamico(anterior, "lucro", mapeamento, COL_LUCRO) or (fat_ant - desp_ant)

        return jsonify({
            "faturamento": {
                "valor": round(fat, 2),
                "percentual": round(percentual(fat_ant, fat), 1),
                "valor_anterior": round(fat_ant, 2)
            },
            "lucro": {
                "valor": round(luc, 2),
                "percentual": round(percentual(luc_ant, luc), 1),
                "valor_anterior": round(luc_ant, 2)
            },
            "despesa": {
                "valor": round(desp, 2),
                "percentual": round(percentual(desp_ant, desp) * -1, 1),
                "valor_anterior": round(desp_ant, 2)
            },
            "crescimento": {
                "valor": round(percentual(fat_ant, fat), 1)
            },
            "mapeamento_ativo": bool(mapeamento),
            "mapeamento": mapeamento
        }), 200

    except Exception as e:
        print("Erro:", e)
        return jsonify(empty()), 500
# GRÁFICOS
# ======================
def obter_dados_graficos(periodo="30_dias"):
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    try:
        doc = dados_colecao.find_one({"usuario_id": user_id}, sort=[("criado_em", -1)])
        if not doc:
            return jsonify({
                "grafico_linha": empty_graph(),
                "grafico_barras": empty_graph()
            }), 200

        df = pd.DataFrame(doc.get("dados", []))
        if df.empty:
             return jsonify({
                "grafico_linha": empty_graph(),
                "grafico_barras": empty_graph()
            }), 200

        # Mapeamento do usuário
        mapeamento = obter_colunas_mapeadas(user_id)
        
        # Encontrar coluna de data
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)

        if not col_data:
            return jsonify({
                "grafico_linha": empty_graph(),
                "grafico_barras": empty_graph()
            }), 200

        df = converter_datas(df, col_data).dropna(subset=[col_data])

        return jsonify({
            "grafico_linha": grafico_linha(df, col_data, periodo, mapeamento),
            "grafico_barras": grafico_barras(df, col_data, periodo, mapeamento),
            "grafico_pizza": grafico_pizza(df, col_data, periodo, mapeamento)
        }), 200

    except Exception as e:
        print("Erro:", e)
        return jsonify({"erro": str(e)}), 500


# ======================
# PROCESSAMENTO GRÁFICOS
# ======================
def filtrar_df(df, col, periodo):
    if df.empty: return df
    fim = df[col].max()

    dias = {"7_dias": 7, "30_dias": 30, "90_dias": 90}
    if periodo in dias:
        inicio = fim - timedelta(days=dias[periodo])
        return df[(df[col] >= inicio) & (df[col] <= fim)]
    elif periodo == "ano_atual":
        inicio = datetime(fim.year, 1, 1)
        return df[(df[col] >= inicio) & (df[col] <= fim)]
    elif periodo.startswith("mes_"):
        try:
            mes = int(periodo.split("_")[1])
            ano = fim.year
            return df[(df[col].dt.month == mes) & (df[col].dt.year == ano)]
        except:
            pass

    return filtrar_df(df, col, "30_dias")


def grafico_linha(df, col, periodo, mapeamento):
    df = filtrar_df(df, col, periodo)
    if df.empty:
        return empty_graph()

    df["data_str"] = df[col].dt.strftime('%d/%m')
    grupos = df.groupby("data_str")

    labels_raw = list(grupos.groups.keys())
    labels = sorted(labels_raw, key=lambda x: datetime.strptime(x + "/2000", "%d/%m/%Y"))

    fat_list, desp_list, luc_list = [], [], []

    for label in labels:
        g = grupos.get_group(label)
        f = calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO)
        d = calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA)
        l = calcular_total_dinamico(g, "lucro", mapeamento, COL_LUCRO) or (f - d)

        fat_list.append(round(f, 2))
        desp_list.append(round(d, 2))
        luc_list.append(round(l, 2))

    return {
        "labels": labels,
        "series": [
            {"name": "Faturamento", "data": fat_list},
            {"name": "Despesas", "data": desp_list},
            {"name": "Lucro", "data": luc_list}
        ]
    }


def grafico_barras(df, col, periodo, mapeamento):
    df = filtrar_df(df, col, periodo)
    if df.empty:
        return empty_graph()

    df["periodo_agrupado"] = df[col].dt.strftime('%b/%Y')
    grupos = df.groupby("periodo_agrupado")

    labels, fat, desp, luc = [], [], [], []

    for nome, g in grupos:
        labels.append(nome)
        
        f = calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO)
        d = calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA)
        l = calcular_total_dinamico(g, "lucro", mapeamento, COL_LUCRO) or (f - d)

        fat.append(round(f, 2))
        desp.append(round(d, 2))
        luc.append(round(l, 2))

    return {
        "labels": labels,
        "series": [
            {"name": "Faturamento", "data": fat},
            {"name": "Despesas", "data": desp},
            {"name": "Lucro", "data": luc}
        ]
    }

def grafico_pizza(df, col, periodo, mapeamento):
    df = filtrar_df(df, col, periodo)
    if df.empty:
        return empty_graph()

    f = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
    d = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)
    l = calcular_total_dinamico(df, "lucro", mapeamento, COL_LUCRO) or (f - d)

    return {
        "labels": ["Faturamento", "Despesas", "Lucro"],
        "series": [max(0, round(f, 2)), max(0, round(d, 2)), max(0, round(l, 2))]
    }


# ======================
# STATUS DO NEGÓCIO
# ======================
def gerar_status_negocio(periodo="30_dias"):
    """Gera o status do negócio (Saudável, Estável ou Em Perigo) baseado na análise dos dados"""
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    try:
        # Obter dados de desempenho
        response_desempenho, status_desempenho = calcular_desempenho(periodo)
        if status_desempenho != 200:
            return jsonify({"status": "indefinido", "mensagem": "Dados insuficientes"}), 200

        dados = response_desempenho.get_json()
        
        faturamento = dados.get('faturamento', {})
        lucro = dados.get('lucro', {})
        despesa = dados.get('despesa', {})

        lucro_valor = lucro.get('valor', 0)
        lucro_percentual = lucro.get('percentual', 0)
        faturamento_percentual = faturamento.get('percentual', 0)
        despesa_percentual = despesa.get('percentual', 0)

        # Análise de saúde do negócio
        status = "indefinido"
        cor = "#9ca3af"
        emoji = "⚪"
        descricao = "Sem dados suficientes para análise"

        if lucro_valor > 0:
            if lucro_percentual >= 10 and faturamento_percentual >= 5:
                # Saudável: Lucro positivo com crescimento forte
                status = "saudavel"
                cor = "#10b981"
                emoji = "🟢"
                descricao = f"O negócio está saudável com lucro de R$ {lucro_valor:,.2f} e crescimento de {faturamento_percentual:.1f}%."
            elif lucro_percentual >= 0 or faturamento_percentual >= 0:
                # Estável: Lucro positivo mas crescimento moderado
                status = "estavel"
                cor = "#f59e0b"
                emoji = "🟡"
                descricao = f"O negócio está estável. Lucro de R$ {lucro_valor:,.2f}, mas o crescimento pode ser melhorado."
            else:
                # Em Perigo: Lucro positivo mas em queda
                status = "em_perigo"
                cor = "#ef4444"
                emoji = "🔴"
                descricao = f"O negócio está em perigo com redução de {abs(lucro_percentual):.1f}%. Revise as despesas."
        else:
            # Em Perigo: Lucro negativo (prejuízo)
            status = "em_perigo"
            cor = "#ef4444"
            emoji = "🔴"
            descricao = f"Atenção! Prejuízo de R$ {abs(lucro_valor):,.2f}. Despesas devem ser reduzidas urgentemente."

        return jsonify({
            "status": status,
            "emoji": emoji,
            "cor": cor,
            "descricao": descricao,
            "lucro_valor": round(lucro_valor, 2),
            "lucro_percentual": round(lucro_percentual, 1),
            "faturamento_valor": round(faturamento.get('valor', 0), 2),
            "faturamento_percentual": round(faturamento_percentual, 1),
            "despesa_valor": round(despesa.get('valor', 0), 2),
            "periodo": periodo
        }), 200

    except Exception as e:
        print("Erro ao gerar status:", e)
        return jsonify({"status": "erro", "mensagem": str(e)}), 500
