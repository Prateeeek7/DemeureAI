import { useState } from 'react';
import { CheckCircle, Copy, Download, FileSpreadsheet, KeyRound, UserPlus, X } from 'lucide-react';
import ThemedSelect from './ThemedSelect';
import { api, errorMessage } from '../lib/api';

// ── Shared types ─────────────────────────────────────────────────────────────
export interface CreatedResident {
  student: { id: string; name: string; email: string; regNo: string; room: string; block: string };
  accessCode: string;
  emailed: boolean;
}

interface ImportResult {
  created: number;
  failed: number;
  results: ({ row: number; status: 'created' } & CreatedResident | { row: number; status: 'error'; label: string; error: string })[];
}

type FormValues = Record<string, string>;

// ── Field definitions (shared by Add, Edit and the import column mapping) ─────
const GENDER = [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }];
const DIET = ['Vegetarian', 'Non-Vegetarian', 'Jain', 'Vegan'].map(v => ({ value: v, label: v }));
const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'].map(v => ({ value: v, label: v }));
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ value: v, label: v }));
const BLOCKS = [
  { value: '', label: 'Automatic (by gender)' },
  { value: 'A', label: 'Block A (Men)' },
  { value: 'B', label: 'Block B (Women)' },
  { value: 'C', label: 'Block C (PG / Mixed)' },
];
const ROOM_TYPES = [{ value: '', label: 'Any room type' }, { value: 'Single', label: 'Single' }, { value: 'Double', label: 'Double' }, { value: 'Suite', label: 'Suite (4 beds)' }];
const FLOORS = ['1', '2', '3', '4', '5'].map(v => ({ value: v, label: `Floor ${v}` }));

/** Spreadsheet header spellings accepted for each field (compared lower-case, letters and digits only). */
const COLUMN_ALIASES: Record<string, string[]> = {
  regNo: ['regno', 'registrationnumber', 'registernumber', 'rollnumber', 'rollno', 'registrationno'],
  name: ['name', 'fullname', 'studentname'],
  email: ['email', 'emailid', 'emailaddress', 'institutionalemail'],
  gender: ['gender', 'sex'],
  course: ['course', 'programme', 'program', 'degree'],
  branch: ['branch', 'department', 'dept', 'specialisation', 'specialization'],
  yearOfStudy: ['year', 'yearofstudy', 'studyyear'],
  dietaryPref: ['diet', 'dietarypref', 'dietarypreference', 'mealplan'],
  block: ['block', 'hostelblock', 'preferredblock'],
  roomId: ['room', 'roomid', 'roomno', 'roomnumber'],
  preferredFloor: ['floor', 'preferredfloor'],
  roomType: ['roomtype', 'roomtypepref', 'roomtypepreference'],
  phone: ['phone', 'mobile', 'mobilenumber', 'phonenumber', 'contact', 'contactnumber'],
  dateOfBirth: ['dob', 'dateofbirth', 'birthdate'],
  bloodGroup: ['bloodgroup', 'blood'],
  guardianName: ['guardian', 'guardianname', 'parentname', 'fathername', 'mothername'],
  guardianRelation: ['relation', 'guardianrelation', 'relationship'],
  guardianPhone: ['guardianphone', 'guardianmobile', 'parentphone', 'parentmobile'],
  guardianEmail: ['guardianemail', 'parentemail'],
  homeAddress: ['address', 'homeaddress', 'permanentaddress'],
  medicalNotes: ['medical', 'medicalnotes', 'specialneeds', 'allergies', 'healthnotes'],
};
const REQUIRED = ['regNo', 'name', 'email', 'gender', 'course', 'branch', 'yearOfStudy'];
const TEMPLATE_HEADERS = ['regNo', 'name', 'email', 'gender', 'course', 'branch', 'yearOfStudy', 'dietaryPref', 'block',
  'preferredFloor', 'roomType', 'phone', 'dateOfBirth', 'bloodGroup', 'guardianName', 'guardianRelation', 'guardianPhone',
  'guardianEmail', 'homeAddress', 'medicalNotes'];
