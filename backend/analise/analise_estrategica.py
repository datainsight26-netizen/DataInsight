"""
backend/analise/analise_estrategica.py
DataInsight — Centro de Análise Estratégica, Saúde do Negócio, Alertas e Projeções
Federa dados de múltiplas planilhas e calcula cenários preditivos por regressão linear.
"""

from flask import session, jsonify, request
from backend.db import dados_colecao, usuario as usuarios_colecao
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from bson import ObjectId

from backend.analise.analise import (
    encontrar_coluna_data,
    filtrar_por_periodo,
    calcular_estrutura_contabil,
    calcular_metricas_mei,
    calcular_regressao_linear,
    projetar_valor,
    variacao_percentual,
    COL_FATURAMENTO,
    COL_DESPESA,
    COL_LUCRO
)


# ==============================================================================
# 1. SCORE MULTIFATORIAL DE SAÚDE DO NEGÓCIO (0 a 100)
# ==============================================================================
def calcular_saude_negocio(*args, **kwargs):
    """
    Calcula score contábil e operacional (0-100).
    Suporta tanto formato com dicionário de estrutura quanto assinatura numérica legada:
    (faturamento, despesas, lucro, margem, faturamento_anterior, lucro_anterior, series_faturamento, series_lucro)
    """
    if args and isinstance(args[0], dict):
        estrutura = args[0]
        cresc_fat = args[1] if len(args) > 1 else kwargs.get("cresc_fat")
        cresc_luc = args[2] if len(args) > 2 else kwargs.get("cresc_luc")
        is_mei = args[3] if len(args) > 3 else kwargs.get("is_mei", False)
        mei_data = args[4] if len(args) > 4 else kwargs.get("mei_data")
    elif args and isinstance(args[0], (int, float)):
        # Assinatura numérica legada
        fat = float(args[0])
        desp = float(args[1]) if len(args) > 1 else 0.0
        luc = float(args[2]) if len(args) > 2 else (fat - desp)
        mg = float(args[3]) if len(args) > 3 else ((luc / fat * 100) if fat > 0 else 0.0)
        fat_ant = float(args[4]) if len(args) > 4 and args[4] is not None else 0.0
        luc_ant = float(args[5]) if len(args) > 5 and args[5] is not None else 0.0

        cresc_fat = variacao_percentual(fat_ant, fat)
        cresc_luc = variacao_percentual(luc_ant, luc)
        is_mei = kwargs.get("is_mei", False)
        mei_data = kwargs.get("mei_data")

        estrutura = {
            "receita_bruta": fat,
            "despesas_totais": desp,
            "lucro_liquido": luc,
            "margem_liquida": mg,
            "indice_margem_contribuicao": 40.0,
            "ponto_equilibrio_status": "atingido" if luc >= 0 else "abaixo",
            "cobertura_custos_fixos": 1.5 if luc >= 0 else 0.8
        }
    else:
        estrutura = kwargs.get("estrutura", {})
        cresc_fat = kwargs.get("cresc_fat")
        cresc_luc = kwargs.get("cresc_luc")
        is_mei = kwargs.get("is_mei", False)
        mei_data = kwargs.get("mei_data")

    mg_liq = estrutura.get("margem_liquida", 0.0)
    imc = estrutura.get("indice_margem_contribuicao", 0.0)
    pe_status = estrutura.get("ponto_equilibrio_status", "atingido")
    cobertura = estrutura.get("cobertura_custos_fixos", 1.0)
    lucro = estrutura.get("lucro_liquido", 0.0)

    score = 0

    # Pilar 1: Rentabilidade Líquida (0 a 25 pts)
    if mg_liq >= 25.0:
        score_rent = 25
    elif mg_liq >= 18.0:
        score_rent = 21
    elif mg_liq >= 12.0:
        score_rent = 17
    elif mg_liq >= 5.0:
        score_rent = 12
    elif mg_liq > 0.0:
        score_rent = 7
    else:
        score_rent = 0
    score += score_rent

    # Pilar 2: Margem de Contribuição / Eficiência (0 a 25 pts)
    if imc >= 45.0:
        score_mc = 25
    elif imc >= 35.0:
        score_mc = 20
    elif imc >= 25.0:
        score_mc = 15
    elif imc >= 15.0:
        score_mc = 10
    else:
        score_mc = 5
    score += score_mc

    # Pilar 3: Crescimento e Tendência (0 a 20 pts)
    score_cresc = 10  # neutro padrão
    if cresc_fat is not None:
        if cresc_fat >= 15.0:
            score_cresc += 5
        elif cresc_fat >= 5.0:
            score_cresc += 3
        elif cresc_fat < -10.0:
            score_cresc -= 4
    if cresc_luc is not None:
        if cresc_luc >= 10.0:
            score_cresc += 5
        elif cresc_luc >= 0.0:
            score_cresc += 2
        elif cresc_luc < -15.0:
            score_cresc -= 4
    score_cresc = max(0, min(20, score_cresc))
    score += score_cresc

    # Pilar 4: Segurança Operacional (0 a 20 pts)
    if is_mei and mei_data:
        teto_pct = mei_data.get("percentual_teto", 0.0)
        if teto_pct < 65.0:
            score_seg = 20
        elif teto_pct < 80.0:
            score_seg = 15
        elif teto_pct <= 100.0:
            score_seg = 8
        else:
            score_seg = 2
    else:
        if pe_status == "atingido" and estrutura.get("margem_seguranca_operacional", 0) >= 20:
            score_seg = 20
        elif pe_status == "atingido":
            score_seg = 14
        else:
            score_seg = 3
    score += score_seg

    # Pilar 5: Cobertura de Fixos e Liquidez (0 a 10 pts)
    if cobertura >= 2.0 and lucro > 0:
        score_cob = 10
    elif cobertura >= 1.2 and lucro > 0:
        score_cob = 8
    elif cobertura >= 1.0:
        score_cob = 5
    else:
        score_cob = 1
    score += score_cob

    score = max(0, min(100, int(score)))

    # Classificação
    if score >= 82:
        nivel = "excelente"
        nivel_label = "Excelente Saúde Financeira"
        descricao = "Operação de alta eficiência, margens robustas e folga confortável de liquidez."
        cor = "#10b981"
    elif score >= 65:
        nivel = "bom"
        nivel_label = "Operação Saudável e Estável"
        descricao = "Negócio rentável com boa sustentabilidade, mantendo oportunidades em contenção de custos."
        cor = "#3b82f6"
    elif score >= 45:
        nivel = "atencao"
        nivel_label = "Atenção: Indicadores Frágeis"
        descricao = "Margens ou ponto de equilíbrio pressionados; recomenda-se revisão das despesas e preços."
        cor = "#f59e0b"
    else:
        nivel = "critico"
        nivel_label = "Crítico: Risco de Insolvência"
        descricao = "Operação deficitária ou margem de contribuição insuficiente para sustentar a estrutura de gastos."
        cor = "#ef4444"

    return {
        "score": score,
        "nivel": nivel,
        "nivel_label": nivel_label,
        "descricao": descricao,
        "cor": cor,
        "pilares": {
            "rentabilidade": {"pontos": score_rent, "max": 25, "rotulo": "Rentabilidade Líquida"},
            "margem_contribuicao": {"pontos": score_mc, "max": 25, "rotulo": "Margem de Contribuição"},
            "crescimento": {"pontos": score_cresc, "max": 20, "rotulo": "Evolução e Tendência"},
            "seguranca": {"pontos": score_seg, "max": 20, "rotulo": "Segurança Operacional / Teto"},
            "cobertura": {"pontos": score_cob, "max": 10, "rotulo": "Cobertura de Fixos"}
        }
    }


