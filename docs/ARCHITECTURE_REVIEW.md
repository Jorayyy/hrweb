# Architecture Review — BPO-HRWeb

**Audit date:** 2026-10-05 · repo `c68b4f4` · companion to `ENTERPRISE_GAP_ANALYSIS.md`

> **Status 2026-10-05:** Phase 1 exit fixes applied — **A1–A4** (spec-doc corrections), **B1** (overnight anchor interim fix + tests), **B2** (state machine: APPROVED recalc blocked, success-in-try, rollback-on-error, approve blocked on failed jobs), **B3** (net invariant), **B5** (`.limit(5000)` removed), **B8** (/setup gate), **B9** (employee dashboard), **B11/A4** (statutory seed: SSS eff-date/source, RR 29-2025 caps, RD_SUB taxable), **C7** (CI workflow). **Phase 2 applied (same date):** **C8** (`db:push` renamed `db:push:dev`, README migration workflow), **C5** (decided: single company — no tenant scoping, gap §6.1), statutory selectors now honor `effectiveTo` (createRun, `payroll/actions.ts`), `employee_compensation_history` ledger added + backfilled (migration `0001`, idempotent) + written on create/update. Remaining: B4, B6, B7, B10, B12–B14, A5–A6, other C items — see roadmap.

Scope: two things — (A) defects in **ARCHITECTURE.md itself** (the supplied canonical spec), (B) defects in the **implementation**, (C) structural design problems, (D) the regression tests each fix needs. Every claim below was verified against source (file:line) or an authoritative statutory source (see GAP_ANALYSIS §4).

---

## A. Problems in ARCHITECTURE.md

### A1 — §3.3 premium matrix OT column is wrong (4 of 10 rows)
`ARCHITECTURE.md:1176-1187` OT hourly column vs. DOLE Labor Advisory No. 12-25 (s.2025) for CY2026:

| Row | Case | Doc says | Correct (= implemented) |
|---|---|---|---|
| 2 | Ordinary worked on rest day | OT 130% | **169%** (130% × 130%) |
| 5 | Regular holiday on rest day, worked | OT 260% | **338%** (200% × 130% × 130%) |
| 7 | Special NW, worked | OT 130% | **169%** (130% × 130%) |
| 9 | Special NW on rest day, worked | OT 150% | **195%** (150% × 130%) |

Rows 1/3 (125%, 260%) are correct. **The implementation's `PREMIUM_MATRIX_2026` is right; the doc table is wrong** — which matters because the doc says "populate from the current DOLE Handbook", and anyone re-seeding from this table would break working code. Fix the doc rows, cite Labor Advisory 12-25 explicitly, add `date_verified`.

### A2 — `compute_sss` pseudocode uses `ceil_to_step`
`ARCHITECTURE.md:1246`: `msc = clamp(ceil_to_step(monthly_basic, step), …)` contradicts the SSS rule (range boundaries at ₱250 midpoints: ₱5,249.99 → MSC ₱5,000; ₱5,250 → ₱5,500). `ceil_to_step(₱5,001)` → ₱5,500 (wrong). Implementation (`statutory/ph.ts`, `floorToStep(x + step/2)` = round-half-up) is correct. Fix doc pseudocode to midpoint rounding.

### A3 — MSC bracket range typo
`ARCHITECTURE.md:1276` says "e.g. 3,500–35,000". Actual schedule (eff. 2025-01-01): **₱5,000–₱35,000**, ₱500 step.

### A4 — De minimis table stale (doc + seed share the same error)
`ARCHITECTURE.md:1396-1403` and `src/lib/statutory/ph.ts` allowance caps are all **pre-RR 29-2025**:

| Code | Doc/seed (stale) | Correct — RR 29-2025 (eff. 2026-01-06) |
|---|---|---|
| RICE | ₱1,500/mo | **₱2,500/mo** |
| CLOTHING | ₱6,000/yr | **₱8,000/yr (uniform)** |
| LAUNDRY | ₱300/mo | **₱400/mo** |
| MEDICAL | ₱10,000/yr | **₱12,000/yr** |
| GIFT | ≤3 × ₱3,000 (= ₱9,000/yr) | **₱6,000/yr** |
| ACHIEVE | ₱10,000/yr | **₱12,000/yr** |
| RD_SUB | "Representation allowance", non-taxable, ₱1,000/mo | **Not a de minimis category — taxable** |