const TEMPLATE_ROWS = [
  ['25BCE0101', 'Ananya Sharma', 'ananya.sharma2025@vitstudent.ac.in', 'Female', 'B.Tech', 'CSE', 'Year 1', 'Vegetarian', 'B', '2', 'Double',
    '9876543210', '2007-05-14', 'B+', 'Rakesh Sharma', 'Father', '9812345678', 'rakesh.sharma@example.com', '12 Park Street, Pune, Maharashtra 411001', ''],
  ['25BEC0102', 'Rohan Iyer', 'rohan.iyer2025@vitstudent.ac.in', 'Male', 'B.Tech', 'ECE', 'Year 1', 'Non-Vegetarian', '', '3', 'Single',
    '9123456789', '2006-11-02', 'O+', 'Lakshmi Iyer', 'Mother', '9988776655', 'lakshmi.iyer@example.com', '4 Anna Salai, Chennai, Tamil Nadu 600002', 'Allergic to dust'],
];

const normaliseHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_LOOKUP = Object.fromEntries(Object.entries(COLUMN_ALIASES).flatMap(([field, aliases]) =>
  [...aliases, normaliseHeader(field)].map(a => [a, field])));

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

const downloadCredentials = (created: CreatedResident[]) => downloadCsv(
  `demeure-access-codes-${new Date().toISOString().slice(0, 10)}.csv`,
  [['Name', 'Registration No', 'E-mail', 'Room', 'Access Code'],
    ...created.map(c => [c.student.name, c.student.regNo, c.student.email, c.student.room, c.accessCode])],
);

// ── Building blocks ──────────────────────────────────────────────────────────
function Dialog({ title, icon: Icon, onClose, children, wide = false }: {
  title: string; icon: typeof UserPlus; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-charcoal/70 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`bg-surface-white border border-charcoal/20 w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} shadow-xl my-8`}>
        <div className="flex items-center justify-between border-b border-charcoal/10 px-6 py-4 bg-warm-ivory">
          <h3 className="font-serif text-xl font-bold text-navy-accent flex items-center gap-2"><Icon className="w-5 h-5" /> {title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-gray hover:text-charcoal p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="block font-mono text-xs uppercase tracking-wider text-slate-gray">{label}{required && <span className="text-red-700"> *</span>}</span>
      {children}
      {hint && <span className="block font-mono text-xs text-slate-gray">{hint}</span>}
    </label>
  );
}

const inputClass = 'w-full border border-charcoal/25 bg-surface-white px-3 py-2 font-mono text-sm text-charcoal focus:outline-none focus:border-navy-accent';

function TextInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <input {...rest} value={value} onChange={e => onChange(e.target.value)} className={inputClass} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-serif text-base font-bold text-charcoal border-b border-charcoal/10 pb-1 w-full mb-2">{title}</legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

export function IssuedCode({ result }: { result: CreatedResident }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-forest-status/30 bg-forest-status/5 p-5 space-y-3 font-mono text-sm">
      <div className="flex items-center gap-2 text-forest-status font-bold"><CheckCircle className="w-5 h-5" /> {result.student.name} is registered in room {result.student.room}</div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-gray">One-time access code:</span>
        <code className="text-xl font-bold tracking-[0.2em] bg-surface-white border border-charcoal/20 px-3 py-1 text-charcoal">{result.accessCode}</code>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(result.accessCode); setCopied(true); }}
          className="flex items-center gap-1 border border-charcoal/20 px-2 py-1 text-xs uppercase tracking-wider hover:bg-charcoal/5">
          <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-slate-gray text-xs">
        {result.emailed ? `Sent to ${result.student.email}. ` : 'E-mail was not sent. '}
        This code is shown only once and is stored only as a hash. Use “Reset access code” if it is lost.
      </p>
    </div>
  );
}

