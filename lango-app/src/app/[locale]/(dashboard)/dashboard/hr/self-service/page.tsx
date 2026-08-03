import React from 'react';
import { EmployeePayslipList } from '@/components/hr/EmployeePayslipList';
import { LeaveRequestForm } from '@/components/hr/LeaveRequestForm';

export const metadata = {
  title: 'Mon Espace RH — SchoolOS',
  description: 'Mes bulletins de paie, soldes de congés et demandes de congé.',
};

// Employee self-service portal — accessible by all authenticated staff.
// URL: /dashboard/hr/self-service
export default function HrSelfServicePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-900/40 via-slate-900 to-slate-900 p-6 shadow-xl">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Mon Espace RH
        </span>
        <h1 className="mt-1 text-2xl font-bold text-white">Paie & Congés</h1>
        <p className="mt-1 text-sm text-slate-400">
          Vos bulletins de paie, soldes de congés et demandes.
        </p>
      </div>

      {/* Leave request + balances */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Mes Congés</h2>
        <LeaveRequestForm />
      </section>

      {/* Payslips */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Mes Bulletins de Paie</h2>
        <EmployeePayslipList />
      </section>
    </div>
  );
}
