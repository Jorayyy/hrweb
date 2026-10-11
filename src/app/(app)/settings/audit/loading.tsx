import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={5} />
      <PageBody>
        <TableSkeleton title rows={8} cols={5} />
      </PageBody>
    </>
  );
}
