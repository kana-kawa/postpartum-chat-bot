import { useState, useRef, useEffect } from 'react';
import { Send, Heart, Baby, Smile, Mic } from 'lucide-react';
import MoodTrackerModal from './MoodTracker';

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
};

const STORAGE_KEY = 'postpartum-chat-session-id';
const MESSAGES_STORAGE_KEY = 'postpartum-chat-messages';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'bot',
  text: 'こんにちは。産後ママの話し相手です。どんなことでも気軽にお話しできますよ。今日はどう過ごされましたか？',
};

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

function loadStoredMessages(): Message[] {
  try {
    const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function App() {
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isMoodOpen, setIsMoodOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => !!getSpeechRecognitionCtor());
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningBaseTextRef = useRef('');
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // localStorage unavailable (private mode, quota exceeded, etc.) — skip persistence
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = true;
    listeningBaseTextRef.current = input.trim() ? `${input.trim()} ` : '';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(listeningBaseTextRef.current + transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    recognitionRef.current?.stop();

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionIdRef.current }),
      });

      if (!res.ok) throw new Error('Network response was not ok');

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: 'bot',
        text: data.answer ?? data.message ?? '返答がありませんでした。',
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'bot',
          text: 'ごめんなさい、通信エラーが発生しました。少し時間をおいてもう一度お試しください。',
        },
      ]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-rose-50 via-amber-50 to-orange-50">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/70 backdrop-blur-sm border-b border-rose-100 px-4 py-3 sm:py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-rose-300 to-amber-300 flex items-center justify-center shadow-sm">
            <Baby className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2.2} />
          </div>
          <div className="text-center">
            <h1 className="text-lg sm:text-xl font-bold text-rose-500 tracking-tight">
              産後ママの話し相手
            </h1>
            <p className="text-[10px] sm:text-xs text-rose-300 font-medium">
              いつでも、あなたのそばに
            </p>
          </div>
          <Heart className="w-5 h-5 text-rose-300 fill-rose-200 ml-1" />
          <button
            onClick={() => setIsMoodOpen(true)}
            aria-label="気分を記録する"
            className="ml-2 flex-shrink-0 rounded-full p-1.5 text-rose-400 hover:bg-rose-50 transition-colors"
          >
            <Smile className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {isMoodOpen && <MoodTrackerModal onClose={() => setIsMoodOpen(false)} />}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 sm:py-6"
      >
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-t border-rose-100 px-4 py-3 sm:py-4">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="メッセージを入力してください..."
            className="flex-1 resize-none rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-base text-gray-700 placeholder-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent max-h-32"
            style={{ minHeight: '44px' }}
            disabled={isTyping}
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={isTyping}
              aria-label={isListening ? '音声入力を停止' : '音声入力を開始'}
              className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                isListening
                  ? 'bg-rose-400 text-white animate-pulse'
                  : 'bg-white text-rose-400 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <Mic className="w-5 h-5" strokeWidth={2.2} />
            </button>
          )}
          <button
            onClick={send}
            disabled={!input.trim() || isTyping}
            className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-rose-400 to-amber-400 text-white flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            aria-label="送信"
          >
            <Send className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>
        <p className="hidden sm:block text-center text-[10px] text-rose-300 mt-2">
          Enterで送信・Shift+Enterで改行
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-300 to-amber-300 flex items-center justify-center mr-2 mt-0.5 shadow-sm">
          <Baby className="w-4 h-4 text-white" strokeWidth={2.2} />
        </div>
      )}
      <div
        className={`max-w-[75%] sm:max-w-[70%] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-rose-400 to-rose-400 text-white rounded-2xl rounded-tr-md'
            : 'bg-white text-gray-700 rounded-2xl rounded-tl-md border border-rose-100'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-rose-300 to-amber-300 flex items-center justify-center mr-2 mt-0.5 shadow-sm">
        <Baby className="w-4 h-4 text-white" strokeWidth={2.2} />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-md border border-rose-100 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-300 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-rose-300 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-rose-300 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default App;
