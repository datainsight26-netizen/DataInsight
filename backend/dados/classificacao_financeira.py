import re
import unicodedata
import numpy as np
import pandas as pd
from typing import Optional

# =====================================================
#  MAPA FINANCEIRO COMPLETO
#  Chave = categoria interna | Valor = lista de aliases
# =====================================================

MAPA_FINANCEIRO = {
    # ── RECEITAS ──────────────────────────────────────
    "receita_produtos": [
        r"venda.*produto", r"receita.*produto", r"produto.*venda",
        r"faturamento.*produto", r"produto", r"mercadoria", r"sku",
    ],
    "receita_servicos": [
        r"venda.*servico", r"receita.*servico", r"servico",
        r"prestacao", r"honorario", r"consultoria",
    ],
    "receita_outros": [
        r"outras.*receita", r"receita.*outr", r"outros.*faturamento",
        r"receita diversa",
    ],
    "receita_total": [
        r"^faturamento$", r"^receita$", r"^receita total$", r"^total receita$",
        r"^entrada$", r"revenue", r"sales", r"income", r"^faturado$",
        r"val.*faturado", r"total.*venda",
    ],

    # ── IMPOSTOS ──────────────────────────────────────
    "impostos": [
        r"imposto", r"tax", r"tributo", r"simples.*nacional",
        r"iss\b", r"icms\b", r"pis\b", r"cofins\b", r"irpj\b", r"csll\b",
        r"deducao", r"retencao",
    ],
    "taxa_imposto": [
        r"taxa.*imposto", r"aliquota", r"percentual.*imposto",
        r"imposto.*pct", r"tax.*rate",
    ],

    # ── CUSTOS VARIÁVEIS ──────────────────────────────
    "custo_variavel": [
        r"custo.*variavel", r"gastos.*variavel", r"variavel",
        r"cmv", r"cpv", r"custo.*mercadoria", r"custo.*produto",
    ],
    "fornecedores": [
        r"fornecedor", r"compra", r"materia.*prima", r"insumo",
        r"estoque", r"suprimento", r"supply",
    ],
    "publicidade": [
        r"publicidade", r"marketing", r"propaganda", r"ads\b",
        r"midia", r"anuncio", r"campanha", r"trafego.*pago",
    ],
    "custo_variavel_outros": [
        r"outros.*variavel", r"variavel.*outro", r"comissao",
        r"frete", r"logistica", r"embalagem",
    ],

    # ── GASTOS FIXOS ──────────────────────────────────
    "aluguel": [
        r"aluguel", r"locacao", r"rent\b", r"arrendamento", r"condominio",
    ],
    "folha_pagamento": [
        r"folha", r"salario", r"funcionario", r"payroll",
        r"colaborador", r"rh\b", r"pessoal", r"remuneracao",
    ],
    "pro_labore": [
        r"pro.*labore", r"retirada", r"socio", r"proprietario",
        r"honorario.*socio",
    ],
    "gasto_fixo_outros": [
        r"despesas.*fixas", r"gastos.*fixos", r"fixo", r"overhead",
        r"energia", r"agua", r"internet", r"telefone", r"contabilidade",
    ],

    # ── INVESTIMENTOS ─────────────────────────────────
    "investimento_infra": [
        r"infraestrutura", r"infra\b", r"reforma", r"instalacao",
        r"obra", r"construcao",
    ],
    "investimento_equipamentos": [
        r"equipamento", r"maquina", r"maquinario", r"hardware",
        r"software", r"licenca", r"ferramenta",
    ],
    "investimento_outros": [
        r"investimento", r"capex", r"aquisicao", r"compra.*ativo",
        r"expansao",
    ],

    # ── RESULTADO / LUCRO ─────────────────────────────
    "resultado": [
        r"^lucro$", r"^resultado$", r"^profit$", r"net.*profit",
        r"lucro.*liquido", r"resultado.*final", r"sobrou", r"ganho",
    ],

    # ── PERÍODO ───────────────────────────────────────
    "periodo": [
        r"^data$", r"^periodo$", r"^mes$", r"^ano$", r"^dia$",
        r"date\b", r"time\b", r"competencia", r"month\b",
        r"data.*competencia", r"data.*referencia",
    ],

    # ── DESPESAS GENÉRICAS (fallback) ─────────────────
    "despesas": [
        r"^despesa$", r"^gasto$", r"^custo$", r"^saida$",
        r"expense", r"cost\b", r"outgoing", r"val.*gasto",
    ],
}

