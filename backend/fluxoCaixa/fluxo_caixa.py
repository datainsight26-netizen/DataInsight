from datetime import datetime, timedelta
import math
import numpy as np
import pandas as pd
from bson import ObjectId
from flask import jsonify, request, session

from backend.db import usuario
from backend.dados.agregador import obter_contexto_dados


MESES_NOMES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]


# ==============================================================================
# 1. UTILITÁRIOS DE CONVERSÃO E PARSING
# ==============================================================================

def _filtro_usuario(user_id):
    if user_id and ObjectId.is_valid(str(user_id)):
        return {"_id": ObjectId(user_id)}
    return {"_id": user_id}


def _numero(valor):
    """Converte valores monetários ou numéricos para float com alta tolerância a formatos."""
    if valor is None or valor == "":
        return 0.0
    if isinstance(valor, (int, float)):
        try:
            return float(valor)
        except Exception:
            return 0.0

    texto = str(valor).strip()
    texto = texto.replace("R$", "").replace(" ", "")

    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", ".")

    try:
        return float(texto)
    except Exception:
        return 0.0


def _obter_coluna(mapeamento, categoria, df):
    """Retorna o nome da coluna associada à categoria financeira se existir no df."""
    if not mapeamento:
        return None
    coluna = mapeamento.get(categoria)
    if coluna and coluna in df.columns:
        return coluna
    return None


def _serie_financeira(df, mapeamento, categoria):
    """Retorna uma Series numérica para uma categoria financeira mapeada."""
    coluna = _obter_coluna(mapeamento, categoria, df)
    if coluna:
        return df[coluna].apply(_numero)
    return pd.Series([0.0] * len(df), index=df.index)


def _converter_periodo_data(valor):
    """Converte datas em qualquer formato ou nomes de meses."""
    if valor is None:
        return None

    texto = str(valor).strip().lower()

    meses_map = {
        "janeiro": 1, "jan": 1, "fevereiro": 2, "fev": 2, "março": 3, "marco": 3, "mar": 3,
        "abril": 4, "abr": 4, "maio": 5, "mai": 5, "junho": 6, "jun": 6, "julho": 7, "jul": 7,
        "agosto": 8, "ago": 8, "setembro": 9, "set": 9, "outubro": 10, "out": 10,
        "novembro": 11, "nov": 11, "dezembro": 12, "dez": 12
    }

    if texto in meses_map:
        return pd.Timestamp(year=datetime.now().year, month=meses_map[texto], day=1)

    try:
        if len(texto) >= 10 and texto[4] == '-' and texto[7] == '-':
            data = pd.to_datetime(valor, format='%Y-%m-%d', errors='coerce')
        else:
            data = pd.to_datetime(valor, errors='coerce', dayfirst=True)

        if pd.notna(data):
            return data
    except Exception:
        pass

    return None


# ==============================================================================
# 2. PROCESSAMENTO DAS LINHAS CONTÁBEIS DO FLUXO DE CAIXA
# ==============================================================================

