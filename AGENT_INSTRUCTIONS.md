# Agent Instructions for Creating Apps

When creating a new application, follow these steps:

1. **Create a fresh app directory** using the `create_app_directory` tool:
   - Use a descriptive name (e.g., "portfolio-website", "todo-api")
   - This ensures the app is in an isolated folder

2. **Create the application files** in that directory:
   - Start with `package.json` for Node.js apps
   - Add source files, configuration, etc.

3. **Generate Docker files**:
   - Use `detect_project_type` to identify the project
   - Use `generate_dockerfile` to create a Dockerfile
   - Use `generate_docker_compose` to create docker-compose.yml

4. **All Dockerfiles should use `node:20-alpine` as the base image** for Node.js projects.

## Example Workflow

When user asks: "Create a React portfolio website with Docker"

1. Call `create_app_directory` with appName: "portfolio-website"
2. Create files in that directory:
   - package.json
   - src/App.jsx
   - src/index.js
   - public/index.html
   - etc.
3. Call `generate_dockerfile` for the app directory
4. Call `generate_docker_compose` for the app directory
5. Optionally call `build_docker_image` and `run_docker_container`

## Important Notes

- **Always create apps in subdirectories**, never in the project root
- **Use node:20-alpine** as the base image for Node.js projects
- **Generate Docker files** automatically for all apps
- **Isolate each app** in its own directory

