import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// Find workspace root by looking for pnpm-workspace.yaml or root package.json
function findWorkspaceRoot(): string {
  // Get the directory of this file
  // This file is at: apps/backend/src/utils/projectRoot.ts
  // So we need to go up 3 levels to reach the workspace root
  const currentDir = __dirname; // This will be apps/backend/src/utils in compiled JS
  const workspaceRoot = path.resolve(currentDir, '../../..');
  
  // Verify it's the workspace root by checking for pnpm-workspace.yaml or root package.json
  if (existsSync(path.join(workspaceRoot, 'pnpm-workspace.yaml')) || 
      existsSync(path.join(workspaceRoot, 'package.json'))) {
    return workspaceRoot;
  }
  
  // Fallback: try going up one more level if needed
  const parentRoot = path.resolve(workspaceRoot, '..');
  if (existsSync(path.join(parentRoot, 'pnpm-workspace.yaml')) || 
      existsSync(path.join(parentRoot, 'package.json'))) {
    return parentRoot;
  }
  
  // Last resort: return the calculated workspace root
  return workspaceRoot;
}

// Get the project root from environment variable or default to workspace root
let cachedProjectRoot: string | null = null;

export function getProjectRoot(): string {
  // Check if we have a cached value
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }
  
  // Check environment variable first
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (existsSync(resolved)) {
      cachedProjectRoot = resolved;
      return resolved;
    }
  }
  
  // Default to workspace root
  const workspaceRoot = findWorkspaceRoot();
  cachedProjectRoot = workspaceRoot;
  return workspaceRoot;
}

export function setProjectRoot(root: string): void {
  const resolved = path.resolve(root);
  // Create directory if it doesn't exist
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true });
  }
  cachedProjectRoot = resolved;
}

export function resetProjectRoot(): void {
  cachedProjectRoot = null;
}

