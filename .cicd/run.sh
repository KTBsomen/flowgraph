#!/bin/bash
# .cicd/run.sh - Script to start server and worker on Ubuntu using PM2

set -e

echo "=== Starting Applications with & ==="

# 1. Ensure Bun path is loaded
BUN_PATH=$(command -v bun || echo "$HOME/.bun/bin/bun" || echo "/root/.bun/bin/bun" || echo "/usr/local/bin/bun")
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
if [ -d "/root/.bun" ]; then
    export BUN_INSTALL="/root/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# # 2. Ensure PM2 is installed
# if ! command -v pm2 &> /dev/null; then
#     echo "PM2 is not installed. Installing PM2 globally via Bun..."
#     "$BUN_PATH" install -g pm2
# else
#     echo "PM2 is already installed."
# fi

# 2. Start applications using the ecosystem config
echo "Starting backend and worker via PM2..."
if [ "$CICD_SERVICE_NAME" = "flowgraph-backend" ]; then
    $BUN_PATH run server/server.js &
fi
if [ "$CICD_SERVICE_NAME" = "flowgraph-worker" ]; then
    $BUN_PATH run server/engine/run-worker.js &
fi


# 3. Configure startup and save state

echo "To configure PM2 to start on boot, run:"
echo "pm2 startup"
echo "=== PM2 Deployment Execution Finished ==="
