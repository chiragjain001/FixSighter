import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  focusTargetId?: string | null; // AR marker the assistant's answer refers to
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  isOpen: boolean;  // whether the AskAI panel is visible

  addUserMessage: (content: string) => ChatMessage;
  addAssistantMessage: (content: string, focusTargetId?: string | null) => void;
  setTyping: (v: boolean) => void;
  open: () => void;
  close: () => void;
  clear: () => void;

  // Returns last N message pairs for conversation history (sent to backend)
  getHistory: (maxTurns?: number) => { role: 'user' | 'assistant'; content: string }[];
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,
  isOpen: false,

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  addAssistantMessage: (content, focusTargetId) => {
    const msg: ChatMessage = {
      id: `chat_${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      focusTargetId,
    };
    set((s) => ({ messages: [...s.messages, msg], isTyping: false }));
  },

  setTyping: (isTyping) => set({ isTyping }),
  open:  () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  clear: () => set({ messages: [], isTyping: false }),

  getHistory: (maxTurns = 3) => {
    const { messages } = get();
    // Take last maxTurns * 2 messages (user + assistant pairs)
    return messages
      .slice(-(maxTurns * 2))
      .map((m) => ({ role: m.role, content: m.content }));
  },
}));
