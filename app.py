from flask import Flask, render_template, session, redirect, url_for, request, flash, jsonify
from datetime import timedelta
from flask_mail import Mail
from functools import wraps
import os
from dotenv import load_dotenv
#------------------ IMPORTAÇÕES BACKEND ------------------
# Importação user
from backend.user import tela_cadastro, login, esqueceu_senha, verificar_codigo, resetar_senha, reenviar_codigo
# Importação dados
from backend.dados.carregar_dados import carregar_dados
from backend.dados.salvar_dados import salvar_dados_manuais
from backend.dados.apagar_dados import apagar_dados_usuario
from backend.dados.upload_arquivo import upload_arquivo
from backend.dados.exclusao_dados import solicitar_exclusao_dados, confirmar_exclusao_dados, pagina_confirmacao_exclusao
#Importação analise
from backend.analise.analise import analise_por_periodo, obter_ultimo_periodo
# Importação relatorio
from backend.relatorio.gerar_relatorio import gerar_relatorio
from backend.relatorio.pagina_relatorio import pagina_relatorio_pdf as pagina_relatorio_pdf_backend
# Importação perfil
from backend.perfil.pagina_de_perfil import pagina_perfil as pagina_perfil_backend
from backend.perfil.vizualizar_relatorio import vizualizar_relatorio
from backend.perfil.visualizar_analise import visualizar_analise
# Importação home
from backend.home.home import calcular_desempenho, obter_dados_graficos, gerar_status_negocio
from backend.DashBoard.dashboard_rotas import dashboard_page, dashboard_dados
# Importação mapeamento
from backend.dados.mapeamento import obter_mapeamento, salvar_mapeamento
# Importação contato
from backend.contato.contato import enviar_mensagem_contato
# Chatbot Import
from backend.chatbot.chatbot import perguntar_chatbot
load_dotenv()

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
    # Armazenar como atributo do app para acesso em context
    app.mail = mail
    print(f"✓ Flask-Mail inicializado com sucesso!\n")
except Exception as e:
    print(f"✗ Erro ao inicializar Flask-Mail: {str(e)}\n")
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

# =================== LANDING ===================
@app.route("/")
def pagina_landing():
    return render_template("index.html")

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

# =================== MAPEAMENTO ===================
@app.route("/api/mapeamento", methods=["GET"])
@login_required
def get_mapeamento():
    return obter_mapeamento()

@app.route("/api/mapeamento", methods=["POST"])
@login_required
def set_mapeamento():
    return salvar_mapeamento()

# =================== Relatorio ===================
@app.route('/gerar-relatorio', methods=['POST'])
@login_required
def gerar_relatorio_endpoint():
    return gerar_relatorio()


@app.route('/relatorio_pdf')
@login_required
def pagina_relatorio_pdf():
    return pagina_relatorio_pdf_backend()

# ===============DashBoard======================

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

@app.route('/relatorio/visualizar/<int:index>' )
@login_required
def visualizar_relatorio(index):
    return vizualizar_relatorio(index)

@app.route('/analise/visualizar/<int:index>' )
@login_required
def visualizar_analise_route(index):
    return visualizar_analise(index)

# =================== Desempenho ===================
@app.route('/api/desempenho', methods=['GET'])
@login_required
def api_desempenho():
    """Retorna os indicadores de desempenho"""
    periodo = request.args.get('periodo', '30_dias')
    return calcular_desempenho(periodo)


@app.route('/api/graficos', methods=['GET'])
@login_required
def api_graficos():
    """Retorna dados para os gráficos"""
    periodo = request.args.get('periodo', '30_dias')
    return obter_dados_graficos(periodo)

@app.route('/api/status_negocio', methods=['GET'])
@login_required
def api_status_negocio():
    """Retorna o status do negócio analisado"""
    periodo = request.args.get('periodo', '30_dias')
    return gerar_status_negocio(periodo)

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

# =================== IA PAGE ===================
@app.route("/ia")
@login_required
def pagina_ia():
    return render_template("ia.html")

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

@app.route('/api/download/<tipo_arquivo>')
@login_required
def baixar_arquivo_ia(tipo_arquivo):
    from backend.chatbot.chatbot import exportar_dados_usuario
    return exportar_dados_usuario(tipo_arquivo)
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


# =================== RUN ===================
if __name__ == "__main__":
    app.run(debug=True)