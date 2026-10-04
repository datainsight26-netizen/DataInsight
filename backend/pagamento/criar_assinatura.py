# ==============================================================================
# criar_assinatura.py
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
from flask import jsonify, request, session, url_for

from backend.db import usuario


# ==============================================================================
# 2. AUXILIARES DE DEBUG
# ==============================================================================

def _debug_print(label, obj):
    try:
        print(f"== DEBUG {label} ==")
        print(obj)
        print(f"== END {label} ==")
    except Exception as e:
        print(f"Failed to debug print {label}: {e}")


# ==============================================================================
# 3. ENDPOINT: CRIAR ASSINATURA (STRIPE CHECKOUT)
# ==============================================================================

def criar_assinatura_stripe():
    """Gera uma sessão do Stripe Checkout para Assinatura Recorrente enviando parâmetros de status de retorno."""
    try:
        dados = request.get_json() or {}

        # ----------------------------------------------------------------------
        # 3.1 Carregar a chave privada do Stripe
        # ----------------------------------------------------------------------
        STRIPE_SECRET_KEY = os.getenv("STRIPE_API_KEY")
        if not STRIPE_SECRET_KEY:
            print("STRIPE_SECRET_KEY missing in environment")
            return jsonify({"erro": "Chave Stripe ausente"}), 500

        stripe.api_key = STRIPE_SECRET_KEY

        # ----------------------------------------------------------------------
        # 3.2 Normalização de título, preço e plano
        # ----------------------------------------------------------------------
        titulo = str(dados.get("titulo") or "Assinatura DataInsight ME")

        # Converte o preço com suporte a string/float
        raw_preco = dados.get("preco", 350.00)
        try:
            if isinstance(raw_preco, str):
                raw_preco = (
                    raw_preco.replace("R$", "").replace(" ", "").replace(",", ".")
                )
            preco = float(raw_preco)
        except (ValueError, TypeError):
            preco = 350.00

        unit_amount = max(int(round(preco * 100)), 50)

        plano = str(dados.get("plano") or "").strip().upper()
        if not plano:
            plano = "MEI" if "MEI" in titulo.upper() else "ME"

        # ----------------------------------------------------------------------
        # 3.3 E-mail do cliente e usuário
        # ----------------------------------------------------------------------
        raw_email = dados.get("email") or session.get("usuario_email") or ""
        raw_email = str(raw_email).strip()
        if "@" in raw_email and raw_email.lower() not in ("none", "null", "undefined"):
            email_cliente = raw_email
        else:
            email_cliente = None

        usuario_id = str(session.get("usuario_id") or "")

        # ----------------------------------------------------------------------
        # 3.4 Persistência do plano escolhido
        # ----------------------------------------------------------------------
        session["plano_escolhido"] = plano
        session["usuario_perfil"] = plano
        session.modified = True

        # Se o usuário já está logado, atualiza também seu tipo_perfil no MongoDB
        if usuario_id:
            try:
                usuario.update_one(
                    {"_id": ObjectId(usuario_id)},
                    {
                        "$set": {
                            "tipo_perfil": plano,
                            "atualizado_em": datetime.now(),
                        }
                    },
                )
                print(
                    f"[criar_assinatura_stripe] tipo_perfil atualizado para "
                    f"{plano} no BD (user {usuario_id})"
                )
            except Exception as ex_db:
                print(f"[criar_assinatura_stripe] Aviso ao salvar perfil no BD: {ex_db}")

        # ----------------------------------------------------------------------
        # 3.5 URLs de retorno
        # ----------------------------------------------------------------------
        success_url = (
            request.host_url.rstrip("/")
            + url_for("sucesso_pagamento")
            + f"?session_id={{CHECKOUT_SESSION_ID}}&plano={plano}"
        )
        cancel_url = request.host_url.rstrip("/") + url_for("falha_pagamento")

        # Metadados seguros (sempre strings)
        meta_dict = {
            "plano": str(plano),
            "usuario_id": str(usuario_id),
            "email": str(email_cliente or ""),
            "titulo": str(titulo),
        }

        # ----------------------------------------------------------------------
        # 3.6 Criação da Checkout Session
        # ----------------------------------------------------------------------
        try:
            session_kwargs = {
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "price_data": {
                            "currency": "brl",
                            "product_data": {
                                "name": titulo,
                                "description": (
                                    f"Plano {plano} recorrente "
                                    "DataInsight BI & IA"
                                ),
                            },
                            "unit_amount": unit_amount,
                            "recurring": {
                                "interval": "month",
                            },
                        },
                        "quantity": 1,
                    },
                ],
                "mode": "subscription",
                "metadata": meta_dict,
                "subscription_data": {
                    "metadata": {
                        "plano": str(plano),
                        "usuario_id": str(usuario_id),
                        "email": str(email_cliente or ""),
                    }
                },
                "success_url": success_url,
                "cancel_url": cancel_url,
            }

            if email_cliente:
                session_kwargs["customer_email"] = email_cliente

            checkout_session = stripe.checkout.Session.create(**session_kwargs)

            _debug_print("stripe_checkout_session", checkout_session)

            return jsonify({
                "init_point": checkout_session.url,
                "id_assinatura": checkout_session.id,
            })

        except stripe.error.StripeError as err_stripe:
            print(f"Erro Stripe API: {err_stripe}")
            return jsonify({
                "erro": "Falha ao gerar o link de pagamento",
                "detalhes": err_stripe.user_message or str(err_stripe),
            }), 400

    except Exception as e:
        print(f"Erro interno no pagamento: {e}")
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500


# ==============================================================================
# 4. ENDPOINT: VERIFICAR TOKEN STRIPE
# ==============================================================================

def verificar_token_stripe():
    """Verifica a chave do Stripe buscando as informações da conta para diagnóstico."""
    STRIPE_SECRET_KEY = os.getenv("STRIPE_API_KEY")
    if not STRIPE_SECRET_KEY:
        return jsonify({"erro": "Chave Stripe ausente"}), 500

    try:
        stripe.api_key = STRIPE_SECRET_KEY
        account_info = stripe.Account.retrieve()

        _debug_print("verificar_token_stripe_response", account_info)

        return jsonify({
            "status_code": 200,
            "response": {
                "id": account_info.id,
                "email": account_info.email,
                "charges_enabled": account_info.charges_enabled,
            },
        }), 200

    except stripe.error.AuthenticationError:
        return jsonify({"erro": "Chave API inválida"}), 401
    except Exception as e:
        print("Erro ao verificar token Stripe:", e)
        return jsonify({"erro": str(e)}), 500