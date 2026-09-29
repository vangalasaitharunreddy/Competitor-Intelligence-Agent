import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepository, getDatabaseStatusInfo } from './src/services/db/index.ts';
import { testGeminiConnection, GEMINI_MODEL } from './src/services/gemini/client.ts';
import { hindsightAdapter } from './src/services/hindsight/client.ts';
import { loadDeterministicSixMonthDemo, resetDemoDataset } from './src/services/demo/loader.ts';
import { DEMO_WORKSPACE_ID, DEMO_CLOCK_DATE } from './src/services/demo/fixtures.ts';
import { askAcrossTime, compareWithAndWithoutHistory } from './src/services/reasoning/ask-service.ts';
import { runScan } from './src/services/reasoning/scan-orchestrator.ts';
import { startOutboxWorker, processPendingMemoryOutbox } from './src/services/jobs/outbox-worker.ts';
import { continuousMonitor } from './src/services/reasoning/continuous-monitor.ts';
import {
  setServerGmailSession,
  clearServerGmailSession,
  getServerGmailSession,
  sendGmailAlert,
  verifyGoogleTokenScopes,
} from './src/services/gmail/delivery-service.ts';
import type { Evidence, IntelligenceEvent, IntelligenceAlert } from './src/types/intelligence.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Workspace resolver middleware
function resolveWorkspace(req: Request, _res: Response, next: NextFunction) {
  const customWid = req.headers['x-workspace-id'] as string;
  (req as any).workspaceId = customWid || DEMO_WORKSPACE_ID;
  (req as any).isDemo = (req as any).workspaceId === DEMO_WORKSPACE_ID;
  next();
}

app.use(resolveWorkspace);

// Initialize DB, seed baseline dataset if needed, and start continuous 10s monitoring loop
let repoPromise = getRepository();
repoPromise.then(async (repo) => {
  try {
    const existingComps = await repo.listCompetitors(DEMO_WORKSPACE_ID);
    if (existingComps.length === 0) {
      console.log('[Startup] Seeding initial 6-month deterministic demo dataset...');
      await loadDeterministicSixMonthDemo(repo);
    }
  } catch (err: any) {
    console.warn('[Startup] Warning seeding initial demo dataset:', err.message);
  }

  // Exactly ONE active monitoring loop
  continuousMonitor.init(repo, DEMO_WORKSPACE_ID);
});

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Health
app.get('/api/health', async (_req: Request, res: Response) => {
  const dbInfo = getDatabaseStatusInfo();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    demoClockDate: DEMO_CLOCK_DATE,
    database: dbInfo,
  });
});

// 2. Connections & Status
app.get('/api/connections', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const isDemo = (req as any).isDemo;
  const bankId = hindsightAdapter.getBankId(workspaceId, isDemo);

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
  const hindsightConfigured = hindsightAdapter.isConfigured();
  const dbInfo = getDatabaseStatusInfo();

  const memoryItems = await repo.listMemoryItems(workspaceId);
  const sources = await repo.listSources(workspaceId);
  const activeSources = sources.filter((s) => s.active).length;

  res.json({
    gemini: {
      configured: geminiConfigured,
      model: GEMINI_MODEL,
      status: geminiConfigured ? 'connected' : 'missing_configuration',
      error: geminiConfigured ? null : 'GEMINI_API_KEY environment secret is not set.',
    },
    hindsight: {
      configured: hindsightConfigured,
      baseUrl: process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io',
      status: hindsightConfigured ? 'connected' : 'missing_configuration',
      activeBank: bankId,
      queuedCount: memoryItems.filter((m) => m.status === 'queued' || m.status === 'pending').length,
      confirmedCount: memoryItems.filter((m) => m.status === 'confirmed').length,
      error: hindsightConfigured ? null : 'HINDSIGHT_API_KEY environment secret is not set.',
    },
    database: dbInfo,
    monitoring: {
      mode: 'manual_and_api_scheduler',
      lastScanAt: sources.map((s) => s.lastFetchedAt).filter(Boolean).sort().reverse()[0] || null,
      activeSources,
    },
    gmail: {
      connected: Boolean(getServerGmailSession()?.hasSendPermission),
      email: getServerGmailSession()?.email || null,
      status: getServerGmailSession()?.hasSendPermission ? 'connected' : 'not_connected',
      hasSendPermission: Boolean(getServerGmailSession()?.hasSendPermission),
      needsReauthorization: Boolean(getServerGmailSession() && !getServerGmailSession()?.hasSendPermission),
      lastDeliveryStatus: getServerGmailSession()?.lastDeliveryStatus || null,
      totalDelivered: getServerGmailSession()?.totalDelivered || 0,
    },
    continuousMonitoring: continuousMonitor.getState(),
  });
});