# Labels amigáveis para exibição no frontend e sugestão automática de criação
LABELS_CATEGORIAS = {
    # Indicadores Principais (Essenciais do Negócio)
    "periodo":                 {"label": "Data dos Registros / Período", "grupo": "Indicadores Principais do Negócio", "cor": "#3b82f6", "icone": "fa-calendar", "coluna_sugerida": "Data", "tipo_sugerido": "data"},
    "receita_total":           {"label": "Faturamento / Receita Total",  "grupo": "Indicadores Principais do Negócio", "cor": "#10b981", "icone": "fa-chart-line", "coluna_sugerida": "Faturamento", "tipo_sugerido": "moeda"},
    "despesas":                {"label": "Despesas / Gastos Totais",     "grupo": "Indicadores Principais do Negócio", "cor": "#ef4444", "icone": "fa-money-bill-wave", "coluna_sugerida": "Despesas", "tipo_sugerido": "moeda"},
    "resultado":               {"label": "Lucro Líquido / Resultado",    "grupo": "Indicadores Principais do Negócio", "cor": "#8b5cf6", "icone": "fa-trophy", "coluna_sugerida": "Lucro Líquido", "tipo_sugerido": "moeda"},

    # Detalhamento de Receitas
    "receita_produtos":        {"label": "Venda de Produtos",            "grupo": "Detalhamento de Receitas",          "cor": "#10b981", "icone": "fa-box", "coluna_sugerida": "Venda Produtos", "tipo_sugerido": "moeda"},
    "receita_servicos":        {"label": "Venda de Serviços",            "grupo": "Detalhamento de Receitas",          "cor": "#10b981", "icone": "fa-screwdriver-wrench", "coluna_sugerida": "Venda Serviços", "tipo_sugerido": "moeda"},
    "receita_outros":          {"label": "Outras Receitas",              "grupo": "Detalhamento de Receitas",          "cor": "#10b981", "icone": "fa-plus-circle", "coluna_sugerida": "Outras Receitas", "tipo_sugerido": "moeda"},

    # Impostos
    "impostos":                {"label": "Impostos (Valor R$)",          "grupo": "Impostos",                         "cor": "#6366f1", "icone": "fa-file-invoice-dollar", "coluna_sugerida": "Impostos", "tipo_sugerido": "moeda"},
    "taxa_imposto":            {"label": "Taxa de Imposto (%)",          "grupo": "Impostos",                         "cor": "#6366f1", "icone": "fa-percent", "coluna_sugerida": "Taxa Imposto (%)", "tipo_sugerido": "numero"},

    # Custos Variáveis
    "fornecedores":            {"label": "Fornecedores / CMV",           "grupo": "Custos Variáveis",                 "cor": "#f59e0b", "icone": "fa-truck", "coluna_sugerida": "Fornecedores", "tipo_sugerido": "moeda"},
    "publicidade":             {"label": "Publicidade / Marketing",      "grupo": "Custos Variáveis",                 "cor": "#f59e0b", "icone": "fa-bullhorn", "coluna_sugerida": "Marketing", "tipo_sugerido": "moeda"},
    "custo_variavel":          {"label": "Outros Custos Variáveis",      "grupo": "Custos Variáveis",                 "cor": "#f59e0b", "icone": "fa-arrows-rotate", "coluna_sugerida": "Custos Variáveis", "tipo_sugerido": "moeda"},
    "custo_variavel_outros":   {"label": "Custos Variáveis Diversos",    "grupo": "Custos Variáveis",                 "cor": "#f59e0b", "icone": "fa-ellipsis", "coluna_sugerida": "Custos Diversos", "tipo_sugerido": "moeda"},

    # Gastos Fixos
    "aluguel":                 {"label": "Aluguel / Locação",            "grupo": "Gastos Fixos",                     "cor": "#ef4444", "icone": "fa-building", "coluna_sugerida": "Aluguel", "tipo_sugerido": "moeda"},
    "folha_pagamento":         {"label": "Folha de Pagamento",           "grupo": "Gastos Fixos",                     "cor": "#ef4444", "icone": "fa-users", "coluna_sugerida": "Folha de Pagamento", "tipo_sugerido": "moeda"},
    "pro_labore":              {"label": "Pró-labore / Retirada",        "grupo": "Gastos Fixos",                     "cor": "#ef4444", "icone": "fa-user-tie", "coluna_sugerida": "Pró-labore", "tipo_sugerido": "moeda"},
    "gasto_fixo_outros":       {"label": "Outros Gastos Fixos",          "grupo": "Gastos Fixos",                     "cor": "#ef4444", "icone": "fa-file-alt", "coluna_sugerida": "Gastos Fixos", "tipo_sugerido": "moeda"},

    # Investimentos
    "investimento_infra":      {"label": "Investimento – Infraestrutura","grupo": "Investimentos",                    "cor": "#8b5cf6", "icone": "fa-hammer", "coluna_sugerida": "Investimento Infra", "tipo_sugerido": "moeda"},
    "investimento_equipamentos":{"label": "Investimento – Equipamentos",  "grupo": "Investimentos",                    "cor": "#8b5cf6", "icone": "fa-computer", "coluna_sugerida": "Investimento Equipamentos", "tipo_sugerido": "moeda"},
    "investimento_outros":     {"label": "Outros Investimentos",         "grupo": "Investimentos",                    "cor": "#8b5cf6", "icone": "fa-coins", "coluna_sugerida": "Investimentos", "tipo_sugerido": "moeda"},
}

