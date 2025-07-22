#!/bin/bash

# Change Reel Deployment Management Script
# Provides common operations for managing deployed instances

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="change-reel"
DEPLOY_ENV=${DEPLOY_ENV:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
KEY_NAME=${KEY_NAME:-change-reel-key}

# Get instance information
get_instance_info() {
    local instance_id=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Name,Values=${APP_NAME}-${DEPLOY_ENV}" \
                  "Name=instance-state-name,Values=running,pending,stopping,stopped" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text 2>/dev/null)
    
    if [ "$instance_id" = "None" ] || [ "$instance_id" = "" ]; then
        echo -e "${RED}No instance found for ${APP_NAME}-${DEPLOY_ENV}${NC}"
        exit 1
    fi
    
    INSTANCE_ID="$instance_id"
    INSTANCE_IP=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --instance-ids "$instance_id" \
        --query "Reservations[0].Instances[0].PublicIpAddress" \
        --output text)
    
    INSTANCE_STATE=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --instance-ids "$instance_id" \
        --query "Reservations[0].Instances[0].State.Name" \
        --output text)
    
    export INSTANCE_ID INSTANCE_IP INSTANCE_STATE
}

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Show status
status() {
    echo -e "${BLUE}=== Change Reel Deployment Status ===${NC}"
    
    get_instance_info
    
    echo "Instance ID: $INSTANCE_ID"
    echo "Public IP: $INSTANCE_IP"
    echo "State: $INSTANCE_STATE"
    echo "Environment: $DEPLOY_ENV"
    echo "Region: $AWS_REGION"
    
    if [ "$INSTANCE_STATE" = "running" ]; then
        echo
        echo -e "${BLUE}=== Application Status ===${NC}"
        
        # Check if SSH is available
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no \
               -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
               "echo 'SSH OK'" &> /dev/null; then
            
            # Get Docker container status
            ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
                "cd /opt/change-reel && sudo docker-compose -f docker-compose.prod.yml ps"
            
            echo
            echo -e "${BLUE}=== Health Check ===${NC}"
            if curl -f "http://$INSTANCE_IP/api/health" 2>/dev/null; then
                success "Application is responding"
            else
                error "Application health check failed"
            fi
        else
            warning "SSH connection failed"
        fi
    fi
}

# Start instance
start() {
    log "Starting instance..."
    get_instance_info
    
    if [ "$INSTANCE_STATE" = "running" ]; then
        success "Instance is already running"
        return
    fi
    
    aws ec2 start-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
    aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
    
    success "Instance started"
}

# Stop instance
stop() {
    log "Stopping instance..."
    get_instance_info
    
    if [ "$INSTANCE_STATE" = "stopped" ]; then
        success "Instance is already stopped"
        return
    fi
    
    # Gracefully stop the application first
    if [ "$INSTANCE_STATE" = "running" ]; then
        ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
            "cd /opt/change-reel && sudo docker-compose -f docker-compose.prod.yml down" || true
    fi
    
    aws ec2 stop-instances --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
    aws ec2 wait instance-stopped --region "$AWS_REGION" --instance-ids "$INSTANCE_ID"
    
    success "Instance stopped"
}

# Restart instance
restart() {
    log "Restarting instance..."
    stop
    start
}

# View logs
logs() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    local service=${1:-app}
    
    log "Showing logs for service: $service"
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
        "cd /opt/change-reel && sudo docker-compose -f docker-compose.prod.yml logs -f $service"
}

# Execute command on instance
exec_cmd() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    local cmd="$1"
    if [ -z "$cmd" ]; then
        error "No command provided"
        exit 1
    fi
    
    log "Executing command: $cmd"
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" "$cmd"
}

# SSH into instance
ssh_connect() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    log "Connecting to instance via SSH..."
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP"
}

# Update application
update() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    log "Updating application..."
    
    # Run the deployment script in app-only mode
    INSTANCE_IP="$INSTANCE_IP" ./scripts/deploy-ec2.sh --app-only
    
    success "Application updated"
}

# Backup data
backup() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    log "Creating backup..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
        "/usr/local/bin/backup-change-reel.sh"
    
    success "Backup completed"
}

# Show resource usage
resources() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    echo -e "${BLUE}=== Resource Usage ===${NC}"
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << 'EOF'
        echo "=== CPU and Memory ==="
        top -bn1 | head -5
        
        echo -e "\n=== Disk Usage ==="
        df -h
        
        echo -e "\n=== Docker Container Stats ==="
        sudo docker stats --no-stream
        
        echo -e "\n=== Docker Images ==="
        sudo docker images
        
        echo -e "\n=== System Load ==="
        uptime
EOF
}

# Clean up old Docker images and containers
cleanup() {
    get_instance_info
    
    if [ "$INSTANCE_STATE" != "running" ]; then
        error "Instance is not running"
        exit 1
    fi
    
    log "Cleaning up Docker resources..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << 'EOF'
        # Remove stopped containers
        sudo docker container prune -f
        
        # Remove unused images
        sudo docker image prune -f
        
        # Remove unused volumes
        sudo docker volume prune -f
        
        # Remove unused networks
        sudo docker network prune -f
        
        echo "Docker cleanup completed"
EOF
    
    success "Cleanup completed"
}

# Show help
show_help() {
    echo "Change Reel Deployment Management"
    echo
    echo "Usage: $0 <command> [arguments]"
    echo
    echo "Commands:"
    echo "  status              Show deployment status"
    echo "  start               Start the instance"
    echo "  stop                Stop the instance"
    echo "  restart             Restart the instance"
    echo "  logs [service]      Show logs (default: app)"
    echo "  exec <command>      Execute command on instance"
    echo "  ssh                 SSH into the instance"
    echo "  update              Update the application"
    echo "  backup              Create a backup"
    echo "  resources           Show resource usage"
    echo "  cleanup             Clean up Docker resources"
    echo "  help                Show this help"
    echo
    echo "Environment Variables:"
    echo "  DEPLOY_ENV          Deployment environment (default: production)"
    echo "  AWS_REGION          AWS region (default: us-east-1)"
    echo "  KEY_NAME            EC2 key pair name (default: change-reel-key)"
    echo
}

# Main command handling
case "${1:-}" in
    status)
        status
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs "${2:-app}"
        ;;
    exec)
        exec_cmd "$2"
        ;;
    ssh)
        ssh_connect
        ;;
    update)
        update
        ;;
    backup)
        backup
        ;;
    resources)
        resources
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: ${1:-}"
        echo
        show_help
        exit 1
        ;;
esac 