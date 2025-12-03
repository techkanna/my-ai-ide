'use client';

import { useEffect, useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useEditorStore } from '@/store/editorStore';
import { getBackendUrl } from '@/src/config';

export function Editor() {
  const { currentFile, content, setContent } = useEditorStore();
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    setLoading(false);
  };

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      setContent(value);
      // Auto-save
      if (currentFile) {
        saveFile(currentFile, value);
      }
    }
  };

  const saveFile = async (path: string, content: string) => {
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
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  return (
    <div className="h-full w-full relative">
      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-600">
          Loading editor...
        </div>
      )}
      <MonacoEditor
        height="100%"
        defaultLanguage="typescript"
        value={content}
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
      />
    </div>
  );
}

