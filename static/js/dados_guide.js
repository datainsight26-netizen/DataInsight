/**
 * dados_guide.js
 * Guided tour da página Dados — DataInsight
 *
 * Percorre uma sequência de passos destacando elementos da interface,
 * com tooltip explicativo, navegação por teclado e opção de não mostrar
 * novamente (persistida em localStorage).
 *
 * ------------------------------------------------------------------------------
 * PROPRIEDADE INTELECTUAL
 * ------------------------------------------------------------------------------
 * Este código pertence à plataforma @DataInsight. Todos os arquivos da plataforma
 * devem seguir esta mesma estrutura de organização: seções numeradas
 * sequencialmente com cabeçalhos padronizados, separação clara de
 * responsabilidades e agrupamento lógico de funções afins.
 * ------------------------------------------------------------------------------
 */

(function () {

  // ==============================================================================
  // 1. CONFIGURAÇÃO — PASSOS DO TOUR
  // ==============================================================================
  const STEPS = [
    { el: '.header-badge', title: 'Identificação da Página', text: 'O badge no topo mostra contexto e status rápido da página de dados.' },
    { el: '.data-quality-banner', title: 'Diagnóstico de Qualidade', text: 'Aqui aparecem avisos e status de qualidade dos dados carregados.' },
    { el: '.ribbon-toolbar', title: 'Barra de Ferramentas', text: 'Acesso rápido a edição, governança, filtros e exportações.' },
    { el: '#inputBuscaTabela', title: 'Pesquisar na Planilha', text: 'Busque e realce termos rapidamente em todas as colunas.' },
    { el: '#excel-table-wrapper', title: 'Área da Tabela', text: 'A área principal onde você visualiza e edita os registros.' },
    { el: function () { return findHeaderByText('Faturamento'); }, title: 'Coluna Faturamento', text: 'Insira valores numéricos nesta coluna. Use ponto para decimais.' },
    { el: function () { return findHeaderByText('Despesas'); },    title: 'Coluna Despesas',    text: 'Registre despesas correspondentes; use formato numérico consistente.' },
    { el: function () { return findHeaderByText('Lucro'); },       title: 'Coluna Lucro',       text: 'Campo calculado automaticamente (Faturamento − Despesas).' },
    { el: '#colunas-container', title: 'Gerenciar Colunas', text: 'Crie, renomeie e defina tipos de colunas para melhor governança.' },
    { el: '.upload-zone-wrapper', title: 'Upload / Importar', text: 'Arraste arquivos Excel/CSV aqui; valide mapeamentos após importar.' },
    { el: '#btnFiltroAvancado', title: 'Filtros Avançados', text: 'Abra ferramentas para aplicar filtros complexos nas colunas.' },
    { el: '#btnAdicionarLinha', title: 'Adicionar Linha', text: 'Adicione novas linhas para inserir registros manualmente.' },
    { el: '#btnSalvarDados', title: 'Salvar Alterações', text: 'Salve mudanças no banco; verifique mensagens de sucesso/erro.' },
    { el: '#selectLinhasPorPagina', title: 'Linhas por Página', text: 'Controle quantas linhas são exibidas por página.' },
    { el: '.fin-panel', title: 'Painel Financeiro — Introdução', text: '<strong>Objetivo:</strong> exibir métricas, sugestões e classificações automáticas para análise financeira. <br><br><strong>Use para:</strong> revisar anomalias, confirmar mapeamentos e gerar relatórios.' },
    {
      el: '#finCategoriasContainer',
      title: 'Como selecionar campos para Classificação Financeira',
      openPanel: true,
      switchTab: 'mapeamento',
      waitForSelector: '#finCategoriasContainer',
      text: "<p><strong>Passo a passo claro:</strong></p><ol style=\"margin:6px 0 0 18px\"><li>Abrimos o Painel Financeiro automaticamente para você.</li><li>Vá até a aba <strong>Mapeamento</strong>.</li><li>Dentro da lista de categorias, para cada item selecione a coluna correspondente da sua tabela (ex.: Faturamento → coluna <em>Faturamento</em>).</li><li>Se a coluna não existir, clique em <em>Gerenciar Colunas</em> e crie/renomeie a coluna antes de mapear.</li></ol><p style=\"margin-top:8px\"><strong>Observação:</strong> os campos monetários devem conter apenas números (ex.: 1234.56). Evite símbolos como R$ ou uso de vírgula como separador decimal.</p>"
    },
    {
      el: '#finCategoriasContainer',
      title: 'Explicação detalhada por categoria',
      openPanel: true,
      switchTab: 'mapeamento',
      waitForSelector: '#finCategoriasContainer',
      text: '<p>Agora vamos explicar o que inserir em cada categoria. Cada cartão/categoria tem um rótulo e uma descrição:</p><ul style="margin:6px 0 0 18px"><li><strong>Faturamento / Receita Total:</strong> selecione a coluna com valores brutos de vendas (ex: Faturamento, Total Vendas).</li><li><strong>Despesas:</strong> selecione a coluna que sumariza os gastos ou defina um valor fixo.</li><li><strong>Data / Período:</strong> selecione a coluna com datas (formato recomendado YYYY-MM-DD).</li></ul><p style="margin-top:8px">Se quiser, posso automaticamente destacar cada cartão e mostrar exatamente onde clicar — deseja que eu faça isto agora?</p>'
    },
    {
      el: '#finTab-mapeamento',
      title: 'Ferramentas de Mapeamento',
      openPanel: true,
      switchTab: 'mapeamento',
      waitForSelector: '#finTab-mapeamento',
      text: '<p>Use as abas e os controles para alternar entre Mapeamento, Recomendações e Prontidão das Ferramentas. Clique em <strong>Recomendações</strong> se quiser ver problemas detectados automaticamente.</p>'
    },
    { el: '.fin-panel', title: 'Validação e Boas Práticas de Cadastro', text: '<ul style="margin:6px 0 0 18px"><li><strong>Formato numérico:</strong> use 1234.56 (ponto decimal); sem símbolos como R$ ou vírgulas.</li><li><strong>Moeda consistente:</strong> todas as colunas financeiras na mesma moeda.</li><li><strong>Datas:</strong> use YYYY-MM-DD; evite formatos locais ambíguos.</li><li><strong>Campos categóricos:</strong> padronize nomes (ex.: "salario" vs "salários").</li></ul><br>Realize uma rápida validação usando <em>Validação</em> antes de salvar.' },
    { el: '.fin-panel', title: 'Exemplo passo-a-passo', text: '<ol style="margin:6px 0 0 18px"><li>Importe o arquivo Excel.</li><li>Ajuste nomes de colunas no estúdio (ex.: Faturamento, Despesas).</li><li>Abra o Painel Financeiro e selecione: Faturamento → coluna "Faturamento"; Despesa → coluna "Despesas".</li><li>Execute a validação e confirme as recomendações.</li><li>Salve as alterações e gere o relatório.</li></ol>' },
    {
      el: null,
      title: 'Resumo & Próximos Passos',
      final: true,
      text: '<strong>Resumo:</strong> ao final deste guia você deve ser capaz de importar dados, padronizar colunas, mapear campos no Painel Financeiro e salvar com confiança.<br><br><strong>Checklist final:</strong><ul style="margin:6px 0 0 18px"><li>Colunas nomeadas corretamente</li><li>Valores numéricos sem símbolos</li><li>Datas padronizadas</li><li>Mapeamentos confirmados</li></ul><br>Quando finalizar, clique em <strong>Concluir</strong> para voltar ao uso normal da página.'
    }
  ];

  // ==============================================================================
  // 2. ESTADO E REFERÊNCIAS DE UI
  // ==============================================================================
  let current = 0;
  let overlay, highlight, tooltip;

  // ==============================================================================
  // 3. CRIAÇÃO DA UI DO TOUR (OVERLAY, HIGHLIGHT, TOOLTIP)
  // ==============================================================================
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'dados-guide-overlay';
    overlay.id = 'dadosGuideOverlay';

    highlight = document.createElement('div');
    highlight.className = 'dados-guide-highlight';

    tooltip = document.createElement('div');
    tooltip.className = 'dados-guide-tooltip';
    tooltip.innerHTML = `
      <button class="dados-guide-close" aria-label="Fechar">✕</button>
      <div class="dados-guide-body"></div>
      <label style="display:block; margin-top:10px; color:var(--suave); font-size:13px;">
        <input type="checkbox" id="dadosGuideDontShow" style="margin-right:8px;"> Não mostrar novamente
      </label>
      <div class="dados-guide-controls">
        <button class="prev">Anterior</button>
        <button class="next primary">Próximo</button>
      </div>
    `;

    overlay.appendChild(highlight);
    overlay.appendChild(tooltip);
    document.body.appendChild(overlay);

    // Clique no backdrop (fora do tooltip) encerra o tour
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) stop();
    });

    tooltip.querySelector('.dados-guide-close').addEventListener('click', stop);
    tooltip.querySelector('.prev').addEventListener('click', prevStep);
    tooltip.querySelector('.next').addEventListener('click', nextStep);
  }

  // ==============================================================================
  // 4. NAVEGAÇÃO E CONTROLE DE PASSOS
  // ==============================================================================

  /**
   * Atalhos de teclado do tour.
   * (Registrado/removido por start()/stop() para permitir reabertura sem
   * perder os atalhos — ver bug corrigido no relatório.)
   */
  function keyHandler(e) {
    if (e.key === 'Escape')       stop();
    if (e.key === 'ArrowRight')   nextStep();
    if (e.key === 'ArrowLeft')    prevStep();
  }

  function start() {
    if (!overlay) createOverlay();
    current = 0;
    overlay.style.display = 'flex';
    overlay.classList.add('show');

    // Registra o listener de teclado a cada abertura (o DOM deduplica
    // listeners idênticos, então reabrir não acumula chamadas).
    document.addEventListener('keydown', keyHandler);

    showStep();
  }

  /**
   * Encerra o tour. Se a flag "Não mostrar novamente" estiver marcada,
   * persiste a preferência em localStorage antes de fechar.
   */
  function stop() {
    const cb = document.getElementById('dadosGuideDontShow');
    if (cb && cb.checked) {
      try { localStorage.setItem('dadosGuideDontShow', '1'); } catch (e) {}
    }

    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('show');
    }
    document.removeEventListener('keydown', keyHandler);
  }

  function nextStep() {
    if (current < STEPS.length - 1) {
      current++;
      showStep();
    } else {
      stop();
    }
  }

  function prevStep() {
    if (current > 0) {
      current--;
      showStep();
    }
  }

  function updateControls() {
    tooltip.querySelector('.prev').style.display =
      current === 0 ? 'none' : 'inline-block';
    tooltip.querySelector('.next').textContent =
      current === STEPS.length - 1 ? 'Finalizar' : 'Próximo';
  }

  // ==============================================================================
  // 5. RENDERIZAÇÃO DE CADA PASSO
  // ==============================================================================
  async function showStep() {
    const step = STEPS[current];
    const body = tooltip.querySelector('.dados-guide-body');
    body.innerHTML = `<h4>${step.title}</h4><div>${step.text}</div>`;

    // Ações opcionais: abrir painel financeiro e/ou trocar aba antes de localizar o alvo
    if (step.openPanel) {
      try { if (typeof window.mostrarPainelFinanceiro === 'function') window.mostrarPainelFinanceiro(); } catch (e) {}
    }
    if (step.switchTab) {
      try { if (typeof window.finMudarTab === 'function') window.finMudarTab(step.switchTab); } catch (e) {}
    }

    // Aguarda um seletor ficar visível (max 3s)
    const waitFor = (sel, timeout = 3000) => new Promise((resolve) => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (!sel) { clearInterval(iv); resolve(null); return; }
        const el = document.querySelector(sel);
        if (el && (el.offsetWidth || el.offsetHeight)) { clearInterval(iv); resolve(el); return; }
        if (Date.now() - start > timeout) { clearInterval(iv); resolve(null); }
      }, 120);
    });

    // Localiza o alvo do passo (pode ser seletor string ou função)
    let target = null;
    try {
      if (step.waitForSelector) target = await waitFor(step.waitForSelector, 3000);
      if (!target) {
        if (typeof step.el === 'function') target = step.el();
        else if (step.el)                  target = document.querySelector(step.el);
      }
    } catch (e) {
      target = null;
    }

    // ----- Passo sem alvo (ou alvo oculto): tooltip centralizado, sem highlight -----
    if (!target || !(target.offsetWidth || target.offsetHeight)) {
      highlight.style.display = 'none';
      tooltip.style.position = 'fixed';

      if (window.innerWidth < 720) {
        tooltip.style.left = '5%';
        tooltip.style.right = '5%';
        tooltip.style.top = 'auto';
        tooltip.style.bottom = '6%';
        tooltip.removeAttribute('data-arrow');
      } else {
        tooltip.style.left = '50%';
        tooltip.style.top = '12%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.removeAttribute('data-arrow');
      }

      updateControls();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // ----- Passo com alvo: destaca e posiciona o tooltip próximo -----
    try {
      if (target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    } catch (e) {}

    const rect = target.getBoundingClientRect();

    // Highlight com padding
    const highlightPadding = 8;
    const left   = rect.left + window.scrollX - highlightPadding;
    const top    = rect.top  + window.scrollY - highlightPadding;
    const width  = Math.max(20, rect.width  + highlightPadding * 2);
    const height = Math.max(20, rect.height + highlightPadding * 2);

    highlight.style.display = 'block';
    highlight.style.width   = width  + 'px';
    highlight.style.height  = height + 'px';
    highlight.style.left    = left   + 'px';
    highlight.style.top     = top    + 'px';

    // Tooltip com best-fit
    tooltip.style.position  = 'absolute';
    tooltip.style.transform = 'translateY(0)';

    const tooltipRectEstimate = { width: Math.min(520, window.innerWidth - 40), height: 160 };
    const margin = 12;

    // Preferência: acima se não houver espaço abaixo
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const prefer = (spaceBelow < 180 && spaceAbove > spaceBelow) ? 'top' : 'bottom';

    // Ajuste horizontal dentro do viewport
    let ttLeft = rect.left + window.scrollX;
    if (ttLeft + tooltipRectEstimate.width > window.scrollX + window.innerWidth - margin) {
      ttLeft = window.scrollX + window.innerWidth - tooltipRectEstimate.width - margin;
    }
    if (ttLeft < window.scrollX + margin) {
      ttLeft = window.scrollX + margin;
    }

    // Posição vertical conforme a preferência
    let ttTop;
    if (prefer === 'bottom') {
      ttTop = rect.bottom + 12 + window.scrollY;
      tooltip.setAttribute('data-arrow', 'top');
    } else {
      ttTop = rect.top - 12 - tooltipRectEstimate.height + window.scrollY;
      tooltip.setAttribute('data-arrow', 'bottom');
    }

    // Clamp vertical
    const minTop = window.scrollY + margin;
    const maxTop = window.scrollY + window.innerHeight - tooltipRectEstimate.height - margin;
    if (ttTop < minTop) ttTop = minTop;
    if (ttTop > maxTop) ttTop = maxTop;

    tooltip.style.left = ttLeft + 'px';
    tooltip.style.top  = ttTop  + 'px';

    updateControls();
  }

  // ==============================================================================
  // 6. INICIALIZAÇÃO E API PÚBLICA
  // ==============================================================================
  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('btnGuiaUso');
    if (btn) {
      btn.addEventListener('click', function () { start(); });
    }

    // Preferência "não mostrar novamente" é apenas lida aqui; o botão
    // permanece acessível para reabertura manual (conforme original).
    try {
      const disabled = localStorage.getItem('dadosGuideDontShow');
      if (disabled === '1') {
        // (no-op intencional — reabertura manual continua permitida)
      }
    } catch (e) {}
  });

  // Exposição para depuração / uso programático
  window.DadosGuide = { start, stop };

  // ==============================================================================
  // 7. UTILITÁRIOS
  // ==============================================================================

  /**
   * Localiza um <th> da tabela de dados cujo texto contenha o termo (case-insensitive).
   * @param {string} text
   * @returns {HTMLElement|null}
   */
  function findHeaderByText(text) {
    const ths = document.querySelectorAll('#tabelaDados thead th');
    for (const th of ths) {
      if (th.innerText && th.innerText.trim().toLowerCase().includes(text.toLowerCase())) {
        return th;
      }
    }
    return null;
  }

})();