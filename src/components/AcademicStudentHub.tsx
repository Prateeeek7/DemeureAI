import { useState } from 'react';
import {
  UserCheck, BookOpen, GraduationCap, Briefcase, QrCode, Search,
  Calendar, CheckCircle, Download, Building, User, ShieldCheck, BookMarked
} from 'lucide-react';
import { useSession } from '../lib/session';

interface StudentProfile {
  name: string;
  rollNo: string;
  department: string;
  semester: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  status: 'ACTIVE' | 'ENROLLED' | 'GRADUATED';
  gpa: string;
}

const DEMO_STUDENT: StudentProfile = {
  name: 'Pratik Kumar',
  rollNo: '24BCE0194',
  department: 'Computer Science & Engineering',
  semester: '4th Semester (B.Tech)',
  email: 'pratik2024@vit.student.ac.in',
  phone: '+91 98765 43210',
  guardianName: 'Rakesh Kumar',
  guardianPhone: '+91 98765 00112',
  status: 'ACTIVE',
  gpa: '9.42 / 10.0',
};

const TIMETABLE = [
  { time: '08:30 - 09:50 AM', monday: 'Operating Systems (CS201)', tuesday: 'Data Structures (CS203)', wednesday: 'Database Systems (CS205)', thursday: 'Computer Networks (CS207)', friday: 'AI & Machine Learning (CS209)' },
  { time: '10:00 - 11:20 AM', monday: 'AI & Machine Learning (CS209)', tuesday: 'Operating Systems (CS201)', wednesday: 'Data Structures (CS203)', thursday: 'Database Systems (CS205)', friday: 'Computer Networks (CS207)' },
  { time: '11:30 - 12:50 PM', monday: 'Database Lab (L1)', tuesday: 'OS Lab (L2)', wednesday: 'Software Eng. (CS211)', thursday: 'Discrete Math (MA201)', friday: 'Algorithmic Thinking (CS215)' },
  { time: '02:00 - 03:30 PM', monday: 'Discrete Math (MA201)', tuesday: 'Library Self Study', wednesday: 'Web Dev Workshop', thursday: 'Project Mentorship', friday: 'Research Seminar' },
];

