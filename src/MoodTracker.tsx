import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { MOOD_LEVELS, MoodEntry, MoodValue, loadMoodLog, moodLevel, saveTodaysMood, todaysMood } from './mood';

const CHART_WIDTH = 300;
const CHART_HEIGHT = 130;
const GUTTER = 30;
const PLOT_WIDTH = CHART_WIDTH - GUTTER - 8;
const MAX_POINTS = 14;

function rowY(mood: MoodValue): number {
  // mood 5 (top) -> small y, mood 1 (bottom) -> large y
  const step = CHART_HEIGHT / (MOOD_LEVELS.length + 1);
  return CHART_HEIGHT - step * mood;
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function MoodTrackerModal({ onClose }: { onClose: () => void }) {
  const [log, setLog] = useState<MoodEntry[]>(() => loadMoodLog());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const today = todaysMood(log);

  const recent = useMemo(() => log.slice(-MAX_POINTS), [log]);

  const points = useMemo(
    () =>
      recent.map((entry, i) => {
        const x = recent.length === 1 ? GUTTER + PLOT_WIDTH / 2 : GUTTER + (PLOT_WIDTH * i) / (recent.length - 1);
        const y = rowY(entry.mood);
        return { ...entry, x, y };
      }),
    [recent]
  );

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const handlePick = (mood: MoodValue) => {
    const next = saveTodaysMood(mood);
    setLog(next);
    setSelectedIndex(null);
  };

  const selected = selectedIndex !== null ? points[selectedIndex] : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-700">今日の気分は？</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-full p-1.5 text-rose-300 hover:bg-rose-50 hover:text-rose-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-2 flex justify-between gap-1">
          {MOOD_LEVELS.map((level) => {
            const isSelected = today?.mood === level.value;
            return (
              <button
                key={level.value}
                onClick={() => handlePick(level.value)}
                aria-label={level.label}
                className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-all ${
                  isSelected ? 'bg-rose-50 ring-2 ring-rose-300' : 'hover:bg-rose-50/60'
                }`}
              >
                <span className="text-2xl leading-none">{level.emoji}</span>
                <span className="text-[10px] text-gray-500">{level.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mb-5 text-center text-xs text-rose-300">
          {today ? `今日の記録：${moodLevel(today.mood).emoji} ${moodLevel(today.mood).label}` : '今日はまだ記録がありません'}
        </p>

        <h3 className="mb-2 text-sm font-bold text-gray-700">最近の気分の推移</h3>

        {points.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            まだ記録がありません。今日の気分を記録してみましょう。
          </p>
        ) : (
          <>
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT + 16}`} className="w-full" role="img" aria-label="気分の推移グラフ">
              {MOOD_LEVELS.map((level) => (
                <g key={level.value}>
                  <line
                    x1={GUTTER}
                    x2={CHART_WIDTH}
                    y1={rowY(level.value)}
                    y2={rowY(level.value)}
                    stroke="#e1e0d9"
                    strokeWidth={1}
                  />
                  <text x={GUTTER - 10} y={rowY(level.value)} textAnchor="end" dominantBaseline="middle" fontSize={11}>
                    {level.emoji}
                  </text>
                </g>
              ))}

              {points.length > 1 && <path d={linePath} fill="none" stroke="#fda4af" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}

              {points.map((p, i) => (
                <circle
                  key={p.date}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={moodLevel(p.mood).color}
                  stroke="#ffffff"
                  strokeWidth={2}
                  onClick={() => setSelectedIndex(i)}
                  style={{ cursor: 'pointer' }}
                />
              ))}

              <text x={GUTTER} y={CHART_HEIGHT + 14} fontSize={10} fill="#898781">
                {formatShortDate(points[0].date)}
              </text>
              {points.length > 1 && (
                <text x={CHART_WIDTH} y={CHART_HEIGHT + 14} fontSize={10} fill="#898781" textAnchor="end">
                  {formatShortDate(points[points.length - 1].date)}
                </text>
              )}
            </svg>

            <p className="mt-1 text-center text-xs text-gray-500">
              {selected
                ? `${formatShortDate(selected.date)}：${moodLevel(selected.mood).emoji} ${moodLevel(selected.mood).label}`
                : '点をタップすると日付が見られます'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
