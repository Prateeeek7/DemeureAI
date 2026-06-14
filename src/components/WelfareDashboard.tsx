import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, ShieldAlert, Heart } from 'lucide-react';

interface WelfareAlert {
  id: string;
  name: string;
  room: string;
  triggerCondition: string;
  durationTime: string;
  status: 'Unresolved' | 'Checked' | 'False Positive';
}

export default function WelfareDashboard() {

  const [alerts, setAlerts] = useState<WelfareAlert[]>([
    { id: 'W-01', name: 'Dev Sharma', room: 'A-102', triggerCondition: 'Zero Gate Swipe & Zero Mess Log', durationTime: '36 Hours', status: 'Unresolved' },
    { id: 'W-02', name: 'Kabir Malhotra', room: 'A-104', triggerCondition: 'Consecutive Absenteeism Pattern', durationTime: '48 Hours', status: 'Unresolved' },
    { id: 'W-03', name: 'Vikram Rao', room: 'A-105', triggerCondition: 'High Complaint Stress Words', durationTime: 'Completed Check', status: 'Checked' },
  ]);

  const handleResolveAlert = (id: string, action: 'Checked' | 'False Positive') => {
    setAlerts(prev => prev.map(al => al.id === id ? { ...al, status: action } : al));
  };

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 06</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Resident Welfare & System Diagnostics</h2>
      </div>

      {/* Intro block */}
      <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-charcoal/5 pb-2">
          <Heart className="w-5 h-5 text-navy-accent" />
          <h3 className="font-serif font-bold text-lg text-charcoal">Welfare Diagnostic Engine</h3>
        </div>
        <p className="text-xs text-slate-gray leading-relaxed font-mono">
          <strong>Privacy Policy & Ethics Statement:</strong> The system logs only operational swiping entries and complaint keywords. No personal devices or audio streams are monitored. Anomalous behavior reports are delivered privately to wardens to verify resident wellness.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Active Warden Alerts */}
        <div className="lg:col-span-7 border border-charcoal/10 bg-surface-white p-6 space-y-4">
          <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/5 pb-2">Active Operational Welfare Warnings</h3>
          
          <div className="space-y-4 font-mono text-xs">
            {alerts.map((al) => (
              <div 
                key={al.id} 
                className={`p-4 border flex flex-col md:flex-row justify-between gap-4 items-start md:items-center ${
                  al.status === 'Unresolved' ? 'border-red-700/20 bg-red-50/5' : 'border-charcoal/10 bg-warm-ivory/50 opacity-60'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-charcoal">{al.name}</span>
                    <span className="text-slate-gray">({al.room})</span>
                    <span className={`text-[8px] border px-1 ${
                      al.status === 'Unresolved' ? 'text-red-700 border-red-700/30' : 'text-forest-status border-forest-status/30'
                    }`}>
                      {al.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-charcoal font-semibold">{al.triggerCondition}</div>
                  <div className="text-slate-gray text-[10px]">Duration Threshold: {al.durationTime}</div>
                </div>

                {al.status === 'Unresolved' && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => handleResolveAlert(al.id, 'Checked')}
                      className="flex-1 md:flex-none bg-navy-accent hover:bg-charcoal text-surface-white px-3 py-2 text-[10px] uppercase tracking-wider"
                    >
                      Quiet Check Done
                    </button>
                    <button 
                      onClick={() => handleResolveAlert(al.id, 'False Positive')}
                      className="flex-1 md:flex-none border border-charcoal/10 hover:bg-charcoal/5 text-charcoal px-3 py-2 text-[10px] uppercase tracking-wider"
                    >
                      Dismiss Alert
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>


        </div>

        {/* RIGHT COLUMN: Welfare Summary Metrics */}
        <div className="lg:col-span-5 border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/5 pb-2">Institutional Safety Telemetry</h3>
          
          <div className="space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center py-2 border-b border-charcoal/5">
              <span className="text-slate-gray">Mean Activity Index</span>
              <span className="font-bold text-charcoal">94.2% (Nominal)</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-charcoal/5">
              <span className="text-slate-gray">Welfare Check Trigger Rate</span>
              <span className="font-bold text-charcoal">0.48% Residents / Wk</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-charcoal/5">
              <span className="text-slate-gray">False Alarm Ratio</span>
              <span className="font-bold text-forest-status">3.2% (Highly Accurate)</span>
            </div>
          </div>

          <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-2 font-mono text-[11px] text-slate-gray">
            <div className="font-bold text-charcoal uppercase text-xs mb-1">Emergency Protocols</div>
            <div>In the event of medical or structural alarms, wardens click 'Initiate Broad Dispatch' from their physical keypads. Demeure AI broadcasts details to campus security and the institution medical desk in parallel.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
