import crypto from 'node:crypto';
import type { IntelligenceRepository, ScanJobRecord } from '../db/repository.ts';
import { fetchPublicUrl, parseRssFeed } from '../collector/fetcher.ts';
import { comparePricingPlans, parsePricingText } from '../collector/pricing-comparator.ts';
import { hindsightAdapter } from '../hindsight/client.ts';
import type {
  Snapshot,
  Evidence,
  IntelligenceEvent,
  IntelligenceAlert,
  AlertPriority,
  StructuredPricingValue,
} from '../../types/intelligence.ts';

export async function runScan(
  repo: IntelligenceRepository,
  workspaceId: string,
  options?: { sourceId?: string; competitorId?: string }
): Promise<ScanJobRecord> {
  const jobId = 'job-' + Math.random().toString(36).substring(2, 10);
  const now = new Date().toISOString();

  let sources = await repo.listSources(workspaceId, options?.competitorId);
  if (options?.sourceId) {
    sources = sources.filter((s) => s.id === options.sourceId);
  }

  const jobRecord: ScanJobRecord = {
    id: jobId,
    workspaceId,
    sourceId: options?.sourceId,
    competitorId: options?.competitorId,
    status: 'running',
    totalSources: sources.length,
    processedSources: 0,
    newEventsFound: 0,
    startedAt: now,
    createdAt: now,
  };

  await repo.createScanJob(jobRecord);

  // Run in background or synchronously if few
  processScanJob(repo, jobRecord, sources).catch((err) => {
    console.error(`[Scan Job ${jobId}] Failed:`, err);
  });

  return jobRecord;
}

