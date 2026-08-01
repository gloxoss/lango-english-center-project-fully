'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  UserPlus, Key, Send, Search,
  AlertCircle, Plus,
} from 'lucide-react';

type ApiResetRequest = {
  id: string;
  studentName: string;
  className: string;
  guardianName: string;
  phone: string;
  status: 'Code généré' | 'SMS envoyé';
  requestedAt: string;
};

type StudentOption = { id: string; fullName: string; matricule: string };

// ponytail: "code" is a real temp password for the guardian's parent-portal
// account (created on first use), shown once client-side after generation -
// never persisted in plaintext server-side, so it can't be re-displayed
// after a page refresh (matches how the super-admin school-creation temp
// password already behaves).
export function AccessResetView() {
  const [requests, setRequests] = useState<ApiResetRequest[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('Tous');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [displayedCodes, setDisplayedCodes] = useState<Record<string, string>>({});

  const [isNewResetOpen, setIsNewResetOpen] = useState(false);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);

  async function loadRequests() {
    try {
      const res = await fetch('/api/settings/access-reset');
      const json = await res.json();
      if (json.success) {
        setRequests(json.data);
      }
    } catch (err) {
      console.error('Failed loading access-reset requests', err);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    const term = studentQuery.trim();
    if (term.length < 2) {
      setStudentResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/students?search=${encodeURIComponent(term)}&pageSize=5`);
        const json = await res.json();
        if (json.success) {
          setStudentResults(json.data.map((s: any) => ({ id: s.id, fullName: s.fullName, matricule: s.matricule })));
        }
      } catch (err) {
        console.error('Student search failed', err);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [studentQuery]);

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || r.guardianName.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Tous' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const sel = selectedIdx !== null && filteredRequests[selectedIdx] ? filteredRequests[selectedIdx] : null;

  async function handleGenerateForStudent(studentId: string) {
    setError(null);
    try {
      const res = await fetch('/api/settings/access-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de la génération du code.');
        return;
      }
      setDisplayedCodes(prev => ({ ...prev, [json.data.id]: json.code }));
      await loadRequests();
      setIsNewResetOpen(false);
      setSelectedStudent(null);
      setStudentQuery('');
    } catch (err) {
      console.error('Access-reset generation failed', err);
      setError('Connexion impossible. Vérifiez votre réseau.');
    }
  }

  async function handleSendSms(requestId: string) {
    const code = displayedCodes[requestId];
    if (!code) {
      setError('Le code n\'est visible que juste après sa génération.');
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/settings/access-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action: 'send_sms', code }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || 'Échec de l\'envoi.');
        return;
      }
      await loadRequests();
    } catch (err) {
      console.error('Send SMS failed', err);
      setError('Connexion impossible.');
    }
  }

  const getStatusBadge = (status: ApiResetRequest['status']) => {
    switch (status) {
      case 'Code généré':
        return <Badge className="bg-[#DCEBF4] text-[#1B6C93] text-[10px] px-2 py-0.5 border-none">🔑 Code généré</Badge>;
      case 'SMS envoyé':
        return <Badge className="bg-[#D1F5E8] text-[#17A673] text-[10px] px-2 py-0.5 border-none">✈️ SMS envoyé</Badge>;
    }
  };

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Réinitialisation des accès</h1>
            <p className="text-xs text-slate-500 mt-1">Générez un mot de passe temporaire pour le portail parent d&apos;un élève.</p>
          </div>
          <Button
            onClick={() => setIsNewResetOpen(true)}
            className="gap-2 h-10 rounded-full px-4 text-xs font-bold bg-[#0066FF] text-white hover:bg-[#0052CC]"
          >
            <Plus className="w-4 h-4" /> Nouveau reset
          </Button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">Demandes totales</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{requests.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
          </Card>
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">Codes générés</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{requests.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
          </Card>
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">SMS envoyés (simulé)</p>
              <p className="text-2xl font-extrabold text-[#16212B]">{requests.filter(r => r.status === 'SMS envoyé').length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#D1F5E8] text-[#17A673] flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
          </Card>
        </div>

        <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 p-5 space-y-4">
          <h2 className="text-sm font-extrabold text-[#16212B]">Demandes de réinitialisation</h2>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[240px] flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher un élève, parent ou téléphone..."
                className="pl-10 h-9 text-xs bg-slate-50 border-slate-200 rounded-full"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full text-xs">
              {['Tous', 'Code généré', 'SMS envoyé'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-full font-bold text-[11px] transition-colors ${filterStatus === status ? 'bg-white text-[#16212B] shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <Table>
              <TableHeader className="bg-[#F6F9FC] text-slate-500 font-semibold text-xs">
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Parent / Tuteur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Demandé le</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs font-medium divide-y divide-slate-100">
                {filteredRequests.map((r, i) => (
                  <TableRow
                    key={r.id}
                    onClick={() => setSelectedIdx(i)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${selectedIdx === i ? 'bg-blue-50/60' : ''}`}
                  >
                    <TableCell className="font-bold text-[#16212B]">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-[10px] font-bold bg-slate-200 text-slate-700">
                            {r.studentName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span>{r.studentName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-700">{r.guardianName}</TableCell>
                    <TableCell className="text-slate-600 font-mono">{r.phone}</TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className="text-slate-500">{r.requestedAt}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {r.status === 'Code généré' && displayedCodes[r.id] && (
                          <button
                            onClick={() => handleSendSms(r.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100"
                          >
                            Envoyer SMS
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredRequests.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-400">Aucune demande.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {sel && (
        <div className="w-[320px] shrink-0 space-y-4 hidden xl:block">
          <Card className="p-5 bg-white rounded-2xl shadow-2xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#16212B]">Détail de la demande</h3>
              {getStatusBadge(sel.status)}
            </div>

            <div>
              <p className="font-extrabold text-[#16212B] text-base">{sel.studentName}</p>
              <p className="text-xs text-slate-500">Parent: {sel.guardianName}</p>
            </div>

            {displayedCodes[sel.id] && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Mot de passe temporaire</p>
                <p className="text-xl font-extrabold font-mono text-[#0066FF] tracking-widest my-1 break-all">{displayedCodes[sel.id]}</p>
                <p className="text-[10px] text-slate-400">Communiquez-le une seule fois - il ne sera plus affiché après.</p>
              </div>
            )}

            <div className="space-y-2 text-xs border-t pt-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Téléphone Tuteur</span>
                <span className="font-mono font-bold text-[#16212B]">{sel.phone || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Demandé le</span>
                <span className="text-slate-700">{sel.requestedAt}</span>
              </div>
            </div>

            {sel.status === 'Code généré' && displayedCodes[sel.id] && (
              <Button
                onClick={() => handleSendSms(sel.id)}
                className="w-full text-xs font-bold h-9 rounded-xl bg-[#0066FF] text-white hover:bg-[#0052CC]"
              >
                Envoyer par SMS
              </Button>
            )}
          </Card>
        </div>
      )}

      <Dialog open={isNewResetOpen} onOpenChange={(open) => { setIsNewResetOpen(open); if (!open) { setSelectedStudent(null); setStudentQuery(''); } }}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">Nouveau reset d&apos;accès</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Élève *</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between h-9 px-3 rounded-xl border border-slate-200 bg-slate-50">
                  <span className="font-bold text-[#16212B]">{selectedStudent.fullName}</span>
                  <button type="button" onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-rose-600 text-[10px] font-bold">Changer</button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={studentQuery}
                    onChange={e => setStudentQuery(e.target.value)}
                    placeholder="Rechercher un élève par nom ou matricule..."
                    className="h-9 text-xs rounded-xl"
                  />
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {studentResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSelectedStudent(s); setStudentResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[11px]"
                        >
                          <p className="font-bold text-[#16212B]">{s.fullName}</p>
                          <p className="text-slate-400 font-mono">{s.matricule}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400">Le mot de passe temporaire du portail parent de cet élève sera régénéré (ou son compte créé s&apos;il n&apos;en a pas encore).</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewResetOpen(false)} className="rounded-full text-xs h-9">Annuler</Button>
            <Button
              variant="primary"
              disabled={!selectedStudent}
              onClick={() => selectedStudent && handleGenerateForStudent(selectedStudent.id)}
              className="rounded-full text-xs h-9 bg-[#0066FF] text-white"
            >
              Générer le code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
