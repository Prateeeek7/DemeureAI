// Shared survey types and the ML feature encoder used for exports and previews.

export interface SurveyEntry {
  id: string;
  studentId: string;
  fullName: string;
  rollNumber: string;
  email: string;
  gender: string;
  course: string;
  branch: string;
  yearOfStudy: string;
  preferredBlock: string;
  preferredFloor: string;
  roomTypePref: string;
  sleepHabit: string;
  studyEnv: string;
  cleanliness: string;
  socialPref: string;
  dietaryPref: string;
  specialNeeds: string;
  submittedAt: string;
}

// ── ML vector encoder ─────────────────────────────────────────────────────────
export function encodeVector(entry: SurveyEntry) {
  const sleepMap:  Record<string, number> = { 'Early Riser': 0, 'Night Owl': 1, 'Flexible': 2 };
  const studyMap:  Record<string, number> = { 'Absolute Silence': 0, 'Ambient / Music OK': 1, 'Library Preferred': 2 };
  const cleanMap:  Record<string, number> = { 'Strict / Scheduled': 0, 'Moderate / Weekends': 1, 'Relaxed / Minimal': 2 };
  const socialMap: Record<string, number> = { 'Quiet Sanctuary': 0, 'Moderate / Occasional': 1, 'Active Hub': 2 };
  return {
    sleep_vec:  sleepMap[entry.sleepHabit]  ?? -1,
    study_vec:  studyMap[entry.studyEnv]    ?? -1,
    clean_vec:  cleanMap[entry.cleanliness] ?? -1,
    social_vec: socialMap[entry.socialPref] ?? -1,
    gender_bin: entry.gender === 'Male' ? 0 : 1,
    veg_bin:    ['Vegetarian', 'Vegan', 'Jain'].includes(entry.dietaryPref) ? 1 : 0,
  };
}
