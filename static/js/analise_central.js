/**
 * analise_central.js
 * Central Executiva de Análise Contábil & Inteligência Estratégica — DataInsight
 * Gerencia cálculos dinâmicos para ME e MEI, DRE, Break-Even, Teto MEI,
 * séries mensais, gráficos ApexCharts, Parecer de IA e integração universal.
 *
 * ------------------------------------------------------------------------------
 * PROPRIEDADE INTELECTUAL
 * ------------------------------------------------------------------------------
 * Este código pertence à plataforma @DataInsight. Todos os arquivos da plataforma
 * devem seguir esta mesma estrutura de organização: seções numeradas
 * sequencialmente com cabeçalhos padronizados, separação clara de
 * responsabilidades e agrupamento lógico de funções afins.
 * ------------------------------------------------------------------------------
 */

'use strict';

// ==============================================================================
// 1. ESTADO GLOBAL
// ==============================================================================
const AC = {
    dados: null,              // Resposta completa de /api/analise
    estrategico: null,        // Resposta completa de /api/analise-estrategica
    tipoGrafico: 'bar',       // bar | line | area
    tabAtual: 'contabil',
    charts: {},               // Instâncias de ApexCharts
    filtroRapidoDias: 90,
    planilhas: [],
    perfil: 'ME',
    limitesDatas: null        // { data_minima, data_maxima, ano_maximo, anos_disponiveis, tem_dados }
};

const LIMITE_MEI_ANUAL = 81000;

// ==============================================================================
// 2. UTILITÁRIOS E FORMATAÇÃO
// ==============================================================================
function fmt(valor) {
    if (typeof valor !== 'number') valor = parseFloat(valor) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(valor);
}

function fmtPct(valor, casas = 1) {
    if (valor === null || valor === undefined || isNaN(valor)) return '--';
    return Number(valor).toFixed(casas) + '%';
}

function fmtData(str) {
    if (!str) return '';
    const p = str.split('-');
    if (p.length < 3) return str;
    return `${p[2]}/${p[1]}/${p[0]}`;
}

function parseDataIso(str) {
    if (!str) return new Date();
    const p = str.split('-');
    if (p.length === 3) {
        return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
    return new Date(str);
}

function formatarDataIso(d) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function obterDataReferenciaFim() {
    if (AC.limitesDatas && AC.limitesDatas.data_maxima) {
        return AC.limitesDatas.data_maxima;
    }
    return hoje();
}

function subtrairDiasDe(dataRefStr, n) {
    const d = parseDataIso(dataRefStr || obterDataReferenciaFim());
    const diasSub = n > 1 ? (n - 1) : 0;
    d.setDate(d.getDate() - diasSub);
    const res = formatarDataIso(d);
    if (AC.limitesDatas && AC.limitesDatas.data_minima) {
        if (res < AC.limitesDatas.data_minima) {
            return AC.limitesDatas.data_minima;
        }
    }
    return res;
}

function variacaoHTML(valor, invertido = false) {
    if (valor === null || valor === undefined || isNaN(valor)) {
        return '<span class="kpi-card__variacao neutro">—</span>';
    }
    const positivo = invertido ? valor < 0 : valor >= 0;
    const cls = positivo ? 'positivo' : 'negativo';
    const icon = valor >= 0 ? '↑' : '↓';
    const sinal = valor >= 0 ? '+' : '';
    return `<span class="kpi-card__variacao ${cls}">${icon} ${sinal}${Number(valor).toFixed(1)}%</span>`;
}

function isDark() {
    return document.body.classList.contains('tema-escuro') || document.documentElement.getAttribute('data-tema') === 'escuro';
}

function coresGrafico() {
    const escuro = isDark();
    return {
        fat: escuro ? '#60a5fa' : '#3b82f6',
        desp: escuro ? '#f87171' : '#ef4444',
        luc: escuro ? '#34d399' : '#10b981',
        mg: escuro ? '#fbbf24' : '#f59e0b',
        texto: escuro ? '#cbd5e1' : '#475569',
        borda: escuro ? '#334155' : '#e2e8f0',
        fundo: escuro ? '#0f172a' : '#ffffff',
    };
}

function hoje() {
    return new Date().toISOString().split('T')[0];
}

function diasAtras(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}

function destroyChart(id) {
    if (AC.charts[id]) {
        try { AC.charts[id].destroy(); } catch (e) {}
        AC.charts[id] = null;
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function setHTML(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
}

function setBarWidth(id, pct) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ==============================================================================
// 3. INICIALIZAÇÃO E CICLO DE VIDA
// ==============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    AC.perfil = (window.USUARIO_PERFIL || 'ME').toUpperCase();
    inicializarPerfil();

    // Remove destaque de filtros rápidos se o usuário alterar datas manualmente
    ['data-inicio', 'data-fim'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                AC.filtroRapidoDias = null;
                ['7', '30', '90', '180', '365', 'ano'].forEach(d => {
                    const btn = document.getElementById(`fq-${d}`);
                    if (btn) btn.classList.remove('ativo');
                });
            });
        }
    });

    await carregarPlanilhas();
    await inicializarPeriodoEAnalise();
});

function inicializarPerfil() {
    const perfil = AC.perfil;
    const badge = document.getElementById('badge-perfil-topo');
    if (badge) {
        badge.className = 'badge-perfil ' + perfil.toLowerCase();
        badge.innerHTML = perfil === 'MEI'
            ? '<i class="fa-solid fa-user-tie"></i> MEI'
            : '<i class="fa-solid fa-building"></i> ME';
    }

    const secaoMei = document.getElementById('secao-modulo-mei');
    const secaoMe = document.getElementById('secao-modulo-me');
    const cenariosMei = document.getElementById('cenarios-modulo-mei');
    const cenariosMe = document.getElementById('cenarios-modulo-me');
    const tabCenariosBtn = document.getElementById('tab-btn-cenarios');
    const tabContabilBtn = document.getElementById('tab-btn-contabil');

    if (perfil === 'MEI') {
        if (secaoMei) secaoMei.style.display = 'block';
        if (secaoMe) secaoMe.style.display = 'none';
        if (cenariosMei) cenariosMei.style.display = 'block';
        if (cenariosMe) cenariosMe.style.display = 'none';
        if (tabContabilBtn) tabContabilBtn.innerHTML = '<i class="fa-solid fa-gauge-high"></i> Limite MEI &amp; Caixa';
        if (tabCenariosBtn) tabCenariosBtn.innerHTML = '<i class="fa-solid fa-bullseye"></i> Metas &amp; Simulador MEI';
    } else {
        if (secaoMei) secaoMei.style.display = 'none';
        if (secaoMe) secaoMe.style.display = 'block';
        if (cenariosMei) cenariosMei.style.display = 'none';
        if (cenariosMe) cenariosMe.style.display = 'block';
        if (tabContabilBtn) tabContabilBtn.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i> Contábil &amp; DRE';
        if (tabCenariosBtn) tabCenariosBtn.innerHTML = '<i class="fa-solid fa-compass-drafting"></i> Cenários &amp; Projeções';
    }
}

