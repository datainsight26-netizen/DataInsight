"""
Módulo de Federação e Agregação Multi-Planilhas (DataInsight Data Aggregator)
Permite processar e consolidar múltiplas planilhas de domínios diferentes
(Vendas, Aluguéis, Custos, Produtos, Geral) de forma unificada ou individual.
"""

from datetime import datetime, date
from bson import ObjectId
import pandas as pd
import numpy as np
from backend.db import dados_colecao, usuario as usuarios_colecao


# ==============================================================================
# 1. CLASSIFICAÇÃO DE DOMÍNIO / TIPOS DE PLANILHA
# ==============================================================================

DOMINIOS_CONFIG = {
    "RECEITAS_VENDAS": {
        "label": "Vendas & Receitas",
        "icone": "cart",
        "cor": "#10b981",
        "tipo_fluxo": "entrada",
        "palavras_chave": [
            "venda", "vendas", "faturamento", "receita", "pedido", "pedidos",
            "cliente", "clientes", "preco", "preço", "unitario", "unitário",
            "qtd", "quantidade", "nf", "nota fiscal", "comissao", "comissão"
        ]
    },
    "DESPESAS_ALUGUEL": {
        "label": "Aluguéis & Imóveis",
        "icone": "building",
        "cor": "#f59e0b",
        "tipo_fluxo": "saida",
        "palavras_chave": [
            "aluguel", "alugueis", "aluguéis", "imovel", "imóvel", "imoveis", "imóveis",
            "condominio", "condomínio", "iptu", "locacao", "locação", "inquilino",
            "locatario", "locatário", "proprietario", "proprietário", "caucao", "caução"
        ]
    },
    "DESPESAS_GERAIS": {
        "label": "Despesas & Custos Operacionais",
        "icone": "receipt",
        "cor": "#ef4444",
        "tipo_fluxo": "saida",
        "palavras_chave": [
            "despesa", "despesas", "custo", "custos", "gasto", "gastos", "saida", "saída",
            "salario", "salário", "folha", "funcionario", "funcionário", "fornecedor",
            "energia", "luz", "agua", "água", "internet", "manutencao", "manutenção", "imposto"
        ]
    },
    "ESTOQUE_PRODUTOS": {
        "label": "Estoque & Catálogo de Produtos",
        "icone": "box",
        "cor": "#8b5cf6",
        "tipo_fluxo": "neutro",
        "palavras_chave": [
            "estoque", "sku", "codigo", "código", "produto", "produtos", "categoria",
            "custo unitario", "custo unitário", "saldo", "reposicao", "reposição", "armazem"
        ]
    },
    "MISTA_GERAL": {
        "label": "Geral / Fluxo Completo",
        "icone": "layers",
        "cor": "#0ea5e9",
        "tipo_fluxo": "misto",
        "palavras_chave": [
            "fluxo", "dre", "balanco", "balanço", "financeiro", "geral", "completo"
        ]
    }
}


def detectar_dominio_tabela(nome_planilha: str, colunas: list, dados: list = None) -> str:
    """
    Classifica automaticamente o domínio de uma planilha com base no nome e nas colunas.
    """
    nome_norm = (nome_planilha or "").lower()
    cols_norm = " ".join([str(c).lower() for c in (colunas or [])])
    texto_analise = f"{nome_norm} {cols_norm}"

    # Pontuação por domínio
    pontuacao = {dom: 0 for dom in DOMINIOS_CONFIG.keys()}

    for dom, cfg in DOMINIOS_CONFIG.items():
        for kw in cfg["palavras_chave"]:
            if kw in nome_norm:
                pontuacao[dom] += 3  # Peso maior se estiver no nome da planilha
            if kw in cols_norm:
                pontuacao[dom] += 1

    # Heurística para MISTA_GERAL: se tiver tanto receita quanto despesa
    tem_receita = any(k in texto_analise for k in ["receita", "faturamento", "venda", "entrada"])
    tem_despesa = any(k in texto_analise for k in ["despesa", "custo", "gasto", "saida", "saída"])
    if tem_receita and tem_despesa:
        pontuacao["MISTA_GERAL"] += 5

    # Obter o domínio com maior pontuação
    melhor_dominio = max(pontuacao, key=pontuacao.get)
    if pontuacao[melhor_dominio] == 0:
        return "MISTA_GERAL"

    return melhor_dominio


# ==============================================================================
# 2. CONVERSÃO E NORMALIZAÇÃO DE DADOS
# ==============================================================================

