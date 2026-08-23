from pymongo import MongoClient
import certifi
from dotenv import load_dotenv
import os
from datetime import datetime
load_dotenv()

# Tenta pegar MONGO_URI (Docker) ou URI (Local/.env)
uri = os.getenv('MONGO_URI') or os.getenv('URI')

# Só usa certifi se for uma conexão Atlas (contém '+srv')
if uri and 'mongodb+srv' in uri:
    cliente = MongoClient(uri, tlsCAFile=certifi.where())
else:
    cliente = MongoClient(uri)

db = cliente["cadastro"]
usuario = db["usuarios"]
dados_colecao = db["dados"]
chat_historico = db["chat_historico"]
galeria = db["galeria"]
produtos_historico = db["produtos_historico"]

def criar_index():
    usuario.create_index("email", unique=True)
    dados_colecao.create_index("criado_em")
    chat_historico.create_index("usuario_id")
    galeria.create_index("usuario_id")
    produtos_historico.create_index("usuario_id")
    produtos_historico.create_index("nome_produto")
    produtos_historico.create_index([("nome_produto", "text")])

def salvar_dados(usuario_id, nome_planilha, colunas, dados, tipo_dominio=None):
    """Salva os dados no banco de dados com categoria de domínio"""
    if not tipo_dominio:
        try:
            from backend.dados.agregador import detectar_dominio_tabela
            tipo_dominio = detectar_dominio_tabela(nome_planilha, colunas, dados)
        except Exception:
            tipo_dominio = "MISTA_GERAL"
            
    documento = {
        "usuario_id": usuario_id,
        "nome_planilha": nome_planilha,
        "colunas": colunas,
        "dados": dados,
        "tipo_dominio": tipo_dominio,
        "criado_em": datetime.now(),
        "atualizado_em": datetime.now()
    }
    
    resultado = dados_colecao.insert_one(documento)
    return resultado.inserted_id

if __name__ == "__main__":
    criar_index()
    print("Índice criado com sucesso!")