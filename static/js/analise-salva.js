/**
 * analises-salvas.js
 * Painel de Análises Salvas — DataInsight
 * Lista, filtra, visualiza, copia, exporta em PDF e exclui diagnósticos
 * executivos previamente salvos pela IA.
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
let analisesSalvasCache = [];
let analiseSelecionada = null;
let debounceTimer = null;

// ==============================================================================
// 2. CONTROLE DA SIDEBAR
// ==============================================================================
function abrirSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function fecharSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// ==============================================================================
// 3. INICIALIZAÇÃO
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    carregarAnalisesSalvas();
});

// ==============================================================================
// 4. FILTROS E BUSCA
// ==============================================================================
function debounceBusca() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        carregarAnalisesSalvas();
    }, 300);
}

function selecionarFiltroPagina(val) {
    document.getElementById('filtroPagina').value = val;

    // Atualizar atalhos em pill
    document.querySelectorAll('.pill-btn').forEach(btn => {
        if (btn.getAttribute('data-pill') === val) {
            btn.classList.add('ativo');
        } else {
            btn.classList.remove('ativo');
        }
    });

    carregarAnalisesSalvas();
}

function limparFiltros() {
    document.getElementById('filtroPagina').value = 'todas';
    document.getElementById('filtroBusca').value = '';
    document.getElementById('filtroData').value = '';

    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.classList.toggle('ativo', btn.getAttribute('data-pill') === 'todas');
    });

    carregarAnalisesSalvas();
}

// ==============================================================================
// 5. CARREGAMENTO DE ANÁLISES SALVAS
// ==============================================================================
function carregarAnalisesSalvas() {
    const loading = document.getElementById('loadingAnalisesSalvas');
    const emptyState = document.getElementById('salvasEmptyState');
    const grid = document.getElementById('gridAnalisesSalvas');
    const badgeTotal = document.getElementById('badgeTotalAnalises');

    loading.style.display = 'flex';
    emptyState.style.display = 'none';
    grid.style.display = 'none';

    const pagina = document.getElementById('filtroPagina').value;
    const busca = document.getElementById('filtroBusca').value;
    const data = document.getElementById('filtroData').value;

    const params = new URLSearchParams();
    if (pagina && pagina !== 'todas') params.append('pagina', pagina);
    if (busca) params.append('busca', busca);
    if (data) params.append('data', data);

    fetch(`/api/analises-salvas?${params.toString()}`)
        .then(res => res.json())
        .then(dataResp => {
            loading.style.display = 'none';
            if (dataResp.sucesso && Array.isArray(dataResp.analises)) {
                analisesSalvasCache = dataResp.analises;
                badgeTotal.textContent = `${analisesSalvasCache.length} Registro(s) Encontrado(s)`;

                atualizarKpiSummary(analisesSalvasCache);

                if (analisesSalvasCache.length === 0) {
                    emptyState.style.display = 'block';
                } else {
                    renderizarGrid(analisesSalvasCache);
                    grid.style.display = 'grid';
                }
            } else {
                emptyState.style.display = 'block';
            }
        })
        .catch(err => {
            console.error('Erro ao carregar análises salvas:', err);
            loading.style.display = 'none';
            emptyState.style.display = 'block';
        });
}

// ==============================================================================
// 6. KPIS RESUMO
// ==============================================================================
function atualizarKpiSummary(lista) {
    document.getElementById('kpiTotalAnalises').textContent = lista.length;

    const altaPerf = lista.filter(a =>
        (a.badge || '').toLowerCase().includes('alta') ||
        (a.badge || '').toLowerCase().includes('saudável') ||
        (a.badge || '').toLowerCase().includes('concluído')
    ).length;
    document.getElementById('kpiAltaPerf').textContent = altaPerf;

    const comAlertas = lista.filter(a => Array.isArray(a.alertas_riscos) && a.alertas_riscos.length > 0).length;
    document.getElementById('kpiAlertas').textContent = comAlertas;

    // Calcular página mais frequente
    const contagem = {};
    lista.forEach(a => {
        const p = a.pagina_nome || a.pagina;
        contagem[p] = (contagem[p] || 0) + 1;
    });

    let topPag = '—';
    let maxCount = 0;
    for (const [pag, count] of Object.entries(contagem)) {
        if (count > maxCount) {
            maxCount = count;
            topPag = pag.split(' ')[0];
        }
    }
    document.getElementById('kpiTopPagina').textContent = topPag;
}

// ==============================================================================
// 7. RENDERIZAÇÃO DA GRADE
// ==============================================================================
function renderizarGrid(lista) {
    const grid = document.getElementById('gridAnalisesSalvas');
    grid.innerHTML = lista.map((a, idx) => {
        const veredito = a.veredito || {};
        const cor = a.cor || veredito.cor || '#3b82f6';
        const numFortes = Array.isArray(a.pontos_fortes) ? a.pontos_fortes.length : 0;
        const numAlertas = Array.isArray(a.alertas_riscos) ? a.alertas_riscos.length : 0;
        const numRecom = Array.isArray(a.recomendacoes) ? a.recomendacoes.length : 0;

        return `
          <div class="salva-card" style="border-left-color:${cor};">
            <div>
              <div class="salva-card-badges">
                <span class="salva-badge salva-badge--pagina">
                  <i class="fa-solid fa-layer-group"></i> ${a.pagina_nome || a.pagina.toUpperCase()}
                </span>
                <span class="salva-badge salva-badge--origem" title="${a.origem || ''}">
                  <i class="fa-solid fa-database"></i> ${truncate(a.origem || 'Consolidada', 18)}
                </span>
                <span class="salva-badge salva-badge--periodo" title="${a.periodo || ''}">
                  <i class="fa-solid fa-calendar-days"></i> ${truncate(a.periodo || 'Período', 16)}
                </span>
              </div>

              <h3 class="salva-card-title">${a.titulo || 'Diagnóstico Executivo'}</h3>

              <p class="salva-card-desc">${a.diagnostico_geral ? a.diagnostico_geral.replace(/<[^>]+>/g, '') : 'Resumo executivo salvo do negócio.'}</p>

              <div class="salva-card-highlights">
                <span style="color:#10b981;"><i class="fa-solid fa-circle-check"></i> ${numFortes} Fortes</span>
                <span style="color:#f59e0b;"><i class="fa-solid fa-triangle-exclamation"></i> ${numAlertas} Alertas</span>
                <span style="color:#6366f1;"><i class="fa-solid fa-bullseye"></i> ${numRecom} Decisões</span>
              </div>
            </div>

            <div class="salva-card-footer">
              <div class="salva-card-data">
                <i class="fa-regular fa-clock"></i> ${a.criado_em_fmt || 'Salvo recente'}
              </div>

              <div class="salva-card-actions">
                <button type="button" class="btn-salva-action btn-salva-action--ver" onclick="abrirModalDetalhes(${idx})" title="Visualizar Diagnóstico Completo">
                  <i class="fa-solid fa-eye"></i> Ver
                </button>
                <button type="button" class="btn-salva-action btn-salva-action--copiar" onclick="copiarResumoRapido(${idx}, event)" title="Copiar Resumo">
                  <i class="fa-regular fa-copy"></i>
                </button>
                <button type="button" class="btn-salva-action btn-salva-action--excluir" onclick="excluirAnaliseSalva('${a.id}', event)" title="Excluir Análise Salva">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        `;
    }).join('');
}

// ==============================================================================
// 8. UTILITÁRIOS DE TEXTO
// ==============================================================================
function truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.substring(0, max - 2) + '...' : str;
}

function escapeHtmlPdf(texto) {
    return String(texto || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function nomeArquivoPdfAnalise(titulo) {
    const base = String(titulo || 'analise-datainsight')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return `DataInsight-${base || 'analise'}.pdf`;
}

// ==============================================================================
// 9. MODAL DE DETALHES
// ==============================================================================
function abrirModalDetalhes(index) {
    const item = analisesSalvasCache[index];
    if (!item) return;
    analiseSelecionada = item;

    document.getElementById('detalheModalTitulo').textContent = item.titulo || 'Análise Salva';
    document.getElementById('detalheModalSubtitulo').textContent = item.subtitulo || `Origem: ${item.origem} | Período: ${item.periodo}`;

    const badgeStatus = document.getElementById('detalheModalBadgeStatus');
    badgeStatus.textContent = item.badge || 'Salvo';
    badgeStatus.style.background = item.cor ? `${item.cor}25` : 'rgba(59,130,246,0.15)';
    badgeStatus.style.color = item.cor || '#3b82f6';
    badgeStatus.style.borderColor = item.cor ? `${item.cor}50` : 'rgba(59,130,246,0.3)';

    document.getElementById('detalheModalData').innerHTML = `<i class="fa-regular fa-clock"></i> Salvo em ${item.criado_em_fmt || 'Data indisponível'}`;

    const metricas = item.metricas || [];
    const pontosFortes = item.pontos_fortes || [];
    const alertas = item.alertas_riscos || [];
    const recomendacoes = item.recomendacoes || [];

    let metricasHtml = '';
    if (metricas.length > 0) {
        metricasHtml = `
          <div class="ia-metrics-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(170px, 1fr)); gap:10px; margin-bottom:16px;">
            ${metricas.map(m => `
              <div class="ia-metric-card" style="padding:10px 12px; background:rgba(59,130,246,0.04); border:1px solid var(--borda); border-radius:10px;">
                <div class="ia-metric-card-label" style="font-size:0.7rem; font-weight:700; color:var(--suave); display:flex; justify-content:space-between;">
                  <span>${m.label || ''}</span>
                  <i class="fa-solid ${m.icone || 'fa-chart-line'}" style="color:${m.cor || '#3b82f6'};"></i>
                </div>
                <div class="ia-metric-card-val" style="font-size:1.1rem; font-weight:800; color:${m.cor || 'var(--texto)'}; margin-top:2px;">${m.valor || '—'}</div>
                <div class="ia-metric-card-sub" style="font-size:0.7rem; color:var(--suave);">${m.sub || ''}</div>
              </div>
            `).join('')}
          </div>
        `;
    }

    document.getElementById('detalheModalBody').innerHTML = `
        ${metricasHtml}

        <div class="ia-section-card" style="margin-bottom:14px;">
          <h4 class="ia-section-card-title">     Diagnóstico Executivo da IA</h4>
          <p style="font-size:0.875rem; line-height:1.6; color:var(--texto); margin:0;">${item.diagnostico_geral || 'Diagnóstico não registrado.'}</p>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:12px; margin-bottom:14px;">
          <div class="ia-section-card" style="border-left:3px solid #16a34a;">
            <h4 class="ia-section-card-title">   Pontos Fortes Identificados</h4>
            <ul class="ia-bullets-list">
              ${pontosFortes.length > 0 ? pontosFortes.map(p => `<li class="ia-bullet-item"><span class="ia-bullet-icon" style="color:#16a34a;"><i class="fa-solid fa-check"></i></span><span>${p}</span></li>`).join('') : '<li class="ia-bullet-item" style="color:var(--suave);">Nenhum ponto destacado.</li>'}
            </ul>
          </div>

          <div class="ia-section-card" style="border-left:3px solid #f59e0b;">
            <h4 class="ia-section-card-title">   Alertas & Oportunidades</h4>
            <ul class="ia-bullets-list">
              ${alertas.length > 0 ? alertas.map(p => `<li class="ia-bullet-item"><span class="ia-bullet-icon" style="color:#f59e0b;"><i class="fa-solid fa-arrow-right"></i></span><span>${p}</span></li>`).join('') : '<li class="ia-bullet-item" style="color:var(--suave);">Nenhum alerta registrado.</li>'}
            </ul>
          </div>
        </div>

        <div class="ia-section-card" style="background:linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(99,102,241,0.02) 100%);">
          <h4 class="ia-section-card-title">     Próximos Passos & Decisões Recomendadas</h4>
          <div style="display:flex; flex-direction:column; gap:6px;">
            ${recomendacoes.map((rec, i) => `<div style="font-size:0.85rem; color:var(--texto); line-height:1.5;"><strong>${i + 1}.</strong> ${rec}</div>`).join('')}
          </div>
        </div>
      `;

    const modal = document.getElementById('modalVisualizarAnalise');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function fecharModalDetalhes() {
    const modal = document.getElementById('modalVisualizarAnalise');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function fecharModalDetalhesSeBackdrop(e) {
    if (e.target && e.target.id === 'modalVisualizarAnalise') {
        fecharModalDetalhes();
    }
}

// ==============================================================================
// 10. CÓPIA E EXPORTAÇÃO
// ==============================================================================
function copiarResumoRapido(index, event) {
    if (event) event.stopPropagation();
    const item = analisesSalvasCache[index];
    if (!item) return;

    const texto = `[DATAINSIGHT - ANÁLISE SALVA: ${item.pagina_nome}]
Título: ${item.titulo}
Origem: ${item.origem} (${item.periodo})
Data: ${item.criado_em_fmt}

DIAGNÓSTICO:
${item.diagnostico_geral}

PONTOS FORTES:
${(item.pontos_fortes || []).map(p => `• ${p}`).join('\n')}

ALERTAS E RISCOS:
${(item.alertas_riscos || []).map(p => `• ${p}`).join('\n')}

RECOMENDAÇÕES:
${(item.recomendacoes || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => alert('Resumo copiado com sucesso!'));
    }
}

function copiarDetalheAtual() {
    if (!analiseSelecionada) return;
    const texto = `[DATAINSIGHT - ANÁLISE SALVA: ${analiseSelecionada.pagina_nome}]
Título: ${analiseSelecionada.titulo}
Origem: ${analiseSelecionada.origem} (${analiseSelecionada.periodo})
Data: ${analiseSelecionada.criado_em_fmt}

DIAGNÓSTICO:
${analiseSelecionada.diagnostico_geral}

PONTOS FORTES:
${(analiseSelecionada.pontos_fortes || []).map(p => `• ${p}`).join('\n')}

ALERTAS E RISCOS:
${(analiseSelecionada.alertas_riscos || []).map(p => `• ${p}`).join('\n')}

RECOMENDAÇÕES:
${(analiseSelecionada.recomendacoes || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(() => alert('Resumo copiado com sucesso!'));
    }
}

function baixarPdfModalAnalise() {
    if (!analiseSelecionada) return;
    if (typeof html2pdf === 'undefined') {
        alert('Não foi possível carregar o gerador de PDF. Recarregue a página e tente novamente.');
        return;
    }

    const btn = document.getElementById('btnBaixarPdfAnalise');
    const corpo = document.getElementById('detalheModalBody');
    if (!corpo) return;

    const htmlOriginal = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando PDF...';
    }

    const wrap = document.createElement('div');
    wrap.setAttribute('id', 'analisePdfExport');
    wrap.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:794px',
        'padding:28px 32px 36px',
        'background:#ffffff',
        'color:#111827',
        'font-family:Inter,Arial,sans-serif',
        'box-sizing:border-box'
    ].join(';');

    const subtitulo = analiseSelecionada.subtitulo
        || `Origem: ${analiseSelecionada.origem || '—'} | Período: ${analiseSelecionada.periodo || '—'}`;

    wrap.innerHTML = `
        <div style="border-bottom:2px solid #3b82f6;padding-bottom:14px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;color:#3b82f6;text-transform:uppercase;">DataInsight · Análise salva</div>
          <h1 style="margin:8px 0 6px;font-size:22px;line-height:1.25;color:#0f172a;">${escapeHtmlPdf(analiseSelecionada.titulo || 'Análise Salva')}</h1>
          <p style="margin:0;font-size:12px;color:#475569;">${escapeHtmlPdf(subtitulo)}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#64748b;">Salvo em ${escapeHtmlPdf(analiseSelecionada.criado_em_fmt || 'data indisponível')}</p>
        </div>
      `;

    const clone = corpo.cloneNode(true);
    clone.style.overflow = 'visible';
    clone.style.maxHeight = 'none';
    wrap.appendChild(clone);
    document.body.appendChild(wrap);

    const opcoes = {
        margin: [10, 10, 12, 10],
        filename: nomeArquivoPdfAnalise(analiseSelecionada.titulo),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
    };

    html2pdf().set(opcoes).from(wrap).save()
        .catch((err) => {
            console.error('Erro ao gerar PDF da análise:', err);
            alert('Não foi possível gerar o PDF. Tente novamente.');
        })
        .finally(() => {
            wrap.remove();
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = htmlOriginal || '<i class="fa-solid fa-file-pdf"></i> Baixar PDF';
            }
        });
}

// ==============================================================================
// 11. EXCLUSÃO DE ANÁLISES SALVAS
// ==============================================================================
function excluirAnaliseSalva(id, event) {
    if (event) event.stopPropagation();
    if (!confirm('Deseja realmente excluir esta análise salva?')) return;

    fetch(`/api/analises-salvas/${id}`, {
        method: 'DELETE',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
        .then(res => res.json())
        .then(data => {
            if (data.sucesso) {
                carregarAnalisesSalvas();
            } else {
                alert(data.mensagem || 'Erro ao excluir análise.');
            }
        })
        .catch(err => {
            console.error('Erro ao excluir análise salva:', err);
            alert('Erro ao se comunicar com o servidor.');
        });
}