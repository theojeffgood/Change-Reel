#!/bin/bash

# Change Reel - Docker Compose Test Script
# Tests docker-compose configurations for development and production

set -e

# Configuration
COMPOSE_PROJECT="change-reel-test"
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

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

# Cleanup function
cleanup() {
    log "Cleaning up docker-compose services..."
    docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.yml down -v 2>/dev/null || true
    docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.prod.yml down -v 2>/dev/null || true
    rm -f .env.test .env.prod.test
}

# Create test environment files
create_test_env_files() {
    log "Creating test environment files..."
    
    # Development environment
    cat > .env.test <<EOF
NODE_ENV=development
PORT=${APP_PORT}
NEXT_TELEMETRY_DISABLED=1
NEXTAUTH_URL=http://localhost:${APP_PORT}
NEXTAUTH_SECRET=test-secret-for-development-testing
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
EOF

    # Production environment
    cat > .env.prod.test <<EOF
NODE_ENV=production
PORT=${APP_PORT}
NEXT_TELEMETRY_DISABLED=1
NEXTAUTH_URL=http://localhost:${APP_PORT}
NEXTAUTH_SECRET=test-secret-for-production-testing
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
EOF

    pass "Test environment files created"
}

# Test development docker-compose
test_dev_compose() {
    log "Testing development docker-compose..."
    
    # Copy test env file
    cp .env.test .env.local
    
    # Start services
    if docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.yml up -d; then
        pass "Development docker-compose started"
    else
        error "Development docker-compose failed to start"
        rm -f .env.local
        return 1
    fi
    
    # Wait for service to be ready
    log "Waiting for development service to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
            pass "Development service is responding"
            break
        fi
        
        if [ $i -eq 60 ]; then
            error "Development service failed to become ready"
            docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.yml logs
            rm -f .env.local
            return 1
        fi
        
        sleep 2
    done
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s http://localhost:${APP_PORT}/api/health)
    if echo "${HEALTH_RESPONSE}" | grep -q '"status":"healthy"'; then
        pass "Development health endpoint working"
    else
        error "Development health endpoint not working properly"
        rm -f .env.local
        return 1
    fi
    
    # Stop services
    docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.yml down
    rm -f .env.local
    
    pass "Development docker-compose test completed"
    return 0
}

# Test production docker-compose
test_prod_compose() {
    log "Testing production docker-compose..."
    
    # Copy test env file
    cp .env.prod.test .env.production
    
    # Start services
    if docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.prod.yml up -d; then
        pass "Production docker-compose started"
    else
        error "Production docker-compose failed to start"
        rm -f .env.production
        return 1
    fi
    
    # Wait for service to be ready
    log "Waiting for production service to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
            pass "Production service is responding"
            break
        fi
        
        if [ $i -eq 60 ]; then
            error "Production service failed to become ready"
            docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.prod.yml logs
            rm -f .env.production
            return 1
        fi
        
        sleep 2
    done
    
    # Test health endpoint
    HEALTH_RESPONSE=$(curl -s http://localhost:${APP_PORT}/api/health)
    if echo "${HEALTH_RESPONSE}" | grep -q '"status":"healthy"'; then
        pass "Production health endpoint working"
    else
        error "Production health endpoint not working properly"
        rm -f .env.production
        return 1
    fi
    
    # Check if environment is production
    if echo "${HEALTH_RESPONSE}" | grep -q '"environment":"production"'; then
        pass "Production environment correctly set"
    else
        warn "Production environment may not be set correctly"
    fi
    
    # Stop services
    docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.prod.yml down
    rm -f .env.production
    
    pass "Production docker-compose test completed"
    return 0
}

# Test docker-compose configuration validation
test_compose_config() {
    log "Testing docker-compose configuration validation..."
    
    # Test development compose config
    if docker-compose -f docker-compose.yml config > /dev/null 2>&1; then
        pass "Development docker-compose configuration is valid"
    else
        error "Development docker-compose configuration is invalid"
        return 1
    fi
    
    # Test production compose config
    if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
        pass "Production docker-compose configuration is valid"
    else
        error "Production docker-compose configuration is invalid"
        return 1
    fi
    
    return 0
}

# Test docker-compose build
test_compose_build() {
    log "Testing docker-compose build process..."
    
    # Test development build
    if docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.yml build; then
        pass "Development docker-compose build successful"
    else
        error "Development docker-compose build failed"
        return 1
    fi
    
    # Test production build
    if docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.prod.yml build; then
        pass "Production docker-compose build successful"
    else
        error "Production docker-compose build failed"
        return 1
    fi
    
    return 0
}

# Test environment variable loading
test_env_loading() {
    log "Testing environment variable loading..."
    
    # Create a temporary compose file for testing env vars
    cat > docker-compose.test.yml <<EOF
version: '3.8'
services:
  test:
    build: .
    environment:
      - NODE_ENV=test
      - PORT=${APP_PORT}
    command: node -e "console.log('NODE_ENV:', process.env.NODE_ENV); console.log('PORT:', process.env.PORT);"
EOF
    
    # Run test
    OUTPUT=$(docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.test.yml run --rm test 2>&1)
    
    if echo "${OUTPUT}" | grep -q "NODE_ENV: test" && echo "${OUTPUT}" | grep -q "PORT: ${APP_PORT}"; then
        pass "Environment variables loaded correctly"
    else
        error "Environment variables not loaded correctly"
        info "Output: ${OUTPUT}"
        rm -f docker-compose.test.yml
        return 1
    fi
    
    # Cleanup
    docker-compose -p ${COMPOSE_PROJECT} -f docker-compose.test.yml down 2>/dev/null || true
    rm -f docker-compose.test.yml
    
    return 0
}

# Show test summary
show_summary() {
    echo ""
    info "=== Docker Compose Test Summary ==="
    echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
    echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
    
    if [ ${TESTS_FAILED} -eq 0 ]; then
        echo -e "${GREEN}🎉 All docker-compose tests passed!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some docker-compose tests failed!${NC}"
        return 1
    fi
}

# Main test function
main() {
    log "Starting docker-compose tests for Change Reel..."
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    # Run tests
    create_test_env_files
    test_compose_config
    test_compose_build
    test_env_loading
    test_dev_compose
    test_prod_compose
    
    # Show summary
    show_summary
}

# Run main function
main "$@" 