def _limpar_valor_monetario(v):
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v) if not np.isnan(v) else 0.0
    
    s = str(v).strip()
    s = s.replace("R$", "").replace("r$", "").replace(" ", "")
    # Formato brasileiro 1.234,56
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s and "." not in s:
        s = s.replace(",", ".")
    
    try:
        val = float(s)
        return val if not np.isnan(val) else 0.0
    except:
        return 0.0


def _normalizar_data(v):
    if v is None or v == "" or (isinstance(v, float) and np.isnan(v)):
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    
    s = str(v).strip()
    # Tentar formatos comuns
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d/%m/%y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s.split(" ")[0].split("T")[0], fmt.split("T")[0]).strftime("%Y-%m-%d")
        except:
            pass
    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.notnull(dt):
            return dt.strftime("%Y-%m-%d")
    except:
        pass
    return str(v)


# ==============================================================================
# 3. RECUPERAÇÃO E SUMÁRIO DE PLANILHAS
# ==============================================================================

def listar_planilhas_usuario(usuario_id):
    """
    Retorna lista sumária de todas as planilhas do usuário com seus metadados de domínio.
    """
    if not usuario_id:
        return []

    docs = list(dados_colecao.find(
        {"usuario_id": usuario_id},
        sort=[("atualizado_em", -1), ("criado_em", -1)]
    ))

    resumo = []
    for doc in docs:
        t_id = str(doc["_id"])
        nome = doc.get("nome_planilha", "Planilha Sem Nome")
        cols = doc.get("colunas", [])
        linhas = doc.get("dados", [])
        
        dominio = doc.get("tipo_dominio")
        if not dominio or dominio not in DOMINIOS_CONFIG:
            dominio = detectar_dominio_tabela(nome, cols, linhas)

        cfg_dom = DOMINIOS_CONFIG.get(dominio, DOMINIOS_CONFIG["MISTA_GERAL"])

        resumo.append({
            "id": t_id,
            "nome": nome,
            "dominio": dominio,
            "dominio_label": cfg_dom["label"],
            "dominio_icone": cfg_dom["icone"],
            "dominio_cor": cfg_dom["cor"],
            "tipo_fluxo": cfg_dom["tipo_fluxo"],
            "total_linhas": len(linhas),
            "total_colunas": len(cols),
            "colunas": cols,
            "criado_em": str(doc.get("criado_em", "")),
            "atualizado_em": str(doc.get("atualizado_em", ""))
        })

    return resumo


# ==============================================================================
# 4. MOTOR DE FEDERAÇÃO / AGREGAÇÃO DE DADOS
# ==============================================================================

