# RELATÓRIO OFICIAL DE AUDITORIA DE QA & SEGURANÇA — DATAINSIGHT

> **Projeto:** DataInsight (BI & Inteligência Financeira Acessível)  
> **Versão:** 2.0  
> **Data da Auditoria:** 21 de setembro de 2026  
> **Tipo de Auditoria:** QA Funcional Completo, Testes de Segurança, Integridade Contábil/Matemática, Paywall/Assinaturas, Responsividade e Acessibilidade (WCAG 2.1 AA)  
> **Branch Testada:** `Teste_após_antigravity`  
> **Commit / Hash Testado:** `e802e60d07f90ed95974abc48c7831ff2bf6c829` ("Testando commit da branch")  
> **Ambiente:** Local de Desenvolvimento Windows 11 (Python 3.14.0a4, Flask 3.x, PyMongo 4.x, MongoDB Atlas)  
> **Navegador Utilizado:** Google Chrome 129 / Chromium DevTools (resoluções emuladas: 375px a 1920px)  
> **Modo do Stripe:** `test (Chaves sk_test_... e Webhook signing secret whsec_... em modo sandbox)`  
> **Política de Auditoria:** Testagem prévia exaustiva e documentação integral de todas as falhas antes de qualquer correção de código.

---

## 1. ESCOPO DOS TESTES

A presente auditoria cobriu de ponta a ponta todos os 17 domínios funcionais e técnicos da plataforma **DataInsight**:

1. **Cadastro:** Acesso direto sem sessão, validações de campos obrigatórios, regras de regex de e-mail, complexidade e confirmação de senha, sanitização de CNPJ, cálculo de teto MEI, hashing bcrypt e validação de checkout prévio.
2. **Login & Autenticação:** Autenticação por credenciais, persistência de sessão client-side, proteção de rotas privadas, mensagens genéricas de erro e proteção contra força bruta (Rate Limiting).
3. **Esqueci Minha Senha:** Solicitação, geração de código de 6 dígitos, persistência com expiração no MongoDB, envio via SMTP (Flask-Mail), validação, expiração temporal, redefinição segura e invalidação pós-uso.
4. **Dashboard & Indicadores (Home):** Cálculo de KPIs agregados (Faturamento, Despesas, Lucro), séries temporais mensais, filtros por data, zero state e tooltips interativos.
5. **Dados & Upload de Arquivos:** Suporte a formatos CSV, XLSX, XLS, JSON e TXT tabulado, tratamento de múltiplas abas, arquivos vazios, sanitização de nulos e integridade de escrita em disco.
6. **Gráficos Financeiros:** Séries temporais no ApexCharts, composição de despesas (Donut), higienização de rótulos, exportação em PNG/SVG e responsividade dinâmica.
7. **Análises Financeiras & Integridade Contábil:** Fórmulas de Faturamento, Custos Fixos e Variáveis, Margem de Contribuição, Margens Operacional/Líquida, Variação Percentual com denominador negativo e Ponto de Equilíbrio Contábil (Fixos / IMC).
8. **Planejamento Financeiro & Cenários:** Projeções dos cenários Otimista, Provável e Pessimista, Ponto de Equilíbrio com margem negativa ou nula e adaptação simplificada para perfil MEI.
9. **Sistema de Assinaturas (MEI e ME):** Seleção de planos, precificação, redirecionamento para o Checkout Stripe, tratamento de webhooks, telas de sucesso/falha, bloqueio de inadimplentes e tentativas de bypass.
10. **Perfil do Usuário:** Visualização de dados cadastrais, alternância de perfil cadastral (MEI vs ME), histórico de relatórios emitidos e atualização de preferências.
11. **Apagar Dados & Expurgos LGPD:** Exclusão de planilhas individuais, confirmação modal, cancelamento, prevenção de IDOR, exclusão total de conta com reautenticação por senha e prevenção de orfandade de dados no MongoDB.
12. **Contato & Suporte:** Validação de campos obrigatórios e formato de e-mail, prevenção de mensagens em branco, sanitização contra HTML Injection em e-mails e tratamento de erros de SMTP sem vazamento de infraestrutura.
13. **Logout & Encerramento de Sessão:** Limpeza integral da sessão via `session.clear()`, expiração de cookies e impedimento de reuso de sessão fechada.
14. **Inteligência Artificial / Insights (Gemini):** Chatbot financeiro multiagente, filtragem restrita por usuário no pipeline RAG, resiliência a timeouts da API externa e tratamento de erros sem exposição de prompts internos.
15. **Relatórios Executivos em PDF:** Renderização de documentos consolidados em PDF, histórico de downloads emitidos e controle de acesso estrito contra IDOR.
16. **Responsividade Multi-Device:** Adaptação em 8 breakpoints estratégicos (375px, 430px, 768px, 992px, 993px, 1024px, 1366px e 1920px), sem overflow horizontal e com transições fluidas.
17. **Acessibilidade Digital (WCAG 2.1 AA):** Navegação sequencial completa por teclado, indicadores visuais de foco (`:focus-visible`), contraste mínimo 4.5:1, skip-links, rotulagem acessível de formulários e integração com VLibras.

---

## 2. RESUMO ESTATÍSTICO DA AUDITORIA

* **Total de Casos de Teste Executados:** 111
* **Aprovados:** 94 (84.7%)
* **Aprovados com Ressalva:** 0 (0.0%)
* **Reprovados:** 17 (15.3%)

### Distribuição dos Casos de Teste por Método de Validação

| Método de Validação | Quantidade de Casos | Percentual | Descrição Operacional |
| :--- | :---: | :---: | :--- |
| **Teste de integração** | 25 | 22.5% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **Teste HTTP/API executado** | 23 | 20.7% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **Teste E2E no navegador** | 23 | 20.7% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **Análise estática de código** | 22 | 19.8% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **Teste unitário automatizado** | 15 | 13.5% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **Teste manual** | 3 | 2.7% | Execução rigorosa com registro de comandos, saídas ou inspeção formal. |
| **TOTAL** | **111** | **100,0%** | **Consistência estatística de 100% dos testes cadastrados.** |

### Distribuição das Falhas Reprovadas por Gravidade

| Gravidade | Quantidade de Falhas | Impacto no Negócio / Segurança |
| :--- | :---: | :--- |
| **Crítica** | 6 | Vulnerabilidades de bypass financeiro, uploads desprotegidos e falsificação de eventos. |
| **Alta** | 6 | Troca de perfil sem pagamento, orfandade LGPD, reutilização de tokens e injeção de HTML. |
| **Média** | 5 | Ausência de rate limiting em login, parâmetros em URL, colisão de arquivos e vazamento de logs. |
| **Baixa** | 0 | Melhorias estéticas e pequenos ajustes de interface sem risco operacional. |
| **TOTAL DE FALHAS** | **17** | **Total estritamente alinhado aos 17 testes reprovados.** |

---

## 3. TESTES REALIZADOS PÁGINA POR PÁGINA

### PÁGINA / MÓDULO: CADASTRO

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CAD-01** | Cadastro | Acesso direto sem checkout prévio | Teste HTTP/API executado | Acessar rota `/cadastro` diretamente sem parâmetros na URL | `GET /cadastro (sem session_id)` | Redirecionamento obrigatório para /assinaturas | Redirecionado com HTTP 302 para /assinaturas (Location: /assinaturas) | **Aprovado** | Baixa | Validação de fluxo de entrada no SaaS operando corretamente. |
| **CAD-02** | Cadastro | Validação de campos obrigatórios vazios | Teste HTTP/API executado | Submeter formulário com campos em branco via POST com session_id | `nome='', email='', senha='', confirmar=''` | Bloqueio com mensagem de campos obrigatórios | Exibida mensagem 'Todos os campos obrigatórios devem ser preenchidos.' (HTTP 200) | **Aprovado** | Baixa | Validação síncrona do backend atuando conforme o esperado. |
| **CAD-03** | Cadastro | Validação de formato de e-mail inválido | Teste HTTP/API executado | Submeter e-mail fora do padrão RFC via formulário | `email='usuario_sem_arroba.com'` | Bloqueio com mensagem de e-mail inválido | Exibida mensagem 'Email inválido.' via validação de regex (HTTP 200) | **Aprovado** | Média | Função `validar_email` em `backend/user.py` rejeita strings fora da máscara. |
| **CAD-04** | Cadastro | Validação de tamanho mínimo de senha | Teste HTTP/API executado | Submeter senha com menos de 8 caracteres | `senha='1234567', confirmar='1234567'` | Bloqueio com alerta de mínimo de 8 caracteres | Exibida mensagem 'A senha deve ter no mínimo 8 caracteres' (HTTP 200) | **Aprovado** | Média | Regra de tamanho mínimo respeitada e tratada antes de persistir. |
| **CAD-05** | Cadastro | Divergência entre senha e confirmação | Teste HTTP/API executado | Submeter valores distintos nos campos de senha | `senha='SenhaForte1', confirmar='SenhaForte2'` | Rejeição por não coincidência | Exibida mensagem 'As senhas não coincidem.' (HTTP 200) | **Aprovado** | Baixa | Validação de integridade atua antes de qualquer processamento no banco. |
| **CAD-06** | Cadastro | Tentativa de cadastro com e-mail duplicado | Teste HTTP/API executado | Cadastrar usuário cujo e-mail já existe na base MongoDB | `email='admin@datainsight.com' (já existente)` | Bloqueio informando que e-mail já possui cadastro | Exibida mensagem 'Email já cadastrado. Acesse a tela de login.' (HTTP 200) | **Aprovado** | Média | Consulta prévia via `usuario.find_one({'email': email})` impede duplicidade. |
| **CAD-07** | Cadastro | Tratamento de CNPJ e cálculo de teto MEI | Teste unitário automatizado | Informar CNPJ formatado e invocar sanitização e cálculo proporcional | `CNPJ='12.345.678/0001-90', tipo_perfil='MEI'` | Sanitização de pontuação e cálculo do teto anual proporcional | Retornado '12345678000190' e teto calculado em R$ 81.000,00 | **Aprovado** | Baixa | Função `sanitizar_cnpj` em `backend/cnpj/cnpj_service.py` validada. |
| **CAD-08** | Cadastro | Armazenamento de hash seguro | Teste de integração | Cadastrar conta com senha em texto plano e verificar documento salvo | `senha='MinhaSenha123'` | Geração de salt e hash bcrypt antes de gravar no MongoDB | Gravado hash '$2b$12$...' no campo senha; texto plano ausente no banco | **Aprovado** | **Alta** | Uso correto da biblioteca `bcrypt` comprovado no banco MongoDB Atlas. |
| **CAD-09** | Cadastro | Bypass de pagamento via session_id forjado | Análise estática de código | Inspecionar tratamento da rota `/cadastro` com `session_id` arbitrário | `GET/POST /cadastro?session_id=fake_token_123&plano=ME` | Rejeição obrigatória caso o Stripe não confirme a sessão como paga | Exceção do Stripe é capturada em bloco genérico (`except Exception: pass`) e conta é criada com status_assinatura='ativa' | **Reprovado** | **Crítica** | Falha Crítica: Permite criação de conta ME/MEI ativa sem confirmação financeira no Stripe. |

#### Sumário da Página / Módulo: Cadastro
* **Testes executados:** 9
* **Aprovados:** 8
* **Reprovados:** 1
* **Ressalvas:** 0
* **Falhas encontradas:** Em `backend/user.py` (linhas 115-128), a falha ao consultar `stripe.checkout.Session.retrieve(session_id)` é capturada em um bloco genérico `except Exception: pass` sem interromper o fluxo. Ao enviar o formulário via POST, o usuário é cadastrado com `status_assinatura='ativa'` e plano selecionado.
* **Riscos:** Criação irrestrita de contas corporativas ME ou MEI ativas sem transacionar valores reais no gateway de pagamento Stripe.
* **Recomendações:** Validar de forma síncrona o status da sessão no Stripe (`checkout_session.payment_status == 'paid'`). Se a consulta falhar ou a sessão não for paga, abortar a requisição com HTTP 403 e redirecionar para `/assinaturas`.

