from flask import session, jsonify, render_template, request
from backend.dados.agregador import obter_contexto_dados, listar_planilhas_usuario
from backend.DashBoard.dashboard_Servicos import processar_dados_dashboard, converter_json_safe
from backend.db import usuario
from bson import ObjectId


def dashboard_page():
    """Renderiza a página do dashboard (graficos avancados)."""
    return render_template("graficos-avancados.html")


def dashboard_dados():
    """
    Endpoint que carrega os dados do MongoDB do usuário (individual ou consolidado),
    aplica filtro de período e retorna JSON para os gráficos.
    GET /dashboard/dados?periodo=30&tabela_id=todas
    """

    usuario_id = session.get("usuario_id")

    if not usuario_id:
        return jsonify({"erro": "Usuário não autenticado"}), 401

    try:
        periodo = int(request.args.get("periodo", 30))
        tabela_id = request.args.get("tabela_id", "todas")

        user_filter = {"_id": ObjectId(usuario_id)} if (usuario_id and ObjectId.is_valid(str(usuario_id))) else {"_id": usuario_id}
        user_doc = usuario.find_one(user_filter) if user_filter else None

        mapeamento = user_doc.get("mapeamento", {}) if user_doc else {}
        mapeamento_financeiro = user_doc.get("mapeamento_financeiro", {}) if user_doc else {}

        # Mapeamento unificado para passar ao agregador
        mapeamento_unificado = {**mapeamento, **mapeamento_financeiro}

        # Buscar dados via motor agregador inteligente
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id, mapeamento=mapeamento_unificado)

        colunas = contexto.get("colunas", [])
        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "erro": "Nenhum dado disponível. Importe dados na aba Dados.",
                "contexto": contexto
            }), 200

        resultado = processar_dados_dashboard(colunas, dados, periodo, mapeamento_unificado, mapeamento_financeiro)
        resultado["contexto"] = {
            "escopo": contexto.get("escopo", "todas"),
            "tabela_id": contexto.get("tabela_id", "todas"),
            "nome_contexto": contexto.get("nome_contexto", "Visão Consolidada"),
            "planilhas_envolvidas": contexto.get("planilhas_envolvidas", []),
            "total_planilhas": len(contexto.get("planilhas_envolvidas", []))
        }

        resultado = converter_json_safe(resultado)
        return jsonify(resultado), 200

    except Exception as e:
        print(f" Erro ao processar dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500