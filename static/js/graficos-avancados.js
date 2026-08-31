// ==========================================
// GRÁFICOS APEXCHARTS - DASHBOARD EMPRESARIAL
// ==========================================

// ==========================================
// UTILITÁRIOS E CONFIGURAÇÕES
// ==========================================

const chartsInstances = {};

function isDarkMode() {
  return document.body.classList.contains('tema-escuro') || localStorage.getItem('tema') === 'escuro';
}

function getThemeColors() {
  const isDark = isDarkMode();
  return {
    isDark: isDark,
    texto: isDark ? '#F9FAFB' : '#0F172A',
    suave: isDark ? '#94A3B8' : '#64748B',
    borda: isDark ? '#334155' : '#E2E8F0',
    fundo: isDark ? '#18181B' : '#FFFFFF',
    fundoModal: isDark ? '#1E293B' : '#FFFFFF',
    fundoBox: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.06)',
    bordaBox: isDark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.18)',
    sombraModal: isDark ? '0 25px 60px rgba(0,0,0,0.65)' : '0 20px 50px rgba(0,0,0,0.15)',
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
// PROJEÇÃO FINANCEIRA PREDITIVA (6 MESES - REGRESSÃO LINEAR)
// ==========================================

let _projecaoAtual = null;
let _modoProjecao = 'cenarios'; // 'cenarios' | 'provavel_detalhado'

