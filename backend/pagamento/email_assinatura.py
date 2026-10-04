# ==============================================================================
# email_assinatura.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, conforme o padrão abaixo.
#
# Observação técnica: o formato original sugerido usava "//" (estilo JavaScript).
# Em Python, "//" é o operador de divisão inteira e causaria erro de sintaxe,
# portanto os cabeçalhos foram adaptados para "#", preservando a mesma função
# de demarcação visual e numeração sequencial.

"""
Módulo de envio de e-mail de confirmação de assinatura DataInsight.
Disparado automaticamente quando o Stripe confirma o pagamento.
"""

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import logging
from datetime import datetime

from flask import current_app

from backend.db import usuario
from backend.email_helper import criar_mensagem


# ==============================================================================
# 2. CONFIGURAÇÃO DE LOGGING
# ==============================================================================

logger = logging.getLogger(__name__)


# ==============================================================================
# 3. CATÁLOGO DE PLANOS
# ==============================================================================

PLANOS = {
    "MEI": {
        "nome": "DataInsight MEI",
        "valor": "R$ 250,00",
        "descricao": "Ideal para Microempreendedores Individuais",
        "cor": "#6366f1",
        "cor_clara": "#e0e7ff",
        "recursos": [
            "Dashboard financeiro completo",
            "Analise de IA com Gemini",
            "Relatorios mensais em PDF",
            "Controles essenciais MEI",
            "Suporte prioritario",
        ],
    },
    "ME": {
        "nome": "DataInsight ME",
        "valor": "R$ 300,00",
        "descricao": "Para Microempresas em crescimento",
        "cor": "#0ea5e9",
        "cor_clara": "#e0f2fe",
        "recursos": [
            "Tudo do plano MEI",
            "Analises avancadas de BI",
            "Gestao multi-tabela de dados",
            "Assistente virtual de IA",
            "Planejamento financeiro",
            "Suporte dedicado",
        ],
    },
}

_PLANO_DEFAULT = {
    "nome": "DataInsight",
    "valor": "Consulte o site",
    "descricao": "Plano DataInsight",
    "cor": "#2563eb",
    "cor_clara": "#dbeafe",
    "recursos": ["Acesso a plataforma DataInsight"],
}


# ==============================================================================
# 4. AUXILIARES DE PLANO
# ==============================================================================

def _info_plano(plano: str) -> dict:
    return PLANOS.get(str(plano).upper(), _PLANO_DEFAULT)


# ==============================================================================
# 5. GERAÇÃO DO HTML DO E-MAIL
# ==============================================================================

