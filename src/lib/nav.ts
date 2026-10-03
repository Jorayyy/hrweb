import type { UserRole } from "@/db/schema";

export type NavItem = {
  href: string;
  label: string;
  roles: readonly UserRole[];
};

const ALL: readonly UserRole[] = ["ADMIN", "HR", "PAYROLL", "EMPLOYEE"];

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Dashboard", roles: ALL },
  { href: "/employees", label: "Employees", roles: ["ADMIN", "HR"] },
  { href: "/attendance", label: "Attendance", roles: ["ADMIN", "HR"] },
  { href: "/payroll", label: "Payroll", roles: ["ADMIN", "PAYROLL"] },
  { href: "/setup", label: "Setup", roles: ["ADMIN", "HR"] },
];

export function navForRole(role: UserRole): { href: string; label: string }[] {
  return NAV.filter((item) => item.roles.includes(role)).map(({ href, label }) => ({ href, label }));
}