# ==============================================================================
# 2. GERADOR DE ALERTAS INTELIGENTES
# ==============================================================================
def gerar_alertas_estrategicos(estrutura, cresc_fat, cresc_luc, is_mei=False, mei_data=None):
    alertas = []
    fat = estrutura.get("receita_bruta", 0.0)
    luc = estrutura.get("lucro_liquido", 0.0)
    mg = estrutura.get("margem_liquida", 0.0)
    pe = estrutura.get("ponto_equilibrio", 0.0)
    cobertura = estrutura.get("cobertura_custos_fixos", 1.0)

    # 1. Alerta de Prejuízo
    if luc < 0:
        alertas.append({
            "tipo": "critico",
            "icone": "fa-solid fa-triangle-exclamation",
            "titulo": "Prejuízo Operacional no Período",
            "descricao": f"A operação acumulou déficit de R$ {abs(luc):,.2f}. As receitas não cobriram os custos e despesas.",
            "acao": "Auditar despesas e reavaliar precificação"
        })

    # 2. Alertas MEI
    if is_mei and mei_data:
        teto_pct = mei_data.get("percentual_teto", 0.0)
        if teto_pct >= 80.0:
            alertas.append({
                "tipo": "critico" if teto_pct >= 90.0 else "atencao",
                "icone": "fa-solid fa-scale-unbalanced",
                "titulo": f"Teto do MEI em {teto_pct}% de Utilização",
                "descricao": f"Faturamento no ano atingiu R$ {mei_data['faturamento_ano']:,.2f}. Restam R$ {mei_data['saldo_restante_teto']:,.2f} antes do desenquadramento obrigatório.",
                "acao": "Consultar contador para planejar transição ME"
            })
        if mei_data.get("dias_ate_proximo_das", 30) <= 5:
            alertas.append({
                "tipo": "atencao",
                "icone": "fa-solid fa-file-invoice",
                "titulo": f"Vencimento Próximo da Guia DAS-MEI ({mei_data['data_proximo_das']})",
                "descricao": "Garanta o pagamento do boleto DAS até o dia 20 para evitar juros e perda de benefícios do INSS.",
                "acao": "Confirmar emissão do DAS no PGMEI"
            })

    # 3. Alertas ME (Ponto de Equilíbrio / Margem)
    if not is_mei:
        if pe > 0 and fat < pe:
            alertas.append({
                "tipo": "critico",
                "icone": "fa-solid fa-chart-line-down",
                "titulo": "Abaixo do Ponto de Equilíbrio",
                "descricao": f"O faturamento de R$ {fat:,.2f} está R$ {pe - fat:,.2f} abaixo da receita mínima para cobrir os custos fixos.",
                "acao": "Aumentar volume de vendas ou cortar fixos"
            })
        elif cobertura < 1.15 and cobertura > 0:
            alertas.append({
                "tipo": "atencao",
                "icone": "fa-solid fa-shield-halved",
                "titulo": f"Baixa Cobertura de Custos Fixos ({cobertura}x)",
                "descricao": "A margem de contribuição gerada está no limite da cobertura das despesas fixas estruturais.",
                "acao": "Reduzir custos recorrentes e renegociar contratos"
            })

    # 4. Alerta de Margem Baixa
    if 0 < mg < 12.0:
        alertas.append({
            "tipo": "atencao",
            "icone": "fa-solid fa-percent",
            "titulo": f"Margem Líquida Comprimida ({mg}%)",
            "descricao": "A rentabilidade líquida está abaixo do benchmark seguro (15%). Qualquer oscilação nos custos pode gerar prejuízo.",
            "acao": "Revisar política de preços e descontos"
        })

    # 5. Alerta de Crescimento Sustentável (Sucesso)
    if (cresc_fat is not None and cresc_fat >= 8.0) and (cresc_luc is not None and cresc_luc >= 8.0):
        alertas.append({
            "tipo": "sucesso",
            "icone": "fa-solid fa-circle-check",
            "titulo": f"Expansão Saudável (+{cresc_fat}% em Receita)",
            "descricao": f"Faturamento e lucro (+{cresc_luc}%) cresceram em sincronia, comprovando ganho real de escala e eficiência.",
            "acao": "Avaliar investimentos em captação de clientes"
        })

    return alertas


