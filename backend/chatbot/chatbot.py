# ==============================================================================
# chatbot.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme este arquivo.
# ==============================================================================

"""
Módulo principal do Chatbot reexportando funções e endpoints dos módulos
modulares presentes em backend.chatbot. O propósito é manter este arquivo como
entrypoint/organizador, enquanto toda lógica está separada em módulos menores
para facilitar manutenção.
"""

# ==============================================================================
# 1. CARREGAMENTO DE VARIÁVEIS DE AMBIENTE
# ==============================================================================

from dotenv import load_dotenv

load_dotenv()

# ==============================================================================
# 2. REEXPORTS — ORQUESTRADOR E TTS
# ==============================================================================
# Importa funções dos módulos modularizados para que código externo que faz
# `import backend.chatbot.chatbot` continue funcionando como antes.

from .orchestrator import obter_time_agentes
from .tts import _limpar_texto_para_voz, sintetizar_resposta_voz, sintetizar_texto_voz

# ==============================================================================
# 3. REEXPORTS — ANALYTICS
# ==============================================================================

from .analytics import (
    obter_resumo_financeiro,
    obter_transacoes_recentes,
    prever_receita_mes_seguinte,
    detectar_anomalias_despesas,
    calcular_ponto_equilibrio,
)

# ==============================================================================
# 4. REEXPORTS — EXPORTAÇÃO DE ARQUIVOS
# ==============================================================================

from .export import gerar_arquivo_download, exportar_dados_usuario

# ==============================================================================
# 5. REEXPORTS — RAG HELPERS
# ==============================================================================

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

# ==============================================================================
# 6. REEXPORTS — HISTÓRICO E INSIGHTS
# ==============================================================================

from .history import (
    salvar_mensagem_historico,
    buscar_sessoes_chatbot,
    buscar_historico_chatbot,
    buscar_ultima_resposta_chatbot,
    limpar_historico_chatbot,
    perguntar_chatbot,
    gerar_insight_diario,
)

# ==============================================================================
# 7. API PÚBLICA DO MÓDULO
# ==============================================================================

__all__ = [
    # Orquestrador e TTS
    "obter_time_agentes",
    "_limpar_texto_para_voz",
    "sintetizar_resposta_voz",
    "sintetizar_texto_voz",

    # Analytics
    "obter_resumo_financeiro",
    "obter_transacoes_recentes",
    "prever_receita_mes_seguinte",
    "detectar_anomalias_despesas",
    "calcular_ponto_equilibrio",

    # Exportação
    "gerar_arquivo_download",
    "exportar_dados_usuario",

    # RAG helpers
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

    # Histórico e insights
    "salvar_mensagem_historico",
    "buscar_sessoes_chatbot",
    "buscar_historico_chatbot",
    "buscar_ultima_resposta_chatbot",
    "limpar_historico_chatbot",
    "perguntar_chatbot",
    "gerar_insight_diario",
]