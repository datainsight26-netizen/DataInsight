// ===============================
// CONFIGURAÇÕES GLOBAIS
// ===============================
const CONFIG = {
    LINHAS_POR_PAGINA: 10,
    EXTENSOES_VALIDAS: {
        excel: ['.xlsx', '.xls'],
        csv: ['.csv'],
        json: ['.json'],
        txt: ['.txt']
    }
};

// ===============================
// ESTADO DA APLICAÇÃO
// ===============================
let estado = {
    paginaAtual: 1,
    todosDados: [],
    dadosFiltrados: [],
    filtroAtual: '',
    colunasAtuais: [],
    tipoArquivo: null,
    elementos: {},
    // Ordenação
    sortColuna: null,
    sortDir: 'asc',
    // Seleção de célula/linha
    celulaSelecionada: { row: -1, col: -1 },
    linhasSelecionadas: new Set(),
    // Undo/Redo
    historico: [],        // stack de estados anteriores
    historicoFuturo: [],  // stack redo
    maxHistorico: 50,
    // Clipboard
    clipboard: null,
    // Upload multi-abas pendente
    uploadPendente: { arquivo: null, abas: [], nomePendente: '' }
    ,
    // Anomalias detectadas
    anomalias: [],
    anomaliasIds: new Set(),
    mostrarApenasAnomalias: false
};

// ───────────────────────────────
// UTILITÁRIOS
// ───────────────────────────────
function gerarIdLinha() {
    return `r-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

function escapeHtml(texto) {
    if (texto === null || texto === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(texto);
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function normalizarNomeColuna(nome) {
    return String(nome || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// ───────────────────────────────
// TOAST (feedback visual)
// ───────────────────────────────
function mostrarToast(texto, tipo = 'info') {
    const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `toast-notif ${tipo}`;
    toast.innerHTML = `<span>${icons[tipo] || 'ℹ'}</span><span>${texto}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3100);
}

// ───────────────────────────────
// UNDO / REDO
// ───────────────────────────────
function salvarEstadoHistorico() {
    const snapshot = {
        todosDados: JSON.parse(JSON.stringify(estado.todosDados)),
        colunasAtuais: [...estado.colunasAtuais]
    };
    estado.historico.push(snapshot);
    if (estado.historico.length > estado.maxHistorico) {
        estado.historico.shift();
    }
    estado.historicoFuturo = []; // limpa redo ao fazer nova ação
    atualizarBotoesUndoRedo();
    
    // Auto-save to LocalStorage
    if (typeof persistirEstadoLocal === 'function') {
        persistirEstadoLocal();
    }
}

function desfazer() {
    if (estado.historico.length === 0) {
        mostrarToast('Nada para desfazer.', 'info');
        return;
    }
    // Salva estado atual no redo
    estado.historicoFuturo.push({
        todosDados: JSON.parse(JSON.stringify(estado.todosDados)),
        colunasAtuais: [...estado.colunasAtuais]
    });
    const anterior = estado.historico.pop();
    estado.todosDados = anterior.todosDados;
    estado.colunasAtuais = anterior.colunasAtuais;
    renderizarColunas();
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    atualizarBotoesUndoRedo();
    mostrarToast('Ação desfeita.', 'info');
}

function refazer() {
    if (estado.historicoFuturo.length === 0) {
        mostrarToast('Nada para refazer.', 'info');
        return;
    }
    estado.historico.push({
        todosDados: JSON.parse(JSON.stringify(estado.todosDados)),
        colunasAtuais: [...estado.colunasAtuais]
    });
    const proximo = estado.historicoFuturo.pop();
    estado.todosDados = proximo.todosDados;
    estado.colunasAtuais = proximo.colunasAtuais;
    renderizarColunas();
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    atualizarBotoesUndoRedo();
    mostrarToast('Ação refeita.', 'info');
}

function atualizarBotoesUndoRedo() {
    const btnUndo = document.getElementById('btnDesfazer');
    const btnRedo = document.getElementById('btnRefazer');
    if (btnUndo) btnUndo.disabled = estado.historico.length === 0;
    if (btnRedo) btnRedo.disabled = estado.historicoFuturo.length === 0;
}

// ───────────────────────────────
// COPIAR / COLAR
// ───────────────────────────────
function copiarSelecao() {
    const { row, col } = estado.celulaSelecionada;
    if (row < 0 || col < 0) {
        mostrarToast('Selecione uma célula primeiro.', 'warning');
        return;
    }
    const colunas = obterColunasValidas();
    const dadosVisiveis = obterDadosVisiveis();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const linha = dadosVisiveis[inicio + row];
    if (!linha || !colunas[col - 1]) return;
    const valor = String(linha[colunas[col - 1]] ?? '');
    estado.clipboard = valor;
    navigator.clipboard?.writeText(valor).catch(() => {});
    mostrarToast(`Copiado: "${valor}"`, 'success');
}

function colarSelecao() {
    if (estado.clipboard === null || estado.clipboard === undefined) {
        mostrarToast('Área de transferência vazia.', 'warning');
        return;
    }
    const { row, col } = estado.celulaSelecionada;
    if (row < 0 || col < 0) {
        mostrarToast('Selecione uma célula para colar.', 'warning');
        return;
    }
    const colunas = obterColunasValidas();
    const dadosVisiveis = obterDadosVisiveis();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const linha = dadosVisiveis[inicio + row];
    if (!linha || !colunas[col - 1]) return;

    salvarEstadoHistorico();
    linha[colunas[col - 1]] = estado.clipboard;
    exibirPagina();
    mostrarToast('Colado com sucesso.', 'success');
}

// ───────────────────────────────
// INICIALIZAÇÃO
// ───────────────────────────────
function inicializarElementos() {
    const ids = {
        uploadArquivo: 'uploadArquivo',
        uploadDropZone: 'uploadDropZone',
        btnLimparUpload: 'btnLimparUpload',
        uploadStatus: 'uploadStatus',
        uploadError: 'uploadError',
        colunasContainer: 'colunas-container',
        tabelaDados: 'tabelaDados',
        dadosTbody: 'dados-tbody',
        btnAdicionarColuna: 'btnAdicionarColuna',
        btnAdicionarLinha: 'btnAdicionarLinha',
        btnSalvarDados: 'btnSalvarDados',
        btnVoltar: 'btnVoltar',
        btnProximo: 'btnProximo',
        inicioPag: 'inicio-pag',
        fimPag: 'fim-pag',
        totalPag: 'total-pag',
        inputBuscaTabela: 'inputBuscaTabela',
        cellRef: 'cellRef',
        linhasSelecionadas: 'linhas-selecionadas'
    };
    for (const [key, id] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) estado.elementos[key] = el;
    }
    // Expor estado globalmente para utilitários que o referenciam
    try { window.estado = estado; } catch (e) { /* ignora */ }
    const tabela = estado.elementos.tabelaDados;
    if (tabela) {
        const thead = tabela.querySelector('thead tr');
        if (thead) estado.elementos.thead = thead;
    }
    // Injetar estilo para linhas com anomalias
    if (!document.getElementById('estilo-anomalias')) {
        const style = document.createElement('style');
        style.id = 'estilo-anomalias';
        style.textContent = `
            :root{
                --dqa-bg: #fff;
                --dqa-surface: #ffffff;
                --dqa-text: #111827;
                --dqa-muted: #6b7280;
                --dqa-danger: #ef4444;
                --dqa-border: #e5e7eb;
                --dqa-btn-bg: #ffffff;
                --dqa-btn-border: #d1d5db;
            }
            @media (prefers-color-scheme: dark) {
                :root{
                    --dqa-bg: #0b1220;
                    --dqa-surface: #0f1724;
                    --dqa-text: #e6eef8;
                    --dqa-muted: #9ca3af;
                    --dqa-danger: #f87171;
                    --dqa-border: #1f2937;
                    --dqa-btn-bg: #0f1724;
                    --dqa-btn-border: #374151;
                }
            }
            .row-anomalia{background: rgba(239,68,68,0.04);}
            @media (prefers-color-scheme: dark){ .row-anomalia{background: rgba(248,113,113,0.06);} }
            .row-anomalia td{border-left:4px solid var(--dqa-danger);}
            .btn-small{padding:6px 8px;border-radius:6px;border:1px solid var(--dqa-btn-border);background:var(--dqa-btn-bg);color:var(--dqa-text);cursor:pointer;font-weight:600}
            .btn-small:hover{filter:brightness(0.96)}
            .btn-danger{background:var(--dqa-danger);color:#fff;border-color:var(--dqa-danger)}
            .botao-acao-planilha{display:inline-flex;align-items:center;justify-content:center;min-width:36px;height:36px;border-radius:6px;border:1px solid var(--dqa-btn-border);background:var(--dqa-btn-bg);color:var(--dqa-text);cursor:pointer;margin-left:6px}
            .botao-acao-planilha i{font-size:14px}
            .botao-acao-planilha:hover{background:rgba(0,0,0,0.03)}
            @media (prefers-color-scheme: dark){ .botao-acao-planilha:hover{background:rgba(255,255,255,0.02)} }
            .btn-anomalia{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:6px;border:1px dashed var(--dqa-btn-border);background:transparent;color:var(--dqa-danger);cursor:pointer;margin-left:6px}
            .btn-anomalia:hover{background:rgba(239,68,68,0.06)}
            @media (prefers-color-scheme: dark){ .btn-anomalia:hover{background:rgba(248,113,113,0.06)} }
            .modal-overlay-anomalia{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999}
            .modal-box-anomalia{background:var(--dqa-surface);color:var(--dqa-text);padding:18px;border-radius:8px;max-width:560px;width:100%;box-shadow:0 6px 24px rgba(2,6,23,0.6);border:1px solid var(--dqa-border)}
            .modal-box-anomalia h3{margin:0 0 8px 0}
            .modal-box-anomalia .muted{color:var(--dqa-muted)}
            /* Tabs de tabelas e botão de fechar (✕) */
            .table-tab{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;margin-right:6px;background:var(--dqa-btn-bg);border:1px solid var(--dqa-btn-border);color:var(--dqa-text);cursor:pointer}
            .table-tab.active{box-shadow:0 6px 20px rgba(2,6,23,0.08);font-weight:700}
            .tab-close{margin-left:8px;padding:4px 8px;border-radius:6px;border:none;background:transparent;color:var(--dqa-muted);cursor:pointer;font-weight:700}
            .tab-close:hover{color:var(--dqa-danger);background:rgba(239,68,68,0.06)}
            .table-tab-add{display:inline-flex;align-items:center;justify-content:center;padding:8px 12px;border-radius:8px;border:1px dashed var(--dqa-btn-border);background:transparent;color:var(--dqa-text);cursor:pointer}
            .table-tab-add:hover{background:rgba(0,0,0,0.03)}
            @media (prefers-color-scheme: dark){ .tab-close:hover{background:rgba(248,113,113,0.06)} .table-tab-add:hover{background:rgba(255,255,255,0.02)} }
        `;
        document.head.appendChild(style);
    }
}

