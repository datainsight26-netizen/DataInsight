
from flask import request, jsonify, session, current_app
import os
import json
import pandas as pd
from backend.dados.dados import limpar_dados
from backend.db import salvar_dados


def upload_arquivo():
    """
    Faz upload e processa arquivo. 
    Para Excel com múltiplas abas, retorna a lista de abas disponíveis
    e aguarda o usuário escolher qual importar via parâmetro sheet_name.
    """
    if "file" not in request.files:
        return jsonify({"mensagem": "Nenhum arquivo enviado"}), 400

    arquivo = request.files["file"]

    if arquivo.filename == "":
        return jsonify({"mensagem": "Arquivo inválido"}), 400

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    caminho = os.path.join(upload_folder, arquivo.filename)
    arquivo.save(caminho)

    # Parâmetro opcional: qual aba importar (para Excel multi-abas)
    aba_selecionada = request.form.get("sheet_name", None)
    importar_todas = request.form.get("importar_todas", "false").lower() == "true"

    try:
        df = None

        if arquivo.filename.endswith((".xlsx", ".xls")):
            # ─── Excel: detectar abas disponíveis ───────────────────────
            xl = pd.ExcelFile(caminho)
            abas_disponiveis = xl.sheet_names

            if len(abas_disponiveis) > 1 and not aba_selecionada and not importar_todas:
                # Retorna a lista de abas para o front escolher
                return jsonify({
                    "multiplas_abas": True,
                    "abas": abas_disponiveis,
                    "mensagem": f"O arquivo possui {len(abas_disponiveis)} abas. Selecione qual importar.",
                    "nome_arquivo": arquivo.filename
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
            with open(caminho, 'r', encoding='utf-8') as f:
                dados_json = json.load(f)
            if isinstance(dados_json, list):
                df = pd.DataFrame(dados_json)
            else:
                df = pd.DataFrame([dados_json])

        elif arquivo.filename.endswith(".txt"):
            try:
                df = pd.read_csv(caminho, sep='\t', engine='python')
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, sep=' ', engine='python')
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, engine='python')
            except Exception:
                with open(caminho, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                df = pd.DataFrame({'conteudo': [line.strip() for line in lines if line.strip()]})

        else:
            return jsonify({"mensagem": "Formato de arquivo não suportado. Use: CSV, XLSX, XLS, JSON ou TXT"}), 400

        if df is None or df.empty:
            return jsonify({"mensagem": "Arquivo vazio ou inválido"}), 400

        # Aplicar limpeza dos dados
        df = limpar_dados(df)

        colunas = df.columns.tolist()
        dados = df.to_dict('records')

        # Salvar no banco de dados
        usuario_id = session.get('usuario_id')
        nome_planilha = arquivo.filename

        try:
            salvar_dados(usuario_id, nome_planilha, colunas, dados)
            print(f"✓ Arquivo '{arquivo.filename}' processado com sucesso - {len(dados)} linhas")

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
            "multiplas_abas": False
        }), 200

    except Exception as e:
        print(f"✗ Erro ao processar arquivo: {e}")
        return jsonify({
            "mensagem": f"Erro ao processar arquivo: {str(e)}"
        }), 400


def listar_abas_excel():
    """
    Endpoint auxiliar: recebe um arquivo Excel e retorna somente a lista de abas,
    sem importar os dados. Útil para preview antes do upload completo.
    """
    if "file" not in request.files:
        return jsonify({"mensagem": "Nenhum arquivo enviado"}), 400

    arquivo = request.files["file"]
    if not arquivo.filename.endswith((".xlsx", ".xls")):
        return jsonify({"mensagem": "Apenas arquivos Excel (.xlsx, .xls) suportam múltiplas abas"}), 400

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    caminho = os.path.join(upload_folder, arquivo.filename)
    arquivo.save(caminho)

    try:
        xl = pd.ExcelFile(caminho)
        return jsonify({"abas": xl.sheet_names}), 200
    except Exception as e:
        return jsonify({"mensagem": f"Erro ao ler arquivo: {str(e)}"}), 400