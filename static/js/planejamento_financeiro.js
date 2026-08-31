    (() => {
        const MESES_PADRAO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let scenario = 'provavel';
        let charts = {};
        let currentData = null;
        let iaAnaliseCache = {
            provavel: null,
            otimista: null,
            pessimista: null
        };

        const $ = (id) => document.getElementById(id);
        const brl = (value) => {
            const n = Number(value);
            if (!Number.isFinite(n)) return '--';
            return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
        };
        const pct = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? `${n.toLocaleString('pt-BR',{ minimumFractionDigits:2, maximumFractionDigits:2 })}%` : '--';
        };
        const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
        const sum = (arr) => arr.reduce((a,b) => a + num(b), 0);

        function getScenarioData(root, desired) {
            if (!root) return null;

            const customList = (root.campos_custom && root.campos_custom.length > 0)
                ? root.campos_custom
                : ((root.categorias_custom && root.categorias_custom.length > 0)
                    ? root.categorias_custom
                    : (window.planejamentoFinanceiroBackend ? (window.planejamentoFinanceiroBackend.campos_custom || window.planejamentoFinanceiroBackend.categorias_custom || []) : []));

            /*
             * Os 3 cenários calculados pelo backend:
             * - provavel: realizado + projeção linear pela média
             * - otimista: maximização sustentável (+15% receita)
             * - pessimista: ponto de equilíbrio / sobrevivência
             */
            if (
                desired === 'provavel' &&
                root.provavel &&
                Array.isArray(root.provavel.meses)
            ) {
                return { ...root.provavel, campos_custom: customList, categorias_custom: customList };
            }

            if (
                desired === 'otimista' &&
                root.otimista &&
                Array.isArray(root.otimista.meses)
            ) {
                return { ...root.otimista, campos_custom: customList, categorias_custom: customList };
            }

            if (
                desired === 'pessimista' &&
                root.pessimista &&
                Array.isArray(root.pessimista.meses)
            ) {
                return { ...root.pessimista, campos_custom: customList, categorias_custom: customList };
            }

            if (
                root.cenarios &&
                root.cenarios[desired] &&
                Array.isArray(root.cenarios[desired].meses)
            ) {
                return { ...root.cenarios[desired], campos_custom: customList, categorias_custom: customList };
            }

            if (
                root[desired] &&
                typeof root[desired] === 'object' &&
                Array.isArray(root[desired].meses)
            ) {
                return { ...root[desired], campos_custom: customList, categorias_custom: customList };
            }

            /* fallback de compatibilidade com a base */
            if (Array.isArray(root.meses)) {
                return { meses: root.meses, campos_custom: customList, categorias_custom: customList };
            }

            return null;
        }

        function normalizeMonth(raw, index) {
            raw = raw || {};

            const receitas = raw.receitas || {};
            const gv = raw.gastos_variaveis || raw.variaveis_detalhes || {};
            const gf = raw.gastos_fixos || raw.fixos_detalhes || {};
            const inv = raw.investimentos_detalhes || {};

            const produtos = num(
                raw.produtos ??
                receitas.produtos ??
                raw.vendas_produtos
            );

            const servicos = num(
                raw.servicos ??
                receitas.servicos ??
                raw.vendas_servicos
            );

            const outrosReceita = num(
                raw.outros ??
                raw.outrosReceita ??
                receitas.outros ??
                raw.outras_receitas
            );

            const receita = num(
                raw.receita ??
                raw.receita_total
            ) || (produtos + servicos + outrosReceita);

            const impostos = num(
                raw.impostos ??
                raw.valor_impostos
            );

            const fornecedores = num(
                raw.fornecedores ??
                gv.fornecedores
            );

            const publicidade = num(
                raw.publicidade ??
                gv.publicidade
            );

            const outrosVar = num(
                raw.outros_variaveis ??
                raw.outrosVar ??
                gv.outros
            );

            const variaveis = num(
                raw.variaveis ??
                raw.gastos_variaveis_total
            ) || (fornecedores + publicidade + outrosVar);

            const margem = num(
                raw.margem ??
                raw.margem_contribuicao
            ) || (receita - impostos - variaveis);

            const margemPercentual =
                raw.margemPct != null
                    ? num(raw.margemPct)
                    : raw.margem_percentual != null
                        ? num(raw.margem_percentual)
                        : (receita ? (margem / receita) * 100 : 0);

            const aluguel = num(
                raw.aluguel ??
                gf.aluguel
            );

            const folha = num(
                raw.folha ??
                raw.folha_pagamento ??
                gf.folha ??
                gf.folha_pagamento
            );

            const proLabore = num(
                raw.proLabore ??
                raw.pro_labore ??
                gf.pro_labore
            );

            const outrosFixos = num(
                raw.outros_fixos ??
                raw.outrosFixos ??
                gf.outros
            );

            const fixos = num(
                raw.fixos ??
                raw.gastos_fixos_total
            ) || (aluguel + folha + proLabore + outrosFixos);

            const resultado = raw.resultado != null
                ? num(raw.resultado)
                : (margem - fixos);

            const infraestrutura = num(
                raw.infraestrutura ??
                inv.infraestrutura
            );

            const equipamentos = num(
                raw.equipamentos ??
                inv.equipamentos
            );

            const outrosInv = num(
                raw.outros_investimentos ??
                raw.outrosInv ??
                inv.outros
            );

            const investimentos = num(
                raw.investimentos ??
                raw.investimentos_total
            ) || (infraestrutura + equipamentos + outrosInv);

            return {
                ...raw,
                mes: raw.mes || MESES_PADRAO[index] || `Mês ${index + 1}`,
                projetado: raw.projetado === true,
                produtos,
                servicos,
                outros: outrosReceita,
                outrosReceita,
                receita,
                impostosPercentual:
                    raw.impostosPercentual != null
                        ? num(raw.impostosPercentual)
                        : raw.impostos_percentual != null
                            ? num(raw.impostos_percentual)
                            : (receita ? impostos / receita * 100 : 0),
                impostos,
                fornecedores,
                publicidade,
                outrosVar,
                outros_variaveis: outrosVar,
                variaveis,
                margem,
                margemPct: margemPercentual,
                margemPercentual,
                aluguel,
                folha,
                proLabore,
                outrosFixos,
                outros_fixos: outrosFixos,
                fixos,
                resultado,
                infraestrutura,
                equipamentos,
                outrosInv,
                outros_investimentos: outrosInv,
                investimentos
            };
        }

        function normalizeData(raw) {
            if (!raw || !Array.isArray(raw.meses) || !raw.meses.length) return null;
            const meses = raw.meses.map(normalizeMonth);
            // Se todos os meses forem zerados e não projetados, não há dados.
            const temDadosReais = meses.some(m => !m.projetado && Math.abs(m.receita) > 0);
            if (!temDadosReais) return null;
            return { 
                ...raw,
                meses,
                campos_custom: raw.campos_custom || raw.categorias_custom || []
            };
        }

        function totals(data) {
            const m = data.meses;
            const receita = sum(m.map(x=>x.receita));
            const impostos = sum(m.map(x=>x.impostos));
            const variaveis = sum(m.map(x=>x.variaveis));
            const margem = sum(m.map(x=>x.margem));
            const fixos = sum(m.map(x=>x.fixos));
            const resultado = sum(m.map(x=>x.resultado));
            const investimentos = sum(m.map(x=>x.investimentos));
            const margemPct = receita ? margem / receita * 100 : 0;
            return { receita, impostos, variaveis, margem, fixos, resultado, investimentos, margemPct };
        }

        function setText(id, value) { const el=$(id); if(el) el.textContent=value; }

        function renderKPIs(data) {
            const t = totals(data);

            setText('pf-receita-total', brl(t.receita));
            setText('pf-impostos-total', brl(t.impostos));
            setText('pf-impostos-meta', receitaTaxMeta(t));
            setText('pf-variaveis-total', brl(t.variaveis));
            setText('pf-margem-percentual', pct(t.margemPct));
            setText('pf-margem-meta', `${brl(t.margem)} total`);
            setText('pf-fixos-total', brl(t.fixos));
            setText('pf-resultado-total', brl(t.resultado));

            // Indicador de meses com dados reais na tabela
            const nComDados = data.meses.filter(x => Math.abs(x.receita) > 0 || Math.abs(x.fixos) > 0 || Math.abs(x.variaveis) > 0).length;
            const metaReceita = $('pf-receita-meta');
            if (metaReceita) {
                metaReceita.textContent = `${nComDados} de ${data.meses.length} meses com dados`;
            }

            const positivos = data.meses.filter(x => x.resultado > 1).length;

            if (scenario === 'pessimista') {
                setText(
                    'pf-resultado-meta',
                    'Operação projetada no ponto de equilíbrio'
                );
            } else if (scenario === 'otimista') {
                setText(
                    'pf-resultado-meta',
                    'Resultado projetado no cenário de maximização sustentável'
                );
            } else {
                setText(
                    'pf-resultado-meta',
                    `${positivos}/${data.meses.length} meses positivos`
                );
            }

            const resultEl = $('pf-status-result');

            if (resultEl) {
                if (scenario === 'pessimista') {
                    resultEl.innerHTML =
                        `${brl(t.receita)}<small>Faturamento anual mínimo estimado</small>`;
                } else {
                    resultEl.innerHTML =
                        `${brl(t.resultado)}<small>Resultado anual projetado</small>`;
                }
            }

            setText(
                'pf-status-desc',
                statusDescription(t, positivos, data.meses.length)
            );
        }

        function receitaTaxMeta(t) {
            return t.receita ? `${pct(t.impostos / t.receita * 100)} da receita` : 'Carga tributária anual';
        }

        function statusDescription(t, positives, totalMonths) {
            if (scenario === 'pessimista') {
                if (!t.receita && !t.fixos) {
                    return 'Não foi possível calcular o ponto de equilíbrio porque não foram identificados gastos fixos nos dados selecionados.';
                }

                const resultadoAbs = Math.abs(t.resultado);

                if (resultadoAbs <= 1) {
                    return `Ponto de equilíbrio estimado: faturamento anual de ${brl(t.receita)} para cobrir impostos, custos variáveis e gastos fixos, sem considerar novos investimentos.`;
                }

                return `Cenário de sobrevivência estimado com faturamento anual de ${brl(t.receita)} e resultado de ${brl(t.resultado)}.`;
            }

            if (!t.receita) {
                return 'Aguardando dados financeiros para calcular a projeção.';
            }

            if (scenario === 'otimista') {
                return `Cenário otimista calculado com faturamento anual de ${brl(t.receita)}, resultado de ${brl(t.resultado)} e margem de contribuição de ${pct(t.margemPct)}.`;
            }

            if (t.resultado >= 0) {
                return `Receita de ${brl(t.receita)} no ano, com ${positives}/${totalMonths} meses positivos. Margem de contribuição de ${pct(t.margemPct)}.`;
            }

            return `Projeção com resultado anual negativo de ${brl(Math.abs(t.resultado))}.`;
        }

        function chartTheme() {
            const css = getComputedStyle(document.documentElement);
            const bodyCss = getComputedStyle(document.body);
            const get = (name, fallback) => (css.getPropertyValue(name) || bodyCss.getPropertyValue(name) || fallback).trim() || fallback;
            return {
                text:get('--texto','#d7deea'), muted:get('--suave','#8d99aa'), border:get('--borda','#263244'), card:get('--cartao','#111827'),
                primary:get('--primaria','#3b82f6'), success:get('--sucesso','#16a34a'), danger:get('--perigo','#dc2626'), warning:get('--aviso','#d97706')
            };
        }

        function baseChartOptions(type='line') {
            const c = chartTheme();
            return {
                chart:{ type, toolbar:{show:false}, background:'transparent', foreColor:c.muted, animations:{enabled:true, speed:350} },
                theme:{mode: document.documentElement.dataset.theme === 'dark' || document.body.classList.contains('dark') ? 'dark':'light'},
                grid:{borderColor:c.border, strokeDashArray:3},
                dataLabels:{enabled:false},
                legend:{position:'top', horizontalAlign:'right', fontSize:'12px'},
                xaxis:{ axisBorder:{color:c.border}, axisTicks:{color:c.border}, crosshairs:{show:true, position:'back', stroke:{color:c.primary,width:1,dashArray:3}} },
                yaxis:{
                    labels:{
                        formatter: (v) => {
                            if (!Number.isFinite(v)) return 'R$ 0,00';
                            return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2, maximumFractionDigits:2 });
                        }
                    }
                },
                tooltip:{ shared:true, intersect:false, followCursor:false, y:{formatter:(v)=>brl(v)} },
                markers:{size:0, hover:{size:5}},
                noData:{text:'Aguardando dados financeiros...'},
                responsive:[{breakpoint:640,options:{legend:{position:'bottom',horizontalAlign:'left'},chart:{height:300}}}]
            };
        }

        function destroyChart(name) { if (charts[name]) { charts[name].destroy(); delete charts[name]; } }
        function mountChart(name, selector, options) {
            const el = document.querySelector(selector);
            if (!el || typeof ApexCharts === 'undefined') return;
            destroyChart(name);
            el.innerHTML = ''; // limpa placeholder antes de renderizar
            charts[name] = new ApexCharts(el, options);
            charts[name].render();
        }

        function renderCharts(data) {
            if (typeof ApexCharts === 'undefined') return;
            const m = data.meses;
            const categories = m.map(x => x.mes);
            const c = chartTheme();

            // ----- Composição da Receita (area) -----
            const receitaOpts = baseChartOptions('area');
            Object.assign(receitaOpts, {
                series: [
                    { name: 'Produtos', data: m.map(x => x.produtos) },
                    { name: 'Serviços', data: m.map(x => x.servicos) },
                    { name: 'Outros', data: m.map(x => x.outros) }
                ],
                colors: [c.primary, c.success, '#8b5cf6'],
                stroke: { curve: 'smooth', width: 2 },
                fill: { type: 'gradient', gradient: { shadeIntensity: .2, opacityFrom: .28, opacityTo: .03, stops: [0, 90, 100] } },
                xaxis: { ...receitaOpts.xaxis, categories },
                tooltip: { ...receitaOpts.tooltip, shared: true, intersect: false }
            });
            mountChart('receita', '#pf-chart-receita', receitaOpts);

            // ----- Resultado vs Margem (bar) -----
            const resultadoOpts = baseChartOptions('bar');
            Object.assign(resultadoOpts, {
                series: [
                    { name: 'Margem Contrib.', data: m.map(x => x.margem) },
                    { name: 'Gastos Fixos', data: m.map(x => x.fixos) },
                    { name: 'Resultado', data: m.map(x => x.resultado) }
                ],
                colors: [c.success, c.danger, c.primary],
                plotOptions: { bar: { columnWidth: '46%', borderRadius: 2 } },
                xaxis: { ...resultadoOpts.xaxis, categories }
            });
            mountChart('resultado', '#pf-chart-resultado', resultadoOpts);

            // ----- Decomposição de Custos (bar stacked) -----
            const custosOpts = baseChartOptions('bar');
            Object.assign(custosOpts, {
                series: [
                    { name: 'Impostos', data: m.map(x => x.impostos) },
                    { name: 'Gastos Variáveis', data: m.map(x => x.variaveis) },
                    { name: 'Gastos Fixos', data: m.map(x => x.fixos) }
                ],
                colors: ['#6366f1', c.warning, c.danger],
                chart: { ...custosOpts.chart, stacked: true, height: 250 },
                plotOptions: { bar: { columnWidth: '45%', borderRadius: 2 } },
                xaxis: { ...custosOpts.xaxis, categories }
            });
            mountChart('custos', '#pf-chart-custos', custosOpts);

            // ----- Fluxo Anual (line) -----
            const fluxoOpts = baseChartOptions('line');
            Object.assign(fluxoOpts, {
                series: [
                    { name: 'Receita', data: m.map(x => x.receita) },
                    { name: 'Despesas', data: m.map(x => x.impostos + x.variaveis + x.fixos) },
                    { name: 'Resultado', data: m.map(x => x.resultado) }
                ],
                colors: [c.success, c.danger, c.primary],
                chart: { ...fluxoOpts.chart, height: 250 },
                stroke: { curve: 'smooth', width: [3, 3, 3] },
                xaxis: { ...fluxoOpts.xaxis, categories },
                tooltip: { ...fluxoOpts.tooltip, shared: true, intersect: false }
            });
            mountChart('annualFlow', '#pf-chart-anual-fluxo', fluxoOpts);

            // ----- Evolução da Margem (area) -----
            const margemOpts = baseChartOptions('area');
            Object.assign(margemOpts, {
                series: [{ name: 'Margem de contribuição', data: m.map(x => Number((x.margemPct ?? x.margemPercentual ?? 0).toFixed(1))) }],
                colors: [c.success],
                stroke: { curve: 'smooth', width: 3 },
                chart: { ...margemOpts.chart, height: 250 },
                fill: { type: 'gradient', gradient: { opacityFrom: .3, opacityTo: .05 } },
                xaxis: { ...margemOpts.xaxis, categories },
                yaxis: { labels: { formatter: (v) => `${Number(v).toFixed(1)}%` } },
                tooltip: { shared: false, intersect: false, y: { formatter: (v) => `${Number(v).toFixed(1)}%` } }
            });
            mountChart('annualMargin', '#pf-chart-anual-margem', margemOpts);

            const t = totals(data);
            const saidasOpts = baseChartOptions('donut');
            Object.assign(saidasOpts, {
                chart:{...saidasOpts.chart,type:'donut',height:250},
                series:[t.impostos,t.variaveis,t.fixos,t.investimentos],
                labels:['Impostos','Gastos Variáveis','Gastos Fixos','Investimentos'],
                colors:['#6366f1',c.warning,c.danger,'#8b5cf6'],
                stroke:{colors:[c.card]},
                plotOptions:{pie:{donut:{size:'68%',labels:{show:true,total:{show:true,label:'Saídas',formatter:()=>brl(t.impostos+t.variaveis+t.fixos+t.investimentos)}}}}},
                tooltip:{y:{formatter:(v)=>brl(v)}},
                legend:{position:'bottom'}
            });
            mountChart('annualOut','#pf-chart-anual-saidas',saidasOpts);
        }

        window.togglePfSection = function(klass) {
            const rows = document.querySelectorAll(`[data-parent="${klass}"]`);
            rows.forEach(r => {
                r.style.display = r.style.display === 'none' ? '' : 'none';
            });
            const header = document.querySelector(`.pf-section-row--${klass} th`);
            if (header) {
                if (header.innerText.startsWith('▼')) {
                    header.innerText = header.innerText.replace('▼', '▶');
                } else if (header.innerText.startsWith('▶')) {
                    header.innerText = header.innerText.replace('▶', '▼');
                }
            }
        };

        function renderMonthlyTable(data) {
            const months = data.meses.map(m => {
                const impostosPct = m.receita > 0 ? (m.impostos / m.receita) : 0;
                return { ...m, impostosPercentual: impostosPct };
            });

            $('pf-monthly-head').innerHTML = `<tr><th>Conta</th>${months.map(m => `<th>${m.mes}</th>`).join('')}<th>Total/Média</th></tr>`;

            const total = (key) => sum(months.map(m => m[key] || 0));
            const avg = (key) => months.length ? sum(months.map(m => m[key] || 0)) / months.length : 0;

            const moneyRow = (label, key, cls = '', parent = '') =>
                `<tr class="${cls}" ${parent ? `data-parent="${parent}"` : ''}><th>${label}</th>` +
                months.map(m => `<td>${brl(m[key] || 0)}</td>`).join('') +
                `<td>${brl(total(key))}</td></tr>`;

            const pctRow = (label, key, parent = '') =>
                `<tr ${parent ? `data-parent="${parent}"` : ''}><th>${label}</th>` +
                months.map(m => `<td>${pct(m[key] || 0)}</td>`).join('') +
                `<td>${pct(avg(key))}</td></tr>`;

            const section = (label, klass) =>
                `<tr class="pf-section-row pf-section-row--${klass}" style="cursor:pointer;" onclick="window.togglePfSection('${klass}')">`+
                `<th colspan="${months.length + 2}">${label}</th></tr>`;

            const resultRow = (parent = '') =>
                `<tr class="pf-total" ${parent ? `data-parent="${parent}"` : ''}><th>Resultado</th>` +
                months.map(m =>
                    `<td class="${m.resultado >= 0 ? 'pf-result-positive' : 'pf-result-negative'}">${brl(m.resultado)}</td>`
                ).join('') +
                `<td class="${total('resultado') >= 0 ? 'pf-result-positive' : 'pf-result-negative'}">${brl(total('resultado'))}</td></tr>`;

            const totReceita = total('receita');
            const totResultado = total('resultado');
            const margemMedia = avg('margemPct');
            const mesesPositivos = months.filter(m => m.resultado > 0).length;
            const melhorMes = [...months].sort((a,b)=>b.resultado-a.resultado)[0];
            
            let summaryText = `No acumulado do ano, a Receita Total é de <strong style="color:var(--texto);">${brl(totReceita)}</strong> com um Resultado Líquido de <strong style="color:${totResultado >= 0 ? 'var(--sucesso)' : 'var(--perigo)'};">${brl(totResultado)}</strong> (Margem Média de <strong style="color:var(--texto);">${pct(margemMedia)}</strong>). `;
            if(melhorMes) {
                summaryText += `Você tem <strong style="color:var(--texto);">${mesesPositivos} de ${months.length} meses</strong> no azul, sendo o melhor mês em <strong style="color:var(--texto);">${melhorMes.mes}</strong> (${brl(melhorMes.resultado)}).`;
            }
            
            const summaryEl = document.getElementById('pf-monthly-quick-summary');
            if(summaryEl) summaryEl.innerHTML = summaryText;

            let customCats = [];
            if (data && Array.isArray(data.campos_custom) && data.campos_custom.length > 0) {
                customCats = data.campos_custom;
            } else if (data && Array.isArray(data.categorias_custom) && data.categorias_custom.length > 0) {
                customCats = data.categorias_custom;
            } else if (window.planejamentoFinanceiroBackend) {
                customCats = window.planejamentoFinanceiroBackend.campos_custom || window.planejamentoFinanceiroBackend.categorias_custom || [];
            }

            const customReceitas = customCats.filter(c => c && (c.grupo === 'Detalhamento de Receitas' || c.grupo === 'Receitas'));
            const customImpostos = customCats.filter(c => c && c.grupo === 'Impostos');
            const customVariaveis = customCats.filter(c => c && (c.grupo === 'Custos Variáveis' || c.grupo === 'Gastos Variáveis'));
            const customFixos = customCats.filter(c => c && c.grupo === 'Gastos Fixos');
            const customInvestimentos = customCats.filter(c => c && c.grupo === 'Investimentos');

            $('pf-monthly-body').innerHTML = [
                section('▼ RECEITAS','receitas'),
                moneyRow('Vendas de Produtos','produtos','','receitas'),
                moneyRow('Vendas de Serviços','servicos','','receitas'),
                ...customReceitas.map(c => moneyRow(c.label, c.id, '', 'receitas')),
                moneyRow('TOTAL','receita','pf-total','receitas'),

                section('▼ IMPOSTOS','impostos'),
                pctRow('Valor Mensal de Impostos (%)','impostosPercentual','impostos'),
                moneyRow('Valor Mensal de Impostos (R$)','impostos','pf-total','impostos'),
                ...customImpostos.map(c => c.tipo === 'percentual' ? pctRow(c.label, c.id, 'impostos') : moneyRow(c.label, c.id, '', 'impostos')),

                section('▼ GASTOS VARIÁVEIS','variaveis'),
                moneyRow('Fornecedores','fornecedores','','variaveis'),
                moneyRow('Publicidade','publicidade','','variaveis'),
                ...customVariaveis.map(c => moneyRow(c.label, c.id, '', 'variaveis')),
                moneyRow('TOTAL','variaveis','pf-total','variaveis'),

                section('▼ MARGEM DE CONTRIBUIÇÃO','margem'),
                moneyRow('Margem de Contribuição (R$)','margem','pf-total','margem'),
                pctRow('Margem de Contribuição (%)','margemPct','margem'),

                section('▼ GASTOS FIXOS','fixos'),
                moneyRow('Aluguel','aluguel','','fixos'),
                moneyRow('Folha de Pagamento','folha','','fixos'),
                moneyRow('Pró-Labore','proLabore','','fixos'),
                ...customFixos.map(c => moneyRow(c.label, c.id, '', 'fixos')),
                moneyRow('TOTAL','fixos','pf-total','fixos'),

                section('▼ RESULTADO','resultado'),
                resultRow('resultado'),

                section('▼ INVESTIMENTOS','investimentos'),
                moneyRow('Infraestrutura','infraestrutura','','investimentos'),
                moneyRow('Equipamentos','equipamentos','','investimentos'),
                ...customInvestimentos.map(c => moneyRow(c.label, c.id, '', 'investimentos')),
                moneyRow('TOTAL','investimentos','pf-total','investimentos')
            ].join('');
        }

        function renderAnnual(data) {
            const t = totals(data), m = data.meses;
            setText('pf-annual-revenue',brl(t.receita));
            setText('pf-annual-result',brl(t.resultado));
            setText('pf-annual-margin',pct(t.margemPct));
            setText('pf-annual-investments',brl(t.investimentos));
            const best = [...m].sort((a,b)=>b.resultado-a.resultado)[0];
            const worst = [...m].sort((a,b)=>a.resultado-b.resultado)[0];
            setText('pf-best-month',best ? `${best.mes} · ${brl(best.resultado)}`:'--');
            setText('pf-worst-month',worst ? `${worst.mes} · ${brl(worst.resultado)}`:'--');
            setText('pf-positive-months',`${m.filter(x=>x.resultado>0).length}/${m.length}`);
            setText('pf-average-revenue',brl(t.receita/m.length));

            let reading = 'Aguardando dados para montar o resumo automático do ano.';

            if (t.receita) {
                if (scenario === 'pessimista') {
                    reading = `No cenário pessimista, o DataInsight estima faturamento anual mínimo de ${brl(t.receita)} para manter a operação no ponto de equilíbrio. Os investimentos não essenciais são zerados e os custos variáveis acompanham proporcionalmente o faturamento.`;
                } else if (scenario === 'otimista') {
                    reading = `No cenário otimista, o DataInsight projeta uma maximização sustentável dentro das premissas operacionais configuradas, chegando a ${brl(t.receita)} de receita anual (+15%) e ${brl(t.resultado)} de resultado, com margem de contribuição de ${pct(t.margemPct)}.`;
                } else {
                    const pos = m.filter(x=>x.resultado>0).length;
                    reading = t.resultado >= 0
                        ? `No cenário provável, o fechamento do ano projeta resultado positivo de ${brl(t.resultado)}, margem de contribuição de ${pct(t.margemPct)} e ${pos} meses positivos. O melhor mês é ${best.mes}, com ${brl(best.resultado)} de resultado.`
                        : `No cenário provável, a projeção anual indica resultado negativo de ${brl(Math.abs(t.resultado))}. Apenas ${pos} de ${m.length} meses são positivos; o ponto mais crítico é ${worst.mes}, com ${brl(worst.resultado)} de resultado.`;
                }
            }

            setText('pf-executive-reading',reading);
        }

        function renderScenarioComparison() {
            if (typeof ApexCharts === 'undefined') return;
            const backend = window.planejamentoFinanceiroBackend;
            if (!backend) return;

            const c = chartTheme();

            // Puxa os 3 cenários calculados
            const provavelRaw = getScenarioData(backend, 'provavel') || getScenarioData(backend, 'otimista');
            const otimRaw = getScenarioData(backend, 'otimista');
            const pessRaw = getScenarioData(backend, 'pessimista');

            // Normalizar
            const norm = (raw) => {
                if (!raw || !Array.isArray(raw.meses) || !raw.meses.length) return null;
                const meses = raw.meses.map(normalizeMonth);
                return { meses };
            };

            const provavel = norm(provavelRaw);
            const otimista = norm(otimRaw);
            const pessimista = norm(pessRaw);

            if (!provavel) return;

            // Calcular totais de cada cenário
            const tProv = totals(provavel);
            const tOti = otimista ? totals(otimista) : tProv;
            const tPes = pessimista ? totals(pessimista) : tProv;

            const nProv = provavel.meses.length || 12;
            const nOti = otimista ? otimista.meses.length : nProv;
            const nPes = pessimista ? pessimista.meses.length : nProv;

            const scenarioLabels = ['Cenário Provável', 'Cenário Otimista', 'Cenário Pessimista'];

            function scenarioBarChart(selector, name, seriesData, colors) {
                const opts = baseChartOptions('bar');
                Object.assign(opts, {
                    series: seriesData.map(s => ({ name: s.name, data: s.data.map(v => Number(v.toFixed(2))) })),
                    colors: colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
                    chart: { ...opts.chart, height: 260 },
                    plotOptions: {
                        bar: {
                            columnWidth: '55%',
                            borderRadius: 4
                        }
                    },
                    dataLabels: { enabled: false },
                    xaxis: { ...opts.xaxis, categories: scenarioLabels },
                    yaxis: {
                        labels: {
                            formatter: (v) => brl(v)
                        }
                    },
                    legend: { show: true, position: 'top', fontSize: '12px' },
                    tooltip: {
                        shared: true,
                        intersect: false,
                        y: { formatter: (v) => brl(v) }
                    }
                });
                mountChart(name, selector, opts);
            }

            function scenarioBarPctChart(selector, name, seriesData, colors) {
                const opts = baseChartOptions('bar');
                Object.assign(opts, {
                    series: seriesData.map(s => ({ name: s.name, data: s.data.map(v => Number(v.toFixed(2))) })),
                    colors: colors || ['#f59e0b', '#3b82f6'],
                    chart: { ...opts.chart, height: 260 },
                    plotOptions: {
                        bar: {
                            columnWidth: '45%',
                            borderRadius: 4
                        }
                    },
                    dataLabels: { enabled: false },
                    xaxis: { ...opts.xaxis, categories: scenarioLabels },
                    yaxis: {
                        labels: {
                            formatter: (v) => pct(v)
                        }
                    },
                    legend: { show: true, position: 'top', fontSize: '12px' },
                    tooltip: {
                        shared: true,
                        intersect: false,
                        y: { formatter: (v) => pct(v) }
                    }
                });
                mountChart(name, selector, opts);
            }

            // 1. RECEITAS
            scenarioBarChart('#pf-chart-cenario-receitas', 'cenRecei', [
                { name: 'Receita Total', data: [tProv.receita, tOti.receita, tPes.receita] },
                { name: 'Receita Mensal Média', data: [tProv.receita / nProv, tOti.receita / nOti, tPes.receita / nPes] }
            ], ['#3b82f6', '#10b981']);

            // 2. DESPESAS
            const despProv = tProv.impostos + tProv.variaveis + tProv.fixos;
            const despOti = tOti.impostos + tOti.variaveis + tOti.fixos;
            const despPes = tPes.impostos + tPes.variaveis + tPes.fixos;
            scenarioBarChart('#pf-chart-cenario-despesas', 'cenDesp', [
                { name: 'Gastos Totais', data: [despProv, despOti, despPes] },
                { name: 'Gasto Fixo Mensal Médio', data: [tProv.fixos / nProv, tOti.fixos / nOti, tPes.fixos / nPes] },
                { name: 'Gasto Variável Mensal Médio', data: [tProv.variaveis / nProv, tOti.variaveis / nOti, tPes.variaveis / nPes] }
            ], ['#ef4444', '#f59e0b', '#8b5cf6']);

            // 3. INVESTIMENTOS
            scenarioBarChart('#pf-chart-cenario-investimentos', 'cenInv', [
                { name: 'Investimento Total', data: [tProv.investimentos, tOti.investimentos, tPes.investimentos] },
                { name: 'Investimento Mensal Médio', data: [tProv.investimentos / nProv, tOti.investimentos / nOti, tPes.investimentos / nPes] }
            ], ['#6366f1', '#a855f7']);

            // 4. RESULTADO DO EXERCÍCIO
            scenarioBarChart('#pf-chart-cenario-resultado', 'cenRes', [
                { name: 'Lucro Total', data: [tProv.resultado, tOti.resultado, tPes.resultado] },
                { name: 'Lucro Mensal Médio', data: [tProv.resultado / nProv, tOti.resultado / nOti, tPes.resultado / nPes] }
            ], ['#10b981', '#06b6d4']);

            // 5. ÍNDICES
            const rentProv = tProv.receita ? (tProv.resultado / tProv.receita) * 100 : 0;
            const rentOti = tOti.receita ? (tOti.resultado / tOti.receita) * 100 : 0;
            const rentPes = tPes.receita ? (tPes.resultado / tPes.receita) * 100 : 0;
            const lucratProv = despProv ? (tProv.resultado / despProv) * 100 : 0;
            const lucratOti = despOti ? (tOti.resultado / despOti) * 100 : 0;
            const lucratPes = despPes ? (tPes.resultado / despPes) * 100 : 0;

            scenarioBarPctChart('#pf-chart-cenario-indices', 'cenIdx', [
                { name: 'Rentabilidade (%)', data: [rentProv, rentOti, rentPes] },
                { name: 'Lucratividade (%)', data: [lucratProv, lucratOti, lucratPes] }
            ], ['#f59e0b', '#3b82f6']);

            // 6. TABELA RESUMO GERAL EM LARGURA TOTAL COM FORMATAÇÃO
            const resumoBody = $('pf-cenario-resumo-body');
            if (resumoBody) {
                const rows = [
                    ['Receita Total', brl(tProv.receita), brl(tOti.receita), brl(tPes.receita)],
                    ['Receita Mensal Média', brl(tProv.receita / nProv), brl(tOti.receita / nOti), brl(tPes.receita / nPes)],
                    ['Gastos Totais', brl(despProv), brl(despOti), brl(despPes)],
                    ['Gasto Fixo Mensal Médio', brl(tProv.fixos / nProv), brl(tOti.fixos / nOti), brl(tPes.fixos / nPes)],
                    ['Gasto Variável Mensal Médio', brl(tProv.variaveis / nProv), brl(tOti.variaveis / nOti), brl(tPes.variaveis / nPes)],
                    ['Investimento Total', brl(tProv.investimentos), brl(tOti.investimentos), brl(tPes.investimentos)],
                    ['Investimento Mensal Médio', brl(tProv.investimentos / nProv), brl(tOti.investimentos / nOti), brl(tPes.investimentos / nPes)],
                    ['Lucro Total', brl(tProv.resultado), brl(tOti.resultado), brl(tPes.resultado)],
                    ['Lucro Mensal Médio', brl(tProv.resultado / nProv), brl(tOti.resultado / nOti), brl(tPes.resultado / nPes)],
                    ['Rentabilidade', pct(rentProv), pct(rentOti), pct(rentPes)],
                    ['Lucratividade', pct(lucratProv), pct(lucratOti), pct(lucratPes)]
                ];
                resumoBody.innerHTML = rows.map(r =>
                    `<tr><th style="text-align:left;font-weight:700;padding:11px 18px;border-bottom:1px solid var(--borda);">${r[0]}</th>` +
                    `<td style="text-align:right;padding:11px 18px;font-weight:600;border-bottom:1px solid var(--borda);">${r[1]}</td>` +
                    `<td style="text-align:right;padding:11px 18px;font-weight:600;border-bottom:1px solid var(--borda);">${r[2]}</td>` +
                    `<td style="text-align:right;padding:11px 18px;font-weight:600;border-bottom:1px solid var(--borda);">${r[3]}</td></tr>`
                ).join('');
            }
        }

        function renderAll(raw) {
            const normalized = normalizeData(raw);
            currentData = normalized;
            if (!normalized) {
                ['pf-chart-receita','pf-chart-resultado','pf-chart-custos','pf-chart-anual-fluxo','pf-chart-anual-margem','pf-chart-anual-saidas','pf-chart-cenario-receitas','pf-chart-cenario-despesas','pf-chart-cenario-investimentos','pf-chart-cenario-resultado','pf-chart-cenario-indices'].forEach(id=>{
                    const el=$(id); if(el) el.innerHTML='<div class="pf-empty-chart"><div><i class="fa-solid fa-chart-column" style="font-size:1.4rem;margin-bottom:8px;"></i><br>Aguardando dados mensais do backend.</div></div>';
                });
                $('pf-monthly-head').innerHTML = `<tr><th>Conta</th>${MESES_PADRAO.map(m=>`<th>${m}</th>`).join('')}<th>Total/Média</th></tr>`;
                $('pf-monthly-body').innerHTML = `<tr><td colspan="14" style="text-align:center;padding:28px;color:var(--suave);">Aguardando dados do planejamento financeiro.</td></tr>`;
                return;
            }
            renderKPIs(normalized);
            renderMonthlyTable(normalized);
            renderAnnual(normalized);
            renderCharts(normalized);
            renderScenarioComparison();
            renderIaPanel(normalized);
        }

        function renderIaPanel(data) {
            iaAnaliseCache = { otimista: null, pessimista: null };

            const waitingIcon = $('pf-ia-waiting-icon');
            const waitingTitle = $('pf-ia-waiting-title');
            const waitingDesc = $('pf-ia-waiting-desc');
            if (waitingIcon) {
                waitingIcon.innerHTML = '<i class="fa-solid fa-robot"></i>';
                waitingIcon.style.background = 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))';
                waitingIcon.style.color = '#8b5cf6';
            }
            if (waitingTitle) waitingTitle.textContent = 'Pronto para analisar';
            if (waitingDesc) waitingDesc.innerHTML = 'Clique em <strong style="color:#6366f1;cursor:pointer;" onclick="window.pfTriggerIaAnalysis()">Analisar com IA</strong> acima para processar os dados da sua Tabela Mensal e preencher os cards com insights estratégicos.';

            const txtDiag = $('pf-ia-txt-diagnostico');
            const txtAlerta = $('pf-ia-txt-alertas');
            const txtRecom = $('pf-ia-txt-recomendacoes');
            if (txtDiag) txtDiag.textContent = 'Leitura executiva completa de receitas, despesas, margem e resultado acumulado do ano. Clique em "Analisar com IA" para gerar.';
            if (txtAlerta) txtAlerta.textContent = 'Identificação de meses críticos, crescimento de custos e desvios que merecem atenção imediata. Clique em "Analisar com IA" para gerar.';
            if (txtRecom) txtRecom.textContent = 'Sugestões práticas para melhorar margem, reduzir custos e aproveitar os meses de melhor desempenho. Clique em "Analisar com IA" para gerar.';

            const t = totals(data);
            const m = data.meses;
            const mesesPos = m.filter(x=>x.resultado>0).length;
            const best = [...m].sort((a,b)=>b.resultado-a.resultado)[0];
            const worst = [...m].sort((a,b)=>a.resultado-b.resultado)[0];

            const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            setEl('pf-ia-kpi-receita', brl(t.receita));
            const resEl = document.getElementById('pf-ia-kpi-resultado');
            if (resEl) { resEl.textContent = brl(t.resultado); resEl.style.color = t.resultado >= 0 ? '#16a34a' : '#dc2626'; }
            setEl('pf-ia-kpi-margem', pct(t.margemPct));
            setEl('pf-ia-kpi-meses', `${mesesPos}/${m.length}`);

            window._pfIaData = {
                totals: t,
                meses: m,
                best: best,
                worst: worst,
                mesesPos: mesesPos,
                scenario: scenario
            };
        }

        window.pfTriggerIaAnalysis = async function(foco) {
            if (!window._pfIaData) {
                alert('Carregue os dados do planejamento antes de solicitar a análise.');
                return;
            }

            const cenarioAtual = window._pfIaData.scenario || 'otimista';

            // Se já temos a análise no cache para este cenário, apenas usa ela
            if (iaAnaliseCache[cenarioAtual]) {
                exibirAnaliseIa(iaAnaliseCache[cenarioAtual], foco);
                return;
            }

            // Ativa o estado de carregamento
            const btnAnalisar = $('pf-ia-analisar-btn');
            const waitingCard = $('pf-ia-waiting-card');
            const waitingIcon = $('pf-ia-waiting-icon');
            const waitingTitle = $('pf-ia-waiting-title');
            const waitingDesc = $('pf-ia-waiting-desc');

            if (btnAnalisar) btnAnalisar.disabled = true;
            
            // Desabilita cliques nos botões temporariamente
            const botoesSecundarios = document.querySelectorAll('[onclick^="window.pfTriggerIaAnalysis("]');
            botoesSecundarios.forEach(btn => btn.style.pointerEvents = 'none');

            if (waitingCard) waitingCard.style.display = 'block';
            if (waitingIcon) {
                waitingIcon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
                waitingIcon.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))';
                waitingIcon.style.color = '#6366f1';
            }
            if (waitingTitle) waitingTitle.textContent = 'Processando dados financeiros...';
            if (waitingDesc) waitingDesc.innerHTML = 'Aguarde enquanto o DataInsight AI elabora o diagnóstico executivo com base nos dados da sua Tabela Mensal. Isso pode levar alguns segundos.';

            // Limpa os cards de texto para indicar que está calculando
            const txtDiag = $('pf-ia-txt-diagnostico');
            const txtAlerta = $('pf-ia-txt-alertas');
            const txtRecom = $('pf-ia-txt-recomendacoes');

            if (txtDiag) txtDiag.innerHTML = '<span style="color:var(--suave);"><i class="fa-solid fa-spinner fa-spin"></i> Analisando...</span>';
            if (txtAlerta) txtAlerta.innerHTML = '<span style="color:var(--suave);"><i class="fa-solid fa-spinner fa-spin"></i> Analisando...</span>';
            if (txtRecom) txtRecom.innerHTML = '<span style="color:var(--suave);"><i class="fa-solid fa-spinner fa-spin"></i> Analisando...</span>';

            try {
                const resposta = await fetch('/api/planejamento-financeiro/analise-ia', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        scenario: cenarioAtual,
                        data: window._pfIaData
                    }),
                    credentials: 'same-origin'
                });

                const resultado = await resposta.json();

                if (!resposta.ok || resultado.sucesso === false) {
                    throw new Error(resultado.mensagem || 'Falha ao conectar com o serviço de IA.');
                }

                // Salva no cache
                iaAnaliseCache[cenarioAtual] = resultado;

                // Exibe nos cards
                exibirAnaliseIa(resultado, foco);

            } catch (erro) {
                console.error('Erro na análise da IA:', erro);
                
                // Restaura textos de erro
                if (txtDiag) txtDiag.textContent = 'Não foi possível obter a análise de diagnóstico neste momento.';
                if (txtAlerta) txtAlerta.textContent = 'Não foi possível carregar os alertas neste momento.';
                if (txtRecom) txtRecom.textContent = 'Não foi possível carregar as recomendações neste momento.';

                if (waitingTitle) waitingTitle.textContent = 'Erro ao analisar';
                if (waitingDesc) waitingDesc.textContent = 'Ocorreu um problema ao se comunicar com a IA: ' + erro.message;
                if (waitingIcon) {
                    waitingIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
                    waitingIcon.style.color = 'var(--perigo)';
                    waitingIcon.style.background = 'rgba(220, 38, 38, 0.12)';
                }
            } finally {
                if (btnAnalisar) btnAnalisar.disabled = false;
                botoesSecundarios.forEach(btn => btn.style.pointerEvents = 'auto');
            }
        };

        function exibirAnaliseIa(resultado, foco) {
            const txtDiag = $('pf-ia-txt-diagnostico');
            const txtAlerta = $('pf-ia-txt-alertas');
            const txtRecom = $('pf-ia-txt-recomendacoes');

            if (txtDiag) txtDiag.innerHTML = resultado.diagnostico_geral || 'Sem diagnóstico disponível.';
            if (txtAlerta) txtAlerta.innerHTML = resultado.alertas_riscos || 'Sem alertas identificados.';
            
            if (txtRecom && Array.isArray(resultado.recomendacoes)) {
                txtRecom.innerHTML = '<ul style="margin: 0; padding-left: 16px; line-height: 1.6;">' + 
                    resultado.recomendacoes.map(rec => `<li>${rec}</li>`).join('') + 
                    '</ul>';
            } else if (txtRecom) {
                txtRecom.innerHTML = resultado.recomendacoes || 'Sem recomendações disponíveis.';
            }

            // Atualiza o waiting card para sucesso
            const waitingIcon = $('pf-ia-waiting-icon');
            const waitingTitle = $('pf-ia-waiting-title');
            const waitingDesc = $('pf-ia-waiting-desc');

            if (waitingIcon) {
                waitingIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
                waitingIcon.style.background = 'rgba(22, 163, 74, 0.12)';
                waitingIcon.style.color = '#16a34a';
            }
            if (waitingTitle) waitingTitle.textContent = 'Análise Concluída';
            if (waitingDesc) {
                const cenarioLabel = window._pfIaData.scenario === 'pessimista' ? 'Pessimista' : 'Otimista';
                waitingDesc.innerHTML = `Os insights estratégicos para o <strong>Cenário ${cenarioLabel}</strong> foram distribuídos nos cards acima com base nos dados reais da sua Tabela Mensal.`;
            }

            // Efeito visual e rolagem conforme o botão que foi pressionado
            let targetCardId = 'pf-ia-card-diagnostico-el';
            if (foco === 'alertas') {
                targetCardId = 'pf-ia-card-alertas-el';
            } else if (foco === 'oportunidades') {
                targetCardId = 'pf-ia-card-recomendacoes-el';
            }

            const card = $(targetCardId);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                highlightCard(card);
            }
        }

        function highlightCard(card) {
            const originalShadow = card.style.boxShadow;
            card.style.transform = 'scale(1.03)';
            card.style.boxShadow = '0 10px 25px rgba(99, 102, 241, 0.25)';
            
            setTimeout(() => {
                card.style.transform = '';
                card.style.boxShadow = originalShadow;
            }, 1000);
        }


        function setScenario(next) {
            scenario = next || 'provavel';

            document.querySelectorAll('.pf-scenario button').forEach(btn => {
                btn.classList.toggle(
                    'is-active',
                    btn.dataset.scenario === scenario
                );
            });

            const pessimista = scenario === 'pessimista';
            const otimista = scenario === 'otimista';
            const provavel = scenario === 'provavel';

            let statusTitle = 'Cenário Provável · Realizado + Média';
            let tableScenario = 'Cenário Provável';

            if (pessimista) {
                statusTitle = 'Cenário Pessimista · Ponto de Equilíbrio';
                tableScenario = 'Cenário Pessimista';
            } else if (otimista) {
                statusTitle = 'Cenário Otimista · Expansão Sustentável (+15%)';
                tableScenario = 'Cenário Otimista';
            }

            setText('pf-status-title', statusTitle);
            setText('pf-table-scenario', tableScenario);

            const status = document.querySelector('.pf-status');
            if (status) {
                status.classList.toggle('is-pessimista', pessimista);
                status.classList.toggle('is-otimista', otimista);
                status.classList.toggle('is-provavel', provavel);
            }

            const icon = document.querySelector('.pf-status__icon i');
            if (icon) {
                if (pessimista) {
                    icon.className = 'fa-solid fa-scale-balanced';
                } else if (otimista) {
                    icon.className = 'fa-solid fa-arrow-trend-up';
                } else {
                    icon.className = 'fa-solid fa-chart-line';
                }
            }

            const source = getScenarioData(
                window.planejamentoFinanceiroBackend,
                scenario
            );

            renderAll(source);

            window.dispatchEvent(
                new CustomEvent(
                    'datainsight:cenarioFinanceiroAlterado',
                    {
                        detail: {
                            cenario: scenario,
                            tipo: pessimista
                                ? 'ponto_equilibrio'
                                : otimista
                                    ? 'maximizacao_sustentavel_v1'
                                    : 'realizado_projetado_medio'
                        }
                    }
                )
            );
        }

        function setTab(tab) {
            document.querySelectorAll('.pf-tab').forEach(btn=>{
                const active = btn.dataset.tab===tab;
                btn.classList.toggle('is-active',active);
                btn.setAttribute('aria-selected',active?'true':'false');
            });
            document.querySelectorAll('.pf-panel').forEach(panel=>panel.hidden = panel.dataset.panel!==tab);
            if (currentData) {
                if (tab === 'geral' || tab === 'anual') {
                    setTimeout(() => {
                        renderCharts(currentData);
                        if (tab === 'anual') renderScenarioComparison();
                        window.dispatchEvent(new Event('resize'));
                    }, 50);
                }
            }
        }

        let _planilhasSumario = [];

        async function configurarSeletorPlanilhaPlanejamento() {
            const select = $('seletorPlanilhaAnalise');
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
                    opt.textContent = `${icone} [${p.dominio_label || 'Geral'}] ${p.nome} (${p.total_linhas || 0} linhas)`;
                    select.appendChild(opt);
                });

                const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
                if (salva && (salva === 'todas' || _planilhasSumario.some(p => p.id === salva))) {
                    select.value = salva;
                }

                atualizarBadgeStatusPlanejamento(_planilhasSumario, select.value);
            } catch (e) {
                console.warn('Não foi possível carregar sumário de planilhas no Planejamento Financeiro:', e);
            }
        }

        function atualizarBadgeStatusPlanejamento(planilhas, idSelecionado) {
            const container = $('pfStatusFontesContainer');
            if (!container) return;

            if (!idSelecionado || idSelecionado === 'todas') {
                const total = (planilhas && planilhas.length) || 0;
                container.innerHTML = `
                    <span class="badge" style="background:rgba(59,130,246,0.12); color:#3b82f6; border:1px solid rgba(59,130,246,0.25); padding:6px 12px; border-radius:14px; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-layer-group"></i> ${total} ${total === 1 ? 'planilha consolidada' : 'planilhas consolidadas'}
                    </span>
                `;
            } else {
                const p = planilhas ? planilhas.find(x => x.id === idSelecionado) : null;
                const nome = p ? p.nome : 'Planilha Selecionada';
                const dom = p ? (p.dominio_label || 'Individual') : 'Individual';
                container.innerHTML = `
                    <span class="badge" style="background:rgba(16,185,129,0.12); color:#10b981; border:1px solid rgba(16,185,129,0.25); padding:6px 12px; border-radius:14px; font-size:0.78rem; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-file-invoice"></i> ${nome} (${dom})
                    </span>
                `;
            }
        }

        document.querySelectorAll('.pf-tab').forEach(btn=>btn.addEventListener('click',()=>setTab(btn.dataset.tab)));
        document.querySelectorAll('.pf-scenario button').forEach(btn=>btn.addEventListener('click',()=>setScenario(btn.dataset.scenario)));

        const seletorPlanilha = $('seletorPlanilhaAnalise');
        if (seletorPlanilha) {
            seletorPlanilha.addEventListener('change', () => {
                const novaTabelaId = seletorPlanilha.value;
                localStorage.setItem('DataInsight_DashboardPlanilha', novaTabelaId);
                atualizarBadgeStatusPlanejamento(_planilhasSumario, novaTabelaId);
                iaAnaliseCache = { provavel: null, otimista: null, pessimista: null };
                carregarPlanejamentoFinanceiro(novaTabelaId);
            });
        }

        window.carregarPlanejamentoFinanceiro = carregarPlanejamentoFinanceiro;

        async function carregarPlanejamentoFinanceiro(tabelaId = 'todas') {
            const statusDesc = $('pf-status-desc');

            try {
                if (statusDesc) {
                    statusDesc.textContent = 'Carregando dados financeiros...';
                }

                const params = new URLSearchParams();
                params.set('tabela_id', tabelaId || 'todas');

                const resposta = await fetch(
                    `/api/planejamento-financeiro?${params.toString()}`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        credentials: 'same-origin'
                    }
                );

                const payload = await resposta.json();

                if (!resposta.ok || payload.sucesso === false) {
                    throw new Error(
                        payload.mensagem ||
                        payload.erro ||
                        `Erro HTTP ${resposta.status}`
                    );
                }

                window.planejamentoFinanceiroBackend = payload;
                setScenario(scenario);

                // Aviso quando taxa de imposto foi estimada automaticamente (8% padrão)
                const avisoImposto = document.getElementById('pf-aviso-imposto-estimado');
                if (avisoImposto) {
                    avisoImposto.style.display = payload.imposto_estimado ? '' : 'none';
                }

                const seletor = $('seletorPlanilhaAnalise');
                if (seletor && payload.escopo && seletor.value !== payload.escopo) {
                    const opcaoExiste = Array.from(seletor.options)
                        .some(opt => opt.value === payload.escopo);

                    if (opcaoExiste) {
                        seletor.value = payload.escopo;
                        atualizarBadgeStatusPlanejamento(_planilhasSumario, payload.escopo);
                    }
                }

                return payload;

            } catch (erro) {
                console.error(
                    'Erro ao carregar Planejamento Financeiro:',
                    erro
                );

                renderAll(null);

                if (statusDesc) {
                    statusDesc.textContent =
                        `Não foi possível carregar os dados financeiros: ${erro.message}`;
                }

                return null;
            }
        }

        /* API pública para o tech-leader atualizar a tela após fetch/IA/etc. */
        window.atualizarPlanejamentoFinanceiro = function(payload) {
            window.planejamentoFinanceiroBackend = payload;
            setScenario(scenario);
        };

        /* Se alternarTema() trocar classe/data-attribute, os gráficos se redesenham no tema novo. */
        new MutationObserver(()=>{ if(currentData) setTimeout(()=>renderCharts(currentData),80); })
            .observe(document.documentElement,{attributes:true,attributeFilter:['class','data-theme']});
        new MutationObserver(()=>{ if(currentData) setTimeout(()=>renderCharts(currentData),80); })
            .observe(document.body,{attributes:true,attributeFilter:['class','data-theme']});

        /* Inicializa a interface, preenche as planilhas do seletor e busca os dados da tabela ativa */
        async function inicializarPlanejamento() {
            const initial = getScenarioData(window.planejamentoFinanceiroBackend, scenario);
            renderAll(initial);

            await configurarSeletorPlanilhaPlanejamento();

            const tabelaInicial = $('seletorPlanilhaAnalise')?.value || localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
            await carregarPlanejamentoFinanceiro(tabelaInicial);
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', inicializarPlanejamento);
        } else {
            inicializarPlanejamento();
        }

        /* Aguarda o defer do ApexCharts sem bloquear o restante da interface. */
        let tries=0;
        const waitCharts=setInterval(()=>{
            tries++;
            if(typeof ApexCharts!=='undefined') { clearInterval(waitCharts); if(currentData) renderCharts(currentData); }
            if(tries>30) clearInterval(waitCharts);
        },100);
    })();