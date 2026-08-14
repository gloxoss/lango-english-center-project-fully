'use client';

import React, { useEffect, useState } from 'react';
import { Navigation, Plus, Search, Filter, Edit2, Trash2, ArrowRight, Sun, Moon, Clock, X } from 'lucide-react';

interface TransportRoute {
  id: string;
  routeCode: string;
  routeName: string;
  serviceDirection: string;
  status: string;
  description?: string | null;
}

export default function RoutesPage() {
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [formData, setFormData] = useState({
    routeCode: '',
    routeName: '',
    serviceDirection: 'morning_pickup',
    status: 'active',
    description: '',
  });

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport/routes');
      const data = await res.json();
      if (data.success) {
        setRoutes(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const openCreateModal = () => {
    setEditingRoute(null);
    setFormData({
      routeCode: `RT-${Math.floor(100 + Math.random() * 900)}`,
      routeName: '',
      serviceDirection: 'morning_pickup',
      status: 'active',
      description: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (route: TransportRoute) => {
    setEditingRoute(route);
    setFormData({
      routeCode: route.routeCode,
      routeName: route.routeName,
      serviceDirection: route.serviceDirection,
      status: route.status,
      description: route.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingRoute ? `/api/transport/routes/${editingRoute.id}` : '/api/transport/routes';
      const method = editingRoute ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchRoutes();
      } else {
        alert(data.error?.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet itinéraire ?')) return;
    try {
      const res = await fetch(`/api/transport/routes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRoutes();
      } else {
        alert(data.error?.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const filteredRoutes = routes.filter(r => {
    const matchesSearch = r.routeCode.toLowerCase().includes(search.toLowerCase()) ||
      r.routeName.toLowerCase().includes(search.toLowerCase());
    const matchesDirection = directionFilter === 'all' || r.serviceDirection === directionFilter;
    return matchesSearch && matchesDirection;
  });

  const getDirectionBadge = (dir: string) => {
    switch (dir) {
      case 'morning_pickup':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Sun className="w-3 h-3" /> Ramassage Matin</span>;
      case 'afternoon_dropoff':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"><Moon className="w-3 h-3" /> Retour Après-Midi</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200"><Clock className="w-3 h-3" /> Circuit Spécial</span>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Navigation className="w-7 h-7 text-[#0066FF]" />
            Circuits & Lignes de Transport
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Définition des itinéraires de ramassage du matin et de dépose de l'après-midi.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Créer un Itinéraire
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par code ou nom de ligne..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={directionFilter}
            onChange={e => setDirectionFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          >
            <option value="all">Toutes les directions</option>
            <option value="morning_pickup">Ramassage Matin</option>
            <option value="afternoon_dropoff">Dépose Après-Midi</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Code</th>
                <th className="p-4">Nom du Circuit</th>
                <th className="p-4">Sens de Service</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Chargement des itinéraires...</td>
                </tr>
              ) : filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Aucun itinéraire trouvé.</td>
                </tr>
              ) : (
                filteredRoutes.map(route => (
                  <tr key={route.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-semibold text-slate-900">{route.routeCode}</td>
                    <td className="p-4 font-medium text-slate-800">{route.routeName}</td>
                    <td className="p-4">{getDirectionBadge(route.serviceDirection)}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        route.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {route.status === 'active' ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(route)}
                        className="p-1.5 text-slate-600 hover:text-[#0066FF] hover:bg-slate-100 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
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
                {editingRoute ? 'Modifier l\'Itinéraire' : 'Nouveau Circuit de Transport'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Code Circuit</label>
                <input
                  type="text"
                  required
                  value={formData.routeCode}
                  onChange={e => setFormData({ ...formData, routeCode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nom de la Ligne</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ligne 1 - Agdal / Souissi"
                  value={formData.routeName}
                  onChange={e => setFormData({ ...formData, routeName: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Sens de Service</label>
                <select
                  value={formData.serviceDirection}
                  onChange={e => setFormData({ ...formData, serviceDirection: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="morning_pickup">Ramassage Matin</option>
                  <option value="afternoon_dropoff">Dépose Après-Midi</option>
                  <option value="midday_pickup">Ramassage Midi</option>
                  <option value="midday_dropoff">Dépose Midi</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Statut</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                </select>
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
