import os
import traceback
from datetime import timedelta
from functools import wraps

import mercadopago
from dotenv import load_dotenv
from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_mail import Mail

# Load environment variables early so backend modules can read them on import
load_dotenv()

# ------------------ IMPORTAÇÕES BACKEND ------------------
# Importação user
from backend.user import (
    esqueceu_senha,
    login,
    reenviar_codigo,
    resetar_senha,
    tela_cadastro,
    verificar_codigo,
)

# Importação dados
from backend.dados.apagar_dados import apagar_dados_usuario
from backend.dados.carregar_dados import carregar_dados
from backend.dados.exclusao_dados import (
    confirmar_exclusao_dados,
    pagina_confirmacao_exclusao,
    solicitar_exclusao_dados,
)
from backend.dados.salvar_dados import salvar_dados_manuais
from backend.dados.upload_arquivo import listar_abas_excel, upload_arquivo
from backend.dados.tabelas import (
    listar_todas_tabelas,
    obter_tabela,
    salvar_tabela_especifica,
    renomear_tabela_api,
    duplicar_tabela_api,
    excluir_tabela_api,
    ativar_tabela_api,
    definir_dominio_tabela,
    obter_sumario_planilhas,
)
from backend.dados.quality import api_analisar_dados, api_limpar_dados

# Importação analise
from backend.analise.analise import analise_por_periodo, obter_ultimo_periodo

# Importação relatorio
from backend.relatorio.gerar_relatorio import gerar_relatorio
from backend.relatorio.pagina_relatorio import (
    pagina_relatorio_pdf as pagina_relatorio_pdf_backend,
)

# Importação perfil
from backend.perfil.pagina_de_perfil import pagina_perfil as pagina_perfil_backend
from backend.perfil.visualizar_analise import visualizar_analise
from backend.perfil.vizualizar_relatorio import vizualizar_relatorio

# Importação home
from backend.DashBoard.dashboard_rotas import dashboard_dados, dashboard_page
from backend.home.home import (
    calcular_desempenho,
    gerar_status_negocio,
    obter_dados_graficos,
    obter_detalhes_kpi,
    obter_produtos_overview,
)

# Importação mapeamento
from backend.dados.mapeamento import (
    obter_mapeamento,
    salvar_mapeamento,
    obter_mapeamento_financeiro,
    salvar_mapeamento_financeiro,
    analisar_colunas_financeiras,
    preview_financeiro,
    criar_coluna_financeira_api,
)

# Importação contato
from backend.contato.contato import enviar_mensagem_contato

# Importação pagamento
from backend.pagamento.criar_assinatura import (
    criar_assinatura_stripe,
    verificar_token_stripe,
)

# Chatbot Import
from backend.chatbot.chatbot import (
    buscar_ultima_resposta_chatbot,
    perguntar_chatbot,
    sintetizar_texto_voz,
)

# Importação produtos
from backend.produtos import (
    buscar_produtos_por_nome,
    deletar_produto,
    listar_produtos,
    obter_categorias,
    obter_estatisticas_produtos,
    obter_produto_exato,
    salvar_produto,
)
from backend.planejamento.planejamento_financeiro import obter_planejamento_financeiro
from backend.fluxoCaixa.fluxo_caixa import obter_dados_fluxo_caixa


key = os.getenv('SECRET_KEY')

app = Flask(__name__)
app.secret_key = key

# =================== EMAIL ===================
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv("EMAIL_USER")
app.config['MAIL_PASSWORD'] = os.getenv("EMAIL_PASS")
app.config['MAIL_DEFAULT_SENDER'] = os.getenv("EMAIL_USER")

# Configurações adicionais para Gmail
app.config['MAIL_MAX_EMAILS'] = 5
app.config['MAIL_SUPPRESS_SEND'] = False  # Não suprimir envio
app.config['TESTING'] = False  # Desativar modo teste

# Inicializar Flask-Mail
try:
    mail = Mail(app)
    app.mail = mail
    print("Flask-Mail initialized successfully.\n")
