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
    colunasAtuais: [],
    tipoArquivo: null,
    elementos: {}
};

// ===============================
// INICIALIZAÇÃO
// ===============================
function inicializarElementos() {
    const elementosMap = {
        uploadArquivo: 'uploadArquivo',
        btnLimparUpload: 'btnLimparUpload',
        uploadStatus: 'uploadStatus',
        uploadError: 'uploadError',
        nomeArquivo: 'nomeArquivo',
        mensagemErro: 'mensagemErro',
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
        contadorResultadosBusca: 'contadorResultadosBusca'
    };

    for (const [key, id] of Object.entries(elementosMap)) {
        const elemento = document.getElementById(id);
        if (elemento) {
            estado.elementos[key] = elemento;
        }
    }

    // Referência ao thead
    const tabela = estado.elementos.tabelaDados;
    if (tabela) {
        const thead = tabela.querySelector('thead tr');
        if (thead) {
            estado.elementos.thead = thead;
        }
    }
}

function configurarEventListeners() {
    // Upload de arquivo
    if (estado.elementos.uploadArquivo) {
        estado.elementos.uploadArquivo.addEventListener('change', handleUpload);
    }

    // Limpar dados
    if (estado.elementos.btnLimparUpload) {
        estado.elementos.btnLimparUpload.addEventListener('click', handleLimparDados);
    }

    // Cards de tipo de arquivo
    const cards = document.querySelectorAll('.card-upload');
    cards.forEach(card => {
        card.addEventListener('click', () => selecionarTipoArquivo(card));
        adicionarEfeitoHover(card);
    });

    // Botões de ação
    if (estado.elementos.btnAdicionarColuna) {
        estado.elementos.btnAdicionarColuna.addEventListener('click', adicionarNovaColuna);
    }

    if (estado.elementos.btnAdicionarLinha) {
        estado.elementos.btnAdicionarLinha.addEventListener('click', adicionarNovaLinha);
    }

    if (estado.elementos.btnSalvarDados) {
        estado.elementos.btnSalvarDados.addEventListener('click', salvarDados);
    }

    if (estado.elementos.btnVoltar) {
        estado.elementos.btnVoltar.addEventListener('click', paginaAnterior);
    }

    if (estado.elementos.btnProximo) {
        estado.elementos.btnProximo.addEventListener('click', paginaProxima);
    }

    // Botão de solicitar exclusão (pode não existir)
    const btnSolicitarExclusao = document.getElementById('btnSolicitarExclusao');
    if (btnSolicitarExclusao) {
        btnSolicitarExclusao.addEventListener('click', solicitarExclusaoDados);
        estado.elementos.btnSolicitarExclusao = btnSolicitarExclusao;
    }

    // Status de exclusão (pode não existir)
    const statusExclusao = document.getElementById('statusExclusao');
    if (statusExclusao) {
        estado.elementos.statusExclusao = statusExclusao;
    }

    // Eventos delegados
    if (estado.elementos.colunasContainer) {
        estado.elementos.colunasContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('botao-remover-coluna')) {
                removerColuna(e);
            }
        });
    }

    if (estado.elementos.dadosTbody) {
        estado.elementos.dadosTbody.addEventListener('input', (e) => {
            if (e.target.classList.contains('entrada-linha')) {
                atualizarCelula(e);
            }
        });

        estado.elementos.dadosTbody.addEventListener('click', (e) => {
            if (e.target.textContent === 'Deletar' || e.target.closest('.botao-acao-planilha')) {
                deletarLinha(e);
            }
        });

        // Adicionar navegação por teclado (estilo Excel)
        estado.elementos.dadosTbody.addEventListener('keydown', handleKeyboardNavigation);
    }

    // Busca na tabela
    if (estado.elementos.inputBuscaTabela) {
        estado.elementos.inputBuscaTabela.addEventListener('input', debounce(handleBuscaTabela, 300));
    }
}

