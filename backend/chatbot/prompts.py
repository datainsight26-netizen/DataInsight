# ==============================================================================
# prompts.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.
#
# Módulo de prompts isolados para IA (Gemini / Orquestrador) — DataInsight.
# Centraliza todos os prompts de análise financeira, diagnósticos e planejamento.

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import json


# ==============================================================================
# 2. FORMATAÇÃO DE VALORES
# ==============================================================================

def formatar_moeda_brl(val):
    """Formata valor float/int/str para BRL: R$ 1.234,56"""
    try:
        n = float(val)
        return f"R$ {n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "R$ 0,00"


def formatar_percentual(val):
    """Formata valor float/int/str para percentual: 12,5%"""
    try:
        n = float(val)
        return f"{n:.1f}%".replace(".", ",")
    except Exception:
        return "0,0%"


# ==============================================================================
# 3. PROMPT DE PLANEJAMENTO FINANCEIRO (12 MESES)
# ==============================================================================

def gerar_prompt_planejamento(scenario, ia_data):
    """
    Gera o prompt analítico executivo para o Planejamento Financeiro de 12 Meses.
    """
    # --------------------------------------------------------------------------
    # 3.1 Extração defensiva dos dados de entrada
    # --------------------------------------------------------------------------
    totals = ia_data.get("totals", {}) if isinstance(ia_data, dict) else {}
    meses = ia_data.get("meses", []) if isinstance(ia_data, dict) else []
    best = ia_data.get("best") if isinstance(ia_data, dict) else None
    worst = ia_data.get("worst") if isinstance(ia_data, dict) else None
    meses_pos = ia_data.get("mesesPos", 0) if isinstance(ia_data, dict) else 0

    # --------------------------------------------------------------------------
    # 3.2 Formatação dos totais anuais
    # --------------------------------------------------------------------------
    receita_total = formatar_moeda_brl(totals.get("receita", 0))
    impostos_total = formatar_moeda_brl(totals.get("impostos", 0))
    variaveis_total = formatar_moeda_brl(totals.get("variaveis", 0))
    gastos_fixos_total = formatar_moeda_brl(totals.get("fixos", 0))
    margem_total = formatar_moeda_brl(totals.get("margem", 0))
    margem_pct_total = formatar_percentual(totals.get("margemPct", 0))
    investimentos_total = formatar_moeda_brl(totals.get("investimentos", 0))
    resultado_total = formatar_moeda_brl(totals.get("resultado", 0))

    # --------------------------------------------------------------------------
    # 3.3 Detalhamento mensal
    # --------------------------------------------------------------------------
    detalhes_mensais_list = []
    for m in meses:
        detalhes_mensais_list.append(
            f"- {m.get('mes')}: Receita: {formatar_moeda_brl(m.get('receita'))} | "
            f"Var: {formatar_moeda_brl(m.get('variaveis'))} | "
            f"Fix: {formatar_moeda_brl(m.get('fixos'))} | "
            f"Res: {formatar_moeda_brl(m.get('resultado'))}"
        )
    detalhes_mensais_str = "\n".join(detalhes_mensais_list)

    # --------------------------------------------------------------------------
    # 3.4 Montagem do prompt
    # --------------------------------------------------------------------------
    prompt = f"""Você é um analista financeiro sênior da equipe DataInsight.
Analise os dados reais do Planejamento Financeiro do cliente (Cenário: {scenario}):

RESUMO ANUAL:
- Faturamento / Receita Total: {receita_total}
- Impostos Totais: {impostos_total}
- Gastos Variáveis Totais: {variaveis_total}
- Gastos Fixos Totais: {gastos_fixos_total}
- Margem de Contribuição Total: {margem_total} ({margem_pct_total})
- Investimentos Totais: {investimentos_total}
- Resultado Líquido Projetado: {resultado_total}
- Meses no Azul / Positivos: {meses_pos}/{len(meses)}
"""
    if best:
        prompt += f"- Melhor Mês: {best.get('mes')} ({formatar_moeda_brl(best.get('resultado'))})\n"
    if worst:
        prompt += f"- Pior Mês: {worst.get('mes')} ({formatar_moeda_brl(worst.get('resultado'))})\n"

    prompt += f"""
DETALHAMENTO MENSAL:
{detalhes_mensais_str}

Com base nestes dados reais da Tabela Mensal, faça um diagnóstico financeiro executivo estruturado.
Você deve retornar obrigatoriamente um objeto JSON válido, contendo exatamente os três campos descritos abaixo.
Atenção: Não utilize markdown (como ```json) ou qualquer texto antes/depois do JSON. Retorne apenas o JSON puro para que possamos fazer o parsing diretamente.

Formato do JSON esperado:
{{
  "diagnostico_geral": "Um diagnóstico resumido e profissional da saúde financeira geral para este cenário. Use termos técnicos e seja analítico (limite de 3 a 4 linhas).",
  "alertas_riscos": "Indique os pontos críticos, custos elevados, meses com prejuízo ou ameaças específicas encontradas nos dados mensais (limite de 3 a 4 linhas).",
  "recomendacoes": [
    "Recomendação prática 1 baseada nos dados",
    "Recomendação prática 2 baseada nos dados",
    "Recomendação prática 3 baseada nos dados"
  ]
}}
"""
    return prompt


