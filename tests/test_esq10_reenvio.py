import unittest
from unittest.mock import patch
from datetime import datetime, timedelta
from app import app
from backend.db import usuario

class TestEsq10ReenvioCodigo(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()
        self.email_teste = "teste_esq10@datainsight.com"
        
        # Cria ou limpa usuário de teste
        try:
            usuario.delete_many({"email": self.email_teste})
            self.user_id = usuario.insert_one({
                "nome": "Usuario Teste ESQ10",
                "email": self.email_teste,
                "senha": b"$2b$12$fakehashedpasswordforrecoverytest123456",
                "codigo_recuperacao": "111111",
                "codigo_expiracao": datetime.now() - timedelta(minutes=1) # Expirado
            }).inserted_id
        except Exception as e:
            self.skipTest(f"MongoDB não acessível no ambiente local: {e}")

    def tearDown(self):
        try:
            usuario.delete_many({"email": self.email_teste})
        except Exception:
            pass

    @patch("backend.user.enviar_email_codigo")
    def test_reenvio_gera_novo_codigo_e_renova_expiracao(self, mock_enviar):
        mock_enviar.return_value = True

        codigo_inicial = "111111"

        # Simular sessão de recuperação ativa
        with self.client.session_transaction() as sess:
            sess["email_recuperacao"] = self.email_teste

        # 1. Solicitar reenvio
        res = self.client.get("/reenviar-codigo")
        self.assertEqual(res.status_code, 200)

        # 2. Verificar banco de dados
        user_atualizado = usuario.find_one({"email": self.email_teste})
        novo_codigo = user_atualizado.get("codigo_recuperacao")
        nova_expiracao = user_atualizado.get("codigo_expiracao")

        # Confirmar que o segundo código é diferente
        self.assertNotEqual(novo_codigo, codigo_inicial, "O novo código deve ser diferente do inicial")
        self.assertEqual(len(novo_codigo), 6, "O código deve ter 6 dígitos")

        # Confirmar que a expiração foi renovada para ~10 minutos no futuro
        agora = datetime.now()
        self.assertGreater(nova_expiracao, agora + timedelta(minutes=8), "A expiração deve ser renovada para cerca de 10 min")
        self.assertLessEqual(nova_expiracao, agora + timedelta(minutes=11))

        # 3. Confirmar que o código antigo NÃO funciona mais
        res_antigo = self.client.post("/verificar-codigo", data={"codigo": codigo_inicial})
        self.assertIn("Código incorreto", res_antigo.get_data(as_text=True))

        # 4. Confirmar que o novo código FUNCIONA
        res_novo = self.client.post("/verificar-codigo", data={"codigo": novo_codigo})
        # Deve redirecionar (status 302) para /redefinir-senha
        self.assertEqual(res_novo.status_code, 302)
        self.assertIn("/redefinir-senha", res_novo.headers.get("Location", ""))

if __name__ == "__main__":
    unittest.main()
