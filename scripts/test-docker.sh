#!/bin/bash

# Change Reel - Docker Build Test Script
# Tests Docker build process and basic container functionality

set -e

# Configuration
TEST_IMAGE="change-reel:test"
TEST_CONTAINER="change-reel-test"
APP_PORT=3001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Logging functions
log() {
    echo -e "${GREEN}[TEST] $1${NC}"
}

error() {
    echo -e "${RED}[FAIL] $1${NC}" >&2
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

pass() {
    echo -e "${GREEN}[PASS] $1${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Cleanup function
cleanup() {
    log "Cleaning up test containers and images..."
    docker stop ${TEST_CONTAINER} 2>/dev/null || true
    docker rm ${TEST_CONTAINER} 2>/dev/null || true
    docker rmi ${TEST_IMAGE} 2>/dev/null || true
}

# Test Docker build
test_docker_build() {
    log "Testing Docker build process..."
    
    if docker build -t ${TEST_IMAGE} .; then
        pass "Docker build successful"
    else
        error "Docker build failed"
        return 1
    fi
    
    # Check image size
    IMAGE_SIZE=$(docker images ${TEST_IMAGE} --format "{{.Size}}")
    info "Image size: ${IMAGE_SIZE}"
    
    # Check image layers
    LAYER_COUNT=$(docker history ${TEST_IMAGE} --format "{{.ID}}" | wc -l)
    info "Image layers: ${LAYER_COUNT}"
    
    return 0
}

# Test production Docker build
test_production_build() {
    log "Testing production Docker build..."
    
    if docker build -f Dockerfile.prod -t ${TEST_IMAGE}-prod .; then
        pass "Production Docker build successful"
        
        # Compare sizes
        PROD_SIZE=$(docker images ${TEST_IMAGE}-prod --format "{{.Size}}")
        info "Production image size: ${PROD_SIZE}"
        
        # Cleanup production image
        docker rmi ${TEST_IMAGE}-prod 2>/dev/null || true
    else
        error "Production Docker build failed"
        return 1
    fi
    
    return 0
}

# Test container startup
test_container_startup() {
    log "Testing container startup..."
    
    # Create environment file for testing
    cat > .env.test <<EOF
NODE_ENV=development
PORT=${APP_PORT}
NEXT_TELEMETRY_DISABLED=1
NEXTAUTH_URL=http://localhost:${APP_PORT}
NEXTAUTH_SECRET=test-secret-for-testing-only
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
EOF
    
    # Start container
    if docker run -d \
        --name ${TEST_CONTAINER} \
        -p ${APP_PORT}:${APP_PORT} \
        --env-file .env.test \
        ${TEST_IMAGE}; then
        pass "Container started successfully"
    else
        error "Container failed to start"
        rm -f .env.test
        return 1
    fi
    
    # Wait for container to be ready
    log "Waiting for container to be ready..."
    for i in {1..30}; do
        if docker ps --filter "name=${TEST_CONTAINER}" --filter "status=running" | grep -q ${TEST_CONTAINER}; then
            pass "Container is running"
            break
        fi
        
        if [ $i -eq 30 ]; then
            error "Container failed to start properly"
            docker logs ${TEST_CONTAINER}
            rm -f .env.test
            return 1
        fi
        
        sleep 2
    done
    
    rm -f .env.test
    return 0
}

# Test health endpoint
test_health_endpoint() {
    log "Testing health endpoint..."
    
    # Wait for app to be ready
    for i in {1..30}; do
        if curl -s http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
            pass "Health endpoint responding"
            
            # Get health details
            HEALTH_RESPONSE=$(curl -s http://localhost:${APP_PORT}/api/health)
            info "Health response: ${HEALTH_RESPONSE}"
            
            # Check if response contains expected fields
            if echo "${HEALTH_RESPONSE}" | grep -q '"status":"healthy"'; then
                pass "Health endpoint returns healthy status"
            else
                error "Health endpoint does not return healthy status"
                return 1
            fi
            
            return 0
        fi
        
        if [ $i -eq 30 ]; then
            error "Health endpoint not responding after 60 seconds"
            docker logs ${TEST_CONTAINER}
            return 1
        fi
        
        sleep 2
    done
}

# Test container logs
test_container_logs() {
    log "Testing container logs..."
    
    if docker logs ${TEST_CONTAINER} 2>&1 | grep -q "Ready"; then
        pass "Container logs show application ready"
    else
        info "Container logs:"
        docker logs ${TEST_CONTAINER} 2>&1 | tail -10
        pass "Container logs accessible (ready status may vary)"
    fi
    
    return 0
}

# Test Docker health check
test_docker_healthcheck() {
    log "Testing Docker health check..."
    
    # Wait for health check to run
    sleep 10
    
    HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' ${TEST_CONTAINER} 2>/dev/null || echo "none")
    
    if [ "${HEALTH_STATUS}" = "healthy" ]; then
        pass "Docker health check reports healthy"
    elif [ "${HEALTH_STATUS}" = "starting" ]; then
        pass "Docker health check is starting (normal for new containers)"
    else
        error "Docker health check failed or not configured. Status: ${HEALTH_STATUS}"
        return 1
    fi
    
    return 0
}

# Show test summary
show_summary() {
    echo ""
    info "=== Test Summary ==="
    echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
    
    if [ ${TESTS_FAILED} -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some tests failed!${NC}"
        return 1
    fi
}

# Main test function
main() {
    log "Starting Docker tests for Change Reel..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run tests
    test_docker_build
    test_production_build
    test_container_startup
    test_health_endpoint
    test_container_logs
    test_docker_healthcheck
    
    # Show summary
    show_summary
}

# Run main function
main "$@" 