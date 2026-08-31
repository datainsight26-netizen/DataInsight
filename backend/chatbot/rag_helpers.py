import json
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from flask import session

from backend.db import dados_colecao
from backend.home.home import (
    COL_CATEGORIA,
    COL_DESPESA,
    COL_FATURAMENTO,
    COL_LUCRO,
    calcular_desempenho,
    calcular_total_dinamico,
    converter_datas,
    encontrar_coluna_data,
    encontrar_coluna_produto,
    encontrar_coluna_categoria,
    filtrar_df,
    obter_colunas_mapeadas,
    obter_dados_graficos,
)
from .analytics import detectar_anomalias_despesas, prever_receita_mes_seguinte, calcular_ponto_equilibrio

_STOPWORDS_PT = {
    "a", "o", "os", "as", "um", "uma", "de", "da", "do", "das", "dos", "e", "em",
    "no", "na", "nos", "nas", "por", "para", "com", "sem", "que", "qual", "quais",
    "meu", "minha", "meus", "minhas", "seu", "sua", "sobre", "como", "é", "seria",
    "tem", "ter", "foi", "ser", "está", "estão", "isso", "este", "esta", "esse",
    "essa", "ao", "à", "às", "ou", "mais", "menos", "muito",
}

# Aliases de colunas de quantidade para engenharia de features
COL_QUANTIDADE = [
    "quantidade", "qtd", "qty", "unidades", "qtde", "vendas", "volume",
    "quant", "amount", "count", "items", "pecas", "peças", "unid",
]

# Aliases de nome de produto/serviço
COL_PRODUTO = [
    "produto", "item", "descricao", "descrição", "servico", "serviço",
    "nome", "product", "service", "sku", "codigo", "código", "referencia",
]

_CACHE_RAG = {}
_CACHE_RAG_TTL = 45
_CACHE_RAG_MAX = 48


def _obter_base_rag(usuario_id: str, tabela_id: str = "todas"):
    """Reutiliza planilha + mapeamento por alguns segundos para não recarregar a cada pergunta."""
    chave = (str(usuario_id), str(tabela_id or "todas"))
    agora = time.time()
    hit = _CACHE_RAG.get(chave)
    if hit and (agora - hit["ts"]) < _CACHE_RAG_TTL:
        return hit["doc"], hit["df"], hit["mapeamento"]

    documento = _carregar_documento_dados(usuario_id, tabela_id=tabela_id)
    df = pd.DataFrame(documento["dados"]) if documento and documento.get("dados") else pd.DataFrame()
    mapeamento = obter_colunas_mapeadas(usuario_id) or {} if usuario_id else {}
    _CACHE_RAG[chave] = {"ts": agora, "doc": documento, "df": df, "mapeamento": mapeamento}
    if len(_CACHE_RAG) > _CACHE_RAG_MAX:
        antiga = min(_CACHE_RAG, key=lambda k: _CACHE_RAG[k]["ts"])
        _CACHE_RAG.pop(antiga, None)
    return documento, df, mapeamento


def _pergunta_pede(texto: str, *termos: str) -> bool:
    t = (texto or "").lower()
    return any(term in t for term in termos)


def _detectar_periodo_pergunta(texto: str) -> str:
    t = (texto or "").lower()
    if re.search(r"\b(todos?|tudo|geral|completo|consolidado|total|lista|listagem|dados\s+gerais|dados\s+completos)\b", t):
        return "todos"
    if re.search(r"\b(7\s*dias|semana|ultimos?\s*7|últimos?\s*7)\b", t):
        return "7_dias"
    if re.search(r"\b(90\s*dias|trimestre|3\s*meses|ultimos?\s*90|últimos?\s*90)\b", t):
        return "90_dias"
    if re.search(r"\b(ano\s*atual|este\s*ano|anual|no\s*ano|do\s*ano)\b", t) or re.search(r"\bano\b", t):
        return "ano_atual"
    return "30_dias"


