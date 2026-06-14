import React, { useState, useEffect } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Zap, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

interface Anomaly {
  id: string;
  time: string;
  location: string;
  deviceType: string;
  loadSpike: string;
  confidence: number;
  status: 'Investigating' | 'Resolved' | 'Ignored';
}

export default function PowerMonitor() {
  const [activeZone, setActiveZone] = useState<'Block A' | 'Block B' | 'Mess Hall'>('Block A');
  const [billing, setBilling] = useState({ powerRate: 8.50, baseFee: 75000 });
  const [inputRate, setInputRate] = useState('8.50');

  const fetchBilling = async () => {
    try {
      const res = await fetch('/api/billing');
      const data = await res.json();
      setBilling(data);
      setInputRate(data.powerRate.toString());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  // Mock time-series consumption data
  const data = [
    { time: '08:00', baseline: 120, usage: 115, anomaly: false },
    { time: '10:00', baseline: 135, usage: 142, anomaly: false },
    { time: '12:00', baseline: 150, usage: 210, anomaly: true }, // Spike here
    { time: '14:00', baseline: 145, usage: 138, anomaly: false },
    { time: '16:00', baseline: 130, usage: 132, anomaly: false },
    { time: '18:00', baseline: 180, usage: 195, anomaly: false },
    { time: '20:00', baseline: 210, usage: 222, anomaly: false },
    { time: '22:00', baseline: 160, usage: 165, anomaly: false },
  ];

  const initialAnomalies: Anomaly[] = [
    { id: '1', time: '12:14:05', location: 'RM-304, Block A', deviceType: 'Heavy Inductive Load (Heater)', loadSpike: '+1.8 kW', confidence: 94.6, status: 'Investigating' },
    { id: '2', time: '09:44:12', location: 'Elevator Shaft 2', deviceType: 'Motor Voltage Oscillation', loadSpike: '+4.2 kW', confidence: 88.2, status: 'Resolved' },
    { id: '3', time: 'Yesterday', location: 'Kitchen Oven C', deviceType: 'Thermocouple Failure', loadSpike: 'Leakage Current', confidence: 91.0, status: 'Resolved' },
  ];

  const [anomalies, setAnomalies] = useState<Anomaly[]>(initialAnomalies);

  const resolveAnomaly = (id: string) => {
    setAnomalies(prev => prev.map(an => an.id === id ? { ...an, status: 'Resolved' } : an));
  };

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 02</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Smart Power & Resource Monitor</h2>
      </div>

      {/* Overview Cards (Modular Blocks) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-2">
          <span className="font-mono text-[10px] text-slate-gray block uppercase">Total Power Draw (Live)</span>
          <div className="flex justify-between items-end">
            <span className="font-serif text-4xl font-bold text-charcoal">44.8 kW</span>
            <span className="font-mono text-xs text-forest-status font-bold">-6.2% vs baseline</span>
          </div>
        </div>
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-2">
          <span className="font-mono text-[10px] text-slate-gray block uppercase">Isolation Forest Telemetry</span>
          <div className="flex justify-between items-end">
            <span className="font-serif text-4xl font-bold text-charcoal">1 Alert</span>
            <span className="font-mono text-xs text-red-700 font-bold animate-pulse-dot">● ACTION REQ</span>
          </div>
        </div>
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-2">
          <span className="font-mono text-[10px] text-slate-gray block uppercase">Fault Diagnosis Score</span>
          <div className="flex justify-between items-end">
            <span className="font-serif text-4xl font-bold text-charcoal">98 / 100</span>
            <span className="font-mono text-xs text-slate-gray">Optimal baseline</span>
          </div>
        </div>
      </div>

      {/* Main Graph Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-navy-accent" />
              <h3 className="font-serif font-bold text-lg text-charcoal">Real-time Current Load vs Baseline</h3>
            </div>
            <div className="flex border border-charcoal/10 font-mono text-xs bg-warm-ivory">
              {(['Block A', 'Block B', 'Mess Hall'] as const).map(zone => (
                <button
                  key={zone}
                  onClick={() => setActiveZone(zone)}
                  className={`px-3 py-1 border-r last:border-0 border-charcoal/10 ${
                    activeZone === zone ? 'bg-navy-accent text-surface-white' : 'text-slate-gray hover:bg-charcoal/5'
                  }`}
                >
                  {zone}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #1F2937', 
                    borderRadius: '0px',
                    fontFamily: 'Courier New, monospace'
                  }} 
                />
                <Area type="monotone" dataKey="baseline" name="Expected Baseline" stroke="#64748B" fill="#E2E8F0" strokeDasharray="5 5" fillOpacity={0.1} />
                <Area type="monotone" dataKey="usage" name="Actual Consumption" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="font-mono text-[10px] text-slate-gray flex justify-between">
            <span>METHODOLOGY: ISOLATION FOREST + EXPONENTIAL SMOOTHING FORECAST</span>
            <span>LAST RUN: 2 MINS AGO</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Stacked Panels */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Isolation Forest Anomaly Desk */}
          <div className="border border-charcoal/10 bg-surface-white p-6 flex flex-col justify-between max-h-[300px]">
            <div className="space-y-4 flex-1 overflow-y-auto pr-2">
              <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
                <Cpu className="w-5 h-5 text-navy-accent" />
                <h3 className="font-serif font-bold text-lg text-charcoal">ML Fault Detections</h3>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {anomalies.map((an) => (
                  <div key={an.id} className={`p-3 border ${an.status === 'Resolved' ? 'border-charcoal/10 bg-warm-ivory/50 opacity-60' : 'border-red-700/20 bg-red-50/20'}`}>
                    <div className="flex justify-between items-start">
                      <span className={`font-bold uppercase tracking-wider text-[9px] px-1 border ${
                        an.status === 'Resolved' ? 'text-forest-status border-forest-status/30' : 'text-red-700 border-red-700/30'
                      }`}>
                        {an.status}
                      </span>
                      <span className="text-[10px] text-slate-gray">{an.time}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="font-bold text-charcoal">{an.location}</div>
                      <div className="flex justify-between text-[10px] pt-1">
                        <span>LOAD IMPACT: <strong className="text-charcoal">{an.loadSpike}</strong></span>
                        <span>CONF: <strong>{an.confidence}%</strong></span>
                      </div>
                    </div>
                    {an.status !== 'Resolved' && (
                      <button 
                        onClick={() => resolveAnomaly(an.id)}
                        className="mt-3 w-full text-center bg-charcoal hover:bg-navy-accent text-surface-white uppercase py-1 text-[10px] tracking-wider transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ADMIN BILLING DISPATCH PANEL */}
          <div className="border border-charcoal/10 bg-surface-white p-6 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
              <ShieldCheck className="w-5 h-5 text-navy-accent" />
              <h3 className="font-serif font-bold text-lg text-charcoal">Finance & Utility Billing</h3>
            </div>
            
            <div className="font-mono text-xs space-y-3">
              <div className="flex justify-between items-center bg-warm-ivory/50 p-2 border border-charcoal/10">
                <span className="text-slate-gray">Current Power Rate</span>
                <span className="font-bold">₹{billing.powerRate.toFixed(2)} / kWh</span>
              </div>
              <div className="flex justify-between items-center bg-warm-ivory/50 p-2 border border-charcoal/10">
                <span className="text-slate-gray">Base Hostel Fee</span>
                <span className="font-bold">₹{billing.baseFee.toLocaleString()} / Sem</span>
              </div>

              <div className="pt-2">
                <label className="block text-slate-gray mb-1 text-[10px] uppercase">Update Power Rate (₹)</label>
                <input 
                  type="number" 
                  value={inputRate} 
                  onChange={e => setInputRate(e.target.value)}
                  step="0.10" 
                  className="w-full bg-surface-white border border-charcoal/20 p-2 focus:outline-none focus:border-navy-accent" 
                />
              </div>
              
              <button 
                className="w-full bg-navy-accent hover:bg-charcoal text-surface-white uppercase tracking-wider py-2 transition-colors mt-2"
                onClick={async () => {
                  try {
                    await fetch('/api/billing/update', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ powerRate: parseFloat(inputRate) })
                    });
                    fetchBilling();
                    alert("Billing rates updated and dispatched to student portals successfully.");
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Dispatch Monthly Bills
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
