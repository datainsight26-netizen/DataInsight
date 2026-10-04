# ==============================================================================
# ia_routes.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import re
import json
import traceback
from datetime import datetime

from bson import ObjectId
from flask import Blueprint, render_template, request, jsonify, session, send_file

from backend.routes.auth_routes import login_required
from backend.db import analises_salvas_colecao
from backend.chatbot.chatbot import (
    buscar_ultima_resposta_chatbot,
    perguntar_chatbot,
    sintetizar_texto_voz,
    buscar_sessoes_chatbot,
    buscar_historico_chatbot,
    limpar_historico_chatbot,
    exportar_dados_usuario,
    gerar_insight_diario,
    obter_time_agentes,
)
from backend.chatbot.history import converter_markdown_para_html, _limpar_termos_tecnicos
from backend.chatbot.prompts import (
    gerar_prompt_planejamento,
    gerar_prompt_analise_pagina,
    formatar_moeda_brl,
)


# ==============================================================================
# 2. BLUEPRINT
# ==============================================================================

ia_bp = Blueprint("ia", __name__)


# ==============================================================================
# 3. IA HUB PAGES
# ==============================================================================

@ia_bp.route("/ia", endpoint="pagina_ia")
@login_required
def pagina_ia():
    return render_template("ia.html")


@ia_bp.route("/ia/financeiro", endpoint="pagina_ia_financeiro")
@login_required
def pagina_ia_financeiro():
    return render_template("ia-financeiro.html")


@ia_bp.route("/ia/decisoes", endpoint="pagina_ia_decisoes")
@login_required
def pagina_ia_decisoes():
    return render_template("ia-decisoes.html")


@ia_bp.route("/ia/operacional", endpoint="pagina_ia_operacional")
@login_required
def pagina_ia_operacional():
    return render_template("ia-operacional.html")


@ia_bp.route("/assistente-virtual", endpoint="pagina_assistente_virtual")
@ia_bp.route("/assistente", endpoint="pagina_assistente")
@login_required
def pagina_assistente_virtual():
    return render_template("assistente_virtual.html")


# ==============================================================================
# 4. DOWNLOADS & EXPORTAÇÃO IA
# ==============================================================================

@ia_bp.route("/api/download/<tipo>", endpoint="api_download_arquivo")
@login_required
def api_download_arquivo(tipo):
    return exportar_dados_usuario(tipo)


# ==============================================================================
# 5. CHATBOT API
# ==============================================================================

@ia_bp.route("/api/chatbot/perguntar", methods=["POST"], endpoint="perguntar")
@login_required
def perguntar():
    return perguntar_chatbot()


@ia_bp.route("/api/chatbot/sintetizar", methods=["POST"], endpoint="api_chatbot_sintetizar")
@login_required
def api_chatbot_sintetizar():
    dados = request.get_json() or {}
    texto = (dados.get("texto") or "").strip()
    if not texto:
        return jsonify({"erro": "Texto não fornecido."}), 400

    try:
        resposta_voz = sintetizar_texto_voz(texto)
    except Exception as e:
        print("Erro no endpoint /api/chatbot/sintetizar:", e)
        traceback.print_exc()
        return jsonify({
            "resposta_voz_base64": None,
            "resposta_voz_mimetype": None,
            "erro": "Falha interna ao sintetizar áudio",
        }), 200

    if not resposta_voz:
        return jsonify({
            "resposta_voz_base64": None,
            "resposta_voz_mimetype": None,
            "erro": "TTS indisponível",
        }), 200

    try:
        b64, mimetype = resposta_voz
    except Exception:
        b64, mimetype = (resposta_voz, "audio/wav")

    return jsonify({"resposta_voz_base64": b64, "resposta_voz_mimetype": mimetype}), 200


@ia_bp.route("/api/chatbot/sessoes", methods=["GET"], endpoint="api_sessoes_chatbot")
@login_required
def api_sessoes_chatbot():
    return buscar_sessoes_chatbot()


@ia_bp.route("/api/chatbot/historico", methods=["GET"], endpoint="api_historico_chat")
@login_required
def api_historico_chat():
    return buscar_historico_chatbot()


@ia_bp.route("/api/chatbot/ultima-resposta", methods=["GET"], endpoint="api_ultima_resposta_chatbot")
@login_required
def api_ultima_resposta_chatbot():
    return buscar_ultima_resposta_chatbot()


