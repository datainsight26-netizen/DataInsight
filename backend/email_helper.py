# ==============================================================================
# email_helper.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os

from flask import current_app
from flask_mail import Message


# ==============================================================================
# 2. REMETENTE
# ==============================================================================

def obter_remetente():
    """Retorna a tupla de remetente formatada ('DataInsight', 'datainsight26@gmail.com')."""
    email_user = (
        current_app.config.get('MAIL_USERNAME')
        or os.getenv('EMAIL_USER', 'datainsight26@gmail.com')
    )
    return ("DataInsight", email_user)


# ==============================================================================
# 3. CONSTRUÇÃO DE MENSAGENS
# ==============================================================================

def criar_mensagem(subject, recipients, body=None, html=None, reply_to=None):
    """
    Cria uma instância de flask_mail.Message com os cabeçalhos ideais para evitar
    filtros de spam (RFC 3834 / RFC 2822 / SpamAssassin / Gmail postmaster guidelines).
    """
    # --------------------------------------------------------------------------
    # 3.1. Remetente
    # --------------------------------------------------------------------------
    sender = obter_remetente()
    email_sender_str = sender[1] if isinstance(sender, tuple) else sender

    # --------------------------------------------------------------------------
    # 3.2. Instancia a mensagem
    # --------------------------------------------------------------------------
    msg = Message(
        subject=subject,
        sender=sender,
        recipients=recipients if isinstance(recipients, list) else [recipients]
    )

    # --------------------------------------------------------------------------
    # 3.3. Corpo e HTML
    # --------------------------------------------------------------------------
    if body:
        msg.body = body.strip()
    if html:
        msg.html = html.strip()

    # --------------------------------------------------------------------------
    # 3.4. Reply-To
    # --------------------------------------------------------------------------
    msg.reply_to = reply_to if reply_to else f"DataInsight <{email_sender_str}>"

    # --------------------------------------------------------------------------
    # 3.5. Cabeçalhos anti-spam e de entregabilidade transacional
    # --------------------------------------------------------------------------
    msg.extra_headers = {
        "X-Mailer": "DataInsight Notification Service",
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
        "Precedence": "bulk"
    }

    return msg