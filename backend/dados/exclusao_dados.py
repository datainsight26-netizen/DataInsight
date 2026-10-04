# ==============================================================================
# exclusao_dados.py
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

import os
import secrets
import shutil
import traceback
from datetime import datetime, timedelta

import bcrypt
from bson.objectid import ObjectId
from flask import (
    current_app,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from backend.db import (
    analises_salvas_colecao,
    chat_historico,
    dados_colecao,
    galeria,
    produtos_historico,
    relatorios_colecao,
    usuario,
)


# ==============================================================================
# 2. EMAIL DE CONFIRMAÇÃO DE EXCLUSÃO
# ==============================================================================

def enviar_email_confirmacao_exclusao(email, usuario_nome, token):
    """Envia email com link de confirmação para exclusão de dados com cabeçalhos anti-spam"""
    try:
        print(f"[DEBUG] Iniciando envio de email para {email}")

        mail = current_app.mail
        if not mail:
            print("✗ Flask-Mail não está inicializado")
            return False

        from backend.email_helper import criar_mensagem

        # URL de confirmação
        url_confirmacao = (
            f"{request.host_url.rstrip('/')}/confirmar-exclusao?token={token}"
        )

        # ----------------------------------------------------------------------
        # 2.1 Corpo em texto puro
        # ----------------------------------------------------------------------
        corpo_txt = f"""Ola {usuario_nome},

Recebemos uma solicitacao para exclusao da sua conta e de todos os dados associados na plataforma DataInsight.

Para confirmar esta operacao, clique no link abaixo ou copie e cole no seu navegador:
{url_confirmacao}

Importante: Esta solicitacao e permanente e excluira historico, relatorios e dados cadastrados.

Se voce nao solicitou a exclusao, nenhuma acao e necessaria. Sua conta continuara ativa e segura.

Atenciosamente,
Equipe DataInsight
https://datainsight.com.br
"""

        # ----------------------------------------------------------------------
        # 2.2 Corpo em HTML
        # ----------------------------------------------------------------------
        corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmacao de Exclusao de Dados - DataInsight</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; overflow: hidden;">
          <tr>
            <td style="padding: 28px 36px; background-color: #1e3a8a; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #ffffff; font-weight: 700;">DataInsight</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 36px 24px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 600;">Confirmação de Exclusão de Conta</h2>
              <p style="margin: 0 0 16px; font-size: 15px; color: #4b5563; line-height: 1.6;">
                Olá, <strong>{usuario_nome}</strong>. Recebemos seu pedido para excluir seus dados e encerrar sua conta no DataInsight.
              </p>
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.5;">
                  <strong>Aviso:</strong> A confirmação apagará permanentemente relatórios, tabelas e histórico cadastrados.
                </p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{url_confirmacao}" style="
                  display: inline-block;
                  background-color: #dc2626;
                  color: #ffffff;
                  padding: 14px 32px;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                  font-size: 15px;
                ">
                  Confirmar Exclusão de Dados
                </a>
              </div>
              <p style="margin: 20px 0 0; font-size: 13px; color: #9ca3af;">
                Se você não solicitou este procedimento, apenas ignore esta mensagem.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px; border-top: 1px solid #f3f4f6; text-align: center; background-color: #fafafa;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">DataInsight © 2026 - Central de Privacidade e Dados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        # ----------------------------------------------------------------------
        # 2.3 Envio
        # ----------------------------------------------------------------------
        msg = criar_mensagem(
            subject="Confirmação de solicitação - DataInsight",
            recipients=[email],
            body=corpo_txt,
            html=corpo_html,
        )

        mail.send(msg)
        print(f"✓ Email enviado para {email}")
        return True

    except Exception as e:
        print(f"✗ Erro ao enviar email: {e}")
        traceback.print_exc()
        return False


# ==============================================================================
# 3. SOLICITAÇÃO DE EXCLUSÃO (ETAPA 1 — ENVIO DO EMAIL)
# ==============================================================================

def solicitar_exclusao_dados():
    """Solicita exclusão enviando email de confirmação"""
    try:
        print("[DEBUG] Iniciando solicitar_exclusao_dados")

        # ----------------------------------------------------------------------
        # 3.1 Autenticação e parsing do ID
        # ----------------------------------------------------------------------
        usuario_id_str = session.get("usuario_id")
        if not usuario_id_str:
            return jsonify({
                "sucesso": False,
                "mensagem": "Usuário não autenticado",
            }), 401

        try:
            usuario_id = ObjectId(usuario_id_str)
        except Exception as e:
            print(f"[DEBUG] Erro ObjectId: {e}")
            return jsonify({"sucesso": False, "mensagem": "ID inválido"}), 400

        # ----------------------------------------------------------------------
        # 3.2 Busca do usuário
        # ----------------------------------------------------------------------
        user = usuario.find_one({"_id": usuario_id})
        if not user:
            return jsonify({
                "sucesso": False,
                "mensagem": "Usuário não encontrado",
            }), 404

        # ----------------------------------------------------------------------
        # 3.3 Geração e persistência do token
        # ----------------------------------------------------------------------
        token = secrets.token_urlsafe(32)

        usuario.update_one(
            {"_id": usuario_id},
            {
                "$set": {
                    "token_exclusao": token,
                    "token_exclusao_expiracao": datetime.now() + timedelta(hours=1),
                }
            },
        )

        print("[DEBUG] Token salvo")

        # ----------------------------------------------------------------------
        # 3.4 Envio do email
        # ----------------------------------------------------------------------
        sucesso = enviar_email_confirmacao_exclusao(
            user.get("email"),
            user.get("nome"),
            token,
        )

        if not sucesso:
            return jsonify({
                "sucesso": False,
                "mensagem": "Erro ao enviar email",
            }), 500

        return jsonify({
            "sucesso": True,
            "mensagem": "Email enviado! Verifique sua caixa de entrada",
        }), 200

    except Exception as e:
        print(f"Erro: {e}")
        traceback.print_exc()

        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao processar solicitação",
        }), 500


