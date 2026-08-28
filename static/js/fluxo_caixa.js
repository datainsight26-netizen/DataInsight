// ==============================================================================
// FLUXO DE CAIXA - SISTEMA GERAL DE ANÁLISE E APEXCHARTS
// DataInsight - Módulo Empresarial de Fluxo de Caixa (Dados Reais + Previsto x Realizado)
// ==============================================================================

const chartsInstances = {};

// ==========================================
// 1. UTILITÁRIOS E TEMA
// ==========================================

function isDarkMode() {
  return document.body.classList.contains('tema-escuro') || 
         document.documentElement.dataset.theme === 'dark' ||
         localStorage.getItem('tema') === 'escuro';
}

function getThemeColors() {
  const isDark = isDarkMode();
  return {
    isDark: isDark,
    texto: isDark ? '#F9FAFB' : '#111827',
    suave: isDark ? '#CBD5E1' : '#6B7280',
    borda: isDark ? '#334155' : '#E5E7EB',
    fundo: isDark ? '#18181b' : '#FFFFFF',
    verde: '#22C55E',
    vermelho: '#EF4444',
    azul: '#3B82F6',
    amarelo: '#F59E0B',
    roxo: '#8B5CF6'
  };
}

function brl(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '0,0%';
  const prefixo = n > 0 ? '+' : '';
  return `${prefixo}${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarDataExibicao(dataStr) {
  try {
    if (!dataStr) return '';
    const str = String(dataStr).trim();
    if (str.length <= 5) return str;
    if (str.includes('-')) {
      const partes = str.split('-');
      if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}`;
      }
    }
    return str;
  } catch {
    return dataStr;
  }
}

// ==========================================
// 2. CONFIGURAÇÕES DOS GRÁFICOS APEXCHARTS
// ==========================================

function getChartLinhaOptions() {
  const colors = getThemeColors();

  return {
    series: [
      { name: 'Entradas', data: [] },
      { name: 'Saídas', data: [] }
    ],
    chart: {
      type: 'bar',
      height: 330,
      foreColor: colors.texto,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 }
    },
    colors: [colors.verde, colors.vermelho],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '48%',
        borderRadius: 4
      }
    },
    dataLabels: { enabled: false },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: [],
      labels: {
        show: true,
        rotate: -30,
        style: { fontSize: '11px', colors: colors.suave }
      },
      axisBorder: { color: colors.borda },
      axisTicks: { color: colors.borda }
    },
    yaxis: {
      labels: {
        style: { colors: colors.suave, fontSize: '11px' },
        formatter: (v) => brl(v)
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: colors.isDark ? 'dark' : 'light',
      y: { formatter: (v) => brl(v) }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: colors.texto }
    },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5
    }
  };
}

function getChartBarrasOptions() {
  const colors = getThemeColors();

  return {
    series: [
      { name: 'Saldo', data: [] }
    ],
    chart: {
      type: 'line',
      height: 330,
      foreColor: colors.texto,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 }
    },
    colors: [colors.azul],
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: [],
      labels: {
        show: true,
        style: { fontSize: '11px', colors: colors.suave }
      },
      axisBorder: { color: colors.borda },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        style: { colors: colors.suave, fontSize: '11px' },
        formatter: (v) => brl(v)
      }
    },
    tooltip: {
      shared: false,
      theme: colors.isDark ? 'dark' : 'light',
      y: { formatter: (v) => brl(v) }
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: colors.texto }
    },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 5
    }
  };
}

function getChartMaioresGastosOptions() {
  const colors = getThemeColors();

  return {
    series: [{ name: 'Gastos', data: [] }],
    chart: {
      type: 'bar',
      height: 320,
      foreColor: colors.texto,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 }
    },
    colors: [colors.vermelho],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        barHeight: '55%'
      }
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: '11px', fontWeight: 'bold' },
      formatter: (val) => brl(val)
    },
    xaxis: {
      categories: [],
      labels: {
        style: { colors: colors.suave, fontSize: '11px' },
        formatter: (val) => brl(val)
      },
      axisBorder: { color: colors.borda }
    },
    yaxis: {
      labels: {
        style: { colors: colors.texto, fontSize: '12px', fontWeight: 500 }
      }
    },
    tooltip: {
      theme: colors.isDark ? 'dark' : 'light',
      y: { formatter: (val) => brl(val) }
    },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 4
    }
  };
}

