/**
 * DataInsight — Termômetro do Teto Anual MEI na Página Início
 * Carrega e atualiza o widget de termômetro exclusivo para usuários MEI,
 * sincronizado com a tabela de dados selecionada na Home.
 */

function _fmtBRL_mei(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarTermometroMeiHome() {
  const badge = document.getElementById('homeMeiBadge');
  if (!badge) return; // Não é MEI ou widget não presente

  const seletor = document.getElementById('seletorPlanilhaHome');
  const tabelaId = (seletor && seletor.value) ? seletor.value : (localStorage.getItem('DataInsight_DashboardPlanilha') || 'todas');

  try {
    const res = await fetch(`/api/controles-essenciais?tabela_id=${encodeURIComponent(tabelaId)}`);
    if (!res.ok) return;
    const d = await res.json();

    if (!d || !d.teto_mei) return;

    const teto     = d.teto_mei;
    const faturado = teto.faturado_ano    || 0;
    const limite   = teto.limite_anual    || 81000;
    const restante = teto.saldo_restante  || 0;
    const pct      = teto.percentual_usado || 0;
    const cor      = teto.cor    || '#10b981';
    const badgeTxt = teto.badge  || 'Faixa Segura';
    const mensagem = teto.mensagem || '';

    // — Barra de progresso —
    const bar = document.getElementById('homeMeiBarFill');
    if (bar) bar.style.width = Math.min(100, Math.max(0, pct)) + '%';

    const tetoLabel = document.getElementById('homeMeiTetoLabel');
    if (tetoLabel) tetoLabel.textContent = _fmtBRL_mei(limite) + (teto.proporcional ? ' (Proporcional)' : '');

    // — KPIs —
    const el_fat = document.getElementById('homeMeiFaturado');
    if (el_fat) el_fat.textContent = _fmtBRL_mei(faturado);

    const el_lim = document.getElementById('homeMeiLimite');
    if (el_lim) el_lim.textContent = _fmtBRL_mei(limite) + (teto.proporcional ? ' (Prop.)' : '');

    const el_res = document.getElementById('homeMeiRestante');
    if (el_res) el_res.textContent = _fmtBRL_mei(restante);

    const el_pct = document.getElementById('homeMeiPct');
    if (el_pct) {
      el_pct.textContent = pct + '%';
      el_pct.style.color = cor;
    }

    // — Badge de status —
    badge.innerHTML = '<i class="fa-solid fa-circle" style="font-size:8px;"></i> <span>' + badgeTxt + '</span>';
    badge.style.color       = cor;
    badge.style.borderColor = cor + '50';
    badge.style.background  = cor + '18';

    // — Alerta contextual —
    const alertBox = document.getElementById('homeMeiAlertBox');
    if (alertBox) {
      alertBox.style.color       = cor;
      alertBox.style.borderColor = cor + '40';
      alertBox.style.background  = cor + '10';
    }
    const alertMsg = document.getElementById('homeMeiMensagem');
    if (alertMsg) alertMsg.textContent = mensagem;

  } catch (e) {
    console.warn('[MEI Home] Erro ao carregar termômetro:', e);
  }
}

// Auto-inicializar quando o DOM estiver pronto e escutar o seletor da Home
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('homeMeiBadge')) {
    carregarTermometroMeiHome();

    const seletor = document.getElementById('seletorPlanilhaHome');
    if (seletor) {
      seletor.addEventListener('change', carregarTermometroMeiHome);
    }
  }
});
