# Enterprise Gap Analysis — BPO-HRWeb

**Audit date:** 2026-10-05
**Repo state:** `c68b4f4` (working tree clean)
**Stack:** Next.js 16 (App Router) · React 19 · Drizzle ORM 0.45 · PostgreSQL (Neon) · NextAuth v5 (JWT) · Tailwind v4 · Vitest 5 · Vercel
**Verification basis:** full source read (all 90 source files), `npm test` (49/49 pass), `tsc --noEmit` (0 errors), `eslint` (0 errors), plus authoritative-source checks (DOLE, BIR, SSS, PhilHealth, HDMF) documented in §4.

> **Status 2026-10-05:** Phase 1 exit fixes applied — de minimis caps/RD_SUB (§2.8/§4 ✅), SSS effective date + source ref, `/setup` gate, dashboard role gate, net invariant, payroll state machine, 5k truncation, overnight anchor, CI. §2.8 rows for those items now reflect the fixed state; everything else unchanged.

Severity = impact on payroll correctness, data integrity, security, or the stated 10k–50k scale target.

---

## 1. Executive summary

The codebase is a **solid single-tenant HR/payroll prototype with a correct core calculation library**, but it implements roughly **15–20% of the target enterprise system**. The strongest parts (money/centavo conventions, statutory math, pure attendance calculation, effective-dated config tables, 49 passing unit tests) must be preserved. The weakest parts are structural, not cosmetic:

1. **No immutable punch layer** — punches are written directly into mutable `attendance_day` rows.
2. **No leave module, no audit system, no RBAC granularity, no worker/queue, no reports, no ESS, no supervisor portal** — 7 of the 36 target domains are entirely absent.
3. **Payroll produces no `payroll_line` records** — there is no calculation trace, no explanation engine, and no payslip revision history.
4. **Overnight (22:00–06:00) kiosk punch-out is rejected after midnight** — a blocking bug for the core BPO night-shift scenario (see ARCHITECTURE_REVIEW §B1).
5. **Statutory de minimis ceilings are stale vs. RR 29-2025** and one citation is wrong (see §4).

Existing 49 tests, the pure `calcEmployee`/`computeDay` functions, the centavo-money convention, and the effective-dated statutory schema are **good architecture and must not be rebuilt**.

---

## 2. System gap matrix

### 2.1 Identity, security, authorization

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Authentication | NextAuth credentials, JWT sessions, scrypt password hash. No lockout, no MFA hook, no session rotation. | Same + brute-force lockout, MFA-ready claims, session revocation. | MEDIUM | Account takeover via credential stuffing | Add per-account + per-IP login attempt throttling (DB table); store `employeeId` in session claims; keep scrypt. |
| RBAC | 4 flat roles (`ADMIN/HR/PAYROLL/EMPLOYEE`) via `requireRole`. No permissions, no scopes, no supervisor role. | Permission strings (`payroll.post`, `attendance.correct`, …) + org scoping (GLOBAL/COMPANY/SITE/CAMPAIGN/DEPT/TEAM/SELF). | CRITICAL | Every future feature will hardcode roles; supervisor workflows impossible | Add `role_permission` + `user_role` (multi-role) tables, `requirePerm(perm, scope)` helper; migrate existing `requireRole` call sites. |
| `/setup` page gate | **No `requireRole` on the page** (`setup/page.tsx:72`); any logged-in EMPLOYEE can read org data and office IPs. Mutations are gated. | Page-level gate ADMIN/HR. | HIGH | Broken access control (read-side) | Add `requireRole("ADMIN","HR")` at page top. Regression test. |
| Dashboard data exposure | `/` shows company payroll total, salary sum, full roster to **any** role incl. EMPLOYEE (`page.tsx:41,76`). | Role-scoped widgets; EMPLOYEE sees only self-relevant data (or is routed to ESS home). | HIGH | Sensitive data leakage to all employees | Split dashboard by role or gate metric queries by role. |
| Edge auth | `proxy.ts` checks cookie *presence* only; `/api/*` excluded from matcher (API routes must self-auth — both current routes do). | Verified session in edge where cheap; documented per-route auth contract. | MEDIUM | Regression risk as API surface grows | Keep authoritative server-side checks; add a route-auth test matrix. |
| Rate limiting | **None anywhere.** Bundy PIN (4–6 digits) unlimited attempts from allowlisted IP; no login throttle. | Rate limits on `/login`, `/bundy`, ingestion API. | HIGH | PIN brute force → attendance fraud | DB-backed counter + cooldown (ponytail: no Redis needed at this stage). |
| Client IP trust | `lib/bundy.ts` trusts `x-forwarded-for` first. | Trust proxy hop config; document Vercel header contract. | MEDIUM | Allowlist bypass if deployed behind untrusted hop | Prefer last trusted hop; document deployment requirement. |
| Security headers/CSP | `next.config.ts` empty. No CSP/HSTS/X-Frame-Options. | CSP, HSTS, frame-deny, referrer policy. | MEDIUM | XSS/clickjacking surface | `headers()` in next.config. |
| Multi-tenancy | **No `company` table at all.** Single implicit tenant. Sites not modeled. | Company + site entities; tenant scope on every tenant-scoped table + server-side filter. | HIGH (if SaaS target) | Cross-tenant leakage would be structural | Decide: single-entity vs SaaS **before** Phase 4. Affects every table. |
| IDOR | Employee/payslip routes validate ids + roles; no cross-employee read path found. Payslip route lacks `Number.isInteger` check (NaN → driver error). | Uniform param validation. | LOW | Information error, inconsistent 404 | Add integer guard (pattern already exists in `employees/[id]`). |

