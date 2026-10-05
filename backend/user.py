# ==============================================================================
# user.py
# ==============================================================================
# Este código pertence à plataforma @DataInsight.
# Todos os códigos da plataforma devem seguir a mesma estrutura de organização
# em seções numeradas, exatamente como neste arquivo.
# ==============================================================================

# ==============================================================================
# 1. IMPORTAÇÕES
# ==============================================================================

import os
import re
import secrets
import traceback
from datetime import datetime, timedelta

import bcrypt
import stripe
from bson import ObjectId
from flask import (
    render_template,
    request,
    redirect,
    session,
    url_for,
    jsonify,
    current_app,
)

from .db import usuario


# ==============================================================================
# 2. ENVIO DE E-MAIL
# ==============================================================================

def enviar_email_codigo(destinatario, codigo):
    """Envia o código de recuperação por email com otimização anti-spam"""
    try:
        mail = current_app.mail
        if not mail:
            print("✗ Flask-Mail não está inicializado")
            return False

        from backend.email_helper import criar_mensagem

        # ----------------------------------------------------------------------
        # 2.1. Corpo em texto puro
        # ----------------------------------------------------------------------
        corpo_txt = f"""Ola,

Recebemos uma solicitacao para redefinir a senha da sua conta DataInsight.

Seu codigo de verificacao e: {codigo}

Este codigo e valido por 10 minutos.

Se voce nao realizou esta solicitacao, nenhuma acao e necessaria. Sua conta continua segura.

Atenciosamente,
Equipe DataInsight
"""

        # ----------------------------------------------------------------------
        # 2.2. Corpo em HTML
        # ----------------------------------------------------------------------
        corpo_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codigo de Verificacao - DataInsight</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f6f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e5e7eb; overflow: hidden;">
          <tr>
            <td style="padding: 32px 36px; background-color: #1e3a8a; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: #ffffff; font-weight: 700; letter-spacing: -0.5px;">DataInsight</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 36px 20px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 600;">Redefinição de Senha</h2>
              <p style="margin: 0 0 20px; font-size: 15px; color: #4b5563; line-height: 1.6;">
                Recebemos um pedido para alterar a senha da sua conta no <strong>DataInsight</strong>. Utilize o código de verificação abaixo:
              </p>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 13px; text-transform: uppercase; color: #166534; font-weight: 600; letter-spacing: 1px; display: block; margin-bottom: 6px;">Código de Confirmação</span>
                <span style="font-size: 32px; font-weight: 800; color: #15803d; letter-spacing: 6px; font-family: monospace;">{codigo}</span>
              </div>
              <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; line-height: 1.5;">
                • Este código expira em <strong>10 minutos</strong>.<br>
                • Se não foi você quem solicitou, pode desconsiderar esta mensagem. Sua conta permanece segura.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 36px 30px; border-top: 1px solid #f3f4f6; text-align: center; background-color: #fafafa;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">DataInsight - Gestão e Inteligência para Empresas</p>
    
              <p style="margin:0;font-size:11px;color:#d1d5db;">
                &copy; 2026 DataInsight. Todos os direitos reservados.
            </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        # ----------------------------------------------------------------------
        # 2.3. Envio
        # ----------------------------------------------------------------------
        msg = criar_mensagem(
            subject=f"{codigo} é o seu código de verificação DataInsight",
            recipients=[destinatario],
            body=corpo_txt,
            html=corpo_html
        )

        mail.send(msg)
        print(f"✓ Email enviado para {destinatario}")
        return True

    except Exception as e:
        if "535" in str(e) or "Username and Password not accepted" in str(e):
            print("✗ [ERRO SMTP 535]: Falha de autenticação com o Gmail. A 'Senha de App' (EMAIL_PASS) no arquivo .env é inválida ou expirou.")
        else:
            print(f"✗ Erro ao enviar email: {e}")
        traceback.print_exc()
        return False


# ==============================================================================
# 3. VALIDAÇÕES
# ==============================================================================

