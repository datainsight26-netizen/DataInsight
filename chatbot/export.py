import io
import pandas as pd
from flask import send_file, session
from typing import Optional

from backend.db import dados_colecao


def gerar_arquivo_download(tipo: str = "pdf", periodo: str = "30_dias", **kwargs) -> str:
    tipo = str(kwargs.get("tipo", tipo)).lower()
    periodo = str(kwargs.get("periodo", periodo))

    if tipo == "pdf":
        try:
            from backend.home.home import calcular_desempenho, obter_dados_graficos

            resp_kpi = calcular_desempenho(periodo)
            resp_kpi_obj = resp_kpi[0] if isinstance(resp_kpi, tuple) else resp_kpi
            kpis_data = resp_kpi_obj.get_json() if hasattr(resp_kpi_obj, "get_json") else resp_kpi_obj

            if isinstance(kpis_data, dict):
                kpis = {
                    "faturamento": f"{kpis_data.get('faturamento', {}).get('valor', 0):,.2f}",
                    "lucro": f"{kpis_data.get('lucro', {}).get('valor', 0):,.2f}",
                    "despesas": f"{kpis_data.get('despesa', {}).get('valor', 0):,.2f}",
                    "crescimento": f"{kpis_data.get('crescimento', {}).get('valor', 0):.1f}%",
                }
            else:
                kpis = {"faturamento": "0,00", "lucro": "0,00", "despesas": "0,00", "crescimento": "0%"}

            resp_graf = obter_dados_graficos(periodo)
            resp_graf_obj = resp_graf[0] if isinstance(resp_graf, tuple) else resp_graf
            graficos_data = resp_graf_obj.get_json() if hasattr(resp_graf_obj, "get_json") else resp_graf_obj

            tabela_pdf = []
            barras = graficos_data.get("grafico_barras", {}) if isinstance(graficos_data, dict) else {}

            if barras and "labels" in barras:
                for i, label in enumerate(barras["labels"]):
                    try:
                        fat = barras["series"][0]["data"][i]
                        desp = barras["series"][1]["data"][i]
                        luc = barras["series"][2]["data"][i]
                        margem = f"{(luc / fat * 100):.1f}%" if fat > 0 else "0%"
                        tabela_pdf.append({
                            "mes": label,
                            "fat": f"{fat:,.2f}",
                            "luc": f"{luc:,.2f}",
                            "desp": f"{desp:,.2f}",
                            "margem": margem,
                        })
                    except Exception:
                        pass

            from flask import session
            session["relatorio_dados"] = {
                "nome": "Relatório Gerado por IA",
                "periodo": periodo.replace("_", " ").title(),
                "data": __import__('datetime').datetime.now().strftime("%d/%m/%Y"),
                "kpis": kpis,
                "grafico": True,
                "tendencias": True,
                "margem": True,
                "dadosDetalhados": True,
                "tabela": tabela_pdf,
                "insights": ["Relatório automatizado gerado a partir do histórico disponível."],
            }
        except Exception as e:
            print(f"[Erro PDF Session]: {e}")

        return (
            "Seu relatório PDF foi preparado com sucesso!\n\n"
            f"[Clique aqui para baixar seu relatório em PDF](/api/gerar-pdf-ia?periodo={periodo})"
        )

    if tipo in ["csv", "excel", "xlsx"]:
        formato_url = "excel" if "excel" in tipo or "xlsx" in tipo else "csv"
        return (
            f"Relatório exportado com sucesso!\n\n"
            f"[Clique aqui para baixar seu arquivo {tipo.upper()}](/api/download/{formato_url})"
        )

    return "Tipo de arquivo inválido. Formatos suportados: PDF, Excel ou CSV."


def exportar_dados_usuario(tipo: str):
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Não autorizado", 401

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado encontrado", 404

        df = pd.DataFrame(documento["dados"])

        if tipo == "csv":
            buffer = io.BytesIO(df.to_csv(index=False, encoding="utf-8").encode("utf-8"))
            return send_file(
                buffer,
                mimetype="text/csv",
                as_attachment=True,
                download_name="relatorio_datainsight.csv",
            )

        if tipo == "excel":
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Dados Financeiros")
            excel_buffer.seek(0)
            return send_file(
                excel_buffer,
                mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                as_attachment=True,
                download_name="relatorio_datainsight.xlsx",
            )

    except Exception as err:
        print(f"[Erro Exportação]: {err}")
        return "Erro interno ao gerar exportação", 500
