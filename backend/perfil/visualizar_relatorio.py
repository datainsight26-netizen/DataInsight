# ==============================================================================
# visualizar_relatorio.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

from flask import session, redirect, url_for
from bson import ObjectId
from backend.db import relatorios_colecao


# ==============================================================================
# 2. VISUALIZAÇÃO DE RELATÓRIOS
# ==============================================================================

def visualizar_relatorio(index):
    """
    Redireciona o usuário para a visualização de um relatório.

    Fluxo:
      1. Se `index` for um ObjectId válido (24 chars alfanuméricos) e houver
         usuário logado, busca o relatório no banco garantindo que pertence
         ao usuário.
      2. Caso contrário, trata `index` como índice numérico no histórico de
         relatórios da sessão.
      3. Se nada casar, volta para a página de perfil.
    """
    usuario_id = session.get('usuario_id')

    # --------------------------------------------------------------------------
    # 2.1. Tentativa principal: `index` é um ObjectId de relatório
    # --------------------------------------------------------------------------
    if str(index).isalnum() and len(str(index)) == 24 and usuario_id:
        try:
            ids_busca = [str(usuario_id)]
            if ObjectId.is_valid(str(usuario_id)):
                ids_busca.append(ObjectId(str(usuario_id)))
            doc = relatorios_colecao.find_one({
                '_id': ObjectId(str(index)),
                'usuario_id': {'$in': ids_busca}
            })
            if doc:
                session['relatorio_dados'] = doc
                return redirect(url_for('pagina_relatorio_pdf', id=str(index)))
        except Exception:
            pass

    # --------------------------------------------------------------------------
    # 2.2. Fallback: `index` é um índice numérico no histórico da sessão
    # --------------------------------------------------------------------------
    try:
        idx = int(index)
        historico = session.get('relatorios_gerados', [])
        if 0 <= idx < len(historico):
            session['relatorio_dados'] = historico[idx]
            rel_id = historico[idx].get('id')
            if rel_id:
                return redirect(url_for('pagina_relatorio_pdf', id=str(rel_id)))
            return redirect(url_for('pagina_relatorio_pdf'))
    except Exception:
        pass

    # --------------------------------------------------------------------------
    # 2.3. Nenhum relatório encontrado → volta para o perfil
    # --------------------------------------------------------------------------
    return redirect(url_for('pagina_perfil'))


# ==============================================================================
# 3. ALIASES DE COMPATIBILIDADE
# ==============================================================================

# Alias mantido para retrocompatibilidade (grafia com "z").
vizualizar_relatorio = visualizar_relatorio