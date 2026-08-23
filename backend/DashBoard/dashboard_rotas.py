from flask import session, jsonify, render_template, request
from backend.dados.agregador import obter_contexto_dados, listar_planilhas_usuario
from backend.DashBoard.dashboard_Servicos import processar_dados_dashboard, converter_json_safe


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

        from backend.home.home import obter_colunas_mapeadas
        mapeamento = obter_colunas_mapeadas(usuario_id)

        # Buscar dados via motor agregador inteligente
        contexto = obter_contexto_dados(usuario_id, escopo=tabela_id, mapeamento=mapeamento)

        colunas = contexto.get("colunas", [])
        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "erro": "Nenhum dado disponível. Importe dados na aba Dados.",
                "contexto": contexto
            }), 200

        resultado = processar_dados_dashboard(colunas, dados, periodo, mapeamento)
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