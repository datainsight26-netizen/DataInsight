// ======================
// CONFIGURAÇÕES
// ======================
const PERIODOS = {
  '7_dias': 'Últimos 7 dias',
  '30_dias': 'Últimos 30 dias',
  '90_dias': 'Últimos 90 dias',
  'ano_atual': 'Este ano'
};

let periodoAtual = '30_dias';
let chartLinha = null;
let chartBarras = null;
let chartProdutosVendas = null;
let chartProdutosLucro = null;

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
  configurarPeriodo();
  renderizarStatusVazio();
  atualizarTudo();
  carregarStatus();
  carregarInsight();
});

// ======================
// CONTROLE DE PERÍODO
// ======================
function configurarPeriodo() {
  const select = document.getElementById('periodo');
  if (!select) return;

  select.value = periodoAtual;

  select.addEventListener('change', e => {
    const valor = e.target.value;
    if (!PERIODOS[valor]) return console.error('Período inválido');

    periodoAtual = valor;
    atualizarTudo();
    carregarStatus();
    carregarInsight();
  });
}

// ======================
// ATUALIZAÇÃO GERAL
// ======================
function atualizarTudo() {
  carregarDados('/api/desempenho', atualizarIndicadores);
  carregarDados('/api/graficos', atualizarGraficos);
  carregarOverviewProdutos();
}