def validar_email(email):
    padrao = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(padrao, email) is not None


def validar_senha(senha):
    if len(senha) < 8:
        return False, "A senha deve ter no mínimo 8 caracteres"
    return True, ""


def validar_telefone(telefone):
    """Valida se o telefone possui quantidade mínima de dígitos (DDD + número)"""
    if not telefone:
        return False, "Telefone / Celular é obrigatório"
    digitos = re.sub(r"\D", "", telefone)
    if len(digitos) < 10 or len(digitos) > 13:
        return False, "Informe um número de celular válido com DDD (10 ou 11 dígitos)"
    return True, digitos


# ==============================================================================
# 4. CADASTRO (FLUXO SAAS)
# ==============================================================================

def tela_cadastro():
    # --------------------------------------------------------------------------
    # 4.1. Pré-condições e parâmetros iniciais
    # --------------------------------------------------------------------------
    session_id = request.args.get("session_id") or request.form.get("session_id")

    if not session_id:
        return redirect(url_for("pagina_assinaturas"))

    email_preenchido = ""
    plano_contratado = (
        request.args.get("plano")
        or request.form.get("tipo_perfil")
        or session.get("plano_escolhido")
        or "ME"
    ).strip().upper()
    if plano_contratado not in ["MEI", "ME"]:
        plano_contratado = "ME"

    customer_id = None
    subscription_id = None

    # --------------------------------------------------------------------------
    # 4.2. Validação da sessão do Stripe Checkout
    # --------------------------------------------------------------------------
    try:
        STRIPE_SECRET_KEY = os.getenv("STRIPE_API_KEY")
        if STRIPE_SECRET_KEY:
            stripe.api_key = STRIPE_SECRET_KEY
            checkout_session = stripe.checkout.Session.retrieve(session_id)
            detalhes = checkout_session.get("customer_details") or {}
            email_preenchido = (
                detalhes.get("email")
                or checkout_session.get("customer_email")
                or ""
            )
            metadata = checkout_session.get("metadata") or {}
            plano_contratado = metadata.get("plano") or plano_contratado
            customer_id = checkout_session.get("customer")
            subscription_id = checkout_session.get("subscription")
    except Exception as e:
        print(f"Aviso ao consultar Stripe session_id ({session_id}): {e}")

    # --------------------------------------------------------------------------
    # 4.3. Submissão do formulário
    # --------------------------------------------------------------------------
    if request.method == "POST":
        from backend.cnpj.cnpj_service import formatar_cnpj, calcular_teto_anual_mei

        nome = request.form.get("nome", "").strip()
        email = (email_preenchido or request.form.get("email", "")).strip().lower()
        telefone = request.form.get("telefone", "").strip()
        senha = request.form.get("senha", "")
        confirmar = request.form.get("confirmar", "")

        # Dados do Perfil e CNPJ
        cnpj_input = request.form.get("cnpj", "").strip()
        tipo_perfil = plano_contratado or request.form.get("tipo_perfil", "ME").strip().upper()
        if tipo_perfil not in ["MEI", "ME"]:
            tipo_perfil = "ME"
        razao_social = request.form.get("razao_social", "").strip()
        data_abertura = request.form.get("data_abertura", "").strip()

        # Validações básicas
        if not nome or not email or not senha or not confirmar:
            return render_template(
                "cadastro.html",
                error_cad=True,
                msg="Todos os campos obrigatórios devem ser preenchidos.",
                session_id=session_id,
                email_preenchido=email_preenchido,
                plano_contratado=plano_contratado,
            )

        if not validar_email(email):
            return render_template(
                "cadastro.html",
                error_cad=True,
                msg="Email inválido.",
                session_id=session_id,
                email_preenchido=email_preenchido,
                plano_contratado=plano_contratado,
            )

        # Telefone (opcional ou validado se preenchido)
        tel_res = ""
        if telefone:
            valido_tel, tel_res = validar_telefone(telefone)
            if not valido_tel:
                return render_template(
                    "cadastro.html",
                    error_cad=True,
                    msg=tel_res,
                    session_id=session_id,
                    email_preenchido=email_preenchido,
                    plano_contratado=plano_contratado,
                )

        valido, msg = validar_senha(senha)
        if not valido:
            return render_template(
                "cadastro.html",
                error_cad=True,
                msg=msg,
                session_id=session_id,
                email_preenchido=email_preenchido,
                plano_contratado=plano_contratado,
            )

        if senha != confirmar:
            return render_template(
                "cadastro.html",
                error_cad=True,
                msg="As senhas não coincidem.",
                session_id=session_id,
                email_preenchido=email_preenchido,
                plano_contratado=plano_contratado,
            )

        if usuario.find_one({"email": email}):
            return render_template(
                "cadastro.html",
                error_cad=True,
                msg="Email já cadastrado. Acesse a tela de login.",
                session_id=session_id,
                email_preenchido=email_preenchido,
                plano_contratado=plano_contratado,
            )

        # Tratamento do CNPJ
        cnpj_limpo = re.sub(r"\D", "", cnpj_input) if cnpj_input else ""
        cnpj_formatado = formatar_cnpj(cnpj_limpo) if cnpj_limpo else ""

        # Cálculo do limite MEI se aplicável
        limite_anual_mei = 81000.0
        if tipo_perfil == "MEI":
            info_teto = calcular_teto_anual_mei(data_abertura)
            limite_anual_mei = info_teto.get("teto_anual", 81000.0)

        senha_hash = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt())

        # ----------------------------------------------------------------------
        # 4.4. Persistência do novo usuário
        # ----------------------------------------------------------------------
        novo_usuario = {
            "nome": nome,
            "email": email,
            "telefone": tel_res,
            "telefone_formatado": telefone,
            "cnpj": cnpj_limpo,
            "cnpj_formatado": cnpj_formatado,
            "tipo_perfil": tipo_perfil,
            "status_assinatura": "ativa",
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "razao_social": razao_social or nome,
            "data_abertura": data_abertura,
            "limite_anual_mei": limite_anual_mei,
            "senha": senha_hash,
            "criado_em": datetime.now(),
            "atualizado_em": datetime.now()
        }

        res = usuario.insert_one(novo_usuario)

        # ----------------------------------------------------------------------
        # 4.5. Inicia a sessão automaticamente
        # ----------------------------------------------------------------------
        session["usuario_id"] = str(res.inserted_id)
        session["usuario_nome"] = nome
        session["usuario_email"] = email
        session["usuario_telefone"] = telefone
        session["usuario_perfil"] = tipo_perfil
        session["status_assinatura"] = "ativa"
        session["usuario_cnpj"] = cnpj_formatado
        session["usuario_razao_social"] = razao_social or nome
        session["data_abertura_mei"] = data_abertura
        session["limite_anual_mei"] = limite_anual_mei

        # ----------------------------------------------------------------------
        # 4.6. E-mail de confirmação de assinatura
        # ----------------------------------------------------------------------
        if session_id:
            try:
                from backend.pagamento.email_assinatura import enviar_email_confirmacao_assinatura
                enviar_email_confirmacao_assinatura(
                    email_usuario=email,
                    nome_usuario=nome,
                    plano=tipo_perfil,
                    subscription_id=subscription_id or "",
                    session_id=session_id or "",
                )
            except Exception as ex_mail:
                print(f"[tela_cadastro] Aviso ao enviar e-mail de confirmação: {ex_mail}")

        return redirect(url_for("pagina_home"))

    # --------------------------------------------------------------------------
    # 4.7. GET — renderiza o formulário
    # --------------------------------------------------------------------------
    return render_template(
        "cadastro.html",
        session_id=session_id,
        email_preenchido=email_preenchido,
        plano_contratado=plano_contratado
    )


