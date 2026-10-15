import { useState } from 'react';
import { Shield, Eye, ShieldAlert, Key, UserCheck, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';

interface EntryLog {
  id: string;
  time: string;
  name: string;
  type: 'Resident' | 'Visitor' | 'Staff';
  roomOrPurpose: string;
  status: 'GRANTED' | 'DENIED' | 'REVOKED';
  hash: string;
}

interface Ledger {
  verified: boolean;
  entries: EntryLog[];
}

interface VisitorRequest {
  id: string;
  visitor: string;
  host: string;
  date: string;
  purpose: string;
  status: string;
}

interface LeaveRequest {
  id: string;
  name: string;
  room: string;
  duration: string;
  reason: string;
  consent: string;
  status: string;
  proofUrl?: string | null;
}

export default function SecurityConsole() {
  const visitorsApi = useApi<VisitorRequest[]>('/api/visitors');
  const leavesApi = useApi<LeaveRequest[]>('/api/leaves');
  const ledgerApi = useApi<Ledger>('/api/gate/ledger');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const visitors = (visitorsApi.data ?? []).filter(v => v.status === 'Pending');
  const leaves = leavesApi.data ?? [];
  const logs = ledgerApi.data?.entries ?? [];

  const resolve = async (path: string, id: string, reload: () => void) => {
    setBusyId(id);
    setActionError('');
    try {
      await api.post(path);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const recordGateEvent = async (event: Omit<EntryLog, 'id' | 'time' | 'hash'>) => {
    try {
      await api.post('/api/gate/events', event);
      ledgerApi.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  // Face Scan Simulator States
  const [scanStatus, setScanStatus] = useState<'IDLE' | 'SCANNING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [livenessCheck, setLivenessCheck] = useState({
    blinkDetected: false,
    headPoseMatch: false,
    microExpressions: false,
  });
  const [identifiedName, setIdentifiedName] = useState<string>('');

  const triggerScan = (mode: 'success' | 'fail') => {
    setScanStatus('SCANNING');
    setLivenessCheck({ blinkDetected: false, headPoseMatch: false, microExpressions: false });
    setIdentifiedName('');

    setTimeout(() => {
      setLivenessCheck(prev => ({ ...prev, blinkDetected: true }));
    }, 800);

    setTimeout(() => {
      setLivenessCheck(prev => ({ ...prev, headPoseMatch: true }));
    }, 1500);

    setTimeout(() => {
      if (mode === 'success') {
        setLivenessCheck(prev => ({ ...prev, microExpressions: true }));
        setScanStatus('COMPLETED');
        setIdentifiedName('Aarav Mehta (Room A-101)');
        recordGateEvent({ name: 'Aarav Mehta', type: 'Resident', roomOrPurpose: 'RM-101', status: 'GRANTED' });
      } else {
        setScanStatus('FAILED');
        recordGateEvent({ name: 'Unknown Subject', type: 'Visitor', roomOrPurpose: 'Liveness spoof attempt', status: 'DENIED' });
      }
    }, 2200);
  };

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 03</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Security Operations & Biometric Gate</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Biometric Face Scanner Simulator */}
        <div className="lg:col-span-5 border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
            <Eye className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">Biometric Gate Simulator</h3>
          </div>
          
          {/* Scanner UI Screen */}
          <div className="bg-warm-ivory border border-charcoal/10 relative h-64 flex flex-col justify-between p-4 font-mono text-xs overflow-hidden">
            {/* Design elements */}
            <div className="absolute inset-0 blueprint-grid-accent opacity-30 pointer-events-none"></div>

            {scanStatus === 'IDLE' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 z-10">
                <div className="w-20 h-20 border border-charcoal/30 flex items-center justify-center relative bg-surface-white">
                  <Shield className="w-8 h-8 text-slate-gray/50" />
                </div>
                <span className="text-slate-gray uppercase text-[10px]">Gate Lock: Engage. Stand in view.</span>
              </div>
            )}

            {scanStatus === 'SCANNING' && (
              <div className="flex-1 flex gap-4 py-2 z-10">
                <div className="w-24 h-24 border-2 border-dashed border-navy-accent flex items-center justify-center relative bg-surface-white self-center">
                  <div className="absolute inset-x-1 h-0.5 bg-forest-status top-1/2 animate-bounce"></div>
                  <span className="text-[8px] text-center text-slate-gray">FACE VECTOR</span>
                </div>
                <div className="flex-1 flex flex-col justify-center space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>1. Blink Detection:</span>
                    <span className={livenessCheck.blinkDetected ? 'text-forest-status' : 'text-slate-gray animate-pulse'}>
                      {livenessCheck.blinkDetected ? 'PASS' : 'TESTING...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>2. Head Pose Yaw:</span>
                    <span className={livenessCheck.headPoseMatch ? 'text-forest-status' : 'text-slate-gray animate-pulse'}>
                      {livenessCheck.headPoseMatch ? 'PASS' : 'TESTING...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>3. Micro-Expression:</span>
                    <span className="text-slate-gray animate-pulse">EVALUATING...</span>
                  </div>
                </div>
              </div>
            )}

            {scanStatus === 'COMPLETED' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 z-10 text-center">
                <div className="w-16 h-16 border border-forest-status bg-surface-white flex items-center justify-center">
                  <UserCheck className="w-8 h-8 text-forest-status" />
                </div>
                <div>
                  <span className="text-forest-status font-bold block uppercase text-[10px]">ACCESS GRANTED</span>
                  <span className="text-charcoal font-semibold text-xs block">{identifiedName}</span>
                </div>
              </div>
            )}

            {scanStatus === 'FAILED' && (
              <div className="flex-1 flex flex-col items-center justify-center space-y-3 z-10 text-center">
                <div className="w-16 h-16 border border-red-700 bg-surface-white flex items-center justify-center">
                  <ShieldAlert className="w-8 h-8 text-red-700" />
                </div>
                <div>
                  <span className="text-red-700 font-bold block uppercase text-[10px]">ACCESS DENIED</span>
                  <span className="text-slate-gray text-[10px] block">Liveness Validation Failed (Biometric Spoof Alert)</span>
                </div>
              </div>
            )}

            {/* Diagnostics footer */}
            <div className="border-t border-charcoal/10 pt-2 flex justify-between text-[9px] text-slate-gray z-10">
              <span>SCANNER NODE: SOC-G1</span>
              <span>STATE: {scanStatus}</span>
            </div>
          </div>

          {/* Trigger controls */}
          <div className="flex gap-4">
            <button 
              onClick={() => triggerScan('success')}
              disabled={scanStatus === 'SCANNING'}
              className="flex-1 bg-navy-accent hover:bg-charcoal text-surface-white font-mono text-xs uppercase tracking-wider py-3 disabled:opacity-50"
            >
              Verify Resident (Pass)
            </button>
            <button 
              onClick={() => triggerScan('fail')}
              disabled={scanStatus === 'SCANNING'}
              className="flex-1 bg-warm-ivory text-charcoal border border-charcoal/10 hover:bg-charcoal/5 font-mono text-xs uppercase tracking-wider py-3 disabled:opacity-50"
            >
              Spoof Photo (Fail)
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Visitor Auth & Access Ledger */}
        <div className="lg:col-span-7 space-y-6">
          
          {actionError && (
            <div role="alert" className="p-3 border border-red-700/20 bg-red-50/10 text-red-700 font-mono text-xs flex justify-between">
              <span>{actionError}</span>
              <button onClick={() => setActionError('')} aria-label="Dismiss" className="font-bold">✕</button>
            </div>
          )}

          {/* VISITOR PRE-AUTHORIZATION PANEL */}
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-navy-accent" />
                <h3 className="font-serif font-bold text-lg text-charcoal">Visitor Pre-Authorization</h3>
              </div>
              <span className="font-mono text-xs text-slate-gray">
                {visitors.length} Pending Requests
              </span>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {visitors.length === 0 ? (
                <div className="text-slate-gray font-mono text-xs p-4 border border-charcoal/10 bg-warm-ivory/30">No pending visitor requests.</div>
              ) : (
                visitors.map(req => (
                  <div key={req.id} className="border border-charcoal/10 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-warm-ivory/30">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-charcoal text-sm">{req.visitor} <span className="font-mono text-[10px] font-normal text-slate-gray">({req.purpose})</span></span>
                      <span className="text-xs text-slate-gray font-mono">Host: {req.host} • {req.date}</span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button className="flex-1 sm:flex-none border border-navy-accent text-navy-accent hover:bg-navy-accent hover:text-white px-3 py-1 font-mono text-[10px] uppercase transition-colors disabled:opacity-50"
                        disabled={busyId === req.id}
                        onClick={() => resolve(`/api/visitors/${req.id}/approve`, req.id, visitorsApi.reload)}>
                        Approve & Issue Pass
                      </button>
                      <button className="flex-1 sm:flex-none border border-red-700 text-red-700 hover:bg-red-700 hover:text-white px-3 py-1 font-mono text-[10px] uppercase transition-colors disabled:opacity-50"
                        disabled={busyId === req.id}
                        onClick={() => resolve(`/api/visitors/${req.id}/deny`, req.id, visitorsApi.reload)}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LEAVE APPROVALS PANEL */}
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-navy-accent" />
                <h3 className="font-serif font-bold text-lg text-charcoal">Leave & Absence Requests</h3>
              </div>
              <span className="font-mono text-xs text-slate-gray">{leaves.filter(l => l.status === 'Pending').length} Pending</span>
            </div>
            
            <div className="space-y-3 font-mono text-xs">
              {leaves.filter(l => l.status === 'Pending').length === 0 ? (
                <div className="text-slate-gray font-mono text-xs p-4 border border-charcoal/10 bg-warm-ivory/30">No pending leave requests.</div>
              ) : (
                leaves.filter(l => l.status === 'Pending').map(leave => (
                  <div key={leave.id} className="border border-charcoal/10 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-warm-ivory/30">
                    <div className="space-y-1">
                      <div className="font-bold text-charcoal">{leave.name} <span className="text-slate-gray font-normal">({leave.room})</span></div>
                      <div className="text-slate-gray">{leave.duration} — {leave.reason}</div>
                      {leave.proofUrl && (
                        <a 
                          href={leave.proofUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] text-navy-accent font-bold hover:underline block mt-1"
                        >
                          View Proof Attachment →
                        </a>
                      )}
                      <div className={`text-[10px] ${leave.consent.includes('Verified') ? 'text-forest-status' : 'text-red-700'}`}>
                        {leave.consent}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button className="flex-1 sm:flex-none border border-navy-accent text-navy-accent hover:bg-navy-accent hover:text-white px-3 py-1 font-mono text-[10px] uppercase transition-colors disabled:opacity-50"
                        disabled={busyId === leave.id}
                        onClick={() => resolve(`/api/leaves/${leave.id}/approve`, leave.id, leavesApi.reload)}>
                        Approve
                      </button>
                      <button className="flex-1 sm:flex-none border border-red-700 text-red-700 hover:bg-red-700 hover:text-white px-3 py-1 font-mono text-[10px] uppercase transition-colors disabled:opacity-50"
                        disabled={busyId === leave.id}
                        onClick={() => resolve(`/api/leaves/${leave.id}/deny`, leave.id, leavesApi.reload)}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ACCESS LEDGER TABLE */}
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-navy-accent" />
                <h3 className="font-serif font-bold text-lg text-charcoal">Cryptographic Gate Ledger</h3>
              </div>
              {ledgerApi.data && (
                <span className={`font-mono text-xs flex items-center gap-1 ${ledgerApi.data.verified ? 'text-forest-status' : 'text-red-700 font-bold'}`}>
                  <RefreshCw className="w-3.5 h-3.5" /> {ledgerApi.data.verified ? 'Hash Chain Verified' : 'CHAIN INTEGRITY FAILURE'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-gray font-mono">
              Every gate transaction is a SHA-256 block chained to the previous entry, so any edit to past records breaks verification.
            </p>
            {ledgerApi.error && <p className="text-xs text-red-700 font-mono">{ledgerApi.error}</p>}

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-charcoal/10 uppercase text-slate-gray">
                    <th className="py-2 font-semibold">Time</th>
                    <th className="py-2 font-semibold">Subject</th>
                    <th className="py-2 font-semibold">Type</th>
                    <th className="py-2 font-semibold">Room / Purpose</th>
                    <th className="py-2 font-semibold">Status</th>
                    <th className="py-2 font-semibold">Audit Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-charcoal/5">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-warm-ivory/50">
                      <td className="py-3 text-charcoal font-medium">{log.time}</td>
                      <td className="py-3 text-charcoal font-bold">{log.name}</td>
                      <td className="py-3 text-slate-gray">{log.type}</td>
                      <td className="py-3 text-slate-gray">{log.roomOrPurpose}</td>
                      <td className="py-3">
                        <span className={`px-1.5 py-0.5 border ${
                          log.status === 'GRANTED' ? 'text-forest-status border-forest-status/30 bg-forest-status/5' : 'text-red-700 border-red-700/30 bg-red-50/5'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-gray truncate max-w-[120px] select-all" title={log.hash}>
                        {log.hash.substring(0, 12)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
