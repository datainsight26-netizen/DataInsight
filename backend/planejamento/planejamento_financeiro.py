from flask import jsonify, request, session
from bson import ObjectId
import pandas as pd

from backend.db import usuario
from backend.dados.agregador import obter_contexto_dados


MESES = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
]


def _filtro_usuario(user_id):
    if user_id and ObjectId.is_valid(str(user_id)):
        return {"_id": ObjectId(user_id)}

    return {"_id": user_id}


def _numero(valor):
    """
    Converte valores monetários vindos da planilha para float.
    Aceita formatos como:
    1200
    1200.50
    "1200,50"
    "R$ 1.200,50"
    """
    if valor is None or valor == "":
        return 0.0

    if isinstance(valor, (int, float)):
        try:
            return float(valor)
        except Exception:
            return 0.0

    texto = str(valor).strip()

    texto = texto.replace("R$", "")
    texto = texto.replace(" ", "")

    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", ".")

    try:
        return float(texto)
    except Exception:
        return 0.0


def _obter_coluna(mapeamento, categoria, df):
    """
    Retorna o nome da coluna associada à categoria financeira.
    """
    coluna = mapeamento.get(categoria)

    if coluna and coluna in df.columns:
        return coluna

    return None


def _serie_financeira(df, mapeamento, categoria):
    """
    Retorna uma Series numérica para uma categoria financeira.
    """
    coluna = _obter_coluna(mapeamento, categoria, df)

    if coluna:
        return df[coluna].apply(_numero)

    return pd.Series([0.0] * len(df), index=df.index)


def _obter_categorias_custom(mapeamento):
    """
    Retorna a lista de categorias customizadas cadastradas no mapeamento.
    """
    if not isinstance(mapeamento, dict):
        return []
    cats = mapeamento.get("categorias_custom") or mapeamento.get("_categorias_custom") or []
    if isinstance(cats, list):
        return cats
    return []


def _serie_custom_grupo(df, mapeamento, grupo_nome):
    """
    Soma todas as colunas de categorias customizadas pertencentes ao grupo.
    """
    cats = _obter_categorias_custom(mapeamento)
    serie_soma = pd.Series([0.0] * len(df), index=df.index)
    for cat in cats:
        if isinstance(cat, dict) and cat.get("grupo") == grupo_nome:
            cid = cat.get("id")
            if cid:
                col = _obter_coluna(mapeamento, cid, df)
                if col:
                    serie_soma = serie_soma + df[col].apply(_numero)
                else:
                    val_manual = mapeamento.get(f"{cid}_manual")
                    if val_manual is not None and val_manual != "":
                        try:
                            num_manual = float(val_manual)
                            serie_soma = serie_soma + pd.Series([num_manual] * len(df), index=df.index)
                        except Exception:
                            pass
    return serie_soma


def _receita(df, mapeamento):
    """
    Receita total.
    Soma receita_total (se presente) ou produtos + serviços + customizadas.
    """
    custom_rec = _serie_custom_grupo(df, mapeamento, "Detalhamento de Receitas")
    receita_total = _serie_financeira(
        df,
        mapeamento,
        "receita_total"
    )

    if receita_total.abs().sum() > 0:
        return receita_total + custom_rec

    return (
        _serie_financeira(df, mapeamento, "receita_produtos")
        + _serie_financeira(df, mapeamento, "receita_servicos")
        + _serie_financeira(df, mapeamento, "receita_outros")
        + custom_rec
    )


def _custos_variaveis(df, mapeamento):
    custom_var = _serie_custom_grupo(df, mapeamento, "Custos Variáveis")
    custo_total = _serie_financeira(
        df,
        mapeamento,
        "custo_variavel"
    )

    if custo_total.abs().sum() > 0:
        return custo_total + custom_var

    return (
        _serie_financeira(df, mapeamento, "fornecedores")
        + _serie_financeira(df, mapeamento, "publicidade")
        + _serie_financeira(df, mapeamento, "custo_variavel_outros")
        + custom_var
    )


