from flask import request, jsonify, current_app
from flask_mail import Message
import re
import logging

# Configurar logging
logger = logging.getLogger(__name__)

# =====================================================
#  VALIDAÇÕES
# =====================================================

def validar_email(email):
    """Valida o formato do email"""
    padrao = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(padrao, email) is not None


def validar_nome(nome):
    """Valida o nome (mínimo 3 caracteres)"""
    return len(nome.strip()) >= 3


def validar_mensagem(mensagem):
    """Valida a mensagem (mínimo 10 caracteres)"""
    return len(mensagem.strip()) >= 10


# =====================================================
#  ENVIO DE EMAIL
# =====================================================

def enviar_email_contato(nome, email_usuario, mensagem):
    """Envia o email de contato para o DataInsight"""
    try:
        # Obter instância de mail
        mail = current_app.mail if hasattr(current_app, 'mail') else None
        
        if not mail:
            logger.error("Mail não configurado no app")
            return (False, "Sistema de email não configurado")

        sender = current_app.config.get("MAIL_USERNAME")
        if not sender:
            logger.error("MAIL_USERNAME não configurado")
            return (False, "Email de envio não configurado")

        destinatario = "datainsight26@gmail.com"

        try:
            # Criar mensagem com configurações básicas
            msg = Message(
                subject=f"Novo Contato - {nome}",
                sender=sender,
                recipients=[destinatario]
            )
            
            # Adicionar reply_to como string em vez de lista
            msg.reply_to = email_usuario

            # TEXTO
            msg.body = f"""
Novo Contato Recebido

Nome: {nome}
Email: {email_usuario}

Mensagem:
{mensagem}

---
Esta é uma mensagem automática do formulário de contato do DataInsight.
Para responder, use o email: {email_usuario}
            """

            # HTML
            msg.html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Novo Contato Recebido</h2>
            
            <div style="margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>Nome:</strong> {nome}</p>
                <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:{email_usuario}">{email_usuario}</a></p>
            </div>

            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; border-radius: 4px; margin: 20px 0;">
                <p style="color: #555; margin: 0; white-space: pre-wrap; word-wrap: break-word;">{mensagem}</p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">Esta é uma mensagem automática do formulário de contato do DataInsight.</p>
            <p style="font-size: 12px; color: #999;">Para responder, use o email: <strong>{email_usuario}</strong></p>
        </div>
            """

            # Enviar email
            mail.send(msg)
            logger.info(f"Email de contato enviado com sucesso de {email_usuario}")
            return (True, "Mensagem enviada com sucesso! Entraremos em contato em breve.")
            
        except Exception as send_error:
            logger.error(f"Erro ao enviar email: {str(send_error)}", exc_info=True)
            return (False, f"Erro ao enviar email: {str(send_error)}")

    except Exception as e:
        logger.error(f"Erro na função enviar_email_contato: {str(e)}", exc_info=True)
        return (False, f"Erro ao enviar email: {str(e)}")


# =====================================================
#  ROTA DE CONTATO
# =====================================================

def enviar_mensagem_contato():
    """Processa o envio da mensagem de contato"""
    try:
        # Obter dados do JSON
        data = request.get_json()

        if not data:
            logger.warning("Nenhum dado JSON recebido")
            return jsonify({
                "sucesso": False,
                "mensagem": "Erro ao processar dados"
            }), 400

        nome = data.get("nome", "").strip()
        email = data.get("email", "").strip()
        mensagem = data.get("mensagem", "").strip()

        # ========== VALIDAÇÕES ==========
        if not nome or not email or not mensagem:
            logger.warning("Campos vazios: nome=%s, email=%s, mensagem=%s", nome, email, mensagem)
            return jsonify({
                "sucesso": False,
                "mensagem": "Por favor, preencha todos os campos"
            }), 400

        if not validar_nome(nome):
            return jsonify({
                "sucesso": False,
                "mensagem": "O nome deve ter pelo menos 3 caracteres"
            }), 400

        if not validar_email(email):
            return jsonify({
                "sucesso": False,
                "mensagem": "Por favor, digite um email válido"
            }), 400

        if not validar_mensagem(mensagem):
            return jsonify({
                "sucesso": False,
                "mensagem": "A mensagem deve ter pelo menos 10 caracteres"
            }), 400

        # ========== ENVIAR EMAIL ==========
        logger.info(f"Enviando email de contato de {email}")
        
        try:
            resultado = enviar_email_contato(nome, email, mensagem)
            
            # Garantir que o resultado é sempre uma tupla (sucesso, mensagem)
            if isinstance(resultado, tuple) and len(resultado) == 2:
                sucesso, msg = resultado
                logger.info(f"Resultado do envio: sucesso={sucesso}")
            else:
                logger.error(f"Resultado inesperado: {resultado} (tipo: {type(resultado)})")
                sucesso = False
                msg = "Erro inesperado ao enviar email"

            if sucesso:
                return jsonify({
                    "sucesso": True,
                    "mensagem": msg
                }), 200
            else:
                return jsonify({
                    "sucesso": False,
                    "mensagem": msg
                }), 500
                
        except Exception as email_error:
            logger.error(f"Erro ao enviar email: {str(email_error)}", exc_info=True)
            return jsonify({
                "sucesso": False,
                "mensagem": f"Erro ao enviar email: {str(email_error)}"
            }), 500

    except Exception as e:
        logger.error(f"Erro geral em enviar_mensagem_contato: {str(e)}", exc_info=True)
        return jsonify({
            "sucesso": False,
            "mensagem": "Erro ao processar a solicitação"
        }), 500