// ── Resident form (add and edit) ─────────────────────────────────────────────
const EMPTY: FormValues = {
  regNo: '', name: '', email: '', gender: '', course: 'B.Tech', branch: '', yearOfStudy: 'Year 1', dietaryPref: 'Vegetarian',
  block: '', preferredFloor: '1', roomType: '', roomId: '', phone: '', dateOfBirth: '', bloodGroup: '', guardianName: '',
  guardianRelation: '', guardianPhone: '', guardianEmail: '', homeAddress: '', medicalNotes: '',
};

function ResidentForm({ values, set, mode }: { values: FormValues; set: (k: string, v: string) => void; mode: 'add' | 'edit' }) {
  const v = values;
  return (
    <div className="space-y-6">
      <Section title="Identity & Programme">
        {mode === 'add' && <Field label="Registration No" required><TextInput value={v.regNo} onChange={x => set('regNo', x.toUpperCase())} placeholder="25BCE0101" required /></Field>}
        <Field label="Full Name" required><TextInput value={v.name} onChange={x => set('name', x)} placeholder="Ananya Sharma" required /></Field>
        {mode === 'add' && <Field label="Institutional E-mail" required hint="Used to sign in; the access code is sent here."><TextInput type="email" value={v.email} onChange={x => set('email', x)} placeholder="name@vitstudent.ac.in" required /></Field>}
        {mode === 'add' && <Field label="Gender" required><ThemedSelect value={v.gender} onChange={x => set('gender', x)} options={GENDER} placeholder="Select gender" /></Field>}
        <Field label="Course" required><TextInput value={v.course} onChange={x => set('course', x)} placeholder="B.Tech" required /></Field>
        <Field label="Branch / Department" required><TextInput value={v.branch} onChange={x => set('branch', x)} placeholder="CSE" required /></Field>
        <Field label="Year of Study" required><ThemedSelect value={v.yearOfStudy} onChange={x => set('yearOfStudy', x)} options={YEARS} /></Field>
        <Field label="Meal Plan"><ThemedSelect value={v.dietaryPref} onChange={x => set('dietaryPref', x)} options={DIET} /></Field>
      </Section>

      <Section title="Accommodation">
        {mode === 'add' ? (
          <>
            <Field label="Hostel Block" hint="Block A is for men, Block B for women, Block C (PG) is mixed."><ThemedSelect value={v.block} onChange={x => set('block', x)} options={BLOCKS} /></Field>
            <Field label="Preferred Floor"><ThemedSelect value={v.preferredFloor} onChange={x => set('preferredFloor', x)} options={FLOORS} /></Field>
            <Field label="Room Type"><ThemedSelect value={v.roomType} onChange={x => set('roomType', x)} options={ROOM_TYPES} /></Field>
            <Field label="Specific Room (optional)" hint="e.g. B-204. Leave blank to assign the first free bed."><TextInput value={v.roomId} onChange={x => set('roomId', x.toUpperCase())} placeholder="B-204" /></Field>
          </>
        ) : (
          <Field label="Move to Room" hint="Leave as is to keep the current room."><TextInput value={v.roomId} onChange={x => set('roomId', x.toUpperCase())} placeholder="B-204" /></Field>
        )}
      </Section>

      <Section title="Contact, Guardian & Health (stored encrypted)">
        <Field label="Mobile"><TextInput type="tel" value={v.phone} onChange={x => set('phone', x)} placeholder="98765 43210" /></Field>
        <Field label="Date of Birth"><TextInput type="date" value={v.dateOfBirth} onChange={x => set('dateOfBirth', x)} /></Field>
        <Field label="Blood Group"><ThemedSelect value={v.bloodGroup} onChange={x => set('bloodGroup', x)} options={BLOOD} placeholder="Select blood group" /></Field>
        <Field label="Guardian Name"><TextInput value={v.guardianName} onChange={x => set('guardianName', x)} placeholder="Rakesh Sharma" /></Field>
        <Field label="Relation"><TextInput value={v.guardianRelation} onChange={x => set('guardianRelation', x)} placeholder="Father" /></Field>
        <Field label="Guardian Mobile"><TextInput type="tel" value={v.guardianPhone} onChange={x => set('guardianPhone', x)} placeholder="98123 45678" /></Field>
        <Field label="Guardian E-mail" hint="Receives leave notifications."><TextInput type="email" value={v.guardianEmail} onChange={x => set('guardianEmail', x)} placeholder="parent@example.com" /></Field>
        <Field label="Medical Notes"><TextInput value={v.medicalNotes} onChange={x => set('medicalNotes', x)} placeholder="Allergies, conditions, needs" /></Field>
        <div className="md:col-span-2"><Field label="Home Address"><TextInput value={v.homeAddress} onChange={x => set('homeAddress', x)} placeholder="House no., street, city, state, PIN" /></Field></div>
      </Section>
    </div>
  );
}

