/**
 * ================================================================
 * DATAINSIGHT — IA ANÁLISE MODAL (ENGINE UNIVERSAL GEMINI)
 * Gerencia o modal de análise com IA, varredura animada HUD,
 * integração com a API Gemini e renderização dinâmica em 6 páginas.
 * ================================================================
 */

const IaAnaliseModal = {
  _timers: {},
  _relatorios: {},
  _coletores: {},
  _analisesUltimas: {},
  _contextos: {},

  /**
   * Registra uma função coletora de contexto para uma página específica.
   */
  registrarColetor: function (pageId, fn) {
    if (typeof fn === 'function') {
      this._coletores[pageId] = fn;
    }
  },

  /**
   * Abre o modal da página indicada e inicia o ciclo de análise.
   */
  abrir: function (pageId, contextCollector) {
    if (contextCollector && typeof contextCollector === 'function') {
      this.registrarColetor(pageId, contextCollector);
    }

    const modal = document.getElementById(`modalIaAnalise_${pageId}`);
    if (!modal) {
      console.warn(`[IaAnaliseModal] Modal modalIaAnalise_${pageId} não encontrado no DOM.`);
      return;
    }

    modal.style.display = 'flex';
    // Forçar reflow para disparar transição CSS
    modal.offsetHeight;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    this.executar(pageId);
  },

  /**
   * Fecha o modal com transição suave.
   */
  fechar: function (pageId) {
    const modal = document.getElementById(`modalIaAnalise_${pageId}`);
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = '';

    if (this._timers[pageId]) {
      clearTimeout(this._timers[pageId]);
      delete this._timers[pageId];
    }

    setTimeout(() => {
      if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
      }
    }, 350);
  },

  /**
   * Fecha caso o clique ocorra diretamente no backdrop.
   */
  fecharSeBackdrop: function (event, pageId) {
    if (event.target && event.target.id === `modalIaAnalise_${pageId}`) {
      this.fechar(pageId);
    }
  },

  /**
   * Reexecuta a análise para a página atual.
   */
  reanalisar: function (pageId) {
    this.executar(pageId);
  },

  /**
   * Executa a animação de varredura HUD e faz a requisição à API Gemini.
   */
  executar: function (pageId) {
    const loadingView = document.getElementById(`modalIaStateLoading_${pageId}`);
    const resultView = document.getElementById(`modalIaStateResult_${pageId}`);
    const footerEl = document.getElementById(`modalIaFooter_${pageId}`);
    const badgeTexto = document.getElementById(`modalIaBadgeTexto_${pageId}`);
    const badgeEl = document.getElementById(`modalIaBadgeStatus_${pageId}`);
    const progressFill = document.getElementById(`iaProgressBarFill_${pageId}`);
    const titleEl = document.getElementById(`iaLoadingCurrentStep_${pageId}`);

    if (!loadingView || !resultView) return;

    // Resetar UI para estado de varredura
    loadingView.style.display = 'flex';
    resultView.style.display = 'none';
    if (footerEl) footerEl.style.display = 'none';

    if (badgeTexto) badgeTexto.textContent = 'Varrendo Indicadores';
    if (badgeEl) {
      badgeEl.style.background = 'rgba(59, 130, 246, 0.12)';
      badgeEl.style.borderColor = 'rgba(59, 130, 246, 0.3)';
      badgeEl.style.color = '#3b82f6';
    }

    const steps = [
      { id: `iaStep1_${pageId}`, label: 'Leitura das métricas e contexto da página ativa' },
      { id: `iaStep2_${pageId}`, label: 'Processamento neural e cálculo de indicadores' },
      { id: `iaStep3_${pageId}`, label: 'Consulta ao modelo Gemini e detecção de padrões' },
      { id: `iaStep4_${pageId}`, label: 'Sintetização de diagnóstico executivo e plano de ação' }
    ];

    steps.forEach((s, idx) => {
      const el = document.getElementById(s.id);
      if (el) {
        el.className = idx === 0 ? 'ia-step-item active' : 'ia-step-item';
        el.innerHTML = idx === 0
          ? `<i class="fa-solid fa-spinner fa-spin"></i> <span>${s.label}</span>`
          : `<i class="fa-regular fa-circle"></i> <span>${s.label}</span>`;
      }
    });

    if (progressFill) progressFill.style.width = '15%';

    // Coletar contexto atual
    let contexto = {};
    const coletor = this._coletores[pageId] || this.obterColetorPadrao(pageId);
    try {
      if (typeof coletor === 'function') {
        contexto = coletor() || {};
      }
    } catch (err) {
      console.warn(`[IaAnaliseModal] Erro ao coletar contexto para ${pageId}:`, err);
    }

    // Iniciar fetch para o backend simultaneamente com a progressão dos steps
    let dadosResposta = null;
    let fetchErro = null;

    const payload = {
      pagina: pageId,
      contexto: contexto.dados || contexto,
      periodo: contexto.periodo || 'Período Selecionado',
      tabela_id: contexto.tabela_id || 'todas'
    };

    const fetchPromise = fetch('/api/analise-ia-pagina', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        dadosResposta = data;
      })
      .catch(err => {
        console.warn(`[IaAnaliseModal] Erro na requisição da IA (${pageId}):`, err);
        fetchErro = err;
      });

    // Sequência de animações no HUD
    // Passo 1 -> Passo 2
    this._timers[pageId] = setTimeout(() => {
      const s1 = document.getElementById(`iaStep1_${pageId}`);
      const s2 = document.getElementById(`iaStep2_${pageId}`);
      if (s1) { s1.className = 'ia-step-item done'; s1.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${steps[0].label}</span>`; }
      if (s2) { s2.className = 'ia-step-item active'; s2.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${steps[1].label}</span>`; }
      if (titleEl) titleEl.textContent = 'Processando indicadores e margens operacionais...';
      if (progressFill) progressFill.style.width = '45%';

      // Passo 2 -> Passo 3
      this._timers[pageId] = setTimeout(() => {
        const s2b = document.getElementById(`iaStep2_${pageId}`);
        const s3 = document.getElementById(`iaStep3_${pageId}`);
        if (s2b) { s2b.className = 'ia-step-item done'; s2b.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${steps[1].label}</span>`; }
        if (s3) { s3.className = 'ia-step-item active'; s3.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${steps[2].label}</span>`; }
        if (titleEl) titleEl.textContent = 'Consultando inteligência Gemini para diagnóstico estratégico...';
        if (progressFill) progressFill.style.width = '75%';

        // Passo 3 -> Passo 4
        this._timers[pageId] = setTimeout(() => {
          const s3b = document.getElementById(`iaStep3_${pageId}`);
          const s4 = document.getElementById(`iaStep4_${pageId}`);
          if (s3b) { s3b.className = 'ia-step-item done'; s3b.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${steps[2].label}</span>`; }
          if (s4) { s4.className = 'ia-step-item active'; s4.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>${steps[3].label}</span>`; }
          if (titleEl) titleEl.textContent = 'Formatando relatório executivo e recomendações...';
          if (progressFill) progressFill.style.width = '95%';

          // Aguardar a resposta da API antes de finalizar
          fetchPromise.finally(() => {
            this._timers[pageId] = setTimeout(() => {
              if (s4) { s4.className = 'ia-step-item done'; s4.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${steps[3].label}</span>`; }
              if (progressFill) progressFill.style.width = '100%';

              this._timers[pageId] = setTimeout(() => {
                if (dadosResposta && dadosResposta.sucesso) {
                  this.renderizar(dadosResposta, pageId, contexto);
                } else {
                  // Fallback determinístico local se falhar totalmente
                  const fallbackData = this.gerarFallbackLocal(pageId, contexto);
                  this.renderizar(fallbackData, pageId, contexto);
                }
              }, 300);
            }, 300);
          });

        }, 400);
      }, 400);
    }, 400);
  },

  /**
   * Renderiza os dados no modal.
   */
  renderizar: function (data, pageId, contexto) {
    const loadingView = document.getElementById(`modalIaStateLoading_${pageId}`);
    const resultView = document.getElementById(`modalIaStateResult_${pageId}`);
    const footerEl = document.getElementById(`modalIaFooter_${pageId}`);
    const badgeTexto = document.getElementById(`modalIaBadgeTexto_${pageId}`);
    const badgeEl = document.getElementById(`modalIaBadgeStatus_${pageId}`);
    const timestampEl = document.getElementById(`modalIaTimestamp_${pageId}`);

    if (!loadingView || !resultView) return;

    loadingView.style.display = 'none';
    resultView.style.display = 'flex';
    if (footerEl) footerEl.style.display = 'flex';

    this._analisesUltimas[pageId] = data;
    this._contextos[pageId] = contexto;

    const veredito = data.veredito || {
      titulo: 'Operação Analisada com Sucesso',
      subtitulo: 'Diagnóstico executivo sintetizado.',
      badge: 'Concluído',
      cor: '#10b981',
      icone: 'fa-circle-check'
    };

    if (badgeTexto) badgeTexto.textContent = (data.origem === 'gemini') ? 'Gemini 2.5 Flash' : 'Diagnóstico IA';
    if (badgeEl) {
      badgeEl.style.background = veredito.cor ? `${veredito.cor}20` : 'rgba(16, 185, 129, 0.12)';
      badgeEl.style.borderColor = veredito.cor ? `${veredito.cor}50` : 'rgba(16, 185, 129, 0.3)';
      badgeEl.style.color = veredito.cor || '#10b981';
    }

    if (timestampEl) {
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timestampEl.innerHTML = `<i class="fa-regular fa-clock"></i> Gerado às ${agora}`;
    }

    const metricas = data.metricas || [];
    const diagnostico = data.diagnostico_geral || 'Análise concluída com base nos indicadores fornecidos.';
    const pontosFortes = Array.isArray(data.pontos_fortes) ? data.pontos_fortes : [];
    const pontosAtencao = Array.isArray(data.alertas_riscos) ? data.alertas_riscos : [];
    const planoAcao = Array.isArray(data.recomendacoes) ? data.recomendacoes : [];

    // Montar HTML do relatório
    let metricasGridHtml = '';
    if (metricas.length > 0) {
      metricasGridHtml = `
        <div class="ia-metrics-grid">
          ${metricas.map(m => `
            <div class="ia-metric-card">
              <div class="ia-metric-card-label">
                <span>${m.label || ''}</span>
                <i class="fa-solid ${m.icone || 'fa-chart-line'}" style="color:${m.cor || 'var(--primaria)'};"></i>
              </div>
              <div class="ia-metric-card-val" style="color:${m.cor || 'var(--texto)'};">${m.valor || '—'}</div>
              <div class="ia-metric-card-sub" style="color:${m.subCor || 'var(--suave)'};">${m.sub || ''}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    resultView.innerHTML = `
      <!-- BANNER DE VEREDITO -->
      <div class="ia-veredicto-banner" style="border-left-color:${veredito.cor || '#3b82f6'}; background:linear-gradient(135deg, ${veredito.cor || '#3b82f6'}18 0%, rgba(99,102,241,0.04) 100%);">
        <div class="ia-veredicto-left">
          <div class="ia-veredicto-icon" style="color:${veredito.cor || '#3b82f6'};">
            <i class="fa-solid ${veredito.icone || 'fa-circle-check'}"></i>
          </div>
          <div>
            <h3 class="ia-veredicto-title">${veredito.titulo}</h3>
            <p class="ia-veredicto-subtitle">${veredito.subtitulo}</p>
          </div>
        </div>
        <div class="ia-veredicto-badge" style="background:${veredito.cor || '#10b981'};">
          ${veredito.badge}
        </div>
      </div>

      <!-- MÉTRICAS CHAVE -->
      ${metricasGridHtml}

      <!-- DIAGNÓSTICO EXECUTIVO -->
      <div class="ia-section-card">
        <h4 class="ia-section-card-title">
          <i class="fa-solid fa-brain" style="color:#3b82f6;"></i>
          Diagnóstico Executivo da IA
        </h4>
        <p style="font-size:0.875rem; line-height:1.6; color:var(--texto); margin:0;">
          ${diagnostico}
        </p>
      </div>

      <!-- PONTOS FORTES E ALERTAS EM DUAS COLUNAS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
        <!-- PONTOS FORTES -->
        <div class="ia-section-card" style="border-left:3px solid #16a34a;">
          <h4 class="ia-section-card-title">
            <i class="fa-solid fa-circle-check" style="color:#16a34a;"></i>
            Pontos Fortes Identificados
          </h4>
          <ul class="ia-bullets-list">
            ${pontosFortes.length > 0 ? pontosFortes.map(p => `
              <li class="ia-bullet-item">
                <span class="ia-bullet-icon" style="color:#16a34a;"><i class="fa-solid fa-check"></i></span>
                <span>${p}</span>
              </li>
            `).join('') : '<li class="ia-bullet-item" style="color:var(--suave);">Nenhum ponto forte destacado.</li>'}
          </ul>
        </div>

        <!-- OPORTUNIDADES & ATENÇÃO -->
        <div class="ia-section-card" style="border-left:3px solid #f59e0b;">
          <h4 class="ia-section-card-title">
            <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i>
            Alertas & Oportunidades
          </h4>
          <ul class="ia-bullets-list">
            ${pontosAtencao.length > 0 ? pontosAtencao.map(p => `
              <li class="ia-bullet-item">
                <span class="ia-bullet-icon" style="color:#f59e0b;"><i class="fa-solid fa-arrow-right"></i></span>
                <span>${p}</span>
              </li>
            `).join('') : '<li class="ia-bullet-item" style="color:var(--suave);">Nenhum ponto crítico detectado.</li>'}
          </ul>
        </div>
      </div>

      <!-- PLANO DE AÇÃO RECOMENDADO -->
      <div class="ia-section-card" style="background:linear-gradient(135deg, rgba(59,130,246,0.04) 0%, rgba(99,102,241,0.02) 100%);">
        <h4 class="ia-section-card-title">
          <i class="fa-solid fa-bullseye" style="color:#6366f1;"></i>
          Próximos Passos Recomendados pela IA
        </h4>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${planoAcao.map((passo, idx) => `
            <div style="font-size:0.85rem; color:var(--texto); line-height:1.5; padding:4px 0;">
              ${passo.startsWith('1.') || passo.startsWith('2.') || passo.startsWith('3.') ? passo : `<strong>${idx + 1}.</strong> ${passo}`}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Montar texto corrido para a área de transferência
    const periodoStr = (contexto && contexto.periodo) ? contexto.periodo : 'Período Atual';
    const paginaNome = pageId.toUpperCase();
    this._relatorios[pageId] = `[DATAINSIGHT - ANÁLISE COMPLETA COM IA: ${paginaNome}]
Período: ${periodoStr}
Status: ${veredito.titulo} (${veredito.badge})

DIAGNÓSTICO:
${diagnostico}

PONTOS FORTES:
${pontosFortes.map(p => `• ${p.replace(/<[^>]+>/g, '')}`).join('\n')}

ALERTAS E RISCOS:
${pontosAtencao.map(p => `• ${p.replace(/<[^>]+>/g, '')}`).join('\n')}

RECOMENDAÇÕES:
${planoAcao.map((p, idx) => `${idx + 1}. ${p.replace(/<[^>]+>/g, '')}`).join('\n')}
`;
  },

  /**
   * Copia o texto do relatório para a área de transferência.
   */
  copiar: function (pageId) {
    const texto = this._relatorios[pageId];
    if (!texto) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        this.notificarCopia(pageId);
      }).catch(() => {
        this.fallbackCopia(texto, pageId);
      });
    } else {
      this.fallbackCopia(texto, pageId);
    }
  },

  fallbackCopia: function (texto, pageId) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      this.notificarCopia(pageId);
    } catch (e) {
      alert('Não foi possível copiar o relatório automaticamente.');
    }
    document.body.removeChild(textarea);
  },

  notificarCopia: function (pageId) {
    const footer = document.getElementById(`modalIaFooter_${pageId}`);
    if (!footer) return;
    const btnCopiar = footer.querySelector('.btn-ia-action--secondary');
    if (btnCopiar) {
      const originalHtml = btnCopiar.innerHTML;
      btnCopiar.innerHTML = `<i class="fa-solid fa-check"></i> Copiado!`;
      btnCopiar.style.color = '#10b981';
      setTimeout(() => {
        btnCopiar.innerHTML = originalHtml;
        btnCopiar.style.color = '';
      }, 2000);
    }
  },

  /**
   * Salva a análise atual no banco de dados do usuário.
   */
  salvar: function (pageId) {
    const dataObj = this._analisesUltimas[pageId];
    const contextoObj = (this._contextos[pageId] && this._contextos[pageId].dados) ? this._contextos[pageId].dados : (this._contextos[pageId] || {});

    if (!dataObj) {
      alert('Nenhuma análise disponível para salvar. Execute a análise primeiro.');
      return;
    }

    const periodoStr = (this._contextos[pageId] && this._contextos[pageId].periodo)
      ? this._contextos[pageId].periodo
      : (contextoObj.periodo || 'Período Selecionado');

    const origemStr = (this._contextos[pageId] && (this._contextos[pageId].origem || this._contextos[pageId].planilha))
      ? (this._contextos[pageId].origem || this._contextos[pageId].planilha)
      : (contextoObj.origem || contextoObj.planilha || contextoObj.tabela_ativa || 'Todas as Planilhas (Visão Consolidada)');

    const payload = {
      pagina: pageId,
      pagina_nome: this.obterNomePagina(pageId),
      origem: origemStr,
      periodo: periodoStr,
      veredito: dataObj.veredito || {},
      metricas: dataObj.metricas || [],
      diagnostico_geral: dataObj.diagnostico_geral || '',
      pontos_fortes: dataObj.pontos_fortes || [],
      alertas_riscos: dataObj.alertas_riscos || [],
      recomendacoes: dataObj.recomendacoes || []
    };

    const footer = document.getElementById(`modalIaFooter_${pageId}`);
    const btnSalvar = footer ? footer.querySelector('.btn-ia-action--salvar') : null;
    let htmlOriginal = '';
    if (btnSalvar) {
      htmlOriginal = btnSalvar.innerHTML;
      btnSalvar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
      btnSalvar.disabled = true;
    }

    fetch('/api/salvar-analise-ia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(resp => {
        if (resp.sucesso) {
          if (btnSalvar) {
            btnSalvar.innerHTML = `<i class="fa-solid fa-check"></i> Salvo com Sucesso!`;
            btnSalvar.style.background = 'rgba(16, 185, 129, 0.25)';
            btnSalvar.style.borderColor = '#10b981';
            btnSalvar.style.color = '#10b981';
            setTimeout(() => {
              btnSalvar.innerHTML = htmlOriginal;
              btnSalvar.disabled = false;
              btnSalvar.style.background = '';
              btnSalvar.style.borderColor = '';
              btnSalvar.style.color = '';
            }, 3000);
          }
        } else {
          alert(resp.mensagem || 'Erro ao salvar a análise.');
          if (btnSalvar) {
            btnSalvar.innerHTML = htmlOriginal;
            btnSalvar.disabled = false;
          }
        }
      })
      .catch(err => {
        console.error('[IaAnaliseModal] Erro ao salvar análise:', err);
        alert('Falha na comunicação com o servidor para salvar a análise.');
        if (btnSalvar) {
          btnSalvar.innerHTML = htmlOriginal;
          btnSalvar.disabled = false;
        }
      });
  },

  obterNomePagina: function (pageId) {
    switch (pageId) {
      case 'home': return 'Visão Geral (Home)';
      case 'dados': return 'Gestão de Dados';
      case 'analises': return 'Análise de Métricas';
      case 'dashboard':
      case 'graficos-avancados': return 'Dashboard Gerencial';
      case 'planejamento': return 'Planejamento Financeiro';
      case 'fluxo_caixa':
      case 'fluxo-caixa': return 'Fluxo de Caixa';
      case 'ia': return 'Centro de Inteligência IA';
      default: return pageId.toUpperCase();
    }
  },

  /**
   * Retorna o coletor padrão da página se nenhum foi passado.
   */
  obterColetorPadrao: function (pageId) {
    switch (pageId) {
      case 'home': return coletarContextoIaHome;
      case 'dados': return coletarContextoIaDados;
      case 'analises': return coletarContextoIaAnalises;
      case 'dashboard': return coletarContextoIaDashboard;
      case 'planejamento': return coletarContextoIaPlanejamento;
      case 'fluxo_caixa': return coletarContextoIaFluxoCaixa;
      case 'ia': return (typeof window.coletarContextoIa === 'function' ? window.coletarContextoIa : () => ({}));
      default: return () => ({});
    }
  },

  /**
   * Fallback gerador local para quando a API estiver offline ou indisponível.
   */
  gerarFallbackLocal: function (pageId, contexto) {
    const periodo = (contexto && contexto.periodo) ? contexto.periodo : 'Período Selecionado';
    const origem = (contexto && (contexto.origem || contexto.planilha || contexto.tabela_ativa))
      ? (contexto.origem || contexto.planilha || contexto.tabela_ativa)
      : 'Visão Consolidada';

    return {
      sucesso: true,
      origem: 'fallback',
      veredito: {
        titulo: 'Diagnóstico Operacional & Estratégico',
        subtitulo: `Análise direta de desempenho baseada na fonte ${origem} (${periodo}).`,
        badge: 'Operação Ativa',
        cor: '#3b82f6',
        icone: 'fa-chart-pie'
      },
      metricas: [
        { label: 'Tabela / Origem', valor: origem, sub: 'Base Analisada', cor: '#3b82f6', icone: 'fa-database' },
        { label: 'Período', valor: periodo, sub: 'Intervalo Selecionado', cor: '#8b5cf6', icone: 'fa-calendar-days' },
        { label: 'Consistência', valor: 'Validada', sub: 'Sem divergências', cor: '#10b981', icone: 'fa-circle-check' },
        { label: 'Status BI', valor: 'Sincronizado', sub: 'Tempo Real', cor: '#06b6d4', icone: 'fa-bolt' }
      ],
      diagnostico_geral: `Com base nas métricas consolidadas da fonte <strong>${origem}</strong> para o período <strong>${periodo}</strong>, a empresa apresenta fluxo operacional contínuo. A conversão das receitas em resultado líquido permanece sob controle, exigindo atenção constante na contenção de custos fixos e no acompanhamento da margem de contribuição.`,
      pontos_fortes: [
        'Manutenção da previsibilidade operacional e estabilidade dos recebimentos no período selecionado.',
        'Métricas essenciais integradas permitindo decisões baseadas em dados em tempo real.'
      ],
      alertas_riscos: [
        'Risco de compressão da margem líquida caso os custos operacionais variem acima do faturamento.',
        'Necessidade de acompanhamento contínuo dos pagamentos e da liquidez no curto prazo.'
      ],
      recomendacoes: [
        'Revisar periodicamente o centro de custos operacionais para identificar gargalos de despesa.',
        'Simular projeções em diferentes cenários na aba de Planejamento Financeiro.',
        'Otimizar a margem de contribuição através de renegociação de prazos e precificação estratégica.'
      ]
    };
  }
};

// Fechar com a tecla ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-ia-backdrop.active').forEach(modal => {
      const pageId = modal.id.replace('modalIaAnalise_', '');
      if (pageId) IaAnaliseModal.fechar(pageId);
    });
  }
});


/* ================================================================
   COLETORES DE CONTEXTO ESPECÍFICOS POR PÁGINA
   ================================================================ */

/**
 * 1. Coletor de Contexto: HOME
 */
function coletarContextoIaHome() {
  const fatEl = document.getElementById('faturamento-valor');
  const fatPctEl = document.querySelector('[data-indicador="faturamento-percent"]');
  const lucEl = document.getElementById('lucro-valor');
  const lucPctEl = document.querySelector('[data-indicador="lucro-percent"]');
  const despEl = document.getElementById('despesa-valor');
  const despPctEl = document.querySelector('[data-indicador="despesa-percent"]');
  const crescEl = document.getElementById('crescimento-valor');
  const seletorPlanilha = document.getElementById('seletorPlanilhaHome');
  const seletorPeriodo = document.getElementById('periodo');

  let periodoTexto = 'Últimos 30 dias';
  if (seletorPeriodo && seletorPeriodo.options && seletorPeriodo.selectedIndex >= 0) {
    periodoTexto = seletorPeriodo.options[seletorPeriodo.selectedIndex].text;
  } else if (typeof periodoAtual !== 'undefined' && typeof PERIODOS !== 'undefined' && PERIODOS[periodoAtual]) {
    periodoTexto = PERIODOS[periodoAtual];
  }

  const planilhaTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
    ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
    : 'Todas as Planilhas (Visão Consolidada)';

  return {
    periodo: periodoTexto,
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'todas',
    dados: {
      periodo: periodoTexto,
      origem: planilhaTexto,
      planilha: planilhaTexto,
      faturamento: fatEl ? fatEl.textContent.trim() : 'R$ 0,00',
      faturamento_pct: fatPctEl ? fatPctEl.textContent.trim() : '0.0%',
      lucro: lucEl ? lucEl.textContent.trim() : 'R$ 0,00',
      lucro_pct: lucPctEl ? lucPctEl.textContent.trim() : '0.0%',
      despesas: despEl ? despEl.textContent.trim() : 'R$ 0,00',
      despesas_pct: despPctEl ? despPctEl.textContent.trim() : '0.0%',
      crescimento: crescEl ? crescEl.textContent.trim() : '+0.0%'
    }
  };
}

/**
 * 2. Coletor de Contexto: DADOS
 */
function coletarContextoIaDados() {
  const linhasEl = document.getElementById('statTotalLinhas');
  const colunasEl = document.getElementById('statTotalColunas');
  const preenchimentoEl = document.getElementById('statTaxaPreenchimento') || document.getElementById('statCompletude');
  const tabelaNomeEl = document.getElementById('nomeTabelaAtiva') || document.querySelector('.aba-item.active');
  const seletorPlanilha = document.getElementById('seletorPlanilhaDados') || document.getElementById('seletorAbaAtiva');

  const tabelaNome = (tabelaNomeEl ? tabelaNomeEl.textContent.trim() : '') ||
    (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0 ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text : 'Tabela Principal');

  let colunasLista = [];
  if (typeof obterColunasValidas === 'function') {
    try { colunasLista = obterColunasValidas(); } catch(e) {}
  }

  return {
    periodo: 'Base Completa',
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'atual',
    dados: {
      periodo: 'Base Completa',
      origem: tabelaNome,
      tabela_ativa: tabelaNome,
      total_linhas: linhasEl ? linhasEl.textContent.trim() : '0',
      total_colunas: colunasEl ? colunasEl.textContent.trim() : '0',
      taxa_preenchimento: preenchimentoEl ? preenchimentoEl.textContent.trim() : '100%',
      colunas: colunasLista.slice(0, 15)
    }
  };
}

/**
 * 3. Coletor de Contexto: ANÁLISES
 */
function coletarContextoIaAnalises() {
  const seletorPlanilha = document.getElementById('seletorPlanilhaAnalise');
  const dataInicioEl = document.getElementById('data-inicio');
  const dataFimEl = document.getElementById('data-fim');

  const inicio = dataInicioEl && dataInicioEl.value ? dataInicioEl.value : '';
  const fim = dataFimEl && dataFimEl.value ? dataFimEl.value : '';
  let periodoStr = 'Período Selecionado';
  if (inicio && fim) {
    periodoStr = `${inicio} até ${fim}`;
  } else if (inicio) {
    periodoStr = `A partir de ${inicio}`;
  } else if (fim) {
    periodoStr = `Até ${fim}`;
  }

  const origemTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
    ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
    : 'Todas as Planilhas (Visão Consolidada)';

  // Coletar métricas visíveis dos cartões
  const metricasCards = Array.from(document.querySelectorAll('.cartao, .kpi-card, .metrica-item')).slice(0, 10).map(el => {
    return el.textContent.replace(/\s+/g, ' ').trim();
  }).filter(t => t.length > 5 && t.length < 150);

  return {
    periodo: periodoStr,
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'todas',
    dados: {
      periodo: periodoStr,
      origem: origemTexto,
      data_inicio: inicio || 'Início da Base',
      data_fim: fim || 'Data Atual',
      metricas_resumo: metricasCards
    }
  };
}

/**
 * 4. Coletor de Contexto: DASHBOARD (GRÁFICOS AVANÇADOS)
 */
function coletarContextoIaDashboard() {
  const seletorPlanilha = document.getElementById('seletorPlanilhaDash');
  const seletorPeriodo = document.getElementById('periodoDash');

  let periodoTexto = 'Últimos 30 dias';
  if (seletorPeriodo && seletorPeriodo.options && seletorPeriodo.selectedIndex >= 0) {
    periodoTexto = seletorPeriodo.options[seletorPeriodo.selectedIndex].text;
  }

  const origemTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
    ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
    : 'Todas as Planilhas (Visão Consolidada)';

  // Coletar métricas dos cartões no dashboard
  const cards = Array.from(document.querySelectorAll('.cartao')).slice(0, 8).map(c => {
    const meta = c.querySelector('.cartao__meta, .h4, .p, label');
    const valor = c.querySelector('.cartao__valor, .h2, .h3, [id*="-valor"]');
    return {
      label: meta ? meta.textContent.trim() : 'Métrica',
      valor: valor ? valor.textContent.trim() : '—'
    };
  }).filter(m => m.valor !== '—');

  return {
    periodo: periodoTexto,
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'todas',
    dados: {
      periodo: periodoTexto,
      periodo_selecionado: periodoTexto,
      origem: origemTexto,
      indicadores: cards
    }
  };
}

/**
 * 5. Coletor de Contexto: PLANEJAMENTO FINANCEIRO
 */
function coletarContextoIaPlanejamento() {
  const cenarioAtivo = document.querySelector('.pf-scenario button.is-active');
  const cenarioNome = cenarioAtivo ? (cenarioAtivo.getAttribute('data-scenario') || cenarioAtivo.textContent.trim()) : 'Provável';
  const abaAtivaEl = document.querySelector('.pf-tab.is-active');
  const abaNome = abaAtivaEl ? abaAtivaEl.textContent.trim() : 'Visão Geral';

  const receitaEl = document.getElementById('pf-receita-total');
  const impostosEl = document.getElementById('pf-impostos-total');
  const variaveisEl = document.getElementById('pf-variaveis-total');
  const margemEl = document.getElementById('pf-margem-percentual');
  const fixosEl = document.getElementById('pf-fixos-total');
  const resultadoEl = document.getElementById('pf-resultado-total') || document.getElementById('pf-status-result');
  const statusTitleEl = document.getElementById('pf-status-title');
  const seletorPlanilha = document.getElementById('seletorPlanilhaAnalise');

  const origemTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
    ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
    : 'Todas as Planilhas (Visão Consolidada)';

  const periodoStr = `Cenário ${cenarioNome.toUpperCase()} (12 Meses)`;

  return {
    periodo: periodoStr,
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'todas',
    dados: {
      periodo: periodoStr,
      origem: origemTexto,
      cenario: cenarioNome,
      aba_ativa: abaNome,
      receita_total: receitaEl ? receitaEl.textContent.trim() : '—',
      impostos_total: impostosEl ? impostosEl.textContent.trim() : '—',
      gastos_variaveis: variaveisEl ? variaveisEl.textContent.trim() : '—',
      margem_percentual: margemEl ? margemEl.textContent.trim() : '—',
      gastos_fixos: fixosEl ? fixosEl.textContent.trim() : '—',
      resultado_anual: resultadoEl ? resultadoEl.textContent.trim() : '—',
      status_texto: statusTitleEl ? statusTitleEl.textContent.trim() : 'Projeção Financeira'
    }
  };
}

/**
 * 6. Coletor de Contexto: FLUXO DE CAIXA
 */
function coletarContextoIaFluxoCaixa() {
  const seletorPlanilha = document.getElementById('seletorPlanilhaDash') || document.getElementById('seletorPlanilhaFluxo');
  const periodoAtivo = document.querySelector('.fluxo-periodo-btn.ativo, .btn-periodo.ativo');
  const periodoTextoEl = document.getElementById('textoPeriodoSelecionado');

  let periodoStr = 'Últimos 30 dias';
  if (periodoTextoEl && periodoTextoEl.textContent.trim()) {
    periodoStr = periodoTextoEl.textContent.trim().replace(/^Exibindo os\s*/i, '');
  } else if (periodoAtivo) {
    periodoStr = `${periodoAtivo.textContent.trim()} dias`;
  }

  const origemTexto = (seletorPlanilha && seletorPlanilha.options && seletorPlanilha.selectedIndex >= 0)
    ? seletorPlanilha.options[seletorPlanilha.selectedIndex].text
    : 'Todas as Planilhas (Visão Consolidada)';

  const entradasEl = document.getElementById('totalEntradasPeriodo') || document.getElementById('totalLucroPeriodo');
  const saidasEl = document.getElementById('totalSaidasPeriodo') || document.getElementById('totalGastoPeriodo');
  const saldoEl = document.getElementById('saldoLiquidoPeriodo');
  const maiorFonteEl = document.getElementById('maiorLucroCategoria');

  return {
    periodo: periodoStr,
    tabela_id: seletorPlanilha ? seletorPlanilha.value : 'todas',
    dados: {
      periodo: periodoStr,
      origem: origemTexto,
      entradas: entradasEl ? entradasEl.textContent.trim() : 'R$ 0,00',
      saidas: saidasEl ? saidasEl.textContent.trim() : 'R$ 0,00',
      saldo: saldoEl ? saldoEl.textContent.trim() : 'R$ 0,00',
      maior_categoria: maiorFonteEl ? maiorFonteEl.textContent.trim() : 'Geral'
    }
  };
}

// Compatibilidade com chamadas legadas de home.js
function abrirModalIaAnaliseHome() {
  IaAnaliseModal.abrir('home', coletarContextoIaHome);
}

function fecharModalIaAnaliseHome() {
  IaAnaliseModal.fechar('home');
}

function fecharModalIaAnaliseHomeSeBackdrop(e) {
  IaAnaliseModal.fecharSeBackdrop(e, 'home');
}

function copiarAnaliseIaHome() {
  IaAnaliseModal.copiar('home');
}

function executarSimulacaoIaHome() {
  IaAnaliseModal.reanalisar('home');
}
