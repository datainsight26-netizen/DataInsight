// ═══════════════════════════════════════════════════════════════
// ██████████ FERRAMENTAS EMPRESARIAIS — DADOS PAGE ████████████
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────
// ESTADO INTERNO DO MÓDULO ADICIONAL
// ───────────────────────────────
let _mostrarTotais = false;
let _colunasOcultas = new Set();
let _filtrosAvancados = [];
let _regrasFC = [];

// Governança, Metas e IA
let _validacoes = [];       // [{col, tipo, extra}]
let _metas = {};            // {coluna: valorMeta}
let _auditLogs = [];        // [{timestamp, acao}]

// Inicializar estado.filtrosAvancados se não houver
if (typeof estado !== 'undefined') {
    estado.filtrosAvancados = estado.filtrosAvancados || [];
}

// ───────────────────────────────
// PERSISTÊNCIA AUTOMÁTICA (LOCALSTORAGE)
// ───────────────────────────────
function persistirEstadoLocal() {
    if (typeof estado === 'undefined') return;
    
    // Snapshot da tabela ativa antes de salvar
    sincronizarTabelaAtiva();

    const dadosParaSalvar = {
        todosDados: clonarDadosTabela(estado.todosDados),
        colunasAtuais: [...estado.colunasAtuais],
        // Múltiplas tabelas
        tabelas: _tabelas.map(clonarTabela),
        tabelaAtualId: _tabelaAtualId || (_tabelas[0] && _tabelas[0].id) || null,
        validacoes: _validacoes,
        metas: _metas,
        filtrosAvancados: _filtrosAvancados,
        regrasFC: _regrasFC,
        auditLogs: _auditLogs
    };
    
    try {
        localStorage.setItem('DataInsight_Estado', JSON.stringify(dadosParaSalvar));
    } catch (e) {
        console.warn('Não foi possível salvar no localStorage (limite excedido?)', e);
    }
}

function clonarDadosTabela(dados) {
    if (!Array.isArray(dados)) return [];
    return dados.map(linha => {
        if (linha === null || typeof linha !== 'object') return linha;
        if (typeof structuredClone === 'function') {
            return structuredClone(linha);
        }
        return JSON.parse(JSON.stringify(linha));
    });
}

function clonarTabela(tabela) {
    if (!tabela || typeof tabela !== 'object') return { id: tabela?.id || '', nome: tabela?.nome || '', dados: [], colunas: [] };
    return {
        id: tabela.id,
        nome: tabela.nome,
        dados: clonarDadosTabela(tabela.dados),
        colunas: Array.isArray(tabela.colunas) ? [...tabela.colunas] : []
    };
}

function sincronizarTabelaAtiva() {
    if (!_tabelaAtualId) return;
    const tabAtiva = _tabelas.find(t => t.id === _tabelaAtualId);
    if (!tabAtiva) return;
    tabAtiva.dados = clonarDadosTabela(estado.todosDados);
    tabAtiva.colunas = [...obterColunasValidas()];
}

const persistirTabelaAtualDebounced = debounce(() => {
    sincronizarTabelaAtiva();
    persistirEstadoLocal();
}, 800);

function carregarEstadoLocal() {
    try {
        const salvo = localStorage.getItem('DataInsight_Estado');
        if (salvo) {
            const parseado = JSON.parse(salvo);
            
            // Restaurar múltiplas tabelas (sistema de abas)
            if (parseado.tabelas && Array.isArray(parseado.tabelas) && parseado.tabelas.length > 0) {
                _tabelas = parseado.tabelas.map(clonarTabela);
                _tabelaAtualId = parseado.tabelaAtualId || null;

                // Carregar a tabela ativa no estado principal
                const tabAtiva = _tabelaAtualId
                    ? _tabelas.find(t => t.id === _tabelaAtualId)
                    : _tabelas[0];

                if (tabAtiva) {
                    _tabelaAtualId = tabAtiva.id;
                    estado.todosDados = clonarDadosTabela(tabAtiva.dados);
                    estado.colunasAtuais = [...tabAtiva.colunas];
                }
            } else {
                // Compatibilidade: sem tabelas, só dados simples
                if (parseado.todosDados && parseado.colunasAtuais) {
                    estado.todosDados = parseado.todosDados;
                    estado.colunasAtuais = parseado.colunasAtuais;
                }
            }
            
            if (parseado.validacoes) _validacoes = parseado.validacoes;
            if (parseado.metas) _metas = parseado.metas;
            if (parseado.filtrosAvancados) _filtrosAvancados = parseado.filtrosAvancados;
            if (parseado.regrasFC) _regrasFC = parseado.regrasFC;
            if (parseado.auditLogs) _auditLogs = parseado.auditLogs;
            
            return true;
        }
    } catch(e) {
        console.error('Erro ao carregar estado do localStorage', e);
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    // Tenta carregar do LocalStorage antes de inicializar o fetch
    const carregouLocal = carregarEstadoLocal();
    if (carregouLocal) {
        setTimeout(() => {
            if (typeof renderizarColunas === 'function') {
                renderizarColunas();
                atualizarTabela();
                exibirPagina();
                atualizarPaginacao();
                atualizarEstatisticas();
                atualizarMetasUI();
            }
            // Restaurar as abas de tabelas na UI
            if (_tabelas.length > 0) {
                renderizarAbasTabelas();
            }
        }, 300);
    }
});

// ───────────────────────────────
// LOG DE AUDITORIA
// ───────────────────────────────
function registrarLog(acao) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    _auditLogs.push({ timestamp, acao });
    if (_auditLogs.length > 100) _auditLogs.shift(); // limite 100 logs
}

function abrirModalAuditoria() {
    const lista = document.getElementById('auditLogLista');
    if (!lista) return;
    lista.innerHTML = _auditLogs.length === 0
        ? '<p style="color:var(--suave); text-align:center; padding:20px; margin:0;">Nenhuma alteração registrada nesta sessão.</p>'
        : _auditLogs.map(log => `
            <div class="audit-log-item">
                <span class="audit-time">[${log.timestamp}]</span>
                <span>${escapeHtml(log.acao)}</span>
            </div>
        `).join('');
    document.getElementById('modalAuditoria').style.display = 'flex';
}

function limparAuditLog() {
    _auditLogs = [];
    abrirModalAuditoria();
    mostrarToast('Logs de auditoria limpos.', 'info');
}

// ───────────────────────────────
// DEFINIÇÃO E CONTROLE DE METAS
// ───────────────────────────────
function abrirModalDefinirMetas() {
    const colunas = obterColunasValidas();
    const container = document.getElementById('metasListaInputs');
    if (!container) return;

    // Encontrar colunas de aspecto financeiro ou numéricas
    const colunasFinanceiras = colunas.filter(col => {
        const vals = (estado.todosDados || []).map(l => parseFloat(String(l[col] || '').replace(',', '.'))).filter(n => !isNaN(n));
        return vals.length > 0;
    });

    if (colunasFinanceiras.length === 0) {
        container.innerHTML = '<p style="color:var(--suave); text-align:center;">Adicione colunas numéricas primeiro.</p>';
        document.getElementById('modalDefinirMetas').style.display = 'flex';
        return;
    }

    container.innerHTML = colunasFinanceiras.map(col => `
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; flex:1;">${escapeHtml(col)}:</label>
          <input type="number" id="meta-val-${escapeHtml(col)}" class="entrada" 
                 value="${_metas[col] || ''}" placeholder="Sem meta" style="width:180px;">
        </div>
    `).join('');

    document.getElementById('modalDefinirMetas').style.display = 'flex';
}