`ph.test.ts:231` asserts the stale caps against the same constants (self-referential) — it will keep passing while being wrong. Fix: re-seed from RR 29-2025 with `source_ref` + `date_verified`, reclassify `RD_SUB` taxable, and make the test assert against **independently written** expected values.

### A5 — Doc reads as present tense; code has neither the doc's schema nor the doc's guarantees
ARCHITECTURE.md §1–2 specifies `punch_raw`, `schedule_day`, `biometric_device`, `leave_*`, `grace_tier`, `audit_log` — **none exist in `drizzle/` migrations**. Conversely the code defines `payroll_line`, `payslip_revision`, `payroll_adjustment` (`schema/payroll.ts:164,189,211`) which **nothing writes**. A reader of the schema would wrongly conclude lines/revisions are implemented. Fix: mark each doc section `TARGET` vs `CURRENT`, and add a drift note. (This review + the gap matrix is that baseline.)

### A6 — Holiday source incomplete
Doc holiday section should cite **Proclamation No. 1006 (s. 2025)** (all 18 seeded dates verified correct) plus: Eid'l Fitr / Eid'l Adha 2026 arrive via separate proclamations (must be data-appended), and Feb 25, 2026 is a special *working* day not currently recorded.

---

## B. Implementation defects

Ordered by severity. Each: **root cause → impact → fix → test**.

### B1 — CRITICAL: overnight shift punch-out rejected after midnight
- **Where:** `src/app/bundy/actions.ts:174-189, 215-245`.
- **Root cause:** `workDate = manilaDateKey(now)` — the OUT punch at 06:07 targets **today's** row. That row has no IN punch, so the `PREREQ` check fires: `"Record your In punch first."` The punch is rejected. The IN punch (from 22:00 yesterday) is stranded as `INCOMPLETE_PUNCH` forever. Compounding: `isRestDay` uses `manilaDayOfWeek(now)` (line 192) — for an OUT punch, "now" is the wrong day; `presenceBeforeHoliday` (line 228-243) and holiday lookup anchor to the wrong date too.
- **Impact:** The flagship BPO scenario (22:00–06:00) **cannot clock out**; worked hours after midnight are lost; downstream payroll underpays. This is a blocking defect, not an edge case.
- **Fix (two-step):**
  1. *Interim (small diff):* resolve anchor date before PREREQ — if today's row lacks IN, use yesterday's row that has IN and no OUT; anchor `workDate`, `isRestDay`, holiday, `presenceBeforeHoliday` to that date.
  2. *Proper (Phase 5–7):* anchor on `schedule_day` for the punch's shift instance; `workDate` = the operational date of the scheduled shift, never raw `today`.
- **Test:** `bundy.overnight.test.ts` — shift 22:00–06:00, IN 21:55 on D, OUT 06:07 on D+1 → single row `D` complete; rest-day classification uses D; D+1 untouched.

### B2 — CRITICAL: payroll run state machine not enforced; failures reported as success
- **Where:** `src/app/(app)/payroll/actions.ts:251` (gate = `POSTED || VOID` only), `393-465`.
- **Root causes:**
  1. `calculateRun` allowed from **APPROVED** → recalc silently sets `approvedBy: null, approvedAt: null` (lines 461-462) — approval is destructible.
  2. `status: "CALCULATED"` is written in **`finally`** (445-464) — a thrown error mid-loop still publishes `CALCULATED` with whatever items were inserted (and if the throw happened before inserts, totals=0/`headcount=0` presented as a completed run).
  3. Per-employee failures (`failedIds`, 434-437) only surface as a redirect flash (467); run totals/headcount exclude them with no persisted failure state — **no `FAILED` status exists**.
- **Fix:** calculate allowed only from `OPEN/CUT_OFF/CALCULATED/REVIEW` (+ explicit "recalculate approved" blocked or requiring void→new run); move success write into `try`; on error → new `FAILED` status + log; persist `failed_count` on the run; `approve` blocked when `failed_count > 0` or `headcount ≠ expected roster count`.
- **Test:** transition-matrix test: for each (action, from-status) assert allowed/denied; simulated throw → run ends `FAILED`, not `CALCULATED`; approve with failures → denied.

