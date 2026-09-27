/**
 * DataInsight - Módulo de Controles Essenciais do MEI
 * Gerenciamento do Termômetro do Limite Anual, Equação de Caixa e Seletor de Tabelas
 */

let dadosControlesAtuais = null;
let tabelaAtualId = 'todas';
let planilhasCarregadas = [];
let chartRecebimentosInstancia = null;
let chartCustosInstancia = null;
let periodoDashboardAtual = 'mes'; // 'mes' ou 'ano'

function isDarkMode() {
  return document.body.classList.contains('tema-escuro') || localStorage.getItem('tema') === 'escuro';
}

function formatarBRL(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Ajustar data inicial do modal para hoje
  const inputData = document.getElementById('lancData');
  if (inputData) {
    inputData.value = new Date().toISOString().split('T')[0];
  }

  // Ajustar mês selecionado para o mês atual
  const mesAtual = new Date().getMonth() + 1;
  const selMes = document.getElementById('selMes');
  if (selMes) selMes.value = String(mesAtual);

  // Observar alternância de tema para atualizar gráficos dinamicamente
  const btnTema = document.getElementById('btnTema');
  if (btnTema) {
    btnTema.addEventListener('click', () => {
      setTimeout(() => {
        const modo = isDarkMode() ? 'dark' : 'light';
        if (chartRecebimentosInstancia && chartRecebimentosInstancia.updateOptions) {
          chartRecebimentosInstancia.updateOptions({ theme: { mode: modo } });
        }
        if (chartCustosInstancia && chartCustosInstancia.updateOptions) {
          chartCustosInstancia.updateOptions({ theme: { mode: modo } });
        }
      }, 100);
    });
  }

  // Inicializar seletor de planilha e depois carregar dados
  await configurarSeletorPlanilhaCE();
  await carregarControlesEssenciais();
});

// ==============================================================================
// SELETOR DE ORIGEM DOS DADOS (MULTI-TABELAS)
// ==============================================================================
async function configurarSeletorPlanilhaCE() {
  const select = document.getElementById('seletorPlanilhaCE');
  const selectModal = document.getElementById('lancTabelaDestino');
  if (!select) return;

  try {
    const resp = await fetch('/api/planilhas/sumario');
    if (!resp.ok) return;
    const json = await resp.json();
    planilhasCarregadas = json.planilhas || [];

    select.innerHTML = '';

    // Opção Visão Consolidada
    const optTodas = document.createElement('option');
    optTodas.value = 'todas';
    optTodas.textContent = `🌐 Todas as Planilhas (Visão Consolidada - ${planilhasCarregadas.length})`;
    select.appendChild(optTodas);

    // Seletor do modal de lançamento
    if (selectModal) {
      selectModal.innerHTML = '<option value="padrao">📋 Tabela Padrão (Controles Essenciais MEI)</option>';
    }

    // Listar tabelas do usuário
    planilhasCarregadas.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
      opt.textContent = `${icone} [${p.dominio_label}] ${p.nome} (${p.total_linhas} linhas)`;
      select.appendChild(opt);

      if (selectModal) {
        const optM = document.createElement('option');
        optM.value = p.id;
        optM.textContent = `📁 ${p.nome}`;
        selectModal.appendChild(optM);
      }
    });

    // Recuperar preferência salva no LocalStorage
    const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
    if (salva && (salva === 'todas' || planilhasCarregadas.some(p => p.id === salva))) {
      select.value = salva;
      tabelaAtualId = salva;
      if (selectModal && salva !== 'todas') {
        selectModal.value = salva;
      }
    }

    // Escutar mudança de tabela
    select.addEventListener('change', async e => {
      tabelaAtualId = e.target.value;
      localStorage.setItem('DataInsight_DashboardPlanilha', tabelaAtualId);

      if (selectModal) {
        selectModal.value = (tabelaAtualId !== 'todas') ? tabelaAtualId : 'padrao';
      }

      atualizarBadgeStatusCE(planilhasCarregadas, tabelaAtualId);
      await carregarControlesEssenciais();
    });

    atualizarBadgeStatusCE(planilhasCarregadas, tabelaAtualId);
  } catch (e) {
    console.warn('Aviso ao carregar planilhas nos Controles Essenciais:', e);
  }
}