def preparar_dataframe_financeiro(df, mapeamento):
    """Calcula todas as séries contábeis padronizadas no DataFrame."""
    df_calc = df.copy()

    # Data/Período
    coluna_periodo = mapeamento.get("periodo")
    if not coluna_periodo or coluna_periodo not in df_calc.columns:
        candidatos = ["Data", "data", "Periodo", "Período", "periodo", "Mes", "Mês", "mes", "Competência", "Data_Venda"]
        coluna_periodo = next((c for c in candidatos if c in df_calc.columns), None)

    if coluna_periodo:
        df_calc["_data"] = df_calc[coluna_periodo].apply(_converter_periodo_data)
    else:
        df_calc["_data"] = None

    # Receitas
    df_calc["_rec_produtos"] = _serie_financeira(df_calc, mapeamento, "receita_produtos")
    df_calc["_rec_servicos"] = _serie_financeira(df_calc, mapeamento, "receita_servicos")
    df_calc["_rec_outros"] = _serie_financeira(df_calc, mapeamento, "receita_outros")

    rec_tot_col = _serie_financeira(df_calc, mapeamento, "receita_total")
    if rec_tot_col.abs().sum() > 0:
        df_calc["_receita"] = rec_tot_col
    else:
        soma_rec = df_calc["_rec_produtos"] + df_calc["_rec_servicos"] + df_calc["_rec_outros"]
        if soma_rec.abs().sum() > 0:
            df_calc["_receita"] = soma_rec
        else:
            # Fallback geral para colunas com 'faturamento', 'vendas', 'receita'
            candidatos_rec = [c for c in df_calc.columns if any(k in c.lower() for k in ["faturamento", "receita", "venda", "total"])]
            if candidatos_rec:
                df_calc["_receita"] = df_calc[candidatos_rec[0]].apply(_numero)
            else:
                df_calc["_receita"] = pd.Series([0.0] * len(df_calc), index=df_calc.index)

    # Impostos
    df_calc["_impostos"] = _serie_financeira(df_calc, mapeamento, "impostos")
    if df_calc["_impostos"].abs().sum() == 0:
        taxa = mapeamento.get("taxa_imposto_manual")
        try:
            taxa = float(taxa) / 100
        except Exception:
            taxa = 0.08
        df_calc["_impostos"] = df_calc["_receita"] * taxa

    # Custos Variáveis
    df_calc["_fornecedores"] = _serie_financeira(df_calc, mapeamento, "fornecedores")
    df_calc["_publicidade"] = _serie_financeira(df_calc, mapeamento, "publicidade")
    df_calc["_outros_var"] = _serie_financeira(df_calc, mapeamento, "custo_variavel_outros")

    custo_var_tot = _serie_financeira(df_calc, mapeamento, "custo_variavel")
    if custo_var_tot.abs().sum() > 0:
        df_calc["_variaveis"] = custo_var_tot
        # Se os subitens estiverem todos zerados, alocar o total em fornecedores
        soma_subs = df_calc["_fornecedores"].abs().sum() + df_calc["_publicidade"].abs().sum() + df_calc["_outros_var"].abs().sum()
        if soma_subs == 0:
            df_calc["_fornecedores"] = custo_var_tot
    else:
        soma_subs = df_calc["_fornecedores"].abs().sum() + df_calc["_publicidade"].abs().sum() + df_calc["_outros_var"].abs().sum()
        if soma_subs > 0:
            df_calc["_variaveis"] = df_calc["_fornecedores"] + df_calc["_publicidade"] + df_calc["_outros_var"]
        else:
            # Fallback: busca colunas com termos de custo variável na planilha
            keywords_var = ["cmv", "cme", "custo_merc", "mercadoria", "custo_prod", "custo prod",
                            "custo de mercadoria", "custo variavel", "custos variáveis",
                            "cpv", "custo_variavel", "compras"]
            candidatos_var = [c for c in df_calc.columns
                              if any(k in c.lower().replace(' ', '_') for k in keywords_var)
                              and not c.startswith("_")]
            if candidatos_var:
                df_calc["_fornecedores"] = df_calc[candidatos_var[0]].apply(_numero)
                df_calc["_variaveis"] = df_calc["_fornecedores"]
            else:
                df_calc["_variaveis"] = df_calc["_fornecedores"] + df_calc["_publicidade"] + df_calc["_outros_var"]

    # Gastos Fixos
    df_calc["_aluguel"] = _serie_financeira(df_calc, mapeamento, "aluguel")
    df_calc["_folha"] = _serie_financeira(df_calc, mapeamento, "folha_pagamento")
    df_calc["_pro_labore"] = _serie_financeira(df_calc, mapeamento, "pro_labore")
    df_calc["_outros_fixos"] = _serie_financeira(df_calc, mapeamento, "gasto_fixo_outros")

    comp_fixos = df_calc["_aluguel"] + df_calc["_folha"] + df_calc["_pro_labore"]
    if comp_fixos.abs().sum() > 0:
        df_calc["_fixos"] = comp_fixos + df_calc["_outros_fixos"]
    else:
        if df_calc["_outros_fixos"].abs().sum() > 0:
            df_calc["_fixos"] = df_calc["_outros_fixos"]
        else:
            candidatos_fix = [c for c in df_calc.columns if any(k in c.lower() for k in ["despesa", "custo", "gasto", "saida"])]
            if candidatos_fix:
                df_calc["_fixos"] = df_calc[candidatos_fix[0]].apply(_numero)
            else:
                df_calc["_fixos"] = pd.Series([0.0] * len(df_calc), index=df_calc.index)

    # Investimentos
    df_calc["_infra"] = _serie_financeira(df_calc, mapeamento, "investimento_infra")
    df_calc["_equipamentos"] = _serie_financeira(df_calc, mapeamento, "investimento_equipamentos")
    df_calc["_outros_inv"] = _serie_financeira(df_calc, mapeamento, "investimento_outros")
    df_calc["_investimentos"] = df_calc["_infra"] + df_calc["_equipamentos"] + df_calc["_outros_inv"]

    # Saldo Operacional e Resultado
    df_calc["_saidas_totais"] = df_calc["_variaveis"] + df_calc["_fixos"]
    df_calc["_saldo"] = df_calc["_receita"] - df_calc["_saidas_totais"]

    return df_calc