def obter_contexto_dados(usuario_id, escopo="todas", mapeamento=None):
    """
    Recupera e normaliza os dados do usuário com base no escopo:
    - escopo == "todas" | "consolidado": consolida todas as planilhas em um dataset federado inteligente.
    - escopo == <tabela_id>: recupera exclusivamente os dados daquela tabela.
    """
    if not usuario_id:
        return {
            "escopo": escopo,
            "colunas": [],
            "dados": [],
            "planilhas_envolvidas": [],
            "metricas_resumo": {"total_receitas": 0.0, "total_despesas": 0.0, "lucro_liquido": 0.0}
        }

    # Se for individual
    if escopo and escopo not in ("todas", "consolidado", "all", "global"):
        filtro = {"usuario_id": usuario_id}
        if ObjectId.is_valid(escopo):
            filtro["_id"] = ObjectId(escopo)
        else:
            filtro["$or"] = [{"nome_planilha": escopo}, {"tabela_id": escopo}]

        doc = dados_colecao.find_one(filtro)
        if not doc:
            # Fallback para mais recente
            doc = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("atualizado_em", -1), ("criado_em", -1)])

        if not doc:
            return {
                "escopo": "individual",
                "tabela_id": escopo,
                "nome_contexto": "Nenhuma planilha encontrada",
                "colunas": [],
                "dados": [],
                "planilhas_envolvidas": [],
                "metricas_resumo": {"total_receitas": 0.0, "total_despesas": 0.0, "lucro_liquido": 0.0}
            }

        cols = doc.get("colunas", [])
        linhas = doc.get("dados", [])
        nome = doc.get("nome_planilha", "Planilha")
        dominio = doc.get("tipo_dominio") or detectar_dominio_tabela(nome, cols, linhas)

        return {
            "escopo": "individual",
            "tabela_id": str(doc["_id"]),
            "nome_contexto": nome,
            "dominio": dominio,
            "colunas": cols,
            "dados": linhas,
            "planilhas_envolvidas": [{
                "id": str(doc["_id"]),
                "nome": nome,
                "dominio": dominio,
                "total_linhas": len(linhas)
            }],
            "metricas_resumo": _calcular_resumo_tabela_unica(cols, linhas, dominio)
        }

    # Escopo CONSOLIDADO (Todas as planilhas)
    docs = list(dados_colecao.find(
        {"usuario_id": usuario_id},
        sort=[("atualizado_em", -1), ("criado_em", -1)]
    ))

    if not docs:
        return {
            "escopo": "todas",
            "tabela_id": "todas",
            "nome_contexto": "Nenhuma planilha disponível",
            "colunas": [],
            "dados": [],
            "planilhas_envolvidas": [],
            "metricas_resumo": {"total_receitas": 0.0, "total_despesas": 0.0, "lucro_liquido": 0.0}
        }

    # Se só tiver 1 planilha cadastrada, retorna no formato unificado mas com os dados dela
    if len(docs) == 1:
        doc = docs[0]
        cols = doc.get("colunas", [])
        linhas = doc.get("dados", [])
        nome = doc.get("nome_planilha", "Planilha Única")
        dominio = doc.get("tipo_dominio") or detectar_dominio_tabela(nome, cols, linhas)

        linhas_enriquecidas = []
        for l in linhas:
            item = dict(l)
            item["_origem_planilha"] = nome
            item["_tipo_dominio"] = dominio
            linhas_enriquecidas.append(item)

        return {
            "escopo": "todas",
            "tabela_id": "todas",
            "nome_contexto": f"Visão Consolidada ({nome})",
            "colunas": cols + ["_origem_planilha"],
            "dados": linhas_enriquecidas,
            "planilhas_envolvidas": [{
                "id": str(doc["_id"]),
                "nome": nome,
                "dominio": dominio,
                "total_linhas": len(linhas)
            }],
            "metricas_resumo": _calcular_resumo_tabela_unica(cols, linhas, dominio)
        }

    # Multi-Planilhas: Mapear e Unificar registros em um Dataset Federado Padronizado
    return _unificar_multiplas_tabelas(docs)


