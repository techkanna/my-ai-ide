'use client';

import { useState, useRef, useEffect } from 'react';
import { getBackendUrl } from '@/src/config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${getBackendUrl()}/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: input,
          provider: 'ollama-local',
          model: localStorage.getItem('modelConfig') ? JSON.parse(localStorage.getItem('modelConfig') || '{}').model : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessage = '';
      let hasError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'result' && parsed.finalMessage) {
                assistantMessage = parsed.finalMessage;
              } else if (parsed.type === 'error') {
                assistantMessage = `Error: ${parsed.error}`;
                hasError = true;
              } else if (parsed.type === 'connected') {
                // Connection established, continue
                continue;
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse SSE data:', data, e);
            }
          }
        }
      }

      if (assistantMessage) {
        setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);
      } else if (!hasError) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'No response received from agent.' }]);
      }
      
      // Refresh file tree after agent actions (in case files were created/modified)
      window.dispatchEvent(new Event('refresh-file-tree'));
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : String(error)}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 font-semibold border-b border-gray-300 bg-white">Chat</div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="text-[11px] font-semibold text-gray-600 uppercase">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className={`px-3 py-2 rounded-lg max-w-[80%] break-words ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}>{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col gap-1">
            <div className="px-3 py-2 rounded-lg max-w-[80%] break-words bg-gray-200 text-gray-800">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-3 border-t border-gray-300 bg-white flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          rows={3}
          className="w-full px-2 py-2 border border-gray-300 rounded resize-none font-inherit text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button 
          onClick={handleSend} 
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white border-none rounded cursor-pointer font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}

