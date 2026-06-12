

let chartInstance = null;
let dadosAtualGrafico = null;

// =============================
// FORMATAÇÃO
// =============================
function formatarMoeda(valor) {
    if (typeof valor !== 'number') valor = parseFloat(valor) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(valor);
}

function formatarData(dataStr) {
    if (!dataStr) return '';
    const partes = dataStr.split('-');
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarVariacao(valor) {
    const sinal = valor >= 0 ? '↑ ' : '↓ ';
    return sinal + Math.abs(valor).toFixed(1) + '%';
}

// =============================
// TEMA
// =============================
function isDarkMode() {
    return document.body.classList.contains('tema-escuro');
}

function getThemeColors() {
    const isDark = isDarkMode();
    return {
        faturamento: isDark ? '#60a5fa' : '#3b82f6',
        despesas: isDark ? '#ef5350' : '#dc2626',
        lucro: isDark ? '#4ade80' : '#16a34a',
        margem: isDark ? '#fbbf24' : '#d97706'
    };
}

// =============================
// SALVAR/RESTAURAR MÉTRICAS
// =============================
function salvarMetricasSelecionadas() {
    const metricas = {
        faturamento: document.getElementById('check-faturamento')?.checked || false,
        despesas: document.getElementById('check-despesas')?.checked || false,
        lucro: document.getElementById('check-lucro')?.checked || false,
        margem: document.getElementById('check-margem')?.checked || false
    };
    localStorage.setItem('analise_metricas', JSON.stringify(metricas));
}

function restaurarMetricasSelecionadas() {
    const salvo = localStorage.getItem('analise_metricas');
    if (!salvo) return;

    const metricas = JSON.parse(salvo);
    if (metricas.faturamento) document.getElementById('check-faturamento').checked = true;
    if (metricas.despesas) document.getElementById('check-despesas').checked = true;
    if (metricas.lucro) document.getElementById('check-lucro').checked = true;
    if (metricas.margem) document.getElementById('check-margem').checked = true;

    // Atualizar estilos
    atualizarEstilosMetricas();
}

function atualizarEstilosMetricas() {
    const metricas = ['faturamento', 'despesas', 'lucro', 'margem'];
    metricas.forEach(metrica => {
        const checkbox = document.getElementById(`check-${metrica}`);
        const elemento = checkbox?.closest('.cartao');
        if (elemento) {
            elemento.style.borderLeft = checkbox.checked ? '4px solid var(--primaria)' : 'none';
            elemento.style.background = checkbox.checked ? 'rgba(59,130,246,0.05)' : 'transparent';
        }
    });
}

// =============================
// GRÁFICO
// =============================
function selecionarMetrica(elemento) {
    const checkbox = elemento.querySelector('.metrica-checkbox');
    checkbox.checked = !checkbox.checked;

    elemento.style.borderLeft = checkbox.checked ? '4px solid var(--primaria)' : 'none';
    elemento.style.background = checkbox.checked ? 'rgba(59,130,246,0.05)' : 'transparent';

    salvarMetricasSelecionadas();
    atualizarGrafico();
}

function atualizarGrafico() {
    if (!dadosAtualGrafico || !dadosAtualGrafico.labels) {
        const container = document.getElementById('grafico-metricas');
        if (container) {
            container.innerHTML = '<div style="text-align:center;padding:80px;color:#999">Selecione um período para visualizar</div>';
        }
        return;
    }

    const series = [];

    if (document.getElementById('check-faturamento')?.checked) {
        series.push({ 
            name: 'Faturamento', 
            data: dadosAtualGrafico.series.find(s => s.name === 'Faturamento')?.data || [] 
        });
    }

    if (document.getElementById('check-despesas')?.checked) {
        series.push({ 
            name: 'Despesas', 
            data: dadosAtualGrafico.series.find(s => s.name === 'Despesas')?.data || [] 
        });
    }

    if (document.getElementById('check-lucro')?.checked) {
        series.push({ 
            name: 'Lucro', 
            data: dadosAtualGrafico.series.find(s => s.name === 'Lucro')?.data || [] 
        });
    }

    const container = document.getElementById('grafico-metricas');

    if (!container) return;

    if (series.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:80px;color:#999">
            Selecione uma métrica
        </div>`;
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        return;
    }

    if (chartInstance) chartInstance.destroy();
    container.innerHTML = '';

    chartInstance = new ApexCharts(container, {
        chart: { 
            type: 'line', 
            height: 400,
            fontFamily: 'inherit',
            foreColor: getThemeColors().suave,
            toolbar: { show: true }
        },
        series,
        xaxis: { 
            categories: dadosAtualGrafico.labels,
            labels: { 
                style: { colors: getThemeColors().suave },
                formatter: function(value) {
                    // Exibir data em ISO (YYYY-MM-DD)
                    return value;
                }
            }
        },
        yaxis: {
            labels: {
                formatter: formatarMoeda,
                style: { colors: getThemeColors().suave }
            }
        },
        colors: [
            getThemeColors().faturamento,
            getThemeColors().despesas,
            getThemeColors().lucro,
            getThemeColors().margem
        ],
        stroke: { curve: 'smooth', width: 2 },
        tooltip: {
            theme: isDarkMode() ? 'dark' : 'light',
            y: { formatter: formatarMoeda },
            x: {
                formatter: function(val) {
                    // Mostrar data ISO no tooltip
                    return `Data: ${val}`;
                }
            }
        },
        legend: {
            position: 'top',
            labels: { colors: getThemeColors().suave }
        }
    });

    chartInstance.render();
}

// =============================
// FILTROS
// =============================
function aplicarFiltros() {
    const inicio = document.getElementById('data-inicio').value;
    const fim = document.getElementById('data-fim').value;

    if (!inicio || !fim) {
        alert('Selecione as datas!');
        return;
    }

    if (inicio > fim) {
        alert('Data inválida!');
        return;
    }

    localStorage.setItem('analise_periodo', JSON.stringify({ inicio, fim }));

    fetch(`/api/analise?data_inicio=${inicio}&data_fim=${fim}`)
        .then(r => {
            if (!r.ok) {
                return r.json().then(err => {
                    throw new Error(err.mensagem || 'Erro na API');
                });
            }
            return r.json();
        })
        .then(data => {
            console.log("API:", data);
            dadosAtualGrafico = data.grafico;
            preencherCards(data);
            preencherTabela(data);
            atualizarGrafico();
        })
        .catch(err => {
            console.error(err);
            alert("Atenção: Nenhum dado carregado");
        });
}

// =============================
// AUTO LOAD
// =============================
function carregarUltimoPeriodo() {
    // Se existe uma análise selecionada da página de perfil, usar ela
    if (window.analise_selecionada && window.analise_selecionada.periodo_inicio) {
        const { periodo_inicio, periodo_fim } = window.analise_selecionada;
        setPeriodoEAplicar(periodo_inicio, periodo_fim);
        // Limpar depois de usar para não interferir com novas análises
        window.analise_selecionada = null;
        return;
    }

    fetch('/api/ultimo-periodo')
        .then(r => r.json())
        .then(data => {
            if (data.inicio && data.fim) {
                setPeriodoEAplicar(data.inicio, data.fim);
            } else {
                carregarLocalStorage();
            }
        })
        .catch(() => carregarLocalStorage());
}

function carregarLocalStorage() {
    const salvo = localStorage.getItem('analise_periodo');
    if (!salvo) return;

    const { inicio, fim } = JSON.parse(salvo);
    setPeriodoEAplicar(inicio, fim);
}

function setPeriodoEAplicar(inicio, fim) {
    document.getElementById('data-inicio').value = inicio;
    document.getElementById('data-fim').value = fim;
    
    // Se não há métricas salvas, usar padrão (faturamento e lucro)
    if (!localStorage.getItem('analise_metricas')) {
        document.getElementById('check-faturamento').checked = true;
        document.getElementById('check-lucro').checked = true;
        salvarMetricasSelecionadas();
        atualizarEstilosMetricas();
    }
    
    aplicarFiltros();
}

// =============================
// UI
// =============================
function preencherCards(data) {

    // ======================
    // FATURAMENTO
    // ======================
    document.getElementById('fat-valor').textContent =
        formatarMoeda(data.faturamento.valor);

    const fatVar = document.getElementById('fat-variacao');
    fatVar.textContent = formatarVariacao(data.faturamento.variacao);
    fatVar.style.color =
        data.faturamento.variacao >= 0 ? '#16a34a' : '#dc2626';


    // ======================
    // DESPESAS
    // ======================
    document.getElementById('desp-valor').textContent =
        formatarMoeda(data.despesa.valor);

    const despVar = document.getElementById('desp-variacao');
    despVar.textContent = formatarVariacao(data.despesa.variacao);
    despVar.style.color =
        data.despesa.variacao <= 0 ? '#16a34a' : '#dc2626';


    // ======================
    // LUCRO
    // ======================
    document.getElementById('luc-valor').textContent =
        formatarMoeda(data.lucro.valor);

    const lucVar = document.getElementById('luc-variacao');
    lucVar.textContent = formatarVariacao(data.lucro.variacao);
    lucVar.style.color =
        data.lucro.variacao >= 0 ? '#16a34a' : '#dc2626';


    // ======================
    // MARGEM
    // ======================
    document.getElementById('mg-valor').textContent =
        data.margem.valor.toFixed(1) + '%';

    const mgVar = document.getElementById('mg-variacao');
    mgVar.textContent =
        (data.margem.variacao >= 0 ? '↑ ' : '↓ ') +
        Math.abs(data.margem.variacao).toFixed(1) + ' pp';

    mgVar.style.color =
        data.margem.variacao >= 0 ? '#16a34a' : '#dc2626';
}

function preencherTabela(data) {

    document.getElementById('label-periodo-atual').textContent =
        formatarData(data.periodo.inicio) + ' a ' + formatarData(data.periodo.fim);

    document.getElementById('label-periodo-anterior').textContent =
        formatarData(data.periodo.inicio_anterior) + ' a ' + formatarData(data.periodo.fim_anterior);

    // FATURAMENTO
    setLinha('fat', data.faturamento, true);

    // DESPESAS
    setLinha('desp', data.despesa, false);

    // LUCRO
    setLinha('luc', data.lucro, true);

    // MARGEM
    document.getElementById('tab-mg-atual').textContent = data.margem.valor.toFixed(1) + '%';
    document.getElementById('tab-mg-anterior').textContent = data.margem.valor_anterior.toFixed(1) + '%';

    const variacao = data.margem.variacao;
    const el = document.getElementById('tab-mg-variacao');

    el.textContent = (variacao >= 0 ? '↑ ' : '↓ ') + Math.abs(variacao).toFixed(1) + ' pp';
    el.style.color = variacao >= 0 ? '#16a34a' : '#dc2626';
}

// helper para linhas
function setLinha(prefixo, dados, positivoBom) {
    document.getElementById(`tab-${prefixo}-atual`).textContent = formatarMoeda(dados.valor);
    document.getElementById(`tab-${prefixo}-anterior`).textContent = formatarMoeda(dados.valor_anterior);

    const el = document.getElementById(`tab-${prefixo}-variacao`);
    el.textContent = formatarVariacao(dados.variacao);

    const positivo = dados.variacao >= 0;
    el.style.color = (positivo === positivoBom) ? '#16a34a' : '#dc2626';
}

// =============================
// FORMATADORES
// =============================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor || 0);
}

function formatarVariacao(v) {
    const sinal = v >= 0 ? '↑ ' : '↓ ';
    return sinal + Math.abs(v).toFixed(1) + '%';
}

function formatarData(dataStr) {
    if (!dataStr) return '--';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

// =============================
// LIMPAR
// =============================
function limparFiltros() {
    // limpa inputs
    document.getElementById('data-inicio').value = '';
    document.getElementById('data-fim').value = '';

    // limpa localStorage
    localStorage.removeItem('analise_periodo');
    localStorage.removeItem('analise_metricas');

    // limpa dados
    dadosAtualGrafico = null;

    // limpa gráfico
    const grafico = document.getElementById('grafico-metricas');
    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    if (grafico) {
        grafico.innerHTML = 'Selecione um período';
    }

    // limpa checkboxes
    document.getElementById('check-faturamento').checked = false;
    document.getElementById('check-despesas').checked = false;
    document.getElementById('check-lucro').checked = false;
    document.getElementById('check-margem').checked = false;

    atualizarEstilosMetricas();

    // limpa CARDS
    document.getElementById('fat-valor').textContent = '--';
    document.getElementById('desp-valor').textContent = '--';
    document.getElementById('luc-valor').textContent = '--';
    document.getElementById('mg-valor').textContent = '--';

    // limpa variações
    document.getElementById('fat-variacao').textContent = '--';
    document.getElementById('desp-variacao').textContent = '--';
    document.getElementById('luc-variacao').textContent = '--';
    document.getElementById('mg-variacao').textContent = '--';

    // limpa TABELA
    const ids = [
        'tab-fat-atual', 'tab-fat-anterior', 'tab-fat-variacao',
        'tab-desp-atual', 'tab-desp-anterior', 'tab-desp-variacao',
        'tab-luc-atual', 'tab-luc-anterior', 'tab-luc-variacao',
        'tab-mg-atual', 'tab-mg-anterior', 'tab-mg-variacao'
    ];

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '--';
    });

    // limpa labels
    document.getElementById('label-periodo-atual').textContent = 'Período selecionado';
    document.getElementById('label-periodo-anterior').textContent = 'Período anterior';
}

function atualizarGraficoAPI(grafico) {
    dadosAtualGrafico = grafico;
    atualizarGrafico();
}

// Funções auxiliares
function exportarDados() {
    alert('📥 Função de exportação: Será implementada em breve!');
}

function compartilharAnalise() {
    alert('🔗 Compartilhar análise: Será implementada em breve!');
}

// Inicializar quando a página carregar
function iniciarAnalise() {

    if (typeof ApexCharts === 'undefined') {
        setTimeout(iniciarAnalise, 500);
        return;
    }

    if (!document.getElementById('grafico-metricas')) {
        setTimeout(iniciarAnalise, 500);
        return;
    }

    console.log('Sistema pronto');

    restaurarMetricasSelecionadas();
    carregarUltimoPeriodo();
}

document.addEventListener('DOMContentLoaded', iniciarAnalise);

// =============================
// TEMA
// =============================
const originalAlternarTema = window.alternarTema;

window.alternarTema = function () {
    if (originalAlternarTema) originalAlternarTema();
    setTimeout(() => {
        if (chartInstance) {
            chartInstance.updateOptions({
                chart: {
                    foreColor: getThemeColors().suave,
                    toolbar: { show: true }
                },
                xaxis: {
                    labels: { style: { colors: getThemeColors().suave } }
                },
                yaxis: {
                    labels: { style: { colors: getThemeColors().suave } }
                },
                tooltip: {
                    theme: isDarkMode() ? 'dark' : 'light'
                },
                legend: {
                    labels: { colors: getThemeColors().suave }
                }
            });
        }
    }, 100);
};