import { useMemo, useState } from 'react';
import { Database, FileSpreadsheet, KeyRound, Lock, Pencil, Power, Search, ShieldCheck, UserPlus, Users, X } from 'lucide-react';
import ThemedSelect from './ThemedSelect';
import { AddResidentDialog, EditResidentDialog, ImportResidentsDialog, IssuedCode, type CreatedResident } from './StudentOnboarding';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useSession } from '../lib/session';

interface DirectoryRow {
  id: string;
  studentId: string;
  regNo: string;
  name: string;
  email: string;
  gender: string;
  course: string;
  branch: string;
  yearOfStudy: string;
  block: string;
  room: string;
  dietaryPref: string;
  status?: string;
  phoneMasked: string;
  encryptedFields: string[];
  duesPaid: boolean;
}

interface EncryptionInfo {
  algorithm: string;
  keyId: string;
  keySource: string;
  encryptedFields: string[];
  credentialHash: string;
}

interface Directory {
  students: DirectoryRow[];
  cycleId: string;
  encryption: EncryptionInfo;
}

type Profile = Record<string, unknown> & { id: string; name: string };

const PRIVATE_FIELDS: [string, string][] = [
  ['phone', 'Mobile'],
  ['dateOfBirth', 'Date of Birth'],
  ['bloodGroup', 'Blood Group'],
  ['guardianName', 'Guardian'],
  ['guardianRelation', 'Relation'],
  ['guardianPhone', 'Guardian Mobile'],
  ['guardianEmail', 'Guardian E-mail'],
  ['homeAddress', 'Home Address'],
  ['medicalNotes', 'Medical Notes'],
];

const BLOCK_OPTIONS = [
  { value: '', label: 'All Blocks' },
  { value: 'A', label: 'Block A (Men)' },
  { value: 'B', label: 'Block B (Women)' },
  { value: 'C', label: 'Block C (PG / Mixed)' },
];
const DUES_OPTIONS = [
  { value: '', label: 'Any Dues Status' },
  { value: 'paid', label: 'Paid this cycle' },
  { value: 'due', label: 'Outstanding' },
];

const btn = 'flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider';

