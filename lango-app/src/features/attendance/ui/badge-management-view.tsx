'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode,
  Plus,
  ShieldCheck,
  Search,
  CheckCircle2,
  X,
  Printer,
  User,
  Loader2,
  Layers,
  Users,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';

interface BadgeItem {
  id: string;
  userId: string;
  subjectType: 'student' | 'staff' | 'visitor';
  displayPrefix: string;
  status: 'active' | 'revoked' | 'expired' | 'replaced';
  issuedAt: string;
  expiresAt?: string | null;
}

interface StudentCandidate {
  id: string;
  name: string;
  matricule?: string | null;
  className?: string | null;
}

interface BulkIssuedItem {
  id: string;
  userId: string;
  userName: string;
  displayPrefix: string;
  rawToken: string;
}

export function BadgeManagementView() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Single Issue Badge State
  const [targetUserId, setTargetUserId] = useState('');
  const [targetUserName, setTargetUserName] = useState('');
  const [subjectType, setSubjectType] = useState<'student' | 'staff'>('student');
  const [issuedRawToken, setIssuedRawToken] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  // User Search State
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userResults, setUserResults] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Bulk Issue State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [cohortType, setCohortType] = useState<'students' | 'staff'>('students');
  const [candidates, setCandidates] = useState<StudentCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkIssuedItem[] | null>(null);

  const fetchBadges = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/identity-badges');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setBadges(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBadges();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!userSearchTerm.trim()) {
        setUserResults([]);
        return;
      }
      setIsSearchingUsers(true);
      try {
        const endpoint = subjectType === 'student' ? '/api/students' : '/api/users';
        const res = await fetch(`${endpoint}?search=${encodeURIComponent(userSearchTerm)}`);
        const data = await res.json();
        if (data.success) {
          setUserResults(data.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingUsers(false);
      }
    };

    const timeoutId = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [userSearchTerm, subjectType]);

  const loadCandidates = async (type: 'students' | 'staff') => {
    setLoadingCandidates(true);
    setCandidates([]);
    setSelectedIds(new Set());
    setBulkResults(null);
    try {
      if (type === 'students') {
        const res = await fetch('/api/students?limit=100');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const list = json.data.map((s: any) => ({
            id: s.id,
            name: s.fullName || s.name,
            matricule: s.matricule,
            className: s.className || s.currentClass,
          }));
          setCandidates(list);
          setSelectedIds(new Set(list.map((c: any) => c.id)));
        }
      } else {
        const res = await fetch('/api/users');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const list = json.data
            .filter((u: any) => ['teacher', 'school_admin', 'accountant', 'guard', 'receptionist'].includes(u.role))
            .map((u: any) => ({
              id: u.id,
              name: u.fullName || u.name,
              matricule: u.role,
              className: u.department || u.role,
            }));
          setCandidates(list);
          setSelectedIds(new Set(list.map((c: any) => c.id)));
        }
      }
    } catch (e) {
      console.error('Failed to load candidates', e);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkIssue = async () => {
    if (selectedIds.size === 0) return;
    setBulkIssuing(true);
    try {
      const rows = Array.from(selectedIds).map((id) => ({
        userId: id,
        subjectType: cohortType === 'students' ? ('student' as const) : ('staff' as const),
      }));

      const res = await fetch('/api/identity-badges/bulk-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });

      const json = await res.json();
      if (json.success && Array.isArray(json.data?.issued)) {
        const issuedItems: BulkIssuedItem[] = json.data.issued.map((item: any) => ({
          id: item.badge?.id || item.rawToken,
          userId: item.badge?.userId,
          userName: item.userName,
          displayPrefix: item.badge?.displayPrefix || item.rawToken.slice(0, 12),
          rawToken: item.rawToken,
        }));
        setBulkResults(issuedItems);
        await fetchBadges();
      } else {
        alert(json.error?.message || json.message || 'Erreur lors de l’émission groupée.');
      }
    } catch (e) {
      console.error('Failed bulk issue', e);
      alert('Erreur réseau.');
    } finally {
      setBulkIssuing(false);
    }
  };

  const handlePrintBatch = () => {
    const printArea = document.getElementById('printable-bulk-area');
    if (!printArea) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Planche de Badges QR - SchoolOS</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: white; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; page-break-inside: avoid; }
            .badge-card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; text-align: center; background: white; page-break-inside: avoid; }
            .school-name { font-size: 11px; font-weight: 800; color: #0066FF; text-transform: uppercase; margin-bottom: 4px; }
            .user-name { font-size: 14px; font-weight: 800; color: #16212B; margin: 4px 0; }
            .badge-type { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .qr-box { margin: 10px auto; width: 110px; height: 110px; }
            .footer-prefix { font-family: monospace; font-size: 10px; color: #94a3b8; margin-top: 6px; }
            @media print { body { padding: 0; } .grid { gap: 10px; } }
          </style>
        </head>
        <body>
          ${printArea.innerHTML}
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleIssueBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) return;
    setIssuing(true);

    try {
      const res = await fetch('/api/identity-badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUserId,
          subjectType,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setBadges([json.data.badge, ...badges]);
        setIssuedRawToken(json.data.rawToken);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIssuing(false);
    }
  };

  const handleReplaceBadge = async (badge: BadgeItem) => {
    if (!confirm('Remplacer ce badge ? L\'ancien badge sera révoqué et un nouveau QR sera émis.')) return;

    try {
      const res = await fetch(`/api/identity-badges/${badge.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setIssuedRawToken(json.data.rawToken);
        setTargetUserName(json.data.userName || badge.userId);
        setShowIssueModal(true);
        await fetchBadges();
      } else {
        alert(json.error?.message || json.message || 'Erreur lors du remplacement');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur serveur');
    }
  };

  const handleRevokeBadge = async (badgeId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer ce badge ? Cette action est irréversible.')) return;

    try {
      const res = await fetch(`/api/identity-badges/${badgeId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setBadges(badges.map((b) => (b.id === badgeId ? { ...b, status: 'revoked' } : b)));
      } else {
        alert(json.message || 'Erreur lors de la révocation');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur serveur');
    }
  };

  const handlePrintBadge = () => {
    const printContent = document.getElementById('printable-badge-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Impression Badge QR</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f8fafc; }
            .badge-card { background: white; padding: 2rem; border-radius: 1rem; border: 2px solid #e2e8f0; text-align: center; max-width: 300px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            .qr-container { background: white; padding: 1rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; margin: 1.5rem auto; display: inline-block; }
            .school-name { font-size: 0.875rem; font-weight: 700; color: #0066FF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
            .user-name { font-size: 1.25rem; font-weight: 800; color: #16212B; margin: 0; }
            .subject-type { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 0.25rem; }
            .footer-note { font-size: 0.65rem; color: #94a3b8; margin-top: 1rem; }
            @media print { body { background-color: white; } .badge-card { box-shadow: none; border-color: #000; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const filteredBadges = badges.filter(
    (b) =>
      b.displayPrefix.toLowerCase().includes(search.toLowerCase()) ||
      b.userId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0066FF] to-[#0052CC] flex items-center justify-center text-white shadow-2xs shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Gestion des Badges QR Sécurisés
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Émission de jetons QR aléatoires 128-bit cryptographiés par HMAC SHA-256 (sans PII lisible).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setShowBulkModal(true);
              loadCandidates('students');
            }}
            size="sm"
            className="border-slate-200 text-[#0066FF] hover:bg-blue-50 font-bold rounded-xl gap-2 h-10 px-4 cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Émission groupée (Cohorte)</span>
          </Button>

          <Button
            onClick={() => {
              setIssuedRawToken(null);
              setTargetUserId('');
              setTargetUserName('');
              setUserSearchTerm('');
              setShowIssueModal(true);
            }}
            size="sm"
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold rounded-xl shadow-2xs gap-2 h-10 px-4 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Émettre un Badge</span>
          </Button>
        </div>
      </div>

      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher par préfixe ou identifiant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 h-10 font-medium text-slate-800"
            />
          </div>

          <Badge className="bg-[#DDF5EC] text-[#17A673] font-bold gap-1 px-3 py-1.5 text-xs border-none">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>HMAC-SHA256 Chiffrement Actif</span>
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">Préfixe Badge</th>
                <th className="py-3.5 px-4">Type Sujet</th>
                <th className="py-3.5 px-4">Utilisateur ID</th>
                <th className="py-3.5 px-4">Statut Credential</th>
                <th className="py-3.5 px-4">Date Émission</th>
                <th className="py-3.5 px-4">Expiration</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBadges.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#0066FF]">{b.displayPrefix}</td>
                  <td className="py-3.5 px-4">
                    <Badge
                      className={`text-[10px] uppercase font-bold border-none ${
                        b.subjectType === 'staff' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {b.subjectType}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{b.userId}</td>
                  <td className="py-3.5 px-4">
                    <Badge
                      className={`text-[10px] font-bold border-none ${
                        b.status === 'active' ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{new Date(b.issuedAt).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3.5 px-4">
                    {b.expiresAt ? (
                      <span
                        className={`text-[11px] font-bold ${
                          new Date(b.expiresAt) < new Date() ? 'text-rose-600' : 'text-slate-500'
                        }`}
                      >
                        {new Date(b.expiresAt).toLocaleDateString('fr-FR')}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {b.status === 'active' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReplaceBadge(b)}
                          className="text-[#0066FF] hover:text-[#0052CC] hover:bg-blue-50 h-8 px-2 text-xs font-bold"
                        >
                          Remplacer
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeBadge(b.id)}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-2 text-xs font-bold"
                        >
                          Révoquer
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredBadges.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                    Aucun badge trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal: Single Issue Badge */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-[#16212B]">Émettre un Badge QR</h2>
              <button
                onClick={() => setShowIssueModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!issuedRawToken ? (
              <form onSubmit={handleIssueBadge} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700">Type de Sujet</label>
                  <select
                    value={subjectType}
                    onChange={(e) => {
                      setSubjectType(e.target.value as any);
                      setUserSearchTerm('');
                      setTargetUserId('');
                      setTargetUserName('');
                    }}
                    className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium bg-slate-50"
                  >
                    <option value="student">Élève</option>
                    <option value="staff">Employé / Enseignant</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Rechercher Utilisateur</label>
                  {targetUserId ? (
                    <div className="flex items-center justify-between p-2.5 border border-[#0066FF] bg-blue-50/50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#0066FF]" />
                        <span className="text-xs font-bold text-[#16212B]">{targetUserName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetUserId('');
                          setTargetUserName('');
                          setUserSearchTerm('');
                        }}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          value={userSearchTerm}
                          onChange={(e) => {
                            setUserSearchTerm(e.target.value);
                            setShowUserDropdown(true);
                          }}
                          onFocus={() => setShowUserDropdown(true)}
                          placeholder="Saisissez un nom pour rechercher..."
                          className="pl-9 text-xs rounded-xl h-10 border-slate-200"
                        />
                        {isSearchingUsers && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
                        )}
                      </div>

                      {showUserDropdown && userSearchTerm.trim().length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                          {userResults.length > 0 ? (
                            userResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setTargetUserId(u.id);
                                  setTargetUserName(u.fullName || u.name);
                                  setShowUserDropdown(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-xs transition-colors"
                              >
                                <div className="font-bold text-slate-800">{u.fullName || u.name}</div>
                                <div className="text-slate-500 text-[10px] truncate">{u.email || u.id}</div>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-center text-xs text-slate-500">
                              Aucun résultat trouvé
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowIssueModal(false)}
                    className="text-xs rounded-xl h-10"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={issuing || !targetUserId}
                    className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs h-10"
                  >
                    {issuing ? 'Génération...' : 'Générer & Émettre'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 text-center">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p>Badge QR Émis avec Succès !</p>
                </div>

                {/* Hidden printable area */}
                <div id="printable-badge-area" className="hidden">
                  <div className="badge-card">
                    <div className="school-name">SchoolOS Identity</div>
                    <h2 className="user-name">{targetUserName}</h2>
                    <div className="subject-type">{subjectType === 'student' ? 'Élève' : 'Staff'}</div>
                    <div className="qr-container">
                      <QRCodeSVG value={issuedRawToken} size={150} level="H" />
                    </div>
                    <div className="footer-note">Jeton unique. Ce badge est strictement personnel.</div>
                  </div>
                </div>

                {/* Preview for modal */}
                <div className="flex justify-center p-4 bg-white border border-slate-200 rounded-2xl shadow-sm mx-auto w-fit">
                  <QRCodeSVG value={issuedRawToken} size={120} level="H" />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 font-mono text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Jeton Brut (À Ne Pas Partager) :</span>
                  <p className="text-[#0066FF] font-bold break-all">{issuedRawToken}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowIssueModal(false)}
                    variant="outline"
                    className="flex-1 font-bold text-xs rounded-xl h-10 border-slate-200 text-slate-600"
                  >
                    Fermer
                  </Button>
                  <Button
                    onClick={handlePrintBadge}
                    className="flex-1 bg-[#0066FF] hover:bg-[#0052CC] font-bold text-xs rounded-xl h-10 text-white gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer Badge
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Bulk Cohort Issue */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#0066FF]" />
                  Émission Groupée de Badges QR
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Génération en lot de badges HMAC SHA-256 pour toute une cohorte ou classe.
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!bulkResults ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-700">Cohorte cible :</label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={cohortType === 'students' ? 'default' : 'outline'}
                      onClick={() => {
                        setCohortType('students');
                        loadCandidates('students');
                      }}
                      className={`h-8 text-xs rounded-xl font-bold ${
                        cohortType === 'students' ? 'bg-[#0066FF] text-white' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Élèves ({cohortType === 'students' ? candidates.length : '...'})
                    </Button>
                    <Button
                      size="sm"
                      variant={cohortType === 'staff' ? 'default' : 'outline'}
                      onClick={() => {
                        setCohortType('staff');
                        loadCandidates('staff');
                      }}
                      className={`h-8 text-xs rounded-xl font-bold ${
                        cohortType === 'staff' ? 'bg-[#0066FF] text-white' : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Personnel / Enseignants ({cohortType === 'staff' ? candidates.length : '...'})
                    </Button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-slate-700 hover:text-[#0066FF]"
                    >
                      {selectedIds.size === candidates.length && candidates.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-[#0066FF]" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Tout sélectionner ({selectedIds.size} / {candidates.length})</span>
                    </button>
                  </div>

                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {loadingCandidates ? (
                      <div className="py-8 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#0066FF] mb-1" />
                        Chargement de la cohorte...
                      </div>
                    ) : candidates.length === 0 ? (
                      <div className="py-8 text-center text-slate-400">
                        Aucun utilisateur trouvé dans cette catégorie.
                      </div>
                    ) : (
                      candidates.map((c) => {
                        const checked = selectedIds.has(c.id);
                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleSelectOne(c.id)}
                            className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {checked ? (
                                <CheckSquare className="w-4 h-4 text-[#0066FF] shrink-0" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300 shrink-0" />
                              )}
                              <div>
                                <div className="font-bold text-slate-800">{c.name}</div>
                                {c.matricule && <div className="text-[10px] text-slate-400 font-mono">{c.matricule}</div>}
                              </div>
                            </div>
                            {c.className && (
                              <Badge variant="neutral" className="text-[10px] border-slate-200 text-slate-500 font-medium">
                                {c.className}
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">
                    {selectedIds.size} badge(s) prêt(s) à être émis.
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowBulkModal(false)}
                      className="text-xs rounded-xl h-9"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      disabled={bulkIssuing || selectedIds.size === 0}
                      onClick={handleBulkIssue}
                      className="bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-2xs h-9 gap-1.5"
                    >
                      {bulkIssuing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Émettre {selectedIds.size} badge(s)
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                  <p>{bulkResults.length} Badges QR générés et signés avec succès !</p>
                  <p className="text-[11px] font-normal text-emerald-700">
                    Les anciens badges des utilisateurs sélectionnés ont été révoqués et remplacés.
                  </p>
                </div>

                {/* Hidden printable bulk sheet */}
                <div id="printable-bulk-area" className="hidden">
                  <div className="grid">
                    {bulkResults.map((item) => (
                      <div key={item.id} className="badge-card">
                        <div className="school-name">SchoolOS Identity</div>
                        <div className="user-name">{item.userName}</div>
                        <div className="badge-type">{cohortType === 'students' ? 'Élève' : 'Personnel'}</div>
                        <div className="qr-box">
                          <QRCodeSVG value={item.rawToken} size={110} level="H" />
                        </div>
                        <div className="footer-prefix">{item.displayPrefix}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview Grid */}
                <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                  {bulkResults.map((item) => (
                    <div key={item.id} className="bg-white p-2 rounded-lg border border-slate-200 text-center space-y-1">
                      <div className="text-[11px] font-bold text-slate-800 truncate">{item.userName}</div>
                      <div className="flex justify-center">
                        <QRCodeSVG value={item.rawToken} size={64} level="M" />
                      </div>
                      <div className="text-[9px] font-mono text-slate-400">{item.displayPrefix}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    onClick={() => setShowBulkModal(false)}
                    variant="outline"
                    className="flex-1 font-bold text-xs rounded-xl h-10 border-slate-200"
                  >
                    Fermer
                  </Button>
                  <Button
                    onClick={handlePrintBatch}
                    className="flex-1 bg-[#0066FF] hover:bg-[#0052CC] font-bold text-xs rounded-xl h-10 text-white gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer la Planche ({bulkResults.length})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