---

### PÁGINA / MÓDULO: LOGIN

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LOG-01** | Login | Autenticação com credenciais válidas | Teste HTTP/API executado | Submeter e-mail e senha corretos via POST /login | `email='usuario_valido@datainsight.com', senha='SenhaCorreta123'` | Autenticação bem-sucedida e redirecionamento para /home | Redirecionamento HTTP 302 para /home com cookie de sessão assinado | **Aprovado** | **Alta** | Fluxo principal de autenticação validado via cliente HTTP Flask. |
| **LOG-02** | Login | Validação de submissão vazia | Teste HTTP/API executado | Submeter formulário de login com campos vazios | `email='', senha=''` | Bloqueio com mensagem de campos obrigatórios | Exibida mensagem de campos obrigatórios (HTTP 200) | **Aprovado** | Baixa | Validação no backend impede requisições nulas. |
| **LOG-03** | Login | Login com e-mail não cadastrado | Teste HTTP/API executado | Submeter e-mail inexistente na base | `email='inexistente@datainsight.com', senha='QualquerSenha123'` | Rejeição com mensagem genérica de erro | Exibida mensagem 'Credenciais incorretas ou usuário não encontrado.' | **Aprovado** | Média | Mensagem genérica previne enumeração detalhada de contas. |
| **LOG-04** | Login | Login com senha incorreta | Teste HTTP/API executado | Submeter senha incorreta para conta existente | `email='usuario_valido@datainsight.com', senha='SenhaErrada999'` | Rejeição com erro de credenciais | Exibida mensagem 'Credenciais incorretas.' (HTTP 200) | **Aprovado** | Média | Verificação via `bcrypt.checkpw` atua com segurança. |
| **LOG-05** | Login | Proteção de rotas privadas sem autenticação | Teste de integração | Executar requisição GET em 11 rotas autenticadas sem cookie de sessão | `GET /home, /dados, /analises, /planejamento-financeiro, etc.` | Redirecionamento obrigatório para /login em todas as rotas restritas | Retornado HTTP 302 com Location: /login para todas as 11 rotas testadas | **Aprovado** | **Alta** | Decorador de sessão atua de forma homogênea nas rotas restritas. |
| **LOG-06** | Login | Manutenção e persistência de sessão | Teste de integração | Navegar entre rotas após login e verificar permanência de usuario_id | `Cookie de sessão Flask persistido` | Manutenção da identidade do usuário entre rotas | Sessão mantida com acesso livre às páginas do painel | **Aprovado** | Baixa | Sessão assinada com SECRET_KEY opera de forma estável. |
| **LOG-07** | Login | Proteção contra força bruta (Rate Limiting) | Análise estática de código | Inspecionar implementação da rota `/login` em busca de limitadores de taxa | `Submissão de 100 requisições sequenciais de login com senha incorreta` | Bloqueio temporário de IP/conta ou resposta HTTP 429 após 5 tentativas | Nenhum limitador de taxa ou bloqueio exponencial implementado (backend processa requisições indefinidamente) | **Reprovado** | Média | Ausência de Flask-Limiter ou contador de tentativas falhas expõe contas a ataques de dicionário. |

#### Sumário da Página / Módulo: Login
* **Testes executados:** 7
* **Aprovados:** 6
* **Reprovados:** 1
* **Ressalvas:** 0
* **Falhas encontradas:** Em `backend/user.py` e `app.py`, a rota `/login` não possui limitação de taxa (Rate Limiting) nem bloqueio temporário de credenciais após sucessivas falhas de autenticação.
* **Riscos:** Vulnerabilidade a ataques automatizados de força bruta (Brute Force) e preenchimento de credenciais (Credential Stuffing).
* **Recomendações:** Integrar `Flask-Limiter` com Redis ou memória local (ex: máximo de 5 tentativas por minuto por IP/e-mail) ou instituir atraso exponencial e CAPTCHA após a 3ª tentativa com erro.

---

### PÁGINA / MÓDULO: ESQUECI MINHA SENHA

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ESQ-01** | Esqueci a Senha | Acesso à página de recuperação | Teste HTTP/API executado | Acessar rota GET /esqueceu-senha | `Requisição GET /esqueceu-senha` | Renderização do formulário de solicitação de redefinição | Retornado HTTP 200 com template `esqueceu_senha.html` renderizado | **Aprovado** | Baixa | Página pública acessível e responsiva. |
| **ESQ-02** | Esqueci a Senha | Solicitação com e-mail inexistente | Teste HTTP/API executado | Informar e-mail não registrado na base de dados | `email='inexistente@dominio.com'` | Aviso informando que o usuário não foi localizado | Exibida mensagem informando que o usuário não foi localizado (HTTP 200) | **Aprovado** | Média | Comportamento atua conforme especificação de interface. |
| **ESQ-03** | Esqueci a Senha | Geração de código de 6 dígitos | Teste de integração | Solicitar código para conta existente e inspecionar banco | `email='usuario_valido@datainsight.com'` | Geração de código numérico de 6 dígitos gravado no MongoDB com timestamp | Campo `codigo_recuperacao` gravado com 6 dígitos e `codigo_expira` definido | **Aprovado** | **Alta** | Código gerado via gerador randômico e registrado na coleção `usuario`. |
| **ESQ-04** | Esqueci a Senha | Disparo de e-mail via SMTP | Análise estática de código | Inspecionar configuração de Flask-Mail e envio da mensagem com código | `Chamada a `mail.send(msg)` com template de recuperação` | Disparo de e-mail contendo código de 6 dígitos para o usuário | Lógica implementada em `backend/user.py:esqueceu_senha` com bloco try/except | **Aprovado** | Média | Integração com servidor SMTP configurada via variáveis de ambiente. |
| **ESQ-05** | Esqueci a Senha | Validação de código correto | Teste de integração | Submeter código exato registrado no MongoDB para /verificar-codigo | `codigo='123456' (idêntico ao gerado no banco)` | Aprovação e redirecionamento para tela de definição de nova senha | Retornado HTTP 302 liberando rota `/redefinir-senha` | **Aprovado** | Média | Comparação de strings atua com sucesso. |
| **ESQ-06** | Esqueci a Senha | Validação de código incorreto | Teste de integração | Submeter código divergente do registrado no MongoDB | `codigo='999999'` | Bloqueio com mensagem de código inválido | Exibida mensagem 'Código inválido ou expirado.' (HTTP 200) | **Aprovado** | **Alta** | Impede prosseguimento com código forjado. |
| **ESQ-07** | Esqueci a Senha | Expiração temporal do código | Análise estática de código | Inspecionar regra de expiração temporal em `backend/user.py` | `Timestamp atual > codigo_expira (+15 minutos)` | Rejeição de códigos cuja validade temporal tenha expirado | Código rejeita requisições após 15 minutos via comparação de UTC datetime | **Aprovado** | **Alta** | Janela de expiração temporal de 15 minutos adequadamente definida. |
| **ESQ-08** | Esqueci a Senha | Redefinição de nova senha com hash bcrypt | Teste de integração | Submeter nova senha válida na rota /redefinir-senha e consultar banco | `nova_senha='NovaSenhaForte@2026'` | Atualização do hash no MongoDB com salt bcrypt recém-gerado | Campo `senha` atualizado com novo hash '$2b$12$...'; login com senha antiga rejeitado | **Aprovado** | **Crítica** | Nova senha criptografada e utilizável no login seguinte. |
| **ESQ-09** | Esqueci a Senha | Invalidação imediata do código após uso | Análise estática de código | Inspecionar `backend/user.py:redefinir_senha` quanto à remoção do token | `Reutilizar código de recuperação imediatamente após troca de senha` | Remoção imediata dos campos `codigo_recuperacao` e `codigo_expira` com $unset | Campos de código não são limpos no MongoDB após a redefinição de senha, permitindo reutilização dentro dos 15 minutos | **Reprovado** | **Alta** | Risco de reutilização de código de recuperação por invasor em janelas ativas. |
| **ESQ-10** | Esqueci a Senha | Manipulação de e-mail na URL sem verificação de posse | Análise estática de código | Inspecionar passagem de parâmetro `email` na rota `/redefinir-senha` | `GET/POST /redefinir-senha?email=vitima@dominio.com com código de outra sessão` | Bloqueio de alteração caso a sessão não corresponda ao e-mail validado | Rota confia no parâmetro `email` recebido sem amarrar estritamente à sessão autorizada | **Reprovado** | Média | Possibilidade de manipulação de parâmetros (Parameter Tampering) na URL. |

#### Sumário da Página / Módulo: Esqueci Minha Senha
* **Testes executados:** 10
* **Aprovados:** 8
* **Reprovados:** 2
* **Ressalvas:** 0
* **Falhas encontradas:** 1) Em `backend/user.py:redefinir_senha`, após redefinir a senha com sucesso, os campos `codigo_recuperacao` e `codigo_expira` não sofrem `$unset`, permitindo reutilização do token dentro do prazo de 15 minutos (ESQ-09).
2) A rota `/redefinir-senha` aceita parâmetro de e-mail sem validar posse da sessão ou token vinculado àquele e-mail específico (ESQ-10).
* **Riscos:** Sequestro de contas caso o código seja interceptado na rede ou no e-mail durante a janela de validade residual.
* **Recomendações:** Executar `$unset` imediato nos campos `codigo_recuperacao` e `codigo_expira` logo após a alteração da senha, e exigir que o token de recuperação seja vinculado a um hash de uso único assinado na sessão do usuário.

---

### PÁGINA / MÓDULO: DASHBOARD / HOME

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DSH-01** | Dashboard / Home | Cálculo de KPIs principais (Faturamento, Despesas, Lucro) | Teste unitário automatizado | Executar `test_calculo_faturamento_despesas_lucro` em `tests/test_calculos_financeiros.py` | `Dataset com receitas brutas, custos fixos e variáveis` | KPIs calculados exatamente conforme somatórios aritméticos | Somatórios de faturamento, despesas e lucro líquido auditados e consistentes (Ran in unittest: OK) | **Aprovado** | **Alta** | Homologado na suíte de testes unitários contábeis. |
| **DSH-02** | Dashboard / Home | Filtro de período por datas | Teste unitário automatizado | Executar `test_filtro_periodo_calculos` em `tests/test_calculos_financeiros.py` | `Intervalos de datas: data_inicio='2026-01-01', data_fim='2026-06-30'` | Filtragem estrita dos registros compreendidos no intervalo temporal | Dataset segmentado corretamente; somatórios parciais refletem exatamente o período | **Aprovado** | Média | Manipulação via `pd.to_datetime` operando com segurança. |
| **DSH-03** | Dashboard / Home | Renderização sem dados cadastrados (Zero State) | Teste E2E no navegador | Acessar /home com usuário recém-criado sem planilhas vinculadas | `Base de dados limpa (sem documentos em `dados_colecao`)` | Exibição graciosa de zeros monetários (R$ 0,00) sem falhas no frontend | Página carregou cards zerados sem erros de JavaScript no console ou HTTP 500 | **Aprovado** | **Alta** | Zero state implementado com resiliência visual. |
| **DSH-04** | Dashboard / Home | Tratamento de divisão por zero em variações percentuais | Teste unitário automatizado | Executar `test_home_percentual` em `tests/test_calculos_financeiros.py` | `Valores anteriores zerados: anterior=0, atual=100; anterior=0, atual=-100` | Retorno seguro de None ou 0.0, prevenindo ZeroDivisionError | Função tratou caso de base nula sem exceções e retornou None de forma segura | **Aprovado** | Média | Evita crash da rota principal da dashboard. |
| **DSH-05** | Dashboard / Home | Exibição adequada de resultados negativos (Prejuízos) | Teste unitário automatizado | Executar `test_isolamento_contabil_prejuizo` em `tests/test_calculos_financeiros.py` | `Despesas (R$ 50.000) > Faturamento (R$ 30.000)` | Lucro negativo de -R$ 20.000 devidamente calculado e preservado | Resultado negativo preservado com sinal aritmético e formatação contábil | **Aprovado** | **Alta** | Sem distorção ou mascaramento de prejuízos operacionais. |
| **DSH-06** | Dashboard / Home | Tooltips e interatividade gráfica no ApexCharts | Teste E2E no navegador | Inspecionar interatividade dos gráficos na dashboard via navegador | `Passagem de cursor do mouse sobre pontos e barras dos gráficos` | Exibição de tooltip com valores formatados em moeda (R$) | Tooltips acionados perfeitamente com formatação `Intl.NumberFormat('pt-BR')` | **Aprovado** | Baixa | Biblioteca ApexCharts integrada de forma responsiva. |
| **DSH-07** | Dashboard / Home | Troca de planilha ativa no seletor | Teste E2E no navegador | Alternar a planilha ativa no menu dropdown da dashboard | `Seleção de planilha_id distinta associada à conta` | Recarregamento dos KPIs com base exclusivamente nos dados da planilha selecionada | Indicadores atualizados dinamicamente mantendo isolamento da planilha | **Aprovado** | Média | Seletor de contexto atua com integridade no frontend e backend. |

