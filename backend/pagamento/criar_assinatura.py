from flask import request, jsonify, session, url_for
import os
import stripe
import traceback

def _debug_print(label, obj):
    try:
        print(f"== DEBUG {label} ==")
        print(obj)
        print(f"== END {label} ==")
    except Exception as e:
        print(f"Failed to debug print {label}: {e}")

def criar_assinatura_stripe():
    """Gera uma sessão do Stripe Checkout para Assinatura Recorrente enviando parâmetros de status de retorno."""
    try:
        dados = request.get_json() or {}

        # 1. Carregar a chave privada do Stripe
        STRIPE_SECRET_KEY = os.getenv('STRIPE_API_KEY')
        if not STRIPE_SECRET_KEY:
            print("STRIPE_SECRET_KEY missing in environment")
            return jsonify({"erro": "Chave Stripe ausente"}), 500

        stripe.api_key = STRIPE_SECRET_KEY

        titulo = str(dados.get("titulo", "Assinatura DataInsight ME"))
        preco = float(dados.get("preco", 250.00))
        unit_amount = int(preco * 100)
        
        email_cliente = str(dados.get("email", session.get("usuario_email", "")))

        # Configuração das URLs direcionando para as páginas de sucesso e falha
        success_url = request.host_url.rstrip('/') + url_for('sucesso_pagamento') + "?session_id={CHECKOUT_SESSION_ID}"
        cancel_url = request.host_url.rstrip('/') + url_for('falha_pagamento')

        # 2. Criar a Checkout Session
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                customer_email=email_cliente if email_cliente else None,
                line_items=[
                    {
                        'price_data': {
                            'currency': 'brl',
                            'product_data': {
                                'name': titulo,
                            },
                            'unit_amount': unit_amount,
                            'recurring': {
                                'interval': 'month',
                            },
                        },
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                success_url=success_url,
                cancel_url=cancel_url,
            )

            _debug_print("stripe_checkout_session", checkout_session)

            return jsonify({
                "init_point": checkout_session.url,
                "id_assinatura": checkout_session.id
            })

        except stripe.error.StripeError as err_stripe:
            print(f"Erro Stripe API: {err_stripe}")
            return jsonify({
                "erro": "Falha ao gerar o link de pagamento",
                "detalhes": err_stripe.user_message or str(err_stripe)
            }), 400

    except Exception as e:
        print(f"Erro interno no pagamento: {e}")
        traceback.print_exc()
        return jsonify({"erro": str(e)}), 500


def verificar_token_stripe():
    """Verifica a chave do Stripe buscando as informações da conta para diagnóstico."""
    STRIPE_SECRET_KEY = os.getenv('STRIPE_API_KEY')
    if not STRIPE_SECRET_KEY:
        return jsonify({"erro": "Chave Stripe ausente"}), 500

    try:
        stripe.api_key = STRIPE_SECRET_KEY
        account_info = stripe.Account.retrieve()
        
        _debug_print('verificar_token_stripe_response', account_info)

        return jsonify({
            'status_code': 200,
            'response': {
                'id': account_info.id,
                'email': account_info.email,
                'charges_enabled': account_info.charges_enabled
            }
        }), 200
        
    except stripe.error.AuthenticationError:
        return jsonify({'erro': 'Chave API inválida'}), 401
    except Exception as e:
        print('Erro ao verificar token Stripe:', e)
        return jsonify({'erro': str(e)}), 500