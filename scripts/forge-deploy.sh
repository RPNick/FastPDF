#!/usr/bin/env bash
# scripts/forge-deploy.sh
#
# Run on each Forge server to update the FastPDF container.
# Triggered by GitHub Actions via SSH, or run manually by the forge user.
#
# Expected on the server:
#   /home/forge/fast-pdf/docker-compose.yml
#   /home/forge/fast-pdf/.env          (mode 0600, owned by forge)
#
# Usage: bash scripts/forge-deploy.sh [IMAGE_TAG]
#   IMAGE_TAG defaults to "latest"

set -euo pipefail

DEPLOY_DIR="/home/forge/fast-pdf"
IMAGE_TAG="${1:-latest}"
DOCKER_IMAGE="${DOCKER_IMAGE:-surenick/fast-pdf}"
HEALTH_URL="http://localhost:2626/health"
HEALTH_RETRIES=10
HEALTH_SLEEP=3

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S')] $*"; }

# ── Pull ──────────────────────────────────────────────────────────────────────
log "Pulling ${DOCKER_IMAGE}:${IMAGE_TAG} …"
docker pull "${DOCKER_IMAGE}:${IMAGE_TAG}"

# Tag pulled image as latest so docker-compose always uses it
if [ "${IMAGE_TAG}" != "latest" ]; then
  docker tag "${DOCKER_IMAGE}:${IMAGE_TAG}" "${DOCKER_IMAGE}:latest"
fi

# ── Restart ───────────────────────────────────────────────────────────────────
log "Restarting container in ${DEPLOY_DIR} …"
cd "${DEPLOY_DIR}"
docker compose up -d --remove-orphans

# ── Health check ──────────────────────────────────────────────────────────────
log "Waiting for service to become healthy …"
for i in $(seq 1 "${HEALTH_RETRIES}"); do
  ret=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" || true)
  if [ "${ret}" = "200" ]; then
    log "Service is healthy (attempt ${i})"
    break
  fi
  if [ "${i}" -eq "${HEALTH_RETRIES}" ]; then
    log "ERROR: Service did not become healthy after ${HEALTH_RETRIES} attempts"
    docker compose logs --tail=50
    exit 1
  fi
  log "Not ready yet (HTTP ${ret}), retrying in ${HEALTH_SLEEP}s …"
  sleep "${HEALTH_SLEEP}"
done

# ── Cleanup ───────────────────────────────────────────────────────────────────
log "Pruning unused images …"
docker image prune -f

log "Deploy complete."
