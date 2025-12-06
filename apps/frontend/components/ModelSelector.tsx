'use client';

import { useState, useEffect, useRef } from 'react';
import { getBackendUrl } from '@/utils/config';

interface ModelInfo {
  provider: 'ollama-cloud' | 'ollama-local' | 'openai';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export function ModelSelector() {
  const [provider, setProvider] = useState<'ollama-cloud' | 'ollama-local' | 'openai'>('ollama-local');
  const [model, setModel] = useState('llama3.2');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isInitialMount = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load saved preferences
    const saved = localStorage.getItem('modelConfig');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setProvider(config.provider || 'ollama-local');
        setModel(config.model || 'llama3.2');
        setApiKey(config.apiKey || '');
        setBaseUrl(config.baseUrl || 'http://localhost:11434');
      } catch {
        // Ignore parse errors
      }
    }
    
    // Load collapsed state
    const collapsedState = localStorage.getItem('modelConfigCollapsed');
    if (collapsedState !== null) {
      setIsCollapsed(collapsedState === 'true');
    }
    
    // Mark initial mount as complete after a short delay
    setTimeout(() => {
      isInitialMount.current = false;
    }, 100);
  }, []);

  useEffect(() => {
    if (provider === 'ollama-local') {
      checkHealth();
      loadModels();
    }
  }, [provider, baseUrl]);

  const checkHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${getBackendUrl()}/models/health?baseUrl=${encodeURIComponent(baseUrl)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      setIsHealthy(data.healthy);
    } catch {
      setIsHealthy(false);
    }
  };

  const loadModels = async () => {
    // Only load models for ollama-local provider
    if (provider !== 'ollama-local') {
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${getBackendUrl()}/models/list?baseUrl=${encodeURIComponent(baseUrl)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      setAvailableModels(data.models || []);
      // Only auto-select a model if current model is not in the list AND we're using ollama-local
      if (data.models && data.models.length > 0 && provider === 'ollama-local' && !data.models.includes(model)) {
        setModel(data.models[0]);
      }
    } catch {
      setAvailableModels([]);
    }
  };

  // Auto-save configuration when fields change
  useEffect(() => {
    // Skip saving on initial mount
    if (isInitialMount.current) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid too many writes
    saveTimeoutRef.current = setTimeout(() => {
      const config: ModelInfo = {
        provider,
        model,
        apiKey: (provider === 'ollama-cloud' || provider === 'openai') ? apiKey : undefined,
        baseUrl: provider === 'ollama-local' ? baseUrl : undefined,
      };
      localStorage.setItem('modelConfig', JSON.stringify(config));
      // Notify parent component or trigger update
      window.dispatchEvent(new CustomEvent('modelConfigChanged', { detail: config }));
    }, 300); // 300ms debounce

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [provider, model, apiKey, baseUrl]);

  const toggleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('modelConfigCollapsed', String(newCollapsed));
  };

  return (
    <div className="border-b border-gray-300 bg-white flex-shrink-0">
      <div 
        className="px-4 py-3 font-semibold border-b border-gray-300 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={toggleCollapse}
      >
        <span>Model Configuration</span>
        <span className="text-gray-500 text-sm">
          {isCollapsed ? '▶' : '▼'}
        </span>
      </div>
      {!isCollapsed && (
        <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Provider</label>
          <select 
            value={provider} 
            onChange={(e) => {
              const newProvider = e.target.value as 'ollama-cloud' | 'ollama-local' | 'openai';
              setProvider(newProvider);
              // Set default model when switching providers
              if (newProvider === 'openai' && model !== 'gpt-4o-mini' && !availableModels.includes(model)) {
                setModel('gpt-4o-mini');
              } else if (newProvider === 'ollama-local' && availableModels.length > 0 && !availableModels.includes(model)) {
                setModel(availableModels[0]);
              } else if (newProvider === 'ollama-cloud' && model !== 'llama3.2') {
                setModel('llama3.2');
              }
            }}
            className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
          >
            <option value="ollama-local">Ollama Local</option>
            <option value="ollama-cloud">Ollama Cloud</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        {(provider === 'ollama-cloud' || provider === 'openai') && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter API key"
              className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {provider === 'ollama-local' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434"
                className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="text-xs">
              <span className={isHealthy ? 'text-green-600' : 'text-red-600'}>
                {isHealthy === null ? 'Checking...' : isHealthy ? '✓ Connected' : '✗ Not connected'}
              </span>
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Model</label>
          {provider === 'ollama-local' && availableModels.length > 0 ? (
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
            >
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : provider === 'openai' ? (
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.2"
              className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
        </div>
      )}
    </div>
  );
}

