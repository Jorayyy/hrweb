import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={2} />
      <PageBody>
        <TableSkeleton rows={7} cols={8} />
      </PageBody>
    </>
  );
}
