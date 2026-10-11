import { PageBody } from "@/components/page-header";
import { CardsSkeleton, PageHeaderSkeleton, PanelSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} />
      <PageBody>
        <div className="space-y-4">
          <CardsSkeleton count={4} />
          <div className="grid gap-4 lg:grid-cols-3">
            <PanelSkeleton className="lg:col-span-2" />
            <PanelSkeleton />
          </div>
          <TableSkeleton rows={4} cols={4} title={false} />
        </div>
      </PageBody>
    </>
  );
}
