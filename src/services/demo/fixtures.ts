import type {
  Competitor,
  Source,
  Evidence,
  IntelligenceEvent,
  StrategicInsight,
  IntelligenceAlert,
} from '../../types/intelligence.ts';

export const DEMO_WORKSPACE_ID = 'demo-workspace-01';
export const DEMO_CLOCK_DATE = '2026-09-28';

export const DEMO_COMPETITORS: Array<Omit<Competitor, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'comp-novaflow',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'NovaFlow',
    domain: 'novaflow.synthetic.local',
    description: 'High-growth B2B enterprise telemetry & AI operational intelligence platform (Direct Competitor).',
    tier: 'primary',
    status: 'active',
  },
  {
    id: 'comp-orbitstack',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'OrbitStack',
    domain: 'orbitstack.synthetic.local',
    description: 'Developer-first cloud observability & distributed tracing provider targeting mid-market engineering teams.',
    tier: 'primary',
    status: 'active',
  },
  {
    id: 'comp-pulseworks',
    workspaceId: DEMO_WORKSPACE_ID,
    name: 'PulseWorks',
    domain: 'pulseworks.synthetic.local',
    description: 'Enterprise security, compliance-focused observability, and automated log analytics suite.',
    tier: 'secondary',
    status: 'active',
  },
];

export const DEMO_SOURCES: Array<Omit<Source, 'createdAt'>> = [
  {
    id: 'src-novaflow-pricing',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-novaflow',
    name: 'NovaFlow Pricing & Tier Matrix',
    type: 'pricing_page',
    url: 'https://novaflow.synthetic.local/pricing',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T04:15:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-novaflow-changelog',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-novaflow',
    name: 'NovaFlow Product Releases & Changelog',
    type: 'changelog',
    url: 'https://novaflow.synthetic.local/changelog',
    active: true,
    fetchIntervalHours: 12,
    lastFetchedAt: '2026-09-28T04:15:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-novaflow-press',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-novaflow',
    name: 'NovaFlow Newsroom & Press Releases',
    type: 'announcements_rss',
    url: 'https://novaflow.synthetic.local/news/rss.xml',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T04:15:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-novaflow-careers',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-novaflow',
    name: 'NovaFlow Engineering Careers',
    type: 'custom_page',
    url: 'https://novaflow.synthetic.local/careers',
    active: true,
    fetchIntervalHours: 48,
    lastFetchedAt: '2026-09-27T18:00:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-orbitstack-pricing',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-orbitstack',
    name: 'OrbitStack Pricing Tier Page',
    type: 'pricing_page',
    url: 'https://orbitstack.synthetic.local/pricing',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T05:00:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-orbitstack-changelog',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-orbitstack',
    name: 'OrbitStack Dev Log',
    type: 'changelog',
    url: 'https://orbitstack.synthetic.local/dev-log',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T05:00:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-pulseworks-pricing',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-pulseworks',
    name: 'PulseWorks Plans',
    type: 'pricing_page',
    url: 'https://pulseworks.synthetic.local/pricing',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T06:00:00Z',
    lastStatus: 200,
    lastError: null,
  },
  {
    id: 'src-pulseworks-news',
    workspaceId: DEMO_WORKSPACE_ID,
    competitorId: 'comp-pulseworks',
    name: 'PulseWorks Enterprise Security Blog',
    type: 'announcements_rss',
    url: 'https://pulseworks.synthetic.local/feed.xml',
    active: true,
    fetchIntervalHours: 24,
    lastFetchedAt: '2026-09-28T06:00:00Z',
    lastStatus: 200,
    lastError: null,
  },
];

export interface FixtureEventBundle {
  event: IntelligenceEvent;
  evidence: Evidence;
}

