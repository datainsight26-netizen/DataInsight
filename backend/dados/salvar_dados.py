from datetime import datetime
from urllib import request
from flask import request, jsonify, session
import pandas as pd
from backend.db import salvar_dados
from backend.dados.dados import limpar_dados


def salvar_dados_manuais():
    dados_json = request.get_json()
    
    if not dados_json or "colunas" not in dados_json or "dados" not in dados_json:
        return jsonify({"mensagem": "Dados inválidos"}), 400
    
    colunas = dados_json.get("colunas", [])
    dados = dados_json.get("dados", [])
    nome_planilha = dados_json.get("nome_planilha", f"Planilha_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    
    usuario_id = session.get('usuario_id')
    
    try:
        # Converter para DataFrame para aplicar limpeza
        df = pd.DataFrame(dados, columns=colunas)
        
        # Aplicar limpeza dos dados
        df = limpar_dados(df)
        
        # Extrair dados limpos
        colunas_limpas = df.columns.tolist()
        dados_limpos = df.to_dict('records')
        
        # Salvar no banco de dados
        id_salvo = salvar_dados(usuario_id, nome_planilha, colunas_limpas, dados_limpos)
        
        return jsonify({
            "mensagem": "Dados salvos com sucesso!",
            "id": str(id_salvo),
            "linhas_processadas": len(dados_limpos)
        }), 200
    except Exception as e:
        print(f"Erro ao salvar dados: {e}")
        return jsonify({"mensagem": "Erro ao salvar dados"}), 500