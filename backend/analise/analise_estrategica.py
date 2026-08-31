from flask import session, jsonify, request
from backend.db import dados_colecao
from datetime import datetime, timedelta
import pandas as pd
from bson import ObjectId


# ======================
# COLUNAS RECONHECIDAS
# ======================
COL_FATURAMENTO = ["Total", "Faturamento", "faturamento", "Vendas", "vendas", "Receita", "receita"]
COL_DESPESA     = ["Custo", "Despesa", "despesa", "Despesas", "despesas", "Gastos", "gastos"]
COL_LUCRO       = ["Lucro", "lucro", "Profit", "profit"]


# ======================
# UTILITÁRIOS
# ======================
def encontrar_coluna_data(df):
    return next((c for c in df.columns if c.lower() == "data"), None)


def calcular_total(df, colunas):
    if df.empty:
        return 0.0

    for col in colunas:
        if col in df.columns:
            return float(pd.to_numeric(df[col], errors="coerce").sum())

    return 0.0


def variacao_percentual(anterior, atual):
    if anterior == 0:
        return 0.0 if atual == 0 else 100.0
    return round(((atual - anterior) / anterior) * 100, 2)


def filtrar_por_periodo(df, col_data, inicio, fim):
    if df.empty or not col_data:
        return df

    df = df.copy()
    df[col_data] = pd.to_datetime(df[col_data], errors="coerce")
    df = df.dropna(subset=[col_data])

    return df[(df[col_data] >= inicio) & (df[col_data] <= fim)]


def calcular_metricas(df):
    fat  = calcular_total(df, COL_FATURAMENTO)
    desp = calcular_total(df, COL_DESPESA)
    luc  = calcular_total(df, COL_LUCRO) or (fat - desp)
    mg   = 0.0 if fat == 0 else round((luc / fat) * 100, 2)

    return fat, desp, luc, mg


def calcular_regressao_linear(series):
    valores = [float(v) for v in series if pd.notna(v)]

    if len(valores) < 2:
        return 0.0, float(valores[-1]) if valores else 0.0

    x = list(range(1, len(valores) + 1))
    x_media = sum(x) / len(x)
    y_media = sum(valores) / len(valores)

    covariancia = sum((xi - x_media) * (yi - y_media) for xi, yi in zip(x, valores))
    variancia = sum((xi - x_media) ** 2 for xi in x)

    if variancia == 0:
        return 0.0, y_media

    inclinacao = covariancia / variancia
    intercepto = y_media - inclinacao * x_media

    return inclinacao, intercepto


def projetar_valor(series, horizonte=1):
    inclinacao, intercepto = calcular_regressao_linear(series)
    valor = intercepto + inclinacao * (len(series) + horizonte)
    return round(max(0.0, valor), 2)


# ======================
# SAÚDE DO NEGÓCIO
# ======================
def calcular_saude_negocio(faturamento, despesas, lucro, margem, faturamento_anterior, lucro_anterior, series_faturamento, series_lucro):
    """Calcula score de saúde do negócio (0-100)"""
    
    crescimento_faturamento = variacao_percentual(faturamento_anterior, faturamento)
    crescimento_lucro = variacao_percentual(lucro_anterior, lucro)
    
    # Pontuação baseada em múltiplos fatores
    score = 50  # Base
    
    # Margem (até 25 pontos)
    if margem >= 25:
        score += 25
    elif margem >= 20:
        score += 20
    elif margem >= 15:
        score += 15
    elif margem >= 10:
        score += 10
    else:
        score += 5
    
    # Crescimento de faturamento (até 15 pontos)
    if crescimento_faturamento >= 15:
        score += 15
    elif crescimento_faturamento >= 10:
        score += 12
    elif crescimento_faturamento >= 5:
        score += 8
    elif crescimento_faturamento >= 0:
        score += 5
    else:
        score -= 5
    
    # Crescimento de lucro (até 10 pontos)
    if crescimento_lucro >= 10:
        score += 10
    elif crescimento_lucro >= 5:
        score += 7
    elif crescimento_lucro >= 0:
        score += 4
    else:
        score -= 3
    
    # Limitar score entre 0 e 100
    score = max(0, min(100, score))
    
    # Classificação
    if score >= 80:
        nivel = "excelente"
        descricao = "Negócio em excelente saúde financeira"
    elif score >= 60:
        nivel = "bom"
        descricao = "Negócio saudável com margem para melhoria"
    elif score >= 40:
        nivel = "atencao"
        descricao = "Atenção necessária em alguns indicadores"
    else:
        nivel = "critico"
        descricao = "Situação crítica requer ação imediata"
    
    return {
        "score": score,
        "nivel": nivel,
        "descricao": descricao,
        "indicadores": {
            "crescimento_receita": crescimento_faturamento,
            "margem": margem,
            "fluxo_caixa": lucro,  # Simplificado
            "controle_despesas": 0  # Será calculado
        }
    }


