# 🚀 Guia de Configuração - DataInsight

## Pré-requisitos

- Python 3.8+
- MongoDB (Atlas ou local)
- pip (gerenciador de pacotes Python)

## 1️⃣ Instalação de Dependências

1. Abra o terminal no diretório do projeto
2. Execute:

```bash
pip install -r requirements.txt
```

### Pacotes Instalados:
- **Flask** - Framework web
- **pymongo** - Driver MongoDB
- **bcrypt** - Hash de senhas
- **certifi** - Certificados SSL para MongoDB

## 2️⃣ Configurar MongoDB

### Opção A: MongoDB Atlas (Nuvem - Recomendado)

1. Acesse [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crie uma conta e cluster
3. Vá em **Database > Connect**
4. Copie a string de conexão
5. Abra [`db.py`](db.py) e atualize a variável `uri`:

```python
uri = "sua_string_de_conexao_aqui"
```

### Opção B: MongoDB Local

```bash
# No Windows com MongoDB instalado
mongod

# Então, em db.py, use:
uri = "mongodb://localhost:27017/"
```

## 3️⃣ Inicializar o Banco de Dados

Execute para criar o índice de email:

```bash
python db.py
```

## 4️⃣ Executar a Aplicação

```bash
python app.py
```

A aplicação estará disponível em: **http://localhost:5000**

## 📋 Fluxo de Uso

### 1. Landing Page (Pública)
- Acesse: http://localhost:5000/index.html
- Veja os benefícios e recursos

### 2. Registro de Usuário
- Clique em "Começar Grátis" ou acesse `/cadastro`
- Preencha:
  - Nome
  - Email (único)
  - Senha (mínimo 8 caracteres)
  - Confirme a senha
- ✅ Sucesso! Será redirecionado para login

### 3. Login
- Acesse `/` ou http://localhost:5000/
- Preencha email e senha
- ✅ Autenticado! Acesso ao dashboard

### 4. Dashboard e Funcionalidades
- **Home**: Visão geral com gráficos
- **Dados**: Tabela de dados
- **Dashboard**: Gráficos avançados
- **Análises**: Análise de dados
- **Relatórios**: Gerar relatórios
- **Perfil**: Dados pessoais
- **Configurações**: Ajustes
- **Sair**: Logout seguro

## 🔒 Segurança Implementada

✅ **Login Obrigatório** - Todas as rotas protegidas exigem autenticação
✅ **Sessão** - Rastreamento seguro com Flask sessions
✅ **Hash de Senha** - Bcrypt com salt
✅ **Validações** - Email, força de senha, confirmação
✅ **Proteção de Rota** - Decorator `@login_required`

## 🐛 Troubleshooting

### ❌ "Erro de conexão com MongoDB"
- Verifique a string `uri` em `db.py`
- Confirme que o IP está whitelisted no MongoDB Atlas
- Verifique sua conexão com internet

### ❌ "Email ou senha incorretos"
- Confirme que registrou o email corretamente
- Verifique se tem epaços antes/depois do email
- Tente criar uma nova conta

### ❌ "Erro 404 - Não encontrado"
- Certifique-se que está usando `url_for()` nos links HTML
- Verifique o nome da rota em `app.py`

## 📝 Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `app.py` | Rotas e configuração do Flask |
| `db.py` | Conexão com MongoDB |
| `functions.py` | Lógica de autenticação e cadastro |
| `requirements.txt` | Dependências |
| `templates/` | Arquivos HTML |
| `static/` | CSS, JS, imagens |

## 🎨 Personalizações Recomendadas

1. **Mudar a chave secreta** em `app.py`:
   ```python
   app.secret_key = "sua_chave_secreta_aleatoria"
   ```

2. **Adicionar mais páginas** seguindo o padrão:
   ```python
   @app.route("/novapagina")
   @login_required
   def pagina_nova():
       return render_template("novapagina.html")
   ```

3. **Adicionar database fields** em `functions.py`:
   ```python
   usuario.update_one(
       {"email": email},
       {"$set": {"novo_campo": valor}}
   )
   ```

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- [Flask Docs](https://flask.palletsprojects.com/)
- [PyMongo Docs](https://pymongo.readthedocs.io/)
- [MongoDB Docs](https://docs.mongodb.com/)

---

**Versão**: 1.0
**Última atualização**: Março 2026
