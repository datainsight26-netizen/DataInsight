import unittest
from unittest.mock import patch, MagicMock
import io
import os
from app import app

class TestUpl09Concorrencia(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
        self.client = app.test_client()
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    @patch("backend.dados.salvar_dados.extrair_e_salvar_produtos")
    @patch("app.usuario")
    @patch("backend.dados.upload_arquivo.salvar_dados")
    def test_uploads_concorrentes_mesmo_nome_sem_colisao_e_limpeza(self, mock_salvar, mock_usuario_app, mock_extrair):
        mock_extrair.return_value = None
        # Mock de usuário logado para passar no @login_required
        mock_usuario_app.find_one.return_value = {
            "_id": "fake_id_123",
            "email": "user@teste.com",
            "status_assinatura": "ativa"
        }

        # Captura os dados salvos para cada chamada
        salvamentos = []
        def fake_salvar(usuario_id, nome_planilha, colunas, dados, *args, **kwargs):
            salvamentos.append({
                "usuario_id": usuario_id,
                "nome_planilha": nome_planilha,
                "colunas": colunas,
                "dados": dados
            })
        mock_salvar.side_effect = fake_salvar

        # Arquivo 1: Usuário A com conteúdo de vendas de janeiro
        conteudo_user_a = "data,produto,valor\n2026-01-10,Produto A,150.0\n"
        file_a = (io.BytesIO(conteudo_user_a.encode('utf-8')), "vendas.csv")

        # Arquivo 2: Usuário B com conteúdo de vendas de fevereiro
        conteudo_user_b = "data,produto,valor\n2026-02-15,Produto B,320.0\n"
        file_b = (io.BytesIO(conteudo_user_b.encode('utf-8')), "vendas.csv")

        # 1. Enviar arquivo A como usuário A
        with self.client.session_transaction() as sess:
            sess["usuario_id"] = "user_A_123"
            sess["usuario_email"] = "user_a@teste.com"

        res_a = self.client.post("/upload", data={"file": file_a}, content_type="multipart/form-data")
        self.assertEqual(res_a.status_code, 200)

        # 2. Enviar arquivo B com o MESMO NOME ("vendas.csv") como usuário B
        with self.client.session_transaction() as sess:
            sess["usuario_id"] = "user_B_456"
            sess["usuario_email"] = "user_b@teste.com"

        res_b = self.client.post("/upload", data={"file": file_b}, content_type="multipart/form-data")
        self.assertEqual(res_b.status_code, 200)

        # 3. Confirmar que ambos foram salvos com integridade
        self.assertEqual(len(salvamentos), 2, "Ambos os arquivos devem ter sido salvos")

        # Usuário A recebeu seus próprios dados
        self.assertEqual(salvamentos[0]["usuario_id"], "user_A_123")
        self.assertEqual(salvamentos[0]["nome_planilha"], "vendas.csv")
        self.assertEqual(salvamentos[0]["dados"][0]["produto"], "Produto A")

        # Usuário B recebeu seus próprios dados sem colisão
        self.assertEqual(salvamentos[1]["usuario_id"], "user_B_456")
        self.assertEqual(salvamentos[1]["nome_planilha"], "vendas.csv")
        self.assertEqual(salvamentos[1]["dados"][0]["produto"], "Produto B")

        # 4. Confirmar que NENHUM arquivo temporário com UUID ou vendas.csv ficou órfão no diretório de uploads
        arquivos_em_disco = os.listdir(app.config['UPLOAD_FOLDER'])
        arquivos_orfaos = [f for f in arquivos_em_disco if "vendas.csv" in f]
        self.assertEqual(len(arquivos_orfaos), 0, f"Arquivos temporários devem ser limpos no finally: {arquivos_orfaos}")

if __name__ == "__main__":
    unittest.main()
