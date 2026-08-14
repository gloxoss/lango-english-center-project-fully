// providers-client.tsx
// CLIENT ISLAND — owns provider table selection, inspector panel, real test runner,
// add/edit modals and derived health recommendations.
'use client';

import React, { useState, useTransition } from 'react';
import {
  RefreshCw, Plus, Server, Activity, AlertTriangle,
  FileText, ExternalLink, Layers, Play, X, Key,
} from 'lucide-react';
import { INTEGRATION_RESOURCE_LINKS } from '@/features/settings/data/providers-config';

export type ProviderItem = {
  id: string;
  name: string;
  category: string;
  providerName: string;
  endpointUrl: string;
  status: 'operational' | 'degraded' | 'disconnected';
  latencyMs: number;
  ownerName: string;
  quotaUsed: number;
  quotaTotal: number;
  quotaUnit: string;
  senderId: string;
  lastPing: string;
};

export type LogItem = {
  id: string;
  timestamp: string;
  providerId: string;
  event: string;
  status: string;
  code: number;
  latencyMs: number;
};

type ProviderForm = {
  name: string;
  category: string;
  providerName: string;
  endpointUrl: string;
  senderId: string;
};

const EMPTY_FORM: ProviderForm = {
  name: '',
  category: 'Communication',
  providerName: '',
  endpointUrl: '',
  senderId: '',
};

const CATEGORY_OPTIONS = [
  { value: 'Communication', label: 'Communication (SMS/WhatsApp)' },
  { value: 'Messaging', label: 'Messagerie (SMTP/Email)' },
  { value: 'Finance', label: 'Finance & Paiement (CMI)' },
  { value: 'Infrastructures', label: 'Infrastructures & Stockage' },
  { value: 'Conformité', label: 'Conformité (CNDP)' },
  { value: 'Académique', label: 'Académique (Massar)' },
];

type Props = {
  initialProviders: ProviderItem[];
  initialLogs: LogItem[];
};

