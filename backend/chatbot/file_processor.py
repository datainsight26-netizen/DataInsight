import base64
import csv
import io
import json
import os
import re
import traceback
import xml.etree.ElementTree as ET
from typing import Any, Dict, Optional, Tuple

import pandas as pd


def formatar_tamanho_bytes(num_bytes: int) -> str:
    """Retorna tamanho legível (KB, MB)."""
    if not num_bytes:
        return "0 B"
    for unit in ["B", "KB", "MB", "GB"]:
        if abs(num_bytes) < 1024.0:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f} TB"


def extrair_texto_pdf(arquivo_bytes: bytes, max_paginas: int = 25, max_chars: int = 35000) -> Tuple[str, Dict[str, Any]]:
    """Extrai texto e metadados de PDF via pypdf."""
    info = {"paginas": 0, "chars": 0}
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(arquivo_bytes))
        info["paginas"] = len(reader.pages)

        textos = []
        chars_acumulados = 0
        for i, pagina in enumerate(reader.pages[:max_paginas]):
            txt = pagina.extract_text() or ""
            txt = txt.strip()
            if txt:
                textos.append(f"--- Página {i+1} ---\n{txt}")
                chars_acumulados += len(txt)
                if chars_acumulados >= max_chars:
                    textos.append(f"\n[... Texto truncado após {max_chars} caracteres para otimização de contexto ...]")
                    break

        conteudo = "\n\n".join(textos) if textos else "Nenhum texto pôde ser extraído deste PDF (pode conter imagens escaneadas)."
        info["chars"] = len(conteudo)
        return conteudo, info
    except Exception as e:
        return f"Erro ao ler PDF: {str(e)}", {"erro": str(e)}


def extrair_dados_excel(arquivo_bytes: bytes, max_linhas: int = 25) -> Tuple[str, Dict[str, Any]]:
    """Extrai abas, resumo e prévias tabulares de planilha Excel (.xlsx, .xls)."""
    info = {"abas": [], "total_linhas": 0}
    try:
        excel_file = pd.ExcelFile(io.BytesIO(arquivo_bytes))
        abas = excel_file.sheet_names
        info["abas"] = abas

        blocos = []
        blocos.append(f"Planilha Excel contendo {len(abas)} aba(s): {', '.join(abas)}")

        total_linhas = 0
        for aba in abas[:4]:  # Primeiras 4 abas
            df = excel_file.parse(sheet_name=aba)
            linhas, colunas = df.shape
            total_linhas += linhas
            blocos.append(f"\n### Aba: '{aba}' ({linhas} linhas × {colunas} colunas)")
            blocos.append(f"Colunas: {', '.join([str(c) for c in df.columns])}")

            # Tipos numéricos e estatísticas resumidas
            colunas_num = df.select_dtypes(include=['number']).columns.tolist()
            if colunas_num:
                stats_resumo = []
                for c in colunas_num[:5]:
                    soma = df[c].sum()
                    media = df[c].mean()
                    stats_resumo.append(f"- **{c}**: Total = {soma:,.2f} | Média = {media:,.2f}")
                blocos.append("Indicadores Rápidos:\n" + "\n".join(stats_resumo))

            # Prévia das primeiras linhas em Markdown
            preview_df = df.head(max_linhas).fillna("")
            try:
                tabela_md = preview_df.to_markdown(index=False)
                blocos.append(f"Amostra dos Dados (primeiras {len(preview_df)} linhas):\n{tabela_md}")
            except Exception:
                blocos.append(f"Amostra dos Dados:\n{preview_df.to_string(index=False)}")

        info["total_linhas"] = total_linhas
        return "\n\n".join(blocos), info
    except Exception as e:
        return f"Erro ao processar planilha Excel: {str(e)}", {"erro": str(e)}


def extrair_dados_csv(arquivo_bytes: bytes, max_linhas: int = 25) -> Tuple[str, Dict[str, Any]]:
    """Extrai informações e amostra de arquivo CSV com detecção de separador."""
    info = {"linhas": 0, "colunas": 0}
    try:
        try:
            texto = arquivo_bytes.decode('utf-8')
        except UnicodeDecodeError:
            texto = arquivo_bytes.decode('latin-1')

        delimitador = ','
        for sep in [';', ',', '\t', '|']:
            primeira_linha = texto.split('\n')[0] if '\n' in texto else texto
            if primeira_linha.count(sep) > 1:
                delimitador = sep
                break

        df = pd.read_csv(io.StringIO(texto), sep=delimitador)
        linhas, colunas = df.shape
        info["linhas"] = linhas
        info["colunas"] = colunas

        blocos = [
            f"Arquivo CSV com {linhas} linhas e {colunas} colunas (separador: '{delimitador}')",
            f"Colunas identificadas: {', '.join([str(c) for c in df.columns])}"
        ]

        colunas_num = df.select_dtypes(include=['number']).columns.tolist()
        if colunas_num:
            stats_resumo = []
            for c in colunas_num[:5]:
                soma = df[c].sum()
                media = df[c].mean()
                stats_resumo.append(f"- **{c}**: Soma = {soma:,.2f} | Média = {media:,.2f}")
            blocos.append("Indicadores Rápidos:\n" + "\n".join(stats_resumo))

        preview_df = df.head(max_linhas).fillna("")
        try:
            tabela_md = preview_df.to_markdown(index=False)
            blocos.append(f"Amostra dos Dados (primeiras {len(preview_df)} linhas):\n{tabela_md}")
        except Exception:
            blocos.append(f"Amostra dos Dados:\n{preview_df.to_string(index=False)}")

        return "\n\n".join(blocos), info
    except Exception as e:
        return f"Erro ao processar CSV: {str(e)}", {"erro": str(e)}