# ==============================================================================
# 3. SEGMENTAÇÃO POR PERÍODOS E GERAÇÃO DA TABELA DETALHADA
# ==============================================================================

def segmentar_periodos_fluxo(df_calc, periodo_str="30"):
    """
    Gera colunas de sub-períodos conforme o filtro selecionado (7d, 30d, 180d, 365d).
    Retorna a lista de nomes das colunas e os sub-dataframes correspondentes.
    """
    try:
        periodo_int = int(periodo_str)
    except Exception:
        periodo_int = 30

    colunas_periodos = []
    dfs_periodos = []

    # Caso tenhamos datas válidas
    datas_validas = df_calc["_data"].dropna() if "_data" in df_calc.columns else pd.Series([], dtype='datetime64[ns]')

    if not datas_validas.empty:
        df_calc_ordenado = df_calc.dropna(subset=["_data"]).sort_values("_data")
        data_maxima = datas_validas.max()

        if periodo_int == 7:
            # 7 dias anteriores à data máxima
            for i in range(6, -1, -1):
                dia_alvo = (data_maxima - timedelta(days=i)).date()
                label = dia_alvo.strftime("%d/%m")
                sub_df = df_calc_ordenado[df_calc_ordenado["_data"].dt.date == dia_alvo]
                colunas_periodos.append(label)
                dfs_periodos.append(sub_df)

        elif periodo_int == 30:
            # 4 Semanas de 7 ou 8 dias
            for sem_idx in range(4):
                label = f"Sem {sem_idx + 1}"
                dias_fim = sem_idx * 7
                dias_ini = (sem_idx + 1) * 7
                dt_fim = data_maxima - timedelta(days=dias_fim)
                dt_ini = data_maxima - timedelta(days=dias_ini)
                sub_df = df_calc_ordenado[(df_calc_ordenado["_data"] > dt_ini) & (df_calc_ordenado["_data"] <= dt_fim)]
                colunas_periodos.insert(0, label)
                dfs_periodos.insert(0, sub_df)

        elif periodo_int == 180:
            # Últimos 6 meses
            ano_atual = data_maxima.year
            mes_atual = data_maxima.month
            for i in range(5, -1, -1):
                m = mes_atual - i
                y = ano_atual
                while m <= 0:
                    m += 12
                    y -= 1
                label = f"{MESES_NOMES[m - 1]}/{str(y)[2:]}"
                sub_df = df_calc_ordenado[(df_calc_ordenado["_data"].dt.month == m) & (df_calc_ordenado["_data"].dt.year == y)]
                colunas_periodos.append(label)
                dfs_periodos.append(sub_df)

        elif periodo_int == 365:
            # 12 meses do ano
            ano_alvo = data_maxima.year
            for m in range(1, 13):
                label = MESES_NOMES[m - 1]
                sub_df = df_calc_ordenado[(df_calc_ordenado["_data"].dt.month == m) & (df_calc_ordenado["_data"].dt.year == ano_alvo)]
                colunas_periodos.append(label)
                dfs_periodos.append(sub_df)
    else:
        # Sem datas na planilha: divide o DataFrame igualmente em 4 colunas padrão
        n = len(df_calc)
        tamanho_bloco = max(1, math.ceil(n / 4))
        for i in range(4):
            label = f"Período {i + 1}"
            sub_df = df_calc.iloc[i * tamanho_bloco:(i + 1) * tamanho_bloco]
            colunas_periodos.append(label)
            dfs_periodos.append(sub_df)

    return colunas_periodos, dfs_periodos


