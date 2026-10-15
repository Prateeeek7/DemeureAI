import React, { useState } from 'react';
import { Building2, Bus, Wrench, Package, PlusCircle } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useSession } from '../lib/session';

interface FacilitiesTransportHubProps {
  currentRole: string;
}

interface FacilityBooking {
  id: string;
  facility: string;
  type: string;
  slot: string;
  requestedBy: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
}

interface MaintenanceTicket {
  id: string;
  location: string;
  issue: string;
  type: string;
  priority: string;
  status: 'PENDING ASSIGNMENT' | 'IN PROGRESS' | 'COMPLETED';
  date: string;
}

const NEXT_TICKET_STATUS: Record<MaintenanceTicket['status'], MaintenanceTicket['status'] | null> = {
  'PENDING ASSIGNMENT': 'IN PROGRESS',
  'IN PROGRESS': 'COMPLETED',
  COMPLETED: null,
};

const BUS_ROUTES = [
  { routeNo: 'Route 01', name: 'Katpadi Junction ↔ Main Campus Gate', stops: 'Katpadi Stn → Chittoor Bus Stop → Campus Gate 1', timings: '07:30 AM | 08:30 AM | 05:30 PM | 06:30 PM', driver: 'Suresh Kumar (+91 94433 11223)', status: 'ON TIME' },
  { routeNo: 'Route 02', name: 'Vellore Town ↔ Hostel Complex', stops: 'Green Circle → Old Bus Stand → Gate 3', timings: '08:00 AM | 09:00 AM | 06:00 PM', driver: 'Ramesh V. (+91 98422 33445)', status: 'IN TRANSIT' },
  { routeNo: 'Route 03', name: 'Faculty Quarters Shuttle', stops: 'Quarters A → Library → Technology Tower', timings: 'Every 20 Mins (Continuous)', driver: 'Gopal S. (+91 97899 55667)', status: 'ACTIVE' },
];


const CAMPUS_ASSETS = [
  { assetId: 'AST-901', name: 'High-Performance Workstation (NVIDIA RTX 4090)', location: 'AI Research Lab (TT-402)', category: 'IT Hardware', status: 'ASSIGNED' },
  { assetId: 'AST-902', name: '4K Smart Interactive Projector', location: 'Seminar Hall 3', category: 'AV Equipment', status: 'OPERATIONAL' },
  { assetId: 'AST-903', name: 'Digital Oscilloscope & Signal Generator', location: 'ECE Core Lab 1', category: 'Lab Equipment', status: 'UNDER REPAIR' },
  { assetId: 'AST-904', name: 'Campus EV Shuttle (14-Seater)', location: 'Transport Depot', category: 'Vehicles', status: 'OPERATIONAL' },
];