def _unificar_multiplas_tabelas(docs: list) -> dict:
    planilhas_info = []
    registros_consolidados = []

    total_receitas_global = 0.0
    total_despesas_global = 0.0

    for doc in docs:
        nome_tab = doc.get("nome_planilha", "Planilha")
        cols = doc.get("colunas", [])
        dados = doc.get("dados", [])
        dominio = doc.get("tipo_dominio") or detectar_dominio_tabela(nome_tab, cols, dados)
        
        planilhas_info.append({
            "id": str(doc["_id"]),
            "nome": nome_tab,
            "dominio": dominio,
            "total_linhas": len(dados)
        })

        if not dados:
            continue

        cols_lower = {str(c).lower(): c for c in cols}

        # 1. Coluna de Data
        col_data = None
        for alias in ["data", "date", "periodo", "período", "mes", "mês", "vencimento", "dia"]:
            for cl, orig in cols_lower.items():
                if alias in cl:
                    col_data = orig
                    break
            if col_data:
                break

        # 2. Coluna de Receita / Entrada
        col_receita = None
        for alias in ["receita", "faturamento", "vendas", "venda", "entrada", "valor total", "total"]:
            for cl, orig in cols_lower.items():
                if alias in cl and "despesa" not in cl and "custo" not in cl and "imposto" not in cl:
                    col_receita = orig
                    break
            if col_receita:
                break

        # 3. Coluna de Despesa / Saída
        col_despesa = None
        for alias in ["despesa", "despesas", "custo", "custos", "saida", "saída", "gasto", "gastos", "valor aluguel", "condominio", "iptu"]:
            for cl, orig in cols_lower.items():
                if alias in cl:
                    col_despesa = orig
                    break
            if col_despesa:
                break

        # 4. Coluna de Categoria / Descrição
        col_cat = None
        for alias in ["categoria", "category", "tipo", "produto", "imovel", "imóvel", "descricao", "descrição", "item", "servico", "serviço"]:
            for cl, orig in cols_lower.items():
                if alias in cl:
                    col_cat = orig
                    break
            if col_cat:
                break

        # Coluna genérica de "Valor"
        col_valor_generico = None
        for alias in ["valor", "total", "preco", "preço", "quantia"]:
            for cl, orig in cols_lower.items():
                if alias in cl and orig not in (col_receita, col_despesa):
                    col_valor_generico = orig
                    break
            if col_valor_generico:
                break

        for linha in dados:
            val_data = _normalizar_data(linha.get(col_data)) if col_data else datetime.now().strftime("%Y-%m-%d")
            val_cat = str(linha.get(col_cat) or nome_tab) if col_cat else nome_tab
            
            val_rec = 0.0
            val_desp = 0.0

            if col_receita and col_receita in linha:
                val_rec = _limpar_valor_monetario(linha.get(col_receita))
            if col_despesa and col_despesa in linha:
                val_desp = _limpar_valor_monetario(linha.get(col_despesa))

            if val_rec == 0.0 and val_desp == 0.0 and col_valor_generico and col_valor_generico in linha:
                val_bruto = _limpar_valor_monetario(linha.get(col_valor_generico))
                if dominio in ("DESPESAS_ALUGUEL", "DESPESAS_GERAIS"):
                    val_desp = val_bruto
                elif dominio == "RECEITAS_VENDAS":
                    val_rec = val_bruto
                else:
                    val_rec = val_bruto

            if val_rec == 0.0 and val_desp == 0.0:
                for k, v in linha.items():
                    if k != col_data and isinstance(v, (int, float, str)):
                        num = _limpar_valor_monetario(v)
                        if num > 0:
                            if dominio in ("DESPESAS_ALUGUEL", "DESPESAS_GERAIS"):
                                val_desp = num
                            else:
                                val_rec = num
                            break

            val_lucro = val_rec - val_desp
            total_receitas_global += val_rec
            total_despesas_global += val_desp

            reg = dict(linha)
            reg["Data"] = val_data
            reg["Faturamento"] = val_rec
            reg["Receita"] = val_rec
            reg["Despesas"] = val_desp
            reg["Despesa"] = val_desp
            reg["Lucro"] = val_lucro
            reg["Categoria"] = val_cat
            reg["_origem_planilha"] = nome_tab
            reg["_tipo_dominio"] = dominio
            
            registros_consolidados.append(reg)

    colunas_padrao = ["Data", "Faturamento", "Despesas", "Lucro", "Categoria", "_origem_planilha"]

    lucro_global = total_receitas_global - total_despesas_global

    return {
        "escopo": "todas",
        "tabela_id": "todas",
        "nome_contexto": f"Visão Consolidada ({len(planilhas_info)} planilhas)",
        "colunas": colunas_padrao,
        "dados": registros_consolidados,
        "planilhas_envolvidas": planilhas_info,
        "metricas_resumo": {
            "total_receitas": round(total_receitas_global, 2),
            "total_despesas": round(total_despesas_global, 2),
            "lucro_liquido": round(lucro_global, 2),
            "margem_lucro": round((lucro_global / total_receitas_global * 100) if total_receitas_global > 0 else 0, 1)
        }
    }


def _calcular_resumo_tabela_unica(colunas: list, dados: list, dominio: str) -> dict:
    if not dados:
        return {"total_receitas": 0.0, "total_despesas": 0.0, "lucro_liquido": 0.0, "margem_lucro": 0.0}

    total_rec = 0.0
    total_desp = 0.0

    cols_lower = {str(c).lower(): c for c in colunas}

    col_rec = next((orig for cl, orig in cols_lower.items() if any(a in cl for a in ["receita", "faturamento", "venda", "entrada"])), None)
    col_desp = next((orig for cl, orig in cols_lower.items() if any(a in cl for a in ["despesa", "custo", "gasto", "saida", "aluguel"])), None)
    col_val = next((orig for cl, orig in cols_lower.items() if any(a in cl for a in ["valor", "total", "preco"])), None)

    for l in dados:
        if col_rec and col_rec in l:
            total_rec += _limpar_valor_monetario(l.get(col_rec))
        if col_desp and col_desp in l:
            total_desp += _limpar_valor_monetario(l.get(col_desp))
        if not col_rec and not col_desp and col_val and col_val in l:
            v = _limpar_valor_monetario(l.get(col_val))
            if dominio in ("DESPESAS_ALUGUEL", "DESPESAS_GERAIS"):
                total_desp += v
            else:
                total_rec += v

    lucro = total_rec - total_desp
    margem = (lucro / total_rec * 100) if total_rec > 0 else 0.0

    return {
        "total_receitas": round(total_rec, 2),
        "total_despesas": round(total_desp, 2),
        "lucro_liquido": round(lucro, 2),
        "margem_lucro": round(margem, 1)
    }