function atualizarBadgeStatusCE(planilhas, idSelecionado) {
  const container = document.getElementById('controlesStatusFontesContainer');
  if (!container) return;

  if (idSelecionado === 'todas') {
    const qtd = planilhas ? planilhas.length : 0;
    container.innerHTML = `
      <span class="badge" style="background:rgba(59,130,246,0.12); color:#3b82f6; border:1px solid rgba(59,130,246,0.25); padding:6px 12px; border-radius:14px; font-size:0.75rem; font-weight:600;">
        <i class="fa-solid fa-layer-group"></i> ${qtd} ${qtd === 1 ? 'planilha consolidada' : 'planilhas consolidadas'}
      </span>
    `;
  } else {
    const p = (planilhas || []).find(x => x.id === idSelecionado);
    const nome = p ? p.nome : 'Planilha Individual';
    const dom = p ? p.dominio_label : 'Individual';
    container.innerHTML = `
      <span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); padding:6px 12px; border-radius:14px; font-size:0.75rem; font-weight:600;">
        <i class="fa-solid fa-file-invoice"></i> ${nome} (${dom})
      </span>
    `;
  }
}

// ==============================================================================
// CARREGAMENTO DOS DADOS (API)
// ==============================================================================
async function carregarControlesEssenciais() {
  const ano = document.getElementById('selAno')?.value || new Date().getFullYear();
  const mes = document.getElementById('selMes')?.value || (new Date().getMonth() + 1);
  const tabelaId = document.getElementById('seletorPlanilhaCE')?.value || tabelaAtualId || 'todas';

  try {
    const res = await fetch(`/api/controles-essenciais?ano=${ano}&mes=${mes}&tabela_id=${encodeURIComponent(tabelaId)}`);
    const data = await res.json();

    if (!data.sucesso && data.erro) {
      console.warn("Erro ao buscar dados dos controles essenciais:", data.erro);
      return;
    }

    dadosControlesAtuais = data;
    renderizarControles(data);

    // Se o backend retornou informações do contexto das fontes, atualizar badge
    if (data.contexto && planilhasCarregadas.length > 0) {
      atualizarBadgeStatusCE(planilhasCarregadas, tabelaId);
    }
  } catch (err) {
    console.error("Falha na requisição de controles essenciais:", err);
  }
}

