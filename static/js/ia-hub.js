/**
 * ia-hub.js — Centro de Inteligência Estratégica
 * DataInsight IA Hub — Tab navigation, Table/Period Filters, Agents, Status, Universal AI Analysis
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
    //  CONFIGURAÇÃO DOS AGENTES
    // ============================================================
    const agentesConfig = [
        {
            id: 'agente_financeiro',
            nome: 'Agente Financeiro',
            descricao: 'Monitora fluxo de caixa e anomalias financeiras automaticamente.',
            icon: 'fa-coins',
            color: '#10B981',
            gatilhos: ['Diário às 08:00', 'Ao importar dados'],
            acoes: ['Gerar insight diário', 'Alertar gargalos', 'Sugerir cortes'],
        },
        {
            id: 'agente_vendas',
            nome: 'Agente de Vendas',
            descricao: 'Analisa tendências de produtos e comportamento de clientes.',
            icon: 'fa-chart-bar',
            color: '#3B82F6',
            gatilhos: ['Semanal às segunda', 'Queda > 15%'],
            acoes: ['Ranking de produtos', 'Análise de sazonalidade', 'Alertar queda'],
        },
        {
            id: 'agente_decisao',
            nome: 'Agente Estratégico',
            descricao: 'Gera análises SWOT e recomendações de crescimento periodicamente.',
            icon: 'fa-brain',
            color: '#7C3AED',
            gatilhos: ['Quinzenal', 'Ao solicitar'],
            acoes: ['Análise SWOT', 'Cenários "E se"', 'Recomendações'],
        },
        {
            id: 'agente_alertas',
            nome: 'Agente de Alertas',
            descricao: 'Detecta anomalias em tempo real e notifica imediatamente.',
            icon: 'fa-bell',
            color: '#F59E0B',
            gatilhos: ['Contínuo', 'Limiar dinâmico'],
            acoes: ['Detectar anomalia', 'Enviar alerta', 'Sugerir ação'],
        },
    ];

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
        if (!text) return '';
        if (text.startsWith('<div')) return text;
        if (window.marked && typeof window.marked.parse === 'function') {
            try {
                return window.marked.parse(text);
            } catch (e) {}
        }
        return text
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
            container.innerHTML = `<p style="color:var(--suave); font-size:0.9rem;">Nenhum alerta identificado no momento.</p>`;
            return;
        }

        container.innerHTML = alertas.slice(0, 4).map(a => {
            const isWarn = (a.tipo === 'alerta' || a.nivel === 'alto');
            const icon = isWarn ? 'fa-triangle-exclamation' : 'fa-circle-check';
            const color = isWarn ? '#F59E0B' : '#10B981';
            return `
                <div class="ia-alert-item">
                    <i class="fa-solid ${icon}" style="color:${color}; flex-shrink:0;"></i>
                    <span>${a.mensagem || a.texto || a}</span>
                </div>
            `;
        }).join('');
    }

    // ============================================================
    //  3. AGENTES DE IA
    // ============================================================
    function loadAgentsStatus() {
        if (agentsLoaded) return;
        agentsLoaded = true;

        const container = document.getElementById('ia-agents-grid');
        if (!container) return;

        const savedStates = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');

        container.innerHTML = agentesConfig.map(agent => {
            const isActive = savedStates[agent.id] !== false; // default: ativo
            return `
                <div class="ia-agent-card ${isActive ? 'active' : ''}" id="card-${agent.id}">
                    <div class="ia-agent-header">
                        <div class="ia-agent-icon" style="background:${agent.color}22; color:${agent.color};">
                            <i class="fa-solid ${agent.icon}"></i>
                        </div>
                        <div class="ia-agent-meta">
                            <h3 class="ia-agent-name">${agent.nome}</h3>
                            <span class="ia-agent-badge ${isActive ? 'online' : 'offline'}">
                                <span class="ia-badge-dot"></span>
                                ${isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                        <label class="ia-toggle" title="Ligar/Desligar agente">
                            <input type="checkbox" class="ia-toggle-input" data-agent="${agent.id}" ${isActive ? 'checked' : ''}>
                            <span class="ia-toggle-slider"></span>
                        </label>
                    </div>
                    <p class="ia-agent-desc">${agent.descricao}</p>
                    <div class="ia-agent-details">
                        <div class="ia-agent-detail-group">
                            <span class="ia-detail-label"><i class="fa-solid fa-bolt"></i> Gatilhos</span>
                            <div class="ia-detail-tags">
                                ${agent.gatilhos.map(g => `<span class="ia-tag">${g}</span>`).join('')}
                            </div>
                        </div>
                        <div class="ia-agent-detail-group">
                            <span class="ia-detail-label"><i class="fa-solid fa-gears"></i> Ações</span>
                            <div class="ia-detail-tags">
                                ${agent.acoes.map(a => `<span class="ia-tag ia-tag-action">${a}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    <button class="ia-agent-run-btn" data-agent="${agent.id}" ${!isActive ? 'disabled' : ''}>
                        <i class="fa-solid fa-play"></i> Executar Agora
                    </button>
                </div>
            `;
        }).join('');

        // Toggle listeners
        container.querySelectorAll('.ia-toggle-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const agentId = e.target.dataset.agent;
                const isOn = e.target.checked;
                const card = document.getElementById(`card-${agentId}`);
                if (!card) return;
                const badge = card.querySelector('.ia-agent-badge');
                const runBtn = card.querySelector('.ia-agent-run-btn');

                card.classList.toggle('active', isOn);
                if (badge) {
                    badge.className = `ia-agent-badge ${isOn ? 'online' : 'offline'}`;
                    badge.innerHTML = `<span class="ia-badge-dot"></span>${isOn ? 'Ativo' : 'Inativo'}`;
                }
                if (runBtn) runBtn.disabled = !isOn;

                const states = JSON.parse(localStorage.getItem('iaAgentStates') || '{}');
                states[agentId] = isOn;
                localStorage.setItem('iaAgentStates', JSON.stringify(states));

                showToast(isOn ? `${agentId.replace('agente_', 'Agente ')} ativado ✓` : 'Agente desativado', isOn ? 'success' : 'info');
            });
        });

        // Run now listeners
        container.querySelectorAll('.ia-agent-run-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const agentId = btn.dataset.agent;
                runAgent(agentId, btn);
            });
        });
    }

    async function runAgent(agentId, btn) {
        const agentCfg = agentesConfig.find(a => a.id === agentId);
        if (!agentCfg) return;

        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';

        const prompts = {
            agente_financeiro: `Faça uma análise completa do fluxo de caixa e finanças para o período (${periodoIaAtual}) e base (${tabelaIaAtualId}). Identifique gargalos, anomalias e sugira 3 ações imediatas.`,
            agente_vendas: `Analise o comportamento de vendas para o período (${periodoIaAtual}) e base (${tabelaIaAtualId}). Liste os 5 produtos mais lucrativos, tendências e oportunidades de crescimento.`,
            agente_decisao: `Gere uma análise SWOT completa do negócio com base no período (${periodoIaAtual}) e base (${tabelaIaAtualId}). Inclua 3 recomendações estratégicas prioritárias.`,
            agente_alertas: `Verifique anomalias nos dados para o período (${periodoIaAtual}) e base (${tabelaIaAtualId}). Identifique qualquer dado fora do padrão, picos ou quedas suspeitas.`,
        };

        try {
            const r = await fetch('/api/chatbot/perguntar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensagem: prompts[agentId] || 'Faça uma análise geral dos dados disponíveis.',
                    session_id: 'agent_' + agentId + '_' + Date.now(),
                    tabela_id: tabelaIaAtualId,
                }),
            });

            if (r.ok) {
                const data = await r.json();
                showAgentResult(agentCfg, data.resposta || data.message || 'Análise concluída.');
            } else {
                showToast('Erro ao executar agente. Verifique a conexão.', 'error');
            }
        } catch (e) {
            showToast('Erro de conexão com o servidor.', 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    function showAgentResult(agent, resposta) {
        const modal = document.getElementById('ia-agent-result-modal');
        if (!modal) return;

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
    //  8. ANIMAÇÕES DE ENTRADA
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
    //  9. INICIALIZAÇÃO DA TAB ATIVA
    // ============================================================
    const savedTab = localStorage.getItem('iaHubActiveTab') || 'overview';
    activateTab(savedTab);

    // ============================================================
    //  10. EXPOSIÇÃO GLOBAL
    // ============================================================
    window.iaHub = { activateTab, showToast, runAgent, loadOverviewData };
});
