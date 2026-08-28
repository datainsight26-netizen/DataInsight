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
    '180': 'Últimos 180 dias'
  };
  return periodoMap[periodo] || `Período ${periodo} dias`;
}

// ==========================================
// CONFIGURAÇÕES DOS GRÁFICOS
// ==========================================

function getChartLinhaOptions() {
  const colors = getThemeColors();

  return {
    series: [
      {
        name: 'Entradas',
        data: []
      },
      {
        name: 'Saídas',
        data: []
      }
    ],

    chart: {
      type: 'bar',
      height: 330,
      foreColor: colors.texto,
      toolbar: {
        show: false
      }
    },

    colors: [
      '#22C55E',
      '#EF4444'
    ],

    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '48%',
        borderRadius: 4
      }
    },

    dataLabels: {
      enabled: false
    },

    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },  
      xaxis: {
        categories: [],
        tickAmount: 8,
        labels: {
          show: true,
          rotate: -45,
          hideOverlappingLabels: true,
          trim: true,
          style: {
            fontSize: '11px'
          }
        }
      },

    yaxis: {
      labels: {
        formatter: function (valor) {
          return 'R$ ' + valor.toLocaleString('pt-BR');
        }
      }
    },

    tooltip: {
      shared: true,
      intersect: false,

      y: {
        formatter: function (valor) {
          return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          });
        }
      }
    },

    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },

    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5
    },

    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 300
          },

          plotOptions: {
            bar: {
              columnWidth: '60%'
            }
          }
        }
      }
    ]
  };
}

function getChartBarrasOptions() {
  const colors = getThemeColors();

  return {
    series: [
      {
        name: 'Saldo',
        data: []
      }
    ],

    chart: {
      type: 'line',
      height: 330,
      foreColor: colors.texto,

      toolbar: {
        show: false
      },

      zoom: {
        enabled: false
      }
    },

    colors: [
      '#3B82F6'
    ],

    stroke: {
      curve: 'smooth',
      width: 3
    },

    markers: {
      size: 4,
      strokeWidth: 0,
      hover: {
        size: 6
      }
    },

    dataLabels: {
      enabled: false
    },

      xaxis: {
        categories: [],
        tickAmount: 6,

        labels: {
          show: true,
          rotate: 0,
          hideOverlappingLabels: true,
          trim: true,
          style: {
            fontSize: '11px'
          },

          formatter: function (value) {
            return value;
          }
        },

        axisBorder: {
          show: true
        },

        axisTicks: {
          show: false
        }
      },

    yaxis: {
      labels: {
        formatter: function (valor) {
          return 'R$ ' + valor.toLocaleString('pt-BR');
        }
      }
    },

    tooltip: {
      shared: false,

      y: {
        formatter: function (valor) {
          return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          });
        }
      }
    },

    legend: {
      position: 'bottom',
      horizontalAlign: 'center'
    },

    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5
    },

    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 300
          }
        }
      }
    ]
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

