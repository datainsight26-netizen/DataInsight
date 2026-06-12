from flask import session, jsonify, render_template, request
from backend.db import dados_colecao
from backend.DashBoard.dashboard_Servicos import processar_dados_dashboard,converter_json_safe


def dashboard_page():
    """Renderiza a página do dashboard."""
    return render_template("dashboard.html")


def dashboard_dados():
    """
    Endpoint que carrega os dados do MongoDB do usuário,
    aplica filtro de período e retorna JSON para os gráficos.
    GET /dashboard/dados?periodo=30
    """

    usuario_id = session.get("usuario_id")

    if not usuario_id:
        return jsonify({"erro": "Usuário não autenticado"}), 401

    try:
        periodo = int(request.args.get("periodo", 30))

        documento = dados_colecao.find_one(
            {"usuario_id": usuario_id},
            sort=[("criado_em", -1)]
        )

        if not documento:
            print(f" Nenhum documento encontrado para usuário {usuario_id}")
            return jsonify({"erro": "Nenhum dado disponível. Importe dados na aba Dados."}), 200

        colunas = documento.get("colunas", [])
        dados   = documento.get("dados", [])

        if dados:
            print(f" Primeiro registro: {dados[0]}")

        resultado = processar_dados_dashboard(colunas, dados, periodo)

        resultado = converter_json_safe(resultado)

        print(f" Dashboard processado:", resultado)

        return jsonify(resultado), 200

    except Exception as e:
        print(f" Erro ao processar dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"erro": f"Erro interno: {str(e)}"}), 500