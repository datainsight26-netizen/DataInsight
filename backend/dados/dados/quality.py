"""
quality.py — Sistema completo de detecção e limpeza de problemas de qualidade de dados.

Funciona como um cientista de dados analisando os dados, identificando:
- Valores nulos / vazios
- Duplicatas exatas e parciais
- Tipagem incorreta (outliers de tipo)
- Outliers estatísticos (IQR)
- Formatação inconsistente
- Strings que representam nulos ("N/A", "null", "-", etc.)

"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List
from backend.dados.dados import detectar_tipo_coluna, limpar_dados_conservador


# Strings que representam valores nulos
STRINGS_NULAS = {"", "nan", "none", "null", "n/a", "n.a.", "na", "-", "--", "nd",
                 "n.d.", "indefinido", "indisponivel", "indisponível", "nulo", "vazio"}


def _percentual(contador, total):
    return float(contador) / total * 100 if total > 0 else 0.0


def _converter_para_numerico(serie: pd.Series) -> pd.Series:
    """
    Tenta converter uma série para numérico usando múltiplos formatos:
    - Remove R$, $, €, £, %, espaços
    - Lida com vírgula decimal (PT-BR) e separadores de milhar
    - Retorna série numérica (NaN onde falhar)
    """
    def _tentar(val):
        if pd.isna(val) or str(val).strip().lower() in STRINGS_NULAS:
            return np.nan
        if isinstance(val, (int, float, np.number)):
            return float(val) if not np.isnan(val) else np.nan
        s = str(val).strip()
        s = s.replace('R$', '').replace('€', '').replace('£', '').replace('$', '').replace('%', '').strip()
        # Tratar parênteses para números negativos: (123.45) -> -123.45
        if s.startswith('(') and s.endswith(')'):
            s = '-' + s[1:-1].strip()
        # PT-BR: 1.234,56 → 1234.56
        if '.' in s and ',' in s:
            if s.rfind('.') < s.rfind(','):
                s = s.replace('.', '').replace(',', '.')
            else:
                s = s.replace(',', '')
        elif ',' in s:
            parts = s.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                s = s.replace(',', '.')
            else:
                s = s.replace(',', '')
        elif '.' in s:
            parts = s.split('.')
            if len(parts) == 2 and len(parts[1]) == 3 and not (s.startswith('0.') or s.startswith('-0.')):
                # Separador de milhar isolado: 1.234
                s = s.replace('.', '')
        try:
            return float(s)
        except Exception:
            return np.nan

    return serie.apply(_tentar)


def _eh_string_nula(val) -> bool:
    """Verifica se um valor string representa um nulo."""
    if pd.isna(val):
        return True
    return str(val).strip().lower() in STRINGS_NULAS


def detectar_nulos(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detecta valores nulos e pseudo-nulos em cada coluna.
    Conta: NaN reais + strings como 'N/A', 'null', '', '-'
    """
    total = len(df)
    resultado = {}
    for col in df.columns:
        # Conta nulos reais
        nulos_reais = int(df[col].isna().sum())
        # Conta strings nulas
        strings_nulas = int(df[col].apply(lambda v: _eh_string_nula(v) and not pd.isna(v)).sum())
        nulos_total = nulos_reais + strings_nulas

        resultado[col] = {
            "nulos": nulos_total,
            "nulos_reais": nulos_reais,
            "strings_nulas": strings_nulas,
            "percentual": round(_percentual(nulos_total, total), 2),
            "exemplos_strings_nulas": (
                df[col][df[col].apply(lambda v: _eh_string_nula(v) and not pd.isna(v))]
                .unique()[:3]
                .tolist()
            ) if strings_nulas > 0 else []
        }
    return resultado