except Exception as e:
    print("Error initializing Flask-Mail: " + str(e) + "\n")
    mail = None

# =================== UPLOAD ===================
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Configuração de Sessão (Lembrar de mim)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)


# =================== PROTEÇÃO ===================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'usuario_nome' not in session:
            return redirect(url_for('pagina_login'))
        return f(*args, **kwargs)

    return decorated_function


# =================== LANDING & ASSINATURAS ===================
@app.route("/")
def pagina_landing():
    return render_template("index.html")


@app.route("/assinaturas", endpoint="pagina_assinaturas")
def pagina_assinaturas():
    block_plans = True
    return render_template(
        "sistema_pagamento/assinaturas.html", block_plans=block_plans
    )


@app.route("/criar-assinatura", methods=['POST'])
@app.route("/criar-preferencia", methods=['POST'])
def rota_criar_assinatura():
    return criar_assinatura_stripe()


@app.route('/sucesso-pagamento', endpoint="sucesso_pagamento")
def sucesso_pagamento():
    preapproval_id = request.args.get('preapproval_id') or request.args.get(
        'payment_id'
    )
    status = request.args.get('status') or 'Aprovado'
    return render_template(
        'sistema_pagamento/sucesso.html',
        preapproval_id=preapproval_id,
        status=status,
    )


@app.route('/falha-pagamento', endpoint="falha_pagamento")
def falha_pagamento():
    return render_template('sistema_pagamento/falha.html')


@app.route('/webhook-pagamento', methods=['POST'])
def webhook_pagamento():
    data = request.get_json() or {}
    if data.get("type") == "subscription_preapproval":
        preapproval_id = data.get("data", {}).get("id")
        mp_token = os.getenv('MP_ACCESS_TOKEN') or os.getenv('MERCADOPAGO_ACCESS_TOKEN')
        if mp_token and preapproval_id:
            try:
                sdk = mercadopago.SDK(mp_token)
                info = sdk.preapproval().get(preapproval_id)
                status = info.get("response", {}).get("status")
                print(f"Status da assinatura {preapproval_id}: {status}")
            except Exception as e:
                print(f"Erro ao consultar assinatura no webhook: {e}")
    return jsonify({"status": "ok"}), 200


@app.route('/verificar-token-mp', methods=['GET'])
def rota_verificar_token_mp():
    """Rota de diagnóstico para checar se a chave Stripe está válida."""
    return verificar_token_stripe()


# =================== LOGIN ===================
@app.route("/login")
def pagina_login():
    if 'usuario_nome' in session:
        return redirect(url_for('pagina_home'))
    return render_template("login.html")


# =================== ROTAS ===================
@app.route("/home")
@login_required
def pagina_home():
    return render_template("home.html")


@app.route("/analises")
@login_required
def pagina_analise():
    return render_template("analises.html")

@app.route("/planejamento-financeiro")
@login_required
def pagina_planejamento_financeiro():
    return render_template("analise_planejamento_adaptado.html")

@app.route("/fluxo-caixa", endpoint="pagina_fluxo_caixa")
@app.route("/fluxo_caixa")
@login_required
def pagina_fluxo_caixa():
    return render_template("fluxo_caixa.html")

@app.route("/graficos-avancados")
@login_required
def pagina_graficoAvancado():
    return render_template("graficos-avancados.html")


@app.route("/config")
@login_required
def pagina_configuracoes():
    return render_template("configuracoes.html")


@app.route("/dados")
@login_required
def pagina_dados():
    return render_template("dados.html")


@app.route("/relatorios")
@login_required
def pagina_relatorio():
    return render_template("relatorios.html")


@app.route("/contato")
@login_required
def pagina_contato():
    return render_template("contato.html")


@app.route("/contato2")
@login_required
def pagina_contato2():
    return render_template("sistema_pagamento/pagina_contato2.html")


@app.route("/enviar-contato", methods=["POST"])
@login_required
def enviar_contato():
    """Envia a mensagem de contato"""
    return enviar_mensagem_contato()


@app.route("/termos/termos_de_uso")
def pagina_termos_uso():
    return render_template("termos/termos_de_uso.html")