function getChartMaioresLucrosOptions() {
  const colors = getThemeColors();

  return {
    series: [{ name: 'Receita / Lucro', data: [] }],
    chart: {
      type: 'bar',
      height: 320,
      foreColor: colors.texto,
      background: 'transparent',
      toolbar: { show: false },
      animations: { enabled: true, speed: 400 }
    },
    colors: [colors.verde],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        barHeight: '55%'
      }
    },
    dataLabels: {
      enabled: true,
      style: { fontSize: '11px', fontWeight: 'bold' },
      formatter: (val) => brl(val)
    },
    xaxis: {
      categories: [],
      labels: {
        style: { colors: colors.suave, fontSize: '11px' },
        formatter: (val) => brl(val)
      },
      axisBorder: { color: colors.borda }
    },
    yaxis: {
      labels: {
        style: { colors: colors.texto, fontSize: '12px', fontWeight: 500 }
      }
    },
    tooltip: {
      theme: colors.isDark ? 'dark' : 'light',
      y: { formatter: (val) => brl(val) }
    },
    grid: {
      borderColor: colors.borda,
      strokeDashArray: 4
    }
  };
}

// ==========================================
// 3. ATUALIZAÇÃO DE KPIS E FONTES
// ==========================================

function atualizarKPIs(dados) {
  if (!dados || !dados.kpis) return;

  const {
    receita_total = 0,
    lucro_liquido = 0,
    despesa_total = 0,
    margem_lucro = 0
  } = dados.kpis;

  const kpiReceita = document.getElementById("kpiReceita");
  const kpiDespesas = document.getElementById("kpiDespesas");
  const kpiLucro = document.getElementById("kpiLucro");
  const kpiMargem = document.getElementById("kpiMargem");

  if (kpiReceita) kpiReceita.textContent = brl(receita_total);
  if (kpiDespesas) kpiDespesas.textContent = brl(despesa_total);
  if (kpiLucro) {
    kpiLucro.textContent = brl(lucro_liquido);
    kpiLucro.style.color = lucro_liquido < 0 ? 'var(--perigo)' : 'var(--sucesso)';
  }
  if (kpiMargem) kpiMargem.textContent = Number(margem_lucro).toFixed(1).replace(".", ",") + "%";
}

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
// 4. RENDERIZAÇÃO DINÂMICA DA TABELA DE FLUXO DE CAIXA
// ==========================================

