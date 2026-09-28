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
analises_salvas_colecao = db["analises_salvas"]
relatorios_colecao = db["relatorios"]

def criar_index():
    usuario.create_index("email", unique=True)
    dados_colecao.create_index("criado_em")
    chat_historico.create_index("usuario_id")
    galeria.create_index("usuario_id")
    produtos_historico.create_index("usuario_id")
    produtos_historico.create_index("nome_produto")
    produtos_historico.create_index([("nome_produto", "text")])
    analises_salvas_colecao.create_index([("usuario_id", 1), ("criado_em", -1)])
    relatorios_colecao.create_index([("usuario_id", 1), ("criado_em", -1)])

def salvar_dados(usuario_id, nome_planilha, colunas, dados, tipo_dominio=None):

    if not tipo_dominio:
        try:
            from backend.dados.agregador import detectar_dominio_tabela
            tipo_dominio = detectar_dominio_tabela(
                nome_planilha,
                colunas,
                dados
            )
        except Exception:
            tipo_dominio = "MISTA_GERAL"

    agora = datetime.now()

    filtro = {
        "usuario_id": usuario_id,
        "nome_planilha": nome_planilha
    }

    print("\n========== DEBUG SALVAR DADOS ==========")
    print("usuario_id:", repr(usuario_id))
    print("tipo usuario_id:", type(usuario_id))
    print("nome_planilha:", repr(nome_planilha))

    existentes_antes = dados_colecao.count_documents(filtro)
    print("Documentos com esse filtro ANTES:", existentes_antes)

    atualizacao = {
        "$set": {
            "colunas": colunas,
            "dados": dados,
            "tipo_dominio": tipo_dominio,
            "atualizado_em": agora
        },
        "$setOnInsert": {
            "usuario_id": usuario_id,
            "nome_planilha": nome_planilha,
            "criado_em": agora
        }
    }

    resultado = dados_colecao.update_one(
        filtro,
        atualizacao,
        upsert=True
    )

    print("matched_count:", resultado.matched_count)
    print("modified_count:", resultado.modified_count)
    print("upserted_id:", resultado.upserted_id)

    existentes_depois = dados_colecao.count_documents(filtro)
    print("Documentos com esse filtro DEPOIS:", existentes_depois)
    print("========================================\n")

    if resultado.upserted_id:
        return resultado.upserted_id

    documento_existente = dados_colecao.find_one(
        filtro,
        {"_id": 1}
    )

    return documento_existente["_id"] if documento_existente else None


if __name__ == "__main__":
    criar_index()
    print("Índice criado com sucesso!")