# =================== AÇÕES Cadastro ===================
@app.route("/cadastro", methods=["GET", "POST"])
def pg_cadastro():
    return tela_cadastro()


@app.route("/login", methods=["POST"])
def pg_login():
    return login()


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for('pagina_login'))


# =================== ESQUECEU SENHA ===================
@app.route("/esqueceu-senha", methods=["GET", "POST"])
def esqueceu_senha_route():
    return esqueceu_senha()


# =================== CARREGAR DADOS ===================
@app.route("/carregar-dados", methods=["GET"])
@login_required
def carregar_dados_usuario():
    """Carrega os últimos dados salvos do usuário"""
    return carregar_dados()


# =================== SALVAR DADOS MANUAIS ===================
@app.route("/salvar-dados", methods=["POST"])
@login_required
def salvar_dados_usuario():
    """Salva os dados enviados pelo usuário"""
    return salvar_dados_manuais()


# =================== APAGAR DADOS ===================
@app.route("/apagar-dados", methods=["DELETE"])
@login_required
def apagar_dados():
    """Deleta os últimos dados salvos do usuário"""
    return apagar_dados_usuario()


# =================== SOLICITAR EXCLUSÃO DE DADOS ===================
@app.route("/solicitar-exclusao-dados", methods=["POST"])
@login_required
def solicitar_exclusao():
    """Solicita a exclusão de dados enviando email de confirmação"""
    return solicitar_exclusao_dados()


# =================== CONFIRMAR EXCLUSÃO DE DADOS ===================
@app.route("/confirmar-exclusao", methods=["GET"])
@login_required
def confirmar_exclusao():
    """Página de confirmação de exclusão de dados"""
    return pagina_confirmacao_exclusao()


@app.route("/processar-exclusao", methods=["POST"])
@login_required
def processar_exclusao():
    """Processa a confirmação de exclusão de dados"""
    return confirmar_exclusao_dados()


# =================== UPLOAD ARQUIVO ===================
@app.route("/upload", methods=["POST"])
@login_required
def upload():
    """Faz upload do arquivo e salva os dados no banco de dados"""
    return upload_arquivo()


@app.route("/upload/abas", methods=["POST"])
@login_required
def upload_listar_abas():
    """Lista as abas de um arquivo Excel sem importar os dados"""
    return listar_abas_excel()


# =================== MÚLTIPLAS TABELAS (SISTEMA DE ABAS) ===================
@app.route("/api/tabelas", methods=["GET"])
@login_required
def api_listar_tabelas():
    """Retorna todas as tabelas do usuário"""
    return listar_todas_tabelas()


@app.route("/api/tabelas/<tabela_id>", methods=["GET"])
@login_required
def api_obter_tabela(tabela_id):
    """Retorna os dados de uma tabela específica"""
    return obter_tabela(tabela_id)


@app.route("/api/tabelas", methods=["POST"])
@login_required
def api_salvar_tabela():
    """Cria ou atualiza uma tabela específica"""
    return salvar_tabela_especifica()


@app.route("/api/tabelas/<tabela_id>/renomear", methods=["PUT"])
@login_required
def api_renomear_tabela(tabela_id):
    """Renomeia uma tabela específica"""
    return renomear_tabela_api(tabela_id)


@app.route("/api/tabelas/<tabela_id>/duplicar", methods=["POST"])
@login_required
def api_duplicar_tabela(tabela_id):
    """Duplica uma tabela específica"""
    return duplicar_tabela_api(tabela_id)


@app.route("/api/tabelas/<tabela_id>", methods=["DELETE"])
@login_required
def api_excluir_tabela(tabela_id):
    """Exclui uma tabela específica"""
    return excluir_tabela_api(tabela_id)


@app.route("/api/tabelas/<tabela_id>/ativar", methods=["POST"])
@login_required
def api_ativar_tabela(tabela_id):
    """Marca uma tabela específica como ativa no MongoDB"""
    return ativar_tabela_api(tabela_id)