### 2.2 Core HR / organization

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Employee master | One flat `employee` table: identity + org + salary + statutory IDs + bundy PIN + shift. | 201-file decomposition: `employee` (identity/status), `employee_employment`, `employee_compensation_history` (effective-dated), `employee_government_id`, `employee_bank`, `employee_dependent`, `employee_document`, `employee_emergency_contact`. | HIGH | Salary changes overwrite history — no compensation/audit trail; payroll disputes unprovable | Phase 4: effective-dated compensation + employment tables; backfill current values as row 1. |
| Company / site | Absent. | `company`, `site` tables; employee + campaign + device scoped to site. | HIGH | Required by spec (multi-company/multi-site) | Decide in Phase 2/4 (see multi-tenancy above). |
| Org units | cost_center, campaign, department, job_position exist with hierarchy (parent_id) and CRUD in `/setup`. No teams, no job levels beyond `job_level` smallint, no org chart, no effective dating of assignments. | Effective-dated org assignments + transfer/promotion workflows + org chart. | MEDIUM | Org changes are destructive overwrites; history not auditable | Add `employee_org_assignment` (effective-dated); keep current columns as denormalized current-state. |
| Employment events | Only `date_hired/regularized/separated` + status enum. No regularization/transfer/promotion/suspension/LOA/separation records. | Event ledger (`employment_event`) with effective dates, approvers, documents. | MEDIUM | No auditable movement history | New table + minimal HR workflow in Phase 4. |
| Employee documents | Absent. | Document vault: versioning, ACL, expiry, acknowledgements. | MEDIUM | Spec module 18 missing entirely | Phase 4+/18 — private object storage + signed URLs. |
| Emergency contacts / dependents / skills / certifications | Absent. | Child tables. | LOW | Spec completeness | Defer; add with 201-file refactor. |

### 2.3 Scheduling

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Shift model | `shift_template`: fixed wall-clock window + optional breaks; **one shift per employee** (`employee.shift_template_id`). No rotations, no per-date assignment, no split/compressed/flexi, no rest-day scheduling. | `shift_definition` + `shift_leg` + materialized `schedule_day` per employee-date with revisions; rotation patterns; templates; conflict detection. | CRITICAL | Cannot run 24/7 rotating BPO rosters; attendance has no per-day schedule to match against | Phase 5: build materialized `schedule_day` (spec §1.3) — everything downstream (attendance, payroll accuracy) depends on it. |
| Schedule history | None — assigning a shift rewrites the pointer. | Effective-dated revisions (`valid_from/valid_to`, `revision`), override records, acknowledgement. | HIGH | Historical schedules not auditable/payroll-dispute proof | Per spec §1.3. |
| Rest days | `employee.weekly_rest_days smallint[]` — static weekly pattern. | Per-day rest flags on `schedule_day`; weekly pattern only as generator input. | HIGH | Rest-day premium correctness depends on this | Migrate to schedule-day `is_rest_day`. |
| Calendar/bulk UI | Assignment dropdown only, 25-row paginated table. | Calendar/team/campaign views, bulk assign, conflicts, publish/acknowledge. | MEDIUM | Usability gap for HR at scale | Phase 5 UI after data model lands. |

