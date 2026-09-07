import re
import traceback
from datetime import datetime
from typing import Optional

import pandas as pd
from flask import jsonify, request, session

from backend.db import chat_historico, galeria
from .orchestrator import obter_time_agentes
from .tts import sintetizar_resposta_voz
from .rag_helpers import montar_contexto_rag


# ================================================================
# TERMOS TÉCNICOS QUE NUNCA DEVEM APARECER NA RESPOSTA AO USUÁRIO
# ================================================================
_PREFIXOS_TECNICOS = [
    r"Com base estritamente no contexto recuperado do banco de dados \(RAG\)[,:]?",
    r"Com base no contexto RAG[,:]?",
    r"Com base estritamente no contexto RAG[,:]?",
    r"Com base nos dados recuperados do banco de dados[,:]?",
    r"Com base nos dados do MongoDB[,:]?",
    r"De acordo com o contexto RAG[,:]?",
    r"Baseado no contexto recuperado[,:]?",
    r"A partir do contexto recuperado do banco[,:]?",
    r"Analisando o contexto fornecido \(RAG\)[,:]?",
]

_TERMOS_TECNICOS = [
    (r"\bRAG\b", "análise"),
    (r"\bMongoDB\b", "sistema"),
    (r"\bcoleção dados\b", "registros"),
    (r"\bcoleção\b", "registros"),
    (r"\bcontexto recuperado\b", "dados disponíveis"),
    (r"\bcontexto RAG\b", "dados disponíveis"),
    (r"banco de dados", "sistema"),
    (r"\bembedding\b", "análise"),
    (r"\bchunk\b", "trecho"),
    (r"\bLLM\b", "IA"),
    (r"\bGemini\b", "IA"),
    (r"\bbackend\b", "sistema"),
    (r"\bquery\b", "consulta"),
    (r"\bdataset\b", "dados"),
    (r"`ano_atual`", "ano atual"),
    (r"`30_dias`", "últimos 30 dias"),
    (r"`7_dias`", "últimos 7 dias"),
    (r"`90_dias`", "últimos 90 dias"),
]


def _limpar_termos_tecnicos(texto: str) -> str:
    """Remove ou substitui termos técnicos da resposta da IA de forma segura."""
    if not texto:
        return texto
    # Remove prefixos técnicos apenas no início do texto ou após tags de abertura
    for padrao in _PREFIXOS_TECNICOS:
        texto = re.sub(r"^(?:<p>)?\s*" + padrao + r"\s*", "<p>", texto, flags=re.IGNORECASE).strip()
        texto = re.sub(r"^" + padrao + r"\s*", "", texto, flags=re.IGNORECASE).strip()
    # Substitui termos técnicos por equivalentes amigáveis
    for padrao, substituto in _TERMOS_TECNICOS:
        texto = re.sub(padrao, substituto, texto, flags=re.IGNORECASE)
    return texto


def _balancear_tags_html(html: str) -> str:
    """Garante que todas as tags HTML abertas sejam fechadas corretamente."""
    if not html:
        return html
    tags_para_fechar = ['span', 'strong', 'em', 'li', 'ul', 'ol', 'p', 'div', 'h3', 'h4', 'h5', 'h6']
    for tag in tags_para_fechar:
        aberturas = len(re.findall(rf"<{tag}(?:[\s>][^>]*)?>", html, flags=re.IGNORECASE))
        fechamentos = len(re.findall(rf"</{tag}>", html, flags=re.IGNORECASE))
        if aberturas > fechamentos:
            html += f"</{tag}>" * (aberturas - fechamentos)
    return html