def _gerar_html_confirmacao(
    nome_usuario: str,
    email_usuario: str,
    plano: str,
    subscription_id: str,
    session_id: str,
    data_pagamento: datetime,
    is_renovacao: bool = False,
) -> str:
    """Retorna o HTML completo do e-mail de confirmação ou renovação de assinatura."""

    info = _info_plano(plano)
    cor = info["cor"]
    cor_clara = info["cor_clara"]
    nome_plano = info["nome"]
    valor = info["valor"]
    descricao = info["descricao"]

    recursos_itens = ""
    for r in info["recursos"]:
        recursos_itens += (
            '<li style="margin:7px 0; color:#374151; font-size:14px; '
            'display:flex; align-items:center; gap:8px;">'
            '<span style="color:#16a34a; font-weight:700;">&#10003;</span> '
            + r + "</li>"
        )

    data_str = data_pagamento.strftime("%d/%m/%Y %H:%M")
    comprovante_id = subscription_id or session_id or "N/A"
    nome_exibir = nome_usuario or "Cliente"
    ano = data_pagamento.year

    titulo_principal = "Renovação Confirmada!" if is_renovacao else "Assinatura Confirmada!"
    subtitulo = (
        f"Parabens, <strong>{nome_exibir}</strong>! Sua mensalidade foi renovada com sucesso."
        if is_renovacao else
        f"Parabens, <strong>{nome_exibir}</strong>! Seu pagamento foi aprovado."
    )
    badge_texto = "Plano Renovado" if is_renovacao else "Plano Ativado"

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{titulo_principal} - DataInsight</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="background:#ffffff;border-radius:16px;overflow:hidden;
                  box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">

      <!-- CABECALHO -->
      <tr>
        <td style="background:linear-gradient(135deg,{cor} 0%,#1e40af 100%);
                   padding:40px 40px 32px;text-align:center;">
          <div style="margin-bottom:16px;">
            <span style="font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
              DataInsight
            </span>
          </div>
          <div style="width:72px;height:72px;background:rgba(255,255,255,0.2);
                      border-radius:50%;display:inline-block;line-height:72px;
                      margin-bottom:16px;border:2px solid rgba(255,255,255,0.4);
                      font-size:36px;">
            &#10004;
          </div>
          <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px;">
            {titulo_principal}
          </h1>
          <p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">
            {subtitulo}
          </p>
        </td>
      </tr>

      <!-- BADGE DO PLANO -->
      <tr>
        <td style="padding:0 40px;">
          <div style="background:{cor_clara};border:1px solid {cor}44;
                      border-radius:12px;padding:20px 24px;margin-top:28px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:{cor};font-weight:700;
                      text-transform:uppercase;letter-spacing:1.5px;">{badge_texto}</p>
            <h2 style="margin:0 0 4px;font-size:28px;font-weight:800;color:{cor};">
              {nome_plano}
            </h2>
            <p style="margin:0;font-size:13px;color:#6b7280;">{descricao}</p>
          </div>
        </td>
      </tr>

      <!-- COMPROVANTE -->
      <tr>
        <td style="padding:28px 40px 0;">
          <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;
                     border-bottom:2px solid #f3f4f6;padding-bottom:10px;">
            Comprovante de Pagamento
          </h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">Status</td>
              <td style="text-align:right;padding:10px 0;">
                <span style="background:#dcfce7;color:#16a34a;font-size:12px;
                             font-weight:700;padding:4px 12px;border-radius:20px;
                             border:1px solid #bbf7d0;">APROVADO</span>
              </td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">Plano</td>
              <td style="text-align:right;font-size:13px;font-weight:600;
                         color:#111827;padding:10px 0;">{nome_plano}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">Valor Mensal</td>
              <td style="text-align:right;padding:10px 0;">
                <span style="font-size:22px;font-weight:800;color:{cor};">{valor}</span>
                <span style="font-size:11px;color:#9ca3af;">/mes</span>
              </td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">Recorrencia</td>
              <td style="text-align:right;font-size:13px;color:#111827;
                         padding:10px 0;">Mensal (automatica)</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">Data</td>
              <td style="text-align:right;font-size:13px;color:#111827;
                         padding:10px 0;">{data_str}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">ID Comprovante</td>
              <td style="text-align:right;font-size:11px;color:#6b7280;
                         font-family:monospace;padding:10px 0;
                         word-break:break-all;">{comprovante_id}</td>
            </tr>
            <tr><td colspan="2" style="border-bottom:1px solid #f3f4f6;"></td></tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;padding:10px 0;">E-mail</td>
              <td style="text-align:right;font-size:13px;color:#111827;
                         padding:10px 0;">{email_usuario}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- RECURSOS -->
      <tr>
        <td style="padding:24px 40px 0;">
          <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#111827;">
            O que esta incluido no seu plano
          </h3>
          <ul style="margin:0;padding-left:0;list-style:none;">
            {recursos_itens}
          </ul>
        </td>
      </tr>

      <!-- AVISO -->
      <tr>
        <td style="padding:0 40px 32px;">
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;
                      padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#92400e;line-height:1.7;">
              <strong>Informacao importante:</strong> Sua assinatura e renovada
              automaticamente todo mes. Voce recebera um e-mail de confirmacao
              a cada renovacao. Para cancelar ou gerenciar, acesse as
              <strong>configuracoes do perfil</strong> na plataforma.
            </p>
          </div>
        </td>
      </tr>

      <!-- RODAPE -->
      <tr>
        <td style="background:#f9fafb;border-top:1px solid #f3f4f6;
                   padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#374151;">
            DataInsight - BI &amp; IA para pequenas empresas
          </p>
          <p style="margin:0 0 10px;font-size:12px;color:#9ca3af;">
            E-mail automatico - Para suporte, acesse datainsight.com.br/contato
          </p>
          <p style="margin:0;font-size:11px;color:#d1d5db;">
            &copy; {ano} DataInsight. Todos os direitos reservados.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

    return html


# ==============================================================================
# 6. FUNÇÃO PÚBLICA DE ENVIO
# ==============================================================================

