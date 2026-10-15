import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, BookOpen, Volume2, VolumeX } from 'lucide-react';
import { api, errorMessage } from '../lib/api';

// Renders the **bold** spans LLMs emit; everything stays a React text node, so nothing is injected as HTML.
const renderRichText = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.replace(/^#{1,6}\s/gm, ''));

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  citations?: string[];
}

export default function VirtualAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: 'assistant', text: 'Greetings. I am the Demeure RAG Operations Assistant. Ask any query about hostel guidelines, policies, fee schedules, or facilities.', citations: [] }
  ]);
  const [query, setQuery] = useState('');
  const [typing, setTyping] = useState(false);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);

  // Polly State
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingAudioIdx, setLoadingAudioIdx] = useState<number | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, typing]);

  // Stop any speech when leaving the assistant.
  useEffect(() => () => {
    activeAudioRef.current?.pause();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const predefinedQueries = [
    'What is the visitor policy for parents?',
    'What is the curfew timing and penalty?',
    'How do I file for leaves exceeding 3 days?'
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || typing) return;

    // Add user message
    const newMsg: ChatMessage = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, newMsg]);
    setQuery('');
    setTyping(true);

    try {
      const data = await api.post<{ text: string; citations: string[] }>('/api/chat/query', { query: textToSend.slice(0, 1000) });
      setMessages(prev => [...prev, { sender: 'assistant', text: data.text, citations: data.citations }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: errorMessage(error),
        citations: []
      }]);
    } finally {
      setTyping(false);
    }
  };

  // Polly TTS audio trigger
  const handleTTS = async (text: string, idx: number) => {
    // If already playing this message, stop it
    if (playingIdx === idx) {
      stopSpeech();
      return;
    }

    stopSpeech();
    setLoadingAudioIdx(idx);

    try {
      // 1. Try hitting the Amazon Polly synthesis endpoint
      const data = await api.post<{ audioContent: string }>('/api/aws/polly/synthesize', { text });

      if (data.audioContent) {
        // Play Polly Base64 Audio
        const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
        activeAudioRef.current = audio;
        setPlayingIdx(idx);
        setLoadingAudioIdx(null);
        
        audio.play();
        audio.onended = () => {
          setPlayingIdx(null);
        };
      } else {
        // 2. Fallback to Browser Speech Synthesis (Mock mode / Unconfigured credentials)
        if ('speechSynthesis' in window) {
          setPlayingIdx(idx);
          setLoadingAudioIdx(null);
          
          const cleanText = text.replace(/\*+/g, '').replace(/\[.*?\]/g, ''); // strip markdown markers
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          
          utterance.onend = () => {
            setPlayingIdx(null);
          };
          utterance.onerror = () => {
            setPlayingIdx(null);
          };

          window.speechSynthesis.speak(utterance);
        } else {
          setTtsNotice("Text-to-speech is not supported by your browser in this environment.");
          setLoadingAudioIdx(null);
        }
      }
    } catch {
      // Polly unavailable: fall back to browser speech synthesis.
      if ('speechSynthesis' in window) {
        setPlayingIdx(idx);
        setLoadingAudioIdx(null);
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setPlayingIdx(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setLoadingAudioIdx(null);
        setTtsNotice("Audio synthesis error occurred.");
      }
    }
  };

  const stopSpeech = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingIdx(null);
  };

  return (
    <div className="border border-charcoal/10 bg-surface-white flex flex-col h-[520px] font-mono text-xs">
      {/* Assistant Header */}
      <div className="p-4 border-b border-charcoal/10 flex items-center justify-between bg-warm-ivory">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-navy-accent" />
          <span className="font-serif font-bold text-sm text-charcoal">Virtual RAG Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-navy-accent border border-navy-accent/20 px-1.5 py-0.5 bg-navy-accent/5 font-semibold">
            AWS POLLY SPEECH ENABLED
          </span>
          <span className="text-[9px] text-slate-gray border border-charcoal/10 px-1.5 py-0.5 bg-surface-white">
            KNOWLEDGE BASE: HOSTEL RULEBOOKS
          </span>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-warm-ivory/20">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-3 max-w-[85%] border leading-relaxed relative group ${
              msg.sender === 'user' 
                ? 'bg-navy-accent text-surface-white border-navy-accent' 
                : 'bg-surface-white text-charcoal border-charcoal/10'
            }`}>
              <div className="whitespace-pre-wrap">{renderRichText(msg.text)}</div>
              
              {/* Speaker Button for assistant responses */}
              {msg.sender === 'assistant' && (
                <button
                  onClick={() => handleTTS(msg.text, idx)}
                  disabled={loadingAudioIdx === idx}
                  className={`absolute -right-8 top-2 p-1.5 bg-white border border-charcoal/10 text-charcoal hover:text-navy-accent hover:border-navy-accent shadow-sm transition-colors rounded ${
                    playingIdx === idx ? 'text-navy-accent border-navy-accent animate-pulse' : ''
                  }`}
                  title={playingIdx === idx ? "Stop Reading" : "Read aloud (Amazon Polly)"}
                >
                  {loadingAudioIdx === idx ? (
                    <span className="w-3.5 h-3.5 block border-2 border-navy-accent border-t-transparent animate-spin rounded-full"></span>
                  ) : playingIdx === idx ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            {msg.citations && msg.citations.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-gray pl-1">
                <BookOpen className="w-3.5 h-3.5 shrink-0 text-navy-accent" />
                <span>Citations: {msg.citations.map(c => `[${c}]`).join(', ')}</span>
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="text-[10px] text-slate-gray animate-pulse font-mono pl-1">
            Querying vector database embeddings...
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* TTS Notice Banner */}
      {ttsNotice && (
        <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 text-amber-800 text-[10px] font-mono flex justify-between items-center">
          <span>{ttsNotice}</span>
          <button onClick={() => setTtsNotice(null)} className="font-bold text-amber-950">✕</button>
        </div>
      )}

      {/* Predefined Quick Prompts */}
      <div className="p-3 border-t border-charcoal/10 bg-warm-ivory/50 flex flex-wrap gap-2">
        {predefinedQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={typing}
            className="text-[9px] bg-surface-white text-charcoal border border-charcoal/10 hover:border-navy-accent px-2.5 py-1 transition-colors uppercase disabled:opacity-50"
          >
            {q.replace('What is the ', '').replace('How do I ', '').substring(0, 30)}...
          </button>
        ))}
      </div>

      {/* Chat input box */}
      <div className="p-3 border-t border-charcoal/10 bg-surface-white flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(query)}
          maxLength={1000}
          aria-label="Ask the handbook assistant"
          placeholder="Ask handbook queries (e.g. Visitor policy, curfew limits)..."
          className="flex-1 bg-warm-ivory border border-charcoal/10 px-3 py-2 text-charcoal outline-none focus:border-navy-accent"
        />
        <button
          onClick={() => handleSend(query)}
          disabled={typing || !query.trim()}
          aria-label="Send question"
          className="bg-navy-accent text-surface-white p-2 hover:bg-charcoal transition-colors disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
