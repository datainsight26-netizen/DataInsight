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
        // Salvar também o ID ativo em chave dedicada para recuperação rápida
        if (_tabelaAtualId) {
            localStorage.setItem('DataInsight_TabelaAtiva', _tabelaAtualId);
        }
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
        colunas: Array.isArray(tabela.colunas) ? [...tabela.colunas] : [],
        tipo_dominio: tabela.tipo_dominio || null,
        dominio_label: tabela.dominio_label || null,
        dominio_icone: tabela.dominio_icone || null,
        dominio_cor: tabela.dominio_cor || null,
        tipo_fluxo: tabela.tipo_fluxo || null
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
// ───────────────────────────────
// FERRAMENTAS DE LIMPEZA DE DADOS
// ───────────────────────────────
function _parsearNumeroLimpo(val) {
    if (val === null || val === undefined) return NaN;
    if (typeof val === 'number') return isNaN(val) ? NaN : val;
    let s = String(val).trim();
    if (!s || ['nan', 'none', 'null', 'n/a', 'na', '-', '--', 'nd', 'indefinido'].includes(s.toLowerCase())) return NaN;
    s = s.replace(/^[R$\s€£\s]+/g, '').replace(/[%]/g, '').trim();
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1).trim();
    if (s.includes('.') && s.includes(',')) {
        if (s.lastIndexOf('.') < s.lastIndexOf(',')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes(',')) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            s = s.replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length === 2 && parts[1].length === 3 && !s.startsWith('0.') && !s.startsWith('-0.')) {
            s = s.replace(/\./g, '');
        }
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
}

function _ehColunaNumerica(col, dados) {
    const vals = (dados || []).map(l => l[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (vals.length === 0) return false;
    const numCount = vals.filter(v => !isNaN(_parsearNumeroLimpo(v))).length;
    return (numCount / vals.length) >= 0.5;
}

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
    if (antes === 0) {
        mostrarToast('Nenhum dado disponível para remover duplicatas.', 'warning');
        return;
    }
    const visto = new Set();
    salvarEstadoHistorico();
    const idsMantidos = new Set();
    estado.todosDados = (estado.todosDados || []).filter(linha => {
        const key = colunas.map(c => String(linha[c] ?? '').trim().toLowerCase()).join('|');
        if (visto.has(key)) return false;
        visto.add(key);
        idsMantidos.add(linha._id);
        return true;
    });

    // Limpar anomalias órfãs
    if (window.estado && window.estado.anomalias) {
        window.estado.anomalias = window.estado.anomalias.filter(a => idsMantidos.has(a._id));
        window.estado.anomaliasIds = new Set(window.estado.anomalias.map(a => a._id));
    }
    if (estado.anomalias) {
        estado.anomalias = estado.anomalias.filter(a => idsMantidos.has(a._id));
        estado.anomaliasIds = new Set(estado.anomalias.map(a => a._id));
    }

    const removidas = antes - estado.todosDados.length;
    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarPaginacao();
    renderizarAbasTabelas();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Limpeza: Removidas ${removidas} linhas duplicadas.`);
    mostrarToast(removidas > 0 ? `✓ ${removidas} linha(s) duplicada(s) removida(s) com sucesso!` : 'Nenhuma linha duplicada encontrada.', removidas > 0 ? 'success' : 'info');
}

function preencherVaziosComMedia() {
    const colunas = obterColunasValidas();
    const dados = estado.todosDados || [];
    if (!colunas.length || !dados.length) {
        mostrarToast('Nenhum dado disponível para preenchimento.', 'warning');
        return;
    }
    salvarEstadoHistorico();
    let preenchidos = 0;

    colunas.forEach(col => {
        const ehNum = _ehColunaNumerica(col, dados);
        if (ehNum) {
            const vals = dados.map(l => _parsearNumeroLimpo(l[col])).filter(n => !isNaN(n));
            if (!vals.length) return;
            const media = vals.reduce((a, b) => a + b, 0) / vals.length;
            const mediaFormatada = Number.isInteger(media) ? media : parseFloat(media.toFixed(2));
            dados.forEach(linha => {
                const val = linha[col];
                const vazio = val === null || val === undefined || String(val).trim() === '' || ['nan', 'none', 'null', 'n/a', '-', '--'].includes(String(val).trim().toLowerCase());
                if (vazio) {
                    linha[col] = mediaFormatada;
                    preenchidos++;
                }
            });
        } else {
            // Preenchimento de texto com a moda
            const freq = {};
            dados.forEach(l => {
                const s = String(l[col] ?? '').trim();
                if (s && !['nan', 'none', 'null', 'n/a', '-', '--'].includes(s.toLowerCase())) {
                    freq[s] = (freq[s] || 0) + 1;
                }
            });
            let moda = null, maxCount = 0;
            Object.entries(freq).forEach(([val, count]) => {
                if (count > maxCount) { maxCount = count; moda = val; }
            });
            if (moda && maxCount >= 2) {
                dados.forEach(linha => {
                    const val = linha[col];
                    const vazio = val === null || val === undefined || String(val).trim() === '' || ['nan', 'none', 'null', 'n/a', '-', '--'].includes(String(val).trim().toLowerCase());
                    if (vazio) {
                        linha[col] = moda;
                        preenchidos++;
                    }
                });
            }
        }
    });

    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Limpeza: Preenchidos ${preenchidos} campos em branco de forma inteligente.`);
    mostrarToast(preenchidos > 0 ? `✓ ${preenchidos} campo(s) vazio(s) preenchido(s) com sucesso!` : 'Nenhum campo vazio para preencher.', preenchidos > 0 ? 'success' : 'info');
}

