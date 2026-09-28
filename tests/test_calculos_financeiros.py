"""
test_calculos_financeiros.py — Testes Unitários de Auditoria Financeira e Matemática
DataInsight — Validação de Métricas, DRE, Ponto de Equilíbrio, Cenários e Variações"""

import unittest
import pandas as pd
import numpy as np


class TestVariacaoPercentual(unittest.TestCase):
    """Validação da fórmula de variação percentual entre períodos contábeis."""

    def test_positivo_para_positivo(self):
        from backend.analise.analise import variacao_percentual
        self.assertEqual(variacao_percentual(100, 150), 50.0)
        self.assertEqual(variacao_percentual(100, 80), -20.0)

    def test_negativo_para_positivo(self):
        from backend.analise.analise import variacao_percentual
        # De prejuízo de -100 para lucro de +100 -> variação real de +200%(resolve inversão do denominador)
        self.assertEqual(variacao_percentual(-100, 100), 200.0)

    def test_positivo_para_negativo(self):
        from backend.analise.analise import variacao_percentual
        # De lucro de +100 para prejuízo de -100 -> variação de-200%
        self.assertEqual(variacao_percentual(100, -100), -200.0)

    def test_negativo_para_mais_negativo(self):
        from backend.analise.analise import variacao_percentual
        # De -100 para -150 -> piora de -50%
        self.assertEqual(variacao_percentual(-100, -150), -50.0)

    def test_base_zero(self):
        from backend.analise.analise import variacao_percentual
        self.assertEqual(variacao_percentual(0, 0), 0.0)
        self.assertIsNone(variacao_percentual(0, 500))
        self.assertIsNone(variacao_percentual(0, -500))

    def test_home_percentual(self):
        from backend.home.home import percentual
        self.assertEqual(percentual(100, 150), 50.0)
        self.assertEqual(percentual(-100, 100), 200.0)
        self.assertEqual(percentual(0, 0), 0.0)
        self.assertIsNone(percentual(0, 100))
        self.assertIsNone(percentual(0, -100))

    def test_analise_estrategica_variacao(self):
        from backend.analise.analise_estrategica import variacao_percentual as var_est
        self.assertEqual(var_est(100, 150), 50.0)
        self.assertEqual(var_est(-100, 100), 200.0)
        self.assertEqual(var_est(0, 0), 0.0)
        self.assertIsNone(var_est(0, 500))
        self.assertIsNone(var_est(0, -500))


class TestPontoDeEquilibrio(unittest.TestCase):
    """Validação da fórmula oficial de Ponto de Equilíbrio Contábil (PE = Fixos / IMC)."""

    def test_calculo_pe_padrao(self):
        receita = 100000.0
        impostos = 8000.0
        variaveis = 32000.0
        fixos = 30000.0

        margem_contribuicao = receita - impostos - variaveis
        imc = margem_contribuicao / receita
        pe = fixos / imc

        self.assertAlmostEqual(margem_contribuicao, 60000.0)
        self.assertAlmostEqual(imc, 0.60)
        self.assertAlmostEqual(pe, 50000.0)

        rec_pe = pe
        imp_pe = rec_pe * (impostos / receita)
        var_pe = rec_pe * (variaveis / receita)
        resultado_pe = rec_pe - imp_pe - var_pe - fixos
        self.assertAlmostEqual(resultado_pe, 0.0, places=2)


class TestCenariosAnaliseEstrategica(unittest.TestCase):
    """Validação de coerência algébrica (Lucro = Receita - Despesa) nos cenários."""

    def test_cenarios_empresa_lucrativa(self):
        from backend.analise.analise_estrategica import calcular_cenarios
        cenarios = calcular_cenarios(
            faturamento=100000,
            despesas=70000,
            lucro=30000,
            margem=30.0,
            series_faturamento=[90000, 95000, 100000],
            series_lucro=[25000, 28000, 30000]
        )

        for c_nome in ["provavel", "otimista", "pessimista"]:
            c = cenarios[c_nome]
            self.assertAlmostEqual(c["faturamento"] - c["despesas"], c["lucro"], places=1)
            self.assertGreater(c["faturamento"], 0)

        self.assertGreater(cenarios["otimista"]["lucro"], cenarios["provavel"]["lucro"])
        self.assertLess(cenarios["pessimista"]["lucro"], cenarios["provavel"]["lucro"])

    def test_cenarios_empresa_em_prejuizo(self):
        from backend.analise.analise_estrategica import calcular_cenarios
        cenarios = calcular_cenarios(
            faturamento=50000,
            despesas=70000,
            lucro=-20000,
            margem=-40.0,
            series_faturamento=[50000, 50000, 50000],
            series_lucro=[-20000, -20000, -20000]
        )

        for c_nome in ["provavel", "otimista", "pessimista"]:
            c = cenarios[c_nome]
            self.assertAlmostEqual(c["faturamento"] - c["despesas"], c["lucro"], places=1)

        self.assertGreater(cenarios["otimista"]["lucro"], cenarios["provavel"]["lucro"])
        self.assertLess(cenarios["pessimista"]["lucro"], cenarios["provavel"]["lucro"])


