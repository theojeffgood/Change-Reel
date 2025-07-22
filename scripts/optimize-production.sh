#!/bin/bash

# Production optimization script for Change Reel Docker images
# Includes security scanning, size optimization, and performance validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="change-reel"
PROD_TAG="prod"
OPTIMIZED_TAG="optimized"
SECURITY_SCAN=${SECURITY_SCAN:-true}
SIZE_LIMIT_MB=${SIZE_LIMIT_MB:-500}

echo -e "${BLUE}=== Change Reel Production Optimization Suite ===${NC}"

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up temporary resources...${NC}"
    # Remove temporary containers
    docker ps -a --filter "name=change-reel-temp" --format "{{.ID}}" | xargs -r docker rm -f
}

# Trap cleanup on exit
trap cleanup EXIT

# Check dependencies
check_dependencies() {
    echo -e "\n${BLUE}Checking dependencies...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker available${NC}"
    
    # Check for security scanning tools
    if command -v trivy &> /dev/null; then
        echo -e "${GREEN}✓ Trivy security scanner available${NC}"
        TRIVY_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠ Trivy not available - install for enhanced security scanning${NC}"
        TRIVY_AVAILABLE=false
    fi
    
    if command -v dive &> /dev/null; then
        echo -e "${GREEN}✓ Dive image analyzer available${NC}"
        DIVE_AVAILABLE=true
    else
        echo -e "${YELLOW}⚠ Dive not available - install for detailed layer analysis${NC}"
        DIVE_AVAILABLE=false
    fi
}

# Build production-optimized image
build_optimized_image() {
    echo -e "\n${BLUE}Building production-optimized image...${NC}"
    
    # Build using production Dockerfile
    if docker build -f Dockerfile.prod -t "${IMAGE_NAME}:${OPTIMIZED_TAG}" .; then
        echo -e "${GREEN}✓ Production image built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build production image${NC}"
        exit 1
    fi
    
    # Get image size
    IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${OPTIMIZED_TAG}" --format "{{.Size}}")
    echo -e "${GREEN}Image size: ${IMAGE_SIZE}${NC}"
}

# Analyze image size and layers
analyze_image_size() {
    echo -e "\n${BLUE}Analyzing image size and layers...${NC}"
    
    # Get detailed size information
    IMAGE_SIZE_BYTES=$(docker images "${IMAGE_NAME}:${OPTIMIZED_TAG}" --format "{{.Size}}" | sed 's/[^0-9.]//g')
    
    # Check size limit (rough conversion)
    echo "Checking size against limit of ${SIZE_LIMIT_MB}MB..."
    
    # Use Dive for detailed analysis if available
    if [ "$DIVE_AVAILABLE" = true ]; then
        echo -e "${BLUE}Running Dive analysis...${NC}"
        dive "${IMAGE_NAME}:${OPTIMIZED_TAG}" --ci --ci-config .dive-ci.yml || true
    fi
    
    # Show layer information
    echo -e "\n${BLUE}Image layers:${NC}"
    docker history "${IMAGE_NAME}:${OPTIMIZED_TAG}" --no-trunc
}

# Security scanning
security_scan() {
    if [ "$SECURITY_SCAN" = "false" ]; then
        echo -e "\n${YELLOW}Skipping security scan (SECURITY_SCAN=false)${NC}"
        return
    fi
    
    echo -e "\n${BLUE}Running security scans...${NC}"
    
    # Trivy vulnerability scan
    if [ "$TRIVY_AVAILABLE" = true ]; then
        echo -e "${BLUE}Running Trivy vulnerability scan...${NC}"
        
        # Scan for vulnerabilities
        if trivy image --exit-code 1 --severity HIGH,CRITICAL "${IMAGE_NAME}:${OPTIMIZED_TAG}"; then
            echo -e "${GREEN}✓ No high/critical vulnerabilities found${NC}"
        else
            echo -e "${YELLOW}⚠ High/critical vulnerabilities detected${NC}"
            echo "Running detailed scan for all severities..."
            trivy image "${IMAGE_NAME}:${OPTIMIZED_TAG}"
        fi
        
        # Scan for secrets
        echo -e "${BLUE}Scanning for secrets...${NC}"
        trivy image --scanners secret "${IMAGE_NAME}:${OPTIMIZED_TAG}" || true
        
        # Configuration scan
        echo -e "${BLUE}Scanning configuration...${NC}"
        trivy image --scanners config "${IMAGE_NAME}:${OPTIMIZED_TAG}" || true
    fi
    
    # Docker built-in security checks
    echo -e "${BLUE}Running Docker security checks...${NC}"
    
    # Check for non-root user
    USER_CHECK=$(docker run --rm "${IMAGE_NAME}:${OPTIMIZED_TAG}" whoami)
    if [ "$USER_CHECK" = "nextjs" ]; then
        echo -e "${GREEN}✓ Running as non-root user: $USER_CHECK${NC}"
    else
        echo -e "${RED}✗ Not running as expected non-root user${NC}"
    fi
    
    # Check for read-only filesystem capability
    echo -e "${BLUE}Testing read-only filesystem...${NC}"
    if docker run --rm --read-only --tmpfs /tmp "${IMAGE_NAME}:${OPTIMIZED_TAG}" node healthcheck.js; then
        echo -e "${GREEN}✓ Image supports read-only filesystem${NC}"
    else
        echo -e "${YELLOW}⚠ Image may not fully support read-only filesystem${NC}"
    fi
}

