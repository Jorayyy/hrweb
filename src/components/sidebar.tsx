"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  Leaf,
  LogOut,
  PlayCircle,
  ScanFace,
  Settings,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { IconKey, NavChild } from "@/lib/nav";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  clock: Clock3,
  scan: ScanFace,
  clipboard: ClipboardCheck,
  calendar: CalendarDays,
  wallet: Wallet,
  settings: Settings2,
  setup: Settings,
  leaf: Leaf,
};

type Props = {
  items: { href: string; label: string; icon: IconKey; children?: readonly NavChild[] }[];
  user: { name: string | null; email: string | null; role: string };
  company: { name: string; logo: string | null };
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function companyMark(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Sidebar({ items, user, company }: Props) {
  const pathname = usePathname();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300">
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
        {company.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo} alt={company.name} className="size-8 shrink-0 rounded-lg object-cover ring-1 ring-zinc-800" />
        ) : (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-zinc-100 to-zinc-300 text-[11px] font-bold uppercase tracking-wide text-zinc-900">
            {companyMark(company.name)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight text-white">{company.name}</div>
          <div className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{user.role}</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon];

          if (item.children) {
            const childActive = item.children.some(
              (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
            );
            const expanded = toggled[item.href] ?? childActive;
            return (
              <div key={item.href}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  data-tour={item.label === "Setup" ? "nav-setup" : "nav-settings"}
                  onClick={() => setToggled((prev) => ({ ...prev, [item.href]: !expanded }))}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    className={`size-3.5 shrink-0 text-zinc-500 transition-transform ${
                      expanded ? "" : "-rotate-90"
                    }`}
                  />
                </button>
                {expanded ? (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((child) => {
                      const active =
                        pathname === child.href || pathname.startsWith(`${child.href}/`);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={`block truncate rounded-lg py-1.5 pl-11 pr-3 text-[13px] transition-colors ${
                            active
                              ? "bg-zinc-800 text-white"
                              : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                          }`}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }

          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-2">
        <Link
          href="/?tutorial=1"
          data-tour="start-tour"
          className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
        >
          <PlayCircle className="size-4 shrink-0" />
          <span className="truncate">Take a tour</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-tour="sidebar-user"
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-900"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-zinc-800 text-xs font-medium text-zinc-200">
                  {initials(user.name ?? user.email ?? "??")}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{user.name}</span>
                <span className="block truncate text-[11px] uppercase tracking-wide text-zinc-500">
                  {user.role}
                </span>
              </span>
              <ChevronUp className="size-4 shrink-0 text-zinc-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOutAction()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
