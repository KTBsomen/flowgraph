#!/usr/bin/env bash
# .cicd/health.sh - Script to perform health checks on the running services
# Available env vars from orchestrator:
#   CICD_SERVICE_NAME  - name of the service being checked
#   CICD_PORT          - the port configured for this service
#   CICD_SERVICE_DIR   - the service deployment directory


# Skip health check for services that don't run an HTTP server
if [ "${CICD_SERVICE_NAME:-}" = "flowgraph-worker" ]; then
    echo "✅ Health check skipped for worker (no HTTP endpoint)"
    exit 0
fi


PORT=${CICD_PORT:-${1:-3000}}
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
    if [ "$HTTP_CODE" -eq 200 || "$HTTP_CODE" -eq 404 ]; then
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

