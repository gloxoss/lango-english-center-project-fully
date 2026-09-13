'use client';

import React, { useEffect, useState } from 'react';
import { Bus, MapPin, Users, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface GuardianChildTransport {
  studentId: string;
  studentName?: string;
  allocations: Array<{
    id: string;
    routeCode?: string;
    routeName?: string;
    pickupStopName?: string;
    dropoffStopName?: string;
    status: string;
  }>;
  recentScans?: Array<{
    id: string;
    eventType: string;
    scanTimestamp: string;
  }>;
}

export default function GuardianTransportPage() {
  const t = useTranslations('Transport');
  const [data, setData] = useState<GuardianChildTransport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuardianView = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/transport/self-service/guardian');
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
      } else {
        setError(result.error?.message || t('noTransportAssigned'));
      }
    } catch {
      setError(t('failedToLoadPolicies'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardianView();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bus className="w-7 h-7 text-[#0066FF]" />
            {t('guardianPortalTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('guardianPortalSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-200 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t('guardianSecureBadge')}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white border rounded-xl">
          {t('loadingChildrenTransport')}
        </div>
      ) : data.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white border rounded-xl space-y-2">
          <Users className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="font-semibold text-slate-700">{t('noActiveSubscriptions')}</h3>
          <p className="text-xs text-slate-500">{t('noActiveSubscriptionsDesc')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map(child => (
            <div key={child.studentId} className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0066FF] flex items-center justify-center font-bold">
                    {child.studentName ? child.studentName.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">{child.studentName || `${t('childId')}: ${child.studentId}`}</h2>
                    <span className="text-xs text-slate-500 font-mono">{t('childId')}: {child.studentId}</span>
                  </div>
                </div>
              </div>

              {/* Allocations */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{t('routeSubscription')}</h3>
                {child.allocations.length === 0 ? (
                  <p className="text-xs text-slate-500">{t('noRouteAssigned')}</p>
                ) : (
                  child.allocations.map(alloc => (
                    <div key={alloc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <Bus className="w-4 h-4 text-[#0066FF]" />
                          {alloc.routeName || alloc.routeCode || t('childRouteInfo')}
                        </div>
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {t('pickupStopLabel')} {alloc.pickupStopName || t('notSpecified')}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {t('dropoffStopLabel')} {alloc.dropoffStopName || t('notSpecified')}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        alloc.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {alloc.status === 'active' ? t('activeStatus') : alloc.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
