import type { UserRole } from "@/db/schema";

export type IconKey = "dashboard" | "users" | "clock" | "calendar" | "wallet" | "settings";

export type NavItem = {
  href: string;
  label: string;
  icon: IconKey;
  roles: readonly UserRole[];
};

const ALL: readonly UserRole[] = ["ADMIN", "HR", "PAYROLL", "EMPLOYEE"];

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", roles: ALL },
  { href: "/profile", label: "My Profile", icon: "users", roles: ["EMPLOYEE"] },
  { href: "/dtr", label: "My DTR", icon: "clock", roles: ["EMPLOYEE"] },
  { href: "/payslips", label: "My Payslips", icon: "wallet", roles: ["EMPLOYEE"] },
  { href: "/employees", label: "Employees", icon: "users", roles: ["ADMIN", "HR"] },
  { href: "/attendance", label: "Attendance", icon: "clock", roles: ["ADMIN", "HR"] },
  { href: "/tk", label: "TK", icon: "clock", roles: ["ADMIN", "HR"] },
  { href: "/dtr-review", label: "DTR Review", icon: "clock", roles: ["ADMIN", "HR"] },
  { href: "/schedule", label: "Schedule", icon: "calendar", roles: ["ADMIN", "HR"] },
  { href: "/payroll", label: "Payroll", icon: "wallet", roles: ["ADMIN", "PAYROLL"] },
  { href: "/setup", label: "Setup", icon: "settings", roles: ["ADMIN", "HR"] },
];

export function navForRole(role: UserRole): { href: string; label: string; icon: IconKey }[] {
  return NAV.filter((item) => item.roles.includes(role)).map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));
}