@ia_bp.route("/api/chatbot/historico/apagar", methods=["DELETE"], endpoint="api_apagar_historico")
@login_required
def api_apagar_historico():
    return limpar_historico_chatbot()


@ia_bp.route("/api/chatbot/exportar-documento", methods=["POST"], endpoint="api_exportar_documento")
@login_required
def api_exportar_documento():
    try:
        dados = request.get_json() or {}
        tipo = (dados.get("tipo") or "pdf").lower().strip()
        titulo = (dados.get("titulo") or "Relatório de Análise IA").strip()
        conteudo_html = dados.get("conteudo_html") or ""
        sessao_id = dados.get("sessao_id")
        metadados = dados.get("metadados") or {}
        usuario_id = session.get("usuario_id")

        if dados.get("conversa_completa"):
            from backend.chatbot.document_generator import compilar_conversa_para_documento
            compilado = compilar_conversa_para_documento(sessao_id or "", usuario_id or "")
            if compilado.get("conteudo_html"):
                conteudo_html = compilado["conteudo_html"]
            if not dados.get("titulo"):
                titulo = compilado.get("titulo", titulo)
            if not metadados and compilado.get("metadados"):
                metadados = compilado["metadados"]

        if not conteudo_html or not str(conteudo_html).strip():
            conteudo_html = "<p>Relatório de Análise DataInsight Copiloto IA</p>"

        from backend.chatbot.document_generator import (
            gerar_documento_docx,
            gerar_documento_xlsx,
            gerar_documento_pdf,
        )

        nome_base = re.sub(r'[\\/*?:"<>| ]', '_', titulo)[:45].strip('_') or "Relatorio_DataInsight"

        if tipo in ["docx", "word", "doc"]:
            buf = gerar_documento_docx(titulo, conteudo_html, metadados=metadados)
            return send_file(
                buf,
                mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                as_attachment=True,
                download_name=f"{nome_base}.docx"
            )
        elif tipo in ["xlsx", "excel", "planilha"]:
            buf = gerar_documento_xlsx(titulo, conteudo_html, metadados=metadados)
            return send_file(
                buf,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name=f"{nome_base}.xlsx"
            )
        else:
            buf = gerar_documento_pdf(titulo, conteudo_html, metadados=metadados)
            return send_file(
                buf,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=f"{nome_base}.pdf"
            )
    except Exception as err:
        print(f"[Erro Exportar Documento]: {err}")
        traceback.print_exc()
        return jsonify({"erro": f"Falha ao gerar documento: {str(err)}"}), 500


@ia_bp.route("/api/insight_diario", methods=["GET"], endpoint="api_insight_diario")
@login_required
def api_insight_diario():
    return gerar_insight_diario()


# ==============================================================================
# 6. IA — PLANEJAMENTO FINANCEIRO
# ==============================================================================

