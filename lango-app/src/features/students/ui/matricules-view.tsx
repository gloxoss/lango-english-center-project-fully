'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wand2, Search, AlertCircle, Users, CheckCircle2, Hash } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';

type ApiStudent = { id: string; fullName: string; className: string | null; matricule: string | null };

export function MatriculesView() {
  const { role } = usePermissions();
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nextMatricule, setNextMatricule] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/students?page=${page}&pageSize=${pageSize}`)
      .then(res => res.json())
      .then((json) => { if (json.success) { setStudents(json.data); setTotal(json.total ?? 0); } })
      .catch(err => console.error('Failed loading students', err))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  // Non-mutating preview on load - shows the next number without burning it.
  useEffect(() => {
    fetch('/api/students/matricules')
      .then(res => res.json())
      .then((json) => { if (json.success) setNextMatricule(json.matricule); })
      .catch(() => {});
  }, []);

  async function handleReserveNext() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/students/matricules', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la réservation du matricule.');
        return;
      }
      setNextMatricule(json.matricule);
      setReserved(true);
    } catch (err) {
      console.error('Matricule reservation failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setGenerating(false);
    }
  }

  const filtered = students.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    return !term || s.fullName.toLowerCase().includes(term) || (s.matricule ?? '').toLowerCase().includes(term);
  });

  const assignedCount = students.filter(s => s.matricule).length;
  const missingCount = students.length - assignedCount;

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Matricules des élèves</h1>
          <p className="text-xs text-slate-500 mt-1">Consultez les matricules attribués et générez le prochain identifiant</p>
        </div>

        {/* 3 Top Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Total élèves</p>
              <p className="text-xl font-extrabold text-[#16212B]">{students.length}</p>
              <p className="text-[10px] font-semibold text-[#17A673]">Inscrits dans le système</p>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Matricules attribués</p>
              <p className="text-xl font-extrabold text-[#16212B]">{assignedCount}</p>
              <p className="text-[10px] font-semibold text-[#17A673]">Identifiants valides</p>
            </div>
          </Card>

          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">Matricules manquants</p>
              <p className="text-xl font-extrabold text-[#16212B]">{missingCount}</p>
              <p className="text-[10px] font-semibold text-amber-700">À attribuer</p>
            </div>
          </Card>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-3 rounded-2xl shadow-2xs border border-slate-200/80 flex items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher par nom ou matricule..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-xl"
            />
          </div>
          {missingCount > 0 && (
            <Badge className="bg-[#FCF0DC] text-[#E8A33D] text-[10px] px-2.5 py-1 font-bold border-none">{missingCount} sans matricule</Badge>
          )}
        </div>

        {/* Table */}
        <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4">Nom élève</th>
                  <th className="py-3 px-4">Classe</th>
                  <th className="py-3 px-4">Matricule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={3} className="py-8 px-4 text-center text-slate-400">Aucun élève trouvé.</td></tr>
                )}
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center text-[10px] font-bold">
                          {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-bold">{s.className ?? '—'}</td>
                    <td className="py-3.5 px-4">
                      {s.matricule
                        ? <span className="font-mono text-[#2487B8] font-bold">{s.matricule}</span>
                        : <Badge className="bg-[#FCF0DC] text-[#E8A33D] text-[10px] px-2 py-0.5 font-bold border-none">Manquant</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Afficher</span>
                <select
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-[#16212B]"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>sur {total} élève{total > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Précédent
                </button>
                <span>Page {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 rounded-lg border border-slate-200 font-bold text-[#16212B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Panel - reserving a matricule is school_admin-only server-side */}
      {role === 'school_admin' && (
        <div className="w-[300px] shrink-0 space-y-4 hidden xl:block sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-3">
            <h3 className="text-sm font-extrabold text-[#16212B]">Générer le prochain matricule</h3>
            <p className="text-[11px] text-slate-500">Aperçu du prochain numéro de la série (format STD-{new Date().getFullYear()}-####). Réservez-le uniquement lorsque vous êtes prêt — l&apos;aperçu ne consomme aucun numéro.</p>
            {nextMatricule && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{reserved ? 'Réservé' : 'Aperçu'}</p>
                <p className="text-lg font-extrabold font-mono text-[#2487B8]">{nextMatricule}</p>
              </div>
            )}
            <Button className="w-full gap-2 h-10 rounded-xl text-xs bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold" disabled={generating} onClick={handleReserveNext}>
              <Wand2 className="w-4 h-4" />
              <span>{generating ? 'Réservation...' : 'Réserver ce matricule'}</span>
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}