function getChartProjecaoOptions() {
  const colors = getThemeColors();
  return {
    series: [
      { name: 'Cenário Otimista', data: [] },
      { name: 'Cenário Provável (Tendência)', data: [] },
      { name: 'Cenário Pessimista', data: [] }
    ],
    chart: {
      type: 'line',
      height: 420,
      foreColor: colors.texto,
      toolbar: {
        show: true,
        tools: { zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
      },
      zoom: { enabled: true, type: 'x', autoScaleYaxis: true }
    },
    title: {
      text: ' Tendência Preditiva de Lucro Líquido (6 Meses)',
      align: 'center',
      style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto }
    },
    subtitle: {
      text: 'Baseado no modelo de Regressão Linear sobre os últimos 3 meses históricos',
      align: 'center',
      style: { fontSize: '12px', color: colors.suave }
    },
    colors: ['#10B981', '#3B82F6', '#EF4444'], // Otimista (Verde), Provável (Azul), Pessimista (Vermelho)
    stroke: {
      curve: 'smooth',
      width: [3, 4, 3],
      dashArray: [4, 0, 4]
    },
    markers: {
      size: [5, 6, 5],
      strokeWidth: 2,
      hover: { size: 8 }
    },
    xaxis: {
      categories: [],
      labels: {
        style: { fontSize: '12px', fontWeight: '600' }
      },
      title: {
     
        style: { fontSize: '11px', color: colors.suave }
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => 'R$ ' + Number(val).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
      }
    },
    annotations: {
      yaxis: [
        {
          y: 0,
          borderColor: colors.isDark ? '#64748B' : '#94A3B8',
          strokeDashArray: 4,
          borderWidth: 2,
          label: {
            borderColor: colors.isDark ? '#64748B' : '#94A3B8',
            style: {
              color: '#FFFFFF',
              background: colors.isDark ? '#334155' : '#64748B',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: { left: 8, right: 8, top: 4, bottom: 4 }
            },
            text: '⚖️ Ponto de Equilíbrio / Break-even (R$ 0)'
          }
        }
      ]
    },
    tooltip: {
      shared: true,
      intersect: false,
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const tipColors = getThemeColors();
        const cats = w.globals.categoryLabels || w.globals.labels || [];
        const mesLabel = cats[dataPointIndex] || `Mês +${dataPointIndex + 1}`;
        let html = `
          <div style="padding: 12px 14px; font-size: 12px; border-radius: 8px; background: ${tipColors.fundo}; color: ${tipColors.texto}; border: 1px solid ${tipColors.borda}; box-shadow: 0 4px 16px rgba(0,0,0,0.3); min-width: 230px;">
            <div style="font-weight: 700; border-bottom: 1px solid ${tipColors.borda}; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span>${mesLabel}</span>
              <span style="font-size: 10px; background: rgba(59,130,246,0.15); color:#3B82F6; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Projeção IA</span>
            </div>
        `;

        w.globals.seriesNames.forEach((name, i) => {
          const val = series[i] ? series[i][dataPointIndex] : undefined;
          if (val !== undefined && val !== null) {
            const cor = w.globals.colors[i];
            const isLucro = val >= 0;
            const badgeLucro = isLucro 
              ? `<span style="color:#10B981; font-weight:700; font-size:10.5px;">[Lucro 🟢]</span>` 
              : `<span style="color:#EF4444; font-weight:700; font-size:10.5px;">[Prejuízo 🔴]</span>`;
            const sinal = val < 0 ? '-' : '';
            const valFmt = `${sinal}R$ ${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            html += `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 5px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:${cor};"></span>
                  <span style="font-size:11.5px; opacity:0.9;">${name}:</span>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <strong>${valFmt}</strong>
                  ${badgeLucro}
                </div>
              </div>
            `;
          }
        });

        html += `</div>`;
        return html;
      }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px'
    },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 360 } } }]
  };
}

function aplicarModoGraficoProjecao(projecao, modo) {
  const chart = chartsInstances.projecao;
  if (!chart || !projecao || !projecao.cenarios) return;

  const labels = projecao.labels_projecao || [];
  const cenarios = projecao.cenarios;

  if (modo === 'provavel_detalhado') {
    const prov = cenarios.provavel?.series || {};
    chart.updateOptions({
      xaxis: { categories: labels },
      colors: ['#3B82F6', '#EF4444', '#10B981'],
      stroke: {
        width: [3, 3, 4],
        dashArray: [0, 0, 0]
      },
      markers: { size: [4, 4, 6] }
    });
    chart.updateSeries([
      { name: 'Receita Estimada', data: prov.receita || [] },
      { name: 'Despesa Estimada', data: prov.despesa || [] },
      { name: 'Lucro Líquido Projetado', data: prov.lucro || [] }
    ]);
  } else {
    // Modo padrão: Comparativo dos 3 Cenários de Lucro Líquido
    chart.updateOptions({
      xaxis: { categories: labels },
      colors: ['#10B981', '#3B82F6', '#EF4444'],
      stroke: {
        width: [3, 4, 3],
        dashArray: [4, 0, 4]
      },
      markers: { size: [5, 6, 5] }
    });
    chart.updateSeries([
      { name: 'Cenário Otimista', data: cenarios.otimista?.series?.lucro || [] },
      { name: 'Cenário Provável (Tendência)', data: cenarios.provavel?.series?.lucro || [] },
      { name: 'Cenário Pessimista', data: cenarios.pessimista?.series?.lucro || [] }
    ]);
  }
}

function atualizarGraficoProjecao(projecao) {
  if (!projecao || !projecao.cenarios) return;
  _projecaoAtual = projecao;

  const { pess = {}, prov = {}, otim = {} } = {
    pess: projecao.cenarios.pessimista || {},
    prov: projecao.cenarios.provavel || {},
    otim: projecao.cenarios.otimista || {}
  };

  const formatarMoeda = (num) => {
    if (num === undefined || num === null) return '--';
    const sinal = num < 0 ? '-' : '';
    return `${sinal}R$ ${Math.abs(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Atualizar Card Pessimista
  const elPessTotal = document.getElementById('projPessimistaTotal');
  const elPessMedia = document.getElementById('projPessimistaMedia');
  const elPessMeses = document.getElementById('projPessimistaMeses');
  const elPessBadge = document.getElementById('projPessimistaBadge');

  if (elPessTotal) elPessTotal.textContent = formatarMoeda(pess.lucro_total);
  if (elPessMedia) elPessMedia.textContent = `${formatarMoeda(pess.media_mensal_lucro)}/mês`;
  if (elPessMeses) elPessMeses.textContent = pess.meses_prejuizo > 0 ? `${pess.meses_prejuizo} de 6 meses` : 'Nenhum (Lucro integral)';
  if (elPessBadge) {
    elPessBadge.textContent = pess.status_badge || 'Pessimista';
    if (pess.lucro_total < 0) {
      elPessBadge.style.background = 'rgba(239, 68, 68, 0.18)';
      elPessBadge.style.color = '#EF4444';
    } else {
      elPessBadge.style.background = 'rgba(245, 158, 11, 0.18)';
      elPessBadge.style.color = '#F59E0B';
    }
  }

  // Atualizar Card Provável
  const elProvTotal = document.getElementById('projProvavelTotal');
  const elProvMedia = document.getElementById('projProvavelMedia');
  const elProvR2 = document.getElementById('projProvavelR2');
  const elProvBadge = document.getElementById('projProvavelBadge');

  if (elProvTotal) elProvTotal.textContent = formatarMoeda(prov.lucro_total);
  if (elProvMedia) elProvMedia.textContent = `${formatarMoeda(prov.media_mensal_lucro)}/mês`;
  const r2 = projecao.regressao?.lucro?.r_quadrado !== undefined ? projecao.regressao.lucro.r_quadrado : 0.95;
  if (elProvR2) elProvR2.textContent = `${(r2 * 100).toFixed(1)}% (Alta confiança)`;
  if (elProvBadge) elProvBadge.textContent = prov.status_badge || 'Tendência Linear';

  // Atualizar Card Otimista
  const elOtimTotal = document.getElementById('projOtimistaTotal');
  const elOtimMedia = document.getElementById('projOtimistaMedia');
  const elOtimStatus = document.getElementById('projOtimistaStatus');
  const elOtimBadge = document.getElementById('projOtimistaBadge');

  if (elOtimTotal) elOtimTotal.textContent = formatarMoeda(otim.lucro_total);
  if (elOtimMedia) elOtimMedia.textContent = `${formatarMoeda(otim.media_mensal_lucro)}/mês`;
  if (elOtimStatus) elOtimStatus.textContent = otim.meses_prejuizo === 0 ? '100% Lucro Projetado' : `${otim.meses_lucrativos} meses positivos`;
  if (elOtimBadge) elOtimBadge.textContent = otim.status_badge || 'Otimista';

  // Atualizar Diagnóstico Textual
  const elDiagnostico = document.getElementById('textoDiagnosticoProjecao');
  const boxDiagnostico = document.getElementById('boxDiagnosticoProjecao');
  if (elDiagnostico && projecao.diagnostico?.texto) {
    elDiagnostico.innerHTML = projecao.diagnostico.texto;
  }
  if (boxDiagnostico) {
    if (projecao.diagnostico?.alerta_prejuizo) {
      boxDiagnostico.style.background = 'rgba(239, 68, 68, 0.08)';
      boxDiagnostico.style.borderLeftColor = '#EF4444';
      const icon = boxDiagnostico.querySelector('i');
      if (icon) icon.style.color = '#EF4444';
    } else {
      boxDiagnostico.style.background = 'rgba(59, 130, 246, 0.08)';
      boxDiagnostico.style.borderLeftColor = '#3B82F6';
      const icon = boxDiagnostico.querySelector('i');
      if (icon) icon.style.color = '#3B82F6';
    }
  }

  // Renderizar a série no gráfico
  aplicarModoGraficoProjecao(projecao, _modoProjecao);
}

function configurarBotoesProjecao() {
  const container = document.getElementById('botoesFiltroProjecao');
  if (!container) return;

  const btns = container.querySelectorAll('.btn-proj-filtro');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => {
        b.style.background = 'var(--fundo-corpo)';
        b.style.color = 'var(--texto)';
        b.classList.remove('active');
      });
      btn.style.background = '#3B82F6';
      btn.style.color = '#FFFFFF';
      btn.classList.add('active');
      _modoProjecao = btn.getAttribute('data-modo') || 'cenarios';
      if (_projecaoAtual) {
        aplicarModoGraficoProjecao(_projecaoAtual, _modoProjecao);
      }
    });
  });
}

// ==========================================
// DRE - DEMONSTRAÇÃO DO RESULTADO (7 LINHAS ESTRUTURADAS)
// ==========================================

let dreMeta = []; // Armazena a lista de linhas DRE atual com metadados para detalhamento no modal
let _categoriasDespesasAtual = { labels: [], valores: [] };
let _kpisAtual = null;
let modalDreDonutChart = null;

function getChartDREOptions() {
  const colors = getThemeColors();

  return {
    series: [{ name: 'DRE', data: [] }],
    chart: {
      type: 'bar',
      height: 460,
      foreColor: colors.texto,
      toolbar: { show: true, tools: { zoom: false, zoomin: false, zoomout: false, pan: false, reset: true } },
      events: {
        dataPointSelection: (event, chartContext, config) => {
          abrirModalDetalhamentoDRE(config.dataPointIndex);
        }
      }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: '56%',
        dataLabels: {
          position: 'top' // No gráfico horizontal, 'top' posiciona no final da barra
        }
      }
    },
    title: { align: 'center', style: { fontSize: '14px', fontWeight: 'bold', color: colors.texto } },
    subtitle: { text: getPeriodoTexto(), align: 'center', style: { fontSize: '12px', color: colors.suave } },
    colors: [],
    dataLabels: {
      enabled: true,
      textAnchor: 'start', // Garante que o texto comece após o fim da barra (fora da barra)
      offsetX: 10,         // Espaçamento limpo após o término da barra
      formatter: (val, opts) => {
        const meta = dreMeta[opts.dataPointIndex];
        if (!meta) return 'R$ ' + val.toLocaleString('pt-BR');
        const sinal = meta.valor < 0 ? '-' : '';
        const perc = (meta.percentual !== undefined && meta.percentual !== null) ? ` (${meta.percentual}%)` : '';
        return `${sinal}R$ ${Math.abs(meta.valor).toLocaleString('pt-BR')}${perc}`;
      },
      style: {
        fontSize: '11.5px',
        fontWeight: '600',
        colors: [colors.texto]
      },
      dropShadow: { enabled: false }
    },
    xaxis: {
      categories: [],
      labels: { formatter: (val) => 'R$ ' + Number(val).toLocaleString('pt-BR'), style: { fontSize: '11px' } }
    },
    tooltip: {
      custom: ({ dataPointIndex }) => {
        const meta = dreMeta[dataPointIndex];
        if (!meta) return '';
        const tipColors = getThemeColors();
        const sinal = meta.valor < 0 ? '-' : '';
        const valorFmt = `${sinal}R$ ${Math.abs(meta.valor).toLocaleString('pt-BR')}`;
        const percFmt = `${Math.abs(meta.percentual || 0).toFixed(1).replace('.', ',')}%`;
        return `<div style="
          padding: 10px 14px; font-size: 12px; border-radius: 8px;
          background: ${tipColors.fundo}; color: ${tipColors.texto};
          border: 1px solid ${tipColors.borda}; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        ">
          <strong style="display:block; margin-bottom:4px;">${meta.label}</strong>
          ${valorFmt} <span style="opacity:.7">(${percFmt} da Receita)</span>
          <div style="opacity:.6; margin-top:6px; font-size:11px;">🔍 Clique para ver o detalhamento completo</div>
        </div>`;
      }
    },
    legend: { show: false },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5,
      padding: { right: 35 }
    },
    responsive: [{ breakpoint: 768, options: { chart: { height: 420 } } }]
  };
}