def extrair_dados_json(arquivo_bytes: bytes, max_chars: int = 30000) -> Tuple[str, Dict[str, Any]]:
    """Analisa e formata conteúdo de arquivo JSON."""
    info = {"tipo": "", "tamanho": 0}
    try:
        texto = arquivo_bytes.decode('utf-8', errors='replace')
        dados = json.loads(texto)
        if isinstance(dados, list):
            info["tipo"] = "lista"
            info["tamanho"] = len(dados)
            resumo = f"JSON do tipo Lista com {len(dados)} registro(s)."
        elif isinstance(dados, dict):
            info["tipo"] = "objeto"
            info["tamanho"] = len(dados.keys())
            resumo = f"JSON do tipo Objeto com {len(dados.keys())} chaves principais: {', '.join(list(dados.keys())[:20])}"
        else:
            resumo = "JSON com valor primitivo."

        formatado = json.dumps(dados, indent=2, ensure_ascii=False)
        if len(formatado) > max_chars:
            formatado = formatado[:max_chars] + f"\n\n[... Restante do JSON truncado ({len(formatado)} caracteres totais) ...]"

        return f"{resumo}\n\nEstrutura JSON:\n```json\n{formatado}\n```", info
    except Exception as e:
        return f"Erro ao ler JSON: {str(e)}", {"erro": str(e)}


def extrair_dados_xml(arquivo_bytes: bytes, max_chars: int = 25000) -> Tuple[str, Dict[str, Any]]:
    """Analisa e formata conteúdo de arquivo XML."""
    info = {"raiz": "", "filhos": 0}
    try:
        texto = arquivo_bytes.decode('utf-8', errors='replace')
        root = ET.fromstring(texto)
        info["raiz"] = root.tag
        info["filhos"] = len(root)

        resumo = f"Arquivo XML com elemento raiz <{root.tag}> e {len(root)} elementos filhos."
        if len(texto) > max_chars:
            texto = texto[:max_chars] + f"\n\n[... Restante do XML truncado ({len(texto)} caracteres totais) ...]"

        return f"{resumo}\n\nConteúdo XML:\n```xml\n{texto}\n```", info
    except Exception as e:
        return f"Erro ao ler XML: {str(e)}", {"erro": str(e)}


def extrair_dados_texto(arquivo_bytes: bytes, max_chars: int = 30000) -> Tuple[str, Dict[str, Any]]:
    """Lê arquivo de texto puro (.txt, .log, .md)."""
    try:
        try:
            texto = arquivo_bytes.decode('utf-8')
        except UnicodeDecodeError:
            texto = arquivo_bytes.decode('latin-1')

        total = len(texto)
        if total > max_chars:
            texto = texto[:max_chars] + f"\n\n[... Restante do texto truncado após {max_chars} caracteres ...]"

        return texto, {"chars": total}
    except Exception as e:
        return f"Erro ao ler texto: {str(e)}", {"erro": str(e)}


def extrair_info_imagem(arquivo_bytes: bytes, mime_type: str = "image/png") -> Tuple[str, Dict[str, Any]]:
    """Gera metadados de imagem via PIL se disponível."""
    info = {"mime_type": mime_type, "largura": None, "altura": None, "formato": None}
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(arquivo_bytes))
        info["largura"] = img.width
        info["altura"] = img.height
        info["formato"] = img.format
        detalhes = f"Imagem {img.format} ({img.width}x{img.height} pixels, modo {img.mode})."
    except Exception:
        detalhes = f"Arquivo de imagem ({mime_type})."

    descricao = (
        f"{detalhes} O modelo multimodal da IA analisará visualmente o conteúdo "
        "desta imagem (gráficos, tabelas, recibos, fotos, textos ou diagramas)."
    )
    return descricao, info


