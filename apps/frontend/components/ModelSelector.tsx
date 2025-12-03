'use client';

import { useState, useEffect } from 'react';
import { getBackendUrl } from '@/src/config';

interface ModelInfo {
  provider: 'ollama-cloud' | 'ollama-local';
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export function ModelSelector() {
  const [provider, setProvider] = useState<'ollama-cloud' | 'ollama-local'>('ollama-local');
  const [model, setModel] = useState('llama3.2');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

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
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${getBackendUrl()}/models/list?baseUrl=${encodeURIComponent(baseUrl)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      setAvailableModels(data.models || []);
      if (data.models && data.models.length > 0 && !data.models.includes(model)) {
        setModel(data.models[0]);
      }
    } catch {
      setAvailableModels([]);
    }
  };

  const handleSave = () => {
    const config: ModelInfo = {
      provider,
      model,
      apiKey: provider === 'ollama-cloud' ? apiKey : undefined,
      baseUrl: provider === 'ollama-local' ? baseUrl : undefined,
    };
    localStorage.setItem('modelConfig', JSON.stringify(config));
    // Notify parent component or trigger update
    window.dispatchEvent(new CustomEvent('modelConfigChanged', { detail: config }));
  };

  return (
    <div className="border-b border-gray-300 bg-white">
      <div className="px-4 py-3 font-semibold border-b border-gray-300">Model Configuration</div>
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Provider</label>
          <select 
            value={provider} 
            onChange={(e) => setProvider(e.target.value as 'ollama-cloud' | 'ollama-local')}
            className="px-2 py-2 border border-gray-300 rounded text-sm font-inherit focus:outline-none focus:border-blue-500"
          >
            <option value="ollama-local">Ollama Local</option>
            <option value="ollama-cloud">Ollama Cloud</option>
          </select>
        </div>

        {provider === 'ollama-cloud' && (
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

        <button 
          onClick={handleSave} 
          className="px-4 py-2 bg-blue-600 text-white border-none rounded cursor-pointer font-medium hover:bg-blue-700 mt-2"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}

