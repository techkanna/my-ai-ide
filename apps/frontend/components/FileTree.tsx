'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getBackendUrl } from '@/src/config';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export function FileTree() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectRoot, setProjectRootState] = useState<string>('');
  const [showRootInput, setShowRootInput] = useState(false);
  const [rootInput, setRootInput] = useState('');
  const { setCurrentFile } = useEditorStore();

  useEffect(() => {
    loadProjectRoot();
    loadTree();
    
    // Listen for refresh events from other components (e.g., after file creation)
    const handleRefresh = () => {
      loadTree();
    };
    
    window.addEventListener('refresh-file-tree', handleRefresh);
    return () => {
      window.removeEventListener('refresh-file-tree', handleRefresh);
    };
  }, []);

  const loadProjectRoot = async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/fs/root`);
      if (response.ok) {
        const data = await response.json();
        setProjectRootState(data.root || '');
      }
    } catch (error) {
      console.error('Failed to load project root:', error);
    }
  };

  const handleSetRoot = async () => {
    if (!rootInput.trim()) return;
    
    try {
      const response = await fetch(`${getBackendUrl()}/fs/root`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ root: rootInput.trim() }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to set project root');
      }
      
      const data = await response.json();
      setProjectRootState(data.root);
      setShowRootInput(false);
      setRootInput('');
      loadTree(); // Refresh the file tree
    } catch (error) {
      alert(`Failed to set project root: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const loadTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${getBackendUrl()}/fs/tree`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to load file tree: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTree(data.tree || []);
      if (data.root) {
        setProjectRootState(data.root);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Is the backend server running?');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to load file tree');
      }
      console.error('Failed to load file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpanded(newExpanded);
  };

  const handleFileClick = async (file: FileNode) => {
    if (file.type === 'directory') {
      toggleExpanded(file.path);
    } else {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Encode the path properly for URL - encode each segment separately to preserve slashes
        const pathSegments = file.path.split('/').map(segment => encodeURIComponent(segment));
        const encodedPath = pathSegments.join('/');
        
        const response = await fetch(`${getBackendUrl()}/fs/file/${encodedPath}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || `Failed to load file: ${response.statusText}`);
        }
        
        const data = await response.json();
        setCurrentFile(file.path, data.content);
      } catch (error) {
        console.error('Failed to load file:', error);
        alert(`Failed to load file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expanded.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className={`flex items-center px-2 py-1 cursor-pointer select-none transition-colors hover:bg-gray-200 ${
            node.type === 'file' ? 'text-gray-800' : 'font-medium'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
        >
          {node.type === 'directory' && (
            <span className="mr-1.5 text-sm">
              {isExpanded ? '📂' : '📁'}
            </span>
          )}
          {node.type === 'file' && <span className="mr-1.5 text-sm">📄</span>}
          <span className="text-[13px]">{node.name}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 font-semibold border-b border-gray-300 bg-white">
        <div className="flex justify-between items-center w-full">
          <span>Files</span>
          <button
            onClick={() => setShowRootInput(!showRootInput)}
            className="px-1.5 py-0.5 text-[11px] cursor-pointer bg-transparent border border-gray-600 text-gray-300 rounded"
            title="Change project root folder"
          >
            ⚙️
          </button>
        </div>
        {showRootInput && (
          <div className="mt-2 p-2 bg-gray-800 rounded">
            <div className="text-[11px] text-gray-400 mb-1">
              Current: {projectRoot || 'Not set'}
            </div>
            <input
              type="text"
              value={rootInput}
              onChange={(e) => setRootInput(e.target.value)}
              placeholder="/path/to/project"
              className="w-full px-1 py-1 text-xs bg-gray-900 border border-gray-600 text-white rounded mb-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetRoot();
                } else if (e.key === 'Escape') {
                  setShowRootInput(false);
                  setRootInput('');
                }
              }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleSetRoot}
                className="px-2 py-1 text-[11px] bg-blue-600 border-none text-white rounded cursor-pointer flex-1"
              >
                Set
              </button>
              <button
                onClick={() => {
                  setShowRootInput(false);
                  setRootInput('');
                }}
                className="px-2 py-1 text-[11px] bg-gray-600 border-none text-white rounded cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {loading && <div className="p-4 text-center text-gray-600 text-[13px]">Loading files...</div>}
        {error && (
          <div className="p-4 text-red-600 text-[13px]">
            <div>{error}</div>
            <button onClick={loadTree} className="mt-2 px-2 py-1">
              Retry
            </button>
          </div>
        )}
        {!loading && !error && tree.length === 0 && (
          <div className="p-4 text-center text-gray-500 text-[13px]">No files found</div>
        )}
        {!loading && !error && tree.map((node) => renderNode(node))}
      </div>
    </div>
  );
}

