import json
import re
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
        print(f"[RAG] Erro ao carregar contexto multi-planilhas: {e}", flush=True)
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
    return f"Últimos {len(amostra)} registros do banco:\n{texto}"


def _chunk_dados_completos(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    if df is None or df.empty:
        return None

    linhas = []
    linhas.append(f"Total de registros: {len(df)}")
    linhas.append(f"Colunas: {', '.join(map(str, df.columns.tolist()))}")

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
        linhas.append(f"Coluna de produto detectada: {produto_col}")
        produtos = df[produto_col].dropna().astype(str).str.strip()
        produtos = produtos[produtos != ''].head(10).unique().tolist()
        if produtos:
            linhas.append(f"Exemplos de produtos: {', '.join(produtos)}")
    elif categoria_col:
        linhas.append(f"Coluna de categoria detectada: {categoria_col}")

    fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
    desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)
    luc_total = calcular_total_dinamico(df, "lucro", mapeamento, COL_LUCRO) or (fat_total - desp_total)
    linhas.append(f"Faturamento total: R$ {fat_total:,.2f}")
    linhas.append(f"Despesa total: R$ {desp_total:,.2f}")
    linhas.append(f"Lucro total: R$ {luc_total:,.2f}")

    return "Dados gerais do conjunto completo de dados:\n" + "\n".join(linhas)


def construir_chunks_rag(usuario_id: str, pergunta: str, tabela_id: str = "todas") -> List[Dict[str, Any]]:
    documento = _carregar_documento_dados(usuario_id, tabela_id=tabela_id)
    if not documento or not documento.get("dados"):
        return [{
            "id": "sem_dados",
            "titulo": "Disponibilidade de dados",
            "conteudo": "Nenhum dataset financeiro encontrado no banco para este usuário.",
            "obrigatorio": True,
            "tags": {"dados", "banco", "vazio"},
        }]

    df = pd.DataFrame(documento["dados"])
    mapeamento = obter_colunas_mapeadas(usuario_id) or {}
    periodo = _detectar_periodo_pergunta(pergunta)
    chunks: List[Dict[str, Any]] = []

    meta = (
        f"Fonte: MongoDB (coleção dados)\n"
        f"Planilha: {documento.get('nome_planilha', 'não informado')}\n"
        f"Atualizado em: {documento.get('atualizado_em') or documento.get('criado_em')}\n"
        f"Total de registros: {len(df)}\n"
        f"Colunas: {', '.join(map(str, df.columns.tolist()))}\n"
        f"Mapeamento: {json.dumps(mapeamento, ensure_ascii=False, default=str) if mapeamento else 'não definido'}"
    )
    chunks.append({
        "id": "metadados",
        "titulo": "Metadados do dataset",
        "conteudo": meta,
        "obrigatorio": True,
        "tags": {"planilha", "colunas", "metadados", "dataset", "banco"},
    })

    dados_completos = _chunk_dados_completos(df, mapeamento)
    if dados_completos:
        chunks.append({
            "id": "dados_completos",
            "titulo": "Dados gerais do usuário",
            "conteudo": dados_completos,
            "obrigatorio": False,
            "tags": {"dados", "completo", "geral", "total", "produtos", "consolidado"},
        })

    chunks.append({
        "id": "kpis",
        "titulo": f"KPIs financeiros ({periodo})",
        "conteudo": _resumo_kpis_do_df(df, mapeamento, periodo),
        "obrigatorio": True,
        "tags": {
            "faturamento", "receita", "vendas", "despesa", "despesas", "gastos",
            "lucro", "margem", "kpi", "resumo", "financeiro", "performance",
        },
    })

    for p_extra in ("7_dias", "30_dias", "90_dias", "ano_atual"):
        if p_extra == periodo:
            continue
        chunks.append({
            "id": f"kpis_{p_extra}",
            "titulo": f"KPIs financeiros ({p_extra})",
            "conteudo": _resumo_kpis_do_df(df, mapeamento, p_extra),
            "obrigatorio": False,
            "tags": {"comparar", "comparação", "periodo", "histórico", "tendencia"},
        })

    serie = _chunk_serie_mensal(df, mapeamento)
    if serie:
        chunks.append({
            "id": "serie_mensal",
            "titulo": "Evolução mensal",
            "conteudo": serie,
            "obrigatorio": False,
            "tags": {"mensal", "evolução", "tendencia", "histórico", "mês", "mes", "série", "serie"},
        })

    cats = _chunk_categorias(df, mapeamento)
    if cats:
        chunks.append({
            "id": "categorias",
            "titulo": "Distribuição por categoria",
            "conteudo": cats,
            "obrigatorio": False,
            "tags": {"categoria", "categorias", "grupo", "tipo", "setor", "ranking"},
        })

    recentes = _chunk_registros_recentes(df)
    if recentes:
        chunks.append({
            "id": "registros",
            "titulo": "Registros recentes",
            "conteudo": recentes,
            "obrigatorio": False,
            "tags": {"transação", "transacoes", "registro", "lançamento", "detalhe", "linha", "tabela"},
        })

    chunks.append({
        "id": "anomalias",
        "titulo": "Análise de anomalias de despesas",
        "conteudo": detectar_anomalias_despesas(),
        "obrigatorio": False,
        "tags": {"anomalia", "alerta", "pico", "atípico", "despesa", "risco"},
    })
    chunks.append({
        "id": "previsao",
        "titulo": "Previsão de receita",
        "conteudo": prever_receita_mes_seguinte(),
        "obrigatorio": False,
        "tags": {"previsão", "previsao", "próximo", "proximo", "forecast", "projecao", "projeção"},
    })
    chunks.append({
        "id": "equilibrio",
        "titulo": "Ponto de equilíbrio",
        "conteudo": calcular_ponto_equilibrio(),
        "obrigatorio": False,
        "tags": {"equilibrio", "equilíbrio", "breakeven", "ponto", "custos"},
    })

    return chunks


