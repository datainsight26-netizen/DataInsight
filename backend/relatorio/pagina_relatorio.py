
from flask import render_template, session, url_for, redirect, request

def pagina_relatorio_pdf():
    dados = session.get('relatorio_dados')
    if not dados:
        return redirect(url_for('pagina_relatorio'))

    # Normalize dados para evitar Undefined no template
    dados = {
        'nome': dados.get('nome', 'Relatório'),
        'periodo': dados.get('periodo', ''),
        'data': dados.get('data', ''),
        'kpis': dados.get('kpis', {}),
        'grafico': dados.get('grafico', False),
        'tendencias': dados.get('tendencias', False),
        'margem': dados.get('margem', False),
        'dadosDetalhados': dados.get('dadosDetalhados', False),
        'tabela': dados.get('tabela', []),
        'insights': dados.get('insights', []) or []
    }

    auto = request.args.get('auto') in ['1', 'true', 'True']

    return render_template('paginaPDF/relatorio_pdf.html', dados=dados, auto=auto)