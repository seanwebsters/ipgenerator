# WEBSTER — Architecture

WEBSTER is an entertainment company whose production runs on an autonomous studio. This document describes
what is built (Phase 1), how it works, what needs keys or human approval, and what comes next.

## 1. Three products, one codebase

| Product | Where | What it is |
| --- | --- | --- |
| **WEBSTER WORLD** | `/`, `/watch`, `/read`, `/listen`, `/play`, `/f/[slug]`, `/library`, `/profile`, `/about` | The consumer destination, organised around franchises. Anonymous viewer cookie, maturity limits, favourites, continue-watching, honest per-title disclosures. |
| **WEBSTER OS** | `/os/*` | The founder's command center: Home, IP Universe, Studio Floor, Agent Workforce, Content Calendar, Intelligence, Commercial, Founder Copilot, Approval Inbox, Settings. Session auth + roles (FOUNDER, PRODUCER, ANALYST). |
| **WEBSTER ENGINE** | `engine/*`, `npm run worker` | Durable workflows, Postgres job queue, agents, provider adapters, metering, media assembly, publishing, analytics and learning. |

```
 Founder ──► OS (Next.js server components + server actions)
               │  startRun / decideApproval / settings
               ▼
          Postgres ◄──────── Engine worker(s) ── lease jobs (SKIP LOCKED)
     (canon graph, runs,         │
      steps, jobs, ledger,       ├─ LLM adapter ── Anthropic (messages.parse + Zod) | DEMO (labelled)
      approvals, events)         ├─ Image adapter ── procedural renderer | OpenAI images
               ▲                 ├─ Voice adapter ── ElevenLabs (licensed library voice)
               │                 ├─ FFmpeg ── animatic MP4 + WebM, captions, temp score, ffprobe QA
   WORLD ──────┘                 ├─ Channels ── WEBSTER WORLD | YouTube Data API
   (events API, cookies)         └─ Analytics ── ingest + stats + experiments
```

## 2. Engine

### Durable workflows (`engine/workflow.ts`)
Temporal was not available in the build environment, so the engine implements the same guarantees on Postgres:

* A run is a list of steps persisted in `WorkflowStep`. Each `workflow.advance` job executes **one** step and checkpoints its output; completed steps never re-run, so a crashed worker resumes from the last checkpoint.
* Steps claim themselves with a compare-and-set update; a step stuck `RUNNING` past its lease is reclaimable.
* Outcomes: output → `COMPLETED`; `ctx.approval()` → `WAITING` until the founder (or policy) decides; `ctx.goto()` → bounded revision loops (QA → rewrite); `MissingCredentialError` / `BudgetExceededError` / `PolicyError` → `BLOCKED` with the reason shown on the Studio Floor; other errors → retried with exponential backoff and jitter, then `FAILED`. Provider 4xx errors fail fast, and 401/403 block.
* Every run has a trace id; every step writes `RunEvent`s; every action writes `AuditLog`.

### Queue (`engine/queue.ts`)
`Job` rows leased with `FOR UPDATE SKIP LOCKED`, heartbeated, retried with backoff and dead-lettered. Idempotency keys make enqueueing safe to repeat. `Schedule` rows fire recurring work (analytics ingest, experiment evaluation, housekeeping). Run any number of workers.

### Cost and safety controls (`engine/metering.ts`, `engine/policy.ts`)
Every provider call goes through `meter()`:

1. Circuit breaker per provider: it opens after 3 failures, backs off up to 15 minutes, then tries half-open.
2. Concurrency slot per provider.
3. Budget reservation inside an advisory lock, checked against the daily, monthly and per-run caps. The call is refused *before* it is made.
4. The call itself.
5. A `GenerationRecord` with tokens, units, cost, latency and outcome.
6. The reservation is settled.

The approval policy enforces the autonomy modes. Some actions need the founder in every mode:

* new IP;
* rights, strategy and canon changes;
* mature content;
* anything elevated-risk.

DEMO output is never published outside WEBSTER WORLD.

### Agents (`engine/agents.ts`)
There are 13 permanent departments. Each has a lead agent and specialists, with declared tools and permissions. Each greenlit franchise gets a persistent **Franchise Director** agent. Phase 1 operating departments:

* Chief Studio
* Cultural Intelligence
* Original IP Lab
* Writers' Room
* Visual Development
* Animation & Video
* Music & Audio
* Marketing & Distribution
* Audience Intelligence
* Quality & Safety
* Studio Operations

Games & Interactive and Franchise Development were added in Phase 2.

### Persistent IP memory (`engine/canon.ts`)
`CanonEntity` is a typed graph covering:

* characters, locations, events, rules, arcs;
* style guide, voice profiles, music themes, audience segments.

It also has `CanonRelation` edges and `CanonRevision` history. Each entity has a status: `ESTABLISHED`, `PROPOSED`, `NONCANON` or `DEPRECATED`. `CanonVersion` holds a SHA-256 hash of the established canon for each franchise version.

