'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText, CheckCircle2, Download, ArrowLeft, Send, Maximize2,
} from 'lucide-react';
import Link from 'next/link';
import { SubmissionItem, MOCK_SUBMISSIONS } from '../data/homework-submission-config';

export function HomeworkSubmissionClient({ locale }: { locale?: string } = {}) {
  const [submissions, setSubmissions] = useState<SubmissionItem[]>(MOCK_SUBMISSIONS);
  const [selectedSubId, setSelectedSubId] = useState<string>('1');
  const [inputScore, setInputScore] = useState<number | string>(MOCK_SUBMISSIONS[0]?.score ?? '');
  const [inputFeedback, setInputFeedback] = useState(MOCK_SUBMISSIONS[0]?.feedback ?? '');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const selectedSub = submissions.find(s => s.id === selectedSubId) ?? submissions[0];

  const handleSelectSub = (sub: SubmissionItem) => {
    setSelectedSubId(sub.id);
    setInputScore(sub.score ?? '');
    setInputFeedback(sub.feedback ?? '');
    setSavedSuccess(false);
  };

  const handleSaveGrade = () => {
    if (!selectedSub) return;
    const numScore = Number(inputScore);
    setSubmissions(prev => prev.map(s => s.id === selectedSub.id ? {
      ...s,
      score: isNaN(numScore) ? undefined : numScore,
      feedback: inputFeedback,
      status: 'Graded',
    } : s));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleRequestRevision = () => {
    if (!selectedSub) return;
    setSubmissions(prev => prev.map(s => s.id === selectedSub.id ? {
      ...s,
      status: 'Needs Revision',
      feedback: inputFeedback || 'Révision demandée par l\'enseignant.',
    } : s));
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Évaluation des Soumissions & Correction Digitalisée</h1>
          <p className="text-xs text-slate-500 mt-1">DM n°4 : Problème d&apos;analyse & logarithmes • 2BAC-A (Mathématiques)</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale || 'fr'}/dashboard/homework`}>
            <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Retour aux devoirs</span>
            </Button>
          </Link>
          <Button size="sm" className="h-10 rounded-xl px-4 gap-2 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs">
            <Send className="w-4 h-4" />
            <span>Publier toutes les notes</span>
          </Button>
        </div>
      </div>

      {/* Saved Success Notification Banner */}
      {savedSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Note et appréciation enregistrées avec succès pour {selectedSub?.studentName}.</span>
        </div>
      )}

      {/* Main 12-col Correction Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5-col Submissions Inbox with 36px Circular Avatars */}
        <div className="lg:col-span-5 space-y-3">
          <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs font-extrabold text-xs text-[#16212B] flex justify-between items-center">
            <span>Copies reçues ({submissions.length})</span>
            <span className="text-[10px] text-slate-400 font-normal">Série 2BAC-A</span>
          </Card>

          {submissions.map(sub => {
            const isSelected = selectedSub?.id === sub.id;
            return (
              <Card
                key={sub.id}
                onClick={() => handleSelectSub(sub)}
                className={`p-4 bg-white rounded-2xl border transition cursor-pointer space-y-2 ${
                  isSelected ? 'border-[#2487B8] bg-[#DCEBF4]/20 shadow-xs' : 'border-slate-200/80 hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* 36px Circular Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] border-2 border-white shadow-2xs flex items-center justify-center font-extrabold text-xs shrink-0">
                      {sub.avatar}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#16212B]">{sub.studentName}</h3>
                      <p className="text-[10px] text-slate-400">{sub.matricule} • Remis le {sub.submittedAt}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    sub.status === 'Graded' ? 'bg-[#DDF5EC] text-[#17A673]' :
                    sub.status === 'Needs Revision' ? 'bg-[#FCF0DC] text-[#E8A33D]' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {sub.status === 'Graded' ? `${sub.score}/${sub.maxScore}` : sub.status === 'Needs Revision' ? 'À réviser' : 'En attente'}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Right 7-col Digital Annotation & Scoring Panel */}
        <div className="lg:col-span-7 space-y-4">
          {selectedSub ? (
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center font-extrabold text-sm shrink-0">
                    {selectedSub.avatar}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#16212B]">Copie de {selectedSub.studentName}</h2>
                    <p className="text-xs text-slate-400">Fichier: {selectedSub.fileName} ({selectedSub.fileSize})</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsPdfModalOpen(true)}
                    className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1.5"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[#2487B8]" />
                    <span>Plein écran</span>
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl border-slate-200 gap-1.5">
                    <Download className="w-3.5 h-3.5 text-slate-600" />
                    <span>Télécharger</span>
                  </Button>
                </div>
              </div>

              {/* Digital Canvas / PDF Visualizer Placeholder */}
              <div
                onClick={() => setIsPdfModalOpen(true)}
                className="bg-slate-900 rounded-2xl h-64 flex flex-col items-center justify-center text-white/80 space-y-2 border border-slate-800 cursor-pointer hover:bg-slate-850 transition relative group"
              >
                <FileText className="w-10 h-10 text-[#2487B8] group-hover:scale-110 transition-transform" />
                <p className="text-xs font-bold">Visualiseur de copie numérique interactif</p>
                <p className="text-[10px] text-slate-400">Cliquez pour ouvrir l&apos;aperçu haute définition avec annotations stylet.</p>
              </div>

              {/* Scoring and Evaluation Form */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Note attribuée (/20)</label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="Ex: 18.5"
                      value={inputScore}
                      onChange={e => setInputScore(e.target.value)}
                      className="h-10 text-sm font-extrabold rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Appréciation globale</label>
                    <Input
                      placeholder="Ex: Très bon travail, soin apporté à la rédaction..."
                      value={inputFeedback}
                      onChange={e => setInputFeedback(e.target.value)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    onClick={handleRequestRevision}
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold border-amber-200 text-amber-900 bg-amber-50 hover:bg-amber-100"
                  >
                    Demander une révision
                  </Button>
                  <Button
                    onClick={handleSaveGrade}
                    size="sm"
                    className="h-9 rounded-xl px-5 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold shadow-2xs"
                  >
                    Enregistrer la note
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-xs text-slate-400 font-bold bg-white rounded-2xl border border-slate-200/80">
              Sélectionnez une copie d&apos;élève dans la liste à gauche.
            </Card>
          )}
        </div>
      </div>

      {/* PDF Fullscreen Annotation Preview Dialog */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="max-w-4xl bg-slate-900 text-white rounded-2xl p-6 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2487B8]" />
                Correction & Annotation PDF : {selectedSub?.fileName}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedSub && (
            <div className="space-y-4 my-4">
              <div className="bg-slate-950 rounded-2xl h-[450px] border border-slate-800 flex flex-col items-center justify-center space-y-3 p-6 text-center">
                <FileText className="w-16 h-16 text-[#2487B8]" />
                <div>
                  <p className="text-sm font-extrabold">{selectedSub.fileName}</p>
                  <p className="text-xs text-slate-400">Élève: {selectedSub.studentName} ({selectedSub.matricule})</p>
                </div>
                <p className="text-xs text-slate-300 max-w-md">
                  Visualisation PDF temps réel active. Les annotations annotées au stylet seront directement visibles par l&apos;élève.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsPdfModalOpen(false)} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold px-6">
              Fermer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