@app.route("/api/planilhas/sumario", methods=["GET"])
@login_required
def api_obter_sumario_planilhas():
    """Retorna lista sumária de todas as planilhas do usuário para seletores de contexto"""
    return obter_sumario_planilhas()


@app.route("/api/tabelas/<tabela_id>/dominio", methods=["PUT"])
@login_required
def api_definir_dominio_tabela(tabela_id):
    """Atualiza o domínio/categoria de uma planilha salva"""
    return definir_dominio_tabela(tabela_id)


# =================== QUALIDADE E LIMPEZA DE DADOS ===================
@app.route("/api/dados/analisar", methods=["POST"])
@login_required
def rota_analisar_dados():
    """Analisa a qualidade e detecta problemas nos dados"""
    return api_analisar_dados()


@app.route("/api/dados/limpar", methods=["POST"])
@login_required
def rota_limpar_dados():
    """Aplica limpeza e sanitização científica dos dados e persiste no banco"""
    return api_limpar_dados()


# =================== MAPEAMENTO ===================
@app.route("/api/mapeamento", methods=["GET"])
@login_required
def get_mapeamento():
    return obter_mapeamento()


@app.route("/api/mapeamento", methods=["POST"])
@login_required
def set_mapeamento():
    return salvar_mapeamento()


# =================== MAPEAMENTO FINANCEIRO ===================
@app.route("/api/planejamento-financeiro", methods=["GET"])
@login_required
def get_planejamento_financeiro():
    """Retorna o planejamento financeiro"""
    return obter_planejamento_financeiro()


@app.route("/api/fluxo-caixa", methods=["GET"])
@login_required
def get_fluxo_caixa():
    """Retorna dados processados do fluxo de caixa"""
    return obter_dados_fluxo_caixa()


@app.route("/api/mapeamento-financeiro", methods=["GET"])
@login_required
def get_mapeamento_financeiro():
    """Retorna mapeamento financeiro + completude + recomendações"""
    return obter_mapeamento_financeiro()


@app.route("/api/mapeamento-financeiro", methods=["POST"])
@login_required
def set_mapeamento_financeiro():
    """Salva mapeamento financeiro expandido"""
    return salvar_mapeamento_financeiro()


@app.route("/api/mapeamento-financeiro/analisar", methods=["POST"])
@login_required
def api_analisar_colunas_financeiras():
    """Analisa automaticamente as colunas e sugere categorias financeiras"""
    return analisar_colunas_financeiras()


@app.route("/api/mapeamento-financeiro/preview", methods=["POST"])
@login_required
def api_preview_financeiro():
    """Calcula preview de indicadores financeiros com o mapeamento atual"""
    return preview_financeiro()


@app.route("/api/mapeamento-financeiro/criar-coluna", methods=["POST"])
@login_required
def api_criar_coluna_financeira():
    """Cria uma coluna na base e atualiza o mapeamento financeiro"""
    return criar_coluna_financeira_api()



# =================== Relatorio ===================
@app.route('/gerar-relatorio', methods=['POST'])
@login_required
def gerar_relatorio_endpoint():
    return gerar_relatorio()


@app.route('/relatorio_pdf')
@login_required
def pagina_relatorio_pdf():
    return pagina_relatorio_pdf_backend()


# =============== DashBoard ======================


@app.route("/dashboard")
@login_required
def pagina_dashboard():
    return dashboard_page()


@app.route("/dashboard/dados", methods=["GET"])
@login_required
def api_dashboard_dados():
    return dashboard_dados()


# =================== Perfil ===================
@app.route("/perfil")
@login_required
def pagina_perfil():
    return pagina_perfil_backend()


@app.route('/relatorio/visualizar/<int:index>')
@login_required
def visualizar_relatorio(index):
    return vizualizar_relatorio(index)


@app.route('/analise/visualizar/<int:index>')
@login_required
def visualizar_analise_route(index):
    return visualizar_analise(index)


# =================== Desempenho ===================
@app.route('/api/desempenho', methods=['GET'])
@login_required
def api_desempenho():
    """Retorna os indicadores de desempenho"""
    periodo = request.args.get('periodo', '30_dias')
    tabela_id = request.args.get('tabela_id', 'todas')
    return calcular_desempenho(periodo, tabela_id)


