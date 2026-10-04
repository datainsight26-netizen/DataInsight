# ==============================================================================
# upload_arquivo.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import json
import os
import shutil
import uuid

import pandas as pd
from flask import current_app, jsonify, request, session
from werkzeug.utils import secure_filename

from backend.dados.dados import limpar_dados
from backend.db import salvar_dados


# ==============================================================================
# 2. ENDPOINT: UPLOAD E PROCESSAMENTO DE ARQUIVO
# ==============================================================================

def upload_arquivo():
    """
    Faz upload e processa arquivo com isolamento estrito por usuário/sessão (UPL-09).
    Cada arquivo é salvo em diretório temporário isolado por UUID e excluído
    imediatamente após a ingestão no banco de dados.
    """

    # --------------------------------------------------------------------------
    # 2.1 Autenticação e validação da requisição
    # --------------------------------------------------------------------------
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    if "file" not in request.files:
        return jsonify({"mensagem": "Nenhum arquivo enviado"}), 400

    arquivo = request.files["file"]

    if arquivo.filename == "":
        return jsonify({"mensagem": "Arquivo inválido"}), 400

    # --------------------------------------------------------------------------
    # 2.2 Sanitização do nome e preparo do diretório isolado (UPL-09)
    # --------------------------------------------------------------------------
    nome_seguro = secure_filename(arquivo.filename)
    if not nome_seguro:
        nome_seguro = (
            f"upload_{os.urandom(4).hex()}_"
            f"{arquivo.filename.split('.')[-1] if '.' in arquivo.filename else 'dat'}"
        )

    upload_base = current_app.config.get("UPLOAD_FOLDER", "uploads")
    token_isolamento = uuid.uuid4().hex
    pasta_isolada = os.path.join(upload_base, str(usuario_id), token_isolamento)
    os.makedirs(pasta_isolada, exist_ok=True)
    caminho = os.path.join(pasta_isolada, nome_seguro)

    try:
        arquivo.save(caminho)

        # Parâmetro opcional: qual aba importar (para Excel multi-abas)
        aba_selecionada = request.form.get("sheet_name", None)
        importar_todas = request.form.get("importar_todas", "false").lower() == "true"

        df = None

        # ----------------------------------------------------------------------
        # 2.3 Leitura por tipo de arquivo
        # ----------------------------------------------------------------------
        if arquivo.filename.endswith((".xlsx", ".xls")):
            # ─── Excel: detectar abas disponíveis ───────────────────────────
            xl = pd.ExcelFile(caminho)
            abas_disponiveis = xl.sheet_names

            if len(abas_disponiveis) > 1 and not aba_selecionada and not importar_todas:
                # Retorna a lista de abas para o front escolher
                return jsonify({
                    "multiplas_abas": True,
                    "abas": abas_disponiveis,
                    "mensagem": (
                        f"O arquivo possui {len(abas_disponiveis)} abas. "
                        "Selecione qual importar."
                    ),
                    "nome_arquivo": arquivo.filename,
                }), 200

            if importar_todas and len(abas_disponiveis) > 1:
                # Importa TODAS as abas e concatena em um único DataFrame
                frames = []
                for aba in abas_disponiveis:
                    df_aba = pd.read_excel(caminho, sheet_name=aba)
                    df_aba.columns = [str(col).strip() for col in df_aba.columns]
                    df_aba = df_aba.dropna(how="all")
                    df_aba["__aba__"] = aba  # adiciona coluna identificando a aba
                    frames.append(df_aba)
                df = pd.concat(frames, ignore_index=True)
            else:
                # Importa aba específica (ou única aba)
                sheet = aba_selecionada if aba_selecionada else abas_disponiveis[0]
                df = pd.read_excel(caminho, sheet_name=sheet)

        elif arquivo.filename.endswith(".csv"):
            df = pd.read_csv(caminho)

        elif arquivo.filename.endswith(".json"):
            with open(caminho, "r", encoding="utf-8") as f:
                dados_json = json.load(f)
            if isinstance(dados_json, list):
                df = pd.DataFrame(dados_json)
            else:
                df = pd.DataFrame([dados_json])

        elif arquivo.filename.endswith(".txt"):
            try:
                df = pd.read_csv(caminho, sep="\t", engine="python")
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, sep=" ", engine="python")
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, engine="python")
            except Exception:
                with open(caminho, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                df = pd.DataFrame({
                    "conteudo": [line.strip() for line in lines if line.strip()]
                })

        else:
            return jsonify({
                "mensagem": (
                    "Formato de arquivo não suportado. Use: CSV, XLSX, XLS, "
                    "JSON ou TXT"
                )
            }), 400

        if df is None or df.empty:
            return jsonify({"mensagem": "Arquivo vazio ou inválido"}), 400

        # ----------------------------------------------------------------------
        # 2.4 Limpeza e conversão para BSON
        # ----------------------------------------------------------------------
        df = limpar_dados(df)

        from backend.dados.dados import converter_para_tipos_nativos

        colunas = [str(c) for c in df.columns.tolist()]
        dados = converter_para_tipos_nativos(df.to_dict("records"))

        # ----------------------------------------------------------------------
        # 2.5 Persistência
        # ----------------------------------------------------------------------
        nome_planilha = arquivo.filename

        try:
            salvar_dados(usuario_id, nome_planilha, colunas, dados)
            print(
                f"✓ Arquivo '{arquivo.filename}' processado com sucesso - "
                f"{len(dados)} linhas"
            )

            # Extrair e salvar produtos no histórico de autocomplete
            try:
                from backend.dados.salvar_dados import extrair_e_salvar_produtos

                extrair_e_salvar_produtos(usuario_id, colunas, dados)
            except Exception as e:
                print(f"⚠ Aviso ao extrair produtos para autocomplete: {e}")
        except Exception as e:
            print(f"⚠ Aviso ao salvar no BD: {e}")

        return jsonify({
            "mensagem": "Arquivo enviado com sucesso!",
            "colunas": colunas,
            "dados": dados,
            "multiplas_abas": False,
        }), 200

    except Exception as e:
        print(f"✗ Erro ao processar arquivo: {e}")
        return jsonify({
            "mensagem": f"Erro ao processar arquivo: {str(e)}"
        }), 400

    finally:
        # Limpeza obrigatória de disco (UPL-09): nunca manter arquivos temporários residindo no servidor
        try:
            if os.path.exists(pasta_isolada):
                shutil.rmtree(pasta_isolada, ignore_errors=True)
        except Exception as ex_clean:
            print(f"⚠ Aviso ao limpar arquivo temporário em disco: {ex_clean}")


# ==============================================================================
# 3. ENDPOINT: LISTAR ABAS DE EXCEL (PREVIEW)
# ==============================================================================

def listar_abas_excel():
    """
    Endpoint auxiliar: recebe um arquivo Excel e retorna somente a lista de abas,
    sem importar os dados. Isolado por usuário com expurgo imediato do disco (UPL-09).
    """

    # --------------------------------------------------------------------------
    # 3.1 Autenticação e validação da requisição
    # --------------------------------------------------------------------------
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"mensagem": "Usuário não autenticado"}), 401

    if "file" not in request.files:
        return jsonify({"mensagem": "Nenhum arquivo enviado"}), 400

    arquivo = request.files["file"]
    if not arquivo.filename.endswith((".xlsx", ".xls")):
        return jsonify({
            "mensagem": (
                "Apenas arquivos Excel (.xlsx, .xls) suportam múltiplas abas"
            )
        }), 400

    # --------------------------------------------------------------------------
    # 3.2 Preparo do diretório isolado (UPL-09)
    # --------------------------------------------------------------------------
    upload_base = current_app.config.get("UPLOAD_FOLDER", "uploads")
    token_isolamento = uuid.uuid4().hex
    pasta_isolada = os.path.join(upload_base, str(usuario_id), token_isolamento)
    os.makedirs(pasta_isolada, exist_ok=True)

    nome_seguro = secure_filename(arquivo.filename) or "temp_excel.xlsx"
    caminho = os.path.join(pasta_isolada, nome_seguro)

    try:
        # ----------------------------------------------------------------------
        # 3.3 Leitura e resposta
        # ----------------------------------------------------------------------
        arquivo.save(caminho)
        xl = pd.ExcelFile(caminho)
        return jsonify({"abas": xl.sheet_names}), 200

    except Exception as e:
        return jsonify({"mensagem": f"Erro ao ler arquivo: {str(e)}"}), 400

    finally:
        # Expurgo garantido do disco
        try:
            if os.path.exists(pasta_isolada):
                shutil.rmtree(pasta_isolada, ignore_errors=True)
        except Exception as ex_clean:
            print(
                f"⚠ Aviso ao limpar arquivo temporário de preview: {ex_clean}"
            )