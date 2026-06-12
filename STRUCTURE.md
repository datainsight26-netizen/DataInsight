# Estrutura do Projeto DataInsight 2.0

```
DataInsight/
│
├── app.py                          # Aplicação Flask principal
├── requirements.txt                # Dependências do projeto
├── docker-compose.yml              # Configuração Docker Compose
├── Dockerfile                      # Configuração Docker
├── iniciar.bat                     # Script para iniciar a aplicação (Windows)
├── .env.example                    # Exemplo de variáveis de ambiente
├── .dockerignore                   # Arquivos ignorados no Docker
├── .gitignore                      # Arquivos ignorados no Git
├── README.md                       # Documentação do projeto
├── SETUP.md                        # Guia de configuração
├── STRUCTURE.md                    # Este arquivo (estrutura do projeto)
│
├── backend/                        # Backend da aplicação
│   ├── __init__.py
│   ├── db.py                       # Configuração e gerenciamento de banco de dados
│   ├── user.py                     # Rotas e lógica de usuário (login, cadastro, senha)
│   │
│   ├── dados/                      # Módulo de gerenciamento de dados
│   │   ├── __init__.py
│   │   ├── dados.py                # Gerenciamento de dados
│   │   ├── carregar_dados.py       # Carregamento de dados
│   │   ├── salvar_dados.py         # Salvamento de dados manuais
│   │   ├── apagar_dados.py         # Exclusão de dados
│   │   ├── upload_arquivo.py       # Upload de arquivos
│   │   ├── exclusao_dados.py       # Processamento de exclusão
│   │   ├── mapeamento.py           # Mapeamento de colunas
│   │   └── (outros arquivos de dados)
│   │
│   ├── analise/                    # Módulo de análises
│   │   ├── __init__.py
│   │   └── analise.py              # Análises por período
│   │
│   ├── perfil/                     # Módulo de perfil do usuário
│   │   ├── __init__.py
│   │   ├── pagina_de_perfil.py     # Página de perfil
│   │   ├── visualizar_analise.py   # Visualização de análises
│   │   └── vizualizar_relatorio.py # Visualização de relatórios
│   │
│   ├── relatorio/                  # Módulo de relatórios
│   │   ├── __init__.py
│   │   ├── gerar_relatorio.py      # Geração de relatórios
│   │   └── pagina_relatorio.py     # Página de relatórios
│   │
│   ├── home/                       # Módulo da página inicial
│   │   ├── __init__.py
│   │   └── home.py                 # Lógica da página home
│   │
│   ├── DashBoard/                  # Módulo de dashboard
│   │   ├── __init__.py
│   │   ├── dashboard_rotas.py      # Rotas do dashboard
│   │   └── dashboard_Servicos.py   # Serviços do dashboard
│   │
│   ├── chatbot/                    # Módulo de chatbot
│   │   ├── __init__.py
│   │   └── chatbot.py              # Lógica do chatbot com IA
│   │
│   └── contato/                    # Módulo de contato
│       ├── __init__.py
│       └── contato.py              # Gerenciamento de mensagens de contato
│
├── src/                            # Arquivos de origem (CSS)
│   └── input.css                   # CSS de entrada (Tailwind)
│
├── static/                         # Arquivos estáticos
│   ├── output.css                  # CSS compilado
│   │
│   ├── css/                        # Folhas de estilo
│   │   ├── estilo.css              # Estilos gerais
│   │   ├── layout.css              # Layout e grids
│   │   ├── components.css          # Componentes reutilizáveis
│   │   ├── auth.css                # Estilos de autenticação
│   │   ├── dashboard.css           # Estilos do dashboard
│   │   ├── design-system.css       # Sistema de design
│   │   ├── premium.css             # Estilos premium
│   │   └── utilities.css           # Utilitários CSS
│   │
│   ├── js/                         # Scripts JavaScript
│   │   ├── script.js               # Script principal
│   │   ├── home.js                 # Script da página home
│   │   ├── dados.js                # Script para gerenciamento de dados
│   │   ├── analise.js              # Script para análises
│   │   ├── relatorios.js           # Script para relatórios
│   │   ├── ia.js                   # Script para IA
│   │   ├── graficos-avancados.js   # Gráficos avançados
│   │   └── (outros scripts)
│   │
│   ├── acessibilidade/             # Módulo de acessibilidade
│   │   ├── acessibilidade.js       # Funcionalidades de acessibilidade
│   │   ├── acessibilidade.css      # Estilos de acessibilidade
│   │   ├── graficos-acessiveis.js  # Gráficos acessíveis
│   │   ├── README.md               # Documentação de acessibilidade
│   │   ├── GUIA_INTEGRACAO.md      # Guia de integração
│   │   ├── SUMARIO.md              # Sumário
│   │   └── testes.js               # Testes de acessibilidade
│   │
│   └── img/                        # Imagens
│       ├── logo.png
│       ├── Gemini Generated Image.png
│       └── Logo acessibilidade.png
│
├── templates/                      # Templates HTML
│   ├── index.html                  # Página inicial (landing page)
│   ├── home.html                   # Home autenticada
│   ├── home-novo.html              # Versão nova da home
│   ├── login.html                  # Página de login
│   ├── cadastro.html               # Página de cadastro
│   ├── esqueceu_senha.html         # Página de recuperação de senha
│   ├── redefinir_senha.html        # Página de redefinição de senha
│   ├── verificar_codigo.html       # Página de verificação de código
│   ├── dados.html                  # Página de gerenciamento de dados
│   ├── analises.html               # Página de análises
│   ├── graficos-avancados.html     # Página de gráficos avançados
│   ├── dashboard.html (implícita)  # Página de dashboard
│   ├── relatorios.html             # Página de relatórios
│   ├── relatorio_pdf.html          # Template de relatório em PDF
│   ├── perfil.html                 # Página de perfil
│   ├── configuracoes.html          # Página de configurações
│   ├── contato.html                # Página de contato
│   ├── ia.html                     # Página de IA/Chatbot
│   ├── termos_de_uso.html          # Página de termos de uso
│   └── confirmacao_exclusao.html   # Página de confirmação de exclusão
│   │
│   ├── partials/                   # Templates reutilizáveis
│   │   ├── navbar.html             # Barra de navegação lateral
│   │   ├── navbar_mobile.html      # Barra de navegação móvel
│   │   ├── footer.html             # Rodapé
│   │   ├── chatbot.html            # Widget do chatbot
│   │   ├── painel_acessibilidade.html # Painel de acessibilidade
│   │   └── mapeamento_colunas.html # Template para mapeamento de colunas
│   │
│   ├── paginaPDF/                  # Templates para geração de PDFs
│   │   ├── relatorio_pdf.html      # Template de relatório PDF
│   │   ├── relatorio_pdf_novo.html # Versão nova do relatório PDF
│   │   └── relatorio_pdf_simples.html # Versão simples do relatório PDF
│   │
│   └── termos/                     # Páginas de termos
│       └── termos_de_uso.html      # Termos de uso
│
├── uploads/                        # Arquivos enviados pelos usuários
│   ├── dados_teste.json            # Dados de teste (JSON)
│   ├── teste.csv                   # Arquivo de teste (CSV)
│   ├── teste_mapeamento.csv        # Arquivo de teste de mapeamento
│   └── dados_erros (1).xlsx        # Arquivo de erros (Excel)
│
└── .venv/                          # Ambiente virtual Python (ignorado no Git)
```

