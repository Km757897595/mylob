import { useCallback, useEffect, useRef, useState } from 'react';

interface OfflineTTSResult {
  audio: undefined;
  isGlobalLoading: boolean;
  response: undefined;
  setText: (text: string) => void;
  start: () => void;
  stop: () => void;
}

const MALE_VOICE_REGEX = /male|man|david|tom|mark|guy|paul|george|james|daniel|alex/i;
const FEMALE_VOICE_REGEX =
  /female|woman|aria|sarah|jenny|lisa|emma|anna|samantha|tingting|mei-jia|sin-ji/i;

const isSpeechSynthesisAvailable = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  typeof SpeechSynthesisUtterance !== 'undefined';

// 根据文本内容粗判主语言，返回 BCP 47 前缀，用于优先匹配同语言 voice。
// 没有完美方案，但中/英占绝大多数场景，做最简启发式即可。
const detectLangPrefix = (text: string): string => {
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  if (/[\u3040-\u30FF]/.test(text)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(text)) return 'ko';
  return 'en';
};

const getPreferredVoice = (
  voices: SpeechSynthesisVoice[],
  offlineVoiceId: string,
  text: string,
): SpeechSynthesisVoice | undefined => {
  if (voices.length === 0) return undefined;

  const langPrefix = detectLangPrefix(text);
  const matchesLang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().startsWith(langPrefix);
  const matchesGender = (v: SpeechSynthesisVoice) => {
    const matcher = offlineVoiceId === 'offline-male' ? MALE_VOICE_REGEX : FEMALE_VOICE_REGEX;
    return matcher.test(v.name);
  };

  // 选择优先级：同语言+性别匹配 → 同语言任意 → 系统默认 → 性别匹配 → 首个
  return (
    voices.find((v) => matchesLang(v) && matchesGender(v)) ||
    voices.find(matchesLang) ||
    voices.find((v) => v.default) ||
    voices.find(matchesGender) ||
    voices[0]
  );
};

// `speechSynthesis.getVoices()` 在页面早期可能返回空数组，需要等 `voiceschanged` 事件
const loadVoices = (): Promise<SpeechSynthesisVoice[]> =>
  new Promise((resolve) => {
    if (!isSpeechSynthesisAvailable()) return resolve([]);
    const synth = window.speechSynthesis;
    const cached = synth.getVoices();
    if (cached.length > 0) return resolve(cached);

    const handler = () => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', handler);
    // 兜底：1s 后无论是否触发都返回当前结果（部分浏览器永远不触发 voiceschanged）
    setTimeout(() => {
      synth.removeEventListener('voiceschanged', handler);
      resolve(synth.getVoices());
    }, 1000);
  });

export const useOfflineTTS = (content: string, offlineVoiceId: string): OfflineTTSResult => {
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const textRef = useRef(content);
  const voiceIdRef = useRef(offlineVoiceId);

  useEffect(() => {
    textRef.current = content;
  }, [content]);

  useEffect(() => {
    voiceIdRef.current = offlineVoiceId;
  }, [offlineVoiceId]);

  const stop = useCallback(() => {
    if (!isSpeechSynthesisAvailable()) return;
    window.speechSynthesis.cancel();
    setIsGlobalLoading(false);
  }, []);

  const start = useCallback(async () => {
    if (!isSpeechSynthesisAvailable()) return;
    const synth = window.speechSynthesis;

    // 重入：取消上一次播放，避免叠加
    synth.cancel();

    const text = textRef.current?.trim();
    if (!text) return;

    setIsGlobalLoading(true);

    const voices = await loadVoices();
    const preferredVoice = getPreferredVoice(voices, voiceIdRef.current, text);

    const utterance = new SpeechSynthesisUtterance(text);
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    }
    utterance.onstart = () => setIsGlobalLoading(true);
    utterance.onend = () => setIsGlobalLoading(false);
    utterance.onerror = () => setIsGlobalLoading(false);

    synth.speak(utterance);
  }, []);

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
