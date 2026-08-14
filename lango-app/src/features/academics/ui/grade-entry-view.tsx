'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Flag, BookOpen, ArrowLeft, ArrowRight,
  MessageCircle, Save, Wifi, Monitor,
} from 'lucide-react';

type QuestionStatus = 'answered' | 'flagged' | 'unanswered';
type Question = {
  id: number;
  status: QuestionStatus;
  title: string;
  theme: string;
  points: number;
  type: string;
  content: string;
  choices: { label: string; text: string }[];
  formula?: string;
  attachment?: string;
};

const QUESTIONS: Question[] = [
  { id: 1, status: 'answered', title: 'Question 1', theme: 'Algèbre', points: 4, type: 'QCM', content: 'Simplifiez l\'expression 2x + 3x − 5.', choices: [{ label: 'A', text: '5x − 5' }, { label: 'B', text: '5x + 5' }, { label: 'C', text: '6x − 5' }, { label: 'D', text: '5x' }] },
  { id: 2, status: 'answered', title: 'Question 2', theme: 'Algèbre', points: 4, type: 'QCM', content: 'Résolvez 3x + 6 = 0.', choices: [{ label: 'A', text: 'x = −2' }, { label: 'B', text: 'x = 2' }, { label: 'C', text: 'x = 6' }, { label: 'D', text: 'x = −6' }] },
  { id: 3, status: 'answered', title: 'Question 3', theme: 'Algèbre', points: 4, type: 'QCM', content: 'Factoriser x² − 9.', choices: [{ label: 'A', text: '(x−3)²' }, { label: 'B', text: '(x+3)(x−3)' }, { label: 'C', text: '(x+9)(x−9)' }, { label: 'D', text: 'x(x−9)' }] },
  { id: 4, status: 'answered', title: 'Question 4', theme: 'Algèbre', points: 4, type: 'QCM', content: 'Calculer (2x + 1)(x − 3) pour x = 2.', choices: [{ label: 'A', text: '−5' }, { label: 'B', text: '0' }, { label: 'C', text: '5' }, { label: 'D', text: '−2' }] },
  { id: 5, status: 'answered', title: 'Question 5', theme: 'Fonctions', points: 4, type: 'QCM', content: 'f(x) = 2x² − 3. f(2) = ?', choices: [{ label: 'A', text: '1' }, { label: 'B', text: '5' }, { label: 'C', text: '11' }, { label: 'D', text: '−3' }] },
  { id: 6, status: 'answered', title: 'Question 6', theme: 'Fonctions', points: 4, type: 'QCM', content: 'Laquelle est une fonction affine ?', choices: [{ label: 'A', text: 'f(x) = x²' }, { label: 'B', text: 'f(x) = 3x − 1' }, { label: 'C', text: 'f(x) = 1/x' }, { label: 'D', text: 'f(x) = √x' }] },
  { id: 7, status: 'answered', title: 'Question 7', theme: 'Fonctions', points: 4, type: 'QCM', content: 'Quel est le sens de variation de f(x) = −2x + 1 ?', choices: [{ label: 'A', text: 'Croissante' }, { label: 'B', text: 'Décroissante' }, { label: 'C', text: 'Constante' }, { label: 'D', text: 'Non définie' }] },
  {
    id: 8, status: 'answered', title: 'Question 8', theme: 'Équations', points: 4, type: 'Question à choix multiple',
    content: 'Résoudre dans ℝ l\'équation suivante :',
    formula: '2x² − 5x − 3 = 0',
    choices: [
      { label: 'A', text: 'S = {−1/2}' },
      { label: 'B', text: 'S = {3/2}' },
      { label: 'C', text: 'S = {−1/2 ; 3}' },
      { label: 'D', text: 'S = {−3 ; 1/2}' },
    ],
    attachment: 'Formulaire_équations_2nd_degré.pdf · 1,2 Mo',
  },
  { id: 9, status: 'flagged', title: 'Question 9', theme: 'Équations', points: 4, type: 'QCM', content: 'Système : 2x + y = 5, x − y = 1. Solution ?', choices: [{ label: 'A', text: '(2;1)' }, { label: 'B', text: '(3;−1)' }, { label: 'C', text: '(2;0)' }, { label: 'D', text: '(1;3)' }] },
  { id: 10, status: 'unanswered', title: 'Question 10', theme: 'Équations', points: 4, type: 'QCM', content: 'Discriminant de 3x² + 6x + 3 = 0 ?', choices: [{ label: 'A', text: '0' }, { label: 'B', text: '18' }, { label: 'C', text: '36' }, { label: 'D', text: '−36' }] },
];

