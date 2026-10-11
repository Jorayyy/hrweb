import { PageBody } from "@/components/page-header";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={0} />
      <PageBody>
        <PanelSkeleton rows={6} className="max-w-xl" />
      </PageBody>
    </>
  );
}