function salvarMetasCorporativas() {
    const colunas = obterColunasValidas();
    _metas = {};
    colunas.forEach(col => {
        const input = document.getElementById(`meta-val-${col}`);
        if (input && input.value) {
            const valor = parseFloat(input.value);
            if (!isNaN(valor)) _metas[col] = valor;
        }
    });

    document.getElementById('modalDefinirMetas').style.display = 'none';
    atualizarMetasUI();
    registrarLog('Metas financeiras corporativas atualizadas.');
    mostrarToast('Metas salvas com sucesso!', 'success');
}

function atualizarMetasUI() {
    const panel = document.getElementById('goalsSection');
    const container = document.getElementById('goalsProgressContainer');
    if (!panel || !container) return;

    const metasAtivas = Object.keys(_metas);
    if (metasAtivas.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = 'block';
    const dados = estado.todosDados || [];

    container.innerHTML = metasAtivas.map(col => {
        const meta = _metas[col];
        const vals = dados.map(l => parseFloat(String(l[col] || '').replace(',', '.'))).filter(n => !isNaN(n));
        const totalAtual = vals.reduce((a, b) => a + b, 0);
        const percent = Math.min(100, Math.round((totalAtual / meta) * 100)) || 0;

        // Cor baseada em progresso
        const barColor = percent >= 100 ? '#16a34a' : percent >= 75 ? '#2563eb' : percent >= 40 ? '#d97706' : '#ef4444';

        return `
            <div class="goal-row">
              <div class="goal-title">${escapeHtml(col)}</div>
              <div class="goal-progress-container" title="Soma Atual: R$ ${totalAtual.toLocaleString('pt-BR')} de Meta: R$ ${meta.toLocaleString('pt-BR')}">
                <div class="goal-progress-bar" style="width: ${percent}%; background: ${barColor};"></div>
              </div>
              <div class="goal-percent-badge" style="color: ${barColor};">${percent}%</div>
              <div style="font-size:11px; color:var(--suave); font-weight:500;">
                R$ ${totalAtual.toLocaleString('pt-BR', {maximumFractionDigits:2})} / R$ ${meta.toLocaleString('pt-BR')}
              </div>
            </div>
        `;
    }).join('');
}

// ───────────────────────────────
// VALIDAÇÃO DE DADOS (DATA QUALITY)
// ───────────────────────────────
function abrirModalValidacao() {
    renderizarRegrasValidacao();
    document.getElementById('modalValidacao').style.display = 'flex';
}

function adicionarRegraValidacao() {
    const colunas = obterColunasValidas();
    _validacoes.push({ col: colunas[0] || '', tipo: 'numero_positivo', extra: '' });
    renderizarRegrasValidacao();
}

function renderizarRegrasValidacao() {
    const colunas = obterColunasValidas();
    const lista = document.getElementById('validacoesLista');
    if (!lista) return;

    lista.innerHTML = _validacoes.length === 0
        ? '<p style="color:var(--suave); text-align:center; padding:10px;">Nenhuma regra configurada.</p>'
        : _validacoes.map((v, i) => `
            <div class="validation-row">
                <select onchange="_validacoes[${i}].col=this.value">
                    ${colunas.map(c => `<option value="${escapeHtml(c)}" ${v.col === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
                <select onchange="trocarTipoValidacao(${i}, this.value)">
                    <option value="numero_positivo" ${v.tipo==='numero_positivo'?'selected':''}>🔢 Apenas Números Positivos</option>
                    <option value="intervalo_numerico" ${v.tipo==='intervalo_numerico'?'selected':''}>📏 Intervalo Numérico</option>
                    <option value="apenas_texto" ${v.tipo==='apenas_texto'?'selected':''}>📝 Apenas Texto</option>
                    <option value="lista_opcoes" ${v.tipo==='lista_opcoes'?'selected':''}>🗂️ Lista de Opções (ex: Ativo, Inativo)</option>
                    <option value="data_valida" ${v.tipo==='data_valida'?'selected':''}>📅 Data Válida</option>
                </select>
                <input type="text" id="val-extra-${i}" value="${escapeHtml(v.extra || '')}" 
                       placeholder="${v.tipo==='intervalo_numerico'?'ex: 10-500':v.tipo==='lista_opcoes'?'Opção1, Opção2':'Não requerido'}"
                       onchange="_validacoes[${i}].extra=this.value"
                       style="flex:1; display: ${['intervalo_numerico','lista_opcoes'].includes(v.tipo)?'':'none'};">
                <button class="botao botao--delet" style="padding:4px 8px;"
                    onclick="_validacoes.splice(${i},1); renderizarRegrasValidacao();">✕</button>
            </div>
        `).join('');
}

function trocarTipoValidacao(i, value) {
    _validacoes[i].tipo = value;
    _validacoes[i].extra = '';
    renderizarRegrasValidacao();
}

function aplicarValidacoes() {
    document.getElementById('modalValidacao').style.display = 'none';
    _executarValidacoesVisuais();
    registrarLog(`Regras de qualidade de dados aplicadas (${_validacoes.length} regras).`);
    mostrarToast('Regras de validação aplicadas.', 'success');
}

function limparValidacoes() {
    _validacoes = [];
    renderizarRegrasValidacao();
    const tbody = document.getElementById('dados-tbody');
    if (tbody) tbody.querySelectorAll('td').forEach(td => td.classList.remove('celula-invalida'));
    document.getElementById('modalValidacao').style.display = 'none';
    mostrarToast('Regras de validação limpas.', 'info');
}

function _executarValidacoesVisuais() {
    if (!_validacoes.length) return;
    const tbody = document.getElementById('dados-tbody');
    if (!tbody) return;
    const colunas = obterColunasValidas();
    const dadosVisiveis = obterDadosVisiveis();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;

    tbody.querySelectorAll('tr').forEach((tr, rowI) => {
        const linha = dadosVisiveis[inicio + rowI];
        if (!linha) return;
        const cells = tr.querySelectorAll('td');

        colunas.forEach((col, colI) => {
            const td = cells[colI + 1];
            if (!td) return;
            const input = td.querySelector('.entrada-linha');
            const val = String(linha[col] || '').trim();

            td.classList.remove('celula-invalida');
            if (input) input.removeAttribute('title');

            for (const r of _validacoes) {
                if (r.col !== col) continue;
                let invalida = false;
                let msgErro = '';

                if (val !== '') {
                    switch (r.tipo) {
                        case 'numero_positivo':
                            const n = parseFloat(val.replace(',', '.'));
                            if (isNaN(n) || n < 0) { invalida = true; msgErro = 'Apenas números positivos.'; }
                            break;
                        case 'intervalo_numerico':
                            const numVal = parseFloat(val.replace(',', '.'));
                            const partes = r.extra.split('-');
                            const min = parseFloat(partes[0]);
                            const max = parseFloat(partes[1]);
                            if (isNaN(numVal) || (!isNaN(min) && numVal < min) || (!isNaN(max) && numVal > max)) {
                                invalida = true;
                                msgErro = `Valor deve estar entre ${min || 0} e ${max || '∞'}.`;
                            }
                            break;
                        case 'apenas_texto':
                            if (/[0-9]/.test(val)) { invalida = true; msgErro = 'Números não permitidos.'; }
                            break;
                        case 'lista_opcoes':
                            const opcoes = r.extra.split(',').map(s => s.trim().toLowerCase());
                            if (!opcoes.includes(val.toLowerCase())) {
                                invalida = true;
                                msgErro = `Permitido apenas: ${r.extra}`;
                            }
                            break;
                        case 'data_valida':
                            const matches = val.match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/) || val.match(/^(\d{4})[\/\-.](\d{2})[\/\-.](\d{2})$/);
                            if (!matches) { invalida = true; msgErro = 'Data inválida.'; }
                            break;
                    }
                }

                if (invalida) {
                    td.classList.add('celula-invalida');
                    if (input) input.setAttribute('title', msgErro);
                    break;
                }
            }
        });
    });
}

// ───────────────────────────────
// PAINEL DE ESTATÍSTICAS (AMPLIADO COM ANOMALIAS)
// ───────────────────────────────
function atualizarEstatisticas() {
    if (typeof obterColunasValidas !== 'function') return;
    const colunas = obterColunasValidas();
    const dados = estado.todosDados || [];
    const total = dados.length;
    const nColunas = colunas.length;
    let preenchidos = 0;
    const totalCelulas = total * nColunas;
    dados.forEach(linha => colunas.forEach(col => {
        if (linha[col] !== '' && linha[col] !== null && linha[col] !== undefined) preenchidos++;
    }));
    const completude = totalCelulas > 0 ? Math.round((preenchidos / totalCelulas) * 100) : 0;

    let somaNum = null, mediaNum = null;
    let anomaliasDetectadas = 0;

    for (const col of colunas) {
        const vals = dados.map(l => parseFloat(String(l[col] || '').replace(',', '.'))).filter(n => !isNaN(n));
        if (vals.length > 0) {
            somaNum = vals.reduce((a, b) => a + b, 0);
            mediaNum = somaNum / vals.length;
            const desvioPadrao = Math.sqrt(vals.map(v => Math.pow(v - mediaNum, 2)).reduce((a, b) => a + b, 0) / vals.length) || 0;
            if (desvioPadrao > 0) {
                // Detectar anomalias e marcar linhas correspondentes
                const limite = 2.0 * desvioPadrao;
                dados.forEach((l, idx) => {
                    const raw = String(l[col] || '').replace(',', '.');
                    const v = parseFloat(raw);
                    if (!isNaN(v) && Math.abs(v - mediaNum) > limite) {
                        anomaliasDetectadas++;
                    }
                });
                // Preencher estado.anomalias com detalhes
                if (!window.estado) window.estado = {};
                window.estado.anomalias = [];
                window.estado.anomaliasIds = new Set();
                const limiteVal = limite;
                dados.forEach((l) => {
                    const raw = String(l[col] || '').replace(',', '.');
                    const v = parseFloat(raw);
                    if (!isNaN(v) && Math.abs(v - mediaNum) > limiteVal) {
                            const diferenca = v - mediaNum;
                            const desvio = desvioPadrao ? (Math.abs(diferenca) / desvioPadrao) : null;
                            const perc = mediaNum ? ((diferenca / mediaNum) * 100) : null;
                            const motivo = `Valor ${v} na coluna "${col}" ${perc !== null ? (perc > 0 ? 'acima' : 'abaixo') : ''} da média (${mediaNum.toFixed(2)}) — ${desvio ? desvio.toFixed(2) + 'σ' : ''}`;
                            window.estado.anomalias.push({ _id: l._id, coluna: col, valor: l[col], motivo });
                        window.estado.anomaliasIds.add(l._id);
                    }
                });
            }
            break;
        }
    }

    const serializado = dados.map(l => colunas.map(c => String(l[c] || '')).join('|'));
    const unicos = new Set(serializado);
    const duplicatas = total > 0 ? serializado.length - unicos.size : 0;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('statTotalLinhas', total.toLocaleString('pt-BR'));
    set('statTotalColunas', nColunas);
    set('statCompletude', completude + '%');
    set('statSomaNum', somaNum !== null ? somaNum.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—');
    set('statMediaNum', mediaNum !== null ? mediaNum.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—');

    // Duplicatas ou Anomalias
    const elDup = document.getElementById('statDuplicatas');
    const elDupLabel = elDup?.parentElement?.querySelector('.stat-card-label');
    if (elDup) {
        if (anomaliasDetectadas > 0) {
            elDup.textContent = anomaliasDetectadas;
            elDup.style.color = '#ef4444';
            if (elDupLabel) { elDupLabel.textContent = 'Anomalias'; elDupLabel.style.color = '#ef4444'; }
        } else {
            elDup.textContent = duplicatas;
            elDup.style.color = duplicatas > 0 ? '#d97706' : '';
            if (elDupLabel) { elDupLabel.textContent = 'Duplicatas'; elDupLabel.style.color = duplicatas > 0 ? '#d97706' : ''; }
        }
    }

    // Cor da completude
    const elComp = document.getElementById('statCompletude');
    if (elComp) elComp.style.color = completude >= 90 ? '#16a34a' : completude >= 60 ? '#d97706' : '#ef4444';

    // Banner de alertas de qualidade de dados
    _atualizarBannerAlertaQualidade({ completude, duplicatas, anomaliasDetectadas, total });

    // Atualizar metas automaticamente e formatar números
    if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
    // Formatar valores visuais (stat cards) para melhor leitura
    const formatMaybe = (v) => (v === '—' ? '—' : String(v));
    const el = document.getElementById('statSomaNum'); if (el) el.textContent = formatMaybe(el.textContent);
    const el2 = document.getElementById('statMediaNum'); if (el2) el2.textContent = formatMaybe(el2.textContent);
}

function _atualizarBannerAlertaQualidade({ completude, duplicatas, anomaliasDetectadas, total }) {
    const banner = document.getElementById('dataQualityAlerts');
    if (!banner) return;

    if (total === 0) { banner.style.display = 'none'; return; }

    const alertas = [];
    if (completude < 80) {
        alertas.push(`<span class="dqa-item dqa-warn"><i class="fa-solid fa-triangle-exclamation"></i> Completude baixa (${completude}%) — há campos vazios nos dados.</span>`);
    }
    if (duplicatas > 0) {
        alertas.push(`<span class="dqa-item dqa-warn"><i class="fa-solid fa-copy"></i> ${duplicatas} linha(s) duplicada(s). Use <strong>Limpeza → Remover Duplicatas</strong>.</span>`);
    }
    if (anomaliasDetectadas > 0) {
        alertas.push(`<span class="dqa-item dqa-err"><i class="fa-solid fa-chart-line"></i> ${anomaliasDetectadas} valor(es) fora do padrão (outliers).</span>`);
        // ações rápidas para anomalias
        alertas.push(`<span class="dqa-item dqa-action"><button id="btnVerAnomalias" class="btn-small">Ver anomalias</button> <button id="btnRemoverAnomalias" class="btn-small btn-danger">Remover todas</button> <button id="btnMostrarTudoAnomalias" class="btn-small">Mostrar todos</button></span>`);
    }

    if (alertas.length === 0) {
        banner.innerHTML = `<span class="dqa-item dqa-ok"><i class="fa-solid fa-circle-check"></i> Qualidade dos dados: <strong>Excelente</strong> — sem problemas detectados.</span>`;
        banner.style.display = 'flex';
        setTimeout(() => { if (banner) banner.style.display = 'none'; }, 5000);
    } else {
        banner.innerHTML = alertas.join('');
        banner.style.display = 'flex';
    }
}



// ───────────────────────────────
// LINHA DE TOTAIS
// ───────────────────────────────
function toggleTotais() {
    _mostrarTotais = !_mostrarTotais;
    const tfoot = document.getElementById('dados-tfoot');
    const btn = document.getElementById('btnToggleTotais');
    if (tfoot) tfoot.style.display = _mostrarTotais ? '' : 'none';
    if (btn) btn.classList.toggle('active', _mostrarTotais);
    if (_mostrarTotais) _atualizarLinhaTotais();
}

function _atualizarLinhaTotais() {
    if (!_mostrarTotais) return;
    const tfoot = document.getElementById('dados-tfoot');
    if (!tfoot) return;
    const colunas = obterColunasValidas();
    const dados = estado.todosDados || [];
    const totalCelulas = colunas.map(col => {
        const vals = dados.map(l => parseFloat(String(l[col] || '').replace(',', '.'))).filter(n => !isNaN(n));
        if (!vals.length) return `<td style="text-align:center;color:var(--suave);">—</td>`;
        const soma = vals.reduce((a, b) => a + b, 0);
        return `<td><div style="padding:4px 10px;"><div style="font-size:12px;font-weight:700;color:var(--primaria);">${soma.toLocaleString('pt-BR',{maximumFractionDigits:2})}</div><div style="font-size:10px;color:var(--suave);">Σ ${vals.length}</div></div></td>`;
    }).join('');
    tfoot.innerHTML = `<tr><td class="total-label" style="text-align:center;font-size:11px;">Σ</td>${totalCelulas}<td></td></tr>`;
}

// ───────────────────────────────
// BARRA DE FÓRMULAS
// ───────────────────────────────
function aplicarFormula() {
    const fb = document.getElementById('formulaBarInput');
    if (!fb) return;
    const expr = fb.value.trim();
    const { row, col } = estado.celulaSelecionada || { row: -1, col: -1 };
    if (row < 0 || col < 0) { mostrarToast('Selecione uma célula primeiro.', 'warning'); return; }
    const colunas = obterColunasValidas();
    const colName = colunas[col - 1];
    if (!colName) return;
    const matchPt = expr.match(/^=(SOMA|MÉDIA|MÁX|MÍN|CONT|MEDIA|MAX|MIN)\((.+)\)$/i);
    if (matchPt) {
        const func = matchPt[1].toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const targetCol = matchPt[2].trim();
        const colIdx = colunas.findIndex(c => c.toLowerCase() === targetCol.toLowerCase());
        if (colIdx < 0) { mostrarToast(`Coluna "${targetCol}" não encontrada.`, 'error'); return; }
        const vals = (estado.todosDados || []).map(l => parseFloat(String(l[colunas[colIdx]] || '').replace(',', '.'))).filter(n => !isNaN(n));
        let resultado = 0;
        if (/SOMA/.test(func)) resultado = vals.reduce((a, b) => a + b, 0);
        else if (/MED|MEDIA/.test(func)) resultado = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        else if (/MAX/.test(func)) resultado = vals.length ? Math.max(...vals) : 0;
        else if (/MIN/.test(func)) resultado = vals.length ? Math.min(...vals) : 0;
        else if (/CONT/.test(func)) resultado = vals.length;
        salvarEstadoHistorico();
        const dadosVisiveis = obterDadosVisiveis();
        const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
        const linha = dadosVisiveis[inicio + row];
        if (linha) {
            const anterior = linha[colName];
            linha[colName] = parseFloat(resultado.toFixed(4));
            registrarLog(`Aplicada fórmula ${func} na linha ${inicio + row + 1}, coluna ${colName}: de "${anterior}" para "${linha[colName]}".`);
        }
        exibirPagina();
        mostrarToast(`Fórmula aplicada: ${resultado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`, 'success');
    } else if (!expr.startsWith('=')) {
        salvarEstadoHistorico();
        const dadosVisiveis = obterDadosVisiveis();
        const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
        const linha = dadosVisiveis[inicio + row];
        if (linha) {
            const anterior = linha[colName];
            linha[colName] = expr;
            registrarLog(`Modificada célula na linha ${inicio + row + 1}, coluna ${colName}: de "${anterior}" para "${expr}".`);
        }
        exibirPagina();
        mostrarToast('Valor aplicado.', 'success');
    } else {
        mostrarToast('Fórmula inválida. Ex: =SOMA(Faturamento)', 'error');
    }
}

function mostrarAjudaFormulas() {
    document.getElementById('modalAjudaFormulas').style.display = 'flex';
}

// ───────────────────────────────
// OPERAÇÕES DE LINHA
// ───────────────────────────────
function _getLinhaAtualSelecionada() {
    const { row } = estado.celulaSelecionada || { row: -1 };
    if (row < 0) return { idx: -1, linha: null };
    const dadosVisiveis = obterDadosVisiveis();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const linha = dadosVisiveis[inicio + row];
    if (!linha) return { idx: -1, linha: null };
    const idx = (estado.todosDados || []).findIndex(l => l._id === linha._id);
    return { idx, linha };
}

function inserirLinhaAcima() {
    const colunas = obterColunasValidas();
    if (!colunas.length) { mostrarToast('Adicione colunas primeiro!', 'warning'); return; }
    let { idx } = _getLinhaAtualSelecionada();
    if (idx < 0) idx = 0;
    salvarEstadoHistorico();
    const novaLinha = { _id: gerarIdLinha() };
    colunas.forEach(col => novaLinha[col] = '');
    estado.todosDados.splice(idx, 0, novaLinha);
    exibirPagina(); atualizarPaginacao();
    registrarLog(`Inserida nova linha vazia na posição ${idx + 1}.`);
    mostrarToast('Linha inserida acima.', 'success');
}

function duplicarLinhaSelecionada() {
    const { idx, linha } = _getLinhaAtualSelecionada();
    if (idx < 0 || !linha) { mostrarToast('Selecione uma célula para duplicar a linha.', 'warning'); return; }
    salvarEstadoHistorico();
    const copia = { ...linha, _id: gerarIdLinha() };
    estado.todosDados.splice(idx + 1, 0, copia);
    exibirPagina(); atualizarPaginacao();
    registrarLog(`Duplicada linha ${idx + 1}.`);
    mostrarToast('Linha duplicada.', 'success');
}

function moverLinhaCima() {
    const { idx } = _getLinhaAtualSelecionada();
    if (idx <= 0) { mostrarToast('A linha já está no topo.', 'info'); return; }
    salvarEstadoHistorico();
    [estado.todosDados[idx], estado.todosDados[idx - 1]] = [estado.todosDados[idx - 1], estado.todosDados[idx]];
    exibirPagina();
    registrarLog(`Linha ${idx + 1} movida para cima.`);
    mostrarToast('Linha movida para cima.', 'success');
}

function moverLinhaBaixo() {
    const { idx } = _getLinhaAtualSelecionada();
    if (idx < 0 || idx >= (estado.todosDados || []).length - 1) { mostrarToast('A linha já está no final.', 'info'); return; }
    salvarEstadoHistorico();
    [estado.todosDados[idx], estado.todosDados[idx + 1]] = [estado.todosDados[idx + 1], estado.todosDados[idx]];
    exibirPagina();
    registrarLog(`Linha ${idx + 1} movida para baixo.`);
    mostrarToast('Linha movida para baixo.', 'success');
}

// ───────────────────────────────
// GERENCIAR COLUNAS (VISIBILIDADE)
// ───────────────────────────────
function abrirModalColunas() {
    const colunas = obterColunasValidas();
    const lista = document.getElementById('colunasVisibilidadeLista');
    if (!lista) return;
    lista.innerHTML = colunas.length === 0
        ? '<p style="color:var(--suave);text-align:center;">Nenhuma coluna disponível.</p>'
        : colunas.map(col => `
            <div class="col-visibilidade-row">
                <input type="checkbox" id="col-vis-${escapeHtml(col)}"
                    ${_colunasOcultas.has(col) ? '' : 'checked'}
                    onchange="toggleVisibilidadeColuna('${escapeHtml(col)}', this.checked)">
                <label for="col-vis-${escapeHtml(col)}" style="flex:1;font-size:13px;cursor:pointer;">${escapeHtml(col)}</label>
                <span style="font-size:11px;color:var(--suave);">${_colunasOcultas.has(col) ? '🙈 Oculta' : '👁 Visível'}</span>
            </div>`).join('');
    document.getElementById('modalColunas').style.display = 'flex';
}

function toggleVisibilidadeColuna(col, visivel) {
    if (visivel) _colunasOcultas.delete(col); else _colunasOcultas.add(col);
    _aplicarVisibilidadeColunas();
    registrarLog(`Visibilidade da coluna "${col}" alterada.`);
}

function atualizarValidacaoLinhaUI(indice, html) {
    const table = document.getElementById('dados-tbody');
    if(!table) return;
    const tr = table.children[indice];
    if(!tr) return;
    const primeiraCelula = tr.querySelector('td:first-child');
    if(primeiraCelula) primeiraCelula.innerHTML = html;
}


// ───────────────────────────────
// PIVOT / AGRUPAMENTO RÁPIDO
// ───────────────────────────────
function abrirModalPivot() {
    const colunas = obterColunasValidas();
    const agruparSelect = document.getElementById('pivotAgrupar');
    const valorSelect = document.getElementById('pivotValor');
    
    if (!agruparSelect || !valorSelect || colunas.length === 0) {
        mostrarToast('Necessário ter dados na tabela.', 'warning');
        return;
    }
    
    const options = colunas.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    agruparSelect.innerHTML = options;
    valorSelect.innerHTML = options;
    
    // Tentar pré-selecionar colunas adequadas (categoria -> agrupamento, numérico -> valor)
    const colCategoria = colunas.find(c => c.toLowerCase().includes('cat') || c.toLowerCase().includes('tipo') || c.toLowerCase().includes('produto') || c.toLowerCase().includes('mes') || c.toLowerCase().includes('data'));
    const colNumerica = colunas.find(c => c.toLowerCase().includes('total') || c.toLowerCase().includes('valor') || c.toLowerCase().includes('faturamento') || c.toLowerCase().includes('preco'));
    
    if (colCategoria) agruparSelect.value = colCategoria;
    if (colNumerica) valorSelect.value = colNumerica;
    
    document.getElementById('pivotResultadoContainer').innerHTML = '<div style="text-align:center; color:var(--suave); font-size:13px; padding:20px;">Configure e clique em "Atualizar Pivot"</div>';
    document.getElementById('modalPivot').style.display = 'flex';
}

function gerarPivot() {
    const colAgrupar = document.getElementById('pivotAgrupar').value;
    const colValor = document.getElementById('pivotValor').value;
    const operacao = document.getElementById('pivotOperacao').value;
    
    if (!colAgrupar || !colValor) return;
    
    const dados = estado.todosDados || [];
    const grupos = {};
    
    dados.forEach(linha => {
        const chave = String(linha[colAgrupar] || '(Vazio)').trim();
        const valStr = String(linha[colValor] || '').replace(',', '.');
        const num = parseFloat(valStr);
        
        if (!grupos[chave]) grupos[chave] = [];
        if (!isNaN(num)) grupos[chave].push(num);
    });
    
    let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <tr style="background:var(--fundo); font-weight:600;">
                    <td style="padding:6px 10px; border-bottom:1px solid var(--borda);">${escapeHtml(colAgrupar)}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid var(--borda); text-align:right;">${operacao} de ${escapeHtml(colValor)}</td>
                  </tr>`;
                  
    const formatBRL = (v) => v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
    
    for (const chave in grupos) {
        const valores = grupos[chave];
        let resultado = 0;
        
        if (valores.length === 0) {
            resultado = operacao === 'CONTAGEM' ? 0 : '—';
        } else {
            switch(operacao) {
                case 'SOMA': resultado = formatBRL(valores.reduce((a,b)=>a+b, 0)); break;
                case 'MEDIA': resultado = formatBRL(valores.reduce((a,b)=>a+b, 0) / valores.length); break;
                case 'CONTAGEM': resultado = valores.length; break;
                case 'MAX': resultado = formatBRL(Math.max(...valores)); break;
                case 'MIN': resultado = formatBRL(Math.min(...valores)); break;
            }
        }
        
        html += `<tr>
                    <td style="padding:6px 10px; border-bottom:1px solid var(--borda);">${escapeHtml(chave)}</td>
                    <td style="padding:6px 10px; border-bottom:1px solid var(--borda); text-align:right; font-weight:600;">${resultado}</td>
                 </tr>`;
    }
    html += `</table>`;
    
    document.getElementById('pivotResultadoContainer').innerHTML = html;
}

// ───────────────────────────────
// CALCULADORA DE REAJUSTE EM MASSA
// ───────────────────────────────
function abrirModalReajusteMassa() {
    const colunas = obterColunasValidas();
    const sel = document.getElementById('reajusteColuna');
    if (!sel || colunas.length === 0) {
        mostrarToast('Necessário ter dados.', 'warning');
        return;
    }
    sel.innerHTML = colunas.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    
    const colNumerica = colunas.find(c => c.toLowerCase().includes('preco') || c.toLowerCase().includes('valor') || c.toLowerCase().includes('custo'));
    if (colNumerica) sel.value = colNumerica;
    
    document.getElementById('reajusteValor').value = '';
    document.getElementById('modalReajusteMassa').style.display = 'flex';
}

function aplicarReajusteMassa() {
    const col = document.getElementById('reajusteColuna').value;
    const tipo = document.getElementById('reajusteTipo').value;
    const valorRaw = document.getElementById('reajusteValor').value.replace(',', '.');
    const valor = parseFloat(valorRaw);
    
    if (!col || isNaN(valor)) {
        mostrarToast('Informe um valor numérico válido.', 'warning');
        return;
    }
    
    salvarEstadoHistorico();
    
    let qtdeAlterada = 0;
    
    estado.todosDados.forEach(linha => {
        let num = parseFloat(String(linha[col] || '').replace(',', '.'));
        if (!isNaN(num)) {
            switch(tipo) {
                case 'percentual_aumento': num = num + (num * (valor / 100)); break;
                case 'percentual_desconto': num = num - (num * (valor / 100)); break;
                case 'fixo_soma': num = num + valor; break;
                case 'fixo_subtracao': num = num - valor; break;
                case 'multiplicacao': num = num * valor; break;
            }
            
            // Formatando de volta para string amigável (2 casas)
            linha[col] = num.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
            qtdeAlterada++;
        }
    });
    
    document.getElementById('modalReajusteMassa').style.display = 'none';
    
    if (qtdeAlterada > 0) {
        registrarLog(`Reajuste em massa na coluna "${col}" (${tipo} : ${valor}) aplicados em ${qtdeAlterada} registros.`);
        atualizarTabela();
        exibirPagina();
        atualizarEstatisticas();
        mostrarToast(`${qtdeAlterada} registros atualizados!`, 'success');
        persistirEstadoLocal();
    } else {
        mostrarToast('Nenhum valor numérico encontrado para reajustar.', 'info');
    }
}

function _aplicarVisibilidadeColunas() {
    const tabela = document.getElementById('tabelaDados');
    if (!tabela) return;
    const colunas = obterColunasValidas();
    const thCells = Array.from(tabela.querySelectorAll('thead tr th'));
    colunas.forEach((col, i) => {
        const oculta = _colunasOcultas.has(col);
        if (thCells[i + 1]) thCells[i + 1].style.display = oculta ? 'none' : '';
    });
    tabela.querySelectorAll('tbody tr, tfoot tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td'));
        colunas.forEach((col, i) => {
            if (cells[i + 1]) cells[i + 1].style.display = _colunasOcultas.has(col) ? 'none' : '';
        });
    });
}

function mostrarTodasColunas() {
    _colunasOcultas.clear();
    _aplicarVisibilidadeColunas();
    abrirModalColunas();
    mostrarToast('Todas as colunas estão visíveis.', 'success');
}

// ───────────────────────────────
// FILTROS AVANÇADOS
// ───────────────────────────────
function abrirModalFiltroAvancado() {
    renderizarFiltrosAvancados();
    document.getElementById('modalFiltroAvancado').style.display = 'flex';
}

function adicionarFiltroAvancado() {
    const colunas = obterColunasValidas();
    _filtrosAvancados.push({ col: colunas[0] || '', op: 'contem', val: '' });
    renderizarFiltrosAvancados();
}

function renderizarFiltrosAvancados() {
    const colunas = obterColunasValidas();
    const lista = document.getElementById('filtroAvancadoLista');
    if (!lista) return;
    lista.innerHTML = _filtrosAvancados.length === 0
        ? '<p style="color:var(--suave);text-align:center;font-size:13px;">Nenhuma condição adicionada.</p>'
        : _filtrosAvancados.map((f, i) => `
            <div class="filtro-avancado-row">
                <select onchange="_filtrosAvancados[${i}].col=this.value">
                    ${colunas.map(c => `<option value="${escapeHtml(c)}" ${f.col === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
                <select onchange="_filtrosAvancados[${i}].op=this.value">
                    <option value="contem" ${f.op === 'contem' ? 'selected' : ''}>Contém</option>
                    <option value="nao_contem" ${f.op === 'nao_contem' ? 'selected' : ''}>Não contém</option>
                    <option value="igual" ${f.op === 'igual' ? 'selected' : ''}>Igual a</option>
                    <option value="diferente" ${f.op === 'diferente' ? 'selected' : ''}>Diferente de</option>
                    <option value="maior" ${f.op === 'maior' ? 'selected' : ''}>Maior que</option>
                    <option value="menor" ${f.op === 'menor' ? 'selected' : ''}>Menor que</option>
                    <option value="vazio" ${f.op === 'vazio' ? 'selected' : ''}>Está vazio</option>
                    <option value="nao_vazio" ${f.op === 'nao_vazio' ? 'selected' : ''}>Não está vazio</option>
                </select>
                <input type="text" value="${escapeHtml(f.val)}" placeholder="Valor..."
                    onchange="_filtrosAvancados[${i}].val=this.value" style="flex:1;">
                <button class="botao botao--delet" style="padding:4px 8px;"
                    onclick="_filtrosAvancados.splice(${i},1);renderizarFiltrosAvancados();">✕</button>
            </div>`).join('');
}

function aplicarFiltrosAvancados() {
    document.getElementById('modalFiltroAvancado').style.display = 'none';
    estado.filtrosAvancados = [..._filtrosAvancados];
    estado.paginaAtual = 1;
    atualizarTabela(); exibirPagina(); atualizarPaginacao();
    renderizarTagsFiltros();
    registrarLog(`Filtros de dados ativados (${_filtrosAvancados.length} filtros).`);
    mostrarToast(`${_filtrosAvancados.length} filtro(s) aplicado(s).`, 'info');
}

function limparFiltrosAvancados() {
    _filtrosAvancados = [];
    estado.filtrosAvancados = [];
    renderizarFiltrosAvancados();
    document.getElementById('modalFiltroAvancado').style.display = 'none';
    atualizarTabela(); exibirPagina(); atualizarPaginacao();
    renderizarTagsFiltros();
    registrarLog('Filtros de dados limpos.');
    mostrarToast('Filtros removidos.', 'info');
}

function renderizarTagsFiltros() {
    const container = document.getElementById('filtrosAtivosContainer');
    if (!container) return;
    const filtros = estado.filtrosAvancados || [];
    if (!filtros.length) { container.style.display = 'none'; container.innerHTML = ''; return; }
    container.style.display = 'flex';
    const opLabel = { contem: 'Contém', nao_contem: 'Não contém', igual: '=', diferente: '≠', maior: '>', menor: '<', vazio: 'Vazio', nao_vazio: 'Não vazio' };
    container.innerHTML = filtros.map((f, i) => `
        <span class="filtro-tag">
            <i class="fa-solid fa-filter" style="font-size:10px;"></i>
            ${escapeHtml(f.col)} ${opLabel[f.op] || f.op} ${f.val ? escapeHtml(f.val) : ''}
            <button onclick="removerFiltro(${i})" title="Remover filtro">✕</button>
        </span>`).join('');
}

function removerFiltro(i) {
    estado.filtrosAvancados.splice(i, 1);
    _filtrosAvancados = [...(estado.filtrosAvancados || [])];
    atualizarTabela(); exibirPagina(); atualizarPaginacao();
    renderizarTagsFiltros();
}

// ───────────────────────────────
// FORMATAÇÃO CONDICIONAL
// ───────────────────────────────
function abrirModalFormatacaoCondicional() {
    renderizarRegrasFC();
    document.getElementById('modalFormatacaoCondicional').style.display = 'flex';
}

function adicionarRegraFC() {
    const colunas = obterColunasValidas();
    _regrasFC.push({ col: colunas[0] || '', op: 'maior', val: '0', cor: 'verde' });
    renderizarRegrasFC();
}

function renderizarRegrasFC() {
    const colunas = obterColunasValidas();
    const lista = document.getElementById('fcRegraLista');
    if (!lista) return;
    const cores = { verde: '🟢', vermelho: '🔴', amarelo: '🟡', azul: '🔵', roxo: '🟣', laranja: '🟠' };
    lista.innerHTML = _regrasFC.length === 0
        ? '<p style="color:var(--suave);text-align:center;font-size:13px;">Nenhuma regra criada.</p>'
        : _regrasFC.map((r, i) => `
            <div class="fc-regra-row">
                <select onchange="_regrasFC[${i}].col=this.value">
                    ${colunas.map(c => `<option value="${escapeHtml(c)}" ${r.col === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                </select>
                <select onchange="_regrasFC[${i}].op=this.value">
                    <option value="maior" ${r.op === 'maior' ? 'selected' : ''}>Maior que</option>
                    <option value="menor" ${r.op === 'menor' ? 'selected' : ''}>Menor que</option>
                    <option value="igual" ${r.op === 'igual' ? 'selected' : ''}>Igual a</option>
                    <option value="contem" ${r.op === 'contem' ? 'selected' : ''}>Contém</option>
                    <option value="vazio" ${r.op === 'vazio' ? 'selected' : ''}>Está vazio</option>
                </select>
                <input type="text" value="${escapeHtml(r.val)}"
                    onchange="_regrasFC[${i}].val=this.value" placeholder="Valor" style="width:80px;">
                <select onchange="_regrasFC[${i}].cor=this.value">
                    ${Object.entries(cores).map(([k, v]) => `<option value="${k}" ${r.cor === k ? 'selected' : ''}>${v} ${k.charAt(0).toUpperCase() + k.slice(1)}</option>`).join('')}
                </select>
                <button class="botao botao--delet" style="padding:4px 8px;"
                    onclick="_regrasFC.splice(${i},1);renderizarRegrasFC();">✕</button>
            </div>`).join('');
}

function aplicarFormatacaoCondicional() {
    document.getElementById('modalFormatacaoCondicional').style.display = 'none';
    _aplicarFC();
    registrarLog(`Regras de formatação condicional atualizadas (${_regrasFC.length} regras).`);
    mostrarToast('Formatação condicional aplicada.', 'success');
}

function _aplicarFC() {
    if (!_regrasFC.length) return;
    const tbody = document.getElementById('dados-tbody');
    if (!tbody) return;
    const colunas = obterColunasValidas();
    const dadosVisiveis = obterDadosVisiveis();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    tbody.querySelectorAll('tr').forEach((tr, rowI) => {
        const linha = dadosVisiveis[inicio + rowI];
        if (!linha) return;
        const cells = tr.querySelectorAll('td');
        colunas.forEach((col, colI) => {
            const td = cells[colI + 1];
            if (!td) return;
            const val = String(linha[col] || '').toLowerCase().trim();
            const num = parseFloat(val.replace(',', '.'));
            td.classList.remove('fc-verde', 'fc-vermelho', 'fc-amarelo', 'fc-azul', 'fc-roxo', 'fc-laranja');
            for (const regra of _regrasFC) {
                if (regra.col !== col) continue;
                const fval = String(regra.val || '').toLowerCase().trim();
                const fnum = parseFloat(fval.replace(',', '.'));
                let match = false;
                switch (regra.op) {
                    case 'maior': match = !isNaN(num) && !isNaN(fnum) && num > fnum; break;
                    case 'menor': match = !isNaN(num) && !isNaN(fnum) && num < fnum; break;
                    case 'igual': match = val === fval; break;
                    case 'contem': match = val.includes(fval); break;
                    case 'vazio': match = val === ''; break;
                }
                if (match) { td.classList.add(`fc-${regra.cor}`); break; }
            }
        });
    });
}

function limparFormatacaoCondicional() {
    _regrasFC = [];
    renderizarRegrasFC();
    const tbody = document.getElementById('dados-tbody');
    if (tbody) tbody.querySelectorAll('td').forEach(td =>
        td.classList.remove('fc-verde', 'fc-vermelho', 'fc-amarelo', 'fc-azul', 'fc-roxo', 'fc-laranja'));
    mostrarToast('Formatação condicional removida.', 'info');
}

// ───────────────────────────────
// FERRAMENTAS DE LIMPEZA DE DADOS
// ───────────────────────────────
function abrirModalLimpeza() {
    const sel = document.getElementById('substituirColuna');
    if (sel) {
        const colunas = obterColunasValidas();
        sel.innerHTML = '<option value="__todas__">Todas as colunas</option>'
            + colunas.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    }
    document.getElementById('modalLimpeza').style.display = 'flex';
}

function removerDuplicatas() {
    const colunas = obterColunasValidas();
    const antes = (estado.todosDados || []).length;
    const visto = new Set();
    salvarEstadoHistorico();
    estado.todosDados = (estado.todosDados || []).filter(linha => {
        const key = colunas.map(c => String(linha[c] || '').trim()).join('|');
        if (visto.has(key)) return false;
        visto.add(key); return true;
    });
    const removidas = antes - estado.todosDados.length;
    exibirPagina(); atualizarPaginacao();
    registrarLog(`Limpeza: Removidas ${removidas} linhas duplicadas.`);
    mostrarToast(`${removidas} linha(s) duplicada(s) removida(s).`, removidas > 0 ? 'success' : 'info');
}

function preencherVaziosComMedia() {
    const colunas = obterColunasValidas();
    salvarEstadoHistorico();
    let preenchidos = 0;
    colunas.forEach(col => {
        const vals = (estado.todosDados || []).map(l => parseFloat(String(l[col] || '').replace(',', '.'))).filter(n => !isNaN(n));
        if (!vals.length) return;
        const media = vals.reduce((a, b) => a + b, 0) / vals.length;
        (estado.todosDados || []).forEach(linha => {
            const v = String(linha[col] || '').trim();
            if (v === '' || isNaN(parseFloat(v))) { linha[col] = parseFloat(media.toFixed(2)); preenchidos++; }
        });
    });
    exibirPagina();
    registrarLog(`Limpeza: Preenchidos ${preenchidos} valores em branco com a média.`);
    mostrarToast(`${preenchidos} campo(s) preenchido(s) com média.`, 'success');
}

function _normalizarTextos(fn, tipo) {
    const colunas = obterColunasValidas();
    salvarEstadoHistorico();
    (estado.todosDados || []).forEach(linha => colunas.forEach(col => {
        if (typeof linha[col] === 'string') linha[col] = fn(linha[col]);
    }));
    exibirPagina();
    registrarLog(`Limpeza: Normalizados textos em toda a planilha para ${tipo}.`);
    mostrarToast('Normalização aplicada.', 'success');
}

function normalizarTextoMinusculas() { _normalizarTextos(s => s.toLowerCase(), 'minúsculas'); }
function normalizarTextoMaiusculas() { _normalizarTextos(s => s.toUpperCase(), 'maiúsculas'); }
function normalizarTextoCapitalizado() { _normalizarTextos(s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), 'capitalizado'); }

function trimEspacos() {
    const colunas = obterColunasValidas();
    salvarEstadoHistorico();
    let trimados = 0;
    (estado.todosDados || []).forEach(linha => colunas.forEach(col => {
        if (typeof linha[col] === 'string') {
            const novo = linha[col].replace(/\s+/g, ' ').trim();
            if (novo !== linha[col]) { linha[col] = novo; trimados++; }
        }
    }));
    exibirPagina();
    registrarLog(`Limpeza: Efetuado trim de espaços extras em ${trimados} células.`);
    mostrarToast(`${trimados} campo(s) com espaços corrigidos.`, 'success');
}

function removerLinhasVazias() {
    const colunas = obterColunasValidas();
    const antes = (estado.todosDados || []).length;
    salvarEstadoHistorico();
    estado.todosDados = (estado.todosDados || []).filter(linha => colunas.some(col => String(linha[col] || '').trim() !== ''));
    const removidas = antes - estado.todosDados.length;
    exibirPagina(); atualizarPaginacao();
    registrarLog(`Limpeza: Removidas ${removidas} linhas totalmente vazias.`);
    mostrarToast(`${removidas} linha(s) vazia(s) removida(s).`, removidas > 0 ? 'success' : 'info');
}

function mostrarSubstituicaoMassa() {
    const panel = document.getElementById('substituicaoMassaPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function executarSubstituicao() {
    const colSel = document.getElementById('substituirColuna')?.value;
    const encontrar = document.getElementById('substituirEncontrar')?.value || '';
    const por = document.getElementById('substituirPor')?.value || '';
    if (!encontrar) { mostrarToast('Digite um valor para encontrar.', 'warning'); return; }
    const colunas = obterColunasValidas();
    const colsAlvo = colSel === '__todas__' ? colunas : [colSel];
    salvarEstadoHistorico();
    let count = 0;
    (estado.todosDados || []).forEach(linha => colsAlvo.forEach(col => {
        if (String(linha[col] || '').includes(encontrar)) {
            linha[col] = String(linha[col]).replaceAll(encontrar, por); count++;
        }
    }));
    exibirPagina();
    registrarLog(`Substituição: Trocados termos "${encontrar}" por "${por}" em ${count} locais.`);
    mostrarToast(`${count} ocorrência(s) substituída(s).`, 'success');
}

// ───────────────────────────────
// EXPORTAÇÃO CSV e JSON
// ───────────────────────────────
function exportarCSV() {
    const colunas = obterColunasValidas();
    if (!colunas.length || !(estado.todosDados || []).length) { mostrarToast('Adicione dados antes de exportar.', 'warning'); return; }
    const header = colunas.map(c => `"${c}"`).join(',');
    const rows = (estado.todosDados || []).map(linha => colunas.map(col => `"${String(linha[col] ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DataInsight_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    mostrarToast('CSV exportado com sucesso!', 'success');
}

function exportarJSON() {
    const colunas = obterColunasValidas();
    if (!colunas.length || !(estado.todosDados || []).length) { mostrarToast('Adicione dados antes de exportar.', 'warning'); return; }
    const dados = (estado.todosDados || []).map(linha => { const obj = {}; colunas.forEach(col => obj[col] = linha[col] ?? ''); return obj; });
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `DataInsight_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    mostrarToast('JSON exportado com sucesso!', 'success');
}

// ───────────────────────────────
// MULTI-TABELAS (ABAS)
// ───────────────────────────────
let _tabelas = [];
let _tabelaAtualId = null;

function abrirModalNovaTabela() {
    document.getElementById('modalNovaTabela').style.display = 'flex';
}

function adicionarColunaNovaTabela() {
    const container = document.getElementById('novasTabelaColunas');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'nova-col-row';
    div.innerHTML = `
        <input type="text" placeholder="Nome da coluna" value="Nova Coluna">
        <select>
            <option value="texto">📝 Texto</option>
            <option value="numero">🔢 Número</option>
            <option value="data">📅 Data</option>
            <option value="moeda">💰 Moeda</option>
            <option value="percentual">% Percentual</option>
        </select>
        <button class="botao botao--delet" style="padding:6px 10px;" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(div);
}

function criarNovaTabela() {
    const nome = document.getElementById('nomesNovaTabela')?.value.trim();
    if (!nome) { mostrarToast('Digite um nome para a tabela.', 'warning'); return; }
    const rows = document.getElementById('novasTabelaColunas')?.querySelectorAll('.nova-col-row') || [];
    const novasColunas = [];
    rows.forEach(row => { const n = row.querySelector('input')?.value.trim(); if (n) novasColunas.push(n); });
    if (!novasColunas.length) { mostrarToast('Adicione pelo menos uma coluna.', 'warning'); return; }
    
    // Salvar estado da tabela atual antes de criar nova
    if (_tabelaAtualId) {
        const tab = _tabelas.find(t => t.id === _tabelaAtualId);
        if (tab) { tab.dados = clonarDadosTabela(estado.todosDados); tab.colunas = [...obterColunasValidas()]; }
    } else if ((estado.todosDados || []).length > 0) {
        const id = `tab-${Date.now()}`;
        _tabelas.push({ id, nome: 'Planilha Principal', dados: clonarDadosTabela(estado.todosDados), colunas: [...obterColunasValidas()] });
        _tabelaAtualId = id;
    }
    
    const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const linhaInicial = { _id: gerarIdLinha() };
    novasColunas.forEach(c => linhaInicial[c] = '');
    _tabelas.push({ id, nome, dados: [linhaInicial], colunas: novasColunas });
    document.getElementById('modalNovaTabela').style.display = 'none';
    mostrarToast(`Tabela "${nome}" criada!`, 'success');
    ativarTabela(id);
    renderizarAbasTabelas();
    registrarLog(`Criada nova aba de tabela: "${nome}".`);
    persistirEstadoLocal(); // Salvar imediatamente após criar
}

function renderizarAbasTabelas() {
    const container = document.getElementById('tableTabsContainer');
    const bar = document.getElementById('tableTabsBar');
    if (!bar || !container) return;
    if (_tabelas.length === 0) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    bar.innerHTML = _tabelas.map(t => `
        <div class="table-tab ${t.id === _tabelaAtualId ? 'active' : ''}" onclick="ativarTabela('${t.id}')">
            <i class="fa-solid fa-table" style="font-size:11px;"></i>
            ${escapeHtml(t.nome)}
            <button class="tab-close" onclick="event.stopPropagation();fecharTabela('${t.id}')" title="Fechar tabela">✕</button>
        </div>`).join('') + `<button class="table-tab-add" onclick="abrirModalNovaTabela()" title="Nova tabela">+</button>`;
}

function ativarTabela(id) {
    if (_tabelaAtualId) {
        const anterior = _tabelas.find(t => t.id === _tabelaAtualId);
        if (anterior) { anterior.dados = clonarDadosTabela(estado.todosDados); anterior.colunas = [...obterColunasValidas()]; }
    }
    _tabelaAtualId = id;
    const tab = _tabelas.find(t => t.id === id);
    if (!tab) return;
    preencherTabela(tab.colunas, tab.dados);
    renderizarAbasTabelas();
    registrarLog(`Trocou visualização para tabela "${tab.nome}".`);
    persistirEstadoLocal(); // Salvar a troca de aba ativa
}

function fecharTabela(id) {
    if (_tabelas.length <= 1) { mostrarToast('Não é possível fechar a única tabela.', 'warning'); return; }
    if (!confirm('Fechar esta tabela? Os dados serão perdidos.')) return;
    const idx = _tabelas.findIndex(t => t.id === id);
    const tabNome = _tabelas[idx].nome;
    _tabelas.splice(idx, 1);
    if (_tabelaAtualId === id) {
        const prox = _tabelas[Math.max(0, idx - 1)];
        if (prox) ativarTabela(prox.id);
    }
    renderizarAbasTabelas();
    registrarLog(`Excluída tabela "${tabNome}".`);
    persistirEstadoLocal(); // Salvar após fechar aba
}

// ───────────────────────────────
// HOOKS PÓS-RENDERIZAÇÃO — via MutationObserver e substituição dinâmica
// ───────────────────────────────
(function instalarHooks() {
    function _runAfterRender() {
        atualizarEstatisticas();
        _atualizarLinhaTotais();
        _aplicarFC();
        _aplicarVisibilidadeColunas();
        _executarValidacoesVisuais();
        atualizarMetasUI();
    }

    const observer = new MutationObserver(() => {
        setTimeout(_runAfterRender, 30);
    });

    function iniciarObservador() {
        const tbody = document.getElementById('dados-tbody');
        if (tbody) {
            observer.observe(tbody, { childList: true, subtree: true });
        } else {
            setTimeout(iniciarObservador, 500);
        }
    }

    function instalarFormulaBarHook() {
        document.addEventListener('focusin', function(e) {
            if (e.target && e.target.classList.contains('entrada-linha')) {
                const fb = document.getElementById('formulaBarInput');
                if (fb) { fb.value = e.target.value; fb.readOnly = false; }
            }
        });
        document.addEventListener('input', function(e) {
            if (e.target && e.target.classList.contains('entrada-linha')) {
                const fb = document.getElementById('formulaBarInput');
                if (fb && document.activeElement === e.target) fb.value = e.target.value;
            }
        });
        // Escutar auditoria em inputs de dados
        document.addEventListener('change', function(e) {
            if (e.target && e.target.classList.contains('entrada-linha')) {
                const tr = e.target.closest('tr');
                if (tr) {
                    const rowNum = tr.querySelector('.row-number')?.textContent || '?';
                    const td = e.target.closest('td');
                    const cells = Array.from(tr.querySelectorAll('td'));
                    const colIdx = cells.indexOf(td);
                    const colunas = obterColunasValidas();
                    const colName = colunas[colIdx - 1] || '?';
                    registrarLog(`Célula alterada na linha ${rowNum}, coluna ${colName} para "${e.target.value}".`);
                }
            }
        });
    }

    if (typeof obterDadosVisiveis === 'function') {
        const _origObterDadosVisiveis = obterDadosVisiveis;
        obterDadosVisiveis = function() {
            let dados = _origObterDadosVisiveis();
            const filtros = estado.filtrosAvancados || [];
            if (!filtros.length) return dados;
            return dados.filter(linha => filtros.every(f => {
                const val = String(linha[f.col] || '').toLowerCase().trim();
                const fval = String(f.val || '').toLowerCase().trim();
                const num = parseFloat(val.replace(',', '.'));
                const fnum = parseFloat(fval.replace(',', '.'));
                switch(f.op) {
                    case 'contem': return val.includes(fval);
                    case 'nao_contem': return !val.includes(fval);
                    case 'igual': return val === fval;
                    case 'diferente': return val !== fval;
                    case 'maior': return !isNaN(num) && !isNaN(fnum) && num > fnum;
                    case 'menor': return !isNaN(num) && !isNaN(fnum) && num < fnum;
                    case 'vazio': return val === '';
                    case 'nao_vazio': return val !== '';
                    default: return true;
                }
            }));
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { iniciarObservador(); instalarFormulaBarHook(); });
    } else {
        iniciarObservador();
        instalarFormulaBarHook();
    }
})();
