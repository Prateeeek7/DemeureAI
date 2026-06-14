/**
 * generate_survey_data.cjs
 * Generates 100 realistic Indian student survey records → data/student_survey_100.xlsx
 * Run: node generate_survey_data.cjs
 */
const XLSX = require('xlsx');
const path = require('path');

// ── Indian name pools ─────────────────────────────────────────────────────────
const FIRST_M = ['Aarav','Aditya','Ajay','Akash','Amit','Ankit','Arjun','Ashish','Dev','Gaurav',
  'Harsh','Kabir','Karan','Kunal','Manish','Mohit','Nikhil','Pranav','Rahul','Rajesh',
  'Rohan','Sahil','Siddharth','Suresh','Tarun','Vikram','Vinay','Vishal','Vivek','Yash',
  'Deepak','Ravi','Pradeep','Ramesh','Sunil','Dinesh','Girish','Lokesh','Mahesh','Naveen'];
const FIRST_F = ['Aisha','Ananya','Anjali','Anushka','Arya','Bhavna','Deepika','Divya','Gauri',
  'Ishita','Kavya','Lakshmi','Meera','Megha','Neha','Nisha','Pooja','Priya','Radha','Riya',
  'Sakshi','Simran','Sneha','Sonal','Sunita','Swati','Tanvi','Trisha','Vandana','Varsha',
  'Renu','Seema','Reena','Geeta','Alka','Usha','Mamta','Poonam','Shilpa','Sushma'];
const LAST = ['Agarwal','Banerjee','Bhat','Chauhan','Desai','Dubey','Gupta','Iyer','Jain','Joshi',
  'Kapoor','Khanna','Kumar','Malhotra','Mehta','Mishra','Nair','Patel','Pillai','Rao',
  'Reddy','Sharma','Shukla','Singh','Sinha','Tiwari','Trivedi','Varma','Verma','Yadav'];
