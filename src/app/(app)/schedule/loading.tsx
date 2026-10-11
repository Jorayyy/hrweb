import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} />
      <PageBody>
        <div className="space-y-4">
          <TableSkeleton title toolbar rows={5} cols={5} />
          <TableSkeleton title rows={6} cols={5} />
        </div>
      </PageBody>
    </>
  );
}