function montarDREdeKPIs(kpis) {
  if (!kpis) return null;

  const { receita_total = 0, lucro_liquido = 0, despesa_total = 0, margem_lucro = 0 } = kpis;
  const impostosEst = receita_total * 0.08;
  const recLiquidaEst = Math.max(0, receita_total - impostosEst);
  const custoVarEst = despesa_total * 0.45;
  const margemContribEst = recLiquidaEst - custoVarEst;
  const despFixaEst = despesa_total * 0.55;

  const calcPct = (v) => receita_total > 0 ? Math.round((v / receita_total) * 1000) / 10 : 0;

  return [
    {
      id: "faturamento_bruto",
      label: "Faturamento Bruto (Receita)",
      valor: receita_total,
      percentual: 100,
      tipo: "positivo",
      detalhes: { "Receita Total Bruta": receita_total }
    },
    {
      id: "impostos_taxas",
      label: "Impostos e Taxas",
      valor: -Math.abs(impostosEst),
      percentual: calcPct(impostosEst),
      tipo: "deducao",
      detalhes: { "Base de Cálculo": receita_total, "Impostos (Simples/Tributos 8%)": impostosEst }
    },
    {
      id: "receita_liquida",
      label: "Receita Líquida",
      valor: recLiquidaEst,
      percentual: calcPct(recLiquidaEst),
      tipo: "subtotal",
      detalhes: { "Faturamento Bruto": receita_total, "(-) Impostos": -Math.abs(impostosEst), "(=) Receita Líquida": recLiquidaEst }
    },
    {
      id: "custo_variavel",
      label: "Custos Variáveis",
      valor: -Math.abs(custoVarEst),
      percentual: calcPct(custoVarEst),
      tipo: "deducao",
      detalhes: { "Custos Variáveis Operacionais": custoVarEst }
    },
    {
      id: "margem_contribuicao",
      label: "Margem Contribuição / Lucro Bruto",
      valor: margemContribEst,
      percentual: calcPct(margemContribEst),
      tipo: "subtotal",
      detalhes: { "Receita Líquida": recLiquidaEst, "(-) Custos Variáveis": -Math.abs(custoVarEst), "(=) Margem de Contribuição": margemContribEst }
    },
    {
      id: "despesa_fixa",
      label: "Despesas Fixas",
      valor: -Math.abs(despFixaEst),
      percentual: calcPct(despFixaEst),
      tipo: "deducao",
      detalhes: { "Despesas Fixas Operacionais": despFixaEst }
    },
    {
      id: "resultado_lucro",
      label: "Resultado / Lucro Final",
      valor: lucro_liquido,
      percentual: margem_lucro,
      tipo: lucro_liquido >= 0 ? "liquido" : "negativo",
      detalhes: { "Margem de Contribuição": margemContribEst, "(-) Despesas Fixas": -Math.abs(despFixaEst), "(=) Resultado / Lucro Final": lucro_liquido }
    }
  ];
}

