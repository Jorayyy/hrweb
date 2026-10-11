import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} />
      <PageBody>
        <TableSkeleton title rows={5} cols={5} />
      </PageBody>
    </>
  );
}