@app.route('/api/desempenho/detalhe', methods=['GET'])
@login_required
def api_desempenho_detalhe():
    """Retorna detalhamento dos KPIs para modal"""
    periodo = request.args.get('periodo', '30_dias')
    kpi = request.args.get('kpi', 'faturamento')
    tabela_id = request.args.get('tabela_id', 'todas')
    return obter_detalhes_kpi(periodo, kpi, tabela_id)


@app.route('/api/graficos', methods=['GET'])
@login_required
def api_graficos():
    """Retorna dados para os gráficos"""
    periodo = request.args.get('periodo', '30_dias')
    tabela_id = request.args.get('tabela_id', 'todas')
    return obter_dados_graficos(periodo, tabela_id)


@app.route('/api/produtos/overview', methods=['GET'])
@login_required
def api_produtos_overview():
    periodo = request.args.get('periodo', '30_dias')
    tabela_id = request.args.get('tabela_id', 'todas')
    return obter_produtos_overview(periodo, tabela_id)


@app.route('/api/status_negocio', methods=['GET'])
@login_required
def api_status_negocio():
    """Retorna o status do negócio analisado"""
    periodo = request.args.get('periodo', '30_dias')
    tabela_id = request.args.get('tabela_id', 'todas')
    return gerar_status_negocio(periodo, tabela_id)


@app.route('/api/galeria/listar', methods=['GET'])
@login_required
def api_galeria_listar():
    from backend.db import galeria

    user_id = session.get('usuario_id')
    periodo_filtro = request.args.get('periodo', None)

    query = {"usuario_id": user_id}
    if periodo_filtro and periodo_filtro != 'todos':
        query["periodo"] = periodo_filtro

    graficos = list(galeria.find(query).sort("criado_em", -1).limit(50))
    for g in graficos:
        g['_id'] = str(g['_id'])
    return jsonify(graficos)


@app.route('/api/analise', methods=['GET'])
@login_required
def api_analise():
    return analise_por_periodo()


@app.route('/api/ultimo-periodo', methods=['GET'])
@login_required
def ultimo_periodo():
    return obter_ultimo_periodo()


# =================== IA PAGE & ASSISTENTE VIRTUAL ===================
@app.route("/ia")
@login_required
def pagina_ia():
    return render_template("ia.html")


@app.route("/assistente-virtual", endpoint="pagina_assistente_virtual")
@app.route("/assistente", endpoint="pagina_assistente")
@login_required
def pagina_assistente_virtual():
    return render_template("assistente_virtual.html")


@app.route("/api/download/<tipo>")
@login_required
def api_download_arquivo(tipo):
    from backend.chatbot.chatbot import exportar_dados_usuario

    return exportar_dados_usuario(tipo)


# =================== Chatbot API ===================
@app.route('/api/chatbot/perguntar', methods=['POST'])
@login_required
def perguntar():
    return perguntar_chatbot()


@app.route('/api/chatbot/sintetizar', methods=['POST'])
@login_required
def api_chatbot_sintetizar():
    dados = request.get_json() or {}
    texto = (dados.get('texto') or '').strip()
    if not texto:
        return jsonify({"erro": "Texto não fornecido."}), 400

    try:
        resposta_voz = sintetizar_texto_voz(texto)
    except Exception as e:
        print('Erro no endpoint /api/chatbot/sintetizar:', e)
        traceback.print_exc()
        return jsonify({
            "resposta_voz_base64": None,
            "resposta_voz_mimetype": None,
            "erro": "Falha interna ao sintetizar áudio",
        }), 200

    if not resposta_voz:
        return jsonify({
            "resposta_voz_base64": None,
            "resposta_voz_mimetype": None,
            "erro": "TTS indisponível",
        }), 200

    try:
        b64, mimetype = resposta_voz
    except Exception:
        b64, mimetype = (resposta_voz, 'audio/wav')

    return jsonify({"resposta_voz_base64": b64, "resposta_voz_mimetype": mimetype}), 200