def converter_markdown_para_html(texto: str) -> str:
    """
    Converte Markdown e HTML de forma robusta e balanceada.
    Garante que respostas completas sejam exibidas com excelência no modal.
    """
    if not texto or not texto.strip():
        return texto

    texto = _limpar_termos_tecnicos(texto)

    # Se já é um HTML bem estruturado com tags completas, apenas balanceia e retorna
    if re.search(r"<(h[1-6]|ul|ol|p|div)[\ >]", texto) and not re.search(r"^#{1,4}\s+", texto, flags=re.MULTILINE):
        return _balancear_tags_html(texto)

    linhas = texto.split("\n")
    html_linhas = []
    dentro_lista = False

    for linha in linhas:
        linha_strip = linha.strip()

        if not linha_strip:
            if dentro_lista:
                html_linhas.append("</ul>")
                dentro_lista = False
            continue

        # Títulos: ### ## #
        m = re.match(r"^(#{1,4})\s+(.+)$", linha_strip)
        if m:
            nivel = len(m.group(1))
            conteudo = _processar_inline(m.group(2))
            tag = f"h{min(nivel + 2, 5)}"  # ### → h5, ## → h4, # → h3
            style = "margin-top:16px;margin-bottom:6px;font-size:1rem;font-weight:700;color:var(--texto);"
            if dentro_lista:
                html_linhas.append("</ul>")
                dentro_lista = False
            html_linhas.append(f"<{tag} style='{style}'>{conteudo}</{tag}>")
            continue

        # Itens de lista: * item ou - item ou 1. item
        m_lista = re.match(r"^[\*\-\+]\s+(.+)$", linha_strip) or re.match(r"^\d+\.\s+(.+)$", linha_strip)
        if m_lista:
            conteudo = _processar_inline(m_lista.group(1))
            if not dentro_lista:
                html_linhas.append("<ul style='margin:6px 0 6px 18px;padding:0;'>")
                dentro_lista = True
            html_linhas.append(f"<li style='margin-bottom:4px;'>{conteudo}</li>")
            continue

        # Linha normal → parágrafo
        if dentro_lista:
            html_linhas.append("</ul>")
            dentro_lista = False
            
        if linha_strip.startswith("<") and linha_strip.endswith(">"):
            html_linhas.append(linha_strip)
        else:
            conteudo = _processar_inline(linha_strip)
            html_linhas.append(f"<p style='margin:6px 0;line-height:1.6;'>{conteudo}</p>")

    if dentro_lista:
        html_linhas.append("</ul>")

    resultado = "\n".join(html_linhas)
    return _balancear_tags_html(resultado)


def _processar_inline(texto: str) -> str:
    """Converte formatação inline de Markdown para HTML."""
    # **negrito** e __negrito__
    texto = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", texto)
    texto = re.sub(r"__(.+?)__", r"<strong>\1</strong>", texto)
    # *itálico* e _itálico_
    texto = re.sub(r"\*(.+?)\*", r"<em>\1</em>", texto)
    texto = re.sub(r"_(.+?)_", r"<em>\1</em>", texto)
    # `código` inline
    texto = re.sub(r"`([^`]+)`", r"<code>\1</code>", texto)
    return texto


def salvar_mensagem_historico(usuario_id: str, remetente: str, mensagem: str, sessao_id: str) -> None:
    try:
        chat_historico.insert_one({
            "usuario_id": usuario_id,
            "sessao_id": sessao_id,
            "remetente": remetente,
            "mensagem": mensagem,
            "data": datetime.now(),
        })
    except Exception as err:
        print(f"[Erro Historico DB]: {err}")


def buscar_sessoes_chatbot():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    pipeline = [
        {"$match": {"usuario_id": usuario_id}},
        {"$sort": {"data": 1}},
        {"$group": {
            "_id": "$sessao_id",
            "primeira_mensagem": {"$first": "$mensagem"},
            "data_criacao": {"$first": "$data"},
        }},
        {"$sort": {"data_criacao": -1}},
    ]

    sessoes = list(chat_historico.aggregate(pipeline))
    resultado = []

    for s in sessoes:
        msg = s.get("primeira_mensagem", "")
        titulo = (msg[:30] + "...") if len(msg) > 30 else msg
        if "Olá! Sou seu Time" in titulo:
            titulo = "Conversa Padrão"

        resultado.append({
            "sessao_id": s["_id"],
            "titulo": titulo,
        })

    return jsonify({"sessoes": resultado})


