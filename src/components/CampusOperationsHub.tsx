import React, { useState } from 'react';
import { CreditCard, Calendar, Utensils, HeartPulse, ShieldAlert, Download, PhoneCall } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useSession } from '../lib/session';

interface Grievance {
  id: string;
  subject: string;
  category: string;
  date: string;
  priority: string;
  status: 'UNDER ESCALATION REVIEW' | 'IN INVESTIGATION' | 'RESOLVED';
  isMine?: boolean;
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

const FEE_BREAKDOWN = [
  { term: 'Academic Year 2026-27 (Sem IV)', tuitionFee: '₹1,15,000', hostelFee: '₹45,000', messFee: '₹22,500', transportFee: '₹8,000', total: '₹1,90,500', status: 'PAID', receiptId: 'RCP-2026-9041' },
  { term: 'Academic Year 2025-26 (Sem III)', tuitionFee: '₹1,15,000', hostelFee: '₹45,000', messFee: '₹22,500', transportFee: '₹8,000', total: '₹1,90,500', status: 'PAID', receiptId: 'RCP-2025-8812' },
];

const CAMPUS_CLUBS = [
  { name: 'ACM Student Chapter', members: '340 Members', category: 'Technical / Coding', event: 'Annual Coding Contest (TechSprint 2026)', status: 'JOINED' },
  { name: 'IEEE Robotics Society', members: '210 Members', category: 'Engineering / Hardware', event: 'Autonomous Bot Challenge', status: 'OPEN' },
  { name: 'Music & Cultural Club', members: '480 Members', category: 'Arts & Performing', event: 'Rhythm Night 2026', status: 'JOINED' },
  { name: 'Environment & Green Club', members: '190 Members', category: 'Social / Sustainability', event: 'Tree Plantation Drive', status: 'OPEN' },
];

const CAFETERIA_VENDORS = [
  { name: 'Food Court A - South Indian Corner', cuisine: 'Dosa, Idli, Vada, Filter Coffee', timing: '07:00 AM - 10:30 PM', rating: '4.8 / 5.0 ★', status: 'OPEN' },
  { name: 'Food Court B - Bistro & Wraps', cuisine: 'Sandwiches, Pastas, Fresh Juices', timing: '10:00 AM - 11:00 PM', rating: '4.6 / 5.0 ★', status: 'OPEN' },
  { name: 'Night Canteen (Hostel Block A)', cuisine: 'Maggi, Parathas, Shakes, Tea', timing: '08:00 PM - 02:00 AM', rating: '4.9 / 5.0 ★', status: 'OPEN' },
];


export default function CampusOperationsHub({ currentRole }: CampusOperationsHubProps) {
  type SubTab = 'finance' | 'clubs' | 'cafeteria' | 'health' | 'grievance';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('finance');
  const user = useSession();
  const isStaff = currentRole === 'CampusAdmin' || currentRole === 'HostelAdmin' || currentRole === 'Admin';
  const studentLabel = user?.role === 'Student' ? user.name : 'Pratik Kumar (24BCE0194)';
  const grievancesApi = useApi<Grievance[]>('/api/grievances');
  const grievances = grievancesApi.data ?? [];
  const [grievanceError, setGrievanceError] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [grievanceText, setGrievanceText] = useState('');
  const [grievanceCategory, setGrievanceCategory] = useState('Anti-Ragging Confidential Desk');
  const [clinicAppointmentSubmitted, setClinicAppointmentSubmitted] = useState(false);

  // Modals & Interactive States
  const [selectedEventSchedule, setSelectedEventSchedule] = useState<{ name: string; event: string; schedule: string } | null>(null);
  const [joinedClubs, setJoinedClubs] = useState<string[]>(['ACM Student Chapter', 'Music & Cultural Club']);
  const [certificateModalClub, setCertificateModalClub] = useState<string | null>(null);
  const [selectedVendorMenu, setSelectedVendorMenu] = useState<{ name: string; cuisine: string; items: { name: string; price: string }[] } | null>(null);
  const [showSosModal, setShowSosModal] = useState(false);
  const [paidVendorStatus, setPaidVendorStatus] = useState<string | null>(null);

  const handleDownloadReceipt = (item: typeof FEE_BREAKDOWN[0]) => {
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Demeure AI - Official Fee Receipt ${item.receiptId}</title>
        <style>
          body { font-family: 'Courier New', monospace; padding: 40px; background: #faf9f6; color: #111827; }
          .receipt-box { border: 2px solid #1e3a5f; padding: 30px; background: #ffffff; max-width: 650px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { border-bottom: 2px solid #1e3a5f; pb-10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .title { font-size: 20px; font-weight: bold; color: #1e3a5f; }
          .subtitle { font-size: 11px; color: #4b5563; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e5e7eb; font-size: 13px; }
          .total-row { display: flex; justify-content: space-between; padding: 14px 0; border-top: 2px solid #1e3a5f; font-size: 16px; font-weight: bold; margin-top: 15px; }
          .watermark { text-align: center; font-size: 11px; color: #059669; font-weight: bold; border: 1px solid #059669; padding: 6px; margin-top: 25px; background: #ecfdf5; }
          .btn { background: #1e3a5f; color: white; border: none; padding: 10px 20px; font-family: monospace; font-weight: bold; cursor: pointer; margin-top: 20px; width: 100%; }
          @media print { .btn { display: none; } }
        </style>
      </head>
      <body>
        <div class="receipt-box">
          <div class="header">
            <div>
              <div class="title">DEMEURE AI // INSTITUTIONAL RECEIPT</div>
              <div class="subtitle">OFFICIAL TREASURY FEE TRANSACTION RECORD</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; font-weight: bold; color: #1e3a5f;">${item.receiptId}</div>
              <div style="font-size: 10px; color: #6b7280;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div class="row"><span>Student Name:</span><strong>${escapeHtml(studentLabel)}</strong></div>
          <div class="row"><span>Academic Period:</span><strong>${item.term}</strong></div>
          <div class="row"><span>Tuition Fee Component:</span><strong>${item.tuitionFee}</strong></div>
          <div class="row"><span>Hostel Accommodation:</span><strong>${item.hostelFee}</strong></div>
          <div class="row"><span>Mess Dining Charges:</span><strong>${item.messFee}</strong></div>
          <div class="row"><span>Campus Transport Shuttle:</span><strong>${item.transportFee}</strong></div>

          <div class="total-row">
            <span>TOTAL AMOUNT PAID:</span>
            <span style="color: #1e3a5f;">${item.total}</span>
          </div>

          <div class="watermark">✓ ELECTRONIC PAYMENT VERIFIED • STATUS: ${item.status}</div>

          <button id="print-receipt" class="btn">PRINT / DOWNLOAD PDF RECEIPT</button>
        </div>
      </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(receiptHtml);
      win.document.close();
      // Attached from here rather than an inline onclick so it works under a strict CSP.
      win.document.getElementById('print-receipt')?.addEventListener('click', () => win.print());
    }
  };

  const handleToggleClub = (clubName: string) => {
    if (joinedClubs.includes(clubName)) {
      setJoinedClubs(joinedClubs.filter(c => c !== clubName));
    } else {
      setJoinedClubs([...joinedClubs, clubName]);
    }
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

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-navy-accent/10 text-navy-accent font-mono text-[13px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-xs">
              Module Cluster 7, 11, 15, 16 & 17
            </span>
            <span className="text-slate-gray font-mono text-xs">• Finance, Student Life & Governance</span>
          </div>
          <h2 className="font-serif font-bold text-2xl text-charcoal">Finance, Campus Life & Grievance Governance</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            Institutional payment portal, student club events, cafeteria menus, campus clinic appointments, and anti-ragging grievance desk.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-warm-ivory p-1 border border-charcoal/15 rounded-sm">
          {[
            { id: 'finance', label: 'Finance & Fees', icon: CreditCard },
            { id: 'clubs', label: 'Events & Clubs', icon: Calendar },
            { id: 'cafeteria', label: 'Cafeteria & Food', icon: Utensils },
            { id: 'health', label: 'Health & Clinic', icon: HeartPulse },
            { id: 'grievance', label: 'Grievance & Anti-Ragging', icon: ShieldAlert },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-mono font-semibold transition-all rounded-xs ${
                activeSubTab === tab.id
                  ? 'bg-navy-accent text-white shadow-xs'
                  : 'text-charcoal/80 hover:bg-charcoal/5'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SUB TAB 1: FINANCE & FEES */}
      {activeSubTab === 'finance' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-navy-accent" /> Institutional Fee Ledger & Receipts (Module 7)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Tuition, Hostel, Mess, Transport fees, and online payment receipts.</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-xs">
              ACCOUNT BALANCE: ₹0.00 (PAID)
            </span>
          </div>

          <div className="space-y-4">
            {FEE_BREAKDOWN.map((item) => (
              <div key={item.term} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4 shadow-xs">
                <div className="flex justify-between items-center border-b border-charcoal/10 pb-2">
                  <h4 className="font-bold text-sm text-charcoal">{item.term}</h4>
                  <span className="bg-emerald-50 text-forest-status border border-emerald-300 font-bold px-2.5 py-0.5 rounded-xs text-[13px]">
                    STATUS: {item.status} ({item.receiptId})
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-gray">
                  <div>Tuition Fee: <strong className="text-charcoal block">{item.tuitionFee}</strong></div>
                  <div>Hostel Fee: <strong className="text-charcoal block">{item.hostelFee}</strong></div>
                  <div>Mess Charges: <strong className="text-charcoal block">{item.messFee}</strong></div>
                  <div>Transport Fee: <strong className="text-charcoal block">{item.transportFee}</strong></div>
                </div>

                <div className="flex justify-between items-center border-t border-charcoal/10 pt-3">
                  <span className="font-bold text-charcoal text-sm">Total Paid: <strong className="text-navy-accent">{item.total}</strong></span>
                  <button 
                    onClick={() => handleDownloadReceipt(item)}
                    className="bg-navy-accent hover:bg-charcoal text-white text-xs font-bold px-3.5 py-1.5 rounded-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB TAB 2: EVENTS & CLUBS */}
      {activeSubTab === 'clubs' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Calendar className="w-5 h-5 text-navy-accent" /> Student Clubs & Campus Events (Module 11)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Register for campus events, view club memberships, and obtain participation certificates.</p>
            </div>
            <span className="bg-navy-accent/10 text-navy-accent font-bold px-3 py-1 rounded-xs">
              ACTIVE CLUBS: 42
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CAMPUS_CLUBS.map((club) => {
              const isJoined = joinedClubs.includes(club.name);
              return (
                <div key={club.name} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3 shadow-xs">
                  <div className="flex justify-between items-start border-b border-charcoal/10 pb-2">
                    <div>
                      <h4 className="font-bold text-sm text-charcoal">{club.name}</h4>
                      <span className="text-slate-gray text-[13px]">{club.category} • {club.members}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${
                      isJoined ? 'text-emerald-800 border-emerald-300 bg-emerald-50' : 'text-navy-accent border-navy-accent/30 bg-navy-accent/5'
                    }`}>
                      {isJoined ? 'JOINED' : 'OPEN'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-gray block text-[13px]">Upcoming Flagship Event:</span>
                    <strong className="text-charcoal block text-xs mt-0.5">{club.event}</strong>
                  </div>

                  <div className="pt-2 border-t border-charcoal/10 flex justify-between items-center">
                    <button 
                      onClick={() => setSelectedEventSchedule({ name: club.name, event: club.event, schedule: '09:00 AM Registration • 10:30 AM Opening Keynote • 02:00 PM Live Challenge • 06:00 PM Awards Ceremony' })}
                      className="text-navy-accent font-bold underline hover:text-charcoal"
                    >
                      View Event Schedule →
                    </button>
                    <button 
                      onClick={() => {
                        if (isJoined) {
                          setCertificateModalClub(club.name);
                        } else {
                          handleToggleClub(club.name);
                        }
                      }}
                      className="bg-navy-accent hover:bg-charcoal text-white px-3 py-1 text-[13px] font-bold rounded-xs transition-colors"
                    >
                      {isJoined ? 'E-Certificate' : 'Join Club'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB TAB 3: CAFETERIA & FOOD */}
      {activeSubTab === 'cafeteria' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Utensils className="w-5 h-5 text-navy-accent" /> Campus Food Court & Cafeteria Vendors (Module 15)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Explore cafeteria menus, night canteens, digital meal plan passes, and vendor feedback.</p>
            </div>
            <span className="bg-forest-status text-white font-bold px-3 py-1 rounded-xs text-[13px]">
              DIGITAL MEAL PASS ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CAFETERIA_VENDORS.map((vendor) => (
              <div key={vendor.name} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3 shadow-xs">
                <div className="flex justify-between items-start border-b border-charcoal/10 pb-2">
                  <h4 className="font-bold text-charcoal text-xs leading-snug">{vendor.name}</h4>
                  <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 text-xs border border-amber-200 rounded-xs shrink-0">
                    {vendor.rating}
                  </span>
                </div>
                <p className="text-slate-gray text-[13px]">Specialties: <strong className="text-charcoal">{vendor.cuisine}</strong></p>
                <p className="text-slate-gray text-[13px]">Hours: <strong className="text-charcoal">{vendor.timing}</strong></p>
                
                <div className="pt-2 border-t border-charcoal/10">
                  <button 
                    onClick={() => setSelectedVendorMenu({
                      name: vendor.name,
                      cuisine: vendor.cuisine,
                      items: [
                        { name: 'Special Student Combo Thali', price: '₹95' },
                        { name: 'Filtered Coffee / Chai', price: '₹20' },
                        { name: 'Fresh Fruit Juice / Shake', price: '₹40' },
                      ]
                    })}
                    className="w-full bg-navy-accent hover:bg-charcoal text-white font-bold py-1.5 text-[13px] rounded-xs uppercase tracking-wider transition-colors"
                  >
                    View Digital Menu & Pay
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB TAB 4: HEALTH & WELLNESS CLINIC */}
      {activeSubTab === 'health' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-navy-accent" /> Campus Health Center & Medical Clinic (Module 16)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Schedule doctor consultations, access digital health records, or trigger emergency response.</p>
            </div>
            <button 
              onClick={() => setShowSosModal(true)}
              className="bg-rose-700 hover:bg-rose-900 text-white font-bold px-4 py-2 rounded-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <PhoneCall className="w-4 h-4 animate-bounce" /> 24x7 Ambulance SOS
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Consultation Booking */}
            <div className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4">
              <h4 className="font-bold text-charcoal text-sm border-b border-charcoal/10 pb-2">Schedule Medical Appointment</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-gray mb-1">Select Resident Doctor</label>
                  <select className="w-full p-2 border border-charcoal/20 bg-white font-mono text-xs text-charcoal rounded-xs">
                    <option>Dr. Ananya Sharma (General Physician)</option>
                    <option>Dr. K. R. Raman (Orthopedics Specialist)</option>
                    <option>Dr. Sarah Jenkins (Mental Health & Counseling)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-gray mb-1">Preferred Time Slot</label>
                  <input type="datetime-local" className="w-full p-2 border border-charcoal/20 bg-white font-mono text-xs text-charcoal rounded-xs" />
                </div>
                <button 
                  onClick={() => setClinicAppointmentSubmitted(true)}
                  className="w-full bg-navy-accent hover:bg-charcoal text-white font-bold py-2 rounded-xs uppercase tracking-wider"
                >
                  Confirm Appointment
                </button>
                {clinicAppointmentSubmitted && (
                  <p className="text-emerald-700 text-[13px] font-bold text-center">✓ Appointment confirmed with Campus Health Center.</p>
                )}
              </div>
            </div>

            {/* Health Record Summary */}
            <div className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3">
              <h4 className="font-bold text-charcoal text-sm border-b border-charcoal/10 pb-2">Student Health Record Summary</h4>
              <div className="space-y-2 text-slate-gray">
                <div className="flex justify-between"><span>Blood Group:</span><strong className="text-charcoal">O +ve</strong></div>
                <div className="flex justify-between"><span>Allergies:</span><strong className="text-charcoal">Dust / Pollen (Mild)</strong></div>
                <div className="flex justify-between"><span>Vaccination Status:</span><strong className="text-emerald-700 font-bold">FULLY VACCINATED ✓</strong></div>
                <div className="flex justify-between"><span>Emergency Contact:</span><strong className="text-charcoal">+91 98765 00112 (Parent)</strong></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 5: GRIEVANCES & ANTI-RAGGING DESK */}
      {activeSubTab === 'grievance' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-700" /> Confidential Grievances & Anti-Ragging Cell (Module 17)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Secure, anonymous reporting for student welfare, harassment, or anti-ragging complaints.</p>
            </div>
            <span className="bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded-xs">
              ZERO-TOLERANCE ANTI-RAGGING CELL
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Submit Grievance Form */}
            <form onSubmit={handleGrievanceSubmit} className="lg:col-span-6 border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4">
              <h4 className="font-bold text-charcoal text-sm uppercase">Raise Grievance Ticket</h4>
              
              <div>
                <label className="block text-slate-gray mb-1">Grievance Category</label>
                <select 
                  value={grievanceCategory}
                  onChange={(e) => setGrievanceCategory(e.target.value)}
                  className="w-full p-2 border border-charcoal/20 bg-white font-mono text-xs text-charcoal rounded-xs"
                >
                  <option>Anti-Ragging Confidential Desk</option>
                  <option>Hostel / Warden Complaint</option>
                  <option>Faculty / Academic Issue</option>
                  <option>Infrastructure / Safety Concern</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-gray mb-1">Detailed Description *</label>
                <textarea 
                  rows={4}
                  required
                  placeholder="Describe your concern in detail..."
                  value={grievanceText}
                  onChange={(e) => setGrievanceText(e.target.value)}
                  className="w-full p-2 border border-charcoal/20 bg-white font-mono text-xs text-charcoal outline-none focus:border-navy-accent rounded-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="anonymousCheck"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 accent-rose-700"
                />
                <label htmlFor="anonymousCheck" className="text-slate-gray text-xs font-bold cursor-pointer">
                  Submit Anonymously (Hide my identity from institutional log)
                </label>
              </div>

              <button 
                type="submit"
                className="w-full bg-rose-700 hover:bg-charcoal text-white font-bold py-2.5 rounded-xs uppercase tracking-wider transition-colors shadow-xs"
              >
                File Confidential Ticket
              </button>
            </form>

            {/* Existing Tickets List */}
            <div className="lg:col-span-6 space-y-4">
              <h4 className="font-bold text-charcoal text-sm border-b border-charcoal/10 pb-2 uppercase">{isStaff ? 'Ticket Audit History' : 'My Tickets'}</h4>
              {(grievanceError || grievancesApi.error) && (
                <div role="alert" className="text-red-700 font-mono text-xs">{grievanceError || grievancesApi.error}</div>
              )}
              {grievancesApi.data?.length === 0 && <div className="text-slate-gray font-mono text-xs">No tickets filed yet.</div>}
              <div className="space-y-3">
                {grievances.map((g) => (
                  <div key={g.id} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm space-y-2 shadow-xs">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-rose-700">{g.id}</span>
                      <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 text-xs rounded-xs">
                        {g.status}
                      </span>
                    </div>
                    <h5 className="font-bold text-charcoal text-xs">{g.subject}</h5>
                    <div className="flex justify-between text-slate-gray text-xs border-t border-charcoal/10 pt-1">
                      <span>Category: <strong>{g.category}</strong></span>
                      <span>Date: <strong>{g.date}</strong></span>
                    </div>
                    {isStaff && NEXT_GRIEVANCE_STATUS[g.status] && (
                      <button onClick={() => advanceGrievance(g)}
                        className="w-full border border-rose-700 text-rose-700 hover:bg-rose-700 hover:text-white py-1 text-xs font-bold uppercase rounded-xs transition-colors">
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
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white border border-charcoal/20 max-w-lg w-full p-6 space-y-4 font-mono text-xs shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <h4 className="font-bold text-navy-accent text-sm uppercase">{selectedEventSchedule.name} — Event Timeline</h4>
              <button onClick={() => setSelectedEventSchedule(null)} className="text-slate-gray hover:text-charcoal text-base font-bold">✕</button>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-charcoal text-sm">{selectedEventSchedule.event}</p>
              <div className="p-3 bg-warm-ivory border border-charcoal/10 leading-relaxed text-slate-gray text-xs">
                {selectedEventSchedule.schedule}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedEventSchedule(null)} className="bg-navy-accent text-white px-4 py-2 text-xs font-bold rounded-xs">
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E-CERTIFICATE MODAL */}
      {certificateModalClub && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white border-4 border-navy-accent max-w-lg w-full p-8 space-y-4 font-serif text-center shadow-2xl rounded-sm relative">
            <button onClick={() => setCertificateModalClub(null)} className="absolute top-3 right-4 text-slate-gray hover:text-charcoal font-mono text-sm font-bold">✕</button>
            <div className="text-xs font-mono uppercase tracking-widest text-navy-accent font-bold">INSTITUTIONAL CERTIFICATE OF PARTICIPATION</div>
            <h3 className="text-2xl font-bold text-charcoal">Demeure Institute of Technology</h3>
            <p className="text-xs font-mono text-slate-gray">This is officially awarded to</p>
            <h4 className="text-xl font-bold text-navy-accent underline">{studentLabel}</h4>
            <p className="text-xs font-mono text-charcoal leading-relaxed">
              In recognition of active participation and verified membership in the <strong>{certificateModalClub}</strong> during Academic Term 2026.
            </p>
            <div className="pt-4 border-t border-charcoal/10 flex justify-between font-mono text-xs text-slate-gray">
              <span>CERT-ID: DEM-{certificateId(`${studentLabel}|${certificateModalClub}`)}</span>
              <span>VERIFIED BY DEAN ACADEMICS</span>
            </div>
          </div>
        </div>
      )}

      {/* CAFETERIA MENU & PAY MODAL */}
      {selectedVendorMenu && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white border border-charcoal/20 max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <div>
                <h4 className="font-bold text-charcoal text-sm">{selectedVendorMenu.name}</h4>
                <span className="text-xs text-slate-gray">{selectedVendorMenu.cuisine}</span>
              </div>
              <button onClick={() => { setSelectedVendorMenu(null); setPaidVendorStatus(null); }} className="text-slate-gray hover:text-charcoal font-bold text-base">✕</button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-gray text-xs uppercase block">Popular Digital Menu Items</span>
              {selectedVendorMenu.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-center p-2.5 bg-warm-ivory border border-charcoal/10">
                  <span className="text-charcoal font-semibold">{it.name}</span>
                  <span className="font-bold text-navy-accent">{it.price}</span>
                </div>
              ))}
            </div>

            {paidVendorStatus ? (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-center font-bold text-xs rounded-xs">
                {paidVendorStatus}
              </div>
            ) : (
              <button 
                onClick={() => setPaidVendorStatus('✓ Payment Successful! Digital Meal Coupon #CPN-902 dispatched to your RFID Smart Pass.')}
                className="w-full bg-forest-status hover:bg-charcoal text-white font-bold py-2.5 text-xs rounded-xs uppercase tracking-wider transition-colors"
              >
                Pay via Student Wallet Pass (1-Click)
              </button>
            )}
          </div>
        </div>
      )}

      {/* AMBULANCE SOS EMERGENCY MODAL */}
      {showSosModal && (
        <div className="fixed inset-0 bg-rose-950/80 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white border-2 border-rose-700 max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-rose-200 pb-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-rose-700 animate-bounce" />
                <h4 className="font-bold text-rose-700 text-sm uppercase">EMERGENCY AMBULANCE DISPATCHED</h4>
              </div>
              <button onClick={() => setShowSosModal(false)} className="text-slate-gray hover:text-charcoal font-bold text-base">✕</button>
            </div>

            <div className="space-y-2 text-charcoal">
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold leading-relaxed">
                🚨 SOS Signal Broadcasted to Campus Clinic & Gate 1 Medical Station!
              </div>
              <div className="space-y-1 text-[13px] text-slate-gray">
                <div>Campus Ambulance Driver: <strong>V. Sundaram (+91 98400 11223)</strong></div>
                <div>Dispatched Vehicle: <strong>TN-37-EV-0911 (Campus Ambulance 1)</strong></div>
                <div>Live ETA: <strong className="text-rose-700 font-bold">2 Minutes 45 Seconds</strong></div>
                <div>Current Location Beacon: <strong>Hostel Complex Zone A</strong></div>
              </div>
            </div>

            <button 
              onClick={() => setShowSosModal(false)}
              className="w-full bg-rose-700 hover:bg-charcoal text-white font-bold py-2.5 text-xs rounded-xs uppercase tracking-wider transition-colors"
            >
              Acknowledge & Keep Beacon Active
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

