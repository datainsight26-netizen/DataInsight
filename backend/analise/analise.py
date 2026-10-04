"""
backend/analise/analise.py
DataInsight — Central Executiva de Inteligência Contábil, Financeira e Análise com IA
Suporta cálculos avançados para ME e MEI, DRE gerencial, ponto de equilíbrio,
teto do MEI, métricas mensais/anuais, séries temporais e diagnósticos executivos.
"""

# ==============================================================================
# analise.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme este arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTS
# ==============================================================================

from flask import session, jsonify, request
from backend.db import dados_colecao, usuario as usuarios_colecao
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from bson import ObjectId


# ==============================================================================
# 2. ALIASES E NOMENCLATURAS CONTÁBEIS E FINANCEIRAS
# ==============================================================================

COL_FATURAMENTO = [
    "Total", "Faturamento", "faturamento", "Vendas", "vendas", "Receita", "receita",
    "Valor_Total", "Preco_Total", "Valor", "receita_total", "total_vendas"
]
COL_DESPESA = [
    "Custo", "Despesa", "despesa", "Despesas", "despesas", "Gastos", "gastos",
    "Custo_Total", "Total_Despesas", "Valor_Pago", "despesa_total", "saida", "saidas"
]
COL_LUCRO = [
    "Lucro", "lucro", "Profit", "profit", "Resultado", "resultado", "Lucro_Liquido",
    "saldo", "sobra"
]
COL_IMPOSTOS = [
    "Imposto", "imposto", "Impostos", "impostos", "Tributo", "tributos",
    "Simples", "simples", "DAS", "das", "ISS", "ICMS", "PIS", "COFINS", "retencao"
]
COL_CUSTOS_VARIAVEIS = [
    "Custo_Variavel", "custo_variavel", "CMV", "cmv", "CPV", "cpv",
    "Fornecedor", "fornecedores", "Materia_Prima", "insumo", "insumos",
    "Comissao", "comissoes", "Frete", "frete", "Embalagem", "custo_produto"
]
COL_DESPESAS_FIXAS = [
    "Gasto_Fixo", "gasto_fixo", "Despesa_Fixa", "despesa_fixa", "Aluguel", "aluguel",
    "Folha", "folha", "Salario", "salarios", "Pro_Labore", "pro_labore",
    "Contabilidade", "energia", "agua", "internet", "telefone", "overhead"
]


# ==============================================================================
# 3. FUNÇÕES AUXILIARES DE TRATAMENTO DE DADOS
# ==============================================================================

def encontrar_coluna_data(df):
    if df.empty:
        return None
    for c in df.columns:
        if str(c).strip().lower() in ["data", "date", "dt", "data_venda", "data_transacao", "created_at"]:
            return c
    return next((c for c in df.columns if "data" in str(c).lower() or "date" in str(c).lower()), None)


def extrair_total_coluna(df, coluna_especifica, colunas_fallback=None):
    """Extrai a soma numérica limpa de uma coluna ou aliases com tratamento robusto."""
    if df.empty:
        return 0.0

    if coluna_especifica and coluna_especifica in df.columns:
        s = pd.to_numeric(df[coluna_especifica], errors="coerce").fillna(0)
        return float(s.sum())

    if colunas_fallback:
        for col in colunas_fallback:
            if col in df.columns:
                s = pd.to_numeric(df[col], errors="coerce").fillna(0)
                return float(s.sum())
            for c in df.columns:
                if str(c).strip().lower() == col.lower():
                    s = pd.to_numeric(df[c], errors="coerce").fillna(0)
                    return float(s.sum())

    return 0.0


def variacao_percentual(anterior, atual):
    if anterior is None or atual is None:
        return None
    if anterior == 0:
        return 0.0 if atual == 0 else None
    return round(((atual - anterior) / abs(anterior)) * 100, 2)


def montar_analises_decisao(faturamento, despesas, lucro, margem, faturamento_anterior, lucro_anterior, series_faturamento, series_lucro):
    crescimento_faturamento = variacao_percentual(faturamento_anterior, faturamento)
    crescimento_lucro = variacao_percentual(lucro_anterior, lucro)

    if margem >= 25 and (crescimento_lucro is not None and crescimento_lucro >= 5):
        nivel = "Saudável"
        score = 92
        descricao = "Margem forte e tendência positiva, com espaço para expansão e investimento em vendas."
        recomendacao = "Priorize campanhas de retenção, upsell e aumento de ticket médio."
        prioridade = "Alta"
    elif margem >= 15 and (crescimento_lucro is not None and crescimento_lucro >= 0):
        nivel = "Estável"
        score = 78
        descricao = "O negócio está controlado, mas ainda há ganho ao otimizar custos e aumentar eficiência."
        recomendacao = "Revise processos operacionais e reduza gargalos de produtividade."
        prioridade = "Média"
    else:
        nivel = "Atenção"
        score = 61
        descricao = "Margem apertada e desempenho frágil; é preciso agir rapidamente para proteger a rentabilidade."
        recomendacao = "Concentre-se em corte de desperdícios, renegociação de despesas e cobrança mais ágil."
        prioridade = "Alta"

    projeção_faturamento = projetar_valor(series_faturamento, horizonte=1)
    projeção_lucro = projetar_valor(series_lucro, horizonte=1, permitir_negativo=True)

    return {
        "classificacao": {
            "nivel": nivel,
            "score": score,
            "descricao": descricao,
        },
        "projecao": {
            "titulo": "Projeção de faturamento",
            "valor": projeção_faturamento,
            "descricao": f"Com base na tendência dos últimos meses, o próximo período pode fechar em torno de {projeção_faturamento:.2f}.",
        },
        "predicao": {
            "titulo": "Previsão de lucro",
            "valor": projeção_lucro,
            "descricao": f"A regressão simples indica um lucro estimado de {projeção_lucro:.2f} para o próximo ciclo.",
        },
        "recomendacao": {
            "titulo": "Ação recomendada",
            "texto": recomendacao,
            "prioridade": prioridade,
        },
        "sinais": {
            "crescimento_faturamento": crescimento_faturamento,
            "crescimento_lucro": crescimento_lucro,
            "margem": margem,
        },
    }


def filtrar_por_periodo(df, col_data, inicio, fim):
    if df.empty or not col_data or col_data not in df.columns:
        return df

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])

    if inicio and fim:
        return df[(df[col_data] >= inicio) & (df[col_data] <= fim)]
    elif inicio:
        return df[df[col_data] >= inicio]
    elif fim:
        return df[df[col_data] <= fim]
    return df


