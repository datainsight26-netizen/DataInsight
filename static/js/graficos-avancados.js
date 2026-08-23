// ==========================================
// GRÁFICOS APEXCHARTS - DASHBOARD EMPRESARIAL
// ==========================================

// ==========================================
// UTILITÁRIOS E CONFIGURAÇÕES
// ==========================================

const chartsInstances = {};

function isDarkMode() {
  return document.body.classList.contains('tema-escuro');
}

function getThemeColors() {
  const isDark = isDarkMode();
  return {
    texto: isDark ? '#F9FAFB' : '#111827',
    suave: isDark ? '#CBD5E1' : '#6B7280',
    borda: isDark ? '#334155' : '#E5E7EB',
    fundo: isDark ? '#1d1d1d' : '#FFFFFF',
    gradientoBorda: isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(229, 231, 235, 0.5)'
  };
}

function formatarDataExibicao(dataStr) {
  try {
    if (dataStr.length <= 5) return dataStr;
    if (dataStr.includes('-')) {
      const partes = dataStr.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}`;
      }
    }
    if (!isNaN(dataStr)) {
      return `Período ${dataStr}`;
    }
    return dataStr;
  } catch {
    return dataStr;
  }
}

function getPeriodoTexto() {
  const periodoSelect = document.getElementById('periodoDash');
  if (!periodoSelect) return 'Período';

  const periodo = periodoSelect.value;
  const periodoMap = {
    '7': 'Últimos 7 dias',
    '15': 'Últimos 15 dias',
    '30': 'Últimos 30 dias',
    '60': 'Últimos 60 dias',
    '90': 'Últimos 90 dias'
  };
  return periodoMap[periodo] || `Período ${periodo} dias`;
}

// ==========================================
// CONFIGURAÇÕES DOS GRÁFICOS
// ==========================================

function getChartLinhaOptions() {
  const colors = getThemeColors();
  return {
    series: [{ name: 'Receita', data: [] }, { name: 'Despesa', data: [] }, { name: 'Lucro', data: [] }],
    chart: {
      type: 'line',
      height: 400,
      foreColor: colors.texto,
      toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    title: { align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'center', style: { fontSize: '12px', color: colors.suave } },
    colors: ['#3B82F6', '#DC2626', '#16A34A'],
    stroke: { curve: 'smooth', width: [2, 2, 4] },
    xaxis: {
      categories: [],
      labels: { formatter: (val) => val, style: { fontSize: '12px' }, rotate: -45, rotateAlways: false }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (val) => 'R$ ' + val.toLocaleString('pt-BR') },
      x: { formatter: (val) => 'Período: ' + val }
    },
    legend: { position: 'bottom', horizontalAlign: 'center' },
    grid: { borderColor: colors.borda, strokeDashArray: 5 },
    responsive: [{ breakpoint: 768, options: { chart: { height: 350 }, legend: { position: 'bottom' } } }]
  };
}

function getChartBarrasOptions() {
  const colors = getThemeColors();
  return {
    series: [{ name: 'Despesas', data: [] }],
    chart: {
      type: 'bar',
      height: 320,
      foreColor: colors.texto,
      toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    title: { align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'center', style: { fontSize: '12px', color: colors.suave } },
    colors: ['#0586c2'],
    xaxis: {
      categories: [],
      labels: { style: { fontSize: '11px' }, rotate: -45, rotateAlways: false }
    },
    tooltip: {
      y: { formatter: (val) => 'R$ ' + val.toLocaleString('pt-BR') },
      x: { formatter: (val) => 'Categoria: ' + val }
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 280 }, xaxis: { labels: { rotate: -90, style: { fontSize: '10px' } } } } }]
  };
}

function getChartAreaOptions() {
  const colors = getThemeColors();
  return {
    series: [{ name: 'Lucro', data: [] }],
    chart: {
      type: 'area',
      height: 350,
      foreColor: colors.texto,
      toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    title: { align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'center', style: { fontSize: '12px', color: colors.suave } },
    colors: ['#16A34A'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: { opacityFrom: 0.4, opacityTo: 0.05 }
    },
    xaxis: {
      categories: [],
      labels: { formatter: (val) => val, style: { fontSize: '12px' }, rotate: -45 }
    },
    tooltip: {
      shared: false,
      y: { formatter: (val) => 'R$ ' + val.toLocaleString('pt-BR') },
      x: { formatter: (val) => 'Data: ' + val }
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 300 } } }]
  };
}

function getChartPizzaOptions() {
  const colors = getThemeColors();
  return {
    series: [0, 0],
    chart: {
      type: 'donut',
      height: 320,
      toolbar: { show: true, tools: { zoom: false, zoomin: false, zoomout: false, pan: false, reset: true } }
    },
    title: { align: 'left', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'left', style: { fontSize: '12px', color: colors.suave } },
    labels: ['Margem de Lucro', 'Custos'],
    colors: ['#16A34A', '#DC2626'],
    tooltip: { y: val => val + '%' },
    legend: { position: 'bottom', horizontalAlign: 'center' },
    dataLabels: { enabled: true, formatter: (val) => val.toFixed(1) + '%' },
    responsive: [{ breakpoint: 768, options: { chart: { height: 280 } } }]
  };
}

function getChartComparativoOptions() {
  const colors = getThemeColors();
  return {
    series: [{ name: 'Crescimento (%)', data: [] }],
    chart: {
      type: 'line',
      height: 350,
      foreColor: colors.texto,
      toolbar: { show: true, tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    title: { text: '📊 Crescimento Percentual', align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'center', style: { fontSize: '12px', color: colors.suave } },
    colors: ['#3B82F6'],
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: [], labels: { rotate: -45 } },
    tooltip: { y: val => val + '%' },
    responsive: [{ breakpoint: 768, options: { chart: { height: 300 } } }]
  };
}

// ==========================================
// ATUALIZAÇÃO DE KPIs
// ==========================================

function atualizarKPIs(dados) {
  if (!dados.kpis) return;

  const { receita_total = 0, lucro_liquido = 0, despesa_total = 0, margem_lucro = 0 } = dados.kpis;

  document.getElementById("kpiReceita").textContent = receita_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kpiLucro").textContent = lucro_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kpiDespesas").textContent = despesa_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  document.getElementById("kpiMargem").textContent = margem_lucro.toFixed(1).replace(".", ",") + "%";
}

// ==========================================
// SELETOR DE PERÍODO RÁPIDO
// ==========================================

function criarSeletorPeriodoRapido(chartId, chartInstance) {
  const container = document.querySelector(`#${chartId}`)?.parentElement;
  if (!container || container.querySelector('.rapid-period-selector')) return;

  const selectorDiv = document.createElement('div');
  selectorDiv.className = 'rapid-period-selector';
  selectorDiv.style.cssText = `display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 10px; padding: 5px; flex-wrap: wrap;`;

  const periodos = [
    { label: '7d', dias: '7' },
    { label: '15d', dias: '15' },
    { label: '30d', dias: '30' },
    { label: '60d', dias: '60' },
    { label: '90d', dias: '90' }
  ];

  periodos.forEach(periodo => {
    const btn = document.createElement('button');
    btn.textContent = periodo.label;
    btn.style.cssText = `
      padding: 4px 12px;
      font-size: 12px;
      border: 1px solid ${getThemeColors().borda};
      background: ${getThemeColors().fundo};
      color: ${getThemeColors().texto};
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    `;

    btn.addEventListener('click', () => {
      const periodoSelect = document.getElementById('periodoDash');
      if (periodoSelect) {
        periodoSelect.value = periodo.dias;
        periodoSelect.dispatchEvent(new Event('change'));

        // Destacar botão ativo
        document.querySelectorAll('.rapid-period-selector button').forEach(b => {
          b.style.background = getThemeColors().fundo;
          b.style.color = getThemeColors().texto;
          b.style.fontWeight = 'normal';
        });
        btn.style.background = '#3B82F6';
        btn.style.color = '#FFFFFF';
        btn.style.fontWeight = 'bold';
        btn.blur();
      }
    });

    selectorDiv.appendChild(btn);
  });

  container.insertBefore(selectorDiv, container.firstChild);
}

// ==========================================
// RENDERIZAÇÃO DOS GRÁFICOS
// ==========================================

function renderizarGraficos() {
  Object.values(chartsInstances).forEach(chart => chart?.destroy());

  const graficos = [
    { id: 'graficoLinhaGaleria', config: getChartLinhaOptions, key: 'linha' },
    { id: 'graficoBarrasGaleria', config: getChartBarrasOptions, key: 'barras' },
    { id: 'graficoPizzaGaleria', config: getChartPizzaOptions, key: 'pizza' },
    { id: 'graficoAreaGaleria', config: getChartAreaOptions, key: 'area' }
  ];

  graficos.forEach(({ id, config, key }) => {
    const element = document.getElementById(id);
    if (element) {
      const chart = new ApexCharts(element, config());
      chart.render();
      chartsInstances[key] = chart;
      criarSeletorPeriodoRapido(id, chart);
    }
  });
}

function atualizarSubtitulosGraficos() {
  const periodoTexto = getPeriodoTexto();
  const colors = getThemeColors();

  const chartsCenterAlign = ['linha', 'barras', 'area'];
  chartsCenterAlign.forEach(chartKey => {
    const chart = chartsInstances[chartKey];
    if (chart?.updateOptions) {
      chart.updateOptions({
        subtitle: { text: periodoTexto, align: 'center', style: { fontSize: '12px', color: colors.suave } }
      });
    }
  });

  if (chartsInstances.pizza?.updateOptions) {
    chartsInstances.pizza.updateOptions({
      subtitle: { text: periodoTexto, align: 'left', style: { fontSize: '12px', color: colors.suave } }
    });
  }
}

// ==========================================
// SELETOR E BADGES DE MULTI-PLANILHAS
// ==========================================

let _planilhasSumario = [];

async function carregarOpcoesPlanilhas() {
  const select = document.getElementById('seletorPlanilhaDash');
  if (!select) return;

  try {
    const resp = await fetch('/api/planilhas/sumario');
    if (!resp.ok) return;

    const data = await resp.json();
    _planilhasSumario = data.planilhas || [];

    // Limpar e reconstruir opções
    select.innerHTML = '';

    // Opção Consolidada
    const optTodas = document.createElement('option');
    optTodas.value = 'todas';
    optTodas.textContent = `🌐 Todas as Planilhas (Visão Consolidada - ${_planilhasSumario.length})`;
    select.appendChild(optTodas);

    // Opções individuais
    _planilhasSumario.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
      opt.textContent = `${icone} [${p.dominio_label}] ${p.nome} (${p.total_linhas} linhas)`;
      select.appendChild(opt);
    });

    // Recuperar preferência salva
    const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
    if (salva && (salva === 'todas' || _planilhasSumario.some(p => p.id === salva))) {
      select.value = salva;
    }
  } catch (e) {
    console.warn('Não foi possível carregar sumário de planilhas:', e);
  }
}

