#!/usr/bin/env bash
# .cicd/health.sh - Script to perform health checks on the running services

set -Eeuo pipefail

PORT=${1:-3000}
URL="http://localhost:${PORT}/api/usage/pricing"

echo "=== Running Health Check on Port ${PORT} ==="
echo "Target URL: ${URL}"

# Perform curl request
# -s: Silent mode
# -f: Fail silently on server errors (HTTP 4xx/5xx)
# -S: Show error message if it fails
# -o /dev/null: Discard response body
# -w "%{http_code}": Print the HTTP status code
if HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}"); then
    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "✅ Health check PASSED! Status code: ${HTTP_CODE}"
        exit 0
    else
        echo "❌ Health check FAILED! Server responded with status code: ${HTTP_CODE}"
        exit 1
    fi
else
    echo "❌ Health check FAILED! Could not connect to the port."
    exit 1
fi
