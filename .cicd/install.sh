#!/bin/bash
# .cicd/install.sh - Script to build environment and configure services on Ubuntu

set -e

echo "=== Starting Environment Setup ==="

# 1. Update APT repositories
echo "Updating package lists..."
sudo apt-get update -y

# Install common prerequisites
echo "Installing prerequisites (curl, unzip, gpg, debian-keyring)..."
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl unzip

# 2. Install Caddy
echo "Installing Caddy..."

# 1. Clean up the broken files from previous attempts
sudo rm -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo rm -f /etc/apt/sources.list.d/caddy-stable.list

# 2. Re-download and forcefully overwrite the GPG key in batch mode
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --batch --overwrite --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg

# 3. Re-add the Caddy package list
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list

# 4. Correct permissions
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list

# 5. Sync and install
sudo apt update
sudo apt install -y caddy

# 3. Setup Caddy reverse proxy for getlostleads.com -> localhost:4000
echo "Configuring Caddy reverse proxy..."
sudo tee /etc/caddy/Caddyfile << 'EOF'
getlostleads.com {
    reverse_proxy localhost:4000
}
EOF

# Restart and enable Caddy service
echo "Starting and enabling Caddy systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl restart caddy

# 4. Install and configure Redis
echo "Installing Redis..."
sudo apt-get install -y redis-server

echo "Configuring Redis appendonly mode..."
# Enable AOF (Append Only File) persistence
sudo sed -i 's/^appendonly no/appendonly yes/g' /etc/redis/redis.conf
if ! grep -q "^appendonly yes" /etc/redis/redis.conf; then
    echo "appendonly yes" | sudo tee -a /etc/redis/redis.conf
fi

echo "Starting and enabling Redis systemd service..."
sudo systemctl enable redis-server
sudo systemctl restart redis-server

# 5. Install Bun and check PATH
echo "Checking for Bun installation..."
if ! command -v bun &> /dev/null; then
    echo "Bun not found. Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    # Export paths for current shell context
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # Also attempt root backup path in case of sudo execution
    if [ -d "/root/.bun" ]; then
        export BUN_INSTALL="/root/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
    fi
else
    echo "Bun is already installed."
fi

# Double check Bun is in PATH now
BUN_PATH=$(command -v bun || echo "$HOME/.bun/bin/bun" || echo "/root/.bun/bin/bun" || echo "/usr/local/bin/bun")
echo "Bun path: $BUN_PATH"

# 6. Run bun install in the project root
echo "Running bun install..."
"$BUN_PATH" install

echo "=== Environment Setup Completed Successfully ==="

