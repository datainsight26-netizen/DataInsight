
from flask import session, render_template

def pagina_perfil():
    ultimos_relatorios = session.get('relatorios_gerados', [])
    ultimos_relatorios_filtrados = ultimos_relatorios[:4]
    
    ultimas_analises = session.get('analises_realizadas', [])
    ultimas_analises_filtradas = ultimas_analises[:5]
    
    return render_template("perfil.html", 
                         ultimos_relatorios=ultimos_relatorios_filtrados,
                         ultimas_analises=ultimas_analises_filtradas)