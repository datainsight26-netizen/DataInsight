/**
 * SISTEMA DE AUTOCOMPLETE DE PRODUTOS v2
 * ====================================
 * Busca em tempo real com preenchimento automático
 * Conforme o usuário digita, o sistema:
 * 1. Busca produtos em tempo real
 * 2. Oferece sugestões refinadas
 * 3. Preenche automaticamente os campos
 * 4. Salva o produto se completo
 */

class AutocompleteProdutos {
    constructor(configuracao = {}) {
        // Input de produto (obrigatório)
        this.inputProduto = configuracao.inputProduto;
        
        if (!this.inputProduto) {
            console.warn('❌ Input de produto não fornecido');
            return;
        }
        
        console.log('🔧 Configurando autocomplete para:', this.inputProduto.getAttribute('name') || this.inputProduto.placeholder);
        
        // ✨ NOVO: Procura pelos campos na mesma linha (TR)
        const linha = this.inputProduto.closest('tr');
        
        if (linha) {
            // Usa querySelectorAll para pegar TODOS os inputs do tipo na mesma linha
            this.inputsCategoria = Array.from(linha.querySelectorAll('input[data-coluna-categoria="true"]'));
            this.inputsPreco     = Array.from(linha.querySelectorAll('input[data-coluna-preco="true"]'));
            this.inputsEstoque   = Array.from(linha.querySelectorAll('input[data-coluna-estoque="true"]'));
            this.inputsSku       = Array.from(linha.querySelectorAll('input[data-coluna-sku="true"]'));
            this.inputsDesconto  = Array.from(linha.querySelectorAll('input[data-coluna-desconto="true"]'));

            // Compat: mantém referências singulares para código legado
            this.inputCategoria = this.inputsCategoria[0] || configuracao.inputCategoria || null;
            this.inputPreco     = this.inputsPreco[0]     || configuracao.inputPreco     || null;
            this.inputEstoque   = this.inputsEstoque[0]   || configuracao.inputEstoque   || null;
            this.inputSku       = this.inputsSku[0]       || configuracao.inputSku       || null;
            this.inputDesconto  = this.inputsDesconto[0]  || configuracao.inputDesconto  || null;
        } else {
            // Se não estiver em tabela, usa os fornecidos ou tenta encontrar no documento
            this.inputCategoria = configuracao.inputCategoria || document.querySelector('input[name="categoria"]') || this.encontrarInputCategoria();
            this.inputPreco     = configuracao.inputPreco     || document.querySelector('input[name="preco"]')     || this.encontrarInputPreco();
            this.inputEstoque   = configuracao.inputEstoque   || document.querySelector('input[name="estoque"]')   || this.encontrarInputEstoque();
            this.inputSku       = configuracao.inputSku       || document.querySelector('input[name="sku"]');
            this.inputDesconto  = configuracao.inputDesconto  || document.querySelector('input[name="desconto"]');

            // Para fora de tabela, wrap em arrays
            this.inputsCategoria = this.inputCategoria ? [this.inputCategoria] : [];
            this.inputsPreco     = this.inputPreco     ? [this.inputPreco]     : [];
            this.inputsEstoque   = this.inputEstoque   ? [this.inputEstoque]   : [];
            this.inputsSku       = this.inputSku       ? [this.inputSku]       : [];
            this.inputsDesconto  = this.inputDesconto  ? [this.inputDesconto]  : [];
        }
        
        this.containerSugestoes = configuracao.containerSugestoes || this.criarContainerSugestoes();
        this.delayBusca = configuracao.delayBusca || 200;
        this.minCaracteres = configuracao.minCaracteres || 1;
        
        this.timeoutBusca = null;
        this.ultimaBusca = '';
        this.produtoAtualSelecionado = null;
        
        this.inicializar();
    }
    
    /**
     * Encontra o input de produto por diferentes critérios
     */
    encontrarInputProduto() {
        return document.querySelector('input[name="produto"]') || 
               document.querySelector('input[placeholder*="roduto" i]');
    }
    
    /**
     * Encontra o input de categoria
     */
    encontrarInputCategoria() {
        return document.querySelector('input[name="categoria"]') || 
               document.querySelector('input[placeholder*="ategoria" i]');
    }
    
    /**
     * Encontra o input de preço
     */
    encontrarInputPreco() {
        return document.querySelector('input[name="preco"]') || 
               document.querySelector('input[placeholder*="reço" i]');
    }
    
