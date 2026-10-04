# ==============================================================================
# webhook_stripe.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import request, jsonify
import os
import stripe
from datetime import datetime
from bson import ObjectId
from backend.db import usuario
from backend.pagamento.email_assinatura import enviar_email_confirmacao_assinatura


# ==============================================================================
# 2. FUNÇÕES AUXILIARES
# ==============================================================================

def _buscar_nome_usuario(query: dict) -> str:
    """Busca o nome do usuário no banco para personalizar o e-mail."""
    try:
        doc = usuario.find_one(query, {"nome": 1})
        return doc.get("nome", "") if doc else ""
    except Exception:
        return ""


# ==============================================================================
# 3. PROCESSAMENTO DO WEBHOOK STRIPE
# ==============================================================================

def processar_webhook_stripe():
    """
    Processa os webhooks oficiais do Stripe para gerenciar o ciclo de vida
    da assinatura recorrente (ativação, renovação, inadimplência e cancelamento).
    Envia e-mail de confirmação ao cliente em caso de pagamento aprovado.
    """
    # --------------------------------------------------------------------------
    # 3.1. Leitura do payload e validação da assinatura do Stripe
    # --------------------------------------------------------------------------
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    event = None

    try:
        if webhook_secret:
            event = stripe.Webhook.construct_event(
                payload, sig_header, webhook_secret
            )
        else:
            # Em ambiente de desenvolvimento local sem secret configurado
            event = request.get_json(force=True)
    except ValueError as e:
        print(f"✗ Payload inválido no Webhook Stripe: {e}")
        return jsonify({"erro": "Payload inválido"}), 400
    except stripe.error.SignatureVerificationError as e:
        print(f"✗ Assinatura inválida no Webhook Stripe: {e}")
        return jsonify({"erro": "Assinatura inválida"}), 400
    except Exception as e:
        print(f"✗ Erro ao processar evento do Webhook: {e}")
        return jsonify({"erro": str(e)}), 400

    # --------------------------------------------------------------------------
    # 3.2. Extração dos dados básicos do evento
    # --------------------------------------------------------------------------
    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})
    print(f" [Stripe Webhook] Evento recebido: {event_type}")

    # --------------------------------------------------------------------------
    # 3.3. Evento: Checkout inicial concluído com sucesso
    # --------------------------------------------------------------------------
    if event_type == "checkout.session.completed":
        session = data_object
        customer_email = session.get("customer_details", {}).get("email") or session.get("customer_email")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        metadata = session.get("metadata") or {}
        plano = metadata.get("plano", "ME")
        usuario_id = metadata.get("usuario_id")

        # Monta o filtro de busca do usuário (por _id ou por e-mail)
        query = {}
        if usuario_id:
            try:
                query = {"_id": ObjectId(usuario_id)}
            except Exception:
                query = {"email": customer_email}
        elif customer_email:
            query = {"email": customer_email}

        if query:
            usuario.update_one(
                query,
                {"$set": {
                    "status_assinatura": "ativa",
                    "tipo_perfil": plano,
                    "stripe_customer_id": customer_id,
                    "stripe_subscription_id": subscription_id,
                    "atualizado_em": datetime.now()
                }}
            )
            print(f"✓ Assinatura ativada para usuário ({query}) com plano {plano}")

            # ── Enviar e-mail de confirmação de assinatura ──
            if customer_email:
                nome = _buscar_nome_usuario(query)
                enviado = enviar_email_confirmacao_assinatura(
                    email_usuario=customer_email,
                    nome_usuario=nome,
                    plano=plano,
                    subscription_id=subscription_id or "",
                    session_id=session.get("id", ""),
                )
                if enviado:
                    print(f"✉ E-mail de confirmação enviado para {customer_email}")
                else:
                    print(f"⚠ Falha ao enviar e-mail de confirmação para {customer_email}")

    # --------------------------------------------------------------------------
    # 3.4. Evento: Pagamento de mensalidade recorrente aprovado
    # --------------------------------------------------------------------------
    elif event_type == "invoice.payment_succeeded":
        invoice = data_object
        subscription_id = invoice.get("subscription")
        customer_email = invoice.get("customer_email")

        # Ignora faturas de primeiro pagamento (billing_reason == 'subscription_create')
        # pois o checkout.session.completed já cuida do e-mail inicial.
        billing_reason = invoice.get("billing_reason", "")

        filtro = {}
        if subscription_id:
            filtro = {"stripe_subscription_id": subscription_id}
        elif customer_email:
            filtro = {"email": customer_email}

        if filtro:
            # Busca plano atual do usuário no banco
            doc = usuario.find_one(filtro, {"tipo_perfil": 1, "nome": 1})
            plano_atual = doc.get("tipo_perfil", "ME") if doc else "ME"
            nome_usuario = doc.get("nome", "") if doc else ""

            usuario.update_one(
                filtro,
                {"$set": {
                    "status_assinatura": "ativa",
                    "atualizado_em": datetime.now()
                }}
            )
            print(f"✓ Mensalidade renovada com sucesso: {filtro}")

            # ── Enviar e-mail de confirmação de renovação ──
            # Apenas para renovações reais (não o primeiro pagamento, que já tem o
            # checkout.session.completed).
            if customer_email and billing_reason not in ("subscription_create", ""):
                enviado = enviar_email_confirmacao_assinatura(
                    email_usuario=customer_email,
                    nome_usuario=nome_usuario,
                    plano=plano_atual,
                    subscription_id=subscription_id or "",
                    session_id=invoice.get("id", ""),
                    is_renovacao=True,
                )
                if enviado:
                    print(f"✉ E-mail de renovação enviado para {customer_email}")
                else:
                    print(f"⚠ Falha ao enviar e-mail de renovação para {customer_email}")

    # --------------------------------------------------------------------------
    # 3.5. Evento: Falha no pagamento da mensalidade (inadimplência)
    # --------------------------------------------------------------------------
    elif event_type == "invoice.payment_failed":
        invoice = data_object
        subscription_id = invoice.get("subscription")
        customer_email = invoice.get("customer_email")

        filtro = {}
        if subscription_id:
            filtro = {"stripe_subscription_id": subscription_id}
        elif customer_email:
            filtro = {"email": customer_email}

        if filtro:
            usuario.update_one(
                filtro,
                {"$set": {
                    "status_assinatura": "inadimplente",
                    "motivo_bloqueio": "pagamento_recusado",
                    "atualizado_em": datetime.now()
                }}
            )
            print(f"⚠ Pagamento falhou! Acesso suspenso (inadimplente): {filtro}")

    # --------------------------------------------------------------------------
    # 3.6. Evento: Assinatura cancelada pelo usuário ou por falhas consecutivas
    # --------------------------------------------------------------------------
    elif event_type == "customer.subscription.deleted":
        subscription = data_object
        subscription_id = subscription.get("id")

        if subscription_id:
            usuario.update_one(
                {"stripe_subscription_id": subscription_id},
                {"$set": {
                    "status_assinatura": "cancelada",
                    "motivo_bloqueio": "assinatura_cancelada",
                    "atualizado_em": datetime.now()
                }}
            )
            print(f"✖ Assinatura cancelada no Stripe: {subscription_id}")

    # --------------------------------------------------------------------------
    # 3.7. Resposta padrão ao Stripe
    # --------------------------------------------------------------------------
    return jsonify({"recebido": True}), 200