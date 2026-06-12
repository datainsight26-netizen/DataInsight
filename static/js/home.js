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

// ======================
// INIT
// ======================
document.addEventListener('DOMContentLoaded', () => {
  configurarPeriodo();
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
// GRÁFICOS
// ======================
function atualizarGraficos(data) {
  renderGraficoLinha(data.grafico_linha);
  renderGraficoBarras(data.grafico_barras);
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

// ======================
// COR DINÂMICA DO TEMA
// ======================
function getCorTexto() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--texto')
    .trim();
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