def buscar_historico_chatbot():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    sessao_id = request.args.get("sessao_id")
    u_ids = [usuario_id, str(usuario_id)]
    try:
        from bson import ObjectId
        if ObjectId.is_valid(str(usuario_id)):
            u_ids.append(ObjectId(str(usuario_id)))
    except Exception:
        pass

    query = {"usuario_id": {"$in": u_ids}}
    if sessao_id:
        query["sessao_id"] = sessao_id

    docs = chat_historico.find(query).sort("data", 1)
    historico = [
        {
            "remetente": doc["remetente"],
            "mensagem": doc["mensagem"],
            "data": doc["data"].strftime("%d/%m %H:%M") if doc.get("data") else "",
        }
        for doc in docs
    ]
    return jsonify({"historico": historico})


def buscar_ultima_resposta_chatbot():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    u_ids = [usuario_id, str(usuario_id)]
    try:
        from bson import ObjectId
        if ObjectId.is_valid(str(usuario_id)):
            u_ids.append(ObjectId(str(usuario_id)))
    except Exception:
        pass

    docs = list(chat_historico.find({"usuario_id": {"$in": u_ids}, "remetente": "bot"}).sort("data", -1).limit(10))

    if not docs:
        return jsonify({
            "resposta": "Ainda não há resposta da IA registrada.",
            "mensagens": []
        }), 200

    mensagens_lista = []
    for d in docs:
        msg_texto = d.get("mensagem", "") or ""
        sessao_id = d.get("sessao_id")
        data_dt = d.get("data")
        data_str = data_dt.strftime("%d/%m %H:%M") if data_dt else ""

        # Busca pergunta correspondente do usuário
        pergunta_texto = ""
        try:
            if sessao_id and data_dt:
                user_msg = chat_historico.find_one(
                    {"usuario_id": {"$in": u_ids}, "remetente": "user", "sessao_id": sessao_id, "data": {"$lte": data_dt}},
                    sort=[("data", -1)]
                )
                if user_msg:
                    pergunta_texto = user_msg.get("mensagem", "")
        except Exception:
            pass

        # Verifica se há gráfico associado na galeria
        gal_item = None
        try:
            if sessao_id:
                gal_item = galeria.find_one({"usuario_id": {"$in": u_ids}, "sessao_id": sessao_id})
        except Exception:
            pass

        tem_grafico = bool("grafico-ia-render" in msg_texto or gal_item)
        grafico_info = None
        if gal_item:
            grafico_info = {
                "tipo": gal_item.get("tipo", "linha"),
                "periodo": gal_item.get("periodo", "30_dias"),
                "titulo": gal_item.get("titulo", "Análise Visual da IA"),
                "metricas": gal_item.get("metricas", "faturamento,lucro")
            }

        mensagens_lista.append({
            "id": str(d.get("_id")),
            "resposta": msg_texto,
            "sessao_id": sessao_id,
            "data": data_str,
            "pergunta": pergunta_texto,
            "tem_grafico": tem_grafico,
            "grafico_info": grafico_info
        })

    ultima = docs[0]
    return jsonify({
        "resposta": ultima.get("mensagem", ""),
        "sessao_id": ultima.get("sessao_id"),
        "data": ultima.get("data").strftime("%d/%m %H:%M") if ultima.get("data") else None,
        "mensagens": mensagens_lista,
        "total": len(mensagens_lista)
    })



def limpar_historico_chatbot():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    try:
        sessao_id = request.args.get("sessao_id")
        filtros = {"usuario_id": usuario_id}
        if sessao_id:
            filtros["sessao_id"] = sessao_id

        chat_historico.delete_many(filtros)
        return jsonify({"success": True})
    except Exception as err:
        return jsonify({"erro": str(err)}), 500