def _tokens_busca(texto: str) -> set:
    tokens = set(re.findall(r"[a-zA-ZÀ-ÿ0-9_]+", (texto or "").lower()))
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS_PT}


def _carregar_documento_dados(usuario_id: str, tabela_id: str = "todas") -> Optional[Dict[str, Any]]:
    if not usuario_id:
        return None
    try:
        from backend.dados.agregador import obter_contexto_dados
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id)
        if contexto and contexto.get("dados"):
            return {
                "colunas": contexto.get("colunas", []),
                "dados": contexto.get("dados", []),
                "nome_planilha": contexto.get("nome_contexto", "Consolidado"),
                "planilhas_envolvidas": contexto.get("planilhas_envolvidas", [])
            }
    except Exception as e:
        print(f"[DataInsight] Erro ao carregar dados do usuário: {e}", flush=True)
    return dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])


def _resumo_kpis_do_df(df: pd.DataFrame, mapeamento: Dict[str, Any], periodo: str) -> str:
    if df.empty:
        return "Sem registros para o período."

    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    trabalho = df.copy()
    if col_data and col_data in trabalho.columns:
        trabalho = converter_datas(trabalho, col_data)
        trabalho = filtrar_df(trabalho, col_data, periodo)

    if trabalho.empty:
        return f"Nenhum registro encontrado no período {periodo}."

    fat = calcular_total_dinamico(trabalho, "faturamento", mapeamento, COL_FATURAMENTO)
    desp = calcular_total_dinamico(trabalho, "despesa", mapeamento, COL_DESPESA)
    luc = calcular_total_dinamico(trabalho, "lucro", mapeamento, COL_LUCRO) or (fat - desp)
    margem = (luc / fat * 100) if fat else 0.0

    return (
        f"Período: {periodo}\n"
        f"Registros: {len(trabalho)}\n"
        f"Faturamento: R$ {fat:,.2f}\n"
        f"Despesas: R$ {desp:,.2f}\n"
        f"Lucro: R$ {luc:,.2f}\n"
        f"Margem: {margem:.1f}%"
    )