# ==============================================================================
# 3. GERADOR DE RECOMENDAÇÕES ESTRATÉGICAS
# ==============================================================================
def gerar_recomendacoes_estrategicas(estrutura, cresc_fat, cresc_luc, is_mei=False, mei_data=None):
    recs = []
    mg = estrutura.get("margem_liquida", 0.0)
    imc = estrutura.get("indice_margem_contribuicao", 0.0)
    desp_fix = estrutura.get("despesas_fixas", 0.0)
    fat = estrutura.get("receita_bruta", 0.0)

    if is_mei and mei_data:
        recs.append({
            "prioridade": "Alta",
            "titulo": "Gestão de Caixa: Separação Rígida PF vs PJ",
            "descricao": "Estabeleça uma regra fixa: transfira seu pró-labore para a conta física apenas 1 vez ao mês. Nunca pague contas de casa com o cartão da empresa.",
            "impacto": "Garantia de sobrevivência do negócio e controle financeiro",
            "cor": "#3b82f6"
        })
        recs.append({
            "prioridade": "Alta" if mei_data["percentual_teto"] >= 75 else "Media",
            "titulo": "Monitoramento de Limite Fiscal (R$ 81.000)",
            "descricao": f"Você faturou R$ {mei_data['faturamento_ano']:,.2f} no ano. Se passar de R$ 97.200 (20% de tolerância), a migração para ME será retroativa a janeiro.",
            "impacto": "Prevenção de multas e cobrança retroativa do Simples Nacional",
            "cor": "#f59e0b"
        })
        recs.append({
            "prioridade": "Media",
            "titulo": "Aumento do Ticket Médio por Venda",
            "descricao": "Como o MEI tem limite de faturamento anual, foque em produtos e serviços com maior margem de lucro por unidade vendida.",
            "impacto": "+15% de lucro sem extrapolar o teto de notas",
            "cor": "#10b981"
        })
    else:
        if imc < 40.0:
            recs.append({
                "prioridade": "Alta",
                "titulo": "Renegociação de Custos Variáveis / Fornecedores",
                "descricao": f"Seu índice de margem de contribuição está em {imc}%. Negocie descontos em lotes maiores com fornecedores ou repasse custos nos itens topo de linha.",
                "impacto": "+4% a 8% na Margem EBITDA",
                "cor": "#ef4444"
            })
        if desp_fix > fat * 0.40 and fat > 0:
            recs.append({
                "prioridade": "Alta",
                "titulo": "Enxugamento de Custos Fixos Operacionais",
                "descricao": f"Os gastos fixos (R$ {desp_fix:,.2f}) representam {round(desp_fix / fat * 100, 1)}% do faturamento. Renegocie aluguéis, licenças e serviços terceirizados.",
                "impacto": "Redução direta do Ponto de Equilíbrio",
                "cor": "#f59e0b"
            })
        recs.append({
            "prioridade": "Media",
            "titulo": "Planejamento Tributário e Apuração de Créditos",
            "descricao": "Monitore a faixa de enquadramento no Simples Nacional e estude a segregação de receitas monofásicas para economizar no DAS.",
            "impacto": "Economia de até 3% na alíquota efetiva",
            "cor": "#3b82f6"
        })
        recs.append({
            "prioridade": "Media",
            "titulo": "Blindagem de Capital de Giro e Prazos Médios",
            "descricao": "Alinhe os prazos médios de recebimento dos clientes com os prazos de pagamento a fornecedores para não depender de crédito bancário rotativo.",
            "impacto": "Eliminação de juros financeiros",
            "cor": "#10b981"
        })

    return recs