@ia_bp.route("/api/planejamento-financeiro/analise-ia", methods=["POST"], endpoint="api_analise_ia_planejamento")
@login_required
def api_analise_ia_planejamento():
    """Gera análise de IA para o planejamento financeiro baseado nos dados da tabela (usando prompts.py)"""
    try:
        dados_req = request.get_json() or {}
        scenario = dados_req.get("scenario", "otimista")
        ia_data = dados_req.get("data")

        if not ia_data:
            return jsonify({"sucesso": False, "mensagem": "Dados do planejamento não fornecidos."}), 400

        prompt = gerar_prompt_planejamento(scenario, ia_data)

        orquestrador = obter_time_agentes()
        diagnostico = ""
        alertas = ""
        recoms = []
        success = False

        # ----------------------------------------------------------------------
        # 6.1. Tentativa de gerar análise via IA
        # ----------------------------------------------------------------------
        try:
            resposta_obj = orquestrador.run(prompt)
            resposta_texto = resposta_obj.content.strip()

            if resposta_texto.startswith("```"):
                resposta_texto = re.sub(r"^```(?:json)?\n?", "", resposta_texto, flags=re.IGNORECASE)
                resposta_texto = re.sub(r"\n?```$", "", resposta_texto)
            resposta_texto = resposta_texto.strip()

            parsed = json.loads(resposta_texto)
            diagnostico = parsed.get("diagnostico_geral", "")
            alertas = parsed.get("alertas_riscos", "")
            recoms = parsed.get("recomendacoes", [])
            if diagnostico and alertas and len(recoms) >= 3:
                success = True
        except Exception as e:
            print("[Erro ao chamar / processar Gemini para Análise de Planejamento]:", e)

        # ----------------------------------------------------------------------
        # 6.2. Fallback determinístico quando a IA não responde adequadamente
        # ----------------------------------------------------------------------
        if not success:
            totals = ia_data.get("totals", {})
            meses = ia_data.get("meses", [])
            meses_pos = ia_data.get("mesesPos", 0)
            val_receita = totals.get("receita", 0)
            val_resultado = totals.get("resultado", 0)
            receita_total = formatar_moeda_brl(val_receita)
            resultado_total = formatar_moeda_brl(val_resultado)
            margem_pct = totals.get("margemPct", 0)

            diagnostico = (
                f"Análise executiva simplificada: O cenário {scenario} projeta uma receita total de "
                f"{receita_total} e resultado líquido anual de {resultado_total}, com uma margem de contribuição "
                f"média de {margem_pct:.1f}%. O desempenho operacional se mostra "
                f"{'saudável e superavitário' if val_resultado >= 0 else 'deficitário no acumulado do ano'}."
            )

            if val_resultado < 0:
                alertas = (
                    f"Risco de déficit financeiro anual acumulado em {formatar_moeda_brl(abs(val_resultado))}. "
                    f"A operaçao não está conseguindo cobrir todos os gastos fixos e variáveis projetados."
                )
            else:
                alertas = (
                    f"Apesar do resultado positivo, monitore a sazonalidade. "
                    f"Existem {len(meses) - meses_pos} meses projetados no vermelho que exigem atenção ao fluxo de caixa."
                    if meses_pos < len(meses) else
                    "Operação estável com todos os meses projetados em superávit."
                )

            recoms = [
                "Rever a precificação e buscar otimizar a margem de contribuição nos meses de menor movimento.",
                "Estabelecer um controle rigoroso sobre os gastos fixos para diminuir o ponto de equilíbrio operacional.",
                "Planejar a alocação de investimentos de expansão somente após a confirmação de meses com sobra de caixa."
            ]

        # ----------------------------------------------------------------------
        # 6.3. Resposta
        # ----------------------------------------------------------------------
        return jsonify({
            "sucesso": True,
            "diagnostico_geral": diagnostico,
            "alertas_riscos": alertas,
            "recomendacoes": recoms
        })
    except Exception as e:
        print("[Erro Rota IA Planejamento]:", e)
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


# ==============================================================================
# 7. IA — ANÁLISE UNIVERSAL POR PÁGINA
# ==============================================================================

