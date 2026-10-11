import { PageBody } from "@/components/page-header";
import { FilterBarSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={3} />
      <PageBody>
        <div className="space-y-4">
          <FilterBarSkeleton />
          <TableSkeleton title={false} rows={6} cols={9} />
        </div>
      </PageBody>
    </>
  );
}