const LIBRARY_BOOKS = [
  { id: 'BK-101', title: 'Introduction to Algorithms (CLRS)', author: 'Cormen, Leiserson, Rivest', category: 'Computer Science', status: 'AVAILABLE', location: 'Rack 4-B' },
  { id: 'BK-102', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell & Peter Norvig', category: 'AI & Data', status: 'CHECKED OUT', location: 'Rack 2-A' },
  { id: 'BK-103', title: 'Operating System Concepts', author: 'Silberschatz, Galvin, Gagne', category: 'Core Systems', status: 'AVAILABLE', location: 'Rack 3-C' },
  { id: 'BK-104', title: 'Clean Code: Handbook of Agile Software Craftsmanship', author: 'Robert C. Martin', category: 'Software Eng', status: 'RESERVED', location: 'Rack 1-D' },
  { id: 'BK-105', title: 'Pattern Recognition and Machine Learning', author: 'Christopher Bishop', category: 'AI & Data', status: 'AVAILABLE', location: 'Rack 2-A' },
];

const PLACEMENT_DRIVES = [
  { company: 'Google Cloud India', role: 'Software Development Engineer', package: '₹32.5 LPA', deadline: 'Sep 15, 2026', eligibility: 'CGPA >= 8.5, CSE/IT', status: 'ELIGIBLE' },
  { company: 'Microsoft India', role: 'Cloud Solutions Architect Intern', package: '₹28.0 LPA', deadline: 'Sep 20, 2026', eligibility: 'CGPA >= 8.0, All B.Tech', status: 'APPLIED' },
  { company: 'Amazon AWS', role: 'Systems Engineer', package: '₹26.0 LPA', deadline: 'Oct 02, 2026', eligibility: 'CGPA >= 7.5, CSE/ECE', status: 'ELIGIBLE' },
  { company: 'Goldman Sachs', role: 'Quantitative Risk Analyst', package: '₹24.0 LPA', deadline: 'Oct 10, 2026', eligibility: 'CGPA >= 8.5, All Engineering', status: 'SHORTLISTED' },
];

export default function AcademicStudentHub() {
  type SubTab = 'profile' | 'academics' | 'library' | 'placement';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('profile');
  // Identity comes from the signed-in account; academic records are sample data until an SIS is connected.
  const user = useSession();
  const profile: StudentProfile = user?.role === 'Student'
    ? { ...DEMO_STUDENT, name: user.name, email: user.email }
    : DEMO_STUDENT;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookCategory, setSelectedBookCategory] = useState('ALL');
  const [reservedBooks, setReservedBooks] = useState<string[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<string[]>(['Microsoft India']);

  const handleBookReserve = (bookId: string) => {
    if (reservedBooks.includes(bookId)) {
      setReservedBooks(prev => prev.filter(id => id !== bookId));
    } else {
      setReservedBooks(prev => [...prev, bookId]);
    }
  };

  const handleApplyJob = (company: string) => {
    if (!appliedJobs.includes(company)) {
      setAppliedJobs(prev => [...prev, company]);
    }
  };

  const filteredBooks = LIBRARY_BOOKS.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          book.author.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedBookCategory === 'ALL' || book.category === selectedBookCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-navy-accent/10 text-navy-accent font-mono text-[13px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-xs">
              Module Cluster 1, 2, 6 & 12
            </span>
            <span className="text-slate-gray font-mono text-xs">• Academic & Student Operations</span>
          </div>
          <h2 className="font-serif font-bold text-2xl text-charcoal">Academic & Student Lifecycle Operations</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            Unified portal for digital student IDs, course timetables, digital library resource reservation, and campus career drives.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-warm-ivory p-1 border border-charcoal/15 rounded-sm">
          {[
            { id: 'profile', label: 'Student Profile & ID', icon: UserCheck },
            { id: 'academics', label: 'Academics & Schedule', icon: GraduationCap },
            { id: 'library', label: 'Library & E-Resources', icon: BookOpen },
            { id: 'placement', label: 'Placements & Career', icon: Briefcase },
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

      {/* SUB TAB 1: STUDENT PROFILE & DIGITAL ID CARD */}
      {activeSubTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Digital Smart ID Card */}
          <div className="lg:col-span-5 space-y-6">
            <div className="border border-charcoal/20 bg-gradient-to-br from-slate-900 via-charcoal to-navy-accent text-white p-6 rounded-sm shadow-md relative overflow-hidden font-mono">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start border-b border-white/15 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <Building className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="font-bold text-sm tracking-wider uppercase">Demeure Institute of Technology</h3>
                    <span className="text-xs text-gray-300 block">OFFICIAL INSTITUTIONAL SMART PASS</span>
                  </div>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 border border-emerald-400/30 rounded-xs">
                  RFID / NFC ACTIVE
                </span>
              </div>

              <div className="flex gap-4 items-center mb-6">
                <div className="w-20 h-24 bg-slate-800 border-2 border-white/20 rounded-sm flex items-center justify-center relative overflow-hidden shrink-0">
                  <User className="w-12 h-12 text-slate-400" />
                  <span className="absolute bottom-0 w-full bg-emerald-700 text-xs font-bold text-center text-white py-0.5">VERIFIED</span>
                </div>
                
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-base text-white tracking-wide">{profile.name}</h4>
                  <p className="text-cyan-300 font-semibold">{profile.rollNo}</p>
                  <p className="text-[13px] text-gray-300">{profile.department}</p>
                  <p className="text-xs text-gray-400">{profile.semester}</p>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-white/15 pt-4">
                <div className="space-y-1">
                  <span className="text-xs text-gray-400 block uppercase">Current CGPA Score</span>
                  <span className="font-bold text-sm text-emerald-400">{profile.gpa}</span>
                </div>

                {/* QR Code Mock */}
                <div className="bg-white p-1.5 rounded-sm shadow-sm flex flex-col items-center">
                  <QrCode className="w-10 h-10 text-charcoal" />
                  <span className="text-xs font-mono font-bold text-charcoal tracking-tighter mt-0.5">DEMEURE-PASSPORT</span>
                </div>
              </div>
            </div>

            <div className="border border-charcoal/15 bg-surface-white p-5 rounded-sm font-mono text-xs space-y-3">
              <div className="flex justify-between items-center border-b border-charcoal/10 pb-2">
                <span className="font-bold text-charcoal">Digital Access Status</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 font-bold rounded-xs border border-emerald-200">VALID TILL 2028</span>
              </div>
              <div className="space-y-2 text-slate-gray">
                <div className="flex justify-between"><span>Hostel Block Access:</span><strong className="text-charcoal">Block A (Room 304)</strong></div>
                <div className="flex justify-between"><span>Mess Dining Pass:</span><strong className="text-charcoal">Special Veg & Non-Veg</strong></div>
                <div className="flex justify-between"><span>Library Access Level:</span><strong className="text-charcoal">Tier-1 Research Clearance</strong></div>
              </div>
            </div>
          </div>

          {/* Student Profile Records */}
          <div className="lg:col-span-7 border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-navy-accent" /> Institutional Student Record (Module 1)
              </h3>
              <span className="bg-emerald-100 text-emerald-800 text-xs font-mono font-bold px-2.5 py-1 rounded-xs">
                STATUS: {profile.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="space-y-4">
                <h4 className="font-bold text-charcoal uppercase border-b border-charcoal/10 pb-1">Academic Info</h4>
                <div><span className="text-slate-gray block text-[13px]">Full Student Name</span><strong className="text-charcoal text-sm">{profile.name}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Registration / Roll No</span><strong className="text-navy-accent text-sm">{profile.rollNo}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Enrolled Department</span><strong className="text-charcoal">{profile.department}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Current Semester</span><strong className="text-charcoal">{profile.semester}</strong></div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-charcoal uppercase border-b border-charcoal/10 pb-1">Guardian & Emergency Info</h4>
                <div><span className="text-slate-gray block text-[13px]">Institutional Email</span><strong className="text-charcoal">{profile.email}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Contact Phone</span><strong className="text-charcoal">{profile.phone}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Parent / Guardian Name</span><strong className="text-charcoal">{profile.guardianName}</strong></div>
                <div><span className="text-slate-gray block text-[13px]">Parent Contact Number</span><strong className="text-charcoal">{profile.guardianPhone}</strong></div>
              </div>
            </div>

            <div className="border-t border-charcoal/10 pt-4 flex justify-end">
              <button className="bg-navy-accent hover:bg-charcoal text-white text-xs font-mono font-semibold px-4 py-2.5 rounded-xs flex items-center gap-2 shadow-xs transition-colors">
                <Download className="w-3.5 h-3.5" /> Download Encrypted Student Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: ACADEMICS & TIMETABLE */}
      {activeSubTab === 'academics' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Calendar className="w-5 h-5 text-navy-accent" /> Course Registration & Timetable Grid (Module 2)
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">Spring 2026 Academic Schedule • Semester IV</p>
            </div>
            <span className="bg-navy-accent/10 text-navy-accent font-mono text-xs font-bold px-3 py-1 rounded-xs">
              CREDITS ENROLLED: 24.0
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border border-charcoal/15 border-collapse">
              <thead>
                <tr className="bg-warm-ivory border-b border-charcoal/20 text-charcoal uppercase text-[13px]">
                  <th className="p-3 border-r border-charcoal/15">Time Slot</th>
                  <th className="p-3 border-r border-charcoal/15">Monday</th>
                  <th className="p-3 border-r border-charcoal/15">Tuesday</th>
                  <th className="p-3 border-r border-charcoal/15">Wednesday</th>
                  <th className="p-3 border-r border-charcoal/15">Thursday</th>
                  <th className="p-3">Friday</th>
                </tr>
              </thead>
              <tbody>
                {TIMETABLE.map((row, idx) => (
                  <tr key={idx} className="border-b border-charcoal/10 hover:bg-slate-50 transition-colors">
                    <td className="p-3 border-r border-charcoal/15 font-bold text-navy-accent bg-warm-ivory/30 whitespace-nowrap">{row.time}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal">{row.monday}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal">{row.tuesday}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal">{row.wednesday}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal">{row.thursday}</td>
                    <td className="p-3 text-charcoal">{row.friday}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB TAB 3: LIBRARY MANAGEMENT & DIGITAL RESOURCES */}
      {activeSubTab === 'library' && (
        <div className="space-y-6">
          <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-charcoal/10 pb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-navy-accent" /> Institutional Library & E-Resource Catalogue (Module 6)
                </h3>
                <p className="font-mono text-xs text-slate-gray mt-0.5">Search physical books, check rack locations, or reserve reading-room study desks.</p>
              </div>

              {/* Search & Category Filters */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-slate-gray absolute left-3 top-2.5" />
                  <input 
                    type="text"
                    placeholder="Search by book title or author..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-charcoal/20 bg-warm-ivory/50 text-xs font-mono text-charcoal outline-none focus:border-navy-accent rounded-xs"
                  />
                </div>

                <select 
                  value={selectedBookCategory}
                  onChange={(e) => setSelectedBookCategory(e.target.value)}
                  className="px-3 py-2 border border-charcoal/20 bg-warm-ivory/50 text-xs font-mono text-charcoal outline-none focus:border-navy-accent rounded-xs"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="AI & Data">AI & Data</option>
                  <option value="Core Systems">Core Systems</option>
                  <option value="Software Eng">Software Eng</option>
                </select>
              </div>
            </div>

            {/* Books Catalogue Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono text-xs">
              {filteredBooks.map((book) => (
                <div key={book.id} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm flex flex-col justify-between space-y-3 shadow-xs">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-navy-accent text-[13px]">{book.id}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${
                        book.status === 'AVAILABLE' ? 'text-forest-status border-forest-status/30 bg-emerald-50' :
                        book.status === 'RESERVED' ? 'text-amber-800 border-amber-300 bg-amber-50' : 'text-slate-gray border-charcoal/20 bg-gray-100'
                      }`}>
                        {book.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-charcoal text-sm leading-snug">{book.title}</h4>
                    <p className="text-slate-gray text-[13px]">Author: {book.author}</p>
                    <div className="flex justify-between text-[13px] text-charcoal/80 pt-1 border-t border-charcoal/10">
                      <span>Category: <strong>{book.category}</strong></span>
                      <span>Location: <strong>{book.location}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleBookReserve(book.id)}
                    disabled={book.status !== 'AVAILABLE'}
                    className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center justify-center gap-1.5 transition-colors ${
                      reservedBooks.includes(book.id)
                        ? 'bg-emerald-600 text-white'
                        : book.status === 'AVAILABLE'
                        ? 'bg-navy-accent hover:bg-charcoal text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    {reservedBooks.includes(book.id) ? 'Reserved ✓' : book.status === 'AVAILABLE' ? 'Reserve Book' : 'Unavailable'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: PLACEMENTS & CAREER DRIVES */}
      {activeSubTab === 'placement' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-navy-accent" /> Institutional Placement & Career Cell (Module 12)
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">Corporate recruitment drives, job applications, and interview scheduling.</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-mono text-xs font-bold px-3 py-1 rounded-xs">
              CAMPUS HIGHEST: ₹44.0 LPA
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {PLACEMENT_DRIVES.map((drive) => (
              <div key={drive.company} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-4 shadow-xs">
                <div className="flex justify-between items-start border-b border-charcoal/10 pb-3">
                  <div>
                    <h4 className="font-bold text-base text-charcoal">{drive.company}</h4>
                    <p className="text-navy-accent font-semibold">{drive.role}</p>
                  </div>
                  <span className="bg-navy-accent text-white font-bold px-2.5 py-1 text-xs rounded-xs">
                    {drive.package}
                  </span>
                </div>

                <div className="space-y-1.5 text-slate-gray">
                  <div className="flex justify-between"><span>Criteria:</span><strong className="text-charcoal">{drive.eligibility}</strong></div>
                  <div className="flex justify-between"><span>Deadline:</span><strong className="text-amber-800">{drive.deadline}</strong></div>
                </div>

                <div className="pt-2 border-t border-charcoal/10 flex justify-between items-center">
                  <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${
                    drive.status === 'SHORTLISTED' ? 'text-purple-800 border-purple-300 bg-purple-50' : 'text-emerald-800 border-emerald-300 bg-emerald-50'
                  }`}>
                    STATUS: {appliedJobs.includes(drive.company) ? 'APPLICATION SUBMITTED' : drive.status}
                  </span>

                  <button
                    onClick={() => handleApplyJob(drive.company)}
                    disabled={appliedJobs.includes(drive.company)}
                    className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xs flex items-center gap-1.5 transition-colors ${
                      appliedJobs.includes(drive.company)
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-navy-accent hover:bg-charcoal text-white'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {appliedJobs.includes(drive.company) ? 'Applied' : 'Apply Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
