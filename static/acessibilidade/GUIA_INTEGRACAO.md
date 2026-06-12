# 📖 Guia de Integração - Sistema de Acessibilidade

## 1️⃣ Integração Básica

### Passo 1: Atualizar o template base

No arquivo `templates/base.html` (ou equivalente), adicione:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="DataInsight - Análise de Dados Acessível">
    
    <!-- ACESSIBILIDADE (antes de outros CSS) -->
    <link rel="stylesheet" href="{{ url_for('static', filename='acessibilidade/acessibilidade.css') }}">
    
    <!-- Seus outros estilos -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/estilo.css') }}">
    
    <title>{% block title %}DataInsight{% endblock %}</title>
</head>
<body>
    <!-- Sua navbar -->
    {% include 'partials/navbar.html' %}
    
    <!-- Conteúdo principal -->
    <main id="conteudo" role="main">
        {% block content %}{% endblock %}
    </main>
    
    <!-- Footer -->
    {% include 'partials/footer.html' %}
    
    <!-- PAINEL DE ACESSIBILIDADE -->
    {% include 'partials/painel_acessibilidade_avancado.html' %}
    
    <!-- JAVASCRIPT DE ACESSIBILIDADE (último) -->
    <script src="{{ url_for('static', filename='acessibilidade/acessibilidade.js') }}"></script>
</body>
</html>
```

### Passo 2: Adicionar suporte ARIA básico

```html
<!-- Em cada página -->
<main id="conteudo" role="main" aria-label="Conteúdo principal">
    <!-- Seu conteúdo -->
</main>

<!-- Para seções -->
<section role="region" aria-label="Descrição da seção">
    <!-- Conteúdo da seção -->
</section>

<!-- Para ícones -->
<button aria-label="Menu de navegação">☰</button>
```

## 2️⃣ Integração com Gráficos

### Gráficos Chart.js

```html
<!-- HTML -->
<div class="chart-container" role="region" aria-label="Gráfico de vendas">
    <canvas id="chartVendas"></canvas>
</div>

<!-- JavaScript -->
<script>
document.addEventListener('DOMContentLoaded', () => {
  // Seu gráfico
  const ctx = document.getElementById('chartVendas').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Fev', 'Mar', 'Abr'],
      datasets: [{
        label: 'Vendas (R$)',
        data: [1000, 1500, 1200, 2000]
      }]
    }
  });

  // Após gráfico ser renderizado
  if (window.acessibilidade) {
    setTimeout(() => {
      window.acessibilidade.configurarAcessibilidadeGraficos();
    }, 100);
  }
});
</script>
```

### Gráficos Recharts (React)

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

export const MeuGrafico = () => {
  useEffect(() => {
    // Após renderizar
    if (window.acessibilidade) {
      window.acessibilidade.configurarAcessibilidadeGraficos();
    }
  }, []);

  return (
    <div role="region" aria-label="Gráfico de desempenho">
      <LineChart width={600} height={300} data={dados}>
        <CartesianGrid />
        <XAxis dataKey="nome" />
        <YAxis />
        <Line type="monotone" dataKey="vendas" stroke="#8884d8" />
      </LineChart>
    </div>
  );
};
```

### Gráficos D3.js

```javascript
// Após criar o SVG
const svg = d3.select('#meuGrafico')
  .attr('role', 'img')
  .attr('aria-label', 'Gráfico de distribuição');

// Chamar acessibilidade
if (window.acessibilidade) {
  window.acessibilidade.configurarAcessibilidadeGraficos();
}

// Adicionar descrição textual
const descricao = document.createElement('div');
descricao.className = 'desc-grafico';
descricao.innerHTML = `
  <p>Este gráfico mostra a distribuição de [dados] 
  de [período]. Os valores variam de [min] a [max].</p>
`;
svg.parentNode.appendChild(descricao);
```

## 3️⃣ Integração com Formulários

### HTML

