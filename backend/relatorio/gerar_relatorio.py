
from flask import request, jsonify, session, url_for

def gerar_relatorio():
    dados = request.get_json() or {}

    # Validação mínima
    if not dados.get('nome') or not dados.get('periodo'):
        return jsonify({'mensagem': 'Dados de relatório incompletos'}), 400

    # Armazenar no session para renderizar em /relatorio_pdf
    session['relatorio_dados'] = dados

    # Histórico de relatórios gerados pelo usuário (armazenar payload completo)
    historico = session.get('relatorios_gerados', [])

    item_historico = {
        'nome': dados.get('nome', 'Relatório sem nome'),
        'periodo': dados.get('periodo', ''),
        'data': dados.get('data', ''),
        'kpis': dados.get('kpis', {}),
        'grafico': bool(dados.get('grafico', False)),
        'tabela': dados.get('tabela', []),
        'tendencias': bool(dados.get('tendencias', False)),
        'margem': bool(dados.get('margem', False)),
        'dadosDetalhados': bool(dados.get('dadosDetalhados', False)),
        'insights': dados.get('insights', []),
    }

    historico.insert(0, item_historico)
    session['relatorios_gerados'] = historico[:10]

    return jsonify({'success': True, 'redirect': url_for('pagina_relatorio_pdf')}), 200