# Campos mínimos necessários por ferramenta
REQUISITOS_FERRAMENTAS = {
    "planejamento_financeiro": {
        "label": "Planejamento Financeiro",
        "icone": "fa-chart-pie",
        "obrigatorios": ["receita_total", "aluguel", "folha_pagamento"],
        "opcionais": ["receita_produtos", "receita_servicos", "impostos",
                      "taxa_imposto", "fornecedores", "publicidade",
                      "investimento_outros", "periodo"],
    },
    "dre": {
        "label": "DRE",
        "icone": "fa-file-invoice",
        "obrigatorios": ["receita_total", "impostos", "custo_variavel", "aluguel"],
        "opcionais": ["folha_pagamento", "pro_labore", "resultado", "taxa_imposto"],
    },
    "fluxo_caixa": {
        "label": "Fluxo de Caixa",
        "icone": "fa-money-bill-transfer",
        "obrigatorios": ["receita_total", "despesas", "periodo"],
        "opcionais": ["impostos", "investimento_outros", "custo_variavel", "resultado"],
    },
}


# =====================================================
#  NORMALIZAÇÃO
# =====================================================

def _normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", str(texto).lower())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


# =====================================================
#  DETECÇÃO AUTOMÁTICA DE CATEGORIA POR COLUNA
# =====================================================

def classificar_coluna(nome_coluna: str, serie: Optional[pd.Series] = None) -> dict:
    """
    Tenta identificar a categoria financeira de uma coluna.
    Retorna: { categoria, confianca (0-100), metodo }
    """
    col_norm = _normalizar(nome_coluna)

    # 1. Match exato de aliases (alta confiança)
    for categoria, aliases in MAPA_FINANCEIRO.items():
        for alias in aliases:
            if re.fullmatch(alias, col_norm):
                return {"categoria": categoria, "confianca": 100, "metodo": "alias_exato"}

    # 2. Match parcial de aliases (confiança média-alta)
    melhor = None
    melhor_score = 0
    for categoria, aliases in MAPA_FINANCEIRO.items():
        for alias in aliases:
            if re.search(alias, col_norm):
                score = 75
                if score > melhor_score:
                    melhor_score = score
                    melhor = categoria

    if melhor:
        return {"categoria": melhor, "confianca": melhor_score, "metodo": "alias_parcial"}

    # 3. Inferência por comportamento dos dados (confiança baixa)
    if serie is not None:
        inferido = _inferir_por_comportamento(serie, col_norm)
        if inferido:
            return {"categoria": inferido, "confianca": 45, "metodo": "comportamento"}

    return {"categoria": None, "confianca": 0, "metodo": "nenhum"}


def _inferir_por_comportamento(serie: pd.Series, col_norm: str) -> Optional[str]:
    """Tenta inferir categoria pelo padrão dos dados."""
    valores = pd.to_numeric(serie, errors="coerce").dropna()

    if valores.empty:
        # Coluna de texto — pode ser período?
        try:
            pd.to_datetime(serie.dropna(), errors="raise", dayfirst=True)
            return "periodo"
        except Exception:
            return None

    # Percentuais (0-100 ou 0-1)
    if valores.between(0, 1).all() or values_between_pct(valores):
        return "taxa_imposto"

    # Valores positivos grandes → receita?
    if valores.gt(0).all() and valores.mean() > 500:
        return "receita_total"

    # Valores constantes (desvio padrão baixo em relação à média) → fixo?
    if len(valores) > 1:
        cv = valores.std() / (valores.mean() + 1e-9)
        if cv < 0.05:
            return "aluguel"  # fixo → provavelmente aluguel

    return None