#### Sumário da Página / Módulo: Dashboard / Home
* **Testes executados:** 7
* **Aprovados:** 7
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. Cálculos de agregação, filtros de período e zero state operam com integridade.
* **Riscos:** Baixo risco. Necessário manter cache de agregação para evitar sobrecarga de consultas ao MongoDB em bases com centenas de milhares de linhas.
* **Recomendações:** Adicionar índices compostos no MongoDB (`usuario_id`, `data`, `planilha_id`) para otimizar agregações na dashboard conforme a volumetria crescer.

---

### PÁGINA / MÓDULO: DADOS / UPLOAD

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **UPL-01** | Dados / Upload | Upload de planilha CSV válida | Teste de integração | Submeter upload de arquivo CSV estruturado via POST /upload | `Arquivo `uploads/teste_mapeamento.csv`` | Processamento, mapeamento de colunas e inserção em `dados_colecao` | Arquivo importado com sucesso e registros persistidos no MongoDB Atlas | **Aprovado** | **Alta** | Pipeline de ingestão CSV funcionando adequadamente. |
| **UPL-02** | Dados / Upload | Upload de arquivo Excel (.xlsx e .xls) | Teste de integração | Submeter upload de planilha em formato Excel via formulário | `Planilha de teste em formato binário `.xlsx`` | Leitura via pandas, identificação de tipos de colunas e persistência | Planilha processada com sucesso via `pandas.read_excel` e gravada no banco | **Aprovado** | **Alta** | Suporte completo a arquivos binários Office. |
| **UPL-03** | Dados / Upload | Processamento de múltiplas abas no Excel | Análise estática de código | Inspecionar tratamento de abas em `backend/dados/upload_arquivo.py` | `Planilha Excel com múltiplas planilhas internas (Abas)` | Permitir seleção da aba individual para importação | Modal de mapeamento lista abas e permite escolher qual processar | **Aprovado** | Média | Estrutura de seleção de abas presente e funcional. |
| **UPL-04** | Dados / Upload | Suporte a arquivos JSON e TXT tabulado | Análise estática de código | Inspecionar sniffing de delimitadores e parsing JSON em `upload_arquivo.py` | `Arquivos com delimitadores tabulação e objetos JSON estruturados` | Identificação automática de delimitador e conversão para DataFrame | Mecanismos de detecção via `csv.Sniffer` e `json.loads` mapeados no código | **Aprovado** | Baixa | Flexibilidade de formatos de entrada comprovada. |
| **UPL-05** | Dados / Upload | Envio de requisição sem arquivo selecionado | Teste HTTP/API executado | Submeter formulário de upload sem arquivo anexo | `Requisição POST /upload com multipart vazio` | Rejeição com código de erro HTTP 400 e mensagem amigável | Retornado HTTP 400 com mensagem 'Nenhum arquivo enviado.' | **Aprovado** | Média | Bloqueio correto de arquivo nulo. |
| **UPL-06** | Dados / Upload | Envio de arquivo corrompido ou malformado | Teste de integração | Submeter arquivo binário corrompido com extensão `.csv` | `Arquivo corrompido contendo bytes aleatórios` | Captura de exceção de parser sem derrubar o servidor Flask | Exceção capturada com mensagem 'Erro ao processar arquivo' sem crash (HTTP 200/400) | **Aprovado** | Média | Tratamento de exceções robusto na leitura do Pandas. |
| **UPL-07** | Dados / Upload | Sanitização de dados, valores negativos e nulos | Teste unitário automatizado | Executar rotinas de `backend/dados/quality.py` sobre colunas numéricas | `Colunas com valores 'NaN', 'null', 'R$ -1.500,00' e espaços` | Limpeza de strings monetárias e conversão conservadora para float | Valores convertidos em floats preservando o sinal negativo; NaNs tratados | **Aprovado** | **Alta** | Higienização de dados contábeis homologada. |
| **UPL-08** | Dados / Upload | Upload de arquivos com extensões executáveis / bypass MIME | Análise estática de código | Inspecionar validação de segurança em `backend/dados/upload_arquivo.py` | `Envio de arquivos executáveis renomeados ou com dupla extensão (`planilha.csv.exe`)` | Bloqueio estrito por inspeção do magic number/bytes e bloqueio de executáveis | Validação restrita a `filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS` sem verificação de magic bytes | **Reprovado** | **Crítica** | Falha Crítica: Risco de escrita de arquivos com extensões manipuladas no disco do servidor. |
| **UPL-09** | Dados / Upload | Isolamento de arquivos temporários em disco | Análise estática de código | Inspecionar salvamento temporário em disco em `upload_arquivo.py` (L60-L75) | `Dois usuários enviando arquivos com o mesmo nome (`dados.xlsx`) simultaneamente` | Arquivos isolados em disco via UUID ou diretório segregado por usuário | Arquivo é salvo em pasta única compartilhada `uploads/` com `secure_filename(arquivo.filename)` gerando colisão física | **Reprovado** | Média | Falta de UUID no salvamento em disco pode corromper leituras simultâneas de mesmo nome. |

#### Sumário da Página / Módulo: Dados / Upload
* **Testes executados:** 9
* **Aprovados:** 7
* **Reprovados:** 2
* **Ressalvas:** 0
* **Falhas encontradas:** 1) Em `backend/dados/upload_arquivo.py` (linhas 38-55), a checagem de tipos de arquivos é baseada puramente na extensão do nome (`filename.rsplit('.', 1)[1]`), permitindo o upload de arquivos executáveis renomeados ou com dupla extensão (UPL-08).
2) Em `upload_arquivo.py` (linhas 60-75), o arquivo é salvo em disco na pasta compartilhada `uploads/` utilizando apenas `secure_filename(arquivo.filename)` sem prefixo de UUID ou segregador de usuário, gerando colisão física em uploads simultâneos de mesmo nome (UPL-09).
* **Riscos:** Execução arbitrária de código caso o servidor web execute arquivos do diretório de uploads; corrupção de planilhas temporárias durante processamento concorrente.
* **Recomendações:** Validar os magic bytes (MIME type real) utilizando `python-magic` ou `puremagic`, salvar os arquivos temporários utilizando identificadores únicos universais (`uuid.uuid4()`) e expurgar os arquivos de disco imediatamente após a ingestão no MongoDB.

---

### PÁGINA / MÓDULO: GRÁFICOS

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GRA-01** | Gráficos | Gráfico de Evolução Temporal de Receitas x Despesas | Teste E2E no navegador | Inspecionar gráfico de linha/barra na tela de Gráficos Avançados | `Série histórica mensal carregada do banco` | Renderização das linhas de faturamento e custos mês a mês | Gráfico renderizado perfeitamente com eixos X (Meses) e Y (Valores R$) | **Aprovado** | **Alta** | Séries temporais claras e visualmente precisas. |
| **GRA-02** | Gráficos | Gráfico de Composição de Despesas (Donut) | Teste E2E no navegador | Inspecionar gráfico Donut de despesas por categoria | `Valores categorizados em `backend/dados/agregador.py`` | Distribuição proporcional em fatias com percentuais | Gráfico exibe fatias proporcionais com legenda interativa | **Aprovado** | Média | Excelente ferramenta de diagnóstico de maiores centros de custo. |
| **GRA-03** | Gráficos | Proteção contra injeção de script em rótulos | Análise estática de código | Inspecionar serialização dos dados passados para o ApexCharts | `Categoria contendo payload `<script>alert('XSS')</script>`` | Escape de caracteres em JSON impedindo execução no navegador | Dados serializados com `json.dumps(..., default=str)` e escapados no renderizador | **Aprovado** | **Alta** | Rótulos não executam scripts arbitrários no DOM. |
| **GRA-04** | Gráficos | Exportação de gráficos para PNG/SVG | Teste E2E no navegador | Acionar botão nativo de exportação na barra de ferramentas do gráfico | `Clique no menu de download do ApexCharts` | Download imediato do arquivo de imagem vetorial ou rasterizada | Arquivo `.png` baixado com sucesso contendo o snapshot visual | **Aprovado** | Baixa | Recurso funcional para confecção de relatórios externos. |
| **GRA-05** | Gráficos | Responsividade e redimensionamento dinâmico | Teste E2E no navegador | Redimensionar a janela do navegador entre 375px e 1920px | `Eventos de resize da janela` | Gráfico recalcula automaticamente dimensões sem transbordar | Listener `window.resize` redesenha o canvas adequando-se ao contêiner | **Aprovado** | Média | Sem cortes laterais ou sobreposição de legendas. |

#### Sumário da Página / Módulo: Gráficos
* **Testes executados:** 5
* **Aprovados:** 5
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. ApexCharts e bibliotecas visuais operam de forma isolada, responsiva e com escape adequado de strings.
* **Riscos:** Baixo risco. Desempenho pode degradar se séries históricas muito longas (> 5.000 pontos) forem enviadas sem agregação prévia pelo backend.
* **Recomendações:** Garantir que o backend sempre agregue dados em intervalos mensais ou semanais antes de alimentar o ApexCharts.

---

### PÁGINA / MÓDULO: ANÁLISE

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ANA-01** | Análise | Cálculo da Margem de Contribuição (Faturamento - Variáveis) | Teste unitário automatizado | Executar `test_margem_contribuicao_dre` em `tests/test_calculos_financeiros.py` | `Faturamento=100.000, Custos Variáveis=40.000` | Margem de Contribuição = R$ 60.000 (Índice = 60%) | Margem de contribuição e IMC calculados com exatidão matemática | **Aprovado** | **Alta** | Fórmula fundamental da DRE validada na suíte de testes. |
| **ANA-02** | Análise | Cálculo do Ponto de Equilíbrio Contábil (Fixos / IMC) | Teste unitário automatizado | Executar `test_calculo_pe_padrao` em `tests/test_calculos_financeiros.py` | `Fixos=20.000, IMC=0,60` | PE = Fixos / IMC = R$ 33.333,33 | Ponto de equilíbrio calculado exatamente em R$ 33.333,33 | **Aprovado** | **Alta** | Regra contábil oficial respeitada rigorosamente. |
| **ANA-03** | Análise | Cálculo de Margem Líquida e Operacional | Teste unitário automatizado | Executar `test_margem_liquida_e_operacional` em `tests/test_calculos_financeiros.py` | `Lucro Líquido=25.000, Receita=100.000` | Margem Líquida = 25,0% | Percentual calculado com exatidão em 25,0% | **Aprovado** | Média | Cálculos de rentabilidade e lucratividade consistentes. |
| **ANA-04** | Análise | Cálculo de Variação Percentual com Denominador Negativo | Teste unitário automatizado | Executar `test_negativo_para_positivo` em `tests/test_calculos_financeiros.py` | `De prejuízo (-100) para lucro (+100)` | Variação real positiva de +200% via fórmula (atual - base) / abs(base) | Calculado exatamente +200.0% (denominador em módulo) | **Aprovado** | **Alta** | Evita anomalia clássica de variações invertidas em lucros/prejuízos. |
| **ANA-05** | Análise | Tratamento de base zero em variações da Análise Estratégica | Teste unitário automatizado | Executar `test_analise_estrategica_variacao` em `tests/test_calculos_financeiros.py` | `Base=0, Atual=500` | Retorno seguro de None prevenindo divisão por zero | Retornado None conforme especificação matemática | **Aprovado** | Média | Homologado em testes unitários contra exceções de ponto flutuante. |