# ======================
# ALERTAS INTELIGENTES
# ======================
def gerar_alertas(faturamento, despesas, lucro, margem, faturamento_anterior, lucro_anterior):
    """Gera alertas baseados nos indicadores"""
    
    alertas = []
    crescimento_faturamento = variacao_percentual(faturamento_anterior, faturamento)
    crescimento_lucro = variacao_percentual(lucro_anterior, lucro)
    
    # Alerta de margem em queda
    if margem < 15:
        alertas.append({
            "tipo": "critico",
            "titulo": "Margem de Lucro Crítica",
            "descricao": f"Sua margem de {margem}% está abaixo do nível saudável de 15%. Isso indica baixa rentabilidade.",
            "acao": "Ver análise de custos"
        })
    elif margem < 20 and crescimento_lucro < 0:
        alertas.append({
            "tipo": "critico",
            "titulo": "Margem em Queda",
            "descricao": f"Sua margem caiu para {margem}% e o lucro está diminuindo. Revisão de preços e custos necessária.",
            "acao": "Ver análise detalhada"
        })
    
    # Alerta de crescimento positivo
    if crescimento_faturamento > 10 and crescimento_lucro > 5:
        alertas.append({
            "tipo": "sucesso",
            "titulo": "Crescimento Sustentável",
            "descricao": f"Faturamento crescendo {crescimento_faturamento}% e lucro {crescimento_lucro}%. Momento para expansão.",
            "acao": "Ver oportunidades"
        })
    
    # Alerta de fluxo de caixa
    if lucro < 0:
        alertas.append({
            "tipo": "critico",
            "titulo": "Fluxo de Caixa Negativo",
            "descricao": f"Prejuízo de R$ {abs(lucro):.2f} no período. Ação imediata necessária.",
            "acao": "Ver plano de recuperação"
        })
    
    return alertas


# ======================
# RECOMENDAÇÕES ESTRATÉGICAS
# ======================
def gerar_recomendacoes(faturamento, despesas, lucro, margem, crescimento_faturamento, crescimento_lucro):
    """Gera recomendações baseadas na análise"""
    
    recomendacoes = []
    
    # Recomendação de custos
    if margem < 20:
        recomendacoes.append({
            "prioridade": "alta",
            "titulo": "Reduzir Custos Fixos",
            "descricao": "Margem abaixo de 20% indica necessidade de revisão de custos fixos e contratos.",
            "impacto": f"+{(20 - margem) * 0.5:.1f}% margem potencial",
            "cor": "#ef4444"
        })
    
    # Recomendação de preços
    if crescimento_faturamento > 0 and margem < 25:
        recomendacoes.append({
            "prioridade": "media",
            "titulo": "Revisar Política de Preços",
            "descricao": "Com demanda estável, há espaço para aumento de preços em produtos de alta margem.",
            "impacto": "+3-5% faturamento potencial",
            "cor": "#f59e0b"
        })
    
    # Recomendação de estoque
    if despesas > faturamento * 0.6:
        recomendacoes.append({
            "prioridade": "baixa",
            "titulo": "Otimizar Estoque",
            "descricao": "Custos altos podem indicar estoque excessivo. Considere promoções para liberar capital.",
            "impacto": "+capital de giro",
            "cor": "#3b82f6"
        })
    
    return recomendacoes


# ======================
# CENÁRIOS DE ANÁLISE
# ======================
def calcular_cenarios(faturamento, despesas, lucro, margem, series_faturamento, series_lucro):
    """Calcula projeções para diferentes cenários"""
    
    # Tendência atual
    tendencia_faturamento = calcular_regressao_linear(series_faturamento)
    tendencia_lucro = calcular_regressao_linear(series_lucro)
    
    # Cenário provável (tendência atual)
    proximo_fat_provavel = projetar_valor(series_faturamento, 1)
    proximo_luc_provavel = projetar_valor(series_lucro, 1)
    
    # Cenário otimista (tendência + 20%)
    proximo_fat_otimista = proximo_fat_provavel * 1.2
    proximo_luc_otimista = proximo_luc_provavel * 1.3
    
    # Cenário pessimista (tendência - 20%)
    proximo_fat_pessimista = proximo_fat_provavel * 0.8
    proximo_luc_pessimista = proximo_luc_provavel * 0.7
    
    return {
        "provavel": {
            "faturamento": proximo_fat_provavel,
            "lucro": proximo_luc_provavel,
            "margem": (proximo_luc_provavel / proximo_fat_provavel * 100) if proximo_fat_provavel > 0 else 0
        },
        "otimista": {
            "faturamento": proximo_fat_otimista,
            "lucro": proximo_luc_otimista,
            "margem": (proximo_luc_otimista / proximo_fat_otimista * 100) if proximo_fat_otimista > 0 else 0
        },
        "pessimista": {
            "faturamento": proximo_fat_pessimista,
            "lucro": proximo_luc_pessimista,
            "margem": (proximo_luc_pessimista / proximo_fat_pessimista * 100) if proximo_fat_pessimista > 0 else 0
        }
    }


