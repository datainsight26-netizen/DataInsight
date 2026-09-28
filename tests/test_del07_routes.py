import unittest
from unittest.mock import patch, MagicMock
from app import app

class TestDel07Rotas(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        self.client = app.test_client()

    @patch("app.usuario")
    @patch("backend.dados.apagar_dados.expurgar_dados_usuario")
    def test_rota_apagar_dados_chama_expurgo(self, mock_expurgo, mock_usuario_app):
        mock_usuario_app.find_one.return_value = {
            "_id": "507f1f77bcf86cd799439011",
            "email": "user@teste.com",
            "status_assinatura": "ativa"
        }
        mock_expurgo.return_value = {
            "sucesso": True,
            "detalhes": {"dados": 3, "chat_historico": 1, "relatorios": 0, "galeria": 0, "produtos_historico": 0, "analises_salvas": 0},
            "total_removidos": 4
        }

        with self.client.session_transaction() as sess:
            sess["usuario_id"] = "507f1f77bcf86cd799439011"
            sess["usuario_email"] = "user@teste.com"

        res = self.client.delete("/apagar-dados")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["documentos_deletados"], 4)
        mock_expurgo.assert_called_once_with("507f1f77bcf86cd799439011")

if __name__ == "__main__":
    unittest.main()