export default function StudentDirectory() {
  const user = useSession();
  const directoryApi = useApi<Directory>('/api/students');
  const rows = useMemo(() => directoryApi.data?.students ?? [], [directoryApi.data]);
  const enc = directoryApi.data?.encryption;

  const [query, setQuery] = useState('');
  const [block, setBlock] = useState('');
  const [dues, setDues] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [stored, setStored] = useState<Record<string, unknown> | null>(null);
  const [loadingId, setLoadingId] = useState('');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'add' | 'import' | 'edit' | null>(null);
  const [issued, setIssued] = useState<CreatedResident | null>(null);
  const [working, setWorking] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (!block || r.block === block) &&
      (!dues || (dues === 'paid') === r.duesPaid) &&
      (!q || [r.name, r.regNo, r.email, r.room, r.branch].some(v => v.toLowerCase().includes(q))));
  }, [rows, query, block, dues]);

  const stats = useMemo(() => ({
    total: rows.length,
    active: rows.filter(r => (r.status ?? 'Active') === 'Active').length,
    paid: rows.filter(r => r.duesPaid).length,
    byBlock: ['A', 'B', 'C'].map(b => rows.filter(r => r.block === b).length),
  }), [rows]);

  const openProfile = async (id: string) => {
    setError('');
    setStored(null);
    setIssued(null);
    setLoadingId(id);
    try {
      setSelected(await api.get<Profile>(`/api/students/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingId('');
    }
  };

  const showStored = async () => {
    if (!selected) return;
    setError('');
    try {
      setStored(await api.get<Record<string, unknown>>(`/api/students/${encodeURIComponent(selected.id)}/stored`));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const resetCode = async () => {
    if (!selected || !window.confirm(`Issue a new access code for ${selected.name}? The old code stops working immediately.`)) return;
    setWorking(true); setError('');
    try {
      const res = await api.post<{ accessCode: string; emailed: boolean }>(`/api/students/${encodeURIComponent(selected.id)}/reset-code`);
      setIssued({ student: { id: selected.id, name: selected.name, email: String(selected.email), regNo: String(selected.regNo), room: String(selected.room), block: String(selected.block) }, ...res });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === 'Inactive' ? 'Active' : 'Inactive';
    if (next === 'Inactive' && !window.confirm(`Deactivate ${selected.name}? They will no longer be able to sign in.`)) return;
    setWorking(true); setError('');
    try {
      setSelected(await api.patch<Profile>(`/api/students/${encodeURIComponent(selected.id)}`, { status: next }));
      directoryApi.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  const inactive = selected?.status === 'Inactive';

  return (
    <div className="space-y-8">
      <div className="border-b border-charcoal/10 pb-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 14</span>
          <h2 className="font-serif text-3xl font-bold text-navy-accent">Resident Directory & Encrypted Records</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setDialog('import')} className={`${btn} border border-navy-accent/40 text-navy-accent bg-surface-white hover:bg-navy-accent/5`}>
            <FileSpreadsheet className="w-4 h-4" /> Import CSV / Excel
          </button>
          <button type="button" onClick={() => setDialog('add')} className={`${btn} bg-navy-accent text-surface-white hover:bg-charcoal`}>
            <UserPlus className="w-4 h-4" /> Add Resident
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="flex items-center gap-2 text-slate-gray uppercase text-xs tracking-wider"><Users className="w-4 h-4" /> Residents</div>
          <div className="text-3xl font-bold text-charcoal">{directoryApi.loading ? '—' : stats.total}</div>
          <div className="text-xs text-slate-gray">{directoryApi.loading ? '' : `${stats.active} active`}</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="text-slate-gray uppercase text-xs tracking-wider">Block A / B / C</div>
          <div className="text-3xl font-bold text-charcoal">{directoryApi.loading ? '—' : stats.byBlock.join(' / ')}</div>
          <div className="text-xs text-slate-gray">Men / Women / PG mixed</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="text-slate-gray uppercase text-xs tracking-wider">Dues Paid</div>
          <div className="text-3xl font-bold text-forest-status">{directoryApi.loading ? '—' : `${stats.paid} / ${stats.total}`}</div>
          <div className="text-xs text-slate-gray">Cycle {directoryApi.data?.cycleId ?? '—'}</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="flex items-center gap-2 text-slate-gray uppercase text-xs tracking-wider"><Lock className="w-4 h-4" /> Encrypted Fields</div>
          <div className="text-3xl font-bold text-navy-accent">{enc ? enc.encryptedFields.length : '—'}</div>
          <div className="text-xs text-slate-gray">per record, {enc?.algorithm ?? 'AES-256-GCM'}</div>
        </div>
      </div>

      {/* Encryption statement */}
      {enc && (
        <div className="border border-navy-accent/25 bg-navy-accent/5 p-4 font-mono text-sm text-charcoal flex flex-col md:flex-row gap-3 md:items-start">
          <ShieldCheck className="w-6 h-6 text-navy-accent shrink-0" />
          <div className="space-y-1 leading-relaxed">
            <div><strong>Encryption at rest:</strong> contact, guardian, health and address fields are stored as {enc.algorithm} ciphertext bound to each record (key id <code className="bg-surface-white px-1">{enc.keyId}</code>, {enc.keySource}).</div>
            <div className="text-slate-gray">Sign-in codes are stored only as {enc.credentialHash} hashes. Opening a profile decrypts it for this session and is recorded in the audit log.</div>
          </div>
        </div>
      )}

      {(error || directoryApi.error) && <div role="alert" className="border border-red-700/30 bg-red-50 text-red-800 p-3 font-mono text-sm">{error || directoryApi.error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Directory table */}
        <div className="xl:col-span-7 border border-charcoal/10 bg-surface-white p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <label className="flex-1 flex items-center gap-2 border border-charcoal/25 bg-surface-white px-3 py-2 font-mono text-sm focus-within:border-navy-accent">
              <Search className="w-4 h-4 text-slate-gray" />
              <input
                aria-label="Search residents"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, reg. no, e-mail, room..."
                className="bg-transparent outline-none w-full text-charcoal"
              />
            </label>
            <div className="md:w-48"><ThemedSelect id="directory-block" value={block} onChange={setBlock} options={BLOCK_OPTIONS} placeholder="All Blocks" /></div>
            <div className="md:w-48"><ThemedSelect id="directory-dues" value={dues} onChange={setDues} options={DUES_OPTIONS} placeholder="Any Dues Status" /></div>
          </div>

          <div className="font-mono text-xs text-slate-gray uppercase tracking-wider">
            Showing {filtered.length} of {rows.length} residents
          </div>

          <div className="max-h-[600px] overflow-auto border border-charcoal/10">
            <table className="w-full font-mono text-sm">
              <thead className="sticky top-0 bg-warm-ivory text-slate-gray uppercase text-xs tracking-wider z-10">
                <tr>
                  <th className="text-left p-3">Resident</th>
                  <th className="text-left p-3">Programme</th>
                  <th className="text-left p-3">Room</th>
                  <th className="text-left p-3">Mobile</th>
                  <th className="text-left p-3">Dues</th>
                </tr>
              </thead>
              <tbody>
                {directoryApi.loading && (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-gray">Loading residents...</td></tr>
                )}
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => openProfile(r.id)}
                    className={`border-t border-charcoal/10 cursor-pointer hover:bg-navy-accent/5 ${selected?.id === r.id ? 'bg-navy-accent/10' : ''} ${r.status === 'Inactive' ? 'opacity-70' : ''}`}
                  >
                    <td className="p-3">
                      <button type="button" className="text-left" aria-label={`Open profile of ${r.name}`}>
                        <div className="font-semibold text-charcoal">{loadingId === r.id ? 'Decrypting…' : r.name}</div>
                        <div className="text-slate-gray text-xs">{r.regNo}{r.status === 'Inactive' && <span className="ml-2 text-red-800 font-bold">INACTIVE</span>}</div>
                      </button>
                    </td>
                    <td className="p-3 text-charcoal">{r.course} {r.branch}<div className="text-slate-gray text-xs">{r.yearOfStudy}</div></td>
                    <td className="p-3 font-bold text-navy-accent whitespace-nowrap">{r.room}</td>
                    <td className="p-3 text-slate-gray whitespace-nowrap">{r.phoneMasked}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold border px-1.5 py-0.5 ${r.duesPaid ? 'text-forest-status border-forest-status/40 bg-forest-status/5' : 'text-amber-800 border-amber-700/40 bg-amber-50'}`}>
                        {r.duesPaid ? 'PAID' : 'DUE'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!directoryApi.loading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-gray">No residents match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profile panel */}
        <div className="xl:col-span-5 border border-charcoal/10 bg-surface-white p-5 space-y-4">
          <h3 className="font-serif font-bold text-xl text-charcoal border-b border-charcoal/10 pb-2 flex items-center justify-between">
            Resident Profile
            {selected && (
              <button type="button" aria-label="Close profile" onClick={() => { setSelected(null); setStored(null); setIssued(null); }} className="text-slate-gray hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            )}
          </h3>
          {!selected ? (
            <p className="font-mono text-sm text-slate-gray leading-relaxed">Select a resident to decrypt and view their full profile. Each view is recorded in the audit log.</p>
          ) : (
            <div className="space-y-4 font-mono text-sm">
              <div className="space-y-0.5">
                <div className="text-xl font-bold text-charcoal font-serif flex items-center gap-2">
                  {selected.name}
                  {inactive && <span className="text-xs font-mono font-bold text-red-800 border border-red-700/40 bg-red-50 px-1.5 py-0.5">INACTIVE</span>}
                </div>
                <div className="text-slate-gray">{String(selected.regNo)} · {String(selected.email)}</div>
                <div className="text-slate-gray">{String(selected.course)} {String(selected.branch)}, {String(selected.yearOfStudy)} · {String(selected.gender)} · {String(selected.dietaryPref ?? '—')}</div>
                <div className="pt-1 font-bold text-navy-accent">Room {String(selected.room)} (Block {String(selected.block)})</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setDialog('edit')} className={`${btn} !px-3 !py-2 border border-charcoal/25 hover:bg-charcoal/5`}><Pencil className="w-4 h-4" /> Edit</button>
                <button type="button" disabled={working} onClick={resetCode} className={`${btn} !px-3 !py-2 border border-charcoal/25 hover:bg-charcoal/5 disabled:opacity-50`}><KeyRound className="w-4 h-4" /> Reset access code</button>
                <button type="button" disabled={working} onClick={toggleStatus}
                  className={`${btn} !px-3 !py-2 border disabled:opacity-50 ${inactive ? 'border-forest-status/50 text-forest-status hover:bg-forest-status/5' : 'border-red-700/40 text-red-800 hover:bg-red-50'}`}>
                  <Power className="w-4 h-4" /> {inactive ? 'Reactivate' : 'Deactivate'}
                </button>
              </div>

              {issued && <IssuedCode result={issued} />}

              <div className="border border-charcoal/10 divide-y divide-charcoal/10">
                {PRIVATE_FIELDS.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-4 px-3 py-2">
                    <span className="text-slate-gray flex items-center gap-1.5 shrink-0"><Lock className="w-3.5 h-3.5" />{label}</span>
                    <span className="text-charcoal text-right">{(selected[key] as string) || '—'}</span>
                  </div>
                ))}
              </div>
              {user?.role === 'CampusAdmin' && (
                <button type="button" onClick={showStored} className={`${btn} !px-3 !py-2 border border-charcoal/25 hover:bg-charcoal/5`}>
                  <Database className="w-4 h-4" /> Show stored (encrypted) record
                </button>
              )}
              {stored && (
                <div className="space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-gray">As persisted in the database</div>
                  <pre className="bg-[#0d131f] text-[#b8f0c6] p-3 text-xs leading-relaxed max-h-72 overflow-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(stored, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {dialog === 'add' && (
        <AddResidentDialog onClose={() => setDialog(null)} onCreated={r => { directoryApi.reload(); void openProfile(r.student.id); }} />
      )}
      {dialog === 'import' && <ImportResidentsDialog onClose={() => setDialog(null)} onImported={directoryApi.reload} />}
      {dialog === 'edit' && selected && (
        <EditResidentDialog profile={selected} onClose={() => setDialog(null)} onSaved={p => { setSelected(p as Profile); directoryApi.reload(); }} />
      )}
    </div>
  );
}
