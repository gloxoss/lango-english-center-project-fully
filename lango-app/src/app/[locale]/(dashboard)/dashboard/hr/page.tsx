import React from 'react';
import { LeaveApprovalsTable } from '@/components/hr/LeaveApprovalsTable';
import { PayrollRunPanel } from '@/components/hr/PayrollRunPanel';

export const metadata = {
  title: 'RH & Paie — SchoolOS',
  description: 'Gestion des ressources humaines, de la paie et des congés.',
};

// HR Portal page — school_admin & accountant only.
// URL: /dashboard/hr
export default function HrPortalPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-900/40 via-indigo-900/30 to-slate-900 p-6 shadow-xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">
          Espace RH & Paie
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">
          Gestion des Ressources Humaines
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Paie mensuelle, congés et bulletins de salaire — moteur Marocain CNSS/AMO/IR.
        </p>
      </div>

      {/* Payroll run workflow */}
      <PayrollRunPanel />

      {/* Pending leave approvals */}
      <LeaveApprovalsTable />
    </div>
  );
}