export default function FacilitiesTransportHub({ currentRole }: FacilitiesTransportHubProps) {
  type SubTab = 'facilities' | 'transport' | 'maintenance' | 'assets';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('facilities');
  const isAdmin = currentRole === 'CampusAdmin' || currentRole === 'Admin';
  const user = useSession();
  const bookingsApi = useApi<FacilityBooking[]>('/api/facilities/bookings');
  const ticketsApi = useApi<MaintenanceTicket[]>('/api/maintenance/tickets');
  const bookings = bookingsApi.data ?? [];
  const tickets = ticketsApi.data ?? [];
  const [actionError, setActionError] = useState('');
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [newFacility, setNewFacility] = useState('Main Auditorium (1,200 Seats)');
  const [newFacilityType, setNewFacilityType] = useState('Auditorium');
  const [newSlot, setNewSlot] = useState('Oct 15 • 02:00 PM - 05:00 PM');
  const [newOrganizer, setNewOrganizer] = useState(user?.role === 'Student' ? `${user.name} (Student)` : 'Campus Administration');

  const [newLocation, setNewLocation] = useState('');
  const [newIssue, setNewIssue] = useState('');
  const [newType, setNewType] = useState('Electrical Complaint');

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacility || !newOrganizer) return;
    setActionError('');
    try {
      const created = await api.post<FacilityBooking>('/api/facilities/book', {
        facility: newFacility, type: newFacilityType, slot: newSlot, requestedBy: newOrganizer,
      });
      bookingsApi.setData(prev => [created, ...(prev ?? [])]);
      setShowBookingModal(false);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation || !newIssue) return;
    setActionError('');
    try {
      const created = await api.post<MaintenanceTicket>('/api/maintenance/ticket', {
        location: newLocation, issue: newIssue, type: newType, priority: 'HIGH',
      });
      ticketsApi.setData(prev => [created, ...(prev ?? [])]);
      setNewLocation('');
      setNewIssue('');
      setShowNewTicketModal(false);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const setBookingStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const updated = await api.post<FacilityBooking>(`/api/facilities/bookings/${id}/status`, { status });
      bookingsApi.setData(prev => (prev ?? []).map(b => b.id === id ? updated : b));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const advanceTicket = async (ticket: MaintenanceTicket) => {
    const next = NEXT_TICKET_STATUS[ticket.status];
    if (!next) return;
    try {
      const updated = await api.post<MaintenanceTicket>(`/api/maintenance/tickets/${ticket.id}/status`, { status: next });
      ticketsApi.setData(prev => (prev ?? []).map(t => t.id === ticket.id ? updated : t));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-navy-accent/10 text-navy-accent font-mono text-[13px] font-bold px-2 py-0.5 uppercase tracking-wider rounded-xs">
              Module Cluster 4, 5, 9 & 14
            </span>
            <span className="text-slate-gray font-mono text-xs">• Infrastructure & Logistics Operations</span>
          </div>
          <h2 className="font-serif font-bold text-2xl text-charcoal">Campus Facilities, Fleet & Infrastructure</h2>
          <p className="font-mono text-xs text-slate-gray mt-1">
            Unified management for venue reservations, shuttle route management, facility maintenance tickets, and asset inventory.
          </p>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap gap-1 bg-warm-ivory p-1 border border-charcoal/15 rounded-sm">
          {[
            { id: 'facilities', label: isAdmin ? 'Venue Bookings' : 'Book a Venue', icon: Building2 },
            { id: 'transport', label: 'Transport & Fleet', icon: Bus },
            { id: 'maintenance', label: isAdmin ? 'Maintenance Work-Orders' : 'My Maintenance Requests', icon: Wrench },
            ...(isAdmin ? [{ id: 'assets', label: 'Asset Inventory', icon: Package }] : []),
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

      {(actionError || bookingsApi.error || ticketsApi.error) && (
        <div role="alert" className="border border-red-700/20 bg-red-50/30 p-3 font-mono text-xs text-red-700 flex justify-between">
          <span>{actionError || bookingsApi.error || ticketsApi.error}</span>
          {actionError && <button onClick={() => setActionError('')} aria-label="Dismiss" className="font-bold">✕</button>}
        </div>
      )}

      {/* SUB TAB 1: FACILITY BOOKING */}
      {activeSubTab === 'facilities' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Building2 className="w-5 h-5 text-navy-accent" /> Institutional Venue & Facility Reservation (Module 4)
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">Reserve Classrooms, Auditoriums, Laboratories, and Sports Courts.</p>
            </div>
            <button 
              onClick={() => setShowBookingModal(true)}
              className="bg-navy-accent hover:bg-charcoal text-white text-xs font-mono font-semibold px-4 py-2 rounded-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Request Venue Booking
            </button>
          </div>

          {/* New Venue Booking Form Modal */}
          {showBookingModal && (
            <form onSubmit={handleCreateBooking} className="border border-navy-accent/30 bg-navy-accent/5 p-5 rounded-sm space-y-4 font-mono">
              <h4 className="font-bold text-charcoal text-sm uppercase">Request Institutional Venue Reservation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Select Facility *</label>
                  <select 
                    value={newFacility} 
                    onChange={(e) => {
                      setNewFacility(e.target.value);
                      if (e.target.value.includes('Auditorium')) setNewFacilityType('Auditorium');
                      else if (e.target.value.includes('Lab')) setNewFacilityType('Laboratory');
                      else if (e.target.value.includes('Court')) setNewFacilityType('Sports Facility');
                      else setNewFacilityType('Seminar Hall');
                    }}
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs text-charcoal rounded-xs"
                  >
                    <option value="Main Auditorium (1,200 Seats)">Main Auditorium (1,200 Seats)</option>
                    <option value="Advanced Robotics & AI Lab">Advanced Robotics & AI Lab</option>
                    <option value="Indoor Badminton Court 2">Indoor Badminton Court 2</option>
                    <option value="Technology Tower Seminar Hall 3">Technology Tower Seminar Hall 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Time Slot *</label>
                  <input 
                    type="text" 
                    value={newSlot} 
                    onChange={(e) => setNewSlot(e.target.value)}
                    required
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs text-charcoal rounded-xs"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Organizer / Club *</label>
                  <input 
                    type="text" 
                    value={newOrganizer} 
                    onChange={(e) => setNewOrganizer(e.target.value)}
                    required
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs text-charcoal rounded-xs"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Category</label>
                  <input 
                    type="text" 
                    value={newFacilityType}
                    readOnly
                    className="w-full p-2 border border-charcoal/20 bg-gray-100 text-xs text-charcoal rounded-xs cursor-not-allowed font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowBookingModal(false)}
                  className="px-3 py-1.5 border border-charcoal/20 text-xs text-charcoal rounded-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-navy-accent text-white text-xs font-bold rounded-xs shadow-xs"
                >
                  Submit Reservation
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border border-charcoal/15 border-collapse">
              <thead>
                <tr className="bg-warm-ivory border-b border-charcoal/20 text-charcoal uppercase text-[13px]">
                  <th className="p-3 border-r border-charcoal/15">Booking Ref</th>
                  <th className="p-3 border-r border-charcoal/15">Facility Name</th>
                  <th className="p-3 border-r border-charcoal/15">Category</th>
                  <th className="p-3 border-r border-charcoal/15">Time Slot</th>
                  <th className="p-3 border-r border-charcoal/15">Organizer / Club</th>
                  <th className="p-3">Status</th>
                  {isAdmin && <th className="p-3">Action</th>}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-charcoal/10 hover:bg-slate-50 transition-colors">
                    <td className="p-3 border-r border-charcoal/15 font-bold text-navy-accent">{b.id}</td>
                    <td className="p-3 border-r border-charcoal/15 font-bold text-charcoal">{b.facility}</td>
                    <td className="p-3 border-r border-charcoal/15 text-slate-gray">{b.type}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal font-semibold">{b.slot}</td>
                    <td className="p-3 border-r border-charcoal/15 text-charcoal">{b.requestedBy}</td>
                    <td className="p-3">
                      <span className={`text-xs font-bold px-2.5 py-0.5 border rounded-xs ${
                        b.status === 'APPROVED' ? 'text-forest-status border-forest-status/30 bg-emerald-50'
                          : b.status === 'REJECTED' ? 'text-rose-700 border-rose-200 bg-rose-50'
                          : 'text-amber-800 border-amber-300 bg-amber-50'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-3">
                        {b.status === 'PENDING' ? (
                          <div className="flex gap-2">
                            <button onClick={() => setBookingStatus(b.id, 'APPROVED')}
                              className="border border-navy-accent text-navy-accent hover:bg-navy-accent hover:text-white px-2 py-0.5 text-xs uppercase">Approve</button>
                            <button onClick={() => setBookingStatus(b.id, 'REJECTED')}
                              className="border border-rose-700 text-rose-700 hover:bg-rose-700 hover:text-white px-2 py-0.5 text-xs uppercase">Reject</button>
                          </div>
                        ) : <span className="text-slate-gray text-xs">—</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB TAB 2: TRANSPORT MANAGEMENT */}
      {activeSubTab === 'transport' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Bus className="w-5 h-5 text-navy-accent" /> Campus Transport & Fleet Management (Module 5)
              </h3>
              <p className="font-mono text-xs text-slate-gray mt-0.5">Shuttle routes, driver details, and live vehicle tracking indicators.</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 font-mono text-xs font-bold px-3 py-1 rounded-xs">
              FLEET OPERATIONAL: 18 BUSES
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            {BUS_ROUTES.map((route) => (
              <div key={route.routeNo} className="border border-charcoal/15 bg-warm-ivory/30 p-5 rounded-sm space-y-3 shadow-xs">
                <div className="flex justify-between items-center border-b border-charcoal/10 pb-2">
                  <span className="font-bold text-navy-accent text-sm">{route.routeNo}</span>
                  <span className="bg-emerald-50 text-forest-status font-bold text-xs px-2 py-0.5 border border-emerald-300 rounded-xs">
                    {route.status}
                  </span>
                </div>

                <div>
                  <strong className="text-charcoal block text-xs">{route.name}</strong>
                  <span className="text-[13px] text-slate-gray block mt-0.5">Stops: {route.stops}</span>
                </div>

                <div className="border-t border-charcoal/10 pt-2 space-y-1 text-slate-gray text-[13px]">
                  <div>Timings: <strong className="text-charcoal">{route.timings}</strong></div>
                  <div>Driver: <strong className="text-charcoal">{route.driver}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB TAB 3: CAMPUS MAINTENANCE WORK-ORDERS */}
      {activeSubTab === 'maintenance' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Wrench className="w-5 h-5 text-navy-accent" /> {isAdmin ? 'Campus Maintenance Work-Orders' : 'My Maintenance Requests'}
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">{isAdmin ? 'Every work order raised on campus; move each one through to completion.' : 'Report a campus facility problem and track its progress. Hostel room issues go to the NLP Complaint Desk.'}</p>
            </div>
            <button 
              onClick={() => setShowNewTicketModal(true)}
              className="bg-navy-accent hover:bg-charcoal text-white text-xs font-semibold px-4 py-2 rounded-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              <PlusCircle className="w-4 h-4" /> Raise Maintenance Ticket
            </button>
          </div>

          {/* New Ticket Form Modal */}
          {showNewTicketModal && (
            <form onSubmit={handleCreateTicket} className="border border-navy-accent/30 bg-navy-accent/5 p-5 rounded-sm space-y-4">
              <h4 className="font-bold text-charcoal text-sm uppercase">Submit Maintenance Complaint Work-Order</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Issue Type</label>
                  <select 
                    value={newType} 
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs font-mono text-charcoal rounded-xs"
                  >
                    <option>Electrical Complaint</option>
                    <option>Plumbing Complaint</option>
                    <option>AC/Fan Maintenance</option>
                    <option>Cleaning Request</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Exact Location *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Block A - Room 304"
                    value={newLocation} 
                    onChange={(e) => setNewLocation(e.target.value)}
                    required
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs font-mono text-charcoal rounded-xs"
                  />
                </div>
                <div>
                  <label className="block text-[13px] text-slate-gray mb-1">Issue Description *</label>
                  <input 
                    type="text" 
                    placeholder="Brief detail of issue..."
                    value={newIssue} 
                    onChange={(e) => setNewIssue(e.target.value)}
                    required
                    className="w-full p-2 border border-charcoal/20 bg-white text-xs font-mono text-charcoal rounded-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-3 py-1.5 border border-charcoal/20 text-xs font-mono text-charcoal rounded-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-navy-accent text-white text-xs font-mono font-bold rounded-xs shadow-xs"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          )}

          {/* Maintenance Ticket List */}
          <div className="space-y-3">
            {!ticketsApi.loading && tickets.length === 0 && (
              <div className="border border-dashed border-charcoal/20 p-6 text-center text-slate-gray text-sm">
                {isAdmin ? 'No work orders.' : 'You have not raised any maintenance requests.'}
              </div>
            )}
            {tickets.map((t) => (
              <div key={t.id} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy-accent">{t.id}</span>
                    <span className="bg-charcoal/10 text-charcoal text-xs font-bold px-2 py-0.5 rounded-xs">{t.type}</span>
                    <span className="text-slate-gray text-xs">{t.date}</span>
                  </div>
                  <h4 className="font-bold text-charcoal text-sm">{t.issue}</h4>
                  <p className="text-xs text-slate-gray">Location: <strong>{t.location}</strong></p>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-1 border rounded-xs ${
                    t.status === 'COMPLETED' ? 'text-forest-status border-forest-status/30 bg-emerald-50' :
                    t.status === 'IN PROGRESS' ? 'text-amber-800 border-amber-300 bg-amber-50' : 'text-rose-700 border-rose-200 bg-rose-50'
                  }`}>
                    {t.status}
                  </span>
                  {isAdmin && NEXT_TICKET_STATUS[t.status] && (
                    <button onClick={() => advanceTicket(t)}
                      className="border border-navy-accent text-navy-accent hover:bg-navy-accent hover:text-white px-2.5 py-1 text-xs font-bold uppercase rounded-xs">
                      Mark {NEXT_TICKET_STATUS[t.status]}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB TAB 4: ASSET & INVENTORY CONTROL */}
      {isAdmin && activeSubTab === 'assets' && (
        <div className="border border-charcoal/15 bg-surface-white p-6 rounded-sm shadow-sm space-y-6 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-charcoal/10 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-charcoal flex items-center gap-2">
                <Package className="w-5 h-5 text-navy-accent" /> Institutional Asset & Inventory Control (Module 14)
              </h3>
              <p className="text-xs text-slate-gray mt-0.5">Tracking computer workstations, lab instruments, projectors, and procurement.</p>
            </div>
            <span className="bg-navy-accent/10 text-navy-accent font-bold px-3 py-1 rounded-xs">
              TOTAL AUDITED ASSETS: 1,420 UNITS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CAMPUS_ASSETS.map((asset) => (
              <div key={asset.assetId} className="border border-charcoal/15 bg-warm-ivory/30 p-4 rounded-sm space-y-2 shadow-xs">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-navy-accent">{asset.assetId}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 border rounded-xs ${
                    asset.status === 'OPERATIONAL' || asset.status === 'ASSIGNED' ? 'text-forest-status border-emerald-300 bg-emerald-50' : 'text-rose-700 border-rose-300 bg-rose-50'
                  }`}>
                    {asset.status}
                  </span>
                </div>
                <h4 className="font-bold text-charcoal text-sm">{asset.name}</h4>
                <div className="flex justify-between text-slate-gray text-[13px] border-t border-charcoal/10 pt-2">
                  <span>Category: <strong>{asset.category}</strong></span>
                  <span>Location: <strong>{asset.location}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
