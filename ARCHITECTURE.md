# BPO-HRWeb — Technical Specification & Architectural Blueprint

Enterprise HR, Timekeeping, Attendance & Payroll Engine for a Philippine BPO
**Design point:** 10,000+ agents · 24/7 rotating shifts · multi-campaign · split-shifts · distributed biometric fleet

---

## 0. Scope & Non-Functional Requirements

| Dimension | Target |
|---|---|
| Headcount | 10,000–50,000 employees, multi-campaign, multi-cost-center |
| Shift model | 24/7 rotating, fixed, flexi, split, compressed week, 12-hr bridging shifts |
| Punch volume | ~2 punches/employee/day = 20k–30k events/day; **peak burst 5,000 req/s** in a 60s window at 06:00 / 14:00 / 22:00 boundaries |
| Latency | Punch → attendance feed ≤ 500 ms (p95); punch → immutable store ≤ 50 ms (p99) |
| Payroll batch | 10,000 employees × ~40 lines = 400k line items per cutoff; complete ≤ 10 min wall-clock |
| Consistency | Payroll is **exactly-once computable** — re-running a period is deterministic and idempotent |
| Compliance | RA 11199 (SSS), RA 11223 (PhilHealth), RA 9679 (Pag-IBIG), NIRC §24 as amended by TRAIN (RA 10963), PD 442 Arts. 86–87, DOLE Handbook on Workers' Statutory Monetary Benefits |
| Audit | Every payslip line traceable to punch → attendance day → rule version → statutory table version |

**Hard rules**

1. Statutory rates, tax tables, holiday calendars and premium multipliers are **versioned data with effective dates — never code constants.**
2. Raw punches are **immutable**. Corrections append compensating rows; they never mutate.
3. Timekeeping is a **pure function** of (raw punches, schedule, leave, holiday calendar, policy versions). Re-running produces byte-identical output.
4. All timestamps stored in **UTC**; all business logic evaluated in **`Asia/Manila` (UTC+08:00, no DST)**.

---

## 1. Database Schema & Data Modeling

### 1.1 Conventions

- PostgreSQL 16+. Internal keys are `BIGINT GENERATED ALWAYS AS IDENTITY`; external identity is a natural key (`employee_no`, `device serial`).
- Monetary columns: `NUMERIC(18,4)` internal; rounded to 2 dp at **line-finalization**, never mid-calculation.
- Durations: `INTEGER` **seconds** — never floating-point minutes.
- Every business table carries `created_at/updated_at timestamptz NOT NULL DEFAULT now()`.
- Enums are `CREATE TYPE` — adding values requires a migration, which is deliberate.

```sql
CREATE DOMAIN php_amount AS NUMERIC(18,4);
CREATE DOMAIN epoch_s    AS INTEGER;   -- duration in seconds
```

---

### 1.2 Organization, Campaign & Employee

```sql
CREATE TYPE employment_status AS ENUM
  ('PREBOARDING','ACTIVE','SUSPENDED','ON_LEAVE','AWOL','RETIRED','TERMINATED','REINSTATED');
CREATE TYPE employment_type   AS ENUM
  ('REGULAR','PROBATIONARY','PROJECT','AGENCY','PART_TIME','APPRENTICE');
CREATE TYPE pay_frequency     AS ENUM ('SEMI_MONTHLY','MONTHLY','WEEKLY','DAILY');

CREATE TABLE cost_center (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code       TEXT   NOT NULL UNIQUE,
  name       TEXT   NOT NULL,
  parent_id  BIGINT REFERENCES cost_center(id),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT cc_code_fmt CHECK (code ~ '^[A-Z0-9._-]{2,32}$')
);

CREATE TABLE campaign (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code           TEXT   NOT NULL UNIQUE,
  name           TEXT   NOT NULL,
  client_name    TEXT   NOT NULL,
  cost_center_id BIGINT NOT NULL REFERENCES cost_center(id),
  time_policy_id BIGINT,                              -- NULL = inherit global
  ot_authorization_mode TEXT NOT NULL DEFAULT 'MANAGER_APPROVAL'
    CHECK (ot_authorization_mode IN ('MANAGER_APPROVAL','AUTO','SUPERVISOR_SELF')),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE department (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  cost_center_id BIGINT NOT NULL REFERENCES cost_center(id),
  parent_id BIGINT REFERENCES department(id)
);

CREATE TABLE job_position (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  job_level SMALLINT NOT NULL DEFAULT 1,
  is_managerial BOOLEAN NOT NULL DEFAULT FALSE   -- selects BIR table variant
);

CREATE TABLE employee (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_no       TEXT   NOT NULL UNIQUE,
  external_code     TEXT   NOT NULL,             -- identity echoed by the device
  first_name        TEXT   NOT NULL,
  middle_name       TEXT,
  last_name         TEXT   NOT NULL,
  email             TEXT   UNIQUE,
  date_hired        DATE   NOT NULL,
  date_regularized  DATE,
  date_separated    DATE,

  status            employment_status NOT NULL DEFAULT 'PREBOARDING',
  employment_type   employment_type   NOT NULL,
  pay_frequency     pay_frequency     NOT NULL DEFAULT 'SEMI_MONTHLY',

  campaign_id       BIGINT NOT NULL REFERENCES campaign(id),
  department_id     BIGINT NOT NULL REFERENCES department(id),
  cost_center_id    BIGINT NOT NULL REFERENCES cost_center(id),
  position_id       BIGINT NOT NULL REFERENCES job_position(id),
  reports_to_id     BIGINT REFERENCES employee(id),

  base_salary_monthly php_amount NOT NULL CHECK (base_salary_monthly >= 0),
  -- DOLE: daily rate = monthly / 22 working days; hourly = daily / 8
  daily_rate        NUMERIC(12,4) GENERATED ALWAYS AS
                      (round(base_salary_monthly / 22.0, 4)) STORED,
  hourly_rate       NUMERIC(12,4) GENERATED ALWAYS AS
                      (round(base_salary_monthly / 22.0 / 8.0, 4)) STORED,

  tin_no            TEXT,
  sss_no            TEXT,
  philhealth_no     TEXT,
  pagibig_no        TEXT,
  rdo_code          TEXT,
  is_minimum_wage_exempt BOOLEAN NOT NULL DEFAULT FALSE, -- substituted withholding
  is_managerial_tax_tbl  BOOLEAN NOT NULL DEFAULT FALSE,

  default_shift_id  BIGINT,
  is_flexi          BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_rest_days  SMALLINT[] NOT NULL DEFAULT '{0}',   -- 0=Sun .. 6=Sat
  timezone          TEXT NOT NULL DEFAULT 'Asia/Manila',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emp_sep_order CHECK (date_separated IS NULL OR date_separated >= date_hired)
);

CREATE UNIQUE INDEX ux_employee_external
  ON employee (external_code, campaign_id) WHERE status <> 'TERMINATED';
CREATE INDEX ix_employee_lookup   ON employee (campaign_id, status);
CREATE INDEX ix_employee_cost_ctr ON employee (cost_center_id);
CREATE INDEX ix_employee_mgr      ON employee (reports_to_id) WHERE reports_to_id IS NOT NULL;
CREATE INDEX ix_employee_sss      ON employee (sss_no)      WHERE sss_no      IS NOT NULL;
CREATE INDEX ix_employee_tin      ON employee (tin_no)      WHERE tin_no      IS NOT NULL;
CREATE INDEX ix_employee_roster   ON employee (campaign_id, department_id, last_name)
  WHERE status IN ('ACTIVE','ON_LEAVE','SUSPENDED');
```

**Cardinality:** `campaign 1—N employee` · `employee N—1 cost_center` · `employee 1—N schedule_day` · `employee 1—N attendance_day` · `(run, employee) 1—N payroll_line`.

---

### 1.3 Rosters & Schedules

Two layers: an *intention* layer (`shift_definition` — reusable templates) and an *obligation* layer (`schedule_day` — concrete, materialized, per-employee-per-day commitment). Materializing `schedule_day` is non-negotiable: shift matching must never iterate a recurrence engine at query time.

```sql
CREATE TYPE shift_kind AS ENUM ('STANDARD','SPLIT','FLEXI','COMPRESSED','REST_DAY_WORK');
CREATE TYPE day_status AS ENUM
  ('SCHEDULED','REST_DAY','LEAVE','HOLIDAY_WORK','HOLIDAY_UNWORKED',
   'ABSENT','LWP','SUSPENDED','SEPARATED','NOT_SCHEDULED');

CREATE TABLE shift_definition (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          TEXT   NOT NULL UNIQUE,        -- 'NS-22', 'MID-14', 'SPLIT-AM'
  name          TEXT   NOT NULL,
  kind          shift_kind NOT NULL DEFAULT 'STANDARD',
  duration_s    epoch_s NOT NULL CHECK (duration_s BETWEEN 3600 AND 61200),
  meal_break_s  epoch_s NOT NULL DEFAULT 3600,  -- unpaid, auto-deducted
  paid_break_s  epoch_s NOT NULL DEFAULT 0,
  earliest_in_s epoch_s NOT NULL DEFAULT 1800,  -- punch accepted from -30 min
  latest_out_s  epoch_s NOT NULL DEFAULT 14400, -- punch accepted up to +4 h
  is_flexi      BOOLEAN NOT NULL DEFAULT FALSE,
  flex_window_s epoch_s NOT NULL DEFAULT 0,     -- +/- allowance on scheduled start
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE shift_leg (                        -- ordered wall-clock legs (split shift)
  shift_id       BIGINT NOT NULL REFERENCES shift_definition(id) ON DELETE CASCADE,
  leg_no         SMALLINT NOT NULL,
  start_offset_s epoch_s NOT NULL,              -- seconds from shift anchor (local)
  end_offset_s   epoch_s NOT NULL,
  is_paid        BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (shift_id, leg_no),
  CONSTRAINT leg_bounds CHECK (end_offset_s > start_offset_s)
);

CREATE TABLE schedule_day (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id    BIGINT NOT NULL REFERENCES employee(id),
  work_date      DATE   NOT NULL,    -- OPERATIONAL DATE = local date of shift ANCHOR
  shift_id       BIGINT NOT NULL REFERENCES shift_definition(id),
  shift_kind     shift_kind NOT NULL,
  starts_at_utc  timestamptz NOT NULL,
  ends_at_utc    timestamptz NOT NULL,  -- absolute end; may be next calendar day
  scheduled_s    epoch_s NOT NULL,      -- net of unpaid meal break
  is_rest_day    BOOLEAN NOT NULL DEFAULT FALSE,
  campaign_id    BIGINT NOT NULL REFERENCES campaign(id),
  cost_center_id BIGINT NOT NULL REFERENCES cost_center(id),
  source         TEXT NOT NULL DEFAULT 'ROSTER_GENERATOR'
    CHECK (source IN ('ROSTER_GENERATOR','MANUAL','SWAP','IMPORT','OVERRIDE')),
  revision       INTEGER NOT NULL DEFAULT 1,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,           -- NULL = current
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date, revision)
);

-- The single most important index in the system.
CREATE UNIQUE INDEX ux_schedule_current
  ON schedule_day (employee_id, work_date) WHERE valid_to IS NULL;
CREATE INDEX ix_schedule_window
  ON schedule_day (starts_at_utc) WHERE valid_to IS NULL;
CREATE INDEX ix_schedule_campaign_day
  ON schedule_day (campaign_id, work_date) WHERE valid_to IS NULL;

-- Roster edits never UPDATE in place: bump `revision`, close old valid_to,
-- insert new row. The superseded row survives for audit and payroll disputes.
CREATE TABLE schedule_override (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id     BIGINT NOT NULL REFERENCES employee(id),
  target_date     DATE   NOT NULL,
  old_schedule_id BIGINT REFERENCES schedule_day(id),
  new_schedule_id BIGINT REFERENCES schedule_day(id),
  reason          TEXT   NOT NULL,
  approved_by     BIGINT NOT NULL REFERENCES employee(id),
  effective_at    timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX ix_sched_override_pending
  ON schedule_override (employee_id) WHERE acknowledged_at IS NULL;

-- 24/7 rotation generator input; evaluated nightly into schedule_day.
CREATE TABLE rotation_pattern (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES campaign(id),
  name        TEXT   NOT NULL,             -- '4-2 12hr rotating'
  cycle_days  SMALLINT NOT NULL CHECK (cycle_days BETWEEN 1 AND 84),
  pattern     JSONB NOT NULL
  -- [{"offset":0,"shiftCode":"NS-22"},{"offset":1,"shiftCode":"NS-22"},
  --  {"offset":2,"shiftCode":"OFF"} ...]
);
```

