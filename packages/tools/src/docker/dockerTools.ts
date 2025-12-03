import type { ToolDefinition } from '@my-ai-ide/agent-core';
import { promises as fs } from 'fs';
import { join, resolve, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProjectType {
  type: 'node' | 'react' | 'nextjs' | 'python' | 'python-fastapi' | 'unknown';
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip';
}

/**
 * Detect project type by examining files in the directory
 */
async function detectProjectType(projectPath: string): Promise<ProjectType> {
  try {
    const files = await fs.readdir(projectPath);
    const hasPackageJson = files.includes('package.json');
    const hasRequirementsTxt = files.includes('requirements.txt');
    const hasPipfile = files.includes('Pipfile');
    const hasPyprojectToml = files.includes('pyproject.toml');
    const hasNextConfig = files.some(f => f.includes('next.config'));
    const hasViteConfig = files.some(f => f.includes('vite.config'));
    const hasCreateReactApp = files.includes('public') && files.includes('src');

    if (hasPackageJson) {
      const packageJson = JSON.parse(await fs.readFile(join(projectPath, 'package.json'), 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (hasNextConfig || deps.next) {
        return { type: 'nextjs', framework: 'next', packageManager: 'npm' };
      }
      if (hasViteConfig || deps.vite) {
        return { type: 'react', framework: 'vite', packageManager: 'npm' };
      }
      if (hasCreateReactApp || deps.react) {
        return { type: 'react', framework: 'create-react-app', packageManager: 'npm' };
      }
      if (deps.express || deps.fastify || deps.koa) {
        return { type: 'node', framework: 'express', packageManager: 'npm' };
      }
      return { type: 'node', packageManager: 'npm' };
    }

    if (hasRequirementsTxt || hasPipfile || hasPyprojectToml) {
      const hasFastAPI = hasRequirementsTxt
        ? (await fs.readFile(join(projectPath, 'requirements.txt'), 'utf-8')).includes('fastapi')
        : false;
      
      if (hasFastAPI || hasPyprojectToml) {
        return { type: 'python-fastapi', framework: 'fastapi', packageManager: 'pip' };
      }
      return { type: 'python', packageManager: 'pip' };
    }

    return { type: 'unknown' };
  } catch (error) {
    return { type: 'unknown' };
  }
}

/**
 * Generate Dockerfile based on project type
 */
async function generateDockerfile(projectPath: string, projectType: ProjectType): Promise<string> {
  const dockerfilePath = join(projectPath, 'Dockerfile');

  let dockerfile = '';

  switch (projectType.type) {
    case 'nextjs':
      dockerfile = `# Next.js Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
`;
      break;

    case 'react':
      dockerfile = `# React Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
      break;

    case 'node':
      dockerfile = `# Node.js Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "index.js"]
`;
      break;

    case 'python-fastapi':
      dockerfile = `# Python FastAPI Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
`;
      break;

    case 'python':
      dockerfile = `# Python Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
`;
      break;

    default:
      dockerfile = `# Generic Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "index.js"]
`;
  }

  await fs.writeFile(dockerfilePath, dockerfile);
  return dockerfilePath;
}

/**
 * Generate docker-compose.yml for the project
 */
async function generateDockerCompose(projectPath: string, projectType: ProjectType, port?: number): Promise<string> {
  const composePath = join(projectPath, 'docker-compose.yml');
  
  const defaultPort = port || (projectType.type === 'python-fastapi' ? 8000 : 3000);
  const serviceName = 'app';

  let compose = `version: '3.8'

services:
  ${serviceName}:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${serviceName}
    ports:
      - "${defaultPort}:${defaultPort}"
    volumes:
      - .:/app
    restart: unless-stopped
`;

  if (projectType.type === 'python-fastapi' || projectType.type === 'python') {
    compose += `    environment:
      - PYTHONUNBUFFERED=1
`;
  }

  await fs.writeFile(composePath, compose);
  return composePath;
}

export function createDockerTools(projectRoot: string): ToolDefinition[] {
  return [
    {
      name: 'detect_project_type',
      description: 'Detect the type of project (Node.js, React, Next.js, Python, etc.) by examining project files',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        const projectType = await detectProjectType(resolvedPath);
        return { projectType, path: resolvedPath };
      },
    },
    {
      name: 'generate_dockerfile',
      description: 'Generate a Dockerfile for the project based on its type. Automatically detects project type if not specified.',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
          projectType: {
            type: 'string',
            description: 'Optional: Project type (node, react, nextjs, python, python-fastapi). If not provided, will auto-detect.',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        let projectType: ProjectType;

        if (args.projectType) {
          projectType = { type: args.projectType as ProjectType['type'] };
        } else {
          projectType = await detectProjectType(resolvedPath);
        }

        const dockerfilePath = await generateDockerfile(resolvedPath, projectType);
        return { 
          success: true, 
          dockerfilePath,
          projectType: projectType.type,
          message: `Generated Dockerfile for ${projectType.type} project`
        };
      },
    },
    {
      name: 'generate_docker_compose',
      description: 'Generate a docker-compose.yml file for the project',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
          port: {
            type: 'number',
            description: 'Port to expose (defaults based on project type)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        const projectType = await detectProjectType(resolvedPath);
        const port = args.port as number | undefined;

        const composePath = await generateDockerCompose(resolvedPath, projectType, port);
        return { 
          success: true, 
          composePath,
          message: 'Generated docker-compose.yml'
        };
      },
    },
    {
      name: 'build_docker_image',
      description: 'Build a Docker image for the project',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
          imageName: {
            type: 'string',
            description: 'Name for the Docker image (defaults to project directory name)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        const imageName = (args.imageName as string) || basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]/g, '-');

        try {
          const { stdout, stderr } = await execAsync(`docker build -t ${imageName} .`, {
            cwd: resolvedPath,
          });
          return { success: true, imageName, stdout, stderr };
        } catch (error: any) {
          return { 
            success: false, 
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr
          };
        }
      },
    },
    {
      name: 'run_docker_container',
      description: 'Run a Docker container from an image. Can use docker-compose if available.',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
          imageName: {
            type: 'string',
            description: 'Docker image name (if not using docker-compose)',
          },
          port: {
            type: 'number',
            description: 'Port to map (defaults based on project type)',
          },
          containerName: {
            type: 'string',
            description: 'Name for the container (defaults to project directory name)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        const containerName = (args.containerName as string) || basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]/g, '-');

        // Check if docker-compose.yml exists
        const hasCompose = await fs.access(join(resolvedPath, 'docker-compose.yml')).then(() => true).catch(() => false);

        try {
          if (hasCompose) {
            // Use docker-compose
            const { stdout, stderr } = await execAsync('docker-compose up -d', {
              cwd: resolvedPath,
            });
            return { 
              success: true, 
              method: 'docker-compose',
              containerName,
              stdout,
              stderr 
            };
          } else {
            // Use docker run
            const imageName = args.imageName as string;
            if (!imageName) {
              return { success: false, error: 'imageName is required when docker-compose.yml is not available' };
            }

            const port = args.port as number || 3000;
            const { stdout, stderr } = await execAsync(
              `docker run -d -p ${port}:${port} --name ${containerName} ${imageName}`,
              { cwd: resolvedPath }
            );
            return { 
              success: true, 
              method: 'docker run',
              containerName,
              port,
              stdout,
              stderr 
            };
          }
        } catch (error: any) {
          return { 
            success: false, 
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr
          };
        }
      },
    },
    {
      name: 'stop_docker_container',
      description: 'Stop a running Docker container',
      schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the project directory (defaults to project root)',
          },
          containerName: {
            type: 'string',
            description: 'Name of the container to stop (if not using docker-compose)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        const path = (args.path as string) || projectRoot;
        const resolvedPath = resolve(path);
        const containerName = args.containerName as string;

        // Check if docker-compose.yml exists
        const hasCompose = await fs.access(join(resolvedPath, 'docker-compose.yml')).then(() => true).catch(() => false);

        try {
          if (hasCompose) {
            const { stdout, stderr } = await execAsync('docker-compose down', {
              cwd: resolvedPath,
            });
            return { success: true, method: 'docker-compose', stdout, stderr };
          } else if (containerName) {
            const { stdout, stderr } = await execAsync(`docker stop ${containerName} && docker rm ${containerName}`, {
              cwd: resolvedPath,
            });
            return { success: true, method: 'docker', containerName, stdout, stderr };
          } else {
            return { success: false, error: 'containerName is required when docker-compose.yml is not available' };
          }
        } catch (error: any) {
          return { 
            success: false, 
            error: error.message,
            stdout: error.stdout,
            stderr: error.stderr
          };
        }
      },
    },
    {
      name: 'list_docker_containers',
      description: 'List all running Docker containers',
      schema: {
        type: 'object',
        properties: {
          all: {
            type: 'boolean',
            description: 'Include stopped containers (default: false)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>) => {
        try {
          const all = args.all as boolean || false;
          const { stdout } = await execAsync(`docker ps ${all ? '-a' : ''} --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"`);
          const containers = stdout
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              const [name, status, ports] = line.split('\t');
              return { name, status, ports };
            });
          return { containers };
        } catch (error: any) {
          return { success: false, error: error.message, containers: [] };
        }
      },
    },
  ];
}

