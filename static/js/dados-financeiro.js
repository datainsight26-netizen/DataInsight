/* ================================================================
     ESTADO GLOBAL DO PAINEL FINANCEIRO
     ================================================================ */
  const FinState = {
    colunas: [],          // colunas da tabela atual
    dadosAmostra: [],     // amostra dos dados (primeiras linhas)
    analise: {},          // resultado da análise { coluna: {categoria, confianca, ...} }
    mapeamentoSugerido: {}, // sugestão automática { categoria: coluna }
    mapeamentoUsuario: {}, // mapeamento confirmado pelo usuário
    categoriasDisponiveis: {}, // metadados das categorias do backend
    completude: {},       // prontidão por ferramenta
    recomendacoes: [],    // lista de recomendações
    preview: {},          // indicadores calculados
    salvo: false,
  };

  /* ================================================================
     DEFINIÇÃO LOCAL DAS CATEGORIAS (fallback sem backend)
     ================================================================ */
  const FIN_CATEGORIAS_LOCAL = [
    // INDICADORES PRINCIPAIS DO NEGÓCIO (Os 4 essenciais que ficavam no modal)
    { id: "periodo",           label: "Data dos Registros / Período", grupo: "Indicadores Principais do Negócio", cor: "#3b82f6", icone: "fa-calendar",        temManual: false, desc: "Coluna contendo as datas (ex: Data, Dia, Periodo, Mês)" },
    { id: "receita_total",     label: "Faturamento / Receita Total",  grupo: "Indicadores Principais do Negócio", cor: "#10b981", icone: "fa-chart-line",      temManual: false, desc: "Total bruto de vendas (ex: Faturamento, Valor, Total, Venda)" },
    { id: "despesas",          label: "Despesas / Gastos Totais",     grupo: "Indicadores Principais do Negócio", cor: "#ef4444", icone: "fa-money-bill-wave", temManual: true,  desc: "Custos operacionais e despesas (ex: Custo, Despesa, Gasto, Saída)", placeholder: "Total despesas fixas R$" },
    { id: "resultado",         label: "Lucro Líquido / Resultado",    grupo: "Indicadores Principais do Negócio", cor: "#8b5cf6", icone: "fa-trophy",          temManual: false, desc: "Resultado final líquido (ex: Lucro, Profit, Saldo)" },

    // DETALHAMENTO DE RECEITAS
    { id: "receita_produtos",  label: "Venda de Produtos",            grupo: "Detalhamento de Receitas",         cor: "#10b981", icone: "fa-box",               temManual: false },
    { id: "receita_servicos",  label: "Venda de Serviços",            grupo: "Detalhamento de Receitas",         cor: "#10b981", icone: "fa-screwdriver-wrench",temManual: false },
    { id: "receita_outros",    label: "Outras Receitas",              grupo: "Detalhamento de Receitas",         cor: "#10b981", icone: "fa-plus-circle",        temManual: false },

    // IMPOSTOS
    { id: "impostos",          label: "Impostos (Valor R$)",          grupo: "Impostos",                         cor: "#6366f1", icone: "fa-file-invoice-dollar",temManual: true },
    { id: "taxa_imposto",      label: "Taxa de Imposto (%)",          grupo: "Impostos",                         cor: "#6366f1", icone: "fa-percent",            temManual: true, placeholder: "Ex: 8 (para 8%)" },

    // CUSTOS VARIÁVEIS
    { id: "fornecedores",      label: "Fornecedores / CMV",           grupo: "Custos Variáveis",                 cor: "#f59e0b", icone: "fa-truck",              temManual: true },
    { id: "publicidade",       label: "Publicidade / Marketing",      grupo: "Custos Variáveis",                 cor: "#f59e0b", icone: "fa-bullhorn",           temManual: true },
    { id: "custo_variavel",    label: "Outros Custos Variáveis",      grupo: "Custos Variáveis",                 cor: "#f59e0b", icone: "fa-arrows-rotate",      temManual: true },

    // GASTOS FIXOS
    { id: "aluguel",           label: "Aluguel / Locação",            grupo: "Gastos Fixos",                     cor: "#ef4444", icone: "fa-building",           temManual: true, placeholder: "Valor fixo mensal R$" },
    { id: "folha_pagamento",   label: "Folha de Pagamento",           grupo: "Gastos Fixos",                     cor: "#ef4444", icone: "fa-users",              temManual: true, placeholder: "Total folha mensal R$" },
    { id: "pro_labore",        label: "Pró-labore / Retirada",        grupo: "Gastos Fixos",                     cor: "#ef4444", icone: "fa-user-tie",           temManual: true, placeholder: "Valor pró-labore R$" },
    { id: "gasto_fixo_outros", label: "Outros Gastos Fixos",          grupo: "Gastos Fixos",                     cor: "#ef4444", icone: "fa-file-alt",           temManual: true },

    // INVESTIMENTOS
    { id: "investimento_infra",        label: "Investimento – Infraestrutura", grupo: "Investimentos",          cor: "#8b5cf6", icone: "fa-hammer",            temManual: true },
    { id: "investimento_equipamentos", label: "Investimento – Equipamentos",   grupo: "Investimentos",          cor: "#8b5cf6", icone: "fa-computer",          temManual: true },
    { id: "investimento_outros",       label: "Outros Investimentos",          grupo: "Investimentos",          cor: "#8b5cf6", icone: "fa-coins",             temManual: true },
  ];

  /* ================================================================
     NOMES SUGERIDOS E METADADOS PARA CRIAÇÃO AUTOMÁTICA DE COLUNAS
     ================================================================ */
  function formatarDataHojeParaColuna() {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2, '0');
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const y = hoje.getFullYear();
    return `${d}/${m}/${y}`;
  }

  const NOMES_SUGERIDOS_COLUNAS = {
    periodo:                   { nome: "Data",                   tipo: "data",       tipoLabel: "📅 Data",       valorPadrao: formatarDataHojeParaColuna() },
    receita_total:             { nome: "Faturamento",            tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    despesas:                  { nome: "Despesas",               tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    resultado:                 { nome: "Lucro Líquido",          tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    receita_produtos:          { nome: "Venda Produtos",         tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    receita_servicos:          { nome: "Venda Serviços",         tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    receita_outros:            { nome: "Outras Receitas",        tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    impostos:                  { nome: "Impostos",               tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    taxa_imposto:              { nome: "Taxa Imposto (%)",       tipo: "percentual", tipoLabel: "% Percentual",   valorPadrao: 8.0 },
    fornecedores:              { nome: "Fornecedores",           tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    publicidade:               { nome: "Marketing",              tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    custo_variavel:            { nome: "Custos Variáveis",       tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    custo_variavel_outros:     { nome: "Custos Diversos",        tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    aluguel:                   { nome: "Aluguel",                tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    folha_pagamento:           { nome: "Folha de Pagamento",     tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    pro_labore:                { nome: "Pró-labore",             tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    gasto_fixo_outros:         { nome: "Gastos Fixos",           tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    investimento_infra:        { nome: "Investimento Infra",     tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    investimento_equipamentos: { nome: "Investimento Equip",     tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
    investimento_outros:       { nome: "Investimentos",          tipo: "moeda",      tipoLabel: "💰 Moeda (R$)",  valorPadrao: 0.0 },
  };

  /* ================================================================
     DICIONÁRIO DETALHADO DE AJUDA DOS CAMPOS FINANCEIROS
     ================================================================ */
  const INFO_CATEGORIAS_DETALHADA = {
    periodo: {
      titulo: "Data dos Registros / Período",
      grupo: "Indicadores Principais",
      tipoFluxo: "Dimensão Temporal",
      cor: "#3b82f6",
      icone: "fa-calendar",
      oQueE: "Identifica a linha do tempo das movimentações da empresa (data exata, dia, mês ou ano de competência).",
      oQueInserir: "Selecione a coluna da sua planilha que contém as datas das transações (ex: <code>Data</code>, <code>Período</code>, <code>Mês</code>, <code>Competência</code>).",
      utilizacao: "Obrigatório para o <strong>Fluxo de Caixa</strong> e <strong>DRE</strong> agruparem os resultados mês a mês e gerarem gráficos temporais."
    },
    receita_total: {
      titulo: "Faturamento / Receita Total",
      grupo: "Indicadores Principais",
      tipoFluxo: "Entrada Financeira (Bruta)",
      cor: "#10b981",
      icone: "fa-chart-line",
      oQueE: "O valor financeiro total bruto arrecadado com as vendas de produtos ou serviços antes de qualquer desconto ou dedução.",
      oQueInserir: "Selecione a coluna que representa o valor bruto das vendas (ex: <code>Faturamento</code>, <code>Total Vendas</code>, <code>Valor Total</code>, <code>Receita</code>).",
      utilizacao: "Base de cálculo para <strong>toda a DRE</strong>, cálculo da <strong>Margem de Contribuição</strong> e projeções de faturamento."
    },
    despesas: {
      titulo: "Despesas / Gastos Totais",
      grupo: "Indicadores Principais",
      tipoFluxo: "Saída Financeira Geral",
      cor: "#ef4444",
      icone: "fa-money-bill-wave",
      oQueE: "A soma consolidada de todas as saídas financeiras, custos operacionais e despesas da empresa.",
      oQueInserir: "Selecione a coluna que consolida os gastos totais (ex: <code>Despesas</code>, <code>Custos</code>, <code>Gastos</code>) ou informe um valor total fixo mensal.",
      utilizacao: "Utilizado no <strong>Fluxo de Caixa</strong> para abater das entradas e calcular o saldo líquido de caixa."
    },
    resultado: {
      titulo: "Lucro Líquido / Resultado",
      grupo: "Indicadores Principais",
      tipoFluxo: "Resultado Líquido Final",
      cor: "#8b5cf6",
      icone: "fa-trophy",
      oQueE: "O valor que sobra após deduzir todos os impostos, custos variáveis e gastos fixos da receita (Lucro Líquido).",
      oQueInserir: "Selecione a coluna com o lucro da sua planilha (ex: <code>Lucro</code>, <code>Resultado</code>, <code>Saldo</code>). <em>Se você não tiver essa coluna, o sistema calcula automaticamente a partir das receitas e despesas!</em>",
      utilizacao: "Principal indicador de rentabilidade no <strong>DRE</strong> e no <strong>Planejamento Financeiro</strong>."
    },
    receita_produtos: {
      titulo: "Venda de Produtos",
      grupo: "Detalhamento de Receitas",
      tipoFluxo: "Entrada Operacional",
      cor: "#10b981",
      icone: "fa-box",
      oQueE: "Receita proveniente exclusivamente da comercialização de mercadorias ou produtos físicos do seu catálogo.",
      oQueInserir: "Selecione a coluna de vendas de mercadorias (ex: <code>Venda Produtos</code>, <code>Receita Mercadorias</code>).",
      utilizacao: "Permite separar o faturamento por canal e calcular o CMV (Custo das Mercadorias Vendidas) proporcional."
    },
    receita_servicos: {
      titulo: "Venda de Serviços",
      grupo: "Detalhamento de Receitas",
      tipoFluxo: "Entrada Operacional",
      cor: "#10b981",
      icone: "fa-screwdriver-wrench",
      oQueE: "Receita obtida pela prestação de serviços técnicos, mensalidades, contratos ou consultorias.",
      oQueInserir: "Selecione a coluna com valores de serviços prestados (ex: <code>Serviços</code>, <code>Honorários</code>, <code>Consultoria</code>).",
      utilizacao: "Identifica a proporção de serviços no mix de faturamento para apuração de alíquotas de ISS."
    },
    receita_outros: {
      titulo: "Outras Receitas",
      grupo: "Detalhamento de Receitas",
      tipoFluxo: "Entrada Não Operacional",
      cor: "#10b981",
      icone: "fa-plus-circle",
      oQueE: "Ganhos secundários ou extraordinários, como rendimentos de aplicações, venda de ativos usados ou descontos obtidos.",
      oQueInserir: "Selecione a coluna de receitas extras (ex: <code>Outras Receitas</code>, <code>Rendimentos</code>).",
      utilizacao: "Entra na apuração do resultado financeiro sem distorcer a margem operacional das vendas."
    },
    impostos: {
      titulo: "Impostos (Valor R$)",
      grupo: "Impostos",
      tipoFluxo: "Dedução da Receita",
      cor: "#6366f1",
      icone: "fa-file-invoice-dollar",
      oQueE: "Valor em dinheiro pago em tributos sobre a venda (Simples Nacional, ISS, ICMS, PIS/COFINS).",
      oQueInserir: "Selecione a coluna que já calcula o valor dos impostos em R$, ou deixe em branco e use o campo <em>Taxa de Imposto (%)</em>.",
      utilizacao: "Deduzido diretamente da Receita Bruta no <strong>DRE</strong> para obter a <strong>Receita Líquida</strong>."
    },
    taxa_imposto: {
      titulo: "Taxa de Imposto (%)",
      grupo: "Impostos",
      tipoFluxo: "Alíquota Tributária",
      cor: "#6366f1",
      icone: "fa-percent",
      oQueE: "A alíquota percentual média de impostos que a empresa paga sobre as notas fiscais emitidas.",
      oQueInserir: "Informe o percentual médio no campo de valor fixo (ex: <code>6</code> para 6% ou <code>8</code> para 8%) ou selecione uma coluna com a alíquota.",
      utilizacao: "Se a planilha não tiver valores em R$, o sistema calcula automaticamente os impostos multiplicando o faturamento por essa taxa."
    },
    fornecedores: {
      titulo: "Fornecedores / CMV",
      grupo: "Custos Variáveis",
      tipoFluxo: "Saída Variável Direta",
      cor: "#f59e0b",
      icone: "fa-truck",
      oQueE: "Custos diretos na aquisição de mercadorias para revenda, matérias-primas e insumos de produção.",
      oQueInserir: "Selecione a coluna de compras de fornecedores ou custo de mercadoria (ex: <code>Fornecedores</code>, <code>CMV</code>, <code>Matéria-Prima</code>).",
      utilizacao: "Fator principal no cálculo da <strong>Margem de Contribuição</strong> e do Ponto de Equilíbrio no Planejamento Financeiro."
    },
    publicidade: {
      titulo: "Publicidade / Marketing",
      grupo: "Custos Variáveis",
      tipoFluxo: "Saída Variável Comercial",
      cor: "#f59e0b",
      icone: "fa-bullhorn",
      oQueE: "Investimentos em tráfego pago (Meta Ads, Google Ads), anúncios, comissões de vendedores e ações promocionais.",
      oQueInserir: "Selecione a coluna de gastos com marketing/comissões ou informe o gasto médio mensal.",
      utilizacao: "Ajuda a medir o Custo de Aquisição de Clientes (CAC) e a eficiência comercial na DRE."
    },
    custo_variavel: {
      titulo: "Outros Custos Variáveis",
      grupo: "Custos Variáveis",
      tipoFluxo: "Saída Variável Direta",
      cor: "#f59e0b",
      icone: "fa-arrows-rotate",
      oQueE: "Custos que sobem ou descem de forma diretamente proporcional à quantidade de vendas (fretes de entrega, embalagens, taxas de maquininha).",
      oQueInserir: "Selecione a coluna correspondente a taxas de cartão, fretes ou embalagens.",
      utilizacao: "Subtraído da receita líquida para apurar a <strong>Margem de Contribuição Real</strong>."
    },
    aluguel: {
      titulo: "Aluguel / Locação",
      grupo: "Gastos Fixos",
      tipoFluxo: "Saída Fixa Mensal",
      cor: "#ef4444",
      icone: "fa-building",
      oQueE: "Custo fixo mensal de locação do imóvel, condomínio comercial, IPTU ou espaço de escritório.",
      oQueInserir: "Selecione a coluna de aluguel ou digite o valor mensal fixo no campo manual (ex: <code>2500</code>).",
      utilizacao: "Indispensável no <strong>Planejamento Financeiro</strong> para determinar quanto a empresa precisa faturar para cobrir a estrutura fixa."
    },
    folha_pagamento: {
      titulo: "Folha de Pagamento",
      grupo: "Gastos Fixos",
      tipoFluxo: "Saída Fixa de Pessoal",
      cor: "#ef4444",
      icone: "fa-users",
      oQueE: "Total pago em salários de funcionários, equipe fixa (CLT/PJ), benefícios, FGTS e encargos.",
      oQueInserir: "Selecione a coluna de folha salarial ou digite o total mensal gasto com a equipe no campo manual.",
      utilizacao: "Item estrutural do <strong>DRE</strong> e da projeção de 12 meses do Planejamento Financeiro."
    },
    pro_labore: {
      titulo: "Pró-labore / Retirada",
      grupo: "Gastos Fixos",
      tipoFluxo: "Saída Fixa dos Sócios",
      cor: "#ef4444",
      icone: "fa-user-tie",
      oQueE: "Remuneração mensal fixa estipulada para os sócios pelo trabalho de administração da empresa.",
      oQueInserir: "Selecione a coluna de pró-labore ou insira o valor fixo mensal das retiradas.",
      utilizacao: "Garante a separação clara entre a despesa de operação da empresa e a distribuição final de lucros."
    },
    gasto_fixo_outros: {
      titulo: "Outros Gastos Fixos",
      grupo: "Gastos Fixos",
      tipoFluxo: "Saída Fixa Administrativa",
      cor: "#ef4444",
      icone: "fa-file-alt",
      oQueE: "Contas de consumo e manutenção recorrente (energia, água, internet, contabilidade, licenças de software, telefone).",
      oQueInserir: "Selecione a coluna de despesas administrativas ou preencha o valor fixo mensal estimado.",
      utilizacao: "Fecha o total de custos fixos que a Margem de Contribuição precisa cobrir para o negócio dar lucro."
    },
    investimento_infra: {
      titulo: "Investimento – Infraestrutura",
      grupo: "Investimentos",
      tipoFluxo: "Saída de Capital (CAPEX)",
      cor: "#8b5cf6",
      icone: "fa-hammer",
      oQueE: "Recursos investidos em obras, reformas, ampliações físicas de instalações ou abertura de novas unidades.",
      oQueInserir: "Selecione a coluna com valores investidos em melhorias ou insira o valor pontual.",
      utilizacao: "Classificado como saída de investimentos no <strong>Fluxo de Caixa</strong> sem penalizar a margem operacional."
    },
    investimento_equipamentos: {
      titulo: "Investimento – Equipamentos",
      grupo: "Investimentos",
      tipoFluxo: "Saída de Capital (CAPEX)",
      cor: "#8b5cf6",
      icone: "fa-computer",
      oQueE: "Aquisição de computadores, maquinários pesados, veículos da empresa ou ferramentas de produção duráveis.",
      oQueInserir: "Selecione a coluna de compra de máquinas/equipamentos.",
      utilizacao: "Registrado no balanço de investimentos do negócio."
    },
    investimento_outros: {
      titulo: "Outros Investimentos",
      grupo: "Investimentos",
      tipoFluxo: "Saída de Capital",
      cor: "#8b5cf6",
      icone: "fa-coins",
      oQueE: "Aportes estratégicos, compra de patentes, aquisições ou qualquer investimento de longo prazo.",
      oQueInserir: "Selecione a coluna de investimentos gerais.",
      utilizacao: "Contabilizado nas ferramentas de fluxo e planejamento de expansão."
    }
  };

  /* ================================================================
     MODAL DE INFORMAÇÕES EXPLICATIVAS DO CAMPO (i)
     ================================================================ */
  function abrirModalFinInfo(catId) {
    const modal = document.getElementById('modalFinInfo');
    const titleEl = document.getElementById('finInfoModalTitle');
    const contentEl = document.getElementById('finInfoModalContent');
    if (!modal || !contentEl) return;

    const info = INFO_CATEGORIAS_DETALHADA[catId] || {
      titulo: catId,
      grupo: "Geral",
      tipoFluxo: "Indicador Financeiro",
      cor: "#2563eb",
      icone: "fa-circle-info",
      oQueE: "Campo financeiro utilizado nos cálculos das ferramentas analíticas.",
      oQueInserir: "Selecione a coluna da sua planilha que melhor representa este indicador.",
      utilizacao: "Utilizado nas ferramentas de Planejamento Financeiro, DRE e Fluxo de Caixa."
    };

    if (titleEl) {
      titleEl.innerHTML = `<i class="fa-solid ${info.icone}" style="color:${info.cor};"></i> <span>${info.titulo}</span>`;
    }

    contentEl.innerHTML = `
      <div style="background:${info.cor}12; border:1.5px solid ${info.cor}35; border-radius:14px; padding:14px 16px; margin-bottom:16px; display:flex; gap:14px; align-items:center;">
        <div style="width:44px; height:44px; border-radius:12px; background:${info.cor}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; box-shadow: 0 4px 12px ${info.cor}40;">
          <i class="fa-solid ${info.icone}"></i>
        </div>
        <div>
          <div style="font-weight:800; font-size:15px; color:var(--texto);">${info.titulo}</div>
          <div style="font-size:11.5px; color:var(--suave); font-weight:600; margin-top:2px;">
            <span style="display:inline-block; padding:1px 7px; background:${info.cor}20; color:${info.cor}; border-radius:999px; font-size:10.5px; margin-right:4px;">${info.grupo}</span>
            &bull; ${info.tipoFluxo}
          </div>
        </div>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:13px; font-weight:700; color:var(--texto); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
         O que é este campo?
        </div>
        <p style="font-size:13px; color:var(--suave); margin:0; line-height:1.45;">${info.oQueE}</p>
      </div>

      <div style="margin-bottom:14px;">
        <div style="font-size:13px; font-weight:700; color:var(--texto); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
           O que você deve selecionar / inserir?
        </div>
        <p style="font-size:13px; color:var(--suave); margin:0; line-height:1.45;">${info.oQueInserir}</p>
      </div>

      <div style="background:var(--fundo); border:1px dashed var(--borda); border-radius:10px; padding:12px 14px;">
        <div style="font-size:12px; font-weight:700; color:var(--texto); margin-bottom:3px; display:flex; align-items:center; gap:6px;">
        Onde é utilizado no sistema:
        </div>
        <div style="font-size:12px; color:var(--suave); line-height:1.4;">${info.utilizacao}</div>
      </div>
    `;

    modal.style.display = 'flex';
  }
  window.abrirModalFinInfo = abrirModalFinInfo;

  /* ================================================================
     INICIALIZAÇÃO — Carrega mapeamento salvo ao abrir a página
     ================================================================ */
  document.addEventListener('DOMContentLoaded', () => {
    carregarClassificacaoSalva();
  });

  /* ================================================================
     MOSTRAR / OCULTAR PAINEL
     ================================================================ */
  function mostrarPainelFinanceiro() {
    const sec = document.getElementById('secaoClassificacaoFinanceira');
    const body = document.getElementById('finPanelBody');
    const icon = document.getElementById('finToggleIcon');
    if (sec) {
      sec.style.display = 'block';
      if (body) body.style.display = 'block';
      if (icon) icon.className = 'fa-solid fa-chevron-up';
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Compatibilidade com antigas chamadas do modal
  window.abrirModalMapeamento = function(colunas) {
    if (colunas && colunas.length > 0) {
      FinState.colunas = colunas;
      const { amostra } = finObterDadosTabela();
      FinState.dadosAmostra = amostra;
      renderizarCategorias();
    }
    mostrarPainelFinanceiro();
  };

  function finTogglePanel() {
    const body = document.getElementById('finPanelBody');
    const icon = document.getElementById('finToggleIcon');
    if (!body || !icon) return;

    if (body.style.display === 'none') {
      body.style.display = 'block';
      icon.className = 'fa-solid fa-chevron-up';
    } else {
      body.style.display = 'none';
      icon.className = 'fa-solid fa-chevron-down';
    }
  }

  /* ================================================================
     TABS
     ================================================================ */
  function finMudarTab(tab) {
    document.querySelectorAll('.fin-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.fin-tab-content').forEach(c => c.classList.remove('active'));

    const btn = document.getElementById(`finTab-${tab}`);
    const content = document.getElementById(`finTabContent-${tab}`);
    if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
    if (content) content.classList.add('active');
  }

  /* ================================================================
     OBTER DADOS DA TABELA ATUAL (colunas + amostra)
     ================================================================ */
  function finObterDadosTabela() {
    let colunas = [];
    let amostra = [];

    // 1ª opção: usar a tabela ativa do estado global (mais confiável, sem race condition com DOM)
    if (typeof _tabelas !== 'undefined' && typeof _tabelaAtualId !== 'undefined') {
      const tabAtiva = _tabelas.find(t => t.id === _tabelaAtualId) || _tabelas[0];
      if (tabAtiva) {
        colunas = Array.isArray(tabAtiva.colunas) ? [...tabAtiva.colunas] : [];
        const dados = Array.isArray(tabAtiva.dados) ? tabAtiva.dados : [];
        amostra = dados.slice(0, 20).map(linha => colunas.map(c => String(linha[c] ?? '')));
        if (colunas.length > 0) return { colunas, amostra };
      }
    }

    // 2ª opção: estado.colunasAtuais / estado.todosDados
    if (typeof estado !== 'undefined' && typeof obterColunasValidas === 'function') {
      colunas = obterColunasValidas();
      if (colunas.length > 0) {
        const dados = Array.isArray(estado.todosDados) ? estado.todosDados : [];
        amostra = dados.slice(0, 20).map(linha => colunas.map(c => String(linha[c] ?? '')));
        return { colunas, amostra };
      }
    }

    // 3ª opção: fallback pelo DOM
    document.querySelectorAll('#tabelaDados thead th').forEach((th, i) => {
      const total = document.querySelectorAll('#tabelaDados thead th').length;
      if (i > 0 && i < total - 1) colunas.push(th.textContent.trim());
    });
    document.querySelectorAll('#dados-tbody tr').forEach((tr, ri) => {
      if (ri >= 20) return;
      const linha = [];
      tr.querySelectorAll('input.entrada-linha').forEach(inp => linha.push(inp.value));
      if (linha.length) amostra.push(linha.slice(0, colunas.length));
    });

    return { colunas, amostra };
  }

  /* ================================================================
     SINCRONIZAR PAINEL COM TABELA ATIVA (chamado ao trocar de aba)
     Recebe o objeto tab diretamente para evitar race condition com DOM
     ================================================================ */
  function finSincronizarComTabela(tab) {
    if (!tab) return;

    // Atualiza colunas e amostra a partir do objeto tabela (sem depender do DOM)
    const novasColunas = Array.isArray(tab.colunas) ? [...tab.colunas] : [];
    const dados = Array.isArray(tab.dados) ? tab.dados : [];
    const novaAmostra = dados.slice(0, 20).map(linha => novasColunas.map(c => String(linha[c] ?? '')));

    FinState.colunas = novasColunas;
    FinState.dadosAmostra = novaAmostra;

    // Limpar análise anterior (era da outra tabela)
    FinState.analise = {};
    FinState.mapeamentoSugerido = {};
    // NÃO limpar mapeamentoUsuario — manter escolhas manuais do usuário como ponto de partida
    // Apenas remover mapeamentos que usam colunas que não existem mais na nova tabela
    Object.keys(FinState.mapeamentoUsuario).forEach(k => {
      const val = FinState.mapeamentoUsuario[k];
      // Só remove se for nome de coluna (string) e a coluna não existe na nova tabela
      if (typeof val === 'string' && val && !novasColunas.includes(val)) {
        delete FinState.mapeamentoUsuario[k];
      }
    });

    if (novasColunas.length > 0) {
      // Re-rodar análise local automática com as colunas da nova tabela
      _finAnaliseLocalSemRenderizar(novasColunas);
      renderizarCategorias();
      renderizarStatusFerramentas({ local: true });
      renderizarRecomendacoesLocal();
      atualizarBadge();
    }
  }
  window.finSincronizarComTabela = finSincronizarComTabela;

  /* Análise local silenciosa (só atualiza FinState, sem chamar renderizarCategorias) */
  function _finAnaliseLocalSemRenderizar(colunas) {
    const aliases = {
      receita_total:     [/faturamento/i, /receita/i, /entrada/i, /venda.?total/i],
      receita_produtos:  [/produto/i, /mercadoria/i, /venda.*prod/i],
      receita_servicos:  [/servi[cç]/i, /prest/i, /honorario/i],
      impostos:          [/imposto/i, /tributo/i, /tax/i, /simples/i, /iss/i, /icms/i],
      taxa_imposto:      [/al[ií]quota/i, /taxa.*imp/i],
      fornecedores:      [/fornecedor/i, /compra/i, /cmv/i, /mat.*prima/i],
      publicidade:       [/publicidade/i, /marketing/i, /propaganda/i, /ads/i],
      aluguel:           [/aluguel/i, /loca[cç]/i, /rent/i],
      folha_pagamento:   [/folha/i, /sal[aá]rio/i, /funcion/i, /payroll/i],
      pro_labore:        [/pro.*labore/i, /retirada/i, /s[oó]cio/i],
      investimento_outros: [/investimento/i, /capex/i, /equipamento/i],
      resultado:         [/lucro/i, /resultado/i, /profit/i],
      periodo:           [/data/i, /per[ií]odo/i, /m[eê]s/i, /ano/i],
      despesas:          [/despesa/i, /gasto/i, /custo/i, /saida/i],
    };
    const sugestoes = {};
    colunas.forEach(col => {
      Object.entries(aliases).forEach(([cat, pats]) => {
        if (!sugestoes[cat] && pats.some(p => p.test(col))) {
          sugestoes[cat] = col;
        }
      });
    });
    FinState.mapeamentoSugerido = sugestoes;
    // Aplicar sugestões ao mapeamento do usuário (sem sobrescrever escolhas manuais)
    Object.entries(sugestoes).forEach(([cat, col]) => {
      if (!FinState.mapeamentoUsuario[cat]) {
        FinState.mapeamentoUsuario[cat] = col;
      }
    });
    // Simular analise com confiança parcial para exibição correta de status
    FinState.analise = {};
    Object.entries(sugestoes).forEach(([cat, col]) => {
      if (col) FinState.analise[col] = { categoria: cat, confianca: 60 };
    });
  }

  /* ================================================================
     ANALISAR AUTOMATICAMENTE
     ================================================================ */
  async function analisarColunasFinanceiras() {
    const btn = document.getElementById('btnAnalisarFinanceiro');
    const { colunas, amostra } = finObterDadosTabela();

    if (colunas.length === 0) {
      if (typeof mostrarToast === 'function') mostrarToast('Carregue dados na tabela antes de analisar.', 'warning');
      return;
    }

    FinState.colunas = colunas;
    FinState.dadosAmostra = amostra;

    // Feedback visual imediato
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisando...'; btn.disabled = true; }

    try {
      const resp = await fetch('/api/mapeamento-financeiro/analisar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colunas, dados_amostra: amostra }),
      });
      const json = await resp.json();

      if (resp.ok) {
        FinState.analise = json.analise || {};
        FinState.mapeamentoSugerido = json.mapeamento_sugerido || {};
        FinState.categoriasDisponiveis = json.categorias_disponiveis || {};

        // Aplicar sugestões ao mapeamento do usuário (sem sobrescrever o que já foi definido)
        Object.entries(FinState.mapeamentoSugerido).forEach(([cat, col]) => {
          if (!FinState.mapeamentoUsuario[cat]) {
            FinState.mapeamentoUsuario[cat] = col;
          }
        });

        renderizarCategorias();
        mostrarPainelFinanceiro();
        if (typeof mostrarToast === 'function') mostrarToast('✓ Análise concluída!', 'success');

        // Salvar mapeamento e atualizar status em paralelo (não bloqueia a UI)
        Promise.all([
          salvarClassificacaoFinanceira(true),
          atualizarStatusCompleto()
        ]).catch(e => console.warn('[Fin] Erro ao salvar após análise:', e));
      } else {
        throw new Error(json.mensagem || 'Erro na análise');
      }
    } catch (err) {
      console.error('[Fin] Erro na análise:', err);
      // Fallback: análise local sem backend
      finAnaliseLocal();
    } finally {
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analisar Automaticamente';
        btn.disabled = false;
        btn.classList.remove('btn-analisar-pulse');
      }
    }
  }

  /* ================================================================
     ANÁLISE LOCAL (fallback sem backend)
     ================================================================ */
  function finAnaliseLocal() {
    const { colunas, amostra } = finObterDadosTabela();
    FinState.colunas = colunas;
    FinState.dadosAmostra = amostra;

    const aliases = {
      receita_total:     [/faturamento/i, /receita/i, /entrada/i, /venda total/i],
      receita_produtos:  [/produto/i, /mercadoria/i, /venda.*prod/i],
      receita_servicos:  [/servi[cç]/i, /prest/i, /honorario/i],
      impostos:          [/imposto/i, /tributo/i, /tax/i, /simples/i, /iss/i, /icms/i],
      taxa_imposto:      [/al[ií]quota/i, /taxa.*imp/i],
      fornecedores:      [/fornecedor/i, /compra/i, /cmv/i, /mat.*prima/i],
      publicidade:       [/publicidade/i, /marketing/i, /propaganda/i, /ads/i],
      aluguel:           [/aluguel/i, /loca[cç]/i, /rent/i],
      folha_pagamento:   [/folha/i, /sal[aá]rio/i, /funcion/i, /payroll/i],
      pro_labore:        [/pro.*labore/i, /retirada/i, /s[oó]cio/i],
      investimento_outros: [/investimento/i, /capex/i, /equipamento/i],
      resultado:         [/lucro/i, /resultado/i, /profit/i],
      periodo:           [/data/i, /per[ií]odo/i, /m[eê]s/i, /ano/i],
      despesas:          [/despesa/i, /gasto/i, /custo/i, /saida/i],
    };

    const sugestoes = {};
    colunas.forEach(col => {
      Object.entries(aliases).forEach(([cat, pats]) => {
        if (!sugestoes[cat] && pats.some(p => p.test(col))) {
          sugestoes[cat] = col;
        }
      });
    });

    FinState.mapeamentoSugerido = sugestoes;
    Object.entries(sugestoes).forEach(([cat, col]) => {
      if (!FinState.mapeamentoUsuario[cat]) FinState.mapeamentoUsuario[cat] = col;
    });

    renderizarCategorias();
    renderizarStatusFerramentas({ local: true });
    renderizarRecomendacoesLocal();
    mostrarPainelFinanceiro();
    if (typeof mostrarToast === 'function') mostrarToast('Análise local concluída. Ajuste os campos se necessário.', 'info');
  }

  /* ================================================================
     RENDERIZAR CATEGORIAS
     ================================================================ */
  function renderizarCategorias() {
    const container = document.getElementById('finCategoriasContainer');
    if (!container) return;

    // Calcular campos essenciais faltantes para o banner
    const essenciais = ['periodo', 'receita_total', 'despesas', 'resultado', 'impostos', 'aluguel', 'folha_pagamento'];
    const faltantesEssenciais = essenciais.filter(c => !FinState.mapeamentoUsuario[c] && !FinState.mapeamentoUsuario[`${c}_manual`]);

    let html = '';

    if (faltantesEssenciais.length > 0) {
      html += `
        <div class="fin-bulk-create-banner">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:36px; height:36px; border-radius:10px; background:rgba(37,99,235,0.15); color:var(--primaria); display:flex; align-items:center; justify-content:center; font-size:16px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
            </div>
            <div>
              <div style="font-weight:700; font-size:13px; color:var(--texto);">Assistente de Estruturação Financeira</div>
              <div style="font-size:12px; color:var(--suave);">Detectamos ${faltantesEssenciais.length} campo(s) essencial(is) não mapeado(s). Crie-os na tabela com 1 clique.</div>
            </div>
          </div>
          <button type="button" class="fin-bulk-create-btn" onclick="abrirModalCriarTodasFaltantes()">
            <i class="fa-solid fa-bolt"></i> Criar Campos Faltantes (${faltantesEssenciais.length})
          </button>
        </div>
      `;
    }

    const grupos = {};
    FIN_CATEGORIAS_LOCAL.forEach(cat => {
      if (!grupos[cat.grupo]) grupos[cat.grupo] = [];
      grupos[cat.grupo].push(cat);
    });

    Object.entries(grupos).forEach(([grupo, cats]) => {
      html += `<p class="fin-grupo-label">${grupo}</p><div class="fin-categorias-grid">`;
      cats.forEach(cat => {
        const valorAtual = FinState.mapeamentoUsuario[cat.id] || '';
        const valorManual = FinState.mapeamentoUsuario[`${cat.id}_manual`] || '';
        const confianca = FinState.analise[valorAtual]?.confianca || 0;
        const sugestao = NOMES_SUGERIDOS_COLUNAS[cat.id] || { nome: cat.label, tipo: "moeda", tipoLabel: "💰 Moeda", valorPadrao: 0.0 };

        let statusClass = 'ausente';
        let statusText = '❌ Não mapeado';
        if (valorAtual) { statusClass = confianca >= 75 ? 'mapeado' : 'sugerido'; statusText = confianca >= 75 ? '✅ Mapeado' : '⚠️ Sugerido'; }
        else if (valorManual) { statusClass = 'mapeado'; statusText = '✅ Manual'; }

        const barColor = confianca >= 75 ? '#10b981' : confianca > 0 ? '#f59e0b' : '#ef4444';

        // Opções do select
        let opcoesSelect = `<option value="">— Selecionar coluna —</option>`;
        if (!valorAtual) {
          opcoesSelect += `<option value="__criar_${cat.id}__" style="color:var(--primaria); font-weight:700;">➕ Não possui? Criar coluna "${sugestao.nome}"</option>`;
        }
        FinState.colunas.forEach(col => {
          opcoesSelect += `<option value="${col}" ${valorAtual === col ? 'selected' : ''}>${col}</option>`;
        });

        html += `
          <div class="fin-cat-card" style="--fin-cat-cor: ${cat.cor};">
            <button class="fin-info-btn" type="button" title="Guia explicativo: ${cat.label}" onclick="abrirModalFinInfo('${cat.id}')">
              <i class="fa-solid fa-circle-info"></i>
            </button>
            <div class="fin-cat-card-header">
              <div class="fin-cat-icon" style="background:${cat.cor}20; color:${cat.cor};">
                <i class="fa-solid ${cat.icone}"></i>
              </div>
              <div style="flex:1; min-width:0;">
                <div class="fin-cat-title">${cat.label}</div>
                <div class="fin-cat-grupo">${cat.grupo}</div>
              </div>
              <span class="fin-cat-status ${statusClass}">${statusText}</span>
            </div>
            <div class="fin-cat-controls">
              <select class="fin-cat-select" data-cat="${cat.id}" onchange="finAtualizarMapeamento('${cat.id}', this.value)">
                ${opcoesSelect}
              </select>
              ${cat.desc ? `<div style="font-size:11.5px; color:var(--suave); margin-top:2px; line-height:1.3;">${cat.desc}</div>` : ''}
              ${(!valorAtual || confianca < 75) ? `
              <div class="fin-sugestao-criar-coluna">
                <button type="button" class="btn-sugestao-criar-col" onclick="abrirModalCriarColunaFin('${cat.id}')" title="Criar coluna ${sugestao.nome} automaticamente na tabela">
                  <i class="fa-solid fa-plus-circle"></i> Criar coluna <strong>"${sugestao.nome}"</strong> na tabela
                </button>
              </div>` : ''}
              ${cat.temManual ? `
              <div class="fin-cat-manual-row" style="display:flex; align-items:center; gap:6px;">
                <span class="fin-cat-manual-label"><i class="fa-solid fa-keyboard" style="font-size:10px;"></i> Valor fixo:</span>
                <input type="number" class="fin-cat-manual-input" placeholder="${cat.placeholder || 'R$ por mês'}"
                  data-cat-manual="${cat.id}"
                  value="${valorManual}"
                  oninput="finAtualizarManual('${cat.id}', this.value)"
                  onchange="finAtualizarManual('${cat.id}', this.value)"
                  style="flex:1;" />
                ${(valorManual !== '' && valorManual !== null && valorManual !== undefined) ? `
                <button type="button" class="btn-limpar-manual" onclick="finLimparManual('${cat.id}')" title="Limpar valor fixo" style="border:none; background:rgba(239,68,68,0.12); color:#dc2626; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px; font-weight:700;">
                  ✕
                </button>` : ''}
              </div>` : ''}
            </div>
            ${valorAtual ? `
            <div class="fin-confidence-bar">
              <div class="fin-confidence-fill" style="width:${confianca}%; background:${barColor};"></div>
            </div>
            <div class="fin-confidence-label">
              <span>Confiança da detecção</span>
              <span style="font-weight:700; color:${barColor};">${confianca}%</span>
            </div>` : ''}
          </div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
    atualizarBadge();
  }

  /* ================================================================
     MODAL E CRIAÇÃO AUTOMÁTICA DE COLUNA FINANCEIRA
     ================================================================ */
  function abrirModalCriarColunaFin(catId) {
    const cat = FIN_CATEGORIAS_LOCAL.find(c => c.id === catId);
    if (!cat) return;

    const modal = document.getElementById('modalConfirmarCriarColunaFin');
    if (!modal) return;

    const sugestao = NOMES_SUGERIDOS_COLUNAS[catId] || { nome: cat.label, tipo: "moeda", tipoLabel: "💰 Moeda", valorPadrao: 0.0 };

    document.getElementById('finModalCatId').value = catId;
    document.getElementById('finModalCatTitulo').textContent = cat.label;
    document.getElementById('finModalCatGrupo').textContent = cat.grupo;
    document.getElementById('finModalCatIcon').innerHTML = `<i class="fa-solid ${cat.icone}"></i>`;
    document.getElementById('finModalCatIcon').style.background = cat.cor;

    const inputNome = document.getElementById('finModalNomeColuna');
    if (inputNome) inputNome.value = sugestao.nome;

    const selectTipo = document.getElementById('finModalTipoColuna');
    if (selectTipo) selectTipo.value = sugestao.tipo || 'moeda';

    const inputValor = document.getElementById('finModalValorPadrao');
    if (inputValor) inputValor.value = sugestao.valorPadrao !== undefined ? sugestao.valorPadrao : '';

    modal.style.display = 'flex';
  }
  window.abrirModalCriarColunaFin = abrirModalCriarColunaFin;

  async function executarCriacaoColunaFin() {
    const catId = document.getElementById('finModalCatId')?.value;
    const nomeColuna = document.getElementById('finModalNomeColuna')?.value.trim();
    const valorPadrao = document.getElementById('finModalValorPadrao')?.value.trim() || '';
    const tipo = document.getElementById('finModalTipoColuna')?.value || 'moeda';

    if (!catId || !nomeColuna) {
      if (typeof mostrarToast === 'function') mostrarToast('Informe o nome da coluna.', 'warning');
      return;
    }

    const btn = document.getElementById('btnConfirmarCriarColunaFin');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Criando...'; }

    try {
      const valParaPreencher = (valorPadrao !== '' && !isNaN(parseFloat(valorPadrao)) && tipo !== 'texto') 
        ? parseFloat(valorPadrao) 
        : valorPadrao;

      // 1. Criar coluna no frontend imediatamente (síncrono — sem await)
      if (typeof window.adicionarColunaComNome === 'function') {
        window.adicionarColunaComNome(nomeColuna, valParaPreencher, false);
      }

      // 2. Preencher valor padrão nas linhas existentes
      if (typeof estado !== 'undefined' && Array.isArray(estado.todosDados)) {
        if (estado.todosDados.length === 0) {
          estado.todosDados = [{ _id: 'row-1', [nomeColuna]: valParaPreencher }];
        } else {
          estado.todosDados.forEach(linha => {
            if (linha[nomeColuna] === undefined || linha[nomeColuna] === '' || linha[nomeColuna] === null) {
              linha[nomeColuna] = valParaPreencher;
            }
          });
        }
        if (typeof atualizarTabela === 'function') atualizarTabela();
        if (typeof exibirPagina === 'function') exibirPagina();
        if (typeof sincronizarTabelaAtiva === 'function') sincronizarTabelaAtiva();
      }

      // 3. Atualizar mapeamento local imediatamente
      const { colunas, amostra } = finObterDadosTabela();
      FinState.colunas = colunas.length > 0 ? colunas : [nomeColuna];
      FinState.dadosAmostra = amostra;
      FinState.mapeamentoUsuario[catId] = nomeColuna;
      if (valParaPreencher !== '') {
        FinState.mapeamentoUsuario[`${catId}_manual`] = valParaPreencher;
      }

      // Fechar modal e atualizar UI imediatamente
      const modal = document.getElementById('modalConfirmarCriarColunaFin');
      if (modal) modal.style.display = 'none';
      renderizarCategorias();

      if (typeof mostrarToast === 'function') {
        mostrarToast(`✓ Coluna "${nomeColuna}" criada com sucesso!`, 'success');
      }

      // 4. Persistir no backend em paralelo (não bloqueia a UI)
      Promise.all([
        typeof salvarDados === 'function' ? salvarDados(true) : Promise.resolve(),
        fetch('/api/mapeamento-financeiro/criar-coluna', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nome_coluna: nomeColuna,
            categoria_id: catId,
            valor_padrao: valParaPreencher,
            tipo: tipo
          })
        }).catch(e => console.warn('[Fin] Erro ao sincronizar criação com backend:', e))
      ]).then(() => {
        // Atualizar status após persistência (background)
        atualizarStatusCompleto().catch(() => {});
      }).catch(e => console.warn('[Fin] Erro ao persistir coluna:', e));

    } catch (err) {
      console.error('[Fin] Erro ao criar coluna:', err);
      if (typeof mostrarToast === 'function') mostrarToast('Erro ao criar coluna na tabela.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-plus"></i> Autorizar e Criar Coluna'; }
    }
  }
  window.executarCriacaoColunaFin = executarCriacaoColunaFin;

  /* ================================================================
     CRIAÇÃO EM LOTE DE TODAS AS COLUNAS ESSENCIAIS FALTANTES
     ================================================================ */
  function abrirModalCriarTodasFaltantes() {
    const modal = document.getElementById('modalCriarTodasFaltantes');
    const container = document.getElementById('finListaColunasFaltantes');
    if (!modal || !container) return;

    const essenciais = ['periodo', 'receita_total', 'despesas', 'resultado', 'impostos', 'aluguel', 'folha_pagamento'];
    const faltantes = essenciais.filter(c => !FinState.mapeamentoUsuario[c] && !FinState.mapeamentoUsuario[`${c}_manual`]);

    if (faltantes.length === 0) {
      if (typeof mostrarToast === 'function') mostrarToast('Todas as colunas essenciais já estão mapeadas!', 'info');
      return;
    }

    container.innerHTML = faltantes.map(catId => {
      const cat = FIN_CATEGORIAS_LOCAL.find(c => c.id === catId) || {};
      const sug = NOMES_SUGERIDOS_COLUNAS[catId] || { nome: catId, tipoLabel: '💰 Moeda' };
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--cartao); padding:8px 12px; border-radius:8px; border:1px solid var(--borda);">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid ${cat.icone || 'fa-tag'}" style="color:${cat.cor || 'var(--primaria)'}; width:16px;"></i>
            <span style="font-weight:700; font-size:13px; color:var(--texto);">${cat.label || catId}</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:11px; background:rgba(37,99,235,0.1); color:var(--primaria); padding:2px 8px; border-radius:999px; font-weight:700;">Coluna: "${sug.nome}"</span>
            <span style="font-size:11px; color:var(--suave);">${sug.tipoLabel}</span>
          </div>
        </div>
      `;
    }).join('');

    modal.style.display = 'flex';
  }
  window.abrirModalCriarTodasFaltantes = abrirModalCriarTodasFaltantes;

  async function executarCriarTodasFaltantes() {
    const modal = document.getElementById('modalCriarTodasFaltantes');
    const essenciais = ['periodo', 'receita_total', 'despesas', 'resultado', 'impostos', 'aluguel', 'folha_pagamento'];
    const faltantes = essenciais.filter(c => !FinState.mapeamentoUsuario[c] && !FinState.mapeamentoUsuario[`${c}_manual`]);

    if (faltantes.length === 0) {
      if (modal) modal.style.display = 'none';
      return;
    }

    faltantes.forEach(catId => {
      const sug = NOMES_SUGERIDOS_COLUNAS[catId] || { nome: catId, valorPadrao: 0.0 };
      if (typeof window.adicionarColunaComNome === 'function') {
        window.adicionarColunaComNome(sug.nome, sug.valorPadrao, false);
      }
      FinState.mapeamentoUsuario[catId] = sug.nome;
    });

    const { colunas, amostra } = finObterDadosTabela();
    FinState.colunas = colunas;
    FinState.dadosAmostra = amostra;

    if (typeof salvarDados === 'function') {
      salvarDados(true);
    }
    await salvarClassificacaoFinanceira();

    if (modal) modal.style.display = 'none';
    renderizarCategorias();
    await atualizarStatusCompleto();

    if (typeof mostrarToast === 'function') {
      mostrarToast(`✓ ${faltantes.length} colunas criadas e mapeadas com sucesso na tabela!`, 'success');
    }
  }
  let _timerFinAutoSave = null;
  function debounceSalvarClassificacao() {
    if (_timerFinAutoSave) clearTimeout(_timerFinAutoSave);
    _timerFinAutoSave = setTimeout(() => {
      salvarClassificacaoFinanceira(true); // silencioso
    }, 600);
  }

  /* ================================================================
     ATUALIZAR MAPEAMENTO QUANDO USUÁRIO MUDA UM SELECT
     ================================================================ */
  function finAtualizarMapeamento(cat, coluna) {
    if (coluna && coluna.startsWith('__criar_')) {
      // Usuário selecionou opção de criar coluna
      abrirModalCriarColunaFin(cat);
      const sel = document.querySelector(`select[data-cat="${cat}"]`);
      if (sel) sel.value = FinState.mapeamentoUsuario[cat] || '';
      return;
    }

    if (coluna) {
      FinState.mapeamentoUsuario[cat] = coluna;
    } else {
      delete FinState.mapeamentoUsuario[cat];
    }
    FinState.salvo = false;
    atualizarBadge();
    finAtualizarStatusCard(cat);

    // Auto-salvar no banco em segundo plano
    debounceSalvarClassificacao();
  }

  function finAtualizarManual(cat, valor) {
    const chave = `${cat}_manual`;
    const prevVal = FinState.mapeamentoUsuario[chave];
    const colMapeada = FinState.mapeamentoUsuario[cat];
    const valLimpo = (valor !== null && valor !== undefined) ? String(valor).trim() : '';

    if (valLimpo !== '' && !isNaN(parseFloat(valLimpo))) {
      const numVal = parseFloat(valLimpo);
      FinState.mapeamentoUsuario[chave] = numVal;

      // Se houver uma coluna mapeada para esta categoria na tabela, preencher as células vazias com o valor fixo
      if (colMapeada && typeof estado !== 'undefined' && Array.isArray(estado.todosDados)) {
        let alterou = false;
        estado.todosDados.forEach(linha => {
          if (linha[colMapeada] === undefined || linha[colMapeada] === '' || linha[colMapeada] === null) {
            linha[colMapeada] = numVal;
            alterou = true;
          }
        });
        if (alterou) {
          if (typeof atualizarTabela === 'function') atualizarTabela();
          if (typeof exibirPagina === 'function') exibirPagina();
          if (typeof sincronizarTabelaAtiva === 'function') sincronizarTabelaAtiva();
          if (typeof debounceAutoSalvar === 'function') debounceAutoSalvar();
        }
      }
    } else {
      delete FinState.mapeamentoUsuario[chave];

      // Quando o valor fixo é removido, limpar as células que continham esse valor fixo anterior
      if (colMapeada && typeof estado !== 'undefined' && Array.isArray(estado.todosDados)) {
        let alterou = false;
        estado.todosDados.forEach(linha => {
          const valCel = linha[colMapeada];
          if (prevVal !== undefined && prevVal !== null && (valCel === prevVal || valCel === String(prevVal) || Number(valCel) === Number(prevVal))) {
            linha[colMapeada] = '';
            alterou = true;
          }
        });
        if (alterou) {
          if (typeof atualizarTabela === 'function') atualizarTabela();
          if (typeof exibirPagina === 'function') exibirPagina();
          if (typeof sincronizarTabelaAtiva === 'function') sincronizarTabelaAtiva();
          if (typeof debounceAutoSalvar === 'function') debounceAutoSalvar();
        }
      }
    }

    FinState.salvo = false;
    finAtualizarStatusCard(cat);
    atualizarBadge();
  }

  function finLimparManual(cat) {
    const input = document.querySelector(`input[data-cat-manual="${cat}"]`);
    if (input) input.value = '';
    finAtualizarManual(cat, '');
    renderizarCategorias();
    if (typeof mostrarToast === 'function') mostrarToast(`Valor fixo de ${cat} removido. Clique em "Salvar Classificação" para consolidar.`, 'info');
  }

  function finAtualizarStatusCard(cat) {
    const card = document.querySelector(`[data-cat="${cat}"]`)?.closest('.fin-cat-card');
    if (!card) return;
    const statusEl = card.querySelector('.fin-cat-status');
    if (!statusEl) return;
    const val = FinState.mapeamentoUsuario[cat];
    const valManual = FinState.mapeamentoUsuario[`${cat}_manual`];
    if (val) {
      statusEl.className = 'fin-cat-status mapeado';
      statusEl.textContent = '✅ Mapeado';
    } else if (valManual !== undefined && valManual !== null && valManual !== '') {
      statusEl.className = 'fin-cat-status mapeado';
      statusEl.textContent = '✅ Manual';
    } else {
      statusEl.className = 'fin-cat-status ausente';
      statusEl.textContent = '❌ Não mapeado';
    }
  }

  /* ================================================================
     BADGE DE CAMPOS MAPEADOS
     ================================================================ */
  function atualizarBadge() {
    const total = FIN_CATEGORIAS_LOCAL.length;
    const mapeados = FIN_CATEGORIAS_LOCAL.filter(c =>
      FinState.mapeamentoUsuario[c.id] || FinState.mapeamentoUsuario[`${c.id}_manual`]
    ).length;

    const badge = document.getElementById('finBadgeMapeados');
    const count = document.getElementById('finCountMapeados');
    if (badge) badge.textContent = `${mapeados} / ${total} campos`;
    if (count) count.textContent = mapeados;
  }

  /* ================================================================
     ATUALIZAR STATUS COMPLETO (chama backend)
     ================================================================ */
  async function atualizarStatusCompleto() {
    try {
      const resp = await fetch('/api/mapeamento-financeiro', { method: 'GET' });
      const json = await resp.json();
      if (resp.ok) {
        FinState.completude = json.completude || {};
        FinState.recomendacoes = json.recomendacoes || [];
        renderizarStatusFerramentas();
        renderizarRecomendacoes();
      }
    } catch (err) {
      console.warn('[Fin] Backend indisponível, usando análise local:', err);
      renderizarStatusFerramentas({ local: true });
      renderizarRecomendacoesLocal();
    }
  }

  /* ================================================================
     RENDERIZAR STATUS DAS FERRAMENTAS
     ================================================================ */
  function renderizarStatusFerramentas(opts = {}) {
    const container = document.getElementById('finStatusFerramentasContainer');
    if (!container) return;

    // Se local (sem dados do backend), calcular baseado no mapeamento atual
    const ferramentas = opts.local ? calcularCompletudoLocal() : FinState.completude;

    if (!ferramentas || !Object.keys(ferramentas).length) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--suave);">Mapeie os campos para ver a prontidão das ferramentas.</div>';
      return;
    }

    const cores = { low: '#ef4444', mid: '#f59e0b', high: '#10b981' };

    let html = '';
    Object.entries(ferramentas).forEach(([id, dados]) => {
      const pct = dados.prontidao || 0;
      const cor = pct >= 70 ? cores.high : pct >= 40 ? cores.mid : cores.low;
      const pronto = pct >= 70;
      const faltando = dados.faltando_obrigatorios || [];

      html += `
        <div class="fin-status-card">
          <div class="fin-status-header">
            <div class="fin-status-icon" style="background:${cor}18; color:${cor};">
              <i class="fa-solid ${dados.icone || 'fa-chart-bar'}"></i>
            </div>
            <div class="fin-status-name">${dados.label || id}</div>
            <div class="fin-status-pct" style="color:${cor};">${pct}%</div>
          </div>
          <div class="fin-status-bar">
            <div class="fin-status-fill" style="width:${pct}%; background:${cor};"></div>
          </div>
          ${pronto
            ? `<div class="fin-status-pronto"><i class="fa-solid fa-circle-check"></i> Pronto para usar!</div>`
            : `<div class="fin-status-faltando">
                <span style="font-size:11px; color:var(--suave); display:block; margin-bottom:4px;">Campos obrigatórios ausentes:</span>
                <div style="display:flex; flex-wrap:wrap; gap:5px;">
                  ${faltando.map(f => {
                    const sug = NOMES_SUGERIDOS_COLUNAS[f.categoria] || { nome: f.label || f.categoria };
                    return `<button type="button" class="fin-missing-badge-btn" onclick="abrirModalCriarColunaFin('${f.categoria}')" title="Clique para criar '${sug.nome}' automaticamente na tabela"><i class="fa-solid fa-plus"></i> Criar ${sug.nome}</button>`;
                  }).join('')}
                </div>
              </div>`
          }
        </div>`;
    });

    container.innerHTML = html;
  }

  function calcularCompletudoLocal() {
    const req = {
      planejamento_financeiro: { label: 'Planejamento Financeiro', icone: 'fa-chart-pie',         obrig: ['receita_total', 'aluguel', 'folha_pagamento'] },
      dre:                     { label: 'DRE',                     icone: 'fa-file-invoice',       obrig: ['receita_total', 'impostos', 'custo_variavel', 'aluguel'] },
      fluxo_caixa:             { label: 'Fluxo de Caixa',         icone: 'fa-money-bill-transfer', obrig: ['receita_total', 'despesas', 'periodo'] },
    };
    const res = {};
    Object.entries(req).forEach(([id, cfg]) => {
      const presentes = cfg.obrig.filter(c => FinState.mapeamentoUsuario[c] || FinState.mapeamentoUsuario[`${c}_manual`]);
      const pct = Math.round((presentes.length / cfg.obrig.length) * 100);
      const faltando = cfg.obrig.filter(c => !FinState.mapeamentoUsuario[c] && !FinState.mapeamentoUsuario[`${c}_manual`]);
      res[id] = {
        label: cfg.label,
        icone: cfg.icone,
        prontidao: pct,
        faltando_obrigatorios: faltando.map(c => ({ categoria: c, label: c.replace(/_/g, ' ') })),
      };
    });
    return res;
  }

  /* ================================================================
     RENDERIZAR RECOMENDAÇÕES
     ================================================================ */
  function renderizarRecomendacoes() {
    const container = document.getElementById('finRecomendacoesContainer');
    const countEl = document.getElementById('finCountRecs');
    if (!container) return;

    const recs = FinState.recomendacoes;
    if (countEl) countEl.textContent = recs.length;

    if (!recs.length) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--suave);">
        <i class="fa-solid fa-circle-check" style="font-size:28px; color:#10b981; display:block; margin-bottom:8px;"></i>
        Nenhuma recomendação pendente! Todos os campos necessários estão mapeados.</div>`;
      return;
    }

    const iconePorNivel = { aviso: 'fa-triangle-exclamation', erro: 'fa-circle-xmark', ok: 'fa-circle-check' };
    container.innerHTML = recs.map(r => {
      const sug = NOMES_SUGERIDOS_COLUNAS[r.categoria] || { nome: r.categoria, tipoLabel: '💰 Moeda' };
      const colSugerida = r.coluna_sugerida || sug.nome;
      return `
        <div class="fin-rec-item ${r.nivel}">
          <i class="fa-solid ${iconePorNivel[r.nivel] || 'fa-info-circle'} fin-rec-icon"></i>
          <div class="fin-rec-content">
            <div class="fin-rec-msg">${r.mensagem}</div>
            <div class="fin-rec-acao" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
              <button class="btn-fin-acao btn-fin-acao--criar" onclick="abrirModalCriarColunaFin('${r.categoria}')" title="Cria a coluna na tabela de dados e mapeia automaticamente">
                <i class="fa-solid fa-plus-circle"></i> Criar coluna "${colSugerida}" na tabela
              </button>
              <button class="btn-fin-acao" onclick="finAplicarSugestao('${r.categoria}', ${JSON.stringify(r.valor_padrao || {})})">
                <i class="fa-solid fa-wand-sparkles"></i> ${r.acao}
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderizarRecomendacoesLocal() {
    const recomendacoes = [];
    const m = FinState.mapeamentoUsuario;

    if (!m.receita_total && !m.receita_produtos && !m.receita_servicos)
      recomendacoes.push({ mensagem: 'Nenhuma coluna de receita identificada. Verifique se os dados foram carregados corretamente.', acao: 'Mapear coluna de receita', nivel: 'erro', categoria: 'receita_total', coluna_sugerida: 'Faturamento' });

    if (!m.impostos && !m.taxa_imposto && !m.taxa_imposto_manual)
      recomendacoes.push({ mensagem: 'Nenhum imposto detectado. Usaremos 8% padrão (Simples Nacional) no DRE.', acao: 'Informar taxa manualmente', nivel: 'aviso', categoria: 'taxa_imposto', coluna_sugerida: 'Impostos', valor_padrao: { taxa_imposto_manual: 8 } });

    if (!m.aluguel && !m.aluguel_manual && !m.folha_pagamento && !m.folha_pagamento_manual)
      recomendacoes.push({ mensagem: 'Gastos Fixos não encontrados (Aluguel / Folha). O Planejamento Financeiro ficará incompleto.', acao: 'Adicionar Gastos Fixos', nivel: 'erro', categoria: 'aluguel', coluna_sugerida: 'Aluguel' });

    if (!m.periodo)
      recomendacoes.push({ mensagem: 'Coluna de período/data não detectada. O Fluxo de Caixa precisa de uma dimensão temporal.', acao: 'Informar coluna de data', nivel: 'aviso', categoria: 'periodo', coluna_sugerida: 'Data' });

    if (!m.custo_variavel && !m.fornecedores)
      recomendacoes.push({ mensagem: 'Custos variáveis não detectados. A Margem de Contribuição não poderá ser calculada.', acao: 'Mapear custos variáveis', nivel: 'aviso', categoria: 'custo_variavel', coluna_sugerida: 'Custos Variáveis' });

    FinState.recomendacoes = recomendacoes;
    renderizarRecomendacoes();
  }

  /* ================================================================
     APLICAR SUGESTÃO DE VALOR PADRÃO (ex: taxa 8%)
     ================================================================ */
  function finAplicarSugestao(categoria, valorPadrao) {
    if (valorPadrao && typeof valorPadrao === 'object') {
      Object.entries(valorPadrao).forEach(([k, v]) => {
        FinState.mapeamentoUsuario[k] = v;
      });
    }
    // Redirecionar para tab de mapeamento e focar no campo
    finMudarTab('mapeamento');
    renderizarCategorias();
    if (typeof mostrarToast === 'function') mostrarToast('Valor padrão aplicado! Confirme e salve o mapeamento.', 'info');
  }

  /* ================================================================
     PREVIEW FINANCEIRO
     ================================================================ */
  async function atualizarPreviewFinanceiro() {
    const container = document.getElementById('finPreviewContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Calculando...</div>';
    finMudarTab('preview');

    try {
      const resp = await fetch('/api/mapeamento-financeiro/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapeamento: FinState.mapeamentoUsuario,
          colunas: FinState.colunas,
          dados_amostra: FinState.dadosAmostra,
        }),
      });
      const json = await resp.json();
      if (resp.ok) {
        FinState.preview = json.preview || {};
        renderizarPreview(FinState.preview);
      }
    } catch (err) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--suave);">Não foi possível calcular o preview. Salve o mapeamento e tente novamente.</div>';
    }
  }

  function renderizarPreview(dados) {
    const container = document.getElementById('finPreviewContainer');
    if (!container) return;

    const fmt = v => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const fmtPct = v => (v || 0).toFixed(1) + '%';

    const cards = [
      { label: 'Receita Total',          valor: fmt(dados.receita_total),              classe: 'positivo' },
      { label: 'Impostos',               valor: fmt(dados.impostos),                   classe: 'negativo' },
      { label: 'Taxa Usada',             valor: fmtPct(dados.taxa_imposto_usada),       classe: '' },
      { label: 'Custos Variáveis',       valor: fmt(dados.custo_variavel),              classe: 'negativo' },
      { label: 'Margem Contribuição R$', valor: fmt(dados.margem_contribuicao_rs),      classe: dados.margem_contribuicao_rs >= 0 ? 'positivo' : 'negativo' },
      { label: 'Margem Contribuição %',  valor: fmtPct(dados.margem_contribuicao_pct), classe: dados.margem_contribuicao_pct >= 0 ? 'positivo' : 'negativo' },
      { label: 'Gastos Fixos',           valor: fmt(dados.gastos_fixos),                classe: 'negativo' },
      { label: 'Resultado / Lucro',      valor: fmt(dados.resultado),                   classe: dados.resultado >= 0 ? 'positivo' : 'negativo' },
      { label: 'Investimentos',          valor: fmt(dados.investimentos),               classe: '' },
    ];

    container.innerHTML = cards.map(c => `
      <div class="fin-preview-card">
        <div class="fin-preview-label">${c.label}</div>
        <div class="fin-preview-value ${c.classe}">${c.valor}</div>
      </div>`).join('');
  }

  /* ================================================================
     SALVAR MAPEAMENTO
     ================================================================ */
  async function salvarClassificacaoFinanceira(silencioso = false) {
    const btnRodape = document.getElementById('btnSalvarMapeamentoFin');
    const btnHeader = document.getElementById('btnSalvarFinHeader');
    const statusEl = document.getElementById('finSalvarStatus');

    if (!silencioso) {
      if (btnRodape) { btnRodape.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; btnRodape.disabled = true; }
      if (btnHeader) { btnHeader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnHeader.disabled = true; }
    }

    try {
      // 0. Sincronizar todos os selects de colunas visíveis no DOM com o FinState
      document.querySelectorAll('select.fin-cat-select').forEach(sel => {
        const catId = sel.getAttribute('data-cat');
        const colVal = sel.value;
        if (colVal && !colVal.startsWith('__criar_')) {
          FinState.mapeamentoUsuario[catId] = colVal;
        } else if (!colVal) {
          delete FinState.mapeamentoUsuario[catId];
        }
      });

      // Sincronizar todos os inputs manuais visíveis no DOM com o FinState
      document.querySelectorAll('input[data-cat-manual]').forEach(inp => {
        const catId = inp.getAttribute('data-cat-manual');
        const val = inp.value.trim();
        const chave = `${catId}_manual`;
        if (val !== '' && !isNaN(parseFloat(val))) {
          FinState.mapeamentoUsuario[chave] = parseFloat(val);
        } else {
          delete FinState.mapeamentoUsuario[chave];
        }
      });

      // 1. Salvar os dados da tabela em background (não bloqueia o mapeamento)
      const promiseSalvarDados = (typeof salvarDados === 'function')
        ? salvarDados(true).catch(e => console.warn('[Fin] salvarDados:', e))
        : Promise.resolve();

      // 2. Salvar o mapeamento financeiro no backend
      const resp = await fetch('/api/mapeamento-financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(FinState.mapeamentoUsuario),
      });
      const json = await resp.json();

      if (resp.ok) {
        FinState.salvo = true;
        if (json.mapeamento) FinState.mapeamentoUsuario = json.mapeamento;
        FinState.completude = json.completude || {};
        FinState.recomendacoes = json.recomendacoes || [];
        renderizarCategorias();
        renderizarStatusFerramentas();
        renderizarRecomendacoes();
        atualizarBadge();

        if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="color:#10b981;"></i> <span style="color:#059669;">Mapeamento e tabela salvos com sucesso!</span>';
        if (!silencioso && typeof mostrarToast === 'function') {
          mostrarToast('✓ Classificação financeira e dados salvos com sucesso!', 'success');
        }
      } else {
        throw new Error(json.mensagem || 'Erro ao salvar');
      }
    } catch (err) {
      console.error('[Fin] Erro ao salvar:', err);
      if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> <span style="color:#dc2626;">Erro ao salvar. Tente novamente.</span>';
      if (!silencioso && typeof mostrarToast === 'function') {
        mostrarToast('Erro ao salvar mapeamento.', 'error');
      }
    } finally {
      if (btnRodape) { btnRodape.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar Classificação'; btnRodape.disabled = false; }
      if (btnHeader) { btnHeader.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; btnHeader.disabled = false; }
    }
  }

  /* ================================================================
     CARREGAR MAPEAMENTO SALVO AO ABRIR A PÁGINA
     ================================================================ */
  async function carregarClassificacaoSalva() {
    try {
      const resp = await fetch('/api/mapeamento-financeiro', { method: 'GET' });
      const json = await resp.json();
      if (resp.ok && json.mapeamento && Object.keys(json.mapeamento).length > 0) {
        FinState.mapeamentoUsuario = json.mapeamento;
        FinState.completude = json.completude || {};
        FinState.recomendacoes = json.recomendacoes || [];
        FinState.salvo = true;

        const tentarRenderizar = (tentativa = 1) => {
          const { colunas, amostra } = finObterDadosTabela();
          FinState.colunas = colunas;
          FinState.dadosAmostra = amostra;
          if (colunas.length > 0) {
            renderizarCategorias();
            renderizarStatusFerramentas();
            renderizarRecomendacoes();
            mostrarPainelFinanceiro();
            const statusEl = document.getElementById('finSalvarStatus');
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="color:#10b981;"></i> <span style="color:#059669;">Mapeamento carregado do histórico</span>';
          } else if (tentativa <= 5) {
            setTimeout(() => tentarRenderizar(tentativa + 1), 300);
          }
        };

        tentarRenderizar();
      }
    } catch (err) {
      console.warn('[Fin] Não foi possível carregar mapeamento salvo:', err);
    }
  }

  /* ================================================================
     HOOK: mostrar painel quando dados são carregados/salvos
     Integração com o sistema existente de dados.js
     ================================================================ */
  // Observa quando a tabela recebe dados (após upload ou carregamento)
  const _finObserverAlvo = document.getElementById('dados-tbody');
  if (_finObserverAlvo) {
    const _finObserver = new MutationObserver(() => {
      const temLinhas = _finObserverAlvo.querySelectorAll('tr').length > 0;
      const secao = document.getElementById('secaoClassificacaoFinanceira');
      if (temLinhas) {
        if (secao) secao.style.display = 'block';
        // Atualiza colunas e amostra, mas não ré-analisa automaticamente
        // (usuário clica em "Analisar" quando quiser)
        const { colunas, amostra } = finObterDadosTabela();
        FinState.colunas = colunas;
        FinState.dadosAmostra = amostra;
        // Se já há mapeamento, atualiza os selects
        if (Object.keys(FinState.mapeamentoUsuario).length > 0) {
          renderizarCategorias();
        }
      }
    });
    _finObserver.observe(_finObserverAlvo, { childList: true, subtree: false });
  }

  // Exportar funções necessárias para escopo global
  window.finLimparManual = finLimparManual;
  window.finAtualizarManual = finAtualizarManual;
  window.finAtualizarMapeamento = finAtualizarMapeamento;
  window.salvarClassificacaoFinanceira = salvarClassificacaoFinanceira;
  window.analisarColunasFinanceiras = analisarColunasFinanceiras;
  window.mostrarPainelFinanceiro = mostrarPainelFinanceiro;
  window.atualizarPreviewFinanceiro = atualizarPreviewFinanceiro;