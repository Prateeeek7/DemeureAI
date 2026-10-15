import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Zap, ShieldCheck, Cpu } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';

type Zone = 'Block A' | 'Block B' | 'Mess Hall';

interface Anomaly {
  id: string;
  time: string;
  location: string;
  zone?: Zone;
  deviceType: string;
  loadSpike: string;
  confidence: number;
  status: 'Investigating' | 'Resolved' | 'Ignored';
}

interface Billing {
  powerRate: number;
  baseFee: number;
  cycleId: string;
}

// Sampled feeder telemetry (kW) per zone, at two-hour intervals.
const HOURS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
const ZONE_SERIES: Record<Zone, { baseline: number[]; usage: number[] }> = {
  'Block A':   { baseline: [120, 135, 150, 145, 130, 180, 210, 160], usage: [115, 142, 210, 138, 132, 195, 222, 165] },
  'Block B':   { baseline: [110, 118, 126, 124, 115, 168, 196, 150], usage: [108, 121, 129, 158, 119, 171, 190, 147] },
  'Mess Hall': { baseline: [180, 95, 210, 80, 70, 160, 205, 60],     usage: [176, 99, 214, 84, 73, 158, 201, 92] },
};
const zoneData = (zone: Zone) =>
  HOURS.map((time, i) => ({ time, baseline: ZONE_SERIES[zone].baseline[i], usage: ZONE_SERIES[zone].usage[i] }));
const currentDraw = (zone: Zone) => ZONE_SERIES[zone].usage.at(-1) ?? 0;

