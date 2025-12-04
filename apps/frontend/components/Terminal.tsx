'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { getBackendUrl } from '@/utils/config';
import { useTerminalStore } from '@/store/terminalStore';
import { useEditorStore } from '@/store/editorStore';

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputBufferRef = useRef<string>('');
  const isProcessingInputRef = useRef<boolean>(false);
  
  const { activeTabId, tabs } = useEditorStore();
  const {
    getSession,
    createSession,
    updateSession,
    deleteSession,
    addToHistory,
    getHistoryEntry,
    resetHistoryIndex,
    setCurrentInput,
  } = useTerminalStore();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [cwd, setCwd] = useState<string>('');

  // Initialize or get terminal session
  useEffect(() => {
    if (!activeTabId) return;

    const activeTab = tabs.find(t => t.id === activeTabId);
    
    // Extract initial CWD from tab content (stored in content field for terminal tabs)
    const initialCwd = activeTab?.type === 'terminal' ? activeTab.content : '';

    let session = getSession(activeTabId);
    if (!session) {
      session = createSession(activeTabId, initialCwd);
    } else if (initialCwd && !session.cwd) {
      // Update session with initial CWD if not set
      updateSession(activeTabId, { cwd: initialCwd });
    }

    // Update CWD display
    if (session.cwd) {
      setCwd(session.cwd);
    }

    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeTabId, tabs, getSession, createSession, updateSession]);

  useEffect(() => {
    if (!terminalRef.current || !activeTabId) return;

    let xterm: XTerm | null = null;
    let fitAddon: FitAddon | null = null;
    let resizeObserver: ResizeObserver | null = null;

    // Initialize xterm
    xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      allowProposedApi: true,
      convertEol: true,
      disableStdin: false,
      cursorStyle: 'block',
      lineHeight: 1.2,
      letterSpacing: 0,
    });

    // Initialize addons
    fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal in DOM
    if (terminalRef.current) {
      xterm.open(terminalRef.current);
    }

    // Store references
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Function to fit terminal with error handling
    const fitTerminal = () => {
      if (fitAddon && xterm && terminalRef.current) {
        try {
          const rect = terminalRef.current.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && xterm.element) {
            fitAddon.fit();
            // Notify server of resize with actual dimensions
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const cols = xterm.cols || 80;
              const rows = xterm.rows || 24;
              wsRef.current.send(JSON.stringify({
                type: 'resize',
                cols,
                rows,
              }));
            }
          }
        } catch (error) {
          console.warn('Error fitting terminal:', error);
        }
      }
    };

    // Use ResizeObserver to watch for container size changes
    if (terminalRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setTimeout(fitTerminal, 100);
      });
      resizeObserver.observe(terminalRef.current);
    }

    // Initial fit after ensuring container is sized and terminal is open
    requestAnimationFrame(() => {
      setTimeout(() => {
        fitTerminal();
        if (xterm && activeTabId) {
          connectWebSocket(xterm, activeTabId);
        }
      }, 300);
    });

    // Handle window resize
    const handleResize = () => {
      fitTerminal();
    };

    window.addEventListener('resize', handleResize);

    // Handle terminal input with command history
    const handleData = (data: string) => {
      if (isProcessingInputRef.current) return;

      // Handle special keys
      const charCode = data.charCodeAt(0);
      
      // Up arrow - previous history
      if (charCode === 27 && data.length > 1 && data[1] === '[' && data[2] === 'A') {
        const historyEntry = getHistoryEntry(activeTabId, 'up');
        if (historyEntry !== null) {
          // Clear current line and write history entry
          xterm.write('\r\x1b[K'); // Clear line
          xterm.write(historyEntry);
          setCurrentInput(activeTabId, historyEntry);
          inputBufferRef.current = historyEntry;
        }
        return;
      }

      // Down arrow - next history
      if (charCode === 27 && data.length > 1 && data[1] === '[' && data[2] === 'B') {
        const historyEntry = getHistoryEntry(activeTabId, 'down');
        if (historyEntry !== null) {
          xterm.write('\r\x1b[K'); // Clear line
          xterm.write(historyEntry);
          setCurrentInput(activeTabId, historyEntry);
          inputBufferRef.current = historyEntry;
        }
        return;
      }

      // Tab key - auto-completion (basic implementation)
      if (charCode === 9) {
        // Basic tab completion - could be enhanced with actual command completion
        // For now, just prevent default behavior
        return;
      }

      // Handle Enter key
      if (charCode === 13 || charCode === 10) {
        const command = inputBufferRef.current.trim();
        inputBufferRef.current = '';
        resetHistoryIndex(activeTabId);
        setCurrentInput(activeTabId, '');

        if (command) {
          // Add to history
          addToHistory(activeTabId, command);
        }

        // Send to WebSocket
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          isProcessingInputRef.current = true;
          wsRef.current.send(JSON.stringify({
            type: 'input',
            data: data,
          }));
          setTimeout(() => {
            isProcessingInputRef.current = false;
          }, 50);
        } else {
          // If not connected, just write the newline
          xterm.write(data);
        }
        return;
      }

      // Update input buffer
      if (charCode >= 32 || charCode === 8 || charCode === 127) {
        // Regular character or backspace
        if (charCode === 8 || charCode === 127) {
          // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            setCurrentInput(activeTabId, inputBufferRef.current);
          }
        } else {
          inputBufferRef.current += data;
          setCurrentInput(activeTabId, inputBufferRef.current);
        }
      }

      // Send to WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: data,
        }));
      } else {
        // If not connected, just write to terminal
        xterm.write(data);
      }
    };

    xterm.onData(handleData);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xterm) {
        xterm.dispose();
      }
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeTabId, getHistoryEntry, resetHistoryIndex, addToHistory, setCurrentInput]);

  const connectWebSocket = useCallback((xterm: XTerm, tabId: string) => {
    setConnectionStatus('connecting');

    const session = getSession(tabId);
    const initialCwd = session?.cwd || '';

    // Get WebSocket URL with initial CWD as query parameter
    const backendUrl = getBackendUrl();
    let wsUrl = backendUrl.replace(/^http/, 'ws').replace(/^https/, 'wss') + '/terminal/ws';
    if (initialCwd) {
      const encodedCwd = encodeURIComponent(initialCwd);
      wsUrl += `?cwd=${encodedCwd}`;
    }

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        updateSession(tabId, { isConnected: true });

        // Initial CWD is already sent via query parameter, but we can also send it as a message
        // for redundancy (in case query params aren't available)
        if (initialCwd) {
          // Small delay to ensure shell is ready
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'cwd',
                cwd: initialCwd,
              }));
            }
          }, 200);
        }

        // Send initial terminal dimensions
        if (xterm.cols && xterm.rows) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: xterm.cols,
            rows: xterm.rows,
          }));
        }

        // Focus terminal
        setTimeout(() => {
          xterm.focus();
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              updateSession(tabId, { sessionId: message.sessionId });
              if (message.cwd) {
                setCwd(message.cwd);
                updateSession(tabId, { cwd: message.cwd });
              }
              break;

            case 'output':
              xterm.write(message.data);
              break;

            case 'cwd':
              // Working directory changed
              if (message.cwd) {
                setCwd(message.cwd);
                updateSession(tabId, { cwd: message.cwd });
              }
              break;

            case 'exit':
              xterm.writeln(`\x1b[33m\r\nProcess exited with code ${message.code}\x1b[0m`);
              break;

            case 'error':
              xterm.writeln(`\x1b[31m\r\nError: ${message.message}\x1b[0m`);
              break;

            case 'resized':
              break;

            default:
              console.warn('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
        if (xtermRef.current) {
          xtermRef.current.writeln('\x1b[31m\r\nConnection error. Please refresh.\x1b[0m');
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        updateSession(tabId, { isConnected: false });

        if (xtermRef.current) {
          if (event.code !== 1000) {
            xtermRef.current.writeln('\x1b[33m\r\nConnection closed. Reconnecting...\x1b[0m');
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                if (xtermRef.current && activeTabId) {
                  connectWebSocket(xtermRef.current, activeTabId);
                }
              }
            }, 2000);
          } else {
            xtermRef.current.writeln('\x1b[33m\r\nConnection closed.\x1b[0m');
          }
        }
      };

      // Handle terminal resize
      xterm.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN && cols > 0 && rows > 0) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols,
            rows,
          }));
        }
      });

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
      if (xtermRef.current) {
        xtermRef.current.writeln('\x1b[31mFailed to connect to terminal server.\x1b[0m');
      }
    }
  }, [getSession, updateSession, activeTabId]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  // Get terminal name from active tab (remove CWD info from path if present)
  const activeTab = tabs.find(t => t.id === activeTabId);
  let terminalName = activeTab?.path || 'Terminal';
  // Remove CWD info in parentheses if present (e.g., "Terminal 1 (/path/to/dir)" -> "Terminal 1")
  if (terminalName.includes(' (')) {
    terminalName = terminalName.split(' (')[0];
  }

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      {/* Terminal Header */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <span className="ml-4 text-gray-400 text-xs font-medium truncate">{terminalName}</span>
          {cwd && (
            <span className="ml-2 text-gray-500 text-xs truncate" title={cwd}>
              {cwd.length > 50 ? `...${cwd.slice(-47)}` : cwd}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
          <span className="text-gray-400 text-xs">{getStatusText()}</span>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="flex-1 w-full"
        style={{
          height: '100%',
          minHeight: '200px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      />
    </div>
  );
}
