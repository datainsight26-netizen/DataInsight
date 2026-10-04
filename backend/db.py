# ==============================================================================
# db.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
from datetime import datetime

import certifi
import dns.resolver
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


# ==============================================================================
# 2. CONFIGURAÇÃO DE AMBIENTE
# ==============================================================================

load_dotenv()


# ==============================================================================
# 3. CONFIGURAÇÃO DE DNS
# ==============================================================================
# Configura dnspython para utilizar DNS público (8.8.8.8, 1.1.1.1) caso o
# roteador local bloqueie ou atrase consultas SRV.
# ==============================================================================

try:
    res_dns = dns.resolver.Resolver()
    res_dns.nameservers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']
    dns.resolver.default_resolver = res_dns
except Exception as e_dns:
    print(f"[AVISO DNS]: Não foi possível definir resolver customizado: {e_dns}")


# ==============================================================================
# 4. CONEXÃO COM MONGODB
# ==============================================================================
# Tenta pegar MONGO_URI (Docker) ou URI (Local/.env). Em caso de falha, cai
# para um cliente resiliente apontando para localhost.
# ==============================================================================

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
            retryWrites=True,
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
            retryWrites=True,
        )
    else:
        cliente = MongoClient(
            "mongodb://127.0.0.1:27017/",
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000,
        )
except Exception as err:
    print(f"[AVISO MONGODB]: Não foi possível conectar ao banco ({err}). Usando modo resiliente...")
    try:
        cliente = MongoClient(
            "mongodb://127.0.0.1:27017/",
            serverSelectionTimeoutMS=1000,
            connect=False,
        )
    except Exception:
        cliente = MongoClient(connect=False)


# ==============================================================================
# 5. COLEÇÕES
# ==============================================================================

db = cliente["cadastro"]
usuario = db["usuarios"]
dados_colecao = db["dados"]
chat_historico = db["chat_historico"]
galeria = db["galeria"]
produtos_historico = db["produtos_historico"]
analises_salvas_colecao = db["analises_salvas"]
relatorios_colecao = db["relatorios"]


# ==============================================================================
# 6. ÍNDICES
# ==============================================================================

def criar_index():
    """Cria os índices necessários nas coleções principais."""
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


# ==============================================================================
# 7. FUNÇÕES UTILITÁRIAS DE DADOS
# ==============================================================================

def salvar_dados(usuario_id, nome_planilha, colunas, dados, tipo_dominio=None):
    """Salva os dados no banco de dados com categoria de domínio."""
    if not tipo_dominio:
        try:
            # Import local para evitar dependência circular com o agregador.
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
        "atualizado_em": datetime.now(),
    }

    resultado = dados_colecao.insert_one(documento)
    return resultado.inserted_id


def filtro_usuario_id(uid):
    """
    Retorna o filtro MongoDB unificado por usuario_id compatível com string
    e ObjectId:
        {"usuario_id": {"$in": [str(uid), ObjectId(uid)]}}
    """
    try:
        u_str = str(uid)
        ids = [u_str]
        if ObjectId.is_valid(u_str):
            obj = ObjectId(u_str)
            if obj not in ids:
                ids.append(obj)
        return {"usuario_id": {"$in": ids}}
    except Exception:
        return {"usuario_id": {"$in": [str(uid)]}}


# ==============================================================================
# 8. INICIALIZAÇÃO (execução direta)
# ==============================================================================

if __name__ == "__main__":
    criar_index()
    print("Índice criado com sucesso!")