// ==============================================================================
// 4. PLANILHAS E SELETORES
// ==============================================================================
async function carregarPlanilhas() {
    try {
        const res = await fetch('/api/planilhas/sumario');
        if (!res.ok) return;
        const data = await res.json();
        AC.planilhas = data.planilhas || data || [];

        const sel = document.getElementById('seletorPlanilhaAnalise');
        if (!sel) return;

        const valAtual = sel.value;
        sel.innerHTML = '<option value="todas">&#127760; Todas as Planilhas (Visão Consolidada)</option>';
        AC.planilhas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p._id || p.id || '';
            opt.textContent = p.nome || p.name || 'Planilha';
            sel.appendChild(opt);
        });

        if (valAtual && [...sel.options].some(o => o.value === valAtual)) {
            sel.value = valAtual;
        }

        const badge = document.getElementById('status-fonte-badge');
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${AC.planilhas.length} planilha(s) ativa(s)`;
        }
    } catch (e) {
        console.warn('[carregarPlanilhas] Erro:', e);
    }
}

async function carregarLimitesDatas(tabelaId = 'todas') {
    try {
        const url = `/api/analise/limites-datas?tabela_id=${encodeURIComponent(tabelaId || 'todas')}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            AC.limitesDatas = data;
            if (data.anos_disponiveis && data.anos_disponiveis.length > 0) {
                atualizarAnoSeletor(data.anos_disponiveis, data.ano_maximo);
            }
            return data;
        }
    } catch (e) {
        console.warn('[carregarLimitesDatas] Erro:', e);
    }
    return null;
}

function preencherAnoSeletor() {
    const sel = document.getElementById('ano-seletor');
    if (!sel) return;
    const anoAtual = new Date().getFullYear();
    sel.innerHTML = '';
    for (let a = anoAtual; a >= anoAtual - 4; a--) {
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = `Exercício ${a}`;
        if (a === anoAtual) opt.selected = true;
        sel.appendChild(opt);
    }
}

function atualizarAnoSeletor(anos, anoPadrao) {
    const sel = document.getElementById('ano-seletor');
    if (!sel) return;
    sel.innerHTML = '';
    const lista = [...anos].sort((a, b) => b - a);
    lista.forEach(ano => {
        const opt = document.createElement('option');
        opt.value = ano;
        opt.textContent = `Exercício ${ano}`;
        if (ano === anoPadrao) opt.selected = true;
        sel.appendChild(opt);
    });
}

// ==============================================================================
// 5. FILTROS RÁPIDOS E GESTÃO DE PERÍODO
// ==============================================================================
function aplicarFiltroRapido(dias) {
    AC.filtroRapidoDias = dias;
    ['7', '30', '90', '180', '365', 'ano'].forEach(d => {
        const btn = document.getElementById(`fq-${d}`);
        if (btn) btn.classList.remove('ativo');
    });

    const btn = document.getElementById(`fq-${dias}`);
    if (btn) btn.classList.add('ativo');

    // Sempre usa a data máxima real dos dados como referência
    const refFim = obterDataReferenciaFim();
    const refInicio = subtrairDiasDe(refFim, dias);

    const elInicio = document.getElementById('data-inicio');
    const elFim = document.getElementById('data-fim');
    if (elInicio) elInicio.value = refInicio;
    if (elFim) elFim.value = refFim;

    aplicarFiltros();
}

function aplicarFiltroAnoAtual() {
    AC.filtroRapidoDias = 'ano';
    ['7', '30', '90', '180', '365'].forEach(d => {
        const btn = document.getElementById(`fq-${d}`);
        if (btn) btn.classList.remove('ativo');
    });
    const btnAno = document.getElementById('fq-ano');
    if (btnAno) btnAno.classList.add('ativo');

    const refFim = obterDataReferenciaFim();
    const ano = refFim.split('-')[0];

    const elInicio = document.getElementById('data-inicio');
    const elFim = document.getElementById('data-fim');
    if (elInicio) elInicio.value = `${ano}-01-01`;
    if (elFim) elFim.value = refFim;

    aplicarFiltros();
}

async function aoTrocarPlanilhaAnalise() {
    const sel = document.getElementById('seletorPlanilhaAnalise');
    const tabelaId = sel ? sel.value : 'todas';

    // 1. Carrega os limites de datas reais da nova planilha
    await carregarLimitesDatas(tabelaId);

    // 2. Se houver filtro rápido ativo (7, 30, 90, ano...), recalcula a partir da data máxima
    if (AC.filtroRapidoDias) {
        if (AC.filtroRapidoDias === 'ano') {
            aplicarFiltroAnoAtual();
            return;
        } else {
            aplicarFiltroRapido(AC.filtroRapidoDias);
            return;
        }
    }

    // 3. Caso contrário, ajusta para o intervalo real da tabela
    const refFim = obterDataReferenciaFim();
    const elInicio = document.getElementById('data-inicio');
    const elFim = document.getElementById('data-fim');
    if (elFim) elFim.value = refFim;
    if (elInicio) elInicio.value = AC.limitesDatas?.data_minima || subtrairDiasDe(refFim, 90);

    aplicarFiltros();
}

function limparFiltros() {
    ['7', '30', '90', '180', '365', 'ano'].forEach(d => {
        const btn = document.getElementById(`fq-${d}`);
        if (btn) btn.classList.remove('ativo');
    });
    AC.filtroRapidoDias = null;

    if (AC.limitesDatas && AC.limitesDatas.data_minima && AC.limitesDatas.data_maxima) {
        document.getElementById('data-inicio').value = AC.limitesDatas.data_minima;
        document.getElementById('data-fim').value = AC.limitesDatas.data_maxima;
    } else {
        document.getElementById('data-inicio').value = '';
        document.getElementById('data-fim').value = '';
    }
}

function salvarUltimoPeriodo(inicio, fim, tabelaId) {
    if (!inicio || !fim) return;
    const payload = {
        periodo_inicio: inicio,
        periodo_fim: fim,
        tabela_id: tabelaId || 'todas'
    };

    // 1. Salva no localStorage (restauração rápida e persistente entre abas/reloads)
    try {
        localStorage.setItem('ac_ultimo_periodo', JSON.stringify(payload));
    } catch (e) {
        console.warn('[salvarUltimoPeriodo] Erro localStorage:', e);
    }

    // 2. Atualiza variável na janela
    window.analise_selecionada = payload;

    // 3. Envia para o backend para salvar na sessão e MongoDB
    fetch('/api/ultimo-periodo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => {
        console.warn('[salvarUltimoPeriodo] Erro POST /api/ultimo-periodo:', err);
    });
}

async function restaurarUltimoPeriodo() {
    let salvo = null;

    // 1. Prioridade: window.analise_selecionada (sessão Flask / DB)
    if (window.analise_selecionada && window.analise_selecionada.periodo_inicio && window.analise_selecionada.periodo_fim) {
        salvo = window.analise_selecionada;
    }

    // 2. Se não disponível, verifica o localStorage
    if (!salvo) {
        try {
            const raw = localStorage.getItem('ac_ultimo_periodo');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.periodo_inicio && parsed.periodo_fim) {
                    salvo = parsed;
                }
            }
        } catch (e) {
            console.warn('[restaurarUltimoPeriodo] Erro localStorage:', e);
        }
    }

    // 3. Se ainda não achou, consulta a API
    if (!salvo) {
        try {
            const res = await fetch('/api/ultimo-periodo');
            if (res.ok) {
                const data = await res.json();
                const ini = data.periodo_inicio || data.inicio;
                const fim = data.periodo_fim || data.fim;
                if (ini && fim) {
                    salvo = {
                        periodo_inicio: ini,
                        periodo_fim: fim,
                        tabela_id: data.tabela_id || 'todas'
                    };
                }
            }
        } catch (e) {
            console.warn('[restaurarUltimoPeriodo] Erro GET /api/ultimo-periodo:', e);
        }
    }

    return salvo;
}

