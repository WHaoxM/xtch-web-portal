#!/usr/bin/env bash
# Bootstrap Ubuntu/Debian for deploy target cloud-vps.
# Run as a sudo-capable user on a fresh VPS. Does NOT clone secrets or migrate Win11 data.
#
# Usage:
#   curl -fsSL … | bash   # or
#   bash deploy/cloud-vps/bootstrap.sh
#
# Layout (no path collision):
#   /var/lib/xtch          — system user home (nologin); npm cache / runtime writable
#   /opt/xtch-web-portal   — git clone; owned by the sudo-capable deploy user for pull/build
#   systemd User=xtch      — read-only access to the repo; listens 127.0.0.1:3080 only
#
# After this script: clone/pull repo, fill compose .env + env/cloud-vps/.env,
# docker compose up, migrate, build, install systemd + Caddyfile.
# See docs/ops/cloud-vps.md.

set -euo pipefail

XTCH_SYSTEM_HOME="/var/lib/xtch"
XTCH_REPO_DIR="/opt/xtch-web-portal"
XTCH_USER="xtch"
XTCH_GROUP="xtch"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as a normal user with sudo, not as root."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

DEPLOY_USER="$USER"

echo "==> Updating apt and installing base packages"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg ufw git

echo "==> Docker Engine (official apt repo)"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo usermod -aG docker "$DEPLOY_USER"
  echo "Added $DEPLOY_USER to docker group (re-login required for docker without sudo)."
else
  echo "Docker already installed: $(docker --version)"
fi

echo "==> Node.js 20 (NodeSource)"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node -v)  npm: $(npm -v)"

echo "==> Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
else
  echo "Caddy already installed: $(caddy version)"
fi

echo "==> Firewall (UFW): allow OpenSSH + 80/443 only"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status

echo "==> System user ${XTCH_USER} (home ${XTCH_SYSTEM_HOME}; not the repo path)"
if ! getent group "$XTCH_GROUP" >/dev/null 2>&1; then
  sudo groupadd --system "$XTCH_GROUP"
fi
if ! id -u "$XTCH_USER" >/dev/null 2>&1; then
  sudo useradd --system --gid "$XTCH_GROUP" --home-dir "$XTCH_SYSTEM_HOME" \
    --create-home --shell /usr/sbin/nologin "$XTCH_USER"
  echo "Created user ${XTCH_USER} with home ${XTCH_SYSTEM_HOME}"
else
  echo "User ${XTCH_USER} already exists — leaving account as-is (idempotent)."
  current_home="$(getent passwd "$XTCH_USER" | cut -d: -f6 || true)"
  if [[ -n "$current_home" && "$current_home" == "$XTCH_REPO_DIR" ]]; then
    echo "WARNING: ${XTCH_USER} home is still ${XTCH_REPO_DIR} (legacy bootstrap)."
    echo "         Prefer home ${XTCH_SYSTEM_HOME}. See docs/ops/cloud-vps.md migration notes."
  fi
  sudo mkdir -p "$XTCH_SYSTEM_HOME"
  sudo chown "${XTCH_USER}:${XTCH_GROUP}" "$XTCH_SYSTEM_HOME"
fi

echo "==> Repo parent directory ${XTCH_REPO_DIR} (owned by ${DEPLOY_USER} for clone/pull)"
if [[ -e "$XTCH_REPO_DIR" && ! -d "$XTCH_REPO_DIR" ]]; then
  echo "ERROR: ${XTCH_REPO_DIR} exists and is not a directory."
  exit 1
fi
if [[ ! -d "$XTCH_REPO_DIR" ]]; then
  sudo mkdir -p "$XTCH_REPO_DIR"
  sudo chown "${DEPLOY_USER}:${DEPLOY_USER}" "$XTCH_REPO_DIR"
  echo "Created empty ${XTCH_REPO_DIR} for git clone."
else
  echo "${XTCH_REPO_DIR} already exists — not modifying contents (idempotent)."
fi

cat <<EOF

Bootstrap finished.

Next (see docs/ops/cloud-vps.md):
  1. DNS A → this VPS public IP; security group: 80/443 only (not 5432/9000/9001/3080)
  2. Clone into ${XTCH_REPO_DIR} (directory prepared for ${DEPLOY_USER}):
       git clone <YOUR_REPO_URL> ${XTCH_REPO_DIR}
       # if directory is non-empty from a prior clone: cd ${XTCH_REPO_DIR} && git pull
  3. Grant the runtime user read access (deploy user keeps write for git/npm):
       sudo ./deploy/cloud-vps/grant-xtch-read-access.sh
       # or manually: chgrp -R ${XTCH_GROUP} ${XTCH_REPO_DIR} && chmod -R g+rX ${XTCH_REPO_DIR}
  4. Compose credentials (required — no defaults):
       cp ${XTCH_REPO_DIR}/.env.example ${XTCH_REPO_DIR}/.env
       # edit REPLACE_ME_* then: cd ${XTCH_REPO_DIR} && docker compose up -d
  5. cp env/cloud-vps/.env.example env/cloud-vps/.env  # fill secrets; TRUST_PROXY=1; match compose passwords
  6. cd app && npm install && npm run db:migrate:cloud-vps && npm run build:cloud-vps
  7. Install systemd: sudo cp deploy/cloud-vps/xtch-app.service /etc/systemd/system/
       sudo systemctl daemon-reload && sudo systemctl enable --now xtch-app
  8. Point Caddy at deploy/cloud-vps/Caddyfile, reload Caddy
  9. Accept checklist in docs/ops/cloud-vps.md, then cut DNS from Win11

If you were added to the docker group, log out and back in before docker compose.
EOF
