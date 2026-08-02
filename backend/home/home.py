from flask import session, jsonify
from backend.db import dados_colecao
from datetime import datetime, timedelta
import pandas as pd

# ======================
# CONFIG
# ======================
COL_FATURAMENTO = ["Faturamento", "faturamento", "Receita", "receita", "Vendas", "vendas", "Total"]
COL_DESPESA = ["Despesa", "despesa", "Despesas", "despesas", "Gastos", "gastos", "Custo", "custo"]
COL_LUCRO = ["Lucro", "lucro", "Profit", "profit"]
COL_CATEGORIA = ["Categoria", "categoria", "category", "tipo", "type", "grupo", "group", "setor", "classe"]
COL_PRODUTO = ["Produto", "produto", "product", "item", "Item", "nome_produto", "nome do produto", "sku", "codigo", "codigo_produto", "codigo do produto"]
COL_QUANTIDADE = ["Quantidade", "quantidade", "Qtd", "qtd", "qty", "quant", "unidades", "unidade", "units", "unit"]
COL_ESTOQUE = ["Estoque", "estoque", "Stock", "stock", "Saldo", "saldo", "saldo_estoque", "qtd_estoque", "estoque_atual", "quantidade_estoque", "unidades_estoque"]


# ======================
# UTIL
# ======================
def encontrar_coluna_data(df):
    return next((c for c in df.columns if c.lower() == "data"), None)


def converter_datas(df, col):
    if col not in df.columns:
        return df

    df = df.copy()
    # ISO (YYYY-MM-DD) e formatos BR (DD/MM/YYYY) sem forçar dayfirst
    df[col] = pd.to_datetime(df[col], errors="coerce", format="mixed")
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


def encontrar_coluna_por_aliases(df, mapeamento, indicador, colunas_alias):
    coluna = mapeamento.get(indicador)
    if coluna and coluna in df.columns:
        return coluna

    for alias in colunas_alias:
        if alias in df.columns:
            return alias

    for alias in colunas_alias:
        for c in df.columns:
            if alias.lower() in c.lower():
                return c

    return None


def encontrar_coluna_categoria(df, mapeamento):
    return encontrar_coluna_por_aliases(df, mapeamento, "categoria", COL_CATEGORIA)


def encontrar_coluna_produto(df, mapeamento):
    return encontrar_coluna_por_aliases(df, mapeamento, "produto", COL_PRODUTO)


def encontrar_coluna_quantidade(df, mapeamento):
    return encontrar_coluna_por_aliases(df, mapeamento, "quantidade", COL_QUANTIDADE)


def encontrar_coluna_estoque(df, mapeamento):
    return encontrar_coluna_por_aliases(df, mapeamento, "estoque", COL_ESTOQUE)