@ia_bp.route("/api/analise-ia-pagina", methods=["POST"], endpoint="api_analise_ia_pagina")
@login_required
def api_analise_ia_pagina():
    """Gera diagnóstico completo com IA para todas as páginas (usando prompts.py)"""
    try:
        # ----------------------------------------------------------------------
        # 7.1. Leitura e preparação dos dados da requisição
        # ----------------------------------------------------------------------
        dados_req = request.get_json() or {}
        pagina = str(dados_req.get("pagina", "home")).strip().lower()
        contexto = dados_req.get("contexto", {}) or {}
        periodo = dados_req.get("periodo", contexto.get("periodo", "Período Selecionado"))

        origem = contexto.get(
            "origem",
            contexto.get("planilha", contexto.get("tabela_ativa", "Todas as Planilhas (Visão Consolidada)"))
        )
        if not origem or origem == "todas":
            origem = "Todas as Planilhas (Visão Consolidada)"

        is_usuario_mei = (
            (session.get("usuario_perfil") == "MEI")
            or (contexto.get("perfil") == "MEI")
            or (pagina in ["controles_essenciais", "controles-essenciais"])
        )

        # Obter prompt através do módulo isolado prompts.py
        prompt = gerar_prompt_analise_pagina(pagina, contexto, periodo, origem, is_usuario_mei)

        # ----------------------------------------------------------------------
        # 7.2. Chamada à IA
        # ----------------------------------------------------------------------
        orquestrador = obter_time_agentes()
        success = False
        parsed = {}

        try:
            resposta_obj = orquestrador.run(prompt)
            resposta_texto = resposta_obj.content.strip()

            if resposta_texto.startswith("```"):
                resposta_texto = re.sub(r"^```(?:json)?\n?", "", resposta_texto, flags=re.IGNORECASE)
                resposta_texto = re.sub(r"\n?```$", "", resposta_texto)
            resposta_texto = resposta_texto.strip()

            parsed = json.loads(resposta_texto)
            if parsed.get("diagnostico_geral") and len(parsed.get("recomendacoes", [])) >= 2:
                success = True
        except Exception as e:
            print(f"[Erro ao chamar Gemini em /api/analise-ia-pagina ({pagina})]:", e)

        # ----------------------------------------------------------------------
        # 7.3. Mapeamento de status → cor/ícone do veredito
        # ----------------------------------------------------------------------
        status = parsed.get("veredito_status", "positivo")
        cores_map = {
            "positivo": "#10b981",
            "neutro": "#3b82f6",
            "atencao": "#f59e0b",
            "critico": "#ef4444"
        }
        icones_map = {
            "positivo": "fa-bolt",
            "neutro": "fa-arrow-trend-up",
            "atencao": "fa-triangle-exclamation",
            "critico": "fa-triangle-exclamation"
        }

        cor_veredito = cores_map.get(status, "#3b82f6")
        icone_veredito = icones_map.get(status, "fa-circle-check")

        # ----------------------------------------------------------------------
        # 7.4. Preparação de textos exibidos (truncamento)
        # ----------------------------------------------------------------------
        origem_exibicao = str(origem).replace("🌐 ", "").strip()
        if len(origem_exibicao) > 24:
            origem_exibicao = origem_exibicao[:22] + "..."

        periodo_exibicao = str(periodo).strip()
        if len(periodo_exibicao) > 24:
            periodo_exibicao = periodo_exibicao[:22] + "..."

        # ----------------------------------------------------------------------
        # 7.5. Cards de métricas por página
        # ----------------------------------------------------------------------
        metricas_cards = []
        if pagina == "home":
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-database"},
                {"label": "Período", "valor": periodo_exibicao, "sub": "Intervalo Selecionado", "cor": "#8b5cf6", "icone": "fa-calendar-days"},
                {"label": "Faturamento", "valor": str(contexto.get("faturamento", "—")), "sub": str(contexto.get("faturamento_pct", "Acumulado")), "cor": "#10b981", "icone": "fa-arrow-trend-up"},
                {"label": "Lucro Líquido", "valor": str(contexto.get("lucro", "—")), "sub": str(contexto.get("lucro_pct", "Margem")), "cor": "#06b6d4", "icone": "fa-dollar-sign"}
            ]
        elif pagina == "dados":
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-database"},
                {"label": "Período", "valor": periodo_exibicao, "sub": "Intervalo Selecionado", "cor": "#8b5cf6", "icone": "fa-calendar-days"},
                {"label": "Total Registros", "valor": str(contexto.get("total_linhas", "0")), "sub": "Lançamentos", "cor": "#10b981", "icone": "fa-list-ol"},
                {"label": "Completude", "valor": str(contexto.get("taxa_preenchimento", "100%")), "sub": "Integridade", "cor": "#06b6d4", "icone": "fa-circle-check"}
            ]
        elif pagina == "analises":
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-layer-group"},
                {"label": "Período", "valor": periodo_exibicao, "sub": "Intervalo Selecionado", "cor": "#8b5cf6", "icone": "fa-calendar-days"},
                {"label": "Consistência", "valor": "Validada", "sub": "Cruzamento auditado", "cor": "#10b981", "icone": "fa-circle-check"},
                {"label": "Métricas", "valor": "Monitoradas", "sub": "Performance ativa", "cor": "#f59e0b", "icone": "fa-chart-line"}
            ]
        elif pagina in ["dashboard", "graficos-avancados"]:
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-layer-group"},
                {"label": "Período", "valor": periodo_exibicao, "sub": "Filtro Aplicado", "cor": "#8b5cf6", "icone": "fa-calendar-check"},
                {"label": "Visão BI", "valor": "Executiva", "sub": "Painel completo", "cor": "#10b981", "icone": "fa-chart-simple"},
                {"label": "Status", "valor": "Sincronizado", "sub": "Tempo Real", "cor": "#06b6d4", "icone": "fa-bolt"}
            ]
        elif pagina in ["planejamento", "analise_planejamento_adaptado"]:
            cen = str(contexto.get("cenario", "Provável")).upper()
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-database"},
                {"label": "Cenário / Período", "valor": f"{cen} (12m)", "sub": "Projeção Anual", "cor": "#8b5cf6", "icone": "fa-scale-balanced"},
                {"label": "Receita Projetada", "valor": str(contexto.get("receita_total", "—")), "sub": "12 Meses", "cor": "#10b981", "icone": "fa-arrow-trend-up"},
                {"label": "Resultado Anual", "valor": str(contexto.get("resultado_anual", "—")), "sub": "Saldo Projetado", "cor": "#06b6d4", "icone": "fa-dollar-sign"}
            ]
        elif pagina in ["fluxo_caixa", "fluxo-caixa"]:
            metricas_cards = [
                {"label": "Tabela / Origem", "valor": origem_exibicao, "sub": "Base Analisada", "cor": "#3b82f6", "icone": "fa-layer-group"},
                {"label": "Período", "valor": periodo_exibicao, "sub": "Intervalo Selecionado", "cor": "#8b5cf6", "icone": "fa-calendar-day"},
                {"label": "Entradas", "valor": str(contexto.get("entradas", "R$ 0,00")), "sub": "Recebimentos", "cor": "#10b981", "icone": "fa-arrow-down-long"},
                {"label": "Saldo Líquido", "valor": str(contexto.get("saldo", "R$ 0,00")), "sub": "Disponibilidade", "cor": "#06b6d4", "icone": "fa-wallet"}
            ]

        # ----------------------------------------------------------------------
        # 7.6. Fallback determinístico quando a IA não responde adequadamente
        # ----------------------------------------------------------------------
        if not success:
            parsed = {
                "veredito_titulo": "Operação Estável e Monitorada em Tempo Real",
                "veredito_subtitulo": f"Diagnóstico consolidado para a fonte {origem_exibicao} no período {periodo_exibicao}.",
                "veredito_badge": "Operação Saudável",
                "veredito_status": "positivo",
                "diagnostico_geral": f"A análise financeira da fonte <strong>{origem_exibicao}</strong> no período <strong>{periodo_exibicao}</strong> demonstra regularidade operacional. O fluxo de receitas e o controle dos desembolsos mantêm a liquidez estável, sendo fundamental manter o acompanhamento contínuo dos custos fixos.",
                "pontos_fortes": [
                    "Sincronização de métricas e recebimentos em conformidade com o planejado.",
                    "Previsibilidade operacional mantida durante o período analisado."
                ],
                "alertas_riscos": [
                    "Monitore aumentos atípicos em despesas variáveis nos próximos ciclos.",
                    "Manutenção de reserva financeira para cobrir oscilações no fluxo de caixa."
                ],
                "recomendacoes": [
                    "Revisar mensalmente as principais linhas de custo operacional da empresa.",
                    "Utilizar os cenários do Planejamento Financeiro para projetar margens de segurança.",
                    "Renegociar prazos com fornecedores para otimizar o capital de giro."
                ]
            }

        # ----------------------------------------------------------------------
        # 7.7. Sanitização do diagnóstico e resposta
        # ----------------------------------------------------------------------
        diagnostico_sanitizado = _limpar_termos_tecnicos(
            converter_markdown_para_html(parsed.get("diagnostico_geral", ""))
        )

        return jsonify({
            "sucesso": True,
            "origem": "gemini" if success else "fallback",
            "veredito": {
                "titulo": parsed.get("veredito_titulo", "Diagnóstico Operacional"),
                "subtitulo": parsed.get("veredito_subtitulo", f"Métricas consolidadas para {periodo}."),
                "badge": parsed.get("veredito_badge", "Ativo"),
                "cor": cor_veredito,
                "icone": icone_veredito
            },
            "metricas": metricas_cards,
            "diagnostico_geral": diagnostico_sanitizado,
            "pontos_fortes": [_limpar_termos_tecnicos(p) for p in parsed.get("pontos_fortes", [])],
            "alertas_riscos": [_limpar_termos_tecnicos(p) for p in parsed.get("alertas_riscos", [])],
            "recomendacoes": [_limpar_termos_tecnicos(p) for p in parsed.get("recomendacoes", [])]
        })

    except Exception as e:
        print("[Erro Rota Universal IA Página]:", e)
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


