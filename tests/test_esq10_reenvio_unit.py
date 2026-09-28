import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from app import app

class TestEsq10ReenvioCodigoUnit(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()
        self.email_teste = "teste_esq10_unit@datainsight.com"

    @patch("backend.user.usuario")
    @patch("backend.user.enviar_email_codigo")
    def test_reenvio_gera_novo_codigo_e_invalida_anterior(self, mock_enviar, mock_usuario):
        mock_enviar.return_value = True

        codigo_antigo = "111111"
        expiracao_antiga = datetime.now() - timedelta(minutes=2)

        # Mock de usuário já existente no banco com código antigo
        db_user = {
            "_id": "fake_user_id_123",
            "email": self.email_teste,
            "codigo_recuperacao": codigo_antigo,
            "codigo_expiracao": expiracao_antiga
        }
        mock_usuario.find_one.return_value = db_user

        # Capturar o que é salvo no update_one
        saved_updates = {}
        def fake_update_one(query, update):
            saved_updates.update(update.get("$set", {}))
            return MagicMock(modified_count=1)
        mock_usuario.update_one.side_effect = fake_update_one

        with self.client.session_transaction() as sess:
            sess["email_recuperacao"] = self.email_teste

        # 1. Executar reenviar_codigo
        res = self.client.get("/reenviar-codigo")
        self.assertEqual(res.status_code, 200)

        # 2. Verificar que novo código foi gerado e é diferente do antigo
        novo_codigo = saved_updates.get("codigo_recuperacao")
        nova_expiracao = saved_updates.get("codigo_expiracao")

        self.assertIsNotNone(novo_codigo, "Novo código deve ter sido gerado")
        self.assertNotEqual(novo_codigo, codigo_antigo, "Novo código deve ser diferente do código anterior")
        self.assertEqual(len(novo_codigo), 6, "Novo código deve possuir 6 dígitos")
        self.assertTrue(novo_codigo.isdigit(), "Novo código deve ser numérico")

        # 3. Verificar que a nova expiração é de aproximadamente 10 minutos à frente
        agora = datetime.now()
        self.assertGreater(nova_expiracao, agora + timedelta(minutes=8))
        self.assertLessEqual(nova_expiracao, agora + timedelta(minutes=11))

        # 4. Verificar que enviar_email_codigo recebeu o NOVO código e não o antigo
        mock_enviar.assert_called_once_with(self.email_teste, novo_codigo)

if __name__ == "__main__":
    unittest.main()
