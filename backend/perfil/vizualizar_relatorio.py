from flask import session, redirect, url_for

def vizualizar_relatorio(index):
    historico = session.get('relatorios_gerados', [])
    if index < 0 or index >= len(historico):
        return redirect(url_for('pagina_perfil'))

    session['relatorio_dados'] = historico[index]
    return redirect(url_for('pagina_relatorio_pdf'))  