def _texto_curto_historico(mensagem: str, limite: int = 280) -> str:
    texto = re.sub(r"<[^>]+>", " ", mensagem or "")
    texto = re.sub(r"\s+", " ", texto).strip()
    if len(texto) > limite:
        return texto[:limite] + "…"
    return texto


PERSONAS_AGENTES = {
    "agente_financeiro": {
        "nome": "Agente Financeiro",
        "icone": "fa-coins",
        "cor": "#10B981",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o AGENTE FINANCEIRO especialista em fluxo de caixa, custos, despesas e margem líquida. "
            "Sua resposta deve priorizar: diagnóstico de liquidez, despesas fixas/variáveis, ponto de equilíbrio e 3 recomendações de blindagem do caixa."
        )
    },
    "agente_vendas": {
        "nome": "Agente de Vendas & Performance",
        "icone": "fa-chart-bar",
        "cor": "#3B82F6",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o AGENTE DE VENDAS especialista em receita e produtos. "
            "Sua resposta deve priorizar: ranking dos produtos/serviços mais vendidos e lucrativos, ticket médio, sazonalidade e oportunidades de alavancagem comercial."
        )
    },
    "agente_decisao": {
        "nome": "Agente Estratégico & SWOT",
        "icone": "fa-brain",
        "cor": "#7C3AED",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o AGENTE ESTRATÉGICO especialista em cenários e Análise SWOT. "
            "Sua resposta deve priorizar: Forças, Fraquezas, Oportunidades, Ameaças e plano de ação tático executivo para os próximos períodos."
        )
    },
    "agente_dados": {
        "nome": "Agente de Dados & Sanitização",
        "icone": "fa-broom-ball",
        "cor": "#06B6D4",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o AUDITOR E ENGENHEIRO DE DADOS. "
            "Sua resposta deve priorizar: consistência dos dados, completude, identificação de anomalias de preenchimento, nulos e integridade das colunas."
        )
    },
    "agente_alertas": {
        "nome": "Sentinela de Alertas",
        "icone": "fa-bell",
        "cor": "#F59E0B",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o SENTINELA DE ALERTAS E ANOMALIAS. "
            "Sua resposta deve priorizar: detecção de dados discrepantes, faturamentos atípicos, variações bruscas de despesas e alertas preventivos imediatos."
        )
    },
    "smart": {
        "nome": "Smart Copiloto IA",
        "icone": "fa-robot",
        "cor": "#3B82F6",
        "diretriz": (
            "ATUAÇÃO OBRIGATÓRIA: Você é o COPILOTO INTELIGENTE INTEGRADO do DataInsight com time multidisciplinar de especialistas de dados. "
            "Apresente uma resposta concisa, executiva e altamente estruturada combinando finanças, vendas e visão analítica."
        )
    }
}