### B3 — HIGH: `netPay` clamped to 0 — net = gross − deductions invariant broken
- **Where:** `src/app/(app)/payroll/calc.ts:251` `const netPay = Math.max(0, rawNet)`.
- **Impact:** Over-deduction (bad adjustment, wrong statutory config) is silently masked as net ₱0 with `REVIEW` only via reason string; gross/deduction/net on the payslip stop being arithmetically consistent; totals misstate actual payout.
- **Fix:** store raw `netPay`; flag `needsReview`/hold when `rawNet < 0`; never falsify amounts. (Existing test `calc.test.ts:120` asserts the clamp — update it to assert the invariant + flag instead.)
- **Test:** pathological case (deductions > gross) → `netPay` negative preserved, `needsReview` true, and `gross − deductions === net` holds for every fixture.

### B4 — CRITICAL: absence generation missing + pay-granularity gaps
- **Where:** `calc.ts:146-151` (loop sees only rows that exist), `207-218`.
- **Root causes:**
  1. An employee with **no `attendance_day` rows** in the cutoff has `daysAbsent = 0` → SEMI_MONTHLY/MONTHLY pay full basic. No roster-driven `ABSENT` generation exists anywhere (gap matrix §2.4).
  2. `MONTHLY` family: absences never deduct (207-212, by comment/design) — policy to confirm; SEMI_MONTHLY deducts only `ABSENT_STATUSES` rows; **late/undertime never affect pay** for any frequency despite being computed (`lateSeconds`/`undertimeSeconds` accumulated at 153-154 then only reported).
  3. `daysWorked++` on any `workedSeconds > 0` (150) — a 4-hour day pays as a full day for DAILY/WEEKLY.
