# ============================================================
#  DataInsight — Dockerfile
#  Base: Python 3.11 slim (leve e segura)
# ============================================================

# 1. Imagem base
FROM python:3.11-slim

# 2. Variáveis de ambiente — evitam ficheiros .pyc e buffering no log
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 3. Directório de trabalho dentro do container
WORKDIR /app

# 4. Dependências do sistema (necessárias para algumas libs Python)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 5. Instalar dependências Python ANTES de copiar o código
#    (aproveita a cache do Docker — se requirements.txt não mudar, esta camada fica em cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Instalar Gunicorn (servidor WSGI para produção — melhor que flask run)
RUN pip install --no-cache-dir gunicorn

# 7. Copiar o código da aplicação para o container
COPY . .

# 8. Criar a pasta uploads (necessária para o upload de CSVs)
RUN mkdir -p uploads

# 9. Expor a porta 5000 (porta padrão do Flask / Gunicorn)
EXPOSE 5000

# 10. Comando de arranque — Gunicorn com 2 workers
#     app:app  →  ficheiro app.py, variável app (Flask instance)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "120", "app:app"]
