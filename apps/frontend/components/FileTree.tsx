'use client';

import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getBackendUrl } from '@/utils/config';

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileNode | null; parentPath?: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [createInput, setCreateInput] = useState({ name: '', type: 'file' as 'file' | 'directory', content: '' });
  const [renameInput, setRenameInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [createParentPath, setCreateParentPath] = useState<string>('');
  const [draggedFile, setDraggedFile] = useState<FileNode | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const { addTab, isFileOpen, switchTab, getTabByPath } = useEditorStore();

  useEffect(() => {
    loadProjectRoot();
    loadTree();
    
    // Listen for refresh events from other components (e.g., after file creation)
    const handleRefresh = () => {
      loadTree();
    };
    
    window.addEventListener('refresh-file-tree', handleRefresh);
    
    // Close context menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('refresh-file-tree', handleRefresh);
      document.removeEventListener('mousedown', handleClickOutside);
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
        // Check if file is already open, if so switch to it, otherwise add new tab
        if (isFileOpen(file.path)) {
          const existingTab = getTabByPath(file.path);
          if (existingTab) {
            switchTab(existingTab.id);
          }
        } else {
          addTab(file.path, data.content);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
        alert(`Failed to load file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileNode, parentPath?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file, parentPath });
  };

  const handleCreate = async () => {
    if (!createInput.name.trim()) return;

    try {
      // Determine the parent directory path
      const parentPath = createParentPath || projectRoot || '';
      // Construct the full path
      const newPath = parentPath ? `${parentPath}/${createInput.name.trim()}` : createInput.name.trim();

      const response = await fetch(`${getBackendUrl()}/fs/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: newPath,
          type: createInput.type,
          content: createInput.content || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to create file/directory');
      }

      setShowCreateModal(false);
      setCreateInput({ name: '', type: 'file', content: '' });
      setCreateParentPath('');
      loadTree();
    } catch (error) {
      alert(`Failed to create: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleRename = async () => {
    if (!renameInput.trim() || !selectedFile) return;

    try {
      const oldPath = selectedFile.path;
      const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = parentDir ? `${parentDir}/${renameInput.trim()}` : renameInput.trim();

      // Encode the path properly for URL
      const pathSegments = oldPath.split('/').map(segment => encodeURIComponent(segment));
      const encodedPath = pathSegments.join('/');

      const response = await fetch(`${getBackendUrl()}/fs/file/${encodedPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to rename file/directory');
      }

      setShowRenameModal(false);
      setRenameInput('');
      setSelectedFile(null);
      loadTree();
    } catch (error) {
      alert(`Failed to rename: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    if (!confirm(`Are you sure you want to delete "${selectedFile.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Encode the path properly for URL
      const pathSegments = selectedFile.path.split('/').map(segment => encodeURIComponent(segment));
      const encodedPath = pathSegments.join('/');

      const response = await fetch(`${getBackendUrl()}/fs/file/${encodedPath}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to delete file/directory');
      }

      setShowDeleteModal(false);
      setSelectedFile(null);
      loadTree();
    } catch (error) {
      alert(`Failed to delete: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openCreateModal = (parentPath?: string) => {
    setCreateParentPath(parentPath || '');
    setCreateInput({ name: '', type: 'file', content: '' });
    setShowCreateModal(true);
    setContextMenu(null);
  };

  const openRenameModal = (file: FileNode) => {
    setSelectedFile(file);
    setRenameInput(file.name);
    setShowRenameModal(true);
    setContextMenu(null);
  };

  const openDeleteModal = (file: FileNode) => {
    setSelectedFile(file);
    setShowDeleteModal(true);
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, file: FileNode) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', file.path);
    setDraggedFile(file);
  };

  const handleDragOver = (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    // Only allow dropping on directories
    if (targetNode.type === 'directory' && draggedFile) {
      // Don't allow dropping on:
      // 1. The dragged file itself
      // 2. A parent of the dragged file
      // 3. A child of the dragged file (if dragging a directory)
      const isSelf = targetNode.path === draggedFile.path;
      const isParent = draggedFile.path.startsWith(targetNode.path + '/');
      const isChild = targetNode.path.startsWith(draggedFile.path + '/');
      
      if (!isSelf && !isParent && !isChild) {
        setDragOverPath(targetNode.path);
      } else {
        setDragOverPath(null);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag over if we're leaving the element (not entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverPath(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetNode: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);

    if (!draggedFile) return;

    // Only allow dropping on directories
    if (targetNode.type !== 'directory') {
      return;
    }

    // Don't allow dropping on:
    // 1. The dragged file itself
    // 2. A parent of the dragged file
    // 3. A child of the dragged file (if dragging a directory)
    const isSelf = targetNode.path === draggedFile.path;
    const isParent = draggedFile.path.startsWith(targetNode.path + '/');
    const isChild = targetNode.path.startsWith(draggedFile.path + '/');
    
    if (isSelf || isParent || isChild) {
      return;
    }

    try {
      const newPath = `${targetNode.path}/${draggedFile.name}`;

      // Encode the path properly for URL
      const pathSegments = draggedFile.path.split('/').map(segment => encodeURIComponent(segment));
      const encodedPath = pathSegments.join('/');

      const response = await fetch(`${getBackendUrl()}/fs/file/${encodedPath}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPath }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || 'Failed to move file/directory');
      }

      // Expand the target directory to show the moved file
      setExpanded((prev) => new Set(prev).add(targetNode.path));
      
      // Refresh the tree
      loadTree();
    } catch (error) {
      alert(`Failed to move: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDraggedFile(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedFile(null);
    setDragOverPath(null);
  };

  const renderNode = (node: FileNode, level: number = 0, parentPath?: string) => {
    const isExpanded = expanded.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const isDragged = draggedFile?.path === node.path;
    const isDragOver = dragOverPath === node.path && node.type === 'directory';
    const canDrop = draggedFile && 
                    node.type === 'directory' && 
                    node.path !== draggedFile.path && 
                    !draggedFile.path.startsWith(node.path + '/') &&
                    !node.path.startsWith(draggedFile.path + '/');

    return (
      <div key={node.path}>
        <div
          draggable={true}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node)}
          onDragEnd={handleDragEnd}
          className={`flex items-center px-2 py-1 cursor-pointer select-none transition-colors ${
            isDragged ? 'opacity-50' : ''
          } ${
            isDragOver && canDrop
              ? 'bg-blue-200 border-2 border-blue-400 border-dashed'
              : canDrop && draggedFile
              ? 'bg-blue-50'
              : node.type === 'file'
              ? 'text-gray-800 hover:bg-gray-200'
              : 'font-medium hover:bg-gray-200'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFileClick(node)}
          onContextMenu={(e) => handleContextMenu(e, node, parentPath)}
        >
          {node.type === 'directory' && (
            <span className="mr-1.5 text-sm">
              {isExpanded ? '📂' : '📁'}
            </span>
          )}
          {node.type === 'file' && <span className="mr-1.5 text-sm">📄</span>}
          <span className="text-[13px]">{node.name}</span>
          {isDragOver && canDrop && (
            <span className="ml-auto text-xs text-blue-600">Drop here</span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1, node.path))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="px-4 py-3 font-semibold border-b border-gray-300 bg-white">
        <div className="flex justify-between items-center w-full">
          <span>Files</span>
          <div className="flex gap-1">
            <button
              onClick={() => openCreateModal()}
              className="px-1.5 py-0.5 text-[11px] cursor-pointer bg-transparent border border-gray-600 text-gray-300 rounded"
              title="Create new file or directory"
            >
              ➕
            </button>
            <button
              onClick={() => setShowRootInput(!showRootInput)}
              className="px-1.5 py-0.5 text-[11px] cursor-pointer bg-transparent border border-gray-600 text-gray-300 rounded"
              title="Change project root folder"
            >
              ⚙️
            </button>
          </div>
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

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white border border-gray-300 rounded shadow-lg z-50 py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.file && (
            <>
              <button
                onClick={() => openRenameModal(contextMenu.file!)}
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
              >
                Rename
              </button>
              <button
                onClick={() => openDeleteModal(contextMenu.file!)}
                className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100 text-red-600"
              >
                Delete
              </button>
              <div className="border-t border-gray-200 my-1"></div>
            </>
          )}
          <button
            onClick={() => openCreateModal(contextMenu.file?.type === 'directory' ? contextMenu.file.path : contextMenu.parentPath)}
            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
          >
            New File
          </button>
          <button
            onClick={() => {
              setCreateInput({ name: '', type: 'directory', content: '' });
              setCreateParentPath(contextMenu.file?.type === 'directory' ? contextMenu.file.path : contextMenu.parentPath || '');
              setShowCreateModal(true);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-gray-100"
          >
            New Directory
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-96">
            <h3 className="font-semibold mb-3">Create New</h3>
            <div className="mb-3">
              <label className="block text-sm mb-1">Type:</label>
              <div className="flex gap-4">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="createType"
                    value="file"
                    checked={createInput.type === 'file'}
                    onChange={() => setCreateInput({ ...createInput, type: 'file' })}
                    className="mr-2"
                  />
                  <span className="text-sm">File</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="createType"
                    value="directory"
                    checked={createInput.type === 'directory'}
                    onChange={() => setCreateInput({ ...createInput, type: 'directory' })}
                    className="mr-2"
                  />
                  <span className="text-sm">Directory</span>
                </label>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Name:</label>
              <input
                type="text"
                value={createInput.name}
                onChange={(e) => setCreateInput({ ...createInput, name: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder={createInput.type === 'file' ? 'filename.txt' : 'directory-name'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreate();
                  } else if (e.key === 'Escape') {
                    setShowCreateModal(false);
                  }
                }}
              />
            </div>
            {createInput.type === 'file' && (
              <div className="mb-3">
                <label className="block text-sm mb-1">Content (optional):</label>
                <textarea
                  value={createInput.content}
                  onChange={(e) => setCreateInput({ ...createInput, content: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  rows={4}
                  placeholder="File content..."
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateInput({ name: '', type: 'file', content: '' });
                  setCreateParentPath('');
                }}
                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-96">
            <h3 className="font-semibold mb-3">Rename {selectedFile.type === 'file' ? 'File' : 'Directory'}</h3>
            <div className="mb-3">
              <label className="block text-sm mb-1">New name:</label>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRename();
                  } else if (e.key === 'Escape') {
                    setShowRenameModal(false);
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleRename}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameInput('');
                  setSelectedFile(null);
                }}
                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-96">
            <h3 className="font-semibold mb-3 text-red-600">Delete {selectedFile.type === 'file' ? 'File' : 'Directory'}</h3>
            <p className="mb-3 text-sm">
              Are you sure you want to delete <strong>"{selectedFile.name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 bg-red-600 text-white rounded text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedFile(null);
                }}
                className="px-3 py-1.5 bg-gray-300 text-gray-700 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

