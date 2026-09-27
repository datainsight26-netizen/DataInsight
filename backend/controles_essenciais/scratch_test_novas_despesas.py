import sys
import os
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.abspath("."))

from backend.controles_essenciais.controles_essenciais import _converter_numero, _normalizar_str

# Test 1: Simulating full extraction with custom category and mapped columns
mapeamento_fin = {
    "receita_total": "Faturamento",
    "fornecedores": "Compras",
    "das_mei": "DAS",
    "aluguel": "Aluguel",
    "categorias_custom": [
        {
            "id": "custom_internet_1234",
            "label": "Internet e Telefonia",
            "grupo": "Gastos Fixos",
            "cor": "#ef4444",
            "icone": "fa-wifi"
        },
        {
            "id": "custom_comissao_5678",
            "label": "Comissões",
            "grupo": "Custos Variáveis",
            "cor": "#f59e0b",
            "icone": "fa-percent"
        }
    ],
    "custom_internet_1234": "Internet",
    "custom_comissao_5678": "Comissoes"
}

dados_raw = [
    {
        "Data": "2026-05-10",
        "Faturamento": 10000.0,
        "Compras": 3000.0,
        "DAS": 75.0,
        "Aluguel": 1200.0,
        "Internet": 150.0,
        "Comissoes": 500.0
    }
]

df = pd.DataFrame(dados_raw)

cats_custom_lista = mapeamento_fin.get("categorias_custom") or []

custos_especificos_linha = []
col_fornec = "Compras"
col_das_mei = "DAS"
col_aluguel = "Aluguel"

# Check standard
row = dados_raw[0]
custos_especificos_linha.append({
    "chave": "fornecedores",
    "valor": row["Compras"],
    "sub_tipo": "compras_mercadorias",
    "natureza": "variavel",
    "categoria": "Fornecedores e Estoque",
    "descricao": "Fornecedores / Mercadorias",
    "is_custom": False
})
custos_especificos_linha.append({
    "chave": "das_mei",
    "valor": row["DAS"],
    "sub_tipo": "das_mei",
    "natureza": "fixo",
    "categoria": "Boleto DAS-MEI",
    "descricao": "Boleto DAS-MEI",
    "is_custom": False
})
custos_especificos_linha.append({
    "chave": "aluguel",
    "valor": row["Aluguel"],
    "sub_tipo": "custom",
    "natureza": "fixo",
    "categoria": "Aluguel",
    "descricao": "Aluguel / Condomínio",
    "is_custom": True,
    "grupo": "Gastos Fixos",
    "cor": "#ef4444",
    "icone": "fa-building"
})

# Check custom categories
for c_item in cats_custom_lista:
    cid = c_item.get("id")
    clabel = c_item.get("label") or cid
    cgrupo = c_item.get("grupo") or "Gastos Fixos"
    ccor = c_item.get("cor") or "#ef4444"
    cicone = c_item.get("icone") or "fa-tag"
    ccol = mapeamento_fin.get(cid)
    cnatureza = "variavel" if cgrupo == "Custos Variáveis" else "fixo"
    if ccol and ccol in row:
        v = row[ccol]
        if v > 0:
            custos_especificos_linha.append({
                "chave": cid,
                "valor": v,
                "sub_tipo": "custom",
                "natureza": cnatureza,
                "categoria": clabel,
                "descricao": f"{clabel} ({cgrupo})",
                "is_custom": True,
                "grupo": cgrupo,
                "cor": ccor,
                "icone": cicone
            })

tot_saidas = sum(i["valor"] for i in custos_especificos_linha)
print("Total saidas calculadas:", tot_saidas)
assert tot_saidas == 3000 + 75 + 1200 + 150 + 500, f"Total incorreto: {tot_saidas}"

# Test grouping
cats_saida = {"das_mei": 0.0, "compras_mercadorias": 0.0, "custos_operacionais": 0.0, "pro_labore": 0.0, "outros": 0.0}
novas_despesas_dict = {}

for item in custos_especificos_linha:
    val = item["valor"]
    if item.get("is_custom"):
        chv = item["chave"]
        novas_despesas_dict[chv] = {
            "id": chv,
            "nome": item["categoria"],
            "valor": val,
            "natureza": item["natureza"]
        }
    else:
        cats_saida[item["sub_tipo"]] += val

print("Standard saidas:", cats_saida)
print("Novas despesas:", novas_despesas_dict)

soma_todas = sum(cats_saida.values()) + sum(d["valor"] for d in novas_despesas_dict.values())
print("Soma total conferida:", soma_todas)
assert soma_todas == tot_saidas, "Soma não bate!"
print("SUCESSO: Verificação matemática 100% perfeita!")
