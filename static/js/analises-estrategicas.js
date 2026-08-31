/**
 * CENTRO DE ANÁLISE ESTRATÉGICA
 * ====================================
 * JavaScript especializado para a página de análise estratégica
 * Focado em tomada de decisão baseada em dados
 */

class AnalisesEstrategicas {
    constructor() {
        this.cenarioAtual = 'provavel';
        this.metricasSelecionadas = [];
        this.dadosCarregados = false;
        this.graficos = {};
        
        this.inicializar();
    }

    inicializar() {
        console.log('🎯 Inicializando Centro de Análise Estratégica');
        
        // Configurar seletores de planilha
        this.configurarSeletorPlanilha();
        
        // Configurar filtros de período
        this.configurarFiltrosPeriodo();
        
        // Configurar cenários
        this.configurarCenarios();
        
        // Carregar dados iniciais
        this.carregarDadosIniciais();
        
        // Configurar atualização em tempo real
        this.configurarAtualizacaoAutomatica();
    }

    configurarSeletorPlanilha() {
        const seletor = document.getElementById('seletorPlanilhaAnalise');
        if (!seletor) return;

        // Carregar planilhas disponíveis
        fetch('/api/planilhas/sumario')
            .then(res => {
                if (!res.ok) throw new Error('Erro ao carregar planilhas');
                return res.json();
            })
            .then(data => {
                const planilhas = data.planilhas || [];
                
                // Manter opção "todas"
                seletor.innerHTML = '<option value="todas">🌐 Todas as Planilhas (Visão Consolidada)</option>';
                
                // Adicionar planilhas individuais
                planilhas.forEach(planilha => {
                    const opcao = document.createElement('option');
                    opcao.value = planilha.id;
                    opcao.textContent = `📊 ${planilha.nome}`;
                    seletor.appendChild(opcao);
                });
                
                // Carregar valor salvo
                const salvo = localStorage.getItem('DataInsight_AnalisesPlanilha');
                if (salvo) seletor.value = salvo;
            })
            .catch(erro => {
                console.warn('Erro ao carregar planilhas:', erro);
            });

        // Salvar seleção
        seletor.addEventListener('change', () => {
            localStorage.setItem('DataInsight_AnalisesPlanilha', seletor.value);
            this.atualizarDados();
        });
    }

    configurarFiltrosPeriodo() {
        const dataInicio = document.getElementById('data-inicio');
        const dataFim = document.getElementById('data-fim');

        // Definir período padrão (últimos 30 dias)
        const hoje = new Date();
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(hoje.getDate() - 30);

        if (dataInicio && dataFim) {
            dataInicio.value = trintaDiasAtras.toISOString().split('T')[0];
            dataFim.value = hoje.toISOString().split('T')[0];
        }
    }

    configurarCenarios() {
        const botoesCenario = document.querySelectorAll('.cenario-btn');
        
        botoesCenario.forEach(botao => {
            botao.addEventListener('click', () => {
                // Remover active de todos
                botoesCenario.forEach(b => b.classList.remove('is-active'));
                // Adicionar active ao clicado
                botao.classList.add('is-active');
                
                // Atualizar cenário
                this.cenarioAtual = botao.dataset.scenario;
                this.atualizarAnalisePorCenario(this.cenarioAtual);
            });
        });
    }

    atualizarAnalisePorCenario(cenario) {
        console.log('🔄 Atualizando análise para cenário:', scenario);
        
        // Atualizar projeções baseadas no cenário
        this.atualizarProjecoes(cenario);
        
        // Atualizar alertas baseados no cenário
        this.atualizarAlertas(cenario);
        
        // Atualizar saúde do negócio
        this.atualizarSaudeNegocio(cenario);
        
        // Atualizar recomendações
        this.atualizarRecomendacoes(cenario);
    }

