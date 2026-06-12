from flask import session, jsonify, request
from backend.db import dados_colecao
from datetime import datetime, timedelta
import pandas as pd


# ======================
# COLUNAS RECONHECIDAS
# ======================
COL_FATURAMENTO = ["Total", "Faturamento", "faturamento", "Vendas", "vendas", "Receita", "receita"]
COL_DESPESA     = ["Custo", "Despesa", "despesa", "Despesas", "despesas", "Gastos", "gastos"]
COL_LUCRO       = ["Lucro", "lucro", "Profit", "profit"]


# ======================
# UTILITÁRIOS
# ======================
def encontrar_coluna_data(df):
    return next((c for c in df.columns if c.lower() == "data"), None)


def calcular_total(df, colunas):
    if df.empty:
        return 0.0

    for col in colunas:
        if col in df.columns:
            return float(pd.to_numeric(df[col], errors="coerce").sum())

    return 0.0


def variacao_percentual(anterior, atual):
    if anterior == 0:
        return 0.0 if atual == 0 else 100.0
    return round(((atual - anterior) / anterior) * 100, 2)


def filtrar_por_periodo(df, col_data, inicio, fim):
    if df.empty or not col_data:
        return df

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])

    return df[(df[col_data] >= inicio) & (df[col_data] <= fim)]


def calcular_metricas(df):
    fat  = calcular_total(df, COL_FATURAMENTO)
    desp = calcular_total(df, COL_DESPESA)
    luc  = calcular_total(df, COL_LUCRO) or (fat - desp)
    mg   = 0.0 if fat == 0 else round((luc / fat) * 100, 2)

    return fat, desp, luc, mg


# ======================
# 🔥 GERAR SÉRIES MENSAIS (GRÁFICO NOVO)
# ======================
def gerar_series(df, col_data):
    if df.empty or not col_data:
        return {
            "meses": [],
            "faturamento": [],
            "despesas": [],
            "lucro": [],
            "margem": []
        }

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])
    df = df.sort_values(col_data)

    # Criar coluna de mês/ano
    df["mes"] = df[col_data].dt.strftime("%Y-%m-%d")

    # Pegar apenas colunas numéricas
    colunas_numericas = df.select_dtypes(include="number").columns
    df_num = df[["mes"] + list(colunas_numericas)]

    agrupado = df_num.groupby("mes").sum().reset_index()

    # 🔥 MESES EM ISO
    meses = agrupado["mes"].tolist()

    def soma_colunas(row, colunas):
        return sum([row[c] for c in colunas if c in row and pd.notna(row[c])])

    faturamento = []
    despesas = []
    lucro = []
    margem = []

    for _, row in agrupado.iterrows():
        fat = soma_colunas(row, COL_FATURAMENTO)
        desp = soma_colunas(row, COL_DESPESA)
        luc = soma_colunas(row, COL_LUCRO) or (fat - desp)

        mg = (luc / fat * 100) if fat != 0 else 0

        faturamento.append(round(fat, 2))
        despesas.append(round(desp, 2))
        lucro.append(round(luc, 2))
        margem.append(round(mg, 2))

    return {
        "meses": meses,
        "faturamento": faturamento,
        "despesas": despesas,
        "lucro": lucro,
        "margem": margem
    }


# ======================
# SALVAR ÚLTIMO PERÍODO
# ======================
def salvar_ultimo_periodo(user, inicio, fim):
    dados_colecao.update_one(
        {"usuario_id": user},
        {
            "$set": {
                "ultimo_periodo": {
                    "inicio": inicio,
                    "fim": fim
                }
            }
        },
        upsert=True
    )


# ======================
# OBTER ÚLTIMO PERÍODO
# ======================
def obter_ultimo_periodo():
    user = session.get("usuario_id")

    if not user:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    doc = dados_colecao.find_one({"usuario_id": user})

    if doc and "ultimo_periodo" in doc:
        return jsonify(doc["ultimo_periodo"]), 200

    return jsonify({}), 200