def _gastos_fixos(df, mapeamento):
    """
    Calcula gastos fixos mensais incluindo categorias personalizadas.
    """
    custom_fix = _serie_custom_grupo(df, mapeamento, "Gastos Fixos")
    aluguel = _serie_financeira(df, mapeamento, "aluguel")
    folha   = _serie_financeira(df, mapeamento, "folha_pagamento")
    pro     = _serie_financeira(df, mapeamento, "pro_labore")
    outros  = _serie_financeira(df, mapeamento, "gasto_fixo_outros")

    componentes = aluguel + folha + pro + custom_fix

    if componentes.abs().sum() > 0:
        return componentes + outros

    return outros + custom_fix


def _investimentos(df, mapeamento):
    custom_inv = _serie_custom_grupo(df, mapeamento, "Investimentos")
    investimento_total = _serie_financeira(
        df,
        mapeamento,
        "investimento_outros"
    )

    componentes = (
        _serie_financeira(df, mapeamento, "investimento_infra")
        + _serie_financeira(
            df,
            mapeamento,
            "investimento_equipamentos"
        )
        + custom_inv
    )

    return investimento_total + componentes


def _converter_periodo(valor):
    """
    Tenta converter datas e também nomes de meses.
    """
    if valor is None:
        return None

    texto = str(valor).strip().lower()

    meses_texto = {
        "janeiro": 1,
        "jan": 1,
        "fevereiro": 2,
        "fev": 2,
        "março": 3,
        "marco": 3,
        "mar": 3,
        "abril": 4,
        "abr": 4,
        "maio": 5,
        "mai": 5,
        "junho": 6,
        "jun": 6,
        "julho": 7,
        "jul": 7,
        "agosto": 8,
        "ago": 8,
        "setembro": 9,
        "set": 9,
        "outubro": 10,
        "out": 10,
        "novembro": 11,
        "nov": 11,
        "dezembro": 12,
        "dez": 12,
    }

    if texto in meses_texto:
        return meses_texto[texto]

    try:
        if len(texto) >= 10 and texto[4] == '-' and texto[7] == '-':
            data = pd.to_datetime(valor, format='%Y-%m-%d', errors='coerce')
        else:
            data = pd.to_datetime(valor, errors='coerce', dayfirst=True)

        if pd.notna(data):
            return int(data.month)

    except Exception:
        pass

    return None


def _calcular_cenario_otimista(meses_base, fator_crescimento=1.15):
    """
    Cenário Otimista: Maximização sustentável.
    Aplica um crescimento projetado na receita (+15%),
    mantendo custos fixos controlados e custos variáveis e impostos proporcionais.
    """
    meses_otimista = []
    for mes in meses_base:
        receita_base = _numero(mes.get("receita"))
        if receita_base <= 0:
            meses_otimista.append({**mes})
            continue

        receita_otimista = round(receita_base * fator_crescimento, 2)
        impostos_base = _numero(mes.get("impostos"))
        taxa_impostos = impostos_base / receita_base if receita_base > 0 else 0.08
        impostos_otimista = round(receita_otimista * taxa_impostos, 2)

        variaveis_base = _numero(mes.get("variaveis"))
        taxa_variaveis = variaveis_base / receita_base if receita_base > 0 else 0
        variaveis_otimista = round(receita_otimista * taxa_variaveis, 2)

        margem_otimista = round(receita_otimista - impostos_otimista - variaveis_otimista, 2)
        margem_pct = round((margem_otimista / receita_otimista) * 100, 2) if receita_otimista > 0 else 0

        fixos = _numero(mes.get("fixos"))
        resultado_otimista = round(margem_otimista - fixos, 2)
        investimentos = _numero(mes.get("investimentos"))

        # Proporções detalhadas
        prop_prod = _numero(mes.get("produtos")) / receita_base if receita_base > 0 else 0
        prop_serv = _numero(mes.get("servicos")) / receita_base if receita_base > 0 else 0
        prop_outros = _numero(mes.get("outros")) / receita_base if receita_base > 0 else 0

        prop_forn = _numero(mes.get("fornecedores")) / variaveis_base if variaveis_base > 0 else 0
        prop_pub = _numero(mes.get("publicidade")) / variaveis_base if variaveis_base > 0 else 0
        prop_out_var = _numero(mes.get("outros_variaveis")) / variaveis_base if variaveis_base > 0 else 0

        meses_otimista.append({
            **mes,
            "produtos": round(receita_otimista * prop_prod, 2),
            "servicos": round(receita_otimista * prop_serv, 2),
            "outros": round(receita_otimista * prop_outros, 2),
            "receita": receita_otimista,
            "impostos": impostos_otimista,
            "fornecedores": round(variaveis_otimista * prop_forn, 2),
            "publicidade": round(variaveis_otimista * prop_pub, 2),
            "outros_variaveis": round(variaveis_otimista * prop_out_var, 2),
            "variaveis": variaveis_otimista,
            "margem": margem_otimista,
            "margemPct": margem_pct,
            "fixos": fixos,
            "resultado": resultado_otimista,
            "investimentos": investimentos
        })
    return meses_otimista


