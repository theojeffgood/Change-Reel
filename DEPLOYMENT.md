# Change Reel - Deployment Guide

This guide explains how to deploy the Change Reel application using Docker on AWS EC2.

## Architecture

- **Application**: Next.js app running on port 3001 (containerized)
- **Reverse Proxy**: Nginx routing external traffic to the app
- **Database**: External Supabase (no local database)
- **Platform**: AWS EC2 with Docker

## Prerequisites

1. **AWS EC2 Instance**: Amazon Linux 2 or similar
2. **Domain Name**: Optional, but recommended for production
3. **Environment Variables**: Configured for production

## Quick Deployment

### 1. Prepare Environment Variables

Copy the template and fill in your values:
```bash
cp env.production.template .env.production
# Edit .env.production with your actual values
```

### 2. Deploy to EC2

Run the deployment script:
```bash
./scripts/deploy-ec2.sh
```

This script will:
- Install Docker and Docker Compose
- Configure nginx reverse proxy
- Set up firewall rules
- Build and run the application
- Configure health checks

### 3. Verify Deployment

Check if everything is working:
```bash
./scripts/manage-app.sh health
```

## Management Commands

Use the management script for common operations:

```bash
# Check application status
./scripts/manage-app.sh status

# View application logs
./scripts/manage-app.sh logs

# Restart the application
./scripts/manage-app.sh restart

# Update the application
./scripts/manage-app.sh update

# Check health
./scripts/manage-app.sh health
```

## Port Configuration

- **External**: Port 80 (HTTP) via nginx
- **Internal**: Port 3001 (application container)
- **Health Check**: `/health` endpoint

## Environment Variables

### Required Variables

- `NEXTAUTH_URL`: Your production domain (e.g., https://yourdomain.com)
- `NEXTAUTH_SECRET`: Secure random string for NextAuth
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `GITHUB_CLIENT_ID`: GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth app client secret
- `OPENAI_API_KEY`: OpenAI API key
- `WEBHOOK_SECRET`: GitHub webhook secret

### OAuth Configuration

Make sure your GitHub OAuth app is configured with:
- **Homepage URL**: `https://yourdomain.com`
- **Callback URL**: `https://yourdomain.com/api/auth/callback/github`

## Local Development

For local development, use the standard docker-compose:

```bash
# Copy template and configure for local development
cp docker.env.template .env.local
# Edit .env.local with local values (NEXTAUTH_URL=http://localhost:3001)

# Start local development
docker-compose up
```

## Troubleshooting

### Container Issues
```bash
# Check container logs
docker logs change-reel-app

# Check container status
docker ps -a
```

### Nginx Issues
```bash
# Check nginx status
sudo systemctl status nginx

# Check nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Health Check Issues
```bash
# Test direct application health
curl http://localhost:3001/api/health

# Test nginx proxy health
curl http://localhost/health
```

### Firewall Issues
```bash
# Check firewall status
sudo firewall-cmd --list-all

# Open HTTP port if needed
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## File Structure

```
scripts/
├── deploy-ec2.sh       # Main deployment script
└── manage-app.sh       # Application management script

docker.env.template      # Local environment template
env.production.template  # Production environment template

Dockerfile              # Development Docker configuration
Dockerfile.prod         # Production Docker configuration
docker-compose.yml      # Local development setup
docker-compose.prod.yml # Production setup
```

## Security Notes

1. **Environment Variables**: Keep `.env.production` secure and never commit it to git
2. **Firewall**: Only necessary ports (80, 443, 22) are open
3. **Container Security**: Application runs as non-root user
4. **Nginx Security**: Security headers and rate limiting configured

## Updates

To update the application:

1. **Manual Update**:
   ```bash
   ./scripts/manage-app.sh update
   ```

2. **Full Redeployment**:
   ```bash
   ./scripts/deploy-ec2.sh
   ``` 