export function buildDeterministicSixMonthFixtures(): FixtureEventBundle[] {
  const bundles: FixtureEventBundle[] = [];

  const add = (
    eventId: string,
    evidenceId: string,
    competitorId: string,
    eventType: IntelligenceEvent['eventType'],
    title: string,
    description: string,
    date: string,
    sourceUrl: string,
    sourceTitle: string,
    passageText: string,
    beforeVal: any = null,
    afterVal: any = null
  ) => {
    const evidence: Evidence = {
      id: evidenceId,
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId,
      sourceId: null,
      snapshotId: null,
      sourceUrl,
      sourceTitle,
      passageText,
      observedAt: `${date}T09:00:00Z`,
      publishedDate: date,
      provenance: 'synthetic',
      isDisputed: false,
      disputeReason: null,
      createdAt: `${date}T09:00:00Z`,
    };

    const event: IntelligenceEvent = {
      id: eventId,
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId,
      eventType,
      title,
      description,
      publishedDate: date,
      firstObservedAt: `${date}T09:00:00Z`,
      effectiveDate: date,
      beforeValue: beforeVal,
      afterValue: afterVal,
      evidenceIds: [evidenceId],
      verificationStatus: 'verified',
      provenance: 'synthetic',
      isSuperseded: false,
      supersededByEventId: null,
      invalidationReason: null,
      createdAt: `${date}T09:00:00Z`,
    };

    bundles.push({ event, evidence });
  };

  // ==========================================
  // NOVAFLOW 6-MONTH ARC (April - September 2026)
  // ==========================================

  // 1. April 2026 - Baseline Enterprise Pricing ₹60,000/mo
  add(
    'evt-nova-01',
    'evi-nova-01',
    'comp-novaflow',
    'pricing_change',
    'NovaFlow Baseline Enterprise Plan Established at ₹60,000/month',
    'NovaFlow lists its Enterprise Tier subscription at ₹60,000 per month flat rate, including up to 50 agent nodes.',
    '2026-04-05',
    'https://novaflow.synthetic.local/pricing',
    'NovaFlow Official Pricing Matrix',
    'Enterprise Tier: ₹60,000 / month flat subscription. Unlocks dedicated cluster telemetry, enterprise single-sign on, and 24/7 SLA.',
    null,
    { planName: 'Enterprise', currency: '₹', price: 60000, billingPeriod: 'monthly', unit: 'flat_rate' }
  );

  // 2. April 2026 - Core Platform V3
  add(
    'evt-nova-02',
    'evi-nova-02',
    'comp-novaflow',
    'feature_launch',
    'NovaFlow Launches Core Telemetry Engine v3.0',
    'NovaFlow announces release of v3.0 telemetry engine with real-time stream ingestion and sub-second anomaly detection.',
    '2026-04-18',
    'https://novaflow.synthetic.local/changelog',
    'NovaFlow Changelog v3.0',
    'Today we are rolling out NovaFlow Engine v3.0. Ingestion throughput is doubled with our new Rust-based worker nodes.',
    null,
    { version: '3.0', focus: 'Streaming Ingestion' }
  );

  // 3. May 2026 - AI Job Opening 1
  add(
    'evt-nova-03',
    'evi-nova-03',
    'comp-novaflow',
    'hiring_signal',
    'NovaFlow Opens Role: Principal Distributed AI Inference Engineer',
    'NovaFlow posts a key job opening for a Principal Distributed AI Inference Engineer to lead autonomous incident response agents.',
    '2026-05-02',
    'https://novaflow.synthetic.local/careers',
    'NovaFlow Career Portal',
    'Job Opening: Principal Distributed AI Inference Engineer (Bangalore / Remote). You will build low-latency inference pipelines directly inside our telemetry stream.',
    null,
    { title: 'Principal Distributed AI Inference Engineer', department: 'AI Infrastructure', publishedOpenings: 1 }
  );

  // 4. May 2026 - Kubernetes integration
  add(
    'evt-nova-04',
    'evi-nova-04',
    'comp-novaflow',
    'feature_launch',
    'NovaFlow Releases Deep Kubernetes Operator',
    'New native Kubernetes operator providing automatic sidecar injection and cluster health monitoring.',
    '2026-05-19',
    'https://novaflow.synthetic.local/changelog',
    'NovaFlow Releases',
    'Deploy NovaFlow across entire Kubernetes clusters in seconds with our new official Helm and Kube-Operator release.',
    null,
    null
  );

  // 5. June 2026 - First Price Reduction: ₹60,000 -> ₹50,000 (16.7% drop)
  add(
    'evt-nova-05',
    'evi-nova-05',
    'comp-novaflow',
    'pricing_change',
    'NovaFlow Reduces Enterprise Pricing from ₹60,000 to ₹50,000/month',
    'NovaFlow updates its public pricing matrix, discounting its Enterprise Plan from ₹60,000 to ₹50,000 per month (16.7% reduction).',
    '2026-06-08',
    'https://novaflow.synthetic.local/pricing',
    'NovaFlow Pricing Matrix (Summer Update)',
    'Enterprise Tier now ₹50,000 / month (previously ₹60,000/mo). Everything needed for mission-critical infrastructure observability at accessible enterprise rates.',
    { planName: 'Enterprise', currency: '₹', price: 60000, billingPeriod: 'monthly', unit: 'flat_rate' },
    { planName: 'Enterprise', currency: '₹', price: 50000, billingPeriod: 'monthly', unit: 'flat_rate', changePercentage: -16.7 }
  );

  // 6. June 2026 - AI Feature Launch: NovaFlow OmniAgent Suite
  add(
    'evt-nova-06',
    'evi-nova-06',
    'comp-novaflow',
    'feature_launch',
    'NovaFlow Launches "OmniAgent Suite" for Autonomous Root-Cause Remediation',
    'NovaFlow unveils the OmniAgent Suite, an AI-driven agent capable of correlating multi-service logs and generating instant incident mitigation scripts.',
    '2026-06-22',
    'https://novaflow.synthetic.local/changelog',
    'Product Launch: OmniAgent Suite',
    'Announcing NovaFlow OmniAgent Suite: our breakthrough AI telemetry copilot that investigates outages across distributed systems and drafts fixes in under 30 seconds.',
    null,
    { feature: 'OmniAgent Suite', technology: 'Autonomous Multi-agent Troubleshooting' }
  );

  // 7. July 2026 - AI Partnership Announcement with Hyperscale AI
  add(
    'evt-nova-07',
    'evi-nova-07',
    'comp-novaflow',
    'partnership',
    'NovaFlow Partners with Hyperscale AI for Enterprise Agent Infrastructure',
    'Strategic foundation model partnership with Hyperscale AI to integrate sovereign on-prem reasoning models for regulated enterprise clients.',
    '2026-07-12',
    'https://novaflow.synthetic.local/news/rss.xml',
    'Press Release: NovaFlow & Hyperscale AI Alliance',
    'NovaFlow has entered a multi-year joint development alliance with Hyperscale AI to deliver secure, air-gapped LLM incident analysis for banking and defense customers.',
    null,
    { partner: 'Hyperscale AI', focus: 'Enterprise On-prem Inference' }
  );

  // 8. July 2026 - Strategic Enterprise Messaging Shift
  add(
    'evt-nova-08',
    'evi-nova-08',
    'comp-novaflow',
    'messaging_shift',
    'NovaFlow Repositions Homepage: "Autonomous Enterprise Intelligence at Scale"',
    'NovaFlow completely redesigns its value proposition away from "Developer Metrics" to "Autonomous Enterprise Intelligence at Scale".',
    '2026-07-28',
    'https://novaflow.synthetic.local/',
    'NovaFlow Homepage Hero Banner',
    'Headline changed from "Fast telemetry dashboards for developers" to "Autonomous Enterprise Intelligence at Scale — Stop triaging incidents manually."',
    { headline: 'Fast telemetry dashboards for developers' },
    { headline: 'Autonomous Enterprise Intelligence at Scale — Stop triaging incidents manually.' }
  );

  // 9. August 2026 - Additional AI Role: Staff LLM Security Researcher
  add(
    'evt-nova-09',
    'evi-nova-09',
    'comp-novaflow',
    'hiring_signal',
    'NovaFlow Opens Role: Staff LLM Evaluation & Security Specialist',
    'NovaFlow expands its AI safety division, hiring for an LLM Evaluation specialist to safeguard autonomous action generation.',
    '2026-08-14',
    'https://novaflow.synthetic.local/careers',
    'NovaFlow Job Board',
    'Position: Staff LLM Evaluation & Security Specialist. Ensure our automated remediation recommendations adhere to zero-hallucination protocols.',
    null,
    { title: 'Staff LLM Evaluation & Security Specialist', openings: 1 }
  );

  // 10. August 2026 - SOC2 Type II Certification
  add(
    'evt-nova-10',
    'evi-nova-10',
    'comp-novaflow',
    'company_announcement',
    'NovaFlow Completes SOC 2 Type II and HIPAA Compliance Certification',
    'NovaFlow announces audit completion for SOC 2 Type II and HIPAA, removing a primary barrier for Fortune 500 enterprise adoptions.',
    '2026-08-27',
    'https://novaflow.synthetic.local/news/rss.xml',
    'NovaFlow Trust & Compliance Center',
    'NovaFlow successfully achieves SOC 2 Type II compliance verified by Ernst & Young, validating our zero-trust data pipeline.',
    null,
    { certifications: ['SOC 2 Type II', 'HIPAA'] }
  );

  // 11. September 2026 - Second Major Price Reduction: ₹50,000 -> ₹35,000 (30% drop!)
  add(
    'evt-nova-11',
    'evi-nova-11',
    'comp-novaflow',
    'pricing_change',
    'NovaFlow Drops Enterprise Pricing from ₹50,000 to ₹35,000/month (30% Reduction)',
    'In a dramatic pricing undercut, NovaFlow slashes Enterprise plan pricing from ₹50,000 to ₹35,000 per month (an exact 30.0% reduction) to capture enterprise market share.',
    '2026-09-15',
    'https://novaflow.synthetic.local/pricing',
    'NovaFlow Pricing Announcement: Q3 Enterprise Drive',
    'Enterprise Tier revised to ₹35,000 / month flat fee (reduced from ₹50,000/month). Full suite including OmniAgent AI included at zero additional cost.',
    { planName: 'Enterprise', currency: '₹', price: 50000, billingPeriod: 'monthly', unit: 'flat_rate' },
    { planName: 'Enterprise', currency: '₹', price: 35000, billingPeriod: 'monthly', unit: 'flat_rate', changePercentage: -30.0 }
  );

  // 12. September 2026 - Self-healing Agent Feature
  add(
    'evt-nova-12',
    'evi-nova-12',
    'comp-novaflow',
    'feature_launch',
    'NovaFlow Ships "Self-Healing Playbooks" for Cloud Workloads',
    'NovaFlow enables automatic execution of approved terraform and container rollbacks directly from agent findings.',
    '2026-09-24',
    'https://novaflow.synthetic.local/changelog',
    'NovaFlow Release v3.6',
    'Introducing Self-Healing Playbooks. OmniAgent can now trigger automated canary rollbacks and node cordon routines with 1-click approvals.',
    null,
    { feature: 'Self-Healing Playbooks' }
  );

  // ==========================================
  // ORBITSTACK 6-MONTH ARC (April - September 2026)
  // Developer-first, mid-market, prices INCREASED
  // ==========================================

  // 13. April 2026 - OrbitStack Pro Pricing $199
  add(
    'evt-orbit-01',
    'evi-orbit-01',
    'comp-orbitstack',
    'pricing_change',
    'OrbitStack Pro Plan Established at $199/month',
    'OrbitStack sets its Pro Tier at $199 per month for up to 10 engineer seats with 30-day retention.',
    '2026-04-10',
    'https://orbitstack.synthetic.local/pricing',
    'OrbitStack Pricing Guide',
    'Pro Tier: $199 / month flat rate for engineering squads. 30-day distributed trace history and CLI integrations.',
    null,
    { planName: 'Pro', currency: '$', price: 199, billingPeriod: 'monthly', unit: 'flat_rate' }
  );

  // 14. May 2026 - OpenTelemetry Native Exporter
  add(
    'evt-orbit-02',
    'evi-orbit-02',
    'comp-orbitstack',
    'feature_launch',
    'OrbitStack Releases Zero-Overhead OpenTelemetry Exporter',
    'High-throughput native exporter allowing teams to ingest OTel traces with zero proprietary agent overhead.',
    '2026-05-14',
    'https://orbitstack.synthetic.local/dev-log',
    'OrbitStack Engineering Blog',
    'We are open-sourcing our lightweight OpenTelemetry collector pipeline with 85% reduced memory footprint.',
    null,
    null
  );

  // 15. June 2026 - OrbitStack Price Hike: $199 -> $249 (+25% increase)
  add(
    'evt-orbit-03',
    'evi-orbit-03',
    'comp-orbitstack',
    'pricing_change',
    'OrbitStack Increases Pro Tier Pricing from $199 to $249/month (+25% Hike)',
    'OrbitStack increases its Pro Plan subscription from $199 to $249/month, citing advanced continuous profiling additions.',
    '2026-06-15',
    'https://orbitstack.synthetic.local/pricing',
    'OrbitStack Pricing Update Notice',
    'Effective immediately, Pro Tier is updated to $249 / month to reflect the addition of eBPF continuous profiling.',
    { planName: 'Pro', currency: '$', price: 199, billingPeriod: 'monthly', unit: 'flat_rate' },
    { planName: 'Pro', currency: '$', price: 249, billingPeriod: 'monthly', unit: 'flat_rate', changePercentage: 25.1 }
  );

  // 16. July 2026 - VP Developer Relations Hire
  add(
    'evt-orbit-04',
    'evi-orbit-04',
    'comp-orbitstack',
    'company_announcement',
    'OrbitStack Hires Ex-GitHub Exec as VP of Developer Ecosystem',
    'OrbitStack announces appointment of Sarah Chen as VP of Developer Ecosystem to expand open-source adoption.',
    '2026-07-09',
    'https://orbitstack.synthetic.local/news',
    'OrbitStack Executive Press Release',
    'We are thrilled to welcome Sarah Chen to lead our developer community and OpenTelemetry standardization programs.',
    null,
    { executive: 'Sarah Chen', title: 'VP of Developer Ecosystem' }
  );

  // 17. August 2026 - eBPF Continuous Profiler
  add(
    'evt-orbit-05',
    'evi-orbit-05',
    'comp-orbitstack',
    'feature_launch',
    'OrbitStack Ships eBPF Continuous Profiler for Linux Kernels',
    'Deep kernel profiling without bytecode modification or code rewrites.',
    '2026-08-04',
    'https://orbitstack.synthetic.local/dev-log',
    'OrbitStack v2.4 Release',
    'Continuous eBPF profiler now live in general availability for all Pro and Enterprise subscribers.',
    null,
    null
  );

  // 18. September 2026 - Messaging Shift: "The Dev-First Observability Standard"
  add(
    'evt-orbit-06',
    'evi-orbit-06',
    'comp-orbitstack',
    'messaging_shift',
    'OrbitStack Refines Messaging Around Developer Autonomy',
    'Emphasizes no-bloat, code-first tracing for fast-shipping software engineering organizations.',
    '2026-09-11',
    'https://orbitstack.synthetic.local/',
    'OrbitStack Brand Portal',
    'Updated tagline: "Observability without the enterprise bloat. Built by devs, for devs."',
    null,
    null
  );

  // ==========================================
  // PULSEWORKS 6-MONTH ARC (April - September 2026)
  // Compliance, Security, Usage-based pricing
  // ==========================================

  // 19. April 2026 - Usage-based Log Tier ($0.15/GB)
  add(
    'evt-pulse-01',
    'evi-pulse-01',
    'comp-pulseworks',
    'pricing_change',
    'PulseWorks Introduces Usage-Based Log Ingestion at $0.15/GB',
    'PulseWorks transitions from flat host tiers to consumption-based $0.15 per ingested gigabyte.',
    '2026-04-22',
    'https://pulseworks.synthetic.local/pricing',
    'PulseWorks Transparent Pricing',
    'Flexible enterprise billing: Ingest logs at $0.15 / GB with no minimum seat requirements.',
    null,
    { planName: 'Usage Flex', currency: '$', price: 0.15, billingPeriod: 'monthly', unit: 'usage' }
  );

  // 20. May 2026 - Automated GDPR & PII Masking
  add(
    'evt-pulse-02',
    'evi-pulse-02',
    'comp-pulseworks',
    'feature_launch',
    'PulseWorks Launches Streaming PII Masking & GDPR Compliance Filter',
    'Automatic redaction of sensitive credentials, payment data, and personally identifiable information in logs.',
    '2026-05-28',
    'https://pulseworks.synthetic.local/feed.xml',
    'PulseWorks Security Bulletin',
    'Real-time automated redaction ensures no unencrypted credit cards or SSNs enter your cold storage repositories.',
    null,
    null
  );

  // 21. June 2026 - FedRAMP In-Process Milestone
  add(
    'evt-pulse-03',
    'evi-pulse-03',
    'comp-pulseworks',
    'company_announcement',
    'PulseWorks Designates FedRAMP "In-Process" Status for US Federal Sector',
    'PulseWorks advances government cloud observability compliance with US Federal sponsorship.',
    '2026-06-30',
    'https://pulseworks.synthetic.local/news',
    'PulseWorks Government Solutions',
    'PulseWorks achieves FedRAMP Moderate In-Process milestone, unlocking secure US agency procurement.',
    null,
    { program: 'FedRAMP Moderate' }
  );

  // 22. July 2026 - SecureCloud Partnership
  add(
    'evt-pulse-04',
    'evi-pulse-04',
    'comp-pulseworks',
    'partnership',
    'PulseWorks Enters Global OEM Agreement with SecureCloud Systems',
    'Co-selling alliance integrating PulseWorks compliance telemetry into SecureCloud managed perimeter suites.',
    '2026-07-22',
    'https://pulseworks.synthetic.local/feed.xml',
    'SecureCloud & PulseWorks Joint Release',
    'PulseWorks compliance dashboards will be embedded standard across SecureCloud 500+ financial sector accounts.',
    null,
    { partner: 'SecureCloud Systems' }
  );

  // 23. August 2026 - Hiring Signal: Director of Regulatory Compliance
  add(
    'evt-pulse-05',
    'evi-pulse-05',
    'comp-pulseworks',
    'hiring_signal',
    'PulseWorks Opens Search for Director of Banking Regulatory Compliance',
    'Expanding European and APAC regulatory assurance practices.',
    '2026-08-19',
    'https://pulseworks.synthetic.local/careers',
    'PulseWorks Job Board',
    'Seeking Director of Banking Regulatory Compliance to interface with central bank audit committees.',
    null,
    { title: 'Director of Banking Regulatory Compliance' }
  );

  // 24. September 2026 - Launch of Audit-Trail Immutable Vault
  add(
    'evt-pulse-06',
    'evi-pulse-06',
    'comp-pulseworks',
    'feature_launch',
    'PulseWorks Ships WORM (Write-Once-Read-Many) Compliant Log Vault',
    'Cryptographically signed immutable logs designed for financial SEC and FINRA audit mandates.',
    '2026-09-18',
    'https://pulseworks.synthetic.local/feed.xml',
    'PulseWorks Release Bulletin',
    'Our WORM Log Vault guarantees immutable data retention with hardware security module root-of-trust.',
    null,
    null
  );

  return bundles;
}

