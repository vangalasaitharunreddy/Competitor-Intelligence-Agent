import { z } from 'zod';

export type EventType =
  | 'pricing_change'
  | 'feature_launch'
  | 'company_announcement'
  | 'messaging_shift'
  | 'hiring_signal'
  | 'partnership';

export type VerificationStatus = 'verified' | 'disputed' | 'invalidated' | 'pending';
export type ProvenanceType = 'live' | 'imported' | 'synthetic';
export type AlertPriority = 'high' | 'medium' | 'low';
export type SourceType =
  | 'pricing_page'
  | 'product_updates'
  | 'changelog'
  | 'announcements_rss'
  | 'custom_page'
  | 'text_feed';

export interface ProductProfile {
  id: string;
  workspaceId: string;
  productName: string;
  targetCustomerSegment: string;
  mainCapabilities: string[];
  pricingModel: string;
  markets: string[];
  strategicPriorities: string[];
  topicsToPrioritize: string[];
  topicsToIgnore: string[];
  updatedAt: string;
}

export interface Competitor {
  id: string;
  workspaceId: string;
  name: string;
  domain: string;
  description: string;
  tier: 'primary' | 'secondary' | 'watch';
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
  sourceCount?: number;
  lastScannedAt?: string | null;
}

export interface Source {
  id: string;
  workspaceId: string;
  competitorId: string;
  name: string;
  type: SourceType;
  url: string;
  active: boolean;
  fetchIntervalHours: number;
  lastFetchedAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  workspaceId: string;
  sourceId: string;
  competitorId: string;
  requestedUrl: string;
  finalUrl: string;
  fetchTimestamp: string;
  httpStatus: number;
  contentHash: string;
  readableExtractedText: string;
  originalContent: string;
  publishedDate: string | null;
  parserVersion: string;
}

export interface Evidence {
  id: string;
  workspaceId: string;
  competitorId: string;
  sourceId: string | null;
  snapshotId: string | null;
  sourceUrl: string;
  sourceTitle: string;
  passageText: string;
  observedAt: string;
  publishedDate: string | null;
  provenance: ProvenanceType;
  isDisputed: boolean;
  disputeReason?: string | null;
  createdAt: string;
}

export interface StructuredPricingValue {
  planName: string;
  currency: string;
  price: number;
  billingPeriod: 'monthly' | 'annual' | 'quarterly';
  unit: 'per_seat' | 'flat_rate' | 'usage';
  featuresSummary?: string[];
  changePercentage?: number;
}

export interface IntelligenceEvent {
  id: string;
  workspaceId: string;
  competitorId: string;
  eventType: EventType;
  title: string;
  description: string;
  publishedDate: string | null;
  firstObservedAt: string;
  effectiveDate: string | null;
  beforeValue: Record<string, any> | null;
  afterValue: Record<string, any> | null;
  evidenceIds: string[];
  verificationStatus: VerificationStatus;
  provenance: ProvenanceType;
  isSuperseded: boolean;
  supersededByEventId: string | null;
  invalidationReason: string | null;
  createdAt: string;
  // joined fields
  competitorName?: string;
  evidences?: Evidence[];
}

export interface StrategicInsight {
  id: string;
  workspaceId: string;
  competitorId: string | null;
  title: string;
  summary: string;
  observedChanges: string[];
  historicalPattern: string;
  businessSignificance: string;
  risks: string[];
  opportunities: string[];
  recommendedActions: string[];
  alternativeExplanations: string[];
  uncertainty: string;
  evidenceIds: string[];
  supportingEventIds: string[];
  coverageStart: string;
  coverageEnd: string;
  isStale: boolean;
  createdAt: string;
  // joined fields
  competitorName?: string;
}

export interface AlertAccountDelivery {
  accountId: string;
  email: string;
  status: 'sent' | 'failed' | 'reauth_required' | 'pending';
  sentAt?: string;
  error?: string;
}

export interface GmailAccount {
  id: string; // e.g. 'gmail_account_1', 'gmail_account_2', 'gmail_account_3'
  email: string;
  provider: 'google';
  status: 'connected' | 'reauth_required' | 'not_connected';
  scopes: string[];
  connectedAt?: string;
  lastUsedAt?: string | null;
  totalDelivered?: number;
  lastDeliveryStatus?: string | null;
  hasSendPermission?: boolean;
}

