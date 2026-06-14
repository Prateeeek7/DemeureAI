import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, CheckCircle2, Send, Cpu } from 'lucide-react';

interface Complaint {
  id: string;
  room: string;
  originalText: string;
  category: 'Plumbing' | 'Electrical' | 'IT / WiFi' | 'Structural' | 'General';
  priority: 'CRITICAL (IMMEDIATE)' | 'HIGH' | 'MEDIUM' | 'LOW';
  eta: string;
  status: 'Open' | 'Dispatched' | 'Resolved';
}

export default function ComplaintDesk() {
  const [inputText, setInputText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [predictedResult, setPredictedResult] = useState<Partial<Complaint> | null>(null);

  const [tickets, setTickets] = useState<Complaint[]>([
    { id: 'T-984', room: 'A-304', originalText: 'Water leakage from the ceiling dripping on electrical sockets.', category: 'Plumbing', priority: 'CRITICAL (IMMEDIATE)', eta: '2 Hours', status: 'Dispatched' },
    { id: 'T-982', room: 'B-108', originalText: 'High latency and dropping connections on WiFi access point A2.', category: 'IT / WiFi', priority: 'HIGH', eta: '6 Hours', status: 'Open' },
    { id: 'T-979', room: 'A-201', originalText: 'Main tube light flickering during evening study hours.', category: 'Electrical', priority: 'MEDIUM', eta: '24 Hours', status: 'Resolved' },
  ]);

  // Simulated NLP analysis logic
  const handleAnalyzeNLP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setAnalyzing(true);
    setPredictedResult(null);

    setTimeout(() => {
      const lower = inputText.toLowerCase();
      let category: Complaint['category'] = 'General';
      let priority: Complaint['priority'] = 'LOW';
      let eta = '48 Hours';

      // Simple keyword match simulator
      if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe') || lower.includes('clog')) {
        category = 'Plumbing';
        priority = 'HIGH';
        eta = '12 Hours';
      }
      if (lower.includes('electricity') || lower.includes('power') || lower.includes('fuse') || lower.includes('shock') || lower.includes('wire') || lower.includes('light')) {
        category = 'Electrical';
        priority = 'HIGH';
        eta = '8 Hours';
      }
      if (lower.includes('wifi') || lower.includes('router') || lower.includes('internet') || lower.includes('connection')) {
        category = 'IT / WiFi';
        priority = 'MEDIUM';
        eta = '24 Hours';
      }
      if (lower.includes('ceiling') || lower.includes('crack') || lower.includes('door') || lower.includes('lock')) {
        category = 'Structural';
        priority = 'MEDIUM';
        eta = '24 Hours';
      }
      if (lower.includes('socket') || lower.includes('dripping') || lower.includes('fuse board') || lower.includes('fire') || lower.includes('emergency')) {
        priority = 'CRITICAL (IMMEDIATE)';
        eta = '2 Hours';
      }

      setPredictedResult({
        room: 'Student Sandbox (Rm 204)',
        originalText: inputText,
        category,
        priority,
        eta,
        status: 'Open'
      });
      setAnalyzing(false);
    }, 1500);
  };

  const fileTicket = () => {
    if (!predictedResult) return;
    const finalTicket: Complaint = {
      id: `T-${Math.floor(100 + Math.random() * 900)}`,
      room: predictedResult.room || 'Rm 204',
      originalText: predictedResult.originalText || '',
      category: predictedResult.category || 'General',
      priority: predictedResult.priority || 'LOW',
      eta: predictedResult.eta || '48 Hours',
      status: 'Open'
    };
    setTickets(prev => [finalTicket, ...prev]);
    setInputText('');
    setPredictedResult(null);
  };

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 04</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">NLP Complaint Desk & Proactive Maintenance</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: NLP Triage Sandbox */}
        <div className="lg:col-span-6 border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
            <MessageSquare className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">NLP Triage Sandbox</h3>
          </div>
          <p className="text-xs text-slate-gray leading-relaxed font-mono">
            Type an issue text below. The AI will parse details, assign categories, and calculate urgency matrices automatically.
          </p>

          <form onSubmit={handleAnalyzeNLP} className="space-y-4 font-mono text-xs">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe the maintenance issue (e.g. Water is dripping from the AC unit onto the study table in A-302, please send help)"
              className="w-full h-28 bg-warm-ivory border border-charcoal/10 p-3 text-charcoal outline-none focus:border-navy-accent resize-none placeholder-slate-gray/50"
              required
            ></textarea>

            <button
              type="submit"
              disabled={analyzing}
              className="w-full bg-navy-accent hover:bg-charcoal text-surface-white py-3 uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {analyzing ? 'Processing NLP Framework...' : 'Submit to NLP Desk'}
            </button>
          </form>

          {predictedResult && (
            <div className="border border-navy-accent/20 bg-warm-ivory p-4 space-y-4 font-mono text-xs">
              <div className="font-bold text-navy-accent uppercase flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-forest-status" />
                NLP Classification Predictions
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-charcoal/10 pb-3">
                <div>
                  <span className="text-slate-gray uppercase text-[8px] block">Extracted Category</span>
                  <span className="font-bold text-charcoal">{predictedResult.category}</span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-[8px] block">Calculated Priority</span>
                  <span className={`font-bold ${
                    predictedResult.priority?.includes('CRITICAL') ? 'text-red-700' : 'text-navy-accent'
                  }`}>
                    {predictedResult.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-[8px] block">Response SLA ETA</span>
                  <span className="font-bold text-charcoal">{predictedResult.eta}</span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-[8px] block">Classification Model</span>
                  <span className="text-slate-gray">RoBERTa-Hostel v2</span>
                </div>
              </div>
              <button
                onClick={fileTicket}
                className="w-full bg-forest-status text-surface-white py-2 uppercase tracking-widest text-[10px] hover:bg-charcoal transition-colors"
              >
                Log Ticket to Core Registry
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Ticket Logs */}
        <div className="lg:col-span-6 border border-charcoal/10 bg-surface-white p-6 space-y-4 flex flex-col h-[480px]">
          <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
            <h3 className="font-serif font-bold text-lg text-charcoal">Core Complaint Ledger</h3>
            <span className="font-mono text-xs text-slate-gray">{tickets.length} Active Tickets</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {tickets.map((t) => (
              <div key={t.id} className="border border-charcoal/10 p-3 bg-warm-ivory flex flex-col justify-between space-y-3 font-mono text-xs">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-charcoal">{t.id}</span>
                    <span className="text-slate-gray">({t.room})</span>
                  </div>
                  <span className={`px-1.5 py-0.5 border text-[9px] ${
                    t.priority.includes('CRITICAL') ? 'text-red-700 border-red-700/20 bg-red-50/5 font-bold' : 'text-navy-accent border-navy-accent/20'
                  }`}>
                    {t.priority}
                  </span>
                </div>

                <p className="text-charcoal italic text-[11px] leading-relaxed">
                  "{t.originalText}"
                </p>

                <div className="flex justify-between items-center border-t border-charcoal/5 pt-2 text-[10px] text-slate-gray">
                  <span>CAT: <strong>{t.category}</strong></span>
                  <span>ETA: <strong>{t.eta}</strong></span>
                  <span className={`font-bold ${t.status === 'Resolved' ? 'text-forest-status' : 'text-slate-gray'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-charcoal/10 pt-4 bg-surface-white">
            <div className="flex items-center gap-2 text-xs font-mono text-red-700 border border-red-700/20 p-3 bg-red-50/5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Predictive Alert: Motor vibration in Water Pump-B indicates failure within 7 days. Scheduler dispatched.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