function atualizarGraficoDRE(linhas) {
  const chart = chartsInstances.dre;
  if (!chart || !Array.isArray(linhas)) return;

  const mapaCores = {
    positivo: '#3B82F6', // Azul
    deducao: '#EF4444',  // Vermelho
    subtotal: '#0284C7', // Ciano / Azul Escuro
    liquido: '#10B981',  // Verde
    negativo: '#EF4444'  // Vermelho
  };

  dreMeta = linhas.map(l => ({
    id: l.id,
    valor: l.valor,
    percentual: l.percentual,
    label: l.label,
    tipo: l.tipo,
    detalhes: l.detalhes || {}
  }));

  const categorias = linhas.map(l => {
    if (l.tipo === 'deducao') return `(-) ${l.label}`;
    if (l.tipo === 'subtotal' || l.tipo === 'liquido' || l.tipo === 'negativo') return `(=) ${l.label}`;
    return l.label;
  });

  const dadosBarras = linhas.map(l => Math.abs(l.valor));
  const cores = linhas.map(l => mapaCores[l.tipo] || mapaCores.positivo);
  const maxValor = Math.max(...dadosBarras, 1);

  chart.updateOptions({
    xaxis: {
      categories: categorias,
      max: Math.ceil(maxValor * 1.28) // Margem de 28% no eixo X para acomodar o rótulo completo sem corte
    },
    colors: cores
  });
  chart.updateSeries([{ name: 'DRE', data: dadosBarras }]);
}

