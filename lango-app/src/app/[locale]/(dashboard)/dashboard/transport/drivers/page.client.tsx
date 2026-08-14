'use client';

import React, { useEffect, useState } from 'react';
import { Users, UserCheck, ShieldCheck, Search, Filter, Phone, Mail, BadgeCheck } from 'lucide-react';

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transport/drivers');
      const data = await res.json();
      if (data.success) {
        setDrivers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || d.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-[#0066FF]" />
            Conducteurs & Accompagnateurs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Personnel habilité pour la conduite et la surveillance à bord des bus scolaires.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-blue-50 text-[#0066FF] px-3 py-2 rounded-lg border border-blue-100 font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Données RH et PII sécurisées</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un conducteur ou accompagnateur..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20"
          >
            <option value="all">Tous les rôles</option>
            <option value="driver">Conducteurs (Chauffeurs)</option>
            <option value="attendant">Accompagnateurs (Convoyeurs)</option>
          </select>
        </div>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            Chargement de l'équipe de transport...
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="col-span-full p-8 text-center text-slate-500 bg-white border rounded-xl">
            Aucun personnel de transport trouvé.
          </div>
        ) : (
          filteredDrivers.map(person => (
            <div key={person.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                    {person.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                      {person.name}
                      <BadgeCheck className="w-4 h-4 text-[#0066FF]" />
                    </h3>
                    <span className="text-xs text-slate-500 capitalize">{person.role === 'driver' ? 'Chauffeur Titulaire' : 'Accompagnateur Scolaire'}</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Qualifié
                </span>
              </div>

              <div className="space-y-1.5 pt-2 border-t text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{person.email}</span>
                </div>
                {person.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{person.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
