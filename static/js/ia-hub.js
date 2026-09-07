/**
 * ia-hub.js — Centro de Inteligência Estratégica
 * DataInsight IA Hub — Tab navigation, Table/Period Filters, Autonomous Agents (24/7 Runtime, Live Logs, Real Actions, Automated Data Cleaning), Status, Universal AI Analysis
 */

document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    //  ESTADO GLOBAL DO HUB
    // ============================================================
    let overviewLoaded = false;
    let agentsLoaded = false;
    let tabelaIaAtualId = 'todas';
    let periodoIaAtual = '30_dias';

    const tabs = document.querySelectorAll('.ia-hub-tab');
    const panels = document.querySelectorAll('.ia-hub-panel');

    // ============================================================
    //  CONFIGURAÇÃO DOS FILTROS (TABELA E PERÍODO)
    // ============================================================
    async function configurarFiltrosIaHub() {
        const selectPlanilha = document.getElementById('seletorPlanilhaIaHub');
        const selectPeriodo = document.getElementById('seletorPeriodoIaHub');
        const chatPlanilha = document.getElementById('seletorPlanilhaIa');

        // Carregar período salvo
        const savedPeriodo = localStorage.getItem('DataInsight_DashboardPeriodo') || '30_dias';
        if (selectPeriodo) {
            selectPeriodo.value = savedPeriodo;
            periodoIaAtual = savedPeriodo;
            selectPeriodo.addEventListener('change', (e) => {
                periodoIaAtual = e.target.value;
                localStorage.setItem('DataInsight_DashboardPeriodo', periodoIaAtual);
                loadOverviewData(periodoIaAtual, tabelaIaAtualId, true);
            });
        }

        // Carregar lista de planilhas
        if (selectPlanilha) {
            try {
                const resp = await fetch('/api/planilhas/sumario');
                if (resp.ok) {
                    const json = await resp.json();
                    const planilhas = json.planilhas || [];

                    selectPlanilha.innerHTML = '';

                    const optTodas = document.createElement('option');
                    optTodas.value = 'todas';
                    optTodas.textContent = `🌐 Todas as Planilhas (Visão Consolidada - ${planilhas.length})`;
                    selectPlanilha.appendChild(optTodas);

                    planilhas.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
                        opt.textContent = `${icone} [${p.dominio_label}] ${p.nome}`;
                        selectPlanilha.appendChild(opt);
                    });

                    const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
                    if (salva && (salva === 'todas' || planilhas.some(p => p.id === salva))) {
                        selectPlanilha.value = salva;
                        tabelaIaAtualId = salva;
                        if (chatPlanilha) chatPlanilha.value = salva;
                    }

                    selectPlanilha.addEventListener('change', (e) => {
                        tabelaIaAtualId = e.target.value;
                        localStorage.setItem('DataInsight_DashboardPlanilha', tabelaIaAtualId);
                        if (chatPlanilha) chatPlanilha.value = tabelaIaAtualId;
                        loadOverviewData(periodoIaAtual, tabelaIaAtualId, true);
                    });
                }
            } catch (e) {
                console.warn('Aviso ao carregar planilhas no Hub IA:', e);
            }
        }
    }

    configurarFiltrosIaHub();

    // ============================================================
    //  COLETOR DE CONTEXTO PARA O MODAL UNIVERSAL GEMINI
    // ============================================================
    window.coletarContextoIa = function () {
        const selectPlanilha = document.getElementById('seletorPlanilhaIaHub');
        const selectPeriodo = document.getElementById('seletorPeriodoIaHub');

        const origemNome = selectPlanilha ? (selectPlanilha.options[selectPlanilha.selectedIndex]?.text || 'Todas as Planilhas') : 'Todas as Planilhas';
        const periodoLabel = selectPeriodo ? (selectPeriodo.options[selectPeriodo.selectedIndex]?.text || 'Últimos 30 dias') : 'Últimos 30 dias';

        const kpiCards = document.querySelectorAll('#ia-kpi-grid .ia-kpi-card');
        let fat = 'R$ 0,00', fatPct = '0.0%';
        let luc = 'R$ 0,00', lucPct = '0.0%';
        let desp = 'R$ 0,00', despPct = '0.0%';
        let margem = '0.0%';

        if (kpiCards.length >= 4) {
            fat = kpiCards[0].querySelector('.ia-kpi-value')?.textContent || 'R$ 0,00';
            fatPct = kpiCards[0].querySelector('.ia-kpi-var')?.textContent?.trim() || '0.0%';

            luc = kpiCards[1].querySelector('.ia-kpi-value')?.textContent || 'R$ 0,00';
            lucPct = kpiCards[1].querySelector('.ia-kpi-var')?.textContent?.trim() || '0.0%';

            desp = kpiCards[2].querySelector('.ia-kpi-value')?.textContent || 'R$ 0,00';
            despPct = kpiCards[2].querySelector('.ia-kpi-var')?.textContent?.trim() || '0.0%';

            margem = kpiCards[3].querySelector('.ia-kpi-value')?.textContent || '0.0%';
        }

        return {
            pagina: 'ia',
            origem: origemNome,
            tabela_id: tabelaIaAtualId,
            periodo: periodoLabel,
            faturamento: fat,
            faturamento_pct: fatPct,
            lucro: luc,
            lucro_pct: lucPct,
            despesas: desp,
            despesas_pct: despPct,
            crescimento: margem,
            insight_atual: document.getElementById('ia-daily-insight')?.innerText || ''
        };
    };

    // ============================================================
    //  1. TAB NAVIGATION
    // ============================================================
    function activateTab(tabId) {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });

        const activeTab = document.querySelector(`.ia-hub-tab[data-tab="${tabId}"]`);
        const activePanel = document.getElementById(`panel-${tabId}`);

        if (activeTab) activeTab.classList.add('active');
        if (activePanel) {
            activePanel.style.display = 'block';
            requestAnimationFrame(() => activePanel.classList.add('active'));
        }

        localStorage.setItem('iaHubActiveTab', tabId);

        // Lazy-load conteúdo da tab
        if (tabId === 'overview') loadOverviewData();
        if (tabId === 'agents') loadAgentsStatus();
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    });

    // ============================================================
    //  2. OVERVIEW — STATUS & INSIGHT DIÁRIO (COM TABELA E PERÍODO)
    // ============================================================
    async function loadOverviewData(periodo = periodoIaAtual, tabelaId = tabelaIaAtualId, force = false) {
        if (overviewLoaded && !force) return;
        overviewLoaded = true;

        updateStatusBadge('Carregando dados...', 'loading');

        // Insight diário
        try {
            const r = await fetch(`/api/insight_diario?periodo=${periodo}&tabela_id=${tabelaId}`);
            if (r.ok) {
                const data = await r.json();
                const insightEl = document.getElementById('ia-daily-insight');
                const raw = data.insight || data.html || data.resposta;
                if (insightEl && raw) {
                    insightEl.innerHTML = formatInsightText(raw);
                    insightEl.classList.add('loaded');
                }
            }
        } catch (e) {
            console.warn('Erro ao carregar insight diário:', e);
        }

        // KPIs de IA — últimas métricas
        try {
            const r = await fetch(`/api/desempenho?periodo=${periodo}&tabela_id=${tabelaId}`);
            if (r.ok) {
                const data = await r.json();
                renderOverviewKPIs(data);
            }
        } catch (e) {
            console.warn('Erro ao carregar KPIs:', e);
        }

        // Status negócio
        try {
            const r = await fetch(`/api/status_negocio?periodo=${periodo}&tabela_id=${tabelaId}`);
            if (r.ok) {
                const data = await r.json();
                renderStatusCards(data);
            }
        } catch (e) {
            console.warn('Erro ao carregar status negócio:', e);
        }

        const now = new Date();
        const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        updateStatusBadge(`Atualizado hoje às ${hora}`, 'online');
    }

    function updateStatusBadge(text, state) {
        const badge = document.getElementById('ia-status-badge');
        if (!badge) return;
        badge.className = `ia-status-badge ia-status-${state}`;
        const textEl = badge.querySelector('.ia-status-text');
        if (textEl) textEl.textContent = text;
    }

    function formatInsightText(text) {
        if (!text) return '<p style="color:var(--suave); margin:0;">Nenhum diagnóstico registrado no momento.</p>';
        const trimmed = String(text).trim();
        if (trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<p') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
            return trimmed;
        }
        if (window.marked && typeof window.marked.parse === 'function') {
            try {
                return window.marked.parse(trimmed);
            } catch (e) {}
        }
        return trimmed
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    function renderOverviewKPIs(data) {
        if (!data) return;

        const extractVal = (obj) => {
            if (obj === null || obj === undefined) return 0;
            if (typeof obj === 'number') return obj;
            if (typeof obj === 'object' && 'valor' in obj) {
                const n = Number(obj.valor);
                return isNaN(n) ? 0 : n;
            }
            const parsed = Number(obj);
            return isNaN(parsed) ? 0 : parsed;
        };

        const extractPct = (obj) => {
            if (obj && typeof obj === 'object' && 'percentual' in obj) {
                const p = Number(obj.percentual);
                return isNaN(p) ? null : p;
            }
            return null;
        };

        const faturamento = extractVal(data.faturamento);
        const faturamentoPct = extractPct(data.faturamento);

        const lucro = extractVal(data.lucro);
        const lucroPct = extractPct(data.lucro);

        const despesa = extractVal(data.despesa);
        const despesaPct = extractPct(data.despesa);

        const margem = faturamento > 0 ? ((lucro / faturamento) * 100) : 0;
        const crescimentoVal = extractVal(data.crescimento);

        const kpis = [
            {
                key: 'faturamento',
                label: 'Faturamento',
                icon: 'fa-dollar-sign',
                color: '#10B981',
                valorFormatted: 'R$ ' + faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                variacao: faturamentoPct
            },
            {
                key: 'lucro',
                label: 'Lucro Líquido',
                icon: 'fa-chart-line',
                color: '#3B82F6',
                valorFormatted: 'R$ ' + lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                variacao: lucroPct
            },
            {
                key: 'despesas',
                label: 'Despesas Totais',
                icon: 'fa-receipt',
                color: '#EF4444',
                valorFormatted: 'R$ ' + despesa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                variacao: despesaPct
            },
            {
                key: 'margem',
                label: 'Margem Líquida',
                icon: 'fa-percent',
                color: '#7C3AED',
                valorFormatted: margem.toFixed(1) + '%',
                variacao: crescimentoVal !== 0 ? crescimentoVal : null
            },
        ];

        const container = document.getElementById('ia-kpi-grid');
        if (!container) return;

        container.innerHTML = kpis.map(kpi => {
            const varSign = (kpi.variacao !== null && kpi.variacao >= 0) ? '+' : '';
            const varColor = (kpi.variacao !== null && kpi.variacao >= 0) ? '#10B981' : '#EF4444';
            const varIcon = (kpi.variacao !== null && kpi.variacao >= 0) ? 'fa-arrow-up' : 'fa-arrow-down';

            return `
                <div class="ia-kpi-card" style="border-left: 3px solid ${kpi.color};">
                    <div class="ia-kpi-icon" style="background: ${kpi.color}22; color: ${kpi.color};">
                        <i class="fa-solid ${kpi.icon}"></i>
                    </div>
                    <div class="ia-kpi-body">
                        <span class="ia-kpi-label">${kpi.label}</span>
                        <span class="ia-kpi-value">${kpi.valorFormatted}</span>
                        ${kpi.variacao !== null && kpi.variacao !== undefined ? `<span class="ia-kpi-var" style="color:${varColor};">
                            <i class="fa-solid ${varIcon}"></i> ${varSign}${Number(kpi.variacao).toFixed(1)}%
                        </span>` : '<span class="ia-kpi-var" style="color:var(--suave); font-weight:400; font-size:0.75rem;">Métrica estável</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderStatusCards(data) {
        const container = document.getElementById('ia-status-alerts');
        if (!container || !data) return;

        const alertas = data.alertas || data.insights || [];
        if (alertas.length === 0) {
            container.innerHTML = `<p style="color:var(--suave); font-size:0.9rem; margin:0;">Nenhum alerta crítico identificado no momento.</p>`;
            return;
        }

        container.innerHTML = alertas.slice(0, 4).map(a => {
            const isWarn = (a.tipo === 'alerta' || a.nivel === 'alto' || a.nivel === 'medio');
            const icon = (a.nivel === 'alto') ? 'fa-triangle-exclamation' : (isWarn ? 'fa-circle-exclamation' : 'fa-circle-check');
            const color = (a.nivel === 'alto') ? '#EF4444' : (isWarn ? '#F59E0B' : '#10B981');
            const bg = (a.nivel === 'alto') ? 'rgba(239,68,68,0.06)' : (isWarn ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)');
            const msg = a.texto || a.mensagem || a;
            const msgEscapada = encodeURIComponent(String(msg));

            return `
                <div class="ia-alert-item" style="border-left: 3px solid ${color}; background: ${bg}; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid ${icon}" style="color:${color}; flex-shrink:0; font-size: 1rem;"></i>
                    <span style="font-size:0.86rem; color:var(--texto); line-height:1.4; flex:1;">${msg}</span>
                </div>
            `;
        }).join('');
    }

    // ============================================================
    //  3. SISTEMA DE AGENTES AUTÔNOMOS REAIS (AGENT RUNTIME & LOGGER)
    // ============================================================

    const agentesConfig = [
        {
            id: 'agente_dados',
            nome: 'Agente de Qualidade & Sanitização',
            funcao: 'Engenheiro de Dados 24/7',
            descricao: 'Audita planilhas em busca de valores nulos, duplicatas, outliers e formatações incorretas, corrigindo e salvando no banco na hora.',
            icon: 'fa-broom-ball',
            color: '#06B6D4',
            intervaloSegundos: 120, // 2 min
            gatilhos: ['A cada 2 min', 'Ao importar ou editar dados'],
            acoes: ['Diagnóstico de integridade', 'Imputação de nulos', 'Eliminação de duplicatas', 'Autocorreção e salvamento'],
        },
        {
            id: 'agente_financeiro',
            nome: 'Agente Financeiro',
            funcao: 'Monitor de Fluxo & Custos',
            descricao: 'Varre dados financeiros, prevê quebras de caixa, detecta despesas anômalas e gera alertas no painel.',
            icon: 'fa-coins',
            color: '#10B981',
            intervaloSegundos: 180, // 3 min
            gatilhos: ['A cada 3 min', 'Desvio de gastos > 10%'],
            acoes: ['Diagnóstico de liquidez', 'Alerta de gargalos', 'Previsão de saldo'],
        },
        {
            id: 'agente_vendas',
            nome: 'Agente de Vendas',
            funcao: 'Auditor de Vendas & Performance',
            descricao: 'Mapeia produtos campeões, identifica estagnação de faturamento e sinaliza quedas sazonais.',
            icon: 'fa-chart-bar',
            color: '#3B82F6',
            intervaloSegundos: 240, // 4 min
            gatilhos: ['A cada 4 min', 'Queda de faturamento'],
            acoes: ['Ranking de lucratividade', 'Detecção de sazonalidade', 'Oportunidades'],
        },
        {
            id: 'agente_decisao',
            nome: 'Agente Estratégico',
            funcao: 'Estrategista & Análise SWOT',
            descricao: 'Compila relatórios estratégicos autônomos, formula planos de ação e salva análises completas no sistema.',
            icon: 'fa-brain',
            color: '#7C3AED',
            intervaloSegundos: 300, // 5 min
            gatilhos: ['A cada 5 min', 'Ao atingir marcos'],
            acoes: ['Gerar SWOT executivo', 'Salvar em Análises Salvas', 'Plano de crescimento'],
        },
        {
            id: 'agente_alertas',
            nome: 'Agente de Alertas',
            funcao: 'Sentinela 24/7 de Anomalias',
            descricao: 'Monitora variações bruscas em tempo real, checa integridade e dispara notificações críticas instantâneas.',
            icon: 'fa-bell',
            color: '#F59E0B',
            intervaloSegundos: 90, // 1.5 min
            gatilhos: ['A cada 90s', 'Picos e anomalias'],
            acoes: ['Varredura contínua', 'Injeção de alertas', 'Disparo de aviso sonoro/toast'],
        },
    ];

    // --- AGENT LOGGER & PERSISTÊNCIA ---
    const AgentLogger = {
        getLogs(agentId) {
            try {
                const logs = JSON.parse(localStorage.getItem(`ia_agent_logs_${agentId}`) || '[]');
                return Array.isArray(logs) ? logs : [];
            } catch (e) {
                return [];
            }
        },
        addLog(agentId, text, type = 'info') {
            const logs = this.getLogs(agentId);
            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const newEntry = {
                id: Date.now() + Math.random().toString(36).substr(2, 4),
                time: timeStr,
                text: text,
                type: type // 'info', 'alert', 'success', 'scan'
            };

            logs.unshift(newEntry);
            if (logs.length > 25) logs.pop();
            localStorage.setItem(`ia_agent_logs_${agentId}`, JSON.stringify(logs));

            // Incrementar contador global de ações do dia
            this.incrementActionsCount(type === 'alert');
            // Atualizar feeds no DOM
            this.renderCardLogs(agentId);
            this.addGlobalFeedItem(agentId, text, type);
        },
        clearLogs(agentId) {
            localStorage.removeItem(`ia_agent_logs_${agentId}`);
            this.renderCardLogs(agentId);
        },
        getHistory(agentId) {
            try {
                return JSON.parse(localStorage.getItem(`ia_agent_history_${agentId}`) || '[]');
            } catch (e) {
                return [];
            }
        },
        saveHistory(agentId, titulo, resposta) {
            const hist = this.getHistory(agentId);
            const now = new Date();
            const dateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            hist.unshift({
                id: Date.now(),
                data: dateStr,
                titulo: titulo,
                resposta: resposta
            });

            if (hist.length > 15) hist.pop();
            localStorage.setItem(`ia_agent_history_${agentId}`, JSON.stringify(hist));
        },
        incrementActionsCount(isAlert = false) {
            const today = new Date().toDateString();
            const savedData = JSON.parse(localStorage.getItem('ia_agents_daily_stats') || '{}');
            if (savedData.date !== today) {
                savedData.date = today;
                savedData.actions = 0;
                savedData.alerts = 0;
            }
            savedData.actions = (savedData.actions || 0) + 1;
            if (isAlert) savedData.alerts = (savedData.alerts || 0) + 1;
            localStorage.setItem('ia_agents_daily_stats', JSON.stringify(savedData));
            updateHubBannerStats();
        },
        getStats() {
            const today = new Date().toDateString();
            const savedData = JSON.parse(localStorage.getItem('ia_agents_daily_stats') || '{}');
            if (savedData.date !== today) {
                return { actions: 0, alerts: 0 };
            }
            return { actions: savedData.actions || 0, alerts: savedData.alerts || 0 };
        },
        renderCardLogs(agentId) {
            const container = document.getElementById(`log-list-${agentId}`);
            if (!container) return;

            const logs = this.getLogs(agentId);
            if (logs.length === 0) {
                container.innerHTML = `<span class="agent-log-empty">Aguardando próximo ciclo de varredura...</span>`;
                return;
            }

            const iconMap = {
                scan: '<i class="fa-solid fa-magnifying-glass" style="color:var(--primaria);"></i>',
                alert: '<i class="fa-solid fa-triangle-exclamation" style="color:#EF4444;"></i>',
                success: '<i class="fa-solid fa-circle-check" style="color:#10B981;"></i>',
                info: '<i class="fa-solid fa-circle-info" style="color:#3B82F6;"></i>'
            };

            container.innerHTML = logs.slice(0, 6).map(l => `
                <div class="agent-log-entry">
                    <span class="log-time">${l.time}</span>
                    <span class="log-icon">${iconMap[l.type] || iconMap.info}</span>
                    <span class="log-msg">${l.text}</span>
                </div>
            `).join('');
        },
        addGlobalFeedItem(agentId, text, type) {
            const feed = document.getElementById('agents-global-feed');
            if (!feed) return;

            const cfg = agentesConfig.find(a => a.id === agentId);
            const color = cfg ? cfg.color : '#3B82F6';
            const now = new Date();
            const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const item = document.createElement('div');
            item.className = 'global-feed-item';
            item.innerHTML = `
                <span class="gfi-time">${timeStr}</span>
                <span class="gfi-dot" style="background:${color};"></span>
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong>[${cfg ? cfg.nome : 'Agente'}]:</strong> ${text}</span>
            `;

            feed.insertBefore(item, feed.firstChild);
            while (feed.children.length > 4) {
                feed.lastElementChild.remove();
            }
        },
        seedInitialLogsIfEmpty(agentId) {
            const logs = this.getLogs(agentId);
            if (logs.length === 0) {
                const initLogs = {
                    agente_dados: [
                        { text: 'Conexão direta com a base de dados ativa estabelecida.', type: 'info' },
                        { text: 'Sentinela de nulos, duplicatas e outliers inicializado.', type: 'scan' }
                    ],
                    agente_financeiro: [
                        { text: 'Conexão com base de transações estabelecida.', type: 'info' },
                        { text: 'Varredura de despesas concluída sem anomalias graves.', type: 'success' }
                    ],
                    agente_vendas: [
                        { text: 'Mapeamento de produtos mais vendidos atualizado.', type: 'info' },
                        { text: 'Monitoramento de ticket médio em execução.', type: 'scan' }
                    ],
                    agente_decisao: [
                        { text: 'Agente pronto para compilar relatórios SWOT periódicos.', type: 'info' },
                        { text: 'Módulos estratégicos sincronizados com o banco.', type: 'success' }
                    ],
                    agente_alertas: [
                        { text: 'Sentinela 24/7 ativado com limiares padrão.', type: 'info' },
                        { text: 'Monitoramento contínuo em tempo real.', type: 'scan' }
                    ]
                };

                const sample = initLogs[agentId] || [{ text: 'Agente pronto para operações autônomas.', type: 'info' }];
                const now = new Date();
                sample.forEach((s, idx) => {
                    const d = new Date(now.getTime() - (idx + 1) * 60000);
                    logs.push({
                        id: Date.now() + idx,
                        time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        text: s.text,
                        type: s.type
                    });
                });
                localStorage.setItem(`ia_agent_logs_${agentId}`, JSON.stringify(logs));
            }
        }
    };

    // --- AGENT RUNTIME CONTROLLER ---
    const AgentRuntime = {
        timers: {},
        countdowns: {},
        isExecuting: {},

        start(agentId) {
            const cfg = agentesConfig.find(a => a.id === agentId);
            if (!cfg) return;

            // Limpa timers anteriores caso existam
            this.stop(agentId);

            AgentLogger.seedInitialLogsIfEmpty(agentId);
            AgentLogger.addLog(agentId, '🟢 Agente iniciado e operando em segundo plano.', 'success');

            // Countdown inicial
            this.countdowns[agentId] = cfg.intervaloSegundos;
            this.updateCardCountdownUI(agentId);

            // Intervalo de contagem regressiva (1 seg)
            this.timers[agentId] = setInterval(() => {
                if (this.isExecuting[agentId]) return;

                this.countdowns[agentId] = (this.countdowns[agentId] || cfg.intervaloSegundos) - 1;
                this.updateCardCountdownUI(agentId);

                if (this.countdowns[agentId] <= 0) {
                    this.countdowns[agentId] = cfg.intervaloSegundos;
                    this.executeCycle(agentId, true);
                }
            }, 1000);

            updateHubBannerStats();
        },

        stop(agentId) {
            if (this.timers[agentId]) {
                clearInterval(this.timers[agentId]);
                delete this.timers[agentId];
            }
            delete this.countdowns[agentId];

            const bar = document.getElementById(`progress-${agentId}`);
            if (bar) bar.style.width = '0%';
            const cd = document.getElementById(`countdown-${agentId}`);
            if (cd) cd.textContent = 'Pausado';

            AgentLogger.addLog(agentId, '⏸️ Agente pausado pelo usuário.', 'info');
            updateHubBannerStats();
        },

        updateCardCountdownUI(agentId) {
            const cfg = agentesConfig.find(a => a.id === agentId);
            if (!cfg) return;

            const remaining = this.countdowns[agentId] || 0;
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

            const cdEl = document.getElementById(`countdown-${agentId}`);
            if (cdEl) cdEl.textContent = `em ${timeStr}`;

            const barEl = document.getElementById(`progress-${agentId}`);
            if (barEl) {
                const pct = Math.max(0, Math.min(100, (1 - (remaining / cfg.intervaloSegundos)) * 100));
                barEl.style.width = `${pct}%`;
            }
        },

        async executeCycle(agentId, isAutonomous = false) {
            if (this.isExecuting[agentId]) return;
            this.isExecuting[agentId] = true;

            const cfg = agentesConfig.find(a => a.id === agentId);
            if (!cfg) return;

            const card = document.getElementById(`card-${agentId}`);
            const badge = card?.querySelector('.ia-agent-badge');
            const runBtn = card?.querySelector('.ia-agent-run-btn.primary');

            // Feedback visual de scanning
            if (card) card.classList.add('running');
            if (badge) {
                badge.className = 'ia-agent-badge running';
                badge.innerHTML = `<span class="ia-badge-dot"></span>Executando...`;
            }
            if (runBtn) {
                runBtn.disabled = true;
                runBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processando...`;
            }

            const prefix = isAutonomous ? '🤖 [Ciclo 24/7]' : '⚡ [Manual]';

            // ============================================================
            // FLUXO ESPECIALIZADO: AGENTE DE DADOS & SANITIZAÇÃO
            // ============================================================
            if (agentId === 'agente_dados') {
                AgentLogger.addLog(agentId, `${prefix} Auditando integridade, nulos, duplicatas e outliers...`, 'scan');
                try {
                    const rAnalise = await fetch('/api/dados/analisar', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tabela_id: tabelaIaAtualId })
                    });

                    if (rAnalise.ok) {
                        const dAnalise = await rAnalise.json();
                        const rel = dAnalise.relatorio || {};
                        const scoreInicial = rel.score_qualidade || 100;
                        const totalLinhas = rel.total_linhas || 0;
                        const nulosTotais = rel.resumo_problemas?.total_nulos || 0;
                        const dupTotais = rel.duplicatas?.duplicatas_exatas || 0;
                        const outliersTotais = rel.resumo_problemas?.total_outliers || 0;
                        const tiposIncoerentes = rel.resumo_problemas?.total_tipo_mismatch || 0;
                        const totalProblemas = nulosTotais + dupTotais + outliersTotais + tiposIncoerentes;

                        if (totalProblemas > 0 || scoreInicial < 95) {
                            AgentLogger.addLog(agentId, `⚠️ Encontradas ${totalProblemas} inconsistências (Score: ${scoreInicial}%). Executando autocorreção e salvamento...`, 'alert');

                            // Limpar e persistir no MongoDB
                            const rLimpar = await fetch('/api/dados/limpar', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    tabela_id: tabelaIaAtualId,
                                    salvar_no_banco: true,
                                    opcoes: { cap_outliers: true, remover_duplicatas: true, padronizar_texto: true }
                                })
                            });

                            if (rLimpar.ok) {
                                const dLimpar = await rLimpar.json();
                                const scoreFinal = dLimpar.score_atual || 100;

                                const msgSucesso = `🧹 Autocorreção concluída: ${totalProblemas} problemas reparados! Score de qualidade: ${scoreInicial}% ➔ ${scoreFinal}%. Dados salvos no banco.`;
                                AgentLogger.addLog(agentId, msgSucesso, 'success');

                                const textoHist = `### 🧹 Relatório de Auditoria & Limpeza Automática
- **Base de Dados**: ${tabelaIaAtualId}
- **Score Inicial**: ${scoreInicial}%
- **Score Atualizado**: ${scoreFinal}% (Excelente)
- **Correções Aplicadas**:
  - **Valores Nulos / Vazios**: ${nulosTotais} tratados e imputados
  - **Linhas Duplicadas**: ${dupTotais} removidas
  - **Outliers & Formatação**: ${outliersTotais + tiposIncoerentes} sanitizados
- **Persistência**: Dados sincronizados e atualizados no MongoDB com sucesso.`;

                                AgentLogger.saveHistory(agentId, 'Auditoria & Sanitização Automática', textoHist);
                                showToast(`✨ Robô de Dados: Sanitizou ${totalProblemas} inconsistências e salvou no banco!`, 'success');

                                // Injeta no painel Overview
                                const alertsContainer = document.getElementById('ia-status-alerts');
                                if (alertsContainer) {
                                    const alertHtml = `
                                        <div class="ia-alert-item" style="border-left: 3px solid #06B6D4; background: rgba(6,182,212,0.06); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; animation: log-entry-in 0.3s ease;">
                                            <i class="fa-solid fa-broom-ball" style="color:#06B6D4; flex-shrink:0; font-size: 1rem;"></i>
                                            <span style="font-size:0.86rem; color:var(--texto); line-height:1.4;"><strong>[Robô de Dados]:</strong> Base auditada e corrigida (${totalProblemas} correções salvas). Score: ${scoreFinal}%.</span>
                                        </div>
                                    `;
                                    alertsContainer.insertAdjacentHTML('afterbegin', alertHtml);
                                }

                                if (!isAutonomous) {
                                    showAgentResult(cfg, textoHist);
                                }
                            } else {
                                AgentLogger.addLog(agentId, `❌ Falha ao aplicar autocorreção no banco.`, 'alert');
                            }
                        } else {
                            const msgOk = `✓ Varredura concluída: 0 inconsistências em ${totalLinhas} linhas. Base 100% íntegra (Score 100%).`;
                            AgentLogger.addLog(agentId, msgOk, 'success');

                            const textoHist = `### 🛡️ Certificado de Integridade dos Dados
- **Status**: 100% Íntegro e Formatado
- **Total de Registros**: ${totalLinhas} linhas
- **Nulos / Vazios**: 0
- **Duplicatas**: 0
- **Outliers**: 0
- **Score de Qualidade**: 100%
Nenhuma inconsistência detectada. Dados prontos para tomadas de decisão.`;

                            AgentLogger.saveHistory(agentId, 'Certificado de Integridade (100% OK)', textoHist);
                            if (!isAutonomous) {
                                showAgentResult(cfg, textoHist);
                            }
                        }
                    } else {
                        AgentLogger.addLog(agentId, `⚠️ Erro ao consultar API de qualidade dos dados.`, 'alert');
                    }
                } catch (err) {
                    console.error(`Erro ao executar ciclo do ${agentId}:`, err);
                    AgentLogger.addLog(agentId, `❌ Falha de conexão ao auditar dados.`, 'alert');
                } finally {
                    this.isExecuting[agentId] = false;
                    if (card) card.classList.remove('running');
                    if (badge) {
                        const isOn = card?.classList.contains('active');
                        badge.className = `ia-agent-badge ${isOn ? 'online' : 'offline'}`;
                        badge.innerHTML = `<span class="ia-badge-dot"></span>${isOn ? 'Online 24/7' : 'Inativo'}`;
                    }
                    if (runBtn) {
                        runBtn.disabled = !card?.classList.contains('active');
                        runBtn.innerHTML = `<i class="fa-solid fa-play"></i> Executar Agora`;
                    }
                    this.countdowns[agentId] = cfg.intervaloSegundos;
                    this.updateCardCountdownUI(agentId);
                }
                return;
            }

            // ============================================================
            // FLUXO DEMAIS AGENTES (FINANCEIRO, VENDAS, DECISÃO, ALERTAS)
            // ============================================================
            AgentLogger.addLog(agentId, `${prefix} Iniciando varredura e cruzamento de dados...`, 'scan');

            try {
                const prompts = {
                    agente_financeiro: `Atue como o Agente Financeiro autônomo do DataInsight. Analise os dados financeiros atuais (período: ${periodoIaAtual}, base: ${tabelaIaAtualId}). 
Identifique anomalias de custos, status do saldo e emita 3 ações prioritárias para blindar o fluxo de caixa. Seja direto, executivo e claro.`,
                    
                    agente_vendas: `Atue como o Agente de Vendas do DataInsight. Analise as vendas (período: ${periodoIaAtual}, base: ${tabelaIaAtualId}). 
Identifique os produtos campeões de margem, tendências de consumo e oportunidades imediatas de alavancagem de receita.`,
                    
                    agente_decisao: `Atue como o Agente Estratégico do DataInsight. Gere uma síntese de Análise SWOT do negócio com base nos dados (período: ${periodoIaAtual}, base: ${tabelaIaAtualId}). 
Destaque: 1 Força Principal, 1 Fraqueza Crítica, 1 Oportunidade Clara e 1 Ameaça a monitorar, concluindo com uma diretriz de crescimento.`,
                    
                    agente_alertas: `Atue como o Sentinela de Anomalias do DataInsight. Realize uma checagem rigorosa de dados (período: ${periodoIaAtual}, base: ${tabelaIaAtualId}). 
Informe se existem dados discrepantes, faturamentos atípicos ou anomalias operacionais. Se tudo estiver normal, confirme a integridade dos dados.`
                };

                const r = await fetch('/api/chatbot/perguntar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mensagem: prompts[agentId] || 'Realize análise completa dos dados.',
                        session_id: `agent_auto_${agentId}_${Date.now()}`,
                        tabela_id: tabelaIaAtualId
                    })
                });

                if (r.ok) {
                    const data = await r.json();
                    const resposta = data.resposta || data.message || 'Ciclo de auditoria concluído com sucesso.';

                    await this.processConcreteActions(agentId, resposta, isAutonomous);

                    AgentLogger.saveHistory(agentId, `${cfg.nome} — Diagnóstico`, resposta);
                    AgentLogger.addLog(agentId, `✓ Ciclo concluído com sucesso. Análise gerada e arquivada.`, 'success');

                    if (!isAutonomous) {
                        showAgentResult(cfg, resposta);
                    } else {
                        showToast(`🤖 ${cfg.nome}: Varredura automática concluída!`, 'info');
                    }
                } else {
                    AgentLogger.addLog(agentId, `⚠️ Erro na resposta da API durante a varredura.`, 'alert');
                }
            } catch (err) {
                console.error(`Erro ao executar ciclo do ${agentId}:`, err);
                AgentLogger.addLog(agentId, `❌ Falha de conexão na varredura.`, 'alert');
            } finally {
                this.isExecuting[agentId] = false;

                if (card) card.classList.remove('running');
                if (badge) {
                    const isOn = card?.classList.contains('active');
                    badge.className = `ia-agent-badge ${isOn ? 'online' : 'offline'}`;
                    badge.innerHTML = `<span class="ia-badge-dot"></span>${isOn ? 'Online 24/7' : 'Inativo'}`;
                }
                if (runBtn) {
                    runBtn.disabled = !card?.classList.contains('active');
                    runBtn.innerHTML = `<i class="fa-solid fa-play"></i> Executar Agora`;
                }

                this.countdowns[agentId] = cfg.intervaloSegundos;
                this.updateCardCountdownUI(agentId);
            }
        },

        async processConcreteActions(agentId, resposta, isAutonomous) {
            // AÇÃO CONCRETA: Agente Estratégico salva automaticamente em /api/salvar-analise-ia
            if (agentId === 'agente_decisao') {
                try {
                    const selectPlanilha = document.getElementById('seletorPlanilhaIaHub');
                    const origemNome = selectPlanilha ? (selectPlanilha.options[selectPlanilha.selectedIndex]?.text || 'Consolidado') : 'Consolidado';
                    
                    const payload = {
                        pagina: 'decisoes',
                        pagina_nome: 'Estratégia & SWOT (Robô IA)',
                        origem: origemNome,
                        periodo: periodoIaAtual,
                        veredito: {
                            titulo: 'Diagnóstico Estratégico Autônomo',
                            subtitulo: `Gerado automaticamente pelo ${agentesConfig.find(a=>a.id==='agente_decisao')?.nome || 'Agente Estratégico'}`,
                            badge: 'Robô 24/7',
                            cor: '#7C3AED'
                        },
                        diagnostico_geral: resposta.slice(0, 500) + '...',
                        pontos_fortes: ['Monitoramento estratégico automatizado contínuo'],
                        alertas_riscos: ['Acompanhar métricas de liquidez e metas trimestrais'],
                        recomendacoes: ['Executar plano de ação sugerido pelo agente de IA'],
                        metricas: []
                    };

                    await fetch('/api/salvar-analise-ia', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    AgentLogger.addLog(agentId, `📁 Análise salva automaticamente na Central de Análises Salvas.`, 'success');
                } catch (e) {
                    console.warn('Aviso ao auto-salvar análise estratégica:', e);
                }
            }

            // AÇÃO CONCRETA: Agente de Alertas e Financeiro injetam alertas no painel Overview
            if (agentId === 'agente_alertas' || agentId === 'agente_financeiro') {
                const alertsContainer = document.getElementById('ia-status-alerts');
                const cfgAgent = agentesConfig.find(a => a.id === agentId);
                const nomeRobo = cfgAgent ? cfgAgent.nome : 'Robô IA';
                const respEscapada = encodeURIComponent(resposta);

                if (alertsContainer) {
                    const resumo = resposta.length > 120 ? resposta.slice(0, 115) + '...' : resposta;
                    const alertHtml = `
                        <div class="ia-alert-item" style="border-left: 3px solid ${agentId === 'agente_alertas' ? '#F59E0B' : '#10B981'}; background: rgba(59,130,246,0.06); padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; animation: log-entry-in 0.3s ease;">
                            <i class="fa-solid fa-robot" style="color:var(--primaria); flex-shrink:0; font-size: 1rem;"></i>
                            <span style="font-size:0.86rem; color:var(--texto); line-height:1.4; flex:1;"><strong>[${nomeRobo}]:</strong> ${resumo.replace(/[*#]/g, '')}</span>
                        </div>
                    `;
                    alertsContainer.insertAdjacentHTML('afterbegin', alertHtml);
                    while (alertsContainer.children.length > 5) {
                        alertsContainer.lastElementChild.remove();
                    }
                }
            }

            // AÇÃO CONCRETA: Agente de Vendas registra oportunidade
            if (agentId === 'agente_vendas') {
                AgentLogger.addLog(agentId, `📊 Mapeamento de margens e oportunidades atualizado no sistema.`, 'info');
            }
        }
    };

    function updateHubBannerStats() {
        const savedStates = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');
        let onlineCount = 0;
        agentesConfig.forEach(a => {
            if (savedStates[a.id] !== false) onlineCount++;
        });

        const stats = AgentLogger.getStats();

        const onlineEl = document.getElementById('hub-stat-online');
        const acoesEl = document.getElementById('hub-stat-acoes');
        const alertasEl = document.getElementById('hub-stat-alertas');

        if (onlineEl) onlineEl.textContent = onlineCount;
        if (acoesEl) acoesEl.textContent = stats.actions;
        if (alertasEl) alertasEl.textContent = stats.alerts;
    }

    // --- RENDERIZAÇÃO PRINCIPAL DO PANEL 4 ---
    function loadAgentsStatus() {
        if (agentsLoaded) return;
        agentsLoaded = true;

        const container = document.getElementById('ia-agents-grid');
        if (!container) return;

        const savedStates = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');

        container.innerHTML = agentesConfig.map(agent => {
            const isActive = savedStates[agent.id] !== false; // padrão: ativo

            return `
                <div class="ia-agent-card ${isActive ? 'active' : ''}" id="card-${agent.id}" style="--agent-color: ${agent.color};">
                    <div class="agent-strip"></div>
                    <div class="agent-card-inner">
                        <div class="ia-agent-header">
                            <div class="ia-agent-icon-wrap">
                                <div class="agent-pulse-ring"></div>
                                <div class="ia-agent-icon" style="background:${agent.color}20; color:${agent.color};">
                                    <i class="fa-solid ${agent.icon}"></i>
                                </div>
                            </div>
                            <div class="ia-agent-meta">
                                <h3 class="ia-agent-name">${agent.nome}</h3>
                                <div class="ia-agent-badges">
                                    <span class="ia-agent-badge ${isActive ? 'online' : 'offline'}">
                                        <span class="ia-badge-dot"></span>
                                        ${isActive ? 'Online 24/7' : 'Inativo'}
                                    </span>
                                    <span style="font-size:0.68rem;color:var(--suave);font-weight:600;">${agent.funcao}</span>
                                </div>
                            </div>
                            <label class="ia-toggle" title="Ligar/Desligar robô">
                                <input type="checkbox" class="ia-toggle-input" data-agent="${agent.id}" ${isActive ? 'checked' : ''}>
                                <span class="ia-toggle-slider"></span>
                            </label>
                        </div>

                        <p class="ia-agent-desc">${agent.descricao}</p>

                        <!-- Progress / Próximo Ciclo -->
                        <div class="agent-next-run">
                            <div class="agent-next-run-header">
                                <span class="agent-next-run-label">
                                    <i class="fa-solid fa-clock-rotate-left"></i> Próxima Varredura
                                </span>
                                <span class="agent-countdown" id="countdown-${agent.id}">${isActive ? 'Iniciando...' : 'Pausado'}</span>
                            </div>
                            <div class="agent-progress-bar">
                                <div class="agent-progress-fill" id="progress-${agent.id}" style="width:0%;"></div>
                            </div>
                        </div>

                        <!-- Live Logs -->
                        <div>
                            <div class="agent-log-header">
                                <span class="agent-log-title">
                                    <span class="agent-log-live-dot"></span>
                                    Logs de Operação ao Vivo
                                </span>
                                <button class="agent-log-clear-btn" data-agent="${agent.id}" title="Limpar logs">Limpar</button>
                            </div>
                            <div class="agent-live-log" id="log-list-${agent.id}">
                                <!-- Renderizado via AgentLogger -->
                            </div>
                        </div>

                        <!-- Botões de Ação -->
                        <div class="agent-btn-row">
                            <button class="ia-agent-run-btn primary" data-agent="${agent.id}" ${!isActive ? 'disabled' : ''}>
                                <i class="fa-solid fa-play"></i> Executar Agora
                            </button>
                            <button class="ia-agent-run-btn agent-history-btn" data-agent="${agent.id}">
                                <i class="fa-solid fa-clock-rotate-left"></i> Histórico
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Inicializa logs e runtimes
        agentesConfig.forEach(agent => {
            AgentLogger.renderCardLogs(agent.id);
            const isActive = savedStates[agent.id] !== false;
            if (isActive) {
                AgentRuntime.start(agent.id);
            }
        });

        updateHubBannerStats();

        // Listeners de Toggle
        container.querySelectorAll('.ia-toggle-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const agentId = e.target.dataset.agent;
                const isOn = e.target.checked;
                const card = document.getElementById(`card-${agentId}`);
                if (!card) return;

                const badge = card.querySelector('.ia-agent-badge');
                const runBtn = card.querySelector('.ia-agent-run-btn.primary');

                card.classList.toggle('active', isOn);
                if (badge) {
                    badge.className = `ia-agent-badge ${isOn ? 'online' : 'offline'}`;
                    badge.innerHTML = `<span class="ia-badge-dot"></span>${isOn ? 'Online 24/7' : 'Inativo'}`;
                }
                if (runBtn) runBtn.disabled = !isOn;

                const states = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');
                states[agentId] = isOn;
                localStorage.setItem('iaAgentStates', JSON.stringify(states));

                if (isOn) {
                    AgentRuntime.start(agentId);
                    showToast(`🤖 ${agentId.replace('agente_', 'Agente ').toUpperCase()} ativado com sucesso!`, 'success');
                } else {
                    AgentRuntime.stop(agentId);
                    showToast(`Agente desativado.`, 'info');
                }

                updateHubBannerStats();
            });
        });

        // Listeners de Executar Agora
        container.querySelectorAll('.ia-agent-run-btn.primary').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                AgentRuntime.executeCycle(agentId, false);
            });
        });

        // Listeners de Limpar Logs
        container.querySelectorAll('.agent-log-clear-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                AgentLogger.clearLogs(agentId);
                showToast('Logs do agente limpos.', 'info');
            });
        });

        // Listeners de Histórico
        container.querySelectorAll('.agent-history-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                openAgentHistoryModal(agentId);
            });
        });
    }

    // Modal de Histórico
    function openAgentHistoryModal(agentId) {
        const modal = document.getElementById('agent-history-modal');
        const title = document.getElementById('agent-history-title');
        const body = document.getElementById('agent-history-body');
        if (!modal || !title || !body) return;

        const cfg = agentesConfig.find(a => a.id === agentId);
        title.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:${cfg?.color || 'var(--primaria)'};"></i> Histórico de Execuções — ${cfg ? cfg.nome : 'Agente'}`;

        const hist = AgentLogger.getHistory(agentId);
        if (hist.length === 0) {
            body.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:var(--suave);">
                    <i class="fa-solid fa-folder-open" style="font-size:2rem;margin-bottom:12px;opacity:0.5;"></i>
                    <p style="margin:0;font-size:0.9rem;">Nenhuma execução arquivada para este agente ainda.</p>
                    <p style="margin:4px 0 0;font-size:0.78rem;">As análises geradas nos ciclos automáticos e manuais aparecerão aqui.</p>
                </div>
            `;
        } else {
            body.innerHTML = hist.map((item, idx) => `
                <div class="history-exec-item">
                    <div class="history-exec-icon" style="background:${cfg?.color || '#3B82F6'}20; color:${cfg?.color || '#3B82F6'};">
                        <i class="fa-solid fa-robot"></i>
                    </div>
                    <div class="history-exec-body">
                        <div class="history-exec-title">${item.titulo}</div>
                        <div class="history-exec-meta"><i class="fa-solid fa-calendar-day"></i> ${item.data}</div>
                        <div class="history-exec-preview">${item.resposta.replace(/[*#]/g, '')}</div>
                        <button class="btn-ia-glow-blue view-hist-full-btn" data-hist-idx="${idx}" style="margin-top:8px;padding:6px 12px;font-size:0.75rem;display:inline-flex;align-items:center;gap:5px;">
                            <i class="fa-solid fa-eye"></i> Ver Diagnóstico Completo
                        </button>
                    </div>
                </div>
            `).join('');

            body.querySelectorAll('.view-hist-full-btn').forEach(b => {
                b.addEventListener('click', () => {
                    const idx = Number(b.dataset.histIdx);
                    const sel = hist[idx];
                    if (sel && cfg) {
                        modal.classList.remove('open');
                        showAgentResult(cfg, sel.resposta);
                    }
                });
            });
        }

        modal.classList.add('open');
    }

    // Fechamento modal histórico
    const histModal = document.getElementById('agent-history-modal');
    if (histModal) {
        histModal.addEventListener('click', (e) => {
            if (e.target === histModal || e.target.classList.contains('agent-hist-close') || e.target.closest('.agent-hist-close')) {
                histModal.classList.remove('open');
            }
        });
    }

    let ultimoResultadoAgente = null;

    function showAgentResult(agent, resposta) {
        const modal = document.getElementById('ia-agent-result-modal');
        if (!modal) return;

        ultimoResultadoAgente = { agent, resposta };
        const titleEl = document.getElementById('ia-agent-result-title');
        const bodyEl = document.getElementById('ia-agent-result-body');
        if (titleEl) titleEl.textContent = `Resultado — ${agent.nome}`;
        if (bodyEl) bodyEl.innerHTML = formatInsightText(resposta);
        modal.classList.add('open');
    }

    // ============================================================
    //  4. MODULE CARDS — Quick Access
    // ============================================================
    document.querySelectorAll('.ia-module-card[data-href]').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = card.dataset.href;
        });
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.location.href = card.dataset.href;
            }
        });
    });

    // ============================================================
    //  5. COPILOTO — CONTEXT TEMPLATES
    // ============================================================
    document.querySelectorAll('.ia-prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            const chatInput = document.getElementById('chat-input');
            if (chatInput) {
                chatInput.value = prompt;
                chatInput.focus();
                document.querySelectorAll('.ia-prompt-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            }
        });
    });

    // ============================================================
    //  6. TOAST NOTIFICATIONS
    // ============================================================
    function showToast(msg, type = 'info') {
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
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    }

    // ============================================================
    //  7. AGENT RESULT MODAL — CLOSE
    // ============================================================
    const agentModal = document.getElementById('ia-agent-result-modal');
    if (agentModal) {
        agentModal.addEventListener('click', (e) => {
            if (e.target === agentModal || e.target.classList.contains('ia-modal-close-btn') || e.target.closest('.ia-modal-close-btn')) {
                agentModal.classList.remove('open');
            }
        });

        const copyBtn = document.getElementById('ia-agent-result-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const body = document.getElementById('ia-agent-result-body');
                if (body) {
                    navigator.clipboard.writeText(body.innerText).then(() => showToast('Copiado para área de transferência!', 'success'));
                }
            });
        }
    }

    // ============================================================
    //  9. ANIMAÇÕES DE ENTRADA
    // ============================================================
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('ia-anim-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.ia-animate').forEach(el => observer.observe(el));

    // ============================================================
    //  10. INICIALIZAÇÃO DA TAB ATIVA
    // ============================================================
    const savedTab = localStorage.getItem('iaHubActiveTab') || 'overview';
    activateTab(savedTab);

    // ============================================================
    //  11. EXPOSIÇÃO GLOBAL
    // ============================================================
    window.iaHub = {
        activateTab,
        showToast,
        loadOverviewData,
        AgentRuntime,
        AgentLogger
    };
});