// 3. Test Connections Real Server-Side Check
app.post('/api/connections/test', async (req: Request, res: Response) => {
  const { target } = req.body; // 'gemini' | 'hindsight' | 'all'
  const workspaceId = (req as any).workspaceId;
  const bankId = hindsightAdapter.getBankId(workspaceId, (req as any).isDemo);

  const results: Record<string, any> = {};

  if (target === 'gemini' || target === 'all' || !target) {
    results.gemini = await testGeminiConnection();
  }

  if (target === 'hindsight' || target === 'all' || !target) {
    results.hindsight = await hindsightAdapter.testConnection(bankId);
  }

  res.json({
    timestamp: new Date().toISOString(),
    results,
  });
});

// 4. Competitors
app.get('/api/competitors', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const list = await repo.listCompetitors((req as any).workspaceId);
  res.json(list);
});

app.post('/api/competitors', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { name, domain, description, tier } = req.body;

  if (!name || !domain) {
    return res.status(400).json({ error: 'Name and domain are required.' });
  }

  const comp = await repo.createCompetitor({
    id: 'comp-' + Math.random().toString(36).substring(2, 10),
    workspaceId,
    name,
    domain,
    description: description || '',
    tier: tier || 'primary',
    status: 'active',
  });
  res.status(201).json(comp);
});

app.patch('/api/competitors/:id', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  try {
    const updated = await repo.updateCompetitor(workspaceId, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Sources for a competitor
app.get('/api/competitors/:id/sources', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const sources = await repo.listSources((req as any).workspaceId, req.params.id);
  res.json(sources);
});

app.post('/api/competitors/:id/sources', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const competitorId = req.params.id;
  const { name, type, url, fetchIntervalHours } = req.body;

  if (!name || !type || !url) {
    return res.status(400).json({ error: 'Name, type, and URL are required.' });
  }

  const source = await repo.createSource({
    id: 'src-' + Math.random().toString(36).substring(2, 10),
    workspaceId,
    competitorId,
    name,
    type,
    url,
    active: true,
    fetchIntervalHours: fetchIntervalHours || 24,
    lastFetchedAt: null,
    lastStatus: null,
    lastError: null,
  });
  res.status(201).json(source);
});

// 5. Product Profile
app.get('/api/product-profile', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const profile = await repo.getProductProfile((req as any).workspaceId);
  res.json(profile);
});

app.put('/api/product-profile', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const updated = await repo.saveProductProfile({
    ...req.body,
    workspaceId,
  });
  res.json(updated);
});

// 6. Scans
app.post('/api/scans', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { sourceId, competitorId } = req.body;

  const job = await runScan(repo, workspaceId, { sourceId, competitorId });
  res.status(202).json(job);
});

app.get('/api/jobs/:id', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const job = await repo.getScanJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// 7. Events & Timeline
app.get('/api/events', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { competitorId, eventType, startDate, endDate, includeInvalidated } = req.query;

  const events = await repo.listEvents(workspaceId, {
    competitorId: competitorId as string,
    eventType: eventType as string,
    startDate: startDate as string,
    endDate: endDate as string,
    includeInvalidated: includeInvalidated === 'true',
  });
  res.json(events);
});

app.get('/api/events/:id', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const ev = await repo.getEvent((req as any).workspaceId, req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found' });
  res.json(ev);
});

// 8. Evidence
app.get('/api/evidence/:id', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const evidence = await repo.getEvidence((req as any).workspaceId, req.params.id);
  if (!evidence) return res.status(404).json({ error: 'Evidence record not found' });
  res.json(evidence);
});

