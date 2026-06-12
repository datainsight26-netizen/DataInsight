/**
 * =========================================================
 * SISTEMA AVANÇADO DE ACESSIBILIDADE - DataInsight
 * =========================================================
 * Sistema completo de acessibilidade para múltiplas
 * deficiências visuais, auditivas, motoras e cognitivas
 * =========================================================
 */

// ============================================================
// GERENCIADOR DE PREFERÊNCIAS (LocalStorage)
// ============================================================
class PreferenciasAcessibilidade {
  constructor() {
    this.prefixo = "acc_"
    this.padroes = {
      escalaFonte: 1,
      tema: "normal",
      alto_contraste: false,
      modo_dyslexia: false,
      remover_animacoes: false,
      reduzir_movimento: false,
      modo_leitura: "normal",
      velocidade_voz: 1,
      volume_voz: 1,
      filtro_daltonismo: "nenhum",
      alto_foco_visual: false,
      modo_fonte_sans: false,
      espacamento_aumentado: false,
      cor_foco: "padrao",
      leitor_ativo: false,
      som_notificacoes: true,
      descricao_graficos: true
    }
    this.carregar()
  }

  carregar() {
    const salvo = localStorage.getItem(this.prefixo + "preferencias")
    this.dados = salvo ? JSON.parse(salvo) : { ...this.padroes }
  }

  salvar() {
    localStorage.setItem(this.prefixo + "preferencias", JSON.stringify(this.dados))
  }

  obter(chave) {
    return this.dados[chave] !== undefined ? this.dados[chave] : this.padroes[chave]
  }

  definir(chave, valor) {
    this.dados[chave] = valor
    this.salvar()
  }

  obterTodos() {
    return { ...this.dados }
  }

  resetar() {
    this.dados = { ...this.padroes }
    this.salvar()
  }
}

// ============================================================
// GERENCIADOR PRINCIPAL DE ACESSIBILIDADE
// ============================================================
class GerenciadorAcessibilidade {
  constructor() {
    this.prefs = new PreferenciasAcessibilidade()
    this.painel = document.getElementById("painelAcessibilidade")
    this.alternar = document.getElementById("alternarAcessibilidade")
    this.raiz = document.documentElement
    this.synth = window.speechSynthesis
    this.utteranceAtual = null
    this.lendoAtualmente = false
    this.indiceElementoLendo = 0
    this.inicializar()
  }

  inicializar() {
    this.aplicarPreferencias()
    this.configurarEventos()
    this.configurarNavegacaoTeclado()
    this.configurarIndicadorFocus()
    this.detectarPreferenciasDoSistema()
    this.configurarAcessibilidadeGraficos()
    console.log("✓ Sistema avançado de acessibilidade ativado")
  }

  // ========== APLICAR PREFERÊNCIAS ==========
  aplicarPreferencias() {
    // Escala de fonte
    this.raiz.style.setProperty("--escala-fonte", this.prefs.obter("escalaFonte"))

    // Tema
    const tema = this.prefs.obter("tema")
    this.raiz.setAttribute("data-tema-acessibilidade", tema)

    // Alto contraste
    if (this.prefs.obter("alto_contraste")) {
      this.raiz.classList.add("alto-contraste")
    } else {
      this.raiz.classList.remove("alto-contraste")
    }

    // Modo dyslexia
    if (this.prefs.obter("modo_dyslexia")) {
      this.raiz.classList.add("dyslexia-friendly")
    } else {
      this.raiz.classList.remove("dyslexia-friendly")
    }

    // Remover animações
    if (this.prefs.obter("remover_animacoes")) {
      this.raiz.classList.add("sem-animacoes")
    } else {
      this.raiz.classList.remove("sem-animacoes")
    }

    // Reduzir movimento
    if (this.prefs.obter("reduzir_movimento")) {
      this.raiz.classList.add("movimento-reduzido")
    } else {
      this.raiz.classList.remove("movimento-reduzido")
    }

    // Filtro de daltonismo
    const filtro = this.prefs.obter("filtro_daltonismo")
    this.aplicarFitroDaltonismo(filtro)

    // Espaçamento aumentado
    if (this.prefs.obter("espacamento_aumentado")) {
      this.raiz.classList.add("espacamento-amplo")
    } else {
      this.raiz.classList.remove("espacamento-amplo")
    }

    // Fonte Sans
    if (this.prefs.obter("modo_fonte_sans")) {
      this.raiz.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    }

    // Alto foco visual
    if (this.prefs.obter("alto_foco_visual")) {
      this.raiz.classList.add("foco-alto")
    } else {
      this.raiz.classList.remove("foco-alto")
    }
  }

