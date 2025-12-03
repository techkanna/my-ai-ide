# Docker Tools for Auto-Containerization

The IDE now includes automatic Docker containerization for apps you create! When you ask the LLM to create a new app, it will automatically:

1. **Detect the project type** (React, Next.js, Node.js, Python, FastAPI, etc.)
2. **Generate appropriate Dockerfiles** based on the project type
3. **Create docker-compose.yml** for easy management
4. **Build and run containers** in isolated environments

## How It Works

### Automatic Detection

The IDE automatically detects project types by examining:
- `package.json` for Node.js/React/Next.js projects
- `requirements.txt`, `Pipfile`, or `pyproject.toml` for Python projects
- Framework-specific files (e.g., `next.config.js`, `vite.config.js`)

### Supported Project Types

- **Next.js** - Full-stack React framework
- **React** - React apps (Vite, Create React App)
- **Node.js** - Express, Fastify, Koa backends
- **Python FastAPI** - FastAPI web applications
- **Python** - Generic Python applications

## Usage Examples

### Example 1: Create a React App

Ask the LLM:
```
Create a React portfolio website with Docker support
```

The LLM will:
1. Create the React app files
2. Generate a Dockerfile optimized for React
3. Create docker-compose.yml
4. Optionally build and run the container

### Example 2: Create a Node.js API

Ask the LLM:
```
Create a Node.js Express API with Docker containerization
```

The LLM will:
1. Create Express server files
2. Generate Node.js Dockerfile
3. Set up docker-compose.yml
4. Containerize the API

### Example 3: Create a Python FastAPI App

Ask the LLM:
```
Create a FastAPI REST API with Docker
```

The LLM will:
1. Create FastAPI application
2. Generate Python Dockerfile with uvicorn
3. Create docker-compose.yml
4. Set up isolated container

## Available Docker Tools

The agent has access to these Docker tools:

### `detect_project_type`
Detects the type of project by examining files.

### `generate_dockerfile`
Generates a Dockerfile based on project type. Auto-detects if type not specified.

### `generate_docker_compose`
Creates a docker-compose.yml file for the project.

### `build_docker_image`
Builds a Docker image for the project.

### `run_docker_container`
Runs a Docker container. Uses docker-compose if available, otherwise docker run.

### `stop_docker_container`
Stops a running Docker container.

### `list_docker_containers`
Lists all running (or all) Docker containers.

## Manual Usage

You can also use these tools manually via the chat:

```
Detect the project type in ./my-app
```

```
Generate a Dockerfile for this project
```

```
Build and run this project in Docker
```

## Container Management

### View Running Containers

The IDE can list all running containers and show their status, ports, and images.

### View Logs

Access container logs to debug issues.

### Start/Stop Containers

Easily start, stop, or restart containers as needed.

## Benefits

1. **Isolation**: Each app runs in its own isolated environment
2. **No Conflicts**: Dependencies don't interfere with each other
3. **Portability**: Apps can run anywhere Docker is installed
4. **Scalability**: Easy to scale individual apps
5. **Consistency**: Same environment across dev/staging/prod
6. **Easy Cleanup**: Remove containers without affecting your system

## Generated Files

When you create an app, the IDE generates:

- **Dockerfile** - Optimized for your project type
- **docker-compose.yml** - For easy container management
- **.dockerignore** (optional) - To exclude unnecessary files

## Example Generated Files

### Next.js Dockerfile
```dockerfile
FROM node:20-alpine AS base
# Multi-stage build optimized for Next.js
# ... (see generated file)
```

### React Dockerfile
```dockerfile
FROM node:20-alpine AS build
# Build React app
# Serve with nginx
```

### Python FastAPI Dockerfile
```dockerfile
FROM python:3.11-slim
# Install dependencies
# Run with uvicorn
```

## Tips

1. **Project Root**: Set your project root to an empty folder before creating apps
2. **Port Conflicts**: The IDE automatically assigns ports, but you can specify custom ports
3. **Multiple Apps**: Each app gets its own container, so you can run multiple apps simultaneously
4. **Development**: Use docker-compose for development with volume mounts for hot reload

## Troubleshooting

### Docker Not Running
Make sure Docker is installed and running on your system.

### Port Already in Use
Change the port in docker-compose.yml or specify a different port when running.

### Build Fails
Check the container logs for detailed error messages.

### Permission Issues
On Linux, you may need to add your user to the docker group:
```bash
sudo usermod -aG docker $USER
```

## Next Steps

After creating an app with Docker:

1. **Review** the generated Dockerfile
2. **Customize** if needed (add environment variables, volumes, etc.)
3. **Build** the image: `docker build -t my-app .`
4. **Run** the container: `docker-compose up` or use the IDE tools
5. **Access** your app at the configured port