---

### 1.4 Biometric Devices & Raw Punch Ingestion

```sql
CREATE TYPE punch_direction AS ENUM ('IN','OUT','BREAK_IN','BREAK_OUT','UNKNOWN');
CREATE TYPE ingest_source   AS ENUM ('HTTP_PUSH','ADMS','WEBSOCKET','FILE_IMPORT','MANUAL');

CREATE TABLE biometric_device (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  serial_no      TEXT NOT NULL UNIQUE,          -- SN echoed in every payload
  label          TEXT NOT NULL,
  site_code      TEXT NOT NULL,                 -- 'TAC-1F', 'CEBU-3F'
  campaign_id    BIGINT REFERENCES campaign(id),-- NULL = shared/common device
  firmware       TEXT,
  source_type    ingest_source NOT NULL DEFAULT 'HTTP_PUSH',
  api_key_hash   TEXT,                          -- SHA-256 of device secret
  last_seen_at   timestamptz,
  last_heartbeat timestamptz,
  is_enabled     BOOLEAN NOT NULL DEFAULT TRUE
);

-- ===== IMMUTABLE · PARTITIONED · APPEND-ONLY =====
-- Corrections append a compensating row (`correction_of`), never UPDATE.
CREATE TABLE punch_raw (
  id              BIGINT GENERATED ALWAYS AS IDENTITY,
  device_id       BIGINT      NOT NULL,
  employee_id     BIGINT      REFERENCES employee(id),   -- NULL until resolved
  external_code   TEXT        NOT NULL,
  punch_ts_utc    timestamptz NOT NULL,
  punch_ts_local  timestamptz NOT NULL,   -- Asia/Manila wall clock, for display only
  direction       punch_direction NOT NULL DEFAULT 'UNKNOWN',
  source          ingest_source   NOT NULL,
  device_seq      BIGINT,                 -- monotonic per device
  payload_hash    BYTEA       NOT NULL,   -- sha256(device_sn|code|ts|dir)
  idempotency_key BYTEA       NOT NULL,   -- sha256 -> dedupe key
  quality         SMALLINT,               -- 0-100 device-reported
  correction_of   BIGINT,
  ingested_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, punch_ts_utc)
) PARTITION BY RANGE (punch_ts_utc);

CREATE TABLE punch_raw_2026_10 PARTITION OF punch_raw
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
-- partition-maintenance job creates 3 months ahead, drops past retention

CREATE UNIQUE INDEX ux_punch_idem  ON punch_raw (idempotency_key, punch_ts_utc);
CREATE INDEX ix_punch_emp_time     ON punch_raw (employee_id, punch_ts_utc)
  WHERE employee_id IS NOT NULL;
CREATE INDEX ix_punch_unresolved   ON punch_raw (ingested_at) WHERE employee_id IS NULL;
CREATE INDEX ix_punch_device_seq   ON punch_raw (device_id, device_seq, punch_ts_utc);

-- Replay marker: which derived day is stale
CREATE TABLE punch_invalidation (
  punch_id BIGINT NOT NULL,
  day_date DATE   NOT NULL,
  reason   TEXT   NOT NULL,
  PRIMARY KEY (punch_id, day_date)
);
```

---

### 1.5 Attendance (Derived Day Result)

```sql
CREATE TYPE attendance_day_status AS ENUM
  ('PRESENT','ABSENT','LEAVE','HOLIDAY_UNWORKED','REST_DAY_WORKED',
   'LWP','SUSPENDED','INCOMPLETE_PUNCH','NOT_SCHEDULED','HALF_DAY');

CREATE TABLE attendance_day (
  employee_id  BIGINT NOT NULL REFERENCES employee(id),
  work_date    DATE   NOT NULL,      -- OPERATIONAL DATE (shift anchor date)
  schedule_id  BIGINT REFERENCES schedule_day(id),

  status       attendance_day_status NOT NULL,
  punch_in_utc  timestamptz, punch_out_utc  timestamptz,
  first_in_utc  timestamptz, last_out_utc  timestamptz,

  scheduled_s  epoch_s NOT NULL DEFAULT 0,
  worked_s     epoch_s NOT NULL DEFAULT 0,   -- net of unpaid meal
  paid_break_s epoch_s NOT NULL DEFAULT 0,
  late_s       epoch_s NOT NULL DEFAULT 0,   -- after grace tier applied
  flex_s       epoch_s NOT NULL DEFAULT 0,   -- absorbed by flex tier (tracked)
  undertime_s  epoch_s NOT NULL DEFAULT 0,
  absent_s     epoch_s NOT NULL DEFAULT 0,
  ot_approved_s epoch_s NOT NULL DEFAULT 0,
  ot_worked_s   epoch_s NOT NULL DEFAULT 0,  -- post-authorization clamp
  ot_unapproved_s epoch_s NOT NULL DEFAULT 0,
  night_s      epoch_s NOT NULL DEFAULT 0,   -- intersecting 22:00-06:00
  night_ot_s   epoch_s NOT NULL DEFAULT 0,

  day_multiplier  NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  ot_multiplier   NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  is_rest_day     BOOLEAN NOT NULL DEFAULT FALSE,
  holiday_id      BIGINT,
  leave_id        BIGINT,
  leave_hours     NUMERIC(6,2) NOT NULL DEFAULT 0,
  presence_before_holiday BOOLEAN NOT NULL DEFAULT TRUE,

  unmatched_punches INTEGER NOT NULL DEFAULT 0,
  needs_review   BOOLEAN NOT NULL DEFAULT FALSE,
  rule_version   TEXT NOT NULL,      -- 'tk-2026.10.03'
  computed_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (employee_id, work_date)
);
CREATE INDEX ix_att_review     ON attendance_day (employee_id) WHERE needs_review;
CREATE INDEX ix_att_day_status ON attendance_day (work_date, status) WHERE needs_review;
```

---


### 1.6 Leave Management (feeds the timekeeping override)

```sql
CREATE TYPE leave_unit   AS ENUM ('HOURS','HALF_DAY','FULL_DAY','DAYS');
CREATE TYPE leave_status AS ENUM ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED','POSTED');

CREATE TABLE leave_type (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,   -- 'VL','SL','SIL','PL','ML','EL'
  name               TEXT NOT NULL,
  is_paid            BOOLEAN NOT NULL DEFAULT TRUE,
  is_accredited      BOOLEAN NOT NULL DEFAULT TRUE,  -- counts toward 5-yr SIL
  max_hours_per_year NUMERIC(6,2),
  convertible        BOOLEAN NOT NULL DEFAULT FALSE,
  requires_document  BOOLEAN NOT NULL DEFAULT FALSE,
  counts_as_present  BOOLEAN NOT NULL DEFAULT TRUE   -- suppresses ABSENT marker
);

CREATE TABLE leave_ledger (     -- accrual account; single source of balance truth
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id   BIGINT NOT NULL REFERENCES employee(id),
  leave_type_id BIGINT NOT NULL REFERENCES leave_type(id),
  entry_date    DATE   NOT NULL,
  delta_hours   NUMERIC(8,2) NOT NULL,  -- +accrual, -usage, +conversion
  reason_code   TEXT NOT NULL,          -- 'MONTHLY_ACCRUAL','HIRE_PRORATE','PAYROLL_USAGE'
  source_ref    TEXT,
  expires_on    DATE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Makes accrual/usage idempotent at the DB level: a payroll re-run cannot double-debit.
CREATE UNIQUE INDEX ux_ledger_dedupe ON leave_ledger
  (employee_id, leave_type_id, entry_date, reason_code, COALESCE(source_ref,''));
CREATE INDEX ix_ledger_balance ON leave_ledger (employee_id, leave_type_id);

CREATE TABLE leave_application (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id    BIGINT NOT NULL REFERENCES employee(id),
  leave_type_id  BIGINT NOT NULL REFERENCES leave_type(id),
  date_from      DATE   NOT NULL,
  date_to        DATE   NOT NULL,
  hours          NUMERIC(8,2) NOT NULL CHECK (hours > 0),
  unit           leave_unit NOT NULL DEFAULT 'FULL_DAY',
  partial_start  TIME,
  partial_end    TIME,
  reason         TEXT,
  status         leave_status NOT NULL DEFAULT 'DRAFT',
  filed_at       timestamptz NOT NULL DEFAULT now(),
  approved_by    BIGINT REFERENCES employee(id),
  approved_at    timestamptz,
  posted_period_id BIGINT,   -- only POSTED rows are consumable by timekeeping
  CONSTRAINT leave_dates CHECK (date_to >= date_from)
);
CREATE INDEX ix_leave_overlap ON leave_application (employee_id, date_from, date_to)
  WHERE status IN ('APPROVED','POSTED');
```

---

### 1.7 Holiday Calendar

```sql
CREATE TYPE holiday_kind AS ENUM ('REGULAR','SPECIAL_NONWORKING','SPECIAL_HALF_DAY','LOCAL');

CREATE TABLE holiday_calendar (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  holiday_date DATE        NOT NULL,
  kind         holiday_kind NOT NULL,
  name         TEXT        NOT NULL,
  proclamation TEXT,                              -- 'Proclamation No. 727 (2024)'
  applies_to_campaign_ids BIGINT[],               -- NULL = nationwide/all
  effective_year SMALLINT NOT NULL,
  UNIQUE (holiday_date, name)
);
CREATE INDEX ix_holiday_year ON holiday_calendar (effective_year);
```

---

### 1.8 Payroll Registers, Itemized Lines & Historical Audit