### 2.4 Attendance / DTR

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Raw punch layer | **Absent.** Bundy + manual entry write punch timestamps *into* `attendance_day` columns and UPDATE them in place. | Append-only `punch_raw` (partitioned, idempotency key, device ref) + derived `attendance_day`. | CRITICAL | History mutable; no provenance; corrections are silent overwrites; recompute impossible | Phase 6: introduce punch table; keep `attendance_day` as derived; migrate existing punches as `source='MIGRATION'` baseline. |
| Overnight shift punch-out | **Broken:** kiosk anchors `work_date = today (Manila)`; OUT punch at 06:07 next day creates/finds *tomorrow's* row → "Record your In punch first" → **punch rejected** (see ARCHITECTURE_REVIEW B1). | Operational-date rule: resolve punch to scheduled shift anchor date. | CRITICAL | Night-shift BPO cannot clock out | Depends on `schedule_day` (Phase 5→7); interim fix: resolve anchor from existing row with open IN punch. |
| Attendance correction workflow | HR edits rows directly via `saveAttendanceDay` (`onConflictDoUpdate`). No request/approve/compensate chain, no audit. | REQUEST → SUPERVISOR → HR → COMPENSATING RECORD → RECOMPUTE → AUDIT (spec module 9). | CRITICAL | Historical attendance silently rewritten; payroll disputes unresolvable | Phase 7: correction table + workflow; direct edit removed or restricted to break-glass with audit. |
| Late / grace tiers | Late = raw seconds past shift start; no grace period configuration; no FLEX/FLAG/DEDUCT tiers (spec §2.2 `grace_tier` absent). | Configurable grace tiers per campaign/shift/employee. | MEDIUM | Real BPOs run 5–15 min grace; current model over-reports tardiness | Add `grace_tier` table; apply in `computeDay`. |
| Undertime → pay | Recorded (`undertimeSeconds`) but **never affects pay** (only full-day absences deduct). Daily/weekly-paid employee working 4h is paid a full day. | Daily-paid: deduct unpaid hours; monthly: company-policy undertime deduction. | HIGH | Systematic overpayment for daily-paid staff | Policy decision + calc change (see ARCHITECTURE_REVIEW B4). |
| OT approval | `otApprovedSeconds` written as "everything" (`attendance/actions.ts:205`); never read by payroll. No OT request/approval flow. | Supervisor OT approval clamping `ot_worked` vs `ot_unapproved`; campaign `ot_authorization_mode` exists in schema but unused. | HIGH | Unapproved OT is paid; approval modes dead config | Phase 7/13: OT request table + clamp in calc. |
| Missing/absent days | **No absence generation.** An employee who never punches simply has no `attendance_day` row → `daysAbsent = 0` → **paid full basic for the cutoff**. | Roster-driven day generation: scheduled day + no punches + no leave ⇒ ABSENT row. | CRITICAL | Direct overpayment; the most severe payroll correctness bug | Phase 7: generate attendance days from `schedule_day` during timekeeping step. |
| Break model | Hardcoded 3 break pairs as columns (`break1/lunch/break2`). | Variable legs from shift definition; punches matched to segments. | MEDIUM | Schema rigidity (split shifts impossible) | Resolved by punch + shift-leg refactor. |
| Manual attendance entry | Works for overnight (rolls times forward), auto-approves OT, sets `presenceBeforeHoliday` from **previous calendar day only** (not previous *workday*). | Presence check: last workday before holiday (skip rest days/leaves per DOLE Labor Advisory 12-25). | MEDIUM | Wrong unworked-holiday pay in edge cases | Fix predicate to walk back over scheduled workdays once roster exists. |
| DTR view | Attendance page = one-day log, 200 rows, edit form. No per-employee DTR, no period view, no exception queue. | Employee/team DTR with source punches + correction history. | MEDIUM | Spec module 7 partially missing | Phase 7 UI. |

