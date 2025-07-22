# Docker Production Optimization Guide

This document outlines the production optimizations implemented for Change Reel's Docker deployment.

## Overview

The production optimization strategy focuses on three key areas:
1. **Security** - Minimize attack surface and vulnerabilities
2. **Performance** - Optimize startup time and resource usage  
3. **Size** - Reduce image size for faster deployments

## Optimization Components

### 1. Production Dockerfile (`Dockerfile.prod`)

**Key Optimizations:**
- Multi-stage build with dependency isolation
- Alpine Linux base for minimal size
- Non-root user execution
- Security updates and minimal dependencies
- Read-only filesystem support
- Optimized health checks

**Security Features:**
- Runs as `nextjs` user (UID 1001)
- Security labels for compliance
- Vulnerability scanning enabled
- No sensitive data in layers

### 2. Optimization Script (`scripts/optimize-production.sh`)

**Capabilities:**
- Automated security scanning with Trivy
- Image size analysis with Dive
- Performance benchmarking
- Compliance reporting
- Layer efficiency analysis

**Usage:**
```bash
# Full optimization suite
./scripts/optimize-production.sh

# Security scan only
./scripts/optimize-production.sh --security-only

# Size analysis only  
./scripts/optimize-production.sh --size-only

# Skip security scanning
./scripts/optimize-production.sh --no-security
```

### 3. Production Docker Ignore (`.dockerignore.prod`)

**Exclusions:**
- All development and testing files
- Documentation and scripts
- Source maps and debug files
- IDE configurations
- Large binary files

**Impact:** Reduces build context by ~70% compared to development builds.

## Security Optimizations

### Vulnerability Management
- Base image security updates
- Dependency vulnerability scanning
- Secret detection
- Configuration validation

### Runtime Security
- Non-root user execution
- Read-only filesystem capability
- Minimal attack surface
- Security headers via Nginx

### Compliance
- Security labels for tracking
- Audit trail in build process
- Compliance reporting

## Performance Optimizations

### Build Performance
- Multi-stage caching
- Dependency layer isolation
- Parallel build stages
- Optimized layer ordering

### Runtime Performance
- Minimal runtime dependencies
- Optimized health checks
- Resource-aware configuration
- Efficient signal handling

### Resource Usage
- Memory limit awareness
- CPU optimization
- I/O efficiency
- Network optimization

## Size Optimizations

### Base Image
- Alpine Linux (minimal size)
- No unnecessary packages
- Security updates only

### Application Layer
- Production dependencies only
- No development tools
- No source maps
- Compressed assets

### Build Artifacts
- Cleaned npm cache
- Removed build dependencies
- No test files
- Optimized file structure

## Monitoring and Validation

### Automated Checks
- Image size limits (500MB threshold)
- Security vulnerability scanning
- Performance benchmarks
- Compliance validation

### Metrics Collected
- Build time and size
- Startup time
- Memory usage
- Response times
- Security score

### Reporting
- JSON optimization reports
- Security scan results
- Performance metrics
- Compliance status

## Best Practices

### Development
1. Use development Dockerfile for local work
2. Test with production image before deployment
3. Regular security scanning
4. Monitor image size growth

### Production
1. Use production-optimized image
2. Enable read-only filesystem
3. Implement resource limits
4. Regular vulnerability updates

### CI/CD Integration
1. Automated optimization checks
2. Security gate in pipeline
3. Performance regression detection
4. Size limit enforcement

## Troubleshooting

### Common Issues

**Large Image Size:**
- Check .dockerignore.prod coverage
- Verify multi-stage build efficiency
- Review dependency requirements

**Security Vulnerabilities:**
- Update base image regularly
- Review dependency versions
- Check for embedded secrets

**Performance Issues:**
- Profile container startup
- Monitor resource usage
- Check health check efficiency

### Debugging Tools

**Image Analysis:**
```bash
# Analyze layers
docker history change-reel:optimized

# Check size breakdown  
dive change-reel:optimized

# Security scan
trivy image change-reel:optimized
```

**Performance Testing:**
```bash
# Startup time
time docker run --rm change-reel:optimized node healthcheck.js

# Memory usage
docker stats change-reel-container

# Response time
curl -w "%{time_total}" http://localhost:3000/api/health
```

## Configuration

### Environment Variables
- `SECURITY_SCAN`: Enable/disable security scanning
- `SIZE_LIMIT_MB`: Maximum image size threshold
- `NODE_ENV`: Set to 'production' for optimizations

### Tool Configuration
- `.dive-ci.yml`: Dive analysis settings
- Security scan policies in scripts
- Performance thresholds

## Maintenance

### Regular Tasks
1. Update base images monthly
2. Review security scan results
3. Monitor performance metrics
4. Update optimization scripts

### Updates
1. Test optimization changes in staging
2. Document configuration changes
3. Update thresholds as needed
4. Review security policies

## Resources

- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy)
- [Dive Image Analyzer](https://github.com/wagoodman/dive)
- [Alpine Linux Security](https://alpinelinux.org/about/) 