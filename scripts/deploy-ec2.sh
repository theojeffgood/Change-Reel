#!/bin/bash

# Wins Column - AWS EC2 Deployment Script
# This script deploys the Wins Column application to AWS EC2 with nginx reverse proxy

set -e

# Configuration
APP_NAME="wins-column"
DOCKER_IMAGE="wins-column:latest"
CONTAINER_NAME="wins-column-app"
APP_PORT=3001
NGINX_PORT=80
DOMAIN="${DOMAIN:-localhost}"

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
        return 0
    else
        error "This script is designed to run on AWS EC2"
        exit 1
    fi
}

# Install Docker if not present
install_docker() {
    if command -v docker &> /dev/null; then
        log "✓ Docker already installed"
        return 0
    fi

    log "Installing Docker..."
    sudo yum update -y
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -a -G docker ec2-user
    
    # Install Docker Compose
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    log "✓ Docker and Docker Compose installed"
}

# Install and configure nginx
setup_nginx() {
    log "Setting up nginx..."
    
    if ! command -v nginx &> /dev/null; then
        sudo yum install -y nginx
    fi
    
    # Create nginx configuration
    sudo tee /etc/nginx/conf.d/wins-column.conf > /dev/null <<EOF
upstream wins_column_app {
    server localhost:${APP_PORT};
}

server {
    listen ${NGINX_PORT};
    server_name ${DOMAIN};
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Health check endpoint
    location /health {
        proxy_pass http://wins_column_app/api/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Main application
    location / {
        proxy_pass http://wins_column_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    
    # Test nginx configuration
    sudo nginx -t
    
    # Start and enable nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    log "✓ Nginx configured and started"
}

# Deploy the application
deploy_app() {
    log "Deploying ${APP_NAME}..."
    
    # Stop existing container if running
    if docker ps -q -f name=${CONTAINER_NAME} | grep -q .; then
        log "Stopping existing container..."
        docker stop ${CONTAINER_NAME}
        docker rm ${CONTAINER_NAME}
    fi
    
    # Build the Docker image
    log "Building Docker image..."
    docker build -f Dockerfile.prod -t ${DOCKER_IMAGE} .
    
    # Run the new container
    log "Starting new container..."
    docker run -d \
        --name ${CONTAINER_NAME} \
        --restart unless-stopped \
        -p 127.0.0.1:${APP_PORT}:${APP_PORT} \
        --env-file .env.production \
        ${DOCKER_IMAGE}
    
    # Wait for container to be healthy
    log "Waiting for application to be healthy..."
    for i in {1..30}; do
        if curl -s http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
            log "✓ Application is healthy"
            break
        fi
        
        if [ $i -eq 30 ]; then
            error "Application failed to become healthy"
            exit 1
        fi
        
        sleep 2
    done
    
    log "✓ Application deployed successfully"
}

# Configure firewall
setup_firewall() {
    log "Configuring firewall..."
    
    # Install firewalld if not present (Amazon Linux 2)
    if ! command -v firewall-cmd &> /dev/null; then
        sudo yum install -y firewalld
        sudo systemctl start firewalld
        sudo systemctl enable firewalld
    fi
    
    # Open necessary ports
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-service=ssh
    sudo firewall-cmd --reload
    
    log "✓ Firewall configured"
}

# Main deployment function
main() {
    log "Starting deployment of ${APP_NAME}..."
    
    check_ec2
    install_docker
    setup_nginx
    setup_firewall
    deploy_app
    
    log "🎉 Deployment completed successfully!"
    log "Application is running at:"
    log "  - Local: http://localhost:${NGINX_PORT}"
    if [ "$DOMAIN" != "localhost" ]; then
        log "  - Domain: http://${DOMAIN}"
    fi
    log "  - Health check: http://localhost:${NGINX_PORT}/health"
}

# Run main function
main "$@" 