# ==============================================================================
# 8. ANÁLISES SALVAS DA IA
# ==============================================================================

@ia_bp.route("/analises-salvas", endpoint="pagina_analises_salvas")
@login_required
def pagina_analises_salvas():
    return render_template("analises_salvas.html")


@ia_bp.route("/api/salvar-analise-ia", methods=["POST"], endpoint="api_salvar_analise_ia")
@login_required
def api_salvar_analise_ia():
    try:
        usuario_id = str(session.get("usuario_id"))
        dados_req = request.get_json() or {}

        pagina = str(dados_req.get("pagina", "home")).strip().lower()
        pagina_nome = str(dados_req.get("pagina_nome", pagina.upper()))
        origem = str(dados_req.get("origem", "Todas as Planilhas (Visão Consolidada)"))
        periodo = str(dados_req.get("periodo", "Período Selecionado"))
        veredito = dados_req.get("veredito", {}) or {}
        metricas = dados_req.get("metricas", []) or []
        diagnostico_geral = str(dados_req.get("diagnostico_geral", ""))
        pontos_fortes = dados_req.get("pontos_fortes", []) or []
        alertas_riscos = dados_req.get("alertas_riscos", []) or []
        recomendacoes = dados_req.get("recomendacoes", []) or []

        documento = {
            "usuario_id": usuario_id,
            "pagina": pagina,
            "pagina_nome": pagina_nome,
            "origem": origem,
            "periodo": periodo,
            "veredito": veredito,
            "titulo": veredito.get("titulo", f"Análise {pagina_nome}"),
            "subtitulo": veredito.get("subtitulo", f"Métricas de {origem} ({periodo})"),
            "badge": veredito.get("badge", "Salvo"),
            "cor": veredito.get("cor", "#3b82f6"),
            "metricas": metricas,
            "diagnostico_geral": diagnostico_geral,
            "pontos_fortes": pontos_fortes,
            "alertas_riscos": alertas_riscos,
            "recomendacoes": recomendacoes,
            "criado_em": datetime.now()
        }

        res = analises_salvas_colecao.insert_one(documento)

        return jsonify({
            "sucesso": True,
            "mensagem": "Análise salva com sucesso!",
            "id": str(res.inserted_id)
        })
    except Exception as e:
        print("[Erro ao salvar análise IA]:", e)
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


