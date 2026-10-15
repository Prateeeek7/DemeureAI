import React, { useState, useEffect, lazy, Suspense } from 'react';
import { LayoutDashboard, Users, Zap, Shield, AlertTriangle, Utensils, Heart, MessageSquare, LogOut, ClipboardList, CreditCard, Cloud, GraduationCap, Building2, Landmark, IdCard, Search } from 'lucide-react';
import EditorialLanding from './EditorialLanding';
// Modules are code-split so each role only downloads the screens it opens.
const RoomAllocation = lazy(() => import('./RoomAllocation'));
const PowerMonitor = lazy(() => import('./PowerMonitor'));
const SecurityConsole = lazy(() => import('./SecurityConsole'));
const ComplaintDesk = lazy(() => import('./ComplaintDesk'));
const MessPlanner = lazy(() => import('./MessPlanner'));
const WelfareDashboard = lazy(() => import('./WelfareDashboard'));
const VirtualAssistant = lazy(() => import('./VirtualAssistant'));
const StudentSurveyForm = lazy(() => import('./StudentSurveyForm'));
const StudentPortal = lazy(() => import('./StudentPortal'));
const AWSConsoleHub = lazy(() => import('./AWSConsoleHub'));
const AcademicStudentHub = lazy(() => import('./AcademicStudentHub'));
const FacilitiesTransportHub = lazy(() => import('./FacilitiesTransportHub'));
const CampusOperationsHub = lazy(() => import('./CampusOperationsHub'));
const StudentDirectory = lazy(() => import('./StudentDirectory'));
const PeopleDirectory = lazy(() => import('./PeopleDirectory'));
import { api, errorMessage, UNAUTHORIZED_EVENT } from '../lib/api';
import { SessionContext, SHOW_DEMO_CREDENTIALS, type SessionUser } from '../lib/session';

type Role = 'CampusAdmin' | 'HostelAdmin' | 'Admin' | 'Warden' | 'MessManager' | 'Student' | 'Faculty';

interface Health {
  env: string;
  storage: string;
  awsLive: boolean;
  assistant: string;
}

const DEMO_PINS: Partial<Record<Role, string>> = {
  CampusAdmin: '0000-0000-0000',
  HostelAdmin: '1111-1111-1111',
  MessManager: '2222-2222-2222',
};

const landingTabFor = (role: Role) =>
  role === 'Student' ? 'studentPortal' : role === 'HostelAdmin' ? 'rooms' : role === 'MessManager' ? 'mess'
    : role === 'Faculty' ? 'academic' : 'telemetry';

// Example employee IDs for each staff role (demo data; every seeded staff PIN is 246810).
const DEMO_IDS: Partial<Record<Role, string>> = {
  CampusAdmin: 'STF2001', HostelAdmin: 'WDN101', MessManager: 'STF2005', Faculty: 'FAC1001',
};

