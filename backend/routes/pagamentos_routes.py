# ==============================================================================
# pagamentos_routes.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
from datetime import datetime

from bson import ObjectId
import stripe
from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    flash,
)

from backend.db import usuario
from backend.pagamento.criar_assinatura import (
    criar_assinatura_stripe,
    verificar_token_stripe,
)
from backend.pagamento.cancelar_assinatura import cancelar_assinatura_stripe
from backend.pagamento.webhook_stripe import processar_webhook_stripe
from backend.pagamento.email_assinatura import enviar_email_confirmacao_assinatura


# ==============================================================================
# 2. BLUEPRINT
# ==============================================================================

pagamentos_bp = Blueprint("pagamentos", __name__)


# ==============================================================================
# 3. TELAS DE ASSINATURA E BLOQUEIO
# ==============================================================================

@pagamentos_bp.route("/assinaturas", endpoint="pagina_assinaturas")
def pagina_assinaturas():
    block_plans = True
    return render_template(
        "sistema_pagamento/assinaturas.html",
        block_plans=block_plans
    )


@pagamentos_bp.route("/bloqueio-assinatura", endpoint="pagina_bloqueio_assinatura")
def pagina_bloqueio_assinatura():
    motivo = request.args.get("motivo", "pendente")
    return render_template(
        "sistema_pagamento/bloqueio_assinatura.html",
        motivo=motivo
    )


# ==============================================================================
# 4. OPERAÇÕES STRIPE & ALIASES
# ==============================================================================

@pagamentos_bp.route("/criar-assinatura", methods=["POST"], endpoint="rota_criar_assinatura")
@pagamentos_bp.route("/criar-preferencia", methods=["POST"])  # Alias limpo redirecionado ao Stripe
def rota_criar_assinatura():
    return criar_assinatura_stripe()


@pagamentos_bp.route("/cancelar-assinatura", methods=["POST"], endpoint="rota_cancelar_assinatura")
def rota_cancelar_assinatura():
    return cancelar_assinatura_stripe()


@pagamentos_bp.route("/webhook/stripe", methods=["POST"], endpoint="rota_webhook_stripe")
@pagamentos_bp.route("/webhook-stripe", methods=["POST"])
@pagamentos_bp.route("/webhook-pagamento", methods=["POST"])
def rota_webhook_stripe():
    return processar_webhook_stripe()


@pagamentos_bp.route("/verificar-token-stripe", methods=["GET"], endpoint="rota_verificar_token_stripe")
@pagamentos_bp.route("/verificar-token-mp", methods=["GET"])  # Alias limpo mantendo integridade com Stripe
def rota_verificar_token_stripe():
    """Rota de diagnóstico para checar se a chave Stripe está válida."""
    return verificar_token_stripe()


# ==============================================================================
# 5. SUCESSO & FALHA PAGAMENTO
# ==============================================================================