    /**
     * Encontra o input de estoque
     */
    encontrarInputEstoque() {
        return document.querySelector('input[name="estoque"]') || 
               document.querySelector('input[placeholder*="stoque" i]');
    }
    
    
    /**
     * Cria o container de sugestões se não existir
     */
    criarContainerSugestoes() {
        const container = document.createElement('div');
        container.id = 'autocomplete-sugestoes-' + Math.random().toString(36).substr(2, 6);
        container.className = 'autocomplete-sugestoes';
        container.style.cssText = `
            position: fixed;
            background: var(--fundo-cartao, white);
            border: 2px solid #2563eb;
            border-radius: 8px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            min-width: 300px;
            box-shadow: 0 -4px 16px rgba(37, 99, 235, 0.25);
        `;
        
        // Append to body so it's never clipped by table overflow
        document.body.appendChild(container);
        
        return container;
    }
    
    /**
     * Inicializa os event listeners
     */
    inicializar() {
        if (!this.inputProduto) {
            console.warn('Input de produto não encontrado');
            return;
        }
        
        // Eventos principais
        this.inputProduto.addEventListener('input', (e) => this.handleInput(e));
        this.inputProduto.addEventListener('focus', (e) => this.handleFocus(e));
        this.inputProduto.addEventListener('blur', (e) => setTimeout(() => this.esconderSugestoes(), 200));
        
        // Eventos de teclado para navegação
        this.inputProduto.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Clicar fora
        document.addEventListener('click', (e) => this.handleClickFora(e));
        
        // Reposicionar ou esconder ao rolar/redimensionar
        window.addEventListener('scroll', () => this.esconderSugestoes(), true);
        window.addEventListener('resize', () => this.esconderSugestoes());
    }
    
    /**
     * Trata evento de input (enquanto digita)
     */
    handleInput(event) {
        const termo = event.target.value.trim();
        
        clearTimeout(this.timeoutBusca);
        
        if (termo.length < this.minCaracteres) {
            this.esconderSugestoes();
            return;
        }
        
        if (termo === this.ultimaBusca) {
            return;
        }
        
        // Busca com delay menor para ser responsivo
        this.timeoutBusca = setTimeout(() => {
            this.buscarProdutos(termo);
        }, this.delayBusca);
    }
    
    /**
     * Trata foco no input
     */
    handleFocus(event) {
        const termo = event.target.value.trim();
        
        if (termo.length >= this.minCaracteres) {
            this.buscarProdutos(termo);
        }
    }
    