# ======================
# ENDPOINT PRINCIPAL
# ======================
def analise_por_periodo():

    user = session.get("usuario_id")
    if not user:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    data_inicio_str = request.args.get("data_inicio", "")
    data_fim_str    = request.args.get("data_fim", "")

    if not data_inicio_str or not data_fim_str:
        return jsonify({"mensagem": "Informe data_inicio e data_fim"}), 400

    try:
        data_inicio = datetime.strptime(data_inicio_str, "%Y-%m-%d")
        data_fim    = datetime.strptime(data_fim_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"mensagem": "Formato de data inválido"}), 400

    if data_inicio > data_fim:
        return jsonify({"mensagem": "Data inválida"}), 400

    try:
        # Buscar dados do usuário
        doc = dados_colecao.find_one(
            {"usuario_id": user},
            sort=[("criado_em", -1)]
        )

        if not doc:
            return jsonify({"mensagem": "Nenhum dado encontrado"}), 200

        df = pd.DataFrame(doc.get("dados", []))

        if df.empty:
            return jsonify({"mensagem": "Nenhum dado encontrado"}), 200

        # Mapeamento do usuário
        from backend.home.home import obter_colunas_mapeadas, calcular_total_dinamico
        mapeamento = obter_colunas_mapeadas(user)
        
        # Encontrar coluna de data (mapeada ou fallback)
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)

        # Período atual
        df_atual = filtrar_por_periodo(df, col_data, data_inicio, data_fim)

        # Período anterior
        duracao = (data_fim - data_inicio).days + 1
        fim_ant = data_inicio - timedelta(days=1)
        inicio_ant = fim_ant - timedelta(days=duracao - 1)

        df_ant = filtrar_por_periodo(df, col_data, inicio_ant, fim_ant)

        # Métricas Dinâmicas
        def calcular_metricas_dinamicas(df_target):
            fat  = calcular_total_dinamico(df_target, "faturamento", mapeamento, COL_FATURAMENTO)
            desp = calcular_total_dinamico(df_target, "despesa", mapeamento, COL_DESPESA)
            luc  = calcular_total_dinamico(df_target, "lucro", mapeamento, COL_LUCRO) or (fat - desp)
            mg   = 0.0 if fat == 0 else round((luc / fat) * 100, 2)
            return fat, desp, luc, mg

        fat, desp, luc, mg = calcular_metricas_dinamicas(df_atual)
        fat_a, desp_a, luc_a, mg_a = calcular_metricas_dinamicas(df_ant)

        # 🔥 GRÁFICO NOVO
        series = gerar_series(df_atual, col_data)

        # Salvar período
        salvar_ultimo_periodo(user, data_inicio_str, data_fim_str)

        # Histórico
        historico = session.get('analises_realizadas', [])

        historico.insert(0, {
            "periodo_inicio": data_inicio_str,
            "periodo_fim": data_fim_str,
            "data": datetime.now().strftime("%d/%m/%Y"),
            "hora": datetime.now().strftime("%H:%M"),
            "faturamento": round(fat, 2),
            "despesa": round(desp, 2),
            "lucro": round(luc, 2),
            "margem": mg,
        })

        session['analises_realizadas'] = historico[:10]

        # Formatar dados para o gráfico no frontend
        grafico_dados = {
            "labels": series["meses"],
            "series": [
                {"name": "Faturamento", "data": series["faturamento"]},
                {"name": "Despesas", "data": series["despesas"]},
                {"name": "Lucro", "data": series["lucro"]},
                {"name": "Margem", "data": series["margem"]}
            ]
        }

        return jsonify({
            "periodo": {
                "inicio": data_inicio_str,
                "fim": data_fim_str,
                "inicio_anterior": inicio_ant.strftime("%Y-%m-%d"),
                "fim_anterior": fim_ant.strftime("%Y-%m-%d"),
            },
            "faturamento": {
                "valor": round(fat, 2),
                "valor_anterior": round(fat_a, 2),
                "variacao": variacao_percentual(fat_a, fat),
            },
            "despesa": {
                "valor": round(desp, 2),
                "valor_anterior": round(desp_a, 2),
                "variacao": variacao_percentual(desp_a, desp),
            },
            "lucro": {
                "valor": round(luc, 2),
                "valor_anterior": round(luc_a, 2),
                "variacao": variacao_percentual(luc_a, luc),
            },
            "margem": {
                "valor": mg,
                "valor_anterior": mg_a,
                "variacao": round(mg - mg_a, 2),
            },

            # 🔥 NOVO FORMATO PARA GRÁFICO
            "grafico": grafico_dados

        }), 200

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({"mensagem": f"Erro interno: {str(e)}"}), 500