@ia_bp.route("/api/analises-salvas", methods=["GET"], endpoint="api_listar_analises_salvas")
@login_required
def api_listar_analises_salvas():
    try:
        usuario_id = str(session.get("usuario_id"))
        pagina_filtro = request.args.get("pagina", "").strip().lower()
        busca_filtro = request.args.get("busca", "").strip().lower()
        data_filtro = request.args.get("data", "").strip()

        # ----------------------------------------------------------------------
        # 8.1. Montagem da query (tolerante a IDs em string ou ObjectId)
        # ----------------------------------------------------------------------
        ids_busca = [usuario_id]
        if ObjectId.is_valid(usuario_id):
            ids_busca.append(ObjectId(usuario_id))

        query = {"usuario_id": {"$in": ids_busca}}

        if pagina_filtro and pagina_filtro != "todas":
            if pagina_filtro in ["controles_essenciais", "controles-essenciais"]:
                query["pagina"] = {"$in": ["controles_essenciais", "controles-essenciais"]}
            elif pagina_filtro in ["fluxo_caixa", "fluxo-caixa"]:
                query["pagina"] = {"$in": ["fluxo_caixa", "fluxo-caixa"]}
            elif pagina_filtro in ["dashboard", "graficos-avancados"]:
                query["pagina"] = {"$in": ["dashboard", "graficos-avancados"]}
            else:
                query["pagina"] = pagina_filtro

        if data_filtro:
            try:
                dt_inicio = datetime.strptime(data_filtro, "%Y-%m-%d")
                dt_fim = dt_inicio.replace(hour=23, minute=59, second=59)
                query["criado_em"] = {"$gte": dt_inicio, "$lte": dt_fim}
            except Exception as dt_err:
                print("[Filtro Data Analises Salvas Aviso]:", dt_err)

        # ----------------------------------------------------------------------
        # 8.2. Consulta e formatação dos resultados
        # ----------------------------------------------------------------------
        cursor = analises_salvas_colecao.find(query).sort("criado_em", -1)
        analises = []

        for doc in cursor:
            if busca_filtro:
                texto_busca = (
                    f"{doc.get('titulo', '')} "
                    f"{doc.get('diagnostico_geral', '')} "
                    f"{doc.get('origem', '')} "
                    f"{doc.get('pagina_nome', '')}"
                ).lower()
                if busca_filtro not in texto_busca:
                    continue

            dt_criado = doc.get("criado_em")
            data_formatada = (
                dt_criado.strftime("%d/%m/%Y às %H:%M")
                if isinstance(dt_criado, datetime)
                else "Recente"
            )

            analises.append({
                "id": str(doc["_id"]),
                "pagina": doc.get("pagina", "home"),
                "pagina_nome": doc.get("pagina_nome", "Visão Geral"),
                "origem": doc.get("origem", "Consolidada"),
                "periodo": doc.get("periodo", "Período Selecionado"),
                "titulo": doc.get("titulo", "Diagnóstico Executivo"),
                "subtitulo": doc.get("subtitulo", ""),
                "badge": doc.get("badge", "Salvo"),
                "cor": doc.get("cor", "#3b82f6"),
                "veredito": doc.get("veredito", {}),
                "metricas": doc.get("metricas", []),
                "diagnostico_geral": doc.get("diagnostico_geral", ""),
                "pontos_fortes": doc.get("pontos_fortes", []),
                "alertas_riscos": doc.get("alertas_riscos", []),
                "recomendacoes": doc.get("recomendacoes", []),
                "criado_em_fmt": data_formatada
            })

        return jsonify({"sucesso": True, "analises": analises, "total": len(analises)})
    except Exception as e:
        print("[Erro ao listar análises salvas]:", e)
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


