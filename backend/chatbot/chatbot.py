import base64
import io
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import jsonify, request, send_file, session
import traceback

from backend.db import chat_historico, dados_colecao, galeria
from backend.home.home import (
    COL_CATEGORIA,
    COL_DESPESA,
    COL_FATURAMENTO,
    COL_LUCRO,
    calcular_desempenho,
    calcular_total_dinamico,
    converter_datas,
    encontrar_coluna_data,
    encontrar_coluna_produto,
    encontrar_coluna_categoria,
    encontrar_coluna_quantidade,
    encontrar_coluna_estoque,
    filtrar_df,
    obter_colunas_mapeadas,
    obter_dados_graficos,
)

load_dotenv()

_KOKORO_PIPELINES: Dict[str, Any] = {}


# ==============================================================================
# ORQUESTRADOR GEMINI API
# ==============================================================================

class GeminiOrchestrator:
    """Wrapper para integração com a API Google Gemini via REST."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        self.model = model or os.getenv("GOOGLE_GEMINI_MODEL", "gemini-2.5-flash")

    def run(self, prompt: str) -> SimpleNamespace:
        return SimpleNamespace(content=self._gerar_resposta(prompt))

    def _gerar_resposta(self, prompt: str) -> str:
        if not self.api_key:
            return (
                "Desculpe — a integração com a API Gemini não está configurada. "
                "Defina a variável de ambiente `GOOGLE_API_KEY`."
            )

        endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
            f"?key={self.api_key}"
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 1024,
            },
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            endpoint,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        max_retries = 3
        backoff = 1
        last_error = None

        for attempt in range(1, max_retries + 1):
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    body = json.loads(response.read().decode("utf-8"))
                    candidates = body.get("candidates", [])
                    if not candidates:
                        return "Não foi possível extrair a resposta do modelo."

                    candidate = candidates[0]
                    if not isinstance(candidate, dict):
                        return "Não foi possível extrair a resposta do modelo."

                    content = candidate.get("content", {})
                    if isinstance(content, dict):
                        parts = content.get("parts", [])
                        textos = [
                            str(part.get("text", "")).strip()
                            for part in parts
                            if isinstance(part, dict) and part.get("text")
                        ]
                        if textos:
                            return "\n".join(textos).strip()

                    if "output" in candidate:
                        return str(candidate.get("output", "")).strip()

                    return "Não foi possível extrair a resposta do modelo."

            except urllib.error.HTTPError as err:
                status = err.code
                detalhe = err.read().decode('utf-8', errors='ignore')[:300]
                print(f"[Erro Gemini API HTTP {status}]: {detalhe}")
                last_error = err
                if 500 <= status < 600 and attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
            except urllib.error.URLError as err:
                print(f"[Erro Gemini API URLError]: {err}")
                last_error = err
                if attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break
            except Exception as err:
                detalhe = str(err)
                print(f"[Erro Gemini API Exception]: {detalhe}")
                last_error = err
                if attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                break

        if last_error is not None:
            detalhe = str(last_error)
            if hasattr(last_error, "read"):
                try:
                    detalhe = f"{last_error}: {last_error.read().decode('utf-8')[:300]}"
                except Exception:
                    pass
            print(f"[Erro Gemini API final]: {detalhe}")

        return (
            "Desculpe — não consegui contatar a API Gemini no momento. "
            "Por favor, verifique a chave de API e a conectividade de rede."
        )


# ==============================================================================
# SÍNTESE DE VOZ (TTS)
# ==============================================================================

def _limpar_texto_para_voz(texto: str) -> str:
    if not texto:
        return ''
    texto_limpo = re.sub(r'\*+', '', texto)
    texto_limpo = re.sub(r'`+', '', texto_limpo)
    texto_limpo = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', texto_limpo)
    texto_limpo = re.sub(r' {2,}', ' ', texto_limpo)
    return texto_limpo.strip()


def sintetizar_resposta_voz(texto: str) -> Optional[Tuple[str, str]]:
    """Sintetiza o texto em áudio via Kokoro (WAV) ou gTTS (MP3) como fallback."""
    texto = _limpar_texto_para_voz(texto)
    if not texto:
        return None

    try:
        import importlib.util
        if importlib.util.find_spec("kokoro") is not None:
            from kokoro import KPipeline

            resultado = None
            for lang_code in ["pt-BR", "pt_br", "pt", "a"]:
                try:
                    if lang_code not in _KOKORO_PIPELINES:
                        _KOKORO_PIPELINES[lang_code] = KPipeline(lang_code=lang_code)
                    pipeline = _KOKORO_PIPELINES[lang_code]
                    resultado = pipeline(texto)
                    break
                except Exception:
                    _KOKORO_PIPELINES.pop(lang_code, None)

            if resultado is not None:
                audio_bytes = None
                if isinstance(resultado, (bytes, bytearray)):
                    audio_bytes = bytes(resultado)
                elif hasattr(resultado, "audio") and isinstance(resultado.audio, (bytes, bytearray)):
                    audio_bytes = bytes(resultado.audio)
                elif isinstance(resultado, dict) and resultado.get("audio"):
                    raw = resultado["audio"]
                    if isinstance(raw, (bytes, bytearray)):
                        audio_bytes = bytes(raw)
                    elif isinstance(raw, str):
                        try:
                            audio_bytes = base64.b64decode(raw)
                        except Exception:
                            audio_bytes = raw.encode("utf-8")

                if audio_bytes:
                    return base64.b64encode(audio_bytes).decode("utf-8"), "audio/wav"
    except Exception as err:
        print(f"[Kokoro TTS fallback]: {err}")

    try:
        from gtts import gTTS

        buffer = io.BytesIO()
        gTTS(text=texto, lang="pt").write_to_fp(buffer)
        buffer.seek(0)
        return base64.b64encode(buffer.read()).decode("utf-8"), "audio/mpeg"
    except Exception as err:
        print(f"[gTTS erro]: {err}")
        return None


def sintetizar_texto_voz(texto: str) -> Optional[Tuple[str, str]]:
    """Função legada/alias para sintetizar áudio."""
    return sintetizar_resposta_voz(texto)


# ==============================================================================
# FERRAMENTAS ANALÍTICAS E DE NEGÓCIO
# ==============================================================================

def obter_resumo_financeiro(periodo: str = "30_dias", **kwargs) -> str:
    """Retorna o resumo financeiro (faturamento, lucro, despesa) para o período."""
    periodo = kwargs.get("periodo", periodo)
    try:
        resposta, status = calcular_desempenho(periodo)
        if status != 200:
            return "Não foi possível recuperar os dados financeiros no momento."

        dados = resposta.get_json() if hasattr(resposta, "get_json") else resposta
        if not dados or "faturamento" not in dados:
            return "Dados financeiros insuficientes ou inexistentes."

        fat = dados["faturamento"]
        luc = dados["lucro"]
        desp = dados["despesa"]
        cres = dados["crescimento"]

        return (
            f"Resumo do período ({periodo}):\n"
            f"- Faturamento: R$ {fat.get('valor', 0):,.2f} ({fat.get('percentual', 0)}%)\n"
            f"- Lucro: R$ {luc.get('valor', 0):,.2f} ({luc.get('percentual', 0)}%)\n"
            f"- Despesas: R$ {desp.get('valor', 0):,.2f} ({desp.get('percentual', 0)}%)\n"
            f"- Crescimento: {cres.get('valor', 0)}%"
        )
    except Exception as err:
        return f"Erro ao processar resumo financeiro: {err}"


def obter_transacoes_recentes(limite: int = 5, **kwargs) -> str:
    """Retorna as transações mais recentes registradas pelo usuário."""
    limite = kwargs.get("limite", limite)
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado financeiro encontrado."

        df = pd.DataFrame(documento["dados"])
        recentes = df.tail(limite).to_string(index=False)
        return f"Últimos registros encontrados:\n{recentes}"
    except Exception as err:
        return f"Erro ao buscar transações: {err}"


def prever_receita_mes_seguinte(**kwargs) -> str:
    """Realiza uma previsão de faturamento para o próximo mês via regressão linear."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Dados insuficientes para realizar a previsão."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        if not col_data:
            return "Coluna de data não identificada no histórico de dados."

        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df["mes_ano"] = df[col_data].dt.to_period("M")

        mensal = (
            df.groupby("mes_ano")
            .apply(lambda g: calcular_total_dinamico(g, "faturamento", mapeamento, COL_FATURAMENTO))
            .reset_index(name="faturamento")
        )

        if len(mensal) < 2:
            return "Mínimo de 2 meses de dados históricos necessários para gerar uma previsão confiável."

        y = mensal["faturamento"].values
        x = np.arange(len(y))
        coef = np.polyfit(x, y, 1)
        poly = np.poly1d(coef)
        previsao = poly(len(y))
        tendencia = "crescimento" if coef[0] > 0 else "queda"

        return (
            f"Previsão Matemática para o próximo mês: R$ {previsao:,.2f}.\n"
            f"Tendência identificada: {tendencia}."
        )
    except Exception as err:
        return f"Erro na previsão de receita: {err}"


