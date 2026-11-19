export type MoodValue = 1 | 2 | 3 | 4 | 5;

export type MoodEntry = {
  date: string; // YYYY-MM-DD (local date)
  mood: MoodValue;
  timestamp: number;
};

const MOOD_STORAGE_KEY = 'postpartum-mood-log';

// Ordinal ramp validated with dataviz skill's validate_palette.js (--ordinal):
// single hue (rose, matching brand), monotone lightness, light end clears
// 2:1 contrast on a white card surface, all adjacent steps >= 0.06 delta-L.
export const MOOD_LEVELS: { value: MoodValue; emoji: string; label: string; color: string }[] = [
  { value: 1, emoji: '😞', label: 'つらい', color: '#fd7d8b' },
  { value: 2, emoji: '😕', label: 'いまいち', color: '#ef586e' },
  { value: 3, emoji: '😐', label: 'ふつう', color: '#da3456' },
  { value: 4, emoji: '🙂', label: 'まあまあ良い', color: '#bd1642' },
  { value: 5, emoji: '😄', label: '良い', color: '#9c0232' },
];

export function moodLevel(mood: MoodValue) {
  return MOOD_LEVELS[mood - 1];
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadMoodLog(): MoodEntry[] {
  try {
    const raw = localStorage.getItem(MOOD_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is MoodEntry =>
        e && typeof e.date === 'string' && typeof e.mood === 'number' && typeof e.timestamp === 'number'
    );
  } catch {
    return [];
  }
}

export function saveTodaysMood(mood: MoodValue): MoodEntry[] {
  const log = loadMoodLog();
  const date = todayKey();
  const entry: MoodEntry = { date, mood, timestamp: Date.now() };
  const existingIndex = log.findIndex((e) => e.date === date);
  const next = existingIndex >= 0 ? [...log] : [...log, entry];
  if (existingIndex >= 0) next[existingIndex] = entry;
  next.sort((a, b) => a.date.localeCompare(b.date));
  try {
    localStorage.setItem(MOOD_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — keep working in-memory for this session
  }
  return next;
}

export function todaysMood(log: MoodEntry[]): MoodEntry | undefined {
  const date = todayKey();
  return log.find((e) => e.date === date);
}
