import unittest
from unittest.mock import patch, MagicMock
from bson.objectid import ObjectId
from backend.dados.apagar_dados import expurgar_dados_usuario

class TestDel07ExpurgoCascata(unittest.TestCase):
    """
    Testes automatizados para comprovar a eliminação completa e em cascata
    de dados órfãos vinculados ao usuario_id nas 6 coleções analíticas e transacionais,
    garantindo que outros usuários e a conta principal não sejam afetados.
    """

    @patch("backend.dados.apagar_dados.analises_salvas_colecao")
    @patch("backend.dados.apagar_dados.produtos_historico")
    @patch("backend.dados.apagar_dados.galeria")
    @patch("backend.dados.apagar_dados.relatorios_colecao")
    @patch("backend.dados.apagar_dados.chat_historico")
    @patch("backend.dados.apagar_dados.dados_colecao")
    def test_expurgo_cascata_todas_colecoes_e_isolamento(
        self,
        mock_dados,
        mock_chat,
        mock_rel,
        mock_gal,
        mock_prod,
        mock_analises
    ):
        # Configuração de retorno dos mocks
        mock_dados.delete_many.return_value = MagicMock(deleted_count=5)
        mock_chat.delete_many.return_value = MagicMock(deleted_count=12)
        mock_rel.delete_many.return_value = MagicMock(deleted_count=2)
        mock_gal.delete_many.return_value = MagicMock(deleted_count=4)
        mock_prod.delete_many.return_value = MagicMock(deleted_count=8)
        mock_analises.delete_many.return_value = MagicMock(deleted_count=3)

        user_id_teste = "507f1f77bcf86cd799439011"
        self.assertTrue(ObjectId.is_valid(user_id_teste), "ID deve ser válido conforme ObjectId.is_valid()")

        # Executar expurgo
        resultado = expurgar_dados_usuario(user_id_teste)

        # 1. Confirmar sucesso e contagem correta
        self.assertTrue(resultado["sucesso"])
        self.assertEqual(resultado["total_removidos"], 5 + 12 + 2 + 4 + 8 + 3)
        self.assertEqual(resultado["detalhes"]["dados"], 5)
        self.assertEqual(resultado["detalhes"]["chat_historico"], 12)
        self.assertEqual(resultado["detalhes"]["relatorios"], 2)
        self.assertEqual(resultado["detalhes"]["galeria"], 4)
        self.assertEqual(resultado["detalhes"]["produtos_historico"], 8)
        self.assertEqual(resultado["detalhes"]["analises_salvas"], 3)

        # 2. Confirmar que a query de filtro abrange string e ObjectId
        esperado_filtro = {
            "usuario_id": {
                "$in": [user_id_teste, ObjectId(user_id_teste)]
            }
        }
        mock_dados.delete_many.assert_called_once_with(esperado_filtro)
        mock_chat.delete_many.assert_called_once_with(esperado_filtro)
        mock_rel.delete_many.assert_called_once_with(esperado_filtro)
        mock_gal.delete_many.assert_called_once_with(esperado_filtro)
        mock_prod.delete_many.assert_called_once_with(esperado_filtro)
        mock_analises.delete_many.assert_called_once_with(esperado_filtro)

    def test_expurgo_com_id_invalido_ou_vazio(self):
        res_vazio = expurgar_dados_usuario(None)
        self.assertFalse(res_vazio["sucesso"])
        self.assertIn("não fornecido", res_vazio["mensagem"])

if __name__ == "__main__":
    unittest.main()
