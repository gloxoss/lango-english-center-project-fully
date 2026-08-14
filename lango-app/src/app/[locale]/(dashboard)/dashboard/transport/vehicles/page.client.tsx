'use client';

import React, { useEffect, useState } from 'react';
import { Bus, Plus, Search, Filter, Edit2, Trash2, ShieldAlert, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface Vehicle {
  id: string;
  vehicleCode: string;
  registrationNumber: string;
  capacity: number;
  vehicleType: string;
  status: string;
  insuranceExpiry?: string | null;
  inspectionExpiry?: string | null;
  makeModel?: string | null;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState({
    vehicleCode: '',
    registrationNumber: '',
    capacity: 30,
    vehicleType: 'bus',
    status: 'active',
    makeModel: '',
    insuranceExpiry: '',
    inspectionExpiry: '',
  });

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport/vehicles');
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const openCreateModal = () => {
    setEditingVehicle(null);
    setFormData({
      vehicleCode: `BUS-${Math.floor(100 + Math.random() * 900)}`,
      registrationNumber: '',
      capacity: 30,
      vehicleType: 'bus',
      status: 'active',
      makeModel: '',
      insuranceExpiry: '',
      inspectionExpiry: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicleCode: vehicle.vehicleCode,
      registrationNumber: vehicle.registrationNumber,
      capacity: vehicle.capacity,
      vehicleType: vehicle.vehicleType,
      status: vehicle.status,
      makeModel: vehicle.makeModel || '',
      insuranceExpiry: vehicle.insuranceExpiry ? vehicle.insuranceExpiry.split('T')[0]! : '',
      inspectionExpiry: vehicle.inspectionExpiry ? vehicle.inspectionExpiry.split('T')[0]! : '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingVehicle ? `/api/transport/vehicles/${editingVehicle.id}` : '/api/transport/vehicles';
      const method = editingVehicle ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        fetchVehicles();
      } else {
        alert(data.error?.message || 'Erreur lors de l\'enregistrement');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce véhicule ?')) return;
    try {
      const res = await fetch(`/api/transport/vehicles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchVehicles();
      } else {
        alert(data.error?.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Erreur serveur');
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.vehicleCode.toLowerCase().includes(search.toLowerCase()) ||
      v.registrationNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bus className="w-7 h-7 text-[#0066FF]" />
            Gestion des Véhicules & Flotte
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inventaire des bus, minicars et suivi des contrôles techniques et assurances.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-blue-600 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Ajouter un Véhicule
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par code ou immatriculation..."
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
            <option value="maintenance">En Maintenance</option>
            <option value="out_of_service">Hors Service</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table role="table" aria-label="Liste des véhicules de transport" className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="p-4">Code</th>
                <th className="p-4">Immatriculation</th>
                <th className="p-4">Type / Marque</th>
                <th className="p-4">Capacité</th>
                <th className="p-4">Statut</th>
                <th className="p-4">Assurance</th>
                <th className="p-4">Visite Technique</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Chargement de la flotte...</td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">Aucun véhicule trouvé.</td>
                </tr>
              ) : (
                filteredVehicles.map(vehicle => (
                  <tr key={vehicle.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-semibold text-slate-900">{vehicle.vehicleCode}</td>
                    <td className="p-4 font-mono text-slate-700">{vehicle.registrationNumber}</td>
                    <td className="p-4 text-slate-600 capitalize">
                      {vehicle.vehicleType} {vehicle.makeModel ? `(${vehicle.makeModel})` : ''}
                    </td>
                    <td className="p-4 text-slate-900 font-medium">{vehicle.capacity} places</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        vehicle.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        vehicle.status === 'maintenance' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {vehicle.status === 'active' ? 'Actif' : vehicle.status === 'maintenance' ? 'Maintenance' : 'Hors Service'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="p-4 text-slate-600">
                      {vehicle.inspectionExpiry ? new Date(vehicle.inspectionExpiry).toLocaleDateString('fr-FR') : '-'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(vehicle)}
                        className="p-1.5 text-slate-600 hover:text-[#0066FF] hover:bg-slate-100 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(vehicle.id)}
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 id="modal-title" className="font-bold text-slate-900">
                {editingVehicle ? 'Modifier le Véhicule' : 'Nouveau Véhicule'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Code Véhicule</label>
                <input
                  type="text"
                  required
                  value={formData.vehicleCode}
                  onChange={e => setFormData({ ...formData, vehicleCode: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Immatriculation</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 12345-A-6"
                  value={formData.registrationNumber}
                  onChange={e => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Capacité</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Type</label>
                  <select
                    value={formData.vehicleType}
                    onChange={e => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="bus">Bus</option>
                    <option value="minibus">Minibus</option>
                    <option value="van">Van</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Statut</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  >
                    <option value="active">Actif</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_service">Hors Service</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Marque / Modèle</label>
                  <input
                    type="text"
                    value={formData.makeModel}
                    onChange={e => setFormData({ ...formData, makeModel: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Exp. Assurance</label>
                  <input
                    type="date"
                    value={formData.insuranceExpiry}
                    onChange={e => setFormData({ ...formData, insuranceExpiry: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0066FF]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Exp. Visite</label>
                  <input
                    type="date"
                    value={formData.inspectionExpiry}
                    onChange={e => setFormData({ ...formData, inspectionExpiry: e.target.value })}
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