function compact(values: FormValues) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, k === 'preferredFloor' ? Number(v) : v.trim()]));
}

export function AddResidentDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (r: CreatedResident) => void }) {
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CreatedResident | null>(null);
  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = REQUIRED.filter(k => !values[k].trim());
    if (missing.length) { setError(`Fill in: ${missing.join(', ')}`); return; }
    setBusy(true); setError('');
    try {
      const created = await api.post<CreatedResident>('/api/students', compact(values));
      setResult(created);
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Add Resident" icon={UserPlus} onClose={onClose}>
      {result ? (
        <div className="space-y-5">
          <IssuedCode result={result} />
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => { setResult(null); setValues(EMPTY); }} className="border border-charcoal/20 px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal/5">Add Another</button>
            <button type="button" onClick={onClose} className="bg-navy-accent text-surface-white px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal">Done</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <ResidentForm values={values} set={set} mode="add" />
          {error && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3 font-mono text-sm">{error}</div>}
          <div className="flex gap-3 justify-end border-t border-charcoal/10 pt-4">
            <button type="button" onClick={onClose} className="border border-charcoal/20 px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal/5">Cancel</button>
            <button type="submit" disabled={busy} className="bg-navy-accent text-surface-white px-5 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal disabled:opacity-60">
              {busy ? 'Encrypting & saving…' : 'Register Resident'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

const EDITABLE = ['name', 'course', 'branch', 'yearOfStudy', 'dietaryPref', 'roomId', 'phone', 'dateOfBirth', 'bloodGroup',
  'guardianName', 'guardianRelation', 'guardianPhone', 'guardianEmail', 'homeAddress', 'medicalNotes'];

export function EditResidentDialog({ profile, onClose, onSaved }: {
  profile: Record<string, unknown>; onClose: () => void; onSaved: (p: Record<string, unknown>) => void;
}) {
  const initial: FormValues = Object.fromEntries(EDITABLE.map(k => [k, String(profile[k === 'roomId' ? 'room' : k] ?? '')]));
  const [values, setValues] = useState<FormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setValues(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const changes = Object.fromEntries(EDITABLE.filter(k => values[k] !== initial[k]).map(k => [k, values[k].trim()]));
    if (!Object.keys(changes).length) { onClose(); return; }
    setBusy(true); setError('');
    try {
      onSaved(await api.patch<Record<string, unknown>>(`/api/students/${encodeURIComponent(String(profile.id))}`, changes));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Edit ${String(profile.name)}`} icon={UserPlus} onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        <ResidentForm values={values} set={set} mode="edit" />
        {error && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3 font-mono text-sm">{error}</div>}
        <div className="flex gap-3 justify-end border-t border-charcoal/10 pt-4">
          <button type="button" onClick={onClose} className="border border-charcoal/20 px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal/5">Cancel</button>
          <button type="submit" disabled={busy} className="bg-navy-accent text-surface-white px-5 py-2 font-mono text-xs uppercase tracking-wider hover:bg-charcoal disabled:opacity-60">
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Spreadsheet import ───────────────────────────────────────────────────────
export function ImportResidentsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [sendEmails, setSendEmails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const missingColumns = rows.length ? REQUIRED.filter(f => !(f in rows[0])) : [];
  const incomplete = rows.filter(r => REQUIRED.some(f => !String(r[f] ?? '').trim())).length;

  const readFile = async (file: File) => {
    setError(''); setResult(null); setRows([]); setUnmapped([]);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const book = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheet = book.Sheets[book.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
      if (!raw.length) { setError('The first sheet has no data rows.'); return; }
      const headers = Object.keys(raw[0]);
      setUnmapped(headers.filter(h => !HEADER_LOOKUP[normaliseHeader(h)]));
      setRows(raw.map(r => Object.fromEntries(headers.filter(h => HEADER_LOOKUP[normaliseHeader(h)]).map(h => {
        const value = r[h];
        const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').trim();
        return [HEADER_LOOKUP[normaliseHeader(h)], text];
      }))));
    } catch (err) {
      setError(`Could not read ${file.name}: ${errorMessage(err)}`);
    }
  };

  const runImport = async () => {
    setBusy(true); setError('');
    try {
      const payload = rows.map(r => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '')
        .map(([k, v]) => [k, k === 'preferredFloor' ? Number(v) || 1 : v])));
      const res = await api.post<ImportResult>('/api/students/import', { students: payload, sendEmails });
      setResult(res);
      onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const created = (result?.results ?? []).filter((r): r is { row: number; status: 'created' } & CreatedResident => r.status === 'created');
  const failed = (result?.results ?? []).filter((r): r is { row: number; status: 'error'; label: string; error: string } => r.status === 'error');

  return (
    <Dialog title="Import Residents from CSV / Excel" icon={FileSpreadsheet} onClose={onClose} wide>
      <div className="space-y-5 font-mono text-sm">
        {!result && (
          <>
            <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between border border-charcoal/10 bg-warm-ivory p-4">
              <div className="space-y-1">
                <div className="font-bold text-charcoal">1. Prepare the sheet</div>
                <div className="text-slate-gray text-xs">One resident per row. Required columns: {REQUIRED.join(', ')}. Common header names (e.g. “Roll Number”, “Mobile”, “Parent Email”) are recognised.</div>
              </div>
              <button type="button" onClick={() => downloadCsv('demeure-resident-template.csv', [TEMPLATE_HEADERS, ...TEMPLATE_ROWS])}
                className="flex items-center gap-2 border border-charcoal/25 bg-surface-white px-3 py-2 text-xs uppercase tracking-wider hover:bg-charcoal/5 shrink-0">
                <Download className="w-4 h-4" /> Download Template
              </button>
            </div>

            <label className="block border-2 border-dashed border-navy-accent/30 bg-navy-accent/5 p-6 text-center cursor-pointer hover:bg-navy-accent/10">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-navy-accent" />
              <div className="mt-2 font-bold text-navy-accent">2. {fileName ? `Selected: ${fileName}` : 'Choose a .csv, .xlsx or .xls file'}</div>
              <div className="text-xs text-slate-gray mt-1">The file is read in your browser; only the rows are sent to the server.</div>
              <input type="file" accept=".csv,.xlsx,.xls" aria-label="Resident spreadsheet" className="sr-only"
                onChange={e => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ''; }} />
            </label>

            {rows.length > 0 && (
              <div className="space-y-3">
                <div className="font-bold text-charcoal">3. Check and import</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="border border-charcoal/20 px-2 py-1">{rows.length} rows</span>
                  <span className={`border px-2 py-1 ${incomplete ? 'border-amber-700/40 text-amber-800' : 'border-forest-status/40 text-forest-status'}`}>{incomplete} missing required values</span>
                  {missingColumns.length > 0 && <span className="border border-red-700/40 text-red-800 px-2 py-1">Missing columns: {missingColumns.join(', ')}</span>}
                  {unmapped.length > 0 && <span className="border border-charcoal/20 text-slate-gray px-2 py-1">Ignored columns: {unmapped.join(', ')}</span>}
                </div>
                <div className="max-h-64 overflow-auto border border-charcoal/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-warm-ivory text-slate-gray uppercase tracking-wider">
                      <tr>{['#', 'Reg No', 'Name', 'E-mail', 'Gender', 'Course', 'Block', 'Mobile'].map(h => <th key={h} className="text-left p-2">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className={`border-t border-charcoal/5 ${REQUIRED.some(f => !r[f]) ? 'bg-amber-50' : ''}`}>
                          <td className="p-2 text-slate-gray">{i + 1}</td>
                          <td className="p-2">{r.regNo}</td><td className="p-2 font-bold">{r.name}</td><td className="p-2">{r.email}</td>
                          <td className="p-2">{r.gender}</td><td className="p-2">{r.course} {r.branch}</td><td className="p-2">{r.block || 'Auto'}</td><td className="p-2">{r.phone}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows.length > 50 && <div className="text-xs text-slate-gray">Showing the first 50 of {rows.length} rows.</div>}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sendEmails} onChange={e => setSendEmails(e.target.checked)} className="w-4 h-4" />
                  E-mail each resident their access code
                </label>
              </div>
            )}

            {error && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3">{error}</div>}

            <div className="flex gap-3 justify-end border-t border-charcoal/10 pt-4">
              <button type="button" onClick={onClose} className="border border-charcoal/20 px-4 py-2 text-xs uppercase tracking-wider hover:bg-charcoal/5">Cancel</button>
              <button type="button" disabled={!rows.length || busy || missingColumns.length > 0} onClick={runImport}
                className="bg-navy-accent text-surface-white px-5 py-2 text-xs uppercase tracking-wider hover:bg-charcoal disabled:opacity-50">
                {busy ? 'Importing…' : `Import ${rows.length || ''} Residents`}
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <span className="border border-forest-status/40 bg-forest-status/5 text-forest-status px-3 py-2 font-bold">{result.created} registered</span>
              <span className={`border px-3 py-2 font-bold ${result.failed ? 'border-red-700/40 bg-red-50 text-red-800' : 'border-charcoal/20 text-slate-gray'}`}>{result.failed} skipped</span>
            </div>
            {created.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-charcoal flex items-center gap-2"><KeyRound className="w-4 h-4" /> Access codes (shown once)</div>
                  <button type="button" onClick={() => downloadCredentials(created)} className="flex items-center gap-2 border border-charcoal/25 px-3 py-2 text-xs uppercase tracking-wider hover:bg-charcoal/5">
                    <Download className="w-4 h-4" /> Download Credentials CSV
                  </button>
                </div>
                <div className="max-h-56 overflow-auto border border-charcoal/10">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-warm-ivory text-slate-gray uppercase tracking-wider"><tr>{['Row', 'Name', 'E-mail', 'Room', 'Access Code'].map(h => <th key={h} className="text-left p-2">{h}</th>)}</tr></thead>
                    <tbody>{created.map(r => (
                      <tr key={r.row} className="border-t border-charcoal/5">
                        <td className="p-2 text-slate-gray">{r.row}</td><td className="p-2 font-bold">{r.student.name}</td><td className="p-2">{r.student.email}</td>
                        <td className="p-2 text-navy-accent font-bold">{r.student.room}</td><td className="p-2 tracking-widest">{r.accessCode}</td>
                      </tr>))}</tbody>
                  </table>
                </div>
              </div>
            )}
            {failed.length > 0 && (
              <div className="space-y-2">
                <div className="font-bold text-red-800">Rows that need fixing</div>
                <ul className="border border-red-700/20 divide-y divide-red-700/10 max-h-48 overflow-auto">
                  {failed.map(r => <li key={r.row} className="p-2 text-xs"><strong>Row {r.row}</strong> ({r.label}): {r.error}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-end border-t border-charcoal/10 pt-4">
              <button type="button" onClick={onClose} className="bg-navy-accent text-surface-white px-5 py-2 text-xs uppercase tracking-wider hover:bg-charcoal">Done</button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