function handleKeyboardNavigation(e) {
    if (!e.target.classList.contains('entrada-linha')) return;

    const currentCell = e.target.closest('td');
    const currentRow = e.target.closest('tr');
    
    // Find index of cell in the row
    const cells = Array.from(currentRow.querySelectorAll('td'));
    const cellIndex = cells.indexOf(currentCell);

    // Find index of row in the tbody
    const tbody = currentRow.closest('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const rowIndex = rows.indexOf(currentRow);

    let targetRowIndex = rowIndex;
    let targetCellIndex = cellIndex;

    if (e.key === 'ArrowUp') {
        targetRowIndex = rowIndex - 1;
        e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
        targetRowIndex = rowIndex + 1;
        e.preventDefault();
        
        // Auto-add row if at the end
        if (targetRowIndex >= rows.length) {
            // Only add if it's the last page or we're creating new data
            adicionarNovaLinha();
            
            // Focus on the newly created row
            setTimeout(() => {
                const newRows = Array.from(tbody.querySelectorAll('tr'));
                if (newRows[targetRowIndex]) {
                    const targetCells = Array.from(newRows[targetRowIndex].querySelectorAll('td'));
                    if (targetCells[cellIndex]) {
                        const targetInput = targetCells[cellIndex].querySelector('.entrada-linha');
                        if (targetInput) targetInput.focus();
                    }
                }
            }, 50);
            return;
        }
    } else if (e.key === 'ArrowLeft') {
        if (e.target.selectionStart === 0) {
           targetCellIndex = cellIndex - 1;
           e.preventDefault();
        } else return;
    } else if (e.key === 'ArrowRight') {
        if (e.target.selectionEnd === e.target.value.length) {
            targetCellIndex = cellIndex + 1;
            e.preventDefault();
        } else return;
    } else {
        return; // Other keys do nothing
    }

    if (targetRowIndex >= 0 && targetRowIndex < rows.length) {
        const targetRow = rows[targetRowIndex];
        const targetCells = Array.from(targetRow.querySelectorAll('td'));
        if (targetCellIndex > 0 && targetCellIndex < targetCells.length - 1) { // Skip row number and action
            const targetInput = targetCells[targetCellIndex].querySelector('.entrada-linha');
            if (targetInput) {
                targetInput.focus();
                
                // Select text for easy overriding like Excel
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                    targetInput.select();
                }
            }
        }
    }
}

function adicionarEfeitoHover(elemento) {
    elemento.addEventListener('mouseenter', () => {
        elemento.style.transform = 'translateY(-4px)';
        elemento.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    });

    elemento.addEventListener('mouseleave', () => {
        elemento.style.transform = 'translateY(0)';
        elemento.style.boxShadow = 'none';
    });
}

// ===============================
// FUNÇÕES DE UPLOAD
// ===============================
function selecionarTipoArquivo(card) {
    estado.tipoArquivo = card.dataset.type;
    if (estado.elementos.uploadArquivo) {
        estado.elementos.uploadArquivo.click();
    }
}

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!validarArquivo(file)) return;

    // Atualizar nome do arquivo se o elemento existir
    if (estado.elementos.nomeArquivo) {
        estado.elementos.nomeArquivo.textContent = file.name;
    }

    mostrarMensagem('sucesso', '⏳ Processando arquivo...');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const data = await response.json();

        if (!response.ok) throw new Error(data.mensagem || 'Erro ao enviar arquivo');

        mostrarMensagem('sucesso', `✓ ${data.mensagem}`);
        preencherTabela(data.colunas, data.dados);
        
        // Abrir modal de mapeamento após upload bem-sucedido
        if (data.colunas && data.colunas.length > 0) {
            if (typeof abrirModalMapeamento === 'function') {
                setTimeout(() => abrirModalMapeamento(data.colunas), 1000);
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('erro', `✗ ${error.message}`);
    }
}

function validarArquivo(file) {
    if (!estado.tipoArquivo) {
        mostrarMensagem('erro', 'Selecione um tipo de arquivo primeiro!');
        return false;
    }

    const extensoesValidas = CONFIG.EXTENSOES_VALIDAS[estado.tipoArquivo] || [];
    const extensao = '.' + file.name.split('.').pop().toLowerCase();

    if (!extensoesValidas.includes(extensao)) {
        mostrarMensagem('erro', `Arquivo inválido! Esperado: ${extensoesValidas.map(e => e.toUpperCase()).join(', ')}`);
        return false;
    }

    return true;
}