function _normalizarTextos(fn, tipo) {
    const colunas = obterColunasValidas();
    const dados = estado.todosDados || [];
    if (!colunas.length || !dados.length) {
        mostrarToast('Nenhum dado disponível para normalização.', 'warning');
        return;
    }
    salvarEstadoHistorico();
    let alterados = 0;
    dados.forEach(linha => colunas.forEach(col => {
        const val = linha[col];
        if (typeof val === 'string' && val.trim() !== '') {
            const novo = fn(val);
            if (novo !== val) {
                linha[col] = novo;
                alterados++;
            }
        }
    }));
    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Limpeza: Normalizados textos em toda a planilha para ${tipo} (${alterados} células alteradas).`);
    mostrarToast(`✓ Normalização para ${tipo} aplicada em ${alterados} célula(s)!`, 'success');
}

function normalizarTextoMinusculas() { _normalizarTextos(s => s.toLowerCase(), 'minúsculas'); }
function normalizarTextoMaiusculas() { _normalizarTextos(s => s.toUpperCase(), 'maiúsculas'); }
function normalizarTextoCapitalizado() {
    _normalizarTextos(s => {
        return s.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, c => c.toUpperCase());
    }, 'capitalizado');
}

function trimEspacos() {
    const colunas = obterColunasValidas();
    const dados = estado.todosDados || [];
    if (!colunas.length || !dados.length) {
        mostrarToast('Nenhum dado disponível para aplicar trim.', 'warning');
        return;
    }
    salvarEstadoHistorico();
    let trimados = 0;
    dados.forEach(linha => colunas.forEach(col => {
        if (typeof linha[col] === 'string') {
            const novo = linha[col].replace(/\s+/g, ' ').trim();
            if (novo !== linha[col]) {
                linha[col] = novo;
                trimados++;
            }
        }
    }));
    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Limpeza: Efetuado trim de espaços extras em ${trimados} células.`);
    mostrarToast(trimados > 0 ? `✓ Trim aplicado em ${trimados} célula(s) com espaços extras!` : 'Nenhum espaço extra encontrado.', trimados > 0 ? 'success' : 'info');
}

