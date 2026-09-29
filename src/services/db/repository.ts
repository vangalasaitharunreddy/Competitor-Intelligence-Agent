import type {
  Competitor,
  Source,
  Snapshot,
  Evidence,
  IntelligenceEvent,
  StrategicInsight,
  IntelligenceAlert,
  ProductProfile,
  MemoryOutboxItem,
  MemoryItemView,
} from '../../types/intelligence.ts';

export interface ScanJobRecord {
  id: string;
  workspaceId: string;
  sourceId?: string;
  competitorId?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  totalSources: number;
  processedSources: number;
  newEventsFound: number;
  errorMessage?: string | null;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface IntelligenceRepository {
  init(): Promise<void>;
  isPostgres(): boolean;

  // Workspace & Profile
  getProductProfile(workspaceId: string): Promise<ProductProfile>;
  saveProductProfile(profile: Partial<ProductProfile> & { workspaceId: string }): Promise<ProductProfile>;

  // Competitors
  listCompetitors(workspaceId: string): Promise<Competitor[]>;
  getCompetitor(workspaceId: string, id: string): Promise<Competitor | null>;
  createCompetitor(comp: Omit<Competitor, 'createdAt' | 'updatedAt'>): Promise<Competitor>;
  updateCompetitor(workspaceId: string, id: string, updates: Partial<Competitor>): Promise<Competitor>;

  // Sources
  listSources(workspaceId: string, competitorId?: string): Promise<Source[]>;
  getSource(workspaceId: string, id: string): Promise<Source | null>;
  createSource(src: Omit<Source, 'createdAt'>): Promise<Source>;
  updateSource(workspaceId: string, id: string, updates: Partial<Source>): Promise<Source>;

  // Snapshots
  createSnapshot(snapshot: Snapshot): Promise<Snapshot>;
  getLatestSnapshot(sourceId: string): Promise<Snapshot | null>;

  // Evidence
  createEvidence(ev: Evidence): Promise<Evidence>;
  getEvidence(workspaceId: string, id: string): Promise<Evidence | null>;
  getEvidencesByIds(workspaceId: string, ids: string[]): Promise<Evidence[]>;
  markEvidenceDisputed(workspaceId: string, id: string, reason: string): Promise<void>;

  // Events
  listEvents(
    workspaceId: string,
    filters?: {
      competitorId?: string;
      eventType?: string;
      startDate?: string;
      endDate?: string;
      includeInvalidated?: boolean;
    }
  ): Promise<IntelligenceEvent[]>;
  getEvent(workspaceId: string, id: string): Promise<IntelligenceEvent | null>;
  createEvent(event: IntelligenceEvent): Promise<IntelligenceEvent>;
  linkEventEvidence(eventId: string, evidenceId: string): Promise<void>;
  supersedeEvent(workspaceId: string, eventId: string, newEventId: string | null, reason: string): Promise<void>;
  invalidateEvent(workspaceId: string, eventId: string, reason: string): Promise<void>;

  // Insights
  listInsights(workspaceId: string, competitorId?: string): Promise<StrategicInsight[]>;
  getInsight(workspaceId: string, id: string): Promise<StrategicInsight | null>;
  createInsight(insight: StrategicInsight): Promise<StrategicInsight>;
  markInsightsStaleForCompetitor(workspaceId: string, competitorId: string): Promise<void>;

  // Alerts
  listAlerts(
    workspaceId: string,
    filters?: { priority?: string; unreadOnly?: boolean }
  ): Promise<IntelligenceAlert[]>;
  getAlert(workspaceId: string, id: string): Promise<IntelligenceAlert | null>;
  createAlert(alert: IntelligenceAlert): Promise<IntelligenceAlert>;
  updateAlert(workspaceId: string, id: string, updates: Partial<IntelligenceAlert>): Promise<IntelligenceAlert>;

  // Memory Outbox
  queueMemoryOutbox(item: Omit<MemoryOutboxItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'processedAt' | 'lastError'>): Promise<MemoryOutboxItem>;
  getPendingOutboxItems(limit?: number): Promise<MemoryOutboxItem[]>;
  getOutboxStats(workspaceId?: string): Promise<{
    pendingCount: number;
    confirmedCount: number;
    failedCount: number;
    lastStatus: string | null;
  }>;
  updateOutboxStatus(
    id: string,
    status: 'pending' | 'processing' | 'confirmed' | 'failed',
    error?: string | null
  ): Promise<void>;
  listMemoryItems(workspaceId: string): Promise<MemoryItemView[]>;
  saveMemoryItemView(item: MemoryItemView): Promise<void>;

  // Feedback & Corrections
  recordFeedback(data: {
    workspaceId: string;
    targetType: 'alert' | 'insight' | 'event';
    targetId: string;
    feedbackType: 'useful' | 'not_relevant' | 'incorrect';
    notes?: string;
    proposedCorrection?: string;
  }): Promise<void>;

  // Jobs
  createScanJob(job: ScanJobRecord): Promise<ScanJobRecord>;
  getScanJob(id: string): Promise<ScanJobRecord | null>;
  updateScanJob(id: string, updates: Partial<ScanJobRecord>): Promise<ScanJobRecord>;

  // Reset / Demo
  resetWorkspaceData(workspaceId: string): Promise<void>;
}