def detectar_duplicatas(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detecta duplicatas exatas e parciais (por subconjunto de colunas-chave).
    """
    total = len(df)
    # Duplicatas exatas (todas as colunas)
    dup_exatas = int(df.duplicated(keep='first').sum())
    amostra_exatas = df[df.duplicated(keep='first')].head(3).to_dict('records')

    # Duplicatas parciais: tenta encontrar colunas-chave de negócio
    colunas_chave = []
    for col in df.columns:
        col_lower = str(col).lower()
        if any(k in col_lower for k in ['produto', 'product', 'nome', 'name', 'sku', 'codigo', 'id']):
            colunas_chave.append(col)

    dup_parciais = 0
    amostra_parciais = []
    if colunas_chave and len(colunas_chave) <= 3:
        dup_parciais = int(df.duplicated(subset=colunas_chave, keep='first').sum())
        if dup_parciais > 0:
            amostra_parciais = (
                df[df.duplicated(subset=colunas_chave, keep='first')]
                .head(3)
                .to_dict('records')
            )

    return {
        "linhas_totais": total,
        "duplicatas_exatas": dup_exatas,
        "duplicatas_parciais": dup_parciais,
        "colunas_chave_parcial": colunas_chave,
        "exemplo_duplicatas_exatas": amostra_exatas,
        "exemplo_duplicatas_parciais": amostra_parciais,
    }


def detectar_tipo_mismatch(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detecta valores com tipo diferente do predominante na coluna.
    Converte strings para numérico antes de analisar.
    """
    problemas = {}
    for col in df.columns:
        tipo_pred = detectar_tipo_coluna(df[col])
        detalhes = {
            "predominante": tipo_pred,
            "amostras_incoerentes": [],
            "total_incoerentes": 0
        }

        amostra = df[col].dropna().head(100)

        if tipo_pred == 'numerico':
            # Tenta converter para numérico — marca as que falharam
            convertidos = _converter_para_numerico(amostra)
            incoerentes = amostra[convertidos.isna() & ~amostra.apply(_eh_string_nula)]
            detalhes['amostras_incoerentes'] = [
                {"index": int(idx), "valor": str(val)}
                for idx, val in incoerentes.head(5).items()
            ]
            detalhes['total_incoerentes'] = len(incoerentes)

        elif tipo_pred == 'data':
            # Verifica quais não podem ser parseadas como data
            tentativas = pd.to_datetime(amostra.astype(str), errors='coerce', dayfirst=True)
            incoerentes = amostra[tentativas.isna() & ~amostra.apply(_eh_string_nula)]
            detalhes['amostras_incoerentes'] = [
                {"index": int(idx), "valor": str(val)}
                for idx, val in incoerentes.head(5).items()
            ]
            detalhes['total_incoerentes'] = len(incoerentes)

        elif tipo_pred == 'texto':
            # Para texto: detecta valores puramente numéricos que parecem estar no lugar errado
            numericos_em_texto = amostra[amostra.apply(
                lambda v: not _eh_string_nula(v) and str(v).strip().lstrip('-').replace('.', '', 1).isdigit()
            )]
            if len(numericos_em_texto) > 0 and len(numericos_em_texto) / len(amostra) < 0.3:
                # Só reporta se for minoria (pode ser mistura intencional)
                detalhes['amostras_incoerentes'] = [
                    {"index": int(idx), "valor": str(val)}
                    for idx, val in numericos_em_texto.head(3).items()
                ]
                detalhes['total_incoerentes'] = len(numericos_em_texto)

        problemas[col] = detalhes
    return problemas


def detectar_outliers(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detecta outliers estatísticos usando IQR para colunas numéricas.
    
    IMPORTANTE: Converte strings para numérico antes de analisar,
    pois dados do MongoDB chegam frequentemente como strings.
    """
    out = {}

    for col in df.columns:
        # Converte a coluna para numérico (suporta strings como "1500.00", "R$ 2.000,00")
        serie_num = _converter_para_numerico(df[col])
        serie_valida = serie_num.dropna()

        if len(serie_valida) < 4:
            # Sem dados suficientes para análise estatística
            out[col] = {
                "metodo": "insuficiente",
                "outliers": 0,
                "indices": [],
                "limite_inferior": None,
                "limite_superior": None,
                "media": None,
                "mediana": None
            }
            continue

        q1 = float(serie_valida.quantile(0.25))
        q3 = float(serie_valida.quantile(0.75))
        iqr = q3 - q1

        # IQR muito pequeno = dados constantes → não há outliers relevantes
        if iqr == 0:
            out[col] = {
                "metodo": "IQR",
                "outliers": 0,
                "indices": [],
                "limite_inferior": q1,
                "limite_superior": q3,
                "media": float(serie_valida.mean()),
                "mediana": float(serie_valida.median())
            }
            continue

        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr

        # Máscara de outliers na série convertida (alinhada ao índice original)
        mask = (serie_num < lower) | (serie_num > upper)
        mask = mask.fillna(False)
        indices = df.index[mask].tolist()

        # Amostras dos valores outlier
        amostras = [
            {"index": int(idx), "valor": str(df.loc[idx, col]), "valor_numerico": float(serie_num.loc[idx])}
            for idx in indices[:5]
        ]

        out[col] = {
            "metodo": "IQR",
            "outliers": int(len(indices)),
            "indices": indices[:50],  # limita a 50 para não sobrecarregar
            "amostras": amostras,
            "limite_inferior": round(lower, 4),
            "limite_superior": round(upper, 4),
            "media": round(float(serie_valida.mean()), 4),
            "mediana": round(float(serie_valida.median()), 4),
            "desvio_padrao": round(float(serie_valida.std()), 4),
        }

    return out


def detectar_formatacao(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detecta inconsistências de formatação em colunas de texto:
    - Capitalização inconsistente
    - Formatos de data inconsistentes
    - Espaços extras
    - Encoding estranho
    """
    problemas = {}
    for col in df.columns:
        amostra_raw = df[col].dropna()
        amostra = amostra_raw.astype(str)
        amostra = amostra[~amostra.apply(lambda v: v.strip().lower() in STRINGS_NULAS)]

        if amostra.empty:
            continue

        # Capitalização inconsistente
        starts_upper = int(amostra[amostra.str.len() > 0].str[0].str.isupper().sum())
        starts_lower = int(amostra[amostra.str.len() > 0].str[0].str.islower().sum())
        total_amostra = len(amostra)

        # Espaços extras
        tem_espacos_extras = int(amostra[amostra != amostra.str.strip()].count())

        # Formatos de data inconsistentes
        possivel_data = any(k in col.lower() for k in ['data', 'date', 'period', 'mes', 'ano', 'dia'])
        falhas_data = 0
        formatos_data_detectados = set()
        if possivel_data:
            tentativas = pd.to_datetime(amostra, errors='coerce', dayfirst=True)
            falhas_data = int(tentativas.isna().sum())
            # Detectar formatos mistos
            fmt_dd_mm = amostra.str.match(r'^\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}$').sum()
            fmt_yyyy = amostra.str.match(r'^\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2}$').sum()
            if fmt_dd_mm > 0: formatos_data_detectados.add('DD/MM/YYYY')
            if fmt_yyyy > 0: formatos_data_detectados.add('YYYY-MM-DD')

        problemas[col] = {
            "capitalizacao": {
                "starts_upper": starts_upper,
                "starts_lower": starts_lower,
                "total_amostra": total_amostra,
                "inconsistente": starts_upper > 0 and starts_lower > 0 and
                                  (starts_upper / max(total_amostra, 1)) >= 0.15 and
                                  (starts_lower / max(total_amostra, 1)) >= 0.15
            },
            "espacos_extras": tem_espacos_extras,
            "falhas_data_amostra": falhas_data,
            "formatos_data_detectados": list(formatos_data_detectados),
            "formatos_mistos": len(formatos_data_detectados) > 1
        }

    return problemas


def calcular_score_qualidade(relatorio: Dict[str, Any]) -> int:
    """
    Calcula um score geral de qualidade dos dados (0-100).
    100 = dados perfeitos, 0 = dados com muitos problemas.
    """
    penalidades = 0

    # Nulos: cada coluna com >5% nulos perde pontos
    nulos = relatorio.get('nulos', {})
    for col, info in nulos.items():
        pct = info.get('percentual', 0)
        if pct > 50:
            penalidades += 15
        elif pct > 20:
            penalidades += 8
        elif pct > 5:
            penalidades += 3

    # Duplicatas: perde pontos por duplicatas
    dup = relatorio.get('duplicatas', {})
    total = max(dup.get('linhas_totais', 1), 1)
    dup_exatas = dup.get('duplicatas_exatas', 0)
    if dup_exatas > 0:
        pct_dup = (dup_exatas / total) * 100
        if pct_dup > 20:
            penalidades += 20
        elif pct_dup > 5:
            penalidades += 10
        else:
            penalidades += 5

    # Outliers: perde pontos por colunas com outliers significativos
    outliers = relatorio.get('outliers', {})
    for col, info in outliers.items():
        n = info.get('outliers', 0)
        if n > 0:
            penalidades += min(5, n // 2)

    # Tipos mismatches
    tipos = relatorio.get('tipos', {})
    for col, det in tipos.items():
        inc = det.get('total_incoerentes', 0)
        if inc > 5:
            penalidades += 5
        elif inc > 0:
            penalidades += 2

    # Formatação
    fmt = relatorio.get('formatacao', {})
    for col, det in fmt.items():
        if det.get('formatos_mistos'):
            penalidades += 5
        if det.get('capitalizacao', {}).get('inconsistente'):
            penalidades += 3
        if det.get('espacos_extras', 0) > 0:
            penalidades += 1

    return max(0, 100 - penalidades)


def sugerir_acoes(report: Dict[str, Any]) -> Dict[str, Any]:
    """Gera sugestões de ações corretivas baseadas no relatório de qualidade."""
    acoes = {}

    # Nulos
    nulos = report.get('nulos', {})
    for col, info in nulos.items():
        pct = info['percentual']
        if pct == 0:
            continue
        lista = []
        if pct <= 20:
            lista.append("preencher_automaticamente")
        elif pct <= 50:
            lista.append("preencher_com_cuidado")
        else:
            lista.append("avaliar_remover_ou_manter")
        if info.get('strings_nulas', 0) > 0:
            lista.append("padronizar_strings_nulas")
        acoes[col] = acoes.get(col, []) + lista

    # Duplicatas
    dup = report.get('duplicatas', {})
    if dup.get('duplicatas_exatas', 0) > 0:
        acoes['__duplicatas__'] = ["remover_duplicatas_exatas"]
    if dup.get('duplicatas_parciais', 0) > 0:
        acoes['__duplicatas_parciais__'] = ["revisar_duplicatas_por_chave"]

    # Outliers
    out = report.get('outliers', {})
    for col, info in out.items():
        if info.get('outliers', 0) > 0:
            acoes[col] = acoes.get(col, []) + [
                "capear_outliers_por_IQR",
                "substituir_por_mediana_opcional"
            ]

    # Tipagem
    tipo = report.get('tipos', {})
    for col, det in tipo.items():
        if det.get('total_incoerentes', 0) > 0:
            acoes[col] = acoes.get(col, []) + ["corrigir_tipo_ou_normalizar_strings"]

    # Formatação
    fmt = report.get('formatacao', {})
    for col, det in fmt.items():
        if det.get('capitalizacao', {}).get('inconsistente'):
            acoes[col] = acoes.get(col, []) + ["padronizar_capitalizacao"]
        if det.get('formatos_mistos'):
            acoes[col] = acoes.get(col, []) + ["padronizar_formato_data"]
        if det.get('espacos_extras', 0) > 0:
            acoes[col] = acoes.get(col, []) + ["remover_espacos_extras"]

    return acoes


def aplicar_limpeza_automatica(
    df: pd.DataFrame,
    report: Dict[str, Any],
    cap_outliers: bool = True,
    remover_duplicatas: bool = True,
    padronizar_texto: bool = True
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Aplica limpeza automática baseada no relatório de qualidade.
    
    Retorna (df_limpo, log_acoes) onde log_acoes descreve o que foi feito.
    """
    df = df.copy()
    log = {}

    # 1. Remover duplicatas exatas
    if remover_duplicatas and report.get('duplicatas', {}).get('duplicatas_exatas', 0) > 0:
        antes = len(df)
        df = df.drop_duplicates(keep='first')
        removidas = antes - len(df)
        log['duplicatas_removidas'] = removidas
        print(f"[CLEAN] Removidas {removidas} duplicata(s) exata(s)")

    # 2. Tratar nulos: preencher numéricos com média, texto com moda
    nulos = report.get('nulos', {})
    preenchidos = {}
    for col, info in nulos.items():
        pct = info['percentual']
        if pct == 0 or col not in df.columns:
            continue

        # Mais de 50% nulos: não preencher automaticamente
        if pct > 50:
            print(f"[SKIP] {col}: {pct:.1f}% nulos - muito alto para preenchimento automático")
            continue

        tipo = detectar_tipo_coluna(df[col])

        # Tratar strings nulas primeiro
        if info.get('strings_nulas', 0) > 0:
            df[col] = df[col].apply(
                lambda v: np.nan if _eh_string_nula(v) else v
            )

        if tipo == 'numerico':
            valores = _converter_para_numerico(df[col])
            media = valores.mean()
            if not np.isnan(media):
                mascara = df[col].isna() | df[col].apply(_eh_string_nula)
                df.loc[mascara, col] = round(media, 2)
                preenchidos[col] = {"metodo": "media", "valor": round(media, 2), "qtd": int(mascara.sum())}
                print(f"[CLEAN] {col}: {int(mascara.sum())} nulo(s) preenchido(s) com média ({media:.2f})")

        elif tipo == 'texto' and pct <= 30:
            moda = df[col].dropna().mode()
            if not moda.empty:
                mascara = df[col].isna() | df[col].apply(_eh_string_nula)
                df.loc[mascara, col] = moda.iloc[0]
                preenchidos[col] = {"metodo": "moda", "valor": str(moda.iloc[0]), "qtd": int(mascara.sum())}
                print(f"[CLEAN] {col}: {int(mascara.sum())} nulo(s) preenchido(s) com moda")

    if preenchidos:
        log['nulos_preenchidos'] = preenchidos

    # 3. Capear outliers por IQR
    if cap_outliers:
        out = report.get('outliers', {})
        capeados = {}
        for col, info in out.items():
            if info.get('outliers', 0) == 0 or col not in df.columns:
                continue
            lower = info.get('limite_inferior')
            upper = info.get('limite_superior')
            if lower is None or upper is None:
                continue

            serie = _converter_para_numerico(df[col])
            mascara_out = (serie < lower) | (serie > upper)
            qtd = int(mascara_out.sum())

            if qtd > 0:
                # Capear: substituir pelos limites
                df[col] = serie.apply(
                    lambda v: lower if pd.notna(v) and v < lower else (upper if pd.notna(v) and v > upper else v)
                )
                capeados[col] = {"limite_inferior": lower, "limite_superior": upper, "qtd_capeados": qtd}
                print(f"[CLEAN] {col}: {qtd} outlier(s) capeado(s) entre {lower:.2f} e {upper:.2f}")

        if capeados:
            log['outliers_capeados'] = capeados

    # 4. Padronizar texto: capitalização e espaços
    if padronizar_texto:
        formatos = report.get('formatacao', {})
        padronizados = {}
        for col, det in formatos.items():
            if col not in df.columns:
                continue
            alterou = False

            # Espaços extras
            if det.get('espacos_extras', 0) > 0:
                df[col] = df[col].apply(
                    lambda s: " ".join(str(s).split()) if isinstance(s, str) and str(s).strip() not in STRINGS_NULAS else s
                )
                alterou = True

            # Capitalização inconsistente → title case
            cap = det.get('capitalizacao', {})
            if cap.get('inconsistente'):
                df[col] = df[col].apply(
                    lambda s: str(s).strip().title()
                    if isinstance(s, str) and str(s).strip() not in STRINGS_NULAS
                    else s
                )
                alterou = True

            if alterou:
                padronizados[col] = True
                print(f"[CLEAN] {col}: texto padronizado")

        if padronizados:
            log['texto_padronizado'] = list(padronizados.keys())

    # 5. Aplicar limpeza conservadora final
    try:
        df = limpar_dados_conservador(df)
    except Exception as e:
        print(f"[WARN] limpar_dados_conservador falhou: {e}")

    log['total_linhas_final'] = len(df)
    log['total_colunas'] = len(df.columns)

    return df, log


def analisar_qualidade(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Realiza análise completa de qualidade dos dados.
    Retorna relatório com todos os problemas encontrados.
    """
    relatorio = {}
    relatorio['nulos'] = detectar_nulos(df)
    relatorio['duplicatas'] = detectar_duplicatas(df)
    relatorio['tipos'] = detectar_tipo_mismatch(df)
    relatorio['outliers'] = detectar_outliers(df)
    relatorio['formatacao'] = detectar_formatacao(df)
    relatorio['sugestoes'] = sugerir_acoes(relatorio)
    relatorio['score_qualidade'] = calcular_score_qualidade(relatorio)
    relatorio['total_linhas'] = len(df)
    relatorio['total_colunas'] = len(df.columns)

    return relatorio


def analisar_e_limpar(
    df: pd.DataFrame,
    auto_clean: bool = True,
    cap_outliers: bool = True
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Realiza análise de qualidade e limpa automaticamente se `auto_clean=True`.
    Retorna (df_limpo, relatorio)
    """
    relatorio = analisar_qualidade(df)

    df_limpo = df
    log_acoes = {}
    if auto_clean:
        df_limpo, log_acoes = aplicar_limpeza_automatica(
            df, relatorio,
            cap_outliers=cap_outliers,
            remover_duplicatas=True,
            padronizar_texto=True
        )

    relatorio['log_limpeza'] = log_acoes
    return df_limpo, relatorio


def api_analisar_dados():
    """
    Endpoint POST /api/dados/analisar
    Recebe colunas e dados (ou carrega tabela ativa do usuário) e retorna o diagnóstico de qualidade.
    """
    from flask import request, jsonify, session
    from backend.db import dados_colecao

    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    colunas = payload.get("colunas")
    dados = payload.get("dados")

    # Se não foram fornecidos dados, busca a tabela mais recente do usuário
    if not colunas and not dados:
        doc = dados_colecao.find_one(
            {"usuario_id": usuario_id},
            sort=[("atualizado_em", -1), ("criado_em", -1)]
        )
        if doc:
            colunas = doc.get("colunas", [])
            dados = doc.get("dados", [])

    if not colunas and not dados:
        return jsonify({
            "sucesso": False,
            "mensagem": "Nenhum dado encontrado para análise."
        }), 400

    try:
        df = pd.DataFrame(dados, columns=colunas) if dados else pd.DataFrame(columns=colunas)
        relatorio = analisar_qualidade(df)

        return jsonify({
            "sucesso": True,
            "relatorio": relatorio
        }), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": f"Erro na análise de qualidade: {str(e)}"}), 500


def api_limpar_dados():
    """
    Endpoint POST /api/dados/limpar
    Executa a limpeza e sanitização científica dos dados e persiste no MongoDB garantindo dados sempre limpos.
    Body JSON:
    {
        "colunas": [...],
        "dados": [...],
        "salvar_no_banco": true,
        "tabela_id": "...",
        "opcoes": { "cap_outliers": true, "remover_duplicatas": true, "padronizar_texto": true }
    }
    """
    from flask import request, jsonify, session
    from backend.db import dados_colecao
    from bson import ObjectId
    from datetime import datetime

    usuario_id = session.get('usuario_id')
    if not usuario_id:
        return jsonify({"mensagem": "Não autorizado"}), 401

    payload = request.get_json() or {}
    colunas = payload.get("colunas")
    dados = payload.get("dados")
    tabela_id = payload.get("tabela_id") or payload.get("id")
    salvar_no_banco = payload.get("salvar_no_banco", True)
    opcoes = payload.get("opcoes", {})

    cap_outliers = bool(opcoes.get("cap_outliers", True))
    remover_duplicatas = bool(opcoes.get("remover_duplicatas", True))
    padronizar_texto = bool(opcoes.get("padronizar_texto", True))

    doc = None
    if not colunas and not dados:
        if tabela_id and ObjectId.is_valid(tabela_id):
            doc = dados_colecao.find_one({"_id": ObjectId(tabela_id), "usuario_id": usuario_id})
        if not doc:
            doc = dados_colecao.find_one(
                {"usuario_id": usuario_id},
                sort=[("atualizado_em", -1), ("criado_em", -1)]
            )
        if doc:
            colunas = doc.get("colunas", [])
            dados = doc.get("dados", [])
            if not tabela_id:
                tabela_id = str(doc["_id"])

    if not colunas and not dados:
        return jsonify({
            "sucesso": False,
            "mensagem": "Nenhum dado fornecido para limpeza."
        }), 400

    try:
        df = pd.DataFrame(dados, columns=colunas)
        relatorio_inicial = analisar_qualidade(df)

        df_limpo, log_acoes = aplicar_limpeza_automatica(
            df,
            relatorio_inicial,
            cap_outliers=cap_outliers,
            remover_duplicatas=remover_duplicatas,
            padronizar_texto=padronizar_texto
        )

        from backend.dados.dados import converter_para_tipos_nativos
        colunas_limpas = [str(c) for c in df_limpo.columns.tolist() if str(c) != '_id']
        raw_records = df_limpo.to_dict('records')
        import time
        now_ts = int(time.time() * 1000)
        for i, r in enumerate(raw_records):
            if '_id' not in r or not r['_id']:
                r['_id'] = f"r-{now_ts}-{i}"
        dados_limpos = converter_para_tipos_nativos(raw_records)

        # Persistir dados limpos no MongoDB se solicitado
        if salvar_no_banco:
            if tabela_id and ObjectId.is_valid(tabela_id):
                dados_colecao.update_one(
                    {"_id": ObjectId(tabela_id), "usuario_id": usuario_id},
                    {"$set": {
                        "colunas": colunas_limpas,
                        "dados": dados_limpos,
                        "atualizado_em": datetime.now()
                    }}
                )
            else:
                doc_ativo = dados_colecao.find_one(
                    {"usuario_id": usuario_id},
                    sort=[("atualizado_em", -1), ("criado_em", -1)]
                )
                if doc_ativo:
                    dados_colecao.update_one(
                        {"_id": doc_ativo["_id"]},
                        {"$set": {
                            "colunas": colunas_limpas,
                            "dados": dados_limpos,
                            "atualizado_em": datetime.now()
                        }}
                    )

            # Salvar produtos limpos no histórico de autocomplete
            try:
                from backend.dados.salvar_dados import extrair_e_salvar_produtos
                extrair_e_salvar_produtos(usuario_id, colunas_limpas, dados_limpos)
            except Exception as e_prod:
                print(f"[WARN] Erro ao salvar produtos após limpeza: {e_prod}", flush=True)

        relatorio_final = analisar_qualidade(df_limpo)

        return jsonify({
            "sucesso": True,
            "mensagem": "Dados limpos e salvos no banco de dados com sucesso!",
            "colunas": colunas_limpas,
            "dados": dados_limpos,
            "total_linhas": len(dados_limpos),
            "log_limpeza": log_acoes,
            "score_anterior": relatorio_inicial.get("score_qualidade", 0),
            "score_atual": relatorio_final.get("score_qualidade", 100),
            "relatorio_atualizado": relatorio_final
        }), 200

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"sucesso": False, "mensagem": f"Erro na limpeza dos dados: {str(e)}"}), 500

