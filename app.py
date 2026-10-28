# ==============================================================================
# app.py
# ==============================================================================
# Este código pertence à plataforma @EnterSight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
import sys
from datetime import timedelta

from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, session, request, render_template, redirect, url_for
from flask_mail import Mail


# ==============================================================================
# 2. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
# ==============================================================================

if getattr(sys, "frozen", False):
    base_dir_app = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
    env_local = os.path.join(os.path.dirname(sys.executable), ".env")
    if os.path.exists(env_local):
        load_dotenv(env_local)
    else:
        load_dotenv(os.path.join(base_dir_app, ".env"))
else:
    base_dir_app = os.path.dirname(os.path.abspath(__file__))
    load_dotenv()


# ==============================================================================
# 3. CRIAÇÃO DA APLICAÇÃO FLASK
# ==============================================================================

if getattr(sys, "frozen", False):
    template_folder = os.path.join(base_dir_app, "templates")
    static_folder = os.path.join(base_dir_app, "static")
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

app.secret_key = os.getenv("SECRET_KEY", "EnterSight_default_secret_key_2026")


# ==============================================================================
# 4. CONTEXTO GLOBAL DE TEMPLATES (Perfil do Usuário ME/MEI)
# ==============================================================================

@app.context_processor
def inject_user_perfil():
    """Injeta dados do perfil do usuário e helpers de rotas em todos os templates Jinja."""
    perfil = session.get("usuario_perfil") or session.get("plano") or "ME"

    endpoint_atual = getattr(request, "endpoint", "") or ""
    endpoint_base = endpoint_atual.split(".")[-1] if "." in endpoint_atual else endpoint_atual

    def rota_ativa(*nomes):
        """Retorna True se o endpoint atual corresponder a qualquer um dos nomes (com ou sem prefixo de blueprint)."""
        if not endpoint_atual:
            return False
        for nome in nomes:
            if endpoint_atual == nome or endpoint_base == nome:
                return True
        return False

    return {
        "usuario_perfil": perfil,
        "is_mei": str(perfil).strip().upper() == "MEI",
        "usuario_cnpj": session.get("usuario_cnpj", ""),
        "usuario_razao_social": session.get("usuario_razao_social", ""),
        "endpoint_base": endpoint_base,
        "rota_ativa": rota_ativa,
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
app.config["MAIL_DEFAULT_SENDER"] = ("EnterSight", _email_user)
app.config["MAIL_MAX_EMAILS"] = 5
app.config["MAIL_SUPPRESS_SEND"] = False
app.config["MAIL_TIMEOUT"] = int(os.getenv("MAIL_TIMEOUT", 5))
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

if getattr(sys, "frozen", False):
    UPLOAD_FOLDER = os.path.join(os.path.dirname(sys.executable), "uploads")
else:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

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
# 9. ROTA INDEX / RAIZ — Verificação de sessão e assinatura
# ==============================================================================

@app.route("/", endpoint="index")
@app.route("/inicio", endpoint="pagina_landing")   # alias: url_for('pagina_landing') continua funcionando nos templates
def index():
    """
    Rota raiz da aplicação.

    SEMPRE renderiza index.html (animação de entrada).
    O `destino` passado ao template determina para onde a
    animação redireciona automaticamente após 15 s (ou Enter):
      → '/home'    se o usuário está logado com assinatura ativa
      → '/landing' em todos os outros casos
    """
    # ------------------------------------------------------------------
    # 9.1. Sem sessão → destino landing
    # ------------------------------------------------------------------
    if "usuario_id" not in session and "usuario_nome" not in session:
        return render_template("index.html", destino="/landing")

    # ------------------------------------------------------------------
    # 9.2. Carrega o usuário do banco
    # ------------------------------------------------------------------
    from backend.db import usuario as usuario_col
    from datetime import datetime as _dt

    user_id   = session.get("usuario_id")
    user_email = session.get("usuario_email")
    user = None

    try:
        if user_id:
            try:
                user = usuario_col.find_one({"_id": ObjectId(str(user_id))})
            except Exception:
                if user_email:
                    user = usuario_col.find_one({"email": user_email.lower()})
        elif user_email:
            user = usuario_col.find_one({"email": user_email.lower()})
    except Exception as err_db:
        print(f"[index] Erro ao consultar banco: {err_db}")

    # ------------------------------------------------------------------
    # 9.3. Sem doc no banco → destino landing
    # ------------------------------------------------------------------
    if not user:
        return render_template("index.html", destino="/landing")

    # ------------------------------------------------------------------
    # 9.4. Admins: destino home
    # ------------------------------------------------------------------
    if user.get("is_admin") or user.get("email") == "admin@EnterSight.com":
        if user.get("tipo_perfil"):
            session["usuario_perfil"] = user["tipo_perfil"]
        session.modified = True
        return render_template("index.html", destino="/home")

    # ------------------------------------------------------------------
    # 9.5. Verifica assinatura
    # ------------------------------------------------------------------
    status_banco = user.get("status_assinatura", "pendente")
    status_sessao = session.get("status_assinatura", "")

    if status_banco == "ativa":
        # Assinatura confirmada no banco → destino home
        if user.get("tipo_perfil"):
            session["usuario_perfil"] = user["tipo_perfil"]
        session["status_assinatura"] = "ativa"
        session.modified = True
        return render_template("index.html", destino="/home")

    if status_sessao == "ativa":
        # Sessão diz ativa, banco diverge → sincroniza banco e libera
        try:
            usuario_col.update_one(
                {"_id": user["_id"]},
                {"$set": {"status_assinatura": "ativa", "atualizado_em": _dt.now()}}
            )
            print(f"[index] Sincronizado status->ativa para {user.get('email')} via sessão.")
        except Exception as ex:
            print(f"[index] Falha ao sincronizar banco: {ex}")
        if user.get("tipo_perfil"):
            session["usuario_perfil"] = user["tipo_perfil"]
        session.modified = True
        return render_template("index.html", destino="/home")

    # ------------------------------------------------------------------
    # 9.6. Assinatura pendente/cancelada → landing
    # ------------------------------------------------------------------
    return render_template("index.html", destino="/landing")


# ==============================================================================
# 10. ROTA DA LANDING PAGE (landig.html)
# ==============================================================================

@app.route("/landing", endpoint="landing")
@app.route("/landig", endpoint="landig")
@app.route("/landing.html")
@app.route("/landig.html")
def landing():
    """Renderiza a landing page principal da plataforma EnterSight."""
    return render_template("landig.html")


# ==============================================================================
# 11. ALIASES DE ENDPOINTS ENTRE BLUEPRINTS E CÓDIGO LEGADO
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
    # 11.1. Coleta os aliases a registrar (evita mutação durante iteração)
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
    # 11.2. Registra cada alias
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
# 12. INICIALIZAÇÃO
# ==============================================================================

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)