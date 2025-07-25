#!/bin/bash

# Wins Column - AWS EC2 Deployment Script
# This script deploys the Wins Column application to AWS EC2
# Note: Nginx should be configured separately on the EC2 instance

set -e

# Configuration
APP_NAME="wins-column"
DOCKER_IMAGE="wins-column:latest"
CONTAINER_NAME="wins-column-app"
APP_PORT=3001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Check if running on EC2
check_ec2() {
    log "Checking if running on EC2..."
    if curl -s --max-time 3 http://169.254.169.254/latest/meta-data/instance-id > /dev/null 2>&1; then
        log "✓ Running on EC2 instance"
    else
        warn "Not running on EC2, proceeding anyway..."
    fi
}

# Install Docker if not present
install_docker() {
    if command -v docker &> /dev/null; then
        log "✓ Docker already installed"
        return
    fi
    
    log "Installing Docker..."
    
    # Detect OS and install accordingly
    if [[ -f /etc/debian_version ]]; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y docker.io docker-compose
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    elif [[ -f /etc/redhat-release ]]; then
        # Amazon Linux/CentOS/RHEL
        sudo yum update -y
        sudo yum install -y docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
    else
        error "Unsupported OS for automatic Docker installation"
        exit 1
    fi
    
    log "✓ Docker installed successfully"
    log "Note: You may need to log out and back in for Docker permissions to take effect"
}

# Build and deploy the application
deploy_app() {
    log "Building application..."
    
    # Check if .env.production exists
    if [ ! -f ".env" ]; then
        error ".env file not found!"
        exit 1
    fi
    
    # Stop and remove existing container if it exists
    if docker ps -a --format 'table {{.Names}}' | grep -q "${CONTAINER_NAME}"; then
        log "Stopping existing container..."
        docker stop "${CONTAINER_NAME}" || true
        docker rm "${CONTAINER_NAME}" || true
    fi
    
    # Build the Docker image
    log "Building Docker image..."
    docker build -f Dockerfile.prod -t "${DOCKER_IMAGE}" .
    
    # Run the new container
    log "Starting new container..."
    docker run -d \
        --name "${CONTAINER_NAME}" \
        --restart unless-stopped \
        -p "${APP_PORT}:3001" \
        --env-file .env \
        "${DOCKER_IMAGE}"
    
    # Wait for container to be ready
    log "Waiting for container to start..."
    sleep 10
    
    # Health check
    if curl -f http://localhost:${APP_PORT}/health > /dev/null 2>&1; then
        log "✓ Application is running and healthy"
    else
        error "Application health check failed"
        docker logs "${CONTAINER_NAME}" --tail 50
        exit 1
    fi
}

# Cleanup old Docker images
cleanup_docker() {
    log "Cleaning up old Docker images..."
    docker image prune -f || true
    log "✓ Docker cleanup completed"
}

# Main deployment function
main() {
    log "Starting deployment of ${APP_NAME}..."
    
    check_ec2
    install_docker
    deploy_app
    cleanup_docker
    
    log "🎉 Deployment completed successfully!"
    log "Application is running at:"
    log "  - Application port: http://localhost:${APP_PORT}"
    log "  - Health check: http://localhost:${APP_PORT}/health"
    log ""
    log "Next steps:"
    log "1. Configure nginx on your EC2 instance to proxy to port ${APP_PORT}"
    log "2. Set up SSL certificates if needed"
    log "3. Configure your domain DNS to point to this EC2 instance"
}

# Error handling
trap 'error "Deployment failed on line $LINENO"' ERR

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    warn "Running as root is not recommended for security reasons"
fi

# Run main function
main "$@" 