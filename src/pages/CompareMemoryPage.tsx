import React, { useState } from 'react';
import {
  Layers,
  Brain,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { IntelligenceEvent, MemoryComparisonResponse } from '../types/intelligence.ts';

interface CompareMemoryPageProps {
  events: IntelligenceEvent[];
  selectedEventId: string | null;
  onCompare: (eventId: string) => Promise<MemoryComparisonResponse>;
}

export const CompareMemoryPage: React.FC<CompareMemoryPageProps> = ({
  events,
  selectedEventId,
  onCompare,
}) => {
  const [activeEventId, setActiveEventId] = useState<string>(
    selectedEventId || 'evt-nova-11' // NovaFlow 30% price cut by default
  );
  const [comparison, setComparison] = useState<MemoryComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const pricingAndLaunchEvents = events.filter(
    (e) => e.eventType === 'pricing_change' || e.eventType === 'feature_launch'
  );

  const handleRunComparison = async (evtId: string) => {
    setActiveEventId(evtId);
    setLoading(true);
    try {
      const res = await onCompare(evtId);
      setComparison(res);
    } catch (err: any) {
      alert(`Comparison error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount if no comparison yet
  React.useEffect(() => {
    if (!comparison && activeEventId) {
      handleRunComparison(activeEventId);
    }
  }, [activeEventId]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">
            Compare With and Without Memory
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          A side-by-side demonstration evaluating the exact same event using identical Gemini model parameters. See the critical difference persistent Hindsight memory provides over a point-in-time snapshot.
        </p>
      </div>

      {/* Event Selector Pill Bar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
          Select Observed Event to Compare:
        </label>
        <div className="flex flex-wrap gap-2">
          {pricingAndLaunchEvents.slice(0, 6).map((ev) => {
            const isSelected = ev.id === activeEventId;
            return (
              <button
                key={ev.id}
                onClick={() => handleRunComparison(ev.id)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-lg border transition text-left ${
                  isSelected
                    ? 'bg-amber-950/80 text-amber-200 border-amber-600 font-semibold shadow-sm'
                    : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span className="font-bold text-white block">{ev.competitorName}</span>
                <span className="truncate max-w-xs block text-[11px] opacity-80">{ev.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs font-mono animate-pulse flex items-center justify-center gap-2">
          <Brain className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Executing parallel comparison (Current-Event-Only vs. Hindsight Memory Augmented)...</span>
        </div>
      )}

      {comparison && !loading && (
        <div className="space-y-6">
          {/* Target Event Banner */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                Target Event Being Evaluated
              </span>
              <h3 className="text-sm font-bold text-white mt-0.5">
                {comparison.competitorName}: {comparison.eventTitle}
              </h3>
            </div>
            <span className="font-mono text-xs text-amber-400 bg-amber-950 px-2.5 py-1 rounded border border-amber-800">
              {comparison.eventDate}
            </span>
          </div>

          {/* Side by Side Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Current Event Only (Without Memory) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5">
                  <EyeOff className="w-4 h-4 text-slate-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Current Event Only (No Memory)
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Isolated snapshot analysis
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400 block mb-1">Observed Interpretation:</span>
                  <p>{comparison.withoutHistory.interpretation}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
                    Critical Strategic Blind Spots:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                    {comparison.withoutHistory.blindSpots.map((spot, idx) => (
                      <li key={idx}>{spot}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80">
                <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                  Default Weekly Recommendation:
                </span>
                <p className="text-xs text-slate-400 italic">
                  {comparison.withoutHistory.suggestedActions.join(' · ')}
                </p>
              </div>
            </div>

            {/* Column 2: With Persistent History (Hindsight) */}
            <div className="bg-slate-900 border border-indigo-500/60 rounded-xl p-5 space-y-4 shadow-md shadow-indigo-950/30 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-indigo-900/60 pb-2.5">
                  <Brain className="w-4 h-4 text-indigo-400" />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      Cumulative Intelligence (With Hindsight)
                    </h4>
                    <span className="text-[10px] text-indigo-400/80 font-mono">
                      Connected to 6 months of persistent memories
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-indigo-950/40 rounded-lg border border-indigo-800/60 text-xs text-slate-200">
                  <span className="font-semibold text-indigo-300 block mb-1">
                    Multi-Month Pattern Detected:
                  </span>
                  <p>{comparison.withHistory.strategicSignificance}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
                    Connected Strategic Patterns:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-200">
                    {comparison.withHistory.connectedPatterns.map((pat, idx) => (
                      <li key={idx}>{pat}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-3 border-t border-indigo-900/60">
                <span className="text-[10px] uppercase font-semibold text-indigo-400 block mb-1">
                  Memory-Grounded Strategic Recommendations:
                </span>
                <p className="text-xs text-slate-200 font-medium">
                  {comparison.withHistory.suggestedActions.join(' · ')}
                </p>
              </div>
            </div>
          </div>

          {/* Recalled Preceding Events Ledger */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Preceding Historical Events Recalled From Hindsight ({comparison.recalledMemoryCount})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Historical antecedents synthesized
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {comparison.withHistory.recalledEvents.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-purple-300 text-[10px]">{r.date}</span>
                      <span className="font-bold text-white text-xs">{r.title}</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">{r.howItConnects}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono self-start sm:self-auto">
                    {r.eventType}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
