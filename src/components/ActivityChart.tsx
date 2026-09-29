import React, { useState } from 'react';
import { IntelligenceEvent } from '../types/intelligence.ts';

interface ActivityChartProps {
  events: IntelligenceEvent[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ events }) => {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  // Group events by YYYY-MM
  const monthsMap = new Map<string, {
    pricing_change: number;
    feature_launch: number;
    company_announcement: number;
    messaging_shift: number;
    hiring_signal: number;
    partnership: number;
    total: number;
  }>();

  events.forEach((ev) => {
    const rawDate = ev.publishedDate || ev.firstObservedAt;
    const m = rawDate ? rawDate.slice(0, 7) : 'Unknown';
    if (!monthsMap.has(m)) {
      monthsMap.set(m, {
        pricing_change: 0,
        feature_launch: 0,
        company_announcement: 0,
        messaging_shift: 0,
        hiring_signal: 0,
        partnership: 0,
        total: 0,
      });
    }
    const bucket = monthsMap.get(m)!;
    const type = ev.eventType as keyof typeof bucket;
    if (bucket[type] !== undefined) {
      bucket[type] += 1;
      bucket.total += 1;
    }
  });

  // Sort chronological
  const sortedMonths = Array.from(monthsMap.keys()).sort();
  const maxTotal = Math.max(...sortedMonths.map((m) => monthsMap.get(m)?.total || 0), 6);

  const colors = {
    pricing_change: { fill: '#38bdf8', label: 'Pricing' },
    feature_launch: { fill: '#818cf8', label: 'Feature Launch' },
    hiring_signal: { fill: '#34d399', label: 'Hiring Signal' },
    partnership: { fill: '#fbbf24', label: 'Partnership' },
    messaging_shift: { fill: '#f472b6', label: 'Messaging Shift' },
    company_announcement: { fill: '#a78bfa', label: 'Announcement' },
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Observed Intelligence Momentum</h3>
          <p className="text-xs text-slate-400">
            Monthly verified competitive events by category ({events.length} total events recorded)
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          {Object.entries(colors).map(([key, info]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: info.fill }} />
              <span>{info.label}</span>
            </div>
          ))}
        </div>
      </div>

      {sortedMonths.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-500">
          No events in selected timeframe.
        </div>
      ) : (
        <div className="mt-4 pt-2">
          {/* SVG Bar Chart */}
          <div className="h-48 flex items-end gap-3 sm:gap-6 px-2">
            {sortedMonths.map((m) => {
              const data = monthsMap.get(m)!;
              const heightPct = Math.round((data.total / maxTotal) * 100);

              return (
                <div
                  key={m}
                  onMouseEnter={() => setHoveredMonth(m)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  className="flex-1 flex flex-col items-center group relative cursor-pointer h-full justify-end"
                >
                  {/* Tooltip */}
                  {hoveredMonth === m && (
                    <div className="absolute -top-24 z-20 bg-slate-950 border border-slate-700 px-3 py-2 rounded shadow-xl text-xs text-slate-100 whitespace-nowrap pointer-events-none">
                      <div className="font-semibold text-white mb-1">{m} — {data.total} moves</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
                        {data.pricing_change > 0 && <span>Pricing: {data.pricing_change}</span>}
                        {data.feature_launch > 0 && <span>Launches: {data.feature_launch}</span>}
                        {data.hiring_signal > 0 && <span>Hiring: {data.hiring_signal}</span>}
                        {data.partnership > 0 && <span>Partnership: {data.partnership}</span>}
                        {data.messaging_shift > 0 && <span>Messaging: {data.messaging_shift}</span>}
                        {data.company_announcement > 0 && <span>Announcements: {data.company_announcement}</span>}
                      </div>
                    </div>
                  )}

                  {/* Stacked bar */}
                  <div
                    className="w-full max-w-[48px] rounded-t overflow-hidden flex flex-col-reverse transition-all duration-300 group-hover:brightness-110"
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                  >
                    {data.pricing_change > 0 && (
                      <div
                        style={{
                          height: `${(data.pricing_change / data.total) * 100}%`,
                          backgroundColor: colors.pricing_change.fill,
                        }}
                      />
                    )}
                    {data.feature_launch > 0 && (
                      <div
                        style={{
                          height: `${(data.feature_launch / data.total) * 100}%`,
                          backgroundColor: colors.feature_launch.fill,
                        }}
                      />
                    )}
                    {data.hiring_signal > 0 && (
                      <div
                        style={{
                          height: `${(data.hiring_signal / data.total) * 100}%`,
                          backgroundColor: colors.hiring_signal.fill,
                        }}
                      />
                    )}
                    {data.partnership > 0 && (
                      <div
                        style={{
                          height: `${(data.partnership / data.total) * 100}%`,
                          backgroundColor: colors.partnership.fill,
                        }}
                      />
                    )}
                    {data.messaging_shift > 0 && (
                      <div
                        style={{
                          height: `${(data.messaging_shift / data.total) * 100}%`,
                          backgroundColor: colors.messaging_shift.fill,
                        }}
                      />
                    )}
                    {data.company_announcement > 0 && (
                      <div
                        style={{
                          height: `${(data.company_announcement / data.total) * 100}%`,
                          backgroundColor: colors.company_announcement.fill,
                        }}
                      />
                    )}
                  </div>

                  {/* Month Label */}
                  <span className="text-[10px] font-mono text-slate-400 mt-2 truncate w-full text-center">
                    {m.slice(5)}/{m.slice(2, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