def detectar_anomalias_despesas(**kwargs) -> str:
    """Verifica picos atípicos de despesas no histórico recente."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Nenhum dado para analisar anomalias."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)
        col_data = mapeamento.get("data") or encontrar_coluna_data(df)

        if not col_data:
            return "Coluna de data não identificada."

        df = converter_datas(df, col_data).dropna(subset=[col_data])
        df["mes_ano"] = df[col_data].dt.to_period("M")

        mensal = (
            df.groupby("mes_ano")
            .apply(lambda g: calcular_total_dinamico(g, "despesa", mapeamento, COL_DESPESA))
            .reset_index(name="despesa")
        )

        if len(mensal) < 2:
            return "Histórico insuficiente para cálculo de anomalias."

        media_historica = mensal["despesa"][:-1].mean()
        ultimo_mes = mensal["despesa"].iloc[-1]

        if media_historica > 0 and ultimo_mes > (media_historica * 1.3):
            percentual = ((ultimo_mes / media_historica) - 1) * 100
            return (
                f"⚠️ ANOMALIA DETECTADA: As despesas do último mês (R$ {ultimo_mes:,.2f}) estão "
                f"{percentual:.1f}% acima da média histórica (R$ {media_historica:,.2f})."
            )

        return (
            f"As despesas recentes (R$ {ultimo_mes:,.2f}) mantêm-se dentro do padrão normal "
            f"(Média histórica: R$ {media_historica:,.2f})."
        )
    except Exception as err:
        return f"Erro na análise de anomalias: {err}"


def calcular_ponto_equilibrio(**kwargs) -> str:
    """Calcula a estimativa de ponto de equilíbrio (Break-even Point)."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return "Usuário não autenticado."

    try:
        documento = dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])
        if not documento or not documento.get("dados"):
            return "Dados inexistentes."

        df = pd.DataFrame(documento["dados"])
        mapeamento = obter_colunas_mapeadas(usuario_id)

        fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
        desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)

        if fat_total <= 0:
            return "Faturamento nulo ou insuficiente para cálculo do ponto de equilíbrio."

        lucro = fat_total - desp_total
        margem = lucro / fat_total

        if margem <= 0:
            return (
                "A margem de lucro histórica é negativa/nula. "
                "O ponto de equilíbrio é inatingível na estrutura atual."
            )

        pe = desp_total / margem
        return (
            f"Ponto de Equilíbrio Estimado: É necessário faturar ~R$ {pe:,.2f} "
            f"para cobrir os custos totais (Margem histórica: {margem * 100:.1f}%)."
        )
    except Exception as err:
        return f"Erro no cálculo do Ponto de Equilíbrio: {err}"