function removerLinhasVazias() {
    const colunas = obterColunasValidas();
    const antes = (estado.todosDados || []).length;
    if (antes === 0) {
        mostrarToast('Nenhum dado disponível.', 'warning');
        return;
    }
    salvarEstadoHistorico();
    const idsMantidos = new Set();
    estado.todosDados = (estado.todosDados || []).filter(linha => {
        const temConteudo = colunas.some(col => {
            const v = linha[col];
            return v !== null && v !== undefined && String(v).trim() !== '';
        });
        if (temConteudo) idsMantidos.add(linha._id);
        return temConteudo;
    });

    if (window.estado && window.estado.anomalias) {
        window.estado.anomalias = window.estado.anomalias.filter(a => idsMantidos.has(a._id));
        window.estado.anomaliasIds = new Set(window.estado.anomalias.map(a => a._id));
    }

    const removidas = antes - estado.todosDados.length;
    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarPaginacao();
    renderizarAbasTabelas();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Limpeza: Removidas ${removidas} linhas totalmente vazias.`);
    mostrarToast(removidas > 0 ? `✓ ${removidas} linha(s) totalmente vazia(s) removida(s)!` : 'Nenhuma linha vazia encontrada.', removidas > 0 ? 'success' : 'info');
}

function mostrarSubstituicaoMassa() {
    const panel = document.getElementById('substituicaoMassaPanel');
    if (panel) {
        const aberto = panel.style.display !== 'none';
        panel.style.display = aberto ? 'none' : 'block';
        if (!aberto) {
            const sel = document.getElementById('substituirColuna');
            if (sel) {
                const colunas = obterColunasValidas();
                sel.innerHTML = '<option value="__todas__">Todas as colunas</option>'
                    + colunas.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
            }
        }
    }
}

function executarSubstituicao() {
    const colSel = document.getElementById('substituirColuna')?.value;
    const encontrar = document.getElementById('substituirEncontrar')?.value;
    const por = document.getElementById('substituirPor')?.value ?? '';
    if (encontrar === undefined || encontrar === null || encontrar === '') {
        mostrarToast('Digite o termo que deseja encontrar para substituir.', 'warning');
        return;
    }
    const colunas = obterColunasValidas();
    const colsAlvo = colSel === '__todas__' ? colunas : [colSel];
    salvarEstadoHistorico();
    let count = 0;
    (estado.todosDados || []).forEach(linha => colsAlvo.forEach(col => {
        if (linha[col] !== null && linha[col] !== undefined) {
            const strVal = String(linha[col]);
            if (strVal.includes(encontrar)) {
                linha[col] = strVal.replaceAll(encontrar, por);
                count++;
            }
        }
    }));
    sincronizarTabelaAtiva();
    exibirPagina();
    atualizarEstatisticas();
    persistirTabelaAtualDebounced();
    registrarLog(`Substituição: Trocados termos "${encontrar}" por "${por}" em ${count} célula(s).`);
    mostrarToast(count > 0 ? `✓ Substituição concluída! ${count} ocorrência(s) alterada(s).` : 'Nenhuma ocorrência encontrada com o termo buscado.', count > 0 ? 'success' : 'info');
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

/* ================================================================
   CARREGAR TODAS AS TABELAS DO USUÁRIO
   ================================================================ */
async function carregarTodasTabelas() {
    try {
        const resp = await fetch('/api/tabelas');
        const json = await resp.json();
        if (resp.ok && json.tabelas && Array.isArray(json.tabelas) && json.tabelas.length > 0) {
            _tabelas = json.tabelas.map(clonarTabela);

            // Prioridade: tabela ativa retornada pelo backend (persistência real no banco)
            let tabelaAtivaId = json.tabela_ativa_id || null;

            // Se backend não devolveu, checar chave dedicada no localStorage
            if (!tabelaAtivaId) {
                const tabelaAtivaSalva = localStorage.getItem('DataInsight_TabelaAtiva');
                if (tabelaAtivaSalva && _tabelas.some(t => t.id === tabelaAtivaSalva)) {
                    tabelaAtivaId = tabelaAtivaSalva;
                }
            }

            // Fallback: primeiro item
            if (!tabelaAtivaId || !_tabelas.some(t => t.id === tabelaAtivaId)) {
                tabelaAtivaId = _tabelas[0].id;
            }

            // Salvar preferência no localStorage para uso offline
            localStorage.setItem('DataInsight_TabelaAtiva', tabelaAtivaId);

            ativarTabela(tabelaAtivaId, false);
            renderizarAbasTabelas();
            return true;
        }
    } catch (e) {
        console.warn('Não foi possível carregar tabelas do backend:', e);
    }

    // Fallback para LocalStorage
    const carregouLocal = carregarEstadoLocal();
    if (carregouLocal && _tabelas.length > 0) {
        // Restaurar a tabela ativa pelo ID dedicado se disponível
        const tabelaAtivaSalva = localStorage.getItem('DataInsight_TabelaAtiva');
        const idParaAtivar = (tabelaAtivaSalva && _tabelas.some(t => t.id === tabelaAtivaSalva))
            ? tabelaAtivaSalva
            : (_tabelaAtualId || _tabelas[0].id);
        ativarTabela(idParaAtivar, false);
        renderizarAbasTabelas();
        return true;
    }

    // Fallback para tabela padrão
    if (typeof inicializarTabelaPadrao === 'function') {
        inicializarTabelaPadrao();
    }
    const padraoCols = ['Faturamento', 'Despesas', 'Lucro', 'Período'];
    const tabPadrao = {
        id: `tab-${Date.now()}`,
        nome: 'Planilha Principal',
        colunas: [...padraoCols],
        dados: clonarDadosTabela(estado.todosDados)
    };
    _tabelas = [tabPadrao];
    _tabelaAtualId = tabPadrao.id;
    renderizarAbasTabelas();
    atualizarIndicadorTabelaAtiva();
    return false;
}
window.carregarTodasTabelas = carregarTodasTabelas;

/* ================================================================
   ATUALIZAR INDICADOR VISUAL DA TABELA ATIVA NO TOPO
   ================================================================ */
function atualizarIndicadorTabelaAtiva() {
    const tab = _tabelas.find(t => t.id === _tabelaAtualId) || _tabelas[0];
    if (!tab) return;
    const nameEl = document.getElementById('activeTableName');
    const rowsEl = document.getElementById('activeTableRowsCount');
    const totalLinhas = (estado.todosDados || []).length;
    if (nameEl) nameEl.textContent = tab.nome;
    if (rowsEl) rowsEl.textContent = `${totalLinhas} ${totalLinhas === 1 ? 'linha' : 'linhas'}${tab.dominio_label ? ' • ' + tab.dominio_label : ''}`;
}
window.atualizarIndicadorTabelaAtiva = atualizarIndicadorTabelaAtiva;

/* ================================================================
   RENDERIZAR ABAS DE TABELAS COM DOMÍNIO INTELIGENTE
   ================================================================ */
function renderizarAbasTabelas() {
    const container = document.getElementById('tableTabsContainer');
    const bar = document.getElementById('tableTabsBar');
    if (!bar || !container) return;
    if (_tabelas.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    bar.innerHTML = _tabelas.map(t => {
        const isActive = t.id === _tabelaAtualId;
        const count = Array.isArray(t.dados) ? t.dados.length : 0;
        
        let domLabel = t.dominio_label || 'Geral';
        let domCor = t.dominio_cor || '#0ea5e9';

        return `
        <div class="table-tab-pill ${isActive ? 'active' : ''}" onclick="ativarTabela('${t.id}')" title="Clique para ativar '${escapeHtml(t.nome)}' • Categoria: ${domLabel} (Duplo clique para renomear)" ondblclick="abrirModalRenomearTabela('${t.id}')">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${domCor}; margin-right:2px;" title="Categoria: ${domLabel}"></span>
            <span class="tab-title-text">${escapeHtml(t.nome)}</span>
            <span class="tab-badge-rows" title="${domLabel}">${count}</span>
            <button type="button" class="tab-btn-action" onclick="event.stopPropagation(); abrirModalDominioTabela('${t.id}')" title="Alterar Domínio/Categoria da Planilha (Vendas, Aluguel, Custos, etc.)">
                <i class="fa-solid fa-tags" style="font-size:10px; color:${domCor};"></i>
            </button>
            <button type="button" class="tab-btn-action" onclick="event.stopPropagation(); abrirModalRenomearTabela('${t.id}')" title="Renomear esta tabela">
                <i class="fa-solid fa-pen"></i>
            </button>
            ${_tabelas.length > 1 ? `
            <button type="button" class="tab-btn-action" onclick="event.stopPropagation(); fecharTabela('${t.id}')" title="Fechar / Excluir esta tabela">
                ✕
            </button>` : ''}
        </div>`;
    }).join('');
    atualizarIndicadorTabelaAtiva();
}
window.renderizarAbasTabelas = renderizarAbasTabelas;

/* ================================================================
   MODAL DE DOMÍNIO/CATEGORIA DE PLANILHA
   ================================================================ */
function abrirModalDominioTabela(tabelaId) {
    const tab = _tabelas.find(t => t.id === tabelaId);
    if (!tab) return;

    let domAtual = tab.tipo_dominio || 'MISTA_GERAL';

    const modalId = 'modalConfigDominioPlanilha';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-backdrop';
        modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999; backdrop-filter:blur(3px);';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-card cartao" style="width:460px; max-width:92vw; background:var(--cartao); padding:24px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.3); border:1px solid var(--borda);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3 class="h3" style="font-size:17px; margin:0; display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-tags" style="color:var(--primaria);"></i> Categoria da Planilha
                </h3>
                <button type="button" onclick="document.getElementById('${modalId}').style.display='none'" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--texto-suave);">✕</button>
            </div>
            <p class="p" style="font-size:13px; margin-bottom:16px;">
                Defina como o sistema e a IA devem interpretar os dados da planilha <strong>${escapeHtml(tab.nome)}</strong> no fluxo global:
            </p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
                <label style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid var(--borda); cursor:pointer; background:var(--fundo-corpo);">
                    <input type="radio" name="radioDominio" value="RECEITAS_VENDAS" ${domAtual === 'RECEITAS_VENDAS' ? 'checked' : ''}>
                    <div>
                        <strong style="color:#10b981; font-size:13.5px;">🛒 Vendas & Receitas</strong>
                        <div style="font-size:11.5px; color:var(--texto-suave);">Faturamento de produtos, serviços e pedidos (Entrada no caixa).</div>
                    </div>
                </label>
                <label style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid var(--borda); cursor:pointer; background:var(--fundo-corpo);">
                    <input type="radio" name="radioDominio" value="DESPESAS_ALUGUEL" ${domAtual === 'DESPESAS_ALUGUEL' ? 'checked' : ''}>
                    <div>
                        <strong style="color:#f59e0b; font-size:13.5px;">🏢 Aluguéis & Imóveis</strong>
                        <div style="font-size:11.5px; color:var(--texto-suave);">Locação, condomínio, IPTU e custos imobiliários (Saída fixa).</div>
                    </div>
                </label>
                <label style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid var(--borda); cursor:pointer; background:var(--fundo-corpo);">
                    <input type="radio" name="radioDominio" value="DESPESAS_GERAIS" ${domAtual === 'DESPESAS_GERAIS' ? 'checked' : ''}>
                    <div>
                        <strong style="color:#ef4444; font-size:13.5px;">🧾 Despesas & Custos Operacionais</strong>
                        <div style="font-size:11.5px; color:var(--texto-suave);">Salários, fornecedores, contas de consumo e impostos (Saída).</div>
                    </div>
                </label>
                <label style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid var(--borda); cursor:pointer; background:var(--fundo-corpo);">
                    <input type="radio" name="radioDominio" value="ESTOQUE_PRODUTOS" ${domAtual === 'ESTOQUE_PRODUTOS' ? 'checked' : ''}>
                    <div>
                        <strong style="color:#8b5cf6; font-size:13.5px;">📦 Estoque & Catálogo de Produtos</strong>
                        <div style="font-size:11.5px; color:var(--texto-suave);">Cadastro de mercadorias, SKUs e custos unitários.</div>
                    </div>
                </label>
                <label style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:8px; border:1px solid var(--borda); cursor:pointer; background:var(--fundo-corpo);">
                    <input type="radio" name="radioDominio" value="MISTA_GERAL" ${domAtual === 'MISTA_GERAL' ? 'checked' : ''}>
                    <div>
                        <strong style="color:#0ea5e9; font-size:13.5px;">🌐 Geral / Fluxo Completo</strong>
                        <div style="font-size:11.5px; color:var(--texto-suave);">Planilha ampla com colunas diretas de faturamento e despesas.</div>
                    </div>
                </label>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button type="button" class="botao botao--outline" onclick="document.getElementById('${modalId}').style.display='none'">Cancelar</button>
                <button type="button" class="botao botao--primario" onclick="salvarDominioTabelaSelecionada('${tab.id}')">Salvar Categoria</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}
window.abrirModalDominioTabela = abrirModalDominioTabela;

async function salvarDominioTabelaSelecionada(tabelaId) {
    const sel = document.querySelector('input[name="radioDominio"]:checked');
    if (!sel) return;
    const novoDominio = sel.value;

    const tab = _tabelas.find(t => t.id === tabelaId);
    if (tab) {
        tab.tipo_dominio = novoDominio;
    }

    try {
        const resp = await fetch(`/api/tabelas/${tabelaId}/dominio`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tipo_dominio: novoDominio,
                nome: tab ? tab.nome : ''
            })
        });
        const res = await resp.json();
        if (resp.ok && tab) {
            if (res.id && (!tab.id || String(tab.id).startsWith('tab-'))) {
                const idAntigo = tab.id;
                tab.id = res.id;
                if (_tabelaAtualId === idAntigo) {
                    _tabelaAtualId = res.id;
                }
            }
            tab.tipo_dominio = res.tipo_dominio || novoDominio;
            tab.dominio_label = res.dominio_label;
            tab.dominio_cor = res.dominio_cor;
            tab.dominio_icone = res.dominio_icone;
            tab.tipo_fluxo = res.tipo_fluxo;
            if (typeof mostrarToast === 'function') {
                mostrarToast(`✓ Categoria da planilha alterada para '${res.dominio_label}'`, 'success');
            }
        }
    } catch (e) {
        console.warn('Erro ao salvar categoria no backend:', e);
    }

    document.getElementById('modalConfigDominioPlanilha').style.display = 'none';
    persistirEstadoLocal();
    renderizarAbasTabelas();
}
window.salvarDominioTabelaSelecionada = salvarDominioTabelaSelecionada;

/* ================================================================
   ATIVAR TABELA (MUDAR TABELA SELECIONADA)
   ================================================================ */
function ativarTabela(id, salvarAtual = true) {
    if (salvarAtual && _tabelaAtualId) {
        const anterior = _tabelas.find(t => t.id === _tabelaAtualId);
        if (anterior) {
            anterior.dados = clonarDadosTabela(estado.todosDados);
            anterior.colunas = [...obterColunasValidas()];
            
            // Persistir alterações da tabela anterior no backend para salvar tudo no sistema
            const tabelaAntigaId = (anterior.id && !String(anterior.id).startsWith('tab-local-') && !String(anterior.id).startsWith('tab-')) ? anterior.id : null;
            if (anterior.colunas && anterior.colunas.length > 0 && anterior.dados && anterior.dados.length > 0) {
                fetch('/api/tabelas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: tabelaAntigaId,
                        nome: anterior.nome || 'Planilha',
                        colunas: anterior.colunas,
                        dados: anterior.dados,
                        tipo_dominio: anterior.tipo_dominio || null
                    })
                }).then(r => r.json()).then(data => {
                    if (data && data.id) anterior.id = data.id;
                    if (data && data.tipo_dominio) anterior.tipo_dominio = data.tipo_dominio;
                }).catch(e => console.warn('Aviso ao salvar tabela anterior:', e));
            }
        }
    }

    const tab = _tabelas.find(t => t.id === id) || _tabelas[0];
    if (!tab) return;

    _tabelaAtualId = tab.id;
    preencherTabela(tab.colunas, tab.dados);
    renderizarAbasTabelas();
    atualizarIndicadorTabelaAtiva();
    registrarLog(`Trocou visualização para tabela "${tab.nome}".`);

    // Persistir imediatamente a tabela ativa em chave dedicada (rápida recuperação offline)
    try { localStorage.setItem('DataInsight_TabelaAtiva', tab.id); } catch(_) {}

    persistirEstadoLocal();

    // Notificar o backend para marcar a tabela ativada como a tabela ativa do usuário no MongoDB
    if (tab.id && !String(tab.id).startsWith('tab-local-') && !String(tab.id).startsWith('tab-')) {
        fetch(`/api/tabelas/${tab.id}/ativar`, { method: 'POST' }).catch(e => console.warn('Aviso ao ativar tabela no backend:', e));
    } else if (tab.colunas && tab.colunas.length > 0 && tab.dados && tab.dados.length > 0) {
        if (typeof salvarDados === 'function') {
            salvarDados(true);
        }
    }

    // Sincronizar painel financeiro com a nova tabela ativa
    if (typeof window.finSincronizarComTabela === 'function') {
        window.finSincronizarComTabela(tab);
    } else if (typeof FinState !== 'undefined') {
        FinState.colunas = [...tab.colunas];
        FinState.dadosAmostra = (tab.dados || []).slice(0, 20);
        if (typeof renderizarCategorias === 'function') renderizarCategorias();
        if (typeof atualizarStatusCompleto === 'function') atualizarStatusCompleto();
    }
}
window.ativarTabela = ativarTabela;

/* ================================================================
   MODAL CRIAR NOVA TABELA
   ================================================================ */
function abrirModalNovaTabela() {
    const modal = document.getElementById('modalNovaTabela');
    if (!modal) return;
    const nomeInput = document.getElementById('nomesNovaTabela');
    if (nomeInput) nomeInput.value = `Tabela ${_tabelas.length + 1}`;
    const container = document.getElementById('novasTabelaColunas');
    if (container) {
        container.innerHTML = '';
        ['Faturamento', 'Despesas', 'Lucro', 'Período'].forEach(col => {
            const div = document.createElement('div');
            div.className = 'nova-col-row';
            div.innerHTML = `
                <input type="text" class="entrada" style="flex:2; font-size:12.5px;" placeholder="Nome da coluna" value="${col}">
                <select class="entrada" style="flex:1.2; font-size:12px;">
                    <option value="moeda" ${['Faturamento', 'Despesas', 'Lucro'].includes(col) ? 'selected' : ''}>💰 Moeda</option>
                    <option value="data" ${col === 'Período' ? 'selected' : ''}>📅 Data</option>
                    <option value="numero">🔢 Número</option>
                    <option value="texto">📝 Texto</option>
                    <option value="percentual">% Percentual</option>
                </select>
                <button type="button" class="botao botao--delet" style="padding:6px 10px; font-size:12px;" onclick="this.parentElement.remove()">✕</button>`;
            container.appendChild(div);
        });
    }
    modal.style.display = 'flex';
}
window.abrirModalNovaTabela = abrirModalNovaTabela;

function adicionarColunaNovaTabela() {
    const container = document.getElementById('novasTabelaColunas');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'nova-col-row';
    div.innerHTML = `
        <input type="text" class="entrada" style="flex:2; font-size:12.5px;" placeholder="Nome da coluna" value="Nova Coluna">
        <select class="entrada" style="flex:1.2; font-size:12px;">
            <option value="moeda">💰 Moeda</option>
            <option value="texto">📝 Texto</option>
            <option value="numero">🔢 Número</option>
            <option value="data">📅 Data</option>
            <option value="percentual">% Percentual</option>
        </select>
        <button type="button" class="botao botao--delet" style="padding:6px 10px; font-size:12px;" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(div);
}
window.adicionarColunaNovaTabela = adicionarColunaNovaTabela;