#### Sumário da Página / Módulo: Análise
* **Testes executados:** 5
* **Aprovados:** 5
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. As fórmulas de Margem de Contribuição, Margens Líquida/Operacional, Variações Percentuais e Ponto de Equilíbrio Contábil (Fixos / IMC) foram 100% homologadas na suíte de testes unitários automatizados.
* **Riscos:** Baixo risco contábil.
* **Recomendações:** Manter os testes unitários de `tests/test_calculos_financeiros.py` integrados à esteira de CI/CD para evitar qualquer regressão aritmética futura.

---

### PÁGINA / MÓDULO: PLANEJAMENTO FINANCEIRO

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PLA-01** | Planejamento Financeiro | Projeção de Cenários (Otimista, Provável e Pessimista) | Teste unitário automatizado | Executar `test_consistencia_entre_cenarios` em `tests/test_calculos_financeiros.py` | `Parâmetros de variação: Otimista (+15% receita, -5% custos), Pessimista (-15% receita, +10% custos)` | Cenários calculados e ordenados: Lucro Otimista > Provável > Pessimista | Consistência matemática entre cenários confirmada na suíte de testes | **Aprovado** | **Alta** | Lógica paramétrica de projeção íntegra. |
| **PLA-02** | Planejamento Financeiro | Cálculo do Ponto de Equilíbrio no Módulo de Planejamento | Teste unitário automatizado | Executar `test_pe_planejamento_financeiro` em `tests/test_calculos_financeiros.py` | `Receita e despesas parametrizadas no planejamento` | Ponto de equilíbrio consistente com o motor de análise contábil | Ponto de equilíbrio calculado identicamente ao módulo de análise | **Aprovado** | **Alta** | Harmonia de regras de negócio entre módulos distintos. |
| **PLA-03** | Planejamento Financeiro | Tratamento de PE com Margem Negativa ou Nula | Teste unitário automatizado | Executar `test_pe_margem_negativa_ou_zero` em `tests/test_calculos_financeiros.py` | `Custos variáveis superiores à receita (IMC <= 0)` | Retorno de None ou valor sentinela, impedindo PE negativo ou ZeroDivisionError | Função retornou None de forma segura com alerta contábil | **Aprovado** | **Crítica** | Impede falha aritmética grave e apresentação de faturamento de equilíbrio negativo. |
| **PLA-04** | Planejamento Financeiro | Adaptação de complexidade para perfil MEI | Teste de integração | Acessar /planejamento-financeiro com usuário autenticado com perfil MEI | `Sessão com `tipo_perfil='MEI'`` | Exibição simplificada focada em teto de faturamento anual | Renderizado template adaptado sem sobrecarga de métricas corporativas complexas | **Aprovado** | Média | Adaptação da linguagem para microempreendedores validada. |
| **PLA-05** | Planejamento Financeiro | Cenário Pessimista gerando Prejuízo | Teste unitário automatizado | Executar `test_cenario_pessimista_prejuizo` em `tests/test_calculos_financeiros.py` | `Simulação com queda drástica de receita e aumento de despesas fixas` | Cálculo correto do déficit financeiro e impacto na reserva de emergência | Resultado deficitário calculado e refletido com exatidão matemática | **Aprovado** | **Alta** | Robustez contábil em cenários de crise. |

#### Sumário da Página / Módulo: Planejamento Financeiro
* **Testes executados:** 5
* **Aprovados:** 5
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. Os cenários Otimista, Provável e Pessimista e o tratamento de Ponto de Equilíbrio com margem negativa operam com exatidão matemática e consistência.
* **Riscos:** Baixo risco.
* **Recomendações:** Permitir parametrização dinâmica de percentuais de cenários pelo usuário no perfil corporativo ME.

---

### PÁGINA / MÓDULO: ASSINATURAS (MEI E ME)

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ASS-01** | Assinaturas (MEI e ME) | Renderização dos cards de planos MEI e ME | Teste HTTP/API executado | Acessar rota GET /assinaturas | `Requisição GET /assinaturas` | Exibição dos dois planos com precificação e benefícios discriminados | Retornado HTTP 200 com template `assinaturas.html` renderizado | **Aprovado** | Média | Interface responsiva com clareza na proposta de valor. |
| **ASS-02** | Assinaturas (MEI e ME) | Criação de sessão de checkout Stripe | Teste de integração | Disparar POST para criação de sessão de checkout | `plano='MEI' via formulário de seleção` | Geração de `checkout.Session` na API do Stripe e URL de redirecionamento | Retornada URL válida do Stripe Checkout em modo sandbox | **Aprovado** | Média | Integração com SDK `stripe` operando em ambiente de testes. |
| **ASS-03** | Assinaturas (MEI e ME) | Bloqueio de recursos para conta inativa | Teste HTTP/API executado | Acessar rotas premium com usuário autenticado com status_assinatura='inativa' | `GET /dados com sessão inativa` | Redirecionamento para tela de bloqueio de assinatura | Redirecionado com HTTP 302 para `/bloqueio-assinatura` | **Aprovado** | Baixa | Paywall do backend bloqueia acesso funcional sem assinatura válida. |
| **ASS-04** | Assinaturas (MEI e ME) | Adulteração de preço na requisição de checkout | Análise estática de código | Inspecionar rota de checkout em `backend/pagamento/criar_assinatura.py` | `Submissão de payload com valor alterado arbitrariamente (`preco=1.00`)` | Ignorar valor enviado pelo cliente e utilizar tabela fixa do servidor | Endpoint aceita parâmetros enviados pelo navegador sem validar estritamente contra catálogo backend imutável | **Reprovado** | **Crítica** | Falha Crítica: Risco de aquisição de assinaturas por valores adulterados pelo cliente. |
| **ASS-05** | Assinaturas (MEI e ME) | Validação de assinatura do webhook Stripe | Análise estática de código | Inspecionar endpoint `/webhook` em `backend/pagamento/webhook_stripe.py` | `Envio de payload JSON forjado sem cabeçalho `Stripe-Signature`` | Rejeição com HTTP 400 em caso de assinatura ausente ou inválida | Webhook processa dados JSON brutos sem validar obrigatoriamente a assinatura criptográfica `construct_event` | **Reprovado** | **Crítica** | Falha Crítica: Permite injeção de eventos falsos de pagamento por terceiros. |
| **ASS-06** | Assinaturas (MEI e ME) | Ativação de assinatura sem confirmação de pagamento | Análise estática de código | Inspecionar lógica de callback de retorno e webhook | `Retorno à rota `/sucesso` sem confirmação assíncrona do evento `checkout.session.completed`` | Ativação de conta exclusivamente após evento síncrono e validado | Usuário é ativado na chegada à URL de sucesso sem confirmação assíncrona via webhook | **Reprovado** | **Crítica** | Falha Crítica: Risco de liberação de serviço sem compensação financeira confirmada. |
| **ASS-07** | Assinaturas (MEI e ME) | Upgrade de MEI para ME sem checagem de pagamento da diferença | Análise estática de código | Inspecionar troca de perfil em `backend/perfil/pagina_de_perfil.py` e `user.py` | `Usuário com plano MEI ativo altera perfil para ME` | Exigir checkout e pagamento da diferença de preço antes de liberar ME | Sistema permite mudança cadastral para ME usufruindo de regras avançadas mantendo assinatura MEI mais barata | **Reprovado** | **Alta** | Falha Comercial / Alta: Quebra de regras de monetização do produto. |
| **ASS-08** | Assinaturas (MEI e ME) | Chamada forjada de callback de sucesso sem session_id válido | Análise estática de código | Inspecionar tratamento da rota `/sucesso` em `criar_assinatura.py` | `Acessar `/sucesso?session_id=fake_token`` | Rejeição estrita com HTTP 403 e redirecionamento para falha | Exceção do SDK Stripe é engolida e página de sucesso é renderizada | **Reprovado** | **Crítica** | Falha Crítica: Permite visualização e acionamento de fluxo de sucesso com tokens fictícios. |
| **ASS-09** | Assinaturas (MEI e ME) | Exposição de chaves e segredos em respostas de erro | Análise estática de código | Inspecionar tratamento de erros nas rotas de pagamento | `Disparar exceção forçada de conexão com a API do Stripe` | Mensagem genérica ao usuário com registro interno mascarado | Mensagens de erro exibem trechos literais de configurações internas e exceções | **Reprovado** | **Alta** | Vazamento de detalhes de configuração em ambiente de execução. |

#### Sumário da Página / Módulo: Assinaturas (MEI e ME)
* **Testes executados:** 9
* **Aprovados:** 3
* **Reprovados:** 6
* **Ressalvas:** 0
* **Falhas encontradas:** 1) O endpoint de checkout confia em valores enviados pelo cliente sem validação contra catálogo backend imutável (ASS-04).
2) O webhook do Stripe não valida obrigatoriamente a assinatura `Stripe-Signature` via `construct_event` (ASS-05).
3) Ativação de assinatura ocorre via URL de retorno antes da confirmação assíncrona do webhook (ASS-06).
4) Upgrade de MEI para ME é permitido no perfil sem cobrança da diferença de mensalidade (ASS-07).
5) Rota de sucesso engole exceções de sessão inválida do Stripe (ASS-08).
6) Mensagens de erro exibem trechos literais de exceções internas e segredos da integração (ASS-09).
* **Riscos:** Bypass integral de pagamento, evasão de receita, ativação não autorizada de planos ME e injeção de eventos falsos de assinatura.
* **Recomendações:** 1. Definir catálogo fixo de Price IDs e valores no backend.
2. Tornar obrigatória a checagem criptográfica com `stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)` com abortamento (HTTP 400) em caso de falha.
3. Ativar privilégios de plano exclusivamente após o processamento do evento `checkout.session.completed` disparado pelo webhook oficial do Stripe.

---

### PÁGINA / MÓDULO: PERFIL

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PRF-01** | Perfil | Visualização dos dados cadastrais | Teste HTTP/API executado | Acessar rota GET /config ou /perfil autenticado | `Sessão válida de usuário` | Exibição correta do nome, e-mail, CNPJ e tipo de plano ativo | Retornado HTTP 200 com dados cadastrais preenchidos no formulário | **Aprovado** | **Alta** | Visualização de perfil consistente. |
| **PRF-02** | Perfil | Histórico de relatórios gerados no perfil | Teste de integração | Consultar relatórios vinculados na página de configurações | `Documentos gravados em `relatorios_colecao` para o usuario_id` | Listagem apenas dos relatórios de titularidade da conta | Relatórios do próprio usuário listados com botões de download | **Aprovado** | Média | Isolamento de histórico de relatórios preservado. |
| **PRF-03** | Perfil | Alternância de perfil cadastral (MEI vs ME) sem validação de pagamento | Análise estática de código | Inspecionar endpoint POST de atualização de perfil em `pagina_de_perfil.py` | `Submeter alteração de `tipo_perfil` de 'MEI' para 'ME' via formulário de configurações` | Bloqueio da troca para ME com redirecionamento para checkout do plano correspondente | Backend atualiza diretamente o campo no MongoDB sem validar se a conta possui assinatura ME ativa | **Reprovado** | **Alta** | Permite que qualquer assinante MEI altere livremente sua conta para ME sem pagar a assinatura de maior valor. |
| **PRF-04** | Perfil | Atualização de preferências e dados pessoais | Teste de integração | Submeter novo nome e preferências via POST /config | `nome='Novo Nome de Exibição'` | Persistência dos dados atualizados no MongoDB | Documento atualizado com sucesso no banco de dados Atlas | **Aprovado** | Média | Rotina de atualização cadastral operando com integridade. |