Every department reads canon through `canonDigest()`. Scripts are validated against canon deterministically. `applyChange()` creates a new version and flags every dependent asset (`AssetEntity`) as `NEEDS_REVIEW`.

### Learning engine (`engine/learning.ts`, `engine/analytics/*`)
* Raw `AnalyticsEvent`s come from WEBSTER WORLD, plus YouTube Analytics when connected. The viewer id is taken from an httpOnly cookie, and experiment variants are re-derived server-side.
* Ingestion produces `MetricSnapshot`s. Play rates carry 95% Wilson intervals.
* The learning review records `Learning`s. Their confidence is capped by sample size, whatever the model says. The review then proposes one `Experiment`: an A/B test with hypothesis, design, metric, power-based sample size, confounders and variants.
* Experiments run by deterministic per-viewer assignment. They are evaluated with a two-proportion z-test and **never** conclude below the planned sample size.
* Internal automated QA sessions (`qa-` viewer ids) are tagged and called out wherever metrics appear.
* Learnings are retrieved into later prompts (`learningsFor()`); no model is retrained.

## 3. The Phase 1 vertical slice

| # | Step | Department | Implementation |
| --- | --- | --- | --- |
| 1 | Founder brief | Copilot | NL → structured intent (`copilot.intent`) → `ip.discovery` run |
| 2 | Opportunity briefs | Cultural Intelligence | Evidence records with source kind; marked unverified without web access |
| 3 | N original concepts | Original IP Lab | Structured output (Zod) |
| 4 | Scoring + originality | IP Lab + Quality | Weighted scores; deterministic protected-property screen + model concerns |
| 5 | Greenlight | Founder | `NEW_IP` approval, pick up to N |
| 6 | Franchise + director | Chief Studio | Workspace, Franchise Director agent, child `franchise.pilot` run per pick |
| 7 | Canon bible | IP Lab | Validated, written to the graph, canon v1 hashed |
| 8 | Pilot script | Writers' Room | Uses canon; learnings retrieved |
| 9 | Continuity | Quality | Deterministic canon check; up to 2 rewrites |
| 10 | Storyboard + key art | Visual Development | Shot plan → frames (procedural or OpenAI) with provenance and rights metadata |
| 11 | Score / voices | Music & Audio | FFmpeg temp score; ElevenLabs library voice if configured |
| 12 | Animatic | Animation & Video | FFmpeg: Ken Burns, crossfades, burned captions, VTT, MP4 + WebM |
| 13 | QA | Quality & Safety | ffprobe technical checks, loudness, narrative critique, suitability vs rating, rights, originality; bounded revision |
| 14 | Release package | Marketing | Metadata + AI disclosure built from provenance |
| 15 | Publish gate | Founder / policy | `PUBLISH` approval with preview, QA report, costs, channel status |
| 16 | Publish | Marketing | WEBSTER WORLD (WATCH + illustrated READ title); YouTube when connected; otherwise recorded as skipped |
| 17 | Measure | Audience Intelligence | Ingest schedule + delayed learning review |
| 18 | Learn | Audience Intelligence | Findings + experiment proposal → approval or auto-start per policy |

## 4. What works now vs. what needs keys or approval

