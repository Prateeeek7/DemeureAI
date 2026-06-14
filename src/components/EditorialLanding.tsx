import React, { useState } from 'react';
import { Compass, Shield, Zap, Utensils, MessageSquare, ArrowRight, Activity, ClipboardList, Users, ShieldAlert, Cpu } from 'lucide-react';

interface EditorialLandingProps {
  onEnterConsole: (role: 'Admin' | 'Warden' | 'MessManager' | 'Student') => void;
}

export default function EditorialLanding({ onEnterConsole }: EditorialLandingProps) {
  const [activeTab, setActiveTab] = useState<'security' | 'energy' | 'mess' | 'welfare'>('security');
  const [isHovered, setIsHovered] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [randomCoords, setRandomCoords] = useState<{ x: number; y: number; lat: string; lng: string; id: number }[]>([]);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  React.useEffect(() => {
    if (!isHovered) {
      setRandomCoords([]);
      return;
    }

    const generateCoords = () => {
      const coordsCount = Math.floor(Math.random() * 3) + 3; // 3 to 5 coordinate points
      const newCoords = Array.from({ length: coordsCount }).map((_, idx) => {
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        const latVal = (28.6100 + Math.random() * 0.01).toFixed(4);
        const lngVal = (77.2000 + Math.random() * 0.01).toFixed(4);
        return {
          x,
          y,
          lat: `${latVal}° N`,
          lng: `${lngVal}° E`,
          id: Math.random()
        };
      });
      setRandomCoords(newCoords);
    };

    generateCoords();
    const interval = setInterval(generateCoords, 1000);
    return () => clearInterval(interval);
  }, [isHovered]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPos({ x, y });
  };

  return (
    <div className="w-full bg-warm-ivory text-charcoal min-h-screen font-sans">
      {/* 1. EDITORIAL HEADER */}
      <header className="border-b border-charcoal/10 px-8 py-6 flex justify-between items-center bg-surface-white">
        <div className="flex flex-col">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Institutional Digital Protocol</span>
          <span className="font-serif text-2xl font-bold tracking-tight text-navy-accent">DEMEURE AI</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-xs text-slate-gray">
          <span>LATITUDE: 28.6139° N</span>
          <span>LONGITUDE: 77.2090° E</span>
          <button 
            onClick={() => setShowRoleSelection(true)}
            className="bg-navy-accent text-surface-white px-4 py-2 hover:bg-charcoal transition-colors uppercase tracking-widest text-xs"
          >
            Access Core Command
          </button>
        </div>
      </header>

      {/* 2. HERO SECTION - Editorial Blueprint Showcase */}
      <section className="relative min-h-[90vh] border-b border-charcoal/10 flex flex-col justify-between p-8 blueprint-grid">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-8">
          <div className="lg:col-span-5 flex flex-col justify-center space-y-6">
            <div className="inline-block border border-navy-accent px-3 py-1 font-mono text-xs uppercase tracking-wider text-navy-accent w-fit bg-surface-white">
              Project Specification v1.0.4
            </div>
            <h1 className="font-serif text-5xl lg:text-7xl font-bold leading-[1.05] tracking-tighter text-charcoal">
              The Intelligent <br />
              Campus Living <br />
              Framework.
            </h1>
            <p className="text-slate-gray text-lg max-w-xl leading-relaxed">
              Demeure AI re-architects university accommodation into a self-optimizing ecosystem. A unified institutional operating system uniting predictive maintenance, machine learning-driven resource management, and high-fidelity security diagnostics.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={() => setShowRoleSelection(true)}
                className="bg-charcoal hover:bg-navy-accent text-surface-white font-mono text-xs uppercase tracking-wider py-4 px-8 flex items-center gap-3 transition-colors"
              >
                Initialize Operations Command <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Campus Blueprint Masterplan */}
          <div 
            className="lg:col-span-7 border border-charcoal/10 bg-surface-white relative flex flex-col overflow-hidden group cursor-crosshair"
          >
            {/* Reference stamp */}
            <div className="absolute top-0 right-0 z-10 p-3 font-mono text-[9px] text-slate-gray border-b border-l border-charcoal/10 bg-surface-white">
              SYS-DWG // 001
            </div>
            {/* Masterplan image */}
            <div 
              className="relative w-full overflow-hidden"
              style={{ aspectRatio: '2044 / 1446' }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => {
                setIsHovered(false);
                setCursorPos(null);
              }}
              onMouseMove={handleMouseMove}
            >
              <img
                src="/map.png"
                alt="Demeure AI Campus Infrastructure Masterplan – 1:500 Blueprint"
                className="w-full h-full block"
              />
              <div className="absolute inset-0 bg-navy-accent/0 group-hover:bg-navy-accent/5 transition-colors duration-500 pointer-events-none" />
              
              {/* Random coordinates appearing all over the map */}
              {isHovered && randomCoords.map((c) => (
                <div
                  key={c.id}
                  className="absolute flex items-center gap-1.5 pointer-events-none transition-all duration-300"
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                >
                  <div className="w-2 h-2 bg-navy-accent rounded-full animate-ping absolute" />
                  <div className="w-1.5 h-1.5 bg-navy-accent rounded-full" />
                  <div className="font-mono text-[8px] text-navy-accent bg-surface-white/90 border border-navy-accent/20 px-1 py-0.5 shadow-sm whitespace-nowrap">
                    {c.lat} / {c.lng}
                  </div>
                </div>
              ))}

              {/* Cursor-tracking crosshairs and coordinates */}
              {isHovered && cursorPos && (
                <>
                  <div 
                    className="absolute border-l border-dashed border-navy-accent/30 pointer-events-none top-0 bottom-0"
                    style={{ left: `${cursorPos.x}%` }}
                  />
                  <div 
                    className="absolute border-t border-dashed border-navy-accent/30 pointer-events-none left-0 right-0"
                    style={{ top: `${cursorPos.y}%` }}
                  />
                  <div 
                    className="absolute pointer-events-none bg-charcoal text-surface-white font-mono text-[9px] px-2 py-1 flex flex-col gap-0.5 shadow-md border border-surface-white/10 z-20 whitespace-nowrap"
                    style={{ 
                      left: `${cursorPos.x + 2}%`, 
                      top: `${cursorPos.y + 2}%`,
                      transform: cursorPos.x > 75 ? 'translateX(-110%)' : cursorPos.y > 80 ? 'translateY(-110%)' : 'none'
                    }}
                  >
                    <span className="font-bold text-[7px] text-slate-gray uppercase tracking-widest">Tracking Node</span>
                    <span>LAT: {(28.6139 + (cursorPos.y - 50) * 0.0002).toFixed(5)}° N</span>
                    <span>LNG: {(77.2090 + (cursorPos.x - 50) * 0.0002).toFixed(5)}° E</span>
                  </div>
                </>
              )}

              <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="font-mono text-[9px] bg-navy-accent text-surface-white px-2 py-1 uppercase tracking-widest">
                  TAC EFI MASTER PLAN · SCALE 1:500 · REV-00
                </span>
              </div>
            </div>
            {/* Footer strip */}
            <div className="border-t border-charcoal/10 px-4 py-2.5 flex justify-between font-mono text-[10px] text-slate-gray bg-surface-white flex-shrink-0">
              <span>SCALE: 1:500</span>
              <span>DEMEURE AI — CAMPUS INFRASTRUCTURE MASTERPLAN</span>
              <span>STATUS: AUTHENTICATED</span>
            </div>
          </div>

        </div>

        {/* Hero bottom telemetry strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-charcoal/10 pt-8 mt-12 bg-surface-white/60 p-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-slate-gray block uppercase">Real-Time Core Load</span>
            <span className="font-serif text-2xl font-bold text-navy-accent">412 Residents</span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-slate-gray block uppercase">Mess Food Wastage</span>
            <span className="font-serif text-2xl font-bold text-navy-accent">-34.2% YoY</span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-slate-gray block uppercase">Energy Conservation</span>
            <span className="font-serif text-2xl font-bold text-navy-accent">18,450 kWh</span>
          </div>
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-slate-gray block uppercase">Active Safety Node</span>
            <span className="font-serif text-2xl font-bold text-forest-status flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-forest-status rounded-full inline-block animate-pulse-dot"></span>
              SECURE
            </span>
          </div>
        </div>
      </section>

      {/* 3. SPLIT SECTION - EDITORIAL GRID DESCRIPTION */}
      <section className="grid grid-cols-1 lg:grid-cols-2 border-b border-charcoal/10">
        <div className="p-12 border-r border-charcoal/10 flex flex-col justify-between space-y-12 bg-surface-white">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">01 // System Philosophy</span>
          <div className="space-y-6">
            <h2 className="font-serif text-4xl lg:text-5xl font-bold leading-tight text-charcoal">
              Beyond simple logistics. <br />
              An infrastructure system.
            </h2>
            <p className="text-slate-gray leading-relaxed text-base">
              Traditional campus portals are transactional record stores. Demeure AI runs continuous background telemetry. By analyzing crowd density cycles, power load profiles, and kitchen supply utilization, the platform transforms from an administrative checklist into a proactive operations assistant.
            </p>
          </div>
          <div className="border-t border-charcoal/10 pt-6">
            <blockquote className="font-serif italic text-lg text-navy-accent">
              "The design of structural systems should prioritize systemic coordination over cosmetic aesthetics."
            </blockquote>
            <span className="font-mono text-[10px] text-slate-gray block mt-2">— Institutional Protocol Bulletin, 2026</span>
          </div>
        </div>

        {/* Section 02 - Core Feature Cards (Styled as Magazine Grids) */}
        <div className="p-12 flex flex-col justify-between space-y-12 bg-warm-ivory blueprint-grid-accent">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">02 // Core Intelligence Subsystems</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="border border-charcoal/10 bg-surface-white p-6 space-y-3">
              <div className="text-navy-accent"><Shield className="w-6 h-6 stroke-[1.5]" /></div>
              <h3 className="font-serif font-bold text-lg text-charcoal">Liveness Face Auth</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Anti-spoofing security check-ins with blink analytics and biometric vector log hashing.
              </p>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-6 space-y-3">
              <div className="text-navy-accent"><Zap className="w-6 h-6 stroke-[1.5]" /></div>
              <h3 className="font-serif font-bold text-lg text-charcoal">Energy Anomaly</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Isolation Forest ML alerts predicting machine failures and tracing vampire currents.
              </p>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-6 space-y-3">
              <div className="text-navy-accent"><Utensils className="w-6 h-6 stroke-[1.5]" /></div>
              <h3 className="font-serif font-bold text-lg text-charcoal">Mess Optimization</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Meal waste telemetry forecasting demand to adjust menu lists sustainably.
              </p>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-6 space-y-3">
              <div className="text-navy-accent"><MessageSquare className="w-6 h-6 stroke-[1.5]" /></div>
              <h3 className="font-serif font-bold text-lg text-charcoal">NLP Triage Desk</h3>
              <p className="text-xs text-slate-gray leading-relaxed">
                Automated ticketing prioritizing and classifying student complaints.
              </p>
            </div>
          </div>
          <div className="font-mono text-xs text-slate-gray">
            INTEGRATED BIOMETRICS • ENERGY FLOW • QUANTITATIVE DIETARY MODELING
          </div>
        </div>
      </section>

      {/* 4. SCROLLABLE FEATURE HIGHLIGHT (Storytelling Walkthrough) */}
      <section className="p-8 lg:p-12 bg-surface-white">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-charcoal/10 pb-6">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">03 // Deep Dive telemetry</span>
              <h2 className="font-serif text-3xl lg:text-4xl font-bold text-charcoal mt-2">Operational Command Scenarios</h2>
            </div>
            <div className="flex border border-charcoal/10 mt-4 md:mt-0 font-mono text-xs bg-warm-ivory">
              {(['security', 'energy', 'mess', 'welfare'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 border-r last:border-0 border-charcoal/10 transition-colors uppercase ${
                    activeTab === tab ? 'bg-navy-accent text-surface-white' : 'hover:bg-charcoal/5 text-slate-gray'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border border-charcoal/10 p-6 bg-warm-ivory">
            {/* Visual Screen Simulator */}
            <div className="lg:col-span-7 border border-charcoal/10 bg-surface-white p-6 h-[320px] flex flex-col justify-between font-mono text-xs">
              {activeTab === 'security' && (
                <>
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="font-bold text-navy-accent">SEC-CAM // NODE_014</span>
                    <span className="text-forest-status animate-pulse-dot">● SCANNING LIVENESS</span>
                  </div>
                  <div className="flex-1 flex gap-4 py-4 items-center justify-center">
                    <div className="w-32 h-32 border-2 border-dashed border-navy-accent flex items-center justify-center relative bg-warm-ivory">
                      <span className="text-[10px] text-center text-slate-gray px-2">FACE SCAN AREA</span>
                      <div className="absolute inset-x-2 top-1/2 border-b border-forest-status"></div>
                    </div>
                    <div className="flex-1 space-y-2 text-[10px]">
                      <div className="flex justify-between"><span>BLINK RATIO:</span><span className="text-forest-status">0.28 (OK)</span></div>
                      <div className="flex justify-between"><span>HEAD POSE:</span><span>YAW 2.4°, PITCH -1.1°</span></div>
                      <div className="flex justify-between"><span>MICRO-EXPRESSIONS:</span><span className="text-forest-status">VALIDATED</span></div>
                      <div className="flex justify-between"><span>IDENTIFIED:</span><span className="font-bold text-navy-accent">PRATIK KUMAR</span></div>
                      <div className="flex justify-between"><span>ROOM:</span><span>BLOCK A - 302</span></div>
                    </div>
                  </div>
                  <div className="border-t border-charcoal/5 pt-2 text-[9px] text-slate-gray flex justify-between">
                    <span>LEDGER WRITE: SUCCESS</span>
                    <span>HASH: 8a4c2e...f10e</span>
                  </div>
                </>
              )}

              {activeTab === 'energy' && (
                <>
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="font-bold text-navy-accent">POWER_METER // ZONE_C</span>
                    <span className="text-red-700 animate-pulse-dot">▲ ANOMALY DETECTED</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-end py-4">
                    {/* Simulated chart bars */}
                    <div className="flex items-end gap-2 h-24 px-4 border-b border-charcoal/10">
                      <div className="w-full bg-navy-accent/20 h-[40%]"></div>
                      <div className="w-full bg-navy-accent/20 h-[42%]"></div>
                      <div className="w-full bg-navy-accent/20 h-[38%]"></div>
                      <div className="w-full bg-red-700/80 h-[85%] relative">
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] text-red-700 font-bold bg-surface-white px-1 border border-red-700/20">VAMPIRE</span>
                      </div>
                      <div className="w-full bg-navy-accent/20 h-[45%]"></div>
                      <div className="w-full bg-navy-accent/20 h-[39%]"></div>
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-gray pt-1">
                      <span>12:00</span>
                      <span>13:00</span>
                      <span>14:00 (SPIKE)</span>
                      <span>15:00</span>
                      <span>16:00</span>
                    </div>
                  </div>
                  <div className="border-t border-charcoal/5 pt-2 text-[9px] text-slate-gray flex justify-between">
                    <span>PREDICTION: WATER PUMP FAULT</span>
                    <span>CONFIDENCE: 92.4%</span>
                  </div>
                </>
              )}

              {activeTab === 'mess' && (
                <>
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="font-bold text-navy-accent">DIETARY // MENUS_FORCAST</span>
                    <span className="text-forest-status">● OPTIMIZED</span>
                  </div>
                  <div className="flex-1 flex gap-4 py-4 items-center justify-center">
                    <div className="flex-1 space-y-2 text-[10px]">
                      <div className="border border-charcoal/10 p-2 bg-warm-ivory">
                        <div className="font-bold text-navy-accent">TODAY'S MENU (MODIFIED)</div>
                        <div className="text-[9px] text-slate-gray mt-1">Adjusted from standard menu based on historical Saturday attendances & exam patterns.</div>
                      </div>
                      <div className="flex justify-between"><span>FORECASTED ATTENDANCE:</span><span>240 / 412 residents</span></div>
                      <div className="flex justify-between"><span>RAW INGREDIENT RATIO:</span><span>-28% scaling applied</span></div>
                      <div className="flex justify-between"><span>PREDICTED WASTE REDUCTION:</span><span className="text-forest-status font-bold">-45.2 kgs saved</span></div>
                    </div>
                  </div>
                  <div className="border-t border-charcoal/5 pt-2 text-[9px] text-slate-gray flex justify-between">
                    <span>NUTRITIONAL SCORE: 9.4/10</span>
                    <span>CO2 SAVINGS: 122 kg CO2e</span>
                  </div>
                </>
              )}

              {activeTab === 'welfare' && (
                <>
                  <div className="flex justify-between border-b border-charcoal/5 pb-2">
                    <span className="font-bold text-navy-accent">WELFARE // WATCH_NODE</span>
                    <span className="text-slate-gray">● NOMINAL STATE</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center space-y-3 py-4">
                    <div className="border-l-2 border-navy-accent pl-3 text-[10px] text-slate-gray">
                      "Intelligent Welfare Module detects unusual patterns (e.g. absent swiping, consecutive missed meals, isolation indicators) to trigger quiet checks."
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="border border-charcoal/10 p-1 bg-warm-ivory text-center">
                        <span className="block font-bold">12</span>
                        <span className="text-[8px] text-slate-gray">OUT OF DORM &gt; 24H</span>
                      </div>
                      <div className="border border-charcoal/10 p-1 bg-warm-ivory text-center">
                        <span className="block font-bold">0</span>
                        <span className="text-[8px] text-slate-gray">DISTRESS FLAGS</span>
                      </div>
                      <div className="border border-charcoal/10 p-1 bg-warm-ivory text-center">
                        <span className="block font-bold">98.4%</span>
                        <span className="text-[8px] text-slate-gray">SWIPE CONSISTENCY</span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-charcoal/5 pt-2 text-[9px] text-slate-gray flex justify-between">
                    <span>ETHICAL ANONYMIZATION: ACTIVE</span>
                    <span>WARDEN NOTIFICATIONS: SILENT</span>
                  </div>
                </>
              )}
            </div>

            {/* Explanation Column */}
            <div className="lg:col-span-5 flex flex-col justify-between p-4 space-y-6">
              <div className="space-y-4">
                <span className="font-mono text-xs uppercase tracking-widest text-navy-accent font-bold">
                  {activeTab === 'security' && 'Liveness Biometrics'}
                  {activeTab === 'energy' && 'Power Grid Diagnostics'}
                  {activeTab === 'mess' && 'Mess Supply Calibration'}
                  {activeTab === 'welfare' && 'Student Welfare Analytics'}
                </span>
                <p className="text-sm text-slate-gray leading-relaxed">
                  {activeTab === 'security' && 'Biometric scanning uses light reflection and facial micro-motion matrices to distinguish flat photos from true physical faces. Entry records link immediately to an optional tamper-evident hashing log.'}
                  {activeTab === 'energy' && 'Our Isolation Forest model tracks incoming telemetry to alert building wardens of electric pump failures or student heaters (vampire loads) that violate campus environmental protocols.'}
                  {activeTab === 'mess' && 'Kitchen managers track real-time consumption and attendance cycles to dynamically calibrate menu items, preventing food preparation surpluses and cutting organic waste.'}
                  {activeTab === 'welfare' && 'By tracking check-in routines and mess Swipes anonymized, wardens receive system reminders if a resident breaks normal routines for 48 hours, signaling potential support needs.'}
                </p>
              </div>
              <button 
                onClick={onEnterConsole}
                className="text-navy-accent font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-charcoal transition-colors self-start"
              >
                Launch dashboard to inspect <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FOOTER — DARK EDITORIAL */}
      <footer style={{ background: 'linear-gradient(180deg, #0a0f1a 0%, #060a12 100%)', borderTop: '1px solid rgba(255,255,255,0.06)' }} className="px-8 pt-16 pb-8">

        {/* Blue gradient accent rule */}
        <div className="max-w-7xl mx-auto">
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #1E3A5F, #4B8BFF, #1E3A5F, transparent)', marginBottom: '3rem' }} />
        </div>

        {/* Huge brand name */}
        <div className="max-w-7xl mx-auto mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] block mb-3" style={{ color: '#6B7280' }}>
            Intelligent Campus Infrastructure
          </span>
          <h2
            className="font-bold leading-none select-none"
            style={{
              fontSize: 'clamp(3.5rem, 10vw, 8rem)',
              letterSpacing: '-0.03em',
              fontFamily: "'Outfit', 'Inter', sans-serif",
              color: '#FFFFFF',
              textShadow: '0 0 80px rgba(78, 139, 255, 0.18)',
            }}
          >
            DEMEURE
            <span style={{ color: '#4B8BFF', marginLeft: '0.2em' }}>AI</span>
          </h2>
        </div>

        {/* Info row */}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
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

        {/* Bottom copyright */}
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}>
          <span className="font-mono text-[10px]" style={{ color: '#4B5563' }}>
            © 2026 DEMEURE AI. ALL PROTOCOLS ENFORCED. BUILT FOR INSTITUTIONAL EXCELLENCE.
          </span>
          <span className="font-mono text-[10px]" style={{ color: '#4B5563' }}>
            SPEC: CLOUD-NATIVE MICROSERVICES · COMPLIANCE: GDPR &amp; ETHICAL AI
          </span>
        </div>
      </footer>

      {/* 5. ROLE SELECTION MATRIX OVERLAY */}
      {showRoleSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/90 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl bg-surface-white border border-charcoal/20 shadow-2xl overflow-hidden blueprint-grid-accent">
            
            {/* Header */}
            <div className="border-b border-charcoal/10 p-6 flex justify-between items-center bg-surface-white/90">
              <div className="flex flex-col">
                <span className="font-bold text-navy-accent uppercase text-lg tracking-wider font-serif">Select System Persona</span>
                <span className="text-xs text-slate-gray font-mono uppercase tracking-widest mt-1">Authenticate Identity to Initialize Operations</span>
              </div>
              <button 
                onClick={() => setShowRoleSelection(false)}
                className="text-slate-gray hover:text-charcoal font-mono text-xs border border-charcoal/10 hover:border-charcoal px-3 py-1 transition-colors uppercase"
              >
                Cancel
              </button>
            </div>

            {/* Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-y md:divide-y-0 md:divide-x divide-charcoal/10">
              
              {/* Admin Card */}
              <button 
                onClick={() => onEnterConsole('Admin')}
                className="group relative flex flex-col items-center justify-center p-12 text-center hover:bg-navy-accent hover:text-surface-white transition-all duration-300"
              >
                <div className="absolute inset-0 bg-navy-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blueprint-grid-accent" />
                <Cpu className="w-12 h-12 text-navy-accent group-hover:text-surface-white mb-6 transition-colors duration-300" />
                <h3 className="font-serif font-bold text-xl mb-2 text-charcoal group-hover:text-surface-white transition-colors duration-300">Administrator</h3>
                <p className="text-xs font-mono text-slate-gray group-hover:text-warm-ivory/80 leading-relaxed transition-colors duration-300">
                  Full structural override, financial ledger access, and institutional control parameters.
                </p>
                <div className="mt-8 border border-navy-accent text-navy-accent group-hover:border-surface-white group-hover:text-surface-white px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300">
                  Initialize
                </div>
              </button>

              {/* Warden Card */}
              <button 
                onClick={() => onEnterConsole('Warden')}
                className="group relative flex flex-col items-center justify-center p-12 text-center hover:bg-forest-status hover:text-surface-white transition-all duration-300"
              >
                <div className="absolute inset-0 bg-forest-status/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blueprint-grid" />
                <ShieldAlert className="w-12 h-12 text-forest-status group-hover:text-surface-white mb-6 transition-colors duration-300" />
                <h3 className="font-serif font-bold text-xl mb-2 text-charcoal group-hover:text-surface-white transition-colors duration-300">Hostel Warden</h3>
                <p className="text-xs font-mono text-slate-gray group-hover:text-warm-ivory/80 leading-relaxed transition-colors duration-300">
                  Security operations, biometric gate logs, and student leave authorization matrix.
                </p>
                <div className="mt-8 border border-forest-status text-forest-status group-hover:border-surface-white group-hover:text-surface-white px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300">
                  Initialize
                </div>
              </button>

              {/* Mess Manager Card */}
              <button 
                onClick={() => onEnterConsole('MessManager')}
                className="group relative flex flex-col items-center justify-center p-12 text-center hover:bg-amber-600 hover:text-surface-white transition-all duration-300"
              >
                <div className="absolute inset-0 bg-amber-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blueprint-grid" />
                <Utensils className="w-12 h-12 text-amber-600 group-hover:text-surface-white mb-6 transition-colors duration-300" />
                <h3 className="font-serif font-bold text-xl mb-2 text-charcoal group-hover:text-surface-white transition-colors duration-300">Mess Manager</h3>
                <p className="text-xs font-mono text-slate-gray group-hover:text-warm-ivory/80 leading-relaxed transition-colors duration-300">
                  Predictive food scaling, wastage telemetry, and dietary planning analytics.
                </p>
                <div className="mt-8 border border-amber-600 text-amber-600 group-hover:border-surface-white group-hover:text-surface-white px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300">
                  Initialize
                </div>
              </button>

              {/* Student Card */}
              <button 
                onClick={() => onEnterConsole('Student')}
                className="group relative flex flex-col items-center justify-center p-12 text-center hover:bg-charcoal hover:text-surface-white transition-all duration-300"
              >
                <div className="absolute inset-0 bg-charcoal/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blueprint-grid" />
                <Users className="w-12 h-12 text-charcoal group-hover:text-surface-white mb-6 transition-colors duration-300" />
                <h3 className="font-serif font-bold text-xl mb-2 text-charcoal group-hover:text-surface-white transition-colors duration-300">Resident Student</h3>
                <p className="text-xs font-mono text-slate-gray group-hover:text-warm-ivory/80 leading-relaxed transition-colors duration-300">
                  Personal portal access, complaints ledger, meal scheduling, and leave requests.
                </p>
                <div className="mt-8 border border-charcoal text-charcoal group-hover:border-surface-white group-hover:text-surface-white px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors duration-300">
                  Initialize
                </div>
              </button>

            </div>

            {/* Footer */}
            <div className="border-t border-charcoal/10 bg-surface-white/90 p-3 text-center">
              <span className="text-[10px] text-slate-gray font-mono tracking-widest uppercase">
                Secure Channel • End-to-End Encrypted • Hardware Token Required For Staff
              </span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
