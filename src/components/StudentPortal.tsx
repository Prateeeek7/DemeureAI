import React, { useState } from 'react';
import { IndianRupee, FileText, CheckCircle, Clock, Upload, Link, UserCheck, Lock } from 'lucide-react';
import { api, errorMessage, ACCEPTED_UPLOADS, MAX_UPLOAD_BYTES } from '../lib/api';
import { useApi } from '../lib/useApi';
import { inr } from '../lib/format';

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

interface VisitorPass {
  id: string;
  visitor: string;
  date: string;
  purpose: string;
  status: 'Pending' | 'Approved' | 'Denied';
  passCode?: string;
}

interface Payment {
  receiptId: string;
  amount: number;
}

interface Statement {
  cycleId: string;
  baseFee: number;
  powerRate: number;
  units: number;
  electricity: number;
  messFineCount: number;
  messFines: number;
  total: number;
  payment: Payment | null;
}

const UPI_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;
const todayIso = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

interface ResidentProfile {
  name: string;
  regNo: string;
  course: string;
  branch: string;
  yearOfStudy: string;
  room: string;
  block: string;
  phone?: string;
  bloodGroup?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  homeAddress?: string;
  encryption?: { algorithm: string };
}

export default function StudentPortal() {
  const [leaveReason, setLeaveReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // File upload state
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Visitor pass request state
  const [visitorName, setVisitorName] = useState('');
  const [visitAt, setVisitAt] = useState('');
  const [visitPurpose, setVisitPurpose] = useState('');
  const [visitorStatus, setVisitorStatus] = useState('');

  const statement = useApi<Statement>('/api/billing/statement');
  const leaves = useApi<LeaveRequest[]>('/api/leaves');
  const visitors = useApi<VisitorPass[]>('/api/visitors');
  const profile = useApi<ResidentProfile>('/api/students/me');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setProofFile(null);
      setUploadStatus('Upload failed: file is larger than 5 MB');
      return;
    }
    setProofFile(file);
    setUploadStatus(`File selected: ${file.name}`);
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) {
      setUploadStatus('Submission failed: end date is before start date');
      return;
    }
    setUploading(true);
    setUploadStatus('Processing request...');

    try {
      let proofUrl: string | null = null;
      if (proofFile) {
        setUploadStatus('Uploading supporting document...');
        proofUrl = (await api.upload<{ url: string }>('/api/aws/s3/upload', proofFile)).url;
      }

      setUploadStatus('Saving request details...');
      await api.post('/api/leaves/submit', { startDate, endDate, reason: leaveReason, proofUrl });

      setLeaveReason('');
      setStartDate('');
      setEndDate('');
      setProofFile(null);
      setUploadStatus('Leave requested! Your guardian has been notified.');
      leaves.reload();
    } catch (err) {
      setUploadStatus(`Submission failed: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVisitorStatus('');
    try {
      await api.post('/api/visitors', { visitor: visitorName, visitAt, purpose: visitPurpose });
      setVisitorName('');
      setVisitAt('');
      setVisitPurpose('');
      setVisitorStatus('Request sent to the Warden for approval.');
      visitors.reload();
    } catch (err) {
      setVisitorStatus(`Request failed: ${errorMessage(err)}`);
    }
  };

  const handlePay = async () => {
    if (!UPI_PATTERN.test(upiId.trim())) {
      setPaymentError('Enter a valid UPI ID, e.g. name@okicici');
      return;
    }
    setPaymentProcessing(true);
    setPaymentError('');
    try {
      const updated = await api.post<Statement>('/api/payments', { upiId: upiId.trim() });
      statement.setData(() => updated);
      setShowPaymentModal(false);
    } catch (err) {
      setPaymentError(errorMessage(err));
      statement.reload();
    } finally {
      setPaymentProcessing(false);
    }
  };

  const bill = statement.data;
  const payment = bill?.payment ?? null;
  const isPaid = payment !== null;

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 07</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Student Services & Dues</h2>
      </div>

      {profile.data && (
        <div className="border border-charcoal/10 bg-warm-ivory p-5 font-mono text-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wider text-slate-gray">My Resident Record</div>
            <div className="font-serif text-lg font-bold text-charcoal">{profile.data.name}</div>
            <div className="text-slate-gray">{profile.data.regNo} · {profile.data.course} {profile.data.branch}, {profile.data.yearOfStudy}</div>
            <div className="font-bold text-navy-accent">Room {profile.data.room} (Block {profile.data.block})</div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between"><span className="text-slate-gray">Mobile</span><span>{profile.data.phone ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-gray">Blood Group</span><span>{profile.data.bloodGroup ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-gray">Guardian</span><span>{profile.data.guardianName ?? '—'}{profile.data.guardianRelation ? ` (${profile.data.guardianRelation})` : ''}</span></div>
            <div className="flex justify-between"><span className="text-slate-gray">Guardian Mobile</span><span>{profile.data.guardianPhone ?? '—'}</span></div>
          </div>
          <div className="space-y-1">
            <div className="text-slate-gray">Home Address</div>
            <div className="text-charcoal">{profile.data.homeAddress ?? '—'}</div>
            <div className="flex items-center gap-1 text-xs text-forest-status pt-1">
              <Lock className="w-3 h-3" /> Personal details are stored encrypted ({profile.data.encryption?.algorithm ?? 'AES-256-GCM'})
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* LEFT COLUMN: Financial Billing */}
        <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
            <IndianRupee className="w-5 h-5 text-navy-accent" />
            <h3 className="font-serif font-bold text-lg text-charcoal">Current Outstanding Dues</h3>
          </div>

          {statement.error && (
            <div className="p-3 border border-red-700/20 text-red-700 font-mono text-xs">{statement.error}</div>
          )}
          {statement.loading && <div className="font-mono text-xs text-slate-gray">Loading statement...</div>}

          {bill && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
                <div>
                  <span className="font-bold text-charcoal block">Hostel Base Fee</span>
                  <span className="text-slate-gray">Billing cycle {bill.cycleId}</span>
                </div>
                <span className="text-lg font-bold text-navy-accent">₹{inr(bill.baseFee)}</span>
              </div>

              <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
                <div>
                  <span className="font-bold text-charcoal block">Electricity Overage</span>
                  <span className="text-slate-gray">{bill.units} kWh @ ₹{bill.powerRate.toFixed(2)}/unit</span>
                </div>
                <span className="text-lg font-bold text-navy-accent">₹{inr(bill.electricity)}</span>
              </div>

              <div className="p-4 border border-charcoal/10 bg-warm-ivory/30 flex justify-between items-center">
                <div>
                  <span className="font-bold text-charcoal block">Mess Fines (Wastage)</span>
                  <span className="text-slate-gray">{bill.messFineCount} Instances</span>
                </div>
                <span className="text-lg font-bold text-navy-accent">₹{inr(bill.messFines)}</span>
              </div>

              <div className="border-t border-charcoal/10 pt-4 flex justify-between items-center">
                <span className="font-bold text-charcoal uppercase tracking-wider">Total Payable</span>
                <span className={`text-2xl font-serif font-bold ${isPaid ? 'text-forest-status' : 'text-red-700'}`}>
                  ₹{isPaid ? '0.00 (PAID ✓)' : inr(bill.total)}
                </span>
              </div>

              {payment ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-center font-bold text-xs rounded-xs">
                  ✓ ₹{inr(payment.amount)} paid for this billing cycle. Receipt Ref: {payment.receiptId}
                </div>
              ) : (
                <button
                  className="w-full bg-navy-accent hover:bg-charcoal text-surface-white uppercase py-3 tracking-wider transition-colors mt-4 text-xs font-bold rounded-xs shadow-xs"
                  onClick={() => { setPaymentError(''); setShowPaymentModal(true); }}
                >
                  Pay Now via UPI
                </button>
              )}
            </div>
          )}
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
                <label className="block text-slate-gray mb-1 uppercase" htmlFor="leave-start">Start Date</label>
                <input id="leave-start" type="date" min={todayIso()} value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" />
              </div>
              <div>
                <label className="block text-slate-gray mb-1 uppercase" htmlFor="leave-end">End Date</label>
                <input id="leave-end" type="date" min={startDate || todayIso()} value={endDate} onChange={e => setEndDate(e.target.value)} required className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" />
              </div>
            </div>

            <div>
              <label className="block text-slate-gray mb-1 uppercase" htmlFor="leave-reason">Destination & Reason</label>
              <textarea
                id="leave-reason"
                rows={3}
                required
                minLength={3}
                maxLength={500}
                value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent"
                placeholder="Going home for a family event..."
              />
            </div>

            {/* Supporting document uploader */}
            <div className="border border-dashed border-charcoal/20 p-4 bg-warm-ivory/10 flex flex-col items-center justify-center space-y-2">
              <Upload className="w-6 h-6 text-slate-gray" />
              <div className="text-center">
                <label className="cursor-pointer text-navy-accent hover:underline font-bold">
                  {proofFile ? `Attached: ${proofFile.name}` : 'Upload Supporting Document (Proof)'}
                  <input type="file" onChange={handleFileChange} className="hidden" accept={ACCEPTED_UPLOADS} />
                </label>
                <p className="text-xs text-slate-gray mt-1">Accepts PDF, PNG, JPG (Max 5MB)</p>
              </div>
            </div>

            {uploadStatus && (
              <div role="status" className={`p-2 border font-bold text-xs uppercase tracking-wider text-center ${
                uploadStatus.includes('failed') ? 'border-red-700/20 bg-red-50/10 text-red-700' : 'border-navy-accent/20 bg-navy-accent/5 text-navy-accent'
              }`}>
                {uploadStatus}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-charcoal hover:bg-navy-accent text-surface-white uppercase py-2.5 tracking-wider transition-colors disabled:opacity-50"
            >
              {uploading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>

          {/* Past Requests */}
          <div className="mt-8 pt-6 border-t border-charcoal/10 space-y-3">
            <h4 className="font-serif font-bold text-charcoal mb-2">My Applications</h4>
            {leaves.error && <div className="text-red-700 font-mono text-xs">{leaves.error}</div>}
            {leaves.data?.length === 0 && <div className="text-slate-gray font-mono text-xs">No recent applications.</div>}

            {leaves.data?.map(l => (
              <div key={l.id} className="p-3 border border-charcoal/10 bg-warm-ivory/50 flex justify-between items-center font-mono text-xs">
                <div className="space-y-1">
                  <div className="font-bold text-charcoal block">{l.duration}</div>
                  <div className="text-slate-gray">{l.reason}</div>
                  {l.proofUrl && (
                    <a
                      href={l.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-navy-accent flex items-center gap-1 hover:underline"
                    >
                      <Link className="w-3 h-3" /> View Proof Attachment
                    </a>
                  )}
                </div>
                <div>
                  {l.status === 'Approved' && <span className="text-forest-status flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Approved</span>}
                  {l.status === 'Pending' && <span className="text-navy-accent flex items-center gap-1"><Clock className="w-3 h-3" /> Pending Warden</span>}
                  {l.status === 'Denied' && <span className="text-red-700 flex items-center gap-1">Denied</span>}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* VISITOR PASS REQUESTS */}
      <div className="border border-charcoal/10 bg-surface-white p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
          <UserCheck className="w-5 h-5 text-navy-accent" />
          <h3 className="font-serif font-bold text-lg text-charcoal">Visitor Pass Requests</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleVisitorSubmit} className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-slate-gray mb-1 uppercase" htmlFor="visitor-name">Visitor Full Name</label>
              <input id="visitor-name" required minLength={2} maxLength={80} value={visitorName} onChange={e => setVisitorName(e.target.value)}
                className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" placeholder="e.g. Suresh Kumar" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-gray mb-1 uppercase" htmlFor="visitor-at">Visit Date & Time</label>
                <input id="visitor-at" type="datetime-local" required min={`${todayIso()}T00:00`} value={visitAt} onChange={e => setVisitAt(e.target.value)}
                  className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" />
              </div>
              <div>
                <label className="block text-slate-gray mb-1 uppercase" htmlFor="visitor-purpose">Purpose</label>
                <input id="visitor-purpose" required minLength={2} maxLength={120} value={visitPurpose} onChange={e => setVisitPurpose(e.target.value)}
                  className="w-full border border-charcoal/20 p-2 bg-surface-white focus:outline-none focus:border-navy-accent" placeholder="Parental Visit" />
              </div>
            </div>
            {visitorStatus && (
              <div role="status" className={`p-2 border font-bold text-xs uppercase tracking-wider text-center ${
                visitorStatus.includes('failed') ? 'border-red-700/20 text-red-700' : 'border-navy-accent/20 bg-navy-accent/5 text-navy-accent'
              }`}>{visitorStatus}</div>
            )}
            <button type="submit" className="w-full bg-charcoal hover:bg-navy-accent text-surface-white uppercase py-2.5 tracking-wider transition-colors">
              Request Visitor Pass
            </button>
          </form>

          <div className="space-y-3 font-mono text-xs">
            {visitors.error && <div className="text-red-700">{visitors.error}</div>}
            {visitors.data?.length === 0 && <div className="text-slate-gray">No visitor requests yet.</div>}
            {visitors.data?.map(v => (
              <div key={v.id} className="p-3 border border-charcoal/10 bg-warm-ivory/50 flex justify-between items-center gap-4">
                <div className="space-y-1">
                  <div className="font-bold text-charcoal">{v.visitor} <span className="font-normal text-slate-gray">({v.purpose})</span></div>
                  <div className="text-slate-gray">{v.date}</div>
                  {v.passCode && <div className="text-forest-status font-bold">Gate pass: <span className="select-all">{v.passCode}</span></div>}
                </div>
                <span className={v.status === 'Approved' ? 'text-forest-status' : v.status === 'Denied' ? 'text-red-700' : 'text-navy-accent'}>
                  {v.status === 'Pending' ? 'Pending Warden' : v.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPaymentModal && bill && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-surface-white border border-charcoal/20 max-w-sm w-full p-6 space-y-4 font-mono text-xs shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <h4 className="font-bold text-navy-accent text-sm uppercase">Secure Payment Portal</h4>
              <button onClick={() => setShowPaymentModal(false)} aria-label="Close" className="text-slate-gray hover:text-charcoal font-bold text-base">✕</button>
            </div>

            <div className="p-3 bg-warm-ivory border border-charcoal/10 space-y-1">
              <div className="text-xs text-slate-gray uppercase">Transaction Summary</div>
              <div className="flex justify-between font-bold text-charcoal">
                <span>Total Due:</span>
                <span className="text-navy-accent">₹{inr(bill.total)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-slate-gray uppercase" htmlFor="upi-id">Enter Virtual Payment Address (VPA / UPI ID)</label>
              <input
                id="upi-id"
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="username@okicici"
                className="w-full border border-charcoal/20 p-2.5 bg-white text-xs text-charcoal outline-none focus:border-navy-accent rounded-xs"
              />
              {paymentError && <div className="text-red-700 text-xs font-bold">{paymentError}</div>}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-3 py-2 border border-charcoal/20 text-xs text-charcoal rounded-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentProcessing}
                onClick={handlePay}
                className="px-4 py-2 bg-navy-accent hover:bg-charcoal text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs disabled:opacity-50"
              >
                {paymentProcessing ? 'Authorizing Payment...' : `Authorize ₹${inr(bill.total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