def calcular_regressao_linear(series):
    valores = [float(v) for v in series if pd.notna(v)]
    if len(valores) < 2:
        return 0.0, float(valores[-1]) if valores else 0.0

    x = list(range(1, len(valores) + 1))
    x_media = sum(x) / len(x)
    y_media = sum(valores) / len(valores)

    covariancia = sum((xi - x_media) * (yi - y_media) for xi, yi in zip(x, valores))
    variancia = sum((xi - x_media) ** 2 for xi in x)

    if variancia == 0:
        return 0.0, y_media

    inclinacao = covariancia / variancia
    intercepto = y_media - inclinacao * x_media
    return inclinacao, intercepto


def projetar_valor(series, horizonte=1, permitir_negativo=False):
    inclinacao, intercepto = calcular_regressao_linear(series)
    valor = intercepto + inclinacao * (len(series) + horizonte)
    return round(valor if permitir_negativo else max(0.0, valor), 2)


# ==============================================================================
# 4. MOTOR DE CÁLCULO CONTÁBIL & FINANCEIRO (DRE, MARGENS, PONTO DE EQUILÍBRIO)
# ==============================================================================

def calcular_estrutura_contabil(df, mapeamento=None, is_mei=False):
    """
    Calcula a estrutura contábil completa:
    Receita Bruta -> Impostos -> ROL -> Custos Variáveis -> Lucro Bruto
    -> Despesas Fixas -> EBITDA -> Lucro Líquido
    -> Ponto de Equilíbrio, Margem de Segurança, Cobertura de Fixos.
    """
    if mapeamento is None:
        mapeamento = {}

    from backend.home.home import calcular_total_dinamico

    # 1. Receita Bruta / Faturamento
    receita_bruta = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)

    # 2. Despesas Totais declaradas
    despesas_totais = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)

    # 3. Lucro direto declarado (se houver coluna explícita de lucro)
    lucro_declarado = calcular_total_dinamico(df, "lucro", mapeamento, COL_LUCRO)
    tem_lucro_declarado = (lucro_declarado != 0 and abs(lucro_declarado) > 0.01)
    if despesas_totais == 0 and receita_bruta > 0 and tem_lucro_declarado and lucro_declarado < receita_bruta:
        despesas_totais = max(0.0, receita_bruta - lucro_declarado)

    # 4. Impostos / Deduções
    # Tenta coluna mapeada pelo mapeamento financeiro primeiro
    impostos_reais = 0.0
    col_impostos_fin = mapeamento.get("impostos") or mapeamento.get("das_mei")
    if col_impostos_fin:
        impostos_reais = extrair_total_coluna(df, col_impostos_fin, None)
    if impostos_reais <= 0:
        impostos_reais = extrair_total_coluna(df, None, COL_IMPOSTOS)

    # Fallback: valor manual ou alíquota estimada
    if impostos_reais <= 0 and receita_bruta > 0:
        taxa_manual = mapeamento.get("taxa_imposto_manual") or mapeamento.get("impostos_manual")
        das_manual = mapeamento.get("das_mei_manual")
        if taxa_manual and float(taxa_manual) > 0:
            impostos_estimados = round(receita_bruta * float(taxa_manual) / 100, 2)
        elif das_manual and float(das_manual) > 0:
            impostos_estimados = float(das_manual)
        elif is_mei:
            from backend.cnpj.cnpj_service import calcular_das_mei
            tipo_ativ = mapeamento.get("tipo_atividade") or mapeamento.get("cnae_tipo") or "servicos"
            impostos_estimados = float(calcular_das_mei(tipo_atividade=tipo_ativ)["total_das"])
        else:
            # Alíquota média do Simples Nacional (~5.5% para ME)
            impostos_estimados = round(receita_bruta * 0.055, 2)
    else:
        impostos_estimados = impostos_reais

    receita_liquida = max(0.0, receita_bruta - impostos_estimados)

    # 5. Segregação de Custos Variáveis vs Despesas Fixas
    # Tenta colunas mapeadas pelo mapeamento financeiro
    col_cv = mapeamento.get("custo_variavel") or mapeamento.get("fornecedores") or mapeamento.get("publicidade")
    col_fixos = mapeamento.get("aluguel") or mapeamento.get("folha_pagamento") or mapeamento.get("pro_labore") or mapeamento.get("gastos_fixos")

    custos_var_reais = extrair_total_coluna(df, col_cv, COL_CUSTOS_VARIAVEIS)
    fixos_reais = extrair_total_coluna(df, col_fixos, COL_DESPESAS_FIXAS)

    # Soma todos os mapeamentos de custos variáveis disponíveis
    if custos_var_reais == 0:
        for chave in ["custo_variavel", "fornecedores", "publicidade", "custo_variavel_outros"]:
            col = mapeamento.get(chave)
            if col:
                v = extrair_total_coluna(df, col, None)
                custos_var_reais += v

    # Soma todos os mapeamentos de despesas fixas disponíveis
    if fixos_reais == 0:
        for chave in ["aluguel", "folha_pagamento", "pro_labore", "gasto_fixo_outros"]:
            col = mapeamento.get(chave)
            if col:
                v = extrair_total_coluna(df, col, None)
                fixos_reais += v
        # Soma manuais também
        for chave in ["aluguel_manual", "folha_pagamento_manual", "pro_labore_manual", "gasto_fixo_outros_manual"]:
            val = mapeamento.get(chave)
            if val and float(val) > 0:
                fixos_reais += float(val)

    gastos_operacionais_totais = max(0.0, despesas_totais - impostos_estimados) if despesas_totais > impostos_estimados else despesas_totais

    if custos_var_reais > 0 or fixos_reais > 0:
        custos_variaveis = custos_var_reais
        despesas_fixas = fixos_reais
        if custos_variaveis == 0 and gastos_operacionais_totais > 0:
            custos_variaveis = round(gastos_operacionais_totais * 0.55, 2)
        if despesas_fixas == 0 and gastos_operacionais_totais > 0:
            despesas_fixas = round(gastos_operacionais_totais * 0.45, 2)
    else:
        # Padrão de benchmark para PMEs quando não há segregação explícita
        # ~55% custos diretos variáveis (produtos/serviços), ~45% custos fixos (estrutura/pessoal)
        custos_variaveis = round(gastos_operacionais_totais * 0.55, 2)
        despesas_fixas = round(gastos_operacionais_totais * 0.45, 2)

    # 6. Lucro Bruto (ROL - CMV)
    lucro_bruto = receita_liquida - custos_variaveis
    margem_bruta_pct = round((lucro_bruto / receita_bruta * 100), 2) if receita_bruta > 0 else 0.0

    # Margem de Contribuição (MC = Receita Bruta - Impostos - Custos Variáveis)
    margem_contribuicao = max(-999999.0, receita_bruta - impostos_estimados - custos_variaveis)
    indice_mc = (margem_contribuicao / receita_bruta) if receita_bruta > 0 else 0.0
    imc_pct = round(indice_mc * 100, 2)

    # 7. EBITDA / LAJIDA = Lucro Bruto - Despesas Fixas
    ebitda = round(lucro_bruto - despesas_fixas, 2)
    margem_ebitda_pct = round((ebitda / receita_bruta * 100), 2) if receita_bruta > 0 else 0.0

    # 8. Lucro Líquido:
    # - Se há coluna explícita de lucro declarado, usa ela
    # - Caso contrário, Lucro Líquido = EBITDA (pois sem D&A, IR/CS explícitos, LL = EBITDA)
    # NOTA: O Lucro Líquido NÃO deve ser calculado como Receita - DespesasTotais brutas
    # quando a DRE já foi estruturada, pois isso geraria dupla contagem.
    if tem_lucro_declarado:
        lucro_liquido = lucro_declarado
    else:
        # Derivado da estrutura DRE: EBITDA (sem D&A, sem IR/CS explícito)
        lucro_liquido = ebitda

    margem_liquida_pct = round((lucro_liquido / receita_bruta * 100), 2) if receita_bruta > 0 else 0.0
    eficiencia_operacional_pct = round((despesas_totais / receita_bruta * 100), 2) if receita_bruta > 0 else 0.0

    # 9. Ponto de Equilíbrio Contábil (Break-Even)
    if indice_mc > 0.01:
        ponto_equilibrio = round(despesas_fixas / indice_mc, 2)
        if receita_bruta >= ponto_equilibrio:
            margem_seguranca_pct = round(((receita_bruta - ponto_equilibrio) / receita_bruta) * 100, 2)
            pe_status = "atingido"
        else:
            margem_seguranca_pct = 0.0
            pe_status = "abaixo"
    else:
        ponto_equilibrio = 0.0
        margem_seguranca_pct = 0.0
        pe_status = "critico"

    # 10. Cobertura de Custos Fixos
    if despesas_fixas > 0:
        cobertura_fixos = round(max(0.0, margem_contribuicao) / despesas_fixas, 2)
    else:
        cobertura_fixos = 99.0 if margem_contribuicao > 0 else 0.0

    # 11. Montar Linhas da DRE Gerencial Estruturada
    dre_linhas = [
        {"ordem": 1, "tipo": "receita",   "nome": "(+) Receita Operacional Bruta",           "valor": round(receita_bruta, 2),      "pct": 100.0,                                                                                              "destaque": True},
        {"ordem": 2, "tipo": "deducao",   "nome": "(-) Deduções e Tributos (Simples/DAS)",   "valor": round(impostos_estimados, 2), "pct": round((impostos_estimados / receita_bruta * 100), 1) if receita_bruta > 0 else 0.0,                  "destaque": False},
        {"ordem": 3, "tipo": "subtotal",  "nome": "(=) Receita Operacional Líquida (ROL)",   "valor": round(receita_liquida, 2),    "pct": round((receita_liquida / receita_bruta * 100), 1) if receita_bruta > 0 else 0.0,                     "destaque": True},
        {"ordem": 4, "tipo": "custo",     "nome": "(-) Custos Operacionais / CMV / Insumos", "valor": round(custos_variaveis, 2),   "pct": round((custos_variaveis / receita_bruta * 100), 1) if receita_bruta > 0 else 0.0,                    "destaque": False},
        {"ordem": 5, "tipo": "subtotal",  "nome": "(=) Lucro Bruto (Margem de Contribuição)","valor": round(lucro_bruto, 2),        "pct": margem_bruta_pct,                                                                                    "destaque": True},
        {"ordem": 6, "tipo": "despesa",   "nome": "(-) Despesas Fixas e Administrativas",    "valor": round(despesas_fixas, 2),     "pct": round((despesas_fixas / receita_bruta * 100), 1) if receita_bruta > 0 else 0.0,                      "destaque": False},
        {"ordem": 7, "tipo": "subtotal",  "nome": "(=) EBITDA / LAJIDA Gerencial",           "valor": ebitda,                       "pct": margem_ebitda_pct,                                                                                   "destaque": True},
        {"ordem": 8, "tipo": "total",     "nome": "(=) Lucro Líquido do Exercício",           "valor": round(lucro_liquido, 2),      "pct": margem_liquida_pct,                                                                                  "destaque": True}
    ]

    return {
        "receita_bruta": round(receita_bruta, 2),
        "impostos_deducoes": round(impostos_estimados, 2),
        "impostos_aliquota_efetiva": round((impostos_estimados / receita_bruta * 100), 2) if receita_bruta > 0 else 0.0,
        "receita_liquida": round(receita_liquida, 2),
        "custos_variaveis": round(custos_variaveis, 2),
        "lucro_bruto": round(lucro_bruto, 2),
        "margem_bruta": margem_bruta_pct,
        "despesas_fixas": round(despesas_fixas, 2),
        "despesas_totais": round(despesas_totais, 2),
        "margem_contribuicao": round(margem_contribuicao, 2),
        "indice_margem_contribuicao": imc_pct,
        "ponto_equilibrio": ponto_equilibrio,
        "ponto_equilibrio_status": pe_status,
        "margem_seguranca_operacional": margem_seguranca_pct,
        "cobertura_custos_fixos": cobertura_fixos,
        "ebitda": ebitda,
        "margem_ebitda": margem_ebitda_pct,
        "lucro_liquido": round(lucro_liquido, 2),
        "margem_liquida": margem_liquida_pct,
        "eficiencia_operacional": eficiencia_operacional_pct,
        "dre_linhas": dre_linhas
    }