def perguntar_chatbot():
    try:
        dados = request.get_json() or {}
        mensagem_usuario = dados.get("mensagem")
        sessao_id = dados.get("sessao_id", "default")
        usuario_id = session.get("usuario_id")
        incluir_voz = bool(dados.get("incluir_voz"))
        agente_selecionado = dados.get("agente_selecionado", "smart")
        ferramenta = dados.get("ferramenta")

        if not mensagem_usuario:
            return jsonify({"erro": "Mensagem não fornecida"}), 400

        persona_info = PERSONAS_AGENTES.get(agente_selecionado, PERSONAS_AGENTES["smart"])

        contexto_str = ""
        if usuario_id:
            ultimas = chat_historico.find(
                {"usuario_id": usuario_id, "sessao_id": sessao_id}
            ).sort("data", -1).limit(4)

            for m in reversed(list(ultimas)):
                papel = "Usuário" if m["remetente"] == "user" else "Assistente"
                contexto_str += f"{papel}: {_texto_curto_historico(m.get('mensagem', ''))}\n"

            salvar_mensagem_historico(usuario_id, "user", mensagem_usuario, sessao_id)

        tabela_id = dados.get("tabela_id", "todas")
        contexto_rag = montar_contexto_rag(usuario_id, mensagem_usuario, top_k=4, tabela_id=tabela_id)
        from .rag_helpers import montar_prompt_com_rag
        from .orchestrator import obter_time_agentes

        # Injeção de persona e ferramentas
        diretivas_especiais = f"\n[DIRETRIZ DO AGENTE ATIVO]: {persona_info['diretriz']}\n"

        quer_grafico = ferramenta == "grafico" or any(p in mensagem_usuario.lower() for p in ["gráfico", "grafico", "desenhe um gráfico", "plote"])
        if quer_grafico:
            diretivas_especiais += (
                "\n[REQUISITO DE GRÁFICO]: O usuário solicitou um gráfico interativo. "
                "Após a explicação dos dados, você DEVE INCLUIR A SEGUINTE TAG HTML na sua resposta para renderização do gráfico interativo:\n"
                '<div class="grafico-ia-render" data-periodo="30_dias" data-tipo="linha" data-metricas="faturamento,lucro" data-titulo="Evolução de Faturamento e Lucro"></div>\n'
                "(Ajuste data-tipo para 'linha', 'barras' ou 'pizza' conforme mais adequado aos dados).\n"
            )

        quer_tabela = ferramenta == "tabela" or any(p in mensagem_usuario.lower() for p in ["tabela", "quadro", "tabela de métricas", "grade"])
        if quer_tabela:
            diretivas_especiais += (
                "\n[REQUISITO DE TABELA]: O usuário solicitou uma tabela. "
                "Organize os dados comparativos em uma tabela HTML estruturada com a classe 'ia-table-render' contendo <thead> com colunas claras e <tbody> com linhas e valores formatados.\n"
            )

        prompt_base = montar_prompt_com_rag(mensagem_usuario, contexto_rag, contexto_str)
        prompt_final = f"{diretivas_especiais}\n{prompt_base}"

        orquestrador = obter_time_agentes()
        try:
            resposta_obj = orquestrador.run(prompt_final)
            resposta_texto = resposta_obj.content
            falhas_reais = (
                'integração com a api gemini não está configurada',
                'não consegui contatar a api gemini',
            )
            if isinstance(resposta_texto, str) and any(s in resposta_texto.lower() for s in falhas_reais):
                print('[Chatbot] Orquestrador externo indisponível — usando fallback local')
                from .rag_helpers import gerar_resposta_fallback
                resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)
        except Exception as e:
            print('[Erro Orquestrador]:', e)
            traceback.print_exc()
            from .rag_helpers import gerar_resposta_fallback
            resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)

        # Pós-processamento: converter Markdown→HTML e limpar termos técnicos
        resposta_texto = converter_markdown_para_html(resposta_texto)

        if usuario_id:
            div_matches = re.finditer(r"<div\s+class=['\"]grafico-ia-render['\"]([^>]*)>", resposta_texto)
            for div in div_matches:
                attrs = div.group(1)
                p_match = re.search(r"data-periodo=['\"]([^'\"]+)['\"]", attrs)
                t_match = re.search(r"data-tipo=['\"]([^'\"]+)['\"]", attrs)
                tit_match = re.search(r"data-titulo=['\"]([^'\"]+)['\"]", attrs)
                m_match = re.search(r"data-metricas=['\"]([^'\"]+)['\"]", attrs)

                galeria.insert_one({
                    "usuario_id": usuario_id,
                    "sessao_id": sessao_id,
                    "periodo": p_match.group(1) if p_match else "30_dias",
                    "tipo": t_match.group(1) if t_match else "linha",
                    "titulo": tit_match.group(1) if tit_match else "Gráfico Renderizado",
                    "metricas": m_match.group(1) if m_match else "faturamento,lucro",
                    "criado_em": datetime.now(),
                })

            salvar_mensagem_historico(usuario_id, "bot", resposta_texto, sessao_id)

        resposta_voz = sintetizar_resposta_voz(resposta_texto) if incluir_voz else None
        payload = {
            "resposta": resposta_texto,
            "resposta_voz": bool(resposta_voz),
            "rag": True,
            "agente": agente_selecionado,
            "agente_nome": persona_info["nome"],
            "agente_icone": persona_info["icone"],
            "agente_cor": persona_info["cor"]
        }

        if resposta_voz:
            b64, mimetype = resposta_voz
            payload["resposta_voz_base64"] = b64
            payload["resposta_voz_mimetype"] = mimetype

        return jsonify(payload)

    except Exception as err:
        print(f"[Erro Chatbot Endpoint]: {err}")
        traceback.print_exc()
        return jsonify({
            "resposta": "Desculpe, ocorreu um erro interno ao processar sua requisição.",
            "erro_debug": str(err)
        }), 500


