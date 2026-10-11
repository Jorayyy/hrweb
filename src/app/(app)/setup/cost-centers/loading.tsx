import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={0} />
      <PageBody>
        <TableSkeleton title toolbar rows={5} cols={3} />
      </PageBody>
    </>
  );
}
