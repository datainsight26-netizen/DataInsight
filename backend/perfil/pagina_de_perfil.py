from datetime import datetime

from bson import ObjectId
from flask import render_template, session

from backend.db import (
    analises_salvas_colecao,
    chat_historico,
    dados_colecao,
    galeria,
    relatorios_colecao,
    usuario,
)


MESES_PT = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)


def _iniciais(nome):
    partes = [p for p in (nome or "").strip().split() if p]
    if not partes:
        return "U"
    if len(partes) == 1:
        return partes[0][:2].upper()
    return (partes[0][0] + partes[-1][0]).upper()


def _membro_desde(user_id, user_doc):
    dt = user_doc.get("criado_em") if user_doc else None
    if not isinstance(dt, datetime):
        try:
            dt = ObjectId(user_id).generation_time
        except Exception:
            return None
    try:
        return f"{MESES_PT[dt.month - 1]} de {dt.year}"
    except Exception:
        return None


def _contar_linhas_planilhas(usuario_id):
    try:
        pipeline = [
            {"$match": {"usuario_id": usuario_id}},
            {"$project": {"n": {"$size": {"$ifNull": ["$dados", []]}}}},
            {"$group": {"_id": None, "planilhas": {"$sum": 1}, "linhas": {"$sum": "$n"}}},
        ]
        doc = next(dados_colecao.aggregate(pipeline), None)
        if not doc:
            return 0, 0
        return int(doc.get("planilhas") or 0), int(doc.get("linhas") or 0)
    except Exception:
        try:
            return dados_colecao.count_documents({"usuario_id": usuario_id}), 0
        except Exception:
            return 0, 0


