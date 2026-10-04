// ==============================================================================
// ia_vendas.js
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
// 2. DADOS OPERACIONAIS (ESTATÍSTICAS E RANKING DE PRODUTOS)
// ==============================================================================

/**
 * Carrega estatísticas operacionais e ranking de produtos reais
 * a partir da API /api/produtos/overview.
 */
async function carregarDadosOperacionais() {
  try {
    const selPeriodo = document.getElementById('modulo-periodo');
    const periodo = selPeriodo ? selPeriodo.value : '30_dias';
    const tabelaId = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';

    const r = await fetch(`/api/produtos/overview?periodo=${periodo}&tabela_id=${tabelaId}`);
    if (r.ok) {
      const data = await r.json();
      const topList = document.getElementById('op-ranking-list');
      const topItemEl = document.getElementById('op-top-item');
      const totalProdEl = document.getElementById('op-total-produtos');
      const totalCatEl = document.getElementById('op-total-categorias');
      const oppList = document.getElementById('op-opportunities-list');

      const prods = data.produtos || data.tabela_produtos || [];
      const totalProds = (data.total_produtos !== undefined) ? data.total_produtos : prods.length;
      const totalCats = (data.total_categorias !== undefined && data.total_categorias !== null)
        ? data.total_categorias
        : (data.categorias ? data.categorias.length : '—');

      if (totalProdEl) totalProdEl.textContent = totalProds;
      if (totalCatEl) totalCatEl.textContent = totalCats;

      if (prods && prods.length > 0) {
        const liderNome = data.mais_vendido?.nome || data.maior_lucro?.nome || prods[0].nome || '—';
        if (topItemEl) topItemEl.textContent = liderNome;

        // Ranking Top 5
        if (topList) {
          topList.innerHTML = prods.slice(0, 5).map((p, idx) => {
            const valFat = p.faturamento !== undefined ? p.faturamento : p.valor;
            let formatado = '—';
            if (valFat) {
              formatado = 'R$ ' + Number(valFat).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            } else if (p.quantidade) {
              formatado = p.quantidade + ' un';
            }
            return `
              <li class="ranking-item">
                <div class="ranking-item-left">
                  <span class="ranking-badge">#${idx + 1}</span>
                  <span>${p.nome || p.produto || 'Item ' + (idx + 1)}</span>
                </div>
                <span class="ranking-item-right">${formatado}</span>
              </li>
            `;
          }).join('');
        }

        // Gargalos e Oportunidades operacionais baseados em dados reais
        if (oppList) {
          const itensOpp = [];

          if (data.maior_despesa && data.maior_despesa.despesa > 0) {
            const despVal = 'R$ ' + Number(data.maior_despesa.despesa).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            itensOpp.push(`
              <li class="ranking-item">
                <div class="ranking-item-left">
                  <i class="fa-solid fa-triangle-exclamation" style="color:#EF4444;"></i>
                  <span><strong>Maior Custo:</strong> ${data.maior_despesa.nome} concentra ${despVal} em custos operacionais.</span>
                </div>
              </li>
            `);
          }

          if (data.maior_lucro && data.maior_lucro.lucro > 0) {
            const lucVal = 'R$ ' + Number(data.maior_lucro.lucro).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            itensOpp.push(`
              <li class="ranking-item">
                <div class="ranking-item-left">
                  <i class="fa-solid fa-gem" style="color:#10B981;"></i>
                  <span><strong>Carro-chefe:</strong> ${data.maior_lucro.nome} entrega a maior rentabilidade (${lucVal} de lucro líquido).</span>
                </div>
              </li>
            `);
          }

          if (data.menos_vendido && data.menos_vendido.quantidade !== undefined) {
            itensOpp.push(`
              <li class="ranking-item">
                <div class="ranking-item-left">
                  <i class="fa-solid fa-arrow-down-short-wide" style="color:#F59E0B;"></i>
                  <span><strong>Baixo Giro:</strong> ${data.menos_vendido.nome} teve apenas ${data.menos_vendido.quantidade} saídas no período.</span>
                </div>
              </li>
            `);
          }

          if (itensOpp.length > 0) {
            oppList.innerHTML = itensOpp.join('');
          }
        }
      } else {
        if (topItemEl) topItemEl.textContent = '—';
        if (topList) topList.innerHTML = '<li class="ranking-item"><span style="color:var(--suave);">Nenhum produto individual identificado nos dados atuais.</span></li>';
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar dados operacionais:', e);
  }
}

// ==============================================================================
// 3. EVENTOS E INICIALIZAÇÃO
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  carregarDadosOperacionais();

  const selPeriodo = document.getElementById('modulo-periodo');
  if (selPeriodo) {
    selPeriodo.addEventListener('change', carregarDadosOperacionais);
  }
});