class TestProjecao6MesesDashboard(unittest.TestCase):
    """Validação da sincronização de 6 meses no Dashboard (Lucro = Receita - Despesa)."""

    def test_reconciliacao_todos_meses(self):
        from backend.DashBoard.dashboard_Servicos import calcular_cenarios_projecao_6_meses
        from datetime import datetime
        historico_3m = {
            "labels": ["Jan/26", "Fev/26", "Mar/26"],
            "receita": [100000.0, 105000.0, 110000.0],
            "despesa": [70000.0, 72000.0, 75000.0],
            "lucro": [30000.0, 33000.0, 35000.0],
            "ultima_data": datetime(2026, 3, 31)
        }

        proj = calcular_cenarios_projecao_6_meses(
            historico_3m=historico_3m,
            meses_projecao=6
        )

        self.assertIn("cenarios", proj)
        for c_key in ["provavel", "otimista", "pessimista"]:
            cen = proj["cenarios"][c_key]
            lucros = cen["series"]["lucro"]
            receitas = cen["series"]["receita"]
            despesas = cen["series"]["despesa"]

            self.assertEqual(len(lucros), 6)
            for m in range(6):
                self.assertAlmostEqual(receitas[m] - despesas[m], lucros[m], places=1,
                                         msg=f"Falha de conciliação no mês {m+ 1} do cenário {c_key}")

            self.assertAlmostEqual(cen["receita_total"] - cen["despesa_total"], cen["lucro_total"], places=1)


class TestClassificacaoEPreviewFinanceiro(unittest.TestCase):
    """Validação da agreglção de custos fixos, variáveis e investimentos."""

    def test_soma_aditiva_fixos(self):
        from backend.dados.classificacao_financeira import calcular_preview_financeiro

        df = pd.DataFrame({
            "Faturamento": [10000.0, 20000.0],
            "Aluguel": [2000.0, 2000.0],
            "Folha": [5000.0, 5000.0],
            "Outros Fixos": [1000.0, 1000.0],
            "Fornecedores": [3000.0, 4000.0],
            "Marketing": [500.0, 500.0]
        })

        mapeamento = {
            "receita_total": "Faturamento",
            "aluguel": "Aluguel",
            "folha_pagamento": "Folha",
            "gasto_fixo_outros": "Outros Fixos",
            "fornecedores": "Fornecedores",
            "publicidade": "Marketing",
            "taxa_imposto_manual": 10.0
        }

        preview = calcular_preview_financeiro(mapeamento, df)

        self.assertEqual(preview["receita_total"], 30000.0)
        self.assertEqual(preview["impostos"], 3000.0)
        self.assertEqual(preview["custo_variavel"], 8000.0)
        self.assertEqual(preview["margem_contribuicao_rs"], 19000.0)
        self.assertEqual(preview["gastos_fixos"], 16000.0)
        self.assertEqual(preview["resultado"], 3000.0)


class TestFluxoCaixaImpostos(unittest.TestCase):
    """Validação da inclusão de impostos nas saídas totais do fluxo de caixa."""

    def test_saidas_totais_incluem_impostos(self):
        from backend.fluxoCaixa.fluxo_caixa import preparar_dataframe_financeiro

        df = pd.DataFrame({
            "Data": ["2026-01-10", "2026-01-20"],
            "Vendas": [50000.0, 50000.0],
            "Fornecedores": [15000.0, 15000.0],
            "Folha": [10000.0, 10000.0],
            "Impostos": [4000.0, 4000.0]
        })

        mapeamento = {
            "periodo": "Data",
            "receita_total": "Vendas",
            "fornecedores": "Fornecedores",
            "folha_pagamento": "Folha",
            "impostos": "Impostos"
        }

        df_calc = preparar_dataframe_financeiro(df, mapeamento)

        tot_receita = df_calc["_receita"].sum()
        tot_variaveis = df_calc["_variaveis"].sum()
        tot_fixos = df_calc["_fixos"].sum()
        tot_impostos = df_calc["_impostos"].sum()
        tot_saidas = df_calc["_saidas_totais"].sum()
        tot_saldo = df_calc["_saldo"].sum()

        self.assertEqual(tot_receita, 100000.0)
        self.assertEqual(tot_variaveis, 30000.0)
        self.assertEqual(tot_fixos, 20000.0)
        self.assertEqual(tot_impostos, 8000.0)
        self.assertEqual(tot_saidas, 58000.0)
        self.assertEqual(tot_saldo, 42000.0)


