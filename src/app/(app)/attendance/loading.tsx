import { PageBody } from "@/components/page-header";
import { FormSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={2} />
      <PageBody>
        <div className="space-y-4">
          <FormSkeleton title fields={8} grid />
          <TableSkeleton title toolbar rows={5} cols={6} />
        </div>
      </PageBody>
    </>
  );
}
