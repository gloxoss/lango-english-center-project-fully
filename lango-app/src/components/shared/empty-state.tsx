import { FolderOpen, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function EmptyState({
  title = 'Aucune donnée trouvée',
  description = 'Aucun élément ne correspond à vos critères de recherche ou filtres actuels.',
  icon: Icon = FolderOpen,
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-4">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-extrabold text-[#16212B]">{title}</h4>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="mt-4 h-9 rounded-full px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-white"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
