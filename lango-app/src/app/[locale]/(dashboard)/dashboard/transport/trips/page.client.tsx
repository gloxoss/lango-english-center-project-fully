'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Plus, Filter, Play, CheckCircle, Bus, Navigation, X } from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';

interface Trip {
  id?: string;
  routeId?: string;
  vehicleId?: string | null;
  driverId?: string | null;
  attendantId?: string | null;
  serviceDate?: string;
  direction?: string;
  status?: string;
  plannedStartTime?: string | null;
  plannedEndTime?: string | null;
  scheduledDepartureTime?: string | null;
  scheduledArrivalTime?: string | null;
  actualDepartureTime?: string | null;
  actualArrivalTime?: string | null;
  routeName?: string;
  routeCode?: string;
  vehicleCode?: string;
  registrationNumber?: string;
  trip?: {
    id: string;
    routeId: string;
    vehicleId?: string | null;
    serviceDate: string;
    status: string;
    direction?: string;
    plannedStartTime?: string | null;
    plannedEndTime?: string | null;
  };
  route?: {
    routeName: string;
    routeCode: string;
  };
  vehicle?: {
    vehicleCode: string;
    registrationNumber?: string;
  } | null;
}

interface Route {
  id: string;
  routeName: string;
}

interface Vehicle {
  id: string;
  vehicleCode: string;
}

