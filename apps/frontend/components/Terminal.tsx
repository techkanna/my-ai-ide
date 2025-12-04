'use client';

import { useState, useRef, useEffect } from 'react';
import { getBackendUrl } from '@/utils/config';

interface CommandHistory {
  command: string;
  output: string;
  error: string;
  exitCode: number;
  timestamp: Date;
}

export function Terminal() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentDir, setCurrentDir] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const historyIndexRef = useRef<number>(-1);
  const commandHistoryRef = useRef<string[]>([]);

  // Load current directory on mount
  useEffect(() => {
    loadCurrentDir();
  }, []);

  // Scroll to bottom when history updates
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadCurrentDir = async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/terminal/cwd`);
      if (response.ok) {
        const data = await response.json();
        setCurrentDir(data.cwd || '');
      }
    } catch (error) {
      console.error('Failed to load current directory:', error);
    }
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim() || isExecuting) return;

    setIsExecuting(true);
    const commandToExecute = cmd.trim();

    // Add to command history for navigation
    if (commandToExecute && (!commandHistoryRef.current.length || commandHistoryRef.current[commandHistoryRef.current.length - 1] !== commandToExecute)) {
      commandHistoryRef.current.push(commandToExecute);
    }
    historyIndexRef.current = commandHistoryRef.current.length;

    try {
      const response = await fetch(`${getBackendUrl()}/terminal/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: commandToExecute,
          cwd: currentDir,
        }),
      });

      const result = await response.json();

      const newHistoryItem: CommandHistory = {
        command: commandToExecute,
        output: result.stdout || '',
        error: result.stderr || '',
        exitCode: result.exitCode || 0,
        timestamp: new Date(),
      };

      setHistory((prev) => [...prev, newHistoryItem]);
      setCommand('');

      // Update current directory if cd command was executed
      if (commandToExecute.startsWith('cd ')) {
        // Note: cd doesn't work in subprocess, but we can track it client-side
        // For now, we'll just reload the directory
        setTimeout(() => loadCurrentDir(), 100);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const newHistoryItem: CommandHistory = {
        command: commandToExecute,
        output: '',
        error: `Error: ${errorMessage}`,
        exitCode: 1,
        timestamp: new Date(),
      };
      setHistory((prev) => [...prev, newHistoryItem]);
      setCommand('');
    } finally {
      setIsExecuting(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndexRef.current > 0) {
        historyIndexRef.current--;
        setCommand(commandHistoryRef.current[historyIndexRef.current]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndexRef.current < commandHistoryRef.current.length - 1) {
        historyIndexRef.current++;
        setCommand(commandHistoryRef.current[historyIndexRef.current]);
      } else {
        historyIndexRef.current = commandHistoryRef.current.length;
        setCommand('');
      }
    }
  };

  const getPrompt = () => {
    const dir = currentDir ? currentDir.split('/').pop() || currentDir : '~';
    return `$ `;
  };

  const formatOutput = (text: string) => {
    if (!text) return '';
    return text.split('\n').map((line, idx) => (
      <div key={idx} className="font-mono text-sm">
        {line || ' '}
      </div>
    ));
  };

  return (
    <div className="h-full w-full flex flex-col bg-gray-900 text-green-400 font-mono text-sm">
      {/* Terminal Header */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-4 text-gray-400 text-xs">Terminal</span>
        </div>
        {currentDir && (
          <span className="text-gray-500 text-xs truncate max-w-md" title={currentDir}>
            {currentDir}
          </span>
        )}
      </div>

      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        style={{ scrollbarWidth: 'thin' }}
      >
        {history.length === 0 && (
          <div className="text-gray-500 text-sm">
            <div>Welcome to the terminal. Type a command and press Enter to execute.</div>
            <div className="mt-2">Example commands: ls, pwd, cat, echo, etc.</div>
          </div>
        )}
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            {/* Command */}
            <div className="flex items-start gap-2">
              <span className="text-green-400">{getPrompt()}</span>
              <span className="text-white flex-1">{item.command}</span>
            </div>
            {/* Output */}
            {item.output && (
              <div className="text-gray-300 ml-6 whitespace-pre-wrap">
                {formatOutput(item.output)}
              </div>
            )}
            {/* Error */}
            {item.error && (
              <div className="text-red-400 ml-6 whitespace-pre-wrap">
                {formatOutput(item.error)}
              </div>
            )}
            {/* Exit code if non-zero */}
            {item.exitCode !== 0 && (
              <div className="text-red-500 ml-6 text-xs">
                [Exit code: {item.exitCode}]
              </div>
            )}
          </div>
        ))}
        {isExecuting && (
          <div className="flex items-start gap-2">
            <span className="text-green-400">{getPrompt()}</span>
            <span className="text-white">{command}</span>
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 bg-gray-800 p-4">
        <div className="flex items-center gap-2">
          <span className="text-green-400">{getPrompt()}</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              historyIndexRef.current = commandHistoryRef.current.length;
            }}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder={isExecuting ? 'Executing...' : 'Enter command...'}
            className="flex-1 bg-transparent text-white outline-none placeholder-gray-500"
            autoFocus
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <span>↑↓</span> Navigate history • <span>Enter</span> Execute • <span>Ctrl+C</span> Cancel (coming soon)
        </div>
      </div>
    </div>
  );
}

