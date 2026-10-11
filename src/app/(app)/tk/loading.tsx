import { PageBody } from "@/components/page-header";
import { FilterBarSkeleton, PageHeaderSkeleton, PanelSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton actions={1} />
      <PageBody>
        <div className="space-y-4">
          <FilterBarSkeleton />
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
          <PanelSkeleton rows={3} />
        </div>
      </PageBody>
    </>
  );
}