function renderizarControles(data) {
  const teto = data.teto_mei || {};
  const caixa = data.caixa || {};
  const saidas = data.categorias_saida || {};
  const meses = data.meses_resumo || [];
  const lancamentos = data.lancamentos_recentes || [];

  // 1. Termômetro MEI
  const kpiFaturado = document.getElementById('kpiFaturadoAno');
  const kpiLimite = document.getElementById('kpiLimiteTeto');
  const kpiSaldoRestante = document.getElementById('kpiSaldoRestante');
  const kpiPct = document.getElementById('kpiPctUsado');
  const badgeTeto = document.getElementById('termometroBadge');
  const barFill = document.getElementById('termometroFill');
  const msgTeto = document.getElementById('termometroMensagem');
  const alertBox = document.getElementById('termometroAlertBox');
  const labelTetoFinal = document.getElementById('labelTetoFinal');

  if (kpiFaturado) kpiFaturado.textContent = formatarBRL(teto.faturado_ano);
  if (kpiLimite) kpiLimite.textContent = formatarBRL(teto.limite_anual) + (teto.proporcional ? ' (Proporcional)' : '');
  if (kpiSaldoRestante) kpiSaldoRestante.textContent = formatarBRL(teto.saldo_restante);
  if (kpiPct) kpiPct.textContent = `${teto.percentual_usado}%`;
  if (labelTetoFinal) labelTetoFinal.textContent = formatarBRL(teto.limite_anual);

  // Barra de progresso com cap em 100% para visual
  if (barFill) {
    const largura = Math.min(100, Math.max(0, teto.percentual_usado));
    barFill.style.width = `${largura}%`;
  }

  // Badge e Caixa de Alerta
  if (badgeTeto) {
    badgeTeto.innerHTML = `<i class="fa-solid fa-circle"></i> <span>${teto.badge}</span>`;
    badgeTeto.style.color = teto.cor;
    badgeTeto.style.borderColor = teto.cor;
    badgeTeto.style.background = `${teto.cor}18`;
  }

  if (msgTeto) msgTeto.textContent = teto.mensagem;
  if (alertBox) {
    alertBox.style.color = teto.cor;
    alertBox.style.borderColor = `${teto.cor}40`;
    alertBox.style.background = `${teto.cor}12`;
  }

  // 2. Equação de Caixa
  const cxSaldoAnt = document.getElementById('cxSaldoAnt');
  const cxEntradas = document.getElementById('cxEntradas');
  const cxSaidas = document.getElementById('cxSaidas');
  const cxSaldoAtual = document.getElementById('cxSaldoAtual');
  const cxLucroMes = document.getElementById('cxLucroMes');

  if (cxSaldoAnt) cxSaldoAnt.textContent = formatarBRL(caixa.saldo_anterior);
  if (cxEntradas) cxEntradas.textContent = formatarBRL(caixa.entradas);
  if (cxSaidas) cxSaidas.textContent = formatarBRL(caixa.saidas);
  if (cxSaldoAtual) {
    cxSaldoAtual.textContent = formatarBRL(caixa.saldo_atual);
    cxSaldoAtual.style.color = caixa.saldo_atual >= 0 ? '#3b82f6' : '#ef4444';
  }
  if (cxLucroMes) {
    const lucro = caixa.lucro_periodo;
    cxLucroMes.textContent = `Resultado do Mês: ${formatarBRL(lucro)}`;
    cxLucroMes.style.color = lucro >= 0 ? '#10b981' : '#ef4444';
  }

  // 3. Categorias de Saídas
  const valDasMei = document.getElementById('valDasMei');
  const valFornecedores = document.getElementById('valFornecedores');
  const valOperacionais = document.getElementById('valOperacionais');
  const valProLabore = document.getElementById('valProLabore');
  const valOutrasDesp = document.getElementById('valOutrasDesp');

  if (valDasMei) valDasMei.textContent = formatarBRL(saidas.das_mei);
  if (valFornecedores) valFornecedores.textContent = formatarBRL(saidas.compras_mercadorias);
  if (valOperacionais) valOperacionais.textContent = formatarBRL(saidas.custos_operacionais);
  if (valProLabore) valProLabore.textContent = formatarBRL(saidas.pro_labore);
  if (valOutrasDesp) valOutrasDesp.textContent = formatarBRL(saidas.outros);
  const valTotalDesp = document.getElementById('valTotalDespesasMes');
  if (valTotalDesp) valTotalDesp.textContent = formatarBRL(caixa.saidas || 0);

  // Renderização dinâmica de Novas Despesas Customizadas (criadas na página Dados)
  const saidasList = document.querySelector('.saidas-list');
  if (saidasList) {
    saidasList.querySelectorAll('.saida-item-custom').forEach(el => el.remove());
    const novasDespesas = data.novas_despesas || [];
    novasDespesas.forEach(desp => {
      const item = document.createElement('div');
      item.className = 'saida-item saida-item-custom';
      const cor = desp.cor || '#6366f1';
      const icone = desp.icone || 'fa-tag';
      const natText = desp.natureza === 'variavel' ? 'Custo variável' : 'Gasto fixo';
      const nomeLimpo = String(desp.nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      item.innerHTML = `
        <div class="saida-item-left">
          <div class="saida-icon-box" style="background: ${cor}26; color: ${cor};">
            <i class="fa-solid ${icone}"></i>
          </div>
          <div>
            <div class="saida-name">${nomeLimpo}</div>
            <small style="color: var(--suave); font-size: 0.72rem;">${natText}</small>
          </div>
        </div>
        <div class="saida-val">${formatarBRL(desp.valor || 0)}</div>
      `;
      saidasList.appendChild(item);
    });
  }

  // 4. Tabela Mensal 12 Meses
  const tbodyMeses = document.getElementById('tbodyMeses');
  if (tbodyMeses) {
    tbodyMeses.innerHTML = '';
    const mesFiltroNum = Number(document.getElementById('selMes')?.value || 1);

    meses.forEach(m => {
      const tr = document.createElement('tr');
      if (m.mes_num === mesFiltroNum) tr.classList.add('mes-selecionado');

      const corLucro = m.lucro >= 0 ? '#10b981' : '#ef4444';
      tr.innerHTML = `
        <td><strong>${m.mes_nome}</strong></td>
        <td>${formatarBRL(m.servicos)}</td>
        <td style="color:#10b981; font-weight:700;">${formatarBRL(m.entradas)}</td>
        <td style="color:#ef4444;">${formatarBRL(m.saidas)}</td>
        <td style="color:${corLucro}; font-weight:700;">${formatarBRL(m.lucro)}</td>
        <td style="font-weight:700;">${formatarBRL(m.acumulado_ano)}</td>
      `;
      tbodyMeses.appendChild(tr);
    });
  }

  // 5. Últimas Movimentações
  const tbodyLanc = document.getElementById('tbodyLancamentos');
  if (tbodyLanc) {
    tbodyLanc.innerHTML = '';
    if (lancamentos.length === 0) {
      tbodyLanc.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:var(--suave); padding: 18px;">
            Nenhuma movimentação registrada nesta tabela. Clique em "Novo Lançamento" para cadastrar sua primeira entrada ou saída!
          </td>
        </tr>
      `;
    } else {
      lancamentos.forEach(l => {
        const tr = document.createElement('tr');
        const isEntrada = l.tipo === 'entrada';
        const badgeClass = isEntrada ? 'lancamento-badge-entrada' : 'lancamento-badge-saida';
        const corValor = isEntrada ? '#10b981' : '#ef4444';
        const sinal = isEntrada ? '+ ' : '- ';

        tr.innerHTML = `
          <td>${l.data}</td>
          <td><span class="${badgeClass}">${isEntrada ? 'Entrada' : 'Saída'}</span></td>
          <td>${l.categoria}</td>
          <td>${l.descricao}</td>
          <td style="color:${corValor}; font-weight:700;">${sinal}${formatarBRL(l.valor)}</td>
        `;
        tbodyLanc.appendChild(tr);
      });
    }
  }

  // 6. Dashboard Visual: Gráficos de Recebimentos e Composição de Custos
  renderizarDashboardGraficos(data);
}

// ==============================================================================
// DASHBOARD VISUAL: RECEBIMENTOS & COMPOSIÇÃO DE CUSTOS (MEI)
// ==============================================================================
function alternarPeriodoDashboard(periodo) {
  periodoDashboardAtual = periodo;
  const btnMes = document.getElementById('btnDashPeriodoMes');
  const btnAno = document.getElementById('btnDashPeriodoAno');

  if (btnMes) btnMes.classList.toggle('ativo', periodo === 'mes');
  if (btnAno) btnAno.classList.toggle('ativo', periodo === 'ano');

  if (dadosControlesAtuais) {
    renderizarDashboardGraficos(dadosControlesAtuais);
  }
}

function renderizarDashboardGraficos(data) {
  if (!data) return;
  const dash = data.dashboard_graficos || {};
  const mesNome = data.mes_nome || 'Mês';
  const ano = data.ano || new Date().getFullYear();

  renderizarGraficoRecebimentos(dash.recebimentos || {}, periodoDashboardAtual, mesNome, ano);
  renderizarGraficoCustos(dash.composicao_custos || {}, periodoDashboardAtual, mesNome, ano);
}

function renderizarGraficoRecebimentos(recDados, periodo, mesNome, ano) {
  const container = document.getElementById('graficoRecebimentosPizza');
  const breakdownEl = document.getElementById('breakdownRecebimentos');
  const badgeTotal = document.getElementById('badgeTotalRecebido');
  const subtitulo = document.getElementById('subtituloRecebimentos');

  if (!container) return;

  const isMes = periodo === 'mes';
  const total = isMes ? (recDados.total_mes || 0) : (recDados.total_ano || 0);
  const fatias = isMes ? (recDados.fatias_mes || []) : (recDados.fatias_ano || []);

  if (subtitulo) {
    subtitulo.textContent = isMes
      ? `Distribuição das entradas de ${mesNome} de ${ano}`
      : `Distribuição de todas as entradas do ano ${ano}`;
  }
  if (badgeTotal) badgeTotal.textContent = formatarBRL(total);

  if (chartRecebimentosInstancia) {
    chartRecebimentosInstancia.destroy();
    chartRecebimentosInstancia = null;
  }

  if (total <= 0 || fatias.length === 0) {
    container.innerHTML = `
      <div class="mei-chart-empty">
        <i class="fa-solid fa-coins"></i>
        <span>Nenhum recebimento registrado para este período.</span>
      </div>
    `;
    if (breakdownEl) breakdownEl.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const cores = ['#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#64748b', '#14b8a6'];
  const labels = fatias.map(f => f.nome);
  const series = fatias.map(f => f.valor);
  const fatiasCores = fatias.map((_, i) => cores[i % cores.length]);

  const options = {
    chart: {
      type: 'donut',
      height: 255,
      animations: { enabled: true, speed: 600 },
      background: 'transparent',
      fontFamily: 'inherit'
    },
    series: series,
    labels: labels,
    colors: fatiasCores,
    stroke: {
      width: 2,
      colors: [isDarkMode() ? '#1e293b' : '#ffffff']
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    tooltip: {
      theme: isDarkMode() ? 'dark' : 'light',
      y: {
        formatter: (val) => `${formatarBRL(val)} (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--suave)',
              offsetY: -4
            },
            value: {
              show: true,
              fontSize: '15px',
              fontWeight: 800,
              color: 'var(--texto)',
              offsetY: 4,
              formatter: (val) => formatarBRL(val)
            },
            total: {
              show: true,
              label: 'Total Recebido',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--suave)',
              formatter: () => formatarBRL(total)
            }
          }
        }
      }
    }
  };

  chartRecebimentosInstancia = new ApexCharts(container, options);
  chartRecebimentosInstancia.render();

  // Preencher breakdown list
  if (breakdownEl) {
    breakdownEl.innerHTML = fatias.map((item, idx) => {
      const cor = fatiasCores[idx];
      return `
        <div class="mei-breakdown-item">
          <div class="mei-breakdown-item-left">
            <span class="mei-breakdown-dot" style="background: ${cor};"></span>
            <span class="mei-breakdown-name" title="${item.nome}">${item.nome}</span>
          </div>
          <div class="mei-breakdown-item-right">
            <span class="mei-breakdown-val">${formatarBRL(item.valor)}</span>
            <span class="mei-breakdown-pct" style="color: ${cor}; background: ${cor}18;">${item.percentual}%</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

function renderizarGraficoCustos(custosDados, periodo, mesNome, ano) {
  const container = document.getElementById('graficoCustosFixoVariavel');
  const badgeTotal = document.getElementById('badgeTotalCustos');
  const subtitulo = document.getElementById('subtituloCustos');

  const valFixo = document.getElementById('valCustoFixoTotal');
  const valVar = document.getElementById('valCustoVarTotal');
  const tagFixo = document.getElementById('tagPctFixo');
  const tagVar = document.getElementById('tagPctVar');

  const barFixo = document.getElementById('barRatioFixo');
  const barVar = document.getElementById('barRatioVar');
  const labelFixo = document.getElementById('labelRatioFixo');
  const labelVar = document.getElementById('labelRatioVar');

  const itensFixoEl = document.getElementById('itensCustoFixo');
  const itensVarEl = document.getElementById('itensCustoVar');

  if (!container) return;

  const isMes = periodo === 'mes';
  const cFixo = isMes ? (custosDados.custo_fixo_total || 0) : (custosDados.ano_custo_fixo || 0);
  const cVar = isMes ? (custosDados.custo_variavel_total || 0) : (custosDados.ano_custo_variavel || 0);
  const total = isMes ? (custosDados.custo_total || 0) : (custosDados.ano_custo_total || 0);
  const pFixo = isMes ? (custosDados.pct_fixo || 0) : (custosDados.ano_pct_fixo || 0);
  const pVar = isMes ? (custosDados.pct_variavel || 0) : (custosDados.ano_pct_variavel || 0);
  const detFixo = isMes ? (custosDados.detalhes_fixo || []) : (custosDados.ano_detalhes_fixo || []);
  const detVar = isMes ? (custosDados.detalhes_variavel || []) : (custosDados.ano_detalhes_variavel || []);

  if (subtitulo) {
    subtitulo.textContent = isMes
      ? `Análise da estrutura de custos em ${mesNome} de ${ano}`
      : `Análise da estrutura de custos acumulada em ${ano}`;
  }
  if (badgeTotal) badgeTotal.textContent = formatarBRL(total);

  if (valFixo) valFixo.textContent = formatarBRL(cFixo);
  if (valVar) valVar.textContent = formatarBRL(cVar);
  if (tagFixo) tagFixo.textContent = `${pFixo}%`;
  if (tagVar) tagVar.textContent = `${pVar}%`;

  if (labelFixo) labelFixo.innerHTML = `Fixos: ${pFixo}% (${formatarBRL(cFixo)})`;
  if (labelVar) labelVar.innerHTML = `Variáveis: ${pVar}% (${formatarBRL(cVar)})`;

  if (barFixo) barFixo.style.width = total > 0 ? `${pFixo}%` : '50%';
  if (barVar) barVar.style.width = total > 0 ? `${pVar}%` : '50%';

  // Preencher mini-itens
  if (itensFixoEl) {
    if (detFixo.length > 0) {
      itensFixoEl.innerHTML = detFixo.slice(0, 3).map(item => `
        <span>• ${item.nome}: <strong>${formatarBRL(item.valor)}</strong> (${item.percentual}%)</span>
      `).join('');
    } else {
      itensFixoEl.innerHTML = '<span>• DAS-MEI, Pró-labore, Operacionais</span>';
    }
  }

  if (itensVarEl) {
    if (detVar.length > 0) {
      itensVarEl.innerHTML = detVar.slice(0, 3).map(item => `
        <span>• ${item.nome}: <strong>${formatarBRL(item.valor)}</strong> (${item.percentual}%)</span>
      `).join('');
    } else {
      itensVarEl.innerHTML = '<span>• Fornecedores, Mercadorias, Insumos</span>';
    }
  }

  if (chartCustosInstancia) {
    chartCustosInstancia.destroy();
    chartCustosInstancia = null;
  }

  if (total <= 0) {
    container.innerHTML = `
      <div class="mei-chart-empty">
        <i class="fa-solid fa-receipt"></i>
        <span>Nenhum custo registrado para este período.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  const options = {
    chart: {
      type: 'donut',
      height: 255,
      animations: { enabled: true, speed: 600 },
      background: 'transparent',
      fontFamily: 'inherit'
    },
    series: [cFixo, cVar],
    labels: ['Custos Fixos', 'Custos Variáveis'],
    colors: ['#3b82f6', '#f59e0b'],
    stroke: {
      width: 2,
      colors: [isDarkMode() ? '#1e293b' : '#ffffff']
    },
    dataLabels: {
      enabled: false
    },
    legend: {
      show: false
    },
    tooltip: {
      theme: isDarkMode() ? 'dark' : 'light',
      y: {
        formatter: (val) => `${formatarBRL(val)} (${total > 0 ? ((val / total) * 100).toFixed(1) : 0}%)`
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '68%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--suave)',
              offsetY: -4
            },
            value: {
              show: true,
              fontSize: '15px',
              fontWeight: 800,
              color: 'var(--texto)',
              offsetY: 4,
              formatter: (val) => formatarBRL(val)
            },
            total: {
              show: true,
              label: 'Total Custos',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--suave)',
              formatter: () => formatarBRL(total)
            }
          }
        }
      }
    }
  };

  chartCustosInstancia = new ApexCharts(container, options);
  chartCustosInstancia.render();
}

