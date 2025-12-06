'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { getBackendUrl } from '@/utils/config';

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
      // Get model configuration from localStorage
      const modelConfigStr = localStorage.getItem('modelConfig');
      const modelConfig = modelConfigStr ? JSON.parse(modelConfigStr) : {};
      
      // Determine provider and model with proper defaults
      const provider = modelConfig.provider || 'ollama-local';
      let model = modelConfig.model;
      
      // Validate and set default model based on provider
      const openaiModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
      
      if (!model || model.trim() === '') {
        // No model set, use provider default
        if (provider === 'openai') {
          model = 'gpt-4o-mini';
        } else if (provider === 'ollama-cloud') {
          model = 'llama3.2';
        } else {
          model = 'llama3.2';
        }
      } else if (provider === 'openai' && !openaiModels.includes(model)) {
        // Provider is OpenAI but model is not an OpenAI model, use default
        console.warn(`Model ${model} is not valid for OpenAI provider, using default`);
        model = 'gpt-4o-mini';
      }
      
      const requestBody = {
        message: input,
        messages: messages, // Send full chat history
        provider: provider,
        model: model,
        apiKey: modelConfig.apiKey,
      };
      
      console.log('Sending request with model config:', { provider, model, hasApiKey: !!modelConfig.apiKey });
      
      const payload = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      }
      const response = await fetch(`${getBackendUrl()}/agent/run`, payload as RequestInit);

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 font-semibold border-b border-gray-300 bg-white shrink-0">Chat</div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="text-[11px] font-semibold text-gray-600 uppercase">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className={`px-3 py-2 rounded-lg max-w-[80%] wrap-break-word ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="ml-2">{children}</li>,
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-gray-300 px-1 py-0.5 rounded text-sm font-mono">{children}</code>
                        ) : (
                          <code className="block bg-gray-300 p-2 rounded text-sm font-mono overflow-x-auto mb-2">{children}</code>
                        );
                      },
                      pre: ({ children }) => <pre className="mb-2">{children}</pre>,
                      blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-400 pl-3 italic mb-2">{children}</blockquote>,
                      a: ({ href, children }) => <a href={href} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                      em: ({ children }) => <em className="italic">{children}</em>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex flex-col gap-1">
            <div className="px-3 py-2 rounded-lg max-w-[80%] wrap-break-word bg-gray-200 text-gray-800">Thinking...</div>
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