def _calcular_cenario_pessimista(meses_base):
    """
    Cenário de sobrevivência / ponto de equilíbrio.

    Para cada mês, calcula o faturamento mínimo necessário para
    cobrir impostos, custos variáveis e gastos fixos, mantendo
    o resultado operacional aproximadamente em R$ 0,00.

    Investimentos são zerados neste cenário porque representam
    desembolsos não essenciais à sobrevivência operacional.
    """

    meses_pessimista = []

    for mes in meses_base:
        receita_base = _numero(mes.get("receita"))
        impostos_base = _numero(mes.get("impostos"))
        variaveis_base = _numero(mes.get("variaveis"))
        fixos = _numero(mes.get("fixos"))

        # Sem receita não há base confiável para estimar as proporções.
        if receita_base <= 0:
            meses_pessimista.append({
                **mes,
                "produtos": 0.0,
                "servicos": 0.0,
                "outros": 0.0,
                "receita": 0.0,
                "impostos": 0.0,
                "fornecedores": 0.0,
                "publicidade": 0.0,
                "outros_variaveis": 0.0,
                "variaveis": 0.0,
                "margem": 0.0,
                "margemPct": 0.0,
                "resultado": round(-fixos, 2),
                "investimentos": 0.0,
                "ponto_equilibrio": None,
                "calculavel": False
            })
            continue

        taxa_impostos = impostos_base / receita_base
        taxa_variaveis = variaveis_base / receita_base

        # Margem disponível para pagar os gastos fixos.
        indice_margem = (
            1
            - taxa_impostos
            - taxa_variaveis
        )

        # Com margem nula/negativa, aumentar faturamento não resolve
        # o ponto de equilíbrio mantendo a mesma estrutura de custos.
        if indice_margem <= 0:
            meses_pessimista.append({
                **mes,
                "investimentos": 0.0,
                "ponto_equilibrio": None,
                "calculavel": False,
                "aviso_pe": (
                    "Ponto de equilíbrio incalculável: os custos variáveis"
                    " e impostos já superam ou igualam a receita. É preciso"
                    " reduzir a estrutura de custos antes de qualquer projecão."
                )
            })
            continue

        receita_equilibrio = (
            fixos / indice_margem
            if fixos > 0
            else 0.0
        )

        impostos_equilibrio = (
            receita_equilibrio * taxa_impostos
        )

        variaveis_equilibrio = (
            receita_equilibrio * taxa_variaveis
        )

        margem_equilibrio = (
            receita_equilibrio
            - impostos_equilibrio
            - variaveis_equilibrio
        )

        resultado_equilibrio = (
            margem_equilibrio - fixos
        )

        # Mantém a composição original das receitas.
        proporcao_produtos = (
            _numero(mes.get("produtos")) / receita_base
        )
        proporcao_servicos = (
            _numero(mes.get("servicos")) / receita_base
        )
        proporcao_outros = (
            _numero(mes.get("outros")) / receita_base
        )

        # Mantém a composição original dos gastos variáveis.
        if variaveis_base > 0:
            proporcao_fornecedores = (
                _numero(mes.get("fornecedores"))
                / variaveis_base
            )
            proporcao_publicidade = (
                _numero(mes.get("publicidade"))
                / variaveis_base
            )
            proporcao_outros_variaveis = (
                _numero(mes.get("outros_variaveis"))
                / variaveis_base
            )
        else:
            proporcao_fornecedores = 0.0
            proporcao_publicidade = 0.0
            proporcao_outros_variaveis = 0.0

        meses_pessimista.append({
            **mes,

            "produtos": round(
                receita_equilibrio * proporcao_produtos,
                2
            ),
            "servicos": round(
                receita_equilibrio * proporcao_servicos,
                2
            ),
            "outros": round(
                receita_equilibrio * proporcao_outros,
                2
            ),

            "receita": round(receita_equilibrio, 2),
            "impostos": round(impostos_equilibrio, 2),

            "fornecedores": round(
                variaveis_equilibrio
                * proporcao_fornecedores,
                2
            ),
            "publicidade": round(
                variaveis_equilibrio
                * proporcao_publicidade,
                2
            ),
            "outros_variaveis": round(
                variaveis_equilibrio
                * proporcao_outros_variaveis,
                2
            ),

            "variaveis": round(variaveis_equilibrio, 2),
            "margem": round(margem_equilibrio, 2),
            "margemPct": round(indice_margem * 100, 2),

            # Gastos fixos permanecem os mesmos.
            "fixos": round(fixos, 2),

            # Cenário de sobrevivência não considera novos investimentos.
            "investimentos": 0.0,

            "resultado": round(resultado_equilibrio, 2),
            "ponto_equilibrio": round(receita_equilibrio, 2),
            "calculavel": True
        })

    return meses_pessimista


