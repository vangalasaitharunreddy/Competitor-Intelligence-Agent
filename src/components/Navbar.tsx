import React, { useState } from 'react';
import {
  Compass,
  Users,
  Clock,
  Sparkles,
  Bell,
  MessageSquareText,
  Brain,
  Layers,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Calendar,
} from 'lucide-react';
import { ConnectionStatus } from '../types/intelligence.ts';

export type ActiveTab =
  | 'overview'
  | 'competitors'
  | 'timeline'
  | 'insights'
  | 'alerts'
  | 'ask'
  | 'compare'
  | 'memory'
  | 'settings';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  connections: ConnectionStatus | null;
  unreadAlertCount: number;
  isScanning: boolean;
  onRunScan: () => void;
  demoClockDate: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  connections,
  unreadAlertCount,
  isScanning,
  onRunScan,
  demoClockDate,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Dashboard', icon: <Compass className="w-4 h-4" /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" />, badge: unreadAlertCount },
    { id: 'competitors', label: 'Competitors', icon: <Users className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'ask', label: 'Ask Across Time', icon: <MessageSquareText className="w-4 h-4 text-emerald-400" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      {/* Top utility row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-bold tracking-tight">
            CL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg tracking-tight text-white">CompetitorLens</span>
              {/* Monitoring 10s indicator */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-[11px] font-medium cursor-pointer"
                onClick={() => setActiveTab('overview')}
                title="Continuous 10-second competitive monitoring loop active"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Monitoring Active (10s)</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Competitive Intelligence That Remembers</p>
          </div>
        </div>

        {/* Global info & primary action */}
        <div className="flex items-center gap-3">
          {/* Gmail Connection Status Pill */}
          <div
            onClick={() => setActiveTab('settings')}
            className={`cursor-pointer hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs transition ${
              connections?.gmail?.connected
                ? 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-950/70'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Configure automated Gmail alert delivery"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connections?.gmail?.connected ? 'bg-rose-400' : 'bg-slate-500'}`} />
            <span>{connections?.gmail?.connected ? `Gmail: ${connections.gmail.email}` : 'Gmail: Connect in Settings'}</span>
          </div>

          {/* Demo clock indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Time Anchor:</span>
            <span className="font-mono font-medium text-slate-200">{demoClockDate}</span>
          </div>

          {/* Quick connection badges */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded border ${
                connections?.hindsight.status === 'connected'
                  ? 'bg-purple-950/60 border-purple-800 text-purple-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}
              title={connections?.hindsight.status === 'connected' ? 'Hindsight Memory: Active' : 'Hindsight: Unconfigured / Local Mock'}
            >
              <Brain className="w-3 h-3 text-purple-400" />
              <span>Hindsight: {connections?.hindsight.status === 'connected' ? 'Active' : 'Offline'}</span>
            </div>

            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded border bg-slate-800/80 border-slate-700 text-slate-400"
              title={connections?.database.label}
            >
              <Database className="w-3 h-3 text-blue-400" />
              <span>{connections?.database.type === 'postgres_durable' ? 'Postgres' : 'SQLite Preview'}</span>
            </div>
          </div>

          {/* Scan button */}
          <button
            onClick={onRunScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs shadow-md shadow-indigo-600/25 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning...' : 'Run Scan'}</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/70 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 sm:space-x-2 py-2 text-xs font-medium">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md whitespace-nowrap transition-colors relative ${
                  active
                    ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && tab.badge > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