async function criarNovaTabela() {
    const nome = document.getElementById('nomesNovaTabela')?.value.trim();
    if (!nome) { mostrarToast('Digite um nome para a tabela.', 'warning'); return; }
    const rows = document.getElementById('novasTabelaColunas')?.querySelectorAll('.nova-col-row') || [];
    const novasColunas = [];
    rows.forEach(row => {
        const n = row.querySelector('input')?.value.trim();
        if (n && !novasColunas.includes(n)) novasColunas.push(n);
    });
    if (!novasColunas.length) { mostrarToast('Adicione pelo menos uma coluna.', 'warning'); return; }

    // Salvar estado da tabela atual antes
    sincronizarTabelaAtiva();

    const linhaInicial = { _id: (typeof gerarIdLinha === 'function' ? gerarIdLinha() : `row-${Date.now()}`) };
    novasColunas.forEach(c => linhaInicial[c] = '');
    const novosDados = [linhaInicial];

    let novoId = `tab-${Date.now()}`;

    // Salvar no backend MongoDB
    try {
        const resp = await fetch('/api/tabelas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nome: nome,
                colunas: novasColunas,
                dados: novosDados
            })
        });
        const json = await resp.json();
        if (resp.ok && json.id) {
            novoId = json.id;
        }
    } catch (e) {
        console.warn('Aviso ao salvar nova tabela no backend:', e);
    }

    _tabelas.push({
        id: novoId,
        nome: nome,
        dados: novosDados,
        colunas: novasColunas
    });

    const modal = document.getElementById('modalNovaTabela');
    if (modal) modal.style.display = 'none';

    ativarTabela(novoId, false);
    renderizarAbasTabelas();
    registrarLog(`Criada nova tabela: "${nome}".`);
    mostrarToast(`✓ Tabela "${nome}" criada e ativada com sucesso!`, 'success');
}
window.criarNovaTabela = criarNovaTabela;

