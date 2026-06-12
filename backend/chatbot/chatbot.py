import os
from dotenv import load_dotenv
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from backend.home.home import calcular_desempenho, converter_datas, encontrar_coluna_data, obter_colunas_mapeadas, COL_FATURAMENTO, COL_DESPESA, calcular_total_dinamico
from backend.db import dados_colecao, chat_historico
from datetime import datetime
import pandas as pd
import numpy as np
from flask import session, jsonify, request, send_file
import io

# Carrega as variáveis do arquivo .env
load_dotenv()

# ==========================
# FERRAMENTAS DO ANALISTA
# ==========================
def obter_resumo_financeiro(periodo: str = "30_dias") -> str:
    """Busca o resumo financeiro (faturamento, lucro, despesa). O período pode ser '7_dias', '30_dias', '90_dias' ou 'ano_atual'."""
    try:
        resposta, status = calcular_desempenho(periodo)
        if status != 200:
            return "Não foi possível recuperar os dados agora."
        
        dados = resposta.get_json()
        if "faturamento" not in dados:
            return "Dados insuficientes ou vazios."
            
        resumo = (
            f"Resumo do período ({periodo}):\n"
            f"- Faturamento: R$ {dados['faturamento']['valor']:,.2f} ({dados['faturamento']['percentual']}%)\n"
            f"- Lucro: R$ {dados['lucro']['valor']:,.2f} ({dados['lucro']['percentual']}%)\n"
            f"- Despesas: R$ {dados['despesa']['valor']:,.2f} ({dados['despesa']['percentual']}%)\n"
            f"- Crescimento: {dados['crescimento']['valor']}%"
        )
        return resumo
    except Exception as erro:
        return f"Erro ao calcular resumo: {str(erro)}"

def obter_transacoes_recentes(limite: int = 5) -> str:
    """Retorna as últimas transações registradas para dar contexto detalhado à IA."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return "Usuário não autenticado."
    
    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado encontrado."
        
        df = pd.DataFrame(documento["dados"])
        recentes = df.tail(limite).to_string(index=False)
        return f"Últimos registros encontrados:\n{recentes}"
    except Exception as erro:
        return f"Erro ao buscar transações: {str(erro)}"

# ==========================
# FERRAMENTAS DO CIENTISTA
# ==========================
def prever_receita_mes_seguinte() -> str:
    """Prevê o faturamento do próximo mês usando regressão linear simples com base no histórico."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return "Usuário não autenticado."
    
    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado encontrado para previsão."
        
        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)
        if not col_data:
            return "Coluna de data não encontrada. Não é possível prever."
            
        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df['mes_ano'] = df[col_data].dt.to_period('M')
        
        mensal = df.groupby('mes_ano').apply(lambda g: calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO)).reset_index(name='faturamento')
        
        if len(mensal) < 2:
            return "Dados insuficientes (preciso de pelo menos 2 meses) para criar uma previsão matemática."
        
        y = mensal['faturamento'].values
        x = np.arange(len(y))
        
        # Regressão linear simples (y = mx + c)
        coef = np.polyfit(x, y, 1)
        poly1d_fn = np.poly1d(coef)
        
        proximo_mes_idx = len(y)
        previsao = poly1d_fn(proximo_mes_idx)
        tendencia = "crescimento" if coef[0] > 0 else "queda"
        
        return f"A Previsão Matemática para o próximo mês é faturar aproximadamente R$ {previsao:,.2f}. A tendência detectada é de {tendencia}."
    except Exception as erro:
        return f"Erro ao prever receita: {str(erro)}"