async function inicializarPeriodoEAnalise() {
    // 1. Recupera o último período analisado
    const salvo = await restaurarUltimoPeriodo();

    // 2. Ajusta a planilha selecionada
    const selPlanilha = document.getElementById('seletorPlanilhaAnalise');
    if (salvo && salvo.tabela_id && selPlanilha) {
        if ([...selPlanilha.options].some(o => o.value === salvo.tabela_id)) {
            selPlanilha.value = salvo.tabela_id;
        }
    }

    const tabelaAtual = selPlanilha ? selPlanilha.value : 'todas';

    // 3. Carrega os limites de dados reais da tabela
    await carregarLimitesDatas(tabelaAtual);

    const elInicio = document.getElementById('data-inicio');
    const elFim = document.getElementById('data-fim');

    if (salvo && salvo.periodo_inicio && salvo.periodo_fim) {
        if (elInicio) elInicio.value = salvo.periodo_inicio;
        if (elFim) elFim.value = salvo.periodo_fim;
        AC.filtroRapidoDias = null;
        ['7', '30', '90', '180', '365', 'ano'].forEach(d => {
            const btn = document.getElementById(`fq-${d}`);
            if (btn) btn.classList.remove('ativo');
        });
    } else {
        const refFim = obterDataReferenciaFim();
        if (elFim) elFim.value = refFim;
        if (elInicio) elInicio.value = subtrairDiasDe(refFim, 90);
        AC.filtroRapidoDias = 90;
        const btn90 = document.getElementById('fq-90');
        if (btn90) btn90.classList.add('ativo');
    }

    // 4. Executa a análise completa do último período selecionado automaticamente!
    await aplicarFiltros();
}