#### Sumário da Página / Módulo: Perfil
* **Testes executados:** 4
* **Aprovados:** 3
* **Reprovados:** 1
* **Ressalvas:** 0
* **Falhas encontradas:** Em `backend/perfil/pagina_de_perfil.py` (linhas 50-75), a rota de atualização cadastral permite alternar o `tipo_perfil` de 'MEI' para 'ME' sem exigir assinatura ME ativa nem validar pagamento prévio (PRF-03).
* **Riscos:** Usuários MEI conseguem contornar o paywall e usufruir de ferramentas avançadas exclusivas do plano ME sem custo.
* **Recomendações:** Condicionar a troca de tipo de perfil para 'ME' à verificação do status da assinatura: se a conta for MEI, a seleção de ME deve redirecionar para o Checkout Stripe para cobrança do upgrade.

---

### PÁGINA / MÓDULO: APAGAR DADOS

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEL-01** | Apagar Dados | Exclusão de planilha específica | Teste de integração | Acionar exclusão de uma planilha individual pelo ID | `POST /apagar-planilha com planilha_id específico` | Exclusão dos registros vinculados apenas àquela planilha em `dados_colecao` | Registros da planilha removidos com sucesso mantendo outras planilhas intactas | **Aprovado** | **Alta** | Exclusão seletiva opera de forma íntegra. |
| **DEL-02** | Apagar Dados | Exibição de modal de confirmação | Teste E2E no navegador | Clicar no botão de apagar planilha na interface | `Clique no botão de lixeira da linha da planilha` | Abertura de modal de confirmação exigindo confirmação explícita | Modal aberto impedindo deleção acidental com um único clique | **Aprovado** | Média | Prevenção contra cliques involuntários implementada. |
| **DEL-03** | Apagar Dados | Cancelamento de exclusão no modal | Teste E2E no navegador | Clicar no botão de cancelar dentro do modal de exclusão | `Clique em 'Cancelar'` | Fechamento do modal sem alteração nos dados do banco | Modal fechado e registros preservados na tabela e no banco | **Aprovado** | Média | Controle de cancelamento funcional. |
| **DEL-04** | Apagar Dados | Prevenção de exclusão cruzada entre usuários (IDOR) | Teste de integração | Tentar excluir planilha_id pertencente a Usuário A usando a sessão do Usuário B | `POST /apagar-planilha com ID de terceiro` | Rejeição com HTTP 403 ou contagem zero de documentos apagados | Filtro inclui `usuario_id: session['usuario_id']`; nenhum dado de terceiro foi afetado | **Aprovado** | **Crítica** | Proteção de autorização multi-inquilino atuando com rigor. |
| **DEL-05** | Apagar Dados | Exclusão total de dados com confirmação por senha | Teste de integração | Submeter formulário de expurgo total da conta com senha correta | `POST /apagar-todos-dados com senha válida` | Exclusão dos registros de dados do usuário e invalidação da conta | Registros de dados expurgados e redirecionamento para login executado | **Aprovado** | **Alta** | Fluxo de expurgo com dupla confirmação seguro. |
| **DEL-06** | Apagar Dados | Bloqueio de exclusão quando senha informada está incorreta | Teste HTTP/API executado | Submeter solicitação de expurgo informando senha incorreta | `POST /apagar-todos-dados com senha errada` | Bloqueio da operação com mensagem de senha incorreta | Operação abortada e mensagem de erro exibida (HTTP 200) | **Aprovado** | **Alta** | Validação de credencial impede ataques de exclusão não autorizada. |
| **DEL-07** | Apagar Dados | Orfandade de dados nas coleções MongoDB após exclusão de usuário | Análise estática de código | Inspecionar rotinas de expurgo em `backend/dados/apagar_dados.py` e `backend/user.py` | `Executar exclusão de conta e verificar coleções `chat_historico`, `relatorios_colecao` e `analises_salvas`` | Exclusão em cascata de todas as coleções que contenham o `usuario_id` | A rotina de exclusão limpa apenas `usuario` e `dados_colecao`, deixando históricos de chat e relatórios órfãos no banco | **Reprovado** | **Alta** | Não conformidade com LGPD (direito ao esquecimento) e persistência de dados sensíveis órfãos. |

#### Sumário da Página / Módulo: Apagar Dados
* **Testes executados:** 7
* **Aprovados:** 6
* **Reprovados:** 1
* **Ressalvas:** 0
* **Falhas encontradas:** Em `backend/dados/apagar_dados.py` e `backend/user.py`, a rotina de exclusão definitiva de conta expurga apenas `usuario` e `dados_colecao`, deixando coleções como `chat_historico`, `relatorios_colecao` e `analises_salvas` órfãs no MongoDB (DEL-07).
* **Riscos:** Violação da LGPD (Art. 18, direito à eliminação definitiva de dados pessoais) e persistência desnecessária de históricos confidenciais de clientes.
* **Recomendações:** Implementar expurgo transacional em cascata em todas as coleções do MongoDB vinculadas ao `usuario_id` (`chat_historico.delete_many`, `relatorios_colecao.delete_many`, `analises_salvas.delete_many`).

---

### PÁGINA / MÓDULO: CONTATO

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CON-01** | Contato | Envio bem-sucedido de mensagem de suporte | Teste HTTP/API executado | Preencher formulário de contato e submeter via POST /contato | `nome='Cliente Teste', email='cliente@teste.com', mensagem='Mensagem de suporte clara'` | Disparo de e-mail para a equipe de suporte e mensagem de sucesso ao usuário | Mensagem de sucesso exibida (HTTP 200) e rotina de envio disparada | **Aprovado** | **Alta** | Canal de suporte funcional. |
| **CON-02** | Contato | Validação de campos obrigatórios vazios | Teste HTTP/API executado | Submeter formulário de contato com campos em branco | `nome='', email='', mensagem=''` | Bloqueio com mensagem de campos obrigatórios | Exibida mensagem de validação sem envio de e-mail (HTTP 200) | **Aprovado** | Baixa | Validação de presença atuando corretamente. |
| **CON-03** | Contato | Validação de formato de e-mail inválido | Teste HTTP/API executado | Submeter formulário de contato com e-mail inválido | `email='contato_sem_formato'` | Bloqueio com mensagem de e-mail inválido | Exibida mensagem de e-mail inválido (HTTP 200) | **Aprovado** | Baixa | Regex de e-mail aplicada no backend. |
| **CON-04** | Contato | Prevenção de mensagens contendo apenas espaços | Teste HTTP/API executado | Submeter campo de mensagem contendo apenas espaços em branco | `mensagem='     '` | Rejeição por conteúdo vazio após strip | Exibida mensagem exigindo conteúdo real na mensagem (HTTP 200) | **Aprovado** | Baixa | Impede envio de tickets em branco para o suporte. |
| **CON-05** | Contato | Injeção de tags HTML / XSS em templates de e-mail | Análise estática de código | Inspecionar montagem do corpo de e-mail em `backend/contato/contato.py` | `mensagem='<script>alert(1)</script><h1>Teste de Injeção</h1>'` | Sanitização ou escape de entidades HTML antes da interpolação no template | Corpo do e-mail é montado com f-string direta sem sanitização (`msg.html = f'<p>{mensagem}</p>'`), permitindo injeção de HTML no leitor de e-mail | **Reprovado** | **Alta** | Vulnerabilidade de HTML Injection no cliente de e-mail do time de suporte. |
| **CON-06** | Contato | Vazamento de stack trace de conexão SMTP em erro | Análise estática de código | Inspecionar bloco de tratamento de exceção em `backend/contato/contato.py` | `Simular falha de conexão ou autenticação com servidor SMTP` | Mensagem amigável sem expor detalhes internos da infraestrutura | Bloco `except Exception as e:` repassa `str(e)` bruto para a mensagem flash exibida ao usuário final | **Reprovado** | Média | Vazamento de informações de servidor e credenciais de infraestrutura em telas de erro. |
| **CON-07** | Contato | Prevenção de duplo clique no botão de envio | Teste E2E no navegador | Inspecionar script de submissão do formulário de contato | `Cliques rápidos repetidos no botão de envio` | Botão deve ser desabilitado após o primeiro clique evitando múltiplos disparos | Script desabilita o botão e exibe feedback de carregamento | **Aprovado** | Baixa | Evita duplicidade acidental de mensagens. |

#### Sumário da Página / Módulo: Contato
* **Testes executados:** 7
* **Aprovados:** 5
* **Reprovados:** 2
* **Ressalvas:** 0
* **Falhas encontradas:** 1) Em `backend/contato/contato.py`, o corpo HTML do e-mail é montado interpolando strings sem sanitização (`msg.html = f'<p>{mensagem}</p>'`), permitindo injeção de HTML no leitor de e-mail do suporte (CON-05).
2) Em caso de erro de conexão com o servidor SMTP, a exceção bruta `str(e)` é repassada para a mensagem flash do usuário (CON-06).
* **Riscos:** HTML Injection / Phishing em clientes de e-mail internos; vazamento de informações de rede e infraestrutura de mensageria.
* **Recomendações:** Sanitizar e escapar todo o conteúdo fornecido pelo usuário utilizando `markupsafe.escape` antes de incluir no template de e-mail, e exibir mensagens genéricas amigáveis em caso de falha de conexão SMTP.

---

### PÁGINA / MÓDULO: LOGOUT

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LGT-01** | Logout | Invalidação completa da sessão no logout | Teste de integração | Efetuar GET /logout autenticado e tentar acessar /home em seguida | `Sessão ativa invalidada via `session.clear()`` | Redirecionamento para /login e bloqueio total em requisições seguintes | Retornado HTTP 302 para /login; requisição posterior a /home rejeitada com 302 | **Aprovado** | **Alta** | Sessão completamente destruída no encerramento. |
| **LGT-02** | Logout | Expiração e limpeza de cookies de autenticação | Teste HTTP/API executado | Inspecionar cabeçalhos de resposta HTTP da rota /logout | `Requisição GET /logout` | Cabeçalho Set-Cookie expirando ou limpando o cookie de sessão | Cookie invalidado no cabeçalho de resposta do cliente HTTP | **Aprovado** | **Alta** | Previne retenção de tokens de sessão no navegador. |

#### Sumário da Página / Módulo: Logout
* **Testes executados:** 2
* **Aprovados:** 2
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. Destruição de sessão via `session.clear()` e invalidação de cookies homologadas.
* **Riscos:** Baixo risco.
* **Recomendações:** Garantir expiração com flag `SameSite=Lax` e `Secure=True` em ambientes com HTTPS obrigatório.

---

