import { useMemo, useState } from 'react';
import {
  UserCheck, BookOpen, GraduationCap, Briefcase, QrCode, Search,
  Calendar, CheckCircle, Building, User, ShieldCheck, BookMarked, Users, Mail, Phone, MapPin, Clock,
} from 'lucide-react';
import { useSession } from '../lib/session';
import { useApi } from '../lib/useApi';

// The resident record comes from the server; timetable, library and placement data are sample
// content until a student information system is connected.
interface ResidentRecord {
  name: string;
  regNo: string;
  email: string;
  course: string;
  branch: string;
  yearOfStudy: string;
  block: string;
  room: string;
  dietaryPref?: string;
  status?: string;
  phone?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
}

interface Contact { id: string; name: string; designation: string; email?: string; office?: string; officeHours?: string; dutyPhone?: string; extension?: string }
interface Proctee { ref: string; name: string; title: string; detail: string; email: string; duesPaid: boolean; status: string }
interface StaffRecord { id: string; name: string; designation: string; department: string; school?: string; office?: string; officeHours?: string; courses?: string[] }

const SLOTS = ['08:30 - 09:50 AM', '10:00 - 11:20 AM', '11:30 - 12:50 PM', '02:00 - 03:30 PM'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

interface DirectoryRow { course: string; branch: string; yearOfStudy: string; block: string; status?: string }

const TIMETABLE = [
  { time: '08:30 - 09:50 AM', monday: 'Operating Systems (CS201)', tuesday: 'Data Structures (CS203)', wednesday: 'Database Systems (CS205)', thursday: 'Computer Networks (CS207)', friday: 'AI & Machine Learning (CS209)' },
  { time: '10:00 - 11:20 AM', monday: 'AI & Machine Learning (CS209)', tuesday: 'Operating Systems (CS201)', wednesday: 'Data Structures (CS203)', thursday: 'Database Systems (CS205)', friday: 'Computer Networks (CS207)' },
  { time: '11:30 - 12:50 PM', monday: 'Database Lab (L1)', tuesday: 'OS Lab (L2)', wednesday: 'Software Eng. (CS211)', thursday: 'Discrete Math (MA201)', friday: 'Algorithmic Thinking (CS215)' },
  { time: '02:00 - 03:30 PM', monday: 'Discrete Math (MA201)', tuesday: 'Library Self Study', wednesday: 'Web Dev Workshop', thursday: 'Project Mentorship', friday: 'Research Seminar' },
];

const LIBRARY_BOOKS = [
  { id: 'BK-101', title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest', category: 'Computer Science', status: 'AVAILABLE', location: 'Rack 4-B', copies: 6, onLoan: 4 },
  { id: 'BK-102', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell & Peter Norvig', category: 'AI & Data', status: 'CHECKED OUT', location: 'Rack 2-A', copies: 4, onLoan: 4 },
  { id: 'BK-103', title: 'Operating System Concepts', author: 'Silberschatz, Galvin, Gagne', category: 'Core Systems', status: 'AVAILABLE', location: 'Rack 3-C', copies: 5, onLoan: 2 },
  { id: 'BK-104', title: 'Clean Code: Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Software Eng', status: 'RESERVED', location: 'Rack 1-D', copies: 2, onLoan: 1 },
  { id: 'BK-105', title: 'Pattern Recognition and Machine Learning', author: 'Christopher Bishop', category: 'AI & Data', status: 'AVAILABLE', location: 'Rack 2-A', copies: 3, onLoan: 1 },
];

const PLACEMENT_DRIVES = [
  { company: 'Google Cloud India', role: 'Software Development Engineer', package: '₹32.5 LPA', deadline: 'Oct 25, 2026', eligibility: 'CGPA ≥ 8.5, CSE/IT', applicants: 142, shortlisted: 18, open: true },
  { company: 'Microsoft India', role: 'Cloud Solutions Architect Intern', package: '₹28.0 LPA', deadline: 'Oct 20, 2026', eligibility: 'CGPA ≥ 8.0, All B.Tech', applicants: 231, shortlisted: 26, open: true },
  { company: 'Amazon AWS', role: 'Systems Engineer', package: '₹26.0 LPA', deadline: 'Nov 02, 2026', eligibility: 'CGPA ≥ 7.5, CSE/ECE', applicants: 188, shortlisted: 0, open: true },
  { company: 'Goldman Sachs', role: 'Quantitative Risk Analyst', package: '₹24.0 LPA', deadline: 'Oct 10, 2026', eligibility: 'CGPA ≥ 8.5, All Engineering', applicants: 97, shortlisted: 12, open: false },
];

type SubTab = 'profile' | 'records' | 'proctees' | 'academics' | 'library' | 'placement';

const card = 'border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm';
const statusBadge = (status: string) =>
  status === 'AVAILABLE' ? 'text-forest-status border-forest-status/30 bg-emerald-50'
    : status === 'RESERVED' ? 'text-amber-800 border-amber-300 bg-amber-50'
    : 'text-slate-gray border-charcoal/20 bg-gray-100';

export default function AcademicStudentHub() {
  const user = useSession();
  const isStudent = user?.role === 'Student';
  const isFaculty = user?.role === 'Faculty';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(isStudent ? 'profile' : isFaculty ? 'proctees' : 'records');
  const me = useApi<ResidentRecord>(isStudent ? '/api/students/me' : null);
  const contacts = useApi<{ proctor: Contact | null; wardens: Contact[] }>(isStudent ? '/api/people/my-contacts' : null);
  const directory = useApi<{ students: DirectoryRow[] }>(isStudent || isFaculty ? null : '/api/students');
  const proctees = useApi<Proctee[]>(isFaculty ? '/api/people/proctees' : null);
  const staffRecord = useApi<StaffRecord>(isFaculty ? '/api/people/me' : null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookCategory, setSelectedBookCategory] = useState('ALL');
  const [reservedBooks, setReservedBooks] = useState<string[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);

  const filteredBooks = LIBRARY_BOOKS.filter(book =>
    (book.title.toLowerCase().includes(searchTerm.toLowerCase()) || book.author.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedBookCategory === 'ALL' || book.category === selectedBookCategory));

  const stats = useMemo(() => {
    const rows = (directory.data?.students ?? []).filter(r => (r.status ?? 'Active') === 'Active');
    const count = (key: (r: DirectoryRow) => string) =>
      Object.entries(rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {}))
        .sort((a, b) => b[1] - a[1]);
    return { total: rows.length, byCourse: count(r => r.course), byYear: count(r => r.yearOfStudy).sort(), byBranch: count(r => `${r.course} ${r.branch}`) };
  }, [directory.data]);

  const tabs = isFaculty
    ? [
        { id: 'proctees', label: 'My Proctees', icon: Users },
        { id: 'academics', label: 'Teaching Schedule', icon: GraduationCap },
        { id: 'library', label: 'Library', icon: BookOpen },
      ]
    : isStudent
    ? [
        { id: 'profile', label: 'My Profile & ID', icon: UserCheck },
        { id: 'academics', label: 'My Timetable', icon: GraduationCap },
        { id: 'library', label: 'Library', icon: BookOpen },
        { id: 'placement', label: 'Placements', icon: Briefcase },
      ]
    : [
        { id: 'records', label: 'Student Records', icon: Users },
        { id: 'academics', label: 'Course Timetable', icon: GraduationCap },
        { id: 'library', label: 'Library Inventory', icon: BookOpen },
        { id: 'placement', label: 'Placement Cell', icon: Briefcase },
      ];

  const r = me.data;
  const programme = r ? `${r.course} ${r.branch}` : '';

  return (
    <div className="space-y-8 font-sans">
      {/* Header */}
      <div className={`${card} flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
        <div>
          <span className="text-slate-gray font-mono text-xs uppercase tracking-wider">{isStudent ? 'Student Academic Portal' : isFaculty ? 'Faculty Portal' : 'Academic Administration'}</span>
          <h2 className="font-serif font-bold text-2xl text-charcoal">{isStudent ? 'My Academics' : isFaculty ? `${user?.name ?? ''}` : 'Academic & Student Records'}</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            {isStudent
              ? 'Your student ID, timetable, library reservations and placement applications.'
              : isFaculty
              ? `${staffRecord.data ? `${staffRecord.data.designation}, ${staffRecord.data.department} (${staffRecord.data.school})` : ''}`
              : 'Enrolment overview, programme timetables, library stock and placement drives.'}
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

      {/* STUDENT: profile and digital ID from the resident record */}
      {isStudent && activeSubTab === 'profile' && (
        me.error ? <div role="alert" className="text-red-700 font-mono text-sm">{me.error}</div> :
        !r ? <div className="font-mono text-sm text-slate-gray">Loading your record…</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-charcoal/20 bg-gradient-to-br from-slate-900 via-charcoal to-navy-accent text-white p-6 rounded-sm shadow-md relative overflow-hidden font-mono">
              <div className="flex justify-between items-start border-b border-white/15 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <Building className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-sm tracking-wider uppercase">Vellore Institute of Technology</h3>
                    <span className="text-xs text-gray-300 block">STUDENT SMART PASS</span>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${r.status === 'Inactive' ? 'bg-red-500/20 text-red-200 border-red-300/40' : 'bg-emerald-500/20 text-emerald-200 border-emerald-300/40'}`}>
                  {r.status === 'Inactive' ? 'SUSPENDED' : 'ACTIVE'}
                </span>
              </div>
              <div className="flex gap-4 items-center mb-6">
                <div className="w-20 h-24 bg-slate-800 border-2 border-white/20 rounded-sm flex items-center justify-center shrink-0">
                  <User className="w-12 h-12 text-slate-400" />
                </div>
                <div className="space-y-1 text-sm">
                  <h4 className="font-bold text-base text-white tracking-wide">{r.name}</h4>
                  <p className="text-cyan-300 font-semibold">{r.regNo}</p>
                  <p className="text-gray-200">{programme}</p>
                  <p className="text-gray-300">{r.yearOfStudy}</p>
                </div>
              </div>
              <div className="flex items-end justify-between border-t border-white/15 pt-4">
                <div className="space-y-1">
                  <span className="text-xs text-gray-300 block uppercase">Hostel</span>
                  <span className="font-bold text-sm text-emerald-300">Block {r.block} · Room {r.room}</span>
                </div>
                <div className="bg-white p-1.5 rounded-sm flex flex-col items-center">
                  <QrCode className="w-10 h-10 text-charcoal" />
                </div>
              </div>
            </div>
          </div>

          <div className={`lg:col-span-7 ${card} space-y-6`}>
            <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
              <ShieldCheck className="w-5 h-5 text-navy-accent" /> My Student Record
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-sm">
              <div className="space-y-3">
                <h4 className="font-bold text-charcoal uppercase text-xs border-b border-charcoal/10 pb-1">Academic</h4>
                <div><span className="text-slate-gray block text-xs">Registration No</span><strong className="text-navy-accent">{r.regNo}</strong></div>
                <div><span className="text-slate-gray block text-xs">Programme</span><strong className="text-charcoal">{programme}</strong></div>
                <div><span className="text-slate-gray block text-xs">Year of Study</span><strong className="text-charcoal">{r.yearOfStudy}</strong></div>
                <div><span className="text-slate-gray block text-xs">Meal Plan</span><strong className="text-charcoal">{r.dietaryPref ?? '—'}</strong></div>
              </div>
              <div className="space-y-3">
                <h4 className="font-bold text-charcoal uppercase text-xs border-b border-charcoal/10 pb-1">Contact & Guardian</h4>
                <div><span className="text-slate-gray block text-xs">Institutional E-mail</span><strong className="text-charcoal break-all">{r.email}</strong></div>
                <div><span className="text-slate-gray block text-xs">Mobile</span><strong className="text-charcoal">{r.phone ?? '—'}</strong></div>
                <div><span className="text-slate-gray block text-xs">Guardian</span><strong className="text-charcoal">{r.guardianName ?? '—'}{r.guardianRelation ? ` (${r.guardianRelation})` : ''}</strong></div>
                <div><span className="text-slate-gray block text-xs">Guardian Mobile</span><strong className="text-charcoal">{r.guardianPhone ?? '—'}</strong></div>
              </div>
            </div>
            <p className="font-mono text-xs text-slate-gray border-t border-charcoal/10 pt-3">
              To correct any detail, contact the warden's office. Personal details are stored encrypted.
            </p>
          </div>

          <div className={`lg:col-span-12 ${card} space-y-4`}>
            <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2 border-b border-charcoal/10 pb-3">
              <Users className="w-5 h-5 text-navy-accent" /> My Proctor & Wardens
            </h3>
            {contacts.error && <div role="alert" className="text-red-700 font-mono text-sm">{contacts.error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-sm">
              {[...(contacts.data?.proctor ? [{ ...contacts.data.proctor, role: 'Faculty proctor' }] : []),
                ...(contacts.data?.wardens ?? []).map(w => ({ ...w, role: w.designation }))].map(c => (
                <div key={c.id} className="border border-charcoal/10 bg-warm-ivory/50 p-4 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-slate-gray">{c.role}</div>
                  <div className="font-semibold text-charcoal">{c.name} <span className="text-xs text-slate-gray">{c.id}</span></div>
                  {c.email && <div className="text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</div>}
                  {c.dutyPhone && <div className="text-xs flex items-center gap-1"><Phone className="w-3 h-3" />{c.dutyPhone}</div>}
                  {c.office && <div className="text-xs flex items-center gap-1"><MapPin className="w-3 h-3" />{c.office}</div>}
                  {c.officeHours && <div className="text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{c.officeHours}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
        )
      )}

      {/* FACULTY: proctees */}
      {isFaculty && activeSubTab === 'proctees' && (
        <div className={`${card} space-y-4`}>
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2"><Users className="w-5 h-5 text-navy-accent" /> My Proctees</h3>
            <span className="font-mono text-xs font-bold bg-navy-accent/10 text-navy-accent px-3 py-1">{proctees.data?.length ?? 0} STUDENTS</span>
          </div>
          {proctees.error && <div role="alert" className="text-red-700 font-mono text-sm">{proctees.error}</div>}
          <table className="w-full font-mono text-sm">
            <thead className="bg-warm-ivory text-slate-gray text-xs uppercase tracking-wider"><tr><th className="text-left p-2">Student</th><th className="text-left p-2">Programme</th><th className="text-left p-2">Room</th><th className="text-left p-2">E-mail</th><th className="text-left p-2">Hostel dues</th></tr></thead>
            <tbody>
              {(proctees.data ?? []).map(s => (
                <tr key={s.ref} className="border-t border-charcoal/10">
                  <td className="p-2"><div className="font-semibold text-charcoal">{s.name}</div><div className="text-xs text-slate-gray">{s.ref}</div></td>
                  <td className="p-2 text-charcoal">{s.title}</td>
                  <td className="p-2 text-navy-accent font-bold">{s.detail.replace('Room ', '')}</td>
                  <td className="p-2 text-xs">{s.email}</td>
                  <td className="p-2"><span className={`text-xs font-bold border px-1.5 py-0.5 ${s.duesPaid ? 'text-forest-status border-forest-status/40 bg-forest-status/5' : 'text-amber-800 border-amber-700/40 bg-amber-50'}`}>{s.duesPaid ? 'PAID' : 'DUE'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-mono text-xs text-slate-gray">Open a proctee in People Search to see their guardian contact (access is logged).</p>
        </div>
      )}

      {/* ADMIN: enrolment overview from the resident records */}
      {!isStudent && activeSubTab === 'records' && (
        <div className="space-y-6">
          {directory.error && <div role="alert" className="text-red-700 font-mono text-sm">{directory.error}</div>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">Active Students</div><div className="text-3xl font-bold text-charcoal">{directory.loading ? '—' : stats.total}</div></div>
            {stats.byCourse.slice(0, 3).map(([course, n]) => (
              <div key={course} className="border border-charcoal/10 bg-warm-ivory p-4"><div className="text-xs uppercase text-slate-gray tracking-wider">{course}</div><div className="text-3xl font-bold text-navy-accent">{n}</div></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${card} space-y-3`}>
              <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/10 pb-2">Students by Programme</h3>
              <table className="w-full font-mono text-sm">
                <tbody>
                  {stats.byBranch.map(([name, n]) => (
                    <tr key={name} className="border-b border-charcoal/10">
                      <td className="py-2 text-charcoal">{name}</td>
                      <td className="py-2 w-1/2"><div className="h-2 bg-navy-accent/80" style={{ width: `${(100 * n) / Math.max(1, stats.byBranch[0]?.[1] ?? 1)}%` }} /></td>
                      <td className="py-2 text-right font-bold text-charcoal w-10">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${card} space-y-3`}>
              <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/10 pb-2">Students by Year</h3>
              <table className="w-full font-mono text-sm">
                <tbody>
                  {stats.byYear.map(([year, n]) => (
                    <tr key={year} className="border-b border-charcoal/10">
                      <td className="py-2 text-charcoal">{year}</td>
                      <td className="py-2 w-1/2"><div className="h-2 bg-forest-status/80" style={{ width: `${(100 * n) / Math.max(1, stats.total)}%` }} /></td>
                      <td className="py-2 text-right font-bold text-charcoal w-10">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-mono text-xs text-slate-gray pt-2">Individual profiles are in the Resident Directory.</p>
            </div>
          </div>
        </div>
      )}

      {/* TIMETABLE */}
      {activeSubTab === 'academics' && (
        <div className={`${card} space-y-6`}>
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Calendar className="w-5 h-5 text-navy-accent" /> {isStudent ? 'My Weekly Timetable' : isFaculty ? 'My Teaching Schedule' : 'Programme Timetable'}
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">
                {isStudent && r ? `${programme} · ${r.yearOfStudy} · Fall 2026` : isFaculty ? (staffRecord.data?.courses ?? []).join(' · ') : 'B.Tech CSE · Semester IV · Fall 2026'}
              </p>
            </div>
            <span className="bg-navy-accent/10 text-navy-accent font-mono text-xs font-bold px-3 py-1 rounded-xs">{isStudent ? 'CREDITS: 24.0' : isFaculty ? `${staffRecord.data?.courses?.length ?? 0} COURSES` : '5 COURSES · 2 LABS'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-sm border border-charcoal/15 border-collapse">
              <thead>
                <tr className="bg-warm-ivory border-b border-charcoal/20 text-charcoal uppercase text-xs">
                  {['Time Slot', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(h => <th key={h} className="p-3 border-r border-charcoal/15">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {isFaculty ? SLOTS.map((slot, si) => (
                  <tr key={slot} className="border-b border-charcoal/10">
                    <td className="p-3 border-r border-charcoal/15 font-bold text-navy-accent bg-warm-ivory/30 whitespace-nowrap">{slot}</td>
                    {DAYS.map((day, di) => {
                      const courses = staffRecord.data?.courses ?? [];
                      // Each course meets three times a week; office hours and research fill the rest.
                      const idx = (si * 5 + di) % 6;
                      const cell = !courses.length ? '—' : idx < 4 ? courses[idx % courses.length] : idx === 4 ? 'Office hours' : 'Research / Lab';
                      return <td key={day} className="p-3 border-r border-charcoal/15 text-charcoal">{cell}</td>;
                    })}
                  </tr>
                )) : TIMETABLE.map(row => (
                  <tr key={row.time} className="border-b border-charcoal/10">
                    <td className="p-3 border-r border-charcoal/15 font-bold text-navy-accent bg-warm-ivory/30 whitespace-nowrap">{row.time}</td>
                    {[row.monday, row.tuesday, row.wednesday, row.thursday, row.friday].map((c, i) => <td key={i} className="p-3 border-r border-charcoal/15 text-charcoal">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LIBRARY */}
      {activeSubTab === 'library' && (
        <div className={`${card} space-y-6`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-charcoal/10 pb-4">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-navy-accent" /> {isStudent ? 'Library Catalogue' : 'Library Inventory'}
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">{isStudent || isFaculty ? 'Search books and reserve an available copy.' : 'Copies held, copies on loan and rack locations.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-gray absolute left-3 top-2.5" />
                <input type="text" aria-label="Search books" placeholder="Search by title or author..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-charcoal/25 bg-surface-white text-sm font-mono text-charcoal outline-none focus:border-navy-accent rounded-xs" />
              </div>
              <select aria-label="Book category" value={selectedBookCategory} onChange={e => setSelectedBookCategory(e.target.value)}
                className="px-3 py-2 border border-charcoal/25 bg-surface-white text-sm font-mono text-charcoal outline-none focus:border-navy-accent rounded-xs">
                <option value="ALL">All Categories</option>
                {['Computer Science', 'AI & Data', 'Core Systems', 'Software Eng'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-sm">
            {filteredBooks.map(book => (
              <div key={book.id} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-navy-accent">{book.id}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${statusBadge(book.status)}`}>{book.status}</span>
                  </div>
                  <h4 className="font-bold text-charcoal leading-snug">{book.title}</h4>
                  <p className="text-slate-gray text-xs">{book.author}</p>
                  <div className="flex justify-between text-xs text-charcoal/80 pt-1 border-t border-charcoal/10">
                    <span>{book.category}</span><span>{book.location}</span>
                  </div>
                </div>
                {isStudent || isFaculty ? (
                  <button
                    onClick={() => setReservedBooks(prev => prev.includes(book.id) ? prev.filter(id => id !== book.id) : [...prev, book.id])}
                    disabled={book.status !== 'AVAILABLE'}
                    className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 ${
                      reservedBooks.includes(book.id) ? 'bg-emerald-700 text-white'
                        : book.status === 'AVAILABLE' ? 'bg-navy-accent hover:bg-charcoal text-white' : 'bg-gray-200 text-gray-600 cursor-not-allowed'}`}
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    {reservedBooks.includes(book.id) ? 'Reserved (tap to cancel)' : book.status === 'AVAILABLE' ? 'Reserve Book' : 'Unavailable'}
                  </button>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-charcoal/10 pt-2">
                    <div><div className="font-bold text-charcoal text-base">{book.copies}</div>copies</div>
                    <div><div className="font-bold text-amber-800 text-base">{book.onLoan}</div>on loan</div>
                    <div><div className="font-bold text-forest-status text-base">{book.copies - book.onLoan}</div>on shelf</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLACEMENTS */}
      {activeSubTab === 'placement' && (
        <div className={`${card} space-y-6`}>
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-navy-accent" /> {isStudent ? 'Placement Drives' : 'Placement Cell'}
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">{isStudent ? 'Open drives you can apply to before the deadline.' : 'Recruitment drives with application and shortlist counts.'}</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-mono text-xs font-bold px-3 py-1 rounded-xs">HIGHEST OFFER: ₹44.0 LPA</span>
          </div>

          {isStudent ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-sm">
              {PLACEMENT_DRIVES.map(drive => {
                const applied = appliedJobs.includes(drive.company);
                return (
                  <div key={drive.company} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4">
                    <div className="flex justify-between items-start border-b border-charcoal/10 pb-3">
                      <div><h4 className="font-bold text-base text-charcoal">{drive.company}</h4><p className="text-navy-accent font-semibold">{drive.role}</p></div>
                      <span className="bg-navy-accent text-white font-bold px-2.5 py-1 text-xs rounded-xs">{drive.package}</span>
                    </div>
                    <div className="space-y-1.5 text-slate-gray">
                      <div className="flex justify-between"><span>Eligibility</span><strong className="text-charcoal">{drive.eligibility}</strong></div>
                      <div className="flex justify-between"><span>Deadline</span><strong className="text-amber-800">{drive.deadline}</strong></div>
                    </div>
                    <button
                      onClick={() => setAppliedJobs(prev => [...prev, drive.company])}
                      disabled={applied || !drive.open}
                      className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 ${
                        applied ? 'bg-emerald-700 text-white' : drive.open ? 'bg-navy-accent hover:bg-charcoal text-white' : 'bg-gray-200 text-gray-600 cursor-not-allowed'}`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> {applied ? 'Application Submitted' : drive.open ? 'Apply Now' : 'Applications Closed'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-sm border border-charcoal/15 border-collapse">
                <thead>
                  <tr className="bg-warm-ivory border-b border-charcoal/20 text-charcoal uppercase text-xs">
                    {['Company', 'Role', 'Package', 'Eligibility', 'Deadline', 'Applicants', 'Shortlisted', 'Status'].map(h => <th key={h} className="p-3 border-r border-charcoal/15">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PLACEMENT_DRIVES.map(d => (
                    <tr key={d.company} className="border-b border-charcoal/10">
                      <td className="p-3 border-r border-charcoal/15 font-bold text-charcoal">{d.company}</td>
                      <td className="p-3 border-r border-charcoal/15 text-charcoal">{d.role}</td>
                      <td className="p-3 border-r border-charcoal/15 text-navy-accent font-bold whitespace-nowrap">{d.package}</td>
                      <td className="p-3 border-r border-charcoal/15 text-slate-gray">{d.eligibility}</td>
                      <td className="p-3 border-r border-charcoal/15 whitespace-nowrap">{d.deadline}</td>
                      <td className="p-3 border-r border-charcoal/15 text-right font-bold">{d.applicants}</td>
                      <td className="p-3 border-r border-charcoal/15 text-right font-bold">{d.shortlisted}</td>
                      <td className="p-3"><span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${d.open ? 'text-forest-status border-forest-status/30 bg-emerald-50' : 'text-slate-gray border-charcoal/20 bg-gray-100'}`}>{d.open ? 'OPEN' : 'CLOSED'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
