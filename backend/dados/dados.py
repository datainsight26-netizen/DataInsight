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


def limpar_e_converter_numero(val):
    """Converte valores numéricos bagunçados (com símbolos monetários, vírgula como decimal) para float."""
    if pd.isna(val) or val == "" or str(val).strip().lower() in ("nan", "none", "null"):
        return 0.0
    val_str = str(val).strip()
    val_str = re.sub(r'[R\$\€\s]', '', val_str)
    
    if not val_str:
        return 0.0
        
    if '.' in val_str and ',' in val_str:
        if val_str.find('.') < val_str.find(','):
            val_str = val_str.replace('.', '').replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif ',' in val_str:
        parts = val_str.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            val_str = val_str.replace(',', '.')
        else:
            val_str = val_str.replace(',', '')
    elif '.' in val_str:
        parts = val_str.split('.')
        if len(parts) == 2 and len(parts[1]) == 3:
            val_str = val_str.replace('.', '')
            
    try:
        num = float(pd.to_numeric(val_str, errors='coerce'))
        return num if not np.isnan(num) else 0.0
    except Exception:
        return 0.0
# =====================================================

def encontrar_coluna_data(df: pd.DataFrame) -> Optional[str]:
    """Retorna o nome da coluna de data, se existir."""
    colunas_possiveis = ["data", "date", "data_criacao", "data_nascimento"]
    return next((col for col in df.columns if col.lower() in colunas_possiveis), None)


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
    """Identifica o tipo predominante da coluna."""
    valores = serie.dropna()

    if valores.empty:
        return "vazio"

    # Teste numérico
    try:
        pd.to_numeric(valores)
        return "numerico"
    except:
        pass

    # Teste data
    try:
        pd.to_datetime(valores, errors="coerce", dayfirst=True)
        return "data"
    except:
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
    Preenche valores vazios:
    - Numéricos → média
    - Texto → moda
    """
    df = df.copy()

    for col in df.columns:
        vazios = df[col].isna() | (df[col] == "")
        total_vazios = vazios.sum()

        if total_vazios == 0:
            continue

        percentual = (total_vazios / len(df)) * 100
        if percentual > 50:
            continue  # evita distorção

        tipo = detectar_tipo_coluna(df[col])

        # =========================
        # NUMÉRICO → MÉDIA
        # =========================
        if tipo == "numerico":
            valores = pd.to_numeric(df[col], errors="coerce")
            media = valores.mean()

            if not np.isnan(media):
                df.loc[vazios, col] = media
                print(f"[OK] {col}: {total_vazios} preenchidos com media ({media:.2f})")

        # =========================
        # TEXTO → MODA
        # =========================
        elif tipo == "texto":
            valores_validos = df.loc[~vazios, col]

            if not valores_validos.empty:
                moda = valores_validos.mode()

                if not moda.empty:
                    valor = moda.iloc[0]
                    df.loc[vazios, col] = valor
                    print(f"[OK] {col}: {total_vazios} preenchidos com moda ('{valor}')")

    return df


# =====================================================
# LIMPEZA PRINCIPAL
# =====================================================

def limpar_dados(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpeza conservadora com melhoria estatística:
    - Mapeia e alinha automaticamente colunas bagunçadas
    - Calcula valores ausentes (Lucro = Faturamento - Despesas, etc.)
    - Remove espaços e resolve duplicatas
    - Remove linhas totalmente vazias
    - Formata datas
    - Preenche dados automaticamente
    """

    if df.empty:
        return df

    df = df.copy()

    # ============================================================
    # 1. AUTO-MAPEAMENTO E ALINHAMENTO DE COLUNAS BAGUNÇADAS
    # ============================================================
    df.columns = [str(col).strip() for col in df.columns]

    # Dicionário de sinônimos/aliases normalizados para mapear para as colunas core
    aliases_mapeamento = {
        "Faturamento": [r'faturamento', r'receita', r'venda', r'total', r'entrada', r'faturado', r'revenue', r'sales', r'income', r'val.*faturado'],
        "Despesas": [r'despesa', r'gasto', r'custo', r'saida', r'expense', r'cost', r'outgoing', r'val.*gasto', r'val.*despesa'],
        "Lucro": [r'lucro', r'profit', r'ganho', r'net_profit', r'lucro_liquido', r'sobrou'],
        "Período": [r'periodo', r'data', r'date', r'mes', r'ano', r'dia', r'time', r'timestamp'],
        "Produto": [r'produto', r'product', r'item', r'mercadoria', r'sku', r'nome_produto', r'nome do produto']
    }

    mapeamento_encontrado = {}
    colunas_usadas = set()

    for padrao, aliases in aliases_mapeamento.items():
        for col in df.columns:
            if col in colunas_usadas:
                continue
            col_norm = _normalizar(col)
            if any(re.search(alias, col_norm) for alias in aliases):
                mapeamento_encontrado[col] = padrao
                colunas_usadas.add(col)
                break

    if mapeamento_encontrado:
        df = df.rename(columns=mapeamento_encontrado)
        print(f"[AUTO-MAP] Mapeadas colunas por alias: {mapeamento_encontrado}")

    # Fallback por tipo para colunas essenciais ausentes
    colunas_financeiras = ["Faturamento", "Despesas", "Lucro"]
    colunas_ausentes = [c for c in colunas_financeiras if c not in df.columns]

    if colunas_ausentes:
        colunas_restantes = [col for col in df.columns if col not in ["Faturamento", "Despesas", "Lucro", "Período", "Produto"]]
        numericas_restantes = [col for col in colunas_restantes if detectar_tipo_coluna(df[col]) == "numerico"]
        for col_ausente in colunas_ausentes:
            if numericas_restantes:
                col_para_mapear = numericas_restantes.pop(0)
                df = df.rename(columns={col_para_mapear: col_ausente})
                print(f"[AUTO-MAP] Coluna numérica '{col_para_mapear}' mapeada por tipo para '{col_ausente}'")

    # Mapeamento do Período por tipo caso esteja ausente
    if "Período" not in df.columns:
        colunas_restantes = [col for col in df.columns if col not in ["Faturamento", "Despesas", "Lucro", "Período", "Produto"]]
        datas_restantes = [col for col in colunas_restantes if detectar_tipo_coluna(df[col]) == "data"]
        if datas_restantes:
            col_para_mapear = datas_restantes[0]
            df = df.rename(columns={col_para_mapear: "Período"})
            print(f"[AUTO-MAP] Coluna de data '{col_para_mapear}' mapeada por tipo para 'Período'")
        else:
            from datetime import datetime
            hoje = datetime.now().strftime("%Y-%m-%d")
            df["Período"] = hoje
            print(f"[AUTO-MAP] Criada coluna 'Período' com data padrão '{hoje}'")

    # Garante que as três colunas financeiras existem no DataFrame
    for col in ["Faturamento", "Despesas", "Lucro"]:
        if col not in df.columns:
            df[col] = 0.0
            print(f"[AUTO-MAP] Criada coluna financeira vazia '{col}'")

    # Limpar e converter dados das colunas financeiras para float
    for col in ["Faturamento", "Despesas", "Lucro"]:
        df[col] = df[col].apply(limpar_e_converter_numero).astype(float)

    # Reconstruir/calcular dados cruzados ausentes (ex: Lucro = Faturamento - Despesas)
    cond_lucro = (df["Lucro"] == 0) | df["Lucro"].isna()
    df.loc[cond_lucro, "Lucro"] = df.loc[cond_lucro, "Faturamento"] - df.loc[cond_lucro, "Despesas"]

    cond_despesas = (df["Despesas"] == 0) | df["Despesas"].isna()
    df.loc[cond_despesas, "Despesas"] = df.loc[cond_despesas, "Faturamento"] - df.loc[cond_despesas, "Lucro"]

    cond_faturamento = (df["Faturamento"] == 0) | df["Faturamento"].isna()
    df.loc[cond_faturamento, "Faturamento"] = df.loc[cond_faturamento, "Despesas"] + df.loc[cond_faturamento, "Lucro"]

    # Resolver colunas duplicadas após remoção de espaços em branco e mapeamento
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

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(
                lambda x: " ".join(x.strip().split()) if isinstance(x, str) else x
            )

    print("[OK] Espacos tratados e colunas duplicadas resolvidas")

    # =========================
    # 2. REMOVER LINHAS VAZIAS
    # =========================
    antes = len(df)
    df = df.dropna(how="all")
    removidas = antes - len(df)

    print(
        f"[OK] {removidas} linhas vazias removidas"
        if removidas > 0 else
        "[OK] Nenhuma linha vazia encontrada"
    )

    # =========================
    # 3. TRATAR DATAS
    # =========================
    # Converter colunas do tipo datetime para strings para evitar erros de BSON/serialização com NaT/NaTType
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            non_null = df[col].dropna()
            has_time = (non_null.dt.hour != 0).any() or (non_null.dt.minute != 0).any() or (non_null.dt.second != 0).any() if not non_null.empty else False
            fmt = "%Y-%m-%d %H:%M:%S" if has_time else "%Y-%m-%d"
            df[col] = df[col].dt.strftime(fmt).fillna("")
            print(f"[OK] Coluna datetime formatada: {col}")

    col_data = encontrar_coluna_data(df)

    if col_data:
        df = converter_datas(df, col_data)
        print(f"[OK] Data formatada: {col_data}")
    else:
        print("[OK] Nenhuma coluna de data")

    # =========================
    # 4. PREENCHIMENTO INTELIGENTE
    # =========================
    df = preencher_inteligente(df)

    # =========================
    # 5. PADRÃO FINAL
    # =========================
    for col in df.columns:
        if df[col].dtype in ["float64", "int64"]:
            df[col] = df[col].fillna(0)
        else:
            df[col] = df[col].fillna("")

    # =========================
    # 6. RESULTADO FINAL
    # =========================
    completude = validar_completude_dados(df)

    print(f"\n[OK] Limpeza concluida")
    print(f"[OK] Linhas: {df.shape[0]}")
    print(f"[OK] Completude: {completude:.2f}%")

    return df