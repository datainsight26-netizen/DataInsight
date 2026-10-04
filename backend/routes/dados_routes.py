# ==============================================================================
# dados_routes.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import traceback

from flask import Blueprint, render_template, request, jsonify, session

from backend.routes.auth_routes import login_required

# Módulos de dados
from backend.dados.apagar_dados import apagar_dados_usuario
from backend.dados.carregar_dados import carregar_dados
from backend.dados.exclusao_dados import (
    confirmar_exclusao_dados,
    pagina_confirmacao_exclusao,
    solicitar_exclusao_dados,
)
from backend.dados.salvar_dados import salvar_dados_manuais
from backend.dados.upload_arquivo import listar_abas_excel, upload_arquivo
from backend.dados.tabelas import (
    listar_todas_tabelas,
    obter_tabela,
    salvar_tabela_especifica,
    renomear_tabela_api,
    duplicar_tabela_api,
    excluir_tabela_api,
    ativar_tabela_api,
    definir_dominio_tabela,
    obter_sumario_planilhas,
)
from backend.dados.quality import api_analisar_dados, api_limpar_dados
from backend.dados.mapeamento import (
    obter_mapeamento,
    salvar_mapeamento,
    obter_mapeamento_financeiro,
    salvar_mapeamento_financeiro,
    analisar_colunas_financeiras,
    preview_financeiro,
    criar_coluna_financeira_api,
)
from backend.cnpj.cnpj_service import consultar_cnpj_externo, calcular_das_mei
from backend.controles_essenciais.controles_essenciais import (
    obter_dados_controles_essenciais,
    registrar_lancamento_rapido,
)
from backend.produtos import (
    buscar_produtos_por_nome,
    deletar_produto,
    listar_produtos,
    obter_categorias,
    obter_estatisticas_produtos,
    obter_produto_exato,
    salvar_produto,
)


# ==============================================================================
# 2. BLUEPRINT
# ==============================================================================

dados_bp = Blueprint("dados", __name__)


# ==============================================================================
# 3. PÁGINA DADOS
# ==============================================================================

@dados_bp.route("/dados", endpoint="pagina_dados")
@login_required
def pagina_dados():
    return render_template("dados.html")


# ==============================================================================
# 4. OPERAÇÕES BÁSICAS DE DADOS
# ==============================================================================

@dados_bp.route("/carregar-dados", methods=["GET"], endpoint="rota_carregar_dados")
@login_required
def rota_carregar_dados():
    return carregar_dados()


@dados_bp.route("/salvar-dados", methods=["POST"], endpoint="rota_salvar_dados")
@login_required
def rota_salvar_dados():
    return salvar_dados_manuais()


@dados_bp.route("/apagar-dados", methods=["DELETE"], endpoint="rota_apagar_dados")
@login_required
def rota_apagar_dados():
    return apagar_dados_usuario()


# ==============================================================================
# 5. EXCLUSÃO DEFINITIVA LGPD
# ==============================================================================

@dados_bp.route("/solicitar-exclusao-dados", methods=["POST"], endpoint="rota_solicitar_exclusao_dados")
@login_required
def rota_solicitar_exclusao_dados():
    return solicitar_exclusao_dados()


@dados_bp.route("/confirmar-exclusao", methods=["GET"], endpoint="rota_confirmar_exclusao")
def rota_confirmar_exclusao():
    return pagina_confirmacao_exclusao()


@dados_bp.route("/processar-exclusao", methods=["POST"], endpoint="rota_processar_exclusao")
@login_required
def rota_processar_exclusao():
    return confirmar_exclusao_dados()


# ==============================================================================
# 6. UPLOAD DE ARQUIVOS
# ==============================================================================

@dados_bp.route("/upload", methods=["POST"], endpoint="rota_upload")
@login_required
def rota_upload():
    return upload_arquivo()


@dados_bp.route("/upload/abas", methods=["POST"], endpoint="rota_upload_abas")
@login_required
def rota_upload_abas():
    return listar_abas_excel()


# ==============================================================================
# 7. TABELAS & DOMÍNIOS
# ==============================================================================

@dados_bp.route("/api/tabelas", methods=["GET"], endpoint="rota_api_listar_tabelas")
@login_required
def rota_api_listar_tabelas():
    return listar_todas_tabelas()


@dados_bp.route("/api/tabelas/<tabela_id>", methods=["GET"], endpoint="rota_api_obter_tabela")
@login_required
def rota_api_obter_tabela(tabela_id):
    return obter_tabela(tabela_id)