# ==============================================================================
# 5. MOTOR ESPECÍFICO MEI (TETO, DAS, PRÓ-LABORE, ENQUADRAMENTO FISCAL)
# ==============================================================================

def calcular_metricas_mei(df, col_data, faturamento_periodo, despesas_periodo, lucro_periodo, ano_referencia=None):
    """
    Calcula indicadores exclusivos para o Microempreendedor Individual (MEI):
    - Teto legal de R$ 81.000,00 e limite proporcional mensal de R$ 6.750,00.
    - Faturamento acumulado no ano (YTD).
    - Projeção de faturamento até dezembro.
    - Risco de desenquadramento fiscal.
    - Lucro no bolso, pró-labore recomendado e reserva de emergência recomendada.
    """
    TETO_ANUAL_MEI = 81000.0
    LIMITE_MENSAL_MEI = 6750.0

    if ano_referencia is None:
        ano_referencia = datetime.now().year

    faturamento_ano = 0.0
    meses_com_movimento = set()

    if not df.empty and col_data and col_data in df.columns:
        df_copy = df.copy()
        df_copy[col_data] = pd.to_datetime(df_copy[col_data], errors="coerce")
        df_ano = df_copy[df_copy[col_data].dt.year == ano_referencia]

        if not df_ano.empty:
            for col in COL_FATURAMENTO:
                if col in df_ano.columns:
                    soma = pd.to_numeric(df_ano[col], errors="coerce").fillna(0).sum()
                    faturamento_ano = float(soma)
                    break
            meses_com_movimento = set(df_ano[col_data].dt.month.dropna().unique())

    if faturamento_ano == 0.0 and faturamento_periodo > 0:
        faturamento_ano = faturamento_periodo

    meses_decorridos = max(1, len(meses_com_movimento) if meses_com_movimento else min(12, datetime.now().month))
    media_mensal = round(faturamento_ano / meses_decorridos, 2)
    projecao_fechamento_ano = round(media_mensal * 12, 2)

    pct_consumido_teto = round((faturamento_ano / TETO_ANUAL_MEI) * 100, 1)
    saldo_restante_teto = max(0.0, round(TETO_ANUAL_MEI - faturamento_ano, 2))

    # Nível de risco de desenquadramento
    if pct_consumido_teto > 100.0 or projecao_fechamento_ano > 97200.0:  # > 20% acima do teto = desenquadramento retroativo
        status_teto = "risco_desenquadramento"
        status_titulo = "Desenquadramento Obrigatório"
        status_desc = f"Faturamento superou o teto anual de R$ 81.000 (consumo de {pct_consumido_teto}%). É necessário iniciar a transição para Microempresa (ME) junto à contabilidade."
        alerta_migracao = True
    elif pct_consumido_teto >= 80.0 or projecao_fechamento_ano >= 75000.0:
        status_teto = "atencao"
        status_titulo = "Atenção Crítica ao Teto"
        status_desc = f"Você já utilizou {pct_consumido_teto}% do limite anual do MEI. Restam R$ {saldo_restante_teto:,.2f} até o fim do exercício fiscal."
        alerta_migracao = True
    elif pct_consumido_teto >= 65.0:
        status_teto = "alerta_moderado"
        status_titulo = "Monitoramento Recomendado"
        status_desc = f"Faturamento em {pct_consumido_teto}% do limite anual. Mantenha controle rigoroso de novas notas emitidas."
        alerta_migracao = False
    else:
        status_teto = "seguro"
        status_titulo = "Enquadramento Seguro"
        status_desc = f"Consumo de {pct_consumido_teto}% do teto anual do MEI. Operação com margem segura de faturamento."
        alerta_migracao = False

    # Próximo vencimento do DAS-MEI (sempre dia 20 do mês)
    hoje = datetime.now()
    if hoje.day <= 20:
        data_das = datetime(hoje.year, hoje.month, 20)
    else:
        mes_prox = hoje.month + 1 if hoje.month < 12 else 1
        ano_prox = hoje.year if hoje.month < 12 else hoje.year + 1
        data_das = datetime(ano_prox, mes_prox, 20)
    dias_ate_das = max(0, (data_das.date() - hoje.date()).days)

    # Separação PF vs PJ & Lucro no Bolso
    lucro_no_bolso = max(0.0, lucro_periodo)
    # Recomendação: 65% retirada pró-labore pessoal, 35% reserva emergencial do negócio
    pro_labore_sugerido = round(lucro_no_bolso * 0.65, 2)
    # Reserva de emergência ideal da empresa: 3 meses de despesas médias
    despesa_media_mes = (despesas_periodo / max(1, meses_decorridos)) if despesas_periodo > 0 else 500.0
    reserva_pj_recomendada = round(despesa_media_mes * 3, 2)

    return {
        "teto_anual": TETO_ANUAL_MEI,
        "limite_mensal_proporcional": LIMITE_MENSAL_MEI,
        "faturamento_ano": round(faturamento_ano, 2),
        "percentual_teto": pct_consumido_teto,
        "saldo_restante_teto": saldo_restante_teto,
        "media_mensal": media_mensal,
        "projecao_fechamento_ano": projecao_fechamento_ano,
        "status_teto": status_teto,
        "status_titulo": status_titulo,
        "status_desc": status_desc,
        "alerta_migracao_me": alerta_migracao,
        "dias_ate_proximo_das": dias_ate_das,
        "data_proximo_das": data_das.strftime("%d/%m/%Y"),
        "das_estimado": 75.0,
        "lucro_no_bolso": round(lucro_no_bolso, 2),
        "pro_labore_sugerido": pro_labore_sugerido,
        "reserva_pj_recomendada": reserva_pj_recomendada
    }