@pagamentos_bp.route("/sucesso-pagamento", endpoint="sucesso_pagamento")
def sucesso_pagamento():
    """
    Confirma o pagamento após o usuário voltar do checkout Stripe.

    Fluxo:
      1. Coleta identificadores da sessão e da query string.
      2. Localiza o usuário por ID de sessão → metadata do Stripe → e-mail.
      3. Se o usuário existir, sincroniza assinatura no banco e sessão.
      4. Se não, mas houver `session_id`, redireciona para o cadastro.
      5. Caso contrário, apenas atualiza a sessão e renderiza o sucesso.
    """
    # --------------------------------------------------------------------------
    # 5.1. Coleta de parâmetros
    # --------------------------------------------------------------------------
    session_id = request.args.get("session_id")
    status = request.args.get("status") or "Aprovado"
    plano = (
        request.args.get("plano")
        or session.get("plano_escolhido")
        or session.get("usuario_perfil")
        or "ME"
    )
    email = ""
    customer_id = None
    subscription_id = None

    print(
        f"[sucesso_pagamento] Iniciando. session_id={session_id} | plano={plano} | session={dict(session)}"
    )

    # --------------------------------------------------------------------------
    # 5.2. Busca inicial do usuário (por sessão: ID e e-mail)
    # --------------------------------------------------------------------------
    usuario_existente = None
    user_id_sess = session.get("usuario_id")
    user_email_sess = session.get("usuario_email")

    if user_id_sess:
        try:
            ids_busca = [str(user_id_sess)]
            if ObjectId.is_valid(str(user_id_sess)):
                ids_busca.append(ObjectId(str(user_id_sess)))
            usuario_existente = usuario.find_one({"_id": {"$in": ids_busca}})
        except Exception as ex:
            print(f"[sucesso_pagamento] Erro ao buscar por ID de sessão: {ex}")

    if not usuario_existente and user_email_sess:
        usuario_existente = usuario.find_one({"email": user_email_sess.lower()})

    # --------------------------------------------------------------------------
    # 5.3. Enriquecimento a partir da Checkout Session do Stripe
    # --------------------------------------------------------------------------
    if session_id:
        try:
            stripe.api_key = os.getenv("STRIPE_API_KEY")
            if stripe.api_key:
                checkout_session = stripe.checkout.Session.retrieve(session_id)
                customer_details = checkout_session.get("customer_details") or {}
                email = (
                    customer_details.get("email")
                    or checkout_session.get("customer_email")
                    or email
                )
                metadata = checkout_session.get("metadata") or {}
                plano = metadata.get("plano") or plano
                user_id_meta = metadata.get("usuario_id")
                subscription_id = checkout_session.get("subscription")
                customer_id = checkout_session.get("customer")

                if not usuario_existente and user_id_meta:
                    try:
                        ids_busca = [str(user_id_meta)]
                        if ObjectId.is_valid(str(user_id_meta)):
                            ids_busca.append(ObjectId(str(user_id_meta)))
                        usuario_existente = usuario.find_one({"_id": {"$in": ids_busca}})
                    except Exception as ex:
                        print(f"[sucesso_pagamento] Erro ao buscar por metadata ID: {ex}")

                if not usuario_existente and email:
                    usuario_existente = usuario.find_one({"email": email.lower()})
        except Exception as e:
            print(f"[sucesso_pagamento] Erro ao consultar sessão Stripe ({session_id}): {e}")

    # --------------------------------------------------------------------------
    # 5.4. Usuário localizado → sincroniza banco + sessão e dispara e-mail
    # --------------------------------------------------------------------------
    if usuario_existente:
        update_fields = {
            "status_assinatura": "ativa",
            "tipo_perfil": plano,
            "atualizado_em": datetime.now()
        }
        if customer_id:
            update_fields["stripe_customer_id"] = customer_id
        if subscription_id:
            update_fields["stripe_subscription_id"] = subscription_id

        try:
            usuario.update_one(
                {"_id": usuario_existente["_id"]},
                {"$set": update_fields}
            )
        except Exception as ex:
            print(f"[sucesso_pagamento] ERRO ao atualizar MongoDB: {ex}")

        session["usuario_id"] = str(usuario_existente["_id"])
        session["usuario_nome"] = usuario_existente.get("nome", "")
        session["usuario_email"] = usuario_existente.get("email", "")
        session["usuario_perfil"] = plano
        session["plano_escolhido"] = plano
        session["status_assinatura"] = "ativa"
        session.modified = True

        email_dest = usuario_existente.get("email", email)
        nome_dest = usuario_existente.get("nome", "")
        if email_dest:
            try:
                enviar_email_confirmacao_assinatura(
                    email_usuario=email_dest,
                    nome_usuario=nome_dest,
                    plano=plano,
                    subscription_id=subscription_id or "",
                    session_id=session_id or "",
                )
            except Exception as ex_mail:
                print(f"[sucesso_pagamento] Erro ao disparar e-mail: {ex_mail}")

        return render_template(
            "sistema_pagamento/sucesso.html",
            status=status,
            plano=plano,
            email=usuario_existente.get("email", email),
            payment_id=subscription_id or session_id or "SUB-ATIVADA"
        )

    # --------------------------------------------------------------------------
    # 5.5. Sem usuário no banco, mas com `session_id` → cadastro
    # --------------------------------------------------------------------------
    if session_id:
        return redirect(url_for("auth.pagina_cadastro", session_id=session_id, plano=plano))

    # --------------------------------------------------------------------------
    # 5.6. Apenas sincroniza a sessão (usuário logado sem doc no banco)
    # --------------------------------------------------------------------------
    if user_id_sess or user_email_sess:
        session["status_assinatura"] = "ativa"
        session["usuario_perfil"] = plano
        session["plano_escolhido"] = plano
        session.modified = True

    return render_template(
        "sistema_pagamento/sucesso.html",
        status=status,
        plano=plano,
        email=email,
        payment_id=session_id
    )