```sql
CREATE TYPE payroll_status AS ENUM
  ('OPEN','CUT_OFF','CALCULATING','CALCULATED','REVIEW','APPROVED','POSTED','VOID');
CREATE TYPE line_kind AS ENUM
  ('EARNING','DEDUCTION','TAX','EMPLOYER_CONTRIB','REIMBURSEMENT','ADJUSTMENT');
CREATE TYPE taxable_class AS ENUM
  ('TAXABLE','NON_TAXABLE_DEMINIMIS','NON_TAXABLE_STATUTORY','EXEMPT');

CREATE TABLE payroll_period (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_code TEXT NOT NULL UNIQUE,   -- '2026-10-A', '2026-10-B'
  date_from   DATE NOT NULL,
  date_to     DATE NOT NULL,
  cutoff_at   timestamptz NOT NULL,   -- punches after this land in next period
  pay_date    DATE NOT NULL,
  frequency   pay_frequency NOT NULL,
  CONSTRAINT period_order CHECK (date_to >= date_from)
);

CREATE TABLE payroll_run (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  period_id   BIGINT NOT NULL REFERENCES payroll_period(id),
  run_no      INTEGER NOT NULL DEFAULT 1,  -- re-runs increment; POSTED runs never mutate
  status      payroll_status NOT NULL DEFAULT 'OPEN',
  headcount   INTEGER,
  gross_total    php_amount,
  deduction_total php_amount,
  net_total      php_amount,
  -- effective-dated config snapshots: THE audit anchor
  sss_schedule_id  BIGINT NOT NULL,
  phic_schedule_id BIGINT NOT NULL,
  hdmf_schedule_id BIGINT NOT NULL,
  bir_table_id     BIGINT NOT NULL,
  holiday_year     SMALLINT NOT NULL,
  payrule_version  TEXT NOT NULL,
  config_snapshot  JSONB NOT NULL,   -- frozen copy of every rule used
  initiated_by BIGINT NOT NULL REFERENCES employee(id),
  approved_by  BIGINT REFERENCES employee(id),
  approved_at  timestamptz,
  posted_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, run_no)
);
CREATE INDEX ix_run_status ON payroll_run (status)
  WHERE status NOT IN ('POSTED','VOID');

CREATE TABLE payroll_run_item (   -- per-employee register row
  run_id      BIGINT NOT NULL REFERENCES payroll_run(id),
  employee_id BIGINT NOT NULL REFERENCES employee(id),

  -- frozen inputs
  days_worked      NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_absent      NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_leave_paid  NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_holiday_rh  NUMERIC(5,2) NOT NULL DEFAULT 0,
  days_holiday_snw NUMERIC(5,2) NOT NULL DEFAULT 0,
  hours_regular    NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_ot_ord     NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_ot_rd      NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_ot_specl   NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_ot_rh      NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_ot_rh_rd   NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_nsd        NUMERIC(8,2) NOT NULL DEFAULT 0,
  late_s           epoch_s NOT NULL DEFAULT 0,
  undertime_s      epoch_s NOT NULL DEFAULT 0,

  -- outputs
  basic_pay        php_amount NOT NULL DEFAULT 0,
  ot_pay           php_amount NOT NULL DEFAULT 0,
  nsd_pay          php_amount NOT NULL DEFAULT 0,
  holiday_pay      php_amount NOT NULL DEFAULT 0,
  rest_day_pay     php_amount NOT NULL DEFAULT 0,
  other_earnings   php_amount NOT NULL DEFAULT 0,
  gross_pay        php_amount NOT NULL DEFAULT 0,
  taxable_pay      php_amount NOT NULL DEFAULT 0,
  total_deductions php_amount NOT NULL DEFAULT 0,
  total_employer   php_amount NOT NULL DEFAULT 0,
  net_pay          php_amount NOT NULL DEFAULT 0,

  -- statutory subtotals (BIR Alphalist + SSS/PHIC/HDMF remittance returns)
  sss_ee       php_amount NOT NULL DEFAULT 0,
  sss_er       php_amount NOT NULL DEFAULT 0,
  sss_wisp_ee  php_amount NOT NULL DEFAULT 0,
  sss_wisp_er  php_amount NOT NULL DEFAULT 0,
  phic_ee      php_amount NOT NULL DEFAULT 0,
  phic_er      php_amount NOT NULL DEFAULT 0,
  hdmf_ee      php_amount NOT NULL DEFAULT 0,
  hdmf_er      php_amount NOT NULL DEFAULT 0,
  bir_tax      php_amount NOT NULL DEFAULT 0,

  status          TEXT NOT NULL DEFAULT 'CALCULATED',
  calc_engine_ver TEXT NOT NULL,
  calc_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, employee_id)
);
CREATE INDEX ix_rri_employee ON payroll_run_item (employee_id, run_id);

CREATE TABLE payroll_line (   -- itemized; never aggregate-only
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id       BIGINT NOT NULL REFERENCES payroll_run(id),
  employee_id  BIGINT NOT NULL REFERENCES employee(id),
  code         TEXT   NOT NULL,  -- 'BASIC','OT_ORD','NSD','RH_PAY','SSS_EE','TAX_BIR'
  kind         line_kind NOT NULL,
  label        TEXT   NOT NULL,
  amount       php_amount NOT NULL,
  taxable_class taxable_class NOT NULL DEFAULT 'TAXABLE',
  basis_amount php_amount,       -- the base the rate applied to
  rate         NUMERIC(9,6),     -- 0.15 / 1.25 / 0.10 ...
  formula      TEXT,             -- 'MSC 30000 x 0.05'
  source_ref   TEXT,             -- attendance_day PK / leave_application / adjustment
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_line_run_emp ON payroll_line (run_id, employee_id, sort_order);
CREATE INDEX ix_line_code    ON payroll_line (run_id, code);

CREATE TABLE payroll_adjustment (  -- off-cycle; never rewrites a POSTED run
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id        BIGINT NOT NULL REFERENCES payroll_run(id),
  employee_id   BIGINT NOT NULL REFERENCES employee(id),
  line_code     TEXT   NOT NULL,
  amount        php_amount NOT NULL,
  reason        TEXT   NOT NULL,
  approved_by   BIGINT NOT NULL REFERENCES employee(id),
  effective_period_id BIGINT NOT NULL REFERENCES payroll_period(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payslip_revision (   -- historical audit / dispute evidence
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      BIGINT NOT NULL,
  employee_id BIGINT NOT NULL,
  revision    INTEGER NOT NULL,
  payload     JSONB NOT NULL,     -- frozen rendered payslip
  checksum    BYTEA  NOT NULL,
  rendered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, employee_id, revision)
);
```

---

### 1.9 Versioned Statutory Configuration

```sql
CREATE TABLE sss_schedule (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from DATE NOT NULL,
  effective_to   DATE,
  total_rate     NUMERIC(5,4) NOT NULL,   -- 0.15 (RA 11199 gradual schedule)
  ee_rate        NUMERIC(5,4) NOT NULL,   -- 0.05
  er_rate        NUMERIC(5,4) NOT NULL,   -- 0.10
  msc_min        php_amount NOT NULL,
  msc_max        php_amount NOT NULL,
  msc_step       php_amount NOT NULL,     -- 500
  wisp_threshold php_amount NOT NULL,     -- MSC above this -> WISP sub-ledger
  ec_amount      php_amount NOT NULL,     -- Employees' Compensation, ER-only
  source_ref     TEXT NOT NULL            -- 'SSS Circular 2025-006'
);

CREATE TABLE sss_msc_bracket (      -- precomputed; no runtime arithmetic drift
  schedule_id BIGINT NOT NULL REFERENCES sss_schedule(id) ON DELETE CASCADE,
  bracket_no  INTEGER NOT NULL,
  msc_from    php_amount NOT NULL,
  msc_to      php_amount NOT NULL,
  ee_amount   php_amount NOT NULL,   -- 5% of MSC
  er_amount   php_amount NOT NULL,   -- 10% of MSC
  PRIMARY KEY (schedule_id, bracket_no)
);

CREATE TABLE phic_schedule (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from DATE NOT NULL, effective_to DATE,
  premium_rate   NUMERIC(5,4) NOT NULL,   -- 0.05 (UHC Act)
  base_floor     php_amount NOT NULL,     -- 10000
  base_ceiling   php_amount NOT NULL,     -- 100000
  ee_share       NUMERIC(5,4) NOT NULL,   -- 0.50
  er_share       NUMERIC(5,4) NOT NULL,   -- 0.50
  source_ref     TEXT NOT NULL
);

CREATE TABLE hdmf_schedule (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from DATE NOT NULL, effective_to DATE,
  ee_rate        NUMERIC(5,4) NOT NULL,   -- 0.02
  er_rate        NUMERIC(5,4) NOT NULL,   -- 0.02
  comp_ceiling   php_amount NOT NULL,     -- 10000 -> max PHP 200 each
  source_ref     TEXT NOT NULL
);

CREATE TABLE bir_tax_table (   -- the CANONICAL annual graduated table
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from DATE NOT NULL, effective_to DATE,
  variant        TEXT NOT NULL DEFAULT 'NON_MANAGERIAL'
    CHECK (variant IN ('NON_MANAGERIAL','MANAGERIAL')),
  bracket_no     SMALLINT NOT NULL,
  bracket_from   php_amount NOT NULL,   -- annual, exclusive
  bracket_to     php_amount,            -- NULL = infinity
  base_tax       php_amount NOT NULL,   -- tax at bracket_from
  marginal_rate  NUMERIC(5,4) NOT NULL, -- 0.15/0.20/0.25/0.30/0.35
  over_amount    php_amount NOT NULL,   -- subtractor (= bracket_from)
  source_ref     TEXT NOT NULL,         -- 'NIRC s24 as amended by RA 10963, RR 11-2018'
  UNIQUE (variant, effective_from, bracket_no)
);

CREATE TABLE allowance_type (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,   -- 'RICE','CLOTHING','MEDICAL','LAUNDRY','PERF_BONUS'
  name        TEXT NOT NULL,
  taxable     BOOLEAN NOT NULL,       -- FALSE -> de minimis
  monthly_cap php_amount,             -- de minimis monthly ceiling
  annual_cap  php_amount,             -- 90000 for 13th month + benefits aggregate
  is_fixed    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE employee_allowance (
  employee_id  BIGINT NOT NULL REFERENCES employee(id),
  allowance_id BIGINT NOT NULL REFERENCES allowance_type(id),
  amount       php_amount NOT NULL,
  frequency    pay_frequency NOT NULL DEFAULT 'MONTHLY',
  valid_from   DATE NOT NULL, valid_to DATE,
  PRIMARY KEY (employee_id, allowance_id, valid_from)
);
```

---

### 1.10 Partitioning & Indexing Matrix

| Table | Strategy | Key | Rationale |
|---|---|---|---|
| `punch_raw` | RANGE monthly on `punch_ts_utc` | UNIQUE `idempotency_key` | Hot append path; drop past retention; time-prune every scan |
| `attendance_day` | HASH 16 on `employee_id` | PK `(employee_id, work_date)` | Point lookups dominate; hash evens write contention |
| `payroll_line` | HASH 32 on `employee_id` | `(run_id, employee_id, sort_order)` | Shards a 400k-row run over 32 heaps for parallel scan |
| `schedule_day` | none (<=2M rows/yr) | partial UNIQUE `WHERE valid_to IS NULL` | Excludes superseded revisions entirely |
| `leave_ledger` | none | partial unique dedupe index | Enforces accrual idempotency at the DB |
| `payroll_run_item` | HASH on `employee_id` | PK `(run_id, employee_id)` | Concurrent workers write to different heaps |