# ==============================================================================
# 6. GERADOR DE SÉRIES MENSAIS E ANÁLISE DE SAZONALIDADE
# ==============================================================================

def gerar_series_mensais_detalhadas(df, col_data, mapeamento=None):
    """
    Agrupa os dados por mês (YYYY-MM), computando faturamento, despesas,
    lucro, margem, identificando melhor/pior mês e variação MoM (mês a mês).
    """
    if df.empty or not col_data or col_data not in df.columns:
        return {
            "meses": [],
            "faturamento": [],
            "despesas": [],
            "lucro": [],
            "margem": [],
            "itens_mensais": [],
            "melhor_mes": None,
            "pior_mes": None,
            "media_mensal_faturamento": 0.0,
            "media_mensal_lucro": 0.0,
            "volatilidade_receita": "Estável"
        }

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])
    df = df.sort_values(col_data)

    df["mes_ano"] = df[col_data].dt.strftime("%Y-%m")
    df["mes_nome"] = df[col_data].dt.strftime("%b/%y")

    from backend.home.home import obter_coluna_indicador
    if mapeamento is None:
        mapeamento = {}

    col_fat = obter_coluna_indicador(df, "faturamento", mapeamento, COL_FATURAMENTO)
    col_desp = obter_coluna_indicador(df, "despesa", mapeamento, COL_DESPESA)
    col_luc = obter_coluna_indicador(df, "lucro", mapeamento, COL_LUCRO)

    cols_converter = [c for c in [col_fat, col_desp, col_luc] if c and c in df.columns]
    for c in cols_converter:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)

    agrupado = df.groupby("mes_ano").agg({
        **{c: "sum" for c in cols_converter}
    }).reset_index()

    meses = []
    faturamento_list = []
    despesas_list = []
    lucro_list = []
    margem_list = []
    itens_mensais = []

    fat_ant = None
    for _, row in agrupado.iterrows():
        mes_str = str(row["mes_ano"])
        fat = float(row[col_fat]) if col_fat and col_fat in row else 0.0
        desp = float(row[col_desp]) if col_desp and col_desp in row else 0.0
        luc = float(row[col_luc]) if col_luc and col_luc in row else (fat - desp)
        mg = round((luc / fat * 100), 2) if fat > 0 else 0.0

        var_mom = variacao_percentual(fat_ant, fat) if fat_ant is not None else 0.0
        fat_ant = fat

        meses.append(mes_str)
        faturamento_list.append(round(fat, 2))
        despesas_list.append(round(desp, 2))
        lucro_list.append(round(luc, 2))
        margem_list.append(mg)

        itens_mensais.append({
            "mes": mes_str,
            "faturamento": round(fat, 2),
            "despesas": round(desp, 2),
            "lucro": round(luc, 2),
            "margem": mg,
            "variacao_mom": var_mom
        })

    # Identificar Melhor Mês e Pior Mês
    melhor_mes = None
    pior_mes = None
    if itens_mensais:
        melhor_item = max(itens_mensais, key=lambda x: x["lucro"])
        pior_item = min(itens_mensais, key=lambda x: x["lucro"])
        melhor_mes = {"mes": melhor_item["mes"], "lucro": melhor_item["lucro"], "faturamento": melhor_item["faturamento"]}
        pior_mes = {"mes": pior_item["mes"], "lucro": pior_item["lucro"], "faturamento": pior_item["faturamento"]}

    media_fat = round(float(np.mean(faturamento_list)), 2) if faturamento_list else 0.0
    media_luc = round(float(np.mean(lucro_list)), 2) if lucro_list else 0.0

    # Volatilidade (desvio padrão relativo)
    if len(faturamento_list) >= 3 and media_fat > 0:
        cv = (np.std(faturamento_list) / media_fat) * 100
        if cv < 15:
            volatilidade = "Baixa (Receita Muito Estável)"
        elif cv < 35:
            volatilidade = "Moderada (Oscilações Esperadas)"
        else:
            volatilidade = "Alta (Forte Sazonalidade)"
    else:
        volatilidade = "Estável"

    return {
        "meses": meses,
        "faturamento": faturamento_list,
        "despesas": despesas_list,
        "lucro": lucro_list,
        "margem": margem_list,
        "itens_mensais": itens_mensais,
        "melhor_mes": melhor_mes,
        "pior_mes": pior_mes,
        "media_mensal_faturamento": media_fat,
        "media_mensal_lucro": media_luc,
        "volatilidade_receita": volatilidade
    }