// ===============================
// FUNÇÕES DE UI
// ===============================
function mostrarMensagem(tipo, texto) {
    const status = estado.elementos.uploadStatus;
    const erro = estado.elementos.uploadError;
    const mensagem = estado.elementos.mensagemErro;
    const nomeArquivo = estado.elementos.nomeArquivo;

    if (tipo === 'sucesso') {
        if (status) status.style.display = 'block';
        if (erro) erro.style.display = 'none';
        if (nomeArquivo && texto !== '⏳ Processando arquivo...') {
            nomeArquivo.textContent = texto;
        }
    } else if (tipo === 'erro') {
        if (status) status.style.display = 'none';
        if (erro) erro.style.display = 'block';
        if (mensagem) mensagem.textContent = texto;
    }
}

function limparUI() {
    if (estado.elementos.colunasContainer) {
        estado.elementos.colunasContainer.innerHTML = '';
    }
    if (estado.elementos.thead) {
        estado.elementos.thead.innerHTML = '';
    }
    if (estado.elementos.dadosTbody) {
        estado.elementos.dadosTbody.innerHTML = '';
    }
    if (estado.elementos.uploadStatus) {
        estado.elementos.uploadStatus.style.display = 'none';
    }
    if (estado.elementos.uploadError) {
        estado.elementos.uploadError.style.display = 'none';
    }
    if (estado.elementos.uploadArquivo) {
        estado.elementos.uploadArquivo.value = '';
    }

    estado.tipoArquivo = null;
}

// ===============================
// FUNÇÕES DA TABELA
// ===============================
function preencherTabela(colunas, dados) {
    if (!colunas || !dados) return;

    estado.colunasAtuais = [...colunas];
    estado.todosDados = dados.map(linha => {
        const novaLinha = {};
        colunas.forEach(col => novaLinha[col] = linha[col] ?? '');
        return novaLinha;
    });
    estado.paginaAtual = 1;

    renderizarColunas();
    atualizarTabela();
    exibirPagina();
    atualizarPaginacao();
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
        container.appendChild(div);
    });
}

function atualizarTabela() {
    const thead = estado.elementos.thead;
    if (!thead) return;

    const colunas = obterColunasValidas();
    if (colunas.length === 0) {
        thead.innerHTML = '';
        return;
    }

    thead.innerHTML = `
        <th style="width: 50px; text-align: center;">#</th>
        ${colunas.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
        <th style="width: 80px; text-align: center;">Ação</th>
    `;
}