**Global rules**

- Every FK is indexed (Postgres does not auto-index FKs).
- Partial indexes (`WHERE`) wherever the predicate is stable — 5–20x smaller.
- Append-only time-series tables (`punch_raw`, `payroll_line`) get **BRIN** on time columns where a BTREE would be wasteful.
- Reports hit a **read replica**; the primary serves writes plus interactive point reads.
- No `SELECT ... FOR UPDATE` on hot tables. Contention is handled with `SKIP LOCKED` job claims (§4.3) and advisory locks on run identity only.

---

## 2. BPO Timekeeping & Attendance Core Logic

### 2.1 Time Model

```python
TZ = ZoneInfo("Asia/Manila")   # fixed UTC+08:00, no DST -> conversions are trivial

NIGHT_START = time(22, 0)      # 10:00 PM
NIGHT_END   = time(6, 0)       # 6:00 AM
```

**Operational-date rule (critical).** Every schedule segment and every resolved punch pair maps to a single `work_date` = **local calendar date of the shift anchor (scheduled start)**. A `22:00 -> 06:00` shift starting 2026-10-05 and ending 2026-10-06 has `work_date = 2026-10-05` for *all* of its hours, punches, holiday determinations and OT attribution.

Midnight is therefore a non-event inside a shift: segments are compared as absolute UTC instants, and night hours are computed by interval intersection (§3.2) then summed onto the operational date.

---

### 2.2 Grace Periods & Lateness — Multi-Tier Configuration

```sql
CREATE TABLE grace_tier (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope_type   TEXT NOT NULL CHECK (scope_type IN ('GLOBAL','CAMPAIGN','SHIFT','EMPLOYEE')),
  scope_id     BIGINT,                 -- NULL for GLOBAL
  tier_no      SMALLINT NOT NULL,
  min_offset_s INTEGER NOT NULL,       -- inclusive lower bound (s after scheduled start)
  max_offset_s INTEGER NOT NULL,       -- inclusive upper bound
  disposition  TEXT NOT NULL CHECK (disposition IN
                 ('ON_TIME','FLEX_ABSORB','FLAG_LATE','DEDUCT_MINUTES','ABSENT')),
  deduction_rounding_s INTEGER NOT NULL DEFAULT 0,  -- 0=exact, 900=round up to 15 min
  points       SMALLINT NOT NULL DEFAULT 0,         -- attendance scorecard
  effective_from DATE NOT NULL, effective_to DATE
);
```

**Default tier matrix (campaign-overridable):**

| Tier | Window after scheduled start | Disposition | Rounding | Effect |
|---|---|---|---|---|
| 0 | <= 0 s | `ON_TIME` | — | 0 |
| 1 | 1–300 s (<=5 min) | `FLEX_ABSORB` | exact | 0; recorded in `flex_s`, charged against daily/weekly flex quota |
| 2 | 301–900 s (5–15 min) | `FLAG_LATE` | exact | 0 deducted; scorecard flag |
| 3 | 901–1800 s (15–30 min) | `DEDUCT_MINUTES` | round up to 900 s | deduct late seconds |
| 4 | > 1800 s | `DEDUCT_MINUTES` | round up to 900 s | deduct + `points` |
| 5 | no valid IN by `start + earliest_in_s + 1800` | `ABSENT` | — | full scheduled day, `LWP` if unpaid |

Undertime mirrors this on punch-out using `ends_at +/- latest_out_s`.

```python
def evaluate_lateness(sched, punch_in_local, tiers, flex_quota_remaining_s):
    delta = (punch_in_local - sched.start_local).total_seconds()   # > 0 = late
    if delta <= 0:
        return Result(late_s=0, flex_s=0, disposition="ON_TIME")

    tier = next((t for t in tiers
                 if t.min_offset_s < delta <= t.max_offset_s), tiers[-1])

    if tier.disposition in ("ON_TIME", "FLEX_ABSORB"):
        if delta <= flex_quota_remaining_s:           # quota is per-day or rolling-week
            return Result(late_s=0, flex_s=delta, disposition="FLEX_ABSORB")
        overflow = delta - flex_quota_remaining_s
        return Result(late_s=overflow, flex_s=flex_quota_remaining_s,
                      disposition="DEDUCT_MINUTES")

    if tier.disposition == "FLAG_LATE":
        return Result(late_s=delta, flex_s=0, disposition="FLAG_LATE")

    if tier.disposition == "DEDUCT_MINUTES":
        deduct = (ceil_to(delta, tier.deduction_rounding_s)
                  if tier.deduction_rounding_s else delta)
        return Result(late_s=deduct, flex_s=0, disposition="DEDUCT_MINUTES")

    return Result(late_s=sched.scheduled_s, flex_s=0, disposition="ABSENT")
```

**Flex-time (`is_flexi`):** `flex_window_s` shifts the effective window rather than the tier. A 30-minute flex window on a 22:00 shift makes 21:30–22:30 all `ON_TIME`, with `flex_s` still recorded for the audit trail but never deducted.

---

### 2.3 Shift Matching Algorithm

Raw punches are context-free. The matcher binds each punch to a `schedule_day` segment. Requirement: O(n log n), deterministic, midnight-safe, tolerant of out-of-order arrival.

**Phase 1 — Candidate generation**

```python
def candidates(punch, schedule_index):
    """
    schedule_index: interval index over schedule_day rows overlapping the window.
    Absolute-instant comparison makes the midnight crossing invisible:
    ends_at_utc for a 22:00->06:00 shift is already 06:00 the NEXT day.
    """
    lo = punch.utc - timedelta(seconds=MAX_EARLY_PUNCH_S)   # 3600  (1h early)
    hi = punch.utc + timedelta(seconds=MAX_LATE_PUNCH_S)    # 14400 (4h late)
    return [s for s in schedule_index.overlap(lo, hi)]
```

**Phase 2 — Scoring**

```python
def score(punch, seg):
    # 1. Boundary proximity (dominant signal): distance to the nearer edge
    dist_in  = abs((punch.utc - seg.starts_at_utc).total_seconds())
    dist_out = abs((punch.utc - seg.ends_at_utc).total_seconds())
    boundary = min(dist_in, dist_out)

    site_match = 1.0 if punch.device.site_code in seg.site_codes else 0.0
    dir_ok     = 1.0 if plausible_direction(punch, seg) else 0.0
    slot_free  = 0.0 if seg.role_taken(punch.preferred_role) else 1.0

    return (-1.0 * boundary) + (0.35 * site_match) + (0.50 * dir_ok) + (2.0 * slot_free)
```

**Phase 3 — Global assignment, not per-punch greedy.** Greedy breaks when adjacent shifts are close: `06:00–14:00` ends and `14:00–22:00` starts, so an OUT punch at `14:03` is ambiguous. Model as **min-cost bipartite matching** — punches on the left, `(segment, role)` slots on the right, edge cost = `-score`. Hungarian runs in microseconds at <= 20 punches/employee/day. The shipped hot path uses constrained greedy over *time-sorted* punches and segments with boundary-distance tie-break, which produces the identical result for every case in the edge matrix below.

```python
def match_day(employee, punches, segments):
    punches   = sorted(punches,   key=lambda p: p.utc)
    segments  = sorted(segments,  key=lambda s: s.starts_at_utc)
    slots     = [Slot(s, role) for s in segments for role in ("IN", "OUT")]

    for p in punches:
        cands = [sl for sl in slots
                 if not sl.taken and p.utc in sl.segment.acceptance_window]
        if not cands:
            p.mark_unmatched()               # -> dangling bucket, supervisor queue
            continue
        best = min(cands, key=lambda sl: (abs((p.utc - sl.edge).total_seconds()),
                                          0 if sl.role == p.guess_role else 1))
        best.take(p)

    # Phase 4 - repair: close open segments with synthetic punches
    for seg in segments:
        if seg.IN and not seg.OUT:
            seg.OUT = synthesize(seg.end + seg.latest_out_s)
            seg.status, seg.needs_review = "INCOMPLETE_PUNCH", True
        elif seg.OUT and not seg.IN:
            seg.IN  = synthesize(seg.start)
            seg.status, seg.needs_review = "INCOMPLETE_PUNCH", True
        elif not seg.IN and not seg.OUT:
            seg.mark_absent()                # -> grace tier 5
    return segments
```

**Phase 5 — Out-of-order / late arrival.** Devices buffer offline and flush late, so the engine assumes no ordering:

1. Ingest into `punch_raw` with zero ordering assumption.
2. Per-device **watermark** = `now() - LATENESS_ALLOWANCE` (default 900 s), driven by `device.last_seen_at`.
3. Any punch marks `(employee_id, affected_operational_date)` dirty in `punch_invalidation`.
4. A **day-recompute consumer** rebuilds only dirty keys: delete derived rows, re-run `match_day` from immutable raw. Idempotent by construction.

**Edge-case matrix**

| Scenario | Handling |
|---|---|
| Punch 9:45 PM for a 10:00 PM shift | `dist_in = 900 s` < `earliest_in_s (1800)` → matched IN, `ON_TIME` |
| Punch 9:20 PM for a 10:00 PM shift | outside acceptance window → **unmatched** → adjudication queue |
| Shift 22:00→06:00, OUT punch 06:07 next calendar day | `ends_at_utc` is the absolute instant → `dist_out = 420 s` → matched; `work_date` stays at anchor date |
| Punch 14:03, two shifts 06:00–14:00 and 14:00–22:00 | boundary-distance tie-break + slot-free term resolve; residual ambiguity flagged `needs_review` |
| Split shift 06:00–14:00 + 22:00–06:00 on one `work_date` | two legs under one `schedule_day` via `shift_leg`; punches assign per segment |
| Punch outside any segment | `dangling` bucket → excluded from `worked_s` until adjudicated |
| Duplicate punches < 60 s apart, same device+code | blocked at insert by `ux_punch_idem`, plus a post-insert dedupe pass |
| Missing OUT | auto-close at `ends_at + latest_out_s`, `INCOMPLETE_PUNCH`, `needs_review` |
| Punch on a rest day with no `schedule_day` | creates implicit `REST_DAY_WORK` obligation if campaign policy allows, else `NOT_SCHEDULED` |
| Same instant from two devices | both stored (distinct `payload_hash`); matcher claims one slot; other retained as audit trail |
| Punch at 00:10 belonging to yesterday's night shift | falls inside `[start, end]` absolute window of the anchor-date segment → correct day |
| Employee transfers campaign mid-shift | segment `campaign_id` pins the whole operational day |

---

### 2.4 Day Assembly

