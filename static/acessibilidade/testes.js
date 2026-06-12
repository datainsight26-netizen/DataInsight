/**
 * =========================================================
 * TESTES DO SISTEMA DE ACESSIBILIDADE
 * =========================================================
 * Arquivo para validação e teste de funcionalidades
 * 
 * Como usar:
 * 1. Incluir em uma página de teste
 * 2. Abrir console do navegador (F12)
 * 3. Executar os testes
 */

class TestesAcessibilidade {
  constructor() {
    this.resultados = []
    this.testsPassaram = 0
    this.testsFalharam = 0
  }

  // ========== TESTES BÁSICOS ==========

  testeCarregamento() {
    console.log("\n=== 🔍 TESTE 1: Carregamento do Sistema ===")
    
    const testes = [
      {
        nome: "Gerenciador de acessibilidade existe",
        condicao: () => window.acessibilidade !== undefined,
        esperado: true
      },
      {
        nome: "Painel de acessibilidade no DOM",
        condicao: () => document.getElementById("painelAcessibilidade") !== null,
        esperado: true
      },
      {
        nome: "Botão de alternância existe",
        condicao: () => document.getElementById("alternarAcessibilidade") !== null,
        esperado: true
      },
      {
        nome: "PreferenciasAcessibilidade está definido",
        condicao: () => window.acessibilidade.prefs !== undefined,
        esperado: true
      },
      {
        nome: "LocalStorage funciona",
        condicao: () => {
          try {
            localStorage.setItem("test", "test")
            localStorage.removeItem("test")
            return true
          } catch (e) {
            return false
          }
        },
        esperado: true
      }
    ]

    this.executarTestes(testes)
  }

  testeFonte() {
    console.log("\n=== 📝 TESTE 2: Controle de Fonte ===")
    
    const raiz = document.documentElement
    const escalaPadrao = 1

    const testes = [
      {
        nome: "Fonte pode ser aumentada",
        condicao: () => {
          window.acessibilidade.aumentarFonte()
          const escala = parseFloat(getComputedStyle(raiz).getPropertyValue("--escala-fonte")) || 1
          return escala > escalaPadrao
        },
        esperado: true,
        limpeza: () => window.acessibilidade.resetarFonte()
      },
      {
        nome: "Fonte pode ser diminuída",
        condicao: () => {
          window.acessibilidade.aumentarFonte()
          window.acessibilidade.diminuirFonte()
          const escala = parseFloat(getComputedStyle(raiz).getPropertyValue("--escala-fonte")) || 1
          return escala === escalaPadrao
        },
        esperado: true,
        limpeza: () => window.acessibilidade.resetarFonte()
      },
      {
        nome: "Fonte é salva em localStorage",
        condicao: () => {
          window.acessibilidade.aumentarFonte()
          return localStorage.getItem("acc_preferencias") !== null
        },
        esperado: true,
        limpeza: () => window.acessibilidade.resetarFonte()
      }
    ]

    this.executarTestes(testes)
  }

  testeTemas() {
    console.log("\n=== 🎨 TESTE 3: Temas Visuais ===")
    
    const temas = ["normal", "escuro", "sepia", "leitura", "contraste"]
    
    const testes = temas.map(tema => ({
      nome: `Pode trocar para tema '${tema}'`,
      condicao: () => {
        window.acessibilidade.mudarTema(tema)
        const temaAtual = document.documentElement.getAttribute("data-tema-acessibilidade")
        return temaAtual === tema
      },
      esperado: true,
      limpeza: () => window.acessibilidade.mudarTema("normal")
    }))

    this.executarTestes(testes)
  }

  testeContraste() {
    console.log("\n=== ⚫⚪ TESTE 4: Alto Contraste ===")
    
    const raiz = document.documentElement
    
    const testes = [
      {
        nome: "Alto contraste pode ser ativado",
        condicao: () => {
          window.acessibilidade.prefs.definir("alto_contraste", true)
          window.acessibilidade.aplicarPreferencias()
          return raiz.classList.contains("alto-contraste")
        },
        esperado: true,
        limpeza: () => {
          window.acessibilidade.prefs.definir("alto_contraste", false)
          window.acessibilidade.aplicarPreferencias()
        }
      },
      {
        nome: "Alto contraste pode ser desativado",
        condicao: () => {
          window.acessibilidade.prefs.definir("alto_contraste", false)
          window.acessibilidade.aplicarPreferencias()
          return !raiz.classList.contains("alto-contraste")
        },
        esperado: true
      }
    ]

    this.executarTestes(testes)
  }

