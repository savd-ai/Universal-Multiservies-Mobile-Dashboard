import { Skeleton } from "@/components/ui/feedback";
export default function Loading() {
    return (<div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton height={14} className="w-40"/>
      <Skeleton height={44} className="w-[min(560px,90%)]"/>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton height={180}/>
        <Skeleton height={180}/>
        <Skeleton height={180}/>
      </div>
    </div>);
}
