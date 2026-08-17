from flask import request, jsonify, session, url_for
import os
import mercadopago

# Credencial Mercado Pago (obtida do arquivo de ambiente .env com fallback)
ACCESS_TOKEN_TESTE = os.getenv('MERCADO_PAGO_API_KEY')
sdk_mp = mercadopago.SDK(ACCESS_TOKEN_TESTE)


def criar_assinatura_mp():
    """Gera o link de pagamento ou assinatura no Mercado Pago"""
    try:
        dados = request.get_json() or {}
        
        titulo = str(dados.get("titulo", "Assinatura DataInsight ME"))
        preco = float(dados.get("preco", 250.00))
        email_cliente = str(dados.get("email", session.get("usuario_email", "[EMAIL_ADDRESS]")))

        is_test_token = ACCESS_TOKEN_TESTE.startswith("TEST-")

        # 1. Tenta Preapproval (Assinatura Recorrente)
        try:
            preapproval_data = {
                "reason": titulo,
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months",
                    "transaction_amount": preco,
                    "currency_id": "BRL"
                },
                "payer_email": email_cliente,
                "back_url": request.host_url.rstrip('/') + url_for('sucesso_pagamento')
            }

            subscription_response = sdk_mp.preapproval().create(preapproval_data)

            if subscription_response.get("status") in [200, 201]:
                subscription = subscription_response.get("response", {})
                init_url = (subscription.get("sandbox_init_point") if is_test_token else subscription.get("init_point")) or subscription.get("init_point")
                if init_url:
                    return jsonify({
                        "init_point": init_url,
                        "id_assinatura": subscription.get("id")
                    })
        except Exception as err_pre:
            print(f"Preapproval fallback: {err_pre}")

        # 2. Fallback: Checkout Preference
        preference_data = {
            "items": [
                {
                    "title": titulo,
                    "quantity": 1,
                    "currency_id": "BRL",
                    "unit_price": preco
                }
            ],
            "back_urls": {
                "success": request.host_url.rstrip('/') + url_for('sucesso_pagamento'),
                "failure": request.host_url.rstrip('/') + url_for('falha_pagamento'),
                "pending": request.host_url.rstrip('/') + url_for('falha_pagamento')
            }
        }

        preference_response = sdk_mp.preference().create(preference_data)

        if preference_response.get("status") in [200, 201]:
            preference = preference_response.get("response", {})
            init_url = (preference.get("sandbox_init_point") if is_test_token else preference.get("init_point")) or preference.get("init_point")
            return jsonify({
                "init_point": init_url,
                "sandbox_init_point": preference.get("sandbox_init_point"),
                "id_assinatura": preference.get("id")
            })

        return jsonify({
            "erro": "Falha ao gerar o link de pagamento",
            "detalhes": preference_response.get("response", {})
        }), 400

    except Exception as e:
        print(f"Erro no pagamento: {e}")
        return jsonify({"erro": str(e)}), 500