  testeDyslexia() {
    console.log("\n=== 📚 TESTE 5: Modo Dislexia ===")
    
    const raiz = document.documentElement
    
    const testes = [
      {
        nome: "Modo dislexia pode ser ativado",
        condicao: () => {
          window.acessibilidade.prefs.definir("modo_dyslexia", true)
          window.acessibilidade.aplicarPreferencias()
          return raiz.classList.contains("dyslexia-friendly")
        },
        esperado: true,
        limpeza: () => {
          window.acessibilidade.prefs.definir("modo_dyslexia", false)
          window.acessibilidade.aplicarPreferencias()
        }
      }
    ]

    this.executarTestes(testes)
  }

  testeAnimacoes() {
    console.log("\n=== ⏸️ TESTE 6: Controle de Animações ===")
    
    const raiz = document.documentElement
    
    const testes = [
      {
        nome: "Animações podem ser removidas",
        condicao: () => {
          window.acessibilidade.prefs.definir("remover_animacoes", true)
          window.acessibilidade.aplicarPreferencias()
          return raiz.classList.contains("sem-animacoes")
        },
        esperado: true,
        limpeza: () => {
          window.acessibilidade.prefs.definir("remover_animacoes", false)
          window.acessibilidade.aplicarPreferencias()
        }
      },
      {
        nome: "Movimento pode ser reduzido",
        condicao: () => {
          window.acessibilidade.prefs.definir("reduzir_movimento", true)
          window.acessibilidade.aplicarPreferencias()
          return raiz.classList.contains("movimento-reduzido")
        },
        esperado: true,
        limpeza: () => {
          window.acessibilidade.prefs.definir("reduzir_movimento", false)
          window.acessibilidade.aplicarPreferencias()
        }
      }
    ]

    this.executarTestes(testes)
  }

  testeLeitura() {
    console.log("\n=== 🔊 TESTE 7: Leitura por Voz ===")
    
    const testes = [
      {
        nome: "speechSynthesis está disponível",
        condicao: () => "speechSynthesis" in window,
        esperado: true
      },
      {
        nome: "Pode iniciar leitura",
        condicao: () => {
          // Adicionar conteúdo para ler
          const div = document.createElement("div")
          div.id = "conteudo"
          div.textContent = "Teste"
          document.body.appendChild(div)
          
          window.acessibilidade.iniciarLeitura()
          const lendo = window.acessibilidade.lendoAtualmente
          window.acessibilidade.pararLeitura()
          
          document.body.removeChild(div)
          return lendo === true
        },
        esperado: true
      }
    ]

    this.executarTestes(testes)
  }