function configurarEventListeners() {
    // Upload
    if (estado.elementos.uploadArquivo) {
        estado.elementos.uploadArquivo.addEventListener('change', handleUpload);
    }
    // Drag & drop on upload zone
    const dropZone = estado.elementos.uploadDropZone;
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); dropZone.classList.add('highlight');
        }));
        ['dragleave', 'drop', 'dragend'].forEach(ev => dropZone.addEventListener(ev, e => {
            e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('highlight');
        }));
        dropZone.addEventListener('drop', e => {
            e.preventDefault(); e.stopPropagation();
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                // inferir tipo a partir da extensão? deixamos o usuário escolher via seleção rápida
                if (estado.elementos.uploadArquivo) {
                    // atribui arquivos ao input e chama handler
                    try { estado.elementos.uploadArquivo.files = files; } catch (err) { /* alguns browsers não permitem setFiles */ }
                }
                handleUpload({ target: { files } });
            }
        });
    }
    if (estado.elementos.btnLimparUpload) {
        estado.elementos.btnLimparUpload.addEventListener('click', handleLimparDados);
    }

    // Cards de tipo de arquivo
    document.querySelectorAll('.card-upload').forEach(card => {
        card.addEventListener('click', () => selecionarTipoArquivo(card));
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-3px)';
            card.style.boxShadow = '0 8px 20px rgba(0,0,0,0.25)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = '';
            card.style.boxShadow = '';
        });
    });

    // Coluna actions
    if (estado.elementos.btnAdicionarColuna) {
        estado.elementos.btnAdicionarColuna.addEventListener('click', adicionarNovaColuna);
    }
    if (estado.elementos.btnAdicionarLinha) {
        estado.elementos.btnAdicionarLinha.addEventListener('click', adicionarNovaLinha);
    }
    if (estado.elementos.btnSalvarDados) {
        estado.elementos.btnSalvarDados.addEventListener('click', () => salvarDados(false));
    }
    if (estado.elementos.btnVoltar) {
        estado.elementos.btnVoltar.addEventListener('click', paginaAnterior);
    }
    if (estado.elementos.btnProximo) {
        estado.elementos.btnProximo.addEventListener('click', paginaProxima);
    }

    // Exclusão
    const btnExclusao = document.getElementById('btnSolicitarExclusao');
    if (btnExclusao) {
        btnExclusao.addEventListener('click', solicitarExclusaoDados);
        estado.elementos.btnSolicitarExclusao = btnExclusao;
    }

    // Delegados nas colunas
    if (estado.elementos.colunasContainer) {
        estado.elementos.colunasContainer.addEventListener('click', e => {
            if (e.target.classList.contains('botao-remover-coluna')) removerColuna(e);
        });
    }

    // Delegados no tbody
    if (estado.elementos.dadosTbody) {
        estado.elementos.dadosTbody.addEventListener('input', e => {
            if (e.target.classList.contains('entrada-linha')) atualizarCelula(e, false);
        });
        estado.elementos.dadosTbody.addEventListener('change', e => {
            if (e.target.classList.contains('entrada-linha')) atualizarCelula(e, true);
        });
        estado.elementos.dadosTbody.addEventListener('focusout', e => {
            if (e.target.classList.contains('entrada-linha')) atualizarCelula(e, true);
        });
        estado.elementos.dadosTbody.addEventListener('click', e => {
            const btn = e.target.closest('.botao-acao-planilha');
            if (btn) { deletarLinha(e); return; }
            const btnA = e.target.closest('.btn-anomalia');
            if (btnA) {
                const tr = e.target.closest('tr');
                if (!tr) return;
                const rowId = tr.dataset.rowId;
                mostrarDetalhesAnomalia(rowId);
                return;
            }
            const td = e.target.closest('td');
            const tr = e.target.closest('tr');
            if (td && tr && !btn) selecionarCelula(tr, td);
        });
        estado.elementos.dadosTbody.addEventListener('keydown', handleKeyboardNavigation);
    }

    // Busca
    if (estado.elementos.inputBuscaTabela) {
        estado.elementos.inputBuscaTabela.addEventListener('input',
            debounce(handleBuscaTabela, 300));
    }

    // Auto-save toggle
    const checkAuto = document.getElementById('checkSalvarAutomatico');
    if (checkAuto) {
        checkAuto.checked = localStorage.getItem('autoSaveEnabled') === 'true';
        checkAuto.addEventListener('change', e => {
            localStorage.setItem('autoSaveEnabled', e.target.checked);
            if (e.target.checked) salvarDados(true);
        });
    }

    // Linhas por página
    const selectLinhas = document.getElementById('selectLinhasPorPagina');
    if (selectLinhas) {
        selectLinhas.value = CONFIG.LINHAS_POR_PAGINA;
        selectLinhas.addEventListener('change', e => {
            CONFIG.LINHAS_POR_PAGINA = parseInt(e.target.value, 10);
            estado.paginaAtual = 1;
            exibirPagina();
            atualizarPaginacao();
        });
    }

    // Atalhos de teclado globais
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey)) {
            if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); desfazer(); }
            if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); }
            if (e.key === 'c' && document.activeElement.classList.contains('entrada-linha')) {
                // Deixa o browser copiar normalmente
            } else if (e.key === 'c') { e.preventDefault(); copiarSelecao(); }
            if (e.key === 'v' && !document.activeElement.classList.contains('entrada-linha')) {
                e.preventDefault(); colarSelecao();
            }
        }
    });

    // Modais de abas
    document.getElementById('btnConfirmarAba')?.addEventListener('click', confirmarAba);
    document.getElementById('btnImportarTodas')?.addEventListener('click', importarTodasAbas);
    document.getElementById('btnCancelarAba')?.addEventListener('click', fecharModalAbas);
    document.getElementById('btnConfirmarExportMulti')?.addEventListener('click', confirmarExportMulti);
    document.getElementById('btnCancelarExportMulti')?.addEventListener('click', () => {
        document.getElementById('modalExportMulti').style.display = 'none';
    });

    // Ações de Anomalias (banner gerado dinamicamente)
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        if (target.id === 'btnVerAnomalias' || (target.closest && target.closest('#btnVerAnomalias'))) {
            mostrarAnomalias();
        }
        if (target.id === 'btnRemoverAnomalias' || (target.closest && target.closest('#btnRemoverAnomalias'))) {
            removerTodasAnomalias();
        }
        if (target.id === 'btnMostrarTudoAnomalias' || (target.closest && target.closest('#btnMostrarTudoAnomalias'))) {
            limparFiltroAnomalias();
            mostrarToast('Visualização restaurada: mostrando todos os dados.', 'success');
        }
    });
}

