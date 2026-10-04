# ==============================================================================
# auth_routes.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from datetime import datetime
from functools import wraps

from bson import ObjectId
from flask import Blueprint, session, redirect, url_for, request, render_template

from backend.db import usuario
from backend.user import (
    esqueceu_senha,
    login,
    reenviar_codigo,
    resetar_senha,
    tela_cadastro,
    verificar_codigo,
    alternar_perfil,
)


# ==============================================================================
# 2. BLUEPRINT
# ==============================================================================

auth_bp = Blueprint("auth", __name__)


# ==============================================================================
# 3. PROTEÇÃO & PAYWALL SAAS
# ==============================================================================

def login_required(f):
    """
    Decorator de autenticação + verificação de assinatura.

    Fluxo:
      1. Sem usuário na sessão → redireciona para o login.
      2. Carrega o documento do usuário (por _id, com fallback por e-mail).
      3. Sincroniza `usuario_perfil` na sessão com base em `plano_escolhido`
         ou `tipo_perfil`.
      4. Admins (flag ou e-mail) passam sem checagem de assinatura.
      5. Assinatura diferente de "ativa" → bloqueio; exceto se a sessão
         indicar "ativa", caso em que sincroniza o banco e libera.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):

        # ----------------------------------------------------------------------
        # 3.1. Verificação básica de sessão
        # ----------------------------------------------------------------------
        if "usuario_id" not in session and "usuario_nome" not in session:
            return redirect(url_for("pagina_login"))

        # ----------------------------------------------------------------------
        # 3.2. Carrega o usuário (por _id, com fallback por e-mail)
        # ----------------------------------------------------------------------
        user_id = session.get("usuario_id")
        user = None
        try:
            if user_id:
                try:
                    user = usuario.find_one({"_id": ObjectId(str(user_id))})
                except Exception:
                    user = (
                        usuario.find_one({"email": session.get("usuario_email")})
                        if session.get("usuario_email")
                        else None
                    )
            elif session.get("usuario_email"):
                user = usuario.find_one({"email": session.get("usuario_email")})
        except Exception as err_db:
            print(f"[Aviso DB login_required]: {err_db}")
            user = None

        # ----------------------------------------------------------------------
        # 3.3. Validações sobre o usuário carregado
        # ----------------------------------------------------------------------
        if user:
            # Sincroniza sempre o tipo_perfil na sessão
            if session.get("plano_escolhido"):
                session["usuario_perfil"] = session["plano_escolhido"]
            elif user.get("tipo_perfil"):
                session["usuario_perfil"] = user.get("tipo_perfil")

            # Admins liberados sem restrição
            if user.get("is_admin") or user.get("email") == "admin@datainsight.com":
                return f(*args, **kwargs)

            status = user.get("status_assinatura", "pendente")
            if status != "ativa":
                if session.get("status_assinatura") == "ativa":
                    try:
                        usuario.update_one(
                            {"_id": user["_id"]},
                            {"$set": {"status_assinatura": "ativa", "atualizado_em": datetime.now()}}
                        )
                        print(f"[login_required] Sincronizado status->ativa para user {user.get('email')} via sessão.")
                        return f(*args, **kwargs)
                    except Exception as ex:
                        print(f"[login_required] Falha ao sincronizar BD: {ex}")

                return redirect(url_for("pagina_bloqueio_assinatura", motivo=status))
        else:
            return redirect(url_for("pagina_login"))

        return f(*args, **kwargs)

    return decorated_function


# ==============================================================================
# 4. ROTAS DE AUTENTICAÇÃO
# ==============================================================================

# ------------------------------------------------------------------------------
# 4.1. Login
# ------------------------------------------------------------------------------

@auth_bp.route("/login", methods=["GET"], endpoint="pagina_login")
def pagina_login():
    if "usuario_nome" in session:
        return redirect(url_for("pagina_home"))
    return render_template("login.html")


@auth_bp.route("/login", methods=["POST"], endpoint="rota_login")
@auth_bp.route("/entrar", methods=["GET", "POST"], endpoint="pg_login")  # Alias legado: suporta GET (render) e POST (submit)
def rota_login():
    if request.method == "GET":
        if "usuario_nome" in session:
            return redirect(url_for("pagina_home"))
        return render_template("login.html")
    return login()


# ------------------------------------------------------------------------------
# 4.2. Cadastro
# ------------------------------------------------------------------------------

@auth_bp.route("/cadastro", methods=["GET", "POST"], endpoint="pagina_cadastro")
@auth_bp.route("/registro", methods=["GET", "POST"], endpoint="pg_cadastro")  # Alias legado usado nos templates
def pagina_cadastro():
    return tela_cadastro()


# ------------------------------------------------------------------------------
# 4.3. Logout
# ------------------------------------------------------------------------------

@auth_bp.route("/logout", endpoint="rota_logout")
@auth_bp.route("/sair", endpoint="logout")  # Alias legado usado nos templates
def rota_logout():
    session.clear()
    return redirect(url_for("pagina_login"))


# ------------------------------------------------------------------------------
# 4.4. Recuperação de senha
# ------------------------------------------------------------------------------

@auth_bp.route("/esqueceu-senha", methods=["GET", "POST"], endpoint="pagina_esqueceu_senha")
@auth_bp.route("/esqueceu-senha-v2", methods=["GET", "POST"], endpoint="esqueceu_senha_route")  # Alias legado
def pagina_esqueceu_senha():
    return esqueceu_senha()


@auth_bp.route("/verificar_codigo", methods=["GET", "POST"], endpoint="verificar_codigo_route")
def verificar_codigo_route():
    return verificar_codigo()


@auth_bp.route("/resetar_senha", methods=["GET", "POST"], endpoint="resetar_senha_route")
def resetar_senha_route():
    return resetar_senha()


@auth_bp.route("/reenviar-codigo", endpoint="route_reenviar_codigo")
def route_reenviar_codigo():
    """Reenvia o código de recuperação para o email"""
    return reenviar_codigo()


# ------------------------------------------------------------------------------
# 4.5. Alternância de perfil
# ------------------------------------------------------------------------------

@auth_bp.route("/api/usuario/alternar-perfil", methods=["POST"], endpoint="rota_alternar_perfil")
@login_required
def rota_alternar_perfil():
    """Alterna perfil do usuário entre MEI e ME"""
    return alternar_perfil()