export function ProvidersClient({ initialProviders, initialLogs }: Props) {
  const [providers, setProviders] = useState<ProviderItem[]>(initialProviders);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(initialProviders[0]?.id || '');
  const [logs, setLogs] = useState<LogItem[]>(initialLogs);
  const [testingAll, setTestingAll] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<ProviderForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ProviderForm>(EMPTY_FORM);
  const [isPending, startTransition] = useTransition();

  const selectedProvider = providers.find(p => p.id === selectedProviderId) ?? providers[0] ?? null;

  function handleTestSingleProvider(id: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/providers/${id}/test`, { method: 'POST' });
        const payload = await res.json();
        if (payload.provider) {
          setProviders(prev => prev.map(p => (p.id === id ? payload.provider : p)));
        }
        if (payload.logItem) {
          setLogs(prev => [payload.logItem, ...prev].slice(0, 50));
        }
      } catch {
        // Network failure on the request itself — state is left unchanged.
      }
    });
  }

  function handleTestAllConnections() {
    setTestingAll(true);
    startTransition(async () => {
      try {
        const results = await Promise.all(
          providers.map(p =>
            fetch(`/api/settings/providers/${p.id}/test`, { method: 'POST' })
              .then(r => r.json())
              .catch(() => null),
          ),
        );
        const newLogs: LogItem[] = [];
        for (const payload of results) {
          if (payload?.provider) {
            setProviders(prev => prev.map(p => (p.id === payload.provider.id ? payload.provider : p)));
          }
          if (payload?.logItem) newLogs.push(payload.logItem);
        }
        if (newLogs.length > 0) setLogs(prev => [...newLogs, ...prev].slice(0, 50));
      } finally {
        setTestingAll(false);
      }
    });
  }

  function handleSubmitAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(addForm),
        });
        const payload = await res.json();
        if (payload.provider) {
          setProviders(prev => [...prev, payload.provider]);
          setSelectedProviderId(payload.provider.id);
          setAddModalOpen(false);
          setAddForm(EMPTY_FORM);
        }
      } catch {
        // Network failure — keep the modal open for retry.
      }
    });
  }

  function handleSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProvider) return;
    const id = selectedProvider.id;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/settings/providers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        });
        const payload = await res.json();
        if (payload.provider) {
          setProviders(prev => prev.map(p => (p.id === id ? payload.provider : p)));
          setEditModalOpen(false);
        }
      } catch {
        // Network failure — keep the modal open for retry.
      }
    });
  }

  function openEditModal() {
    if (!selectedProvider) return;
    setEditForm({
      name: selectedProvider.name,
      category: selectedProvider.category,
      providerName: selectedProvider.providerName,
      endpointUrl: selectedProvider.endpointUrl,
      senderId: selectedProvider.senderId,
    });
    setEditModalOpen(true);
  }

  // Stat summary metrics
  const connectedCount = providers.filter(p => p.status === 'operational' || p.status === 'degraded').length;
  const healthyCount = providers.filter(p => p.status === 'operational').length;
  const warningCount = providers.filter(p =>
    p.status === 'degraded' || (p.quotaTotal > 0 && p.quotaUsed / p.quotaTotal >= 0.75),
  ).length;
  const lastSync = logs[0]?.timestamp ?? 'Jamais';

  // Recommendations derived from real provider states.
  const recommendations = [
    ...providers.filter(p => p.status === 'disconnected').map(p => ({
      id: `disc-${p.id}`,
      type: 'warning' as const,
      title: `Connexion non configurée : ${p.name}`,
      description: "Aucun health check réussi. Testez la connexion pour vérifier la disponibilité.",
      actionLabel: 'Tester la connexion',
      targetId: p.id,
    })),
    ...providers.filter(p => p.status === 'degraded').map(p => ({
      id: `deg-${p.id}`,
      type: 'warning' as const,
      title: `Service dégradé : ${p.name}`,
      description: p.lastPing !== 'Jamais' ? `Dernier test : ${p.lastPing}.` : 'Dernier test en échec.',
      actionLabel: 'Relancer un test',
      targetId: p.id,
    })),
  ];

  const formInputClass = 'px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none';

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Fournisseurs &amp; Connexions Externes</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Surveillance des API tierces, passerelle SMS, SMTP Email, stockage cloud et paiement CMI.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestAllConnections}
            disabled={testingAll || isPending}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#4B6BFB]
              bg-[#F0F4FF] border border-[#C7D2FE] rounded-xl hover:bg-[#E0E8FF] disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${testingAll ? 'animate-spin' : ''}`} />
            {testingAll ? 'Test en cours...' : 'Tester les connexions'}
          </button>
          <button
            id="add-connection-btn"
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <Plus className="w-4 h-4" />
            Ajouter une connexion
          </button>
        </div>
      </div>

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Connexions testées</p>
            <p className="text-2xl font-bold text-[#111827]">{connectedCount} / {providers.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Réponse au dernier test de santé</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Fournisseurs en santé</p>
            <p className="text-2xl font-bold text-[#111827]">{healthyCount}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Services opérationnels</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Avertissements / Quotas</p>
            <p className="text-2xl font-bold text-[#111827]">{warningCount}</p>
            <p className="text-[11px] font-semibold text-amber-600">Seuil de quota proche</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Dernier health check</p>
            <p className="text-sm font-bold text-[#111827]">{lastSync}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">Tests manuels &amp; health checks</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Derived Recommendations Banner ── */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {recommendations.map(rec => (
            <div
              key={rec.id}
              className="p-4 rounded-2xl border bg-amber-50/80 border-amber-200 text-amber-900 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-xs font-bold">{rec.title}</p>
                  <p className="text-xs mt-0.5 opacity-90">{rec.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => rec.targetId && handleTestSingleProvider(rec.targetId)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#E5E7EB] rounded-lg hover:bg-slate-50 shrink-0"
              >
                {rec.actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Main Two-Area Layout (Table + Inspector Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Area (2 Cols): High-Density Table & Connection Logs ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* High-Density Providers Table */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#4B6BFB]" />
                <h2 className="text-sm font-semibold text-[#111827]">Liste des Intégrations API &amp; Services</h2>
              </div>
              <span className="text-xs text-[#6B7280]">{providers.length} services</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-3 px-4">Service / Intégration</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4">Endpoint API</th>
                    <th className="py-3 px-4 text-center">Latence</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] font-medium text-[#374151]">
                  {providers.map(p => {
                    const isSelected = p.id === selectedProviderId;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedProviderId(p.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#F0F4FF]/70 font-semibold' : 'hover:bg-[#F9FAFB]'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-[#111827]">{p.name}</p>
                          <p className="text-[11px] text-[#6B7280]">{p.providerName || '—'}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-[#F3F4F6] text-[#374151]">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#6B7280] max-w-[200px] truncate">
                          {p.endpointUrl}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-[11px]">
                          {p.status === 'disconnected' ? '—' : `${p.latencyMs} ms`}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'operational'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.status === 'degraded'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              p.status === 'operational' ? 'bg-emerald-500' : p.status === 'degraded' ? 'bg-amber-500' : 'bg-slate-400'
                            }`} />
                            {p.status === 'operational' ? 'Opérationnel' : p.status === 'degraded' ? 'Dégradé' : 'Non configuré'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestSingleProvider(p.id);
                            }}
                            disabled={isPending}
                            className="p-1.5 rounded-lg hover:bg-white text-[#4B6BFB] font-medium disabled:opacity-50"
                            title="Tester la connexion"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Connection Event Logs Panel */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">Journal des Événements &amp; Pings Health Check</h3>
              </div>
              <span className="text-xs text-[#9CA3AF]">Historique récent</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F9FAFB] text-[#6B7280] font-sans font-semibold border-b border-[#E5E7EB]">
                  <tr>
                    <th className="py-2.5 px-3">Heure</th>
                    <th className="py-2.5 px-3">Service</th>
                    <th className="py-2.5 px-3">Événement</th>
                    <th className="py-2.5 px-3 text-center">Code HTTP</th>
                    <th className="py-2.5 px-3 text-center">Latence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[#374151]">
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 px-3 text-center text-[#6B7280] font-sans">
                        Aucun health check enregistré pour le moment. Lancez un test de connexion.
                      </td>
                    </tr>
                  )}
                  {logs.map(log => {
                    const p = providers.find(pr => pr.id === log.providerId);
                    return (
                      <tr key={log.id} className="hover:bg-[#F9FAFB]">
                        <td className="py-2.5 px-3 text-[#9CA3AF]">{log.timestamp}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-[#111827]">{p?.name || log.providerId}</td>
                        <td className="py-2.5 px-3">{log.event}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.code === 200 || log.code === 250 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {log.code === 0 ? '—' : log.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-[#6B7280]">{log.latencyMs} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* ── Right Area (1 Col): Inspector Panel & Resources ── */}
        <div className="flex flex-col gap-6">

          {/* Inspector Panel for Selected Provider */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-5 shadow-2xs">
            {!selectedProvider ? (
              <p className="text-xs text-[#6B7280] text-center py-6">
                Aucune connexion configurée. Ajoutez-en une pour afficher ses détails.
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-[#F3F4F6] pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B6BFB]">Détails du Service</span>
                    <h3 className="text-base font-bold text-[#111827] mt-0.5">{selectedProvider.name}</h3>
                    <p className="text-xs text-[#6B7280]">{selectedProvider.providerName || '—'}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedProvider.status === 'operational' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {selectedProvider.status === 'operational' ? 'Opérationnel' : selectedProvider.status === 'degraded' ? 'Dégradé' : 'Non configuré'}
                  </span>
                </div>

                {/* Quota Gauge Progress */}
                {selectedProvider.quotaTotal > 0 && (
                  <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#374151]">Utilisation des Quotas</span>
                      <span className="text-[#111827]">
                        {selectedProvider.quotaUsed} / {selectedProvider.quotaTotal} {selectedProvider.quotaUnit}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          selectedProvider.quotaUsed / selectedProvider.quotaTotal >= 0.75
                            ? 'bg-amber-500'
                            : 'bg-[#4B6BFB]'
                        }`}
                        style={{ width: `${Math.min(100, (selectedProvider.quotaUsed / selectedProvider.quotaTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Metadata Fields */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">Identifiant / Sender ID :</span>
                    <span className="font-semibold text-[#111827]">{selectedProvider.senderId || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">Endpoint API :</span>
                    <span className="font-mono text-[11px] text-[#374151] truncate max-w-[180px]">{selectedProvider.endpointUrl}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">Responsable :</span>
                    <span className="font-semibold text-[#111827]">{selectedProvider.ownerName || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#6B7280]">Dernier Health Check :</span>
                    <span className="text-[#374151]">{selectedProvider.lastPing}</span>
                  </div>
                </div>

                {/* Inspector Action Buttons */}
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleTestSingleProvider(selectedProvider.id)}
                    disabled={isPending}
                    className="w-full py-2 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl transition-all shadow-xs disabled:opacity-60"
                  >
                    Tester la connexion maintenant
                  </button>
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="w-full py-2 text-xs font-semibold text-[#374151] bg-white border border-[#E5E7EB] hover:bg-[#F9FAFB] rounded-xl transition-colors"
                  >
                    Modifier la connexion
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Integration Resources & Guides Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-2xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4B6BFB]" />
              <h3 className="text-sm font-semibold text-[#111827]">Documentation &amp; Guides</h3>
            </div>
            <div className="space-y-2">
              {INTEGRATION_RESOURCE_LINKS.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2.5 bg-[#F9FAFB] rounded-xl text-xs font-medium text-[#374151] hover:bg-[#F0F4FF] hover:text-[#4B6BFB] transition-colors"
                >
                  <span className="truncate pr-2">{link.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── Modal: Ajouter une Connexion ── */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827]">Ajouter une nouvelle intégration</h3>
              <button onClick={() => setAddModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Nom du service *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="ex: Passerelle SMS Maroc Telecom"
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Catégorie *</label>
                <select
                  value={addForm.category}
                  onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                  className={formInputClass}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Nom du fournisseur</label>
                <input
                  type="text"
                  value={addForm.providerName}
                  onChange={e => setAddForm({ ...addForm, providerName: e.target.value })}
                  placeholder="ex: OrangeAPI Morocco"
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">URL du serveur / Endpoint API *</label>
                <input
                  type="text"
                  required
                  value={addForm.endpointUrl}
                  onChange={e => setAddForm({ ...addForm, endpointUrl: e.target.value })}
                  placeholder="https://api.provider.ma/v1"
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Identifiant / Sender ID</label>
                <input
                  type="text"
                  value={addForm.senderId}
                  onChange={e => setAddForm({ ...addForm, senderId: e.target.value })}
                  placeholder="ex: LEC-SMS"
                  className={formInputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl shadow-xs disabled:opacity-60"
                >
                  Enregistrer l'intégration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Modifier une Connexion ── */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-base font-bold text-[#111827]">Modifier la connexion</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-[#9CA3AF] hover:text-[#111827]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Nom du service *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Catégorie *</label>
                <select
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  className={formInputClass}
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Nom du fournisseur</label>
                <input
                  type="text"
                  value={editForm.providerName}
                  onChange={e => setEditForm({ ...editForm, providerName: e.target.value })}
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">URL du serveur / Endpoint API *</label>
                <input
                  type="text"
                  required
                  value={editForm.endpointUrl}
                  onChange={e => setEditForm({ ...editForm, endpointUrl: e.target.value })}
                  className={formInputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#374151]">Identifiant / Sender ID</label>
                <input
                  type="text"
                  value={editForm.senderId}
                  onChange={e => setEditForm({ ...editForm, senderId: e.target.value })}
                  className={formInputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F9FAFB] rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#4B6BFB] hover:bg-[#3B5BDB] rounded-xl shadow-xs disabled:opacity-60"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