class TestRentabilidadeELucratividade(unittest.TestCase):
    """Validação da separação estrita entre Lucratividade e Rentabilidade (CFC / SEBRAE)."""

    def test_lucratividade_padrao_e_prejuizo(self):
        # Lucratividade (%) = (Resultado / Receita) * 100
        rec = 100000.0
        lucro = 25000.0
        lucratividade = (lucro / rec) * 100.0 if rec > 0 else 0.0
        self.assertEqual(lucratividade, 25.0)

        # Caso em prejuízo: resultado negativo é preservado (não vira zero)
        prejuizo = -15000.0
        lucratividade_neg = (prejuizo / rec) * 100.0 if rec > 0 else 0.0
        self.assertEqual(lucratividade_neg, -15.0)

        # Receita zero: não gera divisão por zero
        rec_zero = 0.0
        lucratividade_zero = (lucro / rec_zero) * 100.0 if rec_zero > 0 else 0.0
        self.assertEqual(lucratividade_zero, 0.0)

    def test_rentabilidade_com_e_sem_investimento(self):
        # Rentabilidade (%) = (Resultado / Investimentos) * 100
        lucro = 20000.0
        investimentos = 50000.0
        rentabilidade = (lucro / investimentos) * 100.0 if investimentos > 0 else None
        self.assertEqual(rentabilidade, 40.0)

        # Prejuízo sobre investimento:
        prejuizo = -10000.0
        rentabilidade_neg = (prejuizo / investimentos) * 100.0 if investimentos > 0 else None
        self.assertEqual(rentabilidade_neg, -20.0)

        # Sem investimento informado (0 ou ausente): Rentabilidade = None (incalculável, NUNCA substituir por margem)
        invest_zero = 0.0
        rentabilidade_incalculavel = (lucro / invest_zero) * 100.0 if invest_zero > 0 else None
        self.assertIsNone(rentabilidade_incalculavel)


class TestPontoDeEquilibrioLimites(unittest.TestCase):
    """Validação de casos limites de Ponto de Equilíbrio (Margem Negativa e Gastos Fixos Zero)."""

    def test_margem_contribuicao_negativa_incalculavel(self):
        # Quando despesas variáveis + impostos superam a receita, IMC <= 0
        receita = 50000.0
        impostos = 5000.0
        variaveis = 55000.0  # Variaveis > Receita
        fixos = 20000.0

        margem_contribuicao = receita - impostos - variaveis
        imc = margem_contribuicao / receita

        self.assertLess(imc, 0.0)
        pe = (fixos / imc) if imc > 0 else None
        self.assertIsNone(pe)

    def test_gastos_fixos_zero(self):
        receita = 100000.0
        impostos = 8000.0
        variaveis = 32000.0
        fixos = 0.0

        margem_contribuicao = receita - impostos - variaveis
        imc = margem_contribuicao / receita
        pe = (fixos / imc) if imc > 0 else None
        self.assertEqual(pe, 0.0)


