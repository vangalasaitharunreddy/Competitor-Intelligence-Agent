import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { OverviewPage } from './pages/OverviewPage.tsx';
import { CompetitorsPage } from './pages/CompetitorsPage.tsx';
import { TimelinePage } from './pages/TimelinePage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import { AlertsPage } from './pages/AlertsPage.tsx';
import { AskAcrossTimePage } from './pages/AskAcrossTimePage.tsx';
import { CompareMemoryPage } from './pages/CompareMemoryPage.tsx';
import { MemoryExplorerPage } from './pages/MemoryExplorerPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { EvidenceModal } from './components/EvidenceModal.tsx';
import { AlertDetailModal } from './components/AlertDetailModal.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { initAuth } from './services/auth/gmail-auth.ts';
import {
  Competitor,
  IntelligenceEvent,
  StrategicInsight,
  IntelligenceAlert,
  Source,
  ConnectionStatus,
  ProductProfile,
  Evidence,
  AskQuestionResponse,
  MemoryComparisonResponse,
} from './types/intelligence.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [events, setEvents] = useState<IntelligenceEvent[]>([]);
  const [insights, setInsights] = useState<StrategicInsight[]>([]);
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>([]);
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);

  // Continuous 10s Monitoring and Gmail State
  const [monitoringState, setMonitoringState] = useState<any>(null);
  const [gmailState, setGmailState] = useState<any>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [demoClockDate, setDemoClockDate] = useState('2026-09-28');

  // Modal & Notification State
  const [activeEvidence, setActiveEvidence] = useState<Evidence | null>(null);
  const [activeAlertDetails, setActiveAlertDetails] = useState<IntelligenceAlert | null>(null);
  const [newAlertToast, setNewAlertToast] = useState<IntelligenceAlert | null>(null);
  const [selectedEventIdForComparison, setSelectedEventIdForComparison] = useState<string | null>(null);

  const initialLoadDone = useRef(false);

  // Initial data loading
  const refreshAllData = async () => {
    try {
      const [healthRes, connRes, compRes, evtRes, insRes, altRes, profRes, monRes, gmRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/connections').then((r) => r.json()),
        fetch('/api/competitors').then((r) => r.json()),
        fetch('/api/events').then((r) => r.json()),
        fetch('/api/insights').then((r) => r.json()),
        fetch('/api/alerts').then((r) => r.json()),
        fetch('/api/product-profile').then((r) => r.json()),
        fetch('/api/monitoring/status').then((r) => r.json()).catch(() => null),
        fetch('/api/gmail/status').then((r) => r.json()).catch(() => null),
      ]);

      if (healthRes.demoClockDate) setDemoClockDate(healthRes.demoClockDate);
      setConnections(connRes);
      setCompetitors(compRes);
      setEvents(evtRes);
      setInsights(insRes);
      setAlerts(altRes);
      setProductProfile(profRes);
      if (monRes) setMonitoringState(monRes);
      if (gmRes) setGmailState(gmRes);

      if (Array.isArray(compRes)) {
        const allSrcPromises = compRes.map((c: Competitor) =>
          fetch(`/api/competitors/${c.id}/sources`).then((r) => r.json())
        );
        const nestedSources = await Promise.all(allSrcPromises);
        setSources(nestedSources.flat());
      }

      initialLoadDone.current = true;
    } catch (err) {
      console.error('Error fetching CompetitorLens data:', err);
    }
  };

  useEffect(() => {
    refreshAllData();
    // Initialize Google Firebase Auth state listener
    initAuth(
      (user, _token, hasSendPermission) => {
        setGmailState((prev: any) => ({
          ...prev,
          connected: true,
          email: user.email,
          hasSendPermission: Boolean(hasSendPermission),
          needsReauthorization: !hasSendPermission,
        }));
      },
      () => {
        setGmailState(null);
      },
      (user) => {
        setGmailState((prev: any) => ({
          ...prev,
          connected: true,
          email: user.email,
          hasSendPermission: false,
          needsReauthorization: true,
        }));
      }
    );
  }, []);

  // Real-time automatic polling: refreshes events, alerts, and continuous monitoring state every 3 seconds
  // This guarantees new timeline events and proactive alerts appear automatically every 10 seconds without manual page refresh
  useEffect(() => {
    const pollTimer = setInterval(async () => {
      if (!initialLoadDone.current) return;
      try {
        const [latestAlerts, latestEvents, monStatus, gmStatus] = await Promise.all([
          fetch('/api/alerts').then((r) => r.json()).catch(() => null),
          fetch('/api/events').then((r) => r.json()).catch(() => null),
          fetch('/api/monitoring/status').then((r) => r.json()).catch(() => null),
          fetch('/api/gmail/status').then((r) => r.json()).catch(() => null),
        ]);

        if (Array.isArray(latestEvents)) {
          setEvents(latestEvents);
        }

        if (monStatus) {
          setMonitoringState(monStatus);
        }

        if (gmStatus) {
          setGmailState(gmStatus);
        }

        if (Array.isArray(latestAlerts)) {
          setAlerts((prevAlerts) => {
            const knownIds = new Set(prevAlerts.map((a) => a.id));
            const newUnread = latestAlerts.filter((a) => !knownIds.has(a.id) && !a.isRead && !a.isDismissed);
            if (newUnread.length > 0) {
              const freshAlert = newUnread[0];
              setNewAlertToast(freshAlert);

              // Browser notification if permitted
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`🚨 CompetitorLens Alert: ${freshAlert.title}`, {
                    body: freshAlert.message,
                  });
                } catch {
                  // ignore
                }
              }
            }
            return latestAlerts;
          });
        }
      } catch {
        // quiet error handling during periodic polling
      }
    }, 3000);

    return () => clearInterval(pollTimer);
  }, []);

  // Continuous Monitoring Handlers
  const handleStartMonitoring = async () => {
    await fetch('/api/monitoring/start', { method: 'POST' });
    const s = await fetch('/api/monitoring/status').then((r) => r.json());
    setMonitoringState(s);
  };

  const handlePauseMonitoring = async () => {
    await fetch('/api/monitoring/pause', { method: 'POST' });
    const s = await fetch('/api/monitoring/status').then((r) => r.json());
    setMonitoringState(s);
  };

  const handleResetMonitoring = async () => {
    await fetch('/api/monitoring/reset', { method: 'POST' });
    const s = await fetch('/api/monitoring/status').then((r) => r.json());
    setMonitoringState(s);
    await refreshAllData();
  };

  const handleStepMonitoring = async () => {
    await fetch('/api/monitoring/step', { method: 'POST' });
    await refreshAllData();
  };

  // Action Handlers
  const handleRunScan = async (competitorId?: string) => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      });
      const job = await res.json();

      // Poll for completion (up to 15s)
      const pollInterval = setInterval(async () => {
        try {
          const check = await fetch(`/api/jobs/${job.id}`).then((r) => r.json());
          if (check.status === 'completed' || check.status === 'failed') {
            clearInterval(pollInterval);
            setIsScanning(false);
            await refreshAllData();
          }
        } catch {
          clearInterval(pollInterval);
          setIsScanning(false);
        }
      }, 1000);
    } catch (err: any) {
      setIsScanning(false);
      alert(`Scan initiation failed: ${err.message}`);
    }
  };

  const handleOpenEvidence = async (evidenceId: string) => {
    try {
      const resp = await fetch(`/api/evidence/${evidenceId}`);
      if (!resp.ok) {
        throw new Error('Evidence record not found');
      }
      const data = await resp.json();
      setActiveEvidence(data);
    } catch (err: any) {
      alert(`Could not load evidence #${evidenceId}: ${err.message}`);
    }
  };

  const handleSubmitCorrection = async (evidenceId: string, notes: string, proposedCorrection: string) => {
    // Find matching event
    const parentEvent = events.find((e) => e.evidenceIds.includes(evidenceId));
    if (!parentEvent) {
      throw new Error('Parent event record not located');
    }

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'event',
        targetId: parentEvent.id,
        feedbackType: 'incorrect',
        notes,
        proposedCorrection,
        isAcceptedCorrection: true,
      }),
    });

    await refreshAllData();
  };

  const handleAddCompetitor = async (
    name: string,
    domain: string,
    description: string,
    tier: 'primary' | 'secondary' | 'watch'
  ) => {
    const resp = await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain, description, tier }),
    });
    if (!resp.ok) throw new Error('Failed to create competitor');
    await refreshAllData();
  };

  const handleAddSource = async (competitorId: string, name: string, type: any, url: string) => {
    const resp = await fetch(`/api/competitors/${competitorId}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, url }),
    });
    if (!resp.ok) throw new Error('Failed to create source');
    await refreshAllData();
  };

  const handleAskQuestion = async (
    question: string,
    competitorId?: string,
    conversationId?: string
  ): Promise<AskQuestionResponse> => {
    const resp = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        competitorId,
        conversationId,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Question processing failed');
    }
    return resp.json();
  };

  const handleCompare = async (eventId: string): Promise<MemoryComparisonResponse> => {
    const resp = await fetch('/api/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Comparison failed');
    }
    return resp.json();
  };

  const handleAlertMarkRead = async (alertId: string, isRead: boolean) => {
    await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isRead } : a)));
  };

  const handleAlertDismiss = async (alertId: string) => {
    await fetch(`/api/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDismissed: true }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, isDismissed: true } : a)));
  };

  const handleAlertFeedback = async (
    alertId: string,
    feedback: 'useful' | 'not_relevant' | 'incorrect'
  ) => {
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'alert',
        targetId: alertId,
        feedbackType: feedback,
      }),
    });
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, feedback } : a)));
  };

  const handleSaveProfile = async (profile: Partial<ProductProfile>) => {
    const resp = await fetch('/api/product-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!resp.ok) throw new Error('Failed saving profile');
    const updated = await resp.json();
    setProductProfile(updated);
  };

  const handleLoadDemo = async () => {
    const resp = await fetch('/api/demo/load', { method: 'POST' });
    const data = await resp.json();
    await refreshAllData();
    return data;
  };

  const handleResetDemo = async () => {
    const resp = await fetch('/api/demo/reset', { method: 'POST' });
    const data = await resp.json();
    await refreshAllData();
    return data;
  };

  const handleTestConnections = async () => {
    const resp = await fetch('/api/connections/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'all' }),
    });
    const data = await resp.json();
    const connCheck = await fetch('/api/connections').then((r) => r.json());
    setConnections(connCheck);
    return data;
  };

  const unreadAlertCount = alerts.filter((a) => !a.isRead && !a.isDismissed).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connections={connections}
        unreadAlertCount={unreadAlertCount}
        isScanning={isScanning}
        onRunScan={() => handleRunScan()}
        demoClockDate={demoClockDate}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <OverviewPage
            competitors={competitors}
            events={events}
            insights={insights}
            alerts={alerts}
            setActiveTab={setActiveTab}
            onSelectEvent={(ev) => {
              setSelectedEventIdForComparison(ev.id);
              setActiveTab('compare');
            }}
            onOpenEvidence={handleOpenEvidence}
            onOpenAlertDetails={(alt) => setActiveAlertDetails(alt)}
            demoClockDate={demoClockDate}
            monitoringState={monitoringState}
            onStartMonitoring={handleStartMonitoring}
            onPauseMonitoring={handlePauseMonitoring}
            onResetMonitoring={handleResetMonitoring}
            onStepMonitoring={handleStepMonitoring}
            gmailState={gmailState}
          />
        )}

        {activeTab === 'competitors' && (
          <CompetitorsPage
            competitors={competitors}
            sources={sources}
            events={events}
            insights={insights}
            onAddCompetitor={handleAddCompetitor}
            onAddSource={handleAddSource}
            onScanCompetitor={handleRunScan}
            onAskAboutCompetitor={(compName) => {
              setActiveTab('ask');
            }}
            onOpenEvidence={handleOpenEvidence}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelinePage
            events={events}
            competitors={competitors}
            onOpenEvidence={handleOpenEvidence}
            onSelectEventForComparison={(evtId) => {
              setSelectedEventIdForComparison(evtId);
              setActiveTab('compare');
            }}
          />
        )}

        {activeTab === 'insights' && (
          <InsightsPage insights={insights} onOpenEvidence={handleOpenEvidence} />
        )}

        {activeTab === 'alerts' && (
          <AlertsPage
            alerts={alerts}
            onMarkRead={handleAlertMarkRead}
            onDismiss={handleAlertDismiss}
            onFeedback={handleAlertFeedback}
            onOpenInsight={() => setActiveTab('insights')}
            onOpenAlertDetails={(alt) => setActiveAlertDetails(alt)}
          />
        )}

        {activeTab === 'ask' && (
          <AskAcrossTimePage
            competitors={competitors}
            onAskQuestion={handleAskQuestion}
            onOpenEvidence={handleOpenEvidence}
            demoClockDate={demoClockDate}
          />
        )}

        {activeTab === 'compare' && (
          <CompareMemoryPage
            events={events}
            selectedEventId={selectedEventIdForComparison}
            onCompare={handleCompare}
          />
        )}

        {activeTab === 'memory' && (
          <MemoryExplorerPage onOpenEvidence={handleOpenEvidence} />
        )}

        {activeTab === 'settings' && (
          <SettingsPage
            connections={connections}
            productProfile={productProfile}
            onTestConnections={handleTestConnections}
            onSaveProfile={handleSaveProfile}
            onLoadDemo={handleLoadDemo}
            onResetDemo={handleResetDemo}
            events={events}
            insights={insights}
            onOpenEvidence={handleOpenEvidence}
            onCompare={handleCompare}
            monitoringState={monitoringState}
            onStartMonitoring={handleStartMonitoring}
            onPauseMonitoring={handlePauseMonitoring}
            onResetMonitoring={handleResetMonitoring}
            onStepMonitoring={handleStepMonitoring}
            gmailState={gmailState}
            onRefreshAll={refreshAllData}
          />
        )}
      </main>

      {/* Global Proactive Alert Detail Modal */}
      <AlertDetailModal
        alert={activeAlertDetails}
        onClose={() => setActiveAlertDetails(null)}
        onMarkRead={handleAlertMarkRead}
        onFeedback={handleAlertFeedback}
        onOpenCompare={(evtId) => {
          setSelectedEventIdForComparison(evtId);
          setActiveTab('compare');
        }}
        events={events}
        insights={insights}
        onOpenEvidence={handleOpenEvidence}
      />

      {/* Global Real-Time Notification Toast */}
      <NotificationToast
        alert={newAlertToast}
        onClose={() => setNewAlertToast(null)}
        onOpenDetails={(alt) => setActiveAlertDetails(alt)}
      />

      {/* Global Evidence Modal */}
      <EvidenceModal
        evidence={activeEvidence}
        onClose={() => setActiveEvidence(null)}
        onSubmitCorrection={handleSubmitCorrection}
      />
    </div>
  );
}
