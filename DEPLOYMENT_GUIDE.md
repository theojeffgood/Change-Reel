# Change Reel AWS EC2 Deployment Guide

This guide provides step-by-step instructions for deploying Change Reel to AWS EC2 using Docker.

## Prerequisites

### Required Tools
- AWS CLI v2 configured with appropriate credentials
- Docker (for local testing)
- jq (for JSON parsing)
- SSH key pair for EC2 access

### AWS Setup
1. **AWS Account**: Ensure you have an AWS account with appropriate permissions
2. **IAM Permissions**: Your AWS user/role needs permissions for:
   - EC2 instance management
   - Security group management
   - CloudWatch logging (optional)
3. **Key Pair**: Create or import an SSH key pair in your target region

### Environment Variables
Set the following required environment variables:

```bash
# Required for application
export NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
export NEXTAUTH_SECRET="your_nextauth_secret"
export GITHUB_CLIENT_ID="your_github_client_id"
export GITHUB_CLIENT_SECRET="your_github_client_secret"
export OPENAI_API_KEY="your_openai_api_key"

# Optional
export PERPLEXITY_API_KEY="your_perplexity_api_key"

# Deployment configuration
export AWS_REGION="us-east-1"
export KEY_NAME="change-reel-key"
export INSTANCE_TYPE="t3.medium"

# SSL configuration (optional)
export DOMAIN_NAME="your-domain.com"
export SSL_EMAIL="your-email@domain.com"
```

## Quick Start

### 1. Initial Deployment

```bash
# Run the complete deployment script
./scripts/deploy-ec2.sh
```

This will:
- Create or find existing EC2 instance
- Set up security groups
- Install Docker and dependencies
- Deploy the application
- Configure SSL (if domain provided)
- Set up monitoring and backups

### 2. Verify Deployment

```bash
# Check deployment status
./scripts/manage-deployment.sh status

# View application logs
./scripts/manage-deployment.sh logs

# Test health endpoint
curl http://YOUR_INSTANCE_IP/api/health
```

## Detailed Deployment Process

### Phase 1: Infrastructure Setup

The deployment script automatically:

1. **Creates Security Group** with rules for:
   - SSH (port 22)
   - HTTP (port 80)
   - HTTPS (port 443)

2. **Launches EC2 Instance** with:
   - Amazon Linux 2 AMI
   - Specified instance type (default: t3.medium)
   - User data script for initial setup

3. **Configures Instance** via user data:
   - Installs Docker and Docker Compose
   - Sets up Nginx reverse proxy
   - Configures system optimization
   - Sets up log rotation and monitoring

### Phase 2: Application Deployment

1. **Code Transfer**
   - Creates deployment package (excludes node_modules, .git, etc.)
   - Transfers to instance via SCP
   - Extracts in `/opt/change-reel`

2. **Environment Setup**
   - Creates production environment file
   - Configures application secrets
   - Sets up runtime configuration

3. **Docker Deployment**
   - Builds production-optimized image
   - Starts services with docker-compose
   - Configures health checks

### Phase 3: Production Setup

1. **SSL Configuration** (if domain provided)
   - Installs Certbot
   - Obtains Let's Encrypt certificate
   - Sets up auto-renewal

2. **Monitoring Setup**
   - Installs CloudWatch agent
   - Configures metrics collection
   - Sets up log aggregation

3. **Backup Configuration**
   - Creates backup scripts
   - Sets up daily cron jobs
   - Configures retention policies

## Management Operations

### Daily Operations

```bash
# Check system status
./scripts/manage-deployment.sh status

# View application logs
./scripts/manage-deployment.sh logs app

# View nginx logs
./scripts/manage-deployment.sh logs nginx

# Check resource usage
./scripts/manage-deployment.sh resources
```

### Application Updates

```bash
# Update application code
./scripts/manage-deployment.sh update

# Or redeploy completely
./scripts/deploy-ec2.sh --app-only
```

### Instance Management

```bash
# Start stopped instance
./scripts/manage-deployment.sh start

# Stop instance
./scripts/manage-deployment.sh stop

# Restart instance
./scripts/manage-deployment.sh restart

# SSH into instance
./scripts/manage-deployment.sh ssh
```

### Maintenance