def values_between_pct(series: pd.Series) -> bool:
    return series.between(0, 100).all() and series.mean() < 50


# =====================================================
#  CLASSIFICAR TODAS AS COLUNAS DO DATAFRAME
# =====================================================

def classificar_colunas_financeiras(df: pd.DataFrame) -> dict:
    """
    Analisa todas as colunas do DataFrame e retorna:
    {
      "colunas": { nome_coluna: { categoria, confianca, metodo, label, cor } },
      "mapeamento_sugerido": { categoria: nome_coluna }   (primeira correspondência por categoria)
    }
    """
    resultado_colunas = {}
    mapeamento_sugerido = {}

    for col in df.columns:
        serie = df[col] if col in df.columns else None
        classificacao = classificar_coluna(col, serie)

        cat = classificacao.get("categoria")
        meta = LABELS_CATEGORIAS.get(cat, {}) if cat else {}

        resultado_colunas[col] = {
            **classificacao,
            "label_categoria": meta.get("label", "Não identificado"),
            "grupo": meta.get("grupo", ""),
            "cor": meta.get("cor", "#94a3b8"),
            "icone": meta.get("icone", "fa-question"),
        }

        # Guarda primeira correspondência por categoria (para mapeamento_sugerido)
        if cat and cat not in mapeamento_sugerido and classificacao["confianca"] > 0:
            mapeamento_sugerido[cat] = col

    return {
        "colunas": resultado_colunas,
        "mapeamento_sugerido": mapeamento_sugerido,
    }


# =====================================================
#  ANÁLISE DE COMPLETUDE POR FERRAMENTA
# =====================================================

def analisar_completude_financeira(mapeamento_usuario: dict) -> dict:
    """
    Recebe o mapeamento salvo do usuário { categoria: coluna_ou_valor }
    Retorna a % de prontidão para cada ferramenta + campos faltantes.
    """
    resultado = {}

    for ferramenta_id, cfg in REQUISITOS_FERRAMENTAS.items():
        obrigatorios = cfg["obrigatorios"]
        opcionais = cfg["opcionais"]

        presentes_obrig = [c for c in obrigatorios if mapeamento_usuario.get(c)]
        presentes_opcio = [c for c in opcionais if mapeamento_usuario.get(c)]

        faltando_obrig = [c for c in obrigatorios if not mapeamento_usuario.get(c)]
        faltando_opcio = [c for c in opcionais if not mapeamento_usuario.get(c)]

        # Peso: obrigatórios valem 70%, opcionais valem 30%
        total_obrig = len(obrigatorios)
        total_opcio = len(opcionais)

        score_obrig = (len(presentes_obrig) / total_obrig * 70) if total_obrig else 70
        score_opcio = (len(presentes_opcio) / total_opcio * 30) if total_opcio else 30
        prontidao = round(score_obrig + score_opcio)

        resultado[ferramenta_id] = {
            "label": cfg["label"],
            "icone": cfg["icone"],
            "prontidao": prontidao,
            "completo": prontidao >= 70,
            "faltando_obrigatorios": [
                {
                    "categoria": c,
                    "label": LABELS_CATEGORIAS.get(c, {}).get("label", c),
                }
                for c in faltando_obrig
            ],
            "faltando_opcionais": [
                {
                    "categoria": c,
                    "label": LABELS_CATEGORIAS.get(c, {}).get("label", c),
                }
                for c in faltando_opcio
            ],
        }

    return resultado


# =====================================================
#  RECOMENDAÇÕES INTELIGENTES
# =====================================================

_RECOMENDACOES_BASE = [
    {
        "categoria_ausente": "impostos",
        "grupo_ausente": "taxa_imposto",
        "mensagem": "Nenhuma coluna de impostos detectada. Usaremos 8% padrão (Simples Nacional) para o DRE.",
        "acao": "Informar taxa de imposto manualmente",
        "valor_padrao": {"taxa_imposto": 8.0},
        "nivel": "aviso",
    },
    {
        "categoria_ausente": "aluguel",
        "grupo_ausente": "folha_pagamento",
        "mensagem": "Gastos Fixos não encontrados (Aluguel / Folha). O Planejamento Financeiro ficará incompleto.",
        "acao": "Adicionar Gastos Fixos manualmente",
        "nivel": "erro",
    },
    {
        "categoria_ausente": "receita_total",
        "mensagem": "Nenhuma coluna de receita identificada. Verifique se os dados foram carregados corretamente.",
        "acao": "Mapear coluna de receita",
        "nivel": "erro",
    },
    {
        "categoria_ausente": "periodo",
        "mensagem": "Coluna de período/data não detectada. O Fluxo de Caixa precisa de uma dimensão temporal.",
        "acao": "Informar coluna de data",
        "nivel": "aviso",
    },
    {
        "categoria_ausente": "custo_variavel",
        "grupo_ausente": "fornecedores",
        "mensagem": "Custos variáveis não detectados. A Margem de Contribuição não poderá ser calculada.",
        "acao": "Mapear custos variáveis",
        "nivel": "aviso",
    },
]


