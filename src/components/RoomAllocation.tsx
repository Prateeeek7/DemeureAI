import React, { useState, useMemo } from 'react';
import { Users, ShieldCheck, Database, Cpu, BookOpen, ArrowRight, Info } from 'lucide-react';
import ThemedSelect from './ThemedSelect';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';

interface CompatibilityResult {
  name: string;
  score: number;
  room: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type RoomType = 'Single' | 'Double' | 'Suite';
type RoomStatus = 'Available' | 'Full' | 'Maintenance';

interface Room {
  id: string;
  number: string;
  type: RoomType;
  occupants: string[];
  maxOccupants: number;
  status: RoomStatus;
  compatibility: number;
}

// Floor layout mirrors the server's seed (backend/services/seed.py): 10 rooms per floor.
const ROOM_TYPES: RoomType[] = [
  'Double', 'Single', 'Double', 'Suite', 'Double',
  'Single', 'Double', 'Suite', 'Single', 'Double',
];
const MAX_OCCUPANTS = { Single: 1, Double: 2, Suite: 4 };

// ── Room generator: empty floor plan; occupants come from the allocation registry ─
function generateFloorRooms(block: string, floor: number): Room[] {
  return Array.from({ length: 10 }, (_, i) => {
    const roomNum = i + 1;
    const type = ROOM_TYPES[i];
    const maxOcc = MAX_OCCUPANTS[type];
    // Room 5 on every even floor is out of service.
    const isMaint = floor % 2 === 0 && roomNum === 5;
    return {
      id: `${block}${floor}${roomNum}`,
      number: `${block}-${floor}${String(roomNum).padStart(2, '0')}`,
      type,
      occupants: [],
      maxOccupants: maxOcc,
      status: isMaint ? 'Maintenance' : 'Available',
      // Compatibility score varies per room
      compatibility: Math.min(99, 60 + (roomNum * 7 + floor * 3 + block.charCodeAt(0)) % 40),
    };
  });
}

// ── Data-source config (for the info panel) ──────────────────────────────────
const DATA_SOURCES = [
  {
    icon: BookOpen,
    title: 'Room Preference Survey',
    desc: 'Lifestyle answers submitted by students in the Survey module: sleep cycle, study environment, cleanliness and social preference.',
    badge: 'PRIMARY',
    color: 'text-navy-accent',
  },
  {
    icon: Cpu,
    title: 'Weighted Similarity Engine',
    desc: 'Each habit is mapped to an ordinal scale and compared with your inputs (sleep 30%, study 25%, cleanliness 25%, social 20%), plus a small bonus for the same preferred block.',
    badge: 'SCORING',
    color: 'text-amber-700',
  },
  {
    icon: Database,
    title: 'Allocation Registry',
    desc: 'Residents you allocate are saved centrally, so occupancy and capacity checks stay consistent for every warden session.',
    badge: 'PERSISTED',
    color: 'text-forest-status',
  },
  {
    icon: Users,
    title: 'Capacity Enforcement',
    desc: 'The server rejects allocations beyond a room\'s bed count or duplicate names in the same room.',
    badge: 'VALIDATED',
    color: 'text-red-700',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function RoomAllocation() {
  // Filters
  const [selectedBlock, setSelectedBlock] = useState('A');
  const [selectedFloor, setSelectedFloor] = useState('1');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showDataSources, setShowDataSources] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [residentNameInput, setResidentNameInput] = useState('');
  const allocationsApi = useApi<Record<string, string[]>>('/api/rooms/allocations');
  const customOccupantsMap = allocationsApi.data ?? {};
  const [allocating, setAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState('');
  const [compatibilityError, setCompatibilityError] = useState('');
  const [candidateCount, setCandidateCount] = useState(0);

  // Compatibility form
  const [sleepHabit,  setSleepHabit]  = useState('');
  const [studyHabit,  setStudyHabit]  = useState('');
  const [cleanliness, setCleanliness] = useState('');
  const [socialPref,  setSocialPref]  = useState('');
  const [compatibilityResults, setCompatibilityResults] = useState<CompatibilityResult[] | null>(null);

  // Derived rooms grid with custom allocations applied
  const baseRooms = useMemo(
    () => generateFloorRooms(selectedBlock, parseInt(selectedFloor)),
    [selectedBlock, selectedFloor],
  );

  const rooms = baseRooms.map(r => {
    if (customOccupantsMap[r.id]) {
      const occs = customOccupantsMap[r.id];
      const isFull = occs.length >= r.maxOccupants;
      return {
        ...r,
        occupants: occs,
        status: isFull ? ('Full' as const) : ('Available' as const)
      };
    }
    return r;
  });

  // Sync selectedRoom if customOccupantsMap changes
  const activeSelectedRoom = selectedRoom ? (rooms.find(r => r.id === selectedRoom.id) || selectedRoom) : null;

  const handleConfirmAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !residentNameInput.trim()) return;
    const room = activeSelectedRoom ?? selectedRoom;
    setAllocating(true);
    setAllocationError('');
    try {
      const saved = await api.post<{ id: string; occupants: string[] }>(`/api/rooms/${room.id}/allocate`, {
        name: residentNameInput.trim(),
        currentOccupants: room.occupants,
        maxOccupants: room.maxOccupants,
      });
      allocationsApi.setData(prev => ({ ...(prev ?? {}), [saved.id]: saved.occupants }));
      setResidentNameInput('');
      setShowAllocateModal(false);
    } catch (err) {
      setAllocationError(errorMessage(err));
    } finally {
      setAllocating(false);
    }
  };

  // Reset selection when block/floor changes
  const handleBlockChange = (val: string) => { setSelectedBlock(val); setSelectedRoom(null); };
  const handleFloorChange = (val: string) => { setSelectedFloor(val); setSelectedRoom(null); };

  const handleCalculateCompatibility = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sleepHabit || !studyHabit || !cleanliness || !socialPref) {
      setCompatibilityError('Select all four lifestyle preferences first.');
      return;
    }
    setCompatibilityError('');
    try {
      const res = await api.post<{ candidates: number; results: CompatibilityResult[] }>('/api/rooms/compatibility', {
        sleep: sleepHabit, study: studyHabit, clean: cleanliness, social: socialPref, block: selectedBlock,
      });
      setCandidateCount(res.candidates);
      setCompatibilityResults(res.results);
    } catch (err) {
      setCompatibilityError(errorMessage(err));
    }
  };

  // Summary counters
  const availCount   = rooms.filter(r => r.status === 'Available').length;
  const fullCount    = rooms.filter(r => r.status === 'Full').length;
  const maintCount   = rooms.filter(r => r.status === 'Maintenance').length;
  const occupiedBeds = rooms.reduce((a, r) => a + r.occupants.length, 0);
  const totalBeds    = rooms.reduce((a, r) => a + r.maxOccupants, 0);

  return (
    <div className="space-y-8">
      {/* Module Title */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 01</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Room Allocation &amp; Compatibility Grid</h2>
      </div>

      {/* ── Block / Floor Selector Bar ── */}
      <div className="bg-surface-white border border-charcoal/10 p-4">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[140px] space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-gray block">Hostel Block</label>
            <ThemedSelect
              value={selectedBlock}
              onChange={handleBlockChange}
              options={[
                { value: 'A', label: 'Block A — Boys (North Wing)' },
                { value: 'B', label: 'Block B — Girls (South Wing)' },
                { value: 'C', label: 'Block C — Mixed / PG Scholars' },
              ]}
            />
          </div>

          <div className="flex-1 min-w-[140px] space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-slate-gray block">Floor</label>
            <ThemedSelect
              value={selectedFloor}
              onChange={handleFloorChange}
              options={[
                { value: '1', label: 'Floor 1  (Rooms 101–110)' },
                { value: '2', label: 'Floor 2  (Rooms 201–210)' },
                { value: '3', label: 'Floor 3  (Rooms 301–310)' },
                { value: '4', label: 'Floor 4  (Rooms 401–410)' },
                { value: '5', label: 'Floor 5  (Rooms 501–510)' },
              ]}
            />
          </div>

          {/* Live summary pills */}
          <div className="flex flex-wrap gap-3 font-mono text-[10px] pb-0.5">
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 border border-forest-status/30 bg-green-50 text-forest-status">
              <span className="w-1.5 h-1.5 rounded-full bg-forest-status inline-block" />
              {availCount} Available
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 border border-red-700/20 bg-red-50 text-red-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-700 inline-block" />
              {fullCount} Full
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 border border-amber-500/30 bg-amber-50 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              {maintCount} Maintenance
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1.5 border border-charcoal/10 bg-warm-ivory text-charcoal">
              🛏 {occupiedBeds} / {totalBeds} Beds
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT: Compatibility Scorer */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-5">
            <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
              <Users className="w-5 h-5 text-navy-accent" />
              <h3 className="font-serif font-bold text-lg text-charcoal">Compatibility Scorer</h3>
            </div>
            <p className="text-xs text-slate-gray leading-relaxed font-mono">
              The Demeure AI compatibility engine matches residents using lifestyle profiles.
              Fill in your preferences to find optimal roommates and rooms on{' '}
              <strong className="text-charcoal">Block {selectedBlock} · Floor {selectedFloor}</strong>.
            </p>

            <form onSubmit={handleCalculateCompatibility} className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">1. Sleep Profile</label>
                <ThemedSelect
                  value={sleepHabit}
                  onChange={setSleepHabit}
                  placeholder="Select option..."
                  options={[
                    { value: 'early',    label: 'Early Riser (Before 6:00 AM)' },
                    { value: 'night',    label: 'Night Owl (Past midnight)' },
                    { value: 'flexible', label: 'Flexible / Variable schedule' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">2. Study Environment</label>
                <ThemedSelect
                  value={studyHabit}
                  onChange={setStudyHabit}
                  placeholder="Select option..."
                  options={[
                    { value: 'silent',   label: 'Absolute Silence Required' },
                    { value: 'ambient',  label: 'Ambient music / noise acceptable' },
                    { value: 'external', label: 'Prefers Library / External study' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">3. Maintenance of Space</label>
                <ThemedSelect
                  value={cleanliness}
                  onChange={setCleanliness}
                  placeholder="Select option..."
                  options={[
                    { value: 'strict',   label: 'Strictly Clean / Scheduled Chore chart' },
                    { value: 'moderate', label: 'Moderate / Clean weekends' },
                    { value: 'relaxed',  label: 'Relaxed / Minimal organization' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-gray uppercase text-[10px] tracking-wider">4. Social Profile</label>
                <ThemedSelect
                  value={socialPref}
                  onChange={setSocialPref}
                  placeholder="Select option..."
                  options={[
                    { value: 'quiet',    label: 'Quiet Sanctuary (No visitors inside)' },
                    { value: 'moderate', label: 'Moderate (Study groups / friends occasionally)' },
                    { value: 'active',   label: 'Active Hub (Frequent guests)' },
                  ]}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-navy-accent hover:bg-charcoal text-surface-white py-3 uppercase tracking-wider text-[11px] transition-colors flex items-center justify-center gap-2"
              >
                Analyze Compatibility <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {compatibilityError && <div role="alert" className="text-red-700 font-mono text-[10px]">{compatibilityError}</div>}
            </form>

            {compatibilityResults && (
              <div className="border border-navy-accent/20 bg-warm-ivory p-4 space-y-3 font-mono text-xs">
                <div className="font-bold text-navy-accent flex items-center gap-1.5 uppercase">
                  <ShieldCheck className="w-4 h-4 text-forest-status" />
                  Best Matches from {candidateCount} Survey Response{candidateCount === 1 ? '' : 's'}
                </div>
                {compatibilityResults.length === 0 && (
                  <div className="text-slate-gray">No survey responses yet. Ask residents to complete the Room Preference Survey.</div>
                )}
                <div className="divide-y divide-charcoal/5">
                  {compatibilityResults.map((result, idx) => (
                    <div key={idx} className="py-2 flex justify-between items-center">
                      <span className="text-charcoal">{result.name} <span className="text-slate-gray">({result.room})</span></span>
                      <span className={`font-bold ${result.score >= 90 ? 'text-forest-status' : result.score >= 75 ? 'text-navy-accent' : 'text-amber-700'}`}>
                        {result.score}% Match
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Data Source info panel toggle */}
          <div className="border border-charcoal/10 bg-surface-white">
            <button
              onClick={() => setShowDataSources(prev => !prev)}
              className="w-full flex items-center justify-between p-4 font-mono text-xs hover:bg-warm-ivory transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-navy-accent" />
                <span className="uppercase tracking-wider font-bold text-charcoal">How is Prediction Data Generated?</span>
              </div>
              <span className="text-slate-gray text-[11px]">{showDataSources ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showDataSources && (
              <div className="border-t border-charcoal/5 p-4 space-y-4">
                {DATA_SOURCES.map((src) => {
                  const Icon = src.icon;
                  return (
                    <div key={src.title} className="flex gap-3 p-3 bg-warm-ivory border border-charcoal/5">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${src.color}`} />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] text-charcoal">{src.title}</span>
                          <span className={`font-mono text-[8px] border px-1 font-bold ${src.color} border-current`}>{src.badge}</span>
                        </div>
                        <p className="font-mono text-[10px] text-slate-gray leading-relaxed">{src.desc}</p>
                      </div>
                    </div>
                  );
                })}

                <div className="border border-charcoal/5 bg-navy-accent/5 p-3 font-mono text-[10px] text-navy-accent space-y-1">
                  <div className="font-bold uppercase tracking-wider">Model Pipeline Summary</div>
                  <div className="text-charcoal/70">
                    Questionnaire → Feature Vector → Cosine Similarity Matrix → Top-K Match Ranking → Room Suggestion
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Floor Map */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
              <span className="font-serif font-bold text-lg text-charcoal">
                Block {selectedBlock} · Floor {selectedFloor} Map
              </span>
              <span className="font-mono text-xs text-slate-gray">Click a room to inspect</span>
            </div>

            {/* 10 rooms in a 5×2 grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-warm-ivory border border-charcoal/10 blueprint-grid-accent">
              {rooms.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                const dotColor =
                  room.status === 'Full'        ? 'bg-red-600'
                  : room.status === 'Maintenance' ? 'bg-amber-500'
                  : 'bg-forest-status';
                const cardBg =
                  room.status === 'Maintenance' ? 'bg-amber-50 border-amber-200'
                  : isSelected                  ? 'bg-surface-white border-navy-accent ring-1 ring-navy-accent'
                  : 'bg-surface-white border-charcoal/10 hover:border-slate-gray';

                return (
                  <button
                    key={room.id}
                    onClick={() => setSelectedRoom(room)}
                    disabled={room.status === 'Maintenance'}
                    className={`h-[90px] p-2.5 border flex flex-col justify-between text-left transition-all ${cardBg} ${room.status === 'Maintenance' ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-mono font-bold text-[11px] text-charcoal">{room.number}</span>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-mono text-[8px] text-slate-gray block uppercase">{room.type}</span>
                      <span className="font-mono text-[9px] text-navy-accent block font-semibold">
                        {room.status === 'Maintenance' ? 'MAINT.' : `${room.occupants.length}/${room.maxOccupants} Occ.`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 font-mono text-[9px] text-slate-gray border-t border-charcoal/5 pt-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-forest-status inline-block" /> Available</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Full</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Maintenance</span>
            </div>

            {/* Selected Room Details Panel */}
            {selectedRoom ? (
              <div className="border border-charcoal/10 p-4 font-mono text-xs bg-warm-ivory grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-bold text-navy-accent text-sm">Room {selectedRoom.number} Diagnostic</h4>
                  <div>
                    <span className="text-slate-gray uppercase text-[9px] block">Room Type</span>
                    <span className="font-medium text-charcoal">{selectedRoom.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-gray uppercase text-[9px] block">Operational Status</span>
                    <span className={`font-semibold ${selectedRoom.status === 'Full' ? 'text-red-700' : 'text-forest-status'}`}>
                      {selectedRoom.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-gray uppercase text-[9px] block">Compatibility Weight</span>
                    <span className={`font-semibold ${selectedRoom.compatibility >= 85 ? 'text-forest-status' : selectedRoom.compatibility >= 65 ? 'text-navy-accent' : 'text-amber-700'}`}>
                      {selectedRoom.compatibility}% Match Index
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-gray uppercase text-[9px] block">Block / Floor</span>
                    <span className="font-medium text-charcoal">Block {selectedBlock} · Floor {selectedFloor}</span>
                  </div>
                </div>

                <div className="space-y-2 border-t md:border-t-0 md:border-l border-charcoal/10 pt-4 md:pt-0 md:pl-4">
                  <h4 className="font-bold text-charcoal text-xs uppercase">Active Occupants</h4>
                  {selectedRoom.occupants.length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside text-charcoal">
                      {selectedRoom.occupants.map((occ, idx) => (
                        <li key={idx}>{occ}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-slate-gray italic text-[11px]">Room is currently unallocated. Available for selection.</span>
                  )}
                  {(activeSelectedRoom?.occupants.length ?? selectedRoom.occupants.length) < selectedRoom.maxOccupants && selectedRoom.status !== 'Maintenance' && (
                    <button 
                      onClick={() => setShowAllocateModal(true)}
                      className="mt-3 w-full text-center bg-navy-accent text-surface-white font-mono text-[10px] uppercase tracking-wider py-2 hover:bg-charcoal transition-colors rounded-xs shadow-xs"
                    >
                      Allocate Resident Here
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-charcoal/20 p-8 text-center text-slate-gray font-mono text-xs bg-warm-ivory/50">
                Select any room cell on the floor map to review structural and roommate allocation metadata.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALLOCATE RESIDENT MODAL */}
      {showAllocateModal && selectedRoom && (
        <div className="fixed inset-0 bg-charcoal/80 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleConfirmAllocate} className="bg-surface-white border border-charcoal/20 max-w-sm w-full p-6 space-y-4 font-mono text-xs shadow-2xl rounded-sm">
            <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
              <h4 className="font-bold text-navy-accent text-sm uppercase">Allocate Resident — Room {selectedRoom.number}</h4>
              <button type="button" onClick={() => setShowAllocateModal(false)} className="text-slate-gray hover:text-charcoal text-base font-bold">✕</button>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-slate-gray uppercase">Resident Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Siddharth Verma"
                value={residentNameInput}
                onChange={(e) => setResidentNameInput(e.target.value)}
                className="w-full border border-charcoal/20 p-2.5 bg-white text-xs text-charcoal outline-none focus:border-navy-accent rounded-xs"
                maxLength={80}
                autoFocus
              />
              {allocationError && <div role="alert" className="text-red-700 text-[10px] font-bold">{allocationError}</div>}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setShowAllocateModal(false)}
                className="px-3 py-2 border border-charcoal/20 text-xs text-charcoal rounded-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={allocating}
                className="px-4 py-2 bg-navy-accent text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs disabled:opacity-50"
              >
                {allocating ? 'Saving...' : 'Confirm Allocation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