// ==============================================================================
// 6. MOTOR PRINCIPAL DE EXECUÇÃO DA ANÁLISE
// ==============================================================================
async function aplicarFiltros() {
    const inicio = document.getElementById('data-inicio').value;
    const fim = document.getElementById('data-fim').value;
    const planilhaId = document.getElementById('seletorPlanilhaAnalise').value;

    if (!inicio || !fim) {
        aplicarFiltroRapido(90);
        return;
    }

    if (inicio > fim) {
        mostrarNotificacao('A data inicial não pode ser maior que a data final', 'erro');
        return;
    }

    // Persiste o período selecionado para reloads e retornos à página
    salvarUltimoPeriodo(inicio, fim, planilhaId);

    const btn = document.getElementById('btn-aplicar-filtros');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando...';
    }

    const badge = document.getElementById('status-fonte-badge');
    if (badge) badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Calculando indicadores contábeis...';

    try {
        const params = new URLSearchParams({ data_inicio: inicio, data_fim: fim });
        if (planilhaId && planilhaId !== 'todas') {
            params.append('tabela_id', planilhaId);
            params.append('planilha_id', planilhaId);
        }

        const [resBase, resEstrategico] = await Promise.all([
            fetch(`/api/analise?${params}`),
            fetch(`/api/analise-estrategica?${params}`)
        ]);

        let dadosBase = null;
        let dadosEst = null;

        if (resBase.ok) dadosBase = await resBase.json();
        if (resEstrategico.ok) dadosEst = await resEstrategico.json();

        AC.dados = dadosBase;
        AC.estrategico = dadosEst;

        if (dadosBase && dadosBase.perfil) {
            AC.perfil = dadosBase.perfil.toUpperCase();
            inicializarPerfil();
        }

        if (dadosBase && dadosBase.limites_datas) {
            AC.limitesDatas = dadosBase.limites_datas;
            if (dadosBase.limites_datas.anos_disponiveis && dadosBase.limites_datas.anos_disponiveis.length > 0) {
                atualizarAnoSeletor(dadosBase.limites_datas.anos_disponiveis, dadosBase.limites_datas.ano_maximo);
            }
        }

        if (!dadosBase || dadosBase.mensagem === 'Nenhum dado encontrado') {
            mostrarNotificacao('Nenhum dado encontrado para o período selecionado', 'aviso');
            if (badge) badge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Sem dados no período';
        } else {
            // Renderização unificada
            renderizarBannerIA(dadosBase.parecer_ia);
            renderizarKPIs(dadosBase);
            renderizarSaude(dadosEst?.saude);
            renderizarModuloMEI(dadosBase.mei);
            renderizarModuloME(dadosBase.contabil);
            renderizarMatrizMensal(dadosBase.visao_mensal);
            renderizarGraficoFinanceiro(dadosBase);
            renderizarDonut(dadosBase.composicao_despesas);
            renderizarTabelaComparacao(dadosBase);
            if (AC.perfil === 'MEI') {
                renderizarSimuladorMEI(dadosBase, dadosEst);
            } else {
                renderizarCenarios(dadosEst?.cenarios);
            }
            renderizarAlertas(dadosEst?.alertas);
            renderizarScoreDetalhe(dadosEst?.saude);

            if (badge) {
                const planLabel = planilhaId === 'todas'
                    ? 'Todas as planilhas consolidadas'
                    : (AC.planilhas.find(p => (p._id || p.id) === planilhaId)?.nome || planilhaId);
                badge.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${planLabel} | ${fmtData(inicio)} → ${fmtData(fim)}`;
            }
        }

    } catch (e) {
        console.error('[aplicarFiltros] Erro:', e);
        mostrarNotificacao('Erro ao carregar dados de análise', 'erro');
        if (badge) badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Erro de processamento';
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-magnifying-glass-chart"></i> Executar Análise';
        }
    }
}

// ==============================================================================
// 7. RENDERIZADORES DE COMPONENTES
// ==============================================================================

/* --- BANNER DE PARECER IA --- */
function renderizarBannerIA(parecer) {
    if (!parecer) return;

    setText('banner-ia-veredito-titulo', parecer.veredito_titulo || 'Parecer Executivo do CFO Virtual');
    setText('banner-ia-diagnostico', parecer.diagnostico_executivo || '');

    const badgeStatus = document.getElementById('banner-ia-badge-status');
    if (badgeStatus) {
        const st = parecer.veredito_status || 'neutro';
        badgeStatus.className = `banner-ia-badge ${st}`;
        const icone = st === 'positivo' ? 'fa-circle-check' : st === 'atencao' ? 'fa-triangle-exclamation' : st === 'critico' ? 'fa-radiation' : 'fa-shield';
        badgeStatus.innerHTML = `<i class="fa-solid ${icone}"></i> ${parecer.veredito_badge || 'Diagnóstico Concluído'}`;
    }

    // Pontos Fortes
    const ulFortes = document.getElementById('banner-ia-pontos-fortes');
    if (ulFortes) {
        const lista = parecer.pontos_fortes || [];
        ulFortes.innerHTML = lista.map(p => `<li><i class="fa-solid fa-check" style="color:#10b981;"></i> <span>${p}</span></li>`).join('');
    }

    // Alertas e Riscos
    const ulRiscos = document.getElementById('banner-ia-alertas-riscos');
    if (ulRiscos) {
        const lista = parecer.alertas_riscos || [];
        ulRiscos.innerHTML = lista.map(r => `<li><i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> <span>${r}</span></li>`).join('');
    }

    // Recomendações
    const ulRecs = document.getElementById('banner-ia-recomendacoes');
    if (ulRecs) {
        const lista = parecer.recomendacoes || [];
        ulRecs.innerHTML = lista.map(rec => {
            const t = typeof rec === 'string' ? rec : `${rec.titulo}: ${rec.descricao}`;
            return `<li><i class="fa-solid fa-arrow-right" style="color:#3b82f6;"></i> <span>${t}</span></li>`;
        }).join('');
    }
}

/* --- KPIS EXECUTIVOS --- */
function renderizarKPIs(dados) {
    if (!dados) return;

    const fat = dados.faturamento?.valor || 0;
    const desp = dados.despesa?.valor || 0;
    const luc = dados.lucro?.valor || 0;
    const mg = dados.margem?.valor || 0;

    setText('kpi-fat-valor', fmt(fat));
    setText('kpi-desp-valor', fmt(desp));
    setText('kpi-luc-valor', fmt(luc));
    setText('kpi-mg-valor', fmtPct(mg));

    setHTML('kpi-fat-var', variacaoHTML(dados.faturamento?.variacao));
    setHTML('kpi-desp-var', variacaoHTML(dados.despesa?.variacao, true));
    setHTML('kpi-luc-var', variacaoHTML(dados.lucro?.variacao));
    setHTML('kpi-mg-var', variacaoHTML(dados.margem?.variacao));

    const maxBase = Math.max(fat, 1);
    setBarWidth('kpi-fat-bar', 100);
    setBarWidth('kpi-desp-bar', Math.min((desp / maxBase) * 100, 100));
    setBarWidth('kpi-luc-bar', Math.min(Math.max((luc / maxBase) * 100, 0), 100));
    setBarWidth('kpi-mg-bar', Math.min(Math.abs(mg), 100));

    // Card Dinâmico MEI vs ME
    const isMei = AC.perfil === 'MEI';
    const iconeEl = document.getElementById('kpi-dinamico-icon');
    const labelEl = document.getElementById('kpi-dinamico-label');
    const valorEl = document.getElementById('kpi-dinamico-valor');
    const varEl = document.getElementById('kpi-dinamico-var');
    const barEl = document.getElementById('kpi-dinamico-bar');

    if (isMei && dados.mei) {
        if (iconeEl) iconeEl.innerHTML = '<i class="fa-solid fa-gauge-high"></i>';
        if (labelEl) labelEl.textContent = 'Consumo Teto MEI';
        if (valorEl) valorEl.textContent = fmtPct(dados.mei.percentual_teto);
        if (varEl) {
            const st = dados.mei.status_teto;
            const cls = st === 'seguro' ? 'positivo' : st === 'atencao' ? 'negativo' : 'negativo';
            varEl.className = `kpi-card__variacao ${cls}`;
            varEl.textContent = `Restam ${fmt(dados.mei.saldo_restante_teto)}`;
        }
        if (barEl) {
            barEl.style.width = Math.min(dados.mei.percentual_teto, 100) + '%';
            barEl.style.backgroundColor = dados.mei.percentual_teto >= 80 ? '#ef4444' : dados.mei.percentual_teto >= 65 ? '#f59e0b' : '#10b981';
        }
    } else {
        const pe = dados.contabil?.ponto_equilibrio || 0;
        const mseg = dados.contabil?.margem_seguranca_operacional || 0;
        if (iconeEl) iconeEl.innerHTML = '<i class="fa-solid fa-scale-balanced"></i>';
        if (labelEl) labelEl.textContent = 'Ponto de Equilíbrio';
        if (valorEl) valorEl.textContent = fmt(pe);
        if (varEl) {
            const atingido = fat >= pe;
            varEl.className = `kpi-card__variacao ${atingido ? 'positivo' : 'negativo'}`;
            varEl.textContent = atingido ? `Folga: +${mseg}%` : `Déficit: -${fmt(pe - fat)}`;
        }
        if (barEl) {
            const pctPe = pe > 0 ? Math.min((fat / pe) * 100, 100) : 0;
            barEl.style.width = pctPe + '%';
            barEl.style.backgroundColor = fat >= pe ? '#10b981' : '#ef4444';
        }
    }

    // Mini Projeção no topo
    const projFat = dados.estrategico?.cenarios?.provavel?.faturamento || (fat * 1.02);
    const projLuc = dados.estrategico?.cenarios?.provavel?.lucro || (luc * 1.02);
    setText('proj-fat-val', fmt(projFat));
    setText('proj-luc-val', fmt(projLuc));
}

/* --- SAÚDE DO NEGÓCIO --- */
function renderizarSaude(saude) {
    if (!saude) return;
    const score = saude.score || 0;

    const arc = document.getElementById('saude-arc');
    const scoreNum = document.getElementById('saude-score-num');
    if (arc) {
        const circunferencia = 289;
        const offset = circunferencia - (circunferencia * score / 100);
        arc.style.strokeDashoffset = offset;
        arc.style.stroke = saude.cor || (score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444');
    }
    if (scoreNum) scoreNum.textContent = score;

    setText('saude-nivel-texto', saude.nivel_label || 'Saúde Operacional');
    setText('saude-descricao', saude.descricao || '');

    if (AC.dados) {
        setText('si-margem', fmtPct(AC.dados.margem?.valor));
        const varFat = AC.dados.faturamento?.variacao;
        setText('si-cresc', varFat !== null && varFat !== undefined ? `${varFat >= 0 ? '+' : ''}${varFat}%` : '--');
        setText('si-mc', fmtPct(AC.dados.contabil?.indice_margem_contribuicao));
        setText('si-cobertura', `${AC.dados.contabil?.cobertura_custos_fixos || 0}x`);
    }
}

/* --- MÓDULO MEI --- */
function renderizarModuloMEI(mei) {
    if (!mei || AC.perfil !== 'MEI') return;

    setText('mei-fat-ano', fmt(mei.faturamento_ano));
    setText('mei-saldo-teto', fmt(mei.saldo_restante_teto));
    setText('mei-media-mes', fmt(mei.media_mensal));
    setText('mei-proj-ano', fmt(mei.projecao_fechamento_ano));

    setText('mei-prolabore-val', fmt(mei.pro_labore_sugerido));
    setText('mei-reserva-val', fmt(mei.reserva_pj_recomendada));
    setText('mei-vencimento-das', `${mei.data_proximo_das} (${mei.dias_ate_proximo_das} dias)`);

    const barra = document.getElementById('mei-barra-teto');
    if (barra) {
        barra.style.width = Math.min(mei.percentual_teto, 100) + '%';
    }
    setText('mei-teto-consumido-texto', `${fmt(mei.faturamento_ano)} (${mei.percentual_teto}%)`);

    const badge = document.getElementById('mei-status-badge');
    if (badge) {
        badge.textContent = mei.status_titulo;
        badge.style.background = mei.percentual_teto >= 80 ? '#ef4444' : mei.percentual_teto >= 65 ? '#f59e0b' : '#10b981';
    }
    setText('mei-status-descricao', mei.status_desc);
}

/* --- MÓDULO ME: INDICADORES E DRE GERENCIAL --- */
function renderizarModuloME(contabil) {
    if (!contabil || AC.perfil === 'MEI') return;

    setText('ind-mc-valor', fmt(contabil.margem_contribuicao));
    setText('ind-mc-pct', `Índice IMC: ${fmtPct(contabil.indice_margem_contribuicao)} da receita`);

    setText('ind-pe-valor', fmt(contabil.ponto_equilibrio));
    const peStatusTxt = contabil.ponto_equilibrio_status === 'atingido' ? '✅ Atingido com folga' : '⚠ Abaixo do equilíbrio';
    setText('ind-pe-status', peStatusTxt);

    setText('ind-mseg-valor', fmtPct(contabil.margem_seguranca_operacional));
    setText('ind-ebitda-valor', fmt(contabil.ebitda));
    setText('ind-ebitda-pct', `Margem EBITDA: ${fmtPct(contabil.margem_ebitda)}`);
    setText('ind-cob-valor', `${contabil.cobertura_custos_fixos}x`);

    // DRE Gerencial Tabela
    const tbody = document.getElementById('dre-tabela-corpo');
    if (!tbody) return;

    const linhas = contabil.dre_linhas || [];
    if (!linhas.length) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--suave);padding:24px;">Sem dados contábeis disponíveis.</td></tr>';
        return;
    }

    tbody.innerHTML = linhas.map(l => {
        let cls = '';
        if (l.tipo === 'total') cls = 'dre-total';
        else if (l.tipo === 'subtotal') cls = 'dre-subtotal';
        else if (l.destaque) cls = 'dre-destaque';

        const corValor = l.valor >= 0 ? 'var(--texto)' : 'var(--perigo)';
        return `
            <tr class="${cls}">
                <td>${l.nome}</td>
                <td style="text-align:right;color:${corValor};">${fmt(l.valor)}</td>
                <td style="text-align:right;font-weight:600;color:var(--suave);">${fmtPct(l.pct)}</td>
            </tr>
        `;
    }).join('');
}

/* --- MATRIZ MENSAL & SAZONALIDADE --- */
function renderizarMatrizMensal(visaoMensal) {
    if (!visaoMensal) return;

    setText('stat-media-fat', fmt(visaoMensal.media_mensal_faturamento));
    setText('stat-media-luc', fmt(visaoMensal.media_mensal_lucro));
    setText('stat-volatilidade', visaoMensal.volatilidade_receita);

    const grid = document.getElementById('anual-mes-grid');
    if (!grid) return;

    const itens = visaoMensal.itens_mensais || [];
    if (!itens.length) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fa-solid fa-calendar-check"></i><p>Nenhum mês registrado no período.</p></div>';
        return;
    }

    const melhorMesStr = visaoMensal.melhor_mes?.mes;
    const piorMesStr = visaoMensal.pior_mes?.mes;

    grid.innerHTML = itens.map(item => {
        const isMelhor = item.mes === melhorMesStr && itens.length > 1;
        const isPior = item.mes === piorMesStr && itens.length > 1 && !isMelhor;
        const cardCls = isMelhor ? 'melhor' : isPior ? 'pior' : '';
        const tag = isMelhor ? '<span class="anual-mes-card__tag">Top Lucro</span>' : (isPior ? '<span class="anual-mes-card__tag">Menor</span>' : '');

        return `
            <div class="anual-mes-card ${cardCls}">
                ${tag}
                <div class="anual-mes-card__nome">${item.mes}</div>
                <div class="anual-mes-card__fat">${fmt(item.faturamento)}</div>
                <div class="anual-mes-card__lucro">Lucro: <strong>${fmt(item.lucro)}</strong></div>
                <div style="font-size:0.68rem;color:var(--suave);margin-top:2px;">Margem: ${fmtPct(item.margem)}</div>
            </div>
        `;
    }).join('');

    renderizarGraficoAnual(visaoMensal);
}

function renderizarGraficoAnual(visaoMensal) {
    destroyChart('anual');
    const container = document.getElementById('grafico-anual');
    if (!container) return;

    const labels = visaoMensal.meses || [];
    if (!labels.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-column"></i><p>Sem dados suficientes para o comparativo mensal.</p></div>';
        return;
    }

    container.innerHTML = '';
    const c = coresGrafico();

    const options = {
        series: [
            { name: 'Receita Bruta', data: visaoMensal.faturamento },
            { name: 'Despesas', data: visaoMensal.despesas },
            { name: 'Lucro Líquido', data: visaoMensal.lucro }
        ],
        chart: {
            type: 'bar',
            height: 320,
            background: 'transparent',
            fontFamily: 'inherit',
            toolbar: { show: true }
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        colors: [c.fat, c.desp, c.luc],
        plotOptions: {
            bar: { columnWidth: '55%', borderRadius: 4 }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: labels,
            labels: { style: { colors: c.texto, fontSize: '11px' } }
        },
        yaxis: {
            labels: {
                style: { colors: c.texto },
                formatter: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0))
            }
        },
        grid: { borderColor: c.borda, strokeDashArray: 3 },
        legend: { labels: { colors: c.texto } },
        tooltip: { y: { formatter: v => fmt(v) } }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    AC.charts['anual'] = chart;
}

/* --- GRÁFICO PRINCIPAL HISTÓRICO --- */
function renderizarGraficoFinanceiro(dados) {
    if (!dados?.grafico) return;

    const grafico = dados.grafico;
    const labels = grafico.labels || [];
    const series = (grafico.series || []).filter(s => s.name !== 'Margem (%)');

    destroyChart('principal');
    const container = document.getElementById('grafico-principal');
    if (!container) return;

    if (!labels.length || series.every(s => s.data.every(v => v === 0))) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-area"></i><p>Sem dados suficientes para o gráfico principal.</p></div>';
        return;
    }

    container.innerHTML = '';
    const c = coresGrafico();

    const options = {
        series: series,
        chart: {
            type: AC.tipoGrafico === 'area' ? 'area' : AC.tipoGrafico,
            height: 320,
            background: 'transparent',
            fontFamily: 'inherit',
            toolbar: { show: true }
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        colors: [c.fat, c.desp, c.luc],
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: AC.tipoGrafico === 'bar' ? 0 : 2.5 },
        fill: AC.tipoGrafico === 'area' ? { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } } : {},
        xaxis: {
            categories: labels,
            labels: { style: { colors: c.texto, fontSize: '11px' } }
        },
        yaxis: {
            labels: {
                style: { colors: c.texto },
                formatter: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0))
            }
        },
        grid: { borderColor: c.borda, strokeDashArray: 3 },
        legend: { labels: { colors: c.texto } },
        tooltip: { y: { formatter: v => fmt(v) } }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    AC.charts['principal'] = chart;
}

function alternarTipoGrafico(tipo) {
    AC.tipoGrafico = tipo;
    ['bar', 'line', 'area'].forEach(t => {
        const btn = document.getElementById(`tipo-${t}`);
        if (btn) btn.classList.toggle('ativo', t === tipo);
    });
    if (AC.dados) renderizarGraficoFinanceiro(AC.dados);
}

/* --- GRÁFICO DONUT COMPOSIÇÃO --- */
function renderizarDonut(composicao) {
    destroyChart('donut');
    const container = document.getElementById('grafico-donut');
    if (!container) return;

    const labels = composicao?.labels || [];
    const valores = composicao?.valores || [];
    const soma = valores.reduce((a, b) => a + b, 0);

    if (soma <= 0) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-pie"></i><p>Aguardando dados para exibir a distribuição.</p></div>';
        return;
    }

    container.innerHTML = '';
    const c = coresGrafico();

    const options = {
        series: valores,
        labels: labels,
        chart: {
            type: 'donut',
            height: 260,
            background: 'transparent',
            fontFamily: 'inherit'
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        colors: ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
        legend: { position: 'bottom', labels: { colors: c.texto } },
        tooltip: { y: { formatter: v => fmt(v) } },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Gastos',
                            formatter: () => fmt(soma),
                            color: c.texto
                        }
                    }
                }
            }
        }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    AC.charts['donut'] = chart;
}

/* --- TABELA COMPARATIVA --- */
function renderizarTabelaComparacao(dados) {
    const tbody = document.getElementById('tabela-comparacao-body');
    if (!tbody || !dados?.periodo) return;

    const metricas = [
        { nome: 'Receita Bruta', atual: dados.faturamento?.valor, ant: dados.faturamento?.valor_anterior, var: dados.faturamento?.variacao, isMoeda: true },
        { nome: 'Despesas Totais', atual: dados.despesa?.valor, ant: dados.despesa?.valor_anterior, var: dados.despesa?.variacao, isMoeda: true, invertido: true },
        { nome: 'Lucro Líquido Real', atual: dados.lucro?.valor, ant: dados.lucro?.valor_anterior, var: dados.lucro?.variacao, isMoeda: true },
        { nome: 'Margem Líquida', atual: dados.margem?.valor, ant: dados.margem?.valor_anterior, var: dados.margem?.variacao, isMoeda: false },
        { nome: 'Margem de Contribuição', atual: dados.contabil?.margem_contribuicao, ant: dados.contabil_anterior?.margem_contribuicao, var: null, isMoeda: true },
        { nome: 'Ponto de Equilíbrio', atual: dados.contabil?.ponto_equilibrio, ant: dados.contabil_anterior?.ponto_equilibrio, var: null, isMoeda: true }
    ];

    tbody.innerHTML = metricas.map((m, i) => {
        const valAtual = m.isMoeda ? fmt(m.atual) : fmtPct(m.atual);
        const valAnt = m.isMoeda ? fmt(m.ant) : fmtPct(m.ant);
        const bg = i % 2 === 1 ? 'background:rgba(229,231,235,0.04);' : '';
        return `
            <tr style="${bg}">
                <td style="font-weight:700;">${m.nome}</td>
                <td style="text-align:right;font-weight:800;">${valAtual}</td>
                <td style="text-align:right;color:var(--suave);">${valAnt}</td>
                <td style="text-align:right;">${variacaoHTML(m.var, m.invertido)}</td>
            </tr>
        `;
    }).join('');
}

/* --- CENÁRIOS E PROJEÇÕES --- */
function renderizarCenarios(cenarios) {
    const container = document.getElementById('cenario-cards-container');
    if (!container || !cenarios) return;

    const cards = [
        { chave: 'provavel', cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { chave: 'otimista', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        { chave: 'pessimista', cor: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
    ];

    container.innerHTML = cards.map(c => {
        const item = cenarios[c.chave];
        if (!item) return '';
        return `
            <div class="cenario-card" style="border-top:3px solid ${c.cor};">
                <span class="cenario-card__badge" style="background:${c.bg};color:${c.cor};">${item.badge || item.titulo}</span>
                <div class="cenario-card__title">${item.titulo}</div>
                <div class="cenario-card__valor" style="color:${c.cor};">${fmt(item.faturamento)}</div>
                <div style="font-size:0.78rem;color:var(--texto);margin-bottom:4px;">
                    Lucro Estimado: <strong style="color:var(--sucesso);">${fmt(item.lucro)}</strong> (${fmtPct(item.margem)})
                </div>
                <div class="cenario-card__desc">${item.descricao}</div>
            </div>
        `;
    }).join('');

    renderizarGraficoCenarios(cenarios);
}

function renderizarGraficoCenarios(cenarios) {
    destroyChart('cenarios');
    const container = document.getElementById('grafico-cenarios');
    if (!container || !cenarios) return;

    container.innerHTML = '';
    const c = coresGrafico();

    const options = {
        series: [
            {
                name: 'Receita Projetada',
                data: [cenarios.pessimista?.faturamento || 0, cenarios.provavel?.faturamento || 0, cenarios.otimista?.faturamento || 0]
            },
            {
                name: 'Lucro Projetado',
                data: [cenarios.pessimista?.lucro || 0, cenarios.provavel?.lucro || 0, cenarios.otimista?.lucro || 0]
            }
        ],
        chart: {
            type: 'bar',
            height: 280,
            background: 'transparent',
            fontFamily: 'inherit'
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        colors: [c.fat, c.luc],
        xaxis: {
            categories: ['Conservador (-15%)', 'Provável (Tendência)', 'Otimista (+15%)'],
            labels: { style: { colors: c.texto } }
        },
        yaxis: {
            labels: {
                style: { colors: c.texto },
                formatter: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0))
            }
        },
        grid: { borderColor: c.borda, strokeDashArray: 3 },
        tooltip: { y: { formatter: v => fmt(v) } }
    };

    const chart = new ApexCharts(container, options);
    chart.render();
    AC.charts['cenarios'] = chart;
}

/* --- ALERTAS --- */
function renderizarAlertas(alertas) {
    const container = document.getElementById('alertas-lista');
    const badgeCount = document.getElementById('alertas-badge');
    const countText = document.getElementById('alertas-count-text');

    if (!container) return;

    const lista = alertas || [];
    if (badgeCount) {
        badgeCount.textContent = lista.length;
        badgeCount.style.display = lista.length > 0 ? 'inline-block' : 'none';
    }
    if (countText) countText.textContent = `${lista.length} alerta(s) identificado(s)`;

    if (!lista.length) {
        container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-check" style="color:#10b981;"></i><p>Nenhum alerta crítico ativo no período.</p></div>';
        return;
    }

    container.innerHTML = lista.map(al => {
        const cores = {
            critico: { cor: '#ef4444', bg: 'rgba(239,68,68,0.06)' },
            atencao: { cor: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
            sucesso: { cor: '#10b981', bg: 'rgba(16,185,129,0.06)' }
        };
        const c = cores[al.tipo] || cores.atencao;
        return `
            <div class="alerta-item" style="--alerta-cor:${c.cor};--alerta-bg:${c.bg};">
                <i class="${al.icone || 'fa-solid fa-triangle-exclamation'} alerta-item__icon" style="color:${c.cor};"></i>
                <div style="flex:1;">
                    <div class="alerta-item__titulo">${al.titulo}</div>
                    <div class="alerta-item__desc">${al.descricao}</div>
                    ${al.acao ? `<div style="font-size:0.75rem;font-weight:700;color:${c.cor};margin-top:4px;">Ação: ${al.acao}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

/* --- SCORE DETALHADO --- */
function renderizarScoreDetalhe(saude) {
    const container = document.getElementById('score-detalhe-lista');
    if (!container || !saude?.pilares) return;

    const pilares = saude.pilares;
    const keys = Object.keys(pilares);

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
            ${keys.map(k => {
                const p = pilares[k];
                const pct = (p.pontos / p.max) * 100;
                const cor = pct >= 75 ? '#10b981' : pct >= 50 ? '#3b82f6' : pct >= 25 ? '#f59e0b' : '#ef4444';
                return `
                    <div style="padding:14px;background:var(--fundo);border:1px solid var(--borda);border-radius:var(--raio);">
                        <div style="display:flex;justify-content:space-between;font-size:0.75rem;font-weight:700;margin-bottom:6px;">
                            <span>${p.rotulo}</span>
                            <span style="color:${cor};">${p.pontos}/${p.max} pts</span>
                        </div>
                        <div style="height:6px;background:var(--borda);border-radius:10px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:${cor};border-radius:10px;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==============================================================================
// 8. SIMULADOR E PLANEJADOR DE METAS MEI
// ==============================================================================
let _simMeiBase = {
    fatReal: 0,
    custoPct: 30,
    fixos: 575,
    mediaMes: 0
};

function renderizarSimuladorMEI(dadosBase, dadosEst) {
    if (!dadosBase) return;

    // Linha de base real do MEI
    const mei = dadosBase.mei;
    const fatVal = dadosBase.faturamento?.valor || 0;
    const despVal = dadosBase.despesa?.valor || 0;
    const mediaMesReal = (mei && mei.media_mensal > 0) ? mei.media_mensal : (fatVal > 0 ? fatVal : 0);

    // Custo estimado de insumos/mercadorias (% do faturamento)
    let custoPctCalc = 30;
    if (fatVal > 0 && despVal > 0) {
        custoPctCalc = Math.min(70, Math.max(10, Math.round(((despVal * 0.55) / fatVal) * 100)));
    }

    // Fixos reais + DAS (~R$ 75)
    let fixosCalc = 575;
    if (dadosBase.contabil?.despesas_fixas > 0) {
        fixosCalc = Math.round(dadosBase.contabil.despesas_fixas);
    } else if (despVal > 0) {
        fixosCalc = Math.max(150, Math.round(despVal * 0.45));
    }

    _simMeiBase = {
        fatReal: Math.round(mediaMesReal),
        custoPct: custoPctCalc,
        fixos: fixosCalc,
        mediaMes: Math.round(mediaMesReal)
    };

    // Preencher campos
    const inputFat = document.getElementById('sim-mei-faturamento');
    const inputDias = document.getElementById('sim-mei-dias');
    const inputCusto = document.getElementById('sim-mei-custo-pct');
    const inputFixos = document.getElementById('sim-mei-fixos');

    if (inputFat) {
        const sugestaoMeta = mediaMesReal > 1000
            ? Math.min(10000, Math.round((mediaMesReal * 1.15) / 100) * 100)
            : 5000;
        inputFat.value = sugestaoMeta;
    }
    if (inputDias) inputDias.value = '22';
    if (inputCusto) inputCusto.value = custoPctCalc;
    if (inputFixos) inputFixos.value = fixosCalc;

    atualizarSimuladorMEI();
}

function atualizarSimuladorMEI() {
    const elFat = document.getElementById('sim-mei-faturamento');
    const elDias = document.getElementById('sim-mei-dias');
    const elCusto = document.getElementById('sim-mei-custo-pct');
    const elFixos = document.getElementById('sim-mei-fixos');

    if (!elFat || !elDias) return;

    const metaFat = parseFloat(elFat.value) || 0;
    const dias = parseInt(elDias.value, 10) || 22;
    const custoPct = parseFloat(elCusto?.value || 30);
    const fixos = parseFloat(elFixos?.value || 575);

    // Cálculos práticos
    const custoVar = metaFat * (custoPct / 100);
    const custoTotal = custoVar + fixos;
    const sobraTotal = Math.max(0, metaFat - custoTotal);
    const metaDiaria = dias > 0 ? (metaFat / dias) : 0;

    // Reserva de segurança PJ (10% da sobra)
    const reservaPj = Math.round(sobraTotal * 0.10 * 100) / 100;
    // Sobra limpa para conta pessoal do MEI (Pró-labore)
    const salarioLimpo = Math.max(0, Math.round((sobraTotal - reservaPj) * 100) / 100);

    // Faturamento anualizado
    const projecaoAnual = metaFat * 12;
    const pctTetoAnual = ((projecaoAnual / 81000) * 100).toFixed(1);

    // Atualização dos números na tela
    setText('sim-mei-fat-display', fmt(metaFat));
    setText('sim-mei-dias-display', `${dias} dias no mês`);
    setText('sim-mei-custo-display', `${custoPct}% (${fmt(custoVar)})`);
    setText('sim-mei-fixos-display', fmt(fixos));

    setText('sim-mei-res-diario', fmt(metaDiaria));
    setText('sim-mei-res-diario-sub', `meta para cada um dos ${dias} dias`);
    setText('sim-mei-res-salario', fmt(salarioLimpo));
    setText('sim-mei-res-salario-sub', sobraTotal > 0 ? `Sobra limpa para sua conta física` : `Sem sobra com esses custos`);
    setText('sim-mei-res-reserva', fmt(reservaPj));
    setText('sim-mei-res-anual', fmt(projecaoAnual));
    setText('sim-mei-res-teto-desc', `${pctTetoAnual}% do teto anual (R$ 81k)`);

    // Status do Teto e Diagnóstico
    const badgeTeto = document.getElementById('sim-mei-status-teto-badge');
    const boxDiag = document.getElementById('sim-mei-diagnostico-box');

    if (metaFat <= custoTotal) {
        if (badgeTeto) {
            badgeTeto.className = 'badge';
            badgeTeto.style.background = 'rgba(239,68,68,0.1)';
            badgeTeto.style.color = '#ef4444';
            badgeTeto.textContent = 'Alerta de Prejuízo';
        }
        if (boxDiag) {
            boxDiag.style.borderColor = '#ef4444';
            boxDiag.style.background = 'rgba(239,68,68,0.06)';
            boxDiag.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;margin-right:6px;"></i> <strong>Atenção:</strong> Com essa meta de ${fmt(metaFat)}, seus custos totais (${fmt(custoTotal)}) superam as vendas. Aumente a meta ou reduza gastos fixos para gerar sobra de salário.`;
        }
    } else if (projecaoAnual > 97200) {
        if (badgeTeto) {
            badgeTeto.className = 'badge';
            badgeTeto.style.background = 'rgba(239,68,68,0.1)';
            badgeTeto.style.color = '#ef4444';
            badgeTeto.textContent = 'Desenquadramento ME';
        }
        if (boxDiag) {
            boxDiag.style.borderColor = '#ef4444';
            boxDiag.style.background = 'rgba(239,68,68,0.06)';
            boxDiag.innerHTML = `<i class="fa-solid fa-radiation" style="color:#ef4444;margin-right:6px;"></i> <strong>Atenção ao Teto:</strong> Manter ${fmt(metaFat)}/mês totaliza ${fmt(projecaoAnual)}/ano, superando a margem de 20% do MEI (R$ 97.200). Se seu faturamento atingir esse patamar, a migração para Microempresa (ME) será obrigatória.`;
        }
    } else if (projecaoAnual > 81000) {
        if (badgeTeto) {
            badgeTeto.className = 'badge';
            badgeTeto.style.background = 'rgba(245,158,11,0.1)';
            badgeTeto.style.color = '#d97706';
            badgeTeto.textContent = 'Migração para ME';
        }
        if (boxDiag) {
            boxDiag.style.borderColor = '#d97706';
            boxDiag.style.background = 'rgba(245,158,11,0.06)';
            boxDiag.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#d97706;margin-right:6px;"></i> <strong>Crescimento Acima do Teto:</strong> Essa meta anualiza em ${fmt(projecaoAnual)}, superando o teto de R$ 81.000,00. É excelente para o seu bolso (${fmt(salarioLimpo)}/mês), mas organize com antecedência a migração para ME.`;
        }
    } else {
        if (badgeTeto) {
            badgeTeto.className = 'badge';
            badgeTeto.style.background = 'rgba(16,185,129,0.1)';
            badgeTeto.style.color = '#10b981';
            badgeTeto.textContent = 'Seguro no MEI';
        }
        if (boxDiag) {
            boxDiag.style.borderColor = '#10b981';
            boxDiag.style.background = 'rgba(16,185,129,0.06)';
            boxDiag.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;margin-right:6px;"></i> <strong>Meta Equilibrada:</strong> Você fatura ${fmt(metaDiaria)} por dia, retira <strong>${fmt(salarioLimpo)} livre no seu bolso</strong> todo mês e consome ${pctTetoAnual}% do teto anual do MEI com total segurança.`;
        }
    }

    renderizarGraficosSimuladorMEI(metaFat, salarioLimpo, custoVar, fixos, reservaPj);
}

function definirMetaRapidaMEI(val) {
    const el = document.getElementById('sim-mei-faturamento');
    if (el) {
        el.value = val;
        atualizarSimuladorMEI();
    }
}

function resetarSimuladorMEI() {
    const elFat = document.getElementById('sim-mei-faturamento');
    const elCusto = document.getElementById('sim-mei-custo-pct');
    const elFixos = document.getElementById('sim-mei-fixos');
    const elDias = document.getElementById('sim-mei-dias');

    if (elFat) elFat.value = _simMeiBase.fatReal > 1000 ? _simMeiBase.fatReal : 5000;
    if (elCusto) elCusto.value = _simMeiBase.custoPct || 30;
    if (elFixos) elFixos.value = _simMeiBase.fixos || 575;
    if (elDias) elDias.value = '22';

    atualizarSimuladorMEI();
}

function renderizarGraficosSimuladorMEI(metaFat, salarioLimpo, custoVar, fixos, reservaPj) {
    const c1 = document.getElementById('grafico-simulador-mei');
    const c2 = document.getElementById('grafico-destino-mei');
    if (!c1 || !c2) return;

    const cores = coresGrafico();

    // 1. Gráfico de Barras Comparativo
    destroyChart('sim_mei_bar');
    c1.innerHTML = '';
    const fatAtual = _simMeiBase.fatReal || 0;

    const optBar = {
        series: [{
            name: 'Faturamento Mensal',
            data: [
                { x: 'Média Atual', y: fatAtual, fillColor: cores.fat },
                { x: 'Meta Simulada', y: metaFat, fillColor: '#d97706' },
                { x: 'Teto MEI (Mês)', y: 6750, fillColor: '#10b981' }
            ]
        }],
        chart: {
            type: 'bar',
            height: 250,
            background: 'transparent',
            toolbar: { show: false },
            fontFamily: 'inherit'
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        plotOptions: {
            bar: {
                borderRadius: 6,
                columnWidth: '45%',
                distributed: true,
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: true,
            formatter: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)),
            offsetY: -20,
            style: { fontSize: '11px', colors: [cores.texto], fontWeight: '700' }
        },
        legend: { show: false },
        xaxis: {
            labels: { style: { colors: cores.texto, fontSize: '11px', fontWeight: '600' } }
        },
        yaxis: {
            labels: {
                style: { colors: cores.texto },
                formatter: v => 'R$ ' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v.toFixed(0))
            }
        },
        grid: { borderColor: cores.borda, strokeDashArray: 3 },
        tooltip: { y: { formatter: v => fmt(v) } }
    };

    const chartBar = new ApexCharts(c1, optBar);
    chartBar.render();
    AC.charts['sim_mei_bar'] = chartBar;

    // 2. Gráfico de Donut do Destino do Dinheiro
    destroyChart('sim_mei_pie');
    c2.innerHTML = '';

    const seriesPie = [
        Math.max(0, Math.round(salarioLimpo)),
        Math.max(0, Math.round(custoVar)),
        Math.max(0, Math.round(fixos)),
        Math.max(0, Math.round(reservaPj))
    ];
    const labelsPie = ['Sobra no seu Bolso (Salário)', 'Mercadorias / Insumos', 'Contas Fixas + DAS MEI', 'Reserva de Caixa PJ'];
    const colorsPie = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

    const optPie = {
        series: seriesPie,
        labels: labelsPie,
        colors: colorsPie,
        chart: {
            type: 'donut',
            height: 250,
            background: 'transparent',
            fontFamily: 'inherit'
        },
        theme: { mode: isDark() ? 'dark' : 'light' },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Meta Total',
                            formatter: () => fmt(metaFat),
                            style: { color: cores.texto, fontWeight: '700' }
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '11px',
            labels: { colors: cores.texto }
        },
        tooltip: {
            y: {
                formatter: v => `${fmt(v)} (${metaFat > 0 ? ((v / metaFat) * 100).toFixed(1) : 0}%)`
            }
        },
        stroke: { show: false }
    };

    const chartPie = new ApexCharts(c2, optPie);
    chartPie.render();
    AC.charts['sim_mei_pie'] = chartPie;
}

function atualizarGraficosSimuladorMEI() {
    atualizarSimuladorMEI();
}

// Exposição pública (eventos inline no HTML)
window.atualizarSimuladorMEI = atualizarSimuladorMEI;
window.definirMetaRapidaMEI = definirMetaRapidaMEI;
window.resetarSimuladorMEI = resetarSimuladorMEI;
window.atualizarGraficosSimuladorMEI = atualizarGraficosSimuladorMEI;

// ==============================================================================
// 9. NAVEGAÇÃO DE ABAS
// ==============================================================================
function mudarTab(tab) {
    AC.tabAtual = tab;
    ['contabil', 'desempenho', 'operacional', 'cenarios', 'alertas'].forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const painel = document.getElementById(`painel-${t}`);
        if (btn) btn.classList.toggle('ativo', t === tab);
        if (painel) painel.classList.toggle('ativo', t === tab);
    });

    // Redimensionar gráficos ApexCharts na aba ativa
    setTimeout(() => {
        if (tab === 'operacional') {
            if (AC.dados) {
                renderizarGraficoFinanceiro(AC.dados);
                renderizarDonut(AC.dados.composicao_despesas);
            }
        } else if (tab === 'desempenho') {
            if (AC.dados?.visao_mensal) renderizarGraficoAnual(AC.dados.visao_mensal);
        } else if (tab === 'cenarios') {
            if (AC.perfil === 'MEI') {
                atualizarGraficosSimuladorMEI();
            } else {
                if (AC.estrategico?.cenarios) renderizarGraficoCenarios(AC.estrategico.cenarios);
            }
        }
    }, 100);
}

