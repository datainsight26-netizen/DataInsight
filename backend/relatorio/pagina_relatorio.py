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
        'id': str(dados.get('_id') or dados.get('id') or ''),
        'tipo_relatorio': dados.get('tipo_relatorio', 'consolidado'),
        'nome': dados.get('nome', 'Relatório'),
        'subtitulo': dados.get('subtitulo', ''),
        'origem_nome': dados.get('origem_nome', 'Geral'),
        'analise_id': dados.get('analise_id', ''),
        'badge': dados.get('badge', ''),
        'cor': dados.get('cor', '#3b82f6'),
        'periodo': dados.get('periodo', ''),
        'data': dados.get('data', ''),
        'kpis': dados.get('kpis', {}),
        'kpis_lista': dados.get('kpis_lista', []) or [],
        'grafico': dados.get('grafico', False),
        'grafico_tipo': dados.get('grafico_tipo', 'linha'),
        'grafico_series': dados.get('grafico_series', []) or [],
        'grafico_labels': dados.get('grafico_labels', []) or [],
        'tendencias': dados.get('tendencias', False),
        'margem': dados.get('margem', False),
        'dadosDetalhados': dados.get('dadosDetalhados', False),
        'tabela': dados.get('tabela', []) or [],
        'tabela_colunas': dados.get('tabela_colunas', []) or [],
        'insights': dados.get('insights', []) or [],
        'insights_estruturados': dados.get('insights_estruturados', {}) or {},
        'conteudo_html': dados.get('conteudo_html', '')
    }

    auto = request.args.get('auto') in ['1', 'true', 'True']

    return render_template('paginaPDF/relatorio_pdf.html', dados=dados_normalizados, auto=auto)