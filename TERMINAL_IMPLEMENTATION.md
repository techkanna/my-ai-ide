# Full Terminal Implementation

## Overview

The terminal has been upgraded from a simple command panel to a full-featured terminal emulator using xterm.js and WebSocket for real-time bidirectional communication.

## Features

### ✅ Implemented Features

1. **Full Terminal Emulation**
   - xterm.js for terminal rendering
   - 256-color support with custom theme
   - Cursor blinking
   - Proper font rendering

2. **WebSocket Communication**
   - Real-time bidirectional I/O
   - Interactive shell support
   - Automatic reconnection on disconnect
   - Connection status indicator

3. **Terminal Addons**
   - **Fit Addon**: Automatically resizes terminal to container
   - **Web Links Addon**: Clickable links in terminal output

4. **Shell Process Management**
   - Spawns interactive shell (bash/sh on Unix, cmd.exe on Windows)
   - Proper environment variables (TERM, COLORTERM, etc.)
   - Process lifecycle management
   - Session tracking

5. **User Experience**
   - Connection status indicator
   - Auto-focus on connect
   - Window resize handling
   - Terminal resize notifications to server

## Architecture

### Backend (`apps/backend/src/routes/terminal.ts`)

- **WebSocket Endpoint**: `GET /terminal/ws`
  - Spawns interactive shell process
  - Manages terminal sessions
  - Handles input/output streams
  - Supports terminal resize

- **Legacy POST Endpoint**: `POST /terminal/execute`
  - Kept for backward compatibility
  - Simple command execution (non-interactive)

### Frontend (`apps/frontend/components/Terminal.tsx`)

- **xterm.js Integration**
  - Terminal instance with custom theme
  - Addons: Fit, WebLinks
  - Event handlers for input/resize

- **WebSocket Client**
  - Connects to `/terminal/ws`
  - Handles message types: connected, output, exit, error, resize
  - Auto-reconnection on disconnect

## Dependencies

### Frontend
- `xterm`: Terminal emulator
- `xterm-addon-fit`: Auto-resize terminal
- `xterm-addon-web-links`: Clickable links

### Backend
- `@fastify/websocket`: WebSocket support for Fastify

## Usage

1. Click the "Terminal" button in the TabBar
2. Terminal automatically connects via WebSocket
3. Start typing commands - they execute in real-time
4. Terminal supports:
   - Interactive commands (vim, less, etc.)
   - Colored output
   - Proper cursor handling
   - Terminal resizing

## Technical Notes

### Shell Process

The terminal spawns an interactive shell:
- **Unix/Linux**: Uses `$SHELL` or `/bin/bash` with `-i -l` flags (interactive login shell)
- **Windows**: Uses `cmd.exe`

### Environment Variables

The shell process receives:
- `TERM=xterm-256color`: Enables 256-color support
- `COLORTERM=truecolor`: Full color support
- Standard PATH, HOME, USER variables

### Security

- Commands execute within project root
- Path validation ensures commands can't escape project directory
- Session management prevents orphaned processes
- Automatic cleanup on disconnect

### Limitations

1. **No PTY Support**: Currently uses `spawn()` instead of a PTY library
   - For better terminal emulation, consider installing `node-pty`
   - Requires native compilation (may need build tools)
   - Would provide better support for interactive programs

2. **Resize Handling**: Terminal resize is acknowledged but not fully implemented
   - PTY would be needed for proper resize support
   - Current implementation works for most use cases

3. **Windows Support**: Basic support, may need adjustments for Windows-specific features

## Future Enhancements

1. **PTY Integration**: Install `node-pty` for better terminal emulation
   ```bash
   pnpm add node-pty
   ```
   Note: Requires Python and build tools for native compilation

2. **Multiple Terminal Sessions**: Support multiple terminal tabs with separate sessions

3. **Terminal Themes**: Allow users to customize terminal colors

4. **Command History**: Persistent command history across sessions

5. **Split Panes**: Multiple terminal panes in one tab

6. **Copy/Paste**: Better clipboard integration

## Troubleshooting

### Terminal Not Connecting

1. Check backend is running on correct port
2. Verify WebSocket URL conversion (http → ws)
3. Check browser console for WebSocket errors
4. Ensure CORS is properly configured

### Commands Not Working

1. Verify shell is available (`$SHELL` or `/bin/bash`)
2. Check environment variables are set correctly
3. Ensure project root is accessible

### Terminal Not Resizing

1. Check FitAddon is properly initialized
2. Verify container has proper dimensions
3. Check window resize event handlers

## Files Modified

- `apps/backend/src/routes/terminal.ts` - WebSocket terminal route
- `apps/backend/src/server.ts` - WebSocket plugin registration
- `apps/frontend/components/Terminal.tsx` - Full xterm.js implementation
- `apps/frontend/store/editorStore.ts` - Terminal tab support (already done)
- `apps/frontend/components/Editor.tsx` - Terminal rendering (already done)
- `apps/frontend/components/TabBar.tsx` - Terminal button (already done)

## Testing

1. Start backend: `pnpm --filter @my-ai-ide/backend dev`
2. Start frontend: `pnpm --filter @my-ai-ide/frontend dev`
3. Open browser to `http://localhost:3000`
4. Click "Terminal" button in TabBar
5. Try commands:
   - `ls -la`
   - `pwd`
   - `echo "Hello World"`
   - `cat package.json`
   - Interactive: `vim`, `less`, etc.



