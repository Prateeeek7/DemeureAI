import React, { useState } from 'react';
import { MessageSquare, Send, BookOpen, Compass } from 'lucide-react';

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

  const predefinedQueries = [
    'What is the visitor policy for parents?',
    'What is the curfew timing and penalty?',
    'How do I file for leaves exceeding 3 days?'
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Add user message
    const newMsg: ChatMessage = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, newMsg]);
    setQuery('');
    setTyping(true);

    try {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: textToSend })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { sender: 'assistant', text: data.text, citations: data.citations }]);
    } catch (error) {
      console.error('Error fetching RAG response:', error);
      setMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: 'Error connecting to the AI backend. Please ensure the server is running.', 
        citations: [] 
      }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="border border-charcoal/10 bg-surface-white flex flex-col h-[520px] font-mono text-xs">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-charcoal/10 flex items-center justify-between bg-warm-ivory">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-navy-accent" />
          <span className="font-serif font-bold text-sm text-charcoal">Virtual RAG Assistant</span>
        </div>
        <span className="text-[9px] text-slate-gray border border-charcoal/10 px-1.5 py-0.5 bg-surface-white">
          KNOWLEDGE BASE: HANDBOOK_V4.PDF
        </span>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-warm-ivory/20">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`p-3 max-w-[85%] border leading-relaxed ${
              msg.sender === 'user' 
                ? 'bg-navy-accent text-surface-white border-navy-accent' 
                : 'bg-surface-white text-charcoal border-charcoal/10'
            }`}>
              {msg.text}
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
      </div>

      {/* Predefined Quick Prompts */}
      <div className="p-3 border-t border-charcoal/10 bg-warm-ivory/50 flex flex-wrap gap-2">
        {predefinedQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            className="text-[9px] bg-surface-white text-charcoal border border-charcoal/10 hover:border-navy-accent px-2.5 py-1 transition-colors uppercase"
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
          placeholder="Ask handbook queries (e.g. Visitor policy, curfew limits)..."
          className="flex-1 bg-warm-ivory border border-charcoal/10 px-3 py-2 text-charcoal outline-none focus:border-navy-accent"
        />
        <button
          onClick={() => handleSend(query)}
          className="bg-navy-accent text-surface-white p-2 hover:bg-charcoal transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
