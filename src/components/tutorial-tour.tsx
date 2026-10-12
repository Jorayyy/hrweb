"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import type { UserRole } from "@/db/schema";

type TourStep = {
  route?: string;
  element?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
};

const WAIT_FOR_ELEMENT_MS = 2500;

function buildSteps(role: UserRole): TourStep[] {
  const isAdmin = role === "OWNER" || role === "ADMIN";
  const isHr = isAdmin || role === "HR";

  const steps: TourStep[] = [
    {
      route: "/",
      element: '[data-tour="page-header"]',
      title: `Welcome to PrimeHRIS — ${role.toLowerCase()} view`,
      description:
        "This guided tour walks you through the system start to finish. You're on the Dashboard — your home base after signing in. It shows today's snapshot: headcount, attendance, announcements, and pay activity, all tailored to your role. Use Next to continue, or the ✕ to exit anytime.",
      side: "bottom",
    },
    {
      element: "aside nav",
      title: "Your navigation",
      description:
        "Everything lives in this sidebar. The menu adapts to your role — you only see what you're allowed to use. Items with a chevron (like Setup or Settings) expand into subsections.",
      side: "right",
    },
    {
      element: '[data-tour="sidebar-user"]',
      title: "Your account",
      description:
        "Your name and role appear at the bottom. Click to open the menu — that's where you can sign out. Keep your session secure, especially on shared kiosk machines.",
      side: "right",
    },
  ];

  if (role === "EMPLOYEE") {
    steps.push(
      {
        route: "/profile",
        element: '[data-tour="page-header"]',
        title: "My Profile",
        description:
          "Your personal record — contact details, employment status, and the info HR has on file. If something looks wrong (wrong number, wrong rate), flag it with HR rather than assuming it updates itself.",
      },
      {
        route: "/dtr",
        element: '[data-tour="page-header"]',
        title: "My DTR",
        description:
          "Your daily time record — the raw log of your ins and outs, pulled from the Bundy clock or biometric device. Review it regularly; corrections are easiest to raise before payroll cuts off.",
      },
      {
        route: "/payslips",
        element: '[data-tour="page-header"]',
        title: "My Payslips",
        description:
          "Every payroll run that includes you lands here. Open a slip to see earnings, deductions, and net pay broken down. Slips stay available for the whole year — handy come BIR season.",
      },
    );
  }

  if (isHr) {
    steps.push(
      {
        route: "/employees",
        element: '[data-tour="page-header"]',
        title: "Employees",
        description:
          "The master list of everyone on payroll — active, on leave, terminated, all of it. Filter, search, and click any row to open a full employee record with contracts, rates, and history.",
      },
      {
        element: 'a[href="/employees/new"]',
        title: "Adding someone new",
        description:
          "The Add employee button starts onboarding: personal info, job details, and rate computation (daily = monthly ÷ 22, hourly = daily ÷ 8). New hires can start in PREBOARDING status until fully cleared.",
        side: "bottom",
      },
      {
        route: "/attendance",
        element: '[data-tour="page-header"]',
        title: "Attendance",
        description:
          "The daily attendance grid — who punched in, who's late, who's missing. This is your first stop each morning when someone's biometric didn't register, before it becomes a payroll problem.",
      },
      {
        route: "/tk",
        element: '[data-tour="page-header"]',
        title: "Timekeeping (TK)",
        description:
          "Raw timekeeping data — punch records grouped and processed into work durations. Use this when you need to trace exactly what the machine saw on a given day.",
      },
      {
        route: "/dtr-review",
        element: '[data-tour="page-header"]',
        title: "DTR Review",
        description:
          "The correction desk. Review flagged time records — missing punches, overnight shifts, holidays — and approve or adjust them before the payroll period closes. Nothing enters payroll until it passes here.",
      },
      {
        route: "/schedule",
        element: '[data-tour="page-header"]',
        title: "Schedules",
        description:
          "Work schedules per employee or campaign. Set shift patterns here; they drive how attendance, late, and undertime are computed downstream.",
      },
      {
        route: "/setup",
        element: '[data-tour="page-header"]',
        title: "Setup",
        description:
          "The building blocks of your org: cost centers, campaigns, departments, and job positions. Configure these first when adopting the system — everything else references them. Announcements and time-clock IP whitelisting live here too.",
      },
    );
  }

  if (isAdmin) {
    steps.push(
      {
        route: "/payroll",
        element: '[data-tour="page-header"]',
        title: "Payroll",
        description:
          "Run payroll end to end: pick a period, generate a run, review every employee's computed pay (rate × days, overtime, deductions), then finalize. Progress is tracked live — don't close the tab mid-run.",
      },
      {
        route: "/settings",
        element: '[data-tour="page-header"]',
        title: "Settings",
        description:
          "System-wide controls: company profile, attendance rules, payroll configuration, security (session timeout, user accounts), audit log, and data tools. Most of this is OWNER-only — change carefully, it affects everyone.",
      },
    );
  }

  steps.push({
    title: "That's the tour!",
    description:
      role === "EMPLOYEE"
        ? "You now know where everything lives: profile, time record, payslips. Bookmark this system — and remember to check your DTR before every payroll cut-off. Enjoy!"
        : "You've walked the full flow — people, time, and pay. This tutorial is demo-only and can be removed later. Questions? Ask the team, or click around: the system is yours.",
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

    const waitForRoute = (route: string) =>
      new Promise<void>((resolve, reject) => {
        if (pathnameRef.current === route) {
          resolve();
          return;
        }
        const started = Date.now();
        const id = window.setInterval(() => {
          if (pathnameRef.current === route) {
            window.clearInterval(id);
            resolve();
          } else if (Date.now() - started > 5000) {
            window.clearInterval(id);
            reject(new Error(`Navigation to ${route} timed out`));
          }
        }, 50);
      });

    const navigateThen = (route: string, after: () => void) => {
      router.push(route);
      waitForRoute(route)
        .then(() => {
          if (!cancelled) after();
        })
        .catch(() => {
          if (!cancelled) driverObj.destroy();
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
      stagePadding: 8,
      stageRadius: 12,
      onNextClick: (_element, _step, opts) => {
        const next = steps[(opts.index ?? 0) + 1];
        if (!next) {
          driverObj.destroy();
          return;
        }
        if (next.route && next.route !== pathnameRef.current) {
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