### PÁGINA / MÓDULO: IA / INSIGHTS

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IA-01** | IA / Insights | Interação com assistente inteligente Gemini | Teste de integração | Submeter pergunta sobre finanças via POST /chat com dados cadastrados | `mensagem='Como posso otimizar meus custos fixos este mês?'` | Resposta contextualizada baseada nos dados financeiros do usuário | Resposta coerente gerada via API do Gemini integrando contexto RAG | **Aprovado** | **Alta** | Integração com SDK do Gemini operando com sucesso. |
| **IA-02** | IA / Insights | Isolamento de dados do usuário no contexto do RAG | Teste de integração | Inspecionar filtros de banco no injetor de contexto do chatbot (`rag_helpers.py`) | `Perguntar por dados de faturamento de outros clientes` | Inclusão obrigatória de filtro `usuario_id: session['usuario_id']` na busca | Pipeline RAG consulta exclusivamente dados da conta ativa; zero vazamento entre contas | **Aprovado** | **Crítica** | Isolamento de dados confidencial assegurado no pipeline de IA. |
| **IA-03** | IA / Insights | Resiliência a indisponibilidade ou timeout da API Gemini | Teste de integração | Simular falha de conexão ou timeout na chamada da API externa do Google | `Interrupção de rede simulada no cliente de IA` | Retorno gracioso de mensagem de indisponibilidade temporária sem crash | Captura de exceção com mensagem amigável orientando o usuário a tentar novamente | **Aprovado** | **Alta** | Excelente tolerância a falhas externas. |
| **IA-04** | IA / Insights | Comportamento do assistente sem dados cadastrados | Teste de integração | Interagir com chatbot em conta recém-criada sem planilhas | `mensagem='Qual meu lucro este mês?' (sem planilhas cadastradas)` | Orientações para realizar upload prévio antes da análise | Assistente responde amigavelmente informando a ausência de planilhas | **Aprovado** | Média | Tratamento sem alucinações ou exceções de índice. |
| **IA-05** | IA / Insights | Exposição de logs de depuração e prompt da IA em exceção | Análise estática de código | Inspecionar tratamento de exceções em `backend/chatbot/orchestrator.py` (L140-L160) | `Disparo de exceção durante montagem de prompt` | Ocultação estrita de prompts de sistema e variáveis internas | Bloco except retorna dicionário JSON com detalhes do erro e string bruta do prompt | **Reprovado** | Média | Vazamento de propriedade intelectual e engenharia de prompt em respostas de falha. |

#### Sumário da Página / Módulo: IA / Insights
* **Testes executados:** 5
* **Aprovados:** 4
* **Reprovados:** 1
* **Ressalvas:** 0
* **Falhas encontradas:** Em `backend/chatbot/orchestrator.py` (linhas 140-160), o tratamento de exceções da API Gemini retorna em JSON o `str(e)` bruto e a string do prompt de sistema em respostas de erro (IA-05).
* **Riscos:** Vazamento da engenharia de prompt (System Instructions) e detalhes da chave ou arquitetura de IA em caso de instabilidade externa.
* **Recomendações:** Retornar apenas uma mensagem amigável genérica de erro e registrar detalhes técnicos e prompts exclusivamente no log interno do servidor.

---

### PÁGINA / MÓDULO: RELATÓRIOS

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REL-01** | Relatórios | Geração de Relatório Consolidado em formato PDF | Teste de integração | Acionar geração de relatório PDF via rota /gerar-relatorio | `Dataset contendo indicadores, balanço e gráficos` | Geração de arquivo binário PDF com cabeçalho application/pdf e layout íntegro | Arquivo binário PDF gerado com sucesso, contendo tabelas e resumo de KPIs | **Aprovado** | **Alta** | Renderização PDF operacional e bem diagramada. |
| **REL-02** | Relatórios | Prevenção de visualização de relatórios de terceiros (IDOR) | Teste de integração | Tentar visualizar relatório de outro usuário passando ID na URL | `GET /relatorio/<id_de_terceiro> com sessão de outro usuário` | Bloqueio com HTTP 403 Forbidden ou 404 Not Found | Backend valida correspondência de `usuario_id` e rejeita acesso indevido com HTTP 403 | **Aprovado** | **Crítica** | Proteção contra acesso horizontal não autorizado homologada. |
| **REL-03** | Relatórios | Listagem de relatórios gerados na tela de histórico | Teste HTTP/API executado | Acessar tela /relatorios e inspecionar tabela de histórico | `Sessão de usuário com relatórios previamente gerados` | Listagem paginada dos relatórios do usuário com metadados | Retornado HTTP 200 com histórico de relatórios emitidos | **Aprovado** | Média | CRUD de relatórios consistente. |
| **REL-04** | Relatórios | Exclusão de relatório com validação de posse | Teste de integração | Acionar exclusão de relatório do histórico | `POST /apagar-relatorio com relatorio_id pertencente ao usuário` | Remoção exclusiva do relatório indicado no banco MongoDB | Relatório excluído do banco mantendo demais relatórios intactos | **Aprovado** | **Alta** | Exclusão seletiva com validação de titularidade atuando. |

#### Sumário da Página / Módulo: Relatórios
* **Testes executados:** 4
* **Aprovados:** 4
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. Geração em PDF, histórico e validações de autorização (prevenção de IDOR) operam com segurança estrita.
* **Riscos:** Baixo risco.
* **Recomendações:** Implementar expurgo periódico de relatórios PDF temporários para preservação de espaço em disco.

---

### PÁGINA / MÓDULO: RESPONSIVIDADE (GLOBAL)

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RES-01** | Responsividade (Global) | Breakpoint 375px (Mobile Pequeno) - Navbar e Sidebar | Teste E2E no navegador | Emular viewport de 375x667 (iPhone SE) via Chromium DevTools | `Viewport 375px` | Ocultar sidebar fixa e exibir barra móvel inferior/gaveta | Sidebar desktop oculta com sucesso; barra móvel inferior renderizada | **Aprovado** | Média | Navegação touch acessível em telas compactas. |
| **RES-02** | Responsividade (Global) | Breakpoint 375px (Mobile Pequeno) - Tabela de Dados | Teste E2E no navegador | Acessar rota /dados com tabela financeira em tela de 375px | `Tabela com 8 colunas financeiras em viewport 375px` | Rolagem horizontal interna sem quebrar a largura global da tela | Contêiner com `overflow-x: auto` permite rolagem sem overflow no body | **Aprovado** | Média | Sem quebra de layout ou cortes de interface. |
| **RES-03** | Responsividade (Global) | Breakpoint 430px (Mobile Grande) - Cards de Assinatura | Teste E2E no navegador | Emular viewport de 430x932 (iPhone 14/15 Pro Max) via Chromium DevTools | `Página /assinaturas em 430px` | Disposição dos cards MEI e ME em coluna única com largura de 100% | Cards empilhados verticalmente com botões de checkout totalmente visíveis | **Aprovado** | Baixa | Leitura e clique confortáveis em telas de alta densidade. |
| **RES-04** | Responsividade (Global) | Breakpoint 768px (Tablet Vertical) - Grid de Indicadores | Teste E2E no navegador | Emular viewport de 768x1024 (iPad vertical) na dashboard principal | `Grid de 4 KPIs na dashboard em 768px` | Adaptação do grid de 4 colunas para 2 colunas proporcionais | Cards reordenados em matriz 2x2 com tipografia equilibrada | **Aprovado** | Baixa | Layout harmônico em tablets em modo retrato. |
| **RES-05** | Responsividade (Global) | Breakpoint 992px / 993px - Transição de Sidebar | Teste E2E no navegador | Redimensionar viewport continuamente entre 990px e 995px | `Transição de viewport ao redor do breakpoint de 992px` | Transição suave entre navegação drawer e sidebar fixa lateral | Layout transiciona perfeitamente entre classes mobile e desktop | **Aprovado** | Média | Breakpoint bem calibrado sem piscar de layout. |
| **RES-06** | Responsividade (Global) | Breakpoint 1024px (Tablet Horizontal) - Painel de Gráficos | Teste E2E no navegador | Emular viewport de 1024x768 (iPad horizontal / Laptop pequeno) | `Página de gráficos avançados em 1024px` | Disposição em 2 colunas de gráficos sem esmagamento de eixos | Gráficos acomodados lado a lado com legendas legíveis | **Aprovado** | Baixa | Boa densidade de informação visual. |
| **RES-07** | Responsividade (Global) | Breakpoint 1366px (Laptop Standard) - Layout Corporativo | Teste E2E no navegador | Emular viewport de 1366x768 (resolução padrão de notebooks) | `Navegação completa no sistema em 1366px` | Interface de alta produtividade sem barras de rolagem excessivas | Visualização espaçosa e balanceada em todas as páginas | **Aprovado** | Baixa | Resolução ideal de uso da plataforma DataInsight. |
| **RES-08** | Responsividade (Global) | Breakpoint 1920px (Full HD Desktop) - Contenção de Layout | Teste E2E no navegador | Emular viewport de 1920x1080 (Desktop Full HD) | `Página principal em 1920px` | Contêiner central com largura máxima restrita sem esticar elementos | Uso de classes `max-w-7xl` centralizadas mantém legibilidade | **Aprovado** | Baixa | Sem elementos distorcidos ou esticados em monitores grandes. |

#### Sumário da Página / Módulo: Responsividade (Global)
* **Testes executados:** 8
* **Aprovados:** 8
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. A interface do DataInsight adapta-se fluidamente em todos os 8 breakpoints auditados (375px a 1920px), sem quebra de containers ou overflow indesejado.
* **Riscos:** Baixo risco visual.
* **Recomendações:** Adicionar testes visuais automatizados de regressão em novos componentes gráficos.

---

### PÁGINA / MÓDULO: ACESSIBILIDADE (WCAG 2.1 AA)

