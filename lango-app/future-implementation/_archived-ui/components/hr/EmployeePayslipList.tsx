'use client';

import React, { useEffect, useState } from 'react';
import { MONTH_NAMES_FR } from '@/libs/i18n/months';

type Payslip = {
  id: string;
  year: number;
  month: number;
  grossSalary: string;
  netSalary: string;
  issuedAt: string;
};


export function EmployeePayslipList() {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hr/payslips')
      .then(r => r.json())
      .then((data) => {
        if (data.success) {
          setPayslips(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">Chargement des bulletins de paie…</p>;
  }

  if (payslips.length === 0) {
    return <p className="text-sm text-slate-400">Aucun bulletin de paie disponible.</p>;
  }

  return (
    <div className="space-y-3">
      {payslips.map(p => (
        <div
          key={p.id}
          className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-800/50 px-4 py-3"
        >
          <div>
            <p className="font-semibold text-white">
              {MONTH_NAMES_FR[(p.month ?? 1) - 1]}
              {' '}
              {p.year}
            </p>
            <p className="text-xs text-slate-400">
              Brut:
              {' '}
              {Number(p.grossSalary).toFixed(2)}
              {' '}
              DH · Net:
              {' '}
              <span className="text-emerald-400">
                {Number(p.netSalary).toFixed(2)}
                {' '}
                DH
              </span>
            </p>
          </div>
          <a
            href={`/api/hr/payslips/${p.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Télécharger
          </a>
        </div>
      ))}
    </div>
  );
}