def detectar_anomalias_despesas() -> str:
    """Verifica se há picos de despesas no último mês em comparação com a média histórica."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return "Usuário não autenticado."
    
    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado encontrado."
        
        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)
        if not col_data:
            return "Coluna de data não encontrada."
            
        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df['mes_ano'] = df[col_data].dt.to_period('M')
        
        mensal = df.groupby('mes_ano').apply(lambda g: calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA)).reset_index(name='despesa')
        
        if len(mensal) < 2:
            return "Histórico insuficiente para detectar anomalias."
        
        media_historica = mensal['despesa'][:-1].mean()
        ultimo_mes = mensal['despesa'].iloc[-1]
        
        if media_historica > 0 and ultimo_mes > (media_historica * 1.3): # 30% acima da média
            return f"⚠️ ANOMALIA DETECTADA: As despesas do último mês (R$ {ultimo_mes:,.2f}) estão {((ultimo_mes/media_historica)-1)*100:.1f}% acima da média histórica (R$ {media_historica:,.2f})."
        else:
            return f"As despesas do último mês (R$ {ultimo_mes:,.2f}) estão dentro da normalidade (média: R$ {media_historica:,.2f}). Não há anomalias graves."
    except Exception as erro:
        return f"Erro na detecção de anomalias: {str(erro)}"

# ==========================
# FERRAMENTAS DO CONSULTOR
# ==========================
def calcular_ponto_equilibrio() -> str:
    """Calcula o Ponto de Equilíbrio baseado nas médias de despesas e faturamento."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return "Usuário não autenticado."
    
    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado."
            
        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        
        fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
        desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)
        
        if fat_total == 0:
            return "Sem faturamento registrado para calcular margem."
            
        lucro = fat_total - desp_total
        margem = lucro / fat_total if fat_total > 0 else 0
        
        if margem <= 0:
            return "A margem de lucro histórica é negativa ou zero. Ponto de equilíbrio inatingível com a estrutura atual. Você está operando no vermelho."
            
        # Ponto de Equilíbrio (simplificado) = Despesas / Margem
        pe = desp_total / margem
        return f"Estimativa de Ponto de Equilíbrio: Você precisa faturar aproximadamente R$ {pe:,.2f} no total para cobrir os custos, baseado na sua margem histórica de {margem*100:.1f}%."
    except Exception as erro:
        return f"Erro ao calcular PE: {str(erro)}"

# ==========================
# FERRAMENTAS DO ASSISTENTE
# ==========================
def gerar_arquivo_download(tipo: str, periodo: str = '30_dias') -> str:
    """Gera um link para download dos dados financeiros do usuário. O tipo pode ser 'csv' ou 'excel' ou 'pdf'. O periodo pode ser '7_dias', '30_dias', '90_dias', 'ano_atual' ou 'mes_XX'."""
    tipo = tipo.lower()
    if tipo == 'pdf':
        try:
            from backend.home.home import calcular_desempenho, obter_dados_graficos
            from datetime import datetime
            
            resp_kpi = calcular_desempenho(periodo)
            resp_kpi_obj = resp_kpi[0] if isinstance(resp_kpi, tuple) else resp_kpi
            kpis_response = resp_kpi_obj.get_json() if hasattr(resp_kpi_obj, 'get_json') else resp_kpi_obj
            
            # Garantir que kpis é um dict com os dados formatados
            if isinstance(kpis_response, dict):
                kpis = {
                    'faturamento': f"{kpis_response.get('faturamento', {}).get('valor', 0):,.2f}",
                    'lucro': f"{kpis_response.get('lucro', {}).get('valor', 0):,.2f}",
                    'despesas': f"{kpis_response.get('despesa', {}).get('valor', 0):,.2f}",
                    'crescimento': f"{kpis_response.get('crescimento', {}).get('valor', 0):.1f}%"
                }
            else:
                kpis = {'faturamento': '0,00', 'lucro': '0,00', 'despesas': '0,00', 'crescimento': '0%'}
            
            resp_graf = obter_dados_graficos(periodo)
            resp_graf_obj = resp_graf[0] if isinstance(resp_graf, tuple) else resp_graf
            graficos_data = resp_graf_obj.get_json() if hasattr(resp_graf_obj, 'get_json') else resp_graf_obj
            
            tabela_pdf = []
            barras = graficos_data.get("grafico_barras", {}) if isinstance(graficos_data, dict) else {}
            if barras and "labels" in barras:
                for i, label in enumerate(barras["labels"]):
                    try:
                        fat = barras["series"][0]["data"][i]
                        desp = barras["series"][1]["data"][i]
                        luc = barras["series"][2]["data"][i]
                        margem = f"{(luc / fat * 100):.1f}%" if fat > 0 else "0%"
                        tabela_pdf.append({
                            "mes": label, "fat": f"{fat:,.2f}", "luc": f"{luc:,.2f}", "desp": f"{desp:,.2f}", "margem": margem
                        })
                    except:
                        pass
            
            session['relatorio_dados'] = {
                'nome': f"Relatório Gerado por IA",
                'periodo': periodo.replace('_', ' ').title(),
                'data': datetime.now().strftime("%d/%m/%Y"),
                'kpis': kpis,
                'grafico': True,
                'tendencias': True,
                'margem': True,
                'dadosDetalhados': True,
                'tabela': tabela_pdf,
                'insights': ["Análise rápida gerada automaticamente pela IA com base no período solicitado."]
            }
        except Exception as e:
            print("Erro ao preparar PDF pela IA:", e)
            
        return "Pronto! Já preparei seu arquivo em PDF. Forneça o seguinte link para o usuário baixar o PDF:\n\n[Clique aqui para baixar seu relatório em PDF](/api/gerar-pdf-ia?periodo=" + periodo + ")"
    elif tipo in ['csv', 'excel', 'xlsx']:
        tipo_url = 'excel' if 'excel' in tipo or 'xlsx' in tipo else 'csv'
        return f"Pronto! Já preparei seu arquivo. Forneça o seguinte link para o usuário baixar o arquivo:\n\n[Clique aqui para baixar seu relatório em {tipo.upper()}](/api/download/{tipo_url})"
    else:
        return "Desculpe, só consigo gerar links para PDF, Excel ou CSV."