# ==============================================================================
# 4. CÁLCULO DE CENÁRIOS E PROJEÇÕES ESTATÍSTICAS
# ==============================================================================
def calcular_cenarios_completos(fat_atual, desp_atual, series_faturamento, series_lucro):
    """
    Projeta 3 cenários probabilísticos para o próximo período:
    1. Provável (Reta de regressão linear)
    2. Otimista (+15% expansão e ganhos operacionais)
    3. Conservador / Pessimista (-15% retração de demanda)
    """
    proximo_fat_provavel = projetar_valor(series_faturamento, 1) if series_faturamento else round(fat_atual * 1.02, 2)
    series_desp = [max(0.0, float(f) - float(l)) for f, l in zip(series_faturamento, series_lucro)] if series_faturamento and series_lucro else []
    proxima_desp_provavel = projetar_valor(series_desp, 1) if series_desp else round(desp_atual, 2)

    proximo_luc_provavel = round(proximo_fat_provavel - proxima_desp_provavel, 2)
    mg_provavel = round((proximo_luc_provavel / proximo_fat_provavel * 100), 2) if proximo_fat_provavel > 0 else 0.0

    # Cenário Otimista: +15% receita, custos com economia de escala (+5%)
    fat_otimista = round(proximo_fat_provavel * 1.15, 2)
    desp_otimista = round(proxima_desp_provavel * 1.05, 2)
    luc_otimista = round(fat_otimista - desp_otimista, 2)
    mg_otimista = round((luc_otimista / fat_otimista * 100), 2) if fat_otimista > 0 else 0.0

    # Cenário Conservador / Pessimista: -15% receita, custos com rigidez (-3%)
    fat_pessimista = round(max(0.0, proximo_fat_provavel * 0.85), 2)
    desp_pessimista = round(proxima_desp_provavel * 0.97, 2)
    luc_pessimista = round(fat_pessimista - desp_pessimista, 2)
    mg_pessimista = round((luc_pessimista / fat_pessimista * 100), 2) if fat_pessimista > 0 else 0.0

    return {
        "provavel": {
            "titulo": "Cenário Provável (Tendência)",
            "faturamento": proximo_fat_provavel,
            "despesas": proxima_desp_provavel,
            "lucro": proximo_luc_provavel,
            "margem": mg_provavel,
            "badge": "Tendência Linear",
            "descricao": "Baseado na inclinação da reta de regressão dos períodos recentes."
        },
        "otimista": {
            "titulo": "Cenário Otimista (+15% Expansão)",
            "faturamento": fat_otimista,
            "despesas": desp_otimista,
            "lucro": luc_otimista,
            "margem": mg_otimista,
            "badge": "Expansão de Vendas",
            "descricao": "Considera campanhas ativas, aumento de ticket médio e ganhos de escala."
        },
        "pessimista": {
            "titulo": "Cenário Conservador (-15% Retração)",
            "faturamento": fat_pessimista,
            "despesas": desp_pessimista,
            "lucro": luc_pessimista,
            "margem": mg_pessimista,
            "badge": "Teste de Estresse",
            "descricao": "Simula queda de demanda e rigidez de despesas fixas para avaliar resistência de caixa."
        }
    }


