import { PageBody } from "@/components/page-header";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={0} />
      <PageBody>
        <FormSkeleton title fields={8} grid className="max-w-2xl" />
      </PageBody>
    </>
  );
}