def _chunk_serie_mensal(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    if not col_data or col_data not in df.columns:
        return None

    trabalho = converter_datas(df.copy(), col_data).dropna(subset=[col_data])
    if trabalho.empty:
        return None

    trabalho["mes_ano"] = trabalho[col_data].dt.to_period("M").astype(str)
    linhas = []
    for mes, grupo in trabalho.groupby("mes_ano"):
        fat = calcular_total_dinamico(grupo, "faturamento", mapeamento, COL_FATURAMENTO)
        desp = calcular_total_dinamico(grupo, "despesa", mapeamento, COL_DESPESA)
        luc = calcular_total_dinamico(grupo, "lucro", mapeamento, COL_LUCRO) or (fat - desp)
        linhas.append(f"- {mes}: fat R$ {fat:,.2f} | desp R$ {desp:,.2f} | lucro R$ {luc:,.2f}")

    if not linhas:
        return None
    return "Série mensal (faturamento/despesa/lucro):\n" + "\n".join(linhas[-12:])


def _chunk_categorias(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    col_cat = mapeamento.get("categoria")
    if not col_cat or col_cat not in df.columns:
        col_cat = next(
            (c for c in df.columns if any(a.lower() == c.lower() for a in COL_CATEGORIA)),
            None,
        )
    if not col_cat:
        return None

    col_valor = mapeamento.get("despesa") or mapeamento.get("faturamento")
    if not col_valor or col_valor not in df.columns:
        for aliases in (COL_DESPESA, COL_FATURAMENTO):
            col_valor = next(
                (c for c in df.columns if any(a.lower() == c.lower() for a in aliases)),
                None,
            )
            if col_valor:
                break
    if not col_valor:
        return None

    tmp = df[[col_cat, col_valor]].copy()
    tmp[col_valor] = pd.to_numeric(tmp[col_valor], errors="coerce").fillna(0)
    ranking = tmp.groupby(col_cat)[col_valor].sum().sort_values(ascending=False).head(8)
    if ranking.empty:
        return None

    linhas = [f"- {idx}: R$ {val:,.2f}" for idx, val in ranking.items()]
    return f"Ranking por categoria ({col_cat} x {col_valor}):\n" + "\n".join(linhas)


def _chunk_registros_recentes(df: pd.DataFrame, limite: int = 12) -> Optional[str]:
    if df.empty:
        return None
    amostra = df.tail(limite)
    cols = list(amostra.columns[:10])
    texto = amostra[cols].to_string(index=False, max_cols=10)
    return f"Últimos {len(amostra)} registros:\n{texto}"


def _chunk_dados_completos(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    if df is None or df.empty:
        return None

    linhas = []
    linhas.append(f"Total de registros: {len(df)}")
    linhas.append(f"Colunas disponíveis: {', '.join(map(str, df.columns.tolist()))}")

    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    if col_data and col_data in df.columns:
        df_data = converter_datas(df.copy(), col_data)
        inicio = df_data[col_data].min()
        fim = df_data[col_data].max()
        if pd.notnull(inicio) and pd.notnull(fim):
            linhas.append(f"Período coberto: {inicio.strftime('%d/%m/%Y')} a {fim.strftime('%d/%m/%Y')}")

    produto_col = encontrar_coluna_produto(df, mapeamento)
    categoria_col = encontrar_coluna_categoria(df, mapeamento)
    if produto_col:
        linhas.append(f"Coluna de produto/serviço: {produto_col}")
        produtos = df[produto_col].dropna().astype(str).str.strip()
        produtos = produtos[produtos != ''].head(10).unique().tolist()
        if produtos:
            linhas.append(f"Exemplos de produtos/serviços: {', '.join(produtos)}")
    elif categoria_col:
        linhas.append(f"Coluna de categoria: {categoria_col}")

    fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
    desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)
    luc_total = calcular_total_dinamico(df, "lucro", mapeamento, COL_LUCRO) or (fat_total - desp_total)
    linhas.append(f"Faturamento total: R$ {fat_total:,.2f}")
    linhas.append(f"Despesa total: R$ {desp_total:,.2f}")
    linhas.append(f"Lucro total: R$ {luc_total:,.2f}")

    return "Visão geral dos dados do usuário:\n" + "\n".join(linhas)


def _detectar_coluna_quantidade(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    """Detecta automaticamente uma coluna de quantidade/volume de vendas."""
    col_qtd = mapeamento.get("quantidade")
    if col_qtd and col_qtd in df.columns:
        return col_qtd
    for alias in COL_QUANTIDADE:
        for col in df.columns:
            if alias.lower() == col.lower():
                return col
    # Tenta detectar coluna numérica inteira que pode ser quantidade
    for col in df.columns:
        if any(alias in col.lower() for alias in COL_QUANTIDADE):
            return col
    return None


def _chunk_feature_engineering(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    """
    Engenharia de features: deriva métricas que não existem como colunas diretas.
    Calcula produto/serviço mais vendido por frequência, receita e quantidade.
    Essencial para responder perguntas como "qual o produto mais vendido?"
    sem precisar de uma coluna chamada 'mais_vendido'.
    """
    if df is None or df.empty:
        return None

    linhas = ["Análise derivada dos dados disponíveis (engenharia de features):"]
    encontrou_algo = False

    # — 1. Produto/Serviço mais vendido —
    produto_col = encontrar_coluna_produto(df, mapeamento)
    if produto_col and produto_col in df.columns:
        # Por frequência (aparições = nº de transações)
        freq = df[produto_col].dropna().astype(str).str.strip()
        freq = freq[freq != '']
        if not freq.empty:
            encontrou_algo = True
            ranking_freq = freq.value_counts().head(5)
            linhas.append(f"\nProdutos/Serviços por número de transações (coluna '{produto_col}'):")
            for nome, qtd in ranking_freq.items():
                linhas.append(f"  - {nome}: {qtd} transações")

        # Por receita (faturamento por produto)
        col_fat = mapeamento.get("faturamento")
        if not col_fat or col_fat not in df.columns:
            col_fat = next((c for c in df.columns if any(a.lower() == c.lower() for a in COL_FATURAMENTO)), None)
        if col_fat and col_fat in df.columns:
            tmp = df[[produto_col, col_fat]].copy()
            tmp[col_fat] = pd.to_numeric(tmp[col_fat], errors="coerce").fillna(0)
            tmp_produto = tmp[tmp[produto_col].notna() & (tmp[produto_col].astype(str).str.strip() != '')]
            ranking_receita = tmp_produto.groupby(produto_col)[col_fat].sum().sort_values(ascending=False).head(5)
            if not ranking_receita.empty:
                encontrou_algo = True
                linhas.append(f"\nProdutos/Serviços por receita total (coluna '{col_fat}'):")
                for nome, val in ranking_receita.items():
                    linhas.append(f"  - {nome}: R$ {val:,.2f}")

        # Por quantidade (se houver coluna de quantidade)
        col_qtd = _detectar_coluna_quantidade(df, mapeamento)
        if col_qtd and col_qtd in df.columns:
            tmp = df[[produto_col, col_qtd]].copy()
            tmp[col_qtd] = pd.to_numeric(tmp[col_qtd], errors="coerce").fillna(0)
            tmp_produto = tmp[tmp[produto_col].notna() & (tmp[produto_col].astype(str).str.strip() != '')]
            ranking_qtd = tmp_produto.groupby(produto_col)[col_qtd].sum().sort_values(ascending=False).head(5)
            if not ranking_qtd.empty:
                encontrou_algo = True
                linhas.append(f"\nProdutos/Serviços por quantidade vendida (coluna '{col_qtd}'):")
                for nome, val in ranking_qtd.items():
                    linhas.append(f"  - {nome}: {val:,.0f} unidades")

    # — 2. Ticket médio por produto/cliente —
    col_fat = mapeamento.get("faturamento")
    if not col_fat or col_fat not in df.columns:
        col_fat = next((c for c in df.columns if any(a.lower() == c.lower() for a in COL_FATURAMENTO)), None)
    if col_fat and col_fat in df.columns:
        vals = pd.to_numeric(df[col_fat], errors="coerce").dropna()
        if not vals.empty:
            encontrou_algo = True
            ticket_medio = vals.mean()
            ticket_max = vals.max()
            ticket_min = vals.min()
            linhas.append(f"\nAnálise de ticket/transação (coluna '{col_fat}'):")
            linhas.append(f"  - Ticket médio: R$ {ticket_medio:,.2f}")
            linhas.append(f"  - Maior transação: R$ {ticket_max:,.2f}")
            linhas.append(f"  - Menor transação (excluindo zero): R$ {vals[vals > 0].min():,.2f}" if (vals > 0).any() else f"  - Menor transação: R$ {ticket_min:,.2f}")
            linhas.append(f"  - Total de transações com valor: {len(vals)}")

    # — 3. Sazonalidade: mês/dia com mais vendas —
    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    if col_data and col_data in df.columns:
        df_dt = converter_datas(df.copy(), col_data).dropna(subset=[col_data])
        if not df_dt.empty and col_fat and col_fat in df_dt.columns:
            df_dt["_mes"] = df_dt[col_data].dt.to_period("M").astype(str)
            df_dt["_fat_num"] = pd.to_numeric(df_dt[col_fat], errors="coerce").fillna(0)
            mensal = df_dt.groupby("_mes")["_fat_num"].sum().sort_values(ascending=False)
            if not mensal.empty:
                encontrou_algo = True
                linhas.append(f"\nMeses com maior faturamento:")
                for mes, val in mensal.head(3).items():
                    linhas.append(f"  - {mes}: R$ {val:,.2f}")

    # — 4. Margem por produto —
    col_luc = mapeamento.get("lucro")
    if not col_luc or col_luc not in df.columns:
        col_luc = next((c for c in df.columns if any(a.lower() == c.lower() for a in COL_LUCRO)), None)
    if produto_col and produto_col in df.columns and col_luc and col_luc in df.columns and col_fat and col_fat in df.columns:
        tmp = df[[produto_col, col_fat, col_luc]].copy()
        tmp[col_fat] = pd.to_numeric(tmp[col_fat], errors="coerce").fillna(0)
        tmp[col_luc] = pd.to_numeric(tmp[col_luc], errors="coerce").fillna(0)
        tmp = tmp[tmp[produto_col].notna() & (tmp[produto_col].astype(str).str.strip() != '') & (tmp[col_fat] > 0)]
        if not tmp.empty:
            grp = tmp.groupby(produto_col).agg({col_fat: "sum", col_luc: "sum"})
            grp["margem_pct"] = (grp[col_luc] / grp[col_fat] * 100).round(1)
            grp = grp.sort_values("margem_pct", ascending=False)
            encontrou_algo = True
            linhas.append(f"\nMargem de lucro por produto/serviço (top 5):")
            for nome, row in grp.head(5).iterrows():
                linhas.append(f"  - {nome}: {row['margem_pct']}% de margem")

    if not encontrou_algo:
        return None

    return "\n".join(linhas)


def construir_chunks_rag(usuario_id: str, pergunta: str, tabela_id: str = "todas") -> List[Dict[str, Any]]:
    documento, df, mapeamento = _obter_base_rag(usuario_id, tabela_id=tabela_id)
    if documento is None or df is None or df.empty:
        return [{
            "id": "sem_dados",
            "titulo": "Disponibilidade de dados",
            "conteudo": "Nenhuma planilha ou conjunto de dados foi encontrado para este usuário. Oriente o usuário a carregar seus dados na plataforma.",
            "obrigatorio": True,
            "tags": {"dados", "vazio"},
        }]

    periodo = _detectar_periodo_pergunta(pergunta)
    chunks: List[Dict[str, Any]] = []
    q = pergunta or ""
    precisa_comparacao = _pergunta_pede(q, "compar", "versus", " vs", "períodos", "periodos", "7 dias", "90 dias", "trimestre")
    precisa_completo = _pergunta_pede(q, "completo", "todos", "geral", "consolidado", "visão geral", "visao geral")
    precisa_cats = _pergunta_pede(q, "categ", "ranking", "gasto", "despesa", "distrib")
    precisa_recentes = _pergunta_pede(q, "transac", "registro", "lançam", "lancam", "último", "ultimo", "recente")
    precisa_features = precisa_completo or _pergunta_pede(
        q,
        "produto", "serviço", "servico", "vendid", "top", "ticket", "margem",
        "lucrativ", "analis", "resumo", "fatur", "receita", "despesa", "lucro",
        "ranking", "kpi", "indicador",
    )
    precisa_anom = _pergunta_pede(q, "anom", "alerta", "pico", "suspeit", "atíp", "atip", "fora do padrão", "fora do padrao")
    precisa_prev = _pergunta_pede(q, "previs", "próxim", "proxim", "projec", "tendenc", "crescimento")
    precisa_eq = _pergunta_pede(q, "equil", "breakeven", "ponto de")
    precisa_serie = precisa_prev or precisa_completo or _pergunta_pede(q, "mensal", "evolu", "histórico", "historico", "mês", "mes")

    # — Metadados sem termos técnicos —
    colunas_disponiveis = ', '.join(map(str, df.columns.tolist()))
    nome_fonte = documento.get('nome_planilha', 'dados carregados')
    meta = (
        f"Fonte de dados: {nome_fonte}\n"
        f"Total de registros: {len(df)}\n"
        f"Colunas disponíveis nos dados: {colunas_disponiveis}\n"
        f"Mapeamento de colunas: {json.dumps(mapeamento, ensure_ascii=False, default=str) if mapeamento else 'automático'}"
    )
    chunks.append({
        "id": "metadados",
        "titulo": "Estrutura dos dados do usuário",
        "conteudo": meta,
        "obrigatorio": True,
        "tags": {"planilha", "colunas", "metadados", "dataset", "estrutura"},
    })

    if precisa_completo:
        dados_completos = _chunk_dados_completos(df, mapeamento)
        if dados_completos:
            chunks.append({
                "id": "dados_completos",
                "titulo": "Visão geral dos dados",
                "conteudo": dados_completos,
                "obrigatorio": False,
                "tags": {"dados", "completo", "geral", "total", "produtos", "consolidado"},
            })

    chunks.append({
        "id": "kpis",
        "titulo": f"Indicadores financeiros ({periodo})",
        "conteudo": _resumo_kpis_do_df(df, mapeamento, periodo),
        "obrigatorio": True,
        "tags": {
            "faturamento", "receita", "vendas", "despesa", "despesas", "gastos",
            "lucro", "margem", "kpi", "resumo", "financeiro", "performance",
        },
    })

    if precisa_comparacao:
        for p_extra in ("7_dias", "30_dias", "90_dias", "ano_atual"):
            if p_extra == periodo:
                continue
            chunks.append({
                "id": f"kpis_{p_extra}",
                "titulo": f"Indicadores financeiros ({p_extra})",
                "conteudo": _resumo_kpis_do_df(df, mapeamento, p_extra),
                "obrigatorio": False,
                "tags": {"comparar", "comparação", "periodo", "histórico", "tendencia"},
            })

    if precisa_serie:
        serie = _chunk_serie_mensal(df, mapeamento)
        if serie:
            chunks.append({
                "id": "serie_mensal",
                "titulo": "Evolução mensal",
                "conteudo": serie,
                "obrigatorio": False,
                "tags": {"mensal", "evolução", "tendencia", "histórico", "mês", "mes", "série", "serie"},
            })

    if precisa_cats or precisa_completo:
        cats = _chunk_categorias(df, mapeamento)
        if cats:
            chunks.append({
                "id": "categorias",
                "titulo": "Distribuição por categoria",
                "conteudo": cats,
                "obrigatorio": False,
                "tags": {"categoria", "categorias", "grupo", "tipo", "setor", "ranking"},
            })

    if precisa_recentes:
        recentes = _chunk_registros_recentes(df)
        if recentes:
            chunks.append({
                "id": "registros",
                "titulo": "Registros recentes",
                "conteudo": recentes,
                "obrigatorio": False,
                "tags": {"transação", "transacoes", "registro", "lançamento", "detalhe", "linha", "tabela"},
            })

    if precisa_features:
        features = _chunk_feature_engineering(df, mapeamento)
        if features:
            chunks.append({
                "id": "feature_engineering",
                "titulo": "Análise derivada: rankings e métricas calculadas",
                "conteudo": features,
                "obrigatorio": False,
                "tags": {
                    "mais vendido", "mais_vendido", "produto", "serviço", "ranking",
                    "vendido", "popular", "top", "melhor", "maior", "ticket",
                    "frequencia", "frequência", "quantidade", "volume", "sazonalidade",
                    "margem", "rentável", "rentabilidade", "lucrativo", "lucro",
                },
            })

    if precisa_anom:
        chunks.append({
            "id": "anomalias",
            "titulo": "Análise de variações atípicas nas despesas",
            "conteudo": detectar_anomalias_despesas(),
            "obrigatorio": False,
            "tags": {"anomalia", "alerta", "pico", "atípico", "despesa", "risco"},
        })
    if precisa_prev:
        chunks.append({
            "id": "previsao",
            "titulo": "Projeção de receita",
            "conteudo": prever_receita_mes_seguinte(),
            "obrigatorio": False,
            "tags": {"previsão", "previsao", "próximo", "proximo", "forecast", "projecao", "projeção"},
        })
    if precisa_eq:
        chunks.append({
            "id": "equilibrio",
            "titulo": "Ponto de equilíbrio financeiro",
            "conteudo": calcular_ponto_equilibrio(),
            "obrigatorio": False,
            "tags": {"equilibrio", "equilíbrio", "breakeven", "ponto", "custos"},
        })

    return chunks


def ranquear_chunks_rag(chunks: List[Dict[str, Any]], pergunta: str, top_k: int = 6) -> List[Dict[str, Any]]:
    tokens = _tokens_busca(pergunta)
    pergunta_lower = (pergunta or "").lower()
    ranqueados: List[Tuple[float, Dict[str, Any]]] = []

    # Palavras-chave que indicam pergunta sobre produto/ranking
    keywords_produto = {
        "mais vendido", "produto", "serviço", "ranking", "vendido", "popular",
        "top", "melhor", "maior venda", "ticket", "frequência", "quantidade",
        "lucrativo", "rentável", "margem por",
    }
    eh_pergunta_produto = any(kw in pergunta_lower for kw in keywords_produto)

    for chunk in chunks:
        score = 1000.0 if chunk.get("obrigatorio") else 0.0
        blob = f"{chunk.get('titulo', '')} {chunk.get('conteudo', '')}".lower()
        tags = {str(t).lower() for t in chunk.get("tags", set())}

        for tok in tokens:
            if tok in tags:
                score += 4.0
            if tok in blob:
                score += 1.5
            if any(tok in tag for tag in tags):
                score += 1.0

        # Feature engineering tem prioridade máxima para perguntas de produto
        if eh_pergunta_produto and chunk["id"] == "feature_engineering":
            score += 500.0

        ranqueados.append((score, chunk))

    ranqueados.sort(key=lambda x: x[0], reverse=True)

    selecionados: List[Dict[str, Any]] = []
    vistos = set()
    for score, chunk in ranqueados:
        if chunk["id"] in vistos:
            continue
        if score <= 0 and not chunk.get("obrigatorio"):
            continue
        selecionados.append(chunk)
        vistos.add(chunk["id"])
        if len(selecionados) >= top_k:
            break

    if not selecionados:
        selecionados = [c for c in chunks if c.get("obrigatorio")][:2]

    return selecionados


def montar_contexto_rag(usuario_id: str, pergunta: str, top_k: int = 6, tabela_id: str = "todas") -> str:
    if not usuario_id:
        return "Usuário não autenticado — sem acesso aos dados."

    chunks = construir_chunks_rag(usuario_id, pergunta, tabela_id=tabela_id)
    relevantes = ranquear_chunks_rag(chunks, pergunta, top_k=min(top_k, 4))
    fontes = [c["id"] for c in relevantes]
    print(f"[DataInsight IA] usuario={usuario_id} fontes={fontes}")

    def _truncate(text: Optional[str], max_chars: int = 1100) -> str:
        if not text:
            return ''
        t = str(text)
        if len(t) <= max_chars:
            return t
        cut = t[:max_chars]
        if '\n' in cut:
            return cut.rsplit('\n', 1)[0] + '\n...[continua]'
        return cut + '\n...[continua]'

    blocos = [f"[{chunk['titulo']}]\n{_truncate(chunk.get('conteudo'))}" for chunk in relevantes]
    contexto_final = "\n\n".join(blocos) if blocos else "Sem dados disponíveis para análise."

    if len(contexto_final) > 6000:
        contexto_final = contexto_final[:6000] + "\n...[dados resumidos]"

    return contexto_final


def montar_prompt_com_rag(mensagem_usuario: str, contexto_rag: str, historico_chat: str = "") -> str:
    historico_bloco = ""
    if historico_chat:
        historico_bloco = f"\nHistórico recente da conversa:\n{historico_chat}\n"

    return (
        "Você é o assistente de inteligência financeira da plataforma DataInsight.\n"
        "Seu papel é analisar os dados financeiros do usuário e responder de forma clara, profissional e em português.\n\n"

        "REGRAS ABSOLUTAS — siga sempre:\n"
        "1. NUNCA mencione termos técnicos como: MongoDB, banco de dados, RAG, contexto recuperado, coleção, query, API, backend, dataset, chunk, embedding, LLM, modelo de linguagem, Gemini.\n"
        "2. Quando o usuário perguntar sobre 'produto mais vendido', 'serviço mais popular' ou similar, USE os dados de 'Análise derivada' e 'rankings calculados' presentes no contexto — nunca diga que 'não há coluna mais vendido'.\n"
        "3. SEMPRE tente derivar a resposta a partir dos dados disponíveis usando engenharia analítica. Se não houver coluna exata, use frequência de aparição, soma de valores, contagem de transações, etc.\n"
        "4. Formate a resposta em HTML estruturado — NUNCA use Markdown (sem #, ##, ###, *, **, _, `).\n"
        "5. Use estas tags HTML para formatação:\n"
        "   - Títulos de seção: <h3 style='margin-top:16px;margin-bottom:6px;'>Título</h3>\n"
        "   - Negrito: <strong>texto</strong>\n"
        "   - Listas: <ul><li>item</li></ul>\n"
        "   - Parágrafos: <p>texto</p>\n"
        "   - Destaques importantes: <span style='color:#10b981;font-weight:600;'>valor positivo</span> ou <span style='color:#ef4444;font-weight:600;'>valor negativo</span>\n"
        "6. Organize a resposta em seções lógicas com títulos claros.\n"
        "7. Cite valores numéricos reais dos dados sempre que disponíveis.\n"
        "8. Se realmente não houver dados suficientes, explique de forma amigável o que seria necessário, sem jargão técnico.\n\n"

        f"=== DADOS DO USUÁRIO ===\n{contexto_rag}\n"
        f"=== FIM DOS DADOS ===\n"
        f"{historico_bloco}"
        f"Pergunta do usuário: {mensagem_usuario}\n\n"
        "Responda agora em HTML estruturado, sem Markdown:"
    )


def gerar_resposta_fallback(usuario_id: Optional[str], pergunta: str, contexto_rag: str) -> str:
    """Fallback local rápido quando a API Gemini não está disponível — reusa o contexto já montado."""
    try:
        if not contexto_rag or contexto_rag.startswith("Usuário não autenticado"):
            return (
                "<p>Não há dados suficientes para responder com detalhes. "
                "Verifique se você carregou seus dados e tente novamente.</p>"
            )

        html = ["<h3 style='margin-bottom:8px;'>Resumo dos seus dados</h3>"]
        for bloco in contexto_rag.split("\n\n")[:4]:
            linhas = [ln.strip() for ln in bloco.split("\n") if ln.strip()]
            if not linhas:
                continue
            titulo = linhas[0].strip("[]")
            html.append(f"<h3 style='margin-top:16px;margin-bottom:8px;'>{titulo}</h3><ul>")
            for linha in linhas[1:]:
                html.append(f"<li>{linha.lstrip('- ')}</li>")
            html.append("</ul>")
        html.append(
            "<p style='margin-top:16px;color:#6b7280;font-size:0.9em;'>"
            "Para análises mais detalhadas, tente novamente em instantes.</p>"
        )
        return "".join(html)
    except Exception:
        import traceback
        print(traceback.format_exc())
        return "<p>Não foi possível gerar uma resposta no momento. Tente novamente.</p>"
