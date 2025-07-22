#!/bin/bash

# Test script for Change Reel Docker configuration
# Tests Docker build, run, and health check functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="change-reel"
CONTAINER_NAME="change-reel-test"
PORT=3000
TEST_TAG="test"

echo -e "${BLUE}=== Change Reel Docker Test Suite ===${NC}"

# Function to cleanup containers
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
}

# Trap cleanup on exit
trap cleanup EXIT

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    echo "Please install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo "Please start Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✓ Docker is available${NC}"

# Test 1: Build the Docker image
echo -e "\n${BLUE}Test 1: Building Docker image...${NC}"
if docker build -t "${IMAGE_NAME}:${TEST_TAG}" .; then
    echo -e "${GREEN}✓ Docker build successful${NC}"
else
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Test 2: Check image size
echo -e "\n${BLUE}Test 2: Checking image size...${NC}"
IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${TEST_TAG}" --format "table {{.Size}}" | tail -n 1)
echo -e "${GREEN}✓ Image size: ${IMAGE_SIZE}${NC}"

# Test 3: Run container
echo -e "\n${BLUE}Test 3: Starting container...${NC}"
if docker run -d --name "$CONTAINER_NAME" -p "${PORT}:${PORT}" "${IMAGE_NAME}:${TEST_TAG}"; then
    echo -e "${GREEN}✓ Container started successfully${NC}"
else
    echo -e "${RED}✗ Failed to start container${NC}"
    exit 1
fi

# Wait for container to be ready
echo -e "\n${BLUE}Waiting for container to be ready...${NC}"
sleep 10

# Test 4: Health check endpoint
echo -e "\n${BLUE}Test 4: Testing health check endpoint...${NC}"
if curl -f "http://localhost:${PORT}/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check endpoint responding${NC}"
    curl -s "http://localhost:${PORT}/api/health" | jq '.' || echo "Health check response received"
else
    echo -e "${RED}✗ Health check endpoint not responding${NC}"
    echo "Container logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

# Test 5: Docker health check
echo -e "\n${BLUE}Test 5: Testing Docker health check...${NC}"
sleep 5  # Wait for health check to run
HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "none")
if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Docker health check passing${NC}"
elif [ "$HEALTH_STATUS" = "starting" ]; then
    echo -e "${YELLOW}⚠ Docker health check still starting (this is normal)${NC}"
else
    echo -e "${YELLOW}⚠ Docker health check status: $HEALTH_STATUS${NC}"
fi

# Test 6: Check container logs
echo -e "\n${BLUE}Test 6: Checking container logs...${NC}"
if docker logs "$CONTAINER_NAME" | grep -q "Ready"; then
    echo -e "${GREEN}✓ Container logs show application ready${NC}"
else
    echo -e "${YELLOW}⚠ Application ready message not found in logs${NC}"
    echo "Recent logs:"
    docker logs --tail 10 "$CONTAINER_NAME"
fi

# Test 7: Security scan (if available)
echo -e "\n${BLUE}Test 7: Security scanning...${NC}"
if command -v docker &> /dev/null; then
    # Try to use docker scan if available
    if docker scan --version &> /dev/null; then
        echo "Running security scan..."
        docker scan "${IMAGE_NAME}:${TEST_TAG}" || echo -e "${YELLOW}⚠ Security scan completed with warnings${NC}"
    else
        echo -e "${YELLOW}⚠ Docker scan not available, skipping security scan${NC}"
    fi
fi

echo -e "\n${GREEN}=== All Docker tests completed successfully! ===${NC}"
echo -e "${GREEN}Image: ${IMAGE_NAME}:${TEST_TAG}${NC}"
echo -e "${GREEN}Container: ${CONTAINER_NAME}${NC}"
echo -e "${GREEN}Health check: http://localhost:${PORT}/api/health${NC}"

# Optional: Keep container running for manual testing
if [ "$1" = "--keep-running" ]; then
    echo -e "\n${YELLOW}Container will keep running for manual testing...${NC}"
    echo -e "${YELLOW}Use 'docker stop ${CONTAINER_NAME}' to stop it${NC}"
    trap - EXIT  # Remove cleanup trap
fi 