function renderTabelaFluxoCaixa(periodos, linhas) {
  const thead = document.getElementById('fluxoTabelaHead');
  const tbody = document.getElementById('fluxoTabelaBody');

  if (!thead || !tbody) return;

  if (!periodos || !periodos.length || !linhas || !linhas.length) {
    thead.innerHTML = '';
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align:center;padding:32px;color:var(--suave);">
          Nenhum lançamento financeiro encontrado para este período.
        </td>
      </tr>
    `;
    return;
  }

  // 1. CONSTRUIR CABEÇALHO COM A QUANTIDADE EXATA DE COLUNAS
  let linhaHeader1 = `
    <tr class="fluxo-tabela__cabecalho-principal">
      <th rowspan="2" class="fluxo-col-categoria" style="min-width:260px; text-align:left; padding:12px 16px;">
        Categoria / Conta
      </th>
  `;

  periodos.forEach(p => {
    linhaHeader1 += `
      <th colspan="2" style="text-align:center; padding:10px; border-left:1px solid var(--borda);">
        ${p}
      </th>
    `;
  });

  linhaHeader1 += `
      <th colspan="2" style="text-align:center; padding:10px; border-left:2px solid var(--borda); background:rgba(59,130,246,0.08);">
        Total do Período
      </th>
    </tr>
  `;

  let linhaHeader2 = `<tr class="fluxo-tabela__cabecalho-secundario">`;
  periodos.forEach(() => {
    linhaHeader2 += `
      <th style="font-size:0.75rem; text-align:right; padding:6px 10px; border-left:1px solid var(--borda);">Prev.</th>
      <th style="font-size:0.75rem; text-align:right; padding:6px 10px;">Real.</th>
    `;
  });

  linhaHeader2 += `
      <th style="font-size:0.75rem; text-align:right; padding:6px 10px; border-left:2px solid var(--borda); background:rgba(59,130,246,0.08);">Prev. Total</th>
      <th style="font-size:0.75rem; text-align:right; padding:6px 10px; background:rgba(59,130,246,0.08);">Real. Total</th>
    </tr>
  `;

  thead.innerHTML = linhaHeader1 + linhaHeader2;

  // 2. CONSTRUIR O CORPO DA TABELA
  let htmlBody = '';

  linhas.forEach(linha => {
    const isGrupo = linha.tipo === 'grupo';
    const isSubitem = linha.tipo === 'subitem';
    const isSubtotal = linha.tipo === 'subtotal_grupo';
    const isTotal = linha.tipo.startsWith('total') || linha.tipo.startsWith('saldo');

    let classeTr = '';
    let estiloTr = '';

    if (isGrupo) {
      classeTr = `fluxo-grupo fluxo-grupo--${linha.grupo}`;
      estiloTr = 'cursor:pointer;';
    } else if (isSubitem) {
      classeTr = 'fluxo-subitem';
      estiloTr = '';
    } else if (isSubtotal) {
      classeTr = `fluxo-subtotal-grupo fluxo-subtotal--${linha.grupo}`;
      estiloTr = 'font-weight:700; background:rgba(255,255,255,0.04); border-top:1px dashed var(--borda);';
    } else if (isTotal) {
      if (linha.tipo === 'saldo_anterior') {
        classeTr = 'fluxo-total fluxo-total--anterior';
        estiloTr = 'font-weight:800;';
      } else if (linha.tipo === 'saldo') {
        classeTr = 'fluxo-total fluxo-total--operacional';
        estiloTr = 'font-weight:800;';
      } else if (linha.tipo === 'saldo_acumulado') {
        classeTr = 'fluxo-total fluxo-total--acumulado';
        estiloTr = 'font-weight:800;';
      } else {
        classeTr = 'fluxo-total fluxo-total--saidas';
        estiloTr = 'font-weight:700;';
      }
    }

    const parentAttr = (isSubitem || isSubtotal) ? `data-parent="${linha.grupo}"` : '';
    htmlBody += `<tr class="${classeTr}" ${parentAttr} style="${estiloTr}">`;

    // Coluna Categoria
    if (isGrupo) {
      htmlBody += `
        <td style="padding:10px 16px;">
          <button type="button" class="fluxo-grupo-toggle" data-grupo="${linha.grupo}" aria-expanded="true" style="background:none;border:none;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;gap:8px;padding:0;">
            <i class="fa-solid fa-chevron-down" style="font-size:0.75rem; transition:transform 0.2s;"></i>
            <span style="letter-spacing:0.02em;">${linha.label}</span>
          </button>
        </td>
      `;
    } else if (isSubitem) {
      htmlBody += `<td style="padding:8px 16px 8px 32px; color:var(--suave); font-size:0.87rem;">${linha.label}</td>`;
    } else if (isSubtotal) {
      htmlBody += `<td style="padding:9px 16px 9px 24px; font-weight:700; color:var(--texto); font-size:0.88rem;">${linha.label}</td>`;
    } else {
      htmlBody += `<td style="padding:11px 16px; font-weight:700;">${linha.label}</td>`;
    }

    // Colunas de Valores por Período
    linha.valores.forEach(v => {
      const real = v.realizado;
      const prev = v.previsto;
      const variacao = v.variacao;

      let varBadge = '';
      if (prev > 0 && Math.abs(variacao) >= 0.1) {
        const isPositivo = (linha.grupo === 'entradas' || linha.id === 'entradas_total' || linha.tipo === 'saldo')
          ? variacao >= 0
          : variacao <= 0;
        const corClass = isPositivo ? 'fluxo-variacao--positiva' : 'fluxo-variacao--negativa';
        varBadge = `<span class="fluxo-variacao ${corClass}" style="font-size:0.65rem; margin-right:4px; opacity:0.85;">${pct(variacao)}</span>`;
      }

      htmlBody += `
        <td style="text-align:right; padding:8px 10px; font-size:0.82rem; color:var(--suave); border-left:1px solid var(--borda);">
          ${brl(prev)}
        </td>
        <td style="text-align:right; padding:8px 10px; font-size:0.87rem; font-weight:${isTotal || isGrupo || isSubtotal ? '700' : '500'};">
          ${varBadge}<strong>${brl(real)}</strong>
        </td>
      `;
    });

    // Colunas de Total do Período
    const totalPrev = linha.total_previsto;
    const totalReal = linha.total_realizado;
    const totalVar = linha.total_variacao;

    let varBadgeTot = '';
    if (totalPrev > 0 && Math.abs(totalVar) >= 0.1) {
      const isPositivo = (linha.grupo === 'entradas' || linha.id === 'entradas_total' || linha.tipo === 'saldo')
        ? totalVar >= 0
        : totalVar <= 0;
      const corClass = isPositivo ? 'fluxo-variacao--positiva' : 'fluxo-variacao--negativa';
      varBadgeTot = `<span class="fluxo-variacao ${corClass}" style="font-size:0.65rem; margin-right:4px; opacity:0.85;">${pct(totalVar)}</span>`;
    }

    htmlBody += `
      <td style="text-align:right; padding:8px 10px; font-size:0.85rem; color:var(--suave); border-left:2px solid var(--borda); background:rgba(59,130,246,0.04);">
        ${brl(totalPrev)}
      </td>
      <td style="text-align:right; padding:8px 10px; font-size:0.88rem; font-weight:700; background:rgba(59,130,246,0.04);">
        ${varBadgeTot}<strong>${brl(totalReal)}</strong>
      </td>
    `;

    htmlBody += `</tr>`;
  });

  tbody.innerHTML = htmlBody;

  configurarTabelaExpansivel();
}

function configurarTabelaExpansivel() {
  document.querySelectorAll('.fluxo-grupo-toggle').forEach(botao => {
    botao.addEventListener('click', function (e) {
      e.stopPropagation();
      const grupo = this.dataset.grupo;
      const linhas = document.querySelectorAll(`[data-parent="${grupo}"]`);
      const aberto = this.getAttribute('aria-expanded') === 'true';

      linhas.forEach(linha => {
        linha.style.display = aberto ? 'none' : 'table-row';
      });

      this.setAttribute('aria-expanded', String(!aberto));
      const icone = this.querySelector('i');
      if (icone) {
        icone.style.transform = aberto ? 'rotate(-90deg)' : 'rotate(0deg)';
      }
    });
  });
}

// ==========================================
// 5. CARREGAMENTO COMPLETO DOS DADOS DA API
// ==========================================

async function atualizarGraficosComDados() {
  try {
    const periodoSelect = document.getElementById('periodoDash');
    const planilhaSelect = document.getElementById('seletorPlanilhaDash');
    if (!periodoSelect) return;

    const periodo = periodoSelect.value || '30';
    const tabelaId = planilhaSelect?.value || 'todas';

    localStorage.setItem('DataInsight_DashboardPlanilha', tabelaId);

    const resposta = await fetch(`/api/fluxo-caixa?periodo=${periodo}&tabela_id=${tabelaId}`);

    if (!resposta.ok) {
      console.error(`Erro ao carregar dados do fluxo de caixa: HTTP ${resposta.status}`);
      return;
    }

    const dados = await resposta.json();
    if (dados.erro && !dados.contexto) {
      console.warn(`Aviso: ${dados.erro}`);
      return;
    }

    // 1. Contexto e Fontes
    if (dados.contexto) {
      atualizarBadgesFontes(dados.contexto);
    }

    // 2. KPIs
    if (dados.kpis) {
      atualizarKPIs(dados);
    }

    // 3. Tabela Dinâmica
    if (dados.periodos && dados.tabela_detalhada) {
      renderTabelaFluxoCaixa(dados.periodos, dados.tabela_detalhada);
    }

    // 4. Gráfico Entradas x Saídas
    if (dados.evolucao?.series && dados.evolucao?.labels && chartsInstances.linha) {
      await chartsInstances.linha.updateOptions({
        xaxis: { categories: dados.evolucao.labels }
      });
      await chartsInstances.linha.updateSeries(dados.evolucao.series);
    }

    // 5. Gráfico Saldo
    if (dados.evolucao?.labels && dados.evolucao?.lucro && chartsInstances.barras) {
      await chartsInstances.barras.updateOptions({
        xaxis: { categories: dados.evolucao.labels }
      });
      await chartsInstances.barras.updateSeries([
        { name: 'Saldo', data: dados.evolucao.lucro }
      ]);
    }

      // 6. Maiores Gastos
    if (dados.categorias?.labels && dados.categorias?.valores && chartsInstances.maioresGastos) {
      const topCat = dados.categorias.labels.slice(0, 6);
      const topVal = dados.categorias.valores.slice(0, 6);

      await chartsInstances.maioresGastos.updateOptions({
        xaxis: { categories: topCat }
      });
      await chartsInstances.maioresGastos.updateSeries([
        { name: 'Gastos', data: topVal }
      ]);

      const total = dados.categorias.valores.reduce((a, b) => a + b, 0);
      const maior = topVal[0] || 0;
      const maiorNome = topCat[0] || '--';

      const maiorGastoValor = document.getElementById('maiorGastoValor');
      const maiorGastoCategoria = document.getElementById('maiorGastoCategoria');
      const totalGastoPeriodo = document.getElementById('totalGastoPeriodo');
      const maiorGastoPercentual = document.getElementById('maiorGastoPercentual');

      if (maiorGastoValor) maiorGastoValor.textContent = brl(maior);
      if (maiorGastoCategoria) maiorGastoCategoria.textContent = maiorNome;
      if (totalGastoPeriodo) totalGastoPeriodo.textContent = brl(total);
      if (maiorGastoPercentual && total > 0) {
        maiorGastoPercentual.textContent = ((maior / total) * 100).toFixed(1).replace('.', ',') + '%';
      }
    }

    // 7. Maiores Lucros / Fontes de Receita
    if (dados.maiores_lucros?.labels && dados.maiores_lucros?.valores && chartsInstances.maioresLucros) {
      const topLucroCat = dados.maiores_lucros.labels.slice(0, 6);
      const topLucroVal = dados.maiores_lucros.valores.slice(0, 6);

      await chartsInstances.maioresLucros.updateOptions({
        xaxis: { categories: topLucroCat }
      });
      await chartsInstances.maioresLucros.updateSeries([
        { name: 'Receita / Lucro', data: topLucroVal }
      ]);

      const totalLucro = dados.maiores_lucros.valores.reduce((a, b) => a + b, 0);
      const maiorLucro = topLucroVal[0] || 0;
      const maiorLucroNome = topLucroCat[0] || '--';

      const maiorLucroValor = document.getElementById('maiorLucroValor');
      const maiorLucroCategoria = document.getElementById('maiorLucroCategoria');
      const totalLucroPeriodo = document.getElementById('totalLucroPeriodo');
      const maiorLucroPercentual = document.getElementById('maiorLucroPercentual');

      if (maiorLucroValor) maiorLucroValor.textContent = brl(maiorLucro);
      if (maiorLucroCategoria) maiorLucroCategoria.textContent = maiorLucroNome;
      if (totalLucroPeriodo) totalLucroPeriodo.textContent = brl(totalLucro);
      if (maiorLucroPercentual && totalLucro > 0) {
        maiorLucroPercentual.textContent = ((maiorLucro / totalLucro) * 100).toFixed(1).replace('.', ',') + '%';
      }
    }

  } catch (erro) {
    console.error("Erro ao carregar Fluxo de Caixa:", erro);
  }
}

// ==========================================
// 6. RENDERIZAÇÃO INICIAL E FILTROS
// ==========================================

function renderizarGraficos() {
  Object.values(chartsInstances).forEach(chart => {
    try { chart?.destroy(); } catch (_) {}
  });

  const graficos = [
    { id: 'graficoLinhaGaleria', config: getChartLinhaOptions, key: 'linha' },
    { id: 'graficoBarrasGaleria', config: getChartBarrasOptions, key: 'barras' },
    { id: 'graficoMaioresGastos', config: getChartMaioresGastosOptions, key: 'maioresGastos' },
    { id: 'graficoMaioresLucros', config: getChartMaioresLucrosOptions, key: 'maioresLucros' }
  ];

  graficos.forEach(({ id, config, key }) => {
    const element = document.getElementById(id);
    if (element && typeof ApexCharts !== 'undefined') {
      element.innerHTML = '';
      const chart = new ApexCharts(element, config());
      chart.render();
      chartsInstances[key] = chart;
    }
  });
}

function configurarBotoesPeriodo() {
  document.querySelectorAll('.fluxo-periodo-btn').forEach(botao => {
    botao.addEventListener('click', async function () {
      const periodo = this.dataset.periodo;
      const select = document.getElementById('periodoDash');

      document.querySelectorAll('.fluxo-periodo-btn').forEach(btn => {
        btn.classList.remove('ativo');
      });
      this.classList.add('ativo');

      if (select) {
        select.value = periodo;
      }

      const texto = document.getElementById('textoPeriodoSelecionado');
      const textos = {
        '7': 'Exibindo os últimos 7 dias',
        '30': 'Exibindo os últimos 30 dias',
        '180': 'Exibindo os últimos 6 meses',
        '365': 'Exibindo o último ano'
      };

      if (texto) {
        texto.textContent = textos[periodo] || 'Período selecionado';
      }

      await atualizarGraficosComDados();
    });
  });
}

// ==========================================
// 7. TEMA E INICIALIZAÇÃO
// ==========================================

const originalAlternarTema = window.alternarTema;
window.alternarTema = function () {
  if (originalAlternarTema) originalAlternarTema();

  setTimeout(() => {
    const colors = getThemeColors();
    Object.values(chartsInstances).forEach(chart => {
      if (chart?.updateOptions) {
        chart.updateOptions({
          chart: { foreColor: colors.texto },
          grid: { borderColor: colors.borda }
        });
      }
    });
  }, 100);
};

window.redimensionarGraficos = function () {
  Object.values(chartsInstances).forEach(chart => {
    if (chart?.updateOptions && chart.w?.globals?.chartHeight) {
      chart.updateOptions({ chart: { height: chart.w.globals.chartHeight } });
    }
  });
};

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => window.redimensionarGraficos(), 250);
});

function abrirSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (s) s.classList.add('open');
  if (o) o.classList.add('active');
}

function fecharSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebarOverlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('active');
}

window.abrirSidebar = abrirSidebar;
window.fecharSidebar = fecharSidebar;

document.addEventListener("DOMContentLoaded", async () => {
  configurarBotoesPeriodo();

  let tentativas = 0;
  const verificarApex = setInterval(async () => {
    tentativas++;
    if (typeof ApexCharts !== 'undefined') {
      clearInterval(verificarApex);
      renderizarGraficos();
      await carregarOpcoesPlanilhas();
      await atualizarGraficosComDados();
    }
    if (tentativas > 30) {
      clearInterval(verificarApex);
    }
  }, 100);

  document.getElementById('periodoDash')?.addEventListener('change', () => atualizarGraficosComDados());
  document.getElementById('seletorPlanilhaDash')?.addEventListener('change', () => atualizarGraficosComDados());
});