export default function TripsPage() {
  const t = useTranslations('Transport');
  const tc = useTranslations('Common');
  const locale = useLocale();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    routeId: '',
    vehicleId: '',
    driverId: '',
    attendantId: '',
    serviceDate: new Date().toISOString().split('T')[0],
    direction: 'pickup',
    plannedStartTime: '07:30',
    plannedEndTime: '08:15',
    scheduledDepartureTime: '07:30',
    scheduledArrivalTime: '08:15',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, routesRes, vehRes] = await Promise.all([
        fetch(`/api/transport/trips?date=${dateFilter}&serviceDate=${dateFilter}`),
        fetch('/api/transport/routes'),
        fetch('/api/transport/vehicles'),
      ]);

      const tripsData = await tripsRes.json();
      const routesData = await routesRes.json();
      const vehData = await vehRes.json();

      if (tripsData.success) setTrips(tripsData.data || []);
      if (routesData.success) setRoutes(routesData.data || []);
      if (vehData.success) setVehicles(vehData.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateFilter]);

  const openCreateModal = () => {
    setFormData({
      routeId: routes[0]?.id || '',
      vehicleId: vehicles[0]?.id || '',
      driverId: '',
      attendantId: '',
      serviceDate: dateFilter,
      direction: 'pickup',
      plannedStartTime: '07:30',
      plannedEndTime: '08:15',
      scheduledDepartureTime: '07:30',
      scheduledArrivalTime: '08:15',
    });
    setIsModalOpen(true);
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/transport/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeId: formData.routeId,
          vehicleId: formData.vehicleId || null,
          driverId: formData.driverId || null,
          attendantId: formData.attendantId || null,
          serviceDate: formData.serviceDate,
          direction: formData.direction || 'pickup',
          plannedStartTime: formData.plannedStartTime || formData.scheduledDepartureTime,
          plannedEndTime: formData.plannedEndTime || formData.scheduledArrivalTime,
          scheduledDepartureTime: formData.plannedStartTime || formData.scheduledDepartureTime,
          scheduledArrivalTime: formData.plannedEndTime || formData.scheduledArrivalTime,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error?.message || t('errorSchedule'));
      }
    } catch (err) {
      alert(t('serverError'));
    }
  };

  const handleStartTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/transport/trips/${tripId}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || t('errorStart'));
      }
    } catch (err) {
      alert(t('serverError'));
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/transport/trips/${tripId}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || t('errorComplete'));
      }
    } catch (err) {
      alert(t('serverError'));
    }
  };

  const filteredTrips = trips.filter(t => {
    const status = t.status || t.trip?.status || 'scheduled';
    return statusFilter === 'all' || status === statusFilter;
  });

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
            {t('inProgress')}
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {t('completed')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {t('cancelled')}
          </span>
        );
      case 'scheduled':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
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
            <Clock className="w-7 h-7 text-[#0066FF]" />
            {t('tripsTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('tripsSubtitle')}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          {t('scheduleTrip')}
        </button>
      </div>

      {/* Date & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-700 uppercase">{t('dateLabel')}</label>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          >
            <option value="all">{t('allStatuses')}</option>
            <option value="scheduled">{t('scheduled')}</option>
            <option value="in_progress">{t('inProgress')}</option>
            <option value="completed">{t('completed')}</option>
            <option value="cancelled">{t('cancelled')}</option>
          </select>
        </div>
      </div>

      {/* Grid of Trips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            {t('loadingTrips')}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            {t('noTripsFound')}
          </div>
        ) : (
          filteredTrips.map((trip, idx) => {
            const tripId = trip.id || trip.trip?.id || `trip-${idx}`;
            const status = trip.status || trip.trip?.status || 'scheduled';
            const serviceDate = trip.serviceDate || trip.trip?.serviceDate || dateFilter;
            const routeName =
              trip.routeName ||
              trip.route?.routeName ||
              routes.find(r => r.id === (trip.routeId || trip.trip?.routeId))?.routeName ||
              trip.routeId ||
              '---';
            const vehCode =
              trip.vehicleCode ||
              trip.vehicle?.vehicleCode ||
              vehicles.find(v => v.id === (trip.vehicleId || trip.trip?.vehicleId))?.vehicleCode ||
              trip.vehicleId ||
              t('unassignedBus');
            const departureTime =
              trip.plannedStartTime ||
              trip.scheduledDepartureTime ||
              trip.trip?.plannedStartTime ||
              '--:--';

            return (
              <div key={tripId} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-[#0066FF]" />
                      {routeName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{t('dateLabel')} {serviceDate}</p>
                  </div>
                  {renderStatusBadge(status)}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500"><Bus className="w-3.5 h-3.5" /> {t('busLabel')}</span>
                    <span className="font-semibold text-slate-800">{vehCode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500"><Clock className="w-3.5 h-3.5" /> {t('scheduledDeparture')}</span>
                    <span className="font-medium text-slate-800">{departureTime}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t">
                  {status === 'scheduled' && trip.id && (
                    <button
                      onClick={() => handleStartTrip(tripId)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#0066FF] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {t('startTrip')}
                    </button>
                  )}

                  {status === 'in_progress' && trip.id && (
                    <button
                      onClick={() => handleCompleteTrip(tripId)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('completeTrip')}
                    </button>
                  )}

                  <Link
                    href={`/${locale}/dashboard/transport/boarding?tripId=${tripId}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                  >
                    {t('callSheetScans')}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">{t('scheduleNewTrip')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('routeLine')}</label>
                <select
                  required
                  value={formData.routeId}
                  onChange={e => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="">{t('selectRoute')}</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.routeName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('assignedVehicle')}</label>
                <select
                  value={formData.vehicleId}
                  onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="">{t('selectVehicle')}</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleCode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('serviceDate')}</label>
                <input
                  type="date"
                  required
                  value={formData.serviceDate}
                  onChange={e => setFormData({ ...formData, serviceDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('plannedDeparture')}</label>
                  <input
                    type="time"
                    required
                    value={formData.plannedStartTime}
                    onChange={e => setFormData({ ...formData, plannedStartTime: e.target.value, scheduledDepartureTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{t('plannedArrival')}</label>
                  <input
                    type="time"
                    required
                    value={formData.plannedEndTime}
                    onChange={e => setFormData({ ...formData, plannedEndTime: e.target.value, scheduledArrivalTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm"
                >
                  {t('schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
