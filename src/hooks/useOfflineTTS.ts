import { useEffect, useRef, useState } from 'react';

interface OfflineTTSResult {
  audio: undefined;
  isGlobalLoading: boolean;
  response: undefined;
  setText: (text: string) => void;
  start: () => void;
  stop: () => void;
}

const MALE_VOICE_REGEX = /male|man|david|tom|mark|guy|paul|george|james/i;
const FEMALE_VOICE_REGEX = /female|woman|aria|sarah|jenny|lisa|emma|anna/i;

const getPreferredVoice = (voices: SpeechSynthesisVoice[], offlineVoiceId: string) => {
  const matcher = offlineVoiceId === 'offline-male' ? MALE_VOICE_REGEX : FEMALE_VOICE_REGEX;

  return voices.find((voice) => matcher.test(voice.name)) || voices[0];
};

export const useOfflineTTS = (content: string, offlineVoiceId: string): OfflineTTSResult => {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const textRef = useRef(content);

  useEffect(() => {
    textRef.current = content;
  }, [content]);

  const stop = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsGlobalLoading(false);
  };

  const start = () => {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textRef.current);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = getPreferredVoice(voices, offlineVoiceId);

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }

    utterance.onstart = () => setIsGlobalLoading(true);
    utterance.onend = () => setIsGlobalLoading(false);
    utterance.onerror = () => setIsGlobalLoading(false);

    window.speechSynthesis.speak(utterance);
  };

  return {
    audio: undefined,
    isGlobalLoading,
    response: undefined,
    setText: (text) => {
      textRef.current = text;
    },
    start,
    stop,
  };
};