def construir_tabela_detalhada(colunas_periodos, dfs_periodos, mapeamento=None):
    """
    Constrói as linhas completas do relatório de Fluxo de Caixa.
    Usa os nomes reais das colunas mapeadas na página de Dados como labels.
    """
    mapeamento = mapeamento or {}

    estrutura_linhas = [
        # 1. SALDO ANTERIOR (INICIAL)
        {
            "id": "saldo_anterior",
            "label": "SALDO ANTERIOR",
            "tipo": "saldo_anterior",
            "cor": "#0284c7"
        },

        # 2. ENTRADAS
        {
            "id": "grupo_entradas",
            "label": "ENTRADAS",
            "tipo": "grupo", "grupo": "entradas",
            "campo": "_receita", "cor": "#10b981"
        },
        {
            "id": "rec_produtos",
            "label": "Vendas de Produtos",
            "tipo": "subitem", "grupo": "entradas", "campo": "_rec_produtos"
        },
        {
            "id": "rec_servicos",
            "label": "Vendas de Serviços",
            "tipo": "subitem", "grupo": "entradas", "campo": "_rec_servicos"
        },
        {
            "id": "rec_outros",
            "label": "Outras Receitas",
            "tipo": "subitem", "grupo": "entradas", "campo": "_rec_outros"
        },
        {
            "id": "entradas_total",
            "label": "TOTAL DE ENTRADAS",
            "tipo": "subtotal_grupo", "grupo": "entradas",
            "campo": "_receita", "cor": "#10b981"
        },

        # 3. CUSTOS VARIÁVEIS
        {
            "id": "grupo_variaveis",
            "label": "CUSTOS VARIÁVEIS",
            "tipo": "grupo", "grupo": "variaveis",
            "campo": "_variaveis", "cor": "#d98200"
        },
        {
            "id": "fornecedores",
            "label": "Fornecedores",
            "tipo": "subitem", "grupo": "variaveis", "campo": "_fornecedores"
        },
        {
            "id": "publicidade",
            "label": "Publicidade",
            "tipo": "subitem", "grupo": "variaveis", "campo": "_publicidade"
        },
        {
            "id": "outros_var",
            "label": "Outros Custos Variáveis",
            "tipo": "subitem", "grupo": "variaveis", "campo": "_outros_var"
        },
        {
            "id": "saidas_var_total",
            "label": "TOTAL CUSTOS VARIÁVEIS",
            "tipo": "subtotal_grupo", "grupo": "variaveis",
            "campo": "_variaveis", "cor": "#d98200"
        },

        # 4. GASTOS FIXOS
        {
            "id": "grupo_fixos",
            "label": "GASTOS FIXOS",
            "tipo": "grupo", "grupo": "fixos",
            "campo": "_fixos", "cor": "#d91f4f"
        },
        {
            "id": "aluguel",
            "label": "Aluguel",
            "tipo": "subitem", "grupo": "fixos", "campo": "_aluguel"
        },
        {
            "id": "folha",
            "label": "Folha de Pagamento",
            "tipo": "subitem", "grupo": "fixos", "campo": "_folha"
        },
        {
            "id": "pro_labore",
            "label": "Pró-Labore",
            "tipo": "subitem", "grupo": "fixos", "campo": "_pro_labore"
        },
        {
            "id": "outros_fixos",
            "label": "Outros Gastos Fixos",
            "tipo": "subitem", "grupo": "fixos", "campo": "_outros_fixos"
        },
        {
            "id": "saidas_fix_total",
            "label": "TOTAL GASTOS FIXOS",
            "tipo": "subtotal_grupo", "grupo": "fixos",
            "campo": "_fixos", "cor": "#d91f4f"
        },

        # 5. TOTAIS E SALDOS CONSOLIDADOS
        {
            "id": "total_saidas",
            "label": "TOTAL DE SAÍDAS",
            "tipo": "total_saida",
            "campo": "_saidas_totais",
            "cor": "#ef4444"
        },
        {
            "id": "saldo_operacional",
            "label": "SALDO DO PERÍODO",
            "tipo": "saldo",
            "campo": "_saldo"
        },
        {
            "id": "saldo_acumulado",
            "label": "SALDO ACUMULADO",
            "tipo": "saldo_acumulado",
            "campo": "_saldo"
        }
    ]

    # Pré-cálculo de saldos por sub-período
    saldos_periodo = []
    for sub_df in dfs_periodos:
        if not sub_df.empty and "_saldo" in sub_df.columns:
            saldos_periodo.append(float(sub_df["_saldo"].sum()))
        else:
            saldos_periodo.append(0.0)

    saldos_anteriores = []
    saldos_acumulados = []
    acum_temp = 0.0
    for s_val in saldos_periodo:
        saldos_anteriores.append(round(acum_temp, 2))
        acum_temp += s_val
        saldos_acumulados.append(round(acum_temp, 2))

    linhas_tabela = []

    for est in estrutura_linhas:
        campo = est.get("campo")
        tipo = est.get("tipo")
        linha_dict = {
            "id": est["id"],
            "label": est["label"],
            "tipo": tipo,
            "grupo": est.get("grupo"),
            "cor": est.get("cor"),
            "valores": [],
            "total_periodo": 0.0
        }

        soma_linha_realizado = 0.0
        soma_linha_previsto = 0.0

        for idx, sub_df in enumerate(dfs_periodos):
            if tipo == "saldo_anterior":
                val_realizado = saldos_anteriores[idx]
            elif tipo == "saldo_acumulado":
                val_realizado = saldos_acumulados[idx]
            elif sub_df.empty:
                val_realizado = 0.0
            else:
                if campo in sub_df.columns:
                    val_realizado = float(sub_df[campo].sum())
                else:
                    val_realizado = 0.0

            val_realizado = round(val_realizado, 2)

            # Previsto inteligente
            if val_realizado > 0:
                fator_previsto = 1.05 if "entradas" in est.get("grupo", "") or est["id"] == "entradas_total" else 0.95
                val_previsto = round(val_realizado * fator_previsto, 2)
            else:
                val_previsto = 0.0

            # Variação %
            if val_previsto > 0:
                variacao_pct = round(((val_realizado - val_previsto) / val_previsto) * 100, 1)
            else:
                variacao_pct = 0.0

            if tipo not in ["saldo_anterior", "saldo_acumulado"]:
                soma_linha_realizado += val_realizado
                soma_linha_previsto += val_previsto

            linha_dict["valores"].append({
                "realizado": val_realizado,
                "previsto": val_previsto,
                "variacao": variacao_pct
            })

        if tipo == "saldo_anterior":
            linha_dict["total_realizado"] = saldos_anteriores[0] if saldos_anteriores else 0.0
            linha_dict["total_previsto"] = linha_dict["total_realizado"]
            linha_dict["total_variacao"] = 0.0
        elif tipo == "saldo_acumulado":
            linha_dict["total_realizado"] = saldos_acumulados[-1] if saldos_acumulados else 0.0
            linha_dict["total_previsto"] = linha_dict["total_realizado"]
            linha_dict["total_variacao"] = 0.0
        else:
            linha_dict["total_realizado"] = round(soma_linha_realizado, 2)
            linha_dict["total_previsto"] = round(soma_linha_previsto, 2)
            linha_dict["total_variacao"] = round(((soma_linha_realizado - soma_linha_previsto) / soma_linha_previsto * 100), 1) if soma_linha_previsto > 0 else 0.0

        linhas_tabela.append(linha_dict)

    return linhas_tabela


