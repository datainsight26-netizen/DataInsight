import pandas as pd
import numpy as np
import unicodedata
import re
from typing import Optional

# =====================================================
#  UTILIDADES DE NORMALIZAÇÃO E MAPEAMENTO
# =====================================================

def _normalizar(texto):
    """Remove acentos e coloca em minúsculas para comparação."""
    texto = unicodedata.normalize('NFD', str(texto).lower())
    return ''.join(c for c in texto if unicodedata.category(c) != 'Mn')


def eh_coluna_financeira(nome_coluna: str) -> bool:
    """
    Identifica se uma coluna representa valores financeiros sensíveis
    (Receita, Faturamento, Despesa, Custo, Imposto, Lucro, Margem, Preço, Investimento).
    Para essas colunas, é estritamente proibido inventar valores sintéticos (média ou moda).
    """
    norm = _normalizar(nome_coluna)
    padroes_financeiros = [
        r"receita", r"faturament", r"faturad", r"venda", r"preco", r"valor",
        r"despesa", r"gasto", r"custo", r"imposto", r"tributo", r"taxa", r"aliquota",
        r"lucro", r"resultado", r"margem", r"investiment", r"cmv", r"cpv", r"das",
        r"salario", r"folha", r"pro_labore", r"aluguel", r"fornecedor"
    ]
    for p in padroes_financeiros:
        if re.search(p, norm):
            return True
    return False


def limpar_e_converter_numero(val):
    """Converte valores numéricos bagunçados (com símbolos monetários, vírgula como decimal) para float."""
    if pd.isna(val) or val == "" or str(val).strip().lower() in ("nan", "none", "null", "-", "n/a", "n.a."):
        return 0.0
    val_str = str(val).strip()
    # Remove símbolos monetários, espaços e caracteres especiais comuns
    val_str = re.sub(r'[R\$\€\£\s]', '', val_str)
    
    if not val_str:
        return 0.0

    # Detecta formato: 1.234,56 (PT-BR) vs 1,234.56 (EN)
    if '.' in val_str and ',' in val_str:
        if val_str.find('.') < val_str.find(','):
            # Formato PT-BR: 1.234,56
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            # Formato EN: 1,234.56
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        parts = val_str.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            # Decimal com vírgula: 1234,56
            val_str = val_str.replace(',', '.')
        else:
            # Separador de milhar: 1,234,567
            val_str = val_str.replace(',', '')
    elif '.' in val_str:
        parts = val_str.split('.')
        if len(parts) == 2 and len(parts[1]) == 3:
            # Separador de milhar: 1.234
            val_str = val_str.replace('.', '')
        # else: decimal normal 1234.56, não altera

    try:
        num = float(pd.to_numeric(val_str, errors='coerce'))
        return num if not np.isnan(num) else 0.0
    except Exception:
        return 0.0


def converter_para_tipos_nativos(registros):
    """
    Converte estruturas de dados com tipos numpy (int64, float64, bool_, NaN) 
    para tipos Python puros compatíveis 100% com PyMongo BSON.
    Preserva ausências como None/null em colunas financeiras em vez de converter para 0.0.
    """
    import math
    if not isinstance(registros, list):
        return registros
    limpos = []
    for reg in registros:
        if not isinstance(reg, dict):
            continue
        novo = {}
        for k, v in reg.items():
            col_str = str(k)
            is_fin = eh_coluna_financeira(col_str)
            if v is None:
                novo[col_str] = None if is_fin else ""
            elif isinstance(v, (np.floating, float)):
                if math.isnan(v) or math.isinf(v):
                    novo[col_str] = None if is_fin else ""
                else:
                    novo[col_str] = float(v)
            elif isinstance(v, (np.integer, int)):
                novo[col_str] = int(v)
            elif isinstance(v, (np.bool_, bool)):
                novo[col_str] = bool(v)
            elif isinstance(v, str):
                val_strip = v.strip()
                if val_strip.lower() in ("nan", "none", "null", "") and is_fin:
                    novo[col_str] = None
                else:
                    novo[col_str] = v
            else:
                novo[col_str] = str(v)
        limpos.append(novo)
    return limpos


# =====================================================

