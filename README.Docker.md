# Docker Setup Guide

This guide explains how to run My AI IDE using Docker containers for isolated, scalable deployment.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB of free disk space

## Quick Start

### Production Mode

1. **Create environment file** (optional):
   ```bash
   cp .env.example .env
   # Edit .env to set PROJECT_ROOT and other variables
   ```

2. **Build and start containers**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

4. **View logs**:
   ```bash
   docker-compose logs -f
   ```

5. **Stop containers**:
   ```bash
   docker-compose down
   ```

### Development Mode (with hot reload)

```bash
docker-compose -f docker-compose.dev.yml up
```

This mounts your source code for live reloading during development.

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Project workspace directory (where your projects will be stored)
PROJECT_ROOT=./workspace

# Backend Configuration
BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0

# Frontend Configuration
FRONTEND_PORT=3000
```

### Project Root

The `PROJECT_ROOT` environment variable determines where your project files are stored. You can:

1. **Set via .env file**:
   ```env
   PROJECT_ROOT=/path/to/your/projects
   ```

2. **Set via docker-compose**:
   ```bash
   PROJECT_ROOT=/absolute/path/to/projects docker-compose up
   ```

3. **Change via UI**: Click the ⚙️ button in the Files panel to change the project root at runtime.

The project root directory will be created automatically if it doesn't exist.

## Volume Mounts

### Production (`docker-compose.yml`)

- **Workspace**: `${PROJECT_ROOT}:/workspace` - Your project files
- **Backend Data**: `backend-data:/app/data` - Persistent backend data

### Development (`docker-compose.dev.yml`)

- **Source Code**: Mounted for hot reload
- **Node Modules**: Named volumes to preserve dependencies
- **Workspace**: Same as production

## Scaling

### Horizontal Scaling

To scale the backend service:

```bash
docker-compose up -d --scale backend=3
```

Note: You'll need a load balancer (nginx, traefik, etc.) in front of multiple backend instances.

### Example with Nginx Load Balancer

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend
    networks:
      - ai-ide-network

  backend:
    # ... same as before
    # Remove ports mapping, nginx will handle it
```

## Building Images

### Build individual services:

```bash
# Backend
docker build -f Dockerfile.backend -t my-ai-ide-backend .

# Frontend
docker build -f Dockerfile.frontend -t my-ai-ide-frontend .
```

### Build with docker-compose:

```bash
docker-compose build
```

## Troubleshooting

### Port Already in Use

If ports 3000 or 3001 are already in use, change them in `.env`:

```env
FRONTEND_PORT=3002
BACKEND_PORT=3003
```

### Permission Issues

If you encounter permission issues with mounted volumes:

```bash
# Fix ownership (Linux/Mac)
sudo chown -R $USER:$USER ./workspace
```

### Container Won't Start

1. Check logs:
   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. Verify environment variables:
   ```bash
   docker-compose config
   ```

3. Rebuild images:
   ```bash
   docker-compose build --no-cache
   ```

### Out of Memory

If containers are running out of memory:

1. Increase Docker memory limit in Docker Desktop settings
2. Or add memory limits in docker-compose.yml:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             memory: 1G
   ```

## Production Deployment

For production, consider:

1. **Use a reverse proxy** (nginx, traefik) for SSL/TLS
2. **Set up health checks** (already included)
3. **Use Docker secrets** for sensitive data
4. **Enable resource limits**
5. **Set up log aggregation**
6. **Use a container orchestration platform** (Kubernetes, Docker Swarm)

## Network Architecture

```
Internet
   ↓
[Reverse Proxy / Load Balancer]
   ↓
[Frontend Container] ←→ [Backend Container(s)]
                            ↓
                        [Workspace Volume]
```

## Clean Up

Remove all containers, volumes, and networks:

```bash
docker-compose down -v
```

Remove images:

```bash
docker-compose down --rmi all
```

