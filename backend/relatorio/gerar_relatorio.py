# ==============================================================================
# gerar_relatorio.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import request, jsonify, session, url_for
from datetime import datetime
from bson import ObjectId
from backend.db import relatorios_colecao


# ==============================================================================
# 2. GERAÇÃO DE RELATÓRIO
# ==============================================================================

def gerar_relatorio():
    """Salva um novo relatório no Mongo e atualiza a sessão (fallback + histórico)."""
    # --------------------------------------------------------------------------
    # 2.1. Autenticação e leitura do payload
    # --------------------------------------------------------------------------
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'mensagem': 'Usuário não autenticado'}), 401

    dados = request.get_json() or {}

    # Validação mínima
    if not dados.get('nome') or not dados.get('periodo'):
        return jsonify({'mensagem': 'Dados de relatório incompletos'}), 400

    # --------------------------------------------------------------------------
    # 2.2. Montagem do documento a ser persistido
    # --------------------------------------------------------------------------
    agora = datetime.now()
    documento = {
        'usuario_id': str(usuario_id),
        'tipo_relatorio': dados.get('tipo_relatorio', 'consolidado'),
        'nome': dados.get('nome', 'Relatório sem nome'),
        'subtitulo': dados.get('subtitulo', ''),
        'origem_nome': dados.get('origem_nome', 'Geral'),
        'analise_id': dados.get('analise_id', ''),
        'badge': dados.get('badge', ''),
        'cor': dados.get('cor', '#3b82f6'),
        'periodo': dados.get('periodo', ''),
        'data': dados.get('data', agora.strftime('%d/%m/%Y')),
        'kpis': dados.get('kpis', {}),
        'kpis_lista': dados.get('kpis_lista', []) or [],
        'grafico': bool(dados.get('grafico', False)),
        'grafico_tipo': dados.get('grafico_tipo', 'linha'),
        'grafico_series': dados.get('grafico_series', []) or [],
        'grafico_labels': dados.get('grafico_labels', []) or [],
        'tabela': dados.get('tabela', []),
        'tabela_colunas': dados.get('tabela_colunas', []) or [],
        'tendencias': bool(dados.get('tendencias', False)),
        'margem': bool(dados.get('margem', False)),
        'dadosDetalhados': bool(dados.get('dadosDetalhados', False)),
        'insights': dados.get('insights', []) or [],
        'insights_estruturados': dados.get('insights_estruturados', {}) or {},
        'conteudo_html': dados.get('conteudo_html', ''),
        'criado_em': agora,
        'atualizado_em': agora
    }

    # --------------------------------------------------------------------------
    # 2.3. Persistência no MongoDB (com fallback silencioso para sessão)
    # --------------------------------------------------------------------------
    try:
        resultado = relatorios_colecao.insert_one(documento)
        relatorio_id = str(resultado.inserted_id)
        documento['_id'] = relatorio_id
    except Exception as e:
        print(f"Erro ao salvar relatório no MongoDB: {e}")
        relatorio_id = ""

    # --------------------------------------------------------------------------
    # 2.4. Armazenar na sessão para renderizar em /relatorio_pdf (fallback)
    # --------------------------------------------------------------------------
    dados_com_id = {**dados, **documento, '_id': relatorio_id, 'id': relatorio_id}
    session['relatorio_dados'] = dados_com_id

    # --------------------------------------------------------------------------
    # 2.5. Histórico na sessão (compatibilidade retroativa)
    # --------------------------------------------------------------------------
    historico = session.get('relatorios_gerados', [])
    item_historico = {
        'id': relatorio_id,
        'tipo_relatorio': documento['tipo_relatorio'],
        'nome': documento['nome'],
        'subtitulo': documento['subtitulo'],
        'origem_nome': documento['origem_nome'],
        'periodo': documento['periodo'],
        'data': documento['data'],
        'kpis': documento['kpis'],
        'kpis_lista': documento['kpis_lista'],
        'grafico': documento['grafico'],
        'grafico_series': documento['grafico_series'],
        'grafico_labels': documento['grafico_labels'],
        'tabela': documento['tabela'],
        'tabela_colunas': documento['tabela_colunas'],
        'tendencias': documento['tendencias'],
        'margem': documento['margem'],
        'dadosDetalhados': documento['dadosDetalhados'],
        'insights': documento['insights'],
        'insights_estruturados': documento['insights_estruturados'],
    }
    historico.insert(0, item_historico)
    session['relatorios_gerados'] = historico[:10]

    # --------------------------------------------------------------------------
    # 2.6. Resposta
    # --------------------------------------------------------------------------
    redirect_url = (
        url_for('pagina_relatorio_pdf', id=relatorio_id)
        if relatorio_id
        else url_for('pagina_relatorio_pdf')
    )
    return jsonify({'success': True, 'id': relatorio_id, 'redirect': redirect_url}), 200


