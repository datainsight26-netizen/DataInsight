from flask import Flask, render_template, request, jsonify
import mercadopago

app = Flask(__name__)

# Access Token de TESTE do Mercado Pago
ACCESS_TOKEN_TESTE = "TEST-4626260117671505-081619-869af918105fdea8829299f25c49bf57-3619214273"
sdk = mercadopago.SDK(ACCESS_TOKEN_TESTE)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/criar-preferencia', methods=['POST'])
def criar_preferencia():
    try:
        dados = request.get_json() or {}
        
        titulo = str(dados.get("titulo", "Produto Teste"))
        preco = float(dados.get("preco", 10.00))

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
                "success": "http://127.0.0.1:5000/sucesso",
                "failure": "http://127.0.0.1:5000/falha",
                "pending": "http://127.0.0.1:5000/falha"
            }
            # O parâmetro "auto_return" foi removido para aceitar conexões locais HTTP
        }

        preference_response = sdk.preference().create(preference_data)

        # Trata erros retornados pela API
        if preference_response.get("status") not in [200, 201]:
            print("Erro retornado pela API do Mercado Pago:", preference_response)
            return jsonify({
                "erro": "Falha na comunicação com o Mercado Pago",
                "detalhes": preference_response.get("response", {})
            }), 400

        preference = preference_response["response"]

        return jsonify({
            "init_point": preference.get("init_point"),
            "sandbox_init_point": preference.get("sandbox_init_point")
        })

    except Exception as e:
        print(f"Erro interno no servidor: {e}")
        return jsonify({"erro": str(e)}), 500

@app.route('/sucesso')
def sucesso():
    payment_id = request.args.get('payment_id')
    status = request.args.get('status')
    return render_template('sucesso.html', payment_id=payment_id, status=status)

@app.route('/falha')
def falha():
    return render_template('falha.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)