import { create } from 'zustand';

export interface Tab {
  id: string;
  path: string;
  content: string;
  unsaved: boolean;
}

interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  currentFile: string | null; // Deprecated, kept for backward compatibility
  content: string; // Deprecated, kept for backward compatibility
  setCurrentFile: (path: string, content: string) => void; // Deprecated
  setContent: (content: string) => void; // Deprecated
  // New tab methods
  addTab: (path: string, content: string) => string; // Returns tab ID
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string, unsaved?: boolean) => void;
  getActiveTab: () => Tab | null;
  isFileOpen: (path: string) => boolean;
  getTabByPath: (path: string) => Tab | null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  currentFile: null,
  content: '',
  
  // Legacy methods for backward compatibility
  setCurrentFile: (path: string, content: string) => {
    const tabId = get().addTab(path, content);
    get().switchTab(tabId);
  },
  setContent: (content: string) => {
    const activeTab = get().getActiveTab();
    if (activeTab) {
      get().updateTabContent(activeTab.id, content, true);
    }
  },
  
  // New tab methods
  addTab: (path: string, content: string) => {
    const state = get();
    // Check if file is already open
    const existingTab = state.getTabByPath(path);
    if (existingTab) {
      state.switchTab(existingTab.id);
      return existingTab.id;
    }
    
    // Create new tab
    const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTab: Tab = {
      id: tabId,
      path,
      content,
      unsaved: false,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
      currentFile: path, // Update legacy field
      content, // Update legacy field
    }));
    
    return tabId;
  },
  
  closeTab: (tabId: string) => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
      if (tabIndex === -1) return state;
      
      const newTabs = state.tabs.filter((t) => t.id !== tabId);
      let newActiveTabId = state.activeTabId;
      
      // If closing the active tab, switch to another tab
      if (state.activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Try to switch to the next tab, or previous if at the end
          const nextIndex = tabIndex < newTabs.length ? tabIndex : tabIndex - 1;
          newActiveTabId = newTabs[nextIndex]?.id || null;
        } else {
          newActiveTabId = null;
        }
      }
      
      const activeTab = newTabs.find((t) => t.id === newActiveTabId);
      
      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
        currentFile: activeTab?.path || null,
        content: activeTab?.content || '',
      };
    });
  },
  
  switchTab: (tabId: string) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (!tab) return state;
      
      return {
        activeTabId: tabId,
        currentFile: tab.path,
        content: tab.content,
      };
    });
  },
  
  updateTabContent: (tabId: string, content: string, unsaved: boolean = true) => {
    set((state) => {
      const newTabs = state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, content, unsaved } : tab
      );
      
      const updatedTab = newTabs.find((t) => t.id === tabId);
      const isActive = state.activeTabId === tabId;
      
      return {
        tabs: newTabs,
        content: isActive ? content : state.content,
      };
    });
  },
  
  getActiveTab: () => {
    const state = get();
    if (!state.activeTabId) return null;
    return state.tabs.find((t) => t.id === state.activeTabId) || null;
  },
  
  isFileOpen: (path: string) => {
    return get().tabs.some((tab) => tab.path === path);
  },
  
  getTabByPath: (path: string) => {
    return get().tabs.find((tab) => tab.path === path) || null;
  },
}));

