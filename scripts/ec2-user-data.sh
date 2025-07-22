#!/bin/bash

# EC2 User Data Script for Change Reel
# Sets up EC2 instance with Docker, Docker Compose, and required dependencies

# Update system
yum update -y

# Install basic utilities
yum install -y \
    curl \
    wget \
    git \
    unzip \
    htop \
    tree \
    jq \
    yum-utils \
    device-mapper-persistent-data \
    lvm2

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf awscliv2.zip aws/

# Install Node.js (for local development tools if needed)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Install nginx for reverse proxy
amazon-linux-extras install nginx1 -y
systemctl enable nginx

# Create application directory
mkdir -p /opt/change-reel
chown ec2-user:ec2-user /opt/change-reel

# Create logs directory
mkdir -p /var/log/change-reel
chown ec2-user:ec2-user /var/log/change-reel

# Create backup directory
mkdir -p /opt/backups
chown ec2-user:ec2-user /opt/backups

# Set up Docker daemon configuration for production
cat > /etc/docker/daemon.json << 'DOCKEREOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "storage-opts": [
    "overlay2.override_kernel_check=true"
  ]
}
DOCKEREOF

# Restart Docker with new configuration
systemctl restart docker

# Set up log rotation for application
cat > /etc/logrotate.d/change-reel << 'LOGROTATEEOF'
/var/log/change-reel/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 ec2-user ec2-user
    postrotate
        /usr/bin/docker kill -s USR1 change-reel-app-prod 2>/dev/null || true
    endscript
}
LOGROTATEEOF

# Set up system limits for better performance
cat >> /etc/security/limits.conf << 'LIMITSEOF'
ec2-user soft nofile 65536
ec2-user hard nofile 65536
ec2-user soft nproc 4096
ec2-user hard nproc 4096
LIMITSEOF

# Configure sysctl for better network performance
cat > /etc/sysctl.d/99-change-reel.conf << 'SYSCTLEOF'
# Network performance optimizations
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000

# File descriptor limits
fs.file-max = 2097152

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
SYSCTLEOF

# Apply sysctl settings
sysctl -p /etc/sysctl.d/99-change-reel.conf

# Set up firewall rules
systemctl enable firewalld
systemctl start firewalld

# Allow necessary ports
firewall-cmd --permanent --add-port=22/tcp    # SSH
firewall-cmd --permanent --add-port=80/tcp    # HTTP
firewall-cmd --permanent --add-port=443/tcp   # HTTPS
firewall-cmd --reload

# Create a basic nginx configuration
cat > /etc/nginx/nginx.conf << 'NGINXEOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Basic rate limiting
    limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;

    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        # Health check
        location /health {
            proxy_pass http://localhost:3000/api/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Default proxy to application
        location / {
            limit_req zone=one burst=20 nodelay;
            proxy_pass http://localhost:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINXEOF

# Test nginx configuration
nginx -t

# Start nginx
systemctl start nginx

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm
rm -f amazon-cloudwatch-agent.rpm

# Set timezone
timedatectl set-timezone UTC

# Create a status file to indicate setup completion
echo "EC2 instance setup completed at $(date)" > /opt/setup-complete.txt
chown ec2-user:ec2-user /opt/setup-complete.txt

# Send completion signal to CloudWatch (if configured)
aws logs create-log-group --log-group-name /aws/ec2/change-reel/setup --region us-east-1 2>/dev/null || true
aws logs put-log-events \
    --log-group-name /aws/ec2/change-reel/setup \
    --log-stream-name $(curl -s http://169.254.169.254/latest/meta-data/instance-id) \
    --log-events timestamp=$(date +%s)000,message="EC2 setup completed successfully" \
    --region us-east-1 2>/dev/null || true

echo "Change Reel EC2 setup completed successfully!" 