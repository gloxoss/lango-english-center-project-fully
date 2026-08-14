'use client';

import React, { useEffect, useState } from 'react';
import { Bus, MapPin, QrCode, ShieldCheck, CheckCircle } from 'lucide-react';

interface StudentTransportView {
  studentId: string;
  allocations: Array<{
    id: string;
    routeCode?: string;
    routeName?: string;
    pickupStopName?: string;
    dropoffStopName?: string;
    status: string;
  }>;
}

export default function StudentTransportPage() {
  const [data, setData] = useState<StudentTransportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudentView = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transport/self-service/student');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Erreur d\'accès au service élève');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentView();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bus className="w-7 h-7 text-[#0066FF]" />
            Mon Bus & Circuit de Transport
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Consulter ma ligne de bus assignée, mon arrêt de montée et présenter mon badge QR.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white border rounded-xl">
          Chargement de votre abonnement transport...
        </div>
      ) : !data || !data.allocations || data.allocations.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white border rounded-xl space-y-2">
          <Bus className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-700">Aucun abonnement actif</h3>
          <p className="text-xs text-slate-500">Vous n'êtes inscrit à aucune ligne de transport scolaire pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            {data.allocations.map(alloc => (
              <div key={alloc.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Bus className="w-5 h-5 text-[#0066FF]" />
                    {alloc.routeName || alloc.routeCode || 'Ligne de Bus'}
                  </h2>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Abonnement Actif
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Arrêt Prise en Charge</span>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#0066FF]" />
                      {alloc.pickupStopName || 'Arrêt non spécifié'}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Arrêt Dépose</span>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#0066FF]" />
                      {alloc.dropoffStopName || 'Arrêt non spécifié'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs text-center space-y-4 flex flex-col items-center justify-center">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 w-fit">
              <QrCode className="w-32 h-32 text-slate-800" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Mon Pass Transport QR</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">{data.studentId}</p>
            </div>
            <p className="text-xs text-slate-400">Présenter ce code QR à l'accompagnateur lors de la montée à bord.</p>
          </div>
        </div>
      )}
    </div>
  );
}