async function carregarVisaoAnual() {
    const sel = document.getElementById('ano-seletor');
    if (!sel) return;
    const ano = sel.value;
    if (ano) {
        const elInicio = document.getElementById('data-inicio');
        const elFim = document.getElementById('data-fim');
        if (elInicio) elInicio.value = `${ano}-01-01`;
        if (elFim) {
            // Se o ano for o ano máximo da tabela, usa a data_maxima, senão 31/12
            if (AC.limitesDatas && AC.limitesDatas.ano_maximo === parseInt(ano, 10)) {
                elFim.value = AC.limitesDatas.data_maxima;
            } else {
                elFim.value = `${ano}-12-31`;
            }
        }
        AC.filtroRapidoDias = null;
        ['7', '30', '90', '180', '365', 'ano'].forEach(d => {
            const btn = document.getElementById(`fq-${d}`);
            if (btn) btn.classList.remove('ativo');
        });
        await aplicarFiltros();
    }
}

// ==============================================================================
// 10. COLETOR DE CONTEXTO UNIVERSAL PARA O MODAL DA IA (GEMINI)
// ==============================================================================
function coletarContextoIaAnalises() {
    const seletorPlanilha = document.getElementById('seletorPlanilhaAnalise');
    const dataInicioEl = document.getElementById('data-inicio');
    const dataFimEl = document.getElementById('data-fim');

    const inicio = dataInicioEl ? dataInicioEl.value : '';
    const fim = dataFimEl ? dataFimEl.value : '';
    const tabelaId = seletorPlanilha ? seletorPlanilha.value : 'todas';
    const origemTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
        ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
        : 'Todas as Planilhas (Consolidado)';

    const d = AC.dados || {};
    const e = AC.estrategico || {};

    return {
        pagina: 'analises',
        periodo: `${fmtData(inicio)} até ${fmtData(fim)}`,
        tabela_id: tabelaId,
        perfil: AC.perfil,
        dados: {
            origem: origemTexto,
            data_inicio: inicio,
            data_fim: fim,
            perfil: AC.perfil,
            faturamento: d.faturamento || {},
            despesa: d.despesa || {},
            lucro: d.lucro || {},
            margem: d.margem || {},
            contabil: d.contabil || {},
            mei: d.mei || {},
            saude: e.saude || {},
            cenarios: e.cenarios || {},
            alertas: e.alertas || []
        }
    };
}

// ==============================================================================
// 11. NOTIFICAÇÕES TOAST
// ==============================================================================
function mostrarNotificacao(msg, tipo = 'info') {
    // Usa o toast global do sistema (dados.js) se disponível
    if (typeof mostrarToast === 'function') {
        const tipoMapeado = tipo === 'erro' ? 'error' : tipo === 'sucesso' ? 'success' : tipo === 'aviso' ? 'warning' : 'info';
        mostrarToast(msg, tipoMapeado);
        return;
    }
    const tipos = { erro: '#ef4444', aviso: '#f59e0b', sucesso: '#10b981', info: '#3b82f6' };
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;right:24px;background:${tipos[tipo] || tipos.info};color:#fff;padding:12px 20px;border-radius:8px;font-size:0.85rem;font-weight:700;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,0.25);animation:fadeInUp 0.3s ease;`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}