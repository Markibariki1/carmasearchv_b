#!/bin/bash
# CARMA Valuation API Deployment Script
# Deploys the valuation service to a separate Azure Container App

set -e  # Exit on error

echo "CARMA Valuation API Deployment Script"
echo "======================================"
echo ""

# Configuration
VERSION="v1.0-$(date +%s)"
IMAGE_NAME="carma-valuation-api"
REGISTRY="carmaregistry.azurecr.io"
CONTAINER_APP="carma-valuation-api"
RESOURCE_GROUP="carma"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}Step $1: $2${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
    exit 1
}

# --- Main Deployment Steps ---

print_step "0" "Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker Desktop."
fi
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it."
fi
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI. Please run 'az login'."
fi
print_success "Prerequisites check passed"

print_step "1" "Building Docker image (linux/amd64)..."
cd "$(dirname "$0")"
docker build --platform linux/amd64 \
  -f Dockerfile.valuation \
  -t ${IMAGE_NAME}:latest \
  .
print_success "Docker image built successfully"

print_step "2" "Tagging image for Azure Container Registry..."
docker tag ${IMAGE_NAME}:latest ${REGISTRY}/${IMAGE_NAME}:${VERSION}
print_success "Image tagged: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"

print_step "3" "Logging in to Azure Container Registry..."
az acr login --name $(echo ${REGISTRY} | cut -d'.' -f1)
print_success "Logged in to ${REGISTRY}"

print_step "4" "Pushing image to registry..."
docker push ${REGISTRY}/${IMAGE_NAME}:${VERSION}
print_success "Image pushed to registry"

print_step "5" "Updating Azure Container App..."
# Check if the Container App exists
if az containerapp show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} &>/dev/null; then
    az containerapp update \
      --name ${CONTAINER_APP} \
      --resource-group ${RESOURCE_GROUP} \
      --image ${REGISTRY}/${IMAGE_NAME}:${VERSION}
    print_success "Container App updated"
else
    print_warning "Container App '${CONTAINER_APP}' does not exist yet."
    echo "Create it with:"
    echo ""
    echo "  az containerapp create \\"
    echo "    --name ${CONTAINER_APP} \\"
    echo "    --resource-group ${RESOURCE_GROUP} \\"
    echo "    --environment <your-managed-environment> \\"
    echo "    --image ${REGISTRY}/${IMAGE_NAME}:${VERSION} \\"
    echo "    --target-port 8000 \\"
    echo "    --ingress external \\"
    echo "    --min-replicas 0 \\"
    echo "    --max-replicas 2 \\"
    echo "    --cpu 0.5 --memory 1Gi \\"
    echo "    --registry-server ${REGISTRY}"
    echo ""
    echo "Then set env vars for DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME"
    exit 0
fi

print_step "6" "Waiting for deployment (35 seconds)..."
sleep 35

print_step "7" "Verifying deployment..."
# Get the Container App URL
API_URL=$(az containerapp show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --query 'properties.configuration.ingress.fqdn' -o tsv 2>/dev/null)
if [ -n "$API_URL" ]; then
    API_URL="https://${API_URL}"
    HEALTH_CHECK_RESPONSE=$(curl -s ${API_URL}/health || echo "")
    if echo "${HEALTH_CHECK_RESPONSE}" | grep -q '"status": "healthy"'; then
        print_success "Valuation API is healthy!"
        echo "${HEALTH_CHECK_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${HEALTH_CHECK_RESPONSE}"
    else
        print_warning "Health check returned unexpected response."
        echo "Response: ${HEALTH_CHECK_RESPONSE}"
    fi
else
    print_warning "Could not determine Container App URL."
fi

echo ""
print_success "Deployment complete!"
echo ""
echo "Deployment Summary:"
echo "  Version: ${VERSION}"
echo "  Image: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo ""
echo "View logs:"
echo "  az containerapp logs show --name ${CONTAINER_APP} --resource-group ${RESOURCE_GROUP} --follow"