// 9. Manual Imports (CSV / JSON / Pasted Text)
app.post('/api/imports', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { competitorId, eventType, title, description, publishedDate, passageText, sourceUrl, sourceTitle } = req.body;

  if (!competitorId || !title || !description) {
    return res.status(400).json({ error: 'Competitor, title, and description are required.' });
  }

  const date = publishedDate || new Date().toISOString().slice(0, 10);
  const evidenceId = 'evi-imp-' + Math.random().toString(36).substring(2, 9);
  const eventId = 'evt-imp-' + Math.random().toString(36).substring(2, 9);

  const evidence: Evidence = {
    id: evidenceId,
    workspaceId,
    competitorId,
    sourceId: null,
    snapshotId: null,
    sourceUrl: sourceUrl || 'https://import.manual.internal',
    sourceTitle: sourceTitle || 'Manually Imported Record',
    passageText: passageText || description,
    observedAt: new Date().toISOString(),
    publishedDate: date,
    provenance: 'imported',
    isDisputed: false,
    createdAt: new Date().toISOString(),
  };
  await repo.createEvidence(evidence);

  const comp = await repo.getCompetitor(workspaceId, competitorId);
  const event: IntelligenceEvent = {
    id: eventId,
    workspaceId,
    competitorId,
    competitorName: comp?.name,
    eventType: eventType || 'company_announcement',
    title,
    description,
    publishedDate: date,
    firstObservedAt: new Date().toISOString(),
    effectiveDate: date,
    beforeValue: null,
    afterValue: null,
    evidenceIds: [evidenceId],
    verificationStatus: 'verified',
    provenance: 'imported',
    isSuperseded: false,
    supersededByEventId: null,
    invalidationReason: null,
    createdAt: new Date().toISOString(),
  };
  await repo.createEvent(event);

  // Retain in Hindsight
  const bankId = hindsightAdapter.getBankId(workspaceId, (req as any).isDemo);
  await hindsightAdapter.retainEvent(bankId, event, [evidence], 'verified_observation');

  res.status(201).json({ event, evidence });
});

// 10. Insights
app.get('/api/insights', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const insights = await repo.listInsights((req as any).workspaceId, req.query.competitorId as string);
  res.json(insights);
});

// 11. Alerts
app.get('/api/alerts', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { priority, unreadOnly } = req.query;

  const alerts = await repo.listAlerts(workspaceId, {
    priority: priority as string,
    unreadOnly: unreadOnly === 'true',
  });
  res.json(alerts);
});

