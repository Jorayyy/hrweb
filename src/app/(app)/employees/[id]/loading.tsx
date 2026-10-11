import { PageBody } from "@/components/page-header";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton back actions={1} />
      <PageBody>
        <div className="mx-auto max-w-4xl">
          <FormSkeleton title fields={8} grid />
        </div>
      </PageBody>
    </>
  );
}