// ───────────────────────────────
// SELEÇÃO DE CÉLULA
// ───────────────────────────────
function selecionarCelula(tr, td) {
    // Remove seleção anterior
    document.querySelectorAll('.cell-selected').forEach(el => el.classList.remove('cell-selected'));

    const tbody = estado.elementos.dadosTbody;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const cells = Array.from(tr.querySelectorAll('td'));
    const rowIdx = rows.indexOf(tr);
    const colIdx = cells.indexOf(td);

    estado.celulaSelecionada = { row: rowIdx, col: colIdx };
    td.classList.add('cell-selected');

    // Atualiza referência da célula (ex: B3)
    const colunas = obterColunasValidas();
    const colLetra = colIdx > 0 && colIdx <= colunas.length
        ? String.fromCharCode(64 + colIdx)
        : '?';
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    if (estado.elementos.cellRef) {
        estado.elementos.cellRef.textContent = colIdx > 0 ? `${colLetra}${inicio + rowIdx + 1}` : `#${inicio + rowIdx + 1}`;
    }
}

// ───────────────────────────────
// UPLOAD COM PROGRESSO
// ───────────────────────────────
function uploadArquivoComProgresso(url, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(e.loaded, e.total);
            }
        });
        
        xhr.addEventListener('load', () => {
            let data;
            try {
                data = JSON.parse(xhr.responseText);
            } catch (err) {
                data = { mensagem: 'Resposta inválida do servidor' };
            }
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({ ok: true, data: data });
            } else {
                resolve({ ok: false, data: data });
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Erro na conexão com o servidor.'));
        });
        
        xhr.send(formData);
    });
}

function atualizarProgressoUpload(percent) {
    const status = estado.elementos.uploadStatus;
    if (!status) return;
    status.style.display = 'block';
    
    const textoProgresso = percent < 100 
        ? `Enviando arquivo...` 
        : `⏳ Processando e limpando dados no servidor...`;
        
    status.innerHTML = `
        <div style="padding: 12px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; background: rgba(37,99,235,0.08); color: #2563eb; border: 1px solid #2563eb; margin-top: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 600; margin-bottom: 6px;">
                <span>${textoProgresso}</span>
                <span>${percent}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: rgba(229, 231, 235, 0.5); border-radius: 4px; overflow: hidden;">
                <div style="width: ${percent}%; height: 100%; background: #2563eb; transition: width 0.1s ease; border-radius: 4px;"></div>
            </div>
        </div>
    `;
}

function selecionarTipoArquivo(card) {
    estado.tipoArquivo = card.dataset.type;
    if (estado.elementos.uploadArquivo) {
        estado.elementos.uploadArquivo.value = '';
        estado.elementos.uploadArquivo.click();
    }
}

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!validarArquivo(file)) return;

    atualizarProgressoUpload(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
        const result = await uploadArquivoComProgresso('/upload', formData, (loaded, total) => {
            const percent = Math.round((loaded / total) * 100);
            atualizarProgressoUpload(percent);
        });

        const data = result.data;
        if (!result.ok) throw new Error(data.mensagem || 'Erro ao enviar arquivo');

        // Excel com múltiplas abas
        if (data.multiplas_abas) {
            estado.uploadPendente = { arquivo: file, abas: data.abas, nomePendente: data.nome_arquivo };
            abrirModalAbas(data.abas, data.mensagem);
            mostrarMensagem('info', `📋 ${data.mensagem}`);
            return;
        }

        mostrarMensagem('sucesso', `✓ ${data.mensagem} (${data.dados?.length || 0} linhas)`);
        if (data.colunas?.length > 0) {
            preencherTabela(data.colunas, data.dados);
            setTimeout(() => {
                if (typeof abrirModalMapeamento === 'function') abrirModalMapeamento(data.colunas);
            }, 1000);
        }

    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('erro', `✗ ${error.message}`);
    }
}

function validarArquivo(file) {
    if (!estado.tipoArquivo) {
        mostrarToast('Selecione um tipo de arquivo primeiro!', 'warning');
        return false;
    }
    const extensoesValidas = CONFIG.EXTENSOES_VALIDAS[estado.tipoArquivo] || [];
    const extensao = '.' + file.name.split('.').pop().toLowerCase();
    if (!extensoesValidas.includes(extensao)) {
        mostrarToast(`Arquivo inválido! Esperado: ${extensoesValidas.map(e => e.toUpperCase()).join(', ')}`, 'error');
        return false;
    }
    return true;
}

function mostrarMensagem(tipo, texto) {
    const status = estado.elementos.uploadStatus;
    const erro = estado.elementos.uploadError;

    const estiloBase = 'padding: 10px 14px; border-radius: 8px; font-size: 14px; font-weight: 500;';
    if (tipo === 'sucesso') {
        if (status) {
            status.style.display = 'block';
            status.innerHTML = `<div style="${estiloBase} background:rgba(22,163,74,0.1); color:#16a34a; border:1px solid #16a34a;">${texto}</div>`;
        }
        if (erro) erro.style.display = 'none';
    } else if (tipo === 'erro') {
        if (erro) {
            erro.style.display = 'block';
            erro.innerHTML = `<div style="${estiloBase} background:rgba(220,38,38,0.1); color:#dc2626; border:1px solid #dc2626;">${texto}</div>`;
        }
        if (status) status.style.display = 'none';
    } else if (tipo === 'info') {
        if (status) {
            status.style.display = 'block';
            status.innerHTML = `<div style="${estiloBase} background:rgba(37,99,235,0.08); color:#2563eb; border:1px solid #2563eb;">${texto}</div>`;
        }
        if (erro) erro.style.display = 'none';
    }
}

async function handleLimparDados() {
    if (!confirm('Limpar todos os dados da planilha?')) return;
    try {
        const r = await fetch('/apagar-dados', { method: 'DELETE' });
        const data = await r.json();
        if (r.ok) {
            estado.todosDados = [];
            estado.colunasAtuais = [];
            estado.paginaAtual = 1;
            estado.historico = [];
            estado.historicoFuturo = [];
            limparUI();
            atualizarPaginacao();
            if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
            if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
            mostrarToast('Dados limpos com sucesso.', 'success');
        }
    } catch (e) {
        mostrarToast('Erro ao apagar dados!', 'error');
    }
}

function limparUI() {
    if (estado.elementos.colunasContainer) estado.elementos.colunasContainer.innerHTML = '';
    if (estado.elementos.thead) estado.elementos.thead.innerHTML = '';
    if (estado.elementos.dadosTbody) estado.elementos.dadosTbody.innerHTML = '';
    if (estado.elementos.uploadStatus) estado.elementos.uploadStatus.style.display = 'none';
    if (estado.elementos.uploadError) estado.elementos.uploadError.style.display = 'none';
    if (estado.elementos.uploadArquivo) estado.elementos.uploadArquivo.value = '';
    estado.tipoArquivo = null;
}

// ───────────────────────────────
// MODAL ABAS EXCEL
// ───────────────────────────────
function abrirModalAbas(abas, mensagem) {
    const modal = document.getElementById('modalAbas');
    const lista = document.getElementById('listaAbas');
    const sub = document.getElementById('modalAbasSubtitle');
    if (!modal || !lista) return;

    sub.textContent = mensagem || 'Selecione qual aba deseja importar:';
    lista.innerHTML = abas.map((aba, i) => `
        <div class="aba-item ${i === 0 ? 'selected' : ''}" data-aba="${escapeHtml(aba)}" onclick="selecionarAbaModal(this)">
            <i class="fa-solid fa-table aba-icon"></i>
            <span class="aba-nome">${escapeHtml(aba)}</span>
            ${i === 0 ? '<i class="fa-solid fa-check" style="color:var(--primaria);"></i>' : ''}
        </div>
    `).join('');
    modal.style.display = 'flex';
}

function selecionarAbaModal(el) {
    document.querySelectorAll('.aba-item').forEach(item => {
        item.classList.remove('selected');
        item.querySelector('.fa-check')?.remove();
    });
    el.classList.add('selected');
    const check = document.createElement('i');
    check.className = 'fa-solid fa-check';
    check.style.color = 'var(--primaria)';
    el.appendChild(check);
}

function fecharModalAbas() {
    const modal = document.getElementById('modalAbas');
    if (modal) modal.style.display = 'none';
    estado.uploadPendente = { arquivo: null, abas: [], nomePendente: '' };
    mostrarMensagem('info', 'Upload cancelado.');
}

async function confirmarAba() {
    const selected = document.querySelector('.aba-item.selected');
    if (!selected) { mostrarToast('Selecione uma aba.', 'warning'); return; }
    const aba = selected.dataset.aba;
    await _uploadComAba(aba, false);
}

async function importarTodasAbas() {
    await _uploadComAba(null, true);
}

async function _uploadComAba(abaNome, todasAbas) {
    const { arquivo } = estado.uploadPendente;
    if (!arquivo) return;

    const formData = new FormData();
    formData.append('file', arquivo);
    if (abaNome) formData.append('sheet_name', abaNome);
    if (todasAbas) formData.append('importar_todas', 'true');

    fecharModalAbas();
    atualizarProgressoUpload(0);

    try {
        const result = await uploadArquivoComProgresso('/upload', formData, (loaded, total) => {
            const percent = Math.round((loaded / total) * 100);
            atualizarProgressoUpload(percent);
        });

        const data = result.data;
        if (!result.ok) throw new Error(data.mensagem || 'Erro');

        mostrarMensagem('sucesso', `✓ ${data.mensagem} (${data.dados?.length || 0} linhas)`);
        if (data.colunas?.length > 0) {
            preencherTabela(data.colunas, data.dados);
            setTimeout(() => {
                if (typeof abrirModalMapeamento === 'function') abrirModalMapeamento(data.colunas);
            }, 1000);
        }
    } catch (e) {
        mostrarMensagem('erro', `✗ ${e.message}`);
    }
}