export default function PowerMonitor() {
  const [activeZone, setActiveZone] = useState<Zone>('Block A');
  const billingApi = useApi<Billing>('/api/billing');
  const anomaliesApi = useApi<Anomaly[]>('/api/power/anomalies');
  const [inputRate, setInputRate] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [dispatching, setDispatching] = useState(false);

  const billing = billingApi.data;
  const rateField = inputRate ?? (billing ? billing.powerRate.toFixed(2) : '');
  const anomalies = anomaliesApi.data ?? [];
  const openAlerts = anomalies.filter(an => an.status !== 'Resolved').length;
  const data = zoneData(activeZone);
  const totalDraw = (Object.keys(ZONE_SERIES) as Zone[]).reduce((sum, z) => sum + currentDraw(z), 0);
  const totalBaseline = (Object.keys(ZONE_SERIES) as Zone[]).reduce((sum, z) => sum + (ZONE_SERIES[z].baseline.at(-1) ?? 0), 0);
  const drawDelta = ((totalDraw - totalBaseline) / totalBaseline) * 100;

  const resolveAnomaly = async (id: string) => {
    try {
      await api.post(`/api/power/anomalies/${id}/resolve`);
    } catch (err) {
      setBillingStatus({ ok: false, text: errorMessage(err) });
    }
    anomaliesApi.reload();
  };

  const dispatchBills = async () => {
    const rate = Number(rateField);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
      setBillingStatus({ ok: false, text: 'Enter a rate between ₹0.01 and ₹100 per kWh.' });
      return;
    }
    setDispatching(true);
    try {
      const updated = await api.post<Billing>('/api/billing/update', { powerRate: rate });
      billingApi.setData(() => updated);
      setInputRate(null);
      setBillingStatus({ ok: true, text: `Cycle ${updated.cycleId} dispatched to all student portals.` });
    } catch (err) {
      setBillingStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setDispatching(false);
    }
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
          <span className="font-mono text-xs text-slate-gray block uppercase">Total Power Draw (Live)</span>
          <div className="flex justify-between items-end">
            <span className="font-serif text-4xl font-bold text-charcoal">{totalDraw} kW</span>
            <span className={`font-mono text-xs font-bold ${drawDelta > 0 ? 'text-red-700' : 'text-forest-status'}`}>
              {drawDelta > 0 ? '+' : ''}{drawDelta.toFixed(1)}% vs baseline
            </span>
          </div>
        </div>
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-2">
          <span className="font-mono text-xs text-slate-gray block uppercase">Isolation Forest Telemetry</span>
          <div className="flex justify-between items-end">
            <span className="font-serif text-4xl font-bold text-charcoal">{openAlerts} Alert{openAlerts === 1 ? '' : 's'}</span>
            {openAlerts > 0
              ? <span className="font-mono text-xs text-red-700 font-bold animate-pulse-dot">● ACTION REQ</span>
              : <span className="font-mono text-xs text-forest-status font-bold">ALL CLEAR</span>}
          </div>
        </div>
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-2">
          <span className="font-mono text-xs text-slate-gray block uppercase">Fault Diagnosis Score</span>
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
                    fontFamily: '"IBM Plex Mono", monospace'
                  }} 
                />
                <Area type="monotone" dataKey="baseline" name="Expected Baseline" stroke="#64748B" fill="#E2E8F0" strokeDasharray="5 5" fillOpacity={0.1} />
                <Area type="monotone" dataKey="usage" name="Actual Consumption" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="font-mono text-xs text-slate-gray flex justify-between">
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
                {anomaliesApi.error && <div className="text-red-700">{anomaliesApi.error}</div>}
                {anomalies.map((an) => (
                  <div key={an.id} className={`p-3 border ${an.status === 'Resolved' ? 'border-charcoal/10 bg-warm-ivory' : 'border-red-700/20 bg-red-50/20'}`}>
                    <div className="flex justify-between items-start">
                      <span className={`font-bold uppercase tracking-wider text-xs px-1 border ${
                        an.status === 'Resolved' ? 'text-forest-status border-forest-status/30' : 'text-red-700 border-red-700/30'
                      }`}>
                        {an.status}
                      </span>
                      <span className="text-xs text-slate-gray">{an.time}</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="font-bold text-charcoal">{an.location}</div>
                      <div className="text-xs text-slate-gray">{an.deviceType}</div>
                      <div className="flex justify-between text-xs pt-1">
                        <span>LOAD IMPACT: <strong className="text-charcoal">{an.loadSpike}</strong></span>
                        <span>CONF: <strong>{an.confidence}%</strong></span>
                      </div>
                    </div>
                    {an.status !== 'Resolved' && (
                      <button 
                        onClick={() => resolveAnomaly(an.id)}
                        className="mt-3 w-full text-center bg-charcoal hover:bg-navy-accent text-surface-white uppercase py-1 text-xs tracking-wider transition-colors"
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
              {billingApi.error && <div className="text-red-700">{billingApi.error}</div>}
              <div className="flex justify-between items-center bg-warm-ivory/50 p-2 border border-charcoal/10">
                <span className="text-slate-gray">Current Power Rate</span>
                <span className="font-bold">{billing ? `₹${billing.powerRate.toFixed(2)} / kWh` : '—'}</span>
              </div>
              <div className="flex justify-between items-center bg-warm-ivory/50 p-2 border border-charcoal/10">
                <span className="text-slate-gray">Base Hostel Fee</span>
                <span className="font-bold">{billing ? `₹${billing.baseFee.toLocaleString()} / Sem` : '—'}</span>
              </div>

              <div className="pt-2">
                <label className="block text-slate-gray mb-1 text-xs uppercase" htmlFor="power-rate">Update Power Rate (₹)</label>
                <input
                  id="power-rate"
                  type="number"
                  min="0.01"
                  max="100"
                  value={rateField}
                  onChange={e => setInputRate(e.target.value)}
                  step="0.10"
                  className="w-full bg-surface-white border border-charcoal/20 p-2 focus:outline-none focus:border-navy-accent"
                />
              </div>

              {billingStatus && (
                <div role="status" className={`p-2 border text-xs font-bold ${billingStatus.ok ? 'border-forest-status/30 text-forest-status' : 'border-red-700/30 text-red-700'}`}>
                  {billingStatus.text}
                </div>
              )}

              <button
                className="w-full bg-navy-accent hover:bg-charcoal text-surface-white uppercase tracking-wider py-2 transition-colors mt-2 disabled:opacity-50"
                disabled={dispatching || !billing}
                onClick={dispatchBills}
              >
                {dispatching ? 'Dispatching...' : 'Dispatch Monthly Bills'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
