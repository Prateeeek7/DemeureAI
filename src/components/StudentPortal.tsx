import React, { useState, useEffect } from 'react';
import { IndianRupee, FileText, CheckCircle, Clock } from 'lucide-react';

interface LeaveRequest {
  id: string;
  name: string;
  room: string;
  duration: string;
  reason: string;
  consent: string;
  status: string;
}

export default function StudentPortal() {
  const [leaveReason, setLeaveReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [billing, setBilling] = useState({ powerRate: 8.50, baseFee: 75000 });
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  const fetchBilling = async () => {
    try {
      const res = await fetch('/api/billing');
      const data = await res.json();
      setBilling(data);
    } catch (e) { console.error(e); }
  };

  const fetchLeaves = async () => {
    try {
      const res = await fetch('/api/leaves');
      const data = await res.json();
      setLeaves(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchBilling();
    fetchLeaves();
  }, []);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/leaves/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Student Name',
          room: 'RM-X',
          startDate,
          endDate,
          reason: leaveReason
        })
      });
      setLeaveReason('');
      setStartDate('');
      setEndDate('');
      fetchLeaves();
    } catch (e) {
      console.error(e);
    }
  };

  const electricityCost = 210 * billing.powerRate;
  const totalPayable = billing.baseFee + electricityCost + 100; // 100 is mess fine

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 07</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Student Services & Dues</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Financial Billing */}
        <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
            <IndianRupee className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">Current Outstanding Dues</h3>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
              <div>
                <span className="font-bold text-charcoal block">Hostel Base Fee (Sem 2)</span>
                <span className="text-slate-gray">Due: 20 Jun 2026</span>
              </div>
              <span className="text-lg font-bold text-navy-accent">₹{billing.baseFee.toLocaleString()}</span>
            </div>

            <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
              <div>
                <span className="font-bold text-charcoal block">Electricity Overage (May)</span>
                <span className="text-slate-gray">210 kWh @ ₹{billing.powerRate.toFixed(2)}/unit</span>
              </div>
              <span className="text-lg font-bold text-navy-accent">₹{electricityCost.toLocaleString()}</span>
            </div>

            <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
              <div>
                <span className="font-bold text-charcoal block">Mess Fines (Wastage)</span>
                <span className="text-slate-gray">2 Instances</span>
              </div>
              <span className="text-lg font-bold text-navy-accent">₹100</span>
            </div>

            <div className="border-t border-charcoal/10 pt-4 flex justify-between items-center">
              <span className="font-bold text-charcoal uppercase tracking-wider">Total Payable</span>
              <span className="text-2xl font-serif font-bold text-red-700">₹{totalPayable.toLocaleString()}</span>
            </div>

            <button 
              className="w-full bg-navy-accent hover:bg-charcoal text-surface-white uppercase py-3 tracking-wider transition-colors mt-4"
              onClick={() => alert('Redirecting to secure payment gateway...')}
            >
              Pay Now via UPI / NetBanking
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Leave Application */}
        <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
            <FileText className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">Leave of Absence Application</h3>
          </div>

          <form 
            className="space-y-4 font-mono text-xs" 
            onSubmit={handleLeaveSubmit}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-gray mb-1 uppercase">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" />
              </div>
              <div>
                <label className="block text-slate-gray mb-1 uppercase">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" />
              </div>
            </div>

            <div>
              <label className="block text-slate-gray mb-1 uppercase">Destination & Reason</label>
              <textarea 
                rows={3} 
                required
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" 
                placeholder="Going home for a family event..."
              />
            </div>

            <button type="submit" className="w-full bg-charcoal hover:bg-navy-accent text-surface-white uppercase py-2 tracking-wider transition-colors">
              Submit Request
            </button>
          </form>

          {/* Past Requests */}
          <div className="mt-8 pt-6 border-t border-charcoal/10 space-y-3">
            <h4 className="font-serif font-bold text-charcoal mb-2">Recent Applications</h4>
            {leaves.length === 0 && <div className="text-slate-gray font-mono text-xs">No recent applications.</div>}
            
            {leaves.map(l => (
              <div key={l.id} className="p-3 border border-charcoal/10 bg-warm-ivory/50 flex justify-between items-center font-mono text-xs">
                <div>
                  <span className="font-bold text-charcoal block">{l.duration}</span>
                  <span className="text-slate-gray">{l.reason}</span>
                </div>
                {l.status === 'Approved' && <span className="text-forest-status flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>}
                {l.status === 'Pending' && <span className="text-navy-accent flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Warden</span>}
                {l.status === 'Denied' && <span className="text-red-700 flex items-center gap-1">Denied</span>}
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
