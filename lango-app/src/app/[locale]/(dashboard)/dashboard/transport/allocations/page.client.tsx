'use client';

import React, { useEffect, useState } from 'react';
import { Users, Plus, Search, Filter, Edit2, Trash2, Bus, MapPin, CheckCircle, Clock, X } from 'lucide-react';

interface Allocation {
  id: string;
  studentId: string;
  routeId: string;
  pickupStopId: string;
  dropoffStopId: string;
  startDate: string;
  endDate?: string | null;
  fareAmount?: string | number | null;
  status: string;
}

interface Route {
  id: string;
  routeName: string;
}

interface Stop {
  id: string;
  stopName: string;
}

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

  const [formData, setFormData] = useState({
    studentId: '',
    routeId: '',
    pickupStopId: '',
    dropoffStopId: '',
    startDate: new Date().toISOString().split('T')[0],
    fareAmount: '500',
    status: 'active',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allocRes, routesRes, stopsRes] = await Promise.all([
        fetch('/api/transport/allocations'),
        fetch('/api/transport/routes'),
        fetch('/api/transport/stops'),
      ]);

      const allocData = await allocRes.json();
      const routesData = await routesRes.json();
      const stopsData = await stopsRes.json();

      if (allocData.success && Array.isArray(allocData.data)) setAllocations(allocData.data);
      if (routesData.success && Array.isArray(routesData.data)) setRoutes(routesData.data);
      if (stopsData.success && Array.isArray(stopsData.data)) setStops(stopsData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingAllocation(null);
    setFormData({
      studentId: '',
      routeId: routes[0]?.id || '',
      pickupStopId: stops[0]?.id || '',
      dropoffStopId: stops[0]?.id || '',
      startDate: new Date().toISOString().split('T')[0],
      fareAmount: '500',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (alloc: Allocation) => {
    setEditingAllocation(alloc);
    setFormData({
      studentId: alloc.studentId,
      routeId: alloc.routeId,
      pickupStopId: alloc.pickupStopId,
      dropoffStopId: alloc.dropoffStopId,
      startDate: alloc.startDate ? alloc.startDate.split('T')[0] : '',
      fareAmount: alloc.fareAmount ? String(alloc.fareAmount) : '0',
      status: alloc.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAllocation ? `/api/transport/allocations/${editingAllocation.id}` : '/api/transport/allocations';
      const method = editingAllocation ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert(data.error?.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous résilier/supprimer cette affectation ?')) return;
    try {
      const res = await fetch(`/api/transport/allocations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const filteredAllocations = allocations.filter(a => {
    const matchesSearch = (a.studentId ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-[#0066FF]" />
            Affectations & Abonnements Élèves
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inscription des élèves aux lignes de bus, arrêts de prise en charge et tarifs mensuels.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Affecter un Élève
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par ID ou nom de l'élève..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          >
            <option value="all">Tous les abonnements</option>
            <option value="active">Actif</option>
            <option value="paused">En pause</option>
            <option value="cancelled">Résilié</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">ID Élève</th>
                <th className="p-4">Itinéraire / Ligne</th>
                <th className="p-4">Arrêt Prise en charge</th>
                <th className="p-4">Arrêt Dépose</th>
                <th className="p-4">Tarif (MAD)</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Chargement des abonnements élèves...</td>
                </tr>
              ) : filteredAllocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Aucune affectation trouvée.</td>
                </tr>
              ) : (
                filteredAllocations.map(alloc => {
                  const rName = routes.find(r => r.id === alloc.routeId)?.routeName || alloc.routeId;
                  const pName = stops.find(s => s.id === alloc.pickupStopId)?.stopName || alloc.pickupStopId;
                  const dName = stops.find(s => s.id === alloc.dropoffStopId)?.stopName || alloc.dropoffStopId;

                  return (
                    <tr key={alloc.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-4 font-mono font-semibold text-slate-900">{alloc.studentId}</td>
                      <td className="p-4 font-medium text-slate-800">{rName}</td>
                      <td className="p-4 text-slate-600">{pName}</td>
                      <td className="p-4 text-slate-600">{dName}</td>
                      <td className="p-4 font-semibold text-[#0066FF]">{alloc.fareAmount || 0} MAD</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          alloc.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          alloc.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {alloc.status === 'active' ? 'Actif' : alloc.status === 'paused' ? 'En Pause' : 'Résilié'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => openEditModal(alloc)}
                          className="p-1.5 text-slate-600 hover:text-[#0066FF] hover:bg-slate-100 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(alloc.id)}
                          className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900">
                {editingAllocation ? 'Modifier l\'Affectation' : 'Nouvelle Inscription Transport'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">ID Élève (UUID ou Matricule)</label>
                <input
                  type="text"
                  required
                  placeholder="ID Élève..."
                  value={formData.studentId}
                  onChange={e => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Arrêt Prise en Charge</label>
                  <select
                    required
                    value={formData.pickupStopId}
                    onChange={e => setFormData({ ...formData, pickupStopId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="">Sélectionner l'arrêt</option>
                    {stops.map(s => (
                      <option key={s.id} value={s.id}>{s.stopName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Arrêt Dépose</label>
                  <select
                    required
                    value={formData.dropoffStopId}
                    onChange={e => setFormData({ ...formData, dropoffStopId: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="">Sélectionner l'arrêt</option>
                    {stops.map(s => (
                      <option key={s.id} value={s.id}>{s.stopName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Tarif Mensuel (MAD)</label>
                  <input
                    type="number"
                    required
                    value={formData.fareAmount}
                    onChange={e => setFormData({ ...formData, fareAmount: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Statut Abonnement</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="active">Actif</option>
                    <option value="paused">En Pause</option>
                    <option value="cancelled">Résilié</option>
                  </select>
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
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