# ==============================================================================
# 7. SÍNTESE EXECUTIVA & PARECER DE IA PRÉ-AVALIADO
# ==============================================================================

def gerar_parecer_executivo_ia(estrutura, mei_data, cresc_fat, cresc_luc, is_mei=False):
    """
    Gera parecer do Diretor Financeiro / CFO Virtual fundamentado
    em números reais contábeis e de negócio, com foco diferenciado para MEI e ME.
    """
    fat = estrutura["receita_bruta"]
    luc = estrutura["lucro_liquido"]
    mg = estrutura["margem_liquida"]
    pe = estrutura["ponto_equilibrio"]
    imc = estrutura["indice_margem_contribuicao"]
    cobertura = estrutura["cobertura_custos_fixos"]

    pontos_fortes = []
    alertas_riscos = []
    recomendacoes = []

    if is_mei and mei_data:
        # Parecer para MEI
        teto_pct = mei_data["percentual_teto"]
        pro_labore = mei_data["pro_labore_sugerido"]
        reserva = mei_data["reserva_pj_recomendada"]

        if mg >= 30 and teto_pct < 75:
            veredito_titulo = "MEI com Alta Eficiência e Margem Segura"
            veredito_status = "positivo"
            veredito_badge = "Operação Muito Saudável"
            diagnostico = (
                f"Sua operação como MEI apresentou faturamento de R$ {fat:,.2f} com lucro real de R$ {luc:,.2f} "
                f"(margem de {mg}%). O enquadramento fiscal está seguro com {teto_pct}% do limite anual utilizado, "
                f"permitindo acumular reservas e crescer com tranquilidade."
            )
        elif teto_pct >= 80:
            veredito_titulo = "Atenção: Teto do MEI em Risco de Desenquadramento"
            veredito_status = "atencao"
            veredito_badge = "Alerta de Migração para ME"
            diagnostico = (
                f"O faturamento acumulado de R$ {mei_data['faturamento_ano']:,.2f} já consumiu {teto_pct}% "
                f"do teto anual de R$ 81.000,00. A projeção anual aponta fechamento em R$ {mei_data['projecao_fechamento_ano']:,.2f}. "
                f"É hora de planejar a transição para Microempresa (ME) para evitar impostos retroativos."
            )
        elif luc <= 0:
            veredito_titulo = "Alerta de Caixa: Lucro Negativo no Período"
            veredito_status = "critico"
            veredito_badge = "Ação Imediata Necessária"
            diagnostico = (
                f"As saídas do negócio superaram as entradas, gerando resultado deficitário de R$ {luc:,.2f}. "
                f"É urgente estancar gastos não essenciais e renegociar compras para proteger o caixa do microempreendedor."
            )
        else:
            veredito_titulo = "MEI Estável com Espaço para Fortalecimento"
            veredito_status = "neutro"
            veredito_badge = "Operação Controlada"
            diagnostico = (
                f"O negócio gerou R$ {fat:,.2f} em vendas com rentabilidade líquida de {mg}%. "
                f"O teto está em {teto_pct}% e o fluxo de caixa opera em equilíbrio com margem para expansão de ticket médio."
            )

        if mg > 20:
            pontos_fortes.append(f"Margem de lucro real de {mg}%, acima da média do setor.")
        if mei_data["saldo_restante_teto"] > 20000:
            pontos_fortes.append(f"Saldo restante do teto confortável: R$ {mei_data['saldo_restante_teto']:,.2f}.")
        if cresc_fat is not None and cresc_fat > 5:
            pontos_fortes.append(f"Crescimento de receita de +{cresc_fat}% em relação ao ciclo anterior.")

        if teto_pct > 75:
            alertas_riscos.append(f"Risco de ultrapassar o teto anual do MEI (consumo de {teto_pct}%).")
        if luc <= 0:
            alertas_riscos.append("Operação no período não gerou sobra financeira para o empreendedor.")
        alertas_riscos.append("Vigilância contínua para não misturar gastos pessoais (PF) com despesas da empresa (PJ).")

        recomendacoes.append({
            "titulo": "Definir Retirada Sustentável de Pró-Labore",
            "descricao": f"Transfira mensalmente até R$ {pro_labore:,.2f} para sua conta de Pessoa Física e guarde o restante na conta PJ.",
            "impacto": "Blindagem patrimonial e disciplina financeira",
            "prioridade": "Alta"
        })
        recomendacoes.append({
            "titulo": "Constituir Reserva de Emergência PJ",
            "descricao": f"Meta de capital de giro: R$ {reserva:,.2f} (equivalente a 3 meses de custos operacionais).",
            "impacto": "Garantia de liquidez contra imprevistos",
            "prioridade": "Média"
        })
        recomendacoes.append({
            "titulo": "Controle do Boleto DAS e Emissão de Notas",
            "descricao": f"Manter a guia DAS-MEI (vencimento dia 20) quitada em dia para manter benefícios previdenciários.",
            "impacto": "Regularidade fiscal e previdenciária",
            "prioridade": "Alta"
        })

    else:
        # Parecer para ME (Microempresa - Foco Contábil / CFO)
        if mg >= 20 and pe > 0 and fat >= pe * 1.3:
            veredito_titulo = "Operação Altamente Rentável e com Ampla Folga Operacional"
            veredito_status = "positivo"
            veredito_badge = "Alta Performance Contábil"
            diagnostico = (
                f"A empresa faturou R$ {fat:,.2f} com Lucro Líquido de R$ {luc:,.2f} (margem líquida de {mg}%). "
                f"O Ponto de Equilíbrio Contábil de R$ {pe:,.2f} foi superado com margem de segurança de {estrutura['margem_seguranca_operacional']}%, "
                f"e o EBITDA fechou em R$ {estrutura['ebitda']:,.2f} ({estrutura['margem_ebitda']}%)."
            )
        elif fat < pe and pe > 0:
            veredito_titulo = "Atenção: Faturamento Abaixo do Ponto de Equilíbrio"
            veredito_status = "critico"
            veredito_badge = "Risco de Queima de Caixa"
            diagnostico = (
                f"O faturamento de R$ {fat:,.2f} não foi suficiente para atingir o Ponto de Equilíbrio de R$ {pe:,.2f}. "
                f"A margem de contribuição de {imc}% não cobriu integralmente as despesas fixas de R$ {estrutura['despesas_fixas']:,.2f}, "
                f"resultando em déficit operacional de R$ {luc:,.2f}."
            )
        elif mg < 10:
            veredito_titulo = "Margem Líquida Comprimida por Custos Operacionais"
            veredito_status = "atencao"
            veredito_badge = "Eficiência sob Pressão"
            diagnostico = (
                f"O faturamento atingiu R$ {fat:,.2f}, porém a margem líquida fechou em {mg}%. "
                f"Os custos operacionais variáveis e fixos comprometeram {estrutura['eficiencia_operacional']}% da receita bruta. "
                f"É recomendada revisão de compras e otimização do índice de margem de contribuição ({imc}%)."
            )
        else:
            veredito_titulo = "Operação Equilibrada com Geração Operacional Positiva"
            veredito_status = "neutro"
            veredito_badge = "Estabilidade Contábil"
            diagnostico = (
                f"A empresa apresentou desempenho equilibrado com faturamento de R$ {fat:,.2f} e lucro de R$ {luc:,.2f} ({mg}%). "
                f"O índice de cobertura de custos fixos está em {cobertura}x, garantindo solvência no ciclo analisado."
            )

        if estrutura["margem_seguranca_operacional"] > 20:
            pontos_fortes.append(f"Margem de segurança operacional de {estrutura['margem_seguranca_operacional']}%, garantindo proteção contra quedas de receita.")
        if imc >= 40:
            pontos_fortes.append(f"Excelente Índice de Margem de Contribuição: {imc}%.")
        if estrutura["ebitda"] > 0:
            pontos_fortes.append(f"EBITDA positivo de R$ {estrutura['ebitda']:,.2f} ({estrutura['margem_ebitda']}% da receita).")

        if fat < pe and pe > 0:
            alertas_riscos.append(f"Faturamento atual R$ {pe - fat:,.2f} abaixo do ponto de equilíbrio contábil.")
        if cobertura < 1.1 and cobertura > 0:
            alertas_riscos.append(f"Cobertura de despesas fixas frágil ({cobertura}x), vulnerável a choques de demanda.")
        if estrutura["eficiencia_operacional"] > 85:
            alertas_riscos.append(f"Estrutura de gastos consome {estrutura['eficiencia_operacional']}% da receita bruta.")

        recomendacoes.append({
            "titulo": "Otimizar Margem de Contribuição por Produto/Serviço",
            "descricao": f"Aumentar o índice de MC atual de {imc}% renegociando com fornecedores e promovendo itens de maior margem.",
            "impacto": "Elevação imediata do EBITDA e redução do Ponto de Equilíbrio",
            "prioridade": "Alta"
        })
        recomendacoes.append({
            "titulo": "Auditar e Conter Despesas Fixas Estruturais",
            "descricao": f"Mapear despesas fixas (atuais R$ {estrutura['despesas_fixas']:,.2f}) visando redução de 8% a 12% em contratos recorrentes.",
            "impacto": "Queda no faturamento mínimo necessário para atingir o lucro",
            "prioridade": "Alta"
        })
        recomendacoes.append({
            "titulo": "Planejamento Tributário & Enquadramento Simples Nacional",
            "descricao": f"Acompanhar a alíquota efetiva (estimada em {estrutura['impostos_aliquota_efetiva']}%) e planejar compras de insumos para compensações.",
            "impacto": "Economia contábil e conformidade fiscal",
            "prioridade": "Média"
        })

    return {
        "veredito_titulo": veredito_titulo,
        "veredito_status": veredito_status,
        "veredito_badge": veredito_badge,
        "diagnostico_executivo": diagnostico,
        "pontos_fortes": pontos_fortes or ["Estrutura financeira mantendo consistência operacional."],
        "alertas_riscos": alertas_riscos or ["Monitorar evolução das despesas operacionais no próximo ciclo."],
        "recomendacoes": recomendacoes
    }