// ───────────────────────────────
// TABELA — RENDERIZAÇÃO
// ───────────────────────────────
function preencherTabela(colunas, dados) {
    if (!colunas || !dados) return;
    estado.colunasAtuais = [...colunas];
    estado.todosDados = dados.map(linha => {
        const nova = { _id: linha._id || gerarIdLinha() };
        colunas.forEach(col => nova[col] = linha[col] ?? '');
        return nova;
    });
    estado.filtroAtual = '';
    estado.paginaAtual = 1;
    estado.sortColuna = null;
    estado.sortDir = 'asc';
    aplicarAutomacaoDeIndicadores();
    renderizarColunas();
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
    if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
}

function renderizarColunas() {
    const container = estado.elementos.colunasContainer;
    if (!container) return;
    container.innerHTML = '';
    estado.colunasAtuais.forEach(nome => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; gap: 8px; min-width: 200px; max-width: 100%;';
        div.innerHTML = `
            <input type="text" class="entrada entrada-coluna" value="${escapeHtml(nome)}" style="flex: 1; min-width: 0;">
            <button class="botao botao--delet botao-remover-coluna" type="button" style="padding: 10px 12px; flex-shrink: 0;" title="Remover">✕</button>
        `;
        const input = div.querySelector('.entrada-coluna');
        if (input) {
            input.addEventListener('input', () => {
                sincronizarColunas();
                aplicarAutomacaoDeIndicadores();
                atualizarTabela();
                exibirPagina();
            });
        }
        container.appendChild(div);
    });
}

function atualizarTabela() {
    const thead = estado.elementos.thead;
    if (!thead) return;
    const colunas = obterColunasValidas();
    if (colunas.length === 0) { thead.innerHTML = ''; return; }

    thead.innerHTML = `
        <th style="width:40px; text-align:center;">#</th>
        ${colunas.map((c, i) => {
            const isSort = estado.sortColuna === c;
            const dir = isSort ? estado.sortDir : '';
            const icon = isSort && dir === 'asc' ? '↑' : isSort && dir === 'desc' ? '↓' : '↕';
            return `
                <th class="${isSort ? 'sort-' + dir : ''}">
                    <div class="excel-th-inner" onclick="ordenarPorColuna('${escapeHtml(c)}')">
                        <span>${escapeHtml(c)}</span>
                        <span class="sort-icon">${icon}</span>
                    </div>
                    <div class="col-resize-handle" data-col="${i}" onmousedown="iniciarResize(event, this)"></div>
                </th>
            `;
        }).join('')}
        <th style="width:36px;"></th>
    `;
}