@dados_bp.route("/api/tabelas", methods=["POST"], endpoint="rota_api_salvar_tabela")
@login_required
def rota_api_salvar_tabela():
    return salvar_tabela_especifica()


@dados_bp.route("/api/tabelas/<tabela_id>/renomear", methods=["PUT"], endpoint="rota_api_renomear_tabela")
@login_required
def rota_api_renomear_tabela(tabela_id):
    return renomear_tabela_api(tabela_id)


@dados_bp.route("/api/tabelas/<tabela_id>/duplicar", methods=["POST"], endpoint="rota_api_duplicar_tabela")
@login_required
def rota_api_duplicar_tabela(tabela_id):
    return duplicar_tabela_api(tabela_id)


@dados_bp.route("/api/tabelas/<tabela_id>", methods=["DELETE"], endpoint="rota_api_excluir_tabela")
@login_required
def rota_api_excluir_tabela(tabela_id):
    return excluir_tabela_api(tabela_id)


@dados_bp.route("/api/tabelas/<tabela_id>/ativar", methods=["POST"], endpoint="rota_api_ativar_tabela")
@login_required
def rota_api_ativar_tabela(tabela_id):
    return ativar_tabela_api(tabela_id)


@dados_bp.route("/api/planilhas/sumario", methods=["GET"], endpoint="rota_api_sumario_planilhas")
@login_required
def rota_api_sumario_planilhas():
    return obter_sumario_planilhas()


@dados_bp.route("/api/tabelas/<tabela_id>/dominio", methods=["PUT"], endpoint="rota_api_dominio_tabela")
@login_required
def rota_api_dominio_tabela(tabela_id):
    return definir_dominio_tabela(tabela_id)


# ==============================================================================
# 8. QUALIDADE DOS DADOS
# ==============================================================================

@dados_bp.route("/api/dados/analisar", methods=["POST"], endpoint="rota_analisar_dados")
@login_required
def rota_analisar_dados():
    """Analisa a qualidade e detecta problemas nos dados"""
    return api_analisar_dados()


@dados_bp.route("/api/dados/limpar", methods=["POST"], endpoint="rota_limpar_dados")
@login_required
def rota_limpar_dados():
    """Aplica limpeza e sanitização científica dos dados e persiste no banco"""
    return api_limpar_dados()


# ==============================================================================
# 9. MAPEAMENTO GERAL E FINANCEIRO
# ==============================================================================

@dados_bp.route("/api/mapeamento", methods=["GET"], endpoint="get_mapeamento")
@login_required
def get_mapeamento():
    return obter_mapeamento()


@dados_bp.route("/api/mapeamento", methods=["POST"], endpoint="set_mapeamento")
@login_required
def set_mapeamento():
    return salvar_mapeamento()


@dados_bp.route("/api/mapeamento-financeiro", methods=["GET"], endpoint="get_mapeamento_financeiro")
@login_required
def get_mapeamento_financeiro():
    return obter_mapeamento_financeiro()


@dados_bp.route("/api/mapeamento-financeiro", methods=["POST"], endpoint="set_mapeamento_financeiro")
@login_required
def set_mapeamento_financeiro():
    return salvar_mapeamento_financeiro()


@dados_bp.route("/api/mapeamento-financeiro/analisar", methods=["POST"], endpoint="api_analisar_colunas_financeiras")
@login_required
def api_analisar_colunas_financeiras():
    return analisar_colunas_financeiras()


@dados_bp.route("/api/mapeamento-financeiro/preview", methods=["POST"], endpoint="api_preview_financeiro")
@login_required
def api_preview_financeiro():
    return preview_financeiro()


@dados_bp.route("/api/mapeamento-financeiro/criar-coluna", methods=["POST"], endpoint="api_criar_coluna_financeira")
@login_required
def api_criar_coluna_financeira():
    return criar_coluna_financeira_api()


# ==============================================================================
# 10. CONTROLES ESSENCIAIS & CNPJ (MEI)
# ==============================================================================

@dados_bp.route("/api/consultar-cnpj/<cnpj>", methods=["GET"], endpoint="rota_consultar_cnpj")
def rota_consultar_cnpj(cnpj):
    return jsonify(consultar_cnpj_externo(cnpj))