def calcular_cenarios(faturamento, despesas, lucro, margem, series_faturamento, series_lucro):
    """Calcula projeções para diferentes cenários obedecendo Lucro = Receita - Despesas"""
    series_despesas = [max(0.0, float(f) - float(l)) for f, l in zip(series_faturamento, series_lucro)] if series_faturamento and series_lucro else []

    proximo_fat_provavel = projetar_valor(series_faturamento, 1)
    if series_despesas:
        proxima_desp_provavel = projetar_valor(series_despesas, 1)
    else:
        proxima_desp_provavel = round(max(0.0, float(despesas)), 2)
    proximo_luc_provavel = round(proximo_fat_provavel - proxima_desp_provavel, 2)

    proximo_fat_otimista = round(proximo_fat_provavel * 1.15, 2)
    proxima_desp_otimista = round(proxima_desp_provavel * 0.95, 2)
    proximo_luc_otimista = round(proximo_fat_otimista - proxima_desp_otimista, 2)

    proximo_fat_pessimista = round(max(0.0, proximo_fat_provavel * 0.85), 2)
    proxima_desp_pessimista = round(proxima_desp_provavel * 1.05, 2)
    proximo_luc_pessimista = round(proximo_fat_pessimista - proxima_desp_pessimista, 2)

    return {
        "provavel": {
            "titulo": "Cenário Provável (Tendência)",
            "faturamento": proximo_fat_provavel,
            "despesas": proxima_desp_provavel,
            "lucro": proximo_luc_provavel,
            "margem": round((proximo_luc_provavel / proximo_fat_provavel * 100), 2) if proximo_fat_provavel > 0 else 0
        },
        "otimista": {
            "titulo": "Cenário Otimista (+15% Expansão)",
            "faturamento": proximo_fat_otimista,
            "despesas": proxima_desp_otimista,
            "lucro": proximo_luc_otimista,
            "margem": round((proximo_luc_otimista / proximo_fat_otimista * 100), 2) if proximo_fat_otimista > 0 else 0
        },
        "pessimista": {
            "titulo": "Cenário Conservador (-15% Retração)",
            "faturamento": proximo_fat_pessimista,
            "despesas": proxima_desp_pessimista,
            "lucro": proximo_luc_pessimista,
            "margem": round((proximo_luc_pessimista / proximo_fat_pessimista * 100), 2) if proximo_fat_pessimista > 0 else 0
        }
    }