def obter_uso_plataforma():
    usuario_id = session.get("usuario_id")
    nome = session.get("usuario_nome") or "Usuário"
    email = session.get("usuario_email") or ""

    user_doc = None
    mapeamento = {}
    mapeamento_fin = {}
    if usuario_id:
        try:
            user_doc = usuario.find_one({"_id": ObjectId(usuario_id)})
        except Exception:
            user_doc = None
        if user_doc:
            mapeamento = user_doc.get("mapeamento") or {}
            mapeamento_fin = user_doc.get("mapeamento_financeiro") or {}
            if not email:
                email = user_doc.get("email") or ""

    total_planilhas, total_linhas = _contar_linhas_planilhas(usuario_id) if usuario_id else (0, 0)

    analises_sessao = session.get("analises_realizadas") or []
    relatorios_sessao = session.get("relatorios_gerados") or []

    analises_salvas = 0
    relatorios_salvos = 0
    conversas_ia = 0
    graficos_salvos = 0
    if usuario_id:
        try:
            analises_salvas = analises_salvas_colecao.count_documents({"usuario_id": str(usuario_id)})
        except Exception:
            analises_salvas = 0
        try:
            relatorios_salvos = relatorios_colecao.count_documents({"usuario_id": str(usuario_id)})
        except Exception:
            relatorios_salvos = 0
        try:
            conversas_ia = chat_historico.count_documents({
                "usuario_id": usuario_id,
                "remetente": "user",
            })
        except Exception:
            conversas_ia = 0
        try:
            graficos_salvos = galeria.count_documents({"usuario_id": usuario_id})
        except Exception:
            graficos_salvos = 0

    tem_mapeamento = bool(
        (isinstance(mapeamento, dict) and any(mapeamento.values()))
        or (isinstance(mapeamento_fin, dict) and any(
            v for k, v in mapeamento_fin.items() if not str(k).startswith("_")
        ))
    )
    tem_analise = len(analises_sessao) > 0 or analises_salvas > 0
    tem_relatorio = relatorios_salvos > 0 or len(relatorios_sessao) > 0
    tem_ia = conversas_ia > 0

    etapas = [
        {
            "id": "conta",
            "titulo": "Conta criada",
            "descricao": "Você já tem acesso ao DataInsight.",
            "feito": True,
            "endpoint": None,
            "icone": "fa-user-check",
        },
        {
            "id": "dados",
            "titulo": "Dados importados",
            "descricao": "Envie planilhas para o painel enxergar o negócio.",
            "feito": total_planilhas > 0,
            "endpoint": "pagina_dados",
            "cta_label": "Importar dados",
            "icone": "fa-file-csv",
        },
        {
            "id": "mapeamento",
            "titulo": "Colunas mapeadas",
            "descricao": "Ligue receita, despesa e data para os gráficos fazerem sentido.",
            "feito": tem_mapeamento,
            "endpoint": "pagina_dados",
            "cta_label": "Mapear colunas",
            "icone": "fa-diagram-project",
        },
        {
            "id": "analise",
            "titulo": "Primeira análise",
            "descricao": "Gere uma leitura das métricas para decidir com evidência.",
            "feito": tem_analise,
            "endpoint": "pagina_analise",
            "cta_label": "Gerar análise",
            "icone": "fa-chart-line",
        },
        {
            "id": "relatorio",
            "titulo": "Relatório gerado",
            "descricao": "Documente o período para compartilhar com a equipe.",
            "feito": tem_relatorio,
            "endpoint": "pagina_relatorio",
            "cta_label": "Criar relatório",
            "icone": "fa-file-pdf",
        },
        {
            "id": "ia",
            "titulo": "Perguntou à IA",
            "descricao": "Use o assistente para achar gargalos e próximas ações.",
            "feito": tem_ia,
            "endpoint": "pagina_ia",
            "cta_label": "Abrir IA",
            "icone": "fa-robot",
        },
    ]

    feitas = sum(1 for e in etapas if e["feito"])
    progresso = round((feitas / len(etapas)) * 100) if etapas else 0

    if progresso >= 85:
        nivel = "Uso pleno"
        nivel_hint = "Você já cobre o ciclo completo: dados, análise, relatório e IA."
    elif progresso >= 65:
        nivel = "Avançado"
        nivel_hint = "O essencial está no ar. Falta pouco para o uso completo."
    elif progresso >= 40:
        nivel = "Em operação"
        nivel_hint = "Os dados já entram. O próximo passo é transformar isso em decisão."
    elif progresso >= 20:
        nivel = "Explorando"
        nivel_hint = "A conta está pronta. Importe dados para começar a ver o negócio."
    else:
        nivel = "Iniciante"
        nivel_hint = "Comece importando uma planilha para destravar o painel."

    proxima = next((e for e in etapas if not e["feito"]), None)

    return {
        "nome": nome,
        "email": email,
        "iniciais": _iniciais(nome),
        "membro_desde": _membro_desde(usuario_id, user_doc),
        "total_planilhas": total_planilhas,
        "total_linhas": total_linhas,
        "total_analises": len(analises_sessao) + analises_salvas,
        "total_relatorios": max(len(relatorios_sessao), relatorios_salvos),
        "total_ia": conversas_ia,
        "total_graficos": graficos_salvos,
        "etapas": etapas,
        "etapas_feitas": feitas,
        "etapas_total": len(etapas),
        "progresso": progresso,
        "nivel": nivel,
        "nivel_hint": nivel_hint,
        "proxima": proxima,
    }


def pagina_perfil():
    usuario_id = session.get("usuario_id")
    ultimos_relatorios = []
    if usuario_id:
        try:
            cursor = relatorios_colecao.find({"usuario_id": str(usuario_id)}).sort("criado_em", -1).limit(4)
            for doc in cursor:
                ultimos_relatorios.append({
                    "id": str(doc["_id"]),
                    "nome": doc.get("nome", "Relatório"),
                    "periodo": doc.get("periodo", ""),
                    "data": doc.get("data", ""),
                    "kpis": doc.get("kpis", {}),
                })
        except Exception:
            pass

    if not ultimos_relatorios:
        ultimos_relatorios = (session.get("relatorios_gerados") or [])[:4]

    ultimas_analises = (session.get("analises_realizadas") or [])[:5]
    uso = obter_uso_plataforma()

    return render_template(
        "perfil.html",
        ultimos_relatorios=ultimos_relatorios,
        ultimas_analises=ultimas_analises,
        uso=uso,
    )
