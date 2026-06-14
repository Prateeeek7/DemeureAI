import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Zap, Shield, AlertTriangle, Utensils, Heart, MessageSquare, ChevronRight, LogOut, ClipboardList, CreditCard } from 'lucide-react';
import RoomAllocation from './RoomAllocation';
import PowerMonitor from './PowerMonitor';
import SecurityConsole from './SecurityConsole';
import ComplaintDesk from './ComplaintDesk';
import MessPlanner from './MessPlanner';
import WelfareDashboard from './WelfareDashboard';
import VirtualAssistant from './VirtualAssistant';
import EditorialLanding from './EditorialLanding';
import StudentSurveyForm from './StudentSurveyForm';
import StudentPortal from './StudentPortal';
import type { SurveyEntry } from './StudentSurveyForm';

type Role = 'Admin' | 'Warden' | 'MessManager' | 'Student';

export default function DashboardLayout() {
  const [currentRole, setCurrentRole] = useState<Role>('Student');
  const [activeTab, setActiveTab] = useState<string>('telemetry');
  const [time, setTime] = useState<string>('');
  const [showExitLanding, setShowExitLanding] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasAuthenticated, setHasAuthenticated] = useState(false);

  // Authentication Overlay states
  const [pendingRole, setPendingRole] = useState<Role | null>(null);
  const [authCodeInput, setAuthCodeInput] = useState('');
  const [studentEmailInput, setStudentEmailInput] = useState('');
  const [studentCodeInput, setStudentCodeInput] = useState('');
  const [authError, setAuthError] = useState('');
  // Shared survey submissions — student fills form, admin sees responses live
  const [surveySubmissions, setSurveySubmissions] = useState<SurveyEntry[]>([]);

  const addSurveySubmission = (entry: SurveyEntry) =>
    setSurveySubmissions(prev => [entry, ...prev]);

  const removeSurveySubmission = (id: string) =>
    setSurveySubmissions(prev => prev.filter(e => e.id !== id));

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
    { id: 'telemetry', label: 'Overview Telemetry',    icon: LayoutDashboard, roles: ['Admin', 'Warden', 'MessManager', 'Student'] },
    { id: 'rooms',     label: 'Room Allocation',        icon: Users,           roles: ['Admin', 'Warden'] },
    { id: 'survey',    label: 'Student Survey Form',    icon: ClipboardList,   roles: ['Admin', 'Warden', 'Student'] },
    { id: 'power',     label: 'Power Grid Diagnostics', icon: Zap,             roles: ['Admin'] },
    { id: 'security',  label: 'Security SOC Gate',      icon: Shield,          roles: ['Admin', 'Warden'] },
    { id: 'complaints',label: 'NLP Complaint Desk',     icon: AlertTriangle,   roles: ['Admin', 'Warden', 'Student'] },
    { id: 'mess',      label: 'Mess & Food Optimizer',  icon: Utensils,        roles: ['Admin', 'MessManager', 'Student'] },
    { id: 'welfare',   label: 'Welfare Operations',     icon: Heart,           roles: ['Admin', 'Warden'] },
    { id: 'studentPortal', label: 'Student Services',   icon: CreditCard,      roles: ['Student'] },
    { id: 'assistant', label: 'AI Handbook RAG',        icon: MessageSquare,   roles: ['Admin', 'Warden', 'MessManager', 'Student'] },
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

    const roleName = pendingRole === 'Admin' ? 'Administrator' : pendingRole === 'Warden' ? 'Hostel Warden' : 'Mess Manager';
    const expectedCode = pendingRole === 'Admin' ? '0000-0000-0000' : pendingRole === 'Warden' ? '1111-1111-1111' : '2222-2222-2222';

    const formatAndSetCode = (val: string) => {
      let formatted = '';
      for (let i = 0; i < val.length; i++) {
        if (i === 4 || i === 8) {
          formatted += '-';
        }
        formatted += val[i];
      }
      setAuthCodeInput(formatted);
      setAuthError('');
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 12) val = val.substring(0, 12);
      formatAndSetCode(val);
    };

    const handleKeypadPress = (num: string) => {
      let val = authCodeInput.replace(/\D/g, '');
      if (val.length < 12) {
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

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (pendingRole === 'Student') {
        if (studentEmailInput === 'webforge@mit.edu' && studentCodeInput === 'MIT1122') {
          setCurrentRole(pendingRole);
          setPendingRole(null);
          setStudentEmailInput('');
          setStudentCodeInput('');
          setHasAuthenticated(true);
          // Reset active tab if unauthorized in the new role
          const newTabInfo = navigationTabs.find(t => t.id === activeTab);
          if (newTabInfo && !newTabInfo.roles.includes('Student')) {
            setActiveTab('telemetry');
          }
        } else {
          setAuthError('INVALID CREDENTIALS // AUTHENTICATION REVOKED');
        }
        return;
      }

      if (authCodeInput === expectedCode) {
        setCurrentRole(pendingRole);
        setPendingRole(null);
        setAuthCodeInput('');
        setHasAuthenticated(true);
        // Reset active tab if unauthorized in the new role
        const newTabInfo = navigationTabs.find(t => t.id === activeTab);
        if (newTabInfo && !newTabInfo.roles.includes(pendingRole)) {
            setActiveTab('telemetry');
        }
      } else {
        setAuthError('INVALID SECURITY SIGNATURE // AUTHENTICATION REVOKED');
      }
    };

    if (pendingRole === 'Student') {
      return (
        <div className="fixed inset-0 bg-charcoal/90 z-50 flex items-center justify-center p-4">
          <div className="bg-warm-ivory border border-charcoal/20 w-full max-w-sm p-6 font-mono text-xs text-charcoal space-y-6 blueprint-grid-accent">
            <div className="border-b border-charcoal/10 pb-3 flex justify-between items-center bg-surface-white/80 p-2">
              <span className="font-bold text-navy-accent uppercase text-[10px] tracking-wider">STUDENT AUTHENTICATION</span>
              <span className="text-[9px] text-red-700 animate-pulse-dot font-bold">LOCKED</span>
            </div>

            <div className="text-[11px] leading-relaxed text-slate-gray p-2 border-l-2 border-navy-accent">
              Enter your institutional email and the secure access code sent to your inbox.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase text-slate-gray mb-1">Institutional Email</label>
                  <input
                    type="email"
                    required
                    placeholder="webforge@mit.edu"
                    value={studentEmailInput}
                    onChange={(e) => setStudentEmailInput(e.target.value)}
                    className="w-full bg-surface-white border border-charcoal/10 p-2 font-mono text-[11px] outline-none focus:border-navy-accent placeholder-slate-gray/30"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-slate-gray mb-1">Access Code (from email)</label>
                  <input
                    type="text"
                    required
                    placeholder="MIT1122"
                    value={studentCodeInput}
                    onChange={(e) => setStudentCodeInput(e.target.value.toUpperCase())}
                    className="w-full bg-surface-white border border-charcoal/10 p-2 font-mono text-[11px] outline-none focus:border-navy-accent placeholder-slate-gray/30 tracking-widest"
                  />
                </div>
              </div>

              {authError && (
                <div className="p-2.5 border border-red-700/20 bg-red-50/10 text-red-700 text-center font-bold text-[9px] uppercase tracking-wider animate-pulse">
                  {authError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!hasAuthenticated) {
                      setShowExitLanding(true);
                      setPendingRole(null);
                    } else {
                      setPendingRole(null);
                      setStudentEmailInput('');
                      setStudentCodeInput('');
                      setAuthError('');
                    }
                  }}
                  className="flex-1 bg-surface-white border border-charcoal/10 hover:bg-charcoal/5 py-2.5 uppercase tracking-wider text-[10px]"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-navy-accent hover:bg-charcoal text-surface-white py-2.5 uppercase tracking-wider text-[10px]"
                >
                  Login
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
            <span className="font-bold text-navy-accent uppercase text-[10px] tracking-wider">OS SECURE CHANNEL AUTH</span>
            <span className="text-[9px] text-red-700 animate-pulse-dot font-bold">LOCKED</span>
          </div>

          <div className="text-[11px] leading-relaxed text-slate-gray p-2 border-l-2 border-navy-accent">
            Terminals require secure hardware key confirmation. Enter credentials for <strong>{roleName}</strong>.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={authCodeInput}
                onChange={handleCodeChange}
                className="w-full bg-surface-white border border-charcoal/10 p-3 text-center text-lg font-bold tracking-widest text-navy-accent outline-none focus:border-navy-accent placeholder-slate-gray/20 uppercase"
                maxLength={14}
                autoFocus
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
              <div className="p-2.5 border border-red-700/20 bg-red-50/10 text-red-700 text-center font-bold text-[9px] uppercase tracking-wider animate-pulse">
                {authError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!hasAuthenticated) {
                    setShowExitLanding(true);
                    setPendingRole(null);
                  } else {
                    setPendingRole(null);
                    setAuthCodeInput('');
                    setAuthError('');
                  }
                }}
                className="flex-1 bg-surface-white border border-charcoal/10 hover:bg-charcoal/5 py-2.5 uppercase tracking-wider text-[10px]"
              >
                Abort
              </button>
              <button
                type="submit"
                className="flex-1 bg-navy-accent hover:bg-charcoal text-surface-white py-2.5 uppercase tracking-wider text-[10px]"
              >
                Verify Key
              </button>
            </div>
          </form>

          <div className="border-t border-charcoal/10 pt-2 flex justify-between text-[8px] text-slate-gray px-1">
            <span>CIPHER: AES-GCM-256</span>
            <span>OS: DEMEURE.CORE</span>
          </div>
        </div>
      </div>
    );
  };

  if (showExitLanding) {
    return (
      <EditorialLanding
        onEnterConsole={(role) => {
          setPendingRole(role);
          setShowExitLanding(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-warm-ivory text-charcoal font-sans">
      
      {/* SYSTEM VITALS HEADER BAR */}
      <header className="bg-surface-white border-b border-charcoal/10 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-20">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-serif text-xl font-bold tracking-tight text-navy-accent">DEMEURE AI // COMMAND</span>
            <span className="font-mono text-[9px] text-slate-gray tracking-wider uppercase">Institutional Campus OS</span>
          </div>
          <div className="hidden sm:flex border-l border-charcoal/10 pl-4 items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-forest-status bg-forest-status/5 px-2 py-0.5 border border-forest-status/20">
              <span className="w-1.5 h-1.5 bg-forest-status rounded-full inline-block animate-pulse-dot"></span>
              CORE STATE: OPERATIONAL
            </span>
          </div>
        </div>

        {/* Live details, role switch, and return buttons */}
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <div className="text-slate-gray text-[10px] hidden md:block">
            {time}
          </div>
          
          <div className="flex items-center gap-2 relative">
            <span className="text-[10px] text-slate-gray uppercase">Persona:</span>
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-warm-ivory border border-charcoal/10 px-3 py-1.5 text-charcoal font-semibold text-[11px] hover:border-navy-accent flex items-center gap-1.5 uppercase font-mono tracking-wider"
              >
                <span>{currentRole === 'Admin' ? 'Administrator' : currentRole === 'Warden' ? 'Hostel Warden' : currentRole === 'MessManager' ? 'Mess Manager' : 'Resident Student'}</span>
                <span className="text-[9px] text-slate-gray">▼</span>
              </button>
              
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-surface-white border border-charcoal/10 z-50 flex flex-col font-mono text-[11px] uppercase tracking-wider">
                  {([
                    { value: 'Admin', label: 'Administrator' },
                    { value: 'Warden', label: 'Hostel Warden' },
                    { value: 'MessManager', label: 'Mess Manager' },
                    { value: 'Student', label: 'Resident Student' }
                  ] as { value: Role; label: string }[]).map((r) => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setPendingRole(r.value);
                        setAuthCodeInput('');
                        setStudentEmailInput('');
                        setStudentCodeInput('');
                        setAuthError('');
                      }}
                      className={`px-3 py-2 text-left w-full hover:bg-navy-accent hover:text-surface-white transition-colors ${
                        currentRole === r.value ? 'bg-warm-ivory font-bold' : ''
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowExitLanding(true)}
            className="flex items-center gap-1 border border-charcoal/10 px-2 py-1 hover:bg-charcoal/5 text-[10px] uppercase tracking-wider"
            title="Return to Storyboard"
          >
            <LogOut className="w-3.5 h-3.5" /> Storyboard
          </button>
        </div>
      </header>

      {/* CORE WORKSPACE PANEL */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full md:w-64 bg-surface-white border-b md:border-b-0 md:border-r border-charcoal/10 p-4 space-y-4">
          <div className="font-mono text-[10px] text-slate-gray uppercase border-b border-charcoal/5 pb-2">
            System Sub-Protocols
          </div>

          <nav className="space-y-1">
            {navigationTabs
              .filter((tab) => currentRole !== 'Student' || isAuthorized(tab.roles))
              .map((tab) => {
                const auth = isAuthorized(tab.roles);
                const isSelected = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => selectTab(tab.id, tab.roles)}
                  disabled={!auth}
                  className={`w-full flex items-center justify-between p-3 transition-colors ${
                    !auth 
                      ? 'opacity-30 cursor-not-allowed text-slate-gray bg-transparent' 
                      : isSelected
                        ? 'bg-navy-accent text-surface-white font-semibold'
                        : 'text-charcoal hover:bg-warm-ivory bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className={`w-4 h-4 ${isSelected ? 'text-surface-white' : 'text-slate-gray'}`} />
                    <span className="font-mono text-xs uppercase tracking-wider text-left">{tab.label}</span>
                  </div>
                  {!auth && <span className="text-[8px] border border-charcoal/20 px-1 font-bold">LOCKED</span>}
                  {auth && isSelected && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer telemetry */}
          <div className="pt-8 border-t border-charcoal/5 font-mono text-[9px] text-slate-gray space-y-1 hidden md:block">
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
                      Welcome to the Demeure AI platform console. Switch your persona in the top header to examine role-based access rules. This prototype simulates machine learning workflows (Isolation Forest, RAG, and NLP models) interacting seamlessly in an institutional operating environment.
                    </p>

                    <div className="border border-charcoal/10 bg-warm-ivory p-4 space-y-3 font-mono text-xs">
                      <div className="font-bold text-navy-accent uppercase">Current Session Diagnostics</div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>User Role:</span><span className="font-bold text-charcoal">{currentRole}</span></div>
                        <div className="flex justify-between"><span>Active Node ID:</span><span>SOC-G1-VITE</span></div>
                        <div className="flex justify-between"><span>Sandbox Environment:</span><span className="text-forest-status">SIMULATOR ACTIVE</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Visual illustration mockup (Architectural style) */}
                  <div className="border border-charcoal/10 bg-warm-ivory p-6 relative flex flex-col justify-between h-[300px] blueprint-grid">
                    <div className="font-mono text-[8px] text-slate-gray">SYS_LAYOUT // V0.4</div>
                    
                    <div className="flex-1 flex items-center justify-center p-4">
                      {/* Stylized structural layout representing data flow */}
                      <svg viewBox="0 0 300 150" className="w-full h-full text-navy-accent" stroke="currentColor" fill="none" strokeWidth="1">
                        <rect x="10" y="50" width="60" height="50" strokeWidth="1.5" />
                        <rect x="120" y="10" width="60" height="50" strokeWidth="1.5" />
                        <rect x="120" y="90" width="60" height="50" strokeWidth="1.5" />
                        <rect x="230" y="50" width="60" height="50" strokeWidth="1.5" />
                        
                        <path d="M 70,75 L 120,35" strokeDasharray="3 3" />
                        <path d="M 70,75 L 120,115" strokeDasharray="3 3" />
                        <path d="M 180,35 L 230,75" strokeDasharray="3 3" />
                        <path d="M 180,115 L 230,75" strokeDasharray="3 3" />

                        <text x="17" y="77" className="fill-navy-accent font-mono text-[7px] stroke-none">BIOMETRICS</text>
                        <text x="131" y="37" className="fill-navy-accent font-mono text-[7px] stroke-none">ML_POWER</text>
                        <text x="128" y="117" className="fill-navy-accent font-mono text-[7px] stroke-none">MESS_PLAN</text>
                        <text x="242" y="77" className="fill-navy-accent font-mono text-[7px] stroke-none">LEDGER</text>
                      </svg>
                    </div>

                    <div className="font-mono text-[9px] text-slate-gray text-center border-t border-charcoal/10 pt-2">
                      DEMEURE NETWORK NODES SIGNAL SUMMARY
                    </div>
                  </div>
                </div>

                {/* Subsystem status indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-charcoal/5 font-mono text-[11px]">
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
                </div>
              </div>
            )}

            {activeTab === 'rooms'      && <RoomAllocation />}
            {activeTab === 'survey' && (
              <StudentSurveyForm
                currentRole={currentRole}
                submissions={surveySubmissions}
                onAddSubmission={addSurveySubmission}
                onRemoveSubmission={removeSurveySubmission}
              />
            )}
            {activeTab === 'power'      && <PowerMonitor />}
            {activeTab === 'security'   && <SecurityConsole />}
            {activeTab === 'complaints' && <ComplaintDesk />}
            {activeTab === 'mess'       && <MessPlanner currentRole={currentRole} />}
            {activeTab === 'welfare'    && <WelfareDashboard />}
            {activeTab === 'studentPortal' && <StudentPortal />}
            {activeTab === 'assistant'  && <VirtualAssistant />}
            
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
              <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-slate-gray block">Intelligent Campus Infrastructure</span>
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
              <p className="font-mono text-xs leading-relaxed max-w-sm" style={{ color: '#6B7280' }}>
                A unified campus infrastructure platform integrating background telemetry, real-time ML diagnostics, biometric gate liveness, and quantitative food optimization models.
              </p>
              <div className="flex gap-3 flex-wrap">
                {['Admin Portal', 'Student Hub', 'Warden Console'].map(tag => (
                  <span key={tag} className="font-mono text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-sm" style={{ border: '1px solid rgba(75,139,255,0.25)', color: '#4B8BFF', background: 'rgba(75,139,255,0.05)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Diagnostics */}
            <div className="md:col-span-4 space-y-3 font-mono text-xs">
              <div className="text-[9px] uppercase tracking-[0.3em] pb-2 font-bold" style={{ color: '#6B7280', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>Active Diagnostics</div>
              <div className="space-y-2.5">
                {[
                  { label: 'Biometrics Gate (SOC-G1)', status: 'ONLINE', color: '#22c55e' },
                  { label: 'Power Forest Inference', status: 'STABLE', color: '#22c55e' },
                  { label: 'Dietary Waste Calibration', status: 'CALIBRATING', color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span style={{ color: '#9CA3AF' }}>{item.label}</span>
                    <span className="font-bold text-[10px]" style={{ color: item.color }}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* System Specs */}
            <div className="md:col-span-3 space-y-3 font-mono text-xs">
              <div className="text-[9px] uppercase tracking-[0.3em] pb-2 font-bold" style={{ color: '#6B7280', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>System Specs</div>
              <div className="space-y-2">
                {[
                  ['VERSION', '1.0.4 LTS'],
                  ['STITCH NODE', 'ACTIVE'],
                  ['HOSTEL ID', 'DE-DELHI-09'],
                  ['UPTIME', '99.97%'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: '#6B7280' }}>{k}</span>
                    <span style={{ color: '#E5E7EB' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom rule & copyright */}
          <div className="max-w-7xl mx-auto" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <span className="font-mono text-[10px]" style={{ color: '#4B5563' }}>
                © 2026 DEMEURE AI. ALL PROTOCOLS ENFORCED. BUILT FOR INSTITUTIONAL EXCELLENCE.
              </span>
              <span className="font-mono text-[10px]" style={{ color: '#4B5563' }}>
                POWERED BY GEMINI AI · STITCH DESIGN SYSTEM
              </span>
            </div>
          </div>
        </footer>
      )}

      {renderAuthOverlay()}
    </div>
  );
}
