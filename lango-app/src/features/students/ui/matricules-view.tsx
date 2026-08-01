'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wand2, Search, AlertCircle } from 'lucide-react';

type ApiStudent = { id: string; fullName: string; className: string | null; matricule: string | null };

export function MatriculesView() {
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [nextMatricule, setNextMatricule] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/students?pageSize=200')
      .then(res => res.json())
      .then((json) => { if (json.success) setStudents(json.data); })
      .catch(err => console.error('Failed loading students', err))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerateNext() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/students/matricules');
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la génération du matricule.');
        return;
      }
      setNextMatricule(json.matricule);
    } catch (err) {
      console.error('Matricule generation failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setGenerating(false);
    }
  }

  const filtered = students.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    return !term || s.fullName.toLowerCase().includes(term) || (s.matricule ?? '').toLowerCase().includes(term);
  });
  const missingCount = students.filter(s => !s.matricule).length;

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Matricules des élèves</h1>
          <p className="text-xs text-slate-500 mt-1">Consultez les matricules attribués et générez le prochain identifiant</p>
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
              className="pl-10 h-10 text-xs bg-slate-50 border-none rounded-full"
            />
          </div>
          {missingCount > 0 && (
            <Badge className="bg-[#FCF0DC] text-[#E8A33D] text-[10px] px-2.5 py-1">{missingCount} sans matricule</Badge>
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
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">{s.fullName.split(' ').map(n => n[0]).join('')}</div>
                        <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{s.className ?? '—'}</td>
                    <td className="py-3.5 px-4">
                      {s.matricule
                        ? <span className="font-mono text-slate-700">{s.matricule}</span>
                        : <Badge className="bg-[#FCF0DC] text-[#E8A33D] text-[10px] px-2 py-0.5">Manquant</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Right Panel */}
      <div className="w-[300px] shrink-0 space-y-4 hidden xl:block">
        <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-3">
          <h3 className="text-sm font-extrabold text-[#16212B]">Générer le prochain matricule</h3>
          <p className="text-[11px] text-slate-500">Réserve le prochain numéro de la série d&apos;identifiants (format STD-{new Date().getFullYear()}-####). Les matricules sont attribués automatiquement à l&apos;inscription d&apos;un élève.</p>
          {nextMatricule && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Réservé</p>
              <p className="text-lg font-extrabold font-mono text-[#2487B8]">{nextMatricule}</p>
            </div>
          )}
          <Button variant="primary" size="sm" className="w-full gap-2 h-10 rounded-full text-xs" disabled={generating} onClick={handleGenerateNext}>
            <Wand2 className="w-4 h-4" />
            <span>{generating ? 'Génération...' : 'Réserver le prochain'}</span>
          </Button>
        </Card>
      </div>
    </div>
  );
}