### 2.5 Biometric / Bundy

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Device registry | **Absent.** Only `bundy_ip` allowlist (IP + label). | `biometric_device`: serial, site, status, heartbeat, firmware, key hash, ingestion metrics. | HIGH | No device identity, no health, no key rotation | Phase 6 (spec §1.4). |
| Ingestion API | Web kiosk server action only. No batch/HMAC endpoint, no queue, no idempotency, no duplicate tolerance. | `POST /api/v1/punches` HMAC-signed, idempotency key, 202 + queue, DLQ, clock-skew flags. | HIGH | Cannot attach real biometric fleet; burst traffic would hit app server directly | Phase 6. DB-backed queue acceptable first (no Kafka at this volume — see ARCHITECTURE_REVIEW C5). |
| Punch duplication | Slot-based: second punch in same slot rejected with message. No 60s duplicate window across slots/devices. | Idempotency by (device, code, ts, direction); duplicate tolerance. | MEDIUM | Double-tap creates bogus break pairs | Solved by punch_raw unique index. |
| Kiosk auth | EmployeeNo + PIN (scrypt) + IP allowlist. Error messages confirm valid employeeNo+PIN combos; no attempt limits. | Generic errors + rate limit + attempt lockout. | HIGH | Enumeration + brute force | Phase 3. |
| Web Bundy scheduling awareness | Requires `shift_template_id`; ignores rest days (still requires shift), ignores per-date schedule. | Punch accepted against that date's scheduled window; unscheduled punch → flagged. | MEDIUM | Rest-day / no-rest-day punches mis-handled | Phase 5–7. |

### 2.6 Leave

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Leave domain | **Entirely absent.** No `leave_type/leave_ledger/leave_application` tables, no UI. `attendance_status` has LEAVE/LWP values and payroll counts `daysLeavePaid`, but **no data can ever produce them**. | Full module 10: types, policies, accrual ledger (idempotent), applications, approval chain, posting, payroll consumption, carryover/expiry. | CRITICAL | Spec module 10 missing; `ON_LEAVE` status is decorative | Phase 8. Ledger-first design per spec §1.6 with `ux_ledger_dedupe`. |
| Payroll ↔ leave | `daysLeavePaid` read from attendance rows that can only be created manually with status=LEAVE; no ledger debit; no leave pay line. | Posted leave → attendance override + `LEAVE_PAY` earning + idempotent ledger debit. | CRITICAL | Double-debit risk once leave is introduced | Build ledger before any payroll leave logic. |

### 2.7 Payroll

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Calculation engine | Pure `calcEmployee` — deterministic, well-tested (basic/absence/allowances/SSS/PHIC/HDMF/BIR/premiums/NSD). **Good — preserve.** | Same core + lines + traces + missing domains below. | — | — | Extend, don't rewrite. |
| Payroll lines / explanation | **`payroll_line` table exists but is never written.** Payslip reads only aggregate `payroll_run_item` columns. No formula/basis/rate/source refs, no "why" UI. | Itemized lines per employee per run (code/label/amount/basis/rate/formula/source_ref/calc version) + explanation panel (spec module 12). | CRITICAL | No auditability; payslips unverifiable; spec's central requirement | Phase 11: emit lines inside `calcEmployee` (pure → lines array), write with run items. |
| Payslip revisions | `payslip_revision` table exists, **never written**. No checksum, no PDF, no employee-portal access. | Render → revision payload + checksum; secure download; ESS view (module 13). | HIGH | Immutable payslip guarantee is fiction | Phase 11. |
| Job queue | `payroll_job` table exists; **no worker.** Whole calculation runs synchronously inside one server action (Vercel request); `limit(5000)` silently truncates employees; progress endpoint polls counters updated in-request. | Background worker(s), SKIP LOCKED claim, retry/DLQ, progress from DB. 10k employees < 10 min, 50k horizontal scale. | CRITICAL | Serverless timeout at target scale; silent headcount truncation at 5,001+ employees | Phase 9: worker process (separate entrypoint) + remove `limit(5000)` → paged cursor. |
| Run state integrity | `calculateRun` allowed from any status except POSTED/VOID → **an APPROVED run can be recalculated**, wiping approval (`approvedBy:null`) and totals. `finally` block marks run `CALCULATED` **even when the loop threw** (partial/zero data published as success). | State machine enforcement: calculate only from OPEN/CUT_OFF/CALCULATED/REVIEW; FAILED state on error; advisory lock per run. | CRITICAL | Approval bypass; silent partial payroll | Fix transitions + add FAILED status (ARCHITECTURE_REVIEW B2). |
| Rerun safety | Delete-then-insert run items (not lines — none exist). No transaction per run; crash mid-loop leaves deleted items + CALCULATING status resolved to CALCULATED with partial data. | Idempotent per-employee upsert inside worker transactions; reruns replace only non-POSTED runs; deterministic replay from frozen config. | HIGH | Partial runs presented as complete | Phase 9. |
| Net-pay invariant | `netPay = Math.max(0, gross - deductions)` — **negative net silently clamped to 0**, breaking `net = gross − deductions`; status set to REVIEW but numbers are wrong. | Compute raw net, flag REVIEW/hold, never falsify the amount. | HIGH | Payslip mathematically inconsistent | ARCHITECTURE_REVIEW B3 (quick fix). |
| Statutory config selection | Latest schedule `effectiveFrom ≤ period.dateTo` — ignores `effectiveTo`; single seed row per agency (no historical versions); BIR variant hardcoded `NON_MANAGERIAL` (employee `isManagerialTaxTbl` dead). | Effective-dated range selection with overlap check; per-run variant from employee/position; config gap warnings in pre-flight. | HIGH | Law change = data migration; currently untestable date selection | Fix selector + seed 2025 rows for tests (Phase 10). |
| Missing pay elements | No loans/advances, bonuses, 13th month, final pay, off-cycle, employer-contribution **reporting** (computed but never surfaced per employee beyond payslip card), adjustments (table unused), variance, pre-flight. | Spec modules 11, 15, 16, 33, 34. | HIGH | Core payroll feature gaps | Phases 9–11, 15. |
| Pay frequency coverage | SEMI_MONTHLY/MONTHLY/WEEKLY/DAILY supported in calc. Employee selection filters by family — correct. | Same + off-cycle/final-pay runs. | LOW | — | Later. |
| Holiday unworked pay | Paid explicitly only for DAILY/WEEKLY (`calc.ts:164-168`); fixed-salary employees rely on embedded monthly share — **correct DOLE treatment for monthly-paid**, but SEMI_MONTHLY is "fixed monthly split" too, so also correct. Verified OK. | Keep; document. | LOW | — | Test only. |
| Payroll pre-flight | Absent. | Readiness checks: missing salary/schedule/punches/IDs/statutory config/negative net (module 34). | HIGH | HR discovers data gaps mid-run | Phase 9. |
| Variance engine | Absent. | Current vs previous run comparison + flags (module 33). | MEDIUM | Silent pay anomalies | Phase 14. |