```python
def assemble_day(employee, operational_date) -> AttendanceDay:
    segs    = load_segments(employee.id, operational_date)
    punches = load_punches(employee.id,
                            (segs.min_start - 2h, segs.max_end + 4h))
    holiday = holiday_calendar.resolve(operational_date, employee.campaign_id)
    leave   = leave_service.posted_overlap(employee.id, operational_date)
    is_rest = (operational_date in employee.rest_days
               or any(s.is_rest_day for s in segs))

    if not segs:
        return AttendanceDay(status="NOT_SCHEDULED", punches=punches)

    matched = match_day(employee, punches, segs)

    if leave and leave.suppresses_absence(operational_date):
        # LEAVE OVERRIDE - short-circuits absent detection
        return AttendanceDay(status="LEAVE", leave_id=leave.id,
                             leave_hours=leave.hours_for(operational_date),
                             day_multiplier=leave.multiplier)

    d = AttendanceDay(is_rest_day=is_rest,
                      holiday_id=holiday.id,
                      presence_before_holiday=presence_on_prior_workday(employee, operational_date))
    for s in matched:
        d.scheduled_s += s.scheduled_s
        if s.in and s.out:
            d.worked_s += net_worked(s.in, s.out, s.unpaid_meal_s)
            lr = evaluate_lateness(s, s.in, tiers, flex_quota)
            d.late_s, d.flex_s = d.late_s + lr.late_s, d.flex_s + lr.flex_s
            d.undertime_s += evaluate_undertime(s, s.out, tiers)
            d.night_s     += overlap_with_night_band(s.in, s.out, s.unpaid_meal_s)
        elif s.absent:
            d.absent_s += s.scheduled_s

    if d.worked_s == 0 and d.absent_s > 0:
        d.status = "LWP" if unpaid else "ABSENT"
    else:
        d.status = "PRESENT" if d.absent_s == 0 else "HALF_DAY"

    ot = compute_ot(d, ot_approvals_for(employee.id, operational_date), policy)
    d.ot_worked_s, d.ot_unapproved_s, d.night_ot_s = ot.ot_s, ot.unapproved_s, ot.night_ot_s

    d.day_multiplier = premium_matrix.lookup(holiday.kind, is_rest, worked=d.worked_s > 0)
    d.ot_multiplier  = ot_matrix.lookup(holiday.kind, is_rest)
    d.rule_version   = CURRENT_RULE_VERSION
    return d
```

---

### 2.5 Overtime Calculation

OT is computed **per operational day**, from actual punches, then **clamped** by authorization.

```python
def compute_ot(day, approvals, policy):
    raw_ot_s = max(0, day.worked_s - day.scheduled_s)

    # 1. Classify by the DAY the OT falls on
    bucket = classify(day.holiday_kind, day.is_rest_day)

    # 2. Split the night portion so NSD-on-OT uses the right base (see 3.2)
    night_ot_s = min(day.night_ot_s, raw_ot_s)

    # 3. Authorization clamp
    approved = approvals.total_s_for(day.work_date)
    if policy.mode == "MANAGER_APPROVAL":
        allowed        = min(raw_ot_s, approved)
        day.ot_unapproved_s = raw_ot_s - allowed      # flagged, unpaid by default
    else:
        allowed = raw_ot_s

    # 4. Increment rounding (campaign: 30-min OT blocks)
    if policy.ot_rounding_s:
        allowed = ceil_to(allowed, policy.ot_rounding_s)

    # 5. Labor Code ceiling: total work incl. OT <= 12 h/day
    allowed = min(allowed, policy.max_ot_daily_s)
    return OT(bucket=bucket, ot_s=allowed,
              night_ot_s=min(night_ot_s, allowed), unapproved_s=raw_ot_s - allowed)
```

**Classification matrix:**

| `holiday_kind` | rest day? | Bucket | Hours field |
|---|---|---|---|
| none | no | `ORDINARY` | `hours_ot_ord` |
| none | yes | `REST_DAY` | `hours_ot_rd` |
| `SPECIAL_NONWORKING` | no | `SPECIAL_NW` | `hours_ot_specl` |
| `SPECIAL_NONWORKING` | yes | `SPECIAL_NW_REST` | `hours_ot_specl` |
| `REGULAR` | no | `REGULAR_HOLIDAY` | `hours_ot_rh` |
| `REGULAR` | yes | `REGULAR_HOLIDAY_REST` | `hours_ot_rh_rd` |

**Rest-day work is not OT.** Hours *within* a scheduled rest-day shift are `REST_DAY_WORKED` (paid at the rest-day multiplier); only hours *beyond* the scheduled rest-day duration are `REST_DAY OT`. Conflating the two is the single most common PH payroll defect.

---

### 2.6 Leave ↔ Timekeeping Interface

The timekeeping engine never computes balances. It consumes **posted, immutable leave facts**.

```python
def leave_override(employee_id, operational_date, day):
    app = leave_repo.posted_for(employee_id, operational_date)
    if not app:
        return day
    lt = app.leave_type

    if app.unit == "FULL_DAY" and lt.counts_as_present:
        day.status      = "LEAVE"
        day.leave_id    = app.id
        day.leave_hours = 8.0
        day.absent_s    = 0        # <-- automatic absent suppression
        day.scheduled_s = 0        # <-- excluded from attendance ratios
        return day

    if app.unit == "HALF_DAY":
        day.leave_hours  = app.hours
        day.scheduled_s -= int(app.hours * 3600)
        day.absent_s     = 0
        day.status       = "HALF_DAY"
        return day

    return day
```

**Balances feed payroll directly.** On run CALCULATION, approved-leave hours become a taxable `LEAVE_PAY` earning line and simultaneously decrement `leave_ledger` through an idempotent `reason_code='PAYROLL_USAGE_<run_id>'` entry guarded by `ux_ledger_dedupe` — a re-run cannot double-debit, and a rolled-back run leaves no ledger residue.

---

## 3. Philippine-Compliant Payroll Engine

### 3.1 Period, Cutoff & Execution Order

Semi-monthly cut-offs (Art. 103 as amended by RA 8951): **cut-off on the 15th and the last day of the month**, pay within 10 calendar days (or 2 working days for daily-paid).

**Calculation pipeline (strict, one direction, no back-edges):**

```
 1. FREEZE     OPEN -> CALCULATING; snapshot every statutory table + holiday set
 2. TIMEKEEP   recompute dirty attendance_days in window            [parallel]
 3. AGGREGATE  attendance_day -> payroll_run_item hour/day counters  [parallel]
 4. EARNINGS   basic, rest-day, holiday, OT, NSD, allowances          [parallel, pure]
 5. GROSS      sum earnings
 6. STATUTORY  SSS -> PhilHealth -> Pag-IBIG                          [parallel, pure]
 7. TAXABLE    gross - statutory - non-taxable de minimis
 8. WITHHOLD   BIR graduated table on taxable pay                     [parallel, pure]
 9. NET        gross - deductions
10. AUTHORIZE  line review -> APPROVED -> POSTED
```

Steps 3–9 are pure functions of frozen inputs. No step reads mutable state.

```python
def calc_employee(run, emp, days, tables) -> PayrollItem:
    """Pure. Deterministic. Idempotent by (run_id, employee_id)."""
    i = PayrollItem()

    # --- 3. AGGREGATE ---
    (i.hours_regular, i.hours_ot_ord, i.hours_ot_rd, i.hours_ot_specl,
     i.hours_ot_rh, i.hours_ot_rh_rd, i.hours_nsd) = bucket_hours(days)
    i.days_worked     = count(days, lambda d: d.worked_s > 0)
    i.days_absent     = count(days, lambda d: d.status == "ABSENT")
    i.days_leave_paid = count(days, lambda d: d.status == "LEAVE" and d.leave_paid)
    i.days_holiday_rh = count(days, lambda d: d.holiday_kind == "REGULAR")
    i.days_holiday_snw = count(days, lambda d: d.holiday_kind == "SPECIAL_NONWORKING")

    # --- 4. EARNINGS ---
    hourly, daily = emp.hourly_rate, emp.daily_rate

    i.basic_pay  = (i.days_worked * daily
                    + i.days_leave_paid * daily
                    - absences_deduction(emp, i.days_absent, daily))   # 3.6
    i.rest_day_pay = sum(rest_day_lines(days, daily))
    i.holiday_pay  = sum(holiday_lines(days, daily))                    # 3.3

    i.ot_pay = (i.hours_ot_ord   * hourly * OT_MATRIX["ORDINARY"]
              + i.hours_ot_rd    * hourly * OT_MATRIX["REST_DAY"]
              + i.hours_ot_specl * hourly * OT_MATRIX["SPECIAL_NW"]
              + i.hours_ot_rh    * hourly * OT_MATRIX["REGULAR_HOLIDAY"]
              + i.hours_ot_rh_rd * hourly * OT_MATRIX["REGULAR_HOLIDAY_REST"])

    i.nsd_pay = nsd_pay(hourly, days)                                   # 3.2
    i.other_earnings = allowances(emp)                                  # 3.5

    i.gross_pay = round2(i.basic_pay + i.rest_day_pay + i.holiday_pay
                       + i.ot_pay + i.nsd_pay + i.other_earnings)

    # --- 6. STATUTORY (base = statutory basic, NOT gross) ---
    base = emp.base_salary_monthly
    sss  = compute_sss(base,  tables.sss,  run.proration)               # 3.4.1
    phic = compute_phic(base, tables.phic, run.proration)               # 3.4.2
    hdmf = compute_hdmf(emp,  tables.hdmf, run.proration)               # 3.4.3
    i.sss_ee, i.sss_er, i.sss_wisp_ee, i.sss_wisp_er = sss.split()
    i.phic_ee, i.phic_er = phic.split()
    i.hdmf_ee, i.hdmf_er = hdmf.split()

    # --- 7. TAXABLE ---
    statutory_ded  = i.sss_ee + i.phic_ee + i.hdmf_ee + union_dues(emp)
    de_minimis     = sum(a.amount for a in allowances(emp) if not a.taxable)
    i.taxable_pay  = max(0, i.gross_pay - statutory_ded - de_minimis)

    # --- 8. WITHHOLDING ---
    i.bir_tax = withholding(i.taxable_pay, run.frequency, tables.bir, emp)  # 3.4.4

    # --- 9. NET ---
    i.total_deductions = (statutory_ded + i.bir_tax
                        + loans(emp) + advances(emp) + other_deductions(emp))
    i.net_pay = round2(i.gross_pay - i.total_deductions)
    i.total_employer = sss.total_er + phic.total_er + hdmf.total_er
    return i
```

---

### 3.2 Night Shift Differential (NSD) — 10%, 10PM–6AM

**Legal basis:** Labor Code Art. 86 — every employee shall be paid a night shift differential of **not less than 10% of his regular wage for each hour of work performed between 10:00 PM and 6:00 AM.**

**Interval-intersection algorithm (midnight-safe):**

```python
NSD_RATE = 0.10

def night_overlap_seconds(start_utc, end_utc, meal_windows_local) -> int:
    """
    Sum overlap between [start,end] and every local night band
    [22:00, next-day 06:00) in Asia/Manila. Fixed +08:00 offset makes
    bands trivially derivable. Unpaid meal windows are subtracted.
    """
    total = 0
    lo_e, hi_e = start_utc.astimezone(TZ), end_utc.astimezone(TZ)
    day = lo_e.date()
    while True:
        band_s = datetime.combine(day, time(22, 0), TZ)
        band_e = datetime.combine(day + timedelta(days=1), time(6, 0), TZ)
        lo, hi = max(lo_e, band_s), min(hi_e, band_e)
        if lo < hi:
            secs = int((hi - lo).total_seconds())
            secs -= overlap_with(lo, hi, meal_windows_local)
            total += max(0, secs)
        if band_s >= hi_e:
            break
        day += timedelta(days=1)
    return total
```

