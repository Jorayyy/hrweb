import type { UserRole } from "@/db/schema";

export type IconKey =
  | "dashboard"
  | "users"
  | "clock"
  | "scan"
  | "clipboard"
  | "calendar"
  | "wallet"
  | "settings"
  | "setup";

export type NavChild = {
  href: string;
  label: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  roles: readonly UserRole[];
  children?: readonly NavChild[];
};

const ALL: readonly UserRole[] = ["ADMIN", "HR", "PAYROLL", "EMPLOYEE"];

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", roles: ALL },
  { href: "/profile", label: "My Profile", icon: "users", roles: ["EMPLOYEE"] },
  { href: "/dtr", label: "My DTR", icon: "clock", roles: ["EMPLOYEE"] },
  { href: "/payslips", label: "My Payslips", icon: "wallet", roles: ["EMPLOYEE"] },
  { href: "/employees", label: "Employees", icon: "users", roles: ["ADMIN", "HR"] },
  { href: "/attendance", label: "Attendance", icon: "scan", roles: ["ADMIN", "HR"] },
  { href: "/tk", label: "TK", icon: "clock", roles: ["ADMIN", "HR"] },
  { href: "/dtr-review", label: "DTR Review", icon: "clipboard", roles: ["ADMIN", "HR"] },
  { href: "/schedule", label: "Schedule", icon: "calendar", roles: ["ADMIN", "HR"] },
  { href: "/payroll", label: "Payroll", icon: "wallet", roles: ["ADMIN", "PAYROLL"] },
  {
    href: "/setup",
    label: "Setup",
    icon: "setup",
    roles: ["ADMIN", "HR"],
    children: [
      { href: "/setup/cost-centers", label: "Cost centers" },
      { href: "/setup/campaigns", label: "Campaigns" },
      { href: "/setup/departments", label: "Departments" },
      { href: "/setup/job-positions", label: "Job positions" },
      { href: "/setup/announcements", label: "Announcements" },
      { href: "/setup/time-clock-ips", label: "Time clock IPs" },
    ],
  },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["ADMIN"] },
];

export type ResolvedNavItem = {
  href: string;
  label: string;
  icon: IconKey;
  children?: readonly NavChild[];
};

export function navForRole(role: UserRole): ResolvedNavItem[] {
  return NAV.filter((item) => item.roles.includes(role)).map(({ href, label, icon, children }) => ({
    href,
    label,
    icon,
    children,
  }));
}
