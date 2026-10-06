import { requireRole } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { getCompany } from "@/lib/settings";
import { JobProgress } from "@/components/job-progress";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole();
  const company = await getCompany();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        items={navForRole(user.role)}
        user={{ name: user.name ?? null, email: user.email ?? null, role: user.role }}
        company={company}
      />
      <main className="min-w-0 flex-1 bg-muted/40">{children}</main>
      <JobProgress />
    </div>
  );
}
