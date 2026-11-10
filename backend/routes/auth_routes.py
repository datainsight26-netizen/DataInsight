# ==============================================================================
# auth_routes.py
# ==============================================================================
# Este código pertence à plataforma @EnterSight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from datetime import datetime
from functools import wraps

from bson import ObjectId
from flask import (
    Blueprint,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from backend.db import usuario
from backend.sessoes import (
    MAX_SESSOES_SIMULTANEAS,
    MENSAGEM_ERRO_INTERNO,
    encerrar_sessao_atual,
    listar_sessoes_ativas,
    mensagem_para_motivo,
    revogar_outras_sessoes,
    revogar_sessao,
    validar_sessao_atual,
)
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
# 3. UTILITÁRIOS
# ==============================================================================

def _e_requisicao_api():
    """Detecta requisições que esperam JSON (para devolver 401 em vez de HTML)."""
    if request.path.startswith("/api/"):
        return True
    if request.is_json:
        return True
    return request.accept_mimetypes.best == "application/json"


def _resposta_sessao_invalida(resultado):
    """Resposta padronizada para sessão inválida/revogada/expirada."""
    motivo = (resultado or {}).get("motivo") or "sessao_encerrada"
    mensagem = mensagem_para_motivo(motivo)

    if motivo == "erro":
        if _e_requisicao_api():
            return jsonify({
                "sucesso": False,
                "codigo": "erro_validacao_sessao",
                "mensagem": MENSAGEM_ERRO_INTERNO,
            }), 503
        return render_template("login.html", error=True, msg=MENSAGEM_ERRO_INTERNO), 503

    session.clear()

    if _e_requisicao_api():
        return jsonify({
            "sucesso": False,
            "codigo": "sessao_invalida",
            "motivo": motivo,
            "mensagem": mensagem,
        }), 401

    return redirect(url_for("pagina_login", motivo=motivo))


# ==============================================================================
# 4. PROTEÇÃO & PAYWALL SAAS
# ==============================================================================

def login_required(f):
    """
    Decorator de autenticação + verificação de assinatura + validação da
    sessão lógica no banco.

    Fluxo:
      1. Sem usuário na sessão → redireciona para o login (ou 401 em APIs).
      2. Valida a sessão lógica (token + status + expiração) no MongoDB.
      3. Carrega o documento do usuário (por _id, com fallback por e-mail).
      4. Sincroniza `usuario_perfil` na sessão com base em `plano_escolhido`
         ou `tipo_perfil`.
      5. Admins (flag ou e-mail) passam sem checagem de assinatura.
      6. Assinatura diferente de "ativa" → bloqueio; exceto se a sessão
         indicar "ativa", caso em que sincroniza o banco e libera.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):

        # ----------------------------------------------------------------------
        # 4.1. Verificação básica de sessão
        # ----------------------------------------------------------------------
        if "usuario_id" not in session and "usuario_nome" not in session:
            if _e_requisicao_api():
                return jsonify({
                    "sucesso": False,
                    "codigo": "nao_autenticado",
                    "mensagem": "Faça login para continuar.",
                }), 401
            return redirect(url_for("pagina_login"))

        # ----------------------------------------------------------------------
        # 4.2. Validação contínua da sessão lógica (não basta o cookie assinado)
        # ----------------------------------------------------------------------
        validacao = validar_sessao_atual()
        if not validacao.get("valida"):
            return _resposta_sessao_invalida(validacao)

        # ----------------------------------------------------------------------
        # 4.3. Carrega o usuário (por _id, com fallback por e-mail)
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
        # 4.4. Validações sobre o usuário carregado
        # ----------------------------------------------------------------------
        if user:
            # Sincroniza sempre o tipo_perfil na sessão
            if session.get("plano_escolhido"):
                session["usuario_perfil"] = session["plano_escolhido"]
            elif user.get("tipo_perfil"):
                session["usuario_perfil"] = user.get("tipo_perfil")

            # Admins liberados sem restrição de assinatura (a sessão continua
            # sendo validada normalmente acima).
            if user.get("is_admin") or user.get("email") == "admin@EnterSight.com":
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
# 5. ROTAS DE AUTENTICAÇÃO
# ==============================================================================

# ------------------------------------------------------------------------------
# 5.1. Login
# ------------------------------------------------------------------------------

@auth_bp.route("/login", methods=["GET"], endpoint="pagina_login")
def pagina_login():
    # Se já existe um cookie antigo, só redireciona para a home se a sessão
    # lógica continuar válida no banco. Caso contrário, limpa e mostra o login.
    if "usuario_nome" in session:
        validacao = validar_sessao_atual()
        if validacao.get("valida"):
            return redirect(url_for("pagina_home"))
        if validacao.get("motivo") == "erro":
            return render_template("login.html", error=True, msg=MENSAGEM_ERRO_INTERNO), 503
        session.clear()

    motivo = request.args.get("motivo")
    if motivo:
        return render_template("login.html", error=True, msg=mensagem_para_motivo(motivo))

    return render_template("login.html")


@auth_bp.route("/login", methods=["POST"], endpoint="rota_login")
@auth_bp.route("/entrar", methods=["GET", "POST"], endpoint="pg_login")  # Alias legado: suporta GET (render) e POST (submit)
def rota_login():
    if request.method == "GET":
        return pagina_login()
    return login()


# ------------------------------------------------------------------------------
# 5.2. Cadastro
# ------------------------------------------------------------------------------

@auth_bp.route("/cadastro", methods=["GET", "POST"], endpoint="pagina_cadastro")
@auth_bp.route("/registro", methods=["GET", "POST"], endpoint="pg_cadastro")  # Alias legado usado nos templates
def pagina_cadastro():
    return tela_cadastro()


# ------------------------------------------------------------------------------
# 5.3. Logout
# ------------------------------------------------------------------------------

@auth_bp.route("/logout", endpoint="rota_logout")
@auth_bp.route("/sair", endpoint="logout")  # Alias legado usado nos templates
def rota_logout():
    encerrar_sessao_atual(motivo="logout")
    session.clear()
    return redirect(url_for("pagina_login", motivo="logout"))


# ------------------------------------------------------------------------------
# 5.4. Recuperação de senha
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
# 5.5. Alternância de perfil
# ------------------------------------------------------------------------------

@auth_bp.route("/api/usuario/alternar-perfil", methods=["POST"], endpoint="rota_alternar_perfil")
@login_required
def rota_alternar_perfil():
    """Alterna perfil do usuário entre MEI e ME"""
    return alternar_perfil()


# ==============================================================================
# 6. GERENCIAMENTO DE SESSÕES / DISPOSITIVOS CONECTADOS
# ==============================================================================

@auth_bp.route("/api/sessoes", methods=["GET"], endpoint="api_listar_sessoes")
@login_required
def api_listar_sessoes():
    """Lista as sessões ativas do usuário autenticado."""
    usuario_id = session.get("usuario_id")
    token_atual = session.get("sessao_token")
    lista = listar_sessoes_ativas(usuario_id, token_atual)

    return jsonify({
        "sucesso": True,
        "limite": MAX_SESSOES_SIMULTANEAS,
        "total": len(lista),
        "sessao_atual_id": session.get("sessao_id"),
        "sessoes": lista,
    })


@auth_bp.route(
    "/api/sessoes/encerrar-outras",
    methods=["DELETE", "POST"],
    endpoint="api_encerrar_outras_sessoes",
)
@login_required
def api_encerrar_outras_sessoes():
    """Encerra todas as sessões do usuário, preservando a sessão atual."""
    usuario_id = session.get("usuario_id")
    token_atual = session.get("sessao_token")

    if not token_atual:
        return jsonify({
            "sucesso": False,
            "codigo": "sessao_atual_nao_identificada",
            "mensagem": "Não foi possível identificar a sessão atual.",
        }), 400

    total = revogar_outras_sessoes(usuario_id, token_atual)
    return jsonify({
        "sucesso": True,
        "encerradas": total,
        "mensagem": (
            "Nenhuma outra sessão estava ativa."
            if total == 0
            else f"{total} sessão(ões) encerrada(s) com sucesso."
        ),
    })


@auth_bp.route(
    "/api/sessoes/<sessao_id>",
    methods=["DELETE", "POST"],
    endpoint="api_encerrar_sessao",
)
@login_required
def api_encerrar_sessao(sessao_id):
    """
    Encerra uma sessão específica do usuário autenticado.

    A consulta de revogação inclui o `usuario_id`, impedindo que um usuário
    encerre sessões de outra conta.
    """
    resultado = revogar_sessao(
        session.get("usuario_id"),
        sessao_id,
        motivo="encerrada_pelo_usuario",
    )

    if not resultado.get("ok"):
        motivo = resultado.get("motivo")
        if motivo == "nao_encontrada":
            return jsonify({
                "sucesso": False,
                "codigo": "sessao_nao_encontrada",
                "mensagem": "Sessão não encontrada para esta conta.",
            }), 404
        return jsonify({
            "sucesso": False,
            "codigo": "sessao_invalida",
            "mensagem": "Não foi possível encerrar a sessão.",
        }), 400

    era_atual = bool(resultado.get("era_atual"))
    if era_atual:
        session.clear()

    return jsonify({
        "sucesso": True,
        "era_sessao_atual": era_atual,
        "mensagem": "Sessão encerrada com sucesso.",
    })