def processar_arquivo_anexo(arquivo_dict: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Processa o dicionário de anexo enviado pelo frontend.
    Espera: { 'nome': str, 'tipo': str, 'tamanho': int, 'base64': str }
    Retorna dicionário enriquecido com texto extraído, metadados e bytes decodificados.
    """
    if not arquivo_dict or not isinstance(arquivo_dict, dict):
        return None

    nome = (arquivo_dict.get("nome") or "arquivo").strip()
    tipo = (arquivo_dict.get("tipo") or "").lower().strip()
    b64_data = arquivo_dict.get("base64") or ""

    if not b64_data:
        return None

    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]

    try:
        arquivo_bytes = base64.b64decode(b64_data)
    except Exception as err:
        print(f"[file_processor] Falha ao decodificar base64 de {nome}: {err}")
        return None

    tamanho = len(arquivo_bytes)
    tamanho_fmt = formatar_tamanho_bytes(tamanho)

    ext = os.path.splitext(nome)[1].lower().lstrip(".")
    is_image = tipo.startswith("image/") or ext in ["png", "jpg", "jpeg", "webp", "gif", "bmp"]
    is_pdf = tipo == "application/pdf" or ext == "pdf"
    is_excel = ext in ["xlsx", "xls"] or "spreadsheetml" in tipo or "excel" in tipo
    is_csv = ext == "csv" or "csv" in tipo
    is_json = ext == "json" or "json" in tipo
    is_xml = ext == "xml" or "xml" in tipo
    is_txt = ext in ["txt", "log", "md", "csv", "sql", "py", "html"]

    conteudo_texto = ""
    meta_info = {}

    if is_image:
        conteudo_texto, meta_info = extrair_info_imagem(arquivo_bytes, tipo or f"image/{ext}")
    elif is_pdf:
        conteudo_texto, meta_info = extrair_texto_pdf(arquivo_bytes)
    elif is_excel:
        conteudo_texto, meta_info = extrair_dados_excel(arquivo_bytes)
    elif is_csv:
        conteudo_texto, meta_info = extrair_dados_csv(arquivo_bytes)
    elif is_json:
        conteudo_texto, meta_info = extrair_dados_json(arquivo_bytes)
    elif is_xml:
        conteudo_texto, meta_info = extrair_dados_xml(arquivo_bytes)
    elif is_txt:
        conteudo_texto, meta_info = extrair_dados_texto(arquivo_bytes)
    else:
        conteudo_texto, meta_info = extrair_dados_texto(arquivo_bytes)

    mime_type = tipo
    if not mime_type:
        if is_pdf:
            mime_type = "application/pdf"
        elif is_excel:
            mime_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif is_csv:
            mime_type = "text/csv"
        elif is_json:
            mime_type = "application/json"
        elif is_xml:
            mime_type = "application/xml"
        elif is_image:
            mime_type = f"image/{ext if ext != 'jpg' else 'jpeg'}"
        else:
            mime_type = "text/plain"

    return {
        "nome": nome,
        "extensao": ext,
        "tipo": mime_type,
        "tamanho": tamanho,
        "tamanho_fmt": tamanho_fmt,
        "is_image": is_image,
        "is_pdf": is_pdf,
        "bytes": arquivo_bytes,
        "base64": b64_data,
        "conteudo_texto": conteudo_texto,
        "metadados": meta_info,
    }


def formatar_bloco_prompt_anexo(anexo_processado: Dict[str, Any]) -> str:
    """Monta a seção estruturada em Markdown para injeção no prompt do Copiloto."""
    if not anexo_processado:
        return ""

    nome = anexo_processado.get("nome", "arquivo")
    tamanho_fmt = anexo_processado.get("tamanho_fmt", "")
    tipo = anexo_processado.get("tipo", "")
    conteudo = anexo_processado.get("conteudo_texto", "")

    bloco = [
        "==================================================",
        "[ARQUIVO ANEXADO PELO USUÁRIO PARA ANÁLISE]",
        f"- Nome do Arquivo: {nome}",
        f"- Formato / Tipo: {tipo}",
        f"- Tamanho: {tamanho_fmt}",
        "==================================================",
        "DADOS / CONTEÚDO EXTRAÍDO DO ARQUIVO:",
        conteudo,
        "==================================================",
        "INSTRUÇÃO DE RESPOSTA:",
        "O usuário enviou este arquivo e deseja uma análise detalhada. Responda à pergunta dele ou forneça uma análise executiva abrangente, "
        "destacando as principais conclusões, métricas-chave, tendências, eventuais anomalias e recomendações estratégicas.",
        "Se o usuário não tiver feito uma pergunta específica, elabore um diagnóstico estruturado com síntese, tabelas dos dados e plano de ação.",
        "==================================================",
    ]
    return "\n".join(bloco)