  // ========== FILTRO DALTONISMO ==========
  aplicarFitroDaltonismo(tipo) {
    let filtro = ""
    switch (tipo) {
      case "deuteranopia":
        filtro = "url(#deuteranopia)"
        break
      case "protanopia":
        filtro = "url(#protanopia)"
        break
      case "tritanopia":
        filtro = "url(#tritanopia)"
        break
      case "acromatopsia":
        filtro = "url(#acromatopsia)"
        break
    }
    this.raiz.style.filter = filtro
  }

  // ========== CONFIGURAR EVENTOS ==========
  configurarEventos() {
    // Toggle painel
    if (this.alternar) {
      this.alternar.addEventListener("click", () => this.abrirFecharPainel())
    }

    // Botões de fonte
    this.delegarEvento("botaoAumentar", () => this.aumentarFonte())
    this.delegarEvento("botaoDiminuir", () => this.diminuirFonte())
    this.delegarEvento("botaoResetarFonte", () => this.resetarFonte())

    // Tema
    this.delegarEvento("selectorTema", (e) => this.mudarTema(e.target.value))

    // Alto contraste
    this.delegarEvento("toggleAltoContraste", (e) => {
      this.prefs.definir("alto_contraste", e.target.checked)
      this.aplicarPreferencias()
    })

    // Modo dyslexia
    this.delegarEvento("toggleDyslexia", (e) => {
      this.prefs.definir("modo_dyslexia", e.target.checked)
      this.aplicarPreferencias()
    })

    // Remover animações
    this.delegarEvento("toggleSemAnimacoes", (e) => {
      this.prefs.definir("remover_animacoes", e.target.checked)
      this.aplicarPreferencias()
    })

    // Reduzir movimento
    this.delegarEvento("toggleMovimento", (e) => {
      this.prefs.definir("reduzir_movimento", e.target.checked)
      this.aplicarPreferencias()
    })

    // Filtro daltonismo
    this.delegarEvento("selectorDaltonismo", (e) => {
      this.prefs.definir("filtro_daltonismo", e.target.value)
      this.aplicarPreferencias()
    })

    // Espaçamento
    this.delegarEvento("toggleEspacamento", (e) => {
      this.prefs.definir("espacamento_aumentado", e.target.checked)
      this.aplicarPreferencias()
    })

    // Foco visual
    this.delegarEvento("toggleFocoAlto", (e) => {
      this.prefs.definir("alto_foco_visual", e.target.checked)
      this.aplicarPreferencias()
    })

    // Fonte Sans
    this.delegarEvento("toggleFonteSans", (e) => {
      this.prefs.definir("modo_fonte_sans", e.target.checked)
      this.aplicarPreferencias()
    })

    // Leitura por voz
    this.delegarEvento("botaoLer", () => this.iniciarLeitura())
    this.delegarEvento("botaoParar", () => this.pararLeitura())
    this.delegarEvento("selectorVelocidade", (e) => {
      this.prefs.definir("velocidade_voz", parseFloat(e.target.value))
    })

    // Descrição de gráficos
    this.delegarEvento("toggleDescricaoGraficos", (e) => {
      this.prefs.definir("descricao_graficos", e.target.checked)
      this.configurarAcessibilidadeGraficos()
    })

    // Reset
    this.delegarEvento("botaoResetarAcessibilidade", () => this.resetarTudo())

    // Fechar painel com ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.painel && this.painel.classList.contains("aberto")) {
        this.fecharPainel()
      }
    })
  }

  delegarEvento(elementoId, callback) {
    const elemento = document.getElementById(elementoId)
    if (elemento) {
      elemento.addEventListener("change", callback)
      elemento.addEventListener("click", callback)
    }
  }

  // ========== CONTROLE DE PAINEL ==========
  abrirFecharPainel() {
    if (!this.painel) return
    const aberto = this.painel.classList.toggle("aberto")
    if (this.alternar) {
      this.alternar.setAttribute("aria-expanded", String(aberto))
    }
  }

  fecharPainel() {
    if (!this.painel) return
    this.painel.classList.remove("aberto")
    if (this.alternar) {
      this.alternar.setAttribute("aria-expanded", "false")
      this.alternar.focus()
    }
  }

  // ========== CONTROLE DE FONTE ==========
  aumentarFonte() {
    let escala = this.prefs.obter("escalaFonte")
    escala = Math.min(2, +(escala + 0.1).toFixed(2))
    this.prefs.definir("escalaFonte", escala)
    this.raiz.style.setProperty("--escala-fonte", escala)
    this.anunciarAos("Fonte aumentada: " + Math.round(escala * 100) + "%")
  }

  diminuirFonte() {
    let escala = this.prefs.obter("escalaFonte")
    escala = Math.max(0.8, +(escala - 0.1).toFixed(2))
    this.prefs.definir("escalaFonte", escala)
    this.raiz.style.setProperty("--escala-fonte", escala)
    this.anunciarAos("Fonte diminuída: " + Math.round(escala * 100) + "%")
  }

  resetarFonte() {
    this.prefs.definir("escalaFonte", 1)
    this.raiz.style.setProperty("--escala-fonte", 1)
    this.anunciarAos("Fonte restaurada ao tamanho padrão")
  }

  // ========== CONTROLE DE TEMA ==========
  mudarTema(tema) {
    this.prefs.definir("tema", tema)
    this.raiz.setAttribute("data-tema-acessibilidade", tema)
    const nomes = {
      "normal": "Padrão",
      "escuro": "Modo Escuro",
      "sepia": "Modo Sepia",
      "leitura": "Modo Leitura",
      "contraste": "Alto Contraste"
    }
    this.anunciarAos("Tema alterado para: " + (nomes[tema] || tema))
  }

  // ========== NAVEGAÇÃO POR TECLADO ==========
  configurarNavegacaoTeclado() {
    document.addEventListener("keydown", (e) => {
      // Alt + A: Abrir painel de acessibilidade
      if (e.altKey && e.key.toLowerCase() === "a") {
        e.preventDefault()
        this.abrirFecharPainel()
      }

      // Alt + T: Aumentar fonte
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault()
        this.aumentarFonte()
      }

      // Alt + M: Diminuir fonte
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault()
        this.diminuirFonte()
      }

      // Alt + L: Ler página
      if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault()
        this.iniciarLeitura()
      }

      // Alt + S: Parar leitura
      if (e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        this.pararLeitura()
      }

      // Alt + R: Pular para conteúdo principal
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        const main = document.querySelector("main") || document.querySelector("[role='main']")
        if (main) main.focus()
      }
    })
  }

  // ========== INDICADOR DE FOCUS VISUAL ==========
  configurarIndicadorFocus() {
    const style = document.createElement("style")
    style.textContent = `
      *:focus-visible {
        outline: 3px solid #FFD700 !important;
        outline-offset: 2px !important;
      }

      .alto-contraste *:focus-visible {
        outline: 4px solid #FF00FF !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 10px rgba(255, 0, 255, 0.5) !important;
      }

      .foco-alto *:focus-visible {
        outline: 4px solid #00CCFF !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 15px rgba(0, 204, 255, 0.6) !important;
      }

      button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
        outline: 3px solid #FFD700 !important;
        outline-offset: 2px !important;
      }
    `
    document.head.appendChild(style)
  }

  // ========== DETECÇÃO DE PREFERÊNCIAS DO SISTEMA ==========
  detectarPreferenciasDoSistema() {
    // Detectar preferência por modo escuro
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      if (this.prefs.obter("tema") === "normal") {
        this.prefs.definir("tema", "escuro")
        this.raiz.setAttribute("data-tema-acessibilidade", "escuro")
      }
    }

    // Detectar preferência por redução de movimento
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.prefs.definir("remover_animacoes", true)
      this.prefs.definir("reduzir_movimento", true)
      this.aplicarPreferencias()
    }

    // Monitorar mudanças nas preferências do sistema
    window.matchMedia("(prefers-color-scheme: dark)").addListener((mq) => {
      if (mq.matches && this.prefs.obter("tema") === "normal") {
        this.prefs.definir("tema", "escuro")
        this.raiz.setAttribute("data-tema-acessibilidade", "escuro")
      }
    })
  }

  // ========== LEITURA POR VOZ AVANÇADA ==========
  iniciarLeitura() {
    if (!this.synth) {
      this.anunciarAos("Seu navegador não suporta leitura por voz")
      return
    }

    this.synth.cancel()

    const conteudo = document.getElementById("conteudo") || document.querySelector("main") || document.body
    const elementos = this.extrairElementosLeitura(conteudo)

    if (elementos.length === 0) {
      this.anunciarAos("Nenhum conteúdo disponível para leitura")
      return
    }

    this.lendoAtualmente = true
    this.indiceElementoLendo = 0
    this.lerProximoElemento(elementos)
    this.anunciarAos("Iniciando leitura da página")
  }

  extrairElementosLeitura(elemento) {
    const elementos = []
    const tags = ["h1", "h2", "h3", "p", "li", "label", "button", "th", "td"]

    const percorrer = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const texto = node.textContent.trim()
        if (texto) elementos.push(texto)
      } else if (tags.includes(node.tagName.toLowerCase())) {
        const texto = node.innerText?.trim()
        if (texto) elementos.push(texto)
      } else {
        node.childNodes.forEach(percorrer)
      }
    }

    percorrer(elemento)
    return elementos.filter(t => t.length > 0)
  }

  lerProximoElemento(elementos) {
    if (this.indiceElementoLendo >= elementos.length || !this.lendoAtualmente) {
      this.lendoAtualmente = false
      return
    }

    const texto = elementos[this.indiceElementoLendo]
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = "pt-BR"
    utterance.rate = this.prefs.obter("velocidade_voz")
    utterance.volume = this.prefs.obter("volume_voz")

    utterance.onend = () => {
      this.indiceElementoLendo++
      this.lerProximoElemento(elementos)
    }

    utterance.onerror = (e) => {
      console.error("Erro na leitura:", e)
      this.lendoAtualmente = false
    }

    this.synth.speak(utterance)
  }

  pararLeitura() {
    if (this.synth) {
      this.synth.cancel()
      this.lendoAtualmente = false
      this.anunciarAos("Leitura interrompida")
    }
  }

  // ========== ACESSIBILIDADE EM GRÁFICOS ==========
  configurarAcessibilidadeGraficos() {
    const graficos = document.querySelectorAll("canvas, [role='img'][data-chart], .chart-container")

    graficos.forEach((grafico, index) => {
      // Adicionar ARIA labels
      if (!grafico.getAttribute("aria-label")) {
        grafico.setAttribute("aria-label", `Gráfico ${index + 1}`)
      }

      // Adicionar botão de descrição
      if (this.prefs.obter("descricao_graficos")) {
        this.adicionarDescricaoGrafico(grafico)
      }

      // Adicionar tabela de dados alternativa
      this.adicionarTabelaDadosGrafico(grafico)
    })
  }

  adicionarDescricaoGrafico(grafico) {
    if (grafico.nextElementSibling?.classList.contains("desc-grafico")) {
      return // Já possui descrição
    }

    const desc = document.createElement("div")
    desc.className = "desc-grafico"
    desc.setAttribute("aria-label", "Descrição do gráfico")
    desc.innerHTML = `
      <button class="btn-desc-grafico" aria-expanded="false">
        📊 Descrição e Dados do Gráfico
      </button>
      <div class="conteudo-desc" hidden>
        <p>Use a visualização alternativa abaixo para dados detalhados</p>
        <table class="tabela-dados-grafico" role="table">
          <thead><tr><th>Categoria</th><th>Valor</th></tr></thead>
          <tbody><tr><td colspan="2">Dados carregando...</td></tr></tbody>
        </table>
      </div>
    `

    grafico.parentNode.insertBefore(desc, grafico.nextSibling)

    const botao = desc.querySelector(".btn-desc-grafico")
    const conteudo = desc.querySelector(".conteudo-desc")

    botao.addEventListener("click", () => {
      const expandido = botao.getAttribute("aria-expanded") === "true"
      botao.setAttribute("aria-expanded", !expandido)
      conteudo.hidden = expandido
    })
  }

  adicionarTabelaDadosGrafico(grafico) {
    // Extrair dados se disponível (implementar conforme estrutura dos gráficos)
    const tabela = grafico.parentNode.querySelector(".tabela-dados-grafico")
    if (!tabela) return

    // Placeholder - adaptar conforme dados reais do gráfico
    const linhas = tabela.querySelector("tbody")
    if (linhas) {
      linhas.innerHTML = `
        <tr><td>Jan</td><td>2.500</td></tr>
        <tr><td>Fev</td><td>3.200</td></tr>
        <tr><td>Mar</td><td>2.800</td></tr>
      `
    }
  }

  // ========== AVISOS PARA LEITOR DE TELA ==========
  anunciarAos(mensagem) {
    const anunciador = document.getElementById("anunciador-acessibilidade")
    if (anunciador) {
      anunciador.textContent = mensagem
      anunciador.setAttribute("role", "status")
      anunciador.setAttribute("aria-live", "polite")
    }
  }

  // ========== RESET ==========
  resetarTudo() {
    if (confirm("Deseja resetar todas as preferências de acessibilidade?")) {
      this.prefs.resetar()
      this.aplicarPreferencias()
      this.anunciarAos("Preferências restauradas ao padrão")
    }
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================
let gerenciador = null

document.addEventListener("DOMContentLoaded", () => {
  // Injetar anunciador para leitores de tela
  if (!document.getElementById("anunciador-acessibilidade")) {
    const anunciador = document.createElement("div")
    anunciador.id = "anunciador-acessibilidade"
    anunciador.style.position = "absolute"
    anunciador.style.left = "-10000px"
    anunciador.setAttribute("aria-live", "polite")
    anunciador.setAttribute("aria-atomic", "true")
    document.body.appendChild(anunciador)
  }

  // Injetar filtros SVG para daltonismo
  if (!document.getElementById("filtros-acessibilidade")) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.id = "filtros-acessibilidade"
    svg.style.display = "none"
    svg.innerHTML = `
      <defs>
        <filter id="deuteranopia">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"/>
        </filter>
        <filter id="protanopia">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"/>
        </filter>
        <filter id="tritanopia">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"/>
        </filter>
        <filter id="acromatopsia">
          <feColorMatrix type="saturate" values="0"/>
        </filter>
      </defs>
    `
    document.body.appendChild(svg)
  }

  // Inicializar gerenciador
  gerenciador = new GerenciadorAcessibilidade()
})

// Exportar para uso global
window.GerenciadorAcessibilidade = GerenciadorAcessibilidade
window.acessibilidade = gerenciador

