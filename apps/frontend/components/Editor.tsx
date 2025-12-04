'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useEditorStore } from '@/store/editorStore';
import { getBackendUrl } from '@/utils/config';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function Editor() {
  const { getActiveTab, updateTabContent, activeTabId } = useEditorStore();
  const activeTab = getActiveTab();
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousTabIdRef = useRef<string | null>(null);

  const saveFile = useCallback(async (tabId: string, path: string, content: string, isManual: boolean = false) => {
    setSaveStatus('saving');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`${getBackendUrl()}/fs/file/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      // Mark tab as saved
      updateTabContent(tabId, content, false);
      setSaveStatus('saved');
      
      // Hide the indicator after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
      
      // Hide error indicator after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }, [updateTabContent]);

  const handleManualSave = useCallback(async () => {
    if (!activeTab) return;
    await saveFile(activeTab.id, activeTab.path, activeTab.content, true);
  }, [activeTab, saveFile]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setLoading(false);
    
    // Add Ctrl+S keyboard shortcut in Monaco
    if (monaco) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (activeTab) {
          handleManualSave();
        }
      });
    }
  };

  // Update editor content when tab switches
  useEffect(() => {
    if (editorRef.current && activeTab && previousTabIdRef.current !== activeTabId) {
      // Only update if tab actually changed
      if (previousTabIdRef.current !== null) {
        editorRef.current.setValue(activeTab.content);
      }
      previousTabIdRef.current = activeTabId;
    }
  }, [activeTabId, activeTab]);

  useEffect(() => {
    // Handle Ctrl+S globally as fallback
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleManualSave]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && activeTab) {
      const currentTabId = activeTab.id;
      const currentTabPath = activeTab.path;
      
      // Update tab content and mark as unsaved
      updateTabContent(currentTabId, value, true);
      
      // Auto-save with debounce
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        // Get current active tab to ensure we're saving the right one
        const currentActiveTab = getActiveTab();
        if (currentActiveTab && currentActiveTab.id === currentTabId) {
          saveFile(currentTabId, currentTabPath, value, false);
        }
      }, 1000); // Auto-save after 1 second of inactivity
    }
  };


  // Get language from file extension
  const getLanguage = (path: string | null) => {
    if (!path) return 'typescript';
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'json': 'json',
      'css': 'css',
      'html': 'html',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'sql': 'sql',
      'sh': 'shell',
      'yaml': 'yaml',
      'yml': 'yaml',
    };
    return languageMap[ext || ''] || 'typescript';
  };

  if (!activeTab) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-lg mb-2">No file open</p>
          <p className="text-sm">Click a file in the file tree to open it</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600">
          Loading editor...
        </div>
      )}
      {/* Save Status Indicator */}
      {saveStatus !== 'idle' && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2 transition-opacity ${
            saveStatus === 'saving'
              ? 'bg-blue-500 text-white'
              : saveStatus === 'saved'
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {saveStatus === 'saving' && (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">All changes saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-medium">Failed to save</span>
            </>
          )}
        </div>
      )}
      <MonacoEditor
        height="100%"
        language={getLanguage(activeTab.path)}
        value={activeTab.content}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        loading={<div>Loading editor...</div>}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
        key={activeTab.id} // Force remount when tab changes to ensure proper content update
      />
    </div>
  );
}

