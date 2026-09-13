'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Plus, Search, Filter, AlertTriangle, CheckCircle, Lock, Eye, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface TransportIncident {
  id: string;
  incidentType: string;
  severity: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt: string;
  reportedByUserId: string;
  safeguardingRedactedNotes?: string | null;
}

export default function IncidentsPage() {
  const t = useTranslations('Transport');
  const locale = useLocale();

  const [incidents, setIncidents] = useState<TransportIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    incidentType: 'missed_pickup',
    severity: 'medium',
    description: '',
    safeguardingRedactedNotes: '',
  });

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport/incidents');
      const data = await res.json();
      if (data.success) {
        setIncidents(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/transport/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setFormData({
          title: '',
          incidentType: 'missed_pickup',
          severity: 'medium',
          description: '',
          safeguardingRedactedNotes: '',
        });
        fetchIncidents();
      } else {
        alert(data.error?.message || t('serverError'));
      }
    } catch (err) {
      alert(t('serverError'));
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            <AlertTriangle className="w-3 h-3" />
            {t('severityCritical')}
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3" />
            {t('severityHigh')}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            {t('severityMedium')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {t('severityLow')}
          </span>
        );
    }
  };

  const filteredIncidents = incidents.filter(i => {
    return severityFilter === 'all' || i.severity === severityFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-red-600" />
            {t('incidentsTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('incidentsSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          {t('reportIncident')}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          >
            <option value="all">{t('allSeverities')}</option>
            <option value="critical">{t('severityCritical')}</option>
            <option value="high">{t('severityHigh')}</option>
            <option value="medium">{t('severityMedium')}</option>
            <option value="low">{t('severityLow')}</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            {t('loadingIncidents')}
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            {t('noIncidentsFound')}
          </div>
        ) : (
          filteredIncidents.map(incident => (
            <div key={incident.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 hover:border-slate-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    {incident.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{incident.incidentType.replace(/_/g, ' ')}</p>
                </div>
                {getSeverityBadge(incident.severity)}
              </div>

              {incident.description && (
                <p className="text-xs text-slate-600 line-clamp-2">{incident.description}</p>
              )}

              {incident.safeguardingRedactedNotes && (
                <div className="p-2.5 bg-red-50/50 border border-red-100 rounded-lg text-xs text-red-900 flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">{t('safeguardingNotesLabel')}:</span>
                    <span>{incident.safeguardingRedactedNotes}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t flex items-center justify-between text-xs text-slate-500">
                <span>{new Date(incident.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : 'fr-FR')}</span>
                <span className="font-medium text-slate-700 capitalize">{incident.status}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">{t('reportIncident')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('incidentTitleLabel')} *</label>
                <input
                  type="text"
                  required
                  placeholder={t('incidentTitleLabel')}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('incidentTypeLabel')}</label>
                  <select
                    value={formData.incidentType}
                    onChange={e => setFormData({ ...formData, incidentType: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="missed_pickup">{t('incidentTypeMissedPickup')}</option>
                    <option value="late_route">{t('incidentTypeDelay')}</option>
                    <option value="accident">{t('incidentTypeAccident')}</option>
                    <option value="behavior">{t('incidentTypeBehavior')}</option>
                    <option value="vehicle_breakdown">{t('incidentTypeBreakdown')}</option>
                    <option value="other">{t('incidentTypeOther')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('severityLabel')}</label>
                  <select
                    value={formData.severity}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="low">{t('severityLow')}</option>
                    <option value="medium">{t('severityMedium')}</option>
                    <option value="high">{t('severityHigh')}</option>
                    <option value="critical">{t('severityCritical')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('description')}</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-red-600" />
                  {t('safeguardingNotesLabel')}
                </label>
                <textarea
                  rows={2}
                  placeholder={t('safeguardingNotice')}
                  value={formData.safeguardingRedactedNotes}
                  onChange={e => setFormData({ ...formData, safeguardingRedactedNotes: e.target.value })}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-red-50/20 focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm"
                >
                  {t('submitIncident')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