### 2.8 Statutory compliance (verified — see §4)

| Item | Current State | Verified Position (Oct 2026) | Severity | Required Work |
|---|---|---|---|---|
| SSS 2026 | 15% (5/10), MSC ₱5k–₱35k, step ₱500, WISP ₱20k, EC ₱10/₱30 @₱15k | **Correct.** Schedule effective **2025-01-01**, unchanged for 2026. | MEDIUM | Fix `effectiveFrom` → 2025-01-01; fix bogus `sourceRef` (currently cites the *holiday* proclamation); add 2024 row for date-selection tests. |
| PhilHealth 2026 | 5%, ₱10k–₱100k floor/ceiling, 50/50 | **Correct** (PhilHealth advisory 2025-05-06; PIA). | LOW | Record advisory reference + `date_verified`. |
| Pag-IBIG 2026 | 2%/2%, ₱10k MFS, ₱200 cap | **Correct** (HDMF Circular 460). EE 1% tier ≤₱1,500 not modeled — irrelevant for BPO salaries but incomplete. | LOW | Add EE-rate tier rule for completeness. |
| BIR table | TRAIN annual brackets correct; periodic tax derived by annualization with exact residual split (tested: sum(periodic)=annual) | **Correct** (NIRC §24 / RA 10963 / RR 11-2018). | LOW | Add managerial variant seed + selection. |
| Premium matrix | 12 rows: 100/130/130/150/200/260 first-8h; OT 1.25/1.69/1.69/1.95/2.6/3.38 | **Correct** per DOLE Labor Advisory No. 12-25 (s. 2025) for CY2026 (special OT = 130%×130% = 169%, RH+rest OT = 338%). | LOW | Cite Labor Advisory 12-25 exactly; add `date_verified`. |
| Holidays 2026 | 18 dates, all matching **Proclamation No. 1006 (s. 2025)** | **Correct** (10 regular + 8 special non-working). | MEDIUM | Missing: Eid'l Fitr / Eid'l Adha 2026 (separate proclamations — must be added when declared); Feb 25, 2026 special *working* day (informational row). |
| De minimis ceilings | RICE ₱1,500/mo; CLOTHING ₱6,000/yr; LAUNDRY ₱300/mo; MEDICAL ₱10,000/yr; GIFT **₱9,000**/yr; ACHIEVE ₱10,000/yr; RD_SUB "representation" non-taxable ₱1,000/mo | **STALE / WRONG.** RR 29-2025 (eff. 2026-01-06): rice ₱2,500/mo, uniform ₱8,000/yr, laundry ₱400/mo, medical ₱12,000/yr, gifts ₱6,000/yr, achievement ₱12,000/yr. GIFT ₱9,000 matches no regulation. Representation allowance is **not** a de minimis category (taxable). | HIGH | Re-seed allowance caps from RR 29-2025 with `sourceRef` + `date_verified`; reclassify RD_SUB as taxable. |
| MWE exemption | Seed hardcodes `isMinimumWageExempt = salary < ₱16,000` | Should reference the applicable NCR/regional minimum wage × applicable factor (data, not a magic 16,000). | MEDIUM | Move threshold to config data keyed by region + effective date. |
| 13th month | Not implemented. Non-taxable aggregate ₱90,000 confirmed still current. | Module 15 missing. | HIGH | Phase 15 as separate calculation domain. |
| Statutory reporting (SSS R-3, PhilHealth, HDMF, BIR 1601/2316/Alphalist) | Absent. | Module 14 missing — must not fabricate file formats. | HIGH | Research official specs before building; separate CALCULATION/REPORTING/SUBMISSION. |

