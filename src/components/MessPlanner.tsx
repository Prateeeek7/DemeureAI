import React, { useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { Utensils, Star, RefreshCw, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Coffee, Sun, Cookie, Moon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, errorMessage } from '../lib/api';
import { useApi } from '../lib/useApi';

interface PublishedMenu {
  days: WeeklyMenuItem[] | null;
  updatedAt: string | null;
}

interface StudentReview {
  id: string;
  studentName: string;
  rating: number;
  suggestion: string;
  meal: string;
  timestamp: string;
}

interface WeeklyMenuItem {
  day: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
}

interface MessPlannerProps {
  currentRole: string;
}

const DEFAULT_WEEKLY_MENU: WeeklyMenuItem[] = [
  { day: 'Monday',    breakfast: 'Poha with Sev & Green Chutney',         lunch: 'Dal Makhani, Jeera Rice, Chapati, Salad',         snacks: 'Masala Chai & Samosa',           dinner: 'Paneer Butter Masala, Naan, Raita' },
  { day: 'Tuesday',   breakfast: 'Idli-Sambhar with Coconut Chutney',     lunch: 'Rajma Chawal, Roti, Cucumber Salad',              snacks: 'Banana & Roasted Chana',         dinner: 'Aloo Matar Sabzi, Chapati, Dal Tadka' },
  { day: 'Wednesday', breakfast: 'Paratha with Curd & Pickle',            lunch: 'Chole Bhature, Onion Salad',                     snacks: 'Bread Pakoda & Imli Chutney',    dinner: 'Mix Veg Curry, Rice, Roti' },
  { day: 'Thursday',  breakfast: 'Upma with Peanuts & Lemon',             lunch: 'Kadhi Pakoda, Jeera Rice, Papad',                snacks: 'Fruit Chaat',                    dinner: 'Baingan Bharta, Chapati, Dal Fry' },
  { day: 'Friday',    breakfast: 'Bread Toast with Butter & Boiled Egg',  lunch: 'Palak Paneer, Roti, Salad',                      snacks: 'Veg Puff & Chai',                dinner: 'Chana Masala, Puri, Raita' },
  { day: 'Saturday',  breakfast: 'Puri Bhaji (Aloo Sabzi)',               lunch: 'Special Biryani, Raita, Pickle',                 snacks: 'Ice Cream (Vanilla/Kesar Pista)', dinner: 'Shahi Paneer, Naan, Phirni Dessert' },
  { day: 'Sunday',    breakfast: 'Aloo Paratha with Curd & Butter',       lunch: 'Dal Tadka, Jeera Rice, Mix Sabzi, Salad',        snacks: 'Maggi & Green Tea',              dinner: 'Veg Pulao, Kadhi, Papad, Chaas' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_CONFIG = [
  { key: 'breakfast' as keyof WeeklyMenuItem, label: 'Breakfast', icon: Coffee,  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  { key: 'lunch'     as keyof WeeklyMenuItem, label: 'Lunch',     icon: Sun,     color: 'text-navy-accent', bg: 'bg-blue-50',    border: 'border-blue-200' },
  { key: 'snacks'    as keyof WeeklyMenuItem, label: 'Snacks',    icon: Cookie,  color: 'text-forest-status', bg: 'bg-green-50', border: 'border-green-200' },
  { key: 'dinner'    as keyof WeeklyMenuItem, label: 'Dinner',    icon: Moon,    color: 'text-slate-gray',  bg: 'bg-slate-50',   border: 'border-slate-200' },
];

export default function MessPlanner({ currentRole }: MessPlannerProps) {
  const menuApi = useApi<PublishedMenu>('/api/mess/menu');
  const weeklyMenu = menuApi.data?.days ?? DEFAULT_WEEKLY_MENU;
  const [feedbackError, setFeedbackError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackMeal, setFeedbackMeal] = useState<string>('Lunch');
  const [studentSuggestion, setStudentSuggestion] = useState<string>('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reviewsApi = useApi<StudentReview[]>('/api/mess/reviews');
  const reviews = reviewsApi.data ?? [];

  const forecastData = [
    { day: 'Mon', Forecast: 320, Actual: 312 },
    { day: 'Tue', Forecast: 340, Actual: 338 },
    { day: 'Wed', Forecast: 310, Actual: 295 },
    { day: 'Thu', Forecast: 300, Actual: 304 },
    { day: 'Fri', Forecast: 280, Actual: 245 },
    { day: 'Sat', Forecast: 180, Actual: 165 },
    { day: 'Sun', Forecast: 190, Actual: 198 },
  ];

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0,
  })).reverse();

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (feedbackRating === 0 || !studentSuggestion.trim()) {
      setFeedbackError('Choose a star rating and write a short suggestion.');
      return;
    }
    setFeedbackError('');
    try {
      const saved = await api.post<StudentReview>('/api/mess/reviews', {
        rating: feedbackRating, meal: feedbackMeal, suggestion: studentSuggestion.trim(),
      });
      reviewsApi.setData(prev => [saved, ...(prev ?? [])]);
      setFeedbackSuccess(true);
      setStudentSuggestion('');
      setFeedbackRating(0);
      setTimeout(() => setFeedbackSuccess(false), 3000);
    } catch (err) {
      setFeedbackError(errorMessage(err));
    }
  };

  const publishMenu = async (days: WeeklyMenuItem[]) => {
    try {
      const published = await api.put<PublishedMenu>('/api/mess/menu', { days });
      menuApi.setData(() => published);
      setUploadStatus('success');
    } catch (err) {
      setUploadStatus('error');
      setUploadError(`Parsed, but publishing failed: ${errorMessage(err)}`);
    }
  };

  // ── OCR / Excel parsing ───────────────────────────────────────────────────
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    setUploadStatus('parsing');
    setUploadError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
          throw new Error('Excel file has no data rows.');
        }

        // Find header row - look for "Day" column
        let headerRow = -1;
        const colMap: Record<string, number> = {};
        for (let i = 0; i < Math.min(rows.length, 5); i++) {
          const r = rows[i].map((c: unknown) => String(c ?? '').toLowerCase().trim());
          if (r.includes('day')) {
            headerRow = i;
            r.forEach((col, idx) => { colMap[col] = idx; });
            break;
          }
        }

        if (headerRow === -1) throw new Error('No "Day" column found. Please follow the template format.');

        const parsed: WeeklyMenuItem[] = [];
        for (let i = headerRow + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          const dayRaw = String(row[colMap['day']] ?? '').trim();
          if (!dayRaw) continue;

          // Match day name (case insensitive)
          const day = DAYS_OF_WEEK.find(d => d.toLowerCase() === dayRaw.toLowerCase()) ?? dayRaw;

          parsed.push({
            day,
            breakfast: String(row[colMap['breakfast']] ?? row[1] ?? '—').trim(),
            lunch:     String(row[colMap['lunch']]     ?? row[2] ?? '—').trim(),
            snacks:    String(row[colMap['snacks']]    ?? row[3] ?? '—').trim(),
            dinner:    String(row[colMap['dinner']]    ?? row[4] ?? '—').trim(),
          });
        }

        if (parsed.length === 0) throw new Error('No valid menu rows found in the sheet.');
        if (parsed.length > 7) throw new Error('The sheet has more than 7 day rows.');
        const tooLong = parsed.find(p => [p.breakfast, p.lunch, p.snacks, p.dinner].some(m => m.length > 200));
        if (tooLong) throw new Error(`A menu cell for ${tooLong.day} is longer than 200 characters.`);

        publishMenu(parsed);
      } catch (err) {
        setUploadStatus('error');
        setUploadError(errorMessage(err) || 'Failed to parse the file.');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const currentDayMenu = weeklyMenu.find(m => m.day === selectedDay) ?? weeklyMenu[0];

  // ── TODAY'S highlight (auto-select today) ─────────────────────────────────
  const todayIdx = new Date().getDay(); // 0=Sun
  const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][todayIdx];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Module Header */}
      <div className="border-b border-charcoal/10 pb-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate-gray">Module // 05</span>
        <h2 className="font-serif text-3xl font-bold text-navy-accent">Smart Mess Optimizer &amp; Dietary Forecasting</h2>
      </div>

      {/* ══════════════════════════════════════════════════════════
          STUDENT VIEW – Weekly Menu + Rating Form
      ══════════════════════════════════════════════════════════ */}
      {currentRole === 'Student' && (
        <div className="space-y-8">

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
            {[
              { label: 'Avg Food Rating', value: `★ ${avgRating} / 5`, color: 'text-navy-accent' },
              { label: 'Total Reviews', value: `${reviews.length} Submitted`, color: 'text-charcoal' },
              { label: 'Menu Updated', value: 'This Week', color: 'text-forest-status' },
              { label: 'Meals Per Day', value: '4 Meals', color: 'text-charcoal' },
            ].map(s => (
              <div key={s.label} className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
                <span className="text-slate-gray uppercase text-xs block">{s.label}</span>
                <span className={`font-serif text-xl font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Weekly Menu Table */}
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-charcoal/5 pb-3">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-navy-accent" />
                <h3 className="font-serif font-bold text-xl text-charcoal">Weekly Mess Menu</h3>
              </div>
              <span className="font-mono text-xs text-slate-gray uppercase bg-warm-ivory border border-charcoal/10 px-2 py-1">
                Today: {todayName}
              </span>
            </div>

            {/* Day selector tabs */}
            <div className="flex flex-wrap gap-1.5">
              {weeklyMenu.map(m => (
                <button
                  key={m.day}
                  onClick={() => setSelectedDay(m.day)}
                  className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border transition-colors ${
                    selectedDay === m.day
                      ? 'bg-navy-accent text-surface-white border-navy-accent'
                      : m.day === todayName
                        ? 'border-forest-status text-forest-status bg-green-50'
                        : 'border-charcoal/10 text-charcoal hover:bg-warm-ivory'
                  }`}
                >
                  {m.day.slice(0, 3)}
                  {m.day === todayName && <span className="ml-1 text-xs">●</span>}
                </button>
              ))}
            </div>

            {/* Selected day menu cards */}
            {currentDayMenu && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MEAL_CONFIG.map(meal => {
                  const Icon = meal.icon;
                  return (
                    <div key={meal.key} className={`border ${meal.border} ${meal.bg} p-4 space-y-2`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${meal.color}`} />
                        <span className={`font-mono text-xs uppercase font-bold tracking-wider ${meal.color}`}>
                          {meal.label}
                        </span>
                      </div>
                      <p className="font-sans text-sm font-semibold text-charcoal leading-snug">
                        {currentDayMenu[meal.key]}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full week overview table */}
            <details className="border border-charcoal/10">
              <summary className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-slate-gray cursor-pointer hover:bg-warm-ivory select-none">
                View Full Week at a Glance ▾
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs border-collapse">
                  <thead>
                    <tr className="bg-navy-accent text-surface-white">
                      <th className="p-2 text-left font-bold uppercase">Day</th>
                      <th className="p-2 text-left font-bold uppercase">🌅 Breakfast</th>
                      <th className="p-2 text-left font-bold uppercase">☀️ Lunch</th>
                      <th className="p-2 text-left font-bold uppercase">🍪 Snacks</th>
                      <th className="p-2 text-left font-bold uppercase">🌙 Dinner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyMenu.map((row, idx) => (
                      <tr
                        key={row.day}
                        className={`border-b border-charcoal/5 cursor-pointer transition-colors ${
                          row.day === selectedDay ? 'bg-blue-50' : row.day === todayName ? 'bg-green-50' : idx % 2 === 0 ? 'bg-surface-white' : 'bg-warm-ivory'
                        }`}
                        onClick={() => setSelectedDay(row.day)}
                      >
                        <td className="p-2 font-bold text-charcoal whitespace-nowrap">
                          {row.day}
                          {row.day === todayName && <span className="ml-1 text-forest-status text-xs">TODAY</span>}
                        </td>
                        <td className="p-2 text-charcoal/80">{row.breakfast}</td>
                        <td className="p-2 text-charcoal/80">{row.lunch}</td>
                        <td className="p-2 text-charcoal/80">{row.snacks}</td>
                        <td className="p-2 text-charcoal/80">{row.dinner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* Student Rating & Suggestion Form */}
          <div className="border border-charcoal/10 bg-surface-white p-6 space-y-5">
            <div className="border-b border-charcoal/5 pb-3">
              <h3 className="font-serif font-bold text-lg text-charcoal">Rate Today's Meal &amp; Suggest Improvements</h3>
              <p className="font-mono text-xs text-slate-gray mt-1">
                Your feedback directly influences the AI menu planner. Low ratings trigger automatic menu re-adaptation.
              </p>
            </div>

            <form onSubmit={handleAddReview} className="space-y-5 font-mono text-xs">
              {/* Meal selector */}
              <div className="space-y-1.5">
                <label className="text-slate-gray uppercase text-xs tracking-wider block">Which Meal Are You Rating?</label>
                <div className="flex flex-wrap gap-2">
                  {['Breakfast', 'Lunch', 'Snacks', 'Dinner'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFeedbackMeal(m)}
                      className={`px-3 py-1.5 border text-xs uppercase tracking-wider transition-colors ${
                        feedbackMeal === m ? 'bg-navy-accent text-surface-white border-navy-accent' : 'border-charcoal/10 text-charcoal hover:bg-warm-ivory'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center justify-between border-t border-b border-charcoal/5 py-3">
                <span className="text-charcoal font-semibold">Your Rating for {feedbackMeal}:</span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} star${star === 1 ? '' : 's'}`}
                      aria-pressed={star <= feedbackRating}
                      onClick={() => setFeedbackRating(star)}
                      className="hover:scale-125 transition-transform"
                    >
                      <Star className={`w-6 h-6 ${star <= feedbackRating ? 'fill-navy-accent text-navy-accent' : 'text-slate-gray/20'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggestion textarea */}
              <div className="space-y-1">
                <label className="block text-slate-gray uppercase text-xs tracking-wider">Your Suggestion / Feedback</label>
                <textarea
                  aria-label="Your suggestion"
                  maxLength={500}
                  value={studentSuggestion}
                  onChange={(e) => setStudentSuggestion(e.target.value)}
                  placeholder="E.g. The paneer was too spicy, please make it milder or substitute with mushroom curry next time…"
                  className="w-full h-20 bg-warm-ivory border border-charcoal/10 p-3 text-charcoal outline-none focus:border-navy-accent resize-none placeholder-slate-gray/30 text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-navy-accent hover:bg-charcoal text-surface-white py-3 uppercase tracking-wider text-[13px] transition-colors"
              >
                Submit Food Feedback
              </button>
            </form>

            {feedbackError && (
              <div role="alert" className="border border-red-700/20 p-3 text-center text-xs font-mono text-red-700">{feedbackError}</div>
            )}
            {feedbackSuccess && (
              <div role="status" className="border border-forest-status/30 bg-green-50 p-3 text-center text-xs font-mono text-forest-status flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Feedback submitted! The mess manager can now see it.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MESS MANAGER / ADMIN VIEW
      ══════════════════════════════════════════════════════════ */}
      {(currentRole === 'MessManager' || currentRole === 'Admin') && (
        <div className="space-y-8">

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Avg Food Rating</span>
              <span className="font-serif text-2xl font-bold text-navy-accent">★ {avgRating} / 5</span>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Total Reviews</span>
              <span className="font-serif text-2xl font-bold text-charcoal">{reviews.length}</span>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Waste Reduction</span>
              <span className="font-serif text-2xl font-bold text-forest-status">34.2%</span>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Menu Source</span>
              <span className={`font-serif text-xl font-bold ${menuApi.data?.days ? 'text-forest-status' : 'text-charcoal'}`}>
                {menuApi.data?.days ? '✓ Published' : 'Default Template'}
              </span>
              {menuApi.data?.updatedAt && <span className="text-slate-gray text-xs block">{menuApi.data.updatedAt}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* LEFT: Excel Upload + Attendance Chart */}
            <div className="lg:col-span-7 space-y-6">

              {/* ── Excel Upload Panel ── */}
              <div className="border border-charcoal/10 bg-surface-white p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-charcoal/5 pb-3">
                  <FileSpreadsheet className="w-5 h-5 text-navy-accent" />
                  <h3 className="font-serif font-bold text-lg text-charcoal">Upload Weekly Menu via Excel</h3>
                </div>

                <p className="font-mono text-[13px] text-slate-gray leading-relaxed">
                  Upload an <strong>.xlsx</strong> or <strong>.xls</strong> file following the column format:{' '}
                  <span className="text-navy-accent font-bold">Day | Breakfast | Lunch | Snacks | Dinner</span>.
                  The system will parse and apply the menu instantly across all student views.
                </p>

                {/* Drop zone */}
                <div
                  className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                    uploadStatus === 'parsing' ? 'border-amber-400 bg-amber-50' :
                    uploadStatus === 'success' ? 'border-forest-status bg-green-50' :
                    uploadStatus === 'error'   ? 'border-red-400 bg-red-50' :
                    'border-charcoal/20 bg-warm-ivory hover:border-navy-accent hover:bg-blue-50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                  />

                  {uploadStatus === 'idle' && (
                    <div className="space-y-3">
                      <Upload className="w-10 h-10 text-slate-gray mx-auto" />
                      <div className="font-mono text-[13px] text-slate-gray">
                        <strong className="text-charcoal block text-sm">Click to select Excel file</strong>
                        Supported: .xlsx, .xls — Max size: 10 MB
                      </div>
                    </div>
                  )}

                  {uploadStatus === 'parsing' && (
                    <div className="space-y-3">
                      <RefreshCw className="w-10 h-10 text-amber-600 mx-auto animate-spin" />
                      <div className="font-mono text-[13px] text-amber-700">
                        <strong className="block">Parsing Excel data…</strong>
                        Reading sheet rows and extracting menu data
                      </div>
                    </div>
                  )}

                  {uploadStatus === 'success' && (
                    <div className="space-y-3">
                      <CheckCircle className="w-10 h-10 text-forest-status mx-auto" />
                      <div className="font-mono text-[13px] text-forest-status">
                        <strong className="block text-sm">Menu Published to Students!</strong>
                        {uploadFileName} — {weeklyMenu.length} days loaded
                      </div>
                      <span className="text-xs text-slate-gray">Click to upload a different file</span>
                    </div>
                  )}

                  {uploadStatus === 'error' && (
                    <div className="space-y-3">
                      <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
                      <div className="font-mono text-[13px] text-red-700">
                        <strong className="block">Parse Error</strong>
                        {uploadError}
                      </div>
                      <span className="text-xs text-slate-gray">Click to try again</span>
                    </div>
                  )}
                </div>

                {/* Template hint */}
                <div className="bg-warm-ivory border border-charcoal/5 p-3 font-mono text-xs text-slate-gray space-y-1">
                  <div className="font-bold text-charcoal uppercase tracking-wider text-xs">Expected Excel Format (Row 1 = Headers):</div>
                  <div className="grid grid-cols-5 gap-1 border border-charcoal/10 p-1 bg-surface-white text-xs text-center font-bold text-navy-accent">
                    <span>Day</span><span>Breakfast</span><span>Lunch</span><span>Snacks</span><span>Dinner</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 border border-charcoal/10 p-1 bg-surface-white text-xs text-center text-charcoal/70">
                    <span>Monday</span><span>Poha…</span><span>Dal…</span><span>Samosa…</span><span>Paneer…</span>
                  </div>
                </div>
              </div>

              {/* Attendance Chart */}
              <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-navy-accent" />
                    <h3 className="font-serif font-bold text-lg text-charcoal">Attendance Predictions vs Actual</h3>
                  </div>
                  <span className="font-mono text-xs text-slate-gray">Last 7 Days</span>
                </div>
                <div className="border border-charcoal/10 bg-warm-ivory blueprint-grid-accent p-4">
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={forecastData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#111827" strokeOpacity={0.06} />
                        <XAxis dataKey="day" stroke="#4B5563" style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }} />
                        <YAxis stroke="#4B5563" style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#F8F6F2', border: '1px solid #111827', borderRadius: 0, fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, paddingTop: 8 }} />
                        <Bar dataKey="Forecast" name="Model Prediction" fill="#4B5563" />
                        <Bar dataKey="Actual"   name="Actual Swipes"    fill="#1E3A5F" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="font-mono text-xs text-slate-gray">*Model accounts for Friday–Sunday exit trends and exam calendars.</p>
              </div>
            </div>

            {/* RIGHT: Reviews + Rating Distribution */}
            <div className="lg:col-span-5 space-y-6">

              {/* Rating breakdown */}
              <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-charcoal/5 pb-3">
                  <h3 className="font-serif font-bold text-lg text-charcoal">Food Rating Overview</h3>
                  <div className="text-right">
                    <span className="block font-serif text-2xl font-bold text-navy-accent">★ {avgRating}</span>
                    <span className="font-mono text-xs text-slate-gray">{reviews.length} total feedbacks</span>
                  </div>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  {ratingDistribution.map(({ star, count, pct }) => (
                    <div key={star} className="flex items-center gap-2">
                      <span className="text-slate-gray w-4 text-right">{star}★</span>
                      <div className="flex-1 bg-warm-ivory h-3 border border-charcoal/10 overflow-hidden">
                        <div
                          className="h-full bg-navy-accent transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-charcoal w-8">{count}</span>
                      <span className="text-slate-gray w-8">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Student Reviews Feed */}
              <div className="border border-charcoal/10 bg-surface-white p-6 space-y-4">
                <h3 className="font-serif font-bold text-lg text-charcoal border-b border-charcoal/5 pb-3">
                  Student Feedback &amp; Suggestions
                </h3>

                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {reviews.map((rev) => (
                    <div key={rev.id} className="p-3 border border-charcoal/10 bg-warm-ivory font-mono text-[13px] space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-charcoal">{rev.studentName}</span>
                          <span className="ml-2 text-xs border border-charcoal/10 px-1 text-slate-gray uppercase">{rev.meal}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-navy-accent text-navy-accent' : 'text-slate-gray/20'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="text-charcoal/80 italic leading-relaxed">"{rev.suggestion}"</p>
                      <div className="text-right text-xs text-slate-gray">{rev.timestamp}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supply procurement quick view */}
              <div className="border border-charcoal/10 bg-surface-white p-6 space-y-3">
                <h3 className="font-serif font-bold text-sm text-charcoal border-b border-charcoal/5 pb-2 uppercase tracking-wider">Predictive Supply Procurement</h3>
                <table className="w-full font-mono text-xs">
                  <thead>
                    <tr className="text-slate-gray border-b border-charcoal/5">
                      <th className="text-left pb-1">Material</th>
                      <th className="text-center pb-1">Safety</th>
                      <th className="text-right pb-1">Qty Ordered</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {[
                      { item: 'Moong Dal',   safety: '95.0%', qty: '120 kg' },
                      { item: 'Basmati Rice',safety: '92.5%', qty: '200 kg' },
                      { item: 'Fresh Veggies',safety:'98.7%', qty: '150 kg' },
                      { item: 'Paneer',      safety: '88.2%', qty: '40 kg' },
                    ].map(r => (
                      <tr key={r.item} className="border-b border-charcoal/5">
                        <td className="py-1.5 font-semibold text-charcoal">{r.item}</td>
                        <td className="py-1.5 text-center text-forest-status font-bold">{r.safety}</td>
                        <td className="py-1.5 text-right text-charcoal">{r.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          WARDEN VIEW – Summary only
      ══════════════════════════════════════════════════════════ */}
      {currentRole === 'Warden' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Avg Food Rating</span>
              <span className="font-serif text-2xl font-bold text-navy-accent">★ {avgRating} / 5</span>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Waste Reduction</span>
              <span className="font-serif text-2xl font-bold text-forest-status">34.2%</span>
            </div>
            <div className="border border-charcoal/10 bg-surface-white p-4 space-y-1">
              <span className="text-slate-gray uppercase text-xs block">Student Feedback</span>
              <span className="font-serif text-2xl font-bold text-charcoal">{reviews.length} Reviews</span>
            </div>
          </div>
          <div className="border border-charcoal/10 bg-surface-white p-6 font-mono text-sm text-slate-gray text-center">
            Detailed mess management controls are accessible to the <strong className="text-charcoal">Mess Manager</strong> profile.
          </div>
        </div>
      )}
    </div>
  );
}
