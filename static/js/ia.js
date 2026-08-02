document.addEventListener('DOMContentLoaded', () => {
    const messagesDiv = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    let currentSessionId = sessionStorage.getItem('chatbotSessionId') || localStorage.getItem('chatbotSessionId') || Date.now().toString();
    sessionStorage.setItem('chatbotSessionId', currentSessionId);
    localStorage.setItem('chatbotSessionId', currentSessionId);

    const CHATBOT_OPEN_KEY = 'chatbotOpen';
    const CHATBOT_MESSAGES_KEY = 'chatbotMessages';
    const CHATBOT_SESSION_KEY = 'chatbotSessionId';
    const CHATBOT_TRANSITION_DONE_KEY = 'chatbotIaTransitionDone';

    // ==================== FUNÇÕES DE TELA CHEIA ====================
    const pageContainer = document.querySelector('.page-ia-container');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnExitFullscreen = document.getElementById('btn-exit-fullscreen');

    function entrarTelaCheia() {
        pageContainer.classList.add('fullscreen');
        document.body.style.overflow = 'hidden';
    }

    function sairTelaCheia() {
        pageContainer.classList.remove('fullscreen');
        document.body.style.overflow = '';
    }

    btnFullscreen.addEventListener('click', entrarTelaCheia);
    btnExitFullscreen.addEventListener('click', sairTelaCheia);

    // Tecla ESC para sair da tela cheia
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && pageContainer.classList.contains('fullscreen')) {
            sairTelaCheia();
        }
    });

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

            container.innerHTML = '<div style="text-align:center; padding: 20px;">Carregando dados interativos...</div>';
            container.classList.add('renderizado');

            fetch(`/api/graficos?periodo=${periodo}`)
                .then(res => res.json())
                .then(data => {
                    container.innerHTML = '';
                    let chartData;
                    let options;
                    const isDarkMode = document.body.classList.contains('tema-escuro');

                    if (tipoChart === 'pie') {
                        chartData = data.grafico_pizza;
                        if (!chartData || !chartData.labels || chartData.series.length === 0) {
                            container.innerHTML = '<p style="color:var(--muted);">Sem dados suficientes para este período.</p>';
                            return;
                        }
                        const indices = [];
                        chartData.labels.forEach((lbl, i) => {
                            const nome = lbl.toLowerCase();
                            if (metricasFiltro.some(m => nome.includes(m) || m.includes(nome) || m.replace('s', '') === nome.replace('s', '')) || metricasFiltro.includes('todos')) {
                                indices.push(i);
                            }
                        });
                        const seriesFiltradas = indices.map(i => chartData.series[i]);
                        const labelsFiltrados = indices.map(i => chartData.labels[i]);

                        options = {
                            chart: { type: 'pie', height: 300, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                            series: seriesFiltradas,
                            labels: labelsFiltrados,
                            colors: ['#3B82F6', '#EF4444', '#10B981'].slice(0, seriesFiltradas.length),
                            legend: { show: true, position: 'right', labels: { colors: isDarkMode ? '#e5e7eb' : '#1f2937' } },
                            dataLabels: { enabled: true },
                            theme: { mode: isDarkMode ? 'dark' : 'light' }
                        };
                    } else {
                        chartData = tipoChart === 'bar' ? data.grafico_barras : data.grafico_linha;
                        if (!chartData || !chartData.labels) {
                            container.innerHTML = '<p style="color:var(--muted);">Sem dados suficientes para este período.</p>';
                            return;
                        }

                        let seriesFiltradas = chartData.series;
                        if (!metricasFiltro.includes('todos')) {
                            seriesFiltradas = chartData.series.filter(s => {
                                const nome = s.name.toLowerCase();
                                return metricasFiltro.some(m => nome.includes(m) || m.includes(nome) || m.replace('s', '') === nome.replace('s', ''));
                            });
                        }

                        options = {
                            chart: {
                                type: tipoChart,
                                height: 300,
                                toolbar: { show: false },
                                background: 'transparent',
                                foreColor: isDarkMode ? '#9ca3af' : '#4b5563'
                            },
                            series: seriesFiltradas,
                            xaxis: {
                                categories: chartData.labels,
                                labels: { style: { colors: isDarkMode ? '#9ca3af' : '#4b5563' } }
                            },
                            yaxis: {
                                labels: {
                                    style: { colors: isDarkMode ? '#9ca3af' : '#4b5563' },
                                    formatter: function (value) { return "R$ " + value.toLocaleString('pt-BR'); }
                                }
                            },
                            legend: {
                                show: true,
                                position: 'top',
                                horizontalAlign: 'left',
                                labels: { colors: isDarkMode ? '#e5e7eb' : '#1f2937' }
                            },
                            colors: ['#3B82F6', '#EF4444', '#10B981'],
                            dataLabels: { enabled: false },
                            stroke: { curve: tipoChart === 'area' ? 'smooth' : 'straight', width: tipoChart === 'area' ? 2 : 0 },
                            theme: { mode: isDarkMode ? 'dark' : 'light' }
                        };
                    }

                    const chart = new ApexCharts(container, options);
                    chart.render();
                })
                .catch(err => {
                    console.error(err);
                    container.innerHTML = '<p style="color:var(--perigo);">Erro ao gerar gráfico interativo.</p>';
                });
        });
    }

    function appendMessage(texto, remetente) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${remetente}`;
        if (remetente === 'bot') {
            msgDiv.innerHTML = marked.parse(texto);
            msgDiv.querySelectorAll('a').forEach(a => a.target = '_blank');
        } else {
            msgDiv.textContent = texto;
        }
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        if (remetente === 'bot') {
            setTimeout(renderizarGraficosDaMensagem, 100);
        }
    }

    function restoreChatbotSession() {
        const savedSession = sessionStorage.getItem(CHATBOT_SESSION_KEY) || localStorage.getItem(CHATBOT_SESSION_KEY);
        if (savedSession) {
            currentSessionId = savedSession;
            sessionStorage.setItem(CHATBOT_SESSION_KEY, currentSessionId);
            localStorage.setItem(CHATBOT_SESSION_KEY, currentSessionId);
        }
    }

    function restoreChatbotConversationToPage() {
        let saved = sessionStorage.getItem(CHATBOT_MESSAGES_KEY);
        if (!saved) {
            saved = localStorage.getItem(CHATBOT_MESSAGES_KEY);
        }
        if (!saved) return false;
        try {
            const messages = JSON.parse(saved);
            if (!Array.isArray(messages) || messages.length === 0) return false;
            messagesDiv.innerHTML = '';
            messages.forEach(m => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `chat-msg ${m.remetente}`;
                msgDiv.innerHTML = m.html;
                messagesDiv.appendChild(msgDiv);
            });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            return true;
        } catch (err) {
            console.warn('Falha ao restaurar conversa do chatbot:', err);
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
        clone.style.position = 'fixed';
        clone.style.margin = '0';
        clone.style.top = `${cardRect.top}px`;
        clone.style.left = `${cardRect.left}px`;
        clone.style.width = `${cardRect.width}px`;
        clone.style.height = `${cardRect.height}px`;
        clone.style.transition = 'all 0.7s cubic-bezier(0.22, 1, 0.36, 1)';
        clone.style.zIndex = '25000';
        clone.style.pointerEvents = 'none';
        clone.style.borderRadius = '28px';
        clone.style.boxShadow = '0 30px 90px rgba(15, 23, 42, 0.35)';
        document.body.appendChild(clone);

        requestAnimationFrame(() => {
            clone.style.top = `${targetRect.top}px`;
            clone.style.left = `${targetRect.left}px`;
            clone.style.width = `${targetRect.width}px`;
            clone.style.height = `${targetRect.height}px`;
            clone.style.borderRadius = '16px';
            clone.style.opacity = '0.95';
            clone.style.boxShadow = '0 35px 120px rgba(59, 130, 246, 0.35)';
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
            if (attempt < 15) {
                setTimeout(() => tryAnimateChatbotTransition(attempt + 1), 120);
            }
            return;
        }

        const restored = restoreChatbotConversationToPage();
        if (restored) {
            animateChatbotIntoPage();
            sessionStorage.setItem(CHATBOT_TRANSITION_DONE_KEY, 'true');
        }
    }

    function saveChatbotConversationToState() {
        const messages = [];
        messagesDiv.querySelectorAll('.chat-msg').forEach(el => {
            messages.push({ html: el.innerHTML, remetente: el.classList.contains('bot') ? 'bot' : 'user' });
        });
        if (messages.length) {
            const payload = JSON.stringify(messages);
            sessionStorage.setItem(CHATBOT_MESSAGES_KEY, payload);
            localStorage.setItem(CHATBOT_MESSAGES_KEY, payload);
        }
    }

    const observer = new MutationObserver(saveChatbotConversationToState);
    observer.observe(messagesDiv, { childList: true, subtree: true });

    function carregarSessoes() {
        fetch('/api/chatbot/sessoes')
            .then(res => res.json())
            .then(data => {
                const lista = document.getElementById('historico-lista');
                lista.innerHTML = '';
                if (data.sessoes && data.sessoes.length > 0) {
                    data.sessoes.forEach(s => {
                        const btn = document.createElement('button');
                        btn.style.cssText = "background: transparent; border: none; color: var(--texto); text-align: left; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 13px; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
                        btn.innerHTML = `<i class="fa-solid fa-message"></i> ${s.titulo}`;
                        btn.onmouseover = () => btn.style.background = 'var(--fundo)';
                        btn.onmouseout = () => btn.style.background = 'transparent';

                        btn.onclick = () => {
                            currentSessionId = s.sessao_id;
                            mostrarChat();
                            carregarHistorico();
                        };
                        lista.appendChild(btn);
                    });
                } else {
                    lista.innerHTML = '<span style="color: var(--muted); font-size: 13px;">Nenhuma conversa.</span>';
                }
            });
    }

    function carregarHistorico() {
        messagesDiv.innerHTML = '';
        fetch(`/api/chatbot/historico?sessao_id=${currentSessionId}`)
            .then(res => res.json())
            .then(data => {
                if (data.historico && data.historico.length > 0) {
                    data.historico.forEach(h => appendMessage(h.mensagem, h.remetente));
                } else {
                    appendMessage("Olá! Sou seu Time Virtual de Dados. Posso analisar suas finanças, gerar relatórios em PDF/Excel, ou desenhar gráficos interativos na tela. O que você precisa?", "bot");
                }
            });
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        appendMessage(text, 'user');
        input.value = '';

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg bot';
        typingDiv.innerHTML = '<i><i class="fa-solid fa-spinner fa-spin"></i> Processando dados...</i>';
        messagesDiv.appendChild(typingDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        fetch('/api/chatbot/perguntar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mensagem: text, sessao_id: currentSessionId })
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                messagesDiv.removeChild(typingDiv);
                appendMessage(data.resposta || 'Resposta vazia do servidor', 'bot');
                carregarSessoes();
            })
            .catch(err => {
                console.error('Erro ao chamar /api/chatbot/perguntar:', err);
                if (messagesDiv.contains(typingDiv)) messagesDiv.removeChild(typingDiv);
                appendMessage(`Erro ao contactar a IA (${err.message})`, 'bot');
            });
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

    document.getElementById('btn-nova-conversa').addEventListener('click', () => {
        currentSessionId = Date.now().toString();
        mostrarChat();
        carregarHistorico();
    });

    document.getElementById('btn-apagar-historico').addEventListener('click', () => {
        if (confirm('Tem certeza que deseja apagar a conversa ATUAL?')) {
            fetch(`/api/chatbot/historico/apagar?sessao_id=${currentSessionId}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    currentSessionId = Date.now().toString();
                    carregarHistorico();
                    carregarSessoes();
                })
                .catch(err => alert("Erro ao apagar histórico."));
        }
    });

    // ------------------ LÓGICA DO MODAL ------------------
    const modal = document.getElementById('ia-modal');
    const modalWindow = document.querySelector('.ia-modal-window');
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

    const chatBox = document.getElementById('chat-box');
    const galleryBox = document.getElementById('gallery-box');
    const galleryTitle = document.getElementById('gallery-main-title');
    const gallerySelect = document.getElementById('gallery-period-select');
    const galleryGrid = document.getElementById('gallery-grid');

    let modalDragState = null;
    let modalResizeState = null;

    function salvarEstadoModal() {
        const state = {
            visible: modal.style.display === 'flex' || modal.style.display === 'block',
            top: parseInt(modalWindow.style.top || '0', 10),
            left: parseInt(modalWindow.style.left || '0', 10),
            width: parseInt(modalWindow.style.width || modalWindow.offsetWidth, 10),
            height: parseInt(modalWindow.style.height || modalWindow.offsetHeight, 10)
        };
        localStorage.setItem(IA_MODAL_STATE_KEY, JSON.stringify(state));
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
        modalWindow.style.top = `${top}px`;
        modalWindow.style.left = `${left}px`;
        modalWindow.style.width = `${width}px`;
        modalWindow.style.height = `${height}px`;
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

                new ApexCharts(document.getElementById('grid-linha'), {
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

                new ApexCharts(document.getElementById('grid-barras'), {
                    chart: { type: 'bar', height: '100%', toolbar: { show: false }, background: 'transparent', foreColor: isDarkMode ? '#9ca3af' : '#4b5563' },
                    series: barrasData.series,
                    xaxis: { categories: barrasData.labels, labels: { show: false } },
                    yaxis: { show: false },
                    legend: { show: false },
                    colors: ['#3B82F6', '#EF4444', '#10B981'],
                    dataLabels: { enabled: false },
                    theme: { mode: isDarkMode ? 'dark' : 'light' }
                }).render();

                if (pizzaData && pizzaData.labels) {
                    new ApexCharts(document.getElementById('grid-pizza'), {
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
        new ApexCharts(document.getElementById('chart-modal-render'), options).render();
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

    document.getElementById('btn-galeria-graficos').addEventListener('click', () => abrirGaleriaGraficos());
    document.getElementById('btn-galeria-arquivos').addEventListener('click', () => abrirGaleriaArquivos());

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
