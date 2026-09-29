import React, { useState } from 'react';
import {
  Settings,
  Sparkles,
  Database,
  Brain,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Save,
  RotateCcw,
  Sliders,
  ShieldCheck,
  Key,
  Lock,
  Copy,
  Check,
  Layers,
  FileText,
  Mail,
  Send,
  LogOut,
  Play,
  Pause,
  FastForward,
  Clock,
} from 'lucide-react';
import {
  ConnectionStatus,
  ProductProfile,
  IntelligenceEvent,
  StrategicInsight,
} from '../types/intelligence.ts';
import { InsightsPage } from './InsightsPage.tsx';
import { MemoryExplorerPage } from './MemoryExplorerPage.tsx';
import { CompareMemoryPage } from './CompareMemoryPage.tsx';
import {
  googleSignIn,
  logoutGmail,
  getAccessToken,
  verifyGoogleTokenScopes,
  reauthorizeGmail,
} from '../services/auth/gmail-auth.ts';

interface SettingsPageProps {
  connections: ConnectionStatus | null;
  productProfile: ProductProfile | null;
  onTestConnections: () => Promise<any>;
  onSaveProfile: (profile: Partial<ProductProfile>) => Promise<void>;
  onLoadDemo: () => Promise<any>;
  onResetDemo: () => Promise<any>;
  events?: IntelligenceEvent[];
  insights?: StrategicInsight[];
  onOpenEvidence?: (evidenceId: string) => void;
  onCompare?: (eventId: string) => Promise<any>;
  initialSubTab?: 'connections' | 'insights' | 'memory' | 'compare';
  monitoringState?: any;
  onStartMonitoring?: () => Promise<void>;
  onPauseMonitoring?: () => Promise<void>;
  onResetMonitoring?: () => Promise<void>;
  onStepMonitoring?: () => Promise<void>;
  gmailState?: any;
  onRefreshAll?: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  connections,
  productProfile,
  onTestConnections,
  onSaveProfile,
  onLoadDemo,
  onResetDemo,
  events = [],
  insights = [],
  onOpenEvidence = () => {},
  onCompare = async () => ({}) as any,
  initialSubTab = 'connections',
  monitoringState,
  onStartMonitoring,
  onPauseMonitoring,
  onResetMonitoring,
  onStepMonitoring,
  gmailState,
  onRefreshAll = async () => {},
}) => {
  const [subTab, setSubTab] = useState<'connections' | 'insights' | 'memory' | 'compare'>(initialSubTab);
  const [profileForm, setProfileForm] = useState<Partial<ProductProfile>>(productProfile || {});
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [demoNotice, setDemoNotice] = useState('');

  // Gmail OAuth and delivery state
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<string | null>(null);

  const handleConnectGmail = async (forceConsent = true) => {
    setIsConnectingGmail(true);
    setTestEmailResult(null);
    try {
      const res = await googleSignIn(forceConsent);
      if (res) {
        await onRefreshAll();
        setTestEmailResult('Gmail Connected — Send permission granted');
      }
    } catch (err: any) {
      if (err.message?.includes('reauthorized') || err.message?.includes('permission')) {
        setTestEmailResult('Gmail permission needs to be reauthorized.');
      } else {
        setTestEmailResult(`Gmail authorization error: ${err.message}`);
      }
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleDisconnectGmail = async () => {
    await logoutGmail();
    await onRefreshAll();
    setTestEmailResult('Gmail disconnected.');
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      // Requirement 12: Before sending the test email, verify that the credential being used has the gmail.send scope.
      const token = await getAccessToken();
      const scopeCheck = token ? await verifyGoogleTokenScopes(token) : { valid: false, hasGmailSend: false };

      // Requirement 13: If the scope is missing, do NOT call Gmail API. Instead show:
      // "Gmail permission needs to be reauthorized." and provide a "Reconnect Gmail" action.
      if (!scopeCheck.valid || !scopeCheck.hasGmailSend) {
        setTestEmailResult('Gmail permission needs to be reauthorized.');
        setIsSendingTestEmail(false);
        return;
      }

      const res = await fetch('/api/gmail/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: gmailState?.email || connections?.gmail?.email,
          competitorName: 'NovaFlow',
          whatChanged: 'Enterprise pricing reduced from ₹50,000 to ₹35,000/month (-30%).',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestEmailResult(`Alert email successfully sent to ${data.deliveredTo}!`);
      } else if (data.needsReauthorization || data.error?.includes('reauthorized')) {
        setTestEmailResult('Gmail permission needs to be reauthorized.');
        await onRefreshAll();
      } else {
        setTestEmailResult(`Failed: ${data.error}`);
      }
    } catch (err: any) {
      setTestEmailResult(`Error: ${err.message}`);
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResults(null);
    try {
      const res = await onTestConnections();
      setTestResults(res.results);
    } catch (err: any) {
      alert(`Test error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSaveProfile(profileForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      alert(`Failed to save product profile: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsDemoLoading(true);
    setDemoNotice('');
    try {
      const res = await onLoadDemo();
      setDemoNotice(`Successfully loaded deterministic 6-month scenario (${res.eventsLoaded} events, ${res.insightsLoaded} insights).`);
    } catch (err: any) {
      alert(`Demo load failed: ${err.message}`);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Are you sure you want to reset demo data? This will clear synthetic events and reload the initial clean state.')) {
      return;
    }
    setIsDemoLoading(true);
    setDemoNotice('');
    try {
      await onResetDemo();
      setDemoNotice('Demo dataset cleared.');
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    } finally {
      setIsDemoLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Header & Sub-Tab Bar */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            <span>Settings & Advanced Intelligence</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            System configuration, memory exploration, and strategic dossiers.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
          <button
            onClick={() => setSubTab('connections')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              subTab === 'connections'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Connections</span>
          </button>
          <button
            onClick={() => setSubTab('insights')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              subTab === 'insights'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
            <span>Strategic Dossiers</span>
          </button>
          <button
            onClick={() => setSubTab('compare')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              subTab === 'compare'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-300" />
            <span>Compare History</span>
          </button>
          <button
            onClick={() => setSubTab('memory')}
            className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
              subTab === 'memory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-300" />
            <span>Memory Explorer</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab View Rendering */}
      {subTab === 'insights' && (
        <InsightsPage insights={insights} onOpenEvidence={onOpenEvidence} />
      )}

      {subTab === 'memory' && (
        <MemoryExplorerPage onOpenEvidence={onOpenEvidence} />
      )}

      {subTab === 'compare' && (
        <CompareMemoryPage
          events={events}
          selectedEventId={events.find((e) => e.eventType === 'pricing_change')?.id || null}
          onCompare={onCompare}
        />
      )}

      {subTab === 'connections' && (
        <div className="space-y-8">
          {/* FEATURE: GMAIL ALERT DELIVERY (Requirements 13 & 14) */}
          {(() => {
            const hasSend = Boolean(
              gmailState?.hasSendPermission ??
              (connections?.gmail?.hasSendPermission && !gmailState?.needsReauthorization)
            );
            const isConnected = Boolean(gmailState?.connected || connections?.gmail?.connected);
            const needsReauth = Boolean(
              gmailState?.needsReauthorization ||
              connections?.gmail?.needsReauthorization ||
              (isConnected && !hasSend) ||
              testEmailResult === 'Gmail permission needs to be reauthorized.'
            );
            const isFullyAuthorized = isConnected && hasSend && !needsReauth;
            const accountEmail = gmailState?.email || connections?.gmail?.email;

            return (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Mail className="w-5 h-5 text-rose-400" />
                      <span>Gmail Alert Delivery</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Connect your Google account to automatically dispatch competitive intelligence alert emails when new updates are detected.
                    </p>
                  </div>

                  {/* Status Pill */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Status:</span>
                    {isFullyAuthorized ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Gmail Connected</span>
                      </span>
                    ) : needsReauth ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-700 text-amber-300 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reauthorization Required</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
                        ○ Not Connected
                      </span>
                    )}
                  </div>
                </div>

                {/* Account Details & Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-slate-400">Authenticated Account:</span>
                    <div className="text-sm font-mono font-bold text-white bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                      <span className="truncate">{accountEmail || 'No Gmail account connected'}</span>
                      {isFullyAuthorized ? (
                        <span className="text-xs text-emerald-400 font-sans font-medium flex items-center gap-1 shrink-0 ml-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Send permission granted</span>
                        </span>
                      ) : needsReauth ? (
                        <span className="text-xs text-amber-400 font-sans font-medium flex items-center gap-1 shrink-0 ml-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Reauthorization required</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Requirement 14: After successful authorization show "Gmail Connected" and "Send permission granted" */}
                    {isFullyAuthorized && (
                      <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <strong className="block text-emerald-200 font-semibold">Gmail Connected</strong>
                          <span className="text-emerald-400">Send permission granted</span>
                        </div>
                      </div>
                    )}

                    {/* Requirement 13: If scope is missing, show "Gmail permission needs to be reauthorized." and provide a "Reconnect Gmail" action */}
                    {needsReauth && (
                      <div className="p-3 bg-amber-950/60 border border-amber-700/80 rounded-xl space-y-2 text-xs text-amber-200">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="font-semibold text-amber-300">Gmail permission needs to be reauthorized.</span>
                        </div>
                        <p className="text-[11px] text-amber-300/80 leading-relaxed">
                          Your current Google session lacks the required <code className="bg-amber-950 px-1 py-0.5 rounded text-amber-200">gmail.send</code> authorization scope. Please reconnect to approve sending email alerts.
                        </p>
                        <div className="pt-1">
                          <button
                            onClick={() => handleConnectGmail(true)}
                            disabled={isConnectingGmail}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isConnectingGmail ? 'animate-spin' : ''}`} />
                            <span>{isConnectingGmail ? 'Authorizing...' : 'Reconnect Gmail'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {testEmailResult && testEmailResult !== 'Gmail permission needs to be reauthorized.' && (
                      <p className={`text-xs p-2.5 rounded-lg border leading-relaxed ${
                        testEmailResult.includes('successfully sent') || testEmailResult.includes('granted')
                          ? 'text-emerald-300 bg-emerald-950/60 border-emerald-800'
                          : 'text-rose-300 bg-rose-950/60 border-rose-800'
                      }`}>
                        {testEmailResult}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    {isFullyAuthorized ? (
                      <>
                        <button
                          onClick={handleSendTestEmail}
                          disabled={isSendingTestEmail}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        >
                          <Send className={`w-3.5 h-3.5 ${isSendingTestEmail ? 'animate-bounce' : ''}`} />
                          <span>{isSendingTestEmail ? 'Sending Test Email...' : 'Send Test Alert Email'}</span>
                        </button>
                        <button
                          onClick={() => handleConnectGmail(true)}
                          disabled={isConnectingGmail}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                          title="Refresh authorization scopes"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isConnectingGmail ? 'animate-spin' : ''}`} />
                          <span>Reconnect Gmail</span>
                        </button>
                        <button
                          onClick={handleDisconnectGmail}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </>
                    ) : needsReauth ? (
                      <>
                        <button
                          onClick={() => handleConnectGmail(true)}
                          disabled={isConnectingGmail}
                          className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-900/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                        >
                          <RefreshCw className={`w-4 h-4 ${isConnectingGmail ? 'animate-spin' : ''}`} />
                          <span>{isConnectingGmail ? 'Authorizing in popup...' : 'Reconnect Gmail'}</span>
                        </button>
                        <button
                          onClick={handleDisconnectGmail}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Disconnect</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnectGmail(true)}
                        disabled={isConnectingGmail}
                        className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-900/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                        <span>{isConnectingGmail ? 'Opening Google Auth...' : 'Connect Gmail Account'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* FEATURE: CONTINUOUS 10-SECOND MONITORING CONFIGURATION (Requirement 1 & 11) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  <span>Continuous 10-Second Intelligence Scheduler</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Autonomous scheduler monitoring competitor sources and synthesizing Hindsight persistent memory every 10 seconds.
                </p>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Loop Status:</span>
                {monitoringState?.active ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>● Active (10s Interval)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
                    ⏸ Paused
                  </span>
                )}
              </div>
            </div>

            {/* Metrics & Control Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <span className="text-[11px] font-medium text-slate-400 uppercase block mb-1">
                  Monitoring Frequency
                </span>
                <span className="text-xl font-mono font-bold text-indigo-300">
                  Every 10 Seconds
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <span className="text-[11px] font-medium text-slate-400 uppercase block mb-1">
                  Events Processed
                </span>
                <span className="text-xl font-mono font-bold text-white">
                  {monitoringState?.eventsProcessedCount || 0}
                </span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl text-center">
                <span className="text-[11px] font-medium text-slate-400 uppercase block mb-1">
                  Alerts Dispatched
                </span>
                <span className="text-xl font-mono font-bold text-emerald-400">
                  {monitoringState?.alertsTriggeredCount || 0}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {monitoringState?.active ? (
                <button
                  onClick={onPauseMonitoring}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause 10s Loop</span>
                </button>
              ) : (
                <button
                  onClick={onStartMonitoring}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start 10s Monitoring</span>
                </button>
              )}

              {onStepMonitoring && (
                <button
                  onClick={onStepMonitoring}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Step Next Event Immediately</span>
                </button>
              )}

              {onResetMonitoring && (
                <button
                  onClick={onResetMonitoring}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Continuous Sequence</span>
                </button>
              )}
            </div>
          </div>

          {/* SECTION 1: Service Connections Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>Active Integration Health</span>
              </h3>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Server Endpoints...' : 'Test All Connections'}</span>
              </button>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Gemini */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Gemini Reasoning
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  connections?.gemini.status === 'connected'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {connections?.gemini.status || 'Checking'}
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Model: <span className="font-mono text-slate-200">{connections?.gemini.model}</span>
            </p>
            {connections?.gemini.error && (
              <p className="text-[10px] text-amber-400/90 leading-tight">
                {connections.gemini.error}
              </p>
            )}
            {testResults?.gemini && (
              <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-emerald-400">
                Live Ping: {testResults.gemini.connected ? `Success (${testResults.gemini.latencyMs}ms)` : `Failed: ${testResults.gemini.error}`}
              </div>
            )}
          </div>

          {/* Hindsight */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-400" />
                Hindsight Memory
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  connections?.hindsight.status === 'connected'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {connections?.hindsight.status || 'Checking'}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] truncate">
              Bank: <span className="font-mono text-slate-200">{connections?.hindsight.activeBank}</span>
            </p>
            {connections?.hindsight.error && (
              <p className="text-[10px] text-slate-400/90 leading-tight">
                {connections.hindsight.error}
              </p>
            )}
            {testResults?.hindsight && (
              <div className="p-2 bg-slate-950 rounded border border-slate-800 text-[10px] font-mono text-purple-300">
                Health Check: {testResults.hindsight.connected ? 'Online' : testResults.hindsight.error}
              </div>
            )}
          </div>

          {/* Database */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-sky-400" />
                Database Engine
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                  connections?.database.type === 'postgres_durable'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}
              >
                {connections?.database.type === 'postgres_durable' ? 'Postgres' : 'SQLite Preview'}
              </span>
            </div>
            <p className="text-slate-300 text-[11px] leading-tight">
              {connections?.database.label}
            </p>
            {connections?.database.warning && (
              <p className="text-[10px] text-amber-400/90 leading-tight">
                {connections.database.warning}
              </p>
            )}
          </div>

          {/* Monitoring Mode */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-emerald-400" />
                Monitoring Mode
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase bg-slate-800 text-slate-300">
                Manual + API
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Active Sources: <span className="font-bold text-white">{connections?.monitoring.activeSources}</span>
            </p>
            <p className="text-[10px] text-slate-400 leading-tight">
              Webhook: <span className="font-mono text-slate-300">POST /api/scheduler/trigger</span>
            </p>
          </div>
        </div>
      </div>

      {/* SECTION: API Keys & Environment Configuration Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>How to Add API Keys &amp; Secrets</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Credentials are kept strictly server-side for security. Configure these environment variables in your runtime settings or <span className="font-mono text-slate-300">.env</span> file.
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-800/80 rounded-md text-[11px] text-amber-300">
            <Lock className="w-3.5 h-3.5" />
            <span>Server-side secrets only</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Step 1: In Google AI Studio */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <span className="font-semibold text-indigo-300 block flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-900 text-indigo-200 text-[10px] font-bold flex items-center justify-center">1</span>
                In Google AI Studio (Cloud Runtime)
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Open the <strong>Secrets</strong> or <strong>Environment</strong> panel in the AI Studio editor sidebar, then add the key-value pairs below. AI Studio automatically injects them securely at server startup.
              </p>
            </div>

            {/* Step 2: Local Development */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
              <span className="font-semibold text-indigo-300 block flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-indigo-900 text-indigo-200 text-[10px] font-bold flex items-center justify-center">2</span>
                In Local Development (.env)
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Copy <span className="font-mono text-slate-300">.env.example</span> to <span className="font-mono text-slate-300">.env</span> in your project root, paste your actual secret keys, and restart the server process.
              </p>
            </div>
          </div>

          {/* Keys list */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
            <div className="divide-y divide-slate-800/80 text-xs">
              {/* GEMINI_API_KEY */}
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-[12px]">GEMINI_API_KEY</span>
                    <button
                      onClick={() => copyToClipboard('GEMINI_API_KEY', 'gemini')}
                      className="text-slate-400 hover:text-white transition p-0.5"
                      title="Copy variable name"
                    >
                      {copiedKey === 'gemini' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        connections?.gemini.configured
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {connections?.gemini.configured ? 'Configured' : 'Missing'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Required for Gemini structured reasoning, strategic insight generation, and Ask Across Time synthesis.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0">
                  Get key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio API Keys</a>
                </div>
              </div>

              {/* HINDSIGHT_API_KEY */}
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-[12px]">HINDSIGHT_API_KEY</span>
                    <button
                      onClick={() => copyToClipboard('HINDSIGHT_API_KEY', 'hindsight')}
                      className="text-slate-400 hover:text-white transition p-0.5"
                      title="Copy variable name"
                    >
                      {copiedKey === 'hindsight' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        connections?.hindsight.configured
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {connections?.hindsight.configured ? 'Configured' : 'Optional / Queued'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Enables cloud-hosted Hindsight persistent memory bank retention &amp; semantic recall. If absent, writes are safely queued in the transactional outbox.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 shrink-0">
                  Docs: <a href="https://hindsight.vectorize.io" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">hindsight.vectorize.io</a>
                </div>
              </div>

              {/* HINDSIGHT_BASE_URL */}
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-[12px]">HINDSIGHT_BASE_URL</span>
                    <button
                      onClick={() => copyToClipboard('HINDSIGHT_BASE_URL', 'hindsight_url')}
                      className="text-slate-400 hover:text-white transition p-0.5"
                      title="Copy variable name"
                    >
                      {copiedKey === 'hindsight_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      Default: https://api.hindsight.vectorize.io
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Custom URL if connecting to a dedicated self-hosted Hindsight persistent memory cluster.
                  </p>
                </div>
              </div>

              {/* DATABASE_URL */}
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-[12px]">DATABASE_URL</span>
                    <button
                      onClick={() => copyToClipboard('DATABASE_URL', 'db_url')}
                      className="text-slate-400 hover:text-white transition p-0.5"
                      title="Copy variable name"
                    >
                      {copiedKey === 'db_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        connections?.database.type === 'postgres_durable'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {connections?.database.type === 'postgres_durable' ? 'Postgres Active' : 'SQLite Preview'}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    PostgreSQL connection string (<span className="font-mono text-slate-300">postgresql://user:pass@host:5432/db</span>) for permanent cloud storage across redeployments.
                  </p>
                </div>
              </div>

              {/* SCHEDULER_SECRET */}
              <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-[12px]">SCHEDULER_SECRET</span>
                    <button
                      onClick={() => copyToClipboard('SCHEDULER_SECRET', 'scheduler')}
                      className="text-slate-400 hover:text-white transition p-0.5"
                      title="Copy variable name"
                    >
                      {copiedKey === 'scheduler' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Bearer token required when configuring Cloud Tasks or cron services to trigger <span className="font-mono text-slate-300">POST /api/scheduler/trigger</span>.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">
              After setting or updating any keys, run a connection test to confirm verification:
            </span>
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>Verify Keys Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Demonstration Dataset Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Demonstration Dataset (Fictional 6-Month Arc)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic 35-event fixture across NovaFlow, OrbitStack, and PulseWorks with explicit demo clock anchor.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetDemo}
              disabled={isDemoLoading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
            <button
              onClick={handleLoadDemo}
              disabled={isDemoLoading}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDemoLoading ? 'animate-spin' : ''}`} />
              <span>Load 6-Month Demo</span>
            </button>
          </div>
        </div>

        {demoNotice && (
          <div className="p-3 bg-indigo-950/80 border border-indigo-800 rounded-lg text-indigo-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{demoNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-indigo-300 block">Competitor A: NovaFlow</span>
            <p className="text-slate-400 text-[11px] mt-1">
              ₹60k → ₹50k → AI OmniAgent launch → Hyperscale partnership → ₹35k (30% drop) + AI job openings.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-indigo-300 block">Competitor B: OrbitStack</span>
            <p className="text-slate-400 text-[11px] mt-1">
              Pro plan $199 → $249 (+25% hike) + OpenTelemetry native collector + eBPF kernel profiler GA.
            </p>
          </div>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="font-semibold text-indigo-300 block">Competitor C: PulseWorks</span>
            <p className="text-slate-400 text-[11px] mt-1">
              Usage pricing at $0.15/GB + FedRAMP in-process status + SecureCloud OEM alliance + WORM vault.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Product Profile Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Our Product Profile Context</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              The agent conditions all strategic implications, opportunity rankings, and risk evaluations against this profile.
            </p>
          </div>

          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Saved successfully!</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Our Product Name *</label>
              <input
                type="text"
                required
                value={profileForm.productName || ''}
                onChange={(e) => setProfileForm({ ...profileForm, productName: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">Our Pricing Model *</label>
              <input
                type="text"
                required
                value={profileForm.pricingModel || ''}
                onChange={(e) => setProfileForm({ ...profileForm, pricingModel: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">Target Customer Segment</label>
            <input
              type="text"
              value={profileForm.targetCustomerSegment || ''}
              onChange={(e) => setProfileForm({ ...profileForm, targetCustomerSegment: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">
                Strategic Priorities (Comma separated)
              </label>
              <textarea
                rows={2}
                value={profileForm.strategicPriorities?.join(', ') || ''}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    strategicPriorities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 mb-1 font-medium">
                Topics to Prioritize vs. Ignore
              </label>
              <textarea
                rows={2}
                placeholder="Prioritize: Pricing discounts, AI agents | Ignore: minor typos"
                value={profileForm.topicsToPrioritize?.join(', ') || ''}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    topicsToPrioritize: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Product Profile'}</span>
            </button>
          </div>
        </form>
      </div>
      </div>
      )}
    </div>
  );
};