def gerar_alertas(*args, **kwargs):
    if args and isinstance(args[0], dict):
        return gerar_alertas_estrategicos(*args, **kwargs)
    fat = args[0] if len(args) > 0 else 0.0
    desp = args[1] if len(args) > 1 else 0.0
    luc = args[2] if len(args) > 2 else 0.0
    mg = args[3] if len(args) > 3 else 0.0
    fat_a = args[4] if len(args) > 4 else 0.0
    luc_a = args[5] if len(args) > 5 else 0.0
    cresc_fat = variacao_percentual(fat_a, fat)
    cresc_luc = variacao_percentual(luc_a, luc)
    est = {"receita_bruta": fat, "despesas_totais": desp, "lucro_liquido": luc, "margem_liquida": mg}
    return gerar_alertas_estrategicos(est, cresc_fat, cresc_luc)


def gerar_recomendacoes(*args, **kwargs):
    if args and isinstance(args[0], dict):
        return gerar_recomendacoes_estrategicas(*args, **kwargs)
    fat = args[0] if len(args) > 0 else 0.0
    desp = args[1] if len(args) > 1 else 0.0
    luc = args[2] if len(args) > 2 else 0.0
    mg = args[3] if len(args) > 3 else 0.0
    cresc_fat = args[4] if len(args) > 4 else 0.0
    cresc_luc = args[5] if len(args) > 5 else 0.0
    est = {"receita_bruta": fat, "despesas_totais": desp, "lucro_liquido": luc, "margem_liquida": mg, "indice_margem_contribuicao": 35.0, "despesas_fixas": desp * 0.45}
    return gerar_recomendacoes_estrategicas(est, cresc_fat, cresc_luc)