### 2.9 Cross-cutting

| Module | Current State | Target State | Severity | Risk | Required Work |
|---|---|---|---|---|---|
| Audit logging | **None.** No audit table, no actor/action/before/after records; zero `console`/logger usage in `src/`. | Append-only `audit_log` (actor, action, entity, before/after, IP, UA, request id, ts) + admin viewer (module 20). | CRITICAL | Regulatory/dispute exposure; impossible to answer "who changed this" | Phase 3 (foundation) — wire into every mutating action. |
| Notifications | Absent (toaster component present but unused). | In-app + email, templates, preferences (module 19). | MEDIUM | Approval workflows unread | Phase 13+. |
| HR request center | Absent (module 17). | Unified request/approval object. | MEDIUM | — | Phase 12–13. |
| Reports / exports | **None.** No CSV/XLSX/PDF, no async export. | Spec module 32; async for large exports. | HIGH | HR cannot extract data → shadow spreadsheets | Phase 14. |
| Queue / workers | Only `payroll_job` table, unused as a queue. | Generic job table + worker loop (DB SKIP LOCKED) for payroll, recompute, notifications, exports. | CRITICAL | Any heavy work times out the request | Phase 9. |
| Observability | None: no structured logging, no request IDs, no metrics, no health dashboard. | JSON logs w/ request+job ids; admin health page (module 29). | HIGH | Blind in production | Phase 15. |
| API architecture | 2 API routes (`auth`, payroll progress), no versioning, no envelope, no pagination contract, no idempotency keys. | `/api/v1/*` with envelope, pagination, validation, auth matrix (module 24). | MEDIUM | Ad-hoc growth | Phase 14 (as features need it). |
| Error handling | Silent by design (no logging anywhere). Server actions redirect with `?error=` strings. | Stable error codes + logged context + safe user messages (module 43). | HIGH | Failures invisible | With Phase 15 logging. |
| Tests | 49 unit tests: money, statutory, computeDay, calcEmployee, form parsing. **No** integration/API/auth/DB/E2E tests; no rerun-determinism, no overnight-kiosk, no rest-day/holiday OT bucket assertions, no golden-suite. | Spec modules 39–41: golden payroll suite, property invariants, integration + E2E, concurrency. | HIGH | Regressions ship silently | Grow per phase; golden suite before first real payroll. |
| Migrations | Single initial Drizzle migration; `db:push` available (dangerous on prod data). | Reviewable migrations, expand→backfill→constrain strategy (module 48). | MEDIUM | `db:push` can drop/alter prod data | Ban `db:push` on prod; use `db:migrate` only. |
| CI/CD | **No `.github/`, no pipeline.** Vercel git deploy only. | PR CI: lint + typecheck + tests + migration check; preview envs. | HIGH | Broken code can deploy to prod | Phase 18 (but cheap — add now). |
| Docs / runbooks | No `docs/` before this file; ARCHITECTURE.md exists but diverges from code (see ARCHITECTURE_REVIEW §A). | Full doc set per spec §56. | MEDIUM | Onboarding/DR risk | Track through phases. |
| Data retention / DR | None documented. Neon PITR available but unverified. No backup/restore test. | Retention policy + DR runbook w/ RPO/RTO (modules 44–45). | HIGH | Data loss / legal retention breach | Phase 18. |
| Seed/test data | 124 demo employees (`@hrweb.test`), no attendance/schedule/payroll seeds; `TODAY="2026-10-04"` hardcoded in seed-org. | Volume datasets (10k/25k/50k) + golden fixtures (module 28/41). | MEDIUM | Cannot validate scale claims | Phase 16/17. |
| Dead schema | `punch_raw`-class tables, `leave_*`, `grace_tier`, `schedule_*`, `biometric_device` **do not exist** (only in ARCHITECTURE.md). Conversely `payroll_line`, `payslip_revision`, `payroll_adjustment`, `payroll_job` exist **unused**. | Schema matches implemented behavior at every phase. | HIGH | False confidence from reading schema alone | Reconcile per phase (this audit is the baseline). |