```html
<!-- Formulário com labels corretos -->
<form role="form" aria-label="Formulário de cadastro">
  
  <div class="grupo-formulario">
    <label for="nome">
      Nome <span aria-label="obrigatório">*</span>
    </label>
    <input 
      id="nome" 
      type="text" 
      required
      aria-required="true"
      aria-describedby="dica-nome">
    <small id="dica-nome">Mínimo 3 caracteres</small>
  </div>

  <div class="grupo-formulario">
    <label for="email">Email</label>
    <input 
      id="email" 
      type="email"
      aria-describedby="erro-email">
    <span id="erro-email" role="alert" aria-live="polite"></span>
  </div>

  <button type="submit" aria-label="Enviar formulário">
    Enviar
  </button>
</form>
```

### Validação com Feedback Acessível

```javascript
const form = document.querySelector('form');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Validar
  const nome = document.getElementById('nome');
  
  if (nome.value.length < 3) {
    // Anunciar erro
    if (window.acessibilidade) {
      window.acessibilidade.anunciarAos(
        'Erro: Nome deve ter no mínimo 3 caracteres'
      );
    }
    
    // Mostrar erro visualmente
    nome.setAttribute('aria-invalid', 'true');
  } else {
    nome.setAttribute('aria-invalid', 'false');
  }
});
```

## 4️⃣ Integração com Modals/Diálogos

```html
<!-- Modal acessível -->
<div id="modal" role="dialog" aria-labelledby="modal-titulo" aria-modal="true" hidden>
  <div class="modal-conteudo">
    <h2 id="modal-titulo">Confirmar ação</h2>
    
    <p id="modal-descricao">
      Você tem certeza que deseja continuar?
    </p>
    
    <div class="modal-botoes">
      <button aria-label="Cancelar ação">Cancelar</button>
      <button aria-label="Confirmar ação">Confirmar</button>
    </div>
  </div>
</div>
```

```javascript
// Abrir modal
function abrirModal(id) {
  const modal = document.getElementById(id);
  modal.hidden = false;
  modal.focus();
  
  // Anunciar para leitor de tela
  if (window.acessibilidade) {
    window.acessibilidade.anunciarAos('Diálogo aberto: ' + 
      document.getElementById('modal-titulo').textContent);
  }
}

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('modal');
    if (!modal.hidden) {
      modal.hidden = true;
    }
  }
});
```

## 5️⃣ Integração em Backend (Flask)

### Verificar suporte ARIA no template

```html
<!-- Verificar se JavaScript está habilitado -->
<noscript>
  <div role="alert" class="aviso-importante">
    ⚠️ Este site requer JavaScript habilitado para funcionar.
    Por favor, habilite JavaScript no seu navegador.
  </div>
</noscript>

<!-- Fallback para navegadores sem localStorage -->
<script>
  if (!window.localStorage) {
    console.warn('localStorage não disponível. Preferências não serão salvas.');
  }
</script>
```

### Rota Flask para preferências de usuário

```python
from flask import jsonify, session

@app.route('/api/acessibilidade/preferencias', methods=['GET', 'POST'])
@login_required
def preferencias_acessibilidade():
    """Salvar preferências de acessibilidade do usuário"""
    
    if request.method == 'GET':
        # Retornar preferências salvas
        prefs = session.get('acessibilidade_prefs', {})
        return jsonify(prefs)
    
    elif request.method == 'POST':
        # Salvar novas preferências
        dados = request.get_json()
        
        # Validar dados
        preferencias_validas = {
            'escalaFonte': float,
            'tema': str,
            'alto_contraste': bool,
            'modo_dyslexia': bool,
        }
        
        # Salvar na sessão (ou banco de dados)
        for chave, tipo in preferencias_validas.items():
            if chave in dados:
                try:
                    session[f'acess_{chave}'] = tipo(dados[chave])
                except (ValueError, TypeError):
                    return jsonify({'erro': f'Valor inválido para {chave}'}), 400
        
        session.modified = True
        return jsonify({'sucesso': True})

@app.route('/api/acessibilidade/reset', methods=['POST'])
@login_required
def reset_acessibilidade():
    """Resetar preferências de acessibilidade"""
    keys = [k for k in session.keys() if k.startswith('acess_')]
    for key in keys:
        del session[key]
    session.modified = True
    return jsonify({'sucesso': True})
```

