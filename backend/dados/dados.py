import pandas as pd
import numpy as np
from typing import Optional

# =====================================================
#  UTILIDADES
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
                print(f"✓ {col}: {total_vazios} preenchidos com média ({media:.2f})")

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
                    print(f"✓ {col}: {total_vazios} preenchidos com moda ('{valor}')")

    return df


# =====================================================
# LIMPEZA PRINCIPAL
# =====================================================

def limpar_dados(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpeza conservadora com melhoria estatística:
    - Remove espaços
    - Remove linhas totalmente vazias
    - Formata datas
    - Preenche dados automaticamente
    """

    if df.empty:
        return df

    df = df.copy()

    # =========================
    # 1. LIMPAR COLUNAS
    # =========================
    df.columns = df.columns.str.strip()

    for col in df.columns:
        if df[col].dtype == "object":
            df[col] = df[col].apply(
                lambda x: " ".join(x.strip().split()) if isinstance(x, str) else x
            )

    print("✓ Espaços tratados")

    # =========================
    # 2. REMOVER LINHAS VAZIAS
    # =========================
    antes = len(df)
    df = df.dropna(how="all")
    removidas = antes - len(df)

    print(
        f"✓ {removidas} linhas vazias removidas"
        if removidas > 0 else
        "✓ Nenhuma linha vazia encontrada"
    )

    # =========================
    # 3. TRATAR DATAS
    # =========================
    col_data = encontrar_coluna_data(df)

    if col_data:
        df = converter_datas(df, col_data)
        print(f"✓ Data formatada: {col_data}")
    else:
        print("✓ Nenhuma coluna de data")

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

    print(f"\n✓ Limpeza concluída")
    print(f"✓ Linhas: {df.shape[0]}")
    print(f"✓ Completude: {completude:.2f}%")

    return df