function exibirPagina() {
    const tbody = estado.elementos.dadosTbody;
    if (!tbody) return;

    const colunas = obterColunasValidas();
    const dadosVisiveis = obterDadosVisiveis();

    if (colunas.length === 0 || dadosVisiveis.length === 0) {
        const colspan = Math.max(2, colunas.length + 2);
        tbody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="padding:20px; text-align:center; color:var(--suave);">
                    ${estado.filtroAtual ? 'Nenhum resultado encontrado.' : 'Nenhum dado. Clique em "+ Linha" ou faça upload de um arquivo.'}
                </td>
            </tr>`;
        return;
    }

    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const dadosPagina = dadosVisiveis.slice(inicio, inicio + CONFIG.LINHAS_POR_PAGINA);
    const termoBusca = estado.filtroAtual;
    const temColunaEstoque = colunas.some(col => /estoque|\bstock\b/i.test(col));

    tbody.innerHTML = dadosPagina.map((linha, i) => {
        const numLinha = inicio + i + 1;
        const isSelecionada = estado.linhasSelecionadas.has(linha._id);

        const celulas = colunas.map((col, colIndex) => {
            const valor = linha[col] ?? '';
            const ehDestaque = termoBusca && String(valor).toLowerCase().includes(termoBusca);
            const classeDestaque = ehDestaque ? ' celula-destaque' : '';

            const partes = [];
            if (/produto|product|\bitem\b|\bnome\b|\bname\b|mercadoria/i.test(col)) {
                partes.push('name="produto" data-coluna-produto="true"');
            } else if (/categoria|category|\btipo\b|\btype\b|\bgrupo\b/i.test(col)) {
                partes.push('name="categoria" data-coluna-categoria="true"');
            } else if (/pre[cç]o|\bpreco\b|\bvalor\b|\bprice\b|unit[a-z]*/i.test(col) && !/total|faturamento|receita|despesa|lucro/i.test(col)) {
                partes.push('name="preco" data-coluna-preco="true"');
            } else if (/estoque|\bstock\b/i.test(col)) {
                partes.push('name="estoque" data-coluna-estoque="true"');
            } else if (/quantidade|\bquant\b|\bqtd\b|\bamount\b/i.test(col)) {
                if (temColunaEstoque) {
                    partes.push('name="quantidade" data-coluna-quantidade="true"');
                } else {
                    partes.push('name="estoque" data-coluna-estoque="true" data-coluna-quantidade="true"');
                }
            } else if (/desconto|discount/i.test(col)) {
                partes.push('name="desconto" data-coluna-desconto="true"');
            } else if (/\bsku\b|c[oó]digo|\bcod\b|\bcode\b|\bref\b/i.test(col)) {
                partes.push('name="sku" data-coluna-sku="true"');
            }

            const attrs = partes.join(' ');
            return `
                <td class="${classeDestaque}">
                    <input type="text" class="entrada-linha" ${attrs}
                           value="${escapeHtml(valor)}" placeholder="Digite...">
                </td>`;
        }).join('');

        const ehAnomalia = estado.anomaliasIds && estado.anomaliasIds.has && estado.anomaliasIds.has(linha._id);
        return `
            <tr class="linha-dados${isSelecionada ? ' row-selected' : ''}${ehAnomalia ? ' row-anomalia' : ''}" data-row-id="${linha._id}">
                <td class="row-number">${numLinha}</td>
                ${celulas}
                <td class="action-cell">
                    <button class="botao-acao-planilha" type="button" title="Deletar linha"><i class="fa-solid fa-trash"></i></button>
                    ${ehAnomalia ? `<button type="button" class="btn-anomalia" title="Ver motivo">⚠️</button>` : ''}
                </td>
            </tr>`;
    }).join('');

    // Inicializar autocomplete
    if (window.AutocompleteManager) {
        setTimeout(() => {
            document.querySelectorAll('input[name="produto"]').forEach(input => {
                AutocompleteManager.inicializarInput(input);
            });
        }, 100);
    }
}

// ───────────────────────────────
// ORDENAÇÃO
// ───────────────────────────────
function ordenarPorColuna(col) {
    salvarEstadoHistorico();
    if (estado.sortColuna === col) {
        estado.sortDir = estado.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
        estado.sortColuna = col;
        estado.sortDir = 'asc';
    }

    estado.todosDados.sort((a, b) => {
        let va = a[col] ?? '';
        let vb = b[col] ?? '';
        const na = parseFloat(String(va).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        const nb = parseFloat(String(vb).replace(/[^0-9.,-]/g, '').replace(',', '.'));
        if (!isNaN(na) && !isNaN(nb)) {
            return estado.sortDir === 'asc' ? na - nb : nb - na;
        }
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
        if (va < vb) return estado.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return estado.sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    estado.paginaAtual = 1;
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
}

// ───────────────────────────────
// ANOMALIAS: visualização e limpeza
// ───────────────────────────────
function mostrarAnomalias() {
    if (!window.estado || !window.estado.anomalias || window.estado.anomalias.length === 0) {
        mostrarToast('Nenhuma anomalia detectada.', 'info');
        return;
    }
    estado.mostrarApenasAnomalias = true;
    estado.paginaAtual = 1;
    exibirPagina();
    mostrarToast(`${window.estado.anomalias.length} anomalia(s) mostrada(s).`, 'info');
}

function limparFiltroAnomalias() {
    estado.mostrarApenasAnomalias = false;
    exibirPagina();
}

function removerTodasAnomalias() {
    if (!window.estado || !window.estado.anomalias || window.estado.anomalias.length === 0) {
        mostrarToast('Nenhuma anomalia encontrada.', 'warning');
        return;
    }
    if (!confirm(`Remover todas as ${window.estado.anomalias.length} linha(s) identificadas como anomalia? Esta ação não pode ser desfeita.`)) return;
    const ids = new Set(window.estado.anomalias.map(a => a._id));
    estado.todosDados = estado.todosDados.filter(l => !ids.has(l._id));
    // limpar estado de anomalias
    window.estado.anomalias = [];
    window.estado.anomaliasIds = new Set();
    estado.anomalias = [];
    estado.anomaliasIds = new Set();
    estado.mostrarApenasAnomalias = false;
    // Atualizar UI
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
    mostrarToast('Linhas de anomalias removidas.', 'success');
}

function mostrarDetalhesAnomalia(rowId) {
    if (!window.estado || !window.estado.anomalias) {
        mostrarToast('Nenhuma anomalia registrada.', 'warning');
        return;
    }
    const a = window.estado.anomalias.find(x => x._id === rowId);
    if (!a) { mostrarToast('Anomalia não encontrada para esta linha.', 'warning'); return; }
    // criar modal simples
    const existing = document.getElementById('modalAnomalia'); if (existing) existing.remove();
    const modal = document.createElement('div'); modal.id = 'modalAnomalia'; modal.className = 'modal-overlay-anomalia';
    const box = document.createElement('div'); box.className = 'modal-box-anomalia';
    box.innerHTML = `<h3>Anomalia na linha</h3>
        <div style="margin-bottom:12px;">Coluna: <strong>${escapeHtml(a.coluna)}</strong></div>
        <div style="margin-bottom:12px;">Valor: <strong>${escapeHtml(a.valor)}</strong></div>
        <div style="margin-bottom:16px;" class="muted">Motivo: <em>${escapeHtml(a.motivo)}</em></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="btnCorrigirAnomalia" class="btn-small">Corrigir</button>
            <button id="btnRemoverLinhaAnomalia" class="btn-small btn-danger">Remover linha</button>
            <button id="btnFecharModalAnomalia" class="btn-small">Fechar</button>
        </div>`;
    modal.appendChild(box); document.body.appendChild(modal);

    document.getElementById('btnFecharModalAnomalia').addEventListener('click', () => modal.remove());
    document.getElementById('btnRemoverLinhaAnomalia').addEventListener('click', () => {
        if (!confirm('Remover esta linha?')) return;
        removerLinhaPorId(rowId);
        modal.remove();
        mostrarToast('Linha removida.', 'success');
    });
    document.getElementById('btnCorrigirAnomalia').addEventListener('click', () => {
        modal.remove();
        // localizar célula e focar para correção
        const colunas = obterColunasValidas();
        const colIndex = colunas.indexOf(a.coluna);
        if (colIndex < 0) { mostrarToast('Coluna não encontrada para correção.', 'warning'); return; }
        const tr = document.querySelector(`tr[data-row-id="${rowId}"]`);
        if (!tr) { mostrarToast('Linha não está na página atual. Ajuste a página.', 'warning'); return; }
        const inputs = tr.querySelectorAll('input.entrada-linha');
        const tdIndex = colIndex; // inputs correspondem às colunas order
        const input = inputs[tdIndex];
        if (input) { input.focus(); input.select(); mostrarToast('Corrija o valor e Aguarde...','info'); }
    });
}

function removerLinhaPorId(id) {
    salvarEstadoHistorico();
    const idx = estado.todosDados.findIndex(item => item._id === id);
    if (idx >= 0) {
        estado.todosDados.splice(idx, 1);
        // limpar se estava em anomalias
        if (window.estado && window.estado.anomalias) {
            window.estado.anomalias = window.estado.anomalias.filter(a => a._id !== id);
            window.estado.anomaliasIds = new Set(window.estado.anomalias.map(a => a._id));
        }
        estado.anomalias = estado.anomalias.filter(a => a._id !== id);
        estado.anomaliasIds.delete(id);
        exibirPagina(); atualizarPaginacao();
        if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
        if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
    }
}

// ───────────────────────────────
// RESIZE DE COLUNAS
// ───────────────────────────────
let _resizeStartX = 0;
let _resizeTh = null;
let _resizeStartW = 0;

function iniciarResize(event, handle) {
    event.preventDefault();
    event.stopPropagation();
    _resizeStartX = event.clientX;
    _resizeTh = handle.closest('th');
    _resizeStartW = _resizeTh.offsetWidth;

    const onMove = e => {
        const diff = e.clientX - _resizeStartX;
        _resizeTh.style.width = Math.max(60, _resizeStartW + diff) + 'px';
        _resizeTh.style.minWidth = _resizeTh.style.width;
    };
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// ───────────────────────────────
// MANIPULAÇÃO DE DADOS
// ───────────────────────────────
function obterColunasValidas() {
    return Array.from(document.querySelectorAll('.entrada-coluna'))
        .map(input => input.value.trim())
        .filter(v => v !== '');
}

function obterDadosVisiveis() {
    if (estado.mostrarApenasAnomalias) {
        return estado.todosDados.filter(l => estado.anomaliasIds.has(l._id));
    }
    if (!estado.filtroAtual) return estado.todosDados;
    const colunas = obterColunasValidas();
    const termo = estado.filtroAtual.toLowerCase();
    return estado.todosDados.filter(linha =>
        colunas.some(col => String(linha[col] || '').toLowerCase().includes(termo))
    );
}

function criarLinhaVazia(colunas) {
    const linha = { _id: gerarIdLinha() };
    colunas.forEach(col => linha[col] = '');
    return linha;
}

function sincronizarColunas() {
    const novas = obterColunasValidas();
    estado.todosDados = estado.todosDados.map(linha => {
        const nova = { _id: linha._id };
        novas.forEach(col => nova[col] = linha[col] ?? '');
        return nova;
    });
    estado.colunasAtuais = [...novas];
}

function adicionarNovaColuna() {
    const container = estado.elementos.colunasContainer;
    if (!container) return;
    salvarEstadoHistorico();
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 8px; min-width: 200px; max-width: 100%;';
    div.innerHTML = `
        <input type="text" class="entrada entrada-coluna" placeholder="Nova coluna" style="flex: 1; min-width: 0;">
        <button class="botao botao--delet botao-remover-coluna" type="button" style="padding: 10px 12px; flex-shrink: 0;" title="Remover">✕</button>
    `;
    container.appendChild(div);
    const input = div.querySelector('.entrada-coluna');
    if (input) {
        input.addEventListener('input', () => {
            sincronizarColunas();
            atualizarTabela();
            exibirPagina();
            if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
        });
        input.focus();
    }
    sincronizarColunas();
    atualizarTabela();
    exibirPagina();
    if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
}

function removerColuna(event) {
    const colunaDiv = event.target.closest('div');
    if (colunaDiv) {
        salvarEstadoHistorico();
        colunaDiv.remove();
        sincronizarColunas();
        aplicarAutomacaoDeIndicadores();
        atualizarTabela();
        exibirPagina();
        if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
    }
}

function formatarDataHoje() {
    const hoje = new Date();
    return `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`;
}

function detectarEFormatarDataHoje(nomeColuna, dadosExistentes) {
    const hoje = new Date();
    const d = String(hoje.getDate()).padStart(2,'0');
    const m = String(hoje.getMonth()+1).padStart(2,'0');
    const y = hoje.getFullYear();
    if (dadosExistentes?.length > 0) {
        const valor = String(dadosExistentes[0][nomeColuna] ?? '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return `${y}-${m}-${d}`;
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(valor)) return `${y}/${m}/${d}`;
        if (/^\d{2}-\d{2}-\d{4}$/.test(valor)) return `${d}-${m}-${y}`;
    }
    return `${d}/${m}/${y}`;
}

function adicionarNovaLinha() {
    const colunas = obterColunasValidas();
    if (!colunas.length) { mostrarToast('Adicione pelo menos uma coluna!', 'warning'); return; }
    salvarEstadoHistorico();
    const linha = { _id: gerarIdLinha() };
    colunas.forEach(col => {
        const cn = normalizarNomeColuna(col);
        linha[col] = /\bdata\b|^date\b|\bdia\b/i.test(cn)
            ? detectarEFormatarDataHoje(col, estado.todosDados)
            : '';
    });
    estado.todosDados.push(linha);
    estado.paginaAtual = Math.ceil(obterDadosVisiveis().length / CONFIG.LINHAS_POR_PAGINA);
    aplicarAutomacaoDeIndicadores();
    exibirPagina();
    atualizarPaginacao();
    if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
    if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
    if (window.AutocompleteManager) setTimeout(() => window.AutocompleteManager.inicializarTodos(), 150);
    if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
}

function atualizarValoresNoDom() {
    const tbody = estado.elementos.dadosTbody;
    if (!tbody) return;
    const colunas = obterColunasValidas();
    const inputAtivo = document.activeElement;
    tbody.querySelectorAll('tr.linha-dados').forEach(tr => {
        const rowId = tr.dataset.rowId;
        const linha = estado.todosDados.find(item => item._id === rowId);
        if (!linha) return;
        const inputs = tr.querySelectorAll('.entrada-linha');
        colunas.forEach((col, i) => {
            if (inputs[i] && inputs[i] !== inputAtivo) {
                const novoValor = String(linha[col] ?? '');
                if (inputs[i].value !== novoValor) inputs[i].value = novoValor;
            }
        });
    });
}

function atualizarCelula(event, somenteAoSair = false) {
    const tr = event.target.closest('tr');
    if (!tr || !estado.elementos.dadosTbody) return;

    const rowId = tr.dataset.rowId;
    const colunas = obterColunasValidas();
    const linha = estado.todosDados.find(item => item._id === rowId);
    const inputs = tr.querySelectorAll('.entrada-linha');

    if (linha && inputs.length === colunas.length) {
        let colEditada = null;
        colunas.forEach((col, i) => {
            if (inputs[i]) {
                const novo = inputs[i].value ?? '';
                if (String(linha[col]) !== novo) {
                    if (somenteAoSair && colEditada === null) {
                        salvarEstadoHistorico();
                    }
                    linha[col] = novo;
                    colEditada = col;
                }
            }
        });

        if (colEditada) {
            const colProduto = colunas.find(c => /produto|product|\bitem\b|\bnome\b|\bname\b|mercadoria/i.test(c));
            const colEstoque = colunas.find(c => /estoque|\bstock\b/i.test(c));
            if (colProduto && colEstoque) {
                if (colEditada === colEstoque) {
                    const prodAtual = String(linha[colProduto] || '').trim().toLowerCase();
                    if (prodAtual) {
                        estado.todosDados.forEach(r => {
                            if (r._id !== rowId && String(r[colProduto] || '').trim().toLowerCase() === prodAtual) {
                                r[colEstoque] = linha[colEstoque];
                            }
                        });
                    }
                } else if (colEditada === colProduto) {
                    const prodNovo = String(linha[colProduto] || '').trim().toLowerCase();
                    const outra = estado.todosDados.find(r =>
                        r._id !== rowId &&
                        String(r[colProduto] || '').trim().toLowerCase() === prodNovo &&
                        String(r[colEstoque] || '').trim() !== ''
                    );
                    if (outra) linha[colEstoque] = outra[colEstoque];
                }
            }
        }

        if (somenteAoSair) {
            aplicarAutomacaoDeIndicadores(rowId, colEditada);
            atualizarValoresNoDom();
            if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
            if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
            const check = document.getElementById('checkSalvarAutomatico');
            if (check?.checked) debounceAutoSalvar();
            if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
        } else {
            clearTimeout(atualizarCelula._debounce);
            atualizarCelula._debounce = setTimeout(() => {
                aplicarAutomacaoDeIndicadores(rowId, colEditada);
                atualizarValoresNoDom();
                if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
                if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
                if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
            }, 150);
        }
    }
}

function deletarLinha(event) {
    const tr = event.target.closest('tr');
    if (!tr) return;
    salvarEstadoHistorico();
    const rowId = tr.dataset.rowId;
    const idx = estado.todosDados.findIndex(item => item._id === rowId);
    if (idx >= 0) {
        estado.todosDados.splice(idx, 1);
        const total = Math.ceil(obterDadosVisiveis().length / CONFIG.LINHAS_POR_PAGINA);
        estado.paginaAtual = Math.max(1, Math.min(estado.paginaAtual, total || 1));
        exibirPagina();
        atualizarPaginacao();
        if (typeof atualizarEstatisticas === 'function') atualizarEstatisticas();
        if (typeof atualizarMetasUI === 'function') atualizarMetasUI();
        if (typeof persistirTabelaAtualDebounced === 'function') persistirTabelaAtualDebounced();
    }
}

// ───────────────────────────────
// AUTOMAÇÃO DE INDICADORES
// ───────────────────────────────
function mapearIndicadoresAutomaticos(colunas) {
    const normalizadas = colunas.map(col => normalizarNomeColuna(col));
    const encontrar = (termos, excluir = []) => {
        const idx = normalizadas.findIndex(n => {
            const t = termos.some(t => n.includes(t));
            const e = excluir.some(ex => n.includes(ex));
            return t && !e;
        });
        return idx !== -1 ? colunas[idx] : null;
    };
    return {
        preco:       encontrar(['preco','valor','price','unit'], ['total','faturamento','receita','custo','despesa','lucro']),
        quantidade:  encontrar(['quantidade','qtd','quant','amount','volume'], ['estoque','stock']),
        desconto:    encontrar(['desconto','discount','desc']),
        custo:       encontrar(['custo','cost'], ['total','despesa','faturamento']),
        faturamento: encontrar(['faturamento','receita','venda','valor total','total','receitas','vendas'], ['unit','unitario','custo','despesa','lucro']),
        despesa:     encontrar(['despesa','despesas','gasto','gastos','custo total','custos','saida','saída','expense'], ['unit','unitario','preco']),
        lucro:       encontrar(['lucro','profit','resultado','ganho','net','lucros'])
    };
}

function parseNumero(valor) {
    if (valor === null || valor === undefined) return 0;
    const texto = String(valor).replace(/\./g, '').replace(/,/g, '.').trim();
    const n = parseFloat(texto);
    return Number.isFinite(n) ? n : 0;
}

function mostrarStatusAutomacao(texto, tipo = 'info') {
    const status = document.getElementById('autoDadosStatus');
    if (!status) return;
    const cores = { info: 'var(--texto-secundario)', success: '#16a34a', warning: '#d97706', error: '#ef4444' };
    status.style.color = cores[tipo] || cores.info;
    // Adiciona ícone de status
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '✖️' };
    status.innerHTML = `<span style="margin-right:8px;">${icons[tipo] || icons.info}</span><span>${texto || ''}</span>`;
    if (texto) {
        clearTimeout(mostrarStatusAutomacao._t);
        mostrarStatusAutomacao._t = setTimeout(() => { status.innerHTML = ''; }, 6000);
    }
}

function garantirColuna(nome, padrao = '') {
    if (!nome) return false;
    const nn = normalizarNomeColuna(nome);
    if (estado.colunasAtuais.some(c => normalizarNomeColuna(c) === nn)) return false;
    estado.colunasAtuais.push(nome);
    estado.todosDados = estado.todosDados.map(l => ({ ...l, [nome]: l[nome] ?? padrao }));
    return true;
}

function aplicarAutomacaoDeIndicadores(editandoRowId, editandoColuna) {
    const colunas = obterColunasValidas();
    if (!colunas.length || !estado.todosDados.length) {
        mostrarStatusAutomacao('Adicione colunas e linhas para ativar a automação.', 'info');
        return;
    }
    const ind = mapearIndicadoresAutomaticos(colunas);
    const criadas = [];

    if ((ind.faturamento || (ind.preco && ind.quantidade)) && ind.despesa && !ind.lucro) {
        if (garantirColuna('Lucro', '')) criadas.push('Lucro');
        ind.lucro = 'Lucro';
    }
    if (ind.preco && ind.quantidade && !ind.faturamento) {
        if (garantirColuna('Valor Total', '')) criadas.push('Valor Total');
        ind.faturamento = 'Valor Total';
    }
    if (!ind.faturamento && !(ind.preco && ind.quantidade)) {
        mostrarStatusAutomacao('Adicione colunas de Preço/Quantidade ou Faturamento/Receita.', 'warning');
        return;
    }

    let calcFat = false, calcDesp = false, calcLuc = false;
    const vazio = v => v === null || v === undefined || String(v).trim() === '';
    const podeEscrever = (id, col) => !editandoRowId || !editandoColuna || !(id === editandoRowId && col === editandoColuna);

    estado.todosDados = estado.todosDados.map(linha => {
        const nl = { ...linha };
        if (ind.preco && ind.quantidade && ind.faturamento) {
            if (!vazio(nl[ind.preco]) && !vazio(nl[ind.quantidade]) && podeEscrever(linha._id, ind.faturamento)) {
                const p = parseNumero(nl[ind.preco]);
                const q = parseNumero(nl[ind.quantidade]);
                let desc = 0;
                if (ind.desconto && !vazio(nl[ind.desconto])) {
                    const ds = String(nl[ind.desconto]).trim();
                    if (ds.endsWith('%')) desc = p * (parseFloat(ds) / 100) * q;
                    else { const dv = parseNumero(ds); desc = dv < p ? dv * q : dv; }
                }
                nl[ind.faturamento] = p * q - desc;
                calcFat = true;
            }
        }
        if (ind.custo && ind.quantidade && ind.despesa) {
            if (!vazio(nl[ind.custo]) && !vazio(nl[ind.quantidade]) && podeEscrever(linha._id, ind.despesa)) {
                nl[ind.despesa] = parseNumero(nl[ind.custo]) * parseNumero(nl[ind.quantidade]);
                calcDesp = true;
            }
        }
        if (ind.faturamento && ind.despesa && ind.lucro) {
            const fv = vazio(nl[ind.faturamento]);
            const dv = !ind.despesa || vazio(nl[ind.despesa]);
            const lv = !ind.lucro || vazio(nl[ind.lucro]);
            if (!fv && !dv && podeEscrever(linha._id, ind.lucro)) {
                nl[ind.lucro] = parseNumero(nl[ind.faturamento]) - parseNumero(nl[ind.despesa]);
                calcLuc = true;
            } else if (!fv && !lv && podeEscrever(linha._id, ind.despesa)) {
                nl[ind.despesa] = parseNumero(nl[ind.faturamento]) - parseNumero(nl[ind.lucro]);
                calcDesp = true;
            } else if (!dv && !lv && podeEscrever(linha._id, ind.faturamento)) {
                nl[ind.faturamento] = parseNumero(nl[ind.lucro]) + parseNumero(nl[ind.despesa]);
                calcFat = true;
            }
        }
        return nl;
    });

    if (criadas.length || calcFat || calcDesp || calcLuc) {
        const partes = [];
        if (criadas.length) partes.push(`criou ${[...new Set(criadas)].join(' e ')}`);
        if (calcFat) partes.push('calculou Faturamento');
        if (calcDesp) partes.push('calculou Despesas');
        if (calcLuc) partes.push('calculou Lucro');
        mostrarStatusAutomacao(`✅ Automação ativa: ${partes.join(', ')}.`, 'success');
    } else {
        mostrarStatusAutomacao('Automação ativa: colunas detectadas automaticamente.', 'info');
    }
    if (estado.colunasAtuais.length !== colunas.length) {
        renderizarColunas();
        atualizarTabela();
        exibirPagina();
    }
}

// ───────────────────────────────
// NAVEGAÇÃO TECLADO (estilo Excel)
// ───────────────────────────────
function handleKeyboardNavigation(e) {
    if (!e.target.classList.contains('entrada-linha')) return;
    const currentCell = e.target.closest('td');
    const currentRow = e.target.closest('tr');
    const cells = Array.from(currentRow.querySelectorAll('td'));
    const cellIdx = cells.indexOf(currentCell);
    const tbody = currentRow.closest('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowIdx = rows.indexOf(currentRow);
    let targetRow = rowIdx, targetCol = cellIdx;

    if (e.key === 'ArrowUp') { targetRow = rowIdx - 1; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        targetRow = rowIdx + 1; e.preventDefault();
        if (targetRow >= rows.length) {
            adicionarNovaLinha();
            setTimeout(() => {
                const newRows = Array.from(tbody.querySelectorAll('tr'));
                if (newRows[targetRow]) {
                    const tc = Array.from(newRows[targetRow].querySelectorAll('td'));
                    tc[cellIdx]?.querySelector('.entrada-linha')?.focus();
                }
            }, 50);
            return;
        }
    } else if (e.key === 'Tab') {
        e.preventDefault();
        targetCol = e.shiftKey ? cellIdx - 1 : cellIdx + 1;
    } else if (e.key === 'ArrowLeft') {
        if (e.target.selectionStart === 0) { targetCol = cellIdx - 1; e.preventDefault(); } else return;
    } else if (e.key === 'ArrowRight') {
        if (e.target.selectionEnd === e.target.value.length) { targetCol = cellIdx + 1; e.preventDefault(); } else return;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement !== e.target) {
            salvarEstadoHistorico();
            e.target.value = '';
            e.target.dispatchEvent(new Event('input'));
        }
        return;
    } else { return; }

    if (targetRow >= 0 && targetRow < rows.length) {
        const targetCells = Array.from(rows[targetRow].querySelectorAll('td'));
        const colunas = obterColunasValidas();
        if (targetCol > 0 && targetCol <= colunas.length) {
            const input = targetCells[targetCol]?.querySelector('.entrada-linha');
            if (input) {
                input.focus();
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') input.select();
            }
        }
    }
}

// ───────────────────────────────
// PAGINAÇÃO
// ───────────────────────────────
function atualizarPaginacao() {
    const total = obterDadosVisiveis().length;
    const totalPag = Math.ceil(total / CONFIG.LINHAS_POR_PAGINA) || 1;
    estado.paginaAtual = Math.max(1, Math.min(estado.paginaAtual, totalPag));
    const inicio = total > 0 ? (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA + 1 : 0;
    const fim = Math.min(estado.paginaAtual * CONFIG.LINHAS_POR_PAGINA, total);
    if (estado.elementos.inicioPag) estado.elementos.inicioPag.textContent = inicio;
    if (estado.elementos.fimPag)    estado.elementos.fimPag.textContent = fim;
    if (estado.elementos.totalPag)  estado.elementos.totalPag.textContent = total;
    if (estado.elementos.btnVoltar) estado.elementos.btnVoltar.disabled = estado.paginaAtual <= 1;
    if (estado.elementos.btnProximo) estado.elementos.btnProximo.disabled = estado.paginaAtual >= totalPag;
    if (estado.elementos.linhasSelecionadas) estado.elementos.linhasSelecionadas.textContent = estado.linhasSelecionadas.size;
}

function paginaAnterior() {
    if (estado.paginaAtual > 1) { estado.paginaAtual--; exibirPagina(); atualizarPaginacao(); }
}
function paginaProxima() {
    const t = Math.ceil(obterDadosVisiveis().length / CONFIG.LINHAS_POR_PAGINA);
    if (estado.paginaAtual < t) { estado.paginaAtual++; exibirPagina(); atualizarPaginacao(); }
}

// ───────────────────────────────
// BUSCA
// ───────────────────────────────
function handleBuscaTabela(event) {
    estado.filtroAtual = event.target.value.toLowerCase().trim();
    estado.paginaAtual = 1;
    atualizarTabela();
    atualizarPaginacao();
    exibirPagina();
}

// ───────────────────────────────
// SALVAR DADOS
// ───────────────────────────────
let timeoutAutoSalvar = null;
function debounceAutoSalvar() {
    clearTimeout(timeoutAutoSalvar);
    timeoutAutoSalvar = setTimeout(() => salvarDados(true), 1500);
}

async function salvarDados(silencioso = false) {
    const colunas = obterColunasValidas();
    if (!colunas.length) { if (!silencioso) mostrarToast('Adicione pelo menos uma coluna!', 'warning'); return; }
    if (!estado.todosDados.length) { if (!silencioso) mostrarToast('Adicione pelo menos uma linha!', 'warning'); return; }

    aplicarAutomacaoDeIndicadores();
    const dados = estado.todosDados.map(linha => {
        const obj = {};
        obterColunasValidas().forEach(col => obj[col] = linha[col] ?? '');
        return obj;
    });

    // ── Animação do botão ──
    const btn = document.getElementById('btnSalvarDados');
    const _animarBotao = (estado_btn) => {
        if (!btn) return;
        btn.disabled = true;
        if (estado_btn === 'loading') {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Salvando...`;
            btn.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
            btn.style.borderColor = '#2563eb';
            btn.style.transform = 'scale(0.97)';
        } else if (estado_btn === 'success') {
            btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Salvo!`;
            btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            btn.style.borderColor = '#059669';
            btn.style.transform = 'scale(1.06)';
            btn.style.boxShadow = '0 0 18px rgba(16,185,129,0.45)';
            btn.style.transition = 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = '';
            }, 300);
            setTimeout(() => {
                btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações`;
                btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btn.style.borderColor = '#059669';
                btn.style.transform = '';
                btn.style.boxShadow = '';
                btn.disabled = false;
            }, 2500);
        } else if (estado_btn === 'error') {
            btn.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Erro ao salvar`;
            btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            btn.style.borderColor = '#dc2626';
            btn.style.transform = 'scale(1)';
            setTimeout(() => {
                btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salvar Alterações`;
                btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btn.style.borderColor = '#059669';
                btn.disabled = false;
            }, 2500);
        }
    };

    try {
        _animarBotao('loading');
        if (silencioso) mostrarStatusAutomacao('💾 Salvando...', 'info');
        const r = await fetch('/salvar-dados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                colunas: obterColunasValidas(),
                dados,
                nome_planilha: `Planilha_${new Date().toISOString().split('T')[0]}`
            })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.mensagem || 'Erro');

        _animarBotao('success');
        if (silencioso) {
            mostrarStatusAutomacao('✓ Salvo automaticamente!', 'success');
        } else {
            mostrarToast('✓ Dados salvos com sucesso!', 'success');
        }

        // Salvar produtos no histórico de autocomplete
        await _salvarProdutosNoHistorico(obterColunasValidas(), dados);

        if (!silencioso && colunas.length > 0) {
            setTimeout(() => {
                if (typeof abrirModalMapeamento === 'function') abrirModalMapeamento(colunas);
            }, 500);
        }
        atualizarPaginacao();
    } catch (e) {
        _animarBotao('error');
        if (silencioso) mostrarStatusAutomacao('✗ Erro ao salvar.', 'warning');
        else mostrarToast('✗ Erro ao salvar!', 'error');
    }
}

