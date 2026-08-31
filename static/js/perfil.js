(function () {
  'use strict';

  function moeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    });
  }

  function pct(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    const sinal = n > 0 ? '+' : '';
    return sinal + n.toFixed(1) + '%';
  }

  function aplicarVariacao(el, valor) {
    if (!el) return;
    const n = Number(valor) || 0;
    el.textContent = pct(n) + ' vs período anterior';
    el.classList.toggle('kpi-card-premium__change--up', n >= 0);
    el.classList.toggle('kpi-card-premium__change--down', n < 0);
  }

  function setTexto(id, texto) {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  }

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

    if (statusEl) {
      if (status?.descricao) {
        statusEl.innerHTML =
          `<span class="pf-status-dot" style="background:${status.cor || '#9ca3af'}"></span>` +
          `<span>${status.descricao}</span>`;
      } else {
        statusEl.textContent = 'Importe e mapeie os dados para o DataInsight calcular a saúde do negócio.';
      }
    }

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

  function animarBarra() {
    const fill = document.getElementById('pf-progress-fill');
    if (!fill) return;
    const alvo = Number(fill.dataset.progresso || 0);
    requestAnimationFrame(() => {
      fill.style.width = Math.max(0, Math.min(100, alvo)) + '%';
    });
  }

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

  document.addEventListener('DOMContentLoaded', () => {
    animarBarra();
    carregarNegocio();
  });
})();
