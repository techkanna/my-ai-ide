import { create } from 'zustand';

interface EditorState {
  currentFile: string | null;
  content: string;
  setCurrentFile: (path: string, content: string) => void;
  setContent: (content: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  currentFile: null,
  content: '',
  setCurrentFile: (path: string, content: string) =>
    set({ currentFile: path, content }),
  setContent: (content: string) => set({ content }),
}));