def exportar_dados_usuario(tipo):
    """Lógica do endpoint para gerar e retornar o arquivo real."""
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return "Não autorizado", 401
        
    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado encontrado", 404
            
        df = pd.DataFrame(documento["dados"])
        
        if tipo == 'csv':
            csv_buffer = io.StringIO()
            df.to_csv(csv_buffer, index=False, encoding='utf-8')
            mem = io.BytesIO()
            mem.write(csv_buffer.getvalue().encode('utf-8'))
            mem.seek(0)
            return send_file(mem, mimetype='text/csv', as_attachment=True, download_name='relatorio_datainsight.csv')
            
        elif tipo == 'excel':
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='Dados Financeiros')
            excel_buffer.seek(0)
            return send_file(excel_buffer, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='relatorio_datainsight.xlsx')
            
    except Exception as e:
        print(f"Erro ao exportar: {e}")
        return "Erro ao exportar dados", 500

# ==========================
# AGENTES E ORQUESTRAÇÃO
# ==========================
def obter_time_agentes():
    """Configura o Time de Agentes e o Orquestrador."""
    chave_api = os.getenv("OPENAI_API_KEY")
    # Limpar aspas se vier do .env com aspas duplas
    chave_api = chave_api.strip('"').strip("'") if chave_api else None
    
    if not chave_api:
        raise ValueError("A variável OPENAI_API_KEY não foi encontrada no arquivo .env")
        
    modelo_ia = OpenAIChat(id="gpt-4o", api_key=chave_api)
    
    analista = Agent(
        name="Analista de Dados",
        role="Especialista em extração de dados reais, resumos financeiros e transações.",
        model=modelo_ia,
        tools=[obter_resumo_financeiro, obter_transacoes_recentes],
        instructions=["Sempre busque os dados reais no banco antes de responder.", "Foque em explicar o que aconteceu e os números exatos."]
    )
    
    cientista = Agent(
        name="Cientista de Dados",
        role="Especialista em previsões matemáticas, modelos e detecção de anomalias.",
        model=modelo_ia,
        tools=[prever_receita_mes_seguinte, detectar_anomalias_despesas],
        instructions=["Use modelos para olhar o futuro do negócio.", "Alerte sobre comportamentos anormais nos gastos e na receita."]
    )
    
    consultor = Agent(
        name="Consultor Financeiro",
        role="Especialista em estratégia, conselhos e cálculo de ponto de equilíbrio.",
        model=modelo_ia,
        tools=[calcular_ponto_equilibrio],
        instructions=["Forneça dicas táticas para melhorar os números e calcule o ponto de equilíbrio para ajudar na tomada de decisão.", "Seja propositivo."]
    )
    
    assistente_executivo = Agent(
        name="Assistente Executivo",
        role="Especialista em gerar arquivos e relatórios para download.",
        model=modelo_ia,
        tools=[gerar_arquivo_download],
        instructions=["Se o usuário pedir para baixar, exportar ou gerar PDF, Excel ou CSV dos dados, use sua ferramenta para gerar o link de download correspondente.", "Se o usuário especificar um período (ex: 7 dias, mês de abril), repasse esse período no parâmetro 'periodo' (ex: '7_dias', 'mes_04').", "Retorne o link de download formatado em Markdown."]
    )
    
    # Orquestrador (Team Leader)
    orquestrador = Agent(
        name="Assistente Inteligente DataInsight",
        model=modelo_ia,
        team=[analista, cientista, consultor, assistente_executivo],
        instructions=[
            "Você é o líder do time virtual do DataInsight.",
            "Deleque perguntas sobre dados passados e faturamento para o Analista de Dados.",
            "Deleque perguntas sobre previsões e anomalias para o Cientista de Dados.",
            "Deleque perguntas sobre estratégia e ponto de equilíbrio para o Consultor Financeiro.",
            "Delegue pedidos de gerar, baixar ou exportar arquivos (PDF, Excel, CSV) para o Assistente Executivo.",
            "INSTRUÇÃO CRÍTICA SOBRE GRÁFICOS: Para gerar gráficos, o sistema já possui os dados no banco. Apenas crie uma resposta dizendo 'Aqui está o gráfico solicitado:' e insira EXATAMENTE esta tag no final do texto: <div class='grafico-ia-render' data-periodo='30_dias' data-tipo='linha' data-metricas='faturamento,lucro' data-titulo='Faturamento Mensal'></div>. Troque '30_dias' por 7_dias, 30_dias, 90_dias, ano_atual ou mes_XX conforme pedido. Troque 'linha' por 'barras' ou 'pizza' conforme o tipo. E MUDANÇA IMPORTANTE: Em 'data-metricas', liste (separado por vírgula e sem espaços) APENAS as métricas que o usuário pedir (ex: 'faturamento', ou 'lucro,despesas', ou 'faturamento,lucro,despesas'). Se ele não especificar, coloque 'faturamento,lucro'. O 'data-titulo' deve descrever o gráfico gerado.",
            "Após os agentes retornarem os dados, sintetize a resposta final para o usuário de forma clara, profissional e amigável.",
            "Formate a resposta livremente com Markdown. Você DEVE usar **negrito** para destacar valores, datas e números importantes. Sempre que fizer sentido, organize comparações e finanças em pequenas tabelas Markdown para ficar bem visual. Não economize em usar tabelas ou listas estruturadas."
        ],
        show_tool_calls=False,
        markdown=False
    )
    
    return orquestrador

