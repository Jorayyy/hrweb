import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, PanelSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton back actions={2} />
      <PageBody>
        <div className="space-y-4">
          <PanelSkeleton rows={4} />
          <TableSkeleton title rows={4} cols={6} />
          <TableSkeleton title rows={6} cols={5} />
        </div>
      </PageBody>
    </>
  );
}