def gerar_recomendacoes(mapeamento_usuario: dict) -> list:
    """
    Gera lista de recomendações baseadas nos campos ausentes no mapeamento do usuário.
    """
    recomendacoes = []

    for rec in _RECOMENDACOES_BASE:
        cat_ausente = rec["categoria_ausente"]
        grupo_ausente = rec.get("grupo_ausente")

        # Verificar se a categoria principal está ausente
        tem_principal = bool(mapeamento_usuario.get(cat_ausente))
        # Verificar grupo alternativo
        tem_grupo = bool(mapeamento_usuario.get(grupo_ausente)) if grupo_ausente else False

        if not tem_principal and not tem_grupo:
            meta = LABELS_CATEGORIAS.get(cat_ausente, {})
            col_sugerida = meta.get("coluna_sugerida", cat_ausente.capitalize())
            tipo_sugerido = meta.get("tipo_sugerido", "moeda")
            recomendacoes.append({
                "mensagem": rec["mensagem"],
                "acao": rec["acao"],
                "nivel": rec["nivel"],
                "categoria": cat_ausente,
                "coluna_sugerida": col_sugerida,
                "tipo_sugerido": tipo_sugerido,
                "valor_padrao": rec.get("valor_padrao"),
            })

    return recomendacoes


# =====================================================
#  CÁLCULO DE CAMPOS DERIVADOS (PREVIEW)
# =====================================================

def calcular_preview_financeiro(mapeamento_usuario: dict, df: pd.DataFrame) -> dict:
    """
    Calcula indicadores financeiros derivados para preview na página de Dados.
    Retorna dict com receita_total, impostos, custo_variavel, margem_contribuicao,
    gastos_fixos, resultado.
    """
    def soma_coluna(cat_key: str) -> float:
        col = mapeamento_usuario.get(cat_key)
        if col and col in df.columns:
            return pd.to_numeric(df[col], errors="coerce").fillna(0).sum()
        # Verificar se é um valor manual (número)
        val = mapeamento_usuario.get(f"{cat_key}_manual")
        if val:
            try:
                return float(val)
            except Exception:
                return 0.0
        return 0.0

    receita = (
        soma_coluna("receita_total")
        or soma_coluna("receita_produtos") + soma_coluna("receita_servicos") + soma_coluna("receita_outros")
    )

    taxa_raw = mapeamento_usuario.get("taxa_imposto_manual")
    taxa = float(taxa_raw) / 100 if taxa_raw else 0.08

    impostos = soma_coluna("impostos") or (receita * taxa)

    custos_var = (
        soma_coluna("custo_variavel")
        or soma_coluna("fornecedores") + soma_coluna("publicidade") + soma_coluna("custo_variavel_outros")
    )

    margem = receita - impostos - custos_var

    gastos_fixos = (
        soma_coluna("gasto_fixo_outros")
        or soma_coluna("aluguel") + soma_coluna("folha_pagamento") + soma_coluna("pro_labore")
    )

    resultado_val = soma_coluna("resultado") or (margem - gastos_fixos)

    investimentos = (
        soma_coluna("investimento_outros")
        or soma_coluna("investimento_infra") + soma_coluna("investimento_equipamentos")
    )

    margem_pct = round((margem / receita * 100), 2) if receita > 0 else 0.0

    return {
        "receita_total": float(round(receita, 2)),
        "impostos": float(round(impostos, 2)),
        "custo_variavel": float(round(custos_var, 2)),
        "margem_contribuicao_rs": float(round(margem, 2)),
        "margem_contribuicao_pct": float(margem_pct),
        "gastos_fixos": float(round(gastos_fixos, 2)),
        "resultado": float(round(resultado_val, 2)),
        "investimentos": float(round(investimentos, 2)),
        "taxa_imposto_usada": float(round(taxa * 100, 2)),
    }