/* ================================================================
   RENOMEAR TABELA
   ================================================================ */
function abrirModalRenomearTabela(id) {
    const targetId = id || _tabelaAtualId;
    const tab = _tabelas.find(t => t.id === targetId);
    if (!tab) return;
    const modal = document.getElementById('modalRenomearTabela');
    const idInput = document.getElementById('inputRenomearTabelaId');
    const nameInput = document.getElementById('inputRenomearTabelaNome');
    if (!modal || !nameInput) return;
    if (idInput) idInput.value = tab.id;
    nameInput.value = tab.nome;
    modal.style.display = 'flex';
    setTimeout(() => {
        nameInput.focus();
        nameInput.select();
    }, 50);
}
window.abrirModalRenomearTabela = abrirModalRenomearTabela;

async function salvarRenomearTabela() {
    const idInput = document.getElementById('inputRenomearTabelaId');
    const nameInput = document.getElementById('inputRenomearTabelaNome');
    const targetId = idInput?.value || _tabelaAtualId;
    const novoNome = nameInput?.value.trim();
    if (!novoNome) {
        mostrarToast('Digite um nome válido para a tabela.', 'warning');
        return;
    }
    const tab = _tabelas.find(t => t.id === targetId);
    if (!tab) return;
    const nomeAntigo = tab.nome;
    tab.nome = novoNome;

    // Atualizar no backend
    try {
        await fetch(`/api/tabelas/${targetId}/renomear`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome: novoNome })
        });
    } catch (e) {
        console.warn('Aviso ao renomear no backend:', e);
    }

    const modal = document.getElementById('modalRenomearTabela');
    if (modal) modal.style.display = 'none';

    renderizarAbasTabelas();
    atualizarIndicadorTabelaAtiva();
    persistirEstadoLocal();
    registrarLog(`Tabela "${nomeAntigo}" renomeada para "${novoNome}".`);
    mostrarToast(`✓ Tabela renomeada para "${novoNome}"!`, 'success');
}
window.salvarRenomearTabela = salvarRenomearTabela;

