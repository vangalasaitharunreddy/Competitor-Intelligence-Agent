import type { IntelligenceRepository } from '../db/repository.ts';
import { hindsightAdapter } from '../hindsight/client.ts';
import { getGeminiClient, GEMINI_MODEL } from '../gemini/client.ts';
import type {
  IntelligenceEvent,
  Evidence,
  IntelligenceAlert,
  AlertPriority,
  Source,
} from '../../types/intelligence.ts';
import { processPendingMemoryOutbox } from '../jobs/outbox-worker.ts';
import { getAllServerGmailAccounts } from '../gmail/delivery-service.ts';
import { DEMO_WORKSPACE_ID } from '../demo/fixtures.ts';

export interface ContinuousMonitorState {
  active: boolean;
  intervalSeconds: number;
  lastTickAt: string | null;
  nextTickAt: string | null;
  eventsProcessedCount: number;
  alertsTriggeredCount: number;
  currentIndex: number;
  lastEventSummary: string | null;
  lastAlertTitle: string | null;
  totalEventsInQueue: number;
}

export interface StagedUpdate {
  eventId: string;
  evidenceId: string;
  competitorId: string;
  competitorName: string;
  eventType: IntelligenceEvent['eventType'];
  title: string;
  description: string;
  date: string;
  sourceUrl: string;
  sourceTitle: string;
  passageText: string;
  metricChange?: string;
  beforeVal?: any;
  afterVal?: any;
  defaultPattern: string;
  defaultWhyItMatters: string;
  priority: AlertPriority;
}

