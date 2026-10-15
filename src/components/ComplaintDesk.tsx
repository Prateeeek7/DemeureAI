import React, { useState } from 'react';
import { MessageSquare, AlertTriangle, Cpu } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useSession } from '../lib/session';

interface Complaint {
  id: string;
  room: string;
  originalText: string;
  category: 'Plumbing' | 'Electrical' | 'IT / WiFi' | 'Structural' | 'General';
  priority: 'CRITICAL (IMMEDIATE)' | 'HIGH' | 'MEDIUM' | 'LOW';
  eta: string;
  status: 'Open' | 'Dispatched' | 'Resolved';
}

type Triage = Pick<Complaint, 'category' | 'priority' | 'eta'>;
const NEXT_STATUS: Record<Complaint['status'], Complaint['status'] | null> = {
  Open: 'Dispatched',
  Dispatched: 'Resolved',
  Resolved: null,
};

export default function ComplaintDesk() {
  const user = useSession();
  const isStaff = user?.role === 'CampusAdmin' || user?.role === 'HostelAdmin';
  const [inputText, setInputText] = useState('');
  const [room, setRoom] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [filing, setFiling] = useState(false);
  const [error, setError] = useState('');
  const [predictedResult, setPredictedResult] = useState<Triage | null>(null);
  const ticketsApi = useApi<Complaint[]>('/api/complaints');
  const tickets = ticketsApi.data ?? [];

  const handleAnalyzeNLP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setAnalyzing(true);
    setPredictedResult(null);
    setError('');
    try {
      setPredictedResult(await api.post<Triage>('/api/complaints/classify', { text: inputText }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const fileTicket = async () => {
    if (!predictedResult) return;
    setFiling(true);
    setError('');
    try {
      await api.post('/api/complaints', { text: inputText, room: isStaff ? room : undefined });
      setInputText('');
      setRoom('');
      setPredictedResult(null);
      ticketsApi.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setFiling(false);
    }
  };

  const advanceStatus = async (ticket: Complaint) => {
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    try {
      await api.post(`/api/complaints/${ticket.id}/status`, { status: next });
    } catch (err) {
      setError(errorMessage(err));
    }
    ticketsApi.reload();
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
            <h3 className="font-serif font-bold text-lg text-charcoal">{isStaff ? 'Log a Complaint for a Resident' : 'NLP Triage Sandbox'}</h3>
          </div>
          <p className="text-xs text-slate-gray leading-relaxed font-mono">
            {isStaff
              ? 'For issues reported in person or by phone: enter the room and describe the problem; it is triaged and added to the ledger.'
              : 'Describe the problem in your room. It is classified by category and urgency before you log it.'}
          </p>

          <form onSubmit={handleAnalyzeNLP} className="space-y-4 font-mono text-xs">
            {isStaff && (
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                required
                maxLength={20}
                aria-label="Room or location"
                placeholder="Room / location (e.g. A-302)"
                className="w-full bg-warm-ivory border border-charcoal/10 p-3 text-charcoal outline-none focus:border-navy-accent"
              />
            )}
            <textarea
              value={inputText}
              maxLength={1000}
              aria-label="Issue description"
              onChange={(e) => { setInputText(e.target.value); setPredictedResult(null); }}
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

          {error && <div role="alert" className="p-2 border border-red-700/20 text-red-700 font-mono text-xs">{error}</div>}

          {predictedResult && (
            <div className="border border-navy-accent/20 bg-warm-ivory p-4 space-y-4 font-mono text-xs">
              <div className="font-bold text-navy-accent uppercase flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-forest-status" />
                NLP Classification Predictions
              </div>
              <div className="grid grid-cols-2 gap-4 border-b border-charcoal/10 pb-3">
                <div>
                  <span className="text-slate-gray uppercase text-xs block">Extracted Category</span>
                  <span className="font-bold text-charcoal">{predictedResult.category}</span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-xs block">Calculated Priority</span>
                  <span className={`font-bold ${
                    predictedResult.priority?.includes('CRITICAL') ? 'text-red-700' : 'text-navy-accent'
                  }`}>
                    {predictedResult.priority}
                  </span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-xs block">Response SLA ETA</span>
                  <span className="font-bold text-charcoal">{predictedResult.eta}</span>
                </div>
                <div>
                  <span className="text-slate-gray uppercase text-xs block">Classification Model</span>
                  <span className="text-slate-gray">Keyword triage rules v1</span>
                </div>
              </div>
              <button
                onClick={fileTicket}
                disabled={filing || (isStaff && !room.trim())}
                className="w-full bg-forest-status text-surface-white py-2 uppercase tracking-widest text-xs hover:bg-charcoal transition-colors disabled:opacity-50"
              >
                {filing ? 'Logging...' : 'Log Ticket to Core Registry'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Ticket Logs */}
        <div className="lg:col-span-6 border border-charcoal/10 bg-surface-white p-6 space-y-4 flex flex-col h-[480px]">
          <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
            <h3 className="font-serif font-bold text-lg text-charcoal">{isStaff ? 'Core Complaint Ledger' : 'My Complaints'}</h3>
            <span className="font-mono text-xs text-slate-gray">{tickets.filter(t => t.status !== 'Resolved').length} Active Tickets</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {ticketsApi.error && <div className="text-red-700 font-mono text-xs">{ticketsApi.error}</div>}
            {ticketsApi.data?.length === 0 && <div className="text-slate-gray font-mono text-xs">No complaints filed yet.</div>}
            {tickets.map((t) => (
              <div key={t.id} className="border border-charcoal/10 p-3 bg-warm-ivory flex flex-col justify-between space-y-3 font-mono text-xs">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-charcoal">{t.id}</span>
                    <span className="text-slate-gray">({t.room})</span>
                  </div>
                  <span className={`px-1.5 py-0.5 border text-xs ${
                    t.priority.includes('CRITICAL') ? 'text-red-700 border-red-700/20 bg-red-50/5 font-bold' : 'text-navy-accent border-navy-accent/20'
                  }`}>
                    {t.priority}
                  </span>
                </div>

                <p className="text-charcoal italic text-[13px] leading-relaxed">
                  "{t.originalText}"
                </p>

                <div className="flex justify-between items-center border-t border-charcoal/5 pt-2 text-xs text-slate-gray">
                  <span>CAT: <strong>{t.category}</strong></span>
                  <span>ETA: <strong>{t.eta}</strong></span>
                  <span className={`font-bold ${t.status === 'Resolved' ? 'text-forest-status' : 'text-slate-gray'}`}>
                    {t.status.toUpperCase()}
                  </span>
                </div>
                {isStaff && NEXT_STATUS[t.status] && (
                  <button
                    onClick={() => advanceStatus(t)}
                    className="w-full border border-navy-accent text-navy-accent hover:bg-navy-accent hover:text-white py-1 text-xs uppercase tracking-wider transition-colors"
                  >
                    Mark {NEXT_STATUS[t.status]}
                  </button>
                )}
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
