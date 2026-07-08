"""
Gerenciamento de histórico de produtos com autopreenchimento
"""
from backend.db import produtos_historico
from datetime import datetime
from typing import Optional, List, Dict
from bson.objectid import ObjectId

# =====================================================
#  SALVAR/ATUALIZAR PRODUTOS
# =====================================================

def salvar_produto(usuario_id: str, nome_produto: str, categoria: str = None, 
                   preco: float = None, estoque: int = None, 
                   sku: str = None, descricao: str = None) -> str:
    """
    Salva ou atualiza um produto no histórico.
    Se o produto já existe para o usuário, atualiza; caso contrário, cria novo.
    
    Args:
        usuario_id: ID do usuário
        nome_produto: Nome do produto
        categoria: Categoria do produto
        preco: Preço do produto
        estoque: Quantidade em estoque
        sku: SKU/Código do produto
        descricao: Descrição do produto
    
    Returns:
        ID do documento inserido/atualizado
    """
    
    if not nome_produto or not usuario_id:
        raise ValueError("nome_produto e usuario_id são obrigatórios")
    
    # Monta o documento
    documento = {
        "usuario_id": usuario_id,
        "nome_produto": nome_produto.strip(),
        "categoria": categoria.strip() if categoria else None,
        "preco": float(preco) if preco else None,
        "estoque": int(estoque) if estoque else None,
        "sku": sku.strip() if sku else None,
        "descricao": descricao.strip() if descricao else None,
        "atualizado_em": datetime.now()
    }
    
    # Tenta atualizar se existe, senão insere novo
    resultado = produtos_historico.update_one(
        {
            "usuario_id": usuario_id,
            "nome_produto": nome_produto.strip()
        },
        {
            "$set": documento,
            "$setOnInsert": {"criado_em": datetime.now()}
        },
        upsert=True
    )
    
    if resultado.upserted_id:
        return str(resultado.upserted_id)
    else:
        # Se atualizou, retorna o ID do documento
        doc = produtos_historico.find_one({
            "usuario_id": usuario_id,
            "nome_produto": nome_produto.strip()
        })
        return str(doc["_id"]) if doc else None


# =====================================================
#  BUSCAR PRODUTOS
# =====================================================

def buscar_produtos_por_nome(usuario_id: str, termo: str, limite: int = 10) -> List[Dict]:
    """
    Busca produtos por nome (autocomplete).
    
    Args:
        usuario_id: ID do usuário
        termo: Termo de busca (parcial) - começa a buscar com 1 caractere
        limite: Número máximo de resultados
    
    Returns:
        Lista de produtos encontrados
    """
    
    # Permite busca com 1 caractere
    if not termo or len(termo.strip()) < 1:
        return []
    
    # Busca case-insensitive com regex
    import re
    regex_termo = re.compile(re.escape(termo.strip()), re.IGNORECASE)
    
    try:
        produtos = list(produtos_historico.find(
            {
                "usuario_id": usuario_id,
                "nome_produto": {"$regex": regex_termo}
            },
            {
                "_id": 1,
                "nome_produto": 1,
                "categoria": 1,
                "preco": 1,
                "estoque": 1,
                "sku": 1
            }
        ).limit(limite).sort("nome_produto", 1))
        
        # Converte ObjectId para string
        for p in produtos:
            p["_id"] = str(p["_id"])
        
        return produtos
    except Exception as e:
        print(f"Erro ao buscar produtos: {e}")
        return []


def obter_produto_exato(usuario_id: str, nome_produto: str) -> Optional[Dict]:
    """
    Obtém os dados completos de um produto específico.
    
    Args:
        usuario_id: ID do usuário
        nome_produto: Nome exato do produto
    
    Returns:
        Dicionário com dados do produto ou None
    """
    
    produto = produtos_historico.find_one({
        "usuario_id": usuario_id,
        "nome_produto": nome_produto.strip()
    })
    
    if produto:
        produto["_id"] = str(produto["_id"])
        return produto
    
    return None


# =====================================================
#  LISTAR PRODUTOS
# =====================================================

def listar_produtos(usuario_id: str, limite: int = 50, skip: int = 0) -> List[Dict]:
    """
    Lista todos os produtos cadastrados por um usuário.
    
    Args:
        usuario_id: ID do usuário
        limite: Número máximo de resultados
        skip: Número de registros a pular (para paginação)
    
    Returns:
        Lista de produtos
    """
    
    produtos = list(produtos_historico.find(
        {"usuario_id": usuario_id},
        {
            "_id": 1,
            "nome_produto": 1,
            "categoria": 1,
            "preco": 1,
            "estoque": 1,
            "sku": 1,
            "atualizado_em": 1
        }
    ).sort("atualizado_em", -1).skip(skip).limit(limite))
    
    for p in produtos:
        p["_id"] = str(p["_id"])
    
    return produtos


def contar_produtos(usuario_id: str) -> int:
    """Conta total de produtos de um usuário."""
    return produtos_historico.count_documents({"usuario_id": usuario_id})


# =====================================================
#  CATEGORIAS
# =====================================================

def obter_categorias(usuario_id: str) -> List[str]:
    """
    Obtém lista de categorias únicas cadastradas.
    
    Args:
        usuario_id: ID do usuário
    
    Returns:
        Lista de categorias ordenadas
    """
    
    categorias = produtos_historico.find(
        {"usuario_id": usuario_id, "categoria": {"$ne": None}},
        {"categoria": 1}
    ).distinct("categoria")
    
    return sorted([c for c in categorias if c])


# =====================================================
#  DELETAR
# =====================================================

def deletar_produto(usuario_id: str, produto_id: str) -> bool:
    """
    Deleta um produto do histórico.
    
    Args:
        usuario_id: ID do usuário
        produto_id: ID do produto (MongoDB ObjectId)
    
    Returns:
        True se deletou, False caso contrário
    """
    
    resultado = produtos_historico.delete_one({
        "_id": ObjectId(produto_id),
        "usuario_id": usuario_id
    })
    
    return resultado.deleted_count > 0


# =====================================================
#  ESTATÍSTICAS
# =====================================================

def obter_estatisticas_produtos(usuario_id: str) -> Dict:
    """
    Retorna estatísticas dos produtos do usuário.
    
    Args:
        usuario_id: ID do usuário
    
    Returns:
        Dicionário com estatísticas
    """
    
    produtos = list(produtos_historico.find(
        {"usuario_id": usuario_id},
        {"preco": 1, "estoque": 1}
    ))
    
    if not produtos:
        return {
            "total": 0,
            "preco_medio": 0,
            "preco_max": 0,
            "preco_min": 0,
            "estoque_total": 0
        }
    
    precos = [p["preco"] for p in produtos if p.get("preco")]
    estoques = [p["estoque"] for p in produtos if p.get("estoque") is not None]
    
    return {
        "total": len(produtos),
        "preco_medio": sum(precos) / len(precos) if precos else 0,
        "preco_max": max(precos) if precos else 0,
        "preco_min": min(precos) if precos else 0,
        "estoque_total": sum(estoques) if estoques else 0
    }