// =================== MODAL DE LANÇAMENTO RÁPIDO ===================
function abrirModalLancamento() {
  const modal = document.getElementById('modalLancamentoRapido');
  const selDestino = document.getElementById('lancTabelaDestino');
  if (selDestino && tabelaAtualId && tabelaAtualId !== 'todas') {
    selDestino.value = tabelaAtualId;
  }
  if (modal) modal.classList.add('ativo');
}

function fecharModalLancamento() {
  const modal = document.getElementById('modalLancamentoRapido');
  if (modal) modal.classList.remove('ativo');
}

function selecionarTipoLancamento(tipo) {
  const btnEntrada = document.getElementById('btnTipoEntrada');
  const btnSaida = document.getElementById('btnTipoSaida');
  const inputTipo = document.getElementById('lancTipo');
  const selSubtipo = document.getElementById('lancSubtipo');

  if (tipo === 'entrada') {
    inputTipo.value = 'entrada';
    btnEntrada.className = 'modal-tipo-btn active-entrada';
    btnSaida.className = 'modal-tipo-btn';

    selSubtipo.innerHTML = `
      <option value="servico">Prestação de Serviços</option>
      <option value="comercio" selected>Venda de Mercadorias / Produtos</option>
    `;
  } else {
    inputTipo.value = 'saida';
    btnEntrada.className = 'modal-tipo-btn';
    btnSaida.className = 'modal-tipo-btn active-saida';

    let customOptionsHtml = '';
    if (dadosControlesAtuais && Array.isArray(dadosControlesAtuais.novas_despesas)) {
      dadosControlesAtuais.novas_despesas.forEach(d => {
        const nomeEsc = String(d.nome || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        customOptionsHtml += `<option value="${d.id}">${nomeEsc}</option>`;
      });
    }

    selSubtipo.innerHTML = `
      <option value="das_mei">Boleto DAS-MEI (Tributo)</option>
      <option value="compras_mercadorias" selected>Fornecedores / Compras de Mercadorias</option>
      <option value="custos_operacionais">Custos Operacionais (Luz, Internet, Ferramentas)</option>
      <option value="pro_labore">Pró-labore / Retirada Pessoal</option>
      <option value="outro">Outras Despesas</option>
      ${customOptionsHtml}
    `;
  }
}

async function salvarLancamentoRapido(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSalvarLanc');
  const tipo = document.getElementById('lancTipo').value;
  const subtipo = document.getElementById('lancSubtipo').value;
  const descricao = document.getElementById('lancDescricao').value;
  const valor = document.getElementById('lancValor').value;
  const data = document.getElementById('lancData').value;
  const tabelaDestino = document.getElementById('lancTabelaDestino')?.value;

  const targetTabelaId = (tabelaDestino && tabelaDestino !== 'padrao')
    ? tabelaDestino
    : (tabelaAtualId !== 'todas' ? tabelaAtualId : null);

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

  try {
    const res = await fetch('/api/controles-essenciais/lancamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: tipo,
        sub_tipo: subtipo,
        descricao: descricao,
        valor: valor,
        data: data,
        tabela_id: targetTabelaId
      })
    });

    const respData = await res.json();
    if (respData.sucesso) {
      fecharModalLancamento();
      // Limpar formulário
      document.getElementById('lancDescricao').value = '';
      document.getElementById('lancValor').value = '';
      // Recarregar dados da tela
      await carregarControlesEssenciais();
    } else {
      alert(respData.mensagem || "Erro ao registrar lançamento.");
    }
  } catch (err) {
    console.error("Erro ao salvar lançamento:", err);
    alert("Falha de comunicação ao registrar movimentação.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Lançamento';
  }
}