# ======================
# DESempenho
# ======================
def obter_produtos_overview(periodo="30_dias"):
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    try:
        doc = dados_colecao.find_one({"usuario_id": user_id}, sort=[("criado_em", -1)])
        if not doc:
            return jsonify({
                "produto_coluna": None,
                "tem_quantidade": False,
                "tem_estoque": False,
                "tabela_produtos": [],
                "grafico_vendas": {"labels": [], "series": []},
                "grafico_lucro": {"labels": [], "series": []}
            }), 200

        df = pd.DataFrame(doc.get("dados", []))
        if df.empty:
            return jsonify({
                "produto_coluna": None,
                "tem_quantidade": False,
                "tem_estoque": False,
                "tabela_produtos": [],
                "grafico_vendas": {"labels": [], "series": []},
                "grafico_lucro": {"labels": [], "series": []}
            }), 200

        mapeamento = obter_colunas_mapeadas(user_id)
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)

        df = converter_datas(df, col_data)
        atual, _ = filtrar_periodo(df, col_data, periodo)

        if atual.empty:
            return jsonify({
                "produto_coluna": None,
                "tem_quantidade": False,
                "tem_estoque": False,
                "tabela_produtos": [],
                "grafico_vendas": {"labels": [], "series": []},
                "grafico_lucro": {"labels": [], "series": []}
            }), 200

        produto_col = encontrar_coluna_produto(atual, mapeamento)
        quantidade_col = encontrar_coluna_quantidade(atual, mapeamento)
        estoque_col = encontrar_coluna_estoque(atual, mapeamento)
        categoria_col = encontrar_coluna_categoria(atual, mapeamento)
        fat_col = obter_coluna_indicador(atual, 'faturamento', mapeamento, COL_FATURAMENTO)
        desp_col = obter_coluna_indicador(atual, 'despesa', mapeamento, COL_DESPESA)
        luc_col = obter_coluna_indicador(atual, 'lucro', mapeamento, COL_LUCRO)

        # Se não houver coluna de produto, use categoria como fallback para exibir algo relevante.
        if (not produto_col or produto_col not in atual.columns) and categoria_col and categoria_col in atual.columns:
            produto_col = categoria_col

        # Fallback adicional: qualquer coluna de texto disponível que não seja a data.
        if not produto_col or produto_col not in atual.columns:
            for c in atual.columns:
                if c == col_data:
                    continue
                if pd.api.types.is_string_dtype(atual[c]) or pd.api.types.is_categorical_dtype(atual[c]):
                    produto_col = c
                    break

        # Se ainda não houver produto, tente qualquer coluna não numérica.
        if not produto_col or produto_col not in atual.columns:
            for c in atual.columns:
                if c == col_data:
                    continue
                if not pd.api.types.is_numeric_dtype(atual[c]) and not pd.api.types.is_bool_dtype(atual[c]):
                    produto_col = c
                    break

        # Último recurso: criar um rótulo de linha para garantir que todos os registros apareçam.
        if not produto_col or produto_col not in atual.columns:
            atual = atual.reset_index(drop=True)
            atual['_produto_label'] = atual.index.to_series().add(1).apply(lambda i: f"Linha {i}")
            produto_col = '_produto_label'

        if quantidade_col and quantidade_col in atual.columns:
            atual['_qtd'] = pd.to_numeric(atual[quantidade_col], errors='coerce').fillna(0)
        else:
            atual['_qtd'] = 0

        if estoque_col and estoque_col in atual.columns:
            atual['_estoque'] = pd.to_numeric(atual[estoque_col], errors='coerce').fillna(0)
            tem_estoque = True
        else:
            atual['_estoque'] = 0
            tem_estoque = False

        atual['_faturamento'] = pd.to_numeric(atual[fat_col], errors='coerce').fillna(0) if fat_col else 0
        atual['_despesa'] = pd.to_numeric(atual[desp_col], errors='coerce').fillna(0) if desp_col else 0
        if luc_col and luc_col in atual.columns:
            atual['_lucro'] = pd.to_numeric(atual[luc_col], errors='coerce').fillna(0)
        else:
            atual['_lucro'] = atual['_faturamento'] - atual['_despesa']

        if not produto_col or produto_col not in atual.columns:
            return jsonify({
                "produto_coluna": None,
                "tem_quantidade": bool(quantidade_col and quantidade_col in atual.columns),
                "tem_estoque": tem_estoque,
                "tabela_produtos": [],
                "grafico_vendas": {"labels": [], "series": []},
                "grafico_lucro": {"labels": [], "series": []}
            }), 200

        agregacoes = {
            'faturamento': ('_faturamento', 'sum'),
            'despesa': ('_despesa', 'sum'),
            'lucro': ('_lucro', 'sum'),
            'quantidade': ('_qtd', 'sum')
        }
        if tem_estoque:
            agregacoes['estoque'] = ('_estoque', 'sum')

        agrupado = atual.groupby(produto_col).agg(**agregacoes).reset_index()
        agrupado = agrupado.fillna(0)

        def to_dict(row):
            return {
                'nome': str(row[produto_col]),
                'faturamento': float(row['faturamento']),
                'despesa': float(row['despesa']),
                'lucro': float(row['lucro']),
                'quantidade': float(row['quantidade']),
                'estoque': float(row['estoque']) if tem_estoque else None
            }

        tabela_produtos = [to_dict(row) for _, row in agrupado.sort_values('faturamento', ascending=False).iterrows()]

        grafico_vendas_base = agrupado.sort_values('quantidade', ascending=False).head(5)
        grafico_lucro_base = agrupado.sort_values('lucro', ascending=False).head(5)

        def resumo_item(base, campo):
            if base.empty:
                return None
            row = base.iloc[0]
            return {
                'nome': str(row[produto_col]),
                campo: float(row[campo]),
                'valor': float(row['faturamento']),
                'despesa': float(row['despesa']),
                'lucro': float(row['lucro']),
                'quantidade': float(row['quantidade']),
                'estoque': float(row['estoque']) if tem_estoque else None
            }

        ordenado_despesa = agrupado.sort_values('despesa', ascending=False)
        ordenado_lucro = agrupado.sort_values('lucro', ascending=False)
        ordenado_estoque = agrupado.sort_values('estoque', ascending=False) if tem_estoque else agrupado

        resposta = {
            'produto_coluna': produto_col,
            'tem_quantidade': bool(quantidade_col and quantidade_col in atual.columns),
            'tem_estoque': tem_estoque,
            'mais_vendido': resumo_item(grafico_vendas_base, 'quantidade'),
            'menos_vendido': resumo_item(agrupado.sort_values('quantidade', ascending=True).head(1), 'quantidade') if quantidade_col and quantidade_col in atual.columns else None,
            'maior_despesa': resumo_item(ordenado_despesa, 'despesa'),
            'menor_despesa': resumo_item(agrupado.sort_values('despesa', ascending=True).head(1), 'despesa'),
            'maior_lucro': resumo_item(ordenado_lucro, 'lucro'),
            'menor_lucro': resumo_item(agrupado.sort_values('lucro', ascending=True).head(1), 'lucro'),
            'mais_estoque': resumo_item(ordenado_estoque, 'estoque') if tem_estoque else None,
            'menos_estoque': resumo_item(agrupado.sort_values('estoque', ascending=True).head(1), 'estoque') if tem_estoque else None,
            'tabela_produtos': tabela_produtos,
            'grafico_vendas': {
                'labels': grafico_vendas_base[produto_col].astype(str).tolist(),
                'series': grafico_vendas_base['quantidade'].fillna(0).astype(float).tolist()
            },
            'grafico_lucro': {
                'labels': grafico_lucro_base[produto_col].astype(str).tolist(),
                'series': grafico_lucro_base['lucro'].fillna(0).astype(float).tolist()
            }
        }

        return jsonify(resposta), 200

    except Exception as e:
        print("Erro ao obter overview de produtos:", e)
        return jsonify({"mensagem": str(e)}), 500


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