@app.route('/api/chatbot/sessoes', methods=['GET'])
@login_required
def api_sessoes_chatbot():
    from backend.chatbot.chatbot import buscar_sessoes_chatbot

    return buscar_sessoes_chatbot()


@app.route('/api/chatbot/historico', methods=['GET'])
@login_required
def api_historico_chat():
    from backend.chatbot.chatbot import buscar_historico_chatbot

    return buscar_historico_chatbot()


@app.route('/api/chatbot/ultima-resposta', methods=['GET'])
@login_required
def api_ultima_resposta_chatbot():
    return buscar_ultima_resposta_chatbot()


@app.route('/api/chatbot/historico/apagar', methods=['DELETE'])
@login_required
def api_apagar_historico():
    from backend.chatbot.chatbot import limpar_historico_chatbot

    return limpar_historico_chatbot()


@app.route('/api/insight_diario', methods=['GET'])
@login_required
def api_insight_diario():
    from backend.chatbot.chatbot import gerar_insight_diario

    return gerar_insight_diario()


# =================== PRODUTOS - AUTOCOMPLETE ===================


@app.route('/api/produtos/buscar', methods=['GET'])
@login_required
def api_buscar_produtos():
    """Busca produtos por nome com autocomplete"""
    termo = request.args.get('termo', '').strip()
    limite = request.args.get('limite', 10, type=int)
    user_id = session.get('usuario_id')

    if not termo:
        return jsonify({"erro": "Termo de busca obrigatório"}), 400

    try:
        produtos = buscar_produtos_por_nome(user_id, termo, limite)
        return jsonify({"sucesso": True, "produtos": produtos})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/obter/<nome_produto>', methods=['GET'])
@login_required
def api_obter_produto(nome_produto):
    """Obtém dados completos de um produto específico"""
    user_id = session.get('usuario_id')

    try:
        produto = obter_produto_exato(user_id, nome_produto)
        if produto:
            return jsonify({"sucesso": True, "produto": produto})
        else:
            return (
                jsonify({"sucesso": False, "erro": "Produto não encontrado"}),
                404,
            )
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/salvar', methods=['POST'])
@login_required
def api_salvar_produto():
    """Salva ou atualiza um produto no histórico"""
    user_id = session.get('usuario_id')
    dados = request.get_json()

    if not dados or not dados.get('nome_produto'):
        return jsonify({"erro": "nome_produto obrigatório"}), 400

    try:
        produto_id = salvar_produto(
            usuario_id=user_id,
            nome_produto=dados.get('nome_produto'),
            categoria=dados.get('categoria'),
            preco=dados.get('preco'),
            estoque=dados.get('estoque'),
            sku=dados.get('sku'),
            descricao=dados.get('descricao'),
        )
        return jsonify({"sucesso": True, "produto_id": produto_id})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/listar', methods=['GET'])
@login_required
def api_listar_produtos():
    """Lista todos os produtos do usuário"""
    user_id = session.get('usuario_id')
    pagina = request.args.get('pagina', 1, type=int)
    limite = request.args.get('limite', 50, type=int)

    skip = (pagina - 1) * limite

    try:
        produtos = listar_produtos(user_id, limite=limite, skip=skip)
        total = obter_estatisticas_produtos(user_id)["total"]
        return jsonify({
            "sucesso": True,
            "produtos": produtos,
            "total": total,
            "pagina": pagina,
        })
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/categorias', methods=['GET'])
@login_required
def api_obter_categorias():
    """Obtém lista de categorias cadastradas"""
    user_id = session.get('usuario_id')

    try:
        categorias = obter_categorias(user_id)
        return jsonify({"sucesso": True, "categorias": categorias})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/deletar/<produto_id>', methods=['DELETE'])