# ==============================================================================
# GERAÇÃO E EXPORTAÇÃO DE RELATÓRIOS
# ==============================================================================

def gerar_arquivo_download(tipo: str = "pdf", periodo: str = "30_dias", **kwargs) -> str:
    """Gera metadados e links dinâmicos para download de relatórios (PDF, CSV, Excel)."""
    tipo = str(kwargs.get("tipo", tipo)).lower()
    periodo = str(kwargs.get("periodo", periodo))

    if tipo == "pdf":
        try:
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

            session["relatorio_dados"] = {
                "nome": "Relatório Gerado por IA",
                "periodo": periodo.replace("_", " ").title(),
                "data": datetime.now().strftime("%d/%m/%Y"),
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
    """Endpoint que efetivamente envia o arquivo (CSV/Excel) ao cliente."""
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


# ==============================================================================
# RAG — RETRIEVAL DOS DADOS DO BANCO (MongoDB)
# ==============================================================================

_STOPWORDS_PT = {
    "a", "o", "os", "as", "um", "uma", "de", "da", "do", "das", "dos", "e", "em",
    "no", "na", "nos", "nas", "por", "para", "com", "sem", "que", "qual", "quais",
    "meu", "minha", "meus", "minhas", "seu", "sua", "sobre", "como", "é", "seria",
    "tem", "ter", "foi", "ser", "está", "estão", "isso", "este", "esta", "esse",
    "essa", "ao", "à", "às", "ou", "mais", "menos", "muito",
}


def _detectar_periodo_pergunta(texto: str) -> str:
    t = (texto or "").lower()
    if re.search(r"\b(todos?|tudo|geral|completo|consolidado|total|lista|listagem|dados\s+gerais|dados\s+completos)\b", t):
        return "todos"
    if re.search(r"\b(7\s*dias|semana|ultimos?\s*7|últimos?\s*7)\b", t):
        return "7_dias"
    if re.search(r"\b(90\s*dias|trimestre|3\s*meses|ultimos?\s*90|últimos?\s*90)\b", t):
        return "90_dias"
    if re.search(r"\b(ano\s*atual|este\s*ano|anual|no\s*ano|do\s*ano)\b", t) or re.search(r"\bano\b", t):
        return "ano_atual"
    return "30_dias"


def _tokens_busca(texto: str) -> set:
    tokens = set(re.findall(r"[a-zA-ZÀ-ÿ0-9_]+", (texto or "").lower()))
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS_PT}


def _carregar_documento_dados(usuario_id: str) -> Optional[Dict[str, Any]]:
    if not usuario_id:
        return None
    return dados_colecao.find_one({"usuario_id": usuario_id}, sort=[("criado_em", -1)])


def _resumo_kpis_do_df(df: pd.DataFrame, mapeamento: Dict[str, Any], periodo: str) -> str:
    if df.empty:
        return "Sem registros para o período."

    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    trabalho = df.copy()
    if col_data and col_data in trabalho.columns:
        trabalho = converter_datas(trabalho, col_data)
        trabalho = filtrar_df(trabalho, col_data, periodo)

    if trabalho.empty:
        return f"Nenhum registro encontrado no período {periodo}."

    fat = calcular_total_dinamico(trabalho, "faturamento", mapeamento, COL_FATURAMENTO)
    desp = calcular_total_dinamico(trabalho, "despesa", mapeamento, COL_DESPESA)
    luc = calcular_total_dinamico(trabalho, "lucro", mapeamento, COL_LUCRO) or (fat - desp)
    margem = (luc / fat * 100) if fat else 0.0

    return (
        f"Período: {periodo}\n"
        f"Registros: {len(trabalho)}\n"
        f"Faturamento: R$ {fat:,.2f}\n"
        f"Despesas: R$ {desp:,.2f}\n"
        f"Lucro: R$ {luc:,.2f}\n"
        f"Margem: {margem:.1f}%"
    )


