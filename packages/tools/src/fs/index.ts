import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export async function listFiles(root: string): Promise<FileNode[]> {
  const resolvedRoot = resolve(root);
  const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const fullPath = join(resolvedRoot, entry.name);
    const node: FileNode = {
      name: entry.name,
      path: fullPath,
      type: entry.isDirectory() ? 'directory' : 'file',
    };

    if (entry.isDirectory()) {
      try {
        node.children = await listFiles(fullPath);
      } catch {
        // Skip directories we can't read
      }
    }

    nodes.push(node);
  }

  return nodes;
}

export async function readFile(path: string): Promise<string> {
  return await fs.readFile(path, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  // Ensure parent directory exists
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function deleteFile(path: string): Promise<void> {
  const stat = await fs.stat(path);
  if (stat.isDirectory()) {
    await fs.rmdir(path, { recursive: true });
  } else {
    await fs.unlink(path);
  }
}

export async function createDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

