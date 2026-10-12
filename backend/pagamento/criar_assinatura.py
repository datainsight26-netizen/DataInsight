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
        # 3.2 Normalização de título, plano, periodicidade e método
        # ----------------------------------------------------------------------
        titulo = str(dados.get("titulo") or "Assinatura DataInsight ME")

        plano = str(dados.get("plano") or "").strip().upper()
        if not plano:
            plano = "MEI" if "MEI" in titulo.upper() else "ME"

        periodicidade = str(dados.get("periodicidade") or "mensal").strip().lower()
        if periodicidade not in ("mensal", "anual"):
            periodicidade = "mensal"

        metodo = str(dados.get("metodo") or "card").strip().lower()
        if metodo not in ("card", "pix"):
            metodo = "card"

        # Regra de negócio: PIX é exclusivo do plano anual (à vista com desconto).
        # No plano mensal, o pagamento é feito exclusivamente via Cartão (crédito/débito) para recorrência automática.
        if periodicidade == "mensal":
            metodo = "card"

        # Preços padrão por plano e periodicidade
        precos_padrao = {
            ("MEI", "mensal"): 250.00,
            ("MEI", "anual"): 2400.00,
            ("ME", "mensal"): 350.00,
            ("ME", "anual"): 3360.00,
        }

        # Converte o preço com suporte a string/float ou utiliza padrão
        default_preco = precos_padrao.get((plano, periodicidade), 350.00)
        raw_preco = dados.get("preco", default_preco)
        try:
            if isinstance(raw_preco, str):
                raw_preco = (
                    raw_preco.replace("R$", "").replace(" ", "").replace(",", ".")
                )
            preco = float(raw_preco)
        except (ValueError, TypeError):
            preco = default_preco

        unit_amount = max(int(round(preco * 100)), 50)

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
        # 3.4 Persistência do plano escolhido e configurações na sessão
        # ----------------------------------------------------------------------
        session["plano_escolhido"] = plano
        session["usuario_perfil"] = plano
        session["periodicidade_escolhida"] = periodicidade
        session["metodo_pagamento"] = metodo
        session.modified = True

        # Se o usuário já está logado, atualiza também seu perfil no MongoDB
        if usuario_id:
            try:
                usuario.update_one(
                    {"_id": ObjectId(usuario_id)},
                    {
                        "$set": {
                            "tipo_perfil": plano,
                            "periodicidade_escolhida": periodicidade,
                            "metodo_pagamento": metodo,
                            "atualizado_em": datetime.now(),
                        }
                    },
                )
                print(
                    f"[criar_assinatura_stripe] tipo_perfil={plano}, "
                    f"periodicidade={periodicidade}, metodo={metodo} "
                    f"atualizado no BD (user {usuario_id})"
                )
            except Exception as ex_db:
                print(f"[criar_assinatura_stripe] Aviso ao salvar perfil no BD: {ex_db}")

        # ----------------------------------------------------------------------
        # 3.5 URLs de retorno
        # ----------------------------------------------------------------------
        success_url = (
            request.host_url.rstrip("/")
            + url_for("sucesso_pagamento")
            + f"?session_id={{CHECKOUT_SESSION_ID}}&plano={plano}&periodicidade={periodicidade}&metodo={metodo}"
        )
        cancel_url = request.host_url.rstrip("/") + url_for("falha_pagamento")

        # Metadados seguros (sempre strings)
        meta_dict = {
            "plano": str(plano),
            "periodicidade": str(periodicidade),
            "metodo": str(metodo),
            "usuario_id": str(usuario_id),
            "email": str(email_cliente or ""),
            "titulo": str(titulo),
        }

        # ----------------------------------------------------------------------
        # 3.6 Criação da Checkout Session (Modo Subscription para Cartão ou Payment para Pix)
        # ----------------------------------------------------------------------
        try:
            periodicidade_rotulo = "Anual (12 meses)" if periodicidade == "anual" else "Mensal"
            nome_produto = f"{titulo} - {periodicidade_rotulo}"

            if metodo == "pix":
                # Modo Pagamento Único Direto via Pix no Stripe Checkout
                desc_produto = (
                    f"Plano {plano} ({periodicidade_rotulo}) à vista via Pix "
                    "DataInsight BI & IA"
                )
                session_kwargs = {
                    "payment_method_options": {
                        "pix": {
                            "expires_after_seconds": 3600,  # QR Code válido por 1 hora
                        }
                    },
                    "line_items": [
                        {
                            "price_data": {
                                "currency": "brl",
                                "product_data": {
                                    "name": nome_produto,
                                    "description": desc_produto,
                                },
                                "unit_amount": unit_amount,
                            },
                            "quantity": 1,
                        },
                    ],
                    "mode": "payment",
                    "metadata": meta_dict,
                    "success_url": success_url,
                    "cancel_url": cancel_url,
                }
            else:
                # Modo Assinatura Recorrente no Cartão (Mensal ou Anual)
                intervalo_stripe = "year" if periodicidade == "anual" else "month"
                desc_produto = (
                    f"Plano {plano} recorrente ({periodicidade_rotulo}) "
                    "DataInsight BI & IA"
                )
                session_kwargs = {
                    "line_items": [
                        {
                            "price_data": {
                                "currency": "brl",
                                "product_data": {
                                    "name": nome_produto,
                                    "description": desc_produto,
                                },
                                "unit_amount": unit_amount,
                                "recurring": {
                                    "interval": intervalo_stripe,
                                },
                            },
                            "quantity": 1,
                        },
                    ],
                    "mode": "subscription",
                    "metadata": meta_dict,
                    "subscription_data": {
                        "metadata": meta_dict,
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
                "modo": session_kwargs["mode"],
                "metodo": metodo,
                "periodicidade": periodicidade,
            })

        except stripe.error.StripeError as err_stripe:
            msg_erro = err_stripe.user_message or str(err_stripe)
            print(f"Erro Stripe API: {err_stripe}")
            if metodo == "pix" and "pix" in msg_erro.lower():
                msg_erro = (
                    "O método Pix não está ativado na conta Stripe. "
                    "Ative o Pix nas configurações de Métodos de Pagamento do Stripe "
                    "ou utilize a opção Cartão de Crédito."
                )
            return jsonify({
                "erro": "Falha ao gerar o link de pagamento",
                "detalhes": msg_erro,
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
