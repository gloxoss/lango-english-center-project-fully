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

export function BadgeManagementView() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Issue Badge State
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
        setBadges(badges.map(b => b.id === badgeId ? { ...b, status: 'revoked' } : b));
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
            .school-name { font-size: 0.875rem; font-weight: 700; color: #2487B8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
            .user-name { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0; }
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Gestion des Badging QR Sécurisés
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Émission de jetons QR aléatoires 128-bit cryptographiés par HMAC SHA-256 (sans PII lisible).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              setIssuedRawToken(null);
              setTargetUserId('');
              setTargetUserName('');
              setUserSearchTerm('');
              setShowIssueModal(true);
            }}
            size="sm"
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl shadow-2xs gap-2 h-10 px-4 cursor-pointer"
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

          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
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
                  <td className="py-3.5 px-4 font-mono font-bold text-[#2487B8]">{b.displayPrefix}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant={b.subjectType === 'staff' ? 'warning' : 'info'} className="text-[10px] uppercase font-bold">
                      {b.subjectType}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{b.userId}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant={b.status === 'active' ? 'success' : 'danger'} className="text-[10px] font-bold">
                      {b.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{new Date(b.issuedAt).toLocaleDateString('fr-FR')}</td>
                  <td className="py-3.5 px-4">
                    {b.expiresAt ? (
                      <span className={`text-[11px] font-bold ${new Date(b.expiresAt) < new Date() ? 'text-rose-600' : 'text-slate-500'}`}>
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
                          className="text-[#2487B8] hover:text-[#1B6C93] hover:bg-[#DCEBF4] h-8 px-2 text-xs font-bold"
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

      {/* Modal: Issue Badge */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-[#16212B]">Émettre un Badge QR</h2>
              <button onClick={() => setShowIssueModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
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
                    <div className="flex items-center justify-between p-2.5 border border-[#2487B8] bg-[#F0F8FC] rounded-xl">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-[#2487B8]" />
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
                  <Button type="button" variant="ghost" onClick={() => setShowIssueModal(false)} className="text-xs rounded-xl h-10">
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={issuing || !targetUserId}
                    className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs h-10"
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
                  <p className="text-[#2487B8] font-bold break-all">{issuedRawToken}</p>
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
                    className="flex-1 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs h-10 gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimer le Badge</span>
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
