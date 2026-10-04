# ==============================================================================
# dashboard_rotas.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import traceback

from bson import ObjectId
from flask import jsonify, render_template, request, session

from backend.dados.agregador import obter_contexto_dados
from backend.dashboard.dashboard_servicos import (
    converter_json_safe,
    processar_dados_dashboard,
)
from backend.db import usuario


# ==============================================================================
# 2. RENDERIZAÇÃO DA PÁGINA
# ==============================================================================

def dashboard_page():
    """Renderiza a página do dashboard (graficos avancados)."""
    return render_template("graficos-avancados.html")


# ==============================================================================
# 3. ENDPOINT DE DADOS DO DASHBOARD
# ==============================================================================

def dashboard_dados():
    """
    Endpoint que carrega os dados do MongoDB do usuário (individual ou consolidado),
    aplica filtro de período e retorna JSON para os gráficos.
    GET /dashboard/dados?periodo=30&tabela_id=todas
    """

    # --------------------------------------------------------------------------
    # 3.1 Autenticação
    # --------------------------------------------------------------------------
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Usuário não autenticado"}), 401

    try:
        # ----------------------------------------------------------------------
        # 3.2 Parâmetros e mapeamentos do usuário
        # ----------------------------------------------------------------------
        periodo = int(request.args.get("periodo", 30))
        tabela_id = request.args.get("tabela_id", "todas")

        user_filter = (
            {"_id": ObjectId(usuario_id)}
            if (usuario_id and ObjectId.is_valid(str(usuario_id)))
            else {"_id": usuario_id}
        )
        user_doc = usuario.find_one(user_filter) if user_filter else None

        mapeamento = user_doc.get("mapeamento", {}) if user_doc else {}
        mapeamento_financeiro = (
            user_doc.get("mapeamento_financeiro", {}) if user_doc else {}
        )

        # Mapeamento unificado para passar ao agregador
        mapeamento_unificado = {**mapeamento, **mapeamento_financeiro}

        # ----------------------------------------------------------------------
        # 3.3 Buscar dados via motor agregador inteligente
        # ----------------------------------------------------------------------
        contexto = obter_contexto_dados(
            usuario_id, escopo=tabela_id, mapeamento=mapeamento_unificado
        )

        colunas = contexto.get("colunas", [])
        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "erro": "Nenhum dado disponível. Importe dados na aba Dados.",
                "contexto": contexto,
            }), 200

        # ----------------------------------------------------------------------
        # 3.4 Processamento dos dados para os gráficos
        # ----------------------------------------------------------------------
        resultado = processar_dados_dashboard(
            colunas,
            dados,
            periodo,
            mapeamento_unificado,
            mapeamento_financeiro,
        )
        resultado["contexto"] = {
            "escopo": contexto.get("escopo", "todas"),
            "tabela_id": contexto.get("tabela_id", "todas"),
            "nome_contexto": contexto.get("nome_contexto", "Visão Consolidada"),
            "planilhas_envolvidas": contexto.get("planilhas_envolvidas", []),
            "total_planilhas": len(contexto.get("planilhas_envolvidas", [])),
        }

        # ----------------------------------------------------------------------
        # 3.5 Serialização e resposta
        # ----------------------------------------------------------------------
        resultado = converter_json_safe(resultado)
        return jsonify(resultado), 200

    except Exception as e:
        print(f" Erro ao processar dashboard: {e}")
        traceback.print_exc()
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500