# ==============================================================================
# 8. PERSISTÊNCIA E CONSULTA DE PERÍODO
# ==============================================================================

def salvar_ultimo_periodo(user, inicio, fim, tabela_id="todas"):
    """Persiste o último período analisado e tabela na sessão, na coleção de usuários e na coleção de dados."""
    try:
        from flask import session
        session['analise_selecionada'] = {
            "periodo_inicio": inicio,
            "periodo_fim": fim,
            "tabela_id": tabela_id
        }
        ids_user = [str(user)]
        if ObjectId.is_valid(str(user)):
            ids_user.append(ObjectId(str(user)))
        dados_colecao.update_many(
            {"usuario_id": {"$in": ids_user}},
            {"$set": {"ultimo_periodo": {"inicio": inicio, "fim": fim, "tabela_id": tabela_id}}}
        )
        if ObjectId.is_valid(user):
            usuarios_colecao.update_one(
                {"_id": ObjectId(user)},
                {"$set": {"ultimo_periodo": {"inicio": inicio, "fim": fim, "tabela_id": tabela_id}}}
            )
    except Exception as e:
        print(f"[salvar_ultimo_periodo] Erro: {e}")


def obter_ultimo_periodo():
    """Recupera o último período analisado buscando na sessão ou nas coleções do banco."""
    user = session.get("usuario_id")
    if not user:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    if "analise_selecionada" in session:
        return jsonify(session["analise_selecionada"]), 200

    ids_user = [str(user)]
    if ObjectId.is_valid(str(user)):
        ids_user.append(ObjectId(str(user)))

    if ObjectId.is_valid(user):
        u_doc = usuarios_colecao.find_one({"_id": ObjectId(user)})
        if u_doc and "ultimo_periodo" in u_doc:
            return jsonify(u_doc["ultimo_periodo"]), 200

    doc = dados_colecao.find_one({"usuario_id": {"$in": ids_user}}, sort=[("atualizado_em", -1), ("criado_em", -1)])
    if doc and "ultimo_periodo" in doc:
        return jsonify(doc["ultimo_periodo"]), 200

    return jsonify({}), 200