    async carregarDadosIniciais() {
        console.log('📊 Carregando dados iniciais do backend...');
        
        try {
            const response = await fetch('/api/analise-estrategica');
            if (!response.ok) throw new Error('Erro ao carregar dados');
            
            const dados = await response.json();
            console.log('✅ Dados carregados:', dados);
            
            this.processarDadosReais(dados);
        } catch (erro) {
            console.error('❌ Erro ao carregar dados:', erro);
            // Fallback para dados simulados em caso de erro
            this.atualizarSaudeNegocio();
            this.atualizarGraficosTendencias();
            this.atualizarMetas();
        }
    }

    processarDadosReais(dados) {
        if (!dados.sucesso) {
            console.warn('Dados não disponíveis:', dados.erro);
            return;
        }

        // Atualizar saúde do negócio com dados reais
        this.atualizarSaudeNegocioComDados(dados.saude);
        
        // Atualizar alertas com dados reais
        this.atualizarAlertasComDados(dados.alertas);
        
        // Atualizar recomendações com dados reais
        this.atualizarRecomendacoesComDados(dados.recomendacoes);
        
        // Atualizar métricas detalhadas
        this.atualizarMetricasComDados(dados.metricas, dados.comparacao);
        
        // Atualizar gráficos com dados reais
        this.atualizarGraficosComDados(dados.series, dados.cenarios);
        
        // Atualizar comparação com metas (se disponível)
        if (dados.metas) {
            this.atualizarMetasComDados(dados.metas);
        }
    }

    async atualizarDados() {
        console.log('🔄 Atualizando dados do backend...');
        
        // Carregar dados do período selecionado
        const periodo = {
            inicio: document.getElementById('data-inicio')?.value,
            fim: document.getElementById('data-fim')?.value,
            origem: document.getElementById('seletorPlanilhaAnalise')?.value,
            cenario: this.cenarioAtual
        };

        try {
            // Construir URL com parâmetros
            const params = new URLSearchParams();
            if (periodo.inicio) params.append('data_inicio', periodo.inicio);
            if (periodo.fim) params.append('data_fim', periodo.fim);
            if (periodo.origem && periodo.origem !== 'todas') params.append('planilha_id', periodo.origem);
            params.append('cenario', periodo.cenario);

            const response = await fetch(`/api/analise-estrategica?${params.toString()}`);
            if (!response.ok) throw new Error('Erro ao atualizar dados');
            
            const dados = await response.json();
            console.log('✅ Dados atualizados:', dados);
            
            this.processarDadosReais(dados);
        } catch (erro) {
            console.error('❌ Erro ao atualizar dados:', erro);
        }
    }

    atualizarSaudeNegocio(cenario = this.cenarioAtual) {
        // Atualização é feita via atualizarSaudeNegocioComDados quando dados reais estão disponíveis
        console.log('🩺 Saúde do negócio será atualizada com dados do backend');
    }

    atualizarItensSaude(cenario) {
        // Atualização é feita via atualizarSaudeNegocioComDados quando dados reais estão disponíveis
        console.log('🩺 Itens de saúde serão atualizados com dados do backend');
    }

    atualizarAlertas(cenario) {
        // Atualização é feita via atualizarAlertasComDados quando dados reais estão disponíveis
        console.log('🚨 Alertas serão atualizados com dados do backend');
    }

    atualizarRecomendacoes(cenario) {
        // Atualização é feita via atualizarRecomendacoesComDados quando dados reais estão disponíveis
        console.log('💡 Recomendações serão atualizadas com dados do backend');
    }

    atualizarProjecoes(cenario) {
        // Atualização é feita via atualizarGraficosComDados quando dados reais estão disponíveis
        console.log('📈 Projeções serão atualizadas com dados do backend');
    }

    atualizarGraficosTendencias() {
        // Gráficos são atualizados via atualizarGraficosComDados quando dados reais estão disponíveis
        console.log('📈 Gráficos serão atualizados com dados do backend');
    }

    atualizarMetas() {
        // Implementar atualização de metas com dados reais
        // Por enquanto mantém a versão estática
        console.log('🎯 Atualizando metas...');
    }

