// ==============================================================================
// script.js
// ==============================================================================
// Este código pertence à plataforma @DataInsight.
// Todos os códigos da plataforma devem seguir a mesma estrutura de organização
// em seções numeradas, conforme este arquivo.
// ==============================================================================

// ==============================================================================
// 1. DADOS DE MÉTRICAS (BASE DE EXEMPLO)
// ==============================================================================

const dadosMetricas = {
  meses: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho'],
  faturamento: [180000, 195000, 210000, 225000, 235000, 245680],
  despesas: [125000, 132000, 140000, 148000, 155000, 160250],
  lucro: [55000, 63000, 70000, 77000, 80000, 85430],
  margem: [30.6, 32.3, 33.3, 34.2, 34.0, 34.8]
};

// ==============================================================================
// 2. TEMA E PERSISTÊNCIA
// ==============================================================================

const setTema = () => {
  const temaSalvo = localStorage.getItem("tema")
  if (temaSalvo === "escuro") {
    document.body.classList.add("tema-escuro")
  } else {
    document.body.classList.remove("tema-escuro")
  }
}

const alternarTema = () => {
  const ativo = document.body.classList.toggle("tema-escuro")
  localStorage.setItem("tema", ativo ? "escuro" : "claro")
}

// ==============================================================================
// 3. ACESSIBILIDADE (DELEGAÇÃO PARA MÓDULO CENTRAL)
// ==============================================================================

// Acessibilidade é gerenciada de forma centralizada por static/acessibilidade/acessibilidade.js
function setAcessibilidadeAtiva(active) {
  if (window.Acessibilidade) {
    if (active) window.Acessibilidade.ativar();
    else window.Acessibilidade.desativar();
  }
}

// ==============================================================================
// 4. FORMULÁRIOS — ALTERNÂNCIA DE VISIBILIDADE DE SENHA
// ==============================================================================

// Função para alternar visibilidade da senha
function togglePassword(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const icon = iconEl.querySelector('i');

  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// ==============================================================================
// 5. GRÁFICOS — UTILITÁRIOS E SELEÇÃO DE VISIBILIDADE
// ==============================================================================

function initChart(canvasId, config, containerSelector, caption) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return null
  if (typeof Chart === "undefined") return null

  const chart = new Chart(canvas, config)
  return chart
}

function initChartSelection() {
  const checkboxes = document.querySelectorAll("[data-chart-toggle]")
  if (!checkboxes.length) return

  checkboxes.forEach((checkbox) => {
    const target = checkbox.getAttribute("data-chart-toggle")
    const card = document.querySelector(target)
    if (!card) return

    const sync = () => {
      card.style.display = checkbox.checked ? "block" : "none"
      localStorage.setItem("chartVisible" + target, checkbox.checked ? "true" : "false")
    }

    const saved = localStorage.getItem("chartVisible" + target)
    if (saved !== null) {
      checkbox.checked = saved === "true"
    }

    sync()
    checkbox.addEventListener("change", sync)
  })
}

// ==============================================================================
// 6. INICIALIZAÇÃO DA PÁGINA (APEXCHARTS E CHARTS DE DEMONSTRAÇÃO)
// ==============================================================================

window.addEventListener("load", () => {
  setTema()
  // initChatbot()
  initChartSelection()

  // Função para detectar mode escuro
  function isDarkModeChart() {
    return document.body.classList.contains('tema-escuro');
  }

  // Função para obter cores do tema
  function getThemeColorsChart() {
    const isDark = isDarkModeChart();
    return {
      texto: isDark ? '#f0f0f0' : '#111827',
      suave: isDark ? '#cbd5e1' : '#6b7280',
      primaria: isDark ? '#ff6b6b' : '#3b82f6',
      borda: isDark ? '#334155' : '#e5e7eb'
    };
  }

  // Função genérica para criar gráficos ApexCharts com suporte a dark mode
  function initApexChart(containerSelector, options) {
    if (typeof ApexCharts === 'undefined') return
    const chartContainer = document.querySelector(containerSelector)
    if (!chartContainer || !document.body.contains(chartContainer)) return

    // garante altura padrão
    const colors = getThemeColorsChart();
    options.chart = {
      height: 280,
      foreColor: colors.suave,
      ...options.chart
    }

    // Aplicar cores de tema se não fornecidas
    if (!options.colors) {
      options.colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B']
    }

    // Configurar tooltip com tema apropriado
    if (!options.tooltip) {
      options.tooltip = {}
    }
    options.tooltip.theme = isDarkModeChart() ? 'dark' : 'light'

    const chart = new ApexCharts(chartContainer, options)
    chart.render()

    // força ajuste de tamanho após renderizar
    setTimeout(() => {
      chart.updateOptions({})
      window.dispatchEvent(new Event("resize"))
    }, 200)
  }

  // Gráfico de barras + linha (tendência)
  initApexChart("#grafico-container", {
    chart: { type: "line" },
    series: [
      { name: "Volume", type: "column", data: [8, 10, 14, 12, 16, 15] },
      { name: "Tendência", type: "line", data: [8, 9, 11, 11, 14, 15] }
    ],
    xaxis: { categories: ["Set", "Out", "Nov", "Dez", "Jan", "Fev"] },
    stroke: { width: [0, 4], curve: "smooth" },
    plotOptions: { bar: { columnWidth: "50%" } },
    colors: ["#3B82F6", "#EF4444"],
    legend: { position: "bottom" },
    tooltip: { shared: true, intersect: false }
  })

  // Gráfico Resumo Estatístico
  initApexChart("#graficoResumo-container", {
    chart: { type: "bar" },
    series: [{ name: "Medidas Estatísticas", data: [12.5, 10, 8, 3.2] }],
    xaxis: { categories: ["Média", "Mediana", "Moda", "Desvio Padrão"] },
    colors: ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"],
    dataLabels: { enabled: true }
  })

  // Gráfico de Barras Simples
  initApexChart("#chart-bar-container", {
    chart: { type: "bar" },
    series: [{ name: "Receita", data: [12, 19, 8, 14, 17, 22] }],
    xaxis: { categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"] },
    colors: ["#3B82F6"],
    dataLabels: { enabled: true }
  })

  // Gráfico de Linha
  initApexChart("#chart-line-container", {
    chart: { type: "line" },
    series: [{ name: "Tendência", data: [5, 15, 12, 20, 18, 24] }],
    xaxis: { categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"] },
    stroke: { curve: "smooth" },
    colors: ["#10B981"],
    markers: { size: 5 }
  })

  // Gráfico de Pizza / Donut
  initApexChart("#chart-pie-container", {
    chart: { type: "donut" },
    series: [45, 25, 30],
    labels: ["Produto A", "Produto B", "Produto C"],
    colors: ["#3B82F6", "#F59E0B", "#EF4444"],
    legend: { position: "bottom" }
  })

  // Gráfico Radar
  initApexChart("#chart-radar-container", {
    chart: { type: "radar" },
    series: [{ name: "Avaliação", data: [80, 60, 70, 90, 75] }],
    labels: ["Qualidade", "Velocidade", "Custo", "Satisfação", "Confiabilidade"],
    colors: ["#3B82F6"],
    fill: { opacity: 0.3 },
    stroke: { width: 2 }
  })
})

// ==============================================================================
// 7. INICIALIZAÇÃO GERAL
// ==============================================================================

document.addEventListener('DOMContentLoaded', function () {
  setTema();
  initChartSelection();
  // if (typeof initChatbot === 'function') {
  //   initChatbot();
  // }
});