# ==============================================================================
# 5. ENDPOINT PRINCIPAL: OBTER ANÁLISE ESTRATÉGICA
# ==============================================================================
def obter_analise_estrategica():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    try:
        data_inicio_str = request.args.get("data_inicio")
        data_fim_str = request.args.get("data_fim")
        planilha_id = request.args.get("planilha_id", request.args.get("tabela_id", "todas"))
        cenario_sel = request.args.get("cenario", "provavel")

        hoje = datetime.now()
        if data_inicio_str:
            data_inicio = datetime.strptime(data_inicio_str, "%Y-%m-%d")
        else:
            data_inicio = hoje - timedelta(days=90)
            data_inicio_str = data_inicio.strftime("%Y-%m-%d")

        if data_fim_str:
            data_fim = datetime.strptime(data_fim_str, "%Y-%m-%d")
        else:
            data_fim = hoje
            data_fim_str = data_fim.strftime("%Y-%m-%d")

        # Perfil do usuário
        perfil_usuario = session.get("usuario_perfil")
        if not perfil_usuario:
            u_doc = usuarios_colecao.find_one({"_id": ObjectId(usuario_id)}) if ObjectId.is_valid(usuario_id) else None
            perfil_usuario = (u_doc.get("tipo_perfil") if u_doc else None) or "ME"

        is_mei = (str(perfil_usuario).strip().upper() == "MEI")

        from backend.home.home import obter_colunas_mapeadas
        mapeamento = obter_colunas_mapeadas(usuario_id)

        from backend.dados.agregador import obter_contexto_dados
        contexto = {}
        for tentativa in range(3):
            try:
                contexto = obter_contexto_dados(usuario_id, escopo=planilha_id, mapeamento=mapeamento)
                break
            except Exception as e_db:
                if tentativa < 2:
                    import time
                    time.sleep(0.4)
                else:
                    raise e_db
        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "sucesso": False,
                "erro": "Nenhum dado encontrado para o usuário ou planilha selecionada",
                "saude": {"score": 0, "nivel": "sem_dados", "descricao": "Adicione lançamentos na sua planilha"},
                "alertas": [],
                "recomendacoes": [],
                "cenarios": {}
            })

        df = pd.DataFrame(dados)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        df_periodo = filtrar_por_periodo(df, col_data, data_inicio, data_fim)

        duracao_dias = (data_fim - data_inicio).days + 1
        fim_ant = data_inicio - timedelta(days=1)
        inicio_ant = fim_ant - timedelta(days=duracao_dias - 1)
        df_ant = filtrar_por_periodo(df, col_data, inicio_ant, fim_ant)

        # Estrutura contábil
        estrutura_atual = calcular_estrutura_contabil(df_periodo, mapeamento, is_mei=is_mei)
        estrutura_ant = calcular_estrutura_contabil(df_ant, mapeamento, is_mei=is_mei)

        fat = estrutura_atual["receita_bruta"]
        fat_a = estrutura_ant["receita_bruta"]
        cresc_fat = variacao_percentual(fat_a, fat)

        desp = estrutura_atual["despesas_totais"]
        desp_a = estrutura_ant["despesas_totais"]
        var_desp = variacao_percentual(desp_a, desp)

        luc = estrutura_atual["lucro_liquido"]
        luc_a = estrutura_ant["lucro_liquido"]
        cresc_luc = variacao_percentual(luc_a, luc)

        mg = estrutura_atual["margem_liquida"]

        # Módulo MEI
        metricas_mei = calcular_metricas_mei(df, col_data, fat, desp, luc, ano_referencia=data_fim.year)

        # Séries temporais para cenários
        from backend.analise.analise import gerar_series_mensais_detalhadas
        series_obj = gerar_series_mensais_detalhadas(df_periodo, col_data, mapeamento)
        series_fat = series_obj.get("faturamento", [])
        series_luc = series_obj.get("lucro", [])

        # Saúde do negócio
        saude = calcular_saude_negocio(estrutura_atual, cresc_fat, cresc_luc, is_mei=is_mei, mei_data=metricas_mei)

        # Alertas e Recomendações
        alertas = gerar_alertas_estrategicos(estrutura_atual, cresc_fat, cresc_luc, is_mei=is_mei, mei_data=metricas_mei)
        recomendacoes = gerar_recomendacoes_estrategicas(estrutura_atual, cresc_fat, cresc_luc, is_mei=is_mei, mei_data=metricas_mei)

        # Cenários preditivos
        cenarios = calcular_cenarios_completos(fat, desp, series_fat, series_luc)
        dados_cenario = cenarios.get(cenario_sel, cenarios["provavel"])

        return jsonify({
            "sucesso": True,
            "perfil": perfil_usuario,
            "is_mei": is_mei,
            "periodo": {
                "inicio": data_inicio_str,
                "fim": data_fim_str
            },
            "metricas": {
                "faturamento": fat,
                "despesas": desp,
                "lucro": luc,
                "margem": mg
            },
            "comparacao": {
                "faturamento_anterior": fat_a,
                "lucro_anterior": luc_a,
                "variacao_faturamento": cresc_fat,
                "variacao_lucro": cresc_luc
            },
            "saude": saude,
            "alertas": alertas,
            "recomendacoes": recomendacoes,
            "cenarios": cenarios,
            "dados_cenario": dados_cenario,
            "mei": metricas_mei if is_mei else None,
            "series": {
                "faturamento": series_fat,
                "lucro": series_luc,
                "meses": series_obj.get("meses", [])
            }
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "sucesso": False,
            "erro": str(e),
            "saude": {"score": 0, "nivel": "erro", "descricao": "Erro ao processar dados estratégicos"},
            "alertas": [],
            "recomendacoes": []
        }), 500