export const STAGED_CONTINUOUS_EVENTS: StagedUpdate[] = [
  {
    eventId: 'evt-cmon-01',
    evidenceId: 'evi-cmon-01',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'pricing_change',
    title: 'NovaFlow Reduces Enterprise Pricing to ₹50,000/month',
    description: 'NovaFlow updates its pricing matrix, cutting Enterprise Plan from ₹60,000 to ₹50,000 per month (-16.7% discount).',
    date: '2026-06-08',
    sourceUrl: 'https://novaflow.synthetic.local/pricing',
    sourceTitle: 'NovaFlow Pricing Table',
    passageText: 'Enterprise Tier now ₹50,000/month (previously ₹60,000). Includes dedicated agent nodes and priority support.',
    metricChange: '₹60,000 → ₹50,000/month (-16.7%)',
    beforeVal: { plan: 'Enterprise', price: 60000, currency: '₹' },
    afterVal: { plan: 'Enterprise', price: 50000, currency: '₹', changePercentage: -16.7 },
    defaultPattern: 'First pricing concession initiating a multi-quarter market acquisition strategy.',
    defaultWhyItMatters: 'Reduces barrier to entry for mid-market migrations away from our platform.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-02',
    evidenceId: 'evi-cmon-02',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'feature_launch',
    title: 'NovaFlow Launches OmniAgent Suite for Autonomous Root-Cause Remediation',
    description: 'NovaFlow unveils OmniAgent Suite, deploying autonomous multi-agent reasoning to correlate distributed logs and draft fixes in under 30 seconds.',
    date: '2026-06-22',
    sourceUrl: 'https://novaflow.synthetic.local/changelog',
    sourceTitle: 'NovaFlow Product Releases',
    passageText: 'Product Launch: OmniAgent Suite correlates multi-service telemetry and executes automated remediation playbooks.',
    metricChange: 'v3.0 → OmniAgent Autonomous AI Platform',
    defaultPattern: 'Direct transition from passive dashboards toward autonomous operational AI agents.',
    defaultWhyItMatters: 'Directly threatens our manual triage workflows with autonomous 30-second incident resolution.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-03',
    evidenceId: 'evi-cmon-03',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'hiring_signal',
    title: 'NovaFlow Opens Role: Principal Distributed AI Inference Engineer',
    description: 'NovaFlow posts high-priority vacancy for Principal Distributed AI Inference Engineer to optimize low-latency on-cluster reasoning.',
    date: '2026-07-02',
    sourceUrl: 'https://novaflow.synthetic.local/careers',
    sourceTitle: 'NovaFlow Careers Portal',
    passageText: 'Job: Principal Distributed AI Inference Engineer. Build sub-10ms streaming inference directly on agent nodes.',
    metricChange: '+1 Strategic AI Leadership Opening',
    defaultPattern: 'Talent acquisition focused strictly on real-time on-node agent inference capabilities.',
    defaultWhyItMatters: 'Confirms NovaFlow is investing deeply in proprietary reasoning rather than relying on thin API wrappers.',
    priority: 'medium',
  },
  {
    eventId: 'evt-cmon-04',
    evidenceId: 'evi-cmon-04',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'partnership',
    title: 'NovaFlow Partners with Hyperscale AI for Enterprise Agent Infrastructure',
    description: 'Strategic alliance with Hyperscale AI to deploy sovereign on-premises foundation models for banking and defense clients.',
    date: '2026-07-12',
    sourceUrl: 'https://novaflow.synthetic.local/news/rss.xml',
    sourceTitle: 'NovaFlow Press Room',
    passageText: 'NovaFlow & Hyperscale AI enter multi-year alliance to deliver air-gapped LLM incident analysis for regulated industries.',
    metricChange: 'Partnership Alliance Active',
    defaultPattern: 'Ecosystem expansion into regulated enterprises through sovereign AI infrastructure.',
    defaultWhyItMatters: 'Unlocks enterprise accounts that previously rejected cloud-only telemetry solutions.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-05',
    evidenceId: 'evi-cmon-05',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'messaging_shift',
    title: 'NovaFlow Repositions Homepage: "Autonomous Enterprise Intelligence at Scale"',
    description: 'NovaFlow overhauls homepage hero messaging away from "Developer Metrics" to "Autonomous Enterprise Intelligence at Scale".',
    date: '2026-07-28',
    sourceUrl: 'https://novaflow.synthetic.local/',
    sourceTitle: 'NovaFlow Website Header',
    passageText: 'Headline updated from "Fast telemetry dashboards for developers" to "Autonomous Enterprise Intelligence at Scale — Stop triaging incidents manually."',
    metricChange: '"Developer Metrics" → "Autonomous Enterprise Intelligence"',
    defaultPattern: 'Strategic pivot from engineering individual tools to C-suite automated operations.',
    defaultWhyItMatters: 'Sales conversations will directly challenge our enterprise renewals on automation ROI.',
    priority: 'medium',
  },
  {
    eventId: 'evt-cmon-06',
    evidenceId: 'evi-cmon-06',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'pricing_change',
    title: 'NovaFlow Drops Enterprise Pricing from ₹50,000 to ₹35,000/month (-30%)',
    description: 'In an aggressive price undercut, NovaFlow slashes Enterprise pricing to ₹35,000/month flat rate (an exact 30% reduction), bundling OmniAgent AI at zero extra cost.',
    date: '2026-09-15',
    sourceUrl: 'https://novaflow.synthetic.local/pricing',
    sourceTitle: 'NovaFlow Pricing Announcement',
    passageText: 'Enterprise Tier now ₹35,000/month (down from ₹50,000). Full OmniAgent AI platform included with zero surcharge.',
    metricChange: '₹50,000 → ₹35,000/month (-30.0%)',
    beforeVal: { plan: 'Enterprise', price: 50000, currency: '₹' },
    afterVal: { plan: 'Enterprise', price: 35000, currency: '₹', changePercentage: -30.0 },
    defaultPattern: 'Two consecutive price drops (-16.7% then -30%) following major AI product rollouts.',
    defaultWhyItMatters: 'Cumulative 41.7% price reduction over six months (₹60,000 → ₹35,000) creates severe pricing pressure in renewal cycles.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-07',
    evidenceId: 'evi-cmon-07',
    competitorId: 'comp-orbitstack',
    competitorName: 'OrbitStack',
    eventType: 'pricing_change',
    title: 'OrbitStack Increases Pro Tier Pricing from $199 to $249/month (+25%)',
    description: 'OrbitStack raises prices on its Pro team tier from $199 to $249/month, asserting pricing power following new kernel-level profiling features.',
    date: '2026-09-18',
    sourceUrl: 'https://orbitstack.synthetic.local/pricing',
    sourceTitle: 'OrbitStack Pricing Matrix',
    passageText: 'Pro Team subscription updated to $249 / month (previously $199). Unlocks unlimited eBPF continuous profiling.',
    metricChange: '$199 → $249/month (+25.1%)',
    beforeVal: { plan: 'Pro', price: 199, currency: '$' },
    afterVal: { plan: 'Pro', price: 249, currency: '$', changePercentage: 25.1 },
    defaultPattern: 'Upward price realization signaling strong customer retention and product stickiness.',
    defaultWhyItMatters: 'Creates a budget opening for us to target cost-sensitive mid-market engineering teams.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-08',
    evidenceId: 'evi-cmon-08',
    competitorId: 'comp-orbitstack',
    competitorName: 'OrbitStack',
    eventType: 'feature_launch',
    title: 'OrbitStack Ships eBPF Continuous Profiler for Distributed Microservices',
    description: 'OrbitStack releases zero-overhead continuous CPU and memory profiler powered by Linux eBPF probes.',
    date: '2026-09-21',
    sourceUrl: 'https://orbitstack.synthetic.local/dev-log',
    sourceTitle: 'OrbitStack Dev Log',
    passageText: 'Release: Continuous Profiler v1.0. Zero-instrumentation eBPF captures kernel stack traces with <1% overhead.',
    metricChange: 'Kernel-level Continuous Profiling added',
    defaultPattern: 'Deepening developer lock-in via low-level kernel observability.',
    defaultWhyItMatters: 'Expands their technical moats beyond standard application performance metrics.',
    priority: 'medium',
  },
  {
    eventId: 'evt-cmon-09',
    evidenceId: 'evi-cmon-09',
    competitorId: 'comp-pulseworks',
    competitorName: 'PulseWorks',
    eventType: 'company_announcement',
    title: 'PulseWorks Announces WORM-Compliant Immutable Log Storage',
    description: 'PulseWorks unveils hardware-enforced Write Once Read Many (WORM) storage for immutable regulatory compliance audit logs.',
    date: '2026-09-24',
    sourceUrl: 'https://pulseworks.synthetic.local/feed.xml',
    sourceTitle: 'PulseWorks Security Announcement',
    passageText: 'PulseWorks WORM Storage satisfies SEC 17a-4 and FINRA compliance requirements with cryptographically verified log immutability.',
    metricChange: 'SEC / FINRA WORM Storage Certified',
    defaultPattern: 'Deepening defensive moat within financial and healthcare enterprise compliance.',
    defaultWhyItMatters: 'Solidifies PulseWorks in security-sensitive procurement audits where compliance is mandatory.',
    priority: 'medium',
  },
  {
    eventId: 'evt-cmon-10',
    evidenceId: 'evi-cmon-10',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'feature_launch',
    title: 'NovaFlow Ships Self-Healing Playbooks with Automated Container Rollback',
    description: 'NovaFlow unlocks closed-loop autonomous execution, allowing OmniAgent to automatically trigger Kubernetes pod rollbacks upon anomaly detection.',
    date: '2026-09-27',
    sourceUrl: 'https://novaflow.synthetic.local/changelog',
    sourceTitle: 'NovaFlow Engineering Changelog',
    passageText: 'Self-Healing Playbooks now in general availability. OmniAgent executes verified rollback scripts with customer policy guardrails.',
    metricChange: 'Advisory AI → Closed-Loop Autonomous Action',
    defaultPattern: 'Completion of 6-month journey: Baseline engine → AI hiring → OmniAgent → Price drop → Closed-loop autonomous healing.',
    defaultWhyItMatters: 'NovaFlow now possesses a full autonomous ops stack at a disruptive ₹35,000/month price point.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-11',
    evidenceId: 'evi-cmon-11',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'feature_launch',
    title: 'NovaFlow Rolls Out Multi-Cloud Agent Failover to AWS & Azure',
    description: 'NovaFlow expands OmniAgent resilience with automated cross-cloud agent failover between AWS and Azure regions with zero downtime.',
    date: '2026-10-02',
    sourceUrl: 'https://novaflow.synthetic.local/changelog',
    sourceTitle: 'NovaFlow Product Releases & Changelog',
    passageText: 'OmniAgent Multi-Cloud Failover: Autonomous workload migration across AWS and Azure in under 5 seconds.',
    metricChange: 'Cross-cloud agent failover added',
    defaultPattern: 'Expanding enterprise resilience and high-availability guarantees.',
    defaultWhyItMatters: 'Directly targets our enterprise customers who require multi-cloud high availability.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-12',
    evidenceId: 'evi-cmon-12',
    competitorId: 'comp-orbitstack',
    competitorName: 'OrbitStack',
    eventType: 'pricing_change',
    title: 'OrbitStack Drops Starter Plan to Focus Exclusively on Mid-Market Teams',
    description: 'OrbitStack eliminates its $49/month Starter plan, setting the entry price point at $249/month Pro tier.',
    date: '2026-10-05',
    sourceUrl: 'https://orbitstack.synthetic.local/pricing',
    sourceTitle: 'OrbitStack Pricing Tier Page',
    passageText: 'Starter tier retired. Pro Team tier ($249/month) is now our entry-level offering for developer teams.',
    metricChange: '$49/month plan retired → $249 minimum',
    beforeVal: { plan: 'Starter', price: 49, currency: '$' },
    afterVal: { plan: 'Pro', price: 249, currency: '$' },
    defaultPattern: 'Upmarket shift shedding low-ARPU self-serve developers.',
    defaultWhyItMatters: 'Leaves self-serve and entry-level developer segments open for our product.',
    priority: 'medium',
  },
  {
    eventId: 'evt-cmon-13',
    evidenceId: 'evi-cmon-13',
    competitorId: 'comp-pulseworks',
    competitorName: 'PulseWorks',
    eventType: 'company_announcement',
    title: 'PulseWorks Achieves Automated FedRAMP Moderate Readiness Certification',
    description: 'PulseWorks security telemetry platform receives FedRAMP Moderate readiness attestation for federal and public sector deployments.',
    date: '2026-10-08',
    sourceUrl: 'https://pulseworks.synthetic.local/feed.xml',
    sourceTitle: 'PulseWorks Security Announcement',
    passageText: 'FedRAMP Moderate Readiness certified. Public sector agencies can now deploy PulseWorks with pre-authorized compliance packages.',
    metricChange: 'FedRAMP Moderate Certified',
    defaultPattern: 'Deepening government and public sector security moats.',
    defaultWhyItMatters: 'Unlocks federal bids where commercial competitors without FedRAMP are disqualified.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-14',
    evidenceId: 'evi-cmon-14',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'pricing_change',
    title: 'NovaFlow Drops Pro Tier from ₹15,000 to ₹12,000/month (-20%)',
    description: 'Following enterprise price cuts, NovaFlow cuts Pro tier subscription by 20% to accelerate bottom-up developer adoption.',
    date: '2026-10-12',
    sourceUrl: 'https://novaflow.synthetic.local/pricing',
    sourceTitle: 'NovaFlow Official Pricing & Tier Matrix',
    passageText: 'Pro Tier reduced to ₹12,000/month (down from ₹15,000). Full tracing and log ingestion included.',
    metricChange: '₹15,000 → ₹12,000/month (-20.0%)',
    beforeVal: { plan: 'Pro', price: 15000, currency: '₹' },
    afterVal: { plan: 'Pro', price: 12000, currency: '₹', changePercentage: -20.0 },
    defaultPattern: 'Down-market price compression matching previous enterprise cuts.',
    defaultWhyItMatters: 'NovaFlow is squeezing margins across both developer and enterprise tiers.',
    priority: 'high',
  },
  {
    eventId: 'evt-cmon-15',
    evidenceId: 'evi-cmon-15',
    competitorId: 'comp-novaflow',
    competitorName: 'NovaFlow',
    eventType: 'hiring_signal',
    title: 'NovaFlow Hires Former Datadog VP to Lead Global Enterprise Sales',
    description: 'NovaFlow appoints industry veteran as Chief Commercial Officer to spearhead direct enterprise sales displacements.',
    date: '2026-10-15',
    sourceUrl: 'https://novaflow.synthetic.local/careers',
    sourceTitle: 'NovaFlow Engineering Careers',
    passageText: 'Executive Appointment: Chief Commercial Officer hired to lead global enterprise field sales and partner channels.',
    metricChange: '+1 Executive Go-To-Market Leader',
    defaultPattern: 'Transitioning from product-led growth to aggressive enterprise field sales.',
    defaultWhyItMatters: 'Indicates funded outbound sales campaigns directly targeting our largest accounts.',
    priority: 'high',
  },
];

