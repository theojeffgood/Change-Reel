#!/bin/bash

# Change Reel AWS EC2 Deployment Script
# Automated deployment of Change Reel to AWS EC2 with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_NAME="change-reel"
DEPLOY_ENV=${DEPLOY_ENV:-production}
AWS_REGION=${AWS_REGION:-us-east-1}
INSTANCE_TYPE=${INSTANCE_TYPE:-t3.medium}
KEY_NAME=${KEY_NAME:-change-reel-key}

# Deployment configuration
DOMAIN_NAME=${DOMAIN_NAME:-""}
SSL_EMAIL=${SSL_EMAIL:-""}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
MONITORING_ENABLED=${MONITORING_ENABLED:-true}

echo -e "${BLUE}=== Change Reel EC2 Deployment ===${NC}"
echo -e "${BLUE}Environment: ${DEPLOY_ENV}${NC}"
echo -e "${BLUE}Region: ${AWS_REGION}${NC}"

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

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local missing_deps=()
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        missing_deps+=("aws-cli")
    fi
    
    # Check jq for JSON parsing
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    # Check Docker (for local testing)
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install missing dependencies before continuing."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi
    
    success "All dependencies available"
}

# Validate configuration
validate_config() {
    log "Validating configuration..."
    
    # Check required environment variables
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "NEXTAUTH_SECRET"
        "GITHUB_CLIENT_ID"
        "GITHUB_CLIENT_SECRET"
        "OPENAI_API_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        echo "Please set these variables before deployment."
        exit 1
    fi
    
    success "Configuration validated"
}

# Create or get EC2 instance
setup_ec2_instance() {
    log "Setting up EC2 instance..."
    
    # Check if instance already exists
    local instance_id=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --filters "Name=tag:Name,Values=${APP_NAME}-${DEPLOY_ENV}" \
                  "Name=instance-state-name,Values=running,pending,stopping,stopped" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text 2>/dev/null)
    
    if [ "$instance_id" != "None" ] && [ "$instance_id" != "" ]; then
        log "Using existing instance: $instance_id"
        
        # Start instance if stopped
        local state=$(aws ec2 describe-instances \
            --region "$AWS_REGION" \
            --instance-ids "$instance_id" \
            --query "Reservations[0].Instances[0].State.Name" \
            --output text)
        
        if [ "$state" = "stopped" ]; then
            log "Starting stopped instance..."
            aws ec2 start-instances --region "$AWS_REGION" --instance-ids "$instance_id"
            aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$instance_id"
        fi
    else
        log "Creating new EC2 instance..."
        
        # Get latest Amazon Linux 2 AMI
        local ami_id=$(aws ec2 describe-images \
            --region "$AWS_REGION" \
            --owners amazon \
            --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
                      "Name=state,Values=available" \
            --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" \
            --output text)
        
        # Create security group if it doesn't exist
        local sg_id=$(aws ec2 describe-security-groups \
            --region "$AWS_REGION" \
            --filters "Name=group-name,Values=${APP_NAME}-sg" \
            --query "SecurityGroups[0].GroupId" \
            --output text 2>/dev/null)
        
        if [ "$sg_id" = "None" ] || [ "$sg_id" = "" ]; then
            log "Creating security group..."
            sg_id=$(aws ec2 create-security-group \
                --region "$AWS_REGION" \
                --group-name "${APP_NAME}-sg" \
                --description "Security group for ${APP_NAME}" \
                --query "GroupId" \
                --output text)
            
            # Add security group rules
            aws ec2 authorize-security-group-ingress \
                --region "$AWS_REGION" \
                --group-id "$sg_id" \
                --protocol tcp \
                --port 22 \
                --cidr 0.0.0.0/0
            
            aws ec2 authorize-security-group-ingress \
                --region "$AWS_REGION" \
                --group-id "$sg_id" \
                --protocol tcp \
                --port 80 \
                --cidr 0.0.0.0/0
            
            aws ec2 authorize-security-group-ingress \
                --region "$AWS_REGION" \
                --group-id "$sg_id" \
                --protocol tcp \
                --port 443 \
                --cidr 0.0.0.0/0
        fi
        
        # Launch instance
        instance_id=$(aws ec2 run-instances \
            --region "$AWS_REGION" \
            --image-id "$ami_id" \
            --instance-type "$INSTANCE_TYPE" \
            --key-name "$KEY_NAME" \
            --security-group-ids "$sg_id" \
            --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${APP_NAME}-${DEPLOY_ENV}},{Key=Environment,Value=${DEPLOY_ENV}}]" \
            --user-data file://"${SCRIPT_DIR}/ec2-user-data.sh" \
            --query "Instances[0].InstanceId" \
            --output text)
        
        log "Waiting for instance to be running..."
        aws ec2 wait instance-running --region "$AWS_REGION" --instance-ids "$instance_id"
    fi
    
    # Get instance public IP
    INSTANCE_IP=$(aws ec2 describe-instances \
        --region "$AWS_REGION" \
        --instance-ids "$instance_id" \
        --query "Reservations[0].Instances[0].PublicIpAddress" \
        --output text)
    
    success "EC2 instance ready: $instance_id ($INSTANCE_IP)"
    export INSTANCE_ID="$instance_id"
    export INSTANCE_IP="$INSTANCE_IP"
}