```bash
# Create manual backup
./scripts/manage-deployment.sh backup

# Clean up Docker resources
./scripts/manage-deployment.sh cleanup

# Execute custom command
./scripts/manage-deployment.sh exec "command here"
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AWS_REGION` | AWS region for deployment | us-east-1 | No |
| `INSTANCE_TYPE` | EC2 instance type | t3.medium | No |
| `KEY_NAME` | SSH key pair name | change-reel-key | Yes |
| `DOMAIN_NAME` | Domain for SSL setup | - | No |
| `SSL_EMAIL` | Email for Let's Encrypt | - | No |
| `BACKUP_ENABLED` | Enable backup system | true | No |
| `MONITORING_ENABLED` | Enable CloudWatch | true | No |

### Instance Sizing

**Recommended instance types:**

- **Development/Testing**: t3.micro (1 vCPU, 1GB RAM)
- **Small Production**: t3.small (2 vCPU, 2GB RAM)
- **Medium Production**: t3.medium (2 vCPU, 4GB RAM)
- **High Traffic**: t3.large (2 vCPU, 8GB RAM)

### Storage

- **Root Volume**: 20GB gp3 (default)
- **Application**: `/opt/change-reel`
- **Logs**: `/var/log/change-reel`
- **Backups**: `/opt/backups`

## Security Considerations

### Network Security
- Security group restricts access to necessary ports only
- SSH access from anywhere (consider restricting to your IP)
- Application behind Nginx reverse proxy

### Application Security
- Runs as non-root user in containers
- Environment variables for sensitive data
- SSL termination at Nginx level
- Rate limiting configured

### Data Security
- Database uses external Supabase (encrypted at rest)
- Backups stored locally (consider S3 for production)
- Secrets managed via environment variables

## Monitoring and Alerting

### Built-in Monitoring
- CloudWatch agent for system metrics
- Docker container health checks
- Application health endpoint
- Nginx access/error logs

### Available Metrics
- CPU usage
- Memory usage
- Disk usage
- Container status
- Application response times

### Log Locations
- **Application**: Docker container logs
- **System**: `/var/log/messages`
- **Nginx**: `/var/log/nginx/`
- **Backup**: `/var/log/backup.log`

## Backup and Recovery

### Automatic Backups
- **Daily backups** at 2 AM UTC
- **7-day retention** policy
- **Includes**: Redis data, configuration files

### Manual Backup
```bash
./scripts/manage-deployment.sh backup
```

### Restore Process
1. Stop application services
2. Restore data from backup files
3. Restart services
4. Verify functionality

## Troubleshooting

### Common Issues

**Deployment fails with "SSH connection failed"**
- Check security group allows SSH (port 22)
- Verify key pair name matches `KEY_NAME`
- Ensure key file exists at `~/.ssh/${KEY_NAME}.pem`

**Application not responding**
- Check container status: `docker-compose ps`
- View logs: `./scripts/manage-deployment.sh logs`
- Verify environment variables are set

**SSL certificate issues**
- Ensure domain points to instance IP
- Check DNS propagation
- Verify email address for Let's Encrypt

**High resource usage**
- Monitor with: `./scripts/manage-deployment.sh resources`
- Clean up: `./scripts/manage-deployment.sh cleanup`
- Consider upgrading instance type

### Debug Commands

```bash
# Check container status
./scripts/manage-deployment.sh exec "docker ps"

# View container logs
./scripts/manage-deployment.sh exec "docker logs change-reel-app-prod"

# Check nginx status
./scripts/manage-deployment.sh exec "sudo systemctl status nginx"

# Test application directly
./scripts/manage-deployment.sh exec "curl localhost:3000/api/health"
```

## Cost Optimization

### Instance Costs
- Use smaller instances for development
- Stop instances when not needed
- Consider Reserved Instances for production

### Monitoring Costs
- CloudWatch has free tier limits
- Monitor log volume and retention

### Backup Costs
- Local backups are free
- Consider S3 lifecycle policies for long-term storage

## Scaling Considerations

### Vertical Scaling
- Increase instance type for more CPU/memory
- Monitor resource usage before scaling

### Horizontal Scaling
- Load balancer for multiple instances
- Shared external database (Supabase)
- Container orchestration (ECS/EKS)

### Performance Tuning
- Optimize Docker images
- Configure Nginx caching
- Monitor and tune database queries

## Support and Maintenance

### Regular Tasks
- **Weekly**: Review logs and metrics
- **Monthly**: Security updates and patches
- **Quarterly**: Backup verification and testing

### Updates
- Application updates via management script
- System updates require instance restart
- Docker image updates with deployment script

### Getting Help
- Check application logs first
- Review CloudWatch metrics
- Use management script for diagnostics
- Document issues with full context

## Additional Resources

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Production Guide](https://docs.docker.com/config/containers/start-containers-automatically/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/) 