---

## 3. What is already good (preserve)

1. **Integer-centavo money convention** (`lib/money.ts`) with `roundHalfUp`, period-split with exact residual — no floating-point pesos anywhere.
2. **Pure, deterministic `calcEmployee`** — side-effect free, unit-tested, config injected (this is the right shape for the payroll engine).
3. **Pure `computeDay`** timekeeping with Manila-anchored windows and midnight-safe overnight handling *at the library level*.
4. **Effective-dated statutory tables** (`sss/phic/hdmf/bir/premium_matrix/holiday`) with `source_ref`, snapshotted into `payroll_run.config_snapshot` — statutory-as-data is already real, not aspirational.
5. **Premium matrix values match DOLE Labor Advisory 12-25** (verified §4).
6. **BIR periodic withholding** derives from the annual table with exact residual reconciliation — tested for all frequencies.
7. **SSS MSC midpoint rounding** implemented correctly (₱5,249.99→₱5,000; ₱5,250→₱5,500).
8. **PK/uniqueness discipline**: `attendance_day (employee_id, work_date)`, `payroll_run (period_id, run_no)`, `payroll_run_item (run_id, employee_id)` — rerun-safe shapes already in place.
9. **Server-side authorization on every mutating action** (one read-side exception: `/setup`).
10. **49 passing tests**, `tsc` clean, lint clean.

---

## 4. Compliance verification log

| Config | Verified value (as of 2026-10-05) | Authoritative source | Repo status |
|---|---|---|---|
| SSS total/EE/ER | 15% / 5% / 10% | RA 11199; SSS contribution schedule eff. 2025-01-01 (still current for 2026) | Values ✅, `effectiveFrom` says 2026-01-01 ⚠️, `sourceRef` cites holiday proclamation ❌ |
| SSS MSC range/step | ₱5,000–₱35,000, ₱500 step | SSS circular (schedule eff. 2025) | ✅ |
| SSS WISP threshold | MSC > ₱20,000 to WISP/MPF | RA 11199; SSS WISP rules | ✅ |
| SSS EC | ₱10 (MSC<₱15k) / ₱30 (MSC≥₱15k), ER-only | SSS circular | ✅ |
| PhilHealth premium | 5.00% (2.5/2.5), floor ₱10,000, ceiling ₱100,000 | RA 11223; PhilHealth advisory 2025-05-06 ("final scheduled adjustment"); PIA 2026-05-14 | ✅ |
| Pag-IBIG | 2% EE + 2% ER on first ₱10,000 (max ₱200 each); EE 1% if ≤₱1,500 | RA 9679; HDMF Circular No. 460 (eff. Feb 2024) | ✅ (1% tier not modeled) |
| BIR annual table | 0/250k…2.2025M+35% brackets | NIRC §24 as amended by RA 10963; RR 11-2018 | ✅ |
| 13th month + benefits non-taxable cap | ₱90,000 aggregate | RA 10963 / RR 11-2018; reconfirmed in RR 29-2025 discourse | ✅ (feature itself not built) |
| Holiday pay multipliers (CY2026) | RH worked 200%, RH+rest 260%; special 130%, special+rest 150%; unworked RH 100% w/ prior-day condition; OT ×130% stacking (260%/338%/169%/195%/125%) | **DOLE Labor Advisory No. 12-25 (s. 2025)** | ✅ matrix matches |
| NSD | ≥10%, 22:00–06:00, on actual hours | Labor Code Art. 86 | ✅ |
| Rest-day work | +30% first 8h; OT on rest day +30% of rest-day rate (169%) | Labor Code Art. 93(d)/87; DOLE Handbook | ✅ |
| Daily/hourly factor | monthly ÷ 22 ÷ 8 | DOLE Handbook (factor method) | ✅ |
| CY2026 holidays | 10 regular + 8 special non-working | **Proclamation No. 1006 (s. 2025)** | ✅ all 18 match; missing Eid proclamations ⚠️; Feb 25 special *working* day absent (informational) |
| De minimis (2026) | rice ₱2,500/mo; uniform ₱8,000/yr; laundry ₱400/mo; medical ₱12,000/yr; gifts ₱6,000/yr; achievement ₱12,000/yr; CBA/productivity ₱12,000/yr; monetized VL 12 days; OT/night meal 30% of min wage | **RR No. 29-2025** (issued 2025-12-22, eff. 2026-01-06) | ❌ repo still on pre-RR-29-2025 values; GIFT ₱9,000 invalid; RD_SUB misclassified |
| Minimum wage | NCR non-agri daily minimum wage (regional, wage-order based) | DOLE / RWRB wage orders | ⚠️ hardcoded ₱16,000/mo threshold in seed |

