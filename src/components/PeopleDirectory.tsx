import { useEffect, useState } from 'react';
import { BookOpen, Building2, Clock, GraduationCap, KeyRound, Lock, Mail, MapPin, Phone, Power, Search, ShieldCheck, User, UserPlus, Users, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useSession } from '../lib/session';

type Kind = 'Student' | 'Faculty' | 'Warden' | 'Staff';

interface Card {
  ref: string;
  kind: Kind;
  name: string;
  title: string;
  detail: string;
  status: string;
}

interface SearchResponse {
  results: Card[];
  total: number;
  scope: Kind[];
}

interface Contact { id: string; name: string; designation: string; email?: string; office?: string; officeHours?: string; dutyPhone?: string; extension?: string; department?: string }

type Profile = Record<string, unknown> & {
  kind: Kind;
  name: string;
  proctor?: Contact | null;
  wardens?: Contact[];
  courses?: string[];
};

const KIND_STYLE: Record<Kind, string> = {
  Student: 'bg-navy-accent/10 text-navy-accent border-navy-accent/30',
  Faculty: 'bg-[#5B3A82]/10 text-[#5B3A82] border-[#5B3A82]/30',
  Warden: 'bg-forest-status/10 text-forest-status border-forest-status/30',
  Staff: 'bg-amber-50 text-amber-800 border-amber-700/30',
};

const TITLES: Record<string, { title: string; hint: string }> = {
  Student: { title: 'Faculty & Warden Search', hint: 'Find a faculty member or warden by name, employee ID (e.g. FAC1003) or department.' },
  Faculty: { title: 'Student & Faculty Search', hint: 'Find a student by name or registration number, or a colleague by name or employee ID.' },
  HostelAdmin: { title: 'Student & Staff Search', hint: 'Find a resident by name or registration number (e.g. 24BML0027), or a warden or staff member by employee ID.' },
  MessManager: { title: 'Student & Staff Search', hint: 'Find a resident by name or registration number to check their room and meal plan.' },
  CampusAdmin: { title: 'People Search', hint: 'Search every student, faculty member, warden and staff member by name or ID.' },
};

const initials = (name: string) => name.replace(/^(Dr|Mr|Ms|Mrs)\.\s*/, '').split(' ').map(w => w[0]).slice(0, 2).join('');
const str = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v));

function Row({ icon: Icon, label, value }: { icon?: typeof Mail; label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2">
      <span className="text-slate-gray flex items-center gap-1.5 shrink-0">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</span>
      <span className="text-charcoal text-right break-words">{str(value)}</span>
    </div>
  );
}

function ContactCard({ person, role }: { person: Contact; role: string }) {
  return (
    <div className="border border-charcoal/10 bg-warm-ivory/50 p-3 space-y-0.5">
      <div className="font-semibold text-charcoal">{person.name} <span className="font-mono text-xs text-slate-gray">{person.id}</span></div>
      <div className="text-xs text-slate-gray">{role ? `${role} · ` : ''}{person.designation}</div>
      {person.email && <div className="text-xs text-charcoal flex items-center gap-1"><Mail className="w-3 h-3" />{person.email}</div>}
      {person.dutyPhone && <div className="text-xs text-charcoal flex items-center gap-1"><Phone className="w-3 h-3" />Duty phone {person.dutyPhone}</div>}
      {person.office && <div className="text-xs text-charcoal flex items-center gap-1"><MapPin className="w-3 h-3" />{person.office}</div>}
      {person.officeHours && <div className="text-xs text-charcoal flex items-center gap-1"><Clock className="w-3 h-3" />{person.officeHours}</div>}
    </div>
  );
}

const inputCls = 'w-full border border-charcoal/25 bg-surface-white px-3 py-2 font-mono text-sm text-charcoal focus:outline-none focus:border-navy-accent';
const EMPTY_PERSON = { kind: 'Faculty', name: '', gender: 'Male', designation: '', department: '', email: '', school: '', office: '',
  extension: '', officeHours: '', courses: '', block: 'A', floors: '', shift: 'Day', dutyPhone: '', portalRole: '', phone: '' };

function RegisterDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState(EMPTY_PERSON);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ id: string; name: string; pin: string | null; emailed: boolean } | null>(null);
  const set = (k: keyof typeof EMPTY_PERSON) => (e: { target: { value: string } }) => setV(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const body: Record<string, unknown> = { kind: v.kind, name: v.name.trim(), gender: v.gender, designation: v.designation.trim(),
      department: v.department.trim(), email: v.email.trim() };
    for (const k of ['office', 'extension', 'phone'] as const) if (v[k].trim()) body[k] = v[k].trim();
    if (v.kind === 'Faculty') Object.assign(body, { school: v.school.trim() || undefined, officeHours: v.officeHours.trim() || undefined,
      courses: v.courses.split(',').map(c => c.trim()).filter(Boolean) });
    if (v.kind === 'Warden') Object.assign(body, { block: v.block, floors: v.floors.trim() || undefined, shift: v.shift, dutyPhone: v.dutyPhone.trim() || undefined });
    if (v.kind === 'Staff') Object.assign(body, { shift: v.shift, portalRole: v.portalRole || undefined });
    try {
      const res = await api.post<{ person: { id: string; name: string }; pin: string | null; emailed: boolean }>('/api/people', body);
      setIssued({ id: res.person.id, name: res.person.name, pin: res.pin, emailed: res.emailed });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <label className="block space-y-1"><span className="block font-mono text-xs uppercase tracking-wider text-slate-gray">{label}</span>{node}</label>
  );

  return (
    <div className="fixed inset-0 bg-charcoal/70 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Register staff member">
      <div className="bg-surface-white border border-charcoal/20 w-full max-w-3xl shadow-xl my-8">
        <div className="flex items-center justify-between border-b border-charcoal/10 px-6 py-4 bg-warm-ivory">
          <h3 className="font-serif text-xl font-bold text-navy-accent flex items-center gap-2"><UserPlus className="w-5 h-5" /> Register Staff Member</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-gray hover:text-charcoal p-1"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {issued ? (
            <div className="space-y-4 font-mono text-sm">
              <div className="border border-forest-status/30 bg-forest-status/5 p-5 space-y-2">
                <div className="font-bold text-forest-status">{issued.name} is registered as {issued.id}</div>
                {issued.pin ? (
                  <div>One-time sign-in PIN: <code className="text-xl font-bold tracking-[0.2em] bg-surface-white border border-charcoal/20 px-3 py-1">{issued.pin}</code></div>
                ) : <div className="text-slate-gray">No portal access for this post, so no PIN was issued.</div>}
                <p className="text-xs text-slate-gray">{issued.emailed ? 'The ID and PIN were e-mailed to them. ' : ''}The PIN is shown only once and stored only as a hash.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setIssued(null); setV(EMPTY_PERSON); }} className="border border-charcoal/20 px-4 py-2 text-xs uppercase tracking-wider">Register Another</button>
                <button type="button" onClick={onClose} className="bg-navy-accent text-white px-4 py-2 text-xs uppercase tracking-wider">Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {field('Type', <select className={inputCls} value={v.kind} onChange={set('kind')}><option>Faculty</option><option>Warden</option><option>Staff</option></select>)}
                {field('Full name *', <input className={inputCls} required value={v.name} onChange={set('name')} placeholder="Dr. Asha Verma" />)}
                {field('Gender', <select className={inputCls} value={v.gender} onChange={set('gender')}><option>Male</option><option>Female</option><option>Other</option></select>)}
                {field('Designation *', <input className={inputCls} required value={v.designation} onChange={set('designation')} placeholder={v.kind === 'Warden' ? 'Floor Warden' : v.kind === 'Faculty' ? 'Assistant Professor' : 'Electrician'} />)}
                {field('Department *', <input className={inputCls} required value={v.department} onChange={set('department')} placeholder={v.kind === 'Warden' ? 'Hostel Administration' : v.kind === 'Faculty' ? 'Computer Science & Engineering' : 'Maintenance'} />)}
                {field('Official e-mail *', <input className={inputCls} type="email" required value={v.email} onChange={set('email')} placeholder="name.surname@demeure.ac.in" />)}
                {field('Office', <input className={inputCls} value={v.office} onChange={set('office')} placeholder="Tech Tower 412" />)}
                {field('Extension', <input className={inputCls} value={v.extension} onChange={set('extension')} placeholder="2150" />)}
                {v.kind === 'Faculty' && field('School', <input className={inputCls} value={v.school} onChange={set('school')} placeholder="SCOPE" />)}
                {v.kind === 'Faculty' && field('Office hours', <input className={inputCls} value={v.officeHours} onChange={set('officeHours')} placeholder="Mon & Wed 2-4 PM" />)}
                {v.kind === 'Faculty' && <div className="md:col-span-2">{field('Courses (comma-separated)', <input className={inputCls} value={v.courses} onChange={set('courses')} placeholder="CSE3001 Operating Systems, CSE2001 Data Structures" />)}</div>}
                {v.kind === 'Warden' && field('Block *', <select className={inputCls} value={v.block} onChange={set('block')}><option value="A">Block A (Men)</option><option value="B">Block B (Women)</option><option value="C">Block C (PG)</option></select>)}
                {v.kind === 'Warden' && field('Floors', <input className={inputCls} value={v.floors} onChange={set('floors')} placeholder="1-2" />)}
                {v.kind === 'Warden' && field('Duty phone', <input className={inputCls} value={v.dutyPhone} onChange={set('dutyPhone')} placeholder="+91 416 220 3111" />)}
                {v.kind !== 'Faculty' && field('Shift', <select className={inputCls} value={v.shift} onChange={set('shift')}><option>Day</option><option>Night</option><option>General</option><option>Morning</option><option>Evening</option></select>)}
                {v.kind === 'Staff' && field('Portal access', <select className={inputCls} value={v.portalRole} onChange={set('portalRole')}><option value="">None</option><option value="CampusAdmin">Campus administration</option><option value="MessManager">Mess management</option></select>)}
                {field('Personal mobile (encrypted)', <input className={inputCls} value={v.phone} onChange={set('phone')} placeholder="+91 98765 43210" />)}
              </div>
              <p className="font-mono text-xs text-slate-gray">The next free ID is assigned automatically (FAC…, WDN… or STF…). Faculty and wardens always get portal access; a 6-digit PIN is generated and e-mailed.</p>
              {error && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3 font-mono text-sm">{error}</div>}
              <div className="flex justify-end gap-3 border-t border-charcoal/10 pt-4">
                <button type="button" onClick={onClose} className="border border-charcoal/20 px-4 py-2 font-mono text-xs uppercase tracking-wider">Cancel</button>
                <button type="submit" disabled={busy} className="bg-navy-accent text-white px-5 py-2 font-mono text-xs uppercase tracking-wider disabled:opacity-60">{busy ? 'Registering…' : 'Register'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PeopleDirectory({ initialQuery = '' }: { initialQuery?: string }) {
  const user = useSession();
  const role = user?.role ?? 'Student';
  const copy = TITLES[role] ?? TITLES.CampusAdmin;
  const [query, setQuery] = useState(initialQuery);
  const [kind, setKind] = useState<Kind | ''>('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [loadingRef, setLoadingRef] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState('');
  const isAdmin = role === 'CampusAdmin';

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), ...(kind ? { kind } : {}) });
      api.get<SearchResponse>(`/api/people/search?${params}`).then(
        res => { if (active) { setData(res); setFetchedFor(`${query.trim()}|${kind}`); setError(''); } },
        err => { if (active) setError(errorMessage(err)); },
      );
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, kind, refresh]);

  const open = async (card: Card) => {
    setLoadingRef(card.ref);
    setError('');
    try {
      setSelected(await api.get<Profile>(`/api/people/${encodeURIComponent(card.ref)}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingRef('');
    }
  };

  const adminAction = async (action: 'reset' | 'toggle') => {
    if (!selected?.id) return;
    const id = String(selected.id);
    setError(''); setNotice('');
    try {
      if (action === 'reset') {
        if (!window.confirm(`Issue a new PIN for ${selected.name}? The old PIN stops working immediately.`)) return;
        const res = await api.post<{ pin: string }>(`/api/people/${id}/reset-pin`);
        setNotice(`New PIN for ${id}: ${res.pin} (shown once; also e-mailed)`);
      } else {
        const next = selected.status === 'Inactive' ? 'Active' : 'Inactive';
        await api.patch(`/api/people/${id}`, { status: next });
        setSelected({ ...selected, status: next });
        setRefresh(n => n + 1);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const scope = data?.scope ?? [];
  const stale = fetchedFor !== `${query.trim()}|${kind}`;
  const p = selected;
  const hasPersonal = p && ['phone', 'dateOfBirth', 'homeAddress', 'emergencyContact', 'guardianPhone'].some(k => p[k]);

  return (
    <div className="space-y-6">
      <div className="border-b border-charcoal/10 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Directory</span>
          <h2 className="font-serif text-3xl font-bold text-navy-accent">{copy.title}</h2>
          <p className="font-mono text-sm text-slate-gray mt-1">{copy.hint}</p>
        </div>
        {isAdmin && (
          <button type="button" onClick={() => setShowRegister(true)}
            className="flex items-center gap-2 bg-navy-accent hover:bg-charcoal text-surface-white px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider">
            <UserPlus className="w-4 h-4" /> Register Staff Member
          </button>
        )}
      </div>
      {notice && <div role="status" className="border border-forest-status/30 bg-forest-status/5 text-forest-status p-3 font-mono text-sm font-bold">{notice}</div>}

      <div className="flex flex-col md:flex-row gap-3">
        <label className="flex-1 flex items-center gap-2 border border-charcoal/25 bg-surface-white px-3 py-2.5 font-mono text-sm focus-within:border-navy-accent">
          <Search className="w-5 h-5 text-slate-gray" />
          <input
            autoFocus
            aria-label="Search people by name or ID"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name or ID, e.g. Kulkarni, FAC1003, WDN101, 24BML0027"
            className="bg-transparent outline-none w-full text-charcoal"
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by type">
          {(['', ...scope] as (Kind | '')[]).map(k => (
            <button key={k || 'all'} type="button" onClick={() => setKind(k)}
              className={`px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wider border ${kind === k ? 'bg-navy-accent text-surface-white border-navy-accent' : 'bg-surface-white text-charcoal border-charcoal/20 hover:bg-charcoal/5'}`}>
              {k ? ({ Student: 'Students', Faculty: 'Faculty', Warden: 'Wardens', Staff: 'Staff' } as Record<Kind, string>)[k] : 'All'}
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3 font-mono text-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-6 border border-charcoal/10 bg-surface-white">
          <div className="px-4 py-2 border-b border-charcoal/10 font-mono text-xs uppercase tracking-wider text-slate-gray">
            {!data || stale ? 'Searching…' : `${data.total} match${data.total === 1 ? '' : 'es'}${data.total > data.results.length ? ` · showing ${data.results.length}` : ''}`}
          </div>
          <ul className={`max-h-[620px] overflow-auto divide-y divide-charcoal/10 ${stale ? 'opacity-50' : ''}`} aria-busy={stale}>
            {data?.results.map(card => (
              <li key={`${card.kind}-${card.ref}`}>
                <button type="button" onClick={() => open(card)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-navy-accent/5 ${selected && selected.name === card.name ? 'bg-navy-accent/10' : ''}`}>
                  <span className={`w-10 h-10 shrink-0 border flex items-center justify-center font-bold text-sm ${KIND_STYLE[card.kind]}`}>{initials(card.name)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-charcoal truncate">{loadingRef === card.ref ? 'Loading…' : card.name}</span>
                    <span className="block font-mono text-xs text-slate-gray truncate">{card.title} · {card.detail}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-mono text-sm font-bold text-navy-accent">{card.ref}</span>
                    <span className={`inline-block mt-0.5 border px-1.5 text-xs font-mono font-bold ${KIND_STYLE[card.kind]}`}>{card.kind.toUpperCase()}</span>
                    {card.status !== 'Active' && <span className="block text-xs font-bold text-red-800">INACTIVE</span>}
                  </span>
                </button>
              </li>
            ))}
            {data && !stale && data.results.length === 0 && <li className="p-6 text-center font-mono text-sm text-slate-gray">No one matches “{query}”.</li>}
          </ul>
        </div>

        <div className="xl:col-span-6 border border-charcoal/10 bg-surface-white p-5 space-y-4 font-mono text-sm">
          {!p ? (
            <div className="text-slate-gray flex items-center gap-2"><User className="w-5 h-5" /> Select someone to see their details.</div>
          ) : (
            <>
              <div className="flex items-start gap-4 border-b border-charcoal/10 pb-4">
                <span className={`w-14 h-14 shrink-0 border flex items-center justify-center font-bold text-lg ${KIND_STYLE[p.kind]}`}>{initials(p.name)}</span>
                <div className="min-w-0">
                  <div className="font-serif text-xl font-bold text-charcoal">{p.name}</div>
                  <div className="text-navy-accent font-bold">{str(p.regNo ?? p.id)}</div>
                  <div className="text-slate-gray">
                    {p.kind === 'Student' ? `${str(p.course)} ${str(p.branch)} · ${str(p.yearOfStudy)}` : `${str(p.designation)} · ${str(p.department)}`}
                  </div>
                </div>
              </div>

              {isAdmin && p.kind !== 'Student' && (
                <div className="flex flex-wrap gap-2">
                  {Boolean(p.portalRole) && (
                    <button type="button" onClick={() => adminAction('reset')} className="flex items-center gap-1.5 border border-charcoal/25 px-3 py-1.5 text-xs uppercase tracking-wider hover:bg-charcoal/5">
                      <KeyRound className="w-4 h-4" /> Reset PIN
                    </button>
                  )}
                  <button type="button" onClick={() => adminAction('toggle')}
                    className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs uppercase tracking-wider ${p.status === 'Inactive' ? 'border-forest-status/50 text-forest-status' : 'border-red-700/40 text-red-800'}`}>
                    <Power className="w-4 h-4" /> {p.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}
                  </button>
                  {p.status === 'Inactive' && <span className="text-xs font-bold text-red-800 self-center">INACTIVE: cannot sign in</span>}
                </div>
              )}

              {p.kind === 'Student' && (
                <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                  <Row icon={Building2} label="Room" value={p.room ? `${p.room} (Block ${str(p.block)})` : undefined} />
                  {p.email !== undefined && <Row icon={Mail} label="E-mail" value={p.email} />}
                  {p.dietaryPref !== undefined && <Row label="Meal plan" value={p.dietaryPref} />}
                  {p.status !== undefined && <Row label="Status" value={p.status} />}
                </div>
              )}
              {p.kind === 'Faculty' && (
                <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                  <Row icon={GraduationCap} label="School" value={p.school} />
                  <Row icon={MapPin} label="Office" value={p.office} />
                  <Row icon={Clock} label="Office hours" value={p.officeHours} />
                  <Row icon={Phone} label="Extension" value={p.extension} />
                  <Row icon={Mail} label="E-mail" value={p.email} />
                  <Row icon={Users} label="Proctees" value={p.proctees} />
                </div>
              )}
              {p.kind === 'Warden' && (
                <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                  <Row icon={Building2} label="Block" value={`Block ${str(p.block)} · Floors ${str(p.floors)}`} />
                  <Row icon={Clock} label="Shift" value={p.shift} />
                  <Row icon={MapPin} label="Office" value={p.office} />
                  <Row icon={Phone} label="Duty phone" value={p.dutyPhone} />
                  <Row icon={Mail} label="E-mail" value={p.email} />
                  <Row icon={Users} label="Residents in block" value={p.residents} />
                </div>
              )}
              {p.kind === 'Staff' && (
                <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                  <Row icon={Building2} label="Department" value={p.department} />
                  <Row icon={Clock} label="Shift" value={p.shift} />
                  <Row icon={MapPin} label="Office" value={p.office} />
                  <Row icon={Phone} label="Extension" value={p.extension} />
                  <Row icon={Mail} label="E-mail" value={p.email} />
                </div>
              )}

              {p.courses && p.courses.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-gray flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> Courses this semester</div>
                  <div className="flex flex-wrap gap-1">{p.courses.map(c => <span key={c} className="border border-charcoal/15 px-2 py-0.5 text-xs">{c}</span>)}</div>
                </div>
              )}

              {hasPersonal && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-gray flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Personal details (decrypted, access logged)</div>
                  <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                    {p.phone !== undefined && <Row label="Mobile" value={p.phone} />}
                    {p.dateOfBirth !== undefined && <Row label="Date of birth" value={p.dateOfBirth} />}
                    {p.bloodGroup !== undefined && <Row label="Blood group" value={p.bloodGroup} />}
                    {p.guardianName !== undefined && <Row label="Guardian" value={`${str(p.guardianName)}${p.guardianRelation ? ` (${p.guardianRelation})` : ''}`} />}
                    {p.guardianPhone !== undefined && <Row label="Guardian mobile" value={p.guardianPhone} />}
                    {p.homeAddress !== undefined && <Row label="Address" value={p.homeAddress} />}
                    {p.emergencyContact !== undefined && <Row label="Emergency contact" value={p.emergencyContact} />}
                  </div>
                </div>
              )}

              {p.kind === 'Student' && (p.proctor || (p.wardens && p.wardens.length > 0)) && (
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-wider text-slate-gray flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Responsible staff</div>
                  {p.proctor && <ContactCard person={p.proctor} role="Proctor" />}
                  {p.wardens?.map(w => <ContactCard key={w.id} person={w} role="Warden" />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showRegister && <RegisterDialog onClose={() => setShowRegister(false)} onDone={() => setRefresh(n => n + 1)} />}
    </div>
  );
}
