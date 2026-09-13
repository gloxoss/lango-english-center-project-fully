'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, QrCode, UserCheck, AlertTriangle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface RosterItem {
  id: string;
  studentId: string;
  pickupStopId: string;
  dropoffStopId: string;
  boardingStatus: 'scheduled' | 'boarded' | 'alighted' | 'absent' | 'excused';
}

interface Stop {
  id: string;
  stopName: string;
}

export default function BoardingPage() {
  const t = useTranslations('Transport');
  const tc = useTranslations('Common');
  const searchParams = useSearchParams();
  const initialTripId = searchParams.get('tripId') || '';

  const [tripId, setTripId] = useState(initialTripId);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanType, setScanType] = useState<'boarded' | 'alighted'>('boarded');
  const [selectedStopId, setSelectedStopId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRoster = async () => {
    if (!tripId || tripId === 'undefined') return;
    setLoading(true);
    try {
      const [rosterRes, stopsRes] = await Promise.all([
        fetch(`/api/transport/trips/${tripId}/roster`),
        fetch('/api/transport/stops'),
      ]);

      const rosterData = await rosterRes.json();
      const stopsData = await stopsRes.json();

      if (rosterData.success) {
        setRoster(rosterData.data || []);
      }
      if (stopsData.success && Array.isArray(stopsData.data)) {
        setStops(stopsData.data);
        if (stopsData.data.length > 0 && !selectedStopId) {
          setSelectedStopId(stopsData.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tripId && tripId !== 'undefined') fetchRoster();
  }, [tripId]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || !tripId || !selectedStopId) return;

    setMessage(null);
    try {
      const idempotencyKey = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await fetch('/api/transport/rider-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          studentId: scanInput.trim(),
          stopId: selectedStopId,
          eventType: scanType,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const statusText = scanType === 'boarded' ? t('boarded') : t('alighted');
        setMessage({
          type: 'success',
          text: t('scanSuccess', { studentId: scanInput.trim(), status: statusText }),
        });
        setScanInput('');
        fetchRoster();
      } else {
        setMessage({
          type: 'error',
          text: data.error?.message || t('scanFailed'),
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('networkError') });
    }
  };

  const renderBoardingBadge = (status: string) => {
    switch (status) {
      case 'boarded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            {t('boarded')}
          </span>
        );
      case 'alighted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            {t('alighted')}
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
            {t('absent')}
          </span>
        );
      case 'excused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            {t('excused')}
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {t('scheduled')}
          </span>
        );
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle className="w-7 h-7 text-[#0066FF]" />
            {t('boardingTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('boardingSubtitle')}
          </p>
        </div>
      </div>

      {/* Select Trip & Scan Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scanner Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
            <QrCode className="w-5 h-5 text-[#0066FF]" />
            {t('terminalTitle')}
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('tripIdLabel')}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={t('tripIdPlaceholder')}
                  value={tripId}
                  onChange={e => setTripId(e.target.value)}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
                <button
                  onClick={fetchRoster}
                  className="px-3 py-2 bg-slate-100 font-semibold text-xs text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  {t('load')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('currentStop')}</label>
              <select
                value={selectedStopId}
                onChange={e => setSelectedStopId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
              >
                <option value="">{t('selectStop')}</option>
                {stops.map(s => (
                  <option key={s.id} value={s.id}>{s.stopName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('scanType')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScanType('boarded')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                    scanType === 'boarded' ? 'bg-[#0066FF] text-white border-[#0066FF]' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4" />
                  {t('board')}
                </button>
                <button
                  type="button"
                  onClick={() => setScanType('alighted')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition ${
                    scanType === 'alighted' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  {t('alight')}
                </button>
              </div>
            </div>

            <form onSubmit={handleScanSubmit} className="pt-2 border-t space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('studentBadgeLabel')}</label>
                <input
                  type="text"
                  placeholder={t('studentBadgePlaceholder')}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <button
                type="submit"
                disabled={!tripId || !scanInput.trim()}
                className="w-full py-2.5 bg-[#0066FF] hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-sm transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {t('validateScan')}
              </button>
            </form>

            {message && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                <span>{message.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Roster Snapshot */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#0066FF]" />
              {t('rosterTitle')}
            </h2>
            <span className="text-xs text-slate-500 font-medium">{tc('total')}: {roster.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="p-3">{t('student')}</th>
                  <th className="p-3">{t('pickupStop')}</th>
                  <th className="p-3">{t('dropoffStop')}</th>
                  <th className="p-3">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {!tripId ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">{t('selectTripPrompt')}</td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">{tc('loading')}</td>
                  </tr>
                ) : roster.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">{t('noStudentsInRoster')}</td>
                  </tr>
                ) : (
                  roster.map(item => {
                    const pStop = stops.find(s => s.id === item.pickupStopId)?.stopName || item.pickupStopId;
                    const dStop = stops.find(s => s.id === item.dropoffStopId)?.stopName || item.dropoffStopId;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-3 font-mono font-medium text-slate-900">{item.studentId}</td>
                        <td className="p-3 text-xs text-slate-600">{pStop}</td>
                        <td className="p-3 text-xs text-slate-600">{dStop}</td>
                        <td className="p-3">
                          {renderBoardingBadge(item.boardingStatus)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
