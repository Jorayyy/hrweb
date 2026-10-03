"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/(app)/actions";

type Props = {
  items: { href: string; label: string }[];
  user: { name: string | null; email: string | null; role: string };
};

export function Sidebar({ items, user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-300">
      <div className="px-5 py-5 text-sm font-semibold tracking-wide text-white">BPO-HRWeb</div>

      <nav className="flex-1 space-y-0.5 px-3">
        {items.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-zinc-800 text-white" : "hover:bg-zinc-900 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="truncate text-sm text-white">{user.name}</div>
        <div className="truncate text-xs text-zinc-500">{user.email}</div>
        <div className="mt-0.5 text-[11px] uppercase tracking-wider text-zinc-500">{user.role}</div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="mt-3 w-full rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900 hover:text-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
