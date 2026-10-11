import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton back actions={1} />
      <PageBody>
        <div className="mx-auto max-w-4xl">
          <TableSkeleton title rows={7} cols={3} />
        </div>
      </PageBody>
    </>
  );
}