def encontrar_coluna_data(df: pd.DataFrame) -> Optional[str]:
    """Retorna o nome da coluna de data, se existir."""
    padroes_data = ['data', 'date', 'periodo', 'period', 'mes', 'month', 'ano', 'year', 'dia', 'day']
    for col in df.columns:
        col_norm = _normalizar(col)
        if any(p == col_norm or col_norm.startswith(p) for p in padroes_data):
            return col
    return None


def converter_datas(df: pd.DataFrame, coluna: str) -> pd.DataFrame:
    """Converte uma coluna para o formato YYYY-MM-DD."""
    if coluna not in df.columns:
        return df

    df = df.copy()
    datas = pd.to_datetime(df[coluna], errors="coerce", dayfirst=True)

    if datas.notna().sum() == 0:
        return df  # nenhuma conversão válida

    df[coluna] = datas.dt.strftime("%Y-%m-%d").fillna("")
    return df


def detectar_tipo_coluna(serie: pd.Series) -> str:
    """
    Identifica o tipo predominante da coluna com base em threshold:
    - 'numerico': ≥60% dos valores são numéricos
    - 'data': ≥60% dos valores são datas válidas
    - 'texto': caso contrário
    - 'vazio': coluna sem valores
    """
    valores = serie.dropna()
    # Também remover strings vazias
    if hasattr(valores, 'str'):
        valores = valores[valores.astype(str).str.strip() != '']

    if len(valores) == 0:
        return "vazio"

    total = len(valores)

    # Teste numérico: tenta converter e verifica percentual de sucesso
    numericos = pd.to_numeric(valores, errors='coerce')
    qtd_numericos = numericos.notna().sum()
    if qtd_numericos / total >= 0.60:
        return "numerico"

    # Teste data: verifica percentual de datas válidas (sem contabilizar NaT como datas)
    try:
        datas = pd.to_datetime(valores, errors='coerce', dayfirst=True)
        qtd_datas = datas.notna().sum()
        if qtd_datas / total >= 0.60:
            return "data"
    except Exception:
        pass

    return "texto"


def validar_completude_dados(df: pd.DataFrame) -> float:
    """Calcula o percentual de preenchimento do DataFrame."""
    total = df.size
    vazios = df.isna().sum().sum() + (df == "").sum().sum()

    if total == 0:
        return 0.0

    return ((total - vazios) / total) * 100


# =====================================================
# PREENCHIMENTO INTELIGENTE
# =====================================================

def preencher_inteligente(df: pd.DataFrame) -> pd.DataFrame:
    """
    Preenche valores vazios de forma conservadora:
    - Colunas financeiras: NUNCA preenche com média ou moda. Preserva nulo para evitar distorção contábil.
    - Numéricos não-financeiros com ≤20% de nulos → média
    - Texto não-financeiro com ≤20% de nulos → moda
    - Mais de 20%: não preenche para evitar distorção
    """
    df = df.copy()

    for col in df.columns:
        # Se for coluna financeira crítica, NÃO imputar média nem moda!
        if eh_coluna_financeira(col):
            mascara_vazio = df[col].isna() | (df[col].astype(str).str.strip().str.lower().isin(['', 'nan', 'none', 'null']))
            total_vazios = mascara_vazio.sum()
            if total_vazios > 0:
                print(f"[AVISO] Coluna financeira '{col}': {total_vazios} valor(es) ausente(s) preservado(s) como nulo (sem imputação artificial de média)")
            continue

        # Considera NaN e strings vazias como vazios
        mascara_vazio = df[col].isna() | (df[col].astype(str).str.strip() == '')
        total_vazios = mascara_vazio.sum()

        if total_vazios == 0:
            continue

        percentual = (total_vazios / len(df)) * 100
        if percentual > 20:
            continue  # evita distorção significativa

        tipo = detectar_tipo_coluna(df[col])

        if tipo == "numerico":
            valores = pd.to_numeric(df[col], errors="coerce")
            media = valores.mean()

            if not np.isnan(media):
                df.loc[mascara_vazio, col] = round(media, 2)
                print(f"[OK] {col}: {total_vazios} nulo(s) preenchido(s) com média ({media:.2f})")

        elif tipo == "texto":
            valores_validos = df.loc[~mascara_vazio, col]

            if not valores_validos.empty:
                moda = valores_validos.mode()

                if not moda.empty:
                    valor = moda.iloc[0]
                    df.loc[mascara_vazio, col] = valor
                    print(f"[OK] {col}: {total_vazios} nulo(s) preenchido(s) com moda ('{valor}')")

    return df