export default function DashboardLayout() {
  const [currentRole, setCurrentRole] = useState<Role>('Student');
  const [activeTab, setActiveTab] = useState<string>('telemetry');
  const [time, setTime] = useState<string>('');
  const [showExitLanding, setShowExitLanding] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [booting, setBooting] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const hasAuthenticated = user !== null;

  // Authentication Overlay states
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [staffMode, setStaffMode] = useState<'id' | 'master'>('id');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [studentEmailInput, setStudentEmailInput] = useState('');
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [authError, setAuthError] = useState('');

  const startSession = (sessionUser: SessionUser) => {
    setUser(sessionUser);
    setCurrentRole(sessionUser.role);
    setActiveTab(landingTabFor(sessionUser.role));
    setPendingRole(null);
    setShowExitLanding(false);
  };

  const endSession = () => {
    setUser(null);
    setCurrentRole('Student');
    setShowExitLanding(true);
    setPendingRole(null);
  };

  // Restore an existing session on load, and drop back to the landing page when it expires.
  useEffect(() => {
    api.get<{ user: SessionUser | null }>('/api/auth/session')
      .then(({ user: existing }) => { if (existing) startSession(existing); }, () => undefined)
      .finally(() => setBooting(false));
    window.addEventListener(UNAUTHORIZED_EVENT, endSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, endSession);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get<Health>('/api/health').then(setHealth, () => setHealth(null));
  }, [user]);

  // Live Clock effect
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString() + ' | ' + now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigationTabs = [
    { id: 'telemetry', label: 'Overview Telemetry', icon: LayoutDashboard, roles: ['CampusAdmin', 'HostelAdmin', 'Admin', 'Warden', 'MessManager', 'Student', 'Faculty'] },
    { id: 'academic', label: 'Academic & Student Hub', icon: GraduationCap, roles: ['CampusAdmin', 'Admin', 'Student', 'Faculty'] },
    { id: 'facilities', label: 'Facilities & Fleet Hub', icon: Building2, roles: ['CampusAdmin', 'Admin', 'Faculty', 'Student'] },
    { id: 'campusOps', label: 'Finance & Campus Life', icon: Landmark, roles: ['CampusAdmin', 'Admin', 'Student'] },
    { id: 'people', label: currentRole === 'Student' ? 'Faculty & Warden Search' : 'People Search', icon: Search, roles: ['CampusAdmin', 'HostelAdmin', 'MessManager', 'Faculty', 'Student'] },
    { id: 'directory', label: 'Resident Directory', icon: IdCard, roles: ['CampusAdmin', 'HostelAdmin', 'Admin', 'Warden'] },
    { id: 'rooms', label: 'Hostel Room Allocation', icon: Users, roles: ['HostelAdmin', 'Warden'] },
    { id: 'survey', label: 'Student Survey Form', icon: ClipboardList, roles: ['HostelAdmin', 'Warden', 'Student'] },
    { id: 'power', label: 'Power Grid Diagnostics', icon: Zap, roles: ['CampusAdmin', 'Admin'] },
    { id: 'security', label: 'Hostel Security SOC Gate', icon: Shield, roles: ['HostelAdmin', 'Warden'] },
    { id: 'complaints', label: 'NLP Complaint Desk', icon: AlertTriangle, roles: ['CampusAdmin', 'HostelAdmin', 'Admin', 'Warden', 'Student'] },
    { id: 'mess', label: 'Mess & Food Optimizer', icon: Utensils, roles: ['MessManager', 'Student'] },
    { id: 'welfare', label: 'Hostel Welfare Operations', icon: Heart, roles: ['HostelAdmin', 'Warden'] },
    { id: 'studentPortal', label: 'Student Services', icon: CreditCard, roles: ['Student'] },
    { id: 'assistant', label: 'AI Handbook RAG', icon: MessageSquare, roles: ['CampusAdmin', 'HostelAdmin', 'Admin', 'Warden', 'MessManager', 'Student', 'Faculty'] },
    { id: 'aws', label: 'AWS Console Hub', icon: Cloud, roles: ['CampusAdmin', 'Admin'] },
  ];

  // Helper to check authorization
  const isAuthorized = (tabRoles: string[]) => {
    return tabRoles.includes(currentRole);
  };

  const selectTab = (id: string, tabRoles: string[]) => {
    if (isAuthorized(tabRoles)) {
      setActiveTab(id);
    }
  };

  const renderAuthOverlay = () => {
    if (!pendingRole) return null;

    const roleName = (pendingRole === 'CampusAdmin' || pendingRole === 'Admin') 
      ? 'Campus Administrator (Campus OS)' 
      : (pendingRole === 'HostelAdmin' || pendingRole === 'Warden')
      ? 'Hostel Administrator / Warden (Hostel OS)' 
      : pendingRole === 'Faculty' ? 'Faculty Member' : 'Mess Manager';
    const idMode = pendingRole === 'Faculty' || staffMode === 'id';
    const maxDigits = idMode ? 6 : 12;
      
    const demoPin = DEMO_PINS[pendingRole] ?? '';

    const formatAndSetCode = (val: string) => {
      let formatted = '';
      for (let i = 0; i < val.length; i++) {
        if (!idMode && (i === 4 || i === 8)) {
          formatted += '-';
        }
        formatted += val[i];
      }
      setAuthCodeInput(formatted);
      setAuthError('');
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > maxDigits) val = val.substring(0, maxDigits);
      formatAndSetCode(val);
    };

    const handleKeypadPress = (num: string) => {
      let val = authCodeInput.replace(/\D/g, '');
      if (val.length < maxDigits) {
        val += num;
        formatAndSetCode(val);
      }
    };

    const handleBackspace = () => {
      let val = authCodeInput.replace(/\D/g, '');
      if (val.length > 0) {
        val = val.slice(0, -1);
        formatAndSetCode(val);
      }
    };

    const handleClear = () => {
      setAuthCodeInput('');
      setAuthError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const isStudent = pendingRole === 'Student';
      if (!isStudent && idMode && !employeeIdInput.trim()) {
        setAuthError('ENTER YOUR EMPLOYEE ID');
        return;
      }
      if (!isStudent && authCodeInput.replace(/\D/g, '').length !== maxDigits) {
        setAuthError(idMode ? 'ENTER YOUR 6-DIGIT PIN' : 'ENTER THE FULL 12-DIGIT MASTER PIN');
        return;
      }
      setAuthBusy(true);
      setAuthError('');
      try {
        const sessionUser = await api.post<SessionUser>('/api/auth/login', isStudent
          ? { role: 'Student', email: studentEmailInput.trim(), secret: studentCodeInput.trim() }
          : idMode
            ? { role: pendingRole, employeeId: employeeIdInput.trim(), secret: authCodeInput }
            : { role: pendingRole, secret: authCodeInput });
        setEmployeeIdInput('');
        setAuthCodeInput('');
        setStudentEmailInput('');
        setStudentCodeInput('');
        startSession(sessionUser);
      } catch (err) {
        const message = errorMessage(err);
        setAuthError(message === 'Invalid credentials'
          ? (isStudent ? 'INVALID CREDENTIALS // AUTHENTICATION REVOKED' : 'INVALID SECURITY SIGNATURE // AUTHENTICATION REVOKED')
          : message.toUpperCase());
      } finally {
        setAuthBusy(false);
      }
    };

    if (pendingRole === 'Student') {
      return (
        <div className="fixed inset-0 bg-charcoal/90 z-50 flex items-center justify-center p-4">
          <div className="bg-warm-ivory border border-charcoal/20 w-full max-w-sm p-6 font-mono text-xs text-charcoal space-y-6 blueprint-grid-accent">
            <div className="border-b border-charcoal/10 pb-3 flex justify-between items-center bg-surface-white/80 p-2">
              <span className="font-bold text-navy-accent uppercase text-xs tracking-wider">STUDENT AUTHENTICATION</span>
              <span className="text-xs text-red-700 animate-pulse-dot font-bold">LOCKED</span>
            </div>

            <div className="text-[13px] leading-relaxed text-slate-gray p-2 border-l-2 border-navy-accent space-y-1">
              <p>Enter your institutional email and the secure access code sent to your inbox.</p>
              {SHOW_DEMO_CREDENTIALS && (
                <p className="text-xs text-navy-accent font-bold">Demo Student: <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">pratik2024@vit.student.ac.in</code> / <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">VIT2024</code></p>
              )}
              {SHOW_DEMO_CREDENTIALS && (
                <p className="text-xs text-navy-accent font-bold">Any of the 100 seeded residents, e.g. <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">naveen.reddy@demeure.ac.in</code> / <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">VIT2026</code></p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs uppercase text-slate-gray mb-1">Institutional Email</label>
                  <input
                    type="email"
                    required
                    placeholder="you@vit.student.ac.in"
                    autoComplete="username"
                    value={studentEmailInput}
                    onChange={(e) => setStudentEmailInput(e.target.value)}
                    className="w-full bg-surface-white border border-charcoal/20 p-2 font-mono text-[13px] outline-none focus:border-navy-accent placeholder:text-navy-accent/50 font-medium"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-slate-gray mb-1">Access Code (from email)</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={studentCodeInput}
                    onChange={(e) => setStudentCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-surface-white border border-charcoal/20 p-2 font-mono text-[13px] outline-none focus:border-navy-accent placeholder:text-navy-accent/50 tracking-widest font-medium"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-2.5 border border-red-700/20 bg-red-50/10 text-red-700 text-center font-bold text-xs uppercase tracking-wider animate-pulse">
                  {authError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExitLanding(true);
                    setPendingRole(null);
                    setStudentEmailInput('');
                    setStudentCodeInput('');
                    setAuthError('');
                  }}
                  className="flex-1 bg-surface-white border border-charcoal/10 hover:bg-charcoal/5 py-2.5 uppercase tracking-wider text-xs"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="flex-1 bg-navy-accent hover:bg-charcoal text-surface-white py-2.5 uppercase tracking-wider text-xs disabled:opacity-50"
                >
                  {authBusy ? 'Verifying...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-charcoal/90 z-50 flex items-center justify-center p-4">
        <div className="bg-warm-ivory border border-charcoal/20 w-full max-w-sm p-6 font-mono text-xs text-charcoal space-y-6 blueprint-grid-accent">
          <div className="border-b border-charcoal/10 pb-3 flex justify-between items-center bg-surface-white/80 p-2">
            <span className="font-bold text-navy-accent uppercase text-xs tracking-wider">OS SECURE CHANNEL AUTH</span>
            <span className="text-xs text-red-700 animate-pulse-dot font-bold">LOCKED</span>
          </div>

          <div className="text-[13px] leading-relaxed text-slate-gray p-2 border-l-2 border-navy-accent space-y-1">
            <p>Sign in as <strong>{roleName}</strong> {idMode ? 'with your employee ID and personal PIN.' : 'with the shared master PIN.'}</p>
            {SHOW_DEMO_CREDENTIALS && idMode && DEMO_IDS[pendingRole] && (
              <p className="text-xs text-navy-accent font-bold">Demo: <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">{DEMO_IDS[pendingRole]}</code> / PIN <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">246810</code></p>
            )}
            {SHOW_DEMO_CREDENTIALS && !idMode && demoPin && (
              <p className="text-xs text-navy-accent font-bold">Demo master PIN: <code className="bg-navy-accent/10 px-1 py-0.5 rounded select-all">{demoPin}</code></p>
            )}
          </div>

          {pendingRole !== 'Faculty' && (
            <div className="grid grid-cols-2 border border-charcoal/15 text-xs uppercase tracking-wider" role="tablist" aria-label="Sign-in method">
              {(['id', 'master'] as const).map(mode => (
                <button key={mode} type="button" role="tab" aria-selected={staffMode === mode}
                  onClick={() => { setStaffMode(mode); setAuthCodeInput(''); setAuthError(''); }}
                  className={`py-2 font-bold ${staffMode === mode ? 'bg-navy-accent text-surface-white' : 'bg-surface-white text-charcoal hover:bg-charcoal/5'}`}>
                  {mode === 'id' ? 'Employee ID' : 'Master PIN'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {idMode && (
              <input
                type="text"
                autoComplete="username"
                aria-label="Employee ID"
                placeholder={`Employee ID, e.g. ${DEMO_IDS[pendingRole] ?? 'STF2001'}`}
                value={employeeIdInput}
                onChange={e => { setEmployeeIdInput(e.target.value.toUpperCase()); setAuthError(''); }}
                className="w-full bg-surface-white border border-charcoal/20 p-3 text-center text-base font-bold tracking-widest text-charcoal outline-none focus:border-navy-accent placeholder:text-slate-gray placeholder:font-normal placeholder:tracking-normal"
                maxLength={12}
                autoFocus
              />
            )}
            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label="Access PIN"
                placeholder={idMode ? '6-digit PIN' : '____-____-____'}
                value={authCodeInput}
                onChange={handleCodeChange}
                className="w-full bg-surface-white border border-charcoal/20 p-3 text-center text-lg font-bold tracking-widest text-navy-accent outline-none focus:border-navy-accent placeholder:text-navy-accent/40 uppercase"
                maxLength={idMode ? 6 : 14}
                autoFocus={!idMode}
              />
            </div>

            {/* Unique Keypad Grid */}
            <div className="grid grid-cols-3 gap-2 bg-surface-white/60 p-2 border border-charcoal/5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num)}
                  className="bg-surface-white border border-charcoal/10 py-3 font-bold hover:bg-navy-accent hover:text-surface-white transition-colors"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="bg-red-50 text-red-700 border border-charcoal/10 py-3 hover:bg-red-700 hover:text-surface-white transition-colors"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="bg-surface-white border border-charcoal/10 py-3 font-bold hover:bg-navy-accent hover:text-surface-white transition-colors"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className="bg-surface-white border border-charcoal/10 py-3 hover:bg-navy-accent hover:text-surface-white transition-colors flex items-center justify-center font-bold"
              >
                ←
              </button>
            </div>

            {authError && (
              <div className="p-2.5 border border-red-700/20 bg-red-50/10 text-red-700 text-center font-bold text-xs uppercase tracking-wider animate-pulse">
                {authError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowExitLanding(true);
                  setPendingRole(null);
                  setAuthCodeInput('');
                  setAuthError('');
                }}
                className="flex-1 bg-surface-white border border-charcoal/10 hover:bg-charcoal/5 py-2.5 uppercase tracking-wider text-xs"
              >
                Abort
              </button>
              <button
                type="submit"
                disabled={authBusy}
                className="flex-1 bg-navy-accent hover:bg-charcoal text-surface-white py-2.5 uppercase tracking-wider text-xs disabled:opacity-50"
              >
                {authBusy ? 'Verifying...' : 'Verify Key'}
              </button>
            </div>
          </form>

          <div className="border-t border-charcoal/10 pt-2 flex justify-between text-xs text-slate-gray px-1">
            <span>CIPHER: AES-GCM-256</span>
            <span>OS: DEMEURE.CORE</span>
          </div>
        </div>
      </div>
    );
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-warm-ivory flex items-center justify-center font-mono text-xs text-slate-gray uppercase tracking-wider">
        Establishing secure session...
      </div>
    );
  }

  if (showExitLanding) {
    return (
      <EditorialLanding
        onEnterConsole={(role) => {
          setPendingRole(role);
          setStaffMode('id');
          setEmployeeIdInput('');
          setAuthCodeInput('');
          setShowExitLanding(false);
        }}
      />
    );
  }

  // Nothing renders behind the sign-in dialog until the server has authenticated the user.
  if (!hasAuthenticated) {
    return <div className="min-h-screen bg-warm-ivory blueprint-grid-accent">{renderAuthOverlay()}</div>;
  }

  return (
    <SessionContext.Provider value={user}>
    <div className="flex flex-col min-h-screen bg-warm-ivory text-charcoal font-sans">

      {/* SYSTEM VITALS HEADER BAR */}
      <header className="bg-surface-white border-b border-charcoal/10 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-serif text-xl font-bold tracking-tight text-navy-accent">DEMEURE AI // COMMAND</span>
            <span className="font-mono text-xs text-slate-gray tracking-wider uppercase">Institutional Campus OS</span>
          </div>
          <div className="hidden sm:flex border-l border-charcoal/10 pl-4 items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-xs text-forest-status bg-forest-status/5 px-2 py-0.5 border border-forest-status/20">
              <span className="w-1.5 h-1.5 bg-forest-status rounded-full inline-block animate-pulse-dot"></span>
              CORE STATE: OPERATIONAL
            </span>
          </div>
        </div>

        {/* Live details, role switch, and return buttons */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <div className="text-slate-gray text-xs hidden md:block">
            {time}
          </div>

          <div className="flex items-center gap-3">
            <form
              className="hidden lg:flex items-center gap-2 border border-charcoal/20 bg-surface-white px-2 py-1 focus-within:border-navy-accent"
              onSubmit={e => { e.preventDefault(); setPeopleQuery(headerSearch.trim()); setActiveTab('people'); }}
            >
              <Search className="w-4 h-4 text-slate-gray" />
              <input
                aria-label="Quick people search"
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                placeholder={currentRole === 'Student' ? 'Find faculty by name or ID' : 'Find anyone by name or ID'}
                className="bg-transparent outline-none font-mono text-xs w-48 text-charcoal"
              />
            </form>
            <div className="flex items-center gap-2">
              <div className="text-right leading-tight hidden md:block">
                <div className="font-semibold text-charcoal text-sm">{user.name}</div>
                {user.ref && <div className="font-mono text-xs text-slate-gray">{user.ref}</div>}
              </div>
              <span className="bg-navy-accent/10 text-navy-accent font-bold px-2.5 py-1 text-[13px] rounded-xs border border-navy-accent/20 uppercase font-mono">
                {currentRole === 'CampusAdmin' || currentRole === 'Admin' 
                  ? 'Campus Administrator' 
                  : currentRole === 'HostelAdmin' || currentRole === 'Warden' 
                  ? 'Hostel Administrator' 
                  : currentRole === 'MessManager' 
                  ? 'Mess Manager' 
                  : currentRole === 'Faculty' 
                  ? 'Faculty Member' 
                  : 'Resident Student'}
              </span>
            </div>

            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-700 hover:text-white px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider transition-colors rounded-xs shadow-xs"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex flex-col md:flex-row">

        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 bg-surface-white border-b md:border-b-0 md:border-r border-charcoal/10 p-4 space-y-4">
          <div className="font-mono text-xs text-slate-gray uppercase border-b border-charcoal/5 pb-2">
            System Sub-Protocols
          </div>

          <nav className="space-y-1">
            {navigationTabs
              .filter((tab) => isAuthorized(tab.roles))
              .map((tab) => {
                const isSelected = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => selectTab(tab.id, tab.roles)}
                    className={`w-full flex items-center justify-between p-3 transition-colors ${
                      isSelected
                        ? 'bg-navy-accent text-surface-white font-semibold'
                        : 'text-charcoal hover:bg-warm-ivory bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <tab.icon className={`w-4 h-4 ${isSelected ? 'text-surface-white' : 'text-slate-gray'}`} />
                      <span className="font-mono text-xs uppercase tracking-wider text-left">{tab.label}</span>
                    </div>
                  </button>
                );
              })}
          </nav>

          {/* Sidebar footer telemetry */}
          <div className="pt-8 border-t border-charcoal/5 font-mono text-xs text-slate-gray space-y-1 hidden md:block">
            <div>HOSTEL ID: DE-DELHI-09</div>
            <div>STITCH_NODE: ACTIVE</div>
            <div>VER: 1.0.4 // LTS</div>
          </div>
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          <div className="bg-surface-white border border-charcoal/10 p-6 md:p-8">

            {activeTab === 'telemetry' && (
              <div className="space-y-8">
                {/* Dashboard Summary Header */}
                <div className="border-b border-charcoal/10 pb-4">
                  <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 00</span>
                  <h2 className="font-serif text-3xl font-bold text-navy-accent">Demeure AI: Operational Vitals Overview</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Summary of modules */}
                  <div className="space-y-6">
                    <h3 className="font-serif text-xl font-bold text-charcoal">System Command Center</h3>
                    <p className="text-sm text-slate-gray leading-relaxed font-mono">
                      Welcome to the Demeure AI platform console, {user.name}. The modules in the sidebar are scoped to your role; every action is authorised and persisted by the Demeure core service.
                    </p>

                    <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-3 font-mono text-xs">
                      <div className="font-bold text-navy-accent uppercase">Current Session Diagnostics</div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>User Role:</span><span className="font-bold text-charcoal">{currentRole}</span></div>
                        {currentRole === 'CampusAdmin' && (
                          <>
                            <div className="flex justify-between"><span>Environment:</span><span className="uppercase">{health?.env ?? '—'}</span></div>
                            <div className="flex justify-between"><span>Data Store:</span><span className="uppercase">{health ? (health.storage === 'dynamodb' ? 'DynamoDB (AWS)' : 'Local SQLite') : '—'}</span></div>
                            <div className="flex justify-between"><span>AWS Services:</span><span className={health?.awsLive ? 'text-forest-status' : 'text-slate-gray'}>{health ? (health.awsLive ? 'LIVE' : 'MOCK MODE') : '—'}</span></div>
                          </>
                        )}
                        <div className="flex justify-between"><span>Handbook Assistant:</span><span className={health?.assistant === 'ready' ? 'text-forest-status' : 'text-amber-700'}>{health?.assistant?.toUpperCase() ?? '—'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual illustration mockup (Architectural style) */}
                  {/* Right Column: Visual CAD blueprint illustration */}
                  <div className="border border-charcoal/10 bg-[#0d131f] p-2 relative flex flex-col justify-between h-[300px] overflow-hidden">
                    <img 
                      src="/Inside%20img.png" 
                      alt="System Topology Blueprint" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Subsystem status indicators (operations staff only) */}
                {(currentRole === 'CampusAdmin' || currentRole === 'HostelAdmin') && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-charcoal/5 font-mono text-[13px]">
                  <div className="p-3 border border-charcoal/10 bg-warm-ivory flex justify-between items-center">
                    <span>BIOMETRICS SECURE</span>
                    <span className="text-forest-status">100%</span>
                  </div>
                  <div className="p-3 border border-charcoal/10 bg-warm-ivory flex justify-between items-center">
                    <span>MESS OPTIMIZATION</span>
                    <span className="text-forest-status">ACTIVE</span>
                  </div>
                  <div className="p-3 border border-charcoal/10 bg-warm-ivory flex justify-between items-center">
                    <span>NLP CLASSIFIER</span>
                    <span className="text-forest-status">ONLINE</span>
                  </div>
                  <div className="p-3 border border-charcoal/10 bg-warm-ivory flex justify-between items-center">
                    <span>POWER ANOMALIES</span>
                    <span className="text-red-700">1 ALERT</span>
                  </div>
                </div>}
              </div>
            )}

            <Suspense fallback={<div className="font-mono text-xs text-slate-gray uppercase tracking-wider p-8 text-center">Loading module...</div>}>
            {activeTab === 'academic' && <AcademicStudentHub />}
            {activeTab === 'facilities' && <FacilitiesTransportHub currentRole={currentRole} />}
            {activeTab === 'campusOps' && <CampusOperationsHub currentRole={currentRole} />}
            {activeTab === 'directory' && <StudentDirectory />}
            {activeTab === 'people' && <PeopleDirectory initialQuery={peopleQuery} key={peopleQuery} />}
            {activeTab === 'rooms' && <RoomAllocation />}
            {activeTab === 'survey' && <StudentSurveyForm currentRole={currentRole} />}
            {activeTab === 'power' && <PowerMonitor />}
            {activeTab === 'security' && <SecurityConsole />}
            {activeTab === 'complaints' && <ComplaintDesk />}
            {activeTab === 'mess' && <MessPlanner currentRole={currentRole} />}
            {activeTab === 'welfare' && <WelfareDashboard />}
            {activeTab === 'studentPortal' && <StudentPortal />}
            {activeTab === 'assistant' && <VirtualAssistant />}
            {activeTab === 'aws' && <AWSConsoleHub />}
            </Suspense>

          </div>
        </main>
      </div>

      {activeTab === 'telemetry' && (
        <footer style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #060a12 100%)', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="text-warm-ivory px-6 pt-16 pb-8 z-10">

          {/* Top accent rule */}
          <div className="max-w-7xl mx-auto">
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #1E3A5F, #4B8BFF, #1E3A5F, transparent)', marginBottom: '3rem' }} />
          </div>

          {/* Main brand hero */}
          <div className="max-w-7xl mx-auto mb-14">
            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-[0.4em] text-slate-gray block">Intelligent Campus Infrastructure</span>
              <h2
                className="font-bold select-none leading-none tracking-tighter text-surface-white"
                style={{
                  fontSize: 'clamp(3.5rem, 10vw, 8rem)',
                  letterSpacing: '-0.03em',
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  textShadow: '0 0 80px rgba(78, 139, 255, 0.15)',
                }}
              >
                DEMEURE
                <span style={{ color: '#4B8BFF', marginLeft: '0.2em' }}>AI</span>
              </h2>
            </div>
          </div>

          {/* Info grid */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
            {/* Description */}
            <div className="md:col-span-5 space-y-4">
              <p className="font-mono text-xs leading-relaxed max-w-sm" style={{ color: '#A3ACB9' }}>
                A unified campus infrastructure platform integrating background telemetry, real-time ML diagnostics, biometric gate liveness, and quantitative food optimization models.
              </p>
              <div className="flex gap-3 flex-wrap">
                {['Admin Portal', 'Student Hub', 'Warden Console'].map(tag => (
                  <span key={tag} className="font-mono text-xs uppercase tracking-widest px-2.5 py-1 rounded-sm" style={{ border: '1px solid rgba(75,139,255,0.25)', color: '#4B8BFF', background: 'rgba(75,139,255,0.05)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Diagnostics */}
            <div className="md:col-span-4 space-y-3 font-mono text-xs">
              <div className="text-xs uppercase tracking-[0.3em] pb-2 font-bold" style={{ color: '#A3ACB9', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Active Diagnostics</div>
              <div className="space-y-2.5">
                {[
                  { label: 'Biometrics Gate (SOC-G1)', status: 'ONLINE', color: '#22c55e' },
                  { label: 'Power Forest Inference', status: 'STABLE', color: '#22c55e' },
                  { label: 'Dietary Waste Calibration', status: 'CALIBRATING', color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span style={{ color: '#9CA3AF' }}>{item.label}</span>
                    <span className="font-bold text-xs" style={{ color: item.color }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* System Specs */}
            <div className="md:col-span-3 space-y-3 font-mono text-xs">
              <div className="text-xs uppercase tracking-[0.3em] pb-2 font-bold" style={{ color: '#A3ACB9', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>System Specs</div>
              <div className="space-y-2">
                {[
                  ['VERSION', '1.0.4 LTS'],
                  ['STITCH NODE', 'ACTIVE'],
                  ['HOSTEL ID', 'DE-DELHI-09'],
                  ['UPTIME', '99.97%'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: '#A3ACB9' }}>{k}</span>
                    <span style={{ color: '#E5E7EB' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom rule & copyright */}
          <div className="max-w-7xl mx-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <span className="font-mono text-xs" style={{ color: '#8B95A3' }}>
                © 2026 DEMEURE AI. ALL PROTOCOLS ENFORCED. BUILT FOR INSTITUTIONAL EXCELLENCE.
              </span>
              <span className="font-mono text-xs" style={{ color: '#8B95A3' }}>
                POWERED BY GEMINI AI · STITCH DESIGN SYSTEM
              </span>
            </div>
          </div>
        </footer>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-white border border-charcoal/20 max-w-md w-full p-6 space-y-4 shadow-xl rounded-sm font-mono">
            <div className="flex items-center gap-2 border-b border-charcoal/10 pb-3">
              <LogOut className="w-5 h-5 text-rose-700" />
              <h3 className="font-serif font-bold text-lg text-charcoal">Confirm Sign Out</h3>
            </div>
            <p className="text-xs text-charcoal/80 leading-relaxed font-medium">
              Are you sure you want to sign out? You will end your session as <strong>{
                currentRole === 'CampusAdmin' || currentRole === 'Admin' ? 'Campus Administrator' :
                currentRole === 'HostelAdmin' || currentRole === 'Warden' ? 'Hostel Administrator' :
                currentRole === 'MessManager' ? 'Mess Manager' :
                currentRole === 'Faculty' ? 'Faculty Member' : 'Resident Student'
              }</strong> and return to the institutional landing page.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 border border-charcoal/20 text-charcoal hover:bg-warm-ivory text-xs font-bold uppercase rounded-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSignOutConfirm(false);
                  api.post('/api/auth/logout').catch(() => undefined).finally(endSession);
                }}
                className="px-4 py-2 bg-rose-700 hover:bg-charcoal text-white text-xs font-bold uppercase rounded-xs shadow-xs"
              >
                Confirm Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </SessionContext.Provider>
  );
}