// =================== CONTEXTO IA PARA O MEI ===================
function coletarContextoIaControlesEssenciais() {
  const seletor = document.getElementById('seletorPlanilhaCE');
  const nomeTabela = (seletor && seletor.options && seletor.selectedIndex >= 0)
    ? seletor.options[seletor.selectedIndex].text
    : 'Visão Geral';

  if (!dadosControlesAtuais) {
    return {
      perfil: "MEI",
      faturamento_ano: "R$ 0,00",
      teto_mei: "R$ 81.000,00",
      percentual_teto: "0.0%",
      entradas_mes: "R$ 0,00",
      saidas_mes: "R$ 0,00",
      lucro_mes: "R$ 0,00",
      saldo_atual: "R$ 0,00",
      periodo: "Mês Selecionado",
      origem_dados: nomeTabela,
      tabela_id: tabelaAtualId
    };
  }

  const d = dadosControlesAtuais;
  return {
    perfil: "MEI",
    faturamento_ano: formatarBRL(d.teto_mei?.faturado_ano),
    teto_mei: formatarBRL(d.teto_mei?.limite_anual),
    percentual_teto: `${d.teto_mei?.percentual_usado}%`,
    status_teto: d.teto_mei?.status,
    entradas_mes: formatarBRL(d.caixa?.entradas),
    saidas_mes: formatarBRL(d.caixa?.saidas),
    lucro_mes: formatarBRL(d.caixa?.lucro_periodo),
    saldo_atual: formatarBRL(d.caixa?.saldo_atual),
    das_pago: formatarBRL(d.categorias_saida?.das_mei),
    periodo: `${d.mes_nome} de ${d.ano}`,
    origem_dados: nomeTabela,
    tabela_id: tabelaAtualId
  };
}

function abrirIaMei() {
  if (window.IaAnaliseModal) {
    window.IaAnaliseModal.abrir('controles_essenciais', coletarContextoIaControlesEssenciais);
  }
}
