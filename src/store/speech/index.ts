import { create } from 'zustand';

interface SpeechStore {
  language: string;
  setLanguage: (lang: string) => void;
}

export const useSpeechStore = create<SpeechStore>((set) => ({
  language: 'zh',
  setLanguage: (language) => set({ language }),
}));