// ───────────────────────────────
// EXCLUSÃO DE DADOS
// ───────────────────────────────
async function solicitarExclusaoDados() {
    if (!confirm('Tem certeza que deseja APAGAR todos os seus dados? Você receberá um email de confirmação.')) return;

    const btn = estado.elementos.btnSolicitarExclusao || document.getElementById('btnSolicitarExclusao');
    let statusDiv = document.getElementById('statusExclusao');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'statusExclusao';
        statusDiv.style.marginTop = '10px';
        btn?.parentNode?.insertBefore(statusDiv, btn.nextSibling);
    }

    try {
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }
        const r = await fetch('/solicitar-exclusao-dados', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        });
        const data = await r.json();
        const isErr = !r.ok;
        const color = isErr ? '#dc2626' : '#16a34a';
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div style="padding:12px; border-radius:6px; background:${isErr ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)'}; border:1px solid ${color};">
                <p style="color:${color}; margin:0;"><strong>${isErr ? '✗ Erro' : '✓ Sucesso'}:</strong> ${data.mensagem || ''}</p>
                ${!isErr ? '<p style="color:#6b7280; margin:8px 0 0; font-size:14px;">Verifique seu email para confirmar.</p>' : ''}
            </div>`;
        if (!isErr) setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    } catch (e) {
        mostrarToast('Erro ao processar solicitação.', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Solicitar Exclusão'; }
    }
}

// ───────────────────────────────
// EXPORTAÇÃO EXCEL — SIMPLES
// ───────────────────────────────
function exportarExcelSimples() {
    const colunas = obterColunasValidas();
    if (!colunas.length || !estado.todosDados.length) {
        mostrarToast('Adicione dados antes de exportar.', 'warning');
        return;
    }

    if (typeof XLSX === 'undefined') {
        mostrarToast('Biblioteca de exportação não carregada. Tente recarregar a página.', 'error');
        return;
    }

    const dados = estado.todosDados.map(linha => {
        const obj = {};
        colunas.forEach(col => obj[col] = linha[col] ?? '');
        return obj;
    });

    const ws = XLSX.utils.json_to_sheet(dados, { header: colunas });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');

    const nome = `DataInsight_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nome);
    mostrarToast('Excel exportado com sucesso!', 'success');
}