@ia_bp.route("/api/analises-salvas/<analise_id>", methods=["GET"], endpoint="api_obter_analise_salva")
@login_required
def api_obter_analise_salva(analise_id):
    try:
        usuario_id = str(session.get("usuario_id"))
        ids_busca = [usuario_id]
        if ObjectId.is_valid(usuario_id):
            ids_busca.append(ObjectId(usuario_id))

        query = (
            {"_id": ObjectId(analise_id), "usuario_id": {"$in": ids_busca}}
            if ObjectId.is_valid(analise_id)
            else {"_id": analise_id, "usuario_id": {"$in": ids_busca}}
        )
        doc = analises_salvas_colecao.find_one(query)

        if not doc:
            return jsonify({"sucesso": False, "mensagem": "Análise não encontrada"}), 404

        dt_criado = doc.get("criado_em")
        data_formatada = (
            dt_criado.strftime("%d/%m/%Y às %H:%M")
            if isinstance(dt_criado, datetime)
            else "Recente"
        )

        analise = {
            "id": str(doc["_id"]),
            "pagina": doc.get("pagina", "home"),
            "pagina_nome": doc.get("pagina_nome", "Visão Geral"),
            "origem": doc.get("origem", "Consolidada"),
            "periodo": doc.get("periodo", "Período Selecionado"),
            "titulo": doc.get("titulo", "Diagnóstico Executivo"),
            "subtitulo": doc.get("subtitulo", ""),
            "badge": doc.get("badge", "Salvo"),
            "cor": doc.get("cor", "#3b82f6"),
            "veredito": doc.get("veredito", {}),
            "metricas": doc.get("metricas", []),
            "diagnostico_geral": doc.get("diagnostico_geral", ""),
            "pontos_fortes": doc.get("pontos_fortes", []),
            "alertas_riscos": doc.get("alertas_riscos", []),
            "recomendacoes": doc.get("recomendacoes", []),
            "criado_em_fmt": data_formatada
        }

        return jsonify({"sucesso": True, "analise": analise})
    except Exception as e:
        print("[Erro ao buscar análise salva]:", e)
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


@ia_bp.route("/api/analises-salvas/<analise_id>", methods=["DELETE"], endpoint="api_excluir_analise_salva")
@login_required
def api_excluir_analise_salva(analise_id):
    try:
        usuario_id = str(session.get("usuario_id"))
        ids_busca = [usuario_id]
        if ObjectId.is_valid(usuario_id):
            ids_busca.append(ObjectId(usuario_id))

        query = (
            {"_id": ObjectId(analise_id), "usuario_id": {"$in": ids_busca}}
            if ObjectId.is_valid(analise_id)
            else {"_id": analise_id, "usuario_id": {"$in": ids_busca}}
        )
        res = analises_salvas_colecao.delete_one(query)

        if res.deleted_count > 0:
            return jsonify({"sucesso": True, "mensagem": "Análise excluída com sucesso!"})
        return jsonify({"sucesso": False, "mensagem": "Análise não encontrada ou sem permissão."}), 404
    except Exception as e:
        print("[Erro ao excluir análise salva]:", e)
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500