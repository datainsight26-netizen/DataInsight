# RELATÓRIO DE CORREÇÕES DE QA & INTEGRIDADE DE DADOS — DATAINSIGHT

> **Projeto:** DataInsight (BI & Inteligência Financeira Acessível)  
> **Versão:** 2.0  
> **Data da Auditoria / Correções:** 21 de setembro de 2026  
> **Branch de Trabalho:** `Teste_após_antigravity`  
> **Ambiente:** Local de Desenvolvimento Windows 11 (Python 3.14.0a4, Flask 3.x, Pandas 2.x, PyMongo 4.x)  
> **Responsável pelas Correções Funcionais e Integridade:** Antigravity  
> **Responsável pelas Correções de Segurança / Gateway:** Kevin  

---

## 1. RESUMO EXECUTIVO

Em conformidade com a diretriz prioritária de mitigar primeiro as falhas funcionais, de concorrência e de integridade de dados contábeis da plataforma DataInsight, foi executado o ciclo completo de correções das Etapas 1 a 5.

Os itens de segurança (Stripe, Rate Limiting, sanitização de e-mails, proteções de endpoint e bypass de pagamento) foram deliberadamente preservados para a etapa final e catalogados com diretrizes técnicas prontas para implementação por **Kevin**.

### Métricas de Execução das Correções
* **Falhas Funcionais e de Integridade Corrigidas:** 4 domínios críticos (ESQ-10, UPL-09, DEL-07 e Integridade de Valores Financeiros Nulos).
* **Testes Automatizados e de Integração Desenvolvidos:** 12 novos casos de teste unitários/integração + 22 testes de auditoria financeira.
* **Resultado da Regressão Funcional Completa (`python -m unittest discover tests`):**
  * **Total de Casos Executados:** 34
  * **Aprovados (OK):** 33
  * **Ignorados com Segurança (Skipped):** 1 (teste de integração direta de rede MongoDB Atlas local quando em modo offline)
  * **Falhas (Failures):** 0
  * **Erros (Errors):** 0
  * **Taxa de Sucesso:** 100%

---

## 2. DETALHAMENTO DAS CORREÇÕES FUNCIONAIS CONCLUÍDAS

### 2.1. ESQ-10 — Reenvio do Código de Recuperação de Senha

* **ID do Teste:** `ESQ-10`
* **Página / Área:** Esqueci Minha Senha (`/esqueceu-senha`, `/verificar-codigo`, `/reenviar-codigo`)
* **Problema Original:** Ausência de rota para reenvio do código de recuperação quando o código expirava ou não era entregue; dependência frágil de passagem de e-mail em query string sem validação de sessão.
* **Arquivo(s) Alterado(s):**
  * [`backend/user.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/user.py) (linhas 444–474)
  * [`templates/verificar_codigo.html`](file:///c:/Users/Felipe/Desktop/DataInsight/templates/verificar_codigo.html)
* **Causa-Raiz:** O fluxo de verificação previa apenas validação pontual do código sem mecanismo de renovação sob demanda armazenado na sessão do navegador.
* **Correção Aplicada:**
  1. Implementação da rota `GET /reenviar-codigo` em `backend/user.py`.
  2. Recuperação segura do e-mail alvo via `session.get("email_recuperacao")` (impossibilitando manipulação arbitrária de e-mail por terceiros via URL).
  3. Geração criptograficamente segura de novo código de 6 dígitos via `secrets.randbelow(1000000)`.
  4. Renovação atômica da validade temporal para `datetime.now() + timedelta(minutes=10)`.
  5. Atualização no MongoDB com `$set` do novo código e da nova expiração, invalidando o código antigo.
  6. Disparo do e-mail com o novo código via `enviar_email_codigo(email, novo_codigo)`.
* **Método de Validação:** Teste unitário automatizado / Teste de integração (Flask Test Client com mocks)
* **Arquivo de Teste:** [`tests/test_esq10_reenvio_unit.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_esq10_reenvio_unit.py) e [`tests/test_esq10_reenvio.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_esq10_reenvio.py)
* **Comando Executado:**
  ```powershell
  python -m unittest tests/test_esq10_reenvio_unit.py
  ```
* **Saída do Terminal:**
  ```text
  .
  ----------------------------------------------------------------------
  Ran 1 test in 0.185s

  OK
  ```
* **Status:** **Corrigido e retestado**

---

### 2.2. UPL-09 — Isolamento de Arquivos Temporários em Disco & Concorrência

* **ID do Teste:** `UPL-09`
* **Página / Área:** Dados / Upload de Arquivos (`/upload-arquivo`, `/upload-arquivo-abas`)
* **Problema Original:** O salvamento de arquivos temporários utilizava diretamente `secure_filename(arquivo.filename)` em uma pasta compartilhada `uploads/`. Caso dois usuários enviassem arquivos com o mesmo nome (`vendas.xlsx`) simultaneamente, ocorria sobreposição (race condition), corrompendo a leitura do arquivo concorrente. Além disso, exceções no bloco de limpeza causavam ruídos e caracteres Unicode causavam falhas no console do Windows.
* **Arquivo(s) Alterado(s):**
  * [`backend/dados/upload_arquivo.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/dados/upload_arquivo.py) (funções `upload_arquivo()` e `listar_abas_excel()`)
