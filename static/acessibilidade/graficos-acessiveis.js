/**
 * =========================================================
 * EXEMPLOS DE ACESSIBILIDADE PARA GRÁFICOS
 * =========================================================
 * Implementações práticas para integrar o sistema de
 * acessibilidade com gráficos reais da plataforma
 */

// ========== EXEMPLO 1: Gráfico de Vendas com Tabela Alternativa ==========
function criarGraficoVendasAcessivel() {
  const container = document.getElementById("chart-vendas")
  if (!container) return

  // 1. Criar canvas com ARIA
  const canvas = document.createElement("canvas")
  canvas.id = "chartVendas"
  canvas.setAttribute("role", "img")
  canvas.setAttribute("aria-label", "Gráfico de vendas mensais - Linha temporal")
  container.appendChild(canvas)

  // 2. Dados para o gráfico
  const dados = {
    labels: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"],
    datasets: [{
      label: "Vendas (R$)",
      data: [5000, 7500, 6200, 8900, 9200, 11000],
      backgroundColor: "rgba(52, 152, 219, 0.1)",
      borderColor: "rgb(52, 152, 219)",
      borderWidth: 2,
      tension: 0.1
    }]
  }

  // 3. Criar gráfico (usando Chart.js)
  if (typeof Chart !== "undefined") {
    const ctx = canvas.getContext("2d")
    new Chart(ctx, {
      type: "line",
      data: dados,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top"
          },
          title: {
            display: true,
            text: "Vendas Mensais"
          }
        }
      }
    })
  }

  // 6. Chamar acessibilidade
  if (window.acessibilidade) {
    setTimeout(() => {
      window.acessibilidade.configurarAcessibilidadeGraficos()
    }, 100)
  }
}

// ========== EXEMPLO 2: Gráfico de Pizza com Sonorização ==========
function criarGraficoPizzaAcessivel() {
  const container = document.getElementById("chart-pizza")
  if (!container) return

  // Dados
  const dados = {
    labels: ["Produto A", "Produto B", "Produto C", "Produto D"],
    datasets: [{
      data: [30, 25, 20, 25],
      backgroundColor: [
        "rgba(52, 152, 219, 0.8)",
        "rgba(39, 174, 96, 0.8)",
        "rgba(243, 156, 18, 0.8)",
        "rgba(231, 76, 60, 0.8)"
      ]
    }]
  }

  // Canvas
  const canvas = document.createElement("canvas")
  canvas.id = "chartPizza"
  canvas.setAttribute("role", "img")
  canvas.setAttribute("aria-label", "Distribuição de vendas por produto")
  container.appendChild(canvas)

  // Criar gráfico
  if (typeof Chart !== "undefined") {
    const ctx = canvas.getContext("2d")
    new Chart(ctx, {
      type: "doughnut",
      data: dados,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom"
          }
        }
      }
    })
  }

}

// ========== EXEMPLO 3: Gráfico de Comparação com Cores Adaptáveis ==========
function criarGraficoComparativoAcessivel() {
  const container = document.getElementById("chart-comparativo")
  if (!container) return

  // Usar cores que funcionam para daltônicos
  const cores = {
    normal: {
      A: "rgba(52, 152, 219, 0.8)",
      B: "rgba(39, 174, 96, 0.8)"
    },
    daltonismo: {
      A: "rgba(230, 126, 34, 0.8)",    // Laranja
      B: "rgba(52, 73, 94, 0.8)"       // Cinza escuro
    }
  }

  // Detectar preferência
  const tipo = window.acessibilidade?.prefs?.obter("filtro_daltonismo") || "nenhum"
  const paleta = tipo !== "nenhum" ? cores.daltonismo : cores.normal

  // Dados
  const dados = {
    labels: ["Categoria 1", "Categoria 2", "Categoria 3", "Categoria 4"],
    datasets: [
      {
        label: "Período Anterior",
        data: [12, 19, 3, 5],
        backgroundColor: paleta.A
      },
      {
        label: "Período Atual",
        data: [8, 15, 10, 9],
        backgroundColor: paleta.B
      }
    ]
  }

  // Canvas
  const canvas = document.createElement("canvas")
  canvas.id = "chartComparativo"
  canvas.setAttribute("role", "img")
  canvas.setAttribute("aria-label", "Gráfico comparativo de períodos")
  container.appendChild(canvas)

  // Criar gráfico
  if (typeof Chart !== "undefined") {
    const ctx = canvas.getContext("2d")
    new Chart(ctx, {
      type: "bar",
      data: dados,
      options: {
        responsive: true,
        indexAxis: "y"
      }
    })
  }
}

// ========== EXEMPLO 4: Análise Textual Completa ==========
function adicionarAnaliseTextualAcessivel(dadosGrafico) {
  const analise = document.createElement("div")
  analise.className = "analise-textual"
  analise.role = "region"
  analise.setAttribute("aria-label", "Análise textual dos dados")
  analise.innerHTML = `
    <h3>📖 Análise Detalhada</h3>
    <div class="analise-conteudo">
      <p>
        <strong>Resumo Executivo:</strong> ${dadosGrafico.resumo || "Dados apresentam tendência de crescimento"}
      </p>
      <p>
        <strong>Pontos Principais:</strong>
        <ul>
          ${dadosGrafico.pontos ? dadosGrafico.pontos.map(p => `<li>${p}</li>`).join("") : ""}
        </ul>
      </p>
      <p>
        <strong>Recomendações:</strong>
        <ul>
          ${dadosGrafico.recomendacoes ? dadosGrafico.recomendacoes.map(r => `<li>${r}</li>`).join("") : ""}
        </ul>
      </p>
    </div>
  `
  return analise
}

// ========== INICIALIZAÇÃO ==========
document.addEventListener("DOMContentLoaded", () => {
  // Aguardar acessibilidade estar pronta
  if (window.acessibilidade) {
    // Criar gráficos
    criarGraficoVendasAcessivel()
    criarGraficoPizzaAcessivel()
    criarGraficoComparativoAcessivel()

    // Configurar acessibilidade
    setTimeout(() => {
      window.acessibilidade.configurarAcessibilidadeGraficos()
    }, 500)
  }
})

// ========== API PÚBLICA PARA USAR EM OUTRAS PÁGINAS ==========
window.GraficosAcessibilidade = {
  criar: function(config) {
    const container = document.getElementById(config.container)
    if (!container) return

    // Canvas com ARIA
    const canvas = document.createElement("canvas")
    canvas.id = config.container + "_canvas"
    canvas.setAttribute("role", "img")
    canvas.setAttribute("aria-label", config.descricao)
    container.appendChild(canvas)

    // Configurar acessibilidade
    if (window.acessibilidade) {
      window.acessibilidade.configurarAcessibilidadeGraficos()
    }
  }
}

console.log("✅ Módulo de Gráficos Acessíveis carregado")