export function buildDeterministicInsights(): StrategicInsight[] {
  return [
    {
      id: 'ins-nova-strategic-01',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-novaflow',
      title: 'NovaFlow 6-Month Strategic Arc: Dual Enterprise Price Cut Coupled With Aggressive AI Repositioning',
      summary:
        'Over the last 6 months, NovaFlow has systematically reduced its Enterprise pricing by a cumulative 41.7% (₹60,000 → ₹50,000 → ₹35,000) while simultaneously pivoting from a point telemetry tool into an autonomous AI intelligence platform via the OmniAgent suite, specialized AI hiring, and a foundation model partnership with Hyperscale AI.',
      observedChanges: [
        'Enterprise pricing reduced from ₹60,000 to ₹50,000/mo in June 2026 (16.7% drop) [evt-nova-05]',
        'OmniAgent Suite autonomous remediation copilot launched in June 2026 [evt-nova-06]',
        'Foundation model partnership announced with Hyperscale AI in July 2026 [evt-nova-07]',
        'Homepage positioning rebranded to "Autonomous Enterprise Intelligence at Scale" in July 2026 [evt-nova-08]',
        'Key AI engineering roles opened for distributed inference and evaluation [evt-nova-03, evt-nova-09]',
        'Second enterprise pricing cut from ₹50,000 to ₹35,000/mo in September 2026 (30.0% drop) [evt-nova-11]',
      ],
      historicalPattern:
        'NovaFlow is executing a classic "land and expand" enterprise penetration playbook: slashing pricing barrier by 30-40% to displace incumbents while bundling high-value generative AI automation at zero marginal cost. Their AI hiring in May preceded their product launch in June, which was followed by sovereign enterprise partnerships in July, culminating in the Q3 pricing undercut.',
      businessSignificance:
        'ApexMetrics AI currently charges ₹45,000/month for Enterprise monitoring. NovaFlow at ₹35,000/month with bundled autonomous remediation poses an immediate renewal risk for our mid-market and price-sensitive enterprise accounts.',
      risks: [
        'Direct pricing pressure on ApexMetrics ₹45k tier, creating customer pushback during annual contract renewals.',
        'Perception that NovaFlow has leapfrogged our manual alerting with automated self-healing playbooks.',
      ],
      opportunities: [
        'Differentiate on mission-critical uptime, auditability, and zero-hallucination guarantees.',
        'Highlight our SOC2 Type II depth and existing enterprise telemetry integrations where NovaFlow is still nascent.',
      ],
      recommendedActions: [
        'Arm sales engineering with an objective comparison sheet emphasizing ApexMetrics stability vs NovaFlow beta agent scripts.',
        'Accelerate our Q4 roadmap for the automated troubleshooting assistant.',
        'Offer a price-lock enterprise guarantee for 2-year commitments to neutralize NovaFlow churn.',
      ],
      alternativeExplanations: [
        'NovaFlow may be running a time-limited promotional discount to boost ARR multiples ahead of a Series C venture round.',
        'Their lower price point may suffer from hidden consumption surcharges not yet fully exposed on their public matrix.',
      ],
      uncertainty:
        'Public sources show listed flat rates; enterprise discount tiers negotiated off-sheet may vary. We cannot independently confirm customer adoption rates for the OmniAgent suite.',
      evidenceIds: ['evi-nova-01', 'evi-nova-05', 'evi-nova-06', 'evi-nova-07', 'evi-nova-08', 'evi-nova-11'],
      supportingEventIds: ['evt-nova-01', 'evt-nova-05', 'evt-nova-06', 'evt-nova-07', 'evt-nova-08', 'evt-nova-11'],
      coverageStart: '2026-04-01',
      coverageEnd: '2026-09-28',
      isStale: false,
      createdAt: '2026-09-28T07:00:00Z',
    },
    {
      id: 'ins-orbit-strategic-02',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-orbitstack',
      title: 'OrbitStack Pricing Hike & Deep Focus on Developer OpenTelemetry Standards',
      summary:
        'Unlike NovaFlow, OrbitStack raised prices by 25.1% ($199 → $249/mo) while doubling down on developer autonomy, eBPF profiling, and open-source standards.',
      observedChanges: [
        'Pro plan increased from $199 to $249 in June 2026 [evt-orbit-03]',
        'Launched eBPF continuous kernel profiler in August 2026 [evt-orbit-05]',
        'Appointed VP of Developer Ecosystem from GitHub in July 2026 [evt-orbit-04]',
      ],
      historicalPattern:
        'OrbitStack is trading low-tier customer volume for higher ARPU among high-end engineering teams who prioritize zero-overhead open instrumentation over packaged AI dashboards.',
      businessSignificance:
        'OrbitStack is vacating the budget-sensitive tier, creating room for ApexMetrics developer tier expansion.',
      risks: [
        'Their eBPF continuous profiling is technically superior for pure backend microservice tracing.',
      ],
      opportunities: [
        'Offer automated OpenTelemetry ingestion out-of-the-box to capture engineering squads dissatisfied with their 25% price hike.',
      ],
      recommendedActions: [
        'Publish an OpenTelemetry compatibility guide showing zero-cost migration to ApexMetrics.',
      ],
      alternativeExplanations: [
        'OrbitStack may be targeting cash-flow breakeven rather than pure venture-scale growth.',
      ],
      uncertainty:
        'Pricing changes observed only on public credit-card tiers; enterprise contract terms may differ.',
      evidenceIds: ['evi-orbit-01', 'evi-orbit-03', 'evi-orbit-05'],
      supportingEventIds: ['evt-orbit-01', 'evt-orbit-03', 'evt-orbit-05'],
      coverageStart: '2026-04-01',
      coverageEnd: '2026-09-28',
      isStale: false,
      createdAt: '2026-09-28T07:15:00Z',
    },
  ];
}

