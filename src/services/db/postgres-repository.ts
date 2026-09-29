import pg from 'pg';
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
import type { IntelligenceRepository, ScanJobRecord } from './repository.ts';

const { Pool } = pg;

export class PostgresRepository implements IntelligenceRepository {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    this.pool = new Pool({
      connectionString,
      ssl: isLocalhost ? undefined : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  isPostgres(): boolean {
    return true;
  }

  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS product_profiles (
          id TEXT PRIMARY KEY,
          workspace_id TEXT UNIQUE NOT NULL,
          product_name TEXT NOT NULL,
          target_customer_segment TEXT,
          main_capabilities JSONB,
          pricing_model TEXT,
          markets JSONB,
          strategic_priorities JSONB,
          topics_to_prioritize JSONB,
          topics_to_ignore JSONB,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS competitors (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          domain TEXT NOT NULL,
          description TEXT,
          tier TEXT DEFAULT 'primary',
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          competitor_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          url TEXT NOT NULL,
          active BOOLEAN DEFAULT TRUE,
          fetch_interval_hours INT DEFAULT 24,
          last_fetched_at TIMESTAMPTZ,
          last_status INT,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS snapshots (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          source_id TEXT NOT NULL,
          competitor_id TEXT NOT NULL,
          requested_url TEXT NOT NULL,
          final_url TEXT NOT NULL,
          fetch_timestamp TIMESTAMPTZ NOT NULL,
          http_status INT NOT NULL,
          content_hash TEXT NOT NULL,
          readable_extracted_text TEXT,
          original_content TEXT,
          published_date TEXT,
          parser_version TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS evidence (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          competitor_id TEXT NOT NULL,
          source_id TEXT,
          snapshot_id TEXT,
          source_url TEXT NOT NULL,
          source_title TEXT NOT NULL,
          passage_text TEXT NOT NULL,
          observed_at TIMESTAMPTZ NOT NULL,
          published_date TEXT,
          provenance TEXT DEFAULT 'live',
          is_disputed BOOLEAN DEFAULT FALSE,
          dispute_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          competitor_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          published_date TEXT,
          first_observed_at TIMESTAMPTZ NOT NULL,
          effective_date TEXT,
          before_value JSONB,
          after_value JSONB,
          verification_status TEXT DEFAULT 'verified',
          provenance TEXT DEFAULT 'live',
          is_superseded BOOLEAN DEFAULT FALSE,
          superseded_by_event_id TEXT,
          invalidation_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS event_evidence (
          event_id TEXT NOT NULL,
          evidence_id TEXT NOT NULL,
          PRIMARY KEY (event_id, evidence_id)
        );

        CREATE TABLE IF NOT EXISTS insights (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          competitor_id TEXT,
          title TEXT NOT NULL,
          summary TEXT NOT NULL,
          observed_changes JSONB NOT NULL,
          historical_pattern TEXT NOT NULL,
          business_significance TEXT NOT NULL,
          risks JSONB NOT NULL,
          opportunities JSONB NOT NULL,
          recommended_actions JSONB NOT NULL,
          alternative_explanations JSONB NOT NULL,
          uncertainty TEXT NOT NULL,
          evidence_ids JSONB NOT NULL,
          supporting_event_ids JSONB NOT NULL,
          coverage_start TEXT NOT NULL,
          coverage_end TEXT NOT NULL,
          is_stale BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          competitor_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          insight_id TEXT,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          is_read BOOLEAN DEFAULT FALSE,
          is_dismissed BOOLEAN DEFAULT FALSE,
          feedback TEXT,
          feedback_note TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS memory_outbox (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          status TEXT DEFAULT 'pending',
          retry_count INT DEFAULT 0,
          last_error TEXT,
          created_at TIMESTAMPTZ NOT NULL,
          processed_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS memory_items_view (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          bank_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          competitor TEXT NOT NULL,
          category TEXT NOT NULL,
          record_type TEXT NOT NULL,
          content_snippet TEXT NOT NULL,
          evidence_ids JSONB NOT NULL,
          canonical_event_id TEXT,
          status TEXT NOT NULL,
          ingested_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS feedback_records (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          feedback_type TEXT NOT NULL,
          notes TEXT,
          proposed_correction TEXT,
          created_at TIMESTAMPTZ NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scan_jobs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          source_id TEXT,
          competitor_id TEXT,
          status TEXT NOT NULL,
          total_sources INT DEFAULT 0,
          processed_sources INT DEFAULT 0,
          new_events_found INT DEFAULT 0,
          error_message TEXT,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL
        );

        ALTER TABLE alerts ADD COLUMN IF NOT EXISTS metric_change TEXT;
        ALTER TABLE alerts ADD COLUMN IF NOT EXISTS historical_context TEXT;
        ALTER TABLE alerts ADD COLUMN IF NOT EXISTS related_signals JSONB;
        ALTER TABLE alerts ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
      `);
    } finally {
      client.release();
    }
  }

  async getProductProfile(workspaceId: string): Promise<ProductProfile> {
    const res = await this.pool.query(`SELECT * FROM product_profiles WHERE workspace_id = $1`, [workspaceId]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        productName: row.product_name,
        targetCustomerSegment: row.target_customer_segment || '',
        mainCapabilities: row.main_capabilities || [],
        pricingModel: row.pricing_model || '',
        markets: row.markets || [],
        strategicPriorities: row.strategic_priorities || [],
        topicsToPrioritize: row.topics_to_prioritize || [],
        topicsToIgnore: row.topics_to_ignore || [],
        updatedAt: new Date(row.updated_at).toISOString(),
      };
    }
    const defaultProfile: ProductProfile = {
      id: 'profile-' + workspaceId,
      workspaceId,
      productName: 'ApexMetrics AI',
      targetCustomerSegment: 'Mid-Market and Enterprise B2B SaaS organizations needing unified operational telemetry',
      mainCapabilities: [
        'Real-time streaming telemetry and alerting',
        'Automated root-cause cluster analytics',
        'Enterprise RBAC, audit logging, and SOC2 readiness',
        'Integrated AI troubleshooting copilot',
      ],
      pricingModel: 'Hybrid per-host subscription starting at ₹45,000/mo plus tiered event overage',
      markets: ['North America', 'APAC Enterprise', 'Europe Fintech'],
      strategicPriorities: [
        'Defend enterprise tier from low-cost aggressive discount competitors',
        'Fast-follow real generative troubleshooting assistant features',
        'Emphasize enterprise reliability, compliance, and deterministic uptime',
      ],
      topicsToPrioritize: ['Pricing discounts', 'AI workflow agents', 'Enterprise certifications', 'Executive hiring'],
      topicsToIgnore: ['Routine holiday blog greetings', 'Minor typo changelogs'],
      updatedAt: new Date().toISOString(),
    };

    await this.pool.query(
      `INSERT INTO product_profiles (
        id, workspace_id, product_name, target_customer_segment, main_capabilities,
        pricing_model, markets, strategic_priorities, topics_to_prioritize, topics_to_ignore, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (workspace_id) DO NOTHING`,
      [
        defaultProfile.id,
        defaultProfile.workspaceId,
        defaultProfile.productName,
        defaultProfile.targetCustomerSegment,
        JSON.stringify(defaultProfile.mainCapabilities),
        defaultProfile.pricingModel,
        JSON.stringify(defaultProfile.markets),
        JSON.stringify(defaultProfile.strategicPriorities),
        JSON.stringify(defaultProfile.topicsToPrioritize),
        JSON.stringify(defaultProfile.topicsToIgnore),
        defaultProfile.updatedAt,
      ]
    );

    return defaultProfile;
  }

  async saveProductProfile(profile: Partial<ProductProfile> & { workspaceId: string }): Promise<ProductProfile> {
    const existing = await this.getProductProfile(profile.workspaceId);
    const updated: ProductProfile = { ...existing, ...profile, updatedAt: new Date().toISOString() };
    await this.pool.query(
      `INSERT INTO product_profiles (
        id, workspace_id, product_name, target_customer_segment, main_capabilities,
        pricing_model, markets, strategic_priorities, topics_to_prioritize, topics_to_ignore, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (workspace_id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        target_customer_segment = EXCLUDED.target_customer_segment,
        main_capabilities = EXCLUDED.main_capabilities,
        pricing_model = EXCLUDED.pricing_model,
        markets = EXCLUDED.markets,
        strategic_priorities = EXCLUDED.strategic_priorities,
        topics_to_prioritize = EXCLUDED.topics_to_prioritize,
        topics_to_ignore = EXCLUDED.topics_to_ignore,
        updated_at = EXCLUDED.updated_at`,
      [
        updated.id,
        updated.workspaceId,
        updated.productName,
        updated.targetCustomerSegment,
        JSON.stringify(updated.mainCapabilities),
        updated.pricingModel,
        JSON.stringify(updated.markets),
        JSON.stringify(updated.strategicPriorities),
        JSON.stringify(updated.topicsToPrioritize),
        JSON.stringify(updated.topicsToIgnore),
        updated.updatedAt,
      ]
    );
    return updated;
  }

  async listCompetitors(workspaceId: string): Promise<Competitor[]> {
    const res = await this.pool.query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM sources s WHERE s.competitor_id = c.id) as source_count,
        (SELECT MAX(s.last_fetched_at) FROM sources s WHERE s.competitor_id = c.id) as last_scanned_at
       FROM competitors c
       WHERE c.workspace_id = $1
       ORDER BY c.tier ASC, c.name ASC`,
      [workspaceId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      domain: row.domain,
      description: row.description || '',
      tier: row.tier,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      sourceCount: Number(row.source_count || 0),
      lastScannedAt: row.last_scanned_at ? new Date(row.last_scanned_at).toISOString() : null,
    }));
  }

  async getCompetitor(workspaceId: string, id: string): Promise<Competitor | null> {
    const list = await this.listCompetitors(workspaceId);
    return list.find((c) => c.id === id) || null;
  }

  async createCompetitor(comp: Omit<Competitor, 'createdAt' | 'updatedAt'>): Promise<Competitor> {
    const now = new Date().toISOString();
    const c = { ...comp, createdAt: now, updatedAt: now };
    await this.pool.query(
      `INSERT INTO competitors (id, workspace_id, name, domain, description, tier, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         domain = EXCLUDED.domain,
         description = EXCLUDED.description,
         tier = EXCLUDED.tier,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [c.id, c.workspaceId, c.name, c.domain, c.description, c.tier, c.status, c.createdAt, c.updatedAt]
    );
    return c;
  }

  async updateCompetitor(workspaceId: string, id: string, updates: Partial<Competitor>): Promise<Competitor> {
    const comp = await this.getCompetitor(workspaceId, id);
    if (!comp) throw new Error(`Competitor not found: ${id}`);
    const updated = { ...comp, ...updates, updatedAt: new Date().toISOString() };
    await this.pool.query(
      `UPDATE competitors SET name = $1, domain = $2, description = $3, tier = $4, status = $5, updated_at = $6
       WHERE id = $7 AND workspace_id = $8`,
      [updated.name, updated.domain, updated.description, updated.tier, updated.status, updated.updatedAt, id, workspaceId]
    );
    return updated;
  }

  async listSources(workspaceId: string, competitorId?: string): Promise<Source[]> {
    let q = `SELECT * FROM sources WHERE workspace_id = $1`;
    const params: any[] = [workspaceId];
    if (competitorId) {
      params.push(competitorId);
      q += ` AND competitor_id = $2`;
    }
    q += ` ORDER BY created_at DESC`;
    const res = await this.pool.query(q, params);
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      competitorId: row.competitor_id,
      name: row.name,
      type: row.type,
      url: row.url,
      active: row.active,
      fetchIntervalHours: row.fetch_interval_hours,
      lastFetchedAt: row.last_fetched_at ? new Date(row.last_fetched_at).toISOString() : null,
      lastStatus: row.last_status,
      lastError: row.last_error,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async getSource(workspaceId: string, id: string): Promise<Source | null> {
    const list = await this.listSources(workspaceId);
    return list.find((s) => s.id === id) || null;
  }

  async createSource(src: Omit<Source, 'createdAt'>): Promise<Source> {
    const now = new Date().toISOString();
    const source = { ...src, createdAt: now };
    await this.pool.query(
      `INSERT INTO sources (id, workspace_id, competitor_id, name, type, url, active, fetch_interval_hours, last_fetched_at, last_status, last_error, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         url = EXCLUDED.url,
         active = EXCLUDED.active,
         fetch_interval_hours = EXCLUDED.fetch_interval_hours`,
      [source.id, source.workspaceId, source.competitorId, source.name, source.type, source.url, source.active, source.fetchIntervalHours, source.lastFetchedAt, source.lastStatus, source.lastError, source.createdAt]
    );
    return source;
  }

  async updateSource(workspaceId: string, id: string, updates: Partial<Source>): Promise<Source> {
    const src = await this.getSource(workspaceId, id);
    if (!src) throw new Error(`Source not found: ${id}`);
    const updated = { ...src, ...updates };
    await this.pool.query(
      `UPDATE sources SET name = $1, type = $2, url = $3, active = $4, fetch_interval_hours = $5, last_fetched_at = $6, last_status = $7, last_error = $8
       WHERE id = $9 AND workspace_id = $10`,
      [updated.name, updated.type, updated.url, updated.active, updated.fetchIntervalHours, updated.lastFetchedAt, updated.lastStatus, updated.lastError, id, workspaceId]
    );
    return updated;
  }

  async createSnapshot(snapshot: Snapshot): Promise<Snapshot> {
    await this.pool.query(
      `INSERT INTO snapshots (id, workspace_id, source_id, competitor_id, requested_url, final_url, fetch_timestamp, http_status, content_hash, readable_extracted_text, original_content, published_date, parser_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [snapshot.id, snapshot.workspaceId, snapshot.sourceId, snapshot.competitorId, snapshot.requestedUrl, snapshot.finalUrl, snapshot.fetchTimestamp, snapshot.httpStatus, snapshot.contentHash, snapshot.readableExtractedText, snapshot.originalContent, snapshot.publishedDate, snapshot.parserVersion]
    );
    return snapshot;
  }

  async getLatestSnapshot(sourceId: string): Promise<Snapshot | null> {
    const res = await this.pool.query(
      `SELECT * FROM snapshots WHERE source_id = $1 ORDER BY fetch_timestamp DESC LIMIT 1`,
      [sourceId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id,
      competitorId: row.competitor_id,
      requestedUrl: row.requested_url,
      finalUrl: row.final_url,
      fetchTimestamp: new Date(row.fetch_timestamp).toISOString(),
      httpStatus: row.http_status,
      contentHash: row.content_hash,
      readableExtractedText: row.readable_extracted_text || '',
      originalContent: row.original_content || '',
      publishedDate: row.published_date,
      parserVersion: row.parser_version,
    };
  }

  async createEvidence(ev: Evidence): Promise<Evidence> {
    await this.pool.query(
      `INSERT INTO evidence (id, workspace_id, competitor_id, source_id, snapshot_id, source_url, source_title, passage_text, observed_at, published_date, provenance, is_disputed, dispute_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (id) DO UPDATE SET
         passage_text = EXCLUDED.passage_text,
         source_title = EXCLUDED.source_title,
         source_url = EXCLUDED.source_url`,
      [ev.id, ev.workspaceId, ev.competitorId, ev.sourceId, ev.snapshotId, ev.sourceUrl, ev.sourceTitle, ev.passageText, ev.observedAt, ev.publishedDate, ev.provenance, ev.isDisputed, ev.disputeReason, ev.createdAt]
    );
    return ev;
  }

  async getEvidence(workspaceId: string, id: string): Promise<Evidence | null> {
    const list = await this.getEvidencesByIds(workspaceId, [id]);
    return list[0] || null;
  }

  async getEvidencesByIds(workspaceId: string, ids: string[]): Promise<Evidence[]> {
    if (ids.length === 0) return [];
    const res = await this.pool.query(
      `SELECT * FROM evidence WHERE workspace_id = $1 AND id = ANY($2::text[])`,
      [workspaceId, ids]
    );
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      competitorId: row.competitor_id,
      sourceId: row.source_id,
      snapshotId: row.snapshot_id,
      sourceUrl: row.source_url,
      sourceTitle: row.source_title,
      passageText: row.passage_text,
      observedAt: new Date(row.observed_at).toISOString(),
      publishedDate: row.published_date,
      provenance: row.provenance,
      isDisputed: row.is_disputed,
      disputeReason: row.dispute_reason,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async markEvidenceDisputed(workspaceId: string, id: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE evidence SET is_disputed = TRUE, dispute_reason = $1 WHERE id = $2 AND workspace_id = $3`,
      [reason, id, workspaceId]
    );
  }

  async listEvents(
    workspaceId: string,
    filters?: {
      competitorId?: string;
      eventType?: string;
      startDate?: string;
      endDate?: string;
      includeInvalidated?: boolean;
    }
  ): Promise<IntelligenceEvent[]> {
    let q = `
      SELECT e.*, c.name as competitor_name
      FROM events e
      JOIN competitors c ON e.competitor_id = c.id
      WHERE e.workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let idx = 2;

    if (filters?.competitorId) {
      q += ` AND e.competitor_id = $${idx++}`;
      params.push(filters.competitorId);
    }
    if (filters?.eventType) {
      q += ` AND e.event_type = $${idx++}`;
      params.push(filters.eventType);
    }
    if (filters?.startDate) {
      q += ` AND COALESCE(e.published_date, to_char(e.first_observed_at, 'YYYY-MM-DD')) >= $${idx++}`;
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      q += ` AND COALESCE(e.published_date, to_char(e.first_observed_at, 'YYYY-MM-DD')) <= $${idx++}`;
      params.push(filters.endDate);
    }
    if (!filters?.includeInvalidated) {
      q += ` AND e.verification_status != 'invalidated'`;
    }
    q += ` ORDER BY COALESCE(e.published_date, to_char(e.first_observed_at, 'YYYY-MM-DD')) DESC, e.created_at DESC`;

    const res = await this.pool.query(q, params);
    const linksRes = await this.pool.query(`SELECT event_id, evidence_id FROM event_evidence`);
    const linkMap = new Map<string, string[]>();
    for (const row of linksRes.rows) {
      if (!linkMap.has(row.event_id)) linkMap.set(row.event_id, []);
      linkMap.get(row.event_id)!.push(row.evidence_id);
    }

    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      competitorId: row.competitor_id,
      competitorName: row.competitor_name,
      eventType: row.event_type,
      title: row.title,
      description: row.description,
      publishedDate: row.published_date,
      firstObservedAt: new Date(row.first_observed_at).toISOString(),
      effectiveDate: row.effective_date,
      beforeValue: row.before_value,
      afterValue: row.after_value,
      evidenceIds: linkMap.get(row.id) || [],
      verificationStatus: row.verification_status,
      provenance: row.provenance,
      isSuperseded: row.is_superseded,
      supersededByEventId: row.superseded_by_event_id,
      invalidationReason: row.invalidation_reason,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async getEvent(workspaceId: string, id: string): Promise<IntelligenceEvent | null> {
    const list = await this.listEvents(workspaceId, { includeInvalidated: true });
    const ev = list.find((e) => e.id === id);
    if (!ev) return null;
    if (ev.evidenceIds.length > 0) {
      ev.evidences = await this.getEvidencesByIds(workspaceId, ev.evidenceIds);
    }
    return ev;
  }

  async createEvent(event: IntelligenceEvent): Promise<IntelligenceEvent> {
    await this.pool.query(
      `INSERT INTO events (id, workspace_id, competitor_id, event_type, title, description, published_date, first_observed_at, effective_date, before_value, after_value, verification_status, provenance, is_superseded, superseded_by_event_id, invalidation_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         published_date = EXCLUDED.published_date,
         first_observed_at = EXCLUDED.first_observed_at,
         effective_date = EXCLUDED.effective_date,
         before_value = EXCLUDED.before_value,
         after_value = EXCLUDED.after_value,
         verification_status = EXCLUDED.verification_status,
         is_superseded = EXCLUDED.is_superseded,
         superseded_by_event_id = EXCLUDED.superseded_by_event_id,
         invalidation_reason = EXCLUDED.invalidation_reason`,
      [
        event.id,
        event.workspaceId,
        event.competitorId,
        event.eventType,
        event.title,
        event.description,
        event.publishedDate,
        event.firstObservedAt,
        event.effectiveDate,
        event.beforeValue ? JSON.stringify(event.beforeValue) : null,
        event.afterValue ? JSON.stringify(event.afterValue) : null,
        event.verificationStatus,
        event.provenance,
        event.isSuperseded,
        event.supersededByEventId,
        event.invalidationReason,
        event.createdAt,
      ]
    );

    if (event.evidenceIds && event.evidenceIds.length > 0) {
      for (const evId of event.evidenceIds) {
        await this.linkEventEvidence(event.id, evId);
      }
    }
    return event;
  }

  async linkEventEvidence(eventId: string, evidenceId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO event_evidence (event_id, evidence_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [eventId, evidenceId]
    );
  }

  async supersedeEvent(workspaceId: string, eventId: string, newEventId: string | null, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE events SET is_superseded = TRUE, superseded_by_event_id = $1, invalidation_reason = $2, verification_status = 'disputed'
       WHERE id = $3 AND workspace_id = $4`,
      [newEventId, reason, eventId, workspaceId]
    );
  }

  async invalidateEvent(workspaceId: string, eventId: string, reason: string): Promise<void> {
    await this.pool.query(
      `UPDATE events SET verification_status = 'invalidated', invalidation_reason = $1
       WHERE id = $2 AND workspace_id = $3`,
      [reason, eventId, workspaceId]
    );
  }

  async listInsights(workspaceId: string, competitorId?: string): Promise<StrategicInsight[]> {
    let q = `
      SELECT i.*, c.name as competitor_name
      FROM insights i
      LEFT JOIN competitors c ON i.competitor_id = c.id
      WHERE i.workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    if (competitorId) {
      q += ` AND i.competitor_id = $2`;
      params.push(competitorId);
    }
    q += ` ORDER BY i.created_at DESC`;
    const res = await this.pool.query(q, params);
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      competitorId: row.competitor_id,
      competitorName: row.competitor_name || 'All Competitors',
      title: row.title,
      summary: row.summary,
      observedChanges: row.observed_changes || [],
      historicalPattern: row.historical_pattern,
      businessSignificance: row.business_significance,
      risks: row.risks || [],
      opportunities: row.opportunities || [],
      recommendedActions: row.recommended_actions || [],
      alternativeExplanations: row.alternative_explanations || [],
      uncertainty: row.uncertainty,
      evidenceIds: row.evidence_ids || [],
      supportingEventIds: row.supporting_event_ids || [],
      coverageStart: row.coverage_start,
      coverageEnd: row.coverage_end,
      isStale: row.is_stale,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async getInsight(workspaceId: string, id: string): Promise<StrategicInsight | null> {
    const list = await this.listInsights(workspaceId);
    return list.find((i) => i.id === id) || null;
  }

  async createInsight(insight: StrategicInsight): Promise<StrategicInsight> {
    await this.pool.query(
      `INSERT INTO insights (id, workspace_id, competitor_id, title, summary, observed_changes, historical_pattern, business_significance, risks, opportunities, recommended_actions, alternative_explanations, uncertainty, evidence_ids, supporting_event_ids, coverage_start, coverage_end, is_stale, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         historical_pattern = EXCLUDED.historical_pattern,
         business_significance = EXCLUDED.business_significance,
         is_stale = EXCLUDED.is_stale`,
      [
        insight.id,
        insight.workspaceId,
        insight.competitorId,
        insight.title,
        insight.summary,
        JSON.stringify(insight.observedChanges),
        insight.historicalPattern,
        insight.businessSignificance,
        JSON.stringify(insight.risks),
        JSON.stringify(insight.opportunities),
        JSON.stringify(insight.recommendedActions),
        JSON.stringify(insight.alternativeExplanations),
        insight.uncertainty,
        JSON.stringify(insight.evidenceIds),
        JSON.stringify(insight.supportingEventIds),
        insight.coverageStart,
        insight.coverageEnd,
        insight.isStale,
        insight.createdAt,
      ]
    );
    return insight;
  }

  async markInsightsStaleForCompetitor(workspaceId: string, competitorId: string): Promise<void> {
    await this.pool.query(
      `UPDATE insights SET is_stale = TRUE WHERE workspace_id = $1 AND (competitor_id = $2 OR competitor_id IS NULL)`,
      [workspaceId, competitorId]
    );
  }

  async listAlerts(
    workspaceId: string,
    filters?: { priority?: string; unreadOnly?: boolean }
  ): Promise<IntelligenceAlert[]> {
    let q = `
      SELECT a.*, c.name as competitor_name, e.event_type
      FROM alerts a
      JOIN competitors c ON a.competitor_id = c.id
      JOIN events e ON a.event_id = e.id
      WHERE a.workspace_id = $1
    `;
    const params: any[] = [workspaceId];
    let idx = 2;
    if (filters?.priority) {
      q += ` AND a.priority = $${idx++}`;
      params.push(filters.priority);
    }
    if (filters?.unreadOnly) {
      q += ` AND a.is_read = FALSE`;
    }
    q += ` AND a.is_dismissed = FALSE ORDER BY a.created_at DESC`;
    const res = await this.pool.query(q, params);
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      competitorId: row.competitor_id,
      competitorName: row.competitor_name,
      eventType: row.event_type,
      eventId: row.event_id,
      insightId: row.insight_id,
      title: row.title,
      message: row.message,
      priority: row.priority,
      isRead: row.is_read,
      isDismissed: row.is_dismissed,
      feedback: row.feedback,
      feedbackNote: row.feedback_note,
      metricChange: row.metric_change || undefined,
      historicalContext: row.historical_context || undefined,
      relatedSignals: row.related_signals ? (Array.isArray(row.related_signals) ? row.related_signals : JSON.parse(row.related_signals)) : undefined,
      whyItMatters: row.why_it_matters || undefined,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async getAlert(workspaceId: string, id: string): Promise<IntelligenceAlert | null> {
    const list = await this.listAlerts(workspaceId);
    return list.find((a) => a.id === id) || null;
  }

  async createAlert(alert: IntelligenceAlert): Promise<IntelligenceAlert> {
    await this.pool.query(
      `INSERT INTO alerts (id, workspace_id, competitor_id, event_id, insight_id, title, message, priority, is_read, is_dismissed, feedback, feedback_note, metric_change, historical_context, related_signals, why_it_matters, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         message = EXCLUDED.message,
         priority = EXCLUDED.priority,
         is_read = EXCLUDED.is_read,
         is_dismissed = EXCLUDED.is_dismissed,
         feedback = EXCLUDED.feedback,
         feedback_note = EXCLUDED.feedback_note,
         metric_change = EXCLUDED.metric_change,
         historical_context = EXCLUDED.historical_context,
         related_signals = EXCLUDED.related_signals,
         why_it_matters = EXCLUDED.why_it_matters`,
      [
        alert.id,
        alert.workspaceId,
        alert.competitorId,
        alert.eventId,
        alert.insightId,
        alert.title,
        alert.message,
        alert.priority,
        alert.isRead,
        alert.isDismissed,
        alert.feedback,
        alert.feedbackNote,
        alert.metricChange || null,
        alert.historicalContext || null,
        alert.relatedSignals ? JSON.stringify(alert.relatedSignals) : null,
        alert.whyItMatters || null,
        alert.createdAt,
      ]
    );
    return alert;
  }

  async updateAlert(workspaceId: string, id: string, updates: Partial<IntelligenceAlert>): Promise<IntelligenceAlert> {
    const alert = await this.getAlert(workspaceId, id);
    if (!alert) throw new Error(`Alert not found: ${id}`);
    const updated = { ...alert, ...updates };
    await this.pool.query(
      `UPDATE alerts SET is_read = $1, is_dismissed = $2, feedback = $3, feedback_note = $4
       WHERE id = $5 AND workspace_id = $6`,
      [updated.isRead, updated.isDismissed, updated.feedback, updated.feedbackNote, id, workspaceId]
    );
    return updated;
  }

  async queueMemoryOutbox(
    item: Omit<MemoryOutboxItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'processedAt' | 'lastError'>
  ): Promise<MemoryOutboxItem> {
    const now = new Date().toISOString();
    const fullItem: MemoryOutboxItem = {
      id: 'outbox-' + Math.random().toString(36).substring(2, 11),
      createdAt: now,
      retryCount: 0,
      status: 'pending',
      processedAt: null,
      lastError: null,
      ...item,
    };
    await this.pool.query(
      `INSERT INTO memory_outbox (id, workspace_id, event_type, entity_id, payload, status, retry_count, last_error, created_at, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        fullItem.id,
        fullItem.workspaceId,
        fullItem.eventType,
        fullItem.entityId,
        JSON.stringify(fullItem.payload),
        fullItem.status,
        fullItem.retryCount,
        fullItem.lastError,
        fullItem.createdAt,
        fullItem.processedAt,
      ]
    );
    return fullItem;
  }

  async getPendingOutboxItems(limit = 100): Promise<MemoryOutboxItem[]> {
    const res = await this.pool.query(
      `SELECT * FROM memory_outbox WHERE status IN ('pending', 'failed') AND retry_count < 5 ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      eventType: row.event_type,
      entityId: row.entity_id,
      payload: row.payload,
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error,
      createdAt: new Date(row.created_at).toISOString(),
      processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
    }));
  }

  async getOutboxStats(workspaceId?: string): Promise<{
    pendingCount: number;
    confirmedCount: number;
    failedCount: number;
    lastStatus: string | null;
  }> {
    const filter = workspaceId ? 'WHERE workspace_id = $1' : '';
    const params = workspaceId ? [workspaceId] : [];
    const res = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
         COUNT(*) FILTER (WHERE status = 'failed') as failed_count
       FROM memory_outbox ${filter}`,
      params
    );
    const lastRow = await this.pool.query(
      `SELECT status FROM memory_outbox ${filter} ORDER BY created_at DESC LIMIT 1`,
      params
    );
    const row = res.rows[0] || {};
    return {
      pendingCount: parseInt(row.pending_count || '0', 10),
      confirmedCount: parseInt(row.confirmed_count || '0', 10),
      failedCount: parseInt(row.failed_count || '0', 10),
      lastStatus: lastRow.rows[0]?.status || 'idle',
    };
  }

  async updateOutboxStatus(
    id: string,
    status: 'pending' | 'processing' | 'confirmed' | 'failed',
    error?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.pool.query(
      `UPDATE memory_outbox SET status = $1, last_error = $2, processed_at = $3, retry_count = retry_count + 1 WHERE id = $4`,
      [status, error || null, now, id]
    );
  }

  async listMemoryItems(workspaceId: string): Promise<MemoryItemView[]> {
    const res = await this.pool.query(
      `SELECT * FROM memory_items_view WHERE workspace_id = $1 ORDER BY ingested_at DESC`,
      [workspaceId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      bankId: row.bank_id,
      competitor: row.competitor,
      category: row.category,
      recordType: row.record_type,
      contentSnippet: row.content_snippet,
      evidenceIds: row.evidence_ids || [],
      canonicalEventId: row.canonical_event_id,
      status: row.status,
      ingestedAt: new Date(row.ingested_at).toISOString(),
    }));
  }

  async saveMemoryItemView(item: MemoryItemView): Promise<void> {
    await this.pool.query(
      `INSERT INTO memory_items_view (id, document_id, bank_id, workspace_id, competitor, category, record_type, content_snippet, evidence_ids, canonical_event_id, status, ingested_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         content_snippet = EXCLUDED.content_snippet,
         ingested_at = EXCLUDED.ingested_at`,
      [
        item.id,
        item.documentId,
        item.bankId,
        item.id.includes('demo') ? 'demo' : 'live',
        item.competitor,
        item.category,
        item.recordType,
        item.contentSnippet,
        JSON.stringify(item.evidenceIds),
        item.canonicalEventId,
        item.status,
        item.ingestedAt,
      ]
    );
  }

  async recordFeedback(data: {
    workspaceId: string;
    targetType: 'alert' | 'insight' | 'event';
    targetId: string;
    feedbackType: 'useful' | 'not_relevant' | 'incorrect';
    notes?: string;
    proposedCorrection?: string;
  }): Promise<void> {
    const id = 'fb-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO feedback_records (id, workspace_id, target_type, target_id, feedback_type, notes, proposed_correction, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.workspaceId, data.targetType, data.targetId, data.feedbackType, data.notes, data.proposedCorrection, now]
    );
  }

  async createScanJob(job: ScanJobRecord): Promise<ScanJobRecord> {
    await this.pool.query(
      `INSERT INTO scan_jobs (id, workspace_id, source_id, competitor_id, status, total_sources, processed_sources, new_events_found, error_message, started_at, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [job.id, job.workspaceId, job.sourceId || null, job.competitorId || null, job.status, job.totalSources, job.processedSources, job.newEventsFound, job.errorMessage || null, job.startedAt || null, job.completedAt || null, job.createdAt]
    );
    return job;
  }

  async getScanJob(id: string): Promise<ScanJobRecord | null> {
    const res = await this.pool.query(`SELECT * FROM scan_jobs WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id,
      competitorId: row.competitor_id,
      status: row.status,
      totalSources: row.total_sources,
      processedSources: row.processed_sources,
      newEventsFound: row.new_events_found,
      errorMessage: row.error_message,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async updateScanJob(id: string, updates: Partial<ScanJobRecord>): Promise<ScanJobRecord> {
    const job = await this.getScanJob(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    const updated = { ...job, ...updates };
    await this.pool.query(
      `UPDATE scan_jobs SET status = $1, processed_sources = $2, new_events_found = $3, error_message = $4, started_at = $5, completed_at = $6
       WHERE id = $7`,
      [updated.status, updated.processedSources, updated.newEventsFound, updated.errorMessage || null, updated.startedAt || null, updated.completedAt || null, id]
    );
    return updated;
  }

  async resetWorkspaceData(workspaceId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM alerts WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM insights WHERE workspace_id = $1`, [workspaceId]);
      await client.query(
        `DELETE FROM event_evidence WHERE event_id IN (SELECT id FROM events WHERE workspace_id = $1)`,
        [workspaceId]
      );
      await client.query(`DELETE FROM events WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM evidence WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM snapshots WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM sources WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM competitors WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM memory_outbox WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM memory_items_view WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM feedback_records WHERE workspace_id = $1`, [workspaceId]);
      await client.query(`DELETE FROM scan_jobs WHERE workspace_id = $1`, [workspaceId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