/* ================================================================
   DUPLICAR TABELA
   ================================================================ */
async function duplicarTabelaAtual() {
    return duplicarTabela(_tabelaAtualId);
}
window.duplicarTabelaAtual = duplicarTabelaAtual;

async function duplicarTabela(id) {
    const targetId = id || _tabelaAtualId;
    const tab = _tabelas.find(t => t.id === targetId);
    if (!tab) return;

    // Sincronizar atual
    sincronizarTabelaAtiva();

    let novoId = `tab-${Date.now()}`;
    const novoNome = `${tab.nome} (Cópia)`;
    const novosDados = clonarDadosTabela(tab.dados);
    const novasColunas = [...tab.colunas];

    try {
        const resp = await fetch(`/api/tabelas/${targetId}/duplicar`, { method: 'POST' });
        const json = await resp.json();
        if (resp.ok && json.id) {
            novoId = json.id;
        }
    } catch (e) {
        console.warn('Aviso ao duplicar no backend:', e);
    }

    _tabelas.push({
        id: novoId,
        nome: novoNome,
        colunas: novasColunas,
        dados: novosDados
    });

    ativarTabela(novoId, false);
    renderizarAbasTabelas();
    registrarLog(`Tabela "${tab.nome}" duplicada como "${novoNome}".`);
    mostrarToast(`✓ Tabela duplicada como "${novoNome}"!`, 'success');
}
window.duplicarTabela = duplicarTabela;