function pad(n: number) { return String(n).padStart(2, '0'); }

export function GradeEntryView() {
  const [currentQ, setCurrentQ] = useState(7); // 0-indexed → question 8
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({ 0: 'A', 1: 'A', 2: 'B', 3: 'C', 4: 'B', 5: 'B', 6: 'B', 7: 'C' });
  const [flagged, setFlagged] = useState<Set<number>>(new Set([8]));
  const [timeLeft, setTimeLeft] = useState(83 * 60 + 47);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;

  const question = QUESTIONS[currentQ]!;
  const answeredCount = Object.keys(selectedAnswers).length;
  const flaggedCount = flagged.size;
  const totalQ = QUESTIONS.length;
  const progress = Math.round((answeredCount / totalQ) * 100);

  function getQStatus(i: number): QuestionStatus {
    if (flagged.has(i)) return 'flagged';
    if (selectedAnswers[i]) return 'answered';
    return 'unanswered';
  }

  function getBadgeStyle(status: QuestionStatus) {
    if (status === 'answered') return 'bg-[#17A673] text-white border border-[#17A673]';
    if (status === 'flagged') return 'bg-amber-400 text-white border border-amber-400';
    return 'bg-white text-[#16212B] border border-slate-300';
  }

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <Button variant="outline" size="sm" className="h-8 text-xs rounded-xl border-slate-200 gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Quitter l&apos;examen
        </Button>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">Classe : 1BAC-G</Badge>
          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">Professeur : Omar Tazi</Badge>
          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">Durée : 90 min</Badge>
          <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] font-bold">Date : Mardi 20 mai 2026</Badge>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#2487B8]" />Temps restant</p>
            <p className="text-lg font-extrabold text-[#16212B] font-mono tabular-nums">{pad(h)} : {pad(m)} : {pad(s)}</p>
          </div>
          <div className="text-center text-[10px]">
            <div className="flex items-center gap-1 text-[#17A673]"><CheckCircle2 className="w-3 h-3" /><span className="font-bold">Enregistré automatiquement</span></div>
            <p className="text-slate-400">Il y a 18 secondes</p>
          </div>
          <Button size="sm" className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5">
            <Save className="w-3.5 h-3.5" />
            Soumettre l&apos;examen
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* LEFT sidebar — Progress */}
        <div className="w-[200px] shrink-0 bg-white border-r border-slate-200 p-4 overflow-y-auto flex flex-col gap-4">
          <div>
            <p className="text-[10px] font-extrabold text-[#16212B]">Progression</p>
            <div className="flex items-center justify-between">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden mr-2 mt-1">
                <div className="h-full bg-[#2487B8] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-extrabold text-[#2487B8]">{progress}%</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{answeredCount} / {totalQ} questions répondues</p>
          </div>

          <div className="space-y-1 text-[11px]">
            {[
              { icon: <div className="w-2.5 h-2.5 rounded-full bg-[#17A673]" />, label: 'Répondues', count: answeredCount },
              { icon: <Flag className="w-2.5 h-2.5 text-amber-500" />, label: 'Marquées', count: flaggedCount },
              { icon: <div className="w-2.5 h-2.5 rounded-full border-2 border-slate-400" />, label: 'Non répondues', count: totalQ - answeredCount },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2">
                {row.icon}
                <span className="text-slate-600 flex-1">{row.label}</span>
                <span className="font-bold text-[#16212B]">{row.count}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-extrabold text-[#16212B] mb-2">Questions ({totalQ})</p>
            <div className="grid grid-cols-5 gap-1">
              {QUESTIONS.map((q, i) => {
                const status = getQStatus(i);
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQ(i)}
                    className={`w-8 h-8 rounded-lg text-[10px] font-bold border transition-all relative ${currentQ === i ? 'ring-2 ring-[#2487B8]' : ''} ${getBadgeStyle(status)}`}
                  >
                    {q.id}
                    {status === 'flagged' && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full text-[7px] text-white flex items-center justify-center">!</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="mt-auto text-[11px] font-bold text-[#2487B8] hover:text-[#1B6C93] flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Aller à une question
          </button>
        </div>

        {/* MAIN — Question */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-[760px] mx-auto space-y-5">
            {/* Question header */}
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#16212B]">
                Question {question.id} — {question.theme}
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none font-bold text-xs">{question.points} points</Badge>
                <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-xs">{question.type}</Badge>
                <button
                  onClick={() => setFlagged(prev => {
                    const n = new Set(prev);
                    if (n.has(currentQ)) n.delete(currentQ); else n.add(currentQ);
                    return n;
                  })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${flagged.has(currentQ) ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  Marquer cette question
                </button>
              </div>
            </div>

            {/* Question body */}
            <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-5">
              <p className="text-sm font-semibold text-[#16212B]">{question.content}</p>

              {question.formula && (
                <div className="py-4 text-center text-xl font-mono font-bold text-[#16212B] bg-slate-50 rounded-xl border border-slate-200">
                  {question.formula}
                </div>
              )}

              <p className="text-sm text-slate-600 font-semibold">Sélectionnez la bonne réponse.</p>

              <div className="space-y-3">
                {question.choices.map(choice => (
                  <label
                    key={choice.label}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${selectedAnswers[currentQ] === choice.label ? 'border-[#2487B8] bg-[#DCEBF4]/30' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    onClick={() => setSelectedAnswers(prev => ({ ...prev, [currentQ]: choice.label }))}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedAnswers[currentQ] === choice.label ? 'border-[#2487B8] bg-[#2487B8]' : 'border-slate-300'}`}>
                      {selectedAnswers[currentQ] === choice.label && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="font-bold text-[#16212B] text-sm">{choice.label}.</span>
                    <span className="text-sm text-slate-700">{choice.text}</span>
                  </label>
                ))}
              </div>

              {/* Formula hint */}
              <div className="p-3 bg-[#DCEBF4]/30 rounded-xl border border-[#2487B8]/20">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#1B6C93] shrink-0" />
                  <p className="text-[11px] font-bold text-[#1B6C93]">Formules utiles</p>
                  <span className="text-[11px] text-slate-600">Pour une équation ax² + bx + c = 0 (a ≠ 0) : Δ = b² − 4ac et x = (−b ± √Δ) / 2a</span>
                  <button className="ml-auto text-[10px] font-bold text-[#2487B8] whitespace-nowrap">Voir plus ↓</button>
                </div>
              </div>

              {/* Attachment */}
              {question.attachment && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-2">Pièce jointe (optionnelle)</p>
                  <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-xl border border-rose-200">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">📄</div>
                    <div>
                      <p className="text-xs font-bold text-[#16212B]">{question.attachment.split('·')[0]}</p>
                      <p className="text-[10px] text-slate-400">PDF · {question.attachment.split('·')[1]}</p>
                    </div>
                    <button className="ml-auto p-1.5 rounded-lg hover:bg-rose-100 text-rose-600">↓</button>
                  </div>
                </div>
              )}
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="h-9 text-xs rounded-xl border-slate-200 gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Question précédente
              </Button>
              <span className="text-[11px] text-slate-500 font-semibold">
                {currentQ + 1} / {totalQ}
              </span>
              <Button
                onClick={() => setCurrentQ(Math.min(totalQ - 1, currentQ + 1))}
                disabled={currentQ === totalQ - 1}
                className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5"
              >
                Question suivante
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Bottom integrity bar */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span>🛡️</span>
                <span><strong>Règles d&apos;intégrité</strong> — Naviguez uniquement dans cette fenêtre. Toute activité suspecte sera signalée.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>🔄</span>
                <span><strong>Sauvegarde automatique</strong> — Vos réponses sont enregistrées toutes les 30 secondes.</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#17A673]" />
                <strong>Dernière sauvegarde : 09:36:12</strong>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT sidebar — Exam summary */}
        <div className="w-[280px] shrink-0 bg-white border-l border-slate-200 p-4 overflow-y-auto space-y-4">
          <h3 className="text-xs font-extrabold text-[#16212B]">Résumé de l&apos;examen</h3>
          {[
            { icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#2487B8]" />, label: 'Temps restant', value: `${pad(h)} : ${pad(m)} : ${pad(s)}` },
            { icon: <div className="w-3.5 h-3.5 rounded-full bg-[#17A673]" />, label: 'Questions répondues', value: `${answeredCount} / ${totalQ}` },
            { icon: <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />, label: 'Questions non répondues', value: String(totalQ - answeredCount) },
            { icon: <Flag className="w-3.5 h-3.5 text-amber-500" />, label: 'Questions marquées', value: String(flaggedCount) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                {row.icon}
                <span className="text-slate-600 font-semibold">{row.label}</span>
              </div>
              <span className="font-extrabold text-[#16212B] font-mono">{row.value}</span>
            </div>
          ))}

          {/* Checklist */}
          <div className="space-y-1.5">
            <p className="text-xs font-extrabold text-[#16212B]">Checklist de relecture</p>
            {[
              'Ai-je répondu à toutes les questions ?',
              'Ai-je vérifié mes calculs et unités ?',
              'Ai-je justifié mes réponses ?',
              'Ai-je relu mes questions marquées ?',
            ].map(item => (
              <label key={item} className="flex items-center gap-2 text-[10px] cursor-pointer">
                <input type="checkbox" className="accent-[#2487B8]" />
                <span className="text-slate-600">{item}</span>
              </label>
            ))}
          </div>

          <div className="p-3 bg-[#DCEBF4]/30 rounded-xl border border-[#2487B8]/20 text-[10px] text-[#1B6C93]">
            Prenez quelques minutes pour relire vos réponses avant de soumettre.
          </div>

          {/* Technical status */}
          <div className="space-y-1.5">
            <p className="text-xs font-extrabold text-[#16212B]">Statut de l&apos;examen</p>
            {[
              { label: 'Connexion', icon: <Wifi className="w-3 h-3" />, value: 'Stable', ok: true },
              { label: 'Caméra / Microphone', icon: <Monitor className="w-3 h-3" />, value: 'Non requis', ok: null },
              { label: 'Enregistrement auto', icon: <Save className="w-3 h-3" />, value: 'Toutes les 30 sec', ok: true },
              { label: 'Fenêtre active', icon: <Monitor className="w-3 h-3" />, value: 'Oui', ok: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-[10px] border-b border-slate-100 pb-1.5">
                <div className="flex items-center gap-1.5 text-slate-500">
                  {row.icon}
                  <span>{row.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-bold ${row.ok === true ? 'text-[#17A673]' : row.ok === null ? 'text-slate-400' : 'text-rose-600'}`}>{row.value}</span>
                  {row.ok === true && <div className="w-2 h-2 rounded-full bg-[#17A673]" />}
                  {row.ok === null && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                </div>
              </div>
            ))}
          </div>

          {/* Chat */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="w-full flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors text-[11px] font-bold text-slate-600"
          >
            <MessageCircle className="w-4 h-4 text-[#2487B8]" />
            <div className="text-left">
              <p>Besoin d&apos;aide ?</p>
              <p className="text-[10px] text-slate-400 font-normal">Contactez le surveillant via le chat.</p>
            </div>
            <span className="ml-auto text-[10px] font-bold text-[#2487B8]">Ouvrir le chat</span>
          </button>
        </div>
      </div>
    </div>
  );
}