- **Impact:** Systematic overpayment (the whole point of attendance→payroll coupling is defeated), plus undertime leakage.
- **Fix:** Phase 7 `generateAttendanceDays(scheduleDay × period)` before calculation; pay-granularity policy per frequency (decision #2 in gap analysis §6); daily-paid undertime = unpaid hours × hourly.
- **Test:** (a) zero-rows employee with scheduled days → basic reduced, not full; (b) daily-paid 4h day → partial pay once policy lands; (c) current behavior documented as failing tests until Phase 7.

### B5 — HIGH: `.limit(5000)` silently truncates the payroll roster; calc runs inside one server request
- **Where:** `payroll/actions.ts:314`; whole loop 403-444 synchronous; `CHUNK=25` inserts (36).
- **Impact:** Employee 5,001+ **not paid, not counted, no error** (consistent with `headcount = items.length`). At target scale (10k–50k) the request exceeds serverless limits even if the limit is removed.
- **Fix (Phase 9):** cursor-paged employee fetch (remove `limit`); move calculation into a worker claiming `payroll_job` via `SKIP LOCKED`; progress from DB. No Kafka/Redis needed at this volume — Postgres queue is the ponytail answer.
- **Test:** seed 5,100 synthetic employees → run headcount = 5,100 (integration, after worker exists); unit: page-cursor fetch returns all.

### B6 — HIGH: overtime paid without approval; approval data dead
- **Where:** `attendance/actions.ts:205` writes `otApprovedSeconds = otSeconds` (everything auto-approved, incl. manual entry); `calc.ts:174,179` pays `d.otWorkedSeconds` and **never reads** `otApprovedSeconds`; campaign `ot_authorization_mode` (schema) unused.
- **Fix:** calc uses `min(otWorked, otApproved)`; supervisor OT request flow (Phase 7/13); campaign modes: `AUTO` = approved=worked, `MANAGER_APPROVAL` = clamp.
- **Test:** fixture with `otWorked=3h, otApproved=1h` → pays 1h until flow lands; then OT approval e2e.

### B7 — MEDIUM: `presenceBeforeHoliday` checks the previous *calendar* day, not previous *workday*
- **Where:** `bundy/actions.ts:228-243` (`prevDate = workDate − 1 day`).
- **Impact:** DOLE Labor Advisory 12-25 requires presence on the working day immediately preceding an unworked regular holiday. If that day was a rest day (or leave), the current logic marks presence from an irrelevant day; a Friday-holiday preceded by Thursday-absence+Wednesday-work misclassifies. Bonus bug: for OUT punches the anchor is wrong per B1.
- **Fix:** walk back to the last scheduled workday before the holiday (needs `schedule_day`); interim: skip over `REST_*` statuses.
- **Test:** holiday Monday, Sunday rest, Saturday rest, Friday worked → `presenceBeforeHoliday` derives from Friday.

### B8 — HIGH: `/setup` page has no role gate (broken access control, read side)
- **Where:** `src/app/(app)/setup/page.tsx:72` — exports directly; `requireRole` exists only in `setup/actions.ts` (mutations gated: lines 19,41,67,91,117,138). All setup **reads** (org data, office IPs, schedules) are open to any authenticated role.
- **Fix:** `await requireRole("ADMIN", "HR")` at page top (pattern used by other pages).
- **Test:** route test: EMPLOYEE session → redirected/403 for `/setup`.

### B9 — HIGH: dashboard leaks org-wide payroll to every employee
- **Where:** `src/app/(app)/page.tsx:41` (`sum(employee.baseSalaryMonthly)`), `76` (payroll totals), roster/campaign counts 30-39 — all fetched unconditionally regardless of role.
- **Fix:** role-gate queries (EMPLOYEE → redirect to ESS home or self-only cards).
- **Test:** EMPLOYEE session → response contains no `payroll`/`salary` aggregates.

### B10 — HIGH: no rate limiting anywhere; kiosk PIN brute-forceable
- **Where:** `/login` (NextAuth credentials), `bundy/actions.ts` PIN verify (4–6 digits), all from allowlisted IPs (limited bypass value — same site/IP pool).
- **Fix (Phase 3):** DB-backed attempt counters (per account + per IP): lockout with exponential cooldown on `/login`; per-employee PIN attempt cap + audit row. No Redis — a `login_attempt` table suffices at this scale.
- **Test:** >N failed attempts → locked with `Retry-After` behavior; counter resets on success.

### B11 — HIGH: statutory seed citations/effective dates stale; date selection ignores `effectiveTo`
- **Where:** `src/lib/statutory/ph.ts` (`SSS_2026.effectiveFrom: "2026-01-01"` — schedule actually effective **2025-01-01**; `sourceRef` cites **Proclamation 1006** which is the *holiday* proclamation; de minimis caps = A4 stale set); selector picks `latest effectiveFrom ≤ period.dateTo` with **no `effectiveTo` check** (payroll actions config load); single row per agency — no historical versions; BIR variant hardcoded `NON_MANAGERIAL` while `employee.isManagerialTaxTbl` is dead; `seed-org.ts:234` hardcodes `salary < 1600000` as minimum-wage-exempt.
- **Fix:** re-seed with correct `effective_from`, real `source_ref` (SSS circular, PhilHealth advisory 2025-05-06, HDMF Cir. 460, RR 29-2025, Labor Advisory 12-25), `date_verified`; add 2024/2025 rows; selector: `effectiveFrom ≤ dateTo AND (effectiveTo IS NULL OR effectiveTo ≥ dateTo)`; MWE threshold as wage-order data keyed by region.
- **Test:** run dated 2025-06-15 resolves the 2025 schedule, 2026-01-01 resolves 2026; overlapping schedules → explicit error; caps test rewritten against literal RR 29-2025 numbers.

### B12 — MEDIUM: manual attendance edits are silent overwrites
- **Where:** `attendance/actions.ts` `saveAttendanceDay` → `onConflictDoUpdate` on the whole row; no before/after, no approver, no compensating record (correction workflow absent — gap §2.4).
- **Fix (Phase 7):** corrections create a new versioned row + `audit_log`; direct edit either removed or break-glass-only with mandatory note.
- **Test:** edit an existing day → original values recoverable via audit; payroll recompute after correction changes pay by the expected delta.

### B13 — MEDIUM: reserved tables look implemented — payroll lines/revisions/adjustments never written
- **Where:** `schema/payroll.ts:164` (`payrollLine`), `:189` (`payrollAdjustment`), `:211` (`payslipRevision`) — zero references outside the schema (verified by grep).
- **Fix:** Phase 11 emits lines from `calcEmployee` (make it return `lines[]` — it's pure, cheap to extend) + payslip checksum/revision; until then, note "reserved" in schema comments so audits don't credit nonexistent capability.

### B14 — MEDIUM: no login/session hardening beyond cookie presence
- **Where:** `proxy.ts` (matcher excludes `/api`, edge checks cookie *existence* only — server actions remain authoritative); no CSP/`headers()` (`next.config.ts` empty); no security headers.
- **Fix:** security headers via `next.config.ts` `headers()`; keep server-side `requireRole/requirePerm` as the authority; document per-route auth contract (API routes must self-auth — both current ones do).

---

## C. Structural problems (no single-line fix)

1. **No immutable punch layer** (C1) — B1/B12 are symptoms. `attendance_day` is simultaneously raw punch store, computed DTR, and HR-corrected record. Target: append-only `punch_raw` → derived `attendance_day` (recompute-able, provenance-able). This is the Phase 6 keystone.
2. **AuthZ model too thin** (C2) — 4 flat roles, no permissions/scopes, no supervisor scoping. Every feature from Phase 5 onward needs `requirePerm("attendance.correct", scope)`. Build before leave/ESS/supervisor work (Phase 3), or those features hardcode roles and get rewritten.
3. **Sync everything, no queue** (C3) — payroll (B5), and later exports/recompute/notifications, all run inside the request. One generic `job` loop + worker entrypoint fixes payroll, exports, and variance in one shot.
4. **Single shift pointer blocks scheduling truth** (C4) — `employee.shift_template_id` + `weekly_rest_days[]` cannot express rotations, per-date rest days, or the schedule anchor B1 needs. `schedule_day` materialization (Phase 5) is the prerequisite for correct attendance (B1, B7, B4).
5. **Multi-tenancy decision deferred costs money later** (C5) — no `company` table. **Decided 2026-10-05: single-company deployment — no tenant scoping. C5 closed.** If SaaS ever becomes a requirement, this must be revisited as a dedicated project.
6. **Zero observability** (C6) — no logger, no request ids, `console`/`logger` appear nowhere in `src/`; errors in `catch` blocks become flash strings or are swallowed (B2). Add structured JSON logging with request+run ids early (Phase 3/15) — retro-fitting logs into a payroll incident is too late.
7. **No CI** (C7) — no `.github/`; `tsc`/lint/tests are local habits only. A 6-line PR workflow (lint+type+test) is the cheapest item in this document.
8. **`db:push` available on prod** (C8) — ~~`package.json` scripts permit schema push against Neon~~ **Applied 2026-10-05:** script renamed to `db:push:dev` (local throwaway DBs only) + README migration workflow; prod path is `db:migrate` only.

---

## D. Proposed regression tests

Keep all 49 existing (update `calc.test.ts:120` per B3). Add per phase:

| # | Test | Covers | Phase |
|---|---|---|---|
| 1 | Overnight kiosk: IN 21:55 D / OUT 06:07 D+1 → row D complete, D+1 untouched, rest-day from D | B1 | interim fix now, re-assert after Phase 6 |
| 2 | Payroll transition matrix (every action × status); throw mid-calc → `FAILED`; approve-with-failures denied | B2 | 9 |
| 3 | `gross − deductions === net` for every fixture; negative net preserved + flagged | B3 | now (small diff) |
| 4 | Roster-driven absence: scheduled day, no punches, no leave → `ABSENT` → pay reduced | B4 | 7 |
| 5 | OT clamp: `otApproved < otWorked` → pays approved only | B6 | 7 |
| 6 | Holiday presence walks back over rest days to last workday | B7 | 7 |
| 7 | `/setup` 403 for EMPLOYEE; dashboard payload has no aggregates for EMPLOYEE | B8, B9 | 3 |
| 8 | Login/PIN lockout after N attempts | B10 | 3 |
| 9 | Statutory date resolution: 2025 run → 2025 schedule; overlap → error; caps asserted against literal RR 29-2025 figures | B11, A4 | 2/10 |
| 10 | Attendance correction leaves audit trail; recompute changes pay by exact delta | B12 | 7 |
| 11 | Rerun determinism: same inputs + config → byte-identical run items (golden payroll suite) | C3, spec §39 | 9/17 |
| 12 | 5,100-employee run → `headcount = 5,100` (integration) | B5 | 9/17 |

---

## E. Recommended fix order (critical path)

| Now (Phase 1 exit, no phase gate needed) | Size |
|---|---|
| B8 `/setup` gate + B9 dashboard role-gate | ~10 lines |
| B3 net invariant (+ test update) | ~5 lines |
| B11/A4 statutory seed corrections + citations | data only |
| B2 state-machine gates (`try`/`catch` write, block recalc of APPROVED) | ~30 lines |
| B1 interim overnight anchor fix (+ test) | ~40 lines |
| C7 CI workflow (lint+type+test) | 1 workflow file |

Then per roadmap: **Phase 3 (auth/audit/rate-limit) → 5 (schedule_day) → 6 (punch_raw/device) → 7 (recompute/absences/corrections) → 9 (worker/lines)**.

B5's `.limit(5000)` removal should ride along with the state-machine fix (same file) — one-line delete, page-cursor instead — while the worker lands in Phase 9.
