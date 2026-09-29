import React, { useEffect, useState } from 'react';
import { Bell, X, ArrowRight, TrendingDown, Sparkles } from 'lucide-react';
import { IntelligenceAlert } from '../types/intelligence.ts';

interface NotificationToastProps {
  alert: IntelligenceAlert | null;
  onClose: () => void;
  onOpenDetails: (alert: IntelligenceAlert) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  alert,
  onClose,
  onOpenDetails,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (alert) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 9000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  if (!alert) return null;

  const isHigh = alert.priority === 'high';

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-md w-full transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
      }`}
    >
      <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl p-4 shadow-2xl shadow-indigo-950/60 backdrop-blur-md text-white space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 animate-pulse">
              <Bell className="w-4 h-4" />
            </span>
            <span
              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                isHigh
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {isHigh ? '🚨 High Priority Alert' : '⚡ Competitive Alert'}
            </span>
            <span className="text-xs text-slate-400 font-medium">Just now</span>
          </div>

          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-100 tracking-tight leading-snug">
            {alert.title}
          </h4>
          {alert.metricChange && (
            <p className="text-xs font-mono font-semibold text-indigo-300">
              {alert.metricChange}
            </p>
          )}
          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
            {alert.message}
          </p>
        </div>

        {alert.historicalContext && (
          <div className="text-[11px] text-purple-300/90 bg-purple-950/40 border border-purple-900/50 p-2 rounded-lg italic">
            Memory: {alert.historicalContext}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400">
            Detected via Active Monitoring
          </span>
          <button
            onClick={() => {
              onOpenDetails(alert);
              onClose();
            }}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>View Intelligence</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
