import type { IntelligenceEvent, Evidence } from '../../types/intelligence.ts';

export interface RetainPayload {
  documentId: string;
  recordType: 'verified_observation' | 'analyst_hypothesis' | 'user_preference' | 'accepted_correction';
  competitor: string;
  category: string;
  title: string;
  summary: string;
  evidencePassages: string[];
  date: string;
  dateType: 'published' | 'first_observed' | 'effective';
  canonicalEventId: string;
  metadata: Record<string, any>;
}

export interface RecallResult {
  memoryId: string;
  documentId: string;
  type: string;
  competitor: string;
  category: string;
  date: string;
  summary: string;
  evidenceSnippet: string;
  canonicalEventId?: string;
  score?: number;
}

export interface ReflectResult {
  synthesis: string;
  groundedFacts: string[];
  memoryIdsUsed: string[];
}

export class HindsightAdapter {
  private baseUrl: string;
  private apiKey: string | null;
  private ensuredBanks = new Set<string>();

  constructor() {
    this.baseUrl = (process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io').replace(/\/$/, '');
    this.apiKey = process.env.HINDSIGHT_API_API_KEY || process.env.HINDSIGHT_API_KEY || null;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getBankId(workspaceId: string, isDemo = false): string {
    const cleanId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return isDemo ? `bank_demo_${cleanId}` : `bank_live_${cleanId}`;
  }

  async ensureBank(bankId: string): Promise<boolean> {
    if (!this.isConfigured() || this.ensuredBanks.has(bankId)) return true;
    try {
      const url = `${this.baseUrl}/v1/default/banks/${bankId}`;
      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `CompetitorLens Bank ${bankId}`,
          description: 'Autonomous competitive intelligence memory bank',
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        this.ensuredBanks.add(bankId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async testConnection(bankId?: string): Promise<{
    connected: boolean;
    baseUrl: string;
    bankId?: string;
    error?: string;
    details?: any;
  }> {
    if (!this.isConfigured()) {
      return {
        connected: false,
        baseUrl: this.baseUrl,
        error: 'Missing HINDSIGHT_API_KEY environment variable on server.',
      };
    }

    try {
      // 1. Health check
      const healthUrl = `${this.baseUrl}/health`;
      const healthResp = await fetch(healthUrl, {
        signal: AbortSignal.timeout(6000),
      });
      const healthData = await healthResp.json().catch(() => ({ status: 'healthy' }));

      // 2. Ensure bank
      if (bankId) {
        await this.ensureBank(bankId);
      }

      // 3. Verify authenticated banks endpoint
      const banksUrl = `${this.baseUrl}/v1/default/banks`;
      const banksResp = await fetch(banksUrl, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (!banksResp.ok) {
        return {
          connected: false,
          baseUrl: this.baseUrl,
          error: `Hindsight responded with HTTP ${banksResp.status}: ${await banksResp.text()}`,
        };
      }

      return {
        connected: true,
        baseUrl: this.baseUrl,
        bankId,
        details: healthData,
      };
    } catch (err: any) {
      return {
        connected: false,
        baseUrl: this.baseUrl,
        error: `Connection to Hindsight failed: ${err.message}`,
      };
    }
  }

  async retainEvent(
    bankId: string,
    event: IntelligenceEvent,
    evidences: Evidence[],
    recordType: 'verified_observation' | 'accepted_correction' = 'verified_observation'
  ): Promise<{ success: boolean; documentId: string; status: 'confirmed' | 'queued'; operationId?: string | null; error?: string }> {
    const documentId = `event:${event.id}`;
    const evidencePassages = evidences.map((e) => `[Source: ${e.sourceTitle} | ${e.sourceUrl}] ${e.passageText}`);

    const payload: RetainPayload = {
      documentId,
      recordType,
      competitor: event.competitorName || event.competitorId,
      category: event.eventType,
      title: event.title,
      summary: event.description,
      evidencePassages,
      date: event.publishedDate || event.firstObservedAt,
      dateType: event.publishedDate ? 'published' : 'first_observed',
      canonicalEventId: event.id,
      metadata: {
        workspaceId: event.workspaceId,
        beforeValue: event.beforeValue,
        afterValue: event.afterValue,
        verificationStatus: event.verificationStatus,
        provenance: event.provenance,
        tags: [
          `competitor:${event.competitorName || event.competitorId}`,
          `type:${event.eventType}`,
          `record:${recordType}`,
        ],
      },
    };

    if (!this.isConfigured()) {
      return {
        success: false,
        documentId,
        status: 'queued',
        error: 'Hindsight API key not configured; retained in local memory outbox.',
      };
    }

    try {
      await this.ensureBank(bankId);
      const url = `${this.baseUrl}/v1/default/banks/${bankId}/memories`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          async: true,
          items: [
            {
              content: `${event.title}. ${event.description}${evidencePassages.length > 0 ? `\n\nSupporting Evidence:\n${evidencePassages.join('\n')}` : ''}`,
              context: `competitor:${event.competitorName || event.competitorId} category:${event.eventType} record:${recordType}`,
              document_id: documentId,
              timestamp: event.publishedDate ? `${event.publishedDate}T00:00:00Z` : undefined,
            },
          ],
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        return {
          success: false,
          documentId,
          status: 'queued',
          error: `Hindsight retain HTTP ${resp.status}: ${errorText}`,
        };
      }

      const data = await resp.json().catch(() => null);

      return {
        success: true,
        documentId,
        status: 'confirmed',
        operationId: data?.operation_id || null,
      };
    } catch (err: any) {
      return {
        success: false,
        documentId,
        status: 'queued',
        error: `Hindsight retain network error: ${err.message}`,
      };
    }
  }

  async retainFeedback(
    bankId: string,
    preference: { id: string; instruction: string; user: string; createdAt: string }
  ): Promise<{ success: boolean; documentId: string }> {
    const documentId = `pref:${preference.id}`;
    if (!this.isConfigured()) {
      return { success: false, documentId };
    }

    try {
      await this.ensureBank(bankId);
      const url = `${this.baseUrl}/v1/default/banks/${bankId}/memories`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          async: false,
          items: [
            {
              content: `User Preference: ${preference.instruction}`,
              context: 'type:user_preference',
              document_id: documentId,
            },
          ],
        }),
        signal: AbortSignal.timeout(8000),
      });
      return { success: true, documentId };
    } catch {
      return { success: false, documentId };
    }
  }

  async recallHistory(
    bankId: string,
    query: string,
    options?: {
      competitor?: string;
      category?: string;
      limit?: number;
      historicalCutoffDate?: string;
    }
  ): Promise<{ results: RecallResult[]; source: 'hindsight' | 'unconfigured' }> {
    if (!this.isConfigured()) {
      return { results: [], source: 'unconfigured' };
    }

    try {
      await this.ensureBank(bankId);
      const url = `${this.baseUrl}/v1/default/banks/${bankId}/memories/recall`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          budget: 'mid',
          max_tokens: 4096,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (!resp.ok) {
        console.warn(`Hindsight recall returned HTTP ${resp.status}`);
        return { results: [], source: 'hindsight' };
      }

      const json = await resp.json();
      const memories = json.results || json.memories || json.data || [];
      const formatted: RecallResult[] = memories.map((m: any) => {
        const meta = m.metadata || {};
        return {
          memoryId: m.id || m.document_id || 'mem-' + Math.random().toString(36).substring(2, 7),
          documentId: m.document_id || m.id,
          type: meta.recordType || m.type || 'verified_observation',
          competitor: meta.competitor || 'Unknown Competitor',
          category: meta.category || 'general',
          date: meta.date || (m.occurred_start ? m.occurred_start.slice(0, 10) : new Date().toISOString().slice(0, 10)),
          summary: m.text || m.content || meta.summary || '',
          evidenceSnippet: (meta.evidencePassages && meta.evidencePassages[0]) || m.text || m.content || '',
          canonicalEventId: meta.canonicalEventId,
          score: m.scores?.final ?? m.score,
        };
      });

      // Filter out any future events if a strict historical cutoff is requested
      const filtered = options?.historicalCutoffDate
        ? formatted.filter((r) => r.date <= options.historicalCutoffDate!)
        : formatted;

      return { results: filtered, source: 'hindsight' };
    } catch (err: any) {
      console.warn(`Error during Hindsight recall: ${err.message}`);
      return { results: [], source: 'hindsight' };
    }
  }

  async reflectOnHistory(
    bankId: string,
    prompt: string,
    tags?: string[]
  ): Promise<{ result: ReflectResult | null; error?: string }> {
    if (!this.isConfigured()) {
      return { result: null, error: 'Hindsight not configured' };
    }

    try {
      await this.ensureBank(bankId);
      const url = `${this.baseUrl}/v1/default/banks/${bankId}/reflect`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: prompt,
        }),
        signal: AbortSignal.timeout(18000),
      });

      if (!resp.ok) {
        return { result: null, error: `Hindsight reflect HTTP ${resp.status}` };
      }

      const data = await resp.json();
      return {
        result: {
          synthesis: data.text || data.synthesis || data.result || '',
          groundedFacts: data.grounded_facts || data.facts || [],
          memoryIdsUsed: data.memory_ids || data.source_ids || [],
        },
      };
    } catch (err: any) {
      return { result: null, error: err.message };
    }
  }

  async checkIngestion(bankId: string, identifier: string): Promise<'confirmed' | 'pending' | 'failed'> {
    if (!this.isConfigured()) return 'pending';
    try {
      await this.ensureBank(bankId);
      if (identifier.includes('-') && identifier.length >= 30) {
        const url = `${this.baseUrl}/v1/default/banks/${bankId}/operations/${encodeURIComponent(identifier)}`;
        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'x-api-key': this.apiKey!,
          },
          signal: AbortSignal.timeout(5000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 'completed') return 'confirmed';
          if (data.status === 'failed') return 'failed';
          return 'pending';
        }
      }
      return 'confirmed';
    } catch {
      return 'pending';
    }
  }
}

export const hindsightAdapter = new HindsightAdapter();