class TestConsumidoresBaseZeroSemExcecao(unittest.TestCase):
    """Garantir que consumidores de variação percentual não lancem TypeError quando base for 0."""

    def test_montar_analises_decisao_com_base_zero(self):
        from backend.analise.analise import montar_analises_decisao
        res = montar_analises_decisao(
            faturamento=50000.0,
            despesas=35000.0,
            lucro=15000.0,
            margem=30.0,
            faturamento_anterior=0.0,
            lucro_anterior=0.0,
            series_faturamento=[50000.0],
            series_lucro=[15000.0]
        )
        self.assertIn("classificacao", res)
        self.assertIn("sinais", res)
        self.assertIsNone(res["sinais"]["crescimento_faturamento"])
        self.assertIsNone(res["sinais"]["crescimento_lucro"])

    def test_calcular_saude_negocio_com_base_zero(self):
        from backend.analise.analise_estrategica import calcular_saude_negocio
        saude = calcular_saude_negocio(
            faturamento=50000.0,
            despesas=35000.0,
            lucro=15000.0,
            margem=30.0,
            faturamento_anterior=0.0,
            lucro_anterior=0.0,
            series_faturamento=[50000.0],
            series_lucro=[15000.0]
        )
        self.assertIn("score", saude)
        self.assertTrue(0 <= saude["score"] <= 100)
        self.assertIsNone(saude["indicadores"]["crescimento_receita"])

    def test_gerar_alertas_e_recomendacoes_com_base_zero(self):
        from backend.analise.analise_estrategica import gerar_alertas, gerar_recomendacoes
        alertas = gerar_alertas(
            faturamento=50000.0,
            despesas=35000.0,
            lucro=15000.0,
            margem=30.0,
            faturamento_anterior=0.0,
            lucro_anterior=0.0
        )
        self.assertIsInstance(alertas, list)

        recomendacoes = gerar_recomendacoes(
            faturamento=50000.0,
            despesas=35000.0,
            lucro=15000.0,
            margem=30.0,
            crescimento_faturamento=None,
            crescimento_lucro=None
        )
        self.assertIsInstance(recomendacoes, list)


class TestDREConsistenciaEPrejuizo(unittest.TestCase):
    """Validação da estrutura formal de DRE e preservação de prejuízo operacional (CPC 26)."""

    def test_dre_completo_empresa_em_prejuizo(self):
        from backend.DashBoard.dashboard_Servicos import calcular_dre_completo

        df = pd.DataFrame({
            "Data": ["2026-01-15"],
            "Vendas": [50000.0],
            "Fornecedores": [35000.0],
            "Aluguel": [25000.0],
            "Impostos": [4000.0]
        })

        mapa = {
            "data": "Data",
            "receita": "Vendas",
            "despesa": "Aluguel",
            "lucro": None,
            "categoria": None
        }

        map_fin = {
            "receita_total": "Vendas",
            "fornecedores": "Fornecedores",
            "aluguel": "Aluguel",
            "impostos": "Impostos"
        }

        dre = calcular_dre_completo(df, mapa, map_fin, periodo=30)
        linhas_map = {item["id"]: item for item in dre}

        # Receita bruta: 50.000
        self.assertEqual(linhas_map["faturamento_bruto"]["valor"], 50000.0)
        # Impostos: -4.000
        self.assertEqual(linhas_map["impostos_taxas"]["valor"], -4000.0)
        # Receita líquida: 46.000
        self.assertEqual(linhas_map["receita_liquida"]["valor"], 46000.0)
        # Custos variáveis: -35.000
        self.assertEqual(linhas_map["custo_variavel"]["valor"], -35000.0)
        # Margem de contribuição: 11.000
        self.assertEqual(linhas_map["margem_contribuicao"]["valor"], 11000.0)
        # Despesas fixas: -25.000
        self.assertEqual(linhas_map["despesa_fixa"]["valor"], -25000.0)
        # Resultado final: 11.000 - 25.000 = -14.000 (Prejuízo preservado!)
        self.assertEqual(linhas_map["resultado_lucro"]["valor"], -14000.0)
        # Tipo deve ser explicitamente classificado como negativo:
        self.assertEqual(linhas_map["resultado_lucro"]["tipo"], "negativo")

    def test_dre_valores_altos_e_decimais(self):
        from backend.dados.classificacao_financeira import calcular_preview_financeiro

        df = pd.DataFrame({
            "Receita": [12345678.90],
            "CMV": [4567890.12],
            "Folha": [3456789.01],
            "Impostos": [987654.31]
        })

        mapeamento = {
            "receita_total": "Receita",
            "custo_variavel": "CMV",
            "folha_pagamento": "Folha",
            "impostos": "Impostos"
        }

        preview = calcular_preview_financeiro(mapeamento, df)

        rec = 12345678.90
        imp = 987654.31
        var = 4567890.12
        fix = 3456789.01
        res_esperado = round(rec - imp - var - fix, 2)

        self.assertEqual(preview["receita_total"], rec)
        self.assertEqual(preview["impostos"], imp)
        self.assertEqual(preview["custo_variavel"], var)
        self.assertEqual(preview["gastos_fixos"], fix)
        self.assertAlmostEqual(preview["resultado"], res_esperado, places=2)


if __name__ == '__main__':
    unittest.main()