// ==========================================
// MODAL DE DETALHAMENTO DO DRE
// ==========================================

function criarModalDRE() {
  if (document.getElementById('dreModalOverlay')) return;

  const colors = getThemeColors();

  const overlay = document.createElement('div');
  overlay.id = 'dreModalOverlay';
  overlay.style.cssText = `
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65);
    z-index: 9999; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(4px);
  `;

  overlay.innerHTML = `
    <div id="dreModalCard" style="
      background: ${colors.fundoModal}; color: ${colors.texto}; border: 1px solid ${colors.borda};
      border-radius: 14px; max-width: 720px; width: 100%; padding: 26px;
      position: relative; box-shadow: ${colors.sombraModal};
      transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    ">
      <button id="dreModalClose" aria-label="Fechar" style="
        position: absolute; top: 14px; right: 14px; background: transparent; border: none;
        font-size: 22px; cursor: pointer; color: ${colors.suave}; line-height: 1; padding: 4px;
      ">&times;</button>

      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-right: 24px;">
        <div style="width:38px; height:38px; border-radius:10px; background:rgba(59,130,246,0.15); display:flex; align-items:center; justify-content:center; color:#3B82F6; font-size:19px;">
          <i class="fa-solid fa-chart-pie"></i>
        </div>
        <div>
          <h3 id="dreModalTitulo" style="margin: 0; font-size: 17px; font-weight: 700; color:${colors.texto};"></h3>
          <span id="dreModalSub" style="font-size:12px; color:${colors.suave};">Demonstração do Resultado & Comparativo Proporcional</span>
        </div>
      </div>

      <div id="dreModalConteudo" style="display: flex; gap: 24px; flex-wrap: wrap; align-items: center;">
        <div id="dreModalLista" style="flex: 1 1 260px;"></div>
        <div id="dreModalDonutContainer" style="width: 280px; flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;"></div>
      </div>

      <div id="dreModalNotaBox" style="margin-top: 20px; padding: 12px 14px; border-radius: 8px; background: ${colors.fundoBox}; border: 1px solid ${colors.bordaBox};">
        <p id="dreModalNota" style="margin: 0; font-size: 12.5px; color: ${colors.suave}; line-height: 1.4;"></p>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fecharModalDRE();
  });

  overlay.querySelector('#dreModalClose').addEventListener('click', fecharModalDRE);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModalDRE();
  });
}

function fecharModalDRE() {
  const overlay = document.getElementById('dreModalOverlay');
  if (overlay) overlay.style.display = 'none';

  if (modalDreDonutChart) {
    modalDreDonutChart.destroy();
    modalDreDonutChart = null;
  }
}

function _criarLinhaDetalhamento(label, valor, colors, destaque = false) {
  const linha = document.createElement('div');
  linha.style.cssText = `
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    padding: 9px 0; border-bottom: 1px solid ${colors.borda};
    ${destaque ? 'font-weight: 700; font-size: 14.5px; color: #3B82F6;' : 'font-size: 13px;'}
  `;

  let valorExibicao;
  if (typeof valor === 'number') {
    const sinal = valor < 0 ? '-' : '';
    valorExibicao = `${sinal}${Math.abs(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  } else {
    valorExibicao = String(valor);
  }

  linha.innerHTML = `<span>${label}</span><strong>${valorExibicao}</strong>`;
  return linha;
}

function _montarDadosPizzaComparativa(meta, detalhes) {
  // Paleta de cores corporativa e harmoniosa
  const paleta = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899'];

  // 1. Verificar se há subitens positivos decompostos no detalhes
  const chavesValidas = Object.keys(detalhes).filter(k => 
    !k.startsWith('(-)') && !k.startsWith('(=)') && !k.includes('Total') && !k.includes('Base') && 
    typeof detalhes[k] === 'number' && detalhes[k] > 0
  );

  if (chavesValidas.length > 1) {
    return {
      labels: chavesValidas,
      valores: chavesValidas.map(k => detalhes[k]),
      cores: paleta.slice(0, chavesValidas.length)
    };
  }

  // 2. Se for uma linha agregada ou com 1 subitem, comparar com o restante da estrutura DRE
  const fatBruto = dreMeta.find(l => l.id === 'faturamento_bruto')?.valor || 0;
  const impostos = Math.abs(dreMeta.find(l => l.id === 'impostos_taxas')?.valor || 0);
  const recLiquida = Math.abs(dreMeta.find(l => l.id === 'receita_liquida')?.valor || (fatBruto - impostos));
  const custoVar = Math.abs(dreMeta.find(l => l.id === 'custo_variavel')?.valor || 0);
  const margem = dreMeta.find(l => l.id === 'margem_contribuicao')?.valor || (recLiquida - custoVar);
  const despFixa = Math.abs(dreMeta.find(l => l.id === 'despesa_fixa')?.valor || 0);
  const lucro = dreMeta.find(l => l.id === 'resultado_lucro')?.valor || (margem - despFixa);

  if (meta.id === 'faturamento_bruto' || meta.id === 'impostos_taxas' || meta.id === 'receita_liquida') {
    return {
      labels: ['Receita Líquida', 'Impostos e Taxas'],
      valores: [Math.max(recLiquida, 0), impostos],
      cores: ['#0284C7', '#EF4444']
    };
  }

  if (meta.id === 'custo_variavel') {
    return {
      labels: ['Custos Variáveis', 'Margem de Contribuição'],
      valores: [custoVar, Math.max(margem, 0)],
      cores: ['#F59E0B', '#10B981']
    };
  }

  if (meta.id === 'margem_contribuicao') {
    return {
      labels: ['Margem de Contribuição', 'Custos Variáveis', 'Impostos'],
      valores: [Math.max(margem, 0), custoVar, impostos],
      cores: ['#10B981', '#F59E0B', '#EF4444']
    };
  }

  if (meta.id === 'despesa_fixa') {
    return {
      labels: ['Despesas Fixas', 'Lucro Líquido'],
      valores: [despFixa, Math.max(lucro, 0)],
      cores: ['#8B5CF6', '#10B981']
    };
  }

  // resultado_lucro ou padrão: Decomposição completa da receita
  const lucroPositivo = Math.max(lucro, 0);
  return {
    labels: ['Lucro Líquido', 'Despesas Fixas', 'Custos Variáveis', 'Impostos e Deduções'],
    valores: [lucroPositivo, despFixa, custoVar, impostos],
    cores: ['#10B981', '#8B5CF6', '#F59E0B', '#EF4444']
  };
}

function abrirModalDetalhamentoDRE(index) {
  criarModalDRE();

  const meta = dreMeta[index];
  if (!meta) return;

  const overlay = document.getElementById('dreModalOverlay');
  const titulo = document.getElementById('dreModalTitulo');
  const lista = document.getElementById('dreModalLista');
  const donutContainer = document.getElementById('dreModalDonutContainer');
  const nota = document.getElementById('dreModalNota');
  const colors = getThemeColors();

  const sinal = meta.valor < 0 ? '-' : '';
  const valorFmt = `${sinal}${Math.abs(meta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  const percFmt = (meta.percentual !== undefined) ? ` (${meta.percentual}% da Receita)` : '';
  titulo.textContent = `${meta.label}: ${valorFmt}${percFmt}`;

  lista.innerHTML = '';
  donutContainer.innerHTML = '';
  if (modalDreDonutChart) {
    modalDreDonutChart.destroy();
    modalDreDonutChart = null;
  }

  const detalhes = meta.detalhes || {};
  const chaves = Object.keys(detalhes);

  // Notas conceituais de negócio para cada linha do DRE
  const notasDRE = {
    faturamento_bruto: "Total bruto faturado com a venda de produtos e serviços no período selecionado antes de quaisquer deduções.",
    impostos_taxas: "Impostos incidentes diretamente sobre o faturamento (Simples Nacional, ISS, ICMS, PIS/COFINS).",
    receita_liquida: "Receita Líquida = Faturamento Bruto (−) Impostos e Deduções.",
    custo_variavel: "Custos operacionais diretamente proporcionais ao volume de vendas (CMV, Fornecedores, Insumos, Tráfego Pago/Marketing).",
    margem_contribuicao: "Margem de Contribuição = Receita Líquida (−) Custos Variáveis. Indica quanto o negócio gera para cobrir Despesas Fixas e dar Lucro.",
    despesa_fixa: "Custos fixos de estrutura operacional (Aluguel, Folha de Pagamento, Pró-labore, Água/Luz/Internet/Contabilidade).",
    resultado_lucro: "Resultado Final = Margem de Contribuição (−) Despesas Fixas. Lucro Líquido gerado no período analisado."
  };

  nota.textContent = notasDRE[meta.id] || "Valores apurados com base no mapeamento financeiro da aba Dados.";

  if (chaves.length > 0) {
    chaves.forEach(chave => {
      const val = detalhes[chave];
      const destaque = chave.startsWith('(=)') || chave.includes('Resultado') || chave.includes('Lucro Final');
      lista.appendChild(_criarLinhaDetalhamento(chave, val, colors, destaque));
    });
  } else {
    lista.appendChild(_criarLinhaDetalhamento(meta.label, meta.valor, colors, true));
  }

  // Gerar e renderizar o gráfico de pizza comparativo
  const dadosPizza = _montarDadosPizzaComparativa(meta, detalhes);
  if (dadosPizza && dadosPizza.valores && dadosPizza.valores.some(v => v > 0)) {
    donutContainer.style.display = 'flex';

    modalDreDonutChart = new ApexCharts(donutContainer, {
      series: dadosPizza.valores,
      chart: {
        type: 'donut',
        height: 240,
        foreColor: colors.texto,
        toolbar: { show: false }
      },
      labels: dadosPizza.labels,
      colors: dadosPizza.cores,
      legend: {
        position: 'bottom',
        fontSize: '11px',
        labels: { colors: colors.texto },
        itemMargin: { horizontal: 6, vertical: 2 }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toFixed(1) + '%'
      },
      tooltip: {
        y: {
          formatter: (val) => 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '55%',
            labels: {
              show: false
            }
          }
        }
      }
    });
    modalDreDonutChart.render();
  }

  overlay.style.display = 'flex';
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
    { id: 'graficoProjecaoGaleria', config: getChartProjecaoOptions, key: 'projecao' },
    { id: 'graficoLinhaGaleria', config: getChartLinhaOptions, key: 'linha' },
    { id: 'graficoBarrasGaleria', config: getChartBarrasOptions, key: 'barras' },
    { id: 'graficoPizzaGaleria', config: getChartPizzaOptions, key: 'pizza' },
    { id: 'graficoAreaGaleria', config: getChartAreaOptions, key: 'area' },
    { id: 'graficoDREGaleria', config: getChartDREOptions, key: 'dre' }
  ];

  graficos.forEach(({ id, config, key }) => {
    const element = document.getElementById(id);
    if (element) {
      const chart = new ApexCharts(element, config());
      chart.render();
      chartsInstances[key] = chart;
      if (id !== 'graficoProjecaoGaleria') {
        criarSeletorPeriodoRapido(id, chart);
      }
    }
  });
}

function atualizarSubtitulosGraficos() {
  const periodoTexto = getPeriodoTexto();
  const colors = getThemeColors();

  const chartsCenterAlign = ['linha', 'barras', 'area', 'dre'];
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

    select.innerHTML = '';

    const optTodas = document.createElement('option');
    optTodas.value = 'todas';
    optTodas.textContent = `🌐 Todas as Planilhas (Visão Consolidada - ${_planilhasSumario.length})`;
    select.appendChild(optTodas);

    _planilhasSumario.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
      opt.textContent = `${icone} [${p.dominio_label}] ${p.nome} (${p.total_linhas} linhas)`;
      select.appendChild(opt);
    });

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

    if (dados.kpis) {
      atualizarKPIs(dados);
      _kpisAtual = dados.kpis;
    }

    // Atualização da Projeção Preditiva (6 Meses / 3 Cenários)
    if (dados.projecao) {
      atualizarGraficoProjecao(dados.projecao);
    }

    if (dados.evolucao?.series && dados.evolucao?.labels) {
      const labelsFormatados = dados.evolucao.labels.map(d => formatarDataExibicao(d));
      await chartsInstances.linha?.updateOptions({ xaxis: { categories: labelsFormatados } });
      await chartsInstances.linha?.updateSeries(dados.evolucao.series);
    }

    if (dados.categorias?.labels) {
      _categoriasDespesasAtual = {
        labels: dados.categorias.labels,
        valores: dados.categorias.valores || []
      };
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

    // Atualização com as 7 linhas completas do DRE
    const linhasDRE = (Array.isArray(dados.dre) && dados.dre.length > 0) ? dados.dre : montarDREdeKPIs(dados.kpis);
    if (linhasDRE) {
      atualizarGraficoDRE(linhasDRE);
    }

    atualizarSubtitulosGraficos();
  } catch (erro) {
    console.error("Erro ao carregar dashboard:", erro);
  }
}

// ==========================================
// TEMA E RESPONSIVIDADE
// ==========================================

function sincronizarTemaUI() {
  const colors = getThemeColors();

  // Atualizar todos os gráficos ApexCharts
  Object.values(chartsInstances).forEach(chart => {
    if (chart && chart.updateOptions) {
      chart.updateOptions({
        chart: { foreColor: colors.texto },
        title: { style: { color: colors.texto } },
        subtitle: { style: { color: colors.suave } },
        grid: { borderColor: colors.borda },
        dataLabels: { style: { colors: [colors.texto] } },
        legend: { labels: { colors: colors.texto } },
        xaxis: { labels: { style: { colors: colors.suave } } },
        yaxis: { labels: { style: { colors: colors.texto } } }
      });
    }
  });

  // Atualizar linha de anotação de Break-even no gráfico de projeção
  if (chartsInstances.projecao?.updateOptions) {
    chartsInstances.projecao.updateOptions({
      annotations: {
        yaxis: [
          {
            y: 0,
            borderColor: colors.isDark ? '#64748B' : '#94A3B8',
            strokeDashArray: 4,
            borderWidth: 2,
            label: {
              borderColor: colors.isDark ? '#64748B' : '#94A3B8',
              style: {
                color: '#FFFFFF',
                background: colors.isDark ? '#334155' : '#64748B',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: { left: 8, right: 8, top: 4, bottom: 4 }
              },
              text: '⚖️ Ponto de Equilíbrio / Break-even (R$ 0)'
            }
          }
        ]
      }
    });
  }

  // Atualizar botões de período rápido
  document.querySelectorAll('.rapid-period-selector button').forEach(btn => {
    btn.style.borderColor = colors.borda;
    btn.style.background = colors.fundo;
    btn.style.color = colors.texto;
  });

  // Atualizar modal DRE caso esteja aberto
  const modalOverlay = document.getElementById('dreModalOverlay');
  if (modalOverlay && modalOverlay.style.display !== 'none') {
    const modalCard = document.getElementById('dreModalCard');
    if (modalCard) {
      modalCard.style.background = colors.fundoModal;
      modalCard.style.color = colors.texto;
      modalCard.style.borderColor = colors.borda;
      modalCard.style.boxShadow = colors.sombraModal;
    }
    const modalTitulo = document.getElementById('dreModalTitulo');
    if (modalTitulo) modalTitulo.style.color = colors.texto;

    const modalSub = document.getElementById('dreModalSub');
    if (modalSub) modalSub.style.color = colors.suave;

    const notaBox = document.getElementById('dreModalNotaBox');
    if (notaBox) {
      notaBox.style.background = colors.fundoBox;
      notaBox.style.borderColor = colors.bordaBox;
    }
    const nota = document.getElementById('dreModalNota');
    if (nota) nota.style.color = colors.suave;

    document.querySelectorAll('#dreModalLista > div').forEach(div => {
      div.style.borderColor = colors.borda;
    });

    if (modalDreDonutChart && modalDreDonutChart.updateOptions) {
      modalDreDonutChart.updateOptions({
        chart: { foreColor: colors.texto },
        legend: { labels: { colors: colors.texto } }
      });
    }
  }
}

const originalAlternarTema = window.alternarTema;
window.alternarTema = function () {
  if (originalAlternarTema) originalAlternarTema();
  setTimeout(() => sincronizarTemaUI(), 60);
};

// Observar mudança de classe no body para detectar alternância de tema vinda de qualquer botão
const themeObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      sincronizarTemaUI();
    }
  });
});
themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
  configurarBotoesProjecao();
  await carregarOpcoesPlanilhas();
  await atualizarGraficosComDados();
  sincronizarTemaUI();
});