@pagamentos_bp.route("/falha-pagamento", endpoint="falha_pagamento")
def falha_pagamento():
    return render_template("sistema_pagamento/falha.html")


# ==============================================================================
# 6. ATIVAÇÃO MANUAL DE ACESSO
# ==============================================================================

@pagamentos_bp.route("/ativar-acesso", endpoint="ativar_acesso")
def ativar_acesso():
    """
    Rota de ativação manual: consulta a API do Stripe para confirmar se o pagamento/assinatura
    está realmente ativo antes de liberar o acesso do usuário.
    """
    # --------------------------------------------------------------------------
    # 6.1. Identificação do usuário (sessão)
    # --------------------------------------------------------------------------
    user_id = session.get("usuario_id")
    user_email = session.get("usuario_email")

    if not user_id and not user_email:
        return redirect(url_for("pagina_login"))

    user = None
    if user_id:
        try:
            ids_busca = [str(user_id)]
            if ObjectId.is_valid(str(user_id)):
                ids_busca.append(ObjectId(str(user_id)))
            user = usuario.find_one({"_id": {"$in": ids_busca}})
        except Exception:
            pass
    if not user and user_email:
        user = usuario.find_one({"email": user_email.lower()})

    if not user:
        return redirect(url_for("pagina_login"))

    # --------------------------------------------------------------------------
    # 6.2. Atalho: banco já marca a assinatura como ativa
    # --------------------------------------------------------------------------
    status_bd = user.get("status_assinatura", "pendente")
    if status_bd == "ativa":
        plano_ativar = (
            request.args.get("plano")
            or session.get("plano_escolhido")
            or session.get("usuario_perfil")
            or user.get("tipo_perfil", "ME")
        ).strip().upper()
        if plano_ativar not in ["MEI", "ME"]:
            plano_ativar = "ME"
        session["status_assinatura"] = "ativa"
        session["usuario_perfil"] = plano_ativar
        session["plano_escolhido"] = plano_ativar
        session.modified = True
        return redirect(url_for("pagina_home"))

    # --------------------------------------------------------------------------
    # 6.3. Consulta ao Stripe para confirmar a assinatura
    # --------------------------------------------------------------------------
    subscription_id = user.get("stripe_subscription_id")
    customer_id = user.get("stripe_customer_id")
    STRIPE_SECRET_KEY = os.getenv("STRIPE_API_KEY")

    assinatura_confirmada = False

    if STRIPE_SECRET_KEY and subscription_id:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            sub = stripe.Subscription.retrieve(subscription_id)
            if sub and sub.get("status") in ("active", "trialing"):
                assinatura_confirmada = True
        except Exception as e:
            print(f"[ativar_acesso] Erro ao consultar Stripe ({subscription_id}): {e}")

    if not assinatura_confirmada and STRIPE_SECRET_KEY and customer_id:
        try:
            stripe.api_key = STRIPE_SECRET_KEY
            subs = stripe.Subscription.list(customer=customer_id, status="active", limit=1)
            if subs and len(subs.data) > 0:
                assinatura_confirmada = True
                new_sub_id_encontrado = subs.data[0].id
                usuario.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"stripe_subscription_id": new_sub_id_encontrado}}
                )
        except Exception as e:
            print(f"[ativar_acesso] Erro ao consultar Customer no Stripe: {e}")

    # --------------------------------------------------------------------------
    # 6.4. Liberação ou aviso de pendência
    # --------------------------------------------------------------------------
    if assinatura_confirmada:
        plano_ativar = (
            request.args.get("plano")
            or session.get("plano_escolhido")
            or session.get("usuario_perfil")
            or user.get("tipo_perfil", "ME")
        ).strip().upper()
        if plano_ativar not in ["MEI", "ME"]:
            plano_ativar = "ME"

        usuario.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "status_assinatura": "ativa",
                "tipo_perfil": plano_ativar,
                "atualizado_em": datetime.now()
            }}
        )
        session["status_assinatura"] = "ativa"
        session["usuario_perfil"] = plano_ativar
        session["plano_escolhido"] = plano_ativar
        session.modified = True
        return redirect(url_for("pagina_home"))
    else:
        flash(
            "Não identificamos o pagamento aprovado no Stripe para esta conta. "
            "Se você acabou de pagar, aguarde alguns instantes e tente novamente."
        )
        return redirect(url_for("pagina_bloqueio_assinatura", motivo="pendente"))