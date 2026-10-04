# ==============================================================================
# cancelar_assinatura.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
import traceback
from datetime import datetime

import stripe
from bson import ObjectId
from flask import jsonify, session

from backend.db import usuario


# ==============================================================================
# 2. ENDPOINT: CANCELAMENTO DE ASSINATURA
# ==============================================================================

def cancelar_assinatura_stripe():
    """
    Cancela a assinatura do usuário na API do Stripe (caso possua stripe_subscription_id)
    e atualiza o status no MongoDB para 'cancelada'.
    """
    try:
        # ----------------------------------------------------------------------
        # 2.1 Identificação do usuário (sessão → Mongo)
        # ----------------------------------------------------------------------
        usuario_id = session.get("usuario_id")
        usuario_email = session.get("usuario_email")

        if not usuario_id and not usuario_email:
            return jsonify({"erro": "Usuário não autenticado"}), 401

        user_doc = None
        if usuario_id:
            try:
                user_doc = usuario.find_one({"_id": ObjectId(usuario_id)})
            except Exception:
                pass

        if not user_doc and usuario_email:
            user_doc = usuario.find_one({"email": usuario_email.lower()})

        if not user_doc:
            return jsonify({"erro": "Usuário não encontrado"}), 404

        # ----------------------------------------------------------------------
        # 2.2 Cancelamento no Stripe (se houver assinatura vinculada)
        # ----------------------------------------------------------------------
        subscription_id = user_doc.get("stripe_subscription_id")
        stripe_cancelado = False

        if subscription_id:
            STRIPE_SECRET_KEY = os.getenv("STRIPE_API_KEY")
            if STRIPE_SECRET_KEY:
                try:
                    stripe.api_key = STRIPE_SECRET_KEY

                    # Cancela a assinatura no Stripe via API
                    # Compatibilidade SDK antigo (cancel) / novo (delete)
                    try:
                        stripe.Subscription.cancel(subscription_id)
                    except AttributeError:
                        stripe.Subscription.delete(subscription_id)

                    stripe_cancelado = True
                    print(
                        f"✓ Assinatura Stripe {subscription_id} cancelada com sucesso."
                    )
                except stripe.error.StripeError as err_stripe:
                    print(
                        f"⚠ Aviso ao cancelar no Stripe API ({subscription_id}): "
                        f"{err_stripe}"
                    )
            else:
                print(
                    "⚠ STRIPE_API_KEY ausente no ambiente. "
                    "Atualizando apenas status local no banco."
                )

        # ----------------------------------------------------------------------
        # 2.3 Atualização do status no MongoDB
        # ----------------------------------------------------------------------
        usuario.update_one(
            {"_id": user_doc["_id"]},
            {
                "$set": {
                    "status_assinatura": "cancelada",
                    "motivo_bloqueio": "assinatura_cancelada",
                    "atualizado_em": datetime.now(),
                }
            },
        )

        # ----------------------------------------------------------------------
        # 2.4 Atualização da sessão Flask
        # ----------------------------------------------------------------------
        session["status_assinatura"] = "cancelada"
        session.modified = True

        # ----------------------------------------------------------------------
        # 2.5 Resposta
        # ----------------------------------------------------------------------
        return jsonify({
            "sucesso": True,
            "mensagem": "Sua assinatura foi cancelada com sucesso.",
            "stripe_cancelado": stripe_cancelado,
        }), 200

    except Exception as e:
        print(f"Erro ao cancelar assinatura: {e}")
        traceback.print_exc()
        return jsonify({
            "erro": f"Falha ao cancelar assinatura: {str(e)}"
        }), 500