# ==============================================================================
# 5. LOGIN
# ==============================================================================

def login():
    if request.method == "POST":

        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")

        if not email or not senha:
            return render_template("login.html", error=True, msg="Preencha todos os campos")

        user = usuario.find_one({"email": email})

        if not user:
            return render_template("login.html", error=True, msg="Email ou senha inválidos")

        if bcrypt.checkpw(senha.encode("utf-8"), user["senha"]):
            session["usuario_id"] = str(user["_id"])
            session["usuario_nome"] = user["nome"]
            session["usuario_email"] = user["email"]
            session["usuario_telefone"] = user.get("telefone_formatado") or user.get("telefone") or ""
            session["usuario_perfil"] = user.get("tipo_perfil", "ME")
            session["status_assinatura"] = user.get("status_assinatura", "pendente")
            session["usuario_cnpj"] = user.get("cnpj_formatado") or user.get("cnpj") or ""
            session["usuario_razao_social"] = user.get("razao_social", "")
            session["data_abertura_mei"] = user.get("data_abertura", "")
            session["limite_anual_mei"] = user.get("limite_anual_mei", 81000.0)

            # Lógica Lembrar de mim
            lembrar = request.form.get("lembrar")
            if lembrar:
                session.permanent = True
            else:
                session.permanent = False

            # Verificação de status da assinatura (Admins ou contas ativas são liberadas)
            if not user.get("is_admin") and user.get("email") != "admin@datainsight.com":
                status = user.get("status_assinatura", "pendente")
                if status != "ativa":
                    return redirect(url_for("pagina_bloqueio_assinatura", motivo=status))

            return redirect(url_for("pagina_home"))

        return render_template("login.html", error=True, msg="Email ou senha inválidos")

    return render_template("login.html")