def salvar_mensagem_historico(usuario_id, remetente, mensagem, sessao_id):
    try:
        chat_historico.insert_one({
            "usuario_id": usuario_id,
            "sessao_id": sessao_id,
            "remetente": remetente,
            "mensagem": mensagem,
            "data": datetime.now()
        })
    except Exception as e:
        print(f"Erro ao salvar historico: {e}")

def buscar_sessoes_chatbot():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401
    
    # Agrupa por sessao_id pegando a primeira mensagem (do user) como titulo
    pipeline = [
        {"$match": {"usuario_id": usuario_id}},
        {"$sort": {"data": 1}},
        {"$group": {
            "_id": "$sessao_id",
            "primeira_mensagem": {"$first": "$mensagem"},
            "data_criacao": {"$first": "$data"}
        }},
        {"$sort": {"data_criacao": -1}}
    ]
    
    sessoes = list(chat_historico.aggregate(pipeline))
    resultado = []
    for s in sessoes:
        titulo = s["primeira_mensagem"][:30] + "..." if len(s["primeira_mensagem"]) > 30 else s["primeira_mensagem"]
        if "Olá! Sou seu Time" in titulo: titulo = "Conversa Padrão"
        resultado.append({
            "sessao_id": s["_id"],
            "titulo": titulo
        })
        
    return jsonify({"sessoes": resultado})

def buscar_historico_chatbot():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401
    
    sessao_id = request.args.get('sessao_id')
    query = {"usuario_id": usuario_id}
    if sessao_id:
        query["sessao_id"] = sessao_id
        
    docs = chat_historico.find(query).sort("data", 1)
    historico = []
    for doc in docs:
        historico.append({
            "remetente": doc["remetente"],
            "mensagem": doc["mensagem"],
            "data": doc["data"].strftime("%d/%m %H:%M")
        })
    return jsonify({"historico": historico})

def limpar_historico_chatbot():
    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401
    
    try:
        sessao_id = request.args.get('sessao_id')
        if sessao_id:
            chat_historico.delete_many({"usuario_id": usuario_id, "sessao_id": sessao_id})
        else:
            chat_historico.delete_many({"usuario_id": usuario_id})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