| Capability | Works with no keys | Needs |
| --- | --- | --- |
| Full pipeline, persistence, approvals, OS, WORLD | ✅ (writing via the **DEMO** generator, labelled everywhere) | — |
| Real creative writing, scoring, critique | — | `ANTHROPIC_API_KEY` (model `claude-opus-5-5`) |
| Storyboards / key art | ✅ procedural renderer (non-AI, owned) | `OPENAI_API_KEY` + route `visual.*` → `openai` for AI imagery |
| Animatic assembly, captions, QA | ✅ FFmpeg | — |
| Voiced dialogue | — | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` (licensed library voice) |
| Publishing to WEBSTER WORLD | ✅ | Founder approval (Assisted) or policy (Supervised/High) |
| Publishing to YouTube | — | OAuth client + refresh token; DEMO content is never uploaded; default privacy `private` |
| YouTube analytics ingest | — | Same OAuth (`yt-analytics.readonly`) |
| TikTok, Instagram | — | Not implemented: requires audited apps (see matrix) |

## 5. Integration matrix

| Provider | Status | API (documented) | Notes |
| --- | --- | --- | --- |
| Anthropic Claude | Implemented | Messages API `messages.parse` + `zodOutputFormat` | Refusals block for human review; tokens metered at list price |
| OpenAI Images | Implemented, untested in CI | `POST /v1/images/generations` (`gpt-image-1`, `b64_json`) | Price not returned; budgeting estimate configurable |
| ElevenLabs | Implemented, untested in CI | `POST /v1/text-to-speech/{voice_id}` | Only a configured library voice; no cloning |
| YouTube Data API v3 | Implemented, untested in CI | Resumable `videos.insert`, `status.containsSyntheticMedia` | Unverified API projects can only upload private |
| YouTube Analytics v2 | Implemented, untested in CI | `reports.query` | views, minutes watched, avg duration, shares, likes |
| TikTok Content Posting | Not implemented | Needs an audited app | Planned |
| Instagram Graph publishing | Not implemented | Needs Meta review + public media URLs | Planned (needs public object storage) |
| FFmpeg | Implemented | — | `FFMPEG_PATH` override |
| Object storage | Local driver | S3-style keys | S3/R2 driver planned behind the same interface |

## 6. Data model (Prisma, `prisma/schema.prisma`)

* **Identity & settings:** `User`, `Session`, `StudioSettings`, `ProviderCredential` (encrypted), `ProviderState` (circuit + concurrency), `ModelRoute`.
* **IP graph:** `Universe`, `Franchise`, `Brief`, `OpportunityBrief`, `Concept`, `CanonEntity`, `CanonRelation`, `CanonRevision`, `CanonVersion`.
* **Production:** `Production`, `Script`, `Asset` (provenance: provider, model, prompt, seed, params, revision, rights), `AssetEntity`.
* **Engine:** `Agent`, `WorkflowRun`, `WorkflowStep`, `RunEvent`, `Job`, `Schedule`, `GenerationRecord`, `SpendReservation`, `AuditLog`, `Notification`.
* **Approvals:** `Approval` (kinds NEW_IP, PUBLISH, SPEND, RIGHTS, STRATEGY, EXPERIMENT, CANON_CHANGE).
* **Distribution:** `Channel`, `Release`, `Publication` (idempotent per release × channel).
* **WORLD:** `WorldTitle`, `Viewer`, `PlaybackProgress`, `Favorite`.
* **Analytics & learning:** `AnalyticsEvent` (append-only, warehouse-ready), `MetricSnapshot`, `Experiment`, `ExperimentVariant`, `ExperimentResult`, `Learning`.
* **Commercial:** `Opportunity`, `Revenue` (real revenue only).

## 7. Phased plan

**Phase 1 (this build).** The vertical slice end to end, along with:

* Founder OS (all ten sections) and WEBSTER WORLD;
* durable engine, metering, autonomy policy;
* tests and CI.

**Phase 2 (delivered).**

* **Canon changes:** characters can be edited from the franchise workspace. A change creates a `CANON_CHANGE` approval showing before/after and its impact. Approving it applies the change and creates a new hashed canon version. Dependent assets are flagged `NEEDS_REVIEW`, and the workspace has a Quality review queue (Still canon / Retire).
* **Franchise Development (`franchise.develop`):**
  1. Measured evidence (metrics with intervals, QA share, measured run costs) feeds the proposals.
  2. Opportunities carry cost estimates derived from real completed-run spend, and the basis is recorded.
  3. A founder `STRATEGY` decision picks which ones to make.
  4. The chosen productions are commissioned.

  Merchandise and licensing are proposal-only: never produced, never committed.
* **New formats:**
  * Episodes reuse the pilot pipeline with continuity context.
  * Comics (`franchise.comic`) are composed from *approved* storyboards into print-size pages and published as READ titles.
  * Interactive stories (`franchise.interactive`) are branching graphs validated as software: no dangling choices, dead ends, unreachable nodes or inescapable loops; at least two endings; playthroughs counted. Each node is illustrated, and the result is published as a PLAY title with a player on WEBSTER WORLD.
* **Shared release steps:** all formats share the publication gate, publishing and measurement steps. Disclosures are generated from provenance.
* **Autonomous flywheel (`studio.flywheel`):** off by default. It starts development cycles for idle live franchises on an interval, and each cycle still ends at the founder.
* **Learning hygiene:** there is a minimum audience before experimenting (`LEARNING_MIN_VIEWERS`, default 20) and one open experiment per franchise.

**Phase 3 (next).**

* Remotion compositions for motion graphics.
* S3/R2 storage.
* Cultural Intelligence with a real web-search tool and citations.
* Poster/thumbnail experiments.
* Founder goals per franchise.

**Phase 4.**

* Music releases and audio dramas (LISTEN).
* Real-time games beyond branching stories.
* TikTok and Instagram once apps are audited.
* Localisation.
* Merchandise concepts.
* Portfolio-level budget allocation in High-autonomy mode, under explicit policy.

## 8. Honesty rules enforced in code

* There are no seeded franchises, metrics or revenue. Everything visible was produced or measured by the system.
* DEMO output is labelled at every level: concept, franchise, script, release, title. It never leaves WEBSTER WORLD.
* Unconnected channels are recorded as `SKIPPED_NOT_CONNECTED` with setup instructions, never as a success.
* Every title shows a disclosure built from asset provenance. YouTube uploads set `containsSyntheticMedia`.
* Confidence is capped by sample size. Experiments cannot conclude below their planned sample. QA traffic is flagged.