## 6️⃣ Testes de Acessibilidade

### Usando Chrome DevTools

1. Abrir DevTools (F12)
2. Ir para aba "Lighthouse"
3. Selecionar "Accessibility"
4. Clicar "Analyze page load"

### Checklist Manual

- [ ] Todos os botões têm `aria-label` ou texto visível
- [ ] Todos os inputs têm `<label>`
- [ ] Cores não são único meio de informação
- [ ] Contraste de texto é 4.5:1 ou melhor
- [ ] Navegação por Tab funciona completamente
- [ ] Foco é sempre visível
- [ ] Imagens têm `alt` text
- [ ] Vídeos têm legendas
- [ ] Não há flashes/piscadas > 3x/segundo
- [ ] Tamanho de toque é 44x44px mínimo

### Teste com Leitor de Tela

```javascript
// Ativar no console
window.acessibilidade.iniciarLeitura();
```

## 7️⃣ Exemplos Completos

### Página Simples com Todos os Recursos

```html
{% extends 'base.html' %}

{% block title %}Dashboard - DataInsight{% endblock %}

{% block content %}
<div role="region" aria-label="Dashboard com gráficos">
  
  <!-- Título com nivel correto -->
  <h1>Dashboard de Vendas</h1>
  
  <!-- Seção com gráfico acessível -->
  <section role="region" aria-label="Gráfico de vendas mensal">
    <h2>Vendas por Mês</h2>
    
    <div class="chart-container">
      <canvas id="chartVendas" role="img" aria-label="Gráfico de linhas com vendas"></canvas>
    </div>
    
    <!-- Tabela alternativa para dados -->
    <details>
      <summary>Ver dados em tabela</summary>
      <table role="table" aria-label="Dados de vendas mensais">
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Vendas</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Janeiro</td><td>R$ 5.000</td></tr>
          <tr><td>Fevereiro</td><td>R$ 7.500</td></tr>
        </tbody>
      </table>
    </details>
  </section>

  <!-- Seção com filtros -->
  <section role="region" aria-label="Filtros de dados">
    <h2>Filtros</h2>
    
    <form aria-label="Formulário de filtros">
      <div class="grupo-formulario">
        <label for="filtro-data">Período:</label>
        <input id="filtro-data" type="date">
      </div>
      
      <button type="button" aria-label="Aplicar filtros">
        Filtrar
      </button>
    </form>
  </section>
</div>

<script>
document.addEventListener('DOMContentLoaded', () => {
  // Seu código de gráfico
  const ctx = document.getElementById('chartVendas').getContext('2d');
  // ... criar gráfico
  
  // Aplicar acessibilidade
  if (window.acessibilidade) {
    window.acessibilidade.configurarAcessibilidadeGraficos();
  }
});
</script>
{% endblock %}
```

## 8️⃣ Suporte Multilíngue

O sistema está em português, mas pode ser customizado:

```javascript
// No acessibilidade.js, alterar:
utterance.lang = "pt-BR"  // Para português
utterance.lang = "en-US"  // Para inglês
utterance.lang = "es-ES"  // Para espanhol
```

## 🔟 Performance e Otimizações

### Carregamento Lazy

```html
<!-- Carregar acessibilidade apenas quando necessário -->
<script>
  // Deferred loading
  window.addEventListener('load', () => {
    const script = document.createElement('script');
    script.src = '{{ url_for("static", filename="acessibilidade/acessibilidade.js") }}';
    document.body.appendChild(script);
  });
</script>
```

### Minificação

```bash
# Minificar JavaScript
npm install -g terser
terser acessibilidade.js -o acessibilidade.min.js

# Minificar CSS
npm install -g csso-cli
csso acessibilidade.css -o acessibilidade.min.css
```

---

**Próximos passos**: Testar em diferentes navegadores e dispositivos!