# ==============================================================================
# 6. ALTERNAR PERFIL MEI / ME
# ==============================================================================

def alternar_perfil():
    """Permite ao usuário alternar instantaneamente entre os perfis MEI e ME."""
    usuario_id = session.get("usuario_id")
    if not usuario_id:
        return jsonify({"sucesso": False, "mensagem": "Não autenticado"}), 401

    payload = request.get_json() or {}
    novo_perfil = payload.get("tipo_perfil", "").strip().upper()
    if novo_perfil not in ["MEI", "ME"]:
        # Se não especificou, inverte o perfil atual
        atual = session.get("usuario_perfil", "ME")
        novo_perfil = "MEI" if atual == "ME" else "ME"

    try:
        usuario.update_one(
            {"_id": ObjectId(usuario_id)},
            {
                "$set": {
                    "tipo_perfil": novo_perfil,
                    "atualizado_em": datetime.now()
                }
            }
        )
        session["usuario_perfil"] = novo_perfil
        return jsonify({
            "sucesso": True,
            "tipo_perfil": novo_perfil,
            "mensagem": f"Plano alterado com sucesso para {novo_perfil}!"
        }), 200
    except Exception as e:
        print(f"[Erro] Falha ao alternar perfil: {e}")
        return jsonify({"sucesso": False, "mensagem": "Erro ao atualizar perfil."}), 500


# ==============================================================================
# 7. RECUPERAÇÃO DE SENHA
# ==============================================================================

# ------------------------------------------------------------------------------
# 7.1. Esqueceu senha — solicita o código
# ------------------------------------------------------------------------------

