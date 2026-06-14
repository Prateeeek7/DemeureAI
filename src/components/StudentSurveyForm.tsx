import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ClipboardList, Download, CheckCircle, User, BookOpen,
  Building, Layers, BedDouble, ChevronRight, Trash2, Cpu, Zap,
} from 'lucide-react';
import ThemedSelect from './ThemedSelect';

// ── Types (exported so DashboardLayout can hold shared state) ─────────────────
export interface SurveyEntry {
  id: string;
  studentId: string;
  fullName: string;
  rollNumber: string;
  email: string;
  gender: string;
  course: string;
  branch: string;
  yearOfStudy: string;
  preferredBlock: string;
  preferredFloor: string;
  roomTypePref: string;
  sleepHabit: string;
  studyEnv: string;
  cleanliness: string;
  socialPref: string;
  dietaryPref: string;
  specialNeeds: string;
  submittedAt: string;
}

// ── ML vector encoder ─────────────────────────────────────────────────────────
export function encodeVector(entry: SurveyEntry) {
  const sleepMap:  Record<string, number> = { 'Early Riser': 0, 'Night Owl': 1, 'Flexible': 2 };
  const studyMap:  Record<string, number> = { 'Absolute Silence': 0, 'Ambient / Music OK': 1, 'Library Preferred': 2 };
  const cleanMap:  Record<string, number> = { 'Strict / Scheduled': 0, 'Moderate / Weekends': 1, 'Relaxed / Minimal': 2 };
  const socialMap: Record<string, number> = { 'Quiet Sanctuary': 0, 'Moderate / Occasional': 1, 'Active Hub': 2 };
  return {
    sleep_vec:  sleepMap[entry.sleepHabit]  ?? -1,
    study_vec:  studyMap[entry.studyEnv]    ?? -1,
    clean_vec:  cleanMap[entry.cleanliness] ?? -1,
    social_vec: socialMap[entry.socialPref] ?? -1,
    gender_bin: entry.gender === 'Male' ? 0 : 1,
    veg_bin:    ['Vegetarian', 'Vegan', 'Jain'].includes(entry.dietaryPref) ? 1 : 0,
  };
}

