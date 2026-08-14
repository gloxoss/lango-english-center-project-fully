'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, Search, Download, Check, X, Clock, CheckCircle2, XCircle, Phone, Mail, Plus, Eye, Sparkles,
} from 'lucide-react';

type ExcuseItem = {
  id: string;
  studentName: string;
  avatar: string;
  className: string;
  date: string;
  reason: string;
  documentName?: string;
  status: 'pending' | 'approved' | 'rejected';
  tutorName: string;
  tutorPhone: string;
};

const MOCK_EXCUSES: ExcuseItem[] = [
  { id: '1', studentName: 'Aya Chraibi', avatar: 'AC', className: '4COL-A', date: '02 juin 2026', reason: 'Consultation médicale & repos 48h prescrit par médecin traitant', documentName: 'certificat_medical_aya.pdf', status: 'pending', tutorName: 'Driss Chraibi', tutorPhone: '+212 6 63 11 22 33' },
  { id: '2', studentName: 'Lina Bennani', avatar: 'LB', className: '2BAC-A', date: '28 mai 2026', reason: 'Panne de transport scolaire en matinée', documentName: 'attestation_transport.pdf', status: 'approved', tutorName: 'Salma Bennani', tutorPhone: '+212 6 62 88 99 00' },
  { id: '3', studentName: 'Mehdi Chraibi', avatar: 'MC', className: '1BAC-B', date: '24 mai 2026', reason: 'Absence personnelle non motif d\'urgence', status: 'rejected', tutorName: 'Driss Chraibi', tutorPhone: '+212 6 63 11 22 33' },
];

