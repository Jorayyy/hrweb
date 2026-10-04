"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ChevronUp,
  Clock3,
  LayoutDashboard,
  LogOut,
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
import type { IconKey } from "@/lib/nav";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  users: Users,
  clock: Clock3,
  calendar: CalendarDays,
  wallet: Wallet,
  settings: Settings2,
};

type Props = {
  items: { href: string; label: string; icon: IconKey }[];
  user: { name: string | null; email: string | null; role: string };
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Sidebar({ items, user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300">
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-white text-[11px] font-bold text-zinc-900">
          HR
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight text-white">BPO-HRWeb</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-zinc-500">
            People · Time · Pay
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-900">
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