function atualizarBadgesFontes(contexto) {
  const container = document.getElementById('badgeFontesContainer');
  if (!container) return;

  if (!contexto || !contexto.planilhas_envolvidas || contexto.planilhas_envolvidas.length === 0) {
    container.innerHTML = `
      <span class="badge" style="background: rgba(107, 114, 128, 0.15); color: #6b7280; border: 1px solid rgba(107, 114, 128, 0.3); padding: 4px 10px; border-radius: 20px; font-size: 12px;">
        <i class="fa-solid fa-circle-info"></i> Nenhuma fonte vinculada
      </span>
    `;
    return;
  }

  const badgesHtml = contexto.planilhas_envolvidas.map(p => {
    let cor = '#3b82f6';
    let bg = 'rgba(59, 130, 246, 0.12)';
    let border = 'rgba(59, 130, 246, 0.3)';

    if (p.dominio === 'RECEITAS_VENDAS') {
      cor = '#10b981';
      bg = 'rgba(16, 185, 129, 0.12)';
      border = 'rgba(16, 185, 129, 0.3)';
    } else if (p.dominio === 'DESPESAS_ALUGUEL') {
      cor = '#f59e0b';
      bg = 'rgba(245, 158, 11, 0.12)';
      border = 'rgba(245, 158, 11, 0.3)';
    } else if (p.dominio === 'DESPESAS_GERAIS') {
      cor = '#ef4444';
      bg = 'rgba(239, 68, 68, 0.12)';
      border = 'rgba(239, 68, 68, 0.3)';
    } else if (p.dominio === 'ESTOQUE_PRODUTOS') {
      cor = '#8b5cf6';
      bg = 'rgba(139, 92, 246, 0.12)';
      border = 'rgba(139, 92, 246, 0.3)';
    }

    return `
      <span class="badge" title="${p.total_linhas} linhas registradas" style="background: ${bg}; color: ${cor}; border: 1px solid ${border}; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 5px;">
        <i class="fa-solid fa-file-invoice"></i> ${p.nome}
      </span>
    `;
  }).join('');

  container.innerHTML = badgesHtml;
}