// ───────────────────────────────
// EXPORTAÇÃO EXCEL — MULTI-ABAS
// ───────────────────────────────
let _exportAbas = [];

function abrirModalExportMultiAbas() {
    const colunas = obterColunasValidas();
    if (!colunas.length || !estado.todosDados.length) {
        mostrarToast('Adicione dados antes de exportar.', 'warning');
        return;
    }

    // Detecta coluna de agrupamento automático (categoria/produto)
    const colGrupo = colunas.find(c => /categoria|category|\btipo\b|\bgrupo\b|produto|product/i.test(c));
    let sugestoesAbas = [];

    if (colGrupo) {
        const grupos = [...new Set(estado.todosDados.map(l => String(l[colGrupo] || '').trim()).filter(Boolean))];
        sugestoesAbas = grupos.slice(0, 10).map(grupo => ({ nome: grupo, filtroCol: colGrupo, filtroVal: grupo }));
    }

    // Sempre adiciona aba com todos os dados
    sugestoesAbas.unshift({ nome: 'Todos os Dados', filtroCol: null, filtroVal: null });

    _exportAbas = sugestoesAbas;
    renderizarAbasExport();
    document.getElementById('modalExportMulti').style.display = 'flex';
}

function renderizarAbasExport() {
    const lista = document.getElementById('exportAbasList');
    if (!lista) return;
    lista.innerHTML = _exportAbas.map((aba, i) => `
        <div class="export-aba-row">
            <i class="fa-solid fa-table" style="color:#1f7e3d;"></i>
            <input class="export-aba-nome" type="text" value="${escapeHtml(aba.nome)}"
                   onchange="_exportAbas[${i}].nome = this.value" placeholder="Nome da aba">
            <span class="export-aba-coluna">
                ${aba.filtroVal ? `Filtro: ${escapeHtml(aba.filtroVal)}` : 'Todos os dados'}
            </span>
            <button class="botao botao--delet" style="padding:4px 8px; font-size:12px;"
                    onclick="_exportAbas.splice(${i},1); renderizarAbasExport();">✕</button>
        </div>
    `).join('') || '<p style="color:var(--suave); text-align:center;">Nenhuma aba configurada.</p>';
}