def perguntar_chatbot():
    try:
        dados = request.get_json()
        mensagem_usuario = dados.get('mensagem')
        sessao_id = dados.get('sessao_id', 'default')
        usuario_id = session.get('usuario_id')
        
        if not mensagem_usuario:
            return jsonify({"erro": "Mensagem não fornecida"}), 400
            
        # Puxa ultimas 6 mensagens da sessão atual para dar memória de curto prazo à IA
        contexto_str = ""
        if usuario_id:
            ultimas_mensagens = chat_historico.find({"usuario_id": usuario_id, "sessao_id": sessao_id}).sort("data", -1).limit(6)
            mensagens_ordenadas = list(ultimas_mensagens)[::-1] # Inverte para ordem cronológica
            for m in mensagens_ordenadas:
                papel = "Usuário" if m["remetente"] == "user" else "Assistente"
                contexto_str += f"{papel}: {m['mensagem']}\n"
                
        # Salva a mensagem atual ANTES de montar o contexto final
        if usuario_id:
            salvar_mensagem_historico(usuario_id, 'user', mensagem_usuario, sessao_id)
            
        orquestrador = obter_time_agentes()
        
        # Envia a mensagem com o contexto da memória embutido
        if contexto_str:
            mensagem_com_memoria = f"Lembre-se do nosso histórico recente:\n{contexto_str}\n\nAgora responda à nova mensagem do Usuário: {mensagem_usuario}"
            resposta = orquestrador.run(mensagem_com_memoria)
        else:
            resposta = orquestrador.run(mensagem_usuario)
        
        if usuario_id:
            # Verifica se gerou um gráfico e salva na galeria
            import re
            from backend.db import galeria
            from datetime import datetime
            
            div_matches = re.finditer(r"<div\s+class=['\"]grafico-ia-render['\"]([^>]*)>", resposta.content)
            for div in div_matches:
                attrs = div.group(1)
                periodo_match = re.search(r"data-periodo=['\"]([^'\"]+)['\"]", attrs)
                tipo_match = re.search(r"data-tipo=['\"]([^'\"]+)['\"]", attrs)
                titulo_match = re.search(r"data-titulo=['\"]([^'\"]+)['\"]", attrs)
                metricas_match = re.search(r"data-metricas=['\"]([^'\"]+)['\"]", attrs)
                
                periodo = periodo_match.group(1) if periodo_match else "30_dias"
                tipo = tipo_match.group(1) if tipo_match else "linha"
                titulo = titulo_match.group(1) if titulo_match else ("Gráfico de " + tipo.capitalize())
                metricas = metricas_match.group(1) if metricas_match else "faturamento,lucro"
                
                galeria.insert_one({
                    "usuario_id": usuario_id,
                    "sessao_id": sessao_id,
                    "periodo": periodo,
                    "tipo": tipo,
                    "titulo": titulo,
                    "metricas": metricas,
                    "criado_em": datetime.now()
                })

            # Salva apenas o conteudo da resposta limpa no historico
            salvar_mensagem_historico(usuario_id, 'bot', resposta.content, sessao_id)
        
        return jsonify({
            "resposta": resposta.content
        })
    except Exception as e:
        print(f"Erro no chatbot: {str(e)}")
        return jsonify({"resposta": "Desculpe, tive um problema técnico ao processar sua pergunta. Tente novamente em instantes."}), 500

def gerar_insight_diario():
    """Gera um pequeno HTML com insights de IA para injetar no dashboard."""
    try:
        periodo = request.args.get('periodo', '30_dias')
        orquestrador = obter_time_agentes()
        
        prompt = (
            f"Gere exatamente 3 bullet points de insights diretos e curtos sobre os meus dados do período ({periodo}). "
            "Use o Analista para buscar os dados, o Cientista para anomalias/previsão, e o Consultor para uma dica de ouro. "
            "Formate a resposta EXATAMENTE com 3 divs HTML, sem markdown extra. "
            "Exemplo: "
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong> Resumo:</strong> Seu faturamento...</p></div>"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong> Alerta:</strong> Suas despesas...</p></div>"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong> Estratégia:</strong> O ponto de...</p></div>"
        )
        
        resposta = orquestrador.run(prompt)
        conteudo = resposta.content
        
        # Limpar crases caso o modelo responda com ```html
        if conteudo.startswith('```html'):
            conteudo = conteudo[7:]
        if conteudo.startswith('```'):
            conteudo = conteudo[3:]
        if conteudo.endswith('```'):
            conteudo = conteudo[:-3]
        
        # Remover asteriscos (formatação markdown)
        conteudo = conteudo.replace('*', '')
            
        return jsonify({"html": conteudo.strip()})
        
    except Exception as e:
        print(f"Erro ao gerar insight diário: {str(e)}")
        fallback = "<div class='p-3 rounded' style='background: var(--cartao);'><p class='p mb-0'><strong>⚠️ Aviso:</strong> Dados insuficientes ou erro ao gerar insight automático. Verifique seu painel de dados.</p></div>"
        return jsonify({"html": fallback})