**Worked example — `22:00 → 06:00` shift, IN 21:52, OUT 06:07, unpaid meal 02:00–03:00:**

| Segment | Night band intersected | Seconds | Hours |
|---|---|---|---|
| 21:52 → 02:00 | 22:00 → 02:00 | 14,400 | 4.00 |
| 03:00 → 06:07 | 03:00 → 06:00 | 10,800 | 3.00 |
| 06:00 → 06:07 | outside band | 0 | 0 |
| **Total night** | | **25,200** | **7.00** |

Note the punch pair straddles two calendar dates; both map to `work_date = anchor date`.

**NSD base rate and stacking:**

```python
def nsd_pay(hourly_rate, night_regular_s, night_ot_s_by_bucket):
    """
    NSD base = the rate actually payable for that hour.
      regular night hour -> x 1.00
      OT night hour      -> x its bucket multiplier (1.25 / 1.30 / 2.60 ...)
    NSD is additive ON TOP of that rate, never absorbed into it.
    """
    pay = hourly_rate * (night_regular_s / 3600) * NSD_RATE
    for bucket, secs in night_ot_s_by_bucket.items():
        m = OT_MATRIX[bucket]
        pay += hourly_rate * (secs / 3600) * m * NSD_RATE
    return round2(pay)
```

**NSD truth table:**

| Hour type | Hourly base | NSD | Total for that hour |
|---|---|---|---|
| Regular night hour | 1.00x | +10% of 1.00x | **1.100x** |
| OT night, ordinary day | 1.25x | +10% of 1.25x | **1.375x** |
| OT night, rest day | 1.30x | +10% of 1.30x | **1.430x** |
| OT night, regular holiday | 2.60x | +10% of 2.60x | **2.860x** |

**Rules**

1. NSD is computed on **actual night hours worked**, never on scheduled hours. An unworked night hour earns nothing.
2. NSD is **not** applied to unpaid meal breaks.
3. NSD **is** applied to night hours on a worked regular holiday, on top of the holiday multiplier (composable: 2.00 x 1.10 = 2.20 for a regular night hour on an RH).
4. Unworked regular holiday night hours earn only the 100% unworked-holiday baseline — **no NSD**.
5. NSD is reported on the payslip as its own line (`NSD`), separate from OT, so auditors can verify Art. 86 independently.

---

### 3.3 Holiday Pay — Worked vs. Unworked Baseline

**Legal basis:** Labor Code Arts. 93–94; DOLE Handbook on Workers' Statutory Monetary Benefits.

Multipliers are **stored as data**, not code. The engine performs a 3-way lookup: `(holiday_kind, is_rest_day, worked)`.

```sql
CREATE TABLE premium_matrix (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  effective_from DATE NOT NULL, effective_to DATE,
  holiday_kind   holiday_kind NOT NULL,  -- plus 'NONE' pseudo-kind for ordinary days
  is_rest_day    BOOLEAN NOT NULL,
  worked         BOOLEAN NOT NULL,
  first_8h_multiplier NUMERIC(6,4) NOT NULL,
  ot_hour_multiplier  NUMERIC(6,4) NOT NULL,
  nsd_applies         BOOLEAN NOT NULL DEFAULT TRUE,
  pay_when_unworked   BOOLEAN NOT NULL DEFAULT FALSE,  -- RH TRUE, SNW FALSE
  source_ref TEXT NOT NULL
);
```

**The matrix (populate as effective-dated rows):**

| # | Holiday kind | Rest day? | Worked? | 1st 8 h | OT hourly | Unworked pay |
|---|---|---|---|---|---|---|
| 1 | Ordinary | no | yes | **100%** | 125% | n/a (absent / LWP) |
| 2 | Ordinary | yes | yes | **130%** | 130% | n/a |
| 3 | Regular | no | yes | **200%** | 260% | — |
| 4 | Regular | no | no | — | — | **100%** |
| 5 | Regular | yes | yes | **260%** | 260% | — |
| 6 | Regular | yes | no | — | — | **100%** |
| 7 | Special NW | no | yes | **130%** | 130% | — |
| 8 | Special NW | no | no | — | — | **0%** (no work, no pay) |
| 9 | Special NW | yes | yes | **150%** | 150% | — |
| 10 | Special NW | yes | no | — | — | **0%** |

> Rows 9/10 (Special NW falling on a rest day) and the OT columns are the most frequently contested combinations. Populate from the **current DOLE Handbook** and obtain counsel sign-off. The engine applies whatever is stored — a change of law is a data migration, not a code change.

**Application logic**

```python
def holiday_lines(days, daily_rate, matrix):
    lines = []
    for d in days:
        if d.holiday_kind is None:
            continue
        m = matrix.lookup(d.holiday_kind, d.is_rest_day, worked=d.worked_s > 0)
        hourly = daily_rate / 8

        if d.worked_s > 0:
            hours     = d.worked_s / 3600
            base_hrs  = min(hours, 8)
            ot_hrs    = max(0, hours - 8)

            # premium above the ordinary 100% already paid as basic
            lines.append(PayLine(
                code="RH_PAY" if d.holiday_kind == "REGULAR" else "SNW_PAY",
                amount=round2(daily_rate * (m.first_8h_multiplier - 1.0) * (base_hrs / 8)),
                taxable_class="TAXABLE",
                formula=f"{daily_rate} x ({m.first_8h_multiplier}-1) x {base_hrs}/8h"))

            if ot_hrs > 0:
                lines.append(PayLine(
                    code="HOL_OT", amount=round2(hourly * ot_hrs * m.ot_hour_multiplier),
                    formula=f"{hourly} x {ot_hrs}h x {m.ot_hour_multiplier}"))
        elif m.pay_when_unworked and d.presence_before_holiday:
            lines.append(PayLine(
                code="RH_UNWORKED", amount=round2(daily_rate),
                taxable_class="TAXABLE",
                formula=f"{daily_rate} x 1.00 (Art. 94(c): present on prior workday)"))
    return lines
```

**Baseline rules implemented**

1. **Regular holiday, unworked → 100%** of the daily rate, *provided the employee was present or on paid leave on the working day immediately preceding the holiday* (Art. 94(c)). Absent the prior day → **0%**. Encoded as `attendance_day.presence_before_holiday`.
2. **Special non-working, unworked → 0%.** "No work, no pay" applies.
3. **Regular holiday falling on the employee's rest day, unworked → still 100%.** Rest-day status does not extinguish the holiday benefit.
4. **Monthly-paid employees** already receive holiday pay; the unworked rule still gates absence deductions on ordinary days.
5. **13th month pay (PD 851):** 1/12 of total *basic salary* earned during the calendar year, paid on or before Dec 24. Non-taxable **up to ₱90,000 aggregate** with other benefits (RA 10963); excess is taxable. Implemented as a separate run, not a per-cutoff line.
6. **Half-day special non-working days** (`SPECIAL_HALF_DAY`) use the first-4-hours rule: hours 5–8 worked on such a day are unpaid unless company policy is more generous.

---

### 3.4 Statutory Deductions

All three social-insurance computations share one shape: statutory base → clamp to floor/ceiling → look up effective-dated bracket → split EE/ER → prorate for the cutoff.

#### 3.4.1 SSS — RA 11199, with WISP allocation

```python
def compute_sss(monthly_basic, sched, proration=1.0):
    # 1. Map to Monthly Salary Credit (MSC)
    msc = clamp(ceil_to_step(monthly_basic, sched.msc_step), sched.msc_min, sched.msc_max)
    br  = sched.bracket_for(msc)               # precomputed amounts, no runtime drift

    ee_total = round2(br.ee_amount * proration)   # 5% of MSC
    er_total = round2(br.er_amount * proration)   # 10% of MSC

    # 2. WISP: the portion of MSC ABOVE the threshold is credited to the
    #    Worker's Investment & Savings Program sub-ledger, not the Regular
    #    SSS Fund. The 5%/10% EE/ER split is preserved on both portions.
    if msc > sched.wisp_threshold:
        ratio    = (msc - sched.wisp_threshold) / msc
        wisp_ee  = round2(ee_total * ratio)
        wisp_er  = round2(er_total * ratio)
    else:
        wisp_ee = wisp_er = 0

    regular_ee = ee_total - wisp_ee
    regular_er = er_total - wisp_er

    # 3. Employees' Compensation (EC) - fixed ER-only add-on
    er_total = regular_er + wisp_er + sched.ec_amount

    return SSS(regular_ee=regular_ee, regular_er=regular_er,
               wisp_ee=wisp_ee, wisp_er=wisp_er, total_er=er_total)
```

| Parameter | Value | Source |
|---|---|---|
| Total contribution rate | **15%** of MSC | RA 11199 gradual schedule |
| EE share / ER share | **5% / 10%** of MSC | RA 11199 |
| MSC bracket range & step | e.g. 3,500–35,000 in ₱500 steps (verify current Circular) | SSS Contribution Schedule |
| WISP threshold | MSC above **₱20,000** → excess allocated to WISP | SSS WISP rules |
| WISP Plus | optional voluntary top-up, separate deduction code `SSS_WISPPLUS` | SSS WISP Plus program |
| Basis | **monthly basic salary**, not gross; allowances excluded | SSS Circular |

**Semi-monthly handling:** statutory deductions are *monthly* amounts. Each cutoff deducts exactly `round2(monthly / 2)`; the second cutoff of the month absorbs the centavo residual so the monthly total is exact.

```python
def semi_monthly_split(monthly_amount, is_second_cutoff):
    half = round2(monthly_amount / 2)
    if is_second_cutoff:
        return round2(monthly_amount - half)   # residual centavo absorbed here
    return half
```

#### 3.4.2 PhilHealth — RA 11223 (UHC Act)

```python
def compute_phic(monthly_basic, sched, proration=1.0):
    base    = clamp(monthly_basic, sched.base_floor, sched.base_ceiling)  # 10k-100k
    premium = round2(base * sched.premium_rate)          # 5.00%
    ee      = round2(premium * sched.ee_share * proration)  # 2.50% of base
    er      = round2(premium * sched.er_share * proration)  # 2.50% of base
    return PHIC(ee=ee, er=er, total_er=er)
```

| Parameter | Value |
|---|---|
| Premium rate | **5.00%** of monthly basic salary (shared equally) |
| EE / ER | **2.50% / 2.50%** of the clamped base |
| Floor / Ceiling | **₱10,000 / ₱100,000** monthly base |
| Flexi-fund | for households earning > ₱100k — opt-in, separate code `PHIC_FLEXI` |

#### 3.4.3 Pag-IBIG / HDMF — RA 9679

