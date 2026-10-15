import { useMemo, useState } from 'react';
import { Lock, Search, ShieldCheck, Users, Database, X } from 'lucide-react';
import ThemedSelect from './ThemedSelect';
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

type Profile = Omit<DirectoryRow, 'phoneMasked' | 'encryptedFields' | 'duesPaid'> & Record<string, string | string[] | undefined>;

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r =>
      (!block || r.block === block) &&
      (!dues || (dues === 'paid') === r.duesPaid) &&
      (!q || [r.name, r.regNo, r.email, r.room, r.branch].some(v => v.toLowerCase().includes(q))));
  }, [rows, query, block, dues]);

  const stats = useMemo(() => ({
    total: rows.length,
    paid: rows.filter(r => r.duesPaid).length,
    byBlock: ['A', 'B', 'C'].map(b => rows.filter(r => r.block === b).length),
  }), [rows]);

  const openProfile = async (row: DirectoryRow) => {
    setError('');
    setStored(null);
    setLoadingId(row.id);
    try {
      setSelected(await api.get<Profile>(`/api/students/${encodeURIComponent(row.id)}`));
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

  return (
    <div className="space-y-8">
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 14</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Resident Directory & Encrypted Records</h2>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="flex items-center gap-2 text-slate-gray uppercase text-[10px] tracking-wider"><Users className="w-4 h-4" /> Residents</div>
          <div className="text-2xl font-bold text-charcoal">{directoryApi.loading ? '—' : stats.total}</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="text-slate-gray uppercase text-[10px] tracking-wider">Block A / B / C</div>
          <div className="text-2xl font-bold text-charcoal">{directoryApi.loading ? '—' : stats.byBlock.join(' / ')}</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="text-slate-gray uppercase text-[10px] tracking-wider">Dues Paid ({directoryApi.data?.cycleId ?? '—'})</div>
          <div className="text-2xl font-bold text-forest-status">{directoryApi.loading ? '—' : `${stats.paid} / ${stats.total}`}</div>
        </div>
        <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-1">
          <div className="flex items-center gap-2 text-slate-gray uppercase text-[10px] tracking-wider"><Lock className="w-4 h-4" /> Encrypted Fields</div>
          <div className="text-2xl font-bold text-navy-accent">{enc ? `${enc.encryptedFields.length} per record` : '—'}</div>
        </div>
      </div>

      {/* Encryption statement */}
      {enc && (
        <div className="border border-navy-accent/20 bg-navy-accent/5 p-4 font-mono text-[11px] text-charcoal flex flex-col md:flex-row gap-3 md:items-center">
          <ShieldCheck className="w-6 h-6 text-navy-accent shrink-0" />
          <div className="space-y-1">
            <div><strong>Encryption at rest:</strong> contact, guardian, health and address fields are stored as {enc.algorithm} ciphertext bound to each record (key id <code>{enc.keyId}</code>, {enc.keySource}).</div>
            <div className="text-slate-gray">Sign-in codes are stored only as {enc.credentialHash} hashes. Opening a profile decrypts it for this session and is recorded in the audit log.</div>
          </div>
        </div>
      )}

      {(error || directoryApi.error) && <div role="alert" className="text-red-700 font-mono text-xs">{error || directoryApi.error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Directory table */}
        <div className="xl:col-span-7 border border-charcoal/10 bg-surface-white p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <label className="flex-1 flex items-center gap-2 border border-charcoal/15 bg-warm-ivory px-3 py-2 font-mono text-xs">
              <Search className="w-4 h-4 text-slate-gray" />
              <input
                aria-label="Search residents"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name, reg. no, e-mail, room..."
                className="bg-transparent outline-none w-full"
              />
            </label>
            <div className="md:w-44"><ThemedSelect id="directory-block" value={block} onChange={setBlock} options={BLOCK_OPTIONS} placeholder="All Blocks" /></div>
            <div className="md:w-44"><ThemedSelect id="directory-dues" value={dues} onChange={setDues} options={DUES_OPTIONS} placeholder="Any Dues Status" /></div>
          </div>

          <div className="font-mono text-[10px] text-slate-gray uppercase tracking-wider">
            Showing {filtered.length} of {rows.length} residents
          </div>

          <div className="max-h-[560px] overflow-auto border border-charcoal/10">
            <table className="w-full font-mono text-[11px]">
              <thead className="sticky top-0 bg-warm-ivory text-slate-gray uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="text-left p-2">Resident</th>
                  <th className="text-left p-2">Programme</th>
                  <th className="text-left p-2">Room</th>
                  <th className="text-left p-2">Mobile</th>
                  <th className="text-left p-2">Dues</th>
                </tr>
              </thead>
              <tbody>
                {directoryApi.loading && (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-gray">Loading residents...</td></tr>
                )}
                {filtered.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => openProfile(r)}
                    className={`border-t border-charcoal/5 cursor-pointer hover:bg-navy-accent/5 ${selected?.id === r.id ? 'bg-navy-accent/10' : ''}`}
                  >
                    <td className="p-2">
                      <button type="button" className="text-left" aria-label={`Open profile of ${r.name}`}>
                        <div className="font-bold text-charcoal">{loadingId === r.id ? 'Decrypting…' : r.name}</div>
                        <div className="text-slate-gray text-[10px]">{r.regNo}</div>
                      </button>
                    </td>
                    <td className="p-2 text-charcoal">{r.course} {r.branch}<div className="text-slate-gray text-[10px]">{r.yearOfStudy}</div></td>
                    <td className="p-2 font-bold text-navy-accent">{r.room}</td>
                    <td className="p-2 text-slate-gray">{r.phoneMasked}</td>
                    <td className="p-2">
                      <span className={`text-[9px] border px-1 ${r.duesPaid ? 'text-forest-status border-forest-status/30' : 'text-amber-700 border-amber-700/30'}`}>
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
          <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/5 pb-2 flex items-center justify-between">
            Resident Profile
            {selected && (
              <button type="button" aria-label="Close profile" onClick={() => { setSelected(null); setStored(null); }} className="text-slate-gray hover:text-charcoal">
                <X className="w-4 h-4" />
              </button>
            )}
          </h3>
          {!selected ? (
            <p className="font-mono text-xs text-slate-gray">Select a resident to decrypt and view their full profile. Each view is recorded in the audit log.</p>
          ) : (
            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="text-lg font-bold text-charcoal font-serif">{selected.name}</div>
                <div className="text-slate-gray">{selected.regNo} · {selected.email}</div>
                <div className="text-slate-gray">{selected.course} {selected.branch}, {selected.yearOfStudy} · {selected.gender} · {selected.dietaryPref}</div>
                <div className="mt-1 font-bold text-navy-accent">Room {selected.room} (Block {selected.block})</div>
              </div>
              <div className="border border-charcoal/10 divide-y divide-charcoal/5">
                {PRIVATE_FIELDS.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-4 p-2">
                    <span className="text-slate-gray flex items-center gap-1"><Lock className="w-3 h-3" />{label}</span>
                    <span className="text-charcoal text-right">{(selected[key] as string) || '—'}</span>
                  </div>
                ))}
              </div>
              {user?.role === 'CampusAdmin' && (
                <button type="button" onClick={showStored} className="flex items-center gap-2 border border-charcoal/15 hover:bg-charcoal/5 px-3 py-2 text-[10px] uppercase tracking-wider">
                  <Database className="w-4 h-4" /> Show stored (encrypted) record
                </button>
              )}
              {stored && (
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wider text-slate-gray">As persisted in the database</div>
                  <pre className="bg-[#0d131f] text-[#9fe0b0] p-3 text-[10px] max-h-72 overflow-auto whitespace-pre-wrap break-all">
                    {JSON.stringify(stored, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
