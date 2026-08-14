'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Search, Filter, Edit2, Trash2, Globe, Navigation, X } from 'lucide-react';

interface Stop {
  id: string;
  stopCode: string;
  stopName: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  status: string;
  notes?: string | null;
}

export default function StopsPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<Stop | null>(null);
  const [formData, setFormData] = useState({
    stopCode: '',
    stopName: '',
    address: '',
    latitude: '',
    longitude: '',
    status: 'active',
    notes: '',
  });

  const fetchStops = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport/stops');
      const data = await res.json();
      if (data.success) {
        setStops(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStops();
  }, []);

  const openCreateModal = () => {
    setEditingStop(null);
    setFormData({
      stopCode: `STP-${Math.floor(100 + Math.random() * 900)}`,
      stopName: '',
      address: '',
      latitude: '',
      longitude: '',
      status: 'active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (stop: Stop) => {
    setEditingStop(stop);
    setFormData({
      stopCode: stop.stopCode,
      stopName: stop.stopName,
      address: stop.address || '',
      latitude: stop.latitude !== null && stop.latitude !== undefined ? String(stop.latitude) : '',
      longitude: stop.longitude !== null && stop.longitude !== undefined ? String(stop.longitude) : '',
      status: stop.status,
      notes: stop.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingStop ? `/api/transport/stops/${editingStop.id}` : '/api/transport/stops';
      const method = editingStop ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchStops();
      } else {
        alert(data.error?.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cet arrêt ?')) return;
    try {
      const res = await fetch(`/api/transport/stops/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchStops();
      } else {
        alert(data.error?.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const filteredStops = stops.filter(s => {
    const matchesSearch = s.stopCode.toLowerCase().includes(search.toLowerCase()) ||
      s.stopName.toLowerCase().includes(search.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#0066FF]" />
            Arrêts & Points de Ramassage
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Répertoire géolocalisé des arrêts de transport et stations d'embarquement.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Ajouter un Arrêt
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par code, nom ou adresse..."
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
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
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
                <th className="p-4">Nom de l'Arrêt</th>
                <th className="p-4">Adresse</th>
                <th className="p-4">Coordonnées GPS</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Chargement des arrêts...</td>
                </tr>
              ) : filteredStops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Aucun arrêt trouvé.</td>
                </tr>
              ) : (
                filteredStops.map(stop => (
                  <tr key={stop.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-semibold text-slate-900">{stop.stopCode}</td>
                    <td className="p-4 font-medium text-slate-800">{stop.stopName}</td>
                    <td className="p-4 text-slate-600">{stop.address || '-'}</td>
                    <td className="p-4 text-xs font-mono text-slate-500">
                      {stop.latitude && stop.longitude ? `${stop.latitude}, ${stop.longitude}` : 'Non renseigné'}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        stop.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {stop.status === 'active' ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(stop)}
                        className="p-1.5 text-slate-600 hover:text-[#0066FF] hover:bg-slate-100 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(stop.id)}
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
                {editingStop ? 'Modifier l\'Arrêt' : 'Nouveau Point de Ramassage'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Code Arrêt</label>
                <input
                  type="text"
                  required
                  value={formData.stopCode}
                  onChange={e => setFormData({ ...formData, stopCode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nom de l'Arrêt</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Station Hay Riad / Ecole"
                  value={formData.stopName}
                  onChange={e => setFormData({ ...formData, stopName: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Adresse</label>
                <input
                  type="text"
                  placeholder="Avenue ou repère géographique"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="33.9716"
                    value={formData.latitude}
                    onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="-6.8498"
                    value={formData.longitude}
                    onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
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