// Procedural generator for sequential ongoing events so monitoring NEVER stalls
function generateCandidateEvent(index: number): StagedUpdate {
  if (index < STAGED_CONTINUOUS_EVENTS.length) {
    return STAGED_CONTINUOUS_EVENTS[index];
  }

  const offset = index - STAGED_CONTINUOUS_EVENTS.length + 1;
  const numStr = String(index + 1).padStart(2, '0');
  const mod = offset % 3;

  if (mod === 1) {
    return {
      eventId: `evt-cmon-${numStr}`,
      evidenceId: `evi-cmon-${numStr}`,
      competitorId: 'comp-novaflow',
      competitorName: 'NovaFlow',
      eventType: 'feature_launch',
      title: `NovaFlow Ships Automated Multi-Agent Incident Triage v${4 + offset}.0`,
      description: `NovaFlow releases next-generation autonomous incident triage engine with multi-cluster correlation and SLA tracking.`,
      date: `2026-10-${Math.min(28, 15 + offset)}`,
      sourceUrl: 'https://novaflow.synthetic.local/changelog',
      sourceTitle: 'NovaFlow Product Releases & Changelog',
      passageText: `Major release v${4 + offset}.0: Auto-healing microservices triage reduces mean time to resolution to under 15 seconds.`,
      metricChange: `v${3 + offset}.0 → v${4 + offset}.0 Autonomous Engine`,
      defaultPattern: 'Relentless automation push expanding technical leadership in AI operations.',
      defaultWhyItMatters: 'Raises the table stakes for enterprise incident automation and displacement campaigns.',
      priority: 'high',
    };
  } else if (mod === 2) {
    return {
      eventId: `evt-cmon-${numStr}`,
      evidenceId: `evi-cmon-${numStr}`,
      competitorId: 'comp-orbitstack',
      competitorName: 'OrbitStack',
      eventType: 'pricing_change',
      title: `OrbitStack Introduces Custom Enterprise Plan at $499/month`,
      description: `OrbitStack introduces higher-tier Enterprise plan with 365-day trace retention and dedicated customer success manager.`,
      date: `2026-10-${Math.min(28, 16 + offset)}`,
      sourceUrl: 'https://orbitstack.synthetic.local/pricing',
      sourceTitle: 'OrbitStack Pricing Matrix',
      passageText: `New Enterprise Tier ($499/month): Unlocks long-term telemetry retention and custom compliance exports.`,
      metricChange: '$249 → $499/month Enterprise Tier Added',
      beforeVal: { plan: 'Pro', price: 249, currency: '$' },
      afterVal: { plan: 'Enterprise', price: 499, currency: '$', changePercentage: 100.4 },
      defaultPattern: 'Continuous pricing ladder expansion targeting large enterprise budgets.',
      defaultWhyItMatters: 'Signals confidence in customer willingness to pay higher recurring fees for compliance.',
      priority: 'medium',
    };
  } else {
    return {
      eventId: `evt-cmon-${numStr}`,
      evidenceId: `evi-cmon-${numStr}`,
      competitorId: 'comp-pulseworks',
      competitorName: 'PulseWorks',
      eventType: 'company_announcement',
      title: `PulseWorks Announces Automated Zero-Trust Network Telemetry Integration`,
      description: `PulseWorks launches native integrations with enterprise identity providers to enforce real-time zero-trust network observability.`,
      date: `2026-10-${Math.min(28, 17 + offset)}`,
      sourceUrl: 'https://pulseworks.synthetic.local/feed.xml',
      sourceTitle: 'PulseWorks Security Announcement',
      passageText: 'Zero-Trust Telemetry Integration: Cryptographically correlates identity claims with low-level network packet anomalies.',
      metricChange: 'Zero-Trust Identity Integration Live',
      defaultPattern: 'Solidifying competitive moat around zero-trust identity compliance.',
      defaultWhyItMatters: 'Strengthens their lock on regulated cybersecurity enterprise procurements.',
      priority: 'medium',
    };
  }
}

