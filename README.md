# CompetitorLens — Competitive Intelligence That Remembers

CompetitorLens is a full-stack competitive intelligence system that observes, remembers, and connects competitor moves across time. Rather than treating weekly scans as isolated snapshots, CompetitorLens uses persistent AI memory (Hindsight) and structured reasoning (Gemini) to detect compounding trends, covert positioning pivots, and pricing wars.

---

## 1. Core Workflow

```
[Configured Sources] (Pricing Pages, Changelogs, RSS Feeds)
         │
         ▼
[Source Collector] (SSRF-protected fetcher, HTML/RSS parser, Content Hashing)
         │
         ▼
[Snapshot Storage] (Immutable text & raw content archive)
         │
         ▼
[Normalization & Numeric Engine] (Exact % calculation, equivalent plan matching)
         │
         ▼
[Structured Event Extractor & Evidence Validator]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[Canonical Database Records]             [Hindsight Persistent Memory]
(Events, Evidence, Pricing Diffs)         (Retain observations, Outbox worker)
         │                                         │
         └───────────────────┬─────────────────────┘
                             ▼
               [Ask Across Time / Reasoning Engine]
               (Gemini structured synthesis + Hindsight recall)
                             │
                             ▼
         [Cited Strategic Dossiers & Prioritized Alerts]
```

---

## 2. Key Features

- **Ask Across Time (Signature Feature)**:
  Natural language historical inquiries (e.g., *"How has NovaFlow's strategy changed over the last six months?"*). Answers follow a strict cited structure:
  1. Concise Summary
  2. Chronological Observed Facts with Citations
  3. Historical Pattern Across Time
  4. Business Significance to Our Product
  5. Recommended Next Steps
  6. Uncertainty & Coverage Boundaries
  7. Expandable Memory Context Used

- **Compare With & Without History**:
  A side-by-side demonstration evaluating the exact same event using identical Gemini parameters. Shows why an isolated view sees a routine discount, while persistent memory reveals a calculated multi-stage enterprise displacement campaign.

- **Deterministic Six-Month Demo (35+ Events)**:
  - **NovaFlow**: Enterprise pricing ₹60,000 → ₹50,000 → OmniAgent AI launch → Hyperscale AI foundation model partnership → Enterprise homepage pivot → Dramatic price reduction to ₹35,000 (exact 30% drop) + AI job openings.
  - **OrbitStack**: Developer-first focus; raised Pro plan from $199 to $249 (+25% increase); shipped eBPF continuous kernel profiler and hired VP of Developer Ecosystem.
  - **PulseWorks**: Security and compliance focus; usage-based $0.15/GB log pricing; FedRAMP in-process status; SecureCloud OEM alliance; WORM cryptographic vault.

- **Evidence & Disputed Facts / Corrections**:
  Users can view the exact extracted passage for every citation. When a user submits an accepted correction, the canonical event is invalidated, memory is updated with an accepted correction record, and dependent strategic insights are flagged stale.

---

## 3. Configuration & Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
# Gemini AI
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-3.8-flash"

# Hindsight Persistent AI Memory
HINDSIGHT_BASE_URL="https://api.hindsight.vectorize.io"
HINDSIGHT_API_KEY="your-hindsight-api-key"

# Database (PostgreSQL for durable hosted use; defaults to embedded SQLite preview if omitted)
DATABASE_URL="postgresql://user:password@localhost:5432/competitorlens"

# Secrets
SESSION_SECRET="your-session-secret"
SCHEDULER_SECRET="your-scheduler-secret"
```

*Note: If `HINDSIGHT_API_KEY` or `DATABASE_URL` are not configured, the system gracefully operates in local preview storage mode with clear status badges.*

---

## 4. Running the Application

### Development (Full-Stack dev server on Port 3000)
```bash
npm run dev
```

### Build & Production
```bash
npm run build
npm start
```

### Running the 12-Step Automated Verification Suite
```bash
npx tsx tests/verify-workflows.ts
```

---

## 5. Verification Checklist

| # | Verification Criterion | Status |
|---|------------------------|--------|
| 1 | Demo loading is idempotent (no duplicates on repeated reload) | Verified |
| 2 | Timeline filters return correct competitor & category records | Verified |
| 3 | Baseline snapshots establish reference; identical hashes yield no new events | Verified |
| 4 | Exact numeric calculation: ₹50,000 to ₹35,000 calculates 30.0% reduction | Verified |
| 5 | Mismatched plan terms (e.g. monthly vs annual) rejected as non-comparable | Verified |
| 6 | SSRF protection: Private IPs and localhost addresses blocked | Verified |
| 7 | Historical cutoff excludes future knowledge from answers | Verified |
| 8 | Citations resolve to stored evidence passages | Verified |
| 9 | Accepted corrections invalidate events & mark dependent insights stale | Verified |
| 10 | Workspace scoping prevents cross-workspace data leakage | Verified |
| 11 | Outbox transactionally preserves unsent memory writes | Verified |
| 12 | Compare With & Without History demonstrates multi-month pattern connection | Verified |
