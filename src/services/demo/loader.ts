import type { IntelligenceRepository } from '../db/repository.ts';
import { hindsightAdapter } from '../hindsight/client.ts';
import {
  DEMO_WORKSPACE_ID,
  DEMO_COMPETITORS,
  DEMO_SOURCES,
  buildDeterministicSixMonthFixtures,
  buildDeterministicInsights,
  buildDeterministicAlerts,
} from './fixtures.ts';

export async function loadDeterministicSixMonthDemo(repo: IntelligenceRepository): Promise<{
  competitorsLoaded: number;
  sourcesLoaded: number;
  eventsLoaded: number;
  evidencesLoaded: number;
  insightsLoaded: number;
  alertsLoaded: number;
  memoryRetained: number;
  hindsightConnected: boolean;
}> {
  console.log('[Demo Loader] Starting idempotent load of 6-month demo dataset...');

  // 1. Competitors
  for (const c of DEMO_COMPETITORS) {
    const existing = await repo.getCompetitor(DEMO_WORKSPACE_ID, c.id);
    if (!existing) {
      await repo.createCompetitor(c);
    }
  }

  // 2. Sources
  for (const s of DEMO_SOURCES) {
    const existing = await repo.getSource(DEMO_WORKSPACE_ID, s.id);
    if (!existing) {
      await repo.createSource(s);
    }
  }

  // 3. Events & Evidence
  const bundles = buildDeterministicSixMonthFixtures();
  let eventsCount = 0;
  let evidenceCount = 0;
  let memoryCount = 0;

  const bankId = hindsightAdapter.getBankId(DEMO_WORKSPACE_ID, true);
  const hindsightConfigured = hindsightAdapter.isConfigured();

  for (const bundle of bundles) {
    // Evidence
    const existingEv = await repo.getEvidence(DEMO_WORKSPACE_ID, bundle.evidence.id);
    if (!existingEv) {
      await repo.createEvidence(bundle.evidence);
      evidenceCount++;
    }

    // Event
    const existingEvt = await repo.getEvent(DEMO_WORKSPACE_ID, bundle.event.id);
    if (!existingEvt) {
      await repo.createEvent(bundle.event);
      eventsCount++;

      // Retain in Hindsight and local Memory View
      const retainResult = await hindsightAdapter.retainEvent(
        bankId,
        bundle.event,
        [bundle.evidence],
        'verified_observation'
      );

      if (retainResult.status === 'confirmed') {
        memoryCount++;
      }

      // Record in memory items view
      await repo.saveMemoryItemView({
        id: `mem-${bundle.event.id}`,
        documentId: `event:${bundle.event.id}`,
        bankId,
        competitor: bundle.event.competitorName || bundle.event.competitorId,
        category: bundle.event.eventType,
        recordType: 'verified_observation',
        contentSnippet: `${bundle.event.title}: ${bundle.event.description.slice(0, 140)}...`,
        evidenceIds: bundle.event.evidenceIds,
        canonicalEventId: bundle.event.id,
        status: retainResult.status,
        ingestedAt: bundle.event.createdAt,
      });

      // Queue in memory outbox for transactional tracking
      await repo.queueMemoryOutbox({
        workspaceId: DEMO_WORKSPACE_ID,
        eventType: 'event_retained',
        entityId: bundle.event.id,
        payload: {
          eventId: bundle.event.id,
          bankId,
          documentId: `event:${bundle.event.id}`,
          status: retainResult.status,
          error: retainResult.error || null,
        },
      });
    }
  }

  // 4. Strategic Insights
  const insights = buildDeterministicInsights();
  let insightsCount = 0;
  for (const ins of insights) {
    const existing = await repo.getInsight(DEMO_WORKSPACE_ID, ins.id);
    if (!existing) {
      await repo.createInsight(ins);
      insightsCount++;
    }
  }

  // 5. Alerts
  const alerts = buildDeterministicAlerts();
  let alertsCount = 0;
  for (const alt of alerts) {
    const existing = await repo.getAlert(DEMO_WORKSPACE_ID, alt.id);
    if (!existing) {
      await repo.createAlert(alt);
      alertsCount++;
    }
  }

  console.log(`[Demo Loader] Completed. Events: ${eventsCount}, Insights: ${insightsCount}, Alerts: ${alertsCount}`);

  return {
    competitorsLoaded: DEMO_COMPETITORS.length,
    sourcesLoaded: DEMO_SOURCES.length,
    eventsLoaded: eventsCount,
    evidencesLoaded: evidenceCount,
    insightsLoaded: insightsCount,
    alertsLoaded: alertsCount,
    memoryRetained: memoryCount,
    hindsightConnected: hindsightConfigured,
  };
}

export async function resetDemoDataset(repo: IntelligenceRepository): Promise<void> {
  console.log('[Demo Loader] Resetting demo workspace data...');
  await repo.resetWorkspaceData(DEMO_WORKSPACE_ID);
}