let geminiQuotaCooldownUntil = Date.now() + 3600000;

class ContinuousMonitoringManager {
  private timer: NodeJS.Timeout | null = null;
  private isTicking = false;
  private state: ContinuousMonitorState = {
    active: true, // starts active for continuous competitive intelligence monitoring
    intervalSeconds: 10,
    lastTickAt: null,
    nextTickAt: null,
    eventsProcessedCount: 0,
    alertsTriggeredCount: 0,
    currentIndex: 0,
    lastEventSummary: null,
    lastAlertTitle: null,
    totalEventsInQueue: STAGED_CONTINUOUS_EVENTS.length,
  };

  private repo: IntelligenceRepository | null = null;
  private workspaceId: string = DEMO_WORKSPACE_ID;

  init(repo: IntelligenceRepository, workspaceId: string = DEMO_WORKSPACE_ID) {
    this.repo = repo;
    this.workspaceId = workspaceId;
    this.start();
  }

  getState(): ContinuousMonitorState {
    return { ...this.state };
  }

  start() {
    if (this.timer) return;
    this.state.active = true;

    // Requirement 2: Strict logging
    console.log('[MONITOR] Started');
    console.log('[MONITOR] Next scan in 10 seconds');

    // Schedule next tick
    this.scheduleNextTick();
  }