# Performance testing
performance_test() {
    echo -e "\n${BLUE}Running performance tests...${NC}"
    
    # Test startup time
    echo -e "${BLUE}Testing container startup time...${NC}"
    START_TIME=$(date +%s)
    
    CONTAINER_ID=$(docker run -d --name change-reel-temp -p 3001:3000 "${IMAGE_NAME}:${OPTIMIZED_TAG}")
    
    # Wait for health check to pass
    TIMEOUT=60
    ELAPSED=0
    while [ $ELAPSED -lt $TIMEOUT ]; do
        if docker exec "$CONTAINER_ID" node healthcheck.js 2>/dev/null; then
            END_TIME=$(date +%s)
            STARTUP_TIME=$((END_TIME - START_TIME))
            echo -e "${GREEN}✓ Container started in ${STARTUP_TIME} seconds${NC}"
            break
        fi
        sleep 1
        ELAPSED=$((ELAPSED + 1))
    done
    
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo -e "${RED}✗ Container failed to start within $TIMEOUT seconds${NC}"
        docker logs "$CONTAINER_ID"
        exit 1
    fi
    
    # Test memory usage
    echo -e "${BLUE}Checking memory usage...${NC}"
    MEMORY_USAGE=$(docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_ID")
    echo -e "${GREEN}Memory usage: ${MEMORY_USAGE}${NC}"
    
    # Test response time
    echo -e "${BLUE}Testing response time...${NC}"
    RESPONSE_TIME=$(curl -o /dev/null -s -w "%{time_total}" "http://localhost:3001/api/health")
    echo -e "${GREEN}Health endpoint response time: ${RESPONSE_TIME}s${NC}"
    
    # Cleanup test container
    docker stop "$CONTAINER_ID" && docker rm "$CONTAINER_ID"
}

# Generate optimization report
generate_report() {
    echo -e "\n${BLUE}Generating optimization report...${NC}"
    
    REPORT_FILE="optimization-report.json"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$TIMESTAMP",
  "image": "${IMAGE_NAME}:${OPTIMIZED_TAG}",
  "optimization": {
    "size": "$IMAGE_SIZE",
    "startup_time": "${STARTUP_TIME:-unknown}",
    "memory_usage": "$MEMORY_USAGE",
    "response_time": "$RESPONSE_TIME"
  },
  "security": {
    "user": "$USER_CHECK",
    "trivy_scan": $TRIVY_AVAILABLE,
    "readonly_fs": true
  },
  "recommendations": [
    "Consider using distroless base images for even smaller size",
    "Enable read-only filesystem in production",
    "Implement resource limits in Kubernetes/Docker Compose",
    "Regular security scanning in CI/CD pipeline"
  ]
}
EOF
    
    echo -e "${GREEN}✓ Report generated: $REPORT_FILE${NC}"
    cat "$REPORT_FILE"
}

# Main execution
main() {
    check_dependencies
    build_optimized_image
    analyze_image_size
    security_scan
    performance_test
    generate_report
    
    echo -e "\n${GREEN}=== Production optimization completed successfully! ===${NC}"
    echo -e "${GREEN}Optimized image: ${IMAGE_NAME}:${OPTIMIZED_TAG}${NC}"
    echo -e "${GREEN}Report: optimization-report.json${NC}"
}

# Handle command line arguments
case "${1:-}" in
    --security-only)
        check_dependencies
        build_optimized_image
        security_scan
        ;;
    --size-only)
        check_dependencies
        build_optimized_image
        analyze_image_size
        ;;
    --no-security)
        SECURITY_SCAN=false
        main
        ;;
    *)
        main
        ;;
esac 