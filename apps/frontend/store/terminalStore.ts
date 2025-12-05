import { create } from 'zustand';

export interface TerminalSession {
  id: string;
  tabId: string;
  cwd: string;
  history: string[];
  historyIndex: number;
  currentInput: string;
  isConnected: boolean;
  sessionId?: string; // Backend session ID
}

interface TerminalState {
  sessions: Map<string, TerminalSession>;
  getSession: (tabId: string) => TerminalSession | undefined;
  createSession: (tabId: string, initialCwd?: string) => TerminalSession;
  updateSession: (tabId: string, updates: Partial<TerminalSession>) => void;
  deleteSession: (tabId: string) => void;
  addToHistory: (tabId: string, command: string) => void;
  getHistoryEntry: (tabId: string, direction: 'up' | 'down') => string | null;
  resetHistoryIndex: (tabId: string) => void;
  setCurrentInput: (tabId: string, input: string) => void;
  getNextTerminalName: () => string;
}

export const useTerminalStore = create<TerminalState>((set, get) => {
  let terminalCounter = 0;

  return {
    sessions: new Map(),

    getSession: (tabId: string) => {
      return get().sessions.get(tabId);
    },

    createSession: (tabId: string, initialCwd: string = '') => {
      const session: TerminalSession = {
        id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tabId,
        cwd: initialCwd,
        history: [],
        historyIndex: -1,
        currentInput: '',
        isConnected: false,
      };

      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.set(tabId, session);
        return { sessions: newSessions };
      });

      return session;
    },

    updateSession: (tabId: string, updates: Partial<TerminalSession>) => {
      set((state) => {
        const session = state.sessions.get(tabId);
        if (!session) return state;

        const newSessions = new Map(state.sessions);
        newSessions.set(tabId, { ...session, ...updates });
        return { sessions: newSessions };
      });
    },

    deleteSession: (tabId: string) => {
      set((state) => {
        const newSessions = new Map(state.sessions);
        newSessions.delete(tabId);
        return { sessions: newSessions };
      });
    },

    addToHistory: (tabId: string, command: string) => {
      const trimmedCommand = command.trim();
      if (!trimmedCommand) return;

      set((state) => {
        const session = state.sessions.get(tabId);
        if (!session) return state;

        // Don't add duplicate consecutive commands
        const lastCommand = session.history[session.history.length - 1];
        if (lastCommand === trimmedCommand) {
          return state;
        }

        const newHistory = [...session.history, trimmedCommand];
        // Limit history to 1000 commands
        const limitedHistory = newHistory.slice(-1000);

        const newSessions = new Map(state.sessions);
        newSessions.set(tabId, {
          ...session,
          history: limitedHistory,
          historyIndex: limitedHistory.length,
        });

        return { sessions: newSessions };
      });
    },

    getHistoryEntry: (tabId: string, direction: 'up' | 'down') => {
      const session = get().sessions.get(tabId);
      if (!session || session.history.length === 0) return null;

      let newIndex: number;
      if (direction === 'up') {
        newIndex = session.historyIndex > 0 ? session.historyIndex - 1 : 0;
      } else {
        newIndex = session.historyIndex < session.history.length - 1
          ? session.historyIndex + 1
          : session.history.length;
      }

      get().updateSession(tabId, { historyIndex: newIndex });

      if (newIndex >= session.history.length) {
        return session.currentInput || '';
      }

      return session.history[newIndex] || null;
    },

    resetHistoryIndex: (tabId: string) => {
      const session = get().sessions.get(tabId);
      if (!session) return;

      get().updateSession(tabId, {
        historyIndex: session.history.length,
      });
    },

    setCurrentInput: (tabId: string, input: string) => {
      get().updateSession(tabId, { currentInput: input });
    },

    getNextTerminalName: () => {
      terminalCounter++;
      return `Terminal ${terminalCounter}`;
    },
  };
});



