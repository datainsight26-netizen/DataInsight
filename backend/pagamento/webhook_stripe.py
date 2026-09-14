from flask import request, jsonify
import os
import stripe
from datetime import datetime
from bson import ObjectId
from backend.db import usuario

def processar_webhook_stripe():
    """
    Processa os webhooks oficiais do Stripe para gerenciar o ciclo de vida
    da assinatura recorrente (ativação, renovação, inadimplência e cancelamento).
    """
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
            data = request.get_json(force=True)
            event = data
    except ValueError as e:
        print(f"✗ Payload inválido no Webhook Stripe: {e}")
        return jsonify({"erro": "Payload inválido"}), 400
    except stripe.error.SignatureVerificationError as e:
        print(f"✗ Assinatura inválida no Webhook Stripe: {e}")
        return jsonify({"erro": "Assinatura inválida"}), 400
    except Exception as e:
        print(f"✗ Erro ao processar evento do Webhook: {e}")
        return jsonify({"erro": str(e)}), 400

    event_type = event.get("type", "")
    data_object = event.get("data", {}).get("object", {})
    print(f"⚡ [Stripe Webhook] Evento recebido: {event_type}")

    # 1. Checkout Inicial Concluído com Sucesso
    if event_type == "checkout.session.completed":
        session = data_object
        customer_email = session.get("customer_details", {}).get("email") or session.get("customer_email")
        customer_id = session.get("customer")
        subscription_id = session.get("subscription")
        metadata = session.get("metadata") or {}
        plano = metadata.get("plano", "ME")
        usuario_id = metadata.get("usuario_id")

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

    # 2. Pagamento de Mensalidade Recorrente Aprovado
    elif event_type == "invoice.payment_succeeded":
        invoice = data_object
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")
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
                    "status_assinatura": "ativa",
                    "atualizado_em": datetime.now()
                }}
            )
            print(f"✓ Mensalidade renovada com sucesso: {filtro}")

    # 3. Falha no Pagamento da Mensalidade (Inadimplência)
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

    # 4. Assinatura Cancelada pelo Usuário ou por Falhas Consecutivas
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

    return jsonify({"recebido": True}), 200
