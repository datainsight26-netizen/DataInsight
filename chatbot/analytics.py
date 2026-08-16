from datetime import datetime
from typing import Optional
import numpy as np
import pandas as pd
from flask import session

from backend.home.home import (
    COL_CATEGORIA,
    COL_DESPESA,
    COL_FATURAMENTO,
    COL_LUCRO,
    calcular_desempenho,
    calcular_total_dinamico,
    converter_datas,
    encontrar_coluna_data,
    obter_colunas_mapeadas,
)
from backend.db import dados_colecao


def obter_resumo_financeiro(periodo: str = "30_dias", **kwargs) -> str:
    periodo = kwargs.get("periodo", periodo)
    try:
        resposta, status = calcular_desempenho(periodo)
        if status != 200:
            return "Não foi possível recuperar os dados financeiros no momento."

        dados = resposta.get_json() if hasattr(resposta, "get_json") else resposta
        if not dados or "faturamento" not in dados:
            return "Dados financeiros insuficientes ou inexistentes."

        fat = dados["faturamento"]
        luc = dados["lucro"]
        desp = dados["despesa"]
        cres = dados["crescimento"]

        return (
            f"Resumo do período ({periodo}):\n"
            f"- Faturamento: R$ {fat.get('valor', 0):,.2f} ({fat.get('percentual', 0)}%)\n"
            f"- Lucro: R$ {luc.get('valor', 0):,.2f} ({luc.get('percentual', 0)}%)\n"
            f"- Despesas: R$ {desp.get('valor', 0):,.2f} ({desp.get('percentual', 0)}%)\n"
            f"- Crescimento: {cres.get('valor', 0)}%"
        )
    except Exception as err:
        return f"Erro ao processar resumo financeiro: {err}"


def obter_transacoes_recentes(limite: int = 5, **kwargs) -> str:
    limite = kwargs.get("limite", limite)
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado financeiro encontrado."

        df = pd.DataFrame(documento["dados"])
        recentes = df.tail(limite).to_string(index=False)
        return f"Últimos registros encontrados:\n{recentes}"
    except Exception as err:
        return f"Erro ao buscar transações: {err}"


def prever_receita_mes_seguinte(**kwargs) -> str:
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Dados insuficientes para realizar a previsão."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        if not col_data:
            return "Coluna de data não identificada no histórico de dados."

        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df["mes_ano"] = df[col_data].dt.to_period("M")

        mensal = (
            df.groupby("mes_ano")
            .apply(lambda g: calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO))
            .reset_index(name="faturamento")
        )

        if len(mensal) < 2:
            return "Mínimo de 2 meses de dados históricos necessários para gerar uma previsão confiável."

        y = mensal["faturamento"].values
        x = np.arange(len(y))
        coef = np.polyfit(x, y, 1)
        poly = np.poly1d(coef)
        previsao = poly(len(y))
        tendencia = "crescimento" if coef[0] > 0 else "queda"

        return (
            f"Previsão Matemática para o próximo mês: R$ {previsao:,.2f}.\n"
            f"Tendência identificada: {tendencia}."
        )
    except Exception as err:
        return f"Erro na previsão de receita: {err}"


def detectar_anomalias_despesas(**kwargs) -> str:
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado para analisar anomalias."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        if not col_data:
            return "Coluna de data não identificada."

        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df["mes_ano"] = df[col_data].dt.to_period("M")

        mensal = (
            df.groupby("mes_ano")
            .apply(lambda g: calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA))
            .reset_index(name="despesa")
        )

        if len(mensal) < 2:
            return "Histórico insuficiente para cálculo de anomalias."

        media_historica = mensal["despesa"][:-1].mean()
        ultimo_mes = mensal["despesa"].iloc[-1]

        if media_historica > 0 and ultimo_mes > (media_historica * 1.3):
            percentual = ((ultimo_mes / media_historica) - 1) * 100
            return (
                f"⚠️ ANOMALIA DETECTADA: As despesas do último mês (R$ {ultimo_mes:,.2f}) estão "
                f"{percentual:.1f}% acima da média histórica (R$ {media_historica:,.2f})."
            )

        return (
            f"As despesas recentes (R$ {ultimo_mes:,.2f}) mantêm-se dentro do padrão normal "
            f"(Média histórica: R$ {media_historica:,.2f})."
        )
    except Exception as err:
        return f"Erro na análise de anomalias: {err}"


def calcular_ponto_equilibrio(**kwargs) -> str:
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Dados inexistentes."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)

        fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
        desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)

        if fat_total <= 0:
            return "Faturamento nulo ou insuficiente para cálculo do ponto de equilíbrio."

        lucro = fat_total - desp_total
        margem = lucro / fat_total

        if margem <= 0:
            return (
                "A margem de lucro histórica é negativa/nula. "
                "O ponto de equilíbrio é inatingível na estrutura atual."
            )

        pe = desp_total / margem
        return (
            f"Ponto de Equilíbrio Estimado: É necessário faturar ~R$ {pe:,.2f} "
            f"para cobrir os custos totais (Margem histórica: {margem * 100:.1f}%)."
        )
    except Exception as err:
        return f"Erro no cálculo do Ponto de Equilíbrio: {err}"