// ==========================================
// CARREGAMENTO DE DADOS
// ==========================================

async function atualizarGraficosComDados() {
  try {
    const periodoSelect = document.getElementById('periodoDash');
    const planilhaSelect = document.getElementById('seletorPlanilhaDash');
    if (!periodoSelect) return;

    const periodo = periodoSelect.value || '30';
    const tabelaId = planilhaSelect?.value || 'todas';

    // Salvar preferência
    localStorage.setItem('DataInsight_DashboardPlanilha', tabelaId);

    const resposta = await fetch(`/dashboard/dados?periodo=${periodo}&tabela_id=${tabelaId}`);

    if (!resposta.ok) {
      const erro = resposta.status === 401 ? "Usuário não autenticado" : `HTTP ${resposta.status}`;
      console.error(`Erro ao carregar dados: ${erro}`);
      return;
    }

    const dados = await resposta.json();
    if (dados.erro && !dados.contexto) {
      console.warn(`Aviso: ${dados.erro}`);
      return;
    }

    if (dados.contexto) {
      atualizarBadgesFontes(dados.contexto);
    }

    if (dados.kpis) atualizarKPIs(dados);
    if (dados.evolucao?.series && dados.evolucao?.labels) {
      const labelsFormatados = dados.evolucao.labels.map(d => formatarDataExibicao(d));
      await chartsInstances.linha?.updateOptions({ xaxis: { categories: labelsFormatados } });
      await chartsInstances.linha?.updateSeries(dados.evolucao.series);
    }

    if (dados.categorias?.labels) {
      await chartsInstances.barras?.updateOptions({ xaxis: { categories: dados.categorias.labels } });
      await chartsInstances.barras?.updateSeries([{ name: "Despesas", data: dados.categorias.valores || [] }]);
    }

    if (dados.kpis?.receita_total !== undefined) {
      const { receita_total = 0, lucro_liquido = 0, despesa_total = 0 } = dados.kpis;
      const margemPercent = receita_total > 0 ? (lucro_liquido / receita_total * 100) : 0;
      const custosPercent = receita_total > 0 ? (despesa_total / receita_total * 100) : 0;
      await chartsInstances.pizza?.updateSeries([Math.round(margemPercent * 10) / 10, Math.round(custosPercent * 10) / 10]);
    }

    if (dados.evolucao?.lucro && dados.evolucao?.labels) {
      const labelsFormatados = dados.evolucao.labels.map(d => formatarDataExibicao(d));
      await chartsInstances.area?.updateOptions({ xaxis: { categories: labelsFormatados } });
      await chartsInstances.area?.updateSeries([{ name: "Lucro", data: dados.evolucao.lucro }]);
    }

    atualizarSubtitulosGraficos();
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

// ==========================================
// TEMA E RESPONSIVIDADE
// ==========================================

const originalAlternarTema = window.alternarTema;
window.alternarTema = function () {
  if (originalAlternarTema) originalAlternarTema();

  setTimeout(() => {
    Object.values(chartsInstances).forEach(chart => {
      if (chart) {
        chart.updateOptions({
          chart: { foreColor: getThemeColors().texto },
          title: { style: { color: getThemeColors().texto } },
          subtitle: { style: { color: getThemeColors().suave } },
          grid: { borderColor: getThemeColors().borda }
        });
      }
    });

    document.querySelectorAll('.rapid-period-selector button').forEach(btn => {
      btn.style.borderColor = getThemeColors().borda;
      btn.style.background = getThemeColors().fundo;
      btn.style.color = getThemeColors().texto;
    });
  }, 100);
};

window.redimensionarGraficos = function () {
  Object.values(chartsInstances).forEach(chart => {
    if (chart?.updateOptions) {
      chart.updateOptions({ chart: { height: chart.w.globals.chartHeight } });
    }
  });
};

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => window.redimensionarGraficos(), 250);
});

// ==========================================
// EVENTOS E INICIALIZAÇÃO
// ==========================================

document.getElementById('periodoDash')?.addEventListener('change', () => atualizarGraficosComDados());
document.getElementById('seletorPlanilhaDash')?.addEventListener('change', () => atualizarGraficosComDados());

document.addEventListener("DOMContentLoaded", async () => {
  renderizarGraficos();
  await carregarOpcoesPlanilhas();
  await atualizarGraficosComDados();
});