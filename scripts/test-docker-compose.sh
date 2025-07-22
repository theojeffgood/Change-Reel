#!/bin/bash

# Test script for Change Reel Docker Compose configuration
# Tests development and production docker-compose setups

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="change-reel"
TEST_ENV=${1:-dev}  # dev or prod

echo -e "${BLUE}=== Change Reel Docker Compose Test Suite ===${NC}"
echo -e "${BLUE}Testing environment: ${TEST_ENV}${NC}"

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up Docker Compose services...${NC}"
    if [ "$TEST_ENV" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
    else
        docker-compose down -v --remove-orphans 2>/dev/null || true
    fi
}

# Trap cleanup on exit
trap cleanup EXIT

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed or not in PATH${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are available${NC}"

# Check for environment file
ENV_FILE="docker.env.template"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment template file not found: $ENV_FILE${NC}"
    echo "Please create $ENV_FILE with required environment variables"
    exit 1
fi

echo -e "${GREEN}✓ Environment template found${NC}"

# Test 1: Validate docker-compose configuration
echo -e "\n${BLUE}Test 1: Validating Docker Compose configuration...${NC}"
if [ "$TEST_ENV" = "prod" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    if docker-compose -f "$COMPOSE_FILE" config > /dev/null; then
        echo -e "${GREEN}✓ Production Docker Compose configuration is valid${NC}"
    else
        echo -e "${RED}✗ Production Docker Compose configuration is invalid${NC}"
        exit 1
    fi
else
    if docker-compose config > /dev/null; then
        echo -e "${GREEN}✓ Development Docker Compose configuration is valid${NC}"
    else
        echo -e "${RED}✗ Development Docker Compose configuration is invalid${NC}"
        exit 1
    fi
fi

# Test 2: Build images
echo -e "\n${BLUE}Test 2: Building Docker images...${NC}"
if [ "$TEST_ENV" = "prod" ]; then
    if docker-compose -f docker-compose.prod.yml build; then
        echo -e "${GREEN}✓ Production images built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build production images${NC}"
        exit 1
    fi
else
    if docker-compose build; then
        echo -e "${GREEN}✓ Development images built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build development images${NC}"
        exit 1
    fi
fi

# Test 3: Start services
echo -e "\n${BLUE}Test 3: Starting services...${NC}"
if [ "$TEST_ENV" = "prod" ]; then
    if docker-compose -f docker-compose.prod.yml up -d; then
        echo -e "${GREEN}✓ Production services started${NC}"
    else
        echo -e "${RED}✗ Failed to start production services${NC}"
        exit 1
    fi
else
    if docker-compose up -d; then
        echo -e "${GREEN}✓ Development services started${NC}"
    else
        echo -e "${RED}✗ Failed to start development services${NC}"
        exit 1
    fi
fi

# Wait for services to be ready
echo -e "\n${BLUE}Waiting for services to be ready...${NC}"
sleep 30

# Test 4: Check service health
echo -e "\n${BLUE}Test 4: Checking service health...${NC}"

# Check app health
APP_HEALTH=$(docker-compose ps app 2>/dev/null | grep -c "Up" || echo "0")
if [ "$APP_HEALTH" -gt 0 ]; then
    echo -e "${GREEN}✓ App service is running${NC}"
else
    echo -e "${RED}✗ App service is not running${NC}"
    docker-compose logs app
    exit 1
fi

# Check database health (if using local postgres)
if [ "$TEST_ENV" = "dev" ]; then
    DB_HEALTH=$(docker-compose ps postgres 2>/dev/null | grep -c "Up" || echo "0")
    if [ "$DB_HEALTH" -gt 0 ]; then
        echo -e "${GREEN}✓ Database service is running${NC}"
    else
        echo -e "${YELLOW}⚠ Database service not running (may be using external Supabase)${NC}"
    fi
fi

# Check Redis health
REDIS_HEALTH=$(docker-compose ps redis 2>/dev/null | grep -c "Up" || echo "0")
if [ "$REDIS_HEALTH" -gt 0 ]; then
    echo -e "${GREEN}✓ Redis service is running${NC}"
else
    echo -e "${RED}✗ Redis service is not running${NC}"
    exit 1
fi

# Test 5: Test application endpoints
echo -e "\n${BLUE}Test 5: Testing application endpoints...${NC}"

# Health check endpoint
if curl -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health endpoint responding${NC}"
    curl -s "http://localhost:3000/api/health" | head -3
else
    echo -e "${RED}✗ Health endpoint not responding${NC}"
    echo "App logs:"
    docker-compose logs --tail 20 app
    exit 1
fi

# Test main page (if accessible)
if curl -f "http://localhost:3000/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Main page responding${NC}"
else
    echo -e "${YELLOW}⚠ Main page not responding (may require authentication)${NC}"
fi

# Test 6: Check resource usage
echo -e "\n${BLUE}Test 6: Checking resource usage...${NC}"
if [ "$TEST_ENV" = "prod" ]; then
    echo "Production container stats:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" || true
fi

# Test 7: Test volumes and persistence
echo -e "\n${BLUE}Test 7: Testing volumes and persistence...${NC}"
VOLUMES=$(docker volume ls -q | grep -c "${PROJECT_NAME}" || echo "0")
if [ "$VOLUMES" -gt 0 ]; then
    echo -e "${GREEN}✓ Docker volumes created: $VOLUMES${NC}"
    docker volume ls | grep "${PROJECT_NAME}" || true
else
    echo -e "${YELLOW}⚠ No project-specific volumes found${NC}"
fi

# Test 8: Network connectivity
echo -e "\n${BLUE}Test 8: Testing network connectivity...${NC}"
NETWORKS=$(docker network ls -q | grep -c "${PROJECT_NAME}" || echo "0")
if [ "$NETWORKS" -gt 0 ]; then
    echo -e "${GREEN}✓ Docker networks created: $NETWORKS${NC}"
else
    echo -e "${YELLOW}⚠ No project-specific networks found${NC}"
fi

echo -e "\n${GREEN}=== Docker Compose tests completed successfully! ===${NC}"
echo -e "${GREEN}Environment: ${TEST_ENV}${NC}"

# Show running services
echo -e "\n${BLUE}Currently running services:${NC}"
if [ "$TEST_ENV" = "prod" ]; then
    docker-compose -f docker-compose.prod.yml ps
else
    docker-compose ps
fi

# Optional: Keep services running for manual testing
if [ "$2" = "--keep-running" ]; then
    echo -e "\n${YELLOW}Services will keep running for manual testing...${NC}"
    echo -e "${YELLOW}Use './scripts/test-docker-compose.sh cleanup' to stop all services${NC}"
    trap - EXIT  # Remove cleanup trap
fi

# Cleanup option
if [ "$1" = "cleanup" ]; then
    echo -e "\n${YELLOW}Cleaning up all Docker Compose services...${NC}"
    docker-compose down -v --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.prod.yml down -v --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}✓ Cleanup completed${NC}"
fi 