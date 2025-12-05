'use client';

import { FileTree } from '@/components/FileTree';
import { Editor } from '@/components/Editor';
import { ChatPanel } from '@/components/ChatPanel';
import { ModelSelector } from '@/components/ModelSelector';
import { TabBar } from '@/components/TabBar';
import { getBackendUrl } from '@/utils/config';
import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if backend is online
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(`${getBackendUrl()}/models/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        setBackendOnline(response.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    checkBackend();

    // Load saved sidebar width
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= 200 && width <= 800) {
        setSidebarWidth(width);
      }
    }
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 200px and 800px
      const constrainedWidth = Math.max(200, Math.min(800, newWidth));
      setSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        localStorage.setItem('sidebarWidth', String(sidebarWidth));
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

  return (
    <div className="flex h-screen w-screen">
      {backendOnline === false && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white px-4 py-2 text-center z-50">
          ⚠️ Backend server is not reachable. Make sure it's running on {getBackendUrl()}
        </div>
      )}
      <div className="w-[250px] border-r border-gray-300 overflow-y-auto bg-gray-100">
        <FileTree />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <TabBar />
        <div className="flex-1 overflow-hidden">
          <Editor />
        </div>
      </div>
      <div 
        ref={sidebarRef}
        className="border-l border-gray-300 flex flex-col bg-gray-50 relative h-screen overflow-hidden"
        style={{ width: `${sidebarWidth}px`, minWidth: '200px', maxWidth: '800px' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          style={{ marginLeft: '-4px', width: '8px' }}
        />
        <div className="flex-shrink-0">
          <ModelSelector />
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

