import React from 'react';
import {
  Users,
  Bell,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Competitor,
  IntelligenceEvent,
  StrategicInsight,
  IntelligenceAlert,
} from '../types/intelligence.ts';
import { ActivityChart } from '../components/ActivityChart.tsx';
import { ActiveTab } from '../components/Navbar.tsx';
import { Play, Pause, RotateCcw, FastForward, Mail } from 'lucide-react';

interface OverviewPageProps {
  competitors: Competitor[];
  events: IntelligenceEvent[];
  insights: StrategicInsight[];
  alerts: IntelligenceAlert[];
  setActiveTab: (tab: ActiveTab) => void;
  onSelectEvent: (event: IntelligenceEvent) => void;
  onOpenEvidence: (evidenceId: string) => void;
  onOpenAlertDetails: (alert: IntelligenceAlert) => void;
  demoClockDate: string;
  monitoringState?: any;
  onStartMonitoring?: () => Promise<void>;
  onPauseMonitoring?: () => Promise<void>;
  onResetMonitoring?: () => Promise<void>;
  onStepMonitoring?: () => Promise<void>;
  gmailState?: any;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  competitors,
  events,
  insights,
  alerts,
  setActiveTab,
  onSelectEvent,
  onOpenEvidence,
  onOpenAlertDetails,
  demoClockDate,
  monitoringState,
  onStartMonitoring,
  onPauseMonitoring,
  onResetMonitoring,
  onStepMonitoring,
  gmailState,
}) => {
  const unreadAlerts = alerts.filter((a) => !a.isRead && !a.isDismissed);
  const activeAlerts = alerts.filter((a) => !a.isDismissed);

  // Sort newest important alerts first: high priority first, then by date
  const sortedAlerts = [...activeAlerts].sort((a, b) => {
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (b.priority === 'high' && a.priority !== 'high') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const latestAlerts = sortedAlerts.slice(0, 4);

  // Format relative timestamp helper
  const getRelativeTimeString = (dateStr: string) => {
    try {
      const now = new Date(demoClockDate + 'T12:00:00Z').getTime();
      const past = new Date(dateStr).getTime();
      const diffHours = Math.round((now - past) / (1000 * 60 * 60));
      if (diffHours <= 0) return 'Just now';
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      const diffDays = Math.round(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays} days ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-300 max-w-5xl mx-auto">
      {/* 1. Header Banner */}
      <div className="border-b border-slate-800 pb-5 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              CompetitorLens
            </h1>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Monitoring Active</span>
            </div>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Competitive Intelligence That Remembers
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ask')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            <span>Ask Across Time</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Continuous 10-Second Monitoring Command Bar */}
      <div className="bg-slate-900 border border-indigo-900/60 rounded-2xl p-4 shadow-lg shadow-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>Continuous Monitoring Loop</span>
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80 font-bold">
              10s Interval
            </span>
            {monitoringState?.active ? (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-[11px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Running</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px]">
                Paused
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Automatically scans competitor sources, maintains persistent Hindsight timeline, and delivers proactive Gmail alerts.
          </p>
          <div className="text-[11px] text-slate-500 flex items-center gap-3 pt-0.5">
            <span>Processed: <strong className="text-slate-300">{monitoringState?.eventsProcessedCount || 0}</strong> events</span>
            <span>•</span>
            <span>Alerts: <strong className="text-slate-300">{monitoringState?.alertsTriggeredCount || 0}</strong> generated</span>
            {gmailState?.connected && (
              <>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  <span>Gmail: {gmailState.email}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {monitoringState?.active ? (
            <button
              onClick={onPauseMonitoring}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="Pause 10s monitoring"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              onClick={onStartMonitoring}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
              title="Resume 10s monitoring"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start (10s)</span>
            </button>
          )}

          {onStepMonitoring && (
            <button
              onClick={onStepMonitoring}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="Step next 10-second competitor event immediately"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Step Next</span>
            </button>
          )}

          {onResetMonitoring && (
            <button
              onClick={onResetMonitoring}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition"
              title="Reset continuous monitoring pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Key Metrics Row: Exactly Competitors | Unread Alerts | Events Tracked */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-center shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400 block mb-1">
            Competitors
          </span>
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {competitors.length || 3}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-center shadow-sm relative overflow-hidden">
          {unreadAlerts.length > 0 && (
            <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-500 to-indigo-500" />
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400 block mb-1">
            Unread Alerts
          </span>
          <span className={`text-3xl font-extrabold tracking-tight ${unreadAlerts.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {unreadAlerts.length}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-center shadow-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400 block mb-1">
            Events Tracked
          </span>
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {events.length || 23}
          </span>
        </div>
      </div>

      {/* 3. Main Section: Latest Intelligence */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Latest Intelligence
            </h2>
            <span className="text-xs text-slate-400 font-normal">
              — Proactive Alerts
            </span>
          </div>
          <button
            onClick={() => setActiveTab('alerts')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
          >
            <span>View All Alerts ({alerts.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Alerts Cards Stack */}
        <div className="space-y-3.5">
          {latestAlerts.map((alt) => {
            const isHigh = alt.priority === 'high';
            const isMedium = alt.priority === 'medium';
            const timeAgo = getRelativeTimeString(alt.createdAt);

            return (
              <div
                key={alt.id}
                className={`p-5 rounded-2xl border transition-all duration-200 relative overflow-hidden group hover:border-slate-600 ${
                  !alt.isRead
                    ? 'bg-slate-900 border-indigo-500/50 shadow-md shadow-indigo-950/20'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300'
                }`}
              >
                {/* Priority & Unread Accent */}
                {!alt.isRead && (
                  <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-indigo-500" />
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 pl-1">
                    {/* Top Row: Priority Badge + Competitor + Time */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold font-mono px-2.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 ${
                          isHigh
                            ? 'bg-rose-950/90 text-rose-300 border border-rose-800/80'
                            : isMedium
                            ? 'bg-amber-950/90 text-amber-300 border border-amber-800/80'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {isHigh ? '🚨 HIGH' : isMedium ? '⚡ MEDIUM' : 'LOW'}
                      </span>

                      <span className="text-xs font-bold text-slate-200">
                        {alt.competitorName || 'Competitor'}
                      </span>

                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-400">{timeAgo}</span>

                      {!alt.isRead && (
                        <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.2 rounded ml-1">
                          Unread
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {alt.title}
                    </h3>

                    {/* Metric Change / Value Shift */}
                    {alt.metricChange && (
                      <div className="text-sm font-mono font-bold text-indigo-300 bg-slate-950/50 border border-slate-800/80 px-3 py-1.5 rounded-lg inline-block">
                        {alt.metricChange}
                      </div>
                    )}

                    {/* Concise Historical Memory Note */}
                    {alt.historicalContext && (
                      <p className="text-xs text-purple-300/90 bg-purple-950/30 border border-purple-900/40 p-2.5 rounded-lg leading-relaxed">
                        <span className="font-semibold text-purple-200">Memory context: </span>
                        {alt.historicalContext}
                      </p>
                    )}

                    {/* Detected Multi-Step Pattern (Requirement 3 & 10) */}
                    {alt.detectedPattern && (
                      <div className="text-xs text-amber-200 bg-amber-950/30 border border-amber-900/40 p-2 rounded-lg flex items-start gap-1.5">
                        <span className="font-bold text-amber-300 shrink-0">Pattern:</span>
                        <span>{alt.detectedPattern}</span>
                      </div>
                    )}

                    {/* Gmail Delivery Indicator */}
                    {alt.gmailDeliveryStatus && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                        <Mail className="w-3 h-3 text-indigo-400" />
                        {alt.gmailDeliveryStatus === 'delivered' ? (
                          <span className="text-emerald-400 font-medium">Delivered to Gmail ({alt.gmailDeliveredTo || 'account'})</span>
                        ) : alt.gmailDeliveryStatus === 'pending_auth' ? (
                          <span className="text-slate-500">Gmail delivery pending auth</span>
                        ) : (
                          <span className="text-slate-500">Delivery status: {alt.gmailDeliveryStatus}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
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
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Secondary Section: Small Competitive Activity timeline */}
      <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Competitive Activity
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('timeline')}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
          >
            <span>Full Timeline →</span>
          </button>
        </div>

        {/* Small compact activity timeline */}
        <div className="pt-2">
          <ActivityChart events={events} />
        </div>
      </section>
    </div>
  );
};
