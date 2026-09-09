/**
 * DataInsight — Relatórios Executivos Reais
 * Integração completa: Análises Salvas da IA, Fluxo de Caixa, Planejamento Financeiro,
 * Gráficos Avançados e Consolidação do Negócio com Insights 100% Reais.
 */

// =============================
// ESTADO GLOBAL
// =============================
const estadoRelatorio = {
  tipo: 'consolidado',
  planilhaId: 'todas',
  analiseId: null,
  cenarioPlanejamento: 'provavel',
  analisesSalvas: [],
  planilhas: [],
  dadosConsolidados: null,
  dadosFluxoCaixa: null,
  dadosPlanejamento: null,
  analiseSelecionada: null,
  relatorioAtual: null
};

// =============================
// UTILITÁRIOS
// =============================
function numeroValido(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number" && !Number.isNaN(valor)) return valor;

  const convertido = Number(String(valor).replace(/[^0-9-,.]/g, "").replace(/,/g, "."));
  return Number.isNaN(convertido) ? 0 : convertido;
}

function getCheckbox(id) {
  return document.getElementById(id)?.checked === true;
}

function formatarValor(valor) {
  const num = Number(valor) || 0;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarMoeda(valor) {
  const num = Number(valor) || 0;
  const sinal = num < 0 ? '- ' : '';
  return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarPercentual(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '0,0%';
  const num = Number(valor);
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function somaValores(valores = []) {
  return valores.reduce((total, valor) => total + (Number(valor) || 0), 0);
}

function calcCrescimento(valores = []) {
  if (!valores || valores.length < 2) return '0.0%';

  const primeiro = Number(valores[0]) || 0;
  const ultimo = Number(valores[valores.length - 1]) || 0;

  if (primeiro === 0) {
    return ultimo === 0 ? '0.0%' : 'N/A';
  }

  const variacao = ((ultimo - primeiro) / Math.abs(primeiro)) * 100;
  const sinal = variacao > 0 ? '+' : '';
  return `${sinal}${variacao.toFixed(1)}%`;
}

function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderizarConteudoTexto(conteudo) {
  if (conteudo === null || conteudo === undefined || conteudo === '') return '';
  let str = String(conteudo).trim();

  // Se já contém tags HTML formatadas da IA (<h3>, <p>, <ul>, <li>, <strong>, etc.)
  const temTagsHtml = /<(h[1-6]|p|ul|ol|li|strong|b|em|i|span|div|table|br)[\s>/]/i.test(str);

  if (temTagsHtml) {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '');
  }

  // Se for Markdown com cabeçalhos ou negritos
  if (/[#*_`-]/.test(str)) {
    let fmt = escapeHtml(str);
    fmt = fmt.replace(/^### (.*$)/gim, '<h4 style="margin:14px 0 6px 0;color:var(--primaria);font-weight:700;">$1</h4>');
    fmt = fmt.replace(/^## (.*$)/gim, '<h3 style="margin:16px 0 8px 0;color:var(--texto);font-weight:800;">$1</h3>');
    fmt = fmt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    fmt = fmt.replace(/\*(.*?)\*/g, '<em>$1</em>');
    fmt = fmt.replace(/\n/g, '<br>');
    return fmt;
  }

  // Texto simples
  return `<p style="margin:0;line-height:1.65;">${escapeHtml(str)}</p>`;
}

function renderizarConteudoInline(texto) {
  if (texto === null || texto === undefined || texto === '') return '';
  let str = String(texto).trim();

  const temTagsHtml = /<(strong|b|em|i|span|a|code)[\s>/]/i.test(str);
  if (temTagsHtml) {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '');
  }

  if (/\*\*(.*?)\*\*/.test(str)) {
    return escapeHtml(str).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  return escapeHtml(str);
}

/* =============================================
   TOGGLE CHECK — Estado visual dos cards
============================================= */
function toggleCheck(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = !el.checked;
  const wrap = document.getElementById('wrap-' + id);
  if (wrap) wrap.classList.toggle('selecionado', el.checked);
}

/* =============================================
   TOAST NOTIFICATIONS
============================================= */
function showToast(msg, tipo = 'success') {
  const toast = document.getElementById('toast-rel');
  const msgEl = document.getElementById('toast-msg');
  if (!toast || !msgEl) return;

  const icon = toast.querySelector('i');
  msgEl.textContent = msg;
  toast.className = tipo;
  if (icon) {
    icon.className = tipo === 'success'
      ? 'fa-solid fa-circle-check'
      : tipo === 'error'
        ? 'fa-solid fa-circle-exclamation'
        : 'fa-solid fa-circle-info';
  }
  toast.classList.add('visivel');
  setTimeout(() => toast.classList.remove('visivel'), 3500);
}

// =============================================
// GERENCIAMENTO DE TIPOS DE RELATÓRIO
// =============================================
function aoMudarTipoRelatorio() {
  const tipo = document.getElementById('tipoRelatorio')?.value || 'consolidado';
  estadoRelatorio.tipo = tipo;

  const campoAnalise = document.getElementById('campoAnaliseSalva');
  const campoPlanilha = document.getElementById('campoPlanilhaRel');
  const campoCenario = document.getElementById('campoCenarioPlan');
  const campoPeriodo = document.getElementById('campoPeriodoRel');
  const nomeRelInput = document.getElementById('nomeRel');

  // Ajusta visibilidade dos campos específicos
  if (campoAnalise) campoAnalise.style.display = tipo === 'analise_salva' ? 'block' : 'none';
  if (campoPlanilha) campoPlanilha.style.display = tipo === 'analise_salva' ? 'none' : 'block';
  if (campoCenario) campoCenario.style.display = tipo === 'planejamento' ? 'block' : 'none';
  if (campoPeriodo) campoPeriodo.style.display = tipo === 'analise_salva' ? 'none' : 'block';

  // Sugestões de nomes amigáveis para cada tipo
  if (nomeRelInput) {
    const nomesPadrao = {
      analise_salva: 'Relatório de Diagnóstico IA',
      fluxo_caixa: 'Relatório de Fluxo de Caixa & Tesouraria',
      planejamento: 'Relatório de Planejamento Financeiro & Metas',
      graficos_avancados: 'Relatório Executivo de Performance',
      consolidado: 'Relatório Consolidado do Negócio'
    };
    nomeRelInput.value = nomesPadrao[tipo] || 'Relatório de Negócio';
  }

  // Atualizar rótulos das seções incluídas para refletir o tipo
  atualizarRotulosOpcoes(tipo);

  // Se for análise salva e já tiver selecionada, atualiza dados
  if (tipo === 'analise_salva') {
    aoSelecionarAnaliseSalva();
  }
}

function atualizarRotulosOpcoes(tipo) {
  const lblKpi = document.getElementById('lbl-opt-kpi');
  const lblDiag = document.getElementById('lbl-opt-diagnostico');
  const lblPontos = document.getElementById('lbl-opt-pontos-riscos');
  const lblRecs = document.getElementById('lbl-opt-recomendacoes');
  const lblGraf = document.getElementById('lbl-opt-grafico');
  const lblDados = document.getElementById('lbl-opt-dados');

  if (tipo === 'fluxo_caixa') {
    if (lblKpi) lblKpi.textContent = 'Entradas, Saídas, Saldo Líquido e Margem de Caixa';
    if (lblDiag) lblDiag.textContent = 'Diagnóstico de liquidez, solvência e queima de caixa';
    if (lblPontos) lblPontos.textContent = 'Top fontes de receitas e maiores centros de despesas';
    if (lblRecs) lblRecs.textContent = 'Recomendações de tesouraria e capital de giro';
    if (lblGraf) lblGraf.textContent = 'Gráfico de Entradas x Saídas x Saldo Mensal';
    if (lblDados) lblDados.textContent = 'Tabela de movimentações mês a mês e categorias';
  } else if (tipo === 'planejamento') {
    if (lblKpi) lblKpi.textContent = 'Receita Anual, Margem de Contribuição e Ponto de Equilíbrio';
    if (lblDiag) lblDiag.textContent = 'Diagnóstico das projeções e viabilidade dos 12 meses';
    if (lblPontos) lblPontos.textContent = 'Meses críticos no vermelho vs meses de maior margem';
    if (lblRecs) lblRecs.textContent = 'Estratégias de corte de fixos e alavancagem de vendas';
    if (lblGraf) lblGraf.textContent = 'Gráfico dos 12 Meses: Receitas, Despesas e Resultado';
    if (lblDados) lblDados.textContent = 'Tabela do Planejamento 12 Meses com custos abertos';
  } else if (tipo === 'analise_salva') {
    if (lblKpi) lblKpi.textContent = 'Métricas calculadas no momento da análise';
    if (lblDiag) lblDiag.textContent = 'Diagnóstico executivo e veredito formulado pela IA';
    if (lblPontos) lblPontos.textContent = 'Pontos fortes observados e alertas de riscos';
    if (lblRecs) lblRecs.textContent = 'Plano de ação e recomendações estratégicas da IA';
    if (lblGraf) lblGraf.textContent = 'Gráfico de métricas representativas';
    if (lblDados) lblDados.textContent = 'Detalhamento das métricas em tabela';
  } else {
    if (lblKpi) lblKpi.textContent = 'Faturamento, Lucro, Despesas e Margem Líquida';
    if (lblDiag) lblDiag.textContent = 'Síntese matemática e estratégica calculada dos dados';
    if (lblPontos) lblPontos.textContent = 'Destaques operacionais e vulnerabilidades mitigadas';
    if (lblRecs) lblRecs.textContent = 'Plano de ação prático e orientações de gestão';
    if (lblGraf) lblGraf.textContent = 'Evolução temporal e séries de desempenho';
    if (lblDados) lblDados.textContent = 'Abertura completa de contas mês a mês';
  }
}

// =============================================
// CARREGAMENTO DE DADOS DAS APIS
// =============================================
async function carregarSumarioPlanilhas() {
  const select = document.getElementById('seletorPlanilhaRel');
  if (!select) return;

  try {
    const resp = await fetch('/api/planilhas/sumario');
    if (!resp.ok) return;
    const json = await resp.json();
    const planilhas = json.planilhas || [];
    estadoRelatorio.planilhas = planilhas;

    select.innerHTML = '';
    const optTodas = document.createElement('option');
    optTodas.value = 'todas';
    optTodas.textContent = `🌐 Todas as Planilhas (Relatório Consolidado - ${planilhas.length})`;
    select.appendChild(optTodas);

    planilhas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
      opt.textContent = `${icone} [${p.dominio_label}] ${p.nome} (${p.total_linhas} linhas)`;
      select.appendChild(opt);
    });

    const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
    if (salva && (salva === 'todas' || planilhas.some(p => p.id === salva))) {
      select.value = salva;
      estadoRelatorio.planilhaId = salva;
    }

    select.addEventListener('change', e => {
      estadoRelatorio.planilhaId = e.target.value;
      localStorage.setItem('DataInsight_DashboardPlanilha', estadoRelatorio.planilhaId);
    });
  } catch (e) {
    console.warn('Aviso ao carregar planilhas em relatórios:', e);
  }
}

async function carregarAnalisesSalvas() {
  const select = document.getElementById('seletorAnaliseSalva');
  if (!select) return;

  try {
    const resp = await fetch('/api/analises-salvas');
    if (!resp.ok) return;
    const json = await resp.json();
    const analises = json.analises || [];
    estadoRelatorio.analisesSalvas = analises;

    select.innerHTML = '';
    if (analises.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Nenhuma análise salva encontrada (gere uma análise na IA)';
      select.appendChild(opt);
      return;
    }

    analises.forEach((a, idx) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `[${a.pagina_nome || a.pagina.toUpperCase()}] ${a.titulo} • ${a.criado_em_fmt}`;
      if (idx === 0) opt.selected = true;
      select.appendChild(opt);
    });

    // Se houver parâmetro na URL, seleciona a análise indicada
    const params = new URLSearchParams(window.location.search);
    const analiseUrlId = params.get('analise_id');
    if (analiseUrlId && analises.some(a => String(a.id) === String(analiseUrlId))) {
      select.value = analiseUrlId;
      document.getElementById('tipoRelatorio').value = 'analise_salva';
      aoMudarTipoRelatorio();
    }

    aoSelecionarAnaliseSalva();
  } catch (e) {
    console.warn('Erro ao carregar análises salvas:', e);
  }
}

function aoSelecionarAnaliseSalva() {
  const select = document.getElementById('seletorAnaliseSalva');
  const id = select?.value;
  if (!id) return;

  const achada = estadoRelatorio.analisesSalvas.find(a => String(a.id) === String(id));
  if (achada) {
    estadoRelatorio.analiseSelecionada = achada;
    estadoRelatorio.analiseId = achada.id;
    const nomeInput = document.getElementById('nomeRel');
    if (nomeInput && (!nomeInput.dataset.editadoManual || nomeInput.value.startsWith('Relatório'))) {
      nomeInput.value = `Relatório: ${achada.titulo}`;
    }
  }
}

// =============================================
// COLETORES DE DADOS POR MODALIDADE
// =============================================
async function obterDadosConsolidados() {
  const tabelaId = estadoRelatorio.planilhaId || 'todas';
  const resp = await fetch(`/carregar-dados?tabela_id=${tabelaId}`);
  if (!resp.ok) throw new Error('Falha ao carregar dados consolidados');
  const json = await resp.json();
  const linhas = Array.isArray(json.dados) ? json.dados : [];

  if (linhas.length === 0) {
    return { meses: [], faturamento: [], despesas: [], lucro: [], margem: [] };
  }

  const campoPeriodo = Object.keys(linhas[0] || {}).find(k => /data|periodo|mês|mes|date/i.test(k));
  const campoFat = Object.keys(linhas[0] || {}).find(k => /faturamento|receita|total|sales|valor/i.test(k));
  const campoDesp = Object.keys(linhas[0] || {}).find(k => /despesa|custo|cost|expenses/i.test(k));
  const campoLuc = Object.keys(linhas[0] || {}).find(k => /lucro|profit/i.test(k));

  const meses = [];
  const faturamento = [];
  const despesas = [];
  const lucro = [];
  const margem = [];

  linhas.forEach((linha, i) => {
    const mes = campoPeriodo ? String(linha[campoPeriodo] || '').trim() : `Mês ${i + 1}`;
    const fat = numeroValido(campoFat ? linha[campoFat] : (linha.Total || linha.Receita));
    let desp = numeroValido(campoDesp ? linha[campoDesp] : (linha.Custo || linha.Despesa || 0));
    let luc = numeroValido(campoLuc ? linha[campoLuc] : (linha.Lucro || 0));

    if (!desp && fat && luc) desp = fat - luc;
    if (!luc && fat && desp) luc = fat - desp;
    const mg = fat > 0 ? (luc / fat) * 100 : 0;

    meses.push(mes);
    faturamento.push(fat);
    despesas.push(desp);
    lucro.push(luc);
    margem.push(Number(mg.toFixed(1)));
  });

  return { meses, faturamento, despesas, lucro, margem };
}

async function obterDadosFluxoCaixa() {
  const tabelaId = estadoRelatorio.planilhaId || 'todas';
  const periodo = document.getElementById('perRel')?.value || 'Últimos 6 meses';
  let dias = '180';
  if (periodo.includes('7')) dias = '7';
  else if (periodo.includes('30')) dias = '30';
  else if (periodo.includes('ano')) dias = '365';

  const resp = await fetch(`/api/fluxo-caixa?periodo=${dias}&tabela_id=${tabelaId}`);
  if (!resp.ok) throw new Error('Falha ao carregar fluxo de caixa');
  const json = await resp.json();
  return json;
}

async function obterDadosPlanejamento() {
  const tabelaId = estadoRelatorio.planilhaId || 'todas';
  const resp = await fetch(`/api/planejamento-financeiro?tabela_id=${tabelaId}`);
  if (!resp.ok) throw new Error('Falha ao carregar planejamento financeiro');
  const json = await resp.json();
  return json;
}

// =============================================
// MOTOR DE INSIGHTS 100% REAIS (SEM PLACEHOLDERS)
// =============================================
function gerarInsightsReaisFluxoCaixa(dadosFc) {
  const kpis = dadosFc.kpis || {};
  const evolucao = dadosFc.evolucao || {};
  const categorias = dadosFc.categorias || { labels: [], valores: [] };
  const maioresLucros = dadosFc.maiores_lucros || { labels: [], valores: [] };

  const entradas = numeroValido(kpis.entradas);
  const saidas = numeroValido(kpis.saidas);
  const saldo = numeroValido(kpis.saldo);
  const margem = entradas > 0 ? (saldo / entradas) * 100 : 0;

  const diagnostico = saldo >= 0
    ? `A operação gerou um saldo de caixa positivo acumulado de ${formatarMoeda(saldo)} no período analisado, alcançando uma taxa de retenção líquida de ${formatarPercentual(margem)} sobre o total de entradas (${formatarMoeda(entradas)}). A liquidez operacional atual demonstra sustentabilidade para compromissos correntes.`
    : `Atenção à tesouraria: o período encerrou com déficit de caixa de ${formatarMoeda(saldo)}, com saídas totais (${formatarMoeda(saidas)}) superiores aos recebimentos (${formatarMoeda(entradas)}). Exige-se ação imediata para preservação de capital de giro.`;

  const pontosFortes = [];
  if (entradas > saidas) {
    pontosFortes.push(`Superávit operacional consistente: Entradas superaram os desembolsos em ${formatarMoeda(saldo)}.`);
  }
  if (maioresLucros.labels && maioresLucros.labels.length > 0) {
    pontosFortes.push(`Principal gerador de caixa: "${maioresLucros.labels[0]}" respondeu por ${formatarMoeda(maioresLucros.valores[0])} no fluxo.`);
  }
  if (evolucao.lucro && evolucao.lucro.filter(v => v > 0).length >= evolucao.lucro.length * 0.7) {
    pontosFortes.push(`Estabilidade temporal: Mais de 70% dos meses do período registraram geração líquida positiva.`);
  }
  if (pontosFortes.length === 0) {
    pontosFortes.push(`Entradas operacionais atingiram ${formatarMoeda(entradas)}, servindo de base para readequação de desembolsos.`);
  }

  const alertasRiscos = [];
  if (categorias.labels && categorias.labels.length > 0 && saidas > 0) {
    const topGasto = categorias.valores[0];
    const topCat = categorias.labels[0];
    const pctTop = (topGasto / saidas) * 100;
    if (pctTop > 30) {
      alertasRiscos.push(`Alta concentração de desembolso: A categoria "${topCat}" absorve ${formatarPercentual(pctTop)} de todas as saídas (${formatarMoeda(topGasto)}).`);
    }
  }
  if (saldo < 0) {
    alertasRiscos.push(`Queima de caixa operacional verificada. A empresa está consumindo reservas para manter os compromissos.`);
  }
  const mesesDeficit = (evolucao.lucro || []).filter(v => v < 0).length;
  if (mesesDeficit > 0) {
    alertasRiscos.push(`Oscilação de liquidez: ${mesesDeficit} mês(es) registraram queima pontual de saldo de caixa.`);
  }
  if (alertasRiscos.length === 0) {
    alertasRiscos.push(`Manter vigilância sobre despesas variáveis e flutuações sazonais de recebimento.`);
  }

  const recomendacoes = [];
  if (saldo >= 0) {
    recomendacoes.push(`Alocar o excedente de ${formatarMoeda(saldo)} em aplicações de liquidez diária para formação de colchão financeiro mínimo de 3 meses.`);
    recomendacoes.push(`Negociar prazos médios de pagamento com fornecedores para esticar o ciclo financeiro sem gerar encargos.`);
  } else {
    recomendacoes.push(`Plano de choque de liquidez: postergar despesas não essenciais e renegociar linhas de curto prazo para equalizar as saídas aos ${formatarMoeda(entradas)} de entradas.`);
    recomendacoes.push(`Implementar política rígida de cobrança e antecipação estratégica de recebíveis para cobrir o gap de ${formatarMoeda(Math.abs(saldo))}.`);
  }
  recomendacoes.push(`Acompanhar semanalmente a conciliação entre previsto e realizado no painel de Fluxo de Caixa do DataInsight.`);

  return { diagnostico, pontosFortes, alertasRiscos, recomendacoes };
}

function gerarInsightsReaisPlanejamento(dadosPlan, cenarioNome = 'provavel') {
  const cenario = dadosPlan[cenarioNome] || dadosPlan.provavel || {};
  const meses = cenario.meses || dadosPlan.meses || [];

  const totalReceita = somaValores(meses.map(m => m.receita));
  const totalFixos = somaValores(meses.map(m => m.fixos));
  const totalVariaveis = somaValores(meses.map(m => m.variaveis));
  const totalImpostos = somaValores(meses.map(m => m.impostos));
  const totalMargem = somaValores(meses.map(m => m.margem));
  const totalResultado = somaValores(meses.map(m => m.resultado));
  const totalInvestimentos = somaValores(meses.map(m => m.investimentos));

  const imc = totalReceita > 0 ? (totalMargem / totalReceita) : 0;
  const pontoEquilibrio = imc > 0 ? (totalFixos / imc) : null;
  const margemSeguranca = (pontoEquilibrio && totalReceita > pontoEquilibrio)
    ? ((totalReceita - pontoEquilibrio) / totalReceita) * 100
    : 0;

  const mesesNegativos = meses.filter(m => (m.resultado || 0) < 0);
  const melhorMes = [...meses].sort((a, b) => (b.resultado || 0) - (a.resultado || 0))[0];

  const diagnostico = totalResultado >= 0
    ? `O ciclo de 12 meses do Planejamento Financeiro (${cenario.descricao || 'Cenário Selecionado'}) projeta uma receita total de ${formatarMoeda(totalReceita)} e um resultado líquido de ${formatarMoeda(totalResultado)}. O ponto de equilíbrio operacional está estimado em ${pontoEquilibrio ? formatarMoeda(pontoEquilibrio) : 'N/A'}, conferindo uma margem de segurança de ${formatarPercentual(margemSeguranca)} sobre os custos da empresa.`
    : `O ciclo planejado aponta para um resultado líquido deficitário de ${formatarMoeda(totalResultado)}, indicando que o volume de receitas projetadas (${formatarMoeda(totalReceita)}) é insuficiente para absorver a estrutura de custos fixos (${formatarMoeda(totalFixos)}) e variáveis (${formatarMoeda(totalVariaveis)}).`;

  const pontosFortes = [];
  if (totalMargem > 0) {
    pontosFortes.push(`Margem de contribuição saudável: R$ ${formatarValor(totalMargem)} (${formatarPercentual(imc * 100)} da receita) disponível para amortizar custos fixos.`);
  }
  if (melhorMes) {
    pontosFortes.push(`Pico operacional projetado: O mês de ${melhorMes.mes || 'destaque'} atinge resultado líquido recorde de ${formatarMoeda(melhorMes.resultado)}.`);
  }
  if (mesesNegativos.length === 0) {
    pontosFortes.push(`Consistência contínua: Todos os 12 meses projetam operação acima do ponto de equilíbrio contábil.`);
  }

  const alertasRiscos = [];
  if (mesesNegativos.length > 0) {
    const nomesMeses = mesesNegativos.map(m => m.mes).join(', ');
    alertasRiscos.push(`Vulnerabilidade sazonal: ${mesesNegativos.length} mês(es) projetam déficit de caixa (${nomesMeses}), demandando capital de giro de suporte.`);
  }
  if (totalReceita > 0 && (totalFixos / totalReceita) > 0.45) {
    alertasRiscos.push(`Peso elevado da estrutura fixa: Gastos fixos consom ${formatarPercentual((totalFixos / totalReceita) * 100)} de todas as receitas do ciclo.`);
  }
  if (pontoEquilibrio && totalReceita < pontoEquilibrio) {
    alertasRiscos.push(`Receita projetada está ${formatarMoeda(pontoEquilibrio - totalReceita)} abaixo do Ponto de Equilíbrio Operacional.`);
  }
  if (alertasRiscos.length === 0) {
    alertasRiscos.push(`Monitorar oscilações no custo de matéria-prima e investimentos planejados (${formatarMoeda(totalInvestimentos)}).`);
  }

  const recomendacoes = [];
  if (pontoEquilibrio) {
    recomendacoes.push(`Meta de faturamento mínimo: Garantir que a média mensal não fique abaixo de ${formatarMoeda(pontoEquilibrio / 12)} para evitar prejuízos.`);
  }
  if (mesesNegativos.length > 0) {
    recomendacoes.push(`Criar uma provisão financeira nos meses de alta para cobrir os períodos deficitários sem necessidade de empréstimos bancários.`);
  }
  recomendacoes.push(`Avaliar renegociação de despesas fixas (aluguel, licenças, contratos recorrentes) visando diminuir o Ponto de Equilíbrio em pelo menos 10%.`);

  return { diagnostico, pontosFortes, alertasRiscos, recomendacoes, pontoEquilibrio, margemSeguranca, totalReceita, totalResultado, totalFixos, totalMargem };
}

function gerarInsightsReaisConsolidado(dados) {
  const fatTotal = somaValores(dados.faturamento);
  const lucTotal = somaValores(dados.lucro);
  const despTotal = somaValores(dados.despesas);
  const cresc = calcCrescimento(dados.faturamento);
  const mgMedia = fatTotal > 0 ? (lucTotal / fatTotal) * 100 : 0;

  // Destaque do melhor mês
  let maxLucro = -Infinity;
  let mesMax = 'N/A';
  dados.lucro.forEach((l, i) => {
    if (l > maxLucro) {
      maxLucro = l;
      mesMax = dados.meses[i] || `Mês ${i + 1}`;
    }
  });

  const diagnostico = lucTotal >= 0
    ? `No período selecionado, o negócio faturou um montante consolidado de ${formatarMoeda(fatTotal)}, gerando ${formatarMoeda(lucTotal)} de lucro líquido apurado (${formatarPercentual(mgMedia)} de margem líquida). O crescimento do faturamento no período foi de ${cresc}, com despesas sob gestão mantidas em ${formatarMoeda(despTotal)}.`
    : `O período acumulou faturamento de ${formatarMoeda(fatTotal)}, porém as despesas de ${formatarMoeda(despTotal)} superaram as receitas, resultando em prejuízo operacional de ${formatarMoeda(lucTotal)}. Recomenda-se revisão imediata da precificação e controle orçamentário.`;

  const pontosFortes = [];
  if (!cresc.startsWith('-') && cresc !== '0.0%' && cresc !== 'N/A') {
    pontosFortes.push(`Trajetória de expansão: Variação positiva de ${cresc} entre o primeiro e o último mês do período.`);
  }
  if (maxLucro > 0) {
    pontosFortes.push(`Mês de máxima performance: ${mesMax} alcançou o melhor resultado com ${formatarMoeda(maxLucro)} de lucro.`);
  }
  if (mgMedia > 20) {
    pontosFortes.push(`Margem líquida competitiva: A média do período (${formatarPercentual(mgMedia)}) está acima do benchmark médio setorial.`);
  }
  if (pontosFortes.length === 0) {
    pontosFortes.push(`Base de faturamento mantida em ${formatarMoeda(fatTotal)} ao longo de ${dados.meses.length} períodos registrados.`);
  }

  const alertasRiscos = [];
  if (cresc.startsWith('-')) {
    alertasRiscos.push(`Retração de receita: Faturamento registrou queda de ${cresc} no período, sinalizando perda de tração comercial.`);
  }
  if (fatTotal > 0 && (despTotal / fatTotal) > 0.8) {
    alertasRiscos.push(`Estrutura de custos comprimida: Despesas representam ${formatarPercentual((despTotal / fatTotal) * 100)} do faturamento.`);
  }
  const mesesPrejuizo = dados.lucro.filter(l => l < 0).length;
  if (mesesPrejuizo > 0) {
    alertasRiscos.push(`Volatilidade de resultados: ${mesesPrejuizo} mês(es) fecharam no vermelho no período avaliado.`);
  }
  if (alertasRiscos.length === 0) {
    alertasRiscos.push(`Sustentar o alinhamento de custos para evitar compressão de margens frente à inflação setorial.`);
  }

  const recomendacoes = [];
  if (lucTotal > 0) {
    recomendacoes.push(`Reinvestir até 25% do lucro líquido gerado (${formatarMoeda(lucTotal * 0.25)}) em canais de atração de clientes com maior retorno sobre investimento.`);
    recomendacoes.push(`Padronizar as práticas operacionais aplicadas no mês de ${mesMax} para os próximos períodos.`);
  } else {
    recomendacoes.push(`Auditar os 3 maiores centros de despesas que compõem os ${formatarMoeda(despTotal)} para corte seletivo de gastos imediatos.`);
    recomendacoes.push(`Reavaliar a tabela de preços de venda para restabelecer a margem de contribuição positiva.`);
  }
  recomendacoes.push(`Utilizar os cenários do Planejamento Financeiro do DataInsight para simular os próximos 6 meses.`);

  return { diagnostico, pontosFortes, alertasRiscos, recomendacoes, fatTotal, lucTotal, despTotal, cresc, mgMedia, mesMax, maxLucro };
}

// =============================================
// GERAÇÃO E MONTAGEM DA PRÉ-VISUALIZAÇÃO
// =============================================
async function gerarPreview() {
  const preview = document.getElementById('preview');
  const emptyState = document.getElementById('preview-empty-state');
  const status = document.getElementById('preview-status');
  if (!preview) return;

  const tipo = document.getElementById('tipoRelatorio')?.value || 'consolidado';
  const nomeRel = document.getElementById('nomeRel')?.value || 'Relatório Executivo';
  const dataHoje = new Date().toLocaleDateString('pt-BR');
  const periodo = document.getElementById('perRel')?.value || 'Período Selecionado';

  preview.innerHTML = '<div style="text-align:center;padding:40px;color:var(--suave);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:12px;font-size:0.9rem;">Processando dados reais e gerando relatório...</p></div>';
  preview.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  try {
    let payload = null;

    if (tipo === 'analise_salva') {
      payload = await compilarRelatorioAnaliseSalva(nomeRel, dataHoje);
    } else if (tipo === 'fluxo_caixa') {
      payload = await compilarRelatorioFluxoCaixa(nomeRel, dataHoje, periodo);
    } else if (tipo === 'planejamento') {
      payload = await compilarRelatorioPlanejamento(nomeRel, dataHoje);
    } else {
      payload = await compilarRelatorioConsolidado(nomeRel, dataHoje, periodo, tipo);
    }

    estadoRelatorio.relatorioAtual = payload;
    renderizarPreviewHtml(payload);

    if (status) {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      status.textContent = 'Atualizado às ' + now;
    }
  } catch (err) {
    console.error('Erro ao gerar preview de relatório:', err);
    preview.innerHTML = `
      <div class="preview-secao">
        <div class="preview-titulo" style="color:var(--perigo);"><i class="fa-solid fa-triangle-exclamation"></i> Não foi possível gerar o relatório</div>
        <p style="color:var(--texto);font-size:0.88rem;">${escapeHtml(err.message || 'Erro ao processar dados.')}</p>
        <small style="color:var(--suave);">Verifique se você possui dados carregados no sistema para a planilha ou análise selecionada.</small>
      </div>
    `;
  }
}

// =============================================
// COMPILADORES ESPECÍFICOS DE PAYLOAD
// =============================================
async function compilarRelatorioAnaliseSalva(nomeRel, dataHoje) {
  const analise = estadoRelatorio.analiseSelecionada;
  if (!analise) {
    throw new Error('Nenhuma análise salva selecionada. Escolha uma análise no menu à esquerda.');
  }

  const kpisLista = (analise.metricas || []).map(m => ({
    label: m.label || m.nome || 'Métrica',
    valor: m.valor || '0',
    sub: m.sub || m.detalhe || ''
  }));

  const diagnostico = analise.diagnostico_geral || 'Diagnóstico não informado na análise salva.';
  const pontosFortes = Array.isArray(analise.pontos_fortes) ? analise.pontos_fortes : [];
  const alertasRiscos = Array.isArray(analise.alertas_riscos) ? analise.alertas_riscos : [];
  const recomendacoes = Array.isArray(analise.recomendacoes) ? analise.recomendacoes : [];

  const tabela = (analise.metricas || []).map(m => ({
    indicador: m.label || m.nome,
    valor: m.valor,
    detalhes: m.sub || m.detalhe || '-'
  }));

  return {
    tipo_relatorio: 'analise_salva',
    nome: nomeRel || analise.titulo,
    subtitulo: analise.subtitulo || `Origem: ${analise.origem} • Página: ${analise.pagina_nome}`,
    origem_nome: analise.origem || 'Análise IA',
    analise_id: analise.id,
    badge: analise.badge || 'Análise IA Salva',
    cor: analise.cor || '#3b82f6',
    periodo: analise.periodo || 'Período da Análise',
    data: dataHoje,
    kpis_lista: kpisLista,
    kpis: {},
    grafico: false,
    insights_estruturados: { diagnostico, pontosFortes, alertasRiscos, recomendacoes },
    insights: [diagnostico, ...pontosFortes, ...alertasRiscos, ...recomendacoes],
    tabela: tabela,
    tabela_colunas: [
      { chave: 'indicador', label: 'Indicador' },
      { chave: 'valor', label: 'Valor Registrado' },
      { chave: 'detalhes', label: 'Contexto / Variação' }
    ]
  };
}

async function compilarRelatorioFluxoCaixa(nomeRel, dataHoje, periodo) {
  const fc = await obterDadosFluxoCaixa();
  if (!fc || !fc.sucesso) {
    throw new Error('Não foi possível obter os dados de fluxo de caixa para a planilha selecionada.');
  }

  const kpis = fc.kpis || {};
  const evolucao = fc.evolucao || { labels: [], series: [], lucro: [] };
  const insights = gerarInsightsReaisFluxoCaixa(fc);

  const kpisLista = [
    { label: 'Entradas Totais', valor: formatarMoeda(kpis.entradas), sub: 'Recebimentos no período' },
    { label: 'Saídas Totais', valor: formatarMoeda(kpis.saidas), sub: 'Desembolsos operacionais' },
    { label: 'Saldo Líquido', valor: formatarMoeda(kpis.saldo), sub: (kpis.saldo >= 0 ? '✓ Superávit de caixa' : '⚠ Déficit de caixa') },
    { label: 'Taxa de Retenção', valor: formatarPercentual(kpis.entradas > 0 ? (kpis.saldo / kpis.entradas) * 100 : 0), sub: 'Margem líquida de caixa' }
  ];

  // Séries do gráfico
  const labels = evolucao.labels || [];
  const sEntradas = evolucao.series?.[0]?.data || [];
  const sSaidas = evolucao.series?.[1]?.data || [];
  const sSaldo = evolucao.lucro || [];

  const graficoSeries = [
    { name: 'Entradas', data: sEntradas },
    { name: 'Saídas', data: sSaidas },
    { name: 'Saldo de Caixa', data: sSaldo }
  ];

  // Tabela mês a mês
  const tabela = labels.map((mes, i) => ({
    periodo: mes,
    entradas: formatarMoeda(sEntradas[i] || 0),
    saidas: formatarMoeda(sSaidas[i] || 0),
    saldo: formatarMoeda(sSaldo[i] || 0),
    status: (sSaldo[i] || 0) >= 0 ? 'Positivo' : 'Negativo'
  }));

  return {
    tipo_relatorio: 'fluxo_caixa',
    nome: nomeRel || 'Relatório de Fluxo de Caixa & Tesouraria',
    subtitulo: `Escopo: ${fc.contexto?.nome_contexto || 'Fluxo de Caixa'} • Período: ${periodo}`,
    origem_nome: fc.contexto?.nome_contexto || 'Fluxo de Caixa',
    badge: 'Fluxo de Caixa & Tesouraria',
    cor: '#10b981',
    periodo,
    data: dataHoje,
    kpis_lista: kpisLista,
    kpis: {
      entradas: formatarMoeda(kpis.entradas),
      saidas: formatarMoeda(kpis.saidas),
      saldo: formatarMoeda(kpis.saldo),
      margem: formatarPercentual(kpis.entradas > 0 ? (kpis.saldo / kpis.entradas) * 100 : 0)
    },
    grafico: getCheckbox('opt-grafico'),
    grafico_tipo: 'linha',
    grafico_labels: labels,
    grafico_series: graficoSeries,
    insights_estruturados: insights,
    insights: [insights.diagnostico, ...insights.pontosFortes, ...insights.alertasRiscos, ...insights.recomendacoes],
    tabela: tabela,
    tabela_colunas: [
      { chave: 'periodo', label: 'Período' },
      { chave: 'entradas', label: 'Entradas' },
      { chave: 'saidas', label: 'Saídas' },
      { chave: 'saldo', label: 'Saldo de Caixa' },
      { chave: 'status', label: 'Resultado' }
    ]
  };
}

async function compilarRelatorioPlanejamento(nomeRel, dataHoje) {
  const plan = await obterDadosPlanejamento();
  if (!plan || !plan.sucesso) {
    throw new Error('Não foi possível obter os dados de planejamento financeiro.');
  }

  const cenarioKey = document.getElementById('seletorCenarioPlan')?.value || 'provavel';
  const cenario = plan[cenarioKey] || plan.provavel || {};
  const cenarioNome = cenarioKey === 'otimista' ? 'Cenário Otimista' : (cenarioKey === 'pessimista' ? 'Cenário Pessimista' : 'Cenário Provável');
  const meses = cenario.meses || plan.meses || [];

  if (meses.length === 0) {
    throw new Error('Nenhuma projeção disponível no planejamento para o cenário selecionado.');
  }

  const insights = gerarInsightsReaisPlanejamento(plan, cenarioKey);

  const kpisLista = [
    { label: 'Receita Total 12M', valor: formatarMoeda(insights.totalReceita), sub: cenarioNome },
    { label: 'Margem Contribuição', valor: formatarMoeda(insights.totalMargem), sub: 'Receita - Variáveis - Impostos' },
    { label: 'Resultado Líquido', valor: formatarMoeda(insights.totalResultado), sub: insights.totalResultado >= 0 ? '✓ Lucro anual planejado' : '⚠ Prejuízo anual' },
    { label: 'Ponto de Equilíbrio', valor: insights.pontoEquilibrio ? formatarMoeda(insights.pontoEquilibrio) : 'Incalculável', sub: `Segurança: ${formatarPercentual(insights.margemSeguranca)}` }
  ];

  const labels = meses.map(m => m.mes);
  const seriesRec = meses.map(m => m.receita || 0);
  const seriesCustos = meses.map(m => (m.fixos || 0) + (m.variaveis || 0) + (m.impostos || 0));
  const seriesRes = meses.map(m => m.resultado || 0);

  const graficoSeries = [
    { name: 'Receita Planejada', data: seriesRec },
    { name: 'Custos Totais', data: seriesCustos },
    { name: 'Resultado Líquido', data: seriesRes }
  ];

  const tabela = meses.map(m => ({
    mes: m.mes,
    receita: formatarMoeda(m.receita),
    variaveis: formatarMoeda(m.variaveis),
    margem: formatarMoeda(m.margem),
    fixos: formatarMoeda(m.fixos),
    resultado: formatarMoeda(m.resultado)
  }));

  return {
    tipo_relatorio: 'planejamento',
    nome: nomeRel || `Planejamento Financeiro — ${cenarioNome}`,
    subtitulo: `Projeção Anual 12 Meses • ${cenarioNome} (${plan.nome_contexto || 'Planejamento'})`,
    origem_nome: plan.nome_contexto || 'Planejamento Financeiro',
    badge: `Planejamento • ${cenarioNome}`,
    cor: '#8b5cf6',
    periodo: 'Ciclo de 12 Meses',
    data: dataHoje,
    kpis_lista: kpisLista,
    kpis: {
      receita: formatarMoeda(insights.totalReceita),
      margem: formatarMoeda(insights.totalMargem),
      resultado: formatarMoeda(insights.totalResultado),
      pe: insights.pontoEquilibrio ? formatarMoeda(insights.pontoEquilibrio) : 'N/A'
    },
    grafico: getCheckbox('opt-grafico'),
    grafico_tipo: 'linha',
    grafico_labels: labels,
    grafico_series: graficoSeries,
    insights_estruturados: insights,
    insights: [insights.diagnostico, ...insights.pontosFortes, ...insights.alertasRiscos, ...insights.recomendacoes],
    tabela: tabela,
    tabela_colunas: [
      { chave: 'mes', label: 'Mês' },
      { chave: 'receita', label: 'Receita' },
      { chave: 'variaveis', label: 'Variáveis' },
      { chave: 'margem', label: 'Margem Contrib.' },
      { chave: 'fixos', label: 'Gastos Fixos' },
      { chave: 'resultado', label: 'Resultado Líquido' }
    ]
  };
}

async function compilarRelatorioConsolidado(nomeRel, dataHoje, periodo, tipo) {
  const dados = await obterDadosConsolidados();
  if (!dados.meses || dados.meses.length === 0) {
    throw new Error('Nenhum dado encontrado nas planilhas. Carregue dados na tela "Dados" para gerar relatórios.');
  }

  // Filtrar período se necessário
  const total = dados.meses.length;
  let qtd = total;
  if (periodo.includes('7')) qtd = Math.min(7, total);
  else if (periodo.includes('30')) qtd = Math.min(30, total);
  else if (periodo.includes('6')) qtd = Math.min(6, total);

  const start = Math.max(0, total - qtd);
  const dadosPeriodo = {
    meses: dados.meses.slice(start),
    faturamento: dados.faturamento.slice(start),
    despesas: dados.despesas.slice(start),
    lucro: dados.lucro.slice(start),
    margem: dados.margem.slice(start)
  };

  const insights = gerarInsightsReaisConsolidado(dadosPeriodo);

  const kpisLista = [
    { label: 'Faturamento Total', valor: formatarMoeda(insights.fatTotal), sub: `Variação: ${insights.cresc}` },
    { label: 'Lucro Líquido', valor: formatarMoeda(insights.lucTotal), sub: `Margem Média: ${formatarPercentual(insights.mgMedia)}` },
    { label: 'Despesas Totais', valor: formatarMoeda(insights.despTotal), sub: 'Custos operacionais consolidados' },
    { label: 'Crescimento', valor: insights.cresc, sub: `Pico em ${insights.mesMax}` }
  ];

  const graficoSeries = [
    { name: 'Faturamento', data: dadosPeriodo.faturamento },
    { name: 'Despesas', data: dadosPeriodo.despesas },
    { name: 'Lucro Líquido', data: dadosPeriodo.lucro }
  ];

  const tabela = dadosPeriodo.meses.map((m, i) => ({
    mes: m,
    fat: formatarMoeda(dadosPeriodo.faturamento[i]),
    desp: formatarMoeda(dadosPeriodo.despesas[i]),
    luc: formatarMoeda(dadosPeriodo.lucro[i]),
    margem: formatarPercentual(dadosPeriodo.margem[i])
  }));

  const isGraficosAvancados = tipo === 'graficos_avancados';

  return {
    tipo_relatorio: isGraficosAvancados ? 'graficos_avancados' : 'consolidado',
    nome: nomeRel || (isGraficosAvancados ? 'Relatório de Métricas & Gráficos Avançados' : 'Relatório Consolidado do Negócio'),
    subtitulo: `Base Consolidada • Período: ${periodo}`,
    origem_nome: 'Visão Consolidada',
    badge: isGraficosAvancados ? 'Gráficos Avançados & Performance' : 'Consolidado Geral',
    cor: isGraficosAvancados ? '#f59e0b' : '#3b82f6',
    periodo,
    data: dataHoje,
    kpis_lista: kpisLista,
    kpis: {
      faturamento: formatarMoeda(insights.fatTotal),
      lucro: formatarMoeda(insights.lucTotal),
      despesas: formatarMoeda(insights.despTotal),
      crescimento: insights.cresc
    },
    grafico: getCheckbox('opt-grafico'),
    grafico_tipo: 'linha',
    grafico_labels: dadosPeriodo.meses,
    grafico_series: graficoSeries,
    insights_estruturados: insights,
    insights: [insights.diagnostico, ...insights.pontosFortes, ...insights.alertasRiscos, ...insights.recomendacoes],
    tabela: tabela,
    tabela_colunas: [
      { chave: 'mes', label: 'Período / Mês' },
      { chave: 'fat', label: 'Faturamento' },
      { chave: 'desp', label: 'Despesas' },
      { chave: 'luc', label: 'Lucro Líquido' },
      { chave: 'margem', label: 'Margem %' }
    ]
  };
}

// =============================================
// RENDERIZADOR DA INTERFACE DE PREVIEW
// =============================================
function renderizarPreviewHtml(p) {
  const preview = document.getElementById('preview');
  if (!preview) return;

  let html = '';

  // 1. Cabeçalho Executivo
  html += `
    <div class="preview-header-block">
      <div class="preview-header-left">
        <h1>${escapeHtml(p.nome)}</h1>
        <p>${escapeHtml(p.subtitulo)} • Gerado em ${escapeHtml(p.data)}</p>
      </div>
      <span class="preview-type-badge" style="background:${p.cor || '#3b82f6'}20;color:${p.cor || '#3b82f6'};border:1px solid ${p.cor || '#3b82f6'}40;">
        <i class="fa-solid fa-file-lines"></i> ${escapeHtml(p.badge || 'Relatório')}
      </span>
    </div>
  `;

  // 2. KPIs Principais
  if (getCheckbox('opt-kpi') && p.kpis_lista && p.kpis_lista.length > 0) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-chart-bar"></i> Indicadores Principais de Desempenho</div>
        <div class="kpi-grid-rich">
          ${p.kpis_lista.map(k => `
            <div class="kpi-card-rich">
              <div class="kpi-lbl">${escapeHtml(k.label)}</div>
              <div class="kpi-val">${escapeHtml(k.valor)}</div>
              ${k.sub ? `<div class="kpi-sub">${escapeHtml(k.sub)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. Diagnóstico Executivo
  const ie = p.insights_estruturados || {};
  if (getCheckbox('opt-diagnostico') && ie.diagnostico) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-microchip"></i> Diagnóstico Executivo &amp; Veredito</div>
        <div class="preview-diagnostic-banner" style="border-left-color:${p.cor || '#3b82f6'};">
          <h4><i class="fa-solid fa-magnifying-glass-chart"></i> Parecer Analítico Real</h4>
          <div class="diagnostico-conteudo">${renderizarConteudoTexto(ie.diagnostico)}</div>
        </div>
      </div>
    `;
  }

  // 4. Pontos Fortes e Riscos
  const temPontos = Array.isArray(ie.pontosFortes) && ie.pontosFortes.length > 0;
  const temRiscos = Array.isArray(ie.alertasRiscos) && ie.alertasRiscos.length > 0;
  if (getCheckbox('opt-pontos-riscos') && (temPontos || temRiscos)) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-shield-halved"></i> Pontos Fortes &amp; Alertas de Riscos</div>
        <div class="preview-insights-grid">
          ${temPontos ? `
            <div class="insight-card insight-card--fortes">
              <div class="insight-card__title"><i class="fa-solid fa-circle-check"></i> Pontos Fortes &amp; Oportunidades</div>
              <ul class="insight-list">
                ${ie.pontosFortes.map(pt => `<li>${renderizarConteudoInline(pt)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          ${temRiscos ? `
            <div class="insight-card insight-card--riscos">
              <div class="insight-card__title"><i class="fa-solid fa-triangle-exclamation"></i> Alertas &amp; Vulnerabilidades</div>
              <ul class="insight-list">
                ${ie.alertasRiscos.map(r => `<li>${renderizarConteudoInline(r)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 5. Recomendações Estratégicas
  const temRecs = Array.isArray(ie.recomendacoes) && ie.recomendacoes.length > 0;
  if (getCheckbox('opt-recomendacoes') && temRecs) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-lightbulb"></i> Recomendações Estratégicas &amp; Plano de Ação</div>
        <div class="insight-card insight-card--recs" style="width:100%;">
          <div class="insight-card__title"><i class="fa-solid fa-list-check"></i> Ações Práticas Orientadas por Dados</div>
          <ul class="insight-list">
            ${ie.recomendacoes.map(rec => `<li>${renderizarConteudoInline(rec)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  // 6. Gráfico Visual
  if (getCheckbox('opt-grafico') && p.grafico_labels && p.grafico_labels.length > 0) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-chart-line"></i> Evolução Visual &amp; Séries Temporais</div>
        <div id="grafico-relatorio" style="max-width:100%; height:320px; background:var(--fundo); border:1px solid var(--borda); border-radius:12px; padding:10px;"></div>
      </div>
    `;
  }

  // 7. Tabela Detalhada
  if (getCheckbox('opt-dados') && Array.isArray(p.tabela) && p.tabela.length > 0 && Array.isArray(p.tabela_colunas)) {
    html += `
      <div class="preview-secao">
        <div class="preview-titulo"><i class="fa-solid fa-table"></i> Dados Detalhados</div>
        <div class="table-responsive-rel">
          <table>
            <thead>
              <tr>
                ${p.tabela_colunas.map(col => `<th>${escapeHtml(col.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${p.tabela.map(linha => `
                <tr>
                  ${p.tabela_colunas.map(col => `<td>${escapeHtml(linha[col.chave] ?? '-')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  preview.innerHTML = html;

  // Renderiza gráfico ApexCharts se habilitado
  if (getCheckbox('opt-grafico') && p.grafico_labels && p.grafico_labels.length > 0) {
    setTimeout(() => renderizarGraficoApex(p), 60);
  }
}

function renderizarGraficoApex(p) {
  const container = document.getElementById('grafico-relatorio');
  if (!container || typeof ApexCharts === 'undefined') return;

  if (window.graficoRelatorioInstancia) {
    window.graficoRelatorioInstancia.destroy();
  }

  const options = {
    chart: {
      type: 'line',
      height: 300,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit'
    },
    colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'],
    series: p.grafico_series || [],
    xaxis: {
      categories: p.grafico_labels || []
    },
    yaxis: {
      labels: {
        formatter: val => {
          if (val === null || val === undefined) return '';
          return 'R$ ' + Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
        }
      }
    },
    stroke: { curve: 'smooth', width: 2.5 },
    markers: { size: 4 },
    tooltip: {
      y: {
        formatter: v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      }
    },
    legend: { position: 'top' }
  };

  window.graficoRelatorioInstancia = new ApexCharts(container, options);
  window.graficoRelatorioInstancia.render();
}

function gerarPreviewMelhorado() {
  gerarPreview();
}

// =============================================
// EXPORTAÇÃO PDF & PERSISTÊNCIA NO BANCO
// =============================================
async function exportarPDFMelhorado() {
  const btn = document.getElementById('btn-pdf');
  const loadingText = btn?.querySelector('.btn-loading-text');
  const spinner = btn?.querySelector('.rel-spinner');
  const btnText = btn?.querySelector('.btn-text');

  function setBtnLoading(loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.setAttribute('data-loading', loading ? 'true' : 'false');
    if (btnText) btnText.style.display = loading ? 'none' : '';
    if (spinner) spinner.style.display = loading ? 'inline-block' : 'none';
    if (loadingText) loadingText.style.display = loading ? 'inline' : 'none';
  }

  setBtnLoading(true);

  try {
    // Garante que o payload mais atual está compilado
    if (!estadoRelatorio.relatorioAtual) {
      await gerarPreview();
    }

    const payload = estadoRelatorio.relatorioAtual;
    if (!payload) {
      throw new Error('Falha ao compilar dados do relatório.');
    }

    // Atualiza nome se o usuário tiver alterado o input
    const nomeInput = document.getElementById('nomeRel')?.value;
    if (nomeInput) payload.nome = nomeInput;

    const res = await fetch('/gerar-relatorio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt.substring(0, 300)}`);
    }

    const json = await res.json();
    setBtnLoading(false);

    if (json.success && json.redirect) {
      showToast(`Relatório "${payload.nome}" gerado e salvo com sucesso!`, 'success');
      await carregarHistorico();

      setTimeout(() => {
        window.location.href = `${json.redirect}${json.redirect.includes('?') ? '&' : '?'}auto=1`;
      }, 500);
    } else {
      showToast(json.mensagem || 'Erro ao gerar relatório', 'error');
    }
  } catch (err) {
    setBtnLoading(false);
    console.error('Erro ao exportar PDF do relatório:', err);
    showToast('Erro ao exportar relatório: ' + (err.message || 'Verifique a conexão.'), 'error');
  }
}

// =============================================
// HISTÓRICO DE RELATÓRIOS (MongoDB)
// =============================================
let _historicoRelatorios = [];
let filtroAtivo = 'todos';

async function carregarHistorico() {
  try {
    const resp = await fetch('/api/relatorios');
    if (!resp.ok) return [];
    const json = await resp.json();
    _historicoRelatorios = json.relatorios || [];
    renderHistorico(document.getElementById('search-historico')?.value || '');
    return _historicoRelatorios;
  } catch (e) {
    console.warn('Erro ao carregar histórico de relatórios:', e);
    return [];
  }
}

async function removerDoHistorico(id) {
  if (!confirm('Deseja realmente excluir este relatório do histórico do banco de dados?')) return;

  try {
    const resp = await fetch(`/api/relatorios/${id}`, { method: 'DELETE' });
    const json = await resp.json();

    if (json.success) {
      _historicoRelatorios = _historicoRelatorios.filter(r => String(r.id) !== String(id));
      renderHistorico(document.getElementById('search-historico')?.value || '');
      showToast('Relatório removido com sucesso!', 'info');
    } else {
      showToast(json.mensagem || 'Erro ao excluir relatório', 'error');
    }
  } catch (e) {
    console.error('Erro ao excluir relatório:', e);
    showToast('Erro de conexão ao excluir relatório', 'error');
  }
}

function filtrarPorPilula(lista) {
  const agora = new Date();
  if (filtroAtivo === 'hoje') {
    return lista.filter(r => {
      if (!r.data) return false;
      return new Date(r.data).toDateString() === agora.toDateString();
    });
  }
  if (filtroAtivo === 'semana') {
    const lim = new Date(agora);
    lim.setDate(agora.getDate() - 7);
    return lista.filter(r => {
      if (!r.data) return false;
      return new Date(r.data) >= lim;
    });
  }
  if (filtroAtivo === 'mes') {
    return lista.filter(r => {
      if (!r.data) return false;
      const d = new Date(r.data);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    });
  }
  return lista;
}

function renderHistorico(busca = '') {
  const lista = _historicoRelatorios;
  const filtradosPilula = filtrarPorPilula(lista);
  const query = busca.trim().toLowerCase();
  const filtrados = query
    ? filtradosPilula.filter(r =>
      (r.nome || '').toLowerCase().includes(query) ||
      (r.dataFormatada || '').toLowerCase().includes(query) ||
      (r.periodo || '').toLowerCase().includes(query) ||
      (r.origem_nome || '').toLowerCase().includes(query) ||
      (r.badge || '').toLowerCase().includes(query))
    : filtradosPilula;

  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  const noResEl = document.getElementById('history-no-results');
  const countEl = document.getElementById('history-count');
  const qDisplay = document.getElementById('search-query-display');

  if (countEl) countEl.textContent = lista.length;
  const listaVazia = lista.length === 0;
  const semResultados = !listaVazia && filtrados.length === 0 && query.length > 0;

  if (emptyEl) emptyEl.style.display = listaVazia ? 'block' : 'none';
  if (noResEl) noResEl.classList.toggle('visivel', semResultados);
  if (qDisplay) qDisplay.textContent = '"' + busca + '"';

  if (!listEl) return;
  if (listaVazia || semResultados) {
    listEl.innerHTML = '';
    return;
  }

  const iconesTipo = {
    analise_salva: 'fa-brain',
    fluxo_caixa: 'fa-money-bill-transfer',
    planejamento: 'fa-bullseye',
    graficos_avancados: 'fa-chart-pie',
    consolidado: 'fa-file-lines'
  };

  listEl.innerHTML = filtrados.map(r => {
    const icone = iconesTipo[r.tipo_relatorio] || 'fa-file-pdf';
    return `
      <div class="history-item" data-id="${r.id}">
        <div class="history-item__icon" style="background:${r.cor || '#3b82f6'}18;color:${r.cor || '#3b82f6'};">
          <i class="fa-solid ${icone}"></i>
        </div>
        <div class="history-item__info">
          <div class="history-item__name" title="${escapeHtml(r.nome)}">${escapeHtml(r.nome)}</div>
          <div class="history-item__meta">
            <span class="history-item__date"><i class="fa-regular fa-clock"></i> ${escapeHtml(r.dataFormatada)}</span>
            ${r.badge ? `<span class="history-item__period" style="border-color:${r.cor || '#3b82f6'}40;color:${r.cor || '#3b82f6'};">${escapeHtml(r.badge)}</span>` : ''}
            ${r.periodo ? `<span class="history-item__period">${escapeHtml(r.periodo)}</span>` : ''}
          </div>
        </div>
        <div class="history-item__actions">
          <button class="history-btn" onclick="baixarRelatorio('${r.url || ''}', '${escapeHtml(r.nome).replace(/'/g, "\\'")}')" title="Baixar PDF" aria-label="Baixar ${escapeHtml(r.nome)}">
            <i class="fa-solid fa-download"></i>
          </button>
          <button class="history-btn history-btn--danger" onclick="removerDoHistorico('${r.id}')" title="Remover do histórico" aria-label="Remover ${escapeHtml(r.nome)}">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function baixarRelatorio(url, nome) {
  if (!url) {
    showToast('URL do relatório não encontrada', 'error');
    return;
  }
  window.open(url + (url.includes('?') ? '&' : '?') + 'auto=1', '_blank');
  showToast('Download do PDF iniciado!', 'success');
}

function filtrarHistorico() {
  const busca = document.getElementById('search-historico')?.value || '';
  document.getElementById('search-clear')?.classList.toggle('visivel', busca.length > 0);
  renderHistorico(busca);
}

function limparBusca() {
  const input = document.getElementById('search-historico');
  if (input) {
    input.value = '';
    document.getElementById('search-clear')?.classList.remove('visivel');
    renderHistorico();
    input.focus();
  }
}

function setPill(el, filtro) {
  filtroAtivo = filtro;
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('ativo'));
  el.classList.add('ativo');
  renderHistorico(document.getElementById('search-historico')?.value || '');
}

// =============================================
// INICIALIZAÇÃO
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  await carregarSumarioPlanilhas();
  await carregarAnalisesSalvas();
  await carregarHistorico();

  // Verifica parâmetros de URL
  const params = new URLSearchParams(window.location.search);
  const analiseIdParam = params.get('analise_id');
  const tipoParam = params.get('tipo');

  if (analiseIdParam) {
    const selTipo = document.getElementById('tipoRelatorio');
    if (selTipo) {
      selTipo.value = 'analise_salva';
      aoMudarTipoRelatorio();
    }
  } else if (tipoParam) {
    const selTipo = document.getElementById('tipoRelatorio');
    if (selTipo && ['analise_salva', 'fluxo_caixa', 'planejamento', 'graficos_avancados', 'consolidado'].includes(tipoParam)) {
      selTipo.value = tipoParam;
      aoMudarTipoRelatorio();
    }
  }

  // Gera pré-visualização inicial automática
  setTimeout(() => {
    gerarPreviewMelhorado();
  }, 300);
});