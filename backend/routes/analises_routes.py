# ==============================================================================
# analises_routes.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from bson import ObjectId
from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for

from backend.routes.auth_routes import login_required
from backend.db import dados_colecao, usuario as usuarios_colecao, galeria

# Importações dos módulos de negócio padronizados
from backend.analise.analise import (
    analise_por_periodo,
    obter_ultimo_periodo,
    obter_limites_datas_analise,
    salvar_ultimo_periodo,
)
from backend.analise.analise_estrategica import obter_analise_estrategica
from backend.planejamento.planejamento_financeiro import (
    obter_planejamento_financeiro,
    salvar_configuracao_ponto_equilibrio,
)
from backend.fluxo_caixa.fluxo_caixa import obter_dados_fluxo_caixa
from backend.dashboard.dashboard_rotas import dashboard_dados, dashboard_page
from backend.home.home import (
    calcular_desempenho,
    gerar_status_negocio,
    obter_dados_graficos,
    obter_detalhes_kpi,
    obter_produtos_overview,
)
from backend.relatorio.gerar_relatorio import (
    gerar_relatorio,
    listar_relatorios_api,
    excluir_relatorio_api,
)
from backend.relatorio.pagina_relatorio import pagina_relatorio_pdf as pagina_relatorio_pdf_backend
from backend.perfil.pagina_de_perfil import pagina_perfil as pagina_perfil_backend
from backend.perfil.visualizar_analise import visualizar_analise
from backend.perfil.visualizar_relatorio import visualizar_relatorio
from backend.contato.contato import enviar_mensagem_contato


# ==============================================================================
# 2. BLUEPRINT
# ==============================================================================

analises_bp = Blueprint("analises", __name__)


# ==============================================================================
# 3. LANDING PAGE
# ==============================================================================

@analises_bp.route("/", endpoint="pagina_landing")
def pagina_landing():
    return render_template("index.html")


# ==============================================================================
# 4. HOME
# ==============================================================================

@analises_bp.route("/home", endpoint="pagina_home")
@login_required
def pagina_home():
    return render_template("home.html")


# ==============================================================================
# 5. ANÁLISES
# ==============================================================================

@analises_bp.route("/analises", endpoint="pagina_analise")
@login_required
def pagina_analise():
    user = session.get("usuario_id")
    if user and "analise_selecionada" not in session:
        try:
            ids_user = [str(user)]
            if ObjectId.is_valid(str(user)):
                ids_user.append(ObjectId(str(user)))
            doc = dados_colecao.find_one(
                {"usuario_id": {"$in": ids_user}},
                sort=[("atualizado_em", -1), ("criado_em", -1)]
            )
            if doc and "ultimo_periodo" in doc:
                up = doc["ultimo_periodo"]
                session["analise_selecionada"] = {
                    "periodo_inicio": up.get("inicio"),
                    "periodo_fim": up.get("fim"),
                    "tabela_id": up.get("tabela_id", "todas")
                }
            elif ObjectId.is_valid(str(user)):
                u_doc = usuarios_colecao.find_one({"_id": ObjectId(str(user))})
                if u_doc and "ultimo_periodo" in u_doc:
                    up = u_doc["ultimo_periodo"]
                    session["analise_selecionada"] = {
                        "periodo_inicio": up.get("inicio"),
                        "periodo_fim": up.get("fim"),
                        "tabela_id": up.get("tabela_id", "todas")
                    }
        except Exception:
            pass
    return render_template("analises.html")


@analises_bp.route("/api/analise", methods=["GET"], endpoint="api_analise")
@login_required
def api_analise():
    return analise_por_periodo()


@analises_bp.route("/api/ultimo-periodo", methods=["GET", "POST"], endpoint="ultimo_periodo")
@login_required
def ultimo_periodo_endpoint():
    if request.method == "POST":
        user = session.get("usuario_id")
        dados = request.get_json() or {}
        inicio = dados.get("inicio") or dados.get("periodo_inicio")
        fim = dados.get("fim") or dados.get("periodo_fim")
        tabela_id = dados.get("tabela_id", "todas")
        if user and inicio and fim:
            salvar_ultimo_periodo(user, inicio, fim, tabela_id)
            return jsonify({"sucesso": True}), 200
        return jsonify({"mensagem": "Dados incompletos"}), 400
    return obter_ultimo_periodo()


