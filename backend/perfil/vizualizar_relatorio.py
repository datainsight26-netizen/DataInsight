from flask import session, redirect, url_for
from bson import ObjectId
from backend.db import relatorios_colecao


def vizualizar_relatorio(index):
    usuario_id = session.get('usuario_id')

    # Verificar se index é um ObjectId string válido
    if str(index).isalnum() and len(str(index)) == 24 and usuario_id:
        try:
            doc = relatorios_colecao.find_one({'_id': ObjectId(str(index)), 'usuario_id': str(usuario_id)})
            if doc:
                session['relatorio_dados'] = doc
                return redirect(url_for('pagina_relatorio_pdf', id=str(index)))
        except Exception:
            pass

    # Fallback por índice numérico
    try:
        idx = int(index)
        historico = session.get('relatorios_gerados', [])
        if 0 <= idx < len(historico):
            session['relatorio_dados'] = historico[idx]
            rel_id = historico[idx].get('id')
            if rel_id:
                return redirect(url_for('pagina_relatorio_pdf', id=str(rel_id)))
            return redirect(url_for('pagina_relatorio_pdf'))
    except Exception:
        pass

    return redirect(url_for('pagina_perfil'))