export function AttendanceExcusesView({ locale: _locale }: { locale?: string } = {}) {
  const [excuses, setExcuses] = useState<ExcuseItem[]>(MOCK_EXCUSES);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedExcuseId, setSelectedExcuseId] = useState<string>('1');

  // Modals state
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);

  const [newExcuse, setNewExcuse] = useState({
    studentName: '',
    className: '2BAC-A',
    date: '03 juin 2026',
    reason: '',
    tutorName: 'Tuteur Légal',
    tutorPhone: '+212 6 00 00 00 00',
    documentName: 'justificatif_joint.pdf',
  });

  const pendingCount = excuses.filter(e => e.status === 'pending').length;
  const approvedCount = excuses.filter(e => e.status === 'approved').length;
  const rejectedCount = excuses.filter(e => e.status === 'rejected').length;

  const filtered = excuses.filter(ex => {
    const matchesSearch = ex.studentName.toLowerCase().includes(search.toLowerCase()) || ex.className.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || ex.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const selectedExcuse = excuses.find(e => e.id === selectedExcuseId) ?? excuses[0];

  const handleStatusChange = (id: string, newStatus: 'approved' | 'rejected') => {
    setExcuses(prev => prev.map(e => e.id === id ? { ...e, status: newStatus } : e));
  };

  const handleCreateExcuse = () => {
    if (!newExcuse.studentName.trim() || !newExcuse.reason.trim()) return;
    const created: ExcuseItem = {
      id: `ex-${Date.now()}`,
      studentName: newExcuse.studentName.trim(),
      avatar: newExcuse.studentName.split(' ').map(n => n[0]).join('').slice(0, 2),
      className: newExcuse.className,
      date: newExcuse.date,
      reason: newExcuse.reason.trim(),
      documentName: newExcuse.documentName,
      status: 'pending',
      tutorName: newExcuse.tutorName,
      tutorPhone: newExcuse.tutorPhone,
    };
    setExcuses(prev => [created, ...prev]);
    setIsSubmitOpen(false);
    setNewExcuse({ studentName: '', className: '2BAC-A', date: '03 juin 2026', reason: '', tutorName: 'Tuteur Légal', tutorPhone: '+212 6 00 00 00 00', documentName: 'justificatif_joint.pdf' });
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Justificatifs & Billet d&apos;Absence</h1>
          <p className="text-xs text-slate-500 mt-1">Examen et validation des motifs de retards et d&apos;absences déposés par les tuteurs.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsSubmitOpen(true)}
            className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Soumettre une justification</span>
          </Button>
        </div>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">En attente de validation</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCF0DC] text-[#E8A33D] flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Justificatifs approuvés</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{approvedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DDF5EC] text-[#17A673] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">Motifs refusés</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{rejectedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FCE4E2] text-[#E5544B] flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search & Tabs Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'pending', label: 'En attente' },
            { id: 'approved', label: 'Approuvées' },
            { id: 'rejected', label: 'Refusées' },
            { id: 'all', label: 'Toutes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition ${
                activeTab === tab.id ? 'bg-[#2487B8] text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Rechercher élève ou classe..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
          />
        </div>
      </div>

      {/* Main 12-col Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 cols: Excuses List with 36px Avatars */}
        <div className="lg:col-span-7 space-y-3">
          {filtered.map(ex => {
            const isSelected = selectedExcuse?.id === ex.id;
            return (
              <Card
                key={ex.id}
                onClick={() => setSelectedExcuseId(ex.id)}
                className={`p-4 bg-white rounded-2xl border transition cursor-pointer space-y-3 ${
                  isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 36px Circular Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                      {ex.avatar}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#16212B]">{ex.studentName}</h3>
                      <p className="text-[10px] text-slate-400">{ex.className} • Date d&apos;absence: {ex.date}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    ex.status === 'approved' ? 'bg-[#DDF5EC] text-[#17A673]' :
                    ex.status === 'rejected' ? 'bg-[#FCE4E2] text-[#E5544B]' : 'bg-[#FCF0DC] text-[#E8A33D]'
                  }`}>
                    {ex.status === 'approved' ? 'Approuvée' : ex.status === 'rejected' ? 'Refusée' : 'En attente'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 line-clamp-1 pl-12">{ex.reason}</p>
              </Card>
            );
          })}
        </div>

        {/* Right 5 cols: Excuse Inspector & Document Viewer */}
        <div className="lg:col-span-5 space-y-4">
          {selectedExcuse ? (
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-sm">
                  {selectedExcuse.avatar}
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#16212B]">{selectedExcuse.studentName}</h2>
                  <p className="text-xs text-slate-400">{selectedExcuse.className} • Absence du {selectedExcuse.date}</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                <p className="font-bold text-slate-700">Motif invoqué par le tuteur:</p>
                <p className="text-slate-600">{selectedExcuse.reason}</p>
                {selectedExcuse.documentName && (
                  <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-xs font-bold text-[#2487B8]">
                    <span className="flex items-center gap-1.5"><FileText className="w-4 h-4" /> {selectedExcuse.documentName}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsDocViewerOpen(true)}
                      className="h-7 text-xs text-[#2487B8] hover:bg-[#DCEBF4]/40 gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Voir la pièce
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
                <p className="font-bold text-[#16212B]">Tuteur légal déclarant:</p>
                <p className="text-slate-600">{selectedExcuse.tutorName} ({selectedExcuse.tutorPhone})</p>
              </div>

              {selectedExcuse.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleStatusChange(selectedExcuse.id, 'approved')}
                    className="flex-1 h-9 rounded-xl bg-[#17A673] hover:bg-[#12865c] text-white text-xs font-bold gap-1"
                  >
                    <Check className="w-4 h-4" /> Approuver la justification
                  </Button>
                  <Button
                    onClick={() => handleStatusChange(selectedExcuse.id, 'rejected')}
                    variant="outline"
                    className="h-9 rounded-xl text-xs font-bold border-rose-200 text-[#E5544B] hover:bg-rose-50"
                  >
                    <X className="w-4 h-4" /> Refuser
                  </Button>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-12 text-center text-xs text-slate-400 font-bold bg-white rounded-2xl border border-slate-200/80">
              Sélectionnez une demande de justification à gauche.
            </Card>
          )}
        </div>
      </div>

      {/* Soumettre une Justification Modal Dialog */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2487B8]" />
              Soumettre une Justification d&apos;Absence
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 my-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom complet de l&apos;élève *</label>
              <Input
                placeholder="Ex. Yassine Alami"
                value={newExcuse.studentName}
                onChange={e => setNewExcuse({ ...newExcuse, studentName: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Classe *</label>
                <Select value={newExcuse.className} onValueChange={val => setNewExcuse({ ...newExcuse, className: val })}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2BAC-A">2BAC-A</SelectItem>
                    <SelectItem value="1BAC-B">1BAC-B</SelectItem>
                    <SelectItem value="4COL-A">4COL-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Date d&apos;absence *</label>
                <Input
                  value={newExcuse.date}
                  onChange={e => setNewExcuse({ ...newExcuse, date: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Motif / Déclaration *</label>
              <Input
                placeholder="Ex. Consultation médicale urgente"
                value={newExcuse.reason}
                onChange={e => setNewExcuse({ ...newExcuse, reason: e.target.value })}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom du Tuteur *</label>
                <Input
                  value={newExcuse.tutorName}
                  onChange={e => setNewExcuse({ ...newExcuse, tutorName: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Téléphone Tuteur *</label>
                <Input
                  value={newExcuse.tutorPhone}
                  onChange={e => setNewExcuse({ ...newExcuse, tutorPhone: e.target.value })}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSubmitOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleCreateExcuse} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Soumettre la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Preview Viewer Dialog */}
      <Dialog open={isDocViewerOpen} onOpenChange={setIsDocViewerOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2487B8]" />
              Aperçu du justificatif joint
            </DialogTitle>
          </DialogHeader>

          {selectedExcuse && (
            <div className="space-y-4 my-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2 py-8">
                <FileText className="w-12 h-12 text-[#2487B8] mx-auto" />
                <p className="font-extrabold text-[#16212B] text-sm">{selectedExcuse.documentName}</p>
                <p className="text-slate-400 text-[10px]">Document justificatif officiel certifié par le tuteur ({selectedExcuse.tutorName})</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDocViewerOpen(false)} className="w-full rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Fermer l&apos;aperçu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
