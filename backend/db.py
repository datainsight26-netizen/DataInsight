from pymongo import MongoClient
import certifi
from dotenv import load_dotenv
import os
from datetime import datetime
load_dotenv()

import dns.resolver

# Configura dnspython para utilizar DNS público (8.8.8.8, 1.1.1.1) caso o roteador local bloqueie/atrase consultas SRV
try:
    res_dns = dns.resolver.Resolver()
    res_dns.nameservers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
    dns.resolver.default_resolver = res_dns
except Exception as e_dns:
    print(f"[AVISO DNS]: Não foi possível definir resolver customizado: {e_dns}")

# Tenta pegar MONGO_URI (Docker) ou URI (Local/.env)
uri = os.getenv('MONGO_URI') or os.getenv('URI')

try:
    if uri and 'mongodb+srv' in uri:
        cliente = MongoClient(
            uri,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxIdleTimeMS=25000,
            minPoolSize=0,
            socketTimeoutMS=20000,
            retryReads=True,
            retryWrites=True
        )
    elif uri:
        cliente = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxIdleTimeMS=25000,
            minPoolSize=0,
            socketTimeoutMS=20000,
            retryReads=True,
            retryWrites=True
        )
    else:
        cliente = MongoClient("mongodb://127.0.0.1:27017/", serverSelectionTimeoutMS=3000, connectTimeoutMS=3000)
except Exception as err:
    print(f"[AVISO MONGODB]: Não foi possível conectar ao banco ({err}). Usando modo resiliente...")
    try:
        cliente = MongoClient("mongodb://127.0.0.1:27017/", serverSelectionTimeoutMS=1000, connect=False)
    except Exception:
        cliente = MongoClient(connect=False)

db = cliente["cadastro"]
usuario = db["usuarios"]
dados_colecao = db["dados"]
chat_historico = db["chat_historico"]
galeria = db["galeria"]
produtos_historico = db["produtos_historico"]
analises_salvas_colecao = db["analises_salvas"]
relatorios_colecao = db["relatorios"]

def criar_index():
    try:
        usuario.create_index("email", unique=True)
        dados_colecao.create_index("criado_em")
        chat_historico.create_index("usuario_id")
        galeria.create_index("usuario_id")
        produtos_historico.create_index("usuario_id")
        produtos_historico.create_index("nome_produto")
        produtos_historico.create_index([("nome_produto", "text")])
        analises_salvas_colecao.create_index([("usuario_id", 1), ("criado_em", -1)])
        relatorios_colecao.create_index([("usuario_id", 1), ("criado_em", -1)])
    except Exception as err:
        print(f"[AVISO MONGODB]: Não foi possível criar índices no banco ({err})")

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
        "total_linhas": len(dados) if dados else 0,
        "criado_em": datetime.now(),
        "atualizado_em": datetime.now()
    }
    
    resultado = dados_colecao.insert_one(documento)
    return resultado.inserted_id

if __name__ == "__main__":
    criar_index()
    print("Índice criado com sucesso!")
