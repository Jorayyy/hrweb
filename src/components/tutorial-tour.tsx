"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { UserRole } from "@/db/schema";

type TourStep = {
  route?: string;
  element?: string;
  openPeriod?: boolean;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

const WAIT_FOR_ELEMENT_MS = 5000;

function buildSteps(role: UserRole): TourStep[] {
  const isEmployee = role === "EMPLOYEE";
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const isOwner = role === "OWNER";
  const isHr = isAdmin || role === "HR";
  const header = '[data-tour="page-header"]';

  const steps: TourStep[] = [
    {
      route: "/",
      element: header,
      title: `Welcome to PrimeHRIS — ${role.toLowerCase()} view`,
      description: isEmployee
        ? "This short tour shows your self-service corner of PrimeHRIS. Your Dashboard greets you with company announcements (pinned ones first), the payroll calendar with upcoming pay dates, and holidays. Everything you personally need — profile, time record, payslips — is one click away in the sidebar."
        : "This guided tour walks the full people → time → pay flow. You're on the manager Dashboard: active headcount, who's away today, monthly base payroll, and hires from the last 30 days. Below that, headcount by campaign — e.g. Telus Support with 42 of 84 active agents — plus the status breakdown and the six most recent hires. Use Next to continue, ✕ anytime.",
      side: "bottom",
    },
    {
      element: "aside nav",
      title: "Your navigation",
      description: isEmployee
        ? "Your menu is short on purpose — My Profile, My DTR and My Payslips plus this Dashboard. HR and Payroll see the admin side; you only get what you personally need."
        : "This sidebar is role-filtered: HR sees People and Setup, Payroll owners additionally see Payroll, Owners see everything including Settings. Chevrons expand groups — Setup holds Cost centers, Campaigns, Departments, Job positions, Announcements and Time clock IPs; Settings holds Company, Locale, Attendance rules and more.",
      side: "right",
    },
    {
      element: '[data-tour="sidebar-user"]',
      title: "Your account",
      description:
        "Your name and role sit at the bottom — that's also where you sign out. On shared machines, like the office kiosk PC, always sign out after use.",
      side: "right",
    },
    {
      title: "The Bundy kiosk — where punches start",
      description:
        "Quick detour before the pages: staff punch at /bundy, the web time clock. It's IP-locked — the office public IP must be registered under Setup → Time clock IPs or the screen shows 'Device not authorized'. Punching takes Employee no. plus a 4–6 digit Bundy PIN: IN in the morning, Lunch Out/In around midday, OUT at shift end; optional 1st/2nd break buttons appear when the shift template has break windows. No passwords, no photos — PIN and go.",
      side: "bottom",
    },
  ];

  if (isEmployee) {
    steps.push(
      {
        route: "/profile",
        element: header,
        title: "My Profile",
        description:
          "Your record, view-only — the header literally says changes go through HR. Personal card: employee no., biometric code, hire and regularization dates, status, employment type. Job card: position, department, campaign, client, cost center, reports-to and weekly rest days. Pay &amp; statutory: frequency, monthly basic, and masked TIN/SSS/PhilHealth/Pag-IBIG numbers — masked on purpose. Something wrong? Flag it with HR early; salary fixes are easiest before the cutoff.",
      },
      {
        route: "/dtr",
        element: header,
        title: "My DTR",
        description:
          "Your month of punches. Table view: Date, Day, Status, In/Out, scheduled vs worked hours, late minutes, OT and flags (Rest, holiday names, Review). The Totals row sums scheduled, worked, late and OT for the month; Calendar view shows the same per-day. A dash means no record yet — days finalize only after HR processes attendance, and corrections go through HR. Pro tip: review this before every cutoff; an unreported missing punch becomes an absence on payday.",
      },
      {
        route: "/payslips",
        element: header,
        title: "My Payslips",
        description:
          "Every posted payroll run that includes you lands here — periods dropdown up top, columns Period, Pay date, Net pay. Open one: Earnings shows Basic pay for the half (₱18,000 monthly ÷ 2 = ₱9,000 if you worked every required day, minus absences at the ₱818.18 daily rate), plus Overtime and Night differential lines when applicable. Deductions lists SSS, SSS WISP, PhilHealth, Pag-IBIG and withholding tax; then the Net pay strip and your employer's contributions for transparency. Slips appear only once payroll posts — nothing shows mid-cutoff. A zero-gross warning means your DTR wasn't approved in time: tell HR.",
      },
    );
  }

  if (isHr) {
    steps.push(
      {
        route: "/employees",
        element: header,
        title: "Employees — the roster",
        description:
          "Everyone on payroll with campaign, position, status and monthly rate. The lifecycle runs PREBOARDING (hired, not yet rendering) → ACTIVE → ON_LEAVE or SUSPENDED, ending in TERMINATED or AWOL. Search by name or employee no., filter by status; the list caps at 100 rows so narrow with filters. Add employee opens onboarding; the Setup button jumps to reference data when Campaign or Position doesn't exist yet.",
      },
      {
        element: 'a[href="/employees/new"]',
        title: "Onboarding — Add employee",
        description:
          "The form, section by section. Identity: employee no., biometric code (echoed by the time clock), photo. Employment: hire date, status, type (Regular, Probationary, Agency…), pay frequency (semi-monthly default). Assignment: campaign, department, cost center, position — all required — plus reports-to. Pay: monthly basic — enter ₱18,000 and the system derives daily ₱818.18 (÷22) and hourly ₱102.27 (÷8), the DOLE standard shown in the header. Statutory numbers (TIN, SSS, PhilHealth, Pag-IBIG) feed the BIR and SSS reports. Time clock: a 4–6 digit Bundy PIN. Rest days: pick at least one — rest-day premiums apply to hours worked on them.",
        side: "bottom",
      },
      {
        route: "/employees",
        element: header,
        title: "Employee records are edit-in-place",
        description:
          "Skip ahead note: clicking any roster row opens the same form prefilled — no tabs, just Save changes. Every field edit is audit-logged, and salary or pay-frequency changes auto-write a compensation history row (HIRE, SALARY_CHANGE, PAY_FREQ_CHANGE). Example: bumping Maria Cruz from ₱18,000 to ₱19,500 stamps the reason and keeps the trail for SSS and benefits disputes.",
        side: "bottom",
      },
      {
        route: "/attendance",
        element: '[data-tour="daily-log"]',
        title: "Attendance — the daily grid",
        description:
          "Pick a date, see everyone. Columns: In/Out, scheduled vs worked hours, late minutes, OT and night hours. Flags ride on each row: Rest for rest days, Regular or Special Nonworking for holidays, Review when a day needs human eyes. The Totals footer sums late/OT/night across the page. The pencil on each row edits a single entry — first stop when the biometric missed someone.",
      },
      {
        route: "/tk",
        element: '[data-tour="tk-issues"]',
        title: "Timekeeping (TK) — fixing problem days",
        description:
          "TK zooms into problem days, week by week: amber Missing (required day, no record) and rose Flagged (punches saved but wrong). Open a person, fill the exact fields their shift requires — In, Lunch Out/In, Out, plus break windows if the template has them — then Save punches; if they truly didn't come, Mark absent. Fill every required field or the day stays flagged. Fixing here is what unlocks DTR approval next door.",
      },
      {
        route: "/dtr-review",
        element: '[data-tour="dtr-grid"]',
        title: "DTR Review — the approval gate",
        description:
          "One row per person, seven day columns showing In–Out like 08:02–17:15 with worked hours and late minutes. Amber Missing means no record; rose Flagged means fix it in TK first. Approve locks the week and counts missing days as absent — the button literally reads 'Approve (2 absent)' so you know. Reopen unlocks. Approve all (N) bulk-runs the ready ones as a background job. Payroll cannot calculate until every required day is approved — this page is the gate.",
      },
      {
        route: "/schedule",
        element: '[data-tour="shift-templates"]',
        title: "Schedules — shift templates",
        description:
          "Templates define the time basis for lateness, OT and breaks. DAY8 might be 08:00–17:00 with a required unpaid lunch 12:00–13:00 and optional paid 15-minute breaks; overnight shifts work too (end earlier than start). The assignments card below maps people to shifts — nobody can punch without one. Removing a template unassigns it from everyone instantly.",
      },
      {
        route: "/setup/cost-centers",
        element: header,
        title: "Setup — reference data",
        description:
          "Four building blocks, add-only codes that everything else references: Cost centers (CC-OPS — where cost is attributed for reporting), Campaigns (TELUS / Telus Support — the client account, tied to a cost center), Departments (WFM — Workforce Management) and Job positions (CSR1, level 1–99, Managerial flag drives the BIR tax table). Create these before adding employees — the onboarding form blocks until they exist.",
      },
      {
        route: "/setup/time-clock-ips",
        element: header,
        title: "Setup — announcements &amp; kiosk security",
        description:
          "Two operational tools round out Setup. Announcements post to every employee dashboard — pin the payroll cut-off reminder so it stays on top; capped at 20, and Remove is instant. Time clock IPs whitelist which public IPs may punch at the /bundy kiosk — register the office line, e.g. 112.198.100.7 labeled 'Office main'. Empty list means the kiosk rejects every punch.",
      },
    );
  }

  if (isAdmin) {
    steps.push(
      {
        route: "/payroll",
        element: header,
        title: "Payroll — cutoffs at a glance",
        description:
          "Cutoffs live in three lanes: In progress, Posted, Void. Semi-monthly runs 1–15 paid on the 25th, and 16–last paid on the 10th; weekly is Mon–Sun paid 7 days after. Create payroll opens Standard (auto dates for the current cutoff) or Custom (your own period code and range — the pay date auto-suggests and sticks once you edit it). Overlapping cutoffs are rejected, so two periods can never cover the same days.",
      },
      {
        openPeriod: true,
        element: '[data-tour="run-progress"]',
        title: "The four-step run bar",
        description:
          "You're inside a cutoff now — each run walks the bar Open → Calculated → Approved → Posted. Summary tiles track headcount, gross, deductions and net for the scope — full roster or a filtered subset. Nothing here is guesswork: the bar is the source of truth for where money currently stands.",
        side: "bottom",
      },
      {
        element: '[data-tour="readiness"]',
        title: "Recheck before posting",
        description:
          "Every gate listed before money moves: DTR approved for everyone, run exists, run calculated, no failed calculations, totals reconcile, statutory snapshot intact. Blocking checks physically disable Approve and Post with a 'Blocking checks are failing' tooltip; warnings — like the previous cutoff not posted — you can accept knowingly. Each failing check links straight to its fix: Open DTR Review, Create a run, and so on.",
        side: "left",
      },
      {
        element: '[data-tour="new-run"]',
        title: "New run — snapshot, then scope",
        description:
          "A run snapshots the statutory tables in force for this cutoff — SSS, PhilHealth, Pag-IBIG and BIR rates as they exist today — so retroactive government rate changes can never rewrite posted history. Leave every box unchecked to pay the full roster, or tick Campaigns / Departments / Cost centers for a partial run (e.g. only TELUS before the client's own cut-off). Filters combine with AND.",
        side: "bottom",
      },
      {
        element: '[data-tour="register"]',
        title: "Calculate &amp; the Register",
        description:
          "Hit Calculate — progress streams live, don't close the tab. The Register fills with one row per employee: Days, Abs, OT h, NSD h (night differential), Gross, Deductions, Net pay — grouped by campaign with a sticky totals footer. Worked example: Maria Cruz, ₱18,000 semi-monthly. Full basic ₱9,000; one absent day subtracts the ₱818.18 daily; 2 OT hours at ×1.25 add ₱255.68; 8 night hours add ₱81.82 (10% of the ₱102.27 hourly). Filters above slice by campaign, department or cost center.",
        side: "left",
      },
      {
        element: '[data-tour="register"]',
        title: "Drilling into a payslip",
        description:
          "Click any name to open the itemized payslip. Earnings: Basic pay, Holiday pay, Rest-day pay, Overtime (n h), Night differential (n h), Allowances — footing to Gross. Deductions: SSS (EE), SSS WISP (EE), PhilHealth (EE), Pag-IBIG (EE), Withholding tax — statutory shares straight from the seeded government tables — footing to Total deductions. Then the big Net pay strip, and Employer contributions (SSS, PhilHealth, Pag-IBIG ER) so you see the full cost of the employee. Fine print stamps the calc engine and payrule versions — that's your audit receipt.",
        side: "left",
      },
      {
        element: '[data-tour="runs-table"]',
        title: "Approve, Post, and the one-way door",
        description:
          "When readiness is green: Approve moves the run to Approved — and anything not yet posted can still be Voided if something's wrong. Post is the one-way door: it publishes payslips, and employees immediately see theirs under My Payslips. The step bar turns all four green and the period lands in the Posted lane. Net pay lands after the statutory deductions — every centavo itemized on each slip.",
        side: "top",
      },
      {
        route: isOwner ? "/settings/company" : "/settings/locale",
        element: header,
        title: isOwner
          ? "Settings — company identity"
          : "Settings — locale & formats",
        description: isOwner
          ? "Company is the identity printed everywhere — sidebar, login page, kiosk and every payslip: name, logo, address, TIN, DOLE registration. Nearby pages: Locale & formats sets currency, date style and number grouping (presentation only — amounts always store as exact centavos); Payroll defaults sets the default cutoff frequency and the payslip footer note, so bank details or cut-off reminders print under every slip."
          : "Presentation only — amounts always store as exact centavos and dates as ISO underneath. Pick currency, date style (Sunday, January 31, 2026 vs 1/31/26) and number grouping. Company identity and payslip footers live on the Owner-only Company page.",
      },
      {
        route: "/settings/attendance",
        element: header,
        title: "Settings — attendance rules",
        description:
          "Two levers that change how DTR days compute. Late grace: the first N minutes of lateness are absorbed — with a 5-minute grace, 08:05 counts on time and 08:08 counts 3 minutes late. Overtime rounding: OT floors to the chosen increment before it's paid — 23 minutes becomes 20 at 'Floor to 15', or vanishes at 'Floor to 30'. Applies to punches from now on; already-saved days keep their recorded values until re-saved.",
      },
      {
        route: "/settings/security",
        element: header,
        title: isOwner ? "Settings — security & users" : "Settings — security",
        description: isOwner
          ? "Policies protect everyone: minimum password length, session timeout in days, login lockout after N failed attempts — plus separate kiosk PIN lockouts, so a guessed Bundy PIN locks the kiosk, not the whole app. The User accounts page (Owner-only) creates sign-ins, assigns OWNER/ADMIN/HR/PAYROLL/EMPLOYEE roles, links accounts to employee records, resets passwords and revokes live sessions — deactivating someone signs them out everywhere."
          : "Policies: minimum password length, session timeout, login lockout after N attempts, and separate kiosk PIN lockouts for the Bundy. Your password card changes your own. Account administration — creating users, roles, resets, session revocation — is Owner-only.",
      },
      {
        route: "/settings/audit",
        element: header,
        title: "Settings — audit log & data",
        description:
          "Every login, employee change and settings edit lands here with actor, action and timestamp — filter pills slice Logins / Employees / Settings / Users, and View expands the full JSON detail. Times are Asia/Manila. The Data page nearby shows read-only record counts — employees, attendance rows, payroll runs, payslip lines — a quick sanity check; nothing is ever deleted there.",
      },
    );
  }

  steps.push({
    title: "That's the tour!",
    description: isEmployee
      ? "That's your corner: profile, DTR, payslips. Check your DTR before every cut-off — corrections are easiest before payroll runs. The kiosk is where punches start; HR fixes what's missing. Enjoy!"
      : "That's the whole loop: reference data → hire → schedule → punch at the kiosk → fix in TK → approve in DTR Review → calculate → post → payslip. Every peso traces from a Bundy PIN to an itemized line. This tutorial is demo-only and easy to remove — for now, click around: the system is yours.",
    side: "bottom",
  });

  return steps;
}

export function TutorialTour({ role }: { role: UserRole }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const driverRef = useRef<Driver | null>(null);
  const pathnameRef = useRef(pathname);
  const tutorialParam = searchParams.get("tutorial");

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const cleanupQuery = useCallback(() => {
    router.replace(pathnameRef.current);
  }, [router]);

  useEffect(() => {
    if (tutorialParam !== "1") return;
    if (driverRef.current?.isActive()) return;

    let cancelled = false;
    const steps = buildSteps(role);

    const waitForPath = (from: string, pred: () => boolean) =>
      new Promise<void>((resolve) => {
        if (pred()) {
          resolve();
          return;
        }
        let last = pathnameRef.current;
        let stableSince = Date.now();
        const started = Date.now();
        const id = window.setInterval(() => {
          const current = pathnameRef.current;
          if (current !== last) {
            last = current;
            stableSince = Date.now();
          }
          const arrived = pred() || (current !== from && Date.now() - stableSince >= 250);
          if (arrived || Date.now() - started > 5000) {
            window.clearInterval(id);
            resolve();
          }
        }, 50);
      });

    const waitForRoute = (route: string, from: string) =>
      waitForPath(from, () =>
        pathnameRef.current === route || pathnameRef.current.startsWith(`${route}/`)
      );

    const navigateThen = (route: string, after: () => void) => {
      const from = pathnameRef.current;
      router.push(`${route}?tutorial=1`);
      waitForRoute(route, from).then(() => {
        if (!cancelled) after();
      });
    };

    // shortcut: payroll deep-dive links the first period's Open href — if no
    // periods exist the sub-steps fall back to centered popovers
    const openFirstPeriod = (after: () => void) => {
      const from = pathnameRef.current;
      if (pathnameRef.current.startsWith("/payroll/periods/")) {
        after();
        return;
      }
      const href = document
        .querySelector<HTMLAnchorElement>('a[href^="/payroll/periods/"]')
        ?.getAttribute("href");
      if (!href) {
        after();
        return;
      }
      router.push(`${href}?tutorial=1`);
      waitForPath(from, () => pathnameRef.current.startsWith("/payroll/periods/")).then(() => {
        if (!cancelled) after();
      });
    };

    const driverObj = driver({
      steps: steps.map((step) => ({
        element: step.element,
        waitForElement: WAIT_FOR_ELEMENT_MS,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
        },
      })) satisfies DriveStep[],
      popoverClass: "tutorial-popover",
      showProgress: true,
      progressText: "Step {{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      closeBtnLabel: "Skip the tour",
      smoothScroll: true,
      overlayClickBehavior: "none",
      overlayColor: "oklch(0.13 0 0)",
      overlayOpacity: 0.5,
      stagePadding: 10,
      stageRadius: 12,
      onPopoverRender: (popover) => {
        popover.nextButton.classList.add("tour-btn-next");
        popover.previousButton.classList.add("tour-btn-prev");
      },
      onNextClick: (_element, _step, opts) => {
        const next = steps[(opts.index ?? 0) + 1];
        if (!next) {
          driverObj.destroy();
          return;
        }
        if (next.openPeriod) {
          openFirstPeriod(() => driverObj.moveNext());
        } else if (next.route && next.route !== pathnameRef.current) {
          navigateThen(next.route, () => driverObj.moveNext());
        } else {
          driverObj.moveNext();
        }
      },
      onPrevClick: (_element, _step, opts) => {
        const prev = steps[(opts.index ?? 0) - 1];
        if (!prev) return;
        if (prev.route && prev.route !== pathnameRef.current) {
          navigateThen(prev.route, () => driverObj.movePrevious());
        } else {
          driverObj.movePrevious();
        }
      },
      onDoneClick: () => {
        driverObj.destroy();
      },
      onDestroyed: () => {
        if (!cancelled) cleanupQuery();
        driverRef.current = null;
      },
    });

    const startTimer = window.setTimeout(() => {
      if (cancelled || driverRef.current?.isActive()) return;
      driverRef.current = driverObj;
      const first = steps[0];
      if (first.route && first.route !== pathnameRef.current) {
        navigateThen(first.route, () => driverObj.drive(0));
      } else {
        driverObj.drive(0);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [tutorialParam, role, router, cleanupQuery]);

  return null;
}