export interface IntelligenceAlert {
  id: string;
  workspaceId: string;
  competitorId: string;
  eventId: string;
  insightId: string | null;
  title: string;
  message: string;
  priority: AlertPriority;
  isRead: boolean;
  isDismissed: boolean;
  feedback: 'useful' | 'not_relevant' | 'incorrect' | null;
  feedbackNote: string | null;
  createdAt: string;
  // joined & historical memory intelligence fields
  metricChange?: string;
  historicalContext?: string;
  relatedSignals?: string[];
  whyItMatters?: string;
  detectedPattern?: string;
  competitiveImplication?: string;
  recentTimeline?: string[];
  gmailDeliveryStatus?: 'delivered' | 'pending_auth' | 'failed' | 'not_configured';
  gmailDeliveredTo?: string;
  gmailSentAt?: string;
  gmailDeliveries?: AlertAccountDelivery[];
  competitorName?: string;
  eventType?: EventType;
}

export interface AskQuestionRequest {
  question: string;
  competitorId?: string | null;
  coverageMonths?: number;
  historicalCutoffDate?: string | null;
  conversationId?: string | null;
}

export interface AskQuestionResponse {
  conversationId: string;
  answer: {
    summary: string;
    observedChanges: Array<{
      date: string;
      title: string;
      description: string;
      evidenceIds: string[];
      citationLabel: string;
    }>;
    historicalPattern: string;
    businessSignificance: string;
    recommendedNextSteps: string[];
    uncertaintyAndCoverage: string;
    alternativeExplanations: string[];
    evidenceList: Evidence[];
    memoryContextUsed: Array<{
      memoryId: string;
      type: string;
      date: string;
      summary: string;
      competitor: string;
    }>;
  };
  generatedAt: string;
  mode: 'hindsight_augmented' | 'canonical_fallback' | 'illustrative_sample';
}

export interface MemoryComparisonResponse {
  eventId: string;
  eventTitle: string;
  competitorName: string;
  eventDate: string;
  withoutHistory: {
    summary: string;
    interpretation: string;
    blindSpots: string[];
    suggestedActions: string[];
  };
  withHistory: {
    summary: string;
    connectedPatterns: string[];
    strategicSignificance: string;
    suggestedActions: string[];
    recalledEvents: Array<{
      id: string;
      date: string;
      title: string;
      eventType: string;
      howItConnects: string;
    }>;
  };
  recalledMemoryCount: number;
}

export interface MemoryOutboxItem {
  id: string;
  workspaceId: string;
  eventType: 'event_retained' | 'feedback_retained' | 'correction_updated' | 'alert_dispatch';
  entityId: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'confirmed' | 'failed';
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface MemoryItemView {
  id: string;
  documentId: string;
  bankId: string;
  competitor: string;
  category: string;
  recordType: 'verified_observation' | 'analyst_hypothesis' | 'user_preference' | 'accepted_correction';
  contentSnippet: string;
  evidenceIds: string[];
  canonicalEventId: string | null;
  status: 'confirmed' | 'queued' | 'pending';
  ingestedAt: string;
}

export interface ConnectionStatus {
  gemini: {
    configured: boolean;
    model: string;
    status: 'connected' | 'missing_configuration' | 'error';
    latencyMs?: number;
    error?: string | null;
  };
  hindsight: {
    configured: boolean;
    baseUrl: string;
    status: 'connected' | 'missing_configuration' | 'syncing' | 'error';
    activeBank: string;
    queuedCount: number;
    confirmedCount: number;
    error?: string | null;
  };
  database: {
    type: 'postgres_durable' | 'sqlite_local_preview';
    label: string;
    status: 'connected' | 'error';
    warning?: string;
  };
  monitoring: {
    mode: 'manual_and_api_scheduler';
    lastScanAt: string | null;
    activeSources: number;
  };
  gmail?: {
    connected: boolean;
    email: string | null;
    status: 'connected' | 'not_connected' | 'error';
    lastDeliveryStatus?: string | null;
    totalDelivered?: number;
    hasSendPermission?: boolean;
    needsReauthorization?: boolean;
    accounts?: GmailAccount[];
  };
  gmailAccounts?: GmailAccount[];
  continuousMonitoring?: {
    active: boolean;
    intervalSeconds: number;
    lastTickAt: string | null;
    nextTickAt: string | null;
    eventsProcessedCount: number;
    alertsTriggeredCount: number;
  };
}

export interface WorkspaceSession {
  workspaceId: string;
  isDemo: boolean;
  demoClockDate: string; // e.g. "2026-09-28"
}
