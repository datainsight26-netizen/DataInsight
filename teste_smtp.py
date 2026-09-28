import os
import smtplib
from dotenv import load_dotenv

load_dotenv()

email = os.getenv("EMAIL_USER")
senha = os.getenv("EMAIL_PASS")

print("Email:", email)
print("Senha carregada:", bool(senha))

smtp = smtplib.SMTP("smtp.gmail.com", 587, timeout=20)
smtp.set_debuglevel(1)

smtp.ehlo()
smtp.starttls()
smtp.ehlo()

smtp.login(email, senha)

print("LOGIN SMTP OK")

smtp.quit()