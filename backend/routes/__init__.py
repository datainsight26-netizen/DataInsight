"""
Módulo de registro e inicialização de rotas modulares (Flask Blueprints) - DataInsight
"""
from backend.routes.auth_routes import auth_bp
from backend.routes.dados_routes import dados_bp
from backend.routes.analises_routes import analises_bp
from backend.routes.ia_routes import ia_bp
from backend.routes.pagamentos_routes import pagamentos_bp

__all__ = [
    "auth_bp",
    "dados_bp",
    "analises_bp",
    "ia_bp",
    "pagamentos_bp",
]
