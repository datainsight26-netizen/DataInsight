from flask import request, jsonify, session, current_app, render_template, redirect, url_for
from flask_mail import Message
from datetime import datetime, timedelta
from bson.objectid import ObjectId
import secrets
import bcrypt

from backend.db import usuario, dados_colecao


# =====================================================
#  EMAIL DE CONFIRMAÇÃO
# =====================================================

def enviar_email_confirmacao_exclusao(email, usuario_nome, token):
    """Envia email com link de confirmação para exclusão de dados"""
    try:
        print(f"[DEBUG] Iniciando envio de email para {email}")

        mail = current_app.mail
        if not mail:
            print("✗ Flask-Mail não está inicializado")
            return False

        sender = current_app.config.get("MAIL_USERNAME")

        # URL de confirmação
        url_confirmacao = f"{request.host_url.rstrip('/')}/confirmar-exclusao?token={token}"
        print(f"[DEBUG] URL: {url_confirmacao}")

        # Criar mensagem
        msg = Message(
            subject="Confirmação de Exclusão de Dados - DataInsight",
            sender=sender,
            recipients=[email]
        )

        # TEXTO
        msg.body = f"""
Confirmação de Exclusão de Dados

Olá {usuario_nome},

Você solicitou a exclusão dos seus dados.

Confirme pelo link:
{url_confirmacao}

⚠️ AÇÃO IRREVERSÍVEL

Se não foi você, ignore este email.

DataInsight © 2026
        """

        # HTML
        msg.html = f"""
        <div style="font-family: Arial; max-width: 600px; margin: auto;">
            <h2>Confirmação de Exclusão</h2>

            <p>Olá <strong>{usuario_nome}</strong>,</p>
            <p>Você solicitou excluir seus dados.</p>

            <div style="background:#fff3cd;padding:15px;border-left:4px solid #ffc107;margin:20px 0;">
                <strong>⚠️ Ação irreversível</strong>
            </div>

            <div style="text-align:center;margin:30px;">
                <a href="{url_confirmacao}" style="
                    background:#dc2626;
                    color:white;
                    padding:12px 30px;
                    text-decoration:none;
                    border-radius:6px;
                    font-weight:bold;
                ">
                    Confirmar Exclusão
                </a>
            </div>

            <p style="font-size:14px;color:#999;">Se não foi você, ignore.</p>
            <hr>
            <p style="font-size:12px;color:#999;">DataInsight ©2026</p>
        </div>
        """

        print("[DEBUG] Enviando email...")
        mail.send(msg)

        print(f"✓ Email enviado para {email}")
        return True

    except Exception as e:
        import traceback
        print(f"✗ Erro ao enviar email: {e}")
        traceback.print_exc()
        return False


# =====================================================
#  SOLICITAR EXCLUSÃO
# =====================================================

def solicitar_exclusao_dados():
    """Solicita exclusão enviando email de confirmação"""
    try:
        print("[DEBUG] Iniciando solicitar_exclusao_dados")

        usuario_id_str = session.get("usuario_id")
        if not usuario_id_str:
            return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"}), 401

        # Converter ID
        try:
            usuario_id = ObjectId(usuario_id_str)
        except Exception as e:
            print(f"[DEBUG] Erro ObjectId: {e}")
            return jsonify({"sucesso": False, "mensagem": "ID inválido"}), 400

        # Buscar usuário
        user = usuario.find_one({"_id": usuario_id})
        if not user:
            return jsonify({"sucesso": False, "mensagem": "Usuário não encontrado"}), 404

        # Gerar token
        token = secrets.token_urlsafe(32)

        usuario.update_one(
            {"_id": usuario_id},
            {
                "$set": {
                    "token_exclusao": token,
                    "token_exclusao_expiracao": datetime.now() + timedelta(hours=1)
                }
            }
        )

        print("[DEBUG] Token salvo")

        # Enviar email
        sucesso = enviar_email_confirmacao_exclusao(
            user.get("email"),
            user.get("nome"),
            token
        )

        if not sucesso:
            return jsonify({
                "sucesso": False,
                "mensagem": "Erro ao enviar email"
            }), 500

        return jsonify({
            "sucesso": True,
            "mensagem": "Email enviado! Verifique sua caixa de entrada"
        }), 200

    except Exception as e:
        import traceback
        print(f"Erro: {e}")
        traceback.print_exc()

        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao processar solicitação"
        }), 500


# =====================================================
#  CONFIRMAR EXCLUSÃO
# =====================================================

def confirmar_exclusao_dados():
    """Confirma exclusão após validação"""
    try:
        token = request.args.get("token")
        senha = request.form.get("senha", "").strip()
        usuario_id_str = session.get("usuario_id")

        # VALIDAÇÕES
        if not token:
            return jsonify({"sucesso": False, "mensagem": "Token inválido"}), 400

        if not usuario_id_str:
            return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"}), 401

        if not senha:
            return jsonify({"sucesso": False, "mensagem": "Senha obrigatória"}), 400

        # Converter ID
        try:
            usuario_id = ObjectId(usuario_id_str)
        except:
            return jsonify({"sucesso": False, "mensagem": "ID inválido"}), 400

        # Buscar usuário
        user = usuario.find_one({"_id": usuario_id})
        if not user:
            return jsonify({"sucesso": False, "mensagem": "Usuário não encontrado"}), 404

        # VALIDAR TOKEN
        if token != user.get("token_exclusao"):
            return jsonify({"sucesso": False, "mensagem": "Token inválido"}), 400

        if datetime.now() > user.get("token_exclusao_expiracao"):
            return jsonify({"sucesso": False, "mensagem": "Token expirado"}), 400

        # VALIDAR SENHA
        if not bcrypt.checkpw(senha.encode("utf-8"), user.get("senha")):
            return jsonify({"sucesso": False, "mensagem": "Senha incorreta"}), 401

        # APAGAR DADOS
        dados_colecao.delete_many({"usuario_id": usuario_id_str})

        # LIMPAR TOKEN
        usuario.update_one(
            {"_id": usuario_id},
            {
                "$unset": {
                    "token_exclusao": "",
                    "token_exclusao_expiracao": ""
                }
            }
        )

        return jsonify({
            "sucesso": True,
            "mensagem": "Dados apagados com sucesso"
        }), 200

    except Exception as e:
        print(f"Erro: {e}")
        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao excluir dados"
        }), 500


# =====================================================
#  PÁGINA HTML
# =====================================================

def pagina_confirmacao_exclusao():
    """Renderiza página de confirmação"""
    token = request.args.get("token")

    if not token:
        return redirect(url_for("pagina_dados"))

    return render_template("confirmacao_exclusao.html", token=token)