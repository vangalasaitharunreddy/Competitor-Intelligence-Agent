import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
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

const DB_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'competitorlens.sqlite');

export class SqliteRepository implements IntelligenceRepository {
  private db: SqlJsDatabase | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  isPostgres(): boolean {
    return false;
  }

  async init(): Promise<void> {
    if (this.db) return;

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileBuffer = fs.readFileSync(DB_FILE);
        this.db = new SQL.Database(fileBuffer);
      } catch (err) {
        console.warn('Failed to load existing SQLite database, creating new one', err);
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }

    this.runMigrations();
    this.persist();
  }

  private persist(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      fs.writeFileSync(DB_FILE, Buffer.from(data));
    } catch (err) {
      console.error('Error persisting SQLite file:', err);
    }
  }

  private schedulePersist(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.persist();
    }, 100);
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS product_profiles (
        id TEXT PRIMARY KEY,
        workspace_id TEXT UNIQUE NOT NULL,
        product_name TEXT NOT NULL,
        target_customer_segment TEXT,
        main_capabilities TEXT,
        pricing_model TEXT,
        markets TEXT,
        strategic_priorities TEXT,
        topics_to_prioritize TEXT,
        topics_to_ignore TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS competitors (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        description TEXT,
        tier TEXT DEFAULT 'primary',
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        competitor_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        fetch_interval_hours INTEGER DEFAULT 24,
        last_fetched_at TEXT,
        last_status INTEGER,
        last_error TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        competitor_id TEXT NOT NULL,
        requested_url TEXT NOT NULL,
        final_url TEXT NOT NULL,
        fetch_timestamp TEXT NOT NULL,
        http_status INTEGER NOT NULL,
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
        observed_at TEXT NOT NULL,
        published_date TEXT,
        provenance TEXT DEFAULT 'live',
        is_disputed INTEGER DEFAULT 0,
        dispute_reason TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        competitor_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        published_date TEXT,
        first_observed_at TEXT NOT NULL,
        effective_date TEXT,
        before_value TEXT,
        after_value TEXT,
        verification_status TEXT DEFAULT 'verified',
        provenance TEXT DEFAULT 'live',
        is_superseded INTEGER DEFAULT 0,
        superseded_by_event_id TEXT,
        invalidation_reason TEXT,
        created_at TEXT NOT NULL
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
        observed_changes TEXT NOT NULL,
        historical_pattern TEXT NOT NULL,
        business_significance TEXT NOT NULL,
        risks TEXT NOT NULL,
        opportunities TEXT NOT NULL,
        recommended_actions TEXT NOT NULL,
        alternative_explanations TEXT NOT NULL,
        uncertainty TEXT NOT NULL,
        evidence_ids TEXT NOT NULL,
        supporting_event_ids TEXT NOT NULL,
        coverage_start TEXT NOT NULL,
        coverage_end TEXT NOT NULL,
        is_stale INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
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
        is_read INTEGER DEFAULT 0,
        is_dismissed INTEGER DEFAULT 0,
        feedback TEXT,
        feedback_note TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_outbox (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        processed_at TEXT
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
        evidence_ids TEXT NOT NULL,
        canonical_event_id TEXT,
        status TEXT NOT NULL,
        ingested_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS feedback_records (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        feedback_type TEXT NOT NULL,
        notes TEXT,
        proposed_correction TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS scan_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        source_id TEXT,
        competitor_id TEXT,
        status TEXT NOT NULL,
        total_sources INTEGER DEFAULT 0,
        processed_sources INTEGER DEFAULT 0,
        new_events_found INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  // --- Product Profile ---
  async getProductProfile(workspaceId: string): Promise<ProductProfile> {
    if (!this.db) throw new Error('DB not initialized');
    const stmt = this.db.prepare(`SELECT * FROM product_profiles WHERE workspace_id = :wid`);
    stmt.bind({ ':wid': workspaceId });
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        productName: row.product_name as string,
        targetCustomerSegment: (row.target_customer_segment as string) || '',
        mainCapabilities: JSON.parse((row.main_capabilities as string) || '[]'),
        pricingModel: (row.pricing_model as string) || '',
        markets: JSON.parse((row.markets as string) || '[]'),
        strategicPriorities: JSON.parse((row.strategic_priorities as string) || '[]'),
        topicsToPrioritize: JSON.parse((row.topics_to_prioritize as string) || '[]'),
        topicsToIgnore: JSON.parse((row.topics_to_ignore as string) || '[]'),
        updatedAt: row.updated_at as string,
      };
    }
    stmt.free();

    // Default Profile
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

    this.db.run(
      `INSERT OR REPLACE INTO product_profiles (
        id, workspace_id, product_name, target_customer_segment, main_capabilities,
        pricing_model, markets, strategic_priorities, topics_to_prioritize, topics_to_ignore, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    this.schedulePersist();
    return defaultProfile;
  }

  async saveProductProfile(profile: Partial<ProductProfile> & { workspaceId: string }): Promise<ProductProfile> {
    if (!this.db) throw new Error('DB not initialized');
    const stmt = this.db.prepare(`SELECT * FROM product_profiles WHERE workspace_id = :wid`);
    stmt.bind({ ':wid': profile.workspaceId });
    let existing: Partial<ProductProfile> = {};
    if (stmt.step()) {
      const row = stmt.getAsObject();
      existing = {
        id: row.id as string,
        workspaceId: row.workspace_id as string,
        productName: row.product_name as string,
        targetCustomerSegment: (row.target_customer_segment as string) || '',
        mainCapabilities: JSON.parse((row.main_capabilities as string) || '[]'),
        pricingModel: (row.pricing_model as string) || '',
        markets: JSON.parse((row.markets as string) || '[]'),
        strategicPriorities: JSON.parse((row.strategic_priorities as string) || '[]'),
        topicsToPrioritize: JSON.parse((row.topics_to_prioritize as string) || '[]'),
        topicsToIgnore: JSON.parse((row.topics_to_ignore as string) || '[]'),
        updatedAt: row.updated_at as string,
      };
    }
    stmt.free();

    const updated: ProductProfile = {
      id: profile.id || existing.id || 'profile-' + profile.workspaceId,
      workspaceId: profile.workspaceId,
      productName: profile.productName || existing.productName || 'ApexMetrics AI',
      targetCustomerSegment: profile.targetCustomerSegment ?? existing.targetCustomerSegment ?? '',
      mainCapabilities: profile.mainCapabilities ?? existing.mainCapabilities ?? [],
      pricingModel: profile.pricingModel ?? existing.pricingModel ?? '',
      markets: profile.markets ?? existing.markets ?? [],
      strategicPriorities: profile.strategicPriorities ?? existing.strategicPriorities ?? [],
      topicsToPrioritize: profile.topicsToPrioritize ?? existing.topicsToPrioritize ?? [],
      topicsToIgnore: profile.topicsToIgnore ?? existing.topicsToIgnore ?? [],
      updatedAt: new Date().toISOString(),
    };

    this.db.run(
      `INSERT OR REPLACE INTO product_profiles (
        id, workspace_id, product_name, target_customer_segment, main_capabilities,
        pricing_model, markets, strategic_priorities, topics_to_prioritize, topics_to_ignore, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    this.schedulePersist();
    return updated;
  }

  // --- Competitors ---
  async listCompetitors(workspaceId: string): Promise<Competitor[]> {
    if (!this.db) throw new Error('DB not initialized');
    const res = this.db.exec(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM sources s WHERE s.competitor_id = c.id) as source_count,
        (SELECT MAX(s.last_fetched_at) FROM sources s WHERE s.competitor_id = c.id) as last_scanned_at
       FROM competitors c 
       WHERE c.workspace_id = '${workspaceId.replace(/'/g, "''")}'
       ORDER BY c.tier ASC, c.name ASC`
    );

    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((val) => {
      const row: Record<string, any> = {};
      cols.forEach((col, idx) => {
        row[col] = val[idx];
      });
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        domain: row.domain,
        description: row.description || '',
        tier: row.tier,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sourceCount: Number(row.source_count || 0),
        lastScannedAt: row.last_scanned_at || null,
      };
    });
  }

  async getCompetitor(workspaceId: string, id: string): Promise<Competitor | null> {
    const list = await this.listCompetitors(workspaceId);
    return list.find((c) => c.id === id) || null;
  }

  async createCompetitor(comp: Omit<Competitor, 'createdAt' | 'updatedAt'>): Promise<Competitor> {
    if (!this.db) throw new Error('DB not initialized');
    const now = new Date().toISOString();
    const competitor: Competitor = {
      ...comp,
      createdAt: now,
      updatedAt: now,
    };
    this.db.run(
      `INSERT INTO competitors (id, workspace_id, name, domain, description, tier, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        competitor.id,
        competitor.workspaceId,
        competitor.name,
        competitor.domain,
        competitor.description,
        competitor.tier,
        competitor.status,
        competitor.createdAt,
        competitor.updatedAt,
      ]
    );
    this.schedulePersist();
    return competitor;
  }

  async updateCompetitor(workspaceId: string, id: string, updates: Partial<Competitor>): Promise<Competitor> {
    const comp = await this.getCompetitor(workspaceId, id);
    if (!comp) throw new Error(`Competitor not found: ${id}`);
    const now = new Date().toISOString();
    const updated: Competitor = { ...comp, ...updates, updatedAt: now };

    this.db?.run(
      `UPDATE competitors SET name = ?, domain = ?, description = ?, tier = ?, status = ?, updated_at = ?
       WHERE id = ? AND workspace_id = ?`,
      [
        updated.name,
        updated.domain,
        updated.description,
        updated.tier,
        updated.status,
        updated.updatedAt,
        id,
        workspaceId,
      ]
    );
    this.schedulePersist();
    return updated;
  }

  // --- Sources ---
  async listSources(workspaceId: string, competitorId?: string): Promise<Source[]> {
    if (!this.db) throw new Error('DB not initialized');
    let q = `SELECT * FROM sources WHERE workspace_id = '${workspaceId.replace(/'/g, "''")}'`;
    if (competitorId) {
      q += ` AND competitor_id = '${competitorId.replace(/'/g, "''")}'`;
    }
    q += ` ORDER BY created_at DESC`;
    const res = this.db.exec(q);
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        competitorId: row.competitor_id,
        name: row.name,
        type: row.type,
        url: row.url,
        active: Boolean(row.active),
        fetchIntervalHours: row.fetch_interval_hours,
        lastFetchedAt: row.last_fetched_at || null,
        lastStatus: row.last_status,
        lastError: row.last_error || null,
        createdAt: row.created_at,
      };
    });
  }

  async getSource(workspaceId: string, id: string): Promise<Source | null> {
    const sources = await this.listSources(workspaceId);
    return sources.find((s) => s.id === id) || null;
  }

  async createSource(src: Omit<Source, 'createdAt'>): Promise<Source> {
    if (!this.db) throw new Error('DB not initialized');
    const now = new Date().toISOString();
    const source: Source = {
      ...src,
      createdAt: now,
    };
    this.db.run(
      `INSERT INTO sources (id, workspace_id, competitor_id, name, type, url, active, fetch_interval_hours, last_fetched_at, last_status, last_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source.id,
        source.workspaceId,
        source.competitorId,
        source.name,
        source.type,
        source.url,
        source.active ? 1 : 0,
        source.fetchIntervalHours,
        source.lastFetchedAt,
        source.lastStatus,
        source.lastError,
        source.createdAt,
      ]
    );
    this.schedulePersist();
    return source;
  }

  async updateSource(workspaceId: string, id: string, updates: Partial<Source>): Promise<Source> {
    const src = await this.getSource(workspaceId, id);
    if (!src) throw new Error(`Source not found: ${id}`);
    const updated = { ...src, ...updates };
    this.db?.run(
      `UPDATE sources SET name = ?, type = ?, url = ?, active = ?, fetch_interval_hours = ?, last_fetched_at = ?, last_status = ?, last_error = ?
       WHERE id = ? AND workspace_id = ?`,
      [
        updated.name,
        updated.type,
        updated.url,
        updated.active ? 1 : 0,
        updated.fetchIntervalHours,
        updated.lastFetchedAt,
        updated.lastStatus,
        updated.lastError,
        id,
        workspaceId,
      ]
    );
    this.schedulePersist();
    return updated;
  }

  // --- Snapshots ---
  async createSnapshot(snapshot: Snapshot): Promise<Snapshot> {
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO snapshots (id, workspace_id, source_id, competitor_id, requested_url, final_url, fetch_timestamp, http_status, content_hash, readable_extracted_text, original_content, published_date, parser_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshot.id,
        snapshot.workspaceId,
        snapshot.sourceId,
        snapshot.competitorId,
        snapshot.requestedUrl,
        snapshot.finalUrl,
        snapshot.fetchTimestamp,
        snapshot.httpStatus,
        snapshot.contentHash,
        snapshot.readableExtractedText,
        snapshot.originalContent,
        snapshot.publishedDate,
        snapshot.parserVersion,
      ]
    );
    this.schedulePersist();
    return snapshot;
  }

  async getLatestSnapshot(sourceId: string): Promise<Snapshot | null> {
    if (!this.db) return null;
    const res = this.db.exec(
      `SELECT * FROM snapshots WHERE source_id = '${sourceId.replace(/'/g, "''")}' ORDER BY fetch_timestamp DESC LIMIT 1`
    );
    if (res.length === 0 || !res[0].values || res[0].values.length === 0) return null;
    const cols = res[0].columns;
    const v = res[0].values[0];
    const row: Record<string, any> = {};
    cols.forEach((col, i) => (row[col] = v[i]));
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id,
      competitorId: row.competitor_id,
      requestedUrl: row.requested_url,
      finalUrl: row.final_url,
      fetchTimestamp: row.fetch_timestamp,
      httpStatus: row.http_status,
      contentHash: row.content_hash,
      readableExtractedText: row.readable_extracted_text || '',
      originalContent: row.original_content || '',
      publishedDate: row.published_date || null,
      parserVersion: row.parser_version,
    };
  }

  // --- Evidence ---
  async createEvidence(ev: Evidence): Promise<Evidence> {
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO evidence (id, workspace_id, competitor_id, source_id, snapshot_id, source_url, source_title, passage_text, observed_at, published_date, provenance, is_disputed, dispute_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ev.id,
        ev.workspaceId,
        ev.competitorId,
        ev.sourceId,
        ev.snapshotId,
        ev.sourceUrl,
        ev.sourceTitle,
        ev.passageText,
        ev.observedAt,
        ev.publishedDate,
        ev.provenance,
        ev.isDisputed ? 1 : 0,
        ev.disputeReason || null,
        ev.createdAt,
      ]
    );
    this.schedulePersist();
    return ev;
  }

  async getEvidence(workspaceId: string, id: string): Promise<Evidence | null> {
    const list = await this.getEvidencesByIds(workspaceId, [id]);
    return list[0] || null;
  }

  async getEvidencesByIds(workspaceId: string, ids: string[]): Promise<Evidence[]> {
    if (!this.db || ids.length === 0) return [];
    const escaped = ids.map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
    const res = this.db.exec(
      `SELECT * FROM evidence WHERE workspace_id = '${workspaceId.replace(/'/g, "''")}' AND id IN (${escaped})`
    );
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        competitorId: row.competitor_id,
        sourceId: row.source_id,
        snapshotId: row.snapshot_id,
        sourceUrl: row.source_url,
        sourceTitle: row.source_title,
        passageText: row.passage_text,
        observedAt: row.observed_at,
        publishedDate: row.published_date,
        provenance: row.provenance,
        isDisputed: Boolean(row.is_disputed),
        disputeReason: row.dispute_reason,
        createdAt: row.created_at,
      };
    });
  }

  async markEvidenceDisputed(workspaceId: string, id: string, reason: string): Promise<void> {
    this.db?.run(
      `UPDATE evidence SET is_disputed = 1, dispute_reason = ? WHERE id = ? AND workspace_id = ?`,
      [reason, id, workspaceId]
    );
    this.schedulePersist();
  }

  // --- Events ---
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
    if (!this.db) throw new Error('DB not initialized');
    let q = `
      SELECT e.*, c.name as competitor_name 
      FROM events e 
      JOIN competitors c ON e.competitor_id = c.id
      WHERE e.workspace_id = '${workspaceId.replace(/'/g, "''")}'
    `;
    if (filters?.competitorId) {
      q += ` AND e.competitor_id = '${filters.competitorId.replace(/'/g, "''")}'`;
    }
    if (filters?.eventType) {
      q += ` AND e.event_type = '${filters.eventType.replace(/'/g, "''")}'`;
    }
    if (filters?.startDate) {
      q += ` AND COALESCE(e.published_date, e.first_observed_at) >= '${filters.startDate.replace(/'/g, "''")}'`;
    }
    if (filters?.endDate) {
      q += ` AND COALESCE(e.published_date, e.first_observed_at) <= '${filters.endDate.replace(/'/g, "''")}'`;
    }
    if (!filters?.includeInvalidated) {
      q += ` AND e.verification_status != 'invalidated'`;
    }
    q += ` ORDER BY COALESCE(e.published_date, e.first_observed_at) DESC, e.created_at DESC`;

    const res = this.db.exec(q);
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;

    // Fetch evidence associations
    const evLinksRes = this.db.exec(`SELECT event_id, evidence_id FROM event_evidence`);
    const linkMap = new Map<string, string[]>();
    if (evLinksRes.length > 0 && evLinksRes[0].values) {
      for (const row of evLinksRes[0].values) {
        const evId = row[0] as string;
        const eId = row[1] as string;
        if (!linkMap.has(evId)) linkMap.set(evId, []);
        linkMap.get(evId)!.push(eId);
      }
    }

    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      const eventId = row.id as string;
      return {
        id: eventId,
        workspaceId: row.workspace_id,
        competitorId: row.competitor_id,
        competitorName: row.competitor_name,
        eventType: row.event_type,
        title: row.title,
        description: row.description,
        publishedDate: row.published_date || null,
        firstObservedAt: row.first_observed_at,
        effectiveDate: row.effective_date || null,
        beforeValue: row.before_value ? JSON.parse(row.before_value) : null,
        afterValue: row.after_value ? JSON.parse(row.after_value) : null,
        evidenceIds: linkMap.get(eventId) || [],
        verificationStatus: row.verification_status,
        provenance: row.provenance,
        isSuperseded: Boolean(row.is_superseded),
        supersededByEventId: row.superseded_by_event_id || null,
        invalidationReason: row.invalidation_reason || null,
        createdAt: row.created_at,
      };
    });
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
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO events (id, workspace_id, competitor_id, event_type, title, description, published_date, first_observed_at, effective_date, before_value, after_value, verification_status, provenance, is_superseded, superseded_by_event_id, invalidation_reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        event.isSuperseded ? 1 : 0,
        event.supersededByEventId || null,
        event.invalidationReason || null,
        event.createdAt,
      ]
    );

    if (event.evidenceIds && event.evidenceIds.length > 0) {
      for (const evId of event.evidenceIds) {
        await this.linkEventEvidence(event.id, evId);
      }
    }

    this.schedulePersist();
    return event;
  }

  async linkEventEvidence(eventId: string, evidenceId: string): Promise<void> {
    this.db?.run(
      `INSERT OR IGNORE INTO event_evidence (event_id, evidence_id) VALUES (?, ?)`,
      [eventId, evidenceId]
    );
    this.schedulePersist();
  }

  async supersedeEvent(workspaceId: string, eventId: string, newEventId: string | null, reason: string): Promise<void> {
    this.db?.run(
      `UPDATE events SET is_superseded = 1, superseded_by_event_id = ?, invalidation_reason = ?, verification_status = 'disputed'
       WHERE id = ? AND workspace_id = ?`,
      [newEventId, reason, eventId, workspaceId]
    );
    this.schedulePersist();
  }

  async invalidateEvent(workspaceId: string, eventId: string, reason: string): Promise<void> {
    this.db?.run(
      `UPDATE events SET verification_status = 'invalidated', invalidation_reason = ?
       WHERE id = ? AND workspace_id = ?`,
      [reason, eventId, workspaceId]
    );
    this.schedulePersist();
  }

  // --- Insights ---
  async listInsights(workspaceId: string, competitorId?: string): Promise<StrategicInsight[]> {
    if (!this.db) return [];
    let q = `
      SELECT i.*, c.name as competitor_name
      FROM insights i
      LEFT JOIN competitors c ON i.competitor_id = c.id
      WHERE i.workspace_id = '${workspaceId.replace(/'/g, "''")}'
    `;
    if (competitorId) {
      q += ` AND i.competitor_id = '${competitorId.replace(/'/g, "''")}'`;
    }
    q += ` ORDER BY i.created_at DESC`;
    const res = this.db.exec(q);
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;

    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        competitorId: row.competitor_id || null,
        competitorName: row.competitor_name || 'All Competitors',
        title: row.title,
        summary: row.summary,
        observedChanges: JSON.parse(row.observed_changes || '[]'),
        historicalPattern: row.historical_pattern,
        businessSignificance: row.business_significance,
        risks: JSON.parse(row.risks || '[]'),
        opportunities: JSON.parse(row.opportunities || '[]'),
        recommendedActions: JSON.parse(row.recommended_actions || '[]'),
        alternativeExplanations: JSON.parse(row.alternative_explanations || '[]'),
        uncertainty: row.uncertainty,
        evidenceIds: JSON.parse(row.evidence_ids || '[]'),
        supportingEventIds: JSON.parse(row.supporting_event_ids || '[]'),
        coverageStart: row.coverage_start,
        coverageEnd: row.coverage_end,
        isStale: Boolean(row.is_stale),
        createdAt: row.created_at,
      };
    });
  }

  async getInsight(workspaceId: string, id: string): Promise<StrategicInsight | null> {
    const list = await this.listInsights(workspaceId);
    return list.find((i) => i.id === id) || null;
  }

  async createInsight(insight: StrategicInsight): Promise<StrategicInsight> {
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO insights (id, workspace_id, competitor_id, title, summary, observed_changes, historical_pattern, business_significance, risks, opportunities, recommended_actions, alternative_explanations, uncertainty, evidence_ids, supporting_event_ids, coverage_start, coverage_end, is_stale, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        insight.isStale ? 1 : 0,
        insight.createdAt,
      ]
    );
    this.schedulePersist();
    return insight;
  }

  async markInsightsStaleForCompetitor(workspaceId: string, competitorId: string): Promise<void> {
    this.db?.run(
      `UPDATE insights SET is_stale = 1 WHERE workspace_id = ? AND (competitor_id = ? OR competitor_id IS NULL)`,
      [workspaceId, competitorId]
    );
    this.schedulePersist();
  }

  // --- Alerts ---
  async listAlerts(
    workspaceId: string,
    filters?: { priority?: string; unreadOnly?: boolean }
  ): Promise<IntelligenceAlert[]> {
    if (!this.db) return [];
    let q = `
      SELECT a.*, c.name as competitor_name, e.event_type
      FROM alerts a
      JOIN competitors c ON a.competitor_id = c.id
      JOIN events e ON a.event_id = e.id
      WHERE a.workspace_id = '${workspaceId.replace(/'/g, "''")}'
    `;
    if (filters?.priority) {
      q += ` AND a.priority = '${filters.priority.replace(/'/g, "''")}'`;
    }
    if (filters?.unreadOnly) {
      q += ` AND a.is_read = 0`;
    }
    q += ` AND a.is_dismissed = 0`;
    q += ` ORDER BY a.created_at DESC`;

    const res = this.db.exec(q);
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;

    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        competitorId: row.competitor_id,
        competitorName: row.competitor_name,
        eventType: row.event_type,
        eventId: row.event_id,
        insightId: row.insight_id || null,
        title: row.title,
        message: row.message,
        priority: row.priority,
        isRead: Boolean(row.is_read),
        isDismissed: Boolean(row.is_dismissed),
        feedback: row.feedback || null,
        feedbackNote: row.feedback_note || null,
        createdAt: row.created_at,
      };
    });
  }

  async getAlert(workspaceId: string, id: string): Promise<IntelligenceAlert | null> {
    const alerts = await this.listAlerts(workspaceId);
    return alerts.find((a) => a.id === id) || null;
  }

  async createAlert(alert: IntelligenceAlert): Promise<IntelligenceAlert> {
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO alerts (id, workspace_id, competitor_id, event_id, insight_id, title, message, priority, is_read, is_dismissed, feedback, feedback_note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.workspaceId,
        alert.competitorId,
        alert.eventId,
        alert.insightId,
        alert.title,
        alert.message,
        alert.priority,
        alert.isRead ? 1 : 0,
        alert.isDismissed ? 1 : 0,
        alert.feedback,
        alert.feedbackNote,
        alert.createdAt,
      ]
    );
    this.schedulePersist();
    return alert;
  }

  async updateAlert(workspaceId: string, id: string, updates: Partial<IntelligenceAlert>): Promise<IntelligenceAlert> {
    const alert = await this.getAlert(workspaceId, id);
    if (!alert) throw new Error(`Alert not found: ${id}`);
    const updated = { ...alert, ...updates };
    this.db?.run(
      `UPDATE alerts SET is_read = ?, is_dismissed = ?, feedback = ?, feedback_note = ?
       WHERE id = ? AND workspace_id = ?`,
      [
        updated.isRead ? 1 : 0,
        updated.isDismissed ? 1 : 0,
        updated.feedback,
        updated.feedbackNote,
        id,
        workspaceId,
      ]
    );
    this.schedulePersist();
    return updated;
  }

  // --- Memory Outbox ---
  async queueMemoryOutbox(
    item: Omit<MemoryOutboxItem, 'id' | 'createdAt' | 'retryCount' | 'status' | 'processedAt' | 'lastError'>
  ): Promise<MemoryOutboxItem> {
    if (!this.db) throw new Error('DB not initialized');
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

    this.db.run(
      `INSERT INTO memory_outbox (id, workspace_id, event_type, entity_id, payload, status, retry_count, last_error, created_at, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    this.schedulePersist();
    return fullItem;
  }

  async getPendingOutboxItems(limit = 100): Promise<MemoryOutboxItem[]> {
    if (!this.db) return [];
    const res = this.db.exec(
      `SELECT * FROM memory_outbox WHERE status IN ('pending', 'failed') AND retry_count < 5 ORDER BY created_at DESC LIMIT ${limit}`
    );
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        workspaceId: row.workspace_id,
        eventType: row.event_type,
        entityId: row.entity_id,
        payload: JSON.parse(row.payload),
        status: row.status,
        retryCount: row.retry_count,
        lastError: row.last_error,
        createdAt: row.created_at,
        processedAt: row.processed_at,
      };
    });
  }

  async getOutboxStats(workspaceId?: string): Promise<{
    pendingCount: number;
    confirmedCount: number;
    failedCount: number;
    lastStatus: string | null;
  }> {
    if (!this.db) {
      return { pendingCount: 0, confirmedCount: 0, failedCount: 0, lastStatus: 'idle' };
    }
    const filter = workspaceId ? `WHERE workspace_id = '${workspaceId.replace(/'/g, "''")}'` : '';
    const res = this.db.exec(`SELECT status FROM memory_outbox ${filter} ORDER BY created_at DESC`);
    let pendingCount = 0;
    let confirmedCount = 0;
    let failedCount = 0;
    let lastStatus: string | null = null;
    if (res.length > 0 && res[0].values) {
      res[0].values.forEach((v, idx) => {
        const s = v[0] as string;
        if (idx === 0) lastStatus = s;
        if (s === 'pending') pendingCount++;
        else if (s === 'confirmed') confirmedCount++;
        else if (s === 'failed') failedCount++;
      });
    }
    return {
      pendingCount,
      confirmedCount,
      failedCount,
      lastStatus: lastStatus || 'idle',
    };
  }

  async updateOutboxStatus(
    id: string,
    status: 'pending' | 'processing' | 'confirmed' | 'failed',
    error?: string | null
  ): Promise<void> {
    const now = new Date().toISOString();
    this.db?.run(
      `UPDATE memory_outbox SET status = ?, last_error = ?, processed_at = ?, retry_count = retry_count + 1 WHERE id = ?`,
      [status, error || null, now, id]
    );
    this.schedulePersist();
  }

  async listMemoryItems(workspaceId: string): Promise<MemoryItemView[]> {
    if (!this.db) return [];
    const res = this.db.exec(
      `SELECT * FROM memory_items_view WHERE workspace_id = '${workspaceId.replace(/'/g, "''")}' ORDER BY ingested_at DESC`
    );
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => {
      const row: Record<string, any> = {};
      cols.forEach((col, i) => (row[col] = v[i]));
      return {
        id: row.id,
        documentId: row.document_id,
        bankId: row.bank_id,
        competitor: row.competitor,
        category: row.category,
        recordType: row.record_type,
        contentSnippet: row.content_snippet,
        evidenceIds: JSON.parse(row.evidence_ids || '[]'),
        canonicalEventId: row.canonical_event_id,
        status: row.status,
        ingestedAt: row.ingested_at,
      };
    });
  }

  async saveMemoryItemView(item: MemoryItemView): Promise<void> {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO memory_items_view (id, document_id, bank_id, workspace_id, competitor, category, record_type, content_snippet, evidence_ids, canonical_event_id, status, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    this.schedulePersist();
  }

  // --- Feedback ---
  async recordFeedback(data: {
    workspaceId: string;
    targetType: 'alert' | 'insight' | 'event';
    targetId: string;
    feedbackType: 'useful' | 'not_relevant' | 'incorrect';
    notes?: string;
    proposedCorrection?: string;
  }): Promise<void> {
    if (!this.db) return;
    const id = 'fb-' + Math.random().toString(36).substring(2, 11);
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO feedback_records (id, workspace_id, target_type, target_id, feedback_type, notes, proposed_correction, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.workspaceId,
        data.targetType,
        data.targetId,
        data.feedbackType,
        data.notes || null,
        data.proposedCorrection || null,
        now,
      ]
    );
    this.schedulePersist();
  }

  // --- Scan Jobs ---
  async createScanJob(job: ScanJobRecord): Promise<ScanJobRecord> {
    if (!this.db) throw new Error('DB not initialized');
    this.db.run(
      `INSERT INTO scan_jobs (id, workspace_id, source_id, competitor_id, status, total_sources, processed_sources, new_events_found, error_message, started_at, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.workspaceId,
        job.sourceId || null,
        job.competitorId || null,
        job.status,
        job.totalSources,
        job.processedSources,
        job.newEventsFound,
        job.errorMessage || null,
        job.startedAt || null,
        job.completedAt || null,
        job.createdAt,
      ]
    );
    this.schedulePersist();
    return job;
  }

  async getScanJob(id: string): Promise<ScanJobRecord | null> {
    if (!this.db) return null;
    const res = this.db.exec(`SELECT * FROM scan_jobs WHERE id = '${id.replace(/'/g, "''")}'`);
    if (res.length === 0 || !res[0].values || res[0].values.length === 0) return null;
    const cols = res[0].columns;
    const v = res[0].values[0];
    const row: Record<string, any> = {};
    cols.forEach((col, i) => (row[col] = v[i]));
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      sourceId: row.source_id || undefined,
      competitorId: row.competitor_id || undefined,
      status: row.status,
      totalSources: row.total_sources,
      processedSources: row.processed_sources,
      newEventsFound: row.new_events_found,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    };
  }

  async updateScanJob(id: string, updates: Partial<ScanJobRecord>): Promise<ScanJobRecord> {
    const job = await this.getScanJob(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    const updated = { ...job, ...updates };
    this.db?.run(
      `UPDATE scan_jobs SET status = ?, processed_sources = ?, new_events_found = ?, error_message = ?, started_at = ?, completed_at = ?
       WHERE id = ?`,
      [
        updated.status,
        updated.processedSources,
        updated.newEventsFound,
        updated.errorMessage || null,
        updated.startedAt || null,
        updated.completedAt || null,
        id,
      ]
    );
    this.schedulePersist();
    return updated;
  }

  // --- Reset ---
  async resetWorkspaceData(workspaceId: string): Promise<void> {
    if (!this.db) return;
    const wid = workspaceId.replace(/'/g, "''");
    this.db.run(`DELETE FROM alerts WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM insights WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM event_evidence WHERE event_id IN (SELECT id FROM events WHERE workspace_id = '${wid}')`);
    this.db.run(`DELETE FROM events WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM evidence WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM snapshots WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM sources WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM competitors WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM memory_outbox WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM memory_items_view WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM feedback_records WHERE workspace_id = '${wid}'`);
    this.db.run(`DELETE FROM scan_jobs WHERE workspace_id = '${wid}'`);
    this.schedulePersist();
  }
}
