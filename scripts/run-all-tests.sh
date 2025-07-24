#!/bin/bash

# Change Reel - Test Runner Script
# Runs all Docker-related tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0

# Logging functions
log() {
    echo -e "${GREEN}[RUNNER] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Run a test script
run_test() {
    local test_name="$1"
    local test_script="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    log "Running ${test_name}..."
    echo "----------------------------------------"
    
    if bash "${test_script}"; then
        echo "----------------------------------------"
        log "✅ ${test_name} PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo "----------------------------------------"
        error "❌ ${test_name} FAILED"
        return 1
    fi
}

# Show final summary
show_final_summary() {
    echo ""
    echo "========================================"
    info "FINAL TEST SUMMARY"
    echo "========================================"
    echo -e "${GREEN}Tests Passed: ${PASSED_TESTS}/${TOTAL_TESTS}${NC}"
    
    if [ ${PASSED_TESTS} -eq ${TOTAL_TESTS} ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo ""
        info "Your Docker configuration is working correctly!"
        info "You can now:"
        info "  1. Use 'docker-compose up' for local development"
        info "  2. Use './scripts/deploy-ec2.sh' for EC2 deployment"
        info "  3. Use './scripts/manage-app.sh' for application management"
        return 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED!${NC}"
        echo ""
        error "Please fix the failing tests before deploying to production."
        return 1
    fi
}

# Main function
main() {
    log "Starting comprehensive Docker test suite..."
    echo ""
    
    # Check prerequisites
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed or not in PATH"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "docker-compose is not installed or not in PATH"
        exit 1
    fi
    
    # Run tests
    run_test "Docker Build Tests" "scripts/test-docker.sh"
    echo ""
    run_test "Docker Compose Tests" "scripts/test-docker-compose.sh"
    
    # Show final results
    echo ""
    show_final_summary
}

# Show usage if help requested
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    echo "Change Reel Docker Test Runner"
    echo ""
    echo "Usage: $0"
    echo ""
    echo "This script runs all Docker-related tests including:"
    echo "  - Docker build tests"
    echo "  - Docker compose tests"
    echo "  - Health check validation"
    echo ""
    echo "Prerequisites:"
    echo "  - Docker installed and running"
    echo "  - docker-compose available"
    echo ""
    exit 0
fi

# Run main function
main "$@" 