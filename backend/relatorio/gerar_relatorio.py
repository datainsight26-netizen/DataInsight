from flask import request, jsonify, session, url_for
from datetime import datetime
from bson import ObjectId
from backend.db import relatorios_colecao


def gerar_relatorio():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'mensagem': 'Usuário não autenticado'}), 401

    dados = request.get_json() or {}

    # Validação mínima
    if not dados.get('nome') or not dados.get('periodo'):
        return jsonify({'mensagem': 'Dados de relatório incompletos'}), 400

    agora = datetime.now()
    documento = {
        'usuario_id': str(usuario_id),
        'nome': dados.get('nome', 'Relatório sem nome'),
        'periodo': dados.get('periodo', ''),
        'data': dados.get('data', agora.strftime('%d/%m/%Y')),
        'kpis': dados.get('kpis', {}),
        'grafico': bool(dados.get('grafico', False)),
        'tabela': dados.get('tabela', []),
        'tendencias': bool(dados.get('tendencias', False)),
        'margem': bool(dados.get('margem', False)),
        'dadosDetalhados': bool(dados.get('dadosDetalhados', False)),
        'insights': dados.get('insights', []) or [],
        'criado_em': agora,
        'atualizado_em': agora
    }

    try:
        resultado = relatorios_colecao.insert_one(documento)
        relatorio_id = str(resultado.inserted_id)
        documento['_id'] = relatorio_id
    except Exception as e:
        print(f"Erro ao salvar relatório no MongoDB: {e}")
        relatorio_id = ""

    # Armazenar no session para renderizar em /relatorio_pdf como fallback rápido
    dados_com_id = {**dados, '_id': relatorio_id, 'id': relatorio_id}
    session['relatorio_dados'] = dados_com_id

    # Histórico na sessão (compatibilidade retroativa)
    historico = session.get('relatorios_gerados', [])
    item_historico = {
        'id': relatorio_id,
        'nome': documento['nome'],
        'periodo': documento['periodo'],
        'data': documento['data'],
        'kpis': documento['kpis'],
        'grafico': documento['grafico'],
        'tabela': documento['tabela'],
        'tendencias': documento['tendencias'],
        'margem': documento['margem'],
        'dadosDetalhados': documento['dadosDetalhados'],
        'insights': documento['insights'],
    }
    historico.insert(0, item_historico)
    session['relatorios_gerados'] = historico[:10]

    redirect_url = url_for('pagina_relatorio_pdf', id=relatorio_id) if relatorio_id else url_for('pagina_relatorio_pdf')
    return jsonify({'success': True, 'id': relatorio_id, 'redirect': redirect_url}), 200


def listar_relatorios_api():
    """Retorna a lista de relatórios salvos no MongoDB do usuário logado."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'erro': 'Não autenticado', 'relatorios': []}), 401

    try:
        cursor = relatorios_colecao.find({'usuario_id': str(usuario_id)}).sort('criado_em', -1)
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


def excluir_relatorio_api(relatorio_id):
    """Exclui um relatório do MongoDB do usuário logado."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({'mensagem': 'Não autenticado'}), 401

    try:
        query = {'_id': ObjectId(relatorio_id), 'usuario_id': str(usuario_id)} if ObjectId.is_valid(relatorio_id) else {'_id': relatorio_id, 'usuario_id': str(usuario_id)}
        res = relatorios_colecao.delete_one(query)

        # Atualizar session se aplicável
        hist = session.get('relatorios_gerados', [])
        session['relatorios_gerados'] = [r for r in hist if str(r.get('id', '')) != str(relatorio_id)]

        if res.deleted_count > 0:
            return jsonify({'success': True, 'mensagem': 'Relatório excluído com sucesso'}), 200
        else:
            return jsonify({'success': False, 'mensagem': 'Relatório não encontrado'}), 404
    except Exception as e:
        print(f"Erro ao excluir relatório no MongoDB: {e}")
        return jsonify({'mensagem': str(e)}), 500