# ==============================================================================
# 9. ENDPOINTS DA CENTRAL DE ANÁLISE
# ==============================================================================

def obter_limites_datas_analise():
    """
    Retorna o intervalo real de datas presentes nos dados da planilha selecionada (ou consolidado)
    para que os filtros rápidos (7 dias, 30 dias, etc.) usem a data real da tabela como referência.
    """
    user = session.get("usuario_id")
    if not user:
        return jsonify({"mensagem": "Não autenticado"}), 401

    tabela_id = request.args.get("tabela_id", "todas")

    try:
        from backend.home.home import obter_colunas_mapeadas
        mapeamento = obter_colunas_mapeadas(user)

        from backend.dados.agregador import obter_contexto_dados
        contexto = {}
        for tentativa in range(3):
            try:
                contexto = obter_contexto_dados(user, escopo=tabela_id, mapeamento=mapeamento)
                break
            except Exception as e_db:
                if tentativa < 2:
                    import time
                    time.sleep(0.4)
                else:
                    raise e_db

        dados = contexto.get("dados", [])
        if not dados:
            hoje_dt = datetime.now()
            return jsonify({
                "tem_dados": False,
                "data_minima": (hoje_dt - timedelta(days=90)).strftime("%Y-%m-%d"),
                "data_maxima": hoje_dt.strftime("%Y-%m-%d"),
                "ano_maximo": hoje_dt.year,
                "anos_disponiveis": [hoje_dt.year]
            }), 200

        df = pd.DataFrame(dados)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        if not col_data or col_data not in df.columns:
            hoje_dt = datetime.now()
            return jsonify({
                "tem_dados": True,
                "coluna_data": None,
                "data_minima": (hoje_dt - timedelta(days=90)).strftime("%Y-%m-%d"),
                "data_maxima": hoje_dt.strftime("%Y-%m-%d"),
                "ano_maximo": hoje_dt.year,
                "anos_disponiveis": [hoje_dt.year]
            }), 200

        datas = pd.to_datetime(df[col_data], errors="coerce").dropna()
        if datas.empty:
            hoje_dt = datetime.now()
            return jsonify({
                "tem_dados": True,
                "coluna_data": col_data,
                "data_minima": (hoje_dt - timedelta(days=90)).strftime("%Y-%m-%d"),
                "data_maxima": hoje_dt.strftime("%Y-%m-%d"),
                "ano_maximo": hoje_dt.year,
                "anos_disponiveis": [hoje_dt.year]
            }), 200

        min_dt = datas.min()
        max_dt = datas.max()
        anos = sorted(list(set(datas.dt.year.unique().tolist())))

        return jsonify({
            "tem_dados": True,
            "coluna_data": col_data,
            "data_minima": min_dt.strftime("%Y-%m-%d"),
            "data_maxima": max_dt.strftime("%Y-%m-%d"),
            "ano_maximo": int(max_dt.year),
            "anos_disponiveis": [int(a) for a in anos]
        }), 200

    except Exception as e:
        print(f"[obter_limites_datas_analise] Erro: {e}")
        return jsonify({"mensagem": str(e)}), 500