@analises_bp.route("/api/analise/limites-datas", methods=["GET"], endpoint="api_analise_limites_datas")
@login_required
def api_analise_limites_datas():
    """Retorna as datas reais mínimas e máximas dos dados para a tabela/escopo selecionado"""
    return obter_limites_datas_analise()


@analises_bp.route("/api/analise-estrategica", methods=["GET"], endpoint="api_analise_estrategica")
@login_required
def api_analise_estrategica():
    """Endpoint para o Centro de Análise Estratégica"""
    return obter_analise_estrategica()


# ==============================================================================
# 6. PLANEJAMENTO FINANCEIRO
# ==============================================================================

@analises_bp.route("/planejamento-financeiro", endpoint="pagina_planejamento_financeiro")
@login_required
def pagina_planejamento_financeiro():
    if session.get("usuario_perfil") == "MEI":
        return redirect(url_for("pagina_controles_essenciais"))
    return render_template("analise_planejamento_adaptado.html")


@analises_bp.route("/api/planejamento-financeiro", methods=["GET"], endpoint="get_planejamento_financeiro")
@login_required
def get_planejamento_financeiro():
    return obter_planejamento_financeiro()


@analises_bp.route("/api/planejamento-financeiro/ponto-equilibrio", methods=["POST"], endpoint="post_ponto_equilibrio_config")
@login_required
def post_ponto_equilibrio_config():
    return salvar_configuracao_ponto_equilibrio()


# ==============================================================================
# 7. FLUXO DE CAIXA
# ==============================================================================

@analises_bp.route("/fluxo-caixa", endpoint="pagina_fluxo_caixa")
@analises_bp.route("/fluxo_caixa")
@login_required
def pagina_fluxo_caixa():
    return render_template("fluxo_caixa.html")


@analises_bp.route("/api/fluxo-caixa", methods=["GET"], endpoint="get_fluxo_caixa")
@login_required
def get_fluxo_caixa():
    return obter_dados_fluxo_caixa()


# ==============================================================================
# 8. DASHBOARD & GRÁFICOS AVANÇADOS
# ==============================================================================

@analises_bp.route("/dashboard", endpoint="pagina_dashboard")
@login_required
def pagina_dashboard():
    return dashboard_page()


@analises_bp.route("/dashboard/dados", methods=["GET"], endpoint="api_dashboard_dados")
@login_required
def api_dashboard_dados():
    return dashboard_dados()


@analises_bp.route("/graficos-avancados", endpoint="pagina_graficoAvancado")
@login_required
def pagina_graficoAvancado():
    return render_template("graficos-avancados.html")


# ==============================================================================
# 9. DESEMPENHO E KPIs
# ==============================================================================

@analises_bp.route("/api/desempenho", methods=["GET"], endpoint="api_desempenho")
@login_required
def api_desempenho():
    periodo = request.args.get("periodo", "30_dias")
    tabela_id = request.args.get("tabela_id", "todas")
    return calcular_desempenho(periodo, tabela_id)


@analises_bp.route("/api/desempenho/detalhe", methods=["GET"], endpoint="api_desempenho_detalhe")
@login_required
def api_desempenho_detalhe():
    periodo = request.args.get("periodo", "30_dias")
    kpi = request.args.get("kpi", "faturamento")
    tabela_id = request.args.get("tabela_id", "todas")
    return obter_detalhes_kpi(periodo, kpi, tabela_id)


@analises_bp.route("/api/graficos", methods=["GET"], endpoint="api_graficos")
@login_required
def api_graficos():
    periodo = request.args.get("periodo", "30_dias")
    tabela_id = request.args.get("tabela_id", "todas")
    return obter_dados_graficos(periodo, tabela_id)