# ==============================================================================
# 4. CONFIRMAÇÃO DE EXCLUSÃO (ETAPA 2 — APAGAR TUDO EM CASCATA)
# ==============================================================================

def confirmar_exclusao_dados():
    """Confirma exclusão após validação"""
    try:
        # ----------------------------------------------------------------------
        # 4.1 Leitura dos parâmetros
        # ----------------------------------------------------------------------
        token = request.args.get("token")
        senha = request.form.get("senha", "").strip()
        usuario_id_str = session.get("usuario_id")

        # ----------------------------------------------------------------------
        # 4.2 Validações de entrada
        # ----------------------------------------------------------------------
        if not token:
            return jsonify({"sucesso": False, "mensagem": "Token inválido"}), 400

        if not usuario_id_str:
            return jsonify({
                "sucesso": False,
                "mensagem": "Usuário não autenticado",
            }), 401

        if not senha:
            return jsonify({"sucesso": False, "mensagem": "Senha obrigatória"}), 400

        try:
            usuario_id = ObjectId(usuario_id_str)
        except Exception:
            return jsonify({"sucesso": False, "mensagem": "ID inválido"}), 400

        # ----------------------------------------------------------------------
        # 4.3 Busca do usuário
        # ----------------------------------------------------------------------
        user = usuario.find_one({"_id": usuario_id})
        if not user:
            return jsonify({
                "sucesso": False,
                "mensagem": "Usuário não encontrado",
            }), 404

        # ----------------------------------------------------------------------
        # 4.4 Validação do token e da expiração
        # ----------------------------------------------------------------------
        if token != user.get("token_exclusao"):
            return jsonify({"sucesso": False, "mensagem": "Token inválido"}), 400

        if datetime.now() > user.get("token_exclusao_expiracao"):
            return jsonify({"sucesso": False, "mensagem": "Token expirado"}), 400

        # ----------------------------------------------------------------------
        # 4.5 Validação da senha
        # ----------------------------------------------------------------------
        if not bcrypt.checkpw(senha.encode("utf-8"), user.get("senha")):
            return jsonify({"sucesso": False, "mensagem": "Senha incorreta"}), 401

        # ----------------------------------------------------------------------
        # 4.6 Exclusão em cascata das coleções (integridade DEL-07)
        # ----------------------------------------------------------------------
        ids_busca = [str(usuario_id_str)]
        if ObjectId.is_valid(str(usuario_id_str)):
            ids_busca.append(ObjectId(str(usuario_id_str)))

        filtro_usuario = {"usuario_id": {"$in": ids_busca}}

        dados_colecao.delete_many(filtro_usuario)
        chat_historico.delete_many(filtro_usuario)
        galeria.delete_many(filtro_usuario)
        produtos_historico.delete_many(filtro_usuario)
        analises_salvas_colecao.delete_many(filtro_usuario)
        relatorios_colecao.delete_many(filtro_usuario)

        # ----------------------------------------------------------------------
        # 4.7 Expurgo de arquivos físicos em disco
        # ----------------------------------------------------------------------
        try:
            upload_base = current_app.config.get("UPLOAD_FOLDER", "uploads")
            user_folder = os.path.join(upload_base, str(usuario_id_str))
            if os.path.exists(user_folder):
                shutil.rmtree(user_folder, ignore_errors=True)
        except Exception as ex_disk:
            print(f"⚠ Aviso ao remover arquivos físicos do usuário: {ex_disk}")

        # ----------------------------------------------------------------------
        # 4.8 Exclusão da conta do usuário e limpeza da sessão
        # ----------------------------------------------------------------------
        usuario.delete_one({"_id": usuario_id})
        session.clear()

        return jsonify({
            "sucesso": True,
            "mensagem": "Todos os dados foram permanentemente excluídos com sucesso",
        }), 200

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao excluir dados",
        }), 500


# ==============================================================================
# 5. PÁGINA HTML DE CONFIRMAÇÃO
# ==============================================================================

def pagina_confirmacao_exclusao():
    """Renderiza página de confirmação"""
    token = request.args.get("token")

    if not token:
        return redirect(url_for("pagina_dados"))

    return render_template("confirmacao_exclusao.html", token=token)