# ==============================================================================
# 4. PROMPT DE ANÁLISE POR PÁGINA
# ==============================================================================

def gerar_prompt_analise_pagina(pagina, contexto, periodo, origem, is_usuario_mei):
    """
    Gera prompt especializado para análise com IA de cada painel do sistema.
    """

    # --------------------------------------------------------------------------
    # 4.1 Controles Essenciais (MEI)
    # --------------------------------------------------------------------------
    if pagina in ["controles_essenciais", "controles-essenciais"]:
        fat_ano = contexto.get("faturamento_ano", "R$ 0,00")
        teto = contexto.get("teto_mei", "R$ 81.000,00")
        pct_teto = contexto.get("percentual_teto", "0.0%")
        status_teto = contexto.get("status_teto", "seguro")
        ent_mes = contexto.get("entradas_mes", "R$ 0,00")
        sai_mes = contexto.get("saidas_mes", "R$ 0,00")
        luc_mes = contexto.get("lucro_mes", "R$ 0,00")
        sld_atual = contexto.get("saldo_atual", "R$ 0,00")
        das_pago = contexto.get("das_pago", "R$ 0,00")

        prompt = f"""Você é o Mentor Financeiro e Consultor Especialista em MEI da plataforma DataInsight.
Analise a situação de caixa e o enquadramento fiscal do microempreendedor individual:
- Período Analisado: {periodo}
- Faturamento Acumulado no Ano: {fat_ano}
- Teto Anual Permitido do MEI: {teto} (Utilizado: {pct_teto} - Situação: {status_teto})
- Entradas do Mês (Vendas e Serviços Prestados): {ent_mes}
- Saídas do Mês (Compras, Despesas Operacionais e DAS): {sai_mes} (Guia DAS: {das_pago})
- Lucro Líquido Real que sobrou no bolso: {luc_mes}
- Saldo Disponível em Caixa: {sld_atual}

DIRETRIZES DA ANÁLISE PARA O MEI:
1. Use uma linguagem humana, acessível, acolhedora e encorajadora. NUNCA use jargões difíceis (proibido usar DRE, EBITDA, CAPEX, WACC, goodwill).
2. Diga com clareza se o mês foi lucrativo e se o saldo atual em caixa garante tranquilidade.
3. Avalie o limite de faturamento anual do MEI (R$ 81.000). Se estiver acima de 70%, oriente com antecedência sobre o planejamento de transição para Microempresa (ME) para evitar multas da Receita Federal.
4. Reforce a importância de não misturar a conta física (PF) com a da empresa (PJ), recomendando definir uma retirada mensal de pró-labore.
5. Relembre o pagamento pontual do boleto DAS-MEI (todo dia 20) para assegurar a cobertura do INSS (aposentadoria, auxílio-doença).
"""

    # --------------------------------------------------------------------------
    # 4.2 Home / Centro de Inteligência IA
    # --------------------------------------------------------------------------
    elif pagina in ["home", "ia"]:
        fat = contexto.get("faturamento", "R$ 0,00")
        fat_pct = contexto.get("faturamento_pct", "0.0%")
        luc = contexto.get("lucro", "R$ 0,00")
        luc_pct = contexto.get("lucro_pct", "0.0%")
        desp = contexto.get("despesas", "R$ 0,00")
        desp_pct = contexto.get("despesas_pct", "0.0%")
        cresc = contexto.get("crescimento", "0.0%")

        nome_painel = "Centro de Inteligência IA" if pagina == "ia" else "Visão Geral (Home)"

        if is_usuario_mei:
            prompt = f"""Você é o Mentor Financeiro Especialista em MEI da plataforma DataInsight.
Analise a saúde do microempreendedor individual no painel {nome_painel}:
- Período Selecionado: {periodo}
- Entradas / Faturamento: {fat} ({fat_pct})
- Lucro Real no Bolso: {luc} ({luc_pct})
- Despesas e Custos: {desp} ({desp_pct})
- Crescimento Global: {cresc}

DIRETRIZES PARA O MEI:
1. Fale de forma simples, direta e empática com o microempreendedor individual, sem termos técnicos complicados.
2. Destaque o quanto realmente sobrou no bolso (lucro líquido) após pagar fornecedores e despesas.
3. Lembre da vigilância permanente do teto anual do MEI de R$ 81.000,00 e de nunca misturar despesas pessoais com o caixa da empresa.
"""
        else:
            prompt = f"""Você é o consultor de BI executivo, CFO virtual e estrategista da plataforma DataInsight.
Analise a performance financeira e estratégica consolidada no painel {nome_painel}:
- Fonte de Dados / Tabela Analisada: {origem}
- Período Selecionado: {periodo}
- Faturamento Bruto: {fat} (Variação: {fat_pct})
- Lucro Líquido: {luc} (Margem/Variação: {luc_pct})
- Despesas Operacionais: {desp} (Variação: {desp_pct})
- Crescimento Global: {cresc}
"""

    # --------------------------------------------------------------------------
    # 4.3 Dados (Governança / Engenharia de Dados)
    # --------------------------------------------------------------------------
    elif pagina == "dados":
        total_linhas = contexto.get("total_linhas", "0")
        total_colunas = contexto.get("total_colunas", "0")
        taxa_preenchimento = contexto.get("taxa_preenchimento", "100%")
        tabela_ativa = contexto.get("tabela_ativa", origem)
        colunas = contexto.get("colunas", [])
        colunas_str = ", ".join(colunas) if colunas else "Schema contábil principal"

        prompt = f"""Você é o auditor de governança financeira e engenharia de dados da plataforma DataInsight.
Analise a volumetria e integridade da base contábil/financeira do cliente:
- Tabela / Base Analisada: {tabela_ativa}
- Período de Análise: {periodo}
- Total de Lançamentos Registrados: {total_linhas}
- Atributos Mapeados: {total_colunas} ({colunas_str})
- Índice de Completude dos Lançamentos: {taxa_preenchimento}
"""

    # --------------------------------------------------------------------------
    # 4.4 Análises (MEI vs. ME)
    # --------------------------------------------------------------------------
    elif pagina == "analises":
        data_inicio = contexto.get("data_inicio", "Início")
        data_fim = contexto.get("data_fim", "Fim")
        fat_val = contexto.get("faturamento", {}).get("valor", contexto.get("faturamento", "R$ 0,00"))
        fat_var = contexto.get("faturamento", {}).get("variacao", "0.0%")
        luc_val = contexto.get("lucro", {}).get("valor", contexto.get("lucro", "R$ 0,00"))
        luc_var = contexto.get("lucro", {}).get("variacao", "0.0%")
        desp_val = contexto.get("despesa", {}).get("valor", contexto.get("despesas", "R$ 0,00"))
        mg_val = contexto.get("margem", {}).get("valor", contexto.get("margem", "0.0%"))
        contabil = contexto.get("contabil", {})
        mei_info = contexto.get("mei", {})

        if is_usuario_mei:
            teto_ano = mei_info.get("faturamento_ano", fat_val)
            pct_teto = mei_info.get("percentual_teto", "0%")
            status_teto = mei_info.get("status_titulo", "Seguro")
            saldo_teto = mei_info.get("saldo_restante_teto", "R$ 81.000,00")
            pro_labore = mei_info.get("pro_labore_sugerido", luc_val)
            reserva = mei_info.get("reserva_pj_recomendada", "R$ 1.500,00")

            prompt = f"""Você é o Mentor Financeiro Especialista em MEI e Gestão de Microempresas da plataforma DataInsight.
Analise a saúde contábil, financeira e enquadramento fiscal do microempreendedor individual:
- Fonte / Tabela Analisada: {origem}
- Período Selecionado: {periodo} (De {data_inicio} até {data_fim})
- Faturamento do Período: R$ {fat_val} (Variação: {fat_var}%)
- Despesas e Custos Totais: R$ {desp_val}
- Lucro Real no Bolso: R$ {luc_val} (Margem Líquida: {mg_val}%)
- Faturamento Acumulado no Ano: R$ {teto_ano} (Consumo do Teto de R$ 81.000: {pct_teto} - Situação: {status_teto})
- Saldo Restante do Teto Anual: R$ {saldo_teto}
- Sugestão de Retirada Pró-Labore Pessoal: R$ {pro_labore}
- Sugestão de Reserva de Emergência PJ: R$ {reserva}

DIRETRIZES DA ANÁLISE PARA O MEI:
1. Avalie com linguagem clara e encorajadora o lucro real que sobrou no bolso do microempreendedor.
2. Destaque o termômetro do teto de R$ 81.000, orientando se há risco de desenquadramento e quando começar a planejar a transição para Microempresa (ME).
3. Reforce a regra de ouro de não misturar finanças pessoais (PF) com despesas da empresa (PJ).
4. Recomende ações práticas para aumentar o ticket médio e pontualidade no pagamento do DAS.
"""
        else:
            pe_val = contabil.get("ponto_equilibrio", "—")
            pe_status = contabil.get("ponto_equilibrio_status", "atingido")
            imc_val = contabil.get("indice_margem_contribuicao", "—")
            marg_seg = contabil.get("margem_seguranca_operacional", "—")
            ebitda_val = contabil.get("ebitda", "—")
            marg_ebitda = contabil.get("margem_ebitda", "—")
            cobertura_fix = contabil.get("cobertura_custos_fixos", "—")
            desp_fix = contabil.get("despesas_fixas", "—")
            cust_var = contabil.get("custos_variaveis", "—")

            prompt = f"""Você é o CFO virtual, auditor de controladoria e consultor contábil executivo da plataforma DataInsight.
Analise a Demonstração de Resultados (DRE), Ponto de Equilíbrio e Performance Contábil da empresa (ME):
- Fonte / Tabela Analisada: {origem}
- Período Selecionado: {periodo} (De {data_inicio} até {data_fim})
- Receita Operacional Bruta: R$ {fat_val} (Variação: {fat_var}%)
- Custos Operacionais / CMV: R$ {cust_var}
- Despesas Fixas e Estruturais: R$ {desp_fix}
- EBITDA / LAJIDA Gerencial: R$ {ebitda_val} (Margem EBITDA: {marg_ebitda}%)
- Lucro Líquido do Exercício: R$ {luc_val} (Margem Líquida: {mg_val}%)
- Ponto de Equilíbrio Contábil (Break-even): R$ {pe_val} (Situação: {pe_status})
- Índice de Margem de Contribuição (IMC): {imc_val}%
- Margem de Segurança Operacional: {marg_seg}%
- Índice de Cobertura de Despesas Fixas: {cobertura_fix}x

DIRETRIZES DA ANÁLISE CONTÁBIL PARA ME:
1. Forneça um diagnóstico de alto nível executivo (linguagem de CFO / Controladoria), analisando a DRE gerencial e a margem operacional.
2. Analise se a receita supera com segurança o Ponto de Equilíbrio e qual a solidez da Margem de Contribuição.
3. Avalie a rigidez das despesas fixas e o índice de cobertura de custos.
4. Apresente 3 recomendações estratégicas priorizadas para alavancar EBITDA, otimizar custos e maximizar geração de caixa.
"""

    # --------------------------------------------------------------------------
    # 4.5 Dashboard / Gráficos Avançados
    # --------------------------------------------------------------------------
    elif pagina in ["dashboard", "graficos-avancados"]:
        periodo_sel = contexto.get("periodo_selecionado", periodo)
        indicadores = contexto.get("indicadores", [])
        if isinstance(indicadores, list) and len(indicadores) > 0:
            ind_str = ", ".join([
                f"{i.get('label', 'Métrica')}: {i.get('valor', '—')}"
                for i in indicadores if isinstance(i, dict)
            ])
        else:
            ind_str = "Faturamento Total, Pedidos, Ticket Médio, Margem Bruta e Gastos"

        prompt = f"""Você é o CFO virtual e consultor executivo da plataforma DataInsight.
Analise o painel gerencial (Dashboard / Gráficos Avançados):
- Fonte de Dados / Tabela Analisada: {origem}
- Período Selecionado: {periodo_sel}
- Indicadores Gerenciais do Painel: {ind_str}
"""

    # --------------------------------------------------------------------------
    # 4.6 Planejamento Financeiro (12 meses)
    # --------------------------------------------------------------------------
    elif pagina in ["planejamento", "analise_planejamento_adaptado"]:
        cenario = contexto.get("cenario", "Provável")
        aba = contexto.get("aba_ativa", "Visão Geral")
        rec_tot = contexto.get("receita_total", "—")
        imp_tot = contexto.get("impostos_total", "—")
        gast_var = contexto.get("gastos_variaveis", "—")
        marg_pct = contexto.get("margem_percentual", "—")
        gast_fix = contexto.get("gastos_fixos", "—")
        res_anu = contexto.get("resultado_anual", "—")

        prompt = f"""Você é o CFO virtual e diretor financeiro estratégico da plataforma DataInsight.
Analise a projeção e viabilidade do Planejamento Financeiro de 12 Meses:
- Fonte de Dados / Tabela Analisada: {origem}
- Cenário Selecionado: {cenario.upper()}
- Aba / Módulo em Foco: {aba}
- Projeção de Receita Total (12 meses): {rec_tot}
- Impostos Projetados: {imp_tot}
- Gastos Variáveis Projetados: {gast_var}
- Margem de Contribuição Média: {marg_pct}
- Gastos Fixos Projetados: {gast_fix}
- Resultado Anual Projetado (Lucro Líquido): {res_anu}
"""

    # --------------------------------------------------------------------------
    # 4.7 Fluxo de Caixa
    # --------------------------------------------------------------------------
    elif pagina in ["fluxo_caixa", "fluxo-caixa"]:
        entradas = contexto.get("entradas", "R$ 0,00")
        saidas = contexto.get("saidas", "R$ 0,00")
        saldo = contexto.get("saldo", "R$ 0,00")
        maior_cat = contexto.get("maior_categoria", "Geral")

        prompt = f"""Você é o especialista em tesouraria e gestão de fluxo de caixa da plataforma DataInsight.
Analise a liquidez e disponibilidade de caixa da empresa:
- Fonte de Dados / Tabela Analisada: {origem}
- Período Selecionado: {periodo}
- Entradas Totais de Caixa (Recebimentos): {entradas}
- Saídas Totais de Caixa (Desembolsos): {saidas}
- Saldo Líquido do Período: {saldo}
- Categoria / Destaque de Custo/Ganho: {maior_cat}
"""

    # --------------------------------------------------------------------------
    # 4.8 Fallback genérico (páginas não mapeadas)
    # --------------------------------------------------------------------------
    else:
        prompt = f"""Você é o analista sênior de negócios e inteligência financeira da plataforma DataInsight.
Analise o desempenho corporativo da página {pagina}:
- Fonte de Dados / Tabela Analisada: {origem}
- Período Selecionado: {periodo}
- Contexto dos Dados: {json.dumps(contexto, ensure_ascii=False)}
"""

    # --------------------------------------------------------------------------
    # 4.9 Regras obrigatórias + contrato JSON (aplicadas a todos os ramos)
    # --------------------------------------------------------------------------
    prompt += f"""
REGRAS OBRIGATÓRIAS DE DIAGNÓSTICO FINANCEIRO:
1. NUNCA faça meta-descrições da página ou da interface web (proibido usar expressões como "a análise da página", "foram encontradas 250 linhas", "botão na tela" ou "cartões no HTML").
2. NUNCA mencione termos técnicos como: MongoDB, banco de dados, RAG, contexto recuperado, coleção, query, API, backend, dataset, chunk, embedding, LLM, Gemini, modelo de linguagem.
3. Faça uma análise executiva direta, séria e aprofundada SOBRE A SAÚDE DO NEGÓCIO da empresa na fonte '{origem}' no período '{periodo}'.
4. Fundamente suas conclusões citando explicitamente os números reais (valores em R$ e porcentagens %).
5. Destaque pontos fortes da operação, alertas operacionais/riscos de caixa e RECOMENDAÇÕES ESTRATÉGICAS acionáveis para o empresário tomar decisões imediatas.

Você deve retornar OBRIGATORIAMENTE apenas um objeto JSON válido, sem formatação de markdown (sem ```json), no seguinte formato exato:
{{
  "veredito_titulo": "Título executivo impactante (ex: Operação com Alta Margem e Excelente Liquidez)",
  "veredito_subtitulo": "Subtítulo direto indicando o diagnóstico para {origem} no período {periodo}",
  "veredito_badge": "Alta Performance | Operação Saudável | Atenção Financeira | Risco de Liquidez",
  "veredito_status": "positivo | neutro | atencao | critico",
  "diagnostico_geral": "Diagnóstico analítico aprofundado em 3 a 4 frases, citando os valores (R$, %) reais fornecidos para fundamentar a situação do negócio.",
  "pontos_fortes": [
    "Ponto forte do negócio 1 fundamentado nos números reais",
    "Ponto forte do negócio 2 fundamentado nos números reais"
  ],
  "alertas_riscos": [
    "Alerta operacional ou risco financeiro 1 identificado",
    "Alerta operacional ou risco financeiro 2 identificado"
  ],
  "recomendacoes": [
    "Recomendação/Decisão estratégica 1 para alavancar receita ou margem",
    "Recomendação/Decisão estratégica 2 para contenção de perdas/custos",
    "Recomendação/Decisão estratégica 3 para sustentabilidade e governança"
  ]
}}
"""
    return prompt