// ======================
// FETCH GENÉRICO
// ======================
function carregarDados(url, callback) {
  fetch(`${url}?periodo=${periodoAtual}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (!data.erro) callback(data);
    })
    .catch(err => console.error(err));
}

// ======================
// INDICADORES
// ======================
function atualizarIndicadores(data) {
  atualizarCard('faturamento', data.faturamento);
  atualizarCard('lucro', data.lucro);
  atualizarCard('despesa', data.despesa, true);

  setTexto('crescimento-valor', `+${data.crescimento.valor.toFixed(1)}%`);

  // Feedback sobre mapeamento
  if (!data.mapeamento_ativo) {
    exibirAlertaMapeamento();
  }
}

function exibirAlertaMapeamento() {
  const container = document.querySelector('.pagina__cabecalho');
  if (!container || document.getElementById('alerta-mapeamento')) return;

  const alerta = document.createElement('div');
  alerta.id = 'alerta-mapeamento';
  alerta.className = 'alerta-premium';
  alerta.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <i class="fa-solid fa-circle-info"></i>
      <span>O sistema está usando detecção automática. Para maior precisão, <strong>configure o mapeamento das suas colunas</strong>.</span>
    </div>
    <a href="/dados" class="alerta-premium__botao">Configurar Agora</a>
  `;
  container.appendChild(alerta);
}

function atualizarCard(nome, dados, inverter = false) {
  setTexto(`${nome}-valor`, formatarMoeda(dados.valor));

  const percentual = inverter ? Math.abs(dados.percentual) : dados.percentual;
  const positivo = inverter ? dados.percentual <= 0 : dados.percentual >= 0;

  const sinal = positivo ? '↑' : '↓';
  const cor = positivo ? '#10b981' : '#ef4444';

  setTexto(`${nome}-percent`, `${sinal} ${percentual.toFixed(1)}%`, cor);
}

function setTexto(dataId, texto, cor = null) {
  const el = document.querySelector(`[data-indicador="${dataId}"]`);
  if (!el) return;

  el.textContent = texto;
  if (cor) el.style.color = cor;
}

// ======================
// AGUARDAR APEXCHARTS
// ======================
function aguardarApexCharts(callback, tentativas = 0) {
  if (typeof ApexCharts !== 'undefined') {
    callback();
  } else if (tentativas < 30) {
    setTimeout(() => aguardarApexCharts(callback, tentativas + 1), 100);
  } else {
    console.error('ApexCharts não carregou a tempo.');
  }
}

// ======================
// GRÁFICOS
// ======================
function atualizarGraficos(data) {
  aguardarApexCharts(() => {
    renderGraficoLinha(data.grafico_linha);
    renderGraficoBarras(data.grafico_barras);
  });
}

// ======================
// STATUS DO NEGÓCIO
// ======================
function carregarStatus() {
  fetch(`/api/status_negocio?periodo=${periodoAtual}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      if (data.status && data.status !== 'erro') {
        renderizarStatus(data);
      } else {
        renderizarStatusVazio();
      }
    })
    .catch(err => {
      console.error('Erro ao carregar status:', err);
      renderizarStatusVazio();
    });
}

function renderizarStatus(data) {
  const container = document.getElementById('status-negocio-container');
  const section = document.getElementById('status-negocio-section');
  
  if (!container || !section) return;

  // Definir cor da borda e fundo da seção
  let corBorda = '#10b981';
  if (data.status === 'estavel') corBorda = '#f59e0b';
  else if (data.status === 'em_perigo') corBorda = '#ef4444';

  section.style.borderLeftColor = corBorda;

  const html = `
    <p><strong>${data.emoji} ${data.status.charAt(0).toUpperCase() + data.status.slice(1).replace('_', ' ')}:</strong> ${data.descricao}</p>
    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--borda); display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px;">
     
    </div>
  `;
  // const html = `
  //   <p><strong>${data.emoji} ${data.status.charAt(0).toUpperCase() + data.status.slice(1).replace('_', ' ')}:</strong> ${data.descricao}</p>
  //   <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--borda); display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; font-size: 13px;">
  //     <div>
  //       <strong>Faturamento:</strong><br/>
  //       R$ ${formatarMoedaSimples(data.faturamento_valor)}<br/>
  //       <span style="color: ${data.faturamento_percentual >= 0 ? '#10b981' : '#ef4444'};">
  //         ${data.faturamento_percentual >= 0 ? '↑' : '↓'} ${Math.abs(data.faturamento_percentual).toFixed(1)}%
  //       </span>
  //     </div>
  //     <div>
  //       <strong>Lucro:</strong><br/>
  //       R$ ${formatarMoedaSimples(data.lucro_valor)}<br/>
  //       <span style="color: ${data.lucro_percentual >= 0 ? '#10b981' : '#ef4444'};">
  //         ${data.lucro_percentual >= 0 ? '↑' : '↓'} ${Math.abs(data.lucro_percentual).toFixed(1)}%
  //       </span>
  //     </div>
  //     <div>
  //       <strong>Despesas:</strong><br/>
  //       R$ ${formatarMoedaSimples(data.despesa_valor)}<br/>
  //       <span style="font-size: 12px; color: var(--texto-secundario);">${PERIODOS[data.periodo]}</span>
  //     </div>
  //   </div>
  // `;


  container.innerHTML = html;
}

function renderizarStatusVazio() {
  const container = document.getElementById('status-negocio-container');
  const section = document.getElementById('status-negocio-section');
  
  if (!container || !section) return;

  section.style.borderLeftColor = '#9ca3af';
  container.innerHTML = '<p style="color: var(--texto-secundario);">⚪ Sem dados: Carregue seus dados para análise automática do status.</p>';
}

// ======================
// INSIGHT DA IA
// ======================
function carregarInsight() {
  const containerInsights = document.getElementById('container-insights-ia');
  if (!containerInsights) return;

  // Mostrar skeleton de carregamento
  containerInsights.innerHTML = `
    <div class="p-3 rounded" style="background: var(--cartao); animation: pulse 2s infinite;">
      <p class="p mb-0" style="color: var(--texto-secundario);"> A IA está analisando seus dados para gerar o insight do dia...</p>
    </div>
  `;

  fetch(`/api/insight_diario?periodo=${periodoAtual}`)
    .then(response => response.json())
    .then(data => {
      if(data.html) {
        // Remove asteriscos (*) do conteúdo
        let htmlLimpo = data.html.replace(/\*/g, '');
        containerInsights.innerHTML = htmlLimpo;
      } else {
        containerInsights.innerHTML = "<div class='p-3 rounded' style='background: var(--cartao);'><p class='p mb-0'>Não foi possível carregar os insights hoje.</p></div>";
      }
    })
    .catch(error => {
      console.error('Erro ao buscar insight:', error);
      containerInsights.innerHTML = "<div class='p-3 rounded' style='background: var(--cartao);'><p class='p mb-0 text-danger'>Erro de conexão com a IA.</p></div>";
    });
}

function carregarOverviewProdutos() {
  const loading = document.getElementById('produtos-overview-loading');
  const overview = document.getElementById('produtos-overview');
  const meta = document.getElementById('produtos-overview-meta');
  const maisVendido = document.getElementById('produto-mais-vendido');
  const menosVendido = document.getElementById('produto-menos-vendido');
  const maiorLucro = document.getElementById('produto-maior-lucro');
  const maiorDespesa = document.getElementById('produto-maior-despesa');
  const menorDespesa = document.getElementById('produto-menos-despesa');
  const estoqueCritico = document.getElementById('produto-estoque');
  const tabelaBody = document.getElementById('tabela-produtos-body');

  if (!loading || !overview) return;

  loading.style.display = 'grid';
  overview.style.display = 'none';

  fetch(`/api/produtos/overview?periodo=${periodoAtual}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      loading.style.display = 'none';
      overview.style.display = 'block';

      const textoItem = item => {
        if (!item) return '<span style="color: var(--texto-secundario);">Não disponível</span>';
        const vendas = item.quantidade !== undefined ? formatarNumero(item.quantidade) : '—';
        const lucro = item.lucro !== undefined ? formatarMoeda(item.lucro) : '—';
        const despesa = item.despesa !== undefined ? formatarMoeda(item.despesa) : '—';
        const estoque = item.estoque !== undefined && item.estoque !== null ? formatarNumero(item.estoque) : '—';
        return `
          <div class="produto-card__info">
            <strong style="color:var(--texto);">${item.nome}</strong>
            <div class="produto-card__stats">
              <div class="produto-card__stat produto-card__stat--vendas"><span>Vendas</span>${vendas}</div>
              <div class="produto-card__stat produto-card__stat--lucro"><span>Lucro</span>${lucro}</div>
              <div class="produto-card__stat produto-card__stat--despesa"><span>Despesa</span>${despesa}</div>
              <div class="produto-card__stat produto-card__stat--estoque"><span>Estoque</span>${estoque}</div>
            </div>
          </div>
        `;
      };

      maisVendido.innerHTML = textoItem(data.mais_vendido);
      menosVendido.innerHTML = textoItem(data.menos_vendido);
      maiorLucro.innerHTML = textoItem(data.maior_lucro);
      maiorDespesa.innerHTML = textoItem(data.maior_despesa);
      menorDespesa.innerHTML = textoItem(data.menor_despesa);
      estoqueCritico.innerHTML = data.tem_estoque ? textoItem(data.menos_estoque) : '<span style="color: var(--texto-secundario);">Sem dados de estoque</span>';
      if (meta) {
        meta.textContent = `Exibindo ${data.tabela_produtos.length} produtos · coluna de produto: ${data.produto_coluna || 'não detectada'}`;
      }

      if (tabelaBody) {
        if (data.tabela_produtos && data.tabela_produtos.length) {
          tabelaBody.innerHTML = data.tabela_produtos.map(item => `
            <tr>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${item.nome}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${formatarMoeda(item.faturamento)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${formatarMoeda(item.despesa)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${formatarMoeda(item.lucro)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${formatarNumero(item.quantidade)}</td>
              <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${item.estoque !== null && item.estoque !== undefined ? formatarNumero(item.estoque) : '—'}</td>
            </tr>
          `).join('');
        } else {
          tabelaBody.innerHTML = '<tr><td colspan="6" style="padding:18px; text-align:center; color:var(--texto-secundario);">Nenhum produto encontrado para exibir.</td></tr>';
        }
      }

      renderGraficoProdutos('graficoProdutosVendas', data.grafico_vendas, 'Quantidade vendida', '#3b82f6');
      renderGraficoProdutos('graficoProdutosLucro', data.grafico_lucro, 'Lucro', '#10b981');
    })
    .catch(error => {
      console.error('Erro ao carregar overview de produtos:', error);
      loading.style.display = 'none';
      overview.style.display = 'block';
      if (tabelaBody) {
        tabelaBody.innerHTML = '<tr><td colspan="6" style="padding:18px; text-align:center; color:var(--texto-secundario);">Erro ao carregar produtos.</td></tr>';
      }
    });
}

function renderGraficoProdutos(elementId, dados, titulo, cor) {
  aguardarApexCharts(() => {
    const container = document.getElementById(elementId);
    if (!container) return;

    if (!dados?.labels?.length) {
      container.innerHTML = `<div style="padding:28px; color: var(--texto-secundario); text-align:center;">Sem dados suficientes para ${titulo.toLowerCase()}.</div>`;
      return;
    }

    const isQuantidade = elementId === 'graficoProdutosVendas';
    if (isQuantidade) destruir(chartProdutosVendas);
    if (elementId === 'graficoProdutosLucro') destruir(chartProdutosLucro);
    container.innerHTML = '';

    const formatterY = isQuantidade ? formatarNumero : formatarMoeda;
    const tooltipFormatter = isQuantidade
      ? (value) => formatarNumero(value)
      : (value) => formatarMoeda(value);

    const options = {
      chart: { type: 'bar', height: 280, background: 'transparent' },
      series: [{ name: titulo, data: dados.series }],
      colors: [cor],
      plotOptions: { bar: { borderRadius: 8, horizontal: false, columnWidth: '55%' } },
      xaxis: { categories: dados.labels, labels: { style: { colors: getCorTexto() } } },
      yaxis: { labels: { style: { colors: getCorTexto() }, formatter: formatterY } },
      dataLabels: { enabled: false },
      tooltip: { y: { formatter: tooltipFormatter }, theme: document.body.classList.contains('tema-escuro') ? 'dark' : 'light' },
      title: { text: titulo, align: 'center', style: { color: getCorTexto(), fontSize: '13px', fontWeight: '600' } },
      grid: { borderColor: 'rgba(148,163,184,0.15)' },
      legend: { show: false },
      theme: { mode: document.body.classList.contains('tema-escuro') ? 'dark' : 'light' }
    };

    const chart = new ApexCharts(container, options);
    chart.render();

    if (isQuantidade) chartProdutosVendas = chart;
    if (elementId === 'graficoProdutosLucro') chartProdutosLucro = chart;
  });
}

function renderizarStatusVazio() {
  const cards = document.querySelectorAll('[data-kpi]');
  const modalBackdrop = document.getElementById('kpiDetalheModal');

  if (!cards.length || !modalBackdrop) return;

  cards.forEach(card => {
    card.addEventListener('click', () => abrirModalDetalhe(card.dataset.kpi));
    card.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        abrirModalDetalhe(card.dataset.kpi);
      }
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      fecharModalDetalhe();
    }
  });

  modalBackdrop.addEventListener('click', event => {
    if (event.target === modalBackdrop) {
      fecharModalDetalhe();
    }
  });
}

async function abrirModalDetalhe(kpi) {
  const body = document.getElementById('kpiDetalheBody');
  const title = document.getElementById('kpiDetalheTitulo');
  const modal = document.getElementById('kpiDetalheModal');

  if (!body || !title || !modal) return;

  // Mapear títulos legíveis para cada tipo de KPI
  const tituloMap = {
    despesa: 'Despesas',
    lucro: 'Lucro',
    faturamento: 'Faturamento',
    crescimento: 'Crescimento'
  };

  title.textContent = `Detalhes de ${tituloMap[kpi] || 'KPI'}`;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  body.innerHTML = '<p>Carregando detalhes...</p>';

  try {
    const resposta = await fetch(`/api/desempenho/detalhe?kpi=${encodeURIComponent(kpi)}&periodo=${periodoAtual}`);
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    const dados = await resposta.json();
    if (dados.erro) {
      throw new Error(dados.mensagem || 'Erro ao carregar detalhes');
    }

    renderizarDetalhesKpi(dados, kpi);
  } catch (erro) {
    console.error('Erro ao carregar detalhes do KPI:', erro);
    body.innerHTML = `<p style="color:#ef4444;">Não foi possível carregar o detalhamento. ${erro.message}</p>`;
  }
}

function fecharModalDetalhe() {
  const modal = document.getElementById('kpiDetalheModal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
}

function renderizarDetalhesKpi(dados, kpi) {
  const body = document.getElementById('kpiDetalheBody');
  if (!body) return;

  if (!dados.detalhes || !dados.detalhes.length) {
    body.innerHTML = '<p>Não há detalhes disponíveis para este KPI no período selecionado.</p>';
    return;
  }

  const temQuantidade = dados.quantidade_total !== null && dados.quantidade_total !== undefined;
  const labelHeader = dados.label_coluna ? dados.label_coluna : 'Categoria / Item';
  const totalQuantidadeTexto = temQuantidade
    ? `Quantidade total: <strong>${formatarNumero(dados.quantidade_total)}</strong> ${dados.unidade_quantidade ? `(${dados.unidade_quantidade})` : ''}`
    : '';

  const topValor = dados.top_valor
    ? `<div style="margin-bottom:12px; padding:14px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; color:var(--text-primary);">
         <strong>Maior ${kpi === 'despesa' ? 'gasto' : kpi === 'lucro' ? 'lucro' : 'faturamento'}</strong><br/>
         ${dados.top_valor.nome} • ${formatarMoeda(dados.top_valor.valor)}${temQuantidade ? ` • ${formatarNumero(dados.top_valor.quantidade)} ${dados.unidade_quantidade ? dados.unidade_quantidade : ''}` : ''}
       </div>`
    : '';

  const bottomValor = dados.bottom_valor
    ? `<div style="margin-bottom:16px; padding:14px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; color:var(--text-primary);">
         <strong>Menor ${kpi === 'despesa' ? 'gasto' : kpi === 'lucro' ? 'lucro' : 'faturamento'}</strong><br/>
         ${dados.bottom_valor.nome} • ${formatarMoeda(dados.bottom_valor.valor)}${temQuantidade ? ` • ${formatarNumero(dados.bottom_valor.quantidade)} ${dados.unidade_quantidade ? dados.unidade_quantidade : ''}` : ''}
       </div>`
    : '';

  const topQuantidade = dados.top_quantidade
    ? `<div style="margin-bottom:16px; padding:14px; background:#064e3b; border:1px solid #165f46; border-radius:12px; color:#ecfdf5;">
         <strong>Mais vendido</strong><br/>
         ${dados.top_quantidade.nome} • ${formatarNumero(dados.top_quantidade.quantidade)} ${dados.unidade_quantidade ? dados.unidade_quantidade : ''}
       </div>`
    : '';

  const bottomQuantidade = dados.bottom_quantidade
    ? `<div style="margin-bottom:16px; padding:14px; background:#7f1d1d; border:1px solid #991b1b; border-radius:12px; color:#f8fafc;">
         <strong>Menos vendido</strong><br/>
         ${dados.bottom_quantidade.nome} • ${formatarNumero(dados.bottom_quantidade.quantidade)} ${dados.unidade_quantidade ? dados.unidade_quantidade : ''}
       </div>`
    : '';

  const linhas = dados.detalhes.map(item => {
    return `
      <tr>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color);">${item.nome}</td>
        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">R$ ${formatarMoeda(item.valor)}</td>
        ${temQuantidade ? `<td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${formatarNumero(item.quantidade)}</td>` : ''}
        <td style="padding:10px 12px; border-bottom:1px solid var(--border-color); text-align:right;">${item.porcentagem !== undefined ? formatarNumero(item.porcentagem) + '%' : '—'}</td>
      </tr>
    `;
  }).join('');

  body.innerHTML = `
    <div style="margin-bottom:16px; font-size:0.95rem; color:var(--text-secondary);">
      Total do período: <strong>R$ ${formatarMoeda(dados.valor_total)}</strong>
      ${temQuantidade ? `<br/>${totalQuantidadeTexto}` : ''}
    </div>
    ${topValor}
    ${bottomValor}
    ${topQuantidade}
    ${bottomQuantidade}
    <div style="overflow:auto; max-height:330px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:14px; box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04);">
      <table style="width:100%; border-collapse:collapse; font-size:0.95rem;">
        <thead>
          <tr>
            <th style="text-align:left; padding:10px 12px; border-bottom:2px solid var(--border-color); color:var(--text-primary);">${labelHeader}</th>
            <th style="text-align:right; padding:10px 12px; border-bottom:2px solid var(--border-color); color:var(--text-primary);">Valor</th>
            ${temQuantidade ? `<th style="text-align:right; padding:10px 12px; border-bottom:2px solid var(--border-color); color:var(--text-primary);">Quantidade</th>` : ''}
            <th style="text-align:right; padding:10px 12px; border-bottom:2px solid var(--border-color); color:var(--text-primary);">%</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
        </tbody>
      </table>
    </div>
  `;
}

// ======================
// COR DINÂMICA DO TEMA
// ======================
function getCorTexto() {
  const isDark = document.body.classList.contains('tema-escuro');
  if (isDark) return '#cbd5e1';
  const val = getComputedStyle(document.documentElement).getPropertyValue('--texto').trim();
  return val || '#111827';
}

// ======================
// GRÁFICO LINHA
// ======================
function renderGraficoLinha(dados) {
  const container = document.getElementById('graficoLinhaFaturamento');
  if (!container) return;

  if (!dados?.labels?.length) return renderVazio(container, 350);

  const corTexto = getCorTexto();

  destruir(chartLinha);
  container.innerHTML = '';

  chartLinha = new ApexCharts(container, {
    chart: { type: 'line', height: 350 },

    series: dados.series,

    xaxis: {
      categories: dados.labels,
      labels: { 
        style: { colors: corTexto },
        formatter: function(value) {
          // Exibir data em ISO (YYYY-MM-DD)
          return value;
        }
      }
    },

    yaxis: {
      labels: {
        formatter: formatarMoeda,
        style: { colors: corTexto }
      }
    },

    tooltip: { 
      y: { formatter: formatarMoeda },
      x: {
        formatter: function(val) {
          // Mostrar data ISO no tooltip
          return `Data: ${val}`;
        }
      }
    },

    stroke: { curve: 'smooth' },

    title: {
      text: `Faturamento - ${PERIODOS[periodoAtual]}`,
      align: 'center',
      style: {
        color: "grey",
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    legend: {
      labels: { colors: corTexto }
    }
  });

  chartLinha.render();
}

// ======================
// GRÁFICO BARRAS
// ======================
function renderGraficoBarras(dados) {
  const container = document.getElementById('graficoPizzaComparativa');
  if (!container) return;

  if (!dados?.labels?.length) return renderVazio(container, 400);

  const corTexto = getCorTexto();

  destruir(chartBarras);
  container.innerHTML = '';

  chartBarras = new ApexCharts(container, {
    chart: {
      type: 'bar',
      height: 400
    },

    series: dados.series,

    colors: ['#3b82f6', '#ef4444', '#10b981'],

    xaxis: {
      categories: dados.labels,
      labels: { style: { colors: corTexto } }
    },

    yaxis: {
      labels: {
        formatter: formatarMoeda,
        style: { colors: corTexto }
      }
    },

    tooltip: {
      y: { formatter: formatarMoeda }
    },

    dataLabels: {
      enabled: false
    },

    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: '60%'
      }
    },

    title: {
      text: `Comparativo - ${PERIODOS[periodoAtual]}`,
      align: 'center',
      style: {
        color: "grey",
        fontSize: '14px',
        fontWeight: 'bold'
      }
    },

    legend: {
      labels: { colors: corTexto }
    }
  });

  chartBarras.render();
}

// ======================
// UTILIDADES
// ======================
function destruir(chart) {
  if (chart) chart.destroy();
}

function renderVazio(container, altura) {  
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:${altura}px;color:#9ca3af;">
      Sem dados para ${PERIODOS[periodoAtual]}
    </div>
  `;
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

function formatarMoedaSimples(valor) {
  if (valor >= 1e6) return `R$ ${(valor / 1e6).toFixed(1)}M`;
  if (valor >= 1e3) return `R$ ${(valor / 1e3).toFixed(1)}K`;
  return `R$ ${valor.toFixed(0)}`;
}

function formatarNumero(valor) {
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}