export function buildDeterministicAlerts(): IntelligenceAlert[] {
  return [
    {
      id: 'alt-nova-price-cut-35k',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-novaflow',
      eventId: 'evt-nova-11',
      insightId: 'ins-nova-strategic-01',
      title: 'NovaFlow reduced Enterprise pricing',
      message: 'Enterprise pricing dropped from ₹50,000 to ₹35,000/month (-30%). This is the second pricing reduction detected in the monitoring period.',
      metricChange: '₹50,000 → ₹35,000/month (-30%)',
      historicalContext: 'This is NovaFlow’s second major Enterprise price reduction in six months. Pricing has moved from ₹60,000 → ₹50,000 → ₹35,000.',
      relatedSignals: [
        'OmniAgent launch (June 2026)',
        'AI engineering hiring ramp (July 2026)',
        'Hyperscale AI cloud partnership (August 2026)',
        'AI-first messaging repositioning (April 2026)',
      ],
      whyItMatters: 'The latest pricing change is part of a larger six-month competitive pattern to commoditize infrastructure monitoring and lock in mid-market accounts.',
      priority: 'high',
      isRead: false,
      isDismissed: false,
      feedback: null,
      feedbackNote: null,
      createdAt: '2026-09-15T10:00:00Z',
    },
    {
      id: 'alt-nova-ai-launch',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-novaflow',
      eventId: 'evt-nova-06',
      insightId: 'ins-nova-strategic-01',
      title: 'NovaFlow launched OmniAgent autonomous remediation',
      message: 'NovaFlow launched OmniAgent autonomous incident remediation, moving beyond passive observability into proactive operations.',
      metricChange: 'Autonomous Remediation Launched',
      historicalContext: 'Follows hiring of Staff LLM Reliability Engineers in May 2026 and precedes their September automated rollbacks playbook release.',
      relatedSignals: [
        'AI Engineering Hiring Surge (May 2026)',
        'Self-Healing Playbooks rollout (September 2026)',
      ],
      whyItMatters: 'Direct attack on ApexMetrics operational workflows; enables their sales team to pitch auto-fix capabilities.',
      priority: 'high',
      isRead: false,
      isDismissed: false,
      feedback: null,
      feedbackNote: null,
      createdAt: '2026-06-22T11:00:00Z',
    },
    {
      id: 'alt-orbit-price-hike',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-orbitstack',
      eventId: 'evt-orbit-03',
      insightId: 'ins-orbit-strategic-02',
      title: 'OrbitStack launched eBPF profiler & raised Pro pricing',
      message: 'OrbitStack raised Pro tier pricing from $199 to $249/month (+25%) while establishing continuous eBPF kernel tracing.',
      metricChange: '$199 → $249/month (+25%)',
      historicalContext: 'Part of OrbitStack’s developer-first strategy shift toward open telemetry standards and higher-ARPU engineering squads.',
      relatedSignals: [
        'VP of Developer Ecosystem appointed (July 2026)',
        'OpenTelemetry native exporter launch (May 2026)',
      ],
      whyItMatters: 'Vacates the budget-sensitive tier for ApexMetrics developer expansion.',
      priority: 'medium',
      isRead: true,
      isDismissed: false,
      feedback: 'useful',
      feedbackNote: 'Useful for our sales battlecards in mid-market accounts.',
      createdAt: '2026-06-15T14:30:00Z',
    },
    {
      id: 'alt-pulse-worm-vault',
      workspaceId: DEMO_WORKSPACE_ID,
      competitorId: 'comp-pulseworks',
      eventId: 'evt-pulse-06',
      insightId: null,
      title: 'PulseWorks announced WORM-compliant immutable log storage',
      message: 'PulseWorks launched Write-Once-Read-Many cryptographic storage targeting SEC and FINRA financial compliance.',
      metricChange: 'WORM Vault Compliance Release',
      historicalContext: 'Builds on their previous SOC2 Type II certification and FedRAMP in-process disclosure.',
      relatedSignals: [
        'SOC2 Type II Recertification (June 2026)',
        'FedRAMP In-Process milestone (May 2026)',
      ],
      whyItMatters: 'Strengthens PulseWorks’ moat in regulated banking and defense sectors.',
      priority: 'low',
      isRead: true,
      isDismissed: false,
      feedback: null,
      feedbackNote: null,
      createdAt: '2026-09-18T16:00:00Z',
    },
  ];
}
