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

        def _fmt_pct(p):
            if p is None:
                return "Sem base comparável"
            return f"{p:+.1f}%" if isinstance(p, (int, float)) else f"{p}%"

        return (
            f"Resumo do período ({periodo}):\n"
            f"- Faturamento: R$ {fat.get('valor', 0):,.2f} ({_fmt_pct(fat.get('percentual'))})\n"
            f"- Lucro: R$ {luc.get('valor', 0):,.2f} ({_fmt_pct(luc.get('percentual'))})\n"
            f"- Despesas: R$ {desp.get('valor', 0):,.2f} ({_fmt_pct(desp.get('percentual'))})\n"
            f"- Crescimento: {_fmt_pct(cres.get('valor'))}"
        )
    except Exception as err:
        return f"Erro ao processar resumo financeiro: {err}"


def obter_transacoes_recentes(limite: int = 5, **kwargs) -> str:
    limite = kwargs.get("limite", limite)
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])
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
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])
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
            .apply(lambda g: calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO), include_groups=False)
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
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])
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
            .apply(lambda g: calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA), include_groups=False)
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


class PontoEquilibrioResultado(str):
    def __new__(cls, texto, pe=None, imc=None, mc=None, calculavel=True):
        obj = str.__new__(cls, texto)
        obj.pe = pe
        obj.valor = pe
        obj.imc = imc
        obj.mc = mc
        obj.calculavel = calculavel
        return obj

    def __float__(self):
        if self.pe is not None:
            return float(self.pe)
        raise ValueError(f"Ponto de equilíbrio incalculável: {self}")


def calcular_ponto_equilibrio(receita: float = None, impostos: float = None, custos_variaveis: float = None, gastos_fixos: float = None, **kwargs):
    rec = kwargs.get("receita", receita)
    if rec is None:
        rec = kwargs.get("faturamento")
    fix = kwargs.get("gastos_fixos", gastos_fixos)
    if fix is None:
        fix = kwargs.get("despesas_fixas") or kwargs.get("fixos")
    var = kwargs.get("custos_variaveis", custos_variaveis)
    if var is None:
        var = kwargs.get("variaveis")
    imp = kwargs.get("impostos", impostos)

    # Se parâmetros numéricos foram fornecidos diretamente (testes/chamadas programáticas)
    if rec is not None and fix is not None:
        try:
            fat_total = float(rec)
            fix_total = float(fix)
            var_total = float(var) if var is not None else 0.0
            imp_total = float(imp) if imp is not None else 0.0

            if fat_total <= 0:
                msg = "Faturamento nulo ou insuficiente para cálculo do ponto de equilíbrio."
                return PontoEquilibrioResultado(msg, pe=None, imc=0.0, mc=0.0, calculavel=False)

            mc = fat_total - imp_total - var_total
            imc = mc / fat_total

            if imc <= 0:
                msg = (
                    "A margem de contribuição é nula ou negativa. "
                    "O ponto de equilíbrio é incalculável na estrutura atual de custos."
                )
                return PontoEquilibrioResultado(msg, pe=None, imc=imc, mc=mc, calculavel=False)

            if fix_total == 0:
                pe = 0.0
            else:
                pe = fix_total / imc

            msg = (
                f"Ponto de Equilíbrio Estimado: É necessário faturar ~R$ {pe:,.2f} "
                f"para cobrir os gastos fixos (Índice de Margem de Contribuição: {imc * 100:.1f}%)."
            )
            return PontoEquilibrioResultado(msg, pe=pe, imc=imc, mc=mc, calculavel=True)
        except Exception as err:
            return PontoEquilibrioResultado(f"Erro no cálculo do Ponto de Equilíbrio: {err}", pe=None, calculavel=False)

    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Dados inexistentes."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)

        from backend.dados.classificacao_financeira import calcular_preview_financeiro
        prev = calcular_preview_financeiro(mapeamento, df)

        fat_total = prev.get("receita_total", 0.0)
        fix_total = prev.get("gastos_fixos", 0.0)
        var_total = prev.get("custo_variavel", 0.0)
        imp_total = prev.get("impostos", 0.0)

        if fat_total <= 0:
            msg = "Faturamento nulo ou insuficiente para cálculo do ponto de equilíbrio."
            return PontoEquilibrioResultado(msg, pe=None, imc=0.0, mc=0.0, calculavel=False)

        mc = fat_total - imp_total - var_total
        imc = mc / fat_total

        if imc <= 0:
            msg = (
                "A margem de contribuição histórica é nula ou negativa. "
                "O ponto de equilíbrio é incalculável na estrutura atual de custos."
            )
            return PontoEquilibrioResultado(msg, pe=None, imc=imc, mc=mc, calculavel=False)

        if fix_total == 0:
            pe = 0.0
        else:
            pe = fix_total / imc

        msg = (
            f"Ponto de Equilíbrio Estimado: É necessário faturar ~R$ {pe:,.2f} "
            f"para cobrir os custos fixos totais (Margem de contribuição: {imc * 100:.1f}%)."
        )
        return PontoEquilibrioResultado(msg, pe=pe, imc=imc, mc=mc, calculavel=True)
    except Exception as err:
        return f"Erro no cálculo do Ponto de Equilíbrio: {err}"
