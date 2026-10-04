# ==============================================================================
# app.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
from datetime import timedelta

from dotenv import load_dotenv
from flask import Flask, session
from flask_mail import Mail


# ==============================================================================
# 2. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
# ==============================================================================

load_dotenv()


# ==============================================================================
# 3. CRIAÇÃO DA APLICAÇÃO FLASK
# ==============================================================================

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "datainsight_default_secret_key_2026")


# ==============================================================================
# 4. CONTEXTO GLOBAL DE TEMPLATES (Perfil do Usuário ME/MEI)
# ==============================================================================

@app.context_processor
def inject_user_perfil():
    """Injeta dados do perfil do usuário em todos os templates Jinja."""
    perfil = session.get("usuario_perfil", "ME")
    return {
        "usuario_perfil": perfil,
        "is_mei": perfil == "MEI",
        "usuario_cnpj": session.get("usuario_cnpj", ""),
        "usuario_razao_social": session.get("usuario_razao_social", ""),
    }


# ==============================================================================
# 5. CONFIGURAÇÃO DE E-MAIL (Flask-Mail)
# ==============================================================================

app.config["MAIL_SERVER"] = os.getenv("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"] = int(os.getenv("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("EMAIL_USER")
app.config["MAIL_PASSWORD"] = os.getenv("EMAIL_PASS")
_email_user = os.getenv("EMAIL_USER", "")
app.config["MAIL_DEFAULT_SENDER"] = ("DataInsight", _email_user)
app.config["MAIL_MAX_EMAILS"] = 5
app.config["MAIL_SUPPRESS_SEND"] = False
app.config["TESTING"] = False

try:
    mail = Mail(app)
    app.mail = mail
    print("[OK] Flask-Mail inicializado com sucesso.")
except Exception as e:
    print(f"[ERRO] Erro ao inicializar Flask-Mail: {e}")
    mail = None
    app.mail = None


# ==============================================================================
# 6. CONFIGURAÇÃO DE UPLOAD (Deploy VPS/Linux)
# ==============================================================================

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "uploads"
)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


# ==============================================================================
# 7. CONFIGURAÇÃO DE SESSÃO SEGURA
# ==============================================================================

app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)


# ==============================================================================
# 8. REGISTRO DOS BLUEPRINTS MODULARES
# ==============================================================================

from backend.routes.auth_routes import auth_bp
from backend.routes.dados_routes import dados_bp
from backend.routes.analises_routes import analises_bp
from backend.routes.ia_routes import ia_bp
from backend.routes.pagamentos_routes import pagamentos_bp

app.register_blueprint(auth_bp)
app.register_blueprint(dados_bp)
app.register_blueprint(analises_bp)
app.register_blueprint(ia_bp)
app.register_blueprint(pagamentos_bp)


# ==============================================================================
# 9. ALIASES DE ENDPOINTS ENTRE BLUEPRINTS E CÓDIGO LEGADO
# ==============================================================================
# Registra aliases reais no url_map do Werkzeug para que
# url_for('endpoint_sem_prefixo') funcione mesmo que a rota esteja definida
# dentro de um blueprint (ex.: url_for('pagina_bloqueio_assinatura') resolve
# igual a url_for('pagamentos.pagina_bloqueio_assinatura')).
# ==============================================================================

def _registrar_aliases_blueprints(application):
    """
    Itera todas as regras do url_map e cria regras duplicadas (aliases) sem
    o prefixo do blueprint.
    """
    # --------------------------------------------------------------------------
    # 9.1. Coleta os aliases a registrar (evita mutação durante iteração)
    # --------------------------------------------------------------------------
    aliases_a_registrar = []

    for rule in list(application.url_map.iter_rules()):
        endpoint = rule.endpoint
        if "." in endpoint:
            base_endpoint = endpoint.split(".", 1)[1]
            # Só cria alias se o endpoint sem prefixo ainda não existe
            if base_endpoint not in application.view_functions:
                aliases_a_registrar.append((rule, base_endpoint, endpoint))

    # --------------------------------------------------------------------------
    # 9.2. Registra cada alias
    # --------------------------------------------------------------------------
    for rule, base_endpoint, original_endpoint in aliases_a_registrar:
        try:
            application.add_url_rule(
                rule.rule,
                endpoint=base_endpoint,
                view_func=application.view_functions[original_endpoint],
                methods=list(rule.methods - {"HEAD", "OPTIONS"}),
            )
        except (AssertionError, ValueError):
            # Ignora se a rota já existe ou conflito de URL (ex.: duas rotas no mesmo path)
            pass


_registrar_aliases_blueprints(app)


# ==============================================================================
# 10. INICIALIZAÇÃO
# ==============================================================================

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=7000)