    /**
     * Trata navegação por teclado
     */
    handleKeyboard(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            
            const items = this.containerSugestoes.querySelectorAll('.autocomplete-item');
            if (items.length === 0) return;
            
            let indiceAtual = Array.from(items).findIndex(item => 
                item.classList.contains('autocomplete-item-selecionado')
            );
            
            if (event.key === 'ArrowDown') {
                indiceAtual = (indiceAtual + 1) % items.length;
            } else {
                indiceAtual = indiceAtual <= 0 ? items.length - 1 : indiceAtual - 1;
            }
            
            items.forEach(item => item.classList.remove('autocomplete-item-selecionado'));
            items[indiceAtual].classList.add('autocomplete-item-selecionado');
            items[indiceAtual].scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter') {
            event.preventDefault();
            
            const itemSelecionado = this.containerSugestoes.querySelector('.autocomplete-item-selecionado');
            if (itemSelecionado) {
                itemSelecionado.click();
            }
        } else if (event.key === 'Escape') {
            this.esconderSugestoes();
        }
    }
    
    /**
     * Trata clique fora
     */
    handleClickFora(event) {
        if (event.target !== this.inputProduto && 
            !this.containerSugestoes.contains(event.target)) {
            this.esconderSugestoes();
        }
    }
    
    
    /**
     * Busca produtos via API
     */
    async buscarProdutos(termo) {
        try {
            console.log(`🔍 Buscando: "${termo}"`);
            
            const response = await fetch(`/api/produtos/buscar?termo=${encodeURIComponent(termo)}&limite=15`);
            const dados = await response.json();
            
            if (dados.sucesso && dados.produtos.length > 0) {
                this.mostrarSugestoes(dados.produtos, termo);
                this.ultimaBusca = termo;
                
                console.log(`✓ ${dados.produtos.length} produto(s) encontrado(s)`);
            } else {
                this.esconderSugestoes();
            }
        } catch (erro) {
            console.error('❌ Erro ao buscar produtos:', erro);
        }
    }
    
    /**
     * Mostra as sugestões com estilo melhorado
     */
    mostrarSugestoes(produtos, termo) {
        this.containerSugestoes.innerHTML = '';
        
        produtos.forEach((produto, indice) => {
            const elemento = this.criarElementoSugestao(produto, termo, indice === 0);
            this.containerSugestoes.appendChild(elemento);
        });
        
        this.containerSugestoes.style.display = 'block';
        
        // Position the dropdown above the input to avoid being clipped
        this.posicionarDropdown();
        
        // ⚡ NOVO: Preenche automaticamente se encontrar um match muito bom
        if (produtos.length > 0) {
            setTimeout(() => {
                this.verificarEPreencherAutomaticamente(produtos, termo);
            }, 150);
        }
    }
    
    /**
     * Posiciona o dropdown acima do input usando position: fixed
     */
    posicionarDropdown() {
        if (!this.inputProduto || !this.containerSugestoes) return;
        
        const rect = this.inputProduto.getBoundingClientRect();
        const dropdownHeight = this.containerSugestoes.offsetHeight;
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        
        // Set width to match input width (min 300px)
        const width = Math.max(rect.width, 300);
        this.containerSugestoes.style.width = width + 'px';
        this.containerSugestoes.style.left = rect.left + 'px';
        
        // Show above the input if there's not enough space below, or always above
        if (spaceAbove > dropdownHeight || spaceAbove > spaceBelow) {
            // Position above
            this.containerSugestoes.style.top = 'auto';
            this.containerSugestoes.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
            this.containerSugestoes.style.borderRadius = '8px 8px 4px 4px';
            this.containerSugestoes.style.boxShadow = '0 -4px 16px rgba(37, 99, 235, 0.25)';
        } else {
            // Position below (fallback if more space below)
            this.containerSugestoes.style.bottom = 'auto';
            this.containerSugestoes.style.top = (rect.bottom + 4) + 'px';
            this.containerSugestoes.style.borderRadius = '4px 4px 8px 8px';
            this.containerSugestoes.style.boxShadow = '0 4px 16px rgba(37, 99, 235, 0.25)';
        }
    }
    
    /**
     * ⚡ Verifica se há um match muito bom e preenche automaticamente
     */
    async verificarEPreencherAutomaticamente(produtos, termo) {
        let produtoSelecionado = null;
        
        // Tenta match exato primeiro
        produtoSelecionado = produtos.find(p => 
            p.nome_produto.toLowerCase().trim() === termo.toLowerCase().trim()
        );
        
        // Se não encontrou exato, usa o primeiro resultado
        if (!produtoSelecionado && produtos.length > 0) {
            produtoSelecionado = produtos[0];
        }
        
        if (produtoSelecionado) {
            await this.preencherAutomaticamente(produtoSelecionado);
        }
    }
    
    /**
     * Extrai o valor de desconto da descricao (formato "Desconto: X")
     */
    extractDesconto(descricao) {
        if (!descricao) return null;
        const match = String(descricao).match(/Desconto:\s*([\d.,]+)/i);
        return match ? match[1] : null;
    }

    /**
     * Preenche TODOS os inputs de um array com o mesmo valor
     */
    preencherCampos(inputs, valor, label) {
        if (!inputs || !inputs.length) return;
        inputs.forEach(input => this.preencherCampo(input, valor, label));
    }

    /**
     * ⚡ Preenche os campos com dados do produto selecionado
     */
    async preencherAutomaticamente(produto) {
        try {
            const response = await fetch(`/api/produtos/obter/${encodeURIComponent(produto.nome_produto)}`);
            const dados = await response.json();
            
            if (dados.sucesso && dados.produto) {
                const p = dados.produto;
                console.log('📝 Auto-preenchendo campos:', p);

                // Preenche TODOS os inputs de cada tipo na linha
                this.preencherCampos(this.inputsCategoria, p.categoria, '📁');
                this.preencherCampos(this.inputsPreco,     p.preco,     '💰');
                this.preencherCampos(this.inputsEstoque,   p.estoque,   '📦');
                this.preencherCampos(this.inputsSku,       p.sku,       '🔖');

                // Desconto: extrai da descricao
                const desconto = this.extractDesconto(p.descricao);
                if (desconto !== null) {
                    this.preencherCampos(this.inputsDesconto, desconto, '🏷');
                }
                
                console.log(`✅ Auto-preenchido com sucesso: ${produto.nome_produto}`);
            } else {
                console.warn('⚠️ Produto não encontrado:', produto.nome_produto);
            }
        } catch (erro) {
            console.error('❌ Erro ao auto-preencher:', erro);
        }
    }
    
    /**
     * Cria um elemento de sugestão com estilo melhorado
     */
    criarElementoSugestao(produto, termo, primeiroItem) {
        const div = document.createElement('div');
        div.className = 'autocomplete-item' + (primeiroItem ? ' autocomplete-item-selecionado' : '');
        div.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: all 0.15s;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
        `;
        
        div.onmouseover = () => {
            div.style.background = '#f0f4ff';
            div.classList.add('autocomplete-item-selecionado');
            // Remove seleção de outros itens
            this.containerSugestoes.querySelectorAll('.autocomplete-item').forEach(item => {
                if (item !== div) item.classList.remove('autocomplete-item-selecionado');
            });
        };
        
        div.onmouseout = () => {
            div.style.background = 'transparent';
            if (!div.classList.contains('autocomplete-item-selecionado')) {
                div.classList.remove('autocomplete-item-selecionado');
            }
        };
        
        // Destaca o termo buscado no nome do produto
        const nomeProduto = produto.nome_produto || '';
        const nomeDest = this.destacarTexto(nomeProduto, termo);
        
        // HTML com informações do produto
        let html = `<div style="flex: 1; min-width: 0;">
                        <strong style="color: #1f2937;">${nomeDest}</strong>`;
        
        if (produto.categoria) {
            html += `<br><small style="color: #9ca3af; font-size: 12px;">📁 ${this.escaparHtml(produto.categoria)}</small>`;
        }
        
        html += `</div><div style="text-align: right; white-space: nowrap;">`;
        
        if (produto.preco) {
            html += `<div style="color: #059669; font-weight: 600; font-size: 13px;">R$ ${parseFloat(produto.preco).toFixed(2)}</div>`;
        }
        
        if (produto.estoque !== null && produto.estoque !== undefined) {
            html += `<small style="color: #6b7280; font-size: 11px;">Est: ${produto.estoque}</small>`;
        }
        
        html += `</div>`;
        
        div.innerHTML = html;
        
        div.addEventListener('click', () => {
            this.selecionarProduto(produto);
        });
        
        return div;
    }
    
    /**
     * Destaca o texto buscado no resultado
     */
    destacarTexto(texto, termo) {
        if (!termo) return this.escaparHtml(texto);
        
        const regex = new RegExp(`(${this.escaparRegex(termo)})`, 'gi');
        const partes = texto.split(regex);
        
        return partes.map(parte => {
            if (regex.test(parte)) {
                return `<mark style="background: #fef08a; font-weight: 600;">${this.escaparHtml(parte)}</mark>`;
            }
            return this.escaparHtml(parte);
        }).join('');
    }
    
    /**
     * Escapa caracteres especiais em regex
     */
    escaparRegex(texto) {
        return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    
    /**
     * Trata seleção de um produto
     */
    async selecionarProduto(produto) {
        console.log(`✅ Produto selecionado: ${produto.nome_produto}`);
        
        this.inputProduto.value = produto.nome_produto;
        this.triggerChange(this.inputProduto);
        this.produtoAtualSelecionado = produto;
        
        // Busca dados completos do produto
        try {
            const response = await fetch(`/api/produtos/obter/${encodeURIComponent(produto.nome_produto)}`);
            const dados = await response.json();
            
            if (dados.sucesso && dados.produto) {
                const p = dados.produto;

                // Preenche TODOS os inputs de cada tipo na linha
                this.preencherCampos(this.inputsCategoria, p.categoria, '📁 Categoria');
                this.preencherCampos(this.inputsPreco,     p.preco,     '💰 Preço');
                this.preencherCampos(this.inputsEstoque,   p.estoque,   '📦 Estoque');
                this.preencherCampos(this.inputsSku,       p.sku,       '🔖 SKU');

                // Desconto: extrai da descricao
                const desconto = this.extractDesconto(p.descricao);
                if (desconto !== null) {
                    this.preencherCampos(this.inputsDesconto, desconto, '🏷 Desconto');
                }
                
                // Dispara evento customizado
                this.inputProduto.dispatchEvent(new CustomEvent('produtoSelecionado', {
                    detail: p
                }));
                
                // Salva o produto automaticamente
                setTimeout(() => {
                    this.salvarProdutoAutomaticamente(p);
                }, 300);
            }
        } catch (erro) {
            console.error('❌ Erro ao obter dados do produto:', erro);
        }
        
        this.esconderSugestoes();
    }
    
    /**
     * Preenche um campo com animação
     */
    preencherCampo(campo, valor, label) {
        if (!campo) return;
        
        if (valor !== null && valor !== undefined) {
            const valorAnterior = campo.value;
            
            // Animação: destaca o campo
            campo.style.background = '#fef3c7';
            campo.value = valor;
            this.triggerChange(campo);
            
            console.log(`  ✓ ${label}: ${valor}`);
            
            // Remove animação após 1s
            setTimeout(() => {
                campo.style.background = '';
            }, 1000);
        }
    }
    
    /**
     * Salva o produto automaticamente
     */
    async salvarProdutoAutomaticamente(dados) {
        try {
            const response = await fetch('/api/produtos/salvar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nome_produto: dados.nome_produto,
                    categoria: dados.categoria,
                    preco: dados.preco,
                    estoque: dados.estoque,
                    sku: dados.sku,
                    descricao: dados.descricao
                })
            });
            
            const resultado = await response.json();
            
            if (resultado.sucesso) {
                console.log('💾 Produto salvo no histórico');
            }
        } catch (erro) {
            console.error('Erro ao salvar produto:', erro);
        }
    }
    
    /**
     * Esconde as sugestões
     */
    esconderSugestoes() {
        this.containerSugestoes.style.display = 'none';
    }
    
    /**
     * Dispara evento de mudança no elemento
     */
    triggerChange(elemento) {
        if (elemento) {
            elemento.dispatchEvent(new Event('change', { bubbles: true }));
            elemento.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    /**
     * Escapa caracteres especiais em HTML
     */
    escaparHtml(texto) {
        if (!texto) return '';
        const div = document.createElement('div');
        div.textContent = texto;
        return div.innerHTML;
    }
}

/**
 * ==================== FUNÇÕES GLOBAIS ====================
 */

/**
 * Função para salvar um produto manualmente
 */
async function salvarProdutoAutomaticamente(dados) {
    try {
        const response = await fetch('/api/produtos/salvar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome_produto: dados.nomeProduto || dados.nome_produto,
                categoria: dados.categoria,
                preco: dados.preco,
                estoque: dados.estoque,
                sku: dados.sku || dados.codigo,
                descricao: dados.descricao
            })
        });
        
        const resultado = await response.json();
        
        if (resultado.sucesso) {
            console.log('✅ Produto salvo:', resultado.produto_id);
            return resultado.produto_id;
        } else {
            console.error('❌ Erro:', resultado.erro);
        }
    } catch (erro) {
        console.error('❌ Erro na requisição:', erro);
    }
}

/**
 * Função para obter categorias
 */
async function obterCategoriasCadastradas() {
    try {
        const response = await fetch('/api/produtos/categorias');
        const dados = await response.json();
        
        if (dados.sucesso) {
            return dados.categorias;
        }
    } catch (erro) {
        console.error('Erro ao obter categorias:', erro);
    }
    return [];
}

/**
 * Função para obter um produto específico
 */
async function obterProduto(nomeProduto) {
    try {
        const response = await fetch(`/api/produtos/obter/${encodeURIComponent(nomeProduto)}`);
        const dados = await response.json();
        
        if (dados.sucesso) {
            return dados.produto;
        }
    } catch (erro) {
        console.error('Erro ao obter produto:', erro);
    }
    return null;
}

/**
 * Função para buscar produtos
 */
async function buscarProdutosPorNome(termo, limite = 10) {
    try {
        const response = await fetch(`/api/produtos/buscar?termo=${encodeURIComponent(termo)}&limite=${limite}`);
        const dados = await response.json();
        
        if (dados.sucesso) {
            return dados.produtos;
        }
    } catch (erro) {
        console.error('Erro ao buscar produtos:', erro);
    }
    return [];
}

/**
 * Sistema de Detecção Dinâmica de Novos Inputs
 */
const AutocompleteManager = {
    instancias: new WeakMap(),
    inicializado: false,
    
    /**
     * Inicializa ou reutiliza autocomplete para um input
     */
    inicializarInput(input) {
        if (!input || input.tagName !== 'INPUT') return false;
        
        const ehProduto = this.ehInputProduto(input);
        if (!ehProduto) return false;
        
        // Verifica se já tem autocomplete
        if (this.instancias.has(input)) {
            return true;
        }
        
        try {
            // Cria nova instância
            const instancia = new AutocompleteProdutos({ inputProduto: input });
            this.instancias.set(input, instancia);
            console.log('✅ Autocomplete inicializado para:', input.getAttribute('name') || input.placeholder);
            return true;
        } catch (erro) {
            console.error('❌ Erro ao inicializar autocomplete:', erro);
            return false;
        }
    },
    
    /**
     * Verifica se é um input de produto
     */
    ehInputProduto(element) {
        if (!element || element.tagName !== 'INPUT') return false;
        
        const attrs = (element.getAttribute('placeholder') || '') + (element.getAttribute('name') || '') + (element.getAttribute('data-coluna-produto') || '');
        
        return /produto|product|nome_produto/i.test(attrs) || element.getAttribute('name') === 'produto' || element.getAttribute('data-coluna-produto') === 'true';
    },
    
    /**
     * Inicializa todos os inputs existentes
     */
    inicializarTodos() {
        console.log('🔍 Procurando por inputs de produto...');
        
        // Procura por inputs com atributo name="produto"
        const inputs = document.querySelectorAll(
            'input[name="produto"], input[data-coluna-produto="true"]'
        );
        
        let inicializados = 0;
        inputs.forEach(input => {
            if (this.inicializarInput(input)) {
                inicializados++;
            }
        });
        
        console.log(`📝 ${inicializados} input(s) de produto inicializado(s)`);
        return inicializados > 0;
    },
    
    /**
     * Monitora mudanças no DOM
     */
    monitorarDOM() {
        const tbody = document.querySelector('#dados-tbody');
        if (!tbody) {
            console.warn('⚠️ tbody não encontrado');
            return;
        }
        
        const observer = new MutationObserver((mutations) => {
            console.log('👀 DOM alterado detectado');
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Se adicionou novos elementos
                    if (mutation.addedNodes.length > 0) {
                        console.log(`  Adicionados ${mutation.addedNodes.length} nó(s)`);
                        
                        // Procura por inputs de produto nos nós adicionados
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // Se é uma linha (TR)
                                if (node.tagName === 'TR') {
                                    const inputs = node.querySelectorAll('input[name="produto"]');
                                    inputs.forEach(input => this.inicializarInput(input));
                                }
                                // Se são inputs diretos
                                else if (node.tagName === 'INPUT') {
                                    this.inicializarInput(node);
                                }
                                // Se contém inputs dentro
                                else {
                                    node.querySelectorAll('input[name="produto"]').forEach(input => {
                                        this.inicializarInput(input);
                                    });
                                }
                            }
                        });
                    }
                }
            });
        });
        
        observer.observe(tbody, { 
            childList: true, 
            subtree: false // Apenas verificar mudanças diretas no tbody
        });
        
        console.log('🔍 Monitor de DOM ativado para tbody');
    }
};

/**
 * Inicialização automática quando o DOM está pronto
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado - Inicializando sistema de autocomplete');
    
    // Aguarda um pouco para garantir que tudo foi carregado
    setTimeout(() => {
        // Inicializa inputs existentes
        AutocompleteManager.inicializarTodos();
        
        // Monitora para novos inputs adicionados dinamicamente
        AutocompleteManager.monitorarDOM();
        
        AutocompleteManager.inicializado = true;
        console.log('✅ Sistema de autocomplete pronto!');
    }, 500);
});

/**
 * Também tenta inicializar quando o documento está completamente carregado
 */
window.addEventListener('load', () => {
    if (!AutocompleteManager.inicializado) {
        console.log('⚡ Tentando inicializar no evento load');
        AutocompleteManager.inicializarTodos();
    }
});

// Exporta para uso em outros scripts
window.AutocompleteProdutos = AutocompleteProdutos;
window.AutocompleteManager = AutocompleteManager;
window.salvarProdutoAutomaticamente = salvarProdutoAutomaticamente;
window.obterCategoriasCadastradas = obterCategoriasCadastradas;
window.obterProduto = obterProduto;
window.buscarProdutosPorNome = buscarProdutosPorNome;

