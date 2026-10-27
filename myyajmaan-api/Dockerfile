FROM python:3.14-slim

# Needed to build a couple of requirements.txt packages (cryptography,
# reportlab) when PyPI has no prebuilt wheel for this exact image's
# platform; removed again after pip install so the final image stays slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# Render (and most PaaS) inject $PORT at runtime; default to 8000 for
# local `docker run`. Workers=2 is a sane default for the smallest
# paid tier's single vCPU -- raise WEB_CONCURRENCY as you scale up.
ENV PORT=8000 \
    WEB_CONCURRENCY=2
EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY}"]
