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
  roles?: readonly UserRole[];
};

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  roles: readonly UserRole[];
  children?: readonly NavChild[];
};

const ALL: readonly UserRole[] = ["OWNER", "ADMIN", "HR", "PAYROLL", "EMPLOYEE"];
const ADMIN: readonly UserRole[] = ["OWNER", "ADMIN"];
const HR: readonly UserRole[] = ["OWNER", "ADMIN", "HR"];

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", roles: ALL },
  { href: "/profile", label: "My Profile", icon: "users", roles: ["EMPLOYEE"] },
  { href: "/dtr", label: "My DTR", icon: "clock", roles: ["EMPLOYEE"] },
  { href: "/payslips", label: "My Payslips", icon: "wallet", roles: ["EMPLOYEE"] },
  { href: "/employees", label: "Employees", icon: "users", roles: HR },
  { href: "/attendance", label: "Attendance", icon: "scan", roles: HR },
  { href: "/tk", label: "TK", icon: "clock", roles: HR },
  { href: "/dtr-review", label: "DTR Review", icon: "clipboard", roles: HR },
  { href: "/schedule", label: "Schedule", icon: "calendar", roles: HR },
  { href: "/payroll", label: "Payroll", icon: "wallet", roles: ADMIN },
  {
    href: "/setup",
    label: "Setup",
    icon: "setup",
    roles: HR,
    children: [
      { href: "/setup/cost-centers", label: "Cost centers" },
      { href: "/setup/campaigns", label: "Campaigns" },
      { href: "/setup/departments", label: "Departments" },
      { href: "/setup/job-positions", label: "Job positions" },
      { href: "/setup/announcements", label: "Announcements" },
      { href: "/setup/time-clock-ips", label: "Time clock IPs" },
    ],
  },
  {
    href: "/settings",
    label: "Settings",
    icon: "settings",
    roles: ADMIN,
    children: [
      { href: "/settings/company", label: "Company", roles: ["OWNER"] },
      { href: "/settings/locale", label: "Locale & formats" },
      { href: "/settings/attendance", label: "Attendance rules" },
      { href: "/settings/payroll", label: "Payroll" },
      { href: "/settings/security", label: "Security" },
      { href: "/settings/users", label: "Users", roles: ["OWNER"] },
      { href: "/settings/photos", label: "Photos", roles: ["OWNER"] },
      { href: "/settings/audit", label: "Audit log" },
      { href: "/settings/data", label: "Data" },
    ],
  },
];

export type ResolvedNavItem = {
  href: string;
  label: string;
  icon: IconKey;
  children?: readonly NavChild[];
};

export function navForRole(role: UserRole): ResolvedNavItem[] {
  return NAV.filter((item) => item.roles.includes(role))
    .map(({ href, label, icon, children }) => ({
      href,
      label,
      icon,
      children: children?.filter((child) => !child.roles || child.roles.includes(role)),
    }))
    .map((item) =>
      item.children && item.children.length > 0 ? item : { ...item, children: undefined },
    );
}
