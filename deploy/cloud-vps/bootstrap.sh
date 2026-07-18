#!/usr/bin/env bash
# Bootstrap Ubuntu/Debian for deploy target cloud-vps.
# Run as a sudo-capable user on a fresh VPS. Does NOT clone secrets or migrate Win11 data.
#
# Usage:
#   curl -fsSL … | bash   # or
#   bash deploy/cloud-vps/bootstrap.sh
#
# After this script: clone/pull repo, docker compose up, fill env/cloud-vps/.env,
# migrate, build, install systemd + Caddyfile. See docs/ops/cloud-vps.md.

set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as a normal user with sudo, not as root."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

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
  sudo usermod -aG docker "$USER"
  echo "Added $USER to docker group (re-login required for docker without sudo)."
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

echo "==> Optional system user for the app"
if ! id -u xtch >/dev/null 2>&1; then
  sudo useradd --system --create-home --home-dir /opt/xtch-web-portal --shell /usr/sbin/nologin xtch || true
fi

cat <<'EOF'

Bootstrap finished.

Next (see docs/ops/cloud-vps.md):
  1. DNS A → this VPS public IP; security group: 80/443 only (not 5432/9000/9001/3000)
  2. Clone into /opt/xtch-web-portal (or edit xtch-app.service WorkingDirectory)
       sudo mkdir -p /opt && sudo chown "$USER:$USER" /opt
       git clone <YOUR_REPO_URL> /opt/xtch-web-portal
  3. cd /opt/xtch-web-portal && docker compose up -d  # then change default passwords
  4. cp env/cloud-vps/.env.example env/cloud-vps/.env  # fill YOUR_DOMAIN + secrets
  5. cd app && npm install && npm run db:migrate:cloud-vps && npm run build:cloud-vps
  6. Install systemd: sudo cp ../deploy/cloud-vps/xtch-app.service /etc/systemd/system/
       (fix paths/User if needed) && sudo systemctl enable --now xtch-app
  7. Point Caddy at deploy/cloud-vps/Caddyfile (replace YOUR_DOMAIN), reload Caddy
  8. Accept checklist in docs/ops/cloud-vps.md, then cut DNS from Win11

If you were added to the docker group, log out and back in before docker compose.
EOF