def _chunk_serie_mensal(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    if not col_data or col_data not in df.columns:
        return None

    trabalho = converter_datas(df.copy(), col_data).dropna(subset=[col_data])
    if trabalho.empty:
        return None

    trabalho["mes_ano"] = trabalho[col_data].dt.to_period("M").astype(str)
    linhas = []
    for mes, grupo in trabalho.groupby("mes_ano"):
        fat = calcular_total_dinamico(grupo, "faturamento", mapeamento, COL_FATURAMENTO)
        desp = calcular_total_dinamico(grupo, "despesa", mapeamento, COL_DESPESA)
        luc = calcular_total_dinamico(grupo, "lucro", mapeamento, COL_LUCRO) or (fat - desp)
        linhas.append(f"- {mes}: fat R$ {fat:,.2f} | desp R$ {desp:,.2f} | lucro R$ {luc:,.2f}")

    if not linhas:
        return None
    return "Série mensal (faturamento/despesa/lucro):\n" + "\n".join(linhas[-12:])


def _chunk_categorias(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    col_cat = mapeamento.get("categoria")
    if not col_cat or col_cat not in df.columns:
        col_cat = next(
            (c for c in df.columns if any(a.lower() == c.lower() for a in COL_CATEGORIA)),
            None,
        )
    if not col_cat:
        return None

    col_valor = mapeamento.get("despesa") or mapeamento.get("faturamento")
    if not col_valor or col_valor not in df.columns:
        for aliases in (COL_DESPESA, COL_FATURAMENTO):
            col_valor = next(
                (c for c in df.columns if any(a.lower() == c.lower() for a in aliases)),
                None,
            )
            if col_valor:
                break
    if not col_valor:
        return None

    tmp = df[[col_cat, col_valor]].copy()
    tmp[col_valor] = pd.to_numeric(tmp[col_valor], errors="coerce").fillna(0)
    ranking = tmp.groupby(col_cat)[col_valor].sum().sort_values(ascending=False).head(8)
    if ranking.empty:
        return None

    linhas = [f"- {idx}: R$ {val:,.2f}" for idx, val in ranking.items()]
    return f"Ranking por categoria ({col_cat} x {col_valor}):\n" + "\n".join(linhas)


def _chunk_registros_recentes(df: pd.DataFrame, limite: int = 12) -> Optional[str]:
    if df.empty:
        return None
    amostra = df.tail(limite)
    cols = list(amostra.columns[:10])
    texto = amostra[cols].to_string(index=False, max_cols=10)
    return f"Últimos {len(amostra)} registros do banco:\n{texto}"


def _chunk_dados_completos(df: pd.DataFrame, mapeamento: Dict[str, Any]) -> Optional[str]:
    if df is None or df.empty:
        return None

    linhas = []
    linhas.append(f"Total de registros: {len(df)}")
    linhas.append(f"Colunas: {', '.join(map(str, df.columns.tolist()))}")

    col_data = mapeamento.get("data") or encontrar_coluna_data(df)
    if col_data and col_data in df.columns:
        df_data = converter_datas(df.copy(), col_data)
        inicio = df_data[col_data].min()
        fim = df_data[col_data].max()
        if pd.notnull(inicio) and pd.notnull(fim):
            linhas.append(f"Período coberto: {inicio.strftime('%d/%m/%Y')} a {fim.strftime('%d/%m/%Y')}")

    produto_col = encontrar_coluna_produto(df, mapeamento)
    categoria_col = encontrar_coluna_categoria(df, mapeamento)
    if produto_col:
        linhas.append(f"Coluna de produto detectada: {produto_col}")
        produtos = df[produto_col].dropna().astype(str).str.strip()
        produtos = produtos[produtos != ''].head(10).unique().tolist()
        if produtos:
            linhas.append(f"Exemplos de produtos: {', '.join(produtos)}")
    elif categoria_col:
        linhas.append(f"Coluna de categoria detectada: {categoria_col}")

    fat_total = calcular_total_dinamico(df, "faturamento", mapeamento, COL_FATURAMENTO)
    desp_total = calcular_total_dinamico(df, "despesa", mapeamento, COL_DESPESA)
    luc_total = calcular_total_dinamico(df, "lucro", mapeamento, COL_LUCRO) or (fat_total - desp_total)
    linhas.append(f"Faturamento total: R$ {fat_total:,.2f}")
    linhas.append(f"Despesa total: R$ {desp_total:,.2f}")
    linhas.append(f"Lucro total: R$ {luc_total:,.2f}")

    return "Dados gerais do conjunto completo de dados:\n" + "\n".join(linhas)


def construir_chunks_rag(usuario_id: str, pergunta: str) -> List[Dict[str, Any]]:
    """Monta documentos/chunks recuperáveis a partir dos dados do usuário no MongoDB."""
    documento = _carregar_documento_dados(usuario_id)
    if not documento or not documento.get("dados"):
        return [{
            "id": "sem_dados",
            "titulo": "Disponibilidade de dados",
            "conteudo": "Nenhum dataset financeiro encontrado no banco para este usuário.",
            "obrigatorio": True,
            "tags": {"dados", "banco", "vazio"},
        }]

    df = pd.DataFrame(documento["dados"])
    mapeamento = obter_colunas_mapeadas(usuario_id) or {}
    periodo = _detectar_periodo_pergunta(pergunta)
    chunks: List[Dict[str, Any]] = []

    meta = (
        f"Fonte: MongoDB (coleção dados)\n"
        f"Planilha: {documento.get('nome_planilha', 'não informado')}\n"
        f"Atualizado em: {documento.get('atualizado_em') or documento.get('criado_em')}\n"
        f"Total de registros: {len(df)}\n"
        f"Colunas: {', '.join(map(str, df.columns.tolist()))}\n"
        f"Mapeamento: {json.dumps(mapeamento, ensure_ascii=False, default=str) if mapeamento else 'não definido'}"
    )
    chunks.append({
        "id": "metadados",
        "titulo": "Metadados do dataset",
        "conteudo": meta,
        "obrigatorio": True,
        "tags": {"planilha", "colunas", "metadados", "dataset", "banco"},
    })

    dados_completos = _chunk_dados_completos(df, mapeamento)
    if dados_completos:
        chunks.append({
            "id": "dados_completos",
            "titulo": "Dados gerais do usuário",
            "conteudo": dados_completos,
            "obrigatorio": False,
            "tags": {"dados", "completo", "geral", "total", "produtos", "consolidado"},
        })

    chunks.append({
        "id": "kpis",
        "titulo": f"KPIs financeiros ({periodo})",
        "conteudo": _resumo_kpis_do_df(df, mapeamento, periodo),
        "obrigatorio": True,
        "tags": {
            "faturamento", "receita", "vendas", "despesa", "despesas", "gastos",
            "lucro", "margem", "kpi", "resumo", "financeiro", "performance",
        },
    })

    for p_extra in ("7_dias", "30_dias", "90_dias", "ano_atual"):
        if p_extra == periodo:
            continue
        chunks.append({
            "id": f"kpis_{p_extra}",
            "titulo": f"KPIs financeiros ({p_extra})",
            "conteudo": _resumo_kpis_do_df(df, mapeamento, p_extra),
            "obrigatorio": False,
            "tags": {"comparar", "comparação", "periodo", "histórico", "tendencia"},
        })

    serie = _chunk_serie_mensal(df, mapeamento)
    if serie:
        chunks.append({
            "id": "serie_mensal",
            "titulo": "Evolução mensal",
            "conteudo": serie,
            "obrigatorio": False,
            "tags": {"mensal", "evolução", "tendencia", "histórico", "mês", "mes", "série", "serie"},
        })

    cats = _chunk_categorias(df, mapeamento)
    if cats:
        chunks.append({
            "id": "categorias",
            "titulo": "Distribuição por categoria",
            "conteudo": cats,
            "obrigatorio": False,
            "tags": {"categoria", "categorias", "grupo", "tipo", "setor", "ranking"},
        })

    recentes = _chunk_registros_recentes(df)
    if recentes:
        chunks.append({
            "id": "registros",
            "titulo": "Registros recentes",
            "conteudo": recentes,
            "obrigatorio": False,
            "tags": {"transação", "transacoes", "registro", "lançamento", "detalhe", "linha", "tabela"},
        })

    chunks.append({
        "id": "anomalias",
        "titulo": "Análise de anomalias de despesas",
        "conteudo": detectar_anomalias_despesas(),
        "obrigatorio": False,
        "tags": {"anomalia", "alerta", "pico", "atípico", "despesa", "risco"},
    })
    chunks.append({
        "id": "previsao",
        "titulo": "Previsão de receita",
        "conteudo": prever_receita_mes_seguinte(),
        "obrigatorio": False,
        "tags": {"previsão", "previsao", "próximo", "proximo", "forecast", "projecao", "projeção"},
    })
    chunks.append({
        "id": "equilibrio",
        "titulo": "Ponto de equilíbrio",
        "conteudo": calcular_ponto_equilibrio(),
        "obrigatorio": False,
        "tags": {"equilibrio", "equilíbrio", "breakeven", "ponto", "custos"},
    })

    return chunks


def ranquear_chunks_rag(chunks: List[Dict[str, Any]], pergunta: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Seleciona os chunks mais relevantes para a pergunta."""
    tokens = _tokens_busca(pergunta)
    ranqueados: List[Tuple[float, Dict[str, Any]]] = []

    for chunk in chunks:
        score = 1000.0 if chunk.get("obrigatorio") else 0.0
        blob = f"{chunk.get('titulo', '')} {chunk.get('conteudo', '')}".lower()
        tags = {str(t).lower() for t in chunk.get("tags", set())}

        for tok in tokens:
            if tok in tags:
                score += 4.0
            if tok in blob:
                score += 1.5
            if any(tok in tag for tag in tags):
                score += 1.0

        ranqueados.append((score, chunk))

    ranqueados.sort(key=lambda x: x[0], reverse=True)

    selecionados: List[Dict[str, Any]] = []
    vistos = set()
    for score, chunk in ranqueados:
        if chunk["id"] in vistos:
            continue
        if score <= 0 and not chunk.get("obrigatorio"):
            continue
        selecionados.append(chunk)
        vistos.add(chunk["id"])
        if len(selecionados) >= top_k:
            break

    if not selecionados:
        selecionados = [c for c in chunks if c.get("obrigatorio")][:2]

    return selecionados


def montar_contexto_rag(usuario_id: str, pergunta: str, top_k: int = 5) -> str:
    """Pipeline RAG: busca no banco → chunking → ranking → contexto textual.

    Limita o tamanho de cada chunk e do contexto final para evitar prompts excessivamente grandes
    que possam causar falhas no orquestrador de modelo. Retorna string já truncada.
    """
    if not usuario_id:
        return "Usuário não autenticado — sem acesso aos dados do banco."

    chunks = construir_chunks_rag(usuario_id, pergunta)
    relevantes = ranquear_chunks_rag(chunks, pergunta, top_k=top_k)
    fontes = [c["id"] for c in relevantes]
    print(f"[RAG] usuario={usuario_id} fontes={fontes}")

    def _truncate(text: Optional[str], max_chars: int = 1200) -> str:
        if not text:
            return ''
        t = str(text)
        if len(t) <= max_chars:
            return t
        # try to cut at a line boundary for readability
        cut = t[:max_chars]
        if '\n' in cut:
            return cut.rsplit('\n', 1)[0] + '\n...[truncado]'
        return cut + '\n...[truncado]'

    blocos = [f"[Fonte {i}: {chunk['titulo']}]\n{_truncate(chunk.get('conteudo'))}" for i, chunk in enumerate(relevantes, start=1)]
    contexto_final = "\n\n".join(blocos) if blocos else "Sem contexto recuperado do banco."

    # cap do contexto total para evitar prompts enormes
    if len(contexto_final) > 8000:
        contexto_final = contexto_final[:8000] + "\n...[contexto cortado]"

    return contexto_final


def montar_prompt_com_rag(mensagem_usuario: str, contexto_rag: str, historico_chat: str = "") -> str:
    historico_bloco = ""
    if historico_chat:
        historico_bloco = f"\nHistórico recente da conversa:\n{historico_chat}\n"

    return (
        "Você é o assistente financeiro DataInsight.\n"
        "Use PRIORITARIAMENTE o contexto recuperado do banco de dados do usuário (RAG).\n"
        "Se o contexto não tiver a informação, diga claramente que não encontrou nos dados.\n"
        "Responda em português, de forma objetiva, com números quando disponíveis.\n"
        "Não invente valores que não estejam no contexto.\n\n"
        f"=== CONTEXTO RAG (dados do MongoDB) ===\n{contexto_rag}\n"
        f"=== FIM DO CONTEXTO ===\n"
        f"{historico_bloco}"
        f"Pergunta do usuário: {mensagem_usuario}"
    )


# ==============================================================================
# ORQUESTRAÇÃO, HISTÓRICO E ROTAS CHATBOT
# ==============================================================================

def gerar_resposta_fallback(usuario_id: Optional[str], pergunta: str, contexto_rag: str) -> str:
    """Gerador de resposta local quando o orquestrador externo falhar.

    Usa dados já disponíveis no banco para gerar um texto mais rico com KPIs,
    série mensal, categorias principais e detecção de anomalias.
    """
    try:
        if not contexto_rag or contexto_rag.startswith("Usuário não autenticado"):
            return (
                "Desculpe — não há dados suficientes para responder com detalhes. "
                "Verifique se você carregou seus dados e tente novamente."
            )

        documento = _carregar_documento_dados(usuario_id) if usuario_id else None
        df = pd.DataFrame(documento["dados"]) if documento and documento.get("dados") else None
        mapeamento = obter_colunas_mapeadas(usuario_id) if usuario_id else {}
        periodo = _detectar_periodo_pergunta(pergunta)

        kpis_text = _resumo_kpis_do_df(df, mapeamento, periodo) if df is not None else None
        serie_text = _chunk_serie_mensal(df, mapeamento) if df is not None else None
        categorias_text = _chunk_categorias(df, mapeamento) if df is not None else None
        anomalia_text = detectar_anomalias_despesas() if df is not None else None

        linhas = [
            "Resposta automática (fallback):",
            "",
            "Resumo dos dados:",
            kpis_text or "Dados insuficientes para calcular KPIs.",
        ]

        if serie_text:
            linhas.extend(["", "Tendência mensal:", serie_text])

        if categorias_text:
            linhas.extend(["", "Categorias principais:", categorias_text])

        if anomalia_text:
            linhas.extend(["", "Análise de anomalias:", anomalia_text])

        linhas.extend([
            "",
            "Recomendação:",
            "Use os dados acima para verificar tendências e ajustar decisões. "
            "Se quiser mais detalhes, carregue mais dados ou verifique o mapeamento de colunas.",
            "",
            f"Pergunta original: {pergunta}",
        ])

        resposta = "\n".join(linhas)
        return resposta
    except Exception:
        print(traceback.format_exc())
        return "Desculpe — não foi possível gerar uma resposta local no momento."


def obter_time_agentes() -> GeminiOrchestrator:
    """Instancia o orquestrador configurado com o Gemini."""
    return GeminiOrchestrator()


def salvar_mensagem_historico(usuario_id: str, remetente: str, mensagem: str, sessao_id: str) -> None:
    """Registra uma interação no histórico de conversas no MongoDB."""
    try:
        chat_historico.insert_one({
            "usuario_id": usuario_id,
            "sessao_id": sessao_id,
            "remetente": remetente,
            "mensagem": mensagem,
            "data": datetime.now(),
        })
    except Exception as err:
        print(f"[Erro Historico DB]: {err}")


def buscar_sessoes_chatbot():
    """Retorna as sessões de chat salvas do usuário logado."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    pipeline = [
        {"$match": {"usuario_id": usuario_id}},
        {"$sort": {"data": 1}},
        {"$group": {
            "_id": "$sessao_id",
            "primeira_mensagem": {"$first": "$mensagem"},
            "data_criacao": {"$first": "$data"},
        }},
        {"$sort": {"data_criacao": -1}},
    ]

    sessoes = list(chat_historico.aggregate(pipeline))
    resultado = []

    for s in sessoes:
        msg = s.get("primeira_mensagem", "")
        titulo = (msg[:30] + "...") if len(msg) > 30 else msg
        if "Olá! Sou seu Time" in titulo:
            titulo = "Conversa Padrão"

        resultado.append({
            "sessao_id": s["_id"],
            "titulo": titulo,
        })

    return jsonify({"sessoes": resultado})


def buscar_historico_chatbot():
    """Recupera as mensagens de uma sessão específica."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    sessao_id = request.args.get("sessao_id")
    query = {"usuario_id": usuario_id}
    if sessao_id:
        query["sessao_id"] = sessao_id

    docs = chat_historico.find(query).sort("data", 1)
    historico = [
        {
            "remetente": doc["remetente"],
            "mensagem": doc["mensagem"],
            "data": doc["data"].strftime("%d/%m %H:%M"),
        }
        for doc in docs
    ]
    return jsonify({"historico": historico})


def buscar_ultima_resposta_chatbot():
    """Retorna a última resposta gerada pelo chatbot para o usuário logado."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    doc = chat_historico.find({"usuario_id": usuario_id, "remetente": "bot"}).sort("data", -1).limit(1)
    ultima = None
    for item in doc:
        ultima = item
        break

    if not ultima:
        return jsonify({"resposta": "Ainda não há resposta da IA registrada."}), 200

    return jsonify({
        "resposta": ultima.get("mensagem", ""),
        "sessao_id": ultima.get("sessao_id"),
        "data": ultima.get("data").strftime("%d/%m %H:%M") if ultima.get("data") else None,
    })


def limpar_historico_chatbot():
    """Exclui mensagens do histórico (de uma sessão ou de todas)."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"erro": "Não autorizado"}), 401

    try:
        sessao_id = request.args.get("sessao_id")
        filtros = {"usuario_id": usuario_id}
        if sessao_id:
            filtros["sessao_id"] = sessao_id

        chat_historico.delete_many(filtros)
        return jsonify({"success": True})
    except Exception as err:
        return jsonify({"erro": str(err)}), 500


def perguntar_chatbot():
    """Endpoint principal para processar perguntas no Chatbot (com RAG)."""
    try:
        dados = request.get_json(silent=True)
        if dados is None:
            try:
                raw = request.data.decode('utf-8', errors='ignore')
                dados = json.loads(raw) if raw else {}
            except Exception:
                dados = {}

        mensagem_usuario = (dados.get("mensagem") or "").strip()
        sessao_id = str(dados.get("sessao_id", "default") or "default")
        usuario_id = session.get("usuario_id")

        if not mensagem_usuario:
            return jsonify({"erro": "Mensagem não fornecida"}), 400

        contexto_str = ""
        if usuario_id:
            ultimas = chat_historico.find(
                {"usuario_id": usuario_id, "sessao_id": sessao_id}
            ).sort("data", -1).limit(6)

            for m in reversed(list(ultimas)):
                papel = "Usuário" if m.get("remetente") == "user" else "Assistente"
                contexto_str += f"{papel}: {m.get('mensagem', '')}\n"

            salvar_mensagem_historico(usuario_id, "user", mensagem_usuario, sessao_id)

        # RAG: recupera dados relevantes do MongoDB e monta o prompt
        contexto_rag = montar_contexto_rag(usuario_id, mensagem_usuario, top_k=5)
        prompt_final = montar_prompt_com_rag(mensagem_usuario, contexto_rag, contexto_str)

        resposta_texto = None
        try:
            orquestrador = obter_time_agentes()
            resposta_obj = orquestrador.run(prompt_final)
            resposta_texto = getattr(resposta_obj, 'content', None)
            if not isinstance(resposta_texto, str):
                raise ValueError('Resposta do orquestrador inválida')

            if any(s in resposta_texto.lower() for s in [
                'integração com a api gemini não está configurada',
                'não consegui contatar a api gemini',
                'não foi possível',
                'sem dados suficientes',
                'não foi possível extrair',
                'erro',
            ]):
                print('[Chatbot] Orquestrador externo indicou falha — usando fallback local')
                resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)
        except Exception as e:
            print('[Erro Orquestrador]:', e)
            traceback.print_exc()
            resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)

        if resposta_texto is None:
            resposta_texto = gerar_resposta_fallback(usuario_id, mensagem_usuario, contexto_rag)

        if usuario_id:
            div_matches = re.finditer(r"<div\s+class=['\"]grafico-ia-render['\"]([^>]*)>", resposta_texto)
            for div in div_matches:
                attrs = div.group(1)
                p_match = re.search(r"data-periodo=['\"]([^'\"]+)['\"]", attrs)
                t_match = re.search(r"data-tipo=['\"]([^'\"]+)['\"]", attrs)
                tit_match = re.search(r"data-titulo=['\"]([^'\"]+)['\"]", attrs)
                m_match = re.search(r"data-metricas=['\"]([^'\"]+)['\"]", attrs)

                try:
                    galeria.insert_one({
                        "usuario_id": usuario_id,
                        "sessao_id": sessao_id,
                        "periodo": p_match.group(1) if p_match else "30_dias",
                        "tipo": t_match.group(1) if t_match else "linha",
                        "titulo": tit_match.group(1) if tit_match else "Gráfico Renderizado",
                        "metricas": m_match.group(1) if m_match else "faturamento,lucro",
                        "criado_em": datetime.now(),
                    })
                except Exception as err:
                    print(f"[Erro Galeria]: {err}")

            salvar_mensagem_historico(usuario_id, "bot", resposta_texto, sessao_id)

        resposta_voz = None
        try:
            resposta_voz = sintetizar_resposta_voz(resposta_texto)
        except Exception as err:
            print(f"[Erro TTS Chatbot]: {err}")
            traceback.print_exc()

        payload = {
            "resposta": resposta_texto,
            "resposta_voz": bool(resposta_voz),
            "rag": True,
        }

        if resposta_voz:
            b64, mimetype = resposta_voz
            payload["resposta_voz_base64"] = b64
            payload["resposta_voz_mimetype"] = mimetype

        response = jsonify(payload)
        response.status_code = 200
        return response

    except Exception as err:
        print(f"[Erro Chatbot Endpoint]: {err}")
        traceback.print_exc()
        return jsonify({
            "erro": "Desculpe, ocorreu um erro interno ao processar sua requisição.",
            "resposta": "Desculpe, ocorreu um erro interno ao processar sua requisição."
        }), 500


def gerar_insight_diario():
    """Gera bloco HTML formatado com 3 insights dinâmicos para a Dashboard."""
    try:
        periodo = request.args.get("periodo", "30_dias")
        usuario_id = session.get("usuario_id")
        orquestrador = obter_time_agentes()

        pergunta_rag = f"insights financeiros do período {periodo} com resumo alerta e estratégia"
        contexto_rag = montar_contexto_rag(usuario_id, pergunta_rag, top_k=4)

        prompt = (
            f"Com base EXCLUSIVAMENTE no contexto RAG abaixo, gere exatamente 3 bullet points "
            f"de insights diretos e curtos sobre os dados do período ({periodo}). "
            "Forneça um resumo geral, um alerta de despesas/anomalias e uma recomendação estratégica. "
            "Formate a resposta EXATAMENTE com 3 divs HTML, sem qualquer formatação em markdown (sem ``` ou *). "
            "Exemplo:\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Resumo:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Alerta:</strong> ...</p></div>\n"
            "<div class='p-3 rounded mb-2' style='background: var(--cartao);'><p class='p mb-0'><strong>Estratégia:</strong> ...</p></div>\n\n"
            f"=== CONTEXTO RAG ===\n{contexto_rag}\n=== FIM ==="
        )

        try:
            resposta = orquestrador.run(prompt)
            conteudo = resposta.content.strip()
            if isinstance(conteudo, str) and any(s in conteudo.lower() for s in [
                'não foi possível', 'desculpe', 'erro', 'não consegui contatar', 'não consegui',
                'sem dados suficientes', 'não foi possível extrair'
            ]):
                raise ValueError('Orquestrador externo retornou erro')

            conteudo = re.sub(r"^```(html)?", "", conteudo, flags=re.IGNORECASE)
            conteudo = re.sub(r"```$", "", conteudo).replace("*", "").strip()
            return jsonify({"html": conteudo})
        except Exception as err:
            print('[Erro Orquestrador Insight Diário]:', err)
            traceback.print_exc()

            documento = _carregar_documento_dados(usuario_id)
            df = pd.DataFrame(documento["dados"]) if documento and documento.get("dados") else None
            mapeamento = obter_colunas_mapeadas(usuario_id) if usuario_id else {}
            resumo = _resumo_kpis_do_df(df, mapeamento, periodo) if df is not None else 'Dados insuficientes.'
            anomalia = detectar_anomalias_despesas() if df is not None else 'Dados insuficientes.'
            categorias = _chunk_categorias(df, mapeamento) if df is not None else None

            top_cats = []
            if categorias:
                for line in categorias.splitlines():
                    if line.startswith('- '):
                        top_cats.append(line[2:])
                        if len(top_cats) >= 3:
                            break

            recomendacao = 'Considere revisar as categorias com maior custo e otimizar margens.'
            if top_cats:
                recomendacao = 'Principais categorias identificadas: ' + ', '.join(top_cats) + '.'

            resumo_html = resumo.replace("\n", " | ") if isinstance(resumo, str) else str(resumo)
            anomalia_html = anomalia.replace("\n", " | ") if isinstance(anomalia, str) else str(anomalia)

            fallback_html = (
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Resumo:</strong> "
                + resumo_html +
                "</p></div>"
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Alerta:</strong> "
                + anomalia_html +
                "</p></div>"
                "<div class='p-3 rounded mb-2' style='background: var(--cartao);'>"
                "<p class='p mb-0'><strong>Estratégia:</strong> "
                + recomendacao +
                "</p></div>"
            )
            return jsonify({"html": fallback_html})

    except Exception as err:
        print(f"[Erro Insight Diário]: {err}")
        fallback = (
            "<div class='p-3 rounded' style='background: var(--cartao);'>"
            "<p class='p mb-0'><strong>⚠️ Aviso:</strong> Não foi possível carregar os insights automáticos no momento.</p>"
            "</div>"
        )
        return jsonify({"html": fallback})