## Descrição dos Diretórios

### `/backend`
Contém toda a lógica de negócio da aplicação:
- **db.py**: Conexão e configuração do banco de dados
- **user.py**: Gerenciamento de autenticação e perfis de usuário
- **dados/**: CRUD de dados, upload, exclusão e mapeamento de colunas
- **analise/**: Análises de dados por período
- **relatorio/**: Geração de relatórios em PDF
- **perfil/**: Gerenciamento de perfil do usuário
- **home/**: Lógica da página inicial
- **DashBoard/**: Rotas e serviços do dashboard
- **chatbot/**: Integração com IA para chatbot
- **contato/**: Gerenciamento de mensagens de contato

### `/static`
Arquivos estáticos servidos diretamente:
- **css/**: Folhas de estilo (Tailwind compilado + custom)
- **js/**: Scripts JavaScript para funcionalidades frontend
- **acessibilidade/**: Módulo completo de acessibilidade WCAG
- **img/**: Imagens do projeto

### `/templates`
Templates Jinja2 renderizados pelo Flask:
- **partials/**: Componentes reutilizáveis (navbar, footer, etc.)
- **paginaPDF/**: Templates específicos para geração de PDFs
- **termos/**: Páginas estáticas

### `/uploads`
Arquivos enviados pelos usuários (geralmente ignorados no controle de versão)

---

## Stack Tecnológico

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript
- **Database**: SQLite ou PostgreSQL (configurável)
- **Email**: Flask-Mail com Gmail SMTP
- **Acessibilidade**: WCAG 2.1 AA compliant
- **Containerização**: Docker & Docker Compose

---

## Funcionalidades Principais

1. ✅ Autenticação (login, cadastro, recuperação de senha)
2. ✅ Gerenciamento de Dados (upload, exclusão, mapeamento)
3. ✅ Análises (por período, visualização)
4. ✅ Relatórios (geração em PDF)
5. ✅ Dashboard (visualização de dados)
6. ✅ Chatbot com IA
7. ✅ Perfil do Usuário
8. ✅ Acessibilidade (WCAG)
9. ✅ Contato/Suporte
10. ✅ Configurações

---

**Última atualização**: 24 de maio de 2026