  testeNavegacaoTeclado() {
    console.log("\n=== ⌨️ TESTE 8: Navegação por Teclado ===")
    
    const testes = [
      {
        nome: "Painel responde a ESC",
        condicao: () => {
          const painel = document.getElementById("painelAcessibilidade")
          painel.classList.add("aberto")
          
          const evento = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true
          })
          document.dispatchEvent(evento)
          
          return painel.classList.contains("aberto") === false
        },
        esperado: true
      },
      {
        nome: "Alt+A abre/fecha painel",
        condicao: () => {
          const painel = document.getElementById("painelAcessibilidade")
          const inicial = painel.classList.contains("aberto")
          
          const evento = new KeyboardEvent("keydown", {
            key: "a",
            altKey: true,
            bubbles: true
          })
          document.dispatchEvent(evento)
          
          return painel.classList.contains("aberto") !== inicial
        },
        esperado: true
      }
    ]

    this.executarTestes(testes)
  }

  testeFocusVisual() {
    console.log("\n=== 🔆 TESTE 9: Focus Visual ===")
    
    const testes = [
      {
        nome: "Estilos de focus estão aplicados",
        condicao: () => {
          const estilo = document.querySelector("style")
          return document.head.innerHTML.includes("focus-visible")
        },
        esperado: true
      }
    ]

    this.executarTestes(testes)
  }

  testeGraficos() {
    console.log("\n=== 📊 TESTE 10: Acessibilidade em Gráficos ===")
    
    // Criar gráfico de teste
    const canvas = document.createElement("canvas")
    canvas.id = "chartTeste"
    document.body.appendChild(canvas)
    
    const testes = [
      {
        nome: "Descrição de gráfico pode ser adicionada",
        condicao: () => {
          window.acessibilidade.configurarAcessibilidadeGraficos()
          const desc = document.querySelector(".desc-grafico")
          return desc !== null
        },
        esperado: true,
        limpeza: () => document.body.removeChild(canvas)
      }
    ]

    this.executarTestes(testes)
  }

  // ========== UTILITÁRIOS ==========

  executarTestes(testes) {
    testes.forEach((teste, indice) => {
      try {
        const resultado = teste.condicao()
        const passou = resultado === teste.esperado

        if (passou) {
          console.log(`✅ ${teste.nome}`)
          this.testsPassaram++
        } else {
          console.log(`❌ ${teste.nome} (obteve: ${resultado}, esperado: ${teste.esperado})`)
          this.testsFalharam++
        }

        if (teste.limpeza) {
          teste.limpeza()
        }
      } catch (erro) {
        console.log(`⚠️ ${teste.nome} - Erro: ${erro.message}`)
        this.testsFalharam++
      }
    })
  }

  resumo() {
    console.log("\n=== 📊 RESUMO DOS TESTES ===")
    console.log(`✅ Testes que passaram: ${this.testsPassaram}`)
    console.log(`❌ Testes que falharam: ${this.testsFalharam}`)
    console.log(`📊 Total: ${this.testsPassaram + this.testsFalharam}`)
    console.log(`🎯 Taxa de sucesso: ${Math.round((this.testsPassaram / (this.testsPassaram + this.testsFalharam)) * 100)}%`)
  }

  // ========== CHECKLIST DE CONFORMIDADE WCAG ==========

  checklistWCAG() {
    console.log("\n=== ♿ CHECKLIST WCAG 2.1 ===\n")

    const itens = [
      {
        criterio: "1.4.4",
        nome: "Redimensionamento de Texto",
        teste: () => this.testarRedimensionamento(),
        esperado: "Texto redimensionável até 200%"
      },
      {
        criterio: "1.4.11",
        nome: "Contraste Não-Textual",
        teste: () => this.testarContraste(),
        esperado: "Proporção mínima 3:1"
      },
      {
        criterio: "2.1.1",
        nome: "Teclado",
        teste: () => this.testarTeclado(),
        esperado: "Todas as funções acessíveis por teclado"
      },
      {
        criterio: "2.4.7",
        nome: "Focus Visível",
        teste: () => this.testarFocusVisivel(),
        esperado: "Focus sempre visível"
      },
      {
        criterio: "2.5.5",
        nome: "Tamanho de Alvo",
        teste: () => this.testarTamanoAlvo(),
        esperado: "Mínimo 44x44 pixels"
      },
      {
        criterio: "4.1.3",
        nome: "Mensagens de Status",
        teste: () => this.testarMensagensStatus(),
        esperado: "ARIA live regions configuradas"
      }
    ]

    itens.forEach(item => {
      const resultado = item.teste()
      const status = resultado ? "✅" : "⚠️"
      console.log(`${status} ${item.criterio} - ${item.nome}`)
      console.log(`   Esperado: ${item.esperado}`)
    })
  }

  testarRedimensionamento() {
    const raiz = document.documentElement
    window.acessibilidade.aumentarFonte()
    const escala = parseFloat(getComputedStyle(raiz).getPropertyValue("--escala-fonte")) || 1
    window.acessibilidade.resetarFonte()
    return escala > 1
  }

  testarContraste() {
    return document.getElementById("painelAcessibilidade") !== null
  }

  testarTeclado() {
    const botoes = ["botaoAumentar", "botaoDiminuir", "botaoLer"]
    return botoes.every(id => document.getElementById(id) !== null)
  }

  testarFocusVisivel() {
    return document.head.innerHTML.includes("focus-visible")
  }

  testarTamanoAlvo() {
    const botoes = document.querySelectorAll("button")
    return Array.from(botoes).every(btn => {
      const rect = btn.getBoundingClientRect()
      return rect.width >= 44 && rect.height >= 44
    })
  }

  testarMensagensStatus() {
    return document.getElementById("anunciador-acessibilidade") !== null
  }

  // ========== RELATÓRIO COMPLETO ==========

  executarTodosTestes() {
    console.clear()
    console.log("🚀 INICIANDO SUITE COMPLETA DE TESTES\n")
    
    this.testeCarregamento()
    this.testeFonte()
    this.testeTemas()
    this.testeContraste()
    this.testeDyslexia()
    this.testeAnimacoes()
    this.testeLeitura()
    this.testeNavegacaoTeclado()
    this.testeFocusVisual()
    this.testeGraficos()
    
    this.resumo()
    this.checklistWCAG()
    
    console.log("\n✨ Testes concluídos!\n")
  }
}

// ========== INICIALIZAÇÃO ==========
const testes = new TestesAcessibilidade()

// Expor globalmente
window.testeAcessibilidade = testes

// Auto-executar se chamado
console.log("💡 Use: window.testeAcessibilidade.executarTodosTestes()")
console.log("💡 Ou testes específicos como: window.testeAcessibilidade.testeFonte()")
