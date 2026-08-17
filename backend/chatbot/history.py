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
    query = {"usuario_id": usuario_id}
    if sessao_id:
        query["sessao_id"] = sessao_id

    docs = chat_historico.find(query).sort("data", 1)
    historico = [
        {
            "remetente": doc["remetente"],
            "mensagem": doc["mensagem"],
            "data": doc["data"].strftime("%d/%m %H:%M"),
        }
        for doc in docs
    ]
    return jsonify({"historico": historico})


def buscar_ultima_resposta_chatbot():
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    doc = chat_historico.find({"usuario_id": usuario_id, "remetente": "bot"}).sort("data", -1).limit(1)
    ultima = None
    for item in doc:
        ultima = item
        break

    if not ultima:
        return jsonify({"resposta": "Ainda não há resposta da IA registrada."}), 200

    return jsonify({
        "resposta": ultima.get("mensagem", ""),
        "sessao_id": ultima.get("sessao_id"),
        "data": ultima.get("data").strftime("%d/%m %H:%M") if ultima.get("data") else None,
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


def perguntar_chatbot():
    try:
        dados = request.get_json() or {}
        mensagem_usuario = dados.get("mensagem")
        sessao_id = dados.get("sessao_id", "default")
        usuario_id = session.get("usuario_id")

        if not mensagem_usuario:
            return jsonify({"erro": "Mensagem não fornecida"}), 400

        contexto_str = ""
        if usuario_id:
            ultimas = chat_historico.find(
                {"usuario_id": usuario_id, "sessao_id": sessao_id}
            ).sort("data", -1).limit(6)

            for m in reversed(list(ultimas)):
                papel = "Usuário" if m["remetente"] == "user" else "Assistente"
                contexto_str += f"{papel}: {m['mensagem']}\n"

            salvar_mensagem_historico(usuario_id, "user", mensagem_usuario, sessao_id)

        contexto_rag = montar_contexto_rag(usuario_id, mensagem_usuario, top_k=5)
        from .rag_helpers import montar_prompt_com_rag
        from .orchestrator import obter_time_agentes

        prompt_final = montar_prompt_com_rag(mensagem_usuario, contexto_rag, contexto_str)

        orquestrador = obter_time_agentes()
        try:
            resposta_obj = orquestrador.run(prompt_final)
            resposta_texto = resposta_obj.content
            if isinstance(resposta_texto, str) and any(s in resposta_texto.lower() for s in [
                'integração com a api gemini não está configurada',
                'não consegui contatar a api gemini',
                'não foi possível',
                'sem dados suficientes',
                'não foi possível extrair',
                'erro',
            ]):
                print('[Chatbot] Orquestrador externo indicou falha — usando fallback local')
                from .rag_helpers import gerar_resposta_fallback
                resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)
        except Exception as e:
            print('[Erro Orquestrador]:', e)
            traceback.print_exc()
            from .rag_helpers import gerar_resposta_fallback
            resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)

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

        resposta_voz = sintetizar_resposta_voz(resposta_texto)
        payload = {
            "resposta": resposta_texto,
            "resposta_voz": bool(resposta_voz),
            "rag": True,
        }

        if resposta_voz:
            b64, mimetype = resposta_voz
            payload["resposta_voz_base64"] = b64
            payload["resposta_voz_mimetype"] = mimetype

        return jsonify(payload)

    except Exception as err:
        print(f"[Erro Chatbot Endpoint]: {err}")
        return jsonify({
            "resposta": "Desculpe, ocorreu um erro interno ao processar sua requisição."
        }), 500


def gerar_insight_diario():
    try:
        periodo = request.args.get("periodo", "30_dias")
        usuario_id = session.get("usuario_id")
        orquestrador = obter_time_agentes()

        pergunta_rag = f"insights financeiros do período {periodo} com resumo alerta e estratégia"
        contexto_rag = montar_contexto_rag(usuario_id, pergunta_rag, top_k=4)

        prompt = (
            f"Com base EXCLUSIVAMENTE no contexto RAG abaixo, gere exatamente 3 bullet points "
            f"de insights diretos e curtos sobre os dados do período ({periodo}). "
            "Forneça um resumo geral, um alerta de despesas/anomalias e uma recomendação estratégica. "
            "Formate a resposta EXATAMENTE com 3 divs HTML, sem qualquer formatação em markdown (sem ``` ou *). "
            "Exemplo:\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Resumo:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Alerta:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Estratégia:</strong> ...</p></div>\n\n"
            f"=== CONTEXTO RAG ===\n{contexto_rag}\n=== FIM ==="
        )

        try:
            resposta = orquestrador.run(prompt)
            conteudo = resposta.content.strip()
            if isinstance(conteudo, str) and any(s in conteudo.lower() for s in [
                'não foi possível', 'desculpe', 'erro', 'não consegui contatar', 'não consegui',
                'sem dados suficientes', 'não foi possível extrair'
            ]):
                raise ValueError('Orquestrador externo retornou erro')

            conteudo = re.sub(r"^```(html)?", "", conteudo, flags=re.IGNORECASE)
            conteudo = re.sub(r"```$", "", conteudo).replace("*", "").strip()
            return jsonify({"html": conteudo})
        except Exception as err:
            print('[Erro Orquestrador Insight Diário]:', err)
            traceback.print_exc()

            documento = montar_contexto_rag(usuario_id, pergunta_rag, top_k=4)
            # fallback building similar to original
            from .rag_helpers import _resumo_kpis_do_df, _chunk_categorias, detectar_anomalias_despesas
            documento = None
            # reuse functions from rag_helpers by loading data locally
            # Build fallback HTML
            resumo_html = 'Dados insuficientes.'
            anomalia_html = 'Dados insuficientes.'
            recomendacao = 'Considere revisar as categorias com maior custo e otimizar margens.'

            fallback_html = (
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Resumo:</strong> "
                + resumo_html +
                "</p></div>"
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Alerta:</strong> "
                + anomalia_html +
                "</p></div>"
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Estratégia:</strong> "
                + recomendacao +
                "</p></div>"
            )
            return jsonify({"html": fallback_html})

    except Exception as err:
        print(f"[Erro Insight Diário]: {err}")
        fallback = (
            "<div class='p-3 rounded' style='background: var(--cartao);'>"
            "<p class='p mb-0'><strong>⚠️ Aviso:</strong> Não foi possível carregar os insights automáticos no momento.</p>"
            "</div>"
        )
        return jsonify({"html": fallback})