    atualizarMetricasDetalhadas() {
        // Atualizar métricas tradicionais
        // Em produção, isso viria da API
        console.log('📊 Atualizando métricas detalhadas...');
    }

    atualizarSaudeNegocioComDados(saude) {
        const scoreElement = document.getElementById('saudeScore');
        if (!scoreElement || !saude) return;

        const score = saude.score || 0;
        scoreElement.textContent = score;
        
        // Atualizar classe baseada no score
        scoreElement.className = 'saude-score-circle';
        if (score >= 80) {
            scoreElement.classList.add('excelente');
        } else if (score >= 60) {
            scoreElement.classList.add('bom');
        } else if (score >= 40) {
            scoreElement.classList.add('atencao');
        } else {
            scoreElement.classList.add('critico');
        }

        // Atualizar itens de saúde com dados reais
        const indicadores = saude.indicadores || {};
        const itensSaude = document.querySelectorAll('.saude-item-content');
        
        if (itensSaude.length >= 4 && indicadores) {
            if (indicadores.crescimento_receita !== undefined) {
                itensSaude[0].querySelector('.saude-item-value').textContent = 
                    `${indicadores.crescimento_receita >= 0 ? '+' : ''}${indicadores.crescimento_receita}%`;
            }
            if (indicadores.margem !== undefined) {
                itensSaude[1].querySelector('.saude-item-value').textContent = 
                    `${indicadores.margem}%`;
            }
            if (indicadores.fluxo_caixa !== undefined) {
                itensSaude[2].querySelector('.saude-item-value').textContent = 
                    `Positivo: R$ ${indicadores.fluxo_caixa.toLocaleString('pt-BR')}`;
            }
            if (indicadores.controle_despesas !== undefined) {
                itensSaude[3].querySelector('.saude-item-value').textContent = 
                    `Índice: ${indicadores.controle_despesas}`;
            }
        }
    }

    atualizarAlertasComDados(alertas) {
        const alertasSection = document.querySelector('.alertas-section');
        if (!alertasSection || !alertas) return;

        let alertasHTML = '';

        alertas.forEach(alerta => {
            const tipoClasses = {
                'critico': 'critico',
                'atencao': 'atencao', 
                'info': 'info',
                'sucesso': 'sucesso'
            };

            const iconClasses = {
                'critico': 'fa-triangle-exclamation',
                'atencao': 'fa-clock',
                'info': 'fa-lightbulb',
                'sucesso': 'fa-arrow-trend-up'
            };

            const tipo = tipoClasses[alerta.tipo] || 'info';
            const icon = iconClasses[alerta.tipo] || 'fa-info-circle';

            alertasHTML += `
                <div class="alerta-card ${tipo}">
                    <div class="alerta-icon" style="background: color-mix(in srgb, var(--${tipo === 'critico' ? 'perigo' : tipo === 'sucesso' ? 'sucesso' : tipo === 'atencao' ? 'warning' : 'primaria'} 12%, transparent); color: var(--${tipo === 'critico' ? 'perigo' : tipo === 'sucesso' ? 'sucesso' : tipo === 'atencao' ? 'warning' : 'primaria'});">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="alerta-content">
                        <div class="alerta-titulo">${alerta.titulo}</div>
                        <div class="alerta-descricao">${alerta.descricao}</div>
                        <button class="alerta-acao">${alerta.acao}</button>
                    </div>
                </div>
            `;
        });

        if (alertas.length === 0) {
            alertasHTML = `
                <div class="alerta-card sucesso">
                    <div class="alerta-icon" style="background: color-mix(in srgb, var(--sucesso) 12%, transparent); color: var(--sucesso);">
                        <i class="fa-solid fa-check-circle"></i>
                    </div>
                    <div class="alerta-content">
                        <div class="alerta-titulo">Tudo Certo!</div>
                        <div class="alerta-descricao">Nenhum alerta crítico identificado no período atual.</div>
                    </div>
                </div>
            `;
        }

        alertasSection.innerHTML = alertasHTML;
    }

