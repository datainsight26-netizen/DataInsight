
from flask import request, jsonify, session, current_app
import os
import json
import pandas as pd
from backend.dados.dados import limpar_dados
from backend.db import salvar_dados


def upload_arquivo():
    if "file" not in request.files:
        return jsonify({"mensagem": "Nenhum arquivo enviado"}), 400

    arquivo = request.files["file"]

    if arquivo.filename == "":
        return jsonify({"mensagem": "Arquivo inválido"}), 400

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    caminho = os.path.join(upload_folder, arquivo.filename)
    arquivo.save(caminho)

    # Ler o arquivo e limpar os dados
    try:
        df = None
        
        if arquivo.filename.endswith(".csv"):
            df = pd.read_csv(caminho)
        elif arquivo.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(caminho)
        elif arquivo.filename.endswith(".json"):
            with open(caminho, 'r', encoding='utf-8') as f:
                dados_json = json.load(f)
            if isinstance(dados_json, list):
                df = pd.DataFrame(dados_json)
            else:
                df = pd.DataFrame([dados_json])
        elif arquivo.filename.endswith(".txt"):
            # Tenta ler como CSV/TSV
            try:
                df = pd.read_csv(caminho, sep='\t', engine='python')
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, sep=' ', engine='python')
                if len(df.columns) == 1:
                    df = pd.read_csv(caminho, engine='python')
            except:
                # Se falhar, trata como arquivo de texto puro
                with open(caminho, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                df = pd.DataFrame({'conteudo': [line.strip() for line in lines if line.strip()]})
        else:
            return jsonify({"mensagem": "Formato de arquivo não suportado. Use: CSV, XLSX, XLS, JSON ou TXT"}), 400

        if df is None or df.empty:
            return jsonify({"mensagem": "Arquivo vazio ou inválido"}), 400

        # Aplicar limpeza dos dados
        df = limpar_dados(df)

        # Converter para dicionário e retornar
        colunas = df.columns.tolist()
        dados = df.to_dict('records')

        # Salvar no banco de dados
        usuario_id = session.get('usuario_id')
        nome_planilha = arquivo.filename
        
        try:
            salvar_dados(usuario_id, nome_planilha, colunas, dados)
            print(f"✓ Arquivo '{arquivo.filename}' processado com sucesso - {len(dados)} linhas")
        except Exception as e:
            print(f"⚠ Aviso ao salvar no BD: {e}")

        return jsonify({
            "mensagem": "Arquivo enviado com sucesso!",
            "colunas": colunas,
            "dados": dados
        }), 200
    
    except Exception as e:
        print(f"✗ Erro ao processar arquivo: {e}")
        return jsonify({
            "mensagem": f"Erro ao processar arquivo: {str(e)}"
        }), 400