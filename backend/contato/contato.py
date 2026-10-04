# ==============================================================================
# contato.py
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
# 1. IMPORTAÇÕES E CONFIGURAÇÃO DE LOGGING
# ==============================================================================

import logging
import re

from flask import current_app, jsonify, request

# Configurar logging
logger = logging.getLogger(__name__)


# ==============================================================================
# 2. VALIDAÇÕES
# ==============================================================================

def validar_email(email):
    """Valida o formato do email"""
    padrao = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(padrao, email) is not None


def validar_nome(nome):
    """Valida o nome (mínimo 3 caracteres)"""
    return len(nome.strip()) >= 3


def validar_mensagem(mensagem):
    """Valida a mensagem (mínimo 10 caracteres)"""
    return len(mensagem.strip()) >= 10


# ==============================================================================
# 3. ENVIO DE EMAIL
# ==============================================================================

def enviar_email_contato(nome, email_usuario, mensagem):
    """Envia o email de contato para o DataInsight com cabeçalhos anti-spam"""
    try:
        mail = current_app.mail if hasattr(current_app, "mail") else None

        if not mail:
            logger.error("Mail não configurado no app")
            return (False, "Sistema de email não configurado")

        from backend.email_helper import criar_mensagem

        destinatario = "datainsight26@gmail.com"

        try:
            # ------------------------------------------------------------------
            # Corpo em texto puro
            # ------------------------------------------------------------------
            corpo_txt = f"""Novo Contato Recebido pelo Site

Nome: {nome}
Email: {email_usuario}

Mensagem:
{mensagem}

---
Esta e uma mensagem do formulario de contato da plataforma DataInsight.
Para responder, utilize diretamente o endereco: {email_usuario}
"""

            # ------------------------------------------------------------------
            # Corpo em HTML
            # ------------------------------------------------------------------
            corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Novo Contato</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background-color: #1e3a8a; padding: 20px 24px; color: #ffffff;">
      <h2 style="margin: 0; font-size: 18px;">Novo Contato Recebido via Formulário</h2>
    </div>
    <div style="padding: 24px;">
      <p style="margin: 0 0 10px; font-size: 15px;"><strong>Remetente:</strong> {nome}</p>
      <p style="margin: 0 0 18px; font-size: 15px;"><strong>E-mail de resposta:</strong> <a href="mailto:{email_usuario}" style="color: #2563eb;">{email_usuario}</a></p>
      
      <div style="background-color: #f1f5f9; padding: 16px; border-left: 4px solid #2563eb; border-radius: 4px; margin: 20px 0;">
        <p style="color: #334155; margin: 0; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">{mensagem}</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;">
      <p style="font-size: 12px; color: #64748b; margin: 0;">Esta é uma mensagem gerada pelo formulário de contato do DataInsight.</p>
    </div>
  </div>
</body>
</html>"""

            # ------------------------------------------------------------------
            # Montagem e envio
            # ------------------------------------------------------------------
            msg = criar_mensagem(
                subject=f"Novo contato de {nome} - DataInsight",
                recipients=[destinatario],
                body=corpo_txt,
                html=corpo_html,
                reply_to=email_usuario,
            )

            mail.send(msg)
            logger.info(f"Email de contato enviado com sucesso de {email_usuario}")
            return (
                True,
                "Mensagem enviada com sucesso! Entraremos em contato em breve.",
            )

        except Exception as send_error:
            logger.error(f"Erro ao enviar email: {str(send_error)}", exc_info=True)
            return (False, f"Erro ao enviar email: {str(send_error)}")

    except Exception as e:
        logger.error(f"Erro na função enviar_email_contato: {str(e)}", exc_info=True)
        return (False, f"Erro ao enviar email: {str(e)}")


# ==============================================================================
# 4. ROTA DE CONTATO
# ==============================================================================

def enviar_mensagem_contato():
    """Processa o envio da mensagem de contato"""
    try:
        # ----------------------------------------------------------------------
        # Obter dados do JSON
        # ----------------------------------------------------------------------
        data = request.get_json()

        if not data:
            logger.warning("Nenhum dado JSON recebido")
            return jsonify({
                "sucesso": False,
                "mensagem": "Erro ao processar dados",
            }), 400

        nome = data.get("nome", "").strip()
        email = data.get("email", "").strip()
        mensagem = data.get("mensagem", "").strip()

        # ----------------------------------------------------------------------
        # Validações
        # ----------------------------------------------------------------------
        if not nome or not email or not mensagem:
            logger.warning(
                "Campos vazios: nome=%s, email=%s, mensagem=%s",
                nome,
                email,
                mensagem,
            )
            return jsonify({
                "sucesso": False,
                "mensagem": "Por favor, preencha todos os campos",
            }), 400

        if not validar_nome(nome):
            return jsonify({
                "sucesso": False,
                "mensagem": "O nome deve ter pelo menos 3 caracteres",
            }), 400

        if not validar_email(email):
            return jsonify({
                "sucesso": False,
                "mensagem": "Por favor, digite um email válido",
            }), 400

        if not validar_mensagem(mensagem):
            return jsonify({
                "sucesso": False,
                "mensagem": "A mensagem deve ter pelo menos 10 caracteres",
            }), 400

        # ----------------------------------------------------------------------
        # Enviar email
        # ----------------------------------------------------------------------
        logger.info(f"Enviando email de contato de {email}")

        try:
            resultado = enviar_email_contato(nome, email, mensagem)

            # Garantir que o resultado é sempre uma tupla (sucesso, mensagem)
            if isinstance(resultado, tuple) and len(resultado) == 2:
                sucesso, msg = resultado
                logger.info(f"Resultado do envio: sucesso={sucesso}")
            else:
                logger.error(
                    f"Resultado inesperado: {resultado} (tipo: {type(resultado)})"
                )
                sucesso = False
                msg = "Erro inesperado ao enviar email"

            if sucesso:
                return jsonify({
                    "sucesso": True,
                    "mensagem": msg,
                }), 200
            else:
                return jsonify({
                    "sucesso": False,
                    "mensagem": msg,
                }), 500

        except Exception as email_error:
            logger.error(f"Erro ao enviar email: {str(email_error)}", exc_info=True)
            return jsonify({
                "sucesso": False,
                "mensagem": f"Erro ao enviar email: {str(email_error)}",
            }), 500

    except Exception as e:
        logger.error(
            f"Erro geral em enviar_mensagem_contato: {str(e)}", exc_info=True
        )
        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao processar a solicitação",
        }), 500