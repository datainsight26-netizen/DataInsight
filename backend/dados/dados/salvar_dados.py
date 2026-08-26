from datetime import datetime
from flask import request, jsonify, session
import pandas as pd
import re
import unicodedata
from backend.db import salvar_dados
from backend.dados.dados import limpar_dados, converter_para_tipos_nativos
from backend.dados.quality import analisar_e_limpar


# ============================================================
# AUXILIAR: detecta qual coluna casa com um padrão de nomes
# ============================================================
def _normalizar(texto):
    """Remove acentos e coloca em minúsculas para comparação."""
    texto = unicodedata.normalize('NFD', str(texto).lower())
    return ''.join(c for c in texto if unicodedata.category(c) != 'Mn')


def _detectar_coluna(colunas, padroes, exclusoes=None):
    """Retorna o nome da primeira coluna que casa com algum dos padrões, sem casar com as exclusões."""
    if exclusoes is None:
        exclusoes = []
    for col in colunas:
        col_norm = _normalizar(col)
        if any(re.search(ex, col_norm) for ex in exclusoes):
            continue
        for padrao in padroes:
            if re.search(padrao, col_norm):
                return col
    return None


# ============================================================
# SALVA PRODUTOS NO HISTÓRICO PARA AUTOCOMPLETE
# ============================================================
def extrair_e_salvar_produtos(usuario_id, colunas, dados):
    """
    Detecta colunas de produto/preço/estoque/desconto/categoria/sku
    e salva cada linha não-vazia no histórico de autocomplete.
    """
    if not usuario_id or not colunas or not dados:
        return

    try:
        from backend.produtos import salvar_produto

        # Detecta coluna de nome do produto (obrigatória)
        col_produto = _detectar_coluna(colunas, [
            r'produto', r'product', r'\bnome\b', r'\bname\b', r'\bitem\b',
            r'descri[cç]', r'mercadoria'
        ])

        if not col_produto:
            return  # Sem coluna de produto identificada, não há o que salvar

        # Detecta demais colunas opcionais
        col_preco = _detectar_coluna(colunas, [
            r'pre[cç]o', r'\bpreco\b', r'\bvalor\b', r'\bprice\b', r'unit[a-z]*'
        ], exclusoes=[r'total', r'faturamento', r'receita', r'custo', r'despesa', r'lucro'])
        
        col_estoque = _detectar_coluna(colunas, [
            r'estoque', r'\bstock\b'
        ])
        if not col_estoque:
            col_estoque = _detectar_coluna(colunas, [
                r'quantidade', r'\bqtd\b', r'\bquant\b', r'\bamount\b'
            ])
            
        col_desconto = _detectar_coluna(colunas, [
            r'desconto', r'discount', r'\bdesc\b'
        ])
        col_categoria = _detectar_coluna(colunas, [
            r'categoria', r'category', r'\btipo\b', r'\btype\b', r'\bgrupo\b'
        ])
        col_sku = _detectar_coluna(colunas, [
            r'\bsku\b', r'c[oó]digo', r'\bcod\b', r'\bcode\b', r'\bref\b'
        ])

        salvos = 0
        for linha in dados:
            nome = str(linha.get(col_produto, '')).strip()
            if not nome or nome.lower() in ('', 'none', 'nan'):
                continue

            # Preço
            preco = None
            if col_preco:
                try:
                    val = str(linha.get(col_preco, '')).replace(',', '.').strip()
                    preco = float(val) if val and val not in ('none', 'nan') else None
                except (ValueError, TypeError):
                    preco = None

            # Estoque
            estoque = None
            if col_estoque:
                try:
                    val = str(linha.get(col_estoque, '')).replace(',', '.').strip()
                    estoque = int(float(val)) if val and val not in ('none', 'nan') else None
                except (ValueError, TypeError):
                    estoque = None

            # Desconto — guardado na descrição
            descricao = None
            if col_desconto:
                try:
                    val = str(linha.get(col_desconto, '')).replace(',', '.').strip()
                    if val and val not in ('none', 'nan'):
                        descricao = f"Desconto: {val}"
                except (ValueError, TypeError):
                    pass

            # Categoria
            categoria = None
            if col_categoria:
                cat = str(linha.get(col_categoria, '')).strip()
                categoria = cat if cat and cat.lower() not in ('none', 'nan') else None

            # SKU
            sku = None
            if col_sku:
                s = str(linha.get(col_sku, '')).strip()
                sku = s if s and s.lower() not in ('none', 'nan') else None

            salvar_produto(
                usuario_id=usuario_id,
                nome_produto=nome,
                categoria=categoria,
                preco=preco,
                estoque=estoque,
                sku=sku,
                descricao=descricao
            )
            salvos += 1

        if salvos > 0:
            print(f"[AUTOCOMPLETE] {salvos} produto(s) salvos no historico", flush=True)

    except Exception as e:
        # Não bloqueia o salvamento principal
        print(f"[AVISO] erro ao salvar produtos no historico: {e}", flush=True)


# ============================================================
# ROTA PRINCIPAL
# ============================================================
def salvar_dados_manuais():
    dados_json = request.get_json()

    if not dados_json or "colunas" not in dados_json or "dados" not in dados_json:
        return jsonify({"mensagem": "Dados inválidos"}), 400

    colunas = dados_json.get("colunas", [])
    dados = dados_json.get("dados", [])
    nome_planilha = dados_json.get(
        "nome_planilha",
        f"Planilha_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    )

    usuario_id = session.get('usuario_id')

    try:
        # Converter para DataFrame para aplicar análise e limpeza
        df = pd.DataFrame(dados, columns=colunas)

        # Permite ao frontend controlar se deseja limpeza automática
        auto_clean = bool(dados_json.get('auto_clean', True))

        # Executar análise de qualidade e limpeza automática (conservadora)
        df, relatorio_qualidade = analisar_e_limpar(df, auto_clean=auto_clean)

        # Extrair dados limpos e converter para tipos nativos BSON
        colunas_limpas = [str(c) for c in df.columns.tolist()]
        dados_limpos = converter_para_tipos_nativos(df.to_dict('records'))

        # Salvar no banco de dados principal
        id_salvo = salvar_dados(usuario_id, nome_planilha, colunas_limpas, dados_limpos)

        # ============================================================
        # SALVAR PRODUTOS NO HISTÓRICO PARA AUTOCOMPLETE
        # ============================================================
        extrair_e_salvar_produtos(usuario_id, colunas_limpas, dados_limpos)
        # ============================================================

        return jsonify({
            "mensagem": "Dados salvos com sucesso!",
            "id": str(id_salvo),
            "linhas_processadas": len(dados_limpos),
            "relatorio_qualidade": relatorio_qualidade
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Erro ao salvar dados: {e}", flush=True)
        return jsonify({"mensagem": "Erro ao salvar dados", "erro": str(e)}), 500