function getChartMaioresGastosOptions() {
  const colors = getThemeColors();

  return {
    series: [
      {
        name: 'Gastos',
        data: []
      }
    ],

    chart: {
      type: 'bar',
      height: 320,
      foreColor: colors.texto,
      toolbar: {
        show: false
      }
    },

    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        barHeight: '55%'
      }
    },

    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        });
      }
    },

    xaxis: {
      categories: [],
      labels: {
        formatter: function (val) {
          return 'R$ ' + Number(val).toLocaleString('pt-BR');
        }
      }
    },

    tooltip: {
      y: {
        formatter: function (val) {
          return val.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          });
        }
      }
    },

    grid: {
      borderColor: colors.borda,
      strokeDashArray: 4
    }
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
    { label: '180d', dias: '180' }
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
    { id: 'graficoAreaGaleria', config: getChartAreaOptions, key: 'area' },
    {id: 'graficoMaioresGastos',config: getChartMaioresGastosOptions,key: 'maioresGastos'}
  ];

  graficos.forEach(({ id, config, key }) => {
    const element = document.getElementById(id);

    if (element) {
      const chart = new ApexCharts(element, config());

      chart.render();

      chartsInstances[key] = chart;
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

function agruparDadosPorPeriodo(labels, series, periodo) {
  const periodoNum = Number(periodo);

  // Para 7 e 30 dias, mantém granularidade diária
  if (periodoNum <= 30) {
    return {
      labels,
      series
    };
  }

  // Para 180 e 365 dias, agrupa por mês
  const meses = {};

  labels.forEach((label, index) => {
    let data;

    // Tenta interpretar yyyy-mm-dd
    if (typeof label === 'string' && label.includes('-')) {
      const partes = label.split('-');

      if (partes.length === 3) {
        data = new Date(
          Number(partes[0]),
          Number(partes[1]) - 1,
          Number(partes[2])
        );
      }
    }

    // Tenta dd/mm ou dd/mm/yyyy
    if (!data && typeof label === 'string' && label.includes('/')) {
      const partes = label.split('/');

      if (partes.length >= 2) {
        const dia = Number(partes[0]);
        const mes = Number(partes[1]) - 1;
        const ano = partes[2]
          ? Number(partes[2])
          : new Date().getFullYear();

        data = new Date(ano, mes, dia);
      }
    }

    if (!data || isNaN(data.getTime())) {
      return;
    }

    const chave = `${data.getFullYear()}-${data.getMonth()}`;

    if (!meses[chave]) {
      meses[chave] = {
        data,
        valores: series.map(() => 0)
      };
    }

    series.forEach((serie, serieIndex) => {
      meses[chave].valores[serieIndex] +=
        Number(serie.data?.[index] || 0);
    });
  });

  const mesesOrdenados = Object.values(meses)
    .sort((a, b) => a.data - b.data);

  const nomesMeses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
  ];

  return {
    labels: mesesOrdenados.map(item =>
      nomesMeses[item.data.getMonth()]
    ),

    series: series.map((serie, serieIndex) => ({
      name: serie.name,
      data: mesesOrdenados.map(item =>
        item.valores[serieIndex]
      )
    }))
  };
}

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
   // ==========================================
   // ENTRADAS X SAÍDAS
   // ==========================================

    if (dados.evolucao?.series && dados.evolucao?.labels) {

      const serieReceita =
        dados.evolucao.series.find(
          serie =>
            serie.name?.toLowerCase().includes('receita')
        );

      const serieDespesa =
        dados.evolucao.series.find(
          serie =>
            serie.name?.toLowerCase().includes('despesa')
        );

      const dadosTratados = agruparDadosPorPeriodo(
        dados.evolucao.labels,
        [
          {
            name: 'Entradas',
            data: serieReceita?.data || []
          },
          {
            name: 'Saídas',
            data: serieDespesa?.data || []
          }
        ],
        periodo
      );
      
      if (dados.categorias?.labels && dados.categorias?.valores) {

  const despesas = dados.categorias.labels.map((categoria, index) => ({
    categoria,
    valor: Number(dados.categorias.valores[index] || 0)
  }));

  despesas.sort((a, b) => b.valor - a.valor);

  const topDespesas = despesas.slice(0, 6);

  await chartsInstances.maioresGastos?.updateOptions({
    xaxis: {
      categories: topDespesas.map(item => item.categoria)
    }
  });

  await chartsInstances.maioresGastos?.updateSeries([
    {
      name: 'Gastos',
      data: topDespesas.map(item => item.valor)
    }
  ]);

  const total = despesas.reduce(
    (soma, item) => soma + item.valor,
    0
  );

  const maior = despesas[0];

    if (maior) {
          document.getElementById('maiorGastoValor').textContent =
            maior.valor.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            });

          document.getElementById('maiorGastoCategoria').textContent =
            maior.categoria;

          document.getElementById('totalGastoPeriodo').textContent =
            total.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            });

        const percentual =
          total > 0
            ? (maior.valor / total) * 100
            : 0;

        document.getElementById('maiorGastoPercentual').textContent =
          percentual.toFixed(1).replace('.', ',') + '%';
      }
    }


      const labelsFormatados =
        Number(periodo) <= 30
          ? dadosTratados.labels.map(d => formatarDataExibicao(d))
          : dadosTratados.labels;

      await chartsInstances.linha?.updateOptions({
        xaxis: {
          categories: labelsFormatados
        }
      });

      await chartsInstances.linha?.updateSeries(
        dadosTratados.series
      );
    }


// ==========================================
// SALDO DO PERÍODO
// =========================================='

    if (dados.evolucao?.labels) {

      let saldo = [];

      if (dados.evolucao?.lucro) {
        saldo = dados.evolucao.lucro;
      } else if (dados.evolucao?.series) {

        const receita =
          dados.evolucao.series.find(
            serie =>
              serie.name?.toLowerCase().includes('receita')
          );

        const despesa =
          dados.evolucao.series.find(
            serie =>
              serie.name?.toLowerCase().includes('despesa')
          );

        saldo = receita?.data?.map(
          (valor, index) =>
            Number(valor || 0) -
            Number(despesa?.data?.[index] || 0)
        ) || [];
      }

      const dadosSaldo = agruparDadosPorPeriodo(
        dados.evolucao.labels,
        [
          {
            name: 'Saldo',
            data: saldo
          }
        ],
        periodo
      );

      const labelsSaldo =
        Number(periodo) <= 30
          ? dadosSaldo.labels.map(d => formatarDataExibicao(d))
          : dadosSaldo.labels;

      await chartsInstances.barras?.updateOptions({
        xaxis: {
          categories: labelsSaldo
        }
      });

      await chartsInstances.barras?.updateSeries(
        dadosSaldo.series
      );
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