# ======================
# ENDPOINT PRINCIPAL
# ======================
def obter_analise_estrategica():
    """Endpoint principal para o Centro de Análise Estratégica"""
    
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401
    
    try:
        # Parâmetros da requisição
        data_inicio = request.args.get('data_inicio')
        data_fim = request.args.get('data_fim')
        planilha_id = request.args.get('planilha_id', 'todas')
        cenario = request.args.get('cenario', 'provavel')
        
        # Converter datas
        if data_inicio:
            data_inicio = datetime.strptime(data_inicio, '%Y-%m-%d')
        else:
            data_inicio = datetime.now() - timedelta(days=90)
            
        if data_fim:
            data_fim = datetime.strptime(data_fim, '%Y-%m-%d')
        else:
            data_fim = datetime.now()
        
        # Buscar dados
        query = {"usuario_id": usuario_id}
        if planilha_id != 'todas':
            query["_id"] = ObjectId(planilha_id)
        
        docs = list(dados_colecao.find(query))
        
        if not docs:
            return jsonify({
                "erro": "Nenhum dado encontrado",
                "saude": {"score": 0, "nivel": "sem_dados", "descricao": "Carregue dados para análise"},
                "alertas": [],
                "recomendacoes": []
            })
        
        # Processar dados (simplificado - assumindo primeiro documento)
        doc = docs[0]
        dados = doc.get("dados", [])
        
        if not dados:
            return jsonify({
                "erro": "Sem dados para analisar",
                "saude": {"score": 0, "nivel": "sem_dados", "descricao": "Adicione dados à planilha"},
                "alertas": [],
                "recomendacoes": []
            })
        
        # Criar DataFrame
        df = pd.DataFrame(dados)
        
        # Encontrar coluna de data
        col_data = encontrar_coluna_data(df)
        
        # Filtrar por período
        if col_data:
            df_periodo = filtrar_por_periodo(df, col_data, data_inicio, data_fim)
            
            # Calcular período anterior para comparação
            dias_periodo = (data_fim - data_inicio).days
            data_inicio_anterior = data_inicio - timedelta(days=dias_periodo)
            data_fim_anterior = data_inicio
            
            df_anterior = filtrar_por_periodo(df, col_data, data_inicio_anterior, data_fim_anterior)
        else:
            df_periodo = df
            df_anterior = pd.DataFrame()
        
        # Calcular métricas atuais
        fat_atual, desp_atual, luc_atual, mg_atual = calcular_metricas(df_periodo)
        
        # Calcular métricas anteriores
        fat_anterior, desp_anterior, luc_anterior, mg_anterior = calcular_metricas(df_anterior)
        
        # Gerar séries temporais
        if col_data:
            from backend.analise.analise import gerar_series
            series = gerar_series(df_periodo, col_data)
            series_faturamento = series.get("faturamento", [])
            series_lucro = series.get("lucro", [])
        else:
            series_faturamento = []
            series_lucro = []
        
        # Calcular saúde do negócio
        saude = calcular_saude_negocio(
            fat_atual, desp_atual, luc_atual, mg_atual,
            fat_anterior, luc_anterior, series_faturamento, series_lucro
        )
        
        # Gerar alertas
        alertas = gerar_alertas(fat_atual, desp_atual, luc_atual, mg_atual, fat_anterior, luc_anterior)
        
        # Gerar recomendações
        crescimento_fat = variacao_percentual(fat_anterior, fat_atual)
        crescimento_luc = variacao_percentual(luc_anterior, luc_atual)
        recomendacoes = gerar_recomendacoes(fat_atual, desp_atual, luc_atual, mg_atual, crescimento_fat, crescimento_luc)
        
        # Calcular cenários
        cenarios = calcular_cenarios(fat_atual, desp_atual, luc_atual, mg_atual, series_faturamento, series_lucro)
        
        # Ajustar dados baseados no cenário selecionado
        dados_cenario = cenarios.get(cenario, cenarios["provavel"])
        
        return jsonify({
            "sucesso": True,
            "periodo": {
                "inicio": data_inicio.strftime('%Y-%m-%d'),
                "fim": data_fim.strftime('%Y-%m-%d')
            },
            "metricas": {
                "faturamento": fat_atual,
                "despesas": desp_atual,
                "lucro": luc_atual,
                "margem": mg_atual
            },
            "comparacao": {
                "faturamento_anterior": fat_anterior,
                "lucro_anterior": luc_anterior,
                "variacao_faturamento": crescimento_fat,
                "variacao_lucro": crescimento_luc
            },
            "saude": saude,
            "alertas": alertas,
            "recomendacoes": recomendacoes,
            "cenarios": cenarios,
            "dados_cenario": dados_cenario,
            "series": {
                "faturamento": series_faturamento,
                "lucro": series_lucro
            }
        })
        
    except Exception as e:
        print(f"Erro ao obter análise estratégica: {e}", flush=True)
        return jsonify({
            "erro": str(e),
            "saude": {"score": 0, "nivel": "erro", "descricao": "Erro ao processar dados"},
            "alertas": [],
            "recomendacoes": []
        }), 500