@analises_bp.route("/api/produtos/overview", methods=["GET"], endpoint="api_produtos_overview")
@login_required
def api_produtos_overview():
    periodo = request.args.get("periodo", "30_dias")
    tabela_id = request.args.get("tabela_id", "todas")
    return obter_produtos_overview(periodo, tabela_id)


@analises_bp.route("/api/status_negocio", methods=["GET"], endpoint="api_status_negocio")
@login_required
def api_status_negocio():
    periodo = request.args.get("periodo", "30_dias")
    tabela_id = request.args.get("tabela_id", "todas")
    return gerar_status_negocio(periodo, tabela_id)


# ==============================================================================
# 10. GALERIA DE GRÁFICOS
# ==============================================================================

@analises_bp.route("/api/galeria/listar", methods=["GET"], endpoint="api_galeria_listar")
@login_required
def api_galeria_listar():
    user_id = session.get("usuario_id")
    periodo_filtro = request.args.get("periodo", None)

    ids_user = [str(user_id)]
    if ObjectId.is_valid(str(user_id)):
        ids_user.append(ObjectId(str(user_id)))

    query = {"usuario_id": {"$in": ids_user}}
    if periodo_filtro and periodo_filtro != "todos":
        query["periodo"] = periodo_filtro

    graficos = list(galeria.find(query).sort("criado_em", -1).limit(50))
    for g in graficos:
        g["_id"] = str(g["_id"])
    return jsonify(graficos)


# ==============================================================================
# 11. PERFIL & CONFIGURAÇÕES
# ==============================================================================

@analises_bp.route("/perfil", endpoint="pagina_perfil")
@login_required
def pagina_perfil():
    return pagina_perfil_backend()


@analises_bp.route("/config", endpoint="pagina_configuracoes")
@login_required
def pagina_configuracoes():
    return render_template("configuracoes.html")


@analises_bp.route("/relatorio/visualizar/<int:index>", endpoint="visualizar_relatorio")
@login_required
def rota_visualizar_relatorio(index):
    return visualizar_relatorio(index)


@analises_bp.route("/analise/visualizar/<int:index>", endpoint="visualizar_analise_route")
@login_required
def rota_visualizar_analise(index):
    return visualizar_analise(index)


# ==============================================================================
# 12. RELATÓRIOS
# ==============================================================================

@analises_bp.route("/relatorios", endpoint="pagina_relatorio")
@login_required
def pagina_relatorio():
    return render_template("relatorios.html")


@analises_bp.route("/gerar-relatorio", methods=["POST"], endpoint="gerar_relatorio_endpoint")
@login_required
def gerar_relatorio_endpoint():
    return gerar_relatorio()


@analises_bp.route("/api/relatorios", methods=["GET"], endpoint="api_listar_relatorios")
@login_required
def api_listar_relatorios():
    return listar_relatorios_api()


@analises_bp.route("/api/relatorios/<relatorio_id>", methods=["DELETE"], endpoint="api_excluir_relatorio")
@login_required
def api_excluir_relatorio(relatorio_id):
    return excluir_relatorio_api(relatorio_id)


@analises_bp.route("/relatorio_pdf", endpoint="pagina_relatorio_pdf")
@login_required
def pagina_relatorio_pdf():
    return pagina_relatorio_pdf_backend()


# ==============================================================================
# 13. CONTATO & INSTITUCIONAL
# ==============================================================================

@analises_bp.route("/contato", endpoint="pagina_contato")
@login_required
def pagina_contato():
    return render_template("contato.html")


@analises_bp.route("/contato2", endpoint="pagina_contato2")
@login_required
def pagina_contato2():
    return render_template("sistema_pagamento/pagina_contato2.html")


@analises_bp.route("/enviar-contato", methods=["POST"], endpoint="enviar_contato")
@login_required
def enviar_contato():
    return enviar_mensagem_contato()


@analises_bp.route("/termos/termos_de_uso", endpoint="pagina_termos")
@analises_bp.route("/termos-de-uso", endpoint="pagina_termos_uso")  # Alias legado usado nos templates
def pagina_termos():
    return render_template("termos/termos_de_uso.html")