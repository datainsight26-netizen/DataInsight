import re
import urllib.request
import json
from datetime import datetime

def validar_formato_cnpj(cnpj: str) -> bool:
    """Valida se o CNPJ possui 14 dígitos numéricos e cálculo de dígitos verificadores válido."""
    digitos = re.sub(r'\D', '', str(cnpj or ''))
    if len(digitos) != 14:
        return False
    # Elimina CNPJs com todos os dígitos iguais (ex: 00000000000000)
    if len(set(digitos)) == 1:
        return False

    # Validação do primeiro dígito verificador
    multiplicadores_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma_1 = sum(int(digitos[i]) * multiplicadores_1[i] for i in range(12))
    resto_1 = soma_1 % 11
    d1 = 0 if resto_1 < 2 else 11 - resto_1
    if int(digitos[12]) != d1:
        return False

    # Validação do segundo dígito verificador
    multiplicadores_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma_2 = sum(int(digitos[i]) * multiplicadores_2[i] for i in range(13))
    resto_2 = soma_2 % 11
    d2 = 0 if resto_2 < 2 else 11 - resto_2
    return int(digitos[13]) == d2

def formatar_cnpj(cnpj: str) -> str:
    """Formata 14 dígitos no padrão 00.000.000/0000-00"""
    d = re.sub(r'\D', '', str(cnpj or ''))
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    return d

def calcular_teto_anual_mei(data_abertura_str: str = None) -> dict:
    """
    Calcula o teto anual do MEI (R$ 81.000,00).
    Se o MEI foi aberto no ano corrente, o teto é proporcional:
    R$ 6.750,00 multiplicado pela quantidade de meses a partir da data de abertura até dezembro.
    """
    ano_atual = datetime.now().year
    teto_padrao = 81000.0
    mensalidade_teto = 6750.0

    if not data_abertura_str:
        return {
            "teto_anual": teto_padrao,
            "proporcional": False,
            "meses_ativos": 12,
            "limite_mensal_medio": mensalidade_teto
        }

    try:
        # Formatos comuns: 'YYYY-MM-DD' ou 'DD/MM/YYYY'
        dt = None
        if '-' in data_abertura_str:
            partes = data_abertura_str.split('-')
            if len(partes[0]) == 4:
                dt = datetime.strptime(data_abertura_str[:10], "%Y-%m-%d")
        elif '/' in data_abertura_str:
            dt = datetime.strptime(data_abertura_str[:10], "%d/%m/%Y")

        if dt and dt.year == ano_atual:
            # Aberto no ano corrente: meses restantes incluindo o mês de abertura
            meses_ativos = 12 - dt.month + 1
            teto_calculado = meses_ativos * mensalidade_teto
            return {
                "teto_anual": float(teto_calculado),
                "proporcional": True,
                "meses_ativos": meses_ativos,
                "limite_mensal_medio": mensalidade_teto,
                "mes_abertura": dt.month,
                "ano_abertura": dt.year
            }
    except Exception as e:
        print(f"[Aviso] Erro ao calcular teto proporcional do MEI: {e}")

    return {
        "teto_anual": teto_padrao,
        "proporcional": False,
        "meses_ativos": 12,
        "limite_mensal_medio": mensalidade_teto
    }

def consultar_cnpj_externo(cnpj: str) -> dict:
    """
    Consulta dados cadastrais oficiais do CNPJ via BrasilAPI pública gratuita.
    Retorna razão social, se é optante pelo MEI, porte da empresa, data de abertura e classificação.
    """
    digitos = re.sub(r'\D', '', str(cnpj or ''))
    if len(digitos) != 14:
        return {"sucesso": False, "mensagem": "CNPJ deve conter exatamente 14 dígitos."}

    cnpj_fmt = formatar_cnpj(digitos)
    url_brasilapi = f"https://brasilapi.com.br/api/cnpj/v1/{digitos}"

    try:
        req = urllib.request.Request(
            url_brasilapi,
            headers={
                "User-Agent": "DataInsight/2.0 (FinanceBI-Platform)",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                
                razao_social = data.get("razao_social") or data.get("nome_fantasia") or "Empresa Cadastrada"
                nome_fantasia = data.get("nome_fantasia") or razao_social
                
                # BrasilAPI retorna opcao_pelo_mei como boolean ou null
                opcao_pelo_mei = bool(data.get("opcao_pelo_mei", False))
                porte = str(data.get("porte", "")).strip().upper()
                
                # Se for optante pelo MEI ou tiver 'MEI' na descrição
                is_mei = opcao_pelo_mei or ("MEI" in porte)
                tipo_perfil = "MEI" if is_mei else "ME"
                
                data_abertura = data.get("data_inicio_atividade") or ""
                teto_info = calcular_teto_anual_mei(data_abertura) if is_mei else {"teto_anual": None}

                cnae_desc = data.get("cnae_fiscal_descricao") or ""
                # Identifica se é predominantemente Serviços ou Comércio
                cnae_tipo = "misto"
                cnae_lower = cnae_desc.lower()
                if any(w in cnae_lower for w in ["comercio", "varejista", "atacadista", "venda"]):
                    cnae_tipo = "comercio"
                elif any(w in cnae_lower for w in ["servico", "manutencao", "consultoria", "desenvolvimento", "reparo"]):
                    cnae_tipo = "servicos"

                return {
                    "sucesso": True,
                    "cnpj": cnpj_fmt,
                    "cnpj_limpo": digitos,
                    "razao_social": razao_social,
                    "nome_fantasia": nome_fantasia,
                    "tipo_perfil": tipo_perfil,
                    "is_mei": is_mei,
                    "opcao_pelo_mei": opcao_pelo_mei,
                    "porte": porte,
                    "situacao": data.get("descricao_situacao_cadastral", "ATIVA"),
                    "data_abertura": data_abertura,
                    "cnae_principal": cnae_desc,
                    "cnae_tipo": cnae_tipo,
                    "teto_info": teto_info,
                    "fonte": "Receita Federal via BrasilAPI"
                }

    except urllib.error.HTTPError as he:
        if he.code == 404:
            return {"sucesso": False, "mensagem": "CNPJ não encontrado na base da Receita Federal."}
        elif he.code == 429:
            return {"sucesso": False, "mensagem": "Muitas consultas ao CNPJ no momento. Tente novamente em alguns instantes."}
        else:
            return {"sucesso": False, "mensagem": f"Erro na consulta do CNPJ (HTTP {he.code})."}
    except Exception as e:
        print(f"[Aviso] Falha ao consultar BrasilAPI ({e}).")

    # Fallback caso a API externa esteja instável: valida formato localmente
    formato_valido = validar_formato_cnpj(digitos)
    if formato_valido:
        return {
            "sucesso": True,
            "cnpj": cnpj_fmt,
            "cnpj_limpo": digitos,
            "razao_social": "Empresa Cadastrada",
            "nome_fantasia": "Empresa",
            "tipo_perfil": "MEI",  # Sugestão padrão
            "is_mei": True,
            "opcao_pelo_mei": None,
            "porte": "MEI/ME",
            "situacao": "Verificação local de dígitos válida",
            "data_abertura": "",
            "cnae_principal": "",
            "cnae_tipo": "misto",
            "teto_info": calcular_teto_anual_mei(),
            "fonte": "Validação de Dígitos Verificadores"
        }

    return {"sucesso": False, "mensagem": "CNPJ com dígitos verificadores inválidos."}
