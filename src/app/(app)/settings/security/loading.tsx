import { PageBody } from "@/components/page-header";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={0} />
      <PageBody>
        <div className="grid max-w-4xl gap-4">
          <FormSkeleton title fields={4} grid />
          <FormSkeleton title fields={3} />
        </div>
      </PageBody>
    </>
  );
}
