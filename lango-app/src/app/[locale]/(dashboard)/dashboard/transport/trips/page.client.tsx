'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Plus, Search, Filter, Play, CheckCircle, Bus, Navigation, Users, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

interface Trip {
  id: string;
  routeId: string;
  vehicleId?: string | null;
  driverId?: string | null;
  attendantId?: string | null;
  serviceDate: string;
  status: string;
  scheduledDepartureTime?: string | null;
  scheduledArrivalTime?: string | null;
  actualDepartureTime?: string | null;
  actualArrivalTime?: string | null;
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
    scheduledDepartureTime: '07:30',
    scheduledArrivalTime: '08:15',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tripsRes, routesRes, vehRes] = await Promise.all([
        fetch(`/api/transport/trips?serviceDate=${dateFilter}`),
        fetch('/api/transport/routes'),
        fetch('/api/transport/vehicles'),
      ]);

      const tripsData = await tripsRes.json();
      const routesData = await routesRes.json();
      const vehData = await vehRes.json();

      if (tripsData.success) setTrips(tripsData.data);
      if (routesData.success) setRoutes(routesData.data);
      if (vehData.success) setVehicles(vehData.data);
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
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error?.message || 'Erreur lors de la programmation du trajet');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleStartTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/transport/trips/${tripId}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Erreur lors du démarrage');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    try {
      const res = await fetch(`/api/transport/trips/${tripId}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Erreur lors de la clôture');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const filteredTrips = trips.filter(t => {
    return statusFilter === 'all' || t.status === statusFilter;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#0066FF]" />
            Dispatch & Trajets du Jour
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Programmation, démarrage en direct et clôture des trajets de ramassage scolaire.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Programmer un Trajet
        </button>
      </div>

      {/* Date & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-semibold text-slate-700 uppercase">Date :</label>
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
            <option value="all">Tous les statuts</option>
            <option value="scheduled">Programmé</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Clôturé</option>
            <option value="cancelled">Annulé</option>
          </select>
        </div>
      </div>

      {/* Grid of Trips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            Chargement des trajets...
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            Aucun trajet programmé pour cette date.
          </div>
        ) : (
          filteredTrips.map(trip => {
            const routeName = routes.find(r => r.id === trip.routeId)?.routeName || trip.routeId;
            const vehCode = vehicles.find(v => v.id === trip.vehicleId)?.vehicleCode || trip.vehicleId || 'Non assigné';

            return (
              <div key={trip.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 hover:border-slate-300 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-[#0066FF]" />
                      {routeName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">Date: {trip.serviceDate}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    trip.status === 'in_progress' ? 'bg-sky-50 text-sky-700 border border-sky-200 animate-pulse' :
                    trip.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    trip.status === 'scheduled' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {trip.status === 'in_progress' ? 'En Cours' : trip.status === 'completed' ? 'Terminé' : trip.status === 'scheduled' ? 'Programmé' : 'Annulé'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500"><Bus className="w-3.5 h-3.5" /> Bus:</span>
                    <span className="font-semibold text-slate-800">{vehCode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500"><Clock className="w-3.5 h-3.5" /> Départ Prévu:</span>
                    <span className="font-medium text-slate-800">{trip.scheduledDepartureTime || '--:--'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t">
                  {trip.status === 'scheduled' && (
                    <button
                      onClick={() => handleStartTrip(trip.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#0066FF] text-white text-xs font-semibold rounded-lg hover:bg-blue-600 transition"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Démarrer Le Trajet
                    </button>
                  )}

                  {trip.status === 'in_progress' && (
                    <button
                      onClick={() => handleCompleteTrip(trip.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Clôturer Le Trajet
                    </button>
                  )}

                  <Link
                    href={`/dashboard/transport/boarding?tripId=${trip.id}`}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                  >
                    Feuille d'Appel / Scans
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
              <h3 className="font-bold text-slate-900">Programmer un Nouveau Trajet</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Itinéraire / Ligne</label>
                <select
                  required
                  value={formData.routeId}
                  onChange={e => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="">Sélectionner une ligne</option>
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.routeName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Véhicule Assigné</label>
                <select
                  value={formData.vehicleId}
                  onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="">Sélectionner un véhicule</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.vehicleCode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Date du Service</label>
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
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Heure Déprat Prévu</label>
                  <input
                    type="time"
                    required
                    value={formData.scheduledDepartureTime}
                    onChange={e => setFormData({ ...formData, scheduledDepartureTime: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Heure Arrivée Prévu</label>
                  <input
                    type="time"
                    required
                    value={formData.scheduledArrivalTime}
                    onChange={e => setFormData({ ...formData, scheduledArrivalTime: e.target.value })}
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
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm"
                >
                  Programmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
