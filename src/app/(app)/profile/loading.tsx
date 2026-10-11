import { PageBody } from "@/components/page-header";
import { FormSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} />
      <PageBody>
        <div className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-2">
          <FormSkeleton title footer={false} fields={6} grid />
          <FormSkeleton title footer={false} fields={6} grid />
          <FormSkeleton title footer={false} fields={4} grid className="lg:col-span-2" />
        </div>
      </PageBody>
    </>
  );
}
