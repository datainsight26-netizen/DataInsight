// ==============================================================================
// perfil.js
// ==============================================================================
// Este código pertence à plataforma @DataInsight.
// Todos os códigos da plataforma devem seguir a mesma estrutura de organização
// em seções numeradas, conforme este arquivo.
// ==============================================================================

(function () {
  'use strict';

  // ============================================================================
  // 1. UTILITÁRIOS DE FORMATAÇÃO
  // ============================================================================

  /**
   * Formata um valor numérico como moeda brasileira (R$ 1.234).
   * @param {number|string} v
   * @returns {string}
   */
  function moeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });
  }

  /**
   * Formata um valor numérico como percentual com sinal (+/-).
   * Retorna '—' quando o valor não é finito.
   * @param {number|string} v
   * @returns {string}
   */
  function pct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    const sinal = n > 0 ? '+' : '';
    return sinal + n.toFixed(1) + '%';
  }

  /**
   * Aplica o texto e a classe de cor (up/down) em um elemento de variação.
   * @param {HTMLElement|null} el
   * @param {number|null|undefined} valor
   */
  function aplicarVariacao(el, valor) {
    if (!el) return;
    if (valor === null || valor === undefined) {
      el.textContent = 'N/A vs período anterior';
      el.classList.remove('kpi-card-premium__change--up', 'kpi-card-premium__change--down');
      return;
    }
    const n = Number(valor);
    if (!Number.isFinite(n)) {
      el.textContent = 'N/A vs período anterior';
      el.classList.remove('kpi-card-premium__change--up', 'kpi-card-premium__change--down');
      return;
    }
    el.textContent = pct(n) + ' vs período anterior';
    el.classList.toggle('kpi-card-premium__change--up', n >= 0);
    el.classList.toggle('kpi-card-premium__change--down', n < 0);
  }

  /**
   * Define o textContent de um elemento por id, se ele existir.
   * @param {string} id
   * @param {string} texto
   */
  function setTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  }

  // ============================================================================
  // 2. PREENCHIMENTO DOS CARDS DE CONTRIBUIÇÃO (DESEMPENHO + STATUS)
  // ============================================================================

  function preencherContribuicao(desempenho, status) {
    const fat = desempenho?.faturamento?.valor || 0;
    const luc = desempenho?.lucro?.valor || 0;
    const desp = desempenho?.despesa?.valor || 0;
    const cres = desempenho?.crescimento?.valor;
    const temDados = fat !== 0 || luc !== 0 || desp !== 0;

    setTexto('pf-fat-valor', temDados ? moeda(fat) : '—');
    setTexto('pf-luc-valor', temDados ? moeda(luc) : '—');
    setTexto('pf-desp-valor', temDados ? moeda(desp) : '—');
    aplicarVariacao(document.getElementById('pf-fat-pct'), desempenho?.faturamento?.percentual);
    aplicarVariacao(document.getElementById('pf-luc-pct'), desempenho?.lucro?.percentual);
    aplicarVariacao(document.getElementById('pf-desp-pct'), desempenho?.despesa?.percentual);

    const statusEl = document.getElementById('pf-status-negocio');
    const narrativaEl = document.getElementById('pf-narrativa');
    const uso = window.__PERFIL_USO || {};

    // --- Status do negócio ---
    if (statusEl) {
      if (status?.descricao) {
        statusEl.innerHTML =
          `<span class="pf-status-dot" style="background:${status.cor || '#9ca3af'}"></span>` +
          `<span>${status.descricao}</span>`;
      } else {
        statusEl.textContent = 'Importe e mapeie os dados para o DataInsight calcular a saúde do negócio.';
      }
    }

    // --- Narrativa contextual ---
    if (narrativaEl) {
      const partes = [];
      if (temDados) {
        partes.push(
          `Nos últimos 30 dias a plataforma consolidou ${moeda(fat)} de faturamento e ${moeda(luc)} de resultado a partir das suas planilhas.`
        );
        if (Number.isFinite(Number(cres))) {
          const n = Number(cres);
          partes.push(
            n >= 0
              ? `O faturamento está ${pct(n)} em relação ao período anterior — variação que só aparece porque os dados estão no painel.`
              : `O faturamento caiu ${pct(Math.abs(n))} frente ao período anterior. Vale abrir uma análise para achar o gargalo.`
          );
        }
      } else if (uso.total_planilhas > 0) {
        partes.push(
          `${uso.total_planilhas} planilha(s) já estão na conta (${Number(uso.total_linhas || 0).toLocaleString('pt-BR')} linhas). Mapeie as colunas para transformar isso em faturamento, lucro e tendência.`
        );
      } else {
        partes.push(
          'Ainda não há números do negócio aqui. Importe uma planilha: cada uso (mapa, análise, relatório e IA) aumenta a visibilidade do que entra, sai e sobra no caixa.'
        );
      }

      if (uso.total_analises > 0) {
        partes.push(`${uso.total_analises} análise(s) já registradas — histórico para decidir com evidência, não só com feeling.`);
      }
      if (uso.total_relatorios > 0) {
        partes.push(`${uso.total_relatorios} relatório(s) gerados para documentar o período com a equipe.`);
      }
      if (uso.total_ia > 0) {
        partes.push(`${uso.total_ia} pergunta(s) à IA: o assistente já foi usado para interpretar os dados.`);
      }

      narrativaEl.textContent = partes.join(' ');
    }
  }

  // ============================================================================
  // 3. ANIMAÇÃO DA BARRA DE PROGRESSO
  // ============================================================================

  function animarBarra() {
    const fill = document.getElementById('pf-progress-fill');
    if (!fill) return;
    const alvo = Number(fill.dataset.progresso || 0);
    requestAnimationFrame(() => {
      fill.style.width = Math.max(0, Math.min(100, alvo)) + '%';
    });
  }

  // ============================================================================
  // 4. CARREGAMENTO DOS DADOS DE NEGÓCIO
  // ============================================================================

  async function carregarNegocio() {
    const tabelaId = localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas';
    const qs = `periodo=30_dias&tabela_id=${encodeURIComponent(tabelaId)}`;
    try {
      const [rDes, rSta] = await Promise.all([
        fetch(`/api/desempenho?${qs}`),
        fetch(`/api/status_negocio?${qs}`),
      ]);
      const desempenho = rDes.ok ? await rDes.json() : null;
      const status = rSta.ok ? await rSta.json() : null;
      preencherContribuicao(desempenho, status);
    } catch (e) {
      preencherContribuicao(null, null);
    }
  }

  // ============================================================================
  // 5. MODAL DE CANCELAMENTO DE ASSINATURA
  // ============================================================================

  function configurarModalCancelarAssinatura() {
    const btnAbrir = document.getElementById('btnAbrirModalCancelarAssinatura');
    const modal = document.getElementById('modalCancelarAssinatura');
    const btnFechar = document.getElementById('btnFecharModalCancelar');
    const btnConfirmar = document.getElementById('btnConfirmarCancelarAssinatura');

    if (!btnAbrir || !modal) return;

    btnAbrir.addEventListener('click', () => {
      modal.style.display = 'flex';
    });

    if (btnFechar) {
      btnFechar.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cancelando...';

        try {
          const resp = await fetch('/cancelar-assinatura', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const resData = await resp.json();

          if (resp.ok && resData.sucesso) {
            window.location.href = '/bloqueio-assinatura?motivo=cancelada';
          } else {
            alert(resData.erro || 'Falha ao cancelar assinatura.');
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fa-solid fa-ban"></i> Confirmar Cancelamento';
          }
        } catch (err) {
          alert('Erro na requisição. Tente novamente.');
          btnConfirmar.disabled = false;
          btnConfirmar.innerHTML = '<i class="fa-solid fa-ban"></i> Confirmar Cancelamento';
        }
      });
    }
  }

  // ============================================================================
  // 6. INICIALIZAÇÃO
  // ============================================================================

  document.addEventListener('DOMContentLoaded', () => {
    animarBarra();
    carregarNegocio();
    configurarModalCancelarAssinatura();
  });
})();