# Deploy application to EC2
deploy_application() {
    log "Deploying application to EC2..."
    
    # Wait for SSH to be available
    log "Waiting for SSH to be available..."
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
               -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
               "echo 'SSH connection successful'" &> /dev/null; then
            break
        fi
        
        retries=$((retries + 1))
        log "SSH not ready, retrying... ($retries/$max_retries)"
        sleep 10
    done
    
    if [ $retries -eq $max_retries ]; then
        error "SSH connection failed after $max_retries attempts"
        exit 1
    fi
    
    success "SSH connection established"
    
    # Create deployment directory and copy files
    log "Copying application files..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" \
        "sudo mkdir -p /opt/${APP_NAME} && sudo chown ec2-user:ec2-user /opt/${APP_NAME}"
    
    # Create a temporary deployment package
    local deploy_package="/tmp/${APP_NAME}-deploy.tar.gz"
    tar -czf "$deploy_package" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.next \
        --exclude=coverage \
        -C "$PROJECT_ROOT" .
    
    # Copy deployment package
    scp -i ~/.ssh/"${KEY_NAME}.pem" "$deploy_package" ec2-user@"$INSTANCE_IP":/tmp/
    
    # Extract and set up application
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << 'EOF'
        cd /opt/change-reel
        tar -xzf /tmp/change-reel-deploy.tar.gz
        rm /tmp/change-reel-deploy.tar.gz
        
        # Set up environment file
        sudo tee .env.production > /dev/null << ENVEOF
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
NEXTAUTH_URL=${NEXTAUTH_URL:-https://${DOMAIN_NAME:-$INSTANCE_IP}}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
OPENAI_API_KEY=${OPENAI_API_KEY}
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}
ENVEOF
        
        # Build and start the application
        sudo docker-compose -f docker-compose.prod.yml down || true
        sudo docker-compose -f docker-compose.prod.yml build
        sudo docker-compose -f docker-compose.prod.yml up -d
EOF
    
    success "Application deployed successfully"
}

# Set up SSL certificate with Let's Encrypt
setup_ssl() {
    if [ -z "$DOMAIN_NAME" ]; then
        warning "No domain name provided, skipping SSL setup"
        return
    fi
    
    log "Setting up SSL certificate for $DOMAIN_NAME..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << EOF
        # Install certbot
        sudo amazon-linux-extras install epel -y
        sudo yum install certbot python3-certbot-nginx -y
        
        # Get SSL certificate
        sudo certbot --nginx -d ${DOMAIN_NAME} --email ${SSL_EMAIL} --agree-tos --non-interactive
        
        # Set up auto-renewal
        echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
EOF
    
    success "SSL certificate configured for $DOMAIN_NAME"
}

# Set up monitoring
setup_monitoring() {
    if [ "$MONITORING_ENABLED" != "true" ]; then
        warning "Monitoring disabled, skipping setup"
        return
    fi
    
    log "Setting up monitoring..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << 'EOF'
        # Install CloudWatch agent
        wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
        sudo rpm -U ./amazon-cloudwatch-agent.rpm
        
        # Configure CloudWatch agent
        sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null << CWEOF
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/messages",
                        "log_group_name": "change-reel-system",
                        "log_stream_name": "{instance_id}"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "ChangeReel",
        "metrics_collected": {
            "cpu": {
                "measurement": ["cpu_usage_idle", "cpu_usage_iowait"],
                "metrics_collection_interval": 60
            },
            "disk": {
                "measurement": ["used_percent"],
                "metrics_collection_interval": 60,
                "resources": ["*"]
            },
            "mem": {
                "measurement": ["mem_used_percent"],
                "metrics_collection_interval": 60
            }
        }
    }
}
CWEOF
        
        # Start CloudWatch agent
        sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
            -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
EOF
    
    success "Monitoring configured"
}

# Set up backup
setup_backup() {
    if [ "$BACKUP_ENABLED" != "true" ]; then
        warning "Backup disabled, skipping setup"
        return
    fi
    
    log "Setting up backup system..."
    
    ssh -i ~/.ssh/"${KEY_NAME}.pem" ec2-user@"$INSTANCE_IP" << 'EOF'
        # Create backup script
        sudo tee /usr/local/bin/backup-change-reel.sh > /dev/null << 'BACKUPEOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup Docker volumes
docker run --rm -v change-reel-redis-data-prod:/data -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/redis_${DATE}.tar.gz" -C /data .

# Backup application config
tar czf "$BACKUP_DIR/config_${DATE}.tar.gz" -C /opt/change-reel .env.production

# Clean old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
BACKUPEOF
        
        sudo chmod +x /usr/local/bin/backup-change-reel.sh
        
        # Set up daily backup cron job
        echo "0 2 * * * /usr/local/bin/backup-change-reel.sh >> /var/log/backup.log 2>&1" | sudo crontab -
EOF
    
    success "Backup system configured"
}

# Health check
health_check() {
    log "Performing health check..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://$INSTANCE_IP/api/health" &> /dev/null; then
            success "Health check passed"
            return 0
        fi
        
        log "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    error "Health check failed after $max_attempts attempts"
    return 1
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    check_dependencies
    validate_config
    setup_ec2_instance
    deploy_application
    setup_ssl
    setup_monitoring
    setup_backup
    
    if health_check; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        success "Deployment completed successfully in ${duration}s"
        echo
        echo "=== Deployment Summary ==="
        echo "Instance ID: $INSTANCE_ID"
        echo "Public IP: $INSTANCE_IP"
        echo "Health Check: http://$INSTANCE_IP/api/health"
        if [ -n "$DOMAIN_NAME" ]; then
            echo "Domain: https://$DOMAIN_NAME"
        fi
        echo "Environment: $DEPLOY_ENV"
        echo
    else
        error "Deployment completed but health check failed"
        exit 1
    fi
}

# Command line argument handling
case "${1:-}" in
    --check-only)
        check_dependencies
        validate_config
        ;;
    --instance-only)
        check_dependencies
        setup_ec2_instance
        ;;
    --app-only)
        check_dependencies
        validate_config
        deploy_application
        health_check
        ;;
    *)
        main
        ;;
esac 