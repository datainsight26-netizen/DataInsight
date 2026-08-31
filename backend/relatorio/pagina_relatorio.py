from flask import render_template, session, url_for, redirect, request
from bson import ObjectId
from backend.db import relatorios_colecao


def pagina_relatorio_pdf():
    usuario_id = session.get('usuario_id')
    relatorio_id = request.args.get('id') or request.args.get('relatorio_id')
    dados = None

    if relatorio_id and usuario_id:
        try:
            query = {'_id': ObjectId(relatorio_id), 'usuario_id': str(usuario_id)} if ObjectId.is_valid(relatorio_id) else {'_id': relatorio_id, 'usuario_id': str(usuario_id)}
            doc = relatorios_colecao.find_one(query)
            if doc:
                dados = doc
        except Exception as e:
            print(f"Erro ao buscar relatório no MongoDB: {e}")

    if not dados:
        dados = session.get('relatorio_dados')

    if not dados:
        return redirect(url_for('pagina_relatorio'))

    # Normalize dados para evitar Undefined no template
    dados_normalizados = {
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

    return render_template('paginaPDF/relatorio_pdf.html', dados=dados_normalizados, auto=auto)