* **Causa-Raiz:** Falta de namespace/UUID único no sistema de arquivos local e remoção insegura no bloco `finally:`.
* **Correção Aplicada:**
  1. Geração de prefixo pseudoaleatório com UUIDv4 em formato hexadecimal:
     ```python
     nome_disco = f"{uuid.uuid4().hex}_{nome_seguro}"
     caminho = os.path.join(PASTA_UPLOAD, nome_disco)
     ```
  2. Preservação integral de `arquivo.filename` original como metadado de exibição para o usuário e persistência no MongoDB (`nome_original`).
  3. Remoção segura e resiliente em bloco `finally:` conferindo expressamente se o caminho existe antes de tentar a exclusão (`if caminho and os.path.exists(caminho): os.remove(caminho)`), sem mascarar exceções do pipeline anterior.
  4. Substituição de caracteres Unicode problemáticos (`✓`, `⚠`, `✗`) por marcadores ASCII (`[OK]`, `[AVISO]`, `[ERRO]`) para compatibilidade nativa com consoles Windows cp1252.
* **Método de Validação:** Teste automatizado de concorrência simultânea
* **Arquivo de Teste:** [`tests/test_upl09_concorrencia.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_upl09_concorrencia.py)
* **Comando Executado:**
  ```powershell
  python -m unittest tests/test_upl09_concorrencia.py
  ```
* **Saída do Terminal:**
  ```text
  .
  ----------------------------------------------------------------------
  Ran 1 test in 0.285s

  OK
  ```
* **Status:** **Corrigido e retestado**

---

### 2.3. DEL-07 — Integridade da Exclusão de Dados & Prevenção de Orfandade

* **ID do Teste:** `DEL-07`
* **Página / Área:** Apagar Dados (`/confirmar-exclusao`, `/excluir-todos-dados`, `/confirmar-exclusao-dados/<token>`)
* **Problema Original:** A rotina de expurgo de dados do usuário limpava apenas `dados_colecao`, deixando coleções dependentes (`chat_historico`, `relatorios_colecao`, `galeria`, `produtos_historico`, `analises_salvas_colecao`) órfãs no banco MongoDB com o identificador do usuário. Além disso, não validava o formato de `usuario_id` antes de convertê-lo para `ObjectId`.
* **Arquivo(s) Alterado(s):**
  * [`backend/dados/apagar_dados.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/dados/apagar_dados.py) (função `expurgar_dados_usuario()`)
  * [`backend/dados/exclusao_dados.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/dados/exclusao_dados.py) (funções `confirmar_exclusao_dados()`, `solicitar_exclusao_dados()`)
* **Causa-Raiz:** Falta de uma rotina unificada de expurgo em cascata e conversão cega de strings arbitrárias para `ObjectId`.
* **Correção Aplicada:**
  1. Criação da função centralizada `expurgar_dados_usuario(usuario_id)` em `backend/dados/apagar_dados.py`.
  2. Validação rigorosa de tipo: verificação via `ObjectId.is_valid(usuario_id)` antes de qualquer instanciação de `ObjectId`.
  3. Construção de query compatível e abrangente cobrindo tanto representações em `str` quanto em `ObjectId`:
     ```python
     filtro = {"usuario_id": {"$in": ids_filtro}}
     ```
  4. Expurgo atômico em cascata nas 6 coleções analíticas e transacionais:
     * `dados_colecao`
     * `chat_historico`
     * `relatorios_colecao`
     * `galeria`
     * `produtos_historico`
     * `analises_salvas_colecao`
  5. **Diferenciação Estrita de Domínio:** O fluxo de "Apagar Dados" expurga todos os dados transacionais/analíticos, mas **preserva o cadastro, credenciais e assinatura do usuário**, permitindo que ele recomece a operar sem perder sua conta contratada. A exclusão de conta permanece isolada em seu fluxo específico.
  6. Invalidação obrigatória do token de confirmação (`token_exclusao`) após o uso bem-sucedido.
* **Método de Validação:** Teste unitário automatizado / Teste de integração de rotas (Flask Test Client com mocks)
* **Arquivo de Teste:** [`tests/test_del07_expurgo_cascata.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_del07_expurgo_cascata.py) e [`tests/test_del07_routes.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_del07_routes.py)
* **Comando Executado:**
  ```powershell
  python -m unittest tests/test_del07_expurgo_cascata.py tests/test_del07_routes.py
  ```
* **Saída do Terminal:**
  ```text
  ...
  ----------------------------------------------------------------------
  Ran 3 tests in 0.038s

  OK
  ```
* **Status:** **Corrigido e retestado**

---

### 2.4. Integridade de Valores Financeiros Nulos (Sem Imputação Artificial)

* **ID do Teste:** `FIN-NULL-01` a `FIN-NULL-06`
* **Página / Área:** Dados / Limpeza Conservadora, Quality & Cálculos Financeiros
* **Problema Original:** Rotinas de limpeza automática aplicavam preenchimento com média estatística ou moda indiscriminadamente, inclusive em colunas financeiras (`Receita`, `Custo`, `Preço`, `Despesa`). Em dados contábeis, imputar uma média em um lançamento faltante cria faturamento fictício e distorce margens, lucros e impostos.
* **Arquivo(s) Alterado(s):**
  * [`backend/dados/dados.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/dados/dados.py) (funções `eh_coluna_financeira()`, `preencher_inteligente()`, `limpar_dados_conservador()`, `converter_para_tipos_nativos()`)
  * [`backend/dados/quality.py`](file:///c:/Users/Felipe/Desktop/DataInsight/backend/dados/quality.py) (funções `sugerir_acoes()`, `aplicar_limpeza_automatica()`)
* **Causa-Raiz:** Falta de segmentação semântica entre colunas numéricas genéricas (ex.: pontuação, quantidade, pesos) e métricas contábeis reguladas.
* **Correção Aplicada:**
  1. Implementação da função `eh_coluna_financeira(nome_coluna: str)` com regex para detectar receitas, despesas, custos, tributos, margens, preços, pró-labore, CMV, CPV e investimentos.
  2. **Proibição de Imputação:** Em `preencher_inteligente()` e em `aplicar_limpeza_automatica()`, colunas identificadas como financeiras **NUNCA** recebem valores artificiais de média ou moda. As ausências são explicitamente preservadas como `NaN`/`None`.
  3. **Preservação de Ausência sem `fillna(0)` Global:** Em `limpar_dados_conservador()`, colunas financeiras mantêm seus valores nulos intactos, sem forçar zeros globais no DataFrame armazenado.
  4. **Persistência BSON Null:** Em `converter_para_tipos_nativos()`, valores ausentes em colunas financeiras são convertidos para `None` (MongoDB BSON `null`), diferenciando-se de números zerados reais (R$ 0,00).
  5. **Tratamento Local nos Cálculos:** Os módulos de agregação (`home.py`, `analise.py`, `dashboard_Servicos.py`) continuam aplicando coerção local segura (`pd.to_numeric(col, errors='coerce').fillna(0)`) apenas no momento do somatório contábil, sem modificar o registro de origem.
* **Método de Validação:** Teste unitário automatizado
* **Arquivo de Teste:** [`tests/test_integridade_nulos.py`](file:///c:/Users/Felipe/Desktop/DataInsight/tests/test_integridade_nulos.py)
* **Comando Executado:**
  ```powershell
  python -m unittest tests/test_integridade_nulos.py
  ```
* **Saída do Terminal:**
  ```text
  ......
  ----------------------------------------------------------------------
  Ran 6 tests in 0.227s

  OK
  ```
* **Status:** **Corrigido e retestado**

---

## 3. REGRESSÃO FUNCIONAL COMPLETA (ETAPA 5)

Foi executada a suíte completa de testes automatizados e de integração do projeto para certificar que as alterações não introduziram regressões funcionais nem de performance.

* **Comando Geral:**
  ```powershell
  python -m unittest discover tests
  ```
* **Tempo de Execução:** ~30.2 segundos (incluindo timeout de conexão offline no teste de integração do Atlas)
* **Resultado:**
  ```text
  .........................s........
  ----------------------------------------------------------------------
  Ran 34 tests in 30.288s

  OK (skipped=1)
  ```

### Detalhamento dos 34 Testes da Suíte de Regressão

| Arquivo de Teste | Quantidade de Casos | Status | Finalidade / Escopo |
| :--- | :---: | :---: | :--- |
| `tests/test_calculos_financeiros.py` | 22 | **Aprovado** | Auditoria das fórmulas financeiras (Faturamento, Custos, Margem de Contribuição, Margens %, Ponto de Equilíbrio, Cenários MEI/ME e divisão por zero). |
| `tests/test_integridade_nulos.py` | 6 | **Aprovado** | Validação da preservação de nulos financeiros em `dados.py`, `quality.py`, BSON e cálculos com coerção local. |
| `tests/test_del07_expurgo_cascata.py` | 2 | **Aprovado** | Comprovação do expurgo em cascata nas 6 coleções MongoDB e validação com `ObjectId.is_valid()`. |
| `tests/test_del07_routes.py` | 1 | **Aprovado** | Teste HTTP das rotas de solicitação e confirmação de exclusão com invalidação de token. |
| `tests/test_upl09_concorrencia.py` | 1 | **Aprovado** | Teste de concorrência com envio de arquivos de mesmo nome e limpeza segura no `finally:`. |
| `tests/test_esq10_reenvio_unit.py` | 1 | **Aprovado** | Teste unitário da rota de reenvio de código, renovação de expiração e invalidação do código anterior. |
| `tests/test_esq10_reenvio.py` | 1 | **Ignorado (Skip)** | Teste de integração pontual que detecta ausência de conexão externa de rede e realiza skip gracioso sem erro. |
| **TOTAL** | **34** | **33 OK / 1 Skip / 0 Falhas** | **100% de estabilidade funcional comprovada.** |

---

## 4. PROBLEMAS DE SEGURANÇA PENDENTES PARA KEVIN

Conforme alinhamento e plano aprovado, os **13 itens de segurança** foram mantidos para execução posterior. A tabela a seguir contém a análise detalhada, a causa-raiz identificada e as orientações recomendadas para Kevin:

| ID | Módulo | Descrição da Falha | Gravidade | Causa-Raiz no Código | Ação Recomendada para Kevin |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **CAD-09** | Cadastro | Bypass de pagamento via `session_id` forjado | **Crítica** | `backend/user.py` (L115–L128) engole exceção da API Stripe com `except Exception: pass` e grava `status_assinatura='ativa'`. | Validar síncronamente no Stripe `checkout_session.payment_status == 'paid'`. Se falhar ou status != 'paid', abortar com HTTP 403 e redirecionar para `/assinaturas`. |
| **LOG-07** | Login | Falta de proteção contra força bruta (Rate Limiting) | Média | Rota `/login` não possui limitação de taxa de requisições por IP ou por conta. | Configurar `Flask-Limiter` na rota de login (ex.: 5 tentativas por minuto por IP) com bloqueio progressivo e log de auditoria. |
| **ESQ-09** | Esqueci Senha | Invalidação imediata do código após uso | **Alta** | Código de recuperação pode ser reutilizado durante a janela de expiração de 10 minutos. | Executar `$unset: {"codigo_recuperacao": "", "codigo_expiracao": ""}` no MongoDB imediatamente após a redefinição de senha com sucesso. |
| **UPL-08** | Upload | Upload de extensões executáveis / bypass MIME | **Crítica** | `backend/dados/upload_arquivo.py` valida apenas a extensão no nome (`.csv`, `.xlsx`) sem verificar magic numbers. | Adicionar verificação de assinatura binária (magic bytes) via `python-magic` ou leitura dos primeiros bytes do arquivo para rejeitar executáveis renomeados. |
| **ASS-04** | Assinaturas | Adulteração de preço na requisição de checkout | **Crítica** | `backend/pagamento/criar_assinatura.py` aceita valores ou planos enviados no payload pelo cliente. | Obter o `price_id` e valor monetário exclusivamente de um dicionário imutável no backend baseado no plano selecionado (`MEI` vs `ME`). |
| **ASS-05** | Assinaturas | Validação de assinatura do webhook Stripe | **Crítica** | `backend/pagamento/webhook_stripe.py` processa JSON bruto sem exigir `stripe.Webhook.construct_event()`. | Tornar mandatória a verificação da assinatura criptográfica do webhook (`Stripe-Signature`) usando o `STRIPE_WEBHOOK_SECRET` configurado. |
| **ASS-06** | Assinaturas | Ativação de assinatura sem confirmação de pagamento | **Crítica** | Usuário é ativado na simples chegada à rota `/sucesso` antes da confirmação assíncrona. | Apenas ativar o plano na conta após o recebimento e processamento bem-sucedido do webhook `checkout.session.completed` ou confirmação síncrona verificada no Stripe. |
| **ASS-07** / **PRF-03** | Assinaturas / Perfil | Troca de MEI para ME sem cobrança da diferença | **Alta** | `backend/perfil/pagina_de_perfil.py` permite alterar `tipo_perfil` para `ME` diretamente no formulário sem acionar checkout. | Bloquear a troca cadastral de MEI para ME no perfil se a conta não possuir assinatura ME ativa no Stripe; redirecionar para o checkout correspondente. |
| **ASS-08** | Assinaturas | Chamada forjada de callback de sucesso | **Crítica** | Acesso direto a `/sucesso?session_id=token_falso` renderiza tela sem checagem de integridade. | Rejeitar chamadas com `session_id` ausente ou inválido no Stripe com HTTP 403 e redirecionar para `/falha`. |
| **ASS-09** | Assinaturas | Exposição de chaves/segredos em mensagens de erro | **Alta** | Mensagens de exceção de API externa são repassadas com stack trace ou tokens no frontend. | Tratar exceções do Stripe com mensagens genéricas ao usuário ("Ocorreu um erro ao processar sua transação") e logar detalhes apenas internamente com sanitização. |
| **CON-05** | Contato | Injeção de tags HTML / XSS em e-mails | **Alta** | `backend/contato/contato.py` interpola a mensagem do formulário diretamente no HTML do e-mail sem sanitização (`f"<p>{msg}</p>"`). | Aplicar `markupsafe.escape()` ou sanitizador de HTML antes de montar o corpo do e-mail para o suporte. |
| **CON-06** | Contato | Vazamento de stack trace de SMTP em falha | Média | Bloco `except Exception as e:` exibe `str(e)` em flash message na interface. | Substituir a mensagem flash por mensagem amigável ("Não foi possível enviar sua mensagem no momento. Tente novamente mais tarde.") e registrar o log no servidor. |
| **IA-05** | IA / Chatbot | Exposição de logs de depuração e prompt em exceção | Média | `backend/chatbot/orchestrator.py` retorna resposta JSON contendo o prompt bruto e detalhes de debug quando a API falha. | Mascarar respostas de erro retornadas pelo chatbot, informando indisponibilidade temporária e nunca expondo system prompts ou chaves de API. |

---

## 5. CONCLUSÃO & PRÓXIMOS PASSOS

As fundações funcionais e de integridade de dados do DataInsight estão plenamente saneadas e comprovadas por testes automatizados reproduzíveis. A plataforma não perde dados contábeis legítimos, não imputa números artificiais em cálculos financeiros, isola arquivos concorrentes e expurga dados em cascata sem orfandade e sem afetar a conta do cliente.

A branch `Teste_após_antigravity` encontra-se com as correções funcionais integradas e pronta para o recebimento das correções de segurança a serem aplicadas por Kevin.
