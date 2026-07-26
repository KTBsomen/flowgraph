#!/usr/bin/env bash

set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "=== Starting GetLostLeads Environment Setup ==="

########################################
# Helpers
########################################

log() {
  echo
  echo "================================="
  echo "$1"
  echo "================================="
}

########################################
# Verify sudo
########################################

if ! sudo -n true 2>/dev/null; then
  echo "This script requires sudo access."
  echo

  sudo true
fi

########################################
# Update system
########################################

log "Updating packages"

sudo apt-get update

########################################
# Install prerequisites
########################################

log "Installing prerequisites"

sudo apt-get install -y \
  curl \
  unzip \
  gnupg \
  debian-keyring \
  debian-archive-keyring \
  apt-transport-https

########################################
# Install Caddy
########################################

log "Installing Caddy"

if ! command -v caddy >/dev/null 2>&1; then
  sudo rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  sudo rm -f /etc/apt/sources.list.d/caddy-stable.list

  TMP_KEY=$(mktemp)

  curl -fsSL \
  'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  -o "$TMP_KEY"

  sudo gpg \
    --batch \
    --yes \
    --dearmor \
    -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    "$TMP_KEY"

  rm "$TMP_KEY"

  curl -fsSL \
  'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null

  sudo apt-get update

  sudo apt-get install -y caddy
else
  echo "Caddy is already installed. Skipping installation."
fi

########################################
# Configure Caddy
########################################

log "Configuring Caddy"

sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
# Main website and API configuration
getlostleads.com, www.getlostleads.com {
    handle_path /flowgraph-api/* {
        reverse_proxy localhost:3000
    }

    handle {
        reverse_proxy localhost:4000
    }
}

# Dedicated Server-Sent Events (SSE) configuration
sse.getlostleads.com {
    reverse_proxy localhost:4000 {
        # Disables response buffering so data streams immediately to the client
        flush_interval -1
    }
}

EOF

sudo systemctl enable caddy
sudo systemctl restart caddy

########################################
# Install Redis
########################################

log "Installing Redis"

if ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get install -y redis-server
else
  echo "Redis is already installed. Skipping installation."
fi

########################################
# Configure Redis
########################################

log "Configuring Redis"

sudo sed -i \
's/^appendonly no/appendonly yes/' \
/etc/redis/redis.conf

if ! grep -q "^appendonly yes" /etc/redis/redis.conf; then
  echo "appendonly yes" | sudo tee -a /etc/redis/redis.conf >/dev/null
fi

sudo systemctl enable redis-server
sudo systemctl restart redis-server

########################################
# Install Bun
########################################

log "Installing Bun"

if ! command -v bun >/dev/null 2>&1; then

  curl -fsSL https://bun.sh/install | bash

fi

export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

########################################
# Verify Bun
########################################

if ! command -v bun >/dev/null 2>&1; then

  if [ -x "$HOME/.bun/bin/bun" ]; then

      export PATH="$HOME/.bun/bin:$PATH"

  else

      echo "Bun installation failed"

      exit 1

  fi

fi

echo "Bun version:"
bun --version

########################################
# Install project dependencies
########################################

log "Installing project dependencies"

bun install

########################################
# Done
########################################

log "Setup completed"

echo "Services status"

sudo systemctl status caddy --no-pager || true

sudo systemctl status redis-server --no-pager || true

echo
echo "✅ Environment ready"