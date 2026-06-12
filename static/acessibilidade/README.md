# Sistema Avançado de Acessibilidade - DataInsight

## 🎯 Visão Geral

Um sistema completo, profissional e performático de acessibilidade que suporta múltiplas deficiências:
- **Visuais**: Daltonismo, baixa visão, cegueira
- **Motoras**: Controle aprimorado por teclado
- **Cognitivas**: Modo dislexia, redução de movimento
- **Auditivas**: Descrição visual de elementos

## 📦 Arquivos Inclusos

```
static/
└── acessibilidade/
    ├── acessibilidade.js      # Sistema completo (novo)
    └── acessibilidade.css     # Estilos de acessibilidade (novo)

templates/
└── partials/
    └── painel_acessibilidade_avancado.html  # Painel interativo (novo)
```

## 🚀 Como Integrar

### 1. Incluir CSS no `<head>` do seu HTML

```html
<!-- No início do <head> para prioridade máxima -->
<link rel="stylesheet" href="{{ url_for('static', filename='acessibilidade/acessibilidade.css') }}">
```

### 2. Incluir o Painel HTML

```html
<!-- Antes do fechamento do </body> -->
{% include 'partials/painel_acessibilidade_avancado.html' %}
```

### 3. Incluir JavaScript no final de `</body>`

```html
<script src="{{ url_for('static', filename='acessibilidade/acessibilidade.js') }}"></script>
```

### Estrutura Completa no HTML

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Seu Site</title>
    
    <!-- Acessibilidade CSS (ANTES de outros estilos) -->
    <link rel="stylesheet" href="{{ url_for('static', filename='acessibilidade/acessibilidade.css') }}">
    
    <!-- Seus outros estilos -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/estilo.css') }}">
</head>
<body>
    <!-- Seu conteúdo -->
    <main id="conteudo" role="main">
        <!-- Conteúdo principal -->
    </main>
    
    <!-- Painel de Acessibilidade -->
    {% include 'partials/painel_acessibilidade_avancado.html' %}
    
    <!-- Scripts -->
    <script src="{{ url_for('static', filename='acessibilidade/acessibilidade.js') }}"></script>
</body>
</html>
```

## 💡 Funcionalidades Principais

### 1. **Controle de Fonte**
- Aumentar/Diminuir (0.8x a 2.0x)
- Resetar ao padrão
- Salva preferência automaticamente

**Atalhos:** `Alt+T` (aumentar), `Alt+M` (diminuir)

### 2. **Temas Visuais**
- **Padrão**: Tema normal da aplicação
- **Modo Escuro**: Ideal para ambientes com pouca luz
- **Modo Sepia**: Tons quentes, menos cansativo
- **Modo Leitura**: Interface simplificada para leitura contínua
- **Alto Contraste**: Cores vibrantes para melhor legibilidade

### 3. **Filtros para Daltonismo**
Detecta e adapta as cores para:
- Deuteranopia (Verde-Vermelho)
- Protanopia (Vermelho-Verde)
- Tritanopia (Azul-Amarelo)
- Acromatopsia (Sem cores)

### 4. **Modo Dislexia**
- Fonte sans-serif fácil de ler
- Espaçamento aumentado entre letras e palavras
- Tamanho de fonte aumentado automaticamente
- Layout com menos poluição visual

### 5. **Leitura por Voz (Text-to-Speech)**
- Lê o conteúdo da página em voz alta
- Controle de velocidade (0.75x a 1.5x)
- Controle de volume
- Pausa/Retomada

**Atalhos:** `Alt+L` (ler), `Alt+S` (parar)

### 6. **Acessibilidade em Gráficos**
- Descrição textual de cada gráfico
- Tabela de dados alternativa
- Sonorização de dados (expandível)
- Suporte ARIA completo

### 7. **Navegação por Teclado**
| Atalho | Ação |
|--------|------|
| `Alt+A` | Abrir/Fechar painel |
| `Alt+T` | Aumentar fonte |
| `Alt+M` | Diminuir fonte |
| `Alt+L` | Ler página |
| `Alt+S` | Parar leitura |
| `Alt+R` | Ir para conteúdo principal |
| `ESC` | Fechar painel |
| `Tab` | Navegar entre elementos |

### 8. **Indicadores Visuais de Foco**
- Outline dourado padrão
- Outline roxo em alto contraste
- Outline ciano com brilho em foco realçado
- Totalmente personalizável

### 9. **Redução de Movimento**
- Remove animações quando detectado `prefers-reduced-motion`
- Desativa transições suaves
- Remove paralaxe e efeitos de movimento

### 10. **Espaçamento Amplo**
- Aumenta padding/margin de elementos
- Mínimo de 44px para cliques (recomendação WCAG)
- Facilita para usuários com tremor ou mobilidade reduzida

## 🔧 Configuração via JavaScript

### Acessar o Gerenciador

```javascript
// Aguardar inicialização
document.addEventListener('DOMContentLoaded', () => {
  const acessibilidade = window.acessibilidade;
  
  // Usar métodos
  acessibilidade.aumentarFonte();
  acessibilidade.mudarTema('escuro');
  acessibilidade.iniciarLeitura();
});
```

### Exemplos de Uso

```javascript
// Obter preferência atual
const temaAtual = window.acessibilidade.prefs.obter('tema');

// Definir preferência
window.acessibilidade.prefs.definir('alto_contraste', true);

