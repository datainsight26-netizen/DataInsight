"""
Módulo principal do Chatbot reexportando funções e endpoints dos módulos
modulares presentes em backend.chatbot. O propósito é manter este arquivo como
entrypoint/organizador, enquanto toda lógica está separada em módulos menores
para facilitar manutenção.
"""

from dotenv import load_dotenv

load_dotenv()

# Reexports: import functions from modularized files so external code that
# imports `backend.chatbot.chatbot` keeps working as before.
from .orchestrator import obter_time_agentes
from .tts import _limpar_texto_para_voz, sintetizar_resposta_voz, sintetizar_texto_voz
from .analytics import (
    obter_resumo_financeiro,
    obter_transacoes_recentes,
    prever_receita_mes_seguinte,
    detectar_anomalias_despesas,
    calcular_ponto_equilibrio,
)
from .export import gerar_arquivo_download, exportar_dados_usuario
from .rag_helpers import (
    _detectar_periodo_pergunta,
    _tokens_busca,
    _carregar_documento_dados,
    _resumo_kpis_do_df,
    _chunk_serie_mensal,
    _chunk_categorias,
    _chunk_registros_recentes,
    _chunk_dados_completos,
    construir_chunks_rag,
    ranquear_chunks_rag,
    montar_contexto_rag,
    montar_prompt_com_rag,
    gerar_resposta_fallback,
)
from .history import (
    salvar_mensagem_historico,
    buscar_sessoes_chatbot,
    buscar_historico_chatbot,
    buscar_ultima_resposta_chatbot,
    limpar_historico_chatbot,
    perguntar_chatbot,
    gerar_insight_diario,
)

__all__ = [
    "obter_time_agentes",
    "_limpar_texto_para_voz",
    "sintetizar_resposta_voz",
    "sintetizar_texto_voz",
    "obter_resumo_financeiro",
    "obter_transacoes_recentes",
    "prever_receita_mes_seguinte",
    "detectar_anomalias_despesas",
    "calcular_ponto_equilibrio",
    "gerar_arquivo_download",
    "exportar_dados_usuario",
    "_detectar_periodo_pergunta",
    "_tokens_busca",
    "_carregar_documento_dados",
    "_resumo_kpis_do_df",
    "_chunk_serie_mensal",
    "_chunk_categorias",
    "_chunk_registros_recentes",
    "_chunk_dados_completos",
    "construir_chunks_rag",
    "ranquear_chunks_rag",
    "montar_contexto_rag",
    "montar_prompt_com_rag",
    "gerar_resposta_fallback",
    "salvar_mensagem_historico",
    "buscar_sessoes_chatbot",
    "buscar_historico_chatbot",
    "buscar_ultima_resposta_chatbot",
    "limpar_historico_chatbot",
    "perguntar_chatbot",
    "gerar_insight_diario",
]