def ranquear_chunks_rag(chunks: List[Dict[str, Any]], pergunta: str, top_k: int = 5) -> List[Dict[str, Any]]:
    tokens = _tokens_busca(pergunta)
    ranqueados: List[Tuple[float, Dict[str, Any]]] = []

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


def montar_contexto_rag(usuario_id: str, pergunta: str, top_k: int = 5, tabela_id: str = "todas") -> str:
    if not usuario_id:
        return "Usuário não autenticado — sem acesso aos dados do banco."

    chunks = construir_chunks_rag(usuario_id, pergunta, tabela_id=tabela_id)
    relevantes = ranquear_chunks_rag(chunks, pergunta, top_k=top_k)
    fontes = [c["id"] for c in relevantes]
    print(f"[RAG] usuario={usuario_id} fontes={fontes}")

    def _truncate(text: Optional[str], max_chars: int = 1200) -> str:
        if not text:
            return ''
        t = str(text)
        if len(t) <= max_chars:
            return t
        cut = t[:max_chars]
        if '\n' in cut:
            return cut.rsplit('\n', 1)[0] + '\n...[truncado]'
        return cut + '\n...[truncado]'

    blocos = [f"[Fonte {i}: {chunk['titulo']}]\n{_truncate(chunk.get('conteudo'))}" for i, chunk in enumerate(relevantes, start=1)]
    contexto_final = "\n\n".join(blocos) if blocos else "Sem contexto recuperado do banco."

    if len(contexto_final) > 8000:
        contexto_final = contexto_final[:8000] + "\n...[contexto cortado]"

    return contexto_final


def montar_prompt_com_rag(mensagem_usuario: str, contexto_rag: str, historico_chat: str = "") -> str:
    historico_bloco = ""
    if historico_chat:
        historico_bloco = f"\nHistórico recente da conversa:\n{historico_chat}\n"

    return (
        "Você é o assistente financeiro DataInsight.\n"
        "Use PRIORITARIAMENTE o contexto recuperado do banco de dados do usuário (RAG).\n"
        "Se o contexto não tiver a informação, diga claramente que não encontrou nos dados.\n"
        "Responda em português, de forma objetiva, com números quando disponíveis.\n"
        "Não invente valores que não estejam no contexto.\n\n"
        f"=== CONTEXTO RAG (dados do MongoDB) ===\n{contexto_rag}\n"
        f"=== FIM DO CONTEXTO ===\n"
        f"{historico_bloco}"
        f"Pergunta do usuário: {mensagem_usuario}"
    )


def gerar_resposta_fallback(usuario_id: Optional[str], pergunta: str, contexto_rag: str) -> str:
    try:
        if not contexto_rag or contexto_rag.startswith("Usuário não autenticado"):
            return (
                "Desculpe — não há dados suficientes para responder com detalhes. "
                "Verifique se você carregou seus dados e tente novamente."
            )

        documento = _carregar_documento_dados(usuario_id) if usuario_id else None
        df = pd.DataFrame(documento["dados"]) if documento and documento.get("dados") else None
        mapeamento = obter_colunas_mapeadas(usuario_id) if usuario_id else {}
        periodo = _detectar_periodo_pergunta(pergunta)

        kpis_text = _resumo_kpis_do_df(df, mapeamento, periodo) if df is not None else None
        serie_text = _chunk_serie_mensal(df, mapeamento) if df is not None else None
        categorias_text = _chunk_categorias(df, mapeamento) if df is not None else None
        anomalia_text = detectar_anomalias_despesas() if df is not None else None

        linhas = [
            "Resposta automática (fallback):",
            "",
            "Resumo dos dados:",
            kpis_text or "Dados insuficientes para calcular KPIs.",
        ]

        if serie_text:
            linhas.extend(["", "Tendência mensal:", serie_text])

        if categorias_text:
            linhas.extend(["", "Categorias principais:", categorias_text])

        if anomalia_text:
            linhas.extend(["", "Análise de anomalias:", anomalia_text])

        linhas.extend([
            "",
            "Recomendação:",
            "Use os dados acima para verificar tendências e ajustar decisões. "
            "Se quiser mais detalhes, carregue mais dados ou verifique o mapeamento de colunas.",
            "",
            f"Pergunta original: {pergunta}",
        ])

        resposta = "\n".join(linhas)
        return resposta
    except Exception:
        import traceback
        print(traceback.format_exc())
        return "Desculpe — não foi possível gerar uma resposta local no momento."
