'use client';

import { useState } from 'react';
import type { ParameterDefinition } from '../../types/reporting-types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Filter, RefreshCw } from 'lucide-react';

export function ParameterForm({
  parameters,
  onSubmit,
}: {
  parameters: ParameterDefinition[];
  onSubmit: (values: Record<string, any>) => void;
}) {
  const [formValues, setFormValues] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    parameters.forEach((p) => {
      initial[p.key] = p.defaultValue ?? '';
    });
    return initial;
  });

  const handleChange = (key: string, val: any) => {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formValues);
  };

  if (!parameters || parameters.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => onSubmit(formValues)}
          className="gap-2 font-bold shadow-2xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Actualiser L'Aperçu</span>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      {parameters.map((param) => (
        <div key={param.key} className="flex flex-col gap-1.5">
          <Label className="text-xs font-bold text-slate-700">
            {param.label}
          </Label>
          {param.type === 'select' ? (
            <select
              value={formValues[param.key] || ''}
              onChange={(e) => handleChange(param.key, e.target.value)}
              className="h-9 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs focus:border-[#2487B8] focus:outline-none"
            >
              {(param.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={param.type === 'date' ? 'date' : 'text'}
              value={formValues[param.key] || ''}
              onChange={(e) => handleChange(param.key, e.target.value)}
              className="h-9 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-800"
            />
          )}
        </div>
      ))}

      <Button type="submit" variant="default" className="gap-2 font-bold shadow-2xs">
        <Filter className="h-3.5 w-3.5" />
        <span>Filtrer & Actualiser</span>
      </Button>
    </form>
  );
}
