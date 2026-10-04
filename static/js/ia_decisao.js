// ==============================================================================
// ia_decisao.js
// ==============================================================================
// Este código pertence à plataforma @DataInsight.
// Todos os códigos da plataforma devem seguir a mesma estrutura de organização
// em seções numeradas, conforme este arquivo.
// ==============================================================================

// ==============================================================================
// 1. CONTROLE DA SIDEBAR
// ==============================================================================

function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
}

function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

// ==============================================================================
// 2. SWOT INSTANTÂNEO (BASEADO EM DADOS REAIS DA API)
// ==============================================================================

/**
 * Preenche os 4 quadrantes do SWOT (S/W/O/T) com dados consolidados
 * obtidos de /api/desempenho e /api/produtos/overview.
 */
async function carregarSwotInstantaneo() {
  const selPeriodo = document.getElementById('modulo-periodo');
  const periodo = selPeriodo ? selPeriodo.value : '30_dias';
  const tabelaId = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';

  try {
    const [rDesemp, rProd] = await Promise.all([
      fetch(`/api/desempenho?periodo=${periodo}&tabela_id=${tabelaId}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/produtos/overview?periodo=${periodo}&tabela_id=${tabelaId}`).then(r => r.ok ? r.json() : null)
    ]);

    const elS = document.getElementById('swot-s');
    const elW = document.getElementById('swot-w');
    const elO = document.getElementById('swot-o');
    const elT = document.getElementById('swot-t');

    // ---------- Forças ----------
    const fatNum = Number(rDesemp?.faturamento?.valor || rDesemp?.faturamento || 0);
    const lucNum = Number(rDesemp?.lucro?.valor || rDesemp?.lucro || 0);
    const margemPct = rDesemp?.margem_lucro?.valor || (fatNum > 0 ? ((lucNum / fatNum) * 100).toFixed(1) + '%' : '—');
    const topProd = rProd?.mais_vendido?.nome || rProd?.maior_lucro?.nome || 'Mix de vendas consolidado';
    const maiorLucroProd = rProd?.maior_lucro?.nome;

    if (elS) {
      elS.classList.remove('loading');
      elS.innerHTML = `
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
          <li>Faturamento consolidado no período (${fatNum > 0 ? 'R$ ' + fatNum.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : 'Em expansão'}).</li>
          <li>Margem de rentabilidade estimada em <strong>${margemPct}</strong>.</li>
          <li>Destaque operacional no item <strong>${topProd}</strong>.</li>
        </ul>
      `;
    }

    // ---------- Fraquezas ----------
    const despNum = Number(rDesemp?.despesa?.valor || rDesemp?.despesas?.valor || rDesemp?.despesa || 0);
    const maiorCusto = rProd?.maior_despesa?.nome;
    const baixoGiro = rProd?.menos_vendido?.nome;

    if (elW) {
      elW.classList.remove('loading');
      elW.innerHTML = `
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
          <li>Despesas acumuladas em <strong>R$ ${despNum.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>.</li>
          ${maiorCusto ? `<li>Concentração de custo no produto <strong>${maiorCusto}</strong>.</li>` : '<li>Atenção aos custos fixos e variáveis da operação.</li>'}
          ${baixoGiro ? `<li>Baixa frequência de saída em <strong>${baixoGiro}</strong>.</li>` : ''}
        </ul>
      `;
    }

    // ---------- Oportunidades ----------
    if (elO) {
      elO.classList.remove('loading');
      elO.innerHTML = `
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
          ${maiorLucroProd ? `<li>Escalar comercialmente <strong>${maiorLucroProd}</strong> para alavancar resultado.</li>` : '<li>Ampliar ticket médio com combos e vendas cruzadas.</li>'}
          <li>Revisão da precificação para ganhar até 5% a mais em margem líquida.</li>
          <li>Expansão de campanhas focadas nos canais de maior conversão.</li>
        </ul>
      `;
    }

    // ---------- Ameaças ----------
    if (elT) {
      elT.classList.remove('loading');
      elT.innerHTML = `
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
          <li>Sensibilidade a aumentos nos custos de reposição/fornecedores.</li>
          <li>Dependência de produtos líderes para sustentar a receita.</li>
          <li>Oscilações de demanda em meses de menor sazonalidade.</li>
        </ul>
      `;
    }

  } catch (e) {
    console.warn('Erro ao carregar SWOT instantâneo:', e);
  }
}

