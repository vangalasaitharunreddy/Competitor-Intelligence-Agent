import React, { useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  XCircle,
  Eye,
  Filter,
  ArrowRight,
  TrendingDown,
  Brain,
} from 'lucide-react';
import { IntelligenceAlert, AlertPriority } from '../types/intelligence.ts';

interface AlertsPageProps {
  alerts: IntelligenceAlert[];
  onMarkRead: (alertId: string, isRead: boolean) => Promise<void>;
  onDismiss: (alertId: string) => Promise<void>;
  onFeedback: (alertId: string, feedback: 'useful' | 'not_relevant' | 'incorrect') => Promise<void>;
  onOpenInsight: (insightId: string) => void;
  onOpenAlertDetails: (alert: IntelligenceAlert) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  alerts,
  onMarkRead,
  onDismiss,
  onFeedback,
  onOpenInsight,
  onOpenAlertDetails,
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const filtered = alerts.filter((a) => {
    if (a.isDismissed) return false;
    if (filterPriority !== 'all' && a.priority !== filterPriority) return false;
    if (showUnreadOnly && a.isRead) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-400" />
            <span>Proactive Competitive Alerts</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Automated intelligence notifications cross-referenced with persistent Hindsight memory.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2.5 text-xs">
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">🚨 High Priority Only</option>
            <option value="medium">⚡ Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          <label className="flex items-center gap-1.5 text-slate-300 text-xs cursor-pointer select-none bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
            />
            <span>Unread Only</span>
          </label>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
            No active alerts matching your criteria.
          </div>
        ) : (
          filtered.map((alt) => {
            const isHigh = alt.priority === 'high';
            const isMedium = alt.priority === 'medium';

            return (
              <div
                key={alt.id}
                className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden space-y-3.5 ${
                  !alt.isRead
                    ? 'bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-950/20'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300'
                }`}
              >
                {!alt.isRead && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-indigo-500" />
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 pl-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold font-mono px-2.5 py-0.5 rounded uppercase tracking-wider ${
                          isHigh
                            ? 'bg-rose-950/90 text-rose-300 border border-rose-800/80'
                            : isMedium
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-800/80'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isHigh ? '🚨 HIGH' : isMedium ? '⚡ MEDIUM' : 'LOW'}
                      </span>
                      <span className="font-bold text-slate-200 text-xs">
                        {alt.competitorName || 'Competitor'}
                      </span>
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-400">
                        {new Date(alt.createdAt).toLocaleDateString()}
                      </span>
                      {!alt.isRead && (
                        <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.2 rounded ml-1">
                          Unread
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-white tracking-tight">
                      {alt.title}
                    </h4>

                    {alt.metricChange && (
                      <div className="text-sm font-mono font-bold text-indigo-300 bg-slate-950/50 border border-slate-800/80 px-3 py-1.5 rounded-lg inline-block">
                        {alt.metricChange}
                      </div>
                    )}

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {alt.message}
                    </p>

                    {alt.historicalContext && (
                      <div className="text-xs text-purple-300/90 bg-purple-950/30 border border-purple-900/40 p-2.5 rounded-lg flex items-start gap-2">
                        <Brain className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-purple-200">Historical context:</strong> {alt.historicalContext}
                        </span>
                      </div>
                    )}

                    {/* Detected Pattern (Requirement 3 & 10) */}
                    {alt.detectedPattern && (
                      <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 p-2 rounded-lg flex items-start gap-1.5">
                        <span className="font-bold text-amber-300 shrink-0">Pattern:</span>
                        <span>{alt.detectedPattern}</span>
                      </div>
                    )}

                    {/* Gmail status */}
                    {alt.gmailDeliveryStatus && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                        <span>
                          Gmail: {alt.gmailDeliveryStatus === 'delivered' ? `Delivered to ${alt.gmailDeliveredTo || 'account'}` : alt.gmailDeliveryStatus === 'pending_auth' ? 'Pending connection' : alt.gmailDeliveryStatus}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                    <button
                      onClick={() => onOpenAlertDetails(alt)}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <span>View Intelligence</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Footer Controls: Read, Insight Link, Feedback */}
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs pl-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onMarkRead(alt.id, !alt.isRead)}
                      className="text-slate-400 hover:text-slate-200 text-xs transition"
                    >
                      {alt.isRead ? 'Mark as Unread' : 'Mark as Read'}
                    </button>
                    <button
                      onClick={() => onDismiss(alt.id)}
                      className="text-slate-500 hover:text-slate-400 text-xs transition"
                    >
                      Dismiss
                    </button>
                  </div>

                  {/* Relevance Feedback */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>Relevance:</span>
                    <button
                      onClick={() => onFeedback(alt.id, 'useful')}
                      className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                        alt.feedback === 'useful'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                      title="Mark as Useful"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      <span>Useful</span>
                    </button>
                    <button
                      onClick={() => onFeedback(alt.id, 'not_relevant')}
                      className={`px-2 py-0.5 rounded border transition flex items-center gap-1 ${
                        alt.feedback === 'not_relevant'
                          ? 'bg-amber-950 text-amber-300 border-amber-700 font-bold'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                      title="Not Relevant"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      <span>Not Relevant</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
