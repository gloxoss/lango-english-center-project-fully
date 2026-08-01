import { Card } from '@/components/ui/card';
import { Construction } from 'lucide-react';

// ponytail: shared honest "not built yet" placeholder - used wherever a page
// has zero backend and would otherwise show fabricated numbers.
export function ComingSoonView({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">{description}</p>
      </div>
      <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-3">
        <Construction className="w-8 h-8 text-slate-300" />
        <p className="text-sm font-bold text-slate-500">Fonctionnalité à venir</p>
        <p className="text-xs text-slate-400 max-w-sm">Ce module n&apos;est pas encore disponible sur la plateforme.</p>
      </Card>
    </div>
  );
}