def enviar_email_confirmacao_assinatura(
    email_usuario: str,
    nome_usuario: str,
    plano: str,
    subscription_id: str = "",
    session_id: str = "",
    is_renovacao: bool = False,
) -> bool:
    """
    Envia o e-mail de confirmação ou renovação de assinatura para o cliente.

    Parâmetros
    ----------
    email_usuario   : e-mail do assinante
    nome_usuario    : nome do assinante (pode ser vazio)
    plano           : código do plano — "MEI" ou "ME"
    subscription_id : ID da assinatura no Stripe (sub_xxx)
    session_id      : ID da sessão de checkout (cs_xxx) — fallback
    is_renovacao    : indica se é renovação periódica da assinatura

    Retorna True se enviado com sucesso, False caso contrário.
    """
    # --------------------------------------------------------------------------
    # 6.1 Validação inicial
    # --------------------------------------------------------------------------
    if not email_usuario:
        logger.warning("[email_assinatura] Nenhum e-mail fornecido. Envio cancelado.")
        return False

    try:
        # ----------------------------------------------------------------------
        # 6.2 Verificação da configuração do Flask-Mail
        # ----------------------------------------------------------------------
        mail = getattr(current_app, "mail", None)
        if not mail:
            logger.error("[email_assinatura] Flask-Mail nao configurado.")
            return False

        sender = (
            current_app.config.get("MAIL_USERNAME")
            or current_app.config.get("MAIL_DEFAULT_SENDER")
        )
        if not sender:
            logger.error("[email_assinatura] MAIL_USERNAME nao configurado.")
            return False

        # ----------------------------------------------------------------------
        # 6.3 Deduplicação (mesma sessão/assinatura em curto período)
        # ----------------------------------------------------------------------
        evento_chave = subscription_id or session_id
        if evento_chave:
            try:
                u_check = usuario.find_one({
                    "$or": [
                        {"email": email_usuario.lower()},
                        (
                            {"stripe_subscription_id": subscription_id}
                            if subscription_id
                            else {"email": email_usuario.lower()}
                        ),
                    ]
                })
                if u_check and evento_chave in u_check.get(
                    "emails_confirmacao_enviados", []
                ):
                    logger.info(
                        "[email_assinatura] E-mail já enviado para %s (chave=%s). "
                        "Ignorando duplicata.",
                        email_usuario,
                        evento_chave,
                    )
                    return True
            except Exception as ex_dedup:
                logger.warning(
                    "[email_assinatura] Aviso ao verificar duplicata: %s", ex_dedup
                )

        # ----------------------------------------------------------------------
        # 6.4 Preparação do conteúdo
        # ----------------------------------------------------------------------
        data_pagamento = datetime.now()

        html_body = _gerar_html_confirmacao(
            nome_usuario=nome_usuario,
            email_usuario=email_usuario,
            plano=plano,
            subscription_id=subscription_id,
            session_id=session_id,
            data_pagamento=data_pagamento,
            is_renovacao=is_renovacao,
        )

        info = _info_plano(plano)
        if is_renovacao:
            assunto = f"Renovação de assinatura {info['nome']} confirmada - DataInsight"
            texto_acao = "foi renovada com sucesso"
        else:
            assunto = f"Assinatura {info['nome']} confirmada - DataInsight"
            texto_acao = "foi confirmada com sucesso"

        texto_plano = (
            f"Ola {nome_usuario or 'Cliente'}!\n\n"
            f"Sua assinatura do plano {info['nome']} ({info['valor']}/mes) "
            f"{texto_acao} em "
            f"{data_pagamento.strftime('%d/%m/%Y as %H:%M')}.\n\n"
            f"ID do comprovante: {subscription_id or session_id or 'N/A'}\n\n"
            "Acesse sua plataforma em: https://datainsight.com.br/home\n\n"
            "Equipe DataInsight"
        )

        # ----------------------------------------------------------------------
        # 6.5 Envio
        # ----------------------------------------------------------------------
        msg = criar_mensagem(
            subject=assunto,
            recipients=[email_usuario],
            body=texto_plano,
            html=html_body,
        )

        mail.send(msg)

        # ----------------------------------------------------------------------
        # 6.6 Registro para deduplicação futura
        # ----------------------------------------------------------------------
        if evento_chave:
            try:
                usuario.update_many(
                    {"email": email_usuario.lower()},
                    {"$addToSet": {"emails_confirmacao_enviados": evento_chave}},
                )
            except Exception as ex_reg:
                logger.warning(
                    "[email_assinatura] Aviso ao registrar envio: %s", ex_reg
                )

        logger.info(
            "[email_assinatura] Confirmacao enviada para %s (plano=%s).",
            email_usuario,
            plano,
        )
        return True

    except Exception as exc:
        logger.error(
            "[email_assinatura] Erro ao enviar para %s: %s",
            email_usuario,
            exc,
            exc_info=True,
        )
        return False