async function processScanJob(
  repo: IntelligenceRepository,
  job: ScanJobRecord,
  sources: Array<any>
): Promise<void> {
  let newEventsTotal = 0;
  const bankId = hindsightAdapter.getBankId(job.workspaceId, job.workspaceId.includes('demo'));

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    try {
      // 1. Fetch
      const fetchResult = await fetchPublicUrl(src.url);
      const latestSnapshot = await repo.getLatestSnapshot(src.id);

      // Save new Snapshot
      const snapshot: Snapshot = {
        id: 'snap-' + Math.random().toString(36).substring(2, 11),
        workspaceId: job.workspaceId,
        sourceId: src.id,
        competitorId: src.competitorId,
        requestedUrl: fetchResult.requestedUrl,
        finalUrl: fetchResult.finalUrl,
        fetchTimestamp: new Date().toISOString(),
        httpStatus: fetchResult.httpStatus,
        contentHash: fetchResult.contentHash,
        readableExtractedText: fetchResult.extractedText,
        originalContent: fetchResult.rawContent,
        publishedDate: fetchResult.publishedDate,
        parserVersion: fetchResult.parserVersion,
      };
      await repo.createSnapshot(snapshot);

      // Update source status
      await repo.updateSource(job.workspaceId, src.id, {
        lastFetchedAt: snapshot.fetchTimestamp,
        lastStatus: snapshot.httpStatus,
        lastError: null,
      });

      // 2. Baseline Check: First collection establishes baseline; identical content produces no new events
      if (!latestSnapshot) {
        console.log(`[Scan] Baseline established for source ${src.name} (${src.url})`);
        job.processedSources++;
        await repo.updateScanJob(job.id, {
          processedSources: job.processedSources,
          newEventsFound: newEventsTotal,
        });
        continue;
      }

      if (latestSnapshot.contentHash === fetchResult.contentHash) {
        console.log(`[Scan] No changes detected for source ${src.name} (identical hash)`);
        job.processedSources++;
        await repo.updateScanJob(job.id, {
          processedSources: job.processedSources,
          newEventsFound: newEventsTotal,
        });
        continue;
      }

      // 3. Extract Candidate Events based on source type
      const detectedDate = fetchResult.publishedDate || new Date().toISOString().slice(0, 10);

      if (src.type === 'pricing_page') {
        const oldPlans = parsePricingText(latestSnapshot.readableExtractedText);
        const newPlans = parsePricingText(fetchResult.extractedText);

        for (const np of newPlans) {
          const matchingOld = oldPlans.find((op) => op.planName.toLowerCase() === np.planName.toLowerCase());
          if (matchingOld) {
            const comparison = comparePricingPlans(matchingOld, np);
            if (comparison.isComparable && comparison.absoluteChange !== 0) {
              const deterministicKey = `${src.competitorId}_pricing_${detectedDate}_${np.planName}_${comparison.previousPrice}_${comparison.newPrice}`;
              const eventHash = crypto.createHash('sha256').update(deterministicKey).digest('hex').slice(0, 10);
              const eventId = `evt-${eventHash}`;
              const evidenceId = `evi-${eventHash}`;
              const alertId = `alt-${eventHash}`;

              const existingEvt = await repo.getEvent(job.workspaceId, eventId);
              if (existingEvt) {
                console.log(`[Scan] Event ${eventId} already exists, skipping duplicate.`);
                continue;
              }

              const evidence: Evidence = {
                id: evidenceId,
                workspaceId: job.workspaceId,
                competitorId: src.competitorId,
                sourceId: src.id,
                snapshotId: snapshot.id,
                sourceUrl: src.url,
                sourceTitle: `${src.name} - Pricing Table`,
                passageText: `Observed change: ${comparison.formattedChangeDescription}. Previous price: ${comparison.previousPrice}, Current: ${comparison.newPrice}.`,
                observedAt: new Date().toISOString(),
                publishedDate: detectedDate,
                provenance: 'live',
                isDisputed: false,
                createdAt: new Date().toISOString(),
              };
              await repo.createEvidence(evidence);

              const comp = await repo.getCompetitor(job.workspaceId, src.competitorId);
              const event: IntelligenceEvent = {
                id: eventId,
                workspaceId: job.workspaceId,
                competitorId: src.competitorId,
                competitorName: comp?.name,
                eventType: 'pricing_change',
                title: `${comp?.name || 'Competitor'} ${comparison.formattedChangeDescription}`,
                description: `Pricing for ${np.planName} tier changed from ${comparison.currency}${comparison.previousPrice} to ${comparison.currency}${comparison.newPrice} (${comparison.percentageChange}% change).`,
                publishedDate: detectedDate,
                firstObservedAt: new Date().toISOString(),
                effectiveDate: detectedDate,
                beforeValue: matchingOld as any,
                afterValue: { ...np, changePercentage: comparison.percentageChange } as any,
                evidenceIds: [evidenceId],
                verificationStatus: 'verified',
                provenance: 'live',
                isSuperseded: false,
                supersededByEventId: null,
                invalidationReason: null,
                createdAt: new Date().toISOString(),
              };
              await repo.createEvent(event);
              newEventsTotal++;

              // Retain in Hindsight and queue outbox
              await hindsightAdapter.retainEvent(bankId, event, [evidence], 'verified_observation');
              await repo.queueMemoryOutbox({
                workspaceId: job.workspaceId,
                eventType: 'event_retained',
                entityId: eventId,
                payload: { eventId, bankId, title: event.title },
              });

              // Create proactive alert with Hindsight historical memory
              const absPct = Math.abs(comparison.percentageChange);
              if (absPct >= 10) {
                const priority: AlertPriority = absPct >= 20 ? 'high' : 'medium';
                let historicalContext = '';
                let relatedSignals: string[] = [];
                let whyItMatters = '';

                try {
                  const recallResponse = await hindsightAdapter.recallHistory(
                    bankId,
                    `${comp?.name || 'Competitor'} pricing ${np.planName}`,
                    { limit: 4 }
                  );
                  if (recallResponse.results && recallResponse.results.length > 0) {
                    historicalContext = `Hindsight identified ${recallResponse.results.length} related historical memory items across monitoring period.`;
                    relatedSignals = recallResponse.results.slice(0, 3).map((r: any) => (r.text || r.contentSnippet || '').slice(0, 70));
                    whyItMatters = `This pricing change is part of a larger ongoing competitive trajectory.`;
                  }
                } catch {
                  // graceful fallback
                }

                const existingAlert = await repo.getAlert(job.workspaceId, alertId);
                if (!existingAlert) {
                  const alert: IntelligenceAlert = {
                    id: alertId,
                    workspaceId: job.workspaceId,
                    competitorId: src.competitorId,
                    eventId,
                    insightId: null,
                    title: `${comp?.name || 'Competitor'} ${comparison.isReduction ? 'reduced' : 'changed'} ${np.planName} pricing`,
                    message: `${np.planName} pricing changed from ${comparison.currency}${comparison.previousPrice} to ${comparison.currency}${comparison.newPrice}/month (${comparison.percentageChange}%).`,
                    metricChange: `${comparison.currency}${comparison.previousPrice} → ${comparison.currency}${comparison.newPrice}/month (${comparison.percentageChange > 0 ? '+' : ''}${comparison.percentageChange}%)`,
                    historicalContext: historicalContext || `Previous observed price was ${comparison.currency}${comparison.previousPrice}/month.`,
                    relatedSignals,
                    whyItMatters: whyItMatters || `Significant ${absPct}% pricing movement impacting competitive win-rates.`,
                    priority,
                    isRead: false,
                    isDismissed: false,
                    feedback: null,
                    feedbackNote: null,
                    createdAt: new Date().toISOString(),
                  };
                  await repo.createAlert(alert);
                }
              }
            }
          }
        }
      } else if (src.type === 'announcements_rss') {
        const feedItems = parseRssFeed(fetchResult.rawContent);
        if (feedItems.length > 0) {
          const first = feedItems[0];
          const deterministicKey = `${src.competitorId}_announcement_${first.link || first.title}_${first.pubDate || detectedDate}`;
          const hash = crypto.createHash('sha256').update(deterministicKey).digest('hex').slice(0, 10);
          const evidenceId = `evi-${hash}`;
          const eventId = `evt-${hash}`;

          const existingEvt = await repo.getEvent(job.workspaceId, eventId);
          if (existingEvt) {
            console.log(`[Scan] Announcement ${eventId} already exists, skipping duplicate.`);
            continue;
          }

          const evidence: Evidence = {
            id: evidenceId,
            workspaceId: job.workspaceId,
            competitorId: src.competitorId,
            sourceId: src.id,
            snapshotId: snapshot.id,
            sourceUrl: first.link || src.url,
            sourceTitle: first.title,
            passageText: first.description || first.title,
            observedAt: new Date().toISOString(),
            publishedDate: first.pubDate || detectedDate,
            provenance: 'live',
            isDisputed: false,
            createdAt: new Date().toISOString(),
          };
          await repo.createEvidence(evidence);

          const comp = await repo.getCompetitor(job.workspaceId, src.competitorId);
          const event: IntelligenceEvent = {
            id: eventId,
            workspaceId: job.workspaceId,
            competitorId: src.competitorId,
            competitorName: comp?.name,
            eventType: 'company_announcement',
            title: `${comp?.name || 'Competitor'}: ${first.title}`,
            description: first.description.slice(0, 300),
            publishedDate: first.pubDate || detectedDate,
            firstObservedAt: new Date().toISOString(),
            effectiveDate: first.pubDate || detectedDate,
            beforeValue: null,
            afterValue: { url: first.link },
            evidenceIds: [evidenceId],
            verificationStatus: 'verified',
            provenance: 'live',
            isSuperseded: false,
            supersededByEventId: null,
            invalidationReason: null,
            createdAt: new Date().toISOString(),
          };
          await repo.createEvent(event);
          newEventsTotal++;

          await hindsightAdapter.retainEvent(bankId, event, [evidence], 'verified_observation');
        }
      }
    } catch (err: any) {
      console.warn(`[Scan] Failed fetching source ${src.url}: ${err.message}`);
      await repo.updateSource(job.workspaceId, src.id, {
        lastFetchedAt: new Date().toISOString(),
        lastStatus: 500,
        lastError: err.message,
      });
      // Do NOT create removal events on fetch failures!
    }

    job.processedSources++;
    await repo.updateScanJob(job.id, {
      processedSources: job.processedSources,
      newEventsFound: newEventsTotal,
    });
  }

  await repo.updateScanJob(job.id, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    newEventsFound: newEventsTotal,
  });
}