**Discrepancy policy:** each row above will be re-seeded as versioned data with `source_ref`, `effective_from`, `date_verified` when the statutory seed is revised (Phase 2/10). No silent value changes — old rows remain for historical runs.

---

## 5. Prioritized roadmap (maps to spec §53 phases)

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 (this doc)** | Audit + gap matrix + architecture review | Docs reviewed; decisions locked (see §6) |
| **2** | DB integrity: fix statutory seed (RR 29-2025, SSS eff-date/source), add `company/site` decision, effective-dated compensation prep, migration hygiene (ban `db:push` on prod) | Migrations green; seeds cite verified sources |
| **3** | AuthZ foundation: permissions table + `requirePerm`, `/setup` gate fix, login/PIN rate limits, security headers, **audit_log wired to all mutations** | Auth matrix tests pass; every mutation audited |
| **4** | Core HR: 201-file split (compensation history first), org assignments w/ effective dates, employee search | Salary change history auditable |
| **5** | Scheduling: `schedule_day` materialization, rest days, rotation templates, conflict detection | Per-date schedules exist for all employees |
| **6** | Biometric: `punch_raw` append-only + device registry + kiosk rework + ingestion endpoint | Overnight punch-out works; punches immutable |
| **7** | Attendance: recompute from punches, roster-driven absence generation, grace tiers, correction workflow, OT approval clamp | No more "missing day = paid"; corrections audited |
| **8** | Leave: ledger, accrual, applications, approvals, payroll consumption | Idempotent ledger debits tested |
| **9** | Payroll core: worker + lines emission, state-machine fixes, net invariant, pre-flight, remove 5k limit | 10k synthetic employees calculated off-request; rerun determinism test green |
| **10** | Statutory hardening: eff-date selection, managerial variant, discrepancy log closed | Date-selection tests w/ multi-year rows |
| **11** | Payslips: revisions + checksum + explanation UI | Every line traceable |
| **12–13** | ESS + supervisor portals (both depend on 5–9) | Self-service reads own data only; supervisor scoped |
| **14** | Reports/exports + API v1 + variance engine | Async CSV/XLSX exports |
| **15** | Audit viewer + observability + notifications | Health dashboard; structured logs |
| **16–17** | Load tests, golden suite, property invariants, E2E | p95 + volume targets documented |
| **18** | Deployment/DR docs, CI, backup verification | Runbooks + CI green |

**Do not skip to Phase 18. The critical path is 3 → 5 → 6 → 7 → 9.**

---

## 6. Decisions needed from stakeholders

1. **Multi-tenant SaaS or single-company deployment?** Determines whether `company` scoping lands in Phase 2 (cheap) or becomes a rewrite later (expensive).
2. **Undertime/late pay policy for fixed-salary vs daily-paid employees** (legal default exists, but company policy may be more generous — must be configurable, not hardcoded).
3. **Background worker hosting:** separate long-running process (Railway/Fly/VPS) vs. Vercel cron chunks vs. Neon/Postgres-only loop. Payroll at 10k+ will not finish inside a serverless request.
4. **OT authorization modes** (`AUTO` vs `MANAGER_APPROVAL`) per campaign — schema already has the column, behavior must be defined.
5. **De minimis reclassification:** confirm `RD_SUB` (representation) is intended as taxable, and adopt RR 29-2025 ceilings.
