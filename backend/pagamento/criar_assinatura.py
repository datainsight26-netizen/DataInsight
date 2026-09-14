from flask import request, jsonify, session, url_for
import os
import stripe
import traceback
from datetime import datetime

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
        preco = float(dados.get("preco", 350.00))
        unit_amount = int(preco * 100)
        
        plano = str(dados.get("plano", "")).strip().upper()
        if not plano:
            plano = "MEI" if "MEI" in titulo.upper() else "ME"

        email_cliente = str(dados.get("email", session.get("usuario_email", ""))).strip()
        usuario_id = session.get("usuario_id", "")

        # Salva imediatamente na sessão o plano escolhido
        session['plano_escolhido'] = plano
        session['usuario_perfil'] = plano
        session.modified = True

        # Se o usuário já está logado, atualiza também seu tipo_perfil no MongoDB
        if usuario_id:
            try:
                from bson import ObjectId
                from backend.db import usuario
                usuario.update_one(
                    {'_id': ObjectId(usuario_id)},
                    {'$set': {'tipo_perfil': plano, 'atualizado_em': datetime.now()}}
                )
                print(f"[criar_assinatura_stripe] tipo_perfil atualizado para {plano} no BD (user {usuario_id})")
            except Exception as ex_db:
                print(f"[criar_assinatura_stripe] Aviso ao salvar perfil no BD: {ex_db}")

        # Configuração das URLs direcionando para as páginas de sucesso e falha com o plano explícito
        success_url = request.host_url.rstrip('/') + url_for('sucesso_pagamento') + f"?session_id={{CHECKOUT_SESSION_ID}}&plano={plano}"
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
                                'description': f'Plano {plano} recorrente DataInsight BI & IA'
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
                metadata={
                    'plano': plano,
                    'usuario_id': usuario_id,
                    'email': email_cliente,
                    'titulo': titulo
                },
                subscription_data={
                    'metadata': {
                        'plano': plano,
                        'usuario_id': usuario_id,
                        'email': email_cliente
                    }
                },
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