// ==============================================================================
// 3. SIMULADOR DE CENÁRIOS (CONSERVADOR / MODERADO / AGRESSIVO)
// ==============================================================================

/**
 * Projeta cenários financeiros para 3 meses com base nos inputs do simulador
 * (crescimento e custos) aplicados sobre o faturamento do período selecionado.
 */
function calcularCenarios() {
  const selPeriodo = document.getElementById('modulo-periodo');
  const periodo = selPeriodo ? selPeriodo.value : '30_dias';
  const tabelaId = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
  const crescimento = parseFloat(document.getElementById('sim-crescimento')?.value) || 15;
  const custos = parseFloat(document.getElementById('sim-custos')?.value) || 10;

  fetch(`/api/desempenho?periodo=${periodo}&tabela_id=${tabelaId}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const rawFat = (typeof data?.faturamento === 'object' && data?.faturamento !== null) ? data.faturamento.valor : data?.faturamento;
      const fat = (Number(rawFat) || 0) * 3; // projeção 3 meses
      const fmt = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

      const conservador = fat * (1 + (crescimento * 0.4) / 100) * (1 + custos * 0.3 / 100);
      const moderado = fat * (1 + (crescimento * 0.7) / 100) * (1 + custos * 0.6 / 100);
      const agressivo = fat * (1 + crescimento / 100) * (1 + custos / 100);

      const cC = document.getElementById('cen-conservador');
      const cM = document.getElementById('cen-moderado');
      const cA = document.getElementById('cen-agressivo');
      if (cC) cC.textContent = fat > 0 ? fmt(conservador) : '+5% est.';
      if (cM) cM.textContent = fat > 0 ? fmt(moderado) : '+' + Math.round(crescimento * 0.7) + '% est.';
      if (cA) cA.textContent = fat > 0 ? fmt(agressivo) : '+' + crescimento + '% est.';
    })
    .catch(() => {
      ['cen-conservador', 'cen-moderado', 'cen-agressivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '—';
      });
    });
}

// ==============================================================================
// 4. SINCRONIZAÇÃO SWOT COM A ANÁLISE PROFUNDA DA IA
// ==============================================================================

// Atualizar SWOT com a resposta profunda da IA quando concluída
window.addEventListener('ia:analise-concluida', (e) => {
  const resposta = e.detail?.resposta || '';
  if (resposta) {
    populateSWOTFromText(resposta);
  }
});

/**
 * Faz o parsing do texto da IA e distribui os itens nos quadrantes SWOT.
 */
function populateSWOTFromText(text) {
  if (!text) return;
  const sections = { s: [], w: [], o: [], t: [] };
  const lines = text.split('\n');
  let current = null;

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    const l = line.toLowerCase();

    if (l.includes('força') || l.includes('strength') || l.includes('forças')) current = 's';
    else if (l.includes('fraqueza') || l.includes('weakness') || l.includes('fraquezas')) current = 'w';
    else if (l.includes('oportunidade') || l.includes('opportunit') || l.includes('oportunidades')) current = 'o';
    else if (l.includes('ameaça') || l.includes('threat') || l.includes('ameaças')) current = 't';
    else if (current && line) {
      const clean = line.replace(/^[#\*\-\d\.\)\s]+/, '').trim();
      if (clean && clean.length > 5 && !clean.startsWith('===') && !clean.startsWith('---')) {
        if (sections[current].length < 4) {
          sections[current].push(clean);
        }
      }
    }
  });

  ['s', 'w', 'o', 't'].forEach(k => {
    const el = document.getElementById(`swot-${k}`);
    if (el && sections[k].length > 0) {
      el.classList.remove('loading');
      el.innerHTML = `
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
          ${sections[k].map(item => `<li>${item}</li>`).join('')}
        </ul>
      `;
    }
  });
}

// ==============================================================================
// 5. EVENTOS E INICIALIZAÇÃO
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  carregarSwotInstantaneo();
  calcularCenarios();

  const selPeriodo = document.getElementById('modulo-periodo');
  if (selPeriodo) {
    selPeriodo.addEventListener('change', () => {
      carregarSwotInstantaneo();
      calcularCenarios();
    });
  }

  ['sim-crescimento', 'sim-custos', 'sim-clientes'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', calcularCenarios);
  });
});