function exibirPagina() {
    const tbody = estado.elementos.dadosTbody;
    if (!tbody) return;

    const colunas = obterColunasValidas();
    if (colunas.length === 0 || estado.todosDados.length === 0) {
        tbody.innerHTML = '';
        return;
    }

    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const dadosPagina = estado.todosDados.slice(inicio, inicio + CONFIG.LINHAS_POR_PAGINA);
    
    // Obter termo de busca atual para manter destaques durante a paginação
    const termoBusca = estado.elementos.inputBuscaTabela ? estado.elementos.inputBuscaTabela.value.toLowerCase().trim() : '';

    if (dadosPagina.length === 0) {
        tbody.innerHTML = '';
        return;
    }

    tbody.innerHTML = dadosPagina.map((linha, i) => {
        const numeroLinha = inicio + i + 1;
        const celulas = colunas.map(col => {
            const valor = linha[col] ?? '';
            const ehDestaque = termoBusca && String(valor).toLowerCase().includes(termoBusca);
            const classeDestaque = ehDestaque ? 'celula-destaque' : '';
            
            return `
                <td>
                    <input type="text" class="entrada-linha ${classeDestaque}" value="${escapeHtml(valor)}" placeholder="Digite...">
                </td>
            `;
        }).join('');

        return `
            <tr class="linha-dados">
                <td class="row-number">${numeroLinha}</td>
                ${celulas}
                <td class="action-cell">
                    <button class="botao-acao-planilha" type="button" title="Deletar linha"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// ===============================
// MANIPULAÇÃO DE DADOS
// ===============================
function obterColunasValidas() {
    const inputs = document.querySelectorAll('.entrada-coluna');
    return Array.from(inputs)
        .map(input => input.value.trim())
        .filter(valor => valor !== '');
}

function sincronizarColunas() {
    const novasColunas = obterColunasValidas();
    estado.todosDados = estado.todosDados.map(linha => {
        const novaLinha = {};
        novasColunas.forEach(col => novaLinha[col] = linha[col] ?? '');
        return novaLinha;
    });
    estado.colunasAtuais = [...novasColunas];
}

function adicionarNovaColuna() {
    const container = estado.elementos.colunasContainer;
    if (!container) return;

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
        });
    }

    sincronizarColunas();
    atualizarTabela();
    exibirPagina();
}

function removerColuna(event) {
    const colunaDiv = event.target.closest('div');
    if (colunaDiv) {
        colunaDiv.remove();
        sincronizarColunas();
        atualizarTabela();
        exibirPagina();
    }
}

function adicionarNovaLinha() {
    const colunas = obterColunasValidas();
    if (!colunas.length) {
        alert('Adicione pelo menos uma coluna com nome!');
        return;
    }

    const novaLinha = {};
    colunas.forEach(col => novaLinha[col] = '');
    estado.todosDados.push(novaLinha);
    estado.paginaAtual = Math.ceil(estado.todosDados.length / CONFIG.LINHAS_POR_PAGINA);
    exibirPagina();
    atualizarPaginacao();
}

function atualizarCelula(event) {
    const tr = event.target.closest('tr');
    if (!tr || !estado.elementos.dadosTbody) return;

    const colunas = obterColunasValidas();
    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const todasLinhas = Array.from(estado.elementos.dadosTbody.querySelectorAll('tr'));
    const indice = inicio + todasLinhas.indexOf(tr);
    const inputs = tr.querySelectorAll('.entrada-linha');

    if (estado.todosDados[indice] && inputs.length === colunas.length) {
        colunas.forEach((col, i) => {
            if (inputs[i]) {
                estado.todosDados[indice][col] = inputs[i].value ?? '';
            }
        });
    }
}

function deletarLinha(event) {
    const tr = event.target.closest('tr');
    if (!tr || !estado.elementos.dadosTbody) return;

    const inicio = (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA;
    const todasLinhas = Array.from(estado.elementos.dadosTbody.querySelectorAll('tr'));
    const indice = inicio + todasLinhas.indexOf(tr);

    if (indice >= 0 && indice < estado.todosDados.length) {
        estado.todosDados.splice(indice, 1);
        const totalPaginas = Math.ceil(estado.todosDados.length / CONFIG.LINHAS_POR_PAGINA);
        estado.paginaAtual = Math.max(1, Math.min(estado.paginaAtual, totalPaginas || 1));
        exibirPagina();
        atualizarPaginacao();
    }
}

// ===============================
// PAGINAÇÃO
// ===============================
function atualizarPaginacao() {
    const total = estado.todosDados.length;
    const totalPag = Math.ceil(total / CONFIG.LINHAS_POR_PAGINA) || 1;
    const inicio = total > 0 ? (estado.paginaAtual - 1) * CONFIG.LINHAS_POR_PAGINA + 1 : 0;
    const fim = Math.min(estado.paginaAtual * CONFIG.LINHAS_POR_PAGINA, total);

    if (estado.elementos.inicioPag) {
        estado.elementos.inicioPag.textContent = inicio;
    }
    if (estado.elementos.fimPag) {
        estado.elementos.fimPag.textContent = fim;
    }
    if (estado.elementos.totalPag) {
        estado.elementos.totalPag.textContent = total;
    }
    if (estado.elementos.btnVoltar) {
        estado.elementos.btnVoltar.disabled = estado.paginaAtual <= 1;
    }
    if (estado.elementos.btnProximo) {
        estado.elementos.btnProximo.disabled = estado.paginaAtual >= totalPag;
    }
}

function paginaAnterior() {
    if (estado.paginaAtual > 1) {
        estado.paginaAtual--;
        exibirPagina();
        atualizarPaginacao();
    }
}

function paginaProxima() {
    const totalPaginas = Math.ceil(estado.todosDados.length / CONFIG.LINHAS_POR_PAGINA);
    if (estado.paginaAtual < totalPaginas) {
        estado.paginaAtual++;
        exibirPagina();
        atualizarPaginacao();
    }
}

// ===============================
// FUNÇÕES DE API
// ===============================
async function salvarDados() {
    const colunas = obterColunasValidas();

    if (!colunas.length) {
        alert('Adicione pelo menos uma coluna!');
        return;
    }

    if (!estado.todosDados.length) {
        alert('Adicione pelo menos uma linha!');
        return;
    }

    const dados = estado.todosDados.map(linha => {
        const obj = {};
        colunas.forEach(col => obj[col] = linha[col] ?? '');
        return obj;
    });

    try {
        const response = await fetch('/salvar-dados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                colunas: colunas,
                dados: dados,
                nome_planilha: `Planilha_${new Date().toISOString().split('T')[0]}`
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error();

        alert('✓ ' + data.mensagem);
        
        // Abrir modal de mapeamento após salvamento manual
        if (colunas && colunas.length > 0) {
            if (typeof abrirModalMapeamento === 'function') {
                setTimeout(() => abrirModalMapeamento(colunas), 500);
            }
        }

        // Não limpar a UI imediatamente para o usuário ver o mapeamento
        // limparUI(); 
        // estado.todosDados = [];
        // estado.colunasAtuais = [];
        // estado.paginaAtual = 1;
        atualizarPaginacao();
    } catch (error) {
        alert('✗ Erro ao salvar!');
    }
}

async function handleLimparDados() {
    try {
        const response = await fetch('/apagar-dados', { method: 'DELETE' });
        const data = await response.json();

        if (response.ok) {
            estado.todosDados = [];
            estado.colunasAtuais = [];
            estado.paginaAtual = 1;
            limparUI();
            atualizarPaginacao();
            console.log('Dados apagados com sucesso');
        }
    } catch (error) {
        console.error('Erro ao apagar dados:', error);
        alert('Erro ao apagar dados!');
    }
}

// ===============================
// EXCLUSÃO DE DADOS (Simplificada)
// ===============================
async function solicitarExclusaoDados() {
    // Verificar se o usuário confirma
    if (!confirm('Tem certeza que deseja APAGAR todos os seus dados? Você receberá um email de confirmação.')) {
        return;
    }

    // Encontrar ou criar elemento de status
    let statusDiv = estado.elementos.statusExclusao;
    if (!statusDiv) {
        // Criar elemento de status se não existir
        statusDiv = document.createElement('div');
        statusDiv.id = 'statusExclusao';
        statusDiv.style.marginTop = '10px';

        // Tentar encontrar onde inserir o status
        const btnExclusao = estado.elementos.btnSolicitarExclusao || document.getElementById('btnSolicitarExclusao');
        if (btnExclusao && btnExclusao.parentNode) {
            btnExclusao.parentNode.insertBefore(statusDiv, btnExclusao.nextSibling);
        } else {
            // Se não encontrar o botão, adicionar ao body
            document.body.appendChild(statusDiv);
        }
        estado.elementos.statusExclusao = statusDiv;
    }

    const btn = estado.elementos.btnSolicitarExclusao || document.getElementById('btnSolicitarExclusao');

    try {
        // Desabilitar botão se existir
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
        }

        const response = await fetch('/solicitar-exclusao-dados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        statusDiv.style.display = 'block';
        const isError = !response.ok;
        const color = isError ? '#dc2626' : '#16a34a';
        const icon = isError ? '✗' : '✓';

        statusDiv.innerHTML = `
            <div style="padding: 12px; border-radius: 6px; background: ${isError ? 'rgba(220, 38, 38, 0.1)' : 'rgba(22, 163, 74, 0.1)'}; border: 1px solid ${color};">
                <p style="color: ${color}; margin: 0;"><strong>${icon} ${isError ? 'Erro' : 'Sucesso'}:</strong> ${data.mensagem || (isError ? 'Falha na solicitação' : 'Solicitação enviada')}</p>
                ${!isError ? '<p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">Verifique seu email para confirmar a exclusão.</p>' : ''}
            </div>
        `;

        // Limpar status após 5 segundos em caso de sucesso
        if (!isError) {
            setTimeout(() => {
                if (statusDiv) {
                    statusDiv.style.display = 'none';
                }
            }, 5000);
        }
    } catch (error) {
        console.error('Erro na solicitação:', error);
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div style="padding: 12px; border-radius: 6px; background: rgba(220, 38, 38, 0.1); border: 1px solid #dc2626;">
                <p style="color: #dc2626; margin: 0;"><strong>✗ Erro:</strong> Erro ao processar solicitação</p>
            </div>
        `;
    } finally {
        // Reabilitar botão se existir
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-trash"></i> Solicitar Exclusão de Dados';
        }
    }
}

