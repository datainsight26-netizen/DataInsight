# ==============================================================================
# pagina_relatorio.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import render_template, session, url_for, redirect, request
from bson import ObjectId
from backend.db import relatorios_colecao


# ==============================================================================
# 2. PÁGINA: RELATÓRIO EM PDF
# ==============================================================================

def pagina_relatorio_pdf():
    """
    Renderiza a página de visualização do relatório em PDF.

    Ordem de busca dos dados:
      1. MongoDB — pelo `id` da query string, restrito ao usuário logado.
      2. Sessão — `session['relatorio_dados']` como fallback rápido.
      3. Nada encontrado → redireciona para a página de relatórios.
    """
    # --------------------------------------------------------------------------
    # 2.1. Contexto da requisição
    # --------------------------------------------------------------------------
    usuario_id = session.get('usuario_id')
    relatorio_id = request.args.get('id') or request.args.get('relatorio_id')
    dados = None

    # --------------------------------------------------------------------------
    # 2.2. Tentativa principal: buscar no MongoDB
    # --------------------------------------------------------------------------
    if relatorio_id and usuario_id:
        try:
            ids_busca = [str(usuario_id)]
            if ObjectId.is_valid(str(usuario_id)):
                ids_busca.append(ObjectId(str(usuario_id)))
            query = (
                {'_id': ObjectId(relatorio_id), 'usuario_id': {'$in': ids_busca}}
                if ObjectId.is_valid(relatorio_id)
                else {'_id': relatorio_id, 'usuario_id': {'$in': ids_busca}}
            )
            doc = relatorios_colecao.find_one(query)
            if doc:
                dados = doc
        except Exception as e:
            print(f"Erro ao buscar relatório no MongoDB: {e}")

    # --------------------------------------------------------------------------
    # 2.3. Fallback: dados armazenados na sessão
    # --------------------------------------------------------------------------
    if not dados:
        dados = session.get('relatorio_dados')

    # --------------------------------------------------------------------------
    # 2.4. Nada encontrado → volta para a página de relatórios
    # --------------------------------------------------------------------------
    if not dados:
        return redirect(url_for('pagina_relatorio'))

    # --------------------------------------------------------------------------
    # 2.5. Normalização para evitar Undefined no template
    # --------------------------------------------------------------------------
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

    # --------------------------------------------------------------------------
    # 2.6. Flag de impressão automática e render
    # --------------------------------------------------------------------------
    auto = request.args.get('auto') in ['1', 'true', 'True']

    return render_template(
        'paginaPDF/relatorio_pdf.html',
        dados=dados_normalizados,
        auto=auto
    )