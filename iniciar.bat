@echo off
cd /d %~dp0

echo ============================
echo Iniciando projeto...
echo ============================

REM Verifica se o venv existe
if not exist venv (
    echo [INFO] Ambiente virtual nao encontrado. Criando...
    python -m venv venv
)

REM Ativa o ambiente (funciona no .bat independente de quem chamou)
call venv\Scripts\activate.bat

REM Verifica se existe requirements.txt
if exist requirements.txt (
    echo [INFO] Instalando dependencias...
    pip install -r requirements.txt
)

REM Executa usando o python do proprio venv (mais seguro)
echo [INFO] Executando app.py...
venv\Scripts\python app.py

echo ============================
echo Execucao finalizada
echo ============================
pause