    atualizarRecomendacoesComDados(recomendacoes) {
        const recomendacoesGrid = document.querySelector('.recomendacoes-grid');
        if (!recomendacoesGrid || !recomendacoes) return;

        let recomendacoesHTML = '';

        recomendacoes.forEach(rec => {
            const prioridadeClasses = {
                'alta': 'alta',
                'media': 'media',
                'baixa': 'baixa'
            };

            const prioridade = prioridadeClasses[rec.prioridade] || 'media';
            const cor = rec.cor || '#3b82f6';

            recomendacoesHTML += `
                <div class="recomendacao-card" style="--rec-cor: ${cor};">
                    <div class="recomendacao-prioridade ${prioridade}">${rec.prioridade.charAt(0).toUpperCase() + rec.prioridade.slice(1)} Prioridade</div>
                    <div class="recomendacao-icon">
                        <i class="fa-solid fa-lightbulb"></i>
                    </div>
                    <div class="recomendacao-titulo">${rec.titulo}</div>
                    <div class="recomendacao-descricao">${rec.descricao}</div>
                    <div class="recomendacao-impacto">
                        <i class="fa-solid fa-chart-line"></i> Impacto: ${rec.impacto}
                    </div>
                </div>
            `;
        });

        if (recomendacoes.length === 0) {
            recomendacoesHTML = `
                <div class="recomendacao-card" style="--rec-cor: #10b981;">
                    <div class="recomendacao-prioridade baixa">Sem Ações</div>
                    <div class="recomendacao-icon">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <div class="recomendacao-titulo">Nenhuma Ação Necessária</div>
                    <div class="recomendacao-descricao">Seus indicadores estão saudáveis. Continue monitorando.</div>
                    <div class="recomendacao-impacto">
                        <i class="fa-solid fa-chart-line"></i> Mantenha desempenho
                    </div>
                </div>
            `;
        }

        recomendacoesGrid.innerHTML = recomendacoesHTML;
    }