const EMPTY: Omit<SurveyEntry, 'id' | 'studentId' | 'submittedAt'> = {
  fullName: '', rollNumber: '', email: '',
  gender: '', course: '', branch: '', yearOfStudy: '',
  preferredBlock: '', preferredFloor: '', roomTypePref: '',
  sleepHabit: '', studyEnv: '', cleanliness: '', socialPref: '',
  dietaryPref: '', specialNeeds: '',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface StudentSurveyFormProps {
  currentRole: 'Admin' | 'Warden' | 'MessManager' | 'Student';
  submissions: SurveyEntry[];
  onAddSubmission: (entry: SurveyEntry) => void;
  onRemoveSubmission: (id: string) => void;
}

// ── Section header helper ─────────────────────────────────────────────────────
const Section = ({ n, icon: Icon, title }: { n: string; icon: any; title: string }) => (
  <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3 mb-4">
    <span className="font-mono text-[10px] text-slate-gray">{n}</span>
    <Icon className="w-4 h-4 text-navy-accent" />
    <h4 className="font-serif font-bold text-charcoal">{title}</h4>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
export default function StudentSurveyForm({
  currentRole,
  submissions,
  onAddSubmission,
  onRemoveSubmission,
}: StudentSurveyFormProps) {
  const isAdmin = currentRole === 'Admin' || currentRole === 'Warden';

  const [form, setForm] = useState({ ...EMPTY });
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof EMPTY, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: SurveyEntry = {
      ...form,
      id: String(Date.now()),
      studentId: `STU-${String(submissions.length + 101).padStart(3, '0')}`,
      submittedAt: new Date().toLocaleString('en-IN'),
    };
    onAddSubmission(entry);
    setSubmitted(true);
    setForm({ ...EMPTY });
    setTimeout(() => setSubmitted(false), 3500);
  };

  // ── Excel Export (admin only) ─────────────────────────────────────────────
  const handleExportExcel = () => {
    if (submissions.length === 0) return;
    const wb = XLSX.utils.book_new();

    const fullRows = submissions.map(s => ({
      'Student ID': s.studentId, 'Full Name': s.fullName, 'Roll Number': s.rollNumber,
      'Email': s.email, 'Gender': s.gender, 'Course': s.course, 'Branch': s.branch,
      'Year of Study': s.yearOfStudy, 'Preferred Block': s.preferredBlock,
      'Preferred Floor': s.preferredFloor, 'Room Type': s.roomTypePref,
      'Sleep Habit': s.sleepHabit, 'Study Env': s.studyEnv, 'Cleanliness': s.cleanliness,
      'Social Pref': s.socialPref, 'Diet': s.dietaryPref,
      'Special Needs': s.specialNeeds || 'None', 'Submitted At': s.submittedAt,
    }));
    const ws1 = XLSX.utils.json_to_sheet(fullRows);
    ws1['!cols'] = Array(Object.keys(fullRows[0]).length).fill({ wch: 22 });
    XLSX.utils.book_append_sheet(wb, ws1, 'Survey Responses');

    const mlRows = submissions.map(s => { const v = encodeVector(s); return { student_id: s.studentId, name: s.fullName, block: s.preferredBlock, floor: s.preferredFloor, room_type: s.roomTypePref, sleep_vec: v.sleep_vec, study_vec: v.study_vec, clean_vec: v.clean_vec, social_vec: v.social_vec, gender_bin: v.gender_bin, veg_bin: v.veg_bin }; });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mlRows), 'ML Feature Matrix');
    XLSX.writeFile(wb, `DemeureAI_Survey_${submissions.length}_Students.xlsx`);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // STUDENT VIEW — form only
  // ══════════════════════════════════════════════════════════════════════════
  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div className="border-b border-charcoal/10 pb-4">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 08</span>
          <h2 className="font-serif text-3xl font-bold text-navy-accent">Room Preference Survey</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            Your responses are automatically sent to the allocation engine — no further steps needed.
          </p>
        </div>

        {/* Auto-feed indicator */}
        <div className="flex items-center gap-3 border border-forest-status/20 bg-green-50 px-4 py-2.5 font-mono text-[10px] text-forest-status">
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>Live feed enabled</strong> — your submission will instantly appear in the allocation model.
            No Excel import required.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {/* § 1 Personal */}
          <div className="border border-charcoal/10 bg-surface-white p-6">
            <Section n="§ 01" icon={User} title="Personal Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Full Name *</label>
                <input required value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Aarav Sharma"
                  className="w-full bg-warm-ivory border border-charcoal/15 px-3 py-2.5 text-charcoal outline-none focus:border-navy-accent placeholder-slate-gray/30" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Roll Number *</label>
                <input required value={form.rollNumber} onChange={e => set('rollNumber', e.target.value)} placeholder="DE24CSE001"
                  className="w-full bg-warm-ivory border border-charcoal/15 px-3 py-2.5 text-charcoal outline-none focus:border-navy-accent placeholder-slate-gray/30 uppercase" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Email *</label>
                <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@demeure.ac.in"
                  className="w-full bg-warm-ivory border border-charcoal/15 px-3 py-2.5 text-charcoal outline-none focus:border-navy-accent placeholder-slate-gray/30" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Gender *</label>
                <ThemedSelect value={form.gender} onChange={v => set('gender', v)} placeholder="Select..."
                  options={[{value:'Male',label:'Male'},{value:'Female',label:'Female'},{value:'Other',label:'Other / Prefer not to say'}]} />
              </div>
            </div>
          </div>

          {/* § 2 Academic */}
          <div className="border border-charcoal/10 bg-surface-white p-6">
            <Section n="§ 02" icon={BookOpen} title="Academic Profile" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Course *</label>
                <ThemedSelect value={form.course} onChange={v => set('course', v)} placeholder="Select..."
                  options={['B.Tech','M.Tech','MBA','MCA','PhD','B.Sc','M.Sc'].map(c => ({value:c,label:c}))} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Branch *</label>
                <ThemedSelect value={form.branch} onChange={v => set('branch', v)} placeholder="Select..."
                  options={['CSE','ECE','ME','Civil','EEE','IT','AI & ML','Data Science','Biotechnology','Chemical Engg'].map(b => ({value:b,label:b}))} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Year *</label>
                <ThemedSelect value={form.yearOfStudy} onChange={v => set('yearOfStudy', v)} placeholder="Select..."
                  options={['Year 1','Year 2','Year 3','Year 4','Year 5+'].map(y => ({value:y,label:y}))} />
              </div>
            </div>
          </div>

          {/* § 3 Accommodation */}
          <div className="border border-charcoal/10 bg-surface-white p-6">
            <Section n="§ 03" icon={Building} title="Accommodation Preference" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Preferred Block *</label>
                <ThemedSelect value={form.preferredBlock} onChange={v => set('preferredBlock', v)} placeholder="Select block..."
                  options={[{value:'A',label:'Block A — Boys (North Wing)'},{value:'B',label:'Block B — Girls (South Wing)'},{value:'C',label:'Block C — Mixed / PG'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Preferred Floor *</label>
                <ThemedSelect value={form.preferredFloor} onChange={v => set('preferredFloor', v)} placeholder="Select floor..."
                  options={[{value:'1',label:'Floor 1 (101–110)'},{value:'2',label:'Floor 2 (201–210)'},{value:'3',label:'Floor 3 (301–310)'},{value:'4',label:'Floor 4 (401–410)'},{value:'5',label:'Floor 5 (501–510)'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Room Type *</label>
                <ThemedSelect value={form.roomTypePref} onChange={v => set('roomTypePref', v)} placeholder="Select type..."
                  options={[{value:'Single',label:'Single (1 person)'},{value:'Double',label:'Double (2 persons)'},{value:'Suite',label:'Suite (3–4 persons)'}]} />
              </div>
            </div>
          </div>

          {/* § 4 Lifestyle */}
          <div className="border border-charcoal/10 bg-surface-white p-6">
            <Section n="§ 04" icon={Layers} title="Lifestyle Profile — used by AI compatibility engine" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">1. Sleep Habit *</label>
                <ThemedSelect value={form.sleepHabit} onChange={v => set('sleepHabit', v)} placeholder="Select..."
                  options={[{value:'Early Riser',label:'Early Riser (Before 6 AM)'},{value:'Night Owl',label:'Night Owl (Past midnight)'},{value:'Flexible',label:'Flexible'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">2. Study Environment *</label>
                <ThemedSelect value={form.studyEnv} onChange={v => set('studyEnv', v)} placeholder="Select..."
                  options={[{value:'Absolute Silence',label:'Absolute Silence'},{value:'Ambient / Music OK',label:'Ambient / Music OK'},{value:'Library Preferred',label:'Library Preferred'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">3. Cleanliness Standard *</label>
                <ThemedSelect value={form.cleanliness} onChange={v => set('cleanliness', v)} placeholder="Select..."
                  options={[{value:'Strict / Scheduled',label:'Strict / Scheduled'},{value:'Moderate / Weekends',label:'Moderate / Weekends'},{value:'Relaxed / Minimal',label:'Relaxed / Minimal'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">4. Social Preference *</label>
                <ThemedSelect value={form.socialPref} onChange={v => set('socialPref', v)} placeholder="Select..."
                  options={[{value:'Quiet Sanctuary',label:'Quiet Sanctuary'},{value:'Moderate / Occasional',label:'Moderate / Occasional'},{value:'Active Hub',label:'Active Hub'}]} />
              </div>
            </div>
          </div>

          {/* § 5 Dietary */}
          <div className="border border-charcoal/10 bg-surface-white p-6">
            <Section n="§ 05" icon={BedDouble} title="Dietary & Special Requirements" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Dietary Preference *</label>
                <ThemedSelect value={form.dietaryPref} onChange={v => set('dietaryPref', v)} placeholder="Select..."
                  options={[{value:'Vegetarian',label:'Vegetarian'},{value:'Non-Vegetarian',label:'Non-Vegetarian'},{value:'Vegan',label:'Vegan'},{value:'Jain',label:'Jain (strict veg)'}]} />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">Special Needs / Notes</label>
                <input value={form.specialNeeds} onChange={e => set('specialNeeds', e.target.value)}
                  placeholder="E.g. Allergic to dust, near lift…"
                  className="w-full bg-warm-ivory border border-charcoal/15 px-3 py-2.5 text-charcoal outline-none focus:border-navy-accent placeholder-slate-gray/30 font-mono text-xs" />
              </div>
            </div>
          </div>

          <button type="submit"
            className="w-full bg-navy-accent hover:bg-charcoal text-surface-white py-4 font-mono uppercase tracking-widest text-[12px] transition-colors flex items-center justify-center gap-2">
            <ClipboardList className="w-4 h-4" /> Submit Preference Survey
            <ChevronRight className="w-4 h-4" />
          </button>

          {submitted && (
            <div className="border border-forest-status/30 bg-green-50 p-4 text-center font-mono text-[11px] text-forest-status flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              ✓ Submitted &amp; auto-fed to the AI allocation model. You're all set!
            </div>
          )}
        </form>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ADMIN / WARDEN VIEW — responses only, no form
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-charcoal/10 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 08</span>
          <h2 className="font-serif text-3xl font-bold text-navy-accent">Survey Responses &amp; ML Feed</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            Student submissions auto-feed the compatibility model in real-time. No import required.
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={submissions.length === 0}
          className={`flex items-center gap-2 px-4 py-2 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
            submissions.length > 0
              ? 'bg-forest-status/10 border-forest-status/30 text-forest-status hover:bg-forest-status hover:text-surface-white'
              : 'opacity-40 cursor-not-allowed border-charcoal/10 text-slate-gray'
          }`}
        >
          <Download className="w-3.5 h-3.5" /> Export {submissions.length} to Excel
        </button>
      </div>

      {/* Pipeline status strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
        {[
          { label: 'Live Responses', val: String(submissions.length), color: 'text-navy-accent' },
          { label: 'Baseline Dataset', val: '100 Students', color: 'text-charcoal' },
          { label: 'Total in Model', val: String(100 + submissions.length), color: 'text-charcoal' },
          { label: 'Model Status', val: 'LIVE FEED ●', color: 'text-forest-status' },
        ].map(s => (
          <div key={s.label} className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
            <span className="text-slate-gray uppercase text-[9px] block">{s.label}</span>
            <span className={`font-serif text-xl font-bold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Auto-feed notice */}
      <div className="flex items-center gap-3 border border-navy-accent/15 bg-blue-50/60 px-4 py-3 font-mono text-[10px] text-navy-accent">
        <Cpu className="w-4 h-4 flex-shrink-0 text-navy-accent" />
        <span>
          <strong>Auto-feed active</strong> — every student submission is encoded into ML vectors and appended to the
          compatibility matrix instantly. Cosine similarity scores update on each new entry.
        </span>
      </div>

      {/* Responses table */}
      {submissions.length === 0 ? (
        <div className="border border-dashed border-charcoal/20 p-16 text-center bg-warm-ivory font-mono text-xs text-slate-gray">
          No student submissions yet. Once students fill the survey, their data will appear here automatically.
        </div>
      ) : (
        <div className="border border-charcoal/10 overflow-x-auto">
          <table className="w-full font-mono text-[10px]">
            <thead>
              <tr className="bg-navy-accent text-surface-white">
                {['ID','Name','Roll No.','Block','Floor','Room','Sleep','Study Env','Social','Diet','Submitted'].map(h => (
                  <th key={h} className="p-2.5 text-left font-bold uppercase text-[9px] tracking-wider whitespace-nowrap">{h}</th>
                ))}
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, idx) => (
                <tr key={s.id} className={`border-b border-charcoal/5 ${idx % 2 === 0 ? 'bg-surface-white' : 'bg-warm-ivory'}`}>
                  <td className="p-2.5 font-bold text-navy-accent">{s.studentId}</td>
                  <td className="p-2.5 text-charcoal font-semibold whitespace-nowrap">{s.fullName}</td>
                  <td className="p-2.5 text-slate-gray">{s.rollNumber}</td>
                  <td className="p-2.5">
                    <span className="px-1.5 py-0.5 border border-navy-accent/20 text-navy-accent font-bold">
                      Block {s.preferredBlock}
                    </span>
                  </td>
                  <td className="p-2.5 text-charcoal">F{s.preferredFloor}</td>
                  <td className="p-2.5 text-charcoal">{s.roomTypePref}</td>
                  <td className="p-2.5 text-slate-gray whitespace-nowrap">{s.sleepHabit}</td>
                  <td className="p-2.5 text-slate-gray whitespace-nowrap">{s.studyEnv}</td>
                  <td className="p-2.5 text-slate-gray whitespace-nowrap">{s.socialPref}</td>
                  <td className="p-2.5 text-slate-gray">{s.dietaryPref}</td>
                  <td className="p-2.5 text-slate-gray text-[9px] whitespace-nowrap">{s.submittedAt}</td>
                  <td className="p-2.5">
                    <button onClick={() => onRemoveSubmission(s.id)}
                      className="text-red-700/40 hover:text-red-700 transition-colors" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ML Feature Matrix preview */}
      {submissions.length > 0 && (
        <div className="border border-charcoal/10 bg-surface-white p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-charcoal/5 pb-2">
            <Cpu className="w-4 h-4 text-navy-accent" />
            <span className="font-mono text-[10px] font-bold text-navy-accent uppercase tracking-wider">
              ML Feature Matrix — Live (first 5 rows)
            </span>
            <span className="ml-auto font-mono text-[9px] text-forest-status border border-forest-status/20 px-1.5 py-0.5">
              ● AUTO-UPDATED
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="font-mono text-[9px]">
              <thead>
                <tr className="text-slate-gray border-b border-charcoal/5">
                  {['student_id','name','block','floor','room_type','sleep_vec','study_vec','clean_vec','social_vec','gender_bin','veg_bin'].map(h => (
                    <th key={h} className="p-1.5 text-left whitespace-nowrap pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.slice(0, 5).map(s => {
                  const v = encodeVector(s);
                  return (
                    <tr key={s.id} className="border-b border-charcoal/5 text-charcoal">
                      <td className="p-1.5 pr-5 text-navy-accent">{s.studentId}</td>
                      <td className="p-1.5 pr-5">{s.fullName}</td>
                      <td className="p-1.5 pr-5">{s.preferredBlock}</td>
                      <td className="p-1.5 pr-5">{s.preferredFloor}</td>
                      <td className="p-1.5 pr-5">{s.roomTypePref}</td>
                      <td className="p-1.5 pr-5 font-bold text-amber-700">{v.sleep_vec}</td>
                      <td className="p-1.5 pr-5 font-bold text-amber-700">{v.study_vec}</td>
                      <td className="p-1.5 pr-5 font-bold text-amber-700">{v.clean_vec}</td>
                      <td className="p-1.5 pr-5 font-bold text-amber-700">{v.social_vec}</td>
                      <td className="p-1.5 pr-5 font-bold text-navy-accent">{v.gender_bin}</td>
                      <td className="p-1.5 font-bold text-forest-status">{v.veg_bin}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