def gerar_insight_diario():
    try:
        periodo = request.args.get("periodo", "30_dias")
        tabela_id = request.args.get("tabela_id", "todas")
        usuario_id = session.get("usuario_id")
        orquestrador = obter_time_agentes()

        pergunta_rag = f"insights financeiros do período {periodo} com resumo alerta e estratégia"
        contexto_rag = montar_contexto_rag(usuario_id, pergunta_rag, top_k=4, tabela_id=tabela_id)

        prompt = (
            f"Com base no contexto RAG abaixo, gere exatamente 3 bullet points "
            f"de insights executivos diretos sobre o período ({periodo}). "
            "Forneça um resumo geral de faturamento/volume, um alerta de despesas/atenção e uma recomendação estratégica prática. "
            "Formate a resposta EXATAMENTE com 3 divs HTML, sem qualquer formatação em markdown (sem ``` ou *). "
            "Exemplo:\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Resumo:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Alerta:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Estratégia:</strong> ...</p></div>\n\n"
            f"=== CONTEXTO RAG ===\n{contexto_rag}\n=== FIM ==="
        )

        try:
            resposta = orquestrador.run(prompt)
            conteudo = getattr(resposta, "content", "").strip() if resposta else ""
            if not conteudo or any(s in conteudo.lower() for s in [
                'não foi possível', 'desculpe', 'não consegui contatar', 'não consegui', 'erro'
            ]):
                raise ValueError('Orquestrador externo retornou resposta inválida')

            conteudo = re.sub(r"^```(html)?", "", conteudo, flags=re.IGNORECASE)
            conteudo = re.sub(r"```$", "", conteudo).replace("*", "").strip()
            return jsonify({"html": conteudo, "insight": conteudo})

        except Exception as err:
            print('[Erro Orquestrador Insight Diário - Usando Fallback Estruturado]:', err)

            resumo_html = f"Volume de dados analisado para o período ({periodo.replace('_', ' ')}). Métricas monitoradas com sucesso."
            anomalia_html = "Mantenha o monitoramento contínuo das categorias de despesas operacionais para evitar estouro orçamentário."
            recomendacao = "Recomenda-se priorizar produtos/serviços de maior margem e controlar prazos médios de recebimento."

            fallback_html = (
                f"<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                f"<p class='p mb-0'><strong>Resumo:</strong> {resumo_html}</p></div>"
                f"<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                f"<p class='p mb-0'><strong>Alerta:</strong> {anomalia_html}</p></div>"
                f"<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                f"<p class='p mb-0'><strong>Estratégia:</strong> {recomendacao}</p></div>"
            )
            return jsonify({"html": fallback_html, "insight": fallback_html})

    except Exception as err:
        print(f"[Erro Insight Diário]: {err}")
        fallback = (
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
            "<p class='p mb-0'><strong>Resumo:</strong> Monitoramento ativo de métricas e indicadores financeiros.</p></div>"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
            "<p class='p mb-0'><strong>Alerta:</strong> Verifique as contas a pagar e despesas variáveis do período.</p></div>"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
            "<p class='p mb-0'><strong>Estratégia:</strong> Otimize a gestão de capital de giro e reduza custos operacionais.</p></div>"
        )
        return jsonify({"html": fallback, "insight": fallback})