# =====================================================
# LIMPEZA CONSERVADORA (NÃO RENOMEIA COLUNAS)
# =====================================================

def limpar_dados_conservador(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpeza conservadora que PRESERVA os nomes originais das colunas do usuário.
    Realiza apenas:
    1. Remove espaços extras em células de texto
    2. Remove linhas completamente vazias
    3. Converte datetime para string (evitar erros BSON)
    4. Preenche nulos conservadoramente apenas em colunas não financeiras (≤20%)
    5. Preserva nulos/ausências em colunas financeiras sem fillna(0) global
    
    NÃO renomeia colunas, NÃO calcula campos derivados.
    """
    if df.empty:
        return df

    df = df.copy()

    # 1. Remover espaços extras nos nomes de colunas
    df.columns = [str(col).strip() for col in df.columns]

    # Resolver colunas duplicadas após remoção de espaços
    colunas_unicas = []
    contadores = {}
    for col in df.columns:
        if col in contadores:
            contadores[col] += 1
            colunas_unicas.append(f"{col}_{contadores[col]}")
        else:
            contadores[col] = 0
            colunas_unicas.append(col)
    df.columns = colunas_unicas

    # 2. Remover espaços extras em células de texto
    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(
                lambda x: " ".join(str(x).strip().split()) if isinstance(x, str) else x
            )

    print("[OK] Espaços tratados e colunas duplicadas resolvidas")

    # 3. Remover linhas totalmente vazias
    antes = len(df)
    df = df.dropna(how="all")
    # Também remover linhas onde todos os valores são string vazia
    mask_todos_vazios = df.apply(lambda row: all(str(v).strip() == '' for v in row), axis=1)
    df = df[~mask_todos_vazios]
    removidas = antes - len(df)

    if removidas > 0:
        print(f"[OK] {removidas} linha(s) vazia(s) removida(s)")
    else:
        print("[OK] Nenhuma linha vazia encontrada")

    # 4. Converter colunas datetime para strings (evitar erro BSON/MongoDB)
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            non_null = df[col].dropna()
            has_time = (non_null.dt.hour != 0).any() or (non_null.dt.minute != 0).any() if not non_null.empty else False
            fmt = "%Y-%m-%d %H:%M:%S" if has_time else "%Y-%m-%d"
            df[col] = df[col].dt.strftime(fmt).fillna("")
            print(f"[OK] Coluna datetime formatada: {col}")

    # 5. Converter colunas financeiras conhecidas para numérico (apenas as que já são numéricas)
    for col in df.columns:
        tipo = detectar_tipo_coluna(df[col])
        if tipo == "numerico":
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # 6. Preenchimento conservador de nulos (excluindo colunas financeiras)
    df = preencher_inteligente(df)

    # 7. Garantir tipos para MongoDB sem fazer fillna(0) global em campos financeiros
    for col in df.columns:
        if eh_coluna_financeira(col):
            # Preserva ausência como None/NaN em campos financeiros (tratamento local nos cálculos)
            continue
        if df[col].dtype in ["float64", "int64"]:
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].fillna("")

    completude = validar_completude_dados(df)
    print(f"\n[OK] Limpeza conservadora concluída")
    print(f"[OK] Linhas: {df.shape[0]} | Completude: {completude:.2f}%")

    return df


# =====================================================
# LIMPEZA PRINCIPAL (LEGADO — mantida para compatibilidade)
# =====================================================

def limpar_dados(df: pd.DataFrame) -> pd.DataFrame:
    """
    ATENÇÃO: Esta função foi atualizada para NÃO renomear colunas do usuário.
    Delega para limpar_dados_conservador().
    
    Mantida por compatibilidade com código existente que a importa.
    """
    return limpar_dados_conservador(df)