def obter_coluna_indicador(df, indicador, mapeamento, colunas_fallback):
    coluna = mapeamento.get(indicador)
    if coluna and coluna in df.columns:
        return coluna

    for col in colunas_fallback:
        if col in df.columns:
            return col

    return None


def obter_detalhes_kpi(periodo="30_dias", kpi="faturamento"):
    user_id = session.get('usuario_id')
    if not user_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    kpi = kpi.lower()
    if kpi not in ['faturamento', 'despesa', 'lucro']:
        return jsonify({"mensagem": "KPI inválido"}), 400

    try:
        doc = dados_colecao.find_one({"usuario_id": user_id}, sort=[("criado_em", -1)])
        if not doc:
            return jsonify({"kpi": kpi, "valor_total": 0, "detalhes": []}), 200

        df = pd.DataFrame(doc.get("dados", []))
        if df.empty:
            return jsonify({"kpi": kpi, "valor_total": 0, "detalhes": []}), 200

        mapeamento = obter_colunas_mapeadas(user_id)
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)

        df = converter_datas(df, col_data)
        atual, _ = filtrar_periodo(df, col_data, periodo)

        if atual.empty:
            return jsonify({"kpi": kpi, "valor_total": 0, "detalhes": []}), 200

        if kpi == 'faturamento':
            coluna = obter_coluna_indicador(atual, 'faturamento', mapeamento, COL_FATURAMENTO)
        elif kpi == 'despesa':
            coluna = obter_coluna_indicador(atual, 'despesa', mapeamento, COL_DESPESA)
        else:
            coluna = obter_coluna_indicador(atual, 'lucro', mapeamento, COL_LUCRO)

        quantidade_col = encontrar_coluna_quantidade(atual, mapeamento)
        produto_col = encontrar_coluna_produto(atual, mapeamento)
        categoria_col = encontrar_coluna_categoria(atual, mapeamento)

        if quantidade_col and quantidade_col in atual.columns:
            atual['_qtd'] = pd.to_numeric(atual[quantidade_col], errors='coerce').fillna(0)
        else:
            atual['_qtd'] = 1

        if kpi == 'lucro' and not coluna:
            fat_col = obter_coluna_indicador(atual, 'faturamento', mapeamento, COL_FATURAMENTO)
            desp_col = obter_coluna_indicador(atual, 'despesa', mapeamento, COL_DESPESA)
            if fat_col and desp_col:
                atual['_valor'] = pd.to_numeric(atual[fat_col], errors='coerce').fillna(0) - pd.to_numeric(atual[desp_col], errors='coerce').fillna(0)
            else:
                atual['_valor'] = 0
        elif coluna:
            atual['_valor'] = pd.to_numeric(atual[coluna], errors='coerce').fillna(0)
        else:
            atual['_valor'] = 0

        valor_total = float(atual['_valor'].sum())
        quantidade_total = float(atual['_qtd'].sum())

        detalhes = []
        label_col = produto_col or categoria_col
        label_tipo = 'Produto' if produto_col else 'Categoria' if categoria_col else None

        if label_col and label_col in atual.columns:
            agrupado = atual.groupby(label_col).agg(valor=('_valor', 'sum'), quantidade=('_qtd', 'sum'))
            agrupado = agrupado.sort_values(by='valor', ascending=False)
            detalhes = [
                {"nome": str(nome), "valor": float(linha['valor']), "quantidade": float(linha['quantidade'])}
                for nome, linha in agrupado.iterrows()
            ]
        else:
            for idx, row in atual.iterrows():
                label = None
                if col_data and col_data in row and pd.notna(row[col_data]):
                    label = str(row[col_data].date()) if hasattr(row[col_data], 'date') else str(row[col_data])
                if not label:
                    label = f"Linha {idx + 1}"
                detalhes.append({
                    "nome": label,
                    "valor": float(row.get('_valor', 0) or 0),
                    "quantidade": float(row.get('_qtd', 0) or 0)
                })
            detalhes = sorted(detalhes, key=lambda x: x['quantidade'] if quantidade_col else x['valor'], reverse=True)

        if valor_total:
            for detalhe in detalhes:
                detalhe['porcentagem'] = round((detalhe['valor'] / valor_total) * 100, 1)
        else:
            for detalhe in detalhes:
                detalhe['porcentagem'] = 0.0

        top_valor = None
        bottom_valor = None
        top_quantidade = None
        bottom_quantidade = None

        if detalhes:
            ordenado_valor = sorted(detalhes, key=lambda x: x.get('valor', 0), reverse=True)
            top_valor = ordenado_valor[0]
            bottom_valor = ordenado_valor[-1]

            if quantidade_col:
                ordenado_qtd = sorted(detalhes, key=lambda x: x.get('quantidade', 0), reverse=True)
                top_quantidade = ordenado_qtd[0]
                bottom_quantidade = ordenado_qtd[-1]

        return jsonify({
            "kpi": kpi,
            "valor_total": round(valor_total, 2),
            "quantidade_total": round(quantidade_total, 2) if quantidade_col else None,
            "unidade_quantidade": quantidade_col,
            "label_coluna": label_col,
            "tipo_label": label_tipo,
            "top_valor": top_valor,
            "bottom_valor": bottom_valor,
            "top_quantidade": top_quantidade,
            "bottom_quantidade": bottom_quantidade,
            "detalhes": detalhes
        }), 200

    except Exception as e:
        print("Erro ao obter detalhes do KPI:", e)
        return jsonify({"mensagem": str(e)}), 500

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
    if df.empty:
        return df.copy()
    fim = df[col].max()

    dias = {"7_dias": 7, "30_dias": 30, "90_dias": 90}
    if periodo in dias:
        inicio = fim - timedelta(days=dias[periodo])
        return df.loc[(df[col] >= inicio) & (df[col] <= fim)].copy()
    elif periodo == "ano_atual":
        inicio = datetime(fim.year, 1, 1)
        return df.loc[(df[col] >= inicio) & (df[col] <= fim)].copy()
    elif periodo.startswith("mes_"):
        try:
            mes = int(periodo.split("_")[1])
            ano = fim.year
            return df.loc[(df[col].dt.month == mes) & (df[col].dt.year == ano)].copy()
        except Exception:
            pass

    return filtrar_df(df, col, "30_dias")


def grafico_linha(df, col, periodo, mapeamento):
    df = filtrar_df(df, col, periodo)
    if df.empty:
        return empty_graph()

    df["data_str"] = df[col].dt.strftime("%d/%m")
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
