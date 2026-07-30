#!/usr/bin/env bash
# Deploy / rebuild cloud-vps from git main after production gates pass.
#
# CD default (GitHub Actions on push to main):
#   --with-lint --with-migrate  (+ restart + health check)
#
# Usage (deploy user with sudo, NOT root, NOT systemd User=xtch):
#   bash deploy/cloud-vps/deploy-from-main.sh --with-lint --with-migrate
#   bash deploy/cloud-vps/deploy-from-main.sh --no-restart   # build only
#   bash deploy/cloud-vps/deploy-from-main.sh --with-unit-tests
#
# Env overrides:
#   XTCH_REPO_DIR=/opt/xtch-web-portal
#   XTCH_BRANCH=main
#   XTCH_HEALTH_URL=http://127.0.0.1:3080/
#   XTCH_DIST_BACKUP=$HOME/xtch-dist-backup/cloud-vps
#
# See docs/ops/cloud-vps.md § 自动发布.

set -euo pipefail

XTCH_REPO_DIR="${XTCH_REPO_DIR:-/opt/xtch-web-portal}"
XTCH_BRANCH="${XTCH_BRANCH:-main}"
XTCH_HEALTH_URL="${XTCH_HEALTH_URL:-http://127.0.0.1:3080/}"
XTCH_API_HEALTH_URL="${XTCH_API_HEALTH_URL:-http://127.0.0.1:3080/api/routes}"
XTCH_DIST_BACKUP="${XTCH_DIST_BACKUP:-$HOME/xtch-dist-backup/cloud-vps}"
XTCH_SERVICE="${XTCH_SERVICE:-xtch-app}"

WITH_MIGRATE=0
WITH_LINT=0
WITH_UNIT_TESTS=0
NO_RESTART=0
SKIP_PULL=0

usage() {
  sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-migrate) WITH_MIGRATE=1 ;;
    --with-lint) WITH_LINT=1 ;;
    --with-unit-tests) WITH_UNIT_TESTS=1 ;;
    --no-restart) NO_RESTART=1 ;;
    --skip-pull) SKIP_PULL=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as the deploy user with sudo available, not as root."
  exit 1
fi

if [[ ! -d "$XTCH_REPO_DIR/.git" ]]; then
  echo "ERROR: not a git repo: ${XTCH_REPO_DIR}"
  exit 1
fi

cd "$XTCH_REPO_DIR"

log() { printf '\n==> %s\n' "$*"; }

log "Repo ${XTCH_REPO_DIR} @ ${XTCH_BRANCH}"

if [[ "$SKIP_PULL" -eq 0 ]]; then
  log "Fetch and fast-forward ${XTCH_BRANCH}"
  git fetch origin "${XTCH_BRANCH}"
  # Refuse dirty tree so CD does not mix local edits into production builds.
  if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: working tree is dirty. Commit/stash on the deploy user, or fix the host."
    git status --porcelain
    exit 1
  fi
  git checkout "${XTCH_BRANCH}"
  git merge --ff-only "origin/${XTCH_BRANCH}"
fi

git rev-parse --short HEAD
git log -1 --oneline

log "npm ci (app/)"
cd app
npm ci

log "Production env gate (cloud-vps)"
npx tsx ../scripts/env/check-target-env.ts cloud-vps

if [[ "$WITH_LINT" -eq 1 ]]; then
  log "lint"
  npm run lint
fi

if [[ "$WITH_UNIT_TESTS" -eq 1 ]]; then
  log "unit tests (s3 + admin-allowlist)"
  npm run test:s3
  npm run test:admin-allowlist
fi

if [[ "$WITH_MIGRATE" -eq 1 ]]; then
  log "db:migrate:cloud-vps"
  npm run db:migrate:cloud-vps
fi

DIST_DIR="${XTCH_REPO_DIR}/app/dist/cloud-vps"
if [[ -d "$DIST_DIR" ]]; then
  log "Backup current dist → ${XTCH_DIST_BACKUP}"
  mkdir -p "$(dirname "$XTCH_DIST_BACKUP")"
  rm -rf "${XTCH_DIST_BACKUP}.tmp"
  cp -a "$DIST_DIR" "${XTCH_DIST_BACKUP}.tmp"
  rm -rf "$XTCH_DIST_BACKUP"
  mv "${XTCH_DIST_BACKUP}.tmp" "$XTCH_DIST_BACKUP"
fi

# build:cloud-vps ends with Playwright prerender; browsers are not in npm ci.
log "Ensure Playwright Chromium (prerender)"
npx playwright install chromium

log "build:cloud-vps"
npm run build:cloud-vps

cd "$XTCH_REPO_DIR"
log "grant-xtch-read-access"
bash deploy/cloud-vps/grant-xtch-read-access.sh

if [[ "$NO_RESTART" -eq 1 ]]; then
  log "Skipping restart (--no-restart). Dist built; start/restart ${XTCH_SERVICE} when ready."
  exit 0
fi

log "Restart ${XTCH_SERVICE}"
sudo systemctl restart "$XTCH_SERVICE"
sleep 3
sudo systemctl --no-pager --full status "$XTCH_SERVICE" | head -n 20

health_ok=0
for i in 1 2 3 4 5 6 7 8; do
  if curl -fsS -o /dev/null --max-time 5 "$XTCH_HEALTH_URL" \
    && curl -fsS -o /dev/null --max-time 5 "$XTCH_API_HEALTH_URL"; then
    health_ok=1
    break
  fi
  sleep 2
done

if [[ "$health_ok" -ne 1 ]]; then
  echo "ERROR: health check failed after restart (${XTCH_HEALTH_URL} / ${XTCH_API_HEALTH_URL})"
  if [[ -d "$XTCH_DIST_BACKUP" ]]; then
    log "Restoring previous dist from backup"
    rm -rf "$DIST_DIR"
    cp -a "$XTCH_DIST_BACKUP" "$DIST_DIR"
    bash deploy/cloud-vps/grant-xtch-read-access.sh
    sudo systemctl restart "$XTCH_SERVICE"
  fi
  exit 1
fi

log "Deploy OK ($(git -C "$XTCH_REPO_DIR" rev-parse --short HEAD))"
