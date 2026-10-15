import React, { useState } from 'react';
import { CreditCard, Calendar, Utensils, HeartPulse, ShieldAlert, Download, PhoneCall, AlertTriangle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useSession } from '../lib/session';
import { inr } from '../lib/format';

interface Grievance {
  id: string;
  subject: string;
  category: string;
  date: string;
  priority: string;
  status: 'UNDER ESCALATION REVIEW' | 'IN INVESTIGATION' | 'RESOLVED';
  isMine?: boolean;
}

interface Statement {
  cycleId: string;
  total: number;
  payment: { receiptId: string; amount: number } | null;
}

interface BillingSummary {
  cycleId: string;
  perStudent: number;
  residents: number;
  paidCount: number;
  collected: number;
  outstanding: number;
  dueResidents: { name: string; regNo: string; room: string }[];
}

interface HealthRecord {
  bloodGroup?: string;
  medicalNotes?: string;
  guardianName?: string;
  guardianPhone?: string;
}

const NEXT_GRIEVANCE_STATUS: Record<Grievance['status'], Grievance['status'] | null> = {
  'UNDER ESCALATION REVIEW': 'IN INVESTIGATION',
  'IN INVESTIGATION': 'RESOLVED',
  RESOLVED: null,
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

// Stable certificate number derived from the member and club, so it doesn't change between renders.
const certificateId = (seed: string) => {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 10000 + (h % 90000);
};

interface CampusOperationsHubProps {
  currentRole: string;
}

// Tuition is billed by the university; hostel rent, electricity and mess are billed per cycle in Student Services.
const TUITION_LEDGER = [
  { term: 'Fall Semester 2026-27', tuitionFee: '₹1,15,000', examFee: '₹4,500', labLibraryFee: '₹6,000', transportFee: '₹8,000', total: '₹1,33,500', status: 'PAID', receiptId: 'TUI-2026-9041' },
  { term: 'Winter Semester 2025-26', tuitionFee: '₹1,15,000', examFee: '₹4,500', labLibraryFee: '₹6,000', transportFee: '₹8,000', total: '₹1,33,500', status: 'PAID', receiptId: 'TUI-2026-3127' },
];

const CAMPUS_CLUBS = [
  { name: 'ACM Student Chapter', members: 340, category: 'Technical / Coding', event: 'Annual Coding Contest (TechSprint 2026)', eventDate: 'Oct 24, 2026', registrations: 212 },
  { name: 'IEEE Robotics Society', members: 210, category: 'Engineering / Hardware', event: 'Autonomous Bot Challenge', eventDate: 'Nov 03, 2026', registrations: 64 },
  { name: 'Music & Cultural Club', members: 480, category: 'Arts & Performing', event: 'Rhythm Night 2026', eventDate: 'Oct 31, 2026', registrations: 390 },
  { name: 'Environment & Green Club', members: 190, category: 'Social / Sustainability', event: 'Tree Plantation Drive', eventDate: 'Nov 08, 2026', registrations: 75 },
];
const EVENT_SCHEDULE = '09:00 AM Registration • 10:30 AM Opening Keynote • 02:00 PM Main Event • 06:00 PM Awards Ceremony';

const CAFETERIA_VENDORS = [
  { name: 'Food Court A - South Indian Corner', cuisine: 'Dosa, Idli, Vada, Filter Coffee', timing: '07:00 AM - 10:30 PM', rating: '4.8 / 5', hygiene: 'A', ordersToday: 1240 },
  { name: 'Food Court B - Bistro & Wraps', cuisine: 'Sandwiches, Pastas, Fresh Juices', timing: '10:00 AM - 11:00 PM', rating: '4.6 / 5', hygiene: 'A', ordersToday: 860 },
  { name: 'Night Canteen (Hostel Block A)', cuisine: 'Maggi, Parathas, Shakes, Tea', timing: '08:00 PM - 02:00 AM', rating: '4.9 / 5', hygiene: 'B+', ordersToday: 410 },
];
const MENU_ITEMS = [
  { name: 'Student Combo Thali', price: '₹95' },
  { name: 'Filter Coffee / Chai', price: '₹20' },
  { name: 'Fresh Fruit Juice / Shake', price: '₹40' },
];

const CLINIC_DOCTORS = [
  { name: 'Dr. Ananya Sharma', speciality: 'General Physician', hours: '09:00 AM - 05:00 PM', booked: 14, capacity: 20 },
  { name: 'Dr. K. R. Raman', speciality: 'Orthopaedics', hours: '10:00 AM - 01:00 PM', booked: 6, capacity: 8 },
  { name: 'Dr. Sarah Jenkins', speciality: 'Mental Health & Counselling', hours: '02:00 PM - 06:00 PM', booked: 5, capacity: 8 },
];

type SubTab = 'finance' | 'clubs' | 'cafeteria' | 'health' | 'grievance';
const card = 'border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-sm';
const btn = 'bg-navy-accent hover:bg-charcoal text-white text-xs font-bold px-3.5 py-2 rounded-xs uppercase tracking-wider transition-colors';

export default function CampusOperationsHub({ currentRole }: CampusOperationsHubProps) {
  const user = useSession();
  const isStudent = user?.role === 'Student';
  const isStaff = currentRole === 'CampusAdmin' || currentRole === 'HostelAdmin' || currentRole === 'Admin';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('finance');
  const studentLabel = user?.name ?? '';

  const statementApi = useApi<Statement>(isStudent ? '/api/billing/statement' : null);
  const summaryApi = useApi<BillingSummary>(isStaff ? '/api/billing/summary' : null);
  const healthApi = useApi<HealthRecord>(isStudent ? '/api/students/me' : null);
  const grievancesApi = useApi<Grievance[]>('/api/grievances');
  const grievances = grievancesApi.data ?? [];

  const [grievanceError, setGrievanceError] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [grievanceText, setGrievanceText] = useState('');
  const [grievanceCategory, setGrievanceCategory] = useState('Anti-Ragging Confidential Desk');
  const [appointment, setAppointment] = useState({ doctor: CLINIC_DOCTORS[0].name, at: '' });
  const [appointmentStatus, setAppointmentStatus] = useState('');
  const [selectedEventSchedule, setSelectedEventSchedule] = useState<{ name: string; event: string } | null>(null);
  const [joinedClubs, setJoinedClubs] = useState<string[]>([]);
  const [certificateModalClub, setCertificateModalClub] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [paidVendorStatus, setPaidVendorStatus] = useState<string | null>(null);
  const [showSosModal, setShowSosModal] = useState(false);

  const handleDownloadReceipt = (item: typeof TUITION_LEDGER[0]) => {
    const rows = [
      ['Student Name', studentLabel], ['Academic Period', item.term], ['Tuition Fee', item.tuitionFee],
      ['Examination Fee', item.examFee], ['Laboratory & Library', item.labLibraryFee], ['Campus Transport', item.transportFee],
    ].map(([k, v]) => `<div class="row"><span>${k}:</span><strong>${escapeHtml(v)}</strong></div>`).join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Tuition Receipt ${item.receiptId}</title><style>
      body { font-family: 'IBM Plex Mono', monospace; padding: 40px; background: #faf9f6; color: #111827; }
      .box { border: 2px solid #1e3a5f; padding: 30px; background: #fff; max-width: 650px; margin: 0 auto; }
      .title { font-size: 20px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
      .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; font-size: 14px; }
      .total { display: flex; justify-content: space-between; padding: 14px 0; border-top: 2px solid #1e3a5f; font-size: 16px; font-weight: bold; margin-top: 15px; }
      .btn { background: #1e3a5f; color: #fff; border: none; padding: 10px 20px; font-weight: bold; cursor: pointer; margin-top: 20px; width: 100%; }
      @media print { .btn { display: none; } }</style></head><body><div class="box">
      <div class="title">TUITION FEE RECEIPT</div><div style="font-size:13px;color:#4b5563;margin-bottom:16px">${item.receiptId} · ${new Date().toLocaleDateString()}</div>
      ${rows}<div class="total"><span>TOTAL PAID</span><span>${item.total}</span></div>
      <button id="print-receipt" class="btn">PRINT / SAVE AS PDF</button></div></body></html>`);
    win.document.close();
    // Attached from here rather than an inline onclick so it works under a strict CSP.
    win.document.getElementById('print-receipt')?.addEventListener('click', () => win.print());
  };

  const handleGrievanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grievanceText.trim()) return;
    setGrievanceError('');
    try {
      const created = await api.post<Grievance>('/api/grievances/file', {
        subject: grievanceText.trim(), category: grievanceCategory, isAnonymous,
      });
      grievancesApi.setData(prev => [created, ...(prev ?? [])]);
      setGrievanceText('');
    } catch (err) {
      setGrievanceError(errorMessage(err));
    }
  };

  const advanceGrievance = async (g: Grievance) => {
    const next = NEXT_GRIEVANCE_STATUS[g.status];
    if (!next) return;
    try {
      const updated = await api.post<Grievance>(`/api/grievances/${g.id}/status`, { status: next });
      grievancesApi.setData(prev => (prev ?? []).map(x => x.id === g.id ? updated : x));
    } catch (err) {
      setGrievanceError(errorMessage(err));
    }
  };

  const bookAppointment = () => {
    if (!appointment.at) { setAppointmentStatus('Choose a date and time first.'); return; }
    if (new Date(appointment.at) < new Date()) { setAppointmentStatus('Choose a time in the future.'); return; }
    setAppointmentStatus(`Requested with ${appointment.doctor} on ${new Date(appointment.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. The clinic will confirm by e-mail.`);
  };

  const tabs = [
    { id: 'finance', label: isStudent ? 'My Fees' : 'Fee Collection', icon: CreditCard },
    { id: 'clubs', label: isStudent ? 'Clubs & Events' : 'Clubs & Events', icon: Calendar },
    { id: 'cafeteria', label: isStudent ? 'Cafeteria' : 'Cafeteria Vendors', icon: Utensils },
    { id: 'health', label: isStudent ? 'Health & Clinic' : 'Campus Clinic', icon: HeartPulse },
    { id: 'grievance', label: isStudent ? 'Grievances' : 'Grievance Cases', icon: ShieldAlert },
  ];

  const statement = statementApi.data;
  const summary = summaryApi.data;
  const health = healthApi.data;
  const vendor = CAFETERIA_VENDORS.find(v => v.name === selectedVendor);

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-slate-gray font-mono text-xs uppercase tracking-wider">{isStudent ? 'Student Campus Life' : 'Campus Administration'}</span>
          <h2 className="font-serif font-bold text-2xl text-charcoal">Finance, Campus Life & Grievances</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            {isStudent
              ? 'Your fees and receipts, clubs, cafeteria, clinic appointments and confidential grievances.'
              : 'Dues collection, club activity, cafeteria vendors, clinic capacity and grievance case handling.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 bg-warm-ivory p-1 border border-charcoal/15 rounded-sm">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold transition-all rounded-xs ${
                activeSubTab === tab.id ? 'bg-navy-accent text-white shadow-xs' : 'text-charcoal/80 hover:bg-charcoal/5'}`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* FINANCE */}
      {activeSubTab === 'finance' && isStudent && (
        <div className={card}>
          <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
            <CreditCard className="w-5 h-5 text-navy-accent" /> My Fees
          </h3>
          {statementApi.error && <div role="alert" className="text-red-700">{statementApi.error}</div>}
          {statement && (
            <div className={`border p-4 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${statement.payment ? 'border-forest-status/30 bg-emerald-50/50' : 'border-amber-700/30 bg-amber-50'}`}>
              <div>
                <div className="font-bold text-charcoal">Hostel rent, electricity & mess · cycle {statement.cycleId}</div>
                <div className="text-slate-gray text-xs">Billed per cycle and paid in Student Services.</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${statement.payment ? 'text-forest-status' : 'text-amber-800'}`}>₹{inr(statement.total)} {statement.payment ? 'PAID' : 'DUE'}</div>
                {statement.payment && <div className="text-xs text-slate-gray">Receipt {statement.payment.receiptId}</div>}
              </div>
            </div>
          )}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-charcoal">Tuition fee ledger</h4>
              <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-xs text-xs">TUITION BALANCE: ₹0 (PAID)</span>
            </div>
            {TUITION_LEDGER.map(item => (
              <div key={item.term} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4">
                <div className="flex justify-between items-center border-b border-charcoal/10 pb-2">
                  <h4 className="font-bold text-charcoal">{item.term}</h4>
                  <span className="bg-emerald-50 text-forest-status border border-emerald-300 font-bold px-2.5 py-0.5 rounded-xs text-xs">{item.status} · {item.receiptId}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-gray">
                  <div>Tuition <strong className="text-charcoal block">{item.tuitionFee}</strong></div>
                  <div>Examination <strong className="text-charcoal block">{item.examFee}</strong></div>
                  <div>Lab & Library <strong className="text-charcoal block">{item.labLibraryFee}</strong></div>
                  <div>Transport <strong className="text-charcoal block">{item.transportFee}</strong></div>
                </div>
                <div className="flex justify-between items-center border-t border-charcoal/10 pt-3">
                  <span className="font-bold text-charcoal">Total paid: <span className="text-navy-accent">{item.total}</span></span>
                  <button onClick={() => handleDownloadReceipt(item)} className={`${btn} flex items-center gap-1.5`}><Download className="w-3.5 h-3.5" /> Receipt</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubTab === 'finance' && isStaff && (
        <div className={card}>
          <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
            <CreditCard className="w-5 h-5 text-navy-accent" /> Hostel Dues Collection {summary && <span className="font-mono text-xs text-slate-gray font-normal">· cycle {summary.cycleId}</span>}
          </h3>
          {summaryApi.error && <div role="alert" className="text-red-700">{summaryApi.error}</div>}
          {summary && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">Paid</div><div className="text-2xl font-bold text-forest-status">{summary.paidCount} / {summary.residents}</div></div>
                <div className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">Collected</div><div className="text-2xl font-bold text-charcoal">₹{inr(summary.collected)}</div></div>
                <div className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">Outstanding</div><div className="text-2xl font-bold text-amber-800">₹{inr(summary.outstanding)}</div></div>
                <div className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">Per Resident</div><div className="text-2xl font-bold text-navy-accent">₹{inr(summary.perStudent)}</div></div>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-charcoal">Residents with dues outstanding ({summary.dueResidents.length})</h4>
                <div className="max-h-80 overflow-auto border border-charcoal/10">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-warm-ivory text-slate-gray text-xs uppercase tracking-wider"><tr><th className="text-left p-2">Resident</th><th className="text-left p-2">Reg. No</th><th className="text-left p-2">Room</th><th className="text-right p-2">Amount</th></tr></thead>
                    <tbody>
                      {summary.dueResidents.map(r => (
                        <tr key={r.regNo} className="border-t border-charcoal/10"><td className="p-2 font-semibold text-charcoal">{r.name}</td><td className="p-2 text-slate-gray">{r.regNo}</td><td className="p-2 text-navy-accent font-bold">{r.room}</td><td className="p-2 text-right text-amber-800 font-bold">₹{inr(summary.perStudent)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-gray">Rates and new billing cycles are set from Power Grid Diagnostics. Tuition fees are managed by the university finance office.</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* CLUBS */}
      {activeSubTab === 'clubs' && (
        <div className={card}>
          <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
            <Calendar className="w-5 h-5 text-navy-accent" /> {isStudent ? 'Clubs & Upcoming Events' : 'Club Activity & Event Registrations'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CAMPUS_CLUBS.map(club => {
              const isJoined = joinedClubs.includes(club.name);
              return (
                <div key={club.name} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3">
                  <div className="flex justify-between items-start border-b border-charcoal/10 pb-2">
                    <div>
                      <h4 className="font-bold text-charcoal">{club.name}</h4>
                      <span className="text-slate-gray text-xs">{club.category} · {club.members} members</span>
                    </div>
                    {isStudent && <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${isJoined ? 'text-emerald-800 border-emerald-300 bg-emerald-50' : 'text-navy-accent border-navy-accent/30 bg-navy-accent/5'}`}>{isJoined ? 'MEMBER' : 'OPEN'}</span>}
                  </div>
                  <div>
                    <span className="text-slate-gray block text-xs">Next event · {club.eventDate}</span>
                    <strong className="text-charcoal block">{club.event}</strong>
                    {!isStudent && <span className="text-xs text-slate-gray">{club.registrations} registrations so far</span>}
                  </div>
                  <div className="pt-2 border-t border-charcoal/10 flex justify-between items-center">
                    <button onClick={() => setSelectedEventSchedule({ name: club.name, event: club.event })} className="text-navy-accent font-bold underline hover:text-charcoal text-xs">
                      Event schedule →
                    </button>
                    {isStudent && (
                      <button onClick={() => isJoined ? setCertificateModalClub(club.name) : setJoinedClubs(prev => [...prev, club.name])} className={btn}>
                        {isJoined ? 'Membership Certificate' : 'Join Club'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CAFETERIA */}
      {activeSubTab === 'cafeteria' && (
        <div className={card}>
          <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
            <Utensils className="w-5 h-5 text-navy-accent" /> {isStudent ? 'Campus Food Court' : 'Cafeteria Vendors'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CAFETERIA_VENDORS.map(v => (
              <div key={v.name} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-2">
                <div className="flex justify-between items-start gap-2 border-b border-charcoal/10 pb-2">
                  <h4 className="font-bold text-charcoal leading-snug">{v.name}</h4>
                  <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 text-xs border border-amber-200 rounded-xs shrink-0">★ {v.rating}</span>
                </div>
                <p className="text-slate-gray text-xs">Serves <strong className="text-charcoal">{v.cuisine}</strong></p>
                <p className="text-slate-gray text-xs">Hours <strong className="text-charcoal">{v.timing}</strong></p>
                {!isStudent && <p className="text-slate-gray text-xs">Hygiene grade <strong className="text-charcoal">{v.hygiene}</strong> · {v.ordersToday} orders today</p>}
                <button onClick={() => { setSelectedVendor(v.name); setPaidVendorStatus(null); }} className={`${btn} w-full mt-2`}>
                  {isStudent ? 'Menu & Order' : 'View Menu'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEALTH */}
      {activeSubTab === 'health' && (
        <div className={card}>
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-navy-accent" /> {isStudent ? 'Health & Clinic' : 'Campus Clinic'}
            </h3>
            <button onClick={() => setShowSosModal(true)} className="bg-rose-700 hover:bg-rose-900 text-white font-bold px-4 py-2 rounded-xs flex items-center gap-2 text-xs uppercase tracking-wider">
              <PhoneCall className="w-4 h-4" /> Ambulance SOS
            </button>
          </div>
          {isStudent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3">
                <h4 className="font-bold text-charcoal border-b border-charcoal/10 pb-2">Book an Appointment</h4>
                <label className="block"><span className="block text-slate-gray text-xs mb-1">Doctor</span>
                  <select value={appointment.doctor} onChange={e => setAppointment(a => ({ ...a, doctor: e.target.value }))} className="w-full p-2 border border-charcoal/25 bg-white text-sm text-charcoal rounded-xs">
                    {CLINIC_DOCTORS.map(d => <option key={d.name} value={d.name}>{d.name} ({d.speciality})</option>)}
                  </select>
                </label>
                <label className="block"><span className="block text-slate-gray text-xs mb-1">Date & time</span>
                  <input type="datetime-local" value={appointment.at} onChange={e => setAppointment(a => ({ ...a, at: e.target.value }))} className="w-full p-2 border border-charcoal/25 bg-white text-sm text-charcoal rounded-xs" />
                </label>
                <button onClick={bookAppointment} className={`${btn} w-full`}>Request Appointment</button>
                {appointmentStatus && <p className="text-xs font-bold text-charcoal">{appointmentStatus}</p>}
              </div>
              <div className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-2">
                <h4 className="font-bold text-charcoal border-b border-charcoal/10 pb-2">My Health Details</h4>
                {healthApi.error ? <div role="alert" className="text-red-700 text-xs">{healthApi.error}</div> : (
                  <div className="space-y-2 text-slate-gray">
                    <div className="flex justify-between"><span>Blood group</span><strong className="text-charcoal">{health?.bloodGroup ?? '—'}</strong></div>
                    <div className="flex justify-between gap-4"><span>Medical notes</span><strong className="text-charcoal text-right">{health?.medicalNotes ?? '—'}</strong></div>
                    <div className="flex justify-between gap-4"><span>Emergency contact</span><strong className="text-charcoal text-right">{health?.guardianName ? `${health.guardianName}, ${health.guardianPhone ?? ''}` : '—'}</strong></div>
                    <p className="text-xs pt-2">From your resident record (stored encrypted). Ask the warden's office to update it.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full border border-charcoal/15">
              <thead className="bg-warm-ivory text-slate-gray text-xs uppercase tracking-wider"><tr><th className="text-left p-3">Doctor</th><th className="text-left p-3">Speciality</th><th className="text-left p-3">Hours today</th><th className="text-right p-3">Appointments</th></tr></thead>
              <tbody>
                {CLINIC_DOCTORS.map(d => (
                  <tr key={d.name} className="border-t border-charcoal/10"><td className="p-3 font-bold text-charcoal">{d.name}</td><td className="p-3">{d.speciality}</td><td className="p-3">{d.hours}</td>
                    <td className="p-3 text-right"><span className={`font-bold ${d.booked / d.capacity > 0.8 ? 'text-amber-800' : 'text-forest-status'}`}>{d.booked} / {d.capacity}</span></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* GRIEVANCES */}
      {activeSubTab === 'grievance' && (
        <div className={card}>
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-700" /> {isStudent ? 'Confidential Grievances & Anti-Ragging' : 'Grievance & Anti-Ragging Cases'}
            </h3>
            <span className="bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded-xs text-xs">ZERO-TOLERANCE ANTI-RAGGING CELL</span>
          </div>
          {(grievanceError || grievancesApi.error) && <div role="alert" className="text-red-700">{grievanceError || grievancesApi.error}</div>}
          <div className={`grid grid-cols-1 ${isStudent ? 'lg:grid-cols-2' : ''} gap-8`}>
            {isStudent && (
              <form onSubmit={handleGrievanceSubmit} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4">
                <h4 className="font-bold text-charcoal uppercase text-xs">Raise a Grievance</h4>
                <label className="block"><span className="block text-slate-gray text-xs mb-1">Category</span>
                  <select value={grievanceCategory} onChange={e => setGrievanceCategory(e.target.value)} className="w-full p-2 border border-charcoal/25 bg-white text-sm text-charcoal rounded-xs">
                    <option>Anti-Ragging Confidential Desk</option>
                    <option>Hostel / Warden Complaint</option>
                    <option>Faculty / Academic Issue</option>
                    <option>Infrastructure / Safety Concern</option>
                  </select>
                </label>
                <label className="block"><span className="block text-slate-gray text-xs mb-1">Description *</span>
                  <textarea rows={4} required placeholder="Describe your concern in detail..." value={grievanceText} onChange={e => setGrievanceText(e.target.value)}
                    className="w-full p-2 border border-charcoal/25 bg-white text-sm text-charcoal outline-none focus:border-navy-accent rounded-xs" />
                </label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="anonymousCheck" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} className="w-4 h-4 accent-rose-700" />
                  <label htmlFor="anonymousCheck" className="text-charcoal text-xs font-bold cursor-pointer">File anonymously (staff will not see your name)</label>
                </div>
                <button type="submit" className="w-full bg-rose-700 hover:bg-charcoal text-white font-bold py-2.5 rounded-xs uppercase tracking-wider text-xs">File Confidential Ticket</button>
              </form>
            )}
            <div className="space-y-4">
              <h4 className="font-bold text-charcoal border-b border-charcoal/10 pb-2 uppercase text-xs">{isStudent ? 'My Tickets' : `Open and closed cases (${grievances.length})`}</h4>
              {grievancesApi.data?.length === 0 && <div className="text-slate-gray">No tickets filed yet.</div>}
              <div className={`grid gap-3 ${isStudent ? '' : 'md:grid-cols-2'}`}>
                {grievances.map(g => (
                  <div key={g.id} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-rose-700">{g.id}</span>
                      <span className={`font-bold px-2 py-0.5 text-xs rounded-xs ${g.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{g.status}</span>
                    </div>
                    <p className="font-semibold text-charcoal">{g.subject}</p>
                    <div className="flex justify-between text-slate-gray text-xs border-t border-charcoal/10 pt-1 gap-2">
                      <span>{g.category}</span><span>{g.date}</span>
                    </div>
                    {isStaff && NEXT_GRIEVANCE_STATUS[g.status] && (
                      <button onClick={() => advanceGrievance(g)} className="w-full border border-rose-700 text-rose-700 hover:bg-rose-700 hover:text-white py-1.5 text-xs font-bold uppercase rounded-xs">
                        Move to {NEXT_GRIEVANCE_STATUS[g.status]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVENT SCHEDULE MODAL */}
      {selectedEventSchedule && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface-white border border-charcoal/20 max-w-lg w-full p-6 space-y-4 font-mono text-sm shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <h4 className="font-bold text-navy-accent uppercase">{selectedEventSchedule.name}</h4>
              <button onClick={() => setSelectedEventSchedule(null)} aria-label="Close" className="text-slate-gray hover:text-charcoal font-bold">✕</button>
            </div>
            <p className="font-bold text-charcoal">{selectedEventSchedule.event}</p>
            <div className="p-3 bg-warm-ivory border border-charcoal/10 text-slate-gray">{EVENT_SCHEDULE}</div>
          </div>
        </div>
      )}

      {/* MEMBERSHIP CERTIFICATE (students only) */}
      {certificateModalClub && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface-white border-4 border-navy-accent max-w-lg w-full p-8 space-y-4 font-serif text-center shadow-2xl rounded-sm relative">
            <button onClick={() => setCertificateModalClub(null)} aria-label="Close" className="absolute top-3 right-4 text-slate-gray hover:text-charcoal font-mono text-sm font-bold">✕</button>
            <div className="text-xs font-mono uppercase tracking-widest text-navy-accent font-bold">Certificate of Membership</div>
            <h3 className="text-2xl font-bold text-charcoal">{certificateModalClub}</h3>
            <p className="text-sm font-mono text-slate-gray">This certifies that</p>
            <h4 className="text-xl font-bold text-navy-accent">{studentLabel}</h4>
            <p className="text-sm font-mono text-charcoal">is a registered member for the academic year 2026-27.</p>
            <div className="pt-4 border-t border-charcoal/10 font-mono text-xs text-slate-gray">CERT-ID: DEM-{certificateId(`${studentLabel}|${certificateModalClub}`)}</div>
          </div>
        </div>
      )}

      {/* CAFETERIA MENU */}
      {vendor && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface-white border border-charcoal/20 max-w-md w-full p-6 space-y-4 font-mono text-sm shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <div><h4 className="font-bold text-charcoal">{vendor.name}</h4><span className="text-xs text-slate-gray">{vendor.timing}</span></div>
              <button onClick={() => setSelectedVendor(null)} aria-label="Close" className="text-slate-gray hover:text-charcoal font-bold">✕</button>
            </div>
            {MENU_ITEMS.map(it => (
              <div key={it.name} className="flex justify-between items-center p-2.5 bg-warm-ivory border border-charcoal/10"><span className="text-charcoal font-semibold">{it.name}</span><span className="font-bold text-navy-accent">{it.price}</span></div>
            ))}
            {isStudent && (paidVendorStatus
              ? <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-center font-bold text-xs rounded-xs">{paidVendorStatus}</div>
              : <button onClick={() => setPaidVendorStatus('Order placed. Show this screen at the counter.')} className="w-full bg-forest-status hover:bg-charcoal text-white font-bold py-2.5 text-xs rounded-xs uppercase tracking-wider">Order Combo Thali (₹95)</button>)}
          </div>
        </div>
      )}

      {/* AMBULANCE SOS */}
      {showSosModal && (
        <div className="fixed inset-0 bg-rose-950/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface-white border-2 border-rose-700 max-w-md w-full p-6 space-y-4 font-mono text-sm shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-rose-200 pb-3">
              <h4 className="font-bold text-rose-700 uppercase flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Ambulance requested</h4>
              <button onClick={() => setShowSosModal(false)} aria-label="Close" className="text-slate-gray hover:text-charcoal font-bold">✕</button>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 font-bold">The campus clinic and Gate 1 medical station have been alerted.</div>
            <div className="space-y-1 text-slate-gray">
              <div>Clinic emergency line: <strong className="text-charcoal">+91 416 220 2222</strong></div>
              <div>Ambulance: <strong className="text-charcoal">Campus Ambulance 1</strong></div>
              <div>Estimated arrival: <strong className="text-rose-700">about 3 minutes</strong></div>
            </div>
            <button onClick={() => setShowSosModal(false)} className="w-full bg-rose-700 hover:bg-charcoal text-white font-bold py-2.5 text-xs rounded-xs uppercase tracking-wider">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