    atualizarMetricasComDados(metricas, comparacao) {
        if (!metricas) return;

        // Atualizar KPIs principais
        const elementos = {
            'fat-valor': metricas.faturamento,
            'desp-valor': metricas.despesas,
            'luc-valor': metricas.lucro,
            'mg-valor': metricas.margem
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                if (id === 'mg-valor') {
                    elemento.textContent = `${valor}%`;
                } else {
                    elemento.textContent = `R$ ${valor.toLocaleString('pt-BR')}`;
                }
            }
        });

        // Atualizar variações
        if (comparacao) {
            const variacoes = {
                'fat-variacao': comparacao.variacao_faturamento,
                'luc-variacao': comparacao.variacao_lucro
            };

            Object.entries(variacoes).forEach(([id, valor]) => {
                const elemento = document.getElementById(id);
                if (elemento) {
                    const sinal = valor >= 0 ? '+' : '';
                    elemento.textContent = `${sinal}${valor}%`;
                    elemento.style.color = valor >= 0 ? 'var(--sucesso)' : 'var(--perigo)';
                }
            });
        }
    }

    atualizarGraficosComDados(series, cenarios) {
        // Atualizar gráficos com dados reais
        if (series && series.faturamento && series.faturamento.length > 0) {
            this.atualizarGraficoPrevisaoComDados(series, cenarios);
        }
        
        if (series && series.faturamento && series.faturamento.length > 0) {
            this.atualizarGraficoSazonalidadeComDados(series.faturamento);
        }
    }

    atualizarGraficoPrevisaoComDados(series, cenarios) {
        const container = document.getElementById('graficoPrevisaoFaturamento');
        if (!container || !series || !cenarios) return;

        // Destruir gráfico anterior se existir
        if (this.graficos.previsaoFaturamento) {
            this.graficos.previsaoFaturamento.destroy();
        }

        const meses = this.gerarMeses(series.faturamento.length);
        const faturamentoReal = series.faturamento;
        
        // Adicionar projeções baseadas nos cenários
        const ultimoMes = meses[meses.length - 1];
        const mesesProjecao = ['Próx 1', 'Próx 2', 'Próx 3', 'Próx 4', 'Próx 5', 'Próx 6'];
        
        const options = {
            series: [{
                name: 'Faturamento Real',
                data: faturamentoReal
            }, {
                name: 'Projeção Otimista',
                data: [...Array(faturamentoReal.length).fill(null), ...this.gerarProjecao(cenarios.otimista.faturamento, 6)]
            }, {
                name: 'Projeção Provável',
                data: [...Array(faturamentoReal.length).fill(null), ...this.gerarProjecao(cenarios.provavel.faturamento, 6)]
            }, {
                name: 'Projeção Pessimista',
                data: [...Array(faturamentoReal.length).fill(null), ...this.gerarProjecao(cenarios.pessimista.faturamento, 6)]
            }],
            chart: {
                type: 'line',
                height: 250,
                toolbar: { show: false }
            },
            stroke: {
                curve: 'smooth',
                width: 2
            },
            colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.1,
                    stops: [0, 90, 100]
                }
            },
            xaxis: {
                categories: [...meses, ...mesesProjecao]
            },
            yaxis: {
                labels: {
                    formatter: (value) => 'R$ ' + value.toLocaleString('pt-BR')
                }
            },
            legend: {
                position: 'top',
                horizontalAlign: 'right'
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        this.graficos.previsaoFaturamento = chart;
    }

    atualizarGraficoSazonalidadeComDados(faturamentoSeries) {
        const container = document.getElementById('graficoSazonalidade');
        if (!container || !faturamentoSeries) return;

        // Destruir gráfico anterior se existir
        if (this.graficos.sazonalidade) {
            this.graficos.sazonalidade.destroy();
        }

        // Calcular sazonalidade (simplificado)
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const media = faturamentoSeries.reduce((a, b) => a + b, 0) / faturamentoSeries.length;
        const sazonalidade = faturamentoSeries.map(v => ((v / media) * 100).toFixed(1));

        const options = {
            series: [{
                name: 'Sazonalidade',
                data: sazonalidade
            }],
            chart: {
                type: 'bar',
                height: 250,
                toolbar: { show: false }
            },
            plotOptions: {
                bar: {
                    borderRadius: 4,
                    columnWidth: '60%'
                }
            },
            colors: ['#8b5cf6'],
            xaxis: {
                categories: meses.slice(0, sazonalidade.length)
            },
            yaxis: {
                labels: {
                    formatter: (value) => value + '%'
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        this.graficos.sazonalidade = chart;
    }

    gerarMeses(quantidade) {
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const resultado = [];
        for (let i = 0; i < quantidade; i++) {
            resultado.push(meses[i % 12]);
        }
        return resultado;
    }

    gerarProjecao(valorInicial, quantidade) {
        const projecao = [];
        let valorAtual = valorInicial;
        for (let i = 0; i < quantidade; i++) {
            valorAtual = valorAtual * 1.02; // 2% de crescimento mensal
            projecao.push(Math.round(valorAtual));
        }
        return projecao;
    }

    atualizarMetasComDados(metas) {
        // Implementar atualização de metas com dados reais
        // Por enquanto mantém a versão estática
        console.log('🎯 Atualizando metas...');
    }

    configurarAtualizacaoAutomatica() {
        // Atualizar dados a cada 5 minutos
        setInterval(() => {
            this.atualizarDados();
        }, 5 * 60 * 1000);
    }

    // Método público para atualização manual
    atualizarManual() {
        this.atualizarDados();
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.analisesEstrategicas = new AnalisesEstrategicas();
});

// Exportar para uso global
window.AnalisesEstrategicas = AnalisesEstrategicas;