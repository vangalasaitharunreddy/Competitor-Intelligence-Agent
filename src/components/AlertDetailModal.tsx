import React, { useState } from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Brain,
  History,
  Tag,
} from 'lucide-react';
import {
  IntelligenceAlert,
  IntelligenceEvent,
  StrategicInsight,
  Evidence,
} from '../types/intelligence.ts';

interface AlertDetailModalProps {
  alert: IntelligenceAlert | null;
  onClose: () => void;
  onMarkRead: (alertId: string, isRead: boolean) => Promise<void>;
  onFeedback: (alertId: string, feedback: 'useful' | 'not_relevant' | 'incorrect') => Promise<void>;
  onOpenCompare?: (eventId: string) => void;
  events?: IntelligenceEvent[];
  insights?: StrategicInsight[];
  onOpenEvidence?: (evidenceId: string) => void;
}

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({
  alert,
  onClose,
  onMarkRead,
  onFeedback,
  onOpenCompare,
  events = [],
  insights = [],
  onOpenEvidence,
}) => {
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  if (!alert) return null;

  const isHigh = alert.priority === 'high';
  const isMedium = alert.priority === 'medium';

  // Find linked event and insight
  const linkedEvent = events.find((e) => e.id === alert.eventId);
  const linkedInsight = alert.insightId
    ? insights.find((i) => i.id === alert.insightId)
    : insights.find((i) => i.competitorId === alert.competitorId);

  const handleFeedbackClick = async (type: 'useful' | 'not_relevant' | 'incorrect') => {
    await onFeedback(alert.id, type);
    setFeedbackSuccess(true);
    setTimeout(() => setFeedbackSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                  isHigh
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
                    : isMedium
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {isHigh && '🚨 HIGH PRIORITY'}
                {isMedium && '⚡ MEDIUM PRIORITY'}
                {!isHigh && !isMedium && 'LOW PRIORITY'}
              </span>

              <span className="text-xs font-semibold text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded border border-slate-700">
                {alert.competitorName || 'Competitor'}
              </span>

              {!alert.isRead ? (
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/80 border border-indigo-800/80 px-2 py-0.5 rounded">
                  Unread
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
                  Read
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
              {alert.title}
            </h3>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Detected: {new Date(alert.createdAt).toLocaleString()}</span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metric Change Highlight */}
          {alert.metricChange && (
            <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-700/50 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider block">
                  Observed Change
                </span>
                <span className="text-lg sm:text-xl font-mono font-bold text-white">
                  {alert.metricChange}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          )}

          {/* Concise Alert Message */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Event Summary
            </h4>
            <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
              {alert.message}
            </p>
          </div>

          {/* Historical Memory Context (The core value of Hindsight) */}
          <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-purple-300">
              <Brain className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Persistent Hindsight Memory Context
              </h4>
            </div>

            {alert.historicalContext ? (
              <p className="text-xs text-purple-200/90 leading-relaxed">
                {alert.historicalContext}
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Cross-referenced with historical memory bank for {alert.competitorName}.
              </p>
            )}

            {/* Detected Pattern across Complete Timeline */}
            {alert.detectedPattern && (
              <div className="pt-2 border-t border-purple-800/30">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-1">
                  Detected Multi-Step Pattern:
                </span>
                <p className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-lg leading-relaxed">
                  {alert.detectedPattern}
                </p>
              </div>
            )}

            {/* Why It Matters */}
            {alert.whyItMatters && (
              <div className="pt-2 border-t border-purple-800/30">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
                  Why It Matters:
                </span>
                <p className="text-xs text-slate-300 italic bg-purple-950/30 p-2.5 rounded-lg">
                  "{alert.whyItMatters}"
                </p>
              </div>
            )}

            {/* Recent Timeline from Complete History */}
            {alert.recentTimeline && alert.recentTimeline.length > 0 && (
              <div className="pt-2 border-t border-purple-800/30 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Recent Accumulated Timeline:
                </span>
                <div className="space-y-1">
                  {alert.recentTimeline.map((item, idx) => (
                    <div key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-950/40 p-1.5 rounded">
                      <span className="text-indigo-400 font-bold font-mono">#{idx + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gmail Delivery Status Banner */}
            <div className="pt-2 border-t border-purple-800/30 flex items-center justify-between text-xs">
              <span className="text-slate-400">Gmail Alert Delivery:</span>
              {alert.gmailDeliveryStatus === 'delivered' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Delivered to {alert.gmailDeliveredTo || 'user'}</span>
                </span>
              ) : alert.gmailDeliveryStatus === 'pending_auth' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                  Gmail delivery pending connection in Settings
                </span>
              ) : (
                <span className="text-slate-500">Not configured</span>
              )}
            </div>
          </div>

          {/* Linked Evidence Passages */}
          {linkedEvent && linkedEvent.evidences && linkedEvent.evidences.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Verified Source Evidence</span>
              </h4>
              <div className="space-y-2">
                {linkedEvent.evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-semibold text-slate-300">{ev.sourceTitle}</span>
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                      >
                        <span>Source Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-slate-300 font-serif italic bg-slate-900/60 p-2.5 rounded border border-slate-800/60">
                      "{ev.passageText}"
                    </p>
                    <div className="text-[10px] text-slate-500 flex items-center gap-3">
                      <span>Observed: {new Date(ev.observedAt).toLocaleDateString()}</span>
                      <span>Provenance: {ev.provenance}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategic Synthesis (if linked) */}
          {linkedInsight && (
            <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-indigo-300">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Strategic Impact & Synthesis
                </h4>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {linkedInsight.summary}
              </p>

              {linkedInsight.recommendedActions && linkedInsight.recommendedActions.length > 0 && (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-semibold text-indigo-400 block">
                    Recommended Actions:
                  </span>
                  <ul className="space-y-1">
                    {linkedInsight.recommendedActions.slice(0, 2).map((act, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">›</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Feedback:</span>
            <button
              onClick={() => handleFeedbackClick('useful')}
              className={`p-1.5 rounded border text-xs flex items-center gap-1 transition ${
                alert.feedback === 'useful'
                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Mark as useful alert"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Useful</span>
            </button>
            <button
              onClick={() => handleFeedbackClick('not_relevant')}
              className={`p-1.5 rounded border text-xs flex items-center gap-1 transition ${
                alert.feedback === 'not_relevant'
                  ? 'bg-amber-950 border-amber-700 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Not relevant"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              <span>Not Relevant</span>
            </button>
            {feedbackSuccess && (
              <span className="text-xs text-emerald-400 font-medium">Feedback saved!</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenCompare && alert.eventId && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCompare(alert.eventId);
                }}
                className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 border border-purple-700 text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Layers className="w-3.5 h-3.5 text-purple-300" />
                <span>Compare With & Without History</span>
              </button>
            )}

            <button
              onClick={async () => {
                await onMarkRead(alert.id, !alert.isRead);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              {alert.isRead ? 'Mark as Unread' : 'Mark as Read'}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