```python
def compute_hdmf(emp, sched, proration=1.0):
    base    = min(emp.base_salary_monthly, sched.comp_ceiling)   # 10,000
    ee      = round2(base * sched.ee_rate * proration)           # 2.00%
    er      = round2(base * sched.er_rate * proration)           # 2.00%
    return HDMF(ee=min(ee, 200.00), er=min(er, 200.00), total_er=min(er, 200.00))
```

| Parameter | Value |
|---|---|
| EE rate | **2%** of monthly compensation, capped at ₱10,000 → max **₱200** |
| ER rate | **2%** of monthly compensation, capped at ₱10,000 → max **₱200** |
| MP2 (Modified Pag-IBIG II) | voluntary, employee-initiated, never auto-deducted without written authorization |
| Membership / mid-year savings | separate codes, employee-opted |

#### 3.4.4 BIR Withholding Tax — NIRC §24, TRAIN (RA 10963)

**Canonical annual graduated table** (stored in `bir_tax_table` as effective-dated rows):

| Bracket | Annual taxable compensation | Base tax | Marginal rate |
|---|---|---|---|
| 1 | 0 – 250,000 | 0 | **0%** |
| 2 | 250,001 – 400,000 | 0 | **15%** of excess over 250,000 |
| 3 | 400,001 – 800,000 | 22,500 | **20%** of excess over 400,000 |
| 4 | 800,001 – 2,000,000 | 102,500 | **25%** of excess over 800,000 |
| 5 | 2,000,001 – 8,000,000 | 402,500 | **30%** of excess over 2,000,000 |
| 6 | 8,000,001 and above | 2,202,500 | **35%** of excess over 8,000,000 |

**Periodic derivation rule — the engine stores only the annual table and derives period tables, so a law change is one data migration:**

```python
def withholding(taxable_this_period, frequency, bir_table, emp):
    if emp.is_minimum_wage_exempt:
        return 0.0   # substituted withholding: annual taxable <= 250,000

    divisor = {"DAILY": 261, "WEEKLY": 52, "SEMI_MONTHLY": 24, "MONTHLY": 12}[frequency]
    annual_equivalent = round2(taxable_this_period * divisor)

    br = bir_table.bracket_for(annual_equivalent)
    annual_tax = br.base_tax + (annual_equivalent - br.over_amount) * br.marginal_rate

    period_tax = annual_tax / divisor
    return max(0.0, round2(period_tax))
```

**Worked example — ₱30,000 semi-monthly taxable, non-managerial, regular table:**

| Step | Value |
|---|---|
| Period taxable | 30,000.00 |
| Annual equivalent (x24) | 720,000.00 |
| Bracket | #3 (400,001 – 800,000) |
| Annual tax | 22,500 + (720,000 − 400,000) × 0.20 = 22,500 + 64,000 = **86,500** |
| Period tax (÷24) | **3,604.17** |

**Pre-derived semi-monthly table (equivalent, for reconciliation):**

| Taxable semi-monthly | Tax |
|---|---|
| 0 – 10,417 | 0 |
| 10,417 – 16,667 | 15% of excess over 10,417 |
| 16,667 – 33,333 | 937.50 + 20% of excess over 16,667 |
| 33,334 – 83,333 | 4,270.80 + 25% of excess over 33,334 |
| 83,334 – 333,333 | 16,770.80 + 30% of excess over 83,334 |
| 333,334 and above | 91,770.80 + 35% of excess over 333,334 |

Verification: the engine's derivation path and this table must agree within ±₱0.02 — assert it in CI (`test_withholding_parity`).

**Additional withholding rules**

1. **13th month and other benefits** count toward annual taxable income under the *annualized* method; under the periodic method they are taxed only to the extent they push cumulative taxable above ₱250,000 (the ₱90,000 non-taxable ceiling applies first).
2. **De minimis benefits are never included in taxable pay** (§3.5).
3. **Substituted withholding** for minimum-wage earners: annual taxable ≤ ₱250,000 → zero withholding, but the employee remains reportable on BIR 2316.
4. **Two table variants** — managerial and non-managerial — selected by `job_position.is_managerial`.
5. **Frozen-rate / exempt** employees are flagged, not deleted, so Alphalist extraction stays complete.
6. Withholding is computed on the period's `taxable_pay`, then **reconciled at year-end** to the cumulative annual figure; any drift is written as an adjustment line in the December run.

---

### 3.5 De Minimis & Taxable Allowances

Separation happens at the **allowance definition** level (`allowance_type.taxable`), not at calculation time. The payroll engine never branches on allowance names.

| Code | Benefit | Taxable? | Ceiling / basis | Source |
|---|---|---|---|---|
| `RICE` | Rice subsidy | **No** | ₱1,500 / month per employee | BIR de minimis |
| `CLOTHING` | Uniform / clothing allowance | **No** | ₱6,000 / year (₱500 / month) | BIR de minimis |
| `MEDICAL` | Medical / hospitalization reimbursement | **No** | ₱10,000 / year, actual & substantiated | BIR de minimis |
| `LAUNDRY` | Laundry allowance | **No** | ₱300 / month | BIR de minimis |
| `MEAL` | Meal / daytime allowance | **No** | ₱30 / working day | BIR de minimis |
| `GIFT` | Gift on major milestone | **No** | ≤ 3 occasions / year, ≤ ₱3,000 each | BIR de minimis |
| `ACHIEVE` | Achievement award (tangible, non-cash) | **No** | ₱10,000 / year | BIR de minimis |
| `RD_SUB` | Representation allowance | **No** | ₱1,000 / month | BIR de minimis |
| `PERF_BONUS` | Performance / productivity bonus | **Yes** | none | Taxable compensation |
| `COLA` | Cost-of-living allowance | **Yes** | — | Taxable unless separately exempted |
| `OT_PAY` `NSD` `HOL_PAY` | Statutory premiums | **Yes** | — | Taxable compensation |
| `LEAVE_PAY` | Converted / paid leave | **Yes** | — | Taxable compensation |
| `13TH` | 13th month pay | **No, up to ceiling** | aggregate ₱90,000 / yr incl. other benefits; excess **taxable** | PD 851 / RA 10963 |

```python
def allowances(emp):
    out = []
    for a in employee_allowance.active_for(emp.id):
        amt = period_prorate(a.amount, a.frequency, run.frequency)
        cap = de_minimis_cap_check(a, emp, run.period)   # raises AllowanceCapExceeded
        out.append(PayLine(
            code=a.code, amount=amt,
            taxable_class=("TAXABLE" if a.taxable else "NON_TAXABLE_DEMINIMIS"),
            rate=None, formula=f"{a.frequency} allowance, cap={a.monthly_cap}"))
    return out

def taxable_split(gross, statutory_ded, allowance_lines):
    non_taxable = sum(l.amount for l in allowance_lines
                      if l.taxable_class == "NON_TAXABLE_DEMINIMIS")
    thirteen_and_benefits = sum(l.amount for l in allowance_lines
                                if l.code in THIRTEEN_BENEFIT_CODES)
    taxable_benefits = max(0, thirteen_and_benefits - 90_000.00)
    non_taxable_total = non_taxable + min(thirteen_and_benefits, 90_000.00)
    return max(0.0, round2(gross - statutory_ded - non_taxable_total)), non_taxable_total
```

**Enforcement:** `de_minimis_cap_check` raises rather than silently truncating. Over-cap allowances either become taxable or are rejected at data entry — never silently absorbed.

---

### 3.6 Absences, Deductions & Final Net

```python
def absences_deduction(emp, days_absent, daily_rate):
    """'No work, no pay'. Applies only to UNPAID absence; leave and
    unworked regular holidays are already excluded by the caller."""
    if emp.pay_frequency == "MONTHLY":
        return 0.0          # monthly-paid: absence handled via LWP conversion
    return round2(days_absent * daily_rate)

def finalize(i):
    i.net_pay = round2(i.gross_pay - i.total_deductions)
    assert i.net_pay >= 0, f"negative net for {i.employee_id}"   # hard stop
    return i
```

**Rounding policy (single source of truth):** intermediate values keep 4 dp; every emitted `payroll_line.amount` is `round2`. The final line of each category absorbs residual centavos so `sum(lines) == run_item.total` exactly — asserted inside the calculator.

**Payroll execution state machine**

```
OPEN --cutoff--> CUT_OFF --dispatch--> CALCULATING --> CALCULATED
                                                          |
                                                +---------+---------+
                                                v                   v
                                            REVIEW --> APPROVED --> POSTED
                                                |                     |
                                                +-- reject --> VOID   +-- adjustment
```

- `POSTED` runs are immutable. Corrections go through `payroll_adjustment` into the *next* run, or through a new `run_no` for the same period.
- State transitions acquire `pg_advisory_xact_lock(hashtext('payroll_run:' || run_id))` — one lock, no table locks.

---

## 4. System Integration & Concurrency Architecture

### 4.1 Biometric Hardware Ingestion

Three device protocols terminate at **one** internal contract:

| Source | Protocol | Notes |
|---|---|---|
| Web Bundy / ADMS (ZKTeco-style) | HTTP push, device sends `?SN=..&ST=..&FrameData=<base64>` on a schedule | Device-retry tolerant; must accept duplicate delivery |
| Modern IP terminals | `POST /api/v1/punches` JSON batch, HMAC-signed per device | Primary path |
| Legacy / offline terminals | WebSocket persistent channel, reconnect + replay cursor | Live console view only; the DB write path is identical |

**Internal contract (all three normalize to this):**

```json
{
  "schema": "punch.v1",
  "device_sn": "ZK-8F2A-0031",
  "seq": 184223,
  "events": [
    { "code": "EMP-004821", "ts": "2026-10-05T21:52:14+08:00",
      "direction": "IN", "quality": 98 }
  ]
}
```

**Pipeline**

```
[Device fleet]
     |  HTTPS batch (<=500 events/req) - HMAC-SHA256 - retry w/ jitter
     v
[Ingest Gateway]  (stateless, HPA-scaled, no business logic)
     |  validate schema + signature; reject unauthenticated in <1ms
     |  compute idempotency_key = sha256(device_sn|code|ts|dir)
     v
[Kafka topic: biometric.raw]     partition key = device_sn
     |  acks=1, retention 7d, compaction OFF (raw is append-only)
     +--------------> [DLQ: biometric.dlq]  poison / schema failures
     v
[Dedupe + Resolve consumer]  (consumer group, idempotent)
     |  INSERT ... ON CONFLICT (idempotency_key, punch_ts_utc) DO NOTHING
     |  resolve external_code -> employee_id via ux_employee_external
     v
[punch_raw]  (immutable, monthly range-partitioned)
     |
     v
[Day-invalidate]  -> punch_invalidation (employee_id, operational_date)
     |
     v
[Recompute consumer]  -> rebuild attendance_day for dirty keys only
```

**Why a queue and not WebSockets alone:** WebSockets solve the *transport* problem, not the *buffering, ordering, replay or backpressure* problems. The DB write must be decoupled from the socket so a Postgres hiccup cannot cascade into 10,000 device retries. (Redis Streams is an acceptable substitute at this volume if Kafka is out of budget — the consumer contract is identical.)

**Capacity math**

