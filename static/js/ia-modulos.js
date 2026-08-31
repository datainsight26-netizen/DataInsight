/**
 * ia-modulos.js — Módulos Especializados de IA
 * Lógica compartilhada para subpáginas: ia-financeiro, ia-decisoes, ia-operacional
 */

(function () {
    'use strict';

    // ============================================================
    //  CONFIGURAÇÃO GLOBAL DO MÓDULO
    // ============================================================
    const MODULE_CONFIG = {
        financeiro: {
            title: 'Análise Financeira com IA',
            pagina: 'ia_financeiro',
            pagina_nome: 'IA Financeiro',
            cor: '#10B981',
            badge: 'Módulo Financeiro',
            defaultPrompt: 'Faça uma análise financeira completa dos dados disponíveis. Analise o fluxo de caixa, identifique os principais gargalos financeiros, calcule projeções para os próximos 30 dias e sugira 5 ações prioritárias para melhorar a saúde financeira do negócio.',
            chartTypes: ['area', 'bar'],
            metrics: ['faturamento', 'lucro', 'despesas'],
        },
        decisoes: {
            title: 'Tomada de Decisão com IA',
            pagina: 'ia_decisoes',
            pagina_nome: 'IA Decisões',
            cor: '#7C3AED',
            badge: 'Módulo Estratégico',
            defaultPrompt: 'Com base nos dados disponíveis, gere uma análise SWOT completa do negócio. Em seguida, liste 3 cenários estratégicos distintos (conservador, moderado e agressivo) com suas respectivas projeções de resultado e probabilidades de sucesso. Por fim, recomende qual caminho seguir e por quê.',
            chartTypes: ['radar', 'bar'],
            metrics: ['faturamento', 'crescimento'],
        },
        operacional: {
            title: 'Diagnóstico Operacional com IA',
            pagina: 'ia_operacional',
            pagina_nome: 'IA Operacional',
            cor: '#3B82F6',
            badge: 'Módulo Operacional',
            defaultPrompt: 'Faça um diagnóstico operacional completo. Identifique os 5 produtos/serviços mais lucrativos, analise o comportamento dos clientes (frequência, ticket médio, sazonalidade), mapeia gargalos operacionais e sugira otimizações prioritárias para aumentar eficiência e margem.',
            chartTypes: ['bar', 'pie'],
            metrics: ['produtos', 'clientes'],
        },
    };

    const PERIOD_LABELS = {
        '7_dias': 'Últimos 7 dias',
        '30_dias': 'Últimos 30 dias',
        '90_dias': 'Últimos 90 dias',
        'ano_atual': 'Este ano',
    };

    // Detecta módulo atual a partir da URL
    const pathParts = window.location.pathname.split('/');
    const moduloId = pathParts[pathParts.length - 1]; // financeiro | decisoes | operacional
    const config = MODULE_CONFIG[moduloId] || MODULE_CONFIG.financeiro;

    // ============================================================
    //  ESTADO
    // ============================================================
    let currentAnalysis = null;
    let charts = {};

    // ============================================================
    //  INICIALIZAÇÃO
    // ============================================================
    document.addEventListener('DOMContentLoaded', () => {
        initPeriodSelector();
        initAnalysisForm();
        initChecklist();
        initExportButtons();
        autoRunAnalysis();
    });

    // ============================================================
    //  SELETOR DE PERÍODO
    // ============================================================
    function initPeriodSelector() {
        const selector = document.getElementById('modulo-periodo');
        if (!selector) return;
        const saved = localStorage.getItem('iaModuloPeriodo') || '30_dias';
        selector.value = saved;
        selector.addEventListener('change', () => {
            localStorage.setItem('iaModuloPeriodo', selector.value);
            reloadCharts();
        });
    }

    // ============================================================
    //  FORMULÁRIO DE ANÁLISE
    // ============================================================
    function initAnalysisForm() {
        const form = document.getElementById('ia-modulo-form');
        const runBtn = document.getElementById('ia-modulo-run');
        const customPrompt = document.getElementById('ia-modulo-prompt');

        if (customPrompt) customPrompt.placeholder = `Ex: ${config.defaultPrompt.substring(0, 80)}...`;

        if (runBtn) {
            runBtn.addEventListener('click', () => {
                const prompt = (customPrompt && customPrompt.value.trim()) ? customPrompt.value.trim() : config.defaultPrompt;
                runModuleAnalysis(prompt);
            });
        }

        // Prompt chips
        document.querySelectorAll('.ia-modulo-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                if (customPrompt) customPrompt.value = chip.dataset.prompt;
                document.querySelectorAll('.ia-modulo-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
    }

    // ============================================================
    //  ANÁLISE PRINCIPAL (via Chatbot API)
    // ============================================================
    async function runModuleAnalysis(prompt) {
        const resultArea = document.getElementById('ia-modulo-result');
        const runBtn = document.getElementById('ia-modulo-run');
        const skeleton = document.getElementById('ia-modulo-skeleton');

        if (runBtn) {
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analisando...';
        }
        if (skeleton) skeleton.style.display = 'block';
        if (resultArea) { resultArea.style.display = 'none'; resultArea.innerHTML = ''; }
        resetSaveButton();

        const tabela_id = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
        const session_id = `modulo_${moduloId}_${Date.now()}`;

        try {
            const r = await fetch('/api/chatbot/perguntar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensagem: prompt, session_id, tabela_id }),
            });

            if (!r.ok) throw new Error('Erro no servidor');
            const data = await r.json();
            const resposta = data.resposta || data.message || '';

            currentAnalysis = { prompt, resposta, timestamp: new Date().toISOString() };

            if (skeleton) skeleton.style.display = 'none';
            if (resultArea) {
                resultArea.style.display = 'block';
                resultArea.innerHTML = formatAnalysisHTML(resposta);
                resultArea.classList.add('ia-anim-in');
            }

            // Gerar checklist automático
            generateChecklist(resposta);

            // Recarregar gráficos
            reloadCharts();
            if (resposta) showSaveButton();

        } catch (e) {
            if (skeleton) skeleton.style.display = 'none';
            if (resultArea) {
                resultArea.style.display = 'block';
                resultArea.innerHTML = `<div class="ia-error-msg"><i class="fa-solid fa-circle-exclamation"></i> Erro ao conectar com o servidor de IA. Verifique sua conexão e tente novamente.</div>`;
            }
        } finally {
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fa-solid fa-brain"></i> Analisar com IA';
            }
        }
    }

    function formatAnalysisHTML(text) {
        if (!text) return '';
        if (window.marked && typeof window.marked.parse === 'function') {
            try {
                return `<div class="ia-analysis-text">${window.marked.parse(text)}</div>`;
            } catch (e) {
                console.warn('Erro ao processar markdown com marked:', e);
            }
        }
        const escaped = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="ia-analysis-text">${
            escaped
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/#{3}\s(.+)/g, '<h3>$1</h3>')
                .replace(/#{2}\s(.+)/g, '<h2>$2</h2>')
                .replace(/#{1}\s(.+)/g, '<h1>$1</h1>')
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
        }</div>`;
    }

    // ============================================================
    //  GRÁFICOS DINÂMICOS
    // ============================================================
    function aguardarApexCharts(tentativas = 0) {
        return new Promise((resolve) => {
            if (typeof ApexCharts !== 'undefined') return resolve(true);
            if (tentativas >= 40) return resolve(false);
            setTimeout(() => resolve(aguardarApexCharts(tentativas + 1)), 100);
        });
    }

    function destroyChart(key) {
        if (charts[key]) {
            try { charts[key].destroy(); } catch (e) { /* ignore */ }
            charts[key] = null;
        }
    }

    function showChartEmpty(el, msg) {
        if (!el) return;
        el.innerHTML = `<div class="ia-chart-empty"><i class="fa-solid fa-chart-line" style="opacity:.45;margin-right:8px;"></i>${msg}</div>`;
    }

    function formatMoedaCurta(v) {
        return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }

    function themeColors() {
        const isDark = document.body.classList.contains('tema-escuro');
        return {
            isDark,
            textColor: isDark ? '#CBD5E1' : '#374151',
            gridColor: isDark ? '#334155' : '#E5E7EB',
        };
    }

    function hasChartSeries(grafico) {
        if (!grafico || !Array.isArray(grafico.labels) || !grafico.labels.length) return false;
        const series = grafico.series;
        if (!Array.isArray(series) || !series.length) return false;
        if (typeof series[0] === 'number') return series.some(v => Number(v) !== 0);
        return series.some(s => Array.isArray(s?.data) && s.data.length);
    }

    function pickNamedSeries(grafico, wantedNames) {
        if (!hasChartSeries(grafico)) return [];
        if (!wantedNames || !wantedNames.length) return grafico.series;
        const wanted = wantedNames.map(n => n.toLowerCase());
        const filtered = grafico.series.filter(s =>
            wanted.some(w => String(s.name || '').toLowerCase().includes(w))
        );
        return filtered.length ? filtered : grafico.series;
    }

    function pieFromFluxo(fluxo, preferLucros) {
        if (!fluxo || fluxo.sucesso === false) return null;
        const fonte = preferLucros
            ? (fluxo.maiores_lucros || fluxo.categorias)
            : (fluxo.categorias || fluxo.maiores_lucros);
        const labels = fonte?.labels;
        const valores = fonte?.valores;
        if (!Array.isArray(labels) || !Array.isArray(valores) || !labels.length) return null;
        const pares = labels.map((label, i) => ({
            label: String(label || 'Outros'),
            valor: Number(valores[i] || 0),
        })).filter(p => p.valor > 0).slice(0, 8);
        if (!pares.length) return null;
        return { labels: pares.map(p => p.label), series: pares.map(p => p.valor) };
    }

    function pieFromGraficos(data) {
        const pizza = data?.grafico_pizza;
        if (!pizza || !Array.isArray(pizza.labels) || !pizza.labels.length) return null;
        if (!Array.isArray(pizza.series) || !pizza.series.some(v => Number(v) > 0)) return null;
        return { labels: pizza.labels, series: pizza.series.map(v => Number(v) || 0) };
    }

    async function reloadCharts() {
        const periodo = document.getElementById('modulo-periodo')?.value || '30_dias';
        const tabela_id = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
        const chart1El = document.getElementById('ia-chart-1');
        const chart2El = document.getElementById('ia-chart-2');

        const apexOk = await aguardarApexCharts();
        if (!apexOk) {
            showChartEmpty(chart1El, 'Não foi possível carregar a biblioteca de gráficos.');
            showChartEmpty(chart2El, 'Não foi possível carregar a biblioteca de gráficos.');
            return;
        }

        try {
            const qs = `periodo=${encodeURIComponent(periodo)}&tabela_id=${encodeURIComponent(tabela_id)}`;
            const [rGraf, rFluxo] = await Promise.all([
                fetch(`/api/graficos?${qs}`),
                fetch(`/api/fluxo-caixa?${qs}`).catch(() => null),
            ]);

            if (!rGraf.ok) {
                showChartEmpty(chart1El, 'Não foi possível carregar os dados dos gráficos.');
                showChartEmpty(chart2El, 'Não foi possível carregar os dados dos gráficos.');
                return;
            }

            const data = await rGraf.json();
            let fluxo = null;
            if (rFluxo && rFluxo.ok) {
                try { fluxo = await rFluxo.json(); } catch (e) { fluxo = null; }
            }

            renderModuleCharts(data, fluxo);
        } catch (e) {
            console.warn('Erro ao carregar gráficos:', e);
            showChartEmpty(chart1El, 'Erro ao carregar os gráficos. Tente novamente.');
            showChartEmpty(chart2El, 'Erro ao carregar os gráficos. Tente novamente.');
        }
    }

    function renderModuleCharts(data, fluxo) {
        const { isDark, textColor, gridColor } = themeColors();
        const emptyMsg = 'Sem dados suficientes para este período.';

        // Chart 1 — Evolução no tempo (API: grafico_linha)
        const chart1El = document.getElementById('ia-chart-1');
        if (chart1El) {
            destroyChart('chart1');
            const wanted = {
                financeiro: ['faturamento', 'lucro', 'despesa'],
                decisoes: ['faturamento', 'lucro'],
                operacional: ['faturamento'],
            }[moduloId];
            const linha = data?.grafico_linha;
            const series = pickNamedSeries(linha, wanted);

            if (!series.length) {
                showChartEmpty(chart1El, emptyMsg);
            } else {
                chart1El.innerHTML = '';
                charts.chart1 = new ApexCharts(chart1El, {
                    series,
                    chart: { type: 'area', height: 280, toolbar: { show: false }, background: 'transparent', animations: { enabled: true, speed: 600 } },
                    dataLabels: { enabled: false },
                    stroke: { curve: 'smooth', width: 2 },
                    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
                    xaxis: { categories: linha.labels || [], labels: { style: { colors: textColor } }, axisBorder: { show: false } },
                    yaxis: { labels: { style: { colors: textColor }, formatter: formatMoedaCurta } },
                    grid: { borderColor: gridColor },
                    legend: { labels: { colors: textColor } },
                    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: formatMoedaCurta } },
                    colors: ['#3B82F6', '#10B981', '#F59E0B', '#7C3AED'],
                });
                charts.chart1.render();
            }
        }

        // Chart 2 — Distribuição (categorias do fluxo, pizza da API ou barras mensais)
        const chart2El = document.getElementById('ia-chart-2');
        if (chart2El) {
            destroyChart('chart2');
            const preferLucros = moduloId === 'operacional' || moduloId === 'decisoes';
            const pie = pieFromFluxo(fluxo, preferLucros) || pieFromGraficos(data);
            const barras = data?.grafico_barras;

            if (pie) {
                chart2El.innerHTML = '';
                charts.chart2 = new ApexCharts(chart2El, {
                    series: pie.series,
                    labels: pie.labels,
                    chart: { type: 'donut', height: 280, toolbar: { show: false }, background: 'transparent' },
                    dataLabels: { enabled: true },
                    legend: { labels: { colors: textColor }, position: 'bottom' },
                    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: formatMoedaCurta } },
                    colors: ['#3B82F6', '#10B981', '#7C3AED', '#F59E0B', '#EF4444', '#06B6D4'],
                });
                charts.chart2.render();
            } else if (hasChartSeries(barras)) {
                chart2El.innerHTML = '';
                charts.chart2 = new ApexCharts(chart2El, {
                    series: barras.series,
                    chart: { type: 'bar', height: 280, toolbar: { show: false }, background: 'transparent' },
                    xaxis: { categories: barras.labels, labels: { style: { colors: textColor } } },
                    yaxis: { labels: { style: { colors: textColor }, formatter: formatMoedaCurta } },
                    dataLabels: { enabled: false },
                    legend: { labels: { colors: textColor } },
                    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: formatMoedaCurta } },
                    colors: ['#3B82F6', '#EF4444', '#10B981'],
                    plotOptions: { bar: { borderRadius: 4 } },
                });
                charts.chart2.render();
            } else {
                showChartEmpty(chart2El, emptyMsg);
            }
        }
    }

    // ============================================================
    //  CHECKLIST INTERATIVO
    // ============================================================
    function initChecklist() {
        const list = document.getElementById('ia-checklist');
        if (!list) return;
        list.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                const item = e.target.closest('.ia-check-item');
                if (item) item.classList.toggle('done', e.target.checked);
                saveChecklistState();
            }
        });
    }

    function generateChecklist(analysisText) {
        const list = document.getElementById('ia-checklist');
        if (!list) return;

        // Extrair itens que parecem ações (frases iniciadas com verbos ou números)
        const lines = analysisText.split('\n').filter(l => l.trim().length > 10);
        const actionLines = lines.filter(l =>
            /^(\d+[\.\)]\s|[-•]\s|\*\s)/.test(l.trim()) ||
            /^(verificar|analisar|implementar|criar|otimizar|reduzir|aumentar|monitorar|revisar|calcular|definir|estabelecer)/i.test(l.trim())
        ).slice(0, 8);

        if (actionLines.length === 0) {
            list.innerHTML = `<li class="ia-check-item"><label><input type="checkbox"><span>Revisar a análise gerada</span></label></li>
                              <li class="ia-check-item"><label><input type="checkbox"><span>Compartilhar com a equipe</span></label></li>
                              <li class="ia-check-item"><label><input type="checkbox"><span>Implementar recomendações</span></label></li>`;
            return;
        }

        list.innerHTML = actionLines.map(line => {
            const clean = line.replace(/^[\d\.\)\-•\*\s]+/, '').trim();
            return `<li class="ia-check-item"><label><input type="checkbox"><span>${clean}</span></label></li>`;
        }).join('');
    }

    function saveChecklistState() {
        const items = document.querySelectorAll('.ia-check-item');
        const state = Array.from(items).map(item => item.querySelector('input')?.checked || false);
        localStorage.setItem(`iaChecklist_${moduloId}`, JSON.stringify(state));
    }

    // ============================================================
    //  EXPORTAÇÃO
    // ============================================================
    function initExportButtons() {
        const copyBtn = document.getElementById('ia-export-copy');
        const pdfBtn = document.getElementById('ia-export-pdf');
        const saveBtn = document.getElementById('ia-export-save');

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (!currentAnalysis) { showModuleToast('Gere uma análise primeiro.', 'warning'); return; }
                const text = `${config.title}\n\n${currentAnalysis.resposta}\n\nGerado em: ${new Date(currentAnalysis.timestamp).toLocaleString('pt-BR')}`;
                navigator.clipboard.writeText(text).then(() => showModuleToast('Análise copiada!', 'success'));
            });
        }

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                if (!currentAnalysis) { showModuleToast('Gere uma análise primeiro.', 'warning'); return; }
                printAnalysis();
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => saveModuleAnalysis(saveBtn));
        }
    }

    function resetSaveButton() {
        const saveBtn = document.getElementById('ia-export-save');
        const saveWrap = document.getElementById('ia-export-save-wrap');
        if (saveWrap) saveWrap.style.display = 'none';
        if (!saveBtn) return;
        saveBtn.disabled = false;
        saveBtn.dataset.saved = '0';
        saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Salvar análise';
    }

    function showSaveButton() {
        const saveWrap = document.getElementById('ia-export-save-wrap');
        const saveBtn = document.getElementById('ia-export-save');
        if (saveWrap) saveWrap.style.display = 'flex';
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
            saveBtn.disabled = false;
            saveBtn.dataset.saved = '0';
            saveBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Salvar análise';
        }
    }

    function collectChecklistItems() {
        return Array.from(document.querySelectorAll('#ia-checklist .ia-check-item span'))
            .map((el) => (el.textContent || '').trim())
            .filter((t) => t.length > 4)
            .slice(0, 12);
    }

    function extractListsFromText(text) {
        const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 12);
        const fortes = lines.filter((l) => /força|oportun|positivo|destaque|vantagem|ponto forte/i.test(l)).slice(0, 6);
        const riscos = lines.filter((l) => /risco|alerta|fraqueza|amea[cç]a|gargalo|queda|aten[cç][aã]o/i.test(l)).slice(0, 6);
        return { fortes, riscos };
    }

    function periodoLabel() {
        const value = document.getElementById('modulo-periodo')?.value || '30_dias';
        return PERIOD_LABELS[value] || value;
    }

    async function origemLabel() {
        const tabela_id = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
        if (!tabela_id || tabela_id === 'todas') return 'Todas as Planilhas (Visão Consolidada)';
        try {
            const r = await fetch('/api/planilhas/sumario');
            if (!r.ok) return tabela_id;
            const json = await r.json();
            const hit = (json.planilhas || []).find((p) => p.id === tabela_id);
            return hit?.nome || tabela_id;
        } catch (e) {
            return tabela_id;
        }
    }

    async function saveModuleAnalysis(saveBtn) {
        if (!currentAnalysis || !currentAnalysis.resposta) {
            showModuleToast('Gere uma análise primeiro.', 'warning');
            return;
        }
        if (saveBtn?.dataset.saved === '1') {
            window.location.href = '/analises-salvas';
            return;
        }

        const htmlOriginal = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';
        }

        const { fortes, riscos } = extractListsFromText(currentAnalysis.resposta);
        const recomendacoes = collectChecklistItems();
        const origem = await origemLabel();
        const periodo = periodoLabel();
        const promptResumo = (currentAnalysis.prompt || '').trim().slice(0, 140);

        const payload = {
            pagina: config.pagina || moduloId,
            pagina_nome: config.pagina_nome || config.title,
            origem,
            periodo,
            veredito: {
                titulo: config.title,
                subtitulo: promptResumo ? `Pergunta: ${promptResumo}` : `${config.title} • ${periodo}`,
                badge: config.badge || 'Módulo IA',
                cor: config.cor || '#3B82F6',
                icone: 'fa-brain',
            },
            metricas: [
                { label: 'Módulo', valor: config.pagina_nome || config.title, sub: 'Análise especializada', cor: config.cor || '#3B82F6', icone: 'fa-layer-group' },
                { label: 'Período', valor: periodo, sub: 'Intervalo analisado', cor: '#8b5cf6', icone: 'fa-calendar-days' },
                { label: 'Origem', valor: origem, sub: 'Base de dados', cor: '#06b6d4', icone: 'fa-database' },
            ],
            diagnostico_geral: currentAnalysis.resposta,
            pontos_fortes: fortes,
            alertas_riscos: riscos,
            recomendacoes,
        };

        try {
            const r = await fetch('/api/salvar-analise-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify(payload),
            });
            const resp = await r.json();
            if (!r.ok || !resp.sucesso) {
                throw new Error(resp.mensagem || 'Erro ao salvar a análise.');
            }
            showModuleToast('Análise salva. Você já pode vê-la em Análises Salvas.', 'success');
            if (saveBtn) {
                saveBtn.dataset.saved = '1';
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Salvo — ver na lista';
            }
        } catch (e) {
            showModuleToast(e.message || 'Falha ao salvar a análise.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = htmlOriginal || '<i class="fa-solid fa-bookmark"></i> Salvar análise';
            }
        }
    }

    function printAnalysis() {
        const w = window.open('', '_blank');
        w.document.write(`<!DOCTYPE html><html><head>
            <title>${config.title}</title>
            <style>body{font-family:Inter,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#111;}h1{color:#3B82F6;margin-bottom:8px;}h2,h3{color:#1E40AF;margin-top:20px;}p{line-height:1.7;}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#888;}</style>
        </head><body>
            <h1>${config.title}</h1>
            <p style="color:#888;font-size:13px;">Gerado em: ${new Date(currentAnalysis.timestamp).toLocaleString('pt-BR')}</p>
            <hr style="margin:20px 0;">
            <div>${formatAnalysisHTML(currentAnalysis.resposta)}</div>
            <div class="footer">DataInsight — Centro de Inteligência com IA</div>
        </body></html>`);
        w.document.close();
        w.print();
    }

    // ============================================================
    //  AUTO-RUN
    // ============================================================
    async function autoRunAnalysis() {
        // Carrega gráficos imediatamente
        await reloadCharts();
        // Auto-análise só se solicitado via URL param
        const params = new URLSearchParams(window.location.search);
        if (params.get('auto') === '1') {
            setTimeout(() => runModuleAnalysis(config.defaultPrompt), 800);
        }
    }

    // ============================================================
    //  TOAST
    // ============================================================
    function showModuleToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `ia-toast ia-toast-${type}`;
        const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
        toast.innerHTML = `<i class="fa-solid ${icons[type] || 'fa-circle-info'}"></i> <span>${msg}</span>`;

        let container = document.getElementById('ia-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ia-toast-container';
            document.body.appendChild(container);
        }
        container.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3500);
    }

    // Expor para uso externo
    window.iaModulo = { runModuleAnalysis, reloadCharts, generateChecklist, saveModuleAnalysis };

})();
