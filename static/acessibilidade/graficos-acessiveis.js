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

  // 4. Adicionar descrição acessível
  const descricao = document.createElement("div")
  descricao.className = "desc-grafico"
  descricao.innerHTML = `
    <button class="btn-desc-grafico" aria-expanded="false">
      📊 Descrição e Dados - Vendas Mensais
    </button>
    <div class="conteudo-desc" hidden>
      <p>
        <strong>Descrição:</strong> Este gráfico de linha mostra a 
        evolução das vendas mensais de janeiro a junho. 
        <strong>Tendência:</strong> Crescimento consistente, começando em 
        R$ 5.000 em janeiro e chegando a R$ 11.000 em junho.
      </p>
      <table class="tabela-dados-grafico" role="table" aria-label="Dados de vendas">
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Vendas (R$)</th>
            <th scope="col">Variação</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Janeiro</td><td>5.000</td><td>Base</td></tr>
          <tr><td>Fevereiro</td><td>7.500</td><td>+50%</td></tr>
          <tr><td>Março</td><td>6.200</td><td>-17%</td></tr>
          <tr><td>Abril</td><td>8.900</td><td>+43%</td></tr>
          <tr><td>Maio</td><td>9.200</td><td>+3%</td></tr>
          <tr><td>Junho</td><td>11.000</td><td>+20%</td></tr>
        </tbody>
      </table>
    </div>
  `

  container.appendChild(descricao)

  // 5. Configurar toggle da descrição
  const botao = descricao.querySelector(".btn-desc-grafico")
  const conteudo = descricao.querySelector(".conteudo-desc")

  botao.addEventListener("click", () => {
    const expandido = botao.getAttribute("aria-expanded") === "true"
    botao.setAttribute("aria-expanded", !expandido)
    conteudo.hidden = expandido

    // Anunciar para leitor de tela
    if (window.acessibilidade) {
      const msg = expandido ? "Descrição ocultada" : "Descrição mostrando dados de vendas"
      window.acessibilidade.anunciarAos(msg)
    }
  })

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

  // Descrição com sonorização
  const descricao = document.createElement("div")
  descricao.className = "desc-grafico"
  descricao.innerHTML = `
    <button class="btn-desc-grafico" aria-expanded="false">
      🔊 Descrição Sonorada - Distribuição por Produto
    </button>
    <div class="conteudo-desc" hidden>
      <p>
        <strong>Distribuição de Vendas por Produto:</strong><br>
        O Produto A representa 30% das vendas (maior parcela),
        seguido por Produto B e D com 25% cada um,
        e Produto C com 20% do total.
      </p>
      
      <button class="btn-sonorizar" aria-label="Tocar descrição sonorada">
        🎵 Sonorizar Dados
      </button>
      
      <table class="tabela-dados-grafico" role="table" aria-label="Distribuição de vendas">
        <thead>
          <tr>
            <th scope="col">Produto</th>
            <th scope="col">Percentual</th>
            <th scope="col">Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Produto A</td><td>30%</td><td>R$ 45.000</td></tr>
          <tr><td>Produto B</td><td>25%</td><td>R$ 37.500</td></tr>
          <tr><td>Produto C</td><td>20%</td><td>R$ 30.000</td></tr>
          <tr><td>Produto D</td><td>25%</td><td>R$ 37.500</td></tr>
        </tbody>
      </table>
    </div>
  `

  container.appendChild(descricao)

  // Toggle e sonorização
  const botao = descricao.querySelector(".btn-desc-grafico")
  const btnSonorizar = descricao.querySelector(".btn-sonorizar")
  const conteudo = descricao.querySelector(".conteudo-desc")

  botao.addEventListener("click", () => {
    const expandido = botao.getAttribute("aria-expanded") === "true"
    botao.setAttribute("aria-expanded", !expandido)
    conteudo.hidden = expandido
  })

  btnSonorizar.addEventListener("click", () => {
    if (window.speechSynthesis) {
      const texto = "Produto A, trinta por cento. Produto B, vinte e cinco por cento. " +
                    "Produto C, vinte por cento. Produto D, vinte e cinco por cento."
      
      const utterance = new SpeechSynthesisUtterance(texto)
      utterance.lang = "pt-BR"
      utterance.rate = 1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
  })
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

  // Descrição
  const descricao = document.createElement("div")
  descricao.className = "desc-grafico"
  descricao.innerHTML = `
    <button class="btn-desc-grafico" aria-expanded="false">
      📈 Comparação de Períodos
    </button>
    <div class="conteudo-desc" hidden>
      <p>
        Comparação entre o período anterior (laranja) e o período atual (cinza).
        Nota-se crescimento em Categoria 3 (3 para 10) e Categoria 4 (5 para 9).
      </p>
      <table class="tabela-dados-grafico" role="table" aria-label="Dados comparativos">
        <thead>
          <tr>
            <th scope="col">Categoria</th>
            <th scope="col">Anterior</th>
            <th scope="col">Atual</th>
            <th scope="col">Diferença</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Categoria 1</td><td>12</td><td>8</td><td>-4</td></tr>
          <tr><td>Categoria 2</td><td>19</td><td>15</td><td>-4</td></tr>
          <tr><td>Categoria 3</td><td>3</td><td>10</td><td>+7</td></tr>
          <tr><td>Categoria 4</td><td>5</td><td>9</td><td>+4</td></tr>
        </tbody>
      </table>
    </div>
  `

  container.appendChild(descricao)

  // Toggle
  const botao = descricao.querySelector(".btn-desc-grafico")
  const conteudo = descricao.querySelector(".conteudo-desc")

  botao.addEventListener("click", () => {
    const expandido = botao.getAttribute("aria-expanded") === "true"
    botao.setAttribute("aria-expanded", !expandido)
    conteudo.hidden = expandido
  })
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
  /**
   * Criar um gráfico genérico com suporte a acessibilidade
   * @param {Object} config - Configuração do gráfico
   * @param {string} config.container - ID do container
   * @param {string} config.titulo - Título do gráfico
   * @param {string} config.descricao - Descrição para leitura de tela
   * @param {Array} config.dados - Dados do gráfico
   * @param {Array} config.labels - Labels dos dados
   */
  criar: function(config) {
    const container = document.getElementById(config.container)
    if (!container) return

    // Canvas com ARIA
    const canvas = document.createElement("canvas")
    canvas.id = config.container + "_canvas"
    canvas.setAttribute("role", "img")
    canvas.setAttribute("aria-label", config.descricao)
    container.appendChild(canvas)

    // Descrição
    const desc = document.createElement("div")
    desc.className = "desc-grafico"
    desc.innerHTML = `
      <button class="btn-desc-grafico" aria-expanded="false">
        📊 ${config.titulo} - Dados
      </button>
      <div class="conteudo-desc" hidden>
        <p>${config.descricao}</p>
        <table class="tabela-dados-grafico">
          <thead>
            <tr>
              ${config.labels.map(l => `<th>${l}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${config.tabelaHTML || ""}
          </tbody>
        </table>
      </div>
    `
    container.appendChild(desc)

    // Toggle
    const btn = desc.querySelector(".btn-desc-grafico")
    const cont = desc.querySelector(".conteudo-desc")
    btn.addEventListener("click", () => {
      const exp = btn.getAttribute("aria-expanded") === "true"
      btn.setAttribute("aria-expanded", !exp)
      cont.hidden = exp
    })

    // Configurar acessibilidade
    if (window.acessibilidade) {
      window.acessibilidade.configurarAcessibilidadeGraficos()
    }
  }
}

console.log("✅ Módulo de Gráficos Acessíveis carregado")
console.log("💡 Use: window.GraficosAcessibilidade.criar(config)")
