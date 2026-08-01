import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({
  rowCount = 5,
  columnCount = 6,
}: {
  rowCount?: number;
  columnCount?: number;
}) {
  return (
    <div className="w-full space-y-3 p-4">
      {Array.from({ length: rowCount }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-2 border-b border-slate-100">
          {Array.from({ length: columnCount }).map((_, c) => (
            <Skeleton
              key={c}
              className={`h-6 rounded-md bg-slate-200/70 ${
                c === 0 ? 'w-8' : c === 1 ? 'flex-1 min-w-[120px]' : 'w-24'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