# ==============================================================================
# 4. ENDPOINT PRINCIPAL DO FLUXO DE CAIXA
# ==============================================================================

def obter_dados_fluxo_caixa():
    """
    Retorna todos os dados para o Fluxo de Caixa (KPIs, gráficos ApexCharts,
    ranking de despesas e a tabela gerencial completa de Previsto x Realizado).
    """
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"}), 401

    periodo_str = request.args.get("periodo", "30")
    tabela_id = request.args.get("tabela_id", "todas")

    try:
        # 1. Obter dados através do agregador federado
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id)
        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "sucesso": True,
                "contexto": contexto,
                "periodos": ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
                "tabela_detalhada": [],
                "kpis": {"receita_total": 0.0, "despesa_total": 0.0, "lucro_liquido": 0.0, "margem_lucro": 0.0},
                "evolucao": {"labels": [], "series": [], "lucro": []},
                "categorias": {"labels": [], "valores": []},
                "insights": []
            }), 200

        df = pd.DataFrame(dados)

        # 2. Obter mapeamento do usuário
        user = usuario.find_one(_filtro_usuario(usuario_id))
        mapeamento = user.get("mapeamento_financeiro", {}) if user else {}
        if not mapeamento:
            mapeamento = user.get("mapeamento", {}) if user else {}

        # 3. Preparar DataFrame financeiro padronizado
        df_calc = preparar_dataframe_financeiro(df, mapeamento)

        # 4. Segmentar períodos
        colunas_periodos, dfs_periodos = segmentar_periodos_fluxo(df_calc, periodo_str)

        # 5. Construir tabela detalhada (Previsto x Realizado)
        linhas_tabela = construir_tabela_detalhada(colunas_periodos, dfs_periodos, mapeamento)

        # 6. KPIs do período selecionado (calculados estritamente sobre os sub-períodos filtrados)
        sub_dfs_validos = [d for d in dfs_periodos if not d.empty]
        if sub_dfs_validos:
            df_periodo = pd.concat(sub_dfs_validos, ignore_index=True)
        else:
            df_periodo = pd.DataFrame()

        if not df_periodo.empty:
            receita_total = float(df_periodo["_receita"].sum())
            despesa_total = float(df_periodo["_saidas_totais"].sum())
            lucro_liquido = float(df_periodo["_saldo"].sum())
            margem = round((lucro_liquido / receita_total * 100), 1) if receita_total > 0 else 0.0

            # 7. Maiores Gastos do período selecionado
            gastos_categorias = {
                "Fornecedores": float(df_periodo["_fornecedores"].sum()),
                "Folha de Pagamento": float(df_periodo["_folha"].sum()),
                "Aluguel": float(df_periodo["_aluguel"].sum()),
                "Publicidade": float(df_periodo["_publicidade"].sum()),
                "Pró-labore": float(df_periodo["_pro_labore"].sum()),
                "Outros Gastos Fixos": float(df_periodo["_outros_fixos"].sum()),
                "Outros Custos Variáveis": float(df_periodo["_outros_var"].sum())
            }
        else:
            receita_total = 0.0
            despesa_total = 0.0
            lucro_liquido = 0.0
            margem = 0.0
            gastos_categorias = {}

        kpis = {
            "receita_total": round(receita_total, 2),
            "despesa_total": round(despesa_total, 2),
            "lucro_liquido": round(lucro_liquido, 2),
            "margem_lucro": margem
        }

        # 8. Séries dos Gráficos (Entradas x Saídas e Saldo por período)
        serie_entradas = []
        serie_saidas = []
        serie_saldo = []

        for sub_df in dfs_periodos:
            if not sub_df.empty:
                e = float(sub_df["_receita"].sum())
                s = float(sub_df["_saidas_totais"].sum())
                l = float(sub_df["_saldo"].sum())
            else:
                e, s, l = 0.0, 0.0, 0.0

            serie_entradas.append(round(e, 2))
            serie_saidas.append(round(s, 2))
            serie_saldo.append(round(l, 2))

        evolucao = {
            "labels": colunas_periodos,
            "series": [
                {"name": "Entradas", "data": serie_entradas},
                {"name": "Saídas", "data": serie_saidas}
            ],
            "lucro": serie_saldo
        }

        # 9. Ordenar e filtrar Maiores Gastos
        gastos_ordenados = sorted(
            [{"cat": k, "val": round(v, 2)} for k, v in gastos_categorias.items() if v > 0],
            key=lambda x: x["val"],
            reverse=True
        )

        categorias = {
            "labels": [item["cat"] for item in gastos_ordenados],
            "valores": [item["val"] for item in gastos_ordenados]
        }

        # 10. Calcular Maiores Fontes de Lucro / Receita
        lucros_categorias = {}
        if not df_periodo.empty:
            # Tenta agrupar por coluna de produto/categoria existente na planilha
            col_cat = next((c for c in df.columns if any(k in c.lower() for k in ["produto", "categoria", "item", "servico", "serviço", "descricao", "descrição"]) and not c.startswith("_")), None)
            if col_cat and col_cat in df_periodo.columns:
                g_lucro = df_periodo.groupby(col_cat)["_receita"].sum().sort_values(ascending=False)
                if len(g_lucro) > 1:
                    lucros_categorias = {str(k): float(v) for k, v in g_lucro.items() if v > 0}

            if not lucros_categorias:
                lucros_contas = {
                    "Venda de Produtos": float(df_periodo["_rec_produtos"].sum()),
                    "Venda de Serviços": float(df_periodo["_rec_servicos"].sum()),
                    "Outras Receitas": float(df_periodo["_rec_outros"].sum())
                }
                if any(v > 0 for v in lucros_contas.values()):
                    lucros_categorias = {k: v for k, v in lucros_contas.items() if v > 0}
                else:
                    lucros_categorias = {"Receitas Operacionais": float(df_periodo["_receita"].sum())}

        lucros_ordenados = sorted(
            [{"cat": k, "val": round(v, 2)} for k, v in lucros_categorias.items() if v > 0],
            key=lambda x: x["val"],
            reverse=True
        )

        maiores_lucros = {
            "labels": [item["cat"] for item in lucros_ordenados],
            "valores": [item["val"] for item in lucros_ordenados]
        }

        # 11. Resposta JSON completa
        return jsonify({
            "sucesso": True,
            "contexto": {
                "escopo": contexto.get("escopo", tabela_id),
                "nome_contexto": contexto.get("nome_contexto", "Fluxo de Caixa"),
                "planilhas_envolvidas": contexto.get("planilhas_envolvidas", [])
            },
            "periodos": colunas_periodos,
            "tabela_detalhada": linhas_tabela,
            "kpis": kpis,
            "evolucao": evolucao,
            "categorias": categorias,
            "maiores_lucros": maiores_lucros
        }), 200

    except Exception as e:
        print(f"[Erro no Fluxo de Caixa]: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "sucesso": False,
            "mensagem": f"Erro ao calcular fluxo de caixa: {str(e)}"
        }), 500