// ===============================
// CARREGAR DADOS INICIAIS
// ===============================
async function carregarDadosIniciais() {
    try {
        const response = await fetch('/carregar-dados');
        const data = await response.json();

        if (data && data.colunas && Array.isArray(data.colunas) && data.colunas.length > 0 &&
            data.dados && Array.isArray(data.dados)) {
            preencherTabela(data.colunas, data.dados);
        }
    } catch (error) {
        console.log('Nenhum dado anterior encontrado ou erro ao carregar:', error.message);
    }
}

// ===============================
// UTILITÁRIOS
// ===============================
function escapeHtml(texto) {
    if (!texto) return '';
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ===============================
// BUSCA NA TABELA COM ANIMAÇÃO
// ===============================
async function handleBuscaTabela(event) {
    const termo = event.target.value.toLowerCase().trim();
    const contador = estado.elementos.contadorResultadosBusca;

    if (!termo) {
        if (contador) contador.style.display = 'none';
        exibirPagina(); // Limpa destaques ao redesenhar
        return;
    }

    const colunas = obterColunasValidas();
    let indexEncontrado = -1;
    let totalEncontrados = 0;

    // Procura todos os registros que contenham o termo
    for (let i = 0; i < estado.todosDados.length; i++) {
        const linha = estado.todosDados[i];
        const encontrou = colunas.some(col => {
            const valor = String(linha[col] || '').toLowerCase();
            return valor.includes(termo);
        });

        if (encontrou) {
            if (indexEncontrado === -1) indexEncontrado = i;
            totalEncontrados++;
        }
    }

    // Atualizar contador
    if (contador) {
        contador.textContent = `${totalEncontrados} ${totalEncontrados === 1 ? 'res.' : 'res.'}`;
        contador.style.display = 'block';
        
        if (totalEncontrados === 0) {
            contador.style.color = '#dc2626'; // Vermelho se não encontrar nada
            contador.style.background = 'rgba(220, 38, 38, 0.1)';
        } else {
            contador.style.color = ''; // Resetar para o padrão do CSS
            contador.style.background = '';
        }
    }

    if (indexEncontrado !== -1) {
        const paginaAlvo = Math.floor(indexEncontrado / CONFIG.LINHAS_POR_PAGINA) + 1;
        
        if (paginaAlvo !== estado.paginaAtual) {
            await navegarAtePagina(paginaAlvo);
        } else {
            exibirPagina(); // Já está na página, apenas destaca
        }
    } else {
        exibirPagina(); // Não encontrou nada, limpa destaques anteriores
    }
}

async function navegarAtePagina(alvo) {
    return new Promise((resolve) => {
        const direcao = alvo > estado.paginaAtual ? 1 : -1;
        
        const intervalo = setInterval(() => {
            if (estado.paginaAtual === alvo) {
                clearInterval(intervalo);
                resolve();
            } else {
                if (direcao === 1) {
                    paginaProxima();
                } else {
                    paginaAnterior();
                }
            }
        }, 150); // Velocidade da animação (150ms por página)
    });
}

function removerDestaques() {
    exibirPagina();
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===============================
// INICIALIZAÇÃO
// ===============================
function init() {
    inicializarElementos();
    configurarEventListeners();
    carregarDadosIniciais();
}

// Aguardar o DOM estar completamente carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}