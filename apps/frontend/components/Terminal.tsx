'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { getBackendUrl } from '@/utils/config';

export function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  useEffect(() => {
    if (!terminalRef.current) return;

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

    // Open terminal in DOM - MUST be called before fit()
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
          // Check if container has dimensions and terminal is open
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
        // Debounce resize
        setTimeout(fitTerminal, 100);
      });
      resizeObserver.observe(terminalRef.current);
    }

    // Initial fit after ensuring container is sized and terminal is open
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      setTimeout(() => {
        fitTerminal();
        // Connect WebSocket after terminal is ready
        if (xterm) {
          connectWebSocket(xterm);
        }
      }, 300);
    });

    // Handle window resize
    const handleResize = () => {
      fitTerminal();
    };

    window.addEventListener('resize', handleResize);

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
  }, []);

  const connectWebSocket = (xterm: XTerm) => {
    setConnectionStatus('connecting');

    // Get WebSocket URL - convert http/https to ws/wss
    const backendUrl = getBackendUrl();
    const wsUrl = backendUrl.replace(/^http/, 'ws').replace(/^https/, 'wss') + '/terminal/ws';

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        xterm.writeln('\x1b[32mConnected to terminal\x1b[0m');
        
        // Send initial terminal dimensions
        if (xterm.cols && xterm.rows) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: xterm.cols,
            rows: xterm.rows,
          }));
        }
        
        // Focus terminal after a short delay to ensure it's ready
        setTimeout(() => {
          xterm.focus();
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              xterm.writeln(`\x1b[32mTerminal session started (${message.sessionId})\x1b[0m`);
              if (message.cwd) {
                xterm.writeln(`\x1b[36mWorking directory: ${message.cwd}\x1b[0m`);
              }
              break;

            case 'output':
              // Write output directly to terminal
              xterm.write(message.data);
              break;

            case 'exit':
              xterm.writeln(`\x1b[33m\r\nProcess exited with code ${message.code}\x1b[0m`);
              break;

            case 'error':
              xterm.writeln(`\x1b[31m\r\nError: ${message.message}\x1b[0m`);
              break;

            case 'resized':
              // Acknowledge resize
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
        if (xtermRef.current) {
          if (event.code !== 1000) {
            // Not a normal closure
            xtermRef.current.writeln('\x1b[33m\r\nConnection closed. Reconnecting...\x1b[0m');
            // Attempt to reconnect after a delay
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                if (xtermRef.current) {
                  connectWebSocket(xtermRef.current);
                }
              }
            }, 2000);
          } else {
            xtermRef.current.writeln('\x1b[33m\r\nConnection closed.\x1b[0m');
          }
        }
      };

      // Handle terminal input
      xterm.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'input',
              data: data,
            }));
          } catch (error) {
            console.error('Error sending input:', error);
          }
        }
      });

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
      xterm.writeln('\x1b[31mFailed to connect to terminal server.\x1b[0m');
    }
  };

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

  return (
    <div className="h-full w-full flex flex-col bg-gray-900">
      {/* Terminal Header */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="ml-4 text-gray-400 text-xs">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
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
