document.addEventListener('DOMContentLoaded', () => {
    const messagesDiv = document.getElementById('chat-messages');
    const streamInner = document.getElementById('chat-stream-inner');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    let currentSessionId = sessionStorage.getItem('chatbotSessionId') || localStorage.getItem('chatbotSessionId') || Date.now().toString();
    sessionStorage.setItem('chatbotSessionId', currentSessionId);
    localStorage.setItem('chatbotSessionId', currentSessionId);

    let tabelaIaAtualId = 'todas';
    let agenteAtual = 'smart';
    let ferramentaAtual = null;
    let arquivoAnexadoAtual = null;

    const attachBtn = document.getElementById('copilot-attach-btn');
    const fileInput = document.getElementById('copilot-file-input');
    const attachmentBar = document.getElementById('copilot-attachment-bar');
    const attachmentBarThumb = document.getElementById('attachment-bar-thumb');
    const attachmentImgPreview = document.getElementById('attachment-img-preview');
    const attachmentBarIcon = document.getElementById('attachment-bar-icon');
    const attachmentBarName = document.getElementById('attachment-bar-name');
    const attachmentBarSize = document.getElementById('attachment-bar-size');
    const attachmentBarType = document.getElementById('attachment-bar-type');
    const attachmentBarRemove = document.getElementById('attachment-bar-remove');
    const copilotPillBox = document.getElementById('copilot-pill-box');

    // ==================== SELETOR DE PLANILHA ====================
    async function configurarSeletorPlanilhaIa() {
        const select = document.getElementById('seletorPlanilhaIa');
        if (!select) return;
        try {
            const resp = await fetch('/api/planilhas/sumario');
            if (!resp.ok) return;
            const json = await resp.json();
            const planilhas = json.planilhas || [];
            select.innerHTML = '';
            const optTodas = document.createElement('option');
            optTodas.value = 'todas';
            optTodas.textContent = `🌐 Todas as Planilhas (${planilhas.length})`;
            select.appendChild(optTodas);
            planilhas.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                const icone = p.tipo_fluxo === 'saida' ? '🔻' : (p.tipo_fluxo === 'entrada' ? '🟢' : '📁');
                opt.textContent = `${icone} [${p.dominio_label}] ${p.nome}`;
                select.appendChild(opt);
            });
            const salva = localStorage.getItem('DataInsight_DashboardPlanilha');
            if (salva && (salva === 'todas' || planilhas.some(p => p.id === salva))) {
                select.value = salva;
                tabelaIaAtualId = salva;
            }
            select.addEventListener('change', e => {
                tabelaIaAtualId = e.target.value;
                localStorage.setItem('DataInsight_DashboardPlanilha', tabelaIaAtualId);
            });
        } catch (e) {
            console.warn('Aviso ao carregar planilhas na IA:', e);
        }
    }
    configurarSeletorPlanilhaIa();

    const CHATBOT_OPEN_KEY = 'chatbotOpen';
    const CHATBOT_MESSAGES_KEY = 'chatbotMessages';
    const CHATBOT_SESSION_KEY = 'chatbotSessionId';
    const CHATBOT_TRANSITION_DONE_KEY = 'chatbotIaTransitionDone';

    // ==================== TELA CHEIA ====================
    const pageContainer = document.querySelector('.page-ia-container');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnFullscreenSidebar = document.getElementById('btn-fullscreen-sidebar');
    const btnExitFullscreen = document.getElementById('btn-exit-fullscreen');
    const btnFloatingExitFullscreen = document.getElementById('btn-floating-exit-fullscreen');

    function entrarTelaCheia() {
        if (!pageContainer) return;
        pageContainer.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
        if (btnExitFullscreen) btnExitFullscreen.style.display = 'flex';
        if (btnFloatingExitFullscreen) btnFloatingExitFullscreen.style.display = 'inline-flex';
        // Rolar o chat para o fim automaticamente ao expandir
        setTimeout(() => {
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }, 100);
    }

    function sairTelaCheia() {
        if (!pageContainer) return;
        pageContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
        if (btnExitFullscreen) btnExitFullscreen.style.display = 'none';
        if (btnFloatingExitFullscreen) btnFloatingExitFullscreen.style.display = 'none';
    }

    if (btnFullscreen) btnFullscreen.addEventListener('click', entrarTelaCheia);
    if (btnFullscreenSidebar) btnFullscreenSidebar.addEventListener('click', entrarTelaCheia);
    if (btnExitFullscreen) btnExitFullscreen.addEventListener('click', sairTelaCheia);
    if (btnFloatingExitFullscreen) btnFloatingExitFullscreen.addEventListener('click', sairTelaCheia);

    // Permitir sair via tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (pageContainer && pageContainer.classList.contains('fullscreen')) {
                sairTelaCheia();
            }
        }
    });

    window.entrarTelaCheiaIa = entrarTelaCheia;
    window.sairTelaCheiaIa = sairTelaCheia;

    // ==================== SIDEBAR TOGGLE ====================
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const chatSidebar = document.getElementById('chat-sidebar');
    if (sidebarToggleBtn && chatSidebar) {
        sidebarToggleBtn.addEventListener('click', () => {
            chatSidebar.classList.toggle('collapsed');
        });
    }

    // ==================== SELETOR DE AGENTES ====================
    const agentSelectorBtn = document.getElementById('agent-selector-btn');
    const agentDropdown = document.getElementById('agent-dropdown-menu');
    const agentIconPill = document.getElementById('agent-icon-pill');
    const agentLabelPill = document.getElementById('agent-label-pill');

    if (agentSelectorBtn && agentDropdown) {
        agentSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            agentDropdown.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!agentSelectorBtn.contains(e.target) && !agentDropdown.contains(e.target)) {
                agentDropdown.classList.remove('open');
            }
        });

        agentDropdown.querySelectorAll('.agent-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                agentDropdown.querySelectorAll('.agent-menu-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                agenteAtual = item.dataset.agent;
                const icon = item.dataset.icon;
                const label = item.dataset.label;
                const color = item.dataset.color;
                if (agentIconPill) {
                    agentIconPill.className = `fa-solid ${icon}`;
                    agentIconPill.style.color = color;
                }
                if (agentLabelPill) agentLabelPill.textContent = label;
                agentDropdown.classList.remove('open');
            });
        });
    }

    // ==================== FERRAMENTAS RÁPIDAS (PILLS) ====================
    document.querySelectorAll('.copilot-tool-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const prompt = pill.dataset.prompt;
            const tool = pill.dataset.tool || null;
            if (prompt && input) {
                input.value = prompt;
                ferramentaAtual = tool;
                autoResizeTextarea();
                input.focus();
            }
        });
    });

    // ==================== TEXTAREA AUTO RESIZE ====================
    function autoResizeTextarea() {
        if (!input) return;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    }
    if (input) {
        input.addEventListener('input', autoResizeTextarea);
    }

    // ==================== MICROFONE (Web Speech API) ====================
    const micBtn = document.getElementById('copilot-mic-btn');
    let isRecording = false;
    if (micBtn && 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (input) { input.value = transcript; autoResizeTextarea(); }
        };
        recognition.onend = () => {
            isRecording = false;
            if (micBtn) { micBtn.style.color = ''; micBtn.title = 'Ditado por voz'; }
        };
        recognition.onerror = () => {
            isRecording = false;
            if (micBtn) micBtn.style.color = '';
        };

        if (micBtn) {
            micBtn.addEventListener('click', () => {
                if (isRecording) {
                    recognition.stop();
                } else {
                    recognition.start();
                    isRecording = true;
                    micBtn.style.color = '#ef4444';
                    micBtn.title = 'Clique para parar';
                }
            });
        }
    }

    // ==================== SONS DO CHAT (WEB AUDIO API) ====================
    let _audioCtx = null;
    function getAudioContext() {
        if (!_audioCtx) {
            const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
            if (AudioCtxClass) {
                _audioCtx = new AudioCtxClass();
            }
        }
        if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume().catch(() => {});
        }
        return _audioCtx;
    }

    // Retoma AudioContext na primeira interação com a página (política de navegadores)
    function desbloquearAudioContext() {
        if (_audioCtx && _audioCtx.state === 'suspended') {
            _audioCtx.resume().catch(() => {});
        }
    }
    document.addEventListener('click', desbloquearAudioContext, { once: true, passive: true });
    document.addEventListener('keydown', desbloquearAudioContext, { once: true, passive: true });

    let chatSoundMuted = localStorage.getItem('copilotChatSoundMuted') === 'true';

    function atualizarBotaoSom() {
        const soundBtn = document.getElementById('copilot-sound-btn');
        if (!soundBtn) return;
        if (chatSoundMuted) {
            soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
            soundBtn.title = 'Sons de mensagem: Silenciados (Clique para ativar)';
            soundBtn.style.color = '#94a3b8';
            soundBtn.style.opacity = '0.6';
        } else {
            soundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            soundBtn.title = 'Sons de mensagem: Ativados (Clique para silenciar)';
            soundBtn.style.color = '';
            soundBtn.style.opacity = '';
        }
    }

    const soundToggleBtn = document.getElementById('copilot-sound-btn');
    if (soundToggleBtn) {
        atualizarBotaoSom();
        soundToggleBtn.addEventListener('click', () => {
            chatSoundMuted = !chatSoundMuted;
            localStorage.setItem('copilotChatSoundMuted', chatSoundMuted ? 'true' : 'false');
            atualizarBotaoSom();
            if (!chatSoundMuted) {
                tocarSomBolhaEnvio();
            }
        });
    }

    // Som de bolha líquida ao enviar mensagem (efeito pop/bloop com sweep de frequência)
    function tocarSomBolhaEnvio() {
        if (chatSoundMuted) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            // Oscilador 1: Varredura de frequência de bolha d'água (360Hz -> 960Hz)
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(960, now + 0.085);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.32, now + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.12);

            // Oscilador 2: Pop harmônico de fechamento da bolha (820Hz -> 1420Hz)
            const popOsc = ctx.createOscillator();
            const popGain = ctx.createGain();

            popOsc.type = 'sine';
            popOsc.frequency.setValueAtTime(820, now + 0.025);
            popOsc.frequency.exponentialRampToValueAtTime(1420, now + 0.08);

            popGain.gain.setValueAtTime(0.001, now + 0.025);
            popGain.gain.linearRampToValueAtTime(0.14, now + 0.04);
            popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

            popOsc.connect(popGain);
            popGain.connect(ctx.destination);

            popOsc.start(now + 0.025);
            popOsc.stop(now + 0.10);
        } catch (e) {
            console.warn('Erro ao reproduzir som de bolha:', e);
        }
    }

    // Som suave e futurista ao receber resposta da IA (campainha harmônica cristalina)
    function tocarSomRecebimentoIA() {
        if (chatSoundMuted) return;
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;

            // Nota 1: Tom suave quente (D5 ~ 587.33 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            osc1.frequency.exponentialRampToValueAtTime(630, now + 0.08);

            gain1.gain.setValueAtTime(0.001, now);
            gain1.gain.linearRampToValueAtTime(0.22, now + 0.015);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.26);

            // Nota 2: Arpeggio ascendente cristalino (A5 ~ 880 Hz -> B5 ~ 987.77 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, now + 0.07);
            osc2.frequency.exponentialRampToValueAtTime(987.77, now + 0.16);

            gain2.gain.setValueAtTime(0.001, now + 0.07);
            gain2.gain.linearRampToValueAtTime(0.26, now + 0.09);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.07);
            osc2.stop(now + 0.42);

            // Brilho harmônico sutil (E6 ~ 1318.5 Hz)
            const osc3 = ctx.createOscillator();
            const gain3 = ctx.createGain();
            osc3.type = 'triangle';
            osc3.frequency.setValueAtTime(1318.51, now + 0.08);

            gain3.gain.setValueAtTime(0.001, now + 0.08);
            gain3.gain.linearRampToValueAtTime(0.07, now + 0.10);
            gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

            osc3.connect(gain3);
            gain3.connect(ctx.destination);
            osc3.start(now + 0.08);
            osc3.stop(now + 0.30);
        } catch (e) {
            console.warn('Erro ao reproduzir som de resposta da IA:', e);
        }
    }

    window.tocarSomBolhaEnvio = tocarSomBolhaEnvio;
    window.tocarSomRecebimentoIA = tocarSomRecebimentoIA;

    // ==================== ANEXO DE ARQUIVOS (COPILOTO) ====================
    function formatarTamanhoBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function obterIconeArquivo(nome, tipo) {
        const ext = (nome || '').split('.').pop().toLowerCase();
        const tipoLower = (tipo || '').toLowerCase();
        if (tipoLower.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
            return { icon: 'fa-solid fa-file-image', color: '#3B82F6', badge: 'IMG', isImage: true };
        }
        if (ext === 'pdf' || tipoLower === 'application/pdf') {
            return { icon: 'fa-solid fa-file-pdf', color: '#EF4444', badge: 'PDF', isImage: false };
        }
        if (['xlsx', 'xls'].includes(ext) || tipoLower.includes('spreadsheet') || tipoLower.includes('excel')) {
            return { icon: 'fa-solid fa-file-excel', color: '#10B981', badge: 'EXCEL', isImage: false };
        }
        if (ext === 'csv' || tipoLower.includes('csv')) {
            return { icon: 'fa-solid fa-file-csv', color: '#10B981', badge: 'CSV', isImage: false };
        }
        if (ext === 'json' || tipoLower.includes('json')) {
            return { icon: 'fa-solid fa-file-code', color: '#F59E0B', badge: 'JSON', isImage: false };
        }
        if (ext === 'xml' || tipoLower.includes('xml')) {
            return { icon: 'fa-solid fa-file-code', color: '#F59E0B', badge: 'XML', isImage: false };
        }
        return { icon: 'fa-solid fa-file-lines', color: '#64748B', badge: ext.toUpperCase() || 'TXT', isImage: false };
    }

    function processarArquivoSelecionado(file) {
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            alert('O arquivo selecionado é muito grande. O limite máximo é de 25 MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            const info = obterIconeArquivo(file.name, file.type);
            const tamanhoFmt = formatarTamanhoBytes(file.size);

            arquivoAnexadoAtual = {
                nome: file.name,
                tipo: file.type || 'application/octet-stream',
                tamanho: file.size,
                tamanho_fmt: tamanhoFmt,
                base64: dataUrl,
                previewUrl: info.isImage ? dataUrl : null
            };

            // Atualiza barra de prévia
            if (attachmentBar) {
                attachmentBar.style.display = 'block';
                if (attachmentBarName) attachmentBarName.textContent = file.name;
                if (attachmentBarSize) attachmentBarSize.textContent = tamanhoFmt;
                if (attachmentBarType) {
                    attachmentBarType.textContent = info.badge;
                    attachmentBarType.style.color = info.color;
                    attachmentBarType.style.background = `${info.color}1F`;
                }

                if (info.isImage && attachmentBarThumb && attachmentImgPreview) {
                    attachmentImgPreview.src = dataUrl;
                    attachmentBarThumb.style.display = 'flex';
                    if (attachmentBarIcon) attachmentBarIcon.style.display = 'none';
                } else if (attachmentBarIcon) {
                    attachmentBarIcon.innerHTML = `<i class="${info.icon}"></i>`;
                    attachmentBarIcon.style.color = info.color;
                    attachmentBarIcon.style.background = `${info.color}1F`;
                    attachmentBarIcon.style.display = 'flex';
                    if (attachmentBarThumb) attachmentBarThumb.style.display = 'none';
                }
            }

            if (attachBtn) {
                attachBtn.classList.add('has-file');
                const label = document.getElementById('copilot-attach-label');
                if (label) label.textContent = '1 Anexo';
            }

            if (input) {
                input.placeholder = 'Pergunte algo sobre o arquivo anexado ou envie para análise completa...';
                input.focus();
            }
        };
        reader.readAsDataURL(file);
    }

    function limparAnexo() {
        arquivoAnexadoAtual = null;
        if (fileInput) fileInput.value = '';
        if (attachmentBar) attachmentBar.style.display = 'none';
        if (attachBtn) {
            attachBtn.classList.remove('has-file');
            const label = document.getElementById('copilot-attach-label');
            if (label) label.textContent = 'Anexar';
        }
        if (input) {
            input.placeholder = 'Pergunte ao Copiloto IA... (Enter para enviar, Shift+Enter para nova linha)';
        }
    }

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                processarArquivoSelecionado(e.target.files[0]);
            }
        });
    }

    if (attachmentBarRemove) {
        attachmentBarRemove.addEventListener('click', (e) => {
            e.preventDefault();
            limparAnexo();
        });
    }

    // Drag & Drop na caixa do Copiloto
    if (copilotPillBox) {
        ['dragenter', 'dragover'].forEach(eventName => {
            copilotPillBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                copilotPillBox.classList.add('drag-active');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            copilotPillBox.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                copilotPillBox.classList.remove('drag-active');
            });
        });
        copilotPillBox.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processarArquivoSelecionado(e.dataTransfer.files[0]);
            }
        });
    }

    // ==================== GERAÇÃO & EXPORTAÇÃO DE DOCUMENTOS (CLAUDE STYLE) ====================
    async function dispararDownloadDocumento({ tipo, titulo, elemento, nomeArquivo }) {
        let conteudoHtml = '';
        let metadados = null;

        if (elemento) {
            const bodyContent = elemento.querySelector('.bot-msg-content');
            conteudoHtml = bodyContent ? bodyContent.innerHTML : elemento.innerHTML;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = conteudoHtml;
            tempDiv.querySelectorAll('.ia-document-artifact').forEach(a => a.remove());
            conteudoHtml = tempDiv.innerHTML;

            // Busca eventual anexo na mensagem de usuário correspondente
            let prev = elemento.previousElementSibling;
            while (prev) {
                if (prev.classList.contains('user')) {
                    const userAttachment = prev.querySelector('.attachment-filename');
                    if (userAttachment) {
                        const sizeEl = prev.querySelector('.attachment-size');
                        metadados = {
                            nome: userAttachment.innerText.trim(),
                            tamanho_fmt: sizeEl ? sizeEl.innerText.trim() : ''
                        };
                    }
                    break;
                }
                prev = prev.previousElementSibling;
            }
        }

        const payload = {
            tipo: tipo || 'pdf',
            titulo: titulo || 'Relatorio_DataInsight',
            conteudo_html: conteudoHtml,
            sessao_id: currentSessionId,
            metadados: metadados
        };

        const resp = await fetch('/api/chatbot/exportar-documento', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            throw new Error(`Falha ao gerar ${tipo.toUpperCase()} (HTTP ${resp.status})`);
        }

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = tipo === 'docx' ? 'docx' : (tipo === 'xlsx' ? 'xlsx' : 'pdf');
        a.download = nomeArquivo || `${(titulo || 'Relatorio_DataInsight').replace(/\s+/g, '_')}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    function renderizarArtefatosDeDocumento(container) {
        if (!container) return;
        const artifacts = container.querySelectorAll('.ia-document-artifact:not(.artifact-renderizado)');
        artifacts.forEach(card => {
            card.classList.add('artifact-renderizado');
            const tipo = (card.getAttribute('data-tipo') || 'pdf').toLowerCase();
            const rawTitulo = card.getAttribute('data-titulo') || 'Documento_DataInsight';
            const desc = card.getAttribute('data-desc') || 'Documento corporativo pronto para download';

            let iconClass = 'fa-file-pdf';
            let wrapClass = 'artifact-icon-pdf';
            let extLabel = 'PDF';

            if (tipo === 'docx' || tipo === 'word') {
                iconClass = 'fa-file-word';
                wrapClass = 'artifact-icon-docx';
                extLabel = 'DOCX';
            } else if (tipo === 'xlsx' || tipo === 'excel' || tipo === 'planilha') {
                iconClass = 'fa-file-excel';
                wrapClass = 'artifact-icon-xlsx';
                extLabel = 'XLSX';
            }

            const fileName = rawTitulo.toLowerCase().endsWith(`.${tipo}`) ? rawTitulo : `${rawTitulo}.${extLabel.toLowerCase()}`;

            card.innerHTML = `
                <div class="artifact-left">
                    <div class="artifact-icon-wrap ${wrapClass}">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="artifact-content">
                        <div class="artifact-title">${escapeHtml(fileName)}</div>
                        <div class="artifact-desc">
                            <span class="attachment-bar-badge" style="font-size:0.6rem;padding:0 4px;">${extLabel}</span>
                            <span>${escapeHtml(desc)}</span>
                        </div>
                    </div>
                </div>
                <button type="button" class="artifact-btn-download" title="Baixar ${extLabel}">
                    <i class="fa-solid fa-download"></i> <span>Baixar ${extLabel}</span>
                </button>
            `;

            const btnDownload = card.querySelector('.artifact-btn-download');
            btnDownload.addEventListener('click', async () => {
                btnDownload.classList.add('loading');
                btnDownload.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Gerando ${extLabel}...</span>`;
                try {
                    const msgPai = card.closest('.chat-msg') || container;
                    await dispararDownloadDocumento({
                        tipo: tipo,
                        titulo: rawTitulo,
                        elemento: msgPai,
                        nomeArquivo: fileName
                    });
                } catch (e) {
                    console.error('Erro ao baixar artefato:', e);
                    alert('Erro ao gerar documento: ' + e.message);
                } finally {
                    btnDownload.classList.remove('loading');
                    btnDownload.innerHTML = `<i class="fa-solid fa-check"></i> <span>Baixar Novamente</span>`;
                }
            });
        });
    }

    async function exportarConversaCompleta(tipo = 'pdf') {
        const btnHeader = document.getElementById('btn-chat-header-pdf');
        const btnSidebar = document.getElementById('btn-exportar-chat-pdf');

        if (btnHeader) btnHeader.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Gerando...</span>`;
        if (btnSidebar) {
            const span = btnSidebar.querySelector('.sidebar-hide-on-collapse') || btnSidebar.querySelector('span');
            if (span) span.textContent = 'Gerando PDF...';
        }

        try {
            const resp = await fetch('/api/chatbot/exportar-documento', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo: tipo,
                    conversa_completa: true,
                    titulo: `DataInsight_Conversa_${new Date().toISOString().slice(0, 10)}`,
                    sessao_id: currentSessionId
                })
            });

            if (!resp.ok) {
                throw new Error(`Falha no servidor (HTTP ${resp.status})`);
            }

            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DataInsight_Conversa_${currentSessionId.slice(-6)}.${tipo}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Falha ao exportar conversa:', err);
            alert('Não foi possível exportar a conversa: ' + err.message);
        } finally {
            if (btnHeader) btnHeader.innerHTML = `<i class="fa-solid fa-file-pdf"></i> <span>Exportar PDF</span>`;
            if (btnSidebar) {
                const span = btnSidebar.querySelector('.sidebar-hide-on-collapse') || btnSidebar.querySelector('span');
                if (span) span.textContent = 'Exportar Conversa (PDF)';
            }
        }
    }

    // Botões de exportação da conversa
    const btnHeaderExport = document.getElementById('btn-chat-header-pdf');
    if (btnHeaderExport) {
        btnHeaderExport.addEventListener('click', (e) => {
            e.preventDefault();
            exportarConversaCompleta('pdf');
        });
    }
    const btnSidebarExport = document.getElementById('btn-exportar-chat-pdf');
    if (btnSidebarExport) {
        btnSidebarExport.addEventListener('click', (e) => {
            e.preventDefault();
            exportarConversaCompleta('pdf');
        });
    }

    window.exportarConversaCompleta = exportarConversaCompleta;
    window.renderizarArtefatosDeDocumento = renderizarArtefatosDeDocumento;

    function renderizarGraficosDaMensagem() {
        const containers = document.querySelectorAll('.grafico-ia-render:not(.renderizado)');
        containers.forEach(container => {
            const periodo = container.getAttribute('data-periodo') || '30_dias';
            const tipoRaw = container.getAttribute('data-tipo') || 'linha';
            let tipoChart = 'area';
            if (tipoRaw === 'barras' || tipoRaw === 'barra') tipoChart = 'bar';
            if (tipoRaw === 'pizza') tipoChart = 'pie';
            const metricasRaw = container.getAttribute('data-metricas') || 'faturamento,lucro';
            const metricasFiltro = metricasRaw.split(',').map(m => m.trim().toLowerCase());
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> Gerando gráfico interativo...</div>';
            container.classList.add('renderizado');

            // Detectar tema atual
            const isDark = document.body.classList.contains('tema-escuro');
            const txtColor = isDark ? '#94a3b8' : '#6b7280';
            const bgBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
            const bgCard  = isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.8)';
            const legendColor = isDark ? '#e2e8f0' : '#374151';
            const themeMode = isDark ? 'dark' : 'light';
            container.style.cssText = `min-height:320px;border:1px solid ${bgBorder};border-radius:14px;padding:12px;margin:14px 0;background:${bgCard};`;

            fetch(`/api/graficos?periodo=${periodo}`)
                .then(res => res.json())
                .then(data => {
                    container.innerHTML = '';
                    let chartData, options;
                    if (tipoChart === 'pie') {
                        chartData = data.grafico_pizza;
                        if (!chartData || !chartData.labels || chartData.series.length === 0) {
                            container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;">Sem dados suficientes para este período.</p>';
                            return;
                        }
                        const indices = [];
                        chartData.labels.forEach((lbl, i) => {
                            const nome = lbl.toLowerCase();
                            if (metricasFiltro.some(m => nome.includes(m) || m.includes(nome)) || metricasFiltro.includes('todos')) indices.push(i);
                        });
                        options = {
                            chart: { type: 'pie', height: 300, background: 'transparent', foreColor: txtColor },
                            series: indices.map(i => chartData.series[i]),
                            labels: indices.map(i => chartData.labels[i]),
                            colors: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#7C3AED'],
                            legend: { show: true, position: 'right', labels: { colors: legendColor } },
                            dataLabels: { enabled: true },
                            theme: { mode: themeMode }
                        };
                    } else {
                        chartData = tipoChart === 'bar' ? data.grafico_barras : data.grafico_linha;
                        if (!chartData || !chartData.labels) {
                            container.innerHTML = '<p style="color:#64748b;text-align:center;padding:20px;">Sem dados suficientes para este período.</p>';
                            return;
                        }
                        let seriesFiltradas = chartData.series;
                        if (!metricasFiltro.includes('todos')) {
                            seriesFiltradas = chartData.series.filter(s => {
                                const nome = s.name.toLowerCase();
                                return metricasFiltro.some(m => nome.includes(m) || m.includes(nome));
                            });
                        }
                        options = {
                            chart: { type: tipoChart, height: 300, toolbar: { show: false }, background: 'transparent', foreColor: txtColor },
                            series: seriesFiltradas,
                            xaxis: { categories: chartData.labels, labels: { style: { colors: txtColor } } },
                            yaxis: { labels: { style: { colors: txtColor }, formatter: v => 'R$ ' + v.toLocaleString('pt-BR') } },
                            legend: { show: true, position: 'top', horizontalAlign: 'left', labels: { colors: legendColor } },
                            colors: ['#3B82F6', '#10B981', '#F59E0B'],
                            dataLabels: { enabled: false },
                            stroke: { curve: tipoChart === 'area' ? 'smooth' : 'straight', width: tipoChart === 'area' ? 2 : 0 },
                            fill: { type: tipoChart === 'area' ? 'gradient' : 'solid', gradient: { shadeIntensity: 0.1, opacityFrom: 0.3, opacityTo: 0 } },
                            grid: { borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)' },
                            theme: { mode: themeMode }
                        };
                    }
                    const chart = new ApexCharts(container, options);
                    chart.render();
                })
                .catch(err => {
                    console.error(err);
                    container.innerHTML = '<p style="color:#ef4444;padding:20px;text-align:center;">Erro ao gerar gráfico interativo.</p>';
                });
        });
    }

    // ==================== APPEND MESSAGE (NOVO DESIGN) ====================
    function appendMessage(texto, remetente, agenteInfo, anexoInfo) {
        const wrapper = streamInner || messagesDiv;
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${remetente}`;

        if (remetente === 'bot') {
            const agNome = (agenteInfo && agenteInfo.agente_nome) || 'Copiloto IA';
            const agIcone = (agenteInfo && agenteInfo.agente_icone) ? `fa-${agenteInfo.agente_icone}` : 'fa-robot';
            const agCor = (agenteInfo && agenteInfo.agente_cor) || '#3B82F6';

            const badge = `<div class="bot-header-badge" style="border-color:${agCor}33;color:${agCor};background:${agCor}14;">
                <i class="fa-solid ${agIcone}"></i> ${agNome}
            </div>`;

            const conteudo = texto;
            const actionBar = `<div class="bot-action-bar">
                <button class="bot-action-btn btn-thumbs-up" title="Útil"><i class="fa-regular fa-thumbs-up"></i></button>
                <button class="bot-action-btn btn-thumbs-down" title="Não útil"><i class="fa-regular fa-thumbs-down"></i></button>
                <button class="bot-action-btn btn-copy-msg" title="Copiar"><i class="fa-regular fa-copy"></i></button>
                <button class="bot-action-btn btn-speak-msg" title="Ouvir resposta"><i class="fa-solid fa-volume-high"></i></button>
                <button class="bot-action-btn btn-regen-msg" title="Regenerar resposta"><i class="fa-solid fa-rotate-right"></i></button>
                <span class="bot-action-sep" style="width:1px;height:12px;background:var(--copilot-border, rgba(255,255,255,0.15));margin:0 2px;"></span>
                <button class="bot-action-btn btn-export-pdf" title="Exportar esta resposta em PDF"><i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i></button>
                <button class="bot-action-btn btn-export-docx" title="Exportar esta resposta em Word (.docx)"><i class="fa-solid fa-file-word" style="color:#3b82f6;"></i></button>
                <button class="bot-action-btn btn-export-excel" title="Exportar dados/tabelas em Excel (.xlsx)"><i class="fa-solid fa-file-excel" style="color:#10b981;"></i></button>
            </div>`;

            msgDiv.innerHTML = `${badge}<div class="bot-msg-content">${conteudo}</div>${actionBar}`;

            // Bindings da toolbar
            const el = msgDiv;
            el.querySelector('.btn-thumbs-up').addEventListener('click', function() {
                this.classList.toggle('active');
                el.querySelector('.btn-thumbs-down').classList.remove('active');
            });
            el.querySelector('.btn-thumbs-down').addEventListener('click', function() {
                this.classList.toggle('active');
                el.querySelector('.btn-thumbs-up').classList.remove('active');
            });
            el.querySelector('.btn-copy-msg').addEventListener('click', function() {
                const body = el.querySelector('.bot-msg-content');
                if (body) {
                    navigator.clipboard.writeText(body.innerText).then(() => {
                        this.innerHTML = '<i class="fa-solid fa-check"></i>';
                        setTimeout(() => { this.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
                    });
                }
            });
            el.querySelector('.btn-speak-msg').addEventListener('click', function() {
                const body = el.querySelector('.bot-msg-content');
                if (body && 'speechSynthesis' in window) {
                    const utter = new SpeechSynthesisUtterance(body.innerText);
                    utter.lang = 'pt-BR';
                    window.speechSynthesis.speak(utter);
                }
            });
            el.querySelector('.btn-regen-msg').addEventListener('click', function() {
                const userMsgs = wrapper.querySelectorAll('.chat-msg.user');
                if (userMsgs.length > 0) {
                    const lastUserText = userMsgs[userMsgs.length - 1].querySelector('.user-text') || userMsgs[userMsgs.length - 1].querySelector('.user-bubble');
                    if (lastUserText) {
                        input.value = lastUserText.innerText;
                        ferramentaAtual = null;
                        sendMessage();
                    }
                }
            });

            // Ações de exportação direta da resposta
            const btnPdf = el.querySelector('.btn-export-pdf');
            if (btnPdf) {
                btnPdf.addEventListener('click', () => {
                    const contentEl = el.querySelector('.bot-msg-content');
                    dispararDownloadDocumento({
                        tipo: 'pdf',
                        titulo: 'Analise_DataInsight',
                        elemento: contentEl
                    });
                });
            }
            const btnDocx = el.querySelector('.btn-export-docx');
            if (btnDocx) {
                btnDocx.addEventListener('click', () => {
                    const contentEl = el.querySelector('.bot-msg-content');
                    dispararDownloadDocumento({
                        tipo: 'docx',
                        titulo: 'Relatorio_DataInsight',
                        elemento: contentEl
                    });
                });
            }
            const btnExcel = el.querySelector('.btn-export-excel');
            if (btnExcel) {
                btnExcel.addEventListener('click', () => {
                    const contentEl = el.querySelector('.bot-msg-content');
                    dispararDownloadDocumento({
                        tipo: 'xlsx',
                        titulo: 'Dados_DataInsight',
                        elemento: contentEl
                    });
                });
            }

            msgDiv.querySelectorAll('a').forEach(a => a.target = '_blank');
        } else {
            let anexoHtml = '';
            if (anexoInfo && anexoInfo.nome) {
                const info = obterIconeArquivo(anexoInfo.nome, anexoInfo.tipo);
                const tamanhoStr = anexoInfo.tamanho_fmt || formatarTamanhoBytes(anexoInfo.tamanho);
                if (info.isImage && (anexoInfo.previewUrl || anexoInfo.base64)) {
                    const imgSrc = anexoInfo.previewUrl || anexoInfo.base64;
                    anexoHtml = `
                        <div class="user-img-attachment">
                            <img src="${imgSrc}" alt="${escapeHtml(anexoInfo.nome)}" />
                            <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;padding:2px 4px;">
                                <i class="${info.icon}" style="color:${info.color};"></i>
                                <span class="attachment-filename">${escapeHtml(anexoInfo.nome)}</span>
                                <span class="attachment-size">(${tamanhoStr})</span>
                            </div>
                        </div>
                    `;
                } else {
                    anexoHtml = `
                        <div class="user-msg-attachment">
                            <div style="font-size:1.3rem;color:${info.color};display:flex;align-items:center;">
                                <i class="${info.icon}"></i>
                            </div>
                            <div class="user-attachment-info">
                                <span class="attachment-filename">${escapeHtml(anexoInfo.nome)}</span>
                                <span class="attachment-size">${tamanhoStr}</span>
                            </div>
                        </div>
                    `;
                }
            }
            msgDiv.innerHTML = `<div class="user-bubble">${anexoHtml}${texto ? `<div class="user-text">${escapeHtml(texto)}</div>` : ''}</div>`;
        }

        wrapper.appendChild(msgDiv);
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;

        if (remetente === 'bot') {
            setTimeout(renderizarGraficosDaMensagem, 100);
            renderizarArtefatosDeDocumento(msgDiv);
        }
        return msgDiv;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    function persistSessionId() {
        sessionStorage.setItem(CHATBOT_SESSION_KEY, currentSessionId);
        localStorage.setItem(CHATBOT_SESSION_KEY, currentSessionId);
    }

    function restoreChatbotSession() {
        const savedSession = sessionStorage.getItem(CHATBOT_SESSION_KEY) || localStorage.getItem(CHATBOT_SESSION_KEY);
        if (savedSession) { currentSessionId = savedSession; persistSessionId(); }
    }

    function restoreChatbotConversationToPage() {
        let saved = sessionStorage.getItem(CHATBOT_MESSAGES_KEY) || localStorage.getItem(CHATBOT_MESSAGES_KEY);
        if (!saved) return false;
        try {
            const messages = JSON.parse(saved);
            if (!Array.isArray(messages) || messages.length === 0) return false;
            const wrapper = streamInner || messagesDiv;
            const existing = wrapper.querySelectorAll('.chat-msg');
            existing.forEach(el => el.remove());
            messages.forEach(m => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `chat-msg ${m.remetente}`;
                msgDiv.innerHTML = m.html;
                wrapper.appendChild(msgDiv);
            });
            renderizarArtefatosDeDocumento(wrapper);
            if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return true;
        } catch (err) {
            console.warn('Falha ao restaurar conversa:', err);
            return false;
        }
    }

    function animateChatbotIntoPage() {
        const chatbotCard = document.getElementById('chatbot-card');
        const chatBox = document.getElementById('chat-box');
        if (!chatbotCard || !chatBox) return;
        if (!chatbotCard.classList.contains('active')) return;
        const cardRect = chatbotCard.getBoundingClientRect();
        const targetRect = chatBox.getBoundingClientRect();
        const clone = chatbotCard.cloneNode(true);
        Object.assign(clone.style, {
            position: 'fixed', margin: '0',
            top: `${cardRect.top}px`, left: `${cardRect.left}px`,
            width: `${cardRect.width}px`, height: `${cardRect.height}px`,
            transition: 'all 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
            zIndex: '25000', pointerEvents: 'none', borderRadius: '28px',
            boxShadow: '0 30px 90px rgba(15, 23, 42, 0.35)'
        });
        document.body.appendChild(clone);
        requestAnimationFrame(() => {
            Object.assign(clone.style, {
                top: `${targetRect.top}px`, left: `${targetRect.left}px`,
                width: `${targetRect.width}px`, height: `${targetRect.height}px`,
                borderRadius: '16px', opacity: '0.95',
                boxShadow: '0 35px 120px rgba(59, 130, 246, 0.35)'
            });
        });
        clone.addEventListener('transitionend', () => {
            if (clone.parentNode) clone.parentNode.removeChild(clone);
            chatBox.classList.add('chatbox-highlight');
            setTimeout(() => chatBox.classList.remove('chatbox-highlight'), 1200);
            const chatbotCardVisible = document.getElementById('chatbot-card');
            if (chatbotCardVisible) {
                chatbotCardVisible.classList.remove('active');
                chatbotCardVisible.classList.add('hidden');
            }
        }, { once: true });
    }

    function tryAnimateChatbotTransition(attempt = 0) {
        const openState = sessionStorage.getItem(CHATBOT_OPEN_KEY) || localStorage.getItem(CHATBOT_OPEN_KEY);
        if (openState !== 'true') return;
        if (sessionStorage.getItem(CHATBOT_TRANSITION_DONE_KEY) === 'true') return;
        const chatbotCard = document.getElementById('chatbot-card');
        if (!chatbotCard || !chatbotCard.classList.contains('active')) {
            if (attempt < 15) setTimeout(() => tryAnimateChatbotTransition(attempt + 1), 120);
            return;
        }
        const restored = restoreChatbotConversationToPage();
        if (restored) { animateChatbotIntoPage(); sessionStorage.setItem(CHATBOT_TRANSITION_DONE_KEY, 'true'); }
    }

    function saveChatbotConversationToState() {
        const wrapper = streamInner || messagesDiv;
        const messages = [];
        wrapper.querySelectorAll('.chat-msg').forEach(el => {
            messages.push({ html: el.innerHTML, remetente: el.classList.contains('bot') ? 'bot' : 'user' });
        });
        if (messages.length) {
            const payload = JSON.stringify(messages);
            sessionStorage.setItem(CHATBOT_MESSAGES_KEY, payload);
            localStorage.setItem(CHATBOT_MESSAGES_KEY, payload);
        }
    }

    const mutationObserver = new MutationObserver(saveChatbotConversationToState);
    if (streamInner) mutationObserver.observe(streamInner, { childList: true, subtree: true });
    else if (messagesDiv) mutationObserver.observe(messagesDiv, { childList: true, subtree: true });

    // ==================== SESSÕES & HISTÓRICO ====================
    function carregarSessoes() {
        fetch('/api/chatbot/sessoes')
            .then(res => res.json())
            .then(data => {
                const lista = document.getElementById('historico-lista');
                if (!lista) return;
                lista.innerHTML = '';
                if (data.sessoes && data.sessoes.length > 0) {
                    data.sessoes.forEach(s => {
                        const btn = document.createElement('button');
                        btn.className = `sidebar-history-item ${s.sessao_id === currentSessionId ? 'active' : ''}`;
                        btn.innerHTML = `<span style="display:flex;align-items:center;gap:7px;overflow:hidden;"><i class="fa-regular fa-message" style="flex-shrink:0;"></i><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.titulo}</span></span>`;
                        btn.onclick = () => {
                            currentSessionId = s.sessao_id;
                            persistSessionId();
                            carregarHistorico();
                            carregarSessoes();
                        };
                        lista.appendChild(btn);
                    });
                } else {
                    lista.innerHTML = '<span style="color:#475569;font-size:0.8rem;padding:6px 10px;">Nenhuma conversa.</span>';
                }
            });
    }

    function carregarHistorico() {
        const wrapper = streamInner || messagesDiv;
        const existingMsgs = wrapper.querySelectorAll('.chat-msg');
        existingMsgs.forEach(el => el.remove());

        fetch(`/api/chatbot/historico?sessao_id=${currentSessionId}`)
            .then(res => res.json())
            .then(data => {
                if (data.historico && data.historico.length > 0) {
                    data.historico.forEach(h => appendMessage(h.mensagem, h.remetente, null, h.anexo));
                } else {
                    appendMessage(
                        "<p>Olá! Sou seu <strong>Copiloto IA DataInsight</strong>. Posso analisar suas finanças, criar gráficos interativos, gerar tabelas de indicadores e muito mais.</p><p>Use os atalhos abaixo para começar ou escreva sua pergunta!</p>",
                        'bot',
                        { agente_nome: 'Smart Copiloto IA', agente_icone: 'robot', agente_cor: '#3B82F6' }
                    );
                }
            });
    }

    // ==================== ENVIAR MENSAGEM ====================
    function sendMessage() {
        const text = input ? input.value.trim() : '';
        const anexoParaEnviar = arquivoAnexadoAtual;
        if (!text && !anexoParaEnviar) return;

        // Som de bolha ao usuário enviar mensagem
        tocarSomBolhaEnvio();

        persistSessionId();
        appendMessage(text, 'user', null, anexoParaEnviar);
        if (input) { input.value = ''; input.style.height = 'auto'; }
        limparAnexo();
        if (sendBtn) sendBtn.disabled = true;

        const wrapper = streamInner || messagesDiv;
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot typing-msg';
        typingDiv.innerHTML = `<div class="bot-header-badge" style="color:#3B82F6;background:rgba(59,130,246,0.1);border-color:rgba(59,130,246,0.2);">
            <i class="fa-solid fa-brain"></i> Pensando...
        </div>
        <div class="bot-msg-content" style="display:flex;align-items:center;gap:8px;color:#64748b;">
            <i class="fa-solid fa-circle-notch fa-spin" style="color:#3B82F6;"></i> ${anexoParaEnviar ? 'Processando e analisando o arquivo anexado...' : 'Analisando seus dados e preparando a resposta...'}
        </div>`;
        wrapper.appendChild(typingDiv);
        if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;

        const payload = {
            mensagem: text,
            sessao_id: currentSessionId,
            tabela_id: tabelaIaAtualId,
            agente_selecionado: agenteAtual,
            ferramenta: ferramentaAtual
        };
        if (anexoParaEnviar) {
            payload.arquivo = {
                nome: anexoParaEnviar.nome,
                tipo: anexoParaEnviar.tipo,
                tamanho: anexoParaEnviar.tamanho,
                tamanho_fmt: anexoParaEnviar.tamanho_fmt,
                base64: anexoParaEnviar.base64
            };
        }

        fetch('/api/chatbot/perguntar', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(res => {
                if (!res.ok) return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); });
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) return res.json();
                return res.text().then(t => ({ _rawText: t }));
            })
            .then(data => {
                if (wrapper.contains(typingDiv)) wrapper.removeChild(typingDiv);
                // Som ao receber mensagem da IA
                tocarSomRecebimentoIA();
                if (data && data._rawText) {
                    appendMessage('Resposta inválida do servidor.', 'bot');
                } else {
                    const resposta = (data && data.resposta) ? data.resposta : 'Resposta vazia do servidor.';
                    appendMessage(resposta, 'bot', data);
                    carregarSessoes();
                }
                ferramentaAtual = null;
            })
            .catch(err => {
                console.error('Erro ao chamar /api/chatbot/perguntar:', err);
                if (wrapper.contains(typingDiv)) wrapper.removeChild(typingDiv);
                // Som ao receber mensagem da IA (mesmo com aviso de erro)
                tocarSomRecebimentoIA();
                appendMessage(`<p style="color:#ef4444;">Erro ao contactar a IA: ${err.message}</p>`, 'bot');
            })
            .finally(() => {
                if (sendBtn) sendBtn.disabled = false;
            });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

    document.getElementById('btn-nova-conversa').addEventListener('click', () => {
        currentSessionId = Date.now().toString();
        persistSessionId();
        carregarHistorico();
        carregarSessoes();
    });

    document.getElementById('btn-apagar-historico').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja apagar a conversa ATUAL?')) {
            fetch(`/api/chatbot/historico/apagar?sessao_id=${currentSessionId}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    currentSessionId = Date.now().toString();
                    persistSessionId();
                    carregarHistorico();
                    carregarSessoes();
                })
                .catch(err => alert("Erro ao apagar histórico."));
        }
    });

    // ------------------ LÓGICA DO MODAL ------------------
    const modal = document.getElementById('ia-modal');
    let modalWindow = document.querySelector('.ia-modal-window');
    const modalCloseBtn = document.getElementById('ia-modal-close');
    const modalHeaderActions = document.getElementById('modal-header-actions');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalConteudo = document.getElementById('modal-conteudo');
    const modalFiltros = document.getElementById('modal-filtros');
    const modalDownloads = document.getElementById('modal-downloads');
    const modalPeriodoSelect = document.getElementById('modal-periodo-select');
    const btnAtualizarModal = document.getElementById('modal-btn-atualizar');
    const modalResizeHandle = document.getElementById('modal-resize-handle');
    const IA_MODAL_STATE_KEY = 'DataInsight_IA_ModalState';

    if (!modalWindow) {
        modalWindow = {
            style: {},
            offsetWidth: 0,
            offsetHeight: 0,
            classList: { add: function(){}, remove: function(){} }
        };
    }

    const chatBox = document.getElementById('chat-box');
    const galleryBox = document.getElementById('gallery-box');
    const galleryTitle = document.getElementById('gallery-main-title');
    const gallerySelect = document.getElementById('gallery-period-select');
    const galleryGrid = document.getElementById('gallery-grid');

    let modalDragState = null;
    let modalResizeState = null;

    function salvarEstadoModal() {
        if (!modal || !modalWindow) return;
        try {
            const state = {
                visible: modal.style.display === 'flex' || modal.style.display === 'block',
                top: parseInt(modalWindow.style.top || '0', 10) || 0,
                left: parseInt(modalWindow.style.left || '0', 10) || 0,
                width: parseInt(modalWindow.style.width || modalWindow.offsetWidth, 10) || Math.min(800, window.innerWidth - 40),
                height: parseInt(modalWindow.style.height || modalWindow.offsetHeight, 10) || Math.min(600, window.innerHeight - 40)
            };
            localStorage.setItem(IA_MODAL_STATE_KEY, JSON.stringify(state));
        } catch (err) {
            console.warn('Falha ao salvar estado do modal IA:', err);
        }
    }

    function carregarEstadoModal() {
        const saved = localStorage.getItem(IA_MODAL_STATE_KEY);
        if (!saved) return;
        try {
            const state = JSON.parse(saved);
            if (!state || typeof state !== 'object') return;
            const top = Number.isFinite(state.top) ? state.top : 0;
            const left = Number.isFinite(state.left) ? state.left : 0;
            const width = Number.isFinite(state.width) ? state.width : modalWindow.offsetWidth;
            const height = Number.isFinite(state.height) ? state.height : modalWindow.offsetHeight;
            aplicarPosicaoModal(clampModalState({ top, left, width, height }));
            if (state.visible) {
                modal.style.display = 'flex';
                modal.setAttribute('aria-hidden', 'false');
            }
        } catch (err) {
            console.warn('Falha ao carregar estado do modal IA:', err);
        }
    }

    function clampModalState({ top, left, width, height }) {
        const minWidth = 360;
        const minHeight = 280;
        const maxWidth = window.innerWidth - 40;
        const maxHeight = window.innerHeight - 40;
        return {
            top: Math.min(Math.max(10, top), Math.max(10, window.innerHeight - minHeight - 10)),
            left: Math.min(Math.max(10, left), Math.max(10, window.innerWidth - minWidth - 10)),
            width: Math.min(Math.max(minWidth, width), maxWidth),
            height: Math.min(Math.max(minHeight, height), maxHeight)
        };
    }

    function aplicarPosicaoModal({ top, left, width, height }) {
        if (!modalWindow || !modalWindow.style) return;
        try {
            modalWindow.style.top = `${top}px`;
            modalWindow.style.left = `${left}px`;
            modalWindow.style.width = `${width}px`;
            modalWindow.style.height = `${height}px`;
        } catch (e) {
            console.warn('Falha ao aplicar posição do modal:', e);
        }
    }

    function tocarBolhaModal(tipo) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = 'triangle';
            osc.frequency.value = tipo === 'open' ? 920 : 700;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(tipo === 'open' ? 1600 : 1200, ctx.currentTime);
            gain.gain.setValueAtTime(tipo === 'open' ? 0.55 : 0.38, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.28);
            osc.onended = () => { try { ctx.close(); } catch(e) {} };
        } catch(err) {
            console.warn('Erro ao tocar bolha modal:', err);
        }
    }

    function mostrarModal() {
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        if (!modalWindow.style.top || !modalWindow.style.left) {
            aplicarPosicaoModal(clampModalState({ top: 40, left: 40, width: Math.min(1040, window.innerWidth - 80), height: Math.min(700, window.innerHeight - 80) }));
        }
        // Animação pop-in
        modalWindow.classList.remove('ia-modal-pop-in');
        void modalWindow.offsetWidth;
        modalWindow.classList.add('ia-modal-pop-in');
        tocarBolhaModal('open');
        salvarEstadoModal();
    }

    function fecharModal() {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        modalWindow.classList.remove('ia-modal-pop-in');
        tocarBolhaModal('close');
        salvarEstadoModal();
    }

    function iniciarArrasteModal(event) {
        if (event.button !== 0) return;
        modalDragState = {
            startX: event.clientX,
            startY: event.clientY,
            initialTop: parseInt(modalWindow.style.top || '0', 10),
            initialLeft: parseInt(modalWindow.style.left || '0', 10)
        };
        document.addEventListener('mousemove', arrastarModal);
        document.addEventListener('mouseup', pararArrasteModal);
        event.preventDefault();
    }

    function arrastarModal(event) {
        if (!modalDragState) return;
        const deltaX = event.clientX - modalDragState.startX;
        const deltaY = event.clientY - modalDragState.startY;
        const next = clampModalState({
            top: modalDragState.initialTop + deltaY,
            left: modalDragState.initialLeft + deltaX,
            width: parseInt(modalWindow.style.width || modalWindow.offsetWidth, 10),
            height: parseInt(modalWindow.style.height || modalWindow.offsetHeight, 10)
        });
        aplicarPosicaoModal(next);
    }

    function pararArrasteModal() {
        if (!modalDragState) return;
        document.removeEventListener('mousemove', arrastarModal);
        document.removeEventListener('mouseup', pararArrasteModal);
        modalDragState = null;
        salvarEstadoModal();
    }

    function iniciarRedimensionamentoModal(event) {
        if (event.button !== 0) return;
        modalResizeState = {
            startX: event.clientX,
            startY: event.clientY,
            initialWidth: modalWindow.offsetWidth,
            initialHeight: modalWindow.offsetHeight
        };
        document.addEventListener('mousemove', redimensionarModal);
        document.addEventListener('mouseup', pararRedimensionamentoModal);
        event.preventDefault();
    }

    function redimensionarModal(event) {
        if (!modalResizeState) return;
        const next = clampModalState({
            top: parseInt(modalWindow.style.top || '0', 10),
            left: parseInt(modalWindow.style.left || '0', 10),
            width: modalResizeState.initialWidth + (event.clientX - modalResizeState.startX),
            height: modalResizeState.initialHeight + (event.clientY - modalResizeState.startY)
        });
        aplicarPosicaoModal(next);
    }

    function pararRedimensionamentoModal() {
        if (!modalResizeState) return;
        document.removeEventListener('mousemove', redimensionarModal);
        document.removeEventListener('mouseup', pararRedimensionamentoModal);
        modalResizeState = null;
        salvarEstadoModal();
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', fecharModal);
    if (modalHeaderActions) modalHeaderActions.addEventListener('mousedown', iniciarArrasteModal);
    if (modalResizeHandle) modalResizeHandle.addEventListener('mousedown', iniciarRedimensionamentoModal);
    window.addEventListener('resize', () => {
        aplicarPosicaoModal(clampModalState({
            top: parseInt(modalWindow.style.top || '0', 10),
            left: parseInt(modalWindow.style.left || '0', 10),
            width: parseInt(modalWindow.style.width || modalWindow.offsetWidth, 10),
            height: parseInt(modalWindow.style.height || modalWindow.offsetHeight, 10)
        }));
        salvarEstadoModal();
    });

    document.addEventListener('DataInsight_OpenIaModal', () => {
        console.log('[IA] DataInsight_OpenIaModal recebido no document');
        mostrarModal();
    });

    window.addEventListener('DataInsight_OpenIaModal', () => {
        console.log('[IA] DataInsight_OpenIaModal recebido no window');
        mostrarModal();
    });

    document.addEventListener('DataInsight_CloseIaModal', () => {
        console.log('[IA] DataInsight_CloseIaModal recebido no document');
        fecharModal();
    });

    window.addEventListener('DataInsight_CloseIaModal', () => {
        console.log('[IA] DataInsight_CloseIaModal recebido no window');
        fecharModal();
    });

    window.DataInsightOpenIaModal = function() {
        console.log('[IA] DataInsightOpenIaModal chamada manualmente');
        mostrarModal();
    };

    window.closeDataInsightIaModal = function() {
        console.log('[IA] closeDataInsightIaModal chamada manualmente');
        fecharModal();
    };

    carregarEstadoModal();

    function mostrarChat() {
        chatBox.style.display = 'flex';
        galleryBox.style.display = 'none';
    }

    function mostrarGaleria() {
        chatBox.style.display = 'none';
        galleryBox.style.display = 'flex';
    }

    // --- GALERIA DE GRÁFICOS ---
    function abrirGaleriaGraficos(periodoDefault = '30_dias') {
        mostrarGaleria();
        galleryTitle.innerHTML = '<i class="fa-solid fa-chart-area"></i> Galeria de Gráficos';
        gallerySelect.style.display = 'inline-block';
        gallerySelect.value = periodoDefault;

        renderizarGridGraficos();
    }

    gallerySelect.addEventListener('change', renderizarGridGraficos);

    function renderizarGridGraficos() {
        galleryGrid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--texto); padding: 40px;">Carregando gráficos...</div>';
        const periodo = gallerySelect.value;

        fetch(`/api/graficos?periodo=${periodo}`)
            .then(res => res.json())
            .then(data => {
                galleryGrid.innerHTML = '';

                const linhaData = data.grafico_linha;
                const barrasData = data.grafico_barras;
                const pizzaData = data.grafico_pizza;

                if (!linhaData || !linhaData.labels || linhaData.labels.length === 0) {
                    galleryGrid.innerHTML = '<p style="color:var(--muted); grid-column: 1 / -1; text-align: center;">Sem dados suficientes para este período.</p>';
                    return;
                }

                const isDarkMode = document.body.classList.contains('tema-escuro');

                // Render Linha
                const divLinha = document.createElement('div');
                divLinha.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 20px; background: var(--cartao); cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column;";
                divLinha.onmouseover = () => divLinha.style.transform = 'translateY(-5px)';
                divLinha.onmouseout = () => divLinha.style.transform = 'translateY(0)';
                divLinha.innerHTML = '<h3 style="margin: 0 0 15px 0; font-size: 15px; color: var(--texto); text-align: center;"><i class="fa-solid fa-chart-line text-primary"></i> Evolução de Faturamento</h3><div id="grid-linha" style="width:100%; flex: 1; min-height: 220px;"></div>';
                divLinha.onclick = () => abrirModalGrafico('linha', linhaData);
                galleryGrid.appendChild(divLinha);

                // Render Barras
                const divBarras = document.createElement('div');
                divBarras.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 20px; background: var(--cartao); cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column;";
                divBarras.onmouseover = () => divBarras.style.transform = 'translateY(-5px)';
                divBarras.onmouseout = () => divBarras.style.transform = 'translateY(0)';
                divBarras.innerHTML = '<h3 style="margin: 0 0 15px 0; font-size: 15px; color: var(--texto); text-align: center;"><i class="fa-solid fa-chart-column text-success"></i> Desempenho Mensal</h3><div id="grid-barras" style="width:100%; flex: 1; min-height: 220px;"></div>';
                divBarras.onclick = () => abrirModalGrafico('barras', barrasData);
                galleryGrid.appendChild(divBarras);

                // Render Pizza
                const divPizza = document.createElement('div');
                divPizza.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 20px; background: var(--cartao); cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column;";
                divPizza.onmouseover = () => divPizza.style.transform = 'translateY(-5px)';
                divPizza.onmouseout = () => divPizza.style.transform = 'translateY(0)';
                divPizza.innerHTML = '<h3 style="margin: 0 0 15px 0; font-size: 15px; color: var(--texto); text-align: center;"><i class="fa-solid fa-chart-pie text-warning"></i> Distribuição</h3><div id="grid-pizza" style="width:100%; flex: 1; min-height: 220px;"></div>';
                divPizza.onclick = () => abrirModalGrafico('pizza', pizzaData);
                galleryGrid.appendChild(divPizza);

                const elLinha = document.getElementById('grid-linha');
                if (elLinha) {
                    new ApexCharts(elLinha, {
                        chart: { type: 'area', height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                        series: linhaData.series,
                        xaxis: { categories: linhaData.labels, labels: { show: false } },
                        yaxis: { show: false },
                        legend: { show: false },
                        colors: ['#3B82F6', '#EF4444', '#10B981'],
                        dataLabels: { enabled: false },
                        stroke: { curve: 'smooth', width: 2 },
                        theme: { mode: isDarkMode ? 'dark' : 'light' }
                    }).render();
                }

                const elBarras = document.getElementById('grid-barras');
                if (elBarras) {
                    new ApexCharts(elBarras, {
                        chart: { type: 'bar', height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                        series: barrasData.series,
                        xaxis: { categories: barrasData.labels, labels: { show: false } },
                        yaxis: { show: false },
                        legend: { show: false },
                        colors: ['#3B82F6', '#EF4444', '#10B981'],
                        dataLabels: { enabled: false },
                        theme: { mode: isDarkMode ? 'dark' : 'light' }
                    }).render();
                }

                const elPizza = document.getElementById('grid-pizza');
                if (elPizza && pizzaData && pizzaData.labels) {
                    new ApexCharts(elPizza, {
                        chart: { type: 'pie', height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                        series: pizzaData.series,
                        labels: pizzaData.labels,
                        legend: { show: false },
                        colors: ['#3B82F6', '#EF4444', '#10B981'],
                        dataLabels: { enabled: false },
                        theme: { mode: isDarkMode ? 'dark' : 'light' }
                    }).render();
                }

                fetch(`/api/galeria/listar?periodo=todos`)
                    .then(res => res.json())
                    .then(salvos => {
                        if (salvos.length > 0) {
                            const divisor = document.createElement('div');
                            divisor.style.cssText = "grid-column: 1 / -1; border-bottom: 1px solid var(--borda); margin-top: 20px; padding-bottom: 10px;";
                            divisor.innerHTML = '<h2 style="margin: 0; font-size: 1.2rem; color: var(--texto);"><i class="fa-solid fa-clock-rotate-left"></i> Histórico de Gráficos Gerados</h2>';
                            galleryGrid.appendChild(divisor);

                            salvos.forEach(salvo => {
                                const id = 'chart-saved-' + salvo._id;
                                const divSalvo = document.createElement('div');
                                divSalvo.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 20px; background: var(--cartao); cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column;";
                                divSalvo.onmouseover = () => divSalvo.style.transform = 'translateY(-5px)';
                                divSalvo.onmouseout = () => divSalvo.style.transform = 'translateY(0)';

                                let icon = '<i class="fa-solid fa-chart-line text-primary"></i>';
                                if (salvo.tipo === 'barras') icon = '<i class="fa-solid fa-chart-column text-success"></i>';
                                if (salvo.tipo === 'pizza') icon = '<i class="fa-solid fa-chart-pie text-warning"></i>';

                                const labelPeriodo = salvo.periodo.startsWith('mes_') ? ('Mês ' + salvo.periodo.split('_')[1]) : salvo.periodo.replace('_', ' ');

                                divSalvo.innerHTML = `<h3 style="margin: 0 0 5px 0; font-size: 15px; color: var(--texto); text-align: center;">${icon} ${salvo.titulo}</h3>
                                                          <p style="margin: 0 0 15px 0; font-size: 12px; color: var(--muted); text-align: center;">Período: ${labelPeriodo}</p>
                                                          <div id="${id}" style="width:100%; flex: 1; min-height: 220px;"></div>`;
                                galleryGrid.appendChild(divSalvo);

                                fetch(`/api/graficos?periodo=${salvo.periodo}`)
                                    .then(r => r.json())
                                    .then(dadosSalvos => {
                                        let chartData;
                                        let chartType = 'area';
                                        if (salvo.tipo === 'pizza') { chartData = dadosSalvos.grafico_pizza; chartType = 'pie'; }
                                        else if (salvo.tipo === 'barras') { chartData = dadosSalvos.grafico_barras; chartType = 'bar'; }
                                        else { chartData = dadosSalvos.grafico_linha; }

                                        if (!chartData || !chartData.labels) {
                                            document.getElementById(id).innerHTML = '<p style="color:var(--muted); text-align:center;">Sem dados</p>';
                                            return;
                                        }

                                        let metricasFiltro = (salvo.metricas || 'faturamento,lucro').split(',').map(m => m.trim().toLowerCase());

                                        if (chartType === 'pie') {
                                            const indices = [];
                                            chartData.labels.forEach((lbl, i) => {
                                                const nome = lbl.toLowerCase();
                                                if (metricasFiltro.some(m => nome.includes(m) || m.includes(nome) || m.replace('s', '') === nome.replace('s', '')) || metricasFiltro.includes('todos')) {
                                                    indices.push(i);
                                                }
                                            });
                                            const seriesFiltradas = indices.map(i => chartData.series[i]);
                                            const labelsFiltrados = indices.map(i => chartData.labels[i]);

                                            divSalvo.onclick = () => abrirModalGrafico(salvo.tipo, { series: seriesFiltradas, labels: labelsFiltrados });

                                            new ApexCharts(document.getElementById(id), {
                                                chart: { type: 'pie', height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                                                series: seriesFiltradas,
                                                labels: labelsFiltrados,
                                                legend: { show: false },
                                                colors: ['#3B82F6', '#EF4444', '#10B981'].slice(0, seriesFiltradas.length),
                                                dataLabels: { enabled: false },
                                                theme: { mode: isDarkMode ? 'dark' : 'light' }
                                            }).render();
                                        } else {
                                            let seriesFiltradas = chartData.series;
                                            if (!metricasFiltro.includes('todos')) {
                                                seriesFiltradas = chartData.series.filter(s => {
                                                    const nome = s.name.toLowerCase();
                                                    return metricasFiltro.some(m => nome.includes(m) || m.includes(nome) || m.replace('s', '') === nome.replace('s', ''));
                                                });
                                            }

                                            divSalvo.onclick = () => abrirModalGrafico(salvo.tipo, { series: seriesFiltradas, labels: chartData.labels });

                                            new ApexCharts(document.getElementById(id), {
                                                chart: { type: chartType, height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                                                series: seriesFiltradas,
                                                xaxis: { categories: chartData.labels, labels: { show: false } },
                                                yaxis: { show: false },
                                                legend: { show: false },
                                                colors: ['#3B82F6', '#EF4444', '#10B981'],
                                                dataLabels: { enabled: false },
                                                stroke: { curve: chartType === 'area' ? 'smooth' : 'straight', width: chartType === 'area' ? 2 : 0 },
                                                theme: { mode: isDarkMode ? 'dark' : 'light' }
                                            }).render();
                                        }
                                    });
                            });
                        }
                    });
            });
    }

    function abrirModalGrafico(tipo, dados) {
        modal.style.display = 'flex';
        let icon = '<i class="fa-solid fa-chart-line"></i>';
        let titleText = 'Gráfico de Evolução';
        if (tipo === 'barras') { icon = '<i class="fa-solid fa-chart-column"></i>'; titleText = 'Gráfico de Desempenho'; }
        if (tipo === 'pizza') { icon = '<i class="fa-solid fa-chart-pie"></i>'; titleText = 'Gráfico de Distribuição'; }

        modalTitulo.innerHTML = `${icon} ${titleText}`;
        modalFiltros.style.display = 'none';
        modalDownloads.style.display = 'none';

        modalConteudo.innerHTML = '<div id="chart-modal-render" style="width: 100%; height: 100%;"></div>';

        const isDarkMode = document.body.classList.contains('tema-escuro');
        let options;

        if (tipo === 'pizza') {
            options = {
                chart: { type: 'pie', height: '100%', toolbar: { show: true }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                series: dados.series,
                labels: dados.labels,
                colors: ['#3B82F6', '#EF4444', '#10B981'],
                legend: { show: true, position: 'right', labels: { colors: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                dataLabels: { enabled: true },
                theme: { mode: isDarkMode ? 'dark' : 'light' }
            };
        } else {
            options = {
                chart: { type: tipo === 'linha' ? 'area' : 'bar', height: '100%', toolbar: { show: true }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                series: dados.series,
                xaxis: { categories: dados.labels, labels: { style: { colors: isDarkMode ? '#9ca3af' : '#4b5563' } } },
                yaxis: { labels: { style: { colors: isDarkMode ? '#9ca3af' : '#4b5563' }, formatter: val => "R$ " + val.toLocaleString('pt-BR') } },
                legend: { show: true, position: 'top', horizontalAlign: 'center', labels: { colors: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                colors: ['#3B82F6', '#EF4444', '#10B981'],
                dataLabels: { enabled: false },
                stroke: { curve: tipo === 'linha' ? 'smooth' : 'straight', width: tipo === 'linha' ? 3 : 0 },
                theme: { mode: isDarkMode ? 'dark' : 'light' }
            };
        }
        const modalRenderEl = document.getElementById('chart-modal-render');
        if (modalRenderEl) {
            new ApexCharts(modalRenderEl, options).render();
        }
    }

    // --- GALERIA DE ARQUIVOS ---
    function abrirGaleriaArquivos() {
        mostrarGaleria();
        galleryTitle.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Galeria de Documentos e PDFs';
        gallerySelect.style.display = 'none';

        galleryGrid.innerHTML = '';

        const divPDF = document.createElement('div');
        divPDF.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 40px 20px; background: var(--cartao); cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s;";
        divPDF.onmouseover = () => divPDF.style.transform = 'translateY(-5px)';
        divPDF.onmouseout = () => divPDF.style.transform = 'translateY(0)';
        divPDF.innerHTML = '<i class="fa-solid fa-file-pdf" style="font-size: 54px; color: #EF4444; margin-bottom: 20px;"></i><h3 style="margin: 0; font-size: 16px; color: var(--texto);">Relatório PDF</h3><p style="font-size: 13px; color: var(--muted); margin: 10px 0 0 0;">Visualizar PDF</p>';
        divPDF.onclick = () => abrirModalPDF();
        galleryGrid.appendChild(divPDF);

        const divExcel = document.createElement('div');
        divExcel.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 40px 20px; background: var(--cartao); cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s;";
        divExcel.onmouseover = () => divExcel.style.transform = 'translateY(-5px)';
        divExcel.onmouseout = () => divExcel.style.transform = 'translateY(0)';
        divExcel.innerHTML = '<i class="fa-solid fa-file-excel" style="font-size: 54px; color: #10B981; margin-bottom: 20px;"></i><h3 style="margin: 0; font-size: 16px; color: var(--texto);">Exportar Excel</h3><p style="font-size: 13px; color: var(--muted); margin: 10px 0 0 0;">Baixar Planilha</p>';
        divExcel.onclick = () => window.open('/api/download/excel', '_blank');
        galleryGrid.appendChild(divExcel);

        const divCSV = document.createElement('div');
        divCSV.style.cssText = "border: 1px solid var(--borda); border-radius: 20px; padding: 40px 20px; background: var(--cartao); cursor: pointer; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: transform 0.2s;";
        divCSV.onmouseover = () => divCSV.style.transform = 'translateY(-5px)';
        divCSV.onmouseout = () => divCSV.style.transform = 'translateY(0)';
        divCSV.innerHTML = '<i class="fa-solid fa-file-csv" style="font-size: 54px; color: var(--texto); margin-bottom: 20px;"></i><h3 style="margin: 0; font-size: 16px; color: var(--texto);">Exportar CSV</h3><p style="font-size: 13px; color: var(--muted); margin: 10px 0 0 0;">Baixar Dados Brutos</p>';
        divCSV.onclick = () => window.open('/api/download/csv', '_blank');
        galleryGrid.appendChild(divCSV);
    }

    function abrirModalPDF() {
        modal.style.display = 'flex';
        modalTitulo.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Visualizador de PDF';
        modalFiltros.style.display = 'none';
        modalDownloads.style.display = 'flex';

        modalConteudo.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; background: #525659; border-radius: 8px; overflow: hidden;">
                    <iframe src="/relatorio_pdf" style="width: 100%; height: 100%; border: none;"></iframe>
                </div>
            `;
    }

    document.getElementById('btn-galeria-graficos')?.addEventListener('click', () => abrirGaleriaGraficos());
    document.getElementById('btn-galeria-arquivos')?.addEventListener('click', () => abrirGaleriaArquivos());

    document.addEventListener('click', function (e) {
        const chartDiv = e.target.closest('.grafico-ia-render');
        if (chartDiv) {
            const p = chartDiv.getAttribute('data-periodo') || '30_dias';
            abrirGaleriaGraficos(p);
        }
    });

    restoreChatbotSession();
    carregarSessoes();
    carregarHistorico();
    tryAnimateChatbotTransition();
});