def analise_por_periodo():
    """
    Endpoint principal e completo para a Central de Análise:
    Calcula KPIs, estrutura contábil (DRE, EBITDA, Break-Even),
    monitoramento MEI vs ME, séries mensais, comparações e parecer de IA.
    """
    user = session.get("usuario_id")
    if not user:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    perfil_usuario = session.get("usuario_perfil")
    if not perfil_usuario:
        user_doc = usuarios_colecao.find_one({"_id": ObjectId(user)}) if ObjectId.is_valid(user) else None
        perfil_usuario = (user_doc.get("tipo_perfil") if user_doc else None) or "ME"

    is_mei = (str(perfil_usuario).strip().upper() == "MEI")

    data_inicio_str = request.args.get("data_inicio", "")
    data_fim_str = request.args.get("data_fim", "")

    if not data_inicio_str or not data_fim_str:
        hoje = datetime.now()
        data_fim_str = hoje.strftime("%Y-%m-%d")
        data_inicio_str = (hoje - timedelta(days=90)).strftime("%Y-%m-%d")

    try:
        data_inicio = datetime.strptime(data_inicio_str, "%Y-%m-%d")
        data_fim = datetime.strptime(data_fim_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"mensagem": "Formato de data inválido. Use YYYY-MM-DD"}), 400

    if data_inicio > data_fim:
        return jsonify({"mensagem": "A data inicial não pode ser superior à final"}), 400

    try:
        tabela_id = request.args.get("tabela_id", "todas")

        from backend.home.home import obter_colunas_mapeadas
        mapeamento = obter_colunas_mapeadas(user)

        from backend.dados.agregador import obter_contexto_dados
        contexto = {}
        for tentativa in range(3):
            try:
                contexto = obter_contexto_dados(user, escopo=tabela_id, mapeamento=mapeamento)
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
                "mensagem": "Nenhum dado encontrado",
                "perfil": perfil_usuario,
                "is_mei": is_mei
            }), 200

        df = pd.DataFrame(dados)
        if df.empty:
            return jsonify({
                "mensagem": "Nenhum dado encontrado",
                "perfil": perfil_usuario,
                "is_mei": is_mei
            }), 200

        # Encontrar coluna de data (mapeada ou detectada)
        col_data = mapeamento.get("data")
        if not col_data or col_data not in df.columns:
            col_data = encontrar_coluna_data(df)

        # 1. Período Atual e Período Anterior equivalente
        df_atual = filtrar_por_periodo(df, col_data, data_inicio, data_fim)

        duracao_dias = (data_fim - data_inicio).days + 1
        fim_ant = data_inicio - timedelta(days=1)
        inicio_ant = fim_ant - timedelta(days=duracao_dias - 1)
        df_ant = filtrar_por_periodo(df, col_data, inicio_ant, fim_ant)

        # 2. Estrutura Contábil Atual e Anterior
        estrutura_atual = calcular_estrutura_contabil(df_atual, mapeamento, is_mei=is_mei)
        estrutura_ant = calcular_estrutura_contabil(df_ant, mapeamento, is_mei=is_mei)

        fat = estrutura_atual["receita_bruta"]
        fat_a = estrutura_ant["receita_bruta"]
        var_fat = variacao_percentual(fat_a, fat)

        desp = estrutura_atual["despesas_totais"]
        desp_a = estrutura_ant["despesas_totais"]
        var_desp = variacao_percentual(desp_a, desp)

        luc = estrutura_atual["lucro_liquido"]
        luc_a = estrutura_ant["lucro_liquido"]
        var_luc = variacao_percentual(luc_a, luc)

        mg = estrutura_atual["margem_liquida"]
        mg_a = estrutura_ant["margem_liquida"]
        var_mg = round(mg - mg_a, 2)

        # 3. Séries Temporais Mensais e Sazonalidade
        series_mensais = gerar_series_mensais_detalhadas(df_atual, col_data, mapeamento)

        # 4. Módulo MEI (se aplicável ou informativo)
        ano_analise = data_fim.year
        metricas_mei = calcular_metricas_mei(df, col_data, fat, desp, luc, ano_referencia=ano_analise)

        # 5. Parecer Executivo de IA
        parecer_ia = gerar_parecer_executivo_ia(estrutura_atual, metricas_mei, var_fat, var_luc, is_mei=is_mei)

        # 6. Salvar histórico e período
        salvar_ultimo_periodo(user, data_inicio_str, data_fim_str, tabela_id=tabela_id)

        # Limites reais de data da base/planilha
        datas_base = pd.to_datetime(df[col_data], errors="coerce").dropna() if (col_data and col_data in df.columns) else pd.Series([], dtype='datetime64[ns]')
        if not datas_base.empty:
            limites_datas = {
                "data_minima": datas_base.min().strftime("%Y-%m-%d"),
                "data_maxima": datas_base.max().strftime("%Y-%m-%d"),
                "ano_maximo": int(datas_base.max().year),
                "anos_disponiveis": [int(a) for a in sorted(list(set(datas_base.dt.year.unique().tolist())))]
            }
        else:
            limites_datas = {
                "data_minima": data_inicio_str,
                "data_maxima": data_fim_str,
                "ano_maximo": data_fim.year,
                "anos_disponiveis": [data_fim.year]
            }

        # 7. Formatação ApexCharts Principal
        grafico_dados = {
            "labels": series_mensais["meses"],
            "series": [
                {"name": "Faturamento", "data": series_mensais["faturamento"]},
                {"name": "Despesas", "data": series_mensais["despesas"]},
                {"name": "Lucro Líquido", "data": series_mensais["lucro"]},
                {"name": "Margem (%)", "data": series_mensais["margem"]}
            ]
        }

        # 8. Gráfico de Composição de Despesas
        custo_var = estrutura_atual["custos_variaveis"]
        gasto_fix = estrutura_atual["despesas_fixas"]
        imp = estrutura_atual["impostos_deducoes"]
        outros_gastos = max(0.0, desp - (custo_var + gasto_fix + imp))

        composicao_despesas = {
            "labels": ["Custos Operacionais/CMV", "Despesas Fixas", "Tributos & Impostos", "Outros Custos"],
            "valores": [custo_var, gasto_fix, imp, outros_gastos]
        }

        return jsonify({
            "sucesso": True,
            "perfil": perfil_usuario,
            "is_mei": is_mei,
            "limites_datas": limites_datas,
            "periodo": {
                "inicio": data_inicio_str,
                "fim": data_fim_str,
                "inicio_anterior": inicio_ant.strftime("%Y-%m-%d"),
                "fim_anterior": fim_ant.strftime("%Y-%m-%d"),
                "dias": duracao_dias
            },
            "faturamento": {
                "valor": fat,
                "valor_anterior": fat_a,
                "variacao": var_fat
            },
            "despesa": {
                "valor": desp,
                "valor_anterior": desp_a,
                "variacao": var_desp
            },
            "lucro": {
                "valor": luc,
                "valor_anterior": luc_a,
                "variacao": var_luc
            },
            "margem": {
                "valor": mg,
                "valor_anterior": mg_a,
                "variacao": var_mg
            },
            "contabil": estrutura_atual,
            "contabil_anterior": estrutura_ant,
            "mei": metricas_mei,
            "visao_mensal": series_mensais,
            "parecer_ia": parecer_ia,
            "grafico": grafico_dados,
            "composicao_despesas": composicao_despesas
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"mensagem": f"Erro interno ao processar análise: {str(e)}"}), 500