| Load | Figure |
|---|---|
| Steady state | 10,000 employees × 2 punches = 20,000 events/day ≈ 0.23 events/s avg |
| Shift-change burst | 10,000 punches inside a 60 s window ≈ **167 events/s sustained, 5,000 req/s instantaneous** |
| Kafka headroom (1 broker) | 100k+ msg/s produce — the burst is < 1% of capacity |
| Gateway requirement | 5,000 req/s × ~2 KB = 10 MB/s; 4–8 pods at 50% CPU headroom |
| DB write | 5,000 rows/s bulk-inserted into a partition — well under a single primary's capability |

**Hardening rules**

1. Devices batch and buffer locally; flush every 5 s or 100 events, whichever first. Offline terminals replay on reconnect — the idempotency key makes replay free.
2. The gateway never opens a DB transaction. It produces to the queue and returns `202 Accepted`.
3. Consumers are **at-least-once**; correctness comes from the unique index, not from broker semantics. No distributed transaction anywhere.
4. Unresolvable `external_code` → stored with `employee_id = NULL` + alert; never dropped.
5. Partition maintenance: create 3 months ahead, `DETACH + DROP` past the retention window.

---

### 4.2 Stream Processing & Late Data

```python
# consumer pseudocode - idempotent, re-entrant
def on_punch_batch(events):
    rows = [to_row(e) for e in events]
    conn.execute(
        """
        INSERT INTO punch_raw (device_id, employee_id, external_code, punch_ts_utc,
                               punch_ts_local, direction, source, device_seq,
                               payload_hash, idempotency_key, quality)
        VALUES %s
        ON CONFLICT (idempotency_key, punch_ts_utc) DO NOTHING
        """, execute_values(rows))

    for r in rows:
        if r.employee_id:
            mark_dirty(r.employee_id, operational_date_of(r))
        else:
            alert_unresolved_identity(r)

def mark_dirty(employee_id, day_date):
    conn.execute("""
        INSERT INTO punch_invalidation (punch_id, day_date, reason)
        VALUES (0, %s, 'PUNCH_ARRIVED')
        ON CONFLICT (day_date) DO UPDATE SET reason = EXCLUDED.reason
    """, (day_date,))
```

**Recompute consumer** claims dirty days with the skip-locked pattern (§4.3), rebuilds `attendance_day` from immutable raw, then clears the marker. Because the input is immutable and the function is pure, re-running is always safe.

**Watermark rule:** a day is *settled* when `now > max(device.last_seen_at) + LATENESS_ALLOWANCE`. Settled days stop accepting recompute jobs unless an administrator forces it. Reports default to settled days.

---

### 4.3 Payroll Processing Concurrency

**Never** run 10,000 employee calculations inside one transaction, and never hold a table lock across a batch.

**Job queue: Postgres + `SKIP LOCKED`** (no extra broker required — the volume is 10k jobs per cutoff, not 5k/s):

```sql
CREATE TABLE payroll_job (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  run_id      BIGINT NOT NULL REFERENCES payroll_run(id),
  employee_id BIGINT NOT NULL,
  shard       SMALLINT NOT NULL,          -- employee_id % SHARD_COUNT
  attempt     SMALLINT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING','RUNNING','DONE','FAILED')),
  locked_by   TEXT,
  locked_at   timestamptz,
  error       TEXT,
  UNIQUE (run_id, employee_id)
);
CREATE INDEX ix_job_claim ON payroll_job (run_id, shard, id)
  WHERE status = 'PENDING';
```

**Worker claim loop**

```python
def claim(run_id, worker_id, batch=50):
    with conn.transaction():
        return conn.execute("""
            SELECT id, employee_id FROM payroll_job
            WHERE run_id = %s AND status = 'PENDING' AND attempt < 5
            ORDER BY shard, id
            FOR UPDATE SKIP LOCKED
            LIMIT %s
        """, (run_id, batch), fetch=True)

def worker(run_id, worker_id):
    while True:
        jobs = claim(run_id, worker_id)
        if not jobs:
            break
        for j in jobs:
            try:
                with conn.transaction():          # ONE transaction per employee
                    days = load_days(j.employee_id, run.period)
                    item = calc_employee(run, load_emp(j.employee_id), days, tables)
                    upsert_run_item(item)                      # PK (run_id, employee_id)
                    replace_lines(run, j.employee_id, item.lines)  # delete+insert, atomic
                    mark_done(j.id)
            except Exception as e:
                mark_failed(j.id, e)              # attempt++, visible on review board
```

**Concurrency design**

| Concern | Mechanism |
|---|---|
| Claim contention | `FOR UPDATE SKIP LOCKED` — zero lock waits between workers |
| Isolation | One transaction per employee; workers touch disjoint rows by PK |
| Idempotency | `INSERT ... ON CONFLICT (run_id, employee_id) DO UPDATE` + delete-then-insert lines inside the same tx |
| Run-level exclusivity | `pg_advisory_xact_lock(hashtext('payroll_run:' \|\| run_id))` on state transitions only |
| Worker count | `min(shards, CPU quota)`; default 16–32 workers → 10k employees in **~40–90 s** |
| Configuration caching | Statutory tables loaded once per worker into memory, keyed by `schedule_id` — no per-employee DB reads |
| Read path | `attendance_day` loaded in one `= ANY(%s)` batch, never N+1 |
| Failure | Per-job retry with exponential backoff; 5 failures → manual review queue, run continues |
| Progress | `SELECT count(*) FILTER (WHERE status='DONE') FROM payroll_job WHERE run_id = %s` → dashboard bar |
| Head-of-line blocking | None — a failed employee never blocks another |

**Optional partitioning:** at 50k+ headcount, partition `payroll_run_item` and `payroll_line` HASH-N by `employee_id` so each worker writes to a distinct heap and vacuum pressure spreads. At 10k it is unnecessary — the skip-locked queue already removes the bottleneck.

**Read-path isolation:** payslip generation, reports and alphalist exports run against a **read replica** under `SET TRANSACTION READ ONLY`, so reporting load never competes with calculation.

---

### 4.4 Background Work Topology

| Job | Trigger | Pattern |
|---|---|---|
| Roster generation | nightly 01:00, per campaign | sharded by campaign, idempotent (revision bump) |
| Attendance recompute | event-driven from `punch_invalidation` | skip-locked queue, watermark-gated |
| Leave accrual | monthly, on `payroll_period` open | idempotent via `ux_ledger_dedupe` |
| Partition maintenance | weekly | CREATE ahead, DETACH+DROP past retention |
| Holiday calendar load | yearly, on proclamation | insert-on-conflict |
| Payroll calculation | on cutoff | skip-locked worker pool (§4.3) |
| Payslip render | after `APPROVED` | replica-side, one job per employee, fan-out |
| Remittance file gen | monthly | SSS R-3, PhilHealth PF1, HDMF MCRF, BIR 1601-E / 1601-C |

One binary, `--role` flag. Scaling is driven by queue depth (KEDA on `count(*) WHERE status='PENDING'` or on Kafka lag), not by calendar.

---

### 4.5 Failure, Replay & Data Integrity

| Failure | Behaviour |
|---|---|
| Device offline > 24 h | Local buffer replays on reconnect; dedupe absorbs duplicates; day marked dirty |
| Queue partition unavailable | Gateway buffers to disk, drains on restore; devices see `202` only after produce ack |
| Poison message | Schema validation fails → DLQ with full payload; alert; never blocks the partition |
| Worker crash mid-transaction | Tx rolls back; job returns to `PENDING` after lock timeout; re-run is idempotent |
| Clock skew on device | `punch_ts_local` trusted only within ±10 min of server time; outside → stored, flagged `needs_review` |
| Duplicate salary run | `UNIQUE(period_id, run_no)` prevents it; `POSTED` is immutable |
| Table lock during batch | Impossible by construction — no statement in the payroll path takes a table-level lock |
| Reprocess a historical day | Force-invalidate → recompute → fresh `attendance_day`; deltas surface as adjustments, never as silent mutation |

**Invariant assertions (in code and in CI):**

```python
assert sum(l.amount for l in item.lines if l.kind == "EARNING") == item.gross_pay
assert item.net_pay == round2(item.gross_pay - item.total_deductions)
assert item.net_pay >= 0
assert all(l.source_ref for l in item.lines), "every line must trace to a source"
assert semi_monthly_split(item.sss_ee, 0) + semi_monthly_split(item.sss_ee, 1) == round2(item.sss_ee, 2)
```

---

### 4.6 Deployment Shape

```
                   +--- CDN / WAF ---+
[Employees] ----->   Web (Next.js)       [Supervisors / HR]
                        | server actions / REST
[Devices] --HTTPS--> Ingest Gateway (HPA, 4-8 pods)
                        | produce
                     Kafka / Redis Streams
                        | consume
        +---------------+----------------+
   Dedupe+Resolve     Recompute       Remittance
        |                |                |
        +----------> PostgreSQL primary <-+
                        | logical replication
                   Read Replica --> reporting, payslips, exports
                        |
                   Redis (rate limits, config cache, session)

   Workers: payroll / roster / accrual  (same image, --role flag, KEDA-scaled)
```

**Configuration as data, everywhere.** `sss_schedule`, `phic_schedule`, `hdmf_schedule`, `bir_tax_table`, `premium_matrix`, `grace_tier`, `allowance_type`, `holiday_calendar` are all effective-dated rows; `payroll_run.config_snapshot` freezes the exact set used for a run. Changing a statutory rate next year is `INSERT INTO ... effective_from = '2027-01-01'` — zero deployments.

---

## 5. Appendix — Payslip Line Codes

| Code | Kind | Description |
|---|---|---|
| `BASIC` | EARNING | Basic pay for days worked / paid leave |
| `RD_PAY` | EARNING | Rest-day work premium (130%) |
| `RH_PAY` | EARNING | Regular holiday worked premium (200% / 260%) |
| `RH_UNWORKED` | EARNING | Unworked regular holiday (100%) |
| `SNW_PAY` | EARNING | Special non-working day worked (130% / 150%) |
| `OT_ORD` `OT_RD` `OT_SPECL` `OT_RH` `OT_RH_RD` | EARNING | Overtime by bucket |
| `NSD` | EARNING | Night shift differential, 10% (Art. 86) |
| `LEAVE_PAY` | EARNING | Paid leave consumed |
| `RICE` `CLOTHING` `MEDICAL` `LAUNDRY` `MEAL` | EARNING | De minimis, non-taxable |
| `PERF_BONUS` `COLA` | EARNING | Taxable allowances |
| `13TH` | EARNING | 13th month, non-taxable to ₱90,000 aggregate |
| `SSS_EE` `SSS_WISP_EE` | DEDUCTION | SSS regular + WISP portions |
| `PHIC_EE` | DEDUCTION | PhilHealth 2.5% |
| `HDMF_EE` | DEDUCTION | Pag-IBIG 2% |
| `TAX_BIR` | TAX | Withholding tax under NIRC §24 (TRAIN) |
| `LOAN_*` `ADV_*` | DEDUCTION | Salary loan / cash advance |
| `SSS_ER` `PHIC_ER` `HDMF_ER` | EMPLOYER_CONTRIB | Employer counterpart (not deducted) |
| `ADJ_*` | ADJUSTMENT | Off-cycle correction with `reason` + `approved_by` |