def obter_planejamento_financeiro():
    """
    Retorna os dados financeiros preparados para a página
    de Planejamento Financeiro.
    """

    usuario_id = session.get("usuario_id")

    if not usuario_id:
        return jsonify({
            "sucesso": False,
            "mensagem": "Usuário não autenticado"
        }), 401

    tabela_id = request.args.get(
        "tabela_id",
        "todas"
    )

    try:
        # ---------------------------------------
        # 1. Buscar dados através do agregador
        # ---------------------------------------

        contexto = obter_contexto_dados(
            usuario_id,
            escopo=tabela_id
        )

        dados = contexto.get("dados", [])

        if not dados:
            return jsonify({
                "sucesso": True,
                "nome_contexto": contexto.get(
                    "nome_contexto",
                    "Sem dados"
                ),
                "meses": [],
                "totais": {},
                "mensagem": "Nenhum dado financeiro disponível."
            }), 200

        df = pd.DataFrame(dados)

        # ---------------------------------------
        # 2. Buscar mapeamento financeiro
        # ---------------------------------------

        user = usuario.find_one(
            _filtro_usuario(usuario_id)
        )

        if not user:
            return jsonify({
                "sucesso": False,
                "mensagem": "Usuário não encontrado."
            }), 404

        mapeamento = user.get(
            "mapeamento_financeiro",
            {}
        )

        # ---------------------------------------
        # 3. Identificar período
        # ---------------------------------------

        coluna_periodo = mapeamento.get("periodo")

        if not coluna_periodo or coluna_periodo not in df.columns:

            candidatos = [
                "Data",
                "data",
                "Periodo",
                "Período",
                "periodo",
                "Mes",
                "Mês",
                "mes"
            ]

            coluna_periodo = next(
                (
                    coluna
                    for coluna in candidatos
                    if coluna in df.columns
                ),
                None
            )

        if coluna_periodo:
            df["_mes_planejamento"] = df[
                coluna_periodo
            ].apply(_converter_periodo)
        else:
            df["_mes_planejamento"] = None

        # ---------------------------------------
        # 4. Calcular indicadores por linha
        # ---------------------------------------

        df["_receita"] = _receita(
            df,
            mapeamento
        )

        df["_impostos"] = _serie_financeira(
            df,
            mapeamento,
            "impostos"
        )

        # Fallback de imposto: usar taxa manual configurada ou 8% como estimativa.
        # Guarda flag para informar o frontend que o valor é estimado.
        _usa_imposto_estimado = False
        if df["_impostos"].abs().sum() == 0:
            _usa_imposto_estimado = True
            taxa = mapeamento.get("taxa_imposto_manual")
            try:
                taxa = float(taxa) / 100
            except Exception:
                taxa = 0.08  # 8% como último recurso

            df["_impostos"] = df["_receita"] * taxa

        df["_variaveis"] = _custos_variaveis(
            df,
            mapeamento
        )

        df["_margem"] = (
            df["_receita"]
            - df["_impostos"]
            - df["_variaveis"]
        )

        df["_fixos"] = _gastos_fixos(
            df,
            mapeamento
        )

        df["_resultado_calculado"] = (
            df["_margem"]
            - df["_fixos"]
        )

        resultado_informado = _serie_financeira(
            df,
            mapeamento,
            "resultado"
        )

        if resultado_informado.abs().sum() > 0:
            df["_resultado"] = resultado_informado
        else:
            df["_resultado"] = (
                df["_resultado_calculado"]
            )

        df["_investimentos"] = _investimentos(
            df,
            mapeamento
        )

        # ---------------------------------------
        # 5. Detalhamentos
        # ---------------------------------------

        detalhes = {
            "produtos": _serie_financeira(
                df,
                mapeamento,
                "receita_produtos"
            ),
            "servicos": _serie_financeira(
                df,
                mapeamento,
                "receita_servicos"
            ),
            "outros_receita": _serie_financeira(
                df,
                mapeamento,
                "receita_outros"
            ),
            "fornecedores": _serie_financeira(
                df,
                mapeamento,
                "fornecedores"
            ),
            "publicidade": _serie_financeira(
                df,
                mapeamento,
                "publicidade"
            ),
            "outros_variaveis": _serie_financeira(
                df,
                mapeamento,
                "custo_variavel_outros"
            ),
            "aluguel": _serie_financeira(
                df,
                mapeamento,
                "aluguel"
            ),
            "folha": _serie_financeira(
                df,
                mapeamento,
                "folha_pagamento"
            ),
            "pro_labore": _serie_financeira(
                df,
                mapeamento,
                "pro_labore"
            ),
            "outros_fixos": _serie_financeira(
                df,
                mapeamento,
                "gasto_fixo_outros"
            ),
            "infraestrutura": _serie_financeira(
                df,
                mapeamento,
                "investimento_infra"
            ),
            "equipamentos": _serie_financeira(
                df,
                mapeamento,
                "investimento_equipamentos"
            ),
            "outros_inv": _serie_financeira(
                df,
                mapeamento,
                "investimento_outros"
            ),
        }

        for nome, serie in detalhes.items():
            df[f"_{nome}"] = serie

        # Adicionar séries contábeis para cada classificação customizada
        cats_custom = _obter_categorias_custom(mapeamento)
        for c_item in cats_custom:
            if isinstance(c_item, dict) and c_item.get("id"):
                cid = c_item["id"]
                col = _obter_coluna(mapeamento, cid, df)
                if col:
                    df[f"_{cid}"] = df[col].apply(_numero)
                else:
                    val_manual = mapeamento.get(f"{cid}_manual")
                    if val_manual is not None and val_manual != "":
                        try:
                            df[f"_{cid}"] = pd.Series([float(val_manual)] * len(df), index=df.index)
                        except Exception:
                            df[f"_{cid}"] = pd.Series([0.0] * len(df), index=df.index)
                    else:
                        df[f"_{cid}"] = pd.Series([0.0] * len(df), index=df.index)

        # ---------------------------------------
        # 6. Criar janeiro → dezembro
        # Meses com dados reais → projetado: False
        # Meses sem dados → projetado: True (estimativa)
        # ---------------------------------------

        meses_saida = []

        for numero_mes in range(1, 13):

            df_mes = df[
                df["_mes_planejamento"]
                == numero_mes
            ]

            tem_dados = len(df_mes) > 0 and (
                df_mes["_receita"].sum() != 0
                or df_mes["_fixos"].sum() != 0
                or df_mes["_variaveis"].sum() != 0
            )

            receita = float(
                df_mes["_receita"].sum()
            )

            impostos = float(
                df_mes["_impostos"].sum()
            )

            variaveis = float(
                df_mes["_variaveis"].sum()
            )

            margem = float(
                df_mes["_margem"].sum()
            )

            fixos = float(
                df_mes["_fixos"].sum()
            )

            resultado = float(
                df_mes["_resultado"].sum()
            )

            investimentos = float(
                df_mes["_investimentos"].sum()
            )

            margem_pct = (
                margem / receita * 100
                if receita > 0
                else 0
            )

            mes_dado = {
                "mes": MESES[numero_mes - 1],
                "numero_mes": numero_mes,
                "projetado": not tem_dados,

                "produtos": round(
                    float(
                        df_mes["_produtos"].sum()
                    ),
                    2
                ),

                "servicos": round(
                    float(
                        df_mes["_servicos"].sum()
                    ),
                    2
                ),

                "outros": round(
                    float(
                        df_mes[
                            "_outros_receita"
                        ].sum()
                    ),
                    2
                ),

                "receita": round(receita, 2),
                "impostos": round(impostos, 2),

                "fornecedores": round(
                    float(
                        df_mes[
                            "_fornecedores"
                        ].sum()
                    ),
                    2
                ),

                "publicidade": round(
                    float(
                        df_mes[
                            "_publicidade"
                        ].sum()
                    ),
                    2
                ),

                "outros_variaveis": round(
                    float(
                        df_mes[
                            "_outros_variaveis"
                        ].sum()
                    ),
                    2
                ),

                "variaveis": round(
                    variaveis,
                    2
                ),

                "margem": round(
                    margem,
                    2
                ),

                "margemPct": round(
                    margem_pct,
                    2
                ),

                "aluguel": round(
                    float(
                        df_mes["_aluguel"].sum()
                    ),
                    2
                ),

                "folha": round(
                    float(
                        df_mes["_folha"].sum()
                    ),
                    2
                ),

                "proLabore": round(
                    float(
                        df_mes[
                            "_pro_labore"
                        ].sum()
                    ),
                    2
                ),
                
                "outrosFixos": round(
                    float(
                        df_mes[
                            "_outros_fixos"
                        ].sum()
                    ),
                    2
                ),

                "infraestrutura": round(
                    float(
                        df_mes[
                            "_infraestrutura"
                        ].sum()
                    ),
                    2
                ),

                "equipamentos": round(
                    float(
                        df_mes[
                            "_equipamentos"
                        ].sum()
                    ),
                    2
                ),

                "outrosInv": round(
                    float(
                        df_mes[
                            "_outros_inv"
                        ].sum()
                    ),
                    2
                ),

                "fixos": round(
                    fixos,
                    2
                ),

                "resultado": round(
                    resultado,
                    2
                ),

                "investimentos": round(
                    investimentos,
                    2
                ),
            }

            # Adicionar valores mensais de cada classificação customizada
            for c_item in cats_custom:
                if isinstance(c_item, dict) and c_item.get("id"):
                    cid = c_item["id"]
                    mes_dado[cid] = round(float(df_mes[f"_{cid}"].sum()), 2)

            meses_saida.append(mes_dado)

        # ---------------------------------------
        # 7. Totais anuais (soma dos valores reais)
        # ---------------------------------------

        receita_total = sum(
            m["receita"]
            for m in meses_saida
        )

        impostos_total = sum(
            m["impostos"]
            for m in meses_saida
        )

        variaveis_total = sum(
            m["variaveis"]
            for m in meses_saida
        )

        margem_total = sum(
            m["margem"]
            for m in meses_saida
        )

        fixos_total = sum(
            m["fixos"]
            for m in meses_saida
        )

        resultado_total = sum(
            m["resultado"]
            for m in meses_saida
        )

        investimentos_total = sum(
            m["investimentos"]
            for m in meses_saida
        )

        margem_pct_total = (
            margem_total
            / receita_total
            * 100
            if receita_total > 0
            else 0
        )

        # ---------------------------------------
        # 7.1 Cenários Financeiros (Provável, Otimista, Pessimista)
        # ---------------------------------------

        meses_otimista = _calcular_cenario_otimista(
            meses_saida,
            fator_crescimento=1.15
        )

        meses_pessimista = _calcular_cenario_pessimista(
            meses_saida
        )

        # ---------------------------------------
        # 8. Resposta
        # ---------------------------------------

        return jsonify({
            "sucesso": True,

            "campos_custom": cats_custom,
            "categorias_custom": cats_custom,

            "imposto_estimado": _usa_imposto_estimado,

            "nome_contexto": contexto.get(
                "nome_contexto",
                "Planejamento Financeiro"
            ),

            "escopo": contexto.get(
                "escopo",
                tabela_id
            ),

            "planilhas_envolvidas": contexto.get(
                "planilhas_envolvidas",
                []
            ),

            "mapeamento_disponivel": bool(
                mapeamento
            ),

            "meses": meses_saida,

            "provavel": {
                "tipo": "realizado_projetado_medio",
                "descricao": "Cenário Provável baseado nos dados realizados com projeção linear pela média.",
                "meses": meses_saida,
                "campos_custom": cats_custom,
                "categorias_custom": cats_custom
            },

            "otimista": {
                "tipo": "maximizacao_sustentavel",
                "descricao": "Cenário Otimista com crescimento sustentável de 15% na receita e custos controlados.",
                "meses": meses_otimista,
                "campos_custom": cats_custom,
                "categorias_custom": cats_custom
            },

            "pessimista": {
                "tipo": "ponto_equilibrio",
                "descricao": (
                    "Faturamento mínimo estimado para "
                    "manter a operação sem prejuízo."
                ),
                "meses": meses_pessimista,
                "campos_custom": cats_custom,
                "categorias_custom": cats_custom
            },

            "totais": {
                "receita": round(
                    receita_total,
                    2
                ),
                "impostos": round(
                    impostos_total,
                    2
                ),
                "variaveis": round(
                    variaveis_total,
                    2
                ),
                "margem": round(
                    margem_total,
                    2
                ),
                "margemPct": round(
                    margem_pct_total,
                    2
                ),
                "fixos": round(
                    fixos_total,
                    2
                ),
                "resultado": round(
                    resultado_total,
                    2
                ),
                "investimentos": round(
                    investimentos_total,
                    2
                ),
            }

        }), 200

    except Exception as e:

        print(
            f"Erro no Planejamento Financeiro: {e}"
        )

        return jsonify({
            "sucesso": False,
            "mensagem":
                "Erro ao processar Planejamento Financeiro.",
            "erro": str(e)
        }), 500