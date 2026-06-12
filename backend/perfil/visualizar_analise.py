from flask import session, redirect, url_for

def visualizar_analise(index):
    historico = session.get('analises_realizadas', [])
    if index < 0 or index >= len(historico):
        return redirect(url_for('pagina_perfil'))

    session['analise_selecionada'] = historico[index]
    return redirect(url_for('pagina_analise'))