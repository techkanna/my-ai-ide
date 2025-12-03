'use client';

import { FileTree } from '@/components/FileTree';
import { Editor } from '@/components/Editor';
import { ChatPanel } from '@/components/ChatPanel';
import { ModelSelector } from '@/components/ModelSelector';
import { getBackendUrl } from '@/src/config';
import { useEffect, useState } from 'react';

export default function Home() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

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
  }, []);

  return (
    <div className="flex h-screen w-screen">
      {backendOnline === false && (
        <div className="fixed top-0 left-0 right-0 bg-orange-500 text-white px-4 py-2 text-center z-[1000]">
          ⚠️ Backend server is not reachable. Make sure it's running on {getBackendUrl()}
        </div>
      )}
      <div className="w-[250px] border-r border-gray-300 overflow-y-auto bg-gray-100">
        <FileTree />
      </div>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Editor />
      </div>
      <div className="w-[350px] border-l border-gray-300 flex flex-col bg-gray-50">
        <ModelSelector />
        <ChatPanel />
      </div>
    </div>
  );
}