# ==============================================================================
# 3. LISTAGEM DE RELATÓRIOS
# ==============================================================================

def listar_relatorios_api():
    """Retorna a lista de relatórios salvos no MongoDB do usuário logado."""
    # --------------------------------------------------------------------------
    # 3.1. Autenticação
    # --------------------------------------------------------------------------
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado', 'relatorios': []}), 401

    # --------------------------------------------------------------------------
    # 3.2. Consulta no MongoDB
    # --------------------------------------------------------------------------
    try:
        ids_busca = [str(usuario_id)]
        if ObjectId.is_valid(str(usuario_id)):
            ids_busca.append(ObjectId(str(usuario_id)))
        cursor = relatorios_colecao.find({'usuario_id': {'$in': ids_busca}}).sort('criado_em', -1)
        relatorios = []
        for doc in cursor:
            doc_id = str(doc['_id'])
            criado_em = doc.get('criado_em')
            if isinstance(criado_em, datetime):
                data_iso = criado_em.isoformat()
                data_formatada = criado_em.strftime('%d %b %Y, %H:%M')
            else:
                data_iso = str(criado_em)
                data_formatada = doc.get('data', '')

            relatorios.append({
                'id': doc_id,
                'nome': doc.get('nome', 'Relatório'),
                'tipo_relatorio': doc.get('tipo_relatorio', 'consolidado'),
                'subtitulo': doc.get('subtitulo', ''),
                'origem_nome': doc.get('origem_nome', ''),
                'badge': doc.get('badge', ''),
                'cor': doc.get('cor', '#3b82f6'),
                'periodo': doc.get('periodo', ''),
                'data': data_iso,
                'dataFormatada': data_formatada,
                'kpis': doc.get('kpis', {}),
                'url': url_for('pagina_relatorio_pdf', id=doc_id)
            })

        return jsonify({'success': True, 'relatorios': relatorios}), 200
    except Exception as e:
        print(f"Erro ao listar relatórios do MongoDB: {e}")
        return jsonify({'erro': str(e), 'relatorios': []}), 500


# ==============================================================================
# 4. EXCLUSÃO DE RELATÓRIO
# ==============================================================================

def excluir_relatorio_api(relatorio_id):
    """Exclui um relatório do MongoDB do usuário logado."""
    # --------------------------------------------------------------------------
    # 4.1. Autenticação
    # --------------------------------------------------------------------------
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'mensagem': 'Não autenticado'}), 401

    # --------------------------------------------------------------------------
    # 4.2. Consulta e exclusão no MongoDB
    # --------------------------------------------------------------------------
    try:
        ids_busca = [str(usuario_id)]
        if ObjectId.is_valid(str(usuario_id)):
            ids_busca.append(ObjectId(str(usuario_id)))
        query = (
            {'_id': ObjectId(relatorio_id), 'usuario_id': {'$in': ids_busca}}
            if ObjectId.is_valid(relatorio_id)
            else {'_id': relatorio_id, 'usuario_id': {'$in': ids_busca}}
        )
        res = relatorios_colecao.delete_one(query)

        # ----------------------------------------------------------------------
        # 4.3. Atualizar a sessão se o relatório estiver no histórico local
        # ----------------------------------------------------------------------
        hist = session.get('relatorios_gerados', [])
        session['relatorios_gerados'] = [
            r for r in hist if str(r.get('id', '')) != str(relatorio_id)
        ]

        # ----------------------------------------------------------------------
        # 4.4. Resposta
        # ----------------------------------------------------------------------
        if res.deleted_count > 0:
            return jsonify({'success': True, 'mensagem': 'Relatório excluído com sucesso'}), 200
        else:
            return jsonify({'success': False, 'mensagem': 'Relatório não encontrado'}), 404
    except Exception as e:
        print(f"Erro ao excluir relatório no MongoDB: {e}")
        return jsonify({'mensagem': str(e)}), 500