const COURSES   = ['B.Tech','B.Tech','B.Tech','M.Tech','MBA','MCA','B.Tech','M.Tech','PhD','B.Tech'];
const BRANCHES  = ['CSE','ECE','ME','Civil','EEE','IT','AI&ML','Data Science','Biotechnology','Chemical'];
const SLEEP     = ['Early Riser','Night Owl','Flexible'];
const STUDY     = ['Absolute Silence','Ambient/Music OK','Library Preferred'];
const CLEAN     = ['Strict/Scheduled','Moderate/Weekends','Relaxed/Minimal'];
const SOCIAL    = ['Quiet Sanctuary','Moderate/Occasional','Active Hub'];
const DIET      = ['Vegetarian','Non-Vegetarian','Vegan','Jain'];
const ROOM_TYPE = ['Single','Double','Suite'];
const SPECIAL   = ['None','Allergic to dust','Diabetic – low sugar diet','Requires quiet room','Near lift (mobility)','None','None','None','None','None'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(lo, hi) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

// Each block hosts a gender type
function blockForGender(g) {
  if (g === 'Male')   return pick(['A','A','A','C']);
  if (g === 'Female') return pick(['B','B','B','C']);
  return 'C';
}

const rows = [];
for (let i = 1; i <= 100; i++) {
  const gender = Math.random() < 0.55 ? 'Male' : 'Female';
  const firstName = gender === 'Male' ? pick(FIRST_M) : pick(FIRST_F);
  const lastName  = pick(LAST);
  const course    = pick(COURSES);
  const year      = course === 'PhD' ? randInt(1,4) : course === 'B.Tech' ? randInt(1,4) : randInt(1,2);
  const block     = blockForGender(gender);
  const floor     = randInt(1, 5);
  const roomPref  = pick(ROOM_TYPE);
  const rollNum   = `DE${String(2024 + Math.floor(year/2)).slice(-2)}${pick(BRANCHES).replace(/[&\/]/g,'').slice(0,3).toUpperCase()}${String(i).padStart(3,'0')}`;

  rows.push({
    'Student ID':           `STU-${String(i).padStart(3,'0')}`,
    'Full Name':            `${firstName} ${lastName}`,
    'Roll Number':          rollNum,
    'Email':                `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demeure.ac.in`,
    'Gender':               gender,
    'Course':               course,
    'Branch':               pick(BRANCHES),
    'Year of Study':        `Year ${year}`,
    'Preferred Block':      block,
    'Preferred Floor':      floor,
    'Room Type Preference': roomPref,
    'Sleep Habit':          pick(SLEEP),
    'Study Environment':    pick(STUDY),
    'Cleanliness Index':    pick(CLEAN),
    'Social Preference':    pick(SOCIAL),
    'Dietary Preference':   pick(DIET),
    'Special Needs':        pick(SPECIAL),
    'Submitted At':         new Date(Date.now() - randInt(0, 30) * 86400000).toLocaleDateString('en-IN'),
    // Numeric encoding for ML model
    'sleep_vec':            pick(SLEEP) === 'Early Riser' ? 0 : pick(SLEEP) === 'Night Owl' ? 1 : 2,
    'study_vec':            pick(STUDY) === 'Absolute Silence' ? 0 : pick(STUDY) === 'Ambient/Music OK' ? 1 : 2,
    'clean_vec':            pick(CLEAN) === 'Strict/Scheduled' ? 0 : pick(CLEAN) === 'Moderate/Weekends' ? 1 : 2,
    'social_vec':           pick(SOCIAL) === 'Quiet Sanctuary' ? 0 : pick(SOCIAL) === 'Moderate/Occasional' ? 1 : 2,
  });
}

const wb = XLSX.utils.book_new();

// Sheet 1: Full Survey Data
const ws1 = XLSX.utils.json_to_sheet(rows);
ws1['!cols'] = [
  {wch:12},{wch:22},{wch:18},{wch:32},{wch:8},{wch:8},{wch:14},{wch:10},
  {wch:14},{wch:14},{wch:18},{wch:14},{wch:18},{wch:18},{wch:18},{wch:16},
  {wch:24},{wch:14},{wch:10},{wch:10},{wch:10},{wch:10}
];
XLSX.utils.book_append_sheet(wb, ws1, 'Survey Responses');

// Sheet 2: ML Feature Matrix (only numeric vectors)
const mlRows = rows.map(r => ({
  'student_id':    r['Student ID'],
  'name':          r['Full Name'],
  'block':         r['Preferred Block'],
  'floor':         r['Preferred Floor'],
  'room_type':     r['Room Type Preference'],
  'sleep_vec':     r['sleep_vec'],
  'study_vec':     r['study_vec'],
  'clean_vec':     r['clean_vec'],
  'social_vec':    r['social_vec'],
  'gender_bin':    r['Gender'] === 'Male' ? 0 : 1,
  'veg_bin':       ['Vegetarian','Vegan','Jain'].includes(r['Dietary Preference']) ? 1 : 0,
}));
const ws2 = XLSX.utils.json_to_sheet(mlRows);
ws2['!cols'] = [{wch:12},{wch:22},{wch:8},{wch:8},{wch:12},{wch:10},{wch:10},{wch:10},{wch:10},{wch:10},{wch:8}];
XLSX.utils.book_append_sheet(wb, ws2, 'ML Feature Matrix');

// Sheet 3: Block summary
const blockSummary = ['A','B','C'].map(b => ({
  'Block': b,
  'Total Students': rows.filter(r => r['Preferred Block'] === b).length,
  'Males': rows.filter(r => r['Preferred Block'] === b && r['Gender'] === 'Male').length,
  'Females': rows.filter(r => r['Preferred Block'] === b && r['Gender'] === 'Female').length,
  'Single Room Pref': rows.filter(r => r['Preferred Block'] === b && r['Room Type Preference'] === 'Single').length,
  'Double Room Pref': rows.filter(r => r['Preferred Block'] === b && r['Room Type Preference'] === 'Double').length,
  'Suite Pref': rows.filter(r => r['Preferred Block'] === b && r['Room Type Preference'] === 'Suite').length,
}));
const ws3 = XLSX.utils.json_to_sheet(blockSummary);
XLSX.utils.book_append_sheet(wb, ws3, 'Block Summary');

const outPath = path.join(__dirname, 'data', 'student_survey_100.xlsx');
XLSX.writeFile(wb, outPath);
console.log(`✅  Generated: ${outPath}`);
console.log(`    Rows: ${rows.length} | Sheets: Survey Responses, ML Feature Matrix, Block Summary`);