function adicionarAbaExport() {
    _exportAbas.push({ nome: `Aba ${_exportAbas.length + 1}`, filtroCol: null, filtroVal: null });
    renderizarAbasExport();
}

function confirmarExportMulti() {
    if (typeof XLSX === 'undefined') {
        mostrarToast('Biblioteca de exportação não carregada.', 'error');
        return;
    }
    if (!_exportAbas.length) {
        mostrarToast('Adicione pelo menos uma aba.', 'warning');
        return;
    }

    const colunas = obterColunasValidas();
    const wb = XLSX.utils.book_new();

    _exportAbas.forEach(aba => {
        let dados;
        if (aba.filtroCol && aba.filtroVal) {
            dados = estado.todosDados.filter(l =>
                String(l[aba.filtroCol] || '').trim() === aba.filtroVal
            );
        } else {
            dados = estado.todosDados;
        }

        const rows = dados.map(linha => {
            const obj = {};
            colunas.forEach(col => obj[col] = linha[col] ?? '');
            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(rows, { header: colunas });
        // Nome de aba Excel: máximo 31 caracteres, sem caracteres inválidos
        const nomeAba = (aba.nome || 'Aba').replace(/[:\\\/\?\*\[\]]/g, '').slice(0, 31) || 'Aba';
        XLSX.utils.book_append_sheet(wb, ws, nomeAba);
    });

    const nome = `DataInsight_MultiAbas_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nome);
    document.getElementById('modalExportMulti').style.display = 'none';
    mostrarToast(`Excel exportado com ${_exportAbas.length} aba(s)!`, 'success');
}

// ───────────────────────────────
// HISTÓRICO DE AUTOCOMPLETE
// ───────────────────────────────
function _detectarColuna(colunas, padroes, excluir = []) {
    for (const col of colunas) {
        const cn = col.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (excluir.some(ex => new RegExp(ex, 'i').test(cn))) continue;
        if (padroes.some(p => new RegExp(p, 'i').test(cn))) return col;
    }
    return null;
}

async function _salvarProdutosNoHistorico(colunas, dados) {
    const colProduto = _detectarColuna(colunas, ['produto','product','\\bitem\\b','\\bnome\\b','\\bname\\b','mercadoria','descri']);
    if (!colProduto) return;
    const colPreco    = _detectarColuna(colunas, ['pre[cç]o','\\bpreco\\b','\\bvalor\\b','\\bprice\\b','unit'], ['total','faturamento','receita','custo','despesa','lucro']);
    let colEstoque    = _detectarColuna(colunas, ['estoque','\\bstock\\b']);
    if (!colEstoque && !colunas.some(c => /estoque|\bstock\b/i.test(c))) {
        colEstoque = _detectarColuna(colunas, ['quantidade','\\bqtd\\b','\\bquant\\b','\\bamount\\b']);
    }
    const colDesconto  = _detectarColuna(colunas, ['desconto','discount','\\bdesc\\b']);
    const colCategoria = _detectarColuna(colunas, ['categoria','category','\\btipo\\b','\\bgrupo\\b']);
    const colSku       = _detectarColuna(colunas, ['\\bsku\\b','c[oó]digo','\\bcod\\b','\\bcode\\b','\\bref\\b']);

    const parseN = v => { const n = parseFloat(String(v ?? '').replace(',','.')); return isNaN(n) ? null : n; };
    let salvos = 0;
    for (const linha of dados) {
        const nome = String(linha[colProduto] ?? '').trim();
        if (!nome) continue;
        try {
            await fetch('/api/produtos/salvar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome_produto: nome,
                    categoria:  colCategoria ? (String(linha[colCategoria] ?? '').trim() || null) : null,
                    preco:      colPreco     ? parseN(linha[colPreco])    : null,
                    estoque:    colEstoque   ? (r => r !== null ? Math.round(r) : null)(parseN(linha[colEstoque])) : null,
                    sku:        colSku       ? (String(linha[colSku] ?? '').trim() || null) : null,
                    descricao:  colDesconto  ? `Desconto: ${parseN(linha[colDesconto])}` : null
                })
            });
            salvos++;
        } catch (e) { console.warn('Aviso ao salvar produto:', e); }
    }
    if (salvos > 0) console.log(`✅ ${salvos} produto(s) salvos no histórico`);
}

// ───────────────────────────────
// CARREGAR DADOS INICIAIS
// ───────────────────────────────
async function carregarDadosIniciais() {
    try {
        const r = await fetch('/carregar-dados');
        const data = await r.json();
        if (data && Array.isArray(data.colunas) && data.colunas.length > 0 && Array.isArray(data.dados)) {
            preencherTabela(data.colunas, data.dados);
            return;
        }
    } catch (e) {
        console.log('Nenhum dado anterior encontrado:', e.message);
    }
    inicializarTabelaPadrao();
}

function inicializarTabelaPadrao() {
    const padrao = ['Faturamento', 'Despesas', 'Lucro', 'Período'];
    estado.colunasAtuais = [...padrao];
    estado.todosDados = [criarLinhaVazia(padrao)];
    estado.paginaAtual = 1;
    renderizarColunas();
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
    atualizarBotoesUndoRedo();
    mostrarStatusAutomacao('Tabela pronta. Insira seus dados e a automação calculará automaticamente.', 'info');
}

// ───────────────────────────────
// INIT
// ───────────────────────────────
function init() {
    inicializarElementos();
    configurarEventListeners();
    atualizarBotoesUndoRedo();
    carregarDadosIniciais();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
