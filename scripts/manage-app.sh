#!/bin/bash

# Change Reel - Application Management Script
# Basic management commands for the deployed application

set -e

# Configuration
CONTAINER_NAME="change-reel-app"
APP_PORT=3001

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Show usage
usage() {
    echo "Usage: $0 {start|stop|restart|status|logs|health|update}"
    echo ""
    echo "Commands:"
    echo "  start   - Start the application container"
    echo "  stop    - Stop the application container"
    echo "  restart - Restart the application container"
    echo "  status  - Show container status"
    echo "  logs    - Show application logs"
    echo "  health  - Check application health"
    echo "  update  - Update and restart the application"
    exit 1
}

# Start the application
start_app() {
    if docker ps -q -f name=${CONTAINER_NAME} | grep -q .; then
        log "Application is already running"
        return 0
    fi
    
    log "Starting application..."
    docker start ${CONTAINER_NAME} || {
        error "Failed to start container. Container may not exist."
        error "Run the deployment script first: ./scripts/deploy-ec2.sh"
        exit 1
    }
    
    log "✓ Application started"
}

# Stop the application
stop_app() {
    if ! docker ps -q -f name=${CONTAINER_NAME} | grep -q .; then
        log "Application is not running"
        return 0
    fi
    
    log "Stopping application..."
    docker stop ${CONTAINER_NAME}
    log "✓ Application stopped"
}

# Restart the application
restart_app() {
    log "Restarting application..."
    stop_app
    start_app
    log "✓ Application restarted"
}

# Show container status
show_status() {
    info "Container Status:"
    if docker ps -a -f name=${CONTAINER_NAME} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q ${CONTAINER_NAME}; then
        docker ps -a -f name=${CONTAINER_NAME} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        error "Container ${CONTAINER_NAME} not found"
        error "Run the deployment script first: ./scripts/deploy-ec2.sh"
    fi
    
    echo ""
    info "System Resources:"
    docker stats ${CONTAINER_NAME} --no-stream 2>/dev/null || echo "Container not running"
    
    echo ""
    info "Nginx Status:"
    sudo systemctl status nginx --no-pager -l || echo "Nginx not running"
}

# Show application logs
show_logs() {
    info "Application Logs (last 50 lines):"
    docker logs --tail 50 -f ${CONTAINER_NAME} 2>/dev/null || {
        error "Cannot show logs. Container may not exist or be running."
        exit 1
    }
}

# Check application health
check_health() {
    info "Checking application health..."
    
    # Check container health
    if docker ps -q -f name=${CONTAINER_NAME} | grep -q .; then
        log "✓ Container is running"
    else
        error "✗ Container is not running"
        return 1
    fi
    
    # Check application endpoint
    if curl -s http://localhost:${APP_PORT}/api/health > /dev/null 2>&1; then
        log "✓ Application health endpoint responding"
        
        # Show health details
        echo ""
        info "Health Details:"
        curl -s http://localhost:${APP_PORT}/api/health | python3 -m json.tool 2>/dev/null || \
        curl -s http://localhost:${APP_PORT}/api/health
    else
        error "✗ Application health endpoint not responding"
        return 1
    fi
    
    # Check nginx proxy
    if curl -s http://localhost/health > /dev/null 2>&1; then
        log "✓ Nginx reverse proxy working"
    else
        error "✗ Nginx reverse proxy not responding"
        return 1
    fi
    
    log "🎉 All health checks passed!"
}

# Update the application
update_app() {
    log "Updating application..."
    
    # Pull latest code (if this is a git repository)
    if [ -d ".git" ]; then
        log "Pulling latest code..."
        git pull origin main || git pull origin master || {
            error "Failed to pull latest code"
            exit 1
        }
    fi
    
    # Rebuild and restart
    log "Rebuilding application..."
    docker build -f Dockerfile.prod -t change-reel:latest .
    
    restart_app
    
    # Wait for health check
    sleep 5
    check_health
    
    log "✓ Application updated successfully"
}

# Main function
main() {
    case "${1:-}" in
        start)
            start_app
            ;;
        stop)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        health)
            check_health
            ;;
        update)
            update_app
            ;;
        *)
            usage
            ;;
    esac
}

# Run main function
main "$@" 