// Obter todas as preferências
const todasAsPrefs = window.acessibilidade.prefs.obterTodos();

// Resetar todas as preferências
window.acessibilidade.prefs.resetar();

// Fazer anúncio para leitor de tela
window.acessibilidade.anunciarAos('Página carregada com sucesso');
```

## 📊 Acessibilidade em Gráficos

### Adicionar Descrição em Gráficos

Para cada gráfico na sua página, adicione:

```html
<div class="chart-container">
  <!-- Seu gráfico aqui -->
  <canvas id="meuGrafico" role="img" aria-label="Gráfico de vendas"></canvas>
</div>
```

O sistema automaticamente adiciona:
- ✅ Botão de descrição
- ✅ Tabela de dados alternativa
- ✅ Suporte ARIA completo

### Dados Alternativos Personalizados

```html
<div class="tabela-dados-grafico" role="table">
  <thead><tr><th>Período</th><th>Vendas</th></tr></thead>
  <tbody>
    <tr><td>Janeiro</td><td>R$ 5.000</td></tr>
    <tr><td>Fevereiro</td><td>R$ 7.500</td></tr>
  </tbody>
</table>
```

## 💾 Armazenamento de Preferências

Todas as preferências são salvas em `localStorage` com o prefixo `acc_`:

```javascript
// Estrutura salva
{
  "acc_preferencias": {
    "escalaFonte": 1.2,
    "tema": "escuro",
    "alto_contraste": false,
    "modo_dyslexia": false,
    "remover_animacoes": false,
    "reduzir_movimento": false,
    "modo_leitura": "normal",
    "velocidade_voz": 1,
    "volume_voz": 1,
    "filtro_daltonismo": "nenhum",
    "alto_foco_visual": false,
    "modo_fonte_sans": false,
    "espacamento_aumentado": false,
    "cor_foco": "padrao",
    "leitor_ativo": false,
    "som_notificacoes": true,
    "descricao_graficos": true
  }
}
```

### Limpar Preferências

```javascript
// Resetar tudo
localStorage.removeItem('acc_preferencias');

// Ou via gerenciador
window.acessibilidade.resetarTudo();
```

## 🎨 Personalização CSS

### Modificar Cores de Tema

```css
:root {
  --cor-foco: #00FF00;  /* Mude a cor do foco */
  --cor-primaria: #FF0000;
  --cor-secundaria: #0000FF;
}
```

### Modificar Tamanhos Mínimos de Clique

```css
button, a, input {
  min-height: 56px;  /* Padrão WCAG 2.5: 56px */
  min-width: 56px;
}
```

## ♿ Conformidade com Padrões

### WCAG 2.1

- ✅ **Critério 1.4.4**: Redimensionamento de texto (200%)
- ✅ **Critério 1.4.11**: Contraste não-textual (3:1)
- ✅ **Critério 2.1.1**: Teclado (todas funções acessíveis)
- ✅ **Critério 2.4.7**: Focus visível
- ✅ **Critério 2.5.5**: Tamanho alvo (44x44px)
- ✅ **Critério 4.1.3**: Mensagens de status (ARIA live)

### ARIA (Accessible Rich Internet Applications)

- ✅ `aria-label`: Labels descritivos
- ✅ `aria-expanded`: Estado de expansão
- ✅ `aria-live`: Anúncios para leitores de tela
- ✅ `role`: Definição de papéis semânticos
- ✅ `aria-controls`: Relacionamento entre elementos

## 🚀 Performance

### Otimizações Implementadas

1. **Event Delegation**: Menos listeners de eventos
2. **Debounce**: Chamadas de função otimizadas
3. **LocalStorage Cache**: Rápido carregamento de preferências
4. **CSS Variables**: Mudanças de tema sem reflow
5. **Lazy Loading**: Carregamento sob demanda

### Tamanho

- `acessibilidade.js`: ~15KB (minificado: ~5KB)
- `acessibilidade.css`: ~12KB (minificado: ~4KB)

## 🐛 Troubleshooting

### Painel não aparece
```javascript
// Verificar se o DOM está pronto
console.log(document.getElementById('painelAcessibilidade'));
```

### Leitura por voz não funciona
```javascript
// Verificar suporte
console.log('speechSynthesis' in window);
```

### Preferências não salvam
```javascript
// Verificar localStorage
console.log(localStorage.getItem('acc_preferencias'));
```

### Focus não está visível
```css
/* Garantir que focus-visible não está sendo sobrescrito */
*:focus-visible {
  outline: 3px solid #FFD700 !important;
  outline-offset: 2px !important;
}
```

## 📱 Suporte Navegadores

| Navegador | Versão | Status |
|-----------|--------|--------|
| Chrome | 90+ | ✅ Suportado |
| Firefox | 88+ | ✅ Suportado |
| Safari | 14+ | ✅ Suportado |
| Edge | 90+ | ✅ Suportado |
| Opera | 76+ | ✅ Suportado |
| IE11 | - | ⚠️ Sem suporte |

## 🔐 Segurança

- Sem coleta de dados pessoais
- Preferências armazenadas localmente
- Sem requisições externas
- Código auditável e open-source

## 📞 Suporte

Para problemas ou sugestões:
1. Verificar console do navegador (F12)
2. Testar em modo anônimo
3. Tentar resetar preferências
4. Consultar documentação WCAG

## 📚 Referências

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Web Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

**Versão**: 2.0  
**Data**: 2026  
**Licença**: MIT
