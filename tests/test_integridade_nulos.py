import unittest
import numpy as np
import pandas as pd
from backend.dados.dados import (
    eh_coluna_financeira,
    preencher_inteligente,
    limpar_dados_conservador,
    converter_para_tipos_nativos
)
from backend.dados.quality import analisar_qualidade, aplicar_limpeza_automatica


class TestIntegridadeValoresFinanceirosNulos(unittest.TestCase):
    """
    Suíte de testes de integridade para tratamento conservador de valores
    financeiros ausentes/nulos:
    1. Identificação precisa de colunas financeiras (eh_coluna_financeira).
    2. Proibição de imputação artificial (média/moda) em colunas financeiras
       tanto em preencher_inteligente quanto em aplicar_limpeza_automatica.
    3. Preservação de valores ausentes em limpar_dados_conservador sem fillna(0) global.
    4. Conversão para tipos BSON (converter_para_tipos_nativos) preservando None (null).
    5. Robustez dos cálculos ao processar registros contendo None/null localmente.
    """

    def test_identificacao_colunas_financeiras(self):
        """Valida se termos financeiros sensíveis são corretamente identificados."""
        colunas_financeiras = [
            "Receita", "Receita_Total", "faturamento_bruto", "Preco_Unitario",
            "Custo", "Custo_Total", "Despesa_Fixa", "Despesas_Operacionais",
            "Imposto_DAS", "Tributos", "Lucro", "Margem_Bruta", "CMV", "CPV",
            "investimento_inicial", "salario_funcionario", "pro_labore"
        ]
        for col in colunas_financeiras:
            self.assertTrue(
                eh_coluna_financeira(col),
                f"Coluna '{col}' deveria ser identificada como financeira."
            )

        colunas_nao_financeiras = [
            "ID", "Produto", "Categoria", "Cliente", "Data", "Status",
            "Quantidade", "Observacoes", "Regiao", "Vendedor_Nome"
        ]
        for col in colunas_nao_financeiras:
            self.assertFalse(
                eh_coluna_financeira(col),
                f"Coluna '{col}' NÃO deveria ser identificada como financeira."
            )

    def test_preencher_inteligente_nao_imputa_media_em_coluna_financeira(self):
        """
        Garante que preencher_inteligente NÃO preenche nulos em colunas
        financeiras com a média, enquanto preenche colunas não-financeiras.
        """
        df = pd.DataFrame({
            "Receita": [1000.0, 2000.0, np.nan, 3000.0, 4000.0],  # 20% nulo
            "Score_Qualidade": [10.0, 20.0, np.nan, 30.0, 40.0],  # 20% nulo (não financeiro)
        })

        df_processado = preencher_inteligente(df)

        # Receita deve permanecer com NaN na posição 2 (sem média 2500)
        self.assertTrue(pd.isna(df_processado.loc[2, "Receita"]))

        # Score_Qualidade (não-financeira) deve receber a média das demais (25.0)
        self.assertEqual(df_processado.loc[2, "Score_Qualidade"], 25.0)

    def test_limpar_dados_conservador_preserva_ausencias_financeiras(self):
        """
        Valida que limpar_dados_conservador não aplica fillna(0) indiscriminado
        em campos financeiros, preservando None/NaN para integridade contábil.
        """
        df = pd.DataFrame({
            "Produto": ["A", "B", "C"],
            "Receita": [150.0, np.nan, 350.0],
            "Custo": [np.nan, 80.0, 120.0],
            "Estoque_Qtd": [10.0, np.nan, 30.0]  # Numérico não-financeiro
        })

        df_limpo = limpar_dados_conservador(df)

        # Colunas financeiras mantêm NaN (preservadas para tratamento local)
        self.assertTrue(pd.isna(df_limpo.loc[1, "Receita"]))
        self.assertTrue(pd.isna(df_limpo.loc[0, "Custo"]))

        # Coluna numérica não-financeira com <=20% pode ser imputada ou tratada
        self.assertFalse(pd.isna(df_limpo.loc[0, "Estoque_Qtd"]))

    def test_converter_para_tipos_nativos_preserva_none_bson_financeiro(self):
        """
        Valida que converter_para_tipos_nativos converte NaN em colunas financeiras
        para None (compatível com MongoDB BSON null) em vez de 0.0 artificial ou string vazia.
        """
        registros = [
            {"Produto": "Item 1", "Receita": 100.50, "Custo": np.nan, "Status": "OK"},
            {"Produto": "Item 2", "Receita": np.nan, "Custo": 45.0, "Status": None},
            {"Produto": "Item 3", "Receita": "", "Custo": "null", "Status": ""}
        ]

        convertidos = converter_para_tipos_nativos(registros)

        # Item 1: Custo financeiro ausente deve ser None
        self.assertIsNone(convertidos[0]["Custo"])
        self.assertEqual(convertidos[0]["Receita"], 100.50)

        # Item 2: Receita financeira ausente deve ser None
        self.assertIsNone(convertidos[1]["Receita"])
        self.assertEqual(convertidos[1]["Custo"], 45.0)
        # Status (não financeiro) ausente converte para string vazia
        self.assertEqual(convertidos[1]["Status"], "")

        # Item 3: Strings vazias/null em campos financeiros devem virar None
        self.assertIsNone(convertidos[2]["Receita"])
        self.assertIsNone(convertidos[2]["Custo"])

    def test_quality_aplicar_limpeza_automatica_preserva_coluna_financeira(self):
        """
        Valida que a rotina de limpeza do módulo quality.py respeita
        a regra de não imputar média nem moda em colunas financeiras.
        """
        df = pd.DataFrame({
            "Faturamento": [5000.0, 7000.0, np.nan, 8000.0, 10000.0],
            "Avaliacao_Cliente": [4.0, 5.0, np.nan, 4.0, 5.0]
        })

        relatorio = analisar_qualidade(df)
        df_limpo, log_acoes = aplicar_limpeza_automatica(
            df,
            relatorio,
            cap_outliers=False,
            remover_duplicatas=False,
            padronizar_texto=False
        )

        # Faturamento deve permanecer ausente (NaN)
        self.assertTrue(pd.isna(df_limpo.loc[2, "Faturamento"]))

        # Avaliacao_Cliente (não-financeira) pode receber média
        self.assertFalse(pd.isna(df_limpo.loc[2, "Avaliacao_Cliente"]))

    def test_robustez_calculo_financeiro_com_nulos_locais(self):
        """
        Demonstra que o cálculo analítico tolera valores None sem falhar,
        utilizando coerção local (fillna(0) no momento da soma) sem corromper os dados originais.
        """
        registros_banco = [
            {"receita": 1000.0, "despesa": 300.0},
            {"receita": None, "despesa": 200.0},  # ausente
            {"receita": 2500.0, "despesa": None},  # ausente
            {"receita": 1500.0, "despesa": 400.0}
        ]

        df = pd.DataFrame(registros_banco)

        # Coerção local segura utilizada nos módulos de cálculo
        receita_total = pd.to_numeric(df["receita"], errors="coerce").fillna(0).sum()
        despesa_total = pd.to_numeric(df["despesa"], errors="coerce").fillna(0).sum()
        lucro = receita_total - despesa_total

        self.assertEqual(receita_total, 5000.0)
        self.assertEqual(despesa_total, 900.0)
        self.assertEqual(lucro, 4100.0)

        # Confirma que os registros originais não foram alterados para 0.0 indevidamente
        self.assertIsNone(registros_banco[1]["receita"])
        self.assertIsNone(registros_banco[2]["despesa"])


if __name__ == "__main__":
    unittest.main()