def esqueceu_senha():

    if request.method == "POST":
        email = request.form.get("email", "").strip()

        if not email:
            return jsonify({"sucesso": False, "mensagem": "Digite seu email"}), 400

        if not validar_email(email):
            return jsonify({"sucesso": False, "mensagem": "Email inválido"}), 400

        user = usuario.find_one({"email": email})

        # Resposta genérica por segurança (não vaza existência do e-mail)
        if not user:
            return jsonify({
                "sucesso": True,
                "mensagem": "Se existir, você receberá um código",
                "redirect_url": url_for("verificar_codigo_route")
            })

        codigo = str(secrets.randbelow(1000000)).zfill(6)

        usuario.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "codigo_recuperacao": codigo,
                    "codigo_expiracao": datetime.now() + timedelta(minutes=10)
                }
            }
        )

        session["email_recuperacao"] = email

        sucesso_envio = enviar_email_codigo(email, codigo)

        if not sucesso_envio:
            return jsonify({"sucesso": False, "mensagem": "Erro ao enviar email. Tente novamente."}), 500

        return jsonify({
            "sucesso": True,
            "mensagem": "Código enviado para seu email!",
            "redirect_url": url_for("verificar_codigo_route")
        })

    return render_template("esqueceu_senha.html")


# ------------------------------------------------------------------------------
# 7.2. Verificar código
# ------------------------------------------------------------------------------

def verificar_codigo():

    if request.method == "POST":
        codigo = request.form.get("codigo", "").strip()
        email = session.get("email_recuperacao")

        if not codigo:
            return render_template("verificar_codigo.html", erro="Digite o código")

        if not email:
            return redirect(url_for("esqueceu_senha_route"))

        user = usuario.find_one({"email": email})

        if not user:
            return redirect(url_for("esqueceu_senha_route"))

        if datetime.now() > user.get("codigo_expiracao"):
            return render_template("verificar_codigo.html", erro="Código expirado")

        if codigo != user.get("codigo_recuperacao"):
            return render_template("verificar_codigo.html", erro="Código incorreto")

        session["codigo_verificado"] = True

        return redirect(url_for("resetar_senha_route"))

    return render_template("verificar_codigo.html")


# ------------------------------------------------------------------------------
# 7.3. Resetar senha
# ------------------------------------------------------------------------------

def resetar_senha():

    if not session.get("codigo_verificado"):
        return redirect(url_for('esqueceu_senha_route'))

    if request.method == "POST":
        senha = request.form.get("nova_senha", "").strip()
        confirmar = request.form.get("confirmar_senha", "").strip()

        if not senha or not confirmar:
            return render_template("redefinir_senha.html", erro=True, msg="Preencha todos os campos")

        if senha != confirmar:
            return render_template("redefinir_senha.html", erro=True, msg="As senhas não coincidem")

        valido, msg = validar_senha(senha)
        if not valido:
            return render_template("redefinir_senha.html", erro=True, msg=msg)

        email = session.get("email_recuperacao")

        if not email:
            return redirect(url_for('esqueceu_senha_route'))

        user = usuario.find_one({"email": email})

        if not user:
            return redirect(url_for('esqueceu_senha_route'))

        senha_hash = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt())

        usuario.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"senha": senha_hash},
                "$unset": {
                    "codigo_recuperacao": "",
                    "codigo_expiracao": ""
                }
            }
        )

        session.clear()

        return redirect(url_for("pagina_login"))

    return render_template("redefinir_senha.html")


# ------------------------------------------------------------------------------
# 7.4. Reenviar código
# ------------------------------------------------------------------------------

def reenviar_codigo():
    email = session.get("email_recuperacao")

    if not email:
        return redirect(url_for('esqueceu_senha_route'))

    user = usuario.find_one({"email": email})

    if not user:
        return redirect(url_for('esqueceu_senha_route'))

    codigo = user.get("codigo_recuperacao")

    # Se por algum motivo não existir código, gera um novo com expiração
    if not codigo:
        codigo = str(secrets.randbelow(1000000)).zfill(6)
        usuario.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "codigo_recuperacao": codigo,
                    "codigo_expiracao": datetime.now() + timedelta(minutes=10)
                }
            }
        )

    sucesso = enviar_email_codigo(email, codigo)

    if sucesso:
        return render_template(
            "verificar_codigo.html",
            sucesso=True,
            msg="Um novo código foi enviado para seu e-mail!"
        )
    else:
        return render_template(
            "verificar_codigo.html",
            erro=True,
            msg="Erro ao reenviar código. Tente novamente."
        )