app.patch('/api/alerts/:id', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  try {
    const updated = await repo.updateAlert(workspaceId, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 12. Ask Across Time
app.post('/api/questions', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { question, competitorId, coverageMonths, historicalCutoffDate, conversationId } = req.body;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const response = await askAcrossTime(repo, workspaceId, {
      question,
      competitorId,
      coverageMonths,
      historicalCutoffDate,
      conversationId,
    });
    res.json(response);
  } catch (err: any) {
    console.error('AskAcrossTime error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 13. Memory Comparison ("Compare with and without history")
app.post('/api/comparisons', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { eventId } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: 'eventId is required for comparison.' });
  }

  try {
    const result = await compareWithAndWithoutHistory(repo, workspaceId, eventId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 14. Feedback & Corrections
app.post('/api/feedback', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const { targetType, targetId, feedbackType, notes, proposedCorrection, isAcceptedCorrection } = req.body;

  if (!targetType || !targetId || !feedbackType) {
    return res.status(400).json({ error: 'targetType, targetId, and feedbackType are required.' });
  }

  // 1. Record feedback entry
  await repo.recordFeedback({
    workspaceId,
    targetType,
    targetId,
    feedbackType,
    notes,
    proposedCorrection,
  });

  // 2. If target is alert, update alert state
  if (targetType === 'alert') {
    await repo.updateAlert(workspaceId, targetId, {
      feedback: feedbackType,
      feedbackNote: notes || proposedCorrection,
    });
  }

  // 3. If accepted correction on an event, supersede/invalidate canonical event and update memory
  if (targetType === 'event' && feedbackType === 'incorrect' && isAcceptedCorrection) {
    console.log(`[Correction] Applying accepted factual correction to event ${targetId}`);
    await repo.invalidateEvent(workspaceId, targetId, proposedCorrection || 'Factual correction accepted by user.');
    const event = await repo.getEvent(workspaceId, targetId);
    if (event) {
      if (event.evidenceIds.length > 0) {
        for (const evId of event.evidenceIds) {
          await repo.markEvidenceDisputed(workspaceId, evId, proposedCorrection || 'User correction');
        }
      }
      await repo.markInsightsStaleForCompetitor(workspaceId, event.competitorId);

      // Update memory with accepted correction record
      const bankId = hindsightAdapter.getBankId(workspaceId, (req as any).isDemo);
      await hindsightAdapter.retainEvent(
        bankId,
        {
          ...event,
          title: `[CORRECTED] ${event.title}`,
          description: `Correction: ${proposedCorrection || notes}`,
          verificationStatus: 'invalidated',
        },
        [],
        'accepted_correction'
      );
    }
  }

  res.json({ status: 'ok', recordedAt: new Date().toISOString() });
});

// 15. Memory Status & Explorer
app.get('/api/memory/status', async (req: Request, res: Response) => {
  const repo = await repoPromise;
  const workspaceId = (req as any).workspaceId;
  const bankId = hindsightAdapter.getBankId(workspaceId, (req as any).isDemo);

  const items = await repo.listMemoryItems(workspaceId);
  const outbox = await repo.getPendingOutboxItems(50);

  res.json({
    bankId,
    hindsightConfigured: hindsightAdapter.isConfigured(),
    totalRetained: items.length,
    confirmed: items.filter((i) => i.status === 'confirmed').length,
    queued: items.filter((i) => i.status === 'queued' || i.status === 'pending').length,
    items,
    outboxQueue: outbox,
  });
});

// 16. Demo Dataset Load & Reset
app.post('/api/demo/load', async (_req: Request, res: Response) => {
  const repo = await repoPromise;
  try {
    const result = await loadDeterministicSixMonthDemo(repo);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/demo/reset', async (_req: Request, res: Response) => {
  const repo = await repoPromise;
  try {
    await resetDemoDataset(repo);
    res.json({ success: true, message: 'Demo workspace data reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Protected Scheduler Trigger
app.post('/api/scheduler/trigger', async (req: Request, res: Response) => {
  const secret = req.headers['x-scheduler-secret'] || req.query.secret;
  if (process.env.SCHEDULER_SECRET && secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized scheduler secret.' });
  }

  const repo = await repoPromise;
  const job = await runScan(repo, (req as any).workspaceId);
  res.json({ triggered: true, job });
});

// 18. Continuous 10-Second Monitoring
app.get('/api/monitoring/status', (_req: Request, res: Response) => {
  res.json(continuousMonitor.getState());
});

app.post('/api/monitoring/start', (_req: Request, res: Response) => {
  continuousMonitor.start();
  res.json({
    success: true,
    message: 'Continuous 10-second monitoring loop active.',
    state: continuousMonitor.getState(),
  });
});

app.post('/api/monitoring/pause', (_req: Request, res: Response) => {
  continuousMonitor.pause();
  res.json({
    success: true,
    message: 'Continuous monitoring paused.',
    state: continuousMonitor.getState(),
  });
});

app.post('/api/monitoring/reset', async (_req: Request, res: Response) => {
  await continuousMonitor.reset();
  res.json({
    success: true,
    message: 'Continuous monitoring reset to start.',
    state: continuousMonitor.getState(),
  });
});

app.post('/api/monitoring/step', async (_req: Request, res: Response) => {
  const result = await continuousMonitor.stepOnce();
  res.json({ success: true, ...result, state: continuousMonitor.getState() });
});

// 19. Gmail Authentication & Delivery
app.get('/api/gmail/status', async (_req: Request, res: Response) => {
  const session = getServerGmailSession();
  if (!session || !session.accessToken) {
    return res.json({
      connected: false,
      hasSendPermission: false,
      needsReauthorization: false,
      email: null,
      totalDelivered: 0,
      lastDeliveryStatus: null,
    });
  }

  // Requirement 3: Check currently stored token
  const check = await verifyGoogleTokenScopes(session.accessToken);
  if (!check.valid || !check.hasGmailSend) {
    session.hasSendPermission = false;
    session.lastDeliveryStatus = 'Gmail permission needs to be reauthorized.';
    return res.json({
      connected: true,
      hasSendPermission: false,
      needsReauthorization: true,
      email: session.email,
      totalDelivered: session.totalDelivered || 0,
      lastDeliveryStatus: session.lastDeliveryStatus,
      error: 'Gmail permission needs to be reauthorized.',
    });
  }

  session.hasSendPermission = true;
  res.json({
    connected: true,
    hasSendPermission: true,
    needsReauthorization: false,
    email: session.email,
    connectedAt: session.connectedAt,
    totalDelivered: session.totalDelivered || 0,
    lastDeliveryStatus: session.lastDeliveryStatus || null,
  });
});

app.post('/api/gmail/connect', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : req.body.token;
  const email = req.body.email;

  if (!token) {
    return res.status(400).json({ error: 'OAuth Bearer access token is required.' });
  }

  // Requirement 3, 4, 6: Verify token has gmail.send before accepting
  const check = await verifyGoogleTokenScopes(token);
  if (!check.valid || !check.hasGmailSend) {
    clearServerGmailSession();
    return res.status(403).json({
      success: false,
      error: 'Gmail permission needs to be reauthorized.',
      needsReauthorization: true,
    });
  }

  const resolvedEmail = email || check.email || 'user@gmail.com';
  setServerGmailSession({
    accessToken: token,
    email: resolvedEmail,
    hasSendPermission: true,
  });

  // Flush pending alerts from outbox immediately
  repoPromise.then(async (repo) => {
    try {
      await processPendingMemoryOutbox(repo);
    } catch (err: any) {
      console.warn('[Outbox] Error flushing pending outbox on Gmail connect:', err.message);
    }
  });

  res.json({
    success: true,
    connected: true,
    hasSendPermission: true,
    message: 'Gmail account connected successfully. Send permission granted.',
    email: resolvedEmail,
  });
});

app.post('/api/gmail/disconnect', (_req: Request, res: Response) => {
  clearServerGmailSession();
  res.json({ success: true, message: 'Gmail account disconnected.' });
});

app.post('/api/gmail/test', async (req: Request, res: Response) => {
  const session = getServerGmailSession();
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7)
    : session?.accessToken;
  const recipient = req.body.email || session?.email;

  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Gmail permission needs to be reauthorized.',
      needsReauthorization: true,
    });
  }

  // Requirement 12 & 13: Before sending test email, verify credential has gmail.send scope.
  // If scope is missing, do NOT call Gmail API.
  const check = await verifyGoogleTokenScopes(token);
  if (!check.valid || !check.hasGmailSend) {
    if (session) {
      session.hasSendPermission = false;
      session.lastDeliveryStatus = 'Gmail permission needs to be reauthorized.';
    }
    return res.status(403).json({
      success: false,
      error: 'Gmail permission needs to be reauthorized.',
      needsReauthorization: true,
    });
  }

  const result = await sendGmailAlert(
    token,
    {
      competitorName: req.body.competitorName || 'NovaFlow',
      whatChanged: req.body.whatChanged || 'Enterprise tier reduced from ₹50,000 to ₹35,000/month (-30%).',
      historicalContext:
        req.body.historicalContext ||
        'This is the second consecutive price reduction in 6 months, following the OmniAgent AI launch.',
      detectedPattern:
        req.body.detectedPattern || 'Price cut following autonomous AI product release and talent acquisition.',
      whyItMatters: req.body.whyItMatters || 'Creates immediate pricing pressure during mid-market enterprise renewals.',
      recentTimeline: [
        'Baseline Enterprise Plan: ₹60,000/month',
        'OmniAgent Autonomous Remediation Launch',
        'Staff AI Evaluation & Security Hiring',
        'Current: Price reduced to ₹35,000/month (-30%)',
      ],
    },
    recipient
  );

  res.json(result);
});

// ----------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CompetitorLens server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