/* ================================================================
   EXCLUIR / FECHAR TABELA
   ================================================================ */
async function fecharTabela(id) {
    if (_tabelas.length <= 1) {
        mostrarToast('Não é possível fechar a única tabela ativa.', 'warning');
        return;
    }
    const idx = _tabelas.findIndex(t => t.id === id);
    if (idx === -1) return;
    const tabNome = _tabelas[idx].nome;

    if (!confirm(`Deseja realmente excluir a tabela "${tabNome}"? Todos os dados desta planilha serão removidos.`)) {
        return;
    }

    try {
        await fetch(`/api/tabelas/${id}`, { method: 'DELETE' });
    } catch (e) {
        console.warn('Aviso ao excluir no backend:', e);
    }

    _tabelas.splice(idx, 1);
    if (_tabelaAtualId === id) {
        const prox = _tabelas[Math.max(0, idx - 1)];
        if (prox) ativarTabela(prox.id, false);
    } else {
        renderizarAbasTabelas();
        atualizarIndicadorTabelaAtiva();
        persistirEstadoLocal();
    }

    registrarLog(`Tabela "${tabNome}" excluída.`);
    mostrarToast(`✓ Tabela "${tabNome}" excluída com sucesso.`, 'info');
}
window.fecharTabela = fecharTabela;

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

    let _observerRunning = false;
    const observer = new MutationObserver(() => {
        if (_observerRunning) return;
        _observerRunning = true;
        setTimeout(() => {
            _runAfterRender();
            _observerRunning = false;
        }, 30);
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

// Exposição Global de Funções de Limpeza e Tratamento
window.abrirModalLimpeza = abrirModalLimpeza;
window.removerDuplicatas = removerDuplicatas;
window.preencherVaziosComMedia = preencherVaziosComMedia;
window.normalizarTextoMinusculas = normalizarTextoMinusculas;
window.normalizarTextoMaiusculas = normalizarTextoMaiusculas;
window.normalizarTextoCapitalizado = normalizarTextoCapitalizado;
window.trimEspacos = trimEspacos;
window.removerLinhasVazias = removerLinhasVazias;
window.mostrarSubstituicaoMassa = mostrarSubstituicaoMassa;
window.executarSubstituicao = executarSubstituicao;

