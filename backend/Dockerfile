FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.lock ./
RUN pip install -r requirements.lock
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY scripts/start_hosted.py ./scripts/start_hosted.py
RUN useradd --create-home appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8000
CMD ["python", "scripts/start_hosted.py"]
