from flask import render_template, request, redirect, session, url_for, jsonify, current_app
from flask_mail import Message
import bcrypt
from .db import usuario
import re
import secrets
from datetime import datetime, timedelta


def enviar_email_codigo(destinatario, codigo):
    """Envia o código de recuperação por email"""
    try:
        # Usar a instância de Mail armazenada no app
        mail = current_app.mail
        if not mail:
            print("✗ Flask-Mail não está inicializado")
            return False

        sender = current_app.config.get('MAIL_USERNAME')

        msg = Message(
            subject="Código de recuperação - DataInsight",
            sender=sender,
            recipients=[destinatario]
        )

        msg.body = f"""
Recuperação de Senha

Recebemos uma solicitação para redefinir sua senha.

Seu código de verificação: {codigo}

Este código expira em 10 minutos.

Se você não solicitou isso, ignore este email.

DataInsight © 2026
        """

        msg.html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Recuperação de Senha</h2>
            <p style="font-size: 16px; color: #555;">Recebemos uma solicitação para redefinir sua senha.</p>
            <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <p style="color: #999; font-size: 12px;">Seu código de verificação:</p>
                <h1 style="color: #007bff; letter-spacing: 2px; margin: 10px 0;">{codigo}</h1>
            </div>
            <p style="font-size: 14px; color: #999;">Este código expira em <strong>10 minutos</strong>.</p>
            <p style="font-size: 14px; color: #999;">Se você não solicitou isso, ignore este email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">DataInsight © 2026</p>
        </div>
        """

        mail.send(msg)
        print(f"✓ Email enviado para {destinatario}")
        return True

    except Exception as e:
        print(f"✗ Erro ao enviar email: {e}")
        import traceback
        traceback.print_exc()
        return False


# =================== VALIDAÇÕES ===================

def validar_email(email):
    padrao = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(padrao, email) is not None


def validar_senha(senha):
    if len(senha) < 8:
        return False, "A senha deve ter no mínimo 8 caracteres"
    return True, ""


# =================== CADASTRO ===================

def tela_cadastro():
    if request.method == "POST":

        nome = request.form.get("nome", "").strip()
        email = request.form.get("email", "").strip()
        senha = request.form.get("senha", "")
        confirmar = request.form.get("confirmar", "")

        if not nome or not email or not senha or not confirmar:
            return render_template("cadastro.html", error_cad=True, msg="Todos os campos são obrigatórios")

        if not validar_email(email):
            return render_template("cadastro.html", error_cad=True, msg="Email inválido")

        valido, msg = validar_senha(senha)
        if not valido:
            return render_template("cadastro.html", error_cad=True, msg=msg)

        if senha != confirmar:
            return render_template("cadastro.html", error_cad=True, msg="As senhas não coincidem")

        if usuario.find_one({"email": email}):
            return render_template("cadastro.html", error_cad=True, msg="Email já cadastrado")

        senha_hash = bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt())

        usuario.insert_one({
            "nome": nome,
            "email": email,
            "senha": senha_hash
        })

        return redirect(url_for("pagina_login"))

    return render_template("cadastro.html")


# =================== LOGIN ===================

def login():
    if request.method == "POST":

        email = request.form.get("email", "").strip()
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
            
            # Lógica Lembrar de mim
            lembrar = request.form.get("lembrar")
            if lembrar:
                session.permanent = True
            else:
                session.permanent = False
                
            return redirect(url_for("pagina_home"))

        return render_template("login.html", error=True, msg="Email ou senha inválidos")

    return render_template("login.html")


# =================== ESQUECEU SENHA ===================

def esqueceu_senha():

    if request.method == "POST":
        email = request.form.get("email", "").strip()

        if not email:
            return jsonify({"sucesso": False, "mensagem": "Digite seu email"}), 400

        if not validar_email(email):
            return jsonify({"sucesso": False, "mensagem": "Email inválido"}), 400

        user = usuario.find_one({"email": email})

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


# =================== VERIFICAR CÓDIGO ===================

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


# =================== RESETAR SENHA ===================

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


# =================== REENVIAR CÓDIGO ===================

def reenviar_codigo():
    email = session.get("email_recuperacao")

    if not email:
        return redirect(url_for('esqueceu_senha_route'))

    user = usuario.find_one({"email": email})

    if not user:
        return redirect(url_for('esqueceu_senha_route'))

    codigo = user.get("codigo_recuperacao")

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
        return render_template("verificar_codigo.html", sucesso=True, msg="Um novo código foi enviado para seu e-mail!")
    else:
        return render_template("verificar_codigo.html", erro=True, msg="Erro ao reenviar código. Tente novamente.")