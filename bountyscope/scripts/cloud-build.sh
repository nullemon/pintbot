#!/usr/bin/env bash
# Optional cloud fallback when build-container DNS is unavailable. All packages
# are retrieved by normal TLS-verified package managers on the host first.
set -euo pipefail
cd "$(dirname "$0")/.."
export npm_config_cache="${npm_config_cache:-/tmp/bountyscope-npm-cache}"
export DOCKER_CONFIG="${DOCKER_CONFIG:-/tmp/bountyscope-docker}"
build_dir=$(mktemp -d /tmp/bountyscope-build.XXXXXX)
trap 'rm -rf "$build_dir"' EXIT
if [ "${1:-}" != "--frontend-prebuilt" ]; then
mkdir -p "$build_dir/backend/wheels" "$build_dir/fixture/wheels"
.venv/bin/python -m pip download --only-binary=:all: -r backend/requirements.lock -d "$build_dir/backend/wheels"
cp -R backend/app backend/alembic backend/alembic.ini backend/requirements.txt backend/requirements.lock "$build_dir/backend/"
cat > "$build_dir/backend/Dockerfile" <<'DOCKER'
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY wheels /wheels
COPY requirements.lock .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.lock && rm -rf /wheels && useradd --create-home app
COPY --chown=app:app app ./app
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app alembic.ini .
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
DOCKER
.venv/bin/python -m pip download --only-binary=:all: -r fixture/requirements.lock -d "$build_dir/fixture/wheels"
cp fixture/app.py fixture/requirements.txt fixture/requirements.lock "$build_dir/fixture/"
cat > "$build_dir/fixture/Dockerfile" <<'DOCKER'
FROM python:3.12-slim
WORKDIR /app
COPY wheels /wheels
COPY requirements.lock .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.lock && rm -rf /wheels && useradd --create-home fixture
COPY --chown=fixture:fixture app.py .
USER fixture
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
DOCKER
docker build -t bountyscope-api "$build_dir/backend"
docker tag bountyscope-api bountyscope-worker
docker build -t bountyscope-fixture "$build_dir/fixture"
if [ "${1:-}" = "--backend-only" ]; then exit 0; fi
fi
if [ "${1:-}" != "--frontend-prebuilt" ]; then
  (cd frontend && npm ci && npm run build)
fi
mkdir -p "$build_dir/frontend"
cp -R frontend/.next/standalone/. "$build_dir/frontend/"
mkdir -p "$build_dir/frontend/.next/static"
cp -R frontend/.next/static/. "$build_dir/frontend/.next/static/"
if [ -d frontend/public ]; then cp -R frontend/public "$build_dir/frontend/"; fi
cat > "$build_dir/frontend/Dockerfile" <<'DOCKER'
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --chown=node:node . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]
DOCKER
docker build -t bountyscope-frontend "$build_dir/frontend"