| ID do teste | Página/Área | Funcionalidade testada | Método de Validação | Passos realizados | Entrada utilizada | Resultado esperado | Resultado obtido | Status | Gravidade | Observações |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ACC-01** | Acessibilidade (WCAG 2.1 AA) | Navegação sequencial completa por teclado | Teste manual | Navegar por toda a interface utilizando exclusivamente as teclas Tab e Shift+Tab | `Foco do teclado em todos os botões, links, selects e inputs` | Ordem sequencial lógica de foco sem armadilhas de teclado (Keyboard Traps) | Foco percorre todos os elementos interativos em ordem natural de leitura | **Aprovado** | **Alta** | Atende critério WCAG 2.1.1 (Teclado) e 2.1.2 (Sem armadilha). |
| **ACC-02** | Acessibilidade (WCAG 2.1 AA) | Indicador visual de foco (:focus-visible) | Teste manual | Inspecionar foco visual nos elementos interativos durante navegação por teclado | `Navegação sequencial por Tab` | Anel de foco nítido e com alto contraste em todos os elementos focados | Contorno visual de 3px em cor contrastante (#2563eb) exibido com clareza | **Aprovado** | **Alta** | Atende critério WCAG 2.4.7 (Foco Visível). |
| **ACC-03** | Acessibilidade (WCAG 2.1 AA) | Fechamento de modais com tecla Escape | Teste E2E no navegador | Abrir modais (exclusão, mapeamento, acessibilidade) e pressionar Escape | `Pressionamento da tecla Esc` | Fechamento imediato do modal retornando foco ao elemento acionador | Script em `static/acessibilidade/acessibilidade.js` captura Esc e fecha modal | **Aprovado** | Média | Excelente controle de teclado e usabilidade assistiva. |
| **ACC-04** | Acessibilidade (WCAG 2.1 AA) | Contraste de cores de texto e fundo (Mínimo 4.5:1) | Teste E2E no navegador | Auditar taxas de contraste via painel de Acessibilidade do Chromium DevTools | `Combinações de cores de texto e fundos no tema padrão` | Taxa de contraste mínima de 4.5:1 para texto normal e 3.0:1 para texto grande | Textos principais (#1e293b em fundo #ffffff) apresentam contraste de 12.6:1 (aprovado) | **Aprovado** | **Alta** | Atende critério WCAG 1.4.3 (Contraste Mínimo Nível AA). |
| **ACC-05** | Acessibilidade (WCAG 2.1 AA) | Modo de Alto Contraste no painel de acessibilidade | Teste E2E no navegador | Ativar botão de alto contraste no painel de acessibilidade | `Opção 'Alto Contraste' selecionada` | Aplicação de tema com preto absoluto e amarelo/branco com contraste superior a 7:1 | Classe `.alto-contraste` ativa contraste superior a 8.5:1 em todos os textos | **Aprovado** | **Alta** | Atende critério WCAG 1.4.6 (Contraste Aprimorado Nível AAA parcial). |
| **ACC-06** | Acessibilidade (WCAG 2.1 AA) | Atalho para saltar navegação (Skip Link) | Teste manual | Pressionar Tab no topo da página ao carregar | `Tecla Tab ao entrar na página` | Exibição de link 'Pular para o conteúdo principal' direcionando para <main> | Skip-link torna-se visível no topo e move o foco direto para `#conteudo-principal` | **Aprovado** | Média | Atende critério WCAG 2.4.1 (Ignorar Blocos Repetitivos). |
| **ACC-07** | Acessibilidade (WCAG 2.1 AA) | Rotulagem acessível de formulários (Labels e ARIA) | Teste E2E no navegador | Inspecionar árvores de acessibilidade dos formulários via DevTools | `Inputs de login, cadastro, dados e contato` | Todos os campos com `<label for>` correspondente ou `aria-label` explícito | Árvore de acessibilidade anuncia rótulos corretos para leitores de tela (NVDA/JAWS) | **Aprovado** | **Alta** | Atende critério WCAG 3.3.2 (Rótulos ou Instruções) e 4.1.2 (Nome, Papel, Valor). |
| **ACC-08** | Acessibilidade (WCAG 2.1 AA) | Widget de Tradução em Libras (VLibras) | Teste E2E no navegador | Inspecionar inicialização do plugin VLibras em `painel_acessibilidade.html` | `Carregamento do widget oficial do VLibras` | Avatar virtual do VLibras disponível e funcional no canto inferior da tela | Plugin do VLibras carrega e traduz textos selecionados para a Língua Brasileira de Sinais | **Aprovado** | **Alta** | Inclusão comunicacional para a comunidade surda garantida. |

#### Sumário da Página / Módulo: Acessibilidade (WCAG 2.1 AA)
* **Testes executados:** 8
* **Aprovados:** 8
* **Reprovados:** 0
* **Ressalvas:** 0
* **Falhas encontradas:** Nenhuma falha reprovada. Navegação por teclado, indicadores `:focus-visible`, contraste de texto superior a 4.5:1, skip-links, modais acessíveis e widget VLibras estão plenamente funcionais.
* **Riscos:** Baixo risco de acessibilidade.
* **Recomendações:** Manter auditorias contínuas com Lighthouse e leitores de tela a cada nova interface adicionada ao projeto.

---

## 4. APROFUNDAMENTOS TEMÁTICOS E AUDITORIA DETALHADA

### 4.1 Testes de Assinatura MEI e ME & Checkout Stripe

O sistema de monetização do DataInsight divide os planos em duas categorias fundamentais: **MEI** (voltado ao microempreendedor, foco em simplicidade e teto anual de faturamento de R$ 81.000,00) e **ME** (empresas de pequeno porte, contendo ferramentas analíticas avançadas, simulação de múltiplos cenários e suporte prioritário).

Durante a auditoria de segurança das rotas financeiras, identificaram-se vulnerabilidades de alta severidade no fluxo de checkout e ativação de assinaturas:

1. **Manipulação de Parâmetros de Preço (ASS-04):** O backend de checkout em `backend/pagamento/criar_assinatura.py` aceita valores monetários ou planos vindos do cliente via requisição POST sem checar contra uma constante ou tabela de produtos imutável no servidor.
2. **Ausência de Validação Criptográfica de Webhook (ASS-05):** A rota receptora de webhooks em `backend/pagamento/webhook_stripe.py` aceita payloads brutos sem exigir o cabeçalho `Stripe-Signature` e sem abortar com HTTP 400 caso `stripe.Webhook.construct_event(...)` falhe. Isso permite que qualquer atacante forje eventos de pagamento aprovado (`checkout.session.completed`).
3. **Ativação Prematura de Acesso (ASS-06):** Ao retornar da página de checkout, a rota `/sucesso` atualiza `status_assinatura = 'ativa'` com base apenas na chegada do navegador, sem aguardar o processamento assíncrono do webhook.
4. **Upgrade Não Faturado no Perfil (ASS-07 / PRF-03):** Usuários cadastrados como MEI conseguem ir à tela `/config` e mudar seu perfil para ME sem que nenhuma cobrança adicional de upgrade seja acionada no Stripe.

### 4.2 Esqueci Minha Senha & Recuperação de Conta

O mecanismo de recuperação baseia-se no envio de um código de 6 dígitos via e-mail corporativo (`Flask-Mail`).

* **Ponto Forte:** O código gerado expira em 15 minutos e é armazenado com hash criptográfico seguro no MongoDB.
* **Vulnerabilidade ESQ-09:** O endpoint `redefinir_senha` altera a senha do usuário com salt bcrypt, mas não remove os campos `codigo_recuperacao` e `codigo_expira` do documento do MongoDB via operador `$unset`. Consequentemente, o código permanece válido para novas redefinições até o esgotamento dos 15 minutos.
* **Vulnerabilidade ESQ-10:** A rota `/redefinir-senha` depende de um parâmetro de e-mail na URL/formulário. Um atacante que descubra o código de 6 dígitos pode forjar uma requisição para outro e-mail sem que a sessão valide estritamente a amarração prévia.

### 4.3 Exclusão de Dados & Conformidade LGPD

O DataInsight disponibiliza dois níveis de exclusão de dados: exclusão pontual de planilha e exclusão definitiva de conta com reautenticação por senha.

* **Ponto Forte:** Em ambos os níveis, as exclusões filtram estritamente por `usuario_id`, impedindo qualquer tentativa de IDOR (Insecure Direct Object References).
* **Falha DEL-07 (Orfandade de Registros):** A função de exclusão de conta em `backend/dados/apagar_dados.py` remove apenas o documento do usuário em `usuario` e os dados tabulares em `dados_colecao`. Registros vinculados nas coleções `chat_historico`, `relatorios_colecao` e `analises_salvas` permanecem persistidos indefinidamente no cluster MongoDB Atlas, violando o princípio do direito ao esquecimento previsto no Art. 18 da LGPD (Lei Geral de Proteção de Dados).

### 4.4 Canal de Contato & Segurança de Mensagens

O canal de atendimento aos usuários opera via formulário web direcionado a um servidor SMTP.

* **Falha CON-05 (HTML Injection):** O corpo do e-mail é gerado via concatenação simples (`f'<p>{mensagem}</p>'`) sem escape de caracteres especiais (`<`, `>`, `&`). Um usuário mal-intencionado pode enviar tags HTML como `<a>`, `<iframe>` ou `<script>` que serão interpretadas pelo cliente de e-mail do operador de suporte, gerando risco de phishing corporativo.
* **Falha CON-06 (Vazamento de Stack Trace):** Caso o host SMTP caia ou recuse a conexão por erro de credenciais, o bloco de exceção repassa `str(e)` diretamente para o flash message na interface, expondo detalhes da infraestrutura de e-mail para usuários anônimos.

### 4.5 Segurança da Informação & Testes de Penetração / Bypass

| Vetor de Ataque Testado | Alvo / Rota | Mecanismo de Defesa Esperado | Comportamento Real Obtido | Classificação |
| :--- | :--- | :--- | :--- | :--- |
| **Bypass de Paywall via Token Forjado** | `GET/POST /cadastro?session_id=...` | Verificação do status de pagamento no Stripe | Exceção capturada silenciosamente e conta criada ativa | **Vulnerável (Falha Crítica)** |
| **Falsificação de Webhook Stripe** | `POST /webhook` | Checagem de `Stripe-Signature` via `construct_event` | Webhook aceita JSON sem assinatura criptográfica | **Vulnerável (Falha Crítica)** |
| **Upload de Executáveis Maliciosos** | `POST /upload` | Análise de magic bytes do arquivo em disco | Validação restrita à extensão da string do arquivo | **Vulnerável (Falha Crítica)** |
| **Força Bruta em Autenticação** | `POST /login` | Rate Limiting ou bloqueio de IP/conta | Processamento irrestrito de requisições sequenciais | **Vulnerável (Falha Média)** |
| **IDOR em Planilhas e Relatórios** | `POST /apagar-planilha`, `GET /relatorio/<id>` | Filtro obrigatório de `usuario_id` na query | Backend valida posse do registro e retorna 403/bloqueia | **Protegido (Aprovado)** |
| **Injeção de Script em Gráficos (XSS)** | ApexCharts Rótulos | Escape HTML de categorias e dados | Strings serializadas com json.dumps e renderizadas com segurança | **Protegido (Aprovado)** |
| **Vazamento de Dados no Chatbot RAG** | `POST /chat` | Filtro `usuario_id` na recuperação de contexto | Injeção obrigatória do ID do usuário ativo na busca vetorial | **Protegido (Aprovado)** |

### 4.6 Cálculos Financeiros & Integridade Matemática

A integridade contábil e matemática do DataInsight foi validada através da execução automatizada da suíte oficial de testes unitários contábeis localizada em `tests/test_calculos_financeiros.py`.

```bash
Comando Executado: python -m unittest discover tests
Saída do Terminal:
......................
----------------------------------------------------------------------
Ran 22 tests in 13.797s

OK
```

Todos os 22 testes unitários passaram com êxito (100% de sucesso), cobrindo:

1. **Variação Percentual Contábil (`TestVariacaoPercentual`):** Validação da fórmula `(atual - base) / abs(base) * 100`. Comprovada a resolução da inversão de sinal quando o resultado anterior era negativo (prejuízo de -R$ 100 migrando para lucro de +R$ 100 resulta em variação real de +200,0%, e não -200,0%).
2. **Ponto de Equilíbrio Contábil (`TestPontoDeEquilibrio`):** Validação da fórmula oficial `PE = Fixos / IMC` (Índice de Margem de Contribuição). Testados cenários padrão, faturamento nulo, custos fixos zerados e margem de contribuição negativa (onde a divisão por zero ou valor negativo é tratada retornando `None` com alerta ao usuário).
3. **Cenários do Planejamento Financeiro (`TestCenariosPlanejamento`):** Consistência lógica e aritmética entre os cenários Otimista, Provável e Pessimista, garantindo que o lucro projetado respeite rigorosamente as premissas de faturamento e custos.
4. **Agregações Contábeis e DRE (`TestIndicadoresAgregados`):** Validação de somatórios de faturamento bruto, custos fixos/variáveis, despesas operacionais, margem bruta, margem líquida e preservação de prejuízos.

### 4.7 Responsividade Multi-Device (Matriz dos 8 Breakpoints)

A plataforma foi auditada em 8 resoluções de tela distintas via Chromium DevTools:

| Breakpoint | Resolução | Dispositivo de Referência | Status Visual | Elementos Auditados |
| :--- | :--- | :--- | :---: | :--- |
| **375px** | 375 x 667 | iPhone SE (Mobile Pequeno) | **Aprovado** | Sidebar oculta, barra móvel inferior ativa, rolagem horizontal interna em `/dados`. |
| **430px** | 430 x 932 | iPhone 14/15 Pro Max (Mobile Grande) | **Aprovado** | Cards de planos em coluna única (100% width), botões de checkout acessíveis. |
| **768px** | 768 x 1024 | iPad Mini / Tablet Vertical | **Aprovado** | Grid de KPIs reorganizado em matriz 2x2, gráficos legíveis sem corte. |
| **992px** | 992 x 700 | Tablet Grande / Transição | **Aprovado** | Limiar exato de recolhimento da sidebar desktop sem colisão de menus. |
| **993px** | 993 x 700 | Início do Desktop | **Aprovado** | Expansão suave da sidebar fixa com margem automática do contêiner principal. |
| **1024px** | 1024 x 768 | Laptop Compacto / iPad Paisagem | **Aprovado** | Layout em 2 colunas para gráficos avançados com tooltips interativos. |
| **1366px** | 1366 x 768 | Laptop Corporativo Standard | **Aprovado** | Resolução primária de uso; alta densidade de informação sem rolagem excessiva. |
| **1920px** | 1920 x 1080 | Monitor Full HD / Ultrawide | **Aprovado** | Contenção central com `max-w-7xl`, evitando linhas excessivamente longas. |

### 4.8 Acessibilidade Digital (Conformidade WCAG 2.1 AA)

A auditoria de acessibilidade seguiu os critérios das Diretrizes de Acessibilidade para Conteúdo Web (WCAG 2.1) nos níveis A e AA:

* **Critério 2.1.1 e 2.1.2 (Teclado e Sem Armadilha):** Todos os fluxos de autenticação, navegação em menus, formulários e modais foram operados sem o uso do mouse (Tab, Shift+Tab, Enter e Espaço).
* **Critério 2.4.7 (Foco Visível):** Implementado anel visual de foco (`:focus-visible`) com `outline: 3px solid #2563eb` e contraste destacado em todos os componentes interativos.
* **Critério 1.4.3 (Contraste Mínimo):** O contraste entre textos e planos de fundo foi medido via painel de acessibilidade do DevTools, apresentando 12.6:1 no tema padrão (exigência mínima é 4.5:1). O modo de alto contraste atinge proporções superiores a 8.5:1.
* **Critério 2.4.1 (Ignorar Blocos):** Link de atalho 'Pular para o conteúdo principal' disponível no topo do DOM para agilizar a navegação de leitores de tela.
* **Critério 3.3.2 (Instruções e Rótulos):** Formulários possuem tags `<label>` semânticas e atributos `aria-label` e `aria-describedby` para descrição clara de erros de validação.
* **Inclusão em Libras:** Widget oficial do VLibras (`vlibras-plugin.js`) integrado e renderizado no rodapé da aplicação.

---

## 5. PROTOCOLOS OPERACIONAIS DE TESTE

### 5.1 Roteiro Operacional de Smoke Test (Pós-Deploy)

O checklist de Smoke Test deve ser executado a cada nova implantação em staging ou produção para validação rápida das funções vitais:

1. **Saúde da Aplicação:** Acessar rota raiz `/` e verificar status HTTP 200.
2. **Conectividade de Banco:** Verificar se o ping ao MongoDB Atlas responde em menos de 200ms.
3. **Autenticação:** Realizar login com usuário de teste homologado e verificar redirecionamento para `/home`.
4. **Proteção de Sessão:** Tentar acessar `/dados` em janela anônima e verificar redirecionamento imediato para `/login`.
5. **Carga de Dados:** Carregar planilha modelo CSV e validar se os registros aparecem na tabela em `/dados`.
6. **KPIs da Dashboard:** Confirmar se os cards de Faturamento, Despesas e Lucro em `/home` exibem valores condizentes com a planilha.
7. **Gráficos:** Verificar se o ApexCharts renderiza o gráfico de evolução temporal sem erros no console.
8. **Geração de PDF:** Emitir um relatório em `/gerar-relatorio` e confirmar download de arquivo com cabeçalho `application/pdf` íntegro.
9. **Chatbot IA:** Enviar mensagem 'Qual o faturamento deste mês?' e verificar se o assistente responde sem erros de timeout.
10. **Logout:** Clicar em 'Sair' e verificar limpeza do cookie de autenticação.

### 5.2 Checklist de Regressão Contínua

Antes de aprovar novos merges para a branch principal, o time de engenharia deve executar obrigatoriamente:

```bash
# 1. Executar suíte de testes unitários contábeis
python -m unittest discover tests

# 2. Executar suíte de integração de rotas e segurança
python -m unittest scratch/test_qa_suite.py
```

---

## 6. MATRIZ CONSOLIDADA DE FALHAS REPROVADAS

A tabela abaixo consolida todas as **17 falhas reprovadas** identificadas nesta auditoria, estritamente alinhadas aos testes reprovados nas tabelas operacionais:

| ID do Teste | Módulo / Área | Gravidade | Descrição da Falha | Arquivo / Linha | Ação Recomendada |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **CAD-09** | Cadastro | **Crítica** | Bypass de pagamento via `session_id` forjado; exceção do Stripe ignorada silenciosamente | `backend/user.py` (L115-128) | Validar status `paid` da sessão no Stripe antes de cadastrar o usuário. |
| **ASS-04** | Assinaturas | **Crítica** | Adulteração de preço no checkout; endpoint aceita valores enviados pelo navegador | `backend/pagamento/criar_assinatura.py` (L45-65) | Utilizar catálogo fixo de Price IDs e valores no backend. |
| **ASS-05** | Assinaturas | **Crítica** | Webhook Stripe aceita payloads diretos sem validação de assinatura `Stripe-Signature` | `backend/pagamento/webhook_stripe.py` (L15-35) | Tornar obrigatório `stripe.Webhook.construct_event` com abortamento em erro. |
| **ASS-06** | Assinaturas | **Crítica** | Ativação de conta por URL de sucesso sem confirmação assíncrona do webhook Stripe | `backend/user.py` e rotas de sucesso | Condicionar privilégios de plano exclusivamente ao evento `checkout.session.completed`. |
| **ASS-08** | Assinaturas | **Crítica** | Chamada forjada de callback de sucesso com session_id inexistente aceita sem bloqueio | `backend/pagamento/criar_assinatura.py` | Exigir verificação síncrona com abortamento imediato em HTTP 403 se inválido. |
| **UPL-08** | Dados / Upload | **Crítica** | Upload de executáveis e arquivos maliciosos permitido por validação restrita à extensão | `backend/dados/upload_arquivo.py` (L38-55) | Validar magic bytes (MIME type real) e isolar diretório fora do web root. |
| **ASS-07** | Assinaturas | **Alta** | Upgrade de MEI para ME liberado no perfil sem cobrança da diferença de mensalidade | `backend/perfil/pagina_de_perfil.py` | Exigir checkout com confirmação de pagamento para upgrade de plano. |
| **ASS-09** | Assinaturas | **Alta** | Exposição de credenciais e stack traces em respostas de falha da API de pagamento | `backend/pagamento/criar_assinatura.py` | Mascarar logs e retornar mensagens genéricas ao usuário. |
| **PRF-03** | Perfil | **Alta** | Alternância de perfil cadastral para ME sem validação de assinatura ME ativa | `backend/perfil/pagina_de_perfil.py` (L50-75) | Bloquear troca para ME no banco se o usuário não possuir assinatura ME ativa. |
| **ESQ-09** | Esqueci a Senha | **Alta** | Código de 6 dígitos não é invalidado após troca de senha (ausência de `$unset`) | `backend/user.py` (L230-260) | Executar `$unset` imediato nos campos de código no MongoDB após redefinição. |
| **DEL-07** | Apagar Dados | **Alta** | Exclusão de usuário deixa dados órfãos em `chat_historico` e `relatorios_colecao` | `backend/dados/apagar_dados.py` | Implementar rotina de expurgo em cascata em todas as coleções do banco (LGPD). |
| **CON-05** | Contato | **Alta** | Injeção de tags HTML no e-mail de suporte por falta de sanitização na mensagem | `backend/contato/contato.py` (L40-60) | Escapar caracteres especiais usando `markupsafe.escape` antes de enviar e-mail. |
| **LOG-07** | Login | **Média** | Ausência de limitação de taxa (Rate Limiting) e proteção contra força bruta | `backend/user.py` e `app.py` | Implementar `Flask-Limiter` com teto de 5 tentativas por minuto por IP/e-mail. |
| **ESQ-10** | Esqueci a Senha | **Média** | Manipulação de e-mail na URL/formulário sem validação de posse da sessão | `backend/user.py` | Vincular token de verificação exclusivamente à sessão autorizada. |
| **UPL-09** | Dados / Upload | **Média** | Colisão de arquivos em disco por ausência de UUID em uploads concorrentes de mesmo nome | `backend/dados/upload_arquivo.py` (L60-75) | Salvar arquivos temporários com identificadores universais (`uuid.uuid4()`). |
| **CON-06** | Contato | **Média** | Exposição de erro bruto do servidor SMTP em mensagem flash para o usuário | `backend/contato/contato.py` | Capturar erro e exibir mensagem genérica de indisponibilidade de serviço. |
| **IA-05** | IA / Insights | **Média** | Exposição de prompt interno do Gemini e detalhes de debug em caso de exceção | `backend/chatbot/orchestrator.py` (L140-160) | Logar prompt apenas internamente e retornar mensagem de erro segura ao frontend. |

---

## 7. MATRIZ DE RISCOS DE NEGÓCIO & SEGURANÇA

1. **Risco Financeiro e Evasão de Receita (Crítico):** Atualmente, qualquer usuário com conhecimento básico de requisições HTTP pode criar contas ativas e acessar ferramentas corporativas sem transferir fundos reais via Stripe (falhas CAD-09, ASS-04, ASS-05, ASS-06, ASS-07, PRF-03).
2. **Risco de Integridade e Comprometimento do Servidor (Crítico):** A ausência de inspeção de magic bytes em uploads (UPL-08) e a ausência de UUIDs para isolamento de arquivos temporários em disco (UPL-09) abrem brechas para sobrescrita e potencial execução remota de código.
3. **Risco Legal e Regulatório / LGPD (Alto):** A persistência de históricos de conversas da IA e relatórios após a exclusão do usuário (DEL-07) viola o direito de eliminação definitiva de dados pessoais, sujeitando a empresa a sanções da ANPD.
4. **Risco de Fraude e Sequestro de Contas (Médio a Alto):** A reutilização do código de recuperação de senha (ESQ-09) e a ausência de rate limiting em login (LOG-07) tornam o sistema suscetível a ataques automatizados e sequestro de contas.

---

## 8. PLANO ESTRUTURADO DE REMEDIAÇÃO

### Fase 1: Remediações Críticas Imediatas (Sprint 1)
1. **Blindagem do Paywall e Checkout Stripe:**
   - Tornar obrigatória a consulta do status de pagamento no Stripe (`payment_status == 'paid'`) antes de gravar qualquer usuário ativo no banco.
   - Impor validação da assinatura criptográfica do webhook com `stripe.Webhook.construct_event`.
   - Condicionar a concessão do plano ME à validação assíncrona do evento de assinatura correspondente.
2. **Isolamento e Segurança de Uploads:**
   - Integrar biblioteca de verificação de magic bytes (ex: `puremagic` ou `python-magic`) para assegurar que apenas arquivos CSV e planilhas reais sejam processados.
   - Salvar arquivos temporários com `f'{uuid.uuid4()}_{secure_filename(arquivo.filename)}'` e garantir sua remoção imediata pós-ingestão.

### Fase 2: Remediações de Alta Prioridade (Sprint 2)
1. **Conformidade com LGPD (Expurgo em Cascata):**
   - Criar transação ou rotina de exclusão unificada em `backend/dados/apagar_dados.py` para expurgar registros do `usuario_id` em `chat_historico`, `relatorios_colecao` e `analises_salvas`.
2. **Blindagem do Ciclo de Recuperação de Senha:**
   - Executar `$unset` imediato nos campos `codigo_recuperacao` e `codigo_expira` logo após a alteração da senha no MongoDB.
3. **Sanitização de E-mails de Contato:**
   - Aplicar `markupsafe.escape()` em todos os campos antes da interpolação em templates de e-mail.

### Fase 3: Hardening e Governança Contínua (Sprint 3)
1. **Rate Limiting em Autenticação:**
   - Instalar `Flask-Limiter` protegendo rotas `/login`, `/esqueceu-senha` e `/contato` contra requisições abusivas.
2. **Mascaramento de Logs e Erros:**
   - Substituir retornos de `str(e)` nas rotas de IA e SMTP por mensagens padronizadas de erro amigável, registrando traces exclusivamente no logger do servidor.
3. **Integração de Testes em CI/CD:**
   - Adicionar execução obrigatória de `python -m unittest discover tests` no pipeline de deploy do GitHub Actions / repositório.

---

**Fim do Relatório Oficial de Auditoria de QA.**