@dados_bp.route("/api/das-mei", methods=["GET"], endpoint="rota_apuracao_das_mei")
def rota_apuracao_das_mei():
    ano = request.args.get("ano", type=int)
    tipo = request.args.get("tipo", "servicos")
    sm_custom = request.args.get("salario_minimo", type=float)
    return jsonify({"sucesso": True, "apuracao": calcular_das_mei(ano, tipo, sm_custom)})


@dados_bp.route("/controles-essenciais", endpoint="pagina_controles_essenciais")
@login_required
def pagina_controles_essenciais():
    return render_template("controles_essenciais.html")


@dados_bp.route("/api/controles-essenciais", methods=["GET"], endpoint="get_controles_essenciais")
@login_required
def get_controles_essenciais():
    try:
        return obter_dados_controles_essenciais()
    except Exception as err:
        print(f"[Erro /api/controles-essenciais]: {err}")
        traceback.print_exc()
        return jsonify({
            "sucesso": False,
            "mensagem": f"Erro interno ao processar controles essenciais: {str(err)}"
        }), 500


@dados_bp.route("/api/controles-essenciais/lancamento", methods=["POST"], endpoint="post_lancamento_controles_essenciais")
@login_required
def post_lancamento_controles_essenciais():
    return registrar_lancamento_rapido()


# ==============================================================================
# 11. PRODUTOS - AUTOCOMPLETE E CRUD
# ==============================================================================

@dados_bp.route("/api/produtos/buscar", methods=["GET"], endpoint="api_buscar_produtos")
@login_required
def api_buscar_produtos():
    termo = request.args.get("termo", "").strip()
    limite = request.args.get("limite", 10, type=int)
    user_id = session.get("usuario_id")
    if not termo:
        return jsonify({"erro": "Termo de busca obrigatório"}), 400
    try:
        produtos = buscar_produtos_por_nome(user_id, termo, limite)
        return jsonify({"sucesso": True, "produtos": produtos})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/obter/<nome_produto>", methods=["GET"], endpoint="api_obter_produto")
@login_required
def api_obter_produto(nome_produto):
    user_id = session.get("usuario_id")
    try:
        produto = obter_produto_exato(user_id, nome_produto)
        if produto:
            return jsonify({"sucesso": True, "produto": produto})
        return jsonify({"sucesso": False, "erro": "Produto não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/salvar", methods=["POST"], endpoint="api_salvar_produto")
@login_required
def api_salvar_produto():
    user_id = session.get("usuario_id")
    dados = request.get_json() or {}
    if not dados or not dados.get("nome_produto"):
        return jsonify({"erro": "nome_produto obrigatório"}), 400
    try:
        produto_id = salvar_produto(
            usuario_id=user_id,
            nome_produto=dados.get("nome_produto"),
            categoria=dados.get("categoria"),
            preco=dados.get("preco"),
            estoque=dados.get("estoque"),
            sku=dados.get("sku"),
            descricao=dados.get("descricao"),
        )
        return jsonify({"sucesso": True, "produto_id": produto_id})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/listar", methods=["GET"], endpoint="api_listar_produtos")
@login_required
def api_listar_produtos():
    user_id = session.get("usuario_id")
    pagina = request.args.get("pagina", 1, type=int)
    limite = request.args.get("limite", 50, type=int)
    skip = (pagina - 1) * limite
    try:
        produtos = listar_produtos(user_id, limite=limite, skip=skip)
        total = obter_estatisticas_produtos(user_id)["total"]
        return jsonify({
            "sucesso": True,
            "produtos": produtos,
            "total": total,
            "pagina": pagina,
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/categorias", methods=["GET"], endpoint="api_obter_categorias")
@login_required
def api_obter_categorias():
    user_id = session.get("usuario_id")
    try:
        categorias = obter_categorias(user_id)
        return jsonify({"sucesso": True, "categorias": categorias})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/deletar/<produto_id>", methods=["DELETE"], endpoint="api_deletar_produto")
@login_required
def api_deletar_produto(produto_id):
    user_id = session.get("usuario_id")
    try:
        if deletar_produto(user_id, produto_id):
            return jsonify({"sucesso": True})
        return jsonify({"sucesso": False, "erro": "Produto não encontrado"}), 404
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@dados_bp.route("/api/produtos/estatisticas", methods=["GET"], endpoint="api_estatisticas_produtos")
@login_required
def api_estatisticas_produtos():
    user_id = session.get("usuario_id")
    try:
        stats = obter_estatisticas_produtos(user_id)
        return jsonify({"sucesso": True, "estatisticas": stats})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500