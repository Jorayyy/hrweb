import { desc, eq } from "drizzle-orm";
import { announcement, users } from "@/db/schema";
import { db } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/money";
import { manilaDateKey } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReferenceForm } from "@/components/reference-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addAnnouncement, removeAnnouncement } from "../actions";
import { Section } from "../section";

export default async function AnnouncementsPage() {
  await requireRole("ADMIN", "HR");
  const announcements = await db
    .select({ ann: announcement, authorName: users.name })
    .from(announcement)
    .leftJoin(users, eq(announcement.authorId, users.id))
    .orderBy(desc(announcement.pinned), desc(announcement.publishedAt))
    .limit(20);

  return (
    <>
      <PageHeader
        back
        title="Announcements"
        description="Shown on every employee dashboard — pinned posts appear first."
      />

      <PageBody>
        <Section
          title="Announcements"
          description="Shown on every employee dashboard — pinned posts appear first."
          columns={["Title", "Message", "Author", "Published", ""]}
          empty="No announcements yet."
          rows={announcements.map(({ ann, authorName }) => ({
            key: ann.id,
            cells: [
              <span key="t" className="flex items-center gap-2">
                {ann.title}
                {ann.pinned ? <Badge variant="secondary">Pinned</Badge> : null}
              </span>,
              <span key="b" className="block max-w-md whitespace-pre-wrap text-muted-foreground">
                {ann.body}
              </span>,
              authorName ?? "—",
              <span key="d" className="tabular-nums whitespace-nowrap">
                {formatDate(manilaDateKey(ann.publishedAt.getTime()))}
              </span>,
              <form key="remove" action={removeAnnouncement.bind(null, ann.id)} className="text-right">
                <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                  Remove
                </Button>
              </form>,
            ],
          }))}
        >
          <ReferenceForm
            action={addAnnouncement}
            fields={[
              { name: "title", label: "Title", required: true, placeholder: "Payroll cutoff reminder" },
              { name: "body", label: "Message", type: "textarea", required: true, placeholder: "Write the announcement…" },
              { name: "pinned", label: "Pin to top", type: "checkbox" },
            ]}
            submitLabel="Post"
          />
        </Section>
      </PageBody>
    </>
  );
}