@login_required
def api_deletar_produto(produto_id):
    """Deleta um produto do histórico"""
    user_id = session.get('usuario_id')

    try:
        if deletar_produto(user_id, produto_id):
            return jsonify({"sucesso": True})
        else:
            return (
                jsonify({"sucesso": False, "erro": "Produto não encontrado"}),
                404,
            )
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@app.route('/api/produtos/estatisticas', methods=['GET'])
@login_required
def api_estatisticas_produtos():
    """Retorna estatísticas dos produtos"""
    user_id = session.get('usuario_id')

    try:
        stats = obter_estatisticas_produtos(user_id)
        return jsonify({"sucesso": True, "estatisticas": stats})
    except Exception as e:
        return jsonify({"erro": str(e)}), 500


# ============ Verificar Senha =================
@app.route('/verificar_codigo', methods=['GET', 'POST'])
def verificar_codigo_route():
    return verificar_codigo()


# ============ resetar Senha =================
@app.route('/resetar_senha', methods=['GET', 'POST'])
def resetar_senha_route():
    return resetar_senha()


# ============ reenviar codigo =================
@app.route('/reenviar-codigo')
def route_reenviar_codigo():
    """Reenvia o código de recuperação para o email"""
    return reenviar_codigo()


# =================== PLANEJAMENTO FINANCEIRO IA ENDPOINT ===================
@app.route("/api/planejamento-financeiro/analise-ia", methods=["POST"])
@login_required
def api_analise_ia_planejamento():
    """Gera análise de IA para o planejamento financeiro baseado nos dados da tabela"""
    import re
    import json
    from backend.chatbot.chatbot import obter_time_agentes
    
    try:
        dados_req = request.get_json() or {}
        scenario = dados_req.get("scenario", "otimista")
        ia_data = dados_req.get("data")
        
        if not ia_data:
            return jsonify({"sucesso": False, "mensagem": "Dados do planejamento não fornecidos."}), 400
            
        totals = ia_data.get("totals", {})
        meses = ia_data.get("meses", [])
        best = ia_data.get("best")
        worst = ia_data.get("worst")
        meses_pos = ia_data.get("mesesPos", 0)
        
        # Formatar valores monetários e percentuais para a IA
        def format_brl(val):
            try:
                n = float(val)
                return f"R$ {n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            except:
                return "R$ 0,00"
                
        def format_pct(val):
            try:
                n = float(val)
                return f"{n:.1f}%".replace(".", ",")
            except:
                return "0,0%"

        receita_total = format_brl(totals.get("receita", 0))
        impostos_total = format_brl(totals.get("impostos", 0))
        variaveis_total = format_brl(totals.get("variaveis", 0))
        gastos_fixos_total = format_brl(totals.get("fixos", 0))
        margem_total = format_brl(totals.get("margem", 0))
        margem_pct_total = format_pct(totals.get("margemPct", 0))
        investimentos_total = format_brl(totals.get("investimentos", 0))
        resultado_total = format_brl(totals.get("resultado", 0))
        
        detalhes_mensais_list = []
        for m in meses:
            detalhes_mensais_list.append(
                f"- {m.get('mes')}: Receita: {format_brl(m.get('receita'))} | "
                f"Var: {format_brl(m.get('variaveis'))} | "
                f"Fix: {format_brl(m.get('fixos'))} | "
                f"Res: {format_brl(m.get('resultado'))}"
            )
        detalhes_mensais_str = "\n".join(detalhes_mensais_list)
        
        prompt = f"""Você é um analista financeiro sênior da equipe DataInsight.
Analise os dados reais do Planejamento Financeiro do cliente (Cenário: {scenario}):

RESUMO ANUAL:
- Faturamento / Receita Total: {receita_total}
- Impostos Totais: {impostos_total}
- Gastos Variáveis Totais: {variaveis_total}
- Gastos Fixos Totais: {gastos_fixos_total}
- Margem de Contribuição Total: {margem_total} ({margem_pct_total})
- Investimentos Totais: {investimentos_total}
- Resultado Líquido Projetado: {resultado_total}
- Meses no Azul / Positivos: {meses_pos}/{len(meses)}
"""
        if best:
            prompt += f"- Melhor Mês: {best.get('mes')} ({format_brl(best.get('resultado'))})\n"
        if worst:
            prompt += f"- Pior Mês: {worst.get('mes')} ({format_brl(worst.get('resultado'))})\n"
            
        prompt += f"""
DETALHAMENTO MENSAL:
{detalhes_mensais_str}

Com base nestes dados reais da Tabela Mensal, faça um diagnóstico financeiro executivo estruturado.
Você deve retornar obrigatoriamente um objeto JSON válido, contendo exatamente os três campos descritos abaixo.
Atenção: Não utilize markdown (como ```json) ou qualquer texto antes/depois do JSON. Retorne apenas o JSON puro para que possamos fazer o parsing diretamente.

Formato do JSON esperado:
{{
  "diagnostico_geral": "Um diagnóstico resumido e profissional da saúde financeira geral para este cenário. Use termos técnicos e seja analítico (limite de 3 a 4 linhas).",
  "alertas_riscos": "Indique os pontos críticos, custos elevados, meses com prejuízo ou ameaças específicas encontradas nos dados mensais (limite de 3 a 4 linhas).",
  "recomendacoes": [
    "Recomendação prática 1 baseada nos dados",
    "Recomendação prática 2 baseada nos dados",
    "Recomendação prática 3 baseada nos dados"
  ]
}}
"""
        orquestrador = obter_time_agentes()
        diagnostico = ""
        alertas = ""
        recoms = []
        
        success = False
        try:
            resposta_obj = orquestrador.run(prompt)
            resposta_texto = resposta_obj.content.strip()
            
            # Limpar formatações do markdown se houver
            if resposta_texto.startswith("```"):
                resposta_texto = re.sub(r"^```(?:json)?\n?", "", resposta_texto, flags=re.IGNORECASE)
                resposta_texto = re.sub(r"\n?```$", "", resposta_texto)
            
            resposta_texto = resposta_texto.strip()
            
            parsed = json.loads(resposta_texto)
            diagnostico = parsed.get("diagnostico_geral", "")
            alertas = parsed.get("alertas_riscos", "")
            recoms = parsed.get("recomendacoes", [])
            if diagnostico and alertas and len(recoms) >= 3:
                success = True
        except Exception as e:
            print("[Erro ao chamar / processar Gemini para Análise de Planejamento]:", e)
            
        if not success:
            # Fallback determinístico
            val_receita = totals.get("receita", 0)
            val_resultado = totals.get("resultado", 0)
            
            diagnostico = (
                f"Análise executiva simplificada: O cenário {scenario} projeta uma receita total de "
                f"{receita_total} e resultado líquido anual de {resultado_total}, com uma margem de contribuição "
                f"média de {margem_pct_total}. O desempenho operacional se mostra "
                f"{'saudável e superavitário' if val_resultado >= 0 else 'deficitário no acumulado do ano'}."
            )
            
            if val_resultado < 0:
                alertas = (
                    f"Risco de déficit financeiro anual acumulado em {format_brl(abs(val_resultado))}. "
                    f"A operação não está conseguindo cobrir todos os gastos fixos e variáveis projetados."
                )
            else:
                alertas = (
                    f"Apesar do resultado positivo, monitore a sazonalidade. "
                    f"Existem {len(meses) - meses_pos} meses projetados no vermelho que exigem atenção ao fluxo de caixa."
                    if meses_pos < len(meses) else
                    "Operação estável com todos os meses projetados em superávit."
                )
                
            recoms = [
                "Rever a precificação e buscar otimizar a margem de contribuição nos meses de menor movimento.",
                "Estabelecer um controle rigoroso sobre os gastos fixos para diminuir o ponto de equilíbrio operacional.",
                "Planejar a alocação de investimentos de expansão somente após a confirmação de meses com sobra de caixa."
            ]
            
        return jsonify({
            "sucesso": True,
            "diagnostico_geral": diagnostico,
            "alertas_riscos": alertas,
            "recomendacoes": recoms
        })
        
    except Exception as e:
        print("[Erro Rota IA Planejamento]:", e)
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": str(e)}), 500


# =================== RUN ===================
if __name__ == "__main__":
    app.run(debug=True)