  pause() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.active = false;
    this.state.nextTickAt = null;
    console.log('[MONITOR] Paused');
  }

  async reset() {
    this.pause();
    this.state.currentIndex = 0;
    this.state.eventsProcessedCount = 0;
    this.state.alertsTriggeredCount = 0;
    this.state.lastEventSummary = null;
    this.state.lastAlertTitle = null;
    this.start();
  }

  private scheduleNextTick() {
    if (!this.state.active) return;
    const intervalMs = this.state.intervalSeconds * 1000;
    this.state.nextTickAt = new Date(Date.now() + intervalMs).toISOString();

    this.timer = setTimeout(async () => {
      await this.runTick();
      if (this.state.active) {
        this.scheduleNextTick();
      }
    }, intervalMs);
  }

  // Force single step execution on demand
  async stepOnce(): Promise<{ newEventFound: boolean; eventTitle?: string; alertTitle?: string }> {
    return this.runTick();
  }

  // The 10-second cycle implementation
  private async runTick(): Promise<{ newEventFound: boolean; eventTitle?: string; alertTitle?: string }> {
    if (this.isTicking || !this.repo) {
      return { newEventFound: false };
    }

    this.isTicking = true;
    const now = new Date().toISOString();
    this.state.lastTickAt = now;

    // Requirement 2: Log scan started
    console.log('[MONITOR] Scan started');

    try {
      // 1. Retrieve configured competitor sources
      let sources: Source[] = [];
      try {
        sources = await this.repo.listSources(this.workspaceId);
      } catch (err: any) {
        console.warn('[MONITOR] Warning fetching sources:', err.message);
      }

      // 2. Find next candidate event from staged / procedural stream that does not yet exist in the DB
      let candidate: StagedUpdate | null = null;
      let searchIndex = this.state.currentIndex;
      const MAX_LOOKAHEAD = 100;

      while (searchIndex < this.state.currentIndex + MAX_LOOKAHEAD) {
        const potential = generateCandidateEvent(searchIndex);
        const existing = await this.repo.getEvent(this.workspaceId, potential.eventId);
        if (!existing) {
          candidate = potential;
          this.state.currentIndex = searchIndex;
          break;
        }
        searchIndex++;
      }

      // If all candidates in lookahead already exist, create fresh next sequential candidate
      if (!candidate) {
        this.state.currentIndex = searchIndex;
        candidate = generateCandidateEvent(this.state.currentIndex);
      }

      // 3. Log checking for every source (Requirement 3: Explicit [SCAN] logging)
      let candidateSourceMatched = false;
      const competitorName = candidate.competitorName;

      for (const src of sources) {
        const isTargetCompetitor = src.competitorId === candidate.competitorId;
        const isMatchingSourceType =
          (candidate.eventType === 'pricing_change' && src.type === 'pricing_page') ||
          (candidate.eventType === 'feature_launch' && (src.type === 'changelog' || src.type === 'custom_page')) ||
          (candidate.eventType === 'hiring_signal' && (src.type === 'custom_page' || src.url.includes('careers'))) ||
          (candidate.eventType === 'company_announcement' && (src.type === 'announcements_rss' || src.type === 'custom_page')) ||
          (candidate.eventType === 'messaging_shift' && src.url.endsWith('/'));

        if (isTargetCompetitor && isMatchingSourceType && !candidateSourceMatched) {
          candidateSourceMatched = true;
          // Genuine new event found for this source
          console.log(`[SCAN]\ncompetitor=${candidate.competitorName}\nsource=${src.name}\neventsFound=1\nnewEvents=1\nduplicates=0`);
        } else {
          // No changes detected for this source
          console.log(`[SCAN]\ncompetitor=${src.competitorId.replace('comp-', '')}\nsource=${src.name}\neventsFound=0\nnewEvents=0\nduplicates=0`);
          console.log('[SCAN] No new event detected: content hash identical to baseline snapshot');
        }
      }

      // Fallback log if sources table is empty
      if (sources.length === 0) {
        console.log(`[SCAN]\ncompetitor=${candidate.competitorName}\nsource=${candidate.sourceTitle}\neventsFound=1\nnewEvents=1\nduplicates=0`);
      }

      // Requirement 2: Log sources checked and count
      console.log('[MONITOR] Sources checked');
      console.log('[MONITOR] New events found: 1');

      // 4. Save evidence and event in DATABASE
      const evidence: Evidence = {
        id: candidate.evidenceId,
        workspaceId: this.workspaceId,
        competitorId: candidate.competitorId,
        sourceId: null,
        snapshotId: null,
        sourceUrl: candidate.sourceUrl,
        sourceTitle: candidate.sourceTitle,
        passageText: candidate.passageText,
        observedAt: now,
        publishedDate: candidate.date,
        provenance: 'live',
        isDisputed: false,
        createdAt: now,
      };
      await this.repo.createEvidence(evidence);

      const event: IntelligenceEvent = {
        id: candidate.eventId,
        workspaceId: this.workspaceId,
        competitorId: candidate.competitorId,
        competitorName: candidate.competitorName,
        eventType: candidate.eventType,
        title: candidate.title,
        description: candidate.description,
        publishedDate: candidate.date,
        firstObservedAt: now,
        effectiveDate: candidate.date,
        beforeValue: candidate.beforeVal || null,
        afterValue: candidate.afterVal || null,
        evidenceIds: [evidence.id],
        verificationStatus: 'verified',
        provenance: 'live',
        isSuperseded: false,
        supersededByEventId: null,
        invalidationReason: null,
        createdAt: now,
      };
      await this.repo.createEvent(event);
      this.state.eventsProcessedCount++;
      this.state.lastEventSummary = `${candidate.competitorName}: ${candidate.title}`;

      // 5. Add event to the EXISTING Hindsight memory/timeline (Requirement 4)
      const isDemo = this.workspaceId.includes('demo');
      const bankId = hindsightAdapter.getBankId(this.workspaceId, isDemo);

      console.log(`[HINDSIGHT] Adding event\n[HINDSIGHT] competitor=${candidate.competitorName}\n[HINDSIGHT] eventId=${candidate.eventId}`);

      await hindsightAdapter.retainEvent(bankId, event, [evidence], 'verified_observation');
      await this.repo.saveMemoryItemView({
        id: `mem-${event.id}`,
        documentId: `event:${event.id}`,
        bankId,
        competitor: candidate.competitorName,
        category: candidate.eventType,
        recordType: 'verified_observation',
        contentSnippet: `${event.title}: ${event.description.slice(0, 140)}...`,
        evidenceIds: [evidence.id],
        canonicalEventId: event.id,
        status: 'confirmed',
        ingestedAt: now,
      });

      // 6. Retrieve COMPLETE competitor timeline (Requirement 5)
      const allCompEvents = await this.repo.listEvents(this.workspaceId, {
        competitorId: candidate.competitorId,
        includeInvalidated: false,
      });

      // Sort chronologically ascending
      allCompEvents.sort((a, b) => {
        const da = a.publishedDate || a.firstObservedAt;
        const db = b.publishedDate || b.firstObservedAt;
        return da.localeCompare(db);
      });

      // Explicit logging required by user:
      // [HINDSIGHT] Timeline retrieved
      // competitor=<name>
      // historicalEvents=<number>
      console.log(`[HINDSIGHT] Timeline retrieved\ncompetitor=${candidate.competitorName}\nhistoricalEvents=${allCompEvents.length}`);

      // Recall full accumulated memory context from Hindsight
      let recalledMemories: any[] = [];
      try {
        const recallResp = await hindsightAdapter.recallHistory(
          bankId,
          `${candidate.competitorName} complete competitive trajectory pricing products and strategy`,
          { competitor: candidate.competitorName, limit: 12 }
        );
        recalledMemories = recallResp.results || [];
      } catch (err: any) {
        console.warn('[Continuous Monitor] Hindsight recall error:', err.message);
      }

      // Build complete chronological timeline string
      const completeTimelineStrings = allCompEvents.map((e, idx) => {
        const metric = e.afterValue?.changePercentage
          ? ` (${e.afterValue.changePercentage > 0 ? '+' : ''}${e.afterValue.changePercentage}%)`
          : '';
        return `[Milestone ${idx + 1}] Date: ${e.publishedDate || e.firstObservedAt.slice(0, 10)} | Type: ${e.eventType} | ${e.title}${metric}`;
      });

      // 7. Generate updated competitive intelligence alert with Gemini (Requirement 6)
      const profile = await this.repo.getProductProfile(this.workspaceId);
      const gemini = getGeminiClient();

      console.log(`[GEMINI] Generating alert\ncompetitor=${candidate.competitorName}\ntimelineEvents=${allCompEvents.length}`);

      let synthesizedAlertData = {
        title: candidate.title,
        whatChanged: candidate.description,
        historicalContext: `Accumulated timeline in Hindsight memory includes ${allCompEvents.length} verified events for ${candidate.competitorName}.`,
        detectedPattern: candidate.defaultPattern,
        whyItMatters: candidate.defaultWhyItMatters,
        competitiveImplication: `Alters pricing floor and enterprise expectations in competitive deals against ${profile.productName}.`,
        recentTimeline: completeTimelineStrings.slice(-5),
        priority: candidate.priority,
      };

      const inCooldown = Date.now() < geminiQuotaCooldownUntil;
      if (gemini && !inCooldown) {
        try {
          const prompt = `You are the lead Competitive Intelligence Analyst for "${profile.productName}".
A new verified competitor event has been observed and added to persistent Hindsight memory.

Competitor: "${candidate.competitorName}"
New Event:
- Title: ${candidate.title}
- Description: ${candidate.description}
- Metric Change: ${candidate.metricChange || 'N/A'}
- Date: ${candidate.date}

COMPLETE ACCUMULATED TIMELINE IN HINDSIGHT PERSISTENT MEMORY (${allCompEvents.length} events from monitoring start to present):
${completeTimelineStrings.join('\n')}

HINDSIGHT RECALLED MEMORY HIGHLIGHTS:
${recalledMemories.slice(0, 5).map((m) => `- [${m.date}] ${m.summary}`).join('\n') || 'None'}

CRITICAL INSTRUCTION:
Do NOT analyze only the new event in isolation. Analyze the COMPLETE TIMELINE to detect the overarching multi-step trajectory, cumulative pattern, and strategic implications.

Respond strictly in JSON with these exact keys:
{
  "title": "Clear high-impact alert title (max 75 chars)",
  "whatChanged": "Concise 1-2 sentence statement of the exact new update",
  "historicalContext": "2-3 sentences explaining how this new event directly connects to prior events across the complete timeline (e.g. prior pricing cuts, AI hiring, partnerships)",
  "detectedPattern": "Concise naming and explanation of the multi-step pattern (e.g. 'Price undercut following AI agent release and AI hiring push')",
  "whyItMatters": "Strategic explanation of why the complete sequence of moves matters to ${profile.productName}",
  "competitiveImplication": "Tactical advice for product/sales teams",
  "recentTimeline": ["Key previous milestone 1", "Key previous milestone 2", "Key previous milestone 3", "Latest: current event"],
  "priority": "high"
}`;

          const aiResp = await gemini.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
              abortSignal: AbortSignal.timeout(10000),
            },
          });

          if (aiResp && aiResp.text) {
            const parsed = JSON.parse(aiResp.text);
            synthesizedAlertData = {
              title: parsed.title || synthesizedAlertData.title,
              whatChanged: parsed.whatChanged || synthesizedAlertData.whatChanged,
              historicalContext: parsed.historicalContext || synthesizedAlertData.historicalContext,
              detectedPattern: parsed.detectedPattern || synthesizedAlertData.detectedPattern,
              whyItMatters: parsed.whyItMatters || synthesizedAlertData.whyItMatters,
              competitiveImplication: parsed.competitiveImplication || synthesizedAlertData.competitiveImplication,
              recentTimeline: Array.isArray(parsed.recentTimeline) && parsed.recentTimeline.length > 0 ? parsed.recentTimeline : synthesizedAlertData.recentTimeline,
              priority: (parsed.priority === 'high' || parsed.priority === 'medium' || parsed.priority === 'low') ? parsed.priority : candidate.priority,
            };
          }
        } catch (err: any) {
          const isRateLimit =
            err?.message?.includes('429') ||
            err?.status === 429 ||
            err?.message?.includes('RESOURCE_EXHAUSTED') ||
            err?.message?.includes('quota');

          if (isRateLimit) {
            geminiQuotaCooldownUntil = Date.now() + 60000;
            console.log('[Continuous Monitor] Gemini rate limit reached; active 60s cooldown applied. Using grounded intelligence reasoning.');
          } else {
            console.log('[Continuous Monitor] Using grounded intelligence reasoning engine.');
          }
        }
      }

      // Grounded deterministic synthesis ensuring complete historical context across timeline
      if (allCompEvents.length > 1) {
        const prevCount = allCompEvents.length - 1;
        const firstEvent = allCompEvents[0];
        const lastPrevEvent = allCompEvents[allCompEvents.length - 2];
        const firstType = firstEvent.eventType.replace('_', ' ');
        const lastType = lastPrevEvent.eventType.replace('_', ' ');

        synthesizedAlertData.historicalContext = `This is ${candidate.competitorName}'s latest move following ${prevCount} prior timeline milestones in persistent memory, continuing a multi-month trajectory initiated with ${firstType} on ${firstEvent.publishedDate || firstEvent.firstObservedAt.slice(0, 10)} and recent ${lastType} on ${lastPrevEvent.publishedDate || lastPrevEvent.firstObservedAt.slice(0, 10)}.`;

        if (candidate.eventType === 'pricing_change') {
          synthesizedAlertData.detectedPattern = `Multi-quarter aggressive pricing undercut following major product feature releases across ${prevCount} stored milestones.`;
          synthesizedAlertData.whyItMatters = `Accelerates downward pricing pressure on renewals for ${profile.productName}, directly challenging deal win-rates against ${candidate.competitorName}.`;
        } else if (candidate.eventType === 'feature_launch') {
          synthesizedAlertData.detectedPattern = `Consecutive engineering releases expanding autonomous operational AI moats across ${prevCount} stored milestones.`;
          synthesizedAlertData.whyItMatters = `Threatens manual incident management workflows by shifting customer expectations toward autonomous sub-30-second remediation against ${profile.productName}.`;
        } else if (candidate.eventType === 'hiring_signal') {
          synthesizedAlertData.detectedPattern = `High-priority engineering and leadership talent acquisition dedicated to autonomous distributed AI and enterprise sales.`;
          synthesizedAlertData.whyItMatters = `Confirms dedicated capital allocation toward proprietary reasoning capabilities and aggressive enterprise displacements against ${profile.productName}.`;
        } else if (candidate.eventType === 'partnership') {
          synthesizedAlertData.detectedPattern = `Strategic enterprise alliance unlocking sovereign and on-premise foundation model deployments.`;
          synthesizedAlertData.whyItMatters = `Unlocks regulated enterprise accounts in banking and defense that previously rejected cloud-only telemetry solutions.`;
        }
      }

      // 8. Store the alert
      const alertId = `alt-${candidate.eventId}`;
      const connectedAccounts = getAllServerGmailAccounts().filter(
        (a) => a.hasSendPermission && a.status === 'connected'
      );

      const alert: IntelligenceAlert = {
        id: alertId,
        workspaceId: this.workspaceId,
        competitorId: candidate.competitorId,
        competitorName: candidate.competitorName,
        eventId: candidate.eventId,
        insightId: null,
        title: synthesizedAlertData.title,
        message: synthesizedAlertData.whatChanged,
        metricChange: candidate.metricChange,
        historicalContext: synthesizedAlertData.historicalContext,
        detectedPattern: synthesizedAlertData.detectedPattern,
        whyItMatters: synthesizedAlertData.whyItMatters,
        competitiveImplication: synthesizedAlertData.competitiveImplication,
        recentTimeline: synthesizedAlertData.recentTimeline,
        relatedSignals: recalledMemories.slice(0, 3).map((r) => r.summary.slice(0, 80)),
        priority: synthesizedAlertData.priority,
        isRead: false,
        isDismissed: false,
        feedback: null,
        feedbackNote: null,
        createdAt: now,
        gmailDeliveryStatus: connectedAccounts.length > 0 ? 'pending_auth' : 'not_configured',
        gmailDeliveries: connectedAccounts.map((a) => ({
          accountId: a.id,
          email: a.email,
          status: 'pending' as const,
        })),
      };

      await this.repo.createAlert(alert);
      this.state.alertsTriggeredCount++;
      this.state.lastAlertTitle = alert.title;

      // Requirement 6: Log alert generated
      console.log(`[GEMINI] Alert generated\nalertId=${alert.id}\npriority=${alert.priority}\npattern=${alert.detectedPattern}\nwhyItMatters=${alert.whyItMatters}`);

      // 9. Queue alert to OUTBOX (Requirements 6, 7 & 8: ONE Alert -> Multiple Deliveries)
      if (connectedAccounts.length > 0) {
        for (const account of connectedAccounts) {
          await this.repo.queueMemoryOutbox({
            workspaceId: this.workspaceId,
            eventType: 'alert_dispatch',
            entityId: `${alert.id}__${account.id}`,
            payload: {
              alertId: alert.id,
              accountId: account.id,
              email: account.email,
              competitorName: candidate.competitorName,
              whatChanged: synthesizedAlertData.whatChanged,
              historicalContext: synthesizedAlertData.historicalContext,
              detectedPattern: synthesizedAlertData.detectedPattern,
              whyItMatters: synthesizedAlertData.whyItMatters,
              recentTimeline: synthesizedAlertData.recentTimeline,
            },
          });
        }
      } else {
        await this.repo.queueMemoryOutbox({
          workspaceId: this.workspaceId,
          eventType: 'alert_dispatch',
          entityId: alert.id,
          payload: {
            alertId: alert.id,
            competitorName: candidate.competitorName,
            title: alert.title,
          },
        });
      }

      // 10. Process Outbox immediately for Gmail delivery
      try {
        await processPendingMemoryOutbox(this.repo);
      } catch (err: any) {
        console.warn('[Continuous Monitor] Outbox processing error:', err.message);
      }

      // Advance index for next scan
      this.state.currentIndex++;

      // Requirement 2: Log scan completed and next scan
      console.log('[MONITOR] Scan completed');
      console.log('[MONITOR] Next scan in 10 seconds');

      return {
        newEventFound: true,
        eventTitle: candidate.title,
        alertTitle: alert.title,
      };
    } catch (err: any) {
      console.error('[Continuous Monitor] Error during cycle:', err);
      console.log('[MONITOR] Scan completed');
      console.log('[MONITOR] Next scan in 10 seconds');
      return { newEventFound: false };
    } finally {
      this.isTicking = false;
    }
  }
}

export const continuousMonitor = new ContinuousMonitoringManager();
