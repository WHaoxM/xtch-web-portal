#!/usr/bin/env bash
# Grant the xtch systemd user read (+traverse) on the repo without giving write.
# Run as the deploy user (with sudo) after clone/pull/build under /opt/xtch-web-portal.
#
# Write for git/npm stays with the deploy user (file owner). Runtime user xtch
# only needs to read dist, node_modules, env/cloud-vps/.env, and scripts.

set -euo pipefail

XTCH_REPO_DIR="${XTCH_REPO_DIR:-/opt/xtch-web-portal}"
XTCH_GROUP="${XTCH_GROUP:-xtch}"
ENV_FILE="${XTCH_REPO_DIR}/env/cloud-vps/.env"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as the deploy user with sudo available, not as root."
  exit 1
fi

if [[ ! -d "$XTCH_REPO_DIR" ]]; then
  echo "ERROR: repo directory missing: ${XTCH_REPO_DIR}"
  exit 1
fi

if ! getent group "$XTCH_GROUP" >/dev/null 2>&1; then
  echo "ERROR: group ${XTCH_GROUP} missing — run bootstrap.sh first."
  exit 1
fi

echo "==> Group-read on ${XTCH_REPO_DIR} for ${XTCH_GROUP}"
sudo chgrp -R "$XTCH_GROUP" "$XTCH_REPO_DIR"
sudo chmod -R g+rX "$XTCH_REPO_DIR"

# Keep env secrets out of world-readable; group xtch may read.
if [[ -f "$ENV_FILE" ]]; then
  sudo chgrp "$XTCH_GROUP" "$ENV_FILE"
  sudo chmod 640 "$ENV_FILE"
  echo "==> Locked ${ENV_FILE} to mode 640 (owner + ${XTCH_GROUP})"
fi

# Compose root .env also holds DB/MinIO secrets
if [[ -f "${XTCH_REPO_DIR}/.env" ]]; then
  sudo chgrp "$XTCH_GROUP" "${XTCH_REPO_DIR}/.env"
  sudo chmod 640 "${XTCH_REPO_DIR}/.env"
  echo "==> Locked ${XTCH_REPO_DIR}/.env to mode 640"
fi

echo "Done. xtch can read the tree; deploy user retains ownership for git/npm writes."
